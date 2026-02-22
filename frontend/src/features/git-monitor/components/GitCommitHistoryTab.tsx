import { useState, useCallback } from "react";
import { Loader2, Search, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useGitLog } from "../hooks/useGitLog";
import { GitCommitItem } from "./GitCommitItem";

interface GitCommitHistoryTabProps {
  repoPath: string;
}

const PAGE_SIZE = 30;

export function GitCommitHistoryTab({ repoPath }: GitCommitHistoryTabProps) {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isError } = useGitLog(repoPath, {
    limit: PAGE_SIZE,
    offset,
    search: appliedSearch || undefined,
  });

  const handleSearch = useCallback(() => {
    setAppliedSearch(search);
    setOffset(0);
  }, [search]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSearch();
      }
    },
    [handleSearch],
  );

  if (isError) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-destructive">
        <AlertCircle className="h-4 w-4" />
        <span className="font-mono text-sm">커밋 히스토리 로드 실패</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 검색 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="커밋 메시지 검색…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-8 h-8 font-mono text-xs"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 font-mono text-xs"
          onClick={handleSearch}
          aria-label="검색"
        >
          검색
        </Button>
      </div>

      {/* 커밋 수 표시 */}
      {data ? (
        <div className="font-mono text-2xs text-muted-foreground">
          {appliedSearch
            ? `"${appliedSearch}" 검색 결과`
            : `전체 ${data.total_count.toLocaleString()}개 커밋`}
          {offset > 0 ? ` (${offset + 1}~${offset + data.commits.length})` : ""}
        </div>
      ) : null}

      {/* 로딩 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : data?.error ? (
        <div className="flex items-center justify-center gap-2 py-12 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="font-mono text-sm">{data.error}</span>
        </div>
      ) : data?.commits.length === 0 ? (
        <div className="font-mono text-sm text-muted-foreground py-8 text-center">
          {appliedSearch ? "검색 결과가 없습니다" : "커밋이 없습니다"}
        </div>
      ) : (
        <>
          {/* 커밋 목록 */}
          <div className="space-y-1">
            {data?.commits.map((commit) => (
              <GitCommitItem
                key={commit.full_hash}
                repoPath={repoPath}
                commit={commit}
              />
            ))}
          </div>

          {/* 페이지네이션 */}
          <div className="flex items-center justify-center gap-2 pt-2">
            {offset > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs"
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                aria-label="이전 페이지"
              >
                이전
              </Button>
            ) : null}
            {data?.has_more ? (
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs"
                onClick={() => setOffset(offset + PAGE_SIZE)}
                aria-label="다음 페이지"
              >
                다음
              </Button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
