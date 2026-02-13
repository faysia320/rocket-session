import React, { useState } from 'react';
import { FormattedText } from '../../../components/ui/FormattedText';

export function MessageBubble({ message }) {
  const { type } = message;

  switch (type) {
    case 'user_message':
      return <UserMessage message={message.message || message} />;
    case 'assistant_text':
      return <AssistantText message={message} />;
    case 'result':
      return <ResultMessage message={message} />;
    case 'tool_use':
      return <ToolUseMessage message={message} />;
    case 'file_change':
      return <FileChangeMessage message={message} />;
    case 'error':
      return <ErrorMessage message={message} />;
    case 'stderr':
      return <StderrMessage message={message} />;
    case 'system':
      return <SystemMessage message={message} />;
    case 'event':
      return <EventMessage message={message} />;
    default:
      return null;
  }
}

function UserMessage({ message }) {
  return (
    <div style={styles.userRow}>
      <div style={styles.userBubble}>
        <div style={styles.userLabel}>You</div>
        <div style={styles.userText}>{message.content || message.prompt}</div>
      </div>
    </div>
  );
}

function AssistantText({ message }) {
  return (
    <div style={styles.assistantRow}>
      <div style={styles.assistantBubble}>
        <div style={styles.assistantLabel}>
          <span style={styles.claudeIcon}>{'\u25C6'}</span> Claude
          <span style={styles.streaming}>streaming{'\u2026'}</span>
        </div>
        <div style={styles.assistantText}>
          <FormattedText text={message.text} />
        </div>
      </div>
    </div>
  );
}

