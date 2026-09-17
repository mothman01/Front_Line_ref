'use strict';

const { query, hasDatabase } = require('./db');

// In-memory fallback for local dev without DATABASE_URL.
const fallback = [];

/**
 * Image storage for the homepage slideshow. Images are stored as base64 data
 * URIs in Postgres so they survive restarts/redeploys (the filesystem on Render
 * is ephemeral).
 */
async function saveImage({ filename, mimeType, dataUrl }) {
  if (!hasDatabase) {
    const rec = {
      id: fallback.length + 1,
      filename,
      mime_type: mimeType,
      data: dataUrl,
      sort_order: fallback.length,
      created_at: new Date().toISOString(),
    };
    fallback.push(rec);
    return rec;
  }

  const res = await query(
    `INSERT INTO images (filename, mime_type, data, sort_order)
     VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM images))
     RETURNING *`,
    [filename, mimeType, dataUrl]
  );
  return res.rows[0];
}

async function listImages() {
  if (!hasDatabase) return [...fallback].sort((a, b) => a.sort_order - b.sort_order);
  const res = await query('SELECT * FROM images ORDER BY sort_order ASC');
  return res.rows;
}

async function getImage(id) {
  if (!hasDatabase) return fallback.find((im) => im.id === Number(id)) || null;
  const res = await query('SELECT * FROM images WHERE id = $1', [id]);
  return res.rows.length ? res.rows[0] : null;
}

async function deleteImage(id) {
  if (!hasDatabase) {
    const idx = fallback.findIndex((im) => im.id === Number(id));
    if (idx >= 0) fallback.splice(idx, 1);
    return;
  }
  await query('DELETE FROM images WHERE id = $1', [id]);
}

async function reorderImages(orderedIds) {
  if (!hasDatabase) {
    orderedIds.forEach((id, i) => {
      const im = fallback.find((x) => x.id === Number(id));
      if (im) im.sort_order = i;
    });
    return;
  }
  for (let i = 0; i < orderedIds.length; i++) {
    await query('UPDATE images SET sort_order = $1 WHERE id = $2', [i, orderedIds[i]]);
  }
}

module.exports = {
  saveImage,
  listImages,
  getImage,
  deleteImage,
  reorderImages,
};
