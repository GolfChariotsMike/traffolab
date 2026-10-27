-- TraffLabels customer proofs.
-- Apply by hand on the Supabase project. Do not rely on app boot to create
-- this table: a preview server that shares the production database connection
-- would otherwise migrate production on the first request.
--
-- Access is server-side through DATABASE_URL (the table owner, which bypasses
-- RLS). anon and authenticated get no privileges and no policies, so the Data
-- API cannot read a proof. service_role is granted ALL because Supabase stops
-- auto-granting table privileges on 30 October 2026. ALL for service_role
-- includes TRUNCATE, REFERENCES, and TRIGGER; those are not granted to anon
-- or authenticated.
--
-- No sequence is created. Proof ids are generated in the application.

CREATE TABLE IF NOT EXISTS public.trafflabels_proofs (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES public.trafflabels_orders (id) ON DELETE CASCADE,
  order_number integer NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'changes_requested', 'superseded')),
  plates_snapshot jsonb NOT NULL,
  plates_hash text NOT NULL,
  customer_name text NOT NULL DEFAULT '',
  shipping jsonb NOT NULL,
  invoice_url text NOT NULL DEFAULT '',
  approved_name text NOT NULL DEFAULT '',
  approved_at timestamptz,
  approved_ip text NOT NULL DEFAULT '',
  approved_user_agent text NOT NULL DEFAULT '',
  approval_statement text NOT NULL DEFAULT '',
  change_comment text NOT NULL DEFAULT '',
  change_requested_at timestamptz,
  change_ip text NOT NULL DEFAULT '',
  change_user_agent text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS trafflabels_proofs_order_created_idx
  ON public.trafflabels_proofs (order_id, created_at DESC);

ALTER TABLE public.trafflabels_proofs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.trafflabels_proofs FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    BEGIN
      EXECUTE 'REVOKE ALL ON TABLE public.trafflabels_proofs FROM anon';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'could not revoke anon on trafflabels_proofs';
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    BEGIN
      EXECUTE 'REVOKE ALL ON TABLE public.trafflabels_proofs FROM authenticated';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'could not revoke authenticated on trafflabels_proofs';
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    BEGIN
      EXECUTE 'GRANT ALL ON TABLE public.trafflabels_proofs TO service_role';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'could not grant service_role on trafflabels_proofs';
    END;
  END IF;
END $$;
