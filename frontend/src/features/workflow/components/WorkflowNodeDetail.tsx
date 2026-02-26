import { useState, useCallback, useEffect } from "react";
import { Blocks, Pencil, Trash2, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WorkflowNodeInfo, CreateWorkflowNodeRequest, UpdateWorkflowNodeRequest } from "@/types/workflow";

const CONSTRAINT_OPTIONS = [
  { value: "readonly", label: "Readonly" },
  { value: "full", label: "Full" },
  { value: "none", label: "None" },
];

const ICON_OPTIONS = [
  "Search", "FileText", "Code", "CheckCircle", "Settings",
  "Database", "Globe", "Zap", "Shield", "Layers",
];

interface WorkflowNodeDetailProps {
  node: WorkflowNodeInfo | null;
  isCreating?: boolean;
  onSave: (data: CreateWorkflowNodeRequest | (UpdateWorkflowNodeRequest & { id: string })) => void;
  onDelete: () => void;
  onCancelCreate?: () => void;
}

export function WorkflowNodeDetail({
  node,
  isCreating = false,
  onSave,
  onDelete,
  onCancelCreate,
}: WorkflowNodeDetailProps) {
  const [isEditing, setIsEditing] = useState(isCreating);
  const [formData, setFormData] = useState({
    name: "",
    label: "",
    icon: "FileText",
    prompt_template: "",
    constraints: "readonly",
  });

  useEffect(() => {
    if (isCreating) {
      setFormData({ name: "", label: "", icon: "FileText", prompt_template: "", constraints: "readonly" });
      setIsEditing(true);
    } else if (node) {
      setFormData({
        name: node.name,
        label: node.label,
        icon: node.icon,
        prompt_template: node.prompt_template,
        constraints: node.constraints,
      });
      setIsEditing(false);
    }
  }, [node, isCreating]);

  const handleSave = useCallback(() => {
    if (isCreating) {
      onSave({
        name: formData.name,
        label: formData.label,
        icon: formData.icon,
        prompt_template: formData.prompt_template,
        constraints: formData.constraints,
      });
    } else if (node) {
      onSave({
        id: node.id,
        name: formData.name,
        label: formData.label,
        icon: formData.icon,
        prompt_template: formData.prompt_template,
        constraints: formData.constraints,
      });
    }
    setIsEditing(false);
  }, [isCreating, node, formData, onSave]);

  const handleCancel = useCallback(() => {
    if (isCreating) {
      onCancelCreate?.();
    } else if (node) {
      setFormData({
        name: node.name,
        label: node.label,
        icon: node.icon,
        prompt_template: node.prompt_template,
        constraints: node.constraints,
      });
      setIsEditing(false);
    }
  }, [isCreating, node, onCancelCreate]);

  if (!node && !isCreating) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="font-mono text-sm text-muted-foreground">
          좌측에서 노드를 선택하세요
        </span>
      </div>
    );
  }

  const isBuiltin = node?.is_builtin ?? false;

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      {/* 액션바 */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Blocks className="h-4 w-4 text-primary" />
          <span className="font-mono text-sm font-semibold">
            {isCreating ? "새 노드" : node?.label}
          </span>
          {isBuiltin ? (
            <Badge variant="outline" className="font-mono text-2xs">기본 제공</Badge>
          ) : null}
        </div>
        {!isEditing && !isBuiltin ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-xs gap-1"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-3 w-3" />
              수정
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-xs gap-1 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3 w-3" />
              삭제
            </Button>
          </div>
        ) : isEditing ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-xs gap-1"
              onClick={handleCancel}
            >
              <X className="h-3 w-3" />
              취소
            </Button>
            <Button
              size="sm"
              className="font-mono text-xs gap-1"
              onClick={handleSave}
              disabled={!formData.name || !formData.label}
            >
              <Save className="h-3 w-3" />
              저장
            </Button>
          </div>
        ) : null}
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {isEditing ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-mono text-xs">이름 (name)</Label>
                <Input
                  className="font-mono text-xs h-8"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="research"
                  disabled={isBuiltin}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-xs">라벨 (label)</Label>
                <Input
                  className="font-mono text-xs h-8"
                  value={formData.label}
                  onChange={(e) => setFormData((prev) => ({ ...prev, label: e.target.value }))}
                  placeholder="Research"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-mono text-xs">아이콘</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, icon: v }))}
                >
                  <SelectTrigger className="h-8 font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((icon) => (
                      <SelectItem key={icon} value={icon} className="font-mono text-xs">
                        {icon}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-xs">제약조건</Label>
                <Select
                  value={formData.constraints}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, constraints: v }))}
                >
                  <SelectTrigger className="h-8 font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONSTRAINT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="font-mono text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">프롬프트 템플릿</Label>
              <Textarea
                className="font-mono text-xs min-h-[200px] resize-y"
                value={formData.prompt_template}
                onChange={(e) => setFormData((prev) => ({ ...prev, prompt_template: e.target.value }))}
                placeholder="프롬프트 템플릿을 입력하세요. {user_prompt}, {previous_artifact} 변수를 사용할 수 있습니다."
              />
            </div>
          </>
        ) : node ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="font-mono text-2xs text-muted-foreground">이름</span>
                <p className="font-mono text-xs">{node.name}</p>
              </div>
              <div className="space-y-1">
                <span className="font-mono text-2xs text-muted-foreground">라벨</span>
                <p className="font-mono text-xs">{node.label}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="font-mono text-2xs text-muted-foreground">아이콘</span>
                <p className="font-mono text-xs">{node.icon}</p>
              </div>
              <div className="space-y-1">
                <span className="font-mono text-2xs text-muted-foreground">제약조건</span>
                <Badge variant="secondary" className="font-mono text-2xs">
                  {node.constraints}
                </Badge>
              </div>
            </div>
            {node.prompt_template ? (
              <div className="space-y-1">
                <span className="font-mono text-2xs text-muted-foreground">프롬프트 템플릿</span>
                <pre className="font-mono text-xs bg-muted/50 rounded-md p-3 whitespace-pre-wrap max-h-[400px] overflow-auto">
                  {node.prompt_template}
                </pre>
              </div>
            ) : (
              <div className="space-y-1">
                <span className="font-mono text-2xs text-muted-foreground">프롬프트 템플릿</span>
                <p className="font-mono text-2xs text-muted-foreground/50 italic">없음</p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
