/* ======================================================================
   v1.4: repertório com repetição espaçada, onde você perde pontos,
   deslizar entre abas, sincronização entre aparelhos, lembrete e widget
   ====================================================================== */

/* ---------- repertório: as suas aberturas com repetição espaçada ---------- */
var REP_PLY = 20, REP_MIN = 3, REP_GAMES = 500, REP_NEW = 8, REP_SESSION = 15;
var REP_DAYS = [1, 3, 7, 15, 30, 60];
var REPT = null, REPK = '', REPB = null;
var posKey = fen => fen.split(' ').slice(0, 4).join(' ');
function repKey() { return acctKey() + ':' + S.games.length + ':' + (S.games[0] ? S.games[0].id : '') + ':' + Object.keys(S.an).length; }
function repReady() { return !!REPT && REPK === repKey(); }
function repBuild() {
  const key = repKey(); if (REPT && REPK === key) return Promise.resolve(REPT);
  if (REPB && REPB.key === key) return REPB.p;
  const p = (async () => {
    const nodes = new Map(), games = S.games.slice(0, REP_GAMES);
    // o começo de cada partida vem pronto do processador em segundo plano; sem ele, reproduz aqui
    const heads = await gpHeads(games.map(g => g.id), REP_PLY);
    let tk = performance.now();
    for (let gi = 0; gi < games.length; gi++) {
      if (performance.now() - tk > 8) { await new Promise(r => setTimeout(r, 0)); tk = performance.now(); }
      const g = games[gi], raw = S.an[g.id], res = rk(g), H = heads && heads.get(g.id);
      const sans = H ? H.san : String(g.mv || '').split(' ').filter(Boolean).slice(0, REP_PLY);
      const c = H ? null : new Chess(); let fen = H ? H.fens[0] : c.fen(), prev = null; const path = [];
      for (let i = 0; i < sans.length; i++) {
        let m = null;
        if (H) { const u = H.u[i]; m = { color: fen.charAt(fen.indexOf(' ') + 1), san: H.san[i], from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.length > 4 ? u.charAt(4) : undefined }; }
        else { try { m = c.move(sans[i]); } catch (e) { m = null; } }
        if (!m) break;
        if (m.color === g.c) {
          const k = g.c + '|' + posKey(fen); let nd = nodes.get(k);
          if (!nd) { nd = { key: k, c: g.c, fen, ply: i, path: path.slice(), last: prev, n: 0, mv: {}, best: {}, op: g.op || g.eco || '', gid: g.id }; nodes.set(k, nd); }
          nd.n++;
          const e = nd.mv[m.san] = nd.mv[m.san] || { san: m.san, uci: m.from + m.to + (m.promotion || ''), n: 0, pts: 0, an: 0, bad: 0, loss: 0 };
          e.n++; e.pts += res === 'W' ? 1 : res === 'D' ? .5 : 0;
          if (raw && raw[i] && raw[i + 1]) {
            const eb = evOf(raw[i]), ea = evOf(raw[i + 1]), loss = Math.max(0, sideWp(eb, g.c) - sideWp(ea, g.c));
            e.an++; e.loss += loss; if (loss >= 10) e.bad++;
            if (eb && eb.best) nd.best[eb.best] = (nd.best[eb.best] || 0) + 1;
          }
        }
        path.push(m.san); prev = [m.from, m.to]; fen = H ? H.fens[i + 1] : c.fen();
      }
    }
    const badOf = e => e.an >= 2 && e.bad / e.an >= .5;
    const cards = [];
    for (const nd of nodes.values()) {
      if (nd.n < REP_MIN || nd.ply === 0) continue; // o 1º lance das brancas não precisa de treino
      const mvs = Object.values(nd.mv).sort((a, b) => b.n - a.n), main = mvs[0];
      let target = main, fix = null;
      if (badOf(main)) {
        const bu = Object.entries(nd.best).sort((a, b) => b[1] - a[1])[0];
        if (bu) {
          let bm = null; try { bm = new Chess(nd.fen).move({ from: bu[0].slice(0, 2), to: bu[0].slice(2, 4), promotion: bu[0][4] || 'q' }); } catch (e) { bm = null; }
          if (bm && bm.san !== main.san) { target = nd.mv[bm.san] || { san: bm.san, uci: bu[0], n: 0, pts: 0, an: 0, bad: 0, loss: 0 }; fix = main; }
        }
      }
      if (!fix && main.n < 2) continue;
      const ok = fix ? [target.san] : mvs.filter(e => e === target || (e.n >= Math.max(2, nd.n * .3) && !badOf(e))).map(e => e.san);
      cards.push({ key: nd.key, c: nd.c, fen: nd.fen, ply: nd.ply, path: nd.path, last: nd.last, n: nd.n, mvs, target, fix, ok, op: nd.op, gid: nd.gid });
    }
    cards.sort((a, b) => b.n - a.n || a.ply - b.ply);
    const top = cards.slice(0, 120);
    REPT = { cards: top, byKey: new Map(top.map(x => [x.key, x])), games: games.length }; REPK = key; REPB = null;
    return REPT;
  })();
  REPB = { key, p }; return p;
}
function repRecord(key, ok) {
  const s = store.get('rep', {}), isNew = !s[key], e = s[key] || { b: 0, n: 0, err: 0 };
  e.n++; e.t = Date.now();
  if (ok) { e.b = Math.min(e.b + 1, REP_DAYS.length); e.d = Date.now() + REP_DAYS[e.b - 1] * 864e5 - 36e5; }
  else { e.err++; e.b = 0; e.d = Date.now() + 10 * 60000; }
  s[key] = e; store.set('rep', s);
  if (isNew) { const nw = store.get('repNew', {}), dk = dayKey(new Date()); nw[dk] = (nw[dk] || 0) + 1; store.set('repNew', nw); }
  act('rep');
}
var repNewLeft = () => Math.max(0, REP_NEW - (store.get('repNew', {})[dayKey(new Date())] || 0));
function repPool(col) { return REPT ? REPT.cards.filter(x => col === 'all' || x.c === col) : []; }
function repStats(col) {
  const s = store.get('rep', {}), now = Date.now(), pool = repPool(col);
  const seen = pool.filter(x => s[x.key]);
  return { total: pool.length, due: seen.filter(x => s[x.key].d <= now).length, fresh: Math.min(repNewLeft(), pool.length - seen.length), firm: seen.filter(x => s[x.key].b >= 3).length, fix: pool.filter(x => x.fix).length, unseen: pool.length - seen.length };
}
function repWeak(col) {
  const s = store.get('rep', {});
  return repPool(col).filter(x => s[x.key] && s[x.key].err > 0).sort((a, b) => (s[b.key].err / s[b.key].n) - (s[a.key].err / s[a.key].n) || s[b.key].err - s[a.key].err).slice(0, 6);
}
function repQueue(col) {
  const s = store.get('rep', {}), now = Date.now(), pool = repPool(col);
  const rate = k => s[k].err / Math.max(1, s[k].n);
  const due = pool.filter(x => s[x.key] && s[x.key].d <= now).sort((a, b) => rate(b.key) - rate(a.key) || s[a.key].d - s[b.key].d);
  const fresh = pool.filter(x => !s[x.key]).slice(0, repNewLeft());
  return due.slice(0, REP_SESSION).concat(fresh).slice(0, REP_SESSION).map(x => x.key);
}
function repDue() { if (!repReady()) return null; const st = repStats('all'); return st.due; }
function repToday() { return repReady() ? repQueue('all').length : null; }
var lineSans = (path, upto) => path.slice(0, upto == null ? path.length : upto).map((m, j) => (j % 2 === 0 ? (j / 2 + 1) + '. ' : '') + fig(m)).join(' ');
function repLineHtml(x) {
  if (!x.path.length) return '<span class="muted">Posição inicial</span>';
  return '<span class="mono" style="font-size:13.5px">' + esc(lineSans(x.path)) + (x.c === 'b' ? ' …' : '') + '</span>';
}
function repLobby() {
  const A = S.arena;
  if (!repReady()) {
    arHead('Repertório', 'Montando a árvore das suas aberturas…'); $('#arPanel').innerHTML = CALC;
    lobbyPreview('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'w');
    repBuild().then(() => { if (S.arena === A && A.lobby && S.view === 'arena') renderLobby(); });
    return;
  }
  const col = store.get('repCol', 'all'), st = repStats(col), weak = repWeak(col), q = repQueue(col);
  arHead('Repertório', st.total + ' posições · ' + st.due + ' para revisar agora');
  let h = '<p>O app montou o seu repertório com as suas ' + REPT.games + ' partidas mais recentes: cada posição dos 10 primeiros lances em que você esteve pelo menos ' + REP_MIN + ' vezes, com o lance que você costuma jogar nela. Acertou, a posição volta daqui a 1, 3, 7, 15, 30 e 60 dias; errou, ela volta ainda nesta rodada e o intervalo recomeça. As que você mais erra vêm primeiro.</p>';
  h += '<div class="stack" style="gap:6px"><span class="label">Cor</span><div class="seg" role="group">' + [['all', 'Ambas'], ['w', 'Brancas'], ['b', 'Pretas']].map(([v, t]) => '<button type="button" data-ar="rcol:' + v + '" aria-pressed="' + (col === v) + '">' + t + '</button>').join('') + '</div></div>';
  h += '<div class="qstats two"><div class="qs"><b class="mono">' + st.due + '</b><span>para revisar agora</span></div><div class="qs"><b class="mono">' + st.fresh + '</b><span>novas hoje (de ' + st.unseen + ' ainda não vistas)</span></div><div class="qs"><b class="mono">' + st.firm + '</b><span>firmes (3 acertos seguidos)</span></div><div class="qs"><b class="mono">' + st.total + '</b><span>posições no repertório</span></div></div>';
  if (st.fix) h += '<div class="warn">Em ' + st.fix + ' posiç' + (st.fix > 1 ? 'ões' : 'ão') + ' o lance que você costuma jogar perde pontos nas análises do motor. Nelas o treino pede o lance do motor e explica a diferença.</div>';
  if (!st.total) h += '<p class="muted">Ainda não há posições repetidas o bastante. Jogue ou sincronize mais partidas.</p>';
  else h += '<div class="vxacts"><button class="btn primary" type="button" data-ar="go"' + (q.length ? '' : ' disabled') + '>' + (q.length ? 'Começar (' + q.length + ')' : 'Tudo em dia por hoje') + '</button>' + (weak.length ? '<button class="btn small accent" type="button" data-ar="rweak">Treinar as que mais escapam</button>' : '') + '</div>';
  if (weak.length) {
    const s = store.get('rep', {});
    h += '<div class="stack" style="gap:6px"><span class="label">As que mais escapam</span>' + weak.map(x => '<div class="repmv arow" style="cursor:default"><span style="min-width:0;display:flex;flex-direction:column;gap:2px">' + repLineHtml(x) + '<span class="muted" style="font-size:12.5px">' + (x.c === 'w' ? 'Brancas' : 'Pretas') + ' jogam ' + esc(fig(x.target.san)) + '</span></span><span class="mono muted">' + s[x.key].err + ' erro' + (s[x.key].err > 1 ? 's' : '') + '</span><span></span></div>').join('') + '</div>';
  }
  const first = q.length ? REPT.byKey.get(q[0]) : repPool(col)[0];
  if (first) lobbyPreview(first.fen, first.c, first.last); else lobbyPreview('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'w');
  $('#arPanel').innerHTML = '<div class="stack fade" style="gap:14px">' + h + '</div>';
}
async function repStart(mode) {
  await repBuild(); const col = store.get('repCol', 'all');
  const q = mode === 'weak' ? repWeak(col).map(x => x.key) : repQueue(col);
  if (!q.length) { toast('Nada para revisar agora'); return; }
  stopArenaTimers();
  S.arena = { kind: 'rep', lobby: false, q, i: 0, ok: 0, miss: 0, ans: null, retried: {}, mode, title: 'Repertório', sub: mode === 'weak' ? 'As posições que mais escapam' : 'Revisão de hoje' };
  arBoard(); AR.setArrows([]); $('#arClkTop').innerHTML = ''; $('#arClkBot').innerHTML = '';
  repDraw();
}
var repCard = () => { const A = S.arena; return A && REPT ? REPT.byKey.get(A.q[A.i]) : null; };
function repDraw() {
  const A = S.arena; if (!A || A.kind !== 'rep') return;
  const x = repCard(); arHead(A.title, A.sub);
  if (!x || A.over) { AR.setLive(null); return repPanel(); }
  AR.setFlip(x.c === 'b');
  if (!A.ans) { AR.setArrows([]); AR.setPosition(x.fen, false); AR.setMarks(x.last ? { last: x.last } : {}); repArm(x); }
  repPanel();
}
function repArm(x) {
  const c = new Chess(x.fen), dests = {};
  for (const mv of c.moves({ verbose: true })) { const a = dests[mv.from] = dests[mv.from] || []; if (!a.includes(mv.to)) a.push(mv.to); }
  AR.setLive({ color: x.c, dests, marks: AR.marks, onMove: (f, t) => repMove(f, t) });
}
function repMove(from, to) {
  const A = S.arena, x = repCard(); if (!A || A.kind !== 'rep' || A.ans || !x) return;
  const c = new Chess(x.fen); let m = null; try { m = c.move({ from, to, promotion: 'q' }); } catch (e) { m = null; }
  if (!m) { repArm(x); return; }
  repAnswer(x, m.san, from, to, c.fen());
}
function repAnswer(x, san, from, to, after) {
  const A = S.arena, right = !!san && x.ok.includes(san);
  A.ans = { san, right, shown: !san }; AR.setLive(null);
  const t = x.target.uci;
  if (right) {
    A.ok++; haptic('ok'); AR.setPosition(after, true); AR.setMarks({ last: [from, to], ok: to }); AR.setArrows([]);
    if (san === x.target.san && !x.fix) { const tok = A.adv = {}; setTimeout(() => { if (S.arena === A && A.adv === tok && A.ans) repAction('rnext'); }, 900); }
  } else {
    A.miss++; haptic('err'); AR.setPosition(x.fen, false); AR.setMarks(x.last ? { last: x.last } : {});
    AR.setArrows([{ from: t.slice(0, 2), to: t.slice(2, 4), cls: 'a-best' }].concat(from ? [{ from, to, cls: 'a-bad' }] : []));
    if (!A.retried[x.key]) { A.retried[x.key] = 1; A.q.splice(Math.min(A.q.length, A.i + 4), 0, x.key); }
  }
  repRecord(x.key, right); repPanel();
}
function repMoveRow(x, e) {
  const share = Math.round(e.n / x.n * 100), score = e.n ? Math.round(e.pts / e.n * 100) : null;
  const lossTxt = e.an && e.loss / e.an >= 1 ? ' · perde em média ' + Math.round(e.loss / e.an) + ' pontos de chance' : '';
  return '<li><b>' + esc(fig(e.san)) + '</b> <span class="muted">· ' + e.n + ' de ' + x.n + ' partidas (' + share + '%)' + (score != null ? ' · ' + score + '% dos pontos' : '') + lossTxt + '</span></li>';
}
function repPanel() {
  const A = S.arena; if (!A || A.kind !== 'rep') return;
  const x = repCard(); let h = '';
  if (!x || A.over) {
    const more = repQueue(store.get('repCol', 'all')).length;
    h += '<div class="fb ' + (A.miss === 0 ? 'ok' : 'hint') + '">Rodada concluída: ' + A.ok + ' acerto' + (A.ok === 1 ? '' : 's') + ' e ' + A.miss + ' erro' + (A.miss === 1 ? '' : 's') + '.</div>';
    h += '<p style="font-size:14px">As posições que você errou voltam em 10 minutos; as que acertou, no próximo intervalo. Treinar um pouco todo dia fixa mais do que uma sessão longa.</p>';
    h += '<div class="vxacts">' + (more ? '<button class="btn primary" type="button" data-ar="restart">Mais uma rodada (' + more + ')</button>' : '') + '<button class="btn small" type="button" data-ar="lobby">Voltar ao repertório</button></div>';
    $('#arPanel').innerHTML = '<div class="stack" style="gap:14px">' + h + '</div>'; return;
  }
  h += '<div style="display:flex;justify-content:space-between;gap:10px"><span class="label">Posição ' + (A.i + 1) + ' de ' + A.q.length + '</span><span class="mono muted">' + A.ok + ' acerto' + (A.ok === 1 ? '' : 's') + '</span></div>';
  h += '<div class="blk"><h3>A linha</h3><p>' + repLineHtml(x) + '</p>' + (x.ply >= 6 && x.op ? '<p class="muted" style="font-size:12.5px">Nas suas partidas: ' + esc(opName({ op: x.op })) + '</p>' : '') + '</div>';
  if (!A.ans) {
    h += '<p>Você joga de ' + SIDE[x.c] + '. <b>Qual é o seu lance aqui?</b></p><p class="muted" style="font-size:13px">Você chegou a esta posição em ' + x.n + ' partidas.</p>';
    h += '<div class="vxacts"><button class="btn small" type="button" data-ar="rshow">Não lembro: mostrar</button></div>';
  } else {
    const a = A.ans, alt = a.right && a.san !== x.target.san;
    if (a.right) h += '<div class="fb ok">' + (alt ? 'Também vale: ' + esc(fig(a.san)) + ' é um lance seu aqui. O mais jogado é ' + esc(fig(x.target.san)) + '.' : 'Isso! ' + esc(fig(a.san)) + '.') + '</div>';
    else h += '<div class="fb no">' + (a.shown ? '' : 'Você jogou ' + esc(fig(a.san)) + '. ') + (x.ok.length > 1 ? 'Os lances do seu repertório aqui são ' + x.ok.map(m => '<b>' + esc(fig(m)) + '</b>').join(' ou ') : 'O lance do seu repertório aqui é <b>' + esc(fig(x.target.san)) + '</b>') + '. A posição volta ainda nesta rodada.</div>';
    if (x.fix) h += '<div class="bestbox"><h3>Por que este lance</h3><p>Você costuma jogar ' + esc(fig(x.fix.san)) + ' (' + x.fix.n + ' de ' + x.n + ' partidas), mas nas ' + x.fix.an + ' análises ele perdeu em média ' + Math.round(x.fix.loss / Math.max(1, x.fix.an)) + ' pontos de chance de vitória. O motor prefere ' + esc(withWhy(x.fen, x.target.san, x.ply)) + '.</p></div>';
    h += '<div class="blk"><h3>Nas suas partidas</h3><ul class="facts">' + x.mvs.slice(0, 3).map(e => repMoveRow(x, e)).join('') + '</ul></div>';
    h += '<div class="vxacts"><button class="btn small primary" type="button" data-ar="rnext">' + (A.i + 1 < A.q.length ? 'Próxima' : 'Ver resultado') + '</button>' + (x.gid ? '<button class="btn small" type="button" data-openply="' + x.gid + ':' + x.ply + '">Ver numa partida</button>' : '') + '</div>';
  }
  $('#arPanel').innerHTML = '<div class="stack" style="gap:14px">' + h + '</div>';
}
function repAction(a) {
  const A = S.arena; if (!A || A.kind !== 'rep') return;
  if (a === 'restart') return repStart(A.mode === 'weak' ? 'normal' : A.mode);
  if (a === 'rshow') { const x = repCard(); if (x && !A.ans) repAnswer(x, null, null, null, null); return; }
  if (a === 'rnext') { A.adv = null; if (!A.ans) return; A.ans = null; A.i++; if (A.i >= A.q.length) A.over = true; repDraw(); }
}
function repLobbyAction(a) {
  if (a.startsWith('rcol:')) { store.set('repCol', a.slice(5)); renderLobby(); return true; }
  if (a === 'rweak') { repStart('weak'); return true; }
  return false;
}

/* ---------- finais: avaliação de cada lance pela tabela ---------- */
function tbGrade(A, uci) {
  const T = A.tbU; if (!T || T.fen !== curFen(A) || !T.r || !T.r.moves || !T.r.moves.length) return null;
  const ms = T.r.moves, best = ms[0], mine = ms.find(m => m.uci === uci) || ms.find(m => m.uci && m.uci.slice(0, 4) === uci.slice(0, 4));
  if (!mine) return null;
  const same = mine.category === best.category;
  const dist = m => m.dtm != null ? Math.abs(m.dtm) : m.dtz != null ? Math.abs(m.dtz) : null;
  const perfect = same && (mine.uci === best.uci || (dist(mine) != null && dist(mine) === dist(best)));
  return { k: !same ? 'bad' : perfect ? 'top' : 'ok', best: best.san, bestDtm: best.dtm != null ? Math.abs(best.dtm) : null, mineDtm: mine.dtm != null ? Math.abs(mine.dtm) : null };
}
function tbPrefetch(A) {
  if (!A || A.kind !== 'end' || !A.tb || A.tbOff || A.status !== 'play') return;
  const fen = curFen(A); if (fen.split(' ')[1] !== A.user || (A.tbU && A.tbU.fen === fen)) return;
  A.tbU = { fen, r: null };
  tbProbe(fen).then(r => { if (S.arena === A && A.tbU && A.tbU.fen === fen) { A.tbU.r = r; } }).catch(() => {});
}
function tbGradeHtml(A) {
  if (!A.grades || !A.grades.length) return '';
  const g = A.grades[A.grades.length - 1], top = A.grades.filter(x => x.k === 'top').length;
  const last = g.k === 'top' ? 'o lance perfeito' + (g.mineDtm ? ' (mate em ' + Math.ceil(g.mineDtm / 2) + ')' : '') + '.' : g.k === 'ok' ? 'mantém o resultado, mas não é o mais rápido: o melhor era ' + fig(g.best) + (g.bestDtm ? ' (mate em ' + Math.ceil(g.bestDtm / 2) + ' em vez de ' + Math.ceil((g.mineDtm || 0) / 2) + ')' : '') + '.' : 'muda o resultado com jogo perfeito. O certo era ' + fig(g.best) + '.';
  return '<p class="muted" style="font-size:13.5px">Tabela de finais: ' + esc(last) + ' Lances perfeitos até aqui: <b class="mono" style="color:var(--ink)">' + top + ' de ' + A.grades.length + '</b>.</p>';
}
function endBest(id) { return store.get('endg', {})[id] || null; }
function endSave(A) {
  if (!A.lesson || !A.grades || !A.grades.length || A.status !== 'won' || A.hints) return;
  const top = A.grades.filter(x => x.k === 'top').length, n = A.grades.length, s = store.get('endg', {}), cur = s[A.lesson.id];
  if (!cur || top / n > cur.p / cur.n) { s[A.lesson.id] = { p: top, n, t: Date.now() }; store.set('endg', s); cloudPrefsPush(); }
}

/* ---------- onde você perde pontos: fase a fase, contra adversários do seu nível ---------- */
var PH3 = ['abertura', 'meio-jogo', 'final'], PHT = { abertura: 'Abertura', 'meio-jogo': 'Meio-jogo', final: 'Final' };
var PH_GO = { abertura: ['data-ar="open:rep"', 'Treinar o repertório'], 'meio-jogo': ['data-pz="punish"', 'Treinar táticas das suas partidas'], final: ['data-ar="open:end"', 'Abrir o curso de finais'] };
var ELO_SLOPE = Math.LN10 / 1600; // perto de 50%, 1 ponto de rating muda a pontuação esperada em ~0,00144
var PHD = null, PHK = '', PHB = 'all';
function phaseRecs() {
  const key = acctKey() + ':' + analyzedGames().length + ':' + Object.keys(CRIT).length; if (PHD && PHK === key) return PHD;
  const out = [];
  for (const g of analyzedGames()) {
    const P = prep(g); if (!P.cls) continue;
    const ph = i => phAt(P, i);
    const d = g.oR && g.mR ? g.oR - g.mR : null;
    const z = () => ({ abertura: { l: 0, a: 0, n: 0 }, 'meio-jogo': { l: 0, a: 0, n: 0 }, final: { l: 0, a: 0, n: 0 } });
    const r = { band: d == null ? null : d < -50 ? 'weak' : d > 50 ? 'strong' : 'even', res: rk(g), me: z(), op: z(), dec: null };
    let worst = -1, wi = -1;
    P.cls.forEach((c, i) => {
      if (c.dz) return; const mine = P.moves[i].color === g.c, s = (mine ? r.me : r.op)[ph(i)];
      s.l += c.loss / 100; s.a += c.acc; s.n++;
      if (mine && c.loss > worst) { worst = c.loss; wi = i; }
    });
    if (r.res === 'L' && wi >= 0 && worst >= 10) r.dec = ph(wi);
    out.push(r);
  }
  PHK = key; PHD = out; return out;
}
function phaseCostHtml() {
  const all = phaseRecs(), recs = PHB === 'all' ? all : all.filter(r => r.band === PHB), n = recs.length;
  const cnt = b => all.filter(r => r.band === b).length;
  const seg = '<div class="seg" role="group" aria-label="Adversários">' + [['all', 'Todos (' + all.length + ')'], ['weak', 'Mais fracos (' + cnt('weak') + ')'], ['even', 'Parecidos (' + cnt('even') + ')'], ['strong', 'Mais fortes (' + cnt('strong') + ')']].map(([v, t]) => '<button type="button" data-phb="' + v + '" aria-pressed="' + (PHB === v) + '">' + t + '</button>').join('') + '</div>';
  if (n < 8) return seg + '<p class="muted">Poucas partidas analisadas neste grupo (' + n + '). Com pelo menos 8 dá para comparar.</p>';
  const rows = PH3.map(ph => {
    const diffs = recs.map(r => r.me[ph].l - r.op[ph].l), D = avg(diffs);
    const sd = Math.sqrt(diffs.reduce((s, x) => s + (x - D) * (x - D), 0) / Math.max(1, n - 1)), se = sd / Math.sqrt(n);
    const me = avg(recs.map(r => r.me[ph].l)), op = avg(recs.map(r => r.op[ph].l));
    const mn = recs.reduce((s, r) => s + r.me[ph].n, 0), on = recs.reduce((s, r) => s + r.op[ph].n, 0);
    const accMe = mn ? recs.reduce((s, r) => s + r.me[ph].a, 0) / mn : null, accOp = on ? recs.reduce((s, r) => s + r.op[ph].a, 0) / on : null;
    return { ph, D, se, me, op, accMe, accOp, elo: D / ELO_SLOPE, ci: 1.96 * se / ELO_SLOPE, sig: Math.abs(D) > 1.96 * se, moves: mn };
  });
  const bar = (lab, a, b, fmt, lowerBetter) => { const mx = Math.max(a || 0, b || 0, 1e-4); const better = lowerBetter ? a <= b : a >= b; return '<div class="cmp"><span class="lab">' + lab + '</span><div class="cbars"><span class="cb me" style="width:' + ((a || 0) / mx * 100) + '%"></span><span class="cb op" style="width:' + ((b || 0) / mx * 100) + '%"></span></div><span class="mono cv"><b class="' + (better ? 'up' : 'down') + '">' + fmt(a) + '</b> × ' + fmt(b) + '</span></div>'; };
  let h = seg + '<p class="sub"><span class="lg me"></span>você <span class="lg op"></span>seus adversários, nas mesmas ' + n + ' partidas</p>';
  for (const r of rows) {
    const eloTxt = !r.sig ? 'diferença dentro da margem de erro (' + (r.elo >= 0 ? '−' : '+') + Math.abs(Math.round(r.elo)) + ' ± ' + Math.round(r.ci) + ')' : r.D > 0 ? 'custa ≈ <b class="down">' + Math.round(r.elo) + ' ± ' + Math.round(r.ci) + '</b> pontos de rating' : 'vale ≈ <b class="up">+' + Math.abs(Math.round(r.elo)) + ' ± ' + Math.round(r.ci) + '</b> pontos de rating';
    h += '<div class="phrow"><div class="phh"><b>' + PHT[r.ph] + '</b><span class="muted mono" style="font-size:12.5px">' + r.moves + ' lances seus</span></div>' +
      bar('Precisão', r.accMe, r.accOp, x => x == null ? '—' : sp(x) + '%') +
      bar('Chance perdida por partida', r.me * 100, r.op * 100, x => sp(x, 1), true) +
      '<p class="muted" style="font-size:13px">' + eloTxt + '</p></div>';
  }
  const worst = rows.filter(r => r.sig && r.D > 0).sort((a, b) => b.D - a.D)[0];
  if (worst) h += '<div class="vxacts"><span style="font-size:14px">Onde você mais perde pontos: <b>' + PHT[worst.ph].toLowerCase() + '</b>.</span><button class="btn small accent" type="button" ' + PH_GO[worst.ph][0] + '>' + PH_GO[worst.ph][1] + '</button></div>';
  else h += '<p style="font-size:14px">Em nenhuma fase você perde, de forma clara, mais pontos que os seus adversários neste grupo.</p>';
  const L = recs.filter(r => r.dec), dc = PH3.map(ph => L.filter(r => r.dec === ph).length);
  if (L.length >= 5) h += '<div class="stack" style="gap:6px"><span class="label">Onde as suas ' + L.length + ' derrotas foram decididas</span><div class="hgrp">' + PH3.map((ph, k) => '<div class="hrow"><span>' + PHT[ph] + '</span><span class="hbar"><i style="width:' + (dc[k] / L.length * 100) + '%"></i></span><b class="mono">' + Math.round(dc[k] / L.length * 100) + '%</b><span class="mono muted">' + dc[k] + '</span></div>').join('') + '</div><p class="muted" style="font-size:12.5px">Fase do seu lance que mais derrubou a chance de vitória em cada derrota (só conta se derrubou 10 pontos ou mais).</p></div>';
  h += '<details class="lesson"><summary>Como a conta é feita</summary><div class="body"><p>Para cada lance, o motor dá a chance de vitória antes e depois. A queda, dividida por 100, é a parte de um ponto que o lance entregou. A soma por partida, em cada fase, é a “chance perdida por partida”, a sua e a dos seus adversários nas mesmas partidas. Os lances depois que a partida já estava decidida ficam de fora.</p><p>A conversão em rating usa a curva de Elo: perto de 50% de expectativa, 1 ponto de rating vale cerca de 0,0014 ponto por partida. A margem é o intervalo de 95% da diferença média entre você e o adversário, partida a partida. É uma estimativa: ela supõe que, jogando a fase como seus adversários, o resto da partida não mudaria.</p><p>Fases: abertura até o lance 10; final quando restam 20 pontos ou menos de peças (sem contar peões); meio-jogo no resto. Grupos de adversários: diferença de rating maior que 50 pontos para baixo ou para cima.</p></div></details>';
  return h;
}

/* ---------- deslizar entre as abas (celular) ---------- */
var SWIPE_ORDER = ['painel', 'partidas', 'analise', 'stats', 'treino', 'conquistas'];
function swipeInit() {
  const main = $('main.wrap'); if (!main) return;
  const mq = matchMedia('(max-width: 899px)');
  let st = null, raf = 0;
  const skip = t => {
    for (let e = t; e && e !== main; e = e.parentElement) {
      if (e.nodeType !== 1) continue;
      const cl = e.classList; if (cl.contains('board') || cl.contains('boardbox') || cl.contains('gbox') || e.hasAttribute('data-noswipe')) return true;
      const tg = e.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return true;
      if (e.scrollWidth > e.clientWidth + 4) { const ox = getComputedStyle(e).overflowX; if (ox === 'auto' || ox === 'scroll') return true; }
    }
    return false;
  };
  const paint = () => { raf = 0; if (!st || !st.dir) return; st.el.style.transform = 'translate3d(' + (st.dx * .5).toFixed(1) + 'px,0,0)'; st.el.style.opacity = String(1 - Math.min(.4, Math.abs(st.dx) / innerWidth * .8)); };
  main.addEventListener('touchstart', e => {
    st = null; if (!mq.matches || e.touches.length !== 1 || !store.get('swipe', true)) return;
    const i = SWIPE_ORDER.indexOf(S.view); if (i < 0) return;
    const t = e.touches[0]; if (t.clientX < 18 || t.clientX > innerWidth - 18) return; // bordas: gesto de voltar do sistema
    if (skip(e.target)) return;
    st = { x: t.clientX, y: t.clientY, t: performance.now(), i, dir: 0, dx: 0, el: $('#v-' + S.view) };
  }, { passive: true });
  main.addEventListener('touchmove', e => {
    if (!st) return; const t = e.touches[0], dx = t.clientX - st.x, dy = t.clientY - st.y;
    if (!st.dir) { if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return; if (Math.abs(dx) > Math.abs(dy) * 1.5) { st.dir = 1; st.x = t.clientX - Math.sign(dx) * 12; st.t = performance.now(); st.el.style.willChange = 'transform'; } else { st = null; return; } }
    const d = t.clientX - st.x, nx = st.i + (d < 0 ? 1 : -1);
    st.dx = nx < 0 || nx >= SWIPE_ORDER.length ? d * .25 : d;
    if (!raf) raf = requestAnimationFrame(paint);
  }, { passive: true });
  const end = () => {
    if (!st) return; const s = st; st = null; if (!s.dir) return;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    const v = Math.abs(s.dx) / Math.max(1, performance.now() - s.t), nx = s.i + (s.dx < 0 ? 1 : -1);
    const go = nx >= 0 && nx < SWIPE_ORDER.length && (Math.abs(s.dx) > innerWidth * .22 || (Math.abs(s.dx) > 45 && v > .4));
    const el = s.el;
    if (go) { el.style.transform = ''; el.style.opacity = ''; el.style.willChange = ''; S.swipeDir = s.dx < 0 ? 1 : -1; haptic('move'); location.hash = SWIPE_ORDER[nx]; return; }
    el.style.transition = 'transform .2s var(--ease), opacity .2s var(--ease)'; el.style.transform = ''; el.style.opacity = '';
    setTimeout(() => { el.style.transition = ''; el.style.willChange = ''; }, 220);
  };
  main.addEventListener('touchend', end, { passive: true });
  main.addEventListener('touchcancel', end, { passive: true });
}
function swipeMark(el) {
  if (!S.swipeDir || !el) { S.swipeDir = 0; return; }
  const cls = S.swipeDir > 0 ? 'swr' : 'swl'; S.swipeDir = 0;
  el.classList.remove("swr", "swl"); el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 260);
}

/* ---------- progresso: o que vai para a nuvem e como juntar dois aparelhos ---------- */
function prefsSnapshot() {
  return { solved: store.get('solved', {}), srs: store.get('srs', {}), daily: store.get('daily', {}), tbest: store.get('tbest', 0), rbest: store.get('rbest', 0), rush: store.get('rush', {}), cand: store.get('cand', {}), self: store.get('self', {}), wkHist: store.get('wkHist', {}), rushLog: store.get('rushLog', []), bdg: store.get('bdg', {}), prestige: store.get('prestige', 0), act: store.get('act', {}), arena: store.get('arena', {}), xbest: store.get('xbest', 0), guess: store.get('guess', {}), clockHist: store.get('clockHist', []), rep: store.get('rep', {}), repNew: store.get('repNew', {}), endg: store.get('endg', {}), pinLines: store.get('pinLines', []) };
}
function mergePrefs(p) {
  if (!p) return;
  store.set('solved', Object.assign({}, p.solved || {}, store.get('solved', {})));
  const ls = store.get('srs', {}), cs = p.srs || {}; for (const k in cs) if (!ls[k] || (cs[k].d || 0) > (ls[k].d || 0)) ls[k] = cs[k]; store.set('srs', ls);
  const ld = store.get('daily', {}), cd = p.daily || {}; for (const k in cd) ld[k] = Math.max(ld[k] || 0, cd[k]); store.set('daily', ld);
  store.set('tbest', Math.max(store.get('tbest', 0), p.tbest || 0));
  store.set('xbest', Math.max(store.get('xbest', 0), p.xbest || 0));
  store.set('rbest', Math.max(store.get('rbest', 0), p.rbest || 0));
  const lu = store.get('rush', {}), cu = p.rush || {}; store.set('rush', { n: Math.max(lu.n || 0, cu.n || 0), top: Math.max(lu.top || 0, cu.top || 0), sum: Math.max(lu.sum || 0, cu.sum || 0) });
  const lc = store.get('cand', {}), cc = p.cand || {}; store.set('cand', { n: Math.max(lc.n || 0, cc.n || 0), found: Math.max(lc.found || 0, cc.found || 0), pos: Math.max(lc.pos || 0, cc.pos || 0), best: Math.max(lc.best || 0, cc.best || 0) });
  const lf = store.get('self', {}), cf = p.self || {}; for (const k in cf) if (!lf[k] || (cf[k].t || 0) > (lf[k].t || 0)) lf[k] = cf[k]; store.set('self', lf);
  const lb = store.get('bdg', {}), cb = p.bdg || {}; for (const k in cb) if (!lb[k] || (cb[k].l || 0) > (lb[k].l || 0)) lb[k] = cb[k]; store.set('bdg', lb);
  store.set('prestige', Math.max(store.get('prestige', 0), p.prestige || 0));
  const lw = store.get('wkHist', {}), cw = p.wkHist || {}; for (const k in cw) lw[k] = Math.max(lw[k] || 0, cw[k] || 0); store.set('wkHist', lw);
  if (Array.isArray(p.rushLog)) { const seen = new Set(store.get('rushLog', []).map(x => x.t)); store.set('rushLog', store.get('rushLog', []).concat(p.rushLog.filter(x => !seen.has(x.t))).sort((a, b) => a.t - b.t).slice(-60)); }
  const la = store.get('act', {}), ca = p.act || {}; for (const d in ca) { la[d] = la[d] || {}; for (const k in ca[d]) la[d][k] = Math.max(la[d][k] || 0, ca[d][k]); } store.set('act', la);
  const lr = store.get('arena', {}), cr = p.arena || {}; for (const k in cr) { const a = lr[k], b = cr[k]; if (!a) lr[k] = b; else lr[k] = { n: Math.max(a.n || 0, b.n || 0), ok: (a.ok || b.ok) ? 1 : 0, t: Math.max(a.t || 0, b.t || 0) }; } store.set('arena', lr);
  const lg = store.get('guess', {}), cg = p.guess || {}; for (const k in cg) lg[k] = Math.max(lg[k] || 0, cg[k]); store.set('guess', lg);
  if (Array.isArray(p.clockHist) && p.clockHist.length > store.get('clockHist', []).length) store.set('clockHist', p.clockHist);
  const lp = store.get('rep', {}), cp = p.rep || {}; for (const k in cp) if (!lp[k] || (cp[k].t || 0) > (lp[k].t || 0)) lp[k] = cp[k]; store.set('rep', lp);
  const ln = store.get('repNew', {}), cn = p.repNew || {}; for (const k in cn) ln[k] = Math.max(ln[k] || 0, cn[k]); store.set('repNew', ln);
  const le = store.get('endg', {}), ce = p.endg || {}; for (const k in ce) if (!le[k] || ce[k].p / ce[k].n > le[k].p / le[k].n) le[k] = ce[k]; store.set('endg', le);
  if (Array.isArray(p.pinLines)) { const pl = store.get('pinLines', []); for (const x of p.pinLines) if (!pl.includes(x)) pl.push(x); store.set('pinLines', pl); }
}

/* ---------- sincronização entre aparelhos: um Gist secreto no GitHub ---------- */
var GS_IDX = 'lal-indice.json', GS_DESC = 'Peão Passado: progresso (sincronização entre aparelhos)', GS_CHUNK = 650000;
var GS = { busy: false, again: false, timer: 0, msg: '', err: '' };
var gsOn = () => !!(NATIVE && store.get('gsTok', ''));
async function ghApi(method, path, body) {
  const url = 'https://api.github.com' + path, tok = store.get('gsTok', ''), payload = body ? JSON.stringify(body) : null;
  let status = 0, text = '';
  if (window.native && typeof window.native.gh === 'function') { const r = await window.native.gh({ method, url, body: payload, token: tok }); status = r.status; text = r.text; }
  else {
    const headers = { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + tok, 'X-GitHub-Api-Version': '2022-11-28' };
    if (payload) headers['Content-Type'] = 'application/json';
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 45000);
    try { const r = await fetch(url, { method, headers, body: payload || undefined, cache: 'no-store', signal: ctl.signal }); status = r.status; text = await r.text(); } finally { clearTimeout(tm); }
  }
  if (status === 401 || status === 403) throw { code: 'auth', status };
  if (status === 404) throw { code: 'notfound' };
  if (status < 200 || status >= 300) throw { code: 'http_' + status };
  return text ? JSON.parse(text) : null;
}
async function gsGistId() {
  let id = store.get('gsId', ''); if (id) return id;
  for (let page = 1; page <= 5 && !id; page++) {
    const list = await ghApi('GET', '/gists?per_page=100&page=' + page); if (!list || !list.length) break;
    const g = list.find(x => x.description === GS_DESC || (x.files && x.files[GS_IDX])); if (g) id = g.id;
    if (list.length < 100) break;
  }
  if (!id) { const g = await ghApi('POST', '/gists', { description: GS_DESC, public: false, files: { [GS_IDX]: { content: '{"v":1}' } } }); id = g.id; }
  store.set('gsId', id); return id;
}
var gsSlug = k => k.replace(/[^a-z0-9]+/gi, '_');
function gsChunks(prefix, entries, wrap) {
  const out = {}; let cur = [], size = 0, k = 0;
  const flush = () => { if (!cur.length) return; out[prefix + k + '.json'] = JSON.stringify(wrap(cur)); k++; cur = []; size = 0; };
  for (const e of entries) { const s = JSON.stringify(e).length + 1; if (cur.length && size + s > GS_CHUNK) flush(); cur.push(e); size += s; }
  flush(); return out;
}
function gsFiles() {
  const core = { v: 1, me: S.me, plat: S.plat, meT: store.get('meT', 0), prefs: prefsSnapshot(), crit: CRIT };
  const files = {};
  const an = Object.keys(MEM.an || {}).filter(k => !SEED_AN[k]).sort().map(k => [k, MEM.an[k]]);
  Object.assign(files, gsChunks('lal-analises-', an, part => { const o = {}; for (const [k, v] of part) o[k] = v; return o; }));
  for (const key of Object.keys(MEM.games)) {
    const gs = (MEM.games[key] || []).slice().sort((a, b) => (a.end - b.end) || (a.id < b.id ? -1 : 1)); if (!gs.length) continue;
    Object.assign(files, gsChunks('lal-partidas-' + gsSlug(key) + '-', gs, part => ({ key, g: part })));
  }
  core.parts = Object.keys(files).length;
  return { core, files };
}
async function gsMerge(files) {
  const got = { an: 0, games: 0, prefs: false, acct: null };
  let idx = null; try { idx = files[GS_IDX] ? JSON.parse(files[GS_IDX].content || '{}') : null; } catch (e) { idx = null; }
  if (idx && idx.prefs) { mergePrefs(idx.prefs); got.prefs = true; }
  if (idx && idx.crit) { let ch = 0; for (const k in idx.crit) if (!CRIT[k]) { CRIT[k] = idx.crit[k]; ch++; } if (ch) kv.set('crit', CRIT); }
  if (idx && idx.me && (idx.meT || 0) > store.get('meT', 0) && (idx.me.toLowerCase() !== S.me.toLowerCase() || (idx.plat || 'chesscom') !== S.plat)) got.acct = { me: idx.me, plat: idx.plat || 'chesscom', t: idx.meT };
  MEM.an = MEM.an || {};
  for (const name of Object.keys(files)) {
    const f = files[name]; let txt = f.content || '';
    if (f.truncated && f.raw_url) { try { txt = await (await fetch(f.raw_url, { cache: 'no-store' })).text(); } catch (e) { continue; } }
    if (/^lal-analises-\d+\.json$/.test(name)) {
      let o; try { o = JSON.parse(txt); } catch (e) { continue; }
      for (const gid in o) if (!MEM.an[gid] && !SEED_AN[gid] && Array.isArray(o[gid])) { MEM.an[gid] = o[gid]; got.an++; }
    } else if (/^lal-partidas-.+-\d+\.json$/.test(name)) {
      let o; try { o = JSON.parse(txt); } catch (e) { continue; } if (!o || !o.key || !Array.isArray(o.g)) continue;
      const local = MEM.games[o.key] || (MEM.games[o.key] = await kv.get(o.key, [])); const ids = new Set(local.map(g => g.id)); let add = 0;
      for (const g of o.g) if (g && g.id && !ids.has(g.id)) { local.push(g); ids.add(g.id); add++; }
      if (add) { local.sort((a, b) => b.end - a.end); await kv.set(o.key, local); got.games += o.key === 'games:' + acctKey() ? add : 0; }
    }
  }
  if (got.an) await kv.set('an', MEM.an);
  return got;
}
async function gsPush(id, remote) {
  const { core, files } = gsFiles(), H = store.get('gsH', {}), patch = {}; const coreStr = JSON.stringify(core), ch = strHash(coreStr);
  if (H[GS_IDX] !== ch || !remote.has(GS_IDX)) patch[GS_IDX] = { content: JSON.stringify(Object.assign({ t: Date.now(), dev: NATIVE ? NATIVE.platform : 'web' }, core)) };
  for (const [name, str] of Object.entries(files)) if (H[name] !== strHash(str) || !remote.has(name)) patch[name] = { content: str };
  for (const name of remote) if (/^lal-(analises|partidas)-/.test(name) && !files[name]) patch[name] = null;
  const names = Object.keys(patch); if (!names.length) return 0;
  // envia em lotes para não estourar o limite de tamanho de uma requisição
  let batch = {}, size = 0;
  const send = async () => { if (!Object.keys(batch).length) return; await ghApi('PATCH', '/gists/' + id, { files: batch }); batch = {}; size = 0; };
  for (const name of names) { const s = patch[name] ? patch[name].content.length : 10; if (size && size + s > 2500000) await send(); batch[name] = patch[name]; size += s; }
  await send();
  const NH = {}; NH[GS_IDX] = ch; for (const [name, str] of Object.entries(files)) NH[name] = strHash(str); store.set('gsH', NH);
  return names.length;
}
function gsSchedule(ms) { if (!gsOn()) return; clearTimeout(GS.timer); GS.timer = setTimeout(() => gsSync(false), ms == null ? 20000 : ms); }
async function gsSync(manual) {
  if (!gsOn()) return; if (GS.busy) { GS.again = true; return; }
  GS.busy = true; GS.err = ''; clearTimeout(GS.timer); GS.timer = 0; gsUi();
  try {
    let id = await gsGistId(), gist;
    try { gist = await ghApi('GET', '/gists/' + id); } catch (e) { if (e && e.code === 'notfound') { store.set('gsId', ''); store.set('gsH', {}); id = await gsGistId(); gist = await ghApi('GET', '/gists/' + id); } else throw e; }
    const files = gist.files || {}, got = await gsMerge(files);
    if (got.acct) { await switchAccount(got.acct.me, got.acct.plat); store.set('meT', got.acct.t); }
    if (got.an || got.games || got.prefs) { loadData(); TRAIN = null; for (const P of PREP.values()) if (!P.evs && S.an[P.g.id]) attachAnalysis(P); for (const v in VKEY) delete VKEY[v]; if ($('#sync').hidden && S.view !== 'arena') showView(S.view); }
    await gsPush(id, new Set(Object.keys(files)));
    store.set('gsLast', Date.now());
    const parts = []; if (got.games) parts.push(got.games + ' partida' + (got.games > 1 ? 's' : '')); if (got.an) parts.push(got.an + ' análise' + (got.an > 1 ? 's' : ''));
    GS.msg = parts.length ? 'Vieram do outro aparelho: ' + parts.join(' e ') + '.' : '';
    if (parts.length || manual) toast(parts.length ? 'Sincronizado: ' + parts.join(' e ') + ' do outro aparelho' : 'Tudo sincronizado');
  } catch (e) {
    GS.err = e && e.code === 'auth' ? 'O GitHub recusou o token. Confira se ele ainda vale e se tem a permissão Gists: Read and write.' : 'Não consegui falar com o GitHub agora (' + (e && e.code ? e.code : 'rede') + '). Tento de novo mais tarde.';
    if (manual) toast(e && e.code === 'auth' ? 'Token recusado pelo GitHub' : 'Sem conexão com o GitHub');
  }
  GS.busy = false; gsUi();
  if (GS.again) { GS.again = false; gsSchedule(3000); }
}
function gsStatus() {
  if (GS.busy) return 'Sincronizando…';
  if (GS.err) return GS.err;
  const t = store.get('gsLast', 0); if (!t) return 'Conectado. A primeira sincronização começa em instantes.';
  const d = new Date(t); return 'Última sincronização: ' + (dayKey(d) === dayKey(new Date()) ? 'hoje' : dateLabel(t / 1000)) + ' às ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + '.' + (GS.msg ? ' ' + GS.msg : '');
}
function syncPrefsHtml() {
  if (!NATIVE) return '';
  let h = '<div class="stack" style="gap:8px" id="gsBox"><span class="label">Sincronizar entre aparelhos</span>';
  if (gsOn()) h += '<p class="muted" style="font-size:14px" id="gsStat">' + esc(gsStatus()) + '</p><div class="vxacts"><button class="btn small primary" type="button" data-gs="now">Sincronizar agora</button><button class="btn small" type="button" data-gs="off">Desconectar</button></div>';
  else h += '<p style="font-size:14px">Leve treinos, repertório, análises e partidas entre o PC e o celular. O app guarda tudo num Gist secreto da sua conta do GitHub. Faça isto uma vez em cada aparelho:</p>' +
    '<ol style="font-size:14px;padding-left:20px;display:flex;flex-direction:column;gap:4px"><li>No GitHub: Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.</li><li>Em <b>Account permissions</b>, dê a <b>Gists</b> o acesso <b>Read and write</b>. Não precisa de nenhuma outra permissão nem de acesso a repositórios.</li><li>Copie o token, cole abaixo e toque em Conectar. No outro aparelho, use o mesmo token.</li></ol>' +
    '<div class="field"><input type="password" id="gsTok" placeholder="github_pat_…" autocomplete="off" spellcheck="false" aria-label="Token do GitHub"></div><div class="vxacts"><button class="btn small primary" type="button" data-gs="on">Conectar</button></div>' +
    '<p class="muted" style="font-size:12.5px">O token fica só neste aparelho. O Gist secreto não aparece no seu perfil, mas quem tiver o link dele consegue abrir; ele guarda apenas dados de xadrez.</p>';
  return h + '</div>';
}
function gsUi() { const el = $('#gsStat'); if (el) el.textContent = gsStatus(); }
async function gsAction(a) {
  if (a === 'on') {
    const v = ($('#gsTok') && $('#gsTok').value || '').trim(); if (!v) { toast('Cole o token do GitHub'); return; }
    store.set('gsTok', v); store.set('gsId', ''); store.set('gsH', {});
    try { await ghApi('GET', '/gists?per_page=1'); } catch (e) { store.set('gsTok', ''); toast(e && e.code === 'auth' ? 'O GitHub recusou esse token' : 'Sem conexão com o GitHub agora'); return; }
    openPrefs(); gsSync(true); return;
  }
  if (a === 'off') { store.set('gsTok', ''); store.set('gsId', ''); store.set('gsH', {}); store.set('gsLast', 0); GS.msg = ''; GS.err = ''; openPrefs(); toast('Sincronização desconectada neste aparelho'); return; }
  if (a === 'now') gsSync(true);
}

