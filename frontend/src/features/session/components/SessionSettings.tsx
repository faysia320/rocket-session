import { useState, useEffect, useCallback } from "react";
import { Settings, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { sessionsApi } from "@/lib/api/sessions.api";
import { AVAILABLE_TOOLS } from "../constants/tools";

const PERMISSION_TOOLS = ["Bash", "Write", "Edit", "MultiEdit"] as const;

interface SessionSettingsProps {
  sessionId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SessionSettings({
  sessionId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: SessionSettingsProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [timeoutMinutes, setTimeoutMinutes] = useState("");
  const [permissionMode, setPermissionMode] = useState(false);
  const [permissionTools, setPermissionTools] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [maxTurns, setMaxTurns] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [systemPromptMode, setSystemPromptMode] = useState<
    "replace" | "append"
  >("replace");
  const [disallowedTools, setDisallowedTools] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const s = await sessionsApi.get(sessionId);
      setSelectedTools(
        s.allowed_tools ? s.allowed_tools.split(",").map((t) => t.trim()) : [],
      );
      setSystemPrompt(s.system_prompt ?? "");
      setTimeoutMinutes(
        s.timeout_seconds ? String(Math.round(s.timeout_seconds / 60)) : "",
      );
      setPermissionMode(s.permission_mode ?? false);
      setPermissionTools(s.permission_required_tools ?? []);
      setModel(s.model ?? "");
      setMaxTurns(s.max_turns ? String(s.max_turns) : "");
      setMaxBudget(s.max_budget_usd ? String(s.max_budget_usd) : "");
      setSystemPromptMode(
        (s.system_prompt_mode as "replace" | "append") ?? "replace",
      );
      setDisallowedTools(
        s.disallowed_tools
          ? s.disallowed_tools.split(",").map((t) => t.trim())
          : [],
      );
    } catch {
      toast.error("세션 설정을 불러오지 못했습니다.");
    }
  }, [sessionId]);

  useEffect(() => {
    if (open) {
      loadSession();
    }
  }, [open, loadSession]);

  const handleToolToggle = (tool: string, checked: boolean) => {
    setSelectedTools((prev) =>
      checked ? [...prev, tool] : prev.filter((t) => t !== tool),
    );
  };

  const handlePermissionToolToggle = (tool: string, checked: boolean) => {
    setPermissionTools((prev) =>
      checked ? [...prev, tool] : prev.filter((t) => t !== tool),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const timeoutSec = timeoutMinutes ? Number(timeoutMinutes) * 60 : null;
      await sessionsApi.update(sessionId, {
        allowed_tools:
          selectedTools.length > 0 ? selectedTools.join(",") : null,
        system_prompt: systemPrompt || null,
        timeout_seconds: timeoutSec,
        permission_mode: permissionMode,
        permission_required_tools:
          permissionMode && permissionTools.length > 0 ? permissionTools : null,
        model: model || null,
        max_turns: maxTurns ? Number(maxTurns) : null,
        max_budget_usd: maxBudget ? Number(maxBudget) : null,
        system_prompt_mode: systemPromptMode,
        disallowed_tools:
          disallowedTools.length > 0 ? disallowedTools.join(",") : null,
      });
      toast.success("설정이 저장되었습니다.");
      setOpen(false);
    } catch {
      toast.error("설정 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          title="Session settings"
          aria-label="세션 설정"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[360px] bg-card border-border overflow-y-auto max-h-[80vh]"
        align="end"
      >
        <div className="font-mono text-sm font-semibold text-foreground mb-4">
          Session Settings
        </div>

        <div className="space-y-5">
          {/* 모델 선택 */}
          <div className="space-y-2">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              MODEL
            </Label>
            <p className="font-mono text-2xs text-muted-foreground/70">
              Claude CLI에 전달할 모델입니다. 비워두면 전역 설정 또는 기본값을
              사용합니다.
            </p>
            <select
              className="font-mono text-xs bg-input border border-border rounded px-2 py-1.5 w-full outline-none focus:border-primary/50"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <option value="">Default</option>
              <option value="opus">Opus</option>
              <option value="sonnet">Sonnet</option>
              <option value="haiku">Haiku</option>
            </select>
          </div>

          {/* 허용 도구 */}
          <div className="space-y-3">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              ALLOWED TOOLS
            </Label>
            <p className="font-mono text-2xs text-muted-foreground/70">
              Claude CLI에 허용할 도구를 선택하세요. 미선택 시 전역 설정이
              적용됩니다.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_TOOLS.map((tool) => (
                <label
                  key={tool}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedTools.includes(tool)}
                    onCheckedChange={(checked) =>
                      handleToolToggle(tool, checked === true)
                    }
                  />
                  <span className="font-mono text-xs text-foreground">
                    {tool}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 비허용 도구 */}
          <div className="space-y-3">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              DISALLOWED TOOLS
            </Label>
            <p className="font-mono text-2xs text-muted-foreground/70">
              Claude CLI에서 사용을 금지할 도구입니다.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_TOOLS.map((tool) => (
                <label
                  key={`dis-${tool}`}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={disallowedTools.includes(tool)}
                    onCheckedChange={(checked) =>
                      setDisallowedTools((prev) =>
                        checked === true
                          ? [...prev, tool]
                          : prev.filter((t) => t !== tool),
                      )
                    }
                  />
                  <span className="font-mono text-xs text-foreground">
                    {tool}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 시스템 프롬프트 */}
          <div className="space-y-2">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              SYSTEM PROMPT
            </Label>
            <p className="font-mono text-2xs text-muted-foreground/70">
              세션에 주입할 시스템 지시사항입니다.
            </p>
            <Textarea
              className="font-mono text-xs min-h-[100px] bg-input border-border"
              placeholder="예: 모든 코드에 한국어 주석을 달아주세요."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </div>

          {/* System Prompt Mode */}
          <div className="space-y-2">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              SYSTEM PROMPT MODE
            </Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={systemPromptMode === "replace"}
                  onCheckedChange={() => setSystemPromptMode("replace")}
                />
                <span className="font-mono text-xs text-foreground">
                  전체 대체
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={systemPromptMode === "append"}
                  onCheckedChange={() => setSystemPromptMode("append")}
                />
                <span className="font-mono text-xs text-foreground">
                  기본에 추가
                </span>
              </label>
            </div>
          </div>

          {/* Permission Mode */}
          <div className="space-y-3">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              PERMISSION MODE
            </Label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={permissionMode}
                onCheckedChange={(checked) =>
                  setPermissionMode(checked === true)
                }
              />
              <span className="font-mono text-xs text-foreground">
                도구 실행 전 확인 요청 활성화
              </span>
            </label>
            <p className="font-mono text-2xs text-muted-foreground/70">
              활성화하면 아래 선택한 도구 실행 시 사용자 승인을 요청합니다.
            </p>
            {permissionMode ? (
              <div className="grid grid-cols-2 gap-2 pl-2 border-l-2 border-warning/30">
                {PERMISSION_TOOLS.map((tool) => (
                  <label
                    key={tool}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={permissionTools.includes(tool)}
                      onCheckedChange={(checked) =>
                        handlePermissionToolToggle(tool, checked === true)
                      }
                    />
                    <span className="font-mono text-xs text-foreground">
                      {tool}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          {/* Max Turns */}
          <div className="space-y-2">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              MAX TURNS
            </Label>
            <p className="font-mono text-2xs text-muted-foreground/70">
              에이전트 턴 최대 횟수입니다. 비워두면 무제한입니다.
            </p>
            <Input
              className="font-mono text-xs bg-input border-border w-24"
              type="number"
              min="1"
              placeholder="없음"
              value={maxTurns}
              onChange={(e) => setMaxTurns(e.target.value)}
            />
          </div>

          {/* Max Budget */}
          <div className="space-y-2">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              MAX BUDGET (USD)
            </Label>
            <p className="font-mono text-2xs text-muted-foreground/70">
              세션당 최대 비용 한도입니다. 비워두면 제한 없음.
            </p>
            <Input
              className="font-mono text-xs bg-input border-border w-28"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="없음"
              value={maxBudget}
              onChange={(e) => setMaxBudget(e.target.value)}
            />
          </div>

          {/* 타임아웃 */}
          <div className="space-y-2">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              TIMEOUT (분)
            </Label>
            <p className="font-mono text-2xs text-muted-foreground/70">
              프로세스 최대 실행 시간. 비워두면 무제한입니다.
            </p>
            <Input
              className="font-mono text-xs bg-input border-border w-24"
              type="number"
              min="1"
              placeholder="없음"
              value={timeoutMinutes}
              onChange={(e) => setTimeoutMinutes(e.target.value)}
            />
          </div>

          {/* 저장 버튼 */}
          <Button
            className="w-full font-mono text-xs font-semibold"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
