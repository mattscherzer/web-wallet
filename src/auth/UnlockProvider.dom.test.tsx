// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { UnlockProvider } from './UnlockProvider';
import { useHoldLockNotice } from './unlockContext';

vi.mock('./useAuth', () => ({ useAuth: () => ({ locked: true, lockedByIdle: true }) }));
afterEach(cleanup);

const NOTICE = 'Locked after 30 minutes without use';

function Loading() {
  useHoldLockNotice();
  return <p>Loading</p>;
}

describe('the idle-lock notice', () => {
  it('waits while a screen has nothing to change yet, and shows once it is gone', () => {
    const { rerender } = render(
      <UnlockProvider>
        <Loading />
      </UnlockProvider>,
    );
    expect(screen.queryByText(NOTICE)).toBeNull();
    rerender(
      <UnlockProvider>
        <p>Loaded</p>
      </UnlockProvider>,
    );
    expect(screen.getByText(NOTICE)).toBeTruthy();
  });
});
