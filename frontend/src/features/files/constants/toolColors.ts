/** tool별 Badge 스타일 매핑 */
export const TOOL_BADGE_STYLES: Record<string, { background: string; color: string }> = {
  Write: {
    background: 'rgba(34,197,94,0.15)',
    color: 'hsl(var(--success))',
  },
  Edit: {
    background: 'rgba(59,130,246,0.15)',
    color: 'hsl(var(--info))',
  },
};

const DEFAULT_STYLE = {
  background: 'rgba(148,163,184,0.15)',
  color: 'hsl(var(--muted-foreground))',
};

export function getToolBadgeStyle(tool: string) {
  return TOOL_BADGE_STYLES[tool] ?? DEFAULT_STYLE;
}
