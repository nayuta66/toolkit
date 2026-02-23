const { prefetch, getContext } = require('@toolkit/api-prefetch/config');

const { entry, mode } = getContext();

// 所有页面：预取配置接口
prefetch('/api/settings', { params: { version: 2 } });

// 仅首页：预取用户信息（从页面 URL 取 userId、token）
if (entry === 'index.html' || !entry) {
  prefetch('/api/user/info', { queryParams: ['userId', 'token'] });
}

// 仅生产环境：预取 feature flags
if (mode === 'production') {
  prefetch('/api/feature-flags');
}
