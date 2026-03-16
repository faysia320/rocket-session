import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Message } from "@/types";
import { MessageBubble } from "./MessageBubble";
import { ChatMessageContext } from "./ChatMessageContext";
import type { ChatMessageContextValue } from "./ChatMessageContext";

// Mock heavy dependencies at the top of the file
vi.mock("@/components/ui/MarkdownRenderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown">{content}</div>
  ),
}));

vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children, ...props }: any) => (
    <div data-testid="collapsible" {...props}>
      {children}
    </div>
  ),
  CollapsibleContent: ({ children }: any) => (
    <div data-testid="collapsible-content">{children}</div>
  ),
  CollapsibleTrigger: ({ children }: any) => (
    <div data-testid="collapsible-trigger">{children}</div>
  ),
}));

vi.mock("@/features/workflow/components/WorkflowPhaseCard", () => ({
  WorkflowPhaseCard: (props: any) => (
    <div data-testid="workflow-phase-card" data-message-id={props.message?.id} />
  ),
}));

const noop = () => {};
const defaultCtx: ChatMessageContextValue = {
  isRunning: false,
  searchQuery: undefined,
  onResend: noop,
  onRetryError: noop,
  onApprovePhase: noop,
  onRequestRevision: noop,
  onOpenArtifact: noop,
  isApprovingPhase: false,
  isRequestingRevision: false,
  onAnswerQuestion: noop,
  onConfirmAnswers: noop,
  workflowSteps: undefined,
  onOpenPreview: undefined,
  precedingPlanContents: new Map(),
};

function Wrapper({ children, ctx }: { children: ReactNode; ctx?: Partial<ChatMessageContextValue> }) {
  return (
    <ChatMessageContext.Provider value={{ ...defaultCtx, ...ctx }}>
      {children}
    </ChatMessageContext.Provider>
  );
}

/** Helper: create a Message with sensible defaults */
function makeMsg(overrides: Record<string, unknown> = {}): Message {
  return {
    id: "test-1",
    type: "user_message" as const,
    ...overrides,
  } as Message;
}

