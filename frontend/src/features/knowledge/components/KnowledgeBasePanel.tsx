import { useState, useCallback } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspaces } from "@/features/workspace/hooks/useWorkspaces";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { KnowledgeWorkspaceList } from "./KnowledgeWorkspaceList";
import { KnowledgeContent } from "./KnowledgeContent";

export function KnowledgeBasePanel() {
  const { data: workspaces, isLoading } = useWorkspaces();
  const isMobile = useIsMobile();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

  const readyWorkspaces = workspaces ?? [];

  const selectedWorkspace =
    readyWorkspaces.find((ws) => ws.id === selectedWorkspaceId) ?? readyWorkspaces[0] ?? null;
  const effectiveId = selectedWorkspace?.id ?? null;

  const handleSelect = useCallback((id: string) => setSelectedWorkspaceId(id), []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-mono text-lg font-semibold text-foreground">Knowledge Base</h1>
            <p className="font-mono text-xs text-muted-foreground">
              {isLoading
                ? "로딩 중…"
                : readyWorkspaces.length > 0
                  ? `${readyWorkspaces.length}개 워크스페이스`
                  : "워크스페이스가 없습니다"}
            </p>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* 데스크톱: 좌측 사이드바 */}
          {!isMobile ? (
            <KnowledgeWorkspaceList
              workspaces={readyWorkspaces}
              selectedId={effectiveId}
              onSelect={handleSelect}
            />
          ) : null}

          {/* 메인 영역 */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* 모바일: 워크스페이스 셀렉트 */}
            {isMobile ? (
              <div className="px-4 py-2 border-b border-border shrink-0">
                <Select value={effectiveId ?? ""} onValueChange={handleSelect}>
                  <SelectTrigger className="h-8 font-mono text-xs">
                    <SelectValue placeholder="워크스페이스 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {readyWorkspaces.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id} className="font-mono text-xs">
                        {ws.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {/* 선택된 워크스페이스 콘텐츠 */}
            {selectedWorkspace ? (
              <KnowledgeContent workspaceId={selectedWorkspace.id} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2">
                <BookOpen className="h-10 w-10 text-muted-foreground/20" />
                <span className="font-mono text-sm text-muted-foreground">
                  좌측에서 워크스페이스를 선택하세요
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
