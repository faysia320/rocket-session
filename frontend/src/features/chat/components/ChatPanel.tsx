import { useState, useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useQuery } from '@tanstack/react-query';
import { useClaudeSocket } from '../hooks/useClaudeSocket';
import { MessageBubble } from './MessageBubble';
import { PermissionDialog } from './PermissionDialog';
import { PlanReviewDialog } from './PlanReviewDialog';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { ActivityStatusBar } from './ActivityStatusBar';
import { FileViewer } from '@/features/files/components/FileViewer';
import type { FileChange, SessionMode, Message } from '@/types';
import { sessionsApi } from '@/lib/api/sessions.api';
import { useSlashCommands } from '../hooks/useSlashCommands';
import type { SlashCommand } from '../constants/slashCommands';
import { filesystemApi } from '@/lib/api/filesystem.api';
import { useGitInfo } from '@/features/directory/hooks/useGitInfo';

interface ChatPanelProps {
  sessionId: string;
}

export function ChatPanel({ sessionId }: ChatPanelProps) {
  const { connected, messages, status, sessionInfo, fileChanges, activeTools, pendingPermission, sendPrompt, stopExecution, clearMessages, addSystemMessage, updateMessage, respondPermission } =
    useClaudeSocket(sessionId);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);
  const isInitialLoad = useRef(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null);
  const [mode, setMode] = useState<SessionMode>('normal');
  const [planReviewOpen, setPlanReviewOpen] = useState(false);
  const [planReviewMessage, setPlanReviewMessage] = useState<Message | null>(null);

  const workDir = (sessionInfo as Record<string, unknown>)?.work_dir as string | undefined;
  const { gitInfo } = useGitInfo(workDir ?? '');

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

  const cycleMode = useCallback(() => {
    setMode((prev) => {
      const next: SessionMode = prev === 'normal' ? 'plan' : 'normal';
      sessionsApi.update(sessionId, { mode: next }).catch(() => {});
      return next;
    });
  }, [sessionId]);

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

  const handleFileClick = useCallback((change: FileChange) => {
    setSelectedFile(change);
    setFilesOpen(false);
  }, []);

  const handleSlashCommand = useCallback((cmd: SlashCommand) => {
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
        if (cmd.source === 'skill') {
          sendPrompt(`/${cmd.id}`, { mode });
        }
        break;
    }
  }, [addSystemMessage, clearMessages, sendPrompt, mode]);

  const handleSendPrompt = useCallback((prompt: string) => {
    sendPrompt(prompt, { mode });
  }, [sendPrompt, mode]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ChatHeader
        connected={connected}
        workDir={workDir}
        gitBranch={gitInfo?.branch ?? undefined}
        mode={mode}
        status={status}
        sessionId={sessionId}
        fileChanges={fileChanges}
        onToggleMode={cycleMode}
        onFileClick={handleFileClick}
        settingsOpen={settingsOpen}
        onSettingsOpenChange={setSettingsOpen}
        filesOpen={filesOpen}
        onFilesOpenChange={setFilesOpen}
      />

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

      <ChatInput
        connected={connected}
        status={status}
        mode={mode}
        slashCommands={slashCommands}
        onSubmit={handleSendPrompt}
        onStop={stopExecution}
        onModeToggle={cycleMode}
        onSlashCommand={handleSlashCommand}
      />

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
