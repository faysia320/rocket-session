import { renderHook, act } from '@testing-library/react';
import { useClaudeSocket } from './useClaudeSocket';
import { MockWebSocket } from '@/test/mockWebSocket';
import { resetMessageIdCounter, RECONNECT_MAX_ATTEMPTS } from './useClaudeSocket.utils';

// @/config/env mock
vi.mock('@/config/env', () => ({
  config: {
    API_BASE_URL: '',
    WS_BASE_URL: '',
  },
}));

beforeEach(() => {
  MockWebSocket.install();
  resetMessageIdCounter();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  MockWebSocket.uninstall();
  vi.useRealTimers();
});

/** WebSocket open + session_state 를 전송하여 초기화를 완료하는 헬퍼 */
function openAndInit(ws: MockWebSocket, extra: Record<string, unknown> = {}) {
  ws.simulateOpen();
  ws.simulateMessage({
    type: 'session_state',
    session: { claude_session_id: 'cs-1', work_dir: '/tmp' },
    history: [],
    is_running: false,
    is_reconnect: false,
    ...extra,
  });
}

// ============================================================
// 1. Connection Lifecycle
// ============================================================
describe('Connection Lifecycle', () => {
  it('creates WebSocket on mount with correct URL', () => {
    renderHook(() => useClaudeSocket('sess-1'));
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.latest.url).toContain('/ws/sess-1');
  });

  it('sets connected=true on WS open', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));
    expect(result.current.connected).toBe(false);

    act(() => MockWebSocket.latest.simulateOpen());
    expect(result.current.connected).toBe(true);
  });

  it('sets connected=false on WS close', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => MockWebSocket.latest.simulateOpen());
    expect(result.current.connected).toBe(true);

    act(() => {
      // onclose null 처리를 피하기 위해 simulateClose 사용
      MockWebSocket.latest.simulateClose();
    });
    expect(result.current.connected).toBe(false);
  });

  it('cleans up WebSocket on unmount (close called)', () => {
    const { unmount } = renderHook(() => useClaudeSocket('sess-1'));
    const ws = MockWebSocket.latest;

    act(() => ws.simulateOpen());
    unmount();

    expect(ws.readyState).toBe(MockWebSocket.CLOSED);
  });

  it('resets all state when sessionId changes', () => {
    const { result, rerender } = renderHook(
      ({ id }) => useClaudeSocket(id),
      { initialProps: { id: 'sess-1' } },
    );

    // 초기 상태를 변경하기 위해 세션 상태를 로드
    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws, { is_running: true });
    });
    expect(result.current.status).toBe('running');
    expect(result.current.loading).toBe(false);

    // sessionId 변경
    rerender({ id: 'sess-2' });

    // 상태가 초기화됨
    expect(result.current.messages).toEqual([]);
    expect(result.current.status).toBe('idle');
    expect(result.current.loading).toBe(true);
    expect(result.current.sessionInfo).toBeNull();
    expect(result.current.activeTools).toEqual([]);
    expect(result.current.pendingPermission).toBeNull();
  });

  it('initial state: loading=true, status=idle, messages=[], connected=false', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));
    expect(result.current.loading).toBe(true);
    expect(result.current.status).toBe('idle');
    expect(result.current.messages).toEqual([]);
    expect(result.current.connected).toBe(false);
  });
});

