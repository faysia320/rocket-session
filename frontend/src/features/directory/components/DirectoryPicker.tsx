import { useState } from "react";
import { FolderOpen, Star, StarOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useGitInfo } from "../hooks/useGitInfo";
import { useFavoriteDirectories } from "../hooks/useFavoriteDirectories";
import { useGlobalSettings } from "@/features/settings/hooks/useGlobalSettings";
import { GitInfoCard } from "./GitInfoCard";
import { DirectoryBrowser } from "./DirectoryBrowser";
import { WorktreePanel } from "./WorktreePanel";

interface DirectoryPickerProps {
  value: string;
  onChange: (path: string) => void;
}

export function DirectoryPicker({ value, onChange }: DirectoryPickerProps) {
  const { data: globalSettings } = useGlobalSettings();
  const [browserOpen, setBrowserOpen] = useState(false);
  const { gitInfo, isLoading } = useGitInfo(value);
  const { isFavorite, toggleFavorite } = useFavoriteDirectories();

  const hasTrimmedValue = value.trim().length > 0;
  const starred = hasTrimmedValue && isFavorite(value.trim());

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        <Input
          className="font-mono text-xs flex-1"
          placeholder="Working directory (required)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => toggleFavorite(value.trim())}
          disabled={!hasTrimmedValue}
          aria-label={starred ? "즐겨찾기 해제" : "즐겨찾기 추가"}
        >
          {starred ? (
            <Star className="h-3.5 w-3.5 text-warning fill-warning" />
          ) : (
            <StarOff className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => setBrowserOpen(true)}
          aria-label="디렉토리 탐색"
        >
          <FolderOpen className="h-3.5 w-3.5" />
        </Button>
      </div>

      {gitInfo?.is_git_repo ? (
        <>
          <GitInfoCard gitInfo={gitInfo} />
          <WorktreePanel repoPath={value} onChange={onChange} />
        </>
      ) : isLoading && value.length > 0 ? (
        <div className="font-mono text-[10px] text-muted-foreground/70 px-1">
          Git 정보 로딩 중…
        </div>
      ) : null}

      <DirectoryBrowser
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        initialPath={value || globalSettings?.root_dir || "~"}
        onSelect={onChange}
      />
    </div>
  );
}
