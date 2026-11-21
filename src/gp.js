/* ======================================================================
   Processador de partidas em segundo plano.
   O trabalho pesado de xadrez (reproduzir cada partida lance a lance, contar
   lances legais, conferir sacrifícios e as linhas do motor) roda num Web Worker,
   fora da tela, e o resultado fica guardado no aparelho (IndexedDB "lal-gp").
   A tela só monta os objetos a partir dos dados prontos, em pedaços pequenos.
   ====================================================================== */
var GP_VER = 'gp1';
var GP = { w: null, off: false, key: '', aDone: false, done: false, ready: false, q: [], qRun: false, waiters: [], doneWaiters: [], mk: new Map(), headQ: new Map(), headN: 0, gmap: new Map(), t0: 0 };
var PH_NAME = { a: 'abertura', m: 'meio-jogo', f: 'final' };

/* ---- funções puras usadas dos dois lados (tela e worker) ---- */
function anSig(raw) {
  if (!raw || !raw.length) return '';
  const a = raw[raw.length - 1] || [], b = raw[raw.length >> 1] || [];
  return raw.length + ':' + a[0] + ',' + a[1] + ',' + a[2] + ':' + b[0] + ',' + b[1] + ',' + b[2] + ':' + ((raw[0] && raw[0][5]) || 0);
}
function movesFromRec(R) {
  const n = R.u.length, out = new Array(n);
  for (let i = 0; i < n; i++) {
    const u = R.u[i], f = R.fens[i];
    out[i] = { color: f.charAt(f.indexOf(' ') + 1), from: u.slice(0, 2), to: u.slice(2, 4), piece: R.pc[i], captured: R.cp[i] || undefined, promotion: u.length > 4 ? u.charAt(4) : undefined, flags: R.fl[i], san: R.san[i], lan: u, before: f, after: R.fens[i + 1] };
  }
  return out;
}
function phStr(fens) {
  let s = '';
  for (let i = 0; i < fens.length; i++) { const p = phaseOf(parseBoard(fens[i]), i); s += p === 'final' ? 'f' : p === 'abertura' ? 'a' : 'm'; }
  return s;
}
/* o que a classificação precisa de cálculo de xadrez: lance único (forçado) e sacrifício */
function clsFacts(fens, moves, evs) {
  const forced = [], sac = [];
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i], side = m.color, eb = evs[i], ea = evs[i + 1];
    const b = wpWhite(eb), a = wpWhite(ea), wb = side === 'w' ? b : 100 - b, wa = side === 'w' ? a : 100 - a, loss = Math.max(0, wb - wa);
    const isBest = !!eb && eb.best === m.from + m.to + (m.promotion || '');
    if (!isBest && loss >= 10 && legalCount(fens[i]) === 1) forced.push(i);
    if (loss < 2 && wb < 92 && wa >= 40 && isSac(m, fens[i], ea)) sac.push(i);
  }
  return { forced, sac };
}
/* fatos de um erro seu para o treino: 1 = deixou material pendurado, 2 = havia uma tática */
function trFact(fens, moves, evs, i, me) {
  const m = moves[i], eb = evs[i], ea = evs[i + 1]; let r = 0;
  const rl = lineSan(m.after, ea && ea.pv.length ? ea.pv : (ea && ea.best ? [ea.best] : []));
  if (rl.length) { const R2 = settledSwing(m.after, rl.slice(0, 8), other(me)); if (R2.sure && R2.v >= 2) r |= 1; }
  const bl = lineSan(fens[i], eb && eb.pv.length ? eb.pv : (eb && eb.best ? [eb.best] : []));
  if (bl.length && !isMateFor(eb, me)) { const BF = factsFor(fens[i], bl[0].m, i); if (BF.fork || BF.pins.length || materialSwing(fens[i], bl.slice(0, 6), me) >= 2) r |= 2; }
  return r;
}
function phAt(P, i) { return P.phs ? PH_NAME[P.phs.charAt(i)] : phaseOf(parseBoard(P.fens[i]), i); }
/* prep sem travar: usa o que já está pronto; só reproduz na tela quando o processador já terminou (ou não existe) */
function prepIf(g) { return PREP.get(g.id) || (GP.ready || GP.off ? prep(g) : null); }
function factsOk(P) { return !!(P.facts && P.asig && P.facts.as === P.asig); }

