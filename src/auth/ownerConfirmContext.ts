import { createContext, useContext } from 'react';

/** After the owner confirms their password, owner-only actions stay open this long. */
export const OWNER_CONFIRM_MS = 15 * 60_000;

export type Confirm = () => Promise<boolean>;
export const OwnerConfirmContext = createContext<Confirm | null>(null);

/**
 * Asks for the owner's password before an owner-only action (once per 15 minutes) and resolves to whether to go on.
 * This is an app-level safeguard (a borrowed, unlocked phone); the database enforces who may do what.
 * Outside a provider nothing is asked.
 */
export function useOwnerConfirm(): Confirm {
  return useContext(OwnerConfirmContext) ?? (async () => true);
}
