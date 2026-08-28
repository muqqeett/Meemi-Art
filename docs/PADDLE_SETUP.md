# Paddle setup — MeemiArt

MeemiArt sells **digital products only**: one-time purchases of downloadable
files. There are no subscriptions, no shipping, no physical inventory. Every
Paddle object described here is a one-time price; nothing in this integration
creates a billing cycle.

Paddle is the **merchant of record**. It sells to the customer, calculates and
remits sales tax, and owns the chargeback. Two consequences run through the
whole integration:

- The price MeemiArt sets is **pre-tax**. Paddle adds tax at checkout, so the
  customer usually pays more than the listed price. Verification therefore
  compares `subtotal − discount`, never `total`.
- Paddle owns the customer relationship for billing. It issues its own customer
  ids (`ctm_...`), stored on `User.paddleCustomerId` and never used as an
  identity or an authorisation key.

| | Sandbox | Live |
|---|---|---|
| Dashboard | <https://sandbox-vendors.paddle.com> | <https://vendors.paddle.com> |
| API base | `https://sandbox-api.paddle.com` | `https://api.paddle.com` |
| Client token | begins `test_` | no `test_` prefix |

The API base is never written in a call site — it comes from
`PADDLE_ENV` via `src/lib/payments/config.ts`. Anything other than an explicit
`PADDLE_ENV=production` resolves to sandbox, so a missing or misspelt value can
only ever point at test money.

---

## 1. Create a Paddle Sandbox account

1. Sign up at <https://sandbox-vendors.paddle.com>. A sandbox account is
   separate from a live one and needs no business verification.
2. You will land in the sandbox dashboard. Everything below happens there.

## 2. Create the API key

**Paddle → Developer tools → Authentication → API keys → New API key.**

- Name it for the environment, e.g. `meemiart-sandbox-server`.
- Permissions needed: read and write on **products**, **prices**,
  **transactions**, **discounts**; read on **customers** and **adjustments**.
- Copy the key immediately — Paddle shows it once.

This is `PADDLE_API_KEY`. It is **server-only**. It must never be prefixed
`NEXT_PUBLIC_`, never appear in a client component, and never be committed.

## 3. Create the client-side token

**Paddle → Developer tools → Authentication → Client-side tokens → New token.**

Copy the value; a sandbox token begins `test_`.

This is `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`. It **is** intended to be public — it
can open a checkout for a transaction that already exists and nothing else. It
cannot read the API, create a charge, price anything, or verify a webhook.

## 4. Create the webhook destination

**Paddle → Developer tools → Notifications → New destination.**

- **URL**: `https://<your-domain>/api/payments/webhook`
- **Type**: Webhook
- Subscribe to these events, and only these:

  | Event | What MeemiArt does |
  |---|---|
  | `transaction.paid` | Marks the payment PAID, the order COMPLETED, grants `DigitalAccess`, sends the purchase email |
  | `transaction.completed` | Same handler; whichever of the pair arrives first does the work and the other is absorbed as a duplicate |
  | `transaction.payment_failed` | Marks the payment FAILED; the order stays PENDING so it can be retried |
  | `transaction.canceled` | Cancels the payment and the order |
  | `adjustment.created` | An approved refund or chargeback revokes access |
  | `adjustment.updated` | Same handler, for a refund approved after the fact |

  Event order is never assumed. Each delivery is matched to an order
  independently and applied idempotently.

- Save, then open the destination and copy its **secret key**
  (begins `pdl_ntfset_`). This is `PADDLE_WEBHOOK_SECRET`, and it is
  server-only.

### Receiving webhooks in local development

`localhost` is not reachable from Paddle. Expose the dev server first:

```bash
npx untun@latest tunnel http://localhost:3000
```

Use the resulting public URL as the destination URL, and set
`NEXT_PUBLIC_SITE_URL` to the same origin so the success links match.

Paddle's dashboard can replay any delivery — use that rather than re-buying
when debugging the handler.

