# 작업 이력: Virtualizer 메시지 겹침/빈 공간 버그 수정

- **날짜**: 2026-03-11
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

285개 메시지 세션에서 발생하던 메시지 겹침 및 빈 공간 렌더링 버그를 수정했습니다.
근본 원인은 `useVirtualizer`가 부모 컴포넌트(ChatPanel)에 위치하고 렌더링은 자식(ChatMessageList)에서 수행되어,
`measureElement` 콜백이 높이를 측정해도 React가 자식 DOM을 업데이트하지 않는 구조적 문제였습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/chat/components/ChatMessageList.tsx` - useVirtualizer를 이 컴포넌트로 이동, forwardRef + useImperativeHandle 패턴 적용
- `frontend/src/features/chat/components/ChatPanel.tsx` - virtualizer 직접 사용 제거, messageListRef를 통한 간접 호출로 변경
- `frontend/src/features/chat/hooks/useChatSearch.ts` - virtualizer 파라미터를 scrollToIndex 콜백으로 교체
- `frontend/src/components/ui/MarkdownRenderer.tsx` - useDeferredValue 제거 (이중 렌더링으로 인한 높이 불일치 해소)

## 상세 변경 내용

### 1. useVirtualizer를 ChatMessageList로 이동 (근본 원인 해결)

- **문제**: useVirtualizer가 ChatPanel에 있고, 가상 아이템 렌더링은 ChatMessageList에서 수행. measureElement ref 콜백이 높이를 측정하면 virtualizer의 내부 state가 업데이트되지만, React는 ChatPanel만 re-render하고 ChatMessageList의 DOM은 갱신하지 않음
- **해결**: useVirtualizer를 ChatMessageList 내부로 이동하여 측정과 렌더링이 같은 컴포넌트에서 발생하도록 수정
- forwardRef + useImperativeHandle로 scrollToIndex, measure, getTotalSize 메서드를 부모에 노출

### 2. estimateSize / getItemKey 참조 안정화

- useCallback + messagesRef 패턴으로 함수 참조를 안정적으로 유지
- TanStack Virtual 내부 memo (getMeasurementOptions)가 불필요하게 무효화되는 것을 방지

### 3. messageGaps 스트리밍 동결 제거

- 스트리밍 중 stale gaps 배열 반환 → 길이 불일치로 undefined 패딩 발생
- 항상 messages와 동기화되도록 변경 (O(n) 단순 map, 성능 영향 없음)

### 4. MarkdownRenderer useDeferredValue 제거

- useDeferredValue로 인한 이중 렌더링이 virtualizer 높이 추정과 충돌
- memo() + LRU 캐시로 성능 보전

### 5. 세션 전환 시에만 measure() 호출

- 마운트 시 measure() 호출이 초기 측정 캐시를 파괴하는 문제 방지
- prevSessionIdRef로 실제 세션 전환만 감지

### 6. 스트리밍 중 자동 스크롤 개선

- totalSize 변경 감지 interval로 하단 고정 (콘텐츠 높이 증가 시 자동 스크롤)

## 테스트 방법

1. 285개 메시지 세션 접속: `http://localhost:8100/session/6797a175-4ec6-44`
2. 전체 스크롤 범위에서 메시지 겹침/빈 공간 없는지 확인
3. 195개 메시지 세션도 동일하게 확인
4. Playwright E2E: 전체 스크롤 순회하며 translateY + actualHeight 일관성 검증 → 0건 이슈

## 비고

- E2E 테스트 결과: 두 세션 모두 겹침 0건, 빈 공간 0건 확인
- TypeScript 타입 검사 통과, 프로덕션 빌드 성공
