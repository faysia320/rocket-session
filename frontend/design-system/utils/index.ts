/**
 * Design System Utilities
 *
 * 디자인 토큰을 사용하기 위한 TypeScript 유틸리티 함수들
 */

import {
  space,
  spacePx,
  fontSize,
  fontSizePx,
  radius,
  radiusPx,
  iconSize,
  iconSizePx,
  breakpoint,
  breakpointPx,
  zIndex,
  type SpaceKey,
  type FontSize,
  type RadiusKey,
  type IconSizeKey,
  type BreakpointKey,
  type ZIndexKey,
} from '../tokens';

// =============================================================================
// CSS Variable Utilities
// =============================================================================

/**
 * CSS 변수 문자열 생성
 * @example cssVar('space', '4') → 'var(--space-4)'
 */
export function cssVar(category: string, key: string | number): string {
  return `var(--${category}-${key})`;
}

/**
 * Space CSS 변수
 * @example spaceVar('4') → 'var(--space-4)'
 */
export function spaceVar(key: SpaceKey): string {
  return cssVar('space', key);
}

/**
 * Font size CSS 변수
 * @example fontSizeVar('sm') → 'var(--font-size-sm)'
 */
export function fontSizeVar(key: FontSize): string {
  return cssVar('font-size', key);
}

/**
 * Radius CSS 변수
 * @example radiusVar('md') → 'var(--radius-md)'
 */
export function radiusVar(key: RadiusKey): string {
  return cssVar('radius', key);
}

/**
 * Icon size CSS 변수
 * @example iconSizeVar('lg') → 'var(--icon-size-lg)'
 */
export function iconSizeVar(key: IconSizeKey): string {
  return cssVar('icon-size', key);
}

/**
 * Z-index CSS 변수
 * @example zIndexVar('modal') → 'var(--z-modal)'
 */
export function zIndexVar(key: ZIndexKey): string {
  return cssVar('z', key);
}

// =============================================================================
// Value Retrieval Utilities
// =============================================================================

/**
 * Space 값 가져오기 (rem)
 * @example getSpace('4') → '1rem'
 */
export function getSpace(key: SpaceKey): string {
  return space[key];
}

/**
 * Space 값 가져오기 (px)
 * @example getSpacePx('4') → 16
 */
export function getSpacePx(key: keyof typeof spacePx): number {
  return spacePx[key];
}

/**
 * Font size 값 가져오기 (rem)
 * @example getFontSize('sm') → '0.75rem'
 */
export function getFontSize(key: FontSize): string {
  return fontSize[key];
}

/**
 * Font size 값 가져오기 (px)
 * @example getFontSizePx('sm') → 12
 */
export function getFontSizePx(key: keyof typeof fontSizePx): number {
  return fontSizePx[key];
}

/**
 * Radius 값 가져오기
 * @example getRadius('md') → '0.25rem'
 */
export function getRadius(key: RadiusKey): string {
  return radius[key];
}

/**
 * Radius 값 가져오기 (px)
 * @example getRadiusPx('md') → 4
 */
export function getRadiusPx(key: keyof typeof radiusPx): number {
  return radiusPx[key];
}

/**
 * Icon size 값 가져오기 (rem)
 * @example getIconSize('lg') → '1.25rem'
 */
export function getIconSize(key: IconSizeKey): string {
  return iconSize[key];
}

/**
 * Icon size 값 가져오기 (px)
 * @example getIconSizePx('lg') → 20
 */
export function getIconSizePx(key: keyof typeof iconSizePx): number {
  return iconSizePx[key];
}

/**
 * Z-index 값 가져오기
 * @example getZIndex('modal') → 60
 */
export function getZIndex(key: ZIndexKey): number | 'auto' {
  return zIndex[key];
}

// =============================================================================
// Breakpoint Utilities
// =============================================================================

/**
 * 브레이크포인트 값 가져오기
 * @example getBreakpoint('md') → '768px'
 */
export function getBreakpoint(key: BreakpointKey): string {
  return breakpoint[key];
}

/**
 * 브레이크포인트 값 가져오기 (px)
 * @example getBreakpointPx('md') → 768
 */
export function getBreakpointPx(key: BreakpointKey): number {
  return breakpointPx[key];
}

/**
 * 현재 뷰포트 너비가 특정 브레이크포인트 이상인지 확인
 * @example isAboveBreakpoint('md') → true/false
 */
export function isAboveBreakpoint(key: BreakpointKey): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= breakpointPx[key];
}

/**
 * 미디어 쿼리 문자열 생성 (min-width)
 * @example getMediaQueryMin('md') → '(min-width: 768px)'
 */
export function getMediaQueryMin(key: BreakpointKey): string {
  return `(min-width: ${breakpoint[key]})`;
}

/**
 * 미디어 쿼리 문자열 생성 (max-width)
 * @example getMediaQueryMax('md') → '(max-width: 767px)'
 */
export function getMediaQueryMax(key: BreakpointKey): string {
  return `(max-width: ${breakpointPx[key] - 1}px)`;
}

// =============================================================================
// Tailwind Class Utilities
// =============================================================================

/**
 * Space 키를 Tailwind 클래스 접미사로 변환
 * @example spaceTailwind('0.5') → '0.5'
 * @example spaceTailwind('4') → '4'
 */
export function spaceTailwind(key: SpaceKey): string {
  return key.toString().replace('.', '.');
}

/**
 * Icon size를 Tailwind 클래스로 변환
 * @example iconSizeTailwind('lg') → 'h-5 w-5'
 */
export function iconSizeTailwind(key: IconSizeKey): string {
  const sizeMap: Record<IconSizeKey, string> = {
    xs: 'h-3 w-3',
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
    xl: 'h-6 w-6',
    '2xl': 'h-8 w-8',
    '3xl': 'h-10 w-10',
    '4xl': 'h-12 w-12',
  };
  return sizeMap[key];
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Space 키 유효성 검사
 */
export function isValidSpaceKey(key: string): key is SpaceKey {
  return key in space;
}

/**
 * Breakpoint 키 유효성 검사
 */
export function isValidBreakpointKey(key: string): key is BreakpointKey {
  return key in breakpoint;
}

/**
 * Z-index 키 유효성 검사
 */
export function isValidZIndexKey(key: string): key is ZIndexKey {
  return key in zIndex;
}
