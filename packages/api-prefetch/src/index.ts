import type { Compiler } from 'webpack';
import type { ApiConfig, PrefetchConfigExport, BuildContext } from './config';
import { buildUrl } from './config';

const PLUGIN_NAME = 'ApiPrefetchPlugin';
const COLLECTOR_KEY = '__PREFETCH_COLLECTOR__';

export type { ApiConfig, BuildContext, PrefetchConfigExport } from './config';

export interface ApiPrefetchPluginOptions {
  /**
   * 需要预取的 API 列表（直接配置方式）。
   * 与 configFile 二选一；若同时提供，configFile 优先。
   */
  apis?: ApiConfig[];
  /**
   * 业务层配置文件路径。支持两种写法：
   * - 导出风格：module.exports = definePrefetchConfig([...]) 或 (ctx) => [...]
   * - 函数调用风格：直接调用 prefetch()，无需导出
   */
  configFile?: string;
  /** 是否启用插件，默认 true */
  enabled?: boolean;
  /** 预取脚本注入位置，默认 'head' */
  injectTo?: 'head' | 'body';
  /** window 上的全局缓存键名，默认 '__PREFETCH_CACHE__' */
  cacheKey?: string;
}

interface NormalizedOptions {
  apis: ApiConfig[];
  configFile?: string;
  enabled: boolean;
  injectTo: 'head' | 'body';
  cacheKey: string;
}

/**
 * Webpack 插件：在 HTML 中注入内联 <script>，于页面加载早期预取指定 API。
 *
 * 工作流程：
 * 1. 构建阶段定位业务配置文件路径
 * 2. 每个 HTML 页面产出前，加载并执行配置文件，收集该页面的 API 列表
 * 3. 生成包含 fetch 调用的内联脚本并注入 HTML <head>
 * 4. 浏览器解析 HTML 时立即执行，将 fetch Promise 存入 window 全局缓存
 * 5. 业务 JS 通过 getPrefetchData() 从缓存消费数据
 */
export class ApiPrefetchPlugin {
  private options: NormalizedOptions;
  private resolvedConfigPath: string | null = null;

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

    // 提前解析配置文件的绝对路径
    if (this.options.configFile) {
      const nodePath = require('path') as typeof import('path');
      this.resolvedConfigPath = nodePath.isAbsolute(this.options.configFile)
        ? this.options.configFile
        : nodePath.resolve(compiler.context, this.options.configFile);
    }

