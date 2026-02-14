import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Play, Pencil, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type { ResultMsg } from "@/types";

interface PlanReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: ResultMsg | null;
  isRunning: boolean;
  onExecute: (messageId: string) => void;
  onDismiss: (messageId: string) => void;
  onRevise: (feedback: string) => void;
}

export function PlanReviewDialog({
  open,
  onOpenChange,
  message,
  isRunning,
  onExecute,
  onDismiss,
  onRevise,
}: PlanReviewDialogProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");

  if (!message) return null;

  const handleExecute = () => {
    onExecute(message.id);
    onOpenChange(false);
    setShowFeedback(false);
    setFeedback("");
  };

  const handleDismiss = () => {
    onDismiss(message.id);
    onOpenChange(false);
    setShowFeedback(false);
    setFeedback("");
  };

  const handleRevise = () => {
    if (!feedback.trim()) return;
    onRevise(feedback.trim());
    onOpenChange(false);
    setShowFeedback(false);
    setFeedback("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 bg-card border-border">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-primary text-base">&#9670;</span>
            <DialogTitle className="font-mono text-sm font-semibold text-foreground">
              Plan Review
            </DialogTitle>
            <Badge
              variant="outline"
              className="px-1.5 py-0.5 text-[9px] font-bold bg-primary/15 text-primary border-primary/30"
            >
              Plan
            </Badge>
          </div>
          <DialogDescription asChild>
            <div className="flex gap-3 font-mono text-xs text-muted-foreground">
              {message.cost ? (
                <span className="bg-secondary px-2 py-0.5 rounded-lg">
                  Cost: ${Number(message.cost).toFixed(4)}
                </span>
              ) : null}
              {message.duration_ms ? (
                <span className="bg-secondary px-2 py-0.5 rounded-lg">
                  Time: {(message.duration_ms / 1000).toFixed(1)}s
                </span>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Markdown Content */}
        <div className="flex-1 overflow-auto px-5 py-4 min-h-0">
          <div className="prose-plan">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.text || ""}
            </ReactMarkdown>
          </div>
        </div>

        {/* Feedback Area */}
        {showFeedback ? (
          <div className="px-5 py-3 border-t border-border">
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Plan modification feedback..."
              className="font-mono text-md bg-input border-border min-h-[80px] resize-none focus-visible:ring-primary/50"
              autoFocus
            />
            <div className="flex justify-end mt-2">
              <Button
                size="sm"
                onClick={handleRevise}
                disabled={!feedback.trim() || isRunning}
                className="font-mono text-xs font-semibold gap-1.5"
              >
                <Send className="h-3 w-3" />
                Send Feedback
              </Button>
            </div>
          </div>
        ) : null}

        {/* Footer Actions */}
        <DialogFooter className="px-5 py-3 border-t border-border sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="font-mono text-xs text-muted-foreground"
          >
            Close
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFeedback((p) => !p)}
              disabled={isRunning}
              className="font-mono text-xs gap-1.5"
            >
              <Pencil className="h-3 w-3" />
              Revise
            </Button>
            <Button
              size="sm"
              onClick={handleExecute}
              disabled={isRunning}
              className="font-mono text-xs font-semibold gap-1.5"
            >
              <Play className="h-3 w-3" />
              Execute Plan
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
