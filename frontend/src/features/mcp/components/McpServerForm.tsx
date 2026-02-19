import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save } from "lucide-react";
import type {
  McpTransportType,
  McpServerInfo,
  CreateMcpServerRequest,
} from "@/types";

interface KeyValueEntry {
  key: string;
  value: string;
}

interface McpServerFormProps {
  initial?: McpServerInfo | null;
  onSubmit: (data: CreateMcpServerRequest) => void;
  onCancel: () => void;
  isPending?: boolean;
}

function toEntries(obj?: Record<string, string> | null): KeyValueEntry[] {
  if (!obj) return [];
  return Object.entries(obj).map(([key, value]) => ({ key, value }));
}

function fromEntries(entries: KeyValueEntry[]): Record<string, string> | null {
  const filtered = entries.filter((e) => e.key.trim());
  if (filtered.length === 0) return null;
  return Object.fromEntries(filtered.map((e) => [e.key, e.value]));
}

export function McpServerForm({
  initial,
  onSubmit,
  onCancel,
  isPending,
}: McpServerFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [transportType, setTransportType] = useState<McpTransportType>(
    initial?.transport_type ?? "stdio",
  );
  const [command, setCommand] = useState(initial?.command ?? "");
  const [args, setArgs] = useState(initial?.args?.join(" ") ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [envEntries, setEnvEntries] = useState<KeyValueEntry[]>(
    toEntries(initial?.env),
  );
  const [headerEntries, setHeaderEntries] = useState<KeyValueEntry[]>(
    toEntries(initial?.headers),
  );

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setTransportType(initial.transport_type);
      setCommand(initial.command ?? "");
      setArgs(initial.args?.join(" ") ?? "");
      setUrl(initial.url ?? "");
      setEnvEntries(toEntries(initial.env));
      setHeaderEntries(toEntries(initial.headers));
    }
  }, [initial]);

  const handleSubmit = () => {
    const data: CreateMcpServerRequest = {
      name: name.trim(),
      transport_type: transportType,
    };
    if (transportType === "stdio") {
      data.command = command.trim() || null;
      const argsList = args
        .trim()
        .split(/\s+/)
        .filter((a) => a);
      data.args = argsList.length > 0 ? argsList : null;
    } else {
      data.url = url.trim() || null;
      data.headers = fromEntries(headerEntries);
    }
    data.env = fromEntries(envEntries);
    onSubmit(data);
  };

  const addEntry = (
    setter: React.Dispatch<React.SetStateAction<KeyValueEntry[]>>,
  ) => {
    setter((prev) => [...prev, { key: "", value: "" }]);
  };

  const removeEntry = (
    setter: React.Dispatch<React.SetStateAction<KeyValueEntry[]>>,
    index: number,
  ) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const updateEntry = (
    setter: React.Dispatch<React.SetStateAction<KeyValueEntry[]>>,
    index: number,
    field: "key" | "value",
    val: string,
  ) => {
    setter((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: val } : e)),
    );
  };

  const renderKeyValueEditor = (
    label: string,
    entries: KeyValueEntry[],
    setter: React.Dispatch<React.SetStateAction<KeyValueEntry[]>>,
    maskValues?: boolean,
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
          {label}
        </Label>
        <button
          type="button"
          onClick={() => addEntry(setter)}
          className="flex items-center gap-1 font-mono text-2xs text-primary hover:text-primary/80"
          aria-label={`${label} 추가`}
        >
          <Plus className="h-3 w-3" />
          추가
        </button>
      </div>
      {entries.map((entry, i) => (
        <div key={i} className="flex gap-1.5 items-center">
          <Input
            className="font-mono text-xs bg-input border-border flex-1"
            placeholder="키"
            value={entry.key}
            onChange={(e) => updateEntry(setter, i, "key", e.target.value)}
          />
          <Input
            className="font-mono text-xs bg-input border-border flex-1"
            placeholder="값"
            type={maskValues ? "password" : "text"}
            value={entry.value}
            onChange={(e) => updateEntry(setter, i, "value", e.target.value)}
          />
          <button
            type="button"
            onClick={() => removeEntry(setter, i)}
            className="text-destructive/70 hover:text-destructive p-1"
            aria-label="삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
          NAME
        </Label>
        <Input
          className="font-mono text-xs bg-input border-border"
          placeholder="예: context7"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Transport Type */}
      <div className="space-y-1.5">
        <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
          TRANSPORT
        </Label>
        <div className="flex gap-3">
          {(["stdio", "sse", "streamable-http"] as const).map((t) => (
            <label key={t} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="transport"
                checked={transportType === t}
                onChange={() => setTransportType(t)}
                className="accent-primary"
              />
              <span className="font-mono text-xs text-foreground">{t}</span>
            </label>
          ))}
        </div>
      </div>

      {/* stdio 전용 */}
      {transportType === "stdio" ? (
        <>
          <div className="space-y-1.5">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              COMMAND
            </Label>
            <Input
              className="font-mono text-xs bg-input border-border"
              placeholder="예: npx"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              ARGS
            </Label>
            <Input
              className="font-mono text-xs bg-input border-border"
              placeholder="예: -y @upstash/context7-mcp"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
            />
            <p className="font-mono text-2xs text-muted-foreground/70">
              공백으로 구분됩니다.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              URL
            </Label>
            <Input
              className="font-mono text-xs bg-input border-border"
              placeholder="예: http://localhost:3000/sse"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          {renderKeyValueEditor("HEADERS", headerEntries, setHeaderEntries)}
        </>
      )}

      {/* ENV */}
      {renderKeyValueEditor("ENV", envEntries, setEnvEntries, true)}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button
          className="flex-1 font-mono text-xs font-semibold"
          onClick={handleSubmit}
          disabled={!name.trim() || isPending}
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {isPending ? "저장 중…" : initial ? "수정" : "추가"}
        </Button>
        <Button
          variant="outline"
          className="font-mono text-xs"
          onClick={onCancel}
        >
          취소
        </Button>
      </div>
    </div>
  );
}
