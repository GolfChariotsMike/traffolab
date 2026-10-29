-- First open time and the one automatic proof reminder.
-- Apply by hand after the earlier trafflabels_proofs migrations.
-- The app does not run this on boot.
--
-- Proofs that already exist (including order #1003) were followed up by hand.
-- auto_reminder is set false for those rows so the cron never emails them.
-- Rows inserted after this migration default to true.
--
-- Table privileges stay as they are: anon and authenticated have no grants,
-- service_role keeps ALL. TRUNCATE, REFERENCES, and TRIGGER are not granted
-- to anon or authenticated. No new sequence. No new table.

ALTER TABLE public.trafflabels_proofs
  ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz;

ALTER TABLE public.trafflabels_proofs
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

ALTER TABLE public.trafflabels_proofs
  ADD COLUMN IF NOT EXISTS auto_reminder boolean;

UPDATE public.trafflabels_proofs
SET auto_reminder = false
WHERE auto_reminder IS NULL;

ALTER TABLE public.trafflabels_proofs
  ALTER COLUMN auto_reminder SET DEFAULT true;

ALTER TABLE public.trafflabels_proofs
  ALTER COLUMN auto_reminder SET NOT NULL;

COMMENT ON COLUMN public.trafflabels_proofs.first_viewed_at IS
  'First time the customer opened the proof page. NULL if they have not.';

COMMENT ON COLUMN public.trafflabels_proofs.reminder_sent_at IS
  'When the single automatic reminder was committed. NULL until then.';

COMMENT ON COLUMN public.trafflabels_proofs.auto_reminder IS
  'False for proofs that existed before reminders launched.';

CREATE INDEX IF NOT EXISTS trafflabels_proofs_reminder_due_idx
  ON public.trafflabels_proofs (created_at)
  WHERE status = 'pending' AND reminder_sent_at IS NULL AND auto_reminder;

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
