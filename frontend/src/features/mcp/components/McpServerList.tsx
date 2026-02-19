import { Pencil, Trash2, Server, Globe, Terminal } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { McpServerInfo, McpTransportType } from "@/types";

interface McpServerListProps {
  servers: McpServerInfo[];
  onEdit: (server: McpServerInfo) => void;
  onDelete: (id: string) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
}

const TRANSPORT_ICONS: Record<McpTransportType, typeof Terminal> = {
  stdio: Terminal,
  sse: Globe,
  "streamable-http": Server,
};

export function McpServerList({
  servers,
  onEdit,
  onDelete,
  onToggleEnabled,
}: McpServerListProps) {
  if (servers.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground/60 text-center py-4">
        등록된 MCP 서버가 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {servers.map((server) => {
        const Icon = TRANSPORT_ICONS[server.transport_type] ?? Server;
        return (
          <div
            key={server.id}
            className="flex items-center gap-3 px-3 py-2 rounded-md bg-input/50 border border-border/50"
          >
            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-foreground truncate">
                  {server.name}
                </span>
                <span className="font-mono text-2xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">
                  {server.transport_type}
                </span>
                {server.source === "system" ? (
                  <span className="font-mono text-2xs px-1.5 py-0.5 rounded bg-info/10 text-info shrink-0">
                    system
                  </span>
                ) : null}
              </div>
              <p className="font-mono text-2xs text-muted-foreground/70 truncate">
                {server.transport_type === "stdio"
                  ? `${server.command ?? ""} ${server.args?.join(" ") ?? ""}`
                  : server.url ?? ""}
              </p>
            </div>
            <Switch
              checked={server.enabled}
              onCheckedChange={(checked) =>
                onToggleEnabled(server.id, checked)
              }
              className="shrink-0"
              aria-label={`${server.name} 활성화 토글`}
            />
            <button
              type="button"
              onClick={() => onEdit(server)}
              className="text-muted-foreground hover:text-foreground p-1"
              aria-label={`${server.name} 편집`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(server.id)}
              className="text-muted-foreground hover:text-destructive p-1"
              aria-label={`${server.name} 삭제`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
