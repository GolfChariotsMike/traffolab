/** Keep in sync with db/schema.sql (asserted by lib/order-store-file.test.ts). */
export const ORDER_SCHEMA_SQL = `-- TraffLabels orders. Applied automatically on first Postgres connection.
-- Safe to run by hand against Vercel Postgres, Neon, or Supabase.
-- Tables are prefixed so a shared database does not collide with other apps.

CREATE TABLE IF NOT EXISTS trafflabels_checkout_drafts (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  stripe_session_id text
);

CREATE SEQUENCE IF NOT EXISTS trafflabels_order_number_seq START WITH 1001;

CREATE TABLE IF NOT EXISTS trafflabels_orders (
  id text PRIMARY KEY,
  order_number integer NOT NULL DEFAULT nextval('trafflabels_order_number_seq') UNIQUE,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('NEW', 'CUT', 'READY TO SHIP', 'SHIPPED')),
  customer_name text NOT NULL DEFAULT '',
  customer_email text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  shipping_name text NOT NULL DEFAULT '',
  shipping_line1 text NOT NULL DEFAULT '',
  shipping_line2 text NOT NULL DEFAULT '',
  shipping_city text NOT NULL DEFAULT '',
  shipping_state text NOT NULL DEFAULT '',
  shipping_postal_code text NOT NULL DEFAULT '',
  shipping_country text NOT NULL DEFAULT '',
  shipping_method text NOT NULL CHECK (shipping_method IN ('standard', 'express')),
  subtotal_cents integer NOT NULL,
  shipping_cents integer NOT NULL,
  total_cents integer NOT NULL,
  stripe_session_id text NOT NULL UNIQUE,
  stripe_payment_intent_id text,
  stripe_receipt_url text,
  stripe_livemode boolean NOT NULL DEFAULT false,
  note text NOT NULL DEFAULT '',
  tracking_link text NOT NULL DEFAULT '',
  plates jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS trafflabels_orders_created_at_idx
  ON trafflabels_orders (created_at DESC);
`;
