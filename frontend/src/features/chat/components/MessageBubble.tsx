import { useState } from 'react';
import { FormattedText } from '@/components/ui/FormattedText';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { Message } from '@/types';

export function MessageBubble({ message }: { message: Message }) {
  const { type } = message;

  switch (type) {
    case 'user_message':
      return <UserMessage message={message.message || message} />;
    case 'assistant_text':
      return <AssistantText message={message} />;
    case 'result':
      return <ResultMessage message={message} />;
    case 'tool_use':
      return <ToolUseMessage message={message} />;
    case 'file_change':
      return <FileChangeMessage message={message} />;
    case 'error':
      return <ErrorMessage message={message} />;
    case 'stderr':
      return <StderrMessage message={message} />;
    case 'system':
      return <SystemMessage message={message} />;
    case 'event':
      return <EventMessage message={message} />;
    default:
      return null;
  }
}

function UserMessage({ message }: { message: any }) {
  return (
    <div className="flex justify-end animate-[fadeIn_0.2s_ease]">
      <div className="max-w-[80%] px-3.5 py-2.5 bg-primary text-primary-foreground rounded-xl rounded-br-sm">
        <div className="font-mono text-[10px] font-semibold opacity-70 mb-1">You</div>
        <div className="font-mono text-[13px] leading-normal whitespace-pre-wrap">
          {message.content || message.prompt}
        </div>
      </div>
    </div>
  );
}

function AssistantText({ message }: { message: any }) {
  return (
    <div className="flex animate-[fadeIn_0.2s_ease]">
      <div className="max-w-[85%] px-3.5 py-3 bg-muted border border-border rounded-xl rounded-bl-sm">
        <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold text-muted-foreground mb-1.5">
          <span className="text-primary text-xs">{'\u25C6'}</span> Claude
          <span className="text-primary animate-[pulse_1.5s_ease-in-out_infinite] ml-1">
            streaming{'\u2026'}
          </span>
        </div>
        <div className="font-mono text-[13px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
          <FormattedText text={message.text} />
        </div>
      </div>
    </div>
  );
}

function ResultMessage({ message }: { message: any }) {
  return (
    <div className="flex animate-[fadeIn_0.2s_ease]">
      <div className={cn(
        "max-w-[85%] px-3.5 py-3 bg-muted rounded-xl rounded-bl-sm",
        "border border-[hsl(var(--border-bright))]"
      )}>
        <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold text-muted-foreground mb-1.5">
          <span className="text-primary text-xs">{'\u25C6'}</span> Claude
        </div>
        <div className="font-mono text-[13px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
          <FormattedText text={message.text} />
        </div>
        {(message.cost || message.duration_ms) ? (
          <div className="flex gap-2 mt-2.5 pt-2 border-t border-border">
            {message.cost ? (
              <span className="font-mono text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-lg">
                {'\u{1F4B0}'} ${Number(message.cost).toFixed(4)}
              </span>
            ) : null}
            {message.duration_ms ? (
              <span className="font-mono text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-lg">
                {'\u23F1'} {(message.duration_ms / 1000).toFixed(1)}s
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ToolUseMessage({ message }: { message: any }) {
  const [expanded, setExpanded] = useState(false);
  const toolName = message.tool || 'Tool';
  const input = message.input || {};

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="animate-[slideInLeft_0.2s_ease] cursor-pointer"
    >
      <div className="px-3 py-2 bg-secondary border border-border rounded-sm border-l-[3px] border-l-info">
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: getToolColor(toolName) }}
            />
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
          <pre className="font-mono text-[11px] text-muted-foreground bg-input p-2 rounded-sm mt-1.5 overflow-auto max-h-[200px] whitespace-pre-wrap">
            {JSON.stringify(input, null, 2)}
          </pre>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function FileChangeMessage({ message }: { message: any }) {
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

function ErrorMessage({ message }: { message: any }) {
  return (
    <div className="animate-[fadeIn_0.2s_ease]">
      <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-sm">
        <span className="text-sm">{'\u26A0'}</span>
        <span className="font-mono text-xs text-destructive">
          {message.message || message.text}
        </span>
      </div>
    </div>
  );
}

function StderrMessage({ message }: { message: any }) {
  return (
    <div className="px-2 py-1 animate-[fadeIn_0.2s_ease]">
      <pre className="font-mono text-[11px] text-warning whitespace-pre-wrap opacity-70">
        {message.text}
      </pre>
    </div>
  );
}

function SystemMessage({ message }: { message: any }) {
  return (
    <div className="text-center p-1 animate-[fadeIn_0.2s_ease]">
      <span className="font-mono text-[11px] text-muted-foreground/70 italic">
        {message.text}
      </span>
    </div>
  );
}

function EventMessage({ message }: { message: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="px-2 py-1 cursor-pointer animate-[fadeIn_0.2s_ease]"
    >
      <CollapsibleTrigger asChild>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          Event: {message.event?.type || 'unknown'}
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

function getToolColor(name: string): string {
  const colors: Record<string, string> = {
    Write: '#22c55e',
    Edit: '#3b82f6',
    MultiEdit: '#3b82f6',
    Read: '#8b5cf6',
    Bash: '#f59e0b',
    Grep: '#ec4899',
    Glob: '#06b6d4',
    TodoWrite: '#14b8a6',
  };
  return colors[name] || '#94a3b8';
}
