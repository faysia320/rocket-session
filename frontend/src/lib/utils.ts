import type { ReactNode } from "react";
import { createElement } from "react";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 타임스탬프를 HH:MM:SS 형식으로 변환 */
export function formatTime(ts?: string): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

/** 상대 시간 포맷 ("방금 전", "3분 전", "2시간 전", "1일 전") */
export function formatRelativeTime(input?: string | number | null): string {
  if (!input) return "";
  const ts = typeof input === "string" ? new Date(input).getTime() : input;
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전`;
  return `${Math.floor(months / 12)}년 전`;
}

/** 텍스트 내 검색어를 <mark>로 하이라이트하여 ReactNode 배열 반환 */
export function highlightText(text: string, query: string): ReactNode[] {
  if (!query || !text) return [text];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // split용 regex: g 플래그 사용 (split에서는 lastIndex 문제 없음)
  const splitRegex = new RegExp(`(${escaped})`, "gi");
  // test용 regex: g 플래그 제거 (lastIndex 상태 버그 방지)
  const testRegex = new RegExp(`^${escaped}$`, "i");
  const parts = text.split(splitRegex);
  return parts.map((part, i) =>
    testRegex.test(part)
      ? createElement(
          "mark",
          {
            key: i,
            className: "bg-primary/30 text-foreground rounded-sm px-0.5",
          },
          part,
        )
      : part,
  );
}

/**
 * 경로를 최대 길이로 잘라서 말줄임표 표시.
 * 중간 디렉토리를 "…"으로 대체합니다.
 */
export function truncatePath(path: string, maxLen = 40): string {
  if (path.length <= maxLen) return path;
  const parts = path.split("/");
  if (parts.length <= 2) return "…" + path.slice(-(maxLen - 1));
  const first = parts[0] || "/";
  const last = parts[parts.length - 1];
  return first + "/…/" + last;
}

/**
 * work_dir 경로에서 표시용 이름을 추출합니다.
 * /workspaces/ 접두사가 있으면 레포 이름만 반환하고,
 * 그 외 경로는 truncatePath로 폴백합니다.
 */
export function formatWorkDir(path: string, maxLen = 40): string {
  const prefix = "/workspaces/";
  if (path.startsWith(prefix)) {
    const rest = path.slice(prefix.length);
    const segments = rest.split("/");
    const repoName = segments[0];
    if (segments.length >= 4 && segments[1] === ".claude" && segments[2] === "worktrees") {
      return `${repoName} (worktree: ${segments[3]})`;
    }
    return repoName;
  }
  return truncatePath(path, maxLen);
}

/**
 * 토큰 수를 1K/1M 단위로 포맷합니다.
 */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

/**
 * 세션 목록을 running 상태가 앞에 오도록 정렬합니다.
 */
export function sortSessionsByStatus<T extends { status: string }>(sessions: T[]): T[] {
  const running = sessions.filter((s) => s.status === "running");
  const others = sessions.filter((s) => s.status !== "running");
  return [...running, ...others];
}
