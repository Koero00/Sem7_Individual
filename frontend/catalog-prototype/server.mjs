import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const port = Number(process.env.PORT || 5173);
const prototype = process.env.NODE_ENV !== 'production';
const files = new Map([
  ['/prototype/catalog', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);

createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/') {
    res.writeHead(302, { Location: '/prototype/catalog?variant=A' }).end();
    return;
  }
  if (path === '/favicon.ico') {
    res.writeHead(204).end();
    return;
  }
  const file = files.get(path);
  if (!file) {
    res.writeHead(404).end('Not found');
    return;
  }
  try {
    let content = await readFile(new URL(file[0], import.meta.url), 'utf8');
    if (file[0] === 'index.html') content = content.replace('data-prototype="true"', `data-prototype="${prototype}"`);
    res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store' }).end(content);
  } catch {
    res.writeHead(500).end('Could not read prototype files.');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Catalog prototype: http://localhost:${port}/prototype/catalog?variant=A`);
});
