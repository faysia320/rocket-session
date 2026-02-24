import { memo, useState, useCallback, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { MessageSquare, Lightbulb, XCircle, Eye, Code2 } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { ArtifactAnnotationPanel } from "./ArtifactAnnotationPanel";
import { PhaseApprovalBar } from "./PhaseApprovalBar";
import type { SessionArtifactInfo, ArtifactAnnotationInfo, AnnotationType } from "@/types/workflow";

const STATUS_LABELS: Record<string, string> = {
  draft: "초안",
  review: "검토 중",
  approved: "승인됨",
  superseded: "대체됨",
};

const ANNOTATION_ICONS: Record<string, typeof MessageSquare> = {
  comment: MessageSquare,
  suggestion: Lightbulb,
  rejection: XCircle,
};

interface ArtifactViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artifact: SessionArtifactInfo | null;
  onApprove?: (feedback?: string) => void;
  onRequestRevision?: (feedback: string) => void;
  onAddAnnotation?: (lineStart: number, lineEnd: number | null, content: string, type: AnnotationType) => void;
  onResolveAnnotation?: (annotationId: number) => void;
  onDismissAnnotation?: (annotationId: number) => void;
  onUpdateContent?: (content: string) => void;
  isApproving?: boolean;
  isRequestingRevision?: boolean;
}

