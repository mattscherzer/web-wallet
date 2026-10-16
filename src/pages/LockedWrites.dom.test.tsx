// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  createFakeSupabase,
  FAKE_MEMBERS,
  FAKE_PERMISSIONS,
  FAKE_PROFILES,
  FAKE_USERS,
  type FakeSupabase,
} from '../test/fakeSupabase';
import { transactionRows } from '../test/transactionsTestKit';
import { findSheet, noSheet, pass, pressPin, rememberStaff, shell } from '../test/lockTestKit';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (ref.fake.client as unknown as Record<string, unknown>)[p as string] }),
}));
vi.mock('../auth/passwordCheck', () => ({ checkOwnerPassword: async (_e: string, p: string) => p === 'owner-pw' }));

beforeEach(() => {
  localStorage.clear();
  rememberStaff();
  ref.fake = createFakeSupabase(
    { ...transactionRows(), profiles: FAKE_PROFILES, wallet_members: FAKE_MEMBERS, role_permissions: FAKE_PERMISSIONS },
    { users: FAKE_USERS },
  );
  ref.fake.answerFunction('staff-admin', () => ({ data: { staff: [] } }));
});
afterEach(cleanup);

const lock = async () => {
  // The header lock comes first; More has its own Lock button further down the page.
  fireEvent.click((await screen.findAllByRole('button', { name: 'Lock' }))[0]);
  await screen.findByRole('button', { name: /Locked, view only/ });
};

