/**
 * ESLint Rule: no-hardcoded-colors
 *
 * Tailwind className에서 하드코딩된 색상 값 사용을 방지합니다.
 * 대신 디자인 토큰 또는 CSS 변수를 사용하도록 안내합니다.
 *
 * Bad:  className="bg-[#3b82f6] text-[#ffffff]"
 * Good: className="bg-primary text-primary-foreground" or "bg-[var(--status-dev)]"
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow hardcoded color values in Tailwind classes',
      category: 'Design System',
      recommended: 'warn',
    },
    messages: {
      noHardcodedColors:
        'Avoid hardcoded color "{{value}}". Use semantic colors (e.g., bg-primary, text-muted-foreground) or CSS variables (e.g., bg-[var(--status-dev)]).',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowedColors: {
            type: 'array',
            items: { type: 'string' },
            description: 'Colors to allow (hex values)',
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const allowedColors = new Set((options.allowedColors || []).map((c) => c.toLowerCase()));

    // Pattern for hardcoded hex colors in Tailwind arbitrary values
    // e.g., bg-[#3b82f6], text-[#fff], border-[#000000]
    const hardcodedColorPattern = /\b(bg|text|border|ring|outline|shadow|fill|stroke|from|via|to|accent|caret|decoration)-\[(#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\))\]/g;

    function checkForHardcodedColors(node, value) {
      if (typeof value !== 'string') return;

      const matches = [...value.matchAll(hardcodedColorPattern)];

      matches.forEach((match) => {
        const fullMatch = match[0];
        const colorValue = match[2]?.toLowerCase();

        // Skip if color is in allowed list
        if (colorValue && allowedColors.has(colorValue)) {
          return;
        }

        context.report({
          node,
          messageId: 'noHardcodedColors',
          data: { value: fullMatch },
        });
      });
    }

    return {
      JSXAttribute(node) {
        if (node.name.name !== 'className') return;

        if (node.value?.type === 'Literal') {
          checkForHardcodedColors(node, node.value.value);
        } else if (node.value?.type === 'JSXExpressionContainer') {
          const expr = node.value.expression;

          if (expr.type === 'TemplateLiteral') {
            expr.quasis.forEach((quasi) => {
              checkForHardcodedColors(node, quasi.value.raw);
            });
          } else if (expr.type === 'Literal') {
            checkForHardcodedColors(node, expr.value);
          }
        }
      },

      // Also check style prop for inline styles - using different visitor name
      'JSXAttribute[name.name="style"]'(node) {
        if (node.value?.type === 'JSXExpressionContainer') {
          const expr = node.value.expression;
          if (expr.type === 'ObjectExpression') {
            expr.properties.forEach((prop) => {
              if (prop.type === 'Property' && prop.value?.type === 'Literal') {
                const value = prop.value.value;
                if (typeof value === 'string' && /#[0-9a-fA-F]{3,8}/.test(value)) {
                  context.report({
                    node: prop,
                    messageId: 'noHardcodedColors',
                    data: { value },
                  });
                }
              }
            });
          }
        }
      },
    };
  },
};
