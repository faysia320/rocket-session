import { Loader2 } from "lucide-react";
import { useGitInfo } from "@/features/directory/hooks/useGitInfo";
import { useGitStatus } from "../hooks/useGitStatus";
import { GitInfoCard } from "@/features/directory/components/GitInfoCard";
import { GitStatusFileList } from "./GitStatusFileList";

interface GitRepoStatusTabProps {
  repoPath: string;
}

export function GitRepoStatusTab({ repoPath }: GitRepoStatusTabProps) {
  const { gitInfo, isLoading: gitInfoLoading } = useGitInfo(repoPath);
  const { data: status, isLoading: statusLoading } = useGitStatus(repoPath);

  const isLoading = gitInfoLoading || statusLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!gitInfo?.is_git_repo) {
    return (
      <div className="font-mono text-sm text-muted-foreground py-8 text-center">
        이 디렉토리는 Git 저장소가 아닙니다
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <GitInfoCard gitInfo={gitInfo} />
      {status ? (
        <GitStatusFileList repoPath={repoPath} files={status.files} />
      ) : null}
    </div>
  );
}
