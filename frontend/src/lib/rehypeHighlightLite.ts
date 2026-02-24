/**
 * rehype-highlight 경량 대체 플러그인.
 *
 * rehype-highlight v7은 lowlight v3 전체(~190개 언어, ~700KB)를 번들합니다.
 * 이 플러그인은 lowlight core + 17개 언어 서브셋만 등록하여 번들을 크게 축소합니다.
 */
import { createLowlight } from "lowlight";
import { visit } from "unist-util-visit";
import { toString } from "hast-util-to-string";

// Claude Code 출력에서 사용되는 주요 언어만 등록
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import java from "highlight.js/lib/languages/java";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import sql from "highlight.js/lib/languages/sql";
import yaml from "highlight.js/lib/languages/yaml";
import diff from "highlight.js/lib/languages/diff";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";

import type { Root, Element, ElementContent } from "hast";

const lowlight = createLowlight();

// 언어 등록
lowlight.register("javascript", javascript);
lowlight.register("typescript", typescript);
lowlight.register("python", python);
lowlight.register("bash", bash);
lowlight.register("json", json);
lowlight.register("css", css);
lowlight.register("xml", xml);
lowlight.register("go", go);
lowlight.register("rust", rust);
lowlight.register("java", java);
lowlight.register("c", c);
lowlight.register("cpp", cpp);
lowlight.register("sql", sql);
lowlight.register("yaml", yaml);
lowlight.register("diff", diff);
lowlight.register("markdown", markdown);
lowlight.register("plaintext", plaintext);

// 자주 사용되는 별칭 등록
lowlight.register("js", javascript);
lowlight.register("ts", typescript);
lowlight.register("py", python);
lowlight.register("sh", bash);
lowlight.register("shell", bash);
lowlight.register("zsh", bash);
lowlight.register("yml", yaml);
lowlight.register("html", xml);
lowlight.register("htm", xml);
lowlight.register("svg", xml);
lowlight.register("md", markdown);
lowlight.register("jsonc", json);
lowlight.register("txt", plaintext);
lowlight.register("text", plaintext);

/** className에서 language-xxx 추출 */
function extractLang(classNames: string[]): string | null {
  for (const cls of classNames) {
    if (cls.startsWith("language-")) {
      return cls.slice(9);
    }
  }
  return null;
}

export default function rehypeHighlightLite() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, _index, parent) => {
      if (
        node.tagName !== "code" ||
        !parent ||
        (parent as Element).tagName !== "pre"
      ) {
        return;
      }

      const classNames = (node.properties?.className as string[]) ?? [];
      const lang = extractLang(classNames);
      if (!lang) return;

      try {
        const result = lowlight.highlight(lang, toString(node));
        node.children = result.children as ElementContent[];
        node.properties ??= {};
        node.properties.className = [
          ...classNames.filter((c) => c !== `language-${lang}`),
          `language-${lang}`,
          "hljs",
        ];
      } catch {
        // 미등록 언어는 하이라이팅 없이 통과
      }
    });
  };
}
