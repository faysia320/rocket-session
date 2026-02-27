import { memo, useEffect, useRef } from "react";
import { EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { defaultKeymap } from "@codemirror/commands";

interface MemoBlockEditorProps {
  initialContent: string;
  onChange: (content: string) => void;
  onCtrlEnter: () => void;
  autoFocus?: boolean;
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
  },
  { dark: true },
);

export const MemoBlockEditor = memo(function MemoBlockEditor({
  initialContent,
  onChange,
  onCtrlEnter,
  autoFocus = false,
}: MemoBlockEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onCtrlEnterRef = useRef(onCtrlEnter);

  onChangeRef.current = onChange;
  onCtrlEnterRef.current = onCtrlEnter;

  useEffect(() => {
    if (!containerRef.current) return;

    const ctrlEnterKeymap = keymap.of([
      {
        key: "Ctrl-Enter",
        mac: "Cmd-Enter",
        run: () => {
          onCtrlEnterRef.current();
          return true;
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

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        ctrlEnterKeymap,
        keymap.of(defaultKeymap),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        memoTheme,
        placeholderExt("Type something..."),
        EditorView.lineWrapping,
        preventGlobalShortcuts,
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
