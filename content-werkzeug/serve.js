// Statischer Server + /api-Weiterleitung ans lokale Backend.
// Die Spieldatei kommt aus WEB (frisch von origin/main), alles Uebrige aus dem
// Repo-Checkout - der ist fuer Bilder/Manifest aktuell genug, fuer die Spieldatei nicht.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = process.env.ROOT || require('path').join(__dirname, '..');
const WEB  = process.env.WEB || ROOT;
const WEB_ALT = process.env.WEB_ALT || ROOT;
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css',
  '.png':'image/png', '.json':'application/json', '.woff2':'font/woff2', '.xml':'application/xml',
  '.txt':'text/plain', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
http.createServer((req, res) => {
  if (req.url.startsWith('/api')) {
    const pr = http.request({ hostname:'127.0.0.1', port:3001, path:req.url, method:req.method,
      headers: Object.assign({}, req.headers, { host:'127.0.0.1:3001' }) }, pres => {
      res.writeHead(pres.statusCode, pres.headers); pres.pipe(res);
    });
    pr.on('error', () => { res.writeHead(502); res.end('proxy error'); });
    req.pipe(pr); return;
  }
  let u = req.url.split('?')[0];
  if (u === '/') u = '/weltraum_kolonie.html';
  // /alt/... liefert den Stand VOR den isometrischen Bausaetzen (v8.689.0) -
  // gleicher Origin, damit die Anmeldung aus localStorage fuer beide gilt.
  if (u.startsWith('/alt/')) {
    const af = path.join(WEB_ALT, decodeURIComponent(u.slice(5)));
    if (fs.existsSync(af)) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(af)] || 'application/octet-stream' });
      return res.end(fs.readFileSync(af));
    }
    u = u.slice(4);
  }
  const bevorzugt = path.join(WEB, decodeURIComponent(u));
  const f = fs.existsSync(bevorzugt) ? bevorzugt : path.join(ROOT, decodeURIComponent(u));
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(d);
  });
}).listen(8900, () => console.log('serve+proxy auf 8900'));
