import { memo, useCallback, useRef } from "react";
import { GripHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemoStore } from "@/store";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { MemoBlockList } from "./MemoBlockList";

const PANEL_W = 400;
const PANEL_H = 600;

// position이 null이면 기본 위치 (우하단)
const DEFAULT_STYLE = { bottom: 48, right: 16 };

export const MemoPanel = memo(function MemoPanel() {
  const isOpen = useMemoStore((s) => s.isOpen);
  const position = useMemoStore((s) => s.position);
  const setMemoOpen = useMemoStore((s) => s.setMemoOpen);
  const setPosition = useMemoStore((s) => s.setPosition);
  const isMobile = useIsMobile();
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // X 버튼 클릭은 드래그 시작하지 않음
    if ((e.target as HTMLElement).closest("button")) return;

    dragging.current = true;
    const panelEl = (e.currentTarget as HTMLElement).parentElement!;
    const rect = panelEl.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const x = Math.max(0, Math.min(e.clientX - offset.current.x, window.innerWidth - PANEL_W));
      const y = Math.max(0, Math.min(e.clientY - offset.current.y, window.innerHeight - PANEL_H));
      setPosition({ x, y });
    },
    [setPosition],
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  if (!isOpen) return null;

  const posStyle = isMobile
    ? {}
    : position
      ? { left: position.x, top: position.y }
      : DEFAULT_STYLE;

  return (
    <div
      className="fixed flex flex-col inset-0 pt-safe pb-safe px-safe md:inset-auto md:w-[400px] md:h-[600px] md:rounded-lg md:pt-0 md:pb-0 md:px-0 border-border bg-background md:border md:shadow-lg"
      style={{ zIndex: 55, ...posStyle }}
    >
      {/* 헤더 - 드래그 핸들 (데스크톱만) */}
      <div
        className="flex items-center justify-between px-3 h-9 shrink-0 border-b border-border select-none md:cursor-grab md:active:cursor-grabbing"
        onPointerDown={isMobile ? undefined : handlePointerDown}
        onPointerMove={isMobile ? undefined : handlePointerMove}
        onPointerUp={isMobile ? undefined : handlePointerUp}
      >
        <div className="flex items-center gap-1.5">
          <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground hidden md:block" />
          <span className="text-xs font-medium font-mono">Memo</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 touch-target-expand"
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
