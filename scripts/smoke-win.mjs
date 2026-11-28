// Teste de fumaça do app de Windows: abre o .exe recém-compilado e confere, pela porta de
// depuração, que o xadrez, o motor e as fontes carregam e que a página não lança erros.
// Foi o que faltou quando o "ã" do nome quebrou o protocolo app:// sem ninguém notar.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join('release', 'win-unpacked');
const exe = fs.readdirSync(dir).find(f => f.endsWith('.exe'));
if (!exe) { console.error('Nenhum .exe em ' + dir); process.exit(1); }
const port = 9333;
const app = spawn(path.join(dir, exe), ['--remote-debugging-port=' + port], { stdio: 'ignore', detached: false });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = msg => { console.error('FALHOU: ' + msg); try { app.kill(); } catch (e) { /* já fechado */ } process.exit(1); };

let page = null;
for (let i = 0; i < 60 && !page; i++) {
  await sleep(1000);
  try { const l = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); page = l.find(x => x.type === 'page' && x.url.startsWith('app://')); } catch (e) { /* ainda abrindo */ }
}
if (!page) fail('a janela do app não abriu em 60 s');

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pend = new Map(), errors = [];
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') errors.push((m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text);
};
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
await send('Runtime.enable');
await sleep(6000);

const r = await ev(`(async () => {
  const o = { chess: typeof Chess, ua: /^[\\x20-\\x7e]*$/.test(navigator.userAgent) };
  o.lib = await fetch('lib/chess.js').then(x => x.status).catch(e => 'erro: ' + e.message);
  o.font = await fetch('fonts/Geist-Variable.woff2').then(x => x.status).catch(e => 'erro: ' + e.message);
  o.engine = await new Promise(res => { let w; try { w = new Worker('engine/sf.js'); } catch (e) { res('erro: ' + e.message); return; }
    const t = setTimeout(() => { w.terminate(); res('sem resposta'); }, 30000);
    w.onmessage = e => { if (String(e.data) === 'uciok') { clearTimeout(t); w.terminate(); res('uciok'); } };
    w.onerror = e => { clearTimeout(t); res('erro: ' + e.message); }; w.postMessage('uci'); });
  for (const v of ['partidas', 'analise', 'stats', 'treino', 'repertorio', 'academia', 'biblioteca', 'conquistas', 'painel']) { location.hash = v; await new Promise(r => setTimeout(r, 400)); }
  o.view = document.querySelector('.view.on') && document.querySelector('.view.on').id;
  return JSON.stringify(o);
})()`);
console.log('resultado:', r);
let o; try { o = JSON.parse(r); } catch (e) { fail('não consegui avaliar a página: ' + r); }
if (o.chess !== 'function') fail('Chess não carregou');
if (o.lib !== 200) fail('lib/chess.js respondeu ' + o.lib);
if (o.font !== 200) fail('a fonte respondeu ' + o.font);
if (o.engine !== 'uciok') fail('o motor não respondeu: ' + o.engine);
if (!o.ua) fail('o User-Agent tem caractere fora de ASCII');
if (errors.length) fail('erros na página:\n' + errors.join('\n'));
console.log('OK: app do Windows abre, carrega o xadrez, o motor e as fontes, e navega por todas as abas sem erros.');
ws.close(); app.kill(); process.exit(0);
