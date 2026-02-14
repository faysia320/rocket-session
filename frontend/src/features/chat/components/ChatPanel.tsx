import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useClaudeSocket } from '../hooks/useClaudeSocket';
import { useDesktopNotification } from '../hooks/useDesktopNotification';
import { MessageBubble } from './MessageBubble';
import { PermissionDialog } from './PermissionDialog';
import { PlanReviewDialog } from './PlanReviewDialog';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { ActivityStatusBar } from './ActivityStatusBar';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { FileViewer } from '@/features/files/components/FileViewer';
import type { FileChange, SessionMode, ResultMsg, UserMsg } from '@/types';
import { useSessionStore } from '@/store';
import { sessionsApi } from '@/lib/api/sessions.api';
import { useSlashCommands } from '../hooks/useSlashCommands';
import type { SlashCommand } from '../constants/slashCommands';
import { toast } from 'sonner';
import { filesystemApi } from '@/lib/api/filesystem.api';
import { useGitInfo } from '@/features/directory/hooks/useGitInfo';
import { SessionStatsBar } from '@/features/session/components/SessionStatsBar';
import { computeEstimateSize, computeMessageGaps, computeSearchMatches } from '../utils/chatComputations';

interface ChatPanelProps {
  sessionId: string;
}

export function ChatPanel({ sessionId }: ChatPanelProps) {
  const { connected, loading, messages, status, sessionInfo, fileChanges, activeTools, pendingPermission, reconnectState, tokenUsage, sendPrompt, stopExecution, clearMessages, addSystemMessage, updateMessage, respondPermission, reconnect } =
    useClaudeSocket(sessionId);
  const { notify } = useDesktopNotification();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);
  const isInitialLoad = useRef(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null);
  const [mode, setMode] = useState<SessionMode>('normal');
  const [planReviewOpen, setPlanReviewOpen] = useState(false);
  const [planReviewMessage, setPlanReviewMessage] = useState<ResultMsg | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);

  const setSidebarMobileOpen = useSessionStore((s) => s.setSidebarMobileOpen);
  const queryClient = useQueryClient();
  const workDir = sessionInfo?.work_dir;
  const { gitInfo } = useGitInfo(workDir ?? '');

  // running → idle 전환 시 gitInfo 자동 갱신 + 알림
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current === 'running' && status === 'idle') {
      notify('Claude Code', '작업이 완료되었습니다.');
      if (workDir) {
        const timer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['git-info', workDir] });
        }, 1500);
        prevStatusRef.current = status;
        return () => clearTimeout(timer);
      }
    }
    prevStatusRef.current = status;
  }, [status, workDir, queryClient, notify]);

  // 세션 정보에서 mode 동기화
  useEffect(() => {
    if (sessionInfo?.mode) {
      setMode(sessionInfo.mode);
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
    estimateSize: (index) => computeEstimateSize(messages[index]),
    overscan: 10,
  });

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  const messagesLength = messages.length;
  useEffect(() => {
    if (messagesLength === 0) {
      isInitialLoad.current = true;
      return;
    }
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(messagesLength - 1, { align: 'end' });
      });
      return;
    }
    if (isNearBottom.current) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(messagesLength - 1, { align: 'end' });
      });
    }
  }, [messagesLength, virtualizer]);

  // Plan result 자동 감지 → Dialog 오픈
  useEffect(() => {
    if (messagesLength === 0) return;
    const lastMsg = messages[messagesLength - 1];
    if (
      lastMsg.type === 'result' &&
      lastMsg.mode === 'plan' &&
      !lastMsg.planExecuted &&
      !planReviewOpen
    ) {
      setPlanReviewMessage(lastMsg as ResultMsg);
      setPlanReviewOpen(true);
    }
  }, [messagesLength, messages, planReviewOpen]);

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
      if (msg && msg.type === 'result') {
        setPlanReviewMessage(msg as ResultMsg);
        setPlanReviewOpen(true);
      }
    },
    [messages]
  );

  // 검색: 매칭된 메시지 인덱스 목록
  const searchMatches = useMemo(() => computeSearchMatches(messages, searchQuery), [messages, searchQuery]);

  // 같은 턴 내 연속 메시지 간격 계산 (스트리밍 중 재계산 억제)
  const prevGapsRef = useRef<Record<number, 'tight' | 'normal'>>({});
  const messageGaps = useMemo(() => {
    if (status === 'running') return prevGapsRef.current;
    return computeMessageGaps(messages);
  }, [messages, status]);
  useEffect(() => { prevGapsRef.current = messageGaps; }, [messageGaps]);

  // 검색 결과 이동 시 스크롤
  useEffect(() => {
    if (searchMatches.length > 0 && searchMatchIndex < searchMatches.length) {
      virtualizer.scrollToIndex(searchMatches[searchMatchIndex], { align: 'center' });
    }
  }, [searchMatchIndex, searchMatches, virtualizer]);

  const handleToggleSearch = useCallback(() => {
    setSearchOpen((prev) => {
      if (prev) {
        setSearchQuery('');
        setSearchMatchIndex(0);
      }
      return !prev;
    });
  }, []);

  // Ctrl+F / Cmd+F 검색 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        handleToggleSearch();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleToggleSearch]);

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

  const handleSendPrompt = useCallback((prompt: string, images?: string[]) => {
    sendPrompt(prompt, { mode, images });
  }, [sendPrompt, mode]);

  const handleResend = useCallback((content: string) => {
    sendPrompt(content, { mode });
  }, [sendPrompt, mode]);

  // 에러 메시지에서 직전 user 메시지를 찾아 재전송
  const handleRetryFromError = useCallback((errorMsgId: string) => {
    const idx = messages.findIndex((m) => m.id === errorMsgId);
    if (idx < 0) return;
    // 에러 직전 user_message 역탐색
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].type === 'user_message') {
        const userMsg = messages[i] as UserMsg;
        const msg = userMsg.message as Record<string, string> | undefined;
        const text = msg?.content || msg?.prompt || userMsg.content || userMsg.prompt || '';
        if (text) sendPrompt(text, { mode });
        break;
      }
    }
  }, [messages, sendPrompt, mode]);

  const navigate = useNavigate();
  const handleRemoveWorktree = useCallback(async () => {
    if (!workDir) return;
    try {
      await filesystemApi.removeWorktree(workDir, true);
      await sessionsApi.delete(sessionId);
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('워크트리가 삭제되었습니다.');
      navigate({ to: '/' });
    } catch (err) {
      toast.error(`워크트리 삭제 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [workDir, sessionId, queryClient, navigate]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ChatHeader
        connected={connected}
        workDir={workDir}
        gitInfo={gitInfo ?? null}
        mode={mode}
        status={status}
        sessionId={sessionId}
        fileChanges={fileChanges}
        reconnectState={reconnectState}
        searchOpen={searchOpen}
        onToggleSearch={handleToggleSearch}
        onToggleMode={cycleMode}
        onFileClick={handleFileClick}
        settingsOpen={settingsOpen}
        onSettingsOpenChange={setSettingsOpen}
        filesOpen={filesOpen}
        onFilesOpenChange={setFilesOpen}
        onRetryConnect={reconnect}
        onSendPrompt={handleSendPrompt}
        onRemoveWorktree={handleRemoveWorktree}
        onMenuToggle={() => setSidebarMobileOpen(true)}
        tokenUsage={tokenUsage}
        currentModel={sessionInfo?.model as string | undefined}
        messageCount={messages.length}
      />
      <SessionStatsBar sessionId={sessionId} />

      {/* 검색 바 */}
      {searchOpen ? (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary/50">
          <input
            className="flex-1 font-mono text-[13px] bg-input border border-border rounded px-2 py-1 outline-none focus:border-primary/50"
            placeholder="메시지 검색…"
            aria-label="메시지 검색"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchMatchIndex(0); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearchMatchIndex((prev) => (searchMatches.length > 0 ? (prev + 1) % searchMatches.length : 0));
              }
              if (e.key === 'Escape') handleToggleSearch();
            }}
            autoFocus
          />
          <span className="font-mono text-[11px] text-muted-foreground shrink-0" aria-live="polite">
            {searchMatches.length > 0
              ? `${searchMatchIndex + 1}/${searchMatches.length}`
              : searchQuery ? '0 results' : ''}
          </span>
          <button
            type="button"
            className="font-mono text-[11px] text-muted-foreground hover:text-foreground px-1"
            onClick={() => setSearchMatchIndex((p) => (p > 0 ? p - 1 : searchMatches.length - 1))}
            disabled={searchMatches.length === 0}
            aria-label="이전 검색 결과"
          >
            {'\u25B2'}
          </button>
          <button
            type="button"
            className="font-mono text-[11px] text-muted-foreground hover:text-foreground px-1"
            onClick={() => setSearchMatchIndex((p) => (p + 1) % Math.max(searchMatches.length, 1))}
            disabled={searchMatches.length === 0}
            aria-label="다음 검색 결과"
          >
            {'\u25BC'}
          </button>
          <button
            type="button"
            className="font-mono text-[13px] text-muted-foreground hover:text-foreground px-1 ml-1"
            onClick={handleToggleSearch}
            aria-label="검색 닫기"
          >
            {'\u00D7'}
          </button>
        </div>
      ) : null}

      {/* 메시지 영역 */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-auto select-text pt-3">
        {loading ? (
          <div className="px-4 space-y-4 animate-pulse">
            {Array.from({ length: Math.min(Math.max(3, 1), 5) }, (_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-end">
                  <div className="h-10 w-48 bg-muted rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-3 w-20 bg-muted rounded" />
                  <div className="h-16 w-full bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 opacity-50 animate-[fadeIn_0.3s_ease]">
            <div className="font-mono text-[32px] text-primary animate-[blink_1.2s_ease-in-out_infinite]">
              {'>'}_
            </div>
            <div className="font-mono text-[13px] text-muted-foreground">
              Claude Code에 프롬프트를 입력하세요
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
                <div className={[
                  'px-4',
                  messageGaps[virtualItem.index] === 'tight' ? 'pb-0.5' : 'pb-2',
                  searchQuery && searchMatches.includes(virtualItem.index) ? 'ring-1 ring-primary/40 rounded-sm bg-primary/5' : '',
                ].filter(Boolean).join(' ')}>
                  <ErrorBoundary>
                    <MessageBubble
                      message={messages[virtualItem.index]}
                      isRunning={status === 'running'}
                      searchQuery={searchQuery || undefined}
                      onResend={handleResend}
                      onRetryError={handleRetryFromError}
                      onExecutePlan={handleExecutePlan}
                      onDismissPlan={handleDismissPlan}
                      onOpenReview={handleOpenReview}
                    />
                  </ErrorBoundary>
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
        sessionId={sessionId}
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
