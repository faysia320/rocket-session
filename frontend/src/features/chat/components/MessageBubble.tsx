import { useState, memo, useMemo } from "react";
import {
  Brain,
  AlertTriangle,
  ShieldAlert,
  ChevronRight,
  ChevronDown,
  Zap,
  FileEdit,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { CodeBlock } from "@/components/ui/CodeBlock";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn, highlightText, formatTokens } from "@/lib/utils";
import type {
  Message,
  UserMsg,
  AssistantTextMsg,
  ResultMsg,
  ToolUseMsg,
  ThinkingMsg,
  FileChangeMsg,
  ErrorMsg,
  StderrMsg,
  SystemMsg,
  EventMsg,
  AskUserQuestionMsg,
} from "@/types";
import { PlanResultCard } from "./PlanResultCard";
import { AskUserQuestionCard } from "./AskUserQuestionCard";
import { TodoWriteMessage } from "./TodoWriteMessage";
import { EditToolMessage } from "./EditToolMessage";
import { BashToolMessage } from "./BashToolMessage";
import { ToolStatusIcon } from "./ToolStatusIcon";
import { getToolIcon, getToolColor, useElapsed, getLanguageFromPath } from "./toolMessageUtils";

interface MessageBubbleProps {
  message: Message;
  isRunning?: boolean;
  searchQuery?: string;
  onResend?: (content: string) => void;
  onRetryError?: (messageId: string) => void;
  onExecutePlan?: (messageId: string) => void;
  onContinuePlan?: (messageId: string) => void;
  onDismissPlan?: (messageId: string) => void;
  onRevisePlan?: (messageId: string, feedback: string) => void;
  onAnswerQuestion?: (
    messageId: string,
    questionIndex: number,
    labels: string[],
  ) => void;
  onConfirmAnswers?: (messageId: string) => void;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isRunning = false,
  searchQuery,
  onResend,
  onRetryError,
  onExecutePlan,
  onContinuePlan,
  onDismissPlan,
  onRevisePlan,
  onAnswerQuestion,
  onConfirmAnswers,
}: MessageBubbleProps) {
  const { type } = message;

  switch (type) {
    case "user_message":
      return (
        <UserMessage
          message={message}
          searchQuery={searchQuery}
          onResend={onResend}
          isRunning={isRunning}
        />
      );
    case "assistant_text":
      return <AssistantText message={message} isStreaming={isRunning} />;
    case "result":
      if (message.mode === "plan") {
        return (
          <PlanResultCard
            message={message}
            isRunning={isRunning}
            onExecute={onExecutePlan!}
            onContinue={onContinuePlan!}
            onDismiss={onDismissPlan!}
            onRevise={onRevisePlan!}
          />
        );
      }
      return <ResultMessage message={message} />;
    case "tool_use":
      if (message.tool === "TodoWrite")
        return <TodoWriteMessage message={message} />;
      if (["Edit", "MultiEdit", "Write"].includes(message.tool))
        return <EditToolMessage message={message} />;
      if (message.tool === "Bash")
        return <BashToolMessage message={message} />;
      return <ToolUseMessage message={message} />;
    case "thinking":
      return <ThinkingMessage message={message} />;
    case "file_change":
      return <FileChangeMessage message={message} />;
    case "error":
      return (
        <ErrorMessage
          message={message}
          searchQuery={searchQuery}
          onRetry={onRetryError ? () => onRetryError(message.id) : undefined}
        />
      );
    case "stderr":
      return <StderrMessage message={message} />;
    case "system":
      return <SystemMessage message={message} searchQuery={searchQuery} />;
    case "event":
      return <EventMessage message={message} />;
    case "permission_request":
      return <PermissionRequestMessage message={message} />;
    case "ask_user_question":
      return onAnswerQuestion && onConfirmAnswers ? (
        <AskUserQuestionCard
          message={message as AskUserQuestionMsg}
          onAnswer={onAnswerQuestion}
          onConfirm={onConfirmAnswers}
        />
      ) : null;
    default:
      return (
        <div className="px-2 py-0.5">
          <span className="font-mono text-2xs text-muted-foreground/50">
            [{type}]
          </span>
        </div>
      );
  }
});

