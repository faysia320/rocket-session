import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { config } from "@/config/env";
import { teamKeys } from "./teamKeys";
import {
  getBackoffDelay,
  RECONNECT_MAX_ATTEMPTS,
} from "@/features/chat/hooks/useClaudeSocket.utils";

/** 팀 WebSocket 이벤트 타입. */
export type TeamWsEvent =
  | {
      type: "team_state";
      team_id: string;
      status: string;
      member_count: number;
      task_summary: Record<string, number>;
    }
  | { type: "team_task_created"; team_id: string; task_id: number; task_title: string }
  | { type: "team_task_updated"; team_id: string; task_id: number }
  | {
      type: "team_task_completed";
      team_id: string;
      task_id: number;
      task_title: string;
      session_id: string;
      result_summary: string | null;
    }
  | {
      type: "team_task_delegated";
      team_id: string;
      task_id: number;
      task_title: string;
      member_id: number;
    }
  | { type: "team_member_joined"; team_id: string; member_id: number }
  | { type: "team_member_left"; team_id: string; member_id: number }
  | { type: "team_status_changed"; team_id: string; status: string }
  | { type: "team_message"; team_id: string; message: Record<string, unknown> }
  | { type: "ping" }
  | { type: "pong" }
  | { type: "delegate_result"; success: boolean; task_id?: number; error?: string };

function getTeamWsUrl(teamId: string): string {
  const wsBase =
    config.WS_BASE_URL ||
    `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
  return `${wsBase}/api/teams/ws/${teamId}`;
}

/**
 * 팀 대시보드 WebSocket 훅. 실시간 이벤트를 수신하고 쿼리 캐시를 무효화.
 */
export function useTeamSocket(teamId: string | undefined) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const shouldReconnect = useRef(true);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);

  const invalidateTeam = useCallback(() => {
    if (!teamId) return;
    queryClient.invalidateQueries({ queryKey: teamKeys.detail(teamId) });
    queryClient.invalidateQueries({ queryKey: teamKeys.tasks(teamId) });
    queryClient.invalidateQueries({ queryKey: teamKeys.list() });
  }, [queryClient, teamId]);

  const handleEvent = useCallback(
    (event: TeamWsEvent) => {
      switch (event.type) {
        case "team_task_completed":
          toast.success(`태스크 "${event.task_title}" 완료`);
          invalidateTeam();
          break;
        case "team_task_delegated":
          toast.info(`태스크 "${event.task_title}" 위임됨`);
          invalidateTeam();
          break;
        case "team_task_created":
        case "team_task_updated":
        case "team_member_joined":
        case "team_member_left":
        case "team_status_changed":
          invalidateTeam();
          break;
        case "team_message":
          if (teamId) {
            queryClient.invalidateQueries({ queryKey: teamKeys.messages(teamId) });
          }
          break;
        case "delegate_result":
          if (!event.success) {
            toast.error(`위임 실패: ${event.error}`);
          }
          break;
        case "team_state":
        case "ping":
        case "pong":
          break;
      }
    },
    [invalidateTeam, queryClient, teamId],
  );

  const connect = useCallback(() => {
    if (!teamId) return;

    const url = getTeamWsUrl(teamId);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempt.current = 0;
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as TeamWsEvent;
        handleEvent(data);
      } catch {
        // JSON 파싱 실패 무시
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (shouldReconnect.current) {
        const attempt = reconnectAttempt.current;
        if (attempt >= RECONNECT_MAX_ATTEMPTS) return;
        reconnectAttempt.current = attempt + 1;
        reconnectTimer.current = setTimeout(connect, getBackoffDelay(attempt));
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [teamId, handleEvent]);

  useEffect(() => {
    shouldReconnect.current = true;
    connect();

    return () => {
      shouldReconnect.current = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  /** WebSocket을 통해 위임 명령 전송. */
  const sendDelegate = useCallback((taskId: number, memberId?: number, prompt?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        type: "delegate",
        task_id: taskId,
        member_id: memberId,
        prompt,
      }),
    );
  }, []);

  return { sendDelegate };
}
