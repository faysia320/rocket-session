import { FolderOpen, GitBranch, GitBranchPlus, RefreshCw, Globe } from "lucide-react";
import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { FilePanel } from "@/features/files/components/FilePanel";
import { SessionSettings } from "@/features/session/components/SessionSettings";
import { cn, formatWorkDir } from "@/lib/utils";
import type { FileChange, GitInfo, ToolUseMsg } from "@/types";
import type { ReconnectState } from "../hooks/useClaudeSocket";
import { GitDropdownMenu } from "./GitDropdownMenu";
import { SessionDropdownMenu } from "./SessionDropdownMenu";
import { usePreviewStore } from "@/store";

interface ChatHeaderProps {
	connected: boolean;
	workDir?: string;
	gitInfo: GitInfo | null;
	worktreeName?: string | null;
	status: "idle" | "running" | "preparing" | "error";
	activeTools: ToolUseMsg[];
	sessionId: string;
	fileChanges: FileChange[];
	reconnectState?: ReconnectState;
	onFileClick: (change: FileChange) => void;
	settingsOpen: boolean;
	onSettingsOpenChange: (open: boolean) => void;
	filesOpen: boolean;
	onFilesOpenChange: (open: boolean) => void;
	onRetryConnect?: () => void;
	currentModel?: string | null;
	portalContainer?: HTMLElement | null;
	onSendPrompt: (prompt: string) => void;
	onRemoveWorktree?: () => void;
	onConvertToWorktree?: (name: string) => void;
	isArchived?: boolean;
	onArchive?: () => void;
	onUnarchive?: () => void;
	onDelete?: () => void;
	onFork?: () => void;
}

