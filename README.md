# TraffLabels

Traffolyte labels marketing site for Perth / WA. Brand: TraffLabels, under the Stik Stickers group.

## Stack

Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui. `lang="en-AU"`. Payments via Stripe Checkout (AUD).

## Local

```bash
npm install
npm run dev
npm test
npm run build
```

## Environment

Set these on Vercel (preview first; do not promote until pricing and test keys are confirmed):

| Variable | Required | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | For checkout | Server-only. Without it, `POST /api/checkout` returns 503 JSON (`Checkout unavailable…`) and the build still succeeds. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional today | Not required for redirect Checkout Sessions; keep for future Elements / client SDK use. |
| `STRIPE_WEBHOOK_SECRET` | Paid orders | Signing secret for `POST /api/webhooks/stripe` (`checkout.session.completed` and `checkout.session.async_payment_succeeded`). Without it, a paid session is stored only when the shopper lands on the success page. |
| `NEXT_PUBLIC_SITE_URL` | Optional | Only a fallback for Checkout return URLs. Pay now sends the browser origin, and cancel/success stay on that host so the localStorage draft survives. Unset, the fallback is `https://www.trafflabels.com.au` — not `VERCEL_URL`. |
| `RESEND_API_KEY` | Contact form | Existing Resend send. |
| `RESEND_FROM` | Contact form | Verified from-address. |
| `CONTACT_TO` | Contact form | Comma-separated inbox; falls back to `info@stikstickers.com`. |
| `DATABASE_URL` or `POSTGRES_URL` | Paid orders | Postgres connection string (Vercel Postgres / Neon / Supabase). Required in production before Pay now will open Stripe. The app creates `trafflabels_orders` and `trafflabels_checkout_drafts` on first use (`db/schema.sql`). Use the pooled URL and keep this server-only. |
| `ORDERS_DASHBOARD_PASSWORD` | Production board | Shared password for Mike and Leanne at `/admin/orders/`. Long random value. Rotating it signs everyone out. |

Do not put live Stripe keys in git. Test mode uses `sk_test_…`, `pk_test_…`, and a test webhook secret. Preview and production on Vercel stay unpaid until `DATABASE_URL` and `STRIPE_SECRET_KEY` are both set. This change does not update DNS or live Stripe settings.

### Local Stripe webhook

The success page also stores a paid session, so a test payment still lands in the dashboard if the webhook is not forwarded. The webhook is the reliable path when the shopper closes the tab.

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe/
```

Put the CLI signing secret in `STRIPE_WEBHOOK_SECRET`. In the Stripe Dashboard (test mode), the endpoint is `https://<your-host>/api/webhooks/stripe/` and the events are `checkout.session.completed` and `checkout.session.async_payment_succeeded`.

Local `npm run dev` stores orders in `.data/trafflabels-orders.json` when `DATABASE_URL` is unset. That file is gitignored and is not used on Vercel (`NODE_ENV=production` without a database URL refuses checkout).

### Orders dashboard

Leanne signs in at `/admin/orders/` with `ORDERS_DASHBOARD_PASSWORD`. The board lists orders (status starts at **NEW**) and can set **CUT**, **READY TO SHIP**, or **SHIPPED**, plus a note and a tracking URL. Each row is marked **Stripe** or **Manual**. Download builds the LightBurn file from the saved plate geometry.

**Import CSV** creates a trade / offline order with no Stripe charge. The plate file uses the same columns as the public list upload: `colour,width,height,text,qty` (millimetres). `width_mm` and `height_mm` are accepted too. Customer name, phone, email, postage, and Standard or Express shipping are entered on the form. A bad row is listed with its line number and the order is not created until every row is valid. The new order is **NEW** and **Manual**, and uses the same SVG/ZIP download.

### LightBurn SVG

Download is one SVG when the order is a single plate, or a ZIP with one SVG per physical plate (qty is duplicated, each file is the ordered width × height).

- User units are millimetres (`width="60mm"`, `viewBox="0 0 60 20"`).
- If LightBurn asks for SVG DPI, use **96** (the same setting Silhouette used).
- **Black fill** (`#000000`) is engrave (legend text).
- **Red stroke** (`#FF0000`) is the outer cut line.
- Laminate colour is a comment in the file and a column on the order, not a laser colour.
- Text is Arial/Helvetica so the laser PC can resolve a font. Confirm the legend before cutting.

## MVP routes

- `/` — trade + personalise
- `/traffolyte-labels-perth/`
- `/what-is-traffolyte/`
- `/switchboard-labels/`
- `/traffolyte-labels/malaga/`
- `/traffolyte-labels/wangara/`
- `/traffolyte-labels/welshpool/`
- `/order/` — Design online / Upload a list / Email us
- `/order/?mode=designer` — TraffLabels canvas designer
- `/order/?mode=upload` — CSV schedule upload (`colour,width,height,text,qty` in mm)
- `/order/?mode=checkout` — order summary + Pay now (Stripe Checkout)
- `/order/success/` — post-payment thank-you (`session_id` query)
- `/admin/orders/` — private production board (not linked in the public nav)
- `/contact/` — job enquiry (optional file attach)
