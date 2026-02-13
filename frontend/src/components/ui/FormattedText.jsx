import React from 'react';

/**
 * 텍스트에서 코드 블록과 인라인 코드를 감지하여 포맷팅하는 공유 컴포넌트.
 */
export function FormattedText({ text }) {
  if (!text) return null;

  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3);
          const firstNewline = lines.indexOf('\n');
          const lang =
            firstNewline > 0 ? lines.slice(0, firstNewline).trim() : '';
          const code =
            firstNewline > 0 ? lines.slice(firstNewline + 1) : lines;
          return (
            <pre key={i} style={styles.codeBlock}>
              {lang ? <div style={styles.codeLang}>{lang}</div> : null}
              <code>{code}</code>
            </pre>
          );
        }
        const inlineParts = part.split(/(`[^`]+`)/g);
        return (
          <span key={i}>
            {inlineParts.map((ip, j) => {
              if (ip.startsWith('`') && ip.endsWith('`')) {
                return (
                  <code key={j} style={styles.inlineCode}>
                    {ip.slice(1, -1)}
                  </code>
                );
              }
              return <span key={j}>{ip}</span>;
            })}
          </span>
        );
      })}
    </>
  );
}

const styles = {
  codeBlock: {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 12px',
    margin: '8px 0',
    overflow: 'auto',
    whiteSpace: 'pre',
    lineHeight: 1.5,
  },
  codeLang: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--text-dim)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  inlineCode: {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    background: 'var(--bg-input)',
    padding: '1px 5px',
    borderRadius: '3px',
    border: '1px solid var(--border)',
  },
};