## 5. Configure the environment

In `.env` (never committed):

```bash
PAYMENT_PROVIDER=paddle
PADDLE_ENV=sandbox
PADDLE_API_KEY=
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
PADDLE_WEBHOOK_SECRET=
PAYMENT_CURRENCY=USD
```

Restart the dev server: these are read once at module load.

Confirm in **Admin → Settings → Payments**. It shows the environment, the API
base, which credentials are present (never their values), whether Paddle
accepted the API key, and how many webhook deliveries have actually arrived.

## 6. Create the catalogue

MeemiArt products are the source of truth. Paddle objects are generated from
them, one product and one one-time price each:

```
MeemiArt Product  →  Paddle product (pro_...)  →  one-time price (pri_...)
```

Sync from **Admin → Settings → Payments → Sync catalogue to Paddle**, or:

```bash
npm run paddle:sync -- --dry   # report what would change, send nothing
npm run paddle:sync            # create and update
```

A product is sellable only when it is active **and** has an uploaded file. The
sync is idempotent: it reuses the ids a product already carries and writes only
what differs.

The price is created with **no `billing_cycle`** — that is what makes it
one-time. A recurring price is refused rather than adopted.

If a MeemiArt price changes, re-run the sync. Until you do, checkout refuses to
sell that product rather than charging an amount the order does not record;
the settings panel shows the drift.

---

## How a purchase actually works

```
Product → Add to Cart → Cart → Checkout
                                  │
                    placeOrder() recomputes every figure from the database
                                  │
                    POST /transactions  (catalogue price ids, server-side)
                                  │
                    read back Paddle's totals and refuse on mismatch
                                  │
                    browser receives ONLY a transaction id
                                  │
                    Paddle.js overlay → customer pays Paddle
                                  │
                    Paddle → POST /api/payments/webhook  (signed)
                                  │
        signature → amount → currency → idempotency → PAID → DigitalAccess
                                  │
                    My Downloads → signed Cloudinary URL (5 min)
```

**Reaching the success URL grants nothing.** The success page only reads
whatever state the webhook has already written. `applyEvent` in
`src/lib/payments/payment-service.ts` is the only code path that can mark an
order paid, and it is only reachable from the webhook route after a signature
check.

Nothing about price travels through the browser. The checkout is created
server-side from catalogue price ids, and the browser is handed a reference to
a charge that is already priced.

---

## Testing

### Offline — run these now, no credentials needed

```bash
npm run test:paddle      # signature, event parsing, amounts, refunds
npm run test:payments    # applyEvent against the database, end to end
```

`test:paddle` covers the cases a real Paddle account will never send you, which
are the ones that matter most: a forged signature, a body edited after signing,
a replayed old delivery, a refund that carries no order id, a refund still
awaiting approval.

### Sandbox test cards

Paddle's sandbox accepts:

| Outcome | Card |
|---|---|
| Success | `4242 4242 4242 4242` |
| Declined | `4000 0000 0000 0002` |

Any future expiry, any CVC, any postcode.

### End-to-end checklist

1. Product page loads, "Add To Cart" works.
2. Cart shows the right total.
3. Checkout opens the **Paddle overlay** (not a redirect) and the page shows
   the sandbox banner.
4. Pay with the success card.
5. Webhook arrives — check **Admin → Settings → Payments → Webhook deliveries**.
6. Order becomes COMPLETED and the payment PAID.
7. `DigitalAccess` exists; the file appears under **My Downloads**.
8. The download redirects to a Cloudinary URL that expires in 5 minutes.
9. Sign in as a different customer — the same download 404s.
10. Replay the delivery from Paddle's dashboard — no second grant, no second
    email.
11. Refund the transaction in Paddle — access is revoked and the download 404s.

---

## Security model

