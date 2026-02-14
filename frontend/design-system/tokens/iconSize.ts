/**
 * Design System - Icon Size Tokens
 *
 * 아이콘 크기 토큰은 일관된 아이콘 크기를 위해 사용됩니다:
 * 1. Icon Scale: 기본 아이콘 크기 스케일
 * 2. Component Icon Sizes: 컴포넌트별 아이콘 크기 매핑
 */

// =============================================================================
// Icon Size Scale
// =============================================================================

/**
 * 아이콘 크기 스케일 (rem 단위)
 * Lucide Icons 기본 크기 기준
 */
export const iconSize = {
  /** 12px - 아주 작은 아이콘 (뱃지 내부, 인디케이터) */
  xs: '0.75rem',
  /** 14px - 매우 작은 아이콘 (태그, 작은 버튼) */
  sm: '0.875rem',
  /** 16px - 작은 아이콘 (인라인, 버튼 내부) */
  md: '1rem',
  /** 20px - 기본 아이콘 (일반 UI) */
  lg: '1.25rem',
  /** 24px - 큰 아이콘 (네비게이션, 액션) */
  xl: '1.5rem',
  /** 32px - 매우 큰 아이콘 (빈 상태, 강조) */
  '2xl': '2rem',
  /** 40px - 아주 큰 아이콘 (페이지 헤더) */
  '3xl': '2.5rem',
  /** 48px - 특대 아이콘 (빈 상태 일러스트) */
  '4xl': '3rem',
} as const;

/**
 * 아이콘 크기 스케일 (px 값)
 */
export const iconSizePx = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
} as const;

/**
 * Tailwind 클래스 매핑
 * 기존 h-*, w-* 클래스와의 매핑
 */
export const iconSizeClass = {
  xs: 'h-3 w-3', // 12px
  sm: 'h-3.5 w-3.5', // 14px
  md: 'h-4 w-4', // 16px
  lg: 'h-5 w-5', // 20px
  xl: 'h-6 w-6', // 24px
  '2xl': 'h-8 w-8', // 32px
  '3xl': 'h-10 w-10', // 40px
  '4xl': 'h-12 w-12', // 48px
} as const;

// =============================================================================
// Component Icon Size Mapping
// =============================================================================

/**
 * 버튼 내 아이콘 크기
 */
export const buttonIconSize = {
  /** 작은 버튼 (h-7, h-8) */
  sm: iconSize.md, // 16px
  /** 기본 버튼 (h-9, h-10) */
  default: iconSize.md, // 16px
  /** 큰 버튼 (h-11, h-12) */
  lg: iconSize.lg, // 20px
  /** 아이콘 전용 버튼 */
  icon: iconSize.md, // 16px
} as const;

/**
 * 입력 필드 내 아이콘 크기
 */
export const inputIconSize = {
  sm: iconSize.md, // 16px
  default: iconSize.md, // 16px
  lg: iconSize.lg, // 20px
} as const;

/**
 * 메뉴/리스트 아이템 아이콘 크기
 */
export const menuIconSize = {
  /** 드롭다운 메뉴 아이템 */
  dropdown: iconSize.md, // 16px
  /** 사이드바 메뉴 */
  sidebar: iconSize.lg, // 20px
  /** 네비게이션 */
  nav: iconSize.xl, // 24px
} as const;

/**
 * 상태/피드백 아이콘 크기
 */
export const statusIconSize = {
  /** 인라인 상태 표시 */
  inline: iconSize.md, // 16px
  /** 알림/토스트 */
  toast: iconSize.lg, // 20px
  /** 빈 상태 일러스트 */
  empty: iconSize['4xl'], // 48px
  /** 로딩 스피너 */
  spinner: iconSize.md, // 16px
  /** 큰 로딩 스피너 */
  spinnerLg: iconSize.xl, // 24px
} as const;

// =============================================================================
// Type Definitions
// =============================================================================

export type IconSizeKey = keyof typeof iconSize;
export type IconSizePxKey = keyof typeof iconSizePx;
export type IconSizeClassKey = keyof typeof iconSizeClass;
