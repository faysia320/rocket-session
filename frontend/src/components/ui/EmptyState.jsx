import React from 'react';

export function EmptyState({ onNew }) {
  return (
    <div style={styles.empty}>
      <div style={styles.emptyInner}>
        <div style={styles.emptyIcon}>{'>'}_</div>
        <h1 style={styles.emptyTitle}>Claude Code Dashboard</h1>
        <p style={styles.emptyDesc}>
          Create a session to start sending commands to Claude Code CLI
        </p>
        <button style={styles.emptyBtn} onClick={() => onNew()}>
          + New Session
        </button>
      </div>
      <div style={styles.emptyGrid}>
        {[
          {
            icon: '\u{1F4AC}',
            title: 'Send Commands',
            desc: 'Write prompts and get real-time streaming responses',
          },
          {
            icon: '\u{1F4C1}',
            title: 'Track Changes',
            desc: 'Monitor file modifications as Claude works',
          },
          {
            icon: '\u{1F504}',
            title: 'Resume Sessions',
            desc: 'Continue conversations across multiple prompts',
          },
        ].map((f, i) => (
          <div
            key={i}
            style={{ ...styles.featureCard, animationDelay: `${i * 0.1}s` }}
          >
            <span style={styles.featureIcon}>{f.icon}</span>
            <h3 style={styles.featureTitle}>{f.title}</h3>
            <p style={styles.featureDesc}>{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '48px',
    padding: '40px',
  },
  emptyInner: {
    textAlign: 'center',
    animation: 'fadeIn 0.5s ease',
  },
  emptyIcon: {
    fontFamily: 'var(--font-mono)',
    fontSize: '48px',
    color: 'var(--accent)',
    marginBottom: '16px',
    animation: 'blink 1.2s ease-in-out infinite',
  },
  emptyTitle: {
    fontFamily: 'var(--font-mono)',
    fontSize: '28px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '8px',
    letterSpacing: '-0.5px',
  },
  emptyDesc: {
    color: 'var(--text-secondary)',
    fontSize: '15px',
    marginBottom: '24px',
  },
  emptyBtn: {
    fontFamily: 'var(--font-mono)',
    fontSize: '14px',
    fontWeight: 500,
    padding: '12px 28px',
    background: 'var(--accent)',
    color: 'var(--bg-primary)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  emptyGrid: {
    display: 'flex',
    gap: '16px',
    maxWidth: '700px',
  },
  featureCard: {
    flex: 1,
    padding: '20px',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    animation: 'fadeIn 0.5s ease both',
  },
  featureIcon: {
    fontSize: '24px',
    display: 'block',
    marginBottom: '10px',
  },
  featureTitle: {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '6px',
  },
  featureDesc: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
  },
};
