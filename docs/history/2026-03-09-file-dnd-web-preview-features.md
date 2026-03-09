# 작업 이력: 파일 D&D 코드 블록 삽입 + 플로팅 웹 프리뷰 기능

- **날짜**: 2026-03-09
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

[superset-sh/superset](https://github.com/superset-sh/superset) 레포를 분석하여 Rocket Session에 적합한 2개 기능을 선별·구현했습니다:
1. **파일 D&D 코드 블록 삽입**: 텍스트 파일 드래그 앤 드롭 시 파일 내용을 fenced code block으로 채팅 입력란에 자동 삽입
2. **플로팅 웹 프리뷰 패널**: MemoPanel 패턴을 재사용한 드래그/리사이즈 가능한 플로팅 iframe 프리뷰 윈도우

## 변경 파일 목록

### Frontend (신규)

- `frontend/src/features/chat/utils/fileLanguageMap.ts` - 확장자→언어 매핑, 텍스트 안전 파일 판별, 최대 파일 크기 상수
- `frontend/src/store/usePreviewStore.ts` - Zustand persist 스토어 (위치/크기 영속, URL은 에페메럴)
- `frontend/src/features/preview/components/WebPreviewPanel.tsx` - 플로팅 드래그/리사이즈 iframe 프리뷰 컴포넌트

### Frontend (수정)

- `frontend/src/features/chat/components/ChatInput.tsx` - handleDrop async 전환, 코드 블록 삽입, externalIsDragOver/dropHandlerRef props
- `frontend/src/features/chat/components/ChatPanel.tsx` - 패널 전체 드롭존, handleOpenPreview 콜백
- `frontend/src/features/chat/components/BashToolMessage.tsx` - LOCALHOST_URL_REGEX, URL 칩 버튼
- `frontend/src/features/chat/components/MessageBubble.tsx` - onOpenPreview prop 전달
- `frontend/src/features/chat/components/ChatMessageList.tsx` - onOpenPreview prop 전달
- `frontend/src/features/chat/components/ChatHeader.tsx` - Globe 토글 버튼
- `frontend/src/routes/__root.tsx` - WebPreviewPanel lazy import + 글로벌 마운트
- `frontend/src/store/index.ts` - usePreviewStore re-export

## 상세 변경 내용

### 1. 파일 D&D 코드 블록 삽입 (Feature A)

- **fileLanguageMap.ts**: ~48개 확장자→언어 매핑(EXT_TO_LANG), TEXT_SAFE_EXTENSIONS 화이트리스트, TEXT_SAFE_NAMES(확장자 없는 파일), MAX_TEXT_FILE_SIZE(500KB)
- **ChatInput.tsx handleDrop**: async로 전환. 이미지/비이미지 분리 후, 비이미지 파일에 대해:
  - `isTextSafeFile()` 검증 → 바이너리는 파일명만 삽입
  - 500KB 초과 시 `toast.warning` + 파일명만 삽입
  - `file.text()` → fenced code block (`` ```lang\ncontent\n``` ``) 삽입
- **ChatPanel.tsx 패널 드롭존**: dragCounter 패턴으로 패널 전체에 D&D 오버레이 표시, chatInputDropRef를 통해 ChatInput의 handleDrop에 위임

### 2. 플로팅 웹 프리뷰 패널 (Feature B)

- **usePreviewStore.ts**: Zustand + persist. position/size만 localStorage 영속화. openPreview/closePreview/setUrl/setPosition/setSize 액션
- **WebPreviewPanel.tsx**: MemoPanel 패턴 그대로 적용
  - PointerEvents API 기반 드래그(헤더) + 리사이즈(우하단 코너)
  - 네비게이션 바: 뒤로/앞으로/새로고침/URL 입력/외부 브라우저 열기
  - iframe sandbox: `allow-scripts allow-same-origin allow-forms allow-popups allow-modals`
  - 모바일: fullscreen(inset-0), 드래그/리사이즈 비활성화
  - z-index 54 (MemoPanel 55 아래)
- **BashToolMessage.tsx**: `LOCALHOST_URL_REGEX`로 Bash 출력에서 localhost URL 자동 감지, Globe 아이콘 칩 버튼으로 렌더링
- **ChatHeader.tsx**: Globe 토글 버튼으로 프리뷰 열기/닫기
- **__root.tsx**: WebPreviewPanel을 MemoPanel과 나란히 글로벌 마운트

## 설계 결정

| 결정 | 선택 | 이유 |
|------|------|------|
| 프리뷰 패널 형태 | 플로팅 윈도우 (MemoPanel 패턴) | 인라인 패널은 크기 제약이 심함. 기존 MemoPanel 패턴 재사용으로 새 의존성 불필요 |
| 상태 관리 | Zustand 글로벌 스토어 | 여러 컴포넌트(ChatHeader, BashToolMessage, __root)에서 접근 필요. Prop drilling 회피 |
| 파일 안전성 | 화이트리스트 방식 | 바이너리 파일 실수 방지. 알려진 텍스트 확장자만 읽기 시도 |
| URL 감지 대상 | localhost/127.0.0.1 (포트 필수) | 개발 서버 URL만 감지. 외부 URL 오탐 방지 |

## 관련 커밋

- `<hash>` - Feat: Add 파일 D&D 코드 블록 삽입 기능
- `<hash>` - Feat: Add 플로팅 웹 프리뷰 패널 기능

## 테스트 방법

### Feature A: 파일 D&D
1. 채팅 패널에 `.ts`, `.py`, `.json` 등 텍스트 파일을 드래그 앤 드롭
2. 채팅 입력란에 fenced code block으로 파일 내용이 삽입되는지 확인
3. `.pdf`, `.zip` 등 바이너리 파일 드롭 시 파일명만 삽입되는지 확인
4. 500KB 초과 파일 드롭 시 경고 토스트 + 파일명만 삽입 확인

### Feature B: 웹 프리뷰
1. ChatHeader의 Globe 버튼 클릭으로 프리뷰 패널 열기/닫기
2. URL 입력란에 `http://localhost:3000` 입력 후 Enter → iframe 로드 확인
3. 헤더 드래그로 패널 이동, 우하단 코너로 리사이즈 확인
4. Bash 출력에 localhost URL이 있을 때 칩 버튼 표시 → 클릭 시 프리뷰 열기

## 비고

- `pnpm build` 통과 (22.78s, 에러 없음)
- 새 외부 의존성 없음 (모든 기능이 기존 라이브러리 + 패턴으로 구현)
- QA 코드 리뷰 결과: 42/46 PASS, 4 WARN, 0 FAIL
