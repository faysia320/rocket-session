import { useState } from "react";
import { FolderGit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DirectoryBrowser } from "@/features/directory/components/DirectoryBrowser";

interface GitRepoSelectorProps {
  value: string;
  onChange: (path: string) => void;
}

function truncatePath(path: string, maxLen = 30): string {
  if (path.length <= maxLen) return path;
  const parts = path.split("/");
  if (parts.length <= 2) return path;
  return `…/${parts.slice(-2).join("/")}`;
}

export function GitRepoSelector({ value, onChange }: GitRepoSelectorProps) {
  const [browserOpen, setBrowserOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="font-mono text-2xs text-muted-foreground truncate max-w-[200px] text-left hover:text-foreground transition-colors"
        onClick={() => setBrowserOpen(true)}
        title={value || "클릭하여 저장소 선택"}
      >
        {value ? truncatePath(value) : "저장소 선택…"}
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={() => setBrowserOpen(true)}
        aria-label="Git 저장소 경로 선택"
      >
        <FolderGit2 className="h-3.5 w-3.5" />
      </Button>
      <DirectoryBrowser
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        initialPath={value || "~"}
        onSelect={(path) => {
          onChange(path);
          setBrowserOpen(false);
        }}
      />
    </>
  );
}
