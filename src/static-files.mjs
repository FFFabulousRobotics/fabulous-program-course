import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { error } from './http-response.mjs';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png'
};
export async function serveStatic(req, res, url, publicDir) {
  if (!['GET', 'HEAD'].includes(req.method))
    throw error(405, '不支持的请求方法');
  const pathname =
    url.pathname === '/course-assets/image1.jpg'
      ? '/course-assets/fffabulous-19726.jpg'
      : url.pathname;
  const path = resolve(
    publicDir,
    '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname)
  );
  if (!path.startsWith(publicDir + sep)) throw error(403, '路径不可访问');
  const library = url.pathname.startsWith('/pdfjs/');
  const brotli =
    library && /\bbr\b/.test(req.headers['accept-encoding'] || '')
      ? await readFile(path + '.br').catch(() => null)
      : null;
  const content =
    brotli ||
    (await readFile(path).catch(() => {
      throw error(404, '页面不存在');
    }));
  res.writeHead(200, {
    'Content-Type': mime[extname(path)] || 'application/octet-stream',
    ...(brotli ? { 'Content-Encoding': 'br' } : {}),
    ...(library ? { Vary: 'Accept-Encoding' } : {}),
    'Cache-Control': library
      ? 'public, max-age=31536000, immutable'
      : 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; worker-src 'self'; font-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'self'"
  });
  res.end(req.method === 'HEAD' ? undefined : content);
}
