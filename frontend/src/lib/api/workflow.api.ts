import { api } from "./client";
import type {
  AddAnnotationRequest,
  ApprovePhaseRequest,
  ArtifactAnnotationInfo,
  RequestRevisionRequest,
  SessionArtifactInfo,
  StartWorkflowRequest,
  UpdateAnnotationRequest,
  UpdateArtifactRequest,
  ValidationResult,
  WorkflowStatusResponse,
} from "@/types/workflow";

const base = (sessionId: string) => `/api/sessions/${sessionId}/workflow`;

export const workflowApi = {
  startWorkflow: (sessionId: string, req: StartWorkflowRequest = {}) =>
    api.post<Record<string, unknown>>(`${base(sessionId)}/start`, req),

  getStatus: (sessionId: string) => api.get<WorkflowStatusResponse>(`${base(sessionId)}/status`),

  listArtifacts: (sessionId: string) =>
    api.get<SessionArtifactInfo[]>(`${base(sessionId)}/artifacts`),

  getArtifact: (sessionId: string, artifactId: number) =>
    api.get<SessionArtifactInfo>(`${base(sessionId)}/artifacts/${artifactId}`),

  updateArtifact: (sessionId: string, artifactId: number, req: UpdateArtifactRequest) =>
    api.put<SessionArtifactInfo>(`${base(sessionId)}/artifacts/${artifactId}`, req),

  addAnnotation: (sessionId: string, artifactId: number, req: AddAnnotationRequest) =>
    api.post<ArtifactAnnotationInfo>(`${base(sessionId)}/artifacts/${artifactId}/annotations`, req),

  updateAnnotation: (
    sessionId: string,
    artifactId: number,
    annotationId: number,
    req: UpdateAnnotationRequest,
  ) =>
    api.put<ArtifactAnnotationInfo>(
      `${base(sessionId)}/artifacts/${artifactId}/annotations/${annotationId}`,
      req,
    ),

  approvePhase: (sessionId: string, req: ApprovePhaseRequest = {}) =>
    api.post<Record<string, unknown>>(`${base(sessionId)}/approve`, req),

  requestRevision: (sessionId: string, req: RequestRevisionRequest) =>
    api.post<Record<string, unknown>>(`${base(sessionId)}/request-revision`, req),

  runValidation: (sessionId: string) =>
    api.post<ValidationResult>(`${base(sessionId)}/validate`, {}),
};
