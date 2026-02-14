/**
 * Design System - Color Tokens
 *
 * 색상 토큰은 두 가지 레벨로 구성됩니다:
 * 1. Primitive Colors: 기본 색상 팔레트 (gray, blue, red 등)
 * 2. Semantic Colors: 의미 기반 색상 (background, primary, destructive 등)
 */

// =============================================================================
// Primitive Colors (기본 색상 팔레트)
// =============================================================================

/**
 * Gray Scale - 중립적인 회색 계열
 * VS Code 스타일 다크 테마 기반
 */
export const gray = {
  50: '#fafafa',
  100: '#f5f5f5',
  200: '#e5e5e5',
  300: '#d4d4d4',
  400: '#a3a3a3',
  500: '#737373',
  600: '#525252',
  700: '#404040',
  800: '#262626',
  900: '#171717',
  950: '#0a0a0a',
} as const;

/**
 * VS Code Dark Theme Colors
 * 다크 테마에서 주로 사용되는 색상
 */
export const vscode = {
  background: '#1e1e1e',
  surface: '#252526',
  surfaceHover: '#2a2d2e',
  border: '#3c3c3c',
  borderLight: '#4c4c4c',
  text: '#d4d4d4',
  textMuted: '#858585',
  textSubtle: '#6e7681',
} as const;

/**
 * Blue - Primary 색상 계열
 */
export const blue = {
  50: '#eff6ff',
  100: '#dbeafe',
  200: '#bfdbfe',
  300: '#93c5fd',
  400: '#60a5fa',
  500: '#3b82f6',
  600: '#2563eb',
  700: '#1d4ed8',
  800: '#1e40af',
  900: '#1e3a8a',
  950: '#172554',
} as const;

/**
 * Red - Destructive/Error 색상 계열
 */
export const red = {
  50: '#fef2f2',
  100: '#fee2e2',
  200: '#fecaca',
  300: '#fca5a5',
  400: '#f87171',
  500: '#ef4444',
  600: '#dc2626',
  700: '#b91c1c',
  800: '#991b1b',
  900: '#7f1d1d',
  950: '#450a0a',
} as const;

/**
 * Green - Success 색상 계열
 */
export const green = {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
  950: '#052e16',
} as const;

/**
 * Yellow - Warning 색상 계열
 */
export const yellow = {
  50: '#fefce8',
  100: '#fef9c3',
  200: '#fef08a',
  300: '#fde047',
  400: '#facc15',
  500: '#eab308',
  600: '#ca8a04',
  700: '#a16207',
  800: '#854d0e',
  900: '#713f12',
  950: '#422006',
} as const;

/**
 * Orange - Chart/Accent 색상 계열
 */
export const orange = {
  50: '#fff7ed',
  100: '#ffedd5',
  200: '#fed7aa',
  300: '#fdba74',
  400: '#fb923c',
  500: '#f97316',
  600: '#ea580c',
  700: '#c2410c',
  800: '#9a3412',
  900: '#7c2d12',
  950: '#431407',
} as const;

// =============================================================================
// Semantic Colors (의미 기반 색상)
// HSL 형식으로 정의 - CSS 변수와 호환
// =============================================================================

/**
 * Light Theme Semantic Colors
 */
export const lightTheme = {
  // Base
  background: '0 0% 100%',
  foreground: '222.2 84% 4.9%',

  // Card & Popover
  card: '0 0% 100%',
  cardForeground: '222.2 84% 4.9%',
  popover: '0 0% 100%',
  popoverForeground: '222.2 84% 4.9%',

  // Primary (Blue)
  primary: '221.2 83.2% 53.3%',
  primaryForeground: '210 40% 98%',

  // Secondary
  secondary: '210 40% 96.1%',
  secondaryForeground: '222.2 47.4% 11.2%',

  // Muted
  muted: '210 40% 96.1%',
  mutedForeground: '215.4 16.3% 46.9%',

  // Accent
  accent: '210 40% 96.1%',
  accentForeground: '222.2 47.4% 11.2%',

  // Destructive (Red)
  destructive: '0 84.2% 60.2%',
  destructiveForeground: '210 40% 98%',

  // Border & Input
  border: '214.3 31.8% 91.4%',
  input: '214.3 31.8% 91.4%',
  ring: '0 0% 92%',

  // Sidebar
  sidebarBackground: '0 0% 98%',
  sidebarForeground: '240 5.3% 26.1%',
  sidebarPrimary: '240 5.9% 10%',
  sidebarPrimaryForeground: '0 0% 98%',
  sidebarAccent: '240 4.8% 95.9%',
  sidebarAccentForeground: '240 5.9% 10%',
  sidebarBorder: '220 13% 91%',
  sidebarRing: '217.2 91.2% 59.8%',

  // Chart Colors
  chart1: '12 76% 61%',
  chart2: '173 58% 39%',
  chart3: '197 37% 24%',
  chart4: '43 74% 66%',
  chart5: '27 87% 67%',
} as const;

