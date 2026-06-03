-- =============================================
-- Treasury Wallet — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- =============================================

-- 1. Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('inflow', 'outflow', 'transfer')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  account_id TEXT NOT NULL CHECK (account_id IN ('cash', 'paypal', 'bank', 'prudent_reserve')),
  from_account_id TEXT CHECK (from_account_id IN ('cash', 'paypal', 'bank', 'prudent_reserve')),
  category TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted BOOLEAN NOT NULL DEFAULT false
);

-- 2. Audit log table
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  previous_data JSONB,
  new_data JSONB
);

-- 3. App config (PIN and settings — only editable via Supabase dashboard)
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO app_config (key, value) VALUES ('pin', '1234');

-- 4. Indexes
CREATE INDEX idx_transactions_deleted ON transactions(deleted);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_audit_log_transaction ON audit_log(transaction_id);

-- 5. Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON audit_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Read only config for anon" ON app_config FOR SELECT USING (true);

-- 6. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;
