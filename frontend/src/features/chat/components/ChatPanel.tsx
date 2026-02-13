import { useState, useRef, useEffect } from 'react';
import { FolderOpen, Send, Square } from 'lucide-react';
import { useClaudeSocket } from '../hooks/useClaudeSocket';
import { MessageBubble } from './MessageBubble';
import { SessionSettings } from '@/features/session/components/SessionSettings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { FileChange } from '@/types';

interface ChatPanelProps {
  sessionId: string;
  onToggleFiles: () => void;
  showFiles: boolean;
  onFileChanges: (changes: FileChange[]) => void;
}

/**
 * 메인 채팅 인터페이스.
 * onFileChanges 콜백을 통해 파일 변경 사항을 상위로 전달합니다.
 */
export function ChatPanel({ sessionId, onToggleFiles, showFiles, onFileChanges }: ChatPanelProps) {
  const { connected, messages, status, sessionInfo, fileChanges, sendPrompt, stopExecution } =
    useClaudeSocket(sessionId);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 파일 변경 사항을 상위 컴포넌트로 전달
  useEffect(() => {
    if (onFileChanges) {
      onFileChanges(fileChanges);
    }
  }, [fileChanges, onFileChanges]);

  const handleSubmit = () => {
    const prompt = input.trim();
    if (!prompt || status === 'running') return;
    sendPrompt(prompt);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = '44px';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
      {/* 상단바 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary min-h-[44px]">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'w-[7px] h-[7px] rounded-full transition-all',
              connected
                ? 'bg-success shadow-[0_0_8px_hsl(var(--success))]'
                : 'bg-destructive'
            )}
          />
          <span className="font-mono text-xs text-muted-foreground">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          {sessionInfo?.claude_session_id ? (
            <>
              <span className="text-muted-foreground/70 text-xs">|</span>
              <span className="font-mono text-[11px] text-muted-foreground/70">
                Claude Session: {sessionInfo.claude_session_id.slice(0, 12)}{'\u2026'}
              </span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {status === 'running' ? (
            <Badge
              variant="outline"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary border-primary/20 font-mono text-[11px]"
            >
              <span className="inline-block w-2.5 h-2.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              Running
            </Badge>
          ) : null}
          <SessionSettings sessionId={sessionId} />
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleFiles}
            title="Toggle file panel"
            className={cn(showFiles && 'bg-muted')}
            aria-label="파일 패널 토글"
          >
            <FolderOpen className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-2">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-50">
            <div className="font-mono text-[32px] text-primary animate-[blink_1.2s_ease-in-out_infinite]">
              {'>'}_
            </div>
            <div className="font-mono text-[13px] text-muted-foreground">
              Send a prompt to start working with Claude Code
            </div>
          </div>
        ) : null}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="px-4 py-3 border-t border-border bg-secondary">
        <div className="flex items-end gap-2 bg-input border border-border rounded-[var(--radius-md)] pl-3.5 pr-1 py-1 transition-colors focus-within:border-primary/50">
          <Textarea
            ref={textareaRef}
            className="flex-1 font-mono text-[13px] bg-transparent border-0 outline-none resize-none min-h-[44px] leading-[22px] py-[11px] focus-visible:ring-0 focus-visible:ring-offset-0"
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Enter a prompt for Claude Code…"
            rows={1}
            disabled={!connected}
          />
          <div className="flex items-center pb-1">
            {status === 'running' ? (
              <Button variant="destructive" size="sm" onClick={stopExecution} className="font-mono text-xs font-semibold">
                <Square className="h-3 w-3 mr-1.5 fill-current" />
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!input.trim() || !connected}
                className="font-mono text-xs font-semibold"
              >
                Send <Send className="h-3 w-3 ml-1.5" />
              </Button>
            )}
          </div>
        </div>
        <div className="font-mono text-[10px] text-muted-foreground/70 mt-1.5 pl-0.5">
          Shift+Enter for new line {'\u00B7'} Commands are sent to Claude Code CLI
          via <code className="font-mono bg-muted px-1 py-0.5 rounded text-[10px]">--output-format stream-json</code>
        </div>
      </div>
    </div>
  );
}
