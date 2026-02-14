/** 기간별 사용량 (5시간 블록 / 주간) */
export interface PeriodUsage {
  utilization: number; // 0-100
  resets_at: string | null;
}

/** 전체 사용량 정보 */
export interface UsageInfo {
  five_hour: PeriodUsage;
  seven_day: PeriodUsage;
  available: boolean;
  error: string | null;
}
