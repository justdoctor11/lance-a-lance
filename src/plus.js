/* =====================================================================
   Rótulos confiáveis (análise funda + Maia), Treino de hoje,
   revisão pós-partida, aberturas do seu repertório e modo foco.
   ===================================================================== */

/* ---------- rótulos confiáveis ----------
   1) Os lances marcados (capivarada, erro, chance perdida, brilhante, ótimo) são
      conferidos com análise ~4x mais longa. raw[0][5] marca a partida como conferida.
   2) Com o Maia pronto, "chance perdida" só fica quando um jogador do seu nível
      acharia o lance; se menos de 10% achariam, vira "chance difícil" e não conta como erro. */
const DEEP_MS = 900, DEEP_K = { blunder: 1, mistake: 1, miss: 1, brill: 1, great: 1 };
const DEEPING = new Map();
const deepDone = raw => !!(raw && raw[0] && raw[0][5]);
const humElo = r => Math.max(1100, Math.min(1900, Math.round((r || 1500) / 100) * 100));
function deepPositions(P) {
  const mv = P.cls.map((c, i) => [c, i]).filter(([c]) => DEEP_K[c.k]).sort((a, b) => b[0].loss - a[0].loss).slice(0, 12).map(x => x[1]);
  const set = new Set(); for (const i of mv) { set.add(i); if (i + 1 < P.fens.length) set.add(i + 1); }
  return [...set].sort((a, b) => a - b);
}
async function deepVerify(g, onProg) {
  if (DEEPING.has(g.id)) return DEEPING.get(g.id);
  const job = (async () => {
    const raw = S.an[g.id]; if (!raw || deepDone(raw)) return 0;
    const P = prep(g); if (!P.cls) return 0;
    const before = P.cls.map(c => c.k), pos = deepPositions(P), out = raw.slice();
    await Engine.init();
    let k = 0;
    for (const j of pos) {
      let c; try { c = new Chess(P.fens[j]); } catch (e) { continue; }
      if (c.isGameOver()) continue;
      const r = await Engine.go(P.fens[j], DEEP_MS);
      if (r && (r.cp != null || r.mate != null)) out[j] = [r.cp, r.mate, r.best, r.pv.join(' '), null, 1];
      k++; if (onProg) onProg(k / pos.length);
    }
    out[0] = (out[0] || [0, null, null, '', null]).slice(0, 5).concat([2]);
    if (S.an[g.id] !== raw) return 0; // outra análise substituiu esta no meio do caminho
    S.an[g.id] = out; MEM.an = MEM.an || {}; MEM.an[g.id] = out; kv.set('an', MEM.an); setTimeout(cloudPushLocalAn, 0);
    attachAnalysis(P); TRAIN = null; gpTouch(g);
    const changed = P.cls ? P.cls.reduce((n, c, i) => n + (c.k !== before[i] ? 1 : 0), 0) : 0;
    (MEM.lblChg = MEM.lblChg || {})[g.id] = changed;
    if (maiaReady()) { try { await humPass(P); } catch (e) { /* segue sem o Maia */ } }
    return changed;
  })();
  DEEPING.set(g.id, job);
  try { return await job; } finally { DEEPING.delete(g.id); }
}
async function humPass(P) {
  if (!maiaReady() || !P || !P.cls) return 0;
  const g = P.g, H = MEM.hum = MEM.hum || {}, h = H[g.id] = H[g.id] || {}, jobs = [];
  P.cls.forEach((c, i) => {
    const m = P.moves[i], eb = P.evs[i]; if (h[i] != null || !eb || !eb.best) return;
    if (c.k === 'miss' || c.k === 'hard' || (m.color === g.c && (c.k === 'great' || c.k === 'brill'))) jobs.push(i);
  });
  for (const i of jobs.slice(0, 20)) {
    const m = P.moves[i], c = P.cls[i], elo = humElo(m.color === g.c ? (g.mR || g.pmR) : (g.oR || g.poR));
    const r = await maiaPredict(P.fens[i], elo), target = c.k === 'miss' || c.k === 'hard' ? P.evs[i].best : c.uci;
    const e = r.pol.find(x => x[0] === target); h[i] = Math.round((e ? e[1] : 0) * 1000) / 10;
  }
  if (jobs.length) { kv.set('hum', H); attachAnalysis(P); TRAIN = null; }
  return jobs.length;
}
/* lança a conferência da partida aberta na Análise e redesenha quando termina */
function labelsTick(P) {
  if (!P || !P.cls) return;
  const g = P.g, again = () => { if (S.view === 'analise' && S.gid === g.id) renderAnalise(); };
  if (!deepDone(S.an[g.id])) { if (!DEEPING.has(g.id) && !ANALYZING.has(g.id)) deepVerify(g).then(again, () => {}); return; }
  const H = (MEM.hum || {})[g.id] || {};
  const pend = P.cls.some((c, i) => H[i] == null && P.evs[i] && P.evs[i].best && (c.k === 'miss' || (P.moves[i].color === g.c && (c.k === 'great' || c.k === 'brill'))));
  if (!pend) return;
  if (maiaReady()) { if (!P.humBusy) { P.humBusy = true; humPass(P).then(n => { P.humBusy = false; if (n) again(); }, () => { P.humBusy = false; }); } }
  else if (MAIA.st === 'off' && store.get('maiaOk', false)) maiaLoad().then(() => { if (maiaReady()) labelsTick(P); });
}
function labelsNote(P) {
  const g = P.g, deep = deepDone(S.an[g.id]), busy = DEEPING.has(g.id), chg = (MEM.lblChg || {})[g.id];
  const H = (MEM.hum || {})[g.id], hard = P.cls.filter(c => c.k === 'hard').length;
  let t = deep ? 'Rótulos conferidos: os lances marcados passaram por uma análise 4 vezes mais longa' + (chg ? ' (' + chg + ' rótulo' + (chg > 1 ? 's mudaram' : ' mudou') + ')' : '') + '.' : busy ? 'Conferindo os rótulos com uma análise mais longa…' : 'Os rótulos ainda vão ser conferidos com uma análise mais longa.';
  if (H) t += ' Rótulos humanos: chances perdidas só contam quando um jogador do seu nível acharia o lance' + (hard ? ' (' + hard + ' virou "chance difícil")' : '') + '.';
  let h = '<p class="lbl-note"><span aria-hidden="true">' + (deep ? '✓' : '…') + '</span>' + esc(t) + '</p>';
  if (!H && deep && MAIA.st !== 'ready' && MAIA.st !== 'loading' && !store.get('maiaOk', false) && P.cls.some(c => c.k === 'miss' || c.k === 'great' || c.k === 'brill'))
    h += '<button class="btn small" type="button" data-maia="load">Ativar rótulos humanos (Maia, download de 58 MB)</button>';
  return h;
}
/* fila em segundo plano: confere as 15 partidas analisadas mais recentes */
let DEEPQ = null;
function deepBacklog() {
  if (DEEPQ) return; DEEPQ = true;
  const run = async () => {
    for (let n = 0; n < 15; n++) {
      const g = analyzedGames().slice().sort((a, b) => b.end - a.end).slice(0, 15).find(x => !deepDone(S.an[x.id]) && !DEEPING.has(x.id) && !ANALYZING.has(x.id));
      if (!g) break;
      while (document.hidden || S.view === 'arena' || ANALYZING.size) await sleep(4000);
      try { await deepVerify(g); } catch (e) { break; }
      if (S.view === 'analise' && S.gid === g.id) renderAnalise();
      await sleep(1500);
    }
    DEEPQ = false;
  };
  setTimeout(run, 20000);
}
setTimeout(() => gpDoneP().then(deepBacklog), 5000);

