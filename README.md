# rocket-session

브라우저에서 Claude Code CLI 세션을 관리하고 모니터링하는 웹 대시보드입니다.

## 설치

### 전제조건

- [Docker](https://www.docker.com/) + Docker Compose V2
- [Claude Code CLI](https://www.npmjs.com/package/@anthropic-ai/claude-code) 인증 완료 (`~/.claude/` 디렉토리)

### 설치 및 실행

```bash
# 1. 소스 코드 가져오기
git clone https://github.com/faysia320/rocket-session.git
cd rocket-session

# 2. 환경 변수 설정
cp .env.docker.example .env.docker
# .env.docker 파일에서 CLAUDE_AUTH_DIR, CLAUDE_AUTH_FILE 등 수정

# 3. 서비스 시작 (최초 실행 시 Docker 이미지 빌드로 5-10분 소요)
docker-compose --env-file .env.docker up -d --build
```

http://localhost:8100 에서 대시보드에 접속합니다.

### 서비스 관리

```bash
docker compose ps          # 상태 확인
docker compose logs -f     # 로그 보기
docker compose down        # 중지
docker compose down -v     # 중지 + 볼륨 삭제
```

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                  Frontend (React + TypeScript)               │
│  shadcn/ui + Tailwind CSS, TanStack Router/Query, Zustand   │
│  localhost:8100                                              │
└─────────────────────────────────────────────────────────────┘
                    │ WebSocket + REST API
                    │ (Vite 프록시 → localhost:8101)
┌─────────────────────────────────────────────────────────────┐
│                  API Layer (FastAPI)                         │
│  Sessions · Files · Filesystem · Usage · Permissions · WS   │
│  Settings · MCP · Tags · Analytics · Workspaces             │
│  Teams · Workflow · Workflow Definitions                     │
└─────────────────────────────────────────────────────────────┘
                    │ subprocess (asyncio)
┌─────────────────────────────────────────────────────────────┐
│              Claude Code CLI                                 │
│  --output-format stream-json                                 │
│  --continue / --resume                                       │
└─────────────────────────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL (asyncpg + SQLAlchemy ORM)            │
│  sessions · messages · file_changes · events · workspaces    │
│  global_settings · mcp_servers · tags · workflow_definitions  │
│  token_snapshots · teams · team_messages · team_tasks         │
└─────────────────────────────────────────────────────────────┘
```

## 주요 기능

- **세션 관리** — 생성, 재개, 삭제, 설정 변경, Markdown 내보내기
- **실시간 스트리밍** — WebSocket을 통한 Claude 응답 실시간 표시
- **파일 변경 추적** — Claude가 수정한 파일 목록 + Git diff 뷰어
- **Workflow 시스템** — 3단계 워크플로우 (Research → Plan → Implement), 아티팩트 생성 + 인라인 주석 + 승인 게이트
- **Permission Mode** — 도구 사용 시 사용자 승인 요청 (MCP 서버 연계)
- **이미지 업로드** — 프롬프트에 이미지 첨부 가능
- **사용량 추적** — 5시간 블록 + 주간 사용량 (ccusage 연동)
- **로컬 세션 가져오기** — `~/.claude/projects/` 기존 세션 import
- **디렉토리 탐색** — 파일시스템 브라우저 + Git 정보 + 워크트리 관리
- **슬래시 명령어** — `/` 입력 시 커스텀 스킬 자동완성
- **WebSocket 재연결** — 네트워크 끊김 후 놓친 이벤트 자동 복구
- **활동 상태바** — 실행 중인 도구, 비용, 시간 실시간 표시
- **MCP 서버 관리** — MCP 서버 설정, 활성화/비활성화, 세션별 연결
- **워크플로우 정의** — 워크플로우 정의 관리 (생성/수정/삭제/내보내기/가져오기)
- **세션 태그** — 태그로 세션 분류 및 필터링
- **분석 대시보드** — 토큰 사용량, 비용, 모델별 통계
- **명령 팔레트** — Ctrl+K로 빠른 명령 실행 (세션/Git/채팅)
- **알림 시스템** — 세션 완료/오류 알림 + 사운드
- **Git 모니터** — Git 상태 추적, 커밋, PR 생성, Rebase
- **전문 검색** — PostgreSQL TSVECTOR 기반 세션 전문 검색
- **글로벌 설정** — 새 세션의 기본값을 일괄 관리
- **JSONL 실시간 감시** — 로컬 Claude 세션 파일 변경 자동 감지
- **워크스페이스** — Git clone 기반 워크스페이스 관리 (자동 의존성 설치, Pull/Push 동기화)
- **팀 채팅** — 다중 Claude 에이전트 팀 협업 (Coordinator가 작업 분배)

## UI 구조 (컴포넌트 맵)

### 전체 레이아웃

```
+-------------------------------------------------------------------+
|  [Sidebar]       |  [Main Content Area]                            |
|  260px           |  flex-1                                         |
|  (16px 접힘)     |                                                 |
|                  |  3가지 뷰 모드:                                  |
|  + New Session   |   1) 단일 세션 뷰 (기본)                        |
|  Import Local    |   2) Split View (최대 5개 패널 병렬)             |
|                  |   3) Dashboard View (카드 그리드 + Git Monitor)  |
|  SESSIONS [N]    |                                                 |
|  [검색________]  |  ┌─── 단일 세션 뷰 ──────────────────────────┐  |
|  All|Run|Idle|Err|  │ ChatHeader                                │  |
|                  |  │ SessionStatsBar                            │  |
|  ● Session 1     |  │ ChatSearchBar (Ctrl+F)                    │  |
|    2 msgs 1 chg  |  │                                           │  |
|    ~/project/..  |  │ ┌─ Message ScrollArea ──────────────────┐ │  |
|                  |  │ │ UserMessage (우측 말풍선)              │ │  |
|  ● Session 2     |  │ │ AssistantText (스트리밍 카드)          │ │  |
|    5 msgs 3 chg  |  │ │ ToolUseMsg (접이식 카드)              │ │  |
|    ~/other/..    |  │ │   - TodoWriteMessage                  │ │  |
|                  |  │ │   - EditToolMessage (인라인 diff)      │ │  |
|  ...             |  │ │   - BashToolMessage ($ 커맨드)         │ │  |
|                  |  │ │   - ToolUseMessage (기타 도구)         │ │  |
|                  |  │ │ ThinkingMessage (접이식)               │ │  |
|                  |  │ │ ResultMessage / WorkflowPhaseCard      │ │  |
|                  |  │ │ ErrorMessage (빨간색, 재시도)          │ │  |
|                  |  │ │ SystemMessage (중앙 구분선)            │ │  |
|                  |  │ │ AskUserQuestionCard (인터랙티브)       │ │  |
|                  |  │ │ PermissionRequestMessage               │ │  |
|                  |  │ └────────────────────────────────────────┘ │  |
|                  |  │ ActivityStatusBar (실행 중 도구 표시)      │  |
|  [🔔][⚙][🌙]    |  │ ChatInput (이미지, 텍스트입력)             │  |
|  [📊][⫼][«]     |  │   └ SlashCommandPopup (/ 입력 시)         │  |
|                  |  └───────────────────────────────────────────┘  |
+------------------+------------------------------------------------+
| [Rocket Session]       [5hr: N% (HHhMMm) | 주간: N% (HHhMMm)]    |
+-------------------------------------------------------------------+
                        UsageFooter (h-8, 하단 고정)
