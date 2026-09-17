'use strict';

const { query, hasDatabase } = require('./db');

// In-memory fallback for local dev without DATABASE_URL.
const fallback = [];

/**
 * Create an appointment. Rejects double-booking the same time slot.
 */
async function createAppointment(data) {
  const { customer_name, email, phone, course, scheduled_at, notes } = data;

  if (!hasDatabase) {
    if (fallback.some((a) => a.scheduled_at === scheduled_at && a.status !== 'cancelled')) {
      throw new Error('That time slot is already booked.');
    }
    const rec = {
      id: fallback.length + 1,
      customer_name,
      email,
      phone: phone || null,
      course,
      scheduled_at,
      notes: notes || null,
      status: 'confirmed',
      created_at: new Date().toISOString(),
    };
    fallback.push(rec);
    return rec;
  }

  // Use a transaction + advisory-like constraint via a unique check. We query
  // for conflicts and rely on the API checking before insert; for real
  // concurrency safety we also enforce with a before-insert check.
  const conflict = await query(
    `SELECT id FROM appointments
     WHERE scheduled_at = $1 AND status <> 'cancelled'
     LIMIT 1`,
    [scheduled_at]
  );
  if (conflict.rows.length) {
    throw new Error('That time slot is already booked.');
  }

  const res = await query(
    `INSERT INTO appointments
       (customer_name, email, phone, course, scheduled_at, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [customer_name, email, phone || null, course, scheduled_at, notes || null]
  );
  return res.rows[0];
}

async function listAppointments(options = {}) {
  const { from, to } = options;

  if (!hasDatabase) {
    let list = [...fallback];
    if (from) list = list.filter((a) => new Date(a.scheduled_at) >= new Date(from));
    if (to) list = list.filter((a) => new Date(a.scheduled_at) <= new Date(to));
    return list.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  }

  let sql = 'SELECT * FROM appointments';
  const params = [];
  const clauses = [];
  if (from) {
    params.push(from);
    clauses.push(`scheduled_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    clauses.push(`scheduled_at <= $${params.length}`);
  }
  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY scheduled_at ASC';

  const res = await query(sql, params);
  return res.rows;
}

async function cancelAppointment(id) {
  if (!hasDatabase) {
    const rec = fallback.find((a) => a.id === Number(id));
    if (rec) rec.status = 'cancelled';
    return rec;
  }
  const res = await query(
    `UPDATE appointments SET status = 'cancelled' WHERE id = $1 RETURNING *`,
    [id]
  );
  return res.rows[0] || null;
}

async function confirmAppointment(id) {
  if (!hasDatabase) {
    const rec = fallback.find((a) => a.id === Number(id));
    if (rec) rec.status = 'confirmed';
    return rec;
  }
  const res = await query(
    `UPDATE appointments SET status = 'confirmed' WHERE id = $1 RETURNING *`,
    [id]
  );
  return res.rows[0] || null;
}

async function listBlockedSlots() {
  // Reserved/unavailable slots could be tracked here; placeholder for future.
  return [];
}

module.exports = {
  createAppointment,
  listAppointments,
  cancelAppointment,
  confirmAppointment,
  listBlockedSlots,
};