/* ---- o worker ---- */
function gpWorkerMain() {
  let db = null, VER = '', cache = new Map(), items = [], mvs = new Map(), raws = new Map(), pos = 0, aLeft = 0, finished = false, gen = 0, pumping = false, again = false;
  const heads = [];
  const openDb = () => new Promise(res => { try { const r = indexedDB.open('lal-gp', 1); r.onupgradeneeded = () => r.result.createObjectStore('g'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null); } catch (e) { res(null); } });
  const loadAll = () => new Promise(res => {
    const out = new Map(); if (!db) return res(out);
    try { const rq = db.transaction('g').objectStore('g').openCursor(); rq.onsuccess = () => { const c = rq.result; if (c) { if (c.value && c.value.v === VER) out.set(c.key, c.value); c.continue(); } else res(out); }; rq.onerror = () => res(out); } catch (e) { res(out); }
  });
  let dirty = [];
  const flush = () => new Promise(res => {
    const recs = dirty; dirty = []; if (!db || !recs.length) return res();
    try { const t = db.transaction('g', 'readwrite'), st = t.objectStore('g'); for (const r of recs) st.put(r, r.id); t.oncomplete = () => res(); t.onerror = () => res(); t.onabort = () => res(); } catch (e) { res(); }
  });
  function replay(mv) {
    const c = new Chess(), fens = [c.fen()], san = [], u = [], pc = [], cp = [], fl = [], moves = [];
    for (const s of String(mv || '').split(' ')) {
      if (!s) continue; let m = null; try { m = c.move(s); } catch (e) { m = null; } if (!m) break;
      moves.push(m); san.push(m.san); u.push(m.from + m.to + (m.promotion || '')); pc.push(m.piece); cp.push(m.captured || ''); fl.push(m.flags); fens.push(c.fen());
    }
    return { fens, san, u, pc, cp, fl, moves };
  }
  const baseOk = (rec, it) => rec && rec.v === VER && rec.ml === it[1];
  const fullOk = (rec, it) => baseOk(rec, it) && (!it[3] || rec.as === it[3]);
  function build(it) {
    const id = it[0], ml = it[1], c = it[2], sig = it[3];
    let rec = cache.get(id), moves = null;
    if (!baseOk(rec, it)) {
      const R = replay(mvs.get(id));
      rec = { id, v: VER, ml, fens: R.fens, san: R.san, u: R.u, pc: R.pc, cp: R.cp, fl: R.fl, phs: phStr(R.fens), mk: R.fens.length ? mateKind(R.fens[R.fens.length - 1]) : '', as: '', f: null };
      moves = R.moves;
    }
    if (sig && rec.as !== sig) {
      const raw = raws.get(id); rec.as = sig; rec.f = null;
      if (raw && raw.length >= rec.fens.length) {
        if (!moves) moves = movesFromRec(rec);
        const evs = raw.map(evOf), F = clsFacts(rec.fens, moves, evs), fs = new Set(F.forced), tr = {};
        for (let i = 0; i < moves.length; i++) {
          if (moves[i].color !== c || fs.has(i)) continue;
          const eb = evs[i], ea = evs[i + 1], b = wpWhite(eb), a = wpWhite(ea), wb = c === 'w' ? b : 100 - b, wa = c === 'w' ? a : 100 - a;
          if ((!!eb && eb.best === moves[i].lan) || wb - wa < 10) continue;
          tr[i] = trFact(rec.fens, moves, evs, i, c);
        }
        rec.f = { forced: F.forced, sac: F.sac, tr };
      }
    }
    mvs.delete(id); raws.delete(id);
    cache.set(id, rec); dirty.push(rec);
    return rec;
  }
  const slim = rec => ({ id: rec.id, fens: rec.fens, san: rec.san, u: rec.u, pc: rec.pc, cp: rec.cp, fl: rec.fl, phs: rec.phs, as: rec.as, f: rec.f });
  function answerHeads(onlyReady) {
    for (let k = heads.length - 1; k >= 0; k--) {
      if (onlyReady && !heads[k].ids.every(id => cache.has(id))) continue;
      const h = heads.splice(k, 1)[0], out = [];
      for (const id of h.ids) { const r = cache.get(id); if (r) out.push([id, r.fens.slice(0, h.n + 1), r.san.slice(0, h.n), r.u.slice(0, h.n)]); if (out.length >= 100) { postMessage({ t: 'head', tok: h.tok, part: out.splice(0) }); } }
      postMessage({ t: 'head', tok: h.tok, part: out, last: true });
    }
  }
  async function finish() {
    if (finished) return; finished = true;
    await flush();
    const mk = {}; for (const it of items) { if (!it[4]) continue; const r = cache.get(it[0]); if (r && r.mk) mk[it[0]] = r.mk; }
    postMessage({ t: 'done', mk });
    answerHeads();
  }
  async function pump() {
    // processa, na ordem de prioridade, os itens que já têm os dados necessários
    if (pumping) { again = true; return; }
    pumping = true; const my = gen;
    do {
      again = false; let out = [], t = Date.now();
      while (pos < items.length && my === gen) {
        const it = items[pos], rec = cache.get(it[0]);
        if (!fullOk(rec, it)) {
          if ((!baseOk(rec, it) && !mvs.has(it[0])) || (it[3] && !raws.has(it[0]) && !(baseOk(rec, it) && rec.as === it[3]))) break;
          const r = build(it); if (it[3]) out.push(slim(r));
        }
        pos++;
        if (it[3]) aLeft--;
        if (it[3] && aLeft === 0) { if (out.length) { postMessage({ t: 'recs', recs: out }); out = []; } postMessage({ t: 'aDone' }); }
        if (out.length >= 12 || Date.now() - t > 120) { if (out.length) postMessage({ t: 'recs', recs: out }); else postMessage({ t: 'hb' }); out = []; t = Date.now(); if (heads.length) answerHeads(true); if (dirty.length >= 30) await flush(); }
      }
      if (out.length && my === gen) postMessage({ t: 'recs', recs: out });
      if (heads.length) answerHeads(true); // o repertório não precisa esperar as partidas que só servem aos mates
      if (my === gen && pos >= items.length) await finish();
    } while (again && my === gen);
    pumping = false;
  }
  self.onmessage = async e => {
    const d = e.data;
    try {
      if (d.t === 'init') {
        gen++; const my = gen; pumping = false; again = false;
        VER = d.ver; items = d.items; pos = 0; finished = false; mvs.clear(); raws.clear();
        if (!db) db = await openDb();
        if (!cache.size) cache = await loadAll();
        if (my !== gen) return;
        aLeft = items.filter(it => it[3]).length;
        // o que já está pronto vai direto para a tela
        const ready = [], needMv = [], needRaw = [];
        for (const it of items) {
          const rec = cache.get(it[0]);
          if (it[3] && fullOk(rec, it) && !it[5]) ready.push(slim(rec));
          if (!baseOk(rec, it)) needMv.push(it[0]);
          if (it[3] && !(baseOk(rec, it) && rec.as === it[3])) needRaw.push(it[0]);
        }
        for (let k = 0; k < ready.length; k += 20) postMessage({ t: 'recs', recs: ready.slice(k, k + 20) });
        postMessage({ t: 'need', mv: needMv, raw: needRaw, cached: cache.size });
        if (!needMv.length && !needRaw.length) { aLeft = 0; postMessage({ t: 'aDone' }); pos = items.length; await finish(); return; }
        if (!aLeft) postMessage({ t: 'aDone' });
        await pump(); // processa o que não depende de dados da tela
        return;
      }
      if (d.t === 'data') {
        for (const k in d.mv) mvs.set(k, d.mv[k]);
        for (const k in d.raw) raws.set(k, d.raw[k]);
        if (finished) return;
        await pump();
        return;
      }
      if (d.t === 'upd') { // uma partida nova ou uma análise nova, fora da carga inicial
        const it = d.it; if (d.mv) mvs.set(it[0], d.mv); if (d.raw) raws.set(it[0], d.raw);
        const rec = build(it); await flush();
        if (it[3]) postMessage({ t: 'recs', recs: [slim(rec)], upd: true });
        return;
      }
      if (d.t === 'head') { heads.push(d); if (finished) answerHeads(); else answerHeads(true); return; }
    } catch (err) { postMessage({ t: 'err', msg: String(err && err.message || err) }); }
  };
}
function gpSource() {
  const decl = (k, v) => 'const ' + k + ' = ' + (typeof v === 'function' ? v.toString() : JSON.stringify(v)) + ';\n';
  let s = 'self.window = self;\n' + CHESS_SRC + '\n';
  s += decl('V', V) + decl('KN', KN) + decl('KG', KG) + decl('ORTH', ORTH) + decl('DIAG', DIAG) + decl('FILES', FILES);
  s += decl('on', on) + decl('sqI', sqI) + decl('iSq', iSq) + decl('other', other) + decl('isMateFor', isMateFor);
  for (const f of [parseBoard, attackers, hanging, material, nonPawn, phaseOf, pinsFrom, lineSan, materialSwing, legalCount, factsFor, isSac, evOf, wpWhite, settledSwing, mateKind, movesFromRec, phStr, clsFacts, trFact]) s += f.toString() + '\n';
  return s + '(' + gpWorkerMain.toString() + ')();\n';
}

