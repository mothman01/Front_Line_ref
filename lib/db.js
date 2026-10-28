'use strict';

const { Pool } = require('pg');

/**
 * PostgreSQL connection pool backed by Neon.
 *
 * Requires a DATABASE_URL environment variable (e.g. a postgresql:// URL).
 * This replaces the previous JSON-file store, so content, users, sessions,
 * waivers, and appointments all persist across restarts and redeploys.
 */

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  // Fall back to a local-only in-memory/file store instead of failing hard in
  // development, but production must always have a database.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'DATABASE_URL must be set in production. Add your Neon connection string as an environment variable.'
    );
  }
}

// Normalize the connection string to force sslmode=verify-full so pg never
// silently downgrades to a weaker SSL mode (and to silence its deprecation
// warning about ambiguous sslmode values).
function normalizeConnectionString(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('sslmode', 'verify-full');
    return parsed.toString();
  } catch {
    // Not a parseable URL; return as-is.
    return url;
  }
}

const pool = DATABASE_URL
  ? new Pool({
      connectionString: normalizeConnectionString(DATABASE_URL),
      // Neon terminates TLS with valid, publicly-trusted certificates, so we
      // verify both the certificate and the hostname.
      ssl: { rejectUnauthorized: true },
      connectionTimeoutMillis: 10000,
    })
  : null;

/**
 * Initialize the schema. Safe to call on every startup (uses IF NOT EXISTS).
 */
async function initSchema() {
  if (!pool) return;

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS content (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS waivers (
        id SERIAL PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        date_of_birth TEXT,
        legal_attestation BOOLEAN NOT NULL DEFAULT false,
        signature TEXT NOT NULL,
        signed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        customer_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        course TEXT NOT NULL,
        scheduled_at TIMESTAMPTZ NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'confirmed',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      -- Prevent two concurrent bookings of the same active time slot. A partial
      -- unique index covers only non-cancelled rows, so cancelled slots can be
      -- rebooked. The DB enforces this atomically regardless of application
      -- code, eliminating the check-then-insert race.
      CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_active_slot
        ON appointments (scheduled_at)
        WHERE status <> 'cancelled';

      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        course_id TEXT,
        course_name TEXT,
        starts_at TIMESTAMPTZ NOT NULL,
        ends_at TIMESTAMPTZ,
        location TEXT,
        price TEXT,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS images (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        data TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'slideshow',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS page_views (
        id SERIAL PRIMARY KEY,
        path TEXT NOT NULL,
        viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views (path);

      -- Migration-safe column additions (for databases created before these
      -- columns existed).
      ALTER TABLE images ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'slideshow';
      ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 10;
      ALTER TABLE events ADD COLUMN IF NOT EXISTS price_cents INTEGER;

      -- Seat reservations for class sessions. A 'pending' row holds seats
      -- while the customer is on Stripe Checkout (until hold_expires_at);
      -- 'paid' rows hold them permanently.
      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        customer_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        seats INTEGER NOT NULL DEFAULT 1,
        amount_cents INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        stripe_session_id TEXT UNIQUE,
        stripe_payment_intent TEXT,
        hold_expires_at TIMESTAMPTZ,
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_registrations_event ON registrations (event_id);

      -- Session storage used by connect-pg-simple.
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);
  } finally {
    client.release();
  }
}

async function query(text, params) {
  if (!pool) throw new Error('No database configured.');
  return pool.query(text, params);
}

module.exports = {
  pool,
  query,
  initSchema,
  hasDatabase: !!pool,
};