// ============================================================
// 2. handleMessage: session_state
// ============================================================
describe('handleMessage: session_state', () => {
  it('sets sessionInfo from data.session', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'session_state',
        session: { claude_session_id: 'cs-42', work_dir: '/home' },
        history: [],
        is_running: false,
        is_reconnect: false,
      });
    });

    expect(result.current.sessionInfo).toEqual({
      claude_session_id: 'cs-42',
      work_dir: '/home',
    });
  });

  it('sets loading=false', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));
    expect(result.current.loading).toBe(true);

    act(() => {
      const ws = MockWebSocket.latest;
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'session_state',
        session: {},
        history: [],
        is_running: false,
        is_reconnect: false,
      });
    });

    expect(result.current.loading).toBe(false);
  });

  it('sets status=running when is_running=true', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'session_state',
        session: {},
        history: [],
        is_running: true,
        is_reconnect: false,
      });
    });

    expect(result.current.status).toBe('running');
  });

  it('loads history as messages when not reconnecting', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'session_state',
        session: {},
        history: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
        ],
        is_running: false,
        is_reconnect: false,
      });
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].type).toBe('user_message');
    expect(result.current.messages[0].text).toBe('Hello');
    expect(result.current.messages[1].type).toBe('result');
    expect(result.current.messages[1].text).toBe('Hi there');
  });

  it('skips history on is_reconnect=true', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    // 먼저 메시지를 설정
    act(() => {
      const ws = MockWebSocket.latest;
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'session_state',
        session: {},
        history: [{ role: 'user', content: 'original' }],
        is_running: false,
        is_reconnect: false,
      });
    });
    expect(result.current.messages).toHaveLength(1);

    // 재연결 시 히스토리를 덮어쓰지 않음
    act(() => {
      MockWebSocket.latest.simulateMessage({
        type: 'session_state',
        session: {},
        history: [
          { role: 'user', content: 'new history 1' },
          { role: 'assistant', content: 'new history 2' },
        ],
        is_running: false,
        is_reconnect: true,
      });
    });

    // 기존 메시지 유지
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe('original');
  });
});

// ============================================================
// 3. handleMessage: missed_events
// ============================================================
describe('handleMessage: missed_events', () => {
  it('processes array of events sequentially', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({
        type: 'missed_events',
        events: [
          { type: 'user_message', text: 'msg1', seq: 1 },
          { type: 'user_message', text: 'msg2', seq: 2 },
        ],
      });
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].text).toBe('msg1');
    expect(result.current.messages[1].text).toBe('msg2');
  });

  it('handles empty events array', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'missed_events', events: [] });
    });

    // session_state 에서 history=[] 이므로 메시지 없음
    expect(result.current.messages).toHaveLength(0);
  });
});

// ============================================================
// 4. handleMessage: status
// ============================================================
describe('handleMessage: status', () => {
  it('sets status to the received value', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'status', status: 'running' });
    });

    expect(result.current.status).toBe('running');
  });

  it('on idle: clears activeTools', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'tool_use', tool: 'Read', tool_use_id: 'tu-1', seq: 1 });
    });
    expect(result.current.activeTools).toHaveLength(1);

    act(() => {
      MockWebSocket.latest.simulateMessage({ type: 'status', status: 'idle' });
    });
    expect(result.current.activeTools).toEqual([]);
  });

  it('on idle: transitions running tool_use messages to done', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'tool_use', tool: 'Read', tool_use_id: 'tu-1', seq: 1 });
    });
    expect(result.current.messages.find((m) => m.type === 'tool_use')?.status).toBe('running');

    act(() => {
      MockWebSocket.latest.simulateMessage({ type: 'status', status: 'idle' });
    });
    expect(result.current.messages.find((m) => m.type === 'tool_use')?.status).toBe('done');
  });
});

// ============================================================
// 5. handleMessage: user_message
// ============================================================
describe('handleMessage: user_message', () => {
  it('appends message with generated ID', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'user_message', text: 'Hello Claude', seq: 1 });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].type).toBe('user_message');
    expect(result.current.messages[0].text).toBe('Hello Claude');
    expect(result.current.messages[0].id).toMatch(/^msg-/);
  });
});

