# Toolkit

## 简介

基于 monorepo 架构的前端性能优化工具库集合，提供可复用的页面加载加速方案。

## 工具包一览

| 包名 | 描述 |
|------|------|
| [`@toolkit/api-prefetch`](#接口预请求工具) | Webpack 插件 — 构建时注入内联脚本，页面加载阶段即可预取 API |
| [`@toolkit/perf-reporter`](#性能指标采集工具) | 轻量级 Core Web Vitals 自动采集与上报 |

## 项目结构

```
toolkit/
├── packages/
│   ├── api-prefetch/          # 接口预请求 Webpack 插件
│   │   └── src/
│   │       ├── index.ts       # 插件主体（构建阶段）
│   │       ├── client.ts      # 浏览器端消费函数
│   │       └── config.ts      # 配置辅助函数 & 类型定义
│   └── perf-reporter/         # 性能指标采集上报
│       └── src/
│           ├── index.ts       # 初始化与上报逻辑
│           ├── metrics.ts     # Web Vitals 采集
│           └── types.ts       # 类型定义
├── examples/
│   └── h5-demo/               # MPA 示例项目
│       └── src/
│           ├── index.html             # 首页模板
│           ├── index.js               # 首页脚本
│           ├── index.prefetch.js      # 首页预取配置
│           ├── about.html             # 关于页模板
│           ├── about.js               # 关于页脚本
│           └── about.prefetch.js      # 关于页预取配置
└── package.json               # 根配置（npm workspaces）
```

## 开发

```bash
npm install              # 安装依赖 + 链接本地包
npm run build            # 构建所有工具包
npm run typecheck        # 类型检查
```

---

## 接口预请求工具

`@toolkit/api-prefetch` — 在构建阶段根据业务配置自动生成预请求代码，以内联 `<script>` 注入 HTML `<head>`。浏览器解析 HTML 时就立即发起 API 请求，将 fetch Promise 缓存到 `window.__PREFETCH_CACHE__`，业务 JS 加载后直接从缓存消费数据，节省网络等待时间。

### 工作原理

```
HTML 解析阶段                            JS 执行阶段
┌────────────────────────┐     ┌──────────────────────────────┐
│ <head>                 │     │ 业务代码调用                 │
│   <script>             │     │ getPrefetchData('/api/user') │
│     fetch('/api/user') │────►│   ↓ 命中缓存 → 0ms 等待     │
│     → 存入全局缓存     │     │   ↓ 未命中   → 降级 fetch   │
│   </script>            │     │                              │
│ </head>                │     └──────────────────────────────┘
└────────────────────────┘
```

1. **构建阶段**：插件加载业务配置文件，收集需要预取的 API 列表，生成内联 `<script>` 注入 HTML
2. **HTML 解析阶段**：浏览器解析到 `<head>` 中的内联脚本时立即执行 `fetch()`，将 Promise 写入 `window.__PREFETCH_CACHE__`
3. **JS 执行阶段**：业务代码通过 `getPrefetchData()` 读取缓存，命中则直接消费（接近 0ms），未命中则降级为普通 fetch

### 安装

```bash
npm install @toolkit/api-prefetch --save
```

### 模块导出

| 导入路径 | 用途 |
|----------|------|
| `@toolkit/api-prefetch` | Webpack 插件（构建阶段使用） |
| `@toolkit/api-prefetch/client` | 浏览器端函数：`getPrefetchData`、`buildUrl` |
| `@toolkit/api-prefetch/config` | 配置辅助函数：`prefetch`、`getContext`、`definePrefetchConfig`、`buildUrl` |

### 快速开始

#### 1. 编写预取配置文件

使用函数调用风格，直接声明需要预取的 API：

```js
// src/index.prefetch.js
const { prefetch } = require('@toolkit/api-prefetch/config');

prefetch('/api/user/info', { queryParams: ['userId', 'token'] });
prefetch('/api/settings', { params: { version: 2 } });
```

也可以使用导出风格：

```js
// src/index.prefetch.js
const { definePrefetchConfig } = require('@toolkit/api-prefetch/config');

module.exports = definePrefetchConfig((ctx) => [
  { url: '/api/user/info', queryParams: ['userId', 'token'] },
  { url: '/api/settings', params: { version: 2 } },
]);
```

#### 2. Webpack 配置

```js
const { ApiPrefetchPlugin } = require('@toolkit/api-prefetch');

module.exports = {
  plugins: [
    new HtmlWebpackPlugin({ template: './src/index.html' }),
    new ApiPrefetchPlugin({
      configFile: './src/index.prefetch.js',
      injectTo: 'head',
    }),
  ],
};
```

#### 3. 业务代码消费数据

```js
const { getPrefetchData, buildUrl } = require('@toolkit/api-prefetch/client');

const cached = getPrefetchData('/api/user/info', {
  params: { userId: '1', token: 'xxx' },
});

if (cached) {
  cached.then((data) => renderUser(data));
} else {
  fetch(buildUrl('/api/user/info', { userId: '1', token: 'xxx' }))
    .then((r) => r.json())
    .then((data) => renderUser(data));
}
```

### MPA 多页面应用

每个页面可以拥有独立的预取配置，通过对象映射 HTML 输出文件名到对应的配置文件：

```js
new ApiPrefetchPlugin({
  configFile: {
    'index.html': './src/index.prefetch.js',
    'about.html': './src/about.prefetch.js',
  },
  injectTo: 'head',
})
```

命名约定建议：`[页面名].prefetch.js`（如 `index.prefetch.js`、`about.prefetch.js`）。

### 动态 URL 参数

通过 `queryParams` 声明需要从页面 URL 中动态提取的参数。内联脚本会在运行时读取 `location.search` 拼接到请求 URL 上：

```js
// 配置文件
prefetch('/api/user/info', { queryParams: ['userId', 'token'] });
```

访问 `/?userId=1&token=abc` 时，实际请求为 `/api/user/info?userId=1&token=abc`。

业务代码消费时需传入相同参数以匹配缓存键：

```js
const userId = new URLSearchParams(location.search).get('userId');
getPrefetchData('/api/user/info', { params: { userId, token: 'abc' } });
```

### 构建上下文

配置文件可通过 `getContext()` 获取构建上下文，按条件决定预取策略：

```js
const { prefetch, getContext } = require('@toolkit/api-prefetch/config');
const { entry, mode, env } = getContext();

prefetch('/api/settings');

if (entry === 'index.html') {
  prefetch('/api/user/info', { queryParams: ['userId'] });
}

if (mode === 'production') {
  prefetch('/api/config', { params: { env: 'prod' } });
}
```

### 插件配置项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| configFile | `string \| Record<string, string>` | — | 预取配置文件路径，字符串为全局共用，对象为 MPA 按页面映射 |
| apis | `ApiConfig[]` | `[]` | 直接传入 API 列表（与 configFile 二选一，configFile 优先） |
| enabled | `boolean` | `true` | 是否启用插件 |
| injectTo | `'head' \| 'body'` | `'head'` | 内联脚本注入位置 |
| cacheKey | `string` | `'__PREFETCH_CACHE__'` | window 上的全局缓存键名 |

### ApiConfig

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| url | `string` | — | API 端点地址（必填） |
| method | `string` | `'GET'` | HTTP 方法 |
| headers | `Record<string, string>` | `{}` | 请求头 |
| body | `unknown` | — | 请求体（GET/HEAD 以外有效） |
| credentials | `'include' \| 'same-origin' \| 'omit'` | `'same-origin'` | 凭证策略 |
| params | `Record<string, string \| number \| boolean>` | — | 构建时已知的静态查询参数 |
| queryParams | `string[]` | — | 运行时从页面 URL 提取的动态参数名列表 |
| enabled | `boolean` | `true` | 是否启用该 API 的预取 |

### getPrefetchData

```ts
function getPrefetchData<T>(url: string, options?: GetPrefetchDataOptions): Promise<T | null> | null
```

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| cacheKey | `string` | `'__PREFETCH_CACHE__'` | 全局缓存键名 |
| timeout | `number` | `5000` | 超时时间（ms），`0` 禁用 |
| params | `Record<string, string \| number \| boolean>` | — | 查询参数，用于构造缓存键以匹配插件生成的 URL |

返回值：命中缓存返回 `Promise<T | null>`，未命中返回 `null`（调用方应降级为普通 fetch）。

### 配置辅助函数

| 函数 | 说明 |
|------|------|
| `prefetch(url, options?)` | 声明一个预取 API（函数调用风格，无需 module.exports） |
| `getContext()` | 获取构建上下文 `{ entry, mode, env }` |
| `definePrefetchConfig(input)` | 定义配置（导出风格，支持数组或工厂函数） |
| `buildUrl(url, params?)` | 将 params 序列化拼接到 URL，插件和客户端共用以保证缓存键一致 |

---

## 性能指标采集工具

`@toolkit/perf-reporter` — 自动采集 Core Web Vitals（LCP、FCP、CLS、INP、TTFB），在页面隐藏时通过 `sendBeacon` 上报到指定端点。

### 安装

```bash
npm install @toolkit/perf-reporter --save
```

### 基本用法

```typescript
import { initPerfReporter } from '@toolkit/perf-reporter';

const teardown = initPerfReporter({
  endpoint: '/api/metrics',
  sampleRate: 0.5,            // 50% 采样
  extra: { page: 'home' },    // 自定义维度
  debug: true,                // 控制台输出指标
});

// 页面卸载前自动上报，也可手动停止：
// teardown();
```

### 自定义指标

```typescript
import { reportMetric } from '@toolkit/perf-reporter';

const start = performance.now();
await loadData();
reportMetric('data-load-time', performance.now() - start);
```

### 上报数据格式

```json
{
  "url": "https://example.com/home",
  "referrer": "",
  "userAgent": "Mozilla/5.0 ...",
  "timestamp": 1708700000000,
  "metrics": [
    { "name": "LCP", "value": 1823, "rating": "good", "timestamp": 1708700000000 },
    { "name": "CLS", "value": 0.05, "rating": "good", "timestamp": 1708700000000 }
  ],
  "extra": { "page": "home" }
}
```

### 配置选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| endpoint | `string` | — | 上报地址（必填） |
| sampleRate | `number` | `1` | 采样率 0~1 |
| extra | `Record<string, unknown>` | `{}` | 附加到每次上报的自定义数据 |
| immediate | `boolean` | `false` | 每个指标立即上报（否则批量在页面隐藏时上报） |
| debug | `boolean` | `false` | 在控制台输出采集到的指标 |

### 采集的指标与评级标准

| 指标 | 含义 | Good | Poor |
|------|------|------|------|
| LCP | 最大内容渲染时间 | ≤ 2500ms | ≥ 4000ms |
| FCP | 首次内容渲染时间 | ≤ 1800ms | ≥ 3000ms |
| CLS | 累积布局偏移 | ≤ 0.1 | ≥ 0.25 |
| INP | 交互到下一帧延迟 | ≤ 200ms | ≥ 500ms |
| TTFB | 首字节响应时间 | ≤ 800ms | ≥ 1800ms |

---

## 运行示例

示例项目是一个多页面应用（MPA），包含首页和关于页，每个页面有独立的预取配置。页面上会展示每个接口「预取 vs 普通 fetch」的耗时对比。

```bash
cd examples/h5-demo
npm install
npm start
# 浏览器自动打开 http://localhost:8080/?userId=1&token=test_tk
```

### 示例页面

- **首页** (`index.html`)：预取 `/api/user/info` 和 `/api/settings`，展示耗时对比 + Web Vitals 指标
- **关于页** (`about.html`)：预取 `/api/about` 和 `/api/settings`，展示耗时对比

两个页面互有导航链接，可对比不同页面的预取效果。

## 贡献指南

欢迎提交 Issue 或 Pull Request 来帮助我们改进这个工具库。

## 许可证

MIT
