# Claude Code Dashboard (rocket-session)

> **최종 수정일**: 2026-02-14

## 중요 규칙

### 응답 언어

- **필수**: 모든 응답, 설명, 코드 주석은 **한국어**로 작성합니다.
- 변수명/함수명/타입명: 영어 (camelCase, snake_case, PascalCase)
- 커밋 메시지: 한국어
- 에러 메시지 (사용자 노출): 한국어

### Problem 1-Pager (코딩 전 필수 검토)

복잡하거나 명확하지 않은 문제는 코딩 시작 전 아래 항목을 포함한 **Problem 1-Pager**를 작성합니다.
불분명한 항목이 있다면 인터뷰를 요청하여 내용을 명확히 합니다.

| 항목                  | 설명                                          |
| --------------------- | --------------------------------------------- |
| **배경(Background)**  | 변경이 필요한 맥락과 동기                     |
| **문제(Problem)**     | 우리가 해결하려는 이슈는 무엇인가?            |
| **목표(Goal)**        | 성공의 기준(성공한 상태)은 무엇인가?          |
| **비목표(Non-goals)** | 명확히 범위 밖(스코프 아웃)인 것은 무엇인가?  |
| **제약(Constraints)** | 반드시 준수해야 할 기술적/비즈니스적 제약사항 |

### 작업 경계 3단계 시스템

작업 수행 시 아래 3단계 경계를 준수합니다.

| 단계 | 규칙 |
|------|------|
| ✅ **항상** | 테스트 실행 후 커밋, 타입 검사 통과 확인, 기존 코드 스타일 준수, 변경 파일 린트 실행 |
| ⚠️ **먼저 확인** | 새 의존성 추가, API 인터페이스 변경, WebSocket 메시지 포맷 변경, 아키텍처 변경, 파일 삭제 |
| 🚫 **절대 금지** | .env 파일 커밋, node_modules 수정, package-lock.json 생성 |

### 모듈식 작업 분할 원칙

**"지시사항의 저주"** - 지시사항이 많을수록 정확도가 떨어집니다.

- **한 번에 1-3개 작업**에 집중
- 대규모 기능은 독립적인 단계로 분해
- 각 단계 완료 후 검증 → 다음 단계 진행

### 자체 검증 체크포인트

복잡한 작업 완료 후, 다음을 검증합니다:

- [ ] 요구사항 목록의 각 항목이 충족되었는가?
- [ ] 테스트가 통과하는가? (`uv run pytest`)
- [ ] 빌드가 통과하는가? (`pnpm build`)
- [ ] 기존 기능이 깨지지 않았는가?
- [ ] 누락된 엣지 케이스가 있는가?

> **주의**: "완료", "수정됨", "구현됨" 등의 표현을 사용하기 전에 반드시 검증 명령어를 실행하고 결과를 확인합니다.

---

## 1. 프로젝트 개요

이 프로젝트는 **브라우저에서 Claude Code CLI 세션을 관리하고 모니터링하는 웹 대시보드**입니다.

- **목적**: Claude Code CLI를 웹 브라우저에서 제어하고, 실시간 스트리밍 응답을 확인
- **주요 기능**:
  - 세션 생성/관리/내보내기, 로컬 세션 import
  - 실시간 메시지 스트리밍 (WebSocket + 재연결 이벤트 복구)
  - 파일 변경 추적 + Git diff 뷰어
  - Plan Mode (읽기 전용 계획 → 승인 후 실행)
  - Permission Mode (도구 사용 시 사용자 승인 요청, MCP 서버 연계)
  - 이미지 업로드 + 슬래시 명령어 자동완성
  - 사용량 추적 (5시간 블록 + 주간, ccusage 연동)
  - 디렉토리 탐색 + Git 워크트리 관리
- **동작 방식**: FastAPI 백엔드가 Claude Code CLI를 subprocess로 실행하고, `--output-format stream-json`으로 출력을 파싱하여 WebSocket으로 프론트엔드에 전달. 모든 데이터는 SQLite에 영속 저장

---

## 2. 기술 스택

### Frontend