// ---------------------------------------------------------------------------
// 1. Type Routing
// ---------------------------------------------------------------------------
describe("Type Routing", () => {
  it("user_message renders prompt text in right-aligned bubble", () => {
    render(<MessageBubble message={makeMsg({ type: "user_message", prompt: "hello" })} />, { wrapper: Wrapper });
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("assistant_text renders MarkdownRenderer with streaming indicator", () => {
    render(
      <Wrapper ctx={{ isRunning: true }}>
        <MessageBubble message={makeMsg({ type: "assistant_text", text: "thinking..." })} />
      </Wrapper>,
    );
    expect(screen.getByTestId("markdown")).toHaveTextContent("thinking...");
    expect(screen.getByText(/streaming/)).toBeInTheDocument();
  });

  it("result renders MarkdownRenderer (no streaming indicator)", () => {
    render(<MessageBubble message={makeMsg({ type: "result", text: "final answer" })} />, { wrapper: Wrapper });
    expect(screen.getByTestId("markdown")).toHaveTextContent("final answer");
    expect(screen.queryByText(/streaming/)).not.toBeInTheDocument();
  });

  it("tool_use renders tool name in Collapsible", () => {
    render(<MessageBubble message={makeMsg({ type: "tool_use", tool: "Task" })} />, { wrapper: Wrapper });
    expect(screen.getByTestId("collapsible")).toBeInTheDocument();
    expect(screen.getByText("Task")).toBeInTheDocument();
  });

  it("file_change renders file change info", () => {
    render(
      <MessageBubble
        message={makeMsg({
          type: "file_change",
          change: { tool: "Write", file: "src/app.ts" },
        })}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
  });

  it("error renders error text with AlertTriangle icon", () => {
    const { container } = render(
      <MessageBubble message={makeMsg({ type: "error", text: "something broke" })} />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText("something broke")).toBeInTheDocument();
    // AlertTriangle renders as SVG, not text character
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("stderr renders stderr text", () => {
    render(<MessageBubble message={makeMsg({ type: "stderr", text: "warn: deprecated" })} />, { wrapper: Wrapper });
    expect(screen.getByText("warn: deprecated")).toBeInTheDocument();
  });

  it("system renders italic text", () => {
    render(<MessageBubble message={makeMsg({ type: "system", text: "session started" })} />, { wrapper: Wrapper });
    const el = screen.getByText("session started");
    expect(el).toBeInTheDocument();
    expect(el.closest(".italic")).toBeTruthy();
  });

  it("event renders event type", () => {
    render(<MessageBubble message={makeMsg({ type: "event", event: { type: "heartbeat" } })} />, { wrapper: Wrapper });
    // EventMessage renders event.type directly (no "Event:" prefix)
    expect(screen.getByText("heartbeat")).toBeInTheDocument();
  });

  it('permission_request renders "Permission Required" text', () => {
    render(<MessageBubble message={makeMsg({ type: "permission_request", tool: "Bash" })} />, { wrapper: Wrapper });
    expect(screen.getByText("Permission Required")).toBeInTheDocument();
    expect(screen.getByText("Bash")).toBeInTheDocument();
  });

  it("unknown/default type renders [type] debug element", () => {
    render(<MessageBubble message={makeMsg({ type: "tool_result" as any })} />, { wrapper: Wrapper });
    expect(screen.getByText("[tool_result]")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. UserMessage
// ---------------------------------------------------------------------------
describe("UserMessage", () => {
  it("extracts text from message.message.content (nested object)", () => {
    const msg = makeMsg({
      type: "user_message",
      message: { content: "nested content", prompt: "ignored" } as any,
    });
    render(<MessageBubble message={msg} />, { wrapper: Wrapper });
    expect(screen.getByText("nested content")).toBeInTheDocument();
  });

  it("falls back to message.prompt", () => {
    const msg = makeMsg({ type: "user_message", prompt: "fallback prompt" });
    render(<MessageBubble message={msg} />, { wrapper: Wrapper });
    expect(screen.getByText("fallback prompt")).toBeInTheDocument();
  });

  it("applies search highlight when searchQuery provided", () => {
    const msg = makeMsg({ type: "user_message", prompt: "hello world" });
    render(
      <Wrapper ctx={{ searchQuery: "world" }}>
        <MessageBubble message={msg} />
      </Wrapper>,
    );
    const mark = screen.getByText("world");
    expect(mark.tagName).toBe("MARK");
  });
});

// ---------------------------------------------------------------------------
// 3. AssistantText
// ---------------------------------------------------------------------------
describe("AssistantText", () => {
  it("passes message.text to MarkdownRenderer", () => {
    render(
      <MessageBubble message={makeMsg({ type: "assistant_text", text: "hello from claude" })} />,
      { wrapper: Wrapper },
    );
    expect(screen.getByTestId("markdown")).toHaveTextContent("hello from claude");
  });

  it('shows "streaming..." indicator when streaming', () => {
    render(
      <Wrapper ctx={{ isRunning: true }}>
        <MessageBubble message={makeMsg({ type: "assistant_text", text: "" })} />
      </Wrapper>,
    );
    expect(screen.getByText(/streaming/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. ResultMessage
// ---------------------------------------------------------------------------
describe("ResultMessage", () => {
  it("shows model name when present", () => {
    render(
      <MessageBubble message={makeMsg({ type: "result", model: "claude-sonnet-4-20250514" })} />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText("Sonnet")).toBeInTheDocument();
  });

  it('shows duration when present (e.g. "1.5s")', () => {
    render(<MessageBubble message={makeMsg({ type: "result", duration_ms: 1500 })} />, { wrapper: Wrapper });
    expect(
      screen.getByText(
        (_content, el) => el?.tagName === "SPAN" && el.textContent?.includes("1.5s") === true,
      ),
    ).toBeInTheDocument();
  });

  it("routes to WorkflowPhaseCard when workflow_phase is set", () => {
    const steps = [
      { name: "research", label: "Research", order_index: 0, review_required: true, icon: "", prompt_template: "", constraints: "", run_validation: false },
    ];
    render(
      <Wrapper ctx={{
        workflowSteps: steps,
        onApprovePhase: vi.fn(),
        onRequestRevision: vi.fn(),
        onOpenArtifact: vi.fn(),
      }}>
        <MessageBubble
          message={makeMsg({ type: "result", workflow_phase: "research", id: "research-1" })}
        />
      </Wrapper>,
    );
    expect(screen.getByTestId("workflow-phase-card")).toBeInTheDocument();
    expect(screen.getByTestId("workflow-phase-card")).toHaveAttribute("data-message-id", "research-1");
  });
});

// ---------------------------------------------------------------------------
// 5. ToolUseMessage
// ---------------------------------------------------------------------------
describe("ToolUseMessage", () => {
  it("shows tool name", () => {
    render(<MessageBubble message={makeMsg({ type: "tool_use", tool: "Write" })} />, { wrapper: Wrapper });
    expect(screen.getByText("Write")).toBeInTheDocument();
  });

  it("running status applies border-l-info", () => {
    const { container } = render(
      <MessageBubble message={makeMsg({ type: "tool_use", tool: "Bash", status: "running" })} />,
      { wrapper: Wrapper },
    );
    const bordered = container.querySelector(".border-l-info");
    expect(bordered).toBeInTheDocument();
  });

  it("done status applies border-l-success", () => {
    const { container } = render(
      <MessageBubble message={makeMsg({ type: "tool_use", tool: "Bash", status: "done" })} />,
      { wrapper: Wrapper },
    );
    const bordered = container.querySelector(".border-l-success");
    expect(bordered).toBeInTheDocument();
  });

  it("error status applies border-l-destructive", () => {
    const { container } = render(
      <MessageBubble message={makeMsg({ type: "tool_use", tool: "Bash", status: "error" })} />,
      { wrapper: Wrapper },
    );
    const bordered = container.querySelector(".border-l-destructive");
    expect(bordered).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 6. ToolStatusIcon (via ToolUseMessage)
// ---------------------------------------------------------------------------
describe("ToolStatusIcon via ToolUseMessage", () => {
  it("done status renders checkmark character (\u2713)", () => {
    render(<MessageBubble message={makeMsg({ type: "tool_use", tool: "T", status: "done" })} />, { wrapper: Wrapper });
    expect(screen.getByText("\u2713")).toBeInTheDocument();
  });

  it("error status renders X character (\u2715)", () => {
    render(<MessageBubble message={makeMsg({ type: "tool_use", tool: "T", status: "error" })} />, { wrapper: Wrapper });
    expect(screen.getByText("\u2715")).toBeInTheDocument();
  });

  it("running status renders spinner (animated element)", () => {
    const { container } = render(
      <MessageBubble message={makeMsg({ type: "tool_use", tool: "T", status: "running" })} />,
      { wrapper: Wrapper },
    );
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 7. ErrorMessage
// ---------------------------------------------------------------------------
describe("ErrorMessage", () => {
  it("shows error text from message.message or message.text", () => {
    render(<MessageBubble message={makeMsg({ type: "error", message: "msg error" as any })} />, { wrapper: Wrapper });
    expect(screen.getByText("msg error")).toBeInTheDocument();
  });

  it("applies search highlight", () => {
    render(
      <Wrapper ctx={{ searchQuery: "fatal" }}>
        <MessageBubble message={makeMsg({ type: "error", text: "fatal crash" })} />
      </Wrapper>,
    );
    const mark = screen.getByText("fatal");
    expect(mark.tagName).toBe("MARK");
  });
});

// ---------------------------------------------------------------------------
// 8. SystemMessage
// ---------------------------------------------------------------------------
describe("SystemMessage", () => {
  it("shows italic text", () => {
    render(<MessageBubble message={makeMsg({ type: "system", text: "system notice" })} />, { wrapper: Wrapper });
    const el = screen.getByText("system notice");
    expect(el).toBeInTheDocument();
    // The span has class "italic"
    expect(el.className).toContain("italic");
  });
});

// ---------------------------------------------------------------------------
// 9. Memo behavior
// ---------------------------------------------------------------------------
describe("Memo behavior", () => {
  it("MessageBubble is wrapped with React.memo", () => {
    // React.memo wraps the component; the $$typeof for memo is Symbol.for('react.memo')
    // We can check the component's type displayName or the memo wrapper
    expect(MessageBubble).toHaveProperty("$$typeof", Symbol.for("react.memo"));
  });
});
