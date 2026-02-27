import { EditorView } from "@codemirror/view";
import { useRef, useCallback } from "react";

export interface MemoEditorRegistry {
  register: (blockId: string, view: EditorView) => void;
  unregister: (blockId: string) => void;
  getView: (blockId: string) => EditorView | null;
  getContent: (blockId: string) => string | null;
  focusEnd: (blockId: string) => void;
  focusAt: (blockId: string, position: number) => void;
}

export function useMemoEditorRegistry(): MemoEditorRegistry {
  const registryRef = useRef<Map<string, EditorView>>(new Map());

  const register = useCallback((blockId: string, view: EditorView) => {
    registryRef.current.set(blockId, view);
  }, []);

  const unregister = useCallback((blockId: string) => {
    registryRef.current.delete(blockId);
  }, []);

  const getView = useCallback((blockId: string) => {
    return registryRef.current.get(blockId) ?? null;
  }, []);

  const getContent = useCallback((blockId: string) => {
    const view = registryRef.current.get(blockId);
    return view ? view.state.doc.toString() : null;
  }, []);

  const focusEnd = useCallback((blockId: string) => {
    const view = registryRef.current.get(blockId);
    if (view) {
      const len = view.state.doc.length;
      view.dispatch({ selection: { anchor: len } });
      view.focus();
    }
  }, []);

  const focusAt = useCallback((blockId: string, position: number) => {
    const view = registryRef.current.get(blockId);
    if (view) {
      const pos = Math.min(position, view.state.doc.length);
      view.dispatch({ selection: { anchor: pos } });
      view.focus();
    }
  }, []);

  return { register, unregister, getView, getContent, focusEnd, focusAt };
}
