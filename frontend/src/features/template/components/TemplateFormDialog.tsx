import { useState, useEffect } from "react";
import { FileStack, Plus, X, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DirectoryPicker } from "@/features/directory/components/DirectoryPicker";
import { McpServerSelector } from "@/features/mcp/components/McpServerSelector";
import { AVAILABLE_TOOLS, PERMISSION_TOOLS } from "@/features/session/constants/tools";
import {
  useCreateTemplate,
  useUpdateTemplate,
} from "@/features/template/hooks/useTemplates";
import type { TemplateInfo, CreateTemplateRequest } from "@/types";

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: TemplateInfo | null;
}

interface TemplateFormData {
  name: string;
  description: string;
  work_dir: string;
  model: string;
  fallback_model: string;
  system_prompt: string;
  system_prompt_mode: "replace" | "append";
  mode: "normal" | "plan";
  timeout_minutes: string;
  max_turns: string;
  max_budget_usd: string;
  disallowed_tools: string[];
  permission_mode: boolean;
  permission_required_tools: string[];
  mcp_server_ids: string[];
  additional_dirs: string[];
}

function getInitialFormData(template?: TemplateInfo | null): TemplateFormData {
  return {
    name: template?.name ?? "",
    description: template?.description ?? "",
    work_dir: template?.work_dir ?? "",
    model: template?.model ?? "",
    fallback_model: template?.fallback_model ?? "",
    system_prompt: template?.system_prompt ?? "",
    system_prompt_mode:
      (template?.system_prompt_mode as "replace" | "append") ?? "replace",
    mode: (template?.mode as "normal" | "plan") ?? "normal",
    timeout_minutes: template?.timeout_seconds
      ? String(Math.round(template.timeout_seconds / 60))
      : "",
    max_turns: template?.max_turns ? String(template.max_turns) : "",
    max_budget_usd: template?.max_budget_usd
      ? String(template.max_budget_usd)
      : "",
    disallowed_tools: template?.disallowed_tools
      ? template.disallowed_tools.split(",").map((t) => t.trim())
      : [],
    permission_mode: template?.permission_mode ?? false,
    permission_required_tools: template?.permission_required_tools ?? [],
    mcp_server_ids: template?.mcp_server_ids ?? [],
    additional_dirs: template?.additional_dirs ?? [],
  };
}

