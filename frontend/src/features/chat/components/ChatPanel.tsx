import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useClaudeSocket } from "../hooks/useClaudeSocket";
import { useNotificationCenter } from "@/features/notification/hooks/useNotificationCenter";
import { MessageBubble } from "./MessageBubble";
import { PermissionDialog } from "./PermissionDialog";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { ActivityStatusBar } from "./ActivityStatusBar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { FileViewer } from "@/features/files/components/FileViewer";
import type { FileChange, SessionMode, SessionInfo, UserMsg } from "@/types";
import { useSessionStore } from "@/store";
import { sessionsApi } from "@/lib/api/sessions.api";
import { useSlashCommands } from "../hooks/useSlashCommands";
import type { SlashCommand } from "../constants/slashCommands";
import { toast } from "sonner";
import { filesystemApi } from "@/lib/api/filesystem.api";
import { useGitInfo } from "@/features/directory/hooks/useGitInfo";
import { sessionKeys } from "@/features/session/hooks/sessionKeys";
import { SessionStatsBar } from "@/features/session/components/SessionStatsBar";
import {
  computeEstimateSize,
  computeMessageGaps,
  computeSearchMatches,
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
  const { notify } = useNotificationCenter();
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);
  const isInitialLoad = useRef(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null);
  const [mode, setMode] = useState<SessionMode>("normal");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);

  const setSidebarMobileOpen = useSessionStore((s) => s.setSidebarMobileOpen);
  const splitView = useSessionStore((s) => s.splitView);
  const focusedSessionId = useSessionStore((s) => s.focusedSessionId);
  const queryClient = useQueryClient();
  const workDir = sessionInfo?.work_dir;
  const { gitInfo } = useGitInfo(workDir ?? "");

  // 세션 상태 전환 시 알림 + gitInfo 갱신 + 세션 목록 캐시 동기화
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev === status) return;

    // 세션 목록 캐시에 상태를 실시간 반영 (사이드바 동기화)
    queryClient.setQueryData<SessionInfo[]>(
      sessionKeys.list(),
      (old) => old?.map((s) =>
        s.id === sessionId ? { ...s, status } : s,
      ),
    );

    // running → idle: 작업 완료
    if (prev === "running" && status === "idle") {
      notify("task.complete", {
        title: "Claude Code",
        body: "작업이 완료되었습니다.",
      });
      if (workDir) {
        const timer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["git-info", workDir] });
        }, 1500);
        prevStatusRef.current = status;
        return () => clearTimeout(timer);
      }
    }

    // → running: 세션 시작
    if (status === "running" && prev !== "running") {
      notify("session.start", {
        title: "Claude Code",
        body: "세션이 실행을 시작했습니다.",
      });
    }

    prevStatusRef.current = status;
  }, [status, workDir, queryClient, notify, sessionId]);

  // 에러 메시지 수신 시 알림
  const prevMsgCountRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      const newMsgs = messages.slice(prevMsgCountRef.current);
      for (const msg of newMsgs) {
        if (msg.type === "error") {
          notify("task.error", {
            title: "Claude Code",
            body: "세션에서 에러가 발생했습니다.",
          });
          break;
        }
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, messages, notify]);

  // Permission 요청 시 알림
  const prevPermissionRef = useRef(pendingPermission);
  useEffect(() => {
    if (pendingPermission && pendingPermission !== prevPermissionRef.current) {
      notify("input.required", {
        title: "Permission 요청",
        body: `${pendingPermission.tool_name} 도구 사용 승인이 필요합니다.`,
      });
    }
    prevPermissionRef.current = pendingPermission;
  }, [pendingPermission, notify]);

  // 세션 정보에서 mode 동기화
  useEffect(() => {
    if (sessionInfo?.mode) {
      setMode(sessionInfo.mode);
    }
  }, [sessionInfo]);

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

  const cycleMode = useCallback(() => {
    setMode((prev) => {
      const next: SessionMode = prev === "normal" ? "plan" : "normal";
      sessionsApi.update(sessionId, { mode: next }).catch(() => {});
      updateSessionMode(next);
      return next;
    });
  }, [sessionId, updateSessionMode]);

  const handleExecutePlan = useCallback(
    (messageId: string) => {
      updateMessage(messageId, { planExecuted: true });
      setMode("normal");
      updateSessionMode("normal");
      sessionsApi.update(sessionId, { mode: "normal" }).catch(() => {});
      sendPrompt("위의 계획대로 단계별로 실행해줘.", { mode: "normal" });
    },
    [sessionId, sendPrompt, updateMessage, updateSessionMode],
  );

  const handleDismissPlan = useCallback(
    (messageId: string) => {
      updateMessage(messageId, { planExecuted: true });
    },
    [updateMessage],
  );

  const handleRevise = useCallback(
    (messageId: string, feedback: string) => {
      updateMessage(messageId, { planExecuted: true });
      sendPrompt(feedback, { mode: "plan" });
    },
    [sendPrompt, updateMessage],
  );

  // 검색: 매칭된 메시지 인덱스 목록
  const searchMatches = useMemo(
    () => computeSearchMatches(messages, searchQuery),
    [messages, searchQuery],
  );

  // 같은 턴 내 연속 메시지 간격 계산 (스트리밍 중 재계산 억제)
  const prevGapsRef = useRef<Record<number, "tight" | "normal" | "turn-start">>({});
  const messageGaps = useMemo(() => {
    if (status === "running") return prevGapsRef.current;
    return computeMessageGaps(messages);
  }, [messages, status]);
  useEffect(() => {
    prevGapsRef.current = messageGaps;
  }, [messageGaps]);

  // 검색 결과 이동 시 스크롤
  useEffect(() => {
    if (searchMatches.length > 0 && searchMatchIndex < searchMatches.length) {
      virtualizer.scrollToIndex(searchMatches[searchMatchIndex], {
        align: "center",
      });
    }
  }, [searchMatchIndex, searchMatches, virtualizer]);

  const handleToggleSearch = useCallback(() => {
    setSearchOpen((prev) => {
      if (prev) {
        setSearchQuery("");
        setSearchMatchIndex(0);
      }
      return !prev;
    });
  }, []);

  // Ctrl+F / Cmd+F 검색 단축키 (split view에서는 포커스된 세션에서만 동작)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        if (splitView && focusedSessionId !== sessionId) return;
        e.preventDefault();
        handleToggleSearch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleToggleSearch, splitView, focusedSessionId, sessionId]);

  // 커맨드 팔레트 이벤트 리스너
  useEffect(() => {
    const forThis = (e: Event, fn: () => void) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.sessionId && detail.sessionId !== sessionId) return;
      fn();
    };

    const handlers: Record<string, (e: Event) => void> = {
      "command-palette:clear-messages": (e) =>
        forThis(e, () => clearMessages()),
      "command-palette:toggle-search": (e) =>
        forThis(e, () => handleToggleSearch()),
      "command-palette:toggle-mode": (e) => forThis(e, () => cycleMode()),
      "command-palette:open-settings": (e) =>
        forThis(e, () => setSettingsOpen(true)),
      "command-palette:toggle-files": (e) =>
        forThis(e, () => setFilesOpen((p) => !p)),
      "command-palette:send-slash": (e) =>
        forThis(e, () => {
          const data = (e as CustomEvent).detail?.data;
          if (data) sendPrompt(data, { mode });
        }),
      "command-palette:send-prompt": (e) =>
        forThis(e, () => {
          const data = (e as CustomEvent).detail?.data;
          if (data) sendPrompt(data, { mode });
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
  }, [clearMessages, handleToggleSearch, cycleMode, sendPrompt, mode, sessionId]);

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
            "  /clear    - 대화 내역 초기화\n" +
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

  // 에러 메시지에서 직전 user 메시지를 찾아 재전송
  const handleRetryFromError = useCallback(
    (errorMsgId: string) => {
      const idx = messages.findIndex((m) => m.id === errorMsgId);
      if (idx < 0) return;
      // 에러 직전 user_message 역탐색
      for (let i = idx - 1; i >= 0; i--) {
        if (messages[i].type === "user_message") {
          const userMsg = messages[i] as UserMsg;
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
    [messages, sendPrompt, mode],
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
        onMenuToggle={() => setSidebarMobileOpen(true)}
        currentModel={sessionInfo?.model as string | undefined}
        portalContainer={panelRef.current}
        onSendPrompt={handleSendPrompt}
        onRemoveWorktree={handleRemoveWorktree}
      />
      <SessionStatsBar
        sessionId={sessionId}
        tokenUsage={tokenUsage}
        messageCount={messages.length}
      />

      {/* 검색 바 */}
      {searchOpen ? (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary/50">
          <input
            className="flex-1 font-mono text-md bg-input border border-border rounded px-2 py-1 outline-none focus:border-primary/50"
            placeholder="메시지 검색…"
            aria-label="메시지 검색"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchMatchIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearchMatchIndex((prev) =>
                  searchMatches.length > 0
                    ? (prev + 1) % searchMatches.length
                    : 0,
                );
              }
              if (e.key === "Escape") handleToggleSearch();
            }}
            autoFocus
          />
          <span
            className="font-mono text-xs text-muted-foreground shrink-0"
            aria-live="polite"
          >
            {searchMatches.length > 0
              ? `${searchMatchIndex + 1}/${searchMatches.length}`
              : searchQuery
                ? "0 results"
                : ""}
          </span>
          <button
            type="button"
            className="font-mono text-xs text-muted-foreground hover:text-foreground px-1"
            onClick={() =>
              setSearchMatchIndex((p) =>
                p > 0 ? p - 1 : searchMatches.length - 1,
              )
            }
            disabled={searchMatches.length === 0}
            aria-label="이전 검색 결과"
          >
            {"\u25B2"}
          </button>
          <button
            type="button"
            className="font-mono text-xs text-muted-foreground hover:text-foreground px-1"
            onClick={() =>
              setSearchMatchIndex(
                (p) => (p + 1) % Math.max(searchMatches.length, 1),
              )
            }
            disabled={searchMatches.length === 0}
            aria-label="다음 검색 결과"
          >
            {"\u25BC"}
          </button>
          <button
            type="button"
            className="font-mono text-md text-muted-foreground hover:text-foreground px-1 ml-1"
            onClick={handleToggleSearch}
            aria-label="검색 닫기"
          >
            {"\u00D7"}
          </button>
        </div>
      ) : null}

      {/* 메시지 영역 */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto select-text pt-3"
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
                    "px-4",
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
      </div>

      <ActivityStatusBar activeTools={activeTools} status={status} />

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
