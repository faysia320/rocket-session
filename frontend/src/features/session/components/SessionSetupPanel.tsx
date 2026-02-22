import { useState, useEffect, useRef } from "react";
import { Rocket, GitBranch, FolderPlus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { DirectoryPicker } from "@/features/directory/components/DirectoryPicker";
import { useGitInfo } from "@/features/directory/hooks/useGitInfo";
import { filesystemApi } from "@/lib/api/filesystem.api";
import { useGlobalSettings } from "@/features/settings/hooks/useGlobalSettings";
import { TemplateSelector } from "@/features/template/components/TemplateSelector";
import type { TemplateInfo } from "@/types";

interface SessionSetupPanelProps {
  onCreate: (
    workDir?: string,
    options?: {
      system_prompt?: string;
      timeout_seconds?: number;
      template_id?: string;
      additional_dirs?: string[];
      fallback_model?: string;
    },
  ) => void;
  onCancel: () => void;
}

export function SessionSetupPanel({
  onCreate,
  onCancel,
}: SessionSetupPanelProps) {
  const [workDir, setWorkDir] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [timeoutMinutes, setTimeoutMinutes] = useState("");
  const [creating, setCreating] = useState(false);
  const [useWorktree, setUseWorktree] = useState(false);
  const [worktreeBranch, setWorktreeBranch] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [additionalDirs, setAdditionalDirs] = useState<string[]>([]);
  const [fallbackModel, setFallbackModel] = useState("");
  const { data: globalSettings } = useGlobalSettings();
  const { gitInfo } = useGitInfo(workDir);

  // 글로벌 설정의 work_dir이 이미 적용되었는지 추적
  const globalAppliedRef = useRef(false);

  // 글로벌 work_dir 기본값 적용
  useEffect(() => {
    if (!globalAppliedRef.current && !workDir && globalSettings?.work_dir) {
      setWorkDir(globalSettings.work_dir);
      globalAppliedRef.current = true;
    }
  }, [globalSettings?.work_dir]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTemplateSelect = (template: TemplateInfo | null) => {
    if (!template) {
      setSelectedTemplateId(null);
      return;
    }
    setSelectedTemplateId(template.id);
    if (template.work_dir) {
      setWorkDir(template.work_dir);
    }
    if (template.system_prompt) {
      setSystemPrompt(template.system_prompt);
    }
    if (template.timeout_seconds) {
      setTimeoutMinutes(String(template.timeout_seconds / 60));
    }
    if (template.additional_dirs?.length) {
      setAdditionalDirs(template.additional_dirs);
    }
    if (template.fallback_model) {
      setFallbackModel(template.fallback_model);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      let targetDir = workDir.trim();

      if (useWorktree && worktreeBranch.trim()) {
        const worktreeInfo = await filesystemApi.createWorktree({
          repo_path: workDir.trim(),
          branch: worktreeBranch.trim(),
          create_branch: true,
        });
        targetDir = worktreeInfo.path;
      }

      const options: {
        system_prompt?: string;
        timeout_seconds?: number;
        template_id?: string;
        additional_dirs?: string[];
        fallback_model?: string;
      } = {};
      if (systemPrompt.trim()) {
        options.system_prompt = systemPrompt.trim();
      }
      if (timeoutMinutes && Number(timeoutMinutes) > 0) {
        options.timeout_seconds = Number(timeoutMinutes) * 60;
      }
      if (selectedTemplateId) {
        options.template_id = selectedTemplateId;
      }
      const validDirs = additionalDirs.filter((d) => d.trim());
      if (validDirs.length > 0) {
        options.additional_dirs = validDirs;
      }
      if (fallbackModel.trim()) {
        options.fallback_model = fallbackModel.trim();
      }
      onCreate(
        targetDir,
        Object.keys(options).length > 0 ? options : undefined,
      );
    } catch {
      setCreating(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
      <Card className="w-full max-w-2xl p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <Rocket className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-mono text-lg font-semibold text-foreground">
              New Session
            </h2>
            <p className="font-mono text-xs text-muted-foreground">
              Configure and launch a new Claude Code session
            </p>
          </div>
        </div>

        {/* Template Selector */}
        <div className="space-y-2">
          <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
            TEMPLATE
          </Label>
          <p className="font-mono text-2xs text-muted-foreground/70">
            저장된 템플릿으로 설정을 빠르게 채울 수 있습니다.
          </p>
          <TemplateSelector onSelect={handleTemplateSelect} />
        </div>

        {/* Working Directory */}
        <div className="space-y-2">
          <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
            WORKING DIRECTORY <span className="text-destructive">*</span>
          </Label>
          <DirectoryPicker value={workDir} onChange={setWorkDir} />
        </div>

        {/* Git Worktree */}
        {gitInfo?.is_git_repo ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="worktree-toggle"
                className="font-mono text-xs font-semibold text-muted-foreground tracking-wider flex items-center gap-2 cursor-pointer"
              >
                <GitBranch className="h-3.5 w-3.5" />
                GIT WORKTREE
              </Label>
              <Switch
                id="worktree-toggle"
                checked={useWorktree}
                onCheckedChange={setUseWorktree}
              />
            </div>
            {useWorktree ? (
              <div className="space-y-2 pl-0.5">
                <p className="font-mono text-2xs text-muted-foreground/70">
                  현재 브랜치:{" "}
                  <code className="text-info/80">{gitInfo.branch}</code>{" "}
                  기준으로 새 워크트리를 생성합니다
                </p>
                <Input
                  className="font-mono text-xs bg-input border-border"
                  placeholder="새 브랜치명 (예: feature-auth)"
                  value={worktreeBranch}
                  onChange={(e) => setWorktreeBranch(e.target.value)}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Additional Directories */}
        <div className="space-y-2">
          <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider flex items-center gap-2">
            <FolderPlus className="h-3.5 w-3.5" />
            ADDITIONAL DIRECTORIES
          </Label>
          <p className="font-mono text-2xs text-muted-foreground/70">
            Claude가 접근할 추가 디렉토리입니다. (--add-dir 플래그)
          </p>
          {additionalDirs.map((dir, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <div className="flex-1">
                <DirectoryPicker
                  value={dir}
                  onChange={(val) => {
                    const updated = [...additionalDirs];
                    updated[idx] = val;
                    setAdditionalDirs(updated);
                  }}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  setAdditionalDirs(additionalDirs.filter((_, i) => i !== idx))
                }
                aria-label="디렉토리 제거"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="font-mono text-xs"
            onClick={() => setAdditionalDirs([...additionalDirs, ""])}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            디렉토리 추가
          </Button>
        </div>

        {/* Fallback Model */}
        <div className="space-y-2">
          <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
            FALLBACK MODEL
          </Label>
          <p className="font-mono text-2xs text-muted-foreground/70">
            메인 모델 사용 불가 시 대체할 모델입니다. (--fallback-model 플래그)
          </p>
          <Input
            className="font-mono text-xs bg-input border-border"
            placeholder="예: claude-sonnet-4-20250514"
            value={fallbackModel}
            onChange={(e) => setFallbackModel(e.target.value)}
          />
        </div>

        {/* System Prompt */}
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

        {/* Timeout */}
        <div className="space-y-2">
          <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
            TIMEOUT (분)
          </Label>
          <p className="font-mono text-2xs text-muted-foreground/70">
            프로세스 최대 실행 시간. 비워두면 무제한입니다.
          </p>
          <Input
            className="font-mono text-xs bg-input border-border w-28"
            type="number"
            min="1"
            placeholder="없음"
            value={timeoutMinutes}
            onChange={(e) => setTimeoutMinutes(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            className="flex-1 font-mono text-sm font-semibold"
            onClick={handleCreate}
            disabled={
              creating ||
              !workDir.trim() ||
              (useWorktree && !worktreeBranch.trim())
            }
          >
            <Rocket className="h-4 w-4 mr-2" />
            {creating ? "Creating…" : "Create Session"}
          </Button>
          <Button
            variant="outline"
            className="font-mono text-sm"
            onClick={onCancel}
            disabled={creating}
          >
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
