import { Square, Trash2, Pencil, Download } from "lucide-react";
import type { PaletteCommand } from "../types";

export function createSessionCommands(deps: {
  activeSessionId: string | null;
  stopSession: (id: string) => void;
  deleteSession: (id: string) => void;
  exportSession: (id: string) => void;
}): PaletteCommand[] {
  const { activeSessionId } = deps;
  if (!activeSessionId) return [];

  return [
    {
      id: "session:stop",
      label: "세션 중지",
      description: "현재 실행 중인 세션을 정지",
      category: "session",
      icon: Square,
      action: () => deps.stopSession(activeSessionId),
      context: { requiresActiveSession: true, requiresRunning: true },
      keywords: ["stop", "중지", "정지"],
    },
    {
      id: "session:delete",
      label: "세션 삭제",
      description: "현재 세션 및 관련 데이터 영구 삭제",
      category: "session",
      icon: Trash2,
      action: () => deps.deleteSession(activeSessionId),
      context: { requiresActiveSession: true },
      keywords: ["delete", "삭제", "remove"],
    },
    {
      id: "session:rename",
      label: "세션 이름 변경",
      description: "현재 세션의 표시 이름 수정",
      category: "session",
      icon: Pencil,
      action: () =>
        window.dispatchEvent(
          new CustomEvent("command-palette:rename-session", {
            detail: activeSessionId,
          }),
        ),
      context: { requiresActiveSession: true },
      keywords: ["rename", "이름", "변경"],
    },
    {
      id: "session:export",
      label: "Markdown으로 내보내기",
      description: "현재 대화를 Markdown 파일로 다운로드",
      category: "session",
      icon: Download,
      action: () => deps.exportSession(activeSessionId),
      context: { requiresActiveSession: true },
      keywords: ["export", "markdown", "내보내기", "다운로드"],
    },
  ];
}
