import { memo } from "react";

interface ChatSearchBarProps {
  searchQuery: string;
  searchMatchIndex: number;
  searchMatchCount: number;
  onQueryChange: (query: string) => void;
  onMatchIndexChange: (index: number | ((prev: number) => number)) => void;
  onClose: () => void;
}

export const ChatSearchBar = memo(function ChatSearchBar({
  searchQuery,
  searchMatchIndex,
  searchMatchCount,
  onQueryChange,
  onMatchIndexChange,
  onClose,
}: ChatSearchBarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary/50">
      <input
        className="flex-1 font-mono text-[16px] sm:text-md bg-input border border-border rounded px-2 py-1 outline-none focus:border-primary/50"
        placeholder="메시지 검색…"
        aria-label="메시지 검색"
        value={searchQuery}
        onChange={(e) => {
          onQueryChange(e.target.value);
          onMatchIndexChange(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onMatchIndexChange((prev) =>
              searchMatchCount > 0
                ? (prev + 1) % searchMatchCount
                : 0,
            );
          }
          if (e.key === "Escape") onClose();
        }}
        autoFocus
      />
      <span
        className="font-mono text-xs text-muted-foreground shrink-0"
        aria-live="polite"
      >
        {searchMatchCount > 0
          ? `${searchMatchIndex + 1}/${searchMatchCount}`
          : searchQuery
            ? "0 results"
            : ""}
      </span>
      <button
        type="button"
        className="font-mono text-xs text-muted-foreground hover:text-foreground px-1"
        onClick={() =>
          onMatchIndexChange((p) =>
            p > 0 ? p - 1 : searchMatchCount - 1,
          )
        }
        disabled={searchMatchCount === 0}
        aria-label="이전 검색 결과"
      >
        {"\u25B2"}
      </button>
      <button
        type="button"
        className="font-mono text-xs text-muted-foreground hover:text-foreground px-1"
        onClick={() =>
          onMatchIndexChange(
            (p) => (p + 1) % Math.max(searchMatchCount, 1),
          )
        }
        disabled={searchMatchCount === 0}
        aria-label="다음 검색 결과"
      >
        {"\u25BC"}
      </button>
      <button
        type="button"
        className="font-mono text-md text-muted-foreground hover:text-foreground px-1 ml-1"
        onClick={onClose}
        aria-label="검색 닫기"
      >
        {"\u00D7"}
      </button>
    </div>
  );
});