/* ---------- sessão mista (Treino de hoje e revisão pós-partida) ---------- */
KIND_LAB.mix = 'Sessão de treino';
const MIX_LAB = { due: 'Revisão', pz: 'Seu erro', punish: 'Puna o erro', theory: 'Teoria', rep: 'Repertório', capi: 'Capivarada', crit: 'Momento crítico', idea: 'Sua melhor ideia', opp: 'Erro do adversário' };
function pzItem(p, t) {
  const g = p.gid ? S.games.find(x => x.id === p.gid) : null, P = g ? prep(g) : null;
  const fen = p.fen || (P ? P.fens[p.ply] : null); if (!fen || !p.best) return null;
  const pm = P && p.ply > 0 ? P.moves[p.ply - 1] : null;
  return { t, key: p.key, fen, side: p.side || fen.split(' ')[1], best: p.best, ev: p.ev || (P && P.evs ? P.evs[p.ply] : null), last: p.last || (pm ? [pm.from, pm.to] : null), gid: p.gid, ply: p.ply, played: p.played };
}
async function todayItems() {
  const T = buildTraining(), solved = store.get('solved', {}), srs = store.get('srs', {}), used = new Set();
  const take = (list, n, t) => { const out = []; for (const p of list) { if (out.length >= n) break; if (!p || used.has(p.key)) continue; const it = pzItem(p, t); if (it) { used.add(p.key); out.push(it); } } return out; };
  const due = take(dueList(), 2, 'due');
  const fresh = take(T.puzzles.filter(p => !solved[p.key] && !srs[p.key]), 3, 'pz');
  const pun = take(punishQueue().filter(p => !solved[p.key] && !srs[p.key]), 1, 'punish');
  let rep = [];
  try { await repBuild(); rep = repQueue('all').slice(0, 2).map(k => REPT.byKey.get(k)).filter(Boolean).map(x => ({ t: 'rep', x, fen: x.fen, side: x.c, last: x.last })); } catch (e) { rep = []; }
  const CP = capiPool(), capi = shuffle(CP.own.slice(0, 60)).slice(0, 2).map(it => ({ t: 'capi', it }));
  const seq = [], lanes = [due, fresh.slice(0, 1), rep.slice(0, 1), capi.slice(0, 1), fresh.slice(1, 2), rep.slice(1, 2), fresh.slice(2), capi.slice(1), pun];
  for (const l of lanes) seq.push(...l);
  return seq.slice(0, 10);
}
function postItems(g) {
  const P = prep(g); if (!P.cls) return [];
  const me = g.c, out = [], used = new Set();
  const add = (i, t, best, fen, ev, last) => { if (used.has(i) || !best) return; used.add(i); out.push({ t, fen, side: fen.split(' ')[1], best, ev, last, gid: g.id, ply: i }); };
  const lastOf = i => i > 0 ? [P.moves[i - 1].from, P.moves[i - 1].to] : null;
  // 1) o seu lance mais caro
  let worst = null; P.cls.forEach((c, i) => { if (P.moves[i].color === me && BAD[c.k] && c.k !== 'inacc' && P.evs[i] && P.evs[i].best && (worst == null || c.loss > P.cls[worst].loss)) worst = i; });
  if (worst != null) add(worst, 'pz', P.evs[worst].best, P.fens[worst], P.evs[worst], lastOf(worst));
  // 2) o momento crítico (só um lance segurava)
  const cr = CRIT[g.id];
  if (cr) { let bi = null; cr.forEach((a, i) => { if (a && P.moves[i] && P.moves[i].color === me && a[3] && a[0] >= 15 && !used.has(i) && (bi == null || a[0] > cr[bi][0])) bi = i; }); if (bi != null) add(bi, 'crit', cr[bi][3], P.fens[bi], P.evs[bi], lastOf(bi)); }
  // 3) a sua melhor ideia, ou a punição de um erro do adversário
  let idea = null; P.cls.forEach((c, i) => { if (P.moves[i].color === me && !used.has(i) && (c.k === 'brill' || c.k === 'great') && (idea == null || c.k === 'brill')) idea = i; });
  if (idea != null) add(idea, 'idea', P.cls[idea].uci, P.fens[idea], P.evs[idea], lastOf(idea));
  else { let oe = null; P.cls.forEach((c, i) => { if (P.moves[i].color !== me && (c.k === 'blunder' || c.k === 'mistake') && i + 1 < P.fens.length && P.evs[i + 1] && P.evs[i + 1].best && !used.has(i + 1) && (oe == null || c.loss > P.cls[oe].loss)) oe = i; }); if (oe != null) add(oe + 1, 'opp', P.evs[oe + 1].best, P.fens[oe + 1], P.evs[oe + 1], [P.moves[oe].from, P.moves[oe].to]); }
  if (out.length < 3) { P.cls.forEach((c, i) => { if (out.length < 3 && P.moves[i].color === me && c.k === 'mistake' && !used.has(i) && P.evs[i] && P.evs[i].best) add(i, 'pz', P.evs[i].best, P.fens[i], P.evs[i], lastOf(i)); }); }
  return out.sort((a, b) => a.ply - b.ply);
}
function openMix(mode, gid) {
  stopArenaTimers();
  S.arena = { kind: 'mix', lobby: false, mode, gid, items: null, r: 0, ok: 0, res: [], title: mode === 'post' ? 'Revisão da partida' : 'Treino de hoje' };
  if (location.hash === '#arena') { S.view = ''; route(); } else location.hash = 'arena';
}
ARX.mix = {
  needPrep: true, noLobby: true,
  nav: () => { const m = S.arena && S.arena.mode; return m === 'post' ? 'painel' : m === 'op' ? 'repertorio' : 'treino'; },
  back: () => { const m = S.arena && S.arena.mode; return m === 'post' ? ['#painel', 'Voltar ao painel'] : m === 'op' ? ['#repertorio', 'Voltar ao repertório'] : ['#treino', 'Voltar ao treino']; },
  lobby() { this.start(); },
  start() { const A = S.arena; openMix(A.mode || 'today', A.gid); },
  async build() {
    const A = S.arena; if (A.building) return; A.building = true;
    arBoard(); $('#arClkTop').innerHTML = ''; $('#arClkBot').innerHTML = ''; AR.setLive(null); AR.setArrows([]);
    arHead(A.title, A.mode === 'post' ? 'Três posições da partida, enquanto ela está fresca' : 'Montando a sua sessão…'); $('#arPanel').innerHTML = CALC;
    let items = [];
    try {
      if (A.mode === 'post') { const g = S.games.find(x => x.id === A.gid); if (g) { if (!S.an[g.id]) await analyzeGame(g); items = postItems(g); } }
      else items = await todayItems();
    } catch (e) { items = []; }
    if (S.arena !== A) return;
    A.items = items; A.building = false;
    if (!items.length) { arHead(A.title, ''); acPanel('<p>' + (A.mode === 'post' ? 'Esta partida não tem posições boas para revisar: nenhum erro grave nem momento crítico. Bom sinal.' : 'Nada para treinar agora: analise mais partidas para gerar exercícios.') + '</p><div class="vxacts"><a class="btn small" href="' + this.back()[0] + '">' + this.back()[1] + '</a></div>'); return; }
    this.load();
  },
  load() {
    const A = S.arena, it = A.items[A.r];
    Object.assign(A, { ans: null, first: true, hint: false, alt: null, pick: null });
    if (it.t === 'capi') {
      const g = S.games.find(x => x.id === it.it.gid), P = prep(g), c = it.it;
      it.fen = P.fens[c.ply]; it.side = c.side; it.last = c.ply > 0 ? [P.moves[c.ply - 1].from, P.moves[c.ply - 1].to] : null;
      it.opts = shuffle([{ uci: c.bad, san: c.badSan, bad: true }, { uci: c.good, san: sanOf(it.fen, c.good), bad: false }]);
    }
    this.redraw();
  },
  redraw() {
    const A = S.arena;
    if (!A.items) { this.build(); return; }
    if (!A.items.length) return;
    if (A.over) { AR.setLive(null); return this.panel(); }
    const it = A.items[A.r];
    arHead(A.title, (A.mode === 'post' ? 'Posição ' : 'Item ') + (A.r + 1) + ' de ' + A.items.length);
    AR.setFlip(it.side === 'b'); AR.setPosition(A.ans && A.ans.after ? A.ans.after : it.fen, false);
    AR.setMarks(A.ans && A.ans.marks ? A.ans.marks : it.last ? { last: it.last } : {});
    AR.setArrows(this.arrows());
    if (!A.ans && it.t !== 'capi') this.arm(); else AR.setLive(null);
    this.panel();
  },
  arrows() {
    const A = S.arena, it = A.items[A.r];
    if (it.t === 'capi') return A.pick == null ? it.opts.map((o, k) => ({ from: o.uci.slice(0, 2), to: o.uci.slice(2, 4), cls: k ? 'a-alt' : 'a-cand on' })) : it.opts.map(o => ({ from: o.uci.slice(0, 2), to: o.uci.slice(2, 4), cls: o.bad ? 'a-bad' : 'a-best' }));
    if (A.ans && !A.ans.right) { const b = it.t === 'rep' ? it.x.target.uci : it.best; return b ? [{ from: b.slice(0, 2), to: b.slice(2, 4), cls: 'a-best' }] : []; }
    return [];
  },
  arm() {
    const A = S.arena, it = A.items[A.r], marks = it.last ? { last: it.last } : {};
    if (A.hint) marks.sel = (it.t === 'rep' ? it.x.target.uci : it.best).slice(0, 2);
    AR.setMarks(marks);
    AR.setLive({ color: it.side, dests: () => destsOf(it.fen), marks, onMove: (f, t) => this.move(f, t) });
  },
  async move(from, to) {
    const A = S.arena, it = A.items[A.r]; if (A.ans || A.checking) return;
    const c = new Chess(it.fen); let m; try { m = c.move({ from, to, promotion: 'q' }); } catch (e) { this.arm(); return; }
    const uci = m.from + m.to + (m.promotion || ''), after = c.fen();
    AR.setLive(null); AR.setPosition(after, true);
    let right = false, alt = null;
    if (it.t === 'rep') right = it.x.ok.includes(m.san);
    else if (uci === it.best) right = true;
    else {
      A.checking = true; this.panel('Conferindo com o motor…');
      try { const eb = it.ev || await evalPos(it.fen, 600), ea = await evalPos(after, 600); alt = sideWp(eb, it.side) - sideWp(ea, it.side); } catch (e) { alt = null; }
      A.checking = false; if (S.arena !== A || A.items[A.r] !== it) return;
      right = alt != null && alt < 5;
    }
    if (right) { this.finish(true, { san: m.san, alt: uci !== it.best && it.t !== 'rep', after, marks: { last: [m.from, m.to], ok: m.to } }); return; }
    // errou: mostra, volta e deixa tentar de novo (a primeira tentativa é a que conta)
    if (A.first) { A.first = false; this.record(false); }
    haptic('err'); A.miss = { san: m.san, alt };
    AR.setMarks({ last: [m.from, m.to], bad: m.to }); this.panel();
    setTimeout(() => { if (S.arena !== A || A.items[A.r] !== it || A.ans) return; AR.setPosition(it.fen, true); this.arm(); }, 750);
  },
  finish(right, ans) {
    const A = S.arena, it = A.items[A.r];
    if (A.first) this.record(right);
    A.ans = Object.assign({ right: right && A.first }, ans); A.miss = null;
    if (A.first && right) { A.ok++; haptic('ok'); }
    A.res[A.r] = A.first && right ? 1 : 0;
    AR.setLive(null); this.redraw();
  },
  record(ok) {
    const it = S.arena.items[S.arena.r];
    if (it.t === 'rep') repRecord(it.x.key, ok);
    else if (it.key) { srsRecord(it.key, ok); if (ok) { const s = store.get('solved', {}); s[it.key] = 1; store.set('solved', s); } }
    if (ok) { bumpDaily(); act(it.t === 'rep' ? 'rep' : 'today'); }
  },
  reveal() {
    const A = S.arena, it = A.items[A.r]; if (A.ans) return;
    if (A.first) { A.first = false; this.record(false); }
    const b = it.t === 'rep' ? it.x.target.uci : it.best, c = new Chess(it.fen);
    let m = null; try { m = c.move({ from: b.slice(0, 2), to: b.slice(2, 4), promotion: b[4] || 'q' }); } catch (e) { m = null; }
    A.res[A.r] = 0; A.ans = { right: false, shown: true, san: m ? m.san : b, after: m ? c.fen() : it.fen, marks: m ? { last: [m.from, m.to] } : {} };
    this.redraw();
  },
  explain(it) {
    if (it.t === 'rep') return 'No seu repertório, aqui você joga ' + fig(it.x.target.san) + '.' + (it.x.fix ? ' O motor prefere este lance ao que você costuma jogar.' : '');
    try {
      const ev = it.ev, pv = ev && ev.pv && ev.pv.length && ev.pv[0] === it.best ? ev.pv : [it.best], l = lineSan(it.fen, pv);
      if (!l[0]) return '';
      const why = ideaShort(factsFor(it.fen, l[0].m, it.ply || 0), l[0].m);
      return (why ? cap(why) + '. ' : '') + (l.length > 1 ? 'Linha: ' + l.slice(0, 5).map(x => fig(x.san)).join(' ') + '.' : '');
    } catch (e) { return ''; }
  },
  dots() {
    const A = S.arena;
    return '<div class="mix-dots" aria-hidden="true">' + A.items.map((x, k) => '<i class="' + (k < A.r || (k === A.r && A.ans) ? (A.res[k] ? 'ok' : 'no') : k === A.r ? 'cur' : '') + '"></i>').join('') + '</div>';
  },
  panel(msg) {
    const A = S.arena; if (!A || A.kind !== 'mix') return;
    if (A.over) return this.summary();
    const it = A.items[A.r], lab = MIX_LAB[it.t] || 'Exercício';
    let h = this.dots() + '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span class="mix-tag mix-' + it.t + '">' + lab + '</span><span class="mono muted">' + A.ok + ' acerto' + (A.ok === 1 ? '' : 's') + '</span></div>';
    if (it.t === 'capi') {
      if (A.pick == null) {
        h += '<p><b>' + SIDEC[it.side] + ' jogam.</b> Um destes lances é uma capivarada. Qual?</p><div class="ac-opts">' + it.opts.map((o, k) => '<button type="button" class="ac-opt" data-ar="mxc:' + k + '"><i class="dot ' + (k ? 'b' : 'a') + '"></i><span class="label">' + (k ? 'B' : 'A') + '</span><b class="mono">' + esc(fig(o.san)) + '</b></button>').join('') + '</div>';
      } else {
        const o = it.opts[A.pick], bad = it.opts.find(x => x.bad), good = it.opts.find(x => !x.bad);
        h += '<div class="fb ' + (o.bad ? 'ok' : 'no') + '">' + (o.bad ? 'Isso. ' + esc(fig(bad.san)) + ' era a capivarada.' : 'Não. A capivarada era ' + esc(fig(bad.san)) + '; ' + esc(fig(good.san)) + ' é o melhor lance.') + '</div>' + this.nextBtn();
      }
      return acPanel(h);
    }
    const what = it.t === 'rep' ? 'Jogue o lance do seu repertório.' : it.t === 'idea' ? 'Na partida você achou um ótimo lance aqui. Consegue achar de novo?' : it.t === 'opp' ? 'O adversário acabou de errar. Como punir?' : it.t === 'crit' ? 'Só um lance segura esta posição. Qual?' : it.t === 'punish' ? 'O adversário errou. Ache a punição.' : 'Ache o melhor lance.';
    if (!A.ans) {
      h += '<p><b>' + SIDEC[it.side] + ' jogam.</b> ' + what + '</p>';
      if (msg) h += '<div class="fb hint">' + esc(msg) + '</div>';
      else if (A.miss) h += '<div class="fb no">' + esc(fig(A.miss.san)) + ' não é o lance. ' + (A.miss.alt != null ? 'Sua chance cairia ' + Math.round(A.miss.alt) + ' pontos percentuais. ' : '') + 'Tente de novo.</div>';
      h += '<div class="vxacts"><button class="btn small" type="button" data-ar="mxh"' + (A.hint ? ' disabled' : '') + '>Dica</button><button class="btn small" type="button" data-ar="mxs">Ver resposta</button></div>';
    } else {
      const a = A.ans;
      h += '<div class="fb ' + (a.right ? 'ok' : a.shown ? 'hint' : 'no') + '">' + (a.right ? (a.alt ? esc(fig(a.san)) + ' também funciona: o motor avalia quase igual ao melhor lance.' : 'Isso! ' + esc(fig(a.san)) + '.') : a.shown ? 'A resposta era ' + esc(fig(a.san)) + '.' : 'Resolvido na segunda tentativa: ' + esc(fig(a.san)) + '.') + '</div>';
      const ex = this.explain(it); if (ex) h += '<p style="font-size:14px">' + esc(ex) + '</p>';
      if (it.t === 'pz' && it.played) h += '<p class="muted" style="font-size:13px">Na partida você jogou ' + esc(fig(it.played)) + '.</p>';
      h += this.nextBtn(it);
    }
    acPanel(h);
  },
  nextBtn(it) {
    const A = S.arena;
    return '<div class="vxacts"><button class="btn primary" type="button" data-ar="mxn">' + (A.r + 1 < A.items.length ? 'Próximo' : 'Ver resultado') + '</button>' + (it && it.gid != null && it.ply != null ? '<button class="btn small" type="button" data-openply="' + it.gid + ':' + it.ply + '">Ver na partida</button>' : '') + '</div>';
  },
  summary() {
    const A = S.arena, n = A.items.length, ok = A.ok;
    let h = this.dots() + '<div class="fb ' + (ok >= n * .7 ? 'ok' : 'hint') + '">' + ok + ' de ' + n + (A.mode === 'post' ? ' posições certas' : ' acertos de primeira') + '</div>';
    if (A.mode === 'post') {
      h += '<p>' + (ok === n ? 'Você entendeu os momentos que decidiram a partida.' : 'Os lances que escaparam voltam na revisão espaçada nos próximos dias.') + '</p>';
    } else {
      h += '<p>Treino de hoje concluído. ' + (ok >= n * .7 ? 'Ótima sessão.' : 'O que você errou volta antes na revisão espaçada.') + '</p>';
      const d = done(), nextEnd = ENDS.find(e => !(d['end:' + e.id] && d['end:' + e.id].ok)), les = aulaOrder().find(x => !store.get('aulas', {})[x.a.id]);
      const sug = [];
      if (nextEnd) sug.push('<button class="btn small" type="button" data-ar="open:end">Final do dia: ' + esc(nextEnd.t) + '</button>');
      if (les) sug.push('<a class="btn small" href="#academia" data-acles="' + les.a.id + '">Aula: ' + esc(les.a.t) + '</a>');
      if (sug.length) h += '<div class="stack" style="gap:6px"><span class="label">Para fechar</span><div class="vxacts">' + sug.join('') + '</div></div>';
    }
    h += '<div class="vxacts"><a class="btn primary" href="' + this.back()[0] + '">' + this.back()[1] + '</a>' + (A.mode === 'today' ? '<button class="btn small" type="button" data-ar="mxr">Outra sessão</button>' : '') + '</div>';
    acPanel(h); if (ok >= n * .8 && n >= 3) sparkle($('#arPanel'));
  },
  end() {
    const A = S.arena; A.over = true; AR.setLive(null);
    if (A.mode === 'today') { const t = store.get('today', {}), k = dayKey(new Date()); store.set('today', { d: k, ok: ok0(t, k) + A.ok, n: n0(t, k) + A.items.length, s: (t.d === k ? t.s || 0 : 0) + 1 }); }
    else { const pr = store.get('postRev', {}); pr[A.gid] = Date.now(); const ks = Object.keys(pr); if (ks.length > 300) delete pr[ks[0]]; store.set('postRev', pr); }
    cloudPrefsPush(); renderGoal && $('#trGoal') && renderGoal(); this.panel();
  },
  action(a) {
    const A = S.arena; if (!A.items) return;
    if (a === 'mxr') { openMix('today'); return; }
    if (A.over) return;
    const it = A.items[A.r];
    if (a.startsWith('mxc:')) {
      if (A.pick != null) return; A.pick = +a.slice(4); const right = it.opts[A.pick].bad;
      this.record(right); if (right) { A.ok++; haptic('ok'); } else haptic('err');
      A.res[A.r] = right ? 1 : 0; A.ans = { right }; AR.setArrows(this.arrows()); this.panel(); return;
    }
    if (a === 'mxh') { if (A.ans) return; A.hint = true; if (A.first) { A.first = false; this.record(false); } this.arm(); this.panel(); return; }
    if (a === 'mxs') return this.reveal();
    if (a === 'mxn') { if (!A.ans) return; A.r++; if (A.r < A.items.length) this.load(); else this.end(); }
  }
};
const ok0 = (t, k) => t.d === k ? t.ok || 0 : 0, n0 = (t, k) => t.d === k ? t.n || 0 : 0;
function todayCard() {
  const t = store.get('today', {}), k = dayKey(new Date()), did = t.d === k && t.n;
  return '<section class="card pad today-card"><div class="stack" style="gap:3px;min-width:0"><span class="label">Treino de hoje · cerca de 15 min</span><h2 class="h-card">' + (did ? 'Feito hoje: ' + t.ok + ' de ' + t.n + ' de primeira' : 'Uma sessão misturada, pronta para você') + '</h2><p class="sub">Revisões que venceram, exercícios dos seus erros, repertório e capivaradas, nessa ordem de prioridade.</p></div><button class="btn ' + (did ? '' : 'primary') + '" type="button" data-today>' + (did ? 'Treinar de novo' : 'Começar') + '</button></section>';
}
/* revisão pós-partida: última partida analisada ainda não revista */
function postCandidate() {
  const pr = store.get('postRev', {}), cut = Date.now() / 1000 - 3 * 86400;
  return S.games.slice(0, 5).find(g => g.end >= cut && S.an[g.id] && !pr[g.id]) || null;
}
function postCardHtml() {
  const g = postCandidate(); if (!g) return '';
  const R = resultOf(g);
  return '<div class="post-cta"><span class="post-dot" aria-hidden="true"></span><div class="stack" style="gap:1px;min-width:0"><b>Revisão rápida da partida vs ' + esc(g.opp) + '</b><span class="muted">' + esc(R.label.trim()) + ' · 3 posições em 2 minutos, enquanto ela está fresca</span></div><button class="btn small primary" type="button" data-postrev="' + g.id + '">Revisar</button></div>';
}

