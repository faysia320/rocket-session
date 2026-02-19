import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Terminal, Globe, Server } from "lucide-react";
import { useMcpServers } from "../hooks/useMcpServers";
import type { McpTransportType } from "@/types";

interface McpServerSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

const TRANSPORT_ICONS: Record<McpTransportType, typeof Terminal> = {
  stdio: Terminal,
  sse: Globe,
  "streamable-http": Server,
};

export function McpServerSelector({
  selectedIds,
  onChange,
}: McpServerSelectorProps) {
  const { data: servers = [] } = useMcpServers();

  const enabledServers = servers.filter((s) => s.enabled);

  const handleToggle = (id: string, checked: boolean) => {
    onChange(
      checked ? [...selectedIds, id] : selectedIds.filter((s) => s !== id),
    );
  };

  if (enabledServers.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
          MCP SERVERS
        </Label>
        <p className="font-mono text-2xs text-muted-foreground/60">
          글로벌 설정에서 MCP 서버를 먼저 등록하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
        MCP SERVERS
      </Label>
      <p className="font-mono text-2xs text-muted-foreground/70">
        이 세션에서 사용할 MCP 서버를 선택합니다.
      </p>
      <div className="space-y-1.5">
        {enabledServers.map((server) => {
          const Icon = TRANSPORT_ICONS[server.transport_type] ?? Server;
          return (
            <label
              key={server.id}
              className="flex items-center gap-2.5 cursor-pointer px-2 py-1.5 rounded hover:bg-input/50"
            >
              <Checkbox
                checked={selectedIds.includes(server.id)}
                onCheckedChange={(checked) =>
                  handleToggle(server.id, checked === true)
                }
              />
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-mono text-xs text-foreground">
                {server.name}
              </span>
              <span className="font-mono text-2xs text-muted-foreground/60 ml-auto">
                {server.transport_type}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
