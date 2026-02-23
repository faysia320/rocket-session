import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useClaudeSocket } from "../hooks/useClaudeSocket";
import { useChatNotifications } from "../hooks/useChatNotifications";
import { useChatSearch } from "../hooks/useChatSearch";
import { useWorkflowActions } from "@/features/workflow/hooks/useWorkflowActions";
import { WorkflowProgressBar } from "@/features/workflow/components/WorkflowProgressBar";
import { ArtifactViewer } from "@/features/workflow/components/ArtifactViewer";
import { useWorkflowArtifact } from "@/features/workflow/hooks/useWorkflow";
import { MessageBubble } from "./MessageBubble";
import { ChatSearchBar } from "./ChatSearchBar";
import { PermissionDialog } from "./PermissionDialog";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { ActivityStatusBar } from "./ActivityStatusBar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileViewer } from "@/features/files/components/FileViewer";
import type { FileChange, UserMsg } from "@/types";
import type { WorkflowPhase } from "@/types/workflow";
import { useSessionStore } from "@/store";
import { sessionsApi } from "@/lib/api/sessions.api";
import { useSlashCommands } from "../hooks/useSlashCommands";
import type { SlashCommand } from "../constants/slashCommands";
import { toast } from "sonner";
import { filesystemApi } from "@/lib/api/filesystem.api";
import { useGitInfo } from "@/features/directory/hooks/useGitInfo";
import { useSessionMutations } from "@/features/session/hooks/useSessions";
import { SessionStatsBar } from "@/features/session/components/SessionStatsBar";
import { computeEstimateSize, computeMessageGaps } from "../utils/chatComputations";
import { useAddAnnotation, useUpdateAnnotation, useUpdateArtifact, useStartWorkflow } from "@/features/workflow/hooks/useWorkflow";

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
    respondPermission,
    reconnect,
    answerQuestion,
    confirmAndSendAnswers,
    pendingAnswerCount,
  } = useClaudeSocket(sessionId);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);
  const scrollRafRef = useRef<number>(0);
  const isInitialLoad = useRef(true);
  // F#3: 애니메이션을 새 메시지에만 적용하기 위한 인덱스 추적
  // 초기 로드 시에는 Infinity → 모든 메시지 애니메이션 비활성화
  // 이후 메시지 추가 시 이전 길이를 기록하여 해당 인덱스 이후만 animate=true
  const animateFromIndex = useRef<number>(Infinity);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null);

  const isSplitView = useSessionStore((s) => s.viewMode === "split");
  const focusedSessionId = useSessionStore((s) => s.focusedSessionId);
  const pendingPrompt = useSessionStore((s) => s.pendingPrompt);
  const pendingPromptSessionId = useSessionStore((s) => s.pendingPromptSessionId);
  const clearPendingPrompt = useSessionStore((s) => s.clearPendingPrompt);
  const queryClient = useQueryClient();
  const { deleteSession, archiveSession, unarchiveSession } = useSessionMutations();

  const handleDelete = useCallback(() => deleteSession(sessionId), [deleteSession, sessionId]);
  const handleArchive = useCallback(() => archiveSession(sessionId), [archiveSession, sessionId]);
  const handleUnarchive = useCallback(
    () => unarchiveSession(sessionId),
    [unarchiveSession, sessionId],
  );

  const workDir = sessionInfo?.work_dir;
  const worktreeName = sessionInfo?.worktree_name;
  const { gitInfo } = useGitInfo(workDir ?? "");

  const startWorkflow = useStartWorkflow(sessionId);
  const handleEnableWorkflow = useCallback(() => {
    startWorkflow.mutate(
      {},
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["sessions"] });
          toast.success("워크플로우 모드로 전환되었습니다");
        },
        onError: () => {
          toast.error("워크플로우 전환에 실패했습니다");
        },
      },
    );
  }, [startWorkflow, queryClient]);

  useChatNotifications({ sessionId, status, messages, pendingPermission, workDir });

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
      sendPrompt(pendingPrompt);
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
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      const el = scrollContainerRef.current;
      if (!el) return;
      isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    });
  }, []);

  // F#11: RAF 쓰로틀 cleanup
  useEffect(() => {
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  const messagesLength = messages.length;
  useEffect(() => {
    if (messagesLength === 0) {
      isInitialLoad.current = true;
      return;
    }
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      // F#3: 초기 로드 완료 후, 이후 추가되는 메시지부터 애니메이션 활성화
      animateFromIndex.current = messagesLength;
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

  // 탭 백그라운드→포그라운드 전환 시: 스크롤 위치 복원 + TanStack Query 갱신
  useEffect(() => {
    let hiddenAt = 0;
    let savedNearBottom = true;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        savedNearBottom = isNearBottom.current;
        return;
      }

      // "visible" — 탭이 다시 보임
      const duration = hiddenAt > 0 ? Date.now() - hiddenAt : 0;
      hiddenAt = 0;

      // 5초 미만 백그라운드는 무시
      if (duration < 5_000) return;

      // 1) 스크롤 위치 복원 (백그라운드 전 하단에 있었으면 하단으로)
      if (savedNearBottom) {
        isNearBottom.current = true;
        const len = messagesRef.current.length;
        if (len > 0) {
          requestAnimationFrame(() => {
            virtualizer.scrollToIndex(len - 1, { align: "end" });
          });
        }
      }

      // 2) TanStack Query 캐시 갱신 (세션 목록, 세션 통계 등)
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [virtualizer, queryClient]);

  // 워크플로우 액션
  const {
    handleAdvancePhase,
    handleRequestRevision,
    handleOpenArtifact,
    handleCloseArtifact,
    artifactViewerOpen,
    viewingArtifactId,
    isApproving,
    isRequestingRevision,
  } = useWorkflowActions({ sessionId, sendPrompt });

  // 아티팩트 뷰어 데이터
  const { data: viewingArtifact } = useWorkflowArtifact(
    sessionId,
    viewingArtifactId ?? 0,
    artifactViewerOpen && viewingArtifactId !== null,
  );
  const addAnnotationMut = useAddAnnotation(sessionId, viewingArtifactId ?? 0);
  const updateAnnotationMut = useUpdateAnnotation(sessionId, viewingArtifactId ?? 0, 0);
  const updateArtifactMut = useUpdateArtifact(sessionId, viewingArtifactId ?? 0);

  const {
    searchOpen,
    searchQuery,
    searchMatchIndex,
    searchMatches,
    setSearchQuery,
    setSearchMatchIndex,
    handleToggleSearch,
  } = useChatSearch({ messages, virtualizer, isSplitView, focusedSessionId, sessionId });

  // 워크플로우 승인 대기 상태 감지
  const waitingForWorkflowApproval = useMemo(() => {
    if (!sessionInfo?.workflow_enabled) return false;
    return sessionInfo.workflow_phase_status === "awaiting_approval";
  }, [sessionInfo]);

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
  const cmdPaletteRef = useRef({
    clearMessages,
    handleToggleSearch,
    sendPrompt,
    sessionId,
  });
  cmdPaletteRef.current = {
    clearMessages,
    handleToggleSearch,
    sendPrompt,
    sessionId,
  };

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
      "command-palette:open-settings": (e) => forThis(e, () => setSettingsOpen(true)),
      "command-palette:toggle-files": (e) => forThis(e, () => setFilesOpen((p) => !p)),
      "command-palette:send-slash": (e) =>
        forThis(e, () => {
          const data = (e as CustomEvent).detail?.data;
          if (data) cmdPaletteRef.current.sendPrompt(data);
        }),
      "command-palette:send-prompt": (e) =>
        forThis(e, () => {
          const data = (e as CustomEvent).detail?.data;
          if (data) cmdPaletteRef.current.sendPrompt(data);
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
          sendPrompt(`/${cmd.id}`);
          break;
        case "settings":
          setSettingsOpen(true);
          break;
        case "files":
          setFilesOpen((p) => !p);
          break;
        default:
          if (cmd.source === "skill") {
            sendPrompt(`/${cmd.id}`);
          }
          break;
      }
    },
    [addSystemMessage, clearMessages, sendPrompt],
  );

  const handleSendPrompt = useCallback(
    (prompt: string, images?: string[]) => {
      sendPrompt(prompt, { images });
    },
    [sendPrompt],
  );

  const handleResend = useCallback(
    (content: string) => {
      sendPrompt(content);
    },
    [sendPrompt],
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
          const text = msg?.content || msg?.prompt || userMsg.content || userMsg.prompt || "";
          if (text) sendPrompt(text);
          break;
        }
      }
    },
    [sendPrompt],
  );

  const navigate = useNavigate();
  const handleRemoveWorktree = useCallback(async () => {
    if (!workDir || !worktreeName) return;
    try {
      await filesystemApi.removeWorktree(workDir, worktreeName, true);
      await sessionsApi.delete(sessionId);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("워크트리가 삭제되었습니다.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(`워크트리 삭제 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [workDir, worktreeName, sessionId, queryClient, navigate]);

  const handleConvertToWorktree = useCallback(
    async (name: string) => {
      try {
        await sessionsApi.convertToWorktree(sessionId, { worktree_name: name });
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
        toast.success(`워크트리로 전환되었습니다. (worktree-${name})`);
        reconnect();
      } catch (err) {
        toast.error(`워크트리 전환 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [sessionId, queryClient, reconnect],
  );

  const handleFork = useCallback(async () => {
    try {
      const forked = await sessionsApi.fork(sessionId);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success(
        "세션이 포크되었습니다. 이전 대화 기록은 참조용입니다. Claude는 새 대화로 시작합니다.",
      );
      navigate({ to: "/session/$sessionId", params: { sessionId: forked.id } });
    } catch {
      toast.error("세션 포크에 실패했습니다");
    }
  }, [sessionId, queryClient, navigate]);

  return (
    <div ref={panelRef} className="relative flex-1 flex flex-col overflow-hidden">
      <ChatHeader
        connected={connected}
        workDir={workDir}
        gitInfo={gitInfo ?? null}
        worktreeName={worktreeName}
        status={status}
        activeTools={activeTools}
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
        onConvertToWorktree={handleConvertToWorktree}
        isArchived={sessionInfo?.status === "archived"}
        onDelete={handleDelete}
        onArchive={handleArchive}
        onUnarchive={handleUnarchive}
        onFork={handleFork}
        workflowEnabled={sessionInfo?.workflow_enabled}
        onEnableWorkflow={handleEnableWorkflow}
      />
      {sessionInfo?.workflow_enabled ? (
        <WorkflowProgressBar
          currentPhase={(sessionInfo.workflow_phase as WorkflowPhase) ?? null}
          currentStatus={sessionInfo.workflow_phase_status as import("@/types/workflow").WorkflowPhaseStatus ?? null}
          onPhaseClick={(_phase) => {
            // TODO: 해당 phase의 아티팩트 뷰어 열기
          }}
        />
      ) : null}
      <SessionStatsBar
        sessionId={sessionId}
        isRunning={status === "running" || activeTools.length > 0}
        tokenUsage={tokenUsage}
        messageCount={messages.length}
        currentModel={sessionInfo?.model}
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
                      isRunning={status === "running" || activeTools.length > 0}
                      searchQuery={searchQuery || undefined}
                      animate={virtualItem.index >= animateFromIndex.current}
                      onResend={handleResend}
                      onRetryError={handleRetryFromError}
                      onApprovePhase={handleAdvancePhase}
                      onRequestRevision={handleRequestRevision}
                      onOpenArtifact={handleOpenArtifact}
                      isApprovingPhase={isApproving}
                      isRequestingRevision={isRequestingRevision}
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
        waitingForWorkflowApproval={waitingForWorkflowApproval}
        workflowPhase={(sessionInfo?.workflow_phase as string) ?? null}
      />

      {!sessionInfo?.workflow_enabled ? (
        <div className="flex items-center justify-between gap-2 px-4 py-1.5 bg-muted/50 border-t border-border text-xs text-muted-foreground">
          <span>읽기전용 모드 — 분석/검색만 가능합니다</span>
          <button
            type="button"
            onClick={handleEnableWorkflow}
            className="px-2 py-0.5 text-2xs font-medium text-primary bg-primary/10 border border-primary/30 rounded hover:bg-primary/20 transition-colors"
          >
            워크플로우 전환
          </button>
        </div>
      ) : null}

      <div>
        <ChatInput
          connected={connected}
          status={status}
          activeTools={activeTools}
          slashCommands={slashCommands}
          onSubmit={handleSendPrompt}
          onStop={stopExecution}
          onSlashCommand={handleSlashCommand}
          sessionId={sessionId}
          pendingAnswerCount={pendingAnswerCount}
          disabled={waitingForWorkflowApproval}
        />
      </div>

      {/* Permission Dialog */}
      <PermissionDialog
        request={pendingPermission}
        onAllow={(id, trustLevel) => respondPermission(id, "allow", trustLevel)}
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

      {/* Artifact Viewer */}
      <ArtifactViewer
        open={artifactViewerOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseArtifact();
        }}
        artifact={viewingArtifact ?? null}
        onApprove={handleAdvancePhase}
        onRequestRevision={handleRequestRevision}
        onAddAnnotation={(lineStart, lineEnd, content, type) => {
          addAnnotationMut.mutate({
            line_start: lineStart,
            line_end: lineEnd,
            content,
            annotation_type: type,
          });
        }}
        onResolveAnnotation={(_annId) => {
          updateAnnotationMut.mutate({ status: "resolved" });
        }}
        onDismissAnnotation={(_annId) => {
          updateAnnotationMut.mutate({ status: "dismissed" });
        }}
        onUpdateContent={(content) => {
          updateArtifactMut.mutate({ content });
        }}
        isApproving={isApproving}
        isRequestingRevision={isRequestingRevision}
      />
    </div>
  );
}
