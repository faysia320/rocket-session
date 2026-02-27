/**
 * 옵시디안 스타일 라이브 마크다운 프리뷰 CodeMirror 6 확장.
 *
 * 커서가 있는 줄은 원본 마크다운을 표시하고,
 * 나머지 줄은 서식이 적용된 데코레이션을 표시합니다.
 */
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { type EditorState, RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

// ── Widget 클래스 ──

class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.textContent = "\u2022";
    span.className = "cm-md-bullet";
    return span;
  }
}

class OrderedNumberWidget extends WidgetType {
  constructor(private num: string) {
    super();
  }
  toDOM() {
    const span = document.createElement("span");
    span.textContent = `${this.num}`;
    span.className = "cm-md-ordered-number";
    return span;
  }
}

class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement("hr");
    hr.className = "cm-md-hr";
    return hr;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(private checked: boolean) {
    super();
  }
  toDOM() {
    const span = document.createElement("span");
    span.textContent = this.checked ? "\u2611" : "\u2610";
    span.className = "cm-md-checkbox";
    return span;
  }
}

// ── 데코레이션 마크 (재사용) ──

const headingDecos: Record<string, Decoration> = {
  ATXHeading1: Decoration.mark({ class: "cm-md-heading1" }),
  ATXHeading2: Decoration.mark({ class: "cm-md-heading2" }),
  ATXHeading3: Decoration.mark({ class: "cm-md-heading3" }),
  ATXHeading4: Decoration.mark({ class: "cm-md-heading4" }),
  ATXHeading5: Decoration.mark({ class: "cm-md-heading5" }),
  ATXHeading6: Decoration.mark({ class: "cm-md-heading6" }),
};

const strongDeco = Decoration.mark({ class: "cm-md-strong" });
const emphasisDeco = Decoration.mark({ class: "cm-md-emphasis" });
const strikethroughDeco = Decoration.mark({ class: "cm-md-strikethrough" });
const inlineCodeDeco = Decoration.mark({ class: "cm-md-inline-code" });
const linkTextDeco = Decoration.mark({ class: "cm-md-link" });
const blockquoteLineDeco = Decoration.line({ class: "cm-md-blockquote-line" });

// ── 유틸리티 ──

function getActiveLines(state: EditorState): Set<number> {
  const active = new Set<number>();
  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from).number;
    const endLine = state.doc.lineAt(range.to).number;
    for (let l = startLine; l <= endLine; l++) active.add(l);
  }
  return active;
}

function isLineActive(
  activeLines: Set<number>,
  from: number,
  to: number,
  state: EditorState,
): boolean {
  const startLine = state.doc.lineAt(from).number;
  const endLine = state.doc.lineAt(to).number;
  for (let l = startLine; l <= endLine; l++) {
    if (activeLines.has(l)) return true;
  }
  return false;
}

// ── 데코레이션 수집기 ──

interface PendingDeco {
  from: number;
  to: number;
  deco: Decoration;
}

