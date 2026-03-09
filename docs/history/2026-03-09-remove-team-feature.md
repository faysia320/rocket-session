# 작업 이력: Team 기능 전체 제거

- **날짜**: 2026-03-09
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Team(다중 에이전트 협업) 기능을 프로젝트에서 전면 제거했습니다.
칸반보드/태스크 관련 UI 컴포넌트 5개는 향후 Task 기능(사용자 요청 티켓 관리) 개발을 위해
`frontend/src/features/task/_reference/`에 보존했습니다.

## 변경 파일 목록

### Backend - 통합 지점 수정 (8개 파일)

- `backend/app/api/v1/api.py` - team 라우터 등록 제거
- `backend/app/api/dependencies.py` - 4개 team 서비스 DI 제거
- `backend/app/models/__init__.py` - 3개 team 모델 re-export 제거
- `backend/app/repositories/__init__.py` - 3개 team repo re-export 제거
- `backend/app/models/event_types.py` - 8개 team 이벤트 enum 제거
- `backend/app/services/claude_runner.py` - delegate 명령 핸들러 + on_session_completed 콜백 제거
- `backend/app/api/v1/endpoints/ws.py` - inject_team_context 블록 제거
- `backend/tests/conftest.py` - TeamService fixture + truncate 테이블 목록 정리

### Backend - 삭제된 파일 (13개)

- `backend/app/api/v1/endpoints/teams.py` - Team REST API
- `backend/app/services/team_coordinator.py` - 작업 분배 코디네이터
- `backend/app/services/team_service.py` - 팀 생명주기 관리
- `backend/app/services/team_task_service.py` - 팀 작업 관리
- `backend/app/services/team_message_service.py` - 팀 메시지 관리
- `backend/app/repositories/team_repo.py` - Team/TeamMember 레포지토리
- `backend/app/repositories/team_task_repo.py` - TeamTask 레포지토리
- `backend/app/repositories/team_message_repo.py` - TeamMessage 레포지토리
- `backend/app/schemas/team.py` - Pydantic 스키마
- `backend/app/models/team.py` - Team/TeamMember ORM
- `backend/app/models/team_task.py` - TeamTask ORM
- `backend/app/models/team_message.py` - TeamMessage ORM
- `backend/tests/test_team_service.py` - 팀 서비스 테스트

### DB 마이그레이션 (1개 신규)

- `backend/migrations/versions/20260309_73480a682def_drop_team_tables.py` - teams, team_members, team_tasks, team_messages 테이블 DROP

### Frontend - 통합 지점 수정 (8개 파일)

- `frontend/src/routes/__root.tsx` - TeamLayout/TeamSidebar/useTeams 제거
- `frontend/src/features/layout/components/GlobalTopBar.tsx` - Team 네비게이션 항목 제거
- `frontend/src/features/command-palette/hooks/useCommandPalette.ts` - team 명령 제거
- `frontend/src/features/command-palette/commands/index.ts` - team export 제거
- `frontend/src/features/command-palette/registry.ts` - team route zone 제거
- `frontend/src/features/command-palette/types.ts` - team 카테고리/존 제거
- `frontend/src/types/index.ts` - team 타입 re-export 제거
- `frontend/tsconfig.app.json` - _reference/ exclude 추가

### Frontend - 삭제된 파일/디렉토리

- `frontend/src/features/team/` - 전체 디렉토리 (13개 컴포넌트 + 5개 훅)
- `frontend/src/routes/team/` - 라우트 파일 2개
- `frontend/src/types/team.ts` - 타입 정의
- `frontend/src/lib/api/teams.api.ts` - API 클라이언트
- `frontend/src/features/command-palette/commands/team.ts` - 팀 명령어

### Frontend - 보존된 컴포넌트 (5개, 신규 위치)

- `frontend/src/features/task/_reference/TeamTaskBoard.tsx` - 3컬럼 칸반보드
- `frontend/src/features/task/_reference/TeamTaskCard.tsx` - 태스크 카드
- `frontend/src/features/task/_reference/TeamTaskCreateDialog.tsx` - 생성 폼
- `frontend/src/features/task/_reference/TeamTaskDelegateDialog.tsx` - 위임 다이얼로그
- `frontend/src/features/task/_reference/TeamStatusBar.tsx` - 진행률 바

### 문서

- `README.md` - team 관련 모든 참조 제거
- `claude.md` - team 기능 및 DB 테이블 설명 제거
- `docs/history/2026-02-23-agent-team-*.md` - 3개 이력 문서 삭제

## 상세 변경 내용

### 1. Backend 통합 지점 정리

- `dependencies.py`에서 TeamService, TeamCoordinator, TeamTaskService, TeamMessageService의 import, __init__ 속성, initialize() 인스턴스 생성, getter 함수를 모두 제거
- `claude_runner.py`에서 `_try_handle_delegate_commands` 호출부, 메서드 정의, `on_session_completed` 콜백을 제거
- `ws.py`에서 WebSocket 연결 시 team 컨텍스트 주입 블록을 제거

### 2. DB 마이그레이션

- FK 의존 순서를 준수하여 team_messages → team_tasks → team_members → teams 순서로 DROP
- `DROP TABLE IF EXISTS ... CASCADE`로 안전하게 처리
- 기존 5개 team 마이그레이션은 Alembic 체인 보존을 위해 삭제하지 않음

### 3. Frontend 통합 지점 정리

- `__root.tsx`에서 TeamLayout 함수 전체와 관련 import/변수 제거
- `GlobalTopBar.tsx`에서 Team 네비게이션 항목 및 Users 아이콘 import 제거
- command-palette 전반에서 team 카테고리, 라우트 존, 명령 팩토리 제거

### 4. 칸반보드 컴포넌트 보존

- 향후 Task 기능(티켓 발행/관리 시스템)에서 칸반보드 UI를 재활용할 예정
- 5개 컴포넌트를 `features/task/_reference/`로 이동
- `tsconfig.app.json`의 `exclude`에 추가하여 빌드 시 타입 체크에서 제외 (깨진 import 있음)

## 검증 결과

- Backend: `uv run pytest` → 387 passed (1 failed는 team 무관한 usage 캐시 테스트)
- Frontend: `pnpm tsc --noEmit` 통과, `pnpm build` 성공
- `\bteam\b` grep 결과 코드 전체에서 0건 (보존 컴포넌트 제외)
