(function () {
'use strict';
/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const store = {
  get(k, d) { try { const v = localStorage.getItem('lal.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('lal.' + k, JSON.stringify(v)); } catch (e) { /* armazenamento indisponível */ } }
};
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const pct = x => Math.round(x) + '%';
const kv = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise(res => {
    try { const r = indexedDB.open('lal', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null); }
    catch (e) { res(null); }
  }));
  return {
    async get(k, d) {
      const db = await open(); if (!db) return store.get(k, d);
      return new Promise(res => { try { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result === undefined ? store.get(k, d) : q.result); q.onerror = () => res(store.get(k, d)); } catch (e) { res(store.get(k, d)); } });
    },
    async set(k, v) {
      const db = await open(); if (!db) { store.set(k, v); return; }
      return new Promise(res => { try { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => { store.set(k, v); res(); }; } catch (e) { store.set(k, v); res(); } });
    }
  };
})();
const MEM = { games: {}, an: null };
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }

/* ---------- plataforma nativa (Windows / Android) ---------- */
const NATIVE = window.native ? window.native : (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ? {
  platform: 'android',
  fetchText: async url => { const r = await fetch(url, { headers: { Accept: 'application/json, application/x-chess-pgn, */*' } }); if (r.status === 404) throw { code: 'nouser' }; if (!r.ok) throw { code: 'http_' + r.status }; return r.text(); }
} : null;
if (NATIVE) document.documentElement.classList.add('native', 'native-' + NATIVE.platform);

/* ---------- dados ---------- */
const SEED_GAMES = JSON.parse($('#seed-games').textContent);
const SEED_AGG = JSON.parse($('#seed-agg').textContent);
const SEED_OWNER = ($('#seed-owner') && $('#seed-owner').textContent.trim()) || 'alvess_ma';
const SEED_REP = $('#seed-rep') ? JSON.parse($('#seed-rep').textContent) : null;
let AGG = SEED_AGG;
const PLAT = { chesscom: 'Chess.com', lichess: 'Lichess' };
const SEED_AN = JSON.parse($('#seed-an').textContent);
const S = { me: store.get('me', SEED_OWNER), plat: store.get('plat', 'chesscom'), games: [], an: {}, view: 'painel', gid: null, ply: 0, flip: null, filter: 'all', puz: 0, src: store.get('plat', 'chesscom') };
const acctKey = () => S.plat + ':' + S.me.toLowerCase();
const isSeed = () => S.plat === 'chesscom' && S.me.toLowerCase() === SEED_OWNER;
function loadData() {
  const map = new Map();
  for (const g of (isSeed() ? SEED_GAMES : []).concat(MEM.games['games:' + acctKey()] || [])) map.set(g.id, g);
  S.games = Array.from(map.values()).sort((a, b) => b.end - a.end);
  S.an = Object.assign({}, SEED_AN, MEM.an || {});
  AGG = isSeed() && SEED_AGG ? SEED_AGG : computeAgg(S.games);
}
function computeAgg(games) {
  const A = { total: games.length, byTc: {}, byColor: { w: { W: 0, D: 0, L: 0 }, b: { W: 0, D: 0, L: 0 } }, lossHow: {}, winHow: {}, openings: [], rating: { rapid: [], blitz: [] } };
  const ops = {};
  for (const g of games.slice().sort((a, b) => a.end - b.end)) {
    const k = resultOf(g).k;
    const t = A.byTc[g.tc] = A.byTc[g.tc] || { W: 0, D: 0, L: 0 }; t[k]++;
    A.byColor[g.c][k]++;
    if (k === 'L') A.lossHow[g.res] = (A.lossHow[g.res] || 0) + 1;
    if (k === 'W') A.winHow[g.oRes] = (A.winHow[g.oRes] || 0) + 1;
    const nm = String(g.op || g.eco || 'Abertura').replace(/\s*\.\.\..*$/, '').replace(/\s\d+\..*$/, '').trim();
    const o = ops[nm + '|' + g.c] = ops[nm + '|' + g.c] || { name: nm, color: g.c, W: 0, D: 0, L: 0, n: 0 }; o[k]++; o.n++;
    if (A.rating[g.tc] && g.mR) A.rating[g.tc].push([g.end, g.mR]);
  }
  A.openings = Object.values(ops).sort((a, b) => b.n - a.n).slice(0, 14);
  for (const k of ['rapid', 'blitz']) { const r = A.rating[k]; if (r.length > 240) { const st = r.length / 240; const t = []; for (let i = 0; i < 240; i++) t.push(r[Math.floor(i * st)]); t.push(r[r.length - 1]); A.rating[k] = t; } }
  return A;
}
function acctLabel() { return S.me + ' · ' + PLAT[S.plat]; }
async function hydrate() {
  if (!MEM.an) MEM.an = await kv.get('an', {});
  const k = 'games:' + acctKey(); if (!MEM.games[k]) MEM.games[k] = await kv.get(k, []);
}
async function switchAccount(user, plat) {
  const changed = user.toLowerCase() !== S.me.toLowerCase() || plat !== S.plat;
  S.me = user; S.plat = plat; store.set('me', user); store.set('plat', plat); store.set('meT', Date.now()); cloudPrefsPush();
  if (!changed) return false;
  S.gid = null; S.ply = 0; S.flip = null; S.puz = 0; S.limit = 60; S.vx = null; S.vxSetup = null; TRAIN = null;
  await hydrate();
  if (Cloud.on) { try { await cloudPullAccount(); } catch (e) { /* segue local */ } cloudWatchAn(); await cloudLoadReport(); } else REPORT = isSeed() ? SEED_REP : null;
  loadData(); refreshAll(); return true;
}
function refreshAll() {
  $('#acct').textContent = acctLabel(); updateLive();
  showView(S.view || 'painel');
}

/* ---------- xadrez: tabuleiro, ataques, fatos ---------- */
const FILES = 'abcdefgh';
const sqI = s => (s.charCodeAt(0) - 97) + (s.charCodeAt(1) - 49) * 8;
const iSq = i => FILES[i % 8] + ((i >> 3) + 1);
const other = c => c === 'w' ? 'b' : 'w';
const V = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const PN = { p: 'peão', n: 'cavalo', b: 'bispo', r: 'torre', q: 'dama', k: 'rei' };
const ART = { p: 'o', n: 'o', b: 'o', r: 'a', q: 'a', k: 'o' };
const pz = t => ART[t] + ' ' + PN[t];
const SIDE = { w: 'brancas', b: 'pretas' };
const SIDEC = { w: 'Brancas', b: 'Pretas' };
const FIG = { N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔' };
const fig = san => String(san || '').replace(/[NBRQK]/g, c => FIG[c]);
const list = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function parseBoard(fen) {
  const b = new Array(64).fill(null); const rows = fen.split(' ')[0].split('/');
  for (let r = 0; r < 8; r++) { let f = 0; for (const ch of rows[r]) { if (ch >= '1' && ch <= '8') f += +ch; else { b[(7 - r) * 8 + f] = { t: ch.toLowerCase(), c: ch === ch.toUpperCase() ? 'w' : 'b' }; f++; } } }
  return b;
}
const on = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const KG = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
function attackers(B, idx, color) {
  const res = []; const f = idx % 8, r = idx >> 3;
  const pr = color === 'w' ? r - 1 : r + 1;
  for (const df of [-1, 1]) { const ff = f + df; if (on(ff, pr)) { const p = B[pr * 8 + ff]; if (p && p.c === color && p.t === 'p') res.push(pr * 8 + ff); } }
  for (const [a, b] of KN) { const ff = f + a, rr = r + b; if (on(ff, rr)) { const p = B[rr * 8 + ff]; if (p && p.c === color && p.t === 'n') res.push(rr * 8 + ff); } }
  for (const [a, b] of KG) { const ff = f + a, rr = r + b; if (on(ff, rr)) { const p = B[rr * 8 + ff]; if (p && p.c === color && p.t === 'k') res.push(rr * 8 + ff); } }
  for (const [dirs, types] of [[ORTH, 'rq'], [DIAG, 'bq']]) {
    for (const [a, b] of dirs) {
      let ff = f + a, rr = r + b;
      while (on(ff, rr)) { const p = B[rr * 8 + ff]; if (p) { if (p.c === color && types.includes(p.t)) res.push(rr * 8 + ff); break; } ff += a; rr += b; }
    }
  }
  return res;
}
function hanging(B, color) {
  const out = [];
  for (let i = 0; i < 64; i++) {
    const p = B[i]; if (!p || p.c !== color || p.t === 'k') continue;
    const atk = attackers(B, i, other(color)); if (!atk.length) continue;
    const def = attackers(B, i, color);
    const minA = Math.min.apply(null, atk.map(j => B[j].t === 'k' ? 100 : V[B[j].t]));
    if (minA === 100 && def.length) continue;
    if (!def.length || minA < V[p.t]) out.push({ idx: i, t: p.t, undef: !def.length });
  }
  return out.sort((a, b) => V[b.t] - V[a.t]);
}
function material(B) { const m = { w: 0, b: 0 }; for (const p of B) if (p) m[p.c] += V[p.t]; return m; }
function nonPawn(B) { let s = 0; for (const p of B) if (p && p.t !== 'p' && p.t !== 'k') s += V[p.t]; return s; }
function phaseOf(B, ply) { if (nonPawn(B) <= 20) return 'final'; return ply < 20 ? 'abertura' : 'meio-jogo'; }
function pinsFrom(B, idx) {
  const p = B[idx]; if (!p || !'brq'.includes(p.t)) return [];
  const dirs = p.t === 'r' ? ORTH : p.t === 'b' ? DIAG : ORTH.concat(DIAG); const out = [];
  for (const [a, b] of dirs) {
    let ff = idx % 8 + a, rr = (idx >> 3) + b, first = null;
    while (on(ff, rr)) {
      const q = B[rr * 8 + ff];
      if (q) {
        if (q.c === p.c) break;
        if (!first) { if (q.t === 'k') break; first = { t: q.t, idx: rr * 8 + ff }; }
        else { if (q.t === 'k' || V[q.t] > V[first.t]) out.push({ pinned: first, to: { t: q.t, idx: rr * 8 + ff }, abs: q.t === 'k' }); break; }
      }
      ff += a; rr += b;
    }
  }
  return out;
}
function lineSan(fen, ucis, max) {
  const out = []; if (!ucis || !ucis.length) return out;
  let c; try { c = new Chess(fen); } catch (e) { return out; }
  for (const u of ucis.slice(0, max || 8)) {
    try { const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined }); out.push({ san: m.san, m: m }); } catch (e) { break; }
  }
  return out;
}
function materialSwing(fen, line, side) {
  if (!line.length) return 0;
  const a = material(parseBoard(fen)), b = material(parseBoard(line[line.length - 1].m.after));
  return (b[side] - b[other(side)]) - (a[side] - a[other(side)]);
}
function legalCount(fen) { try { return new Chess(fen).moves().length; } catch (e) { return 0; } }

function factsFor(fenBefore, m, ply) {
  const B = parseBoard(fenBefore), A = parseBoard(m.after); const me = m.color, op = other(me);
  const F = { castle: null, capture: m.captured || null, check: m.san.includes('+'), mate: m.san.includes('#'), promo: m.promotion || null, threats: [], fork: null, pins: [], myHang: [], develop: false, center: false, earlyQueen: false, kingWalk: false };
  if (m.flags.includes('k')) F.castle = 'curto'; else if (m.flags.includes('q')) F.castle = 'longo';
  const to = sqI(m.to); const mover = m.promotion || m.piece;
  const hb = new Set(hanging(B, op).map(h => h.idx));
  F.threats = hanging(A, op).filter(h => !hb.has(h.idx));
  const tg = [];
  for (let j = 0; j < 64; j++) {
    const p = A[j]; if (!p || p.c !== op) continue;
    if (!attackers(A, j, me).includes(to)) continue;
    if (p.t === 'k' || V[p.t] > V[mover] || !attackers(A, j, op).length) tg.push({ t: p.t, sq: iSq(j) });
  }
  if (tg.length >= 2) F.fork = { by: mover, targets: tg };
  F.pins = pinsFrom(A, to);
  F.myHang = hanging(A, me);
  const home = me === 'w' ? '1' : '8';
  if (ply < 24 && (m.piece === 'n' || m.piece === 'b') && m.from[1] === home) F.develop = true;
  if (ply < 16 && m.piece === 'p' && 'cdef'.includes(m.from[0]) && !m.captured) F.center = true;
  if (ply < 14 && m.piece === 'q' && !m.captured && !F.check) F.earlyQueen = true;
  if (ply < 30 && m.piece === 'k' && !F.castle) F.kingWalk = true;
  return F;
}
function ideaShort(F, m) {
  if (F.mate) return 'dá xeque-mate';
  if (F.fork) return 'faz um garfo em ' + list(F.fork.targets.map(t => PN[t.t] + ' (' + t.sq + ')'));
  if (F.capture) return 'captura ' + pz(F.capture) + ' em ' + m.to + (F.check ? ' com xeque' : '');
  if (F.pins.length) { const p = F.pins[0]; return 'crava ' + pz(p.pinned.t) + ' em ' + iSq(p.pinned.idx) + ' contra ' + (p.to.t === 'k' ? 'o rei' : pz(p.to.t)); }
  if (F.promo) return 'promove a ' + PN[F.promo];
  if (F.check) return 'dá xeque';
  if (F.threats.length) return 'ameaça ' + list(F.threats.slice(0, 2).map(h => pz(h.t) + ' em ' + iSq(h.idx)));
  if (F.castle) return 'roca e protege o rei';
  if (F.develop) return 'desenvolve ' + pz(m.piece);
  return '';
}
function ideaSentences(F, m) {
  const s = [];
  if (F.mate) s.push('Xeque-mate. Fim de jogo.');
  if (F.castle) s.push('Roque ' + F.castle + ': o rei sai do centro e a torre entra no jogo.');
  if (F.capture) s.push('Captura ' + pz(F.capture) + ' em ' + m.to + '.');
  if (F.promo) s.push('Promove o peão a ' + PN[F.promo] + '.');
  if (F.check && !F.mate) s.push('Dá xeque: o adversário é obrigado a responder a ele.');
  if (F.fork) s.push('Garfo: ' + pz(F.fork.by) + ' ataca ' + list(F.fork.targets.map(t => pz(t.t) + ' em ' + t.sq)) + ' ao mesmo tempo.');
  if (F.pins.length) { const p = F.pins[0]; s.push('Crava ' + pz(p.pinned.t) + ' em ' + iSq(p.pinned.idx) + ' contra ' + (p.to.t === 'k' ? 'o rei' : pz(p.to.t)) + (p.abs ? '; cravado contra o rei, ele não pode sair.' : '.')); }
  if (!F.fork && F.threats.length && !F.mate) s.push('Cria ameaça contra ' + list(F.threats.slice(0, 2).map(h => pz(h.t) + ' em ' + iSq(h.idx))) + '.');
  if (F.develop) s.push('Desenvolve ' + pz(m.piece) + ': mais uma peça participando do jogo.');
  if (F.center) s.push('Avança um peão central para ocupar ou disputar o centro.');
  if (F.earlyQueen) s.push('Saída cedo da dama: ela pode virar alvo e fazer você perder tempos.');
  if (F.kingWalk) s.push('Move o rei sem rocar e perde o direito ao roque.');
  if (!s.length) {
    const q = { p: 'Lance de peão: ganha espaço ou prepara a ativação de uma peça.', k: 'Ativa o rei, peça forte quando há poucas peças no tabuleiro.', r: 'Reposiciona a torre em busca de coluna aberta ou mais atividade.', q: 'Reposiciona a dama para uma casa mais ativa.' }[m.piece];
    s.push(q || ('Reposiciona ' + pz(m.piece) + ' para uma casa melhor.'));
  }
  return s;
}

/* ---------- avaliação e classificação ---------- */
function evOf(r) { return r ? { cp: r[0], mate: r[1], best: r[2] && r[2] !== '(none)' ? r[2] : null, pv: r[3] ? String(r[3]).split(' ').filter(Boolean) : [], mated: r[4] || null } : null; }
function wpWhite(e) {
  if (!e) return 50;
  if (e.mate === 0 || e.mated) return e.mated === 'b' ? 100 : e.mated === 'w' ? 0 : 50;
  if (e.mate != null) return e.mate > 0 ? 100 : 0;
  const cp = Math.max(-1500, Math.min(1500, e.cp || 0));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}
function evTxt(e) {
  if (!e) return '—';
  if (e.mate === 0 || e.mated) return e.mated ? '#' : '0,0';
  if (e.mate != null) return (e.mate > 0 ? '+' : '−') + 'M' + Math.abs(e.mate);
  const v = (e.cp || 0) / 100; return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1).replace('.', ',');
}
const isMateFor = (e, side) => e && e.mate != null && e.mate !== 0 && (side === 'w' ? e.mate > 0 : e.mate < 0);
const CLS = { brill: { t: 'Brilhante', s: '!!' }, great: { t: 'Ótimo', s: '!' }, best: { t: 'Melhor', s: '★' }, exc: { t: 'Excelente', s: '✓✓' }, good: { t: 'Bom', s: '✓' }, inacc: { t: 'Imprecisão', s: '?!' }, mistake: { t: 'Erro', s: '?' }, blunder: { t: 'Capivarada', s: '??' }, miss: { t: 'Chance perdida', s: '✕' }, forced: { t: 'Único lance', s: '□' }, dz: { t: 'Posição decidida', s: '·' } };
const BAD = { inacc: 1, mistake: 1, blunder: 1, miss: 1 };

const PREP = new Map();
function prep(g) {
  let P = PREP.get(g.id); if (P) return P;
  const c = new Chess(); const fens = [c.fen()]; const moves = [];
  for (const san of g.mv.split(' ')) { if (!san) continue; try { const m = c.move(san); moves.push(m); fens.push(c.fen()); } catch (e) { break; } }
  P = { g, fens, moves, evs: null, cls: null, acc: null };
  attachAnalysis(P); PREP.set(g.id, P); return P;
}
/* sacrifício: a peça vai para uma casa onde pode ser capturada com perda real de material */
function isSac(m, fenBefore, ea) {
  const t = m.promotion || m.piece; if (!'nbrq'.includes(t)) return false;
  const A = parseBoard(m.after), to = sqI(m.to), me = m.color, op = other(me);
  const atk = attackers(A, to, op); if (!atk.length) return false;
  const got = m.captured ? V[m.captured] : 0; if (V[t] - got < 2) return false;
  const def = attackers(A, to, me), minA = Math.min.apply(null, atk.map(j => A[j].t === 'k' ? 100 : V[A[j].t]));
  if (def.length && minA >= V[t]) return false; if (minA === 100 && def.length) return false;
  // na linha do motor o material realmente cai (não é só uma troca)
  const line = lineSan(m.after, ea && ea.pv ? ea.pv.slice(0, 4) : []);
  const end = line.length ? line[line.length - 1].m.after : m.after, a0 = material(parseBoard(fenBefore)), a1 = material(parseBoard(end));
  if ((a1[me] - a1[op]) - (a0[me] - a0[op]) > -2) return false;
  try { return new Chess(m.after).moves({ verbose: true }).some(x => x.to === m.to && x.captured); } catch (e) { return false; }
}
function attachAnalysis(P) {
  const raw = S.an[P.g.id];
  if (!raw || raw.length < P.fens.length) { P.evs = null; P.cls = null; P.acc = null; return; }
  P.evs = raw.map(evOf); classify(P);
}
function classify(P) {
  const out = [];
  for (let i = 0; i < P.moves.length; i++) {
    const m = P.moves[i], side = m.color, eb = P.evs[i], ea = P.evs[i + 1];
    const b = wpWhite(eb), a = wpWhite(ea);
    const wb = side === 'w' ? b : 100 - b, wa = side === 'w' ? a : 100 - a;
    const loss = Math.max(0, wb - wa);
    const uci = m.from + m.to + (m.promotion || '');
    const isBest = !!eb && eb.best === uci;
    let k = isBest ? 'best' : loss < 2 ? 'exc' : loss < 10 ? 'good' : loss < 20 ? 'inacc' : loss < 30 ? 'mistake' : 'blunder';
    if (k !== 'best' && k !== 'exc' && k !== 'good' && legalCount(P.fens[i]) === 1) k = 'forced';
    const prev = out[i - 1];
    if (prev && (prev.k === 'mistake' || prev.k === 'blunder') && BAD[k] && wb >= 60 && wa < wb - 10) k = 'miss';
    if ((k === 'best' || k === 'exc') && loss < 2) {
      if (wb < 92 && wa >= 40 && isSac(m, P.fens[i], P.evs[i + 1])) k = 'brill';
      else if (k === 'best' && prev && (prev.k === 'mistake' || prev.k === 'blunder') && prev.loss >= 20 && wa >= 60) k = 'great';
    }
    let only = false;
    if (k === 'best' && typeof critOf === 'function') { const cr = critOf(P, i); if (cr && cr.gap >= 15 && cr.wp >= 30) { k = 'great'; only = true; } }
    const acc = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));
    out.push({ k, loss, wb, wa, acc, uci, isBest, only });
  }
  // zona decidida: do primeiro lance em que a partida fica decidida (97%+) e não volta mais
  const w = P.evs.map(wpWhite), N = w.length; let dz = null, dzSide = null;
  const lastSide = w[N - 1] >= 97 ? 'w' : w[N - 1] <= 3 ? 'b' : null;
  if (lastSide) { let j = N - 1; const dec = x => lastSide === 'w' ? x >= 97 : x <= 3; while (j > 0 && dec(w[j - 1])) j--; if (j < N - 2 && j >= 2) { dz = j; dzSide = lastSide; } }
  if (dz != null) for (let i = dz; i < out.length; i++) { out[i].dz = true; if (P.moves[i].color !== dzSide && !BAD[out[i].k] && out[i].k !== 'best' && out[i].k !== 'forced') out[i].k = 'dz'; }
  P.cls = out; P.dz = dz; P.dzSide = dzSide;
  const live = (x, i) => !x.dz || dz == null;
  const accOf = par => { const L = out.filter((x, i) => i % 2 === par && live(x, i)).map(x => x.acc); return L.length ? avg(L) : avg(out.filter((_, i) => i % 2 === par).map(x => x.acc)); };
  P.acc = { w: accOf(0), b: accOf(1) };
}

/* ---------- treinador ---------- */
function coachFor(P, i) {
  const m = P.moves[i], me = m.color, op = other(me), c = P.cls ? P.cls[i] : null;
  const F = factsFor(P.fens[i], m, i);
  const out = { F, idea: ideaSentences(F, m), verdict: [], punish: [], warn: [], best: null, reply: null, plans: plansFor(P, i) };
  if (!P.evs) { out.verdict.push('Esta partida ainda não passou pelo motor. Toque em “Analisar com o motor” para ver avaliação, melhor lance e plano.'); return out; }
  const eb = P.evs[i], ea = P.evs[i + 1];
  const lead = {
    brill: 'Lance brilhante: um sacrifício que o motor aprova. A peça pode ser capturada, mas a compensação vale mais.',
    great: c && c.only ? 'Ótimo lance: era o único que mantinha a posição. O segundo melhor perdia ' + ((typeof critOf === 'function' && critOf(P, i)) ? critOf(P, i).gap : 15) + ' pontos de chance de vitória.' : 'Ótimo lance: o adversário tinha acabado de errar e você encontrou a punição exata.',
    dz: 'Posição já decidida: desde o lance ' + (P.dz != null ? Math.floor(P.dz / 2) + 1 : '') + ' a vantagem das ' + SIDE[P.dzSide || 'w'] + ' não muda o resultado. Aqui o motor vê quase todos os lances como equivalentes; o que conta é o plano mais simples. Esses lances ficam fora da precisão.',
    best: 'Lance do motor: exatamente o que a posição pedia.',
    exc: 'Excelente: praticamente tão bom quanto a escolha do motor.',
    good: 'Lance razoável; existe algo um pouco mais preciso.',
    inacc: 'Imprecisão: a chance estimada de vitória das ' + SIDE[me] + ' caiu ' + Math.round(c.loss) + ' pontos percentuais.',
    mistake: 'Erro: a chance estimada de vitória das ' + SIDE[me] + ' caiu ' + Math.round(c.loss) + ' pontos percentuais.',
    blunder: 'Capivarada: o lance muda o rumo da partida (−' + Math.round(c.loss) + ' pontos percentuais de chance de vitória).',
    miss: 'Chance perdida: o adversário tinha acabado de errar e havia um lance para punir.',
    forced: 'Único lance legal na posição.'
  }[c.k];
  out.verdict.push(lead);
  if (c.k !== 'best' && c.k !== 'brill' && c.k !== 'great' && c.k !== 'forced' && eb && eb.best && eb.best !== c.uci) {
    const bl = lineSan(P.fens[i], eb.pv.length ? eb.pv : [eb.best]);
    if (bl[0]) {
      const BF = factsFor(P.fens[i], bl[0].m, i); const why = ideaShort(BF, bl[0].m);
      out.best = { san: bl[0].san, line: bl.slice(0, 6), uci: eb.best, why };
      if (isMateFor(eb, me)) out.best.extra = 'Havia mate forçado em ' + Math.abs(eb.mate) + '.';
      else { const R2 = settledSwing(P.fens[i], bl.slice(0, 8), me); out.best.proof = R2; if (R2.sure && R2.v >= 2) out.best.extra = 'Na linha do motor, as ' + SIDE[me] + ' ganham cerca de ' + R2.v + ' pontos de material.'; }
    }
  }
  if (BAD[c.k] && ea && ea.best) {
    const rl = lineSan(m.after, ea.pv.length ? ea.pv : [ea.best]);
    if (rl[0]) {
      const RF = factsFor(m.after, rl[0].m, i + 1); const why = ideaShort(RF, rl[0].m);
      out.reply = { san: rl[0].san, line: rl.slice(0, 8), uci: ea.best };
      let s = 'Agora as ' + SIDE[op] + ' podem responder ' + fig(rl[0].san) + (why ? ', que ' + why : '') + '.';
      if (isMateFor(ea, op)) s += ' Há mate forçado em ' + Math.abs(ea.mate) + '.';
      else { const R2 = settledSwing(m.after, rl.slice(0, 8), op); out.reply.proof = R2; if (R2.sure && R2.v >= 2) s += ' Seguindo a linha do motor, as ' + SIDE[op] + ' ganham cerca de ' + R2.v + ' pontos de material.'; }
      out.punish.push(s);
    }
  }
  if (typeof critOf === 'function') { const cr = critOf(P, i); if (cr && cr.gap >= 15 && cr.wp >= 30 && c.k !== 'great') { const sl = lineSan(P.fens[i], [cr.best]); out.crit = 'Momento crítico: só um lance mantinha a posição' + (sl[0] ? ' (' + fig(sl[0].san) + ')' : '') + '; qualquer outro perdia ' + cr.gap + ' pontos de chance ou mais.'; } }
  if (F.myHang.length && !F.mate && c.k !== 'best' && c.k !== 'exc') {
    const h = F.myHang[0];
    out.warn.push('Atenção: ' + pz(h.t) + ' em ' + iSq(h.idx) + ' ficou ' + (h.undef ? 'sem defesa' : 'atacado por uma peça de menor valor') + '.');
  }
  return out;
}
function plansFor(P, i) { return plansAt(P.fens[i + 1], P.evs ? P.evs[i + 1] : null, i + 1); }
function plansAt(fen, ev, ply) {
  const A = parseBoard(fen), stm = fen.split(' ')[1], opp = other(stm);
  const res = { w: [], b: [] };
  if (ev && ev.best) {
    const l = lineSan(fen, ev.pv.length ? ev.pv : [ev.best]);
    if (l[0]) {
      const BF = factsFor(fen, l[0].m, ply); const sh = ideaShort(BF, l[0].m);
      if (isMateFor(ev, stm)) res[stm].push('Mate forçado em ' + Math.abs(ev.mate) + ': ' + l.slice(0, 5).map(x => fig(x.san)).join(' ') + '.');
      else res[stm].push('Melhor continuação: ' + fig(l[0].san) + (sh ? ', que ' + sh : '') + '.');
    }
  }
  const hang = hanging(A, stm);
  if (hang.length) {
    res[stm].push('Cuidado: ' + pz(hang[0].t) + ' em ' + iSq(hang[0].idx) + ' está ' + (hang[0].undef ? 'sem defesa' : 'mal defendido') + '.');
    res[opp].push('Alvo: ' + pz(hang[0].t) + ' das ' + SIDE[stm] + ' em ' + iSq(hang[0].idx) + '.');
  }
  for (const side of ['w', 'b']) for (const t of strategic(A, side, ply, fen.split(' ')[2])) if (res[side].length < 3) res[side].push(t);
  for (const side of ['w', 'b']) if (!res[side].length) res[side].push(side === stm ? 'Procure melhorar a pior peça e checar as ameaças do adversário antes de agir.' : 'Aguardar o lance do adversário e verificar xeques, capturas e ameaças.');
  return res;
}
function strategic(A, side, ply, rights) {
  rights = rights || '';
  const tips = []; const ph = phaseOf(A, ply); const m = material(A); const diff = m[side] - m[other(side)];
  if (ph === 'abertura') {
    const home = side === 'w' ? 0 : 7; let und = 0;
    for (const [f, t] of [[1, 'n'], [6, 'n'], [2, 'b'], [5, 'b']]) { const p = A[home * 8 + f]; if (p && p.c === side && p.t === t) und++; }
    if (und >= 2) tips.push('Ainda há ' + und + ' peças menores na posição inicial: desenvolva antes de atacar.');
    const k = A.findIndex(p => p && p.t === 'k' && p.c === side);
    if (ply >= 12 && (k === home * 8 + 4 || k === home * 8 + 3)) tips.push(rights.includes(side === 'w' ? 'K' : 'k') || rights.includes(side === 'w' ? 'Q' : 'q') ? 'O rei continua no centro: rocar deve ser prioridade.' : 'Rei preso no centro sem roque: evite abrir colunas perto dele.');
  }
  if (diff >= 3) tips.push('Com ' + diff + ' pontos a mais de material, troque peças e simplifique.');
  else if (diff <= -3) tips.push('Com ' + (-diff) + ' pontos a menos, busque atividade e evite trocas.');
  if (ph === 'final') {
    const pp = passed(A, side);
    tips.push(pp.length ? 'Peão passado em ' + list(pp) + ': empurre com apoio do rei e das peças.' : 'Final: ative o rei, que vira peça de ataque.');
  }
  return tips;
}
function passed(A, side) {
  const out = []; const dir = side === 'w' ? 1 : -1;
  for (let i = 0; i < 64; i++) {
    const p = A[i]; if (!p || p.t !== 'p' || p.c !== side) continue;
    const f = i % 8; let r = (i >> 3) + dir, free = true;
    while (r >= 0 && r < 8 && free) { for (const ff of [f - 1, f, f + 1]) if (on(ff, r)) { const q = A[r * 8 + ff]; if (q && q.t === 'p' && q.c !== side) free = false; } r += dir; }
    if (free) out.push(iSq(i));
  }
  return out;
}

