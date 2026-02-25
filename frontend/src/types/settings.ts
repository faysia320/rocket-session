/** 글로벌 설정 타입 */
export interface GlobalSettings {
  default_workspace_id?: string | null;
  allowed_tools?: string | null;
  system_prompt?: string | null;
  timeout_seconds?: number | null;
  workflow_enabled?: boolean;
  permission_mode?: boolean;
  permission_required_tools?: string[] | null;
  model?: string | null;
  max_turns?: number | null;
  max_budget_usd?: number | null;
  system_prompt_mode?: string | null;
  disallowed_tools?: string | null;
  mcp_server_ids?: string[] | null;
  globally_trusted_tools?: string[] | null;
  default_additional_workspace_ids?: string[] | null;
  fallback_model?: string | null;
}

/** 글로벌 설정 업데이트 요청 타입 */
export type UpdateGlobalSettingsRequest = Partial<GlobalSettings>;
