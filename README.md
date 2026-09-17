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

1. Put this folder on your server (Node.js host, VPS, or any host supporting Node apps).
2. Run `npm install --production` then `npm start`.
3. Set a strong `ADMIN_PASSWORD` environment variable (and optionally `ADMIN_USERNAME`) and a random `SESSION_SECRET`.
4. Put the app behind HTTPS (e.g. nginx, Caddy, or your host's proxy) so passwords are transmitted securely.
5. Site content and the admin account are stored at `data/site.json`.

Environment variables:

| Variable          | Purpose                                      |
| ----------------- | -------------------------------------------- |
| `PORT`            | Port to listen on (default `3000`)           |
| `ADMIN_USERNAME`  | Initial admin username (default `admin`)     |
| `ADMIN_PASSWORD`  | Initial admin password (default `ChangeMeNow!123`) |
| `SESSION_SECRET`  | Secret used to sign session cookies          |
| `NODE_ENV`        | Set to `production` for hardened cookies     |

## Project Structure

```
public/         Static assets (CSS, JS)
views/          Server-rendered EJS templates
routes/         Express route handlers
lib/            Store, auth, and default-content helpers
data/site.json  Content + admin account (created at runtime)
server.js       App entry point
```
