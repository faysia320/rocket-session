import {
  Pencil,
  Download,
  Trash2,
  Search,
  FileText,
  Code,
  Wrench,
  TestTube,
  Eye,
  Palette,
  BookOpen,
  Hammer,
  CheckCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { WorkflowDefinitionInfo } from "@/types/workflow";

const ICON_MAP: Record<string, LucideIcon> = {
  Search,
  FileText,
  Code,
  Wrench,
  TestTube,
  Eye,
  Palette,
  BookOpen,
  Hammer,
  CheckCircle,
};

const CONSTRAINT_LABELS: Record<string, string> = {
  readonly: "읽기 전용",
  full: "전체",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface WorkflowDefinitionDetailProps {
  definition: WorkflowDefinitionInfo;
  onEdit: () => void;
  onExport: () => void;
  onDelete: () => void;
}

export function WorkflowDefinitionDetail({
  definition,
  onEdit,
  onExport,
  onDelete,
}: WorkflowDefinitionDetailProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* 액션 바 */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border">
        <span className="font-mono text-sm font-semibold text-foreground truncate">
          {definition.name}
        </span>
        {definition.is_builtin ? (
          <Badge variant="outline" className="font-mono text-2xs px-1.5 py-0 shrink-0">
            기본 제공
          </Badge>
        ) : null}

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onEdit}
              aria-label="수정"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="font-mono text-xs">수정</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onExport}
              aria-label="내보내기"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="font-mono text-xs">내보내기</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive/60 hover:text-destructive"
              onClick={onDelete}
              disabled={definition.is_builtin}
              aria-label="삭제"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="font-mono text-xs">
            {definition.is_builtin ? "기본 제공 정의는 삭제할 수 없습니다" : "삭제"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* 상세 콘텐츠 */}
      <ScrollArea className="flex-1">
        <div className="px-6 py-4 space-y-6">
          {/* 설명 */}
          <div>
            <h3 className="font-mono text-xs font-semibold text-muted-foreground mb-1">설명</h3>
            <p className="font-mono text-xs text-foreground">
              {definition.description || "설명 없음"}
            </p>
          </div>

          {/* 단계 목록 */}
          <div>
            <h3 className="font-mono text-xs font-semibold text-muted-foreground mb-2">
              단계 구성 ({definition.steps.length}단계)
            </h3>
            <div className="space-y-2">
              {definition.steps.map((step, index) => {
                const StepIcon = ICON_MAP[step.icon] ?? FileText;
                return (
                  <div
                    key={index}
                    className="rounded-lg border border-border bg-card p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-2xs text-muted-foreground w-5 text-right shrink-0">
                        {index + 1}.
                      </span>
                      <StepIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-mono text-xs font-medium text-foreground">
                        {step.label || step.name}
                      </span>
                      {step.label && step.name ? (
                        <span className="font-mono text-2xs text-muted-foreground">
                          ({step.name})
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1.5 pl-7">
                      <Badge variant="secondary" className="font-mono text-2xs px-1.5 py-0">
                        {CONSTRAINT_LABELS[step.constraints] ?? step.constraints}
                      </Badge>
                      {step.auto_advance ? (
                        <Badge variant="outline" className="font-mono text-2xs px-1.5 py-0">
                          자동 진행
                        </Badge>
                      ) : null}
                      {step.review_required ? (
                        <Badge variant="outline" className="font-mono text-2xs px-1.5 py-0 text-warning border-warning/30">
                          승인 필요
                        </Badge>
                      ) : null}
                    </div>

                    {step.prompt_template ? (
                      <div className="pl-7">
                        <p className="font-mono text-2xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                          {step.prompt_template}
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 메타 정보 */}
          <div className="flex items-center gap-4 pt-2 border-t border-border">
            <span className="font-mono text-2xs text-muted-foreground">
              생성: {formatDate(definition.created_at)}
            </span>
            <span className="font-mono text-2xs text-muted-foreground">
              수정: {formatDate(definition.updated_at)}
            </span>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