/* ---- o lado da tela ---- */
var yieldMain = () => new Promise(r => setTimeout(r, 0));
function gpItems() {
  const an = S.an, out = [], seen = new Set();
  const push = (g, mate) => {
    if (seen.has(g.id)) return; seen.add(g.id);
    const sig = an[g.id] ? anSig(an[g.id]) : '', P = sig ? PREP.get(g.id) : null;
    out.push([g.id, g.mv.length, g.c, sig, mate ? 1 : 0, P && P.phs && P.facts && P.facts.as === sig ? 1 : 0]);
  };
  for (const g of S.games) if (an[g.id]) push(g, g.oRes === 'checkmated' || g.res === 'checkmated');
  for (const g of S.games.slice(0, REP_GAMES)) push(g, g.oRes === 'checkmated' || g.res === 'checkmated');
  for (const g of S.games) if (g.oRes === 'checkmated' || g.res === 'checkmated') push(g, 1);
  return out;
}
function gpKey() { return acctKey() + ':' + S.games.length + ':' + (S.games[0] ? S.games[0].id : '') + ':' + Object.keys(S.an).length; }
function gpEnsure() {
  if (GP.off || !S.games.length) return false;
  const key = gpKey(); if (GP.w && GP.key === key) return true;
  if (!GP.w) {
    try {
      const url = URL.createObjectURL(new Blob([gpSource()], { type: 'text/javascript' }));
      GP.w = new Worker(url); GP.w.onmessage = gpMsg; GP.w.onerror = e => { gpFail('worker: ' + (e && e.message)); };
    } catch (e) { gpFail('sem worker: ' + (e && e.message)); return false; }
  }
  GP.key = key; GP.aDone = false; GP.done = false; GP.ready = false; GP.gmap = new Map(S.games.map(g => [g.id, g])); GP.t0 = GP.last = performance.now();
  // vigia: se o processador parar de responder, volta ao preparo na tela em vez de deixar a aba esperando
  if (!GP.dog) GP.dog = setInterval(() => { if (GP.off || !GP.w) { clearInterval(GP.dog); GP.dog = 0; return; } if ((!GP.ready || !GP.done) && performance.now() - GP.last > 30000) gpFail('sem resposta'); }, 5000);
  GP.w.postMessage({ t: 'init', ver: GP_VER, items: gpItems() });
  return true;
}
function gpFail(msg) {
  GP.off = true; GP.err = msg; try { if (GP.w) GP.w.terminate(); } catch (e) { /* já parou */ } GP.w = null;
  // sem o worker, volta ao preparo antigo (na tela, em pedaços)
  const ws = GP.waiters.splice(0); if (ws.length) warmPrepLocal().then(() => ws.forEach(f => f()));
  const ds = GP.doneWaiters.splice(0); ds.forEach(f => f());
  for (const [, h] of GP.headQ) h.res(null); GP.headQ.clear();
}
async function gpSendData(d) {
  const mv = d.mv || [], raw = d.raw || [];
  // manda os dados em pedaços pequenos para não travar a tela
  for (let k = 0; k < Math.max(mv.length, raw.length); k += 25) {
    const o = { t: 'data', mv: {}, raw: {} };
    for (const id of mv.slice(k, k + 25)) { const g = GP.gmap.get(id); if (g) o.mv[id] = g.mv; }
    for (const id of raw.slice(k, k + 25)) { const r = S.an[id]; if (r) o.raw[id] = r; }
    if (!GP.w) return; GP.w.postMessage(o); await yieldMain();
  }
}
function gpMsg(e) {
  const d = e.data; GP.last = performance.now();
  if (d.t === 'recs') { GP.q.push(...d.recs); gpDrain(); return; }
  if (d.t === 'aDone') { GP.aDone = true; gpDrain(); return; }
  if (d.t === 'need') { if (d.mv.length || d.raw.length) gpSendData(d); return; }
  if (d.t === 'done') { GP.mk = new Map(Object.entries(d.mk || {})); GP.done = true; GP.doneWaiters.splice(0).forEach(f => f()); return; }
  if (d.t === 'head') { const h = GP.headQ.get(d.tok); if (!h) return; for (const x of d.part) h.map.set(x[0], { fens: x[1], san: x[2], u: x[3] }); if (d.last) { GP.headQ.delete(d.tok); h.res(h.map); } return; }
  if (d.t === 'err') { gpFail(d.msg); }
}
function gpApply(rec) {
  const g = GP.gmap.get(rec.id) || S.games.find(x => x.id === rec.id); if (!g) return;
  const facts = rec.f ? { as: rec.as, forced: new Set(rec.f.forced), sac: new Set(rec.f.sac), tr: rec.f.tr } : (rec.as ? { as: rec.as, forced: new Set(), sac: new Set(), tr: {} } : null);
  const old = PREP.get(rec.id);
  if (old && old.fens.length === rec.fens.length) {
    old.phs = rec.phs; old.facts = facts;
    if (S.an[g.id] && (!old.evs || old.asig !== anSig(S.an[g.id]))) attachAnalysis(old);
    return;
  }
  const P = { g, fens: rec.fens, moves: movesFromRec(rec), evs: null, cls: null, acc: null, phs: rec.phs, facts };
  attachAnalysis(P); PREP.set(rec.id, P);
}
function gpDrain() {
  if (GP.qRun) return; GP.qRun = true;
  const step = () => {
    const t = performance.now();
    while (GP.q.length && performance.now() - t < 6) gpApply(GP.q.shift());
    if (GP.q.length) { setTimeout(step, 0); return; }
    GP.qRun = false;
    if (GP.aDone && !GP.ready) {
      GP.ready = true; TRAIN = null; LISTS = null;
      GP.waiters.splice(0).forEach(f => f());
      // a lista de partidas mostra a precisão assim que fica pronta
      delete VKEY.partidas; if (S.view === 'partidas') renderPartidas();
    }
  };
  setTimeout(step, 0);
}
/* espera as partidas analisadas ficarem prontas (substitui o preparo antigo, que rodava na tela) */
function gpReadyP() {
  if (analyzedReady()) return Promise.resolve();
  if (!gpEnsure()) return warmPrepLocal();
  if (GP.ready && analyzedReady()) return Promise.resolve();
  return new Promise(res => GP.waiters.push(() => { if (analyzedReady()) res(); else warmPrepLocal().then(res); }));
}
function gpDoneP() { if (!gpEnsure()) return Promise.resolve(); if (GP.done) return Promise.resolve(); return new Promise(res => GP.doneWaiters.push(res)); }
/* começo das partidas (para o repertório), sem reproduzir nada na tela */
function gpHeads(ids, n) {
  if (!gpEnsure()) return Promise.resolve(null);
  const tok = ++GP.headN;
  return new Promise(res => { GP.headQ.set(tok, { res, map: new Map() }); GP.w.postMessage({ t: 'head', tok, ids, n }); });
}
/* uma partida mudou (análise nova): o worker recalcula e guarda, sem travar */
function gpTouch(g) {
  if (GP.off || !GP.w || !g) return;
  const it = [g.id, g.mv.length, g.c, S.an[g.id] ? anSig(S.an[g.id]) : '', g.oRes === 'checkmated' || g.res === 'checkmated' ? 1 : 0];
  GP.w.postMessage({ t: 'upd', it, mv: g.mv, raw: S.an[g.id] || null });
}

