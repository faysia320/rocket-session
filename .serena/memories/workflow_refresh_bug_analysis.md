# Workflow State Recovery Bug Analysis

## Symptom
When refreshing the page while in Plan phase with "awaiting_approval" status:
- WorkflowProgressBar displays correctly: "Plan (검토 대기)"
- ActivityStatusBar shows correct message: "구현 계획 검토 대기 — 아티팩트를 검토하고 승인해주세요"
- ChatInput is disabled (intended behavior)
- ChatMessageList shows WorkflowPhaseCard correctly
- **BUT: ArtifactViewer doesn't auto-open; must click "아티팩트 열기" button again**

## Root Cause
**useWorkflowActions local state is reset on page refresh**:

File: `frontend/src/features/workflow/hooks/useWorkflowActions.ts` (lines 26-27)
```typescript
const [artifactViewerOpen, setArtifactViewerOpen] = useState(false);
const [viewingArtifactId, setViewingArtifactId] = useState<number | null>(null);
```

These are React component local states (memory-only), NOT persisted. On refresh:
1. SessionInfo is reloaded from backend ✅
2. Messages are reloaded from backend ✅
3. WorkflowPhaseCard re-renders ✅
4. BUT: useWorkflowActions state resets to initial values ❌
5. ArtifactViewer receives: `open={false}`, `viewingArtifactId={null}`
6. Sheet doesn't open; user must click button again

## Data Flow Analysis

### What Works (SessionInfo-based)
- WorkflowProgressBar: Uses `sessionInfo.workflow_phase` + `sessionInfo.workflow_phase_status` directly
- ActivityStatusBar: Computes `waitingForWorkflowApproval` from SessionInfo
- ChatInput disabled state: Correctly tracks `waitingForWorkflowApproval`

### What Breaks (Local State-based)
- ArtifactViewer open/close state: Depends on useState from useWorkflowActions
- viewingArtifactId: Depends on useState from useWorkflowActions
- useWorkflowArtifact query: Enabled only if `artifactViewerOpen && viewingArtifactId !== null`

File: `frontend/src/features/chat/components/ChatPanel.tsx` (lines 290-294)
```typescript
const { data: viewingArtifact } = useWorkflowArtifact(
  sessionId,
  viewingArtifactId ?? 0,
  artifactViewerOpen && viewingArtifactId !== null,
);
```

When viewingArtifactId=null on refresh: query is disabled → no artifact data loaded

## Why WorkflowPhaseCard Still Shows
File: `frontend/src/features/chat/components/MessageBubble.tsx` (lines 85-98)
```typescript
case "result":
  if (message.workflow_phase && message.workflow_phase !== "implement") {
    return <WorkflowPhaseCard ... />;
  }
```

Messages are loaded from backend, so result messages with `workflow_phase` property are restored.
WorkflowPhaseCard renders the "아티팩트 열기" button always (if onOpenArtifact prop exists).
BUT clicking it again is required because state is lost.

## Why ChatInput Stays Disabled
File: `frontend/src/features/chat/components/ChatPanel.tsx` (lines 351-356)
```typescript
const workflowEnabled = sessionInfo?.workflow_enabled;
const workflowPhaseStatus = sessionInfo?.workflow_phase_status;
const waitingForWorkflowApproval = useMemo(() => {
  if (!workflowEnabled) return false;
  return workflowPhaseStatus === "awaiting_approval";
}, [workflowEnabled, workflowPhaseStatus]);
```

This is computed from SessionInfo (backend), so it's correctly restored. ChatInput disabled state is **intentional** during approval waiting.

## Solution Direction
The bug is NOT that UI "disappears", but that ArtifactViewer doesn't auto-open on refresh.
Possible fixes:
1. Persist artifact viewer state in SessionStorage
2. Auto-open ArtifactViewer on mount if `workflow_phase_status === "awaiting_approval"` and latest artifact exists
3. Use useWorkflowStatus hook to sync state with backend

## Files Affected
- Frontend: `useWorkflowActions.ts`, `ChatPanel.tsx`, `ArtifactViewer.tsx`
- Backend: Sessions API correctly returns workflow_phase + workflow_phase_status
