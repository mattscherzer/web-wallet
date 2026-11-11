import { supabase } from './supabase';
import type { Role } from '../domain/access';

export async function loadProfile(user: {
  id: string;
  email: string;
}): Promise<{ profile: { displayName: string; kind: Role }; permissions: ReadonlySet<string> }> {
  const { data, error } = await supabase.from('profiles').select('display_name, kind').eq('id', user.id).single();
  if (error || !data) {
    console.error('Failed to load the profile:', error);
    // Without a profile nothing is offered; the database refuses anyway.
    return { profile: { displayName: user.email, kind: 'staff' }, permissions: new Set() };
  }
  const kind: Role = data.kind === 'owner' ? 'owner' : 'staff';
  const perms = await supabase.from('role_permissions').select('action').eq('role', kind);
  if (perms.error) console.error('Failed to load the permissions:', perms.error);
  return {
    profile: { displayName: String(data.display_name) || user.email, kind },
    permissions: new Set((perms.data ?? []).map((p) => String(p.action))),
  };
}
