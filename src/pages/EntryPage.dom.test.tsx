// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase';
import { walletApp } from '../test/walletTestKit';
import { enterPin, transactionRows } from '../test/transactionsTestKit';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (...a: unknown[]) => (ref.fake.client as unknown as Record<string, (...x: unknown[]) => unknown>)[p as string](...a) }),
}));

const pageMod = await import('./EntryPage').catch(() => undefined);

beforeEach(() => {
  ref.fake = createFakeSupabase(transactionRows());
});
afterEach(cleanup);

function app(path: string) {
  expect(pageMod, 'src/pages/EntryPage.tsx must exist').toBeDefined();
  const EntryPage = pageMod!.default;
  render(
    walletApp(
      <Routes>
        <Route path="/history/:id" element={<EntryPage />} />
      </Routes>,
      { path, current: 'wa' },
    ),
  );
}

describe('Entry page', () => {
  it('removes with a reason, shows it in the change history, and restores', async () => {
    app('/history/t1');
    expect(await screen.findByRole('heading', { name: /\+€1,000\.00|1,000\.00/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    // A removal needs a reason.
    const sheet = await screen.findByRole('dialog', { name: /Remove this entry/ });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Remove entry' }));
    expect(await within(sheet).findByText(/Choose a reason/)).toBeTruthy();
    expect(ref.fake.tables.transactions.find((t) => t.id === 't1')!.deleted).toBe(false);

    fireEvent.click(within(sheet).getByRole('radio', { name: 'Duplicate' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Remove entry' }));
    await enterPin('1234', ref.fake);

    const history = await screen.findByRole('list', { name: 'Change history' });
    expect(await within(history).findByText('Removed')).toBeTruthy();
    expect(within(history).getByText(/Reason: Duplicate/)).toBeTruthy();
    expect(screen.getByText('Removed', { selector: '[data-status="removed"]' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await enterPin('1234', ref.fake);
    expect(await within(history).findByText('Restored')).toBeTruthy();
    // Nobody is named until sign-in exists.
    expect(screen.queryByText(/Anna/)).toBeNull();
    expect(screen.queryByText('Removed', { selector: '[data-status="removed"]' })).toBeNull();
    expect(ref.fake.tables.transactions.find((t) => t.id === 't1')!.deleted).toBe(false);
  });

  it('says not found for an entry of another wallet', async () => {
    app('/history/t4');
    expect(await screen.findByText(/Entry not found/)).toBeTruthy();
  });

  it('edits with a reason only after the PIN, and shows before and after in the change history', async () => {
    app('/history/t1');
    await screen.findByRole('button', { name: 'Edit' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    const sheet = await screen.findByRole('dialog', { name: /Edit entry/ });
    fireEvent.change(within(sheet).getByRole('textbox', { name: 'Amount' }), { target: { value: '1200' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }));
    expect(await within(sheet).findByText(/Choose a reason/)).toBeTruthy();

    fireEvent.click(within(sheet).getByRole('radio', { name: 'Wrong amount' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }));
    const row = () => ref.fake.tables.transactions.find((t) => t.id === 't1')!;
    expect(row().amount).toBe(1000);

    await enterPin('1234', ref.fake);
    const history = await screen.findByRole('list', { name: 'Change history' });
    expect(await within(history).findByText('Edited')).toBeTruthy();
    expect(within(history).getByText(/Reason: Wrong amount/)).toBeTruthy();
    expect(within(history).getByText(/1,000\.00/)).toBeTruthy();
    expect(within(history).getByText(/1,200\.00/)).toBeTruthy();
    expect(row().amount).toBe(1200);
  });
});
