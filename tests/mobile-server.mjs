// Local-only fault injection against the actual production bundle. This server
// is not included in dist/ and cannot enable test faults on the public site.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve('dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:5174');
  const referer = new URL(request.headers.referer || url);
  const page = url.pathname === '/' || url.pathname === '/index.html';
  const requestedFault = url.searchParams.get('fault') || (!page && referer.searchParams.get('fault'));
  const fault = ['asset', 'bundle', 'no-webgl', 'context-loading', 'context-ready'].includes(requestedFault) ? requestedFault : null;
  const path = resolve(root, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
  if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  if ((fault === 'asset' && (path.endsWith('aero-glass-interiors.png') || path.endsWith('maple-leaf.png'))) || (fault === 'bundle' && /[\\/]main-[^\\/]+\.js$/.test(path))) {
    response.writeHead(503).end('Deliberate regression-test failure'); return;
  }
  try {
    let body = await readFile(path);
    if (extname(path) === '.html') {
      const script = `
        Object.defineProperty(window, 'devicePixelRatio', { value: 3 });
        const fault = ${JSON.stringify(fault)};
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
          if (fault === 'no-webgl' && kind === 'webgl2') return null;
          const context = original.call(this, kind, ...args);
          if (kind === 'webgl2' && context && !this.dataset.faultBound) {
            this.dataset.faultBound = 'true';
            if (fault === 'context-loading') setTimeout(() => context.getExtension('WEBGL_lose_context').loseContext(), 100);
            if (fault === 'context-ready') {
              const observer = new MutationObserver(() => {
                if (document.querySelector('#loading').dataset.state === 'ready') {
                  observer.disconnect(); context.getExtension('WEBGL_lose_context').loseContext();
                }
              });
              observer.observe(document.querySelector('#loading'), { attributes: true });
            }
          }
          return context;
        };
      `;
      body = body.toString().replace('<head>', `<head><script>${script}</script>`);
    }
    response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(5174, '127.0.0.1', () => console.log('Mobile regression fixture: http://127.0.0.1:5174/?quality=mobile (fault=asset|bundle|no-webgl|context-loading|context-ready)'));