| Check | Where |
|---|---|
| Webhook signature (HMAC-SHA256 over `ts:body`) | `providers/paddle.ts` |
| Replay window (5 minutes) | `providers/paddle.ts` |
| Raw body used for verification, never re-serialised | `api/payments/webhook/route.ts` |
| Source IP allowlist (defence in depth, fails open) | `payments/ip-allowlist.ts` |
| Amount compared against the stored order | `payment-service.ts` |
| Currency compared against the stored order | `payment-service.ts` |
| Idempotency (`PaymentEvent(provider, eventId)` unique) | `payment-service.ts` |
| `paid`/`completed` pair collapsed to one grant | `payment-service.ts` |
| One access row per order line (`orderItemId` unique) | `schema.prisma` |
| Download authorised by session user + paid order + unrevoked access | `api/download/[productId]/route.ts` |
| Files private in Cloudinary, 5-minute signed URLs | `storage/digital.ts` |

Secrets that must never reach the browser: `PADDLE_API_KEY`,
`PADDLE_WEBHOOK_SECRET`, `CLOUDINARY_API_SECRET`, `DATABASE_URL`, `AUTH_SECRET`.
`scripts/check-bundle-secrets.ts` asserts this against the built client chunks.

There is **no "mark as paid"** control in the admin dashboard, by design.
Payment state comes from verified Paddle events and nothing else.

---

## Going live

Do not switch until every box above is ticked in sandbox.

1. Sandbox verified end to end.
2. Create the **live** Paddle account and complete Paddle's business
   verification (they review the website itself).
3. Approve the MeemiArt domain: **Paddle → Checkout → Website approval**.
4. Create the **live** catalogue — sandbox products do not carry over. Run
   `npm run paddle:sync` against live credentials.
5. Create a **live** API key.
6. Create a **live** client-side token.
7. Create a **live** webhook destination at the production URL.
8. Copy the **live** webhook secret.
9. Set production environment variables, including `PADDLE_ENV=production`.
10. Verify on staging against production credentials.
11. Make one real low-value purchase and refund it.
12. Go live.

Paddle's verification reviews the public site. Before applying, make sure there
are working pages for pricing, refunds, terms and contact, and that the footer
links to them — Paddle checks these and rejects sites where they 404.

### What changes between sandbox and live

Only environment variables. No code changes:

```bash
PAYMENT_PROVIDER=paddle                  # ← easiest one to forget: see below
PADDLE_ENV=production                    # switches the API base to api.paddle.com
PADDLE_API_KEY=<live key>                # server-only, never NEXT_PUBLIC
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=live_…   # must start live_
PADDLE_WEBHOOK_SECRET=<live destination secret>
PAYMENT_CURRENCY=USD
NEXT_PUBLIC_SITE_URL=https://meemiart.com
```

**`PAYMENT_PROVIDER=paddle` is not optional.** It selects the driver. Without
it the application keeps using its built-in local sandbox driver and no money
moves, no matter how correct the four Paddle values are — the app would look
configured and quietly take orders nobody is charged for. Admin → Settings →
Payments calls this out explicitly if `PADDLE_ENV` says production while the
driver does not.

Set these on the production host only. Never in a local `.env`, and never
committed — `.gitignore` already excludes `.env*`.

### Guards that make a bad cutover fail loudly

- **Environment mismatch.** Paddle prefixes client tokens by environment
  (`test_` / `live_`), and Paddle.js takes its environment from that prefix. A
  live server paired with a `test_` token would create live transactions the
  overlay could never find. The server compares the two and refuses checkout
  outright rather than showing a broken payment page.
- **Missing client token.** Checkout refuses instead of taking an order whose
  overlay cannot open.
- **Malformed `PADDLE_ENV`.** Anything other than exactly `production` resolves
  to sandbox, so a typo can never point at live money.

Verify all of it without credentials and without a payment:

```bash
npm run test:paddle-env
```

It loads the real config module in child processes under each combination and
asserts, among other things, that `PADDLE_ENV=production` reaches
`https://api.paddle.com` and never the sandbox host.

The sandbox banner disappears on its own once the provider is no longer in test
mode — its absence is the signal that money is real.
