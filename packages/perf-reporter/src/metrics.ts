import { MetricEntry, MetricName, MetricCallback, THRESHOLDS } from './types';

function rate(name: MetricName, value: number): MetricEntry['rating'] {
  const [good, poor] = THRESHOLDS[name];
  if (value <= good) return 'good';
  if (value >= poor) return 'poor';
  return 'needs-improvement';
}

function emit(name: MetricName, value: number, cb: MetricCallback): void {
  cb({
    name,
    value: name === 'CLS' ? Math.round(value * 1000) / 1000 : Math.round(value),
    rating: rate(name, value),
    timestamp: Date.now(),
  });
}

function onHidden(fn: () => void): void {
  document.addEventListener(
    'visibilitychange',
    () => { if (document.visibilityState === 'hidden') fn(); },
    { once: true }
  );
}

/**
 * Start observing all Core Web Vitals.
 * Returns a cleanup function that disconnects all observers.
 */
export function observeMetrics(cb: MetricCallback): () => void {
  const observers: PerformanceObserver[] = [];

  collectTTFB(cb);
  collectFCP(cb, observers);
  collectLCP(cb, observers);
  collectCLS(cb, observers);
  collectINP(cb, observers);

  return () => observers.forEach((o) => o.disconnect());
}

// --- TTFB ---

function collectTTFB(cb: MetricCallback): void {
  try {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (nav?.responseStart) {
      emit('TTFB', nav.responseStart, cb);
    }
  } catch { /* unsupported */ }
}

// --- FCP ---

function collectFCP(cb: MetricCallback, observers: PerformanceObserver[]): void {
  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          emit('FCP', entry.startTime, cb);
          obs.disconnect();
        }
      }
    });
    obs.observe({ type: 'paint', buffered: true });
    observers.push(obs);
  } catch { /* unsupported */ }
}

// --- LCP ---
// Finalized on first user interaction or page hide

function collectLCP(cb: MetricCallback, observers: PerformanceObserver[]): void {
  try {
    let value = 0;
    let reported = false;

    const obs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) value = last.startTime;
    });
    obs.observe({ type: 'largest-contentful-paint', buffered: true });
    observers.push(obs);

    const report = () => {
      if (reported || value <= 0) return;
      reported = true;
      obs.disconnect();
      emit('LCP', value, cb);
    };

    ['keydown', 'click', 'scroll'].forEach((type) => {
      addEventListener(type, report, { once: true, capture: true });
    });
    onHidden(report);
  } catch { /* unsupported */ }
}

// --- CLS ---
// Uses the "session window" algorithm per web.dev/cls

function collectCLS(cb: MetricCallback, observers: PerformanceObserver[]): void {
  try {
    let maxSessionValue = 0;
    let currentSessionValue = 0;
    let currentSessionStart = -1;
    let previousShiftEnd = -1;

    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (shift.hadRecentInput) continue;

        const gap = entry.startTime - previousShiftEnd;
        const span = entry.startTime - currentSessionStart;

        if (currentSessionStart < 0 || gap >= 1000 || span >= 5000) {
          currentSessionValue = shift.value;
          currentSessionStart = entry.startTime;
        } else {
          currentSessionValue += shift.value;
        }

        previousShiftEnd = entry.startTime + (entry.duration || 0);

        if (currentSessionValue > maxSessionValue) {
          maxSessionValue = currentSessionValue;
        }
      }
    });
    obs.observe({ type: 'layout-shift', buffered: true });
    observers.push(obs);

    onHidden(() => {
      if (maxSessionValue > 0) {
        emit('CLS', maxSessionValue, cb);
      }
      obs.disconnect();
    });
  } catch { /* unsupported */ }
}

// --- INP ---
// Tracks worst interaction duration (approximation of p98)

function collectINP(cb: MetricCallback, observers: PerformanceObserver[]): void {
  try {
    const interactionMap = new Map<number, number>();

    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const evt = entry as PerformanceEntry & { interactionId?: number; duration: number };
        const id = evt.interactionId;
        if (!id || evt.duration < 0) continue;

        const existing = interactionMap.get(id) ?? 0;
        if (evt.duration > existing) {
          interactionMap.set(id, evt.duration);
        }
      }
    });

    obs.observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
    observers.push(obs);

    onHidden(() => {
      if (interactionMap.size > 0) {
        const sorted = [...interactionMap.values()].sort((a, b) => b - a);
        const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.02));
        emit('INP', sorted[idx], cb);
      }
      obs.disconnect();
    });
  } catch { /* unsupported */ }
}
