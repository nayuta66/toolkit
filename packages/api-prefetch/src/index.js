class ApiPrefetchPlugin {
  constructor(options = {}) {
    this.options = {
      apis: [],
      enabled: true,
      injectTo: 'head',
      ...options
    };
  }

  apply(compiler) {
    if (!this.options.enabled) {
      return;
    }

    compiler.hooks.compilation.tap('ApiPrefetchPlugin', (compilation) => {
      // Try to get HtmlWebpackPlugin from the compilation
      let HtmlWebpackPlugin;
      try {
        // First try to require it directly (in case it's available in the project)
        HtmlWebpackPlugin = require('html-webpack-plugin');
      } catch (e) {
        // If not found, try to find it from the webpack compiler's plugins
        const htmlPlugin = compiler.options.plugins.find(
          plugin => plugin.constructor.name === 'HtmlWebpackPlugin'
        );
        if (htmlPlugin) {
          HtmlWebpackPlugin = htmlPlugin.constructor;
        } else {
          console.error('ApiPrefetchPlugin: HtmlWebpackPlugin not found. Please ensure HtmlWebpackPlugin is added before ApiPrefetchPlugin.');
          return;
        }
      }

      HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync(
        'ApiPrefetchPlugin',
        (data, cb) => {
          const prefetchScript = this.generatePrefetchScript();
          
          if (this.options.injectTo === 'head') {
            data.html = data.html.replace(
              '</head>',
              `${prefetchScript}</head>`
            );
          } else {
            data.html = data.html.replace(
              '</body>',
              `${prefetchScript}</body>`
            );
          }
          
          cb(null, data);
        }
      );
    });
  }

  generatePrefetchScript() {
    const apis = this.options.apis;
    if (!apis || apis.length === 0) {
      return '';
    }

    const fetchCalls = apis.map(api => {
      const { url, method = 'GET', headers = {}, body, credentials = 'same-origin' } = api;
      
      const fetchOptions = {
        method,
        credentials,
        headers: { ...headers }
      };

      if (method === 'POST' && body) {
        fetchOptions.body = JSON.stringify(body);
        fetchOptions.headers['Content-Type'] = fetchOptions.headers['Content-Type'] || 'application/json';
      }

      return `
        fetch('${url}', ${JSON.stringify(fetchOptions)})
          .then(response => {
            if (!response.ok) {
              console.warn('Prefetch failed for ${url}:', response.status);
            }
          })
          .catch(error => {
            console.warn('Prefetch error for ${url}:', error);
          });
      `;
    }).join('\n');

    return `
      <script>
        (function() {
          if (typeof fetch === 'undefined') {
            console.warn('Fetch API is not supported, skipping prefetch');
            return;
          }
          ${fetchCalls}
        })();
      </script>
    `;
  }
}

module.exports = { ApiPrefetchPlugin }; 