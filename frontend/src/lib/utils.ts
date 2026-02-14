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