/* ---------- lembrete do dia (Android) e widget na tela inicial ---------- */
function todayDone() { return dailyCount() >= GOAL; }
function remText(first) {
  const sk = streakDays(), due = repToday(), left = Math.max(0, GOAL - dailyCount());
  const bits = [];
  if (first) {
    if (sk > 0) bits.push((todayDone() ? 'Sequência de ' : 'Sua sequência de ') + sk + ' dia' + (sk > 1 ? 's' : '') + (todayDone() ? '' : ' continua se você treinar hoje'));
    bits.push(left + ' exercício' + (left === 1 ? '' : 's') + ' para a meta do dia');
    if (due) bits.push(due + ' posiç' + (due > 1 ? 'ões' : 'ão') + ' do repertório para treinar');
  } else bits.push('Hora do treino: a meta do dia e as revisões do repertório levam uns 15 minutos');
  return bits.join(' · ') + '.';
}
var REMT = 0;
function remSchedule() {
  clearTimeout(REMT);
  REMT = setTimeout(async () => {
    if (!NATIVE || NATIVE.platform !== 'android') return;
    const h = store.get('remH', -1);
    try {
      await capCall('LocalNotifications', 'cancel', { notifications: [7001, 7002, 7003, 7004, 7005, 7006, 7007, 7008].map(id => ({ id })) }).catch(() => {});
      if (h < 0) return;
      const list = [], now = new Date();
      for (let d = 0; d < 7; d++) {
        const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, h, 0, 0, 0);
        if (at <= now || (d === 0 && todayDone())) continue;
        const first = d === 0;
        list.push({ id: 7001 + d, title: 'Peão Passado', body: remText(first), schedule: { at, allowWhileIdle: true } });
      }
      if (list.length) await capCall('LocalNotifications', 'schedule', { notifications: list });
    } catch (e) { /* aplicativo antigo sem notificações */ }
  }, 1500);
}
var WIDT = 0;
function widgetPush() {
  if (!NATIVE || NATIVE.platform !== 'android') return;
  clearTimeout(WIDT);
  WIDT = setTimeout(() => {
    const g = S.games[0], sk = streakDays(), due = repToday();
    const res = g ? ({ W: 'vitória', D: 'empate', L: 'derrota' })[rk(g)] + ' vs ' + g.opp : 'Nenhuma partida ainda';
    const data = { day: dayKey(new Date()), streak: String(sk), streakLabel: sk === 1 ? 'dia seguido' : 'dias seguidos', today: dailyCount() + ' de ' + GOAL, goal: String(GOAL), done: String(dailyCount()), rep: due == null ? '—' : String(due), last: 'Última: ' + res, user: S.me };
    capCall('LalWidget', 'update', data).catch(() => { /* aplicativo sem widget (versão antiga) */ });
  }, 1200);
}
function progressChanged() { widgetPush(); remSchedule(); gsSchedule(); badgeSoon(); }

/* ---------- ligações desta parte ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-gs],[data-phb]'); if (!t) return;
  if (t.dataset.gs) { gsAction(t.dataset.gs); return; }
  if (t.dataset.phb) { PHB = t.dataset.phb; const el = $('#stPhase'); if (el) el.innerHTML = '<div class="stack fade" style="gap:12px">' + phaseCostHtml() + '</div>'; }
});
function v14Data() {
  // widget e lembrete já com o que se sabe; o repertório entra quando ficar pronto
  setTimeout(() => { widgetPush(); remSchedule(); }, 1500);
  setTimeout(() => { repBuild().then(() => { widgetPush(); remSchedule(); const el = $('#repTile'); if (el) el.textContent = String(repToday() || 0); }).catch(() => {}); }, 1500);
}
function v14Start() {
  swipeInit(); warmPaint();
  if (gsOn()) { setTimeout(() => gsSync(false), 3500); setInterval(() => gsSync(false), 15 * 60000); }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && GS.timer && gsOn()) gsSync(false); if (document.visibilityState === 'visible') widgetPush(); });
}
