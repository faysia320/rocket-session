"""FastAPI 의존성 주입 프로바이더.

ServiceRegistry 클래스가 모든 서비스 인스턴스를 관리합니다.
모듈 레벨 get_* 함수들은 하위 호환성을 위해 유지되며, 레지스트리에 위임합니다.
"""

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.config import WORKSPACES_ROOT, Settings
from app.core.database import Database
from app.services.claude_runner import ClaudeRunner
from app.services.filesystem_service import FilesystemService
from app.services.git_service import GitService
from app.services.github_service import GitHubService
from app.services.jsonl_watcher import JsonlWatcher
from app.services.local_session_scanner import LocalSessionScanner
from app.services.mcp_service import McpService
from app.services.session_manager import SessionManager
from app.services.settings_service import SettingsService
from app.services.skills_service import SkillsService
from app.services.analytics_service import AnalyticsService
from app.services.search_service import SearchService
from app.services.tag_service import TagService
from app.services.team_coordinator import TeamCoordinator
from app.services.team_message_service import TeamMessageService
from app.services.team_service import TeamService
from app.services.team_task_service import TeamTaskService
from app.services.usage_service import UsageService
from app.services.websocket_manager import WebSocketManager
from app.services.workflow_definition_service import WorkflowDefinitionService
from app.services.workflow_service import WorkflowService
from app.services.workspace_service import WorkspaceService

logger = logging.getLogger(__name__)


class ServiceRegistry:
    """모든 서비스 인스턴스를 중앙 관리하는 레지스트리.

    새 서비스 추가 시:
    1. 타입 힌트 속성 추가
    2. initialize()에서 인스턴스 생성
    3. (필요 시) shutdown()에서 정리 로직 추가
    4. 모듈 레벨 get_* 함수 추가
    """

    def __init__(self) -> None:
        self.database: Database | None = None
        self.session_manager: SessionManager | None = None
        self.ws_manager: WebSocketManager | None = None
        self.claude_runner: ClaudeRunner | None = None
        self.filesystem_service: FilesystemService | None = None
        self.git_service: GitService | None = None
        self.github_service: GitHubService | None = None
        self.skills_service: SkillsService | None = None
        self.local_scanner: LocalSessionScanner | None = None
        self.usage_service: UsageService | None = None
        self.settings_service: SettingsService | None = None
        self.jsonl_watcher: JsonlWatcher | None = None
        self.mcp_service: McpService | None = None
        self.tag_service: TagService | None = None
        self.team_service: TeamService | None = None
        self.team_task_service: TeamTaskService | None = None
        self.team_coordinator: TeamCoordinator | None = None
        self.team_message_service: TeamMessageService | None = None
        self.search_service: SearchService | None = None
        self.analytics_service: AnalyticsService | None = None
        self.workflow_definition_service: WorkflowDefinitionService | None = None
        self.workflow_service: WorkflowService | None = None
        self.workspace_service: WorkspaceService | None = None

    def _require(self, name: str) -> Any:
        """서비스가 초기화되었는지 확인하고 반환."""
        value = getattr(self, name, None)
        if value is None:
            label = name.replace("_", " ").title().replace(" ", "")
            raise RuntimeError(f"{label}가 초기화되지 않았습니다")
        return value

    async def initialize(self) -> None:
        """앱 시작 시 모든 서비스 초기화."""
        settings = get_settings()
        self.filesystem_service = FilesystemService(root_dir=WORKSPACES_ROOT)
        self.git_service = GitService(root_dir=WORKSPACES_ROOT)
        self.github_service = GitHubService(git_service=self.git_service)
        self.skills_service = SkillsService()

        # 업로드 디렉토리 보장
        upload_path = Path(settings.resolved_upload_dir)
        upload_path.mkdir(parents=True, exist_ok=True)
        logger.info("업로드 디렉토리: %s", upload_path)

        # WebSocketManager를 DB 초기화 전에 인스턴스 생성
        self.ws_manager = WebSocketManager()
        self.database = Database(settings.database_url)
        await self.database.initialize()
        self.ws_manager.set_database(self.database)

        self.session_manager = SessionManager(
            self.database, upload_dir=settings.resolved_upload_dir
        )
        self.local_scanner = LocalSessionScanner(self.database)
        self.usage_service = UsageService()
        self.claude_runner = ClaudeRunner(settings)
        self.settings_service = SettingsService(self.database)
        self.mcp_service = McpService(self.database)
        self.tag_service = TagService(self.database)
        self.team_service = TeamService(self.database)
        self.team_task_service = TeamTaskService(self.database)
        self.team_coordinator = TeamCoordinator(
            self.database, self.session_manager, self.ws_manager, self.claude_runner
        )
        self.team_message_service = TeamMessageService(self.database)
        self.search_service = SearchService(self.database)
        self.analytics_service = AnalyticsService(self.database)
        self.workflow_definition_service = WorkflowDefinitionService(self.database)
        self.workflow_service = WorkflowService(self.database, self.workflow_definition_service)
        self.workspace_service = WorkspaceService(
            self.database, self.git_service, workspaces_root=WORKSPACES_ROOT
        )
        self.jsonl_watcher = JsonlWatcher(self.session_manager, self.ws_manager)

        # 서버 재시작 시 stale running 세션 → idle 복구
        from app.repositories.session_repo import SessionRepository

        async with self.database.session() as session:
            repo = SessionRepository(session)
            await repo.reset_stale_running()
            await session.commit()

        # seq 카운터를 DB에서 복원
        await self.ws_manager.restore_seq_counters(self.database)

        # 오래된 이벤트 정리 (24시간 이전)
        from app.repositories.event_repo import EventRepository

        async with self.database.session() as session:
            event_repo = EventRepository(session)
            await event_repo.cleanup_old_events(max_age_hours=24)
            await session.commit()

        # stale 워크스페이스 복구 (cloning/deleting 상태)
        if self.workspace_service:
            await self.workspace_service.cleanup_stale()

    async def shutdown(self) -> None:
        """앱 종료 시 서비스 정리."""
        # 1. 실행 중인 세션 프로세스 종료
        if self.session_manager:
            for sid in list(self.session_manager._process_manager.active_session_ids):
                try:
                    await self.session_manager.kill_process(sid)
                except Exception as e:
                    logger.error("세션 %s 프로세스 종료 실패: %s", sid, e)
        # 2. JSONL Watcher 종료
        if self.jsonl_watcher:
            try:
                self.jsonl_watcher.stop_all()
            except Exception as e:
                logger.error("JsonlWatcher 종료 실패: %s", e)
        # 3. Usage HTTP 클라이언트 정리
        if self.usage_service and hasattr(self.usage_service, "close"):
            try:
                await self.usage_service.close()
            except Exception as e:
                logger.error("UsageService 종료 실패: %s", e)
        # 4. DB 연결 종료
        if self.database:
            await self.database.close()

        # 모든 참조 해제
        for attr in list(vars(self)):
            setattr(self, attr, None)


