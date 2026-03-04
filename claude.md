# rocket-session

> **최종 수정일**: 2026-02-26

## 실행 환경 (필수 참조)

- **코드 편집**: Windows 로컬 환경에서 수행
- **빌드/실행**: Docker 이미지로 빌드 → Docker 컨테이너에서 구동
- **서버 실행 방식**: `uv run uvicorn app.main:app --host 0.0.0.0 --port 8101` (PID 1, `--reload` 없음)
- **코드 수정 반영**: 코드 변경 후 **Docker 이미지 재빌드 + 컨테이너 재시작**이 필요 (자동 리로드 없음)
- **개발 시 유의사항**:
  - 코드 수정 후 서버 테스트가 필요하면 사용자에게 컨테이너 재시작을 안내할 것
  - 런타임 에러 디버깅 시 컨테이너 로그(`docker logs`)를 참조할 것
  - 파일 경로는 컨테이너 내부 경로 기준 (`/projects/rocket-session/`)
  - Frontend TypeScript 검사는 로컬 `node_modules`가 필요함 → `cd frontend && pnpm install` 선행 필수

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
  - Workflow 시스템 (Research → Plan → Implement 3단계 워크플로우, 아티팩트 + 인라인 주석 + 승인 게이트)
  - Permission Mode (도구 사용 시 사용자 승인 요청, MCP 서버 연계)
  - 이미지 업로드 + 슬래시 명령어 자동완성
  - 사용량 추적 (5시간 블록 + 주간, ccusage 연동)
  - 디렉토리 탐색 + Git 워크트리 관리
  - MCP 서버 관리 (설정, 활성화/비활성화, 세션별 연결)
  - 세션 태그 (태그로 세션 분류/필터링)
  - 분석 대시보드 (토큰, 비용, 모델별 통계)
  - 명령 팔레트 (Ctrl+K, 세션/Git/채팅 빠른 명령)
  - 알림 시스템 (세션 완료/오류 알림 + 사운드)
  - Git 모니터 (상태 추적, 커밋, PR 생성, Rebase)
  - 전문 검색 (PostgreSQL TSVECTOR 기반)
  - 글로벌 설정 (새 세션의 기본값 일괄 관리)
  - 워크스페이스 관리 (Git clone 기반, 자동 의존성 설치, Pull/Push 동기화)
  - 팀 채팅 (다중 Claude 에이전트 팀 협업, Coordinator가 작업 분배)
- **동작 방식**: FastAPI 백엔드가 Claude Code CLI를 subprocess로 실행하고, `--output-format stream-json`으로 출력을 파싱하여 WebSocket으로 프론트엔드에 전달. 모든 데이터는 PostgreSQL에 영속 저장

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
| 데이터베이스    | PostgreSQL (asyncpg) + SQLAlchemy ORM | 2.0+     |
| 마이그레이션    | Alembic             | 1.18+    |
| WebSocket       | websockets        | 14.1     |
| 설정 관리       | Pydantic Settings | 2.x      |
| HTTP 클라이언트 | httpx               | 0.24+    |
| 파일 업로드     | python-multipart  | 0.0.22+  |
| 테스트          | pytest + pytest-asyncio + testcontainers | 7.x+  |
| 패키지 매니저   | **uv**            | -        |

### 외부 의존성

- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)
- [ccusage](https://github.com/ryoppippi/ccusage) (사용량 조회, `npx ccusage`)
- Active Claude Pro/Max 구독 또는 API key

---

## 3. 프로젝트 구조

> 상세 디렉토리 트리는 Serena 메모리 `project_structure` 참조

### 최상위 구조

| 디렉토리 | 역할 | 레이어 |
|----------|------|--------|
| `backend/app/` | FastAPI 백엔드 | endpoints → services → repositories → models |
| `frontend/src/` | React 프론트엔드 | routes → features → components + hooks |
| `docker-compose.yml` | PostgreSQL + Backend + Frontend 컨테이너 | - |

### Frontend Feature 모듈 (18개)

`src/features/` 하위: `analytics`, `chat`, `command-palette`, `dashboard`, `directory`,
`files`, `git-monitor`, `history`, `layout`, `mcp`, `notification`, `session`,
`settings`, `tags`, `team`, `usage`, `workflow`, `workspace`

각 feature는 `components/` + `hooks/` 구조를 따름.

### Backend 레이어 패턴

각 도메인은 동일한 4계층 파일 구조:
`schemas/{name}.py` → `models/{name}.py` → `repositories/{name}_repo.py` → `services/{name}_service.py` → `endpoints/{name}.py`

---

## 4. 아키텍처

### WebSocket + Subprocess + PostgreSQL 기반 아키텍처

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
│  Settings · MCP · Tags · Analytics · Workflow                │
└─────────────────────────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────────────────────────┐
│                  Service Layer                               │
│  SessionManager / WebSocketManager / ClaudeRunner            │
│  UsageService / FilesystemService / LocalSessionScanner      │
│  SettingsService / McpService                                │
│  TagService / SearchService / AnalyticsService               │
│  WorkflowService / JsonlWatcher / EventHandler               │
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
│              PostgreSQL (asyncpg + SQLAlchemy ORM)            │
│  sessions · messages · file_changes · events · workspaces    │
│  session_artifacts · artifact_annotations                    │
│  global_settings · mcp_servers · tags · workflow_definitions  │
│  token_snapshots · teams · team_messages · team_tasks         │
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
                                     PostgreSQL 저장 (messages, file_changes, events)
                                            ↓
                                     WebSocketManager (브로드캐스트 + 이벤트 버퍼링)
                                            ↓
                                     ChatPanel (메시지 렌더링)
```

### 핵심 서비스

> 상세 서비스 목록(25개)은 Serena 메모리 `service_architecture` 참조.
> 핵심: `SessionManager`, `ClaudeRunner`, `WebSocketManager`, `WorkflowService`, `TeamCoordinator`
> 영속 저장: PostgreSQL. 프로세스 핸들만 인메모리 (서버 재시작 시 끊어짐).

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
| **Repository 패턴** | 데이터 접근 계층 분리 (API → Service → Repository → Model) |
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

테마 색상은 `frontend/src/index.css`에 HSL 변수로 정의. 상세 색상 테이블은 Serena 메모리 `frontend_design_system` 참조.
주요 색상: `bg-background`(dark navy), `text-primary`/`bg-primary`(amber), `text-destructive`(red), `text-success`(green).

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
// - workflow_started: 워크플로우 시작
// - workflow_phase_completed: 단계 완료 (승인 대기)
// - workflow_phase_approved: 단계 승인
// - workflow_revision_requested: 수정 요청
// - workflow_completed: 워크플로우 전체 완료
// - workflow_error: 워크플로우 오류

// 재연결: last_seq 파라미터로 놓친 이벤트 자동 복구
// ws://localhost:8101/ws/{sessionId}?last_seq=42
```

### 6.8 shadcn/ui 컴포넌트 추가

```bash
npx shadcn@latest add <component-name>
```

설치 후 `@/components/ui/`에 생성됩니다. **임포트 경로 확인**: `src/lib/utils`가 아닌 `@/lib/utils`로 되어있는지 반드시 확인하세요.

### 6.9 디자인 시스템 가이드라인 참조

> 테마 색상, 디자인 토큰, 참조 파일 목록은 Serena 메모리 `frontend_design_system` 참조.
> 핵심 파일: `design-system/GUIDELINES.md`, `design-system/css/variables.css`, `src/index.css`, `tailwind.config.js`

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
앱 시작 시 `init_dependencies()`로 DB/서비스를 초기화하고, 종료 시 `shutdown_dependencies()`로 정리합니다.
상세 DI 프로바이더 목록은 Serena 메모리 `service_architecture` 참조.

### 7.2 새 API 엔드포인트 추가 순서

1. **Schema** (`app/schemas/my_feature.py`) - Pydantic 모델
2. **Model** (`app/models/my_feature.py`) - SQLAlchemy ORM 모델
3. **Repository** (`app/repositories/my_feature_repo.py`) - 데이터 접근 계층
4. **Service** (`app/services/my_feature_service.py`) - 비즈니스 로직
5. **Endpoint** (`app/api/v1/endpoints/my_feature.py`) - API 라우터
6. **라우터 등록** (`app/api/v1/api.py`) - `include_router` 추가
7. **의존성** (`app/api/dependencies.py`) - DI 프로바이더 추가

### 7.3 환경 설정

환경변수는 `backend/.env`로 관리 (Pydantic Settings). 상세는 Serena 메모리 `service_architecture` 참조.

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
uv run alembic revision --autogenerate -m "설명"  # 마이그레이션 생성
uv run alembic upgrade head                        # 마이그레이션 적용
uv run alembic downgrade -1                        # 마이그레이션 롤백
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

> DB 스키마 상세는 Serena 메모리 `database_schema` 참조.
> 테이블: sessions, messages, session_artifacts, artifact_annotations, file_changes, events, workspaces, global_settings, mcp_servers, tags, session_tags, teams, team_messages, team_tasks, workflow_definitions, token_snapshots
> 마이그레이션: `cd backend && uv run alembic revision --autogenerate -m "설명"`

---

## 11. 새 기능 개발 체크리스트

> 상세 체크리스트는 Serena 메모리 `new_feature_checklist` 참조

---

## 12. 참고 파일

| 파일                                  | 용도                            |
| ------------------------------------- | ------------------------------- |
| `README.md`                           | 프로젝트 전체 문서              |
| `frontend/design-system/GUIDELINES.md`| 디자인 시스템 가이드            |
| `frontend/design-system/tokens/`      | TS 디자인 토큰 (spacing, colors 등) |
| `backend/.env.example`                | 환경 변수 템플릿                |
| `backend/app/core/database.py`        | PostgreSQL 엔진 + Alembic 마이그레이션 |
| `backend/app/models/`                 | SQLAlchemy ORM 모델             |
| `backend/app/repositories/`           | 데이터 접근 계층 (Repository)   |
| `backend/migrations/`                 | Alembic 마이그레이션 파일       |
| `docker-compose.yml`                  | Docker Compose 구성             |
| `backend/Dockerfile`                  | 백엔드 컨테이너 설정            |
| `frontend/Dockerfile`                 | 프론트엔드 컨테이너 + nginx     |
