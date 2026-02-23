import type { PerfReporterOptions, NormalizedOptions, MetricEntry, ReportPayload } from './types';
import { observeMetrics } from './metrics';

let initialized = false;
let opts: NormalizedOptions;
let buffer: MetricEntry[] = [];
let cleanup: (() => void) | null = null;

/**
 * Initialize the performance reporter.
 * Automatically collects Core Web Vitals (LCP, FCP, CLS, INP, TTFB)
 * and reports them to the specified endpoint.
 *
 * @returns A teardown function that stops collection and flushes remaining metrics.
 */
export function initPerfReporter(options: PerfReporterOptions): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }
  if (initialized) {
    console.warn('[perf-reporter] Already initialized.');
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
    cleanup = null;
  };

  return cleanup;
}

/**
 * Manually report a custom metric.
 * Must be called after `initPerfReporter()`.
 */
export function reportMetric(
  name: string,
  value: number,
  rating: MetricEntry['rating'] = 'good'
): void {
  if (!initialized) {
    console.warn('[perf-reporter] Not initialized. Call initPerfReporter() first.');
    return;
  }
  buffer.push({ name, value, rating, timestamp: Date.now() });
  if (opts.debug) {
    console.log(`[perf-reporter] ${name}: ${value} (${rating})`);
  }
  if (opts.immediate) flush();
}

/**
 * Get a snapshot of currently buffered metrics (for debugging/testing).
 */
export function getMetrics(): MetricEntry[] {
  return [...buffer];
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
