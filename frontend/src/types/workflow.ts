export type WorkflowPhase = string;
export type WorkflowPhaseStatus =
  | "in_progress"
  | "awaiting_approval"
  | "approved"
  | "revision_requested"
  | "completed";
export type ArtifactStatus = "draft" | "review" | "approved" | "superseded";
export type AnnotationType = "comment" | "suggestion" | "rejection";
export type AnnotationStatus = "pending" | "resolved" | "dismissed";

// ── Workflow Node (독립 엔티티) ──────────────────────────

export interface WorkflowNodeInfo {
  id: string;
  name: string;
  label: string;
  icon: string;
  prompt_template: string;
  constraints: string;
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkflowNodeRequest {
  name: string;
  label: string;
  icon?: string;
  prompt_template?: string;
  constraints?: string;
}

export interface UpdateWorkflowNodeRequest {
  name?: string;
  label?: string;
  icon?: string;
  prompt_template?: string;
  constraints?: string;
}

// ── Workflow Step (Definition 내 node_id 참조) ──────────

export interface WorkflowStepConfig {
  node_id: string;
  order_index: number;
  auto_advance: boolean;
  review_required: boolean;
}

export interface ResolvedWorkflowStep {
  node_id: string;
  name: string;
  label: string;
  icon: string;
  prompt_template: string;
  constraints: string;
  order_index: number;
  auto_advance: boolean;
  review_required: boolean;
}

// ── Workflow Definition ─────────────────────────────────

export interface WorkflowDefinitionInfo {
  id: string;
  name: string;
  description: string | null;
  is_builtin: boolean;
  steps: ResolvedWorkflowStep[];
  created_at: string;
  updated_at: string;
}

export interface ArtifactAnnotationInfo {
  id: number;
  artifact_id: number;
  line_start: number;
  line_end: number | null;
  content: string;
  annotation_type: AnnotationType;
  status: AnnotationStatus;
  created_at: string;
}

export interface SessionArtifactInfo {
  id: number;
  session_id: string;
  phase: string;
  title: string;
  content: string;
  status: ArtifactStatus;
  version: number;
  parent_artifact_id: number | null;
  annotations: ArtifactAnnotationInfo[];
  created_at: string;
  updated_at: string;
}

export interface StartWorkflowRequest {
  workflow_definition_id?: string;
  start_from_step?: string;
  skip_research?: boolean;
  skip_plan?: boolean;
}

export interface WorkflowStatusResponse {
  workflow_enabled: boolean;
  workflow_phase: string | null;
  workflow_phase_status: WorkflowPhaseStatus | null;
  workflow_definition_id: string | null;
  steps: ResolvedWorkflowStep[];
  artifacts: SessionArtifactInfo[];
}

export interface AddAnnotationRequest {
  line_start: number;
  line_end?: number | null;
  content: string;
  annotation_type?: AnnotationType;
}

export interface UpdateAnnotationRequest {
  status: "resolved" | "dismissed";
}

export interface UpdateArtifactRequest {
  content: string;
}

export interface ApprovePhaseRequest {
  feedback?: string | null;
}

export interface RequestRevisionRequest {
  feedback: string;
}

export interface CreateWorkflowDefinitionRequest {
  name: string;
  description?: string;
  steps: WorkflowStepConfig[];
}

export interface UpdateWorkflowDefinitionRequest {
  name?: string;
  description?: string;
  steps?: WorkflowStepConfig[];
}

export interface WorkflowDefinitionExport {
  version: number;
  definition: WorkflowDefinitionInfo;
  nodes: WorkflowNodeInfo[];
}
