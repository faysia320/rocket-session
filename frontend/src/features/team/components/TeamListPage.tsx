import { memo, useMemo } from "react";
import { useLocation } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useTeams } from "../hooks/useTeams";
import { TeamCard } from "./TeamCard";
import { TeamCreateDialog } from "./TeamCreateDialog";
import { Button } from "@/components/ui/button";

export const TeamListPage = memo(function TeamListPage() {
  const { teams, isLoading } = useTeams();
  const location = useLocation();

  const activeTeamId = useMemo(() => {
    const match = location.pathname.match(/\/team\/([^/]+)/);
    return match?.[1] ?? null;
  }, [location.pathname]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="font-mono text-sm text-muted-foreground animate-pulse">로딩 중…</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-mono text-lg font-semibold text-foreground">Agent Teams</h1>
            <p className="font-mono text-xs text-muted-foreground">{teams.length}개 팀</p>
          </div>
          <TeamCreateDialog>
            <Button variant="default" size="sm" className="font-mono text-xs">
              + New Team
            </Button>
          </TeamCreateDialog>
        </div>

        {teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h2 className="font-mono text-sm font-semibold text-foreground mb-1">
              아직 팀이 없습니다
            </h2>
            <p className="font-mono text-xs text-muted-foreground mb-4 max-w-sm">
              Agent Team을 생성하여 여러 Claude 에이전트가 협력하는 워크플로우를 구성하세요.
            </p>
            <TeamCreateDialog>
              <Button variant="default" size="sm" className="font-mono text-xs">
                첫 번째 팀 만들기
              </Button>
            </TeamCreateDialog>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {teams.map((t) => (
              <TeamCard key={t.id} team={t} isActive={t.id === activeTeamId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
