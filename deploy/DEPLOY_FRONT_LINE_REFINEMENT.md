# Front Line Refinement — Home-Server Deployment (Ubuntu on "eigen")

This runbook deploys the Node.js site to your Dell Precision Tower 5810
(Ubuntu, user `eigen`), alongside Eigen, keeping Cloudflare Tunnel and Neon
(postgres) as-is. It mirrors the approach in eigen-repo/DEPLOYMENT.txt.

Goal:
  * Site runs forever via a `systemd --user` service on port 3000.
  * Exposed publicly only through Cloudflare Tunnel (no open ports).
  * Domain: https://frontlinerefinement.com

================================================================================
STEP 0 — Decide on environment values
================================================================================
You need three secrets before anything will boot in production:

  DATABASE_URL   = your existing Neon postgresql:// connection string
  ADMIN_PASSWORD = a strong initial admin password (min 12 characters)
  SESSION_SECRET = a long random string (generate with below)

These will be pasted into the service file (deploy/flr.service) AND/OR kept in
a .env file. See STEP 3.

Generate a session secret on the server:

  openssl rand -hex 32

================================================================================
STEP 1 — Copy the project to the Dell (network share)
================================================================================
Copy the whole front-line-refinement folder to /home/eigen/flr on the Dell.

What to include (all of the app EXCEPT node_modules):

  server.js
  package.json
  package-lock.json
  package.json
  routes/
  views/
  lib/
  public/

DO NOT copy node_modules/ (rebuilt on the server).

If you have a git remote on the Dell you can instead:

  cd /home/eigen
  git clone <your-repo-url> flr
  cd flr && npm ci

================================================================================
STEP 2 — Install Node.js + dependencies
================================================================================
On the Dell (as the eigen user):

  node --version        # must be >= 18
  npm --version

If Node is not installed, install Node 20 LTS (NodeSource):

  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs

Then install the app dependencies:

  cd /home/eigen/flr
  npm ci --omit=dev
  # (npm ci requires package-lock.json; use `npm install` if no lock file)

================================================================================
STEP 3 — Configure environment (secrets)
================================================================================
Option A (recommended): put secrets in a .env file read by the service.

  cd /home/eigen/flr
  cp deploy/flr.service ~/.config/systemd/user/flr.service

  # Then edit and uncomment Environment entries (systemd does not auto-read
  # .env with a plain ExecStart), OR use Option B.

Option B (cleaner): use an EnvironmentFile.

  1. Create the env file:
       nano /home/eigen/flr/.env
     with:
       NODE_ENV=production
       PORT=3000
       DATABASE_URL=postgresql://...   (your Neon URL)
       ADMIN_USERNAME=admin
       ADMIN_PASSWORD=...
       SESSION_SECRET=...

  2. In flr.service, replace the Environment= lines with:
       EnvironmentFile=/home/eigen/flr/.env

  3. Lock it down:
       chmod 600 /home/eigen/flr/.env

IMPORTANT: .env is in .gitignore, so it won't be committed accidentally.
Never commit DATABASE_URL / ADMIN_PASSWORD / SESSION_SECRET.

================================================================================
STEP 4 — Test locally on the Dell (before exposing it)
================================================================================
As the eigen user:

  cd /home/eigen/flr
  NODE_ENV=production \
  DATABASE_URL='postgresql://...' \
  ADMIN_PASSWORD='...' \
  SESSION_SECRET='...' \
  node server.js

Then from a browser on the LOCAL network:

  http://192.168.1.32:3000

Confirm:
  * Home / Classes / Schedule / Waiver pages load.
  * The new logo and course copy show on /classes.
  * Admin login works at http://192.168.1.32:3000/admin/login
    (first-run admin is created from ADMIN_USERNAME / ADMIN_PASSWORD).
  * Any existing content/courses still appear (loaded from Neon).

Stop with Ctrl+C.

================================================================================
STEP 5 — Run it as a persistent service (systemd --user)
================================================================================
1. Install and enable the unit:

   cp /home/eigen/flr/deploy/flr.service ~/.config/systemd/user/flr.service
   # then edit paths/secrets as needed
   systemctl --user daemon-reload
   systemctl --user enable --now flr.service
   systemctl --user status flr.service

