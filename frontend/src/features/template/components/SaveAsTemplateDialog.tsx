import { useState } from "react";
import { FileStack, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCreateTemplateFromSession } from "@/features/template/hooks/useTemplates";

interface SaveAsTemplateDialogProps {
  sessionId: string;
  children: React.ReactNode;
}

export function SaveAsTemplateDialog({
  sessionId,
  children,
}: SaveAsTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const mutation = useCreateTemplateFromSession();

  const handleSave = async () => {
    if (!name.trim()) return;
    await mutation.mutateAsync({
      sessionId,
      data: {
        name: name.trim(),
        description: description.trim() || undefined,
      },
    });
    setName("");
    setDescription("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm flex items-center gap-2">
            <FileStack className="h-4 w-4 text-primary" />
            템플릿으로 저장
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-mono text-xs font-semibold text-muted-foreground">
              이름 <span className="text-destructive">*</span>
            </Label>
            <Input
              className="font-mono text-xs"
              placeholder="예: 코드 리뷰 세션"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs font-semibold text-muted-foreground">
              설명
            </Label>
            <Textarea
              className="font-mono text-xs min-h-[60px]"
              placeholder="이 템플릿의 용도를 설명하세요"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <p className="font-mono text-2xs text-muted-foreground/70">
            현재 세션의 작업 디렉토리, 시스템 프롬프트, 도구 설정 등이 템플릿에
            저장됩니다.
          </p>
          <Button
            className="w-full font-mono text-xs gap-1.5"
            onClick={handleSave}
            disabled={!name.trim() || mutation.isPending}
          >
            <Check className="h-3.5 w-3.5" />
            {mutation.isPending ? "저장 중…" : "템플릿 저장"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
