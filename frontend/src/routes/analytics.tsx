import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/store";
import { useIsMobile } from "@/hooks/useMediaQuery";

const AnalyticsDashboard = lazy(() =>
  import("@/features/analytics/components/AnalyticsDashboard").then((m) => ({
    default: m.AnalyticsDashboard,
  })),
);

export const Route = createFileRoute("/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const setSidebarMobileOpen = useSessionStore((s) => s.setSidebarMobileOpen);
  const isMobile = useIsMobile();

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      {isMobile ? (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 left-3 h-8 w-8 md:hidden z-10"
          onClick={() => setSidebarMobileOpen(true)}
          aria-label="메뉴 열기"
        >
          <Menu className="h-4 w-4" />
        </Button>
      ) : null}
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center">
            <span className="font-mono text-sm text-muted-foreground animate-pulse">
              로딩 중…
            </span>
          </div>
        }
      >
        <AnalyticsDashboard />
      </Suspense>
    </div>
  );
}
