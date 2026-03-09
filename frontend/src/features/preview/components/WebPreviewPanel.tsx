import { memo, useCallback, useRef, useState, useEffect } from "react";
import {
  GripHorizontal,
  X,
  Minus,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreviewStore } from "@/store";
import { useIsMobile } from "@/hooks/useMediaQuery";

const DEFAULT_W = 640;
const DEFAULT_H = 480;
const MIN_W = 320;
const MIN_H = 240;

const DEFAULT_STYLE = { bottom: 48, right: 16 };

export const WebPreviewPanel = memo(function WebPreviewPanel() {
  const isOpen = usePreviewStore((s) => s.isOpen);
  const url = usePreviewStore((s) => s.url);
  const position = usePreviewStore((s) => s.position);
  const size = usePreviewStore((s) => s.size);
  const closePreview = usePreviewStore((s) => s.closePreview);
  const setUrl = usePreviewStore((s) => s.setUrl);
  const setPosition = usePreviewStore((s) => s.setPosition);
  const setSize = usePreviewStore((s) => s.setSize);
  const isMobile = useIsMobile();

  const [inputUrl, setInputUrl] = useState(url);
  const [iframeKey, setIframeKey] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // url prop 변경 시 inputUrl 동기화
  useEffect(() => {
    setInputUrl(url);
  }, [url]);

  // — 드래그 —
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      if ((e.target as HTMLElement).closest("input")) return;
      dragging.current = true;
      const panelEl = (e.currentTarget as HTMLElement).closest(
        "[data-preview-panel]",
      ) as HTMLElement;
      const rect = panelEl.getBoundingClientRect();
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const x = Math.max(
        0,
        Math.min(e.clientX - dragOffset.current.x, window.innerWidth - size.w),
      );
      const y = Math.max(
        0,
        Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 40),
      );
      setPosition({ x, y });
    },
    [setPosition, size.w],
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // — 리사이즈 —
  const resizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      resizing.current = true;
      resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [size],
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizing.current) return;
      const dw = e.clientX - resizeStart.current.x;
      const dh = e.clientY - resizeStart.current.y;
      setSize({
        w: Math.max(MIN_W, resizeStart.current.w + dw),
        h: Math.max(MIN_H, resizeStart.current.h + dh),
      });
    },
    [setSize],
  );

  const handleResizePointerUp = useCallback(() => {
    resizing.current = false;
  }, []);

  // — 네비게이션 —
  const handleNavigate = useCallback(() => {
    const trimmed = inputUrl.trim();
    if (!trimmed) return;
    const finalUrl =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `http://${trimmed}`;
    setUrl(finalUrl);
    setInputUrl(finalUrl);
    setIframeKey((k) => k + 1);
  }, [inputUrl, setUrl]);

  const handleUrlKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleNavigate();
      }
    },
    [handleNavigate],
  );

  const handleRefresh = useCallback(() => {
    setIframeKey((k) => k + 1);
  }, []);

  const handleResetSize = useCallback(() => {
    setSize({ w: DEFAULT_W, h: DEFAULT_H });
  }, [setSize]);

  if (!isOpen) return null;

  const posStyle = isMobile
    ? {}
    : position
      ? { left: position.x, top: position.y }
      : DEFAULT_STYLE;

  const sizeStyle = isMobile ? {} : { width: size.w, height: isMinimized ? "auto" : size.h };

  return (
    <div
      data-preview-panel
      className="fixed flex flex-col inset-0 pt-safe pb-safe px-safe md:inset-auto md:rounded-lg md:pt-0 md:pb-0 md:px-0 border-border bg-background md:border md:shadow-lg overflow-hidden"
      style={{ zIndex: 54, ...posStyle, ...sizeStyle }}
    >
      {/* 헤더 — 드래그 핸들 */}
      <div
        className="flex items-center justify-between px-2 h-8 shrink-0 border-b border-border select-none md:cursor-grab md:active:cursor-grabbing bg-secondary"
        onPointerDown={isMobile ? undefined : handlePointerDown}
        onPointerMove={isMobile ? undefined : handlePointerMove}
        onPointerUp={isMobile ? undefined : handlePointerUp}
      >
        <div className="flex items-center gap-1.5">
          <GripHorizontal className="h-3 w-3 text-muted-foreground hidden md:block" />
          <Globe className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-medium font-mono">Preview</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 hidden md:inline-flex"
            onClick={() => setIsMinimized((v) => !v)}
            aria-label={isMinimized ? "펼치기" : "최소화"}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 hidden md:inline-flex"
            onClick={handleResetSize}
            aria-label="기본 크기"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={closePreview}
            aria-label="미리보기 닫기"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* 네비게이션 바 */}
      {!isMinimized ? (
        <>
          <div className="flex items-center gap-1 px-1.5 py-1 border-b border-border bg-secondary/50 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => {
                try {
                  iframeRef.current?.contentWindow?.history.back();
                } catch {
                  /* cross-origin */
                }
              }}
              aria-label="뒤로"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => {
                try {
                  iframeRef.current?.contentWindow?.history.forward();
                } catch {
                  /* cross-origin */
                }
              }}
              aria-label="앞으로"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={handleRefresh}
              aria-label="새로고침"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={handleUrlKeyDown}
              placeholder="http://localhost:3000"
              className="flex-1 min-w-0 h-6 px-2 font-mono text-xs bg-input border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => {
                if (url) window.open(url, "_blank");
              }}
              aria-label="외부 브라우저에서 열기"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>

          {/* iframe 콘텐츠 */}
          {url ? (
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={url}
              className="flex-1 w-full border-none bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              title="Web Preview"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-2">
                <Globe className="h-8 w-8 mx-auto opacity-30" />
                <p className="font-mono text-xs">URL을 입력하거나 Bash 출력의 링크를 클릭하세요</p>
              </div>
            </div>
          )}

          {/* 리사이즈 핸들 (데스크톱) */}
          {!isMobile ? (
            <div
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize touch-none"
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              aria-hidden
            >
              <svg
                className="w-3 h-3 m-0.5 text-muted-foreground/40"
                viewBox="0 0 12 12"
                fill="currentColor"
              >
                <circle cx="9" cy="9" r="1.5" />
                <circle cx="5" cy="9" r="1.5" />
                <circle cx="9" cy="5" r="1.5" />
              </svg>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
});
