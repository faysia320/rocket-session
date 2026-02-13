import { useSessionStore } from './useSessionStore';

describe('useSessionStore', () => {
  beforeEach(() => {
    // Zustand persist 스토어 초기화
    useSessionStore.setState({
      activeSessionId: null,
      splitView: false,
      sidebarCollapsed: false,
    });
  });

  it('has correct initial values', () => {
    const state = useSessionStore.getState();
    expect(state.activeSessionId).toBeNull();
    expect(state.splitView).toBe(false);
    expect(state.sidebarCollapsed).toBe(false);
  });

  it('setActiveSessionId updates activeSessionId', () => {
    useSessionStore.getState().setActiveSessionId('session-123');
    expect(useSessionStore.getState().activeSessionId).toBe('session-123');

    useSessionStore.getState().setActiveSessionId(null);
    expect(useSessionStore.getState().activeSessionId).toBeNull();
  });

  it('toggleSplitView toggles splitView', () => {
    expect(useSessionStore.getState().splitView).toBe(false);

    useSessionStore.getState().toggleSplitView();
    expect(useSessionStore.getState().splitView).toBe(true);

    useSessionStore.getState().toggleSplitView();
    expect(useSessionStore.getState().splitView).toBe(false);
  });

  it('toggleSidebar toggles sidebarCollapsed', () => {
    expect(useSessionStore.getState().sidebarCollapsed).toBe(false);

    useSessionStore.getState().toggleSidebar();
    expect(useSessionStore.getState().sidebarCollapsed).toBe(true);

    useSessionStore.getState().toggleSidebar();
    expect(useSessionStore.getState().sidebarCollapsed).toBe(false);
  });
});
