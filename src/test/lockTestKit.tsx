// Shared setup for tests of the locked (view-only) state: the real shell, wrapped like src/App.tsx.
import { type ReactNode } from 'react';
import { vi } from 'vitest';
import { Route, Routes } from 'react-router';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { AuthProvider } from '../auth/AuthProvider';
import { AuthGate } from '../auth/AuthGate';
import { OwnerConfirmProvider } from '../auth/OwnerConfirm';
import { LAST_STAFF_KEY } from '../auth/LoginPage';
import Layout from '../components/Layout';
import AdminPage from '../pages/AdminPage';
import EntryPage from '../pages/EntryPage';
import MorePage from '../pages/MorePage';
import { walletApp } from './walletTestKit';

export function shell(extra: ReactNode = null, path = '/') {
  return render(
    <AuthProvider>
      <AuthGate>
        <OwnerConfirmProvider>
          {walletApp(
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<p>the books</p>} />
                <Route path="more" element={<MorePage />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="history/:id" element={<EntryPage />} />
              </Route>
            </Routes>,
            { current: 'wa', path },
          )}
          {extra}
        </OwnerConfirmProvider>
      </AuthGate>
    </AuthProvider>,
  );
}

/** A staff member who signed in earlier on this device: the phone remembers the username. */
export function rememberStaff(username = 'anna') {
  localStorage.setItem(LAST_STAFF_KEY, username);
}

export const sheet = () => screen.getByRole('dialog', { name: 'Unlock to make changes' });
export const findSheet = () => screen.findByRole('dialog', { name: 'Unlock to make changes' });
export const noSheet = () => screen.queryByRole('dialog', { name: 'Unlock to make changes' });

export function pressPin(digits: string) {
  const pad = within(sheet());
  for (const d of digits) fireEvent.click(pad.getByRole('button', { name: d }));
}

export const pass = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

/** An edge-function answer the way supabase-js reports a refused call: an error whose `context` is the response. */
export function refused(status: number, body: unknown, message = 'Edge Function returned a non-2xx status code') {
  return { error: { message, context: new Response(JSON.stringify(body), { status }) } as { message: string } };
}
