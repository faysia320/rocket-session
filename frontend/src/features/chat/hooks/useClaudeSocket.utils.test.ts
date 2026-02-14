import {
  generateMessageId,
  resetMessageIdCounter,
  getWsUrl,
  getBackoffDelay,
  RECONNECT_BASE_DELAY,
  RECONNECT_MAX_DELAY,
} from "./useClaudeSocket.utils";

// @/config/env 모듈 모킹
vi.mock("@/config/env", () => ({
  config: {
    API_BASE_URL: "",
    WS_BASE_URL: "",
  },
}));

describe("useClaudeSocket.utils", () => {
  beforeEach(() => {
    resetMessageIdCounter();
    // window.location 기본값 설정
    Object.defineProperty(window, "location", {
      value: {
        protocol: "http:",
        host: "localhost:8100",
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("generateMessageId", () => {
    it("msg-로 시작하는 문자열을 반환한다", () => {
      const id = generateMessageId();
      expect(id).toMatch(/^msg-/);
    });

    it("호출마다 고유한 ID를 반환한다", () => {
      const id1 = generateMessageId();
      const id2 = generateMessageId();
      const id3 = generateMessageId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it("카운터가 증가하고 resetMessageIdCounter로 리셋된다", () => {
      const id1 = generateMessageId();
      const id2 = generateMessageId();

      // 카운터가 증가했는지 확인 (끝부분 숫자)
      const counter1 = parseInt(id1.split("-").pop()!, 10);
      const counter2 = parseInt(id2.split("-").pop()!, 10);
      expect(counter2).toBe(counter1 + 1);

      // 리셋 후 카운터가 1부터 시작
      resetMessageIdCounter();
      const id3 = generateMessageId();
      const counter3 = parseInt(id3.split("-").pop()!, 10);
      expect(counter3).toBe(1);
    });

    it("타임스탬프 컴포넌트를 포함한다", () => {
      const beforeTimestamp = Date.now();
      const id = generateMessageId();
      const afterTimestamp = Date.now();

      // 형식: msg-{timestamp}-{counter}
      const parts = id.split("-");
      expect(parts).toHaveLength(3);

      const timestamp = parseInt(parts[1], 10);
      expect(timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(timestamp).toBeLessThanOrEqual(afterTimestamp);
    });
  });

  describe("getWsUrl", () => {
    it("http 프로토콜에서 ws:// 프리픽스로 세션 ID URL을 반환한다", () => {
      Object.defineProperty(window, "location", {
        value: { protocol: "http:", host: "localhost:8100" },
        writable: true,
        configurable: true,
      });

      const url = getWsUrl("session-123");
      expect(url).toBe("ws://localhost:8100/ws/session-123");
    });

    it("https 프로토콜에서 wss:// 프리픽스로 변환한다", () => {
      Object.defineProperty(window, "location", {
        value: { protocol: "https:", host: "example.com" },
        writable: true,
        configurable: true,
      });

      const url = getWsUrl("session-456");
      expect(url).toBe("wss://example.com/ws/session-456");
    });

    it("lastSeq 파라미터가 있으면 쿼리 스트링을 추가한다", () => {
      const url = getWsUrl("session-789", 42);
      expect(url).toBe("ws://localhost:8100/ws/session-789?last_seq=42");
    });

    it("lastSeq가 없으면 쿼리 스트링이 없다", () => {
      const url = getWsUrl("session-abc");
      expect(url).toBe("ws://localhost:8100/ws/session-abc");
      expect(url).not.toContain("?");
    });

    it("config.WS_BASE_URL이 설정되면 그 값을 사용한다", async () => {
      const { config } = await import("@/config/env");
      (config as { WS_BASE_URL: string }).WS_BASE_URL =
        "ws://custom-server:9000";

      const url = getWsUrl("session-custom");
      expect(url).toBe("ws://custom-server:9000/ws/session-custom");

      // 원래대로 복원
      (config as { WS_BASE_URL: string }).WS_BASE_URL = "";
    });
  });

  describe("getBackoffDelay", () => {
    it("지수 백오프를 적용한다 (attempt 증가 시 대략 2배)", () => {
      // 여러 번 실행하여 평균값 확인 (지터 때문에)
      const iterations = 50;

      const avg0 =
        Array.from({ length: iterations }, () => getBackoffDelay(0)).reduce(
          (sum, v) => sum + v,
          0,
        ) / iterations;
      const avg1 =
        Array.from({ length: iterations }, () => getBackoffDelay(1)).reduce(
          (sum, v) => sum + v,
          0,
        ) / iterations;
      const avg2 =
        Array.from({ length: iterations }, () => getBackoffDelay(2)).reduce(
          (sum, v) => sum + v,
          0,
        ) / iterations;

      // 평균값이 대략 RECONNECT_BASE_DELAY * 2^attempt 근처
      expect(avg0).toBeGreaterThan(RECONNECT_BASE_DELAY * 0.7);
      expect(avg0).toBeLessThan(RECONNECT_BASE_DELAY * 1.3);

      expect(avg1).toBeGreaterThan(RECONNECT_BASE_DELAY * 2 * 0.7);
      expect(avg1).toBeLessThan(RECONNECT_BASE_DELAY * 2 * 1.3);

      expect(avg2).toBeGreaterThan(RECONNECT_BASE_DELAY * 4 * 0.7);
      expect(avg2).toBeLessThan(RECONNECT_BASE_DELAY * 4 * 1.3);
    });

    it("RECONNECT_MAX_DELAY (30000)에서 상한선을 적용한다", () => {
      // attempt가 충분히 크면 최대값 도달
      const largeAttempt = 20;
      const iterations = 50;

      const delays = Array.from({ length: iterations }, () =>
        getBackoffDelay(largeAttempt),
      );

      delays.forEach((delay) => {
        expect(delay).toBeLessThanOrEqual(RECONNECT_MAX_DELAY * 1.2); // 지터 포함
        expect(delay).toBeGreaterThanOrEqual(RECONNECT_MAX_DELAY * 0.8);
      });
    });

    it("지터 범위가 delay * 0.8 ~ delay * 1.2 사이다", () => {
      const attempt = 3;
      const expectedBase = Math.min(
        RECONNECT_BASE_DELAY * Math.pow(2, attempt),
        RECONNECT_MAX_DELAY,
      );
      const iterations = 100;

      const delays = Array.from({ length: iterations }, () =>
        getBackoffDelay(attempt),
      );

      delays.forEach((delay) => {
        expect(delay).toBeGreaterThanOrEqual(expectedBase * 0.8);
        expect(delay).toBeLessThanOrEqual(expectedBase * 1.2);
      });

      // 분포 확인: 최소/최대 근처 값이 나와야 함
      const min = Math.min(...delays);
      const max = Math.max(...delays);
      expect(min).toBeLessThan(expectedBase * 0.9); // 하한 근처
      expect(max).toBeGreaterThan(expectedBase * 1.1); // 상한 근처
    });
  });
});
