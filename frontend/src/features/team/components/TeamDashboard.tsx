import { useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTeamDetail, useDeleteTeam, useTeamMembers } from "../hooks/useTeams";
import { useTeamSocket } from "../hooks/useTeamSocket";
import { TeamMemberList } from "./TeamMemberList";
import { TeamMessagePanel } from "./TeamMessagePanel";
import { TeamStatusBar } from "./TeamStatusBar";
import { TeamTaskBoard } from "./TeamTaskBoard";

interface TeamDashboardProps {
  teamId: string;
}

export function TeamDashboard({ teamId }: TeamDashboardProps) {
  const { data: team, isLoading, isError } = useTeamDetail(teamId);
  const deleteTeam = useDeleteTeam();
  const { addMember, removeMember, setLead, isAddingMember } = useTeamMembers(teamId);
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

  const statusColor =
    {
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
                <p className="font-mono text-xs text-muted-foreground mt-0.5">{team.description}</p>
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
              leadMemberId={team.lead_member_id}
              onRemove={removeMember}
              onSetLead={(memberId) => setLead({ member_id: memberId })}
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
              leadMemberId={team.lead_member_id}
            />
          </section>
        </div>
      </ScrollArea>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono text-sm">
              팀을 삭제하시겠습니까?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-xs">
              "{team.name}" 팀이 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
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

      {/* 멤버 추가 다이얼로그 (페르소나 정의) */}
      <AddMemberDialog
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        onAdd={async (data) => {
          await addMember(data);
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
  onAdd,
  isAdding,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: {
    nickname: string;
    description?: string;
    system_prompt?: string;
    model?: string;
    role?: "lead" | "member";
  }) => void;
  isAdding: boolean;
}) {
  const [nickname, setNickname] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState("");

  const handleAdd = () => {
    if (!nickname.trim()) return;
    onAdd({
      nickname: nickname.trim(),
      description: description.trim() || undefined,
      system_prompt: systemPrompt.trim() || undefined,
      model: model.trim() || undefined,
    });
    setNickname("");
    setDescription("");
    setSystemPrompt("");
    setModel("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">새 멤버 (페르소나) 추가</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-muted-foreground">닉네임 *</label>
            <Input
              className="font-mono text-sm"
              placeholder="예: backend-agent"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-muted-foreground">설명</label>
            <Input
              className="font-mono text-sm"
              placeholder="예: 백엔드 API 전문가"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-muted-foreground">모델</label>
            <Input
              className="font-mono text-sm"
              placeholder="예: sonnet (기본값: 글로벌 설정)"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-muted-foreground">시스템 프롬프트</label>
            <Textarea
              className="font-mono text-sm min-h-[80px] resize-none"
              placeholder="이 멤버의 역할과 지시사항을 입력하세요"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </div>
          <Button
            className="w-full font-mono text-sm"
            onClick={handleAdd}
            disabled={!nickname.trim() || isAdding}
          >
            {isAdding ? "추가 중…" : "멤버 추가"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
