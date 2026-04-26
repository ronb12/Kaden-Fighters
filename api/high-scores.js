/**
 * Example leaderboard API backed by Neon.
 * Run `neon/schema.sql` once in the Neon SQL Editor after creating the project.
 */
const { neon } = require('@neondatabase/serverless');

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body || '{}');
  } catch (_) {
    return {};
  }
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({
      ok: false,
      error: 'DATABASE_URL not configured',
    });
  }
  const sql = neon(process.env.DATABASE_URL);

  if (req.method === 'GET') {
    try {
      const rows = await sql`
        SELECT id, player_name, score, created_at
        FROM high_scores
        ORDER BY score DESC
        LIMIT 20
      `;
      return res.status(200).json({ ok: true, scores: rows });
    } catch (e) {
      const msg = e.message || String(e);
      if (/relation .* does not exist|high_scores/.test(msg)) {
        return res.status(200).json({
          ok: true,
          scores: [],
          hint: 'Create the table by running neon/schema.sql in the Neon SQL Editor.',
        });
      }
      return res.status(500).json({ ok: false, error: msg });
    }
  }

  if (req.method === 'POST') {
    const body = parseBody(req);
    const rawName = String(body.name || 'FIGHTER');
    const playerName = rawName.slice(0, 12).replace(/[^a-zA-Z0-9 _-]/g, '') || 'FIGHTER';
    const score = Math.max(0, Math.min(99999999, parseInt(body.score, 10) || 0));
    try {
      await sql`
        INSERT INTO high_scores (player_name, score)
        VALUES (${playerName}, ${score})
      `;
      return res.status(201).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message || String(e) });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
};
