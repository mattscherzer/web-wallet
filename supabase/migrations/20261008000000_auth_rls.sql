-- =============================================
-- Auth, owner and staff roles, wallet membership and per-entry authorship.
--
-- Roles (see docs/decisions/auth-owner-and-staff.md):
--   * owner: an email + password account (created in the Supabase dashboard; sign-ups are off).
--   * staff: a username + 6-digit PIN. Technically a login with a synthetic address and no personal data;
--     the staff-login edge function checks the PIN on the server and starts the session.
-- What each role may do lives in ONE table, role_permissions, read by the policies below and by the app.
--
-- * profiles(id, display_name, kind) and wallet_members(user_id, wallet_id, role).
--   One owner per wallet and staff in one wallet are two plain unique indexes: drop one to relax it.
-- * transactions / audit_log record who made them: created_by, created_by_role, created_by_name. The role and
--   name are a snapshot written by the database, so history stays right after an account is removed.
-- * The allow-all anon policies are gone. Nobody but the server writes profiles, memberships, permissions,
--   wallets or staff credentials; wallets are created through create_wallet().
-- * app_config (the global PIN) is dropped.
-- * Existing data stays reachable (no lockout): the earliest existing account becomes the owner of the default
--   wallet, every other existing account becomes staff of it (with no PIN until the owner sets one).
--   Create the owner's account in the Supabase dashboard BEFORE running this. See supabase/backfill/README.md.
--
-- Safe to run twice.
--
-- ROLLBACK (after taking the backup described in supabase/backfill/README.md): restore the backup, or restore the
-- allow-all policies ("Allow all for anon" on transactions, audit_log, wallets), re-create app_config(key, value)
-- with the PIN row, DROP TABLE staff_login_attempts, staff_credentials, role_permissions, wallet_members,
-- profiles, drop the functions created here, and ALTER TABLE transactions / audit_log DROP COLUMN created_by,
-- created_by_role, created_by_name.
-- =============================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'owner' CHECK (kind IN ('owner', 'staff'))
);

CREATE TABLE IF NOT EXISTS wallet_members (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
  PRIMARY KEY (user_id, wallet_id)
);
CREATE INDEX IF NOT EXISTS idx_wallet_members_wallet ON wallet_members(wallet_id);
-- Today's limits. Both are plain indexes: drop one to allow several owners, or staff in several wallets.
CREATE UNIQUE INDEX IF NOT EXISTS one_owner_per_wallet ON wallet_members (wallet_id) WHERE role = 'owner';
CREATE UNIQUE INDEX IF NOT EXISTS staff_in_one_wallet ON wallet_members (user_id) WHERE role = 'staff';

-- An account can only hold the role that matches its kind.
CREATE OR REPLACE FUNCTION check_member_role() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = NEW.user_id AND p.kind = NEW.role) THEN
    RAISE EXCEPTION 'role % does not match the account kind', NEW.role;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS wallet_members_check_role ON wallet_members;
CREATE TRIGGER wallet_members_check_role BEFORE INSERT OR UPDATE ON wallet_members
  FOR EACH ROW EXECUTE FUNCTION check_member_role();

-- The one place that says what each role may do.
CREATE TABLE IF NOT EXISTS role_permissions (
  role TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
  action TEXT NOT NULL,
  PRIMARY KEY (role, action)
);
INSERT INTO role_permissions (role, action) VALUES
  ('owner', 'view'), ('owner', 'add_entry'), ('owner', 'edit_entry'), ('owner', 'remove_entry'),
  ('owner', 'remove_own_entry'), ('owner', 'restore_entry'), ('owner', 'create_category'),
  ('owner', 'manage_wallet'), ('owner', 'manage_staff'), ('owner', 'export'),
  ('staff', 'view'), ('staff', 'add_entry'), ('staff', 'edit_entry'), ('staff', 'remove_own_entry'),
  ('staff', 'create_category')
ON CONFLICT DO NOTHING;

-- Staff PINs: only server code (the service role) can touch these.
CREATE TABLE IF NOT EXISTS staff_credentials (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  username TEXT NOT NULL CHECK (username = lower(btrim(username)) AND char_length(username) BETWEEN 1 AND 40),
  pin_hash TEXT NOT NULL,
  disabled_at TIMESTAMPTZ
);
-- Usernames are unique across wallets for now (staff belong to one wallet). Per-wallet names would need a wallet at login.
CREATE UNIQUE INDEX IF NOT EXISTS staff_credentials_username ON staff_credentials (username);

