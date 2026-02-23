const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ApiPrefetchPlugin } = require('@toolkit/api-prefetch');

const MOCK_USER = {
  id: 1,
  name: '张三',
  email: 'zhangsan@example.com',
  role: 'admin',
};

const MOCK_SETTINGS = {
  theme: 'light',
  language: 'zh-CN',
  notifications: true,
};

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
    }),
    new ApiPrefetchPlugin({
      apis: [
        { url: '/api/user/info', method: 'GET' },
        { url: '/api/settings', method: 'GET' },
      ],
      injectTo: 'head',
    }),
  ],
  devServer: {
    static: './dist',
    port: 8080,
    open: true,
    setupMiddlewares(middlewares, devServer) {
      devServer.app.get('/api/user/info', (_req, res) => {
        setTimeout(() => res.json(MOCK_USER), 150);
      });
      devServer.app.get('/api/settings', (_req, res) => {
        setTimeout(() => res.json(MOCK_SETTINGS), 100);
      });
      devServer.app.post('/api/metrics', (req, res) => {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          console.log('\n📊 [Metrics Received]');
          try {
            const data = JSON.parse(body);
            data.metrics.forEach((m) => {
              const icon = m.rating === 'good' ? '✅' : m.rating === 'poor' ? '❌' : '⚠️';
              console.log(`   ${icon} ${m.name}: ${m.value} (${m.rating})`);
            });
          } catch { /* ignore */ }
          res.json({ ok: true });
        });
      });
      return middlewares;
    },
  },
};
