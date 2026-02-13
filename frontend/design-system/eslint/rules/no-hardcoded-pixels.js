/**
 * ESLint Rule: no-hardcoded-pixels
 *
 * Tailwind className에서 하드코딩된 픽셀 값 사용을 방지합니다.
 * 대신 디자인 토큰 또는 CSS 변수를 사용하도록 안내합니다.
 *
 * Bad:  className="h-[36px] w-[100px]"
 * Good: className="h-9 w-24" or "h-[var(--input-height-md)]"
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow hardcoded pixel values in Tailwind classes',
      category: 'Design System',
      recommended: 'warn',
    },
    messages: {
      noHardcodedPixels:
        'Avoid hardcoded pixel value "{{value}}". Use design tokens (e.g., h-9, w-24) or CSS variables (e.g., h-[var(--input-height-md)]).',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowedPatterns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Patterns to allow (regex strings)',
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const allowedPatterns = (options.allowedPatterns || []).map((p) => new RegExp(p));

    // Patterns that indicate hardcoded pixels in Tailwind arbitrary values
    // e.g., h-[36px], w-[100px], p-[20px], m-[10px], etc.
    const hardcodedPixelPattern = /\b(h|w|p|m|px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr|gap|space-x|space-y|top|right|bottom|left|inset|text|leading|tracking|rounded|border|outline|ring|shadow)-\[\d+px\]/g;

    function checkForHardcodedPixels(node, value) {
      if (typeof value !== 'string') return;

      // Check if it's allowed by patterns
      if (allowedPatterns.some((pattern) => pattern.test(value))) {
        return;
      }

      const matches = value.match(hardcodedPixelPattern);
      if (matches) {
        matches.forEach((match) => {
          context.report({
            node,
            messageId: 'noHardcodedPixels',
            data: { value: match },
          });
        });
      }
    }

    return {
      // Check className attribute in JSX
      JSXAttribute(node) {
        if (node.name.name !== 'className') return;

        if (node.value?.type === 'Literal') {
          checkForHardcodedPixels(node, node.value.value);
        } else if (node.value?.type === 'JSXExpressionContainer') {
          // Handle template literals and cn() calls
          const expr = node.value.expression;

          if (expr.type === 'TemplateLiteral') {
            expr.quasis.forEach((quasi) => {
              checkForHardcodedPixels(node, quasi.value.raw);
            });
          } else if (expr.type === 'Literal') {
            checkForHardcodedPixels(node, expr.value);
          }
          // Note: Complex expressions like cn() would need more sophisticated handling
        }
      },
    };
  },
};
