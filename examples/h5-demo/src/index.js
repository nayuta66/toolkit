var getPrefetchData = require('@toolkit/api-prefetch/client').getPrefetchData;
var perfReporter = require('@toolkit/perf-reporter');

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

var logEl = document.getElementById('log');

function log(msg) {
  var time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  var entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = '<span class="time">' + time + '</span>' + msg;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function setApiResult(id, text, fromCache) {
  var el = document.getElementById(id);
  el.className = 'value good';
  var tag = fromCache
    ? '<span class="source-tag from-cache">prefetch cache</span>'
    : '<span class="source-tag from-fetch">normal fetch</span>';
  el.innerHTML = text + tag;
}

function renderUserInfo(data) {
  var container = document.getElementById('user-info');
  if (!data) {
    container.innerHTML = '<div class="row"><span class="label">No data</span></div>';
    return;
  }
  container.innerHTML = Object.keys(data).map(function (key) {
    return '<div class="row"><span class="label">' + key + '</span><span class="value">' + data[key] + '</span></div>';
  }).join('');
}

function updateMetricUI(name, value, rating) {
  var el = document.getElementById('metric-' + name);
  if (!el) return;
  var unit = name === 'CLS' ? '' : ' ms';
  el.textContent = value + unit;
  el.className = 'value ' + rating;
}

// ---------------------------------------------------------------------------
// 1. API Prefetch demo
// ---------------------------------------------------------------------------

log('App started');

function loadApi(url, elId) {
  var prefetched = getPrefetchData(url);
  var fromCache = !!prefetched;

  var promise = prefetched
    ? prefetched
    : fetch(url).then(function (r) { return r.json(); });

  return promise.then(function (data) {
    if (data) {
      var preview = JSON.stringify(data).substring(0, 60);
      setApiResult(elId, preview, fromCache);
      log(url + ' &rarr; ' + (fromCache ? '<b>hit prefetch cache</b>' : 'normal fetch'));
    }
    return { data: data, fromCache: fromCache };
  }).catch(function (err) {
    log(url + ' error: ' + err.message);
    return { data: null, fromCache: false };
  });
}

loadApi('/api/user/info', 'api-user').then(function (result) {
  renderUserInfo(result.data);
});
loadApi('/api/settings', 'api-settings');

// ---------------------------------------------------------------------------
// 2. Perf Reporter demo
// ---------------------------------------------------------------------------

var teardown = perfReporter.initPerfReporter({
  endpoint: '/api/metrics',
  sampleRate: 1,
  debug: true,
  immediate: true,
  extra: { page: 'h5-demo', version: '1.0.0' },
});

log('perf-reporter initialized');

var lastSeen = {};

var pollTimer = setInterval(function () {
  var metrics = perfReporter.getMetrics();
  metrics.forEach(function (m) {
    var key = m.name + ':' + m.value;
    if (lastSeen[m.name] !== key) {
      var isUpdate = !!lastSeen[m.name];
      lastSeen[m.name] = key;
      updateMetricUI(m.name, m.value, m.rating);
      log(
        (isUpdate ? '(updated) ' : '') +
        m.name + ': ' + m.value + (m.name === 'CLS' ? '' : ' ms') +
        ' (' + m.rating + ')'
      );
    }
  });
}, 300);

// ---------------------------------------------------------------------------
// 3. Interactive button for INP testing
// ---------------------------------------------------------------------------

document.getElementById('btn-interact').addEventListener('click', function () {
  var start = performance.now();
  var sum = 0;
  for (var i = 0; i < 3e6; i++) sum += Math.random();
  var elapsed = Math.round(performance.now() - start);

  document.getElementById('btn-result').textContent =
    'Blocked ' + elapsed + 'ms (now switch tab to see INP)';

  perfReporter.reportMetric('click-block-time', elapsed);
  log('Button clicked, blocked main thread for ' + elapsed + 'ms');
});

window.addEventListener('beforeunload', function () {
  clearInterval(pollTimer);
  if (teardown) teardown();
});
