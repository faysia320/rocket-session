import { memo } from "react";
import { useOfficeStore } from "../hooks/useOfficeStore";
import { Building2 } from "lucide-react";

/**
 * 에이전트 없을 때 빈 상태 오버레이.
 * Canvas 위에 HTML로 렌더링.
 */
export const OfficeOverlay = memo(function OfficeOverlay() {
  const agents = useOfficeStore((s) => s.agents);

  if (agents.length > 0) return null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      <Building2 className="h-12 w-12 text-muted-foreground/30 mb-3" />
      <p className="font-mono text-sm text-muted-foreground/50">
        아직 세션이 없습니다
      </p>
      <p className="font-mono text-xs text-muted-foreground/30 mt-1">
        세션을 생성하면 에이전트가 사무실에 나타납니다
      </p>
    </div>
  );
});
