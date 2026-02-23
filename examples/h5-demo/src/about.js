var getPrefetchData = require('@toolkit/api-prefetch/client').getPrefetchData;
var buildUrl = require('@toolkit/api-prefetch/client').buildUrl;

// ---------------------------------------------------------------------------
// UI 工具函数
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

function setResult(id, text, fromCache) {
  var el = document.getElementById(id);
  el.className = 'value good';
  var tag = fromCache
    ? '<span class="source-tag from-cache">prefetch cache</span>'
    : '<span class="source-tag from-fetch">normal fetch</span>';
  el.innerHTML = text + tag;
}

// ---------------------------------------------------------------------------
// 耗时对比 — 渲染每一行和汇总
// ---------------------------------------------------------------------------

var timingSaved = [];

function renderTimingRow(url, prefetchMs, fetchMs) {
  var saved = fetchMs - prefetchMs;
  timingSaved.push(saved);

  var cls = saved > 0 ? 'saved-positive' : 'saved-zero';

  var row = document.createElement('div');
  row.className = 'timing-row';
  row.innerHTML =
    '<span class="col-url">' + url + '</span>' +
    '<span class="col-prefetch">' + prefetchMs + ' ms</span>' +
    '<span class="col-fetch">' + fetchMs + ' ms</span>' +
    '<span class="col-saved ' + cls + '">' +
      (saved > 0 ? '-' : '') + Math.abs(saved) + ' ms' +
    '</span>';

  document.getElementById('timing-rows').appendChild(row);
}

function renderTimingSummary() {
  var total = timingSaved.reduce(function (a, b) { return a + b; }, 0);
  var summaryEl = document.getElementById('timing-summary');
  summaryEl.style.display = 'block';
  summaryEl.textContent =
    '本页共 ' + timingSaved.length + ' 个接口预取，总计节省约 ' + total + ' ms';
}

// ---------------------------------------------------------------------------
// API 加载 + 耗时对比
// ---------------------------------------------------------------------------

log('关于页启动');

/**
 * 加载 API 并进行耗时对比。
 * 路径 1：消费预取缓存；路径 2：全新 fetch 作为基准对照。
 */
function loadApi(url, elId, params) {
  var fullUrl = buildUrl(url, params);
  var start = performance.now();

  var prefetched = getPrefetchData(url, { params: params });
  var fromCache = !!prefetched;

  var prefetchPromise = (prefetched || fetch(fullUrl).then(function (r) { return r.json(); }))
    .then(function (data) {
      var elapsed = Math.round(performance.now() - start);
      return { data: data, ms: elapsed };
    });

  var benchStart = performance.now();
  var benchPromise = fetch(fullUrl)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var elapsed = Math.round(performance.now() - benchStart);
      return { data: data, ms: elapsed };
    });

  return Promise.all([prefetchPromise, benchPromise]).then(function (results) {
    var prefetchResult = results[0];
    var benchResult = results[1];
    var data = prefetchResult.data;

    if (data) {
      var preview = JSON.stringify(data).substring(0, 80);
      setResult(elId, preview, fromCache);
    }

    renderTimingRow(fullUrl, prefetchResult.ms, benchResult.ms);

    var saved = benchResult.ms - prefetchResult.ms;
    log(
      fullUrl + ' &rarr; ' +
      (fromCache ? '<b>预取</b> ' : 'fetch ') + prefetchResult.ms + 'ms' +
      ' | 基准 ' + benchResult.ms + 'ms' +
      ' | <b style="color:#1e8e3e">节省 ' + saved + 'ms</b>'
    );

    return { data: data, fromCache: fromCache };
  });
}

Promise.all([
  loadApi('/api/about', 'api-about'),
  loadApi('/api/settings', 'api-settings', { version: 2 }),
]).then(function () {
  renderTimingSummary();
});
