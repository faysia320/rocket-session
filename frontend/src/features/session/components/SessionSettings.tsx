import { useState, useEffect, useCallback } from 'react';
import { Settings, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { sessionsApi } from '@/lib/api/sessions.api';
import { AVAILABLE_TOOLS } from '../constants/tools';

const PERMISSION_TOOLS = ['Bash', 'Write', 'Edit', 'MultiEdit'] as const;

interface SessionSettingsProps {
  sessionId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SessionSettings({ sessionId, open: controlledOpen, onOpenChange: controlledOnOpenChange }: SessionSettingsProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [timeoutMinutes, setTimeoutMinutes] = useState('');
  const [permissionMode, setPermissionMode] = useState(false);
  const [permissionTools, setPermissionTools] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const s = await sessionsApi.get(sessionId);
      setSelectedTools(s.allowed_tools ? s.allowed_tools.split(',').map((t) => t.trim()) : []);
      setSystemPrompt(s.system_prompt ?? '');
      setTimeoutMinutes(s.timeout_seconds ? String(Math.round(s.timeout_seconds / 60)) : '');
      setPermissionMode(s.permission_mode ?? false);
      setPermissionTools(s.permission_required_tools ?? []);
    } catch {
      // ignore
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
        allowed_tools: selectedTools.length > 0 ? selectedTools.join(',') : null,
        system_prompt: systemPrompt || null,
        timeout_seconds: timeoutSec,
        permission_mode: permissionMode,
        permission_required_tools: permissionMode && permissionTools.length > 0 ? permissionTools : null,
      });
      setOpen(false);
    } catch {
      // ignore
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
      <PopoverContent className="w-[360px] bg-card border-border overflow-y-auto max-h-[80vh]" align="end">
        <div className="font-mono text-sm font-semibold text-foreground mb-4">
          Session Settings
        </div>

        <div className="space-y-5">
          {/* 허용 도구 */}
          <div className="space-y-3">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              ALLOWED TOOLS
            </Label>
            <p className="font-mono text-[10px] text-muted-foreground/70">
              Claude CLI에 허용할 도구를 선택하세요. 미선택 시 전역 설정이 적용됩니다.
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
                  <span className="font-mono text-xs text-foreground">{tool}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 시스템 프롬프트 */}
          <div className="space-y-2">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              SYSTEM PROMPT
            </Label>
            <p className="font-mono text-[10px] text-muted-foreground/70">
              세션에 주입할 시스템 지시사항입니다.
            </p>
            <Textarea
              className="font-mono text-xs min-h-[100px] bg-input border-border"
              placeholder="예: 모든 코드에 한국어 주석을 달아주세요."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
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
                    <span className="font-mono text-xs text-foreground">{tool}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          {/* 타임아웃 */}
          <div className="space-y-2">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              TIMEOUT (분)
            </Label>
            <p className="font-mono text-[10px] text-muted-foreground/70">
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
            {saving ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
