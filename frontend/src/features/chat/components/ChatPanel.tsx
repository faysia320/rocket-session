import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { ResultMsg } from "@/types";
import { useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useClaudeSocket } from "../hooks/useClaudeSocket";
import { useChatNotifications } from "../hooks/useChatNotifications";
import { useChatSearch } from "../hooks/useChatSearch";
import { usePlanActions } from "../hooks/usePlanActions";
import { MessageBubble } from "./MessageBubble";
import { ChatSearchBar } from "./ChatSearchBar";
import { PermissionDialog } from "./PermissionDialog";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { ActivityStatusBar } from "./ActivityStatusBar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileViewer } from "@/features/files/components/FileViewer";
import type { FileChange, SessionMode, UserMsg } from "@/types";
import { useSessionStore } from "@/store";
import { sessionsApi } from "@/lib/api/sessions.api";
import { useSlashCommands } from "../hooks/useSlashCommands";
import type { SlashCommand } from "../constants/slashCommands";
import { toast } from "sonner";
import { filesystemApi } from "@/lib/api/filesystem.api";
import { useGitInfo } from "@/features/directory/hooks/useGitInfo";
import { useSessionMutations } from "@/features/session/hooks/useSessions";
import { SessionStatsBar } from "@/features/session/components/SessionStatsBar";
import {
  computeEstimateSize,
  computeMessageGaps,
} from "../utils/chatComputations";

interface ChatPanelProps {
  sessionId: string;
}

