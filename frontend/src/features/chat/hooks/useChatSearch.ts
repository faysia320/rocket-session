import { useState, useCallback, useEffect, useMemo } from "react";
import type { Message } from "@/types";
import { computeSearchMatches } from "../utils/chatComputations";

interface UseChatSearchParams {
  messages: Message[];
  scrollToIndex?: (index: number, opts?: { align?: "start" | "center" | "end" | "auto" }) => void;
  isSplitView: boolean;
  focusedSessionId: string | null;
  sessionId: string;
}

export function useChatSearch({
  messages,
  scrollToIndex,
  isSplitView,
  focusedSessionId,
  sessionId,
}: UseChatSearchParams) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);

  const searchMatches = useMemo(
    () => computeSearchMatches(messages, searchQuery),
    [messages, searchQuery],
  );

  // 검색 결과 이동 시 스크롤
  useEffect(() => {
    if (searchMatches.length > 0 && searchMatchIndex < searchMatches.length) {
      scrollToIndex?.(searchMatches[searchMatchIndex], {
        align: "center",
      });
    }
  }, [searchMatchIndex, searchMatches, scrollToIndex]);

  const handleToggleSearch = useCallback(() => {
    setSearchOpen((prev) => {
      if (prev) {
        setSearchQuery("");
        setSearchMatchIndex(0);
      }
      return !prev;
    });
  }, []);

  // Ctrl+F / Cmd+F 검색 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        if (isSplitView && focusedSessionId !== sessionId) return;
        e.preventDefault();
        handleToggleSearch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleToggleSearch, isSplitView, focusedSessionId, sessionId]);

  return {
    searchOpen,
    searchQuery,
    searchMatchIndex,
    searchMatches,
    setSearchQuery,
    setSearchMatchIndex,
    handleToggleSearch,
  };
}