```

### 컴포넌트별 상세

#### Sidebar (`features/session/components/Sidebar.tsx`)

```
aside (260px, 접힘 시 16px)
├── [상단] 새 세션 버튼 + Import Local 버튼
│     접힘 시: + 아이콘 버튼만 표시
├── [헤더] "SESSIONS" 라벨 + 세션 수 배지
├── [검색] 검색 입력창 + 상태 필터 탭 (All|Run|Idle|Err|Archived)
├── [목록] ScrollArea - 세션 리스트
│     SessionItem:
│     ├── 상태 점 (●초록=running, ●빨강=error, ●회색=idle)
│     ├── 세션명 (더블클릭으로 인라인 수정)
│     ├── 삭제 버튼 (×) + 확인 다이얼로그
│     ├── "N msgs · N changes"
│     └── 작업 디렉토리 (잘린 경로, 툴팁)
└── [푸터] 아이콘 버튼 행
      ├── 알림 토글 (Bell)
      ├── 글로벌 설정 (Settings) → GlobalSettingsDialog
      ├── 테마 전환 (Sun/Moon)
      ├── Dashboard 뷰 토글 (LayoutGrid)
      ├── Split View 토글 (Columns2)
      └── 사이드바 접기/펼치기 (PanelLeftClose/PanelLeftOpen)
```

#### ChatHeader (`features/chat/components/ChatHeader.tsx`)

```
div (border-b, bg-secondary, min-h-11)
├── [왼쪽]
│     ├── 모바일 메뉴 버튼 (md:hidden)
│     ├── 연결 상태 점 (●초록/●빨강/●주황 + 펄스)
│     ├── 상태 텍스트 ("Connected" / "Running" / "Reconnecting" 등)
│     ├── 재연결 실패 시 Retry 버튼
│     ├── | 작업 디렉토리 (데스크톱, 잘린 경로 + 툴팁)
│     └── | Git 브랜치명 (데스크톱, 잘린 경로 + 툴팁)
└── [오른쪽]
      ├── ModelSelector (드롭다운)
      ├── GitDropdownMenu (Commit, PR, Rebase, 워크트리 삭제)
      └── ButtonGroup
            ├── SessionDropdownMenu (보관, 내보내기, 설정)
            └── 파일 변경 Sheet 트리거 (FolderOpen + 배지 카운트)
                 └── SheetContent → FilePanel
```

#### SessionStatsBar (`features/session/components/SessionStatsBar.tsx`)

```
div (border-b, bg-card/50)
├── ⚡ 총 토큰 수 (input/output/cache 툴팁)
├── 🕐 총 소요 시간
├── 메시지 수 ("N msgs")
└── [오른쪽] ContextWindowBar
      └── 프로그래스 바 (파랑<75%, 주황<90%, 빨강≥90%) + 퍼센트 + 잔여 턴
