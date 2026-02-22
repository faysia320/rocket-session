import {
  Trash2,
  Search,
  ToggleLeft,
  Minimize2,
  Cpu,
  Settings,
  FolderOpen,
} from "lucide-react";
import type { PaletteCommand } from "../types";

function dispatch(
  event: string,
  sessionId: string | null,
  data?: string,
) {
  window.dispatchEvent(
    new CustomEvent(event, { detail: { sessionId, data } }),
  );
}

export function createChatCommands(deps: {
  activeSessionId: string | null;
}): PaletteCommand[] {
  const { activeSessionId } = deps;

  return [
    {
      id: "chat:clear",
      label: "메시지 초기화",
      description: "현재 대화 내역 모두 삭제 (/clear)",
      category: "chat",
      icon: Trash2,
      action: () => dispatch("command-palette:clear-messages", activeSessionId),
      context: { requiresActiveSession: true, allowedZones: ["session-workspace"] },
      keywords: ["clear", "초기화", "삭제"],
    },
    {
      id: "chat:search",
      label: "메시지 검색",
      description: "대화 내 텍스트 검색 토글",
      category: "chat",
      icon: Search,
      shortcut: "⌘F",
      action: () => dispatch("command-palette:toggle-search", activeSessionId),
      context: { requiresActiveSession: true, allowedZones: ["session-workspace"] },
      keywords: ["search", "find", "검색", "찾기"],
    },
    {
      id: "chat:toggle-mode",
      label: "모드 전환 (Normal ↔ Plan)",
      description: "일반 모드와 계획 모드 사이 전환",
      category: "chat",
      icon: ToggleLeft,
      shortcut: "⇧Tab",
      action: () => dispatch("command-palette:toggle-mode", activeSessionId),
      context: { requiresActiveSession: true, allowedZones: ["session-workspace"] },
      keywords: ["mode", "plan", "normal", "모드", "계획"],
    },
    {
      id: "chat:compact",
      label: "컨텍스트 압축 (/compact)",
      description: "대화를 요약하여 컨텍스트 절약",
      category: "chat",
      icon: Minimize2,
      action: () =>
        dispatch("command-palette:send-slash", activeSessionId, "/compact"),
      context: { requiresActiveSession: true, requiresRunning: false, allowedZones: ["session-workspace"] },
      keywords: ["compact", "압축", "요약"],
    },
    {
      id: "chat:model",
      label: "모델 변경 (/model)",
      description: "사용할 Claude 모델 선택",
      category: "chat",
      icon: Cpu,
      action: () =>
        dispatch("command-palette:send-slash", activeSessionId, "/model"),
      context: { requiresActiveSession: true, requiresRunning: false, allowedZones: ["session-workspace"] },
      keywords: ["model", "모델", "변경"],
    },
    {
      id: "chat:settings",
      label: "세션 설정 열기",
      description: "현재 세션의 설정 패널 표시",
      category: "chat",
      icon: Settings,
      action: () =>
        dispatch("command-palette:open-settings", activeSessionId),
      context: { requiresActiveSession: true, allowedZones: ["session-workspace"] },
      keywords: ["settings", "설정", "config"],
    },
    {
      id: "chat:files",
      label: "파일 패널 토글",
      description: "파일 변경 패널 표시/숨김",
      category: "chat",
      icon: FolderOpen,
      action: () => dispatch("command-palette:toggle-files", activeSessionId),
      context: { requiresActiveSession: true, allowedZones: ["session-workspace"] },
      keywords: ["files", "파일", "변경"],
    },
  ];
}
