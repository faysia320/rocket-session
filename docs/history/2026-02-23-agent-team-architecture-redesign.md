# 작업 이력: Agent Team 아키텍처 재설계

- **날짜**: 2026-02-23
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Agent Team 기능의 핵심 아키텍처를 전면 재설계했습니다.

**기존**: 팀이 work_dir에 귀속, 멤버가 세션에 1:1 귀속
**변경**: 팀은 work_dir 없음, 멤버는 페르소나(역할/설정) 정의이며 태스크 위임 시 세션이 동적 생성

### 핵심 변경사항

1. **팀 ≠ work_dir** → work_dir은 태스크에 귀속 (태스크마다 다른 디렉토리 가능)
2. **멤버 ≠ 세션** → 멤버는 페르소나 정의(닉네임, 설명, system_prompt, model 등), 세션은 태스크 위임 시 동적 생성
3. **동시 위임 허용** → 같은 멤버에게 여러 태스크 할당 시 각각 독립 세션 생성

## 변경 파일 목록

### Backend - DB 마이그레이션 + ORM 모델

- `backend/migrations/versions/20260223_0009_redesign_team_tables.py` - 기존 팀 테이블 DROP 후 새 스키마로 재생성
- `backend/app/models/team.py` - Team: work_dir 제거, lead_session_id → lead_member_id; TeamMember: session_id 제거, 페르소나 필드 추가
- `backend/app/models/team_task.py` - assigned_session_id → assigned_member_id, work_dir(NOT NULL) 추가, session_id(nullable) 추가
- `backend/app/models/team_message.py` - from_session_id → from_member_id, to_session_id → to_member_id
- `backend/app/models/__init__.py` - TeamMessage export 추가

### Backend - 비즈니스 로직

- `backend/app/schemas/team.py` - 전체 스키마 재작성 (페르소나 기반)
- `backend/app/repositories/team_repo.py` - 멤버 CRUD를 페르소나 기반으로 변경
- `backend/app/repositories/team_task_repo.py` - get_by_session_id, get_tasks_by_session_id, update_session_id 추가
- `backend/app/repositories/team_message_repo.py` - member_id 참조로 변경
- `backend/app/services/team_service.py` - 페르소나 기반 멤버 관리
- `backend/app/services/team_task_service.py` - work_dir 필수, member_id 참조
- `backend/app/services/team_message_service.py` - member_id 참조
- `backend/app/services/team_coordinator.py` - 전면 재작성: 태스크 위임 시 멤버 페르소나 + work_dir로 세션 동적 생성
- `backend/app/services/claude_runner.py` - @delegate 패턴 감지: session → task → member → team 역조회 체인
- `backend/app/api/v1/endpoints/teams.py` - 전체 API 엔드포인트 재작성

### Frontend - 타입 + API

- `frontend/src/types/team.ts` - 전체 타입 재정의 (페르소나 기반)
- `frontend/src/types/index.ts` - UpdateTeamMemberRequest export 추가
- `frontend/src/lib/api/teams.api.ts` - API 함수 재작성 (member_id 기반)

### Frontend - Hooks

- `frontend/src/features/team/hooks/useTeams.ts` - createMember 제거, removeMember number 타입
- `frontend/src/features/team/hooks/useTeamTasks.ts` - claimMutation: memberId number 타입
- `frontend/src/features/team/hooks/useTeamMessages.ts` - SendMessageRequest 직접 전달
- `frontend/src/features/team/hooks/useTeamSocket.ts` - member_id 기반 이벤트

### Frontend - 컴포넌트

- `frontend/src/features/team/components/TeamCreateDialog.tsx` - work_dir 제거
- `frontend/src/features/team/components/TeamDashboard.tsx` - 멤버 추가 다이얼로그를 페르소나 폼으로 재설계
- `frontend/src/features/team/components/TeamMemberList.tsx` - 세션 상태 → 역할/모델/설명 표시
- `frontend/src/features/team/components/TeamMessagePanel.tsx` - member_id 기반 메시지 조회
- `frontend/src/features/team/components/TeamTaskBoard.tsx` - memberId 기반 위임/할당
- `frontend/src/features/team/components/TeamTaskCard.tsx` - member_id 기반 할당, work_dir 표시
- `frontend/src/features/team/components/TeamTaskCreateDialog.tsx` - work_dir DirectoryPicker 추가
- `frontend/src/features/team/components/TeamTaskDelegateDialog.tsx` - 전체 멤버 선택 (동시 위임 허용)

## 상세 변경 내용

### 1. DB 스키마 재설계

기존 4개 팀 테이블(teams, team_members, team_tasks, team_messages)을 DROP 후 새 구조로 재생성:

- **teams**: work_dir 컬럼 제거, lead_session_id → lead_member_id
- **team_members**: session_id 제거, 페르소나 필드 추가 (nickname, description, system_prompt, allowed_tools, model 등)
- **team_tasks**: assigned_session_id → assigned_member_id, work_dir(NOT NULL) 추가, session_id(nullable) 추가
- **team_messages**: from/to_session_id → from/to_member_id

### 2. TeamCoordinator 동적 세션 생성

태스크 위임 시 멤버의 페르소나 설정 + 태스크의 work_dir을 조합하여 새 세션을 동적으로 생성:

```
delegate_task(task_id, member_id) →
  1. 멤버 페르소나 조회 (system_prompt, model, allowed_tools...)
  2. 태스크 work_dir 확인
  3. SessionManager.create_session(페르소나 설정 + work_dir)
  4. task.session_id = new_session_id
  5. 세션 시작 + 프롬프트 전달
```

### 3. @delegate 역조회 체인

Claude 응답에서 `@delegate(nickname): 설명` 패턴을 감지하여 자동 위임:

```
session_id → TeamTask.session_id 역조회 → task.assigned_member_id
→ team.lead_member_id와 비교하여 리드 세션인지 확인
→ 리드이면 자동 위임 실행
```

## 테스트 방법

1. Docker 이미지 재빌드 + 컨테이너 재시작 (마이그레이션 자동 적용)
2. 팀 생성 (이름 + 설명만, work_dir 없음)
3. 멤버 추가 (닉네임, 설명, 모델, 시스템 프롬프트 등 페르소나 설정)
4. 태스크 생성 (work_dir 필수 지정)
5. 태스크 위임 시 세션이 자동 생성되는지 확인

## 비고

- 기존 팀 데이터는 마이그레이션 시 모두 삭제됩니다 (DROP TABLE)
- 동시 위임: 같은 멤버에게 여러 태스크를 할당하면 각각 독립 세션이 생성됩니다
