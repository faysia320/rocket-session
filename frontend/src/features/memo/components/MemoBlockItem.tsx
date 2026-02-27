import { memo, useCallback, useEffect, useRef, useState } from "react";
import { MemoBlockEditor } from "./MemoBlockEditor";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { useUpdateMemoBlock } from "../hooks/useMemo";
import type { MemoBlockInfo } from "@/types";

interface MemoBlockItemProps {
  block: MemoBlockInfo;
  index: number;
  onCreateAfter: () => void;
  onDelete: () => void;
  autoFocus?: boolean;
}

const AUTO_SAVE_DELAY = 500;

export const MemoBlockItem = memo(function MemoBlockItem({
  block,
  index,
  onCreateAfter,
  onDelete,
  autoFocus = false,
}: MemoBlockItemProps) {
  const updateBlock = useUpdateMemoBlock();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingContentRef = useRef<string | null>(null);
  const contentRef = useRef(block.content);

  const [isEditing, setIsEditing] = useState(
    autoFocus || !block.content.trim(),
  );

  const flushSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    if (pendingContentRef.current !== null) {
      updateBlock.mutate({
        id: block.id,
        data: { content: pendingContentRef.current },
      });
      pendingContentRef.current = null;
    }
  }, [block.id, updateBlock]);

  // unmount 시 pending flush
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingContentRef.current !== null) {
        updateBlock.mutate({
          id: block.id,
          data: { content: pendingContentRef.current },
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContentChange = useCallback(
    (newContent: string) => {
      pendingContentRef.current = newContent;
      contentRef.current = newContent;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flushSave, AUTO_SAVE_DELAY);
    },
    [flushSave],
  );

  const handleBlur = useCallback(() => {
    flushSave();
    if (contentRef.current.trim()) {
      setIsEditing(false);
    }
  }, [flushSave]);

  const handlePreviewClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const isEven = index % 2 === 0;

  return (
    <div
      className={`flex border-b border-border/50 ${isEven ? "bg-background" : "bg-muted/30"}`}
    >
      <div className="flex-shrink-0 w-8 pt-2 text-right text-[11px] text-muted-foreground/50 select-none font-mono">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <MemoBlockEditor
            initialContent={contentRef.current}
            onChange={handleContentChange}
            onCtrlEnter={onCreateAfter}
            onBackspaceEmpty={onDelete}
            autoFocus={autoFocus}
            onBlur={handleBlur}
          />
        ) : (
          <div
            className="px-3 py-2 cursor-text min-h-[2em]"
            onClick={handlePreviewClick}
          >
            <MarkdownRenderer
              content={contentRef.current}
              className="text-[13px]"
            />
          </div>
        )}
      </div>
    </div>
  );
});
