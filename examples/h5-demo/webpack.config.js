const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ApiPrefetchPlugin } = require('@toolkit/api-prefetch');

const MOCK_USERS = {
  '1': { id: 1, name: '张三', email: 'zhangsan@example.com', role: 'admin' },
  '2': { id: 2, name: '李四', email: 'lisi@example.com', role: 'user' },
  '3': { id: 3, name: '王五', email: 'wangwu@example.com', role: 'editor' },
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
      configFile: './src/prefetch.config.js',
      injectTo: 'head',
    }),
  ],
  devServer: {
    static: './dist',
    port: 8080,
    open: ['/?userId=1&token=test_tk'],
    setupMiddlewares(middlewares, devServer) {
      devServer.app.get('/api/user/info', (req, res) => {
        const uid = req.query.userId || '1';
        const token = req.query.token;
        const user = MOCK_USERS[uid] || MOCK_USERS['1'];
        setTimeout(() => res.json({ ...user, token: token || null }), 150);
      });
      devServer.app.get('/api/settings', (req, res) => {
        const version = req.query.version || '1';
        setTimeout(() => res.json({ ...MOCK_SETTINGS, version }), 100);
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
