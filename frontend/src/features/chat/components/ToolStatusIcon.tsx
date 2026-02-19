/** 도구 실행 상태 아이콘 (✓ / ✕ / spinner) */
export function ToolStatusIcon({ status }: { status?: "running" | "done" | "error" }) {
  if (status === "done") {
    return (
      <span className="text-success text-xs font-bold shrink-0">
        {"\u2713"}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-destructive text-xs font-bold shrink-0">
        {"\u2715"}
      </span>
    );
  }
  return (
    <span className="inline-block w-3 h-3 border-[1.5px] border-info/40 border-t-info rounded-full animate-spin shrink-0" />
  );
}
