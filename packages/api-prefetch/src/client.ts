export interface GetPrefetchDataOptions {
  /** window 上的全局缓存键名，默认 '__PREFETCH_CACHE__' */
  cacheKey?: string;
  /** 超时时间（毫秒），默认 5000。设为 0 可禁用超时。 */
  timeout?: number;
}

const DEFAULT_CACHE_KEY = '__PREFETCH_CACHE__';

/**
 * 从缓存中获取预取的 API 数据。
 * 返回一个 Promise，解析为数据本身；若无缓存条目则返回 null。
 * 读取后缓存条目会被消费（删除）。
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
