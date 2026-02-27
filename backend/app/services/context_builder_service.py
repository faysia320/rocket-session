"""컨텍스트 자동 빌딩 서비스 — 세션 생성 시 Memory + 최근 세션 + 파일 제안."""

import logging
import re

from sqlalchemy import func, select

from app.core.database import Database
from app.models.file_change import FileChange
from app.models.message import Message
from app.models.session import Session
from app.models.workspace import Workspace
from app.services.base import DBService
from app.services.claude_memory_service import ClaudeMemoryService

logger = logging.getLogger(__name__)

# 불용어 (한국어 + 영어)
STOP_WORDS = frozenset(
    {
        "the",
        "a",
        "an",
        "is",
        "are",
        "was",
        "were",
        "in",
        "on",
        "at",
        "to",
        "for",
        "of",
        "and",
        "or",
        "not",
        "this",
        "that",
        "it",
        "be",
        "have",
        "do",
        "will",
        "can",
        "with",
        "from",
        "by",
        "as",
        "but",
        "if",
        "는",
        "은",
        "이",
        "가",
        "를",
        "을",
        "의",
        "에",
        "에서",
        "로",
        "으로",
        "와",
        "과",
        "도",
        "만",
        "부터",
        "까지",
        "한",
        "하는",
        "된",
        "있는",
    }
)


class ContextBuilderService(DBService):
    """워크스페이스 컨텍스트를 자동으로 구성하는 서비스."""

    def __init__(self, db: Database, memory_service: ClaudeMemoryService) -> None:
        super().__init__(db)
        self._memory_service = memory_service

    async def get_recent_sessions(
        self, workspace_id: str, limit: int = 5
    ) -> list[dict]:
        """동일 워크스페이스의 최근 세션 요약."""
        async with self._db.session() as db_session:
            stmt = (
                select(Session)
                .where(Session.workspace_id == workspace_id)
                .order_by(Session.created_at.desc())
                .limit(limit)
            )
            result = await db_session.execute(stmt)
            sessions = list(result.scalars().all())

            summaries = []
            for sess in sessions:
                # 첫 메시지 미리보기
                msg_stmt = (
                    select(Message.content)
                    .where(Message.session_id == sess.id, Message.role == "user")
                    .order_by(Message.timestamp.asc())
                    .limit(1)
                )
                msg_result = await db_session.execute(msg_stmt)
                first_msg = msg_result.scalar()
                prompt_preview = first_msg[:200] if first_msg else ""

                # 파일 변경 수
                file_count_stmt = (
                    select(func.count())
                    .select_from(FileChange)
                    .where(FileChange.session_id == sess.id)
                )
                file_count_result = await db_session.execute(file_count_stmt)
                file_count = file_count_result.scalar() or 0

                summaries.append(
                    {
                        "id": sess.id,
                        "name": sess.name,
                        "status": sess.status,
                        "created_at": sess.created_at.isoformat()
                        if sess.created_at
                        else None,
                        "prompt_preview": prompt_preview,
                        "file_count": file_count,
                    }
                )
            return summaries

    async def suggest_files(
        self, workspace_id: str, prompt: str | None = None, limit: int = 10
    ) -> list[dict]:
        """프롬프트 키워드 + file_changes 빈도 기반 파일 제안."""
        async with self._db.session() as db_session:
            # 해당 워크스페이스의 세션 ID 목록
            session_ids_stmt = select(Session.id).where(
                Session.workspace_id == workspace_id
            )
            session_ids_result = await db_session.execute(session_ids_stmt)
            session_ids = [r[0] for r in session_ids_result.all()]

            if not session_ids:
                return []

            # 파일별 변경 빈도 집계
            freq_stmt = (
                select(
                    FileChange.file_path,
                    func.count().label("change_count"),
                )
                .where(FileChange.session_id.in_(session_ids))
                .group_by(FileChange.file_path)
                .order_by(func.count().desc())
                .limit(limit * 3)  # 충분히 가져와서 필터링
            )
            freq_result = await db_session.execute(freq_stmt)
            file_freqs = [
                {"file_path": row.file_path, "count": row.change_count}
                for row in freq_result.all()
            ]

            if not file_freqs:
                return []

            # 키워드 매칭으로 점수 부여
            keywords = self._extract_keywords(prompt) if prompt else []
            max_count = max(f["count"] for f in file_freqs)

            suggestions = []
            for f in file_freqs:
                freq_score = f["count"] / max_count if max_count > 0 else 0
                keyword_score = 0.0
                reason_parts = []

                if keywords:
                    path_lower = f["file_path"].lower()
                    matched = [kw for kw in keywords if kw in path_lower]
                    if matched:
                        keyword_score = len(matched) / len(keywords)
                        reason_parts.append(f"키워드 매칭: {', '.join(matched)}")

                if f["count"] >= 3:
                    reason_parts.append(f"최근 {f['count']}회 변경됨")
                elif f["count"] >= 1:
                    reason_parts.append(f"{f['count']}회 변경됨")

                score = freq_score * 0.6 + keyword_score * 0.4
                suggestions.append(
                    {
                        "file_path": f["file_path"],
                        "reason": " / ".join(reason_parts)
                        if reason_parts
                        else "자주 수정되는 파일",
                        "score": round(score, 3),
                    }
                )

            # 점수순 정렬 후 제한
            suggestions.sort(key=lambda x: x["score"], reverse=True)
            return suggestions[:limit]

    async def build_full_context(
        self, workspace_id: str, prompt: str | None = None
    ) -> dict:
        """Memory + 최근 세션 + 파일 제안을 종합한 컨텍스트."""
        # workspace_id → local_path
        local_path = await self._get_local_path(workspace_id)

        # Claude Code Memory 컨텍스트
        memory_response = await self._memory_service.build_memory_context(
            local_path, limit=5
        )

        # 최근 세션
        recent_sessions = await self.get_recent_sessions(workspace_id, limit=5)

        # 파일 제안
        suggested_files = await self.suggest_files(workspace_id, prompt, limit=10)

        # 통합 컨텍스트 텍스트 생성
        parts = []
        if memory_response.context_text:
            parts.append(memory_response.context_text)
        if recent_sessions:
            lines = ["## Recent Sessions"]
            for s in recent_sessions[:3]:
                name = s["name"] or s["id"][:8]
                preview = s["prompt_preview"][:80] if s["prompt_preview"] else ""
                lines.append(f"- **{name}**: {preview}")
            parts.append("\n".join(lines))
        if suggested_files:
            lines = ["## Suggested Files"]
            for f in suggested_files[:5]:
                lines.append(f"- `{f['file_path']}` ({f['reason']})")
            parts.append("\n".join(lines))

        context_text = "\n\n".join(parts) if parts else ""

        return {
            "memory_files": [
                mf.model_dump() for mf in memory_response.memory_files
            ],
            "recent_sessions": recent_sessions,
            "suggested_files": suggested_files,
            "context_text": context_text,
        }

    async def _get_local_path(self, workspace_id: str) -> str:
        """workspace_id → local_path 조회."""
        async with self._db.session() as db_session:
            stmt = select(Workspace.local_path).where(Workspace.id == workspace_id)
            result = await db_session.execute(stmt)
            local_path = result.scalar()
            if not local_path:
                return ""
            return local_path

    @staticmethod
    def _extract_keywords(text: str) -> list[str]:
        """텍스트에서 키워드를 추출."""
        tokens = re.findall(r"[a-zA-Z가-힣_]+", text.lower())
        return [t for t in tokens if t not in STOP_WORDS and len(t) >= 2]
