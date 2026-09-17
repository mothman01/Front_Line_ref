# Front Line Refinement

A firearms and marksmanship coaching website with a password-protected admin panel so the site owner can edit all text content (biography, company info, safety rules, and course listings) without touching code.

## Features

- Public website with Home, Biography, About, Safety Rules, and Classes pages.
- Professionally styled, mobile-responsive, tactical dark theme.
- Secure password-protected admin area for editing all page content.
- Content stored in a simple JSON file (no database setup required).
- Session-based authentication with bcrypt password hashing.
- Admin can change their own password and username.
- Uses only pure-JavaScript dependencies (no native builds), so installation is reliable on any Node.js host.

## Requirements

- Node.js 18 or newer.
- Internet access only for the initial `npm install` (site runs fully offline afterward).

## Quick Start

```bash
npm install
npm start
```

Then open http://localhost:3000 in your browser.

## First-Time Setup

On first run, an admin account is created automatically with these credentials:

- **Username:** `admin`
- **Password:** `ChangeMeNow!123`

Log in at http://localhost:3000/admin and **immediately change the password** using the form in the admin panel. You can also change the username.

You can set your own initial credentials at any time (before first launch) via environment variables:

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=your-strong-password npm start
```

## Production Deployment

This is a **Node.js server app**, so it cannot run on static hosts like GitHub Pages. Use any Node.js-capable host. Render and Railway are the simplest options and both have free tiers.

1. Push this repo to GitHub, then connect it to your chosen host (or deploy from this folder directly).
2. The host will run `npm install` then `npm start`.
3. Set these **required environment variables** in your host's settings:
   - `NODE_ENV=production`
   - `ADMIN_PASSWORD` — a strong password for the initial admin account
   - `SESSION_SECRET` — a long, random value (e.g. `openssl rand -hex 32`)
   - `ADMIN_USERNAME` — optional, defaults to `admin`
   - `PORT` — set automatically by most hosts; defaults to `3000` locally
4. Site content and the admin account are stored at `data/site.json`.

> ⚠️ In production, the app will refuse to start if `SESSION_SECRET` or `ADMIN_PASSWORD` are not set. This is intentional — it prevents the site from running with an insecure default password or an unstable session secret.

Environment variables:

| Variable          | Purpose                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `PORT`            | Port to listen on (default `3000`)                                      |
| `ADMIN_USERNAME`  | Initial admin username (default `admin`)                                |
| `ADMIN_PASSWORD`  | Initial admin password (**required in production**)                     |
| `SESSION_SECRET`  | Secret used to sign session cookies (**required in production**)        |
| `NODE_ENV`        | Set to `production` for hardened, secure cookies                        |

## Project Structure

```
public/         Static assets (CSS, JS)
views/          Server-rendered EJS templates
routes/         Express route handlers
lib/            Store, auth, and default-content helpers
data/site.json  Content + admin account (created at runtime)
server.js       App entry point
```
