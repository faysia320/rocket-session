# 작업 이력: 플로팅 버튼 모바일 줄바꿈 개선

- **날짜**: 2026-03-08
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

사이클 완료 시 ChatInput 위에 표시되는 플로팅 액션 버튼들이 모바일에서 글자 단위로 쪼개지는 문제를 수정. 버튼(단어) 단위로 줄바꿈되도록 개선하고, "보관"/"삭제" 같은 2글자 버튼은 절대 쪼개지지 않도록 처리.

## 변경 파일 목록

### Frontend

- `frontend/src/features/workflow/components/WorkflowCompletedActions.tsx` - flex-wrap + whitespace-nowrap + shrink-0 적용

## 상세 변경 내용

### 1. 컨테이너에 flex-wrap 추가

- 기존: `flex items-center justify-center gap-2` (줄바꿈 불가)
- 변경: `flex flex-wrap items-center justify-center gap-2` (버튼 단위 줄바꿈 허용)

### 2. 모든 버튼/뱃지에 whitespace-nowrap shrink-0 추가

- "사이클 완료" 상태 뱃지, "이어서 구현", "새 주제", "보관", "삭제" 버튼 총 5개 요소에 적용
- `whitespace-nowrap`: 버튼 내부 텍스트가 글자 단위로 쪼개지지 않음
- `shrink-0`: flex 축소로 인한 버튼 찌그러짐 방지

## 테스트 방법

1. 모바일 뷰포트(375px)에서 사이클 완료 상태 진입
2. 플로팅 버튼이 버튼 단위로 줄바꿈되는지 확인
3. "보관", "삭제" 텍스트가 쪼개지지 않는지 확인
4. 데스크톱에서는 기존과 동일하게 한 줄 표시되는지 확인
