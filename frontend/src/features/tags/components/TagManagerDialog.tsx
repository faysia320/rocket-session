/**
 * 전체 태그 관리 Dialog.
 * 태그 CRUD (생성, 이름/색상 수정, 삭제).
 */
import { useState } from "react";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
} from "../hooks/useTags";
import type { TagInfo } from "@/types";

const TAG_COLOR_PRESETS = [
  { color: "#6366f1", name: "인디고" },
  { color: "#22c55e", name: "그린" },
  { color: "#ef4444", name: "레드" },
  { color: "#f59e0b", name: "앰버" },
  { color: "#3b82f6", name: "블루" },
  { color: "#a855f7", name: "퍼플" },
  { color: "#ec4899", name: "핑크" },
  { color: "#6b7280", name: "그레이" },
];

interface TagManagerDialogProps {
  trigger: React.ReactNode;
}

export function TagManagerDialog({ trigger }: TagManagerDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>태그 관리</DialogTitle>
        </DialogHeader>
        <TagManagerContent />
      </DialogContent>
    </Dialog>
  );
}

function TagManagerContent() {
  const { data: tags = [] } = useTags();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <CreateTagRow />
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {tags.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            태그가 없습니다. 위에서 새 태그를 만들어보세요.
          </p>
        ) : null}
        {tags.map((tag: TagInfo) =>
          editingId === tag.id ? (
            <EditTagRow
              key={tag.id}
              tag={tag}
              onDone={() => setEditingId(null)}
            />
          ) : (
            <TagRow
              key={tag.id}
              tag={tag}
              onEdit={() => setEditingId(tag.id)}
            />
          ),
        )}
      </div>
    </div>
  );
}

function CreateTagRow() {
  const [name, setName] = useState("");
  const [color, setColor] = useState(TAG_COLOR_PRESETS[0].color);
  const createTag = useCreateTag();

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createTag.mutateAsync({ name: trimmed, color });
      setName("");
      setColor(TAG_COLOR_PRESETS[0].color);
    } catch {
      // 에러 토스트는 훅에서 처리
    }
  };

  return (
    <div className="flex items-center gap-2">
      <ColorPicker selected={color} onSelect={setColor} />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCreate();
        }}
        placeholder="새 태그 이름…"
        className="h-8 flex-1 text-sm"
        maxLength={50}
      />
      <Button
        size="sm"
        className="h-8"
        onClick={handleCreate}
        disabled={!name.trim() || createTag.isPending}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        추가
      </Button>
    </div>
  );
}

function TagRow({ tag, onEdit }: { tag: TagInfo; onEdit: () => void }) {
  const deleteTag = useDeleteTag();

  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5">
      <span
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: tag.color }}
      />
      <span className="flex-1 truncate text-sm">{tag.name}</span>
      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onEdit}
          aria-label={`${tag.name} 태그 수정`}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
          onClick={() => deleteTag.mutate(tag.id)}
          disabled={deleteTag.isPending}
          aria-label={`${tag.name} 태그 삭제`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function EditTagRow({ tag, onDone }: { tag: TagInfo; onDone: () => void }) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const updateTag = useUpdateTag();

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await updateTag.mutateAsync({
        id: tag.id,
        data: { name: trimmed, color },
      });
      onDone();
    } catch {
      // 에러 토스트는 훅에서 처리
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5">
      <ColorPicker selected={color} onSelect={setColor} />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") onDone();
        }}
        className="h-7 flex-1 text-sm"
        autoFocus
        maxLength={50}
      />
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={handleSave}
        disabled={!name.trim() || updateTag.isPending}
        aria-label="저장"
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={onDone}
        aria-label="취소"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function ColorPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-6 w-6 shrink-0 rounded-full border-2 border-transparent ring-1 ring-border transition-shadow hover:ring-2 hover:ring-primary"
        style={{ backgroundColor: selected }}
        aria-label="색상 선택"
      />
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 grid grid-cols-4 gap-1 rounded-md border bg-popover p-2 shadow-md">
          {TAG_COLOR_PRESETS.map((preset) => (
            <button
              key={preset.color}
              type="button"
              onClick={() => {
                onSelect(preset.color);
                setOpen(false);
              }}
              className={cn(
                "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                selected === preset.color
                  ? "border-foreground"
                  : "border-transparent",
              )}
              style={{ backgroundColor: preset.color }}
              aria-label={preset.name}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
