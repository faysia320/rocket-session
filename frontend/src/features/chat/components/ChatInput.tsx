import { memo, useState, useRef, useCallback, useEffect } from "react";
import { Send, Square, Image, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SlashCommandPopup } from "./SlashCommandPopup";
import { cn } from "@/lib/utils";
import { sessionsApi } from "@/lib/api/sessions.api";
import type { SessionMode } from "@/types";
import type { SlashCommand } from "../constants/slashCommands";
import type { useSlashCommands } from "../hooks/useSlashCommands";

interface PendingImage {
  file: File;
  preview: string;
}

interface ChatInputProps {
  connected: boolean;
  status: "idle" | "running" | "error";
  mode: SessionMode;
  slashCommands: ReturnType<typeof useSlashCommands>;
  onSubmit: (prompt: string, images?: string[]) => void;
  onStop: () => void;
  onModeToggle: () => void;
  onSlashCommand: (cmd: SlashCommand) => void;
  sessionId?: string;
  pendingAnswerCount?: number;
}

const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export const ChatInput = memo(function ChatInput({
  connected,
  status,
  mode,
  slashCommands,
  onSubmit,
  onStop,
  onModeToggle,
  onSlashCommand,
  sessionId,
  pendingAnswerCount = 0,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImagesRef = useRef<PendingImage[]>([]);

  // pendingImages 변경 시 ref 동기화
  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);
  // 언마운트 시 URL.createObjectURL 메모리 해제
  useEffect(() => {
    return () => {
      pendingImagesRef.current.forEach((img) =>
        URL.revokeObjectURL(img.preview),
      );
    };
  }, []);

  const resetTextarea = useCallback(() => {
    setInput("");
    setPendingImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.preview));
      return [];
    });
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, []);

  const addImages = useCallback((files: File[]) => {
    const validFiles = files.filter((f) =>
      ACCEPTED_IMAGE_TYPES.includes(f.type),
    );
    if (validFiles.length === 0) return;

    const oversized = validFiles.filter((f) => f.size > MAX_IMAGE_SIZE);
    if (oversized.length > 0) {
      toast.error(
        `이미지 크기가 10MB를 초과합니다: ${oversized.map((f) => f.name).join(", ")}`,
      );
    }

    const acceptable = validFiles.filter((f) => f.size <= MAX_IMAGE_SIZE);
    if (acceptable.length === 0) return;

    const newImages: PendingImage[] = acceptable.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPendingImages((prev) => [...prev, ...newImages]);
  }, []);

  const removeImage = useCallback((index: number) => {
    setPendingImages((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    const prompt = input.trim();
    if ((!prompt && pendingImages.length === 0) || status === "running") return;

    // 이미지가 있으면 업로드 먼저
    if (pendingImages.length > 0 && sessionId) {
      const imagePaths: string[] = [];

      for (const img of pendingImages) {
        try {
          const result = await sessionsApi.uploadImage(sessionId, img.file);
          imagePaths.push(result.path);
        } catch {
          toast.error(`이미지 업로드 실패: ${img.file.name}`);
        }
      }

      if (imagePaths.length === 0 && pendingImages.length > 0) {
        toast.error(
          "모든 이미지 업로드에 실패했습니다. 메시지를 전송하지 않습니다.",
        );
        return;
      }
      onSubmit(
        prompt || "이 이미지를 분석해주세요.",
        imagePaths.length > 0 ? imagePaths : undefined,
      );
    } else {
      onSubmit(prompt);
    }
    resetTextarea();
  }, [input, pendingImages, status, sessionId, onSubmit, resetTextarea]);

  const executeSlashCommand = useCallback(
    (cmd: SlashCommand) => {
      resetTextarea();
      onSlashCommand(cmd);
    },
    [resetTextarea, onSlashCommand],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (slashCommands.isOpen) {
        const selected = slashCommands.handleKeyDown(e);
        if (selected) {
          executeSlashCommand(slashCommands.selectCommand(selected));
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (status === "running") {
          onStop();
        } else {
          resetTextarea();
        }
        return;
      }
      if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        onModeToggle();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [
      slashCommands,
      status,
      onStop,
      resetTextarea,
      onModeToggle,
      handleSubmit,
      executeSlashCommand,
    ],
  );

  const handleTextareaInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setInput(val);
      slashCommands.handleInputChange(val);
      e.target.style.height = "44px";
      e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
    },
    [slashCommands],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" && ACCEPTED_IMAGE_TYPES.includes(item.type)) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        addImages(imageFiles);
      }
    },
    [addImages],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      addImages(files);
    },
    [addImages],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  return (
    <div
      className="px-4 py-3 border-t border-border bg-secondary"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="relative">
        {slashCommands.isOpen ? (
          <SlashCommandPopup
            commands={slashCommands.filteredCommands}
            activeIndex={slashCommands.activeIndex}
            onSelect={(cmd) =>
              executeSlashCommand(slashCommands.selectCommand(cmd))
            }
            onHover={slashCommands.setActiveIndex}
          />
        ) : null}

        {/* 드래그 오버레이 */}
        {isDragOver ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-[var(--radius-md)]">
            <div className="flex items-center gap-2 font-mono text-sm text-primary font-semibold">
              <Image className="h-5 w-5" />
              이미지를 여기에 놓으세요
            </div>
          </div>
        ) : null}

        {/* 답변 인디케이터 */}
        {pendingAnswerCount > 0 ? (
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-info animate-pulse" />
            <span className="font-mono text-xs text-info">
              {pendingAnswerCount}개 답변이 다음 메시지에 포함됩니다
            </span>
          </div>
        ) : null}

        {/* 이미지 미리보기 */}
        {pendingImages.length > 0 ? (
          <div className="flex gap-2 mb-2 flex-wrap">
            {pendingImages.map((img, i) => (
              <div key={img.preview} className="relative group">
                <img
                  src={img.preview}
                  alt={img.file.name}
                  className="h-16 w-16 object-cover rounded-md border border-border"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="이미지 제거"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
                <div className="font-mono text-[9px] text-muted-foreground truncate max-w-[64px] mt-0.5">
                  {img.file.name}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div
          className={cn(
            "flex items-end gap-2 bg-input border border-border rounded-[var(--radius-md)] pl-3.5 pr-1 py-1 transition-colors focus-within:border-primary/50",
            isDragOver && "border-primary/50",
          )}
        >
          {mode === "plan" ? (
            <button
              type="button"
              onClick={onModeToggle}
              className="flex items-center self-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-all duration-200 cursor-pointer shrink-0"
              title="Plan 모드 (Shift+Tab으로 전환)"
            >
              Plan
            </button>
          ) : null}

          {/* 이미지 첨부 버튼 */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="self-center text-muted-foreground hover:text-foreground transition-colors p-1 shrink-0"
            aria-label="이미지 첨부"
            title="이미지 첨부"
          >
            <Image className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              addImages(files);
              e.target.value = "";
            }}
          />

          <Textarea
            ref={textareaRef}
            className="flex-1 font-mono text-md bg-transparent border-0 outline-none resize-none min-h-11 leading-[22px] py-[11px] focus-visible:ring-0 focus-visible:ring-offset-0"
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="(Shift+Tab 모드 전환) >.."
            rows={1}
            disabled={!connected}
          />
          <div className="flex items-center pb-1">
            {status === "running" ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={onStop}
                className="font-mono text-xs font-semibold"
              >
                <Square className="h-3 w-3 mr-1.5 fill-current" />
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={
                  (!input.trim() && pendingImages.length === 0) || !connected
                }
                className="font-mono text-xs font-semibold"
              >
                Send <Send className="h-3 w-3 ml-1.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
