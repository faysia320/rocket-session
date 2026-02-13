import { useState, memo } from 'react';
import { Maximize2 } from 'lucide-react';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn, highlightText } from '@/lib/utils';
import type { Message } from '@/types';
import { PlanApprovalButton } from './PlanApprovalButton';

interface MessageBubbleProps {
  message: Message;
  isRunning?: boolean;
  searchQuery?: string;
  onExecutePlan?: (messageId: string) => void;
  onDismissPlan?: (messageId: string) => void;
  onOpenReview?: (messageId: string) => void;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isRunning = false,
  searchQuery,
  onExecutePlan,
  onDismissPlan,
  onOpenReview,
}: MessageBubbleProps) {
  const { type } = message;

  switch (type) {
    case 'user_message':
      return <UserMessage message={message} searchQuery={searchQuery} />;
    case 'assistant_text':
      return <AssistantText message={message} />;
    case 'result':
      return (
        <ResultMessage
          message={message}
          isRunning={isRunning}
          onExecutePlan={onExecutePlan}
          onDismissPlan={onDismissPlan}
          onOpenReview={onOpenReview}
        />
      );
    case 'tool_use':
      return <ToolUseMessage message={message} />;
    case 'file_change':
      return <FileChangeMessage message={message} />;
    case 'error':
      return <ErrorMessage message={message} searchQuery={searchQuery} />;
    case 'stderr':
      return <StderrMessage message={message} />;
    case 'system':
      return <SystemMessage message={message} searchQuery={searchQuery} />;
    case 'event':
      return <EventMessage message={message} />;
    case 'permission_request':
      return <PermissionRequestMessage message={message} />;
    default:
      return (
        <div className="px-2 py-0.5">
          <span className="font-mono text-[10px] text-muted-foreground/50">
            [{type}]
          </span>
        </div>
      );
  }
});

function UserMessage({ message, searchQuery }: { message: Message; searchQuery?: string }) {
  // user_message의 실제 텍스트: message.message 객체의 content 또는 prompt
  const msg = message.message as unknown as Record<string, string> | undefined;
  const text = msg?.content || msg?.prompt || message.content || message.prompt || '';
  return (
    <div className="flex justify-end animate-[fadeIn_0.2s_ease]">
      <div className="max-w-[80%] px-3.5 py-2.5 bg-primary text-primary-foreground rounded-xl rounded-br-sm">
        <div className="font-mono text-[10px] font-semibold opacity-70 mb-1">You</div>
        <div className="font-mono text-[13px] leading-normal whitespace-pre-wrap select-text">
          {searchQuery ? highlightText(text, searchQuery) : text}
        </div>
      </div>
    </div>
  );
}

function AssistantText({ message }: { message: Message }) {
  return (
    <div className="animate-[fadeIn_0.2s_ease]">
      <div className="pl-3 border-l-2 border-primary/40">
        <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold text-muted-foreground mb-1.5">
          <span className="text-primary text-xs">{'◆'}</span> Claude
          <span className="text-primary animate-[pulse_1.5s_ease-in-out_infinite] ml-1">
            streaming{'…'}
          </span>
        </div>
        <div className="text-foreground select-text">
          <MarkdownRenderer content={message.text || ''} />
        </div>
      </div>
    </div>
  );
}

function ResultMessage({
  message,
  isRunning = false,
  onExecutePlan,
  onDismissPlan,
  onOpenReview,
}: {
  message: Message;
  isRunning?: boolean;
  onExecutePlan?: (messageId: string) => void;
  onDismissPlan?: (messageId: string) => void;
  onOpenReview?: (messageId: string) => void;
}) {
  const showPlanApproval = message.mode === 'plan' && onExecutePlan;

  return (
    <div className="animate-[fadeIn_0.2s_ease]">
      <div className={cn(
        "pl-3 border-l-2 border-primary/40",
        showPlanApproval && !message.planExecuted && "border-l-primary"
      )}>
        <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold text-muted-foreground mb-1.5">
          <span className="text-primary text-xs">{'◆'}</span> Claude
          {message.mode === 'plan' ? (
            <>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/15 text-primary border border-primary/30">
                Plan
              </span>
              <button
                type="button"
                onClick={() => onOpenReview?.(message.id)}
                className="ml-1 p-0.5 rounded hover:bg-primary/15 text-muted-foreground hover:text-primary transition-colors"
                aria-label="Plan review dialog"
                title="Plan review dialog"
              >
                <Maximize2 className="h-3 w-3" />
              </button>
            </>
          ) : null}
        </div>
        <div className="text-foreground select-text">
          <MarkdownRenderer content={message.text || ''} />
        </div>
        {(message.cost || message.duration_ms) ? (
          <div className="flex gap-2 mt-2.5 pt-2 border-t border-border/30">
            {message.cost ? (
              <span className="font-mono text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-lg">
                {'\u{1F4B0}'} ${Number(message.cost).toFixed(4)}
              </span>
            ) : null}
            {message.duration_ms ? (
              <span className="font-mono text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-lg">
                {'⏱'} {(message.duration_ms / 1000).toFixed(1)}s
              </span>
            ) : null}
          </div>
        ) : null}
        {showPlanApproval ? (
          <PlanApprovalButton
            planExecuted={message.planExecuted}
            isRunning={isRunning}
            onExecute={() => onExecutePlan(message.id)}
            onDismiss={() => onDismissPlan?.(message.id)}
          />
        ) : null}
      </div>
    </div>
  );
}

