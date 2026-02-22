export interface TemplateInfo {
  id: string;
  name: string;
  description?: string | null;
  work_dir?: string | null;
  system_prompt?: string | null;
  allowed_tools?: string | null;
  disallowed_tools?: string | null;
  timeout_seconds?: number | null;
  mode?: string;
  permission_mode?: boolean;
  permission_required_tools?: string[] | null;
  model?: string | null;
  max_turns?: number | null;
  max_budget_usd?: number | null;
  system_prompt_mode?: string | null;
  mcp_server_ids?: string[] | null;
  additional_dirs?: string[] | null;
  fallback_model?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string | null;
  work_dir?: string | null;
  system_prompt?: string | null;
  allowed_tools?: string | null;
  disallowed_tools?: string | null;
  timeout_seconds?: number | null;
  mode?: string | null;
  permission_mode?: boolean | null;
  permission_required_tools?: string[] | null;
  model?: string | null;
  max_turns?: number | null;
  max_budget_usd?: number | null;
  system_prompt_mode?: string | null;
  mcp_server_ids?: string[] | null;
  additional_dirs?: string[] | null;
  fallback_model?: string | null;
}

export type UpdateTemplateRequest = Partial<CreateTemplateRequest>;

export interface CreateTemplateFromSessionRequest {
  name: string;
  description?: string | null;
}

export interface TemplateExport {
  version: number;
  template: TemplateInfo;
}
