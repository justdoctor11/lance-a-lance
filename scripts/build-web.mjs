// Monta www/ (o app completo, offline) e update/app.json (o pacote de atualização automática).
//
// O app instalado tem duas camadas:
//  - a "casca" (Electron no Windows, Capacitor no Android) + motor, fontes e partidas iniciais;
//  - o app em si (CSS, HTML e JS), que o carregador abaixo pode trocar por uma versão mais nova
//    baixada de update/app.json, sem reinstalar.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = f => fs.readFileSync(path.join(R, f), 'utf8');
const pkg = JSON.parse(rd('package.json'));
const BUILD = parseInt(process.env.BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER || '0', 10);
const SHELL = pkg.version;            // versão da casca (instalador / APK)
const MIN_SHELL = pkg.minShell || SHELL; // casca mínima que este pacote exige
const UPDATE_URL = 'https://raw.githubusercontent.com/justdoctor11/lance-a-lance/updates/app.json';

const out = path.join(R, 'www');
fs.rmSync(out, { recursive: true, force: true });
for (const d of ['lib', 'engine', 'fonts']) fs.mkdirSync(path.join(out, d), { recursive: true });
for (const f of ['sf.js', 'sf.wasm', 'sf-asm.js']) fs.copyFileSync(path.join(R, 'vendor/engine', f), path.join(out, 'engine', f));
fs.copyFileSync(path.join(R, 'vendor/lib/chess.js'), path.join(out, 'lib/chess.js'));
for (const f of ['Geist-Variable.woff2', 'GeistMono-Variable.woff2']) fs.copyFileSync(path.join(R, 'vendor/fonts', f), path.join(out, 'fonts', f));

const fonts = `@font-face{font-family:"Geist";src:url("fonts/Geist-Variable.woff2") format("woff2");font-weight:100 900;font-display:swap}
@font-face{font-family:"Geist Mono";src:url("fonts/GeistMono-Variable.woff2") format("woff2");font-weight:100 900;font-display:swap}`;
const base = `*{-webkit-tap-highlight-color:transparent}html{color-scheme:light dark}body{margin:0;font:15px/1.5 system-ui,sans-serif;overscroll-behavior-y:none}
[hidden]{display:none!important}img{max-width:100%}
:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}`;

// O app propriamente dito: é isto que as atualizações substituem.
const payload = {
  build: BUILD, minShell: MIN_SHELL, latestShell: SHELL, at: new Date().toISOString(),
  css: rd('src/style.css') + '\n/* Peças cburnett (Colin M.L. Burnett, GPLv2+) */\n' + rd('vendor/pieces-cburnett.css') + '\n/* Peças Merida (GPLv2+), Chessnut (Apache 2.0), Fantasy e Spatial (MIT), Staunty, Maestro, Cardinal e California (CC BY-NC-SA 4.0), Moderno (original) */\n' + rd('vendor/pieces-extra.css') + '\nhtml.native-android .acct{max-width:40vw}',
  body: rd('src/body.html'),
  js: rd('src/app.js').replace('/*@MORE@*/', () => rd('src/more.js')).replace('/*@MORE2@*/', () => rd('src/more2.js')).replace('/*@MORE3@*/', () => rd('src/more3.js')).replace('/*@GP@*/', () => 'var CHESS_SRC = ' + JSON.stringify(rd('vendor/lib/chess.js')) + ';\n' + rd('src/gp.js')).replace('/*@DEBUG@*/', () => process.env.LAL_DEBUG ? rd('scripts/debug-hook.js') : '')
};
const safeJson = o => JSON.stringify(o).replace(/</g, '\\u003c');

