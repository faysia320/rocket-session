# 작업 이력: Agent Team (멀티 에이전트 협업) 기능 구현

- **날짜**: 2026-02-23
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

여러 Claude 세션을 "팀"으로 묶어 태스크를 분배하고 실시간 모니터링할 수 있는 Agent Team 기능을 4단계로 구현했습니다.

- Phase 1: 팀 CRUD + 멤버 관리
- Phase 2: 공유 태스크 칸반 보드
- Phase 3: 태스크 위임 + 실시간 모니터링 (WebSocket)
- Phase 4: 팀 메시징 + 리드 자동 위임 (@delegate 패턴)

## 변경 파일 목록

### Backend - 신규 파일

- `backend/app/models/team.py` - Team, TeamMember ORM 모델
- `backend/app/models/team_task.py` - TeamTask ORM 모델 (칸반 태스크)
- `backend/app/models/team_message.py` - TeamMessage ORM 모델 (팀 메시징)
- `backend/app/schemas/team.py` - 팀 관련 Pydantic 스키마 (CRUD, 태스크, 메시지)
- `backend/app/repositories/team_repo.py` - TeamRepository, TeamMemberRepository
- `backend/app/repositories/team_task_repo.py` - TeamTaskRepository (FOR UPDATE SKIP LOCKED)
- `backend/app/repositories/team_message_repo.py` - TeamMessageRepository
- `backend/app/services/team_service.py` - 팀 CRUD + 멤버 관리 비즈니스 로직
- `backend/app/services/team_task_service.py` - 태스크 관리 비즈니스 로직
- `backend/app/services/team_coordinator.py` - 태스크 위임, 세션 완료 콜백, 이벤트 브로드캐스트, @delegate 파싱
- `backend/app/services/team_message_service.py` - 팀 메시지 CRUD
- `backend/app/api/v1/endpoints/teams.py` - 팀 REST API + WebSocket 엔드포인트
- `backend/migrations/versions/20260223_0006_add_teams_tables.py` - teams + team_members 마이그레이션
- `backend/migrations/versions/20260223_0007_add_team_tasks_table.py` - team_tasks 마이그레이션
- `backend/migrations/versions/20260223_0008_add_team_messages_table.py` - team_messages 마이그레이션

### Backend - 수정 파일

- `backend/app/models/__init__.py` - Team, TeamMember, TeamTask, TeamMessage import 추가
- `backend/app/models/event_types.py` - 팀 이벤트 타입 추가 (TEAM_TASK_*, TEAM_MEMBER_*, TEAM_MESSAGE 등)
- `backend/app/api/v1/api.py` - teams 라우터 등록
- `backend/app/api/dependencies.py` - TeamService, TeamTaskService, TeamCoordinator, TeamMessageService DI 추가
- `backend/app/services/claude_runner.py` - 리드 세션 @delegate 패턴 자동 감지 + 위임
- `backend/app/api/v1/endpoints/ws.py` - 리드 세션 시스템 프롬프트에 팀 컨텍스트 자동 주입

### Frontend - 신규 파일

- `frontend/src/types/team.ts` - 팀 관련 TypeScript 타입 정의
- `frontend/src/lib/api/teams.api.ts` - 팀 API 클라이언트
- `frontend/src/features/team/hooks/teamKeys.ts` - TanStack Query 키 팩토리
- `frontend/src/features/team/hooks/useTeams.ts` - 팀 CRUD 쿼리 훅
- `frontend/src/features/team/hooks/useTeamTasks.ts` - 태스크 CRUD 쿼리 훅
- `frontend/src/features/team/hooks/useTeamSocket.ts` - 팀 WebSocket 실시간 이벤트 훅
- `frontend/src/features/team/hooks/useTeamMessages.ts` - 팀 메시지 쿼리 훅
- `frontend/src/features/team/components/TeamDashboard.tsx` - 팀 대시보드 메인
- `frontend/src/features/team/components/TeamCreateDialog.tsx` - 팀 생성 다이얼로그
- `frontend/src/features/team/components/TeamMemberList.tsx` - 멤버 목록 + 관리
- `frontend/src/features/team/components/TeamTaskBoard.tsx` - 칸반 보드 (Pending/In Progress/Completed)
- `frontend/src/features/team/components/TeamTaskCard.tsx` - 태스크 카드 (위임 버튼 포함)
- `frontend/src/features/team/components/TeamTaskCreateDialog.tsx` - 태스크 생성 다이얼로그
- `frontend/src/features/team/components/TeamStatusBar.tsx` - 팀 진행률 바
- `frontend/src/features/team/components/TeamMessagePanel.tsx` - 팀 메시지 채팅 패널
- `frontend/src/routes/team/$teamId.tsx` - /team/:teamId 라우트

### Frontend - 수정 파일

- `frontend/src/types/index.ts` - 팀 타입 barrel export 추가
- `frontend/src/features/session/components/Sidebar.tsx` - 팀 목록 + 생성 버튼 추가
- `frontend/src/routes/__root.tsx` - 팀 라우트 임포트
- `frontend/src/routeTree.gen.ts` - TanStack Router 자동 생성 업데이트

## 상세 변경 내용

### 1. 팀 CRUD + 멤버 관리 (Phase 1)

- Team(id, name, description, status, lead_session_id, work_dir, config) + TeamMember(team_id, session_id, role, nickname) 연결 테이블 구조
- 기존 세션 추가, 새 세션 생성+자동 등록, 리드 설정, 멤버 제거
- 팀별 세션 그룹핑을 Sidebar에 표시

### 2. 공유 태스크 칸반 보드 (Phase 2)

- TeamTask(title, description, status, priority, assigned_session_id, order_index, depends_on_task_id)
- `SELECT ... FOR UPDATE SKIP LOCKED`로 태스크 선점 동시성 제어
- 3컬럼 칸반 UI (Pending → In Progress → Completed)

### 3. 태스크 위임 + 실시간 모니터링 (Phase 3)

- TeamCoordinator: delegate_task → claim_task + ClaudeRunner.run 실행
- 세션 완료 시 on_session_completed 콜백으로 태스크 자동 완료
- 팀 전용 WebSocket (/api/teams/ws/{teamId}) 실시간 이벤트 브로드캐스트
- 위임 버튼이 있는 태스크 카드 UI

### 4. 팀 메시징 + 리드 자동 위임 (Phase 4)

- TeamMessage(from_session_id, to_session_id, content, message_type, is_read)
- 메시지 패널 UI (타입별 컬러 코딩, 자동 스크롤)
- `@delegate(nickname): description` 패턴을 리드 세션 응답에서 파싱하여 자동 위임
- 리드 세션 시스템 프롬프트에 팀 컨텍스트(멤버/태스크/위임규약) 자동 주입

## 테스트 방법

1. 팀 생성: Sidebar에서 "새 팀" 버튼 클릭
2. 멤버 추가: 팀 대시보드에서 기존 세션 추가 또는 새 세션 생성
3. 태스크 생성: 칸반 보드에서 "+" 버튼
4. 태스크 위임: 태스크 카드 "위임" 버튼 → 대상 세션 선택
5. 메시지: 팀 대시보드 하단 메시지 패널
6. 자동 위임: 리드 세션에 프롬프트 전송 → Claude 응답에서 @delegate 패턴 감지

## 비고

- Docker 이미지 재빌드 + 컨테이너 재시작 필요 (Alembic 마이그레이션 포함)
- @dnd-kit 의존성은 Phase 2 칸반 드래그앤드롭에 필요하나 아직 미추가 (수동 상태 변경으로 대체)
