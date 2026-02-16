import { useState, useEffect } from "react";
import { Rocket, GitBranch } from "lucide-react";
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

interface SessionSetupPanelProps {
  onCreate: (
    workDir?: string,
    options?: {
      system_prompt?: string;
      timeout_seconds?: number;
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
  const { data: globalSettings } = useGlobalSettings();
  const { gitInfo } = useGitInfo(workDir);

  // 글로벌 work_dir 기본값 적용
  useEffect(() => {
    if (!workDir && globalSettings?.work_dir) {
      setWorkDir(globalSettings.work_dir);
    }
  }, [globalSettings?.work_dir]); // eslint-disable-line react-hooks/exhaustive-deps

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
      } = {};
      if (systemPrompt.trim()) {
        options.system_prompt = systemPrompt.trim();
      }
      if (timeoutMinutes && Number(timeoutMinutes) > 0) {
        options.timeout_seconds = Number(timeoutMinutes) * 60;
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
