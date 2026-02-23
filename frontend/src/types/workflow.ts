export type WorkflowPhase = "research" | "plan" | "implement";
export type WorkflowPhaseStatus =
  | "in_progress"
  | "awaiting_approval"
  | "approved"
  | "revision_requested";
export type ArtifactStatus = "draft" | "review" | "approved" | "superseded";
export type AnnotationType = "comment" | "suggestion" | "rejection";
export type AnnotationStatus = "pending" | "resolved" | "dismissed";

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
  phase: WorkflowPhase;
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
  skip_research?: boolean;
  skip_plan?: boolean;
}

export interface WorkflowStatusResponse {
  workflow_enabled: boolean;
  workflow_phase: WorkflowPhase | null;
  workflow_phase_status: WorkflowPhaseStatus | null;
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
