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

/**
 * Delete page-view rows older than `maxAgeDays`. The table otherwise grows
 * unbounded (every visit, including bots and 404s, inserts a row forever).
 * Called on boot; safe to re-run.
 */
async function prunePageViews(maxAgeDays = 30) {
  if (!hasDatabase) return;
  await query('DELETE FROM page_views WHERE viewed_at < now() - interval \'1 day\' * $1', [maxAgeDays]);
}

module.exports = { recordView, getViewCounts, prunePageViews };
