/* ======================================================================
   Biblioteca: livros e cursos interativos (estilo Chessable / Lotus Chess)
   - livros que vêm no app (Xadrez Vitorioso I–IV, Meu Raio-X, Xadrez Lógico): data/livros.json
   - importar estudo do Lichess, PGN/repertório, montar no tabuleiro, das suas partidas
   - livro em PDF convertido pelo Claude (só no app Claude: usa a capacidade "sample")
   - revisão espaçada no estilo MoveTrainer: 4 h, 1 d, 3 d, 1 sem, 2 sem, 1 mês, 3 meses, 6 meses
   ====================================================================== */
/*@LIVROS@*/
/* ---------- PGN: leitura com variantes, comentários, setas e notação em português ---------- */
const PGNLIB = (() => {
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const NAGS = { 1: '!', 2: '?', 3: '!!', 4: '??', 5: '!?', 6: '?!' };
  const PT = { C: 'N', D: 'Q', T: 'R', R: 'K', B: 'B', A: 'B' };
  // lance em português (C, B, T, D, R) ou com figurinhas para SAN em inglês
  function toEN(s) {
    s = String(s || '').trim().replace(/[♔♚]/g, 'K').replace(/[♕♛]/g, 'Q').replace(/[♖♜]/g, 'R').replace(/[♗♝]/g, 'B').replace(/[♘♞]/g, 'N').replace(/[♙♟]/g, '');
    s = s.replace(/^0-0-0/, 'O-O-O').replace(/^0-0/, 'O-O').replace(/[–—]/g, '-');
    if (/^[CDTRA][a-h1-8x]/.test(s)) s = PT[s[0]] + s.slice(1);
    s = s.replace(/=?([CDTR])(?=[+#]?$|[+#!?])/, (m, p) => '=' + PT[p]);
    return s;
  }
  const clean = s => String(s || '').replace(/[!?]+$/, '').replace(/^(\d+)\.+/, '');
  // tira [%cal ...], [%csl ...], [%clk ...] do comentário e devolve setas e casas
  function shapes(c) {
    const ar = [], mk = [];
    c = String(c || '').replace(/\[%cal\s+([^\]]*)\]/g, (m, x) => { for (const t of x.split(',')) { const mm = t.trim().match(/^([GRYB])?([a-h][1-8])([a-h][1-8])$/); if (mm) ar.push([mm[2], mm[3], (mm[1] || 'G').toLowerCase()]); } return ''; })
      .replace(/\[%csl\s+([^\]]*)\]/g, (m, x) => { for (const t of x.split(',')) { const mm = t.trim().match(/^([GRYB])?([a-h][1-8])$/); if (mm) mk.push([mm[2], (mm[1] || 'G').toLowerCase()]); } return ''; })
      .replace(/\[%[a-z]+[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    return { c, ar, mk };
  }
  function tokenize(t) {
    const out = []; let i = 0; const n = t.length;
    while (i < n) {
      const ch = t[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '{') { const j = t.indexOf('}', i + 1); const e = j < 0 ? n : j; out.push({ k: 'c', v: t.slice(i + 1, e) }); i = e + 1; continue; }
      if (ch === ';') { const j = t.indexOf('\n', i); const e = j < 0 ? n : j; out.push({ k: 'c', v: t.slice(i + 1, e) }); i = e; continue; }
      if (ch === '(' || ch === ')') { out.push({ k: ch }); i++; continue; }
      if (ch === '[') { const j = t.indexOf(']', i); const e = j < 0 ? n : j; const m = t.slice(i + 1, e).match(/^\s*(\w+)\s+"((?:[^"\\]|\\.)*)"/); if (m) out.push({ k: 'h', n: m[1], v: m[2].replace(/\\"/g, '"') }); i = e + 1; continue; }
      if (ch === '$') { const m = t.slice(i).match(/^\$(\d+)/); if (m) { out.push({ k: 'n', v: +m[1] }); i += m[0].length; continue; } i++; continue; }
      const m = t.slice(i).match(/^[^\s{}();[\]]+/); const w = m ? m[0] : ch; i += w.length;
      if (/^(1-0|0-1|1\/2-1\/2|½-½|\*)$/.test(w)) { out.push({ k: 'r', v: w }); continue; }
      const mn = w.match(/^(\d+)(\.+)(.*)$/);
      if (mn) { if (mn[3]) out.push({ k: 'm', v: mn[3] }); continue; }
      if (/^\d+$/.test(w)) continue;
      out.push({ k: 'm', v: w });
    }
    return out;
  }
  // um ou mais jogos; cada nó: { s: lance, nag, c: comentário depois do lance, ch: [filhos] } (filho 0 = linha principal)
  function parse(text) {
    const toks = tokenize(String(text || '').replace(/\r/g, '').replace(/^﻿/, ''));
    const games = []; let g = null, i = 0;
    const newGame = () => { g = { h: {}, root: { ch: [], c: '' }, res: '' }; games.push(g); };
    const seq = (parent) => {
      let prev = parent; const start = parent;
      while (i < toks.length) {
        const t = toks[i];
        if (t.k === 'h') return 'h';
        if (t.k === ')') { i++; return ')'; }
        if (t.k === 'r') { g.res = t.v; i++; continue; }
        if (t.k === 'c') { if (prev === start && !start.ch.length) start.c = (start.c ? start.c + ' ' : '') + t.v; else prev.c = (prev.c ? prev.c + ' ' : '') + t.v; i++; continue; }
        if (t.k === 'n') { if (prev !== start) prev.nag = NAGS[t.v] || prev.nag; i++; continue; }
        if (t.k === '(') {
          i++; const base = prev.par || start; const vroot = { ch: [], c: '', virt: 1 };
          const r = seq(vroot); for (const k of vroot.ch) { k.par = base; base.ch.push(k); }
          if (vroot.c && vroot.ch[0]) vroot.ch[0].pc = vroot.c;
          if (r === 'h') return 'h'; continue;
        }
        if (t.k === 'm') {
          const raw = t.v; const mm = raw.match(/^(.*?)([!?]{1,2})$/);
          const node = { s: mm ? mm[1] : raw, ch: [], c: '', par: prev };
          if (mm) node.nag = mm[2];
          prev.ch.push(node); prev = node; i++; continue;
        }
        i++;
      }
      return 'end';
    };
    while (i < toks.length) {
      if (toks[i].k === 'h') { if (!g || g.started) newGame(); while (i < toks.length && toks[i].k === 'h') { g.h[toks[i].n] = toks[i].v; i++; } }
      if (!g) newGame();
      g.started = true;
      const r = seq(g.root);
      if (r === 'end') break;
      if (r === ')') continue;
    }
    for (const x of games) delete x.started;
    return games.filter(x => x.root.ch.length || x.root.c || x.h.FEN || Object.keys(x.h).length);
  }
  // valida contra as regras; tira lances ilegais e o que vem depois deles
  function legalize(game, Chess) {
    let fen = game.h.FEN || START; let ok = true;
    try { new Chess(fen); } catch (e) { fen = START; ok = false; }
    const walk = (node, c) => {
      node.ch = node.ch.filter(k => {
        const san = toEN(clean(k.s));
        const cc = new Chess(c.fen()); let m = null;
        try { m = cc.move(san); } catch (e) { m = null; }
        if (!m) { ok = false; return false; }
        k.s = m.san; k.fen = cc.fen(); k.from = m.from; k.to = m.to; k.color = m.color;
        walk(k, cc); return true;
      });
    };
    walk(game.root, new Chess(fen));
    game.fen = fen; return ok;
  }
  // todas as linhas (raiz até a folha), estilo Chessable
  function lines(game, max) {
    const out = []; max = max || 400;
    const go = (node, path) => {
      if (out.length >= max) return;
      if (!node.ch.length) { if (path.length) out.push(path.slice()); return; }
      node.ch.forEach((k, j) => { path.push({ n: k, alt: j > 0 }); go(k, path); path.pop(); });
    };
    go(game.root, []);
    return out;
  }
  return { START, toEN, clean, shapes, parse, legalize, lines, tokenize };
})();

/* =====================================================================
   Biblioteca: livros e cursos interativos no estilo Chessable / Lotus.
   Cursos próprios (Xadrez Vitorioso, Xadrez Lógico), estudos do Lichess,
   PGN e repertório, livros em PDF convertidos pelo Claude, e revisão
   espaçada (MoveTrainer) de tudo o que você aprendeu.
   ===================================================================== */
