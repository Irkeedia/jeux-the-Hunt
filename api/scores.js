import { addScore, listScores, storageMode } from './lib/store.js';

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function computePoints(timeSec, distance) {
  return Math.floor(timeSec) * 100 + Math.max(0, distance);
}

function sanitizeName(name) {
  return String(name || 'Anonyme')
    .trim()
    .slice(0, 16)
    .replace(/[<>"'`]/g, '') || 'Anonyme';
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const limit = Math.min(50, Math.max(1, Number(req.query?.limit) || 10));
      const scores = await listScores(limit);
      return json(res, 200, { scores, storage: storageMode() });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          return json(res, 400, { error: 'JSON invalide' });
        }
      }
      if (!body || typeof body !== 'object') {
        return json(res, 400, { error: 'Corps de requête manquant' });
      }

      const time = Number(body.time);
      const distance = Number(body.distance);
      const hunters = Math.min(3, Math.max(1, Number(body.hunters) || 1));

      if (!Number.isFinite(time) || time < 0 || time > 86400) {
        return json(res, 400, { error: 'Temps invalide' });
      }
      if (!Number.isFinite(distance) || distance < 0 || distance > 1_000_000) {
        return json(res, 400, { error: 'Distance invalide' });
      }

      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: sanitizeName(body.name),
        time,
        distance: Math.floor(distance),
        hunters,
        points: computePoints(time, distance),
        createdAt: new Date().toISOString(),
      };

      const result = await addScore(entry);
      return json(res, 201, { ok: true, entry, ...result, storage: storageMode() });
    }

    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: 'Méthode non autorisée' });
  } catch (err) {
    console.error('[api/scores]', err);
    return json(res, 500, { error: 'Erreur serveur' });
  }
}
