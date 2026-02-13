/**
 * Design System Tailwind Plugin
 *
 * 디자인 토큰을 기반으로 Tailwind 유틸리티 클래스를 생성합니다.
 *
 * 사용법:
 * ```js
 * // tailwind.config.js
 * import designSystemPlugin from './design-system/tailwind/plugin';
 *
 * export default {
 *   plugins: [designSystemPlugin],
 * };
 * ```
 */

const plugin = require('tailwindcss/plugin');

module.exports = plugin(
  function ({ addUtilities, addComponents, theme }) {
    // =========================================================================
    // Z-Index Utilities
    // =========================================================================
    const zIndexUtilities = {
      '.z-behind': { zIndex: 'var(--z-behind)' },
      '.z-base': { zIndex: 'var(--z-base)' },
      '.z-raised': { zIndex: 'var(--z-raised)' },
      '.z-dropdown': { zIndex: 'var(--z-dropdown)' },
      '.z-sticky': { zIndex: 'var(--z-sticky)' },
      '.z-fixed': { zIndex: 'var(--z-fixed)' },
      '.z-overlay': { zIndex: 'var(--z-overlay)' },
      '.z-modal': { zIndex: 'var(--z-modal)' },
      '.z-popover': { zIndex: 'var(--z-popover)' },
      '.z-tooltip': { zIndex: 'var(--z-tooltip)' },
      '.z-toast': { zIndex: 'var(--z-toast)' },
      '.z-max': { zIndex: 'var(--z-max)' },
    };

    // =========================================================================
    // Shadow Utilities
    // =========================================================================
    const shadowUtilities = {
      '.shadow-button': { boxShadow: 'var(--shadow-button)' },
      '.shadow-card': { boxShadow: 'var(--shadow-card)' },
      '.shadow-dropdown': { boxShadow: 'var(--shadow-dropdown)' },
      '.shadow-modal': { boxShadow: 'var(--shadow-modal)' },
      '.shadow-tooltip': { boxShadow: 'var(--shadow-tooltip)' },
    };

    // =========================================================================
    // Component Height Utilities
    // =========================================================================
    const heightUtilities = {
      '.h-input-sm': { height: 'var(--input-height-sm)' },
      '.h-input-md': { height: 'var(--input-height-md)' },
      '.h-input-lg': { height: 'var(--input-height-lg)' },
      '.h-button-sm': { height: 'var(--button-height-sm)' },
      '.h-button-md': { height: 'var(--button-height-md)' },
      '.h-button-lg': { height: 'var(--button-height-lg)' },
      '.h-header': { height: 'var(--layout-header-height)' },
      '.h-tab-bar': { height: 'var(--layout-tab-bar-height)' },
      '.h-status-bar': { height: 'var(--layout-status-bar-height)' },
    };

    // =========================================================================
    // Width Utilities
    // =========================================================================
    const widthUtilities = {
      '.w-sidebar': { width: 'var(--layout-sidebar-width)' },
      '.w-sidebar-collapsed': { width: 'var(--layout-sidebar-collapsed-width)' },
    };

    // =========================================================================
    // Icon Size Utilities
    // =========================================================================
    const iconSizeUtilities = {
      '.icon-xs': { width: 'var(--icon-size-xs)', height: 'var(--icon-size-xs)' },
      '.icon-sm': { width: 'var(--icon-size-sm)', height: 'var(--icon-size-sm)' },
      '.icon-md': { width: 'var(--icon-size-md)', height: 'var(--icon-size-md)' },
      '.icon-lg': { width: 'var(--icon-size-lg)', height: 'var(--icon-size-lg)' },
      '.icon-xl': { width: 'var(--icon-size-xl)', height: 'var(--icon-size-xl)' },
      '.icon-2xl': { width: 'var(--icon-size-2xl)', height: 'var(--icon-size-2xl)' },
      '.icon-3xl': { width: 'var(--icon-size-3xl)', height: 'var(--icon-size-3xl)' },
      '.icon-4xl': { width: 'var(--icon-size-4xl)', height: 'var(--icon-size-4xl)' },
    };

    // =========================================================================
    // Transition Utilities
    // =========================================================================
    const transitionUtilities = {
      '.transition-button': { transition: 'var(--transition-button)' },
      '.transition-input': { transition: 'var(--transition-input)' },
      '.transition-dropdown': { transition: 'var(--transition-dropdown)' },
      '.transition-modal': { transition: 'var(--transition-modal)' },
      '.transition-sidebar': { transition: 'var(--transition-sidebar)' },
    };

    // =========================================================================
    // Status Color Utilities
    // =========================================================================
    const statusColorUtilities = {
      // Background colors
      '.bg-status-dev': { backgroundColor: 'var(--status-dev)' },
      '.bg-status-staging': { backgroundColor: 'var(--status-staging)' },
      '.bg-status-prod': { backgroundColor: 'var(--status-prod)' },
      '.bg-status-dev-soft': { backgroundColor: 'var(--status-dev-bg)' },
      '.bg-status-staging-soft': { backgroundColor: 'var(--status-staging-bg)' },
      '.bg-status-prod-soft': { backgroundColor: 'var(--status-prod-bg)' },
      // Text colors
      '.text-status-dev': { color: 'var(--status-dev)' },
      '.text-status-staging': { color: 'var(--status-staging)' },
      '.text-status-prod': { color: 'var(--status-prod)' },
      // Border colors
      '.border-status-dev': { borderColor: 'var(--status-dev)' },
      '.border-status-staging': { borderColor: 'var(--status-staging)' },
      '.border-status-prod': { borderColor: 'var(--status-prod)' },
    };

    // =========================================================================
    // Container Utilities
    // =========================================================================
    const containerUtilities = {
      '.container-sm': { maxWidth: 'var(--container-sm)' },
      '.container-md': { maxWidth: 'var(--container-md)' },
      '.container-lg': { maxWidth: 'var(--container-lg)' },
      '.container-xl': { maxWidth: 'var(--container-xl)' },
      '.container-2xl': { maxWidth: 'var(--container-2xl)' },
      '.container-prose': { maxWidth: 'var(--container-prose)' },
    };

    // Add all utilities
    addUtilities(zIndexUtilities);
    addUtilities(shadowUtilities);
    addUtilities(heightUtilities);
    addUtilities(widthUtilities);
    addUtilities(iconSizeUtilities);
    addUtilities(transitionUtilities);
    addUtilities(statusColorUtilities);
    addUtilities(containerUtilities);

    // =========================================================================
    // Component Classes
    // =========================================================================
    addComponents({
      // Focus ring component
      '.focus-ring': {
        outline: 'none',
        '&:focus-visible': {
          boxShadow: '0 0 0 var(--ring-width) hsl(var(--ring))',
          outline: 'none',
        },
      },

      // Scrollbar styling
      '.scrollbar-styled': {
        '&::-webkit-scrollbar': {
          width: 'var(--scrollbar-width)',
          height: 'var(--scrollbar-width)',
        },
        '&::-webkit-scrollbar-track': {
          background: 'var(--scrollbar-track)',
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'var(--scrollbar-thumb)',
          borderRadius: 'var(--radius-full)',
          '&:hover': {
            background: 'var(--scrollbar-thumb-hover)',
          },
        },
      },
    });
  },
  {
    // Theme extensions
    theme: {
      extend: {
        // Can extend theme here if needed
      },
    },
  }
);
