# 서비스 아키텍처 상세

## 핵심 서비스 목록

| 서비스 | 역할 | 상태 저장 |
|--------|------|----------|
| `SessionManager` | 세션 생명주기 (CRUD, 상태 전환) | PostgreSQL + 프로세스 핸들(인메모리) |
| `ClaudeRunner` | Claude CLI subprocess 실행 + 스트리밍 JSON 파싱 | 프로세스 핸들 |
| `WebSocketManager` | WebSocket 연결 관리 + 이벤트 브로드캐스트 + 버퍼링 | 연결 레지스트리 + PostgreSQL (events) |
| `UsageService` | ccusage CLI 호출 + 사용량 캐싱 | 60초 TTL 인메모리 캐시 |
| `FilesystemService` | 디렉토리 탐색, Git 정보, 워크트리, Skills | 없음 (stateless) |
| `LocalSessionScanner` | `~/.claude/projects/` JSONL 세션 스캔/import | 없음 |
| `PermissionMCPServer` | 도구 사용 승인 요청/응답 MCP 서버 (stdio) | asyncio.Event 기반 대기 |
| `SettingsService` | 글로벌 기본 설정 관리 | PostgreSQL |
| `McpService` | MCP 서버 설정 관리 | PostgreSQL |
| `TagService` | 세션 태그 관리 | PostgreSQL |
| `SearchService` | 전문 검색 (TSVECTOR) | PostgreSQL |
| `AnalyticsService` | 세션 분석 데이터 집계 | PostgreSQL |
| `WorkflowService` | 3단계 워크플로우 관리 (Research → Plan → Implement) | PostgreSQL |
| `WorkflowDefinitionService` | 워크플로우 정의 CRUD + 기본값/내보내기/가져오기 | PostgreSQL |
| `JsonlWatcher` | JSONL 세션 파일 실시간 감시 | 인메모리 |
| `EventHandler` | WebSocket 이벤트 처리/라우팅 | 없음 (stateless) |
| `WorkspaceService` | Git clone 기반 워크스페이스 관리 | PostgreSQL + 비동기 clone task |
| `GitService` | Git 작업 래퍼 (clone, checkout, worktree, pull/push) | 없음 (stateless) |
| `GitHubService` | GitHub API 연동 (PR 생성 등) | 없음 |
| `SkillsService` | 슬래시 명령어 스킬 관리 | 없음 (stateless) |
| `SessionProcessManager` | 세션별 프로세스 관리 (PID 추적 등) | 인메모리 |


> **참고**: 세션/메시지/파일 변경/이벤트는 PostgreSQL에 영속 저장됩니다. 프로세스 핸들만 인메모리로 관리되어 서버 재시작 시 실행 중인 세션의 프로세스 연결은 끊어집니다.

## DI 프로바이더 (dependencies.py)

모든 서비스는 `backend/app/api/dependencies.py`에서 싱글턴으로 관리됩니다.
앱 시작 시 `init_dependencies()`로 초기화합니다.

```python
get_settings()           # @lru_cache, Pydantic Settings
get_database()           # Database (PostgreSQL asyncpg + SQLAlchemy)
get_session_manager()    # SessionManager (DB 의존)
get_ws_manager()         # WebSocketManager
get_claude_runner()      # ClaudeRunner (Settings 의존)
get_filesystem_service() # FilesystemService (stateless)
get_local_scanner()      # LocalSessionScanner (DB 의존)
get_usage_service()      # UsageService (Settings 의존)
get_settings_service()   # SettingsService (DB 의존)
get_mcp_service()        # McpService (DB 의존)
get_tag_service()        # TagService (DB 의존)
get_search_service()     # SearchService (DB 의존)
get_analytics_service()  # AnalyticsService (DB 의존)
get_workflow_service()   # WorkflowService (DB 의존)
get_jsonl_watcher()      # JsonlWatcher (SessionManager + WsManager 의존)
```

## 환경 변수 (.env)

`backend/.env` 파일로 관리 (Pydantic Settings):

```env
DATABASE_URL=postgresql+asyncpg://rocket:rocket_secret@localhost:5432/rocket_session  # PostgreSQL 연결 URL
CLAUDE_ALLOWED_TOOLS=Read,Write,Edit,MultiEdit,Bash,Glob,Grep,WebFetch,WebSearch,TodoRead,TodoWrite  # 허용 도구
BACKEND_HOST=0.0.0.0                      # 서버 호스트
BACKEND_PORT=8101                         # 서버 포트
UPLOAD_DIR=/app/uploads                   # 파일 업로드 디렉토리
CORS_EXTRA_ORIGINS=                       # 추가 CORS 허용 출처
GIT_USER_NAME=                            # Git 커밋 사용자 이름
GIT_USER_EMAIL=                           # Git 커밋 이메일
GITHUB_TOKEN=                             # GitHub API 토큰 (PR 생성 등)
```