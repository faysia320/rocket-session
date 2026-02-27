import { memo, useEffect, useRef } from "react";
import { EditorView, keymap, lineNumbers, placeholder as placeholderExt } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { defaultKeymap } from "@codemirror/commands";
import {
  liveMarkdownPreview,
  liveMarkdownTheme,
} from "../extensions/liveMarkdownPreview";

interface MemoBlockEditorProps {
  initialContent: string;
  onChange: (content: string) => void;
  onCtrlEnter: () => void;
  onBackspaceEmpty: () => void;
  autoFocus?: boolean;
  onBlur?: () => void;
}

const memoTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "transparent",
      fontSize: "13px",
      fontFamily: "var(--font-mono, ui-monospace, monospace)",
    },
    ".cm-content": {
      padding: "8px 12px",
      caretColor: "hsl(var(--foreground))",
      color: "hsl(var(--foreground))",
      minHeight: "1.5em",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-line": { padding: "1px 0" },
    ".cm-cursor": { borderLeftColor: "hsl(var(--primary))" },
    ".cm-selectionBackground": {
      backgroundColor: "hsl(var(--muted)) !important",
    },
    ".cm-placeholder": {
      color: "hsl(var(--muted-foreground))",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      borderRight: "none",
      color: "hsl(var(--muted-foreground) / 0.5)",
      fontSize: "11px",
      fontFamily: "var(--font-mono, ui-monospace, monospace)",
      minWidth: "2em",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 4px 0 4px",
      minWidth: "1.5em",
      textAlign: "right",
    },
  },
  { dark: true },
);

export const MemoBlockEditor = memo(function MemoBlockEditor({
  initialContent,
  onChange,
  onCtrlEnter,
  onBackspaceEmpty,
  autoFocus = false,
  onBlur,
}: MemoBlockEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onCtrlEnterRef = useRef(onCtrlEnter);
  const onBackspaceEmptyRef = useRef(onBackspaceEmpty);
  const onBlurRef = useRef(onBlur);

  onChangeRef.current = onChange;
  onCtrlEnterRef.current = onCtrlEnter;
  onBackspaceEmptyRef.current = onBackspaceEmpty;
  onBlurRef.current = onBlur;

  useEffect(() => {
    if (!containerRef.current) return;

    const customKeymap = keymap.of([
      {
        key: "Ctrl-Enter",
        mac: "Cmd-Enter",
        run: () => {
          onCtrlEnterRef.current();
          return true;
        },
      },
      {
        key: "Backspace",
        run: (view) => {
          if (view.state.doc.length === 0) {
            onBackspaceEmptyRef.current();
            return true;
          }
          return false;
        },
      },
    ]);

    // Ctrl+B 충돌 방지: 에디터 내에서 stopPropagation
    const preventGlobalShortcuts = EditorView.domEventHandlers({
      keydown(event) {
        if ((event.ctrlKey || event.metaKey) && event.key === "b") {
          event.stopPropagation();
        }
      },
    });

    const blurHandler = EditorView.domEventHandlers({
      blur() {
        onBlurRef.current?.();
      },
    });

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        customKeymap,
        keymap.of(defaultKeymap),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        lineNumbers(),
        liveMarkdownPreview,
        liveMarkdownTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        memoTheme,
        placeholderExt("Type something..."),
        EditorView.lineWrapping,
        preventGlobalShortcuts,
        blurHandler,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    if (autoFocus) {
      requestAnimationFrame(() => view.focus());
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} />;
});
