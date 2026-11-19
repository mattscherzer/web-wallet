// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useElapsed } from './useElapsed';

afterEach(() => vi.useRealTimers());

describe('useElapsed', () => {
  it('turns true once the time has passed', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useElapsed(1000));
    expect(result.current).toBe(false);
    act(() => void vi.advanceTimersByTime(1000));
    expect(result.current).toBe(true);
  });
});