/* ---------- aberturas do seu repertório ---------- */
const OP_IDEAS = [
  [/Italiana|Giuoco|Two Knights|Dois Cavalos/i, 'Abertura Italiana', 'O bispo em c4 mira f7, o ponto fraco das pretas. As brancas costumam montar c3 e d4 para tomar o centro; as pretas respondem com ...d6, ...Cf6 e o roque rápido.', ['Não deixe f7 (ou f2) sem defesa nos primeiros lances.', 'c3 + d4 é a ruptura típica das brancas.', 'Com o centro fechado, o jogo passa para o roque e manobras de cavalo (Cbd2-f1-g3).']],
  [/Espanhola|Ruy Lopez/i, 'Abertura Espanhola', 'O bispo em b5 pressiona o cavalo que defende e5. A luta é longa e estratégica: as brancas preparam d4 com c3 e manobram o cavalo da dama pela ala do rei.', ['O lance ...a6 pergunta ao bispo; decida cedo entre recuar e trocar.', 'O ponto e5 é o coração da abertura.', 'Planos de ala da dama (...b5, ...c5) são típicos das pretas.']],
  [/Siciliana|Sicilian/i, 'Defesa Siciliana', 'As pretas trocam o peão c pelo peão d e ganham maioria central. O jogo fica assimétrico: as brancas atacam na ala do rei, as pretas contra-atacam na ala da dama e pela coluna c.', ['Desenvolvimento rápido vale mais que material.', 'A ruptura ...d5 costuma libertar as pretas.', 'Roques em lados opostos: quem ataca primeiro com os peões geralmente vence.']],
  [/Francesa|French/i, 'Defesa Francesa', 'Com ...e6 e ...d5 as pretas aceitam um bispo de casas brancas preso em troca de um centro sólido. As rupturas ...c5 e ...f6 definem o jogo.', ['Ataque a cadeia de peões pela base: ...c5 contra d4.', 'O bispo de c8 é o problema crônico: planeje ...b6 e ...Ba6 ou troque-o.', 'As brancas atacam na ala do rei com o espaço que ganham.']],
  [/Caro.?Kann/i, 'Defesa Caro-Kann', 'Como a Francesa, mas o bispo de casas brancas sai antes de ...e6. Posições sólidas, com finais bons para as pretas.', ['Tire o bispo de c8 antes de fechar com ...e6.', 'Contra o avanço e5, ...c5 é a ruptura principal.', 'Troque peças se estiver mais sólido: os finais favorecem as pretas.']],
  [/Escandinava|Scandinavian/i, 'Defesa Escandinava', 'As pretas atacam e4 logo com ...d5. Depois da troca, a dama vai para a5 ou d6; as pretas ganham desenvolvimento fácil em troca de algum tempo.', ['Não perca mais tempo com a dama: posicione-a e desenvolva.', 'O bispo de c8 costuma ir para f5 ou g4.', 'Estrutura com ...c6 e ...e6 é sólida e simples.']],
  [/Gambito da Dama|Queens? Gambit|Eslava|Slav/i, 'Gambito da Dama', 'As brancas oferecem o peão c4 para desviar o peão d5 do centro. Aceito ou recusado, a luta é pelo controle de e4/e5 e pela coluna c.', ['Aceitar o gambito e segurar o peão costuma sair caro.', 'O lance ...c5 ou ...e5 é a ruptura libertadora das pretas.', 'Minoria de ataque (b4-b5) é um plano clássico das brancas.']],
  [/Londres|London/i, 'Sistema Londres', 'As brancas montam a mesma estrutura quase sempre: d4, Bf4, e3, c3, Cf3, Bd3. Sólido e fácil de jogar; o plano costuma ser Ce5 e ataque na ala do rei.', ['Cuidado com ...Db6 atacando b2 logo no começo.', 'Ce5 com f4 apoia ataque na ala do rei.', 'Do lado preto, ...c5 e ...Cc6 pressionam d4.']],
  [/Inglesa|English/i, 'Abertura Inglesa', 'c4 controla d5 pelo flanco. As brancas jogam devagar, com fianqueto em g2 e pressão na grande diagonal.', ['O bispo de g2 é a peça mais importante: não troque à toa.', 'A ruptura b4-b5 é o plano típico na ala da dama.', 'Contra ...e5, é uma Siciliana com uma cor a mais.']],
  [/Índia do Rei|King.?s Indian|Pirc|Moderna|Modern/i, 'Índia do Rei e Pirc', 'As pretas deixam as brancas montarem o centro e atacam depois, com fianqueto em g7 e as rupturas ...e5 ou ...c5.', ['Não espere demais: sem ...e5 ou ...c5 o centro branco sufoca.', 'O bispo de g7 é o motor da posição.', 'Com o centro fechado, ataque com ...f5 na ala do rei.']],
  [/Escocesa|Scotch/i, 'Abertura Escocesa', 'As brancas abrem o centro cedo com d4. O jogo fica aberto e rápido, com desenvolvimento e ataque direto ao cavalo em d4.', ['Desenvolva com ganho de tempo atacando o cavalo central.', 'Cuidado com garfos na coluna e.', 'Posições abertas premiam o lado mais desenvolvido.']],
  [/Philidor|Petrov|Russa/i, 'Philidor e Petrov', 'Defesas sólidas com ...d6 ou ...Cf6. As pretas aceitam um pouco menos de espaço em troca de uma posição difícil de atacar.', ['Mantenha e5 de pé; abrir o centro cedo costuma favorecer as brancas.', 'Na Petrov, não copie os lances por muito tempo: há armadilhas na coluna e.', 'Planeje ...c5 ou ...f5 para ganhar espaço depois.']],
  [/Vienense|Vienna|Gambito do Rei|King.?s Gambit/i, 'Vienense e Gambito do Rei', 'As brancas preparam f4 para abrir a coluna f e atacar. Posições afiadas, em que tempo vale mais que peões.', ['Rei no centro com a coluna f aberta é perigoso para os dois lados.', 'Devolver material para completar o desenvolvimento costuma ser certo.', 'As pretas aliviam com ...d5 no momento certo.']],
  [/Englund/i, 'Gambito Englund', 'Contra 1.d4 as pretas entregam o peão e5 para abrir linhas e preparar armadilhas, a mais famosa com ...De7 e ...Db4+ ganhando b2. As brancas ficam bem se desenvolverem com calma em vez de caçar mais material.', ['Do lado preto, o gambito vive de armadilhas: contra quem conhece, a compensação é pouca.', 'Do lado branco, cuidado com Bf4 cedo: ...Db4+ ataca b2 e f4 ao mesmo tempo.', 'Devolver o peão para completar o desenvolvimento é perfeitamente bom.']],
  [/Holandesa|Dutch/i, 'Defesa Holandesa', 'Com ...f5 as pretas controlam e4 e preparam ataque na ala do rei, ao custo de alguma fraqueza em e6 e na diagonal h5-e8.', ['Cuidado com Dh5+ e lances na diagonal do rei nos primeiros lances.', 'O plano ...De8-h5 é típico.', 'e4 das brancas é a ruptura a vigiar.']],
  [/Peão da Dama|Queens Pawn|Colle|Torre/i, 'Jogo do Peão da Dama', 'Estruturas com d4 sem c4: desenvolvimento simples e plano de e4 ou de ataque na ala do rei.', ['Prepare e4 com Cbd2 e Bd3.', 'Do lado preto, ...c5 e ...e5 testam o centro.', 'Evite movimentos de peão sem objetivo: desenvolvimento primeiro.']],
  [/Peão do Rei|Kings Pawn|Bishop|Bispo|Ponziani|Center|Centro/i, 'Jogo do Peão do Rei', 'Aberturas com e4 e5 fora das linhas principais. O centro abre rápido e as táticas aparecem cedo.', ['Desenvolva cavalos antes dos bispos.', 'Vigie f7 e f2 nos primeiros lances.', 'Roque cedo quando o centro estiver aberto.']]
];
function opFamily(name) { for (const x of OP_IDEAS) if (x[0].test(name)) return x; return null; }
let OPC = null, OPCK = '';
function myOpenings() {
  const key = dataKey(); if (OPC && OPCK === key) return OPC;
  const fam = new Map();
  for (const g of S.games) {
    const name = opName(g), f = opFamily(name), k = (f ? f[1] : name.split(',')[0].split(':')[0].trim()) + '|' + g.c;
    let o = fam.get(k); if (!o) { o = { k, name: f ? f[1] : name.split(',')[0].split(':')[0].trim(), c: g.c, f, n: 0, pts: 0, games: [], recent: [] }; fam.set(k, o); }
    o.n++; o.pts += rk(g) === 'W' ? 1 : rk(g) === 'D' ? .5 : 0; o.games.push(g);
  }
  const all = [...fam.values()].filter(o => o.n >= 8).sort((a, b) => b.n - a.n).slice(0, 8);
  for (const o of all) {
    o.games.sort((a, b) => b.end - a.end); const r = o.games.slice(0, 20);
    o.recentScore = r.length ? r.reduce((s, g) => s + (rk(g) === 'W' ? 1 : rk(g) === 'D' ? .5 : 0), 0) / r.length : null;
    // seus erros nesta abertura (primeiros 15 lances de cada lado)
    const errs = []; let early = 0, an = 0;
    for (const g of o.games.slice(0, 120)) {
      if (!S.an[g.id]) continue; const P = prep(g); if (!P.cls) continue; an++;
      P.cls.forEach((c, i) => { if (i < 30 && P.moves[i].color === g.c && (c.k === 'blunder' || c.k === 'mistake') && P.evs[i] && P.evs[i].best) { early++; errs.push({ g, i, loss: c.loss, key: g.id + ':' + i }); } });
    }
    o.an = an; o.early = early; o.errs = errs.sort((a, b) => b.loss - a.loss).slice(0, 6);
  }
  OPC = all; OPCK = key; return all;
}
function openingsHtml() {
  const L = myOpenings();
  if (!L.length) return emptyHtml('tree', 'Ainda sem aberturas repetidas', 'Quando uma abertura aparecer em 8 partidas ou mais, ela ganha uma página aqui com as ideias, os planos e os erros que você comete nela.');
  return '<div class="ops-list">' + L.map((o, k) => {
    const sc = Math.round(o.pts / o.n * 100), rs = o.recentScore != null ? Math.round(o.recentScore * 100) : null;
    const tr = rs == null ? '' : rs - sc >= 8 ? '<span class="up">subindo</span>' : sc - rs >= 8 ? '<span class="down">caindo</span>' : '';
    let h = '<details class="op-card"' + (k === 0 ? ' open' : '') + '><summary><span class="stack" style="gap:2px;min-width:0"><b>' + esc(o.name) + '</b><span class="muted">você de ' + SIDE[o.c] + ' · ' + o.n + ' partidas · ' + sc + '% dos pontos ' + tr + '</span></span><span class="op-chev" aria-hidden="true">›</span></summary><div class="stack" style="gap:12px">';
    if (o.f) h += '<p>' + esc(o.f[2]) + '</p><ul class="op-tips">' + o.f[3].map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>';
    else h += '<p class="muted">Ainda não tenho um texto de ideias para esta abertura. Os números e os seus erros abaixo valem do mesmo jeito.</p>';
    if (o.an) h += '<p style="font-size:14px"><b>Nas suas partidas:</b> ' + (o.early ? o.early + ' erro' + (o.early > 1 ? 's' : '') + ' grave' + (o.early > 1 ? 's' : '') + ' nos primeiros 15 lances, em ' + o.an + ' partidas analisadas.' : 'nenhum erro grave nos primeiros 15 lances em ' + o.an + ' partidas analisadas.') + '</p>';
    if (o.errs.length) h += '<div class="moments">' + o.errs.slice(0, 4).map(e => { const P = prep(e.g); return '<button type="button" data-openply="' + e.g.id + ':' + (e.i + 1) + '"><span class="kb k-' + P.cls[e.i].k + '">' + esc(CLS[P.cls[e.i].k].s) + '</span><span class="mono">' + esc(moveNum(e.i) + fig(P.moves[e.i].san)) + '</span><span class="muted">vs ' + esc(e.g.opp) + '</span></button>'; }).join('') + '</div>';
    h += '<div class="vxacts">' + (o.errs.length ? '<button class="btn small primary" type="button" data-opdrill="' + esc(o.k) + '">Treinar os erros desta abertura</button>' : '') + '<button class="btn small" type="button" data-opstats="' + esc(o.k) + '">Ver na árvore</button></div>';
    return h + '</div></details>';
  }).join('') + '</div><p class="muted" style="font-size:12.5px">Os textos de ideias foram escritos para o Peão Passado a partir de princípios conhecidos de cada abertura; os números e os erros vêm das suas partidas.</p>';
}
function opDrill(k) {
  const o = myOpenings().find(x => x.k === k); if (!o || !o.errs.length) return;
  stopArenaTimers();
  const items = o.errs.map(e => { const P = prep(e.g), pm = e.i > 0 ? P.moves[e.i - 1] : null; return { t: 'pz', key: e.key, fen: P.fens[e.i], side: e.g.c, best: P.evs[e.i].best, ev: P.evs[e.i], last: pm ? [pm.from, pm.to] : null, gid: e.g.id, ply: e.i, played: P.moves[e.i].san }; });
  S.arena = { kind: 'mix', lobby: false, mode: 'op', items, r: 0, ok: 0, res: [], title: o.name, gid: null };
  if (location.hash === '#arena') { S.view = ''; route(); } else location.hash = 'arena';
  setTimeout(() => { if (S.arena && S.arena.kind === 'mix' && S.arena.items === items) ARX.mix.load(); }, 0);
}

