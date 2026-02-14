import { memo, useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { sessionsApi } from '@/lib/api/sessions.api';

const MODELS = [
  { value: 'default', label: 'Default' },
  { value: 'opus', label: 'Opus' },
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'haiku', label: 'Haiku' },
] as const;

interface ModelSelectorProps {
  sessionId: string;
  currentModel?: string | null;
  disabled?: boolean;
}

export const ModelSelector = memo(function ModelSelector({
  sessionId,
  currentModel,
  disabled = false,
}: ModelSelectorProps) {
  const [value, setValue] = useState(currentModel || 'default');

  useEffect(() => {
    setValue(currentModel || 'default');
  }, [currentModel]);

  const handleChange = (newValue: string) => {
    setValue(newValue);
    sessionsApi.update(sessionId, { model: newValue === 'default' ? null : newValue }).catch(() => {});
  };

  return (
    <Select value={value} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className="h-7 w-[100px] font-mono text-[11px] bg-secondary border-border">
        <SelectValue placeholder="Model" />
      </SelectTrigger>
      <SelectContent>
        {MODELS.map((m) => (
          <SelectItem key={m.value} value={m.value} className="font-mono text-xs">
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});
