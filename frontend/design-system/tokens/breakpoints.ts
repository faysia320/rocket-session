/**
 * Design System - Breakpoint Tokens
 *
 * 반응형 디자인을 위한 브레이크포인트 토큰:
 * 1. Breakpoint Scale: 기본 브레이크포인트 스케일
 * 2. Media Query Helpers: 미디어 쿼리 생성 유틸리티
 */

// =============================================================================
// Breakpoint Scale
// =============================================================================

/**
 * 브레이크포인트 스케일 (px 문자열)
 * Tailwind CSS 기본값과 일치
 */
export const breakpoint = {
  /** 640px - 모바일 랜드스케이프 / 작은 태블릿 */
  sm: '640px',
  /** 768px - 태블릿 */
  md: '768px',
  /** 1024px - 작은 데스크탑 / 태블릿 랜드스케이프 */
  lg: '1024px',
  /** 1280px - 데스크탑 */
  xl: '1280px',
  /** 1536px - 와이드 데스크탑 */
  '2xl': '1536px',
} as const;

/**
 * 브레이크포인트 스케일 (px 숫자값)
 */
export const breakpointPx = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// =============================================================================
// Media Query Helpers
// =============================================================================

/**
 * min-width 미디어 쿼리 문자열
 * @example mediaQuery.sm → '@media (min-width: 640px)'
 */
export const mediaQuery = {
  sm: `@media (min-width: ${breakpoint.sm})`,
  md: `@media (min-width: ${breakpoint.md})`,
  lg: `@media (min-width: ${breakpoint.lg})`,
  xl: `@media (min-width: ${breakpoint.xl})`,
  '2xl': `@media (min-width: ${breakpoint['2xl']})`,
} as const;

/**
 * max-width 미디어 쿼리 문자열 (모바일 퍼스트 역방향)
 * @example mediaQueryMax.sm → '@media (max-width: 639px)'
 */
export const mediaQueryMax = {
  sm: `@media (max-width: ${breakpointPx.sm - 1}px)`,
  md: `@media (max-width: ${breakpointPx.md - 1}px)`,
  lg: `@media (max-width: ${breakpointPx.lg - 1}px)`,
  xl: `@media (max-width: ${breakpointPx.xl - 1}px)`,
  '2xl': `@media (max-width: ${breakpointPx['2xl'] - 1}px)`,
} as const;

// =============================================================================
// Container Max Widths
// =============================================================================

/**
 * 컨테이너 최대 너비
 * 각 브레이크포인트에서의 콘텐츠 영역 최대 너비
 */
export const containerMaxWidth = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
  /** 전체 너비 (제한 없음) */
  full: '100%',
  /** 산문용 좁은 너비 */
  prose: '65ch',
} as const;

// =============================================================================
// Responsive Spacing Scales
// =============================================================================

/**
 * 브레이크포인트별 기본 컨테이너 패딩
 * 화면 크기에 따른 여백 조정
 */
export const containerPadding = {
  /** 모바일: 16px */
  base: '1rem',
  /** sm 이상: 24px */
  sm: '1.5rem',
  /** lg 이상: 32px */
  lg: '2rem',
  /** xl 이상: 48px */
  xl: '3rem',
} as const;

// =============================================================================
// Type Definitions
// =============================================================================

export type BreakpointKey = keyof typeof breakpoint;
export type BreakpointPxKey = keyof typeof breakpointPx;
export type ContainerMaxWidthKey = keyof typeof containerMaxWidth;
