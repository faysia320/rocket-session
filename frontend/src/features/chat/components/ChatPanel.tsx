import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { Upload } from "lucide-react";
import { isMobileDevice } from "@/lib/platform";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useClaudeSocket } from "../hooks/useClaudeSocket";
import { useChatNotifications } from "../hooks/useChatNotifications";
import { useChatSearch } from "../hooks/useChatSearch";
import { useChatArtifact } from "../hooks/useChatArtifact";
import { useChatSessionActions } from "../hooks/useChatSessionActions";
import { useWorkflowActions } from "@/features/workflow/hooks/useWorkflowActions";
import { WorkflowProgressBar } from "@/features/workflow/components/WorkflowProgressBar";
import { WorkflowCompletedActions } from "@/features/workflow/components/WorkflowCompletedActions";
import { ArtifactViewer } from "@/features/workflow/components/ArtifactViewer";
import { useWorkflowStatus, useStartWorkflow, workflowKeys } from "@/features/workflow/hooks/useWorkflow";
import { ChatMessageList } from "./ChatMessageList";
import { ChatDialogs } from "./ChatDialogs";
import { ChatSearchBar } from "./ChatSearchBar";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { PinnedTodoBar } from "./PinnedTodoBar";
import { ActivityStatusBar } from "./ActivityStatusBar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import type { FileChange, UserMsg } from "@/types";
import { useShallow } from "zustand/react/shallow";
import { useSessionStore, usePreviewStore } from "@/store";
import { useSlashCommands } from "../hooks/useSlashCommands";
import type { SlashCommand } from "../constants/slashCommands";
import type { TrustLevel } from "./PermissionDialog";
import { useGitInfo } from "@/features/directory/hooks/useGitInfo";
import { sessionKeys } from "@/features/session/hooks/sessionKeys";
import { useCreateSession } from "@/features/session/hooks/useSessions";
import { sessionsApi } from "@/lib/api/sessions.api";
import { toast } from "sonner";
import { SessionStatsBar } from "@/features/session/components/SessionStatsBar";
import { ContextSuggestionPanel } from "@/features/context/components/ContextSuggestionPanel";
import { contextKeys } from "@/features/context/hooks/contextKeys";
import { computeEstimateSize, computeMessageGaps } from "../utils/chatComputations";
import { filesystemApi } from "@/lib/api/filesystem.api";

const noop = () => {};

interface ChatPanelProps {
  sessionId: string;
}