/* ---------- estados vazios ---------- */
const EMPTY_IC = {
  tree: '<path d="M12 21v-9M12 12 6.5 7M12 12l5.5-5M6.5 7V5M17.5 7V5"/><circle cx="6.5" cy="4" r="1.6"/><circle cx="17.5" cy="4" r="1.6"/><circle cx="12" cy="21" r="1.4"/>',
  board: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 12h17M12 3.5v17"/><rect x="3.5" y="3.5" width="8.5" height="8.5" fill="currentColor" stroke="none" opacity=".18"/><rect x="12" y="12" width="8.5" height="8.5" fill="currentColor" stroke="none" opacity=".18"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  pawn: '<circle cx="12" cy="6.5" r="3"/><path d="M9.5 10.5h5M10.3 11.5c0 3-1.3 5-3.3 6.5h10c-2-1.5-3.3-3.5-3.3-6.5M6 20.5h12"/>'
};
function emptyHtml(ic, title, text, action) {
  return '<div class="empty-st"><span class="empty-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + (EMPTY_IC[ic] || EMPTY_IC.pawn) + '</svg></span><b>' + esc(title) + '</b><p>' + esc(text) + '</p>' + (action || '') + '</div>';
}

/* ---------- modo foco: sai sozinho ao deixar o tabuleiro ---------- */
addEventListener('hashchange', () => { const v = location.hash.slice(1); if (document.documentElement.classList.contains('focus') && v !== 'arena' && v !== 'analise' && v !== 'treino') toggleFocus(false); });

/* ---------- cliques ---------- */
document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-today]')) { openMix('today'); return; }
  const pr = t.closest('[data-postrev]'); if (pr) { openMix('post', pr.dataset.postrev); return; }
  const od = t.closest('[data-opdrill]'); if (od) { opDrill(od.dataset.opdrill); return; }
  const os = t.closest('[data-opstats]'); if (os) { const o = myOpenings().find(x => x.k === os.dataset.opstats); if (o) { const path = []; let node = repTree(o.c); for (const m of o.games[0].mv.split(' ').slice(0, 12)) { if (!node.ch[m] || node.ch[m].n < 3) break; path.push(m); node = node.ch[m]; } REP.c = o.c; REP.path = path; repSec('arvore'); renderRep(); $('#repCard').scrollIntoView({ behavior: 'smooth', block: 'start' }); } return; }
});
