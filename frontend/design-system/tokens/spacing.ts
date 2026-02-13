/**
 * Design System - Spacing Tokens
 *
 * 간격 토큰은 일관된 여백과 간격을 위해 사용됩니다:
 * 1. Space Scale: 기본 간격 스케일 (4px 기반)
 * 2. Component Spacing: 컴포넌트별 간격 규칙
 * 3. Layout Spacing: 레이아웃 간격 규칙
 */

// =============================================================================
// Space Scale (4px 기반)
// =============================================================================

/**
 * 기본 간격 스케일 (rem 단위)
 * 4px 그리드 시스템 기반
 */
export const space = {
  /** 0px */
  0: '0',
  /** 1px */
  px: '1px',
  /** 2px (0.5 * 4px) */
  0.5: '0.125rem',
  /** 4px (1 * 4px) */
  1: '0.25rem',
  /** 6px (1.5 * 4px) */
  1.5: '0.375rem',
  /** 8px (2 * 4px) */
  2: '0.5rem',
  /** 10px (2.5 * 4px) */
  2.5: '0.625rem',
  /** 12px (3 * 4px) */
  3: '0.75rem',
  /** 14px (3.5 * 4px) */
  3.5: '0.875rem',
  /** 16px (4 * 4px) */
  4: '1rem',
  /** 20px (5 * 4px) */
  5: '1.25rem',
  /** 24px (6 * 4px) */
  6: '1.5rem',
  /** 28px (7 * 4px) */
  7: '1.75rem',
  /** 32px (8 * 4px) */
  8: '2rem',
  /** 36px (9 * 4px) */
  9: '2.25rem',
  /** 40px (10 * 4px) */
  10: '2.5rem',
  /** 44px (11 * 4px) */
  11: '2.75rem',
  /** 48px (12 * 4px) */
  12: '3rem',
  /** 56px (14 * 4px) */
  14: '3.5rem',
  /** 64px (16 * 4px) */
  16: '4rem',
  /** 80px (20 * 4px) */
  20: '5rem',
  /** 96px (24 * 4px) */
  24: '6rem',
} as const;

/**
 * 간격 스케일 (px 값)
 */
export const spacePx = {
  0: 0,
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

// =============================================================================
// Component Spacing (컴포넌트별 간격)
// =============================================================================

/**
 * 버튼 패딩
 */
export const buttonPadding = {
  /** 아이콘 전용 버튼 */
  icon: {
    x: space[2], // 8px
    y: space[2], // 8px
  },
  /** 작은 버튼 */
  sm: {
    x: space[3], // 12px
    y: space[1.5], // 6px
  },
  /** 기본 버튼 */
  md: {
    x: space[4], // 16px
    y: space[2], // 8px
  },
  /** 큰 버튼 */
  lg: {
    x: space[6], // 24px
    y: space[3], // 12px
  },
} as const;

/**
 * Input 패딩
 */
export const inputPadding = {
  /** 작은 인풋 */
  sm: {
    x: space[2], // 8px
    y: space[1], // 4px
  },
  /** 기본 인풋 */
  md: {
    x: space[3], // 12px
    y: space[2], // 8px
  },
  /** 큰 인풋 */
  lg: {
    x: space[4], // 16px
    y: space[3], // 12px
  },
} as const;

/**
 * Input 높이
 */
export const inputHeight = {
  /** 극소 인풋: 20px */
  xs: space[5], // 20px
  /** 작은 인풋: 28px */
  sm: space[7], // 28px
  /** 기본 인풋: 36px */
  md: space[9], // 36px
  /** 큰 인풋: 44px */
  lg: space[11], // 44px
} as const;

/**
 * Button 높이 (Input과 동일)
 */
export const buttonHeight = {
  /** 극소 버튼: 20px */
  xs: space[5], // 20px
  /** 작은 버튼: 28px */
  sm: space[7], // 28px
  /** 기본 버튼: 36px */
  md: space[9], // 36px
  /** 큰 버튼: 44px */
  lg: space[11], // 44px
} as const;

/**
 * Card 패딩
 */
export const cardPadding = {
  /** 작은 카드 */
  sm: space[3], // 12px
  /** 기본 카드 */
  md: space[4], // 16px
  /** 큰 카드 */
  lg: space[6], // 24px
} as const;

/**
 * 컴포넌트 간 간격 (gap)
 */
export const componentGap = {
  /** 아이콘과 텍스트 사이 */
  iconText: space[2], // 8px
  /** 폼 필드 사이 */
  formField: space[4], // 16px
  /** 버튼 그룹 */
  buttonGroup: space[2], // 8px
  /** 카드 내 섹션 */
  cardSection: space[4], // 16px
  /** 리스트 아이템 */
  listItem: space[2], // 8px
} as const;

// =============================================================================
// Layout Spacing (레이아웃 간격)
// =============================================================================

/**
 * 페이지 레이아웃 간격
 */
export const layoutSpacing = {
  /** 페이지 패딩 */
  pagePadding: space[6], // 24px
  /** 섹션 간 간격 */
  sectionGap: space[8], // 32px
  /** 사이드바 너비 */
  sidebarWidth: '240px',
  /** 사이드바 축소 너비 */
  sidebarCollapsedWidth: '48px',
  /** 헤더 높이 */
  headerHeight: space[14], // 56px
  /** 탭바 높이 */
  tabBarHeight: space[10], // 40px
  /** 상태바 높이 */
  statusBarHeight: space[6], // 24px
} as const;

/**
 * 그리드 간격
 */
export const gridGap = {
  /** 작은 그리드 */
  sm: space[2], // 8px
  /** 기본 그리드 */
  md: space[4], // 16px
  /** 큰 그리드 */
  lg: space[6], // 24px
} as const;

// =============================================================================
// Type Definitions
// =============================================================================

export type SpaceKey = keyof typeof space;
export type SpacePxKey = keyof typeof spacePx;