/* ---------- tabuleiro ---------- */
class Board {
  constructor(el) {
    this.el = el; el.classList.add('board');
    el.innerHTML = '<div class="layer marks"></div><div class="layer coords"></div><div class="layer pieces"></div><svg class="layer arrows" viewBox="0 0 8 8" aria-hidden="true"></svg>';
    this.L = { marks: el.querySelector('.marks'), coords: el.querySelector('.coords'), pieces: el.querySelector('.pieces'), arrows: el.querySelector('.arrows') };
    this.flip = false; this.items = []; this.fen = null; this.marks = {}; this.arrows = []; this.live = null; this.sel = null; this.drag = null;
    this.drawCoords(); this.bind();
  }
  xy(i) { const f = i % 8, r = i >> 3; return this.flip ? [7 - f, r] : [f, 7 - r]; }
  tf(i) { const [x, y] = this.xy(i); return 'translate(' + (x * 100) + '%,' + (y * 100) + '%)'; }
  instant(fn) { this.el.classList.add('instant'); fn(); const t = this.itok = {}; requestAnimationFrame(() => requestAnimationFrame(() => { if (this.itok === t) this.el.classList.remove('instant'); })); }
  drawCoords() {
    let h = '';
    for (let k = 0; k < 8; k++) {
      const fi = this.flip ? 7 - k : k, ri = this.flip ? k : 7 - k;
      h += '<span class="cf ' + (k % 2 === 0 ? 'on-d' : 'on-l') + '" style="left:' + (k * 12.5) + '%">' + FILES[fi] + '</span>';
      h += '<span class="cr ' + (k % 2 === 0 ? 'on-l' : 'on-d') + '" style="top:' + (k * 12.5) + '%">' + (ri + 1) + '</span>';
    }
    this.L.coords.innerHTML = h;
  }
  setFlip(f) {
    f = !!f; if (this.flip === f) return; this.flip = f; this.drawCoords();
    this.instant(() => { for (const it of this.items) it.el.style.transform = this.tf(it.idx); });
    this.setMarks(this.marks); this.setArrows(this.arrows);
  }
  setPosition(fen, animate) {
    const run = () => {
      if (animate && this.fen && this.fen !== fen) { const k = parseBoard(fen).filter(Boolean).length < this.items.length ? 'cap' : 'move'; sound(k); if (this.el.closest('#v-analise,#v-treino')) haptic(k); }
      const B = parseBoard(fen); const target = [];
      B.forEach((p, i) => { if (p) target.push({ idx: i, code: p.c + p.t }); });
      const cur = this.items, used = new Array(cur.length).fill(false), next = [], pending = [];
      for (const t of target) { const j = cur.findIndex((c, k) => !used[k] && c.code === t.code && c.idx === t.idx); if (j >= 0) { used[j] = true; next.push(cur[j]); } else pending.push(t); }
      const create = [];
      for (const t of pending) {
        let best = -1, bd = 99;
        cur.forEach((c, k) => { if (used[k] || c.code !== t.code) return; const d = Math.abs(c.idx % 8 - t.idx % 8) + Math.abs((c.idx >> 3) - (t.idx >> 3)); if (d < bd) { bd = d; best = k; } });
        if (best >= 0) { used[best] = true; const it = cur[best]; it.idx = t.idx; it.el.style.transform = this.tf(t.idx); next.push(it); } else create.push(t);
      }
      cur.forEach((c, k) => { if (!used[k]) { if (animate) { c.el.classList.add('ghost'); setTimeout(() => c.el.remove(), 200); } else c.el.remove(); } });
      for (const t of create) {
        const el = document.createElement('div'); el.className = 'pc ' + t.code; el.style.transform = this.tf(t.idx);
        if (animate) { el.classList.add('ghost'); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('ghost'))); }
        this.L.pieces.appendChild(el); next.push({ el, idx: t.idx, code: t.code });
      }
      this.items = next; this.fen = fen;
    };
    if (animate) run(); else this.instant(run);
  }
  setMarks(m) {
    this.marks = m || {}; let h = '';
    const add = (sq, cls, inner) => { if (!sq) return; h += '<div class="mk ' + cls + '" style="transform:' + this.tf(sqI(sq)) + '">' + (inner || '') + '</div>'; };
    if (m.last) { add(m.last[0], 'last'); add(m.last[1], 'last'); }
    if (m.ok) add(m.ok, 'ok'); if (m.bad) add(m.bad, 'bad');
    if (m.sel) add(m.sel, 'sel');
    if (m.check) add(m.check, 'chk');
    for (const s of m.risk || []) add(s, 'risk');
    for (const s of m.dots || []) add(s, 'dot');
    for (const s of m.caps || []) add(s, 'cap');
    for (const s of m.pick || []) add(s, 'pick');
    for (const s of m.okp || []) add(s, 'okp');
    for (const s of m.hangp || []) add(s, 'hangp');
    for (const s of m.wrongp || []) add(s, 'wrongp');
    for (const s of m.missp || []) add(s, 'missp');
    if (m.badge) add(m.badge.sq, '', '<span class="bdg k-' + m.badge.k + '" style="background:var(--k)">' + esc(CLS[m.badge.k].s) + '</span>');
    this.L.marks.innerHTML = h;
  }
  setArrows(list) {
    this.arrows = list || []; let h = '';
    for (const a of this.arrows) {
      const [x1, y1] = this.xy(sqI(a.from)), [x2, y2] = this.xy(sqI(a.to));
      h += '<polygon class="' + a.cls + '" points="' + arrowPts(x1 + .5, y1 + .5, x2 + .5, y2 + .5) + '"></polygon>';
    }
    this.L.arrows.innerHTML = h;
  }
  setLive(cfg) { this.live = cfg; this.sel = null; this.el.classList.toggle('live', !!cfg); }
  sqAt(e) {
    const r = this.el.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / r.width * 8), y = Math.floor((e.clientY - r.top) / r.height * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    return (this.flip ? y : 7 - y) * 8 + (this.flip ? 7 - x : x);
  }
  targets(i) { return this.live ? (this.live.dests[iSq(i)] || []) : []; }
  select(i) {
    this.sel = i; const d = this.targets(i); const B = parseBoard(this.fen);
    this.setMarks(Object.assign({}, this.live.marks || {}, { sel: iSq(i), dots: d.filter(s => !B[sqI(s)]), caps: d.filter(s => B[sqI(s)]) }));
  }
  unselect() { this.sel = null; if (this.live) this.setMarks(this.live.marks || {}); }
  bind() {
    const el = this.el; let raf = 0, lastEv = null;
    el.addEventListener('pointerdown', e => {
      if (!this.live || e.button > 0) return;
      const i = this.sqAt(e); if (i == null) return;
      if (this.sel != null && this.targets(this.sel).includes(iSq(i))) {
        if (confirmOn() && this.pend !== i) { this.pend = i; const mk = Object.assign({}, this.marks, { okp: [iSq(i)] }); this.setMarks(mk); haptic('move'); return; }
        const f = this.sel; this.pend = null; this.unselect(); this.live.onMove(iSq(f), iSq(i)); return;
      }
      this.pend = null;
      const B = parseBoard(this.fen); const p = B[i];
      if (p && p.c === this.live.color) {
        this.select(i);
        const it = this.items.find(x => x.idx === i);
        if (it) { this.drag = { i, it, moved: false, x: e.clientX, y: e.clientY }; try { el.setPointerCapture(e.pointerId); } catch (err) { /* sem captura */ } }
      } else this.unselect();
    });
    el.addEventListener('pointermove', e => {
      if (!this.drag) return; lastEv = e;
      if (!this.drag.moved && Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) < 4) return;
      if (!this.drag.moved) { this.drag.moved = true; this.drag.it.el.classList.add('drag'); }
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0; if (!this.drag || !lastEv) return;
        const r = el.getBoundingClientRect();
        const px = (lastEv.clientX - r.left) / r.width * 8 - .5, py = (lastEv.clientY - r.top) / r.height * 8 - .5;
        this.drag.it.el.style.transform = 'translate(' + (px * 100) + '%,' + (py * 100) + '%)';
      });
    });
    const end = e => {
      if (!this.drag) return; const d = this.drag; this.drag = null;
      if (!d.moved) return;
      d.it.el.classList.remove('drag');
      const t = this.sqAt(e);
      if (t != null && t !== d.i && this.targets(d.i).includes(iSq(t))) { this.unselect(); this.instant(() => { d.it.el.style.transform = this.tf(t); }); this.live.onMove(iSq(d.i), iSq(t)); }
      else d.it.el.style.transform = this.tf(d.i);
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
}
function arrowPts(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = -uy, py = ux;
  const w = .16, hw = .44, hl = .44;
  const ex = x2 - ux * .12, ey = y2 - uy * .12, sx = x1 + ux * .28, sy = y1 + uy * .28, bx = ex - ux * hl, by = ey - uy * hl;
  const P = [[sx + px * w / 2, sy + py * w / 2], [bx + px * w / 2, by + py * w / 2], [bx + px * hw / 2, by + py * hw / 2], [ex, ey], [bx - px * hw / 2, by - py * hw / 2], [bx - px * w / 2, by - py * w / 2], [sx - px * w / 2, sy - py * w / 2]];
  return P.map(p => p[0].toFixed(3) + ',' + p[1].toFixed(3)).join(' ');
}

/* ---------- motor no navegador ---------- */
const Engine = {
  w: null, ready: null, busy: Promise.resolve(), h: null, elo: 0,
  init() {
    if (!this.ready) this.ready = this.start('engine/sf.js').catch(() => this.start('engine/sf-asm.js'));
    return this.ready;
  },
  start(path) {
    return new Promise((res, rej) => {
      let w; try { w = new Worker(path); } catch (e) { rej(e); return; }
      const t = setTimeout(() => { w.terminate(); rej(new Error('timeout')); }, 25000);
      w.onmessage = e => { const l = String(e.data); if (this.h) this.h(l); if (l === 'uciok') { clearTimeout(t); this.w = w; w.postMessage('setoption name Hash value 32'); res(); } };
      w.onerror = e => { clearTimeout(t); w.terminate(); rej(e); };
      w.postMessage('uci');
    });
  },
  go(fen, ms, opts) {
    const elo = (opts && opts.elo) || 0, multi = (opts && opts.multi) || 1;
    const run = () => new Promise(res => {
      let last = null; const turn = fen.split(' ')[1], lines = [];
      const parse = l => { let cp = null, mate = null; const mm = l.match(/score (cp|mate) (-?\d+)/); if (mm) { if (mm[1] === 'cp') cp = +mm[2]; else mate = +mm[2]; } const s = turn === 'w' ? 1 : -1; return { cp: cp == null ? null : cp * s, mate: mate == null ? null : mate * s, pv: l.split(' pv ')[1].trim().split(' ').slice(0, 8) }; };
      this.h = l => {
        if (l.startsWith('info') && l.includes(' pv ') && l.includes(' score ')) { const mp = l.match(/ multipv (\d+)/), k = mp ? +mp[1] : 1; if (k === 1) last = l; if (multi > 1) lines[k - 1] = parse(l); }
        if (l.startsWith('bestmove')) {
          this.h = null; let cp = null, mate = null, pv = [];
          if (last) { const x = parse(last); cp = x.cp; mate = x.mate; pv = x.pv; }
          const best = l.split(' ')[1];
          res({ cp, mate, best: best === '(none)' ? null : best, pv, lines: multi > 1 ? lines : null });
        }
      };
      if ((this.mpv || 1) !== multi) { this.w.postMessage('setoption name MultiPV value ' + multi); this.mpv = multi; }
      if (this.elo !== elo) { if (elo) { this.w.postMessage('setoption name UCI_LimitStrength value true'); this.w.postMessage('setoption name UCI_Elo value ' + elo); } else this.w.postMessage('setoption name UCI_LimitStrength value false'); this.elo = elo; }
      this.w.postMessage('position fen ' + fen); this.w.postMessage('go movetime ' + ms);
    });
    const p = this.busy.then(run); this.busy = p.catch(() => {}); return p;
  }
};
const ANALYZING = new Map();
async function analyzeGame(g, onProg) {
  if (ANALYZING.has(g.id)) return ANALYZING.get(g.id);
  const job = (async () => {
    await Engine.init(); const P = prep(g); const evs = [];
    for (let i = 0; i < P.fens.length; i++) {
      let c; try { c = new Chess(P.fens[i]); } catch (e) { c = null; }
      if (c && c.isGameOver()) evs.push(c.isCheckmate() ? [null, 0, null, '', c.turn()] : [0, null, null, '', null]);
      else { const r = await Engine.go(P.fens[i], 220); evs.push([r.cp, r.mate, r.best, r.pv.join(' '), null]); }
      if (onProg) onProg((i + 1) / P.fens.length);
    }
    S.an[g.id] = evs;
    MEM.an = MEM.an || {}; MEM.an[g.id] = evs; kv.set('an', MEM.an); setTimeout(cloudPushLocalAn, 0); gsSchedule();
    attachAnalysis(P); TRAIN = null; return P;
  })();
  ANALYZING.set(g.id, job);
  try { return await job; } finally { ANALYZING.delete(g.id); }
}

/* ---------- textos ---------- */
const TC = { rapid: 'Rápida', blitz: 'Blitz', bullet: 'Bullet', daily: 'Diária', classical: 'Clássica' };
const tcLabel = g => (TC[g.tc] || 'Partida') + (g.tc !== 'daily' && +g.ctl ? ' ' + Math.round(+g.ctl / 60) + ' min' : '');
const DFMT = [new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }), new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })], DCACHE = new Map();
const dateLabel = (t, y) => { const k = t + (y ? 'y' : ''); let v = DCACHE.get(k); if (v == null) { v = DFMT[y ? 1 : 0].format(new Date(t * 1000)).replace('.', ''); if (DCACHE.size > 5000) DCACHE.clear(); DCACHE.set(k, v); } return v; };
const HOW = { checkmated: 'por mate', resigned: 'por desistência', timeout: 'por tempo', abandoned: 'por abandono', lose: '', lost: '' };
const DRAWS = { agreed: 'Empate combinado', repetition: 'Empate por repetição', stalemate: 'Afogamento', insufficient: 'Empate: material insuficiente', '50move': 'Empate: regra dos 50 lances', timevsinsufficient: 'Empate: tempo vs. material insuficiente' };
function resultOf(g) {
  if (g.res === 'win') return { k: 'W', short: 'V', label: 'Vitória ' + (HOW[g.oRes] || '') };
  if (DRAWS[g.res]) return { k: 'D', short: 'E', label: DRAWS[g.res] };
  return { k: 'L', short: 'D', label: 'Derrota ' + (HOW[g.res] || '') };
}
const OPN = new Map();
function opName(g) { const raw = String(g.op || g.eco || 'Abertura'); let v = OPN.get(raw); if (v == null) { v = opNameRaw(raw); OPN.set(raw, v); } return v; }
function opNameRaw(raw) {
  let s = raw.replace(/\s*\.\.\..*$/, '').replace(/\s\d+\..*$/, '').trim();
  const T = [['Queens Pawn Game', 'Jogo do Peão da Dama'], ['Kings Pawn Game', 'Jogo do Peão do Rei'], ['Kings Pawn Opening', 'Abertura do Peão do Rei'], ['Queens Gambit Declined', 'Gambito da Dama Recusado'], ['Queens Gambit Accepted', 'Gambito da Dama Aceito'], ['Queens Gambit', 'Gambito da Dama'],
    ['Sicilian Defense', 'Defesa Siciliana'], ['Alapin Sicilian Defense', 'Siciliana Alapin'], ['Caro Kann Defense', 'Caro-Kann'], ['Scotch Game', 'Abertura Escocesa'], ['Scotch Gambit', 'Gambito Escocês'], ['Englund Gambit', 'Gambito Englund'], ['Scandinavian Defense', 'Defesa Escandinava'], ['Philidor Defense', 'Defesa Philidor'], ['French Defense', 'Defesa Francesa'], ['Kings Indian Defense', 'Índia do Rei'], ['Alekhine Defense', 'Defesa Alekhine'], ['Alekhines Defense', 'Defesa Alekhine'], ['Modern Defense', 'Defesa Moderna'], ['Pirc Defense', 'Defesa Pirc'], ['Ruy Lopez Opening', 'Ruy López'], ['Ruy Lopez', 'Ruy López'], ['Giuoco Piano Game', 'Giuoco Piano'], ['Italian Game', 'Italiana'], ['Petrovs Defense', 'Defesa Petrov'], ['Russian Game', 'Defesa Petrov'], ['Kings Fianchetto Opening', 'Fianqueto do Rei'], ['Zukertort Opening', 'Abertura Zukertort'], ['Vienna Game', 'Partida Vienense'], ['Four Knights Game', 'Quatro Cavalos'], ['Two Knights Defense', 'Dois Cavalos'], ['Accelerated Dragon', 'Dragão Acelerado'], ['Smith-Morra Gambit', 'Gambito Smith-Morra'],
    ['Exchange Variation', 'variante da troca'], ['Advance Variation', 'variante do avanço'], ['Classical Variation', 'variante clássica'], ['Main Line', 'linha principal'], ['Variation', 'variante'], ['Old Sicilian', 'Siciliana antiga'], ['Advance', 'Avanço'], ['Exchange', 'Troca'], ['Kings Knight', 'Cavalo do Rei'], ['Opening', 'Abertura'], ['Defense', 'Defesa'], ['Gambit', 'Gambito'], ['Attack', 'Ataque'], ['Declined', 'Recusado'], ['Accepted', 'Aceito']];
  for (const [a, b] of T) s = s.replace(new RegExp('\\b' + a.replace(/[-]/g, '\\-') + '\\b', 'g'), b);
  return s;
}

/* ---------- treino: agregação ---------- */
let TRAIN = null;
function analyzedGames() { return S.games.filter(g => S.an[g.id]); }
function buildTraining() {
  if (TRAIN) return TRAIN;
  const tags = { hang: 0, tactic: 0, mate: 0, allowMate: 0, time: 0 }, phase = { abertura: 0, 'meio-jogo': 0, final: 0 }, puzzles = [];
  let userMoves = 0, errs = 0; const accs = [];
  for (const g of analyzedGames()) {
    const P = prep(g); if (!P.cls) continue;
    if (P.acc && P.acc[g.c] != null) accs.push(P.acc[g.c]);
    for (let i = 0; i < P.moves.length; i++) {
      const m = P.moves[i]; if (m.color !== g.c) continue; userMoves++;
      const c = P.cls[i]; if (!BAD[c.k]) continue; errs++;
      const ph = phaseOf(parseBoard(P.fens[i]), i); phase[ph]++;
      if (g.clk && g.clk[i] != null && +g.ctl && g.clk[i] < +g.ctl * 0.15) tags.time++;
      const eb = P.evs[i], ea = P.evs[i + 1], me = g.c;
      if (isMateFor(eb, me)) tags.mate++;
      if (isMateFor(ea, other(me)) && !isMateFor(eb, other(me))) tags.allowMate++;
      const rl = lineSan(m.after, ea && ea.pv.length ? ea.pv : (ea && ea.best ? [ea.best] : []));
      if (rl.length) { const R2 = settledSwing(m.after, rl.slice(0, 8), other(me)); if (R2.sure && R2.v >= 2) tags.hang++; }
      const bl = lineSan(P.fens[i], eb && eb.pv.length ? eb.pv : (eb && eb.best ? [eb.best] : []));
      if (bl.length && !isMateFor(eb, me)) { const BF = factsFor(P.fens[i], bl[0].m, i); if (BF.fork || BF.pins.length || materialSwing(P.fens[i], bl.slice(0, 6), me) >= 2) tags.tactic++; }
      if (c.k !== 'inacc' && eb && eb.best) puzzles.push({ key: g.id + ':' + i, gid: g.id, ply: i, k: c.k, loss: c.loss, side: me, best: eb.best, played: m.san, mate: isMateFor(eb, me) ? Math.abs(eb.mate) : 0 });
    }
  }
  puzzles.sort((a, b) => b.loss - a.loss);
  const prios = [
    { k: 'hang', n: tags.hang }, { k: 'middle', n: phase['meio-jogo'] }, { k: 'tactic', n: tags.tactic },
    { k: 'mate', n: tags.mate + tags.allowMate, extra: tags.allowMate + ' vezes você permitiu mate; ' + tags.mate + ' vezes havia mate a seu favor.' },
    { k: 'opening', n: phase.abertura }, { k: 'endgame', n: phase.final }, { k: 'time', n: tags.time }
  ].filter(x => x.n > 0).sort((a, b) => b.n - a.n);
  TRAIN = { tags, phase, puzzles, prios, errs, userMoves, games: analyzedGames().length, acc: avg(accs) };
  return TRAIN;
}
const L = 'https://lichess.org/training/';
const LESSONS = {
  hang: { t: 'Material que fica pendurado', d: 'Logo depois do seu lance, o adversário ganhou material.', how: ['Antes de soltar a peça: o que ela ataca e quem pode atacá-la na casa nova?', 'Conte atacantes e defensores da casa. Se o adversário tem mais atacantes, a peça cai.', 'Rotina antes de cada lance: xeques, capturas e ameaças do adversário; depois as suas.'], links: [['Peça pendurada', L + 'hangingPiece'], ['Peça presa', L + 'trappedPiece']] },
  middle: { t: 'Meio-jogo', d: 'A maior parte dos seus erros acontece entre a abertura e o final.', how: ['A cada lance do adversário, pergunte: o que ele quer fazer agora?', 'Escolha um plano simples: melhorar a pior peça, abrir uma coluna para a torre, atacar uma fraqueza.', 'Evite lances "de espera" sem função; todo lance precisa de um motivo.'], links: [['Puzzles de meio-jogo', L + 'middlegame'], ['Ataque descoberto', L + 'discoveredAttack']] },
  tactic: { t: 'Táticas que passaram', d: 'Havia um lance que ganhava material e ele não foi jogado.', how: ['Procure peças desprotegidas e reis expostos: são os alvos das táticas.', 'Garfo: uma peça atacando duas. Cravada: uma peça presa a outra mais valiosa.', 'Faça 10 a 15 puzzles curtos por dia, sempre do mesmo tema por uma semana.'], links: [['Garfo', L + 'fork'], ['Cravada', L + 'pin'], ['Espeto', L + 'skewer']] },
  mate: { t: 'Padrões de mate', d: 'Mates permitidos e mates que estavam disponíveis.', how: ['Rei rocado sem "respiro" (h3 ou g3) é alvo do mate na primeira fileira.', 'Coluna aberta perto do seu rei é sinal de perigo: cubra antes de capturar material.', 'Antes de cada lance, conte os xeques do adversário.'], links: [['Mate em 1', L + 'mateIn1'], ['Mate em 2', L + 'mateIn2'], ['Mate na 1ª fileira', L + 'backRankMate']] },
  opening: { t: 'Abertura', d: 'Erros nos primeiros 10 lances.', how: ['Desenvolva cavalos e bispos antes de mover a mesma peça duas vezes.', 'Roque cedo; evite saídas de dama antes do lance 6.', 'Para cada abertura do seu repertório, conheça o plano, não só os lances.'], links: [['Puzzles de abertura', L + 'opening'], ['Exercícios guiados', 'https://lichess.org/practice']] },
  endgame: { t: 'Finais', d: 'Erros com poucas peças no tabuleiro.', how: ['No final o rei é peça de ataque: centralize-o.', 'Peão passado deve avançar, com apoio do rei.', 'Em finais de torre, torre atrás do peão passado.'], links: [['Puzzles de final', L + 'endgame'], ['Finais de torre', L + 'rookEndgame'], ['Exercícios guiados', 'https://lichess.org/practice']] },
  time: { t: 'Relógio', d: 'Erros cometidos com menos de 15% do tempo inicial.', how: ['Gaste mais tempo nos momentos críticos (trocas, sacrifícios, rei exposto) e menos em lances óbvios.', 'No blitz, decida com regras simples: xeques, capturas, ameaças.', 'Jogue partidas com incremento (3+2, 10+5) para treinar sem perder no tempo.'], links: [['Puzzle Storm', 'https://lichess.org/storm']] }
};

