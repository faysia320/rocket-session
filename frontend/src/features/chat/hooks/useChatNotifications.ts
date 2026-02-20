import { useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SessionInfo, SessionStatus, Message, PermissionRequestData } from "@/types";
import { useNotificationCenter } from "@/features/notification/hooks/useNotificationCenter";
import { sessionKeys } from "@/features/session/hooks/sessionKeys";

interface UseChatNotificationsParams {
  sessionId: string;
  status: SessionStatus;
  messages: Message[];
  pendingPermission: PermissionRequestData | null;
  workDir: string | undefined;
}

export function useChatNotifications({
  sessionId,
  status,
  messages,
  pendingPermission,
  workDir,
}: UseChatNotificationsParams) {
  const { notify } = useNotificationCenter();
  const queryClient = useQueryClient();

  // 세션 상태 전환 시 알림 + gitInfo 갱신 + 세션 목록 캐시 동기화
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev === status) return;

    // 세션 목록 캐시에 상태를 실시간 반영 (사이드바 동기화)
    queryClient.setQueryData<SessionInfo[]>(
      sessionKeys.list(),
      (old) => old?.map((s) =>
        s.id === sessionId ? { ...s, status } : s,
      ),
    );

    // running → idle: 작업 완료
    if (prev === "running" && status === "idle") {
      notify("task.complete", {
        title: "Claude Code",
        body: "작업이 완료되었습니다.",
      });
      if (workDir) {
        const timer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["git-info", workDir] });
        }, 1500);
        prevStatusRef.current = status;
        return () => clearTimeout(timer);
      }
    }

    // → running: 세션 시작
    if (status === "running" && prev !== "running") {
      notify("session.start", {
        title: "Claude Code",
        body: "세션이 실행을 시작했습니다.",
      });
    }

    prevStatusRef.current = status;
  }, [status, workDir, queryClient, notify, sessionId]);

  // 에러 메시지 수신 시 알림
  const prevMsgCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      const newMsgs = messages.slice(prevMsgCountRef.current);
      for (const msg of newMsgs) {
        if (msg.type === "error") {
          notify("task.error", {
            title: "Claude Code",
            body: "세션에서 에러가 발생했습니다.",
          });
          break;
        }
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, messages, notify]);

  // Permission 요청 시 알림
  const prevPermissionRef = useRef(pendingPermission);
  useEffect(() => {
    if (pendingPermission && pendingPermission !== prevPermissionRef.current) {
      notify("input.required", {
        title: "Permission 요청",
        body: `${pendingPermission.tool_name} 도구 사용 승인이 필요합니다.`,
      });
    }
    prevPermissionRef.current = pendingPermission;
  }, [pendingPermission, notify]);
}
