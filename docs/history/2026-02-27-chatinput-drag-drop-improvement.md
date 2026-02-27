# 작업 이력: ChatInput 드래그 앤 드롭 개선

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Chat Input의 파일 드래그 앤 드롭 UX를 개선했습니다. 오버레이 깜빡임 버그를 수정하고, 파일 타입별 분기 처리(이미지→첨부, 비이미지→파일명 삽입)를 추가했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/chat/components/ChatInput.tsx` - 드래그 앤 드롭 핸들러 전면 개선

## 상세 변경 내용

### 1. 드래그 오버레이 깜빡임 수정

- **원인**: `onDragLeave`가 드롭 존 내 자식 요소 경계마다 발생하여 `isDragOver` 상태가 빠르게 토글됨
- **해결**: `dragCounterRef` (카운터 기반 패턴) 도입
  - `handleDragEnter`: 카운터 증가, 1이 되면 오버레이 표시
  - `handleDragLeave`: 카운터 감소, 0이 되면 오버레이 숨김
  - `handleDrop`: 카운터 0으로 리셋
  - `handleDragOver`: `setIsDragOver(true)` 제거, `e.preventDefault()`만 유지

### 2. 파일 타입별 분기 처리

- **이미지 파일**: 기존 `addImages()` 플로우 유지 (업로드 → 미리보기 첨부)
- **비이미지 파일**: `file.name`을 input 텍스트에 삽입 (코드 참조용)
  - 기존 텍스트 뒤에 공백 구분자 + 파일명 append
  - `requestAnimationFrame`으로 textarea 높이 자동 재조정

### 3. 오버레이 UI 갱신

- 아이콘: `Image` → `Upload` (모든 파일 타입 수용 반영)
- 텍스트: "이미지를 여기에 놓으세요" → "파일을 여기에 놓으세요"

## 테스트 방법

1. 이미지 파일을 Chat Input 영역에 드래그 → 오버레이가 깜빡임 없이 안정적 표시 확인
2. 이미지 드롭 → 미리보기 썸네일 표시 확인
3. `.ts`, `.py` 등 비이미지 파일 드롭 → 파일명이 input에 삽입 확인
4. 이미지 + 비이미지 혼합 드롭 → 각각 올바르게 분리 처리 확인
5. 파일 드롭 시 브라우저가 파일을 열지 않는지 확인
