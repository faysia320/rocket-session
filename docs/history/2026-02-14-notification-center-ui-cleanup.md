# 작업 이력: 알림 센터 시스템 + 세션 UI 개선

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

알림 센터(Notification Center) 시스템을 추가하고, 세션 채팅 UI를 개선했습니다.
컨텍스트 윈도우 바를 헤더에서 통계 바로 이동하고, 모델 선택을 opus로 고정, 입력창 힌트를 정리했습니다.

## 변경 파일 목록

### Frontend - 알림 센터

- `frontend/src/features/notification/` - 알림 센터 feature 디렉토리 (새로 추가)
- `frontend/src/types/notification.ts` - 알림 관련 타입 정의
- `frontend/src/types/index.ts` - 알림 타입 barrel export 추가
- `frontend/src/features/chat/components/ChatPanel.tsx` - useNotificationCenter 적용 + 다양한 알림 이벤트 추가
- `frontend/src/features/session/components/Sidebar.tsx` - useNotificationCenter 적용
- `frontend/src/features/settings/components/GlobalSettingsDialog.tsx` - NotificationSettingsPanel 추가
- `frontend/public/` - 알림 사운드 파일

### Frontend - UI 개선

- `frontend/src/features/chat/components/ChatHeader.tsx` - ContextWindowBar 제거
- `frontend/src/features/session/components/SessionStatsBar.tsx` - ContextWindowBar 우측에 추가
- `frontend/src/features/chat/components/ChatInput.tsx` - placeholder 변경 + 하단 힌트 영역 제거
- `frontend/src/features/chat/components/ModelSelector.tsx` - opus 고정 + UI 숨김
- `frontend/src/store/useSessionStore.ts` - split/dashboard 뷰 상호 배제 처리

## 상세 변경 내용

### 1. 알림 센터 시스템

- `useDesktopNotification` 훅을 `useNotificationCenter`로 교체
- 카테고리별 알림 설정 지원 (task.complete, session.start, task.error, input.required)
- 데스크톱 알림 + 사운드 알림 채널 분리
- GlobalSettingsDialog에 알림 설정 패널 통합

### 2. 컨텍스트 윈도우 바 위치 이동

- ChatHeader에서 ContextWindowBar 제거
- SessionStatsBar 우측 끝에 ContextWindowBar 배치 (ml-auto)

### 3. 채팅 입력 UI 정리

- placeholder를 "(Shift+Tab 모드 전환) >.."로 변경
- 입력창 하단의 키보드 단축키 힌트 영역 제거

### 4. 모델 선택기 고정

- ModelSelector를 opus로 고정하고 UI 숨김 처리 (return null)

### 5. 뷰 상호 배제

- splitView와 dashboardView 토글 시 상대 뷰 자동 비활성화

## 테스트 방법

1. TypeScript 타입 검사 통과 확인: `npx tsc -p tsconfig.app.json --noEmit`
2. 채팅 입력창 placeholder 확인
3. 세션 통계 바 우측에 컨텍스트 윈도우 바 표시 확인
4. 알림 설정 다이얼로그에서 카테고리별 설정 확인
