import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { ChatPanel } from '@/features/chat/components/ChatPanel';
import { FilePanel } from '@/features/files/components/FilePanel';
import type { FileChange } from '@/types';

export const Route = createFileRoute('/session/$sessionId')({
  component: SessionPage,
});

function SessionPage() {
  const { sessionId } = Route.useParams();
  const [showFiles, setShowFiles] = useState(true);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <ChatPanel
        sessionId={sessionId}
        onToggleFiles={() => setShowFiles((p) => !p)}
        showFiles={showFiles}
        onFileChanges={setFileChanges}
      />
      {showFiles ? <FilePanel fileChanges={fileChanges} /> : null}
    </div>
  );
}
