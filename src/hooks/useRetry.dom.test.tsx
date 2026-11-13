// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRetry } from './useRetry';

describe('useRetry', () => {
  it('is busy until the retry settles and ignores a second press meanwhile', async () => {
    let finish!: () => void;
    const run = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { result } = renderHook(() => useRetry(run));

    let first!: Promise<void>;
    act(() => {
      first = result.current.retry();
    });
    expect(result.current.retrying).toBe(true);
    await act(() => result.current.retry());
    expect(run).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish();
      await first;
    });
    expect(result.current.retrying).toBe(false);
  });

  it('is free again when the retry throws', async () => {
    const { result } = renderHook(() => useRetry(() => Promise.reject(new Error('x'))));
    await act(() => result.current.retry().catch(() => {}));
    expect(result.current.retrying).toBe(false);
  });
});
