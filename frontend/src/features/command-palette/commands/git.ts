import { GitCommitHorizontal, GitPullRequest, GitMerge } from "lucide-react";
import type { PaletteCommand } from "../types";

function dispatchPrompt(prompt: string) {
  window.dispatchEvent(
    new CustomEvent("command-palette:send-prompt", { detail: prompt }),
  );
}

export function createGitCommands(deps: {
  hasChanges: boolean;
}): PaletteCommand[] {
  const { hasChanges } = deps;

  return [
    {
      id: "git:commit",
      label: "Git 커밋",
      description: "변경사항을 분석하여 자동 커밋",
      category: "git",
      icon: GitCommitHorizontal,
      action: () => dispatchPrompt("/git-commit --no-history"),
      context: {
        requiresActiveSession: true,
        requiresGit: true,
        requiresRunning: false,
      },
      keywords: ["commit", "커밋", "git"],
    },
    {
      id: "git:pr",
      label: "GitHub PR 생성",
      description: "Pull Request 생성 (변경사항 자동 분석)",
      category: "git",
      icon: GitPullRequest,
      action: () => {
        if (hasChanges) {
          dispatchPrompt(
            "변경사항을 커밋하고 푸시한 후 GitHub PR을 생성해줘. gh pr create를 사용하고 PR 제목과 본문은 변경사항을 분석해서 작성해줘.",
          );
        } else {
          dispatchPrompt(
            "GitHub PR을 생성해줘. gh pr create를 사용하고 커밋 히스토리를 분석해서 PR 제목과 본문을 작성해줘.",
          );
        }
      },
      context: {
        requiresActiveSession: true,
        requiresGit: true,
        requiresRunning: false,
      },
      keywords: ["pr", "pull request", "github"],
    },
    {
      id: "git:rebase",
      label: "Git Rebase",
      description: "메인 브랜치에 리베이스",
      category: "git",
      icon: GitMerge,
      action: () => dispatchPrompt("/git-merge-rebase"),
      context: {
        requiresActiveSession: true,
        requiresGit: true,
        requiresRunning: false,
      },
      keywords: ["rebase", "merge", "리베이스"],
    },
  ];
}
