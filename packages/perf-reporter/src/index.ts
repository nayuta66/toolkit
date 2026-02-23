import type { PerfReporterOptions, NormalizedOptions, MetricEntry, ReportPayload } from './types';
import { observeMetrics } from './metrics';

let initialized = false;
let opts: NormalizedOptions;
let buffer: MetricEntry[] = [];
let history: MetricEntry[] = [];
let cleanup: (() => void) | null = null;

/**
 * 初始化性能上报器。
 * 自动采集 Core Web Vitals（LCP、FCP、CLS、INP、TTFB）
 * 并上报到指定的端点。
 *
 * @returns 销毁函数，调用后停止采集并上报剩余指标。
 */
export function initPerfReporter(options: PerfReporterOptions): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }
  if (initialized) {
    console.warn('[perf-reporter] 已初始化，请勿重复调用。');
    return () => {};
  }

  const sampleRate = options.sampleRate ?? 1;
  if (Math.random() >= sampleRate) {
    return () => {};
  }

  initialized = true;
  opts = {
    endpoint: options.endpoint,
    sampleRate,
    extra: options.extra ?? {},
    immediate: options.immediate ?? false,
    debug: options.debug ?? false,
  };

  const disconnect = observeMetrics((entry) => {
    buffer.push(entry);
    history.push(entry);
    if (opts.debug) {
      console.log(`[perf-reporter] ${entry.name}: ${entry.value} (${entry.rating})`);
    }
    if (opts.immediate) flush();
  });

  const onHide = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  document.addEventListener('visibilitychange', onHide);

  cleanup = () => {
    initialized = false;
    disconnect();
    document.removeEventListener('visibilitychange', onHide);
    flush();
    history = [];
    cleanup = null;
  };

  return cleanup;
}

/**
 * 手动上报自定义指标。
 * 必须在 `initPerfReporter()` 之后调用。
 */
export function reportMetric(
  name: string,
  value: number,
  rating: MetricEntry['rating'] = 'good'
): void {
  if (!initialized) {
    console.warn('[perf-reporter] 尚未初始化，请先调用 initPerfReporter()。');
    return;
  }
  const entry: MetricEntry = { name, value, rating, timestamp: Date.now() };
  buffer.push(entry);
  history.push(entry);
  if (opts.debug) {
    console.log(`[perf-reporter] ${name}: ${value} (${rating})`);
  }
  if (opts.immediate) flush();
}

/**
 * 获取自初始化以来采集的所有指标（不受 flush 影响）。
 */
export function getMetrics(): MetricEntry[] {
  return [...history];
}

function flush(): void {
  if (buffer.length === 0) return;

  const payload: ReportPayload = {
    url: location.href,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
    metrics: buffer.splice(0),
    extra: opts.extra,
  };

  const body = JSON.stringify(payload);
  const blob = new Blob([body], { type: 'application/json' });

  if (navigator.sendBeacon?.(opts.endpoint, blob)) return;

  fetch(opts.endpoint, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
  }).catch(() => {});
}

export type {
  PerfReporterOptions,
  MetricEntry,
  ReportPayload,
} from './types';

export type { MetricName } from './types';
