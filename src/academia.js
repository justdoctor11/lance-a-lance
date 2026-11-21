/* =====================================================================
   Academia: os treinos que faltavam (Qual é a capivarada?, Memória,
   Calcular ou jogar rápido?, Biblioteca de táticas), aulas, comparação
   com o seu nível, relatório para o treinador, fila de análise e contas.
   ===================================================================== */
const ARX = {};
Object.assign(KIND_LAB, { capi: 'Qual é a capivarada?', mem: 'Memória', tempo: 'Calcular ou jogar rápido?', lib: 'Biblioteca de táticas' });
const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';
const acPanel = h => { $('#arPanel').innerHTML = '<div class="stack" style="gap:14px">' + h + '</div>'; };
const sanOf = (fen, uci) => { const l = lineSan(fen, [uci]); return l[0] ? l[0].san : uci; };
const plu = (n, a, b) => n + ' ' + (n === 1 ? a : b);
function acGames(max) {
  const out = [];
  for (const g of analyzedGames().slice().sort((a, b) => b.end - a.end)) { if (out.length >= (max || 400)) break; const P = prep(g); if (P.cls) out.push(P); }
  return out;
}
function gameMap() { const m = new Map(); for (const g of S.games) m.set(g.id, g); return m; }
function roundHead(A, sc) { return '<div style="display:flex;justify-content:space-between;gap:8px"><span class="label">' + (A.over ? 'Fim da rodada' : 'Posição ' + Math.min(A.r + 1, A.items.length) + ' de ' + A.items.length) + '</span><span class="mono muted">' + sc + '</span></div>'; }

/* ---------- Qual é a capivarada? ----------
   Dois lances da mesma posição: um é o erro que foi jogado, o outro é o melhor lance.
   Treina o reflexo de desconfiar do lance natural antes de soltar a peça. */
