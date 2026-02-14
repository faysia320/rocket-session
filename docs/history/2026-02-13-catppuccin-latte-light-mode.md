# 작업 이력: Catppuccin Latte 라이트 모드 및 안정성 개선

- **날짜**: 2026-02-13
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Catppuccin Latte 기반의 라이트 모드를 추가하고, Sidebar 하단에 테마 전환 버튼을 배치했습니다.
또한 WebSocket 브로드캐스트 안정성과 Vite 프록시 에러 핸들링을 개선했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/websocket_manager.py` - WebSocket 연결 상태 검증 및 로깅 추가

### Frontend

- `frontend/src/index.css` - CSS 변수 재구조화 (`:root` = Catppuccin Latte, `.dark` = Deep Space)
- `frontend/src/App.tsx` - `next-themes` ThemeProvider 래핑 추가
- `frontend/src/features/session/components/Sidebar.tsx` - 테마 토글 버튼 (Sun/Moon) 추가
- `frontend/vite.config.ts` - WebSocket 프록시 에러 핸들링 추가

## 상세 변경 내용

### 1. Catppuccin Latte 라이트 모드 (CSS 변수 재구조화)

- `:root`에 Catppuccin Latte(라이트) HSL 변수 배치
- `.dark`에 기존 Deep Space(다크) HSL 변수 이동
- 레거시 hex 변수도 라이트/다크 분리
- 그림자 값을 테마별로 차등 적용 (라이트는 가벼운 그림자, 다크는 깊은 그림자)
- body에 `transition: background-color 0.3s ease` 추가로 부드러운 전환

### 2. ThemeProvider 설정

- `next-themes` (이미 설치됨)의 `ThemeProvider`를 App 최상위에 추가
- `defaultTheme="dark"`: 기존 다크 테마를 기본값으로 유지
- `attribute="class"`: `tailwind.config.js`의 `darkMode: ['class']`와 연동
- `enableSystem={false}`: OS 테마 따르지 않고 명시적 전환만 허용

### 3. 테마 토글 버튼

- Sidebar footer에 Sun/Moon 아이콘 토글 버튼 추가
- `useTheme()` 훅으로 현재 테마 상태 읽기/전환
- `aria-label="테마 변경"` 접근성 속성 포함
- localStorage를 통한 테마 상태 자동 유지

### 4. WebSocket 브로드캐스트 안정성 개선

- `WebSocketState.CONNECTED` 상태 검증 후 전송
- 빈 연결 목록 조기 반환으로 불필요한 순회 방지
- `has_connections()` 헬퍼 메서드 추가
- 로깅 인프라 추가

### 5. Vite WS 프록시 에러 핸들링

- `ECONNABORTED`, `ECONNRESET` 에러 무시 (정상적인 연결 종료)
- 기타 프록시 에러만 콘솔에 출력

## 테스트 방법

1. `cd frontend && pnpm dev`로 개발 서버 시작
2. Sidebar 하단 Sun/Moon 버튼 클릭으로 테마 전환 확인
3. 페이지 새로고침 후 선택한 테마 유지 확인
4. 라이트 모드에서 모든 영역 가독성 확인
