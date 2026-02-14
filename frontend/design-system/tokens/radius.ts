/**
 * Design System - Border Radius Tokens
 *
 * 둥근 모서리 토큰은 일관된 모서리 처리를 위해 사용됩니다:
 * 1. Radius Scale: 기본 반경 스케일
 * 2. Component Radius: 컴포넌트별 반경 규칙
 */

// =============================================================================
// Radius Scale
// =============================================================================

/**
 * 기본 반경 스케일
 * base(--radius)는 0.5rem (8px) 기준
 */
export const radius = {
  /** 0px - 각진 모서리 */
  none: '0',
  /** 2px - 미세한 둥글기 */
  sm: '0.125rem',
  /** 4px - 작은 둥글기 (기본 - 2px) */
  md: '0.25rem',
  /** 6px - 중간 둥글기 */
  DEFAULT: '0.375rem',
  /** 8px - 기본 둥글기 (--radius) */
  lg: '0.5rem',
  /** 12px - 큰 둥글기 */
  xl: '0.75rem',
  /** 16px - 매우 큰 둥글기 */
  '2xl': '1rem',
  /** 24px - 아주 큰 둥글기 */
  '3xl': '1.5rem',
  /** 완전한 원형 (pill) */
  full: '9999px',
} as const;

/**
 * 반경 스케일 (px 값)
 */
export const radiusPx = {
  none: 0,
  sm: 2,
  md: 4,
  DEFAULT: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
} as const;

// =============================================================================
// Component Radius (컴포넌트별 반경)
// =============================================================================

/**
 * 버튼 반경
 */
export const buttonRadius = {
  /** 작은 버튼 */
  sm: radius.md, // 4px
  /** 기본 버튼 */
  md: radius.DEFAULT, // 6px
  /** 큰 버튼 */
  lg: radius.lg, // 8px
  /** 아이콘 버튼 (원형) */
  icon: radius.DEFAULT, // 6px
  /** 완전 둥근 버튼 */
  pill: radius.full,
} as const;

/**
 * Input 반경
 */
export const inputRadius = {
  /** 작은 인풋 */
  sm: radius.sm, // 2px
  /** 기본 인풋 */
  md: radius.md, // 4px
  /** 큰 인풋 */
  lg: radius.DEFAULT, // 6px
} as const;

/**
 * Card 반경
 */
export const cardRadius = {
  /** 작은 카드 */
  sm: radius.DEFAULT, // 6px
  /** 기본 카드 */
  md: radius.lg, // 8px
  /** 큰 카드 */
  lg: radius.xl, // 12px
} as const;

/**
 * 모달/다이얼로그 반경
 */
export const dialogRadius = {
  /** 기본 모달 */
  DEFAULT: radius.xl, // 12px
  /** 큰 모달 */
  lg: radius['2xl'], // 16px
} as const;

/**
 * 뱃지/태그 반경
 */
export const badgeRadius = {
  /** 기본 뱃지 */
  DEFAULT: radius.md, // 4px
  /** 둥근 뱃지 */
  pill: radius.full,
} as const;

/**
 * 툴팁/팝오버 반경
 */
export const popoverRadius = {
  /** 기본 */
  DEFAULT: radius.lg, // 8px
} as const;

/**
 * 아바타 반경
 */
export const avatarRadius = {
  /** 사각형 */
  square: radius.DEFAULT, // 6px
  /** 둥근 사각형 */
  rounded: radius.lg, // 8px
  /** 원형 */
  circle: radius.full,
} as const;

// =============================================================================
// CSS Variable Integration
// =============================================================================

/**
 * Tailwind/Shadcn 호환 CSS 변수 값
 * calc(var(--radius) - Npx) 형식
 */
export const cssVarRadius = {
  /** var(--radius) = 0.5rem (8px) */
  lg: 'var(--radius)',
  /** calc(var(--radius) - 2px) = 6px */
  md: 'calc(var(--radius) - 2px)',
  /** calc(var(--radius) - 4px) = 4px */
  sm: 'calc(var(--radius) - 4px)',
} as const;

// =============================================================================
// Type Definitions
// =============================================================================

export type RadiusKey = keyof typeof radius;
export type RadiusPxKey = keyof typeof radiusPx;
