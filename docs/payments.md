# Payments & Subscriptions

Editions supports optional paid access via Stripe. When enabled, users get a free trial period after registration, then must subscribe to continue using compute-intensive features.

## Core Concept: Access Gating

Access is controlled by a single field: `users.access_expires_at` (nullable ISO 8601 timestamp).

- **`null`** → unlimited access (default when payment is disabled, or admin-granted)
- **Future date** → active access
- **Past date** → expired — user can still read existing data but cannot perform compute operations

### What "expired" means

Expired users **can**:
- Log in, view their feed, editions, bookmarks, articles
- Read existing content

Expired users **cannot**:
- Create/edit/delete sources, focuses, or edition configs
- Trigger fetches, re-extraction, or re-analysis
- Generate new editions
- Any operation that consumes server compute

This is enforced by the `createAccessHook` middleware applied to write/compute routes. It returns `402 Payment Required` when access is expired.

## Configuration

### Stripe keys (config file / env vars)

Stripe API keys go in the config file or environment variables. They are **never** stored in the database.

```json
{
  "stripe": {
    "secretKey": "sk_...",
    "webhookSecret": "whsec_...",
    "publishableKey": "pk_..."
  }
}
```

Env vars: `EDITIONS_STRIPE_SECRET_KEY`, `EDITIONS_STRIPE_WEBHOOK_SECRET`, `EDITIONS_STRIPE_PUBLISHABLE_KEY`.

Payment features are **disabled** unless a valid `secretKey` is configured.

### Pricing & trial (database / admin UI)

Pricing and trial configuration are stored in the `settings` table (key `"payment"`) and managed via the admin UI under **Settings → Access**.

| Field | Description |
|-------|-------------|
| `trialDays` | Free trial period for new registrations (0 = no trial) |
| `monthlyPriceCents` | Monthly subscription price in cents (0 = not offered) |
| `yearlyPriceCents` | Yearly subscription price in cents (0 = not offered) |
| `monthlyStripePriceId` | Active Stripe Price ID for monthly plan |
| `yearlyStripePriceId` | Active Stripe Price ID for yearly plan |
| `stripeProductId` | Stripe Product ID for the Editions subscription |

When the admin updates pricing, the backend creates a new Stripe Price (prices are immutable in Stripe) and deactivates the old one. **Existing subscriptions remain on their old pricing** — Stripe does not retroactively change them. To move a user to new pricing, the admin must cancel their subscription; the user then resubscribes at the new price.

## Subscription Lifecycle

### Registration
1. User registers normally
2. If payment is enabled and `trialDays > 0`, `access_expires_at` is set to `now + trialDays`
3. If payment is disabled, `access_expires_at` stays `null` (unlimited)

### Checkout
1. User clicks "Subscribe" in Settings → Subscription
2. Backend creates a Stripe Checkout Session with the chosen price (monthly/yearly)
3. User is redirected to Stripe's hosted checkout page
4. On success, Stripe sends a `checkout.session.completed` webhook
5. Backend creates a subscription record and sets `access_expires_at` to the period end

### Recurring billing
- `invoice.paid` webhook → extends `access_expires_at` to new period end
- `invoice.payment_failed` → subscription marked `past_due`, access unchanged (grace via current period)
- Access naturally expires at period end if payment doesn't succeed

### Cancellation
- User cancels via Stripe Customer Portal (linked from Settings → Subscription)
- `customer.subscription.updated` webhook → `cancel_at_period_end = true`
- Access continues until `current_period_end`, then expires naturally
- `customer.subscription.deleted` webhook → subscription marked `cancelled`

### Price changes
- Admin changes pricing in Settings → Access
- New Stripe Price created, old one archived
- Existing subscribers keep their old pricing (Stripe behavior)
- To force a user to new pricing: admin cancels their subscription → user resubscribes at new rate

## Data Model

### Users table additions
- `access_expires_at` — `text` (nullable ISO 8601). `null` = unlimited access
- `stripe_customer_id` — `text` (nullable). Stripe customer ID, created on first checkout

### Subscriptions table
One row per user (upserted on subscription changes).

| Column | Type | Description |
|--------|------|-------------|
| `id` | text PK | UUID |
| `user_id` | text FK | References `users.id`, unique |
| `stripe_subscription_id` | text | Stripe subscription ID |
| `stripe_price_id` | text | Stripe price ID |
| `status` | text | `active`, `past_due`, `cancelled`, `unpaid` |
| `interval` | text | `monthly` or `yearly` |
| `current_period_start` | text | ISO 8601 |
| `current_period_end` | text | ISO 8601 |
| `cancel_at_period_end` | integer | SQLite boolean |
| `created_at` | text | Auto |
| `updated_at` | text | Auto |

### Settings table
Generic key/value store for admin-managed settings.

| Column | Type | Description |
|--------|------|-------------|
| `key` | text PK | Setting key (e.g., `"payment"`) |
| `value` | text | JSON blob |
| `updated_at` | text | Auto |

## API Endpoints

### User endpoints
- `GET /api/billing/access` — current user's access status
- `POST /api/billing/checkout` — create Stripe Checkout Session (`{ interval: "monthly" | "yearly" }`)
- `POST /api/billing/portal` — create Stripe Customer Portal session
- `POST /api/billing/webhook` — Stripe webhook receiver (no auth, signature-verified)

### Admin endpoints
- `GET /api/admin/billing/settings` — get payment configuration
- `PUT /api/admin/billing/settings` — update payment configuration (syncs to Stripe)
- `GET /api/admin/billing/users` — list all users with access status
- `PUT /api/admin/billing/users/:userId/access` — set user's access expiry

## Webhook Setup

### Production
1. Go to the [Stripe Dashboard](https://dashboard.stripe.com) → **Developers → Webhooks → Add endpoint**
2. Set the endpoint URL to `https://your-domain.com/api/billing/webhook`
3. Select these events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Click **Add endpoint**
5. On the endpoint detail page, click **Reveal** under **Signing secret** — this is your `whsec_...` value
6. Set it as `EDITIONS_STRIPE_WEBHOOK_SECRET` in your config or environment

### Local development
Install the [Stripe CLI](https://docs.stripe.com/stripe-cli) and forward webhooks to your local server:
```bash
stripe listen --forward-to http://localhost:3007/api/billing/webhook
```
The CLI prints a webhook signing secret (`whsec_...`) on startup — set it as `EDITIONS_STRIPE_WEBHOOK_SECRET` in your `editions.json` or environment. This secret changes each time you restart `stripe listen`.

## Frontend

### Access banner
Shown globally when access is expired or trial is ending soon (≤7 days). Contextual message with subscribe CTA.

### Settings → Subscription (all users)
- Current plan and status
- Subscribe / change plan buttons (redirect to Stripe Checkout)
- Manage subscription link (Stripe Customer Portal — billing history, cancel, update card)

### Settings → Access (admin only)
- Pricing configuration (monthly/yearly prices, trial days)
- User access management table (view all users, grant/revoke/extend access)
