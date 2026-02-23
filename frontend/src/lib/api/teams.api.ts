/**
 * 팀 도메인 API 함수.
 */
import { api } from "./client";
import type {
  TeamInfo,
  TeamListItem,
  TeamMemberInfo,
  TeamTaskInfo,
  TeamMessageInfo,
  CreateTeamRequest,
  UpdateTeamRequest,
  AddTeamMemberRequest,
  CreateMemberSessionRequest,
  SetLeadRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
  CompleteTaskRequest,
  SendMessageRequest,
} from "@/types";

export const teamsApi = {
  // ── 팀 CRUD ──

  list: (status?: string) =>
    api.get<TeamListItem[]>(`/api/teams/${status ? `?status=${status}` : ""}`),

  get: (id: string) => api.get<TeamInfo>(`/api/teams/${id}`),

  create: (data: CreateTeamRequest) => api.post<TeamInfo>("/api/teams/", data),

  update: (id: string, data: UpdateTeamRequest) => api.patch<TeamInfo>(`/api/teams/${id}`, data),

  delete: (id: string) => api.delete<void>(`/api/teams/${id}`),

  // ── 멤버 관리 ──

  getMembers: (teamId: string) =>
    api.get<TeamMemberInfo[]>(`/api/teams/${teamId}/members`),

  addMember: (teamId: string, data: AddTeamMemberRequest) =>
    api.post<TeamMemberInfo>(`/api/teams/${teamId}/members`, data),

  createMemberSession: (teamId: string, data: CreateMemberSessionRequest) =>
    api.post<TeamMemberInfo>(`/api/teams/${teamId}/members/create`, data),

  removeMember: (teamId: string, sessionId: string) =>
    api.delete<void>(`/api/teams/${teamId}/members/${sessionId}`),

  setLead: (teamId: string, data: SetLeadRequest) =>
    api.patch<TeamInfo>(`/api/teams/${teamId}/lead`, data),

  // ── 팀 상태 ──

  getStatus: (teamId: string) =>
    api.get<{
      team_id: string;
      status: string;
      members: TeamMemberInfo[];
      task_summary: { total: number; pending: number; in_progress: number; completed: number; failed: number };
    }>(`/api/teams/${teamId}/status`),

  // ── 태스크 관리 ──

  listTasks: (teamId: string, status?: string) =>
    api.get<TeamTaskInfo[]>(
      `/api/teams/${teamId}/tasks${status ? `?status=${status}` : ""}`,
    ),

  getTask: (teamId: string, taskId: number) =>
    api.get<TeamTaskInfo>(`/api/teams/${teamId}/tasks/${taskId}`),

  createTask: (teamId: string, data: CreateTaskRequest) =>
    api.post<TeamTaskInfo>(`/api/teams/${teamId}/tasks`, data),

  updateTask: (teamId: string, taskId: number, data: UpdateTaskRequest) =>
    api.patch<TeamTaskInfo>(`/api/teams/${teamId}/tasks/${taskId}`, data),

  deleteTask: (teamId: string, taskId: number) =>
    api.delete<void>(`/api/teams/${teamId}/tasks/${taskId}`),

  claimTask: (teamId: string, taskId: number, sessionId: string) =>
    api.post<TeamTaskInfo>(`/api/teams/${teamId}/tasks/${taskId}/claim`, {
      session_id: sessionId,
    }),

  completeTask: (teamId: string, taskId: number, data?: CompleteTaskRequest) =>
    api.post<TeamTaskInfo>(
      `/api/teams/${teamId}/tasks/${taskId}/complete`,
      data ?? {},
    ),

  reorderTasks: (teamId: string, taskIds: number[]) =>
    api.post<void>(`/api/teams/${teamId}/tasks/reorder`, {
      task_ids: taskIds,
    }),

  // ── 태스크 위임 ──

  delegateTask: (
    teamId: string,
    taskId: number,
    targetSessionId: string,
    prompt?: string,
  ) =>
    api.post<{ task_id: number; target_session_id: string; status: string }>(
      `/api/teams/${teamId}/tasks/${taskId}/delegate`,
      { target_session_id: targetSessionId, prompt },
    ),

  // ── 메시지 ──

  listMessages: (teamId: string, afterId?: number, limit?: number) => {
    const params = new URLSearchParams();
    if (afterId) params.set("after_id", String(afterId));
    if (limit) params.set("limit", String(limit));
    const qs = params.toString();
    return api.get<TeamMessageInfo[]>(
      `/api/teams/${teamId}/messages${qs ? `?${qs}` : ""}`,
    );
  },

  sendMessage: (teamId: string, fromSessionId: string, data: SendMessageRequest) =>
    api.post<TeamMessageInfo>(
      `/api/teams/${teamId}/messages?from_session_id=${fromSessionId}`,
      data,
    ),

  markMessagesRead: (teamId: string, messageIds: number[]) =>
    api.post<{ marked: number }>(`/api/teams/${teamId}/messages/read`, {
      message_ids: messageIds,
    }),
};
