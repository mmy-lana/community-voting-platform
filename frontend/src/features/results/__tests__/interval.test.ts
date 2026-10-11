import { describe, expect, it } from 'vitest';
import { adaptiveIntervalMs, backoffIntervalMs, resultSignature } from '../interval';

describe('adaptiveIntervalMs', () => {
  it('steps 2s -> 5s -> 10s -> 30s by consecutive unchanged count', () => {
    expect(adaptiveIntervalMs(0)).toBe(2000);
    expect(adaptiveIntervalMs(1)).toBe(5000);
    expect(adaptiveIntervalMs(2)).toBe(10000);
    expect(adaptiveIntervalMs(3)).toBe(30000);
  });

  it('caps at 30s for any larger unchanged count', () => {
    expect(adaptiveIntervalMs(5)).toBe(30000);
    expect(adaptiveIntervalMs(100)).toBe(30000);
  });

  it('treats negative input as 0', () => {
    expect(adaptiveIntervalMs(-3)).toBe(2000);
  });
});

describe('backoffIntervalMs', () => {
  it('doubles the current interval on 429', () => {
    expect(backoffIntervalMs(2000)).toBe(4000);
    expect(backoffIntervalMs(10000)).toBe(20000);
  });

  it('caps backoff at 60s', () => {
    expect(backoffIntervalMs(50000)).toBe(60000);
    expect(backoffIntervalMs(60000)).toBe(60000);
  });
});

describe('resultSignature', () => {
  it('is stable for identical payloads and differs on change', () => {
    const a = { pollId: 1, totalVotes: 10, results: [], winner: null };
    const b = { pollId: 1, totalVotes: 11, results: [], winner: null };
    expect(resultSignature(a)).toBe(resultSignature({ ...a }));
    expect(resultSignature(a)).not.toBe(resultSignature(b));
  });
});