export const ArtifactViewer = memo(function ArtifactViewer({
  open,
  onOpenChange,
  artifact,
  onApprove,
  onRequestRevision,
  onAddAnnotation,
  onResolveAnnotation,
  onDismissAnnotation,
  onUpdateContent,
  isApproving = false,
  isRequestingRevision = false,
}: ArtifactViewerProps) {
  type ContentViewMode = "markdown" | "source" | "edit";
  const [viewMode, setViewMode] = useState<ContentViewMode>("markdown");
  const [lastNonEditMode, setLastNonEditMode] = useState<"markdown" | "source">("markdown");
  const isEditing = viewMode === "edit";
  const [editContent, setEditContent] = useState("");
  const [annotationPopover, setAnnotationPopover] = useState<{
    line: number;
    open: boolean;
  } | null>(null);
  const [newAnnotationContent, setNewAnnotationContent] = useState("");
  const [newAnnotationType, setNewAnnotationType] = useState<AnnotationType>("comment");
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const lines = useMemo(
    () => (artifact?.content ?? "").split("\n"),
    [artifact?.content],
  );

  const annotationsByLine = useMemo(() => {
    if (!artifact?.annotations) return new Map<number, ArtifactAnnotationInfo[]>();
    const map = new Map<number, ArtifactAnnotationInfo[]>();
    for (const ann of artifact.annotations) {
      const existing = map.get(ann.line_start) ?? [];
      existing.push(ann);
      map.set(ann.line_start, existing);
    }
    return map;
  }, [artifact?.annotations]);

  useEffect(() => {
    if (isEditing && artifact) {
      setEditContent(artifact.content);
    }
  }, [isEditing, artifact]);

  // 아티팩트 변경 시 뷰 모드 리셋
  useEffect(() => {
    setViewMode("markdown");
    setLastNonEditMode("markdown");
  }, [artifact?.id]);

  const handleToggleEdit = useCallback(() => {
    if (isEditing) {
      // edit → 이전 뷰 모드로 복귀 (변경사항 있으면 저장)
      if (editContent !== artifact?.content && onUpdateContent) {
        onUpdateContent(editContent);
      }
      setViewMode(lastNonEditMode);
    } else {
      // markdown/source → edit 진입 (현재 모드 기억)
      setLastNonEditMode(viewMode as "markdown" | "source");
      setViewMode("edit");
    }
  }, [isEditing, editContent, artifact?.content, onUpdateContent, lastNonEditMode, viewMode]);

  const handleLineClick = useCallback((lineNum: number) => {
    setAnnotationPopover({ line: lineNum, open: true });
    setNewAnnotationContent("");
    setNewAnnotationType("comment");
  }, []);

  const handleAddAnnotation = useCallback(() => {
    if (annotationPopover && newAnnotationContent.trim() && onAddAnnotation) {
      onAddAnnotation(
        annotationPopover.line,
        null,
        newAnnotationContent.trim(),
        newAnnotationType,
      );
      setAnnotationPopover(null);
      setNewAnnotationContent("");
    }
  }, [annotationPopover, newAnnotationContent, newAnnotationType, onAddAnnotation]);

  const scrollToLine = useCallback((lineNum: number) => {
    // markdown 모드에서 줄 클릭 시 source 모드로 전환 후 스크롤
    if (viewMode === "markdown") {
      setViewMode("source");
      setLastNonEditMode("source");
      // 모드 전환 후 DOM 업데이트를 기다린 뒤 스크롤
      requestAnimationFrame(() => {
        const el = lineRefs.current.get(lineNum);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
      return;
    }
    const el = lineRefs.current.get(lineNum);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [viewMode]);

  if (!artifact) return null;

  const isApproved = artifact.status === "approved";
  const pendingAnnotations = artifact.annotations.filter(
    (a) => a.status === "pending",
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[85vw] lg:max-w-[70vw] p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-sm font-medium">
              {artifact.title}
            </SheetTitle>
            <Badge variant="outline" className="text-[10px]">
              v{artifact.version}
            </Badge>
            <Badge
              variant={
                artifact.status === "approved" ? "default" : "secondary"
              }
              className="text-[10px]"
            >
              {STATUS_LABELS[artifact.status] ?? artifact.status}
            </Badge>
            {pendingAnnotations.length > 0 ? (
              <Badge variant="outline" className="text-[10px] text-warning">
                {pendingAnnotations.length}건 미해결
              </Badge>
            ) : null}
          </div>
        </SheetHeader>

        {/* View mode toggle bar (edit 모드가 아닐 때만 표시) */}
        {!isEditing ? (
          <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border shrink-0 bg-card/50">
            <Button
              variant={viewMode === "markdown" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("markdown")}
              className="h-6 px-2.5 text-[11px] gap-1.5"
            >
              <Eye className="w-3 h-3" />
              미리보기
            </Button>
            <Button
              variant={viewMode === "source" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("source")}
              className="h-6 px-2.5 text-[11px] gap-1.5"
            >
              <Code2 className="w-3 h-3" />
              소스
            </Button>
          </div>
        ) : null}

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Content viewer */}
          <div className="flex-1 overflow-y-auto">
            {viewMode === "edit" ? (
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-full min-h-0 rounded-none border-0 resize-none font-mono text-xs leading-relaxed p-4"
              />
            ) : viewMode === "markdown" ? (
              <div className="p-4">
                <MarkdownRenderer content={artifact.content} />
              </div>
            ) : (
              <div className="font-mono text-xs leading-relaxed">
                {lines.map((line, idx) => {
                  const lineNum = idx + 1;
                  const lineAnnotations = annotationsByLine.get(lineNum);
                  const hasAnnotations =
                    lineAnnotations && lineAnnotations.length > 0;
                  const hasPending = lineAnnotations?.some(
                    (a) => a.status === "pending",
                  );

                  return (
                    <div
                      key={lineNum}
                      ref={(el) => {
                        if (el) lineRefs.current.set(lineNum, el);
                      }}
                      className={cn(
                        "flex group hover:bg-muted/30 transition-colors",
                        hasPending && "bg-warning/5",
                      )}
                    >
                      {/* Line number */}
                      <div className="w-12 shrink-0 text-right pr-3 py-px text-muted-foreground/50 select-none border-r border-border/30">
                        {lineNum}
                      </div>

                      {/* Gutter: annotation icon */}
                      <div className="w-6 shrink-0 flex items-center justify-center">
                        {hasAnnotations ? (
                          <AnnotationGutterIcon
                            annotations={lineAnnotations}
                          />
                        ) : (
                          <Popover
                            open={
                              annotationPopover?.line === lineNum &&
                              annotationPopover?.open
                            }
                            onOpenChange={(open) => {
                              if (!open)
                                setAnnotationPopover(null);
                            }}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                onClick={() => handleLineClick(lineNum)}
                                className="w-4 h-4 opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity"
                                aria-label={`${lineNum}번 줄에 주석 추가`}
                              >
                                <MessageSquare className="w-3 h-3 text-muted-foreground" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              side="right"
                              className="w-72 p-3"
                            >
                              <AddAnnotationForm
                                content={newAnnotationContent}
                                type={newAnnotationType}
                                onContentChange={setNewAnnotationContent}
                                onTypeChange={setNewAnnotationType}
                                onSubmit={handleAddAnnotation}
                                onCancel={() => setAnnotationPopover(null)}
                              />
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>

                      {/* Code content */}
                      <div className="flex-1 py-px px-2 whitespace-pre-wrap break-all">
                        {line || "\u00A0"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Annotation panel */}
          <div className="w-64 shrink-0 border-l border-border overflow-y-auto bg-card/50">
            <ArtifactAnnotationPanel
              annotations={artifact.annotations}
              onResolve={onResolveAnnotation}
              onDismiss={onDismissAnnotation}
              onLineClick={scrollToLine}
            />
          </div>
        </div>

        {/* Bottom: Approval bar */}
        {!isApproved ? (
          <PhaseApprovalBar
            phase={artifact?.phase}
            onApprove={onApprove}
            onRequestRevision={onRequestRevision}
            onToggleEdit={onUpdateContent ? handleToggleEdit : undefined}
            isApproving={isApproving}
            isRequestingRevision={isRequestingRevision}
            isEditing={isEditing}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
});

// ─── Sub-components ──────────────────────────────────────────

const AnnotationGutterIcon = memo(function AnnotationGutterIcon({
  annotations,
}: {
  annotations: ArtifactAnnotationInfo[];
}) {
  const hasPending = annotations.some((a) => a.status === "pending");
  const primaryType =
    annotations.find((a) => a.status === "pending")?.annotation_type ??
    annotations[0]?.annotation_type ??
    "comment";
  const Icon = ANNOTATION_ICONS[primaryType] ?? MessageSquare;

  return (
    <Icon
      className={cn(
        "w-3.5 h-3.5",
        hasPending ? "text-warning" : "text-muted-foreground/50",
      )}
    />
  );
});

function AddAnnotationForm({
  content,
  type,
  onContentChange,
  onTypeChange,
  onSubmit,
  onCancel,
}: {
  content: string;
  type: AnnotationType;
  onContentChange: (v: string) => void;
  onTypeChange: (v: AnnotationType) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const types: { value: AnnotationType; label: string; icon: typeof MessageSquare }[] = [
    { value: "comment", label: "댓글", icon: MessageSquare },
    { value: "suggestion", label: "제안", icon: Lightbulb },
    { value: "rejection", label: "반려", icon: XCircle },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {types.map((t) => {
          const TIcon = t.icon;
          return (
            <Button
              key={t.value}
              variant={type === t.value ? "default" : "ghost"}
              size="sm"
              onClick={() => onTypeChange(t.value)}
              className="h-6 px-2 text-[10px]"
            >
              <TIcon className="w-3 h-3 mr-1" />
              {t.label}
            </Button>
          );
        })}
      </div>
      <Textarea
        placeholder="주석 내용을 입력하세요…"
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        className="min-h-[50px] text-xs"
        autoFocus
      />
      <div className="flex items-center gap-1.5 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-6 text-xs">
          취소
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={onSubmit}
          disabled={!content.trim()}
          className="h-6 text-xs"
        >
          추가
        </Button>
      </div>
    </div>
  );
}
