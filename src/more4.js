/* =====================================================================
   Versão 1.5: Corrida dos seus erros, Lances candidatos, Você primeiro
   (autoavaliação antes do motor) e Conquistas com insígnias.
   Este arquivo é inserido dentro do app.js.
   ===================================================================== */

/* ---------- Corrida dos seus erros ---------- */
// fácil primeiro: mates curtos e capivaradas grandes; depois erros menores e mates longos
function rushDiff(p) { return p.mate ? Math.min(p.mate, 4) * 9 : 26 + (p.k === 'blunder' ? 0 : p.k === 'miss' ? 6 : 12) + Math.max(0, 40 - Math.min(40, p.loss || 0)) * .6; }
function rushQueue(T) {
  const all = T.puzzles.slice().sort((a, b) => rushDiff(a) - rushDiff(b)), out = [];
  for (let i = 0; i < all.length; i += 6) out.push.apply(out, shuffle(all.slice(i, i + 6)));
  return out;
}
const rushLevel = () => S.tm ? Math.floor((S.tm.ok + S.tm.miss) / 5) + 1 : 1;
const PAWN_D = 'M50 17a12 12 0 1 1 0 24a12 12 0 1 1 0-24ZM39 43.5h22a2.5 2.5 0 0 1 0 5h-22a2.5 2.5 0 0 1 0-5ZM44.5 50h11C56 61 61 68 67 74H33C39 68 44 61 44.5 50ZM29 77h42a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-42a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3Z';
function rushTick() {
  const T = S.tm; if (!T || T.over) return; const now = Date.now();
  // pausa quando o app sai da tela ou da aba Treino
  if (T.lt && (document.hidden || S.view !== 'treino')) T.end += now - T.lt;
  T.lt = now; renderPzCount(); if (now >= T.end) finishTimed('time');
}
function rushHud() {
  const el = $('#pzRush'); if (!el) return;
  const on = S.pzMode === 'timed' && S.tm; el.hidden = !on; if (!on) return;
  const T = S.tm;
  if (T.over) { if (!el.dataset.end) { el.dataset.end = '1'; el.innerHTML = rushEndHtml(); } return; }
  if (!el.querySelector('.rush-t')) {
    delete el.dataset.end;
    el.innerHTML = '<div class="rush-top"><b class="rush-t mono"></b><span class="rush-lives" aria-label="vidas"></span><span class="rush-sc"><b class="mono"></b> <span></span></span></div><div class="rush-bar"><i></i></div><div class="rush-fx"><span class="rush-combo"></span><span class="rush-bonus">+10 s</span></div>';
  }
  const left = Math.max(0, T.end - Date.now()), s = Math.ceil(left / 1000);
  el.querySelector('.rush-t').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  el.querySelector('.rush-t').classList.toggle('low', s <= 20);
  el.querySelector('.rush-sc b').textContent = T.ok; el.querySelector('.rush-sc span').textContent = T.ok === 1 ? 'acerto' : 'acertos';
  el.querySelector('.rush-bar i').style.transform = 'scaleX(' + Math.min(1, left / 180000).toFixed(4) + ')';
  const lv = el.querySelector('.rush-lives'), key = String(T.lives);
  if (lv.dataset.k !== key) {
    const lost = lv.dataset.k != null && +lv.dataset.k > T.lives; lv.dataset.k = key;
    lv.innerHTML = [0, 1, 2].map(i => '<svg viewBox="22 14 56 76" class="' + (i < T.lives ? 'on' : 'off' + (lost && i === T.lives ? ' gone' : '')) + '" aria-hidden="true"><path d="' + PAWN_D + '"/></svg>').join('');
  }
  const cb = el.querySelector('.rush-combo');
  cb.textContent = T.combo >= 2 ? 'Sequência ×' + T.combo : ''; cb.classList.toggle('on', T.combo >= 2);
}
function boardFlash(kind) {
  const w = $('#pzBoard') && $('#pzBoard').closest('.bwrap'); if (!w) return;
  w.classList.remove('fl-ok', 'fl-err'); void w.offsetWidth; w.classList.add('fl-' + kind);
}
function rushPop(sel) { const e = $('#pzRush ' + sel); if (!e) return; e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); }
function rushHit() {
  const T = S.tm; T.ok++; T.combo++; T.top = Math.max(T.top, T.combo);
  if (T.combo % 5 === 0) { T.end += 10000; T.bonus++; setTimeout(() => rushPop('.rush-bonus'), 0); }
  boardFlash('ok'); renderPzCount(); rushPop('.rush-combo');
}
function rushMiss() {
  const T = S.tm; if (!T || T.over) return;
  T.miss++; T.lives--; T.combo = 0; boardFlash('err'); renderPzCount();
  if (T.lives <= 0) finishTimed('lives');
}
function rushEnd(why) {
  const T = S.tm, best = store.get('rbest', 0); T.why = why; T.rec = T.ok > best; T.prev = best;
  if (T.rec) store.set('rbest', T.ok);
  const r = store.get('rush', {}); store.set('rush', { n: (r.n || 0) + 1, top: Math.max(r.top || 0, T.top), sum: (r.sum || 0) + T.ok });
  const lg = store.get('rushLog', []); lg.push({ t: Date.now(), ok: T.ok }); store.set('rushLog', lg.slice(-60));
  act('rush'); cloudPrefsPush(); haptic(T.rec ? 'ok' : 'err');
  $('#pzQ').innerHTML = '<b>Corrida encerrada.</b> ' + (T.why === 'lives' ? 'As três vidas acabaram.' : 'O tempo acabou.');
  if (T.rec && T.ok >= 3) sparkle($('#pzRush'));
}
function rushEndHtml() {
  const T = S.tm;
  return '<div class="rush-end fade"><span class="label">' + (T.why === 'lives' ? 'Acabaram as vidas' : 'Tempo esgotado') + '</span>' +
    '<div class="rush-big"><b class="mono">' + T.ok + '</b><span>acerto' + (T.ok === 1 ? '' : 's') + '</span></div>' +
    (T.rec ? '<span class="tag W">Novo recorde!' + (T.prev ? ' Antes: ' + T.prev : '') + '</span>' : '<span class="muted">Recorde: ' + store.get('rbest', 0) + '</span>') +
    '<p class="muted" style="font-size:13.5px">Nível ' + rushLevel() + ' · melhor sequência ' + T.top + (T.bonus ? ' · +' + (T.bonus * 10) + ' s de bônus' : '') + (T.miss ? ' · as ' + T.miss + ' que você errou voltam na revisão' : '') + '</p>' +
    '<button class="btn primary" type="button" data-pz="timed">Correr de novo</button></div>';
}
function sparkle(host) {
  if (!host || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div'); box.className = 'confetti'; box.setAttribute('aria-hidden', 'true');
  const cols = ['var(--accent)', 'var(--best)', 'var(--series-2)', '#e5c25a', 'var(--miss)'];
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('i');
    s.style.cssText = '--x:' + (Math.random() * 100).toFixed(1) + '%;--dx:' + ((Math.random() - .5) * 160).toFixed(0) + 'px;--r:' + (Math.random() * 720 - 360).toFixed(0) + 'deg;--d:' + (.9 + Math.random() * .9).toFixed(2) + 's;--delay:' + (Math.random() * .25).toFixed(2) + 's;background:' + cols[i % cols.length];
    box.appendChild(s);
  }
  host.appendChild(box); setTimeout(() => box.remove(), 2200);
}
document.addEventListener('visibilitychange', () => { if (S.tm && !S.tm.over) S.tm.lt = Date.now() - 250; });

