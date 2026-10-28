# Front Line Refinement

A firearms and marksmanship coaching website with a password-protected admin panel, online liability waivers, and a scheduling calendar.

## Features

- Public website with Home, Biography, About, Safety Rules, Classes, Schedule, and Waiver pages.
- Professionally styled, mobile-responsive, tactical dark theme.
- Secure password-protected admin area for editing all page content.
- Online **liability waiver** submission and viewing.
- **Scheduling calendar** — customers book appointments; the owner sees and manages them.
- Content, users, waivers, and appointments stored in **PostgreSQL (Neon)**.
- Session-based authentication with bcrypt password hashing.
- CSRF protection, login rate-limiting, and hardened security headers (Helmet).
- Admin can change their own password and username.

## Requirements

- Node.js 18 or newer.
- A PostgreSQL database connection string (Neon is recommended) for production.

## Quick Start (local, without a database)

For local development you can run without a database — the app falls back to an in-memory store (data is lost on restart):

```bash
npm install
npm start
```

Then open http://localhost:3000 in your browser.

## Production (with Neon / PostgreSQL)

Set these environment variables:

| Variable          | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `DATABASE_URL`    | PostgreSQL connection string (Neon `postgresql://...` URL)     |
| `NODE_ENV`        | Set to `production`                                            |
| `ADMIN_PASSWORD`  | Strong initial admin password (required in production)         |
| `SESSION_SECRET`  | Long random value for signing session cookies (required)       |
| `ADMIN_USERNAME`  | Initial admin username (default `admin`)                       |
| `PORT`            | Port (default `3000`; set automatically by most hosts)         |

| `STRIPE_SECRET_KEY`     | Stripe secret key for online class checkout (`sk_test_...` / `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the `/stripe/webhook` endpoint (`whsec_...`) |
| `SITE_URL`              | Public URL, used for Stripe return links (e.g. `https://frontlinerefinement.com`) |
| `SITE_TIMEZONE`         | Timezone for the calendar and class times (default `America/Chicago`) |

### Online class checkout (Stripe)

1. In the Stripe dashboard, copy your **secret key** into `STRIPE_SECRET_KEY`.
2. Under Developers → Webhooks, add an endpoint `https://<your-domain>/stripe/webhook`
   listening for `checkout.session.completed`, `checkout.session.expired`,
   `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`.
   Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
3. Restart the app, then turn on **Admin → Online Checkout**.

Seats are held for 30 minutes while a customer is on Stripe's checkout page and released
automatically if they cancel or the session expires. Refunds are issued from the Stripe dashboard;
cancelling a registration in the admin panel frees its seats.

> ⚠️ In production, the app refuses to start unless `DATABASE_URL`, `ADMIN_PASSWORD`, and `SESSION_SECRET` are set. This prevents insecure defaults and data loss.

## Deployment

This is a **Node.js server app** — it cannot run on static hosts like GitHub Pages. Use Render, Railway, Fly.io, or any Node.js host:

1. Push this repo to GitHub and connect your host to it.
2. Set the environment variables above.
3. The host runs `npm install` then `npm start`.

### First-time admin credentials

On first run, the admin account is created from `ADMIN_USERNAME` / `ADMIN_PASSWORD`. Log in at `/admin/login` and change the password in the Account section.

## Project Structure

```
public/         Static assets (CSS, JS)
views/          Server-rendered EJS templates
routes/         Express route handlers
lib/            DB, store, auth, waivers, appointments, and security helpers
server.js       App entry point
```
