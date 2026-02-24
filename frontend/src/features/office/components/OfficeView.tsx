import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { OfficeCanvas } from "./OfficeCanvas";
import { OfficeToolbar } from "./OfficeToolbar";
import { OfficeOverlay } from "./OfficeOverlay";
import { useAgentSync } from "../hooks/useAgentSync";
import type { AgentState } from "../types/office";

export function OfficeView() {
  const navigate = useNavigate();

  // 세션 → 에이전트 동기화
  useAgentSync();

  const handleAgentClick = useCallback(
    (agent: AgentState) => {
      navigate({ to: "/session/$sessionId", params: { sessionId: agent.sessionId } });
    },
    [navigate],
  );

  const handleEmptyDeskClick = useCallback(() => {
    navigate({ to: "/session/new" });
  }, [navigate]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-background">
      <OfficeCanvas
        onAgentClick={handleAgentClick}
        onEmptyDeskClick={handleEmptyDeskClick}
      />
      <OfficeOverlay />
      <OfficeToolbar />
    </div>
  );
}
