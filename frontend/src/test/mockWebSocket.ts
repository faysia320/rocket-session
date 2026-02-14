import { vi } from "vitest";

/**
 * WebSocket mock for testing useClaudeSocket hook.
 * Tracks sent messages and provides helpers to simulate server events.
 */
export class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  sentMessages: string[] = [];

  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  // Event listener storage
  private listeners: Record<string, Array<(ev: unknown) => void>> = {};

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent("close"));
    }
  }

  addEventListener(type: string, listener: (ev: unknown) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (ev: unknown) => void) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
    }
  }

  dispatchEvent(_event: Event): boolean {
    return true;
  }

  // --- Test helpers ---

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    const ev = new Event("open");
    if (this.onopen) this.onopen(ev);
    this.listeners["open"]?.forEach((l) => l(ev));
  }

  simulateMessage(data: Record<string, unknown>) {
    const ev = new MessageEvent("message", { data: JSON.stringify(data) });
    if (this.onmessage) this.onmessage(ev);
    this.listeners["message"]?.forEach((l) => l(ev));
  }

  simulateClose(code = 1000, reason = "") {
    this.readyState = MockWebSocket.CLOSED;
    const ev = new CloseEvent("close", { code, reason });
    if (this.onclose) this.onclose(ev);
    this.listeners["close"]?.forEach((l) => l(ev));
  }

  simulateError() {
    const ev = new Event("error");
    if (this.onerror) this.onerror(ev);
    this.listeners["error"]?.forEach((l) => l(ev));
  }

  // --- Static helpers ---

  static instances: MockWebSocket[] = [];

  static get latest(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }

  static reset() {
    MockWebSocket.instances = [];
  }

  static install() {
    MockWebSocket.reset();
    vi.stubGlobal("WebSocket", MockWebSocket);
  }

  static uninstall() {
    vi.unstubAllGlobals();
    MockWebSocket.reset();
  }
}
