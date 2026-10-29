-- TraffLabels trade account applications.
-- Apply by hand on the Supabase project. Do not rely on app boot to create
-- this table: a preview server that shares the production database connection
-- would otherwise migrate production on the first request.
--
-- Access is server-side through DATABASE_URL (the table owner, which bypasses
-- RLS). anon and authenticated get no privileges and no policies, so the Data
-- API cannot read an application. service_role is granted ALL because
-- Supabase stops auto-granting table privileges on 30 October 2026. ALL for
-- service_role includes TRUNCATE, REFERENCES, and TRIGGER; those are not
-- granted to anon or authenticated. anon and authenticated are not granted
-- SELECT, INSERT, UPDATE, or DELETE either.
--
-- No sequence is created. Application ids are generated in the application.

CREATE TABLE IF NOT EXISTS public.trafflabels_account_applications (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'approved', 'declined')),
  registered_company_name text NOT NULL,
  acn text NOT NULL DEFAULT '',
  trading_name text NOT NULL DEFAULT '',
  abn text NOT NULL,
  billing_address text NOT NULL,
  delivery_address text NOT NULL DEFAULT '',
  main_phone text NOT NULL,
  website text NOT NULL DEFAULT '',
  ap_name text NOT NULL,
  ap_email text NOT NULL,
  ap_phone text NOT NULL DEFAULT '',
  purchasing_name text NOT NULL DEFAULT '',
  purchasing_email text NOT NULL DEFAULT '',
  purchasing_phone text NOT NULL DEFAULT '',
  po_required boolean NOT NULL,
  authorisation_statement text NOT NULL,
  authorised_name text NOT NULL,
  position text NOT NULL,
  authorised_at timestamptz NOT NULL,
  authorised_ip text NOT NULL DEFAULT '',
  authorised_user_agent text NOT NULL DEFAULT '',
  linked_order_id text REFERENCES public.trafflabels_orders (id) ON DELETE SET NULL,
  linked_order_number integer,
  decided_at timestamptz,
  decided_by text NOT NULL DEFAULT ''
);

COMMENT ON TABLE public.trafflabels_account_applications IS
  'TraffLabels trade account applications. Written by the app with the database owner role.';

CREATE INDEX IF NOT EXISTS trafflabels_account_applications_created_idx
  ON public.trafflabels_account_applications (created_at DESC);

ALTER TABLE public.trafflabels_account_applications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.trafflabels_account_applications FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    BEGIN
      EXECUTE 'REVOKE ALL ON TABLE public.trafflabels_account_applications FROM anon';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'could not revoke anon on trafflabels_account_applications';
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    BEGIN
      EXECUTE 'REVOKE ALL ON TABLE public.trafflabels_account_applications FROM authenticated';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'could not revoke authenticated on trafflabels_account_applications';
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    BEGIN
      EXECUTE 'GRANT ALL ON TABLE public.trafflabels_account_applications TO service_role';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'could not grant service_role on trafflabels_account_applications';
    END;
  END IF;
END $$;
