import React from 'react';

/**
 * 파일 변경 추적 패널.
 * WebSocket 중복 연결 버그 수정: fileChanges를 props로 받습니다.
 */
export function FilePanel({ fileChanges = [] }) {
  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.headerIcon}>{'\u{1F4C1}'}</span>
        <span style={styles.headerTitle}>File Changes</span>
        <span style={styles.count}>{fileChanges.length}</span>
      </div>

      <div style={styles.list}>
        {fileChanges.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>{'\u{1F4C2}'}</div>
            <div style={styles.emptyText}>No file changes yet</div>
            <div style={styles.emptyHint}>
              Changes will appear here as Claude modifies files
            </div>
          </div>
        ) : (
          fileChanges.map((change, i) => (
            <div key={i} style={styles.item}>
              <div style={styles.itemHeader}>
                <span
                  style={{
                    ...styles.toolBadge,
                    background:
                      change.tool === 'Write'
                        ? 'rgba(34,197,94,0.15)'
                        : change.tool === 'Edit'
                          ? 'rgba(59,130,246,0.15)'
                          : 'rgba(148,163,184,0.15)',
                    color:
                      change.tool === 'Write'
                        ? 'var(--success)'
                        : change.tool === 'Edit'
                          ? 'var(--info)'
                          : 'var(--text-muted)',
                  }}
                >
                  {change.tool}
                </span>
                <span style={styles.timestamp}>{formatTime(change.timestamp)}</span>
              </div>
              <div style={styles.filePath}>{change.file}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatTime(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

const styles = {
  panel: {
    width: '280px',
    minWidth: '280px',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-card)',
    borderLeft: '1px solid var(--border)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 14px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  },
  headerIcon: { fontSize: '14px' },
  headerTitle: {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    flex: 1,
  },
  count: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--text-dim)',
    background: 'var(--bg-tertiary)',
    padding: '2px 7px',
    borderRadius: '8px',
  },
  list: {
    flex: 1,
    overflow: 'auto',
    padding: '8px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 16px',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '28px',
    marginBottom: '8px',
    opacity: 0.4,
  },
  emptyText: {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginBottom: '4px',
  },
  emptyHint: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--text-dim)',
    lineHeight: 1.5,
  },
  item: {
    padding: '8px 10px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '6px',
    animation: 'fadeIn 0.2s ease',
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '4px',
  },
  toolBadge: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: '4px',
  },
  timestamp: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--text-dim)',
  },
  filePath: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--accent)',
    wordBreak: 'break-all',
  },
};
