var prefetch = require('@toolkit/api-prefetch/config').prefetch;

prefetch('/api/user/info', { queryParams: ['userId', 'token'] });
prefetch('/api/settings', { params: { version: 2 } });
