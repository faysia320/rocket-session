import { memo } from "react";
import { Crown, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TeamMemberInfo } from "@/types";

interface TeamMemberListProps {
  members: TeamMemberInfo[];
  leadMemberId: number | null;
  onRemove?: (memberId: number) => void;
  onSetLead?: (memberId: number) => void;
}

export const TeamMemberList = memo(function TeamMemberList({
  members,
  leadMemberId,
  onRemove,
  onSetLead,
}: TeamMemberListProps) {
  if (members.length === 0) {
    return (
      <div className="py-6 text-center font-mono text-xs text-muted-foreground/70">
        아직 팀원이 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {members.map((m) => {
        const isLead = m.id === leadMemberId;
        return (
          <div
            key={m.id}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-sm border border-transparent hover:bg-muted/50 transition-colors",
              isLead && "border-primary/20 bg-primary/5",
            )}
          >
            {/* 역할 인디케이터 */}
            <span
              className={cn(
                "w-2 h-2 rounded-full shrink-0",
                isLead ? "bg-primary" : "bg-muted-foreground",
              )}
            />

            {/* 이름 + 페르소나 정보 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm truncate">
                  {m.nickname}
                </span>
                {isLead ? (
                  <Badge variant="outline" className="text-2xs px-1.5 py-0 text-primary border-primary/30">
                    <Crown className="h-2.5 w-2.5 mr-0.5" />
                    Lead
                  </Badge>
                ) : null}
              </div>
              <div className="font-mono text-2xs text-muted-foreground">
                {m.model || "default"}{m.description ? ` · ${m.description}` : ""}
              </div>
            </div>

            {/* 액션 */}
            <div className="flex items-center gap-0.5 shrink-0">
              {!isLead && onSetLead ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onSetLead(m.id)}
                      aria-label="리드로 지정"
                    >
                      <Crown className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="font-mono text-xs">리드로 지정</TooltipContent>
                </Tooltip>
              ) : null}
              {onRemove ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive/60 hover:text-destructive"
                      onClick={() => onRemove(m.id)}
                      aria-label="멤버 제거"
                    >
                      <UserMinus className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="font-mono text-xs">멤버 제거</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
});
