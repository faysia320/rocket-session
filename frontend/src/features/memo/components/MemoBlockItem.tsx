import { memo, useCallback, useEffect, useRef } from "react";
import { MemoBlockEditor } from "./MemoBlockEditor";
import { useUpdateMemoBlock } from "../hooks/useMemo";
import type { MemoBlockInfo } from "@/types";

interface MemoBlockItemProps {
  block: MemoBlockInfo;
  onCreateAfter: () => void;
  onDelete: () => void;
  autoFocus?: boolean;
}

const AUTO_SAVE_DELAY = 500;

export const MemoBlockItem = memo(function MemoBlockItem({
  block,
  onCreateAfter,
  onDelete,
  autoFocus = false,
}: MemoBlockItemProps) {
  const updateBlock = useUpdateMemoBlock();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingContentRef = useRef<string | null>(null);

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
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flushSave, AUTO_SAVE_DELAY);
    },
    [flushSave],
  );

  return (
    <div className="border-b border-border/50">
      <MemoBlockEditor
        initialContent={block.content}
        onChange={handleContentChange}
        onCtrlEnter={onCreateAfter}
        onBackspaceEmpty={onDelete}
        autoFocus={autoFocus}
      />
    </div>
  );
});
