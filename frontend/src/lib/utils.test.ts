import { describe, it, expect } from 'vitest';
import { isValidElement } from 'react';
import { cn, formatTime, highlightText } from './utils';

describe('cn', () => {
  it('여러 클래스 문자열을 병합합니다', () => {
    const result = cn('foo', 'bar');
    expect(result).toBe('foo bar');
  });

  it('조건부 클래스를 처리합니다', () => {
    const result = cn('base', false && 'hidden', 'visible');
    expect(result).toBe('base visible');
  });

  it('Tailwind 충돌 시 마지막 클래스가 우선합니다', () => {
    const result = cn('p-4', 'p-2');
    expect(result).toBe('p-2');
  });
});

describe('formatTime', () => {
  it('유효한 ISO 문자열을 HH:MM:SS 형식으로 변환합니다', () => {
    const result = formatTime('2026-02-14T12:34:56Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // 로케일에 따라 다르므로 정확한 포맷은 검증하지 않음
    expect(result).toMatch(/\d+:\d+:\d+/);
  });

  it('빈 문자열 또는 undefined를 빈 문자열로 반환합니다', () => {
    expect(formatTime('')).toBe('');
    expect(formatTime(undefined)).toBe('');
  });

  it('잘못된 날짜 문자열도 에러를 던지지 않는다', () => {
    // formatTime은 잘못된 날짜에서도 throw하지 않음
    expect(() => formatTime('invalid-date')).not.toThrow();
  });
});

describe('highlightText', () => {
  it('쿼리가 없으면 원본 텍스트를 단일 요소로 반환합니다', () => {
    const result = highlightText('hello world', '');
    expect(result).toEqual(['hello world']);
  });

  it('빈 텍스트를 처리합니다', () => {
    const result = highlightText('', 'query');
    expect(result).toEqual(['']);
  });

  it('매칭된 텍스트를 React 요소로 래핑합니다', () => {
    const result = highlightText('hello world', 'world');
    expect(result.length).toBeGreaterThan(1);

    // React 요소가 포함되어 있는지 확인
    const hasReactElement = result.some((part) => isValidElement(part));
    expect(hasReactElement).toBe(true);
  });

  it('대소문자 구분 없이 매칭합니다', () => {
    const result = highlightText('Hello World', 'hello');
    expect(result.length).toBeGreaterThan(1);

    const hasReactElement = result.some((part) => isValidElement(part));
    expect(hasReactElement).toBe(true);
  });

  it('정규식 특수 문자를 이스케이프 처리합니다', () => {
    const result = highlightText('test. file', 'test.');
    expect(result.length).toBeGreaterThan(1);

    // 점(.)이 와일드카드가 아닌 리터럴로 매칭되어야 함
    const hasReactElement = result.some((part) => isValidElement(part));
    expect(hasReactElement).toBe(true);
  });
});
