/**
 * Design System - Transition Tokens
 *
 * 애니메이션과 트랜지션을 위한 토큰:
 * 1. Duration: 애니메이션 지속 시간
 * 2. Easing: 이징 함수 (타이밍 함수)
 * 3. Transition Presets: 미리 정의된 트랜지션
 */

// =============================================================================
// Duration
// =============================================================================

/**
 * 애니메이션 지속 시간 (ms)
 */
export const duration = {
  /** 0ms - 즉시 */
  0: '0ms',
  /** 75ms - 매우 빠름 (마이크로 인터랙션) */
  75: '75ms',
  /** 100ms - 빠름 (hover 효과) */
  100: '100ms',
  /** 150ms - 기본 (버튼, 토글) */
  150: '150ms',
  /** 200ms - 약간 느림 (드롭다운) */
  200: '200ms',
  /** 300ms - 중간 (모달 열기) */
  300: '300ms',
  /** 500ms - 느림 (페이지 전환) */
  500: '500ms',
  /** 700ms - 매우 느림 (복잡한 애니메이션) */
  700: '700ms',
  /** 1000ms - 1초 */
  1000: '1000ms',
} as const;

/**
 * 지속 시간 숫자값 (ms)
 */
export const durationMs = {
  0: 0,
  75: 75,
  100: 100,
  150: 150,
  200: 200,
  300: 300,
  500: 500,
  700: 700,
  1000: 1000,
} as const;

// =============================================================================
// Easing Functions
// =============================================================================

/**
 * 이징 함수 (CSS timing-function)
 */
export const easing = {
  /** 선형 - 일정한 속도 */
  linear: 'linear',
  /** 기본 ease - 부드러운 시작과 끝 */
  DEFAULT: 'ease',
  /** ease-in - 느리게 시작 */
  in: 'ease-in',
  /** ease-out - 느리게 끝 */
  out: 'ease-out',
  /** ease-in-out - 느리게 시작하고 끝 */
  inOut: 'ease-in-out',
  /** 빠른 시작, 부드러운 끝 (권장) */
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  /** 바운스 효과 */
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  /** 스프링 효과 */
  spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  /** 빠른 감속 */
  fastOutSlowIn: 'cubic-bezier(0.4, 0, 0.2, 1)',
  /** 선형 감속 */
  linearOutSlowIn: 'cubic-bezier(0, 0, 0.2, 1)',
  /** 빠른 가속 */
  fastOutLinearIn: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

// =============================================================================
// Transition Presets
// =============================================================================

/**
 * 미리 정의된 트랜지션 속성
 */
export const transitionProperty = {
  /** 없음 */
  none: 'none',
  /** 모든 속성 */
  all: 'all',
  /** 기본 (색상, 배경, 테두리, 그림자, 투명도) */
  DEFAULT: 'color, background-color, border-color, box-shadow, opacity',
  /** 색상만 */
  colors: 'color, background-color, border-color',
  /** 투명도만 */
  opacity: 'opacity',
  /** 그림자만 */
  shadow: 'box-shadow',
  /** 변환 (transform) */
  transform: 'transform',
  /** 크기 관련 */
  size: 'width, height, padding, margin',
  /** 위치 관련 */
  position: 'top, right, bottom, left',
} as const;

/**
 * 컴포넌트별 트랜지션 프리셋
 * transition shorthand 값
 */
export const transition = {
  /** 없음 */
  none: 'none',
  /** 버튼 - 빠른 색상 변화 */
  button: `${transitionProperty.DEFAULT} ${duration[150]} ${easing.smooth}`,
  /** 입력 필드 - 테두리, 그림자 */
  input: `border-color ${duration[150]} ${easing.smooth}, box-shadow ${duration[150]} ${easing.smooth}`,
  /** 카드 hover */
  card: `box-shadow ${duration[200]} ${easing.smooth}, transform ${duration[200]} ${easing.smooth}`,
  /** 드롭다운/팝오버 열기 */
  dropdown: `opacity ${duration[150]} ${easing.out}, transform ${duration[150]} ${easing.out}`,
  /** 모달 열기 */
  modal: `opacity ${duration[200]} ${easing.out}, transform ${duration[200]} ${easing.out}`,
  /** 사이드바 열기/닫기 */
  sidebar: `width ${duration[300]} ${easing.smooth}, transform ${duration[300]} ${easing.smooth}`,
  /** 토스트 알림 */
  toast: `opacity ${duration[300]} ${easing.smooth}, transform ${duration[300]} ${easing.spring}`,
  /** 툴팁 */
  tooltip: `opacity ${duration[100]} ${easing.out}`,
  /** 아코디언/콜랩스 */
  collapse: `height ${duration[300]} ${easing.smooth}, opacity ${duration[300]} ${easing.smooth}`,
  /** 탭 전환 */
  tab: `color ${duration[150]} ${easing.smooth}, border-color ${duration[150]} ${easing.smooth}`,
  /** 스위치/토글 */
  toggle: `transform ${duration[200]} ${easing.spring}, background-color ${duration[200]} ${easing.smooth}`,
  /** 체크박스 */
  checkbox: `transform ${duration[100]} ${easing.bounce}`,
  /** 스피너/로딩 */
  spinner: `transform ${duration[1000]} ${easing.linear}`,
} as const;

// =============================================================================
// Animation Keyframes (참고용)
// =============================================================================

/**
 * 애니메이션 이름 (CSS @keyframes와 매핑)
 * Tailwind CSS animate 플러그인과 호환
 */
export const animation = {
  /** 없음 */
  none: 'none',
  /** 스핀 (로딩) */
  spin: 'spin 1s linear infinite',
  /** 핑 (알림 효과) */
  ping: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
  /** 펄스 (깜빡임) */
  pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  /** 바운스 */
  bounce: 'bounce 1s infinite',
  /** 페이드 인 */
  fadeIn: 'fadeIn 0.2s ease-out',
  /** 페이드 아웃 */
  fadeOut: 'fadeOut 0.2s ease-in',
  /** 슬라이드 인 (위에서) */
  slideInFromTop: 'slideInFromTop 0.2s ease-out',
  /** 슬라이드 인 (아래에서) */
  slideInFromBottom: 'slideInFromBottom 0.2s ease-out',
  /** 슬라이드 인 (왼쪽에서) */
  slideInFromLeft: 'slideInFromLeft 0.2s ease-out',
  /** 슬라이드 인 (오른쪽에서) */
  slideInFromRight: 'slideInFromRight 0.2s ease-out',
  /** 스케일 인 */
  scaleIn: 'scaleIn 0.2s ease-out',
} as const;

// =============================================================================
// Type Definitions
// =============================================================================

export type DurationKey = keyof typeof duration;
export type EasingKey = keyof typeof easing;
export type TransitionKey = keyof typeof transition;
export type AnimationKey = keyof typeof animation;