export function TemplateFormDialog({
  open,
  onOpenChange,
  template,
}: TemplateFormDialogProps) {
  const isEditMode = !!template;
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [formData, setFormData] = useState<TemplateFormData>(
    getInitialFormData(template),
  );

  useEffect(() => {
    if (open) {
      setFormData(getInitialFormData(template));
    }
  }, [open, template]);

  const update = <K extends keyof TemplateFormData>(
    key: K,
    value: TemplateFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    const payload: CreateTemplateRequest = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      work_dir: formData.work_dir.trim() || undefined,
      model: formData.model || undefined,
      fallback_model: formData.fallback_model.trim() || undefined,
      system_prompt: formData.system_prompt.trim() || undefined,
      system_prompt_mode: formData.system_prompt_mode,
      mode: formData.mode,
      timeout_seconds: formData.timeout_minutes
        ? Number(formData.timeout_minutes) * 60
        : undefined,
      max_turns: formData.max_turns ? Number(formData.max_turns) : undefined,
      max_budget_usd: formData.max_budget_usd
        ? Number(formData.max_budget_usd)
        : undefined,
      disallowed_tools:
        formData.disallowed_tools.length > 0
          ? formData.disallowed_tools.join(",")
          : undefined,
      permission_mode: formData.permission_mode || undefined,
      permission_required_tools:
        formData.permission_mode && formData.permission_required_tools.length > 0
          ? formData.permission_required_tools
          : undefined,
      mcp_server_ids:
        formData.mcp_server_ids.length > 0
          ? formData.mcp_server_ids
          : undefined,
      additional_dirs:
        formData.additional_dirs.filter((d) => d.trim()).length > 0
          ? formData.additional_dirs.filter((d) => d.trim())
          : undefined,
    };

    if (isEditMode) {
      await updateMutation.mutateAsync({ id: template!.id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="font-mono text-sm flex items-center gap-2">
            <FileStack className="h-4 w-4 text-primary" />
            {isEditMode ? "템플릿 수정" : "새 템플릿"}
          </DialogTitle>
          <DialogDescription className="font-mono text-2xs text-muted-foreground">
            {isEditMode
              ? "템플릿의 설정값을 수정합니다."
              : "새 세션에 적용할 기본 설정을 구성합니다."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 pb-6 space-y-5">
            {/* ── 기본 정보 ── */}
            <div className="space-y-2">
              <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
                이름 <span className="text-destructive">*</span>
              </Label>
              <Input
                className="font-mono text-xs"
                placeholder="예: 코드 리뷰 세션"
                value={formData.name}
                onChange={(e) => update("name", e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
                설명
              </Label>
              <Textarea
                className="font-mono text-xs min-h-[60px]"
                placeholder="이 템플릿의 용도를 설명하세요"
                value={formData.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>

            <Separator />

            {/* ── 작업 환경 ── */}
            <div className="space-y-2">
              <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
                WORKING DIRECTORY
              </Label>
              <p className="font-mono text-2xs text-muted-foreground/70">
                템플릿 적용 시 기본 작업 디렉토리입니다.
              </p>
              <DirectoryPicker
                value={formData.work_dir}
                onChange={(v) => update("work_dir", v)}
              />
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
                ADDITIONAL DIRECTORIES
              </Label>
              <p className="font-mono text-2xs text-muted-foreground/70">
                --add-dir 플래그로 전달할 추가 디렉토리입니다.
              </p>
              <div className="space-y-1.5">
                {formData.additional_dirs.map((dir, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <DirectoryPicker
                      value={dir}
                      onChange={(v) =>
                        update(
                          "additional_dirs",
                          formData.additional_dirs.map((d, i) =>
                            i === idx ? v : d,
                          ),
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() =>
                        update(
                          "additional_dirs",
                          formData.additional_dirs.filter((_, i) => i !== idx),
                        )
                      }
                      aria-label="디렉토리 삭제"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs gap-1"
                  onClick={() =>
                    update("additional_dirs", [
                      ...formData.additional_dirs,
                      "",
                    ])
                  }
                >
                  <Plus className="h-3 w-3" />
                  디렉토리 추가
                </Button>
              </div>
            </div>

            <Separator />

            {/* ── 모델 ── */}
            <div className="space-y-2">
              <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
                MODEL
              </Label>
              <p className="font-mono text-2xs text-muted-foreground/70">
                Claude CLI에 전달할 모델입니다. 비워두면 전역 설정 또는
                기본값을 사용합니다.
              </p>
              <select
                className="font-mono text-xs bg-input border border-border rounded px-2 py-1.5 w-full outline-none focus:border-primary/50"
                value={formData.model}
                onChange={(e) => update("model", e.target.value)}
              >
                <option value="">Default</option>
                <option value="opus">Opus</option>
                <option value="sonnet">Sonnet</option>
                <option value="haiku">Haiku</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
                FALLBACK MODEL
              </Label>
              <p className="font-mono text-2xs text-muted-foreground/70">
                기본 모델 사용 불가 시 대체 모델입니다.
              </p>
              <Input
                className="font-mono text-xs bg-input border-border"
                placeholder="예: claude-sonnet-4-20250514"
                value={formData.fallback_model}
                onChange={(e) => update("fallback_model", e.target.value)}
              />
            </div>

            <Separator />

            {/* ── 실행 제어 ── */}
            <div className="space-y-2">
              <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
                MODE
              </Label>
              <p className="font-mono text-2xs text-muted-foreground/70">
                normal은 일반 대화, plan은 실행 전 계획을 먼저 확인합니다.
              </p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={formData.mode === "normal"}
                    onCheckedChange={() => update("mode", "normal")}
                  />
                  <span className="font-mono text-xs text-foreground">
                    Normal
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={formData.mode === "plan"}
                    onCheckedChange={() => update("mode", "plan")}
                  />
                  <span className="font-mono text-xs text-foreground">
                    Plan
                  </span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
                  TIMEOUT (분)
                </Label>
                <Input
                  className="font-mono text-xs bg-input border-border"
                  type="number"
                  min="1"
                  placeholder="없음"
                  value={formData.timeout_minutes}
                  onChange={(e) => update("timeout_minutes", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
                  MAX TURNS
                </Label>
                <Input
                  className="font-mono text-xs bg-input border-border"
                  type="number"
                  min="1"
                  max="1000"
                  placeholder="없음"
                  value={formData.max_turns}
                  onChange={(e) => update("max_turns", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
                  BUDGET (USD)
                </Label>
                <Input
                  className="font-mono text-xs bg-input border-border"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="없음"
                  value={formData.max_budget_usd}
                  onChange={(e) => update("max_budget_usd", e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* ── 시스템 프롬프트 ── */}
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
                value={formData.system_prompt}
                onChange={(e) => update("system_prompt", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
                SYSTEM PROMPT MODE
              </Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={formData.system_prompt_mode === "replace"}
                    onCheckedChange={() =>
                      update("system_prompt_mode", "replace")
                    }
                  />
                  <span className="font-mono text-xs text-foreground">
                    전체 대체
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={formData.system_prompt_mode === "append"}
                    onCheckedChange={() =>
                      update("system_prompt_mode", "append")
                    }
                  />
                  <span className="font-mono text-xs text-foreground">
                    기본에 추가
                  </span>
                </label>
              </div>
            </div>

            <Separator />

            {/* ── 도구 제어 ── */}
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
                      checked={formData.disallowed_tools.includes(tool)}
                      onCheckedChange={(checked) =>
                        update(
                          "disallowed_tools",
                          checked === true
                            ? [...formData.disallowed_tools, tool]
                            : formData.disallowed_tools.filter(
                                (t) => t !== tool,
                              ),
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

            <div className="space-y-3">
              <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
                PERMISSION MODE
              </Label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formData.permission_mode}
                  onCheckedChange={(checked) =>
                    update("permission_mode", checked === true)
                  }
                />
                <span className="font-mono text-xs text-foreground">
                  도구 실행 전 확인 요청 활성화
                </span>
              </label>
              <p className="font-mono text-2xs text-muted-foreground/70">
                활성화하면 아래 선택한 도구 실행 시 사용자 승인을 요청합니다.
              </p>
              {formData.permission_mode ? (
                <div className="grid grid-cols-2 gap-2 pl-2 border-l-2 border-warning/30">
                  {PERMISSION_TOOLS.map((tool) => (
                    <label
                      key={tool}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={formData.permission_required_tools.includes(
                          tool,
                        )}
                        onCheckedChange={(checked) =>
                          update(
                            "permission_required_tools",
                            checked === true
                              ? [...formData.permission_required_tools, tool]
                              : formData.permission_required_tools.filter(
                                  (t) => t !== tool,
                                ),
                          )
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

            <Separator />

            {/* ── MCP 서버 ── */}
            <McpServerSelector
              selectedIds={formData.mcp_server_ids}
              onChange={(ids) => update("mcp_server_ids", ids)}
            />
          </div>
        </ScrollArea>

        {/* ── 하단 액션 ── */}
        <div className="flex gap-2 px-6 py-4 border-t border-border shrink-0">
          <Button
            className="flex-1 font-mono text-xs font-semibold gap-1.5"
            onClick={handleSubmit}
            disabled={!formData.name.trim() || isPending}
          >
            <Check className="h-3.5 w-3.5" />
            {isPending
              ? isEditMode
                ? "저장 중…"
                : "생성 중…"
              : isEditMode
                ? "저장"
                : "생성"}
          </Button>
          <Button
            variant="ghost"
            className="font-mono text-xs"
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