function collectDecorations(state: EditorState): PendingDeco[] {
  const activeLines = getActiveLines(state);
  const result: PendingDeco[] = [];
  const tree = syntaxTree(state);

  tree.iterate({
    enter(node) {
      const { name, from, to } = node;

      // 커서가 있는 줄은 원본 표시
      if (isLineActive(activeLines, from, to, state)) {
        // 활성 줄의 자식은 순회할 필요 없음 (원본 표시)
        // 다만 블록 레벨 노드(Blockquote 등)는 여러 줄을 걸칠 수 있으므로
        // 블록 노드는 건너뛰지 않고, 인라인 노드만 건너뛴다
        const blockNodes = new Set([
          "Document",
          "Blockquote",
          "BulletList",
          "OrderedList",
          "ListItem",
          "FencedCode",
          "Paragraph",
        ]);
        if (!blockNodes.has(name)) return false;
        return;
      }

      // ── Headings ──
      if (name.startsWith("ATXHeading")) {
        const headingDeco = headingDecos[name];
        if (!headingDeco) return;

        // HeaderMark(# 기호) 찾기
        const cursor = node.node.cursor();
        if (cursor.firstChild()) {
          do {
            if (cursor.name === "HeaderMark") {
              // # 기호와 뒤따르는 공백을 숨김
              const markEnd = Math.min(cursor.to + 1, to);
              result.push({
                from: cursor.from,
                to: markEnd,
                deco: Decoration.replace({}),
              });
            }
          } while (cursor.nextSibling());
        }
        // 전체 헤딩 텍스트에 스타일 적용
        result.push({ from, to, deco: headingDeco });
        return false; // 자식 더 이상 순회 불필요
      }

      // ── StrongEmphasis (**bold**) ──
      if (name === "StrongEmphasis") {
        // EmphasisMark 숨기기
        const cursor = node.node.cursor();
        if (cursor.firstChild()) {
          do {
            if (cursor.name === "EmphasisMark") {
              result.push({
                from: cursor.from,
                to: cursor.to,
                deco: Decoration.replace({}),
              });
            }
          } while (cursor.nextSibling());
        }
        result.push({ from, to, deco: strongDeco });
        return false;
      }

      // ── Emphasis (*italic*) ──
      if (name === "Emphasis") {
        const cursor = node.node.cursor();
        if (cursor.firstChild()) {
          do {
            if (cursor.name === "EmphasisMark") {
              result.push({
                from: cursor.from,
                to: cursor.to,
                deco: Decoration.replace({}),
              });
            }
          } while (cursor.nextSibling());
        }
        result.push({ from, to, deco: emphasisDeco });
        return false;
      }

      // ── Strikethrough (~~text~~) ──
      if (name === "Strikethrough") {
        const cursor = node.node.cursor();
        if (cursor.firstChild()) {
          do {
            if (cursor.name === "StrikethroughMark") {
              result.push({
                from: cursor.from,
                to: cursor.to,
                deco: Decoration.replace({}),
              });
            }
          } while (cursor.nextSibling());
        }
        result.push({ from, to, deco: strikethroughDeco });
        return false;
      }

      // ── InlineCode (`code`) ──
      if (name === "InlineCode") {
        const cursor = node.node.cursor();
        if (cursor.firstChild()) {
          do {
            if (cursor.name === "CodeMark") {
              result.push({
                from: cursor.from,
                to: cursor.to,
                deco: Decoration.replace({}),
              });
            }
          } while (cursor.nextSibling());
        }
        result.push({ from, to, deco: inlineCodeDeco });
        return false;
      }

      // ── Link ([text](url)) ──
      if (name === "Link") {
        const cursor = node.node.cursor();
        let linkTextFrom = from;
        let linkTextTo = to;
        const marksToHide: { from: number; to: number }[] = [];

        if (cursor.firstChild()) {
          do {
            if (cursor.name === "LinkMark") {
              marksToHide.push({ from: cursor.from, to: cursor.to });
              // [ 다음이 텍스트 시작
              if (state.sliceDoc(cursor.from, cursor.to) === "[") {
                linkTextFrom = cursor.to;
              }
              // ] 전이 텍스트 끝
              if (state.sliceDoc(cursor.from, cursor.to) === "]") {
                linkTextTo = cursor.from;
              }
            }
            if (cursor.name === "URL") {
              // (url) 전체를 숨김 - 앞의 ( 와 뒤의 ) 포함
              marksToHide.push({ from: cursor.from - 1, to: cursor.to + 1 });
            }
          } while (cursor.nextSibling());
        }

        for (const mark of marksToHide) {
          result.push({
            from: mark.from,
            to: mark.to,
            deco: Decoration.replace({}),
          });
        }
        if (linkTextFrom < linkTextTo) {
          result.push({
            from: linkTextFrom,
            to: linkTextTo,
            deco: linkTextDeco,
          });
        }
        return false;
      }

      // ── Blockquote (> text) ──
      if (name === "QuoteMark") {
        const line = state.doc.lineAt(from);
        // > 기호와 공백 숨기기
        const markEnd = Math.min(to + 1, line.to);
        result.push({ from, to: markEnd, deco: Decoration.replace({}) });
        // 해당 줄에 blockquote 스타일
        result.push({
          from: line.from,
          to: line.from,
          deco: blockquoteLineDeco,
        });
      }

      // ── HorizontalRule (---) ──
      if (name === "HorizontalRule") {
        result.push({
          from,
          to,
          deco: Decoration.replace({ widget: new HrWidget() }),
        });
        return false;
      }

      // ── ListMark (- or * or 1.) ──
      if (name === "ListMark") {
        const text = state.sliceDoc(from, to);
        const markEnd = Math.min(to + 1, state.doc.lineAt(from).to);

        // 체크박스 확인: - [ ] 또는 - [x]
        const afterMark = state.sliceDoc(to, to + 4);
        const checkMatch = afterMark.match(/^\s\[([ xX])\]/);
        if (checkMatch) {
          const isChecked = checkMatch[1] !== " ";
          result.push({
            from,
            to: to + 4, // "- [x]" 전체 대체
            deco: Decoration.replace({
              widget: new CheckboxWidget(isChecked),
            }),
          });
          return;
        }

        if (/^\d+[.)]$/.test(text)) {
          // 순서 있는 리스트
          result.push({
            from,
            to: markEnd,
            deco: Decoration.replace({
              widget: new OrderedNumberWidget(text),
            }),
          });
        } else {
          // 비순서 리스트
          result.push({
            from,
            to: markEnd,
            deco: Decoration.replace({ widget: new BulletWidget() }),
          });
        }
      }

      // FencedCode는 그대로 표시 (코드 블록은 원본 유지)
      if (name === "FencedCode") {
        return false;
      }
    },
  });

  return result;
}

