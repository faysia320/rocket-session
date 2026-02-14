# Claude Code Dashboard (rocket-session)

브라우저에서 Claude Code CLI 세션을 관리하고 모니터링하는 웹 대시보드입니다.

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
└─────────────────────────────────────────────────────────────┘
                    │ subprocess (asyncio)
┌─────────────────────────────────────────────────────────────┐
│              Claude Code CLI                                 │
│  --output-format stream-json                                 │
│  --continue / --resume                                       │
└─────────────────────────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────────────────────────┐
│              SQLite (aiosqlite)                              │
│  sessions · messages · file_changes · events                 │
└─────────────────────────────────────────────────────────────┘
```

## 주요 기능

- **세션 관리** — 생성, 재개, 삭제, 설정 변경, Markdown 내보내기
- **실시간 스트리밍** — WebSocket을 통한 Claude 응답 실시간 표시
- **파일 변경 추적** — Claude가 수정한 파일 목록 + Git diff 뷰어
- **Plan Mode** — 읽기 전용 도구만 허용하는 계획 모드, 승인 후 실행
- **Permission Mode** — 도구 사용 시 사용자 승인 요청 (MCP 서버 연계)
- **이미지 업로드** — 프롬프트에 이미지 첨부 가능
- **사용량 추적** — 5시간 블록 + 주간 사용량 (ccusage 연동)
- **로컬 세션 가져오기** — `~/.claude/projects/` 기존 세션 import
- **디렉토리 탐색** — 파일시스템 브라우저 + Git 정보 + 워크트리 관리
- **슬래시 명령어** — `/` 입력 시 커스텀 스킬 자동완성
- **WebSocket 재연결** — 네트워크 끊김 후 놓친 이벤트 자동 복구
- **활동 상태바** — 실행 중인 도구, 비용, 시간 실시간 표시

## 기술 스택

### Frontend

| 항목 | 기술 |
|------|------|
| 언어 | TypeScript 5.x |
| 프레임워크 | React 18.3 |
| 빌드 도구 | Vite 6.x |
| 라우팅 | TanStack Router |
| 서버 상태 | TanStack Query |
| 클라이언트 상태 | Zustand 5.x |
| UI 컴포넌트 | shadcn/ui + Radix UI |
| 스타일링 | Tailwind CSS 3.4 + Deep Space 테마 |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| 패키지 매니저 | **pnpm** |

### Backend

| 항목 | 기술 |
|------|------|
| 언어 | Python 3.10+ |
| 프레임워크 | FastAPI 0.115 |
| 데이터베이스 | SQLite (aiosqlite) |
| WebSocket | websockets 14.1 |
| 설정 관리 | Pydantic Settings 2.x |
| 테스트 | pytest + pytest-asyncio |
| 패키지 매니저 | **uv** |

## 사전 요구사항

- Python 3.10+
- [uv](https://docs.astral.sh/uv/) (Python 패키지 매니저)
- Node.js 18+
- [pnpm](https://pnpm.io/) (Node 패키지 매니저)
- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)
- Claude Pro/Max 구독 또는 API key

## 빠른 시작

### 로컬 실행

```bash
# Backend
cd backend
cp .env.example .env   # CLAUDE_WORK_DIR 수정
uv sync
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
# CLAUDE_AUTH_DIR, HOST_PROJECTS_DIR 수정

