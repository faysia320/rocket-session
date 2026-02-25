# 작업 이력: 워크스페이스 마이그레이션 후 코드 정리 + 문서 최신화

- **날짜**: 2026-02-25
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

프로젝트가 호스트 디렉토리 볼륨 마운트 방식에서 Docker 내부 Git clone 기반 워크스페이스 시스템으로 마이그레이션된 이후, CLI 패키지·테스트 코드·README·CLAUDE.md에 남아있던 구식 패턴을 정리하고 문서를 최신화했습니다. 추가로 워크플로우 에러 처리 버그 수정 및 UI 간소화도 포함됩니다.

## 변경 파일 목록

### Backend

- `backend/app/services/claude_runner.py` - 워크플로우 에러 시 자동 체이닝 방지 (is_error 플래그)
- `backend/tests/test_api_endpoints.py` - workspace 기반 세션 생성 테스트로 마이그레이션

### Frontend

- `frontend/src/features/chat/components/MessageBubble.tsx` - WorkflowPhaseCard 조건을 plan 단계로 한정
- `frontend/src/features/workflow/components/WorkflowPhaseCard.tsx` - Research 단계 설정 제거
- `frontend/src/features/workflow/components/WorkflowProgressBar.tsx` - 미사용 함수 및 상태 라벨 제거

### CLI

- `cli/templates/docker-compose.yml` - PostgreSQL 서비스 추가, HOST_PROJECTS_DIR 볼륨 제거
- `cli/lib/env.mjs` - HOST_PROJECTS_DIR → CLAUDE_AUTH_FILE 교체
- `cli/commands/init.mjs` - projectsDir 대화형 질문 제거
- `cli/commands/start.mjs` - projectsDir 대화형 질문 및 preflight 제거
- `cli/commands/config.mjs` - projectsDir 참조 제거
- `cli/lib/preflight.mjs` - projectsDir 경로 체크 제거
- `cli/index.mjs` - help 텍스트에서 --projects-dir 예시 제거

### 문서

- `README.md` - 아키텍처, 프로젝트 구조, API, DB 스키마에 워크스페이스·팀 반영
- `claude.md` - 프로젝트 구조, 서비스 테이블, 환경변수, DB 스키마 최신화

## 상세 변경 내용

### 1. 워크플로우 에러 시 자동 체이닝 방지

- `turn_state`에 `is_error` 플래그 추가
- research/plan/implement 각 단계의 자동 체이닝 조건에 `not turn_state.get("is_error")` 추가
- 에러 발생 시 다음 워크플로우 단계로 자동 전환되지 않도록 방지

### 2. 워크플로우 UI 간소화

- `MessageBubble`: WorkflowPhaseCard 조건을 `plan` 단계로 한정
- `WorkflowPhaseCard`: Research 단계 설정 제거 (plan만 카드 표시)
- `WorkflowProgressBar`: 미사용 `getStatusLabel` 함수 및 상태 라벨 UI 제거

### 3. CLI에서 HOST_PROJECTS_DIR 완전 제거

- docker-compose 템플릿에 PostgreSQL 16 Alpine 서비스 추가
- `HOST_PROJECTS_DIR` 호스트 바인드 마운트 → `rocket-workspaces` Docker 볼륨으로 교체
- `CLAUDE_AUTH_FILE` 환경변수 추가 (`.claude.json` 단일 파일 마운트)
- `DATABASE_URL` 환경변수를 백엔드에 전달
- 모든 CLI 명령에서 `projectsDir` 관련 코드 제거

### 4. 테스트 코드 워크스페이스 기반으로 마이그레이션

- `test_client` fixture에서 DB에 테스트용 workspace 레코드 직접 삽입 (git clone 우회)
- `create_test_session` 헬퍼를 `workspace_id` 기반으로 변경
- `test_create_session_without_workspace`: 400 에러 반환 검증으로 변경
- 23개 테스트 모두 통과

### 5. 문서 전면 최신화

- README.md/CLAUDE.md의 프로젝트 구조에 workspace·team·git 관련 누락 파일 추가
- `alembic/` → `migrations/` 경로 수정
- 핵심 서비스 테이블에 9개 서비스 추가
- 환경변수에 GIT_USER_NAME, GIT_USER_EMAIL, GITHUB_TOKEN, CORS_EXTRA_ORIGINS 추가
- DB 스키마에 workspaces, teams, team_messages, team_tasks 테이블 추가
- API 엔드포인트에 Workspaces, Teams 섹션 추가

## 관련 커밋

- `Fix: 워크플로우 에러 시 자동 체이닝 방지`
- `Refactor: 워크플로우 UI에서 Research 단계 카드 제거 및 간소화`
- `Chore: CLI에서 HOST_PROJECTS_DIR 제거 및 PostgreSQL 서비스 추가`
- `Test: 워크스페이스 기반 세션 생성 테스트로 마이그레이션`
- `Docs: 워크스페이스 마이그레이션 후 README/CLAUDE.md 최신화`

## 검증 방법

1. CLI: `node cli/index.mjs --help` → `--projects-dir` 참조 없음 확인
2. CLI: `grep -r "HOST_PROJECTS_DIR" cli/` → 잔존 참조 없음 확인
3. 테스트: `cd backend && uv run pytest tests/test_api_endpoints.py -v` → 23개 통과
4. TypeScript: `npx tsc -p tsconfig.app.json --noEmit` → 타입 에러 없음
