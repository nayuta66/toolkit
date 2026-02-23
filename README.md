# Toolkit

## 简介

这是一个基于 monorepo 架构搭建的业务工具库集合，旨在提供可复用的前端解决方案。

## 工具库功能

### 接口预请求工具

该工具实现了前端接口的预请求功能，具有以下特点：

- 在编译打包阶段，自动生成预请求相关代码
- 通过 script 标签形式将生成的 JavaScript 代码注入到 HTML 中
- 使页面加载时即可提前发起 API 请求，并将响应数据缓存到 `window.__PREFETCH_CACHE__`
- 提供 `getPrefetchData()` 工具函数，应用代码可直接读取预取数据，无需重复请求
- 优化首屏加载性能，提升用户体验

## 项目结构

```
toolkit/
├── packages/              # 工具包目录
│   └── api-prefetch/      # 接口预请求工具
│       └── src/
│           ├── index.js   # Webpack 插件
│           └── client.js  # 浏览器端工具函数
├── examples/              # 示例项目
│   └── h5-demo/           # H5 示例项目
└── package.json           # 根配置（npm workspaces）
```

## 使用方法

### 安装依赖

```bash
npm install
```

npm workspaces 会自动链接本地包，无需额外操作。

### 使用接口预请求工具

1. 安装依赖

```bash
npm install @toolkit/api-prefetch --save
```

2. 在 webpack 配置中使用插件

```javascript
const { ApiPrefetchPlugin } = require('@toolkit/api-prefetch');

module.exports = {
  plugins: [
    new ApiPrefetchPlugin({
      apis: [
        { url: '/api/user', method: 'GET' },
        {
          url: '/api/data',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { id: 123 }
        }
      ],
      injectTo: 'head',
    }),
  ],
};
```

3. 在应用代码中读取预取数据

```javascript
var getPrefetchData = require('@toolkit/api-prefetch/client').getPrefetchData;

// 返回缓存的 Promise，若无缓存则返回 null
var cached = getPrefetchData('/api/user');

if (cached) {
  cached.then(function (data) {
    console.log('来自预取缓存:', data);
  });
} else {
  // 缓存未命中，正常请求
  fetch('/api/user').then(function (r) { return r.json(); });
}
```

### 插件配置选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| apis | Array | `[]` | API 配置列表 |
| enabled | Boolean | `true` | 是否启用插件 |
| injectTo | String | `'head'` | 注入位置，可选 `'head'` 或 `'body'` |
| cacheKey | String | `'__PREFETCH_CACHE__'` | 全局缓存对象的 key |

### API 配置选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| url | String | - | API 请求地址（必填） |
| method | String | `'GET'` | 请求方法 |
| headers | Object | `{}` | 请求头 |
| body | Object/String | - | 请求体（GET/HEAD 以外的方法有效） |
| credentials | String | `'same-origin'` | 凭证策略 |

### getPrefetchData 选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| cacheKey | String | `'__PREFETCH_CACHE__'` | 全局缓存对象的 key |
| timeout | Number | `5000` | 超时时间（ms），设为 `0` 禁用 |

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
