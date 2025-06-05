const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ApiPrefetchPlugin } = require('@toolkit/api-prefetch');

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
        { 
          url: '/api/user/info', 
          method: 'GET' 
        },
        { 
          url: '/api/config', 
          method: 'GET' 
        },
        { 
          url: '/api/data', 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { page: 1, size: 10 }
        }
      ],
      injectTo: 'head',
    }),
  ],
  devServer: {
    static: './dist',
    port: 8080,
    open: true,
  },
}; 