const BIB = { builtin: null, user: null, idx: null, conv: null, saveT: 0, cloudT: 0, pulled: false };
const BSTART = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const BKIND = { c: 'Leitura', d: 'Demonstração', l: 'Linha', p: 'Exercício', x: 'Desafio', q: 'Pergunta', s: 'Casas' };
const BTRAIN = it => it.k === 'p' || it.k === 'q' || it.k === 's' || (it.k === 'l' && it.ask !== 'none' && !!it.side);
// intervalos da revisão espaçada por nível (como o MoveTrainer): 4 h, 1 d, 3 d, 1 sem, 2 sem, 1 mês, 3 meses, 6 meses
const BIV = [0, 4 * 36e5, 864e5, 3 * 864e5, 7 * 864e5, 14 * 864e5, 30 * 864e5, 90 * 864e5, 180 * 864e5];
const BMAXL = BIV.length - 1;
const bnow = () => Date.now();
const bday = (d) => { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function bibLoadBuiltin() {
  if (BIB.builtin) return BIB.builtin;
  try { BIB.builtin = typeof BIB_BOOKS_RAW === 'string' ? JSON.parse(BIB_BOOKS_RAW) : []; } catch (e) { BIB.builtin = []; }
  for (const c of BIB.builtin) c.builtin = 1;
  return BIB.builtin;
}
async function bibLoadUser() {
  if (BIB.user) return BIB.user;
  let u = await kv.get('bib:courses', []);
  if (!Array.isArray(u)) u = [];
  BIB.user = u; BIB.idx = null; return u;
}
function bibCourses() {
  const b = bibLoadBuiltin(), u = BIB.user || [];
  const hidden = bprog().hide || {};
  return u.concat(b).filter(c => !hidden[c.id]);
}
function bibCourse(id) { return (BIB.user || []).find(c => c.id === id) || bibLoadBuiltin().find(c => c.id === id) || null; }
function bibItem(c, iid) { for (const ch of c.ch) for (const it of ch.it) if (it.id === iid) return { it, ch }; return null; }
function bibFlat(c) { const out = []; for (const ch of c.ch) for (const it of ch.it) out.push({ it, ch }); return out; }
const bcard = (cid, iid) => cid + '|' + iid;
/* progresso: cartões da revisão, itens lidos, atividade por dia */
let BPROG = null;
function bprog() {
  if (BPROG) return BPROG;
  BPROG = store.get('bib', null) || {};
  BPROG.c = BPROG.c || {}; BPROG.r = BPROG.r || {}; BPROG.day = BPROG.day || {}; BPROG.goal = BPROG.goal || 30; BPROG.hide = BPROG.hide || {};
  return BPROG;
}
function bsave() {
  clearTimeout(BIB.saveT);
  BIB.saveT = setTimeout(() => { store.set('bib', bprog()); bibCloudPushProg(); }, 300);
}
function bdayAdd(n) { const p = bprog(), k = bday(); p.day[k] = (p.day[k] || 0) + (n || 1); bsave(); try { act('bib', n || 1); } catch (e) { /* sem atividade */ } }
function bstreak() {
  const p = bprog(); let n = 0; const d = new Date();
  if (!p.day[bday(d)]) d.setDate(d.getDate() - 1);
  while (p.day[bday(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function bcardGet(cid, iid) { return bprog().c[bcard(cid, iid)] || null; }
// nota: true = acertou sem erros
function bgrade(cid, iid, clean, learnOnly) {
  const p = bprog(), k = bcard(cid, iid), t = bnow();
  let c = p.c[k];
  if (!c) c = p.c[k] = { l: 0, d: 0, n: 0, x: 0, t: 0, a: t };
  if (learnOnly) { c.l = Math.max(c.l, 1); }
  else if (clean) c.l = Math.min(BMAXL, c.l + 1);
  else { c.l = 1; c.x++; }
  c.n++; c.t = t; c.d = t + BIV[c.l];
  bsave(); return c;
}
function bread(cid, iid) { const p = bprog(), k = bcard(cid, iid); if (!p.r[k]) { p.r[k] = bnow(); bsave(); } }
function bisDone(cid, it) { const k = bcard(cid, it.id), p = bprog(); return BTRAIN(it) ? !!p.c[k] : !!p.r[k]; }
function bdue(cid) {
  const p = bprog(), t = bnow(), out = [];
  for (const k in p.c) { const c = p.c[k]; if (c.d > t) continue; const i = k.indexOf('|'), ci = k.slice(0, i); if (cid && ci !== cid) continue; out.push({ cid: ci, iid: k.slice(i + 1), c }); }
  // primeiro os mais atrasados e de nível mais baixo
  out.sort((a, b) => (a.c.l - b.c.l) || (a.c.d - b.c.d));
  return out.filter(x => { const c = bibCourse(x.cid); return c && bibItem(c, x.iid); });
}
function bnextDue(cid) { const p = bprog(); let m = Infinity; for (const k in p.c) { if (cid && !k.startsWith(cid + '|')) continue; m = Math.min(m, p.c[k].d); } return m; }
function bstats(c) {
  let n = 0, done = 0, due = 0, tr = 0, lvl = 0; const p = bprog(), t = bnow();
  for (const ch of c.ch) for (const it of ch.it) { n++; const k = bcard(c.id, it.id); if (BTRAIN(it)) { tr++; const cd = p.c[k]; if (cd) { done++; lvl += cd.l; if (cd.d <= t) due++; } } else if (p.r[k]) done++; }
  return { n, done, due, tr, pct: n ? done / n : 0, mastery: tr ? lvl / (tr * BMAXL) : 0 };
}
function bwhen(ms) {
  const d = ms - bnow(); if (d <= 0) return 'agora';
  const h = d / 36e5; if (h < 1) return 'em ' + Math.max(1, Math.round(d / 6e4)) + ' min';
  if (h < 24) return 'em ' + Math.round(h) + ' h';
  const dd = Math.round(h / 24); if (dd < 31) return 'em ' + dd + (dd === 1 ? ' dia' : ' dias');
  const m = Math.round(dd / 30); return 'em ' + m + (m === 1 ? ' mês' : ' meses');
}
/* cursos do usuário: salvos no aparelho e na conta Claude */
function bibSaveUser(course, cloud) {
  if (course) course.t = bnow();
  clearTimeout(BIB.userT);
  BIB.userT = setTimeout(() => { kv.set('bib:courses', BIB.user || []); }, 250);
  if (course && cloud !== false) bibCloudPushCourse(course);
}
function bibAddCourse(c) {
  BIB.user = BIB.user || []; const i = BIB.user.findIndex(x => x.id === c.id);
  if (i >= 0) BIB.user[i] = c; else BIB.user.unshift(c);
  bibSaveUser(c);
}
async function bibDeleteCourse(id) {
  BIB.user = (BIB.user || []).filter(c => c.id !== id); bibSaveUser(null);
  const p = bprog(); for (const k of Object.keys(p.c)) if (k.startsWith(id + '|')) delete p.c[k]; for (const k of Object.keys(p.r)) if (k.startsWith(id + '|')) delete p.r[k]; bsave();
  if (Cloud.on) { try { const qs = await Cloud.db.collection(Cloud.base + '/bibp/c').where('cid', '==', id).get(); for (const d of qs.docs) await Cloud.db.doc(Cloud.base + '/bibp/c/' + d.id).delete(); } catch (e) { /* tenta na próxima */ } }
}
const BIBH = {};
async function bibCloudPushCourse(c) {
  if (!Cloud.on || !c || c.builtin) return;
  const str = JSON.stringify(c), parts = [];
  for (let i = 0; i < str.length; i += 170000) parts.push(str.slice(i, i + 170000));
  try {
    for (let k = 0; k < parts.length; k++) {
      const id = c.id + '~' + String(k).padStart(3, '0'), h = strHash(parts[k]) + ':' + parts.length;
      if (BIBH[id] === h) continue;
      await Cloud.db.doc(Cloud.base + '/bibp/c/' + id).set({ cid: c.id, k, n: parts.length, s: parts[k], t: c.t || bnow() }); BIBH[id] = h;
    }
    // partes que sobraram de uma versão maior
    const prevN = BIBH[c.id] || 0;
    for (let k = parts.length; k < prevN; k++) { const id = c.id + '~' + String(k).padStart(3, '0'); try { await Cloud.db.doc(Cloud.base + '/bibp/c/' + id).delete(); } catch (e) { /* sem parte */ } delete BIBH[id]; }
    BIBH[c.id] = parts.length;
  } catch (e) { /* o próximo salvamento tenta de novo */ }
}
function bibCloudPushProg() {
  if (!Cloud.on) return; clearTimeout(BIB.cloudT);
  BIB.cloudT = setTimeout(async () => { try { await Cloud.db.doc(Cloud.base + '/bibp').set({ p: JSON.stringify(bprog()), t: bnow() }); } catch (e) { /* tenta depois */ } }, 2000);
}
function bibMergeProg(o) {
  if (!o) return; const p = bprog();
  for (const k in o.c || {}) { const a = p.c[k], b = o.c[k]; if (!a || (b.t || 0) > (a.t || 0)) p.c[k] = b; }
  for (const k in o.r || {}) if (!p.r[k]) p.r[k] = o.r[k];
  for (const k in o.day || {}) p.day[k] = Math.max(p.day[k] || 0, o.day[k]);
  for (const k in o.hide || {}) p.hide[k] = o.hide[k];
  if (o.goal && !store.get('bib', null)) p.goal = o.goal;
  if (o.last && (!p.last || (o.last.t || 0) > (p.last.t || 0))) p.last = o.last;
  store.set('bib', p);
}
async function bibCloudPull() {
  if (!Cloud.on || BIB.pulled) return; BIB.pulled = true;
  await bibLoadUser();
  try { const d = await Cloud.db.doc(Cloud.base + '/bibp').get(); const b = d && (d.data ? d.data() : d); if (b && b.p) bibMergeProg(JSON.parse(b.p)); } catch (e) { /* sem progresso salvo */ }
  try {
    const qs = await Cloud.db.collection(Cloud.base + '/bibp/c').limit(1500).get(); const by = {};
    for (const d of qs.docs) { const b = d.data() || {}; if (!b.cid || typeof b.s !== 'string') continue; (by[b.cid] = by[b.cid] || []).push(b); BIBH[d.id] = strHash(b.s) + ':' + b.n; }
    let got = 0;
    for (const cid in by) {
      const ps = by[cid].sort((a, b) => a.k - b.k); BIBH[cid] = Math.max(ps.length, ps[0].n); if (ps.length !== ps[0].n) continue;
      let c; try { c = JSON.parse(ps.map(x => x.s).join('')); } catch (e) { continue; }
      const loc = BIB.user.find(x => x.id === cid);
      if (!loc) { BIB.user.push(c); got++; } else if ((c.t || 0) > (loc.t || 0)) { Object.assign(loc, c); got++; }
      else if ((loc.t || 0) > (c.t || 0)) bibCloudPushCourse(loc);
    }
    for (const c of BIB.user) if (!by[c.id]) bibCloudPushCourse(c);
    if (got) { bibSaveUser(null); }
  } catch (e) { /* sem cursos na nuvem */ }
  if (S.view === 'biblioteca' && (!S.bib || S.bib.pg === 'home' || S.bib.pg === 'course')) bibRender();
}
(function bibCloudWait() {
  let n = 0; const t = setInterval(() => { n++; if (Cloud.on) { clearInterval(t); bibCloudPull(); } else if (n > 60) clearInterval(t); }, 1500);
})();
let BIBSEQ = 0;
const bid = p => (p || 'c') + Date.now().toString(36) + (BIBSEQ++).toString(36) + Math.random().toString(36).slice(2, 5);

/* ---------- Biblioteca: telas ---------- */
const BSRC = { livro: 'Livro', lichess: 'Lichess', pgn: 'PGN', pdf: 'PDF', rep: 'Repertório', jogos: 'Suas partidas' };
const BIC = {
  c: '<path d="M4 5.5h6.5a2 2 0 0 1 2 2V18a1.6 1.6 0 0 0-1.6-1.6H4zM20 5.5h-6.5a2 2 0 0 0-2 2V18a1.6 1.6 0 0 1 1.6-1.6H20z"/>',
  d: '<path d="M7 5.5v13l11-6.5z"/>',
  l: '<path d="M6 18V12M6 12 12 6M12 6l6 6M18 12v6M12 6V4"/>',
  p: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3.2"/>',
  x: '<path d="M5 19 19 5M8 5h11v11"/>',
  q: '<path d="M9.3 9a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2 1-1.2 1.9V14"/><path d="M12 17.6v.1" stroke-width="2.4"/>',
  s: '<rect x="4.5" y="4.5" width="6" height="6" rx="1"/><rect x="13.5" y="13.5" width="6" height="6" rx="1"/><rect x="13.5" y="4.5" width="6" height="6" rx="1" opacity=".4"/>'
};
const bic = k => '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (BIC[k] || BIC.c) + '</svg>';
function bcover(c, big) {
  const h = c.hue != null ? c.hue : (strHash(c.id).charCodeAt(0) * 47) % 360;
  return '<span class="bib-cover' + (big ? ' big' : '') + '" style="--h:' + h + '" aria-hidden="true"><span class="bib-gl"><i class="pc ' + esc((c.glyph || 'wn').toLowerCase()) + '"></i></span><span class="bib-tag">' + esc(BSRC[c.src] || 'Curso') + '</span></span>';
}
// texto vindo de fora (Lichess, PDF, PGN): só formatação simples
function btx(s) {
  if (!s) return '';
  return String(s).split(/\n{2,}/).map(p => '<p>' + esc(p).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>') + '</p>').join('');
}
const bhtml = (it, c) => it.html && c && c.builtin ? it.html : btx(it.tx || '');
function bring(v, goal) {
  const f = Math.max(0, Math.min(1, v / Math.max(1, goal))), R = 26, L = 2 * Math.PI * R;
  return '<svg class="bib-ringsvg" width="68" height="68" viewBox="0 0 68 68" aria-hidden="true"><circle cx="34" cy="34" r="' + R + '" fill="none" stroke="var(--surface-2)" stroke-width="7"/><circle cx="34" cy="34" r="' + R + '" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (L * f).toFixed(1) + ' ' + L.toFixed(1) + '" transform="rotate(-90 34 34)"/></svg>';
}
const BFLAME = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.5 2.5c.6 3.3-1.6 5-3.2 6.8C7.7 11 6.5 12.8 6.5 15a5.5 5.5 0 0 0 11 0c0-2.2-1-3.8-2-5 .1 1.4-.4 2.6-1.5 3 .7-3.6-.4-7.6-1.5-10.5z"/></svg>';
function renderBiblioteca() {
  S.bib = S.bib || { pg: 'home', open: {} };
  if (!BIB.user) { $('#bibMain').innerHTML = '<p class="muted">Abrindo a biblioteca…</p>'; bibLoadUser().then(() => { if (S.view === 'biblioteca') bibRender(); }); return; }
  bibRender();
}
function bibRender() {
  const B = S.bib = S.bib || { pg: 'home', open: {} };
  const play = B.pg === 'play';
  $('#bibMain').hidden = play; $('#bibPlay').hidden = !play;
  if (play) return;
  if (BP.s) bpStop();
  if (B.pg === 'course' && bibCourse(B.cid)) bibCoursePage();
  else if (B.pg === 'add') bibAddPage();
  else { B.pg = 'home'; bibHome(); }
}
function bibGo(pg, o) { Object.assign(S.bib = S.bib || { open: {} }, { pg }, o || {}); if (pg !== 'play') window.scrollTo(0, 0); bibRender(); }
function bibCard(c) {
  const st = bstats(c);
  const conv = c.pdf && c.pdf.next <= c.pdf.to;
  return '<button type="button" class="card bib-card" data-bib="open:' + esc(c.id) + '">' + bcover(c) +
    '<span class="bib-cb"><b>' + esc(c.title) + '</b><span class="muted bib-sub">' + esc(c.sub || '') + '</span>' +
    '<span class="bar"><i style="width:' + Math.round(st.pct * 100) + '%;background:var(--accent)"></i></span>' +
    '<span class="bib-meta"><span>' + st.done + ' de ' + st.n + '</span>' + (st.due ? '<span class="bib-due">' + st.due + ' para revisar</span>' : conv ? '<span class="bib-due conv">convertendo</span>' : st.done === st.n && st.n ? '<span class="bib-ok">concluído</span>' : '') + '</span></span></button>';
}
function bibHome() {
  const p = bprog(), all = bibCourses(), due = bdue(), today = p.day[bday()] || 0, sk = bstreak();
  let learned = 0, mastered = 0; for (const k in p.c) { learned++; if (p.c[k].l >= 6) mastered++; }
  const nd = bnextDue();
  const last = p.last && bibCourse(p.last.cid);
  const user = (BIB.user || []).filter(c => !p.hide[c.id]), books = bibLoadBuiltin().filter(c => !p.hide[c.id]);
  let h = '<div class="bib-top"><div class="stack" style="gap:4px"><h1 class="h-page" id="h-bib">Biblioteca</h1><p class="sub">Livros, estudos e repertórios interativos com revisão espaçada</p></div><button class="btn primary" type="button" data-bib="add">+ Adicionar curso</button></div>';
  h += '<section class="card bib-hero">' +
    '<div class="bib-today"><span class="label">Revisão de hoje</span>' +
    (due.length ? '<div class="bib-bigrow"><b class="bib-big mono">' + due.length + '</b><span>' + (due.length === 1 ? 'item esperando' : 'itens esperando') + ' revisão</span></div><button class="btn primary bib-go" type="button" data-bib="review">Revisar agora</button>'
      : '<div class="bib-bigrow"><b class="bib-big">Tudo em dia</b></div><p class="muted">' + (nd < Infinity ? 'Próxima revisão ' + bwhen(nd) + '.' : 'Aprenda as primeiras linhas e elas voltam aqui na hora certa.') + '</p>' + (learned ? '<button class="btn" type="button" data-bib="drill">Treino extra</button>' : '')) +
    '</div><div class="bib-ring">' + bring(today, p.goal) + '<div><b class="mono">' + today + '<small>/' + p.goal + '</small></b><span class="muted">lances hoje</span><div class="chips bib-goal">' + [15, 30, 60].map(g => '<button type="button" class="chip" data-bib="goal:' + g + '" aria-pressed="' + (p.goal === g) + '">' + g + '</button>').join('') + '</div></div></div>' +
    '<div class="bib-kpis"><div><span class="bib-fl' + (sk ? ' on' : '') + '">' + BFLAME + '</span><b class="mono">' + sk + '</b><span class="muted">' + (sk === 1 ? 'dia seguido' : 'dias seguidos') + '</span></div><div><b class="mono">' + learned + '</b><span class="muted">aprendidos</span></div><div><b class="mono">' + mastered + '</b><span class="muted">dominados</span></div></div>' +
    '</section>';
  if (BIB.conv) h += bibConvCard();
  if (last) {
    const nx = bnextItems(last, 1)[0];
    if (nx) h += '<section class="card pad bib-cont"><div class="bib-cont-in">' + bcover(last) + '<div class="stack" style="gap:3px;min-width:0"><span class="label">Continuar</span><b>' + esc(last.title) + '</b><span class="muted bib-sub">' + esc(nx.ch.title) + ' · ' + esc(nx.it.title || BKIND[nx.it.k]) + '</span></div></div><button class="btn primary" type="button" data-bib="learn:' + esc(last.id) + '">Continuar</button></section>';
  }
  h += '<h2 class="st-group">Seus cursos</h2><div class="bib-grid">' + user.map(bibCard).join('') +
    '<button type="button" class="card bib-card bib-add" data-bib="add"><span class="bib-plus">+</span><span class="bib-cb"><b>Novo curso</b><span class="muted bib-sub">Estudo do Lichess, PGN, livro em PDF ou repertório</span></span></button></div>';
  h += '<h2 class="st-group">Livros</h2><div class="bib-grid">' + books.map(bibCard).join('') + '</div>';
  const hid = Object.keys(p.hide).filter(k => p.hide[k] && bibLoadBuiltin().some(c => c.id === k));
  if (hid.length) h += '<p class="muted" style="font-size:13px">' + hid.length + ' ' + (hid.length === 1 ? 'livro oculto' : 'livros ocultos') + '. <button class="lnk" type="button" data-bib="unhide">Mostrar de novo</button></p>';
  $('#bibMain').innerHTML = h;
}
// próximos itens a aprender, na ordem do curso
function bnextItems(c, n) {
  const out = [];
  for (const ch of c.ch) for (const it of ch.it) { if (!bisDone(c.id, it)) { out.push({ it, ch }); if (out.length >= n) return out; } }
  return out;
}
function bibCoursePage() {
  const B = S.bib, c = bibCourse(B.cid), st = bstats(c), p = bprog();
  p.last = { cid: c.id, t: bnow() }; bsave();
  const nx = bnextItems(c, 5);
  if (!B.open || B.openFor !== c.id) { B.open = {}; B.openFor = c.id; const f = c.ch.find(ch => ch.it.some(it => !bisDone(c.id, it))) || c.ch[0]; if (f) B.open[f.id] = 1; }
  const conv = c.pdf && c.pdf.next <= c.pdf.to;
  let h = '<div><button class="btn small" type="button" data-bib="home">← Biblioteca</button></div>';
  h += '<section class="card bib-chead">' + bcover(c, true) + '<div class="stack bib-chead-t" style="gap:8px;min-width:0"><span class="label">' + esc(c.sub || BSRC[c.src] || '') + '</span><h1 class="h-page">' + esc(c.title) + '</h1>' + (c.blurb ? '<p class="muted">' + esc(c.blurb) + '</p>' : '') +
    '<div class="bib-cst"><span><b class="mono">' + st.done + '</b>/' + st.n + ' concluídos</span><span><b class="mono">' + Math.round(st.mastery * 100) + '%</b> de domínio</span>' + (c.side ? '<span>Treina de <b>' + SIDE[c.side] + '</b></span>' : '') + '</div>' +
    '<div class="bar bib-cbar"><i style="width:' + Math.round(st.pct * 100) + '%;background:var(--accent)"></i></div>' +
    '<div class="vxacts">' + (nx.length ? '<button class="btn primary" type="button" data-bib="learn:' + esc(c.id) + '">' + (st.done ? 'Aprender os próximos ' + nx.length : 'Começar') + '</button>' : '') +
    (st.due ? '<button class="btn' + (nx.length ? '' : ' primary') + '" type="button" data-bib="review:' + esc(c.id) + '">Revisar ' + st.due + '</button>' : '') +
    (st.tr && Object.keys(p.c).some(k => k.startsWith(c.id + '|')) ? '<button class="btn" type="button" data-bib="drill:' + esc(c.id) + '">Treino extra</button>' : '') + '</div>' +
    (conv ? '<div class="callout bib-convnote"><b>Conversão do PDF em andamento</b><span class="muted">Páginas ' + c.pdf.from + ' a ' + (c.pdf.next - 1) + ' prontas de ' + c.pdf.from + ' a ' + c.pdf.to + '.</span>' + (BIB.conv && BIB.conv.cid === c.id ? '' : '<button class="btn small" type="button" data-bib="resume:' + esc(c.id) + '">Continuar a conversão</button>') + '</div>' : '') +
    '</div></section>';
  if (BIB.conv && BIB.conv.cid === c.id) h += bibConvCard();
  for (const ch of c.ch) {
    const done = ch.it.filter(it => bisDone(c.id, it)).length, op = !!B.open[ch.id];
    h += '<section class="card bib-chap' + (op ? ' open' : '') + '"><button type="button" class="bib-chh" data-bib="tog:' + esc(ch.id) + '" aria-expanded="' + op + '"><span class="bib-chn mono">' + (done === ch.it.length && ch.it.length ? '✓' : (c.ch.indexOf(ch) + 1)) + '</span><span class="stack" style="gap:2px;min-width:0;flex:1"><b>' + esc(ch.title) + '</b><span class="muted bib-sub">' + done + ' de ' + ch.it.length + '</span></span><span class="prog"><i style="width:' + (ch.it.length ? Math.round(done / ch.it.length * 100) : 0) + '%"></i></span><svg class="bib-chev" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></button>';
    if (op) {
      h += '<div class="bib-items">' + (ch.lead ? '<p class="muted bib-lead">' + esc(ch.lead) + '</p>' : '');
      for (const it of ch.it) {
        const cd = bcardGet(c.id, it.id), rd = p.r[bcard(c.id, it.id)];
        const stt = cd ? (cd.d <= bnow() ? '<span class="bib-st due">revisar</span>' : '<span class="bib-st lv" title="Nível ' + cd.l + ' de ' + BMAXL + ', próxima revisão ' + bwhen(cd.d) + '">' + '<i style="--l:' + cd.l + '"></i>' + bwhen(cd.d).replace('em ', '') + '</span>') : rd ? '<span class="bib-st ok">✓</span>' : '<span class="bib-st new">novo</span>';
        h += '<button type="button" class="bib-it" data-bib="it:' + esc(it.id) + '"><span class="bib-ik k-' + it.k + '">' + bic(it.k) + '</span><span class="bib-itt"><span>' + esc(it.title || BKIND[it.k]) + '</span><small class="muted">' + esc(BKIND[it.k]) + (it.k === 'l' ? ' · ' + it.mv.length + ' lances' + (it.side && it.ask !== 'none' ? ' · treina ' + SIDE[it.side] : '') : '') + '</small></span>' + stt + '</button>';
      }
      h += '</div>';
    }
    h += '</section>';
  }
  if (!c.ch.length) h += '<p class="muted">Este curso ainda está vazio.</p>';
  h += '<div class="bib-cfoot">' + (c.builtin ? '<button class="lnk" type="button" data-bib="hide:' + esc(c.id) + '">Ocultar este livro</button>' :
    '<button class="lnk" type="button" data-bib="ren:' + esc(c.id) + '">Renomear</button><button class="lnk" type="button" data-bib="side:' + esc(c.id) + '">Lado do treino</button><button class="lnk" type="button" data-bib="exp:' + esc(c.id) + '">Exportar PGN</button><button class="lnk danger" type="button" data-bib="del:' + esc(c.id) + '">Excluir curso</button>') +
    '<button class="lnk" type="button" data-bib="reset:' + esc(c.id) + '">Zerar progresso</button></div>';
  $('#bibMain').innerHTML = h;
}
function bibAddPage() {
  const B = S.bib, k = B.add || '';
  let h = '<div><button class="btn small" type="button" data-bib="' + (k ? 'add' : 'home') + '">← ' + (k ? 'Voltar' : 'Biblioteca') + '</button></div>';
  if (!k) {
    h += '<div class="stack" style="gap:4px"><h1 class="h-page">Novo curso</h1><p class="sub">Tudo vira um curso com leitura, linhas para aprender e revisão espaçada</p></div><div class="bib-addgrid">' +
      [['lichess', 'Estudo do Lichess', 'Cole o link de um estudo. Capítulos, variantes, comentários e setas viram lições.', 'l'],
        ['pdf', 'Livro em PDF', 'O Claude lê o livro e monta o curso: textos, partidas, variantes e exercícios.', 'c'],
        ['pgn', 'PGN ou repertório', 'Cole ou envie um PGN. Cada variante vira uma linha para treinar.', 'l'],
        ['rep', 'Montar no tabuleiro', 'Jogue os lances do seu repertório e treine depois, como no Chess Tempo.', 's'],
        ['jogos', 'Das suas partidas', 'As linhas que você mais joga nas aberturas, para revisar e firmar.', 'p']]
        .map(([id, t, d, ic]) => '<button type="button" class="card bib-addt" data-bib="addk:' + id + '"><span class="bib-ik k-' + ic + '">' + bic(ic) + '</span><b>' + t + '</b><span class="muted">' + d + '</span></button>').join('') + '</div>';
  } else if (k === 'lichess') {
    h += '<section class="card pad stack bib-form" style="gap:14px"><h1 class="h-card" style="font-size:20px">Estudo do Lichess</h1>' +
      '<div class="field"><label for="bibLiUrl">Link do estudo (ou de um capítulo)</label><input id="bibLiUrl" spellcheck="false" placeholder="https://lichess.org/study/…" inputmode="url"></div>' +
      '<div class="field"><span class="label">Treinar de</span><div class="seg" role="group" id="bibLiSide">' + bsideSeg('auto') + '</div></div>' +
      '<button class="btn primary" type="button" data-bib="li:go">Importar</button><p class="status" id="bibLiSt" role="status"></p>' +
      '<details class="bib-det"><summary>Ou cole o PGN do estudo</summary><p class="muted" style="font-size:13px">No estudo: ☰ (Compartilhar e exportar) → “PGN do estudo” ou “Copiar PGN”.</p><div class="field"><textarea id="bibLiPgn" spellcheck="false" placeholder="[Event &quot;…&quot;]"></textarea></div><button class="btn" type="button" data-bib="li:paste">Importar o PGN colado</button></details></section>';
  } else if (k === 'pgn') {
    h += '<section class="card pad stack bib-form" style="gap:14px"><h1 class="h-card" style="font-size:20px">PGN ou repertório</h1>' +
      '<div class="field"><label for="bibPgTitle">Nome do curso</label><input id="bibPgTitle" placeholder="Meu repertório de pretas"></div>' +
      '<div class="field"><span class="label">Treinar de</span><div class="seg" role="group" id="bibPgSide">' + bsideSeg('auto') + '</div></div>' +
      '<div class="field"><label for="bibPgTxt">PGN (uma ou mais partidas, com variantes e comentários)</label><textarea id="bibPgTxt" spellcheck="false"></textarea></div>' +
      '<div class="field"><label for="bibPgFile">Ou envie um arquivo .pgn</label><input id="bibPgFile" type="file" accept=".pgn,.txt,text/plain"></div>' +
      '<button class="btn primary" type="button" data-bib="pg:go">Criar curso</button><p class="status" id="bibPgSt" role="status"></p></section>';
  } else if (k === 'pdf') {
    h += bibPdfForm();
  } else if (k === 'jogos') {
    h += '<section class="card pad stack bib-form" style="gap:14px"><h1 class="h-card" style="font-size:20px">Repertório das suas partidas</h1><p class="muted">Pega as linhas que você mais repete nos primeiros lances, com o seu aproveitamento em cada uma, e transforma num curso para revisar. Dá para editar depois no tabuleiro.</p>' +
      '<div class="field"><span class="label">Cor</span><div class="seg" role="group" id="bibJgSide"><button type="button" data-side="w" aria-pressed="true">Brancas</button><button type="button" data-side="b" aria-pressed="false">Pretas</button></div></div>' +
      '<div class="field"><span class="label">Profundidade</span><div class="seg" role="group" id="bibJgDep">' + [8, 12, 16].map((d, i) => '<button type="button" data-dep="' + d + '" aria-pressed="' + (i === 1) + '">' + (d / 2) + ' lances</button>').join('') + '</div></div>' +
      '<button class="btn primary" type="button" data-bib="jg:go">Criar curso</button><p class="status" id="bibJgSt" role="status"></p></section>';
  } else if (k === 'rep') { bibRepStart(); return; }
  $('#bibMain').innerHTML = h;
}
const bsideSeg = d => [['auto', 'Automático'], ['w', 'Brancas'], ['b', 'Pretas'], ['', 'Só ler']].map(([v, t]) => '<button type="button" data-side="' + v + '" aria-pressed="' + (v === d) + '">' + t + '</button>').join('');
const bsegVal = (id, attr) => { const b = document.querySelector('#' + id + ' [aria-pressed="true"]'); return b ? b.dataset[attr || 'side'] : null; };
// diálogo dentro da página (o quadro do app não permite alert, confirm e prompt)
function bibDialog(o) {
  return new Promise(res => {
    const old = document.getElementById('bibDlg'); if (old) old.remove();
    const el = document.createElement('div'); el.className = 'modal'; el.id = 'bibDlg'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', o.title);
    el.innerHTML = '<div class="sheet"><h2 class="h-card" style="font-size:19px">' + esc(o.title) + '</h2>' + (o.text ? '<p class="muted">' + esc(o.text) + '</p>' : '') +
      (o.input != null ? '<div class="field"><input id="bibDlgIn" maxlength="120" value="' + esc(o.input) + '"></div>' : '') +
      (o.choices ? '<div class="stack" style="gap:8px">' + o.choices.map((c, i) => '<button class="btn' + (c[2] ? ' primary' : '') + '" type="button" data-dlg="' + i + '">' + esc(c[1]) + '</button>').join('') + '</div>' : '') +
      '<div class="vxacts">' + (o.choices ? '' : '<button class="btn ' + (o.danger ? 'bib-danger' : 'primary') + '" type="button" data-dlg="ok">' + esc(o.ok || 'OK') + '</button>') + '<button class="btn" type="button" data-dlg="no">Cancelar</button></div></div>';
    document.body.appendChild(el);
    const inp = el.querySelector('#bibDlgIn');
    const done = v => { el.remove(); document.removeEventListener('keydown', kd, true); res(v); };
    const kd = e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } else if (e.key === 'Enter' && inp && document.activeElement === inp) { e.preventDefault(); done(inp.value); } };
    document.addEventListener('keydown', kd, true);
    el.addEventListener('click', e => { if (e.target === el) return done(null); const b = e.target.closest('[data-dlg]'); if (!b) return; const d = b.dataset.dlg; if (d === 'no') return done(null); if (d === 'ok') return done(inp ? inp.value : true); done(o.choices[+d][0]); });
    setTimeout(() => { if (inp) { inp.focus(); inp.select(); } else { const b = el.querySelector('[data-dlg]'); if (b) b.focus(); } }, 30);
  });
}
function bibAction(a, el) {
  const B = S.bib = S.bib || { pg: 'home', open: {} };
  const [cmd, ...rest] = a.split(':'); const arg = rest.join(':');
  if (cmd === 'home') return bibGo('home');
  if (cmd === 'add') return bibGo('add', { add: '' });
  if (cmd === 'addk') return bibGo('add', { add: arg, resume: null, pdfPick: null });
  if (cmd === 'open') return bibGo('course', { cid: arg });
  if (cmd === 'tog') { B.open[arg] = !B.open[arg]; return bibCoursePage(); }
  if (cmd === 'goal') { bprog().goal = +arg; bsave(); return bibHome(); }
  if (cmd === 'unhide') { bprog().hide = {}; bsave(); return bibHome(); }
  if (cmd === 'hide') { bprog().hide[arg] = 1; bsave(); toast('Livro oculto. Dá para mostrar de novo no fim da Biblioteca.'); return bibGo('home'); }
  if (cmd === 'learn') { const c = bibCourse(arg); if (!c) return; const q = bnextItems(c, 5).map(x => ({ cid: c.id, iid: x.it.id })); if (!q.length) { toast('Tudo aprendido neste curso'); return; } return bpStart('learn', q); }
  if (cmd === 'review') { const q = bdue(arg || null).slice(0, 25).map(x => ({ cid: x.cid, iid: x.iid })); if (!q.length) { toast('Nada para revisar agora'); return; } return bpStart('review', q); }
  if (cmd === 'drill') {
    // treino extra: os aprendidos de nível mais baixo, mesmo antes da hora
    const p = bprog(), L = [];
    for (const k in p.c) { const i = k.indexOf('|'), cid = k.slice(0, i); if (arg && cid !== arg) continue; const c = bibCourse(cid); if (c && bibItem(c, k.slice(i + 1))) L.push({ cid, iid: k.slice(i + 1), l: p.c[k].l, r: Math.random() }); }
    L.sort((x, y) => (x.l - y.l) || (x.r - y.r)); if (!L.length) { toast('Aprenda algumas linhas primeiro'); return; }
    return bpStart('review', L.slice(0, 12).map(x => ({ cid: x.cid, iid: x.iid, extra: 1 })));
  }
  if (cmd === 'it') { const c = bibCourse(B.cid); if (!c) return; return bpStart('study', [{ cid: c.id, iid: arg }]); }
  if (cmd === 'ren') { const c = bibCourse(arg); bibDialog({ title: 'Renomear o curso', input: c.title, ok: 'Salvar' }).then(t => { if (t && t.trim()) { c.title = t.trim().slice(0, 120); bibSaveUser(c); bibCoursePage(); } }); return; }
  if (cmd === 'side') {
    const c = bibCourse(arg);
    bibDialog({ title: 'Treinar as linhas de qual lado?', text: 'Vale para todas as linhas deste curso. O progresso continua.', choices: [['w', 'Brancas', c.side === 'w'], ['b', 'Pretas', c.side === 'b'], ['', 'Nenhum (só ler)', !c.side]] }).then(v => {
      if (v == null) return;
      c.side = v; for (const ch of c.ch) for (const it of ch.it) if (it.k === 'l' && it.ask !== 'key') { it.side = v; it.ask = v ? 'all' : 'none'; }
      bibSaveUser(c); BFI.delete(c); bibCoursePage();
    });
    return;
  }
  if (cmd === 'del') { const c = bibCourse(arg); if (!c) return; bibDialog({ title: 'Excluir “' + c.title + '”?', text: 'O curso e o progresso dele somem deste aparelho e da sua conta. Não dá para desfazer.', ok: 'Excluir', danger: 1 }).then(ok => { if (!ok) return; if (BIB.conv && BIB.conv.cid === arg) bibConvStop(); bibDeleteCourse(arg).then(() => { toast('Curso excluído'); bibGo('home'); }); }); return; }
  if (cmd === 'reset') { const c = bibCourse(arg); if (!c) return; bibDialog({ title: 'Zerar o progresso?', text: 'Tudo em “' + c.title + '” volta a ser novo, e sai da revisão.', ok: 'Zerar', danger: 1 }).then(ok => { if (!ok) return; const p = bprog(); for (const k of Object.keys(p.c)) if (k.startsWith(arg + '|')) delete p.c[k]; for (const k of Object.keys(p.r)) if (k.startsWith(arg + '|')) delete p.r[k]; bsave(); bibCoursePage(); }); return; }
  if (cmd === 'exp') return bibExport(arg);
  if (cmd === 'li') return arg === 'paste' ? bibLichessPaste() : bibLichessGo();
  if (cmd === 'pg') return bibPgnGo();
  if (cmd === 'jg') return bibGamesGo();
  if (cmd === 'pdf') return bibPdfAction(arg, el);
  if (cmd === 'resume') { bibGo('add', { add: 'pdf', resume: arg, pdfPick: null }); return; }
  if (cmd === 'conv') { if (arg === 'stop') bibConvStop(); else if (arg === 'open' && BIB.conv) bibGo('course', { cid: BIB.conv.cid }); return; }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-bib]'); if (!b || !b.closest('#v-biblioteca')) return;
  e.preventDefault(); bibAction(b.dataset.bib, b);
});
document.addEventListener('click', e => {
  const s = e.target.closest('#v-biblioteca .seg [data-side], #v-biblioteca .seg [data-dep], #v-biblioteca .seg [data-opt]'); if (!s) return;
  for (const x of s.parentElement.children) x.setAttribute('aria-pressed', String(x === s));
});
document.addEventListener('change', e => {
  if (e.target.id === 'bibPgFile') { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { $('#bibPgTxt').value = String(r.result || ''); if (!$('#bibPgTitle').value) $('#bibPgTitle').value = f.name.replace(/\.(pgn|txt)$/i, ''); }; r.readAsText(f); }
  if (e.target.id === 'bibPdfFile') bibPdfPicked(e.target.files && e.target.files[0]);
});
function bibExport(cid) {
  const c = bibCourse(cid); if (!c) return; const out = [];
  for (const ch of c.ch) for (const it of ch.it) {
    if (it.k !== 'l' && it.k !== 'p') continue;
    const fen = it.k === 'p' ? it.fen : (it.fen || BSTART); const mv = it.k === 'p' ? (it.pre ? [{ s: it.pre }] : []).concat(it.sol) : it.mv;
    let cc; try { cc = new Chess(fen); } catch (e) { continue; }
    let t = ''; mv.forEach((m, i) => { const w = cc.turn() === 'w'; if (w) t += cc.moveNumber() + '. '; else if (i === 0) t += cc.moveNumber() + '... '; try { cc.move(m.s); } catch (e) { return; } t += m.s + ' ' + (m.c ? '{' + m.c.replace(/[{}]/g, '') + '} ' : ''); });
    const hd = ['[Event "' + (c.title + ' — ' + ch.title).replace(/"/g, "'") + '"]', '[Site "Peão Passado"]', '[White "?"]', '[Black "?"]', '[Result "*"]', '[Annotator "' + (it.title || '').replace(/"/g, "'") + '"]'];
    if (fen !== BSTART) hd.push('[SetUp "1"]', '[FEN "' + fen + '"]');
    out.push(hd.join('\n') + '\n\n' + t.trim() + ' *');
  }
  const txt = out.join('\n\n') + '\n', name = c.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.pgn';
  (async () => {
    try { const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; if (dl) { await dl.save({ filename: name, data: txt }); toast('PGN salvo'); return; } } catch (e) { /* tenta o download comum */ }
    try { await navigator.clipboard.writeText(txt); toast('PGN copiado para a área de transferência'); } catch (e) { toast('Não deu para salvar o arquivo aqui'); }
  })();
}

/* ---------- Biblioteca: o leitor/treinador (aprender, revisar, estudar) ---------- */
const BP = { s: null, board: null, tok: 0 };
function bpB() {
  if (!BP.board) {
    BP.board = new Board($('#bpBoard'));
    BP.board.el.addEventListener('pointerdown', e => { const r = BP.s && BP.s.run; if (r && r.tap) r.tap(e); });
  }
  return BP.board;
}
function bpLater(fn, ms) { const t = BP.tok; setTimeout(() => { if (BP.tok === t && BP.s) fn(); }, ms); }
const bfenKey = f => f.split(' ').slice(0, 4).join(' ');
const barrows = (ar, extra) => (ar || []).map(a => ({ from: a[0], to: a[1], cls: 'a-' + (a[2] || 'g') })).concat(extra || []);
const bhl = mk => (mk || []).map(m => [m[0], m[1] || 'y']);
function bcheckSq(fen) { try { const c = new Chess(fen); if (!c.inCheck()) return null; const t = c.turn(); for (const row of c.board()) for (const p of row) if (p && p.type === 'k' && p.color === t) return p.square; } catch (e) { /* sem xeque */ } return null; }
function bprep(fen0, mv) {
  let c; try { c = new Chess(fen0 || BSTART); } catch (e) { c = new Chess(); }
  const fens = [c.fen()], mvs = [];
  for (const m of mv || []) { let r = null; try { r = c.move(m.s); } catch (e) { r = null; } if (!r) break; mvs.push(Object.assign({}, m, { s: r.san, from: r.from, to: r.to, promo: r.promotion, col: r.color })); fens.push(c.fen()); }
  return { fens, mvs };
}
// tenta o lance do usuário; se a linha espera uma promoção diferente de dama, usa a da linha
function btry(fen, from, to, want) {
  let c; try { c = new Chess(fen); } catch (e) { return null; }
  let promo = 'q'; if (want && want.from === from && want.to === to && want.promo) promo = want.promo;
  let m = null; try { m = c.move({ from, to, promotion: promo }); } catch (e) { m = null; }
  return m ? { san: m.san, fen: c.fen(), from: m.from, to: m.to, promo: m.promotion, mate: c.isCheckmate(), c } : null;
}
// sequência compacta: 1. e4 e5 2. ♘f3
function bline(P, a, b) {
  let t = '';
  for (let i = a; i < b && i < P.mvs.length; i++) { const f = P.fens[i].split(' '); if (f[1] === 'w') t += (t ? ' ' : '') + f[5] + '. ' + fig(P.mvs[i].s); else t += (i === a ? f[5] + '... ' : ' ') + fig(P.mvs[i].s); }
  return t;
}
const bopName = g => String(opName(g) || 'Abertura').replace(/\s+\d+\.*$/, '').trim();
function blabel(fen, san) { const p = fen.split(' '); return p[1] === 'w' ? p[5] + '. ' + fig(san) : p[5] + '... ' + fig(san); }
const BFI = new WeakMap();
function bibFenIdx(c) {
  let m = BFI.get(c); if (m && m.t === c.t) return m.m;
  const map = new Map();
  for (const ch of c.ch) for (const it of ch.it) if (it.k === 'l') { const P = bprep(it.fen, it.mv); P.mvs.forEach((x, i) => { const k = bfenKey(P.fens[i]); let s = map.get(k); if (!s) map.set(k, s = new Set()); s.add(x.s); }); }
  BFI.set(c, { t: c.t, m: map }); return map;
}
function bpShow(fen, o) {
  o = o || {}; const B = bpB();
  // mesma posição: não redesenha (não corta a animação do lance anterior)
  if (B.fen !== fen) B.setPosition(fen, !!o.anim);
  const mk = { last: o.last || null, check: bcheckSq(fen), hl: bhl(o.mk) };
  if (o.marks) Object.assign(mk, o.marks);
  B.setMarks(mk); B.setArrows(barrows(o.ar, o.extra));
  return mk;
}
function bpLive(fen, color, marks, onMove) { bpB().setLive({ color, dests: () => destsOf(fen), marks, onMove }); }
function bpPanel(o) {
  const s = BP.s, it = s && s.it;
  let h = '<div class="bp-hd"><span class="label">' + esc(o.top || ((BKIND[it && it.k] || '') + (s && s.ch ? ' · ' + s.ch.title : ''))) + '</span>' + (o.title !== false ? '<h2 class="h-card">' + esc(o.title || (it && it.title) || '') + '</h2>' : '') + '</div>';
  if (o.body) h += '<div class="bp-body">' + o.body + '</div>';
  if (o.fb) h += '<div class="fb ' + (o.fb.c || '') + ' bp-fb">' + o.fb.h + '</div>';
  if (o.btns && o.btns.length) h += '<div class="vxacts bp-acts">' + o.btns.map(b => '<button class="btn' + (b[2] ? ' primary' : '') + '" type="button" data-bp="' + b[1] + '"' + (b[3] ? ' disabled' : '') + '>' + b[0] + '</button>').join('') + '</div>';
  $('#bpPanel').innerHTML = h;
}
function bpCtrls(list) {
  const flip = '<button class="btn" type="button" data-bp="flip" aria-label="Virar tabuleiro"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8a6 6 0 0 1 11-2l1 2M16 12a6 6 0 0 1-11 2l-1-2M16 4v4h-4M4 16v-4h4"></path></svg></button>';
  const IC = { first: '<path d="M5 4v12M15 4l-7 6 7 6"/>', prev: '<path d="M13 4l-7 6 7 6"/>', next: '<path d="M7 4l7 6-7 6"/>', last: '<path d="M15 4v12M5 4l7 6-7 6"/>' };
  $('#bpCtrls').innerHTML = (list || []).map(k => '<button class="btn' + (k === 'next' ? ' primary w' : k === 'prev' ? ' w' : '') + '" type="button" data-bp="nav:' + k + '" aria-label="' + ({ first: 'Início', prev: 'Anterior', next: 'Próximo', last: 'Fim' })[k] + '"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[k] + '</svg></button>').join('') + flip;
}
function bpMoves(P, cur, upto, clickable) {
  const box = $('#bpMoves'); if (!P) { box.hidden = true; return; }
  box.hidden = false; let h = '', row = '';
  const n = upto == null ? P.mvs.length : Math.min(upto, P.mvs.length);
  for (let i = 0; i < n; i++) {
    const f = P.fens[i].split(' '), w = f[1] === 'w', m = P.mvs[i];
    const cell = '<button type="button" class="mv' + (m.c ? ' cm' : '') + (m.key ? ' key' : '') + '"' + (clickable ? ' data-bp="go:' + (i + 1) + '"' : ' tabindex="-1"') + (cur === i + 1 ? ' aria-current="true"' : '') + '>' + esc(fig(m.s)) + (m.g ? '<b>' + esc(m.g) + '</b>' : '') + '</button>';
    if (w) { if (row) h += row + '<span></span></div>'; row = '<div class="mrow"><span class="n">' + f[5] + '.</span>' + cell; }
    else { if (!row) row = '<div class="mrow"><span class="n">' + f[5] + '.</span><span class="mv muted">…</span>'; h += row + cell + '</div>'; row = ''; }
  }
  if (row) h += row + '<span></span></div>';
  box.innerHTML = h || '<p class="muted" style="padding:10px 14px;font-size:13px">Os lances aparecem aqui.</p>';
  const a = box.querySelector('[aria-current="true"]'); if (a) box.scrollTop = Math.max(0, a.offsetTop - box.clientHeight / 2);
}
const BMODE = { learn: 'Aprender', review: 'Revisão', study: 'Estudo', build: 'Repertório' };
function bpHead() {
  const s = BP.s;
  $('#bpHead').innerHTML = '<div class="stack" style="gap:3px;min-width:0"><span class="label">' + esc(BMODE[s.mode] + (s.c ? ' · ' + s.c.title : '')) + '</span><span class="who">' + esc((s.ch && s.ch.title) || (s.c && s.c.title) || '') + '</span></div><div style="display:flex;gap:8px;align-items:center">' + (s.q.length > 1 ? '<span class="tag plain">' + Math.min(s.i + 1, s.q.length) + '/' + s.q.length + '</span>' : '') + '<button class="btn small" type="button" data-bp="exit">Sair</button></div>';
  $('#bpProg').firstElementChild.style.width = (s.q.length ? Math.round(s.i / s.q.length * 100) : 0) + '%';
}
function bpStart(mode, q) {
  const B = S.bib = S.bib || { open: {} };
  if (B.pg !== 'play') B.from = B.pg;
  BP.s = { mode, q, i: 0, res: [], ok: 0, err: 0 };
  B.pg = 'play'; bibRender(); window.scrollTo(0, 0); bpB(); bpLoad();
}
function bpLoad() {
  BP.tok++; const s = BP.s; if (!s) return;
  bpB().setLive(null);
  if (s.i >= s.q.length) return bpSummary();
  const e = s.q[s.i], c = bibCourse(e.cid), f = c && bibItem(c, e.iid);
  if (!f) { s.i++; return bpLoad(); }
  s.c = c; s.it = f.it; s.ch = f.ch; s.extra = !!e.extra;
  bpHead(); bpMoves(null); bpCtrls([]);
  s.run = (BRUN[f.it.k] || BRUN.c)(s); s.run.start();
}
function bpDone(r) {
  const s = BP.s, it = s.it, c = s.c; r = r || {};
  if (r.ok) s.ok += r.ok; if (r.err) s.err += r.err;
  let card = null;
  if (BTRAIN(it) && !r.skip) {
    if (s.mode === 'learn') card = bcardGet(c.id, it.id) ? bgrade(c.id, it.id, r.clean !== false) : bgrade(c.id, it.id, true, true);
    else if (s.mode === 'review') { if (s.extra) { if (r.clean === false) card = bgrade(c.id, it.id, false); } else card = bgrade(c.id, it.id, r.clean !== false); }
    else if (s.mode === 'study' && r.trained) card = bcardGet(c.id, it.id) ? bgrade(c.id, it.id, r.clean !== false) : bgrade(c.id, it.id, true, true);
  } else if (!r.skip || it.k === 'x') bread(c.id, it.id);
  s.res.push({ iid: it.id, cid: c.id, k: it.k, clean: r.clean !== false, title: it.title, tr: BTRAIN(it) });
  if (!BTRAIN(it)) bdayAdd(1);
  return card;
}
const bcardNote = cd => cd ? (cd.l <= 1 ? 'Volta para revisão em 4 horas.' : 'Nível ' + cd.l + ' de ' + BMAXL + ' · próxima revisão ' + bwhen(cd.d) + '.') : '';
function bpNext() {
  const s = BP.s; if (!s) return;
  // no estudo, segue para o próximo item do curso, como num livro
  if (s.mode === 'study' && s.i + 1 >= s.q.length && s.c) {
    const L = bibFlat(s.c), j = L.findIndex(x => x.it === s.it);
    if (j >= 0 && j + 1 < L.length) s.q.push({ cid: s.c.id, iid: L[j + 1].it.id });
  }
  s.i++; bpLoad();
}
function bpStop() { BP.tok++; BP.s = null; if (BP.board) { BP.board.setLive(null); BP.board.setArrows([]); } }
function bpExit() {
  const s = BP.s, B = S.bib; const cid = (s && s.c && s.c.id) || B.cid;
  bpStop(); const to = B.from === 'course' || B.from === 'add' ? B.from : 'home';
  bibGo(to === 'add' ? 'add' : to, to === 'course' ? { cid: B.cid || cid } : {});
}
function bpSummary() {
  const s = BP.s; BP.tok++; bpB().setLive(null); bpB().setArrows([]);
  $('#bpHead').innerHTML = '<div class="stack" style="gap:3px;min-width:0"><span class="label">' + esc(BMODE[s.mode]) + '</span><span class="who">Sessão concluída</span></div><button class="btn small" type="button" data-bp="exit">Sair</button>';
  $('#bpProg').firstElementChild.style.width = '100%'; bpMoves(null); bpCtrls([]);
  const tr = s.res.filter(r => r.tr), bad = tr.filter(r => !r.clean), tot = s.ok + s.err, acc = tot ? Math.round(s.ok / tot * 100) : null;
  const perfect = tr.length && !bad.length;
  const p = bprog(), today = p.day[bday()] || 0;
  let body = '<div class="bp-sum"><div><b class="mono">' + s.res.length + '</b><span class="muted">' + (s.res.length === 1 ? 'item' : 'itens') + '</span></div>' + (acc != null ? '<div><b class="mono">' + acc + '%</b><span class="muted">precisão</span></div>' : '') + '<div><b class="mono">' + today + '<small>/' + p.goal + '</small></b><span class="muted">meta de hoje</span></div><div><b class="mono">' + bstreak() + '</b><span class="muted">dias seguidos</span></div></div>';
  if (s.mode === 'review' && tr.length) body += '<p>' + (perfect ? 'Revisão perfeita: tudo subiu de nível.' : bad.length + ' de ' + tr.length + (tr.length === 1 ? ' item voltou' : ' itens voltaram') + ' para o nível 1 e ' + (bad.length === 1 ? 'aparece' : 'aparecem') + ' de novo em 4 horas.') + '</p>';
  if (s.mode === 'learn') body += '<p>As linhas e exercícios que você aprendeu entram na revisão espaçada: voltam em 4 horas, depois em 1 dia, 3 dias, 1 semana…</p>';
  body += '<ul class="bp-res">' + s.res.map(r => '<li class="' + (r.tr ? (r.clean ? 'ok' : 'no') : '') + '">' + (r.tr ? (r.clean ? '✓' : '✗') : '·') + ' ' + esc(r.title || BKIND[r.k]) + '</li>').join('') + '</ul>';
  const btns = [];
  if (bad.length) btns.push(['Refazer os que errei', 'again']);
  const c = s.c && bibCourse(s.c.id);
  if (s.mode === 'learn' && c && bnextItems(c, 1).length) btns.push(['Aprender mais 5', 'more', !bad.length]);
  const due = bdue().length; if (s.mode !== 'review' && due) btns.push(['Revisar ' + due, 'rev']);
  btns.push(['Voltar', 'exit', !btns.some(b => b[2])]);
  BP.s.run = { act(a) { if (a === 'again') bpStart('review', bad.map(r => ({ cid: r.cid, iid: r.iid, extra: 1 }))); else if (a === 'more') bibAction('learn:' + c.id); else if (a === 'rev') bibAction('review'); }, key(k) { if (k === 'next') bpExit(); } };
  bpPanel({ top: 'Resumo', title: perfect ? 'Perfeito!' : s.mode === 'learn' ? 'Bom estudo!' : 'Sessão concluída', body, btns });
  if (perfect) try { sparkle($('#bpPanel')); } catch (e) { /* sem brilho */ }
  try { haptic('ok'); } catch (e) { /* sem vibração */ }
  progressChanged();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-bp]'); if (!b || !b.closest('#bibPlay')) return;
  e.preventDefault(); const a = b.dataset.bp, s = BP.s; if (!s) { if (a === 'exit') bpExit(); return; }
  if (a === 'exit') return bpExit();
  if (a === 'flip') { const B = bpB(); B.setFlip(!B.flip); return; }
  if (a === 'skip') { bpDone({ skip: 1 }); return bpNext(); }
  if (s.run && s.run.act) s.run.act(a);
});
document.addEventListener('keydown', e => {
  if (S.view !== 'biblioteca' || !S.bib || S.bib.pg !== 'play' || !BP.s || e.target.closest('input,textarea,select')) return;
  const r = BP.s.run; if (!r) return;
  if ((e.key === ' ' || e.key === 'Enter') && e.target.closest('button,a')) return;
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') { if (r.key) { e.preventDefault(); r.key('next'); } }
  else if (e.key === 'ArrowLeft') { if (r.key) { e.preventDefault(); r.key('prev'); } }
  else if (e.key === 'Home') { if (r.key) { e.preventDefault(); r.key('first'); } }
  else if (e.key === 'End') { if (r.key) { e.preventDefault(); r.key('last'); } }
  else if (e.key === 'f' || e.key === 'F') { const B = bpB(); B.setFlip(!B.flip); }
  else if (e.key === 'Escape') bpExit();
});
const BRUN = {};
/* ---------- linha (variante de abertura, partida comentada) ---------- */
BRUN.l = s => {
  const it = s.it, mode = s.mode, P = bprep(it.fen || BSTART, it.mv), n = P.mvs.length;
  const side = it.side && it.ask !== 'none' ? it.side : '';
  const keyLine = it.ask === 'key';
  const st = { k: 0, err: 0, ok: 0, miss: 0, hold: false, phase: 'intro', ex: null, eng: false, ev: null, kq: 0 };
  const asked = i => mode !== 'study' && !!side && P.mvs[i] && P.mvs[i].col === side && (keyLine ? !!P.mvs[i].key : true);
  const keys = []; for (let i = 0; i < n; i++) if (asked(i)) keys.push(i);
  const B = bpB(); B.setFlip(side ? side === 'b' : false);
  const lastOf = k => k > 0 ? [P.mvs[k - 1].from, P.mvs[k - 1].to] : null;
  const showAt = (k, anim, extra) => bpShow(P.fens[k], { anim, last: lastOf(k), ar: mode !== 'review' && k > 0 ? P.mvs[k - 1].ar : null, mk: mode !== 'review' && k > 0 ? P.mvs[k - 1].mk : null, extra });
  const intro = () => {
    const pr = (it.pr || []).map(p => s.c.gl && s.c.gl[p] ? '<span class="bp-pr" title="' + esc(s.c.gl[p].d) + '">' + esc(s.c.gl[p].t) + '</span>' : '').join('');
    return (it.who ? '<p class="muted bp-who">' + esc(it.who) + '</p>' : '') + bhtml(it, s.c) + (pr ? '<div class="bp-prs"><span class="label">Princípios desta partida</span><div>' + pr + '</div></div>' : '');
  };
  const cmt = i => { const m = P.mvs[i]; if (!m) return ''; let h = '<div class="bp-cm"><span class="san mono">' + esc(blabel(P.fens[i], m.s)) + (m.g ? ' ' + esc(m.g) : '') + '</span>' + (m.c ? '<p>' + esc(m.c) + '</p>' : '') + '</div>'; if (m.pr && s.c.gl) h += '<div class="bp-prs">' + m.pr.map(p => s.c.gl[p] ? '<span class="bp-pr" title="' + esc(s.c.gl[p].d) + '">' + esc(s.c.gl[p].t) + '</span>' : '').join('') + '</div>'; return h; };
  const R = {
    start() {
      if (mode === 'study') { st.phase = 'study'; st.k = 0; this.study(); return; }
      if (mode === 'review' && keyLine) { st.phase = 'play'; this.keyGo(); return; }
      if (mode === 'learn' && (it.html || it.tx || it.who || (it.pr && it.pr.length))) { st.phase = 'intro'; showAt(0, false); bpCtrls([]); bpMoves(P, 0, 0); bpPanel({ body: intro() + (side ? '<p class="muted bp-tip">Você vai jogar de ' + SIDE[side] + (keyLine ? ': nos lances-chave, tente achar o lance do mestre.' : '. Siga a seta e jogue os lances da linha.') + '</p>' : ''), btns: [['Começar', 'begin', true]] }); return; }
      this.begin();
    },
    begin() { st.phase = 'play'; st.k = 0; showAt(0, false); bpCtrls([]); this.step(); },
    // escreve o painel durante o jogo
    panel(fb) {
      const k = st.k; let body = '';
      if (mode === 'review') {
        body = keyLine ? (P.mvs[k] && P.mvs[k].q ? '<p class="q">' + esc(P.mvs[k].q) + '</p>' : '<p class="q">Encontre o lance das ' + SIDE[side] + '.</p>') : '<p class="q">' + (asked(k) ? 'Sua vez: lance ' + P.fens[k].split(' ')[5] + ' das ' + SIDE[side] + '. Jogue o lance da linha.' : 'Lance do adversário…') + '</p>';
        body += '<div class="bp-dots">' + keys.map((i, j) => '<i class="' + (i < k ? 'done' : i === k ? 'cur' : '') + '"></i>').join('') + '</div>';
      } else {
        if (k > 0) body += cmt(k - 1);
        else body += '<p class="muted">' + (side ? 'A linha começa. ' : '') + (it.who ? esc(it.who) : '') + '</p>';
        if (k < n && asked(k)) body += '<p class="q bp-ask">' + (P.mvs[k].q ? esc(P.mvs[k].q) : keyLine ? 'Lance-chave: o que as ' + SIDE[side] + ' jogam?' : 'Sua vez: jogue ' + esc(blabel(P.fens[k], P.mvs[k].s)) + '.') + '</p>';
      }
      const btns = [];
      if (st.hold) btns.push(['Continuar', 'cont', true]);
      else if (mode === 'learn' && !side && k < n) btns.push(['Próximo lance', 'cont', true]);
      if (k < n && asked(k) && !st.hold) btns.push([keyLine && mode !== 'learn' ? 'Mostrar' : 'Dica', 'hint']);
      if (mode !== 'review' && k < n) btns.push(['Pular linha', 'skip']);
      bpPanel({ body, fb, btns });
    },
    step() {
      if (st.k >= n) return this.finish();
      if (asked(st.k)) return this.wait();
      if (mode === 'learn' && !side) { this.panel(); return; } // leitura: o usuário avança
      this.panel();
      bpLater(() => this.auto(), mode === 'review' ? 280 : 520);
    },
    auto() {
      const k = st.k; if (k >= n || asked(k)) return this.step();
      st.k++; showAt(st.k, true); if (mode !== 'review') bpMoves(P, st.k, st.k);
      if (mode === 'learn' && P.mvs[k].c) { st.hold = true; this.panel(); return; }
      this.step();
    },
    wait() {
      const k = st.k, m = P.mvs[k];
      const showArrow = (mode === 'learn' && !keyLine) || st.miss >= (keyLine ? 2 : 1);
      const extra = showArrow ? [{ from: m.from, to: m.to, cls: 'a-next' }] : [];
      const mk = showAt(k, false, extra);
      this.panel(st.fb); st.fb = null;
      bpLive(P.fens[k], side, mk, (f, t) => this.move(f, t));
    },
    move(from, to) {
      const k = st.k, want = P.mvs[k], tr = btry(P.fens[k], from, to, want);
      if (!tr) return this.wait();
      if (tr.san === want.s) {
        st.ok++; bdayAdd(1); st.miss = 0; haptic('move');
        st.k++; showAt(st.k, false); bpB().setLive(null);
        if (mode !== 'review') bpMoves(P, st.k, st.k);
        if (mode === 'learn' && (want.c || keyLine)) { st.hold = true; this.panel(keyLine ? { c: 'ok', h: '<b>Isso!</b> ' + esc(fig(want.s)) + ' é o lance da partida.' } : null); return; }
        if (mode === 'review' && keyLine) { this.panel({ c: 'ok', h: '<b>Certo:</b> ' + esc(blabel(P.fens[k], want.s)) + (want.c ? ' — ' + esc(want.c) : '') }); st.kq++; bpLater(() => this.keyGo(), want.c ? 1500 : 700); return; }
        bpLater(() => this.step(), 160); return;
      }
      // outro lance que também é do curso (outra linha)
      const alt = bibFenIdx(s.c).get(bfenKey(P.fens[k]));
      bpB().setLive(null); bpShow(tr.fen, { anim: true, last: [tr.from, tr.to], marks: { bad: tr.to } }); haptic('err');
      let fb;
      if (alt && alt.has(tr.san) && !keyLine) fb = { c: 'hint', h: esc(fig(tr.san)) + ' está em outra linha deste curso. Aqui a linha segue com outro lance.' };
      else { st.err++; st.miss++; fb = { c: 'no', h: mode === 'learn' && keyLine && st.miss < 2 ? 'Não foi o lance da partida. ' + (want.q ? '' : 'Pense de novo.') : 'Não é esse. ' + (st.miss >= 1 && !keyLine || st.miss >= 2 ? 'A seta mostra o lance da linha.' : '') }; }
      st.fb = fb; this.panel(fb);
      bpLater(() => this.wait(), 650);
    },
    keyGo() {
      if (st.kq >= keys.length) return this.finish();
      const kk = keys[st.kq]; st.k = kk;
      if (kk > 0) { bpShow(P.fens[kk - 1], { last: lastOf(kk - 1) }); bpLater(() => { showAt(kk, true); this.wait(); }, 420); } else this.wait();
      this.panel();
    },
    finish() {
      bpB().setLive(null); st.phase = 'end';
      const clean = st.err === 0;
      const card = bpDone({ clean, ok: st.ok, err: st.err });
      let body = '';
      if (mode !== 'review' && n) body += cmt(n - 1);
      if (side) body += '<div class="fb ' + (clean ? 'ok' : 'hint') + '"><b>' + (mode === 'learn' ? 'Linha aprendida.' : clean ? 'Sem erros!' : st.err + (st.err === 1 ? ' erro.' : ' erros.')) + '</b> ' + esc(bcardNote(card)) + '</div>';
      else body += '<div class="fb ok"><b>Fim da linha.</b></div>';
      bpPanel({ body, btns: [['Continuar', 'next', true], ['Estudar a linha', 'study']] });
      if (mode !== 'review') bpMoves(P, n, n, true);
      if (clean && side && mode === 'review') try { sparkle($('#bpPanel')); } catch (e) { /* sem brilho */ }
    },
    /* estudo livre: navegar, explorar, motor */
    study() {
      const k = st.k; bpCtrls(['first', 'prev', 'next', 'last']);
      const fen = st.ex ? st.ex.fen : P.fens[k];
      const mk = st.ex ? bpShow(fen, { last: st.ex.last }) : showAt(k, st.anim);
      st.anim = false;
      bpMoves(P, st.ex ? -1 : k, n, true);
      let body = k === 0 && !st.ex ? intro() : '';
      if (st.ex) body += '<div class="fb hint"><b>Fora da linha:</b> ' + esc(st.ex.sans.map(fig).join(' ')) + '</div>';
      else if (k > 0) body += cmt(k - 1);
      if (!st.ex && k < n && P.mvs[k].q) body += '<p class="q bp-ask">' + esc(P.mvs[k].q) + '</p>';
      if (st.eng) body += '<div class="bp-eng mono">' + (st.ev ? esc(st.ev) : 'Calculando…') + '</div>';
      const btns = [];
      const tr = BTRAIN(it), cd = bcardGet(s.c.id, it.id);
      if (tr) btns.push([cd ? 'Treinar esta linha' : 'Aprender esta linha', 'train', true]);
      else if (k >= n && !st.ex) btns.push(['Continuar', 'readok', true]);
      if (st.ex) btns.push(['Voltar à linha', 'back']);
      btns.push([st.eng ? 'Desligar motor' : 'Motor', 'eng']);
      bpPanel({ top: BKIND[it.k] + ' · ' + s.ch.title, body, btns });
      bpLive(fen, fen.split(' ')[1], mk, (f, t) => this.smove(f, t));
      if (st.eng) this.engine(fen);
    },
    smove(from, to) {
      const fen = st.ex ? st.ex.fen : P.fens[st.k], want = !st.ex ? P.mvs[st.k] : null, tr = btry(fen, from, to, want);
      if (!tr) return this.study();
      if (want && tr.san === want.s) { st.k++; st.anim = false; return this.study(); }
      st.ex = st.ex || { base: st.k, sans: [] }; st.ex.fen = tr.fen; st.ex.last = [tr.from, tr.to]; st.ex.sans.push(tr.san);
      this.study();
    },
    async engine(fen) {
      const t = BP.tok, my = st.evFen = fen; st.ev = null;
      try {
        await Engine.init(); const r = await Engine.go(fen, 700, { multi: 1 });
        if (BP.tok !== t || st.evFen !== my || !st.eng) return;
        const ev = r.mate != null ? (r.mate > 0 ? '#' : '#-') + Math.abs(r.mate) : r.cp != null ? (r.cp > 0 ? '+' : '') + (r.cp / 100).toFixed(1) : '—';
        const pv = lineSan(fen, r.pv || [], 6).map(x => fig(x.san)).join(' ');
        st.ev = ev + (pv ? '  ' + pv : '');
        const el = document.querySelector('#bpPanel .bp-eng'); if (el) el.textContent = st.ev;
        if (r.best) bpB().setArrows(barrows(null, [{ from: r.best.slice(0, 2), to: r.best.slice(2, 4), cls: 'a-best' }]));
      } catch (e) { st.ev = 'Motor indisponível'; const el = document.querySelector('#bpPanel .bp-eng'); if (el) el.textContent = st.ev; }
    },
    act(a) {
      if (a === 'begin') return this.begin();
      if (a === 'cont') { if (st.hold) { st.hold = false; return this.step(); } if (mode === 'learn' && !side) { st.k++; showAt(st.k, true); bpMoves(P, st.k, st.k); if (st.k >= n) return this.finish(); this.panel(); return; } return; }
      if (a === 'hint') { st.miss = Math.max(st.miss, keyLine ? 2 : 1); if (mode === 'review') { st.err++; } return this.wait(); }
      if (a === 'skip') { bpDone({ skip: 1 }); return bpNext(); }
      if (a === 'next') return bpNext();
      if (a === 'study') { st.phase = 'study'; st.k = n; R.mode = 'study'; return this.study(); }
      if (a === 'readok') { bpDone({}); return bpNext(); }
      if (a === 'train') { const cd = bcardGet(s.c.id, it.id); s.mode = cd ? 'review' : 'learn'; s.extra = !!cd && cd.d > bnow(); bpHead(); s.run = BRUN.l(s); s.run.start(); return; }
      if (a === 'back') { st.ex = null; return this.study(); }
      if (a === 'eng') { st.eng = !st.eng; if (!st.eng) bpB().setArrows([]); return this.study(); }
      if (a.startsWith('nav:')) return this.key(a.slice(4));
      if (a.startsWith('go:')) { if (st.phase !== 'study' && st.phase !== 'end') return; st.phase = 'study'; st.ex = null; st.k = +a.slice(3); return this.study(); }
    },
    key(k) {
      if (st.phase === 'intro') { if (k === 'next') this.begin(); return; }
      if (st.phase === 'end') { if (k === 'next') bpNext(); return; }
      if (st.phase === 'study') {
        if (st.ex) { if (k === 'prev' || k === 'first') { st.ex = null; this.study(); } return; }
        const o = st.k; if (k === 'next') st.k = Math.min(n, st.k + 1); else if (k === 'prev') st.k = Math.max(0, st.k - 1); else if (k === 'first') st.k = 0; else if (k === 'last') st.k = n;
        st.anim = k === 'next' && st.k === o + 1; if (st.k !== o) this.study(); return;
      }
      if (k === 'next' && (st.hold || (mode === 'learn' && !side))) this.act('cont');
    }
  };
  return R;
};
/* ---------- exercício (puzzle do livro) ---------- */
BRUN.p = s => {
  const it = s.it, mode = s.mode;
  let c0; try { c0 = new Chess(it.fen); } catch (e) { c0 = new Chess(); }
  let pre = null; if (it.pre) { try { pre = c0.move(it.pre); } catch (e) { pre = null; } }
  const P = bprep(c0.fen(), it.sol), n = P.mvs.length, side = P.fens[0].split(' ')[1];
  const st = { k: 0, err: 0, hint: 0, failed: false, done: false };
  const B = bpB(); B.setFlip(side === 'b');
  const lastOf = k => k > 0 ? [P.mvs[k - 1].from, P.mvs[k - 1].to] : pre ? [pre.from, pre.to] : null;
  const goal = () => (it.goal ? '<p class="q">' + esc(it.goal) + '</p>' : '<p class="q">' + SIDEC[side] + ' jogam' + (it.goal2 === 'draw' ? ' e empatam.' : ' e ganham.') + '</p>') + (it.src || it.tag ? '<p class="muted bp-src">' + esc([it.tag, it.src].filter(Boolean).join(' · ')) + '</p>' : '');
  const R = {
    start() {
      bpCtrls([]);
      if (pre) { bpShow(it.fen, {}); this.panel(); bpLater(() => { bpShow(P.fens[0], { anim: true, last: lastOf(0) }); this.arm(); }, 650); }
      else { bpShow(P.fens[0], {}); this.arm(); }
    },
    panel(fb) {
      const btns = st.done ? [['Continuar', 'next', true]] : [['Dica', 'hint'], ['Ver solução', 'sol']];
      if (!st.done && mode !== 'review') btns.push(['Pular', 'skip']);
      let body = goal();
      if (st.hint && it.hint) body += '<div class="fb hint">' + esc(it.hint) + '</div>';
      if (st.done) {
        body += '<div class="bp-sol mono">' + esc(bline(P, 0, n)) + '</div>';
        const cs = P.mvs.filter(m => m.c).map(m => '<li><b class="mono">' + esc(fig(m.s)) + '</b> ' + esc(m.c) + '</li>').join('');
        if (cs) body += '<ul class="bp-cms">' + cs + '</ul>';
        if (it.idea) body += '<div class="callout"><span class="label">A ideia</span><p>' + esc(it.idea) + '</p></div>';
      }
      bpPanel({ body, fb, btns });
    },
    arm() {
      if (st.k >= n) return this.solved();
      const k = st.k, m = P.mvs[k];
      if (m.col !== side) { this.panel(st.fb); bpLater(() => { st.k++; bpShow(P.fens[st.k], { anim: true, last: lastOf(st.k) }); this.arm(); }, 480); return; }
      const marks = { last: lastOf(k), check: bcheckSq(P.fens[k]) }; if (st.hint >= 2) marks.sel = m.from;
      bpB().setMarks(marks); this.panel(st.fb); st.fb = null;
      bpLive(P.fens[k], side, marks, (f, t) => this.move(f, t));
    },
    move(from, to) {
      const k = st.k, want = P.mvs[k], tr = btry(P.fens[k], from, to, want);
      if (!tr) return this.arm();
      if (tr.san === want.s || (k === n - 1 && tr.mate)) {
        st.k++; bdayAdd(1); haptic('move'); bpB().setLive(null);
        bpShow(tr.fen, { last: [tr.from, tr.to] });
        if (st.k >= n) return this.solved();
        st.fb = { c: 'ok', h: '<b>Isso.</b> Continue.' };
        return this.arm();
      }
      bpB().setLive(null); bpShow(tr.fen, { anim: true, last: [tr.from, tr.to], marks: { bad: tr.to } }); haptic('err');
      if (!st.failed) { st.failed = true; } st.err++;
      const why = it.wrong && it.wrong[tr.san];
      st.fb = { c: 'no', h: '<b>' + esc(fig(tr.san)) + '?</b> ' + (why ? esc(why) : 'Não é esse. Procure xeques, capturas e ameaças.') };
      this.panel(st.fb);
      bpLater(() => { bpShow(P.fens[k], { anim: true, last: lastOf(k) }); this.arm(); }, 700);
    },
    solved() {
      st.done = true; bpB().setLive(null);
      const mk = { last: lastOf(n), ok: P.mvs[n - 1] ? P.mvs[n - 1].to : null };
      bpB().setMarks(mk);
      const card = bpDone({ clean: !st.failed && st.hint === 0, ok: st.failed ? 0 : 1, err: st.err });
      haptic('ok'); if (!st.failed && !st.hint) try { sparkle($('#bpPanel')); } catch (e) { /* sem brilho */ }
      this.panel({ c: st.failed ? 'hint' : 'ok', h: '<b>' + (st.failed ? 'Resolvido com ajuda.' : 'Resolvido!') + '</b> ' + esc(bcardNote(card)) });
    },
    async showSol() {
      st.failed = true; bpB().setLive(null);
      while (BP.s && st.k < n && !st.done) { const t = BP.tok; await sleep(600); if (BP.tok !== t) return; st.k++; bpShow(P.fens[st.k], { anim: true, last: lastOf(st.k) }); }
      if (!st.done) this.solved();
    },
    act(a) {
      if (a === 'next') return bpNext();
      if (a === 'hint') { st.hint++; if (!it.hint && st.hint === 1) st.hint = 2; return this.arm(); }
      if (a === 'sol') return this.showSol();
      if (a === 'skip') { bpDone({ skip: 1 }); return bpNext(); }
    },
    key(k) { if (k === 'next' && st.done) bpNext(); }
  };
  return R;
};
/* ---------- pergunta ---------- */
BRUN.q = s => {
  const it = s.it; const st = { pick: null };
  const R = {
    start() {
      bpCtrls([]); const B = bpB();
      if (it.fen) { B.setFlip(it.fen.split(' ')[1] === 'b'); bpShow(it.fen, { ar: it.ar }); }
      this.panel();
    },
    panel() {
      let body = '<p class="q">' + esc(it.q) + '</p><div class="bp-opts">' + it.opts.map((o, i) => '<button type="button" class="bp-opt' + (st.pick != null ? (i === it.a ? ' ok' : i === st.pick ? ' no' : '') : '') + '" data-bp="opt:' + i + '"' + (st.pick != null ? ' disabled' : '') + '><span class="mono">' + 'ABCDEF'[i] + '</span>' + esc(o) + '</button>').join('') + '</div>';
      let fb = null;
      if (st.pick != null) fb = { c: st.pick === it.a ? 'ok' : 'no', h: '<b>' + (st.pick === it.a ? 'Certo!' : 'Não: a resposta é ' + 'ABCDEF'[it.a] + '.') + '</b> ' + esc(it.why || '') + (st.note ? ' <span class="muted">' + esc(st.note) + '</span>' : '') };
      bpPanel({ body, fb, btns: st.pick != null ? [['Continuar', 'next', true]] : (s.mode !== 'review' ? [['Pular', 'skip']] : []) });
    },
    act(a) {
      if (a.startsWith('opt:') && st.pick == null) { st.pick = +a.slice(4); const ok = st.pick === it.a; haptic(ok ? 'ok' : 'err'); bdayAdd(1); st.note = bcardNote(bpDone({ clean: ok, ok: ok ? 1 : 0, err: ok ? 0 : 1 })); return this.panel(); }
      if (a === 'next') return bpNext();
      if (a === 'skip') { bpDone({ skip: 1 }); return bpNext(); }
    },
    key(k) { if (k === 'next' && st.pick != null) bpNext(); }
  };
  return R;
};
/* ---------- casas (toque nas casas certas) ---------- */
BRUN.s = s => {
  const it = s.it; const st = { sel: new Set(), done: false };
  const ans = new Set(it.ans || []);
  const R = {
    start() { bpCtrls([]); const B = bpB(); B.setFlip(false); bpShow(it.fen || BSTART, {}); this.panel(); },
    marks() {
      const m = { pick: [...st.sel] };
      if (st.done) { m.pick = []; m.okp = [...st.sel].filter(x => ans.has(x)); m.wrongp = [...st.sel].filter(x => !ans.has(x)); m.missp = [...ans].filter(x => !st.sel.has(x)); }
      bpB().setMarks(m);
    },
    tap(e) { if (st.done) return; const i = bpB().sqAt(e); if (i == null) return; const q = iSq(i); if (st.sel.has(q)) st.sel.delete(q); else st.sel.add(q); haptic('move'); this.marks(); this.panel(); },
    panel(fb) {
      let body = '<p class="q">' + esc(it.ask) + '</p><p class="muted">Toque nas casas do tabuleiro. Selecionadas: ' + st.sel.size + '</p>';
      if (!st.done && st.hint && it.hint) body += '<div class="fb hint">' + esc(it.hint) + '</div>';
      bpPanel({ body, fb: fb || st.fb, btns: st.done ? [['Continuar', 'next', true]] : [['Conferir', 'check', true, !st.sel.size]].concat(it.hint && !st.hint ? [['Dica', 'hint']] : [], s.mode !== 'review' ? [['Pular', 'skip']] : []) });
    },
    act(a) {
      if (a === 'check') {
        st.done = true; const ok = st.sel.size === ans.size && [...st.sel].every(x => ans.has(x));
        haptic(ok ? 'ok' : 'err'); bdayAdd(1); const card = bpDone({ clean: ok, ok: ok ? 1 : 0, err: ok ? 0 : 1 });
        st.fb = { c: ok ? 'ok' : 'no', h: '<b>' + (ok ? 'Certo!' : 'Ainda não. As casas certas: ' + esc([...ans].join(', ')) + '.') + '</b> ' + esc(it.why || '') + ' <span class="muted">' + esc(bcardNote(card)) + '</span>' };
        this.marks(); return this.panel();
      }
      if (a === 'hint') { st.hint = 1; return this.panel(); }
      if (a === 'next') return bpNext();
      if (a === 'skip') { bpDone({ skip: 1 }); return bpNext(); }
    },
    key(k) { if (k === 'next' && st.done) bpNext(); }
  };
  return R;
};
/* ---------- leitura (conceito) ---------- */
BRUN.c = s => {
  const it = s.it; const fen = it.fen || BSTART; const st = { ex: null };
  const R = {
    start() { bpCtrls(st.ex ? [] : []); const B = bpB(); B.setFlip(false); this.draw(); },
    draw() {
      const f = st.ex ? st.ex.fen : fen;
      const mk = bpShow(f, st.ex ? { last: st.ex.last } : { ar: it.ar, mk: it.mk });
      let body = bhtml(it, s.c);
      if (it.cap) body += '<p class="bp-cap">' + esc(it.cap) + '</p>';
      if (!it.fen) body += '';
      if (st.ex) body += '<div class="fb hint">Explorando: ' + esc(st.ex.sans.map(fig).join(' ')) + '</div>';
      const btns = [['Continuar', 'next', true]];
      if (st.ex) btns.push(['Voltar à posição', 'back']);
      bpPanel({ body, btns });
      if (it.fen) bpLive(f, f.split(' ')[1], mk, (a, b) => { const tr = btry(f, a, b); if (!tr) return this.draw(); st.ex = st.ex || { sans: [] }; st.ex.fen = tr.fen; st.ex.last = [tr.from, tr.to]; st.ex.sans.push(tr.san); this.draw(); });
      else bpB().setLive(null);
    },
    act(a) {
      if (a === 'back') { st.ex = null; return this.draw(); }
      if (a === 'next') { bpDone({}); return bpNext(); }
    },
    key(k) { if (k === 'next') this.act('next'); }
  };
  return R;
};
/* ---------- demonstração quadro a quadro ---------- */
BRUN.d = s => {
  const it = s.it; const fr = it.fr || []; const pos = []; let c; try { c = new Chess(it.fen); } catch (e) { c = new Chess(); }
  const lasts = [];
  for (const f of fr) { let last = null; if (f.m) { try { const m = c.move(f.m); last = [m.from, m.to]; } catch (e) { /* lance inválido */ } } pos.push(c.fen()); lasts.push(last); }
  const st = { j: 0, anim: false };
  const R = {
    start() { const B = bpB(); B.setFlip((it.fen || '').split(' ')[1] === 'b' && false); this.draw(); },
    draw() {
      const j = st.j, f = fr[j] || {};
      bpShow(pos[j] || it.fen, { anim: st.anim, last: lasts[j], ar: f.ar, mk: f.mk }); st.anim = false;
      bpCtrls(['first', 'prev', 'next', 'last']);
      let body = (j === 0 ? bhtml(it, s.c) : '') + (f.cap ? '<div class="bp-cm">' + (f.m ? '<span class="san mono">' + esc(fig(f.m)) + '</span>' : '') + '<p>' + esc(f.cap) + '</p></div>' : '');
      body += '<div class="bp-dots">' + fr.map((x, i) => '<i class="' + (i < j ? 'done' : i === j ? 'cur' : '') + '"></i>').join('') + '</div>';
      const end = j >= fr.length - 1;
      bpPanel({ body, btns: end ? [['Continuar', 'done', true]] : [['Próximo', 'nav:next', true]] });
    },
    act(a) {
      if (a.startsWith('nav:')) return this.key(a.slice(4));
      if (a === 'done') { bpDone({}); return bpNext(); }
    },
    key(k) {
      const o = st.j, L = fr.length - 1;
      if (k === 'next') { if (st.j >= L) return this.act('done'); st.j++; st.anim = true; }
      else if (k === 'prev') st.j = Math.max(0, st.j - 1); else if (k === 'first') st.j = 0; else if (k === 'last') st.j = Math.max(0, L);
      if (st.j !== o) this.draw();
    }
  };
  return R;
};
/* ---------- desafio contra o motor ---------- */
BRUN.x = s => {
  const it = s.it; const side = it.side || (it.fen || BSTART).split(' ')[1];
  const GOAL = { win: 'Dê mate contra o motor.', promote: 'Promova um peão.', draw: 'Segure o empate por ' + (it.hold || 15) + ' lances.', convert: 'Converta a vantagem em vitória.' };
  const st = { fen: it.fen, last: null, n: 0, over: null, think: false, msg: null, hint: null };
  const R = {
    start() { bpCtrls([]); bpB().setFlip(side === 'b'); this.reset(); },
    reset() { BP.tok++; Object.assign(st, { fen: it.fen, last: null, n: 0, over: null, think: false, msg: null, hint: null }); bpShow(st.fen, {}); Engine.init().catch(() => {}); if (st.fen.split(' ')[1] !== side) this.reply(); else this.arm(); },
    panel() {
      let body = '<p class="q">' + (it.prompt ? '' : esc(GOAL[it.goal] || 'Jogue contra o motor.')) + '</p>' + (it.prompt ? '<div class="bp-prompt">' + (s.c.builtin ? it.prompt : esc(it.prompt)) + '</div>' : '');
      body += '<p class="muted">' + (st.think ? 'O motor está pensando…' : st.over ? '' : 'Você joga de ' + SIDE[side] + (it.goal === 'draw' ? ' · lance ' + st.n + ' de ' + (it.hold || 15) : st.n ? ' · ' + st.n + (st.n === 1 ? ' lance' : ' lances') : '')) + '</p>';
      if (st.over && it.idea) body += '<div class="callout"><span class="label">A ideia</span><p>' + esc(it.idea) + '</p></div>';
      const btns = st.over ? (st.over === 'ok' ? [['Continuar', 'next', true], ['Jogar de novo', 'reset']] : [['Tentar de novo', 'reset', true], ['Pular', 'skip']]) : [['Dica', 'hint'], ['Recomeçar', 'reset'], ['Pular', 'skip']];
      bpPanel({ body, fb: st.msg, btns });
    },
    arm() { if (st.over) return this.panel(); const mk = bpShow(st.fen, { last: st.last, extra: st.hint ? [st.hint] : [] }); st.hint = null; this.panel(); bpLive(st.fen, side, mk, (f, t) => this.move(f, t)); },
    end(kind, msg) { st.over = kind; bpB().setLive(null); st.msg = { c: kind === 'ok' ? 'ok' : 'no', h: msg }; if (kind === 'ok') { bpDone({}); haptic('ok'); try { sparkle($('#bpPanel')); } catch (e) { /* sem brilho */ } } else haptic('err'); this.panel(); },
    move(from, to) {
      const tr = btry(st.fen, from, to); if (!tr) return this.arm();
      st.fen = tr.fen; st.last = [tr.from, tr.to]; st.n++; bdayAdd(1); bpB().setLive(null); bpShow(st.fen, { last: st.last });
      const c = tr.c;
      if (c.isCheckmate()) return this.end('ok', '<b>Mate!</b> Desafio cumprido.');
      if (it.goal === 'promote' && tr.promo) return this.end('ok', '<b>Promoveu!</b> Desafio cumprido.');
      if (c.isDraw()) return it.goal === 'draw' ? this.end('ok', '<b>Empate garantido.</b>') : this.end('no', '<b>Empate.</b> ' + (c.isStalemate() ? 'Afogamento: cuidado com as casas do rei adversário.' : 'A vantagem escapou.'));
      if (it.goal === 'draw' && st.n >= (it.hold || 15)) return this.end('ok', '<b>Você segurou!</b> ' + st.n + ' lances sem perder.');
      this.reply();
    },
    async reply() {
      st.think = true; this.panel(); const t = BP.tok;
      let r; try { await Engine.init(); r = await Engine.go(st.fen, 450); } catch (e) { r = null; }
      if (BP.tok !== t || !BP.s) return; st.think = false;
      if (!r || !r.best) { this.end('no', 'O motor não respondeu. Tente de novo.'); return; }
      const persp = side === 'w' ? 1 : -1, cp = r.mate != null ? (r.mate > 0 ? 1 : -1) * 10000 * persp : (r.cp || 0) * persp;
      const c = new Chess(st.fen); let m; try { m = c.move({ from: r.best.slice(0, 2), to: r.best.slice(2, 4), promotion: r.best[4] || 'q' }); } catch (e) { m = null; }
      if (!m) { this.end('no', 'O motor não respondeu.'); return; }
      st.fen = c.fen(); st.last = [m.from, m.to]; bpShow(st.fen, { anim: true, last: st.last });
      if (c.isCheckmate()) return this.end('no', '<b>Levou mate.</b>');
      if (c.isDraw()) return it.goal === 'draw' ? this.end('ok', '<b>Empate garantido.</b>') : this.end('no', '<b>Empate.</b> A vantagem escapou.');
      if ((it.goal === 'win' || it.goal === 'convert') && st.n >= 2 && cp < (it.floor ? Math.min(it.floor, 150) : 120)) return this.end('no', '<b>A vantagem escapou.</b> O motor já não vê vitória para você aqui.');
      if (it.goal === 'draw' && cp < -400) return this.end('no', '<b>A posição ficou perdida.</b>');
      this.arm();
    },
    async act(a) {
      if (a === 'reset') return this.reset();
      if (a === 'next') return bpNext();
      if (a === 'skip') { bpDone({ skip: 1 }); return bpNext(); }
      if (a === 'hint' && !st.over && !st.think) { const t = BP.tok; try { await Engine.init(); const r = await Engine.go(st.fen, 600); if (BP.tok !== t || !r.best) return; st.hint = { from: r.best.slice(0, 2), to: r.best.slice(2, 4), cls: 'a-best' }; this.arm(); } catch (e) { /* sem dica */ } }
    },
    key(k) { if (k === 'next' && st.over === 'ok') bpNext(); }
  };
  return R;
};

/* ---------- Biblioteca: importar (Lichess, PGN, suas partidas, tabuleiro, PDF) ---------- */
const BGLYPHS = ['wN', 'wB', 'wR', 'wQ', 'wK', 'wP', 'bN', 'bB', 'bR', 'bQ'];
function bnewCourse(o) {
  const id = bid('u');
  return Object.assign({ id, title: 'Curso', sub: '', src: 'pgn', glyph: BGLYPHS[(strHash(id).charCodeAt(1) || 0) % BGLYPHS.length], hue: (strHash(id + 'h').charCodeAt(0) * 37) % 360, side: '', ch: [], t: bnow(), seq: 0 }, o || {});
}
function bibFromPgn(text, o) {
  o = o || {};
  const games = PGNLIB.parse(text);
  if (!games.length) throw { code: 'empty' };
  const h0 = games[0].h || {};
  const c = bnewCourse({ title: o.title || h0.StudyName || (games.length === 1 && h0.Event && h0.Event !== '?' ? h0.Event : '') || 'Curso importado', sub: o.sub || '', src: o.src || 'pgn', blurb: o.blurb || '' });
  const me = String(S.me || '').toLowerCase();
  let lines = 0, bad = 0;
  games.forEach((g, gi) => {
    if (!PGNLIB.legalize(g, Chess)) bad++;
    const h = g.h, orient = String(h.Orientation || '').toLowerCase();
    let side = o.side;
    if (side === 'auto' || side == null) side = orient === 'black' ? 'b' : orient === 'white' ? 'w' : String(h.Black || '').toLowerCase() === me && me ? 'b' : 'w';
    const title = (h.ChapterName || (h.White && h.White !== '?' && h.Black && h.Black !== '?' ? h.White + ' × ' + h.Black : '') || (h.Event && h.Event !== '?' && games.length > 1 ? h.Event : '') || (games.length > 1 ? 'Capítulo ' + (gi + 1) : c.title)).slice(0, 140);
    const ch = { id: 'h' + gi, title, it: [] };
    const rc = PGNLIB.shapes(g.root.c);
    // a cadeia de nós da raiz guarda a posição de cada lance (para nomear variantes)
    const L = PGNLIB.lines(g, 240);
    if (!L.length) ch.it.push({ id: 'i' + (++c.seq), k: 'c', title, tx: rc.c || '', fen: g.fen, ar: rc.ar, mk: rc.mk });
    L.forEach((path, li) => {
      const fenBefore = []; let f = g.fen; for (const x of path) { fenBefore.push(f); f = x.n.fen; }
      const mv = path.map(({ n }) => { const sh = PGNLIB.shapes(n.c); const m = { s: n.s }; if (sh.c) m.c = sh.c; if (n.nag) m.g = n.nag; if (sh.ar.length) m.ar = sh.ar; if (sh.mk.length) m.mk = sh.mk; return m; });
      const j = path.findIndex(x => x.alt);
      const t = L.length > 1 ? (j < 0 ? title + ' · linha principal' : title + ' · ' + blabel(fenBefore[j], path[j].n.s)) : title;
      ch.it.push({ id: 'i' + (++c.seq), k: 'l', title: t.slice(0, 160), tx: li === 0 ? rc.c || '' : '', fen: g.fen, side: side || '', ask: side ? 'all' : 'none', mv });
      lines++;
    });
    c.ch.push(ch);
  });
  const sides = new Set(); for (const ch of c.ch) for (const it of ch.it) if (it.side) sides.add(it.side);
  c.side = sides.size === 1 ? [...sides][0] : '';
  c.sub = c.sub || (c.ch.length + (c.ch.length === 1 ? ' capítulo' : ' capítulos') + ' · ' + lines + (lines === 1 ? ' linha' : ' linhas'));
  return { c, lines, bad };
}
function bibAddDone(c, msg) { bibAddCourse(c); toast(msg || 'Curso criado'); bibGo('course', { cid: c.id }); }
async function bibLichessGo() {
  const st = $('#bibLiSt'), v = ($('#bibLiUrl').value || '').trim();
  const m = v.match(/study\/([A-Za-z0-9]{8})(?:\/([A-Za-z0-9]{8}))?/) || v.match(/^([A-Za-z0-9]{8})$/);
  if (!m) { st.textContent = 'Cole um link do tipo lichess.org/study/… (o estudo precisa ser público ou não listado).'; return; }
  const url = 'https://lichess.org/api/study/' + m[1] + (m[2] ? '/' + m[2] : '') + '.pgn?comments=true&variations=true&clocks=false&orientation=true';
  const btn = $('[data-bib="li:go"]'); btn.disabled = true;
  st.textContent = 'Buscando o estudo no Lichess… Se o app pedir permissão para usar o navegador, toque em Permitir.';
  try {
    const t = await browserText(url, x => x.includes('[Event') || /not found|private|forbidden|404/i.test(x));
    if (!t.includes('[Event')) throw { code: 'priv' };
    const r = bibFromPgn(t, { side: bsegVal('bibLiSide'), src: 'lichess' });
    r.c.blurb = 'Estudo do Lichess: lichess.org/study/' + m[1];
    bibAddDone(r.c, 'Estudo importado: ' + r.lines + (r.lines === 1 ? ' linha' : ' linhas'));
  } catch (e) {
    const code = e && e.code;
    st.textContent = code === 'priv' ? 'O Lichess não liberou esse estudo. Ele precisa ser público ou não listado; se for seu e privado, copie o PGN e cole abaixo.'
      : code === 'no_mcp' ? 'A busca automática funciona no app Claude para computador e no app do Peão Passado. Aqui, abra o estudo, copie o PGN e cole logo abaixo.'
        : code === 'empty' ? 'O estudo veio vazio.' : 'Não deu para buscar agora. Copie o PGN do estudo e cole abaixo.';
    const d = $('#v-biblioteca .bib-det'); if (d) d.open = true;
  }
  btn.disabled = false;
}
function bibLichessPaste() {
  const st = $('#bibLiSt'), t = $('#bibLiPgn').value;
  if (!t.trim()) { st.textContent = 'Cole o PGN do estudo.'; return; }
  try { const r = bibFromPgn(t, { side: bsegVal('bibLiSide'), src: 'lichess' }); bibAddDone(r.c, 'Estudo importado: ' + r.lines + (r.lines === 1 ? ' linha' : ' linhas')); }
  catch (e) { st.textContent = 'Não reconheci esse PGN.'; }
}
function bibPgnGo() {
  const st = $('#bibPgSt'), t = $('#bibPgTxt').value;
  if (!t.trim()) { st.textContent = 'Cole um PGN ou envie um arquivo.'; return; }
  try {
    const r = bibFromPgn(t, { side: bsegVal('bibPgSide'), title: ($('#bibPgTitle').value || '').trim() || undefined, src: 'pgn' });
    bibAddDone(r.c, 'Curso criado: ' + r.lines + (r.lines === 1 ? ' linha' : ' linhas') + (r.bad ? ' (alguns lances ilegais foram cortados)' : ''));
  } catch (e) { st.textContent = 'Não reconheci esse PGN.'; }
}
/* ---------- das suas partidas ---------- */
function bibGamesGo() {
  const side = bsegVal('bibJgSide') || 'w', dep = +(bsegVal('bibJgDep', 'dep') || 12), st = $('#bibJgSt');
  const gs = (S.games || []).filter(g => g.c === side && g.mv);
  if (gs.length < 5) { st.textContent = 'Preciso de pelo menos 5 partidas de ' + SIDE[side] + '. Sincronize suas partidas primeiro.'; return; }
  const cnt = new Map();
  for (const g of gs) {
    const mv = g.mv.split(' ').slice(0, dep); if (mv.length < dep) continue;
    const k = mv.join(' '); let e = cnt.get(k); if (!e) cnt.set(k, e = { mv, n: 0, w: 0, d: 0, g });
    e.n++; const r = resultOf(g).k; if (r === 'W') e.w++; else if (r === 'D') e.d++;
  }
  let top = [...cnt.values()].filter(e => e.n >= 2).sort((a, b) => b.n - a.n).slice(0, 30);
  if (top.length < 3) {
    // linhas muito espalhadas: usa metade da profundidade
    const half = Math.max(6, dep / 2), c2 = new Map();
    for (const g of gs) { const mv = g.mv.split(' ').slice(0, half); if (mv.length < half) continue; const k = mv.join(' '); let e = c2.get(k); if (!e) c2.set(k, e = { mv, n: 0, w: 0, d: 0, g }); e.n++; const r = resultOf(g).k; if (r === 'W') e.w++; else if (r === 'D') e.d++; }
    top = [...c2.values()].filter(e => e.n >= 2).sort((a, b) => b.n - a.n).slice(0, 30);
  }
  if (!top.length) { st.textContent = 'Suas aberturas variam demais para montar linhas repetidas.'; return; }
  const c = bnewCourse({ title: 'Meu repertório real de ' + SIDE[side], src: 'jogos', side, glyph: side + 'K', blurb: 'As linhas que você mais repete com as ' + SIDE[side] + ', tiradas das suas partidas, com o aproveitamento de cada uma.' });
  const byFirst = new Map();
  for (const e of top) {
    const P = bprep(BSTART, e.mv.map(s => ({ s }))); if (P.mvs.length < 4) continue;
    const head = bline(P, 0, 2);
    let ch = byFirst.get(head); if (!ch) { ch = { id: 'h' + byFirst.size, title: head, it: [] }; byFirst.set(head, ch); c.ch.push(ch); }
    const pts = Math.round((e.w + e.d / 2) / e.n * 100);
    const mv = P.mvs.map(m => ({ s: m.s }));
    mv[mv.length - 1].c = 'Você chegou a esta posição em ' + e.n + ' partidas: ' + e.w + ' vitórias, ' + e.d + ' empates e ' + (e.n - e.w - e.d) + ' derrotas (' + pts + '% dos pontos).';
    ch.it.push({ id: 'i' + (++c.seq), k: 'l', title: bopName(e.g) + ' · ' + e.n + ' partidas · ' + pts + '%', fen: BSTART, side, ask: 'all', mv });
  }
  c.sub = top.length + ' linhas das suas partidas';
  bibAddDone(c, 'Curso criado com ' + top.length + ' linhas');
}
/* ---------- montar o repertório no tabuleiro (estilo Chess Tempo) ---------- */
function bibRepStart() {
  S.bib.pg = 'play'; bibRender();
  BP.s = { mode: 'build', q: [{}], i: 0, res: [], ok: 0, err: 0 };
  bpB(); BP.s.run = BRUN.build(BP.s); BP.s.run.start();
}
BRUN.build = s => {
  const st = { side: store.get('bibRepSide', 'w'), path: [], fen: BSTART, last: null, cmt: {} };
  const course = () => (BIB.user || []).find(c => c.src === 'rep' && c.side === st.side);
  const R = {
    start() { bpCtrls(['first', 'prev']); this.draw(); },
    known() {
      // lances já guardados a partir desta posição
      const c = course(); if (!c) return [];
      const m = bibFenIdx(c).get(bfenKey(st.fen)); if (!m) return [];
      const out = []; for (const san of m) { const tr = (() => { try { const x = new Chess(st.fen); const r = x.move(san); return r; } catch (e) { return null; } })(); if (tr) out.push({ from: tr.from, to: tr.to, cls: 'a-g', san }); }
      return out;
    },
    draw() {
      bpB().setFlip(st.side === 'b');
      const kn = this.known();
      const mk = bpShow(st.fen, { last: st.last, extra: kn });
      const P = bprep(BSTART, st.path.map(x => ({ s: x })));
      bpMoves(P, P.mvs.length, P.mvs.length, false);
      const c = course(), nl = c ? c.ch.reduce((a, ch) => a + ch.it.length, 0) : 0;
      $('#bpHead').innerHTML = '<div class="stack" style="gap:3px;min-width:0"><span class="label">Montar repertório</span><span class="who">Repertório de ' + SIDE[st.side] + '</span></div><button class="btn small" type="button" data-bp="exit">Sair</button>';
      $('#bpProg').firstElementChild.style.width = '0%';
      let body = '<div class="seg" role="group"><button type="button" data-bp="rside:w" aria-pressed="' + (st.side === 'w') + '">Brancas</button><button type="button" data-bp="rside:b" aria-pressed="' + (st.side === 'b') + '">Pretas</button></div>';
      body += '<p class="muted">Jogue os lances dos dois lados. As setas verdes são lances que já estão no seu repertório nesta posição. Quando a linha estiver pronta, toque em Salvar linha.</p>';
      body += '<div class="bp-sol mono">' + (P.mvs.length ? esc(bline(P, 0, P.mvs.length)) : '<span class="muted">Posição inicial</span>') + '</div>';
      if (P.mvs.length) body += '<div class="field"><label for="bpRepC">Comentário do último lance (opcional)</label><input id="bpRepC" maxlength="300" value="' + esc(st.cmt[st.path.length] || '') + '"></div>';
      body += '<p class="muted" style="font-size:13px">' + (nl ? nl + (nl === 1 ? ' linha salva' : ' linhas salvas') + ' neste repertório.' : 'Nenhuma linha salva ainda.') + '</p>';
      bpPanel({ top: 'Repertório', title: false, body, btns: [['Salvar linha', 'rsave', true, P.mvs.length < 2], ['Voltar lance', 'rundo', false, !P.mvs.length], ['Limpar', 'rclear', false, !P.mvs.length]].concat(c ? [['Abrir o curso', 'ropen']] : []) });
      bpLive(st.fen, st.fen.split(' ')[1], mk, (f, t) => this.move(f, t));
    },
    move(from, to) { const tr = btry(st.fen, from, to); if (!tr) return this.draw(); this.keepCmt(); st.path.push(tr.san); st.fen = tr.fen; st.last = [tr.from, tr.to]; this.draw(); },
    keepCmt() { const el = $('#bpRepC'); if (el) st.cmt[st.path.length] = el.value.trim(); },
    redo() { const P = bprep(BSTART, st.path.map(x => ({ s: x }))); st.path = P.mvs.map(m => m.s); st.fen = P.fens[P.fens.length - 1]; const m = P.mvs[P.mvs.length - 1]; st.last = m ? [m.from, m.to] : null; },
    save() {
      this.keepCmt();
      let c = course();
      if (!c) { c = bnewCourse({ title: 'Meu repertório de ' + SIDE[st.side], src: 'rep', side: st.side, glyph: st.side + 'R', blurb: 'Linhas montadas por você no tabuleiro.' }); bibAddCourse(c); }
      const key = st.path.join(' ');
      for (const ch of c.ch) for (const it of ch.it) { const k2 = it.mv.map(m => m.s).join(' '); if (k2 === key || k2.startsWith(key + ' ')) { toast('Essa linha já está no repertório'); return; } }
      const P = bprep(BSTART, st.path.map(x => ({ s: x })));
      const head = bline(P, 0, 2);
      let ch = c.ch.find(x => x.title === head); if (!ch) { ch = { id: 'h' + bid(''), title: head, it: [] }; c.ch.push(ch); }
      const mv = P.mvs.map((m, i) => { const o = { s: m.s }; if (st.cmt[i + 1]) o.c = st.cmt[i + 1]; return o; });
      // uma linha que era prefixo desta é substituída por ela (sem duplicar)
      for (const h of c.ch) h.it = h.it.filter(it => { const k2 = it.mv.map(m => m.s).join(' '); return !(key.startsWith(k2 + ' ')); });
      const last = P.mvs.length - 1;
      ch.it.push({ id: 'i' + (++c.seq), k: 'l', title: bline(P, Math.max(0, last - 3), last + 1), fen: BSTART, side: st.side, ask: 'all', mv });
      c.ch = c.ch.filter(h => h.it.length);
      const nl = c.ch.reduce((a, h) => a + h.it.length, 0); c.sub = nl + (nl === 1 ? ' linha' : ' linhas'); bibSaveUser(c); BFI.delete(c);
      toast('Linha salva'); haptic('ok'); this.draw();
    },
    act(a) {
      if (a.startsWith('rside:')) { this.keepCmt(); st.side = a.slice(6); store.set('bibRepSide', st.side); return this.draw(); }
      if (a === 'rundo') { this.keepCmt(); st.path.pop(); this.redo(); return this.draw(); }
      if (a === 'rclear') { st.path = []; st.cmt = {}; this.redo(); return this.draw(); }
      if (a === 'rsave') return this.save();
      if (a === 'ropen') { const c = course(); bpStop(); return bibGo('course', { cid: c.id }); }
      if (a === 'nav:prev') return this.act('rundo');
      if (a === 'nav:first') return this.act('rclear');
    },
    key(k) { if (k === 'prev') this.act('rundo'); }
  };
  return R;
};
/* ---------- livro em PDF convertido pelo Claude ---------- */
let PDFJS = null, BSAMPLE;
const BPDF = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
function bibPdfLib() {
  if (PDFJS) return PDFJS;
  PDFJS = new Promise((res, rej) => {
    const ok = L => { L.GlobalWorkerOptions.workerSrc = BPDF + 'pdf.worker.min.js'; res(L); };
    if (window.pdfjsLib) { ok(window.pdfjsLib); return; }
    const sc = document.createElement('script'); sc.src = BPDF + 'pdf.min.js'; sc.crossOrigin = 'anonymous';
    sc.onload = () => { const L = window.pdfjsLib; if (!L) { PDFJS = null; rej(new Error('pdf')); return; } ok(L); };
    sc.onerror = () => { PDFJS = null; rej(new Error('pdf')); };
    document.head.appendChild(sc);
  });
  return PDFJS;
}
async function bibSample() {
  if (BSAMPLE !== undefined) return BSAMPLE;
  try { BSAMPLE = window.claude && window.claude.use ? await window.claude.use('sample') : null; } catch (e) { BSAMPLE = null; }
  if (BSAMPLE) { try { const l = BSAMPLE.limits ? await BSAMPLE.limits() : null; BSAMPLE.img = !!(l && l.images); } catch (e) { BSAMPLE.img = false; } }
  return BSAMPLE;
}
async function pdfPageText(doc, p) {
  const page = await doc.getPage(p); const tc = await page.getTextContent();
  let s = ''; for (const it of tc.items) { if (it.str == null) continue; s += it.str; s += it.hasEOL ? '\n' : (it.str && !/\s$/.test(it.str) ? ' ' : ''); }
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
async function pdfPageImg(doc, p, w, q) {
  const page = await doc.getPage(p); const v1 = page.getViewport({ scale: 1 });
  const scale = Math.min(2.2, (w || 1150) / v1.width), vp = page.getViewport({ scale });
  const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return new Promise(r => cv.toBlob(b => r(b), 'image/jpeg', q || 0.74));
}
function bibPdfForm() {
  const B = S.bib, rc = B.resume && bibCourse(B.resume), P = B.pdfPick;
  let h = '<section class="card pad stack bib-form" style="gap:14px"><h1 class="h-card" style="font-size:20px">' + (rc ? 'Continuar a conversão' : 'Livro em PDF') + '</h1>';
  h += rc ? '<p class="muted">Selecione de novo o PDF de <b>' + esc(rc.title) + '</b> (' + esc(rc.pdf.name) + '). A conversão continua da página ' + rc.pdf.next + '.</p>'
    : '<p class="muted">O Claude lê o livro por partes e monta o curso: capítulos, explicações, partidas e variantes para aprender lance a lance, e os exercícios do livro para resolver. Você já pode estudar enquanto ele converte o resto.</p>';
  h += '<div class="callout bib-nosample" hidden><b>A conversão usa o Claude</b><span class="muted">Abra o Peão Passado dentro do app Claude (no navegador, no computador ou no celular) para converter livros.</span></div>';
  h += '<div class="field"><label for="bibPdfFile">Arquivo PDF</label><input id="bibPdfFile" type="file" accept="application/pdf,.pdf"></div><div id="bibPdfInfo">' + (P ? bibPdfOpts() : '') + '</div><p class="status" id="bibPdfSt" role="status"></p></section>';
  if (!rc) h += '<p class="muted" style="font-size:12.5px">Use livros que você tem. O arquivo fica no seu aparelho; só o texto e as imagens das páginas vão para o Claude durante a conversão, e o curso fica salvo na sua conta.</p>';
  bibSample().then(sm => { const el = $('#v-biblioteca .bib-nosample'); if (el) el.hidden = !!sm; if (P && sm && !sm.img) { const r = $('#bibPdfImgRow'); if (r) r.hidden = true; } });
  return h;
}
function bibPdfOpts() {
  const P = S.bib.pdfPick, rc = S.bib.resume && bibCourse(S.bib.resume);
  if (rc) return '<div class="bib-pdfi">' + (P.thumb ? '<img src="' + P.thumb + '" alt="">' : '') + '<div class="stack" style="gap:4px"><b>' + esc(P.name) + '</b><span class="muted">' + P.pages + ' páginas</span>' + (P.name !== rc.pdf.name || P.size !== rc.pdf.size ? '<span class="fb hint">Este arquivo parece diferente do original. Se for o mesmo livro, pode continuar.</span>' : '') + '</div></div><button class="btn primary" type="button" data-bib="pdf:resume">Continuar da página ' + rc.pdf.next + '</button>';
  const lowText = P.textRatio < 0.3;
  return '<div class="bib-pdfi">' + (P.thumb ? '<img src="' + P.thumb + '" alt="">' : '') + '<div class="stack" style="gap:4px;min-width:0"><b>' + esc(P.title || P.name) + '</b><span class="muted">' + P.pages + ' páginas' + (lowText ? ' · parece escaneado (pouco texto)' : '') + '</span></div></div>' +
    '<div class="field"><label for="bibPdfTitle">Nome do curso</label><input id="bibPdfTitle" value="' + esc(P.title || P.name.replace(/\.pdf$/i, '')) + '"></div>' +
    '<div class="bib-row2"><div class="field"><label for="bibPdfA">Da página</label><input id="bibPdfA" type="number" min="1" max="' + P.pages + '" value="1" inputmode="numeric"></div><div class="field"><label for="bibPdfB">Até a página</label><input id="bibPdfB" type="number" min="1" max="' + P.pages + '" value="' + P.pages + '" inputmode="numeric"></div></div>' +
    '<div class="field" id="bibPdfImgRow"><span class="label">Diagramas</span><div class="seg" role="group" id="bibPdfImg"><button type="button" data-opt="img" aria-pressed="true">Ler as imagens das páginas</button><button type="button" data-opt="txt" aria-pressed="false">Só o texto</button></div><p class="muted" style="font-size:12.5px">Com as imagens o Claude lê os diagramas e a notação com figurinhas. Mais lento, bem mais preciso.' + (lowText ? ' Este PDF tem pouco texto: deixe as imagens ligadas.' : '') + '</p></div>' +
    '<div class="field"><span class="label">Textos do curso</span><div class="seg" role="group" id="bibPdfLang"><button type="button" data-opt="pt" aria-pressed="true">Em português</button><button type="button" data-opt="orig" aria-pressed="false">No idioma do livro</button></div></div>' +
    '<div class="field"><span class="label">Exercícios</span><div class="seg" role="group" id="bibPdfEx"><button type="button" data-opt="book" aria-pressed="false">Só os do livro</button><button type="button" data-opt="more" aria-pressed="true">Do livro + perguntas de revisão</button></div></div>' +
    '<div class="field"><span class="label">Treinar as variantes de</span><div class="seg" role="group" id="bibPdfSide"><button type="button" data-opt="auto" aria-pressed="true">Como o livro indicar</button><button type="button" data-opt="w" aria-pressed="false">Brancas</button><button type="button" data-opt="b" aria-pressed="false">Pretas</button><button type="button" data-opt="" aria-pressed="false">Só ler</button></div></div>' +
    '<div class="field"><span class="label">Precisão</span><div class="seg" role="group" id="bibPdfQ"><button type="button" data-opt="default" aria-pressed="true">Normal</button><button type="button" data-opt="complex" aria-pressed="false">Máxima (mais lenta)</button></div></div>' +
    '<button class="btn primary" type="button" data-bib="pdf:go">Converter</button>';
}
async function bibPdfPicked(f) {
  const st = $('#bibPdfSt'); if (!f) return;
  if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { st.textContent = 'Escolha um arquivo PDF.'; return; }
  st.textContent = 'Abrindo o PDF…';
  try {
    const L = await bibPdfLib();
    const buf = await f.arrayBuffer();
    const doc = await L.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, useSystemFonts: true }).promise;
    let title = ''; try { const md = await doc.getMetadata(); title = (md && md.info && md.info.Title) || ''; } catch (e) { /* sem metadados */ }
    if (/^(untitled|microsoft word|documento?\d*)/i.test(title) || title.length < 3) title = '';
    // amostra de texto para saber se é escaneado
    let withText = 0; const probe = []; for (let p = 1; p <= Math.min(doc.numPages, 24); p += Math.max(1, Math.floor(doc.numPages / 12))) probe.push(p);
    for (const p of probe) { try { if ((await pdfPageText(doc, p)).length > 200) withText++; } catch (e) { /* página ruim */ } }
    let thumb = ''; try { const b = await pdfPageImg(doc, 1, 220, .7); thumb = URL.createObjectURL(b); } catch (e) { /* sem capa */ }
    S.bib.pdfPick = { name: f.name, size: f.size, doc, pages: doc.numPages, title, thumb, textRatio: probe.length ? withText / probe.length : 1 };
    $('#bibPdfInfo').innerHTML = bibPdfOpts(); st.textContent = '';
    const sm = await bibSample(); if (sm && !sm.img) { const r = $('#bibPdfImgRow'); if (r) r.hidden = true; }
  } catch (e) { st.textContent = 'Não consegui abrir esse PDF' + (e && e.name === 'PasswordException' ? ' (ele tem senha)' : '') + '.'; }
}
async function bibPdfAction(a) {
  const st = $('#bibPdfSt'), P = S.bib.pdfPick; if (!P) return;
  const sm = await bibSample(); if (!sm) { st.textContent = 'A conversão usa o Claude: abra o Peão Passado dentro do app Claude.'; return; }
  if (BIB.conv) { st.textContent = 'Já há um livro sendo convertido. Pause aquele primeiro.'; return; }
  let c, opts;
  if (a === 'resume') {
    c = bibCourse(S.bib.resume); if (!c) return; opts = c.pdf.opts; S.bib.resume = null;
  } else {
    const A = Math.max(1, Math.min(P.pages, +$('#bibPdfA').value || 1)), Bp = Math.max(A, Math.min(P.pages, +$('#bibPdfB').value || P.pages));
    opts = { img: sm.img && bsegVal('bibPdfImg', 'opt') !== 'txt', lang: bsegVal('bibPdfLang', 'opt') || 'pt', ex: bsegVal('bibPdfEx', 'opt') || 'more', side: bsegVal('bibPdfSide', 'opt') == null ? 'auto' : bsegVal('bibPdfSide', 'opt'), tier: bsegVal('bibPdfQ', 'opt') || 'default' };
    c = bnewCourse({ title: (($('#bibPdfTitle').value || '').trim() || P.title || P.name.replace(/\.pdf$/i, '')).slice(0, 120), src: 'pdf', sub: 'Livro em PDF · ' + P.pages + ' páginas', blurb: 'Convertido do PDF pelo Claude. Confira as posições: diagramas lidos de imagem podem ter erros.', side: opts.side === 'w' || opts.side === 'b' ? opts.side : '' });
    c.pdf = { name: P.name, size: P.size, pages: P.pages, from: A, to: Bp, next: A, opts };
    bibAddCourse(c);
  }
  BIB.conv = { cid: c.id, doc: P.doc, per: opts.img ? 2 : 5, stop: false, ctl: null, status: 'Preparando…', live: '', items: 0, fails: 0, started: bnow() };
  bibGo('course', { cid: c.id });
  bibConvRun();
}
function bibConvCard() {
  const cv = BIB.conv; if (!cv) return ''; const c = bibCourse(cv.cid); if (!c || !c.pdf) return '';
  const tot = c.pdf.to - c.pdf.from + 1, done = c.pdf.next - c.pdf.from, f = tot ? done / tot : 0;
  return '<section class="card pad stack bib-conv" id="bibConv" style="gap:10px"><div class="bib-conv-h"><span class="bib-spin" aria-hidden="true"></span><div class="stack" style="gap:2px;min-width:0;flex:1"><span class="label">Convertendo o PDF</span><b>' + esc(c.title) + '</b></div><span class="mono muted">' + Math.round(f * 100) + '%</span></div>' +
    '<div class="bar"><i style="width:' + Math.round(f * 100) + '%;background:var(--accent)"></i></div>' +
    '<p class="muted bib-conv-st">' + esc(cv.status) + ' · ' + cv.items + (cv.items === 1 ? ' item criado' : ' itens criados') + '</p>' +
    (cv.live ? '<p class="bib-live mono">' + esc(cv.live) + '</p>' : '') +
    '<div class="vxacts">' + (S.bib && S.bib.pg === 'course' && S.bib.cid === c.id ? '' : '<button class="btn small" type="button" data-bib="conv:open">Abrir o curso</button>') + '<button class="btn small" type="button" data-bib="conv:stop">Pausar</button></div></section>';
}
let BCONVT = 0;
function bibConvUi(soft) {
  if (soft) { if (BCONVT) return; BCONVT = setTimeout(() => { BCONVT = 0; bibConvUi(); }, 350); return; }
  const el = document.getElementById('bibConv');
  if (!el || S.view !== 'biblioteca') return;
  const h = bibConvCard(); if (!h) { el.remove(); return; }
  const t = document.createElement('div'); t.innerHTML = h; el.replaceWith(t.firstElementChild);
}
function bibConvStop() { const cv = BIB.conv; if (!cv) return; cv.stop = true; try { if (cv.ctl) cv.ctl.abort(); } catch (e) { /* já parado */ } BIB.conv = null; toast('Conversão pausada. Dá para continuar depois.'); if (S.view === 'biblioteca') bibRender(); }
function bibConvPrompt(c, pages, a, b, opts, prevCh) {
  const lang = opts.lang === 'pt' ? 'Escreva títulos, textos, comentários e perguntas em português do Brasil (traduza do original quando preciso), sem perder nuances técnicas.' : 'Mantenha títulos, textos e comentários no idioma original do livro.';
  const ex = opts.ex === 'more' ? 'Além dos exercícios do livro, no fim de cada capítulo (ou trecho grande) crie 1 ou 2 itens "quiz" de revisão sobre as ideias principais, com 3 ou 4 opções.' : 'Não crie perguntas além das que o livro traz.';
  const side = opts.side === 'w' ? 'O leitor treina o repertório de BRANCAS: em linhas de abertura, use side "w".' : opts.side === 'b' ? 'O leitor treina o repertório de PRETAS: em linhas de abertura, use side "b".' : opts.side === '' ? 'Use side "" em todas as linhas (só leitura).' : 'Em "side", use o lado que o livro recomenda ao leitor jogar naquela linha (num livro de repertório de pretas, "b"); em partidas comentadas, o lado vencedor ou o que o autor destaca; "" se for só para ler.';
  return 'Você converte páginas de um livro de xadrez em um curso interativo, no estilo do Chessable.\n' +
    'Livro: "' + c.title + '". Estas são as páginas ' + a + ' a ' + b + ' de ' + c.pdf.pages + '.' + (prevCh ? ' O último capítulo do curso até agora é "' + prevCh + '".' : '') + '\n\n' +
    'Responda SOMENTE com JSON válido, sem texto antes ou depois, neste formato:\n' +
    '{"chapters":[{"title":"...","continues":false,"items":[...]}]}\n\n' +
    'Tipos de item:\n' +
    '- {"type":"text","title":"...","text":"explicação","fen":"FEN da posição discutida (opcional)"}\n' +
    '- {"type":"line","title":"...","intro":"...","fen":"start ou FEN inicial","side":"w|b|","moves":[{"san":"e4","comment":"..."}]}\n' +
    '- {"type":"puzzle","title":"...","fen":"FEN","goal":"o que o leitor deve fazer","solution":["Nf7+","Kg8","Nh6+"],"hint":"...","explain":"..."}\n' +
    '- {"type":"quiz","title":"...","question":"...","options":["...","..."],"answer":0,"why":"..."}\n\n' +
    'Regras:\n' +
    '1. Lances SEMPRE em SAN em inglês (K Q R B N, roque O-O / O-O-O), sem número do lance e sem !? no "san" (avaliações vão no comentário). Converta a notação em português (R D T B C), alemã, figurinhas ou descritiva.\n' +
    '2. "line" é para partidas e variantes: cada variante importante vira um item "line" separado que começa na MESMA posição inicial e repete os lances até o desvio. Comentários curtos, presos ao lance que explicam.\n' +
    '3. ' + side + '\n' +
    '4. FEN exato e legal. "start" = posição inicial; se a partida começa do zero, use "start" e todos os lances. Se uma posição só aparece num diagrama e você não tem certeza absoluta, NÃO invente: use um item "text" sem fen.\n' +
    '5. "puzzle": exercícios, testes e diagramas do tipo "as brancas jogam e ganham". "solution" alterna os lados, começando pelo lado que joga.\n' +
    '6. ' + lang + ' Seja fiel ao autor: resuma passagens longas sem perder as ideias; não invente análise.\n' +
    '7. ' + ex + '\n' +
    '8. Ignore sumário, índice, créditos, propaganda, bibliografia, cabeçalhos e rodapés.\n' +
    '9. Se estas páginas continuam o capítulo anterior, comece com {"title": o mesmo título, "continues": true}.\n' +
    '10. Se não houver conteúdo útil, responda {"chapters":[]}.\n\n' +
    (opts.img ? 'As imagens anexadas são estas mesmas páginas, na ordem. Use-as para ler os diagramas (posições) e a notação; o texto abaixo foi extraído automaticamente e pode ter erros.\n\n' : 'Texto extraído das páginas (pode ter erros de extração; figurinhas de peças podem aparecer como símbolos ou letras estranhas):\n\n') +
    pages.map(p => '<<<PÁGINA ' + p.n + '>>>\n' + (p.t || '(página sem texto extraível)')).join('\n\n');
}
function bibJson(t) {
  if (!t) return null;
  let s = String(t).replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '');
  const i = s.indexOf('{'), j = s.lastIndexOf('}'); if (i < 0 || j < i) return null;
  s = s.slice(i, j + 1);
  try { return JSON.parse(s); } catch (e) { /* tenta consertar */ }
  try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')); } catch (e) { /* cortado no meio */ }
  // resposta cortada: fecha no último item completo
  for (let k = s.lastIndexOf('},'); k > 0; k = s.lastIndexOf('},', k - 1)) {
    try { return JSON.parse(s.slice(0, k + 1) + ']}]}'); } catch (e) { /* recua mais */ }
    if (s.length - k > 60000) break;
  }
  return null;
}
function bibConvItem(x, c, opts) {
  if (!x || typeof x !== 'object') return null;
  const T = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 4000);
  const fenOf = f => { f = T(f, 120); if (!f || /^start/i.test(f)) return BSTART; try { new Chess(f); return f; } catch (e) { return null; } };
  const sideOf = v => opts.side === 'w' || opts.side === 'b' ? opts.side : opts.side === '' ? '' : (v === 'w' || v === 'b' ? v : '');
  const type = String(x.type || '').toLowerCase(), title = T(x.title, 160);
  const asText = (tx, fen) => ({ k: 'c', title: title || 'Leitura', tx: T(tx, 6000), fen: fen || undefined });
  const play = (fen, arr) => {
    let cc; try { cc = new Chess(fen); } catch (e) { return []; }
    const out = [];
    for (const m of arr || []) { const raw = typeof m === 'string' ? m : m && (m.san || m.move); if (!raw) break; const san = PGNLIB.toEN(PGNLIB.clean(String(raw).replace(/^\d+\.+\s*/, ''))); let r = null; try { r = cc.move(san); } catch (e) { r = null; } if (!r) break; const o = { s: r.san }; const cm = m && typeof m === 'object' ? T(m.comment || m.c, 1200) : ''; if (cm) o.c = cm; out.push(o); }
    return out;
  };
  if (type === 'text') { const f = x.fen ? fenOf(x.fen) : null; return x.text ? asText(x.text, f && f !== BSTART ? f : null) : null; }
  if (type === 'line') {
    const fen = fenOf(x.fen || 'start'); const arr = Array.isArray(x.moves) ? x.moves : [];
    if (!fen) return asText((x.intro ? x.intro + '\n\n' : '') + arr.map(m => typeof m === 'string' ? m : m.san).join(' '));
    const mv = play(fen, arr);
    if (!mv.length) return x.intro ? asText(x.intro, fen !== BSTART ? fen : null) : null;
    const side = sideOf(x.side);
    return { k: 'l', title: title || 'Linha', tx: T(x.intro, 3000), fen, side, ask: side ? 'all' : 'none', mv };
  }
  if (type === 'puzzle') {
    const fen = fenOf(x.fen); if (!fen || fen === BSTART) return x.goal || x.explain ? asText([x.goal, x.explain].filter(Boolean).join('\n\n')) : null;
    const sol = play(fen, Array.isArray(x.solution) ? x.solution : []);
    if (!sol.length) return asText([x.goal, x.explain].filter(Boolean).join('\n\n'), fen);
    return { k: 'p', title: title || 'Exercício', fen, sol, goal: T(x.goal, 600) || undefined, hint: T(x.hint, 600) || undefined, idea: T(x.explain, 2000) || undefined };
  }
  if (type === 'quiz') {
    const opts2 = (Array.isArray(x.options) ? x.options : []).map(o => T(o, 300)).filter(Boolean).slice(0, 6), a = +x.answer;
    if (opts2.length < 2 || !(a >= 0 && a < opts2.length)) return null;
    const f = x.fen ? fenOf(x.fen) : null;
    return { k: 'q', title: title || 'Pergunta', q: T(x.question, 800), opts: opts2, a, why: T(x.why, 1200), fen: f && f !== BSTART ? f : undefined };
  }
  return null;
}
function bibConvMerge(c, data, a, b, opts) {
  let added = 0; const chs = (data && Array.isArray(data.chapters)) ? data.chapters : [];
  for (const ch of chs) {
    const t = String(ch.title || '').trim().slice(0, 160); let tgt = null;
    const last = c.ch[c.ch.length - 1];
    if (last && (ch.continues || !t || last.title.toLowerCase() === t.toLowerCase())) tgt = last;
    const items = (Array.isArray(ch.items) ? ch.items : []).map(x => bibConvItem(x, c, opts)).filter(Boolean);
    if (!items.length) continue;
    if (!tgt) { tgt = { id: 'h' + bid(''), title: t || 'Páginas ' + a + '–' + b, it: [] }; c.ch.push(tgt); }
    for (const it of items) { it.id = 'i' + (++c.seq); it.pg = a; tgt.it.push(it); added++; }
  }
  return added;
}
async function bibConvRun() {
  const cv = BIB.conv; if (!cv) return;
  const sm = await bibSample(); const c = bibCourse(cv.cid);
  if (!sm || !c) { BIB.conv = null; return; }
  const opts = c.pdf.opts;
  while (BIB.conv === cv && !cv.stop && c.pdf.next <= c.pdf.to) {
    const a = c.pdf.next, b = Math.min(c.pdf.to, a + cv.per - 1);
    cv.status = 'Lendo as páginas ' + a + (b > a ? '–' + b : ''); cv.live = ''; bibConvUi();
    const pages = [], images = [];
    for (let p = a; p <= b; p++) {
      let t = ''; try { t = await pdfPageText(cv.doc, p); } catch (e) { t = ''; }
      pages.push({ n: p, t: t.slice(0, opts.img ? 9000 : 16000) });
      if (opts.img) { try { const bl = await pdfPageImg(cv.doc, p); if (bl) images.push(bl); } catch (e) { /* sem imagem */ } }
    }
    if (BIB.conv !== cv || cv.stop) return;
    if (pages.every(p => !p.t) && !images.length) { c.pdf.next = b + 1; bibSaveUser(c); continue; }
    const prevCh = c.ch.length ? c.ch[c.ch.length - 1].title : '';
    const prompt = bibConvPrompt(c, pages, a, b, opts, prevCh);
    let res = null, err = null;
    for (let at = 0; at < 3 && !res; at++) {
      cv.ctl = new AbortController();
      try {
        cv.status = 'O Claude está lendo as páginas ' + a + (b > a ? '–' + b : ''); bibConvUi();
        const o = { signal: cv.ctl.signal, modelTier: opts.tier === 'complex' ? 'complex' : 'default', cache: false, onText: x => { const tx = x && x.text || ''; const ts = [...tx.matchAll(/"title"\s*:\s*"([^"]{2,90})"/g)].map(m => m[1]), n = (tx.match(/"type"\s*:/g) || []).length; cv.live = ts.length ? 'Encontrou: ' + ts.slice(-2).join(' · ') + (n ? ' (' + n + (n === 1 ? ' item' : ' itens') + ' nestas páginas)' : '') : ''; bibConvUi(true); } };
        if (images.length) o.images = images;
        res = await sm(prompt, o);
      } catch (e) {
        err = e;
        if (cv.stop || BIB.conv !== cv) return;
        if (e && e.code === 'not_granted') { BIB.conv = null; toast('Sem permissão para usar o Claude: a conversão parou.'); if (S.view === 'biblioteca') bibRender(); return; }
        if (e && e.code === 'rate_limited') { cv.status = 'Muitas páginas seguidas: esperando um pouco'; bibConvUi(); await sleep(20000 * (at + 1)); }
        else await sleep(3000);
      }
    }
    if (BIB.conv !== cv || cv.stop) return;
    let data = res ? bibJson(res.text) : null;
    if (res && res.truncated && cv.per > 1 && (!data || !data.chapters)) { cv.per = 1; continue; }
    if (!data && cv.per > 1) { cv.per = 1; continue; }
    if (!data) { cv.fails++; c.pdf.skipped = (c.pdf.skipped || []).concat([a + (b > a ? '–' + b : '')]); }
    else cv.items += bibConvMerge(c, data, a, b, opts);
    c.pdf.next = b + 1; if (!opts.img && cv.per < 5 && data) cv.per = Math.min(5, cv.per + 1); else if (opts.img && cv.per < 2 && data) cv.per = 2;
    bibSaveUser(c); BFI.delete(c);
    if (S.view === 'biblioteca' && S.bib && S.bib.pg === 'course' && S.bib.cid === c.id) { const y = window.scrollY; bibCoursePage(); window.scrollTo(0, y); }
    else bibConvUi();
  }
  if (BIB.conv === cv) {
    BIB.conv = null;
    toast('Livro convertido: ' + cv.items + ' itens' + (cv.fails ? ' (' + cv.fails + ' trechos não saíram)' : ''));
    try { haptic('ok'); } catch (e) { /* sem vibração */ }
    if (S.view === 'biblioteca') bibRender();
  }
}
