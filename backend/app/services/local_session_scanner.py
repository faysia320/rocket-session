"""로컬 Claude Code JSONL 세션 스캐너."""

import asyncio
import json
import logging
from pathlib import Path

from app.core.database import Database
from app.schemas.local_session import (
    ImportLocalSessionResponse,
    LocalSessionMeta,
)
from app.services.session_manager import SessionManager

logger = logging.getLogger(__name__)


def _get_claude_projects_dir() -> Path:
    """~/.claude/projects 경로 반환."""
    return Path.home() / ".claude" / "projects"


def _validate_safe_path(base: Path, *parts: str) -> Path:
    """경로 조합 후 base 디렉토리 내부인지 검증 (path traversal 방지)."""
    resolved = (base / Path(*parts)).resolve()
    if not str(resolved).startswith(str(base.resolve())):
        raise ValueError(f"허용되지 않은 경로: {'/'.join(parts)}")
    return resolved


class LocalSessionScanner:
    def __init__(self, db: Database):
        self._db = db

    async def scan(self, project_dir: str | None = None) -> list[LocalSessionMeta]:
        """프로젝트 JSONL 스캔. project_dir 없으면 전체 스캔."""
        base = _get_claude_projects_dir()
        if not base.exists():
            return []

        # 이미 import된 세션 ID 목록 조회
        imported_ids = await self._get_imported_session_ids()

        if project_dir:
            safe_dir = _validate_safe_path(base, project_dir)
            dirs = [safe_dir]
        else:
            dirs = [d for d in base.iterdir() if d.is_dir()]

        results: list[LocalSessionMeta] = []
        for d in dirs:
            if not d.exists():
                continue
            jsonl_files = list(d.glob("*.jsonl"))
            for f in jsonl_files:
                meta = await asyncio.to_thread(
                    self._extract_metadata, f, d.name, imported_ids
                )
                if meta:
                    results.append(meta)

        # 최근 수정 순 정렬
        results.sort(key=lambda m: m.last_timestamp or "", reverse=True)
        return results

    async def _get_imported_session_ids(self) -> set[str]:
        """DB에서 이미 import된 claude_session_id 목록 조회."""
        cursor = await self._db.conn.execute(
            "SELECT claude_session_id FROM sessions WHERE claude_session_id IS NOT NULL"
        )
        rows = await cursor.fetchall()
        return {row["claude_session_id"] for row in rows}

    def _extract_metadata(
        self, jsonl_path: Path, project_dir: str, imported_ids: set[str]
    ) -> LocalSessionMeta | None:
        """JSONL 파일에서 메타데이터 추출."""
        try:
            session_id = jsonl_path.stem  # UUID 파일명
            file_size = jsonl_path.stat().st_size

            cwd = ""
            git_branch: str | None = None
            slug: str | None = None
            version: str | None = None
            first_timestamp: str | None = None
            last_timestamp: str | None = None
            message_count = 0
            meta_extracted = False

            with open(jsonl_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue

                    # 메시지 카운트: type 필드로 빠르게 확인
                    if '"type":"user"' in line or '"type":"assistant"' in line:
                        message_count += 1

                    # 타임스탬프 추출 (모든 줄에서)
                    if '"timestamp"' in line:
                        try:
                            obj = json.loads(line)
                            ts = obj.get("timestamp")
                            if ts:
                                if first_timestamp is None:
                                    first_timestamp = ts
                                last_timestamp = ts
                        except json.JSONDecodeError:
                            continue

                    # 메타데이터는 처음 몇 줄에서만 추출
                    if not meta_extracted and (
                        '"sessionId"' in line or '"cwd"' in line
                    ):
                        try:
                            obj = json.loads(line)
                            if not cwd and obj.get("cwd"):
                                cwd = obj["cwd"]
                            if not git_branch and obj.get("gitBranch"):
                                git_branch = obj["gitBranch"]
                            if not version and obj.get("version"):
                                version = obj["version"]
                            if not slug and obj.get("slug"):
                                slug = obj["slug"]
                            if cwd and version:
                                meta_extracted = True
                        except json.JSONDecodeError:
                            continue

            if not cwd:
                # cwd가 없으면 프로젝트 디렉토리명에서 복원 시도
                cwd = project_dir.replace("--", "/").replace("-", "/")

            return LocalSessionMeta(
                session_id=session_id,
                project_dir=project_dir,
                cwd=cwd,
                git_branch=git_branch,
                slug=slug,
                version=version,
                first_timestamp=first_timestamp,
                last_timestamp=last_timestamp,
                file_size=file_size,
                message_count=message_count,
                already_imported=session_id in imported_ids,
            )
        except Exception:
            logger.warning("JSONL 파싱 실패: %s", jsonl_path, exc_info=True)
            return None

    async def import_session(
        self, session_id: str, project_dir: str, session_manager: SessionManager
    ) -> ImportLocalSessionResponse:
        """로컬 세션을 대시보드로 import."""
        # 중복 체크
        existing = await session_manager.find_by_claude_session_id(session_id)
        if existing:
            return ImportLocalSessionResponse(
                dashboard_session_id=existing["id"],
                claude_session_id=session_id,
                messages_imported=0,
            )

        # JSONL 파일 경로 (path traversal 검증)
        base = _get_claude_projects_dir()
        jsonl_path = _validate_safe_path(base, project_dir, f"{session_id}.jsonl")
        if not jsonl_path.exists():
            raise FileNotFoundError(f"JSONL 파일을 찾을 수 없습니다: {jsonl_path}")

        # 메타데이터 추출
        meta = await asyncio.to_thread(
            self._extract_metadata, jsonl_path, project_dir, set()
        )
        if not meta:
            raise ValueError("JSONL 메타데이터 추출 실패")

        # 대시보드 세션 생성
        dashboard_session = await session_manager.create(work_dir=meta.cwd)
        dashboard_id = dashboard_session["id"]

        # claude_session_id 연결 (--resume에 사용)
        await session_manager.update_claude_session_id(dashboard_id, session_id)

        # 메시지 파싱 및 저장
        messages_imported = await asyncio.to_thread(
            self._parse_messages, jsonl_path
        )

        for msg in messages_imported:
            await session_manager.add_message(
                session_id=dashboard_id,
                role=msg["role"],
                content=msg["content"],
                timestamp=msg["timestamp"],
            )

        return ImportLocalSessionResponse(
            dashboard_session_id=dashboard_id,
            claude_session_id=session_id,
            messages_imported=len(messages_imported),
        )

    def _parse_messages(self, jsonl_path: Path) -> list[dict]:
        """JSONL에서 user/assistant 메시지 추출."""
        messages: list[dict] = []
        try:
            with open(jsonl_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    msg_type = obj.get("type")
                    if msg_type not in ("user", "assistant"):
                        continue

                    message = obj.get("message", {})
                    content = message.get("content", "")

                    # content가 배열일 경우 텍스트만 추출
                    if isinstance(content, list):
                        text_parts = []
                        for part in content:
                            if isinstance(part, dict) and part.get("type") == "text":
                                text_parts.append(part.get("text", ""))
                            elif isinstance(part, str):
                                text_parts.append(part)
                        content = "\n".join(text_parts)

                    if not content or not content.strip():
                        continue

                    # isMeta 메시지는 건너뜀 (시스템 명령 등)
                    if obj.get("isMeta"):
                        continue

                    timestamp = obj.get("timestamp", "")
                    messages.append({
                        "role": message.get("role", msg_type),
                        "content": content,
                        "timestamp": timestamp,
                    })
        except Exception:
            logger.warning("메시지 파싱 실패: %s", jsonl_path, exc_info=True)

        return messages
