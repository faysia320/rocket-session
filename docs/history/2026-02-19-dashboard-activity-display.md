# 작업 이력: Dashboard 카드 Running 세션 활동 표시

- **날짜**: 2026-02-19
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Dashboard Mode에서 Running 상태인 세션 카드에 현재 진행 중인 활동 내용(예: "Writing …/App.tsx", "Running `npm test`", "Thinking…")을 실시간 표시하는 기능을 구현했습니다. 백엔드 WebSocketManager의 인메모리 이벤트 버퍼에서 현재 활동을 추출하여 세션 목록 API 응답에 포함하는 방식으로, 추가 WebSocket 연결 없이 기존 REST polling에 편승합니다.

## 변경 파일 목록

### Backend

- `backend/app/services/websocket_manager.py` - `get_current_activity()` 메서드 추가
- `backend/app/schemas/session.py` - `CurrentActivity` Pydantic 모델 + `SessionInfo.current_activity` 필드 추가
- `backend/app/api/v1/endpoints/sessions.py` - 세션 목록/조회 API에서 Running 세션에 활동 정보 포함

### Frontend

- `frontend/src/types/session.ts` - `CurrentActivity` 인터페이스 + `SessionInfo` 필드 추가
- `frontend/src/types/index.ts` - `CurrentActivity` barrel export 추가
- `frontend/src/features/chat/utils/activityLabel.ts` - (신규) TOOL_LABELS, getActivityLabel(), shortenPath() 공유 유틸리티
- `frontend/src/features/chat/components/ActivityStatusBar.tsx` - 로컬 로직을 activityLabel 유틸리티 import로 리팩토링
- `frontend/src/features/session/components/SessionDashboardCard.tsx` - 스피너 + 활동 레이블 UI 추가
- `frontend/src/features/session/hooks/useSessions.ts` - Running 세션 존재 시 5초 polling 자동 갱신

## 상세 변경 내용

### 1. 백엔드: 현재 활동 추출 로직

`WebSocketManager.get_current_activity()` 메서드를 추가하여 인메모리 이벤트 버퍼(`_event_buffers`)에서 미완료 tool_use 이벤트를 역순 탐색합니다.

- 완료된 tool_use_id를 tool_result 이벤트로부터 수집
- 역순으로 미완료 tool_use를 찾아 `{tool, input}` 반환
- 활성 도구가 없으면 assistant_text(텍스트 생성 중)를 `__thinking__`으로 감지
- O(n) 인메모리 연산 (n <= 1000), DB 쿼리 없음

### 2. 백엔드: API 확장

세션 목록(`GET /api/v1/sessions/`)과 단일 조회(`GET /api/v1/sessions/{id}`)에서 Running 세션에 대해서만 `current_activity`를 채웁니다. Idle/Stopped 세션에는 오버헤드가 없습니다.

### 3. 프론트엔드: 활동 레이블 유틸리티 추출

기존 `ActivityStatusBar.tsx`에 있던 `TOOL_LABELS`, `getActivityLabel()`, `shortenPath()` 로직을 `activityLabel.ts`로 추출하여 `SessionDashboardCard`와 공유합니다.

### 4. 프론트엔드: 카드 UI

카드의 통계 행과 work_dir 사이에 스피너 + 활동 텍스트를 표시합니다. 기존 ActivityStatusBar와 동일한 시각적 언어(info 색상 스피너)를 사용합니다.

### 5. 프론트엔드: Polling 최적화

Running 세션이 존재할 때만 5초 간격으로 세션 목록을 자동 갱신하여 활동 내용이 주기적으로 업데이트됩니다. Running 세션이 없으면 기존 10초 staleTime만 유지합니다.

## 테스트 방법

1. 세션 하나에 프롬프트를 전송하여 Running 상태로 만들기
2. Dashboard Mode로 전환 (사이드바 하단 LayoutGrid 아이콘)
3. 해당 세션 카드에 스피너 + 활동 텍스트 표시 확인
4. 도구 전환 시 (Read → Write → Bash) 레이블 변경 확인
5. Idle 세션 카드에는 활동 내용 미표시 확인

## 비고

- 접근 방식 선택: 대시보드 전용 WebSocket이나 세션별 경량 WS 대신, 기존 REST API polling에 편승하는 방식을 채택
- 이유: 데이터가 이미 인메모리에 존재, 추가 인프라 불필요, 대시보드는 개요 성격이므로 5~10초 갱신이 적합