CREATE TABLE IF NOT EXISTS staff_login_attempts (
  username TEXT PRIMARY KEY,
  attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ
);

-- Who made an entry ------------------------------------------------------------
-- Added without a default first, so existing rows stay author-less.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by_role TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS created_by_role TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE transactions ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE audit_log ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Permission helpers. SECURITY DEFINER so policies can read the membership tables.
CREATE OR REPLACE FUNCTION is_disabled() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM staff_credentials c WHERE c.user_id = auth.uid() AND c.disabled_at IS NOT NULL)
$$;

CREATE OR REPLACE FUNCTION is_wallet_member(target UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM wallet_members m WHERE m.user_id = auth.uid() AND m.wallet_id = target)
    AND NOT is_disabled()
$$;

CREATE OR REPLACE FUNCTION can(target UUID, act TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM wallet_members m JOIN role_permissions p ON p.role = m.role
    WHERE m.user_id = auth.uid() AND m.wallet_id = target AND p.action = act
  ) AND NOT is_disabled()
$$;

CREATE OR REPLACE FUNCTION shares_wallet_with(other UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM wallet_members mine JOIN wallet_members theirs ON theirs.wallet_id = mine.wallet_id
    WHERE mine.user_id = auth.uid() AND theirs.user_id = other
  ) AND NOT is_disabled()
$$;

-- Wallet and its owner membership in one step (owners only).
CREATE OR REPLACE FUNCTION create_wallet(name TEXT) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id UUID;
BEGIN
  IF auth.uid() IS NULL OR is_disabled()
     OR NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.kind = 'owner') THEN
    RAISE EXCEPTION 'only owners can create wallets' USING ERRCODE = '42501';
  END IF;
  INSERT INTO wallets (name) VALUES (create_wallet.name) RETURNING id INTO new_id;
  INSERT INTO wallet_members (user_id, wallet_id, role) VALUES (auth.uid(), new_id, 'owner');
  RETURN new_id;
END $$;

