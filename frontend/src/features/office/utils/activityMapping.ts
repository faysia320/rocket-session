import { getActivityLabel } from "@/features/chat/utils/activityLabel";
import type { SessionInfo } from "@/types/session";
import type { AgentActivity, AgentState } from "../types/office";

const TOOL_TO_ACTIVITY: Record<string, AgentActivity> = {
  Read: "reading",
  Grep: "reading",
  Glob: "reading",
  TodoRead: "reading",
  Write: "writing",
  Edit: "writing",
  MultiEdit: "writing",
  TodoWrite: "writing",
  Bash: "running",
  Task: "running",
  WebFetch: "searching",
  WebSearch: "searching",
  __thinking__: "thinking",
};

export function mapToolToActivity(tool: string): AgentActivity {
  return TOOL_TO_ACTIVITY[tool] ?? "thinking";
}

export function mapSessionToAgent(
  session: SessionInfo,
  deskIndex: number,
): AgentState {
  let activity: AgentActivity = "idle";
  let activityLabel = "";

  if (session.status === "error") {
    activity = "error";
    activityLabel = "Error";
  } else if (session.status === "running") {
    if (session.current_activity) {
      activity = mapToolToActivity(session.current_activity.tool);
      activityLabel = getActivityLabel(
        session.current_activity.tool,
        session.current_activity.input as Record<string, unknown> | undefined,
      );
    } else {
      activity = "thinking";
      activityLabel = "Thinking\u2026";
    }
  }

  return {
    sessionId: session.id,
    sessionName: session.name || `Session ${session.id.slice(0, 6)}`,
    activity,
    activityLabel,
    deskIndex,
    characterId: deskIndex % 6,
  };
}
