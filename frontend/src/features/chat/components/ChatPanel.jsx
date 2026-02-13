import React, { useState, useRef, useEffect } from 'react';
import { useClaudeSocket } from '../hooks/useClaudeSocket';
import { MessageBubble } from './MessageBubble';

/**
 * 메인 채팅 인터페이스.
 * onFileChanges 콜백을 통해 파일 변경 사항을 상위로 전달합니다.
 */
export function ChatPanel({ sessionId, onToggleFiles, showFiles, onFileChanges }) {
  const { connected, messages, status, sessionInfo, fileChanges, sendPrompt, stopExecution } =
    useClaudeSocket(sessionId);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 파일 변경 사항을 상위 컴포넌트로 전달
  useEffect(() => {
    if (onFileChanges) {
      onFileChanges(fileChanges);
    }
  }, [fileChanges, onFileChanges]);

  const handleSubmit = () => {
    const prompt = input.trim();
    if (!prompt || status === 'running') return;
    sendPrompt(prompt);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = '44px';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  };

  return (
    <div style={styles.container}>
      {/* Top bar */}
      <div style={styles.topbar}>
        <div style={styles.topLeft}>
          <span
            style={{
              ...styles.connDot,
              backgroundColor: connected ? 'var(--success)' : 'var(--error)',
              boxShadow: connected ? '0 0 8px var(--success)' : 'none',
            }}
          />
          <span style={styles.topLabel}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          {sessionInfo?.claude_session_id ? (
            <>
              <span style={styles.separator}>|</span>
              <span style={styles.topMeta}>
                Claude Session: {sessionInfo.claude_session_id.slice(0, 12)}{'\u2026'}
              </span>
            </>
          ) : null}
        </div>
        <div style={styles.topRight}>
          {status === 'running' ? (
            <div style={styles.runningBadge}>
              <span style={styles.spinner} />
              Running
            </div>
          ) : null}
          <button
            style={{
              ...styles.iconBtn,
              background: showFiles ? 'var(--bg-tertiary)' : 'transparent',
            }}
            onClick={onToggleFiles}
            title="Toggle file panel"
          >
            {'\u{1F4C1}'}
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div style={styles.messages}>
        {messages.length === 0 ? (
          <div style={styles.emptyChat}>
            <div style={styles.emptyChatIcon}>{'>'}_</div>
            <div style={styles.emptyChatText}>
              Send a prompt to start working with Claude Code
            </div>
          </div>
        ) : null}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={styles.inputArea}>
        <div style={styles.inputWrapper}>
          <textarea
            ref={textareaRef}
            style={styles.textarea}
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Enter a prompt for Claude Code\u2026"
            rows={1}
            disabled={!connected}
          />
          <div style={styles.inputActions}>
            {status === 'running' ? (
              <button style={styles.stopBtn} onClick={stopExecution}>
                {'\u25A0'} Stop
              </button>
            ) : (
              <button
                style={{
                  ...styles.sendBtn,
                  opacity: input.trim() && connected ? 1 : 0.4,
                }}
                onClick={handleSubmit}
                disabled={!input.trim() || !connected}
              >
                Send {'\u21B5'}
              </button>
            )}
          </div>
        </div>
        <div style={styles.inputHint}>
          Shift+Enter for new line {'\u00B7'} Commands are sent to Claude Code CLI
          via <code style={styles.code}>--output-format stream-json</code>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRight: '1px solid var(--border)',
  },
  topbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    minHeight: '44px',
  },
  topLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  connDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    transition: 'all 0.3s',
  },
  topLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  separator: {
    color: 'var(--text-dim)',
    fontSize: '12px',
  },
  topMeta: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--text-dim)',
  },
  topRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  runningBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    background: 'rgba(245,158,11,0.12)',
    borderRadius: '12px',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--accent)',
  },
  spinner: {
    width: '10px',
    height: '10px',
    border: '2px solid var(--accent-dim)',
    borderTop: '2px solid var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    display: 'inline-block',
  },
  iconBtn: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.15s',
  },
  messages: {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  emptyChat: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    opacity: 0.5,
  },
  emptyChatIcon: {
    fontFamily: 'var(--font-mono)',
    fontSize: '32px',
    color: 'var(--accent)',
    animation: 'blink 1.2s ease-in-out infinite',
  },
  emptyChatText: {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    color: 'var(--text-muted)',
  },
  inputArea: {
    padding: '12px 16px 14px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '4px 4px 4px 14px',
    transition: 'border-color 0.2s',
  },
  textarea: {
    flex: 1,
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    color: 'var(--text-primary)',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    resize: 'none',
    height: '44px',
    lineHeight: '22px',
    padding: '11px 0',
  },
  inputActions: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 0',
  },
  sendBtn: {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    fontWeight: 600,
    padding: '8px 16px',
    background: 'var(--accent)',
    color: 'var(--bg-primary)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  stopBtn: {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    fontWeight: 600,
    padding: '8px 16px',
    background: 'var(--error)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  inputHint: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--text-dim)',
    marginTop: '6px',
    paddingLeft: '2px',
  },
  code: {
    fontFamily: 'var(--font-mono)',
    background: 'var(--bg-tertiary)',
    padding: '1px 4px',
    borderRadius: '3px',
    fontSize: '10px',
  },
};
