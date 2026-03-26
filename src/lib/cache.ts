import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CACHE_DIR = join(homedir(), '.config', 'skillboss', 'cache');
const TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

interface CacheEntry {
  ts: number;
  data: unknown;
}

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function cacheFile(key: string): string {
  // Sanitize key to filename
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return join(CACHE_DIR, `${safe}.json`);
}

export function getCached<T>(key: string): T | null {
  const file = cacheFile(key);
  if (!existsSync(file)) { return null; }

  try {
    const entry: CacheEntry = JSON.parse(readFileSync(file, 'utf-8'));
    if (Date.now() - entry.ts > TTL_MS) { return null; }
    return entry.data as T;
  } catch {
    return null;
  }
}

export function setCache(key: string, data: unknown): void {
  ensureCacheDir();
  const entry: CacheEntry = { ts: Date.now(), data };
  writeFileSync(cacheFile(key), JSON.stringify(entry));
}

/**
 * Fetch with cache. Returns cached data if fresh, otherwise calls fetcher and caches result.
 */
export async function withCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== null) { return cached; }

  const data = await fetcher();
  setCache(key, data);
  return data;
}
