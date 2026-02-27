import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useMemoBlocks,
  useCreateMemoBlock,
  useDeleteMemoBlock,
} from "../hooks/useMemo";
import { MemoBlockItem } from "./MemoBlockItem";

export const MemoBlockList = memo(function MemoBlockList() {
  const { data: blocks = [], isLoading } = useMemoBlocks();
  const createBlock = useCreateMemoBlock();
  const deleteBlock = useDeleteMemoBlock();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [newBlockId, setNewBlockId] = useState<string | null>(null);
  const prevBlockCount = useRef(blocks.length);
  const autoCreatedRef = useRef(false);

  const handleCreateBlock = useCallback(
    (afterBlockId?: string) => {
      createBlock.mutate(
        { after_block_id: afterBlockId ?? null },
        {
          onSuccess: (newBlock) => {
            setNewBlockId(newBlock.id);
          },
        },
      );
    },
    [createBlock],
  );

  const handleDeleteBlock = useCallback(
    (blockId: string) => {
      deleteBlock.mutate(blockId);
    },
    [deleteBlock],
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
      const scrollContainer = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
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
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="flex flex-col">
        {blocks.map((block) => (
          <MemoBlockItem
            key={block.id}
            block={block}
            onCreateAfter={() => handleCreateBlock(block.id)}
            onDelete={() => handleDeleteBlock(block.id)}
            autoFocus={block.id === newBlockId}
          />
        ))}
      </div>
    </ScrollArea>
  );
});
