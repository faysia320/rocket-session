import { useState, useEffect, useRef } from "react";
import { Rocket, GitBranch, Globe, Plus, X, Workflow, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useGlobalSettings } from "@/features/settings/hooks/useGlobalSettings";
import { TemplateSelector } from "@/features/template/components/TemplateSelector";
import { WorkspaceSelector } from "@/features/workspace/components/WorkspaceSelector";
import { useWorkspaces } from "@/features/workspace/hooks/useWorkspaces";
import { useGitBranches } from "@/features/git-monitor/hooks/useGitActions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      worktree_name?: string;
      workflow_enabled?: boolean;
      workspace_id?: string;
      branch?: string;
    },
  ) => void;
  onCancel: () => void;
}

export function SessionSetupPanel({ onCreate, onCancel }: SessionSetupPanelProps) {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [timeoutMinutes, setTimeoutMinutes] = useState("");
  const [creating, setCreating] = useState(false);
  const [useWorktree, setUseWorktree] = useState(false);
  const [worktreeName, setWorktreeName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [additionalWorkspaceIds, setAdditionalWorkspaceIds] = useState<string[]>([]);
  const [fallbackModel, setFallbackModel] = useState("");
  const [workflowEnabled, setWorkflowEnabled] = useState(true);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const { data: globalSettings } = useGlobalSettings();
  const { data: workspaces } = useWorkspaces();

  const readyWorkspaces = workspaces?.filter((ws) => ws.status === "ready") ?? [];

  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);

  // 선택된 워크스페이스의 local_path로 브랜치 목록 조회
  const selectedWorkspaceLocalPath = readyWorkspaces.find(
    (ws) => ws.id === selectedWorkspaceId,
  )?.local_path ?? "";
  const { data: branchData } = useGitBranches(selectedWorkspaceLocalPath);

  // 글로벌 설정의 기본값이 이미 적용되었는지 추적
  const globalAppliedRef = useRef(false);

  // 글로벌 기본값 적용
  useEffect(() => {
    if (!globalAppliedRef.current && globalSettings) {
      if (globalSettings.workflow_enabled) {
        setWorkflowEnabled(true);
      }
      globalAppliedRef.current = true;
    }
  }, [globalSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  // 워크스페이스 변경 시 브랜치 선택 초기화
  useEffect(() => {
    setSelectedBranch(null);
  }, [selectedWorkspaceId]);

  const handleTemplateSelect = (template: TemplateInfo | null) => {
    if (!template) {
      setSelectedTemplateId(null);
      return;
    }
    setSelectedTemplateId(template.id);
    if (template.system_prompt) {
      setSystemPrompt(template.system_prompt);
    }
    if (template.timeout_seconds) {
      setTimeoutMinutes(String(template.timeout_seconds / 60));
    }
    if (template.fallback_model) {
      setFallbackModel(template.fallback_model);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const options: {
        system_prompt?: string;
        timeout_seconds?: number;
        template_id?: string;
        additional_dirs?: string[];
        fallback_model?: string;
        worktree_name?: string;
        workflow_enabled?: boolean;
        workspace_id?: string;
        branch?: string;
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
      // additionalWorkspaceIds → local_path 배열로 변환
      const additionalPaths = additionalWorkspaceIds
        .map((id) => readyWorkspaces.find((ws) => ws.id === id)?.local_path)
        .filter(Boolean) as string[];
      if (additionalPaths.length > 0) {
        options.additional_dirs = additionalPaths;
      }
      if (fallbackModel.trim()) {
        options.fallback_model = fallbackModel.trim();
      }
      if (useWorktree && worktreeName.trim()) {
        options.worktree_name = worktreeName.trim();
      }
      options.workflow_enabled = workflowEnabled;
      if (selectedWorkspaceId) {
        options.workspace_id = selectedWorkspaceId;
      }
      if (selectedBranch) {
        options.branch = selectedBranch;
      }
      onCreate(
        undefined,
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
            <h2 className="font-mono text-lg font-semibold text-foreground">New Session</h2>
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

        {/* Workspace */}
        <div className="space-y-2">
          <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider flex items-center gap-2">
            <Globe className="h-3.5 w-3.5" />
            WORKSPACE <span className="text-destructive">*</span>
          </Label>
          <p className="font-mono text-2xs text-muted-foreground/70">
            Git 저장소를 클론한 워크스페이스를 선택합니다.
          </p>
          <WorkspaceSelector
            value={selectedWorkspaceId}
            onChange={setSelectedWorkspaceId}
            excludeIds={additionalWorkspaceIds}
          />
          <Link
            to="/git-monitor"
            className="inline-flex items-center gap-1 font-mono text-2xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            워크스페이스 관리 →
          </Link>
        </div>

        {/* Branch Selection */}
        {selectedWorkspaceId && branchData ? (
          <div className="space-y-2">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5" />
              BRANCH
            </Label>
            <p className="font-mono text-2xs text-muted-foreground/70">
              세션을 시작할 브랜치를 선택합니다. 미선택 시 현재 브랜치를 사용합니다.
            </p>
            <Select
              value={selectedBranch ?? ""}
              onValueChange={(val) => setSelectedBranch(val || null)}
            >
              <SelectTrigger className="font-mono text-xs bg-input border-border">
                <SelectValue placeholder={branchData.current_branch ? `현재: ${branchData.current_branch}` : "브랜치 선택…"} />
              </SelectTrigger>
              <SelectContent>
                {branchData.branches.map((branch) => (
                  <SelectItem key={branch} value={branch} className="font-mono text-xs">
                    {branch}
                    {branch === branchData.current_branch ? " (현재)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* Git Worktree (워크스페이스 선택 시 항상 표시) */}
        {selectedWorkspaceId ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="worktree-toggle"
                className="font-mono text-xs font-semibold text-muted-foreground tracking-wider flex items-center gap-2 cursor-pointer"
              >
                <GitBranch className="h-3.5 w-3.5" />
                GIT WORKTREE
              </Label>
              <Switch id="worktree-toggle" checked={useWorktree} onCheckedChange={setUseWorktree} />
            </div>
            {useWorktree ? (
              <div className="space-y-2 pl-0.5">
                <p className="font-mono text-2xs text-muted-foreground/70">
                  세션 실행 시{" "}
                  <code className="text-info/80">worktree-{worktreeName || "{name}"}</code> 브랜치가
                  자동 생성됩니다
                </p>
                <Input
                  className="font-mono text-xs bg-input border-border"
                  placeholder="워크트리 이름 (예: feature-auth)"
                  value={worktreeName}
                  onChange={(e) => setWorktreeName(e.target.value)}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Additional Workspaces */}
        <div className="space-y-2">
          <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider flex items-center gap-2">
            <Globe className="h-3.5 w-3.5" />
            ADDITIONAL WORKSPACES
          </Label>
          <p className="font-mono text-2xs text-muted-foreground/70">
            Claude가 접근할 추가 워크스페이스입니다. (--add-dir 플래그)
          </p>
          {additionalWorkspaceIds.map((wsId, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <div className="flex-1">
                <WorkspaceSelector
                  value={wsId}
                  onChange={(val) => {
                    if (val) {
                      const updated = [...additionalWorkspaceIds];
                      updated[idx] = val;
                      setAdditionalWorkspaceIds(updated);
                    }
                  }}
                  excludeIds={[
                    ...(selectedWorkspaceId ? [selectedWorkspaceId] : []),
                    ...additionalWorkspaceIds.filter((_, i) => i !== idx),
                  ]}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => setAdditionalWorkspaceIds(additionalWorkspaceIds.filter((_, i) => i !== idx))}
                aria-label="워크스페이스 제거"
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
            onClick={() => setAdditionalWorkspaceIds([...additionalWorkspaceIds, ""])}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            워크스페이스 추가
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

        {/* Workflow Mode */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="workflow-toggle"
              className="font-mono text-xs font-semibold text-muted-foreground tracking-wider flex items-center gap-2 cursor-pointer"
            >
              <Workflow className="h-3.5 w-3.5" />
              WORKFLOW MODE
            </Label>
            <Switch id="workflow-toggle" checked={workflowEnabled} onCheckedChange={setWorkflowEnabled} />
          </div>
          <p className="font-mono text-2xs text-muted-foreground/70">
            활성화하면 Research → Plan → Implement 단계를 순차 진행합니다.
          </p>
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
            disabled={creating || !selectedWorkspaceId || (useWorktree && !worktreeName.trim())}
          >
            <Rocket className="h-4 w-4 mr-2" />
            {creating
              ? (useWorktree && worktreeName.trim() ? "워크트리 생성 중…" : "Creating…")
              : "Create Session"}
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
