import { memo, useRef, type ComponentPropsWithoutRef, type ReactNode, type ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeHighlightLite from "@/lib/rehypeHighlightLite";
import { CodeBlock } from "./CodeBlock";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  enableBreaks?: boolean;
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
    return extractText((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- react-markdown component overrides require generic any
const components: Record<string, React.ComponentType<ComponentPropsWithoutRef<any>>> = {
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
    const isBlock = className && (className.includes("hljs") || className.includes("language-"));
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
    return <hr className="border-none border-t border-border my-3" {...props} />;
  },
};

// remarkPlugins/rehypePlugins 배열을 모듈 레벨에서 고정 (매 렌더마다 재생성 방지)
const remarkPlugins = [remarkGfm];
const remarkPluginsWithBreaks = [remarkGfm, remarkBreaks];
// 커스텀 경량 플러그인 (17개 언어 서브셋만 번들)
const rehypePlugins = [rehypeHighlightLite];

/**
 * 인스턴스별 렌더링 캐시: 동일 content + enableBreaks 조합에 대해
 * ReactMarkdown의 AST 파싱 결과(ReactElement)를 재사용.
 * 스트리밍 중에는 content가 매번 변하므로 캐시 미스 → 정상 렌더링.
 * 완료된 메시지는 content 불변 → 캐시 히트 → AST 재파싱 건너뜀.
 */
const CACHE_MAX_SIZE = 128;

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
  enableBreaks = false,
}: MarkdownRendererProps) {
  // 인스턴스별 캐시 (Map은 삽입 순서 유지 → LRU 구현 가능)
  const cacheRef = useRef<Map<string, ReactElement>>(new Map());

  if (!content) return null;

  const cacheKey = enableBreaks ? `b:${content}` : content;
  const cache = cacheRef.current;
  let rendered = cache.get(cacheKey);

  if (!rendered) {
    rendered = (
      <ReactMarkdown
        remarkPlugins={enableBreaks ? remarkPluginsWithBreaks : remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {content}
      </ReactMarkdown>
    );

    // LRU 퇴거: 캐시 크기 초과 시 가장 오래된 항목 제거
    if (cache.size >= CACHE_MAX_SIZE) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) cache.delete(firstKey);
    }
    cache.set(cacheKey, rendered);
  } else {
    // 캐시 히트 시 LRU 갱신: 삭제 후 재삽입으로 순서 갱신
    cache.delete(cacheKey);
    cache.set(cacheKey, rendered);
  }

  return (
    <div className={cn("prose-chat", className)}>
      {rendered}
    </div>
  );
});
