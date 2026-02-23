export interface GetPrefetchDataOptions {
  /** Global cache key on window, defaults to '__PREFETCH_CACHE__' */
  cacheKey?: string;
  /** Timeout in ms, defaults to 5000. Set to 0 to disable. */
  timeout?: number;
}

const DEFAULT_CACHE_KEY = '__PREFETCH_CACHE__';

/**
 * Retrieve prefetched API data from cache.
 * Returns a Promise resolving with the data, or null if no cache entry exists.
 * The cache entry is consumed (deleted) after reading.
 */
export function getPrefetchData<T = unknown>(
  url: string,
  options?: GetPrefetchDataOptions
): Promise<T | null> | null {
  const cacheKey = options?.cacheKey ?? DEFAULT_CACHE_KEY;
  const timeout = options?.timeout ?? 5000;
  const cache: Record<string, Promise<T | null>> | undefined =
    typeof window !== 'undefined'
      ? (window as unknown as Record<string, any>)[cacheKey]
      : undefined;

  if (!cache?.[url]) return null;

  const entry = cache[url];
  delete cache[url];

  if (!timeout) return entry;

  return Promise.race([
    entry,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeout);
    }),
  ]);
}
