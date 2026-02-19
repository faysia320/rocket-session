import type { Message, ToolUseMsg } from "@/types";

/** Plan 파일 경로 패턴: .claude/plans/ 하위의 .md 파일 */
const PLAN_FILE_PATTERN = /\.claude\/plans\/[^/]+\.md$/;

/** result 텍스트가 "간략한" 수준인지 판단하는 글자 수 기준 */
const BRIEF_TEXT_THRESHOLD = 200;

/**
 * 같은 턴의 메시지에서 plan 파일에 Write된 content를 추출한다.
 * result 텍스트가 이미 충분히 길면(200자 이상) 추출하지 않는다.
 */
export function extractPlanFileContent(
  messages: Message[],
  resultText: string | undefined,
): string | undefined {
  if (resultText && resultText.length >= BRIEF_TEXT_THRESHOLD) {
    return undefined;
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.type === "user_message" || msg.type === "result") break;

    if (msg.type === "tool_use") {
      const t = msg as ToolUseMsg;
      const path = String(t.input?.file_path ?? t.input?.path ?? "");
      if (
        t.tool === "Write" &&
        PLAN_FILE_PATTERN.test(path) &&
        t.input?.content &&
        typeof t.input.content === "string"
      ) {
        return t.input.content;
      }
    }
  }

  return undefined;
}
