import { memo, useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type {
  InsightCategory,
  CreateInsightRequest,
  WorkspaceInsightInfo,
} from "@/types/knowledge";

const CATEGORIES: { value: InsightCategory; label: string }[] = [
  { value: "pattern", label: "Pattern" },
  { value: "gotcha", label: "Gotcha" },
  { value: "decision", label: "Decision" },
  { value: "file_map", label: "File Map" },
  { value: "dependency", label: "Dependency" },
];

interface InsightCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateInsightRequest) => void;
  isPending?: boolean;
  /** 편집 모드: 전달되면 필드를 프리필하고 "Save"로 표시 */
  initialData?: WorkspaceInsightInfo | null;
}

export const InsightCreateDialog = memo(function InsightCreateDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  initialData,
}: InsightCreateDialogProps) {
  const isEditMode = !!initialData;
  const [category, setCategory] = useState<InsightCategory>("pattern");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  // 편집 모드: 다이얼로그 열릴 때 initialData로 필드 초기화
  useEffect(() => {
    if (open && initialData) {
      setCategory(initialData.category);
      setTitle(initialData.title);
      setContent(initialData.content);
      setTagsInput(initialData.tags?.join(", ") ?? "");
    } else if (open && !initialData) {
      setCategory("pattern");
      setTitle("");
      setContent("");
      setTagsInput("");
    }
  }, [open, initialData]);

  const reset = useCallback(() => {
    setCategory("pattern");
    setTitle("");
    setContent("");
    setTagsInput("");
  }, []);

  const handleSubmit = useCallback(() => {
    if (!title.trim() || !content.trim()) return;
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onSubmit({
      category,
      title: title.trim(),
      content: content.trim(),
      tags: tags.length > 0 ? tags : undefined,
    });
    reset();
    onOpenChange(false);
  }, [category, title, content, tagsInput, onSubmit, reset, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">
            {isEditMode ? "Edit Insight" : "New Insight"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-mono text-xs">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as InsightCategory)}>
              <SelectTrigger className="font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value} className="font-mono text-xs">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs">Title</Label>
            <Input
              className="font-mono text-xs"
              placeholder="Enter insight title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs">Content</Label>
            <Textarea
              className="font-mono text-xs min-h-[100px]"
              placeholder="Describe the insight..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs">Tags (comma-separated)</Label>
            <Input
              className="font-mono text-xs"
              placeholder="react, auth, api"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="font-mono text-xs"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="font-mono text-xs"
            onClick={handleSubmit}
            disabled={!title.trim() || !content.trim() || isPending}
          >
            {isEditMode ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
