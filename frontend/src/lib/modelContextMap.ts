/**
 * 모델별 context window 크기 매핑.
 * Claude CLI가 반환하는 model 필드 (예: "claude-sonnet-4-20250514")에서 매칭.
 */
export const MODEL_CONTEXT_MAP: Record<string, number> = {
  // Opus 4
  "claude-opus-4": 200_000,
  // Sonnet 4
  "claude-sonnet-4": 200_000,
  // Haiku 3.5
  "claude-haiku-3.5": 200_000,
  "claude-3-5-haiku": 200_000,
  // Sonnet 3.5
  "claude-sonnet-3.5": 200_000,
  "claude-3-5-sonnet": 200_000,
  // 기본값
  default: 200_000,
};

/**
 * 모델명에서 context window 크기를 조회합니다.
 * 정확한 매칭 → prefix 매칭 → default 순으로 폴백.
 */
export function getContextWindowSize(model?: string | null): number {
  if (!model) return MODEL_CONTEXT_MAP.default;

  // 정확한 매칭
  if (MODEL_CONTEXT_MAP[model]) return MODEL_CONTEXT_MAP[model];

  // prefix 매칭 (예: "claude-sonnet-4-20250514" → "claude-sonnet-4")
  for (const [key, value] of Object.entries(MODEL_CONTEXT_MAP)) {
    if (key !== "default" && model.startsWith(key)) return value;
  }

  return MODEL_CONTEXT_MAP.default;
}

/**
 * 모델명에서 짧은 표시명을 추출합니다.
 * "claude-sonnet-4-20250514" → "Sonnet 4"
 * "claude-opus-4-20250514" → "Opus 4"
 */
export function getModelDisplayName(model?: string | null): string | null {
  if (!model) return null;
  const lower = model.toLowerCase();
  if (lower.includes("opus-4")) return "Opus 4";
  if (lower.includes("opus")) return "Opus";
  if (lower.includes("sonnet-4")) return "Sonnet 4";
  if (lower.includes("sonnet-3") || lower.includes("3-5-sonnet"))
    return "Sonnet 3.5";
  if (lower.includes("haiku-3") || lower.includes("3-5-haiku"))
    return "Haiku 3.5";
  if (lower.includes("haiku")) return "Haiku";
  if (lower.includes("sonnet")) return "Sonnet";
  return model;
}
