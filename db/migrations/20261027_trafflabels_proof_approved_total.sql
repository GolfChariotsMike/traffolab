-- GST-inclusive total (cents) recorded when a customer approves a proof.
-- Nullable so proofs already sent stay pending and are not superseded.
-- Apply by hand after 20261027_trafflabels_proofs.sql. The app does not run
-- this on boot.
--
-- Table privileges are unchanged: anon and authenticated keep no grants,
-- service_role keeps ALL (including TRUNCATE, REFERENCES, and TRIGGER).
-- Those three are not granted to anon or authenticated. No new sequence.

ALTER TABLE public.trafflabels_proofs
  ADD COLUMN IF NOT EXISTS approved_total_cents integer;

COMMENT ON COLUMN public.trafflabels_proofs.approved_total_cents IS
  'GST-inclusive total in cents agreed at approval. NULL until the customer approves.';

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
