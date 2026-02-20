export type AnalyticsPeriod = "today" | "7d" | "30d" | "all";

export interface TokenSummary {
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
  total_cache_creation_tokens: number;
  total_sessions: number;
  total_messages: number;
  avg_tokens_per_session: number;
}

export interface DailyTokenUsage {
  date: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  active_sessions: number;
}

export interface SessionTokenRanking {
  session_id: string;
  session_name: string | null;
  work_dir: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  message_count: number;
  model: string | null;
}

export interface ProjectTokenUsage {
  work_dir: string;
  project_name: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  session_count: number;
}

export interface AnalyticsResponse {
  period: string;
  start_date: string;
  end_date: string;
  summary: TokenSummary;
  daily_usage: DailyTokenUsage[];
  session_ranking: SessionTokenRanking[];
  project_usage: ProjectTokenUsage[];
}
