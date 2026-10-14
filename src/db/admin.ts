import { supabase } from './supabase';

export interface ProfileRow {
  id: string;
  display_name: string;
  is_admin: boolean;
}

export interface MemberRow {
  user_id: string;
  wallet_id: string;
}

/** Names of the people the logged-in user may see (themselves and everyone who shares a wallet with them). */
export async function fetchAuthorNames(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('profiles').select('id, display_name');
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((p) => [String(p.id), String(p.display_name)]));
}

export async function fetchProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase.from('profiles').select('id, display_name, is_admin').order('display_name');
  if (error) throw new Error(error.message);
  return (data ?? []) as ProfileRow[];
}

export async function fetchMembers(): Promise<MemberRow[]> {
  const { data, error } = await supabase.from('wallet_members').select('user_id, wallet_id');
  if (error) throw new Error(error.message);
  return (data ?? []) as MemberRow[];
}

export async function addMember(userId: string, walletId: string): Promise<void> {
  const { error } = await supabase.from('wallet_members').insert({ user_id: userId, wallet_id: walletId });
  if (error) throw new Error(error.code === '23505' ? 'They are already in that wallet' : error.message);
}

/** Creates a login through the admin-checked edge function (it holds the service-role key). */
export async function createUser(input: {
  email: string;
  password: string;
  displayName: string;
  walletIds: string[];
}): Promise<void> {
  const { error } = await supabase.functions.invoke('admin-create-user', { body: input });
  if (!error) return;
  let message = 'Could not create the user';
  const response = (error as { context?: unknown }).context;
  if (response instanceof Response) {
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep the generic message
    }
  }
  throw new Error(message);
}
