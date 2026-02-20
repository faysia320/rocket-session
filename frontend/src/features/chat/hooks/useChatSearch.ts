import { useState, useCallback, useEffect, useMemo } from "react";
import type { Message } from "@/types";
import type { Virtualizer } from "@tanstack/react-virtual";
import { computeSearchMatches } from "../utils/chatComputations";

interface UseChatSearchParams {
  messages: Message[];
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  splitView: boolean;
  focusedSessionId: string | null;
  sessionId: string;
}

export function useChatSearch({
  messages,
  virtualizer,
  splitView,
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
      virtualizer.scrollToIndex(searchMatches[searchMatchIndex], {
        align: "center",
      });
    }
  }, [searchMatchIndex, searchMatches, virtualizer]);

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
        if (splitView && focusedSessionId !== sessionId) return;
        e.preventDefault();
        handleToggleSearch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleToggleSearch, splitView, focusedSessionId, sessionId]);

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