/**
 * Dark Theme Semantic Colors
 * VS Code 스타일 다크 테마 기반
 */
export const darkTheme = {
  // Base
  background: '0 0% 12%', // #1e1e1e
  foreground: '0 0% 100%', // #ffffff

  // Card & Popover
  card: '240 2% 15%', // #252526
  cardForeground: '0 0% 100%',
  popover: '240 2% 15%',
  popoverForeground: '0 0% 100%',

  // Primary (Blue)
  primary: '217.2 91.2% 59.8%',
  primaryForeground: '222.2 47.4% 11.2%',

  // Secondary
  secondary: '0 0% 24%', // #3c3c3c
  secondaryForeground: '0 0% 100%',

  // Muted
  muted: '0 0% 24%',
  mutedForeground: '0 0% 52%', // #858585

  // Accent
  accent: '0 0% 24%',
  accentForeground: '0 0% 100%',

  // Destructive (Red)
  destructive: '0 62.8% 30.6%',
  destructiveForeground: '210 40% 98%',

  // Border & Input
  border: '0 0% 24%',
  input: '0 0% 24%',
  ring: '0 0% 96%',

  // Sidebar
  sidebarBackground: '0 0% 12%',
  sidebarForeground: '0 0% 100%',
  sidebarPrimary: '224.3 76.3% 48%',
  sidebarPrimaryForeground: '0 0% 100%',
  sidebarAccent: '0 0% 24%',
  sidebarAccentForeground: '0 0% 100%',
  sidebarBorder: '0 0% 24%',
  sidebarRing: '217.2 91.2% 59.8%',

  // Chart Colors
  chart1: '220 70% 50%',
  chart2: '160 60% 45%',
  chart3: '30 80% 55%',
  chart4: '280 65% 60%',
  chart5: '340 75% 55%',
} as const;

// =============================================================================
// Component-specific Colors (컴포넌트별 색상)
// Wijmo Grid, CodeMirror 등 서드파티 컴포넌트용
// =============================================================================

/**
 * Wijmo Grid Colors
 */
export const wijmoColors = {
  light: {
    background: '#ffffff',
    text: '#28364e',
    header: '#dee0ef',
    headerText: '#434c60',
    selected: '#e2e7fa',
    selectedText: '#4568e0',
    border: '#bbc6d9',
    inputBorder: '#d1d5db',
    inputText: '#1f2937',
  },
  dark: {
    background: '#1e1e1e',
    text: '#d1d5db',
    header: '#252526',
    headerText: '#9c9fa7',
    selected: '#3a3c4c',
    selectedText: '#ffffff',
    border: '#3a3a3a',
    inputBorder: '#4c4c4c',
    inputBackground: '#3c3c3c',
  },
} as const;

/**
 * Scrollbar Colors
 */
export const scrollbarColors = {
  light: {
    track: '#ffffff',
    thumb: '#cccccc',
    thumbHover: '#999999',
  },
  dark: {
    track: '#1e1e1e',
    thumb: '#4c4c4c',
    thumbHover: '#797979',
  },
} as const;

// =============================================================================
// Type Definitions
// =============================================================================

export type PrimitiveColorScale = typeof gray;
export type SemanticColors = typeof lightTheme;
export type ThemeMode = 'light' | 'dark';
