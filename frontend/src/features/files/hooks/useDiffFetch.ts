import { useState, useCallback, useRef } from "react";
import { sessionsApi } from "@/lib/api/sessions.api";

interface UseDiffFetchResult {
  diff: string | null;
  loading: boolean;
  fetchIfNeeded: () => void;
}

export function useDiffFetch(sessionId: string, filePath: string): UseDiffFetchResult {
  const [diff, setDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const fetchIfNeeded = useCallback(() => {
    if (fetchedRef.current || loading) return;
    fetchedRef.current = true;
    setLoading(true);
    sessionsApi
      .fileDiff(sessionId, filePath)
      .then((result) => setDiff(result))
      .catch(() => setDiff(""))
      .finally(() => setLoading(false));
  }, [sessionId, filePath, loading]);

  return { diff, loading, fetchIfNeeded };
}