// ============================================================
// 6. handleMessage: assistant_text
// ============================================================
describe('handleMessage: assistant_text', () => {
  it('first assistant_text creates new message', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'assistant_text', text: 'Hello!', seq: 1 });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].type).toBe('assistant_text');
    expect(result.current.messages[0].text).toBe('Hello!');
  });

  it('subsequent assistant_text in same block OVERWRITES (keeps same ID)', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'assistant_text', text: 'Hello', seq: 1 });
    });

    const firstId = result.current.messages[0].id;

    act(() => {
      MockWebSocket.latest.simulateMessage({ type: 'assistant_text', text: 'Hello World!', seq: 2 });
    });

    // 메시지 개수는 여전히 1개 (덮어쓰기)
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe('Hello World!');
    // ID가 유지됨
    expect(result.current.messages[0].id).toBe(firstId);
  });

  it('after tool_use, new assistant_text creates NEW message (tool boundary)', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'assistant_text', text: 'First text', seq: 1 });
      ws.simulateMessage({ type: 'tool_use', tool: 'Read', tool_use_id: 'tu-1', seq: 2 });
      ws.simulateMessage({ type: 'assistant_text', text: 'After tool', seq: 3 });
    });

    // assistant_text + tool_use + assistant_text = 3 messages
    expect(result.current.messages).toHaveLength(3);
    expect(result.current.messages[0].type).toBe('assistant_text');
    expect(result.current.messages[0].text).toBe('First text');
    expect(result.current.messages[1].type).toBe('tool_use');
    expect(result.current.messages[2].type).toBe('assistant_text');
    expect(result.current.messages[2].text).toBe('After tool');
    // 서로 다른 ID
    expect(result.current.messages[0].id).not.toBe(result.current.messages[2].id);
  });

  it('after tool_result, new assistant_text creates NEW message', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'assistant_text', text: 'Before', seq: 1 });
      ws.simulateMessage({ type: 'tool_use', tool: 'Read', tool_use_id: 'tu-1', seq: 2 });
      ws.simulateMessage({ type: 'tool_result', tool_use_id: 'tu-1', output: 'ok', is_error: false, seq: 3 });
      ws.simulateMessage({ type: 'assistant_text', text: 'After result', seq: 4 });
    });

    // tool_result 는 tool_use를 업데이트하므로 새 메시지 추가 안됨
    // assistant_text(Before) + tool_use + assistant_text(After result) = 3
    expect(result.current.messages).toHaveLength(3);
    expect(result.current.messages[2].type).toBe('assistant_text');
    expect(result.current.messages[2].text).toBe('After result');
  });
});

// ============================================================
// 7. handleMessage: tool_use / tool_result
// ============================================================
describe('handleMessage: tool_use / tool_result', () => {
  it('tool_use adds message with status=running and adds to activeTools', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'tool_use', tool: 'Write', tool_use_id: 'tu-1', seq: 1 });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].status).toBe('running');
    expect(result.current.messages[0].type).toBe('tool_use');
    expect(result.current.activeTools).toHaveLength(1);
  });

  it('tool_result updates matching tool_use by tool_use_id: status->done, output set', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'tool_use', tool: 'Read', tool_use_id: 'tu-1', seq: 1 });
      ws.simulateMessage({
        type: 'tool_result',
        tool_use_id: 'tu-1',
        output: 'file content here',
        is_error: false,
        seq: 2,
      });
    });

    const toolMsg = result.current.messages.find((m) => m.type === 'tool_use');
    expect(toolMsg?.status).toBe('done');
    expect(toolMsg?.output).toBe('file content here');
  });

  it('tool_result with is_error sets status to error', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'tool_use', tool: 'Bash', tool_use_id: 'tu-err', seq: 1 });
      ws.simulateMessage({
        type: 'tool_result',
        tool_use_id: 'tu-err',
        output: 'command not found',
        is_error: true,
        seq: 2,
      });
    });

    const toolMsg = result.current.messages.find((m) => m.type === 'tool_use');
    expect(toolMsg?.status).toBe('error');
    expect(toolMsg?.is_error).toBe(true);
  });

  it('tool_result removes from activeTools', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'tool_use', tool: 'Read', tool_use_id: 'tu-1', seq: 1 });
    });
    expect(result.current.activeTools).toHaveLength(1);

    act(() => {
      MockWebSocket.latest.simulateMessage({
        type: 'tool_result',
        tool_use_id: 'tu-1',
        output: 'ok',
        is_error: false,
        seq: 2,
      });
    });
    expect(result.current.activeTools).toHaveLength(0);
  });
});

