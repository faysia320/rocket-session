import { memo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemoStore } from "@/store";
import { MemoBlockList } from "./MemoBlockList";

export const MemoPanel = memo(function MemoPanel() {
  const isOpen = useMemoStore((s) => s.isOpen);
  const setMemoOpen = useMemoStore((s) => s.setMemoOpen);

  if (!isOpen) return null;

  return (
    <div
      className="fixed bottom-12 right-4 w-[400px] h-[600px] hidden sm:flex flex-col rounded-lg border border-border bg-background shadow-lg"
      style={{ zIndex: 55 }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 h-9 shrink-0 border-b border-border">
        <span className="text-xs font-medium font-mono">Memo</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setMemoOpen(false)}
          aria-label="메모 닫기"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* 바디 */}
      <MemoBlockList />
    </div>
  );
});
