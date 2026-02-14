import { useState, useEffect, type ReactNode } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { DirectoryPicker } from '@/features/directory/components/DirectoryPicker';
import { NotificationSettingsPanel } from '@/features/notification/components/NotificationSettingsPanel';
import { useGlobalSettings, useUpdateGlobalSettings } from '../hooks/useGlobalSettings';
import { AVAILABLE_TOOLS } from '@/features/session/constants/tools';

/** Permission 승인 대상 도구 목록 */
const PERMISSION_TOOLS = ['Bash', 'Write', 'Edit', 'MultiEdit'] as const;

interface GlobalSettingsDialogProps {
  children: ReactNode;
}

/** 글로벌 설정 다이얼로그 컴포넌트 */
export function GlobalSettingsDialog({ children }: GlobalSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const { data: settings } = useGlobalSettings();
  const updateMutation = useUpdateGlobalSettings();

  const [workDir, setWorkDir] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [timeoutMinutes, setTimeoutMinutes] = useState('');
  const [mode, setMode] = useState<'normal' | 'plan'>('normal');
  const [permissionMode, setPermissionMode] = useState(false);
  const [permissionTools, setPermissionTools] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [maxTurns, setMaxTurns] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [systemPromptMode, setSystemPromptMode] = useState<'replace' | 'append'>('replace');
  const [disallowedTools, setDisallowedTools] = useState<string[]>([]);

  // 다이얼로그 열릴 때 현재 글로벌 설정값으로 초기화
  useEffect(() => {
    if (open && settings) {
      setWorkDir(settings.work_dir ?? '');
      setSelectedTools(
        settings.allowed_tools ? settings.allowed_tools.split(',').map((t) => t.trim()) : [],
      );
      setSystemPrompt(settings.system_prompt ?? '');
      setTimeoutMinutes(
        settings.timeout_seconds ? String(Math.round(settings.timeout_seconds / 60)) : '',
      );
      setMode(settings.mode ?? 'normal');
      setPermissionMode(settings.permission_mode ?? false);
      setPermissionTools(settings.permission_required_tools ?? []);
      setModel(settings.model ?? '');
      setMaxTurns(settings.max_turns ? String(settings.max_turns) : '');
      setMaxBudget(settings.max_budget_usd ? String(settings.max_budget_usd) : '');
      setSystemPromptMode((settings.system_prompt_mode as 'replace' | 'append') ?? 'replace');
      setDisallowedTools(settings.disallowed_tools ? settings.disallowed_tools.split(',').map((t) => t.trim()) : []);
    }
  }, [open, settings]);

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
    try {
      const timeoutSec = timeoutMinutes ? Number(timeoutMinutes) * 60 : null;
      await updateMutation.mutateAsync({
        work_dir: workDir || null,
        allowed_tools: selectedTools.length > 0 ? selectedTools.join(',') : null,
        system_prompt: systemPrompt || null,
        timeout_seconds: timeoutSec,
        mode,
        permission_mode: permissionMode,
        permission_required_tools:
          permissionMode && permissionTools.length > 0 ? permissionTools : null,
        model: model || null,
        max_turns: maxTurns ? Number(maxTurns) : null,
        max_budget_usd: maxBudget ? Number(maxBudget) : null,
        system_prompt_mode: systemPromptMode,
        disallowed_tools: disallowedTools.length > 0 ? disallowedTools.join(',') : null,
      });
      toast.success('글로벌 설정이 저장되었습니다.');
      setOpen(false);
    } catch {
      toast.error('설정 저장에 실패했습니다.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-mono text-sm font-semibold">
            Global Settings
          </DialogTitle>
          <p className="font-mono text-[11px] text-muted-foreground">
            모든 세션에 적용되는 기본 설정입니다. 세션에서 개별 설정 시 이 값이 덮어씌워집니다.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
        <div className="space-y-5 pt-2 pb-1">
          {/* Working Directory */}
          <div className="space-y-2">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              WORKING DIRECTORY
            </Label>
            <p className="font-mono text-[10px] text-muted-foreground/70">
              새 세션 생성 시 기본 작업 디렉토리입니다.
            </p>
            <DirectoryPicker value={workDir} onChange={setWorkDir} />
          </div>

          {/* Model */}
          <div className="space-y-2">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              MODEL
            </Label>
            <p className="font-mono text-[10px] text-muted-foreground/70">
              Claude CLI에 전달할 기본 모델입니다. 비워두면 전역 설정 또는 기본값을 사용합니다.
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

          {/* Allowed Tools */}
          <div className="space-y-3">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              ALLOWED TOOLS
            </Label>
            <p className="font-mono text-[10px] text-muted-foreground/70">
              Claude CLI에 허용할 기본 도구입니다. 세션에서 개별 설정 시 이 값이 덮어씌워집니다.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {AVAILABLE_TOOLS.map((tool) => (
                <label key={tool} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedTools.includes(tool)}
                    onCheckedChange={(checked) => handleToolToggle(tool, checked === true)}
                  />
                  <span className="font-mono text-xs text-foreground">{tool}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Disallowed Tools */}
          <div className="space-y-3">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              DISALLOWED TOOLS
            </Label>
            <p className="font-mono text-[10px] text-muted-foreground/70">
              Claude CLI에서 사용을 금지할 도구입니다. 세션에서 개별 설정 시 이 값이 덮어씌워집니다.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {AVAILABLE_TOOLS.map((tool) => (
                <label key={`dis-${tool}`} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={disallowedTools.includes(tool)}
                    onCheckedChange={(checked) =>
                      setDisallowedTools((prev) =>
                        checked === true ? [...prev, tool] : prev.filter((t) => t !== tool)
                      )
                    }
                  />
                  <span className="font-mono text-xs text-foreground">{tool}</span>
                </label>
              ))}
            </div>
          </div>

          {/* System Prompt */}
          <div className="space-y-2">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              SYSTEM PROMPT
            </Label>
            <p className="font-mono text-[10px] text-muted-foreground/70">
              모든 세션에 주입할 기본 시스템 지시사항입니다. 세션에서 개별 설정 시 이 값이 덮어씌워집니다.
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
            <p className="font-mono text-[10px] text-muted-foreground/70">
              시스템 프롬프트 적용 방식입니다. 세션에서 개별 설정 시 이 값이 덮어씌워집니다.
            </p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={systemPromptMode === 'replace'}
                  onCheckedChange={() => setSystemPromptMode('replace')}
                />
                <span className="font-mono text-xs text-foreground">전체 대체</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={systemPromptMode === 'append'}
                  onCheckedChange={() => setSystemPromptMode('append')}
                />
                <span className="font-mono text-xs text-foreground">기본에 추가</span>
              </label>
            </div>
          </div>

          {/* Mode */}
          <div className="space-y-2">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              MODE
            </Label>
            <p className="font-mono text-[10px] text-muted-foreground/70">
              기본 실행 모드입니다. Plan 모드에서는 계획만 수립하고 승인 후 실행합니다.
            </p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={mode === 'normal'}
                  onCheckedChange={() => setMode('normal')}
                />
                <span className="font-mono text-xs text-foreground">Normal</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={mode === 'plan'}
                  onCheckedChange={() => setMode('plan')}
                />
                <span className="font-mono text-xs text-foreground">Plan</span>
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
                onCheckedChange={(checked) => setPermissionMode(checked === true)}
              />
              <span className="font-mono text-xs text-foreground">
                도구 실행 전 확인 요청 활성화
              </span>
            </label>
            <p className="font-mono text-[10px] text-muted-foreground/70">
              활성화하면 아래 선택한 도구 실행 시 사용자 승인을 요청합니다.
              세션에서 개별 설정 시 이 값이 덮어씌워집니다.
            </p>
            {permissionMode ? (
              <div className="grid grid-cols-2 gap-2 pl-2 border-l-2 border-warning/30">
                {PERMISSION_TOOLS.map((tool) => (
                  <label key={tool} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={permissionTools.includes(tool)}
                      onCheckedChange={(checked) =>
                        handlePermissionToolToggle(tool, checked === true)
                      }
                    />
                    <span className="font-mono text-xs text-foreground">{tool}</span>
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
            <p className="font-mono text-[10px] text-muted-foreground/70">
              에이전트 턴 최대 횟수입니다. 비워두면 무제한입니다.
              세션에서 개별 설정 시 이 값이 덮어씌워집니다.
            </p>
            <Input
              className="font-mono text-xs bg-input border-border w-28"
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
            <p className="font-mono text-[10px] text-muted-foreground/70">
              세션당 최대 비용 한도입니다. 비워두면 제한 없음.
              세션에서 개별 설정 시 이 값이 덮어씌워집니다.
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

          {/* Timeout */}
          <div className="space-y-2">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              TIMEOUT (분)
            </Label>
            <p className="font-mono text-[10px] text-muted-foreground/70">
              기본 프로세스 최대 실행 시간입니다. 비워두면 무제한입니다.
              세션에서 개별 설정 시 이 값이 덮어씌워집니다.
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

          {/* Notification Settings */}
          <div className="border-t border-border pt-5">
            <NotificationSettingsPanel />
          </div>

          {/* Save */}
          <Button
            className="w-full font-mono text-xs font-semibold"
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {updateMutation.isPending ? 'Saving\u2026' : 'Save Settings'}
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