// ============================================================
// 8. handleMessage: result
// ============================================================
describe('handleMessage: result', () => {
  it('removes last assistant_text in current turn and adds result message', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'assistant_text', text: 'streaming text', seq: 1 });
      ws.simulateMessage({ type: 'result', text: 'final result', seq: 2 });
    });

    // assistant_text 제거되고 result만 남음
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].type).toBe('result');
    expect(result.current.messages[0].text).toBe('final result');
  });

  it('uses assistant_text text as fallback when result has no text', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'assistant_text', text: 'fallback text', seq: 1 });
      ws.simulateMessage({ type: 'result', text: '', seq: 2 });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe('fallback text');
  });

  it('sets mode from data.mode', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'result', text: 'plan result', mode: 'plan', seq: 1 });
    });

    expect(result.current.messages[0].mode).toBe('plan');
  });

  it('assigns new ID to result message', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'assistant_text', text: 'stream', seq: 1 });
    });

    const assistantId = result.current.messages[0].id;

    act(() => {
      MockWebSocket.latest.simulateMessage({ type: 'result', text: 'done', seq: 2 });
    });

    // result 는 새 ID를 받아야 함 (assistant_text의 ID와 다름)
    expect(result.current.messages[0].id).not.toBe(assistantId);
    expect(result.current.messages[0].id).toMatch(/^msg-/);
  });

  it('handles case where no assistant_text exists (no removal needed)', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      // tool_use 뒤에 바로 result 가 올 수 있음
      ws.simulateMessage({ type: 'tool_use', tool: 'Read', tool_use_id: 'tu-1', seq: 1 });
      ws.simulateMessage({ type: 'result', text: 'completed', seq: 2 });
    });

    // tool_use + result = 2 messages
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].type).toBe('tool_use');
    expect(result.current.messages[1].type).toBe('result');
    expect(result.current.messages[1].text).toBe('completed');
  });
});

// ============================================================
// 9. handleMessage: error
// ============================================================
describe('handleMessage: error', () => {
  it('adds error message', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'error', message: 'Something went wrong', seq: 1 });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].type).toBe('error');
  });

  it('"Session not found" error disables reconnection', () => {
    renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'error', message: 'Session not found', seq: 1 });
    });

    // close 후 재연결이 시도되지 않아야 함
    const instanceCountBefore = MockWebSocket.instances.length;

    act(() => {
      MockWebSocket.latest.simulateClose();
      vi.advanceTimersByTime(60_000);
    });

    // 새로운 WebSocket 인스턴스가 생성되지 않음
    expect(MockWebSocket.instances.length).toBe(instanceCountBefore);
  });
});

// ============================================================
// 10. handleMessage: stopped
// ============================================================
describe('handleMessage: stopped', () => {
  it('sets status=idle, clears activeTools', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'status', status: 'running', seq: 1 });
      ws.simulateMessage({ type: 'tool_use', tool: 'Bash', tool_use_id: 'tu-1', seq: 2 });
    });
    expect(result.current.status).toBe('running');
    expect(result.current.activeTools).toHaveLength(1);

    act(() => {
      MockWebSocket.latest.simulateMessage({ type: 'stopped', seq: 3 });
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.activeTools).toEqual([]);
  });

  it('transitions all running tool_use to done, adds system message', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'tool_use', tool: 'Read', tool_use_id: 'tu-1', seq: 1 });
      ws.simulateMessage({ type: 'tool_use', tool: 'Write', tool_use_id: 'tu-2', seq: 2 });
    });
    // 두 tool_use 모두 running
    expect(result.current.messages.filter((m) => m.status === 'running')).toHaveLength(2);

    act(() => {
      MockWebSocket.latest.simulateMessage({ type: 'stopped', seq: 3 });
    });

    // 모든 tool_use가 done으로 전환
    const toolMessages = result.current.messages.filter((m) => m.type === 'tool_use');
    expect(toolMessages.every((m) => m.status === 'done')).toBe(true);

    // 시스템 메시지가 추가됨
    const systemMsg = result.current.messages.find((m) => m.type === 'system');
    expect(systemMsg).toBeDefined();
    expect(systemMsg?.text).toBe('Session stopped by user.');
  });
});