/* ---------- Lances candidatos ---------- */
KIND_LAB.cand = 'Lances candidatos'; KIND_LAB.self = 'Você primeiro';
function candPool() {
  const seen = new Set(), out = [];
  const add = p => { const k = p.gid + ':' + p.ply; if (seen.has(k) || (p.mate && p.mate <= 2)) return; seen.add(k); out.push(p); };
  if (Object.keys(CRIT).length) critQueue().forEach(add);
  buildTraining().puzzles.forEach(add);
  return out;
}
function candLobbyHtml() {
  const c = store.get('cand', {}), n = candPool().length;
  arHead('Lances candidatos', n + ' posições das suas partidas');
  lobbyPreview('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'w');
  return '<p>Jogadores fortes não procuram <i>o</i> lance: primeiro listam os candidatos, depois calculam cada um. Aqui você faz isso em posições difíceis das suas partidas.</p>' +
    '<ol class="howto"><li>Faça no tabuleiro de 2 a 3 lances que você consideraria. Cada um vira uma seta.</li><li>Escolha qual deles você jogaria.</li><li>O motor revela as melhores linhas. Você ganha 2 pontos se o melhor lance estava entre os seus candidatos e mais 2 se escolheu certo.</li></ol>' +
    (c.n ? '<p class="muted">Rodadas: ' + c.n + ' · melhor pontuação: ' + (c.best || 0) + '/20 · melhor lance encontrado em ' + (c.found || 0) + ' de ' + (c.pos || 0) + ' posições</p>' : '') +
    (n ? '<div class="vxacts"><button class="btn primary" type="button" data-ar="go">Começar (5 posições)</button></div>' : '<p class="muted">Analise algumas partidas para gerar posições.</p>');
}
function startCand() {
  stopArenaTimers();
  const pick = shuffle(candPool().slice(0, 80)).slice(0, 5);
  const A = S.arena = { kind: 'cand', lobby: false, items: pick, r: 0, score: 0, found: 0, title: 'Lances candidatos' };
  arBoard(); $('#arClkTop').innerHTML = ''; $('#arClkBot').innerHTML = ''; AR.setArrows([]);
  if (!pick.length) { AR.setLive(null); arHead(A.title, ''); $('#arPanel').innerHTML = '<p>Analise mais partidas para gerar posições.</p>'; return; }
  candLoad();
}
async function candEngine(fen, side) {
  await Promise.race([Engine.init(), sleep(12000).then(() => { throw new Error('t'); })]);
  const r = await Engine.go(fen, 1300, { multi: 3 });
  return (r.lines || []).filter(l => l && l.pv && l.pv[0]).map(l => ({ uci: l.pv[0], pv: l.pv, wp: sideWp({ cp: l.cp, mate: l.mate }, side) }));
}
function candLoad() {
  const A = S.arena, it = A.items[A.r], g = S.games.find(x => x.id === it.gid); if (!g) { A.r++; return A.r < A.items.length ? candLoad() : candOver(); }
  const P = prep(g);
  Object.assign(A, { fen: P.fens[it.ply], side: it.side, cands: [], choice: null, phase: 'pick', res: null, g });
  const pm = it.ply > 0 ? P.moves[it.ply - 1] : null; A.last = pm ? [pm.from, pm.to] : null;
  AR.setFlip(A.side === 'b'); AR.setPosition(A.fen, false); AR.setArrows([]);
  arHead(A.title, 'vs ' + g.opp + ' · ' + dateLabel(g.end, true));
  // o motor começa a pensar enquanto você pensa
  const job = A.job = candEngine(A.fen, A.side); job.catch(() => {});
  candArm(); candPanel();
}
function candRedraw() {
  const A = S.arena; if (!A.items || !A.items.length) return startCand();
  if (A.over) { candPanel(); return; }
  AR.setFlip(A.side === 'b'); AR.setPosition(A.fen, false); arHead(A.title, 'vs ' + A.g.opp + ' · ' + dateLabel(A.g.end, true));
  if (A.phase === 'done') candShowResult(); else candArm();
  candPanel();
}
function candArrows() {
  const A = S.arena;
  AR.setArrows(A.cands.map((c, k) => ({ from: c.uci.slice(0, 2), to: c.uci.slice(2, 4), cls: 'a-cand' + (A.choice === k ? ' on' : '') })));
}
function candArm() {
  const A = S.arena; const marks = A.last ? { last: A.last } : {};
  AR.setMarks(marks); candArrows();
  if (A.phase !== 'pick') { AR.setLive(null); return; }
  AR.setLive({ color: A.side, dests: () => destsOf(A.fen), marks, onMove: (f, t) => candToggle(f, t) });
}
function candToggle(from, to) {
  const A = S.arena; if (!A || A.kind !== 'cand' || A.phase !== 'pick') return;
  // o lance não é jogado: a peça volta para a casa e o lance vira uma seta
  AR.instant(() => { for (const it of AR.items) it.el.style.transform = AR.tf(it.idx); });
  const c = new Chess(A.fen); let m; try { m = c.move({ from, to, promotion: 'q' }); } catch (e) { candArm(); return; }
  const uci = m.from + m.to + (m.promotion || ''), i = A.cands.findIndex(x => x.uci === uci);
  if (i >= 0) { A.cands.splice(i, 1); if (A.choice === i) A.choice = null; else if (A.choice > i) A.choice--; }
  else if (A.cands.length >= 3) toast('No máximo 3 candidatos. Toque no × de um deles para trocar.');
  else { A.cands.push({ uci, san: m.san }); if (A.cands.length === 1) A.choice = null; }
  haptic('move'); candArm(); candPanel();
}
function candPanel() {
  const A = S.arena; if (!A || A.kind !== 'cand') return;
  let h = '<div style="display:flex;justify-content:space-between"><span class="label">Posição ' + Math.min(A.r + 1, A.items.length) + ' de ' + A.items.length + '</span><span class="mono muted">' + A.score + ' ponto' + (A.score === 1 ? '' : 's') + '</span></div>';
  if (A.over) { $('#arPanel').innerHTML = '<div class="stack" style="gap:14px">' + h + candOverHtml() + '</div>'; return; }
  if (A.phase === 'pick') {
    h += '<p><b>' + SIDEC[A.side] + ' jogam.</b> Faça no tabuleiro os lances que você consideraria aqui. Cada um vira uma seta; faça de novo para tirar.</p>';
    h += '<div class="cands">' + (A.cands.length ? A.cands.map((c, k) => '<div class="cand' + (A.choice === k ? ' on' : '') + '"><button type="button" class="cand-pick" data-ar="cpick:' + k + '" aria-pressed="' + (A.choice === k) + '"><span class="mono">' + esc(fig(c.san)) + '</span><span class="muted">' + (A.choice === k ? 'eu jogaria este' : 'escolher') + '</span></button><button type="button" class="cand-x" data-ar="cdel:' + k + '" aria-label="Tirar ' + esc(c.san) + '">×</button></div>').join('') : '<p class="muted" style="font-size:13.5px">Nenhum candidato ainda.</p>') + '</div>';
    const ok = A.cands.length >= 2 && A.choice != null;
    h += '<p class="muted" style="font-size:13px">' + (A.cands.length < 2 ? 'Liste pelo menos 2 candidatos.' : A.choice == null ? 'Agora toque no candidato que você jogaria.' : 'Pronto para conferir.') + '</p>';
    h += '<div class="vxacts"><button class="btn primary" type="button" data-ar="ccheck"' + (ok ? '' : ' disabled') + '>Conferir com o motor</button><button class="btn small" type="button" data-ar="cskip">Pular</button></div>';
  } else if (A.phase === 'wait') h += '<p class="muted">O motor está conferindo as linhas…</p>';
  else if (A.phase === 'done') h += candResultHtml();
  $('#arPanel').innerHTML = '<div class="stack" style="gap:14px">' + h + '</div>';
}
async function candCheck() {
  const A = S.arena; if (A.phase !== 'pick' || A.cands.length < 2 || A.choice == null) return;
  A.phase = 'wait'; AR.setLive(null); candPanel();
  let lines = null; try { lines = await A.job; } catch (e) { lines = null; }
  if (S.arena !== A) return;
  if (!lines || !lines.length) { A.phase = 'pick'; candArm(); candPanel(); toast('O motor não respondeu neste aparelho. Tente de novo.'); A.job = candEngine(A.fen, A.side); A.job.catch(() => {}); return; }
  const best = lines[0];
  for (const c of A.cands) {
    const L = lines.find(l => l.uci === c.uci);
    if (L) { c.wp = L.wp; continue; }
    try { const ch = new Chess(A.fen); ch.move({ from: c.uci.slice(0, 2), to: c.uci.slice(2, 4), promotion: c.uci[4] || 'q' }); c.wp = sideWp(await evalPos(ch.fen(), 500), A.side); } catch (e) { c.wp = null; }
    if (S.arena !== A) return;
  }
  for (const c of A.cands) c.loss = c.wp == null ? null : Math.max(0, best.wp - c.wp);
  const found = A.cands.some(c => c.uci === best.uci || (c.loss != null && c.loss <= 3));
  const ch = A.cands[A.choice], cl = ch.loss == null ? 99 : ch.loss;
  const pts = (found ? 2 : 0) + (cl <= 3 ? 2 : cl <= 10 ? 1 : 0);
  A.score += pts; if (found) A.found++;
  A.res = { lines, best, found, pts, cl };
  A.phase = 'done'; haptic(pts >= 3 ? 'ok' : pts ? 'move' : 'err');
  candShowResult(); candPanel();
}
function candShowResult() {
  const A = S.arena, R = A.res; if (!R) return;
  const arr = R.lines.slice(1).map(l => ({ from: l.uci.slice(0, 2), to: l.uci.slice(2, 4), cls: 'a-alt' }));
  for (const c of A.cands) if (c.uci !== R.best.uci) arr.push({ from: c.uci.slice(0, 2), to: c.uci.slice(2, 4), cls: 'a-cand' + (A.cands[A.choice] === c ? ' on' : '') });
  arr.push({ from: R.best.uci.slice(0, 2), to: R.best.uci.slice(2, 4), cls: 'a-best' });
  AR.setArrows(arr); AR.setMarks(A.last ? { last: A.last } : {});
}
function candVerdict(c, R) { if (c.loss == null) return 'sem avaliação'; if (c.uci === R.best.uci) return 'o melhor lance'; if (c.loss <= 3) return 'tão bom quanto o melhor'; if (c.loss <= 10) return 'joga, mas perde ' + Math.round(c.loss) + ' pontos'; return 'perde ' + Math.round(c.loss) + ' pontos de chance'; }
function candResultHtml() {
  const A = S.arena, R = A.res, it = A.items[A.r];
  const l = lineSan(A.fen, R.best.pv.slice(0, 6)); let why = '';
  try { if (l[0]) { const w = ideaShort(factsFor(A.fen, l[0].m, it.ply), l[0].m); if (w) why = cap(w) + '. '; } } catch (e) { why = ''; }
  let h = '<div class="fb ' + (R.pts >= 3 ? 'ok' : R.pts ? 'hint' : 'no') + '">+' + R.pts + ' ponto' + (R.pts === 1 ? '' : 's') + '. ' + (R.found ? 'O melhor lance estava entre os seus candidatos' : 'O melhor lance não estava entre os seus candidatos') + (R.cl <= 3 ? ', e você escolheu certo.' : R.found ? ', mas você escolheu outro.' : '.') + '</div>';
  h += '<div class="stack" style="gap:6px"><span class="label">Seus candidatos</span>' + A.cands.map((c, k) => '<div class="crow' + (A.choice === k ? ' on' : '') + '"><span class="mono">' + esc(fig(c.san)) + '</span><span class="muted">' + esc(candVerdict(c, R)) + '</span>' + (A.choice === k ? '<span class="tag plain" style="padding:2px 7px">sua escolha</span>' : '') + '</div>').join('') + '</div>';
  h += '<div class="blk"><h3>O melhor: ' + esc(l[0] ? fig(l[0].san) : R.best.uci) + '</h3><p>' + esc(why + 'Linha: ' + l.slice(0, 5).map(x => fig(x.san)).join(' ') + '.') + '</p></div>';
  const others = R.lines.slice(1).map(L => { const s = lineSan(A.fen, [L.uci])[0]; return s ? fig(s.san) + ' (' + pct(L.wp) + ')' : ''; }).filter(Boolean);
  if (others.length) h += '<p class="muted" style="font-size:13.5px">Outras boas opções do motor: ' + esc(others.join(', ')) + '. Na partida você jogou ' + esc(fig(it.played)) + '.</p>';
  h += '<p class="muted" style="font-size:12.5px">Setas: verde é o melhor lance, azul são outras opções do motor, dourado são os seus candidatos.</p>';
  h += '<div class="vxacts"><button class="btn primary" type="button" data-ar="cnext">' + (A.r + 1 < A.items.length ? 'Próxima posição' : 'Ver resultado') + '</button><button class="btn small" type="button" data-openply="' + it.gid + ':' + it.ply + '">Ver na partida</button></div>';
  return h;
}
function candOver() {
  const A = S.arena; A.over = true; AR.setLive(null);
  const c = store.get('cand', {});
  store.set('cand', { n: (c.n || 0) + 1, found: (c.found || 0) + A.found, pos: (c.pos || 0) + A.items.length, best: Math.max(c.best || 0, A.score) });
  A.rec = A.score > (c.best || 0); act('cand'); cloudPrefsPush();
  candPanel(); if (A.rec && A.score >= 8) sparkle($('#arPanel'));
}
function candOverHtml() {
  const A = S.arena, max = A.items.length * 4;
  return '<div class="fb ' + (A.score >= max * .6 ? 'ok' : 'hint') + '">' + A.score + ' de ' + max + ' pontos' + (A.rec ? ' · novo recorde!' : '') + '</div><p>O melhor lance estava entre os seus candidatos em <b>' + A.found + ' de ' + A.items.length + '</b> posições. ' + (A.found >= 4 ? 'Ótima amplitude: você está olhando os lances certos.' : A.found >= 2 ? 'Quando o melhor lance escapa, costuma ser um lance que não parece natural: uma troca, um recuo ou um lance de peão. Inclua sempre um candidato assim.' : 'Antes de escolher, procure xeques, capturas e ameaças, dos dois lados. Os melhores lances costumam estar aí.') + '</p><div class="vxacts"><button class="btn primary" type="button" data-ar="crestart">Mais 5 posições</button></div>';
}
function candAction(a) {
  const A = S.arena;
  if (a === 'restart' || a === 'crestart') return startCand();
  if (a.startsWith('cdel:')) { const k = +a.slice(5); if (A.phase !== 'pick') return; A.cands.splice(k, 1); if (A.choice === k) A.choice = null; else if (A.choice > k) A.choice--; candArm(); candPanel(); return; }
  if (a.startsWith('cpick:')) { if (A.phase !== 'pick') return; A.choice = +a.slice(6); haptic('move'); candArrows(); candPanel(); return; }
  if (a === 'ccheck') return candCheck();
  if (a === 'cskip' || a === 'cnext') { A.r++; if (A.r < A.items.length) candLoad(); else candOver(); }
}

/* ---------- Você primeiro: a sua análise antes da do motor ---------- */
function selfGames() {
  const out = [];
  for (const g of analyzedGames().slice().sort((a, b) => b.end - a.end)) { if (out.length >= 30) break; const P = prepIf(g); if (P && P.cls) out.push(g); }
  return out;
}
function selfLobbyHtml() {
  const A = S.arena, gs = selfGames(), sv = store.get('self', {});
  const nDone = Object.keys(sv).length, avgS = nDone ? Math.round(Object.values(sv).reduce((s, x) => s + (x.s || 0), 0) / nDone) : null;
  arHead('Você primeiro', nDone ? nDone + ' partida' + (nDone > 1 ? 's' : '') + ' revisada' + (nDone > 1 ? 's' : '') + ' · autocrítica média ' + avgS + '%' : 'Sua análise antes da do motor');
  let h = '<p>Logo depois de jogar, antes de abrir o motor: percorra a partida, marque os lances seus que você acha que foram erros e escreva em uma frase o que a partida te ensinou. Depois o app compara com o motor e dá uma nota à sua autocrítica.</p>';
  if (!gs.length) { lobbyPreview('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'w'); return h + '<p class="muted">Analise uma partida para começar.</p>'; }
  A.sel = Math.min(A.sel || 0, gs.length - 1);
  h += '<div class="stack" style="gap:6px;max-height:46vh;overflow:auto">' + gs.map((g, i) => { const d = sv[g.id]; return '<button class="repmv arow" type="button" data-ar="pick:' + i + '"' + (A.sel === i ? ' aria-current="true"' : '') + '><span style="min-width:0;display:flex;flex-direction:column;gap:1px"><b>vs ' + esc(g.opp) + ' · ' + dateLabel(g.end) + '</b><span class="muted" style="font-size:12.5px">' + esc(opName(g)) + '</span></span><span class="tag ' + rk(g) + '" style="padding:3px 7px">' + ({ W: 'vitória', D: 'empate', L: 'derrota' })[rk(g)] + '</span>' + (d ? '<span class="tag plain" style="padding:3px 7px">' + d.s + '%</span>' : '<span></span>') + '</button>'; }).join('') + '</div>';
  const g = gs[A.sel]; lobbyPreview('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', g.c);
  h += '<div class="vxacts"><button class="btn primary" type="button" data-ar="go">' + (sv[g.id] ? 'Fazer de novo' : 'Começar') + '</button></div>';
  const notes = gs.filter(x => sv[x.id] && sv[x.id].note).slice(0, 4);
  if (notes.length) h += '<div class="stack" style="gap:8px"><span class="label">O que as partidas te ensinaram</span>' + notes.map(x => '<div class="note"><p>“' + esc(sv[x.id].note) + '”</p><span class="muted">vs ' + esc(x.opp) + ' · ' + dateLabel(x.end) + '</span></div>').join('') + '</div>';
  return h;
}
function selfOpen(gid) {
  stopArenaTimers(); S.arena = { kind: 'self', lobby: true, sel: 0 }; S.pendingSelf = gid;
  if (location.hash === '#arena') { S.view = ''; route(); } else location.hash = 'arena';
}
function startSelf(gid) {
  stopArenaTimers();
  const g = S.games.find(x => x.id === gid); if (!g) return;
  const P = prep(g); if (!P.cls) { toast('Esta partida ainda não foi analisada.'); return; }
  S.arena = { kind: 'self', lobby: false, gid, ply: 0, marks: [], note: (store.get('self', {})[gid] || {}).note || '', phase: 'mark', title: 'Você primeiro' };
  arBoard(); AR.setLive(null); AR.setArrows([]); $('#arClkTop').innerHTML = ''; $('#arClkBot').innerHTML = '';
  AR.setFlip(g.c === 'b'); selfDraw();
}
function selfDraw() {
  const A = S.arena, g = S.games.find(x => x.id === A.gid), P = prep(g);
  arHead('vs ' + g.opp + ' · ' + dateLabel(g.end, true), opName(g) + ' · você de ' + SIDE[g.c]);
  AR.setFlip(g.c === 'b');
  if (A.phase === 'done' && A.show != null) {
    const j = A.show, m = P.moves[j], eb = P.evs[j];
    AR.setPosition(P.fens[j], false); AR.setMarks({ last: [m.from, m.to], bad: m.to });
    AR.setArrows((eb && eb.best ? [{ from: eb.best.slice(0, 2), to: eb.best.slice(2, 4), cls: 'a-best' }] : []).concat([{ from: m.from, to: m.to, cls: 'a-bad' }]));
  } else {
    AR.setPosition(P.fens[A.ply], false); AR.setArrows([]);
    const m = A.ply > 0 ? P.moves[A.ply - 1] : null; AR.setMarks(m ? { last: [m.from, m.to] } : {});
  }
  selfPanel();
}
function selfErr(P, g) { const E = new Set(), I = new Set(); P.cls.forEach((c, i) => { if (P.moves[i].color !== g.c) return; if (c.k === 'mistake' || c.k === 'blunder' || c.k === 'miss') E.add(i); else if (c.k === 'inacc') I.add(i); }); return { E, I }; }
function selfPanel() {
  const A = S.arena; if (!A || A.kind !== 'self') return;
  const g = S.games.find(x => x.id === A.gid), P = prep(g), cur = A.ply - 1, curMine = cur >= 0 && P.moves[cur].color === g.c;
  let h = '';
  if (A.phase === 'mark') {
    h += '<p style="font-size:14.5px"><b>Sem olhar o motor.</b> Percorra a partida e marque os lances <b>seus</b> que você acha que foram erros. Toque num lance para ir até ele; toque de novo num lance seu para marcar.</p>';
    h += '<div class="selfnav"><button class="btn small" type="button" data-ar="snav:first" aria-label="Início">⏮</button><button class="btn small" type="button" data-ar="snav:prev" aria-label="Lance anterior">◀</button><span class="mono">' + (A.ply ? esc(moveNum(cur) + fig(P.moves[cur].san)) : 'Início') + '</span><button class="btn small" type="button" data-ar="snav:next" aria-label="Próximo lance">▶</button><button class="btn small" type="button" data-ar="snav:last" aria-label="Fim">⏭</button></div>';
    h += '<button class="btn small' + (curMine && A.marks.includes(cur) ? ' accent' : '') + '" type="button" data-ar="smark"' + (curMine ? '' : ' disabled') + '>' + (!curMine ? 'Vá até um lance seu para marcar' : A.marks.includes(cur) ? 'Desmarcar ' + esc(fig(P.moves[cur].san)) : 'Marcar ' + esc(fig(P.moves[cur].san)) + ' como erro') + '</button>';
    h += '<div class="spot selfmoves">' + P.moves.map((m, j) => { const mine = m.color === g.c; return '<button type="button" class="sp' + (mine ? '' : ' them') + (A.marks.includes(j) ? ' mk' : '') + (j === cur ? ' cur' : '') + '" data-ar="sgo:' + j + '"><span class="mono">' + esc(moveNum(j) + fig(m.san)) + '</span></button>'; }).join('') + '</div>';
    h += '<label class="stack" style="gap:6px"><span class="label">O que esta partida te ensinou? (opcional)</span><textarea id="selfNote" rows="2" maxlength="280" placeholder="Ex.: troquei a dama cedo e fiquei sem plano no meio-jogo">' + esc(A.note || '') + '</textarea></label>';
    h += '<div class="vxacts"><button class="btn primary" type="button" data-ar="scheck">Comparar com o motor (' + A.marks.length + ' marcado' + (A.marks.length === 1 ? '' : 's') + ')</button></div>';
  } else {
    const R = A.res;
    h += '<div class="selfscore"><svg viewBox="0 0 44 44" width="76" height="76" aria-hidden="true"><circle cx="22" cy="22" r="18" fill="none" stroke="var(--surface-2)" stroke-width="5"/><circle cx="22" cy="22" r="18" fill="none" stroke="' + (R.s >= 70 ? 'var(--best)' : R.s >= 40 ? 'var(--accent)' : 'var(--mistake)') + '" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + (R.s / 100 * 113.1).toFixed(1) + ' 113.1" transform="rotate(-90 22 22)" class="ring"/></svg><div class="stack" style="gap:2px"><span class="label">Autocrítica</span><b class="mono" style="font-size:30px;line-height:1">' + R.s + '%</b><span class="muted" style="font-size:13px">' + (R.e ? 'Você achou ' + R.h + ' de ' + R.e + ' erro' + (R.e > 1 ? 's' : '') : 'Sem erros graves seus nesta partida') + (R.f ? ' · ' + R.f + ' alarme' + (R.f > 1 ? 's' : '') + ' falso' + (R.f > 1 ? 's' : '') : '') + '</span></div></div>';
    h += '<p style="font-size:14px">' + (!R.e ? (R.f ? 'O motor não viu erros graves seus aqui: os lances que você marcou eram jogáveis. Desconfiar é bom, mas vale entender por que eles pareciam ruins.' : 'Partida limpa, e você não viu fantasmas. Ótimo.') : R.s >= 80 ? 'Olhar afiado: você enxerga os próprios erros sem precisar do motor. É isso que faz a melhora durar.' : R.h ? 'Bom começo. Os erros que passaram batido costumam ter um padrão: veja abaixo se eles se parecem.' : 'Os erros desta partida passaram despercebidos. Isso é comum e é exatamente o que este treino desenvolve: repita depois de cada partida séria.') + '</p>';
    const row = (j, kind) => { const m = P.moves[j], c = P.cls[j]; return '<button type="button" class="srow ' + kind + (A.show === j ? ' cur' : '') + '" data-ar="sshow:' + j + '"><span class="kb k-' + c.k + '">' + esc(CLS[c.k].s) + '</span><span class="mono">' + esc(moveNum(j) + fig(m.san)) + '</span><span class="muted">' + (kind === 'hit' ? 'você viu' : kind === 'miss' ? 'passou batido' : 'não era erro') + '</span></button>'; };
    const hits = [...R.E].filter(j => A.marks.includes(j)), miss = [...R.E].filter(j => !A.marks.includes(j)), fal = A.marks.filter(j => !R.E.has(j) && !R.I.has(j));
    if (R.E.size || fal.length) h += '<div class="stack" style="gap:6px"><span class="label">Toque para ver o lance e o melhor</span>' + hits.map(j => row(j, 'hit')).concat(miss.map(j => row(j, 'miss')), fal.map(j => row(j, 'false'))).join('') + '</div>';
    if (A.show != null) { const C = coachFor(P, A.show); h += '<div class="blk"><h3>' + esc(moveNum(A.show) + fig(P.moves[A.show].san)) + '</h3><p>' + esc([C.verdict[0], C.punish[0]].filter(Boolean).join(' ') + (C.best ? ' Melhor era ' + fig(C.best.san) + (C.best.why ? ', que ' + C.best.why : '') + '.' : '')) + '</p></div>'; }
    if (A.note) h += '<div class="note"><span class="label">Sua lição</span><p>“' + esc(A.note) + '”</p></div>';
    h += '<div class="vxacts"><button class="btn small primary" type="button" data-openply="' + g.id + ':0">Abrir a análise completa</button><button class="btn small" type="button" data-ar="lobby">Outra partida</button></div>';
  }
  $('#arPanel').innerHTML = '<div class="stack" style="gap:14px">' + h + '</div>';
  const cb = $('#arPanel .sp.cur'); if (cb) { const box = cb.parentElement; if (box.scrollHeight > box.clientHeight) box.scrollTop = cb.offsetTop - box.clientHeight / 2; }
}
function selfAction(a) {
  const A = S.arena, g = S.games.find(x => x.id === A.gid), P = prep(g), n = P.moves.length;
  if (a === 'restart') return startSelf(A.gid);
  if (a.startsWith('snav:')) { const k = a.slice(5); A.ply = k === 'first' ? 0 : k === 'last' ? n : Math.max(0, Math.min(n, A.ply + (k === 'next' ? 1 : -1))); selfDraw(); return; }
  if (a.startsWith('sgo:')) {
    const j = +a.slice(4);
    if (A.ply === j + 1 && P.moves[j].color === g.c) return selfAction('smark');
    A.ply = j + 1; selfDraw(); return;
  }
  if (a === 'smark') { const j = A.ply - 1; if (j < 0 || P.moves[j].color !== g.c) return; const i = A.marks.indexOf(j); if (i >= 0) A.marks.splice(i, 1); else A.marks.push(j); haptic('move'); selfPanel(); return; }
  if (a === 'scheck') {
    const t = $('#selfNote'); if (t) A.note = t.value.trim().slice(0, 280);
    const { E, I } = selfErr(P, g);
    const h = A.marks.filter(j => E.has(j)).length, f = A.marks.filter(j => !E.has(j) && !I.has(j)).length;
    // alarme falso pesa metade de um erro que passou batido; sem erros na partida, cada alarme falso tira 25
    const s = E.size ? Math.min(100, Math.round(100 * h / (E.size + f * .5))) : Math.max(0, 100 - 25 * f);
    A.res = { E, I, s, h, f, e: E.size }; A.phase = 'done'; A.show = null;
    const sv = store.get('self', {}); sv[A.gid] = { s, e: E.size, h, f, note: A.note || '', t: Date.now() }; store.set('self', sv);
    act('self'); cloudPrefsPush(); haptic(s >= 70 ? 'ok' : 'move');
    selfDraw(); if (s >= 80 && E.size) sparkle($('#arPanel')); return;
  }
  if (a.startsWith('sshow:')) { A.show = +a.slice(6); selfDraw(); return; }
}
document.addEventListener('input', e => { if (e.target && e.target.id === 'selfNote' && S.arena && S.arena.kind === 'self') S.arena.note = e.target.value.slice(0, 280); });
document.addEventListener('keydown', e => {
  const A = S.arena; if (S.view !== 'arena' || !A || A.kind !== 'self' || A.lobby || A.phase !== 'mark' || e.target.closest('input,textarea,select')) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); selfAction('snav:prev'); } else if (e.key === 'ArrowRight') { e.preventDefault(); selfAction('snav:next'); } else if (e.key === ' ' || e.key === 'm') { e.preventDefault(); selfAction('smark'); }
});

/*@BADGES@*/
/*@ACAD@*/
/*@PLUS@*/
setTimeout(() => { try { gpDoneP().then(badgeSoon); } catch (e) { badgeSoon(); } }, 3000);
