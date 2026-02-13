import { useState, useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FolderOpen, Send, Square } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useClaudeSocket } from '../hooks/useClaudeSocket';
import { MessageBubble } from './MessageBubble';
import { PermissionDialog } from './PermissionDialog';
import { PlanReviewDialog } from './PlanReviewDialog';
import { ModeIndicator } from './ModeIndicator';
import { ActivityStatusBar } from './ActivityStatusBar';
import { SessionSettings } from '@/features/session/components/SessionSettings';
import { FilePanel } from '@/features/files/components/FilePanel';
import { FileViewer } from '@/features/files/components/FileViewer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { FileChange, SessionMode, Message } from '@/types';
import { sessionsApi } from '@/lib/api/sessions.api';
import { useSlashCommands } from '../hooks/useSlashCommands';
import { SlashCommandPopup } from './SlashCommandPopup';
import type { SlashCommand } from '../constants/slashCommands';
import { filesystemApi } from '@/lib/api/filesystem.api';

interface ChatPanelProps {
  sessionId: string;
}

export function ChatPanel({ sessionId }: ChatPanelProps) {
  const { connected, messages, status, sessionInfo, fileChanges, activeTools, pendingPermission, sendPrompt, stopExecution, clearMessages, addSystemMessage, updateMessage, respondPermission } =
    useClaudeSocket(sessionId);
  const [input, setInput] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);
  const isInitialLoad = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null);
  const [mode, setMode] = useState<SessionMode>('normal');
  const [planReviewOpen, setPlanReviewOpen] = useState(false);
  const [planReviewMessage, setPlanReviewMessage] = useState<Message | null>(null);

  const workDir = (sessionInfo as Record<string, unknown>)?.work_dir as string | undefined;

  // 세션 정보에서 mode 동기화
  useEffect(() => {
    const sessionMode = (sessionInfo as Record<string, unknown>)?.mode as SessionMode | undefined;
    if (sessionMode) {
      setMode(sessionMode);
    }
  }, [sessionInfo]);

  const { data: skillsData } = useQuery({
    queryKey: ['skills', workDir],
    queryFn: () => filesystemApi.listSkills(workDir!),
    enabled: !!workDir,
    staleTime: 5 * 60 * 1000,
  });

  const slashCommands = useSlashCommands({
    connected,
    isRunning: status === 'running',
    skills: skillsData?.skills,
  });

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 60,
    overscan: 10,
  });

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      isInitialLoad.current = true;
      return;
    }
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
      });
      return;
    }
    if (isNearBottom.current) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
      });
    }
  }, [messages, virtualizer]);

  // Plan result 자동 감지 → Dialog 오픈
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (
      lastMsg.type === 'result' &&
      lastMsg.mode === 'plan' &&
      !lastMsg.planExecuted &&
      !planReviewOpen
    ) {
      setPlanReviewMessage(lastMsg);
      setPlanReviewOpen(true);
    }
  }, [messages, planReviewOpen]);

  const cycleMode = () => {
    const next: SessionMode = mode === 'normal' ? 'plan' : 'normal';
    setMode(next);
    sessionsApi.update(sessionId, { mode: next }).catch(() => {});
  };

  const handleExecutePlan = useCallback(
    (messageId: string) => {
      updateMessage(messageId, { planExecuted: true });
      setMode('normal');
      sessionsApi.update(sessionId, { mode: 'normal' }).catch(() => {});
      sendPrompt('위의 계획대로 단계별로 실행해줘.', { mode: 'normal' });
      setPlanReviewOpen(false);
      setPlanReviewMessage(null);
    },
    [sessionId, sendPrompt, updateMessage]
  );

  const handleDismissPlan = useCallback(
    (messageId: string) => {
      updateMessage(messageId, { planExecuted: true });
      setPlanReviewOpen(false);
      setPlanReviewMessage(null);
    },
    [updateMessage]
  );

  const handleRevise = useCallback(
    (feedback: string) => {
      if (planReviewMessage) {
        updateMessage(planReviewMessage.id, { planExecuted: true });
      }
      sendPrompt(feedback, { mode: 'plan' });
      setPlanReviewOpen(false);
      setPlanReviewMessage(null);
    },
    [planReviewMessage, sendPrompt, updateMessage]
  );

  const handleOpenReview = useCallback(
    (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (msg) {
        setPlanReviewMessage(msg);
        setPlanReviewOpen(true);
      }
    },
    [messages]
  );

  const handleFileClick = (change: FileChange) => {
    setSelectedFile(change);
    setFilesOpen(false);
  };

  const executeSlashCommand = (cmd: SlashCommand) => {
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
    switch (cmd.id) {
      case 'help': {
        const helpText =
          '사용 가능한 명령어:\n' +
          '  /help     - 명령어 목록 표시\n' +
          '  /clear    - 대화 내역 초기화\n' +
          '  /compact  - 컨텍스트 압축 (CLI 전달)\n' +
          '  /model    - 모델 변경 (CLI 전달)\n' +
          '  /settings - 세션 설정 열기\n' +
          '  /files    - 파일 변경 패널 토글';
        addSystemMessage(helpText);
        break;
      }
      case 'clear':
        clearMessages();
        break;
      case 'compact':
      case 'model':
        sendPrompt(`/${cmd.id}`, { mode });
        break;
      case 'settings':
        setSettingsOpen(true);
        break;
      case 'files':
        setFilesOpen((p) => !p);
        break;
      default:
        // skill 명령어: CLI에 그대로 전달
        if (cmd.source === 'skill') {
          sendPrompt(`/${cmd.id}`, { mode });
        }
        break;
    }
  };

  const handleSubmit = () => {
    const prompt = input.trim();
    if (!prompt || status === 'running') return;
    sendPrompt(prompt, { mode });
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashCommands.isOpen) {
      const selected = slashCommands.handleKeyDown(e);
      if (selected) {
        executeSlashCommand(slashCommands.selectCommand(selected));
      }
      return;
    }
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      cycleMode();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    slashCommands.handleInputChange(val);
    e.target.style.height = '44px';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
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
                Claude Session: {sessionInfo.claude_session_id.slice(0, 12)}…
              </span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <ModeIndicator mode={mode} onToggle={cycleMode} />
          {status === 'running' ? (
            <Badge
              variant="outline"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary border-primary/20 font-mono text-[11px]"
            >
              <span className="inline-block w-2.5 h-2.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              Running
            </Badge>
          ) : null}
          <SessionSettings sessionId={sessionId} open={settingsOpen} onOpenChange={setSettingsOpen} />
          <Popover open={filesOpen} onOpenChange={setFilesOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                title="File changes"
                className={cn(filesOpen && 'bg-muted')}
                aria-label="파일 변경 패널"
              >
                <FolderOpen className="h-4 w-4" />
                {fileChanges.length > 0 ? (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {fileChanges.length > 99 ? '99+' : fileChanges.length}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0 bg-card border-border" align="end">
              <FilePanel fileChanges={fileChanges} onFileClick={handleFileClick} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-auto select-text">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 opacity-50">
            <div className="font-mono text-[32px] text-primary animate-[blink_1.2s_ease-in-out_infinite]">
              {'>'}_
            </div>
            <div className="font-mono text-[13px] text-muted-foreground">
              Send a prompt to start working with Claude Code
            </div>
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualItem) => (
              <div
                key={messages[virtualItem.index].id}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div className="px-4 pb-2">
                  <MessageBubble
                    message={messages[virtualItem.index]}
                    isRunning={status === 'running'}
                    onExecutePlan={handleExecutePlan}
                    onDismissPlan={handleDismissPlan}
                    onOpenReview={handleOpenReview}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ActivityStatusBar activeTools={activeTools} status={status} />

      {/* 입력 영역 */}
      <div className="px-4 py-3 border-t border-border bg-secondary">
        <div className="relative">
          {slashCommands.isOpen ? (
            <SlashCommandPopup
              commands={slashCommands.filteredCommands}
              activeIndex={slashCommands.activeIndex}
              onSelect={(cmd) => executeSlashCommand(slashCommands.selectCommand(cmd))}
              onHover={slashCommands.setActiveIndex}
            />
          ) : null}
          <div className="flex items-end gap-2 bg-input border border-border rounded-[var(--radius-md)] pl-3.5 pr-1 py-1 transition-colors focus-within:border-primary/50">
          {mode === 'plan' ? (
            <button
              type="button"
              onClick={cycleMode}
              className="flex items-center self-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-all duration-200 cursor-pointer shrink-0"
              title="Plan 모드 (Shift+Tab으로 전환)"
            >
              Plan
            </button>
          ) : null}
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
        </div>
        <div className="font-mono text-[10px] text-muted-foreground/70 mt-1.5 pl-0.5">
          Shift+Enter 줄바꿈 {'·'} Shift+Tab 모드 전환 {'·'} <span className="text-muted-foreground">/</span> 명령어
        </div>
      </div>

      {/* Permission Dialog */}
      <PermissionDialog
        request={pendingPermission}
        onAllow={(id) => respondPermission(id, 'allow')}
        onDeny={(id) => respondPermission(id, 'deny')}
      />

      {/* FileViewer Dialog */}
      {selectedFile ? (
        <FileViewer
          sessionId={sessionId}
          filePath={selectedFile.file}
          tool={selectedFile.tool}
          timestamp={selectedFile.timestamp}
          open={!!selectedFile}
          onOpenChange={(open) => { if (!open) setSelectedFile(null); }}
        />
      ) : null}

      {/* Plan Review Dialog */}
      <PlanReviewDialog
        open={planReviewOpen}
        onOpenChange={setPlanReviewOpen}
        message={planReviewMessage}
        isRunning={status === 'running'}
        onExecute={handleExecutePlan}
        onDismiss={handleDismissPlan}
        onRevise={handleRevise}
      />
    </div>
  );
}