2. Make it survive log-out (enable lingering):

   loginctl enable-linger eigen

================================================================================
STEP 6 — Expose via Cloudflare Tunnel (frontlinerefinement.com)
================================================================================
Assumption (matches your existing heigen.io setup): frontlinerefinement.com's
nameservers point at Cloudflare. cloudflared is already installed.

1. Add the zone to Cloudflare if not already there, and set its nameservers at
   your registrar. Verify:

   curl -s "https://cloudflare-dns.com/dns-query?name=frontlinerefinement.com&type=NS" \
     -H "accept: application/dns-json" | python3 -m json.tool
   # NS must be *.ns.cloudflare.com

2. Create a named tunnel:

   cloudflared tunnel create front-line-refinement
   # prints a tunnel UUID; note it

3. Route the apex + www to the tunnel (creates the CNAME records):

   cloudflared tunnel route dns front-line-refinement frontlinerefinement.com
   cloudflared tunnel route dns front-line-refinement www.frontlinerefinement.com

4. Edit the cloudflared config so the tunnel targets port 3000.
   Add/merge into ~/.cloudflared/config.yml:

     tunnel: <tunnel-uuid>
     credentials-file: /home/eigen/.cloudflared/<tunnel-uuid>.json
     ingress:
       - hostname: frontlinerefinement.com
         service: http://localhost:3000
       - hostname: www.frontlinerefinement.com
         service: http://localhost:3000
       - service: http_status:404

5. (Optional) make it run as a system service that survives reboots:

   sudo cloudflared service install
   sudo systemctl enable --now cloudflared

6. Wait ~30-60s and verify:

   https://frontlinerefinement.com

================================================================================
STEP 7 — Optional: Cloudflare Access login gate for /admin
================================================================================
Protect the admin panel with an email one-time-code (like the Eigen demo):

In the Cloudflare Zero Trust dashboard (one.cloudflare.com):
  Access -> Applications -> Add an application -> Self-hosted
  Application domain: frontlinerefinement.com
  Path: /admin
  Policy: Allow -> Emails (your email addresses)

This puts a login gate in front of /admin in addition to the app's own login.

================================================================================
UPDATING AN EXISTING DEPLOYMENT
================================================================================
From the Windows PC (PowerShell), package the app without node_modules/data/.env
and copy it over:

  tar -czf "$env:TEMP\flr.tgz" --exclude=node_modules --exclude=data --exclude=.env --exclude=.git -C C:\Softwareapp\websites front-line-refinement
  scp "$env:TEMP\flr.tgz" eigen@192.168.1.32:/home/eigen/flr.tgz

On the Dell (ssh eigen@192.168.1.32):

  cp -a /home/eigen/flr /home/eigen/flr-backup-$(date +%Y%m%d-%H%M)
  tar -xzf /home/eigen/flr.tgz -C /home/eigen/flr --strip-components=1
  cd /home/eigen/flr && npm ci --omit=dev
  systemctl --user restart flr.service
  systemctl --user status flr.service --no-pager

The installed unit (~/.config/systemd/user/flr.service) is not overwritten, so
your secrets stay put. Database changes apply automatically on startup and only
add tables/columns.

Roll back: stop the service, move the backup folder back to /home/eigen/flr,
start the service.

================================================================================
TROUBLESHOOTING
================================================================================
* "DATABASE_URL must be set in production" -> set it in .env or the unit.
* Port 3000 in use -> change PORT in .env AND the tunnel service line.
* Service exits immediately -> run `systemctl --user status flr.service` and
  `journalctl --user -u flr.service -n 100` for logs.
* Site loads but no data -> confirm DATABASE_URL points at the correct Neon
  database and the schema initialized (it runs automatically on boot).
* Tunnel 502 -> ensure the Node service is running on 3000 and the ingress
  service line matches.
* DNS not resolving -> ensure the zone is "Active" on Cloudflare and the
  registrar is using Cloudflare nameservers.
