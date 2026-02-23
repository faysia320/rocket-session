import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Users, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTeamDetail, useDeleteTeam, useTeamMembers } from "../hooks/useTeams";
import { useTeamSocket } from "../hooks/useTeamSocket";
import { TeamMemberList } from "./TeamMemberList";
import { TeamMessagePanel } from "./TeamMessagePanel";
import { TeamStatusBar } from "./TeamStatusBar";
import { TeamTaskBoard } from "./TeamTaskBoard";
import { useSessions } from "@/features/session/hooks/useSessions";
import type { SessionInfo } from "@/types";

interface TeamDashboardProps {
  teamId: string;
}

export function TeamDashboard({ teamId }: TeamDashboardProps) {
  const navigate = useNavigate();
  const { data: team, isLoading, isError } = useTeamDetail(teamId);
  const deleteTeam = useDeleteTeam();
  const { addMember, removeMember, setLead, isAddingMember } = useTeamMembers(teamId);
  const { sessions } = useSessions();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  // 팀 실시간 WebSocket 연결 (이벤트 수신 → 쿼리 캐시 자동 무효화)
  useTeamSocket(teamId);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="font-mono text-sm text-muted-foreground animate-pulse">로딩 중…</span>
      </div>
    );
  }

  if (isError || !team) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="font-mono text-sm text-destructive/80">팀을 불러올 수 없습니다</span>
      </div>
    );
  }

  const memberSessionIds = new Set(team.members.map((m) => m.session_id));
  const availableSessions = sessions.filter(
    (s) => !memberSessionIds.has(s.id) && s.status !== "archived",
  );

  const statusColor = {
    active: "bg-success",
    completed: "bg-info",
    paused: "bg-warning",
    archived: "bg-muted-foreground/40",
  }[team.status] ?? "bg-muted-foreground";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary/70" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono text-lg font-semibold">{team.name}</h1>
                <Badge variant="outline" className="font-mono text-2xs">
                  <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", statusColor)} />
                  {team.status}
                </Badge>
              </div>
              {team.description ? (
                <p className="font-mono text-xs text-muted-foreground mt-0.5">
                  {team.description}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              className="font-mono text-xs"
              onClick={() => setDeleteOpen(true)}
              aria-label="팀 삭제"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <TeamStatusBar taskSummary={team.task_summary} className="mt-3" />
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* 팀 정보 */}
          <section>
            <div className="font-mono text-xs text-muted-foreground mb-2">작업 디렉토리</div>
            <div className="font-mono text-sm bg-muted/30 px-3 py-2 rounded border border-border">
              {team.work_dir}
            </div>
          </section>

          {/* 멤버 */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs text-muted-foreground tracking-widest">
                멤버 ({team.members.length})
              </span>
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-2xs gap-1"
                onClick={() => setAddMemberOpen(true)}
              >
                <Plus className="h-3 w-3" />
                멤버 추가
              </Button>
            </div>
            <TeamMemberList
              members={team.members}
              leadSessionId={team.lead_session_id}
              onRemove={removeMember}
              onSetLead={(sessionId) => setLead({ session_id: sessionId })}
              onSelectSession={(id) =>
                navigate({ to: "/session/$sessionId", params: { sessionId: id } })
              }
            />
          </section>

          {/* 태스크 보드 */}
          <section>
            <TeamTaskBoard teamId={teamId} members={team.members} />
          </section>

          {/* 팀 메시지 */}
          <section>
            <TeamMessagePanel
              teamId={teamId}
              members={team.members}
              leadSessionId={team.lead_session_id}
            />
          </section>
        </div>
      </ScrollArea>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono text-sm">팀을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-xs">
              "{team.name}" 팀이 삭제됩니다. 팀에 속한 세션은 삭제되지 않습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono text-xs">취소</AlertDialogCancel>
            <AlertDialogAction
              className="font-mono text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTeam.mutate(teamId)}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 멤버 추가 다이얼로그 */}
      <AddMemberDialog
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        availableSessions={availableSessions}
        onAdd={async (sessionId, nickname) => {
          await addMember({ session_id: sessionId, nickname: nickname || undefined });
          setAddMemberOpen(false);
        }}
        isAdding={isAddingMember}
      />
    </div>
  );
}

function AddMemberDialog({
  open,
  onOpenChange,
  availableSessions,
  onAdd,
  isAdding,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableSessions: SessionInfo[];
  onAdd: (sessionId: string, nickname: string) => void;
  isAdding: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [nickname, setNickname] = useState("");

  const handleAdd = () => {
    if (!selectedId) return;
    onAdd(selectedId, nickname);
    setSelectedId("");
    setNickname("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">기존 세션을 멤버로 추가</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-muted-foreground">세션 선택</label>
            {availableSessions.length === 0 ? (
              <div className="font-mono text-xs text-muted-foreground/70 py-2">
                추가 가능한 세션이 없습니다
              </div>
            ) : (
              <ScrollArea className="max-h-48">
                <div className="space-y-1">
                  {availableSessions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-sm font-mono text-xs border border-transparent hover:bg-muted/50 transition-colors",
                        selectedId === s.id && "bg-muted border-primary/30",
                      )}
                      onClick={() => setSelectedId(s.id)}
                    >
                      <div className="font-medium">{s.name || s.id}</div>
                      <div className="text-2xs text-muted-foreground">{s.work_dir}</div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-muted-foreground">닉네임 (선택)</label>
            <input
              className="w-full font-mono text-sm bg-input border border-border rounded px-3 py-2 outline-none focus:border-primary/50"
              placeholder="예: frontend-agent"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>
          <Button
            className="w-full font-mono text-sm"
            onClick={handleAdd}
            disabled={!selectedId || isAdding}
          >
            {isAdding ? "추가 중…" : "멤버 추가"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
