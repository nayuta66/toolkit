export interface ApiConfig {
  /** API 端点 URL（必填） */
  url: string;
  /** HTTP 方法，默认 'GET' */
  method?: string;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求体（GET/HEAD 请求时忽略） */
  body?: unknown;
  /** 凭证策略，默认 'same-origin' */
  credentials?: 'include' | 'same-origin' | 'omit';
  /** 构建时已知的静态查询参数，会被序列化拼接到 URL 上 */
  params?: Record<string, string | number | boolean>;
  /**
   * 需要在运行时从当前页面 URL 中提取的查询参数名列表。
   * 内联脚本执行时会从 location.search 读取这些参数并拼接到请求 URL 上。
   * 业务代码消费时需传入相同的参数以匹配缓存键。
   */
  queryParams?: string[];
  /** 是否启用该 API 的预取，默认 true */
  enabled?: boolean;
}

/** 构建时传入的上下文，可据此为不同页面/环境生成不同的预取列表 */
export interface BuildContext {
  /** HtmlWebpackPlugin 输出文件名，如 'index.html'（MPA 区分页面） */
  entry: string;
  /** webpack 构建模式：'development' | 'production' | 'none' */
  mode: string;
  /** 环境变量（process.env 的快照） */
  env: Record<string, string | undefined>;
}

/** 配置文件的导出类型：静态数组 或 接收上下文的工厂函数 */
export type PrefetchConfigExport =
  | ApiConfig[]
  | ((context: BuildContext) => ApiConfig[]);

// ---------------------------------------------------------------------------
// globalThis 收集器：插件和配置文件通过同一个全局 key 通信，
// 即使 tsup 打包时将 config.ts 内联到 index.ts，也不会破坏共享状态。
// ---------------------------------------------------------------------------

const COLLECTOR_KEY = '__PREFETCH_COLLECTOR__';

interface CollectorState {
  apis: ApiConfig[];
  context: BuildContext;
}

function getCollector(): CollectorState | undefined {
  return (globalThis as any)[COLLECTOR_KEY];
}

/**
 * 声明一个需要预取的 API（函数调用风格）。
 *
 * 在配置文件中直接调用，无需 module.exports，无需返回数组：
 * ```js
 * const { prefetch } = require('@toolkit/api-prefetch/config');
 *
 * prefetch('/api/user/info', { queryParams: ['userId'] });
 * prefetch('/api/settings', { params: { version: 2 } });
 * ```
 */
export function prefetch(url: string, options: Omit<ApiConfig, 'url'> = {}): void {
  const state = getCollector();
  if (!state) return;
  state.apis.push({ url, ...options });
}

/**
 * 获取当前构建上下文（entry、mode、env）。
 * 配合 prefetch() 使用，可在配置文件中按条件决定是否预取。
 *
 * ```js
 * const { prefetch, getContext } = require('@toolkit/api-prefetch/config');
 * const { entry, mode } = getContext();
 *
 * prefetch('/api/settings');
 * if (entry === 'index.html') prefetch('/api/user/info');
 * ```
 */
export function getContext(): BuildContext {
  return getCollector()?.context ?? { entry: '', mode: 'none', env: {} };
}

/**
 * 定义预取配置（导出风格）。
 * 支持静态数组和工厂函数两种形式，适合喜欢 module.exports / export default 的写法。
 */
export function definePrefetchConfig(input: PrefetchConfigExport): PrefetchConfigExport {
  return input;
}

/**
 * 将 params 序列化并拼接到 URL 上，生成完整的请求地址。
 * 插件和客户端共用此函数以保证缓存键一致。
 */
export function buildUrl(
  url: string,
  params?: Record<string, string | number | boolean>,
): string {
  if (!params || Object.keys(params).length === 0) return url;
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`;
}
