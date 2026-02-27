import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCreateTeam } from "../hooks/useTeams";

interface TeamCreateDialogProps {
  children?: React.ReactNode;
}

export function TeamCreateDialog({ children }: TeamCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createTeam = useCreateTeam();

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createTeam.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
    });
    setName("");
    setDescription("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="outline" size="sm" className="gap-1.5 font-mono text-xs">
            <Plus className="h-3.5 w-3.5" />
            New Team
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">새 팀 생성</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-muted-foreground">팀 이름</label>
            <input
              className="w-full font-mono text-sm bg-input border border-border rounded px-3 py-2 outline-none focus:border-primary/50"
              placeholder="예: Frontend Refactor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-muted-foreground">설명 (선택)</label>
            <input
              className="w-full font-mono text-sm bg-input border border-border rounded px-3 py-2 outline-none focus:border-primary/50"
              placeholder="팀에 대한 간단한 설명"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button
            className="w-full font-mono text-sm"
            onClick={handleCreate}
            disabled={!name.trim() || createTeam.isPending}
          >
            {createTeam.isPending ? "생성 중…" : "팀 생성"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
