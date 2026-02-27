import { Globe, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspaces } from "../hooks/useWorkspaces";

interface WorkspaceSelectorProps {
  value: string | null;
  onChange: (workspaceId: string | null) => void;
  excludeIds?: string[];
}

export function WorkspaceSelector({ value, onChange, excludeIds }: WorkspaceSelectorProps) {
  const { data: workspaces, isLoading } = useWorkspaces();

  const readyWorkspaces = (workspaces?.filter((ws) => ws.status === "ready") ?? []).filter(
    (ws) => !excludeIds?.includes(ws.id),
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-input">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        <span className="font-mono text-xs text-muted-foreground">워크스페이스 로딩 중…</span>
      </div>
    );
  }

  return (
    <Select value={value ?? ""} onValueChange={(val) => onChange(val || null)}>
      <SelectTrigger className="font-mono text-xs bg-input border-border">
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue placeholder="워크스페이스 선택" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {readyWorkspaces.length === 0 ? (
          <div className="py-4 text-center">
            <p className="font-mono text-xs text-muted-foreground">
              사용 가능한 워크스페이스가 없습니다
            </p>
          </div>
        ) : (
          readyWorkspaces.map((ws) => (
            <SelectItem key={ws.id} value={ws.id} className="font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{ws.name}</span>
                {ws.current_branch ? (
                  <span className="text-muted-foreground text-2xs">({ws.current_branch})</span>
                ) : null}
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
