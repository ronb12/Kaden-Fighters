/**
 * Health check for Neon Postgres (Vercel serverless).
 * Set DATABASE_URL in Vercel from your Neon project (Connection string).
 */
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({
      ok: false,
      error: 'DATABASE_URL is not set. Add it in Vercel → Settings → Environment Variables (from Neon dashboard).',
    });
  }
  const sql = neon(process.env.DATABASE_URL);
  try {
    const rows = await sql`SELECT NOW() AS now, current_database() AS db`;
    return res.status(200).json({ ok: true, neon: rows[0] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
};
