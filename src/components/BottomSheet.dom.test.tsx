// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import BottomSheet from './BottomSheet';

afterEach(cleanup);

function setup(showClose = false) {
  const onClose = vi.fn();
  render(
    <BottomSheet title="Wallets" text="Pick one." onClose={onClose} showClose={showClose}>
      <button type="button">Inside</button>
    </BottomSheet>,
  );
  return onClose;
}

describe('BottomSheet', () => {
  it('is a dialog named by its title, with the text and content shown', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Wallets' })).toBeTruthy();
    expect(screen.getByText('Pick one.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Inside' })).toBeTruthy();
  });

  it('closes on Escape and on a click on the backdrop, but not on a click inside', () => {
    const onClose = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Inside' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('shows a close button only when asked to', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    cleanup();
    const onClose = setup(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps Tab inside the sheet', () => {
    setup(true);
    const buttons = screen.getAllByRole('button');
    const last = buttons[buttons.length - 1];
    last.focus();
    const proceed = fireEvent.keyDown(last, { key: 'Tab' });
    expect(proceed).toBe(false);
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('still closes on Escape after the focused button disappears', () => {
    const onClose = vi.fn();
    function Retry() {
      const [failed, setFailed] = useState(true);
      return failed ? (
        <button type="button" onClick={() => setFailed(false)}>
          Retry
        </button>
      ) : null;
    }
    render(
      <BottomSheet title="Wallets" onClose={onClose}>
        <Retry />
      </BottomSheet>,
    );
    const retry = screen.getByRole('button', { name: 'Retry' });
    retry.focus();
    fireEvent.click(retry);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