function ToolStatusIcon({ status }: { status?: 'running' | 'done' | 'error' }) {
  if (status === 'done') {
    return <span className="text-success text-xs font-bold shrink-0">{'\u2713'}</span>;
  }
  if (status === 'error') {
    return <span className="text-destructive text-xs font-bold shrink-0">{'\u2715'}</span>;
  }
  return (
    <span className="inline-block w-3 h-3 border-[1.5px] border-info/40 border-t-info rounded-full animate-spin shrink-0" />
  );
}

function ToolUseMessage({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(false);
  const toolName = message.tool || 'Tool';
  const input = (message.input || {}) as Record<string, string>;
  const toolStatus: 'running' | 'done' | 'error' = message.status || 'running';

  const borderColor = toolStatus === 'error'
    ? 'border-l-destructive'
    : toolStatus === 'done'
      ? 'border-l-success'
      : 'border-l-info';

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="animate-[slideInLeft_0.2s_ease] cursor-pointer"
    >
      <div className={cn('px-3 py-2 bg-secondary border border-border rounded-sm border-l-[3px]', borderColor)}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-2">
            <ToolStatusIcon status={toolStatus} />
            <span className="font-mono text-xs font-semibold text-foreground">
              {toolName}
            </span>
            {input.file_path || input.path || input.command ? (
              <span className="font-mono text-[11px] text-muted-foreground flex-1 truncate">
                {input.file_path ||
                  input.path ||
                  (input.command?.slice(0, 60) +
                    (input.command?.length > 60 ? '\u2026' : ''))}
              </span>
            ) : null}
            <span className="font-mono text-[10px] text-muted-foreground/70">
              {expanded ? '\u25BE' : '\u25B8'}
            </span>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-1.5 space-y-1.5">
            <div>
              <div className="font-mono text-[10px] text-muted-foreground/70 mb-0.5">Input</div>
              <pre className="font-mono text-[11px] text-muted-foreground bg-input p-2 rounded-sm overflow-auto max-h-[200px] whitespace-pre-wrap select-text">
                {JSON.stringify(input, null, 2)}
              </pre>
            </div>
            {message.output ? (
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-[10px] text-muted-foreground/70">Output</span>
                  {message.is_truncated && message.full_length ? (
                    <span className="font-mono text-[10px] text-warning">
                      ({message.output.length.toLocaleString()}/{message.full_length.toLocaleString()}자 표시)
                    </span>
                  ) : null}
                </div>
                <pre className={cn(
                  'font-mono text-[11px] bg-input p-2 rounded-sm overflow-auto max-h-[300px] whitespace-pre-wrap select-text',
                  message.is_error ? 'text-destructive' : 'text-muted-foreground'
                )}>
                  {message.output}
                </pre>
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function FileChangeMessage({ message }: { message: Message }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 animate-[fadeIn_0.2s_ease]">
      <span className="text-xs">{'\u{1F4DD}'}</span>
      <span className="font-mono text-[11px] text-muted-foreground">
        {message.change?.tool}:{' '}
        <code className="text-primary bg-primary/15 px-1 py-px rounded-[3px]">
          {message.change?.file}
        </code>
      </span>
    </div>
  );
}

function ErrorMessage({ message, searchQuery }: { message: Message; searchQuery?: string }) {
  const errorText = message.message || message.text || 'Unknown error';
  return (
    <div className="animate-[fadeIn_0.2s_ease]">
      <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-sm">
        <span className="text-sm">{'⚠'}</span>
        <span className="font-mono text-xs text-destructive">
          {searchQuery ? highlightText(String(errorText), searchQuery) : errorText}
        </span>
      </div>
    </div>
  );
}

function StderrMessage({ message }: { message: Message }) {
  return (
    <div className="px-2 py-1 animate-[fadeIn_0.2s_ease]">
      <pre className="font-mono text-[11px] text-warning whitespace-pre-wrap opacity-70">
        {message.text}
      </pre>
    </div>
  );
}

function SystemMessage({ message, searchQuery }: { message: Message; searchQuery?: string }) {
  return (
    <div className="text-center p-1 animate-[fadeIn_0.2s_ease]">
      <span className="font-mono text-[11px] text-muted-foreground/70 italic">
        {searchQuery ? highlightText(message.text || '', searchQuery) : message.text}
      </span>
    </div>
  );
}

function EventMessage({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="px-2 py-1 cursor-pointer animate-[fadeIn_0.2s_ease]"
    >
      <CollapsibleTrigger asChild>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          Event: {String(message.event?.type || 'unknown')}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="font-mono text-[10px] text-muted-foreground bg-input p-1.5 rounded mt-1 max-h-[120px] overflow-auto whitespace-pre-wrap">
          {JSON.stringify(message.event, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

function PermissionRequestMessage({ message }: { message: Message }) {
  return (
    <div className="animate-[fadeIn_0.2s_ease]">
      <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border border-warning/20 rounded-sm border-l-[3px] border-l-warning">
        <span className="font-mono text-[10px] font-semibold text-warning uppercase tracking-wider">
          Permission Required
        </span>
        <span className="font-mono text-xs text-foreground font-semibold">
          {message.tool}
        </span>
      </div>
    </div>
  );
}
