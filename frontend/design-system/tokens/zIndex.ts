/**
 * Design System - Z-Index Tokens
 *
 * z-index 계층 관리를 위한 토큰:
 * 일관된 스택 순서를 유지하기 위해 사용
 */

// =============================================================================
// Z-Index Scale
// =============================================================================

/**
 * z-index 스케일
 * 10 단위로 구성하여 중간에 요소 추가 가능
 */
export const zIndex = {
  /** 기본 (z-index 없음) */
  auto: 'auto',
  /** 가장 뒤 (-1) */
  behind: -1,
  /** 기본 레벨 (0) */
  base: 0,
  /** 약간 위 (10) - 호버된 요소 */
  raised: 10,
  /** 드롭다운 (20) - 메뉴, 콤보박스 */
  dropdown: 20,
  /** 스티키 (30) - 고정 헤더 */
  sticky: 30,
  /** 고정 (40) - 고정 사이드바, 네비게이션 */
  fixed: 40,
  /** 오버레이 배경 (50) - 모달 뒤 어두운 배경 */
  overlay: 50,
  /** 모달/다이얼로그 (60) */
  modal: 60,
  /** 팝오버 (70) - 모달 위에 뜨는 팝오버 */
  popover: 70,
  /** 툴팁 (80) - 가장 위에 표시 */
  tooltip: 80,
  /** 토스트/알림 (90) - 알림 메시지 */
  toast: 90,
  /** 최상위 (100) - 긴급 알림, 로딩 오버레이 */
  max: 100,
} as const;

// =============================================================================
// Component Z-Index Mapping
// =============================================================================

/**
 * 컴포넌트별 z-index 매핑
 */
export const componentZIndex = {
  /** 헤더/상단 네비게이션 */
  header: zIndex.sticky,
  /** 사이드바 */
  sidebar: zIndex.fixed,
  /** 사이드바 오버레이 (모바일) */
  sidebarOverlay: zIndex.overlay,
  /** 탭 바 */
  tabBar: zIndex.raised,
  /** 드롭다운 메뉴 */
  dropdown: zIndex.dropdown,
  /** 셀렉트/콤보박스 목록 */
  select: zIndex.dropdown,
  /** 자동완성 목록 */
  autocomplete: zIndex.dropdown,
  /** 컨텍스트 메뉴 (우클릭) */
  contextMenu: zIndex.dropdown,
  /** 날짜 선택기 */
  datePicker: zIndex.dropdown,
  /** 모달 오버레이 배경 */
  modalOverlay: zIndex.overlay,
  /** 모달 컨텐츠 */
  modal: zIndex.modal,
  /** 시트 (슬라이드 패널) */
  sheet: zIndex.modal,
  /** 다이얼로그 */
  dialog: zIndex.modal,
  /** 알림 다이얼로그 */
  alertDialog: zIndex.modal,
  /** 커맨드 팔레트 */
  commandPalette: zIndex.modal,
  /** 팝오버 */
  popover: zIndex.popover,
  /** 호버 카드 */
  hoverCard: zIndex.popover,
  /** 툴팁 */
  tooltip: zIndex.tooltip,
  /** 토스트/스낵바 */
  toast: zIndex.toast,
  /** 알림 */
  notification: zIndex.toast,
  /** 전체 화면 로딩 */
  loadingOverlay: zIndex.max,
  /** 개발 도구 */
  devTools: zIndex.max,
} as const;

// =============================================================================
// Type Definitions
// =============================================================================

export type ZIndexKey = keyof typeof zIndex;
export type ComponentZIndexKey = keyof typeof componentZIndex;
