import { MetricEntry, MetricName, MetricCallback, THRESHOLDS } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function onHidden(fn: () => void): () => void {
  const handler = () => {
    if (document.visibilityState === 'hidden') fn();
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}

/**
 * Track when the page was first hidden.
 * Metrics observed after the page is hidden (background tab) are unreliable.
 */
function initFirstHiddenTime(): { value: number } {
  const state = {
    value: document.visibilityState === 'hidden' ? 0 : Infinity,
  };
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState === 'hidden' && state.value === Infinity) {
        state.value = performance.now();
      }
    },
    { once: true, capture: true }
  );
  return state;
}

/**
 * For prerendered pages, activationStart marks when the user actually saw the page.
 * LCP/FCP/TTFB should be relative to this instead of navigationStart.
 */
function getActivationStart(): number {
  const nav = performance.getEntriesByType('navigation')[0] as
    PerformanceNavigationTiming & { activationStart?: number };
  return nav?.activationStart ?? 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start observing all Core Web Vitals.
 * Returns a cleanup function that disconnects all observers and listeners.
 */
export function observeMetrics(cb: MetricCallback): () => void {
  const cleanups: Array<() => void> = [];
  const firstHiddenTime = initFirstHiddenTime();

  collectTTFB(cb);
  collectFCP(cb, cleanups, firstHiddenTime);
  collectLCP(cb, cleanups, firstHiddenTime);
  collectCLS(cb, cleanups);
  collectINP(cb, cleanups);

  return () => cleanups.forEach((fn) => fn());
}

// ---------------------------------------------------------------------------
// TTFB — from navigation timing, adjusted for prerendered pages
// ---------------------------------------------------------------------------

function collectTTFB(cb: MetricCallback): void {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming & { activationStart?: number };
    if (nav?.responseStart) {
      const activationStart = nav.activationStart ?? 0;
      const value = Math.max(nav.responseStart - activationStart, 0);
      emit('TTFB', value, cb);
    }
  } catch { /* unsupported */ }
}

// ---------------------------------------------------------------------------
// FCP — only valid if page was visible when paint occurred
// ---------------------------------------------------------------------------

function collectFCP(
  cb: MetricCallback,
  cleanups: Array<() => void>,
  firstHiddenTime: { value: number }
): void {
  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          if (entry.startTime > firstHiddenTime.value) return;
          const value = Math.max(entry.startTime - getActivationStart(), 0);
          emit('FCP', value, cb);
          obs.disconnect();
        }
      }
    });
    obs.observe({ type: 'paint', buffered: true });
    cleanups.push(() => obs.disconnect());
  } catch { /* unsupported */ }
}

// ---------------------------------------------------------------------------
// LCP — finalized on first trusted user input or page hide.
// Scroll is excluded (can be programmatic).
// See: https://github.com/GoogleChrome/web-vitals/issues/75
// ---------------------------------------------------------------------------

function collectLCP(
  cb: MetricCallback,
  cleanups: Array<() => void>,
  firstHiddenTime: { value: number }
): void {
  try {
    let value = 0;
    let reported = false;

    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.startTime < firstHiddenTime.value) {
          value = Math.max(entry.startTime - getActivationStart(), 0);
        }
      }
    });
    obs.observe({ type: 'largest-contentful-paint', buffered: true });

    const report = () => {
      if (reported || value <= 0) return;
      const pending = obs.takeRecords();
      for (const entry of pending) {
        if (entry.startTime < firstHiddenTime.value) {
          value = Math.max(entry.startTime - getActivationStart(), 0);
        }
      }
      reported = true;
      obs.disconnect();
      emit('LCP', value, cb);
    };

    const inputHandler = (e: Event) => {
      if (e.isTrusted) report();
    };

    const inputTypes = ['keydown', 'click'] as const;
    inputTypes.forEach((type) => {
      addEventListener(type, inputHandler, { once: true, capture: true });
    });
    const removeHidden = onHidden(report);

    cleanups.push(() => {
      obs.disconnect();
      inputTypes.forEach((type) => {
        removeEventListener(type, inputHandler, { capture: true });
      });
      removeHidden();
    });
  } catch { /* unsupported */ }
}

// ---------------------------------------------------------------------------
// CLS — session window algorithm per https://web.dev/articles/cls
// Reports on every page hide to capture the latest value.
// ---------------------------------------------------------------------------

function collectCLS(cb: MetricCallback, cleanups: Array<() => void>): void {
  try {
    let maxSessionValue = 0;
    let currentSessionValue = 0;
    let currentSessionStart = -1;
    let previousShiftEnd = -1;
    let lastReportedValue = -1;

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

    const removeHidden = onHidden(() => {
      const pending = obs.takeRecords() as Array<PerformanceEntry & { hadRecentInput: boolean; value: number }>;
      for (const entry of pending) {
        if (entry.hadRecentInput) continue;
        const gap = entry.startTime - previousShiftEnd;
        const span = entry.startTime - currentSessionStart;
        if (currentSessionStart < 0 || gap >= 1000 || span >= 5000) {
          currentSessionValue = entry.value;
          currentSessionStart = entry.startTime;
        } else {
          currentSessionValue += entry.value;
        }
        previousShiftEnd = entry.startTime + (entry.duration || 0);
        if (currentSessionValue > maxSessionValue) {
          maxSessionValue = currentSessionValue;
        }
      }
      if (maxSessionValue > 0 && maxSessionValue !== lastReportedValue) {
        lastReportedValue = maxSessionValue;
        emit('CLS', maxSessionValue, cb);
      }
    });

    cleanups.push(() => {
      obs.disconnect();
      removeHidden();
    });
  } catch { /* unsupported */ }
}

// ---------------------------------------------------------------------------
// INP — estimates P98 of interaction durations.
// Uses durationThreshold=40 to match Chrome's 8ms rounding at 60Hz.
// Falls back to first-input for fast initial interactions.
// See: https://web.dev/articles/inp
// ---------------------------------------------------------------------------

function collectINP(cb: MetricCallback, cleanups: Array<() => void>): void {
  if (
    typeof PerformanceEventTiming === 'undefined' ||
    !('interactionId' in PerformanceEventTiming.prototype)
  ) {
    return;
  }

  try {
    const interactionMap = new Map<number, number>();
    let lastReportedValue = -1;

    const processEntries = (entries: PerformanceEntryList) => {
      for (const entry of entries) {
        const evt = entry as PerformanceEventTiming & { interactionId?: number };
        const id = evt.interactionId;
        if (!id) continue;

        const duration = evt.duration ?? 0;
        const existing = interactionMap.get(id) ?? 0;
        if (duration > existing) {
          interactionMap.set(id, duration);
        }
      }
    };

    const obs = new PerformanceObserver((list) => {
      processEntries(list.getEntries());
    });

    obs.observe({ type: 'event', buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
    obs.observe({ type: 'first-input', buffered: true });

    const removeHidden = onHidden(() => {
      processEntries(obs.takeRecords());

      if (interactionMap.size > 0) {
        const sorted = [...interactionMap.values()].sort((a, b) => b - a);
        const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.02));
        const value = sorted[idx];
        if (value !== lastReportedValue) {
          lastReportedValue = value;
          emit('INP', value, cb);
        }
      }
    });

    cleanups.push(() => {
      obs.disconnect();
      removeHidden();
    });
  } catch { /* unsupported */ }
}
