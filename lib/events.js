'use strict';

const { query, pool, hasDatabase } = require('./db');

// In-memory fallback for local dev without DATABASE_URL.
const fallback = [];
const fallbackRegs = [];

// Seats count as taken when paid, or pending with an unexpired checkout hold.
function regHoldsSeats(r, now = Date.now()) {
  if (r.status === 'paid') return true;
  return r.status === 'pending' && r.hold_expires_at && new Date(r.hold_expires_at).getTime() > now;
}

const SEATS_TAKEN_SQL = `
  COALESCE((
    SELECT SUM(r.seats) FROM registrations r
    WHERE r.event_id = e.id
      AND (r.status = 'paid' OR (r.status = 'pending' AND r.hold_expires_at > now()))
  ), 0)::int`;

function withSeats(e) {
  const taken = e.seats_taken || 0;
  return { ...e, seats_taken: taken, seats_left: Math.max(0, (e.capacity || 0) - taken) };
}

/**
 * Owner-created class sessions. Each event can be linked to a course and has
 * a seat capacity and a price (in cents) used for online checkout.
 */
async function createEvent(data) {
  const { title, course_id, course_name, starts_at, ends_at, location, description } = data;
  const capacity = Number(data.capacity) || 0;
  const price_cents = data.price_cents == null ? null : Number(data.price_cents);

  if (!hasDatabase) {
    const rec = {
      id: fallback.length ? Math.max(...fallback.map((e) => e.id)) + 1 : 1,
      title,
      course_id: course_id || null,
      course_name: course_name || null,
      starts_at,
      ends_at: ends_at || null,
      location: location || null,
      price: null,
      price_cents,
      capacity,
      description: description || null,
      created_at: new Date().toISOString(),
    };
    fallback.push(rec);
    return rec;
  }

  const res = await query(
    `INSERT INTO events
       (title, course_id, course_name, starts_at, ends_at, location, description, capacity, price_cents)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [title, course_id || null, course_name || null, starts_at, ends_at || null, location || null, description || null, capacity, price_cents]
  );
  return res.rows[0];
}

async function updateEvent(id, data) {
  const fields = ['title', 'starts_at', 'ends_at', 'location', 'description', 'capacity', 'price_cents'];
  const set = Object.fromEntries(fields.filter((f) => f in data).map((f) => [f, data[f]]));

  if (!hasDatabase) {
    const rec = fallback.find((e) => e.id === Number(id));
    if (rec) Object.assign(rec, set);
    return rec || null;
  }

  const keys = Object.keys(set);
  if (!keys.length) return null;
  const sql = `UPDATE events SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1 RETURNING *`;
  const res = await query(sql, [id, ...keys.map((k) => set[k])]);
  return res.rows[0] || null;
}

/**
 * List events with live seat counts. Optional { from, to } Date range on
 * starts_at.
 */
async function listEvents(options = {}) {
  const { from, to, ids } = options;

  if (!hasDatabase) {
    return fallback
      .filter((e) => (!from || new Date(e.starts_at) >= from) && (!to || new Date(e.starts_at) < to))
      .filter((e) => !ids || ids.includes(e.id))
      .map((e) => withSeats({
        ...e,
        seats_taken: fallbackRegs.filter((r) => r.event_id === e.id && regHoldsSeats(r)).reduce((n, r) => n + r.seats, 0),
      }))
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }

  const params = [];
  const clauses = [];
  if (from) {
    params.push(from);
    clauses.push(`e.starts_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    clauses.push(`e.starts_at < $${params.length}`);
  }
  if (ids) {
    params.push(ids);
    clauses.push(`e.id = ANY($${params.length}::int[])`);
  }
  const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
  const res = await query(`SELECT e.*, ${SEATS_TAKEN_SQL} AS seats_taken FROM events e${where} ORDER BY e.starts_at ASC`, params);
  return res.rows.map(withSeats);
}

async function getEvent(id) {
  if (!Number.isInteger(Number(id))) return null;
  const list = hasDatabase
    ? (await query(`SELECT e.*, ${SEATS_TAKEN_SQL} AS seats_taken FROM events e WHERE e.id = $1`, [id])).rows.map(withSeats)
    : (await listEvents()).filter((e) => e.id === Number(id));
  return list[0] || null;
}

/**
 * Delete an event. Refuses if it has paid registrations, so customer payment
 * records are never silently lost.
 */
async function deleteEvent(id) {
  if (!hasDatabase) {
    if (fallbackRegs.some((r) => r.event_id === Number(id) && r.status === 'paid')) {
      throw new Error('This class has paid registrations. Cancel and refund them first.');
    }
    const idx = fallback.findIndex((e) => e.id === Number(id));
    if (idx >= 0) fallback.splice(idx, 1);
    return;
  }
  const paid = await query(`SELECT 1 FROM registrations WHERE event_id = $1 AND status = 'paid' LIMIT 1`, [id]);
  if (paid.rows.length) {
    throw new Error('This class has paid registrations. Cancel and refund them first.');
  }
  await query('DELETE FROM events WHERE id = $1', [id]);
}

// ---- Registrations ---------------------------------------------------------

