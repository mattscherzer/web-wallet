-- =============================================
-- Wallets: every transaction and audit entry belongs to one wallet. (#46)
--
-- BEFORE RUNNING IN PRODUCTION
--   1. Take a backup (Dashboard -> Database -> Backups, or `pg_dump`).
--   2. Run it first against a local/staging copy (#32).
--
-- Safe to run twice and on an empty database. Existing rows move into the
-- "Thursday SLAA Meeting" wallet. wallet_id keeps that wallet as its DEFAULT so
-- the previous app version can keep inserting while the new one rolls out;
-- drop the defaults in a later cleanup once nothing old is running.
--
-- ROLLBACK (only if no second wallet has data yet, otherwise export first):
--   ALTER TABLE audit_log   DROP COLUMN wallet_id;
--   ALTER TABLE transactions DROP COLUMN wallet_id;
--   DROP TABLE wallets;
-- =============================================

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_name_unique ON wallets (lower(name));

INSERT INTO wallets (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Thursday SLAA Meeting')
ON CONFLICT DO NOTHING;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id);
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id);

UPDATE transactions
  SET wallet_id = '00000000-0000-0000-0000-000000000001'
  WHERE wallet_id IS NULL;
UPDATE audit_log
  SET wallet_id = '00000000-0000-0000-0000-000000000001'
  WHERE wallet_id IS NULL;

ALTER TABLE transactions
  ALTER COLUMN wallet_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE transactions
  ALTER COLUMN wallet_id SET NOT NULL;
ALTER TABLE audit_log
  ALTER COLUMN wallet_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE audit_log
  ALTER COLUMN wallet_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions (wallet_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_wallet ON audit_log (wallet_id);

-- Same access model as the other tables for now; real per-member policies come with #33.
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for anon" ON wallets;
CREATE POLICY "Allow all for anon" ON wallets FOR ALL USING (true) WITH CHECK (true);
