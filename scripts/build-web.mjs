// Monta www/ (o app completo, offline) a partir de src/, vendor/ e data/.
import fs from 'fs'; import path from 'path';
const R = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rd = f => fs.readFileSync(path.join(R, f), 'utf8');
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
:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
html.native-android .acct{max-width:40vw}`;
const json = f => rd('data/' + f).trim();
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0e1412" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#eef1ee" media="(prefers-color-scheme: light)">
<title>Lance a Lance</title>
<style>
${fonts}
${base}
${rd('src/style.css')}
/* Peças cburnett (Colin M.L. Burnett, GPLv2+) */
${rd('vendor/pieces-cburnett.css')}
</style>
</head>
<body>
${rd('src/body.html')}
<script id="seed-owner" type="text/plain">justdoctor11</script>
<script id="seed-games" type="application/json">${json('seed-games.json')}</script>
<script id="seed-agg" type="application/json">null</script>
<script id="seed-an" type="application/json">${json('seed-an.json')}</script>
<script id="seed-rep" type="application/json">${json('seed-rep.json')}</script>
<script src="lib/chess.js"></script>
<script>
${rd('src/app.js')}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('www/index.html', (html.length / 1048576).toFixed(2) + ' MB');
