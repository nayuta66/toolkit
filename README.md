# Toolkit

## 简介

这是一个基于 monorepo 架构搭建的业务工具库集合，旨在提供可复用的前端解决方案。

## 工具库功能

### 接口预请求工具

该工具实现了前端接口的预请求功能，具有以下特点：

- 在编译打包阶段，自动生成预请求相关代码
- 通过 script 标签形式将生成的 JavaScript 代码注入到 HTML 的 head 部分
- 使页面加载时即可提前发起 API 请求，有效减少用户等待时间
- 优化首屏加载性能，提升用户体验

## 项目结构

```
toolkit/
├── packages/              # 工具包目录
│   └── api-prefetch/      # 接口预请求工具
│       ├── src/           # 源代码
├── examples/              # 示例项目
│   └── h5-demo/           # H5示例项目
└── lerna.json             # Lerna配置
```

## 使用方法

### 安装依赖

```bash
# 安装根项目依赖
npm install

# 安装所有子包依赖并链接相互依赖的本地包
npm run start
```

### 构建工具包

```bash
# 构建所有工具包
npm run build
```

### 使用接口预请求工具

1. 安装依赖

```bash
npm install @toolkit/api-prefetch --save
```

2. 在 webpack 配置中使用插件

```javascript
const { ApiPrefetchPlugin } = require('@toolkit/api-prefetch');

module.exports = {
  // ... 其他webpack配置
  plugins: [
    // ... 其他插件
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
      injectTo: 'head', // 'head' 或 'body'
    }),
  ],
};
```

### 配置选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| apis | Array | [] | API配置列表 |
| enabled | Boolean | true | 是否启用插件 |
| injectTo | String | 'head' | 注入位置，可选 'head' 或 'body' |

### API配置选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| url | String | - | API请求地址（必填） |
| method | String | 'GET' | 请求方法，支持 'GET' 或 'POST' |
| headers | Object | {} | 请求头 |
| body | Object/String | - | 请求体，仅在 POST 请求时有效 |
| credentials | String | 'same-origin' | 凭证策略，可选 'include', 'same-origin', 'omit' |

## 运行示例

```bash
# 进入示例项目目录
cd examples/h5-demo

# 安装依赖
npm install

# 启动开发服务器
npm start
```

## 贡献指南

欢迎提交 Issue 或 Pull Request 来帮助我们改进这个工具库。

## 许可证

MIT


