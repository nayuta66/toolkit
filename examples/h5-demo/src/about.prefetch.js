var prefetch = require('@toolkit/api-prefetch/config').prefetch;

prefetch('/api/about');
prefetch('/api/settings', { params: { version: 2 } });