// ============================================================
// 11. handleMessage: raw / stderr
// ============================================================
describe('handleMessage: raw / stderr', () => {
  it('raw event maps to stderr type message', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'raw', text: 'raw output', seq: 1 });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].type).toBe('stderr');
    expect(result.current.messages[0].text).toBe('raw output');
  });

  it('stderr event creates stderr message', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'stderr', text: 'error output', seq: 1 });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].type).toBe('stderr');
    expect(result.current.messages[0].text).toBe('error output');
  });
});

// ============================================================
// 12. handleMessage: permission_request / permission_response
// ============================================================
describe('handleMessage: permission_request / permission_response', () => {
  it('permission_request sets pendingPermission state', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({
        type: 'permission_request',
        permission_id: 'perm-1',
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf /' },
        seq: 1,
      });
    });

    expect(result.current.pendingPermission).toBeDefined();
    expect(result.current.pendingPermission?.permission_id).toBe('perm-1');
    expect(result.current.pendingPermission?.tool_name).toBe('Bash');
  });

  it('permission_request adds message to messages', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({
        type: 'permission_request',
        permission_id: 'perm-2',
        tool_name: 'Write',
        tool_input: { path: '/etc/hosts' },
        seq: 1,
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].type).toBe('permission_request');
    expect(result.current.messages[0].tool).toBe('Write');
  });

  it('permission_response clears pendingPermission', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({
        type: 'permission_request',
        permission_id: 'perm-3',
        tool_name: 'Bash',
        tool_input: {},
        seq: 1,
      });
    });
    expect(result.current.pendingPermission).not.toBeNull();

    act(() => {
      MockWebSocket.latest.simulateMessage({ type: 'permission_response', seq: 2 });
    });
    expect(result.current.pendingPermission).toBeNull();
  });
});

// ============================================================
// 13. Seq dedup
// ============================================================
describe('Seq dedup', () => {
  it('processes event with new seq number', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'user_message', text: 'first', seq: 1 });
    });

    expect(result.current.messages).toHaveLength(1);
  });

  it('skips event with duplicate seq number', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'user_message', text: 'first', seq: 5 });
      ws.simulateMessage({ type: 'user_message', text: 'duplicate', seq: 5 });
    });

    // 중복 seq는 스킵됨
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toBe('first');
  });

  it('events without seq are always processed', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'user_message', text: 'no-seq-1' });
      ws.simulateMessage({ type: 'user_message', text: 'no-seq-2' });
    });

    expect(result.current.messages).toHaveLength(2);
  });

  it('tracks lastSeq (highest seen)', () => {
    renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'user_message', text: 'a', seq: 3 });
      ws.simulateMessage({ type: 'user_message', text: 'b', seq: 10 });
      ws.simulateMessage({ type: 'user_message', text: 'c', seq: 7 });
    });

    // close 후 reconnect URL에 last_seq=10 이 포함되어야 함
    act(() => {
      MockWebSocket.latest.simulateClose();
      vi.advanceTimersByTime(5_000);
    });

    const reconnectWs = MockWebSocket.latest;
    expect(reconnectWs.url).toContain('last_seq=10');
  });
});

