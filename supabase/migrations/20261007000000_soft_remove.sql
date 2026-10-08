-- =============================================
-- Soft remove with a reason, restore, and who/why in the change history.
--
-- * transactions: why/who/when an entry was removed (the row itself stays, deleted = true).
-- * audit_log: actor (nullable until sign-in exists), reason, note; new actions 'remove' and 'restore'.
--   A removal must carry a reason. Old 'delete' rows stay valid: entries removed before this change
--   show as Removed with no reason recorded.
-- Safe to run twice.
-- =============================================
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS removed_reason TEXT,
  ADD COLUMN IF NOT EXISTS removed_note   TEXT,
  ADD COLUMN IF NOT EXISTS removed_by     TEXT,
  ADD COLUMN IF NOT EXISTS removed_at     TIMESTAMPTZ;

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS actor  TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS note   TEXT;

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check
  CHECK (action IN ('create', 'update', 'delete', 'remove', 'restore'));

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_remove_needs_reason;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_remove_needs_reason
  CHECK (action <> 'remove' OR reason IS NOT NULL);
