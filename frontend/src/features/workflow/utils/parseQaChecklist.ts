export interface QaChecklistItem {
  item: string;
  status: "pass" | "fail" | "warn";
  detail: string;
}

export interface QaChecklistResult {
  all_passed: boolean;
  items: QaChecklistItem[];
  summary: { pass: number; fail: number; warn: number };
}

/**
 * QA 아티팩트 콘텐츠에서 체크리스트 결과를 파싱.
 * 백엔드 WorkflowService.parse_qa_checklist() 와 동일한 로직.
 */
export function parseQaChecklist(content: string): QaChecklistResult {
  const items: QaChecklistItem[] = [];

  // 패턴 1: 마크다운 체크박스 `- [x]` / `- [ ]`
  const checkboxPattern = /-\s*\[(x|X| )\]\s*(.+?)$/gm;
  let match: RegExpExecArray | null;
  while ((match = checkboxPattern.exec(content)) !== null) {
    const checked = match[1].trim().toLowerCase() === "x";
    items.push({
      item: match[2].trim(),
      status: checked ? "pass" : "fail",
      detail: "",
    });
  }

  // 패턴 2: [PASS]/[FAIL]/[WARN] 형식 (체크박스가 없을 때만)
  if (items.length === 0) {
    const tagPattern = /\[(PASS|FAIL|WARN)\]\s*[:\-\u2013]?\s*(.+?)(?:\s*[:\-\u2013]\s*(.+))?$/gim;
    while ((match = tagPattern.exec(content)) !== null) {
      const status = match[1].toLowerCase() as "pass" | "fail" | "warn";
      items.push({
        item: match[2].trim(),
        status,
        detail: (match[3] ?? "").trim(),
      });
    }
  }

  // 파싱 실패 시 단일 warn 항목
  if (items.length === 0) {
    items.push({
      item: "Manual review required",
      status: "warn",
      detail: content.slice(0, 200),
    });
  }

  const summary = {
    pass: items.filter((i) => i.status === "pass").length,
    fail: items.filter((i) => i.status === "fail").length,
    warn: items.filter((i) => i.status === "warn").length,
  };

  return {
    all_passed: summary.fail === 0,
    items,
    summary,
  };
}
