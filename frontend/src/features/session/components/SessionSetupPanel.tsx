import { useState } from 'react';
import { Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { DirectoryPicker } from '@/features/directory/components/DirectoryPicker';
import { AVAILABLE_TOOLS } from '../constants/tools';

interface SessionSetupPanelProps {
  onCreate: (
    workDir?: string,
    options?: { allowed_tools?: string; system_prompt?: string; timeout_seconds?: number },
  ) => void;
  onCancel: () => void;
}

export function SessionSetupPanel({ onCreate, onCancel }: SessionSetupPanelProps) {
  const [workDir, setWorkDir] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [timeoutMinutes, setTimeoutMinutes] = useState('');
  const [creating, setCreating] = useState(false);

  const handleToolToggle = (tool: string, checked: boolean) => {
    setSelectedTools((prev) =>
      checked ? [...prev, tool] : prev.filter((t) => t !== tool),
    );
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const options: { allowed_tools?: string; system_prompt?: string; timeout_seconds?: number } = {};
      if (selectedTools.length > 0) {
        options.allowed_tools = selectedTools.join(',');
      }
      if (systemPrompt.trim()) {
        options.system_prompt = systemPrompt.trim();
      }
      if (timeoutMinutes && Number(timeoutMinutes) > 0) {
        options.timeout_seconds = Number(timeoutMinutes) * 60;
      }
      onCreate(workDir || undefined, Object.keys(options).length > 0 ? options : undefined);
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

        {/* Working Directory */}
        <div className="space-y-2">
          <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
            WORKING DIRECTORY
          </Label>
          <DirectoryPicker value={workDir} onChange={setWorkDir} />
        </div>

        {/* Allowed Tools */}
        <div className="space-y-3">
          <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
            ALLOWED TOOLS
          </Label>
          <p className="font-mono text-[10px] text-muted-foreground/70">
            Claude CLI에 허용할 도구를 선택하세요. 미선택 시 전역 설정이 적용됩니다.
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

        {/* System Prompt */}
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

        {/* Timeout */}
        <div className="space-y-2">
          <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
            TIMEOUT (분)
          </Label>
          <p className="font-mono text-[10px] text-muted-foreground/70">
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
            disabled={creating}
          >
            <Rocket className="h-4 w-4 mr-2" />
            {creating ? 'Creating…' : 'Create Session'}
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
