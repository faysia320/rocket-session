import { Workflow } from "lucide-react";
import { WorkflowDefinitionsPage } from "./WorkflowDefinitionsPage";

export function WorkflowPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 페이지 헤더 */}
      <div className="shrink-0 border-b border-border px-6 py-3">
        <h1 className="font-mono text-lg font-semibold text-foreground flex items-center gap-2">
          <Workflow className="h-5 w-5 text-primary" />
          Workflows
        </h1>
      </div>

      {/* 콘텐츠 */}
      <WorkflowDefinitionsPage />
    </div>
  );
}