/* Na primeira vez que um tabuleiro aparece, o navegador monta as imagens das peças e prepara as fontes:
   ~0,2 s num celular médio, de uma vez. Fazemos isso escondido, quando a tela está parada, para a
   1ª visita à Análise ou ao Treino não pagar esse custo. */
function warmPaint() {
  const run = () => {
    try {
      const box = document.createElement('div'); box.setAttribute('aria-hidden', 'true');
      box.style.cssText = 'position:fixed;left:0;top:0;width:120px;pointer-events:none;opacity:.01;z-index:-1;contain:layout paint';
      const bd = document.createElement('div'); bd.style.cssText = 'width:120px;height:120px'; box.appendChild(bd);
      // inclui os símbolos de peça (♘♗♖♕♔), que vêm de uma fonte reserva do sistema: achar essa fonte é caro na 1ª vez
      const t = document.createElement('div'); t.innerHTML = '<p class="mono">0123456789 +−,% ♔♕♖♗♘♙ ½ ★ ✓ ?! !! ·</p><p style="font-weight:500">Aa ♘f3 ♗c4 ★ ✓ ?! !! · — “” é ç ã</p><p><b>Aa ♘♗♖♕♔</b> <span class="label">Aa</span> <span class="muted">Aa</span> <span class="mrow"><span class="n">1.</span><span>e4</span><span>♘f6</span></span></p><p class="coach"><span class="san">♘xe5</span> <span class="ev">+0,5</span></p>'; box.appendChild(t);
      document.body.appendChild(box);
      new Board(bd).setPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', false);
      void box.offsetHeight;
      setTimeout(() => box.remove(), 4000);
    } catch (e) { /* sem problema */ }
  };
  const idle = window.requestIdleCallback ? f => requestIdleCallback(f, { timeout: 6000 }) : f => setTimeout(f, 400);
  setTimeout(() => idle(run), 1800);
}
