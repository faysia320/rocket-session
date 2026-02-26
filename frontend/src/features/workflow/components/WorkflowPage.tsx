import { useState, useCallback } from "react";
import { Workflow, Blocks } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WorkflowDefinitionsPage } from "./WorkflowDefinitionsPage";
import { WorkflowNodesPage } from "./WorkflowNodesPage";

type WorkflowTab = "definitions" | "nodes";

interface WorkflowPageProps {
  initialTab?: WorkflowTab;
}

export function WorkflowPage({ initialTab = "definitions" }: WorkflowPageProps) {
  const [activeTab, setActiveTab] = useState<WorkflowTab>(initialTab);

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as WorkflowTab);
  }, []);

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="flex-1 flex flex-col overflow-hidden"
    >
      {/* 탭 헤더 */}
      <div className="shrink-0 border-b border-border px-6 py-3">
        <div className="flex items-center gap-4">
          <h1 className="font-mono text-lg font-semibold text-foreground flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            Workflows
          </h1>
          <TabsList className="h-8">
            <TabsTrigger
              value="definitions"
              className="gap-1.5 font-mono text-xs h-7 px-3"
            >
              <Workflow className="h-3 w-3" />
              Definitions
            </TabsTrigger>
            <TabsTrigger
              value="nodes"
              className="gap-1.5 font-mono text-xs h-7 px-3"
            >
              <Blocks className="h-3 w-3" />
              Nodes
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <TabsContent
        value="definitions"
        className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden"
        forceMount
      >
        <WorkflowDefinitionsPage />
      </TabsContent>

      <TabsContent
        value="nodes"
        className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden"
        forceMount
      >
        <WorkflowNodesPage />
      </TabsContent>
    </Tabs>
  );
}
