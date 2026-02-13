import React, { useState } from 'react';

export function Sidebar({ sessions, activeSessionId, onSelect, onNew, onDelete }) {
  const [workDir, setWorkDir] = useState('');
  const [showInput, setShowInput] = useState(false);

  const handleCreate = () => {
    onNew(workDir || undefined);
    setWorkDir('');
    setShowInput(false);
  };

  return (
    <aside style={styles.sidebar}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>◆</span>
          <span style={styles.logoText}>CC Dashboard</span>
        </div>
      </div>

      {/* New Session */}
      <div style={styles.newSection}>
        {showInput ? (
          <div style={styles.newForm}>
            <input
              style={styles.input}
              placeholder="Working directory (optional)"
              value={workDir}
              onChange={e => setWorkDir(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <div style={styles.newActions}>
              <button style={styles.createBtn} onClick={handleCreate}>Create</button>
              <button style={styles.cancelBtn} onClick={() => setShowInput(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button style={styles.newBtn} onClick={() => setShowInput(true)}>
            <span style={styles.newBtnIcon}>+</span>
            New Session
          </button>
        )}
      </div>

      {/* Sessions list */}
      <div style={styles.listHeader}>
        <span style={styles.listLabel}>SESSIONS</span>
        <span style={styles.listCount}>{sessions.length}</span>
      </div>

      <div style={styles.list}>
        {sessions.length === 0 ? (
          <div style={styles.emptyList}>No active sessions</div>
        ) : (
          sessions.map(s => (
            <div
              key={s.id}
              style={{
                ...styles.item,
                ...(s.id === activeSessionId ? styles.itemActive : {}),
              }}
              onClick={() => onSelect(s.id)}
            >
              <div style={styles.itemTop}>
                <span style={{
                  ...styles.statusDot,
                  backgroundColor: s.status === 'running' ? 'var(--success)' :
                                   s.status === 'error' ? 'var(--error)' : 'var(--text-muted)',
                }} />
                <span style={styles.itemId}>{s.id}</span>
                <button
                  style={styles.deleteBtn}
                  onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                  title="Delete session"
                >
                  ×
                </button>
              </div>
              <div style={styles.itemMeta}>
                <span style={styles.metaText}>{s.message_count} msgs</span>
                <span style={styles.metaDot}>·</span>
                <span style={styles.metaText}>{s.file_changes_count} changes</span>
              </div>
              <div style={styles.itemPath} title={s.work_dir}>
                {truncatePath(s.work_dir)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <div style={styles.footerText}>Claude Code CLI</div>
        <div style={styles.footerVersion}>Dashboard v1.0</div>
      </div>
    </aside>
  );
}

function truncatePath(p) {
  if (!p) return '~';
  const parts = p.split('/');
  if (parts.length <= 3) return p;
  return '~/' + parts.slice(-2).join('/');
}

const styles = {
  sidebar: {
    width: '260px',
    minWidth: '260px',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-card)',
    borderRight: '1px solid var(--border)',
    overflow: 'hidden',
  },
  header: {
    padding: '20px 16px 12px',
    borderBottom: '1px solid var(--border)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logoIcon: {
    fontSize: '18px',
    color: 'var(--accent)',
  },
  logoText: {
    fontFamily: 'var(--font-mono)',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    letterSpacing: '-0.3px',
  },
  newSection: {
    padding: '12px 12px 0',
  },
  newBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px 12px',
    background: 'var(--accent)',
    color: 'var(--bg-primary)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  newBtnIcon: {
    fontSize: '16px',
    fontWeight: 700,
  },
  newForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  input: {
    padding: '8px 10px',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    outline: 'none',
  },
  newActions: {
    display: 'flex',
    gap: '6px',
  },
  createBtn: {
    flex: 1,
    padding: '7px',
    background: 'var(--accent)',
    color: 'var(--bg-primary)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelBtn: {
    flex: 1,
    padding: '7px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    cursor: 'pointer',
  },
  listHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 16px 8px',
  },
  listLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '1px',
  },
  listCount: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--text-dim)',
    background: 'var(--bg-tertiary)',
    padding: '2px 6px',
    borderRadius: '8px',
  },
  list: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 8px',
  },
  emptyList: {
    padding: '24px 12px',
    textAlign: 'center',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    color: 'var(--text-dim)',
  },
  item: {
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    marginBottom: '4px',
    transition: 'all 0.15s',
    border: '1px solid transparent',
  },
  itemActive: {
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-bright)',
  },
  itemTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  itemId: {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    flex: 1,
  },
  deleteBtn: {
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    color: 'var(--text-dim)',
    fontSize: '16px',
    cursor: 'pointer',
    borderRadius: '4px',
    opacity: 0.5,
    transition: 'all 0.15s',
  },
  itemMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginBottom: '2px',
  },
  metaText: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--text-muted)',
  },
  metaDot: {
    color: 'var(--text-dim)',
    fontSize: '10px',
  },
  itemPath: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--text-dim)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
  },
  footerText: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  footerVersion: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--text-dim)',
  },
};