function ResultMessage({ message }) {
  return (
    <div style={styles.assistantRow}>
      <div style={styles.resultBubble}>
        <div style={styles.assistantLabel}>
          <span style={styles.claudeIcon}>{'\u25C6'}</span> Claude
        </div>
        <div style={styles.assistantText}>
          <FormattedText text={message.text} />
        </div>
        {(message.cost || message.duration_ms) ? (
          <div style={styles.resultMeta}>
            {message.cost ? (
              <span style={styles.metaChip}>
                {'\u{1F4B0}'} ${Number(message.cost).toFixed(4)}
              </span>
            ) : null}
            {message.duration_ms ? (
              <span style={styles.metaChip}>
                {'\u23F1'} {(message.duration_ms / 1000).toFixed(1)}s
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ToolUseMessage({ message }) {
  const [expanded, setExpanded] = useState(false);
  const toolName = message.tool || 'Tool';
  const input = message.input || {};

  const getToolColor = (name) => {
    const colors = {
      Write: '#22c55e',
      Edit: '#3b82f6',
      MultiEdit: '#3b82f6',
      Read: '#8b5cf6',
      Bash: '#f59e0b',
      Grep: '#ec4899',
      Glob: '#06b6d4',
      TodoWrite: '#14b8a6',
    };
    return colors[name] || '#94a3b8';
  };

  return (
    <div style={styles.toolRow} onClick={() => setExpanded((p) => !p)}>
      <div style={styles.toolBubble}>
        <div style={styles.toolHeader}>
          <span
            style={{ ...styles.toolDot, backgroundColor: getToolColor(toolName) }}
          />
          <span style={styles.toolName}>{toolName}</span>
          {input.file_path || input.path || input.command ? (
            <span style={styles.toolTarget}>
              {input.file_path ||
                input.path ||
                (input.command?.slice(0, 60) +
                  (input.command?.length > 60 ? '\u2026' : ''))}
            </span>
          ) : null}
          <span style={styles.expandIcon}>{expanded ? '\u25BE' : '\u25B8'}</span>
        </div>
        {expanded ? (
          <pre style={styles.toolDetail}>{JSON.stringify(input, null, 2)}</pre>
        ) : null}
      </div>
    </div>
  );
}

function FileChangeMessage({ message }) {
  return (
    <div style={styles.fileChangeRow}>
      <span style={styles.fileIcon}>{'\u{1F4DD}'}</span>
      <span style={styles.fileText}>
        {message.change?.tool}:{' '}
        <code style={styles.filePath}>{message.change?.file}</code>
      </span>
    </div>
  );
}

function ErrorMessage({ message }) {
  return (
    <div style={styles.errorRow}>
      <div style={styles.errorBubble}>
        <span style={styles.errorIcon}>{'\u26A0'}</span>
        <span style={styles.errorText}>{message.message || message.text}</span>
      </div>
    </div>
  );
}

function StderrMessage({ message }) {
  return (
    <div style={styles.stderrRow}>
      <pre style={styles.stderrText}>{message.text}</pre>
    </div>
  );
}

function SystemMessage({ message }) {
  return (
    <div style={styles.systemRow}>
      <span style={styles.systemText}>{message.text}</span>
    </div>
  );
}

function EventMessage({ message }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={styles.eventRow} onClick={() => setExpanded((p) => !p)}>
      <span style={styles.eventLabel}>
        Event: {message.event?.type || 'unknown'}
      </span>
      {expanded ? (
        <pre style={styles.eventDetail}>
          {JSON.stringify(message.event, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

const styles = {
  userRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    animation: 'fadeIn 0.2s ease',
  },
  userBubble: {
    maxWidth: '80%',
    padding: '10px 14px',
    background: 'var(--accent)',
    color: 'var(--bg-primary)',
    borderRadius: '12px 12px 4px 12px',
  },
  userLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    fontWeight: 600,
    opacity: 0.7,
    marginBottom: '4px',
  },
  userText: {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  assistantRow: {
    display: 'flex',
    animation: 'fadeIn 0.2s ease',
  },
  assistantBubble: {
    maxWidth: '85%',
    padding: '12px 14px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: '12px 12px 12px 4px',
  },
  resultBubble: {
    maxWidth: '85%',
    padding: '12px 14px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-bright)',
    borderRadius: '12px 12px 12px 4px',
  },
  assistantLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '6px',
  },
  claudeIcon: {
    color: 'var(--accent)',
    fontSize: '12px',
  },
  streaming: {
    color: 'var(--accent)',
    animation: 'pulse 1.5s ease-in-out infinite',
    marginLeft: '4px',
  },
  assistantText: {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    lineHeight: 1.6,
    color: 'var(--text-primary)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  resultMeta: {
    display: 'flex',
    gap: '8px',
    marginTop: '10px',
    paddingTop: '8px',
    borderTop: '1px solid var(--border)',
  },
  metaChip: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--text-muted)',
    background: 'var(--bg-secondary)',
    padding: '2px 8px',
    borderRadius: '8px',
  },
  toolRow: {
    animation: 'slideInLeft 0.2s ease',
    cursor: 'pointer',
  },
  toolBubble: {
    padding: '8px 12px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    borderLeft: '3px solid var(--info)',
  },
  toolHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  toolDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  toolName: {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  toolTarget: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--text-muted)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  expandIcon: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--text-dim)',
  },
  toolDetail: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--text-secondary)',
    background: 'var(--bg-input)',
    padding: '8px',
    borderRadius: 'var(--radius-sm)',
    marginTop: '6px',
    overflow: 'auto',
    maxHeight: '200px',
    whiteSpace: 'pre-wrap',
  },
  fileChangeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    animation: 'fadeIn 0.2s ease',
  },
  fileIcon: { fontSize: '12px' },
  fileText: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  filePath: {
    color: 'var(--accent)',
    background: 'var(--accent-glow)',
    padding: '1px 4px',
    borderRadius: '3px',
  },
  errorRow: { animation: 'fadeIn 0.2s ease' },
  errorBubble: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 'var(--radius-sm)',
  },
  errorIcon: { fontSize: '14px' },
  errorText: {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    color: 'var(--error)',
  },
  stderrRow: {
    padding: '4px 8px',
    animation: 'fadeIn 0.2s ease',
  },
  stderrText: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--warning)',
    whiteSpace: 'pre-wrap',
    opacity: 0.7,
  },
  systemRow: {
    textAlign: 'center',
    padding: '4px',
    animation: 'fadeIn 0.2s ease',
  },
  systemText: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--text-dim)',
    fontStyle: 'italic',
  },
  eventRow: {
    padding: '4px 8px',
    cursor: 'pointer',
    animation: 'fadeIn 0.2s ease',
  },
  eventLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--text-dim)',
  },
  eventDetail: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--text-muted)',
    background: 'var(--bg-input)',
    padding: '6px',
    borderRadius: '4px',
    marginTop: '4px',
    maxHeight: '120px',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
  },
};
