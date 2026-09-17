'use strict';

const { query, hasDatabase } = require('./db');

// In-memory fallback for local dev without DATABASE_URL.
const fallback = [];

/**
 * Owner-created calendar events. Each event can be linked to a course.
 */
async function createEvent(data) {
  const { title, course_id, course_name, starts_at, ends_at, location, price, description } = data;

  if (!hasDatabase) {
    const rec = {
      id: fallback.length + 1,
      title,
      course_id: course_id || null,
      course_name: course_name || null,
      starts_at,
      ends_at: ends_at || null,
      location: location || null,
      price: price || null,
      description: description || null,
      created_at: new Date().toISOString(),
    };
    fallback.push(rec);
    return rec;
  }

  const res = await query(
    `INSERT INTO events
       (title, course_id, course_name, starts_at, ends_at, location, price, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [title, course_id || null, course_name || null, starts_at, ends_at || null, location || null, price || null, description || null]
  );
  return res.rows[0];
}

async function listEvents() {
  if (!hasDatabase) return [...fallback].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const res = await query('SELECT * FROM events ORDER BY starts_at ASC');
  return res.rows;
}

async function getEvent(id) {
  if (!hasDatabase) return fallback.find((e) => e.id === Number(id)) || null;
  const res = await query('SELECT * FROM events WHERE id = $1', [id]);
  return res.rows.length ? res.rows[0] : null;
}

async function deleteEvent(id) {
  if (!hasDatabase) {
    const idx = fallback.findIndex((e) => e.id === Number(id));
    if (idx >= 0) fallback.splice(idx, 1);
    return;
  }
  await query('DELETE FROM events WHERE id = $1', [id]);
}

module.exports = {
  createEvent,
  listEvents,
  getEvent,
  deleteEvent,
};
