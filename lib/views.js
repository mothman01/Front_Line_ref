'use strict';

const { query, hasDatabase } = require('./db');

const fallback = [];

/**
 * Lightweight page-view tracking. Logs each page visit path with a timestamp.
 */
async function recordView(path) {
  if (!hasDatabase) {
    fallback.push({ path, viewed_at: new Date() });
    return;
  }
  await query('INSERT INTO page_views (path) VALUES ($1)', [path]);
}

async function getViewCounts() {
  if (!hasDatabase) {
    const counts = {};
    for (const v of fallback) counts[v.path] = (counts[v.path] || 0) + 1;
    return counts;
  }
  const res = await query(
    `SELECT path, COUNT(*)::int AS count
     FROM page_views
     GROUP BY path
     ORDER BY count DESC`
  );
  const out = {};
  for (const row of res.rows) out[row.path] = row.count;
  return out;
}

module.exports = { recordView, getViewCounts };
