import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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

        {blocks.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <Button
              variant="ghost"
              className="text-xs text-muted-foreground"
              onClick={() => handleCreateBlock()}
            >
              <Plus className="h-4 w-4 mr-1" />
              첫 메모 블록 만들기
            </Button>
          </div>
        ) : (
          <div className="flex justify-center py-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground h-7"
              onClick={() => handleCreateBlock()}
            >
              <Plus className="h-3 w-3 mr-1" />
              블록 추가
            </Button>
          </div>
        )}
      </div>
    </ScrollArea>
  );
});