/* ---------- navegação ---------- */
const VIEWS = ['painel', 'partidas', 'analise', 'treino', 'arena', 'stats'];
function route() {
  const h = (location.hash || '').replace('#', '');
  const v = VIEWS.includes(h) ? h : 'painel';
  if (v === S.view && $('#v-' + v).classList.contains('on')) return;
  showView(v);
}
/* Troca de aba: a aba aparece no mesmo toque; só reconstrói se os dados mudaram, e depois do primeiro quadro. */
const VKEY = {};
function dataKey() { return acctKey() + ':' + S.games.length + ':' + (S.games[0] ? S.games[0].id : '') + ':' + Object.keys(S.an).length + ':' + Object.keys(CRIT).length; }
function viewKey(v) {
  const b = dataKey(), today = JSON.stringify(store.get('act', {})[dayKey(new Date())] || {}) + ':' + dailyCount();
  if (v === 'painel') return b + ':' + today;
  if (v === 'partidas') return b + ':' + S.filter + ':' + (S.limit || 60) + ':' + ANALYZING.size;
  if (v === 'analise') return S.vx || S.guess || S.pendingGuess || S.shownGid !== S.gid || S.shownPly !== S.ply ? null : b + ':' + S.gid;
  if (v === 'treino') return S.pendingReview || S.pendingWarm || S.pendingPz ? null : b + ':' + today + ':' + JSON.stringify(store.get('arena', {})).length + ':' + store.get('xbest', 0) + ':' + JSON.stringify(store.get('rep', {})).length + ':' + (repReady() ? 1 : 0);
  if (v === 'stats') return b;
  return null;
}
function renderView(v) {
  if (v === 'painel') renderPainel();
  if (v === 'partidas') renderPartidas();
  if (v === 'analise') renderAnalise();
  if (v === 'treino') renderTreino();
  if (v === 'arena') renderArena();
  if (v === 'stats') renderStats();
}
function showView(v) {
  const first = !S.view;
  S.view = v;
  for (const x of VIEWS) $('#v-' + x).classList.toggle('on', x === v);
  if (S.swipeDir) swipeMark($('#v-' + v));
  const nv = v === 'arena' ? 'treino' : v;
  $$('[data-v]').forEach(a => { if (a.dataset.v === nv) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (v !== 'analise' && S.guess) S.guess = null;
  window.scrollTo(0, 0);
  requestAnimationFrame(movePill);
  const k = viewKey(v);
  if (k && VKEY[v] === k) { if (v === 'painel') renderHero(); return; }
  const run = () => { if (S.view !== v) return; renderView(v); VKEY[v] = viewKey(v); };
  if (first) run(); else { const tok = S.vtok = {}; requestAnimationFrame(() => setTimeout(() => { if (S.vtok === tok) run(); }, 0)); }
}
const PILLMQ = matchMedia('(max-width: 899px)');
function movePill() {
  if (PILLMQ.matches) return;
  const nav = $('#tabs'), a = $('#tabs a[aria-current="page"]'), pill = $('#tabs .pill');
  if (!a || !nav.offsetParent) return;
  pill.style.width = a.offsetWidth + 'px'; pill.style.transform = 'translateX(' + a.offsetLeft + 'px)';
}
function openGame(id, ply) {
  S.vx = null; S.vxSetup = null; S.gid = id; const P = prep(S.games.find(g => g.id === id)); S.ply = ply != null ? ply : 0; S.flip = null;
  if (location.hash === '#analise') { S.view = ''; route(); } else location.hash = 'analise';
  return P;
}

/* ---------- PAINEL ---------- */
/* Prepara as partidas analisadas em pequenos lotes, sem travar a tela. */
let WARMING = null;
const analyzedReady = () => analyzedGames().every(g => PREP.has(g.id));
function warmPrep() {
  if (WARMING) return WARMING;
  WARMING = new Promise(res => {
    const todo = analyzedGames().filter(g => !PREP.has(g.id));
    const step = () => { const t = performance.now(); while (todo.length && performance.now() - t < 14) prep(todo.shift()); if (todo.length) setTimeout(step, 0); else { WARMING = null; TRAIN = null; res(); } };
    setTimeout(step, 0);
  });
  return WARMING;
}
const CALC = '<p class="muted">Calculando…</p>';
function renderPainel() {
  renderHero();
  const ready = analyzedReady();
  if (!ready) warmPrep().then(() => { if (S.view === 'painel') renderPainel(); });
  const T = ready ? buildTraining() : null;
  const empty = !S.games.length;
  $('#pnEmpty').hidden = !empty; $('#pnBody').hidden = empty;
  if (empty) {
    $('#pnSub').textContent = 'Conta: ' + acctLabel();
    $('#pnEmptyMsg').textContent = 'Ainda não há partidas de ' + S.me + ' no ' + PLAT[S.plat] + ' aqui. Sincronize pelo app Claude para computador ou cole o PGN das suas partidas.';
    return;
  }
  const r = AGG.rating, rapid = r.rapid || [], blitz = r.blitz || [];
  const first = rapid.concat(blitz).reduce((m, x) => Math.min(m, x[0]), Infinity);
  const last = rapid.concat(blitz).reduce((m, x) => Math.max(m, x[0]), 0);
  const ends = S.games.map(g => g.end);
  const f0 = isSeed() && isFinite(first) ? first : Math.min.apply(null, ends), l0 = isSeed() && last ? last : Math.max.apply(null, ends);
  $('#pnSub').textContent = AGG.total + ' partidas de ' + S.me + ' no ' + PLAT[S.plat] + (isSeed() ? '' : ' (sincronizadas)') + ' · ' + dateLabel(f0, true) + ' a ' + dateLabel(l0, true) + ' · ' + analyzedGames().length + ' analisadas pelo motor';
  const kp = (lab, ser) => {
    if (!ser.length) return '';
    const now = ser[ser.length - 1][1], d = now - ser[0][1], peak = Math.max.apply(null, ser.map(x => x[1]));
    return '<div class="card kpi"><span class="label">' + lab + '</span><span class="v">' + now + '</span><span class="d"><span class="' + (d >= 0 ? 'up' : 'down') + '">' + (d >= 0 ? '+' : '−') + Math.abs(d) + '</span> no período · pico ' + peak + '</span></div>';
  };
  const nOf = k => { const x = AGG.byTc[k]; return x ? x.W + x.D + x.L : 0; };
  const mainTc = ['rapid', 'blitz', 'bullet', 'daily', 'classical'].sort((a, b) => nOf(b) - nOf(a))[0];
  const R = AGG.byTc[mainTc] || { W: 0, D: 0, L: 0 }; const nR = R.W + R.D + R.L;
  $('#pnKpis').innerHTML = kp('Rápida', rapid) + kp('Blitz', blitz) +
    '<div class="card kpi"><span class="label">Aproveitamento ' + (TC[mainTc] || '').toLowerCase() + '</span><span class="v">' + pct((R.W + R.D / 2) / Math.max(1, nR) * 100) + '</span><span class="d">' + R.W + ' V · ' + R.D + ' E · ' + R.L + ' D</span></div>' +
    '<div class="card kpi"><span class="label">Precisão estimada</span><span class="v">' + (T && T.acc != null ? pct(T.acc) : '—') + '</span><span class="d">' + (T ? 'média nas ' + T.games + ' partidas analisadas' : 'calculando…') + '</span></div>';
  drawRatingChart(rapid, blitz);
  const rN = rapid.length ? rapid[rapid.length - 1][1] : 0, bN = blitz.length ? blitz[blitz.length - 1][1] : 0;
  if (rN && bN && Math.abs(rN - bN) >= 250) {
    const hi = rN > bN ? 'rápida' : 'blitz', lo = rN > bN ? 'blitz' : 'rápida';
    $('#pnInsight').hidden = false;
    $('#pnInsight').innerHTML = '<span class="label">Observação do treinador</span><p>Seu rating de ' + hi + ' está ' + Math.abs(rN - bN) + ' pontos acima do ' + lo + '. Uma diferença assim costuma vir de reconhecimento de padrões e de decisões com pouco tempo; táticas curtas e repetidas tendem a render mais que teoria de abertura.</p>';
  } else $('#pnInsight').hidden = true;
  $('#pnLast').innerHTML = lastGameCard();
  $('#prSub').textContent = T ? 'Baseado nos seus ' + T.errs + ' erros em ' + T.games + ' partidas analisadas' : 'Calculando a partir das suas partidas analisadas…';
  $('#pnPrio').innerHTML = !T ? CALC : T.prios.slice(0, 4).map(p => {
    const Ls = LESSONS[p.k];
    return '<a class="prio" href="#treino"><span class="row"><b>' + esc(Ls.t) + '</b><span class="mono muted" style="font-size:13px">' + p.n + ' de ' + T.errs + '</span></span><span class="bar"><i style="width:' + Math.round(p.n / Math.max(1, T.errs) * 100) + '%"></i></span><span class="muted" style="font-size:13px;line-height:1.4">' + esc(p.extra || Ls.d) + '</span></a>';
  }).join('') || '<p class="muted">Analise algumas partidas para gerar prioridades.</p>';
  const LH = AGG.lossHow; const parts = [['resigned', 'Desistência', 'var(--series-2)'], ['checkmated', 'Mate', 'var(--blunder)'], ['timeout', 'Tempo', 'var(--mistake)'], ['abandoned', 'Abandono', 'var(--draw)']];
  $('#pnLossBar').innerHTML = parts.map(([k, , c]) => LH[k] ? '<div style="flex:' + LH[k] + ';background:' + c + '"></div>' : '').join('');
  $('#pnLossLeg').innerHTML = parts.map(([k, n, c]) => '<span><i style="background:' + c + '"></i>' + n + '<b>' + (LH[k] || 0) + '</b></span>').join('');
  $('#pnColor').innerHTML = ['w', 'b'].map(c => {
    const x = AGG.byColor[c], n = x.W + x.D + x.L;
    return '<div class="stack" style="gap:6px"><div style="display:flex;justify-content:space-between"><b>Com as ' + SIDE[c] + '</b><span class="mono">' + (n ? pct((x.W + x.D / 2) / n * 100) : '—') + '</span></div><div class="wdl"><i style="flex:' + x.W + '"></i><i style="flex:' + x.D + '"></i><i style="flex:' + x.L + '"></i></div><span class="muted mono" style="font-size:12px">' + x.W + ' V · ' + x.D + ' E · ' + x.L + ' D</span></div>';
  }).join('');
  $('#pnOps').innerHTML = AGG.openings.slice(0, 8).map(opRow).join('');
  $('#pnSession').innerHTML = sessionCard();
  $('#pnHabits').innerHTML = habitsCard();
  $('#pnShort').innerHTML = ready ? shortCard() : '<h2 class="h-card">Derrotas curtas</h2>' + CALC;
  $('#pnClock').innerHTML = ready ? clockCard() : '<h2 class="h-card">Relógio</h2>' + CALC;
  $('#pnCmp').innerHTML = ready ? compareCard() : '<h2 class="h-card">Você × adversários do seu nível</h2>' + CALC;
  $('#pnWeeks').innerHTML = ready ? weeksCard() : '<h2 class="h-card">Evolução semanal</h2>' + CALC;
  $('#pnRadar').innerHTML = ready ? radarCard() : '<h2 class="h-card">Seu perfil</h2>' + CALC;
}
function opRow(o) {
  const sc = (o.W + o.D / 2) / o.n * 100;
  return '<div class="op"><div style="min-width:0"><div class="nm"><b>' + esc(opName({ op: o.name })) + '</b></div><div class="side">' + (o.color === 'w' ? 'brancas' : 'pretas') + ' · ' + o.W + ' V · ' + o.D + ' E · ' + o.L + ' D</div></div><div class="wdl"><i style="flex:' + o.W + '"></i><i style="flex:' + o.D + '"></i><i style="flex:' + o.L + '"></i></div><span class="pct">' + pct(sc) + '</span></div>';
}
function drawRatingChart(rapid, blitz) {
  const box = $('#pnChart'); const all = rapid.concat(blitz); if (all.length < 2) { box.innerHTML = '<p class="empty">Sem partidas de rápida ou blitz suficientes para o gráfico.</p>'; return; }
  const t0 = Math.min.apply(null, all.map(x => x[0])), t1 = Math.max.apply(null, all.map(x => x[0]));
  let lo = Math.min.apply(null, all.map(x => x[1])), hi = Math.max.apply(null, all.map(x => x[1]));
  lo = Math.floor((lo - 30) / 100) * 100; hi = Math.ceil((hi + 30) / 100) * 100;
  const X = t => (t - t0) / Math.max(1, t1 - t0) * 1000, Y = v => 200 - (v - lo) / (hi - lo) * 200;
  const path = s => s.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' ');
  let grid = '', labels = '';
  const step = (hi - lo) / 4;
  for (let k = 0; k <= 4; k++) { const v = lo + step * k, y = Y(v); grid += '<line x1="0" x2="1000" y1="' + y + '" y2="' + y + '" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"></line>'; labels += '<span class="yl" style="top:calc(' + (y / 200 * 100) + '% * (182/200))">' + Math.round(v) + '</span>'; }
  box.innerHTML = '<svg viewBox="0 0 1000 200" preserveAspectRatio="none" role="img" aria-label="Rating de rápida de ' + (rapid[0] ? rapid[0][1] : '') + ' para ' + (rapid.length ? rapid[rapid.length - 1][1] : '') + '; blitz de ' + (blitz[0] ? blitz[0][1] : '') + ' para ' + (blitz.length ? blitz[blitz.length - 1][1] : '') + '">' + grid +
    '<path d="' + path(rapid) + '" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></path>' +
    '<path d="' + path(blitz) + '" fill="none" stroke="var(--series-2)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></path></svg>' + labels +
    '<span class="xl" style="left:38px">' + dateLabel(t0) + '</span><span class="xl" style="right:0">' + dateLabel(t1) + '</span>';
}

/* ---------- PARTIDAS ---------- */
const FILTERS = [['all', 'Todas'], ['rapid', 'Rápidas'], ['blitz', 'Blitz'], ['W', 'Vitórias'], ['L', 'Derrotas'], ['todo', 'Sem análise']];
function renderPartidas() {
  const imp = S.games.length - (isSeed() ? SEED_GAMES.length : 0);
  $('#gmSub').textContent = acctLabel() + ' · ' + S.games.length + ' partidas' + (imp > 0 && isSeed() ? ' (' + imp + ' sincronizadas)' : '') + ' · ' + analyzedGames().length + ' analisadas pelo motor';
  $('#gmChips').innerHTML = FILTERS.map(([k, t]) => '<button class="chip" type="button" data-f="' + k + '" aria-pressed="' + (S.filter === k) + '">' + t + '</button>').join('');
  const gs = S.games.filter(g => {
    const f = S.filter; if (f === 'all') return true; if (f === 'rapid' || f === 'blitz') return g.tc === f;
    if (f === 'todo') return !S.an[g.id]; return resultOf(g).k === f;
  });
  const shown = gs.slice(0, S.limit || 60);
  $('#gmList').innerHTML = (gs.length ? shown.map(g => {
    const R = resultOf(g); const P = S.an[g.id] ? prep(g) : null; const busy = ANALYZING.has(g.id);
    const right = P && P.acc ? '<span class="acc">' + pct(P.acc[g.c]) + '</span><span>precisão</span>' :
      busy ? '<span class="prog" data-prog="' + g.id + '"><i style="width:0"></i></span><span>analisando</span>' :
      '<span class="btn small" data-analyze="' + g.id + '" role="button">Analisar</span>';
    return '<button class="grow" type="button" data-open="' + g.id + '"><span class="res ' + R.k + '" aria-label="' + esc(R.label) + '">' + R.short + '</span><span style="min-width:0;display:flex;flex-direction:column;gap:1px"><span class="t">vs ' + esc(g.opp) + (g.oR ? ' <span class="muted" style="font-weight:400">' + g.oR + '</span>' : '') + '</span><span class="s">' + esc(opName(g)) + '</span><span class="s">' + tcLabel(g) + ' · ' + dateLabel(g.end) + ' · ' + (g.c === 'w' ? 'brancas' : 'pretas') + ' · ' + esc(R.label.trim()) + '</span></span><span class="r">' + right + '</span></button>';
  }).join('') : '<p class="empty">' + (S.games.length ? 'Nenhuma partida neste filtro.' : 'Nenhuma partida de ' + esc(S.me) + ' ainda. Toque em “Importar partidas”.') + '</p>') +
    (gs.length > shown.length ? '<div style="padding:12px 16px;border-top:1px solid var(--line);display:flex;justify-content:center"><button class="btn" type="button" id="gmMore">Mostrar mais (' + (gs.length - shown.length) + ' restantes)</button></div>' : '');
}
async function runAnalysis(id) {
  const g = S.games.find(x => x.id === id); if (!g) return;
  toast('Analisando com o Stockfish…');
  try {
    await analyzeGame(g, p => { $$('[data-prog="' + id + '"] i').forEach(i => { i.style.width = Math.round(p * 100) + '%'; }); });
    toast('Análise concluída');
  } catch (e) { toast('O motor não carregou neste navegador'); }
  if (S.view === 'partidas') renderPartidas();
  if (S.view === 'analise' && S.gid === id) renderAnalise();
}

/* ---------- ANÁLISE ---------- */
let AB = null;
function currentP() {
  if (!S.games.length) return null;
  if (!S.gid || !S.games.find(g => g.id === S.gid)) {
    let pick = null;
    for (const g of S.games) {
      if (!S.an[g.id]) continue; const P = prep(g); if (!P.cls) continue;
      const i = P.cls.findIndex((c, k) => P.moves[k].color === g.c && c.k === 'blunder');
      if (i >= 0) { pick = { g, ply: i + 1 }; break; }
    }
    if (!pick) pick = { g: S.games[0], ply: 0 };
    S.gid = pick.g.id; S.ply = pick.ply;
  }
  return prep(S.games.find(g => g.id === S.gid));
}
function renderAnalise() {
  if (!AB) AB = new Board($('#anBoard'));
  const P = currentP();
  if (!P) {
    AB.setPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', false); AB.setMarks({}); AB.setArrows([]);
    $('#anHead').innerHTML = '<div class="stack" style="gap:3px"><span class="label">' + esc(acctLabel()) + '</span><span class="who">Nenhuma partida para analisar</span></div>';
    $('#coach').innerHTML = '<p>Sincronize sua conta ou cole o PGN de uma partida para começar.</p><button class="btn primary" type="button" data-open-sync>Sincronizar partidas</button>';
    $('#moves').innerHTML = ''; $('#gbox').innerHTML = '';
    return;
  }
  const g = P.g; const R = resultOf(g);
  if (S.flip == null) S.flip = g.c === 'b';
  AB.setFlip(S.flip); $('#evV').classList.toggle('flip', S.flip);
  const me = g.c === 'w' ? [S.me, g.mR] : [g.opp, g.oR], them = g.c === 'w' ? [g.opp, g.oR] : [S.me, g.mR];
  $('#anHead').innerHTML = '<div class="stack" style="gap:3px;min-width:0"><span class="label">' + tcLabel(g) + ' · ' + dateLabel(g.end, true) + ' · ' + esc(opName(g)) + '</span><span class="who">' + esc(me[0]) + (me[1] ? ' <span>' + me[1] + '</span>' : '') + ' <span>vs</span> ' + esc(them[0]) + (them[1] ? ' <span>' + them[1] + '</span>' : '') + '</span></div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><span class="tag ' + R.k + '">' + esc(R.label.trim()) + '</span>' + (P.acc ? '<span class="tag plain">Precisão: você ' + pct(P.acc[g.c]) + ' · adversário ' + pct(P.acc[other(g.c)]) + '</span>' : '') + (P.cls ? '<button class="btn small accent" type="button" data-guess="start">Adivinhe o lance</button>' : '') + '<button class="btn small" type="button" data-dos="' + esc(g.opp) + '">Dossiê</button><button class="btn small" type="button" data-card>Cartão</button><button class="btn small" type="button" data-pgn>PGN</button><span class="tag plain" id="critChip" hidden>Momentos críticos…</span></div>' + queueBar(g);
  drawGraph(P); drawTime(P); drawMoves(P); critAuto(P);
  S.ply = Math.max(0, Math.min(S.ply, P.moves.length));
  if (S.guess && S.guess.gid !== g.id) S.guess = null;
  if (S.guess) guessShow(); else if (S.vx) showVariant(false); else showPly(P, S.ply, false);
  if (S.pendingGuess === g.id) { S.pendingGuess = null; startGuess(); }
}
function setPly(n) {
  const P = currentP(); if (!P) return; n = Math.max(0, Math.min(n, P.moves.length));
  if (S.guess) { S.guess = null; S.ply = n; showPly(P, n, false); return; }
  if (S.vx || S.vxSetup) { S.vx = null; S.vxSetup = null; $('#vxBar').hidden = true; S.ply = n; showPly(P, n, false); return; }
  if (n === S.ply) return; const step = Math.abs(n - S.ply) === 1; S.ply = n; showPly(P, n, step);
}
function showPly(P, n, animate) {
  S.shownGid = P.g.id; S.shownPly = n;
  AB.setPosition(P.fens[n], animate);
  const m = n > 0 ? P.moves[n - 1] : null; const marks = {}; const arrows = [];
  if (m) {
    marks.last = [m.from, m.to];
    if (P.cls) marks.badge = { sq: m.to, k: P.cls[n - 1].k };
    const c = P.cls ? P.cls[n - 1] : null;
    if (c && BAD[c.k]) {
      const eb = P.evs[n - 1], ea = P.evs[n];
      if (eb && eb.best) arrows.push({ from: eb.best.slice(0, 2), to: eb.best.slice(2, 4), cls: 'a-best' });
      if (ea && ea.best) arrows.push({ from: ea.best.slice(0, 2), to: ea.best.slice(2, 4), cls: 'a-bad' });
    }
    const A = parseBoard(P.fens[n]); marks.risk = hanging(A, m.color).slice(0, 3).map(h => iSq(h.idx));
  }
  const ch = new Chess(P.fens[n]);
  if (ch.inCheck()) { const B = parseBoard(P.fens[n]); const k = B.findIndex(p => p && p.t === 'k' && p.c === ch.turn()); if (k >= 0) marks.check = iSq(k); }
  AB.setMarks(marks); AB.setArrows(arrows);
  updateEval(P.evs ? P.evs[n] : null, P.g.c);
  const cur = $('#gcur'); if (cur) cur.style.left = (n / Math.max(1, P.moves.length) * 100) + '%';
  const tc0 = $('#tcur'); if (tc0) tc0.style.left = (Math.max(0, n - 1) / Math.max(1, P.moves.length) * 100) + '%';
  $$('#moves .mv').forEach(b => b.setAttribute('aria-current', String(+b.dataset.p === n)));
  // rolar a lista de lances no próximo quadro: evita medir o layout no meio da troca de tela
  const mtok = S.mvTok = {};
  requestAnimationFrame(() => { if (S.mvTok !== mtok || S.view !== 'analise') return; const act = $('#moves .mv[aria-current="true"]'), box = $('#moves'); if (act) { const top = act.offsetTop - box.clientHeight / 2 + act.offsetHeight / 2; box.scrollTop = Math.max(0, top); } else if (n === 0) box.scrollTop = 0; });
  $('#gbox').setAttribute('aria-valuenow', String(n));
  renderCoach(P, n);
  armAnalysis();
}
/* ---------- variantes e jogo contra o motor ---------- */
const ELOS = [[1350, '1350'], [1600, '1600'], [1900, '1900'], [2200, '2200'], [0, 'Máximo']];
const moveNum = i => (Math.floor(i / 2) + 1) + (i % 2 ? '… ' : '. ');
function updateEval(e, myColor) {
  const w = wpWhite(e);
  $('#evV i').style.transform = 'scaleY(' + (w / 100).toFixed(3) + ')';
  const t = $('#evVt'); t.textContent = e ? evTxt(e).replace('−', '-') : '';
  const whiteBottom = !S.flip; const whiteAhead = w >= 50;
  t.style.top = (whiteAhead === whiteBottom) ? 'auto' : '4px'; t.style.bottom = (whiteAhead === whiteBottom) ? '4px' : 'auto';
  t.style.color = whiteAhead ? 'var(--evb)' : 'var(--evw)';
  $('#evH i').style.transform = 'scaleX(' + (w / 100).toFixed(3) + ')';
  $('#evHl').textContent = 'Brancas' + (myColor === 'w' ? ' (você)' : '');
  $('#evHr').textContent = e ? (e.mate != null && e.mate !== 0 ? (e.mate > 0 ? 'Brancas' : 'Pretas') + ' dão mate em ' + Math.abs(e.mate) : (e.mate === 0 || e.mated ? 'Xeque-mate' : 'Avaliação ' + evTxt(e))) : 'Sem análise';
}
function plansHtml(pl, myColor) {
  return '<div class="plans">' + ['w', 'b'].map(s => '<div class="plan"><b><i style="background:' + (s === 'w' ? 'var(--evw)' : 'var(--evb)') + '"></i>Ideias das ' + SIDE[s] + (s === myColor ? ' (você)' : '') + '</b><ul>' + pl[s].map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>').join('') + '</div>';
}
function analysisFen() { if (S.vx) return S.vx.fens[S.vx.fens.length - 1]; const P = currentP(); return P ? P.fens[S.ply] : null; }
function armAnalysis() {
  if (!AB) return; if (S.guess) { guessArm(); return; } const fen = analysisFen(); if (!fen) { AB.setLive(null); return; }
  const c = new Chess(fen);
  if (c.isGameOver() || S.vxSetup || (S.vx && S.vx.mode === 'play' && (c.turn() !== S.vx.userColor || S.vx.thinking))) { AB.setLive(null); return; }
  const dests = {};
  for (const m of c.moves({ verbose: true })) { const a = dests[m.from] = dests[m.from] || []; if (!a.includes(m.to)) a.push(m.to); }
  AB.setLive({ color: c.turn(), dests, marks: AB.marks, onMove: (f, t) => analysisMove(f, t) });
}
async function evalPos(fen, ms) {
  const c = new Chess(fen);
  if (c.isCheckmate()) return { cp: null, mate: 0, best: null, pv: [], mated: c.turn() };
  if (c.isGameOver()) return { cp: 0, mate: null, best: null, pv: [], mated: null };
  const r = await Engine.go(fen, ms);
  return { cp: r.cp, mate: r.mate, best: r.best, pv: r.pv, mated: null };
}
function vClass(vx, i) {
  const eb = vx.evs[i], ea = vx.evs[i + 1]; if (!eb || !ea) return null;
  const m = vx.moves[i], side = m.color, b = wpWhite(eb), a = wpWhite(ea);
  const wb = side === 'w' ? b : 100 - b, wa = side === 'w' ? a : 100 - a, loss = Math.max(0, wb - wa);
  const uci = m.from + m.to + (m.promotion || '');
  let k = eb.best === uci ? 'best' : loss < 2 ? 'exc' : loss < 10 ? 'good' : loss < 20 ? 'inacc' : loss < 30 ? 'mistake' : 'blunder';
  if (legalCount(vx.fens[i]) === 1) k = 'forced';
  return { k, loss, wb, wa };
}
function newVx(mode) {
  const P = currentP(); const fen = P.fens[S.ply];
  return { base: S.ply, fens: [fen], moves: [], evs: [P.evs ? P.evs[S.ply] : null], mode, elo: 0, userColor: fen.split(' ')[1], thinking: false };
}
async function analysisMove(from, to) {
  const P = currentP(); if (!P) return;
  if (!S.vx) {
    const m0 = P.moves[S.ply];
    if (m0 && m0.from === from && m0.to === to) { setPly(S.ply + 1); return; }
    S.vx = newVx('explore');
  }
  const vx = S.vx; const c = new Chess(vx.fens[vx.fens.length - 1]); let m;
  try { m = c.move({ from, to, promotion: 'q' }); } catch (e) { armAnalysis(); return; }
  vx.moves.push(m); vx.fens.push(c.fen()); vx.evs.push(null);
  showVariant(true);
  if (vx.mode === 'play' && !c.isGameOver()) await engineMove(vx);
  fillEvals(vx);
}
async function engineMove(vx) {
  vx.thinking = true; if (S.vx === vx) { renderVariantCoach(); armAnalysis(); }
  let r = null;
  try { await Engine.init(); r = await Engine.go(vx.fens[vx.fens.length - 1], 600, { elo: vx.elo }); } catch (e) { r = null; }
  vx.thinking = false;
  if (S.vx !== vx) return;
  if (!r || !r.best) { vx.noEngine = true; showVariant(false); return; }
  const c = new Chess(vx.fens[vx.fens.length - 1]); let m;
  try { m = c.move({ from: r.best.slice(0, 2), to: r.best.slice(2, 4), promotion: r.best[4] || undefined }); } catch (e) { showVariant(false); return; }
  vx.moves.push(m); vx.fens.push(c.fen()); vx.evs.push(null);
  showVariant(true);
}
async function fillEvals(vx) {
  if (vx.filling) return; vx.filling = true;
  try {
    await Engine.init();
    for (let i = 0; i < vx.fens.length; i++) {
      if (S.vx !== vx) break;
      if (vx.evs[i]) continue;
      if (vx.thinking) { await sleep(150); i--; continue; }
      vx.evs[i] = await evalPos(vx.fens[i], 450);
      if (S.vx === vx && !AB.drag) showVariant(false);
    }
  } catch (e) { vx.noEngine = true; if (S.vx === vx) renderVariantCoach(); }
  vx.filling = false;
  if (S.vx === vx && !vx.noEngine && vx.evs.some(e => !e)) fillEvals(vx);
}
function showVariant(animate) {
  const vx = S.vx; if (!vx) return; const n = vx.fens.length - 1, fen = vx.fens[n], m = n > 0 ? vx.moves[n - 1] : null;
  AB.setPosition(fen, animate);
  const marks = {}, arrows = [];
  if (m) { marks.last = [m.from, m.to]; const c = vClass(vx, n - 1); if (c) marks.badge = { sq: m.to, k: c.k }; }
  const ch = new Chess(fen);
  if (ch.inCheck()) { const B = parseBoard(fen); const k = B.findIndex(p => p && p.t === 'k' && p.c === ch.turn()); if (k >= 0) marks.check = iSq(k); }
  if (vx.mode === 'explore' && vx.evs[n] && vx.evs[n].best) arrows.push({ from: vx.evs[n].best.slice(0, 2), to: vx.evs[n].best.slice(2, 4), cls: 'a-next' });
  AB.setMarks(marks); AB.setArrows(arrows);
  $$('#moves .mv').forEach(b => b.setAttribute('aria-current', 'false'));
  updateEval(vx.evs[n], currentP().g.c);
  vxBar(); renderVariantCoach(); armAnalysis();
}
function plyLabel(P, base) { return base === 0 ? 'a posição inicial' : 'depois de ' + moveNum(base - 1) + fig(P.moves[base - 1].san); }
function vxBar() {
  const el = $('#vxBar'); if (!S.vx) { el.hidden = true; return; }
  const vx = S.vx, P = currentP(); el.hidden = false;
  el.innerHTML = '<span><b>' + (vx.mode === 'play' ? 'Jogando contra o Stockfish' : 'Variante') + '</b> a partir de ' + esc(plyLabel(P, vx.base)) + '</span>' +
    '<span class="vline">' + vx.moves.map((mm, i) => '<span class="mono">' + esc(moveNum(vx.base + i) + fig(mm.san)) + '</span>').join('') + '</span>' +
    '<button class="btn small" type="button" data-vx="exit">Voltar à partida</button>';
}
function overText(c, vx) {
  if (c.isCheckmate()) {
    const loser = c.turn();
    if (vx.mode === 'play') return loser === vx.userColor ? ['no', 'Xeque-mate. O motor venceu esta.'] : ['ok', 'Xeque-mate! Você venceu.'];
    return ['hint', 'Xeque-mate: as ' + SIDE[other(loser)] + ' vencem.'];
  }
  const why = c.isStalemate() ? ' por afogamento' : c.isThreefoldRepetition() ? ' por repetição' : c.isInsufficientMaterial() ? ' por material insuficiente' : '';
  return ['hint', 'Empate' + why + '.'];
}
function renderVariantCoach() {
  const vx = S.vx, box = $('#coach'); if (!vx || S.vxSetup) return;
  const P = currentP(), n = vx.moves.length, fen = vx.fens[n], c0 = new Chess(fen);
  let h = '<div class="hd"><span class="label">' + (vx.mode === 'play' ? 'Jogando contra o Stockfish · ' + (vx.elo ? 'força ~' + vx.elo : 'força máxima') + ' · você de ' + SIDE[vx.userColor] : 'Explorando variante') + '</span></div>';
  if (c0.isGameOver()) { const o = overText(c0, vx); h += '<div class="fb ' + o[0] + '">' + esc(o[1]) + '</div>'; }
  else if (vx.thinking) h += '<p class="muted">O motor está pensando…</p>';
  else if (vx.mode === 'play') h += '<p class="muted">Sua vez: mova uma peça.</p>';
  let i = n - 1;
  if (vx.mode === 'play') while (i >= 0 && vx.moves[i].color !== vx.userColor) i--;
  if (i >= 0) {
    const m = vx.moves[i], c = vClass(vx, i), F = factsFor(vx.fens[i], m, vx.base + i);
    if (vx.mode === 'play') h += '<span class="label">Seu último lance</span>';
    h += '<div class="hd">' + (c ? '<span class="kb k-' + c.k + '">' + esc(CLS[c.k].s) + ' ' + CLS[c.k].t + '</span>' : '<span class="muted" style="font-size:13px">Calculando…</span>') + '<span class="san">' + esc(moveNum(vx.base + i) + fig(m.san)) + '</span>' + (vx.evs[i] && vx.evs[i + 1] ? '<span class="ev">' + evTxt(vx.evs[i]) + ' → ' + evTxt(vx.evs[i + 1]) + '</span>' : '') + '</div>';
    h += '<div class="blk"><h3>O que o lance faz</h3><p>' + esc(ideaSentences(F, m).join(' ')) + '</p></div>';
    if (c) {
      const t = c.k === 'best' ? 'É exatamente o lance do motor.' : c.k === 'forced' ? 'Único lance legal.' : 'Chance estimada de vitória das ' + SIDE[m.color] + ': ' + pct(c.wb) + ' → ' + pct(c.wa) + '.';
      h += '<div class="blk"><h3' + (BAD[c.k] ? ' class="bad"' : '') + '>Avaliação</h3><p>' + esc(t) + '</p></div>';
      const eb = vx.evs[i];
      if (c.k !== 'best' && c.k !== 'forced' && eb && eb.best) {
        const bl = lineSan(vx.fens[i], eb.pv.length ? eb.pv : [eb.best]);
        if (bl[0]) { const why = ideaShort(factsFor(vx.fens[i], bl[0].m, vx.base + i), bl[0].m); h += '<div class="bestbox"><h3>Melhor era ' + esc(moveNum(vx.base + i) + fig(bl[0].san)) + '</h3><p>' + esc((why ? cap(why) + '. ' : '') + 'Linha: ' + bl.slice(0, 5).map(x => fig(x.san)).join(' ') + '.') + '</p></div>'; }
      }
      const ea = vx.evs[i + 1];
      if (vx.mode === 'explore' && i === n - 1 && ea && ea.best) {
        const rl = lineSan(vx.fens[i + 1], ea.pv.length ? ea.pv : [ea.best]);
        if (rl[0]) { const why = ideaShort(factsFor(vx.fens[i + 1], rl[0].m, vx.base + i + 1), rl[0].m); h += '<div class="blk"><h3>Resposta do motor</h3><p>' + esc(fig(rl[0].san) + (why ? ', que ' + why : '') + '. Linha: ' + rl.slice(0, 5).map(x => fig(x.san)).join(' ') + '.') + '</p></div>'; }
      }
    }
    if (i === 0 && vx.mode === 'explore' && P.moves[vx.base]) {
      const gm = P.moves[vx.base], gc = P.cls ? P.cls[vx.base] : null;
      h += '<p class="muted" style="font-size:13.5px">Na partida foi jogado ' + esc(fig(gm.san)) + (gc ? ' (' + CLS[gc.k].t.toLowerCase() + ')' : '') + '.</p>';
    }
  } else if (vx.mode === 'explore') h += '<p>Mova uma peça para testar um lance.</p>';
  if (vx.noEngine) h += '<div class="warn">O motor não carregou neste navegador; mostrando só os fatos do lance.</div>';
  if (vx.mode === 'explore' && !c0.isGameOver()) h += plansHtml(plansAt(fen, vx.evs[n], vx.base + n), P.g.c);
  h += '<div class="vxacts">' + (n ? '<button class="btn small" type="button" data-vx="undo">Desfazer</button>' : '') +
    (vx.mode === 'explore' ? '<button class="btn small accent" type="button" data-vx="play">Jogar daqui contra o motor</button>' : '<button class="btn small" type="button" data-vx="explore">Parar e analisar</button>') +
    '<button class="btn small" type="button" data-vx="exit">Voltar à partida</button></div>';
  box.innerHTML = '<div class="stack" style="gap:14px">' + h + '</div>';
}
function renderPlaySetup() {
  const su = S.vxSetup; if (!su) return; const P = currentP();
  const base = S.vx ? 'a posição atual da variante' : plyLabel(P, S.ply);
  $('#coach').innerHTML = '<div class="stack fade" style="gap:14px"><div class="hd"><span class="label">Jogar daqui contra o motor</span></div>' +
    '<p>Continue a partida a partir de ' + esc(base) + ' contra o Stockfish.</p>' +
    '<div class="stack" style="gap:6px"><span class="label">Força do motor (aproximada)</span><div class="seg">' + ELOS.map(([v, t]) => '<button type="button" data-vx="elo:' + v + '" aria-pressed="' + (su.elo === v) + '">' + t + '</button>').join('') + '</div></div>' +
    '<div class="stack" style="gap:6px"><span class="label">Você joga de</span><div class="seg"><button type="button" data-vx="color:w" aria-pressed="' + (su.color === 'w') + '">Brancas</button><button type="button" data-vx="color:b" aria-pressed="' + (su.color === 'b') + '">Pretas</button></div></div>' +
    '<div class="vxacts"><button class="btn primary" type="button" data-vx="start">Começar</button><button class="btn" type="button" data-vx="cancel">Cancelar</button></div></div>';
}
function exitVx() { S.vx = null; S.vxSetup = null; $('#vxBar').hidden = true; const P = currentP(); if (P) showPly(P, S.ply, false); }
function refreshBoard() { if (S.vx) showVariant(false); else { const P = currentP(); if (P) showPly(P, S.ply, false); } if (S.vxSetup) { renderPlaySetup(); armAnalysis(); } }
function vxUndo() {
  const vx = S.vx; if (!vx || vx.thinking) return;
  const pop = () => { vx.moves.pop(); vx.fens.pop(); vx.evs.pop(); };
  if (!vx.moves.length) { exitVx(); return; }
  pop();
  if (vx.mode === 'play') while (vx.moves.length && vx.fens[vx.fens.length - 1].split(' ')[1] !== vx.userColor) pop();
  if (!vx.moves.length && vx.mode === 'explore') { exitVx(); return; }
  showVariant(false);
  if (vx.mode === 'play' && vx.fens[vx.fens.length - 1].split(' ')[1] !== vx.userColor) engineMove(vx).then(() => fillEvals(vx));
}
function startLine(fen, ucis, base) {
  const P = currentP(); if (!P) return;
  S.ply = Math.max(0, Math.min(base, P.moves.length)); S.vxSetup = null;
  const vx = newVx('explore');
  for (const x of lineSan(vx.fens[0], ucis)) { vx.moves.push(x.m); vx.fens.push(x.m.after); vx.evs.push(null); }
  S.vx = vx; showVariant(false); fillEvals(vx);
}
async function vxAction(a) {
  if (a === 'exit') { exitVx(); return; }
  if (a === 'undo') { vxUndo(); return; }
  if (a === 'play') { const fen = analysisFen(); S.vxSetup = { elo: store.get('elo', 1600), color: fen.split(' ')[1] }; renderPlaySetup(); armAnalysis(); return; }
  if (a === 'cancel') { S.vxSetup = null; refreshBoard(); return; }
  if (a === 'explore') { if (S.vx) { S.vx.mode = 'explore'; showVariant(false); fillEvals(S.vx); } return; }
  if (a.startsWith('elo:')) { S.vxSetup.elo = +a.slice(4); renderPlaySetup(); return; }
  if (a.startsWith('color:')) { S.vxSetup.color = a.slice(6); renderPlaySetup(); return; }
  if (a === 'start') {
    const su = S.vxSetup; S.vxSetup = null; store.set('elo', su.elo);
    if (!S.vx) S.vx = newVx('play');
    const vx = S.vx; vx.mode = 'play'; vx.elo = su.elo; vx.userColor = su.color;
    S.flip = su.color === 'b'; AB.setFlip(S.flip); $('#evV').classList.toggle('flip', S.flip);
    showVariant(false);
    if (vx.fens[vx.fens.length - 1].split(' ')[1] !== vx.userColor) await engineMove(vx);
    fillEvals(vx);
  }
}

/* ---------- conta Claude: dados em todos os aparelhos ---------- */
const Cloud = { on: false, db: null, base: '', hashes: {}, anSeen: new Set(), unsub: null };
const acctDoc = () => Cloud.base + '/' + acctKey();
async function cloudInit() {
  try {
    if (!window.claude || !window.claude.use) return false;
    const r = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    const db = r[0], user = r[1]; if (!db || !user) return false;
    const uid = await user.id(); if (!uid) return false;
    Cloud.db = db; Cloud.base = 'data/users/' + uid; Cloud.on = true; return true;
  } catch (e) { return false; }
}
function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + s.length; }
let prefsTimer = 0;
function cloudPrefsPush() {
  progressChanged();
  if (!Cloud.on) return; clearTimeout(prefsTimer);
  prefsTimer = setTimeout(async () => {
    try { await Cloud.db.doc(Cloud.base + '/prefs').set(Object.assign({ me: S.me, plat: S.plat, t: store.get('meT', Date.now()) }, prefsSnapshot())); } catch (e) { /* tenta na próxima mudança */ }
  }, 1200);
}
async function cloudPullAccount() {
  const key = 'games:' + acctKey(); const local = MEM.games[key] = MEM.games[key] || [];
  const ids = new Set(local.map(g => g.id)); let got = 0;
  const qs = await Cloud.db.collection(acctDoc() + '/games').limit(1000).get();
  const hs = Cloud.hashes[key] = {};
  for (const d of qs.docs) {
    const body = d.data() || {}; if (typeof body.g !== 'string') continue;
    hs[d.id] = strHash(body.g);
    let arr; try { arr = JSON.parse(body.g); } catch (e) { continue; }
    for (const g of arr) if (g && g.id && !ids.has(g.id)) { local.push(g); ids.add(g.id); got++; }
  }
  got += await cloudMergeInbox(local, ids);
  if (got) { local.sort((a, b) => b.end - a.end); await kv.set(key, local); }
  return got;
}
const INBOX_DONE = new Set();
async function cloudMergeInbox(local, ids, qs) {
  let got = 0;
  try {
    qs = qs || await Cloud.db.collection(acctDoc() + '/inbox').limit(200).get();
    for (const d of qs.docs) {
      if (INBOX_DONE.has(d.id)) continue;
      const b = d.data() || {}; let arr = [];
      try { arr = JSON.parse(b.g || '[]'); } catch (e) { arr = []; }
      for (const g of arr) if (g && g.id && !ids.has(g.id)) { local.push(g); ids.add(g.id); got++; }
      INBOX_DONE.add(d.id);
    }
  } catch (e) { /* sem caixa de entrada */ }
  return got;
}
async function cloudClearInbox() {
  for (const id of Array.from(INBOX_DONE)) { try { await Cloud.db.doc(acctDoc() + '/inbox/' + id).delete(); INBOX_DONE.delete(id); } catch (e) { /* tenta depois */ } }
}
let pushingG = false, pushAgain = false;
async function cloudPushGames() {
  if (!Cloud.on) return; if (pushingG) { pushAgain = true; return; } pushingG = true;
  const key = 'games:' + acctKey(), doc = acctDoc();
  try {
    const all = (MEM.games[key] || []).slice().sort((a, b) => (a.end - b.end) || (a.id < b.id ? -1 : 1));
    const chunks = []; let cur = [], size = 2;
    for (const g of all) { const s = JSON.stringify(g).length + 1; if (cur.length && size + s > 180000) { chunks.push(cur); cur = []; size = 2; } cur.push(g); size += s; }
    if (cur.length) chunks.push(cur);
    const hs = Cloud.hashes[key] = Cloud.hashes[key] || {}; let wrote = 0;
    for (let i = 0; i < chunks.length; i++) {
      const id = 'c' + String(i).padStart(3, '0'), str = JSON.stringify(chunks[i]), h = strHash(str);
      if (hs[id] === h) continue;
      await Cloud.db.doc(doc + '/games/' + id).set({ g: str, n: chunks[i].length, t: Date.now() }); hs[id] = h; wrote++;
    }
    if (wrote) await Cloud.db.doc(doc).set({ me: S.me, plat: S.plat, games: all.length, chunks: chunks.length, t: Date.now() });
    if (doc === acctDoc()) await cloudClearInbox();
  } catch (e) { /* o próximo envio tenta de novo */ }
  pushingG = false; if (pushAgain) { pushAgain = false; cloudPushGames(); }
}
let pushingAn = false;
async function cloudPushLocalAn() {
  if (!Cloud.on || pushingAn) return; pushingAn = true;
  try {
    const doc = acctDoc();
    for (const g of S.games) {
      const evs = MEM.an && MEM.an[g.id]; if (!evs || SEED_AN[g.id] || Cloud.anSeen.has(g.id)) continue;
      await Cloud.db.doc(doc + '/an/' + g.id).set({ gid: g.id, e: JSON.stringify(evs), t: Date.now() });
      Cloud.anSeen.add(g.id);
    }
  } catch (e) { /* tenta depois */ }
  pushingAn = false;
}
let refT = 0, refG = new Set();
function scheduleRefresh(gids) {
  (gids || []).forEach(g => refG.add(g)); clearTimeout(refT);
  refT = setTimeout(() => {
    const gs = refG; refG = new Set(); if (!$('#sync').hidden) return;
    if (S.view === 'analise') { if (!S.vx && !S.vxSetup && gs.has(S.gid)) showView('analise'); return; }
    showView(S.view);
  }, 700);
}
function cloudWatchAn() {
  if (Cloud.unsubIn) { try { Cloud.unsubIn(); } catch (e) { /* já encerrado */ } Cloud.unsubIn = null; }
  if (Cloud.on) {
    try {
      Cloud.unsubIn = Cloud.db.collection(acctDoc() + '/inbox').limit(200).onSnapshot(async qs => {
        const key = 'games:' + acctKey(); const local = MEM.games[key] = MEM.games[key] || [];
        const ids = new Set(local.map(g => g.id)); if (isSeed()) for (const g of SEED_GAMES) ids.add(g.id);
        const before = local.length; const got = await cloudMergeInbox(local, ids, qs);
        if (got) {
          const fresh = local.slice(before).sort((a, b) => b.end - a.end);
          await saveGames(); refreshAll(); checkTilt();
          toast(got === 1 ? 'Nova partida vs ' + fresh[0].opp + ' chegou' : got + ' novas partidas chegaram');
        } else if (qs.docs.some(d => INBOX_DONE.has(d.id))) cloudClearInbox();
      }, () => { /* sem atualização ao vivo */ });
    } catch (e) { Cloud.unsubIn = null; }
  }
  if (Cloud.unsub) { try { Cloud.unsub(); } catch (e) { /* já encerrado */ } Cloud.unsub = null; }
  if (!Cloud.on) return; Cloud.anSeen = new Set();
  try {
    Cloud.unsub = Cloud.db.collection(acctDoc() + '/an').limit(1000).onSnapshot(qs => {
      MEM.an = MEM.an || {}; const fresh = [];
      for (const d of qs.docs) {
        Cloud.anSeen.add(d.id); if (MEM.an[d.id]) continue;
        const b = d.data() || {}; if (typeof b.e !== 'string') continue;
        try { MEM.an[d.id] = JSON.parse(b.e); fresh.push(d.id); } catch (e) { /* documento inválido */ }
      }
      if (fresh.length) {
        kv.set('an', MEM.an); loadData(); TRAIN = null;
        for (const id of fresh) { const P = PREP.get(id); if (P) attachAnalysis(P); }
        scheduleRefresh(fresh);
      }
      cloudPushLocalAn();
    }, () => { /* sem atualização ao vivo */ });
  } catch (e) { Cloud.unsub = null; }
}
async function cloudStart() {
  if (!(await cloudInit())) { if (!REPORT && isSeed()) { REPORT = SEED_REP; if (S.view === 'treino') renderTreino(); } autoSyncStart(); return; }
  try {
    const snap = await Cloud.db.doc(Cloud.base + '/prefs').get(); const p = snap.exists ? snap.data() : null;
    if (p) {
      mergePrefs(p);
      if (p.me && (p.t || 0) > store.get('meT', 0) && (p.me.toLowerCase() !== S.me.toLowerCase() || (p.plat || 'chesscom') !== S.plat)) {
        S.me = p.me; S.plat = p.plat || 'chesscom'; store.set('me', S.me); store.set('plat', S.plat); store.set('meT', p.t);
        S.gid = null; S.ply = 0; S.vx = null; await hydrate();
      }
    } else if (store.get('meT', 0)) cloudPrefsPush();
    const got = await cloudPullAccount();
    loadData(); TRAIN = null; refreshAll();
    cloudWatchAn(); cloudPushGames();
    cloudLoadReport().then(() => { if (S.view === 'treino') renderTreino(); });
    if (got) toast(got + ' partidas vieram da sua conta');
  } catch (e) { /* segue com os dados deste aparelho */ }
  autoSyncStart();
}

/* ---------- sincronização ao vivo ---------- */
const AUTO_MS = (NATIVE ? 2 : 4) * 60 * 1000; let autoT = 0, autoBusy = false;
const autoSyncOn = () => NATIVE ? store.get('auto', true) : store.get('auto', false) && !isSeed();
function updateLive() { $('#acct').classList.toggle('live', autoSyncOn()); }
function autoSyncStart() {
  clearInterval(autoT); updateLive(); if (!autoSyncOn()) return;
  autoT = setInterval(() => { if (document.visibilityState === 'visible') autoSync(); }, AUTO_MS);
  if (NATIVE && !autoSyncStart.vis) { autoSyncStart.vis = true; document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') autoSync(); }); }
  setTimeout(autoSync, 4000);
}
async function autoSync() {
  if (autoBusy || !autoSyncOn() || !$('#sync').hidden) return; autoBusy = true;
  try {
    const before = new Set(S.games.map(g => g.id)); let games = [];
    if (S.plat === 'chesscom') {
      const now = new Date(); const ms = [now]; if (now.getUTCDate() <= 2) ms.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
      for (const d of ms) {
        const u = 'https://api.chess.com/pub/player/' + encodeURIComponent(S.me.toLowerCase()) + '/games/' + d.getUTCFullYear() + '/' + String(d.getUTCMonth() + 1).padStart(2, '0');
        const tx = await browserText(u, t => monthOk(t, u));
        tx.replace(/"pgn":"((?:[^"\\]|\\.)*)"/g, (_, x) => { try { games.push(pgnToGame(JSON.parse('"' + x + '"'), S.me)); } catch (e) { /* trecho truncado */ } return ''; });
      }
    } else {
      const last = S.games.length ? Math.max.apply(null, S.games.map(g => g.end)) : 0;
      const tx = await browserText('https://lichess.org/api/games/user/' + encodeURIComponent(S.me) + '?max=50&clocks=true&opening=true' + (last ? '&since=' + (last * 1000 + 1000) : ''), t => t.includes('[Event') || t.trim().length < 400);
      games = splitPgns(tx).map(p => pgnToGame(p, S.me));
    }
    games = games.filter(g => g && !before.has(g.id)).sort((a, b) => b.end - a.end);
    if (games.length) {
      importGames(games); refreshAll(); checkTilt();
      toast(games.length === 1 ? 'Nova partida vs ' + games[0].opp + ': analisando…' : games.length + ' novas partidas: analisando…');
      for (const g of games.slice(0, 10)) { try { await analyzeGame(g); } catch (e) { break; } }
      TRAIN = null; scheduleRefresh(games.map(g => g.id)); if (S.view === 'painel') showView('painel');
      const g = games[0]; if (S.an[g.id]) toast('Relatório pronto: ' + resultOf(g).label.trim() + ' vs ' + g.opp);
    }
  } catch (e) { /* tenta no próximo ciclo */ }
  autoBusy = false;
}

