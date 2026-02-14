import { useState, useRef, useCallback, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  language?: string;
  children: ReactNode;
  raw?: string;
  className?: string;
}

export function CodeBlock({
  language,
  children,
  raw,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const codeRef = useRef<HTMLElement>(null);

  const handleCopy = useCallback(async () => {
    const text = raw || codeRef.current?.textContent || "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API might not be available
    }
  }, [raw]);

  return (
    <div className={cn("group relative my-2", className)}>
      <div className="flex items-center justify-between bg-secondary/80 border border-border rounded-t-sm px-3 py-1">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1 font-mono text-[10px] transition-colors px-1.5 py-0.5 rounded",
            copied
              ? "text-success"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary",
          )}
          aria-label={copied ? "복사됨" : "코드 복사"}
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
      <pre className="font-mono text-xs bg-input border border-t-0 border-border rounded-b-sm px-3 py-2.5 overflow-auto whitespace-pre leading-relaxed max-h-[500px]">
        <code ref={codeRef}>{children}</code>
      </pre>
    </div>
  );
}
