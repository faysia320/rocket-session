import { memo } from "react";
import { PermissionDialog } from "./PermissionDialog";
import { FileViewer } from "@/features/files/components/FileViewer";
import type { PermissionRequestData, FileChange } from "@/types";
import type { TrustLevel } from "./PermissionDialog";

interface ChatDialogsProps {
  permissionRequest: PermissionRequestData | null;
  onAllow: (id: string, trustLevel?: TrustLevel) => void;
  onDeny: (id: string) => void;
  selectedFile: FileChange | null;
  onFileViewerClose: (open: boolean) => void;
  sessionId: string;
}

export const ChatDialogs = memo(function ChatDialogs({
  permissionRequest,
  onAllow,
  onDeny,
  selectedFile,
  onFileViewerClose,
  sessionId,
}: ChatDialogsProps) {
  return (
    <>
      <PermissionDialog
        request={permissionRequest}
        onAllow={onAllow}
        onDeny={onDeny}
      />

      {selectedFile ? (
        <FileViewer
          sessionId={sessionId}
          filePath={selectedFile.file}
          tool={selectedFile.tool}
          timestamp={selectedFile.timestamp}
          open={!!selectedFile}
          onOpenChange={onFileViewerClose}
        />
      ) : null}
    </>
  );
});
