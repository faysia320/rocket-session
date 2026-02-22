import { useState, useEffect } from "react";
import { ShieldAlert, ShieldCheck, ShieldPlus, Check, X } from "lucide-react";
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
import type { PermissionRequestData } from "@/types";

const DANGEROUS_TOOLS = ["Bash", "Write", "Edit", "MultiEdit"];
const TIMEOUT_SECONDS = 120;

export type TrustLevel = "once" | "session" | "always";

interface PermissionDialogProps {
  request: PermissionRequestData | null;
  onAllow: (permissionId: string, trustLevel?: TrustLevel) => void;
  onDeny: (permissionId: string) => void;
}

export function PermissionDialog({
  request,
  onAllow,
  onDeny,
}: PermissionDialogProps) {
  const [remaining, setRemaining] = useState(TIMEOUT_SECONDS);

  useEffect(() => {
    if (!request) {
      setRemaining(TIMEOUT_SECONDS);
      return;
    }

    setRemaining(TIMEOUT_SECONDS);
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDeny(request.permission_id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [request, onDeny]);

  if (!request) return null;

  const isDangerous = DANGEROUS_TOOLS.includes(request.tool_name);
  const inputJson = JSON.stringify(request.tool_input, null, 2);

  return (
    <Dialog
      open={!!request}
      onOpenChange={(open) => {
        if (!open) onDeny(request.permission_id);
      }}
    >
      <DialogContent className="sm:max-w-[520px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-sm">
            <ShieldAlert className="h-4 w-4 text-warning" />
            Permission Required
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-muted-foreground">
            Claude가 승인이 필요한 도구를 사용하려 합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xs text-muted-foreground/70 uppercase tracking-wider">
              Tool
            </span>
            <Badge
              variant={isDangerous ? "destructive" : "secondary"}
              className="font-mono text-xs"
            >
              {request.tool_name}
            </Badge>
          </div>

          <div>
            <div className="font-mono text-2xs text-muted-foreground/70 uppercase tracking-wider mb-1">
              Input
            </div>
            <pre className="font-mono text-xs text-muted-foreground bg-input p-3 rounded-sm overflow-auto max-h-[200px] whitespace-pre-wrap border border-border">
              {inputJson}
            </pre>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-warning/60 rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${(remaining / TIMEOUT_SECONDS) * 100}%` }}
              />
            </div>
            <span className="font-mono text-2xs text-muted-foreground tabular-nums">
              {remaining}s
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDeny(request.permission_id)}
            className="font-mono text-xs gap-1.5"
          >
            <X className="h-3 w-3" />
            거부
          </Button>
          <div className="flex gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onAllow(request.permission_id, "once")}
              className="font-mono text-xs gap-1.5"
            >
              <Check className="h-3 w-3" />
              이번만
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onAllow(request.permission_id, "session")}
              className="font-mono text-xs gap-1.5"
            >
              <ShieldCheck className="h-3 w-3" />
              세션 동안
            </Button>
            <Button
              size="sm"
              onClick={() => onAllow(request.permission_id, "always")}
              className="font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <ShieldPlus className="h-3 w-3" />
              항상
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
