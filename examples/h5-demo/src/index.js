var getPrefetchData = require('@toolkit/api-prefetch/client').getPrefetchData;
var buildUrl = require('@toolkit/api-prefetch/client').buildUrl;
var perfReporter = require('@toolkit/perf-reporter');

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
    container.innerHTML = '<div class="row"><span class="label">暂无数据</span></div>';
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
// 从页面 URL 提取参数
// ---------------------------------------------------------------------------

var urlParams = new URLSearchParams(location.search);

function getUrlParam(name, fallback) {
  return urlParams.get(name) || fallback;
}

// ---------------------------------------------------------------------------
// 1. API Prefetch 演示
// ---------------------------------------------------------------------------

log('应用启动，页面参数: ' + location.search);

/**
 * 通用数据加载函数。
 * 优先从预取缓存中获取数据，未命中则降级为普通 fetch。
 *
 * @param {string} url     - 基础 URL
 * @param {string} elId    - 用于展示结果的 DOM 元素 id
 * @param {object} [params] - 查询参数（与 prefetch.config.js 中声明的 queryParams 对应）
 */
function loadApi(url, elId, params) {
  var prefetched = getPrefetchData(url, { params: params });
  var fromCache = !!prefetched;

  var fullUrl = buildUrl(url, params);
  var promise = prefetched
    ? prefetched
    : fetch(fullUrl).then(function (r) { return r.json(); });

  return promise.then(function (data) {
    if (data) {
      var preview = JSON.stringify(data).substring(0, 80);
      setApiResult(elId, preview, fromCache);
      log(fullUrl + ' &rarr; ' + (fromCache ? '<b>命中预取缓存</b>' : '普通 fetch'));
    }
    return { data: data, fromCache: fromCache };
  }).catch(function (err) {
    log(fullUrl + ' 错误: ' + err.message);
    return { data: null, fromCache: false };
  });
}

// /api/user/info —— queryParams 从 URL 取 userId、token
loadApi('/api/user/info', 'api-user', {
  userId: getUrlParam('userId', '1'),
  token: getUrlParam('token', ''),
}).then(function (result) {
  renderUserInfo(result.data);
});

// /api/settings —— 静态 params（与 prefetch.config.js 中 params 一致即可命中）
loadApi('/api/settings', 'api-settings', { version: 2 });

// ---------------------------------------------------------------------------
// 2. Perf Reporter 演示
// ---------------------------------------------------------------------------

var teardown = perfReporter.initPerfReporter({
  endpoint: '/api/metrics',
  sampleRate: 1,
  debug: true,
  immediate: true,
  extra: { page: 'h5-demo', version: '1.0.0' },
});

log('perf-reporter 已初始化');

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
        (isUpdate ? '(更新) ' : '') +
        m.name + ': ' + m.value + (m.name === 'CLS' ? '' : ' ms') +
        ' (' + m.rating + ')'
      );
    }
  });
}, 300);

// ---------------------------------------------------------------------------
// 3. 交互测试按钮（用于 INP 指标）
// ---------------------------------------------------------------------------

document.getElementById('btn-interact').addEventListener('click', function () {
  var start = performance.now();
  var sum = 0;
  for (var i = 0; i < 3e6; i++) sum += Math.random();
  var elapsed = Math.round(performance.now() - start);

  document.getElementById('btn-result').textContent =
    '阻塞了 ' + elapsed + 'ms（切换标签页可查看 INP）';

  perfReporter.reportMetric('click-block-time', elapsed);
  log('按钮点击，主线程阻塞 ' + elapsed + 'ms');
});

window.addEventListener('beforeunload', function () {
  clearInterval(pollTimer);
  if (teardown) teardown();
});
