import {
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

export const WORKFLOW_ICON_MAP: Record<string, LucideIcon> = {
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

export function resolveWorkflowIcon(name: string): LucideIcon {
  return WORKFLOW_ICON_MAP[name] ?? FileText;
}