// ============================================================
// 14. Reconnection
// ============================================================
describe('Reconnection', () => {
  it('on close: schedules reconnect with backoff delay', () => {
    renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      MockWebSocket.latest.simulateOpen();
    });

    const instancesBefore = MockWebSocket.instances.length;

    act(() => {
      MockWebSocket.latest.simulateClose();
    });

    // 아직 타이머가 실행되지 않았으므로 새 인스턴스가 없어야 함
    expect(MockWebSocket.instances.length).toBe(instancesBefore);

    // 타이머 진행 후 새 WebSocket 생성
    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(MockWebSocket.instances.length).toBeGreaterThan(instancesBefore);
  });

  it('stops after RECONNECT_MAX_ATTEMPTS', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      MockWebSocket.latest.simulateOpen();
    });

    // 최대 시도 횟수까지 close + 타이머 진행
    for (let i = 0; i < RECONNECT_MAX_ATTEMPTS; i++) {
      act(() => {
        MockWebSocket.latest.simulateClose();
        vi.advanceTimersByTime(60_000);
      });
    }

    const instanceCount = MockWebSocket.instances.length;

    // 마지막 close 후 더 이상 재연결 시도 안함
    act(() => {
      MockWebSocket.latest.simulateClose();
      vi.advanceTimersByTime(60_000);
    });

    expect(MockWebSocket.instances.length).toBe(instanceCount);
    expect(result.current.reconnectState.status).toBe('failed');
  });

  it('reconnect includes last_seq in URL', () => {
    renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'user_message', text: 'hello', seq: 42 });
    });

    // close + reconnect
    act(() => {
      MockWebSocket.latest.simulateClose();
      vi.advanceTimersByTime(5_000);
    });

    const reconnectUrl = MockWebSocket.latest.url;
    expect(reconnectUrl).toContain('last_seq=42');
  });

  it('reconnect() function resets attempt counter', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      MockWebSocket.latest.simulateOpen();
    });

    // 몇 번 재연결 시도
    for (let i = 0; i < 3; i++) {
      act(() => {
        MockWebSocket.latest.simulateClose();
        vi.advanceTimersByTime(60_000);
      });
    }

    expect(result.current.reconnectState.attempt).toBeGreaterThan(0);

    // reconnect() 호출하면 카운터 리셋
    act(() => {
      result.current.reconnect();
    });

    expect(result.current.reconnectState.attempt).toBe(0);
    expect(result.current.reconnectState.status).toBe('reconnecting');
  });
});

// ============================================================
// 15. Actions
// ============================================================
describe('Actions', () => {
  it('sendPrompt sends correct JSON via WebSocket', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      MockWebSocket.latest.simulateOpen();
    });

    act(() => {
      result.current.sendPrompt('Hello Claude', { mode: 'plan', allowedTools: ['Read'] });
    });

    const ws = MockWebSocket.latest;
    expect(ws.sentMessages).toHaveLength(1);
    const sent = JSON.parse(ws.sentMessages[0]);
    expect(sent.type).toBe('prompt');
    expect(sent.prompt).toBe('Hello Claude');
    expect(sent.mode).toBe('plan');
    expect(sent.allowed_tools).toEqual(['Read']);
  });

  it('stopExecution sends {type: "stop"}', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      MockWebSocket.latest.simulateOpen();
    });

    act(() => {
      result.current.stopExecution();
    });

    const ws = MockWebSocket.latest;
    const sent = JSON.parse(ws.sentMessages[0]);
    expect(sent.type).toBe('stop');
  });

  it('clearMessages resets messages, fileChanges, seq tracking', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({ type: 'user_message', text: 'msg', seq: 5 });
      ws.simulateMessage({
        type: 'file_change',
        change: { tool: 'Write', file: 'test.ts', timestamp: '2024-01-01' },
        seq: 6,
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.fileChanges).toHaveLength(1);

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.fileChanges).toEqual([]);

    // seq 추적 리셋 확인: 같은 seq로 다시 이벤트를 보내면 처리됨
    act(() => {
      MockWebSocket.latest.simulateMessage({ type: 'user_message', text: 'new', seq: 5 });
    });
    expect(result.current.messages).toHaveLength(1);
  });

  it('respondPermission sends correct JSON and clears pendingPermission', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    act(() => {
      const ws = MockWebSocket.latest;
      openAndInit(ws);
      ws.simulateMessage({
        type: 'permission_request',
        permission_id: 'perm-42',
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
        seq: 1,
      });
    });

    expect(result.current.pendingPermission).not.toBeNull();

    act(() => {
      result.current.respondPermission('perm-42', 'allow');
    });

    const ws = MockWebSocket.latest;
    // 마지막으로 보낸 메시지 확인
    const sent = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
    expect(sent.type).toBe('permission_respond');
    expect(sent.permission_id).toBe('perm-42');
    expect(sent.behavior).toBe('allow');
    expect(result.current.pendingPermission).toBeNull();
  });

  it('sendPrompt does nothing when WS not open', () => {
    const { result } = renderHook(() => useClaudeSocket('sess-1'));

    // WS가 아직 open 상태가 아님 (CONNECTING)
    act(() => {
      result.current.sendPrompt('Should not send');
    });

    const ws = MockWebSocket.latest;
    expect(ws.sentMessages).toHaveLength(0);
  });
});
