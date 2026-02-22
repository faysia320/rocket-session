/**
 * 세션 히스토리 페이지.
 * 검색, 필터(상태/태그/날짜), 정렬, 페이징 지원.
 */
import { useState, useMemo, useCallback, useRef, useEffect, memo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Calendar,
  Tag,
  Filter,
  FileSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn, truncatePath } from "@/lib/utils";
import { useSessionSearch } from "../hooks/useSessionSearch";
import { useTags } from "@/features/tags/hooks/useTags";
import { TagBadgeList } from "@/features/tags/components/TagBadgeList";
import { TagManagerDialog } from "@/features/tags/components/TagManagerDialog";
import type { SessionInfo, TagInfo } from "@/types";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "", label: "전체 상태" },
  { value: "idle", label: "Idle" },
  { value: "running", label: "Running" },
  { value: "error", label: "Error" },
  { value: "stopped", label: "Stopped" },
  { value: "archived", label: "Archived" },
] as const;

const SORT_OPTIONS = [
  { value: "created_at", label: "생성일" },
  { value: "name", label: "이름" },
  { value: "message_count", label: "메시지 수" },
  { value: "status", label: "상태" },
] as const;

export function HistoryPage() {
  const navigate = useNavigate();

  // 필터 상태 (URL search params 대신 로컬 상태 → 추후 확장 가능)
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [ftsMode, setFtsMode] = useState(false);
  const [status, setStatus] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  // F#7: useRef + setTimeout 디바운스 (state 기반 타이머 제거 → 불필요한 리렌더 방지)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        setDebouncedQuery(value);
        setPage(0);
      }, 300);
    },
    [],
  );

  // cleanup: 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const searchParams = useMemo(
    () => ({
      q: !ftsMode && debouncedQuery ? debouncedQuery : undefined,
      fts: ftsMode && debouncedQuery ? debouncedQuery : undefined,
      status: status || undefined,
      tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      sort,
      order,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      include_tags: true,
    }),
    [debouncedQuery, ftsMode, status, selectedTagIds, dateFrom, dateTo, sort, order, page],
  );

  const { data, isLoading, isError } = useSessionSearch(searchParams);
  const { data: allTags = [] } = useTags();

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const hasActiveFilters =
    !!status || selectedTagIds.length > 0 || !!dateFrom || !!dateTo;

  const clearFilters = () => {
    setQuery("");
    setDebouncedQuery("");
    setFtsMode(false);
    setStatus("");
    setSelectedTagIds([]);
    setDateFrom("");
    setDateTo("");
    setPage(0);
  };

  const toggleSort = (col: string) => {
    if (sort === col) {
      setOrder((o) => (o === "desc" ? "asc" : "desc"));
    } else {
      setSort(col);
      setOrder("desc");
    }
    setPage(0);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
    setPage(0);
  };

  const handleSessionClick = useCallback(
    (sessionId: string) => {
      navigate({
        to: "/session/$sessionId",
        params: { sessionId },
      });
    },
    [navigate],
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-mono text-lg font-semibold text-foreground">
              Session History
            </h1>
            <p className="font-mono text-xs text-muted-foreground">
              {data ? `${data.total}개 세션` : "로딩 중…"}
            </p>
          </div>
          <TagManagerDialog
            trigger={
              <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                태그 관리
              </Button>
            }
          />
        </div>

        {/* 검색 + 필터 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 검색어 + 전문 검색 토글 */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={ftsMode ? "대화 내용으로 검색… (FTS)" : "세션 이름 또는 ID로 검색…"}
              className="pl-8 pr-8 h-8 font-mono text-xs"
              aria-label="세션 검색"
            />
            {query ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
                onClick={() => handleQueryChange("")}
                aria-label="검색 초기화"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {/* 전문 검색 토글 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 w-8 p-0 shrink-0",
                  ftsMode && "border-primary/30 bg-primary/10 text-primary",
                )}
                onClick={() => {
                  setFtsMode(!ftsMode);
                  setPage(0);
                }}
                aria-label={ftsMode ? "일반 검색으로 전환" : "전문 검색으로 전환"}
              >
                <FileSearch className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {ftsMode ? "전문 검색 켜짐 (대화 내용 포함)" : "전문 검색 (대화 내용)"}
            </TooltipContent>
          </Tooltip>

          {/* 상태 필터 */}
          <div className="flex gap-1">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  "font-mono text-2xs px-2 py-1 rounded-sm border transition-colors",
                  status === opt.value
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "text-muted-foreground border-transparent hover:bg-muted",
                )}
                onClick={() => {
                  setStatus(opt.value);
                  setPage(0);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 태그 필터 */}
          {allTags.length > 0 ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-7 gap-1 px-2 font-mono text-2xs",
                    selectedTagIds.length > 0 && "border-primary/30 text-primary",
                  )}
                >
                  <Tag className="h-3 w-3" />
                  태그{selectedTagIds.length > 0 ? ` (${selectedTagIds.length})` : ""}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                {allTags.map((tag: TagInfo) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                        selected && "bg-muted",
                      )}
                      onClick={() => toggleTag(tag.id)}
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 truncate text-left text-xs">
                        {tag.name}
                      </span>
                      {selected ? (
                        <span className="text-primary text-xs">✓</span>
                      ) : null}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          ) : null}

          {/* 날짜 필터 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-7 gap-1 px-2 font-mono text-2xs",
                  (dateFrom || dateTo) && "border-primary/30 text-primary",
                )}
              >
                <Calendar className="h-3 w-3" />
                날짜
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 space-y-2 p-3" align="start">
              <div>
                <label className="text-2xs text-muted-foreground">시작일</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(0);
                  }}
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <label className="text-2xs text-muted-foreground">종료일</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(0);
                  }}
                  className="h-7 text-xs"
                />
              </div>
            </PopoverContent>
          </Popover>

          {/* 정렬 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 font-mono text-2xs"
              >
                <ArrowUpDown className="h-3 w-3" />
                {SORT_OPTIONS.find((o) => o.value === sort)?.label}
                {order === "asc" ? " ↑" : " ↓"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-1" align="start">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-muted",
                    sort === opt.value && "text-primary",
                  )}
                  onClick={() => toggleSort(opt.value)}
                >
                  <span>{opt.label}</span>
                  {sort === opt.value ? (
                    <span>{order === "asc" ? "↑" : "↓"}</span>
                  ) : null}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* 필터 초기화 */}
          {hasActiveFilters ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 font-mono text-2xs text-muted-foreground"
              onClick={clearFilters}
            >
              <Filter className="h-3 w-3" />
              필터 초기화
            </Button>
          ) : null}
        </div>
      </div>

      {/* 결과 목록 */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-md animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center h-full">
            <p className="font-mono text-sm text-destructive">
              검색 결과를 불러올 수 없습니다
            </p>
          </div>
        ) : data?.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Search className="h-10 w-10 text-muted-foreground/30" />
            <p className="font-mono text-sm text-muted-foreground">
              검색 결과가 없습니다
            </p>
            {hasActiveFilters ? (
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs"
                onClick={clearFilters}
              >
                필터 초기화
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data?.items.map((session) => (
              <HistorySessionRow
                key={session.id}
                session={session}
                onClick={handleSessionClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* 페이징 */}
      {totalPages > 1 ? (
        <div className="shrink-0 flex items-center justify-center gap-2 border-t border-border py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            aria-label="이전 페이지"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-mono text-xs text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            aria-label="다음 페이지"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** F#8: memo로 감싸 부모 리렌더 시 불필요한 행 렌더링 방지 */
const HistorySessionRow = memo(function HistorySessionRow({
  session,
  onClick,
}: {
  session: SessionInfo;
  onClick: (sessionId: string) => void;
}) {
  const statusColors: Record<string, string> = {
    running: "bg-success",
    error: "bg-destructive",
    idle: "bg-muted-foreground",
    stopped: "bg-muted-foreground/50",
    archived: "bg-muted-foreground/30",
  };

  const created = session.created_at
    ? new Date(session.created_at).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const handleClick = useCallback(() => {
    onClick(session.id);
  }, [onClick, session.id]);

  return (
    <button
      type="button"
      className="w-full text-left px-6 py-3 hover:bg-muted/50 transition-colors"
      onClick={handleClick}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            statusColors[session.status] || "bg-muted-foreground",
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-sm font-medium text-foreground truncate">
              {session.name || session.id}
            </span>
            {session.model ? (
              <span className="font-mono text-2xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                {session.model}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-2xs text-muted-foreground font-mono">
            <span>{created}</span>
            <span>·</span>
            <span>{session.message_count} msgs</span>
            <span>·</span>
            <span>{session.file_changes_count} changes</span>
            <span>·</span>
            <span className="truncate">{truncatePath(session.work_dir)}</span>
          </div>
          {session.tags && session.tags.length > 0 ? (
            <div className="mt-1">
              <TagBadgeList tags={session.tags} max={5} size="sm" />
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
});
