# 작업 이력: 완료 세션 메시지 렌더링 버그 수정

- **날짜**: 2026-03-11
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

완료된 세션 클릭 시 메시지 순서 뒤죽박죽, 스타일 깨짐, 빈 스크롤 현상의 3가지 근본 원인을 파악하고 수정했습니다.

## 변경 파일 목록

### Backend

- `backend/app/repositories/message_repo.py` - 메시지 정렬을 `order_by(id)` → `order_by(timestamp, id)`로 변경 (3곳)

### Frontend

- `frontend/src/features/chat/hooks/reducers/types.ts` - `SessionState`에 `id` 필드 추가
- `frontend/src/features/chat/hooks/reducers/wsMessageHandlers.ts` - 히스토리 메시지 ID에 세션 고유 prefix 추가 (3곳)
- `frontend/src/features/chat/utils/chatComputations.ts` - `assistant_text`/`ask_user_question` estimateSize를 고정값으로 되돌림
- `frontend/src/features/chat/components/ChatPanel.tsx` - virtualizer에 `getItemKey` 옵션 추가 + 세션 전환 시 `measure()` 리셋

## 상세 변경 내용

### 1. React key 충돌 해결 (핵심)

- **문제**: 모든 세션의 히스토리 메시지가 `hist-0`, `hist-1` 같은 동일 ID 사용 → 세션 전환 시 React가 DOM 노드 재사용 → virtualizer 측정 캐시가 스테일 상태로 잔존
- **수정**: 메시지 ID를 `hist-${sessionIdPrefix}-${histIndex}` 형식으로 변경하여 세션별 고유 key 보장
- virtualizer에 `getItemKey` 옵션 추가 및 세션 전환 시 `measure()` 호출로 측정 캐시 강제 초기화

### 2. estimateSize-useDeferredValue 충돌 해결

- **문제**: 동적 텍스트 길이 기반 estimateSize가 `MarkdownRenderer`의 `useDeferredValue`와 타이밍 불일치 → 잘못된 높이 추정
- **수정**: `assistant_text`(120px), `ask_user_question`(180px) 고정값 사용. `measureElement`가 실제 DOM 높이로 교체하므로 안정적

### 3. 백엔드 메시지 정렬 안정화

- **문제**: `order_by(Message.id)` 사용 시 동시 삽입 환경에서 ID 순서 ≠ 시간 순서 가능성
- **수정**: `order_by(Message.timestamp, Message.id)`로 변경. 기존 인덱스 `idx_messages_session_timestamp` 활용

## 테스트 방법

1. 3개 이상의 완료 세션 간 빠르게 전환 → 순서 정상, 스타일 정상, 빈 스크롤 없음
2. 긴 세션(50+ 메시지) → 짧은 세션(5개 메시지) → 빈 공간 없이 렌더링
3. React DevTools에서 세션 전환 후 메시지 key가 세션별로 고유한지 확인
