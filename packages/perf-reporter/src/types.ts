export interface PerfReporterOptions {
  /** 指标上报的目标 URL */
  endpoint: string;
  /** 采样率，取值 0 到 1，默认 1（100%） */
  sampleRate?: number;
  /** 附加到每次上报的额外维度信息 */
  extra?: Record<string, unknown>;
  /** 立即上报每个指标，而非在页面隐藏时批量上报 */
  immediate?: boolean;
  /** 在控制台打印指标，用于调试 */
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

/** 基于 Google Web Vitals 标准的 [good, poor] 阈值 */
export const THRESHOLDS: Record<MetricName, [number, number]> = {
  LCP:  [2500, 4000],
  FCP:  [1800, 3000],
  CLS:  [0.1, 0.25],
  INP:  [200, 500],
  TTFB: [800, 1800],
};
