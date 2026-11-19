import { createContext, useContext } from 'react';

export const OWNER_CONFIRM_MS = 15 * 60_000;

export type Confirm = () => Promise<boolean>;
export const OwnerConfirmContext = createContext<Confirm | null>(null);

/** Asks for the owner's password before an owner-only action; resolves to whether to go on. Outside a provider nothing is asked. */
export function useOwnerConfirm(): Confirm {
  return useContext(OwnerConfirmContext) ?? (async () => true);
}
