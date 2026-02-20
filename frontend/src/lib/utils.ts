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

/** 텍스트 내 검색어를 <mark>로 하이라이트하여 ReactNode 배열 반환 */
export function highlightText(text: string, query: string): ReactNode[] {
  if (!query || !text) return [text];
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part)
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
