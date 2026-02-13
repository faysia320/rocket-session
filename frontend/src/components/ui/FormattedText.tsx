export function FormattedText({ text }: { text?: string }) {
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
            <pre
              key={i}
              className="font-mono text-xs bg-input border border-border rounded-sm px-3 py-2.5 my-2 overflow-auto whitespace-pre leading-normal"
            >
              {lang ? (
                <div className="font-mono text-[10px] text-muted-foreground/70 mb-1.5 uppercase tracking-wider">
                  {lang}
                </div>
              ) : null}
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
                  <code
                    key={j}
                    className="font-mono text-xs bg-input px-1.5 py-px rounded-[3px] border border-border"
                  >
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
