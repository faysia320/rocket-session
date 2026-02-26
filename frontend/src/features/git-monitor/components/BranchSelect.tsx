import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, GitBranch, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useGitBranches, useCheckoutBranch } from "../hooks/useGitActions";

interface BranchSelectProps {
  repoPath: string;
  currentBranch: string | null;
  disabled?: boolean;
}

/** 최근 브랜치 그룹에 표시할 최대 개수 */
const RECENT_BRANCH_LIMIT = 5;

export function BranchSelect({ repoPath, currentBranch, disabled }: BranchSelectProps) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useGitBranches(repoPath);
  const checkoutMutation = useCheckoutBranch(repoPath);

  const defaultBranch = data?.default_branch ?? null;

  // 브랜치를 3그룹으로 분류 (백엔드에서 committerdate 순 정렬 보장)
  const { defaultGroup, recentGroup, otherGroup } = useMemo(() => {
    const allBranches = data?.branches ?? [];
    const skip = new Set<string>();
    const def: string[] = [];
    const recent: string[] = [];
    const other: string[] = [];

    // 1. Default Branch
    if (defaultBranch && allBranches.includes(defaultBranch)) {
      def.push(defaultBranch);
      skip.add(defaultBranch);
    }

    // 2. Recent Branches (committerdate 순, default 제외, 최대 N개)
    for (const b of allBranches) {
      if (skip.has(b)) continue;
      if (recent.length < RECENT_BRANCH_LIMIT) {
        recent.push(b);
        skip.add(b);
      }
    }

    // 3. Other Branches (나머지)
    for (const b of allBranches) {
      if (!skip.has(b)) {
        other.push(b);
      }
    }

    return { defaultGroup: def, recentGroup: recent, otherGroup: other };
  }, [data?.branches, defaultBranch]);

  const handleSelect = (branch: string) => {
    if (branch === currentBranch) {
      setOpen(false);
      return;
    }
    checkoutMutation.mutate(branch, {
      onSettled: () => setOpen(false),
    });
  };

  const renderItem = (branch: string) => (
    <CommandItem
      key={branch}
      value={branch}
      onSelect={handleSelect}
      className="font-mono text-xs gap-2"
    >
      <Check
        className={cn(
          "h-3 w-3 shrink-0",
          branch === currentBranch ? "opacity-100" : "opacity-0",
        )}
      />
      {branch}
      {branch === defaultBranch ? (
        <Badge variant="secondary" className="ml-auto text-2xs px-1 py-0">
          default
        </Badge>
      ) : null}
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || checkoutMutation.isPending}
          className="h-6 gap-1 px-1.5 font-mono text-2xs shrink-0"
        >
          <GitBranch className="h-2.5 w-2.5" />
          {currentBranch ?? "detached"}
          <ChevronsUpDown className="h-2.5 w-2.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="브랜치 검색..." className="h-8 text-xs" />
          <CommandList className="max-h-60 overflow-y-auto">
            <CommandEmpty className="py-3 text-xs">
              {isLoading ? (
                <span className="flex items-center justify-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> 로딩 중…
                </span>
              ) : (
                "브랜치를 찾을 수 없습니다"
              )}
            </CommandEmpty>
            {defaultGroup.length > 0 ? (
              <CommandGroup heading="Default Branch">
                {defaultGroup.map(renderItem)}
              </CommandGroup>
            ) : null}
            {recentGroup.length > 0 ? (
              <>
                {defaultGroup.length > 0 ? <CommandSeparator /> : null}
                <CommandGroup heading="Recent Branches">
                  {recentGroup.map(renderItem)}
                </CommandGroup>
              </>
            ) : null}
            {otherGroup.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Other Branches">
                  {otherGroup.map(renderItem)}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
