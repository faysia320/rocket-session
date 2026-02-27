import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useMemoBlocks,
  useCreateMemoBlock,
  useDeleteMemoBlock,
  useUpdateMemoBlock,
} from "../hooks/useMemo";
import { MemoBlockItem } from "./MemoBlockItem";
import { useMemoEditorRegistry } from "../hooks/useMemoEditorRegistry";
import { useMemoUndoStack } from "../hooks/useMemoUndoStack";

export const MemoBlockList = memo(function MemoBlockList() {
  const { data: blocks = [], isLoading } = useMemoBlocks();
  const createBlock = useCreateMemoBlock();
  const deleteBlock = useDeleteMemoBlock();
  const updateBlock = useUpdateMemoBlock();
  const editorRegistry = useMemoEditorRegistry();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [newBlockId, setNewBlockId] = useState<string | null>(null);
  const prevBlockCount = useRef(blocks.length);
  const autoCreatedRef = useRef(false);
  // undo 실행 중 플래그 — undo가 만드는 create/delete가 다시 스택에 push되지 않도록
  const isUndoingRef = useRef(false);

  const handleCreateBlock = useCallback(
    (afterBlockId?: string) => {
      createBlock.mutate(
        { after_block_id: afterBlockId ?? null },
        {
          onSuccess: (newBlock) => {
            setNewBlockId(newBlock.id);
            // undo 실행 중이 아닐 때만 스택에 push
            if (!isUndoingRef.current) {
              useMemoUndoStack.getState().push({
                type: "create_block",
                blockId: newBlock.id,
                timestamp: Date.now(),
              });
            }
          },
        },
      );
    },
    [createBlock],
  );

  // 빈 블록 삭제 + 이전 블록 포커스
  const handleDeleteAndFocusPrevious = useCallback(
    (blockId: string) => {
      const blockIndex = blocks.findIndex((b) => b.id === blockId);
      const prevBlock = blockIndex > 0 ? blocks[blockIndex - 1] : null;

      // undo 스택에 push
      if (!isUndoingRef.current) {
        const content = editorRegistry.getContent(blockId) ?? "";
        useMemoUndoStack.getState().push({
          type: "delete_block",
          blockId,
          content,
          previousBlockId: prevBlock?.id ?? null,
          timestamp: Date.now(),
        });
      }

      deleteBlock.mutate(blockId);

      if (prevBlock) {
        requestAnimationFrame(() => {
          editorRegistry.focusEnd(prevBlock.id);
        });
      }
    },
    [blocks, deleteBlock, editorRegistry],
  );

  // 이전 블록과 병합
  const handleMergeWithPrevious = useCallback(
    (blockId: string, currentContent: string) => {
      const blockIndex = blocks.findIndex((b) => b.id === blockId);
      if (blockIndex <= 0) return; // 첫 번째 블록이면 무시

      const prevBlock = blocks[blockIndex - 1];
      const prevContent = editorRegistry.getContent(prevBlock.id) ?? "";
      const joinPosition = prevContent.length;

      // undo 스택에 push (병합 전 상태 기록)
      if (!isUndoingRef.current) {
        useMemoUndoStack.getState().push({
          type: "merge_blocks",
          deletedBlockId: blockId,
          deletedBlockContent: currentContent,
          targetBlockId: prevBlock.id,
          targetOriginalContent: prevContent,
          timestamp: Date.now(),
        });
      }

      // 1. 이전 에디터에 현재 블록 내용 추가
      editorRegistry.setContent(prevBlock.id, prevContent + currentContent);

      // 2. 현재 블록 삭제
      deleteBlock.mutate(blockId);

      // 3. 이전 블록 저장
      updateBlock.mutate({
        id: prevBlock.id,
        data: { content: prevContent + currentContent },
      });

      // 4. 포커스를 합류 지점으로 이동
      requestAnimationFrame(() => {
        editorRegistry.focusAt(prevBlock.id, joinPosition);
      });
    },
    [blocks, deleteBlock, updateBlock, editorRegistry],
  );

  // --- Ctrl+Z 구조적 Undo ---
  const handleUndo = useCallback(() => {
    const action = useMemoUndoStack.getState().pop();
    if (!action) return;

    isUndoingRef.current = true;

    switch (action.type) {
      case "delete_block": {
        // 삭제된 블록 복원
        createBlock.mutate(
          {
            content: action.content,
            after_block_id: action.previousBlockId,
          },
          {
            onSuccess: (newBlock) => {
              setNewBlockId(newBlock.id);
              requestAnimationFrame(() => {
                editorRegistry.focusEnd(newBlock.id);
              });
              isUndoingRef.current = false;
            },
            onError: () => {
              isUndoingRef.current = false;
            },
          },
        );
        break;
      }

      case "create_block": {
        // 생성된 블록 삭제
        deleteBlock.mutate(action.blockId, {
          onSettled: () => {
            isUndoingRef.current = false;
          },
        });
        break;
      }

      case "merge_blocks": {
        // 1. 대상 블록 원본 내용 복원
        editorRegistry.setContent(action.targetBlockId, action.targetOriginalContent);
        updateBlock.mutate({
          id: action.targetBlockId,
          data: { content: action.targetOriginalContent },
        });

        // 2. 삭제된 블록 재생성
        createBlock.mutate(
          {
            content: action.deletedBlockContent,
            after_block_id: action.targetBlockId,
          },
          {
            onSuccess: (newBlock) => {
              setNewBlockId(newBlock.id);
              requestAnimationFrame(() => {
                editorRegistry.focusAt(newBlock.id, 0);
              });
              isUndoingRef.current = false;
            },
            onError: () => {
              isUndoingRef.current = false;
            },
          },
        );
        break;
      }
    }
  }, [createBlock, deleteBlock, updateBlock, editorRegistry]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        if (useMemoUndoStack.getState().lastActionWasStructural) {
          e.preventDefault();
          e.stopPropagation();
          handleUndo();
        }
        // 아니면 브라우저 기본 텍스트 undo가 처리
      }
    },
    [handleUndo],
  );

  // 블록이 0개면 자동으로 첫 블록 생성
  useEffect(() => {
    if (!isLoading && blocks.length === 0 && !autoCreatedRef.current && !createBlock.isPending) {
      autoCreatedRef.current = true;
      handleCreateBlock();
    }
    if (blocks.length > 0) {
      autoCreatedRef.current = false;
    }
  }, [isLoading, blocks.length, handleCreateBlock, createBlock.isPending]);

  // 새 블록 생성 시 스크롤
  useEffect(() => {
    if (blocks.length > prevBlockCount.current && scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        requestAnimationFrame(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        });
      }
    }
    prevBlockCount.current = blocks.length;
  }, [blocks.length]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center flex-1 text-xs text-muted-foreground">
        로딩 중...
      </div>
    );
  }

  return (
    <div onKeyDown={handleKeyDown} className="flex-1 flex flex-col min-h-0">
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="flex flex-col select-text">
          {blocks.map((block, index) => (
            <MemoBlockItem
              key={block.id}
              block={block}
              index={index}
              editorRegistry={editorRegistry}
              onCreateAfter={() => handleCreateBlock(block.id)}
              onDeleteAndFocusPrevious={handleDeleteAndFocusPrevious}
              onMergeWithPrevious={handleMergeWithPrevious}
              autoFocus={block.id === newBlockId}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
});
