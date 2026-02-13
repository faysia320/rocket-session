/**
 * ESLint Rule: prefer-design-tokens
 *
 * 디자인 토큰 사용을 권장합니다.
 * z-index, shadow 등에서 하드코딩된 값 대신 CSS 변수 사용을 안내합니다.
 *
 * Bad:  className="z-50" or "z-[999]"
 * Good: className="z-[var(--z-modal)]"
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer design tokens over hardcoded values',
      category: 'Design System',
      recommended: 'warn',
    },
    messages: {
      preferZIndexToken:
        'Consider using z-index token "z-[var(--z-{{suggestion}})]" instead of "{{value}}". Available: --z-base (0), --z-raised (10), --z-dropdown (20), --z-sticky (30), --z-fixed (40), --z-overlay (50), --z-modal (60), --z-popover (70), --z-tooltip (80), --z-toast (90).',
      preferShadowToken:
        'Consider using shadow token "shadow-[var(--shadow-{{suggestion}})]" instead of arbitrary shadow. Available: --shadow-sm, --shadow-md, --shadow-lg, --shadow-xl.',
    },
    schema: [],
  },

  create(context) {
    // Z-index mapping to suggest appropriate tokens
    const zIndexSuggestions = {
      0: 'base',
      10: 'raised',
      20: 'dropdown',
      30: 'sticky',
      40: 'fixed',
      50: 'overlay',
      60: 'modal',
      70: 'popover',
      80: 'tooltip',
      90: 'toast',
      100: 'max',
    };

    // Pattern for hardcoded z-index values
    const zIndexPattern = /\bz-(\d+)\b|\bz-\[(\d+)\]/g;

    function checkClassName(node, value) {
      if (typeof value !== 'string') return;

      // Check z-index
      const zMatches = [...value.matchAll(zIndexPattern)];
      zMatches.forEach((match) => {
        const fullMatch = match[0];
        const zValue = parseInt(match[1] || match[2], 10);

        // Skip if already using var()
        if (fullMatch.includes('var(')) return;

        // Find closest suggestion
        let suggestion = 'base';
        let minDiff = Infinity;

        Object.entries(zIndexSuggestions).forEach(([threshold, name]) => {
          const diff = Math.abs(zValue - parseInt(threshold, 10));
          if (diff < minDiff) {
            minDiff = diff;
            suggestion = name;
          }
        });

        context.report({
          node,
          messageId: 'preferZIndexToken',
          data: { value: fullMatch, suggestion },
        });
      });
    }

    return {
      JSXAttribute(node) {
        if (node.name.name !== 'className') return;

        if (node.value?.type === 'Literal') {
          checkClassName(node, node.value.value);
        } else if (node.value?.type === 'JSXExpressionContainer') {
          const expr = node.value.expression;

          if (expr.type === 'TemplateLiteral') {
            expr.quasis.forEach((quasi) => {
              checkClassName(node, quasi.value.raw);
            });
          } else if (expr.type === 'Literal') {
            checkClassName(node, expr.value);
          }
        }
      },
    };
  },
};
