# 작업 이력: ScrollArea 세로 스크롤 버그 수정

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Tool message를 펼쳤을 때 세로 스크롤이 나타나지 않는 버그를 수정했습니다. Radix ScrollArea Viewport의 `height: 100%`가 부모의 `max-height`를 참조하지 못해 발생한 CSS 높이 계산 문제를 flex 레이아웃으로 해결했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/components/ui/scroll-area.tsx` - Root를 flex 컨테이너로 변경, Viewport를 `flex-1 min-h-0`으로 수정
- `frontend/src/features/chat/components/ReadToolMessage.tsx` - 래퍼 div에서 `overflow-hidden` 제거
- `frontend/src/features/chat/components/SearchToolMessage.tsx` - 래퍼 div에서 `overflow-hidden` 제거
- `frontend/src/features/chat/components/WebToolMessage.tsx` - 래퍼 div에서 `overflow-hidden` 제거
- `frontend/src/features/chat/components/SlashCommandPopup.tsx` - 동일 버그 workaround였던 `viewportClassName` 제거

## 상세 변경 내용

### 1. ScrollArea 컴포넌트 핵심 수정

- **근본 원인**: Viewport에 `h-full` (`height: 100%`)이 설정되어 있었으나, 부모 Root에는 `max-height`만 있고 명시적 `height`가 없어 CSS 높이 계산 실패. Viewport가 콘텐츠 크기만큼 팽창하여 내부 overflow가 발생하지 않아 Radix가 세로 스크롤바를 렌더링하지 않음
- **해결**: Root에 `flex flex-col` 추가, Viewport를 `flex-1 min-h-0`으로 변경. Flex 레이아웃에서 `min-h-0`이 부모의 `max-height` 제약을 올바르게 상속받아 Viewport 높이 제한

### 2. Tool message 래퍼 overflow-hidden 제거

- ReadToolMessage, SearchToolMessage, WebToolMessage의 콘텐츠 래퍼 div에서 `overflow-hidden` 제거
- 스크롤바 UI 요소가 잘리는 것을 방지 (`min-w-0`은 유지)

### 3. SlashCommandPopup workaround 정리

- 동일한 ScrollArea 버그를 우회하기 위해 `viewportClassName="max-h-[240px]"`을 중복 적용하던 코드 제거
- 근본 원인이 해결되었으므로 더 이상 불필요

## 테스트 방법

1. Tool message 펼쳐서 긴 Bash 출력 / Read 파일 / Search 결과에서 세로 스크롤바 표시 확인
2. CodeBlock (ReadToolMessage)에서 가로 스크롤바 여전히 동작 확인
3. SlashCommandPopup 스크롤 정상 동작 확인
4. ChatMessageList (메인 채팅 스크롤) 정상 동작 확인

## 비고

- TypeScript 타입 체크, ESLint, Vite 프로덕션 빌드 모두 통과
