-- Local development data. Safe to re-run: every insert is ON CONFLICT DO NOTHING.
-- Applied by `npm run db:reset` (automatically) and `npm run db:seed` (re-run only).

-- Local logins. Never used in production.
--   owner@example.test   owner of the default wallet; password: password123
--   anna (staff)         staff of the default wallet; username: anna, PIN: 123456
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change) VALUES
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner@example.test', '$2a$10$MQODK60PfqvsAl2K9UlU8.qEY45PazM0eyOzeYOPOTeakvv7t01W2', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Owner","kind":"owner"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'a0000000-0000-4000-8000-000000000002@staff.invalid', '$2a$10$MQODK60PfqvsAl2K9UlU8.qEY45PazM0eyOzeYOPOTeakvv7t01W2', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Anna","kind":"staff"}', now(), now(), '', '', '', '')
ON CONFLICT DO NOTHING;

INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'email', '{"sub":"a0000000-0000-4000-8000-000000000001","email":"owner@example.test"}', now(), now(), now()),
  ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'email', '{"sub":"a0000000-0000-4000-8000-000000000002","email":"a0000000-0000-4000-8000-000000000002@staff.invalid"}', now(), now(), now())
ON CONFLICT DO NOTHING;

INSERT INTO wallet_members (user_id, wallet_id, role) VALUES
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000001', 'staff')
ON CONFLICT DO NOTHING;

INSERT INTO staff_credentials (user_id, wallet_id, username, pin_hash) VALUES
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000001', 'anna', '$2a$10$uE1KOFMe7KfUuvdsC9s6mOMH1Ts2eJ/p.o4sE48BrHSKXlnLh2Rpy')
ON CONFLICT DO NOTHING;

INSERT INTO transactions (id, type, amount, date, account_id, from_account_id, category, notes, reason, created_at, updated_at, deleted, created_by) VALUES
  ('00000000-0000-4000-8000-000000000001', 'inflow',   500.00, '2026-01-05', 'bank',            NULL,   'Donation',  'Fake: January donation',      'Donation',  '2026-01-05 10:00:00+00', '2026-01-05 10:00:00+00', false, NULL),
  ('00000000-0000-4000-8000-000000000002', 'inflow',   120.50, '2026-01-12', 'cash',            NULL,   'Event',     'Fake: Bake sale',             'Bake sale', '2026-01-12 15:30:00+00', '2026-01-12 15:30:00+00', false, 'a0000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003', 'outflow',   45.30, '2026-01-15', 'cash',            NULL,   'Supplies',  'Fake: Printer paper',         NULL,        '2026-01-15 09:00:00+00', '2026-01-15 09:00:00+00', false, 'a0000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000004', 'transfer', 200.00, '2026-01-20', 'prudent_reserve', 'bank', 'Reserve',   'Fake: Move to reserve',       NULL,        '2026-01-20 12:00:00+00', '2026-01-20 12:00:00+00', false, NULL),
  ('00000000-0000-4000-8000-000000000005', 'outflow',   80.00, '2026-01-22', 'paypal',          NULL,   'Software',  'Fake: Entered twice, removed', NULL,       '2026-01-22 08:00:00+00', '2026-01-22 18:00:00+00', true, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO audit_log (id, transaction_id, action, timestamp, previous_data, new_data, created_by) VALUES
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'create', '2026-01-05 10:00:00+00', NULL, '{"amount": 500.00, "account_id": "bank"}', NULL),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'create', '2026-01-12 15:30:00+00', NULL, '{"amount": 120.50, "account_id": "cash"}', 'a0000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 'create', '2026-01-15 09:00:00+00', NULL, '{"amount": 45.30, "account_id": "cash"}', 'a0000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004', 'create', '2026-01-20 12:00:00+00', NULL, '{"amount": 200.00, "account_id": "prudent_reserve"}', NULL),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005', 'create', '2026-01-22 08:00:00+00', NULL, '{"amount": 80.00, "account_id": "paypal"}', NULL),
  ('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000005', 'delete', '2026-01-22 18:00:00+00', '{"deleted": false}', '{"deleted": true}', NULL)
ON CONFLICT DO NOTHING;

-- Entries 2 and 3 are by Anna; the rest have no author, like data from before login existed.
