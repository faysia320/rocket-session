import { create } from "zustand";

interface UndoDeleteBlock {
  type: "delete_block";
  blockId: string;
  content: string;
  previousBlockId: string | null;
  timestamp: number;
}

interface UndoCreateBlock {
  type: "create_block";
  blockId: string;
  timestamp: number;
}

interface UndoMergeBlocks {
  type: "merge_blocks";
  deletedBlockId: string;
  deletedBlockContent: string;
  targetBlockId: string;
  targetOriginalContent: string;
  timestamp: number;
}

export type UndoAction = UndoDeleteBlock | UndoCreateBlock | UndoMergeBlocks;

const MAX_STACK_SIZE = 50;
const UNDO_EXPIRY_MS = 5 * 60 * 1000; // 5분

interface MemoUndoState {
  stack: UndoAction[];
  lastActionWasStructural: boolean;
  push: (action: UndoAction) => void;
  pop: () => UndoAction | undefined;
  peek: () => UndoAction | undefined;
  clear: () => void;
  setLastActionWasStructural: (v: boolean) => void;
}

export const useMemoUndoStack = create<MemoUndoState>((set, get) => ({
  stack: [],
  lastActionWasStructural: false,

  push: (action) =>
    set((state) => ({
      stack: [...state.stack, action].slice(-MAX_STACK_SIZE),
      lastActionWasStructural: true,
    })),

  pop: () => {
    const { stack } = get();
    if (stack.length === 0) return undefined;
    const action = stack[stack.length - 1];
    if (Date.now() - action.timestamp > UNDO_EXPIRY_MS) {
      set({ stack: [], lastActionWasStructural: false });
      return undefined;
    }
    set({ stack: stack.slice(0, -1) });
    return action;
  },

  peek: () => {
    const { stack } = get();
    return stack.length > 0 ? stack[stack.length - 1] : undefined;
  },

  clear: () => set({ stack: [], lastActionWasStructural: false }),

  setLastActionWasStructural: (v) => set({ lastActionWasStructural: v }),
}));
