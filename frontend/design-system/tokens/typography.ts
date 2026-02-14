/**
 * Design System - Typography Tokens
 *
 * 타이포그래피 토큰은 다음을 정의합니다:
 * 1. Font Families: 폰트 패밀리 스택
 * 2. Font Sizes: 폰트 크기 스케일
 * 3. Font Weights: 폰트 굵기
 * 4. Line Heights: 줄 높이
 * 5. Letter Spacing: 자간
 */

// =============================================================================
// Font Families
// =============================================================================

/**
 * 기본 폰트 패밀리 - UI 텍스트용
 * Pretendard: 한글/영문 모두 지원하는 현대적인 폰트
 */
export const fontFamilySans = [
  'Pretendard',
  'Noto Sans KR',
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Roboto',
  'Helvetica Neue',
  'Arial',
  'sans-serif',
] as const;

/**
 * 모노스페이스 폰트 패밀리 - 코드, 데이터 그리드용
 * JetBrains Mono: 코드 가독성에 최적화된 폰트
 */
export const fontFamilyMono = [
  'JetBrains Mono',
  'ui-monospace',
  'SFMono-Regular',
  'Menlo',
  'Monaco',
  'Consolas',
  'Liberation Mono',
  'Courier New',
  'monospace',
] as const;

/**
 * 폰트 패밀리 문자열 (CSS용)
 */
export const fontFamily = {
  sans: fontFamilySans.join(', '),
  mono: fontFamilyMono.join(', '),
} as const;

// =============================================================================
// Font Sizes
// =============================================================================

/**
 * 폰트 크기 스케일 (rem 단위)
 * base: 14px (0.875rem) - 프로젝트 기본 폰트 크기
 */
export const fontSize = {
  /** 10px - 아주 작은 텍스트 (라벨, 캡션) */
  '2xs': '0.625rem',
  /** 11px - 매우 작은 텍스트 */
  xs: '0.6875rem',
  /** 12px - 작은 텍스트 (보조 정보) */
  sm: '0.75rem',
  /** 13px - 기본보다 약간 작은 텍스트 */
  md: '0.8125rem',
  /** 14px - 기본 텍스트 크기 */
  base: '0.875rem',
  /** 16px - 약간 큰 텍스트 */
  lg: '1rem',
  /** 18px - 큰 텍스트 (섹션 제목) */
  xl: '1.125rem',
  /** 20px - 더 큰 텍스트 */
  '2xl': '1.25rem',
  /** 24px - 헤딩 */
  '3xl': '1.5rem',
  /** 30px - 큰 헤딩 */
  '4xl': '1.875rem',
  /** 36px - 페이지 제목 */
  '5xl': '2.25rem',
} as const;

/**
 * 폰트 크기 (px 값)
 */
export const fontSizePx = {
  '2xs': 10,
  xs: 11,
  sm: 12,
  md: 13,
  base: 14,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 30,
  '5xl': 36,
} as const;

// =============================================================================
// Font Weights
// =============================================================================

/**
 * 폰트 굵기
 */
export const fontWeight = {
  /** 일반 텍스트 */
  normal: '400',
  /** 약간 강조 */
  medium: '500',
  /** 세미볼드 - 소제목, 강조 */
  semibold: '600',
  /** 볼드 - 제목, 중요 텍스트 */
  bold: '700',
} as const;

// =============================================================================
// Line Heights
// =============================================================================

/**
 * 줄 높이
 */
export const lineHeight = {
  /** 1 - 단일 라인 (아이콘, 버튼) */
  none: '1',
  /** 1.25 - 빽빽한 텍스트 */
  tight: '1.25',
  /** 1.375 - 약간 빽빽한 텍스트 */
  snug: '1.375',
  /** 1.5 - 기본 줄 높이 */
  normal: '1.5',
  /** 1.625 - 여유로운 줄 높이 */
  relaxed: '1.625',
  /** 2 - 넓은 줄 높이 */
  loose: '2',
} as const;

// =============================================================================
// Letter Spacing
// =============================================================================

/**
 * 자간
 */
export const letterSpacing = {
  /** -0.05em - 빽빽한 자간 (큰 제목) */
  tighter: '-0.05em',
  /** -0.025em - 약간 빽빽한 자간 */
  tight: '-0.025em',
  /** 0 - 기본 자간 */
  normal: '0',
  /** 0.025em - 약간 넓은 자간 */
  wide: '0.025em',
  /** 0.05em - 넓은 자간 */
  wider: '0.05em',
  /** 0.1em - 매우 넓은 자간 (대문자 라벨) */
  widest: '0.1em',
} as const;

// =============================================================================
// Text Styles (Composite)
// =============================================================================

/**
 * 미리 정의된 텍스트 스타일
 * 일관된 타이포그래피를 위해 조합된 스타일
 */
export const textStyle = {
  /** 페이지 제목 */
  h1: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  /** 섹션 제목 */
  h2: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  /** 소제목 */
  h3: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.normal,
  },
  /** 카드/패널 제목 */
  h4: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.snug,
    letterSpacing: letterSpacing.normal,
  },
  /** 본문 텍스트 */
  body: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  /** 본문 - 작은 크기 */
  bodySmall: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  /** 라벨 텍스트 */
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.none,
    letterSpacing: letterSpacing.normal,
  },
  /** 캡션/보조 텍스트 */
  caption: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  /** 코드 텍스트 */
  code: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.relaxed,
    letterSpacing: letterSpacing.normal,
  },
  /** 데이터 그리드 셀 */
  gridCell: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.normal,
  },
} as const;

// =============================================================================
// Type Definitions
// =============================================================================

export type FontSize = keyof typeof fontSize;
export type FontWeight = keyof typeof fontWeight;
export type LineHeight = keyof typeof lineHeight;
export type LetterSpacing = keyof typeof letterSpacing;
export type TextStyle = keyof typeof textStyle;
