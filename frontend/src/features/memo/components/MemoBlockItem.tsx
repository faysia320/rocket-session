import { memo, useCallback, useEffect, useRef } from "react";
import { MemoBlockEditor } from "./MemoBlockEditor";
import { useUpdateMemoBlock } from "../hooks/useMemo";
import type { MemoBlockInfo } from "@/types";
import type { MemoEditorRegistry } from "../hooks/useMemoEditorRegistry";

interface MemoBlockItemProps {
  block: MemoBlockInfo;
  index: number;
  editorRegistry: MemoEditorRegistry;
  onCreateAfter: () => void;
  onDeleteAndFocusPrevious: (blockId: string) => void;
  onMergeWithPrevious: (blockId: string, currentContent: string) => void;
  autoFocus?: boolean;
}

const AUTO_SAVE_DELAY = 500;

export const MemoBlockItem = memo(function MemoBlockItem({
  block,
  index,
  editorRegistry,
  onCreateAfter,
  onDeleteAndFocusPrevious,
  onMergeWithPrevious,
  autoFocus = false,
}: MemoBlockItemProps) {
  const updateBlock = useUpdateMemoBlock();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingContentRef = useRef<string | null>(null);
  const contentRef = useRef(block.content);
  const deletedRef = useRef(false);

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

  // unmount 시 pending flush (삭제된 블록은 스킵)
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingContentRef.current !== null && !deletedRef.current) {
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
  }, [flushSave]);

  // 빈 블록 Backspace → 삭제 후 이전 블록 포커스
  const handleBackspaceEmpty = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    pendingContentRef.current = null;
    deletedRef.current = true;
    onDeleteAndFocusPrevious(block.id);
  }, [block.id, onDeleteAndFocusPrevious]);

  // 커서가 맨 앞에서 Backspace → 이전 블록과 병합
  const handleBackspaceAtStart = useCallback(() => {
    flushSave();
    onMergeWithPrevious(block.id, contentRef.current);
  }, [block.id, flushSave, onMergeWithPrevious]);

  const isEven = index % 2 === 0;

  return (
    <div
      className={`border-b border-border/50 ${isEven ? "bg-background" : "bg-muted/30"}`}
    >
      <div className="min-w-0">
        <MemoBlockEditor
          blockId={block.id}
          editorRegistry={editorRegistry}
          initialContent={contentRef.current}
          onChange={handleContentChange}
          onCtrlEnter={onCreateAfter}
          onBackspaceEmpty={handleBackspaceEmpty}
          onBackspaceAtStart={handleBackspaceAtStart}
          autoFocus={autoFocus}
          onBlur={handleBlur}
        />
      </div>
    </div>
  );
});
