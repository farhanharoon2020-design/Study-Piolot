// Local frontend server. Supabase remains the database, Auth, Storage, and AI backend.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.argv[2] || 5500);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error('Choose a port between 1024 and 65535.');
  process.exit(1);
}
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed'); return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end('Invalid URL'); return; }
  if (pathname === '/') pathname = '/index.html';
  // Serve frontend files only; deployment sources and local tooling stay private.
  const allowed = /^\/[a-z0-9-]+\.html$/i.test(pathname) || /^\/(?:css|js)\/[a-z0-9._/-]+$/i.test(pathname);
  const target = path.resolve(root, '.' + pathname);
  if (!allowed || !target.startsWith(root + path.sep) || pathname.split('/').includes('..')) {
    res.writeHead(404).end('Not found'); return;
  }
  fs.stat(target, (error, info) => {
    if (error || !info.isFile()) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream',
      'Content-Length': info.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(target);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is already in use. Close the other local server, or run: node tools/serve.cjs 5501`
    : `Could not start the local server: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`StudyPilot is ready: http://127.0.0.1:${port}/login.html`);
  console.log('Open that link in your browser. Internet is required for Supabase and Gemini.');
  console.log('Press Ctrl+C to stop.');
});
