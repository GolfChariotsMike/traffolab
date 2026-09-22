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
| `STRIPE_WEBHOOK_SECRET` | For webhooks | Used by `POST /api/webhooks/stripe` to verify `checkout.session.completed`. |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Absolute site origin for Checkout `success_url` / `cancel_url`. Falls back to `https://$VERCEL_URL` on Vercel, then `http://localhost:3000`. |
| `RESEND_API_KEY` | Contact form | Existing Resend send. |
| `RESEND_FROM` | Contact form | Verified from-address. |
| `CONTACT_TO` | Contact form | Comma-separated inbox; falls back to `info@stikstickers.com`. |

Webhook endpoint to register in the Stripe Dashboard: `/api/webhooks/stripe` (event: `checkout.session.completed`).

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
- `/contact/` — job enquiry (optional file attach)
