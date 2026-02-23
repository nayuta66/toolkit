export interface PerfReporterOptions {
  /** Endpoint URL to send metrics to */
  endpoint: string;
  /** Sampling rate between 0 and 1, defaults to 1 (100%) */
  sampleRate?: number;
  /** Extra dimensions attached to every report */
  extra?: Record<string, unknown>;
  /** Report each metric immediately instead of batching on page hide */
  immediate?: boolean;
  /** Log metrics to console for debugging */
  debug?: boolean;
}

export interface NormalizedOptions {
  endpoint: string;
  sampleRate: number;
  extra: Record<string, unknown>;
  immediate: boolean;
  debug: boolean;
}

export interface MetricEntry {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

export interface ReportPayload {
  url: string;
  referrer: string;
  userAgent: string;
  timestamp: number;
  metrics: MetricEntry[];
  extra: Record<string, unknown>;
}

export type MetricName = 'LCP' | 'FCP' | 'CLS' | 'INP' | 'TTFB';

export type MetricCallback = (entry: MetricEntry) => void;

/** [good, poor] thresholds per Google's Web Vitals standards */
export const THRESHOLDS: Record<MetricName, [number, number]> = {
  LCP:  [2500, 4000],
  FCP:  [1800, 3000],
  CLS:  [0.1, 0.25],
  INP:  [200, 500],
  TTFB: [800, 1800],
};
