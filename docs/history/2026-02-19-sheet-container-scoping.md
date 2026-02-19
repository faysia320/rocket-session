# 작업 이력: Sheet Drawer 컨테이너 스코핑 및 Badge 겹침 수정

- **날짜**: 2026-02-19
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Split View에서 Sheet(Drawer)가 앱 전체가 아닌 포커스된 세션 패널 내부에서 열리도록 개선하고, File Changes 헤더의 Badge와 Sheet 닫기 버튼(X) 겹침 이슈를 해결했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/components/ui/sheet.tsx` - SheetContent에 container prop 추가, container 지정 시 fixed → absolute 전환
- `frontend/src/features/chat/components/ChatPanel.tsx` - panelRef 생성 + 루트 div에 relative 추가 + portalContainer 전달
- `frontend/src/features/chat/components/ChatHeader.tsx` - portalContainer prop 추가, SessionSettings와 File Changes Sheet에 전달
- `frontend/src/features/session/components/SessionSettings.tsx` - portalContainer prop 추가, SheetContent에 container 전달
- `frontend/src/features/files/components/FilePanel.tsx` - 헤더 pr-12 추가로 X 닫기 버튼 겹침 방지
- `frontend/src/routes/__root.tsx` - split view 포커스 표시를 ring에서 outline으로 변경

## 상세 변경 내용

### 1. Sheet container prop 지원

- Radix Dialog Portal의 `container` prop을 활용하여 Sheet를 특정 DOM 요소 내부에 렌더링
- container 지정 시 overlay/content의 `fixed` 포지셔닝을 `absolute`로 전환
- container 미지정 시 기존 동작 유지 (document.body Portal)

### 2. ChatPanel에서 container ref 전달

- `panelRef`를 생성하여 루트 div에 부착
- `relative` 클래스 추가로 absolute 포지셔닝 기준점 설정
- `portalContainer={panelRef.current}`를 ChatHeader에 전달

### 3. FilePanel Badge 겹침 해결

- FilePanel 헤더에 `pr-12` (48px) 추가
- Sheet X 닫기 버튼(right-4, 16px) 영역을 확보하여 Badge와의 겹침 방지

### 4. Split view 포커스 스타일 변경

- `ring-1 ring-inset ring-primary/30` → `outline outline-1 -outline-offset-1 outline-primary/40`

## 관련 커밋

- 단일 커밋으로 통합

## 테스트 방법

1. 일반 모드에서 Settings/File Changes Sheet 열기 → 패널 내부 우측에서 열리는지 확인
2. Split View에서 패널 클릭 후 Sheet 열기 → 해당 패널 내부에서만 열리는지 확인
3. File Changes Sheet에서 Badge와 X 버튼이 겹치지 않는지 확인
