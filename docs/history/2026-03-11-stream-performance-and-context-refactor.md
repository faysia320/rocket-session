# 작업 이력: 스트림 처리 성능 최적화 및 ChatMessageContext 리팩토링

- **날짜**: 2026-03-11
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

백엔드 스트림 처리 파이프라인의 성능을 최적화하고, 프론트엔드 MessageBubble 컴포넌트의 props를 Context로 분리하여 불필요한 리렌더링을 줄였습니다.

## 변경 파일 목록

### Backend

- `backend/app/repositories/event_repo.py` - payload_json 사전 직렬화 재사용, INSERT 시 payload_json 키 제거
- `backend/app/repositories/file_change_repo.py` - add_batch 배치 저장 메서드 추가
- `backend/app/services/claude_runner.py` - 청크 단위 스트림 읽기, 병렬 DB 호출, JSON 사전 직렬화
- `backend/app/services/session_manager.py` - 파일 변경 배치 처리 큐/플러시 시스템 추가
- `backend/app/services/websocket_manager.py` - broadcast 메서드 추가 (dict → JSON 직렬화 분리)

### Frontend

- `frontend/src/features/chat/components/ChatMessageContext.tsx` - ChatMessageContext 생성 (신규)
- `frontend/src/features/chat/components/MessageBubble.tsx` - 12개 props → Context 소비로 전환
- `frontend/src/features/chat/components/ChatMessageList.tsx` - Context.Provider 래핑, props 전달 제거
- `frontend/src/features/chat/components/MessageBubble.test.tsx` - Context wrapper 적용
- `frontend/src/components/ui/MarkdownRenderer.tsx` - LRU 렌더링 캐시 추가 (AST 재파싱 방지)
- `frontend/src/features/chat/components/AssistantText.tsx` - memo 래핑 추가

## 상세 변경 내용

### 1. 백엔드 스트림 읽기 최적화

- `_AsyncStreamReader`를 라인별 readline에서 64KB 청크 단위 읽기로 전환
- 스레드풀 호출 횟수를 대폭 줄여 I/O 오버헤드 감소

### 2. 백엔드 DB 호출 병렬화 및 배치 처리

- `_finalize_turn`에서 메시지/이벤트/파일변경 저장을 `asyncio.gather`로 병렬 실행
- 이벤트의 JSON payload를 사전 직렬화하여 중복 직렬화 방지
- 파일 변경 기록을 큐에 모아 배치로 DB 저장

### 3. MessageBubble Context 분리

- 12개의 콜백/상태 props를 `ChatMessageContext`로 이동
- virtualizer 리스트에서 각 MessageBubble에 props를 일일이 전달하지 않아도 됨
- Context가 변경되지 않는 한 MessageBubble의 memo가 리렌더링을 방지

### 4. MarkdownRenderer 렌더링 캐시

- `useRef`로 인스턴스별 LRU 캐시(128개) 유지
- 동일 content에 대해 ReactMarkdown AST 재파싱 건너뜀
- 스트리밍 중에는 content가 매번 변하므로 정상 렌더링, 완료 후 캐시 히트

## 관련 커밋

- (커밋 후 업데이트)

## 비고

- main 브랜치 직접 커밋 (성능 최적화 + 리팩토링)
