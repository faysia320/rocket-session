/** 글로벌 설정 타입 */
export interface GlobalSettings {
  root_dir?: string;
  work_dir?: string | null;
  allowed_tools?: string | null;
  system_prompt?: string | null;
  timeout_seconds?: number | null;
  mode?: "normal" | "plan";
  permission_mode?: boolean;
  permission_required_tools?: string[] | null;
  model?: string | null;
  max_turns?: number | null;
  max_budget_usd?: number | null;
  system_prompt_mode?: string | null;
  disallowed_tools?: string | null;
}

/** 글로벌 설정 업데이트 요청 타입 */
export type UpdateGlobalSettingsRequest = Partial<GlobalSettings>;
