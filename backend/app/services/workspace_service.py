"""워크스페이스 생명주기 관리 서비스.

Git repo clone, 의존성 설치, pull/push 동기화를 담당합니다.
"""

import asyncio
import logging
import os
import shutil
import uuid
from datetime import datetime, timezone

from app.core.database import Database
from app.core.exceptions import ConflictError
from app.models.workspace import Workspace
from app.repositories.workspace_repo import WorkspaceRepository
from app.services.git_service import GitService

logger = logging.getLogger(__name__)


class RebaseConflictError(ConflictError):
    """Rebase 충돌 시 발생 — 로컬 커밋이 존재하여 사용자 확인이 필요한 경우."""

    pass


def _workspace_to_dict(ws: Workspace) -> dict:
    """Workspace ORM 엔티티를 dict로 변환."""
    return {
        "id": ws.id,
        "name": ws.name,
        "repo_url": ws.repo_url,
        "branch": ws.branch,
        "local_path": ws.local_path,
        "status": ws.status,
        "error_message": ws.error_message,
        "disk_usage_mb": ws.disk_usage_mb,
        "last_synced_at": ws.last_synced_at,
        "created_at": ws.created_at,
        "updated_at": ws.updated_at,
    }


class WorkspaceService:
    """워크스페이스 CRUD + clone/sync 생명주기 관리."""

    def __init__(
        self,
        db: Database,
        git_service: GitService,
        workspaces_root: str = "/workspaces",
    ) -> None:
        self._db = db
        self._git = git_service
        self._workspaces_root = workspaces_root
        # 진행 중인 clone 태스크 추적
        self._clone_tasks: dict[str, asyncio.Task] = {}

    async def create_workspace(
        self,
        repo_url: str,
        branch: str | None = None,
        name: str | None = None,
    ) -> dict:
        """워크스페이스 생성 + 비동기 clone 시작."""
        wid = str(uuid.uuid4())[:16]

        # repo URL에서 이름 추출 (미지정 시) — 경로 생성에 사용하므로 먼저 처리
        if not name:
            name = repo_url.rstrip("/").rsplit("/", 1)[-1].removesuffix(".git")

        # 레포명 기반 경로 생성 (중복 시 suffix)
        dir_name = name
        local_path = os.path.join(self._workspaces_root, dir_name)
        counter = 2
        while os.path.exists(local_path):
            dir_name = f"{name}-{counter}"
            local_path = os.path.join(self._workspaces_root, dir_name)
            counter += 1

        now = datetime.now(timezone.utc)
        async with self._db.session() as session:
            repo = WorkspaceRepository(session)
            entity = Workspace(
                id=wid,
                name=name,
                repo_url=repo_url,
                branch=branch,
                local_path=local_path,
                status="cloning",
                created_at=now,
            )
            await repo.add(entity)
            await session.commit()
            result = _workspace_to_dict(entity)

        # 비동기 clone 태스크 시작
        task = asyncio.create_task(self._clone_repo(wid, repo_url, branch, local_path))
        self._clone_tasks[wid] = task
        logger.info("워크스페이스 생성 시작: id=%s, repo=%s", wid, repo_url)
        return result

    async def _clone_repo(
        self,
        workspace_id: str,
        repo_url: str,
        branch: str | None,
        local_path: str,
    ) -> None:
        """백그라운드 git clone + 의존성 설치."""
        try:
            # 1단계: git clone
            cmd = ["git", "clone", "--progress"]
            if branch:
                cmd.extend(["--branch", branch])
            cmd.extend([repo_url, local_path])

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await asyncio.wait_for(proc.communicate(), timeout=600)

            if proc.returncode != 0:
                error_msg = stderr.decode(errors="replace")[:1000]
                logger.error(
                    "git clone 실패: workspace=%s, err=%s", workspace_id, error_msg
                )
                await self._update_status(workspace_id, "error", error_msg)
                return

            # 2단계: 의존성 자동 설치
            await self._install_dependencies(local_path)

            # 3단계: 디스크 사용량 계산 + status=ready
            disk_mb = await self._calc_disk_usage(local_path)
            now = datetime.now(timezone.utc)
            await self._update_status(
                workspace_id,
                "ready",
                disk_usage_mb=disk_mb,
                last_synced_at=now,
            )
            logger.info(
                "워크스페이스 준비 완료: id=%s, disk=%dMB", workspace_id, disk_mb
            )

        except asyncio.CancelledError:
            logger.info("워크스페이스 clone 취소됨: %s", workspace_id)
            shutil.rmtree(local_path, ignore_errors=True)
            await self._update_status(workspace_id, "error", "clone 취소됨")
        except asyncio.TimeoutError:
            logger.error("워크스페이스 clone 타임아웃: %s", workspace_id)
            shutil.rmtree(local_path, ignore_errors=True)
            await self._update_status(
                workspace_id, "error", "clone 타임아웃 (10분 초과)"
            )
        except Exception as e:
            logger.exception("워크스페이스 clone 예외: %s", workspace_id)
            await self._update_status(workspace_id, "error", str(e)[:1000])
        finally:
            self._clone_tasks.pop(workspace_id, None)

    async def _install_dependencies(self, local_path: str) -> None:
        """프로젝트 타입을 감지하여 의존성 자동 설치."""
        tasks = []

        # 루트 + 1단계 하위 디렉토리 탐색
        search_dirs = [local_path]
        try:
            for entry in os.scandir(local_path):
                if entry.is_dir() and not entry.name.startswith("."):
                    search_dirs.append(entry.path)
        except OSError:
            pass

        for dir_path in search_dirs:
            # Python 프로젝트 (pyproject.toml → uv sync)
            if os.path.isfile(os.path.join(dir_path, "pyproject.toml")):
                tasks.append(
                    self._run_install(
                        ["uv", "sync", "--frozen"],
                        cwd=dir_path,
                        label=f"uv sync ({os.path.basename(dir_path)})",
                    )
                )
            # Node.js 프로젝트 (pnpm-lock.yaml → pnpm install)
            elif os.path.isfile(os.path.join(dir_path, "pnpm-lock.yaml")):
                tasks.append(
                    self._run_install(
                        ["pnpm", "install", "--frozen-lockfile"],
                        cwd=dir_path,
                        label=f"pnpm install ({os.path.basename(dir_path)})",
                    )
                )
            # package-lock.json → npm ci (폴백)
            elif os.path.isfile(os.path.join(dir_path, "package-lock.json")):
                tasks.append(
                    self._run_install(
                        ["npm", "ci"],
                        cwd=dir_path,
                        label=f"npm ci ({os.path.basename(dir_path)})",
                    )
                )

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _run_install(self, cmd: list[str], cwd: str, label: str) -> None:
        """의존성 설치 명령 실행 (5분 타임아웃)."""
        logger.info("의존성 설치 시작: %s", label)
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
            if proc.returncode != 0:
                logger.warning(
                    "의존성 설치 실패 (%s): %s",
                    label,
                    stderr.decode(errors="replace")[:500],
                )
            else:
                logger.info("의존성 설치 완료: %s", label)
        except asyncio.TimeoutError:
            logger.warning("의존성 설치 타임아웃 (%s)", label)
        except Exception as e:
            logger.warning("의존성 설치 예외 (%s): %s", label, e)

    async def _calc_disk_usage(self, path: str) -> int:
        """디렉토리 디스크 사용량 계산 (MB)."""

        def _calc() -> int:
            total = 0
            for dirpath, _dirnames, filenames in os.walk(path):
                for f in filenames:
                    fp = os.path.join(dirpath, f)
                    try:
                        total += os.path.getsize(fp)
                    except OSError:
                        pass
            return total // (1024 * 1024)

        return await asyncio.to_thread(_calc)

    async def _update_status(
        self,
        workspace_id: str,
        status: str,
        error_message: str | None = None,
        **kwargs,
    ) -> None:
        """DB 상태 업데이트."""
        now = datetime.now(timezone.utc)
        async with self._db.session() as session:
            repo = WorkspaceRepository(session)
            await repo.update_status(
                workspace_id, status, error_message, updated_at=now, **kwargs
            )
            await session.commit()

    async def list_all(self) -> list[dict]:
        """전체 워크스페이스 목록 (ready 워크스페이스는 Git 실시간 정보 포함)."""
        async with self._db.session() as db_session:
            repo = WorkspaceRepository(db_session)
            entities = await repo.list_all()
            results = [_workspace_to_dict(e) for e in entities]

        # ready 워크스페이스에 Git 실시간 정보 병렬 조회
        async def _enrich(ws: dict) -> dict:
            if ws["status"] == "ready" and os.path.isdir(ws["local_path"]):
                try:
                    git_info = await self._git.get_git_info(ws["local_path"])
                    ws["current_branch"] = git_info.branch
                    ws["is_dirty"] = git_info.is_dirty
                    ws["ahead"] = git_info.ahead
                    ws["behind"] = git_info.behind
                except Exception:
                    pass
            return ws

        return list(await asyncio.gather(*[_enrich(ws) for ws in results]))

    async def get(self, workspace_id: str) -> dict | None:
        """워크스페이스 상세 조회 (ready 시 Git 정보 포함)."""
        async with self._db.session() as db_session:
            repo = WorkspaceRepository(db_session)
            entity = await repo.get_by_id(workspace_id)
            if not entity:
                return None
            result = _workspace_to_dict(entity)

        # ready 상태이면 Git 실시간 정보 추가
        if result["status"] == "ready" and os.path.isdir(result["local_path"]):
            try:
                git_info = await self._git.get_git_info(result["local_path"])
                result["current_branch"] = git_info.branch
                result["is_dirty"] = git_info.is_dirty
                result["ahead"] = git_info.ahead
                result["behind"] = git_info.behind
            except Exception:
                pass

        return result

    async def update(self, workspace_id: str, **kwargs) -> dict | None:
        """워크스페이스 속성 업데이트."""
        now = datetime.now(timezone.utc)
        async with self._db.session() as db_session:
            repo = WorkspaceRepository(db_session)
            entity = await repo.update_workspace(workspace_id, updated_at=now, **kwargs)
            if not entity:
                return None
            await db_session.commit()
            return _workspace_to_dict(entity)

    async def sync_workspace(
        self, workspace_id: str, action: str, force: bool = False
    ) -> tuple[bool, str, str | None]:
        """워크스페이스 pull 또는 push.

        Args:
            force: True이면 pull 시 원격으로 강제 리셋 (git reset --hard origin/<branch>)

        Returns:
            (success, message, commit_hash)

        Raises:
            RebaseConflictError: rebase 실패 + 로컬 커밋 존재 시 (사용자 확인 필요)
        """
        ws = await self.get(workspace_id)
        if not ws:
            return False, "워크스페이스를 찾을 수 없습니다", None
        if ws["status"] != "ready":
            return False, "워크스페이스가 준비되지 않았습니다", None

        local_path = ws["local_path"]

        if action == "pull":
            if force:
                success, msg = await self._git.reset_to_remote(local_path)
            else:
                success, msg, result_code = await self._git.smart_pull(local_path)
                if not success:
                    if result_code == "auto_reset":
                        # 로컬 전용 커밋 없음 → 자동 리셋
                        success, msg = await self._git.reset_to_remote(local_path)
                    else:
                        # needs_force_pull → 사용자 확인 필요
                        raise RebaseConflictError(msg)

            if success:
                now = datetime.now(timezone.utc)
                await self._update_status(workspace_id, "ready", last_synced_at=now)
            return success, msg, None

        elif action == "push":
            success, msg, commit_hash = await self._git.push(local_path)
            if success:
                now = datetime.now(timezone.utc)
                await self._update_status(workspace_id, "ready", last_synced_at=now)
            return success, msg, commit_hash

        return False, f"알 수 없는 동기화 액션: {action}", None

    async def delete_workspace(self, workspace_id: str) -> bool:
        """워크스페이스 삭제 (파일 + DB)."""
        async with self._db.session() as db_session:
            repo = WorkspaceRepository(db_session)
            entity = await repo.get_by_id(workspace_id)
            if not entity:
                return False
            local_path = entity.local_path

            # 영향 받는 세션 수 경고 로그
            from sqlalchemy import select, func
            from app.models.session import Session

            count_result = await db_session.execute(
                select(func.count()).where(Session.workspace_id == workspace_id)
            )
            affected = count_result.scalar() or 0
            if affected > 0:
                logger.warning(
                    "워크스페이스 삭제: %s — 연결된 세션 %d개의 workspace_id가 NULL로 설정됩니다",
                    workspace_id,
                    affected,
                )

            # 진행 중인 clone 취소
            task = self._clone_tasks.pop(workspace_id, None)
            if task and not task.done():
                task.cancel()

            # status=deleting
            await repo.update_status(workspace_id, "deleting")
            await db_session.commit()

        # 파일 삭제 (블로킹 I/O → thread)
        if os.path.isdir(local_path):
            await asyncio.to_thread(shutil.rmtree, local_path, True)

        # DB 삭제
        async with self._db.session() as db_session:
            repo = WorkspaceRepository(db_session)
            await repo.delete_by_id(workspace_id)
            await db_session.commit()

        logger.info("워크스페이스 삭제 완료: %s", workspace_id)
        return True

    async def cleanup_stale(self) -> None:
        """서버 재시작 시 stale cloning 상태 복구."""
        async with self._db.session() as db_session:
            repo = WorkspaceRepository(db_session)
            entities = await repo.list_all()
            for entity in entities:
                if entity.status == "cloning":
                    # clone 중이던 워크스페이스 → error 처리
                    await repo.update_status(
                        entity.id, "error", "서버 재시작으로 clone이 중단되었습니다"
                    )
                elif entity.status == "deleting":
                    # 삭제 중이던 워크스페이스 → 파일 정리 + DB 삭제
                    if os.path.isdir(entity.local_path):
                        await asyncio.to_thread(shutil.rmtree, entity.local_path, True)
                    await repo.delete_by_id(entity.id)
            await db_session.commit()