export function ChatPanel({ sessionId }: ChatPanelProps) {
  const {
    connected,
    loading,
    messages,
    status,
    sessionInfo,
    fileChanges,
    activeTools,
    pendingPermission,
    reconnectState,
    tokenUsage,
    sendPrompt,
    stopExecution,
    clearMessages,
    addSystemMessage,
    updateMessage,
    respondPermission,
    reconnect,
    answerQuestion,
    confirmAndSendAnswers,
    pendingAnswerCount,
    updateSessionMode,
  } = useClaudeSocket(sessionId);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);
  const isInitialLoad = useRef(true);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null);
  const [mode, setMode] = useState<SessionMode>("normal");

  const splitView = useSessionStore((s) => s.splitView);
  const focusedSessionId = useSessionStore((s) => s.focusedSessionId);
  const pendingPrompt = useSessionStore((s) => s.pendingPrompt);
  const pendingPromptSessionId = useSessionStore(
    (s) => s.pendingPromptSessionId,
  );
  const clearPendingPrompt = useSessionStore((s) => s.clearPendingPrompt);
  const queryClient = useQueryClient();
  const { archiveSession, unarchiveSession } = useSessionMutations();

  const handleArchive = useCallback(() => archiveSession(sessionId), [archiveSession, sessionId]);
  const handleUnarchive = useCallback(() => unarchiveSession(sessionId), [unarchiveSession, sessionId]);

  const workDir = sessionInfo?.work_dir;
  const { gitInfo } = useGitInfo(workDir ?? "");

  useChatNotifications({ sessionId, status, messages, pendingPermission, workDir });

  // 세션 정보에서 mode 동기화
  useEffect(() => {
    if (sessionInfo?.mode) {
      setMode(sessionInfo.mode);
    }
  }, [sessionInfo]);

  // pendingPrompt 자동 전송 (Git Monitor 커밋 등 외부에서 세션 생성 시)
  const hasAutoSentRef = useRef(false);

  useEffect(() => {
    if (
      connected &&
      pendingPrompt &&
      pendingPromptSessionId === sessionId &&
      !hasAutoSentRef.current
    ) {
      hasAutoSentRef.current = true;
      sendPrompt(pendingPrompt, { mode: "normal" });
      clearPendingPrompt();
    }
  }, [connected, pendingPrompt, pendingPromptSessionId, sessionId, sendPrompt, clearPendingPrompt]);

  useEffect(() => {
    hasAutoSentRef.current = false;
  }, [sessionId]);

  const { data: skillsData } = useQuery({
    queryKey: ["skills", workDir],
    queryFn: () => filesystemApi.listSkills(workDir!),
    enabled: !!workDir,
    staleTime: 5 * 60 * 1000,
  });

  const slashCommands = useSlashCommands({
    connected,
    isRunning: status === "running",
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
    isNearBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 100;
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
        virtualizer.scrollToIndex(messagesLength - 1, { align: "end" });
      });
      return;
    }
    if (isNearBottom.current) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(messagesLength - 1, { align: "end" });
      });
    }
  }, [messagesLength, virtualizer]);

  // Plan result 자동 감지 → 해당 메시지로 스크롤
  useEffect(() => {
    if (messagesLength === 0) return;
    const lastMsg = messages[messagesLength - 1];
    if (
      lastMsg.type === "result" &&
      lastMsg.mode === "plan" &&
      !lastMsg.planExecuted
    ) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(messagesLength - 1, { align: "start" });
      });
    }
  }, [messagesLength, messages, virtualizer]);

  const {
    cycleMode, handleExecutePlan, handleContinuePlan,
    handleDismissPlan, handleRevise,
  } = usePlanActions({ sessionId, setMode, sendPrompt, updateMessage, updateSessionMode });

  const {
    searchOpen, searchQuery, searchMatchIndex, searchMatches,
    setSearchQuery, setSearchMatchIndex, handleToggleSearch,
  } = useChatSearch({ messages, virtualizer, splitView, focusedSessionId, sessionId });

  // Plan 승인 대기 상태 감지
  const waitingForPlanApproval = useMemo(() => {
    if (messages.length === 0) return false;
    const lastMsg = messages[messages.length - 1];
    return (
      lastMsg.type === "result" &&
      (lastMsg as ResultMsg).mode === "plan" &&
      !(lastMsg as ResultMsg).planExecuted
    );
  }, [messages]);

  // 같은 턴 내 연속 메시지 간격 계산 (스트리밍 중 재계산 억제)
  const prevGapsRef = useRef<Record<number, "tight" | "normal" | "turn-start">>({});
  const messageGaps = useMemo(() => {
    if (status === "running") return prevGapsRef.current;
    return computeMessageGaps(messages);
  }, [messages, status]);
  useEffect(() => {
    prevGapsRef.current = messageGaps;
  }, [messageGaps]);

  // 커맨드 팔레트 이벤트 리스너 — ref로 최신 값 참조하여 리스너 재등록 방지
  const cmdPaletteRef = useRef({ clearMessages, handleToggleSearch, cycleMode, sendPrompt, mode, sessionId });
  cmdPaletteRef.current = { clearMessages, handleToggleSearch, cycleMode, sendPrompt, mode, sessionId };

  useEffect(() => {
    const forThis = (e: Event, fn: () => void) => {
      const detail = (e as CustomEvent).detail;
      const { sessionId: sid } = cmdPaletteRef.current;
      if (detail?.sessionId && detail.sessionId !== sid) return;
      fn();
    };

    const handlers: Record<string, (e: Event) => void> = {
      "command-palette:clear-messages": (e) =>
        forThis(e, () => cmdPaletteRef.current.clearMessages()),
      "command-palette:toggle-search": (e) =>
        forThis(e, () => cmdPaletteRef.current.handleToggleSearch()),
      "command-palette:toggle-mode": (e) =>
        forThis(e, () => cmdPaletteRef.current.cycleMode()),
      "command-palette:open-settings": (e) =>
        forThis(e, () => setSettingsOpen(true)),
      "command-palette:toggle-files": (e) =>
        forThis(e, () => setFilesOpen((p) => !p)),
      "command-palette:send-slash": (e) =>
        forThis(e, () => {
          const data = (e as CustomEvent).detail?.data;
          if (data) cmdPaletteRef.current.sendPrompt(data, { mode: cmdPaletteRef.current.mode });
        }),
      "command-palette:send-prompt": (e) =>
        forThis(e, () => {
          const data = (e as CustomEvent).detail?.data;
          if (data) cmdPaletteRef.current.sendPrompt(data, { mode: cmdPaletteRef.current.mode });
        }),
    };

    for (const [event, handler] of Object.entries(handlers)) {
      window.addEventListener(event, handler);
    }
    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        window.removeEventListener(event, handler);
      }
    };
  }, []); // 의존성 없음: ref를 통해 항상 최신 값 참조

  const handleFileClick = useCallback((change: FileChange) => {
    setSelectedFile(change);
    setFilesOpen(false);
  }, []);

  const handleSlashCommand = useCallback(
    (cmd: SlashCommand) => {
      switch (cmd.id) {
        case "help": {
          const helpText =
            "사용 가능한 명령어:\n" +
            "  /help     - 명령어 목록 표시\n" +
            "  /clear    - 대화 컨텍스트 초기화 (새 대화 시작)\n" +
            "  /compact  - 컨텍스트 압축 (CLI 전달)\n" +
            "  /model    - 모델 변경 (CLI 전달)\n" +
            "  /settings - 세션 설정 열기\n" +
            "  /files    - 파일 변경 패널 토글";
          addSystemMessage(helpText);
          break;
        }
        case "clear":
          clearMessages();
          break;
        case "compact":
        case "model":
          sendPrompt(`/${cmd.id}`, { mode });
          break;
        case "settings":
          setSettingsOpen(true);
          break;
        case "files":
          setFilesOpen((p) => !p);
          break;
        default:
          if (cmd.source === "skill") {
            sendPrompt(`/${cmd.id}`, { mode });
          }
          break;
      }
    },
    [addSystemMessage, clearMessages, sendPrompt, mode],
  );

  const handleSendPrompt = useCallback(
    (prompt: string, images?: string[]) => {
      sendPrompt(prompt, { mode, images });
    },
    [sendPrompt, mode],
  );

  const handleResend = useCallback(
    (content: string) => {
      sendPrompt(content, { mode });
    },
    [sendPrompt, mode],
  );

  // 에러 메시지에서 직전 user 메시지를 찾아 재전송 — messagesRef로 messages 의존성 제거
  const handleRetryFromError = useCallback(
    (errorMsgId: string) => {
      const msgs = messagesRef.current;
      const idx = msgs.findIndex((m) => m.id === errorMsgId);
      if (idx < 0) return;
      // 에러 직전 user_message 역탐색
      for (let i = idx - 1; i >= 0; i--) {
        if (msgs[i].type === "user_message") {
          const userMsg = msgs[i] as UserMsg;
          const msg = userMsg.message as Record<string, string> | undefined;
          const text =
            msg?.content ||
            msg?.prompt ||
            userMsg.content ||
            userMsg.prompt ||
            "";
          if (text) sendPrompt(text, { mode });
          break;
        }
      }
    },
    [sendPrompt, mode],
  );

  const navigate = useNavigate();
  const handleRemoveWorktree = useCallback(async () => {
    if (!workDir) return;
    try {
      await filesystemApi.removeWorktree(workDir, true);
      await sessionsApi.delete(sessionId);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("워크트리가 삭제되었습니다.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(
        `워크트리 삭제 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }, [workDir, sessionId, queryClient, navigate]);

  return (
    <div ref={panelRef} className="relative flex-1 flex flex-col overflow-hidden">
      <ChatHeader
        connected={connected}
        workDir={workDir}
        gitInfo={gitInfo ?? null}
        status={status}
        sessionId={sessionId}
        fileChanges={fileChanges}
        reconnectState={reconnectState}
        onFileClick={handleFileClick}
        settingsOpen={settingsOpen}
        onSettingsOpenChange={setSettingsOpen}
        filesOpen={filesOpen}
        onFilesOpenChange={setFilesOpen}
        onRetryConnect={reconnect}
        currentModel={sessionInfo?.model as string | undefined}
        portalContainer={panelRef.current}
        onSendPrompt={handleSendPrompt}
        onRemoveWorktree={handleRemoveWorktree}
        isArchived={sessionInfo?.status === "archived"}
        onArchive={handleArchive}
        onUnarchive={handleUnarchive}
      />
      <SessionStatsBar
        sessionId={sessionId}
        isRunning={status === "running"}
        tokenUsage={tokenUsage}
        messageCount={messages.length}
      />

      {/* 검색 바 */}
      {searchOpen ? (
        <ChatSearchBar
          searchQuery={searchQuery}
          searchMatchIndex={searchMatchIndex}
          searchMatchCount={searchMatches.length}
          onQueryChange={setSearchQuery}
          onMatchIndexChange={setSearchMatchIndex}
          onClose={handleToggleSearch}
        />
      ) : null}

      {/* 메시지 영역 */}
      <ScrollArea
        className="flex-1"
        viewportRef={scrollContainerRef}
        viewportClassName="select-text pt-3 !overflow-x-hidden"
        onScroll={handleScroll}
      >
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
              {">"}_
            </div>
            <div className="font-mono text-md text-muted-foreground">
              Claude Code에 프롬프트를 입력하세요
            </div>
          </div>
        ) : (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => (
              <div
                key={messages[virtualItem.index].id}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div
                  className={[
                    "px-4 min-w-0 overflow-hidden",
                    messageGaps[virtualItem.index] === "tight"
                      ? "pb-0.5"
                      : messageGaps[virtualItem.index] === "turn-start"
                        ? "pb-4"
                        : "pb-2",
                    searchQuery && searchMatches.includes(virtualItem.index)
                      ? "ring-1 ring-primary/40 rounded-sm bg-primary/5"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <ErrorBoundary>
                    <MessageBubble
                      message={messages[virtualItem.index]}
                      isRunning={status === "running"}
                      searchQuery={searchQuery || undefined}
                      onResend={handleResend}
                      onRetryError={handleRetryFromError}
                      onExecutePlan={handleExecutePlan}
                      onContinuePlan={handleContinuePlan}
                      onDismissPlan={handleDismissPlan}
                      onRevisePlan={handleRevise}
                      onAnswerQuestion={answerQuestion}
                      onConfirmAnswers={confirmAndSendAnswers}
                    />
                  </ErrorBoundary>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <ActivityStatusBar
        activeTools={activeTools}
        status={status}
        pendingPermission={pendingPermission}
        waitingForPlanApproval={waitingForPlanApproval}
      />

      <div>
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
          pendingAnswerCount={pendingAnswerCount}
        />
      </div>

      {/* Permission Dialog */}
      <PermissionDialog
        request={pendingPermission}
        onAllow={(id) => respondPermission(id, "allow")}
        onDeny={(id) => respondPermission(id, "deny")}
      />

      {/* FileViewer Dialog */}
      {selectedFile ? (
        <FileViewer
          sessionId={sessionId}
          filePath={selectedFile.file}
          tool={selectedFile.tool}
          timestamp={selectedFile.timestamp}
          open={!!selectedFile}
          onOpenChange={(open) => {
            if (!open) setSelectedFile(null);
          }}
        />
      ) : null}

    </div>
  );
}
