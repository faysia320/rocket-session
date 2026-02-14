/**
 * Design System
 *
 * 프로젝트 전체에 일관되게 적용되는 디자인 규칙과 토큰을 정의합니다.
 *
 * 사용법:
 * ```typescript
 * import { tokens, fontSize, space, radius } from '@/design-system';
 *
 * // 개별 토큰 사용
 * const style = {
 *   fontSize: fontSize.base,
 *   padding: space[4],
 *   borderRadius: radius.md,
 * };
 *
 * // 전체 토큰 객체 사용
 * const theme = tokens.colors.blue[500];
 * ```
 *
 * CSS 변수 사용법:
 * ```css
 * @import '../design-system/css/variables.css';
 *
 * .my-component {
 *   font-size: var(--font-size-base);
 *   padding: var(--space-4);
 *   border-radius: var(--radius-md);
 * }
 * ```
 */

// =============================================================================
// All Tokens Export
// =============================================================================
export * from './tokens';

// =============================================================================
// Utilities Export
// =============================================================================
export * from './utils';

// =============================================================================
// Quick Reference
// =============================================================================

/**
 * Design System Quick Reference
 *
 * ## Colors
 * - Primitive: gray, blue, red, green, yellow, orange
 * - Semantic (Light): lightTheme
 * - Semantic (Dark): darkTheme
 * - Component: wijmoColors, scrollbarColors
 *
 * ## Typography
 * - fontFamily: { sans, mono }
 * - fontSize: 2xs(10px) ~ 5xl(36px), base=14px
 * - fontWeight: normal(400), medium(500), semibold(600), bold(700)
 * - lineHeight: none(1) ~ loose(2), normal=1.5
 * - textStyle: h1, h2, h3, h4, body, bodySmall, label, caption, code, gridCell
 *
 * ## Spacing (4px grid)
 * - space: 0, px, 0.5(2px) ~ 24(96px)
 * - inputHeight: sm(28px), md(36px), lg(44px)
 * - layoutSpacing: pagePadding, sectionGap, sidebarWidth, headerHeight, etc.
 *
 * ## Radius
 * - radius: none(0) ~ full(9999px), lg=8px
 * - Component: buttonRadius, inputRadius, cardRadius, dialogRadius, etc.
 */