function buildDecorations(state: EditorState): DecorationSet {
  const pending = collectDecorations(state);

  // DecorationSet은 from 순서대로 정렬되어야 함
  pending.sort((a, b) => a.from - b.from || a.to - b.to);

  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to, deco } of pending) {
    if (from <= to) {
      builder.add(from, to, deco);
    }
  }
  return builder.finish();
}

// ── ViewPlugin ──

export const liveMarkdownPreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view.state);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged
      ) {
        this.decorations = buildDecorations(update.view.state);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

// ── 테마 ──

export const liveMarkdownTheme = EditorView.theme(
  {
    ".cm-md-heading1": {
      fontSize: "1.3em",
      fontWeight: "700",
      lineHeight: "1.4",
    },
    ".cm-md-heading2": {
      fontSize: "1.15em",
      fontWeight: "600",
      color: "hsl(var(--primary))",
      lineHeight: "1.4",
    },
    ".cm-md-heading3": {
      fontSize: "1.05em",
      fontWeight: "600",
      lineHeight: "1.4",
    },
    ".cm-md-heading4, .cm-md-heading5, .cm-md-heading6": {
      fontSize: "1em",
      fontWeight: "600",
      lineHeight: "1.4",
    },
    ".cm-md-strong": {
      fontWeight: "600",
    },
    ".cm-md-emphasis": {
      fontStyle: "italic",
    },
    ".cm-md-strikethrough": {
      textDecoration: "line-through",
      opacity: "0.6",
    },
    ".cm-md-inline-code": {
      fontFamily: "var(--font-mono, ui-monospace, monospace)",
      fontSize: "0.88em",
      backgroundColor: "hsl(var(--input))",
      padding: "1px 5px",
      borderRadius: "3px",
      border: "1px solid hsl(var(--border))",
    },
    ".cm-md-link": {
      color: "hsl(var(--primary))",
      textDecoration: "underline",
      textUnderlineOffset: "2px",
    },
    ".cm-md-blockquote-line": {
      borderLeft: "3px solid hsl(var(--primary))",
      paddingLeft: "12px !important",
      color: "hsl(var(--muted-foreground))",
    },
    ".cm-md-bullet": {
      color: "hsl(var(--primary))",
      fontWeight: "700",
      marginRight: "4px",
    },
    ".cm-md-ordered-number": {
      color: "hsl(var(--primary))",
      fontWeight: "500",
      marginRight: "2px",
    },
    ".cm-md-hr": {
      border: "none",
      borderTop: "1px solid hsl(var(--border))",
      margin: "4px 0",
      display: "block",
    },
    ".cm-md-checkbox": {
      fontSize: "1.1em",
      marginRight: "4px",
    },
  },
  { dark: true },
);