docker compose up -d
```

http://localhost:8100 에서 접속

## 환경 변수

`backend/.env` 파일:

```env
CLAUDE_WORK_DIR=/path/to/your/project    # Claude 작업 디렉토리
CLAUDE_ALLOWED_TOOLS=Read,Write,Edit,Bash # 허용 도구
CLAUDE_PLAN=Max                           # 플랜 (Max/Pro)
BACKEND_HOST=0.0.0.0                      # 서버 호스트
BACKEND_PORT=8101                         # 서버 포트
DATABASE_PATH=data/sessions.db            # DB 경로
```

## 프로젝트 구조

```
rocket-session/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI 앱 팩토리 + CORS + 라이프사이클
│   │   ├── core/
│   │   │   ├── config.py              # Pydantic BaseSettings
│   │   │   └── database.py            # SQLite 비동기 DB + 스키마 + 마이그레이션
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
│   │   │           └── ws.py          # WebSocket 엔드포인트
│   │   ├── schemas/                   # Pydantic 스키마
│   │   │   ├── session.py
│   │   │   ├── usage.py
│   │   │   ├── filesystem.py
│   │   │   └── local_session.py
│   │   ├── services/
│   │   │   ├── session_manager.py     # 세션 생명주기 관리
│   │   │   ├── claude_runner.py       # Claude CLI subprocess + JSON 스트림 파싱
│   │   │   ├── websocket_manager.py   # WS 연결 관리 + 이벤트 버퍼링
│   │   │   ├── usage_service.py       # ccusage CLI 사용량 조회
│   │   │   ├── filesystem_service.py  # 파일시스템 + Git 워크트리
│   │   │   ├── local_session_scanner.py # 로컬 세션 스캐너
│   │   │   └── permission_mcp_server.py # Permission MCP 서버
│   │   └── models/session.py          # 도메인 모델
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
│   │   ├── types/                     # 타입 정의
│   │   │   ├── session.ts             # SessionInfo, SessionMode
│   │   │   ├── message.ts             # Message, FileChange, WebSocketEvent
│   │   │   ├── usage.ts              # Usage 타입
│   │   │   ├── filesystem.ts         # FileSystem, Git 타입
│   │   │   └── local-session.ts      # LocalSession 타입
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
│   │   │   ├── chat/                  # 채팅 (ChatPanel, MessageBubble, Input, Permission, Plan)
│   │   │   ├── files/                 # 파일 (FilePanel, FileViewer, DiffViewer)
│   │   │   ├── directory/             # 디렉토리 (Browser, Picker, Git, Worktree)
│   │   │   └── usage/                 # 사용량 (UsageFooter)
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
| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/v1/sessions/` | 세션 생성 |
| `GET` | `/api/v1/sessions/` | 세션 목록 |
| `GET` | `/api/v1/sessions/{id}` | 세션 상세 |
| `PATCH` | `/api/v1/sessions/{id}` | 세션 설정 수정 |
| `DELETE` | `/api/v1/sessions/{id}` | 세션 삭제 |
| `GET` | `/api/v1/sessions/{id}/history` | 메시지 기록 |
| `GET` | `/api/v1/sessions/{id}/files` | 파일 변경 목록 |
| `POST` | `/api/v1/sessions/{id}/stop` | 세션 중지 |
| `GET` | `/api/v1/sessions/{id}/export` | Markdown 내보내기 |

### Files
| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/v1/sessions/{id}/file-content/{path}` | 파일 내용 |
| `GET` | `/api/v1/sessions/{id}/file-diff/{path}` | Git diff |
| `POST` | `/api/v1/sessions/{id}/upload` | 이미지 업로드 |

### Filesystem
| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/v1/fs/list` | 디렉토리 목록 |
| `GET` | `/api/v1/fs/git-info` | Git 정보 |
| `GET` | `/api/v1/fs/worktrees` | 워크트리 목록 |
| `POST` | `/api/v1/fs/worktrees` | 워크트리 생성 |
| `GET` | `/api/v1/fs/skills` | Skills 목록 |

### Others
| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/v1/health` | 헬스체크 |
| `GET` | `/api/v1/local-sessions/` | 로컬 세션 스캔 |
| `POST` | `/api/v1/local-sessions/import` | 로컬 세션 import |
| `POST` | `/api/permissions/{id}/request` | Permission 요청 |
| `GET` | `/api/v1/usage/` | 사용량 조회 |
| `WS` | `/ws/{session_id}` | 실시간 스트리밍 |

## 데이터베이스 스키마

SQLite (`backend/data/sessions.db`):

| 테이블 | 설명 |
|--------|------|
| `sessions` | 세션 메타데이터 (id, status, work_dir, mode, permission_mode, name 등) |
| `messages` | 대화 기록 (role, content, cost, duration_ms) |
| `file_changes` | 파일 변경 기록 (tool, file, timestamp) |
| `events` | WebSocket 이벤트 버퍼 (seq, event_type, payload) — 재연결 복구용 |

## 동작 방식

1. FastAPI 백엔드가 Claude Code CLI를 subprocess로 실행 (`--output-format stream-json`)
2. JSON 스트림을 파싱하여 메시지/도구 사용/파일 변경 이벤트를 추출
3. WebSocket으로 프론트엔드에 실시간 브로드캐스트
4. 모든 대화 기록과 이벤트는 SQLite에 영속 저장
5. 프론트엔드 재연결 시 `last_seq` 파라미터로 놓친 이벤트 복구

## 접속 정보

| 서비스 | URL |
|--------|-----|
| Frontend (개발) | http://localhost:8100 |
| Backend API | http://localhost:8101/api |
| WebSocket | ws://localhost:8101/ws |
