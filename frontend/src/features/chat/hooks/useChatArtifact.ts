/**
 * useChatArtifact — 아티팩트 뷰어 상태 및 주석/편집 콜백 캡슐화
 */
import { useCallback } from "react";
import {
  useWorkflowArtifact,
  useAddAnnotation,
  useUpdateAnnotation,
  useUpdateArtifact,
} from "@/features/workflow/hooks/useWorkflow";
import type { AnnotationType } from "@/types/workflow";

interface UseChatArtifactParams {
  sessionId: string;
  artifactViewerOpen: boolean;
  viewingArtifactId: number | null;
  handleCloseArtifact: () => void;
}

export function useChatArtifact({
  sessionId,
  artifactViewerOpen,
  viewingArtifactId,
  handleCloseArtifact,
}: UseChatArtifactParams) {
  const { data: viewingArtifact } = useWorkflowArtifact(
    sessionId,
    viewingArtifactId ?? 0,
    artifactViewerOpen && viewingArtifactId !== null,
  );
  const addAnnotationMut = useAddAnnotation(sessionId, viewingArtifactId ?? 0);
  const updateAnnotationMut = useUpdateAnnotation(sessionId, viewingArtifactId ?? 0);
  const updateArtifactMut = useUpdateArtifact(sessionId, viewingArtifactId ?? 0);

  const handleArtifactOpenChange = useCallback(
    (open: boolean) => {
      if (!open) handleCloseArtifact();
    },
    [handleCloseArtifact],
  );

  const handleAddAnnotation = useCallback(
    (lineStart: number, lineEnd: number | null, content: string, type: AnnotationType) => {
      addAnnotationMut.mutate({
        line_start: lineStart,
        line_end: lineEnd,
        content,
        annotation_type: type,
      });
    },
    [addAnnotationMut],
  );

  const handleResolveAnnotation = useCallback(
    (annId: number) => {
      updateAnnotationMut.mutate({ annotationId: annId, status: "resolved" });
    },
    [updateAnnotationMut],
  );

  const handleDismissAnnotation = useCallback(
    (annId: number) => {
      updateAnnotationMut.mutate({ annotationId: annId, status: "dismissed" });
    },
    [updateAnnotationMut],
  );

  const handleUpdateArtifactContent = useCallback(
    (content: string) => {
      updateArtifactMut.mutate({ content });
    },
    [updateArtifactMut],
  );

  return {
    viewingArtifact: viewingArtifact ?? null,
    handleArtifactOpenChange,
    handleAddAnnotation,
    handleResolveAnnotation,
    handleDismissAnnotation,
    handleUpdateArtifactContent,
  };
}
