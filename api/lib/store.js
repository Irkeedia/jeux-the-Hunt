import { Redis } from '@upstash/redis';

const LEADERBOARD_KEY = 'the-hunt:leaderboard';
export const MAX_ENTRIES = 50;

let redis;

function getRedis() {
  if (!redis && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = Redis.fromEnv();
  }
  return redis;
}

function fallbackScores() {
  if (!globalThis.__theHuntScores) globalThis.__theHuntScores = [];
  return globalThis.__theHuntScores;
}

export async function listScores(limit = 10) {
  const n = Math.min(Math.max(1, limit), MAX_ENTRIES);
  const client = getRedis();
  if (client) {
    const rows = (await client.get(LEADERBOARD_KEY)) || [];
    return rows.slice(0, n);
  }
  return fallbackScores()
    .slice()
    .sort((a, b) => b.points - a.points)
    .slice(0, n);
}

export async function addScore(entry) {
  const client = getRedis();
  const rows = client ? (await client.get(LEADERBOARD_KEY)) || [] : fallbackScores().slice();
  rows.push(entry);
  rows.sort((a, b) => b.points - a.points);
  const trimmed = rows.slice(0, MAX_ENTRIES);
  if (client) await client.set(LEADERBOARD_KEY, trimmed);
  else globalThis.__theHuntScores = trimmed;
  const rank = trimmed.findIndex((r) => r.id === entry.id) + 1;
  return { rank: rank || null, total: trimmed.length };
}

export function storageMode() {
  return getRedis() ? 'redis' : 'memory';
}
