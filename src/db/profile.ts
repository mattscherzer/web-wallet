import { supabase } from './supabase';
import type { Role } from '../domain/access';

export async function loadProfile(user: {
  id: string;
  email: string;
}): Promise<{ profile: { displayName: string; kind: Role }; permissions: ReadonlySet<string> }> {
  // Asked together: all permission rows are public to a signed-in user, so the kind need not be known first.
  const [{ data, error }, perms] = await Promise.all([
    supabase.from('profiles').select('display_name, kind').eq('id', user.id).single(),
    supabase.from('role_permissions').select('role, action'),
  ]);
  if (perms.error) console.error('Failed to load the permissions:', perms.error);
  if (error || !data) {
    console.error('Failed to load the profile:', error);
    // Without a profile nothing is offered; the database refuses anyway.
    return { profile: { displayName: user.email, kind: 'staff' }, permissions: new Set() };
  }
  const kind: Role = data.kind === 'owner' ? 'owner' : 'staff';
  return {
    profile: { displayName: String(data.display_name) || user.email, kind },
    permissions: new Set((perms.data ?? []).filter((p) => p.role === kind).map((p) => String(p.action))),
  };
}
