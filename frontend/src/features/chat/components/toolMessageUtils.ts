import { useMemo } from "react";
import {
  FileText,
  Pencil,
  Terminal,
  Search,
  Globe,
  GitBranch,
  Plug,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** MCP 도구 이름 파싱 결과 */
export interface McpToolInfo {
  isMcp: boolean;
  provider: string;
  toolName: string;
  displayName: string;
}

/** MCP 도구 이름 파싱: "mcp__provider__tool_name" → 구조화된 정보 */
export function parseMcpToolName(toolName: string): McpToolInfo {
  const match = toolName.match(/^mcp__([^_]+)__(.+)$/);
  if (!match) {
    return { isMcp: false, provider: "", toolName, displayName: toolName };
  }
  const provider = match[1];
  const tool = match[2];
  return {
    isMcp: true,
    provider,
    toolName: tool,
    displayName: `${provider} → ${tool}`,
  };
}

/** MCP provider별 아이콘 매핑 */
const mcpProviderIcons: Record<string, LucideIcon> = {
  serena: Search,
  github: GitBranch,
  playwright: Globe,
  context7: FileText,
};

/** 도구 카테고리별 아이콘 매핑 */
export function getToolIcon(toolName: string): LucideIcon | null {
  switch (toolName) {
    case "Read":
      return FileText;
    case "Write":
    case "Edit":
    case "MultiEdit":
      return Pencil;
    case "Bash":
      return Terminal;
    case "Grep":
    case "Glob":
      return Search;
    case "WebFetch":
    case "WebSearch":
      return Globe;
    case "Task":
      return GitBranch;
    default: {
      const mcp = parseMcpToolName(toolName);
      if (mcp.isMcp) {
        return mcpProviderIcons[mcp.provider] ?? Plug;
      }
      return null;
    }
  }
}

/** 도구 카테고리별 아이콘 색상 */
export function getToolColor(toolName: string): string {
  switch (toolName) {
    case "Read":
    case "Grep":
    case "Glob":
      return "text-info";
    case "Write":
    case "Edit":
    case "MultiEdit":
      return "text-primary";
    case "Bash":
      return "text-warning";
    case "WebFetch":
    case "WebSearch":
      return "text-success";
    default: {
      const mcp = parseMcpToolName(toolName);
      return mcp.isMcp ? "text-violet-400" : "text-muted-foreground";
    }
  }
}

/** 도구 실행 시간 계산 훅 */
export function useElapsed(
  status: "running" | "done" | "error" | undefined,
  timestamp: string | undefined,
  completedAt: string | undefined,
): string | null {
  return useMemo(() => {
    if (status !== "done" && status !== "error") return null;
    if (!timestamp || !completedAt) return null;
    const start = new Date(timestamp).getTime();
    const end = new Date(completedAt).getTime();
    const diff = (end - start) / 1000;
    if (diff < 0 || !Number.isFinite(diff)) return null;
    return diff < 1 ? `${(diff * 1000).toFixed(0)}ms` : `${diff.toFixed(1)}s`;
  }, [status, timestamp, completedAt]);
}

/** 파일 확장자에서 언어명 추출 */
export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    rb: "ruby",
    css: "css",
    scss: "scss",
    html: "html",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    md: "markdown",
    sh: "bash",
    bash: "bash",
    sql: "sql",
    xml: "xml",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    vue: "vue",
    svelte: "svelte",
  };
  return map[ext] || "text";
}
