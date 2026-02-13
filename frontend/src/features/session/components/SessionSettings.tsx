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

const AVAILABLE_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'MultiEdit',
  'Bash',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
  'TodoRead',
  'TodoWrite',
];

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
  const [saving, setSaving] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const s = await sessionsApi.get(sessionId);
      setSelectedTools(s.allowed_tools ? s.allowed_tools.split(',').map((t) => t.trim()) : []);
      setSystemPrompt(s.system_prompt ?? '');
      setTimeoutMinutes(s.timeout_seconds ? String(Math.round(s.timeout_seconds / 60)) : '');
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const timeoutSec = timeoutMinutes ? Number(timeoutMinutes) * 60 : null;
      await sessionsApi.update(sessionId, {
        allowed_tools: selectedTools.length > 0 ? selectedTools.join(',') : null,
        system_prompt: systemPrompt || null,
        timeout_seconds: timeoutSec,
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
          aria-label="\uC138\uC158 \uC124\uC815"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] bg-card border-border overflow-y-auto max-h-[80vh]" align="end">
        <div className="font-mono text-sm font-semibold text-foreground mb-4">
          Session Settings
        </div>

        <div className="space-y-5">
          {/* \uD5C8\uC6A9 \uB3C4\uAD6C */}
          <div className="space-y-3">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              ALLOWED TOOLS
            </Label>
            <p className="font-mono text-[10px] text-muted-foreground/70">
              Claude CLI\uC5D0 \uD5C8\uC6A9\uD560 \uB3C4\uAD6C\uB97C \uC120\uD0DD\uD558\uC138\uC694. \uBBF8\uC120\uD0DD \uC2DC \uC804\uC5ED \uC124\uC815\uC774 \uC801\uC6A9\uB429\uB2C8\uB2E4.
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

          {/* \uC2DC\uC2A4\uD15C \uD504\uB86C\uD504\uD2B8 */}
          <div className="space-y-2">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              SYSTEM PROMPT
            </Label>
            <p className="font-mono text-[10px] text-muted-foreground/70">
              \uC138\uC158\uC5D0 \uC8FC\uC785\uD560 \uC2DC\uC2A4\uD15C \uC9C0\uC2DC\uC0AC\uD56D\uC785\uB2C8\uB2E4.
            </p>
            <Textarea
              className="font-mono text-xs min-h-[100px] bg-input border-border"
              placeholder="\uC608: \uBAA8\uB4E0 \uCF54\uB4DC\uC5D0 \uD55C\uAD6D\uC5B4 \uC8FC\uC11D\uC744 \uB2EC\uC544\uC8FC\uC138\uC694."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </div>

          {/* \uD0C0\uC784\uC544\uC6C3 */}
          <div className="space-y-2">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              TIMEOUT (\uBD84)
            </Label>
            <p className="font-mono text-[10px] text-muted-foreground/70">
              \uD504\uB85C\uC138\uC2A4 \uCD5C\uB300 \uC2E4\uD589 \uC2DC\uAC04. \uBE44\uC6CC\uB450\uBA74 \uBB34\uC81C\uD55C\uC785\uB2C8\uB2E4.
            </p>
            <Input
              className="font-mono text-xs bg-input border-border w-24"
              type="number"
              min="1"
              placeholder="\uC5C6\uC74C"
              value={timeoutMinutes}
              onChange={(e) => setTimeoutMinutes(e.target.value)}
            />
          </div>

          {/* \uC800\uC7A5 \uBC84\uD2BC */}
          <Button
            className="w-full font-mono text-xs font-semibold"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saving ? 'Saving\u2026' : 'Save Settings'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
