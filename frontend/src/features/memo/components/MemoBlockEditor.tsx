import { memo, useCallback, useLayoutEffect, useRef } from "react";
import type { MemoEditorRegistry } from "../hooks/useMemoEditorRegistry";
import { useMemoUndoStack } from "../hooks/useMemoUndoStack";

interface MemoBlockEditorProps {
  blockId: string;
  editorRegistry: MemoEditorRegistry;
  initialContent: string;
  onChange: (content: string) => void;
  onCtrlEnter: () => void;
  onBackspaceEmpty: () => void;
  onBackspaceAtStart: () => void;
  autoFocus?: boolean;
  onBlur?: () => void;
}

function isCursorAtStart(el: HTMLDivElement): boolean {
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (range.startOffset !== 0) return false;
  // Cursor directly in the element at offset 0
  if (range.startContainer === el) return true;
  // Cursor in the first text node at offset 0
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const firstTextNode = walker.nextNode();
  return range.startContainer === firstTextNode;
}

export const MemoBlockEditor = memo(function MemoBlockEditor({
  blockId,
  editorRegistry,
  initialContent,
  onChange,
  onCtrlEnter,
  onBackspaceEmpty,
  onBackspaceAtStart,
  autoFocus = false,
  onBlur,
}: MemoBlockEditorProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const onCtrlEnterRef = useRef(onCtrlEnter);
  const onBackspaceEmptyRef = useRef(onBackspaceEmpty);
  const onBackspaceAtStartRef = useRef(onBackspaceAtStart);
  const onBlurRef = useRef(onBlur);
  const blockIdRef = useRef(blockId);
  const editorRegistryRef = useRef(editorRegistry);

  onChangeRef.current = onChange;
  onCtrlEnterRef.current = onCtrlEnter;
  onBackspaceEmptyRef.current = onBackspaceEmpty;
  onBackspaceAtStartRef.current = onBackspaceAtStart;
  onBlurRef.current = onBlur;
  blockIdRef.current = blockId;
  editorRegistryRef.current = editorRegistry;

  // Mount: set initial content & register
  useLayoutEffect(() => {
    const el = divRef.current;
    if (!el) return;
    if (initialContent) {
      el.textContent = initialContent;
    }
    editorRegistryRef.current.register(blockIdRef.current, el);
    if (autoFocus) {
      requestAnimationFrame(() => {
        editorRegistryRef.current.focusEnd(blockIdRef.current);
      });
    }
    return () => {
      editorRegistryRef.current.unregister(blockIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = useCallback(() => {
    const el = divRef.current;
    if (!el) return;
    const content = el.innerText;
    // Clear stale <br> so :empty placeholder works
    if (!content || content === "\n") {
      el.textContent = "";
    }
    onChangeRef.current(el.innerText);
    useMemoUndoStack.getState().setLastActionWasStructural(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Ctrl+Enter / Cmd+Enter → create new block
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onCtrlEnterRef.current();
      return;
    }

    // Enter → insert \n instead of <br>/<div>
    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      document.execCommand("insertText", false, "\n");
      return;
    }

    // Backspace
    if (e.key === "Backspace") {
      const el = divRef.current;
      if (!el) return;
      const content = el.innerText;

      // Empty block → delete
      if (!content || content === "\n") {
        e.preventDefault();
        onBackspaceEmptyRef.current();
        return;
      }

      // Cursor at start, no selection → merge with previous
      if (isCursorAtStart(el)) {
        e.preventDefault();
        onBackspaceAtStartRef.current();
        return;
      }
    }

    // Prevent Ctrl+B from propagating
    if ((e.ctrlKey || e.metaKey) && e.key === "b") {
      e.stopPropagation();
    }
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }, []);

  const handleBlur = useCallback(() => {
    onBlurRef.current?.();
  }, []);

  return (
    <div
      ref={divRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onBlur={handleBlur}
      data-block-id={blockId}
      data-placeholder="Type something..."
      className="memo-block-editor outline-none px-3 py-2 min-h-[1.5em] text-[13px] font-mono text-foreground whitespace-pre-wrap break-words caret-primary"
    />
  );
});