describe('the Record button', () => {
  it('T19 unlocked it opens the Record menu; locked it says so and opens Unlock instead', async () => {
    ref.fake.signIn('u-anna');
    shell();
    fireEvent.click(await screen.findByRole('button', { name: 'Record' }));
    expect(screen.getByRole('menu', { name: 'Record' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close record menu' }));

    await lock();
    fireEvent.click(screen.getByRole('button', { name: 'Record. Locked: unlock to record' }));
    await findSheet();
    expect(screen.queryByRole('menu', { name: 'Record' })).toBeNull();
  });
});

describe('the header lock', () => {
  it('T20 open lock locks and then shows "View only"; the closed lock opens Unlock', async () => {
    ref.fake.signIn('u-anna');
    shell();
    expect(await screen.findByRole('button', { name: 'Lock' })).toBeTruthy();
    expect(screen.queryByText('View only')).toBeNull();
    await lock();
    const closed = screen.getByRole('button', { name: 'Locked, view only. Unlock to make changes' });
    expect(screen.getByText('View only')).toBeTruthy();
    expect(screen.getByText('the books')).toBeTruthy();
    fireEvent.click(closed);
    await findSheet();
  });
});

describe('changes while locked', () => {
  it('T21 Edit and Remove on an entry ask to unlock and change nothing', async () => {
    ref.fake.signIn('u-owner');
    shell(null, '/history/t1');
    await screen.findByRole('button', { name: 'Edit' });
    await lock();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await findSheet();
    expect(screen.queryByRole('dialog', { name: 'Remove this entry?' })).toBeNull();
    fireEvent.click(within(await findSheet()).getByRole('button', { name: 'Close, keep viewing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await findSheet();
    expect(screen.queryByRole('dialog', { name: 'Edit entry' })).toBeNull();
    expect(ref.fake.tables.transactions.find((t) => t.id === 't1')!.deleted).toBe(false);
  });

  it('T22 an owner action while locked asks to unlock, not for the password, and nothing is written', async () => {
    ref.fake.signIn('u-owner');
    shell(null, '/admin');
    fireEvent.change(await screen.findByLabelText('Wallet name'), { target: { value: 'Sneaky' } });
    await lock();
    fireEvent.click(screen.getByRole('button', { name: /create wallet/i }));
    await findSheet();
    expect(screen.queryByRole('dialog', { name: 'Confirm your password' })).toBeNull();
    await waitFor(() => expect(noSheet()).not.toBeNull());
    expect(ref.fake.rpcCalls).toEqual([]);
  });

  it('T23 locked, the More page still shows its links and no unlock sheet pops up by itself', async () => {
    ref.fake.signIn('u-owner');
    shell(null, '/more');
    await lock();
    expect(screen.getByRole('link', { name: /Wallets and staff/ })).toBeTruthy();
    expect(noSheet()).toBeNull();
  });
});

describe('changes while unlocked', () => {
  it('T42 unlocked, Remove opens its sheet at once with no unlock prompt', async () => {
    ref.fake.signIn('u-owner');
    shell(null, '/history/t1');
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(await screen.findByRole('dialog', { name: 'Remove this entry?' })).toBeTruthy();
    expect(noSheet()).toBeNull();
  });

  it('T43 after unlocking with the PIN the same Edit tap opens the edit sheet, and a reload stays unlocked', async () => {
    ref.fake.answerFunction('staff-login', () => ({ data: { userId: 'u-anna' } }));
    ref.fake.signIn('u-anna');
    const view = shell(null, '/history/t1');
    await lock();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await findSheet();
    pressPin('123456');
    await waitFor(() => expect(noSheet()).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(await screen.findByRole('dialog', { name: 'Edit entry' })).toBeTruthy();
    view.unmount();

    shell(null, '/history/t1');
    expect(await screen.findByRole('button', { name: 'Lock' })).toBeTruthy();
  });
});

describe('the idle bar', () => {
  it('T44 the bar appears once after an idle lock, is not repeated while locked, and goes away after unlocking', async () => {
    ref.fake.answerFunction('staff-login', () => ({ data: { userId: 'u-anna' } }));
    vi.useFakeTimers();
    try {
      ref.fake.signIn('u-anna');
      shell();
      await pass(100);
      await pass(31 * 60_000);
      expect(screen.getAllByText('Locked after 30 minutes without use')).toHaveLength(1);
      await pass(65 * 60_000);
      expect(screen.getAllByText('Locked after 30 minutes without use')).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
      pressPin('123456');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(screen.queryByText('Locked after 30 minutes without use')).toBeNull();

      // Idle again after the unlock: the bar comes back.
      await pass(31 * 60_000);
      expect(screen.getAllByText('Locked after 30 minutes without use')).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('every other way to change something while locked', () => {
  it('T53 a Remove sheet that was already open when the app locked cannot save the removal', async () => {
    ref.fake.signIn('u-owner');
    shell(null, '/history/t1');
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    const remove = within(await screen.findByRole('dialog', { name: /Remove this entry/ }));
    await lock();
    fireEvent.click(remove.getByRole('radio', { name: 'Duplicate' }));
    fireEvent.click(remove.getByRole('button', { name: 'Remove entry' }));
    await findSheet();
    expect(ref.fake.tables.transactions.find((t) => t.id === 't1')!.deleted).toBe(false);
  });

  it('T54 saving a new entry from the Record screen while locked asks to unlock and saves nothing', async () => {
    ref.fake.signIn('u-owner');
    const before = ref.fake.tables.transactions.length;
    const { container } = shell(null, '/record?type=in');
    await screen.findByRole('heading', { level: 1 });
    await lock();
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    await findSheet();
    expect(ref.fake.tables.transactions).toHaveLength(before);
  });

  it('T55 Undo on the receipt while locked asks to unlock and removes nothing', async () => {
    ref.fake.signIn('u-owner');
    shell(null, '/recorded/t1');
    const undo = await screen.findByRole('button', { name: 'Undo this entry' });
    await lock();
    fireEvent.click(undo);
    await findSheet();
    expect(ref.fake.tables.transactions.find((t) => t.id === 't1')!.deleted).toBe(false);
  });

  // an owner restore that waited at the password box while the app locked must not go through
  it('T65', async () => {
    ref.fake.signIn('u-owner');
    shell(null, '/history/t5');
    fireEvent.click(await screen.findByRole('button', { name: 'Restore' }));
    const ask = await screen.findByRole('dialog', { name: 'Confirm your password' });
    await lock();
    fireEvent.change(within(ask).getByLabelText('Password'), { target: { value: 'owner-pw' } });
    fireEvent.click(within(ask).getByRole('button', { name: 'Confirm' }));
    await findSheet();
    expect(ref.fake.tables.transactions.find((t) => t.id === 't5')!.deleted).toBe(true);
  });
});
