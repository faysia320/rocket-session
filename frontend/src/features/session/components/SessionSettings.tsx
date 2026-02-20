import { useState, useEffect, useCallback } from "react";
import { Save, FileStack } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { sessionsApi } from "@/lib/api/sessions.api";
import { McpServerSelector } from "@/features/mcp/components/McpServerSelector";
import { SaveAsTemplateDialog } from "@/features/template/components/SaveAsTemplateDialog";
import { AVAILABLE_TOOLS } from "../constants/tools";

const PERMISSION_TOOLS = ["Bash", "Write", "Edit", "MultiEdit"] as const;

interface SessionSettingsProps {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portalContainer?: HTMLElement | null;
}

export function SessionSettings({
  sessionId,
  open,
  onOpenChange,
  portalContainer,
}: SessionSettingsProps) {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [timeoutMinutes, setTimeoutMinutes] = useState("");
  const [permissionMode, setPermissionMode] = useState(false);
  const [permissionTools, setPermissionTools] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [systemPromptMode, setSystemPromptMode] = useState<
    "replace" | "append"
  >("replace");
  const [disallowedTools, setDisallowedTools] = useState<string[]>([]);
  const [mcpServerIds, setMcpServerIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const s = await sessionsApi.get(sessionId);
      setSystemPrompt(s.system_prompt ?? "");
      setTimeoutMinutes(
        s.timeout_seconds ? String(Math.round(s.timeout_seconds / 60)) : "",
      );
      setPermissionMode(s.permission_mode ?? false);
      setPermissionTools(s.permission_required_tools ?? []);
      setModel(s.model ?? "");
      setSystemPromptMode(
        (s.system_prompt_mode as "replace" | "append") ?? "replace",
      );
      setDisallowedTools(
        s.disallowed_tools
          ? s.disallowed_tools.split(",").map((t) => t.trim())
          : [],
      );
      setMcpServerIds(s.mcp_server_ids ?? []);
    } catch {
      toast.error("세션 설정을 불러오지 못했습니다.");
    }
  }, [sessionId]);

  useEffect(() => {
    if (open) {
      loadSession();
    }
  }, [open, loadSession]);

  const handlePermissionToolToggle = useCallback((tool: string, checked: boolean) => {
    setPermissionTools((prev) =>
      checked ? [...prev, tool] : prev.filter((t) => t !== tool),
    );
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const timeoutSec = timeoutMinutes ? Number(timeoutMinutes) * 60 : null;
      await sessionsApi.update(sessionId, {
        system_prompt: systemPrompt || null,
        timeout_seconds: timeoutSec,
        permission_mode: permissionMode,
        permission_required_tools:
          permissionMode && permissionTools.length > 0 ? permissionTools : null,
        model: model || null,
        system_prompt_mode: systemPromptMode,
        disallowed_tools:
          disallowedTools.length > 0 ? disallowedTools.join(",") : null,
        mcp_server_ids: mcpServerIds.length > 0 ? mcpServerIds : null,
      });
      toast.success("설정이 저장되었습니다.");
      onOpenChange(false);
    } catch {
      toast.error("설정 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={!portalContainer}>
      <SheetContent
        side="right"
        container={portalContainer}
        className="w-full sm:w-[400px] sm:max-w-[400px] bg-card border-border flex flex-col p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle className="font-mono text-sm font-semibold text-foreground">
            Session Settings
          </SheetTitle>
          <SheetDescription className="font-mono text-2xs text-muted-foreground">
            현재 세션에 적용되는 설정입니다.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
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

            {/* MCP Servers */}
            <McpServerSelector
              selectedIds={mcpServerIds}
              onChange={setMcpServerIds}
            />

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
          </div>
        </div>

        <SheetFooter className="px-6 py-4 border-t border-border shrink-0 flex-col gap-2">
          <Button
            className="w-full font-mono text-xs font-semibold"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saving ? "Saving…" : "Save Settings"}
          </Button>
          <SaveAsTemplateDialog sessionId={sessionId}>
            <Button
              variant="outline"
              className="w-full font-mono text-xs gap-1.5"
            >
              <FileStack className="h-3.5 w-3.5" />
              템플릿으로 저장
            </Button>
          </SaveAsTemplateDialog>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
