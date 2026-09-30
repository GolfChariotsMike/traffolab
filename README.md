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
| `RESEND_API_KEY` | Contact form and orders sign-in | Existing Resend send. Production magic links are not delivered without it. |
| `RESEND_FROM` | Contact form and orders sign-in | Verified from-address. |
| `CONTACT_TO` | Contact form | Comma-separated inbox; falls back to `info@stikstickers.com`. |
| `DATABASE_URL` or `POSTGRES_URL` | Paid orders | Postgres connection string (Vercel Postgres / Neon / Supabase). Required in production before Pay now will open Stripe. The app creates `trafflabels_orders` and `trafflabels_checkout_drafts` on first use (`db/schema.sql`). The first magic-link sign-in also creates `trafflabels_login_tokens` so each link works once. Use the pooled URL and keep this server-only. |
| `ORDERS_AUTH_SECRET` | Production board | Long random secret that signs magic links and the session cookie. Required in production. Rotating it signs everyone out. |
| `ORDERS_ADMIN_EMAILS` | Production board | Comma-separated allowlist, compared case-insensitively. Unset, the list is `info@stikstickers.com`. Set it to replace that list. An empty value allows nobody. |

Do not put live Stripe keys in git. Test mode uses `sk_test_…`, `pk_test_…`, and a test webhook secret. Preview and production on Vercel stay unpaid until `DATABASE_URL` and `STRIPE_SECRET_KEY` are both set. This change does not update DNS or live Stripe settings.

### Local Stripe webhook

The success page also stores a paid session, so a test payment still lands in the dashboard if the webhook is not forwarded. The webhook is the reliable path when the shopper closes the tab.

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe/
```

Put the CLI signing secret in `STRIPE_WEBHOOK_SECRET`. In the Stripe Dashboard (test mode), the endpoint is `https://<your-host>/api/webhooks/stripe/` and the events are `checkout.session.completed` and `checkout.session.async_payment_succeeded`.

Local `npm run dev` stores orders in `.data/trafflabels-orders.json` when `DATABASE_URL` is unset. That file is gitignored and is not used on Vercel (`NODE_ENV=production` without a database URL refuses checkout).

### Orders dashboard

Mike and Leanne sign in at `/admin/orders/` with an email magic link. Only addresses in `ORDERS_ADMIN_EMAILS` can request or finish sign-in (the starting address is `info@stikstickers.com`). The form always says a link was sent when the address looks valid, so the page does not reveal who is on the list. The link expires in 20 minutes, works once, and in production opens `https://www.trafflabels.com.au`. Local `npm run dev` shows the link on the page instead of emailing. A shared password is not accepted. The board lists orders (status starts at **NEW**) and can set **CUT**, **READY TO SHIP**, or **SHIPPED**, plus a note and a tracking URL. Each row is marked **Stripe** or **Manual**. Download builds a ZIP of nested 300 × 200 mm LightBurn sheets from the saved plate geometry. Sign out clears the session cookie.

**Import CSV** creates a trade / offline order with no Stripe charge. The plate file uses the same columns as the public list upload: `colour,width,height,text,qty` (millimetres). `width_mm` and `height_mm` are accepted too. Customer name, phone, email, postage, and Standard or Express shipping are entered on the form. A bad row is listed with its line number and the order is not created until every row is valid. The new order is **NEW** and **Manual**, and uses the same nested-sheet ZIP download.

### LightBurn download

Download is a ZIP. Cut from the nested sheet SVGs in `sheets/`. Plates of the same laminate colour and adhesive are packed onto **300 × 200 mm** sheets. A plate is rotated 90° when that uses fewer sheets, or when that is the only way it fits; the legend rotates with the plate. Where two plates meet, the shared edge is one red cut. `nest-summary.txt` lists each sheet. `pieces/` has one SVG per physical plate for edits.

- User units are millimetres. A material sheet is `width="300mm"` and `viewBox="0 0 300 200"`.
- If LightBurn asks for SVG DPI, use **96** (the same setting Silhouette used).
- **Black fill** (`#000000`) is engrave (Arial Regular, weight 400).
- **Red stroke** (`#FF0000`) is the cut. Shared edges are not drawn twice.
- Laminate colour is a comment in the file and a column on the order, not a laser colour.
- Confirm the legend before cutting. Rotated plates read correctly relative to the plate, not necessarily upright on the sheet.

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
