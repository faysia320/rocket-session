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

    async def scan(
        self, project_dir: str | None = None, since: str | None = None
    ) -> list[LocalSessionMeta]:
        """프로젝트 JSONL 스캔. project_dir 없으면 전체 스캔.

        continuation 체인을 감지하여 root 세션에 병합합니다.

        Args:
            project_dir: 특정 프로젝트만 스캔 (없으면 전체)
            since: ISO 형식 날짜/시간. 이 시점 이후 수정된 파일만 스캔
        """
        base = _get_claude_projects_dir()
        if not base.exists():
            return []

        # since 파라미터를 타임스탬프로 변환 (파일 mtime 비교용)
        since_mtime: float | None = None
        if since:
            try:
                from datetime import datetime, timezone

                dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
                since_mtime = dt.timestamp()
            except (ValueError, TypeError):
                logger.warning("잘못된 since 파라미터: %s", since)

        # 이미 import된 세션 ID 목록 조회
        imported_ids = await self._get_imported_session_ids()

        if project_dir:
            safe_dir = _validate_safe_path(base, project_dir)
            dirs = [safe_dir]
        else:
            dirs = [d for d in base.iterdir() if d.is_dir()]

        # 1단계: 모든 JSONL에서 메타데이터 + parent_session_id 수집
        raw_results: list[tuple[LocalSessionMeta, str | None]] = []
        for d in dirs:
            if not d.exists():
                continue
            jsonl_files = list(d.glob("*.jsonl"))
            for f in jsonl_files:
                # 파일 수정 시간 기반 사전 필터링 (파싱 비용 절감)
                if since_mtime and f.stat().st_mtime < since_mtime:
                    continue

                result = await asyncio.to_thread(
                    self._extract_metadata, f, d.name, imported_ids
                )
                if result:
                    raw_results.append(result)

        # 2단계: continuation 체인 병합
        results = self._merge_continuation_chains(raw_results)

        # 최근 수정 순 정렬
        results.sort(key=lambda m: m.last_timestamp or "", reverse=True)
        return results

    @staticmethod
    def _merge_continuation_chains(
        raw_results: list[tuple[LocalSessionMeta, str | None]],
    ) -> list[LocalSessionMeta]:
        """continuation 체인을 root 세션에 병합.

        parent_session_id가 있는 항목은 continuation으로 판별하여
        root 세션의 stats에 합산하고 continuation_ids에 추가합니다.
        """
        # continuation 관계 맵: {continuation_id: parent_id}
        continuations: dict[str, str] = {}
        # 모든 meta를 session_id로 인덱싱
        meta_map: dict[str, LocalSessionMeta] = {}

        for meta, parent_id in raw_results:
            meta_map[meta.session_id] = meta
            if parent_id:
                continuations[meta.session_id] = parent_id

        # root 찾기: 체인을 따라가며 더 이상 parent가 없는 노드
        def find_root(sid: str) -> str:
            visited: set[str] = set()
            while sid in continuations and sid not in visited:
                visited.add(sid)
                sid = continuations[sid]
            return sid

        # root별로 continuation 그룹핑
        root_groups: dict[str, list[str]] = {}  # {root_id: [continuation_ids]}
        for cont_id in continuations:
            root_id = find_root(cont_id)
            root_groups.setdefault(root_id, []).append(cont_id)

        # root에 continuation stats 합산
        merged_ids: set[str] = set()
        for root_id, cont_ids in root_groups.items():
            root_meta = meta_map.get(root_id)
            if not root_meta:
                # root JSONL이 삭제된 경우 — continuation을 그대로 유지
                continue

            # continuation을 시간순 정렬
            cont_metas = [
                meta_map[cid] for cid in cont_ids if cid in meta_map
            ]
            cont_metas.sort(key=lambda m: m.first_timestamp or "")

            for cont_meta in cont_metas:
                root_meta.message_count += cont_meta.message_count
                root_meta.file_size += cont_meta.file_size

                # 타임스탬프 범위 확장
                if cont_meta.first_timestamp:
                    if (
                        not root_meta.first_timestamp
                        or cont_meta.first_timestamp < root_meta.first_timestamp
                    ):
                        root_meta.first_timestamp = cont_meta.first_timestamp
                if cont_meta.last_timestamp:
                    if (
                        not root_meta.last_timestamp
                        or cont_meta.last_timestamp > root_meta.last_timestamp
                    ):
                        root_meta.last_timestamp = cont_meta.last_timestamp

                root_meta.continuation_ids.append(cont_meta.session_id)
                merged_ids.add(cont_meta.session_id)

        # continuation이 아닌 세션만 결과에 포함
        return [
            meta for sid, meta in meta_map.items() if sid not in merged_ids
        ]

    async def _get_imported_session_ids(self) -> set[str]:
        """DB에서 이미 import된 claude_session_id 목록 조회."""
        cursor = await self._db.conn.execute(
            "SELECT claude_session_id FROM sessions WHERE claude_session_id IS NOT NULL"
        )
        rows = await cursor.fetchall()
        return {row["claude_session_id"] for row in rows}

    def _extract_metadata(
        self, jsonl_path: Path, project_dir: str, imported_ids: set[str]
    ) -> tuple[LocalSessionMeta, str | None] | None:
        """JSONL 파일에서 메타데이터 추출.

        Returns:
            (meta, parent_session_id) 튜플.
            parent_session_id는 continuation 파일이면 원본 세션 ID, 아니면 None.
        """
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
            parent_session_id: str | None = None
            first_event_checked = False

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

                            # continuation 판별: 첫 이벤트의 sessionId가 파일명과 다르면 continuation
                            if not first_event_checked and obj.get("sessionId"):
                                first_event_checked = True
                                first_session_id = obj["sessionId"]
                                if first_session_id != session_id:
                                    parent_session_id = first_session_id

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

            meta = LocalSessionMeta(
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
            return meta, parent_session_id
        except Exception:
            logger.warning("JSONL 파싱 실패: %s", jsonl_path, exc_info=True)
            return None

    async def import_session(
        self, session_id: str, project_dir: str, session_manager: SessionManager
    ) -> ImportLocalSessionResponse:
        """로컬 세션을 대시보드로 import.

        continuation 체인이 있으면 root + 모든 continuation JSONL을 시간순으로 파싱합니다.
        """
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
        result = await asyncio.to_thread(
            self._extract_metadata, jsonl_path, project_dir, set()
        )
        if not result:
            raise ValueError("JSONL 메타데이터 추출 실패")
        meta, _ = result

        # continuation 체인 탐색
        continuation_chain = await asyncio.to_thread(
            self._find_continuation_chain, base / project_dir, session_id
        )

        # 대시보드 세션 생성
        dashboard_session = await session_manager.create(work_dir=meta.cwd)
        dashboard_id = dashboard_session["id"]

        # claude_session_id 연결 (--resume에 사용)
        await session_manager.update_claude_session_id(dashboard_id, session_id)

        # JSONL 파일 경로 저장 (실시간 감시용)
        await self._db.update_session_jsonl_path(
            dashboard_id, str(jsonl_path)
        )

        # root JSONL + continuation JSONL 순서대로 메시지 파싱
        all_jsonl_paths = [jsonl_path]
        for cont_id in continuation_chain:
            cont_path = base / project_dir / f"{cont_id}.jsonl"
            if cont_path.exists():
                all_jsonl_paths.append(cont_path)

        all_messages: list[dict] = []
        for path in all_jsonl_paths:
            messages = await asyncio.to_thread(self._parse_messages, path)
            all_messages.extend(messages)

        for msg in all_messages:
            await session_manager.add_message(
                session_id=dashboard_id,
                role=msg["role"],
                content=msg["content"],
                timestamp=msg["timestamp"],
            )

        return ImportLocalSessionResponse(
            dashboard_session_id=dashboard_id,
            claude_session_id=session_id,
            messages_imported=len(all_messages),
        )

    def _find_continuation_chain(
        self, project_path: Path, root_session_id: str
    ) -> list[str]:
        """프로젝트 디렉토리에서 root_session_id를 참조하는 continuation JSONL 탐색.

        Returns:
            시간순으로 정렬된 continuation session ID 목록.
        """
        continuations: list[tuple[str, str]] = []  # (session_id, first_timestamp)

        for jsonl_path in project_path.glob("*.jsonl"):
            file_id = jsonl_path.stem
            if file_id == root_session_id:
                continue

            try:
                with open(jsonl_path, "r", encoding="utf-8") as f:
                    # 첫 번째 이벤트의 sessionId만 확인
                    parent_id = None
                    first_ts = ""
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            obj = json.loads(line)
                            if obj.get("sessionId"):
                                sid = obj["sessionId"]
                                if sid != file_id:
                                    parent_id = sid
                                first_ts = obj.get("timestamp", "")
                                break
                        except json.JSONDecodeError:
                            continue

                    if not parent_id:
                        continue

                    # 이 파일이 root를 직접/간접적으로 참조하는지 확인
                    # 직접 참조하거나, 이미 발견된 continuation을 참조하는 경우
                    chain = {root_session_id}
                    chain.update(c[0] for c in continuations)
                    if parent_id in chain:
                        continuations.append((file_id, first_ts))
            except Exception:
                continue

        # 체인이 길어지면 간접 참조를 놓칠 수 있으므로 반복 탐색
        # (A→root, B→A 인데 A를 B보다 늦게 발견하는 경우)
        if continuations:
            changed = True
            while changed:
                changed = False
                known_ids = {root_session_id}
                known_ids.update(c[0] for c in continuations)
                for jsonl_path in project_path.glob("*.jsonl"):
                    file_id = jsonl_path.stem
                    if file_id in known_ids:
                        continue
                    try:
                        with open(jsonl_path, "r", encoding="utf-8") as f:
                            for line in f:
                                line = line.strip()
                                if not line:
                                    continue
                                try:
                                    obj = json.loads(line)
                                    sid = obj.get("sessionId")
                                    if sid and sid != file_id and sid in known_ids:
                                        first_ts = obj.get("timestamp", "")
                                        continuations.append((file_id, first_ts))
                                        changed = True
                                    break
                                except json.JSONDecodeError:
                                    continue
                    except Exception:
                        continue

        # 시간순 정렬
        continuations.sort(key=lambda x: x[1])
        return [c[0] for c in continuations]

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
                    messages.append(
                        {
                            "role": message.get("role", msg_type),
                            "content": content,
                            "timestamp": timestamp,
                        }
                    )
        except Exception:
            logger.warning("메시지 파싱 실패: %s", jsonl_path, exc_info=True)

        return messages
