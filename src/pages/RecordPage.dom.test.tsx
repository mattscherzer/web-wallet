// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { createFakeSupabase, type FakeSupabase } from '../test/fakeSupabase';
import { walletApp } from '../test/walletTestKit';
import { enterPin, transactionRows } from '../test/transactionsTestKit';

const ref = vi.hoisted(() => ({ fake: null as unknown as FakeSupabase }));
vi.mock('../db/supabase', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (...a: unknown[]) => (ref.fake.client as unknown as Record<string, (...x: unknown[]) => unknown>)[p as string](...a) }),
}));

// Loaded dynamically so missing modules fail the assertion instead of crashing the file.
const pageMod = await import('./RecordPage').catch(() => undefined);
const recordedMod = await import('./RecordedPage').catch(() => undefined);

beforeEach(() => {
  ref.fake = createFakeSupabase(transactionRows());
});
afterEach(cleanup);

function app(path: string) {
  expect(pageMod, 'src/pages/RecordPage.tsx must exist').toBeDefined();
  expect(recordedMod, 'src/pages/RecordedPage.tsx must exist').toBeDefined();
  const RecordPage = pageMod!.default;
  const RecordedPage = recordedMod!.default;
  render(
    walletApp(
      <Routes>
        <Route path="/record" element={<RecordPage />} />
        <Route path="/recorded/:id" element={<RecordedPage />} />
      </Routes>,
      { path, current: 'wa' },
    ),
  );
}

const group = (name: string) => within(screen.getByRole('radiogroup', { name }));
const submit = () => screen.getByRole('button', { name: /^Record/ });

describe('Record screen', () => {
  it('asks for the PIN before saving and refuses a wrong one', async () => {
    app('/record?type=out');
    // The type from the link is preselected.
    expect((group('Type of entry').getByRole('radio', { name: 'Money out' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Amount' }), { target: { value: '60' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Paid to or what for' }), { target: { value: 'Hall rent' } });
    fireEvent.click(await screen.findByRole('button', { name: /^Record −€60\.00 from Cash Balance/ }));
    expect(ref.fake.tables.transactions).toHaveLength(5);

    await enterPin('9999', ref.fake);
    expect(await screen.findByText(/Incorrect PIN/)).toBeTruthy();
    expect(ref.fake.tables.transactions).toHaveLength(5);

    await enterPin('1234', ref.fake);
    expect(await screen.findByRole('heading', { name: 'Recorded' })).toBeTruthy();
    expect(ref.fake.tables.transactions).toHaveLength(6);
  });

  it('shows a linked error summary, focuses it, and ties messages to the fields', async () => {
    app('/record?type=out');
    await screen.findByRole('textbox', { name: 'Amount' });
    fireEvent.click(submit());

    const summary = await screen.findByRole('alert');
    expect(document.activeElement).toBe(summary);
    const amountLink = within(summary).getByRole('link', { name: /amount/i });
    within(summary).getByRole('link', { name: /who was paid|what it was for/i });

    const amount = screen.getByRole('textbox', { name: 'Amount' });
    expect(amount.getAttribute('aria-invalid')).toBe('true');
    const described = document.getElementById(amount.getAttribute('aria-describedby') ?? '');
    expect(described?.textContent).toMatch(/amount/i);

    fireEvent.click(amountLink);
    expect(document.activeElement).toBe(amount);
    expect(ref.fake.tables.transactions.filter((t) => t.id !== 't5').length).toBe(4);
  });

  it('records money out and shows the receipt', async () => {
    app('/record?type=out');
    fireEvent.change(await screen.findByRole('textbox', { name: 'Amount' }), { target: { value: '60' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Paid to or what for' }), { target: { value: 'Hall rent' } });
    fireEvent.click(await screen.findByRole('button', { name: /^Record −€60\.00 from Cash Balance/ }));
    await enterPin('1234', ref.fake);

    expect(await screen.findByRole('heading', { name: 'Recorded' })).toBeTruthy();
    const saved = ref.fake.tables.transactions.at(-1)!;
    expect(saved).toMatchObject({ wallet_id: 'wa', type: 'outflow', amount: 60, account_id: 'cash', notes: 'Hall rent' });
    expect(ref.fake.tables.audit_log.at(-1)).toMatchObject({ action: 'create', transaction_id: saved.id });
    expect(screen.getByRole('button', { name: /Undo this entry/ })).toBeTruthy();
  });

  it('records a transfer between two accounts', async () => {
    app('/record?type=transfer');
    fireEvent.change(await screen.findByRole('textbox', { name: 'Amount' }), { target: { value: '50' } });
    fireEvent.click(group('From account').getByRole('radio', { name: 'Bank Account' }));
    fireEvent.click(group('To account').getByRole('radio', { name: 'Prudent Reserve' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Record €50\.00 from Bank Account to Prudent Reserve/ }));
    await enterPin('1234', ref.fake);

    expect(await screen.findByRole('heading', { name: 'Recorded' })).toBeTruthy();
    expect(ref.fake.tables.transactions.at(-1)).toMatchObject({ type: 'transfer', amount: 50, account_id: 'prudent_reserve', from_account_id: 'bank' });
  });

  it('shows an error and no receipt when saving fails', async () => {
    app('/record?type=in');
    fireEvent.change(await screen.findByRole('textbox', { name: 'Amount' }), { target: { value: '10' } });
    ref.fake.failNext('transactions:insert', { message: 'boom' });
    fireEvent.click(submit());
    await enterPin('1234', ref.fake);
    expect(await screen.findByText(/Nothing was saved/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Recorded' })).toBeNull());
    expect(ref.fake.tables.transactions).toHaveLength(5);
  });

  it('asks for the PIN before undoing an entry, then removes it as entered by mistake', async () => {
    app('/record?type=in');
    fireEvent.change(await screen.findByRole('textbox', { name: 'Amount' }), { target: { value: '25' } });
    fireEvent.click(submit());
    await enterPin('1234', ref.fake);
    fireEvent.click(await screen.findByRole('button', { name: /Undo this entry/ }));

    const saved = ref.fake.tables.transactions.at(-1)!;
    expect(saved.deleted).toBe(false);
    await enterPin('1234', ref.fake);
    await waitFor(() => expect(saved.deleted).toBe(true));
    expect(saved.removed_reason).toBe('Entered by mistake');
    expect(ref.fake.tables.audit_log.at(-1)).toMatchObject({ action: 'remove', transaction_id: saved.id });
  });
});
