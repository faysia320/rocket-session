# 작업 이력: Plan Mode 인라인 카드 전환 + 세션 활동 상태 API

- **날짜**: 2026-02-19
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Plan Mode의 계획 확인 UI를 모달(PlanReviewDialog)에서 인라인 카드(PlanResultCard)로 전환하여 Split View 사용성을 개선했습니다. 세션 대시보드에 현재 실행 중인 도구 활동을 실시간으로 표시하는 기능을 추가했습니다.

## 변경 파일 목록

### Backend

- `backend/app/api/v1/endpoints/sessions.py` - 세션 목록/상세 API에 current_activity 포함
- `backend/app/schemas/session.py` - CurrentActivity 스키마 추가, SessionInfo에 필드 추가
- `backend/app/services/websocket_manager.py` - get_current_activity() 메서드 추가
- `backend/app/core/database.py` - 코드 포맷팅 정리
- `backend/pyproject.toml` - 의존성 업데이트
- `backend/uv.lock` - lock 파일 갱신

### Frontend

- `frontend/src/features/chat/components/PlanResultCard.tsx` - (신규) 인라인 Plan 결과 카드
- `frontend/src/features/chat/components/MessageBubble.tsx` - Plan 메시지를 PlanResultCard로 라우팅
- `frontend/src/features/chat/components/MessageBubble.test.tsx` - PlanResultCard 라우팅 테스트 업데이트
- `frontend/src/features/chat/utils/chatComputations.ts` - Plan result estimateSize 500으로 상향
- `frontend/src/features/chat/components/PlanApprovalButton.tsx` - (삭제) PlanResultCard에 통합
- `frontend/src/features/chat/components/PlanReviewDialog.tsx` - (삭제) 인라인 카드로 대체
- `frontend/src/features/chat/utils/activityLabel.ts` - (신규) 활동 라벨 유틸리티 추출
- `frontend/src/features/chat/components/ActivityStatusBar.tsx` - activityLabel 유틸리티 사용으로 리팩토링
- `frontend/src/features/session/components/SessionDashboardCard.tsx` - 현재 활동 표시 UI 추가
- `frontend/src/features/session/hooks/useSessions.ts` - Running 세션 5초 간격 자동 갱신
- `frontend/src/types/session.ts` - CurrentActivity 타입 추가
- `frontend/src/types/index.ts` - CurrentActivity export 추가
- `frontend/src/components/ui/button.tsx` - outline 변형 hover 시 border-accent 추가
- `frontend/src/components/ui/switch.tsx` - checked/unchecked 상태 border 스타일 개선

## 상세 변경 내용

### 1. Plan Mode UI 인라인 카드 전환

- PlanReviewDialog 모달 → PlanResultCard 인라인 카드로 전환
- Split View에서 다른 세션을 가리지 않음
- 계획 내용이 메시지 스트림 내 카드로 직접 표시 (max-h-[500px] 스크롤)
- Execute/Revise/Dismiss 버튼과 인라인 피드백 Textarea 포함
- 실행 완료 시 border-l-success + Executed 배지

### 2. 세션 활동 상태 실시간 표시

- WebSocketManager에서 현재 실행 중인 도구를 추적하는 get_current_activity() 메서드 추가
- 세션 API 응답에 current_activity 필드 포함
- 대시보드 카드에 스피너 + 활동 라벨 표시
- Running 세션 존재 시 5초 간격 자동 갱신

### 3. ActivityLabel 유틸리티 추출

- ActivityStatusBar에서 인라인으로 정의되던 라벨 로직을 activityLabel.ts로 분리
- SessionDashboardCard에서 재사용 가능하도록 범용 인터페이스 (tool, input) 적용

### 4. UI 미세 조정

- Button outline 변형: hover 시 border-accent 추가
- Switch 컴포넌트: checked/unchecked 상태별 border 색상 차별화

## 테스트 방법

1. Plan Mode 세션에서 계획 수립 후 인라인 카드 확인
2. Split View에서 다른 세션이 가려지지 않는지 확인
3. Execute/Revise/Dismiss 버튼 동작 확인
4. 대시보드에서 Running 세션의 활동 상태 표시 확인