// Carregador: escolhe entre o app embutido e uma atualização já baixada, e procura atualizações.
const boot = `(function () {
  var SHELL = ${JSON.stringify(SHELL)}, URL_UPD = ${JSON.stringify(UPDATE_URL)};
  var B = JSON.parse(document.getElementById('bundled').textContent);
  window.__SHELL = SHELL; window.__RELEASES = 'https://github.com/justdoctor11/lance-a-lance/releases/latest';
  function ver(a) { return String(a || '0').split('.').map(function (x) { return parseInt(x, 10) || 0; }); }
  function gte(a, b) { a = ver(a); b = ver(b); for (var i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); } return true; }
  function db() { return new Promise(function (res) { try { var r = indexedDB.open('lal-boot', 1); r.onupgradeneeded = function () { r.result.createObjectStore('kv'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { res(null); }; } catch (e) { res(null); } }); }
  function get(k) { return db().then(function (d) { return d ? new Promise(function (res) { try { var q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; } catch (e) { res(null); } }) : null; }); }
  function put(k, v) { return db().then(function (d) { return d ? new Promise(function (res) { try { var t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = function () { res(true); }; t.onerror = function () { res(false); }; } catch (e) { res(false); } }) : false; }); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function start(p) {
    window.__APP_BUILD = p.build;
    document.getElementById('appcss').textContent = p.css;
    document.body.insertAdjacentHTML('afterbegin', p.body);
    var s = document.createElement('script'); s.textContent = p.js + '\\n//# sourceURL=lance-a-lance-' + p.build + '.js'; document.body.appendChild(s);
  }
  async function fetchText(u) {
    if (window.native && window.native.fetchText) return window.native.fetchText(u);
    var r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error('http_' + r.status); return r.text();
  }
  async function check(manual) {
    try {
      var p = JSON.parse(await fetchText(URL_UPD + '?t=' + Date.now()));
      if (p.latestShell && !gte(SHELL, p.latestShell)) window.dispatchEvent(new CustomEvent('lal-shell-new', { detail: { version: p.latestShell } }));
      if (!(p.build > window.__APP_BUILD)) { if (manual) window.dispatchEvent(new CustomEvent('lal-uptodate')); return; }
      if (!gte(SHELL, p.minShell)) return;
      if (await put('app', p)) window.dispatchEvent(new CustomEvent('lal-update', { detail: { build: p.build } }));
    } catch (e) { if (manual) window.dispatchEvent(new CustomEvent('lal-update-fail')); }
  }
  window.__checkUpdate = function () { return check(true); };
  get('app').then(function (u) {
    var use = B;
    if (u && u.build > B.build && gte(SHELL, u.minShell)) {
      // se a última tentativa com esta versão não chegou a abrir, volta para a embutida
      if (ls('lal.boot') === String(u.build) && ls('lal.bootok') !== String(u.build)) { put('app', null); }
      else use = u;
    }
    ls('lal.boot', String(use.build));
    start(use);
    setTimeout(function () { check(false); }, 4000);
    setInterval(function () { if (document.visibilityState === 'visible') check(false); }, 3 * 60 * 60 * 1000);
  });
})();`;

const json = f => rd('data/' + f).trim();
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0e1412" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#eef1ee" media="(prefers-color-scheme: light)">
<link rel="icon" href="data:image/svg+xml,<svg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%20100'><rect%20width='100'%20height='100'%20rx='22'%20fill='%23000'/><g%20transform='translate(50%2050)%20scale(.8)%20translate(-50%20-51.5)'><path%20fill='%23fff'%20d='M50%2017%20a12%2012%200%201%201%200%2024%20a12%2012%200%201%201%200%20-24%20Z%20M39%2043.5%20h22%20a2.5%202.5%200%200%201%200%205%20h-22%20a2.5%202.5%200%200%201%200%20-5%20Z%20M44.5%2050%20h11%20C56%2061%2061%2068%2067%2074%20H33%20C39%2068%2044%2061%2044.5%2050%20Z%20M29%2077%20h42%20a3%203%200%200%201%203%203%20v3%20a3%203%200%200%201%20-3%203%20h-42%20a3%203%200%200%201%20-3%20-3%20v-3%20a3%203%200%200%201%203%20-3%20Z'/></g></svg>">
<title>Lance a Lance</title>
<style>
${fonts}
${base}
</style>
<style id="appcss"></style>
</head>
<body>
<script id="seed-owner" type="text/plain">justdoctor11</script>
<script id="seed-games" type="application/json">${json('seed-games.json')}</script>
<script id="seed-agg" type="application/json">null</script>
<script id="seed-an" type="application/json">${json('seed-an.json')}</script>
<script id="seed-rep" type="application/json">${json('seed-rep.json')}</script>
<script src="lib/chess.js"></script>
<script id="bundled" type="application/json">${safeJson(payload)}</script>
<script>
${boot}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.mkdirSync(path.join(R, 'update'), { recursive: true });
fs.writeFileSync(path.join(R, 'update', 'app.json'), JSON.stringify(payload));
console.log('www/index.html', (html.length / 1048576).toFixed(2) + ' MB · pacote de atualização', (JSON.stringify(payload).length / 1024).toFixed(0) + ' KB · build', BUILD, '· casca', SHELL);