REVOKE ALL ON FUNCTION is_disabled() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION is_wallet_member(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION can(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION shares_wallet_with(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION create_wallet(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_disabled() TO authenticated;
GRANT EXECUTE ON FUNCTION is_wallet_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION shares_wallet_with(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_wallet(TEXT) TO authenticated;

-- PIN attempts, counted atomically and only callable by the server ---------------
-- Five tries are free; every try after that, once a wait is over, doubles the next wait (30 s, 60 s, ... capped at 1 h).
-- Unknown usernames are counted exactly like real ones. `locked` says this try is refused outright.
CREATE OR REPLACE FUNCTION staff_begin_attempt(p_username TEXT, p_now TIMESTAMPTZ DEFAULT now())
RETURNS TABLE (user_id UUID, pin_hash TEXT, disabled BOOLEAN, locked BOOLEAN, retry_after INT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name TEXT := lower(btrim(p_username));
  v_locked_until TIMESTAMPTZ;
  v_last TIMESTAMPTZ;
BEGIN
  INSERT INTO staff_login_attempts AS a (username, attempts, locked_until, last_attempt_at)
  VALUES (v_name, 1, NULL, p_now)
  ON CONFLICT (username) DO UPDATE SET
    attempts = CASE WHEN a.locked_until > p_now THEN a.attempts ELSE a.attempts + 1 END,
    locked_until = CASE
      WHEN a.locked_until > p_now THEN a.locked_until
      WHEN a.attempts + 1 >= 5 THEN p_now + make_interval(secs => least(30 * power(2, least(a.attempts + 1 - 5, 10)), 3600))
      ELSE NULL END,
    last_attempt_at = CASE WHEN a.locked_until > p_now THEN a.last_attempt_at ELSE p_now END
  RETURNING a.locked_until, a.last_attempt_at INTO v_locked_until, v_last;

  -- Locked before this call: a lock was already running and nothing was counted.
  locked := v_locked_until IS NOT NULL AND v_locked_until > p_now AND v_last IS DISTINCT FROM p_now;
  retry_after := CASE WHEN locked THEN ceil(extract(epoch FROM v_locked_until - p_now))::int ELSE 0 END;
  SELECT c.user_id, c.pin_hash, c.disabled_at IS NOT NULL INTO user_id, pin_hash, disabled
  FROM staff_credentials c WHERE c.username = v_name;
  disabled := coalesce(disabled, false);
  RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION staff_reset_attempts(p_username TEXT) RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM staff_login_attempts WHERE username = lower(btrim(p_username))
$$;

REVOKE ALL ON FUNCTION staff_begin_attempt(TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION staff_reset_attempts(TEXT) FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION staff_begin_attempt(TEXT, TIMESTAMPTZ) TO service_role;
    GRANT EXECUTE ON FUNCTION staff_reset_attempts(TEXT) TO service_role;
  END IF;
END $$;

-- Authorship and removal rules, enforced by the database ---------------------------
-- wallet_id, created_by and its snapshot never change (except when the account is deleted, which clears created_by only).
CREATE OR REPLACE FUNCTION keep_created_by() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.wallet_id IS DISTINCT FROM OLD.wallet_id THEN
    RAISE EXCEPTION 'an entry cannot move to another wallet';
  END IF;
  IF NEW.created_by_role IS DISTINCT FROM OLD.created_by_role OR NEW.created_by_name IS DISTINCT FROM OLD.created_by_name THEN
    RAISE EXCEPTION 'the author of an entry cannot be changed';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     AND NOT (NEW.created_by IS NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = OLD.created_by)) THEN
    RAISE EXCEPTION 'created_by cannot be changed';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS transactions_keep_created_by ON transactions;
CREATE TRIGGER transactions_keep_created_by BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION keep_created_by();
DROP TRIGGER IF EXISTS audit_log_keep_created_by ON audit_log;
CREATE TRIGGER audit_log_keep_created_by BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION keep_created_by();

-- Role and name are written here from the logged-in member, never taken from the client.
CREATE OR REPLACE FUNCTION stamp_author() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by_role := NULL;
    NEW.created_by_name := NULL;
  ELSE
    NEW.created_by_role := (SELECT m.role FROM wallet_members m WHERE m.user_id = NEW.created_by AND m.wallet_id = NEW.wallet_id);
    NEW.created_by_name := (SELECT p.display_name FROM profiles p WHERE p.id = NEW.created_by);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS transactions_stamp_author ON transactions;
CREATE TRIGGER transactions_stamp_author BEFORE INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION stamp_author();
DROP TRIGGER IF EXISTS audit_log_stamp_author ON audit_log;
CREATE TRIGGER audit_log_stamp_author BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION stamp_author();

-- Removing and restoring entries, checked column by column: a plain-looking edit cannot restore an entry.
CREATE OR REPLACE FUNCTION check_soft_remove() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.deleted, NEW.removed_at, NEW.removed_reason, NEW.removed_note, NEW.removed_by)
     IS NOT DISTINCT FROM (OLD.deleted, OLD.removed_at, OLD.removed_reason, OLD.removed_note, OLD.removed_by) THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- server-side maintenance, not a client
  END IF;
  IF NEW.deleted AND NOT OLD.deleted THEN
    -- coalesce: an entry with no author (from before login existed) is nobody's own, never a NULL that lets it through.
    IF NOT coalesce(
      can(NEW.wallet_id, 'remove_entry')
        OR (can(NEW.wallet_id, 'remove_own_entry') AND OLD.created_by IS NOT NULL AND OLD.created_by = auth.uid()),
      false) THEN
      RAISE EXCEPTION 'you may not remove this entry' USING ERRCODE = '42501';
    END IF;
    NEW.removed_by := (SELECT p.display_name FROM profiles p WHERE p.id = auth.uid());
  ELSIF NOT NEW.deleted AND OLD.deleted AND NEW.removed_at IS NULL THEN
    IF NOT can(NEW.wallet_id, 'restore_entry') THEN
      RAISE EXCEPTION 'only the owner may restore an entry' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT can(NEW.wallet_id, 'restore_entry') THEN
      RAISE EXCEPTION 'removal details cannot be edited' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS transactions_check_soft_remove ON transactions;
CREATE TRIGGER transactions_check_soft_remove BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION check_soft_remove();

-- New logins get a profile (owner by default; the staff function says 'staff').
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, display_name, kind)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    CASE WHEN NEW.raw_user_meta_data ->> 'kind' = 'staff' THEN 'staff' ELSE 'owner' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Row level security -------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon" ON transactions;
DROP POLICY IF EXISTS "Allow all for anon" ON audit_log;
DROP POLICY IF EXISTS "Allow all for anon" ON wallets;

DROP POLICY IF EXISTS "members read transactions" ON transactions;
DROP POLICY IF EXISTS "members add transactions" ON transactions;
DROP POLICY IF EXISTS "members change transactions" ON transactions;
DROP POLICY IF EXISTS "authors undo new transactions" ON transactions;
CREATE POLICY "members read transactions" ON transactions FOR SELECT TO authenticated
  USING (can(wallet_id, 'view'));
CREATE POLICY "members add transactions" ON transactions FOR INSERT TO authenticated
  WITH CHECK (can(wallet_id, 'add_entry') AND created_by = auth.uid());
CREATE POLICY "members change transactions" ON transactions FOR UPDATE TO authenticated
  USING (can(wallet_id, 'edit_entry')) WITH CHECK (can(wallet_id, 'edit_entry'));
-- Only so the app can undo an entry whose history row failed to save, right after creating it. Removing
-- an entry is a soft remove (above), never a delete.
CREATE POLICY "authors undo new transactions" ON transactions FOR DELETE TO authenticated
  USING (can(wallet_id, 'add_entry') AND created_by = auth.uid() AND created_at > now() - interval '30 seconds');

DROP POLICY IF EXISTS "members read audit_log" ON audit_log;
DROP POLICY IF EXISTS "members add audit_log" ON audit_log;
DROP POLICY IF EXISTS "members change audit_log" ON audit_log;
CREATE POLICY "members read audit_log" ON audit_log FOR SELECT TO authenticated
  USING (can(wallet_id, 'view'));
CREATE POLICY "members add audit_log" ON audit_log FOR INSERT TO authenticated
  WITH CHECK (can(wallet_id, 'view') AND created_by = auth.uid());

DROP POLICY IF EXISTS "members read wallets" ON wallets;
DROP POLICY IF EXISTS "admins add wallets" ON wallets;
DROP POLICY IF EXISTS "admins change wallets" ON wallets;
DROP POLICY IF EXISTS "admins delete wallets" ON wallets;
CREATE POLICY "members read wallets" ON wallets FOR SELECT TO authenticated
  USING (is_wallet_member(id));

DROP POLICY IF EXISTS "read own memberships" ON wallet_members;
DROP POLICY IF EXISTS "admins manage memberships" ON wallet_members;
DROP POLICY IF EXISTS "read memberships" ON wallet_members;
CREATE POLICY "read memberships" ON wallet_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR can(wallet_id, 'manage_staff'));

DROP POLICY IF EXISTS "read visible profiles" ON profiles;
DROP POLICY IF EXISTS "admins manage profiles" ON profiles;
CREATE POLICY "read visible profiles" ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR shares_wallet_with(id));

DROP POLICY IF EXISTS "read permissions" ON role_permissions;
CREATE POLICY "read permissions" ON role_permissions FOR SELECT TO authenticated USING (true);

-- Table privileges: Supabase gives anon and authenticated everything on new tables, so take it away. Only the
-- server (service role, which bypasses these) writes profiles, memberships, permissions, wallets and PINs.
REVOKE ALL ON staff_credentials, staff_login_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON role_permissions FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON role_permissions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON profiles, wallet_members, wallets FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE ON transactions FROM PUBLIC, anon, authenticated;

-- The PIN is gone: login replaces it.
DROP TABLE IF EXISTS app_config;

-- Existing data: keep it reachable right away (no lockout) --------------------
-- The earliest account is the owner (when there is no owner yet); everyone else becomes staff.
INSERT INTO profiles (id, display_name, kind)
SELECT u.id,
       coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1)),
       CASE WHEN u.id = (SELECT x.id FROM auth.users x ORDER BY x.created_at, x.id LIMIT 1)
                 AND NOT EXISTS (SELECT 1 FROM profiles WHERE kind = 'owner')
            THEN 'owner' ELSE 'staff' END
FROM auth.users u
ORDER BY u.created_at, u.id
ON CONFLICT (id) DO NOTHING;

INSERT INTO wallet_members (user_id, wallet_id, role)
SELECT p.id, w.id, p.kind FROM profiles p CROSS JOIN wallets w
WHERE w.id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- An account that is not the owner has no PIN yet, so it cannot sign in as staff until the owner sets one.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM wallet_members WHERE role = 'owner' AND wallet_id = '00000000-0000-0000-0000-000000000001') THEN
    RAISE NOTICE 'The default wallet has no owner: create the owner account in the Supabase dashboard first (see supabase/backfill/README.md).';
  END IF;
END $$;