```

#### ChatInput (`features/chat/components/ChatInput.tsx`)

```
div (border-t, bg-secondary)
├── [위] SlashCommandPopup (/ 입력 시 팝업, 명령어 목록)
├── [위] 드래그 오버레이 ("이미지를 여기에 놓으세요")
├── 답변 대기 인디케이터 ("N개 답변이 다음 메시지에 포함됩니다")
├── 이미지 미리보기 행 (첨부된 이미지 썸네일 + 제거 버튼)
└── 입력 행 (bg-input, rounded)
      ├── 이미지 첨부 버튼 (Image)
      ├── Textarea (자동 리사이즈, 모노스페이스)
      └── Send/Stop 버튼
            ├── 실행 중: "Stop" (빨간색, Square 아이콘)
            └── 대기 중: "Send" (파란색, Send 아이콘)

키보드 단축키:
  Enter       → 전송
  Shift+Enter → 줄바꿈
  Escape      → 실행 중지 / 입력 초기화
```

#### FilePanel (`features/files/components/FilePanel.tsx`)

ChatHeader의 파일 변경 버튼 클릭 시 우측 Sheet에 표시:

```
div (Sheet 내부, 480px)
├── [헤더] 📁 "File Changes" + 카운트 배지 ("N files / M edits")
└── ScrollArea
      ├── 빈 상태: "No file changes yet"
      └── MergedFileChangeItem (파일별 병합):
            Collapsible:
            ├── [헤더] 화살표 + 도구 배지(Edit/Write/Bash) + 횟수 + 시간 + 전체보기
            ├── 파일 경로 (축약, 툴팁으로 전체 경로)
            └── [펼침] DiffViewer (인라인 diff, max 300px)
```

### 메시지 타입 레퍼런스

MessageBubble 컴포넌트가 `message.type`에 따라 다른 UI를 렌더링합니다:

| 타입                 | 컴포넌트             | 위치/스타일            | 설명                                  |
| -------------------- | -------------------- | ---------------------- | ------------------------------------- |
| `user_message`       | UserMessage          | 우측 정렬, 파란 말풍선 | 사용자 입력 메시지                    |
| `assistant_text`     | AssistantText        | 좌측 카드, 파란 좌측선 | 스트리밍 중 부분 텍스트               |
| `result`             | ResultMessage        | 좌측 카드, 파란 좌측선 | 턴 완료 (Markdown, 토큰/시간 메타)    |
| `result` (workflow)  | WorkflowPhaseCard    | 좌측 카드, 주황 좌측선 | 워크플로우 단계 결과 + 승인/수정 버튼 |
| `tool_use`           | ToolUseMsg 계열      | 좌측 카드, 접이식      | 도구 실행 (아래 상세)                 |
| `thinking`           | ThinkingMessage      | 좌측, 접이식           | 확장 사고 (Brain 아이콘)              |
| `error`              | ErrorMessage         | 빨간 배경/테두리       | 오류 + 재시도 버튼                    |
| `stderr`             | StderrMessage        | 작은 경고 텍스트       | CLI stderr 출력                       |
| `system`             | SystemMessage        | 중앙 구분선            | 시스템 알림 (모드 변경 등)            |
| `event`              | EventMessage         | 접이식, Zap 아이콘     | 일반 이벤트 (JSON)                    |
| `permission_request` | PermissionRequestMsg | 주황 배경              | 도구 승인 요청                        |
| `ask_user_question`  | AskUserQuestionCard  | 좌측 카드, 파란 좌측선 | 질문 + 선택지/체크박스/텍스트 입력    |

#### tool_use 서브 타입

| 도구 이름                        | 컴포넌트         | 표시 내용                           |
| -------------------------------- | ---------------- | ----------------------------------- |
| `TodoWrite`                      | TodoWriteMessage | 할 일 목록 (체크/진행/대기 아이콘)  |
| `Edit`, `MultiEdit`, `Write`     | EditToolMessage  | 파일 경로 + 인라인 diff (빨강/초록) |
| `Bash`                           | BashToolMessage  | `$ 명령어` + 실행 결과 (에러=빨강)  |
| 기타 (`Read`, `Glob`, `Grep` 등) | ToolUseMessage   | 도구명 + 요약 + JSON 입력/출력      |

### 뷰 모드

| 모드           | 트리거                     | 설명                                             |
| -------------- | -------------------------- | ------------------------------------------------ |
| **단일 세션**  | 기본                       | 한 세션의 ChatPanel을 전체 영역에 표시           |
| **Split View** | 사이드바 Columns2 아이콘   | 최대 5개 세션을 수평 분할                        |
| **Dashboard**  | 사이드바 LayoutGrid 아이콘 | 상단 60% 세션 카드 그리드 + 하단 40% Git Monitor |

### WebSocket 이벤트 타입

프론트엔드가 수신하는 WebSocket 이벤트와 UI 반영:

| 이벤트                        | UI 반영                                                  |
| ----------------------------- | -------------------------------------------------------- |
| `session_state`               | 초기 세션 데이터 + 메시지 히스토리 로드                  |
| `status`                      | 헤더 상태 점/텍스트 업데이트, idle/error 시 도구 정리    |
| `user_message`                | UserMessage 말풍선 추가                                  |
| `assistant_text`              | AssistantText 카드 생성/업데이트 (스트리밍)              |
| `tool_use`                    | ToolUseMsg 카드 추가 + ActivityStatusBar에 등록          |
| `tool_result`                 | 도구 상태 완료/에러 업데이트, ActivityStatusBar에서 제거 |
| `file_change`                 | FilePanel 목록에 추가                                    |
| `result`                      | assistant_text를 ResultMessage로 병합, 토큰/비용 메타    |
| `error`                       | ErrorMessage 추가                                        |
| `thinking`                    | ThinkingMessage 생성/업데이트                            |
| `permission_request`          | PermissionDialog 모달 표시                               |
| `workflow_started`            | 워크플로우 시작, WorkflowProgressBar 활성화              |
| `workflow_phase_completed`    | 단계 완료, PhaseApprovalBar 표시                         |
| `workflow_phase_approved`     | 단계 승인, 다음 단계 진행                                |
| `workflow_revision_requested` | 수정 요청, 해당 단계 재실행                              |
| `workflow_completed`          | 워크플로우 전체 완료                                     |
| `stopped`                     | 상태 idle, 도구 정리, SystemMessage 추가                 |
| `ask_user_question`           | AskUserQuestionCard 표시 (선택지/체크박스)               |
| `missed_events`               | 재연결 시 놓친 이벤트 순차 재처리                        |

### 오버레이 / 모달

| 컴포넌트                 | 트리거                          | 설명                                           |
| ------------------------ | ------------------------------- | ---------------------------------------------- |
| **PermissionDialog**     | `permission_request` 이벤트     | 도구 승인 다이얼로그 (120초 타이머, 자동 거부) |
| **FileViewer**           | FilePanel 파일 클릭             | 파일 내용 + Git diff 탭 뷰                     |
| **SessionSettings**      | SessionDropdownMenu → 세션 설정 | 시스템 프롬프트, 도구 설정, 타임아웃 등        |
| **GlobalSettingsDialog** | 사이드바 Settings 아이콘        | 전역 설정                                      |
| **ImportLocalDialog**    | Import Local 버튼               | 로컬 세션 스캔/import                          |
| **CommandPalette**       | Ctrl+K                          | 전역 명령 팔레트 (cmdk)                        |

## 기술 스택

### Frontend

| 항목            | 기술                                           |
| --------------- | ---------------------------------------------- |
| 언어            | TypeScript 5.x                                 |
| 프레임워크      | React 18.3                                     |
| 빌드 도구       | Vite 6.x                                       |
| 라우팅          | TanStack Router                                |
| 서버 상태       | TanStack Query                                 |
| 클라이언트 상태 | Zustand 5.x                                    |
| UI 컴포넌트     | shadcn/ui + Radix UI                           |
| 스타일링        | Tailwind CSS 3.4 + Deep Space 테마             |
| Markdown        | react-markdown + remark-gfm + rehype-highlight |
| 패키지 매니저   | **pnpm**                                       |

### Backend

| 항목            | 기술                                     |
| --------------- | ---------------------------------------- |
| 언어            | Python 3.10+                             |
| 프레임워크      | FastAPI 0.115                            |
| 데이터베이스    | PostgreSQL (asyncpg) + SQLAlchemy ORM    |
| 마이그레이션    | Alembic                                  |
| HTTP 클라이언트 | httpx                                    |
| WebSocket       | websockets 14.1                          |
| 설정 관리       | Pydantic Settings 2.x                    |
| 테스트          | pytest + pytest-asyncio + testcontainers |
| 패키지 매니저   | **uv**                                   |

## 사전 요구사항

- Python 3.10+
- PostgreSQL 16+ (또는 Docker로 자동 실행)
- [uv](https://docs.astral.sh/uv/) (Python 패키지 매니저)
- Node.js 18+
- [pnpm](https://pnpm.io/) (Node 패키지 매니저)
- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)
- Claude Pro/Max 구독 또는 API key

## 빠른 시작 (개발 환경)

### 로컬 실행

```bash
# Backend
cd backend
cp .env.example .env   # DATABASE_URL 수정
uv sync

