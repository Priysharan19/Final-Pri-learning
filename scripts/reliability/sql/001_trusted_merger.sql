-- Apply ONLY to an isolated, owner-approved control-plane Postgres database.
-- This migration is intentionally NOT run against Pri Learning production.
-- The database user granted this schema must not be the ordinary app or PR CI.
BEGIN;
CREATE SCHEMA IF NOT EXISTS pri_governor;
CREATE TABLE IF NOT EXISTS pri_governor.control (
  id integer PRIMARY KEY CHECK (id=1),
  emergency_shutdown boolean NOT NULL DEFAULT false,
  version bigint NOT NULL DEFAULT 1
);
INSERT INTO pri_governor.control(id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS pri_governor.merge_receipts (
  idempotency_key text PRIMARY KEY CHECK (length(idempotency_key) BETWEEN 16 AND 128),
  operation text NOT NULL CHECK (operation IN ('MERGE','REVOKE')),
  state text NOT NULL CHECK (state IN ('PREPARED','COMPLETED','DENIED')),
  request_json jsonb NOT NULL,
  proof_json jsonb,
  result_json jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pri_governor.webhook_deliveries (
  delivery_id uuid PRIMARY KEY,
  repository text NOT NULL CHECK (repository='Priysharan19/Final-Pri-learning'),
  pr_number integer NOT NULL CHECK (pr_number>0),
  head_sha char(40) NOT NULL,
  sender_type text NOT NULL CHECK (sender_type='User'),
  sender_login text NOT NULL,
  event_name text NOT NULL CHECK (event_name='pull_request'),
  trusted_signature boolean NOT NULL CHECK (trusted_signature=true),
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pri_governor.emergency_queue (
  idempotency_key text PRIMARY KEY,
  repository text NOT NULL CHECK (repository='Priysharan19/Final-Pri-learning'),
  pr_number integer NOT NULL CHECK (pr_number>0),
  state text NOT NULL CHECK (state IN ('PENDING','ACKED')) DEFAULT 'PENDING',
  queued_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz
);
CREATE INDEX IF NOT EXISTS pending_emergency_lookup ON pri_governor.emergency_queue(pr_number)
  WHERE state='PENDING';
CREATE TABLE IF NOT EXISTS pri_governor.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_kind text NOT NULL,
  payload_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
