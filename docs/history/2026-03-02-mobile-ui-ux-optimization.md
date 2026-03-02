# 작업 이력: 모바일 UI/UX 전면 최적화

- **날짜**: 2026-03-02
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

모바일 환경에서의 사용자 경험을 전면 개선하였습니다. Safe Area 대응, 터치 타겟 확장, 텍스트 가독성 개선, iOS 스크롤 최적화, 입력 키보드 최적화 등 5개 스테이지로 나누어 총 20개 파일을 수정했습니다. 데스크톱 환경에는 영향을 주지 않도록 미디어 쿼리 격리 및 `env()` fallback `0px`을 활용했습니다.

## 변경 파일 목록

### 인프라 (CSS, 설정, 플러그인)

- `frontend/index.html` - `viewport-fit=cover` 추가 (Safe Area 활성화)
- `frontend/tailwind.config.js` - 디자인 시스템 플러그인 등록 (기존 미등록 발견/수정)
- `frontend/design-system/tailwind/plugin.js` - Safe Area 유틸리티 6개 추가 (pt-safe, pb-safe, pl-safe, pr-safe, px-safe, py-safe)
- `frontend/src/index.css` - Safe Area CSS 변수, overscroll-behavior, 모바일 text-2xs 오버라이드, touch-target-expand 유틸리티

### 컴포넌트

- `frontend/src/routes/__root.tsx` - 루트 컨테이너에 `pt-safe px-safe`
- `frontend/src/components/ui/sheet.tsx` - Sheet left/right에 `pt-safe pb-safe`
- `frontend/src/features/chat/components/ChatInput.tsx` - `pb-safe`, 버튼 크기 반응형, `touch-target-expand`, `enterKeyHint="send"`, `autoComplete="off"`
- `frontend/src/features/chat/components/ChatPanel.tsx` - `overscroll-y-contain`
- `frontend/src/features/chat/components/ChatSearchBar.tsx` - `enterKeyHint="search"`, `autoComplete="off"`
- `frontend/src/features/layout/components/GlobalTopBar.tsx` - 사이드바 토글/더보기 버튼 `h-10 w-10`
- `frontend/src/features/memo/components/MemoPanel.tsx` - Safe Area 클래스 + `md:` 리셋, 닫기 버튼 `touch-target-expand`
- `frontend/src/features/session/components/Sidebar.tsx` - 푸터 버튼/FTS 토글 `touch-target-expand`, `enterKeyHint="search"`, `autoComplete="off"`
- `frontend/src/features/knowledge/components/InsightCard.tsx` - 편집/아카이브/삭제 버튼 `touch-target-expand`
- `frontend/src/features/knowledge/components/KnowledgeContent.tsx` - `enterKeyHint="search"`, `autoComplete="off"`
- `frontend/src/features/workflow/components/ArtifactViewer.tsx` - `text-[10px]` → `text-2xs`, `text-[11px]` → `text-xs`
- `frontend/src/features/team/components/TeamTaskCard.tsx` - `text-[10px]` → `text-2xs`
- `frontend/src/features/team/components/TeamSidebar.tsx` - `enterKeyHint="search"`, `autoComplete="off"`
- `frontend/src/features/history/components/HistoryPage.tsx` - `enterKeyHint="search"`, `autoComplete="off"`
- `frontend/src/features/git-monitor/components/GitCommitHistoryTab.tsx` - `enterKeyHint="search"`, `autoComplete="off"`
- `frontend/src/features/settings/components/GlobalSettingsDialog.tsx` - `inputMode="numeric"`

## 상세 변경 내용

### 1. Safe Area & Viewport (Stage 1)

- `viewport-fit=cover`로 웹 콘텐츠를 노치/다이내믹 아일랜드 영역까지 확장
- `env(safe-area-inset-*)` CSS 환경 변수를 Tailwind 유틸리티로 노출 (`pt-safe` 등)
- 루트 컨테이너, Sheet, ChatInput, MemoPanel에 safe area 패딩 적용
- 디자인 시스템 Tailwind 플러그인이 미등록 상태인 것을 발견하여 등록 → z-index, shadow, height 등 기존 커스텀 유틸리티도 함께 활성화

### 2. 터치 타겟 크기 (Stage 2)

- CSS pseudo-element 기법(`touch-target-expand`)으로 시각적 크기 유지 + 터치 영역 44px 확보
- 모바일에서만 적용 (`@media max-width: 767px`)
- 전송/중지 버튼은 직접 크기 확대 (`h-9 w-9 md:h-7 md:w-7`)
- GlobalTopBar 버튼은 항상 `h-10 w-10`으로 확대 (데스크톱도 적용, 기존 h-8이 너무 작음)

### 3. 텍스트 가독성 (Stage 3)

- 모바일에서 `text-2xs` 클래스를 10px → 11px로 상향하는 전역 미디어 쿼리
- 76개 파일, 91건의 `text-2xs` 사용 개소가 일괄 혜택
- 하드코딩된 `text-[10px]`을 `text-2xs`로 변환하여 오버라이드 적용 (ArtifactViewer, TeamTaskCard)

### 4. iOS 스크롤 최적화 (Stage 4)

- `overscroll-behavior: none`으로 Safari 바운스/풀투리프레시 방지
- `-webkit-overflow-scrolling: touch`로 부드러운 모멘텀 스크롤 확보
- ChatPanel에 `overscroll-y-contain`으로 스크롤 체이닝 방지

### 5. 입력 최적화 (Stage 5)

- `enterKeyHint="send"`: 채팅 입력 시 모바일 키보드에 "전송" 버튼 표시
- `enterKeyHint="search"`: 검색 입력 시 모바일 키보드에 "검색" 버튼 표시
- `autoComplete="off"`: 검색/채팅 입력에서 자동완성 팝업 방지
- `inputMode="numeric"`: 숫자 입력 필드에서 숫자 키패드 표시

## 주요 발견 사항

- **커스텀 폰트 스케일**: `text-lg` = 16px (표준 Tailwind 18px이 아님). 따라서 Input/Textarea의 `text-lg md:text-sm` 패턴이 이미 iOS 자동 줌 방지 임계값(16px)을 충족 → 불필요한 변경 방지
- **디자인 시스템 플러그인 미등록**: `design-system/tailwind/plugin.js`가 존재했으나 `tailwind.config.js`에 등록되지 않아 커스텀 유틸리티 전체가 비활성화 상태였음 → 등록하여 활성화

## 관련 커밋

- (커밋 후 업데이트 예정)

## 검증 결과

- `pnpm build` — 성공 (17.28s, 에러 0건)
- `uv run pytest` — 404개 테스트 전체 통과 (28.44s)
- `pnpm lint` — 에러 0건, 경고 26건 (모두 기존 이슈)

## 비고

- 데스크톱 영향 없음: `env()` fallback `0px`, `md:` 리셋, 미디어 쿼리 격리
- Sheet top/bottom 변형은 현재 사용하지 않으나, 향후 추가 시 safe area 패딩 필요 (WARN)