function capiPool() {
  const own = [], opp = [];
  for (const P of acGames()) {
    const g = P.g;
    P.cls.forEach((c, i) => {
      if ((c.k !== 'blunder' && c.k !== 'mistake') || c.wb < 25) return;
      const eb = P.evs[i]; if (!eb || !eb.best || eb.best === c.uci) return;
      const m = P.moves[i];
      (m.color === g.c ? own : opp).push({ gid: g.id, ply: i, side: m.color, bad: c.uci, badSan: m.san, good: eb.best, loss: c.loss, mine: m.color === g.c });
    });
  }
  own.sort((a, b) => b.loss - a.loss); opp.sort((a, b) => b.loss - a.loss);
  return { own, opp };
}
ARX.capi = {
  needPrep: true,
  lobby() {
    const st = store.get('capi', {}), P = capiPool(), n = P.own.length + P.opp.length;
    arHead('Qual é a capivarada?', n + ' posições das suas partidas');
    lobbyPreview('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'w');
    acPanel('<p>Cada posição mostra dois lances. Um deles foi um erro de verdade numa partida sua (ou do seu adversário); o outro é o lance que o motor recomenda. Ache a capivarada antes que ela aconteça de novo.</p>' +
      '<ol class="howto"><li>Compare os dois lances, setas A e B.</li><li>Toque no lance que você acha que é o erro.</li><li>Veja por que ele perde e qual era a ideia certa.</li></ol>' +
      (st.n ? '<p class="muted">Rodadas: ' + st.n + ' · acertos: ' + (st.ok || 0) + ' de ' + (st.tot || 0) + ' · melhor rodada: ' + (st.best || 0) + '/10</p>' : '') +
      (n >= 3 ? '<div class="vxacts"><button class="btn primary" type="button" data-ar="go">Começar (10 posições)</button></div>' : '<p class="muted">Analise algumas partidas para gerar posições.</p>'));
  },
  start() {
    stopArenaTimers();
    const P = capiPool(), own = shuffle(P.own.slice(0, 160)).slice(0, 7), opp = shuffle(P.opp.slice(0, 160)).slice(0, 10 - own.length);
    const items = shuffle(own.concat(opp)).slice(0, 10);
    S.arena = { kind: 'capi', lobby: false, items, r: 0, ok: 0, run: 0, bestRun: 0, title: 'Qual é a capivarada?' };
    arBoard(); $('#arClkTop').innerHTML = ''; $('#arClkBot').innerHTML = ''; AR.setLive(null);
    if (!items.length) { arHead('Qual é a capivarada?', ''); acPanel('<p>Analise mais partidas para gerar posições.</p>'); return; }
    this.load();
  },
  load() {
    const A = S.arena, it = A.items[A.r], g = S.games.find(x => x.id === it.gid); if (!g) { A.r++; return A.r < A.items.length ? this.load() : this.over(); }
    const P = prep(g), fen = P.fens[it.ply], pm = it.ply > 0 ? P.moves[it.ply - 1] : null;
    Object.assign(A, { g, P, fen, last: pm ? [pm.from, pm.to] : null, pick: null, opts: shuffle([{ uci: it.bad, san: it.badSan, bad: true }, { uci: it.good, san: sanOf(fen, it.good), bad: false }]) });
    this.redraw();
  },
  arrows() {
    const A = S.arena;
    if (A.pick == null) return A.opts.map((o, k) => ({ from: o.uci.slice(0, 2), to: o.uci.slice(2, 4), cls: k ? 'a-alt' : 'a-cand on' }));
    return A.opts.map(o => ({ from: o.uci.slice(0, 2), to: o.uci.slice(2, 4), cls: o.bad ? 'a-bad' : 'a-best' }));
  },
  redraw() {
    const A = S.arena; if (!A.items || !A.items.length) return this.start();
    if (A.over) return this.panel();
    AR.setFlip(A.items[A.r].side === 'b'); AR.setPosition(A.fen, false); AR.setMarks(A.last ? { last: A.last } : {}); AR.setArrows(this.arrows()); AR.setLive(null);
    arHead(A.title, 'vs ' + A.g.opp + ' · ' + dateLabel(A.g.end, true));
    this.panel();
  },
  panel() {
    const A = S.arena; let h = roundHead(A, A.ok + ' acerto' + (A.ok === 1 ? '' : 's'));
    if (A.over) {
      const rec = A.rec ? ' · novo recorde!' : '';
      h += '<div class="fb ' + (A.ok >= 7 ? 'ok' : 'hint') + '">' + A.ok + ' de ' + A.items.length + rec + '</div><p>' + (A.ok >= 8 ? 'Faro apurado: você reconhece o lance que perde antes de jogá-lo.' : A.ok >= 5 ? 'Bom. As capivaradas que escaparam costumam ser lances naturais que deixam algo sem defesa. Antes de jogar, pergunte: o que muda para o adversário depois deste lance?' : 'Os erros mais caros parecem lances normais. Faça a checagem antes de cada lance: xeques, capturas e ameaças do adversário depois do lance que você quer jogar.') + '</p>' +
        '<p class="muted">Maior sequência de acertos: ' + A.bestRun + '.</p><div class="vxacts"><button class="btn primary" type="button" data-ar="restart">Mais 10 posições</button><a class="btn small" href="#academia" data-acles="checklist">Aula: a checagem antes do lance</a></div>';
      return acPanel(h);
    }
    const it = A.items[A.r];
    if (A.pick == null) {
      h += '<p><b>' + SIDEC[it.side] + ' jogam.</b> Um destes lances é uma capivarada. Qual?</p>';
      h += '<div class="ac-opts">' + A.opts.map((o, k) => '<button type="button" class="ac-opt" data-ar="cpk:' + k + '"><i class="dot ' + (k ? 'b' : 'a') + '"></i><span class="label">' + (k ? 'B' : 'A') + '</span><b class="mono">' + esc(fig(o.san)) + '</b></button>').join('') + '</div>';
      h += '<p class="muted" style="font-size:13px">Seta dourada é o lance A, seta azul é o lance B.</p><div class="vxacts"><button class="btn small" type="button" data-ar="cskip">Pular</button></div>';
    } else {
      const o = A.opts[A.pick], right = o.bad, bad = A.opts.find(x => x.bad), good = A.opts.find(x => !x.bad);
      let why = ''; try { const C = coachFor(A.P, it.ply); why = [C.verdict[0], C.punish[0]].filter(Boolean).join(' '); } catch (e) { why = ''; }
      let idea = ''; try { const l = lineSan(A.fen, [good.uci]); if (l[0]) { const w = ideaShort(factsFor(A.fen, l[0].m, it.ply), l[0].m); if (w) idea = cap(w) + '.'; } } catch (e) { idea = ''; }
      h += '<div class="fb ' + (right ? 'ok' : 'no') + '">' + (right ? 'Isso. ' + esc(fig(bad.san)) + ' era a capivarada.' : 'Não. ' + esc(fig(o.san)) + ' é o melhor lance; a capivarada era ' + esc(fig(bad.san)) + '.') + '</div>';
      h += '<div class="blk"><h3>Por que ' + esc(fig(bad.san)) + ' perde</h3><p>' + esc(why || 'Perde ' + Math.round(it.loss) + ' pontos de chance de vitória.') + '</p></div>';
      h += '<div class="blk"><h3>O certo: ' + esc(fig(good.san)) + '</h3><p>' + esc(idea || 'É o lance que mantém a posição.') + '</p></div>';
      h += '<p class="muted" style="font-size:13px">' + (it.mine ? 'Você jogou ' : 'Seu adversário jogou ') + esc(fig(bad.san)) + ' nesta partida. Setas: verde é o melhor lance, vermelha é o erro.</p>';
      h += '<div class="vxacts"><button class="btn primary" type="button" data-ar="cnx">' + (A.r + 1 < A.items.length ? 'Próxima' : 'Ver resultado') + '</button><button class="btn small" type="button" data-openply="' + it.gid + ':' + it.ply + '">Ver na partida</button></div>';
    }
    acPanel(h);
  },
  over() {
    const A = S.arena; A.over = true; AR.setLive(null);
    const st = store.get('capi', {});
    A.rec = A.ok > (st.best || 0) && (st.n || 0) > 0;
    store.set('capi', { n: (st.n || 0) + 1, ok: (st.ok || 0) + A.ok, tot: (st.tot || 0) + A.items.length, best: Math.max(st.best || 0, A.ok) });
    act('capi'); cloudPrefsPush(); this.panel(); if (A.ok >= 8) sparkle($('#arPanel'));
  },
  action(a) {
    const A = S.arena;
    if (a === 'restart') return this.start();
    if (A.over) return;
    if (a.startsWith('cpk:')) {
      if (A.pick != null) return; A.pick = +a.slice(4); const right = A.opts[A.pick].bad;
      if (right) { A.ok++; A.run++; A.bestRun = Math.max(A.bestRun, A.run); } else A.run = 0;
      haptic(right ? 'ok' : 'err'); AR.setArrows(this.arrows()); this.panel(); return;
    }
    if (a === 'cskip' || a === 'cnx') { A.r++; if (A.r < A.items.length) this.load(); else this.over(); }
  }
};

/* ---------- Memória: visualização ----------
   A posição aparece por alguns segundos, some, e vêm três perguntas sobre ela. */
const PNAME = { p: ['peão', 'o'], n: ['cavalo', 'o'], b: ['bispo', 'o'], r: ['torre', 'a'], q: ['dama', 'a'], k: ['rei', 'o'] };
const pieceName = (c, t, art) => { const [n, g] = PNAME[t]; return (art ? g + ' ' : '') + n + ' ' + (c === 'w' ? (g === 'a' ? 'branca' : 'branco') : (g === 'a' ? 'preta' : 'preto')); };
const MEM_T = [[5, '5 s'], [8, '8 s'], [12, '12 s'], [20, '20 s']];
function memPositions(n) {
  const gs = shuffle(S.games.filter(g => gx(g).n >= 30).slice(0, 400)), out = [];
  for (const g of gs) {
    if (out.length >= n) break;
    const P = prep(g), hi = Math.min(P.fens.length - 2, 56); if (hi < 16) continue;
    for (let k = 0; k < 6; k++) {
      const ply = 14 + Math.floor(Math.random() * (hi - 14)), fen = P.fens[ply], cnt = parseBoard(fen).filter(Boolean).length;
      if (cnt >= 12 && cnt <= 26) { out.push({ fen, gid: g.id, ply, side: g.c }); break; }
    }
  }
  return out;
}
function memQuestions(fen) {
  const B = parseBoard(fen), qs = [], seen = {};
  B.forEach((p, i) => { if (!p) return; const k = p.c + p.t; (seen[k] = seen[k] || []).push(i); });
  const uniq = Object.keys(seen).filter(k => seen[k].length === 1 && k[1] !== 'p').sort((a, b) => 'qrbnk'.indexOf(a[1]) - 'qrbnk'.indexOf(b[1]));
  if (uniq.length) { const k = uniq[Math.min(uniq.length - 1, Math.floor(Math.random() * Math.min(3, uniq.length)))]; qs.push({ t: 'where', q: 'Toque na casa onde estava ' + pieceName(k[0], k[1], true) + '.', ans: seen[k][0] }); }
  const col = Math.random() < .5 ? 'w' : 'b', np = (seen[col + 'p'] || []).length;
  qs.push({ t: 'count', q: 'Quantos peões ' + (col === 'w' ? 'brancos' : 'pretos') + ' havia?', ans: np, opts: [0, 1, 2, 3, 4, 5, 6, 7, 8] });
  const occ = B.map((p, i) => p && p.t !== 'p' && p.t !== 'k' ? i : -1).filter(i => i >= 0), emp = B.map((p, i) => !p ? i : -1).filter(i => i >= 0);
  const useEmpty = Math.random() < .2 && emp.length, sq = useEmpty ? emp[Math.floor(Math.random() * emp.length)] : occ.length ? occ[Math.floor(Math.random() * occ.length)] : null;
  if (sq != null) {
    const p = B[sq], right = p ? pieceName(p.c, p.t) : 'casa vazia';
    const pool = shuffle(['peão branco', 'peão preto', 'cavalo branco', 'cavalo preto', 'bispo branco', 'bispo preto', 'torre branca', 'torre preta', 'dama branca', 'dama preta', 'casa vazia'].filter(x => x !== right));
    qs.push({ t: 'what', q: 'O que havia em ' + iSq(sq) + '?', ans: right, opts: shuffle([right].concat(pool.slice(0, 3))), sq });
  }
  return qs;
}
ARX.mem = {
  needPrep: false,
  lobby() {
    const st = store.get('mem', {}), t = store.get('memT', 8);
    arHead('Memória', 'Visualização: ver, guardar e responder');
    const pos = memPositions(1)[0]; lobbyPreview(pos ? pos.fen : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', pos ? pos.side : 'w');
    acPanel('<p>Calcular é ver o tabuleiro sem mexer as peças. Aqui uma posição das suas partidas aparece por alguns segundos e some. Depois vêm três perguntas: onde estava uma peça, quantos peões havia e o que ocupava uma casa.</p>' +
      '<div class="stack" style="gap:6px"><span class="label">Tempo para memorizar</span><div class="seg" role="group">' + MEM_T.map(([v, l]) => '<button type="button" data-ar="mt:' + v + '" aria-pressed="' + (t === v) + '">' + l + '</button>').join('') + '</div></div>' +
      (st.n ? '<p class="muted">Rodadas: ' + st.n + ' · melhor: ' + (st.best || 0) + '/15</p>' : '') +
      (S.games.length ? '<div class="vxacts"><button class="btn primary" type="button" data-ar="go">Começar (5 posições)</button></div>' : '<p class="muted">Sincronize suas partidas para começar.</p>'));
  },
  lobbyAct(a) { if (a.startsWith('mt:')) { store.set('memT', +a.slice(3)); this.lobby(); return true; } return false; },
  start() {
    stopArenaTimers();
    const items = memPositions(5);
    S.arena = { kind: 'mem', lobby: false, items, r: 0, ok: 0, secs: store.get('memT', 8), title: 'Memória' };
    arBoard(); $('#arClkTop').innerHTML = ''; $('#arClkBot').innerHTML = ''; AR.setLive(null); AR.setArrows([]);
    if (!items.length) { arHead('Memória', ''); acPanel('<p>Não encontrei posições boas nas suas partidas.</p>'); return; }
    this.load();
  },
  load() {
    const A = S.arena, it = A.items[A.r];
    Object.assign(A, { qs: memQuestions(it.fen), qi: 0, got: [], phase: 'look', until: Date.now() + A.secs * 1000, picked: null });
    AR.setFlip(it.side === 'b'); AR.setPosition(it.fen, false); AR.setMarks({}); AR.setArrows([]);
    arHead(A.title, 'Posição ' + (A.r + 1) + ' de ' + A.items.length);
    this.panel(); this.tick();
  },
  tick() {
    stopArenaTimers(); const A = S.arena;
    ARTICK = setInterval(() => {
      if (S.arena !== A || A.phase !== 'look') { stopArenaTimers(); return; }
      if (document.hidden || S.view !== 'arena') { A.until += 250; return; }
      const left = A.until - Date.now(), bar = $('#memBar');
      if (bar) bar.style.transform = 'scaleX(' + Math.max(0, left / (A.secs * 1000)).toFixed(3) + ')';
      if (left <= 0) this.hide();
    }, 250);
  },
  hide() {
    const A = S.arena; if (A.phase !== 'look') return; stopArenaTimers();
    A.phase = 'ask'; AR.setPosition(EMPTY_FEN, false); AR.setMarks({}); haptic('move'); this.panel();
  },
  redraw() {
    const A = S.arena; if (!A.items || !A.items.length) return this.start();
    if (A.over) return this.panel();
    const it = A.items[A.r]; AR.setFlip(it.side === 'b');
    AR.setPosition(A.phase === 'ask' ? EMPTY_FEN : it.fen, false); arHead(A.title, 'Posição ' + (A.r + 1) + ' de ' + A.items.length);
    if (A.phase === 'look') { A.until = Math.max(A.until, Date.now() + 1500); this.tick(); }
    this.panel();
  },
  tap(e) {
    const A = S.arena; if (A.phase !== 'ask' || A.picked != null) return; const q = A.qs[A.qi]; if (!q || q.t !== 'where') return;
    const i = AR.sqAt(e); if (i == null) return; this.answer(i);
  },
  answer(v) {
    const A = S.arena, q = A.qs[A.qi]; if (A.picked != null) return;
    const right = q.t === 'where' ? v === q.ans : String(v) === String(q.ans);
    A.picked = v; A.got.push(right); if (right) A.ok++;
    if (q.t === 'where') AR.setMarks(right ? { ok: iSq(q.ans) } : { bad: iSq(v), ok: iSq(q.ans) });
    else if (q.t === 'what') AR.setMarks(right ? { ok: iSq(q.sq) } : { bad: iSq(q.sq) });
    haptic(right ? 'ok' : 'err'); this.panel();
  },
  next() {
    const A = S.arena; A.picked = null; A.qi++;
    if (A.qi < A.qs.length) { AR.setMarks({}); this.panel(); return; }
    A.phase = 'rev'; AR.setPosition(A.items[A.r].fen, false); AR.setMarks({}); this.panel();
  },
  panel() {
    const A = S.arena, max = A.items.reduce((s, it) => s + 3, 0);
    let h = roundHead(A, A.ok + ' de ' + max);
    if (A.over) {
      h += '<div class="fb ' + (A.ok >= max * .7 ? 'ok' : 'hint') + '">' + A.ok + ' de ' + max + ' respostas certas' + (A.rec ? ' · novo recorde!' : '') + '</div><p>' + (A.ok >= max * .8 ? 'Memória de tabuleiro forte. Diminua o tempo para memorizar e veja até onde vai.' : 'Para guardar uma posição, não decore casa por casa: veja grupos. Onde está cada rei, como estão os peões, quais peças estão fora do lugar. Com o tempo você vai ver a posição como um desenho só.') + '</p><div class="vxacts"><button class="btn primary" type="button" data-ar="restart">Mais 5 posições</button><button class="btn small" type="button" data-ar="lobby">Mudar o tempo</button></div>';
      return acPanel(h);
    }
    if (A.phase === 'look') {
      h += '<p><b>Memorize a posição.</b> Peças, peões e onde estão os reis.</p><div class="ac-timer" aria-hidden="true"><i id="memBar"></i></div><div class="vxacts"><button class="btn small" type="button" data-ar="mhide">Já memorizei</button></div>';
    } else if (A.phase === 'ask') {
      const q = A.qs[A.qi];
      h += '<span class="label">Pergunta ' + (A.qi + 1) + ' de ' + A.qs.length + '</span><p style="font-size:16px"><b>' + esc(q.q) + '</b></p>';
      if (q.t === 'count') h += '<div class="ac-nums">' + q.opts.map(v => '<button type="button" class="btn small' + (A.picked != null && v === q.ans ? ' ok' : A.picked === v ? ' no' : '') + '" data-ar="mans:' + v + '"' + (A.picked != null ? ' disabled' : '') + '>' + v + '</button>').join('') + '</div>';
      if (q.t === 'what') h += '<div class="ac-choices">' + q.opts.map(v => '<button type="button" class="btn small' + (A.picked != null && v === q.ans ? ' ok' : A.picked === v ? ' no' : '') + '" data-ar="mans:' + esc(v) + '"' + (A.picked != null ? ' disabled' : '') + '>' + esc(cap(v)) + '</button>').join('') + '</div>';
      if (q.t === 'where' && A.picked == null) h += '<p class="muted" style="font-size:13px">Toque na casa no tabuleiro.</p>';
      if (A.picked != null) {
        const right = A.got[A.got.length - 1];
        h += '<div class="fb ' + (right ? 'ok' : 'no') + '">' + (right ? 'Certo.' : q.t === 'where' ? 'Era em ' + iSq(q.ans) + '.' : 'Era: ' + esc(String(q.ans)) + '.') + '</div><div class="vxacts"><button class="btn primary" type="button" data-ar="mnext">' + (A.qi + 1 < A.qs.length ? 'Próxima pergunta' : 'Ver a posição') + '</button></div>';
      }
    } else {
      const n = A.got.filter(Boolean).length;
      h += '<div class="fb ' + (n === A.qs.length ? 'ok' : 'hint') + '">' + n + ' de ' + A.qs.length + ' nesta posição.</div><p class="muted">Esta era a posição. Compare com o que você guardou.</p><div class="vxacts"><button class="btn primary" type="button" data-ar="mpos">' + (A.r + 1 < A.items.length ? 'Próxima posição' : 'Ver resultado') + '</button><button class="btn small" type="button" data-openply="' + A.items[A.r].gid + ':' + A.items[A.r].ply + '">Ver na partida</button></div>';
    }
    acPanel(h);
  },
  over() {
    const A = S.arena; A.over = true; stopArenaTimers();
    const st = store.get('mem', {}); A.rec = A.ok > (st.best || 0) && (st.n || 0) > 0;
    store.set('mem', { n: (st.n || 0) + 1, best: Math.max(st.best || 0, A.ok), ok: (st.ok || 0) + A.ok });
    act('mem'); cloudPrefsPush(); this.panel(); if (A.ok >= 13) sparkle($('#arPanel'));
  },
  action(a) {
    const A = S.arena;
    if (a === 'restart') return this.start();
    if (A.over) return;
    if (a === 'mhide') return this.hide();
    if (a.startsWith('mans:')) { const q = A.qs[A.qi]; const v = a.slice(5); return this.answer(q.t === 'count' ? +v : v); }
    if (a === 'mnext') return this.next();
    if (a === 'mpos') { A.r++; if (A.r < A.items.length) this.load(); else this.over(); }
  }
};

/* ---------- Calcular ou jogar rápido? ----------
   Usa os momentos críticos (MultiPV): se só um lance segura, a posição pede cálculo;
   se vários lances empatam com o melhor, gaste pouco relógio. */
function tempoPool() {
  const crit = [], easy = [], M = gameMap();
  for (const gid in CRIT) {
    const g = M.get(gid); if (!g) continue; const P = prep(g); if (!P.cls) continue; const sp = spentList(g);
    CRIT[gid].forEach((a, i) => {
      if (!a || i < 10 || !a[3]) return;
      const it = { gid, ply: i, side: g.c, gap: a[0], second: a[1], wp: a[2], best: a[3], played: P.moves[i].san, k: P.cls[i].k, spent: sp ? sp[i] : null };
      if (a[0] >= 15 && a[2] >= 30) crit.push(it); else if (a[0] <= 3 && a[2] >= 25 && a[2] <= 80) easy.push(it);
    });
  }
  return { crit, easy };
}
function tempoProfile(T) {
  const s = L => { const v = L.filter(x => x.spent != null).map(x => x.spent); return v.length >= 5 ? { avg: avg(v), n: v.length } : null; };
  const c = s(T.crit), e = s(T.easy); if (!c || !e) return '';
  const fmt = x => x < 10 ? x.toFixed(1).replace('.', ',') + ' s' : Math.round(x) + ' s';
  const r = c.avg / Math.max(.5, e.avg);
  return '<div class="ac-tp"><div><span class="label">Momentos críticos</span><b class="mono">' + fmt(c.avg) + '</b><span class="muted">média por lance</span></div><div><span class="label">Lances tranquilos</span><b class="mono">' + fmt(e.avg) + '</b><span class="muted">média por lance</span></div></div><p style="font-size:14px">' +
    (r < 1.3 ? 'Você joga os momentos críticos quase na mesma velocidade dos lances tranquilos. É justamente onde vale gastar relógio.' : r < 2.5 ? 'Você já desacelera nos momentos críticos, mas ainda pouco. Os fortes gastam 3 a 4 vezes mais tempo onde só um lance segura.' : 'Ótimo: você desacelera quando a posição pede.') + '</p>';
}
ARX.tempo = {
  needPrep: true,
  lobby() {
    const st = store.get('tempo', {}), T = tempoPool(), ok = T.crit.length >= 3 && T.easy.length >= 3;
    arHead('Calcular ou jogar rápido?', ok ? T.crit.length + ' momentos críticos e ' + T.easy.length + ' lances tranquilos seus' : 'Gestão de tempo');
    lobbyPreview('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'w');
    let h = '<p>Saber <i>quando</i> pensar vale tanto quanto saber pensar. Em cada posição das suas partidas, decida: ela pede cálculo (só um lance segura) ou dá para jogar rápido (vários lances servem)? Depois o app mostra quanto tempo você gastou ali de verdade.</p>';
    h += tempoProfile(T);
    if (st.n) h += '<p class="muted">Rodadas: ' + st.n + ' · acertos: ' + (st.ok || 0) + ' de ' + (st.tot || 0) + '</p>';
    h += ok ? '<div class="vxacts"><button class="btn primary" type="button" data-ar="go">Começar (10 posições)</button></div>' : '<p class="muted">Este treino usa os momentos críticos das suas partidas. Calcule nas últimas 30 partidas (leva alguns minutos, em segundo plano).</p><div class="vxacts"><button class="btn primary" type="button" data-crit-bulk>Calcular momentos críticos</button></div>';
    acPanel(h);
  },
  start() {
    stopArenaTimers();
    const T = tempoPool(), c = shuffle(T.crit).slice(0, 5), e = shuffle(T.easy).slice(0, 10 - c.length);
    S.arena = { kind: 'tempo', lobby: false, items: shuffle(c.concat(e)), r: 0, ok: 0, title: 'Calcular ou jogar rápido?' };
    arBoard(); $('#arClkTop').innerHTML = ''; $('#arClkBot').innerHTML = ''; AR.setLive(null);
    if (!S.arena.items.length) { arHead(S.arena.title, ''); acPanel('<p>Calcule os momentos críticos primeiro.</p>'); return; }
    this.load();
  },
  load() {
    const A = S.arena, it = A.items[A.r], g = S.games.find(x => x.id === it.gid); if (!g) { A.r++; return A.r < A.items.length ? this.load() : this.over(); }
    const P = prep(g), pm = it.ply > 0 ? P.moves[it.ply - 1] : null;
    Object.assign(A, { g, fen: P.fens[it.ply], last: pm ? [pm.from, pm.to] : null, pick: null });
    this.redraw();
  },
  redraw() {
    const A = S.arena; if (!A.items || !A.items.length) return this.start();
    if (A.over) return this.panel();
    const it = A.items[A.r];
    AR.setFlip(it.side === 'b'); AR.setPosition(A.fen, false); AR.setMarks(A.last ? { last: A.last } : {});
    AR.setArrows(A.pick == null ? [] : [it.second ? { from: it.second.slice(0, 2), to: it.second.slice(2, 4), cls: 'a-alt' } : null, { from: it.best.slice(0, 2), to: it.best.slice(2, 4), cls: 'a-best' }].filter(Boolean));
    arHead(A.title, 'vs ' + A.g.opp + ' · ' + dateLabel(A.g.end, true)); this.panel();
  },
  panel() {
    const A = S.arena; let h = roundHead(A, A.ok + ' acerto' + (A.ok === 1 ? '' : 's'));
    if (A.over) {
      const T = tempoPool();
      h += '<div class="fb ' + (A.ok >= 7 ? 'ok' : 'hint') + '">' + A.ok + ' de ' + A.items.length + '</div><p>' + (A.critMiss ? 'Você tratou ' + plu(A.critMiss, 'momento crítico', 'momentos críticos') + ' como lance tranquilo. Sinais de que a posição pede cálculo: há capturas e xeques no ar, peças atacadas, o rei de alguém exposto ou o adversário acabou de mudar a estrutura.' : 'Você reconheceu todos os momentos críticos desta rodada.') + '</p>' + tempoProfile(T) + '<div class="vxacts"><button class="btn primary" type="button" data-ar="restart">Mais 10 posições</button><a class="btn small" href="#academia" data-acles="relogio">Aula: tempo é material</a></div>';
      return acPanel(h);
    }
    const it = A.items[A.r], crit = it.gap >= 15;
    if (A.pick == null) {
      h += '<p><b>' + SIDEC[it.side] + ' jogam.</b> Esta posição pede cálculo ou dá para jogar rápido?</p><div class="ac-opts"><button type="button" class="ac-opt" data-ar="tpk:c"><span class="label">Só um lance segura</span><b>Calcular</b></button><button type="button" class="ac-opt" data-ar="tpk:e"><span class="label">Vários lances servem</span><b>Jogar rápido</b></button></div>';
    } else {
      const right = (A.pick === 'c') === crit, bs = fig(sanOf(A.fen, it.best)), ss = it.second ? fig(sanOf(A.fen, it.second)) : '';
      h += '<div class="fb ' + (right ? 'ok' : 'no') + '">' + (right ? 'Certo. ' : 'Não. ') + (crit ? 'Momento crítico.' : 'Lance tranquilo.') + '</div>';
      h += '<p>' + (crit ? 'Só ' + esc(bs) + ' segura. O segundo melhor lance' + (ss ? ' (' + esc(ss) + ')' : '') + ' já perde ' + it.gap + ' pontos de chance de vitória.' : 'O melhor lance (' + esc(bs) + ') e o segundo' + (ss ? ' (' + esc(ss) + ')' : '') + ' ficam a ' + plu(Math.max(0, it.gap), 'ponto', 'pontos') + ' de distância. Qualquer lance razoável serve: poupe o relógio.') + '</p>';
      if (it.spent != null) h += '<p class="muted" style="font-size:13.5px">Na partida você gastou <b>' + (it.spent < 10 ? String(it.spent) : Math.round(it.spent)) + ' s</b> aqui e jogou ' + esc(fig(it.played)) + ' (' + esc(CLS[it.k].t.toLowerCase()) + ').' + (crit && it.spent < 8 ? (it.k === 'best' || it.k === 'great' || it.k === 'exc' || it.k === 'brill' ? ' Acertou, mas com pouco tempo para um momento assim.' : ' Pouco tempo para um momento assim.') : !crit && it.spent > 40 ? ' Tempo demais para um lance tranquilo.' : '') + '</p>';
      else h += '<p class="muted" style="font-size:13.5px">Na partida você jogou ' + esc(fig(it.played)) + ' (' + esc(CLS[it.k].t.toLowerCase()) + ').</p>';
      h += '<div class="vxacts"><button class="btn primary" type="button" data-ar="tnx">' + (A.r + 1 < A.items.length ? 'Próxima' : 'Ver resultado') + '</button><button class="btn small" type="button" data-openply="' + it.gid + ':' + it.ply + '">Ver na partida</button></div>';
    }
    acPanel(h);
  },
  over() {
    const A = S.arena; A.over = true; const st = store.get('tempo', {});
    store.set('tempo', { n: (st.n || 0) + 1, ok: (st.ok || 0) + A.ok, tot: (st.tot || 0) + A.items.length });
    act('tempo'); cloudPrefsPush(); this.panel();
  },
  action(a) {
    const A = S.arena;
    if (a === 'restart') return this.start();
    if (A.over) return;
    if (a.startsWith('tpk:')) {
      if (A.pick != null) return; const it = A.items[A.r], crit = it.gap >= 15; A.pick = a.slice(4);
      const right = (A.pick === 'c') === crit; if (right) A.ok++; else if (crit) A.critMiss = (A.critMiss || 0) + 1;
      haptic(right ? 'ok' : 'err'); this.redraw(); return;
    }
    if (a === 'tnx') { A.r++; if (A.r < A.items.length) this.load(); else this.over(); }
  }
};

/* ---------- Biblioteca de táticas (banco aberto do Lichess, CC0) ---------- */
/*@PUZ@*/
let PUZ = null;
function puzList() {
  if (PUZ) return PUZ;
  PUZ = PUZ_RAW.split('\n').map(l => { const [id, fen, mv, r, th] = l.split(';'); return { id, fen, mv: mv.split(' '), r: +r, th: th || '' }; });
  return PUZ;
}
const LIB_TH = [['', 'Todos'], ['me', 'Para você'], ['m', 'Mate'], ['g', 'Garfo'], ['c', 'Cravada e espeto'], ['d', 'Descoberto'], ['s', 'Peça solta'], ['x', 'Sacrifício e desvio'], ['k', 'Ataque ao rei'], ['f', 'Defesa'], ['q', 'Lance silencioso'], ['e', 'Finais'], ['p', 'Peão avançado'], ['a', 'Abertura']];
const LIB_NAME = Object.fromEntries(LIB_TH.filter(x => x[0].length === 1));
const PRIO_TH = { hang: 'sg', tactic: 'gcd', mate: 'm', middle: 'xk', opening: 'a', endgame: 'ep', time: '' };
function libMine() {
  let s = ''; try { for (const p of buildTraining().prios.slice(0, 2)) s += PRIO_TH[p.k] || ''; } catch (e) { s = ''; }
  return s || 'sgm';
}
function libRating() {
  let r = store.get('libR', null); if (r) return r;
  const rs = S.games.filter(g => g.mR && (g.tc === 'blitz' || g.tc === 'rapid')).slice(0, 40).map(g => g.mR).sort((a, b) => a - b);
  r = rs.length ? rs[rs.length >> 1] : 1200; return Math.max(600, Math.min(2300, Math.round(r / 10) * 10));
}
function libPick(th) {
  const R = libRating(), done = store.get('libDone', {}), want = th === 'me' ? libMine() : th;
  const okTh = p => !want || [...want].some(ch => p.th.includes(ch));
  const L = puzList();
  for (const [w, fresh] of [[120, true], [220, true], [400, true], [400, false], [3000, false]]) {
    const c = L.filter(p => Math.abs(p.r - R) <= w && okTh(p) && (!fresh || !done[p.id]));
    if (c.length) return c[Math.floor(Math.random() * c.length)];
  }
  return L[Math.floor(Math.random() * L.length)];
}
function libStats() {
  const d = store.get('libDone', {}), v = Object.values(d);
  return { n: v.length, ok: v.filter(x => x === 1).length };
}
ARX.lib = {
  needPrep: false,
  lobby() {
    const th = store.get('libTh', 'me'), R = libRating(), st = libStats(), sc = store.get('libSc', {});
    arHead('Biblioteca de táticas', puzList().length.toLocaleString('pt-BR') + ' puzzles por tema e dificuldade');
    lobbyPreview(puzList()[0].fen, 'w');
    const weak = Object.entries(sc).filter(([k, v]) => v[1] >= 6 && LIB_NAME[k]).map(([k, v]) => [k, v[0] / v[1]]).sort((a, b) => a[1] - b[1]).slice(0, 2);
    acPanel('<p>Puzzles de partidas reais, para treinar padrões que ainda não apareceram nos seus jogos. A dificuldade acompanha o seu rating de puzzles: acerte e ele sobe; erre e ele desce.</p>' +
      '<div class="ac-rt"><div><span class="label">Seu rating de puzzles</span><b class="mono">' + R + '</b></div><div><span class="label">Resolvidos</span><b class="mono">' + st.ok + '<small>/' + st.n + '</small></b></div></div>' +
      '<div class="stack" style="gap:6px"><span class="label">Tema</span><div class="chips">' + LIB_TH.map(([k, t]) => '<button type="button" class="chip" data-ar="lth:' + k + '" aria-pressed="' + (th === k) + '">' + t + '</button>').join('') + '</div>' + (th === 'me' ? '<p class="muted" style="font-size:12.5px">Para você: ' + esc([...libMine()].map(c => LIB_NAME[c]).filter(Boolean).join(', ')) + ', a partir dos erros mais comuns nas suas partidas.</p>' : '') + '</div>' +
      (weak.length ? '<p class="muted" style="font-size:13px">Temas em que você mais erra aqui: ' + weak.map(([k, f]) => esc(LIB_NAME[k]) + ' (' + Math.round(f * 100) + '% de acerto)').join(', ') + '.</p>' : '') +
      '<div class="vxacts"><button class="btn primary" type="button" data-ar="go">Começar</button></div><p class="muted" style="font-size:12px">Puzzles do banco aberto do Lichess (domínio público, CC0).</p>');
  },
  lobbyAct(a) { if (a.startsWith('lth:')) { store.set('libTh', a.slice(4)); this.lobby(); return true; } return false; },
  start() {
    stopArenaTimers();
    S.arena = { kind: 'lib', lobby: false, n: 0, ok: 0, run: 0, title: 'Biblioteca de táticas', th: store.get('libTh', 'me') };
    arBoard(); $('#arClkTop').innerHTML = ''; $('#arClkBot').innerHTML = ''; this.load();
  },
  load() {
    const A = S.arena, p = libPick(A.th), c = new Chess(p.fen);
    Object.assign(A, { p, fen: p.fen, k: 0, fail: false, hint: false, done: false, msg: '', last: null, side: c.turn() === 'w' ? 'b' : 'w', d: null });
    AR.setLive(null); AR.setArrows([]); AR.setFlip(A.side === 'b'); AR.setPosition(p.fen, false); AR.setMarks({});
    arHead(A.title, 'Você joga de ' + SIDE[A.side]); this.panel();
    const tok = A.tok = {}; setTimeout(() => { if (S.arena === A && A.tok === tok) this.reply(); }, 650);
  },
  play(uci, anim) {
    const A = S.arena, c = new Chess(A.fen); let m; try { m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined }); } catch (e) { return null; }
    A.fen = c.fen(); A.last = [m.from, m.to]; AR.setPosition(A.fen, anim !== false); return { m, c };
  },
  reply() {
    const A = S.arena; if (A.k >= A.p.mv.length) return this.solved();
    this.play(A.p.mv[A.k]); A.k++; this.arm();
  },
  arm() {
    const A = S.arena, marks = A.last ? { last: A.last } : {};
    if (A.hint && A.k < A.p.mv.length) marks.sel = A.p.mv[A.k].slice(0, 2);
    AR.setMarks(marks);
    if (A.done || A.k >= A.p.mv.length) { AR.setLive(null); return; }
    AR.setLive({ color: A.side, dests: () => destsOf(A.fen), marks, onMove: (f, t) => this.move(f, t) });
  },
  move(from, to) {
    const A = S.arena; if (A.done) return;
    const want = A.p.mv[A.k], uci = from + to + (want && want.slice(0, 4) === from + to && want[4] ? want[4] : '');
    const c = new Chess(A.fen); let m; try { m = c.move({ from, to, promotion: uci[4] || 'q' }); } catch (e) { this.arm(); return; }
    const last = A.k === A.p.mv.length - 1;
    if (uci === want || (want && from + to === want.slice(0, 4)) || (last && c.isCheckmate())) {
      this.play(m.from + m.to + (m.promotion || ''), true); A.k++; haptic('move');
      if (A.k >= A.p.mv.length) return this.solved();
      A.msg = 'ok'; this.panel(); AR.setLive(null);
      const tok = A.tok = {}; setTimeout(() => { if (S.arena === A && A.tok === tok) { this.reply(); this.panel(); } }, 380);
      return;
    }
    // lance errado: mostra e volta
    const back = A.fen; this.play(m.from + m.to + (m.promotion || ''), true); haptic('err');
    if (!A.fail) { A.fail = true; this.rate(0); }
    A.msg = 'no'; AR.setLive(null); this.panel();
    const tok = A.tok = {}; setTimeout(() => { if (S.arena !== A || A.tok !== tok) return; A.fen = back; AR.setPosition(back, true); this.arm(); }, 700);
  },
  rate(score) {
    const A = S.arena, R = libRating(), n = libStats().n, K = n < 15 ? 40 : n < 60 ? 28 : 18;
    const E = 1 / (1 + Math.pow(10, (A.p.r - R) / 400)), nr = Math.max(400, Math.min(3000, Math.round(R + K * (score - E))));
    store.set('libR', nr); A.d = nr - R;
    const d = store.get('libDone', {}); d[A.p.id] = score ? 1 : 0; store.set('libDone', d);
    const sc = store.get('libSc', {}); for (const ch of A.p.th) { const v = sc[ch] = sc[ch] || [0, 0]; v[1]++; if (score) v[0]++; } store.set('libSc', sc);
    cloudPrefsPush();
  },
  solved() {
    const A = S.arena; A.done = true; AR.setLive(null); AR.setMarks(A.last ? { last: A.last, ok: A.last[1] } : {});
    if (!A.fail) { this.rate(1); A.ok++; A.run++; haptic('ok'); act('lib'); if (A.run && A.run % 5 === 0) sparkle($('#arPanel')); } else A.run = 0;
    A.n++; A.msg = ''; this.panel();
  },
  async solution() {
    const A = S.arena; if (A.done) return; if (!A.fail) { A.fail = true; this.rate(0); }
    A.done = true; AR.setLive(null); this.panel();
    while (S.arena === A && A.k < A.p.mv.length) { await sleep(620); if (S.arena !== A) return; this.play(A.p.mv[A.k]); A.k++; AR.setMarks({ last: A.last }); }
    A.n++; A.run = 0; this.panel();
  },
  redraw() {
    const A = S.arena; if (!A.p) return this.start();
    AR.setFlip(A.side === 'b'); AR.setPosition(A.fen, false); arHead(A.title, 'Você joga de ' + SIDE[A.side]); this.arm(); this.panel();
  },
  panel() {
    const A = S.arena; if (!A || A.kind !== 'lib') return;
    let h = '<div style="display:flex;justify-content:space-between;gap:8px"><span class="label">Rating ' + libRating() + (A.d != null ? ' <span class="' + (A.d >= 0 ? 'up' : 'down') + '">' + (A.d >= 0 ? '+' : '−') + Math.abs(A.d) + '</span>' : '') + '</span><span class="mono muted">' + A.ok + '/' + A.n + (A.run >= 2 ? ' · ' + A.run + ' seguidos' : '') + '</span></div>';
    if (!A.done) {
      h += '<p><b>' + SIDEC[A.side] + ' jogam.</b> ' + (A.msg === 'no' ? 'Não é esse lance. Tente de novo.' : A.msg === 'ok' ? 'Isso. Continue.' : 'Ache a melhor continuação.') + '</p>';
      if (A.msg === 'no') h += '<div class="fb no">Errar uma vez já conta como erro para o rating, mas você pode continuar tentando.</div>';
      h += '<div class="vxacts"><button class="btn small" type="button" data-ar="lhint"' + (A.hint ? ' disabled' : '') + '>Dica</button><button class="btn small" type="button" data-ar="lsol">Ver solução</button><button class="btn small" type="button" data-ar="lskip">Pular</button></div>';
    } else {
      const th = [...A.p.th].map(c => LIB_NAME[c]).filter(Boolean);
      h += '<div class="fb ' + (A.fail ? 'hint' : 'ok') + '">' + (A.fail ? 'Esta não saiu. Veja a solução no tabuleiro.' : 'Resolvido!') + '</div>';
      h += '<p class="muted" style="font-size:13.5px">Puzzle de rating ' + A.p.r + (th.length ? ' · ' + esc(th.join(', ')) : '') + '.</p>';
      h += '<div class="vxacts"><button class="btn primary" type="button" data-ar="lnext">Próximo puzzle</button><a class="btn small" href="https://lichess.org/training/' + esc(A.p.id) + '" target="_blank" rel="noopener">Ver no Lichess</a><button class="btn small" type="button" data-ar="lobby">Trocar tema</button></div>';
    }
    acPanel(h);
  },
  action(a) {
    const A = S.arena;
    if (a === 'restart') return this.start();
    if (a === 'lhint') { if (A.done) return; A.hint = true; if (!A.fail) { A.fail = true; this.rate(0); } this.arm(); this.panel(); return; }
    if (a === 'lsol') return this.solution();
    if (a === 'lskip') { if (!A.done) { A.n++; A.run = 0; } return this.load(); }
    if (a === 'lnext') return this.load();
  }
};
function openLib(th) { if (th != null) store.set('libTh', th); openArena('lib'); }

/* ---------- Aulas: textos originais, com exemplo tirado das suas partidas ---------- */
const AULAS = [
  { id: 'solta', k: 'hang', t: 'Peça solta, peça perdida', lead: 'O erro mais comum em todos os níveis: deixar uma peça sem defesa ou numa casa atacada.',
    p: ['Quase toda partida abaixo de 1800 é decidida por material entregue de graça, não por estratégia. A boa notícia é que esse erro tem cura mecânica: ele acontece quando a gente olha só para o próprio plano.',
      'Uma peça está solta quando nenhuma peça sua a defende. Ela não está perdida ainda, mas qualquer ataque duplo, xeque com ataque ou descoberta a derruba. Uma peça está pendurada quando, além de solta, já está atacada.',
      'O hábito que resolve: antes de soltar a peça, olhe para a casa de destino e conte quem ataca e quem defende. Depois olhe para trás: a peça que saiu defendia alguma coisa?'],
    rules: ['Peça sem defensor é alvo; mantenha as peças protegidas umas pelas outras.', 'Depois de cada lance do adversário, pergunte o que ele ataca agora.', 'Ao mover uma peça, confira o que ela deixou de defender.'],
    go: [['data-ar="open:capi"', 'Qual é a capivarada?'], ['data-ar="open:xray"', 'Raio-X da peça']] },
  { id: 'checklist', k: 'tactic', t: 'A checagem antes do lance', lead: 'Uma rotina de cinco segundos que evita a maior parte das capivaradas.',
    p: ['Os jogadores fortes também veem o lance natural primeiro. A diferença é que, antes de jogá-lo, eles fazem uma checagem curta de segurança.',
      'A checagem tem três perguntas, nesta ordem. Depois do meu lance, o adversário tem algum xeque? Alguma captura? Alguma ameaça nova? Se a resposta para as três for não, jogue. Se alguma for sim, calcule só aquela linha.',
      'Use a mesma lista para o seu lado: quais xeques, capturas e ameaças eu tenho? Muitos lances que ganham material estão escondidos atrás de um xeque que parecia inofensivo.'],
    rules: ['Xeques, capturas e ameaças: dos dois lados, sempre nesta ordem.', 'Quanto mais natural o lance parece, mais rápida é a checagem, mas ela nunca some.', 'No blitz, a checagem vale até nos lances óbvios; é ali que a partida escapa.'],
    go: [['data-ar="open:capi"', 'Qual é a capivarada?'], ['data-ar="open:cand"', 'Lances candidatos']] },
  { id: 'garfo', k: 'tactic', t: 'Garfos e ataques duplos', lead: 'Uma peça atacando duas coisas ao mesmo tempo: o adversário só consegue salvar uma.',
    p: ['O ataque duplo é a tática mais frequente do xadrez. O cavalo é o especialista, porque ataca em formato de L e é difícil de ver chegando, mas dama, peão, bispo e até o rei também garfam.',
      'Os alvos preferidos são as peças soltas e o rei. Um xeque que também ataca uma peça é um garfo que não admite defesa: o adversário é obrigado a cuidar do rei.',
      'Para achar garfos, procure duas peças inimigas que estão a um lance de cavalo de uma mesma casa, ou na mesma diagonal ou coluna da sua dama. Depois veja se dá para chegar nessa casa, nem que seja com um sacrifício para atrair a peça.'],
    rules: ['Rei e dama na mesma cor de casa, a um salto de cavalo de distância: perigo.', 'Peças soltas são os alvos mais fáceis de um garfo.', 'Um xeque que também ataca é um garfo sem defesa.'],
    go: [['data-aclib="g"', 'Puzzles de garfo'], ['data-pz="punish"', 'Puna o erro']] },
  { id: 'cravada', k: 'tactic', t: 'Cravadas e espetos', lead: 'Peças presas numa linha: a da frente não pode sair sem expor a de trás.',
    p: ['Na cravada, a peça da frente vale menos que a de trás: um cavalo na frente da dama, por exemplo. Se o cavalo sair, a dama cai. Se a peça de trás é o rei, a cravada é absoluta e a da frente simplesmente não pode se mover.',
      'O espeto é a cravada ao contrário: a peça mais valiosa está na frente, é atacada, sai, e a de trás fica exposta.',
      'Uma peça cravada é uma peça que não defende nada. Ataque-a de novo, de preferência com um peão: ela não pode fugir. E quando for você o cravado, desfaça a cravada com calma antes de seguir o plano.'],
    rules: ['Bispos e torres criam cravadas; damas, as duas coisas.', 'Peça cravada não defende: ataque-a com peças menores.', 'Rei e dama na mesma linha são um convite para espeto.'],
    go: [['data-aclib="c"', 'Puzzles de cravada e espeto']] },
  { id: 'rei', k: 'mate', t: 'A segurança do rei', lead: 'Mates permitidos quase sempre começam com um rei sem defensores ou sem casas de fuga.',
    p: ['O rei rocado parece seguro até que três coisas aconteçam juntas: os peões na frente dele avançam, as peças que o defendem saem para atacar, e uma coluna ou diagonal se abre na direção dele.',
      'O mate na primeira fileira é o exemplo mais comum: rei atrás de três peões intactos, sem uma casa de respiro, e a torre adversária chega na última fileira. Um lance de h3 (ou h6) na hora certa vale uma partida inteira.',
      'Quando o adversário junta peças perto do seu rei, pare de capturar material do outro lado do tabuleiro. Conte quantas peças ele tem atacando e quantas você tem defendendo. Se ele tem mais, a defesa vem primeiro.'],
    rules: ['Faça um respiro para o rei quando a primeira fileira puder ficar fraca.', 'Coluna aberta na frente do rei é sinal de alarme.', 'Mais atacantes que defensores perto do rei: defenda antes de atacar.'],
    go: [['data-ar="open:mates"', 'Padrões de mate'], ['data-aclib="m"', 'Puzzles de mate']] },
  { id: 'abertura', k: 'opening', t: 'Princípios da abertura', lead: 'Sem decorar linhas: o que fazer nos dez primeiros lances.',
    p: ['A abertura tem três tarefas: disputar o centro, trazer as peças menores para o jogo e colocar o rei em segurança. Quem cumpre as três primeiro costuma sair com uma posição confortável.',
      'Os erros típicos são mover a mesma peça várias vezes, sair cedo com a dama (que vira alvo e faz você perder tempo) e capturar peões laterais enquanto o adversário se desenvolve.',
      'Para cada abertura do seu repertório, saiba a ideia, não só a ordem dos lances: onde cada peça costuma ir, qual ruptura de peão é a típica e qual é o plano depois do desenvolvimento.'],
    rules: ['Centro, desenvolvimento, roque. Nessa ordem de preocupação.', 'Uma peça, um lance, até todas estarem em jogo.', 'Dama fora de casa antes do lance 6 costuma custar tempo.'],
    go: [['data-ar="open:rep"', 'Treinar o seu repertório']] },
  { id: 'plano', k: 'middle', t: 'Como achar um plano', lead: 'O meio-jogo é onde a maioria dos seus erros acontece. Um método simples para não jogar no escuro.',
    p: ['Quando não há tática no ar, a pergunta não é qual o melhor lance, mas qual é a sua pior peça. Melhorar a peça que menos trabalha é quase sempre um bom plano.',
      'Depois, olhe para os peões: eles definem o plano. Onde está a maioria de peões? Há uma coluna semiaberta para a torre? Uma casa forte para o cavalo, que nenhum peão adversário pode atacar?',
      'Antes de executar, liste dois ou três candidatos e compare. O lance que parece mais ativo nem sempre é o melhor: às vezes o lance certo é um recuo que reposiciona a peça.'],
    rules: ['Sem tática: melhore a pior peça.', 'Os peões mostram de que lado jogar.', 'Liste candidatos antes de calcular.'],
    go: [['data-ar="open:cand"', 'Lances candidatos'], ['data-ar="open:self"', 'Você primeiro']] },
  { id: 'converter', k: 'conv', t: 'Como converter uma vantagem', lead: 'Ganhar material é metade do caminho. A outra metade é não devolver.',
    p: ['Com vantagem material, simplifique: troque peças, não peões. Cada troca de peça deixa a vantagem proporcionalmente maior e tira do adversário as chances de contra-ataque.',
      'O erro clássico de quem está ganhando é relaxar e procurar o caminho mais bonito. Procure o mais seguro: tire as ameaças do adversário primeiro, depois avance.',
      'Num final ganho, crie um peão passado e empurre-o com apoio do rei. Na dúvida entre ganhar mais material e matar o contrajogo, mate o contrajogo.'],
    rules: ['À frente no material: troque peças, mantenha peões.', 'Primeiro neutralize o contrajogo, depois avance.', 'O caminho seguro vale mais que o bonito.'],
    go: [['data-ar="open:convert"', 'Converter a vitória']] },
  { id: 'finais', k: 'endgame', t: 'Finais de torre essenciais', lead: 'Metade dos finais que aparecem nas partidas são de torre. Três ideias resolvem a maioria.',
    p: ['Torre atrás do peão passado: atrás do seu, para empurrá-lo; atrás do adversário, para segurá-lo. Na frente do peão, a torre vira um bloqueador passivo.',
      'O rei é uma peça de ataque no final. Centralize-o assim que as damas saírem. Um rei ativo costuma valer mais que um peão.',
      'Torre ativa vale mais que peão. Muitas vezes é melhor entregar um peão e deixar a torre atacando do que defender passivamente com a torre amarrada.'],
    rules: ['Torre atrás do peão passado.', 'Rei no centro assim que as damas saírem.', 'Torre ativa, mesmo custando um peão.'],
    go: [['data-ar="open:end"', 'Curso de finais'], ['data-aclib="e"', 'Puzzles de final']] },
  { id: 'peao', k: 'endgame', t: 'O peão passado', lead: 'Um peão que nenhum peão adversário pode parar. Ele ganha finais sozinho.',
    p: ['O peão passado obriga o adversário a usar uma peça só para vigiá-lo. Quanto mais avançado, mais cara fica essa vigia.',
      'Peões passados devem ser empurrados, com apoio. Um peão passado parado é uma fraqueza; um peão passado avançando com o rei ao lado é uma ameaça constante.',
      'Do outro lado, o remédio é o bloqueio: coloque uma peça (de preferência um cavalo) na casa da frente do peão. Bloqueado, ele deixa de ser perigoso.'],
    rules: ['Peão passado deve avançar.', 'Contra o passado adversário, bloqueie a casa da frente.', 'Rei perto do peão: seu para empurrar, dele para parar.'],
    go: [['data-aclib="p"', 'Puzzles de peão avançado'], ['data-ar="open:end"', 'Curso de finais']] },
  { id: 'relogio', k: 'time', t: 'Tempo é material', lead: 'Perder no relógio com a posição ganha dói mais do que perder no tabuleiro.',
    p: ['O relógio é um recurso para ser gasto, mas gasto no lugar certo. Lances óbvios (recapturas, lances forçados, desenvolvimento da abertura) devem sair rápido.',
      'Gaste tempo nos momentos críticos: quando há trocas a decidir, quando a estrutura de peões muda, quando um sacrifício está no ar ou quando só um lance segura a posição.',
      'Uma regra prática: nunca fique com menos de 10% do tempo antes do lance 30 numa partida rápida. Se isso acontece com frequência, você está pensando demais nos lances tranquilos.'],
    rules: ['Lances óbvios rápidos; momentos críticos devagar.', 'Prefira ritmos com incremento enquanto treina o relógio.', 'Menos de 10% do tempo antes do lance 30 é sinal de alerta.'],
    go: [['data-ar="open:tempo"', 'Calcular ou jogar rápido?'], ['data-ar="open:clock"', 'Treino de relógio']] },
  { id: 'defesa', k: 'def', t: 'Como defender posições ruins', lead: 'Posições piores também se salvam. Muitas partidas perdidas tinham defesa.',
    p: ['Numa posição pior, o objetivo muda: não é mais ganhar, é criar problemas. Lances que pedem cálculo preciso do adversário rendem mais que lances que só esperam.',
      'Troque as peças de ataque do adversário, principalmente as que estão perto do seu rei. Cada troca diminui a força do ataque.',
      'Procure fortalezas e finais de empate conhecidos: bispos de cores opostas, torre contra torre e peão, rei na frente do peão. Às vezes o caminho do empate é entrar num final com um peão a menos.'],
    rules: ['Pior? Crie problemas, não espere.', 'Troque as peças que atacam.', 'Conheça os finais de empate: eles salvam pontos.'],
    go: [['data-ar="open:defend"', 'Defenda a posição']] }
];
function aulaEx(a) {
  // um exemplo das suas partidas para cada aula
  try {
    for (const P of acGames(200)) {
      const g = P.g;
      for (let i = 0; i < P.moves.length; i++) {
        const m = P.moves[i], c = P.cls[i]; if (m.color !== g.c || (c.k !== 'blunder' && c.k !== 'mistake') || !P.evs[i] || !P.evs[i].best) continue;
        const ph = phAt(P, i), tf = factsOk(P) && P.facts.tr[i] != null ? P.facts.tr[i] : trFact(P.fens, P.moves, P.evs, i, g.c);
        const ok = a.k === 'hang' ? tf & 1 : a.k === 'tactic' ? tf & 2 : a.k === 'mate' ? isMateFor(P.evs[i + 1], other(g.c)) : a.k === 'opening' ? ph === 'abertura' : a.k === 'middle' ? ph === 'meio-jogo' && c.loss >= 25 : a.k === 'endgame' ? ph === 'final' : a.k === 'time' ? g.clk && g.clk[i] != null && baseOf(g) && g.clk[i] < baseOf(g) * .15 : a.k === 'conv' ? c.wb >= 80 : a.k === 'def' ? c.wb <= 30 && c.wb >= 10 : false;
        if (ok) return { P, i };
      }
    }
  } catch (e) { return null; }
  return null;
}
let ACB = null;
function aulaHtml(a) {
  const read = store.get('aulas', {});
  let h = '<div class="ac-lesson stack"><button class="linkbtn ac-back" type="button" data-acback>← Academia</button><div class="stack" style="gap:6px"><span class="label">Aula · ' + (AULAS.indexOf(a) + 1) + ' de ' + AULAS.length + '</span><h2 class="ac-h">' + esc(a.t) + '</h2><p class="sub">' + esc(a.lead) + '</p></div>';
  h += '<div class="ac-prose">' + a.p.map(x => '<p>' + esc(x) + '</p>').join('') + '</div>';
  h += '<section class="card pad stack" style="gap:8px"><span class="label">Para lembrar</span><ol class="howto">' + a.rules.map(r => '<li>' + esc(r) + '</li>').join('') + '</ol></section>';
  const ex = aulaEx(a);
  if (ex) {
    const { P, i } = ex, m = P.moves[i], best = lineSan(P.fens[i], [P.evs[i].best])[0];
    h += '<section class="card pad ac-ex"><div class="ac-mini"><div id="acBoard"></div></div><div class="stack" style="gap:6px;min-width:0"><span class="label">Na sua partida</span><p><b>vs ' + esc(P.g.opp) + '</b> · ' + dateLabel(P.g.end, true) + '</p><p>Você jogou <b class="mono">' + esc(moveNum(i) + fig(m.san)) + '</b> (seta vermelha). O melhor era <b class="mono">' + esc(best ? fig(best.san) : P.evs[i].best) + '</b> (seta verde).</p><div class="vxacts"><button class="btn small" type="button" data-openply="' + P.g.id + ':' + i + '">Ver na partida</button></div></div></section>';
  }
  h += '<div class="stack" style="gap:8px"><span class="label">Pratique agora</span><div class="vxacts">' + a.go.map(([at, t], k) => '<button class="btn' + (k ? ' small' : ' primary') + '" type="button" ' + at + '>' + esc(t) + '</button>').join('') + '</div></div>';
  h += '<p class="muted" style="font-size:12.5px">Texto escrito para o Peão Passado a partir de princípios clássicos do xadrez. Não é uma aula gravada por um mestre.</p></div>';
  if (!read[a.id]) { read[a.id] = Date.now(); store.set('aulas', read); cloudPrefsPush(); }
  setTimeout(() => {
    const el = $('#acBoard'); if (!el || !ex) return;
    const B = new Board(el), { P, i } = ex, m = P.moves[i], b = P.evs[i].best;
    B.setFlip(P.g.c === 'b'); B.setPosition(P.fens[i], false); B.setMarks(i > 0 ? { last: [P.moves[i - 1].from, P.moves[i - 1].to] } : {});
    B.setArrows([{ from: m.from, to: m.to, cls: 'a-bad' }, { from: b.slice(0, 2), to: b.slice(2, 4), cls: 'a-best' }]); ACB = B;
  }, 0);
  return h;
}
function aulaOrder() {
  let pri = []; try { pri = buildTraining().prios.map(p => p.k); } catch (e) { pri = []; }
  const rank = a => { const i = pri.indexOf(a.k); return i < 0 ? 99 : i; };
  return AULAS.map((a, j) => ({ a, j, r: rank(a) })).sort((x, y) => x.r - y.r || x.j - y.j).map(x => ({ a: x.a, rec: x.r < 2 }));
}

/* ---------- Você e o seu nível: comparação com os seus adversários ---------- */
let LVC = null, LVK = '';
function levelCmp() {
  const key = dataKey(); if (LVC && LVK === key) return LVC;
  const games = acGames(300), z = () => ({ b: 0, w: 0 });
  const R = { acc: z(), blun: z(), open: z(), end: z(), clock: z(), n: games.length, oR: [], mR: [] };
  const tally = (o, d, eps) => { if (d > eps) o.b++; else if (d < -eps) o.w++; };
  for (const P of games) {
    const g = P.g, me = g.c, op = other(me);
    if (g.oR) R.oR.push(g.oR); if (g.mR) R.mR.push(g.mR);
    if (P.acc && P.acc[me] != null && P.acc[op] != null) tally(R.acc, P.acc[me] - P.acc[op], 1);
    const cnt = (side, f) => P.cls.filter((c, i) => P.moves[i].color === side && f(c, i)).length;
    tally(R.blun, cnt(op, c => c.k === 'blunder') - cnt(me, c => c.k === 'blunder'), 0);
    if (P.evs.length > 26) tally(R.open, sideWp(P.evs[24], me) - 50, 4);
    const fin = (side) => { let n = 0, e = 0; P.cls.forEach((c, i) => { if (P.moves[i].color !== side || phAt(P, i) !== 'final') return; n++; if (BAD[c.k] && c.k !== 'inacc') e++; }); return n >= 6 ? e / n : null; };
    const fm = fin(me), fo = fin(op); if (fm != null && fo != null) tally(R.end, fo - fm, .02);
    const b = baseOf(g);
    if (b && g.clk && g.clk.length >= 40) { const j = Math.min(g.clk.length - 2, 59), im = (j % 2 === 0) === (me === 'w') ? j : j - 1, io = im + 1; if (g.clk[io] != null) tally(R.clock, (g.clk[im] - g.clk[io]) / b, .03); }
  }
  LVC = R; LVK = key; return R;
}
function levelHtml() {
  const R = levelCmp(); if (R.n < 10) return emptyHtml('chart', 'Comparação ainda indisponível', 'Analise pelo menos 10 partidas para comparar você com os adversários do seu nível.');
  const row = (t, o, tip) => { const n = o.b + o.w; if (n < 6) return ''; const f = o.b / n; return '<div class="ac-lv"><div class="ac-lv-t"><span>' + t + '</span><b class="mono">' + Math.round(f * 100) + '%</b></div><div class="ac-lv-bar" aria-hidden="true"><i style="width:' + (f * 100).toFixed(1) + '%"></i><em></em></div><span class="muted">' + tip + ' · ' + n + ' partidas</span></div>'; };
  const ao = R.oR.length ? Math.round(avg(R.oR)) : null, am = R.mR.length ? Math.round(avg(R.mR)) : null;
  return '<p class="muted" style="font-size:13.5px">Em quantas partidas você foi melhor que o adversário em cada quesito. Seus adversários são o seu nível' + (ao ? ': rating médio ' + ao + (am ? ', o seu ' + am : '') : '') + '. Acima de 50% é ponto forte; abaixo, ponto a treinar.</p>' +
    '<div class="ac-lvs">' + row('Precisão', R.acc, 'mais preciso que o adversário') + row('Capivaradas', R.blun, 'menos erros graves que ele') + row('Abertura', R.open, 'saiu da abertura melhor') + row('Finais', R.end, 'errou menos no final') + row('Relógio', R.clock, 'mais tempo no lance 30') + '</div>' +
    '<p class="muted" style="font-size:12px">Não há aqui um banco com milhões de jogadores para um percentil mundial. A comparação usa os seus próprios adversários, que têm rating parecido com o seu.</p>';
}

/* ---------- Relatório para o treinador ---------- */
function coachReport() {
  const T = buildTraining(), G = S.games, an = acGames(400), L = [];
  const n = G.length, w = G.filter(g => rk(g) === 'W').length, d = G.filter(g => rk(g) === 'D').length;
  const pc = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
  const first = G.length ? dateLabel(G[G.length - 1].end, true) : '', last = G.length ? dateLabel(G[0].end, true) : '';
  L.push('# Relatório de xadrez: ' + S.me + ' (' + PLAT[S.plat] + ')', '', 'Gerado pelo Peão Passado em ' + new Date().toLocaleDateString('pt-BR') + '. ' + n + ' partidas de ' + first + ' a ' + last + ', ' + an.length + ' analisadas pelo Stockfish.', '');
  L.push('## Resumo', '');
  const cur = {}; for (const g of G) if (g.mR && !cur[g.tc]) cur[g.tc] = g.mR;
  const tcs = Object.keys(cur).filter(k => k !== 'daily');
  if (tcs.length) L.push('- Rating atual: ' + tcs.map(k => (TC[k] || k) + ' ' + cur[k]).join(', '));
  L.push('- Resultados: ' + pc(w, n) + ' vitórias, ' + pc(d, n) + ' empates, ' + pc(n - w - d, n) + ' derrotas');
  for (const c of ['w', 'b']) { const gs = G.filter(g => g.c === c), ww = gs.filter(g => rk(g) === 'W').length; if (gs.length) L.push('- De ' + SIDE[c] + ': ' + gs.length + ' partidas, ' + pc(ww, gs.length) + ' de vitórias'); }
  if (T.acc != null) L.push('- Precisão média: ' + Math.round(T.acc) + '%');
  if (T.userMoves) L.push('- Erros: ' + (T.errs / Math.max(1, T.games)).toFixed(1).replace('.', ',') + ' por partida (imprecisões, erros e capivaradas)');
  L.push('');
  if (T.prios.length) {
    L.push('## Pontos a trabalhar', '');
    T.prios.slice(0, 5).forEach((p, k) => { const Ls = LESSONS[p.k]; if (Ls) L.push((k + 1) + '. ' + Ls.t + ': ' + p.n + ' ocorrências. ' + Ls.d); });
    L.push('');
    const ph = T.phase, tot = ph.abertura + ph['meio-jogo'] + ph.final;
    if (tot) L.push('Erros por fase: abertura ' + pc(ph.abertura, tot) + ', meio-jogo ' + pc(ph['meio-jogo'], tot) + ', final ' + pc(ph.final, tot) + '.', '');
  }
  const ops = {}; for (const g of G) { const k = opName(g).split(',')[0] + ' (' + SIDE[g.c] + ')'; const o = ops[k] = ops[k] || { k, n: 0, s: 0 }; o.n++; o.s += rk(g) === 'W' ? 1 : rk(g) === 'D' ? .5 : 0; }
  const top = Object.values(ops).filter(o => o.n >= 5).sort((a, b) => b.n - a.n).slice(0, 8);
  if (top.length) { L.push('## Aberturas mais jogadas', ''); for (const o of top) L.push('- ' + o.k + ': ' + o.n + ' partidas, ' + pc(o.s, o.n) + ' de aproveitamento'); L.push(''); }
  const R = levelCmp();
  if (R.n >= 10) {
    L.push('## Comparação com adversários do mesmo nível', '');
    for (const [t, o] of [['Precisão maior', R.acc], ['Menos capivaradas', R.blun], ['Melhor saída da abertura', R.open], ['Menos erros no final', R.end], ['Mais tempo no lance 30', R.clock]]) { const k = o.b + o.w; if (k >= 6) L.push('- ' + t + ': em ' + pc(o.b, k) + ' das partidas'); }
    L.push('');
  }
  const cs = clockStats();
  if (cs && cs.movesAll) L.push('## Relógio', '', '- ' + pc(cs.movesLow, cs.movesAll) + ' dos lances jogados com menos de 15% do tempo', cs.lostN ? '- ' + pc(cs.lostTrouble, cs.lostN) + ' das derrotas passaram por apuro de tempo' : '', '');
  const key = T.puzzles.slice(0, 40).map(p => ({ p, g: G.find(x => x.id === p.gid) })).filter(x => x.g).sort((a, b) => b.g.end - a.g.end).slice(0, 6);
  if (key.length) {
    L.push('## Posições-chave (erros recentes mais caros)', '');
    key.forEach(({ p, g }, k) => {
      const P = prep(g), fen = P.fens[p.ply], best = lineSan(fen, [p.best])[0];
      L.push((k + 1) + '. vs ' + g.opp + ', ' + dateLabel(g.end, true) + ', lance ' + moveNum(p.ply).trim() + ' ' + p.played + ' (perdeu ' + Math.round(p.loss) + ' pontos de chance). Melhor: ' + (best ? best.san : p.best) + '.', '   FEN: ' + fen, '   Analisar: https://lichess.org/analysis/' + fen.replace(/ /g, '_'));
    });
    L.push('');
  }
  const sv = store.get('self', {}), notes = Object.entries(sv).filter(([, v]) => v.note).sort((a, b) => b[1].t - a[1].t).slice(0, 5);
  if (notes.length) { L.push('## O que o aluno anotou depois das partidas', ''); for (const [, v] of notes) L.push('- "' + v.note + '" (autocrítica ' + v.s + '%)'); L.push(''); }
  const capi = store.get('capi', {}), mem = store.get('mem', {}), ls = libStats();
  L.push('## Treino no app', '', '- Exercícios das próprias partidas resolvidos: ' + Object.keys(store.get('solved', {})).length);
  if (ls.n) L.push('- Biblioteca de táticas: ' + ls.ok + ' de ' + ls.n + ' resolvidos, rating de puzzles ' + libRating());
  if (capi.tot) L.push('- Qual é a capivarada?: ' + capi.ok + ' de ' + capi.tot + ' acertos');
  if (mem.n) L.push('- Memória: melhor rodada ' + mem.best + '/15');
  return L.filter(x => x !== null).join('\n').replace(/\n{3,}/g, '\n\n');
}
async function saveText(name, text, share) {
  if (NATIVE && NATIVE.platform === 'android') {
    try {
      if (!share) { try { await capCall('Filesystem', 'writeFile', { path: 'Peão Passado/' + name, data: text, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true }); toast('Salvo em Documentos/Peão Passado'); return; } catch (e) { /* segue para o compartilhamento */ } }
      await capCall('Share', 'share', { title: 'Relatório de xadrez', text }); return;
    } catch (e) { /* tenta o caminho da web */ }
  }
  if (share && navigator.share) { try { await navigator.share({ title: 'Relatório de xadrez', text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; if (dl) { await dl.save({ filename: name, data: text }); toast('Relatório salvo'); return; } } catch (e) { if (e && e.code === 'declined') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('Relatório salvo');
}
function reportHtml() {
  const txt = S.acRep = coachReport();
  return '<div class="ac-lesson stack"><button class="linkbtn ac-back" type="button" data-acback>← Academia</button><div class="stack" style="gap:6px"><span class="label">Ferramenta</span><h2 class="ac-h">Relatório para o treinador</h2><p class="sub">Um resumo do seu jogo para mandar a um professor ou guardar: pontos fracos, aberturas, relógio e as posições-chave com link para analisar.</p></div>' +
    '<div class="vxacts"><button class="btn primary" type="button" data-acrep="copy">Copiar</button><button class="btn" type="button" data-acrep="save">Salvar arquivo</button>' + (navigator.share || NATIVE ? '<button class="btn" type="button" data-acrep="share">Compartilhar</button>' : '') + '</div>' +
    '<pre class="ac-rep">' + esc(txt) + '</pre></div>';
}

/* ---------- contas combinadas ---------- */
const acctKeyOf = a => a.p + ':' + a.u.toLowerCase();
function acctNote() {
  if (!S.games.length || isSeed()) return;
  const L = store.get('accts', []); if (L.some(a => acctKeyOf(a) === acctKey())) return;
  L.push({ p: S.plat, u: S.me }); store.set('accts', L);
}
function linkedAccts() { return store.get('accts', []).filter(a => acctKeyOf(a) !== acctKey()); }
async function hydrateLinked() {
  let changed = false;
  for (const a of linkedAccts()) { const k = 'games:' + acctKeyOf(a); if (!MEM.games[k]) { MEM.games[k] = await kv.get(k, []); changed = true; } }
  return changed;
}
function acctsHtml() {
  const L = store.get('accts', []), comb = store.get('combine', false);
  if (!L.length) return '<p class="muted">Sincronize uma conta para começar.</p>';
  let h = '<div class="stack" style="gap:6px">' + L.map((a, i) => {
    const main = acctKeyOf(a) === acctKey(), arr = MEM.games['games:' + acctKeyOf(a)], cnt = main ? S.games.filter(g => !g.pf).length : arr ? arr.length : null;
    return '<div class="ac-acct' + (main ? ' on' : '') + '"><span class="stack" style="gap:1px;min-width:0"><b>' + esc(a.u) + '</b><span class="muted">' + PLAT[a.p] + (cnt != null ? ' · ' + cnt.toLocaleString('pt-BR') + ' partidas' : '') + '</span></span>' + (main ? '<span class="tag plain">principal</span>' : '<button class="btn small" type="button" data-acacct="main:' + i + '">Tornar principal</button><button class="ac-x" type="button" data-acacct="del:' + i + '" aria-label="Tirar ' + esc(a.u) + ' da lista">×</button>') + '</div>';
  }).join('') + '</div>';
  h += L.length > 1 ? '<label class="ac-sw"><input type="checkbox" data-accomb' + (comb ? ' checked' : '') + '><span>Juntar as partidas de todas as contas nas estatísticas, treinos e conquistas</span></label><p class="muted" style="font-size:12.5px">Os gráficos de rating continuam só com a conta principal: ratings de sites diferentes não se comparam. A sincronização automática segue a conta principal.</p>' : '<p class="muted" style="font-size:13px">Joga também no ' + (S.plat === 'lichess' ? 'Chess.com' : 'Lichess') + '? Sincronize essa conta e depois volte para a principal: o app junta as duas aqui.</p>';
  h += '<div class="vxacts"><button class="btn small" type="button" data-acacct="add">Adicionar conta</button></div>';
  return h;
}

/* ---------- a aba ---------- */
const AC_IC = {
  capi: '<path d="M12 3.5 21 19.5H3z"/><path d="M12 9.5v4.5"/><circle cx="12" cy="16.8" r=".9" fill="currentColor" stroke="none"/>',
  mem: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3.2"/>',
  tempo: '<path d="M7 3.5h10M7 20.5h10M8 3.5c0 4 8 5 8 8.5s-8 4.5-8 8.5M16 3.5c0 4-8 5-8 8.5s8 4.5 8 8.5"/>',
  lib: '<path d="M4 4.5h4v15H4zM10 4.5h4v15h-4z"/><path d="m15.6 5.6 3.8-1 3 14.4-3.8 1z"/>'
};
function acDrills() {
  const capi = store.get('capi', {}), mem = store.get('mem', {}), tp = store.get('tempo', {}), ls = libStats();
  const D = [
    ['capi', 'data-ar="open:capi"', 'Qual é a capivarada?', 'Dois lances, um deles é um erro seu. Ache qual.', capi.tot ? Math.round(capi.ok / capi.tot * 100) + '% de acerto' : 'novo'],
    ['mem', 'data-ar="open:mem"', 'Memória', 'Veja a posição, ela some, responda onde estava cada peça.', mem.best ? 'recorde ' + mem.best + '/15' : 'novo'],
    ['tempo', 'data-ar="open:tempo"', 'Calcular ou jogar rápido?', 'Reconheça os momentos que pedem relógio.', tp.tot ? Math.round(tp.ok / tp.tot * 100) + '% de acerto' : 'novo'],
    ['lib', 'data-ar="open:lib"', 'Biblioteca de táticas', puzList().length.toLocaleString('pt-BR') + ' puzzles por tema, no seu nível.', ls.n ? 'rating ' + libRating() : 'novo']
  ];
  return D.map(([k, go, t, d, s]) => '<button class="ac-dr" type="button" ' + go + '><span class="ac-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + AC_IC[k] + '</svg></span><span class="stack" style="gap:2px;min-width:0"><b>' + t + '</b><span class="muted">' + d + '</span></span><span class="ac-st mono">' + s + '</span></button>').join('');
}
function acAulasHtml() {
  const read = store.get('aulas', {}), O = aulaOrder(), row = ({ a, rec }) => '<button class="ac-al" type="button" data-acles="' + a.id + '"><span class="stack" style="gap:2px;min-width:0"><b>' + esc(a.t) + '</b><span class="muted">' + esc(a.lead) + '</span></span>' + (rec ? '<span class="tag plain">para você</span>' : read[a.id] ? '<span class="ac-read" aria-label="lida">✓</span>' : '<span></span>') + '</button>';
  return '<div class="ac-als">' + O.slice(0, 3).map(row).join('') + '</div><details class="ac-more"><summary>Todas as aulas (' + AULAS.length + ')</summary><div class="ac-als">' + O.slice(3).map(row).join('') + '</div></details>';
}
function acToolsHtml() {
  const tot = S.games.length, an = analyzedGames().length, crit = Object.keys(CRIT).length, busy = ANALYZING.size > 0 || CRITING.size > 0;
  const left = tot - an;
  return '<div class="ac-tools">' +
    '<section class="card pad stack ac-tool"><span class="label">Relatório para o treinador</span><p>Um resumo do seu jogo para mandar a um professor: pontos fracos, aberturas, relógio e posições-chave.</p><div class="vxacts"><button class="btn small primary" type="button" data-acrep="open">Gerar relatório</button></div></section>' +
    '<section class="card pad stack ac-tool" id="acQueue"><span class="label">Análise das partidas</span><p><b class="mono">' + an.toLocaleString('pt-BR') + '</b> de ' + tot.toLocaleString('pt-BR') + ' partidas analisadas · momentos críticos em ' + crit + '</p><div class="ac-lv-bar" aria-hidden="true"><i style="width:' + (tot ? an / tot * 100 : 0).toFixed(1) + '%"></i></div>' +
      (busy ? '<p class="muted" style="font-size:13px">Analisando em segundo plano' + (ANALYZING.size ? '…' : ': momentos críticos…') + ' Pode continuar usando o app.</p>' : '') +
      '<div class="vxacts">' + (left > 0 ? '<button class="btn small" type="button" data-acq="20"' + (busy ? ' disabled' : '') + '>Analisar mais ' + Math.min(20, left) + '</button>' + (left > 20 ? '<button class="btn small" type="button" data-acq="60"' + (busy ? ' disabled' : '') + '>Mais ' + Math.min(60, left) + '</button>' : '') : '') + '<button class="btn small" type="button" data-crit-bulk' + (busy ? ' disabled' : '') + '>Momentos críticos (30)</button></div>' +
      (left > 0 ? '<p class="muted" style="font-size:12.5px">Cada partida leva uns 15 a 20 segundos neste aparelho.</p>' : '') + '</section>' +
    '<section class="card pad stack ac-tool"><span class="label">Contas</span>' + acctsHtml() + '</section></div>';
}
let ACPOLL = 0;
function renderAcademia() {
  acctNote();
  const main = $('#acMain'), pane = $('#acPane'), P = S.acPane;
  if (P) {
    main.hidden = true; pane.hidden = false;
    if (P.t === 'aula') { const a = AULAS.find(x => x.id === P.id); pane.innerHTML = a ? aulaHtml(a) : ''; }
    else if (P.t === 'rep') pane.innerHTML = reportHtml();
    return;
  }
  main.hidden = false; pane.hidden = true; pane.innerHTML = '';
  main.innerHTML =
    '<section class="stack" style="gap:10px"><h2 class="st-group">Treinos</h2><div class="ac-drs">' + acDrills() + '</div></section>' +
    '<section class="stack" style="gap:10px"><h2 class="st-group">Aulas</h2>' + acAulasHtml() + '</section>' +
    '<section class="stack" style="gap:10px"><h2 class="st-group">Você e o seu nível</h2><div class="card pad stack" style="gap:12px">' + levelHtml() + '</div></section>' +
    '<section class="stack" style="gap:10px"><h2 class="st-group">Ferramentas</h2>' + acToolsHtml() + '</section>';
  if (store.get('combine', false)) hydrateLinked().then(ch => { if (ch && S.view === 'academia' && !S.acPane) { loadData(); renderAcademia(); } });
  else if (linkedAccts().some(a => !MEM.games['games:' + acctKeyOf(a)])) hydrateLinked().then(ch => { if (ch && S.view === 'academia' && !S.acPane) renderAcademia(); });
  acPoll();
}
function acPoll() {
  clearTimeout(ACPOLL);
  if (!(ANALYZING.size || CRITING.size)) return;
  ACPOLL = setTimeout(() => { if (S.view === 'academia' && !S.acPane) { const q = $('#acQueue'); if (q) { const t = document.createElement('div'); t.innerHTML = acToolsHtml(); const nq = t.querySelector('#acQueue'); if (nq) q.replaceWith(nq); } acPoll(); } }, 2500);
}
function acOpen(p) { S.acPane = p; if (S.view !== 'academia') location.hash = 'academia'; else { renderAcademia(); window.scrollTo(0, 0); } }
document.addEventListener('click', e => {
  const t = e.target;
  const les = t.closest('[data-acles]'); if (les) { e.preventDefault(); acOpen({ t: 'aula', id: les.dataset.acles }); return; }
  if (t.closest('[data-acback]')) { S.acPane = null; renderAcademia(); window.scrollTo(0, 0); return; }
  const lb = t.closest('[data-aclib]'); if (lb) { openLib(lb.dataset.aclib); return; }
  const rp = t.closest('[data-acrep]'); if (rp) {
    const k = rp.dataset.acrep;
    if (k === 'open') return acOpen({ t: 'rep' });
    const txt = S.acRep || coachReport(), name = 'relatorio-xadrez-' + S.me + '.md';
    if (k === 'copy') { navigator.clipboard.writeText(txt).then(() => toast('Relatório copiado'), () => { const pre = $('.ac-rep'); if (pre) { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } toast('Selecionei o texto: copie com o menu do aparelho'); }); return; }
    if (k === 'save') return saveText(name, txt, false);
    if (k === 'share') return saveText(name, txt, true);
  }
  const q = t.closest('[data-acq]'); if (q) { analyzeLatest(+q.dataset.acq); setTimeout(() => { if (S.view === 'academia') renderAcademia(); }, 300); return; }
  const ac = t.closest('[data-acacct]'); if (ac) {
    const [k, i] = ac.dataset.acacct.split(':'), L = store.get('accts', []);
    if (k === 'add') { openSync(); return; }
    if (k === 'del') { L.splice(+i, 1); store.set('accts', L); if (store.get('combine', false)) loadData(); renderAcademia(); return; }
    if (k === 'main') { const a = L[+i]; if (!a) return; ac.disabled = true; switchAccount(a.u, a.p).then(() => { toast('Conta principal: ' + a.u + ' · ' + PLAT[a.p]); if (S.view === 'academia') renderAcademia(); }); return; }
  }
});
document.addEventListener('change', e => {
  if (!e.target.matches('[data-accomb]')) return;
  store.set('combine', e.target.checked);
  hydrateLinked().then(() => { loadData(); TRAIN = null; badgeSoon(); renderAcademia(); toast(e.target.checked ? 'Partidas das contas juntadas' : 'Só a conta principal'); });
});
