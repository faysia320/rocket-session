/**
 * Design System - Tokens Index
 *
 * 모든 디자인 토큰을 한 곳에서 export합니다.
 */

// =============================================================================
// Colors
// =============================================================================
export {
  // Primitive Colors
  gray,
  vscode,
  blue,
  red,
  green,
  yellow,
  orange,
  // Semantic Colors
  lightTheme,
  darkTheme,
  // Component Colors
  wijmoColors,
  scrollbarColors,
  // Types
  type PrimitiveColorScale,
  type SemanticColors,
  type ThemeMode,
} from './colors';

// =============================================================================
// Typography
// =============================================================================
export {
  // Font Families
  fontFamilySans,
  fontFamilyMono,
  fontFamily,
  // Font Sizes
  fontSize,
  fontSizePx,
  // Font Weights
  fontWeight,
  // Line Heights
  lineHeight,
  // Letter Spacing
  letterSpacing,
  // Text Styles
  textStyle,
  // Types
  type FontSize,
  type FontWeight,
  type LineHeight,
  type LetterSpacing,
  type TextStyle,
} from './typography';

// =============================================================================
// Spacing
// =============================================================================
export {
  // Space Scale
  space,
  spacePx,
  // Component Spacing
  buttonPadding,
  inputPadding,
  inputHeight,
  cardPadding,
  componentGap,
  // Layout Spacing
  layoutSpacing,
  gridGap,
  // Types
  type SpaceKey,
  type SpacePxKey,
} from './spacing';

// =============================================================================
// Radius
// =============================================================================
export {
  // Radius Scale
  radius,
  radiusPx,
  // Component Radius
  buttonRadius,
  inputRadius,
  cardRadius,
  dialogRadius,
  badgeRadius,
  popoverRadius,
  avatarRadius,
  // CSS Variable Integration
  cssVarRadius,
  // Types
  type RadiusKey,
  type RadiusPxKey,
} from './radius';

// =============================================================================
// Shadows
// =============================================================================
export {
  // Shadow Scale
  shadow,
  shadowDark,
  // Component Shadows
  componentShadow,
  // Ring (Focus) Shadows
  ring,
  // Types
  type ShadowKey,
  type ComponentShadowKey,
  type RingKey,
} from './shadows';

// =============================================================================
// Transitions
// =============================================================================
export {
  // Duration
  duration,
  durationMs,
  // Easing
  easing,
  // Transition Properties
  transitionProperty,
  // Transition Presets
  transition,
  // Animation
  animation,
  // Types
  type DurationKey,
  type EasingKey,
  type TransitionKey,
  type AnimationKey,
} from './transitions';

// =============================================================================
// Z-Index
// =============================================================================
export {
  // Z-Index Scale
  zIndex,
  // Component Z-Index
  componentZIndex,
  // Types
  type ZIndexKey,
  type ComponentZIndexKey,
} from './zIndex';

// =============================================================================
// Icon Sizes
// =============================================================================
export {
  // Icon Size Scale
  iconSize,
  iconSizePx,
  iconSizeClass,
  // Component Icon Sizes
  buttonIconSize,
  inputIconSize,
  menuIconSize,
  statusIconSize,
  // Types
  type IconSizeKey,
  type IconSizePxKey,
  type IconSizeClassKey,
} from './iconSize';

// =============================================================================
// Breakpoints
// =============================================================================
export {
  // Breakpoint Scale
  breakpoint,
  breakpointPx,
  // Media Query Helpers
  mediaQuery,
  mediaQueryMax,
  // Container
  containerMaxWidth,
  containerPadding,
  // Types
  type BreakpointKey,
  type BreakpointPxKey,
  type ContainerMaxWidthKey,
} from './breakpoints';

// =============================================================================
// Combined Tokens Object
// =============================================================================

import {
  gray,
  vscode,
  blue,
  red,
  green,
  yellow,
  orange,
  lightTheme,
  darkTheme,
} from './colors';
import { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing } from './typography';
import { space, layoutSpacing } from './spacing';
import { radius } from './radius';
import { shadow, ring } from './shadows';
import { duration, easing, transition } from './transitions';
import { zIndex } from './zIndex';
import { iconSize, iconSizeClass } from './iconSize';
import { breakpoint, containerMaxWidth, containerPadding } from './breakpoints';

/**
 * 전체 토큰을 하나의 객체로 export
 * Tailwind config나 styled-components theme에서 사용 가능
 */
export const tokens = {
  colors: {
    gray,
    vscode,
    blue,
    red,
    green,
    yellow,
    orange,
  },
  semantic: {
    light: lightTheme,
    dark: darkTheme,
  },
  typography: {
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight,
    letterSpacing,
  },
  spacing: {
    space,
    layout: layoutSpacing,
  },
  radius,
  shadow,
  ring,
  transition: {
    duration,
    easing,
    preset: transition,
  },
  zIndex,
  iconSize,
  iconSizeClass,
  breakpoint,
  container: {
    maxWidth: containerMaxWidth,
    padding: containerPadding,
  },
} as const;

export type Tokens = typeof tokens;
