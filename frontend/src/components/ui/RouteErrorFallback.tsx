import { useRouter } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RouteErrorFallback({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
      <AlertTriangle className="h-10 w-10 text-destructive/70" />
      <div className="text-center space-y-1.5">
        <p className="font-mono text-sm text-foreground">문제가 발생했습니다</p>
        <p className="font-mono text-xs text-muted-foreground max-w-md">
          {error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            reset?.();
            router.invalidate();
          }}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          다시 시도
        </Button>
      </div>
    </div>
  );
}