# PostgreSQL 시작 (Docker 사용 시)
docker run -d --name rocket-pg \
  -e POSTGRES_DB=rocket_session \
  -e POSTGRES_USER=rocket \
  -e POSTGRES_PASSWORD=rocket_secret \
  -p 5432:5432 postgres:16-alpine

uv run uvicorn app.main:app --host 0.0.0.0 --port 8101 --reload

# Frontend (별도 터미널)
cd frontend
pnpm install
pnpm dev
```

http://localhost:8100 에서 접속

### Docker 실행

```bash
# 환경 변수 설정
cp .env.docker.example .env.docker
# CLAUDE_AUTH_DIR, CLAUDE_AUTH_FILE 수정

docker compose up -d
```

http://localhost:8100 에서 접속

## 환경 변수

`backend/.env` 파일:

```env
DATABASE_URL=postgresql+asyncpg://rocket:rocket_secret@localhost:5432/rocket_session  # PostgreSQL 연결 URL
CLAUDE_ALLOWED_TOOLS=Read,Write,Edit,MultiEdit,Bash,Glob,Grep,WebFetch,WebSearch,TodoRead,TodoWrite  # 허용 도구
BACKEND_HOST=0.0.0.0                      # 서버 호스트
BACKEND_PORT=8101                         # 서버 포트
UPLOAD_DIR=/tmp/rocket-session-uploads    # 파일 업로드 디렉토리
CORS_ORIGINS=http://localhost:8100,http://localhost:8101  # CORS 허용 출처
```

## 프로젝트 구조

```
rocket-session/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI 앱 팩토리 + CORS + 라이프사이클
│   │   ├── core/
│   │   │   ├── config.py              # Pydantic BaseSettings
│   │   │   └── database.py            # PostgreSQL + SQLAlchemy 엔진 + 마이그레이션
│   │   ├── api/
│   │   │   ├── dependencies.py        # DI 싱글턴 프로바이더
│   │   │   └── v1/
│   │   │       ├── api.py             # 라우터 통합
│   │   │       └── endpoints/
│   │   │           ├── health.py      # 헬스체크
│   │   │           ├── sessions.py    # 세션 CRUD + 내보내기
│   │   │           ├── files.py       # 파일 조회 + diff + 업로드
│   │   │           ├── filesystem.py  # 디렉토리 탐색 + Git + 워크트리 + Skills
│   │   │           ├── local_sessions.py  # 로컬 세션 스캔/import
│   │   │           ├── permissions.py # Permission 요청/응답
│   │   │           ├── usage.py       # 사용량 조회 (ccusage)
│   │   │           ├── ws.py          # WebSocket 엔드포인트
│   │   │           ├── settings.py    # 글로벌 설정
│   │   │           ├── mcp.py         # MCP 서버 관리
│   │   │           ├── tags.py        # 세션 태그
│   │   │           ├── analytics.py   # 분석 데이터
│   │   │           ├── workflow.py    # 워크플로우 관리
│   │   │           ├── workflow_definitions.py  # 워크플로우 정의
│   │   │           ├── workspaces.py  # 워크스페이스 CRUD + 동기화
│   │   │           └── teams.py       # 팀 채팅
│   │   ├── models/
│   │   │   ├── base.py              # SQLAlchemy Base 클래스
│   │   │   ├── session.py           # Session ORM 모델
│   │   │   ├── session_artifact.py  # SessionArtifact + ArtifactAnnotation ORM 모델
│   │   │   ├── message.py           # Message ORM 모델
│   │   │   ├── file_change.py       # FileChange ORM 모델
│   │   │   ├── event.py             # Event ORM 모델
│   │   │   ├── event_types.py       # WebSocket 이벤트 타입
│   │   │   ├── global_settings.py   # GlobalSettings ORM 모델
│   │   │   ├── mcp_server.py        # McpServer ORM 모델
│   │   │   ├── tag.py               # Tag + SessionTag ORM 모델
│   │   │   ├── token_snapshot.py    # TokenSnapshot ORM 모델
│   │   │   ├── workflow_definition.py # WorkflowDefinition ORM 모델
│   │   │   ├── workspace.py         # Workspace ORM 모델
│   │   │   ├── team.py              # Team ORM 모델
│   │   │   ├── team_message.py      # TeamMessage ORM 모델
│   │   │   └── team_task.py         # TeamTask ORM 모델
│   │   ├── repositories/
│   │   │   ├── base.py              # BaseRepository
│   │   │   ├── session_repo.py      # SessionRepository
│   │   │   ├── message_repo.py      # MessageRepository
│   │   │   ├── file_change_repo.py  # FileChangeRepository
│   │   │   ├── event_repo.py        # EventRepository
│   │   │   ├── settings_repo.py     # SettingsRepository
│   │   │   ├── mcp_server_repo.py   # McpServerRepository
│   │   │   ├── tag_repo.py          # TagRepository
│   │   │   ├── search_repo.py       # SearchRepository
│   │   │   ├── analytics_repo.py    # AnalyticsRepository
│   │   │   ├── artifact_repo.py     # ArtifactRepository
│   │   │   ├── token_snapshot_repo.py # TokenSnapshotRepository
│   │   │   ├── workflow_definition_repo.py # WorkflowDefinitionRepository
│   │   │   ├── workspace_repo.py    # WorkspaceRepository
│   │   │   ├── team_repo.py         # TeamRepository
│   │   │   ├── team_task_repo.py    # TeamTaskRepository
│   │   │   └── team_message_repo.py # TeamMessageRepository
│   │   ├── schemas/
│   │   │   ├── session.py           # 세션 스키마
│   │   │   ├── workflow.py          # 워크플로우 스키마
│   │   │   ├── usage.py             # 사용량 스키마
│   │   │   ├── filesystem.py        # 파일시스템 + Git 스키마
│   │   │   ├── local_session.py     # 로컬 세션 스키마
│   │   │   ├── settings.py          # 글로벌 설정 스키마
│   │   │   ├── mcp.py              # MCP 서버 스키마
│   │   │   ├── tag.py               # 태그 스키마
│   │   │   ├── analytics.py         # 분석 스키마
│   │   │   ├── search.py            # 검색 스키마
│   │   │   ├── workspace.py         # 워크스페이스 스키마
│   │   │   ├── workflow_definition.py # 워크플로우 정의 스키마
│   │   │   ├── common.py            # 공통 응답 스키마
│   │   │   └── team.py              # 팀 스키마
│   │   └── services/
│   │       ├── session_manager.py     # 세션 생명주기 관리
│   │       ├── session_process_manager.py # 세션별 프로세스 관리
│   │       ├── claude_runner.py       # Claude CLI subprocess + JSON 스트림 파싱
│   │       ├── websocket_manager.py   # WS 연결 관리 + 이벤트 버퍼링
│   │       ├── usage_service.py       # ccusage CLI 사용량 조회
│   │       ├── filesystem_service.py  # 파일시스템 + Git 워크트리
│   │       ├── git_service.py         # Git 작업 래퍼 (clone, checkout, pull/push)
│   │       ├── github_service.py      # GitHub API 연동 (PR 생성 등)
│   │       ├── skills_service.py      # 슬래시 명령어 스킬 관리
│   │       ├── local_session_scanner.py # 로컬 세션 스캐너
│   │       ├── settings_service.py    # 글로벌 설정 관리
│   │       ├── mcp_service.py         # MCP 서버 관리
│   │       ├── tag_service.py         # 태그 관리
│   │       ├── search_service.py      # 전문 검색 (TSVECTOR)
│   │       ├── analytics_service.py   # 분석 데이터 집계
│   │       ├── jsonl_watcher.py       # JSONL 세션 실시간 감시
│   │       ├── event_handler.py       # 이벤트 처리
│   │       ├── workflow_service.py    # 워크플로우 3단계 관리
│   │       ├── workflow_definition_service.py # 워크플로우 정의 관리
│   │       ├── pending_questions.py   # AskUserQuestion 대기 상태 관리
│   │       ├── workspace_service.py   # Git clone 기반 워크스페이스 관리
│   │       ├── permission_mcp_server.py # Permission MCP 서버
│   │       ├── team_service.py        # 팀 관리
│   │       ├── team_coordinator.py    # 팀 작업 분배 코디네이터
│   │       ├── team_task_service.py   # 팀 작업 관리
│   │       └── team_message_service.py # 팀 메시지 관리
│   ├── migrations/                    # Alembic 마이그레이션
│   │   ├── versions/                  # 마이그레이션 버전 파일
│   │   └── env.py
│   ├── alembic.ini                   # Alembic 설정
│   ├── tests/
│   ├── Dockerfile
│   └── pyproject.toml
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx                   # React 엔트리포인트
│   │   ├── App.tsx                    # Provider 래핑
│   │   ├── index.css                  # Deep Space 테마 (HSL CSS 변수)
│   │   ├── config/env.ts              # 환경 설정
│   │   ├── types/
│   │   │   ├── session.ts             # SessionInfo, SessionStatus
│   │   │   ├── workflow.ts            # Workflow 타입
│   │   │   ├── message.ts             # Message, FileChange, WebSocketEvent
│   │   │   ├── usage.ts               # Usage 타입
│   │   │   ├── filesystem.ts          # FileSystem, Git 타입
│   │   │   ├── local-session.ts       # LocalSession 타입
│   │   │   ├── mcp.ts                 # MCP 서버 타입
│   │   │   ├── tag.ts                 # 태그 타입
│   │   │   ├── settings.ts            # 설정 타입
│   │   │   ├── notification.ts        # 알림 타입
│   │   │   ├── analytics.ts           # 분석 타입
│   │   │   ├── workspace.ts           # 워크스페이스 타입
│   │   │   ├── team.ts                # 팀 타입
│   │   │   ├── ws-events.ts           # WebSocket 이벤트 타입
│   │   │   └── index.ts              # barrel export
│   │   ├── store/                     # Zustand 스토어
│   │   ├── routes/                    # TanStack Router (파일 기반)
│   │   │   ├── __root.tsx             # 루트 레이아웃
│   │   │   ├── index.tsx              # 홈 (EmptyState)
│   │   │   └── session/
│   │   │       ├── $sessionId.tsx     # 세션 작업 공간
│   │   │       └── new.tsx            # 새 세션 생성
│   │   ├── components/ui/             # shadcn/ui + 공통 컴포넌트
│   │   ├── features/
│   │   │   ├── session/               # 세션 관리 (Sidebar, Settings, Import)
│   │   │   ├── chat/                  # 채팅 (ChatPanel, MessageBubble, Input, Permission)
│   │   │   ├── workflow/              # 워크플로우 (ProgressBar, PhaseCard, Artifact)
│   │   │   ├── files/                 # 파일 (FilePanel, FileViewer, DiffViewer)
│   │   │   ├── directory/             # 디렉토리 (Browser, Picker, Git, Worktree)
│   │   │   ├── usage/                 # 사용량 (UsageFooter)
│   │   │   ├── git-monitor/           # Git 상태 모니터링 (커밋, PR, Rebase)
│   │   │   ├── mcp/                   # MCP 서버 관리 (설정, 연결)
│   │   │   ├── settings/              # 글로벌 설정
│   │   │   ├── notification/          # 알림 시스템 (사운드, 설정)
│   │   │   ├── command-palette/       # 명령 팔레트 (Ctrl+K)
│   │   │   ├── analytics/             # 분석 대시보드
│   │   │   ├── dashboard/             # 대시보드 뷰 (카드 그리드 + Git Monitor)
│   │   │   ├── history/               # 히스토리 뷰
│   │   │   ├── layout/                # 레이아웃 (Split View 등)
│   │   │   ├── workspace/             # 워크스페이스 관리
│   │   │   ├── team/                  # 팀 채팅
│   │   │   └── tags/                  # 태그 관리
│   │   └── lib/api/                   # API 클라이언트
│   ├── design-system/                 # 디자인 토큰 + ESLint + Tailwind 플러그인
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── docker-compose.yml
├── CLAUDE.md                          # 개발 가이드
└── README.md
```

## API 엔드포인트

### Sessions

| 메서드   | 경로                            | 설명              |
| -------- | ------------------------------- | ----------------- |
| `POST`   | `/api/v1/sessions/`             | 세션 생성         |
| `GET`    | `/api/v1/sessions/`             | 세션 목록         |
| `GET`    | `/api/v1/sessions/{id}`         | 세션 상세         |
| `PATCH`  | `/api/v1/sessions/{id}`         | 세션 설정 수정    |
| `DELETE` | `/api/v1/sessions/{id}`         | 세션 삭제         |
| `GET`    | `/api/v1/sessions/{id}/history` | 메시지 기록       |
| `GET`    | `/api/v1/sessions/{id}/files`   | 파일 변경 목록    |
| `POST`   | `/api/v1/sessions/{id}/stop`    | 세션 중지         |
| `GET`    | `/api/v1/sessions/{id}/export`  | Markdown 내보내기 |

### Files

| 메서드 | 경로                                        | 설명          |
| ------ | ------------------------------------------- | ------------- |
| `GET`  | `/api/v1/sessions/{id}/file-content/{path}` | 파일 내용     |
| `GET`  | `/api/v1/sessions/{id}/file-diff/{path}`    | Git diff      |
| `POST` | `/api/v1/sessions/{id}/upload`              | 이미지 업로드 |

### Filesystem

| 메서드 | 경로                   | 설명          |
| ------ | ---------------------- | ------------- |
| `GET`  | `/api/v1/fs/list`      | 디렉토리 목록 |
| `GET`  | `/api/v1/fs/git-info`  | Git 정보      |
| `GET`  | `/api/v1/fs/worktrees` | 워크트리 목록 |
| `POST` | `/api/v1/fs/worktrees` | 워크트리 생성 |
| `GET`  | `/api/v1/fs/skills`    | Skills 목록   |

### Others

| 메서드 | 경로                            | 설명             |
| ------ | ------------------------------- | ---------------- |
| `GET`  | `/api/v1/health`                | 헬스체크         |
| `GET`  | `/api/v1/local-sessions/`       | 로컬 세션 스캔   |
| `POST` | `/api/v1/local-sessions/import` | 로컬 세션 import |
| `POST` | `/api/permissions/{id}/request` | Permission 요청  |
| `GET`  | `/api/v1/usage/`                | 사용량 조회      |
| `WS`   | `/ws/{session_id}`              | 실시간 스트리밍  |

### Settings

| 메서드  | 경로                | 설명             |
| ------- | ------------------- | ---------------- |
| `GET`   | `/api/v1/settings/` | 글로벌 설정 조회 |
| `PATCH` | `/api/v1/settings/` | 글로벌 설정 수정 |

### MCP

| 메서드   | 경로                         | 설명                     |
| -------- | ---------------------------- | ------------------------ |
| `GET`    | `/api/v1/mcp/servers`        | MCP 서버 목록            |
| `POST`   | `/api/v1/mcp/servers`        | MCP 서버 추가            |
| `PATCH`  | `/api/v1/mcp/servers/{id}`   | MCP 서버 수정            |
| `DELETE` | `/api/v1/mcp/servers/{id}`   | MCP 서버 삭제            |
| `GET`    | `/api/v1/mcp/system-servers` | 시스템 MCP 서버 조회     |
| `POST`   | `/api/v1/mcp/import-system`  | 시스템 MCP 서버 가져오기 |

### Workflow Definitions

| 메서드   | 경로                                            | 설명                     |
| -------- | ----------------------------------------------- | ------------------------ |
| `GET`    | `/api/v1/workflow-definitions/`                 | 워크플로우 정의 목록     |
| `POST`   | `/api/v1/workflow-definitions/`                 | 워크플로우 정의 생성     |
| `POST`   | `/api/v1/workflow-definitions/import`           | 워크플로우 정의 가져오기 |
| `GET`    | `/api/v1/workflow-definitions/{id}`             | 워크플로우 정의 상세     |
| `PATCH`  | `/api/v1/workflow-definitions/{id}`             | 워크플로우 정의 수정     |
| `DELETE` | `/api/v1/workflow-definitions/{id}`             | 워크플로우 정의 삭제     |
| `POST`   | `/api/v1/workflow-definitions/{id}/set-default` | 기본 정의 설정           |
| `GET`    | `/api/v1/workflow-definitions/{id}/export`      | 워크플로우 정의 내보내기 |

### Tags

| 메서드   | 경로                | 설명      |
| -------- | ------------------- | --------- |
| `GET`    | `/api/v1/tags/`     | 태그 목록 |
| `POST`   | `/api/v1/tags/`     | 태그 생성 |
| `PATCH`  | `/api/v1/tags/{id}` | 태그 수정 |
| `DELETE` | `/api/v1/tags/{id}` | 태그 삭제 |

### Analytics

| 메서드 | 경로                        | 설명      |
| ------ | --------------------------- | --------- |
| `GET`  | `/api/v1/analytics/summary` | 분석 요약 |

### Workflow

| 메서드 | 경로                                                                 | 설명                 |
| ------ | -------------------------------------------------------------------- | -------------------- |
| `POST` | `/api/v1/sessions/{id}/workflow/start`                               | 워크플로우 시작      |
| `GET`  | `/api/v1/sessions/{id}/workflow/status`                              | 워크플로우 상태 조회 |
| `GET`  | `/api/v1/sessions/{id}/workflow/artifacts`                           | 아티팩트 목록        |
| `GET`  | `/api/v1/sessions/{id}/workflow/artifacts/{artifact_id}`             | 아티팩트 상세        |
| `PUT`  | `/api/v1/sessions/{id}/workflow/artifacts/{artifact_id}`             | 아티팩트 수정        |
| `POST` | `/api/v1/sessions/{id}/workflow/artifacts/{artifact_id}/annotations` | 인라인 주석 추가     |
| `PUT`  | `/api/v1/sessions/{id}/workflow/annotations/{annotation_id}`         | 주석 수정            |
| `POST` | `/api/v1/sessions/{id}/workflow/approve`                             | 현재 단계 승인       |
| `POST` | `/api/v1/sessions/{id}/workflow/request-revision`                    | 수정 요청            |

### Workspaces

| 메서드   | 경로                           | 설명                               |
| -------- | ------------------------------ | ---------------------------------- |
| `GET`    | `/api/v1/workspaces/`          | 워크스페이스 목록                  |
| `POST`   | `/api/v1/workspaces/`          | 워크스페이스 생성 (Git clone 시작) |
| `GET`    | `/api/v1/workspaces/{id}`      | 워크스페이스 상세                  |
| `PATCH`  | `/api/v1/workspaces/{id}`      | 워크스페이스 수정                  |
| `DELETE` | `/api/v1/workspaces/{id}`      | 워크스페이스 삭제                  |
| `POST`   | `/api/v1/workspaces/{id}/sync` | 워크스페이스 동기화 (Pull/Push)    |

### Teams

| 메서드   | 경로                          | 설명           |
| -------- | ----------------------------- | -------------- |
| `POST`   | `/api/v1/teams/`              | 팀 생성        |
| `GET`    | `/api/v1/teams/`              | 팀 목록        |
| `GET`    | `/api/v1/teams/{id}`          | 팀 상세        |
| `DELETE` | `/api/v1/teams/{id}`          | 팀 삭제        |
| `POST`   | `/api/v1/teams/{id}/message`  | 팀 메시지 전송 |
| `GET`    | `/api/v1/teams/{id}/messages` | 팀 메시지 목록 |
| `POST`   | `/api/v1/teams/{id}/stop`     | 팀 중지        |

## 데이터베이스 스키마

PostgreSQL + SQLAlchemy ORM, 마이그레이션: Alembic:

| 테이블                 | 설명                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `sessions`             | 세션 메타데이터 (id, status, work_dir, workspace_id, workflow_enabled/phase/phase_status, model, max_turns 등) |
| `messages`             | 대화 기록 (role, content, cost, duration_ms, input_tokens, output_tokens, model)                               |
| `file_changes`         | 파일 변경 기록 (tool, file, timestamp)                                                                         |
| `events`               | WebSocket 이벤트 버퍼 (seq, event_type, payload -- JSONB) -- 재연결 복구용                                     |
| `workspaces`           | 워크스페이스 (repo_url, branch, local_path, status, disk_usage_mb)                                             |
| `global_settings`      | 글로벌 기본 설정 (default_workspace_id, 모든 세션 옵션의 기본값)                                               |
| `mcp_servers`          | MCP 서버 설정 (name, transport_type, command, url, env)                                                        |
| `tags`                 | 태그 정의 (name, color)                                                                                        |
| `session_tags`         | 세션-태그 다대다 연결                                                                                          |
| `workflow_definitions` | 워크플로우 정의 (name, description, steps, is_default, is_builtin, sort_order)                                 |
| `token_snapshots`      | 토큰 사용량 스냅샷 (session_id, input_tokens, output_tokens, model, timestamp)                                 |
| `session_artifacts`    | 워크플로우 아티팩트 (phase, title, content, status)                                                            |
| `artifact_annotations` | 아티팩트 인라인 주석 (line_start/end, content, type, status)                                                   |
| `teams`                | 팀 (name, workspace_id, goal, status)                                                                          |
| `team_messages`        | 팀 대화 기록 (team_id, role, content)                                                                          |
| `team_tasks`           | 팀 작업 (team_id, session_id, description, status)                                                             |

## 동작 방식

1. FastAPI 백엔드가 Claude Code CLI를 subprocess로 실행 (`--output-format stream-json`)
2. JSON 스트림을 파싱하여 메시지/도구 사용/파일 변경 이벤트를 추출
3. WebSocket으로 프론트엔드에 실시간 브로드캐스트
4. 모든 대화 기록과 이벤트는 PostgreSQL에 영속 저장 (SQLAlchemy ORM + Alembic 마이그레이션)
5. 프론트엔드 재연결 시 `last_seq` 파라미터로 놓친 이벤트 복구

## 접속 정보

| 서비스          | URL                       |
| --------------- | ------------------------- |
| Frontend (개발) | http://localhost:8100     |
| Backend API     | http://localhost:8101/api |
| WebSocket       | ws://localhost:8101/ws    |
