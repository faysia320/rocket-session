/**
 * 태그 선택 Popover 컴포넌트.
 * 기존 태그 체크박스 선택 + 인라인 태그 생성 지원.
 */
import { useState } from "react";
import { Tag, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTags, useCreateTag } from "../hooks/useTags";
import type { TagInfo } from "@/types";

const TAG_COLOR_PRESETS = [
  "#6366f1",
  "#22c55e",
  "#ef4444",
  "#f59e0b",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#6b7280",
];

interface TagPickerProps {
  selectedTagIds: string[];
  onToggle: (tagId: string, selected: boolean) => void;
  triggerClassName?: string;
}

export function TagPicker({
  selectedTagIds,
  onToggle,
  triggerClassName,
}: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();

  const handleCreate = async () => {
    const name = newTagName.trim();
    if (!name) return;

    const randomColor =
      TAG_COLOR_PRESETS[Math.floor(Math.random() * TAG_COLOR_PRESETS.length)];

    try {
      const newTag = await createTag.mutateAsync({
        name,
        color: randomColor,
      });
      onToggle(newTag.id, true);
      setNewTagName("");
      setShowCreate(false);
    } catch {
      // 에러 토스트는 useMutation에서 처리
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-7 gap-1 px-2 text-xs", triggerClassName)}
          aria-label="태그 추가"
        >
          <Tag className="h-3 w-3" />
          <span>태그</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-1">
          {tags.length === 0 && !showCreate ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              태그가 없습니다
            </p>
          ) : null}
          {tags.map((tag: TagInfo) => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => onToggle(tag.id, !isSelected)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1 truncate text-left">{tag.name}</span>
                {isSelected ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : null}
              </button>
            );
          })}

          {showCreate ? (
            <div className="flex items-center gap-1 pt-1">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") {
                    setShowCreate(false);
                    setNewTagName("");
                  }
                }}
                placeholder="태그 이름…"
                className="h-7 text-xs"
                autoFocus
                maxLength={50}
              />
              <Button
                size="sm"
                className="h-7 px-2"
                onClick={handleCreate}
                disabled={!newTagName.trim() || createTag.isPending}
              >
                추가
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              <span>새 태그 만들기</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
