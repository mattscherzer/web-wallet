// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Snackbar from './Snackbar';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Snackbar', () => {
  it('goes away by itself after ten seconds', () => {
    vi.useFakeTimers();
    render(<Snackbar message="Locked" actionLabel="Unlock" onAction={() => {}} />);
    expect(screen.getByText('Locked')).toBeTruthy();
    act(() => void vi.advanceTimersByTime(10_000));
    expect(screen.queryByText('Locked')).toBeNull();
  });
});

describe('Snackbar dismissing', () => {
  const setup = () => {
    render(<Snackbar message="Locked" actionLabel="Unlock" onAction={() => {}} />);
    return screen.getByRole('status');
  };
  const swipe = (el: HTMLElement, dx: number) => {
    fireEvent.pointerDown(el, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(el, { clientX: 100 + dx, pointerId: 1 });
    fireEvent.pointerUp(el, { clientX: 100 + dx, pointerId: 1 });
  };

  it('closes from the dismiss button', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Locked')).toBeNull();
  });

  it('closes when swiped far enough, either way', () => {
    swipe(setup(), 120);
    expect(screen.queryByText('Locked')).toBeNull();
    cleanup();
    swipe(setup(), -120);
    expect(screen.queryByText('Locked')).toBeNull();
  });

  it('springs back from a short swipe', () => {
    const el = setup();
    swipe(el, 30);
    expect(screen.getByText('Locked')).toBeTruthy();
    expect(el.style.getPropertyValue('--snackbar-drag')).toBe('0px');
  });
});