export const ChatHeader = memo(function ChatHeader({
	connected,
	workDir,
	gitInfo,
	worktreeName,
	status,
	activeTools,
	sessionId,
	fileChanges,
	reconnectState,
	onFileClick,
	settingsOpen,
	onSettingsOpenChange,
	filesOpen,
	onFilesOpenChange,
	onRetryConnect,
	portalContainer,
	onSendPrompt,
	onRemoveWorktree,
	onConvertToWorktree,
	isArchived,
	onArchive,
	onUnarchive,
	onDelete,
	onFork,
}: ChatHeaderProps) {
	const isEffectivelyRunning = status === "running" || activeTools.length > 0;
	const isWorktree = !!worktreeName;

	// 웹 프리뷰 스토어
	const previewIsOpen = usePreviewStore((s) => s.isOpen);
	const previewUrl = usePreviewStore((s) => s.url);
	const previewOpen = usePreviewStore((s) => s.openPreview);
	const previewClose = usePreviewStore((s) => s.closePreview);

	const displayWorkDir = useMemo(() => {
		if (isWorktree && workDir) {
			const suffix = `/.claude/worktrees/${worktreeName}`;
			if (workDir.endsWith(suffix)) return workDir.slice(0, -suffix.length);
		}
		return workDir;
	}, [workDir, worktreeName, isWorktree]);

	const uniqueFileCount = useMemo(
		() => new Set(fileChanges.map((c) => c.file)).size,
		[fileChanges],
	);

	return (
		<div className="flex items-center justify-between px-2 md:px-4 py-1.5 border-b border-border bg-secondary">
			<div className="flex flex-col gap-0.5 min-w-0">
				{/* 1줄: 연결 상태 */}
				<div className="flex items-center gap-2">
					<span
						className={cn(
							"w-2 h-2 rounded-full transition-all",
							!connected
								? reconnectState?.status === "reconnecting"
									? "bg-warning animate-pulse"
									: "bg-destructive"
								: isEffectivelyRunning
									? "bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary))]"
									: status === "error"
										? "bg-destructive shadow-[0_0_8px_hsl(var(--destructive))]"
										: "bg-success shadow-[0_0_8px_hsl(var(--success))]",
						)}
					/>
					<span
						className={cn(
							"font-mono text-xs",
							isEffectivelyRunning && connected
								? "text-primary font-semibold"
								: status === "error" && connected
									? "text-destructive font-semibold"
									: "text-muted-foreground",
						)}
					>
						{!connected
							? reconnectState?.status === "reconnecting"
								? `Reconnecting (${reconnectState.attempt}/${reconnectState.maxAttempts})`
								: reconnectState?.status === "failed"
									? "Connection Failed"
									: "Disconnected"
							: isEffectivelyRunning
								? "Running"
								: status === "error"
									? "Error"
									: "Connected"}
					</span>
					{reconnectState?.status === "failed" && onRetryConnect ? (
						<button
							type="button"
							onClick={onRetryConnect}
							className="flex items-center gap-1 px-2 py-0.5 font-mono text-2xs font-semibold text-primary bg-primary/10 border border-primary/30 rounded hover:bg-primary/20 transition-colors"
							aria-label="재연결 시도"
						>
							<RefreshCw className="h-3 w-3" />
							Retry
						</button>
					) : null}
				</div>
				{/* 2줄: 워크스페이스 경로 + Git 브랜치 */}
				{workDir || gitInfo?.branch ? (
					<div className="hidden md:flex items-center gap-1.5 pl-4">
						{workDir ? (
							<>
								{isWorktree ? (
									<Tooltip>
										<TooltipTrigger asChild>
											<GitBranchPlus className="h-3 w-3 text-info/60 shrink-0" />
										</TooltipTrigger>
										<TooltipContent side="bottom" className="font-mono text-xs">
											Worktree: {worktreeName}
										</TooltipContent>
									</Tooltip>
								) : (
									<FolderOpen className="h-3 w-3 text-muted-foreground/60 shrink-0" />
								)}
								<Tooltip>
									<TooltipTrigger asChild>
										<span className="font-mono text-2xs text-muted-foreground/60 truncate max-w-[300px]">
											{formatWorkDir(displayWorkDir ?? "")}
										</span>
									</TooltipTrigger>
									<TooltipContent side="bottom" className="font-mono text-xs">
										{workDir}
									</TooltipContent>
								</Tooltip>
							</>
						) : null}
						{workDir && gitInfo?.branch ? (
							<span className="text-muted-foreground/40 text-2xs">|</span>
						) : null}
						{gitInfo?.branch ? (
							<>
								<GitBranch className="h-3 w-3 text-muted-foreground/60 shrink-0" />
								<Tooltip>
									<TooltipTrigger asChild>
										<span className="font-mono text-2xs text-muted-foreground/60 truncate max-w-[150px]">
											{gitInfo.branch}
										</span>
									</TooltipTrigger>
									<TooltipContent side="bottom" className="font-mono text-xs">
										{gitInfo.branch}
									</TooltipContent>
								</Tooltip>
							</>
						) : null}
					</div>
				) : null}
			</div>
			<div className="flex items-center gap-2">
				<GitDropdownMenu
					gitInfo={gitInfo}
					worktreeName={worktreeName}
					status={status}
					connected={connected}
					onSendPrompt={onSendPrompt}
					onRemoveWorktree={onRemoveWorktree}
				/>

				<ButtonGroup>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								onClick={() =>
									previewIsOpen ? previewClose() : previewOpen(previewUrl || "")
								}
								className={cn(previewIsOpen && "bg-muted text-primary")}
								aria-label="웹 미리보기"
							>
								<Globe className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>웹 미리보기</TooltipContent>
					</Tooltip>
					<SessionDropdownMenu
						sessionId={sessionId}
						isArchived={isArchived}
						gitInfo={gitInfo}
						worktreeName={worktreeName}
						onOpenSettings={() => onSettingsOpenChange(true)}
						onArchive={onArchive}
						onUnarchive={onUnarchive}
						onDelete={onDelete}
						onFork={onFork}
						onConvertToWorktree={onConvertToWorktree}
					/>
					<Sheet
						open={filesOpen}
						onOpenChange={onFilesOpenChange}
						modal={!portalContainer}
					>
						<Tooltip>
							<TooltipTrigger asChild>
								<SheetTrigger asChild>
									<Button
										variant="outline"
										size="icon"
										className={cn("relative", filesOpen && "bg-muted")}
										aria-label="파일 변경 패널"
									>
										<FolderOpen className="h-4 w-4" />
										{uniqueFileCount > 0 ? (
											<span className="absolute -top-1 -right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
												{uniqueFileCount > 99 ? "99+" : uniqueFileCount}
											</span>
										) : null}
									</Button>
								</SheetTrigger>
							</TooltipTrigger>
							<TooltipContent>파일 변경</TooltipContent>
						</Tooltip>
						<SheetContent
							side="right"
							container={portalContainer}
							className="w-full sm:w-[480px] sm:max-w-[calc(100%-2rem)] bg-card border-border flex flex-col p-0"
						>
							<SheetHeader className="sr-only">
								<SheetTitle>File Changes</SheetTitle>
								<SheetDescription>세션에서 변경된 파일 목록</SheetDescription>
							</SheetHeader>
							<FilePanel
								sessionId={sessionId}
								fileChanges={fileChanges}
								onFileClick={onFileClick}
							/>
						</SheetContent>
					</Sheet>
				</ButtonGroup>

				<SessionSettings
					sessionId={sessionId}
					open={settingsOpen}
					onOpenChange={onSettingsOpenChange}
					portalContainer={portalContainer}
				/>
			</div>
		</div>
	);
});
