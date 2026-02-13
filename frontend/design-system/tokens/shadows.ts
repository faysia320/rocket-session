/**
 * Design System - Shadow Tokens
 *
 * 그림자 토큰은 깊이감과 계층 구조를 표현합니다:
 * 1. Elevation Shadows: 기본 그림자 스케일
 * 2. Component Shadows: 컴포넌트별 그림자
 */

// =============================================================================
// Elevation Shadows
// =============================================================================

/**
 * 기본 그림자 스케일
 * 숫자가 클수록 더 높은 elevation (더 강한 그림자)
 */
export const shadow = {
  /** 그림자 없음 */
  none: 'none',
  /** 미세한 그림자 - 카드 테두리 강조 */
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  /** 작은 그림자 - 버튼, 입력 필드 */
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  /** 기본 그림자 - 카드, 패널 */
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  /** 중간 그림자 - 드롭다운, 팝오버 */
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  /** 큰 그림자 - 모달, 다이얼로그 */
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  /** 가장 큰 그림자 - 최상위 오버레이 */
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  /** 내부 그림자 - 인풋 필드 내부 */
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
} as const;

/**
 * 다크 모드용 그림자
 * 다크 모드에서는 그림자가 덜 눈에 띄므로 더 강한 값 사용
 */
export const shadowDark = {
  none: 'none',
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.4)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.4)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.6)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.3)',
} as const;

// =============================================================================
// Component Shadows
// =============================================================================

/**
 * 컴포넌트별 그림자 매핑
 */
export const componentShadow = {
  /** 버튼 hover 시 */
  button: shadow.sm,
  /** 버튼 active 시 */
  buttonPressed: shadow.inner,
  /** 카드 기본 */
  card: shadow.sm,
  /** 카드 hover 시 */
  cardHover: shadow.md,
  /** 드롭다운 메뉴 */
  dropdown: shadow.lg,
  /** 팝오버 */
  popover: shadow.lg,
  /** 모달/다이얼로그 */
  modal: shadow.xl,
  /** 토스트 알림 */
  toast: shadow.lg,
  /** 툴팁 */
  tooltip: shadow.md,
  /** 사이드바 */
  sidebar: shadow.lg,
  /** 입력 필드 focus */
  inputFocus: '0 0 0 2px hsl(var(--ring))',
} as const;

// =============================================================================
// Ring (Focus) Shadows
// =============================================================================

/**
 * 포커스 링 그림자
 * 접근성을 위한 포커스 표시
 */
export const ring = {
  /** 기본 포커스 링 */
  DEFAULT: '0 0 0 2px hsl(var(--ring))',
  /** 얇은 포커스 링 */
  sm: '0 0 0 1px hsl(var(--ring))',
  /** 두꺼운 포커스 링 */
  lg: '0 0 0 3px hsl(var(--ring))',
  /** Primary 색상 포커스 링 */
  primary: '0 0 0 2px hsl(var(--primary))',
  /** Destructive 색상 포커스 링 */
  destructive: '0 0 0 2px hsl(var(--destructive))',
  /** 오프셋이 있는 포커스 링 */
  offset: '0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--ring))',
} as const;

// =============================================================================
// Type Definitions
// =============================================================================

export type ShadowKey = keyof typeof shadow;
export type ComponentShadowKey = keyof typeof componentShadow;
export type RingKey = keyof typeof ring;
