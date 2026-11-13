import { supabase } from './supabase';
import { functionErrorMessage } from './functionError';
import { couldnt } from '../utils/copy';
import type { StaffMember } from '../domain/staff';

/** One call to the staff-admin edge function (it checks that the caller owns the wallet involved). */
async function staffAdmin<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('staff-admin', { body });
  if (error) throw new Error(await functionErrorMessage(error, couldnt('do that')));
  return data as T;
}

export async function listStaff(walletId: string): Promise<StaffMember[]> {
  const { staff } = await staffAdmin<{ staff: StaffMember[] }>({ action: 'list', wallet_id: walletId });
  return staff ?? [];
}

export async function createStaff(input: {
  walletId: string;
  username: string;
  displayName: string;
  pin: string;
}): Promise<void> {
  await staffAdmin({
    action: 'create',
    wallet_id: input.walletId,
    username: input.username,
    display_name: input.displayName,
    pin: input.pin,
  });
}

export async function resetStaffPin(userId: string, pin: string): Promise<void> {
  await staffAdmin({ action: 'reset_pin', user_id: userId, pin });
}

export async function setStaffDisabled(userId: string, disabled: boolean): Promise<void> {
  await staffAdmin({ action: disabled ? 'disable' : 'enable', user_id: userId });
}
