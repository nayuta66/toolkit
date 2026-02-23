import type { Compiler } from 'webpack';

const PLUGIN_NAME = 'ApiPrefetchPlugin';

export interface ApiConfig {
  /** API 端点 URL（必填） */
  url: string;
  /** HTTP 方法，默认 'GET' */
  method?: string;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求体（GET/HEAD 请求时忽略） */
  body?: unknown;
  /** 凭证策略，默认 'same-origin' */
  credentials?: 'include' | 'same-origin' | 'omit';
}

export interface ApiPrefetchPluginOptions {
  /** 需要预取的 API 列表 */
  apis?: ApiConfig[];
  /** 是否启用插件，默认 true */
  enabled?: boolean;
  /** 预取脚本注入位置，默认 'head' */
  injectTo?: 'head' | 'body';
  /** window 上的全局缓存键名，默认 '__PREFETCH_CACHE__' */
  cacheKey?: string;
}

interface NormalizedOptions {
  apis: ApiConfig[];
  enabled: boolean;
  injectTo: 'head' | 'body';
  cacheKey: string;
}

export class ApiPrefetchPlugin {
  private options: NormalizedOptions;

  constructor(options: ApiPrefetchPluginOptions = {}) {
    this.options = {
      apis: [],
      enabled: true,
      injectTo: 'head',
      cacheKey: '__PREFETCH_CACHE__',
      ...options,
    };
  }

  apply(compiler: Compiler): void {
    if (!this.options.enabled) return;

    let HtmlWebpackPlugin: any;
    try {
      const resolved = require.resolve('html-webpack-plugin', {
        paths: [compiler.context],
      });
      HtmlWebpackPlugin = require(resolved);
    } catch {
      console.error(
        `[${PLUGIN_NAME}] html-webpack-plugin is required as a peer dependency.`
      );
      return;
    }

    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync(
        PLUGIN_NAME,
        (data: { html: string }, cb: (err: null, data: { html: string }) => void) => {
          const script = this.generatePrefetchScript();
          if (!script) return cb(null, data);

          const tag = this.options.injectTo === 'head' ? '</head>' : '</body>';
          data.html = data.html.replace(tag, script + tag);
          cb(null, data);
        }
      );
    });
  }

  private escape(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/<\/(script)/gi, '<\\/$1');
  }

  private generatePrefetchScript(): string {
    const { apis, cacheKey } = this.options;
    if (apis.length === 0) return '';

    const fetchCalls = apis
      .map((api) => {
        const {
          url,
          method = 'GET',
          headers = {},
          body,
          credentials = 'same-origin',
        } = api;

        const opts: Record<string, unknown> = {
          method,
          credentials,
          headers: { ...headers },
        };

        if (body && method !== 'GET' && method !== 'HEAD') {
          opts.body = JSON.stringify(body);
          const h = opts.headers as Record<string, string>;
          if (!h['Content-Type']) {
            h['Content-Type'] = 'application/json';
          }
        }

        const safeUrl = this.escape(url);
        const optsJson = JSON.stringify(opts).replace(/<\/script/gi, '<\\/script');

        return (
          `c['${safeUrl}']=fetch('${safeUrl}',${optsJson})` +
          `.then(function(r){if(!r.ok)return null;` +
          `var t=r.headers.get('content-type')||'';` +
          `return t.indexOf('json')>-1?r.json():r.text()})` +
          `.catch(function(){return null})`
        );
      })
      .join(';');

    const safeKey = this.escape(cacheKey);
    return (
      `<script>!function(){if(typeof fetch==='undefined')return;` +
      `var c=window['${safeKey}']=window['${safeKey}']||{};` +
      `${fetchCalls}}()</script>`
    );
  }
}
