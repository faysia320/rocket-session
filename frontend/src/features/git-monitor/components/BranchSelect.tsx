import { useState } from "react";
import { Check, ChevronsUpDown, GitBranch, Loader2, RefreshCw } from "lucide-react";
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
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useGitBranches, useCheckoutBranch, useFetchRemote } from "../hooks/useGitActions";

interface BranchSelectProps {
  repoPath: string;
  currentBranch: string | null;
  disabled?: boolean;
}

export function BranchSelect({ repoPath, currentBranch, disabled }: BranchSelectProps) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useGitBranches(repoPath);
  const checkoutMutation = useCheckoutBranch(repoPath);
  const fetchMutation = useFetchRemote(repoPath);

  const branches = data?.branches ?? [];

  const handleSelect = (branch: string) => {
    if (branch === currentBranch) {
      setOpen(false);
      return;
    }
    checkoutMutation.mutate(branch, {
      onSettled: () => setOpen(false),
    });
  };

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
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <div className="flex items-center gap-1 px-1">
            <CommandInput placeholder="브랜치 검색..." className="h-8 text-xs flex-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              disabled={fetchMutation.isPending}
              onClick={(e) => {
                e.stopPropagation();
                fetchMutation.mutate();
              }}
              aria-label="원격 브랜치 갱신"
            >
              <RefreshCw className={cn("h-3 w-3", fetchMutation.isPending && "animate-spin")} />
            </Button>
          </div>
          <CommandList>
            <CommandEmpty className="py-3 text-xs">
              {isLoading ? (
                <span className="flex items-center justify-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> 로딩 중…
                </span>
              ) : (
                "브랜치를 찾을 수 없습니다"
              )}
            </CommandEmpty>
            <CommandGroup>
              {branches.map((branch) => (
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
                  {branch === currentBranch ? (
                    <Badge variant="secondary" className="ml-auto text-2xs px-1 py-0">
                      현재
                    </Badge>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
