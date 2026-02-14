import { memo, useEffect } from 'react';
import { sessionsApi } from '@/lib/api/sessions.api';

interface ModelSelectorProps {
  sessionId: string;
  currentModel?: string | null;
  disabled?: boolean;
}

export const ModelSelector = memo(function ModelSelector({
  sessionId,
  currentModel,
}: ModelSelectorProps) {
  useEffect(() => {
    if (currentModel !== 'opus') {
      sessionsApi.update(sessionId, { model: 'opus' }).catch(() => {});
    }
  }, [sessionId, currentModel]);

  return null;
});