# 싱글턴 레지스트리 인스턴스
_registry = ServiceRegistry()


# --- 하위 호환 getter 함수 (기존 코드와의 호환성 유지) ---


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


def get_database() -> Database:
    return _registry._require("database")


def get_session_manager() -> SessionManager:
    return _registry._require("session_manager")


def get_ws_manager() -> WebSocketManager:
    return _registry._require("ws_manager")


def get_claude_runner() -> ClaudeRunner:
    return _registry._require("claude_runner")


def get_filesystem_service() -> FilesystemService:
    return _registry._require("filesystem_service")


def get_git_service() -> GitService:
    return _registry._require("git_service")


def get_github_service() -> GitHubService:
    return _registry._require("github_service")


def get_skills_service() -> SkillsService:
    return _registry._require("skills_service")


def get_local_scanner() -> LocalSessionScanner:
    return _registry._require("local_scanner")


def get_usage_service() -> UsageService:
    return _registry._require("usage_service")


def get_settings_service() -> SettingsService:
    return _registry._require("settings_service")


def get_jsonl_watcher() -> JsonlWatcher:
    return _registry._require("jsonl_watcher")


def get_mcp_service() -> McpService:
    return _registry._require("mcp_service")


def get_tag_service() -> TagService:
    return _registry._require("tag_service")


def get_search_service() -> SearchService:
    return _registry._require("search_service")


def get_team_service() -> TeamService:
    return _registry._require("team_service")


def get_team_task_service() -> TeamTaskService:
    return _registry._require("team_task_service")


def get_team_coordinator() -> TeamCoordinator:
    return _registry._require("team_coordinator")


def get_team_message_service() -> TeamMessageService:
    return _registry._require("team_message_service")


def get_analytics_service() -> AnalyticsService:
    return _registry._require("analytics_service")


def get_workflow_definition_service() -> WorkflowDefinitionService:
    return _registry._require("workflow_definition_service")


def get_workflow_service() -> WorkflowService:
    return _registry._require("workflow_service")


def get_workspace_service() -> WorkspaceService:
    return _registry._require("workspace_service")


# --- 앱 라이프사이클 (레지스트리 위임) ---


async def init_dependencies() -> None:
    """앱 시작 시 모든 서비스 초기화."""
    await _registry.initialize()


async def shutdown_dependencies() -> None:
    """앱 종료 시 서비스 정리."""
    await _registry.shutdown()
