import { memo, useDeferredValue, type ComponentPropsWithoutRef, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { CodeBlock } from "./CodeBlock";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function extractLanguage(className?: string): string | undefined {
  if (!className) return undefined;
  const match = className.match(/language-(\w+)/);
  return match ? match[1] : undefined;
}

function extractText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in node) {
    return extractText(
      (node as { props: { children?: ReactNode } }).props.children,
    );
  }
  return "";
}

const components: Record<
  string,
  React.ComponentType<ComponentPropsWithoutRef<any>>
> = {
  pre({ children, ...props }: ComponentPropsWithoutRef<"pre">) {
    // react-markdown wraps code blocks in <pre><code>...</code></pre>
    // Intercept <pre> to render our CodeBlock with copy button
    if (children && typeof children === "object" && "props" in children) {
      const codeElement = children as {
        props: { className?: string; children?: ReactNode };
      };
      const lang = extractLanguage(codeElement.props?.className);
      const raw = extractText(codeElement.props?.children);
      return (
        <CodeBlock language={lang} raw={raw}>
          {codeElement.props?.children}
        </CodeBlock>
      );
    }
    return <pre {...props}>{children}</pre>;
  },

  code({ className, children, ...props }: ComponentPropsWithoutRef<"code">) {
    // Block code (inside pre) has hljs/language- classes - render as-is for CodeBlock
    const isBlock =
      className &&
      (className.includes("hljs") || className.includes("language-"));
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    // Inline code
    return (
      <code
        className="font-mono text-[0.85em] bg-input px-1.5 py-0.5 rounded border border-border break-all"
        {...props}
      >
        {children}
      </code>
    );
  },

  a({ href, children, ...props }: ComponentPropsWithoutRef<"a">) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
        {...props}
      >
        {children}
      </a>
    );
  },

  table({ children, ...props }: ComponentPropsWithoutRef<"table">) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="w-full border-collapse text-[0.85em]" {...props}>
          {children}
        </table>
      </div>
    );
  },

  th({ children, ...props }: ComponentPropsWithoutRef<"th">) {
    return (
      <th
        className="border border-border px-3 py-1.5 text-left font-semibold bg-secondary"
        {...props}
      >
        {children}
      </th>
    );
  },

  td({ children, ...props }: ComponentPropsWithoutRef<"td">) {
    return (
      <td className="border border-border px-3 py-1.5 text-left" {...props}>
        {children}
      </td>
    );
  },

  blockquote({ children, ...props }: ComponentPropsWithoutRef<"blockquote">) {
    return (
      <blockquote
        className="border-l-[3px] border-primary pl-3 my-2 text-muted-foreground"
        {...props}
      >
        {children}
      </blockquote>
    );
  },

  hr(props: ComponentPropsWithoutRef<"hr">) {
    return (
      <hr className="border-none border-t border-border my-3" {...props} />
    );
  },
};

// remarkPlugins/rehypePlugins 배열을 모듈 레벨에서 고정 (매 렌더마다 재생성 방지)
const remarkPlugins = [remarkGfm];
// hljs에 등록된 언어만 사용하도록 subset 지정
const rehypeHighlightOptions = { detect: false };
const rehypePlugins: [typeof rehypeHighlight, typeof rehypeHighlightOptions][] = [[rehypeHighlight, rehypeHighlightOptions]];

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  // 스트리밍 중 빈번한 content 업데이트 시 React가 마크다운 파싱을 지연하여 프레임 드롭 방지
  const deferredContent = useDeferredValue(content);

  if (!deferredContent) return null;

  return (
    <div className={cn("prose-chat", className)}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {deferredContent}
      </ReactMarkdown>
    </div>
  );
});
