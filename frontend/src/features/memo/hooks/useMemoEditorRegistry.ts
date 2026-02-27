import { useRef, useCallback } from "react";

export interface MemoEditorRegistry {
  register: (blockId: string, el: HTMLDivElement) => void;
  unregister: (blockId: string) => void;
  getElement: (blockId: string) => HTMLDivElement | null;
  getContent: (blockId: string) => string | null;
  setContent: (blockId: string, content: string) => void;
  focusEnd: (blockId: string) => void;
  focusAt: (blockId: string, position: number) => void;
}

export function useMemoEditorRegistry(): MemoEditorRegistry {
  const registryRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const register = useCallback((blockId: string, el: HTMLDivElement) => {
    registryRef.current.set(blockId, el);
  }, []);

  const unregister = useCallback((blockId: string) => {
    registryRef.current.delete(blockId);
  }, []);

  const getElement = useCallback((blockId: string) => {
    return registryRef.current.get(blockId) ?? null;
  }, []);

  const getContent = useCallback((blockId: string) => {
    const el = registryRef.current.get(blockId);
    return el ? el.innerText : null;
  }, []);

  const setContent = useCallback((blockId: string, content: string) => {
    const el = registryRef.current.get(blockId);
    if (el) el.textContent = content;
  }, []);

  const focusEnd = useCallback((blockId: string) => {
    const el = registryRef.current.get(blockId);
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    if (el.childNodes.length > 0) {
      const lastNode = el.childNodes[el.childNodes.length - 1];
      if (lastNode.nodeType === Node.TEXT_NODE) {
        range.setStart(lastNode, lastNode.textContent?.length ?? 0);
      } else {
        range.setStartAfter(lastNode);
      }
    } else {
      range.setStart(el, 0);
    }
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  const focusAt = useCallback((blockId: string, position: number) => {
    const el = registryRef.current.get(blockId);
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;

    // Walk text nodes to find the right position
    let remaining = position;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const len = node.textContent?.length ?? 0;
      if (remaining <= len) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
      node = walker.nextNode();
    }
    // Fallback: place at end
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  return { register, unregister, getElement, getContent, setContent, focusEnd, focusAt };
}
