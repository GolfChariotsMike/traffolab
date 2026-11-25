-- Hand-made LightBurn files for one order (logos, special fonts, coloured plates).
-- Apply by hand on the Supabase project (qbdpcwcpltsznqnrrkny). Do not rely
-- on app boot to add this column: a preview that shares the production
-- database would otherwise migrate production.
--
-- Null means the order uses the auto-generated Arial zip. A non-null value
-- is a jsonb array of {path, filename, uploaded_at, note}. path is an object
-- key in the private Storage bucket trafflabels-cut-files, under
-- orders/<order number>/<filename>. The app never stores a public URL.
--
-- Access stays server-side through DATABASE_URL (the table owner, which
-- bypasses RLS). The admin board does not query this table with the
-- authenticated role, so authenticated is not granted. anon is not granted.
-- service_role is granted ALL explicitly because Supabase stopped
-- auto-granting table privileges on 30 October 2026. ALL for service_role
-- includes TRUNCATE, REFERENCES, and TRIGGER; those are not granted to anon
-- or authenticated.
--
-- No sequence is created. No new table. No storage policy. The one-off row
-- for a specific order is not in this file.

ALTER TABLE public.trafflabels_orders
  ADD COLUMN IF NOT EXISTS custom_cut_files jsonb;

COMMENT ON COLUMN public.trafflabels_orders.custom_cut_files IS
  'Nullable array of hand-made cut files in the private trafflabels-cut-files bucket. Null uses the auto-generated Arial zip. Each element is {path, filename, uploaded_at, note}.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trafflabels_orders_custom_cut_files_check'
      AND conrelid = 'public.trafflabels_orders'::regclass
  ) THEN
    ALTER TABLE public.trafflabels_orders
      ADD CONSTRAINT trafflabels_orders_custom_cut_files_check
      CHECK (
        custom_cut_files IS NULL
        OR (
          jsonb_typeof(custom_cut_files) = 'array'
          AND jsonb_array_length(custom_cut_files) <= 8
        )
      );
  END IF;
END $$;

ALTER TABLE public.trafflabels_orders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.trafflabels_orders FROM PUBLIC;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.trafflabels_orders FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    BEGIN
      EXECUTE 'REVOKE ALL ON TABLE public.trafflabels_orders FROM anon';
      EXECUTE 'REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.trafflabels_orders FROM anon';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'could not revoke anon on trafflabels_orders';
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    BEGIN
      EXECUTE 'REVOKE ALL ON TABLE public.trafflabels_orders FROM authenticated';
      EXECUTE 'REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.trafflabels_orders FROM authenticated';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'could not revoke authenticated on trafflabels_orders';
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    BEGIN
      EXECUTE 'GRANT ALL ON TABLE public.trafflabels_orders TO service_role';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'could not grant service_role on trafflabels_orders';
    END;
  END IF;
END $$;
