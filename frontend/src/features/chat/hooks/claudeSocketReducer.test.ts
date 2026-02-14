import { describe, it, expect, beforeEach } from "vitest";
import {
  claudeSocketReducer,
  initialState,
  type ClaudeSocketState,
} from "./claudeSocketReducer";
import { resetMessageIdCounter } from "./useClaudeSocket.utils";

// 테스트 간 메시지 ID 카운터 리셋
beforeEach(() => {
  resetMessageIdCounter();
});

describe("claudeSocketReducer", () => {
  // -------------------------------------------------------------------
  // RESET_SESSION
  // -------------------------------------------------------------------
  it("RESET_SESSION은 초기 상태로 복원한다", () => {
    const modified: ClaudeSocketState = {
      ...initialState,
      connected: true,
      loading: false,
      status: "running",
      messages: [{ id: "1", type: "system", text: "hi" }],
    };
    const result = claudeSocketReducer(modified, { type: "RESET_SESSION" });
    expect(result).toEqual(initialState);
  });

  // -------------------------------------------------------------------
  // WS_OPEN
  // -------------------------------------------------------------------
  it("WS_OPEN은 connected=true로 설정하고 reconnectState를 connected로 변경한다", () => {
    const result = claudeSocketReducer(initialState, {
      type: "WS_OPEN",
      hadPriorSeq: false,
    });
    expect(result.connected).toBe(true);
    expect(result.reconnectState.status).toBe("connected");
    expect(result.reconnectState.attempt).toBe(0);
  });

  it("WS_OPEN (hadPriorSeq=true)은 activeTools를 비운다", () => {
    const withTools: ClaudeSocketState = {
      ...initialState,
      activeTools: [{ type: "tool_use", tool: "Read", tool_use_id: "t1", id: "m1" }],
    };
    const result = claudeSocketReducer(withTools, {
      type: "WS_OPEN",
      hadPriorSeq: true,
    });
    expect(result.activeTools).toEqual([]);
  });

  // -------------------------------------------------------------------
  // WS_STATUS
  // -------------------------------------------------------------------
  it("WS_STATUS running으로 상태 변경한다", () => {
    const result = claudeSocketReducer(initialState, {
      type: "WS_STATUS",
      status: "running",
    });
    expect(result.status).toBe("running");
  });

  it("WS_STATUS idle 시 activeTools를 비우고 running tool_use를 done으로 전환한다", () => {
    const withRunningTool: ClaudeSocketState = {
      ...initialState,
      status: "running",
      activeTools: [{ type: "tool_use", tool: "Bash", tool_use_id: "t1", id: "m1" }],
      messages: [
        { id: "m1", type: "tool_use", tool: "Bash", tool_use_id: "t1", status: "running" },
      ],
    };
    const result = claudeSocketReducer(withRunningTool, {
      type: "WS_STATUS",
      status: "idle",
    });
    expect(result.status).toBe("idle");
    expect(result.activeTools).toEqual([]);
    expect(result.messages[0].type).toBe("tool_use");
    expect((result.messages[0] as any).status).toBe("done");
  });

  // -------------------------------------------------------------------
  // WS_USER_MESSAGE
  // -------------------------------------------------------------------
  it("WS_USER_MESSAGE는 메시지를 추가한다", () => {
    const result = claudeSocketReducer(initialState, {
      type: "WS_USER_MESSAGE",
      data: { type: "user_message", content: "hello" },
    });
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].type).toBe("user_message");
    expect(result.messages[0].id).toBeTruthy();
  });

  // -------------------------------------------------------------------
  // WS_ASSISTANT_TEXT
  // -------------------------------------------------------------------
  it("WS_ASSISTANT_TEXT는 첫 번째 텍스트를 새 메시지로 추가한다", () => {
    const result = claudeSocketReducer(initialState, {
      type: "WS_ASSISTANT_TEXT",
      data: { id: "", type: "assistant_text", text: "Hello" },
    });
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].type).toBe("assistant_text");
    expect((result.messages[0] as any).text).toBe("Hello");
  });

  it("WS_ASSISTANT_TEXT는 기존 assistant_text를 업데이트한다", () => {
    const withText: ClaudeSocketState = {
      ...initialState,
      messages: [{ id: "existing", type: "assistant_text", text: "Hi" }],
    };
    const result = claudeSocketReducer(withText, {
      type: "WS_ASSISTANT_TEXT",
      data: { id: "", type: "assistant_text", text: "Hi there!" },
    });
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].id).toBe("existing"); // ID 유지
    expect((result.messages[0] as any).text).toBe("Hi there!");
  });

  // -------------------------------------------------------------------
  // WS_TOOL_USE / WS_TOOL_RESULT
  // -------------------------------------------------------------------
  it("WS_TOOL_USE는 메시지와 activeTools에 추가한다", () => {
    const result = claudeSocketReducer(initialState, {
      type: "WS_TOOL_USE",
      data: { id: "", type: "tool_use", tool: "Read", tool_use_id: "tu1" },
    });
    expect(result.messages).toHaveLength(1);
    expect((result.messages[0] as any).status).toBe("running");
    expect(result.activeTools).toHaveLength(1);
  });

  it("WS_TOOL_RESULT는 해당 tool_use를 done으로 전환하고 activeTools에서 제거한다", () => {
    const withTool: ClaudeSocketState = {
      ...initialState,
      messages: [
        { id: "m1", type: "tool_use", tool: "Read", tool_use_id: "tu1", status: "running" },
      ],
      activeTools: [{ id: "m1", type: "tool_use", tool: "Read", tool_use_id: "tu1" }],
    };
    const result = claudeSocketReducer(withTool, {
      type: "WS_TOOL_RESULT",
      toolUseId: "tu1",
      output: "file content",
      isError: false,
      isTruncated: false,
      fullLength: undefined,
      timestamp: "2026-01-01",
    });
    expect((result.messages[0] as any).status).toBe("done");
    expect((result.messages[0] as any).output).toBe("file content");
    expect(result.activeTools).toHaveLength(0);
  });

  // -------------------------------------------------------------------
  // WS_RESULT
  // -------------------------------------------------------------------
  it("WS_RESULT는 assistant_text를 제거하고 result로 대체한다", () => {
    const withAssistant: ClaudeSocketState = {
      ...initialState,
      messages: [
        { id: "user1", type: "user_message", content: "hi" } as any,
        { id: "at1", type: "assistant_text", text: "Hello!" },
      ],
    };
    const result = claudeSocketReducer(withAssistant, {
      type: "WS_RESULT",
      data: { id: "", type: "result", text: "" } as any,
      mode: "normal",
      inputTokens: 100,
      outputTokens: 50,
      cacheCreationTokens: 0,
      cacheReadTokens: 10,
    });
    // assistant_text 제거, result 추가
    expect(result.messages).toHaveLength(2); // user + result
    expect(result.messages[1].type).toBe("result");
    // result 텍스트가 비어있으면 이전 assistant_text 보존
    expect((result.messages[1] as any).text).toBe("Hello!");
    // 토큰 누적
    expect(result.tokenUsage.inputTokens).toBe(100);
    expect(result.tokenUsage.outputTokens).toBe(50);
    expect(result.tokenUsage.cacheReadTokens).toBe(10);
  });

  // -------------------------------------------------------------------
  // WS_STOPPED
  // -------------------------------------------------------------------
  it("WS_STOPPED은 status를 idle로, running tool_use를 done으로 전환한다", () => {
    const running: ClaudeSocketState = {
      ...initialState,
      status: "running",
      activeTools: [{ id: "m1", type: "tool_use", tool: "Bash", tool_use_id: "t1" }],
      messages: [
        { id: "m1", type: "tool_use", tool: "Bash", tool_use_id: "t1", status: "running" },
      ],
    };
    const result = claudeSocketReducer(running, { type: "WS_STOPPED" });
    expect(result.status).toBe("idle");
    expect(result.activeTools).toEqual([]);
    expect((result.messages[0] as any).status).toBe("done");
    expect(result.messages[1].type).toBe("system");
  });

  // -------------------------------------------------------------------
  // WS_SESSION_STATE (히스토리 로드)
  // -------------------------------------------------------------------
  it("WS_SESSION_STATE는 히스토리를 메시지로 변환한다", () => {
    const result = claudeSocketReducer(initialState, {
      type: "WS_SESSION_STATE",
      session: { work_dir: "/test" },
      isRunning: false,
      isReconnect: false,
      history: [
        { role: "user", content: "hi", input_tokens: 10, output_tokens: 0 },
        { role: "assistant", content: "hello", input_tokens: 0, output_tokens: 20, model: "opus" },
      ],
      latestSeq: undefined,
      currentTurnEvents: null,
    });
    expect(result.loading).toBe(false);
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].type).toBe("user_message");
    expect(result.messages[1].type).toBe("result");
    expect(result.tokenUsage.inputTokens).toBe(10);
    expect(result.tokenUsage.outputTokens).toBe(20);
    expect(result.sessionInfo?.work_dir).toBe("/test");
  });

  // -------------------------------------------------------------------
  // User actions
  // -------------------------------------------------------------------
  it("ANSWER_QUESTION은 특정 질문의 답변을 업데이트한다", () => {
    const withQuestion: ClaudeSocketState = {
      ...initialState,
      messages: [
        {
          id: "q1",
          type: "ask_user_question",
          questions: [{ question: "Pick?", options: [{ label: "A" }, { label: "B" }] }],
          tool_use_id: "t1",
          answers: {},
          answered: false,
          sent: false,
          timestamp: "",
        } as any,
      ],
    };
    const result = claudeSocketReducer(withQuestion, {
      type: "ANSWER_QUESTION",
      messageId: "q1",
      questionIndex: 0,
      selectedLabels: ["A"],
    });
    expect((result.messages[0] as any).answers[0]).toEqual(["A"]);
  });

  it("CONFIRM_ANSWERS는 answered=true로 설정한다", () => {
    const withQuestion: ClaudeSocketState = {
      ...initialState,
      messages: [
        {
          id: "q1",
          type: "ask_user_question",
          questions: [],
          tool_use_id: "t1",
          answers: { 0: ["A"] },
          answered: false,
          sent: false,
          timestamp: "",
        } as any,
      ],
    };
    const result = claudeSocketReducer(withQuestion, {
      type: "CONFIRM_ANSWERS",
      messageId: "q1",
    });
    expect((result.messages[0] as any).answered).toBe(true);
  });

  it("MARK_ANSWERS_SENT는 answered=true, sent=false인 항목을 sent=true로 변환한다", () => {
    const state: ClaudeSocketState = {
      ...initialState,
      messages: [
        {
          id: "q1",
          type: "ask_user_question",
          questions: [],
          tool_use_id: "t1",
          answers: { 0: ["A"] },
          answered: true,
          sent: false,
          timestamp: "",
        } as any,
      ],
    };
    const result = claudeSocketReducer(state, { type: "MARK_ANSWERS_SENT" });
    expect((result.messages[0] as any).sent).toBe(true);
  });

  it("CLEAR_MESSAGES는 messages와 fileChanges를 비운다", () => {
    const state: ClaudeSocketState = {
      ...initialState,
      messages: [{ id: "1", type: "system", text: "hi" }],
      fileChanges: [{ tool: "Write", file: "a.ts" }],
    };
    const result = claudeSocketReducer(state, { type: "CLEAR_MESSAGES" });
    expect(result.messages).toEqual([]);
    expect(result.fileChanges).toEqual([]);
  });

  // -------------------------------------------------------------------
  // RECONNECT states
  // -------------------------------------------------------------------
  it("RECONNECT_SCHEDULE은 reconnecting 상태로 전환한다", () => {
    const result = claudeSocketReducer(initialState, {
      type: "RECONNECT_SCHEDULE",
      attempt: 3,
    });
    expect(result.reconnectState.status).toBe("reconnecting");
    expect(result.reconnectState.attempt).toBe(3);
  });

  it("RECONNECT_FAILED은 failed 상태로 전환한다", () => {
    const result = claudeSocketReducer(initialState, {
      type: "RECONNECT_FAILED",
      attempt: 10,
    });
    expect(result.reconnectState.status).toBe("failed");
  });

  // -------------------------------------------------------------------
  // WS_MODE_CHANGE
  // -------------------------------------------------------------------
  it("WS_MODE_CHANGE는 시스템 메시지를 추가하고 sessionInfo를 업데이트한다", () => {
    const withSession: ClaudeSocketState = {
      ...initialState,
      sessionInfo: { mode: "normal" },
    };
    const result = claudeSocketReducer(withSession, {
      type: "WS_MODE_CHANGE",
      fromMode: "normal",
      toMode: "plan",
    });
    expect(result.messages).toHaveLength(1);
    expect((result.messages[0] as any).text).toContain("normal → plan");
    expect(result.sessionInfo?.mode).toBe("plan");
  });

  // -------------------------------------------------------------------
  // WS_PERMISSION_REQUEST / RESPONSE
  // -------------------------------------------------------------------
  it("WS_PERMISSION_REQUEST는 pendingPermission을 설정하고 메시지를 추가한다", () => {
    const result = claudeSocketReducer(initialState, {
      type: "WS_PERMISSION_REQUEST",
      permData: {
        permission_id: "p1",
        tool_name: "Write",
        tool_input: { file: "a.ts" },
        timestamp: "2026-01-01",
      },
    });
    expect(result.pendingPermission?.permission_id).toBe("p1");
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].type).toBe("permission_request");
  });

  it("WS_PERMISSION_RESPONSE는 pendingPermission을 null로 설정한다", () => {
    const withPermission: ClaudeSocketState = {
      ...initialState,
      pendingPermission: { permission_id: "p1", tool_name: "Write", tool_input: {} },
    };
    const result = claudeSocketReducer(withPermission, {
      type: "WS_PERMISSION_RESPONSE",
      reason: "Allowed",
    });
    expect(result.pendingPermission).toBeNull();
    expect(result.messages).toHaveLength(1);
    expect((result.messages[0] as any).text).toContain("Permission: Allowed");
  });

  // -------------------------------------------------------------------
  // TRUNCATE_OLD_MESSAGES
  // -------------------------------------------------------------------
  it("TRUNCATE_OLD_MESSAGES는 cutoff 이전의 긴 메시지를 압축한다", () => {
    const longMessages: any[] = [];
    for (let i = 0; i < 310; i++) {
      longMessages.push({
        id: `m${i}`,
        type: "assistant_text" as const,
        text: "x".repeat(600),
      });
    }
    const state: ClaudeSocketState = {
      ...initialState,
      status: "idle",
      messages: longMessages,
    };
    const result = claudeSocketReducer(state, {
      type: "TRUNCATE_OLD_MESSAGES",
      maxFull: 300,
    });
    // cutoff = 310 - 300 = 10 → 첫 10개 메시지가 압축됨
    expect((result.messages[0] as any).text.length).toBeLessThan(600);
    expect((result.messages[0] as any)._truncated).toBe(true);
    // cutoff 이후 메시지는 그대로
    expect((result.messages[300] as any).text.length).toBe(600);
  });

  it("TRUNCATE_OLD_MESSAGES는 running 상태에서는 아무 작업도 하지 않는다", () => {
    const state: ClaudeSocketState = {
      ...initialState,
      status: "running",
      messages: Array.from({ length: 310 }, (_, i) => ({
        id: `m${i}`,
        type: "system" as const,
        text: "x".repeat(600),
      })),
    };
    const result = claudeSocketReducer(state, {
      type: "TRUNCATE_OLD_MESSAGES",
      maxFull: 300,
    });
    expect(result).toBe(state); // 동일 참조 (변경 없음)
  });
});