| 항목           | 기술                              | 버전    |
| -------------- | --------------------------------- | ------- |
| 언어           | TypeScript (TSX)                  | 5.x     |
| 프레임워크     | React                             | 18.3.x  |
| 빌드 도구      | Vite                              | 6.x     |
| 라우팅         | TanStack Router (파일 기반)       | 1.x     |
| 서버 상태      | TanStack Query                    | 5.x     |
| 클라이언트 상태 | Zustand                          | 5.x     |
| UI 컴포넌트    | shadcn/ui + Radix UI              | -       |
| 스타일링       | Tailwind CSS + CSS 변수 (HSL)     | 3.4.x   |
| Markdown 렌더링 | react-markdown + remark-gfm      | 9.x     |
| 아이콘         | lucide-react                      | -       |
| 토스트         | sonner                            | -       |
| 패키지 매니저  | **pnpm** (필수)                   | -       |

### Backend

| 항목            | 기술              | 버전     |
| --------------- | ----------------- | -------- |
| 언어            | Python            | 3.10+    |
| 프레임워크      | FastAPI           | 0.115.x  |
| 데이터베이스    | SQLite (aiosqlite)| 0.22+    |
| WebSocket       | websockets        | 14.1     |
| 설정 관리       | Pydantic Settings | 2.x      |
| 파일 업로드     | python-multipart  | 0.0.22+  |
| 테스트          | pytest + pytest-asyncio | 7.x+  |
| 패키지 매니저   | **uv**            | -        |

### 외부 의존성

- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)
- [ccusage](https://github.com/ryoppippi/ccusage) (사용량 조회, `npx ccusage`)
- Active Claude Pro/Max 구독 또는 API key

---

## 3. 프로젝트 구조

```
rocket-session/
├── backend/                          # FastAPI 백엔드
│   ├── app/
│   │   ├── main.py                   # FastAPI 앱 팩토리 + CORS + 라이프사이클
│   │   ├── core/
│   │   │   ├── config.py             # Pydantic BaseSettings (환경 설정)
│   │   │   └── database.py           # SQLite 비동기 DB + 스키마 + 마이그레이션
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
│   │   │           └── ws.py         # WebSocket 엔드포인트
│   │   ├── models/
│   │   │   └── session.py            # 세션 도메인 모델
│   │   ├── schemas/
│   │   │   ├── session.py            # 세션 Request/Response 스키마
│   │   │   ├── usage.py              # 사용량 스키마
│   │   │   ├── filesystem.py         # 파일시스템 + Git 스키마
│   │   │   └── local_session.py      # 로컬 세션 스키마
│   │   └── services/
│   │       ├── session_manager.py    # 세션 생명주기 관리
│   │       ├── claude_runner.py      # Claude CLI subprocess + JSON 스트림 파싱
│   │       ├── websocket_manager.py  # WS 연결 관리 + 이벤트 버퍼링
│   │       ├── usage_service.py      # ccusage CLI 사용량 조회
│   │       ├── filesystem_service.py # 파일시스템 + Git 워크트리
│   │       ├── local_session_scanner.py # 로컬 세션 스캐너
│   │       └── permission_mcp_server.py # Permission MCP 서버 (stdio)
│   ├── data/                         # SQLite DB 파일 (sessions.db)
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
│   │   │   ├── session.ts            # SessionInfo, SessionStatus, SessionMode
│   │   │   ├── message.ts            # Message, FileChange, WebSocketEvent
│   │   │   ├── usage.ts              # Usage 타입
│   │   │   ├── filesystem.ts         # FileSystem, Git 타입
│   │   │   ├── local-session.ts      # LocalSession 타입
│   │   │   └── index.ts              # barrel export
│   │   ├── store/
│   │   │   ├── useSessionStore.ts    # Zustand - 활성 세션 ID, UI 상태
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
│   │   │   │   │                     # ActivityStatusBar, ModeIndicator, PermissionDialog
│   │   │   │   │                     # PlanReviewDialog, PlanApprovalButton, SlashCommandPopup
│   │   │   │   ├── hooks/            # useClaudeSocket, useSlashCommands
│   │   │   │   └── constants/        # slashCommands.ts
│   │   │   ├── files/                # 파일 변경 추적
│   │   │   │   └── components/       # FilePanel, FileViewer, DiffViewer
│   │   │   ├── directory/            # 디렉토리 탐색
│   │   │   │   ├── components/       # DirectoryBrowser, DirectoryPicker, GitInfoCard, WorktreePanel
│   │   │   │   └── hooks/            # useDirectoryBrowser, useGitInfo, useWorktrees
│   │   │   └── usage/                # 사용량 표시
│   │   │       ├── components/       # UsageFooter
│   │   │       └── hooks/            # useUsage, usageKeys
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
├── docker-compose.yml                # Docker Compose 구성
├── CLAUDE.md                         # 개발 가이드 (이 파일)
└── README.md
```

---

## 4. 아키텍처

### WebSocket + Subprocess + SQLite 기반 아키텍처

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
                    │
┌─────────────────────────────────────────────────────────────┐
│                  Service Layer                               │
│  SessionManager / WebSocketManager / ClaudeRunner            │
│  UsageService / FilesystemService / LocalSessionScanner      │
│  PermissionMCPServer                                         │
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

### 데이터 흐름

```
사용자 입력 → ChatPanel → WebSocket → FastAPI ws 엔드포인트
                                            ↓
                                     ClaudeRunner (subprocess 실행)
                                            ↓
                                     JSON 스트림 파싱
                                            ↓
                                     SQLite 저장 (messages, file_changes, events)
                                            ↓
                                     WebSocketManager (브로드캐스트 + 이벤트 버퍼링)
                                            ↓
                                     ChatPanel (메시지 렌더링)
```

### 핵심 서비스

| 서비스 | 역할 | 상태 저장 |
|--------|------|----------|
| `SessionManager` | 세션 생명주기 (CRUD, 상태 전환) | SQLite + 프로세스 핸들(인메모리) |
| `ClaudeRunner` | Claude CLI subprocess 실행 + 스트리밍 JSON 파싱 | 프로세스 핸들 |
| `WebSocketManager` | WebSocket 연결 관리 + 이벤트 브로드캐스트 + 버퍼링 | 연결 레지스트리 + SQLite (events) |
| `UsageService` | ccusage CLI 호출 + 사용량 캐싱 | 60초 TTL 인메모리 캐시 |
| `FilesystemService` | 디렉토리 탐색, Git 정보, 워크트리, Skills | 없음 (stateless) |
| `LocalSessionScanner` | `~/.claude/projects/` JSONL 세션 스캔/import | 없음 |
| `PermissionMCPServer` | 도구 사용 승인 요청/응답 MCP 서버 (stdio) | asyncio.Event 기반 대기 |

> **참고**: 세션/메시지/파일 변경/이벤트는 SQLite에 영속 저장됩니다. 프로세스 핸들만 인메모리로 관리되어 서버 재시작 시 실행 중인 세션의 프로세스 연결은 끊어집니다.

---

## 5. 개발 규칙

### 5.1 패키지 관리자

#### Frontend: pnpm (필수)

```bash
pnpm install              # 의존성 설치
pnpm add <패키지>          # 패키지 추가
pnpm add -D <패키지>       # devDependency 추가
pnpm remove <패키지>       # 패키지 삭제
```

> **주의**: `npm`, `yarn` 사용 금지. `package-lock.json` 생성 시 삭제하세요.

#### Backend: uv

```bash
uv sync                   # 의존성 설치
uv add <패키지>            # 패키지 추가
uv run <명령어>            # 가상환경에서 실행
```

### 5.2 파일 명명 규칙

| 위치              | 규칙           | 예시                      |
| ----------------- | -------------- | ------------------------- |
| Frontend 컴포넌트 | PascalCase.tsx | `ChatPanel.tsx`           |
| Frontend 훅       | camelCase.ts   | `useClaudeSocket.ts`      |
| Frontend 유틸     | camelCase.ts   | `env.ts`                  |
| Frontend 타입     | camelCase.ts   | `session.ts`              |
| Frontend 라우트   | 파일 기반      | `routes/session/$sessionId.tsx` |
| Backend 전체      | snake_case.py  | `session_manager.py`      |

### 5.3 설계 원칙

| 원칙    | 적용                                              |
| ------- | ------------------------------------------------- |
| **SRP** | 레이어별 단일 책임 (API → Service → Model)        |
| **DIP** | FastAPI Depends로 의존성 주입 (싱글턴 패턴)       |
| **관심사 분리** | Frontend: features 디렉토리별 기능 분리    |

---

## 6. Frontend 가이드라인

### 6.1 스타일링 방식: Tailwind CSS + shadcn/ui

이 프로젝트는 **Tailwind CSS + shadcn/ui**를 사용합니다. `cn()` 유틸리티로 클래스를 조합합니다.

```tsx
import { cn } from '@/lib/utils';

// ✅ 올바른 사용: Tailwind 클래스 + cn()
<div className={cn('flex bg-background text-foreground rounded-md p-4', isActive && 'bg-muted')}>

// ✅ shadcn/ui 컴포넌트 사용
import { Button } from '@/components/ui/button';
<Button variant="default" size="sm">Create</Button>

// ❌ 잘못된 사용: 인라인 스타일
<div style={{ background: '#0a0e17' }}>

// ❌ 잘못된 사용: 하드코딩 색상 Tailwind 클래스
<div className="bg-[#0a0e17]">
```

### 6.2 Deep Space 테마 (HSL CSS 변수)

프로젝트의 색상 시스템은 `frontend/src/index.css`에 HSL 포맷으로 정의되어 있습니다:

| 용도 | Tailwind 클래스 | CSS 변수 (HSL) |
|------|----------------|----------------|
| 배경 (주) | `bg-background` | `--background: 220 50% 5%` |
| 전경 (주) | `text-foreground` | `--foreground: 215 25% 90%` |
| 카드 배경 | `bg-card` | `--card: 220 37% 7%` |
| 강조 (amber) | `bg-primary` / `text-primary` | `--primary: 38 92% 50%` |
| 보조 | `bg-secondary` | `--secondary: 217 33% 17%` |
| 뮤트 | `bg-muted` / `text-muted-foreground` | `--muted: 217 33% 17%` |
| 입력 | `bg-input` | `--input: 220 45% 8%` |
| 테두리 | `border-border` | `--border: 217 33% 17%` |
| 파괴적 | `text-destructive` | `--destructive: 0 84% 60%` |
| 성공 | `text-success` | `--success: 142 71% 45%` |
| 정보 | `text-info` | `--info: 217 91% 60%` |
| 경고 | `text-warning` | `--warning: 38 92% 50%` |

### 6.3 Path Aliases

```typescript
// ✅ path alias 사용 (tsconfig.app.json에 정의)
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SessionInfo } from '@/types';
import { useSessionStore } from '@/store';
```

### 6.4 Feature 기반 구조

새 기능 추가 시 `src/features/[feature-name]/` 디렉토리 생성:

```
src/features/my-feature/
├── components/           # 기능 전용 컴포넌트
│   └── MyComponent.tsx
├── hooks/                # 기능 전용 훅
│   └── useMyFeature.ts
└── pages/                # (필요 시) 페이지 컴포넌트
```

### 6.5 상태 관리

3가지 상태 관리 전략:

| 종류 | 도구 | 용도 |
|------|------|------|
| 서버 상태 | TanStack Query | API 데이터 (세션 목록, 세션 상세) |
| 클라이언트 상태 | Zustand | UI 상태 (활성 세션 ID, 패널 토글) |
| 로컬 상태 | React useState | 컴포넌트 내부 상태 (입력값, 폼 상태) |

```typescript
// ✅ TanStack Query - 서버 상태
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionKeys } from '@/features/session/hooks/sessionKeys';

const { data: sessions } = useQuery({
  queryKey: sessionKeys.list(),
  queryFn: () => sessionsApi.list(),
});

// ✅ Zustand - 클라이언트 상태
import { useSessionStore } from '@/store';

const activeSessionId = useSessionStore((s) => s.activeSessionId);
```

### 6.6 라우팅 (TanStack Router)

파일 기반 라우팅을 사용합니다:

| URL | 라우트 파일 | 설명 |
|-----|------------|------|
| `/` | `routes/index.tsx` | 홈 (EmptyState) |
| `/session/new` | `routes/session/new.tsx` | 새 세션 생성 |
| `/session/:id` | `routes/session/$sessionId.tsx` | 세션 작업 공간 |

```typescript
// 세션 선택 시 네비게이션
import { useNavigate } from '@tanstack/react-router';
const navigate = useNavigate();
navigate({ to: '/session/$sessionId', params: { sessionId } });
```

### 6.7 WebSocket 통신

실시간 메시지 스트리밍은 `useClaudeSocket` 훅으로 관리됩니다 (TanStack Query 대상 아님):

```typescript
// WebSocket 이벤트 타입
// - status: 세션 상태 변경
// - assistant: Claude 응답 텍스트 (스트리밍)
// - tool_use: Claude 도구 사용 (Read, Write, Edit, Bash 등)
// - tool_result: 도구 실행 결과
// - file_change: 파일 변경 감지
// - result: Claude 최종 응답 결과 (cost, duration_ms 포함)
// - permission_request: 도구 사용 승인 요청 (Permission Mode)
// - permission_response: 승인/거부 응답

// 재연결: last_seq 파라미터로 놓친 이벤트 자동 복구
// ws://localhost:8101/ws/{sessionId}?last_seq=42
```

### 6.8 shadcn/ui 컴포넌트 추가

```bash
npx shadcn@latest add <component-name>
```

설치 후 `@/components/ui/`에 생성됩니다. **임포트 경로 확인**: `src/lib/utils`가 아닌 `@/lib/utils`로 되어있는지 반드시 확인하세요.

### 6.9 디자인 시스템 가이드라인 참조

UI 컴포넌트 작성 시 아래 문서를 참조합니다:

| 문서 | 위치 | 내용 |
|------|------|------|
| **Design System Guidelines** | `frontend/design-system/GUIDELINES.md` | 크기, 간격, z-index 등 디자인 토큰 사용 가이드 |
| **CSS 변수 정의** | `frontend/design-system/css/variables.css` | spacing, typography, radius, shadow 토큰 |
| **글로벌 스타일** | `frontend/src/index.css` | Deep Space 테마 (HSL), 키프레임 애니메이션 |
| **Tailwind 설정** | `frontend/tailwind.config.js` | 테마 색상, 폰트, 반지름 매핑 |

### 6.10 조건부 렌더링

`&&` 연산자 대신 삼항 연산자를 사용합니다:

```tsx
// ❌ 잘못된 사용
{condition && <Component />}

// ✅ 올바른 사용
{condition ? <Component /> : null}
```

### 6.11 접근성 기본 규칙

- 아이콘 버튼에 `aria-label` 필수
- 클릭 가능한 요소는 `<button>` 또는 `<a>` 사용 (`div onClick` 금지)
- 로딩 텍스트에 유니코드 말줄임표 사용: `...` → `…`

---

## 7. Backend 가이드라인

### 7.1 의존성 주입 패턴

모든 서비스는 `app/api/dependencies.py`에서 싱글턴으로 관리됩니다.
앱 시작 시 `init_dependencies()`로 DB/서비스를 초기화하고, 종료 시 `shutdown_dependencies()`로 정리합니다:

```python
# 주요 의존성 (앱 시작 시 init_dependencies()로 초기화)
get_settings()           # @lru_cache, Pydantic Settings
get_database()           # Database (SQLite aiosqlite)
get_session_manager()    # SessionManager (DB 의존)
get_ws_manager()         # WebSocketManager
get_claude_runner()      # ClaudeRunner (Settings 의존)
get_filesystem_service() # FilesystemService (stateless)
get_local_scanner()      # LocalSessionScanner (DB 의존)
get_usage_service()      # UsageService (Settings 의존)
```

### 7.2 새 API 엔드포인트 추가 순서

1. **Schema** (`app/schemas/my_feature.py`) - Pydantic 모델
2. **Service** (`app/services/my_feature_service.py`) - 비즈니스 로직
3. **Endpoint** (`app/api/v1/endpoints/my_feature.py`) - API 라우터
4. **라우터 등록** (`app/api/v1/api.py`) - `include_router` 추가
5. **의존성** (`app/api/dependencies.py`) - DI 프로바이더 추가

### 7.3 환경 설정

`backend/.env` 파일로 관리 (Pydantic Settings):

```env
CLAUDE_WORK_DIR=/path/to/your/project    # Claude 작업 디렉토리
CLAUDE_ALLOWED_TOOLS=Read,Write,Edit,Bash # 허용 도구
CLAUDE_PLAN=Max                           # 플랜 (Max/Pro, 사용량 표시용)
BACKEND_HOST=0.0.0.0                      # 서버 호스트
BACKEND_PORT=8101                         # 서버 포트
DATABASE_PATH=data/sessions.db            # SQLite DB 경로
```

---

## 8. 테스트 가이드라인

### Backend 테스트 (pytest)

```bash
cd backend
uv run pytest                              # 전체 테스트
uv run pytest tests/ -v                    # 상세 출력
uv run pytest --cov=app                    # 커버리지 포함
```

### Frontend 빌드 검증

```bash
cd frontend
npx tsc -p tsconfig.app.json --noEmit      # TypeScript 타입 검사
pnpm build                                 # 프로덕션 빌드
```

---

## 9. 명령어 참조

### Backend

```bash
cd backend
uv sync                                    # 의존성 설치
uv run pytest                              # 테스트 실행
uv run pytest --cov=app                    # 커버리지 포함
uv run uvicorn app.main:app --host 0.0.0.0 --port 8101 --reload  # 개발 서버
uv run ruff format app/                    # 코드 포맷팅
uv run ruff check app/ --fix               # 린터
```

### Frontend

```bash
cd frontend
pnpm install                               # 의존성 설치
pnpm dev                                   # 개발 서버 (포트 8100)
pnpm build                                 # 프로덕션 빌드
pnpm preview                               # 빌드 미리보기
```

### 접속 정보

| 서비스           | URL                        |
| ---------------- | -------------------------- |
| Frontend (개발)  | http://localhost:8100      |
| Backend API      | http://localhost:8101/api  |
| WebSocket        | ws://localhost:8101/ws     |

---

## 10. 데이터베이스 스키마

SQLite (`backend/data/sessions.db`), 스키마 정의: `backend/app/core/database.py`

```sql
-- 세션 메타데이터
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    claude_session_id TEXT,        -- Claude CLI 세션 ID
    work_dir TEXT NOT NULL,        -- 작업 디렉토리
    status TEXT NOT NULL DEFAULT 'idle',  -- idle | running | error | stopped
    created_at TEXT NOT NULL,
    allowed_tools TEXT,            -- 허용 도구 (쉼표 구분)
    system_prompt TEXT,            -- 시스템 프롬프트
    timeout_seconds INTEGER,       -- 타임아웃
    mode TEXT NOT NULL DEFAULT 'normal',  -- normal | plan
    permission_mode INTEGER NOT NULL DEFAULT 0,  -- 0: 비활성, 1: 활성
    permission_required_tools TEXT, -- 승인 필요 도구 (JSON 배열)
    name TEXT                      -- 세션 이름 (첫 프롬프트 자동 설정)
);

-- 대화 기록
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,             -- user | assistant
    content TEXT NOT NULL,
    cost REAL,                     -- API 비용 (USD)
    duration_ms INTEGER,           -- 실행 시간
    timestamp TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- 파일 변경 기록
CREATE TABLE file_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    tool TEXT NOT NULL,             -- Write | Edit | Bash 등
    file TEXT NOT NULL,             -- 변경된 파일 경로
    timestamp TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- WebSocket 이벤트 버퍼 (재연결 복구용)
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    seq INTEGER NOT NULL,           -- 시퀀스 번호
    event_type TEXT NOT NULL,       -- 이벤트 타입
    payload TEXT NOT NULL,          -- JSON 페이로드
    timestamp TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
```

> **마이그레이션**: `database.py`의 `initialize()` 메서드에서 `ALTER TABLE`로 새 컬럼을 추가합니다. `duplicate column` 에러는 무시됩니다.

---

## 11. 새 기능 개발 체크리스트

### Backend 새 기능 추가

- [ ] `app/schemas/` - Pydantic 스키마 생성
- [ ] `app/services/` - Service 클래스 생성
- [ ] `app/api/v1/endpoints/` - API 엔드포인트 생성
- [ ] `app/api/v1/api.py` - 라우터 등록
- [ ] `app/api/dependencies.py` - DI 프로바이더 추가
- [ ] `tests/` - 테스트 코드 작성

### Frontend 새 기능 추가

- [ ] `src/types/` - 타입 정의 (필요 시)
- [ ] `src/features/[feature-name]/` 디렉토리 생성
- [ ] `components/` - 기능 전용 TSX 컴포넌트 작성 (Tailwind + shadcn/ui)
- [ ] `hooks/` - 커스텀 훅 + TanStack Query 키 팩토리
- [ ] `src/lib/api/` - 타입 안전 API 함수 추가
- [ ] `src/routes/` - 라우트 파일 추가 (필요 시)
- [ ] 접근성 체크리스트 확인 (aria-label, 시맨틱 요소)
- [ ] `npx tsc --noEmit` TypeScript 에러 없음 확인

---

## 12. 참고 파일

| 파일                                  | 용도                            |
| ------------------------------------- | ------------------------------- |
| `README.md`                           | 프로젝트 전체 문서              |
| `frontend/design-system/GUIDELINES.md`| 디자인 시스템 가이드            |
| `frontend/design-system/tokens/`      | TS 디자인 토큰 (spacing, colors 등) |
| `backend/.env.example`                | 환경 변수 템플릿                |
| `backend/app/core/database.py`        | DB 스키마 + 마이그레이션        |
| `docker-compose.yml`                  | Docker Compose 구성             |
| `backend/Dockerfile`                  | 백엔드 컨테이너 설정            |
| `frontend/Dockerfile`                 | 프론트엔드 컨테이너 + nginx     |
