# 프로젝트 구조 (전체 디렉토리 트리)

```
rocket-session/
├── backend/                          # FastAPI 백엔드
│   ├── app/
│   │   ├── main.py                   # FastAPI 앱 팩토리 + CORS + 라이프사이클
│   │   ├── core/
│   │   │   ├── config.py             # Pydantic BaseSettings (환경 설정)
│   │   │   └── database.py           # PostgreSQL + SQLAlchemy 엔진 + Alembic 마이그레이션
│   │   ├── api/
│   │   │   ├── dependencies.py       # DI 프로바이더 (싱글턴)
│   │   │   └── v1/
│   │   │       ├── api.py            # 라우터 통합
│   │   │       └── endpoints/
│   │   │           ├── health.py     # 헬스체크
│   │   │           ├── sessions.py   # 세션 CRUD + 내보내기
│   │   │           ├── files.py      # 파일 조회 + diff + 업로드
│   │   │           ├── filesystem.py # 디렉토리 탐색 + Git + 워크트리 + Skills
│   │   │           ├── local_sessions.py # 로컬 세션 스캔/import
│   │   │           ├── permissions.py    # Permission 요청/응답 (MCP 연계)
│   │   │           ├── usage.py      # 사용량 조회 (ccusage)
│   │   │           ├── ws.py         # WebSocket 엔드포인트
│   │   │           ├── settings.py   # 글로벌 설정
│   │   │           ├── mcp.py        # MCP 서버 관리
│   │   │           ├── tags.py       # 세션 태그
│   │   │           ├── analytics.py  # 분석 데이터
│   │   │           ├── workflow.py   # 워크플로우 관리
│   │   │           ├── workflow_definitions.py  # 워크플로우 정의
│   │   │           ├── workspaces.py  # 워크스페이스 CRUD + 동기화
│   │   │           └── teams.py       # 팀 채팅
│   │   ├── models/
│   │   │   ├── base.py               # SQLAlchemy DeclarativeBase
│   │   │   ├── session.py            # Session ORM 모델
│   │   │   ├── session_artifact.py   # SessionArtifact + ArtifactAnnotation ORM 모델
│   │   │   ├── message.py            # Message ORM 모델
│   │   │   ├── file_change.py        # FileChange ORM 모델
│   │   │   ├── event.py              # Event ORM 모델
│   │   │   ├── event_types.py        # WebSocket 이벤트 타입 (워크플로우 이벤트 포함)
│   │   │   ├── global_settings.py    # GlobalSettings ORM 모델
│   │   │   ├── mcp_server.py         # McpServer ORM 모델
│   │   │   ├── tag.py                # Tag + SessionTag ORM 모델
│   │   │   ├── token_snapshot.py    # TokenSnapshot ORM 모델
│   │   │   ├── workflow_definition.py # WorkflowDefinition ORM 모델
│   │   │   ├── workspace.py         # Workspace ORM 모델
│   │   │   ├── team.py              # Team ORM 모델
│   │   │   ├── team_message.py      # TeamMessage ORM 모델
│   │   │   └── team_task.py         # TeamTask ORM 모델
│   │   ├── repositories/
│   │   │   ├── base.py               # BaseRepository
│   │   │   ├── session_repo.py       # SessionRepository
│   │   │   ├── message_repo.py       # MessageRepository
│   │   │   ├── file_change_repo.py   # FileChangeRepository
│   │   │   ├── event_repo.py         # EventRepository
│   │   │   ├── settings_repo.py      # SettingsRepository
│   │   │   ├── mcp_server_repo.py    # McpServerRepository
│   │   │   ├── tag_repo.py           # TagRepository
│   │   │   ├── token_snapshot_repo.py # TokenSnapshotRepository
│   │   │   ├── search_repo.py        # SearchRepository
│   │   │   ├── analytics_repo.py     # AnalyticsRepository
│   │   │   ├── artifact_repo.py      # ArtifactRepository
│   │   │   ├── workflow_definition_repo.py # WorkflowDefinitionRepository
│   │   │   ├── workspace_repo.py    # WorkspaceRepository
│   │   │   ├── team_repo.py         # TeamRepository
│   │   │   ├── team_task_repo.py    # TeamTaskRepository
│   │   │   └── team_message_repo.py # TeamMessageRepository
│   │   ├── schemas/
│   │   │   ├── session.py            # 세션 Request/Response 스키마
│   │   │   ├── workflow.py           # 워크플로우 스키마
│   │   │   ├── usage.py              # 사용량 스키마
│   │   │   ├── filesystem.py         # 파일시스템 + Git 스키마
│   │   │   ├── local_session.py      # 로컬 세션 스키마
│   │   │   ├── settings.py           # 글로벌 설정 스키마
│   │   │   ├── mcp.py               # MCP 서버 스키마
│   │   │   ├── tag.py                # 태그 스키마
│   │   │   ├── analytics.py          # 분석 스키마
│   │   │   ├── search.py             # 검색 스키마
│   │   │   ├── workflow_definition.py # 워크플로우 정의 스키마
│   │   │   ├── common.py            # 공통 응답 스키마
│   │   │   ├── workspace.py         # 워크스페이스 스키마
│   │   │   └── team.py              # 팀 스키마
│   │   └── services/
│   │       ├── session_manager.py    # 세션 생명주기 관리
│   │       ├── claude_runner.py      # Claude CLI subprocess + JSON 스트림 파싱
│   │       ├── websocket_manager.py  # WS 연결 관리 + 이벤트 버퍼링
│   │       ├── usage_service.py      # ccusage CLI 사용량 조회
│   │       ├── filesystem_service.py # 파일시스템 + Git 워크트리
│   │       ├── local_session_scanner.py # 로컬 세션 스캐너
│   │       ├── settings_service.py   # 글로벌 설정 관리
│   │       ├── mcp_service.py        # MCP 서버 관리
│   │       ├── tag_service.py        # 태그 관리
│   │       ├── search_service.py     # 전문 검색 (TSVECTOR)
│   │       ├── workflow_definition_service.py # 워크플로우 정의 관리
│   │       ├── pending_questions.py  # AskUserQuestion 대기 상태 관리
│   │       ├── analytics_service.py  # 분석 데이터 집계
│   │       ├── jsonl_watcher.py      # JSONL 세션 실시간 감시
│   │       ├── event_handler.py      # 이벤트 처리
│   │       ├── workflow_service.py   # 워크플로우 3단계 관리 (Research → Plan → Implement)
│   │       ├── permission_mcp_server.py # Permission MCP 서버 (stdio)
│   │       ├── workspace_service.py   # Git clone 기반 워크스페이스 관리
│   │       ├── git_service.py         # Git 작업 래퍼 (clone, checkout, pull/push)
│   │       ├── github_service.py      # GitHub API 연동 (PR 생성 등)
│   │       ├── skills_service.py      # 슬래시 명령어 스킬 관리
│   │       ├── session_process_manager.py # 세션별 프로세스 관리
│   │       ├── team_service.py        # 팀 관리
│   │       ├── team_coordinator.py    # 팀 작업 분배 코디네이터
│   │       ├── team_task_service.py   # 팀 작업 관리
│   │       └── team_message_service.py # 팀 메시지 관리
│   ├── migrations/                       # Alembic 마이그레이션
│   │   ├── versions/                     # 마이그레이션 버전 파일
│   │   └── env.py
│   ├── alembic.ini                   # Alembic 설정
│   ├── tests/                        # pytest 테스트
│   ├── Dockerfile                    # 컨테이너 (Python 3.11 + Node.js 22)
│   ├── .env.example                  # 환경 변수 템플릿
│   └── pyproject.toml
│
├── frontend/                         # React + TypeScript 프론트엔드
│   ├── src/
│   │   ├── main.tsx                  # React 엔트리포인트
│   │   ├── App.tsx                   # Provider 래핑 (Query + Router + Tooltip + Toaster)
│   │   ├── index.css                 # Tailwind + Deep Space 테마 (HSL CSS 변수)
│   │   ├── routeTree.gen.ts          # TanStack Router 자동 생성
│   │   ├── config/
│   │   │   └── env.ts                # 환경 설정
│   │   ├── types/
│   │   │   ├── session.ts            # SessionInfo, SessionStatus
│   │   │   ├── message.ts            # Message, FileChange, WebSocketEvent
│   │   │   ├── workflow.ts           # Workflow 타입 (Phase, Status, Artifact, Annotation)
│   │   │   ├── usage.ts              # Usage 타입
│   │   │   ├── filesystem.ts         # FileSystem, Git 타입
│   │   │   ├── local-session.ts      # LocalSession 타입
│   │   │   ├── mcp.ts                # MCP 서버 타입
│   │   │   ├── tag.ts                # 태그 타입
│   │   │   ├── settings.ts           # 설정 타입
│   │   │   ├── notification.ts       # 알림 타입
│   │   │   ├── analytics.ts           # 분석 타입
│   │   │   ├── workspace.ts           # 워크스페이스 타입
│   │   │   ├── team.ts                # 팀 타입
│   │   │   ├── ws-events.ts           # WebSocket 이벤트 타입
│   │   │   └── index.ts              # barrel export
│   │   ├── store/
│   │   │   ├── useSessionStore.ts    # Zustand - 활성 세션 ID, UI 상태
│   │   │   ├── useCommandPaletteStore.ts # 명령 팔레트 상태
│   │   │   └── index.ts
│   │   ├── routes/
│   │   │   ├── __root.tsx            # 루트 레이아웃 (Sidebar + UsageFooter)
│   │   │   ├── index.tsx             # 홈 (EmptyState)
│   │   │   └── session/
│   │   │       ├── $sessionId.tsx    # 세션 작업 공간 (ChatPanel + FilePanel)
│   │   │       └── new.tsx           # 새 세션 생성
│   │   ├── components/
│   │   │   └── ui/                   # shadcn/ui + 공통 컴포넌트 (CodeBlock, MarkdownRenderer 등)
│   │   ├── features/
│   │   │   ├── session/              # 세션 관리
│   │   │   │   ├── components/       # Sidebar, SessionSettings, SessionSetupPanel, ImportLocalDialog
│   │   │   │   └── hooks/            # useSessions, sessionKeys
│   │   │   ├── chat/                 # 채팅 인터페이스
│   │   │   │   ├── components/       # ChatPanel, MessageBubble, ChatInput, ChatHeader
│   │   │   │   │                     # ActivityStatusBar, PermissionDialog, SlashCommandPopup
│   │   │   │   ├── hooks/            # useClaudeSocket, useSlashCommands
│   │   │   │   └── constants/        # slashCommands.ts
│   │   │   ├── workflow/             # 워크플로우 시스템
│   │   │   │   ├── components/       # WorkflowProgressBar, WorkflowPhaseCard,
│   │   │   │   │                     # ArtifactViewer, ArtifactAnnotationPanel, PhaseApprovalBar
│   │   │   │   └── hooks/            # useWorkflow, useWorkflowActions
│   │   │   ├── files/                # 파일 변경 추적
│   │   │   │   └── components/       # FilePanel, FileViewer, DiffViewer
│   │   │   ├── directory/            # 디렉토리 탐색
│   │   │   │   ├── components/       # DirectoryBrowser, DirectoryPicker, GitInfoCard, WorktreePanel
│   │   │   │   └── hooks/            # useDirectoryBrowser, useGitInfo, useWorktrees
│   │   │   ├── usage/                # 사용량 표시
│   │   │   │   ├── components/       # UsageFooter
│   │   │   │   └── hooks/            # useUsage, usageKeys
│   │   │   ├── git-monitor/          # Git 상태 모니터링
│   │   │   │   └── components/       # GitStatusFileList, GitDropdownMenu
│   │   │   ├── mcp/                  # MCP 서버 관리
│   │   │   │   └── components/       # McpServerManager, McpServerForm, McpServerSelector
│   │   │   ├── settings/             # 글로벌 설정
│   │   │   │   └── components/       # GlobalSettingsDialog
│   │   │   ├── notification/         # 알림 시스템
│   │   │   │   ├── components/       # NotificationSettingsPanel
│   │   │   │   └── hooks/            # useNotificationCenter, useNotificationSettings
│   │   │   ├── command-palette/      # 명령 팔레트 (Ctrl+K)
│   │   │   │   ├── components/       # CommandPaletteProvider
│   │   │   │   ├── commands/         # git.ts, chat.ts, session.ts
│   │   │   │   └── hooks/            # useGlobalShortcuts
│   │   │   ├── analytics/             # 분석 대시보드
│   │   │   ├── dashboard/             # 대시보드 뷰
│   │   │   ├── history/               # 히스토리 뷰
│   │   │   ├── layout/                # 레이아웃 (Split View 등)
│   │   │   ├── workspace/             # 워크스페이스 관리
│   │   │   ├── team/                  # 팀 채팅
│   │   │   ├── tags/                  # 태그 관리
│   │   └── lib/
│   │       ├── utils.ts              # cn() 유틸리티 (clsx + tailwind-merge)
│   │       └── api/                  # ApiClient + 도메인별 API 함수
│   ├── design-system/                # 디자인 시스템
│   │   ├── css/variables.css         # spacing, typography, radius, shadow 토큰
│   │   ├── tokens/                   # TS 토큰 (spacing, colors, zIndex 등)
│   │   ├── eslint/                   # ESLint 규칙 (하드코딩 금지)
│   │   ├── tailwind/plugin.js        # Tailwind 플러그인
│   │   └── GUIDELINES.md             # 디자인 시스템 가이드
│   ├── tsconfig.json                 # TypeScript 설정 (references)
│   ├── tsconfig.app.json             # 앱 TypeScript 설정 (strict, path aliases)
│   ├── tailwind.config.js            # Tailwind CSS 설정 (Deep Space 테마)
│   ├── components.json               # shadcn/ui 설정
│   ├── vite.config.ts                # Vite + TanStack Router 플러그인
│   ├── Dockerfile                    # 컨테이너 (Node.js 22 + nginx)
│   ├── nginx.conf                    # Nginx 프록시 설정
│   └── package.json
│
├── docker-compose.yml                # Docker Compose 구성 (PostgreSQL + Backend + Frontend)
├── CLAUDE.md                         # 개발 가이드 (이 파일)
└── README.md
```