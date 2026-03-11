# 작업 이력: 성능 개선 Phase 4 — 추가 병목 해소

- **날짜**: 2026-03-11
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

대규모 세션(300+ 메시지, 100+ 세션)에서 발생하는 추가 병목을 해소합니다.
reducer 배열 탐색 O(n)→O(1), virtualizer 높이 추정 동적 계산, 히스토리 페이징,
세션 목록 쿼리 최적화, 이벤트 버퍼 TTL 자동 정리, validation 카운터 누수 방지를 포함합니다.

## 변경 파일 목록

### Backend

- `backend/app/api/v1/endpoints/ws.py` - 초기 연결 시 히스토리 limit=200 적용
- `backend/app/repositories/message_repo.py` - get_by_session에 limit 파라미터 추가
- `backend/app/repositories/session_repo.py` - list_with_counts를 상관 서브쿼리로 최적화
- `backend/app/services/claude_runner.py` - validation_retry_counts 사이즈 제한 및 cleanup 함수 추가
- `backend/app/services/session_manager.py` - get_history limit 전달, 세션 삭제 시 카운터 정리
- `backend/app/services/websocket_manager.py` - 이벤트 버퍼 TTL 5분 자동 정리

### Frontend

- `frontend/src/features/chat/hooks/reducers/types.ts` - _toolUseIdMap 타입 추가
- `frontend/src/features/chat/hooks/reducers/index.ts` - initialState에 _toolUseIdMap 초기화
- `frontend/src/features/chat/hooks/reducers/wsMessageHandlers.ts` - WS_TOOL_USE에서 map 등록, WS_TOOL_RESULT에서 O(1) 조회
- `frontend/src/features/chat/hooks/reducers/uiHandlers.ts` - CLEAR_MESSAGES에서 _toolUseIdMap 초기화
- `frontend/src/features/chat/utils/chatComputations.ts` - estimateSize 텍스트 길이/질문 수 기반 동적 계산

## 상세 변경 내용

### 1. reducer toolUseIdMap 인덱스 맵 (4-1)

- `_toolUseIdMap: Map<string, number>`를 reducer state에 추가
- WS_TOOL_USE 액션에서 tool_use_id → 배열 인덱스를 map에 등록
- WS_TOOL_RESULT에서 map을 이용한 O(1) 조회 (fallback으로 역순 탐색 유지)
- 300+ 메시지 세션에서 tool_result 처리 성능 향상

### 2. estimateSize 동적 계산 (4-2)

- assistant_text: 텍스트 길이 기반 80~600px 동적 높이 추정
- ask_user_question: 질문 수 기반 120 + qCount * 60px 동적 높이
- virtualizer 스크롤 점프 현상 감소

### 3. WebSocket 초기 연결 히스토리 페이징 (4-3)

- get_by_session에 limit 파라미터 추가 (최신 N개 서브쿼리)
- 초기 WS 연결 시 limit=200으로 최신 메시지만 로드
- 1000+ 메시지 세션의 초기 연결 시간 대폭 단축

### 4. 세션 목록 쿼리 최적화 (4-4)

- 전체 테이블 GROUP BY + JOIN → 상관 서브쿼리로 변경
- LIMIT 적용 후 해당 세션들에 대해서만 COUNT 수행
- 100+ 세션 환경에서 목록 API 응답 시간 개선

### 5. 이벤트 버퍼 TTL 자동 정리 (4-5)

- _buffer_last_access로 마지막 접근 시간 추적
- heartbeat 루프에서 5분 미사용 + 활성 연결 없는 버퍼 자동 정리
- 장시간 운영 시 메모리 누수 방지

### 6. validation_retry_counts 무한 증가 방지 (4-6)

- cleanup_validation_retries() 함수 추가, 세션 삭제 시 호출
- 최대 100개 항목 상한 설정, 초과 시 가장 오래된 항목 제거

## 테스트 방법

1. 백엔드 import 검증: `cd backend && uv run python -c "from app.main import app; print('OK')"`
2. 프론트엔드 타입 검사: `cd frontend && npx tsc -p tsconfig.app.json --noEmit`
3. 프론트엔드 빌드: `cd frontend && pnpm build`
4. 300+ 메시지 세션에서 tool_result 수신 시 렌더링 시간 측정
5. 긴 assistant_text → 빠른 스크롤 → 스크롤 점프 여부 확인
6. 1000+ 메시지 세션에서 새 탭 열기 → TTFR 비교