// ─── Phase 1: Primary Messages ────────────────────────────────────────────────

function UserMessage({
  message,
  searchQuery,
  onResend,
  isRunning,
}: {
  message: UserMsg;
  searchQuery?: string;
  onResend?: (content: string) => void;
  isRunning?: boolean;
}) {
  const msg = message.message as Record<string, string> | undefined;
  const text =
    msg?.content || msg?.prompt || message.content || message.prompt || "";
  return (
    <div className="flex justify-end animate-[fadeIn_0.2s_ease]">
      <div className="max-w-[80%] px-3.5 py-2.5 bg-primary text-primary-foreground rounded-lg rounded-br-sm shadow-sm">
        <div className="font-sans text-sm leading-relaxed whitespace-pre-wrap select-text">
          {searchQuery ? highlightText(text, searchQuery) : text}
        </div>
        {onResend ? (
          <div className="flex justify-end mt-1.5">
            <button
              type="button"
              className="font-mono text-2xs text-primary-foreground/60 hover:text-primary-foreground hover:underline transition-colors disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                onResend(text);
              }}
              disabled={isRunning}
              aria-label="메시지 재전송"
            >
              Re-send
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** 모델명을 짧은 표시명으로 변환 */
function formatModelName(model: string): string {
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model.split("-").slice(0, 2).join(" ");
}

function ResultMessage({ message }: { message: ResultMsg }) {
  const hasMetadata =
    message.duration_ms ||
    message.model ||
    message.input_tokens;

  return (
    <div className="animate-[fadeIn_0.2s_ease]">
      <div
        className={cn(
          "px-3.5 py-3 bg-card/50 rounded-md border-l-[3px] border-l-info/60",
          message.is_error && "border-l-destructive bg-destructive/5",
        )}
      >
        <div className="flex items-center gap-1.5 font-mono text-2xs font-semibold text-muted-foreground mb-2">
          <span className="text-info text-xs">{"◆"}</span> Claude
          {message.is_error ? (
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-destructive/15 text-destructive border border-destructive/30">
              Error
            </span>
          ) : null}
        </div>
        <div className="text-foreground select-text">
          <MarkdownRenderer content={message.text || ""} />
        </div>
        {hasMetadata ? (
          <div className="flex flex-wrap gap-2 mt-2.5 pt-2 border-t border-border/30">
            {message.model ? (
              <span className="font-mono text-2xs px-2 py-0.5 rounded-md bg-info/10 text-info border border-info/20">
                {formatModelName(message.model)}
              </span>
            ) : null}
            {message.duration_ms ? (
              <span className="font-mono text-2xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                {(message.duration_ms / 1000).toFixed(1)}s
              </span>
            ) : null}
            {message.input_tokens ? (
              <span className="font-mono text-2xs px-2 py-0.5 rounded-md bg-success/10 text-success border border-success/20">
                in:{formatTokens(message.input_tokens)}
                {message.cache_read_tokens
                  ? ` (cache:${formatTokens(message.cache_read_tokens)})`
                  : ""}
              </span>
            ) : null}
            {message.output_tokens ? (
              <span className="font-mono text-2xs px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                out:{formatTokens(message.output_tokens)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Phase 2: Secondary Messages ──────────────────────────────────────────────

/** 도구 헤더 요약 텍스트 생성 (Read/Grep/Glob 등) */
function getToolSummary(toolName: string, input: Record<string, unknown>): string | null {
  if (toolName === "Grep") {
    const pattern = input.pattern ? `"${String(input.pattern)}"` : null;
    const glob = input.glob ? String(input.glob) : null;
    const path = input.path ? String(input.path) : null;
    const parts = [pattern, glob ? `in ${glob}` : null, !glob && path ? `in ${path}` : null].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : null;
  }
  if (toolName === "Glob") {
    return input.pattern ? String(input.pattern) : null;
  }
  // Read 및 기타: file_path 또는 path
  return String(input.file_path ?? input.path ?? "") || null;
}

function ToolUseMessage({ message }: { message: ToolUseMsg }) {
  const [expanded, setExpanded] = useState(false);
  const toolName = message.tool || "Tool";
  const input = (message.input || {}) as Record<string, unknown>;
  const toolStatus: "running" | "done" | "error" = message.status || "running";
  const isRead = toolName === "Read";
  const filePath = String(input.file_path ?? input.path ?? "");

  const borderColor =
    toolStatus === "error"
      ? "border-l-destructive"
      : toolStatus === "done"
        ? "border-l-success"
        : "border-l-info";

  const ToolIcon = getToolIcon(toolName);
  const toolColor = getToolColor(toolName);
  const elapsed = useElapsed(toolStatus, message.timestamp, message.completed_at);
  const summary = useMemo(() => getToolSummary(toolName, input), [toolName, input]);
  const readLanguage = useMemo(
    () => (isRead && filePath ? getLanguageFromPath(filePath) : null),
    [isRead, filePath],
  );

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="animate-[slideInLeft_0.2s_ease] cursor-pointer"
    >
      <div
        className={cn(
          "px-3 py-2 bg-card border border-border rounded-md border-l-[3px]",
          borderColor,
        )}
      >
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-2">
            <ToolStatusIcon status={toolStatus} />
            {ToolIcon ? (
              <ToolIcon className={cn("h-3.5 w-3.5 shrink-0", toolColor)} />
            ) : null}
            <span className="font-mono text-xs font-semibold text-foreground">
              {toolName}
            </span>
            {summary ? (
              <span className="font-mono text-xs text-muted-foreground flex-1 truncate">
                {summary}
              </span>
            ) : null}
            {elapsed ? (
              <span className="font-mono text-2xs text-muted-foreground/70 shrink-0">
                {elapsed}
              </span>
            ) : null}
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-1.5 space-y-1.5 min-w-0 overflow-hidden">
            {/* Read: CodeBlock으로 output 렌더링 */}
            {isRead && message.output ? (
              <CodeBlock
                language={readLanguage || "text"}
                raw={message.output}
                className="my-0"
              >
                {message.output}
              </CodeBlock>
            ) : (
              <>
                {/* 기타 도구: Input JSON */}
                <div>
                  <div className="font-mono text-2xs text-muted-foreground/70 mb-0.5">
                    Input
                  </div>
                  <pre className="font-mono text-xs text-muted-foreground bg-input/80 p-2.5 rounded-md overflow-auto max-h-[200px] whitespace-pre-wrap select-text">
                    {JSON.stringify(input, null, 2)}
                  </pre>
                </div>
                {message.output ? (
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-2xs text-muted-foreground/70">
                        Output
                      </span>
                      {message.is_truncated && message.full_length ? (
                        <span className="font-mono text-2xs text-warning">
                          ({message.output.length.toLocaleString()}/
                          {message.full_length.toLocaleString()}자 표시)
                        </span>
                      ) : null}
                    </div>
                    <pre
                      className={cn(
                        "font-mono text-xs bg-input/80 p-2.5 rounded-md overflow-auto max-h-[300px] whitespace-pre-wrap select-text",
                        message.is_error
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {message.output}
                    </pre>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function ThinkingMessage({ message }: { message: ThinkingMsg }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="animate-[fadeIn_0.2s_ease] cursor-pointer"
    >
      <div className="pl-3 border-l-2 border-muted-foreground/40">
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-1.5 font-mono text-2xs font-semibold text-muted-foreground/60">
            <Brain className="h-3.5 w-3.5" />
            <span>Thinking{"\u2026"}</span>
            {expanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-1.5 text-muted-foreground/70 italic select-text">
            <MarkdownRenderer content={message.text || ""} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── Phase 3: Alert Messages ──────────────────────────────────────────────────

function AssistantText({ message, isStreaming }: { message: AssistantTextMsg; isStreaming?: boolean }) {
  return (
    <div className="animate-[fadeIn_0.2s_ease]">
      <div
        className={cn(
          "px-3.5 py-3 bg-card/50 rounded-md border-l-[3px]",
          isStreaming ? "border-l-info/40" : "border-l-info/60",
        )}
      >
        <div className="flex items-center gap-1.5 font-mono text-2xs font-semibold text-muted-foreground mb-2">
          {isStreaming ? (
            <span className="inline-block w-2 h-2 rounded-full bg-info animate-pulse" />
          ) : (
            <span className="text-info text-xs">{"◆"}</span>
          )}
          <span>Claude</span>
          {isStreaming ? (
            <span className="text-info/80 animate-[pulse_1.5s_ease-in-out_infinite] ml-1">
              streaming{"…"}
            </span>
          ) : null}
        </div>
        <div className="text-foreground select-text">
          <div className="font-sans text-sm whitespace-pre-wrap break-words leading-relaxed">
            {message.text || ""}
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorMessage({
  message,
  searchQuery,
  onRetry,
}: {
  message: ErrorMsg;
  searchQuery?: string;
  onRetry?: () => void;
}) {
  const errorText = message.message || message.text || "Unknown error";
  return (
    <div className="animate-[fadeIn_0.2s_ease]">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-destructive/10 border border-destructive/30 rounded-md border-l-[3px] border-l-destructive">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <span className="font-mono text-xs text-destructive flex-1">
          {searchQuery
            ? highlightText(String(errorText), searchQuery)
            : errorText}
        </span>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="font-mono text-2xs font-semibold text-destructive-foreground bg-destructive/80 hover:bg-destructive px-2.5 py-1 rounded-md transition-colors shrink-0"
            aria-label="재시도"
          >
            재시도
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PermissionRequestMessage({
  message,
}: {
  message: Extract<Message, { type: "permission_request" }>;
}) {
  return (
    <div className="animate-[fadeIn_0.2s_ease]">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-warning/10 border border-warning/25 rounded-md border-l-[3px] border-l-warning">
        <ShieldAlert className="h-4 w-4 text-warning shrink-0" />
        <span className="font-mono text-2xs font-semibold text-warning uppercase tracking-wider">
          Permission Required
        </span>
        <span className="font-mono text-xs text-foreground font-semibold bg-warning/10 px-1.5 py-0.5 rounded">
          {message.tool}
        </span>
      </div>
    </div>
  );
}

// ─── Phase 4: Tertiary Messages ───────────────────────────────────────────────

// FileChangeMessage: 현재 tool_use + file_change 이벤트에서 tool_use 경로로 표시되므로
// 이 컴포넌트가 직접 사용되는 경우는 드물지만, 향후 활용을 위해 유지
function FileChangeMessage({ message }: { message: FileChangeMsg }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 animate-[fadeIn_0.2s_ease]">
      <FileEdit className="h-3 w-3 text-primary/60 shrink-0" />
      <span className="font-mono text-xs text-muted-foreground">
        {message.change?.tool}:{" "}
        <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded-sm border border-primary/20">
          {message.change?.file}
        </code>
      </span>
    </div>
  );
}

function StderrMessage({ message }: { message: StderrMsg }) {
  return (
    <div className="px-3 py-1 animate-[fadeIn_0.2s_ease]">
      <div className="pl-2 border-l border-warning/20">
        <pre className="font-mono text-2xs text-warning/60 whitespace-pre-wrap leading-relaxed">
          {message.text}
        </pre>
      </div>
    </div>
  );
}

function SystemMessage({
  message,
  searchQuery,
}: {
  message: SystemMsg;
  searchQuery?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 animate-[fadeIn_0.2s_ease]">
      <div className="flex-1 h-px bg-border/50" />
      <span className="font-mono text-2xs text-muted-foreground/50 italic shrink-0">
        {searchQuery
          ? highlightText(message.text || "", searchQuery)
          : message.text}
      </span>
      <div className="flex-1 h-px bg-border/50" />
    </div>
  );
}

function EventMessage({ message }: { message: EventMsg }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="px-3 py-1 cursor-pointer animate-[fadeIn_0.2s_ease]"
    >
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-1.5">
          <Zap className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
          <span className="font-mono text-2xs text-muted-foreground/50">
            {String(message.event?.type || "unknown")}
          </span>
          {expanded ? (
            <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/40" />
          ) : (
            <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/40" />
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="font-mono text-2xs text-muted-foreground bg-input/50 p-1.5 rounded-md mt-1 max-h-[120px] overflow-auto whitespace-pre-wrap">
          {JSON.stringify(message.event, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
