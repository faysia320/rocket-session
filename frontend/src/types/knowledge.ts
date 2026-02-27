/**
 * 워크스페이스 인사이트(Knowledge Base) 타입 정의.
 */

export type InsightCategory = "pattern" | "gotcha" | "decision" | "file_map" | "dependency";

export interface WorkspaceInsightInfo {
  id: number;
  workspace_id: string;
  session_id: string | null;
  category: InsightCategory;
  title: string;
  content: string;
  relevance_score: number;
  tags: string[] | null;
  file_paths: string[] | null;
  is_auto_generated: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateInsightRequest {
  category: InsightCategory;
  title: string;
  content: string;
  tags?: string[];
  file_paths?: string[];
}

export interface UpdateInsightRequest {
  title?: string;
  content?: string;
  category?: InsightCategory;
  tags?: string[];
  file_paths?: string[];
  relevance_score?: number;
}

export interface ExtractInsightsRequest {
  session_id: string;
}

export interface InsightContextResponse {
  insights: WorkspaceInsightInfo[];
  context_text: string;
}
