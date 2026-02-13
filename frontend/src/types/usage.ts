/** 5시간 블록 사용량 */
export interface BlockUsage {
  total_tokens: number;
  cost_usd: number;
  is_active: boolean;
  time_remaining: string;
  burn_rate: number;
}

/** 주간 사용량 */
export interface WeeklyUsage {
  total_tokens: number;
  cost_usd: number;
  models_used: string[];
}

/** 전체 사용량 정보 */
export interface UsageInfo {
  plan: string;
  account_id: string;
  block_5h: BlockUsage;
  weekly: WeeklyUsage;
  available: boolean;
  error: string | null;
}
