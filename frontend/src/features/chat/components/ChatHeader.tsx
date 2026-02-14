import { memo } from "react";
import {
  FolderOpen,
  GitBranch,
  Download,
  Search,
  RefreshCw,
  Menu,
} from "lucide-react";
import { sessionsApi } from "@/lib/api/sessions.api";
import { ModelSelector } from "./ModelSelector";
import { SessionSettings } from "@/features/session/components/SessionSettings";
import { FilePanel } from "@/features/files/components/FilePanel";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { FileChange, GitInfo } from "@/types";
import type { ReconnectState } from "../hooks/useClaudeSocket";
interface ChatHeaderProps {
  connected: boolean;
  workDir?: string;
  gitInfo: GitInfo | null;
  status: "idle" | "running" | "error";
  sessionId: string;
  fileChanges: FileChange[];
  reconnectState?: ReconnectState;
  searchOpen?: boolean;
  onToggleSearch?: () => void;
  onFileClick: (change: FileChange) => void;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  filesOpen: boolean;
  onFilesOpenChange: (open: boolean) => void;
  onRetryConnect?: () => void;
  onMenuToggle?: () => void;
  currentModel?: string | null;
}

export const ChatHeader = memo(function ChatHeader({
  connected,
  workDir,
  gitInfo,
  status,
  sessionId,
  fileChanges,
  reconnectState,
  searchOpen,
  onToggleSearch,
  onFileClick,
  settingsOpen,
  onSettingsOpenChange,
  filesOpen,
  onFilesOpenChange,
  onRetryConnect,
  onMenuToggle,
  currentModel,
}: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between px-2 md:px-4 py-2.5 border-b border-border bg-secondary min-h-[44px]">
      <div className="flex items-center gap-2 min-w-0">
        {onMenuToggle ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:hidden shrink-0"
            onClick={onMenuToggle}
            aria-label="메뉴 열기"
          >
            <Menu className="h-4 w-4" />
          </Button>
        ) : null}
        <span
          className={cn(
            "w-[7px] h-[7px] rounded-full transition-all",
            !connected
              ? reconnectState?.status === "reconnecting"
                ? "bg-warning animate-pulse"
                : "bg-destructive"
              : status === "running"
                ? "bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary))]"
                : status === "error"
                  ? "bg-destructive shadow-[0_0_8px_hsl(var(--destructive))]"
                  : "bg-success shadow-[0_0_8px_hsl(var(--success))]",
          )}
        />
        <span className={cn(
          "font-mono text-xs",
          status === "running" && connected
            ? "text-primary font-semibold"
            : status === "error" && connected
              ? "text-destructive font-semibold"
              : "text-muted-foreground",
        )}>
          {!connected
            ? reconnectState?.status === "reconnecting"
              ? `Reconnecting (${reconnectState.attempt}/${reconnectState.maxAttempts})`
              : reconnectState?.status === "failed"
                ? "Connection Failed"
                : "Disconnected"
            : status === "running"
              ? "Running"
              : status === "error"
                ? "Error"
                : "Connected"}
        </span>
        {reconnectState?.status === "failed" && onRetryConnect ? (
          <button
            type="button"
            onClick={onRetryConnect}
            className="flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary bg-primary/10 border border-primary/30 rounded hover:bg-primary/20 transition-colors"
            aria-label="재연결 시도"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        ) : null}
        {workDir ? (
          <span className="hidden md:contents">
            <span className="text-muted-foreground/70 text-xs">|</span>
            <FolderOpen className="h-3 w-3 text-muted-foreground/70 shrink-0" />
            <span
              className="font-mono text-[11px] text-muted-foreground/70 truncate max-w-[300px] direction-rtl text-left"
              title={workDir}
            >
              {workDir}
            </span>
          </span>
        ) : null}
        {gitInfo?.branch ? (
          <span className="hidden md:contents">
            <span className="text-muted-foreground/70 text-xs">|</span>
            <GitBranch className="h-3 w-3 text-muted-foreground/70 shrink-0" />
            <span className="font-mono text-[11px] text-muted-foreground/70">
              {gitInfo.branch}
            </span>
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <ModelSelector
          sessionId={sessionId}
          currentModel={currentModel}
          disabled={status === "running"}
        />
        {onToggleSearch ? (
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleSearch}
            className={cn(searchOpen && "bg-muted")}
            aria-label="메시지 검색"
            title="메시지 검색"
          >
            <Search className="h-4 w-4" />
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="icon"
          onClick={() => sessionsApi.exportMarkdown(sessionId)}
          aria-label="대화 내보내기"
          title="대화 내보내기 (Markdown)"
        >
          <Download className="h-4 w-4" />
        </Button>
        <SessionSettings
          sessionId={sessionId}
          open={settingsOpen}
          onOpenChange={onSettingsOpenChange}
        />
        <Popover open={filesOpen} onOpenChange={onFilesOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              title="File changes"
              className={cn("relative", filesOpen && "bg-muted")}
              aria-label="파일 변경 패널"
            >
              <FolderOpen className="h-4 w-4" />
              {fileChanges.length > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {fileChanges.length > 99 ? "99+" : fileChanges.length}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[calc(100vw-2rem)] md:w-[560px] max-h-[70vh] p-0 bg-card border-border flex flex-col overflow-hidden"
            align="end"
          >
            <FilePanel
              sessionId={sessionId}
              fileChanges={fileChanges}
              onFileClick={onFileClick}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
});
