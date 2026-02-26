import type { Message, ResultMsg } from "@/types";
import { getMessageText } from "@/types";

const TIGHT_TYPES = new Set(["tool_use", "tool_result", "stderr"]);
const TIGHT_PREV_TYPES = new Set(["assistant_text", "tool_use", "tool_result", "stderr"]);

/**
 * virtualizer의 estimateSize 콜백에 사용되는 메시지 높이 추정.
 */
export function computeEstimateSize(msg: Message | undefined): number {
  if (!msg) return 60;
  switch (msg.type) {
    case "result":
      if ((msg as ResultMsg).workflow_phase && (msg as ResultMsg).workflow_phase !== "implement") return 500;
      return 200;
    case "assistant_text":
      return 150;
    case "ask_user_question":
      return 300;
    case "tool_use":
      return 44;
    case "system":
    case "stderr":
      return 28;
    default:
      return 60;
  }
}

/**
 * 같은 턴 내 연속 메시지 간격 계산 (assistant 턴 그룹핑).
 * 'tight' = 같은 assistant 턴 내 연속
 * 'normal' = 턴 경계
 * 'turn-start' = user_message 직전 (넉넉한 여백)
 */
export function computeMessageGaps(messages: Message[]): Array<"tight" | "normal" | "turn-start"> {
  return messages.map((msg, i) => {
    if (i === 0) return "normal" as const;
    const prev = messages[i - 1];
    // user_message 앞에 넉넉한 여백
    if (msg.type === "user_message" && prev.type !== "user_message") return "turn-start" as const;
    if (TIGHT_TYPES.has(msg.type) && TIGHT_PREV_TYPES.has(prev.type)) return "tight" as const;
    return "normal" as const;
  });
}

/**
 * 검색 쿼리에 매칭되는 메시지의 인덱스 목록 반환.
 */
export function computeSearchMatches(messages: Message[], query: string): number[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return messages
    .map((m, i) => ({
      index: i,
      match: getMessageText(m).toLowerCase().includes(q),
    }))
    .filter((r) => r.match)
    .map((r) => r.index);
}