/* ---------- relatório da última partida ---------- */
function lastGameCard() {
  const g = S.games[0]; if (!g) return '';
  const R = resultOf(g), P = S.an[g.id] ? prep(g) : null;
  let h = '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap"><div class="stack" style="gap:2px;min-width:0"><span class="label">Última partida · ' + tcLabel(g) + ' · ' + dateLabel(g.end, true) + '</span><b style="font-size:18px">vs ' + esc(g.opp) + (g.oR ? ' <span class="muted" style="font-weight:400">' + g.oR + '</span>' : '') + '</b><span class="muted" style="font-size:13px">' + esc(opName(g)) + ' · ' + (g.c === 'w' ? 'brancas' : 'pretas') + '</span></div><span class="tag ' + R.k + '">' + esc(R.label.trim()) + '</span></div>';
  if (P && P.cls) {
    const cnt = {}; const mine = [];
    P.cls.forEach((c, i) => { if (P.moves[i].color !== g.c) return; cnt[c.k] = (cnt[c.k] || 0) + 1; if (BAD[c.k] && c.k !== 'inacc') mine.push(i); });
    h += '<div class="lgstats"><div><b class="mono">' + pct(P.acc[g.c]) + '</b><span>precisão</span></div><div><b class="mono ks k-blunder">' + (cnt.blunder || 0) + '</b><span>capivaradas</span></div><div><b class="mono ks k-mistake">' + ((cnt.mistake || 0) + (cnt.miss || 0)) + '</b><span>erros</span></div><div><b class="mono ks k-inacc">' + (cnt.inacc || 0) + '</b><span>imprecisões</span></div></div>';
    mine.sort((a, b) => P.cls[b].loss - P.cls[a].loss);
    if (mine.length) {
      const C = coachFor(P, mine[0]); const lesson = C.punish[0] || C.warn[0] || C.verdict[0];
      h += '<p style="line-height:1.5"><b>Lance decisivo: ' + esc(moveNum(mine[0]) + fig(P.moves[mine[0]].san)) + '.</b> ' + esc(lesson) + (C.best ? ' Melhor era ' + esc(fig(C.best.san)) + '.' : '') + '</p>';
      h += '<div class="moments">' + mine.slice(0, 3).map(i => '<button type="button" data-openply="' + g.id + ':' + (i + 1) + '"><span class="kb k-' + P.cls[i].k + '">' + esc(CLS[P.cls[i].k].s) + '</span><span class="mono">' + esc(moveNum(i) + fig(P.moves[i].san)) + '</span><span class="muted" style="margin-left:auto;font-size:13px">' + CLS[P.cls[i].k].t + '</span></button>').join('') + '</div>';
    } else h += '<p>Nenhum erro grave seu nesta partida.</p>';
    h += '<div class="vxacts"><button class="btn primary small" type="button" data-openply="' + g.id + ':0">Abrir relatório completo</button>' + (mine.length ? '<button class="btn small accent" type="button" data-guess-game="' + g.id + '">Adivinhe o lance</button>' : '') + '<button class="btn small" type="button" data-card-game="' + g.id + '">Cartão</button><button class="btn small" type="button" data-dos="' + esc(g.opp) + '">Dossiê de ' + esc(g.opp) + '</button></div>';
  } else h += '<div class="vxacts"><span class="muted" style="font-size:14px">Ainda sem análise do motor.</span><button class="btn primary small" type="button" data-analyze="' + g.id + '">Analisar agora</button><button class="btn small" type="button" data-dos="' + esc(g.opp) + '">Dossiê de ' + esc(g.opp) + '</button></div>';
  return h;
}

