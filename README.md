# Toolkit

## 简介

这是一个基于 monorepo 架构搭建的前端性能优化工具库集合，旨在提供可复用的前端解决方案。

## 工具包一览

| 包名 | 描述 |
|------|------|
| [`@toolkit/api-prefetch`](#接口预请求工具) | Webpack 插件，在构建时注入 API 预请求脚本 |
| [`@toolkit/perf-reporter`](#性能指标采集工具) | 轻量级 Core Web Vitals 自动采集与上报 |

## 项目结构

```
toolkit/
├── packages/
│   ├── api-prefetch/      # 接口预请求 Webpack 插件
│   │   └── src/
│   │       ├── index.ts   # 插件主体
│   │       └── client.ts  # 浏览器端工具函数
│   └── perf-reporter/     # 性能指标采集上报
│       └── src/
│           ├── index.ts   # 初始化与上报逻辑
│           ├── metrics.ts # Web Vitals 采集
│           └── types.ts   # 类型定义
├── examples/
│   └── h5-demo/           # H5 示例项目
└── package.json           # 根配置（npm workspaces）
```

## 开发

```bash
npm install              # 安装依赖 + 链接本地包
npm run build            # 构建所有工具包
npm run typecheck        # 类型检查
```

---

## 接口预请求工具

`@toolkit/api-prefetch` — 在编译打包阶段自动生成预请求代码，注入到 HTML 中，使页面加载时即可提前发起 API 请求，并将响应数据缓存到全局变量供应用代码直接读取。

### 安装

```bash
npm install @toolkit/api-prefetch --save
```

### Webpack 配置

```typescript
import { ApiPrefetchPlugin } from '@toolkit/api-prefetch';

export default {
  plugins: [
    new ApiPrefetchPlugin({
      apis: [
        { url: '/api/user', method: 'GET' },
        {
          url: '/api/data',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { id: 123 },
        },
      ],
      injectTo: 'head',
    }),
  ],
};
```

### 读取预取数据

```typescript
import { getPrefetchData } from '@toolkit/api-prefetch/client';

const cached = getPrefetchData('/api/user');

if (cached) {
  cached.then((data) => console.log('来自预取缓存:', data));
} else {
  fetch('/api/user').then((r) => r.json());
}
```

### 插件配置

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| apis | `ApiConfig[]` | `[]` | API 配置列表 |
| enabled | `boolean` | `true` | 是否启用插件 |
| injectTo | `'head' \| 'body'` | `'head'` | 注入位置 |
| cacheKey | `string` | `'__PREFETCH_CACHE__'` | 全局缓存 key |

### API 配置

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| url | `string` | — | 请求地址（必填） |
| method | `string` | `'GET'` | 请求方法 |
| headers | `Record<string, string>` | `{}` | 请求头 |
| body | `unknown` | — | 请求体（GET/HEAD 以外有效） |
| credentials | `'include' \| 'same-origin' \| 'omit'` | `'same-origin'` | 凭证策略 |

### getPrefetchData 选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| cacheKey | `string` | `'__PREFETCH_CACHE__'` | 全局缓存 key |
| timeout | `number` | `5000` | 超时时间（ms），`0` 禁用 |

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

```bash
cd examples/h5-demo
npm install
npm start
```

## 贡献指南

欢迎提交 Issue 或 Pull Request 来帮助我们改进这个工具库。

## 许可证

MIT
