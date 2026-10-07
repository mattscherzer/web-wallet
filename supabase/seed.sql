-- Local development data. Safe to re-run: every insert is ON CONFLICT DO NOTHING.
-- Applied by `npm run db:reset` (automatically) and `npm run db:seed` (re-run only).

INSERT INTO app_config (key, value) VALUES ('pin', '1234') ON CONFLICT DO NOTHING;

INSERT INTO transactions (id, type, amount, date, account_id, from_account_id, category, notes, reason, created_at, updated_at, deleted) VALUES
  ('00000000-0000-4000-8000-000000000001', 'inflow',   500.00, '2026-01-05', 'bank',            NULL,   'Donation',  'Fake: January donation',      'Donation',  '2026-01-05 10:00:00+00', '2026-01-05 10:00:00+00', false),
  ('00000000-0000-4000-8000-000000000002', 'inflow',   120.50, '2026-01-12', 'cash',            NULL,   'Event',     'Fake: Bake sale',             'Bake sale', '2026-01-12 15:30:00+00', '2026-01-12 15:30:00+00', false),
  ('00000000-0000-4000-8000-000000000003', 'outflow',   45.30, '2026-01-15', 'cash',            NULL,   'Supplies',  'Fake: Printer paper',         NULL,        '2026-01-15 09:00:00+00', '2026-01-15 09:00:00+00', false),
  ('00000000-0000-4000-8000-000000000004', 'transfer', 200.00, '2026-01-20', 'prudent_reserve', 'bank', 'Reserve',   'Fake: Move to reserve',       NULL,        '2026-01-20 12:00:00+00', '2026-01-20 12:00:00+00', false),
  ('00000000-0000-4000-8000-000000000005', 'outflow',   80.00, '2026-01-22', 'paypal',          NULL,   'Software',  'Fake: Entered twice, removed', NULL,       '2026-01-22 08:00:00+00', '2026-01-22 18:00:00+00', true)
ON CONFLICT DO NOTHING;

INSERT INTO audit_log (id, transaction_id, action, timestamp, previous_data, new_data) VALUES
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'create', '2026-01-05 10:00:00+00', NULL, '{"amount": 500.00, "account_id": "bank"}'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'create', '2026-01-12 15:30:00+00', NULL, '{"amount": 120.50, "account_id": "cash"}'),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 'create', '2026-01-15 09:00:00+00', NULL, '{"amount": 45.30, "account_id": "cash"}'),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004', 'create', '2026-01-20 12:00:00+00', NULL, '{"amount": 200.00, "account_id": "prudent_reserve"}'),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005', 'create', '2026-01-22 08:00:00+00', NULL, '{"amount": 80.00, "account_id": "paypal"}'),
  ('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000005', 'delete', '2026-01-22 18:00:00+00', '{"deleted": false}', '{"deleted": true}')
ON CONFLICT DO NOTHING;
