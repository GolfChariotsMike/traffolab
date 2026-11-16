-- Stripe tax invoice raised when a customer approves a proof.
-- Apply by hand on the Supabase project (qbdpcwcpltsznqnrrkny). Do not rely
-- on app boot to add these columns: a preview that shares the production
-- database would otherwise migrate production.
--
-- Access stays server-side through DATABASE_URL (the table owner, which
-- bypasses RLS). anon and authenticated get no privileges and no policies,
-- so the Data API cannot read an invoice id or a customer email. service_role
-- is granted ALL explicitly because Supabase stopped auto-granting table
-- privileges on 30 October 2026. ALL for service_role includes TRUNCATE,
-- REFERENCES, and TRIGGER; those are not granted to anon or authenticated.
--
-- No sequence is created. Invoice ids come from Stripe.

ALTER TABLE public.trafflabels_orders
  ADD COLUMN IF NOT EXISTS stripe_invoice_id text,
  ADD COLUMN IF NOT EXISTS stripe_invoice_number text,
  ADD COLUMN IF NOT EXISTS stripe_invoice_url text,
  ADD COLUMN IF NOT EXISTS stripe_invoice_pdf_url text,
  ADD COLUMN IF NOT EXISTS stripe_invoice_status text,
  ADD COLUMN IF NOT EXISTS stripe_invoice_error text,
  ADD COLUMN IF NOT EXISTS stripe_invoice_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_cc_emails text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.trafflabels_orders.stripe_invoice_id IS
  'Stripe invoice id for the tax invoice sent when the proof was approved. Null until then.';

COMMENT ON COLUMN public.trafflabels_orders.stripe_invoice_status IS
  'Stripe invoice status, or payment_failed after invoice.payment_failed.';

COMMENT ON COLUMN public.trafflabels_orders.invoice_cc_emails IS
  'Comma-separated extra recipients. Stripe emails the customer; Resend copies these addresses.';

CREATE UNIQUE INDEX IF NOT EXISTS trafflabels_orders_stripe_invoice_id_uidx
  ON public.trafflabels_orders (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL AND stripe_invoice_id <> '';

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
