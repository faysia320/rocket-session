# 작업 이력: 사용량 뱃지 원형화 + Plan 인라인 표시

- **날짜**: 2026-03-16
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

TopBar 사용량 뱃지를 원형 뱃지로 변경하고 우측 아이콘 영역으로 이동했습니다.
또한 Plan 모드에서 ask_user_question 카드에 직전 Write(Plan 파일) 내용을 인라인 표시하는 기능을 추가했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/layout/components/GlobalTopBar.tsx` - 사용량 뱃지 원형화 + 위치 이동 + 툴팁 추가
- `frontend/src/features/chat/components/AskUserQuestionCard.tsx` - Plan 내용 인라인 Collapsible 표시
- `frontend/src/features/chat/components/ChatMessageContext.tsx` - precedingPlanContents 컨텍스트 추가
- `frontend/src/features/chat/components/ChatMessageList.tsx` - Plan 매핑 계산 및 컨텍스트 전달
- `frontend/src/features/chat/components/MessageBubble.tsx` - planContent prop 전달
- `frontend/src/features/chat/components/MessageBubble.test.tsx` - 테스트 기본값 추가
- `frontend/src/features/chat/utils/chatComputations.ts` - computePrecedingPlanContents 유틸 함수

## 상세 변경 내용

### 1. 사용량 뱃지 원형화

- 기존 Badge 컴포넌트에서 h-8 w-8 원형 span으로 변경 (아이콘 버튼과 동일 크기)
- 뱃지 안에 퍼센트 숫자만 표시 (text-[10px] font-bold)
- 호버 시 툴팁으로 기간(5h/7d) + 남은 시간 표시
- 위치를 중앙에서 우측 아이콘 그룹 맨 왼쪽으로 이동
- Badge import 제거 (미사용)

### 2. Plan 인라인 표시

- ask_user_question 메시지 직전의 Write(plans/ 파일) 내용을 Collapsible로 표시
- Markdown 렌더링 + ScrollArea (최대 300px)
- computePrecedingPlanContents 유틸 함수로 메시지 배열에서 매핑 계산

## 관련 커밋

- (커밋 후 업데이트)

## 테스트 방법

1. TopBar에서 사용량 뱃지가 원형으로 표시되는지 확인
2. 뱃지 호버 시 기간 + 남은 시간 툴팁 확인
3. Plan 모드에서 질문 카드에 Plan 내용이 인라인 표시되는지 확인
