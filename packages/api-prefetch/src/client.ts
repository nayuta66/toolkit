import { buildUrl } from './config';

export { buildUrl };

export interface GetPrefetchDataOptions {
  /** window 上的全局缓存键名，默认 '__PREFETCH_CACHE__' */
  cacheKey?: string;
  /** 超时时间（毫秒），默认 5000。设为 0 可禁用超时。 */
  timeout?: number;
  /** URL 查询参数，用于拼接完整 URL 以匹配插件生成的缓存键 */
  params?: Record<string, string | number | boolean>;
}

/** 默认的全局缓存键名，与插件侧保持一致 */
const DEFAULT_CACHE_KEY = '__PREFETCH_CACHE__';

/**
 * 从预取缓存中获取 API 数据。
 *
 * 工作流程：
 * 1. 使用 buildUrl(url, params) 构造完整的请求地址（含查询参数），作为缓存键
 * 2. 在 window[cacheKey] 中查找该键对应的 Promise
 * 3. 命中：取出 Promise 并立即从缓存中删除（一次性消费，防止过期数据被复用）
 * 4. 未命中：返回 null，调用方应降级为普通 fetch
 *
 * 超时保护：
 * - 默认 5 秒超时，通过 Promise.race 实现
 * - 如果预取请求迟迟未返回，超时后返回 null，不会无限阻塞业务
 * - 设为 0 可禁用超时，直接返回原始 Promise
 *
 * @returns 命中缓存时返回 Promise<T | null>；未命中时返回 null
 */
export function getPrefetchData<T = unknown>(
  url: string,
  options?: GetPrefetchDataOptions
): Promise<T | null> | null {
  const cacheKey = options?.cacheKey ?? DEFAULT_CACHE_KEY;
  const timeout = options?.timeout ?? 5000;

  // 用 buildUrl 拼接参数，确保与插件生成脚本中的缓存键完全一致
  const fullUrl = buildUrl(url, options?.params);

  // 从 window 上读取全局缓存对象
  const cache: Record<string, Promise<T | null>> | undefined =
    typeof window !== 'undefined'
      ? (window as unknown as Record<string, any>)[cacheKey]
      : undefined;

  // 缓存未命中，返回 null 让调用方降级
  if (!cache?.[fullUrl]) return null;

  // 取出缓存条目后立即删除，保证每个预取结果只被消费一次
  const entry = cache[fullUrl];
  delete cache[fullUrl];

  // 超时为 0 表示不限时，直接返回原始 Promise
  if (!timeout) return entry;

  // 与超时 Promise 竞争：谁先完成用谁的结果
  return Promise.race([
    entry,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeout);
    }),
  ]);
}
