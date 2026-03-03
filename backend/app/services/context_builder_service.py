"""컨텍스트 자동 빌딩 서비스 — 세션 생성 시 Memory + 최근 세션 + 파일 제안."""

import asyncio
import logging
import re
import time

from sqlalchemy import func, select

from app.core.database import Database
from app.models.file_change import FileChange
from app.models.message import Message
from app.models.session import Session
from app.models.workspace import Workspace
from app.schemas.claude_memory import MemoryContextResponse
from app.schemas.context import SessionContextSuggestion
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

    _LOCAL_PATH_CACHE_TTL = 300  # 5분

    def __init__(self, db: Database, memory_service: ClaudeMemoryService) -> None:
        super().__init__(db)
        self._memory_service = memory_service
        self._local_path_cache: dict[str, tuple[float, str]] = {}

    def invalidate_caches(self, workspace_id: str | None = None) -> None:
        """캐시 무효화 (T1+S4: 서비스 간 캐시 협조).

        workspace_id가 주어지면 해당 워크스페이스만, 없으면 전체 캐시 무효화.
        Memory 서비스의 캐시도 함께 무효화한다.
        """
        if workspace_id:
            cached = self._local_path_cache.get(workspace_id)
            local_path = cached[1] if cached else None
            # local_path 캐시 삭제
            self._local_path_cache.pop(workspace_id, None)
            # memory 서비스 캐시도 무효화
            if local_path:
                self._memory_service.invalidate_cache(local_path)
            logger.info("컨텍스트 캐시 무효화 (workspace_id=%s)", workspace_id)
        else:
            self._local_path_cache.clear()
            self._memory_service.invalidate_cache()
            logger.info("컨텍스트 캐시 전체 무효화")

    async def get_recent_sessions(
        self, workspace_id: str, limit: int = 5
    ) -> list[dict]:
        """동일 워크스페이스의 최근 세션 요약."""
        # 파일 변경 수 — correlated scalar subquery
        fc_count = (
            select(func.count())
            .where(FileChange.session_id == Session.id)
            .correlate(Session)
            .scalar_subquery()
            .label("file_count")
        )

        # 첫 번째 사용자 메시지 — correlated scalar subquery
        first_msg = (
            select(Message.content)
            .where(Message.session_id == Session.id, Message.role == "user")
            .order_by(Message.timestamp.asc())
            .limit(1)
            .correlate(Session)
            .scalar_subquery()
            .label("first_message")
        )

        stmt = (
            select(Session, first_msg, fc_count)
            .where(Session.workspace_id == workspace_id)
            .order_by(Session.created_at.desc())
            .limit(limit)
        )

        async with self._db.session() as db_session:
            result = await db_session.execute(stmt)
            rows = result.all()

        return [
            {
                "id": sess.id,
                "name": sess.name,
                "status": sess.status,
                "created_at": sess.created_at.isoformat()
                if sess.created_at
                else None,
                "prompt_preview": (first_message[:200] if first_message else ""),
                "file_count": file_count or 0,
            }
            for sess, first_message, file_count in rows
        ]

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
                    FileChange.file.label("file_path"),
                    func.count().label("change_count"),
                )
                .where(FileChange.session_id.in_(session_ids))
                .group_by(FileChange.file)
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
    ) -> SessionContextSuggestion:
        """Memory + 최근 세션 + 파일 제안을 종합한 컨텍스트.

        T5: 반환 타입을 dict → Pydantic SessionContextSuggestion으로 변경.
        P2: asyncio.gather로 3개 I/O 병렬 실행.
        """
        # workspace_id → local_path
        local_path = await self._get_local_path(workspace_id)

        # P2: 3개 독립 I/O를 병렬 실행 (return_exceptions로 부분 실패 허용)
        results = await asyncio.gather(
            self._memory_service.build_memory_context(local_path),
            self.get_recent_sessions(workspace_id, limit=5),
            self.suggest_files(workspace_id, prompt, limit=10),
            return_exceptions=True,
        )

        # 부분 실패 graceful 처리 — 실패한 항목은 빈 기본값 사용
        if isinstance(results[0], BaseException):
            logger.warning("Memory 컨텍스트 빌드 실패: %s", results[0])
            memory_response = MemoryContextResponse(memory_files=[], context_text="")
        else:
            memory_response = results[0]

        if isinstance(results[1], BaseException):
            logger.warning("최근 세션 조회 실패: %s", results[1])
            recent_sessions: list[dict] = []
        else:
            recent_sessions = results[1]

        if isinstance(results[2], BaseException):
            logger.warning("파일 제안 실패: %s", results[2])
            suggested_files: list[dict] = []
        else:
            suggested_files = results[2]

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

        return SessionContextSuggestion(
            memory_files=memory_response.memory_files,
            recent_sessions=recent_sessions,
            suggested_files=suggested_files,
            context_text=context_text,
        )

    async def get_local_path(self, workspace_id: str) -> str:
        """workspace_id → local_path 조회 (공개 API)."""
        return await self._get_local_path(workspace_id)

    async def _get_local_path(self, workspace_id: str) -> str:
        """workspace_id → local_path 조회 (5분 TTL 캐시)."""
        cached = self._local_path_cache.get(workspace_id)
        if cached and time.time() - cached[0] < self._LOCAL_PATH_CACHE_TTL:
            return cached[1]

        async with self._db.session() as db_session:
            stmt = select(Workspace.local_path).where(Workspace.id == workspace_id)
            result = await db_session.execute(stmt)
            local_path = result.scalar() or ""

        if not local_path:
            logger.warning("워크스페이스 local_path를 찾을 수 없음: %s", workspace_id)

        self._local_path_cache[workspace_id] = (time.time(), local_path)
        return local_path

    @staticmethod
    def _extract_keywords(text: str) -> list[str]:
        """텍스트에서 키워드를 추출."""
        tokens = re.findall(r"[a-zA-Z가-힣_]+", text.lower())
        return [t for t in tokens if t not in STOP_WORDS and len(t) >= 2]
