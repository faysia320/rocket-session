# 작업 이력: 디렉토리 즐겨찾기 + work_dir 필수화

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

New Session 생성 시 DirectoryPicker에 즐겨찾기(별) 기능을 추가하고,
work_dir을 필수 입력으로 변경하여 빈 값으로 세션을 생성할 수 없도록 했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/directory/hooks/useFavoriteDirectories.ts` - **(신규)** localStorage 기반 즐겨찾기 CRUD 훅
- `frontend/src/features/directory/components/DirectoryPicker.tsx` - Star/StarOff 즐겨찾기 토글 버튼 추가, placeholder 변경
- `frontend/src/features/directory/components/DirectoryBrowser.tsx` - 즐겨찾기 섹션을 디렉토리 목록 상단에 표시
- `frontend/src/features/session/components/SessionSetupPanel.tsx` - work_dir 필수 검증, 라벨 변경, Create 버튼 disabled 조건

## 상세 변경 내용

### 1. useFavoriteDirectories 훅 (신규)

- localStorage 키 `rocket-session:favorite-dirs`에 JSON 배열로 즐겨찾기 저장
- `favorites`, `isFavorite`, `addFavorite`, `removeFavorite`, `toggleFavorite` 인터페이스 제공
- 경로의 마지막 세그먼트를 폴더명(`name`)으로 자동 추출
- 백엔드 변경 없이 클라이언트에서만 관리

### 2. DirectoryPicker 즐겨찾기 토글

- 입력 필드와 폴더 브라우저 버튼 사이에 Star/StarOff 아이콘 버튼 추가
- value가 비어있으면 버튼 비활성화
- 즐겨찾기 상태에 따라 Star(채워진 별, warning 색상) / StarOff 아이콘 토글
- placeholder를 "Working directory (optional)" -> "Working directory (required)"로 변경

### 3. DirectoryBrowser 즐겨찾기 섹션

- ScrollArea 상단에 "FAVORITES" 라벨과 즐겨찾기 목록 표시
- 각 항목: 별 아이콘 + 폴더명 + 전체 경로 + X(제거) 버튼
- 클릭 시 해당 경로 선택, 더블클릭 시 해당 경로로 이동
- X 버튼으로 즐겨찾기에서 제거 (hover 시에만 표시)
- Separator 컴포넌트로 즐겨찾기와 디렉토리 목록 구분
- 즐겨찾기가 0개이면 섹션 자체 숨김

### 4. SessionSetupPanel work_dir 필수화

- 라벨에 빨간색 `*` 필수 표시 추가
- Create 버튼: `!workDir.trim()` 조건 추가로 빈 값일 때 비활성화
- `onCreate` 호출 시 `workDir || undefined` -> `workDir.trim()` (항상 전달)

## 테스트 방법

1. New Session 페이지에서 work_dir 미입력 시 Create 버튼 비활성화 확인
2. 디렉토리 입력 후 별 아이콘 클릭 -> 즐겨찾기 추가 (별 채워짐)
3. DirectoryBrowser 모달 열기 -> 상단 FAVORITES 섹션에 항목 표시
4. 즐겨찾기 항목 클릭 -> 해당 경로 선택
5. 즐겨찾기 X 버튼 -> 제거
6. 페이지 새로고침 후 즐겨찾기 유지 (localStorage)
