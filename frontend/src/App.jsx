import React, { useState } from 'react';
import { useSessions } from './features/session/hooks/useSessions';
import { Sidebar } from './features/session/components/Sidebar';
import { ChatPanel } from './features/chat/components/ChatPanel';
import { FilePanel } from './features/files/components/FilePanel';
import { EmptyState } from './components/ui/EmptyState';

export default function App() {
  const { sessions, activeSessionId, createSession, deleteSession, selectSession } =
    useSessions();
  const [showFiles, setShowFiles] = useState(true);
  const [fileChanges, setFileChanges] = useState([]);

  return (
    <div style={styles.container}>
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={selectSession}
        onNew={createSession}
        onDelete={deleteSession}
      />
      <main style={styles.main}>
        {activeSessionId ? (
          <div style={styles.workspace}>
            <ChatPanel
              sessionId={activeSessionId}
              onToggleFiles={() => setShowFiles((p) => !p)}
              showFiles={showFiles}
              onFileChanges={setFileChanges}
            />
            {showFiles ? <FilePanel fileChanges={fileChanges} /> : null}
          </div>
        ) : (
          <EmptyState onNew={createSession} />
        )}
      </main>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    background: 'var(--bg-primary)',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  workspace: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
};
