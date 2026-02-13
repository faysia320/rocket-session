/**
 * Design System ESLint Plugin
 *
 * 디자인 시스템 규칙을 적용하기 위한 ESLint 플러그인입니다.
 *
 * 사용법:
 * ```js
 * // eslint.config.js
 * import designSystemPlugin from './design-system/eslint/index.js';
 *
 * export default [
 *   {
 *     plugins: {
 *       'design-system': designSystemPlugin,
 *     },
 *     rules: {
 *       'design-system/no-hardcoded-pixels': 'warn',
 *       'design-system/no-hardcoded-colors': 'warn',
 *       'design-system/prefer-design-tokens': 'warn',
 *     },
 *   },
 * ];
 * ```
 */

import noHardcodedPixels from './rules/no-hardcoded-pixels.js';
import noHardcodedColors from './rules/no-hardcoded-colors.js';
import preferDesignTokens from './rules/prefer-design-tokens.js';

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: {
    name: 'eslint-plugin-design-system',
    version: '1.0.0',
  },
  rules: {
    'no-hardcoded-pixels': noHardcodedPixels,
    'no-hardcoded-colors': noHardcodedColors,
    'prefer-design-tokens': preferDesignTokens,
  },
  configs: {
    recommended: {
      plugins: ['design-system'],
      rules: {
        'design-system/no-hardcoded-pixels': 'warn',
        'design-system/no-hardcoded-colors': 'warn',
        'design-system/prefer-design-tokens': 'warn',
      },
    },
    strict: {
      plugins: ['design-system'],
      rules: {
        'design-system/no-hardcoded-pixels': 'error',
        'design-system/no-hardcoded-colors': 'error',
        'design-system/prefer-design-tokens': 'error',
      },
    },
  },
};

export default plugin;