/**
 * Atomically hold `seats` on an event for a pending checkout. Locks the event
 * row so two customers can never both take the last seat.
 */
async function holdSeats({ event_id, customer_name, email, phone, seats, amount_cents, hold_expires_at }) {
  if (!hasDatabase) {
    const ev = await getEvent(event_id);
    if (!ev) throw new Error('Class not found.');
    if (ev.seats_left < seats) throw new SeatsUnavailableError(ev.seats_left);
    const rec = {
      id: fallbackRegs.length + 1,
      event_id: Number(event_id),
      customer_name,
      email,
      phone: phone || null,
      seats,
      amount_cents,
      status: 'pending',
      stripe_session_id: null,
      stripe_payment_intent: null,
      hold_expires_at,
      paid_at: null,
      created_at: new Date().toISOString(),
    };
    fallbackRegs.push(rec);
    return rec;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ev = await client.query('SELECT id, capacity FROM events WHERE id = $1 FOR UPDATE', [event_id]);
    if (!ev.rows.length) throw new Error('Class not found.');
    const taken = await client.query(
      `SELECT COALESCE(SUM(seats), 0)::int AS n FROM registrations
       WHERE event_id = $1 AND (status = 'paid' OR (status = 'pending' AND hold_expires_at > now()))`,
      [event_id]
    );
    const left = ev.rows[0].capacity - taken.rows[0].n;
    if (left < seats) throw new SeatsUnavailableError(Math.max(0, left));
    const res = await client.query(
      `INSERT INTO registrations
         (event_id, customer_name, email, phone, seats, amount_cents, status, hold_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING *`,
      [event_id, customer_name, email, phone || null, seats, amount_cents, hold_expires_at]
    );
    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

class SeatsUnavailableError extends Error {
  constructor(left) {
    super(left > 0 ? `Only ${left} seat${left === 1 ? '' : 's'} left.` : 'This class is full.');
    this.seatsLeft = left;
  }
}

async function attachCheckoutSession(regId, sessionId) {
  if (!hasDatabase) {
    const r = fallbackRegs.find((x) => x.id === regId);
    if (r) r.stripe_session_id = sessionId;
    return;
  }
  await query('UPDATE registrations SET stripe_session_id = $2 WHERE id = $1', [regId, sessionId]);
}

async function getRegistrationBySession(sessionId) {
  if (!hasDatabase) return fallbackRegs.find((r) => r.stripe_session_id === sessionId) || null;
  const res = await query('SELECT * FROM registrations WHERE stripe_session_id = $1', [sessionId]);
  return res.rows[0] || null;
}

// Mark a checkout paid. Idempotent: safe for both the webhook and the
// success-page check to call.
async function markPaid(sessionId, paymentIntent) {
  if (!hasDatabase) {
    const r = fallbackRegs.find((x) => x.stripe_session_id === sessionId);
    if (r && r.status !== 'paid') Object.assign(r, { status: 'paid', paid_at: new Date().toISOString(), stripe_payment_intent: paymentIntent || null });
    return r || null;
  }
  const res = await query(
    `UPDATE registrations
       SET status = 'paid', paid_at = COALESCE(paid_at, now()), stripe_payment_intent = COALESCE($2, stripe_payment_intent)
     WHERE stripe_session_id = $1 AND status IN ('pending', 'expired')
     RETURNING *`,
    [sessionId, paymentIntent || null]
  );
  return res.rows[0] || getRegistrationBySession(sessionId);
}

// Release a pending hold (checkout expired or abandoned).
async function releaseHold(sessionId) {
  if (!hasDatabase) {
    const r = fallbackRegs.find((x) => x.stripe_session_id === sessionId && x.status === 'pending');
    if (r) r.status = 'expired';
    return;
  }
  await query(`UPDATE registrations SET status = 'expired' WHERE stripe_session_id = $1 AND status = 'pending'`, [sessionId]);
}

async function listRegistrations() {
  if (!hasDatabase) {
    return fallbackRegs
      .map((r) => ({ ...r, event_title: (fallback.find((e) => e.id === r.event_id) || {}).title, event_starts_at: (fallback.find((e) => e.id === r.event_id) || {}).starts_at }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  const res = await query(
    `SELECT r.*, e.title AS event_title, e.starts_at AS event_starts_at
     FROM registrations r JOIN events e ON e.id = r.event_id
     WHERE r.status IN ('paid', 'cancelled') OR (r.status = 'pending' AND r.hold_expires_at > now())
     ORDER BY r.created_at DESC`
  );
  return res.rows;
}

async function cancelRegistration(id) {
  if (!hasDatabase) {
    const r = fallbackRegs.find((x) => x.id === Number(id));
    if (r) r.status = 'cancelled';
    return r || null;
  }
  const res = await query(`UPDATE registrations SET status = 'cancelled' WHERE id = $1 RETURNING *`, [id]);
  return res.rows[0] || null;
}

module.exports = {
  createEvent,
  updateEvent,
  listEvents,
  getEvent,
  deleteEvent,
  holdSeats,
  attachCheckoutSession,
  getRegistrationBySession,
  markPaid,
  releaseHold,
  listRegistrations,
  cancelRegistration,
  SeatsUnavailableError,
  regHoldsSeats,
};
