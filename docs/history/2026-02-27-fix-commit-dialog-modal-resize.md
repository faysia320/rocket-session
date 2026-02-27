# 작업 이력: CommitDialog 모달 사이즈 버그 수정

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

CommitDialog 모달에서 워크플로우 Select의 긴 텍스트가 모달 너비를 밀어내는 버그를 수정했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/git-monitor/components/CommitDialog.tsx` - DialogContent에 overflow-hidden 추가
- `frontend/src/features/workflow/components/WorkflowDefinitionSelector.tsx` - SelectTrigger에 min-w-0 추가, SelectValue를 truncate span으로 감싸기

## 상세 변경 내용

### 1. 모달 overflow 제한

- `DialogContent`에 `overflow-hidden` 클래스를 추가하여 grid 아이템이 `min-width: auto`로 인해 콘텐츠 크기만큼 확장되는 것을 방지

### 2. Select 텍스트 truncate 처리

- `SelectTrigger`에 `min-w-0` 추가하여 flex 아이템의 최소 너비 제약 해제
- `SelectValue`를 `truncate` 클래스가 적용된 `<span>`으로 감싸 긴 텍스트가 잘리도록 처리

## 관련 커밋

- (이 문서와 함께 커밋 예정)

## 비고

- 원인: CSS Grid의 `min-width: auto` 기본값으로 인해 Select의 긴 콘텐츠가 모달의 `max-w-md` 제약을 무시하고 확장