function drawGraph(P) {
  const n = P.moves.length, box = $('#gbox');
  box.setAttribute('aria-valuemin', '0'); box.setAttribute('aria-valuemax', String(n));
  if (!P.evs) { box.innerHTML = '<div class="mid"></div><div class="cur" id="gcur" style="left:0"></div>'; return; }
  const ys = P.evs.map(e => { const v = wpWhite(e); return 100 - v; });
  const pts = ys.map((y, i) => (i / Math.max(1, n) * 1000).toFixed(1) + ',' + y.toFixed(1)).join(' ');
  let dots = '';
  P.cls.forEach((c, i) => {
    if (!BAD[c.k] || c.k === 'inacc') return;
    const mine = P.moves[i].color === P.g.c;
    dots += '<span class="gm k-' + c.k + '" style="left:' + ((i + 1) / Math.max(1, n) * 100) + '%;top:' + ys[i + 1] + '%;background:var(--k);' + (mine ? '' : 'opacity:.55') + '"></span>';
  });
  let clk = ''; const b = baseOf(P.g);
  if (b && P.g.clk && P.g.clk.length >= 4) { const cp = []; P.g.clk.forEach((t, i) => { if ((i % 2 === 0) === (P.g.c === 'w')) cp.push(((i + 1) / Math.max(1, n) * 1000).toFixed(1) + ',' + (100 - Math.min(1, t / b) * 100).toFixed(1)); }); clk = '<polyline points="0,0 ' + cp.join(' ') + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"></polyline>'; }
  const dzb = P.dz != null ? '<div class="dzband" style="left:' + (P.dz / Math.max(1, n) * 100) + '%"><span>decidida</span></div>' : '';
  box.innerHTML = '<svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,100 ' + pts + ' 1000,100" fill="var(--evw)"></polygon>' + clk + '</svg>' + dzb + '<div class="mid"></div>' + dots + '<div class="cur" id="gcur"></div>';
  const gl = $('#gleg'); if (gl) gl.hidden = !clk;
}
function drawMoves(P) {
  let h = '';
  for (let i = 0; i < P.moves.length; i += 2) {
    const cell = j => {
      if (j >= P.moves.length) return '<span></span>';
      const c = P.cls ? P.cls[j] : null; const s = c && (BAD[c.k] || c.k === 'best' || c.k === 'forced' || c.k === 'brill' || c.k === 'great') ? '<b class="ks k-' + c.k + '">' + esc(CLS[c.k].s) + '</b>' : '';
      return '<button class="mv" type="button" data-p="' + (j + 1) + '" aria-current="false">' + esc(fig(P.moves[j].san)) + s + '</button>';
    };
    h += '<div class="mrow"><span class="n">' + (i / 2 + 1) + '.</span>' + cell(i) + cell(i + 1) + '</div>';
  }
  $('#moves').innerHTML = h || '<p class="empty">Sem lances.</p>';
}
function lineButtons(fen, line, base) {
  return '<div class="line">' + line.map((x, k) => '<button type="button" data-line="' + esc(fen) + '" data-base="' + base + '" data-k="' + k + '" data-uci="' + esc(line.slice(0, k + 1).map(y => y.m.from + y.m.to + (y.m.promotion || '')).join(' ')) + '">' + esc(fig(x.san)) + '</button>').join('') + '</div>';
}
function renderCoach(P, n) {
  const box = $('#coach'); const g = P.g;
  if (n === 0) {
    let h = '<div class="hd"><span class="label">Resumo da partida</span></div>';
    if (P.cls) {
      const cnt = side => { const o = {}; P.cls.forEach((c, i) => { if (P.moves[i].color === side) o[c.k] = (o[c.k] || 0) + 1; }); return o; };
      const a = cnt(g.c), b = cnt(other(g.c));
      h += '<div class="sumrow"><span></span><span class="label" style="text-align:right">Você</span><span class="label" style="text-align:right">Adv.</span>';
      for (const k of ['brill', 'great', 'best', 'exc', 'good', 'inacc', 'mistake', 'blunder', 'miss']) h += '<span class="k-' + k + '"><b class="ks">' + esc(CLS[k].s) + '</b> ' + CLS[k].t + '</span><span class="mono">' + (a[k] || 0) + '</span><span class="mono">' + (b[k] || 0) + '</span>';
      h += '</div>';
      const ms = []; P.cls.forEach((c, i) => { if (P.moves[i].color === g.c && (c.k === 'blunder' || c.k === 'mistake' || c.k === 'miss')) ms.push(i); });
      const gl = P.cls.some((c, i) => P.moves[i].color === g.c && (c.loss >= 8 || c.k === 'great'));
      if (gl) h += '<div class="vxacts"><button class="btn small accent" type="button" data-guess="start">Adivinhe o lance: reveja os momentos decisivos</button></div>';
      if (P.dz != null) h += '<p class="muted" style="font-size:13.5px">A partida ficou decidida no lance ' + (Math.floor(P.dz / 2) + 1) + ' (faixa clara no gráfico). A precisão conta só os lances até ali.</p>';
      if (ms.length) h += '<div class="blk"><h3>Momentos para revisar</h3><div class="moments">' + ms.slice(0, 5).map(i => '<button type="button" data-goto="' + (i + 1) + '"><span class="kb k-' + P.cls[i].k + '">' + esc(CLS[P.cls[i].k].s) + '</span><span class="mono">' + (Math.floor(i / 2) + 1) + (i % 2 ? '…' : '.') + ' ' + esc(fig(P.moves[i].san)) + '</span><span class="muted" style="margin-left:auto;font-size:13px">' + CLS[P.cls[i].k].t + '</span></button>').join('') + '</div></div>';
      else h += '<p>Nenhum erro grave seu nesta partida. Avance lance a lance para ver as ideias de cada lado.</p>';
    } else {
      h += '<p>Esta partida ainda não passou pelo motor.</p><button class="btn primary" type="button" data-analyze="' + g.id + '">Analisar com o motor</button><div class="prog" data-prog="' + g.id + '" style="width:100%"><i style="width:0"></i></div>';
    }
    box.innerHTML = '<div class="fade stack" style="gap:14px">' + h + '</div>';
    return;
  }
  const i = n - 1, m = P.moves[i], c = P.cls ? P.cls[i] : null, C = coachFor(P, i);
  const num = (Math.floor(i / 2) + 1) + (i % 2 ? '… ' : '. ');
  let h = '<div class="hd">' + (c ? '<span class="kb k-' + c.k + '">' + esc(CLS[c.k].s) + ' ' + CLS[c.k].t + '</span>' : '') + '<span class="san">' + esc(num + fig(m.san)) + '</span>' +
    (P.evs ? '<span class="ev">' + evTxt(P.evs[i]) + ' → ' + evTxt(P.evs[i + 1]) + '</span>' : '') + '</div>';
  if (c) h += '<p class="muted" style="font-size:13.5px">Chance estimada de vitória das ' + SIDE[m.color] + ': <b style="color:var(--ink)">' + pct(c.wb) + ' → ' + pct(c.wa) + '</b></p>';
  const tl = timeLine(P, i); if (tl) h += '<p class="muted" style="font-size:13.5px;margin-top:-8px">' + esc(tl) + '</p>';
  h += '<div class="blk"><h3>O que o lance faz</h3><p>' + esc(C.idea.join(' ')) + '</p></div>';
  if (C.verdict.length || C.punish.length) h += '<div class="blk"><h3' + (c && BAD[c.k] ? ' class="bad"' : '') + '>' + (c && BAD[c.k] ? 'Por que custa caro' : 'Avaliação') + '</h3><p>' + esc(C.verdict.concat(C.punish).join(' ')) + '</p>' + (C.reply ? lineButtons(m.after, C.reply.line.slice(0, 6), i + 1) + proofHtml(C.reply.line, other(m.color), C.reply.proof) : '') + '</div>';
  if (C.crit) h += '<div class="callout crit"><span class="label">Momento crítico</span><p style="font-size:14px">' + esc(C.crit) + '</p></div>';
  if (C.warn.length) h += '<div class="warn">' + esc(C.warn.join(' ')) + '</div>';
  if (C.best) h += '<div class="bestbox"><h3>Melhor era ' + esc(num + fig(C.best.san)) + '</h3><p>' + esc((C.best.why ? cap(C.best.why) + '.' : 'Lance mais preciso segundo o motor.') + (C.best.extra ? ' ' + C.best.extra : '')) + '</p>' + lineButtons(P.fens[i], C.best.line, i) + proofHtml(C.best.line, m.color, C.best.proof) + '</div>';
  h += plansHtml(C.plans, g.c);
  if (MAIA_AN && MAIA_AN.fen !== P.fens[n]) MAIA_AN = null;
  h += '<div id="maiaAn">' + maiaAnHtml() + '</div>';
  h += '<div class="vxacts"><button class="btn small" type="button" data-vx="play">Jogar daqui contra o motor</button><span class="muted" style="font-size:13px">ou mova uma peça para testar outro lance</span></div>';
  h += '<button class="btn accent" type="button" id="askBtn" hidden><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2z"></path></svg>Pergunte ao treinador</button><div class="ask" id="askOut"></div>';
  box.innerHTML = '<div class="fade stack" style="gap:14px">' + h + '</div>';
  wireAsk(P, i, C);
}

/* ---------- pergunte ao treinador (Claude) ---------- */
let SAMPLE = null, SAMPLE_TRIED = false, askCtl = null;
async function getSample() {
  if (SAMPLE_TRIED) return SAMPLE; SAMPLE_TRIED = true;
  try { SAMPLE = window.claude && window.claude.use ? await window.claude.use('sample') : null; } catch (e) { SAMPLE = null; }
  return SAMPLE;
}
async function wireAsk(P, i, C) {
  const s = await getSample(); const btn = $('#askBtn'); if (!btn || !s) return;
  btn.hidden = false;
  btn.onclick = async () => {
    const out = $('#askOut'); if (askCtl) askCtl.abort(); askCtl = new AbortController();
    const m = P.moves[i], c = P.cls ? P.cls[i] : null, g = P.g;
    const lvl = g.tc === 'blitz' ? 'cerca de ' + (g.mR || 900) + ' no blitz' : 'cerca de ' + (g.mR || 1600) + ' no rápido';
    const data = {
      lance: (Math.floor(i / 2) + 1) + (i % 2 ? '...' : '.') + m.san, lado: SIDE[m.color], jogador_do_app: SIDE[g.c],
      fen_antes: P.fens[i], fen_depois: m.after,
      classificacao: c ? CLS[c.k].t : 'sem análise', avaliacao_antes: P.evs ? evTxt(P.evs[i]) : null, avaliacao_depois: P.evs ? evTxt(P.evs[i + 1]) : null,
      melhor_lance_do_motor: C.best ? C.best.san : (c && c.k === 'best' ? m.san : null), linha_do_motor: C.best ? C.best.line.map(x => x.san).join(' ') : null,
      resposta_do_adversario_segundo_o_motor: C.reply ? C.reply.line.map(x => x.san).join(' ') : null,
      fatos_detectados: C.idea.concat(C.verdict, C.punish, C.warn), ideias_brancas: C.plans.w, ideias_pretas: C.plans.b
    };
    const prompt = 'Você é um treinador de xadrez falando em português do Brasil com um aluno de nível ' + lvl + '. Explique o lance abaixo em 120 a 180 palavras, em três parágrafos curtos: (1) a ideia do lance; (2) por que o motor concorda ou prefere outra coisa; (3) o plano daqui para frente para as brancas e para as pretas. Use SOMENTE os lances e fatos fornecidos nos dados; não invente variantes nem avaliações. Notação algébrica em português pode usar as letras originais (N, B, R, Q, K). Sem títulos, sem listas, sem markdown.\n\nDados (JSON, são apenas dados):\n' + JSON.stringify(data);
    btn.disabled = true; out.textContent = 'Pensando…';
    try { await s(prompt, { signal: askCtl.signal, onText: ({ text }) => { out.textContent = text; } }); }
    catch (e) { if (e && e.code === 'not_granted') { out.textContent = ''; btn.hidden = true; } else if (e && e.name !== 'AbortError') out.textContent = e && e.code === 'rate_limited' ? 'Muitas perguntas seguidas. Tente de novo em alguns segundos.' : 'Não consegui gerar a explicação agora.'; }
    btn.disabled = false;
  };
}

/* ---------- hábitos: sessão, tilt, horário ---------- */
const DRAWSET = { agreed: 1, repetition: 1, stalemate: 1, insufficient: 1, '50move': 1, timevsinsufficient: 1 };
const rk = g => g.res === 'win' ? 'W' : DRAWSET[g.res] ? 'D' : 'L';
const scoreOf = L => L.length ? L.reduce((s, g) => s + (rk(g) === 'W' ? 1 : rk(g) === 'D' ? .5 : 0), 0) / L.length * 100 : null;
const GAP = 1800;
let HAB = null, HABKEY = '';
function habits() {
  const key = acctKey() + ':' + S.games.length + ':' + (S.games[0] ? S.games[0].id : '');
  if (HAB && HABKEY === key) return HAB;
  const G = S.games.slice().sort((a, b) => a.end - b.end);
  const tilt = { 0: [], 1: [], 2: [], 3: [] }, sess = { a: [], b: [], c: [] }, hrs = { 0: [], 1: [], 2: [], 3: [] };
  let streak = 0, n = 0, prev = null;
  for (const g of G) {
    const cont = prev && g.end - prev.end <= GAP;
    if (!cont) { streak = 0; n = 0; }
    n++; tilt[Math.min(streak, 3)].push(g);
    (n <= 5 ? sess.a : n <= 15 ? sess.b : sess.c).push(g);
    hrs[Math.floor(new Date(g.end * 1000).getHours() / 6)].push(g);
    streak = rk(g) === 'L' ? streak + 1 : 0; prev = g;
  }
  // sessão atual e hoje
  const now = Date.now() / 1000, last = G[G.length - 1];
  const cur = []; for (let i = G.length - 1; i >= 0; i--) { if (i < G.length - 1 && G[i + 1].end - G[i].end > GAP) break; cur.unshift(G[i]); }
  let lossRun = 0; for (let i = cur.length - 1; i >= 0 && rk(cur[i]) === 'L'; i--) lossRun++;
  const d0 = new Date(); d0.setHours(0, 0, 0, 0); const todayG = G.filter(g => g.end * 1000 >= d0.getTime());
  const rDelta = tc => { const t = todayG.filter(g => g.tc === tc && g.mR); if (!t.length) return null; const before = G.filter(g => g.tc === tc && g.end * 1000 < d0.getTime() && g.mR); const r0 = before.length ? before[before.length - 1].mR : t[0].mR; return t[t.length - 1].mR - r0; };
  HAB = {
    base: scoreOf(G), tilt, sess, hrs, cur, lossRun, active: last && now - last.end < 3600, today: todayG,
    deltas: { blitz: rDelta('blitz'), rapid: rDelta('rapid'), bullet: rDelta('bullet') }
  };
  HABKEY = key; return HAB;
}
function tiltState() {
  const H = habits(); if (!H.active || H.lossRun < 2) return null;
  const after = scoreOf(H.tilt[2].concat(H.tilt[3]));
  return { run: H.lossRun, after, normal: scoreOf(H.tilt[0]) };
}
function checkTilt() {
  HAB = null; const t = tiltState();
  if (t && store.get('tiltSeen', 0) !== S.games[0].id) { store.set('tiltSeen', S.games[0].id); toast(t.run + ' derrotas seguidas: hora de uma pausa curta'); }
}
const sp = (x, d) => x == null ? '—' : x.toFixed(d == null ? 0 : d).replace('.', ',');
function sessionCard() {
  const H = habits(); const t = tiltState();
  const W = H.today.filter(g => rk(g) === 'W').length, D = H.today.filter(g => rk(g) === 'D').length, Lx = H.today.length - W - D;
  const dl = Object.entries(H.deltas).filter(([, v]) => v != null).map(([k, v]) => '<span class="mono ' + (v >= 0 ? 'up' : 'down') + '">' + TC[k] + ' ' + (v >= 0 ? '+' : '−') + Math.abs(v) + '</span>').join(' · ');
  let h = '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap"><h2 class="h-card">Sessão de hoje</h2><span class="muted" style="font-size:13px">' + H.today.length + ' partidas</span></div>';
  h += H.today.length ? '<div class="lgstats"><div><b class="mono">' + W + '</b><span>vitórias</span></div><div><b class="mono">' + D + '</b><span>empates</span></div><div><b class="mono">' + Lx + '</b><span>derrotas</span></div><div><b class="mono">' + sp(scoreOf(H.today)) + '%</b><span>aproveitamento</span></div></div>' + (dl ? '<p style="font-size:14px">Rating hoje: ' + dl + '</p>' : '') : '<p class="muted">Nenhuma partida hoje ainda.</p>';
  if (H.today.length) h += '<div class="vxacts"><button class="btn small accent" type="button" data-queue="today">Revisar as partidas de hoje em sequência</button></div>';
  if (H.active) {
    const n = H.cur.length, after = scoreOf(H.sess.c), early = scoreOf(H.sess.a);
    h += '<p style="font-size:14px">Sessão atual: <b>' + n + ' partida' + (n > 1 ? 's' : '') + '</b>' + (H.lossRun ? ' · ' + H.lossRun + ' derrota' + (H.lossRun > 1 ? 's' : '') + ' seguida' + (H.lossRun > 1 ? 's' : '') : '') + '.</p>';
    if (n >= 15 && after != null) h += '<div class="warn">Nas suas sessões, a partir da 16ª partida o aproveitamento cai para ' + sp(after) + '% (nas 5 primeiras é ' + sp(early) + '%). Bom momento para parar.</div>';
  }
  if (t) h += '<div class="fb no"><b>Freio de tilt.</b> ' + t.run + ' derrotas seguidas. Depois de 2 derrotas seguidas seu aproveitamento costuma cair para ' + sp(t.after) + '% (normalmente ' + sp(t.normal) + '%). Faça uma pausa de 15 minutos ou 3 exercícios antes da próxima.<div class="vxacts" style="margin-top:8px"><button class="btn small" type="button" data-pz="warm">3 exercícios de aquecimento</button></div></div>';
  return h;
}
function habitsCard() {
  const H = habits();
  const row = (lab, L) => { const s = scoreOf(L); return '<div class="hrow"><span>' + lab + '</span><span class="hbar"><i style="width:' + (s == null ? 0 : s) + '%"></i><em style="left:' + (H.base || 50) + '%"></em></span><b class="mono">' + sp(s) + '%</b><span class="mono muted">' + L.length + '</span></div>'; };
  return '<div class="stack" style="gap:2px"><h2 class="h-card">Hábitos</h2><p class="sub">Aproveitamento por situação. A marca vertical é a sua média geral (' + sp(H.base) + '%). Sessão = partidas com menos de 30 min de intervalo.</p></div>' +
    '<div class="hgrp"><span class="label">Depois de derrotas seguidas</span>' + row('nenhuma', H.tilt[0]) + row('1 derrota', H.tilt[1]) + row('2 derrotas', H.tilt[2]) + row('3 ou mais', H.tilt[3]) + '</div>' +
    '<div class="hgrp"><span class="label">Posição na sessão</span>' + row('1ª a 5ª', H.sess.a) + row('6ª a 15ª', H.sess.b) + row('16ª em diante', H.sess.c) + '</div>' +
    '<div class="hgrp"><span class="label">Horário</span>' + row('madrugada', H.hrs[0]) + row('manhã', H.hrs[1]) + row('tarde', H.hrs[2]) + row('noite', H.hrs[3]) + '</div>';
}

/* ---------- relógio ---------- */
const baseOf = g => { const b = parseInt(g.ctl, 10); return b > 0 && b < 86400 ? b : 0; };
function spentList(g) {
  const b = baseOf(g); if (!b || !g.clk || g.clk.length < 4) return null;
  return g.clk.map((t, i) => Math.max(0, (i >= 2 ? g.clk[i - 2] : b) - t));
}
let CLK = null, CLKKEY = '';
function clockStats() {
  const key = HABKEY + ':' + Object.keys(S.an).length; if (CLK && CLKKEY === key) return CLK;
  const out = { tc: {}, open: [], troubleMv: [], lostN: 0, lostTrouble: 0, errLow: 0, errAll: 0, movesLow: 0, movesAll: 0 };
  for (const g of S.games) {
    const t = out.tc[g.tc] = out.tc[g.tc] || { L: 0, T: 0 }; if (rk(g) === 'L') { t.L++; if (g.res === 'timeout') t.T++; }
    const b = baseOf(g), sp2 = spentList(g); if (!sp2) continue;
    const mine = sp2.map((s, i) => ({ s, i })).filter(x => (x.i % 2 === 0) === (g.c === 'w'));
    if (mine.length >= 20) out.open.push(mine.slice(0, 10).reduce((a, x) => a + x.s, 0) / b * 100);
    if (rk(g) === 'L' && mine.length >= 10) {
      out.lostN++; const k = mine.findIndex(x => g.clk[x.i] < b * .15);
      if (k >= 0) { out.lostTrouble++; out.troubleMv.push(k + 1); }
    }
    if (S.an[g.id]) {
      const P = prep(g); if (!P.cls) continue;
      P.cls.forEach((c, i) => { if (P.moves[i].color !== g.c || g.clk[i] == null) return; const low = g.clk[i] < b * .15; out.movesAll++; if (low) out.movesLow++; if (c.k === 'blunder' || c.k === 'mistake' || c.k === 'miss') { out.errAll++; if (low) out.errLow++; } });
    }
  }
  out.troubleMv.sort((a, b) => a - b);
  CLK = out; CLKKEY = key; return out;
}
function clockCard() {
  const C = clockStats(); const med = C.troubleMv.length ? C.troubleMv[Math.floor(C.troubleMv.length / 2)] : null;
  const rows = ['bullet', 'blitz', 'rapid'].filter(k => C.tc[k] && C.tc[k].L).map(k => '<div class="hrow"><span>' + TC[k] + '</span><span class="hbar"><i style="width:' + (C.tc[k].T / C.tc[k].L * 100) + '%;background:var(--mistake)"></i></span><b class="mono">' + sp(C.tc[k].T / C.tc[k].L * 100) + '%</b><span class="mono muted">' + C.tc[k].T + '/' + C.tc[k].L + '</span></div>').join('');
  let h = '<div class="stack" style="gap:2px"><h2 class="h-card">Relógio</h2><p class="sub">Derrotas por tempo e uso do relógio nas partidas com marcação de tempo</p></div><div class="hgrp"><span class="label">Derrotas que foram por tempo</span>' + rows + '</div>';
  const facts = [];
  if (C.open.length) facts.push('Você gasta em média <b>' + sp(avg(C.open)) + '%</b> do tempo inicial nos seus 10 primeiros lances.');
  if (C.lostN) facts.push('Em <b>' + sp(C.lostTrouble / C.lostN * 100) + '%</b> das derrotas seu relógio ficou abaixo de 15% do tempo inicial' + (med ? ', em geral por volta do seu ' + med + 'º lance' : '') + '.');
  if (C.errAll >= 10 && C.movesAll) facts.push('<b>' + sp(C.errLow / C.errAll * 100) + '%</b> dos seus erros graves foram feitos com menos de 15% do tempo, embora só ' + sp(C.movesLow / C.movesAll * 100) + '% dos seus lances sejam jogados assim.');
  if (facts.length) h += '<ul class="facts">' + facts.map(f => '<li>' + f + '</li>').join('') + '</ul>';
  const byCtl = {}; for (const g of S.games) { const b = baseOf(g); if (!b || g.tc === 'daily') continue; const x = byCtl[b] = byCtl[b] || { b, n: 0, s: 0, L: 0, T: 0 }; x.n++; x.s += rk(g) === 'W' ? 1 : rk(g) === 'D' ? .5 : 0; if (rk(g) === 'L') { x.L++; if (g.res === 'timeout') x.T++; } }
  const ctl = Object.values(byCtl).filter(x => x.n >= 20).sort((a, b) => a.b - b.b);
  if (ctl.length >= 2) {
    const bestC = ctl.slice().sort((a, b) => b.s / b.n - a.s / a.n)[0], worst = ctl.slice().sort((a, b) => a.s / a.n - b.s / b.n)[0];
    h += '<div class="hgrp"><span class="label">Aproveitamento por ritmo</span>' + ctl.map(x => '<div class="hrow"><span>' + (x.b / 60) + ' min</span><span class="hbar"><i style="width:' + (x.s / x.n * 100) + '%"></i><em style="left:50%"></em></span><b class="mono">' + sp(x.s / x.n * 100) + '%</b><span class="mono muted">' + x.n + '</span></div>').join('') + '</div>';
    h += '<p style="font-size:14px">Seu melhor ritmo é o de <b>' + (bestC.b / 60) + ' min</b> (' + sp(bestC.s / bestC.n * 100) + '%); o pior, o de <b>' + (worst.b / 60) + ' min</b> (' + sp(worst.s / worst.n * 100) + '%, ' + worst.T + ' de ' + worst.L + ' derrotas no tempo).</p>';
  }
  h += '<div class="vxacts"><button class="btn small accent" type="button" data-ar="open:clock">Treinar com relógio contra o motor</button></div>';
  const bl = C.tc.blitz; if (bl && bl.L && bl.T / bl.L > .15) h += '<div class="callout" style="padding:12px"><span class="label">Sugestão</span><p style="font-size:14px">Jogue blitz com incremento (3+2 em vez de 3+0) por uma semana: o incremento tira a pressão do fim da partida, e você pode treinar o resto sem perder pontos no relógio.</p></div>';
  return h;
}

/* ---------- derrotas curtas ---------- */
function shortCard() {
  const L = S.games.filter(g => rk(g) === 'L'); const sh = L.filter(g => g.mv.split(' ').length <= 50);
  const grp = {}; for (const g of sh) { const k = opName(g).split(' ').slice(0, 4).join(' ') + '|' + g.c; (grp[k] = grp[k] || []).push(g); }
  const top = Object.entries(grp).sort((a, b) => b[1].length - a[1].length).slice(0, 5);
  let firstErr = []; for (const g of sh) { if (!S.an[g.id]) continue; const P = prep(g); if (!P.cls) continue; const i = P.cls.findIndex((c, k) => P.moves[k].color === g.c && (c.k === 'blunder' || c.k === 'mistake')); if (i >= 0) firstErr.push(Math.floor(i / 2) + 1); }
  firstErr.sort((a, b) => a - b);
  let h = '<div class="stack" style="gap:2px"><h2 class="h-card">Derrotas curtas</h2><p class="sub"><b style="color:var(--ink)">' + sh.length + ' de ' + L.length + '</b> derrotas (' + sp(sh.length / Math.max(1, L.length) * 100) + '%) terminam em 25 lances ou menos</p></div>';
  if (firstErr.length >= 5) h += '<p style="font-size:14px">Nas analisadas, o primeiro erro grave costuma vir por volta do <b>lance ' + firstErr[Math.floor(firstErr.length / 2)] + '</b>: o problema começa na saída da abertura, não no final.</p>';
  h += '<div class="ops">' + top.map(([k, gs]) => { const [nm, c] = k.split('|'); const last = gs.sort((a, b) => b.end - a.end)[0]; return '<div class="op" style="grid-template-columns:minmax(0,1fr) auto"><div style="min-width:0"><div class="nm"><b>' + esc(nm) + '</b></div><div class="side">' + (c === 'w' ? 'brancas' : 'pretas') + ' · ' + gs.length + ' derrotas curtas</div></div><button class="btn small" type="button" data-open="' + last.id + '">Ver a última</button></div>'; }).join('') + '</div>';
  return h;
}

/* ---------- você × adversários do seu nível ---------- */
let CMPH = null, CMPK = '';
function compareCard() { const k = acctKey() + ':' + analyzedGames().length + ':' + Object.keys(CRIT).length; if (CMPH && CMPK === k) return CMPH; CMPK = k; return (CMPH = compareCardRaw()); }
function compareCardRaw() {
  const me = { acc: [], bl: 0, er: 0, ph: { abertura: [0, 0], 'meio-jogo': [0, 0], final: [0, 0] } }, op = { acc: [], bl: 0, er: 0, ph: { abertura: [0, 0], 'meio-jogo': [0, 0], final: [0, 0] } };
  let n = 0;
  for (const g of S.games) {
    if (!S.an[g.id]) continue; const P = prep(g); if (!P.cls) continue; n++;
    me.acc.push(P.acc[g.c]); op.acc.push(P.acc[other(g.c)]);
    P.cls.forEach((c, i) => {
      const side = P.moves[i].color === g.c ? me : op; const ph = phaseOf(parseBoard(P.fens[i]), i);
      side.ph[ph][1]++; const bad = c.k === 'blunder' || c.k === 'mistake' || c.k === 'miss';
      if (c.k === 'blunder') side.bl++; if (bad) { side.er++; side.ph[ph][0]++; }
    });
  }
  if (n < 5) return '<h2 class="h-card">Você × adversários do seu nível</h2><p class="muted">Analise pelo menos 5 partidas para comparar.</p>';
  const pair = (lab, a, b, fmt, lowerBetter) => { const mx = Math.max(a, b, 0.0001); const better = lowerBetter ? a <= b : a >= b; return '<div class="cmp"><span class="lab">' + lab + '</span><div class="cbars"><span class="cb me" style="width:' + (a / mx * 100) + '%"></span><span class="cb op" style="width:' + (b / mx * 100) + '%"></span></div><span class="mono cv"><b class="' + (better ? 'up' : 'down') + '">' + fmt(a) + '</b> × ' + fmt(b) + '</span></div>'; };
  const per100 = x => x[1] ? x[0] / x[1] * 100 : 0;
  return '<div class="stack" style="gap:2px"><h2 class="h-card">Você × adversários do seu nível</h2><p class="sub">Nas ' + n + ' partidas analisadas · <span class="lg me"></span>você <span class="lg op"></span>adversários</p></div>' +
    pair('Precisão média', avg(me.acc), avg(op.acc), x => sp(x) + '%') +
    pair('Capivaradas por partida', me.bl / n, op.bl / n, x => sp(x, 2), true) +
    pair('Erros graves por partida', me.er / n, op.er / n, x => sp(x, 2), true) +
    pair('Erros a cada 100 lances: abertura', per100(me.ph.abertura), per100(op.ph.abertura), x => sp(x, 1), true) +
    pair('Erros a cada 100 lances: meio-jogo', per100(me.ph['meio-jogo']), per100(op.ph['meio-jogo']), x => sp(x, 1), true) +
    pair('Erros a cada 100 lances: final', per100(me.ph.final), per100(op.ph.final), x => sp(x, 1), true);
}

/* ---------- evolução semanal ---------- */
function weeksCard() {
  const wk = {};
  for (const g of S.games) {
    const d = new Date(g.end * 1000); const day = (d.getDay() + 6) % 7; d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - day);
    const k = d.getTime(); const w = wk[k] = wk[k] || { t: k, g: [], acc: [], bl: 0, an: 0, sp: [] };
    w.g.push(g);
    if (S.an[g.id]) { const P = prep(g); if (P.cls) { w.an++; w.acc.push(P.acc[g.c]); P.cls.forEach((c, i) => { if (P.moves[i].color === g.c && c.k === 'blunder') w.bl++; }); } }
    const s = spentList(g); if (s) s.forEach((x, i) => { if ((i % 2 === 0) === (g.c === 'w')) w.sp.push(x); });
  }
  const W = Object.values(wk).sort((a, b) => b.t - a.t).slice(0, 10);
  const rEnd = (w, tc) => { const L = w.g.filter(g => g.tc === tc && g.mR).sort((a, b) => b.end - a.end); return L.length ? L[0].mR : null; };
  const rows = W.map(w => '<tr><td>' + new Date(w.t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') + '</td><td class="mono">' + w.g.length + '</td><td class="mono">' + sp(scoreOf(w.g)) + '%</td><td class="mono">' + (rEnd(w, 'blitz') || '—') + '</td><td class="mono">' + (rEnd(w, 'rapid') || '—') + '</td><td class="mono">' + (w.acc.length ? sp(avg(w.acc)) + '%' : '—') + '</td><td class="mono">' + (w.an ? sp(w.bl / w.an, 2) : '—') + '</td><td class="mono">' + (w.sp.length ? sp(avg(w.sp), 1) + ' s' : '—') + '</td></tr>').join('');
  return '<div class="stack" style="gap:2px"><h2 class="h-card">Evolução semanal</h2><p class="sub">Precisão e capivaradas contam só as partidas analisadas pelo motor</p></div><div class="tbl"><table><thead><tr><th>Semana</th><th>Partidas</th><th>Aprov.</th><th>Blitz</th><th>Rápida</th><th>Precisão</th><th>Capiv./part.</th><th>Tempo/lance</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

/* ---------- repertório ---------- */
let RB = null; const REP = { c: 'w', path: [] };
let TREE = null, TREEKEY = '';
function repTree(c) {
  const key = HABKEY + ':' + c; if (TREE && TREEKEY === key) return TREE;
  const root = { n: 0, W: 0, D: 0, L: 0, ch: {} };
  for (const g of S.games) {
    if (g.c !== c) continue; const r = rk(g); let node = root; node.n++; node[r]++;
    const mv = g.mv.split(' ').slice(0, 16);
    for (const m of mv) { node = node.ch[m] = node.ch[m] || { n: 0, W: 0, D: 0, L: 0, ch: {} }; node.n++; node[r]++; }
  }
  TREE = root; TREEKEY = key; return root;
}
const nodeScore = x => (x.W + x.D / 2) / Math.max(1, x.n) * 100;
function repHoles(root, c) {
  const out = [];
  const walk = (node, path) => {
    if (path.length >= 12) return;
    for (const [m, ch] of Object.entries(node.ch)) {
      const p = path.concat(m);
      if (ch.n >= 10 && p.length >= 2) out.push({ path: p, n: ch.n, s: nodeScore(ch) });
      if (ch.n >= 10) walk(ch, p);
    }
  };
  walk(root, []);
  const base = nodeScore(root);
  return out.filter(x => x.s < base - 8).sort((a, b) => (a.s - b.s) || (b.n - a.n)).filter((x, i, arr) => !arr.slice(0, i).some(y => x.path.join(' ').startsWith(y.path.join(' ')))).slice(0, 5);
}
const pathSan = path => path.map((m, i) => (i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + fig(m)).join(' ');
function renderRep() {
  if (!RB) RB = new Board($('#repBoard'));
  const root = repTree(REP.c); let node = root; const c = new Chess();
  for (const m of REP.path) { node = node.ch[m] || { n: 0, W: 0, D: 0, L: 0, ch: {} }; try { c.move(m); } catch (e) { break; } }
  RB.setFlip(REP.c === 'b'); RB.setPosition(c.fen(), true);
  const h = c.history({ verbose: true }); const lm = h[h.length - 1];
  RB.setMarks(lm ? { last: [lm.from, lm.to] } : {}); RB.setArrows([]);
  $$('#repSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rep === REP.c)));
  const yourTurn = c.turn() === REP.c;
  $('#repCrumb').innerHTML = '<button class="chip" type="button" data-repgo="0">Início</button>' + REP.path.map((m, i) => '<button class="chip" type="button" data-repgo="' + (i + 1) + '">' + esc((i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + fig(m)) + '</button>').join('');
  const kids = Object.entries(node.ch).sort((a, b) => b[1].n - a[1].n).slice(0, 8);
  const base = nodeScore(root);
  $('#repInfo').innerHTML = thPanel(REP.c, REP.path.join(' '), yourTurn) + '<p class="muted" style="font-size:13.5px">' + (node.n ? node.n + ' partidas nesta posição · seu aproveitamento ' + sp(nodeScore(node)) + '%' : 'Você ainda não chegou a esta posição') + ' · ' + (yourTurn ? 'sua vez: os lances que você costuma jogar' : 'vez do adversário: o que eles costumam jogar') + '</p>' +
    (kids.length ? kids.map(([m, x]) => { const s = nodeScore(x), flag = x.n >= 8 && s < base - 8 ? '<span class="tag L" style="padding:3px 7px">furo</span>' : x.n >= 8 && s > base + 8 ? '<span class="tag W" style="padding:3px 7px">forte</span>' : ''; return '<button class="repmv" type="button" data-repmv="' + esc(m) + '"><span class="kcell"><b class="mono">' + esc(fig(m)) + '</b>' + kidMark(REP.c, REP.path.join(' '), m, c.turn()) + '</span><span class="wdl"><i style="flex:' + x.W + '"></i><i style="flex:' + x.D + '"></i><i style="flex:' + x.L + '"></i></span><span class="mono">' + sp(s) + '%</span><span class="mono muted">' + x.n + '</span>' + flag + '</button>'; }).join('') : '<p class="muted">Sem partidas suas a partir daqui.</p>') +
    '<div class="vxacts"><button class="btn small" type="button" id="repEval">Avaliar posição com o motor</button><span class="muted" id="repEv" style="font-size:13.5px"></span></div>';
  const holes = repHoles(root, REP.c);
  $('#repHoles').innerHTML = holes.length ? holes.map(x => '<button class="repmv" type="button" data-reppath="' + esc(x.path.join(' ')) + '"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(pathSan(x.path)) + '</span><span class="mono">' + sp(x.s) + '%</span><span class="mono muted">' + x.n + '</span></button>').join('') : '<p class="muted">Nenhum furo claro com 10 ou mais partidas.</p>';
}
async function repEval() {
  const c = new Chess(); for (const m of REP.path) { try { c.move(m); } catch (e) { break; } }
  const out = $('#repEv'); out.textContent = 'Calculando…';
  try {
    await Engine.init(); const e = await evalPos(c.fen(), 1500);
    const l = lineSan(c.fen(), e.pv.length ? e.pv : (e.best ? [e.best] : []));
    out.textContent = 'Avaliação ' + evTxt(e) + (l.length ? ' · melhor: ' + l.slice(0, 4).map(x => fig(x.san)).join(' ') : '');
    if (l[0]) RB.setArrows([{ from: l[0].m.from, to: l[0].m.to, cls: 'a-best' }]);
  } catch (e) { out.textContent = 'O motor não carregou neste navegador.'; }
}

/* ---------- sons ---------- */
let AC = null;
function sound(kind) {
  if (!store.get('snd', true)) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume();
    const t = AC.currentTime, cap = kind === 'cap';
    const len = Math.floor(AC.sampleRate * (cap ? .09 : .05)); const buf = AC.createBuffer(1, len, AC.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, cap ? 3 : 5);
    const src = AC.createBufferSource(); src.buffer = buf;
    const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = cap ? 900 : 1700; f.Q.value = cap ? .9 : 1.4;
    const gn = AC.createGain(); gn.gain.value = cap ? .9 : .6;
    src.connect(f).connect(gn).connect(AC.destination); src.start(t);
  } catch (e) { /* sem áudio */ }
}

/* ---------- exportar PGN ---------- */
const NAG = { blunder: '??', mistake: '?', inacc: '?!', miss: '?' };
function gamePgn(P) {
  const g = P.g, d = new Date(g.end * 1000), W = g.c === 'w' ? S.me : g.opp, B = g.c === 'w' ? g.opp : S.me;
  const res = rk(g) === 'D' ? '1/2-1/2' : (rk(g) === 'W') === (g.c === 'w') ? '1-0' : '0-1';
  let s = '[Event "' + tcLabel(g) + '"]\n[Site "' + PLAT[S.plat] + '"]\n[Date "' + d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0') + '"]\n[White "' + W + '"]\n[Black "' + B + '"]\n[Result "' + res + '"]\n';
  if (g.eco) s += '[ECO "' + g.eco + '"]\n';
  s += '[Annotator "Lance a Lance"]\n\n'; const out = [];
  P.moves.forEach((m, i) => {
    let t = (i % 2 === 0 ? (i / 2 + 1) + '. ' : (i > 0 && out[out.length - 1].includes('}') ? (Math.floor(i / 2) + 1) + '... ' : '')) + m.san;
    const c = P.cls ? P.cls[i] : null;
    if (c && NAG[c.k]) {
      t += NAG[c.k]; const C = coachFor(P, i);
      const note = [CLS[c.k].t + '.', C.best ? 'Melhor era ' + C.best.san + (C.best.why ? ', que ' + C.best.why : '') + '.' : '', C.reply ? 'O adversário pode responder ' + C.reply.san + '.' : ''].filter(Boolean).join(' ');
      t += ' {' + note.replace(/[{}]/g, '') + '}';
    }
    out.push(t);
  });
  return s + out.join(' ') + ' ' + res + '\n';
}
async function exportPgn() {
  const P = currentP(); if (!P) return; const txt = gamePgn(P);
  let copied = false; try { await navigator.clipboard.writeText(txt); copied = true; } catch (e) { copied = false; }
  try { const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; if (dl) { await dl.save({ filename: 'lance-a-lance-' + P.g.id + '.pgn', data: txt }); toast('PGN salvo' + (copied ? ' e copiado' : '')); return; } } catch (e) { /* recusado */ }
  toast(copied ? 'PGN com comentários copiado' : 'Não consegui copiar o PGN');
}

/* ---------- peças originais "Lance" ---------- */
function pieceSvg(t, white) {
  const f = white ? '#f8f6f0' : '#22302b', s = white ? '#1b2421' : '#0f1513', d = white ? '#1b2421' : '#e9e4d6';
  const base = '<rect x="10.5" y="34" width="24" height="5.5" rx="2.2"/>';
  const P = {
    p: base + '<path d="M17.5 34 L19.5 23.5 H25.5 L27.5 34 Z"/><circle cx="22.5" cy="16.5" r="6"/>',
    r: base + '<path d="M14.5 34 V18 H30.5 V34 Z"/><path d="M12.5 8.5 H16.5 V11.5 H20 V8.5 H25 V11.5 H28.5 V8.5 H32.5 V18 H12.5 Z"/>',
    b: base + '<path d="M15.5 34 C14 26 17 19.5 22.5 12.5 C28 19.5 31 26 29.5 34 Z"/><circle cx="22.5" cy="9" r="2.8"/><path d="M20 19.5 L25.5 25" fill="none" stroke="' + d + '" stroke-width="1.8" stroke-linecap="round"/>',
    n: base + '<path d="M14 34 C13.5 27.5 17 24.5 20.5 21.5 C17.5 22 14.5 21.5 12.5 19.5 L19 11.5 L21 6.5 L23.5 10 C30 11 33 18.5 31.5 34 Z"/><circle cx="21.5" cy="14.5" r="1.4" fill="' + d + '" stroke="none"/>',
    q: base + '<path d="M13.5 34 L11 15.5 L17.5 24 L22.5 11.5 L27.5 24 L34 15.5 L31.5 34 Z"/><circle cx="11" cy="13" r="2.2"/><circle cx="22.5" cy="9" r="2.2"/><circle cx="34" cy="13" r="2.2"/>',
    k: base + '<path d="M14 34 C13 27 15.5 21.5 22.5 20 C29.5 21.5 32 27 31 34 Z"/><path d="M21 5.5 H24 V9.5 H28 V12.5 H24 V19 H21 V12.5 H17 V9.5 H21 Z"/>'
  };
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="' + f + '" stroke="' + s + '" stroke-width="1.5" stroke-linejoin="round">' + P[t] + '</g></svg>');
}
function applyPrefs() {
  const set = store.get('pieces', 'classic'), th = store.get('theme', 'system'), root = document.documentElement;
  root.dataset.pieces = set; root.dataset.board = store.get('board', 'classic'); root.dataset.coords = store.get('coords', 'on'); root.dataset.glass = store.get('glass', 'on');
  if (th === 'oled') { root.setAttribute('data-theme', 'dark'); root.setAttribute('data-oled', ''); }
  else { root.removeAttribute('data-oled'); if (th === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', th); }
  if (!$('#lanceSet')) {
    let css = ''; for (const t of 'pnbrqk') for (const w of [true, false]) css += ':root[data-pieces="lance"] .pc.' + (w ? 'w' : 'b') + t + '{background-image:url("' + pieceSvg(t, w) + '")}';
    css += '.sheet .sw .swp[data-pieces="lance"] .pc.wn{background-image:url("' + pieceSvg('n', true) + '")}.sheet .sw .swp[data-pieces="lance"] .pc.bq{background-image:url("' + pieceSvg('q', false) + '")}';
    const st = document.createElement('style'); st.id = 'lanceSet'; st.textContent = css; document.head.appendChild(st);
  }
}
function openPrefs() {
  const seg = (name, val, opts) => '<div class="seg" role="group">' + opts.map(([v, t]) => '<button type="button" data-pref="' + name + ':' + v + '" aria-pressed="' + (val === v) + '">' + t + '</button>').join('') + '</div>';
  $('#prefsBody').innerHTML =
    '<div class="stack" style="gap:6px"><span class="label">Peças</span><div class="swatches">' + [['classic', 'Clássicas'], ['moderno', 'Moderno'], ['caliente', 'Caliente'], ['lance', 'Lance'], ['staunty', 'Staunty'], ['maestro', 'Maestro'], ['california', 'California'], ['cardinal', 'Cardinal'], ['merida', 'Merida'], ['chessnut', 'Chessnut'], ['fantasy', 'Fantasia'], ['spatial', 'Espacial']].map(([v, t]) => '<button type="button" class="sw" data-pref="pieces:' + v + '" aria-pressed="' + (store.get('pieces', 'classic') === v) + '"><span class="swp" data-pieces="' + v + '"><i class="pc wn"></i><i class="pc bq"></i></span>' + t + '</button>').join('') + '</div></div>' +
    '<div class="stack" style="gap:6px"><span class="label">Tabuleiro</span><div class="swatches">' + [['classic', 'Clássico'], ['wood', 'Madeira'], ['walnut', 'Nogueira'], ['marble', 'Mármore'], ['slate', 'Ardósia'], ['leather', 'Couro'], ['green', 'Torneio'], ['blue', 'Azul'], ['sand', 'Areia'], ['ice', 'Gelo'], ['amethyst', 'Ametista'], ['coral', 'Coral'], ['night', 'Noturno']].map(([v, t]) => '<button type="button" class="sw" data-pref="board:' + v + '" aria-pressed="' + (store.get('board', 'classic') === v) + '"><span class="swb" data-board="' + v + '"></span>' + t + '</button>').join('') + '</div></div>' +
    '<div class="stack" style="gap:6px"><span class="label">Tema</span>' + seg('theme', store.get('theme', 'system'), [['system', 'Sistema'], ['light', 'Claro'], ['dark', 'Escuro'], ['oled', 'Preto (OLED)']]) + '</div>' +
    '<div class="stack" style="gap:6px"><span class="label">Coordenadas no tabuleiro</span>' + seg('coords', store.get('coords', 'on'), [['on', 'Mostrar'], ['off', 'Esconder']]) + '</div>' +
    '<div class="stack" style="gap:6px"><span class="label">Efeitos de vidro e transições</span>' + seg('glass', store.get('glass', 'on'), [['on', 'Ligados'], ['off', 'Simples (mais leve)']]) + '</div>' +
    '<div class="stack" style="gap:6px"><span class="label">Confirmar lance com toque duplo</span>' + seg('confirm', store.get('confirm', false) ? 'on' : 'off', [['off', 'Não'], ['on', 'Sim (evita soltar na casa errada)']]) + '</div>' +
    '<div class="stack" style="gap:6px"><span class="label">Sons de lance</span>' + seg('snd', store.get('snd', true) ? 'on' : 'off', [['on', 'Ligados'], ['off', 'Desligados']]) + '</div>' +
    (NATIVE && NATIVE.platform === 'android' || matchMedia('(pointer:coarse)').matches ? '<div class="stack" style="gap:6px"><span class="label">Vibração</span>' + seg('hap', store.get('hap', true) ? 'on' : 'off', [['on', 'Ligada'], ['off', 'Desligada']]) + '</div>' : '') +
    (matchMedia('(pointer:coarse)').matches ? '<div class="stack" style="gap:6px"><span class="label">Deslizar o dedo para trocar de aba</span>' + seg('swipe', store.get('swipe', true) ? 'on' : 'off', [['on', 'Ligado'], ['off', 'Desligado']]) + '</div>' : '') +
    syncPrefsHtml() +
    (window.__checkUpdate ? '<div class="stack" style="gap:8px"><span class="label">Versão</span><p class="muted" style="font-size:14px">App ' + esc(String(window.__APP_BUILD)) + ' · aplicativo ' + esc(window.__SHELL || '') + (NATIVE ? (NATIVE.platform === 'android' ? ' (Android)' : NATIVE.portable ? ' (Windows portátil)' : ' (Windows)') : '') + '. As atualizações do app chegam sozinhas.</p><div class="vxacts"><button class="btn small" type="button" data-upd="check">Procurar atualização</button></div></div>' : '');
  $('#prefs').hidden = false;
}
function setPref(a) {
  const [k, v] = a.split(':');
  if (k === 'snd') { store.set('snd', v === 'on'); if (v === 'on') sound('move'); }
  else if (k === 'hap') { store.set('hap', v === 'on'); if (v === 'on') haptic('ok'); }
  else if (k === 'confirm') store.set('confirm', v === 'on');
  else if (k === 'swipe') store.set('swipe', v === 'on');
  else store.set(k, v);
  applyPrefs(); openPrefs();
}

/* ---------- TREINO ---------- */
let PB = null, PZ = null, TIMER = null;
const GOAL = 10;
const dayKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function dailyCount() { return store.get('daily', {})[dayKey(new Date())] || 0; }
function bumpDaily() { const d = store.get('daily', {}), k = dayKey(new Date()); d[k] = (d[k] || 0) + 1; store.set('daily', d); cloudPrefsPush(); }
function streakDays() {
  const d = store.get('daily', {}); let n = 0; const dt = new Date();
  if ((d[dayKey(dt)] || 0) < GOAL) dt.setDate(dt.getDate() - 1);
  while ((d[dayKey(dt)] || 0) >= GOAL) { n++; dt.setDate(dt.getDate() - 1); }
  return n;
}
const SRS_DAYS = [1, 3, 7, 21, 60];
function srsRecord(key, ok) {
  const s = store.get('srs', {}); const e = s[key] || { b: 0 };
  e.b = ok ? Math.min(e.b + 1, SRS_DAYS.length) : 0;
  e.d = Date.now() + (ok ? SRS_DAYS[e.b - 1] * 86400000 : 10 * 60000);
  s[key] = e; store.set('srs', s); cloudPrefsPush();
}
function dueList() { const s = store.get('srs', {}), now = Date.now(); return buildTraining().puzzles.concat(theoryQueue(), punishQueue()).filter(p => s[p.key] && s[p.key].d <= now); }
function reviewList(gid) {
  const g = S.games.find(x => x.id === gid); if (!g || !S.an[gid]) return [];
  const P = prep(g); if (!P.cls) return [];
  const out = [];
  P.cls.forEach((c, i) => { if (P.moves[i].color !== g.c || !BAD[c.k]) return; const eb = P.evs[i]; if (!eb || !eb.best) return; out.push({ key: g.id + ':' + i, gid: g.id, ply: i, k: c.k, loss: c.loss, side: g.c, best: eb.best, played: P.moves[i].san, mate: isMateFor(eb, g.c) ? Math.abs(eb.mate) : 0 }); });
  return out.sort((a, b) => b.loss - a.loss).slice(0, 3).sort((a, b) => a.ply - b.ply);
}
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
function setPzMode(mode, arg) {
  stopTimer(); S.pzMode = mode; S.puz = 0;
  const T = buildTraining(), solved = store.get('solved', {});
  if (mode === 'due') S.pzQueue = dueList();
  else if (mode === 'review') { S.pzQueue = reviewList(arg); S.pzGid = arg; }
  else if (mode === 'theory') { S.pzQueue = theoryQueue(); if (arg) { const i = S.pzQueue.findIndex(p => p.key === arg); if (i >= 0) S.puz = i; } }
  else if (mode === 'warm') S.pzQueue = shuffle(T.puzzles.filter(p => p.k === 'blunder')).slice(0, 3);
  else if (mode === 'crit') { const q = critQueue(); S.pzQueue = q.filter(p => !solved[p.key]).concat(q.filter(p => solved[p.key])); }
  else if (mode === 'punish') { const q = punishQueue(); S.pzQueue = q.filter(p => !solved[p.key]).concat(q.filter(p => solved[p.key])); }
  else if (mode === 'timed') { S.pzQueue = shuffle(T.puzzles); S.tm = { ok: 0, miss: 0, end: Date.now() + 180000, over: false }; startTimer(); }
  else S.pzQueue = T.puzzles.filter(p => !solved[p.key]).concat(T.puzzles.filter(p => solved[p.key]));
  renderPzModes(); loadPuzzle();
}
function startTimer() { stopTimer(); TIMER = setInterval(() => { renderPzCount(); if (Date.now() >= S.tm.end) finishTimed(); }, 250); }
function stopTimer() { if (TIMER) clearInterval(TIMER); TIMER = null; }
function finishTimed() {
  stopTimer(); if (!S.tm || S.tm.over) return; S.tm.over = true; if (PZ) PZ.done = true; PB.setLive(null);
  const best = store.get('tbest', 0), sc = S.tm.ok; if (sc > best) store.set('tbest', sc);
  const fb = $('#pzFb'); fb.className = 'fb ' + (sc > best ? 'ok' : 'hint');
  fb.textContent = 'Tempo esgotado: ' + sc + ' acerto' + (sc === 1 ? '' : 's') + ' e ' + S.tm.miss + ' erro' + (S.tm.miss === 1 ? '' : 's') + ' em 3 minutos.' + (sc > best ? ' Novo recorde!' : ' Seu recorde: ' + best + '.');
  renderPzCount();
}
function renderPzModes() {
  const due = dueList().length;
  const modes = [['mine', 'Meus erros'], ['punish', 'Puna o erro'], ['due', 'Revisar hoje' + (due ? ' (' + due + ')' : '')], ['timed', 'Contra o relógio']];
  if (Object.keys(CRIT).length) modes.splice(2, 0, ['crit', 'Lance único']);
  if (REPORT && (REPORT.errors.length || REPORT.against.length)) modes.splice(2, 0, ['theory', 'Teoria']);
  if (S.pzMode === 'review') modes.push(['review', 'Revisão da partida']);
  if (S.pzMode === 'warm') modes.push(['warm', 'Aquecimento']);
  $('#pzModes').innerHTML = modes.map(([k, t]) => '<button class="chip" type="button" data-pz="' + k + '" aria-pressed="' + (S.pzMode === k) + '">' + t + '</button>').join('');
  const bv = store.get('blind', 'off'); const pb = $('#pzBlind'); if (pb) pb.innerHTML = [['off', 'Normal'], ['p', 'Sem peões'], ['all', 'Às cegas']].map(([k, t]) => '<button type="button" data-blind="' + k + '" aria-pressed="' + (bv === k) + '">' + t + '</button>').join('');
}
function renderPzCount() {
  const Q = S.pzQueue || [], el = $('#pzCount'); const solved = store.get('solved', {});
  if (S.pzMode === 'timed' && S.tm) { const left = Math.max(0, Math.ceil((S.tm.end - Date.now()) / 1000)); el.innerHTML = '<b class="mono" style="color:var(--ink);font-size:15px">' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') + '</b> · ' + S.tm.ok + ' acertos · ' + S.tm.miss + ' erros'; }
  else if (S.pzMode === 'review' || S.pzMode === 'warm') el.textContent = Math.min(S.puz + 1, Q.length) + ' de ' + Q.length;
  else if (S.pzMode === 'due') el.textContent = Q.length + ' para revisar';
  else el.textContent = Q.filter(p => solved[p.key]).length + ' de ' + Q.length + ' resolvidos';
}
function renderGoal() {
  const n = dailyCount(), st = streakDays(), f = Math.min(1, n / GOAL);
  $('#trGoal').innerHTML = '<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18" fill="none" stroke="var(--surface-2)" stroke-width="5"></circle><circle cx="22" cy="22" r="18" fill="none" stroke="var(--accent)" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + (f * 113.1).toFixed(1) + ' 113.1" transform="rotate(-90 22 22)" style="transition:stroke-dasharray .5s var(--ease)"></circle></svg><div class="stack" style="gap:0"><b>' + Math.min(n, 999) + ' de ' + GOAL + ' hoje</b><span class="muted" style="font-size:13px">' + (st ? 'Sequência: ' + st + ' dia' + (st > 1 ? 's' : '') + ' batendo a meta' : 'Bata a meta de ' + GOAL + ' exercícios por dia') + (store.get('tbest', 0) ? ' · recorde no relógio: ' + store.get('tbest', 0) : '') + '</span></div>';
}
function renderTreino() {
  if (!analyzedReady()) { if (!PB) PB = new Board($('#pzBoard')); $('#pzQ').textContent = 'Preparando seus exercícios…'; warmPrep().then(() => { if (S.view === 'treino') renderTreino(); }); return; }
  const T = buildTraining(); if (!PB) PB = new Board($('#pzBoard'));
  renderGoal();
  if (S.pendingReview) { const g = S.pendingReview; S.pendingReview = null; setPzMode('review', g); }
  else if (S.pendingWarm) { S.pendingWarm = false; setPzMode('warm'); }
  else if (S.pendingPz) { const k = S.pendingPz; S.pendingPz = null; setPzMode(k); }
  else if (!S.pzMode || !S.pzQueue) setPzMode('mine');
  else { renderPzModes(); renderPzCount(); if (!PZ) loadPuzzle(); }
  $('#trHub').innerHTML = hubHtml();
  $('#trPlan').innerHTML = renderPlan();
  const steps = [];
  steps.push({ t: 'Seus erros viram exercícios', d: T.puzzles.length + ' posições das suas partidas onde existia um lance melhor. Meta: ' + GOAL + ' por dia; os que você errar voltam em 1, 3 e 7 dias.', links: [] });
  for (const p of T.prios.slice(0, 3)) { const Ls = LESSONS[p.k]; steps.push({ t: Ls.t, d: (p.extra || Ls.d) + ' (' + p.n + ' de ' + T.errs + ' erros)', links: Ls.links }); }
  $('#trPrio').innerHTML = steps.map((s, k) => '<div class="step' + (k === 0 ? ' on' : '') + '"><span class="num">' + (k + 1) + '</span><div><b>' + esc(s.t) + '</b><p class="muted" style="font-size:14px;line-height:1.45">' + esc(s.d) + '</p>' + (s.links.length ? '<div class="links">' + s.links.map(([t, u]) => '<a href="' + u + '" target="_blank" rel="noopener">' + esc(t) + ' ↗</a>').join('') + '</div>' : '') + '</div></div>').join('');
  $('#trLessons').innerHTML = Object.keys(LESSONS).map(k => { const Ls = LESSONS[k]; return '<details class="lesson"><summary>' + esc(Ls.t) + '</summary><div class="body"><p class="muted">' + esc(Ls.d) + '</p><ul>' + Ls.how.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul><div class="links">' + Ls.links.map(([t, u]) => '<a href="' + u + '" target="_blank" rel="noopener">' + esc(t) + ' ↗</a>').join('') + '</div></div></details>'; }).join('');
  renderRep();
  renderTheory();
}
function loadPuzzle() {
  const fb = $('#pzFb'); fb.className = 'fb'; fb.textContent = '';
  const Q = S.pzQueue || []; renderPzCount();
  if (S.pzMode === 'timed' && S.tm && S.tm.over) return;
  const finite = S.pzMode === 'review' || S.pzMode === 'due' || S.pzMode === 'warm';
  if (!Q.length || (finite && S.puz >= Q.length)) {
    PZ = null; PB.setLive(null); PB.setArrows([]); PB.setMarks({}); $('#pzFrom').textContent = '';
    $('#pzQ').textContent = S.pzMode === 'due' ? (Q.length ? 'Revisão de hoje concluída.' : 'Nada para revisar agora. Os exercícios que você errar voltam aqui no dia certo.') :
      S.pzMode === 'review' ? (Q.length ? 'Revisão concluída. Abra a partida na Análise para ver o resto.' : 'Esta partida não tem erros graves seus para revisar.') :
      S.pzMode === 'warm' ? 'Aquecimento concluído. Boa partida!' : 'Analise algumas partidas para gerar exercícios.';
    if (!Q.length) PB.setPosition('8/8/8/8/8/8/8/8 w - - 0 1', false);
    return;
  }
  S.puz = ((S.puz % Q.length) + Q.length) % Q.length;
  const p = Q[S.puz];
  if (p.fen && p.kind === 'punish') {
    PZ = { p, P: null, fen: p.fen, hints: 0, done: false, first: true };
    $('#pzFrom').textContent = 'Puna o erro · sua partida vs ' + p.opp + ' · ' + dateLabel(p.end);
    $('#pzQ').innerHTML = '<b>Agora você é o adversário: ' + SIDE[p.side] + ' jogam.</b> Na partida você jogou ' + esc(fig(p.played)) + ' (' + CLS[p.k].t.toLowerCase() + '). ' + (p.mate && p.mate <= 4 ? 'Encontre o mate em ' + p.mate + '.' : 'Como punir esse lance?');
    PB.setFlip(p.side === 'b'); PB.setPosition(p.fen, false);
    armPuzzle(p.fen, p.side, { last: p.last }); return;
  }
  if (p.fen) {
    PZ = { p, P: null, fen: p.fen, hints: 0, done: false, first: true };
    $('#pzFrom').textContent = 'Teoria · ' + (cleanName(p.name) || 'sua abertura') + ' · ' + (p.c === 'w' ? 'de brancas' : 'de pretas');
    $('#pzQ').innerHTML = '<b>' + SIDEC[p.side] + ' jogam.</b> Nesta posição você costuma jogar ' + esc(fig(p.played)) + ', que ' + (p.loss >= 18 ? 'cai numa armadilha' : 'perde vantagem') + '. Qual é o lance certo?';
    PB.setFlip(p.side === 'b'); PB.setPosition(p.fen, false);
    armPuzzle(p.fen, p.side, p.last ? { last: p.last } : {}); return;
  }
  const g = S.games.find(x => x.id === p.gid); if (!g) { S.puz++; return loadPuzzle(); }
  const P = prep(g); const fen = P.fens[p.ply]; const prev = p.ply > 0 ? P.moves[p.ply - 1] : null;
  PZ = { p, P, fen, hints: 0, done: false, first: true };
  $('#pzFrom').textContent = (S.pzMode === 'review' ? 'Momento decisivo ' + (S.puz + 1) + ' de ' + Q.length + ' · ' : '') + 'Sua partida vs ' + g.opp + ' · ' + dateLabel(g.end);
  $('#pzQ').innerHTML = '<b>' + SIDEC[p.side] + ' jogam.</b> ' + (S.pzMode === 'timed' ? (p.mate && p.mate <= 4 ? 'Mate em ' + p.mate + '.' : 'Encontre o melhor lance.') :
    S.pzMode === 'review' ? 'Aqui você jogou ' + esc(fig(p.played)) + '. Antes de ver a resposta: o que você jogaria?' :
    p.crit ? 'Momento crítico: só um lance mantém a posição (o segundo melhor perde ' + p.crit + ' pontos de chance). Na partida você jogou ' + esc(fig(p.played)) + (p.found ? ', e acertou.' : '.') :
    'Na partida você jogou ' + esc(fig(p.played)) + ' (' + CLS[p.k].t.toLowerCase() + '). ' + (p.mate && p.mate <= 4 ? 'Encontre o mate em ' + p.mate + '.' : p.mate ? 'Há um mate forçado: encontre o primeiro lance.' : 'Encontre o lance mais forte.'));
  PB.setFlip(p.side === 'b'); PB.setPosition(fen, false);
  armPuzzle(fen, p.side, prev ? { last: [prev.from, prev.to] } : {});
}
function armPuzzle(fen, side, marks) {
  setTimeout(blindApply, 0);
  const c = new Chess(fen); const dests = {};
  for (const m of c.moves({ verbose: true })) { const a = dests[m.from] = dests[m.from] || []; if (!a.includes(m.to)) a.push(m.to); }
  PB.setMarks(marks); PB.setArrows([]);
  PB.setLive({ color: side, dests, marks, onMove: (from, to) => tryPuzzleMove(from, to) });
}
function pzEv() { return PZ.p.ev || PZ.P.evs[PZ.p.ply]; }
function bestSan() { const l = lineSan(PZ.fen, [PZ.p.best]); return l[0] ? fig(l[0].san) : PZ.p.best; }
function reviewNote() { const C = coachFor(PZ.P, PZ.p.ply); return 'Na partida: ' + [C.verdict[0], C.punish[0]].filter(Boolean).join(' '); }
async function tryPuzzleMove(from, to) {
  if (!PZ || PZ.done) return;
  const cur = PZ; const c = new Chess(PZ.fen); let m;
  try { m = c.move({ from, to, promotion: 'q' }); } catch (e) { return; }
  PB.setLive(null); PB.setPosition(c.fen(), true);
  const uci = m.from + m.to + (m.promotion || ''); const fb = $('#pzFb');
  let good = uci === PZ.p.best ? 'best' : null;
  if (!good) {
    fb.className = 'fb hint'; fb.textContent = 'Conferindo com o motor…';
    let alt = null;
    try {
      await Promise.race([Engine.init(), sleep(8000).then(() => { throw new Error('t'); })]);
      const r = await evalPos(c.fen(), S.pzMode === 'timed' ? 300 : 700); const eb = pzEv();
      const wb = PZ.p.side === 'w' ? wpWhite(eb) : 100 - wpWhite(eb), wa = PZ.p.side === 'w' ? wpWhite(r) : 100 - wpWhite(r);
      alt = wb - wa;
    } catch (e) { alt = null; }
    if (PZ !== cur) return;
    if (alt != null && alt < 5) good = 'alt';
    cur.alt = alt;
  }
  if (good) {
    PZ.done = true; blindReveal(); PB.setMarks({ last: [m.from, m.to], ok: m.to });
    const solved = store.get('solved', {}); solved[PZ.p.key] = 1; store.set('solved', solved);
    if (PZ.first) srsRecord(PZ.p.key, true); bumpDaily(); renderGoal(); haptic('ok');
    if (PZ.p.kind === 'punish') act('punish'); else if (PZ.p.fen) act('theory');
    fb.className = 'fb ok'; fb.textContent = (good === 'alt' ? fig(m.san) + ' também funciona: o motor avalia quase igual ao melhor lance. ' : 'Isso! ' + fig(m.san) + ' é o lance do motor. ') + explainBest() + (S.pzMode === 'review' ? ' ' + reviewNote() : '');
    if (S.pzMode === 'timed') { S.tm.ok++; setTimeout(() => { if (!S.tm.over && PZ === cur) { S.puz++; loadPuzzle(); } }, 450); }
    renderPzCount(); return;
  }
  if (PZ.first) srsRecord(PZ.p.key, false); PZ.first = false; haptic('err');
  PB.setMarks({ last: [m.from, m.to], bad: m.to });
  if (S.pzMode === 'timed') { S.tm.miss++; PZ.done = true; blindReveal(); fb.className = 'fb no'; fb.textContent = fig(m.san) + ' não resolve. Melhor era ' + bestSan() + '.'; renderPzCount(); setTimeout(() => { if (!S.tm.over && PZ === cur) { S.puz++; loadPuzzle(); } }, 900); return; }
  fb.className = 'fb no'; fb.textContent = fig(m.san) + ' não resolve. ' + (cur.alt == null ? 'O lance procurado é outro.' : 'Sua chance cairia ' + Math.round(cur.alt) + ' pontos percentuais.') + ' Tente de novo.';
  setTimeout(() => { if (!PZ || PZ.done || PZ !== cur) return; PB.setPosition(PZ.fen, true); const prev = PZ.P && PZ.p.ply > 0 ? PZ.P.moves[PZ.p.ply - 1] : null; armPuzzle(PZ.fen, PZ.p.side, PZ.p.last ? { last: PZ.p.last } : prev ? { last: [prev.from, prev.to] } : {}); }, 900);
}
function explainBest() {
  const eb = pzEv(); const l = lineSan(PZ.fen, eb.pv.length ? eb.pv : [eb.best]); if (!l[0]) return '';
  const F = factsFor(PZ.fen, l[0].m, PZ.p.ply); const why = ideaShort(F, l[0].m);
  return (why ? cap(why) + '. ' : '') + 'Linha: ' + l.slice(0, 5).map(x => fig(x.san)).join(' ') + '.';
}
function puzzleHint() {
  if (!PZ || PZ.done) return; PZ.hints++;
  if (PZ.first) { srsRecord(PZ.p.key, false); PZ.first = false; }
  const b = PZ.p.best; const B = parseBoard(PZ.fen); const p = B[sqI(b.slice(0, 2))]; const fb = $('#pzFb'); fb.className = 'fb hint';
  if (PZ.hints === 1) fb.textContent = 'Dica: use ' + pz(p.t) + '.';
  else { fb.textContent = 'Dica: ' + pz(p.t) + ' em ' + b.slice(0, 2) + '.'; PB.setMarks(Object.assign({}, PB.live ? PB.live.marks : {}, { sel: b.slice(0, 2) })); }
}
async function puzzleSolution() {
  if (!PZ) return; if (PZ.first) { srsRecord(PZ.p.key, false); PZ.first = false; }
  PZ.done = true; blindReveal(); PB.setLive(null);
  if (S.pzMode === 'timed' && S.tm && !S.tm.over) S.tm.miss++;
  const eb = pzEv(); const l = lineSan(PZ.fen, eb.pv.length ? eb.pv : [eb.best], 6);
  const fb = $('#pzFb'); fb.className = 'fb hint'; fb.textContent = 'Solução: ' + explainBest() + (S.pzMode === 'review' ? ' ' + reviewNote() : '');
  PB.setPosition(PZ.fen, false); renderPzCount();
  const key = PZ.p.key;
  for (const x of l) { await sleep(650); if (!PZ || PZ.p.key !== key) return; PB.setPosition(x.m.after, true); PB.setMarks({ last: [x.m.from, x.m.to] }); }
}

/* ---------- tempo por lance na análise ---------- */
function drawTime(P) {
  const box = $('#tbox'), wrap = $('#tgraph'); const sp2 = spentList(P.g);
  if (!sp2) { wrap.hidden = true; return; } wrap.hidden = false;
  const n = P.moves.length, mx = Math.max.apply(null, sp2.concat([1]));
  box.innerHTML = sp2.slice(0, n).map((s, i) => { const mine = (i % 2 === 0) === (P.g.c === 'w'); return '<i data-p="' + (i + 1) + '" style="left:' + (i / n * 100) + '%;width:' + (100 / n) + '%;height:' + Math.max(2, s / mx * 100) + '%;' + (mine ? '' : 'opacity:.35;') + '"></i>'; }).join('') + '<div class="cur" id="tcur"></div>';
  const b = baseOf(P.g); $('#tnote').textContent = 'barras fortes = seus lances · maior pausa: ' + Math.round(mx) + ' s' + (b ? ' · tempo inicial ' + Math.round(b / 60) + ' min' : '');
}
function timeLine(P, i) {
  const sp2 = spentList(P.g); if (!sp2 || sp2[i] == null) return '';
  const b = baseOf(P.g), left = P.g.clk[i];
  return 'Tempo: ' + sp(sp2[i], 1) + ' s neste lance · restavam ' + Math.floor(left / 60) + ':' + String(Math.round(left % 60)).padStart(2, '0') + (left < b * .15 ? ' (apuro de tempo)' : '');
}

/* ---------- teoria e armadilhas ---------- */
let REPORT = null; const TH = { tab: 'lines', c: 'all' };
async function cloudLoadReport() {
  REPORT = null; if (!Cloud.on) return;
  try {
    const s = await Cloud.db.doc(acctDoc() + '/rep/report').get(); if (!s.exists) return;
    const r = JSON.parse(s.data().j); r.nodes = { w: {}, b: {} };
    for (const c of ['w', 'b']) { const n = await Cloud.db.doc(acctDoc() + '/rep/nodes_' + c).get(); if (n.exists) r.nodes[c] = JSON.parse(n.data().j); }
    REPORT = r;
  } catch (e) { REPORT = null; }
}
const fenAt = path => { const c = new Chess(); for (const m of (path ? path.split(' ') : [])) { try { c.move(m); } catch (e) { break; } } return c.fen(); };
const plyOf = path => path ? path.split(' ').length : 0;
function lineTxt(path, mark) {
  const mv = path ? path.split(' ') : [];
  return mv.map((m, i) => '<span' + (mark != null && i === mark ? ' class="hot"' : '') + '>' + esc((i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + fig(m)) + '</span>').join(' ');
}
function whyMove(fen, san, ply) { try { const m = new Chess(fen).move(san); return ideaShort(factsFor(fen, m, ply), m); } catch (e) { return ''; } }
const withWhy = (fen, san, ply) => { const w = whyMove(fen, san, ply); return fig(san) + (w ? ', que ' + w : ''); };
function cleanName(s) { if (!s) return ''; const i = s.indexOf(' '); const eco = s.slice(0, i), nm = s.slice(i + 1); return opName({ op: nm.replace(/:/g, ',').replace(/'/g, '') }) + ' (' + eco + ')'; }
const sideTag = c => '<span class="tag plain" style="padding:3px 8px">' + (c === 'w' ? 'de brancas' : 'de pretas') + '</span>';
function nodeAt(c, path) { return REPORT && REPORT.nodes[c] ? REPORT.nodes[c][path] : null; }
const ndEv = nd => evOf([nd[0], nd[1], null, '', null]);
function nameAlong(c, path) {
  const mv = path ? path.split(' ') : [];
  for (let i = mv.length; i >= 0; i--) { const nd = nodeAt(c, mv.slice(0, i).join(' ')); if (nd && nd[4] >= 0) return REPORT.names[nd[4]]; }
  return null;
}
function thLine(x) {
  let h = '<div class="thhd"><b>' + esc(cleanName(x.name) || 'Sua linha') + '</b><span class="muted">' + sideTag(x.c) + ' ' + x.n + ' partidas · ' + sp(x.sc) + '%</span></div><p class="mono thl">' + lineTxt(x.path, x.dev ? x.dev.ply : null) + '</p>';
  const parts = [x.bookPly ? 'Você segue a teoria até o ' + Math.ceil(x.bookPly / 2) + 'º lance.' : 'A linha sai da teoria logo no começo.'];
  if (x.dev) {
    const d = x.dev, pre = x.path.split(' ').slice(0, d.ply).join(' '), fen = fenAt(pre);
    parts.push('Você sai da teoria com ' + moveNum(d.ply) + fig(d.san) + (d.loss == null ? '.' : d.loss >= 7 ? ', o que custa cerca de ' + Math.round(d.loss) + ' pontos de chance de vitória.' : ', um desvio que o motor aceita.') +
      ' Teoria: ' + d.book.slice(0, 4).map(fig).join(', ') + (d.best && !d.book.includes(d.best) ? '. Motor: ' + withWhy(fen, d.best, d.ply) : '') + '.');
  }
  if (x.oppDev) {
    const d = x.oppDev, upto = x.path.split(' ').slice(0, d.ply + 1).join(' '), nd = nodeAt(x.c, upto);
    parts.push('Seus adversários costumam sair da teoria com ' + moveNum(d.ply) + fig(d.san) + (nd && nd[2] ? '; a melhor resposta é ' + withWhy(fenAt(upto), nd[2], d.ply + 1) : '') + '.');
  }
  return h + '<p>' + esc(parts.join(' ')) + '</p><div class="vxacts"><button class="btn small" type="button" data-thtree="' + x.c + '|' + esc(x.path) + '">Ver na árvore</button>' + (x.dev ? '<button class="btn small" type="button" data-thtree="' + x.c + '|' + esc(x.path.split(' ').slice(0, x.dev.ply).join(' ')) + '">Ir ao desvio</button>' : '') + '</div>';
}
function thError(x, against) {
  const fen = fenAt(x.path), ply = plyOf(x.path), full = x.path ? x.path + ' ' + x.san : x.san;
  let h = '<div class="thhd"><b>' + esc(cleanName(x.name) || 'Sua abertura') + '</b><span class="muted">' + sideTag(x.c) + ' ' + x.n + (against ? ' vezes · ' + x.L + ' derrotas' : ' de ' + x.nodeN + ' vezes · ' + sp(x.sc) + '%') + '</span></div><p class="mono thl">' + lineTxt(full, ply) + '</p>';
  const opp = x.path ? x.path.split(' ').pop() : null;
  const t = [];
  if (against) t.push((opp ? 'Depois de ' + moveNum(ply - 1) + fig(opp) + ', você' : 'Você') + ' respondeu ' + fig(x.san) + ' ' + x.n + ' vezes. É uma armadilha: ' + fig(x.san) + (x.punish[0] ? ' permite ' + withWhy(new Chess(fen).move(x.san).after, x.punish[0], ply + 1) : ' perde muito') + '.');
  else t.push('Nesta posição você costuma jogar ' + fig(x.san) + ', que custa cerca de ' + Math.round(x.loss) + ' pontos de chance de vitória' + (x.inBook ? ' (o lance está nos livros, mas o motor não gosta dele)' : '') + '.' + (x.punish[0] ? ' O motor responderia ' + fig(x.punish[0]) + '.' : ''));
  if (x.best) t.push('O certo é ' + withWhy(fen, x.best, ply) + '.' + (x.bestLine.length > 1 ? ' Linha: ' + x.bestLine.slice(0, 5).map(fig).join(' ') + '.' : ''));
  if (!against && x.book.length && !x.inBook) t.push('Teoria: ' + x.book.slice(0, 4).map(fig).join(', ') + '.');
  return h + '<p>' + esc(t.join(' ')) + '</p><div class="vxacts"><button class="btn small" type="button" data-thtree="' + x.c + '|' + esc(x.path) + '">Ver na árvore</button><button class="btn small accent" type="button" data-thtrain="th:' + x.c + ':' + esc(x.path) + '">Treinar esta posição</button></div>';
}
function thFavor(x) {
  const ply = plyOf(x.path), full = x.path ? x.path + ' ' + x.san : x.san, after = fenAt(full);
  let h = '<div class="thhd"><b>' + esc(cleanName(x.name) || 'Sua abertura') + '</b><span class="muted">' + sideTag(x.c) + ' ' + x.n + ' vezes · você fez ' + sp(x.sc) + '%</span></div><p class="mono thl">' + lineTxt(full, ply) + '</p>';
  const t = ['Seus adversários jogaram ' + moveNum(ply) + fig(x.san) + ' ' + x.n + ' vezes, e é um erro.'];
  if ((x.replyLoss != null && x.replyLoss < 5) || (x.reply && x.reply === x.punishBest)) t.push('Você costuma punir bem com ' + fig(x.reply) + '.');
  else if (x.punishBest) t.push((x.reply ? 'Você costuma responder ' + fig(x.reply) + ', mas a' : 'A') + ' punição é ' + withWhy(after, x.punishBest, ply + 1) + '.' + (x.punishLine.length > 1 ? ' Linha: ' + x.punishLine.slice(0, 5).map(fig).join(' ') + '.' : ''));
  return h + '<p>' + esc(t.join(' ')) + '</p><div class="vxacts"><button class="btn small" type="button" data-thtree="' + x.c + '|' + esc(full) + '">Ver na árvore</button></div>';
}
function thClassic(x) {
  const favor = x.setter === x.userSide; const mi = x.mi;
  let h = '<div class="thhd"><b>' + esc(x.name) + '</b><span class="muted">' + esc(opName({ op: x.op })) + ' · ' + (x.nSetup ? 'a posição aparece em ' + x.nSetup + ' partida' + (x.nSetup > 1 ? 's' : '') + ' sua' + (x.nSetup > 1 ? 's' : '') : 'não apareceu nas suas partidas') + '</span></div>';
  h += '<p class="mono thl">' + lineTxt(x.line.join(' '), mi) + '</p>';
  const t = [x.idea];
  t.push((x.nSetup ? (favor ? 'Nas suas partidas você está do lado que arma a armadilha. ' : 'Nas suas partidas você está do lado que pode cair. ') : '') + 'O erro é ' + moveNum(mi) + fig(x.line[mi]) + (x.alt ? '; o certo é ' + fig(x.alt) : '') + '.');
  return h + '<p>' + esc(t.join(' ')) + '</p>';
}
function renderTheory() {
  const list = $('#thList'); if (!list) return;
  if (!REPORT) { $('#thSub').textContent = 'O relatório de teoria e armadilhas é gerado a partir das suas partidas e fica salvo na sua conta.'; $('#thTabs').innerHTML = ''; $('#thCol').innerHTML = ''; list.innerHTML = '<p class="muted">Ainda não há relatório para ' + esc(S.me) + '.</p>'; return; }
  $('#thSub').textContent = 'Gerado em ' + new Date(REPORT.at).toLocaleDateString('pt-BR') + ' a partir de ' + REPORT.games + ' partidas: linhas com nome do Lichess + avaliação do Stockfish';
  const byC = a => TH.c === 'all' ? a : a.filter(x => x.c === TH.c);
  const tabs = [['lines', 'Suas linhas', byC(REPORT.lines)], ['errors', 'Onde você erra', byC(REPORT.errors)], ['against', 'Armadilhas contra você', byC(REPORT.against)], ['favor', 'Armadilhas a seu favor', byC(REPORT.favor)], ['classic', 'Clássicas', REPORT.classic]];
  $('#thTabs').innerHTML = tabs.map(([k, t, a]) => '<button class="chip" type="button" data-thtab="' + k + '" aria-pressed="' + (TH.tab === k) + '">' + t + ' <span class="mono" style="opacity:.7">' + a.length + '</span></button>').join('');
  $('#thCol').innerHTML = TH.tab === 'classic' ? '' : [['all', 'Todas'], ['w', 'De brancas'], ['b', 'De pretas']].map(([k, t]) => '<button class="chip" type="button" data-thcol="' + k + '" aria-pressed="' + (TH.c === k) + '">' + t + '</button>').join('');
  const cur = tabs.find(t => t[0] === TH.tab)[2];
  let items = cur;
  if (TH.tab === 'classic') items = cur.slice().sort((a, b) => b.nSetup - a.nSetup);
  const fn = { lines: thLine, errors: x => thError(x, false), against: x => thError(x, true), favor: thFavor, classic: thClassic }[TH.tab];
  list.innerHTML = items.length ? items.slice(0, 15).map(x => '<article class="thitem">' + fn(x) + '</article>').join('') : '<p class="muted">Nada aqui por enquanto.</p>';
}
let THQ = null, THQR = null;
function theoryQueue() {
  if (!REPORT) return []; if (THQ && THQR === REPORT) return THQ; const seen = new Set(), out = []; THQR = REPORT; THQ = out;
  for (const x of REPORT.errors.concat(REPORT.against)) {
    const key = 'th:' + x.c + ':' + x.path; if (seen.has(key)) continue; seen.add(key);
    const fen = fenAt(x.path), e = evOf(x.ev); if (!e || !e.best) continue;
    const pm = x.path ? (() => { const c = new Chess(fenAt(x.path.split(' ').slice(0, -1).join(' '))); try { return c.move(x.path.split(' ').pop()); } catch (er) { return null; } })() : null;
    out.push({ key, fen, side: fen.split(' ')[1], best: e.best, played: x.san, k: x.loss >= 18 ? 'blunder' : 'mistake', loss: x.loss, ev: e, name: x.name, path: x.path, c: x.c, last: pm ? [pm.from, pm.to] : null });
  }
  return out;
}
function thPanel(c, path, yourTurn) {
  const nd = nodeAt(c, path); if (!nd) return '';
  const nm = nameAlong(c, path); const book = nd[3] ? nd[3].split(' ') : [];
  return '<div class="thbox">' + (nm ? '<b>' + esc(cleanName(nm)) + '</b>' : '<b>Fora das linhas com nome</b>') +
    '<span>' + (book.length ? 'Teoria aqui: ' + book.slice(0, 5).map(m => '<button class="chip mini" type="button" data-repmv="' + esc(m) + '">' + esc(fig(m)) + '</button>').join(' ') : 'Nenhum lance de teoria registrado a partir daqui.') + '</span>' +
    '<span>Motor: ' + (nd[2] ? '<b>' + esc(fig(nd[2])) + '</b> · ' : '') + esc(evTxt(ndEv(nd))) + (yourTurn ? '' : ' (vez do adversário)') + '</span></div>';
}
function kidMark(c, path, m, mover) {
  const nd = nodeAt(c, path), kd = nodeAt(c, path ? path + ' ' + m : m); let out = '';
  if (nd && nd[3] && nd[3].split(' ').includes(m)) out += '<span class="kmark book" title="Lance de teoria">teoria</span>';
  if (nd && kd) {
    const a = mover === 'w' ? wpWhite(ndEv(nd)) : 100 - wpWhite(ndEv(nd)), b = mover === 'w' ? wpWhite(ndEv(kd)) : 100 - wpWhite(ndEv(kd)), loss = a - b;
    if (loss >= 18) out += '<span class="kmark bad">capivarada</span>'; else if (loss >= 7) out += '<span class="kmark warn">imprecisão</span>'; else if (nd[2] === m) out += '<span class="kmark good">motor</span>';
  }
  return out;
}

/* ---------- sincronização e importação ---------- */
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
function pgnToGame(pgn, me) {
  const H = {}; pgn.replace(/\[(\w+)\s+"([^"]*)"\]/g, (_, k, v) => { H[k] = v; return ''; });
  if ((H.Variant && H.Variant !== 'Standard') || H.SetUp === '1' || H.FEN) return null;
  const c = new Chess(); try { c.loadPgn(pgn); } catch (e) { return null; }
  const hist = c.history(); if (hist.length < 2) return null;
  const body = pgn.slice(pgn.lastIndexOf(']') + 1); const clk = [];
  body.replace(/\[%clk ([0-9:.]+)\]/g, (_, t) => { const a = t.split(':').map(Number); clk.push(Math.round(a.length === 3 ? a[0] * 3600 + a[1] * 60 + a[2] : a[0] * 60 + a[1])); return ''; });
  const W = H.White || '?', Bk = H.Black || '?', mel = String(me || '').toLowerCase();
  const col = Bk.toLowerCase() === mel ? 'b' : 'w';
  const result = H.Result, term = (H.Termination || '').toLowerCase();
  const myWin = (result === '1-0' && col === 'w') || (result === '0-1' && col === 'b'), draw = result === '1/2-1/2';
  const how = /time|tempo/.test(term) ? 'timeout' : /abandon/.test(term) ? 'abandoned' : /checkmate|xeque/.test(term) || c.isCheckmate() ? 'checkmated' : 'resigned';
  let res, oRes;
  if (draw) res = oRes = /repetition/.test(term) ? 'repetition' : /stalemate/.test(term) ? 'stalemate' : /insufficient/.test(term) ? 'insufficient' : 'agreed';
  else if (myWin) { res = 'win'; oRes = how; } else { res = how; oRes = 'win'; }
  const tcH = H.TimeControl || ''; const base = parseInt(tcH, 10) || 600, inc = parseInt(tcH.split('+')[1] || '0', 10) || 0, est = base + 40 * inc;
  const tc = tcH.includes('/') ? 'daily' : est < 180 ? 'bullet' : est < 480 ? 'blitz' : est < 1500 ? 'rapid' : 'classical';
  const link = H.Link || H.Site || '';
  const idm = link.match(/(\d{6,})\/?$/) || link.match(/lichess\.org\/([A-Za-z0-9]{8})/);
  const id = idm ? idm[1] : 'h' + hash(pgn);
  const d = (H.UTCDate || H.EndDate || H.Date || '').replace(/\./g, '-'), t = H.UTCTime || H.EndTime || '12:00:00';
  const end = Math.round(Date.parse(d + 'T' + t + 'Z') / 1000) || Math.round(Date.now() / 1000);
  const op = H.Opening || (H.ECOUrl ? decodeURIComponent(H.ECOUrl.split('/openings/')[1] || '').replace(/-/g, ' ') : (H.ECO || 'Abertura'));
  return { id, tc, ctl: String(tcH.includes('/') ? 86400 : base), end, c: col, opp: col === 'w' ? Bk : W, oR: +(col === 'w' ? H.BlackElo : H.WhiteElo) || null, mR: +(col === 'w' ? H.WhiteElo : H.BlackElo) || null, res, oRes, eco: H.ECO || '', op, mv: hist.join(' '), clk: clk.length === hist.length ? clk : [] };
}
function splitPgns(text) { return String(text).replace(/\r/g, '').split(/\n\s*\n(?=\[Event )/).map(s => s.trim()).filter(s => s.startsWith('[')); }
function importGames(list, defer) {
  const key = 'games:' + acctKey(); const imp = MEM.games[key] = MEM.games[key] || [];
  const ids = new Set(imp.map(g => g.id)); if (isSeed()) for (const g of SEED_GAMES) ids.add(g.id);
  let added = 0;
  for (const g of list) { if (!g || ids.has(g.id)) continue; imp.push(g); ids.add(g.id); added++; }
  if (!defer) { imp.sort((a, b) => b.end - a.end); kv.set(key, imp); loadData(); TRAIN = null; cloudPushGames(); }
  return added;
}
async function saveGames() {
  const key = 'games:' + acctKey(); const imp = MEM.games[key] || [];
  imp.sort((a, b) => b.end - a.end); await kv.set(key, imp); loadData(); TRAIN = null; cloudPushGames();
}
function monthComplete(t) {
  const i = t.lastIndexOf('"pgn"'); if (i < 0) return /"games"\s*:\s*\[\s*\]/.test(t);
  return /\}\s*\]\s*\}/.test(t.slice(i));
}
function monthOk(t, u) {
  const m = t.match(/URL:\s*(\S+)/);
  if (m && /api\.chess\.com/.test(m[1])) return m[1].replace(/\/$/, '') === u && t.includes('"games"');
  const ym = u.slice(-7).split('/');
  return /"games"\s*:\s*\[\s*\]/.test(t) || t.includes('Date \\"' + ym[0] + '.' + ym[1] + '.');
}
let QUEUE = Promise.resolve(), ENGINE_FAIL = false;
function analyzeLatest(n) {
  const todo = S.games.filter(g => !S.an[g.id] && !ANALYZING.has(g.id)).slice(0, n); if (!todo.length) return;
  let done = 0; toast('Analisando ' + todo.length + ' partidas com o Stockfish…');
  for (const g of todo) {
    QUEUE = QUEUE.then(() => ENGINE_FAIL ? null : analyzeGame(g, p => { $$('[data-prog="' + g.id + '"] i').forEach(i => { i.style.width = Math.round(p * 100) + '%'; }); }))
      .then(() => { if (ENGINE_FAIL) return; done++; TRAIN = null; if (S.view !== 'analise' && $('#sync').hidden) showView(S.view); if (done === todo.length) toast('Análise concluída: ' + done + ' partidas'); })
      .catch(() => { if (!ENGINE_FAIL) { ENGINE_FAIL = true; toast('O motor não carregou neste navegador'); } });
  }
  if (S.view === 'partidas') renderPartidas();
}
let MCP = null, MCP_TRIED = false, TAB = null;
async function getMcp() { if (MCP_TRIED) return MCP; MCP_TRIED = true; try { MCP = window.claude && window.claude.use ? await window.claude.use('mcp') : null; } catch (e) { MCP = null; } return MCP; }
const textOf = r => (r && r.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n');
async function browserText(url, okFn) {
  if (NATIVE) return NATIVE.fetchText(url);
  const mcp = await getMcp(); if (!mcp) throw { code: 'no_mcp' };
  if (TAB) { try { await mcp.callTool('host:claude_browser', 'navigate', { url, tabId: TAB }, { cache: false }); } catch (e) { TAB = null; } }
  if (!TAB) { const r = await mcp.callTool('host:claude_browser', 'preview_start', { url }, { cache: false }); const mm = textOf(r).match(/tabId\s+([A-Za-z0-9_-]+)/); TAB = mm ? mm[1] : null; }
  for (let k = 0; k < 6; k++) {
    await sleep(900 + k * 600);
    const r = await mcp.callTool('host:claude_browser', 'get_page_text', TAB ? { tabId: TAB, max_chars: 4000000 } : { max_chars: 4000000 }, { cache: false });
    const tx = textOf(r); if (okFn(tx)) return tx;
  }
  throw { code: 'empty' };
}
async function syncAuto() {
  const st = $('#syncStatus'); const user = $('#syncUser').value.trim(); if (!user) { st.textContent = 'Digite seu usuário.'; return; }
  const plat = S.src === 'lichess' ? 'lichess' : 'chesscom';
  $('#syncGo').disabled = true;
  await switchAccount(user, plat);
  const mkey = 'months:' + acctKey();
  let total = 0, added = 0; const failed = [], trunc = [];
  try {
    if (plat === 'chesscom') {
      st.textContent = 'Abrindo a lista de meses no Chess.com… Se o app pedir permissão para usar o navegador, toque em Permitir.';
      const arch = await browserText('https://api.chess.com/pub/player/' + encodeURIComponent(user.toLowerCase()) + '/games/archives', t => t.includes('"archives"') || /"code"\s*:\s*0|not found/i.test(t));
      if (!arch.includes('"archives"')) throw { code: 'nouser' };
      const all = Array.from(new Set(arch.match(/https:\/\/api\.chess\.com\/pub\/player\/[^"\s]+\/games\/\d{4}\/\d{2}/g) || []));
      if (!all.length) throw { code: 'nogames' };
      const done = await kv.get(mkey, {}); const latest = all[all.length - 1];
      const todo = all.filter(u => done[u] == null || u === latest).reverse();
      for (let k = 0; k < todo.length; k++) {
        const u = todo[k];
        st.textContent = 'Lendo ' + u.slice(-7).replace('/', '-') + ' · mês ' + (k + 1) + ' de ' + todo.length + ' · ' + total + ' partidas lidas até agora…';
        let tx;
        try { tx = await browserText(u, t => monthOk(t, u)); }
        catch (e) { if (e && e.code && e.code !== 'empty' && e.code !== 'tool_error' && e.code !== 'upstream_error') throw e; failed.push(u.slice(-7).replace('/', '-')); continue; }
        const pgns = [];
        tx.replace(/"pgn":"((?:[^"\\]|\\.)*)"/g, (_, x) => { try { pgns.push(JSON.parse('"' + x + '"')); } catch (e) { /* trecho truncado */ } return ''; });
        const games = pgns.map(p => pgnToGame(p, user)).filter(Boolean);
        total += games.length; added += importGames(games, true);
        if (!monthComplete(tx)) trunc.push(u.slice(-7).replace('/', '-') + ' (' + games.length + ' lidas)');
        else if (u !== latest) done[u] = games.length;
        if (k % 4 === 3) { await saveGames(); await kv.set(mkey, done); }
      }
      await kv.set(mkey, done);
    } else {
      const since = await kv.get(mkey, 0);
      st.textContent = 'Lendo partidas no Lichess…';
      const tx = await browserText('https://lichess.org/api/games/user/' + encodeURIComponent(user) + '?max=3000&clocks=true&opening=true' + (since ? '&since=' + (since * 1000 + 1000) : ''), t => t.includes('[Event') || t.trim().length < 400);
      const games = splitPgns(tx).map(p => pgnToGame(p, user)).filter(Boolean);
      total = games.length; added = importGames(games, true);
      if (games.length) await kv.set(mkey, Math.max.apply(null, games.map(g => g.end)));
    }
    await saveGames();
    if (!S.games.length) throw { code: 'nogames' };
    st.textContent = total + ' partidas lidas, ' + added + ' novas. Total na conta: ' + S.games.length + '.' + (failed.length ? ' Não consegui ler ' + failed.length + ' mês(es) (' + failed.slice(0, 4).join(', ') + '); sincronize de novo para tentar outra vez.' : '') + (trunc.length ? ' Mês com partidas demais para ler de uma vez pelo navegador do app: ' + trunc.join(', ') + '. O restante chega pela sincronização do servidor.' : '') + ' Analisando as 10 mais recentes…';
    store.set('auto', $('#autoChk').checked); autoSyncStart();
    refreshAll(); analyzeLatest(10);
    if (!failed.length && !trunc.length) setTimeout(closeSync, 2200);
  } catch (e) {
    await saveGames(); refreshAll();
    const code = e && e.code ? e.code : 'desconhecido';
    st.textContent = (code === 'no_mcp' ? 'A sincronização automática só funciona com o Lance a Lance aberto no app Claude para computador. No celular ou na web, use “Colar PGN”.' :
      code === 'nouser' ? 'Esse usuário não existe no ' + PLAT[S.plat] + '. Confira a grafia.' :
      code === 'nogames' ? 'Não encontrei partidas para ' + user + '.' :
      code === 'not_granted' || code === 'consent_required' || code === 'approval_required' ? 'O acesso ao navegador do app não foi liberado. Toque de novo e escolha Permitir, ou use “Colar PGN”.' :
      code === 'server_not_connected' || code === 'server_unavailable' || code === 'server_not_found' ? 'O navegador do app Claude não está disponível agora. Abra o Lance a Lance no app para computador ou use “Colar PGN”.' :
      'A leitura parou no meio.') + (total ? ' ' + total + ' partidas já foram salvas; sincronize de novo para continuar de onde parou.' : '') + ' (código: ' + code + ')';
  }
  $('#syncGo').disabled = false;
}
async function syncPgn() {
  const st = $('#syncStatus'); const pgns = splitPgns($('#pgnText').value);
  let user = $('#syncUser').value.trim();
  if (!user) { const cnt = {}; for (const p of pgns) for (const k of ['White', 'Black']) { const m = p.match(new RegExp('\\[' + k + ' "([^"]+)"\\]')); if (m) cnt[m[1]] = (cnt[m[1]] || 0) + 1; } user = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || S.me; }
  const plat = /lichess\.org/.test(pgns.join(' ')) ? 'lichess' : 'chesscom';
  const games = pgns.map(p => pgnToGame(p, user)).filter(Boolean);
  if (!games.length) { st.textContent = 'Não encontrei nenhuma partida válida no PGN.'; return; }
  await switchAccount(user, plat);
  const added = importGames(games); st.textContent = games.length + ' partidas lidas, ' + added + ' novas. Analisando as mais recentes…';
  refreshAll(); analyzeLatest(10); setTimeout(closeSync, 1400);
}
function setSrc(src) {
  S.src = src; $$('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.src === src)));
  $('#syncAuto').hidden = src === 'pgn'; $('#syncPgn').hidden = src !== 'pgn'; $('#syncStatus').textContent = '';
}
function openSync() {
  if (NATIVE) {
    $('#syncAutoNote').textContent = 'O app busca o histórico completo direto no ' + (S.src === 'lichess' ? 'Lichess' : 'Chess.com') + '. A primeira vez pode levar um minuto.';
    const lab = $('label[for="autoChk"] span'); if (lab) lab.textContent = 'Sincronização ao vivo: buscar e analisar partidas novas a cada 2 minutos e sempre que você abrir o app';
    const st = $('#syncWhere'); if (st) st.textContent = 'Cada aparelho sincroniza direto com o ' + (S.plat === 'lichess' ? 'Lichess' : 'Chess.com') + '. Análises e progresso de treino ficam salvos neste aparelho.';
  } $('#autoChk').checked = store.get('auto', true); $('#syncUser').value = S.me; setSrc(S.plat); $('#sync').hidden = false; setTimeout(() => $('#syncUser').focus(), 50); }
function closeSync() { $('#sync').hidden = true; }

/*@MORE@*/
/*@MORE2@*/
/*@MORE3@*/

/* ---------- eventos ---------- */
function wire() {
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', movePill);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(movePill);
  $('#openSync').onclick = openSync;
  $('#openPrefs').onclick = openPrefs; $('#prefsClose').onclick = () => { $('#prefs').hidden = true; };
  $('#prefs').addEventListener('click', e => { if (e.target.id === 'prefs') $('#prefs').hidden = true; });
  document.addEventListener('pointerdown', () => { if (AC && AC.state === 'suspended') AC.resume(); }, { passive: true });
  $('#syncClose').onclick = closeSync;
  $('#sync').addEventListener('click', e => { if (e.target.id === 'sync') closeSync(); });
  $$('.seg button').forEach(b => b.onclick = () => setSrc(b.dataset.src));
  $('#syncGo').onclick = syncAuto; $('#pgnGo').onclick = syncPgn;
  $('#pgnFile').onchange = e => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { $('#pgnText').value = String(r.result || ''); syncPgn(); }; r.readAsText(f); };
  document.addEventListener('click', e => {
    const os = e.target.closest('[data-open-sync]'); if (os) { openSync(); return; }
    const an = e.target.closest('[data-analyze]'); if (an) { e.preventDefault(); e.stopPropagation(); runAnalysis(an.dataset.analyze); return; }
    const op = e.target.closest('[data-open]'); if (op) { openGame(op.dataset.open, 0); return; }
    const f = e.target.closest('[data-f]'); if (f) { S.filter = f.dataset.f; S.limit = 60; renderPartidas(); return; }
    if (e.target.closest('#gmMore')) { S.limit = (S.limit || 60) + 100; renderPartidas(); return; }
    if (e.target.closest('[data-analyze-batch]')) { analyzeLatest(10); return; }
    const mv = e.target.closest('#moves .mv'); if (mv) { setPly(+mv.dataset.p); return; }
    const gt = e.target.closest('[data-goto]'); if (gt) { setPly(+gt.dataset.goto); return; }
    const ln = e.target.closest('[data-line]');
    if (ln) { startLine(ln.dataset.line, ln.dataset.uci.split(' '), +ln.dataset.base); return; }
    const vxb = e.target.closest('[data-vx]'); if (vxb) { vxAction(vxb.dataset.vx); return; }
    const pzb = e.target.closest('[data-pz]'); if (pzb) { const k = pzb.dataset.pz; if (S.view === 'treino') { setPzMode(k); if (k === 'theory') $('#puz').scrollIntoView({ behavior: 'smooth', block: 'start' }); } else { if (k === 'warm') S.pendingWarm = true; else S.pendingPz = k; location.hash = 'treino'; } return; }
    const tht = e.target.closest('[data-thtab]'); if (tht) { TH.tab = tht.dataset.thtab; renderTheory(); return; }
    const thc = e.target.closest('[data-thcol]'); if (thc) { TH.c = thc.dataset.thcol; renderTheory(); return; }
    const thr = e.target.closest('[data-thtree]'); if (thr) { const v = thr.dataset.thtree, i = v.indexOf('|'); REP.c = v.slice(0, i); const pth = v.slice(i + 1); REP.path = pth ? pth.split(' ') : []; renderRep(); $('#repCard').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const thx = e.target.closest('[data-thtrain]'); if (thx) { setPzMode('theory', thx.dataset.thtrain); $('#puz').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const rvb = e.target.closest('[data-review]'); if (rvb) { S.pendingReview = rvb.dataset.review; if (S.view === 'treino') renderTreino(); else location.hash = 'treino'; return; }
    const prb = e.target.closest('[data-pref]'); if (prb) { setPref(prb.dataset.pref); return; }
    if (e.target.closest('[data-pgn]')) { exportPgn(); return; }
    const rpm = e.target.closest('[data-repmv]'); if (rpm) { REP.path.push(rpm.dataset.repmv); renderRep(); return; }
    const rpg = e.target.closest('[data-repgo]'); if (rpg) { REP.path = REP.path.slice(0, +rpg.dataset.repgo); renderRep(); return; }
    const rpp = e.target.closest('[data-reppath]'); if (rpp) { REP.path = rpp.dataset.reppath.split(' '); renderRep(); $('#repCard').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const rps = e.target.closest('[data-rep]'); if (rps) { REP.c = rps.dataset.rep; REP.path = []; renderRep(); return; }
    if (e.target.closest('#repEval')) { repEval(); return; }
    const tb = e.target.closest('#tbox i'); if (tb) { setPly(+tb.dataset.p); return; }
    const opl = e.target.closest('[data-openply]'); if (opl) { const q = opl.dataset.openply.split(':'); openGame(q[0], +q[1]); return; }
    const qq = e.target.closest('[data-quote]'); if (qq) { showQuote(+qq.dataset.quote); quoteTimer(); return; }
    const mb = e.target.closest('[data-maia]'); if (mb) { if (mb.dataset.maia === 'load') maiaLoad(); else maiaAnalyze(); return; }
    const qb = e.target.closest('[data-q]'); if (qb) { queueAction(qb.dataset.q); return; }
    const qs = e.target.closest('[data-queue]'); if (qs) { const ids = qs.dataset.queue === 'today' ? habits().today.slice().sort((a, b) => a.end - b.end).map(g => g.id) : ($$('#gmList [data-open]').map(b => b.dataset.open).slice(0, 25)); startQueue(ids, qs.dataset.queue === 'today' ? 'Partidas de hoje' : 'Fila de revisão'); return; }
    const pin = e.target.closest('[data-pin]'); if (pin) { const L = store.get('pinLines', []), k = pin.dataset.pin, i = L.indexOf(k); if (i >= 0) L.splice(i, 1); else L.push(k); store.set('pinLines', L); STH.stOpen = null; $('#stOpen').innerHTML = '<div class="stack" style="gap:12px">' + openingsDeep() + '</div>'; return; }
    const dt = e.target.closest('[data-dt]'); if (dt && S.dos) { dosTreeAction(dt.dataset.dt, S.dos); return; }
    if (e.target.closest('[data-crit-bulk]')) { critBulk(30); return; }
    const bl = e.target.closest('[data-blind]'); if (bl) { store.set('blind', bl.dataset.blind); renderPzModes(); blindApply(); return; }
    const arb = e.target.closest('[data-ar]'); if (arb) { const a = arb.dataset.ar; if (a.startsWith('open:')) openArena(a.slice(5)); else arAction(a); return; }
    const gs = e.target.closest('[data-guess]'); if (gs) { if (gs.dataset.guess === 'start') startGuess(); else guessAction(gs.dataset.guess); return; }
    const gg = e.target.closest('[data-guess-game]'); if (gg) { S.pendingGuess = gg.dataset.guessGame; openGame(gg.dataset.guessGame, 0); return; }
    if (e.target.closest('[data-guess-last]')) { const g = S.games.find(x => S.an[x.id] && prep(x).cls && guessList(prep(x)).length && !store.get('guess', {})[x.id]) || S.games.find(x => S.an[x.id]); if (g) { S.pendingGuess = g.id; openGame(g.id, 0); } else toast('Analise uma partida primeiro.'); return; }
    const ds = e.target.closest('[data-dos]'); if (ds) { openDossier(ds.dataset.dos); return; }
    if (e.target.closest('[data-card]')) { openCard(); return; }
    const cg = e.target.closest('[data-card-game]'); if (cg) { S.gid = cg.dataset.cardGame; openCard(); return; }
    const cs = e.target.closest('[data-cardsave]'); if (cs) { saveCard(cs.dataset.cardsave === 'share'); return; }
    const rem = e.target.closest('[data-rem]'); if (rem) { setReminder(+rem.dataset.rem); return; }
    if (e.target.closest('[data-focus]')) { toggleFocus(); return; }
  });
  for (const id of ['dos', 'card']) { $('#' + id).addEventListener('click', e => { if (e.target.id === id || e.target.closest('[data-close]')) $('#' + id).hidden = true; }); }
  $('#bFirst').onclick = () => setPly(0); $('#bPrev').onclick = () => setPly(S.ply - 1);
  $('#bNext').onclick = () => setPly(S.ply + 1); $('#bLast').onclick = () => setPly(1e9);
  $('#bFlip').onclick = () => { S.flip = !S.flip; AB.setFlip(S.flip); $('#evV').classList.toggle('flip', S.flip); refreshBoard(); };
  document.addEventListener('keydown', e => {
    if (S.view !== 'analise' || e.target.closest('input,textarea,select') || !$('#sync').hidden) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); if (S.vx) vxUndo(); else setPly(S.ply - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); if (!S.vx) setPly(S.ply + 1); }
    else if (e.key === 'Escape' && (S.vx || S.vxSetup)) { e.preventDefault(); exitVx(); }
    else if (e.key === 'Home') { e.preventDefault(); setPly(0); }
    else if (e.key === 'End') { e.preventDefault(); setPly(1e9); }
    else if (e.key === 'f' || e.key === 'F') $('#bFlip').click();
  });
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!$('#sync').hidden) closeSync(); if (!$('#prefs').hidden) $('#prefs').hidden = true; if (!$('#dos').hidden) $('#dos').hidden = true; if (!$('#card').hidden) $('#card').hidden = true; if (document.documentElement.classList.contains('focus')) toggleFocus(false); });
  const gb = $('#gbox');
  const seek = e => { const r = gb.getBoundingClientRect(); const P = currentP(); if (!P) return; setPly(Math.round((e.clientX - r.left) / r.width * P.moves.length)); };
  let gDown = false;
  gb.addEventListener('pointerdown', e => { gDown = true; seek(e); });
  gb.addEventListener('pointermove', e => { if (gDown) seek(e); });
  window.addEventListener('pointerup', () => { gDown = false; });
  gb.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.stopPropagation(); } });
  $('#pzHint').onclick = puzzleHint; $('#pzSol').onclick = puzzleSolution;
  $('#pzNext').onclick = () => { S.puz++; loadPuzzle(); };
}

/* ---------- atualizações do app instalado ---------- */
function updBanner(html) {
  let el = $('#updBar'); if (!el) { el = document.createElement('div'); el.id = 'updBar'; el.className = 'updbar'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.innerHTML = html; el.hidden = false;
}
window.addEventListener('lal-update', () => updBanner('<span>Nova versão do app pronta.</span><button class="btn small primary" type="button" data-upd="reload">Atualizar agora</button><button class="btn small" type="button" data-upd="later">Depois</button>'));
window.addEventListener('lal-shell-ready', () => updBanner('<span>Nova versão do instalador baixada.</span><button class="btn small primary" type="button" data-upd="shell">Reiniciar e instalar</button><button class="btn small" type="button" data-upd="later">Ao fechar</button>'));
window.addEventListener('lal-shell-new', e => {
  if (NATIVE && NATIVE.platform === 'windows' && !NATIVE.portable) return;
  if (store.get('shellSeen') === e.detail.version) return; store.set('shellSeen', e.detail.version);
  updBanner('<span>Versão ' + esc(e.detail.version) + ' do aplicativo disponível.</span><a class="btn small primary" href="' + window.__RELEASES + '" target="_blank" rel="noopener">Baixar</a><button class="btn small" type="button" data-upd="later">Depois</button>');
});
window.addEventListener('lal-uptodate', () => toast('Você já está na versão mais recente'));
window.addEventListener('lal-update-fail', () => toast('Não consegui procurar atualizações agora'));
document.addEventListener('click', e => {
  const b = e.target.closest('[data-upd]'); if (!b) return; const a = b.dataset.upd;
  if (a === 'reload') location.reload();
  else if (a === 'shell' && window.native && window.native.installShellUpdate) window.native.installShellUpdate();
  else if (a === 'check' && window.__checkUpdate) { toast('Procurando atualização…'); window.__checkUpdate(); }
  else if (a === 'later') { const el = $('#updBar'); if (el) el.hidden = true; }
});

/* ---------- início ---------- */
applyPrefs();
loadData();
$('#acct').textContent = acctLabel();
wire();
route();
v14Start();
hydrate().then(() => { loadData(); TRAIN = null; showView(S.view || 'painel'); v14Data(); return cloudStart(); });
try { if (window.__APP_BUILD != null) localStorage.setItem('lal.bootok', String(window.__APP_BUILD)); } catch (e) { /* sem armazenamento */ }
})();
