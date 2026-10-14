-- =============================================
-- Auth, wallet membership and per-entry authorship.
--
-- * profiles(id → auth.users, display_name, is_admin) and wallet_members(user_id, wallet_id).
-- * transactions / audit_log get created_by (nullable: legacy rows have no author).
-- * The allow-all anon policies are replaced: only members read and write a wallet's rows,
--   only admins create wallets and manage memberships and profiles, the anon key gets nothing.
--   Admins MANAGE; they see entries only of wallets they are a member of.
-- * app_config (the global PIN) is dropped: login replaces the PIN.
-- * Existing production data stays reachable: every account that exists when this runs becomes a member
--   of the default wallet, and the earliest account (the owner) becomes admin. Create the owner's
--   account in the Supabase dashboard BEFORE running this. See supabase/backfill/README.md.
--
-- Safe to run twice.
--
-- ROLLBACK (after taking the backup described in supabase/backfill/README.md):
--   restore the allow-all policies ("Allow all for anon" on transactions, audit_log, wallets),
--   re-create app_config(key, value) with the PIN row, then DROP TABLE wallet_members, profiles
--   and ALTER TABLE transactions / audit_log DROP COLUMN created_by. Or restore the backup.
-- =============================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  is_admin BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS wallet_members (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, wallet_id)
);
CREATE INDEX IF NOT EXISTS idx_wallet_members_wallet ON wallet_members(wallet_id);

-- Added without a default first, so existing rows stay author-less.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE transactions ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE audit_log ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Permission helpers. SECURITY DEFINER so policies can read the membership tables.
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT p.is_admin FROM profiles p WHERE p.id = auth.uid()), false)
$$;

CREATE OR REPLACE FUNCTION is_wallet_member(target UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM wallet_members m WHERE m.user_id = auth.uid() AND m.wallet_id = target)
$$;

CREATE OR REPLACE FUNCTION shares_wallet_with(other UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM wallet_members mine JOIN wallet_members theirs ON theirs.wallet_id = mine.wallet_id
    WHERE mine.user_id = auth.uid() AND theirs.user_id = other
  )
$$;

REVOKE ALL ON FUNCTION is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION is_wallet_member(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION shares_wallet_with(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_wallet_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION shares_wallet_with(UUID) TO authenticated;

-- Who made an entry never changes.
CREATE OR REPLACE FUNCTION keep_created_by() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
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

-- Every new login gets a profile (never an admin one).
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, coalesce(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Row level security -------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon" ON transactions;
DROP POLICY IF EXISTS "Allow all for anon" ON audit_log;
DROP POLICY IF EXISTS "Allow all for anon" ON wallets;

DROP POLICY IF EXISTS "members read transactions" ON transactions;
DROP POLICY IF EXISTS "members add transactions" ON transactions;
DROP POLICY IF EXISTS "members change transactions" ON transactions;
DROP POLICY IF EXISTS "authors delete transactions" ON transactions;
CREATE POLICY "members read transactions" ON transactions FOR SELECT TO authenticated
  USING (is_wallet_member(wallet_id));
CREATE POLICY "members add transactions" ON transactions FOR INSERT TO authenticated
  WITH CHECK (is_wallet_member(wallet_id) AND created_by = auth.uid());
CREATE POLICY "members change transactions" ON transactions FOR UPDATE TO authenticated
  USING (is_wallet_member(wallet_id)) WITH CHECK (is_wallet_member(wallet_id));
-- Only so the app can undo its own half-finished write.
CREATE POLICY "authors delete transactions" ON transactions FOR DELETE TO authenticated
  USING (is_wallet_member(wallet_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "members read audit_log" ON audit_log;
DROP POLICY IF EXISTS "members add audit_log" ON audit_log;
DROP POLICY IF EXISTS "members change audit_log" ON audit_log;
CREATE POLICY "members read audit_log" ON audit_log FOR SELECT TO authenticated
  USING (is_wallet_member(wallet_id));
CREATE POLICY "members add audit_log" ON audit_log FOR INSERT TO authenticated
  WITH CHECK (is_wallet_member(wallet_id) AND created_by = auth.uid());
CREATE POLICY "members change audit_log" ON audit_log FOR UPDATE TO authenticated
  USING (is_wallet_member(wallet_id)) WITH CHECK (is_wallet_member(wallet_id));

DROP POLICY IF EXISTS "members read wallets" ON wallets;
DROP POLICY IF EXISTS "admins add wallets" ON wallets;
DROP POLICY IF EXISTS "admins change wallets" ON wallets;
DROP POLICY IF EXISTS "admins delete wallets" ON wallets;
CREATE POLICY "members read wallets" ON wallets FOR SELECT TO authenticated
  USING (is_wallet_member(id) OR is_admin());
CREATE POLICY "admins add wallets" ON wallets FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "admins change wallets" ON wallets FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admins delete wallets" ON wallets FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "read own memberships" ON wallet_members;
DROP POLICY IF EXISTS "admins manage memberships" ON wallet_members;
CREATE POLICY "read own memberships" ON wallet_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "admins manage memberships" ON wallet_members FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "read visible profiles" ON profiles;
DROP POLICY IF EXISTS "admins manage profiles" ON profiles;
CREATE POLICY "read visible profiles" ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin() OR shares_wallet_with(id));
CREATE POLICY "admins manage profiles" ON profiles FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- The PIN is gone: login replaces it.
DROP TABLE IF EXISTS app_config;

-- Existing data: keep it reachable right away (no lockout) --------------------
INSERT INTO profiles (id, display_name)
SELECT u.id, coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1))
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

UPDATE profiles SET is_admin = true
WHERE id = (SELECT id FROM auth.users ORDER BY created_at, id LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM profiles WHERE is_admin);

INSERT INTO wallet_members (user_id, wallet_id)
SELECT p.id, w.id FROM profiles p CROSS JOIN wallets w
WHERE w.id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;