    const mode = compiler.options.mode || 'none';

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
        (
          data: { html: string; outputName?: string },
          cb: (err: null, data: { html: string }) => void,
        ) => {
          const entry = data.outputName || '';
          const apis = this.resolveApis(entry, mode);
          const script = this.generatePrefetchScript(apis);
          if (!script) return cb(null, data);

          const tag = this.options.injectTo === 'head' ? '</head>' : '</body>';
          data.html = data.html.replace(tag, script + tag);
          cb(null, data);
        }
      );
    });
  }

  // ---------------------------------------------------------------------------
  // 配置解析：兼容 prefetch() 函数调用风格 和 导出风格（数组/工厂函数）
  // ---------------------------------------------------------------------------

  /**
   * 解析当前页面的 API 列表。
   *
   * 优先级：
   * 1. 配置文件中 prefetch() 调用收集到的结果
   * 2. 配置文件导出的工厂函数 / 数组
   * 3. 构造函数中直接传入的 apis
   */
  private resolveApis(entry: string, mode: string): ApiConfig[] {
    if (!this.resolvedConfigPath) return this.options.apis;

    const ctx: BuildContext = {
      entry,
      mode,
      env: process.env as Record<string, string | undefined>,
    };

    // 激活收集器 → 执行配置文件 → 回收结果
    this.startCollecting(ctx);
    delete require.cache[this.resolvedConfigPath];
    let loaded: any;
    try {
      loaded = require(this.resolvedConfigPath);
    } catch (e) {
      console.error(`[${PLUGIN_NAME}] 无法加载配置文件: ${this.resolvedConfigPath}`, e);
      this.stopCollecting();
      return this.options.apis;
    }
    const collected = this.stopCollecting();

    // 优先使用 prefetch() 调用收集到的结果
    if (collected.length > 0) return collected;

    // 回退到导出风格
    const exported = loaded?.default ?? loaded;
    if (typeof exported === 'function') return exported(ctx);
    if (Array.isArray(exported)) return exported;

    return this.options.apis;
  }

  /** 在 globalThis 上挂载收集器，供 config.ts 中的 prefetch() 写入 */
  private startCollecting(ctx: BuildContext): void {
    (globalThis as any)[COLLECTOR_KEY] = { apis: [], context: ctx };
  }

  /** 回收收集到的 API 列表并清理 globalThis */
  private stopCollecting(): ApiConfig[] {
    const state = (globalThis as any)[COLLECTOR_KEY];
    delete (globalThis as any)[COLLECTOR_KEY];
    return state?.apis ?? [];
  }

  // ---------------------------------------------------------------------------
  // 脚本生成
  // ---------------------------------------------------------------------------

  private escape(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/<\/(script)/gi, '<\\/$1');
  }

  private buildFetchOpts(api: ApiConfig): string {
    const {
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

    return JSON.stringify(opts).replace(/<\/script/gi, '<\\/script');
  }

  private static readonly THEN_CLAUSE =
    `.then(function(r){if(!r.ok)return null;` +
    `var t=r.headers.get('content-type')||'';` +
    `return t.indexOf('json')>-1?r.json():r.text()})` +
    `.catch(function(){return null})`;

  private generateStaticFetch(api: ApiConfig): string {
    const fullUrl = buildUrl(api.url, api.params);
    const safeUrl = this.escape(fullUrl);
    const optsJson = this.buildFetchOpts(api);
    return (
      `c['${safeUrl}']=fetch('${safeUrl}',${optsJson})` +
      ApiPrefetchPlugin.THEN_CLAUSE
    );
  }

  private generateDynamicFetch(api: ApiConfig, idx: number): string {
    const safeBaseUrl = this.escape(api.url);
    const optsJson = this.buildFetchOpts(api);
    const u = `u${idx}`;
    const q = `q${idx}`;

    let code = `var ${u}='${safeBaseUrl}',${q}=[];`;

    if (api.params) {
      for (const [k, v] of Object.entries(api.params)) {
        code += `${q}.push('${this.escape(encodeURIComponent(k))}=`
              + `${this.escape(encodeURIComponent(String(v)))}');`;
      }
    }

    for (const name of api.queryParams!) {
      const safeName = this.escape(name);
      const encName = this.escape(encodeURIComponent(name));
      code += `if(s.has('${safeName}'))${q}.push('${encName}='`
            + `+encodeURIComponent(s.get('${safeName}')));`;
    }

    code += `if(${q}.length)${u}+=(${u}.indexOf('?')>-1?'&':'?')+${q}.join('&');`;
    code += `c[${u}]=fetch(${u},${optsJson})` + ApiPrefetchPlugin.THEN_CLAUSE;

    return code;
  }

  private generatePrefetchScript(apis: ApiConfig[]): string {
    const enabledApis = apis.filter((api) => api.enabled !== false);
    if (enabledApis.length === 0) return '';

    const hasDynamic = enabledApis.some((a) => a.queryParams?.length);

    let dynamicIdx = 0;
    const fetchCalls = enabledApis
      .map((api) =>
        api.queryParams?.length
          ? this.generateDynamicFetch(api, dynamicIdx++)
          : this.generateStaticFetch(api)
      )
      .join(';');

    const safeKey = this.escape(this.options.cacheKey);
    const preamble = hasDynamic ? `var s=new URLSearchParams(location.search);` : '';
    return (
      `<script>!function(){if(typeof fetch==='undefined')return;` +
      `var c=window['${safeKey}']=window['${safeKey}']||{};` +
      `${preamble}${fetchCalls}}()</script>`
    );
  }
}
