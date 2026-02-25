# 작업 이력: Office 기능 완전 제거

- **날짜**: 2026-02-25
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Canvas 기반 2D 가상 오피스 시각화 기능(Office)을 코드베이스에서 완전히 제거했습니다. Office는 프론트엔드 전용 기능으로 백엔드 의존성이 없으므로, 프론트엔드 코드와 문서에서만 제거 작업을 수행했습니다.

## 변경 파일 목록

### Frontend - 삭제

- `frontend/src/features/office/` - Office 기능 디렉토리 전체 (17개 파일)
  - `components/OfficeView.tsx` - 메인 컨테이너
  - `components/OfficeCanvas.tsx` - Canvas 렌더러
  - `components/OfficeToolbar.tsx` - 줌/라벨 컨트롤
  - `components/OfficeOverlay.tsx` - 빈 상태 오버레이
  - `engine/OfficeEngine.ts` - Canvas 2D 렌더링 엔진
  - `engine/AgentRenderer.ts` - 캐릭터 스프라이트
  - `engine/TileMap.ts` - 타일맵 렌더러
  - `engine/Camera.ts` - 카메라 컨트롤러
  - `engine/themeReader.ts` - CSS 테마 리더
  - `hooks/useOfficeStore.ts` - Zustand 상태 스토어
  - `hooks/useAgentSync.ts` - 세션→에이전트 동기화
  - `layouts/defaultLayout.ts` - 기본 레이아웃 설정
  - `sprites/characters.ts`, `effects.ts`, `furniture.ts` - 스프라이트
  - `types/office.ts` - 타입 정의
  - `utils/activityMapping.ts` - 툴→활동 매핑
- `frontend/src/routes/office.tsx` - Office 라우트 파일

### Frontend - 수정

- `frontend/src/features/layout/components/GlobalTopBar.tsx` - NAV_ITEMS에서 Office 항목 및 Building2 import 제거
- `frontend/src/routes/__root.tsx` - OfficeView import, isOfficeArea 변수, OfficeLayout 컴포넌트 제거
- `frontend/src/routeTree.gen.ts` - TanStack Router 자동 재생성

### 문서

- `claude.md` - 디렉토리 트리에서 office 항목 제거
- `README.md` - 디렉토리 트리에서 office 항목 제거

## 상세 변경 내용

### 1. Office 기능 디렉토리 삭제

- `frontend/src/features/office/` 전체 삭제 (17개 파일)
- Canvas 기반 렌더링 엔진, 스프라이트 시스템, Zustand 스토어 등 모두 포함

### 2. 네비게이션 참조 제거

- `GlobalTopBar.tsx`: NAV_ITEMS 배열에서 Office 항목 제거, lucide-react의 Building2 아이콘 import 제거

### 3. 라우팅 참조 제거

- `__root.tsx`: OfficeView lazy import, isOfficeArea 변수, 조건부 렌더링, OfficeLayout 함수 정의 제거
- `routes/office.tsx` 삭제 후 routeTree.gen.ts 자동 재생성

## 관련 커밋

- (커밋 후 업데이트 예정)

## 비고

- Office는 세션 데이터를 읽기만 하는 프론트엔드 전용 기능이므로 백엔드 변경 불필요
- localStorage의 `rocket-office-store` 키는 자연스럽게 사용되지 않게 됨
- Command Palette에 Office 전용 명령은 없었으므로 추가 정리 불필요