export const ChatPanel = memo(function ChatPanel({ sessionId }: ChatPanelProps) {
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
    pinnedTodos,
    workflowDataChangedRef,
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
  useEffect(() => {
    messagesRef.current = messages;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null);
  const [contextPrefix, setContextPrefix] = useState("");
  const [liveInput, setLiveInput] = useState("");

  // — 패널 전체 드롭존 (Feature A) —
  const [panelIsDragOver, setPanelIsDragOver] = useState(false);
  const panelDragCounter = useRef(0);
  const chatInputDropRef = useRef<((e: React.DragEvent) => void) | null>(null);

  const handlePanelDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    panelDragCounter.current += 1;
    if (panelDragCounter.current === 1) setPanelIsDragOver(true);
  }, []);

  const handlePanelDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    panelDragCounter.current -= 1;
    if (panelDragCounter.current === 0) setPanelIsDragOver(false);
  }, []);

  const handlePanelDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handlePanelDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    panelDragCounter.current = 0;
    setPanelIsDragOver(false);
    chatInputDropRef.current?.(e);
  }, []);

  // — 웹 프리뷰 (Feature B) —
  const openPreview = usePreviewStore((s) => s.openPreview);
  const handleOpenPreview = useCallback(
    (url: string) => {
      openPreview(url);
    },
    [openPreview],
  );

  const isSplitView = useSessionStore((s) => s.viewMode === "split");
  const { focusedSessionId, pendingPrompt, pendingPromptSessionId, clearPendingPrompt } =
    useSessionStore(
      useShallow((s) => ({
        focusedSessionId: s.focusedSessionId,
        pendingPrompt: s.pendingPrompt,
        pendingPromptSessionId: s.pendingPromptSessionId,
        clearPendingPrompt: s.clearPendingPrompt,
      })),
    );
  const queryClient = useQueryClient();

  // WS workflow_artifact_updated/workflow_annotation_added/workflow_changed 이벤트 → TanStack Query 캐시 무효화
  useEffect(() => {
    workflowDataChangedRef.current = (eventType: string, artifactId?: number) => {
      if (eventType === "workflow_changed") {
        // 워크플로우 자동 변경 → 세션 상세 정보, 워크플로우 상태(steps) 및 아티팩트 갱신
        queryClient.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) });
        queryClient.invalidateQueries({ queryKey: workflowKeys.status(sessionId) });
        queryClient.invalidateQueries({ queryKey: workflowKeys.artifacts(sessionId) });
      } else {
        queryClient.invalidateQueries({ queryKey: workflowKeys.artifacts(sessionId) });
        if (artifactId) {
          queryClient.invalidateQueries({ queryKey: workflowKeys.artifact(sessionId, artifactId) });
        }
      }
    };
    return () => {
      workflowDataChangedRef.current = null;
    };
  }, [queryClient, sessionId, workflowDataChangedRef]);

  // S1: 파일 변경 시 context suggestion 캐시 무효화
  const prevFileChangesLen = useRef(fileChanges.length);
  useEffect(() => {
    if (fileChanges.length > prevFileChangesLen.current && sessionInfo?.workspace_id) {
      queryClient.invalidateQueries({ queryKey: contextKeys.all });
    }
    prevFileChangesLen.current = fileChanges.length;
  }, [fileChanges.length, sessionInfo?.workspace_id, queryClient]);

  // U6: 세션 클릭 시 이동 핸들러
  const handleSessionClick = useCallback((targetSessionId: string) => {
    useSessionStore.getState().setFocusedSessionId(targetSessionId);
  }, []);

  // P0: PermissionDialog 콜백 안정화 (타이머 리셋 방지)
  const handlePermissionAllow = useCallback(
    (id: string, trustLevel?: TrustLevel) => respondPermission(id, "allow", trustLevel),
    [respondPermission],
  );
  const handlePermissionDeny = useCallback(
    (id: string) => respondPermission(id, "deny"),
    [respondPermission],
  );

  // P0: FileViewer onOpenChange 안정화
  const handleFileViewerClose = useCallback((open: boolean) => {
    if (!open) setSelectedFile(null);
  }, []);

  const workDir = sessionInfo?.work_dir;
  const worktreeName = sessionInfo?.worktree_name;
  // 워크트리 세션이면 워크트리 경로에서 Git 정보를 조회
  const effectiveWorkDir =
    workDir && worktreeName ? `${workDir}/.claude/worktrees/${worktreeName}` : workDir;
  const { gitInfo } = useGitInfo(effectiveWorkDir ?? "");

  const {
    handleDelete,
    handleArchive,
    handleUnarchive,
    handleRemoveWorktree,
    handleConvertToWorktree,
    handleFork,
  } = useChatSessionActions({ sessionId, workDir, worktreeName, reconnect });

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
    getItemKey: (index) => messages[index]?.id ?? index,
  });

  // 세션 전환 시 virtualizer 측정 캐시 리셋
  useEffect(() => {
    virtualizer.measure();
  }, [sessionId, virtualizer]);

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
    const isMobile = isMobileDevice();
    const HIDDEN_THRESHOLD = isMobile ? 2_000 : 5_000;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        savedNearBottom = isNearBottom.current;
        return;
      }

      // "visible" — 탭이 다시 보임
      const duration = hiddenAt > 0 ? Date.now() - hiddenAt : 0;
      hiddenAt = 0;

      if (duration < HIDDEN_THRESHOLD) return;

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
      // P0: Split View 시 focused pane만 갱신하여 중복 호출 방지
      if (!isSplitView || focusedSessionId === sessionId) {
        queryClient.invalidateQueries({ queryKey: sessionKeys.all });
        queryClient.invalidateQueries({ queryKey: workflowKeys.status(sessionId) });
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [virtualizer, queryClient, isSplitView, focusedSessionId, sessionId]);

  // 워크플로우: 첫 메시지 전송 후 워크플로우 변경 잠금
  const hasUserMessages = useMemo(
    () => messages.some((m) => m.type === "user_message"),
    [messages],
  );

  // 워크플로우 정의 steps 로드
  const { data: workflowStatusData } = useWorkflowStatus(sessionId, true);
  const workflowSteps = useMemo(() => workflowStatusData?.steps ?? [], [workflowStatusData?.steps]);

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
    isLastPhase,
    lastValidationResult,
  } = useWorkflowActions({
    sessionId,
    workflowPhase: sessionInfo?.workflow_phase,
    workflowPhaseStatus: sessionInfo?.workflow_phase_status,
    workflowSteps,
  });

  // 워크플로우 새 사이클: 이어서 구현
  const startWorkflowMutation = useStartWorkflow(sessionId);
  const handleContinueImplement = useCallback(async () => {
    await startWorkflowMutation.mutateAsync({ start_from_step: "implement" });
  }, [startWorkflowMutation]);

  // 워크플로우 새 사이클: 새 주제 (현재 세션 보관 → 새 세션 생성)
  const { createSession } = useCreateSession();
  const handleNewTopic = useCallback(async () => {
    try {
      console.warn("[NewTopic] archiving sessionId:", sessionId, "name:", sessionInfo?.name);
      await sessionsApi.archive(sessionId);
      console.warn("[NewTopic] archive done for:", sessionId);
      queryClient.invalidateQueries({ queryKey: sessionKeys.list() });
      await createSession(sessionInfo?.work_dir, {
        workspace_id: sessionInfo?.workspace_id ?? undefined,
        workflow_definition_id: workflowStatusData?.workflow_definition_id ?? undefined,
      });
      console.warn("[NewTopic] new session created, navigating");
    } catch {
      toast.error("새 주제 생성에 실패했습니다");
    }
  }, [sessionId, sessionInfo, createSession, queryClient, workflowStatusData]);

  // 상태바에서 아티팩트 뷰어 열기 (phase 바인딩)
  const handleOpenArtifactFromStatusBar = useCallback(() => {
    const phase = sessionInfo?.workflow_phase;
    if (phase) {
      handleOpenArtifact(phase as string);
    }
  }, [handleOpenArtifact, sessionInfo?.workflow_phase]);

  // 아티팩트 뷰어 데이터 + 콜백
  const {
    viewingArtifact,
    handleArtifactOpenChange,
    handleAddAnnotation,
    handleResolveAnnotation,
    handleDismissAnnotation,
    handleUpdateArtifactContent,
  } = useChatArtifact({
    sessionId,
    artifactViewerOpen,
    viewingArtifactId,
    handleCloseArtifact,
  });

  const {
    searchOpen,
    searchQuery,
    searchMatchIndex,
    searchMatches,
    setSearchQuery,
    setSearchMatchIndex,
    handleToggleSearch,
  } = useChatSearch({ messages, virtualizer, isSplitView, focusedSessionId, sessionId });

  // P2: 워크플로우 승인 대기 상태 감지 — 원시값 의존성으로 최적화
  const workflowPhaseStatus = sessionInfo?.workflow_phase_status;
  const waitingForWorkflowApproval = useMemo(() => {
    return workflowPhaseStatus === "awaiting_approval";
  }, [workflowPhaseStatus]);

  const chatDisabledByWorkflow = useMemo(() => {
    return workflowPhaseStatus === "awaiting_approval" || workflowPhaseStatus === "completed";
  }, [workflowPhaseStatus]);

  // 같은 턴 내 연속 메시지 간격 계산 (스트리밍 중 재계산 억제)
  const prevGapsRef = useRef<Array<"tight" | "normal" | "turn-start">>([]);
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
  useEffect(() => {
    cmdPaletteRef.current = {
      clearMessages,
      handleToggleSearch,
      sendPrompt,
      sessionId,
    };
  });

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
      if (contextPrefix && messages.length === 0) {
        sendPrompt(`<context>\n${contextPrefix}\n</context>\n\n${prompt}`, { images });
        setContextPrefix("");
      } else {
        sendPrompt(prompt, { images });
      }
    },
    [sendPrompt, contextPrefix, messages.length],
  );

  const handleCommit = useCallback(() => {
    handleSendPrompt("/git-commit");
  }, [handleSendPrompt]);

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

  return (
    <div
      ref={panelRef}
      className="relative flex-1 flex flex-col overflow-hidden overscroll-y-contain"
      onDragEnter={handlePanelDragEnter}
      onDragLeave={handlePanelDragLeave}
      onDragOver={handlePanelDragOver}
      onDrop={handlePanelDrop}
    >
      {/* 풀패널 드래그 오버레이 */}
      {panelIsDragOver ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary pointer-events-none">
          <div className="flex flex-col items-center gap-3 text-primary">
            <Upload className="h-10 w-10" />
            <span className="font-mono text-sm font-semibold">파일을 여기에 놓으세요</span>
          </div>
        </div>
      ) : null}

      <ChatHeader
        connected={connected}
        workDir={effectiveWorkDir}
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
      />
      <WorkflowProgressBar
        steps={workflowSteps}
        currentPhase={sessionInfo?.workflow_phase ?? null}
        currentStatus={
          (sessionInfo?.workflow_phase_status as import("@/types/workflow").WorkflowPhaseStatus) ??
          null
        }
        onPhaseClick={noop}
        sessionId={sessionId}
        isRunning={status === "running"}
        isLocked={hasUserMessages}
        currentDefinitionId={workflowStatusData?.workflow_definition_id}
        onWorkflowChanged={() => {
          queryClient.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) });
          queryClient.invalidateQueries({ queryKey: workflowKeys.status(sessionId) });
        }}
      />

      <PinnedTodoBar todos={pinnedTodos} />

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
      <ChatMessageList
        messages={messages}
        virtualizer={virtualizer}
        searchQuery={searchQuery}
        searchMatches={searchMatches}
        messageGaps={messageGaps}
        animateFromIndex={animateFromIndex}
        scrollContainerRef={scrollContainerRef}
        onScroll={handleScroll}
        status={status}
        activeTools={activeTools}
        loading={loading}
        onResend={handleResend}
        onRetryError={handleRetryFromError}
        onApprovePhase={handleAdvancePhase}
        onRequestRevision={handleRequestRevision}
        onOpenArtifact={handleOpenArtifact}
        isApprovingPhase={isApproving}
        isRequestingRevision={isRequestingRevision}
        onAnswerQuestion={answerQuestion}
        onConfirmAnswers={confirmAndSendAnswers}
        workflowSteps={workflowSteps}
        onOpenPreview={handleOpenPreview}
      />

      <ActivityStatusBar
        activeTools={activeTools}
        status={status}
        pendingPermission={pendingPermission}
        waitingForWorkflowApproval={waitingForWorkflowApproval}
        workflowPhase={(sessionInfo?.workflow_phase as string) ?? null}
        onOpenArtifact={waitingForWorkflowApproval ? handleOpenArtifactFromStatusBar : undefined}
      />
      <div
        className="px-3 pb-2"
        style={{
          display: messages.length === 0 && sessionInfo?.workspace_id ? "block" : "none",
        }}
      >
        {sessionInfo?.workspace_id ? (
          <ContextSuggestionPanel
            workspaceId={sessionInfo.workspace_id}
            prompt={liveInput}
            onContextChange={setContextPrefix}
            onSessionClick={handleSessionClick}
          />
        ) : null}
      </div>
      {sessionInfo?.workflow_phase_status === "completed" ? (
        <WorkflowCompletedActions
          onContinue={handleContinueImplement}
          onNewTopic={handleNewTopic}
          onCommit={handleCommit}
          onArchive={handleArchive}
          onDelete={handleDelete}
          isRunning={status === "running"}
          showCommit={gitInfo?.is_dirty || gitInfo?.has_untracked || false}
        />
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
          disabled={chatDisabledByWorkflow}
          onInputChange={setLiveInput}
          externalIsDragOver={panelIsDragOver}
          dropHandlerRef={chatInputDropRef}
        />
      </div>
      <SessionStatsBar
        sessionId={sessionId}
        isRunning={status === "running" || activeTools.length > 0}
        tokenUsage={tokenUsage}
        messageCount={messages.length}
        currentModel={sessionInfo?.model}
      />
      <ChatDialogs
        permissionRequest={pendingPermission}
        onAllow={handlePermissionAllow}
        onDeny={handlePermissionDeny}
        selectedFile={selectedFile}
        onFileViewerClose={handleFileViewerClose}
        sessionId={sessionId}
      />

      {/* Artifact Viewer */}
      <ErrorBoundary
        fallback={
          <div className="font-mono text-xs text-destructive p-4">
            아티팩트를 표시할 수 없습니다
          </div>
        }
      >
        <ArtifactViewer
          open={artifactViewerOpen}
          onOpenChange={handleArtifactOpenChange}
          artifact={viewingArtifact}
          onApprove={handleAdvancePhase}
          onRequestRevision={handleRequestRevision}
          onAddAnnotation={handleAddAnnotation}
          onResolveAnnotation={handleResolveAnnotation}
          onDismissAnnotation={handleDismissAnnotation}
          onUpdateContent={handleUpdateArtifactContent}
          isApproving={isApproving}
          isRequestingRevision={isRequestingRevision}
          disabled={status === "running"}
          isLastPhase={isLastPhase}
          validationResult={lastValidationResult}
        />
      </ErrorBoundary>
    </div>
  );
});
