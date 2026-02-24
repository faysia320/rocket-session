# 작업 이력: FE/BE 코드 품질 개선 (Phase 0-6)

- **날짜**: 2026-02-24
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

38건의 코드 품질 개선 항목 중 Phase 0~6을 구현했습니다. 프론트엔드 치명적 버그 수정, 보안 강화, 타입 안전성, DB 성능, SessionManager 리팩토링, 컴포넌트 분해, 백엔드 코드 품질 개선을 포함합니다.

## 변경 파일 목록

### Backend

- `backend/app/api/v1/endpoints/ws.py` - WS 에러 원문 노출 차단, SESSION_NOT_FOUND 코드 추가, Lock 누수 수정
- `backend/app/api/v1/endpoints/workflow.py` - 아티팩트 소유권 검증 추가 (4개 엔드포인트)
- `backend/app/models/session.py` - lazy="selectin" → lazy="raise" (N+1 쿼리 방지)
- `backend/app/repositories/session_repo.py` - list_with_counts JOIN 최적화
- `backend/app/repositories/message_repo.py` - copy_messages INSERT...SELECT 변환
- `backend/app/services/session_manager.py` - fork() 단일 트랜잭션 + update_settings 간소화
- `backend/app/services/claude_runner.py` - event_handler.py 유틸 재사용 + bare except 제거
- `backend/app/services/jsonl_watcher.py` - 문자열 리터럴 → WsEventType 열거형
- `backend/app/services/usage_service.py` - 매직넘버 → 상수 참조
- `backend/app/core/constants.py` - (신규) 매직넘버 30개+ 통합
- `backend/app/schemas/workflow.py` - str → Literal 타입 적용
- `backend/tests/conftest.py` - 누락 테이블 추가

### Frontend

- `frontend/src/features/workflow/hooks/useWorkflow.ts` - annotationId 하드코딩 버그 수정
- `frontend/src/features/chat/components/ChatPanel.tsx` - 컴포넌트 분해 + annotationId 수정
- `frontend/src/features/chat/components/ChatMessageList.tsx` - (신규) 메시지 목록 컴포넌트
- `frontend/src/features/chat/components/ChatDialogs.tsx` - (신규) 다이얼로그 컴포넌트
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - 에러 코드 기반 분기
- `frontend/src/types/session.ts` - "stopped" 유령 상태 제거
- `frontend/src/types/ws-events.ts` - (신규) WS 메시지 discriminated union 타입
- `frontend/src/types/index.ts` - ws-events 재수출
- `frontend/src/features/session/components/SessionDashboardCard.tsx` - stopped 분기 제거
- `frontend/src/features/history/components/HistoryPage.tsx` - stopped 필터 제거

## 상세 변경 내용

### Phase 0: 프론트엔드 치명적 버그 수정

- `useUpdateAnnotation` 훅에서 annotationId가 항상 0으로 하드코딩되어 있던 버그 수정
- mutation 호출 시점에 annotationId를 받도록 변경

### Phase 1: 보안 및 데이터 무결성

- WebSocket 에러 응답에서 Python 예외 원문 노출 차단 → 고정 메시지로 교체
- 워크플로우 아티팩트 4개 엔드포인트에 session_id 소유권 검증 추가
- `_prompt_locks` 딕셔너리 무한 성장 방지 (WS 연결 해제 시 정리)
- conftest.py에 session_artifacts, artifact_annotations 테이블 추가

### Phase 2: FE/BE 타입 안전성 강화

- SessionStatus에서 "stopped" 유령 상태 제거 (BE DB에 없는 상태)
- 한국어 문자열 비교 → 에러 코드("SESSION_NOT_FOUND") 기반 분기
- 워크플로우 스키마 str → Literal 타입 적용 (런타임 검증)
- WebSocket 메시지 discriminated union 타입 정의 (29개 인터페이스)

### Phase 3: DB 성능 핵심 개선

- Session 모델 lazy="selectin" → lazy="raise" (매 로드 시 4개 추가 SELECT 방지)
- list_with_counts 상관 서브쿼리 → outerjoin + subquery 패턴
- copy_messages_to_session 전체 ORM 로드 → INSERT...SELECT 단일 SQL

### Phase 4: SessionManager 리팩토링

- fork() 메서드: 3개 독립 DB 세션 → 단일 트랜잭션 (원자성 보장)
- update_settings: 22줄 if/then 보일러플레이트 → dict comprehension + sentinel 패턴

### Phase 5: 프론트엔드 컴포넌트 분해

- ChatPanel에서 ChatMessageList, ChatDialogs 추출 (685줄 → 639줄)

### Phase 6: 백엔드 코드 품질

- constants.py 생성: 매직넘버 30개+ 통합
- jsonl_watcher.py: 문자열 리터럴 → WsEventType 열거형 통일
- claude_runner.py: event_handler.py 유틸 함수 재사용 (중복 제거)
- bare except 패턴 제거 → 구체적 예외 + 로깅

## 관련 커밋

- `a49a4e5` - Fix: useUpdateAnnotation annotationId 하드코딩 버그 수정
- `9fad5e5` - Fix: 보안 강화 — WS 에러 원문 노출 차단, 아티팩트 소유권 검증, Lock 누수 수정
- `d6dd473` - Refactor: FE/BE 타입 안전성 강화
- `8d04139` - Refactor: DB 성능 개선 — lazy=raise, JOIN 최적화, INSERT...SELECT
- `671a95f` - Refactor: SessionManager — fork() 단일 트랜잭션 + update_settings 간소화
- `3c81a7c` - Refactor: ChatPanel 컴포넌트 분해 — ChatMessageList, ChatDialogs 추출
- `6b15f10` - Refactor: BE 코드 품질 — 상수 통합, WsEventType 통일, 이벤트 핸들링 중복 제거

## 미구현 (향후 작업)

- Phase 4.1: SessionManager God Class 완전 분해 (영향 범위 大)
- Phase 6.1: FilesystemService 분할 (영향 범위 大)
- Phase 7: ServiceRegistry DI 개선
- Phase 8: Text 타임스탬프 → DateTime 마이그레이션
- Phase 9: 테스트 커버리지 확대
- Phase 10: 기타 중간 우선순위

## 비고

- Phase 0.2 (ArtifactViewer 콜백 메모이제이션)는 이미 구현되어 있어 스킵
- Phase 4.1, 6.1, 7은 영향 범위가 크고 위험도가 높아 별도 PR로 분리 권장
