/**
 * Claude Code Memory 타입 정의.
 */

export type MemorySource = "auto_memory" | "claude_md" | "rules";

export interface MemoryFileInfo {
  name: string;
  relative_path: string;
  source: MemorySource;
  size_bytes: number;
}

export interface MemoryFileContent {
  name: string;
  relative_path: string;
  source: MemorySource;
  content: string;
}

export interface MemoryContextResponse {
  memory_files: MemoryFileInfo[];
  context_text: string;
}
