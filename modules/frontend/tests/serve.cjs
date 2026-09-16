const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const frontendPath = path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.map': 'application/json', '.ico': 'image/x-icon' };

http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
    catch { response.writeHead(400).end('Invalid URL'); return; }
    if (pathname === '/') pathname = '/index.html';
    const filename = path.resolve(frontendPath, `.${pathname}`);
    const allowed = filename === path.join(frontendPath, 'index.html')
        || filename === path.join(frontendPath, 'icon.ico')
        || filename.startsWith(`${path.join(frontendPath, 'build')}${path.sep}`);
    if (!allowed) {
        response.writeHead(404).end('Not found');
        return;
    }
    fs.readFile(filename, (error, content) => {
        if (error) { response.writeHead(404).end('Run the frontend build before browser tests.'); return; }
        response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        response.end(content);
    });
}).listen(8080, '127.0.0.1', () => console.log('Storage Analyzer browser test server: http://127.0.0.1:8080'));
