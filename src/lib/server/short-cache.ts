type CacheEntry<T> = {
  expiresAt: number;
  value: Promise<T>;
};

const cache = new Map<string, CacheEntry<unknown>>();
const defaultTtlMs = 30000;

export function getShortCache<T>(key: string, load: () => Promise<T>, ttlMs = defaultTtlMs): Promise<T> {
  const now = Date.now();
  const cached = cache.get(key) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const value = load().catch((error) => {
    cache.delete(key);
    throw error;
  });

  cache.set(key, {
    expiresAt: now + ttlMs,
    value
  });

  return value;
}

export function createShortCacheKey(scope: string, input: unknown) {
  return `${scope}:${JSON.stringify(input)}`;
}

export function clearShortCache() {
  cache.clear();
}
