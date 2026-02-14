import type { Message } from '@/types';
import {
  computeEstimateSize,
  computeMessageGaps,
  computeSearchMatches,
} from './chatComputations';

// 테스트용 Message 생성 헬퍼
function makeMsg(overrides: Record<string, unknown> = {}): Message {
  return { id: 'msg-1', type: 'user_message', ...overrides } as Message;
}

describe('computeEstimateSize', () => {
  it('result 타입은 200을 반환한다', () => {
    const msg = makeMsg({ type: 'result' });
    expect(computeEstimateSize(msg)).toBe(200);
  });

  it('assistant_text 타입은 150을 반환한다', () => {
    const msg = makeMsg({ type: 'assistant_text' });
    expect(computeEstimateSize(msg)).toBe(150);
  });

  it('tool_use 타입은 44를 반환한다', () => {
    const msg = makeMsg({ type: 'tool_use' });
    expect(computeEstimateSize(msg)).toBe(44);
  });

  it('system 타입은 28을 반환한다', () => {
    const msg = makeMsg({ type: 'system' });
    expect(computeEstimateSize(msg)).toBe(28);
  });

  it('stderr 타입은 28을 반환한다', () => {
    const msg = makeMsg({ type: 'stderr' });
    expect(computeEstimateSize(msg)).toBe(28);
  });

  it('undefined 메시지는 60을 반환한다', () => {
    expect(computeEstimateSize(undefined)).toBe(60);
  });

  it('user_message 타입(기본값)은 60을 반환한다', () => {
    const msg = makeMsg({ type: 'user_message' });
    expect(computeEstimateSize(msg)).toBe(60);
  });
});

describe('computeMessageGaps', () => {
  it('빈 배열은 빈 결과를 반환한다', () => {
    expect(computeMessageGaps([])).toEqual([]);
  });

  it('메시지가 1개인 경우 normal을 반환한다', () => {
    const messages = [makeMsg({ type: 'user_message' })];
    expect(computeMessageGaps(messages)).toEqual(['normal']);
  });

  it('assistant_text 다음 tool_use는 tight 간격이다', () => {
    const messages = [
      makeMsg({ id: 'msg-1', type: 'assistant_text' }),
      makeMsg({ id: 'msg-2', type: 'tool_use' }),
    ];
    expect(computeMessageGaps(messages)).toEqual(['normal', 'tight']);
  });

  it('user_message 다음 assistant_text는 normal 간격이다 (턴 경계)', () => {
    const messages = [
      makeMsg({ id: 'msg-1', type: 'user_message' }),
      makeMsg({ id: 'msg-2', type: 'assistant_text' }),
    ];
    expect(computeMessageGaps(messages)).toEqual(['normal', 'normal']);
  });

  it('혼합 시퀀스: [user, assistant_text, tool_use, tool_result, result, user]는 올바른 간격을 반환한다', () => {
    const messages = [
      makeMsg({ id: 'msg-1', type: 'user_message' }),
      makeMsg({ id: 'msg-2', type: 'assistant_text' }),
      makeMsg({ id: 'msg-3', type: 'tool_use' }),
      makeMsg({ id: 'msg-4', type: 'tool_result' }),
      makeMsg({ id: 'msg-5', type: 'result' }),
      makeMsg({ id: 'msg-6', type: 'user_message' }),
    ];
    expect(computeMessageGaps(messages)).toEqual([
      'normal', // 첫 메시지
      'normal', // user → assistant (턴 경계)
      'tight',  // assistant_text → tool_use (같은 턴)
      'tight',  // tool_use → tool_result (같은 턴)
      'normal', // tool_result → result (턴 종료)
      'normal', // result → user (턴 경계)
    ]);
  });
});

describe('computeSearchMatches', () => {
  it('빈 쿼리는 빈 배열을 반환한다', () => {
    const messages = [
      makeMsg({ id: 'msg-1', text: 'Hello world' }),
    ];
    expect(computeSearchMatches(messages, '')).toEqual([]);
  });

  it('공백만 있는 쿼리는 빈 배열을 반환한다', () => {
    const messages = [
      makeMsg({ id: 'msg-1', text: 'Hello world' }),
    ];
    expect(computeSearchMatches(messages, '   ')).toEqual([]);
  });

  it('text 필드에서 대소문자 구분 없이 매칭한다', () => {
    const messages = [
      makeMsg({ id: 'msg-1', text: 'Hello World' }),
      makeMsg({ id: 'msg-2', text: 'Goodbye' }),
    ];
    expect(computeSearchMatches(messages, 'WORLD')).toEqual([0]);
  });

  it('content 필드에서 매칭한다', () => {
    const messages = [
      makeMsg({ id: 'msg-1', content: 'Test content' }),
      makeMsg({ id: 'msg-2', text: 'No match' }),
    ];
    expect(computeSearchMatches(messages, 'content')).toEqual([0]);
  });

  it('여러 매치가 있으면 올바른 인덱스를 반환한다', () => {
    const messages = [
      makeMsg({ id: 'msg-1', text: 'First error' }),
      makeMsg({ id: 'msg-2', text: 'No match' }),
      makeMsg({ id: 'msg-3', content: 'Second error' }),
      makeMsg({ id: 'msg-4', text: 'Error again' }),
    ];
    expect(computeSearchMatches(messages, 'error')).toEqual([0, 2, 3]);
  });

  it('매치가 없으면 빈 배열을 반환한다', () => {
    const messages = [
      makeMsg({ id: 'msg-1', text: 'Hello' }),
      makeMsg({ id: 'msg-2', content: 'World' }),
    ];
    expect(computeSearchMatches(messages, 'xyz')).toEqual([]);
  });
});
