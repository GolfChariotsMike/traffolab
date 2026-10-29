-- Order-level shared engraving size. Apply by hand. The app does not run
-- this on boot, so a preview that shares the production database will not
-- migrate production.
--
-- The setting also lives on each plate in the plates jsonb (uniformTextSize).
-- This column mirrors it for queries. Existing orders stay false.
--
-- RLS stays enabled. No new grants to anon or authenticated. service_role
-- keeps ALL. TRUNCATE, REFERENCES, and TRIGGER are revoked from anon and
-- authenticated. No new sequence. No new table.

ALTER TABLE public.trafflabels_orders
  ADD COLUMN IF NOT EXISTS uniform_text_size boolean NOT NULL DEFAULT false;

ALTER TABLE public.trafflabels_orders
  ADD COLUMN IF NOT EXISTS uniform_text_mm double precision;

COMMENT ON COLUMN public.trafflabels_orders.uniform_text_size IS
  'When true, plates of the same dimensions share one text size. Ignored when uniform_text_mm is set.';

COMMENT ON COLUMN public.trafflabels_orders.uniform_text_mm IS
  'When set, every plate in the order uses this em size in millimetres.';

ALTER TABLE public.trafflabels_orders ENABLE ROW LEVEL SECURITY;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.trafflabels_orders FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    BEGIN
      EXECUTE 'REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.trafflabels_orders FROM anon';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'could not revoke limited privileges from anon on trafflabels_orders';
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    BEGIN
      EXECUTE 'REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.trafflabels_orders FROM authenticated';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'could not revoke limited privileges from authenticated on trafflabels_orders';
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
