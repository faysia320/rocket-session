import { useSessionStore } from "./useSessionStore";

describe("useSessionStore", () => {
  beforeEach(() => {
    // Zustand persist 스토어 초기화
    useSessionStore.setState({
      activeSessionId: null,
      viewMode: "dashboard",
      sidebarCollapsed: false,
    });
  });

  it("has correct initial values", () => {
    const state = useSessionStore.getState();
    expect(state.activeSessionId).toBeNull();
    expect(state.viewMode).toBe("dashboard");
    expect(state.sidebarCollapsed).toBe(false);
  });

  it("setActiveSessionId updates activeSessionId", () => {
    useSessionStore.getState().setActiveSessionId("session-123");
    expect(useSessionStore.getState().activeSessionId).toBe("session-123");

    useSessionStore.getState().setActiveSessionId(null);
    expect(useSessionStore.getState().activeSessionId).toBeNull();
  });

  it("setViewMode updates viewMode", () => {
    expect(useSessionStore.getState().viewMode).toBe("dashboard");

    useSessionStore.getState().setViewMode("single");
    expect(useSessionStore.getState().viewMode).toBe("single");

    useSessionStore.getState().setViewMode("split");
    expect(useSessionStore.getState().viewMode).toBe("split");

    useSessionStore.getState().setViewMode("dashboard");
    expect(useSessionStore.getState().viewMode).toBe("dashboard");
  });

  it("toggleSidebar toggles sidebarCollapsed", () => {
    expect(useSessionStore.getState().sidebarCollapsed).toBe(false);

    useSessionStore.getState().toggleSidebar();
    expect(useSessionStore.getState().sidebarCollapsed).toBe(true);

    useSessionStore.getState().toggleSidebar();
    expect(useSessionStore.getState().sidebarCollapsed).toBe(false);
  });
});
