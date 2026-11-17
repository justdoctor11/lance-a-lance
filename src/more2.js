/* =====================================================================
   Versão 1.3: análise com prova, zona decidida, momentos críticos,
   estatísticas novas, adversário humano (Maia), Ache o erro, às cegas,
   padrões de mate, fila de revisão e árvore do adversário.
   ===================================================================== */

/* ---------- prova: saldo de material quando as capturas terminam ---------- */
const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v);
function settledSwing(fen, line, side) {
  if (!line.length) return { v: 0, sure: true, at: -1, steps: [] };
  const a0 = material(parseBoard(fen)), base = a0[side] - a0[other(side)];
  const steps = line.map(x => { const a = material(parseBoard(x.m.after)); return a[side] - a[other(side)] - base; });
  let at = -1;
  for (let k = line.length - 1; k >= 0; k--) {
    const next = line[k + 1];
    const quiet = next ? !next.m.captured && !line[k].san.includes('+') : !line[k].m.captured;
    if (quiet) { at = k; break; }
  }
  return { v: at >= 0 ? steps[at] : steps[steps.length - 1], sure: at >= 0, at, steps };
}
function proofHtml(line, side, R) {
  if (!line || !line.length || !R) return '';
  return '<details class="proof"><summary>Ver a prova</summary><div class="pf">' + line.map((x, k) => '<span' + (k === R.at ? ' class="at"' : '') + '><b>' + esc(fig(x.san)) + '</b><i class="mono">' + sgn(R.steps[k]) + '</i></span>').join('') + '</div><p class="muted" style="font-size:12.5px">' +
    (R.sure ? 'Saldo de material das ' + SIDE[side] + ' quando as trocas terminam (lance destacado): ' + sgn(R.v) + '. Peão 1, cavalo e bispo 3, torre 5, dama 9.' : 'A linha do motor termina no meio de uma troca, então o saldo ainda pode mudar. Por isso o treinador não afirma ganho de material aqui.') + '</p></details>';
}

/* ---------- momentos críticos (MultiPV) ---------- */
var CRIT = {};
kv.get('crit', {}).then(v => { CRIT = v || {}; for (const gid in CRIT) { const P = PREP.get(gid); if (P && P.evs) classify(P); } TRAIN = null; }).catch(() => {});
const CRITING = new Map();
function lineWp(l, mover) { if (!l) return null; return sideWp({ cp: l.cp, mate: l.mate }, mover); }
async function critPass(g, onProg) {
  if (CRITING.has(g.id)) return CRITING.get(g.id);
  const job = (async () => {
    await Engine.init(); const P = prep(g); if (!P.evs) return null;
    const out = new Array(P.moves.length).fill(null); const idx = [];
    P.moves.forEach((m, i) => { if (m.color === g.c && legalCount(P.fens[i]) > 1) idx.push(i); });
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k], r = await Engine.go(P.fens[i], 260, { multi: 2 });
      const L1 = r.lines && r.lines[0], L2 = r.lines && r.lines[1];
      if (L1 && L2 && L1.pv[0]) { const w1 = lineWp(L1, g.c), w2 = lineWp(L2, g.c); out[i] = [Math.round(w1 - w2), L2.pv[0] || '', Math.round(w1), L1.pv[0]]; }
      if (onProg) onProg((k + 1) / idx.length);
    }
    CRIT[g.id] = out; kv.set('crit', CRIT); classify(P); TRAIN = null; return out;
  })();
  CRITING.set(g.id, job);
  try { return await job; } finally { CRITING.delete(g.id); }
}
function critOf(P, i) { const a = CRIT[P.g.id]; return a && a[i] ? { gap: a[i][0], second: a[i][1], wp: a[i][2], best: a[i][3] } : null; }
const isOnly = cr => cr && cr.gap >= 15 && cr.wp >= 30;
let CRIT_BG = null;
function critAuto(P) {
  if (!P || !P.evs || CRIT[P.g.id] || CRIT_BG) return;
  CRIT_BG = setTimeout(async () => {
    CRIT_BG = null; if (currentP() !== P || S.view !== 'analise' || CRIT[P.g.id]) return;
    const chip = $('#critChip'); if (chip) chip.hidden = false;
    try { await critPass(P.g, f => { const c = $('#critChip'); if (c && currentP() === P) c.textContent = 'Momentos críticos ' + Math.round(f * 100) + '%'; }); } catch (e) { /* sem motor */ }
    if (currentP() === P && S.view === 'analise' && !S.guess && !S.vx) { drawMoves(P); showPly(P, S.ply, false); const c = $('#critChip'); if (c) c.hidden = true; }
  }, 1500);
}
async function critBulk(n) {
  const gs = analyzedGames().slice().sort((a, b) => b.end - a.end).filter(g => !CRIT[g.id]).slice(0, n);
  if (!gs.length) { toast('Todas as partidas recentes já têm os momentos críticos'); return; }
  toast('Calculando momentos críticos de ' + gs.length + ' partidas em segundo plano');
  for (let k = 0; k < gs.length; k++) { try { await critPass(gs[k]); } catch (e) { break; } const t = $('#critBulk'); if (t) t.textContent = (k + 1) + ' de ' + gs.length + ' partidas'; }
  toast('Momentos críticos prontos'); if (S.view === 'treino') renderTreino();
}
function critQueue() {
  const out = [];
  for (const gid in CRIT) {
    const g = S.games.find(x => x.id === gid); if (!g) continue; const P = prep(g); if (!P.cls) continue;
    CRIT[gid].forEach((a, i) => {
      if (!a || a[0] < 15 || a[2] < 35 || !P.evs[i] || !P.evs[i].best) return;
      out.push({ key: 'cr:' + gid + ':' + i, gid, ply: i, side: g.c, best: P.evs[i].best, k: P.cls[i].k, played: P.moves[i].san, loss: P.cls[i].loss, mate: isMateFor(P.evs[i], g.c) ? Math.abs(P.evs[i].mate) : 0, crit: a[0], found: P.cls[i].uci === P.evs[i].best });
    });
  }
  return out.sort((a, b) => (a.found - b.found) || (b.crit - a.crit));
}

/* ---------- estatísticas ---------- */
let STATS = null, STATSKEY = '';
function statsData() {
  const key = acctKey() + ':' + S.games.length + ':' + analyzedGames().length + ':' + Object.keys(CRIT).length;
  if (STATS && STATSKEY === key) return STATS;
  STATS = { key }; STATSKEY = key; return STATS;
}
const gLink = (g, txt) => '<button class="linkbtn" type="button" data-openply="' + g.id + ':0">' + esc(txt) + '</button>';
function recordsHtml() {
  const G = S.games.slice().sort((a, b) => a.end - b.end); if (!G.length) return '<p class="muted">Sem partidas.</p>';
  const cards = [];
  const peaks = {}; for (const g of G) if (g.mR && g.tc !== 'daily' && (!peaks[g.tc] || g.mR > peaks[g.tc].mR)) peaks[g.tc] = g;
  for (const tc of ['blitz', 'rapid', 'bullet']) if (peaks[tc]) cards.push(['Pico de rating · ' + TC[tc], String(peaks[tc].mR), dateLabel(peaks[tc].end, true), peaks[tc]]);
  const wins = G.filter(g => rk(g) === 'W' && g.oR);
  if (wins.length) { const b = wins.reduce((a, g) => g.oR > a.oR ? g : a); cards.push(['Melhor vitória', 'vs ' + b.oR, b.opp + ' · ' + dateLabel(b.end, true), b]); }
  let run = 0, best = 0, bestEnd = null, un = 0, bestUn = 0;
  for (const g of G) { if (rk(g) === 'W') { run++; if (run > best) { best = run; bestEnd = g; } } else run = 0; if (rk(g) !== 'L') { un++; bestUn = Math.max(bestUn, un); } else un = 0; }
  if (best) cards.push(['Maior sequência de vitórias', best + ' seguidas', 'invicto por até ' + bestUn + ' partidas', bestEnd]);
  const fast = G.filter(g => rk(g) === 'W' && g.oRes === 'checkmated').sort((a, b) => a.mv.split(' ').length - b.mv.split(' ').length)[0];
  if (fast) cards.push(['Mate mais rápido', Math.ceil(fast.mv.split(' ').length / 2) + ' lances', 'vs ' + fast.opp + ' · ' + dateLabel(fast.end, true), fast]);
  const an = analyzedGames().map(g => ({ g, P: prep(g) })).filter(x => x.P.acc && x.P.moves.length >= 40);
  if (an.length) {
    const ba = an.reduce((a, x) => (x.P.acc[x.g.c] || 0) > (a.P.acc[a.g.c] || 0) ? x : a); cards.push(['Melhor precisão', pct(ba.P.acc[ba.g.c]), 'vs ' + ba.g.opp + ' · ' + dateLabel(ba.g.end, true), ba.g]);
    const cb = an.filter(x => rk(x.g) !== 'L').map(x => ({ x, low: Math.min.apply(null, x.P.evs.slice(10).map(e => sideWp(e, x.g.c))) })).sort((a, b) => a.low - b.low)[0];
    if (cb && cb.low < 25) cards.push(['Maior virada', pct(cb.low) + ' → ' + (rk(cb.x.g) === 'W' ? 'vitória' : 'empate'), 'vs ' + cb.x.g.opp + ' · ' + dateLabel(cb.x.g.end, true), cb.x.g]);
  }
  const losses = G.filter(g => rk(g) === 'L' && g.oR);
  if (losses.length) { const w = losses.reduce((a, g) => g.oR < a.oR ? g : a); cards.push(['Derrota mais dolorida', 'vs ' + w.oR, w.opp + ' · ' + dateLabel(w.end, true), w]); }
  const longest = G.reduce((a, g) => g.mv.length > a.mv.length ? g : a); cards.push(['Partida mais longa', Math.ceil(longest.mv.split(' ').length / 2) + ' lances', 'vs ' + longest.opp + ' · ' + dateLabel(longest.end, true), longest]);
  const draws = G.filter(g => rk(g) === 'D').length;
  let h = '<div class="recs">' + cards.map(([t, big, sub, g]) => '<button class="rec" type="button" data-openply="' + g.id + ':0"><span class="label">' + esc(t) + '</span><b class="mono">' + esc(big) + '</b><span class="muted">' + esc(sub) + '</span></button>').join('') + '</div>';
  const ops = {}; for (const g of G) { const k = opName(g).split(',')[0]; const x = ops[k] = ops[k] || { k, n: 0, s: 0 }; x.n++; x.s += rk(g) === 'W' ? 1 : rk(g) === 'D' ? .5 : 0; }
  const top = Object.values(ops).sort((a, b) => b.n - a.n).slice(0, 5);
  h += '<p style="font-size:14px">' + G.length + ' partidas · ' + sp(draws / G.length * 100, 1) + '% de empates · aberturas mais jogadas: ' + top.map(x => esc(x.k) + ' (' + x.n + ', ' + sp(x.s / x.n * 100) + '%)').join(', ') + '.</p>';
  return h;
}
function openingsDeep() {
  const PIN = store.get('pinLines', []); const now = Date.now() / 1000, cut = now - 90 * 86400;
  const rows = {};
  for (const g of S.games) {
    const mv = g.mv.split(' '); if (mv.length < 10) continue;
    const key = g.c + '|' + mv.slice(0, 8).join(' ');
    const x = rows[key] = rows[key] || { key, c: g.c, mv: mv.slice(0, 8), n: 0, W: 0, D: 0, L: 0, rn: 0, rs: 0, on: 0, os: 0, ev: [], name: opName(g) };
    const r = rk(g), s = r === 'W' ? 1 : r === 'D' ? .5 : 0; x.n++; x[r]++;
    if (g.end >= cut) { x.rn++; x.rs += s; } else { x.on++; x.os += s; }
    if (S.an[g.id]) { const P = prep(g); if (P.evs && P.evs[20]) x.ev.push(evFor(P.evs[20], g.c) / 100); }
  }
  const all = Object.values(rows).filter(x => x.n >= 4 || PIN.includes(x.key));
  const base = scoreOf(S.games) || 50;
  const row = x => {
    const s = (x.W + x.D / 2) / x.n * 100, tr = x.rn >= 3 && x.on >= 3 ? x.rs / x.rn * 100 - x.os / x.on * 100 : null, ev = avg(x.ev);
    const pinned = PIN.includes(x.key);
    return '<div class="oprow"><button class="pin' + (pinned ? ' on' : '') + '" type="button" data-pin="' + esc(x.key) + '" aria-label="' + (pinned ? 'Deixar de acompanhar' : 'Acompanhar esta linha') + '" aria-pressed="' + pinned + '">★</button><span class="opn"><b>' + esc(x.name.split(',')[0]) + '</b><span class="mono muted">' + esc(pathSan(x.mv)) + '</span></span><span class="wdl"><i style="flex:' + x.W + '"></i><i style="flex:' + x.D + '"></i><i style="flex:' + x.L + '"></i></span><b class="mono' + (s < base - 8 ? ' down' : s > base + 8 ? ' up' : '') + '">' + sp(s) + '%</b><span class="mono muted">' + x.n + '</span><span class="mono ' + (tr == null ? 'muted' : tr >= 0 ? 'up' : 'down') + '" title="Últimos 90 dias contra antes">' + (tr == null ? '—' : (tr >= 0 ? '▲' : '▼') + sp(Math.abs(tr))) + '</span><span class="mono muted" title="Avaliação média no lance 10">' + (ev == null ? '—' : (ev >= 0 ? '+' : '−') + sp(Math.abs(ev), 1)) + '</span></div>';
  };
  const head = '<div class="oprow head"><span></span><span>Linha (8 primeiros lances)</span><span></span><span>Pontos</span><span>Jogos</span><span>90 dias</span><span>Aval. lance 10</span></div>';
  const pins = all.filter(x => PIN.includes(x.key));
  let h = '';
  if (pins.length) h += '<div class="stack" style="gap:6px"><span class="label">Linhas que você acompanha</span><div class="optbl">' + head + pins.map(row).join('') + '</div></div>';
  for (const c of ['w', 'b']) { const L = all.filter(x => x.c === c && !PIN.includes(x.key)).sort((a, b) => b.n - a.n).slice(0, 8); if (L.length) h += '<div class="stack" style="gap:6px"><span class="label">De ' + SIDE[c] + '</span><div class="optbl">' + head + L.map(row).join('') + '</div></div>'; }
  const sug = [];
  for (const c of ['w', 'b']) {
    const walk = (node, path) => {
      if (path.length >= 10) return;
      const myTurn = (path.length % 2 === 0) === (c === 'w');
      const kids = Object.entries(node.ch).filter(([, ch]) => ch.n >= 3);
      if (myTurn && kids.length >= 2) {
        const main = kids.sort((a, b) => b[1].n - a[1].n)[0], alt = kids.filter(k => k !== main).sort((a, b) => nodeScore(b[1]) - nodeScore(a[1]))[0];
        if (main[1].n >= 6 && alt && nodeScore(alt[1]) - nodeScore(main[1]) >= 15) sug.push({ path, main: main[0], alt: alt[0], ms: nodeScore(main[1]), mn: main[1].n, as: nodeScore(alt[1]), an: alt[1].n });
      }
      for (const [m, ch] of Object.entries(node.ch)) if (ch.n >= 6) walk(ch, path.concat(m));
    };
    walk(repTree(c), []);
  }
  if (sug.length) h += '<div class="callout"><span class="label">Escolhas que rendem abaixo do possível</span><ul class="facts">' + sug.slice(0, 4).map(x => '<li>Depois de ' + esc(x.path.length ? pathSan(x.path) : 'o início') + ', você costuma jogar <b>' + esc(fig(x.main)) + '</b> (' + x.mn + ' partidas, ' + sp(x.ms) + '%), mas com <b>' + esc(fig(x.alt)) + '</b> fez ' + sp(x.as) + '% em ' + x.an + '.</li>').join('') + '</ul></div>';
  return h || '<p class="muted">Ainda não há linhas com 4 partidas ou mais.</p>';
}
function egType(B) {
  const has = t => B.some(p => p && p.t === t);
  if (has('q')) return 'Dama';
  const r = has('r'), mn = has('n') || has('b');
  if (r && mn) return 'Torre e peça menor'; if (r) return 'Torres'; if (mn) return 'Peças menores'; return 'Peões';
}
async function sliced(arr, fn) { let t = performance.now(); for (const x of arr) { fn(x); if (performance.now() - t > 10) { await new Promise(r => setTimeout(r, 0)); t = performance.now(); } } }
async function tradesEndsHtml() {
  const T = { mine: [], theirs: [] }, capAcc = [], quietAcc = [], eg = {};
  await sliced(analyzedGames(), g => {
    const P = prep(g); if (!P.cls) return; const me = g.c;
    for (let i = 0; i + 1 < P.moves.length; i++) {
      const m = P.moves[i], n = P.moves[i + 1];
      if (m.color === me) (m.captured ? capAcc : quietAcc).push(P.cls[i].acc);
      if (m.captured && n.captured && n.to === m.to) {
        const a0 = material(parseBoard(P.fens[i])), a2 = material(parseBoard(P.fens[i + 2]));
        if (Math.abs((a2.w - a2.b) - (a0.w - a0.b)) <= 1) { const d = sideWp(P.evs[i + 2], me) - sideWp(P.evs[i], me); (m.color === me ? T.mine : T.theirs).push(d); }
      }
    }
    let i0 = -1; for (let i = 0; i < P.moves.length; i++) if (phaseOf(parseBoard(P.fens[i]), i) === 'final') { i0 = i; break; }
    if (i0 >= 0) {
      const t = egType(parseBoard(P.fens[i0])); const x = eg[t] = eg[t] || { t, n: 0, s: 0, me: [0, 0], op: [0, 0] };
      x.n++; x.s += rk(g) === 'W' ? 1 : rk(g) === 'D' ? .5 : 0;
      for (let i = i0; i < P.moves.length; i++) { const s = P.moves[i].color === me ? x.me : x.op; s[1]++; if (P.cls[i].k === 'mistake' || P.cls[i].k === 'blunder' || P.cls[i].k === 'miss') s[0]++; }
    }
  });
  const tline = (lab, L) => { if (!L.length) return ''; const a = avg(L), bad = L.filter(d => d <= -5).length / L.length * 100; return '<div class="hrow"><span>' + lab + '</span><span class="hbar"><i style="width:' + Math.max(0, Math.min(100, 50 + a * 5)) + '%"></i><em style="left:50%"></em></span><b class="mono ' + (a >= 0 ? 'up' : 'down') + '">' + (a >= 0 ? '+' : '−') + sp(Math.abs(a), 1) + '</b><span class="mono muted">' + L.length + '</span></div><p class="muted" style="font-size:12.5px;margin:-2px 0 6px">' + sp(bad) + '% delas pioraram a sua chance em 5 pontos ou mais.</p>'; };
  let h = '<div class="hgrp"><span class="label">Trocas de mesmo material: variação média da sua chance de vitória</span>' + tline('Trocas que você inicia', T.mine) + tline('Trocas que o adversário inicia', T.theirs) + '</div>';
  if (capAcc.length && quietAcc.length) h += '<p style="font-size:14px">Precisão nas suas capturas: <b>' + pct(avg(capAcc)) + '</b> · nos outros lances: <b>' + pct(avg(quietAcc)) + '</b>.</p>';
  const rows = Object.values(eg).sort((a, b) => b.n - a.n);
  if (rows.length) h += '<div class="tbl"><table><thead><tr><th>Tipo de final</th><th>Partidas</th><th>Pontos</th><th>Seus erros / 100 lances</th><th>Do adversário</th></tr></thead><tbody>' + rows.map(x => '<tr><td>' + x.t + '</td><td class="mono">' + x.n + '</td><td class="mono">' + sp(x.s / x.n * 100) + '%</td><td class="mono' + (x.me[1] && x.op[1] && x.me[0] / x.me[1] > x.op[0] / x.op[1] * 1.2 ? ' down' : '') + '">' + (x.me[1] ? sp(x.me[0] / x.me[1] * 100, 1) : '—') + '</td><td class="mono">' + (x.op[1] ? sp(x.op[0] / x.op[1] * 100, 1) : '—') + '</td></tr>').join('') + '</tbody></table></div>';
  return h + '<p class="muted" style="font-size:12.5px">Com base nas ' + analyzedGames().length + ' partidas analisadas pelo motor.</p>';
}
function clockDeepHtml() {
  const bk = [[.5, 1.01, 'Mais de 50% do tempo'], [.25, .5, '25% a 50%'], [.1, .25, '10% a 25%'], [0, .1, 'Menos de 10%']].map(([a, b, t]) => ({ a, b, t, n: 0, e: 0 }));
  let toWin = [], toAll = 0; const thinkBad = [], thinkAll = [];
  for (const g of analyzedGames()) {
    const P = prep(g); if (!P.cls) continue; const b = baseOf(g), spt = spentList(g);
    if (g.res === 'timeout') { toAll++; const last = P.evs[P.evs.length - 1]; if (sideWp(last, g.c) >= 60) toWin.push(g); }
    if (!b || !g.clk || !spt) continue;
    P.moves.forEach((m, i) => {
      if (m.color !== g.c || g.clk[i] == null) return; const f = g.clk[i] / b, x = bk.find(q => f >= q.a && f < q.b) || bk[3];
      const bad = P.cls[i].k === 'mistake' || P.cls[i].k === 'blunder' || P.cls[i].k === 'miss'; x.n++; if (bad) x.e++;
      thinkAll.push(spt[i]); if (bad) thinkBad.push(spt[i]);
    });
  }
  let h = '';
  if (toAll) h += '<p style="font-size:14px">Derrotas no tempo entre as analisadas: <b>' + toAll + '</b>, das quais <b>' + toWin.length + '</b> com a posição ganha ou melhor (60%+).' + (toWin.length ? ' ' + toWin.slice(0, 3).map(g => gLink(g, 'vs ' + g.opp)).join(' · ') : '') + '</p>';
  const mx = Math.max.apply(null, bk.map(x => x.n ? x.e / x.n * 100 : 0)) || 1;
  h += '<div class="hgrp"><span class="label">Erros graves a cada 100 lances, pelo tempo que restava</span>' + bk.map(x => '<div class="hrow"><span>' + x.t + '</span><span class="hbar"><i style="width:' + (x.n ? x.e / x.n * 100 / mx * 100 : 0) + '%;background:var(--loss)"></i></span><b class="mono">' + (x.n ? sp(x.e / x.n * 100, 1) : '—') + '</b><span class="mono muted">' + x.n + '</span></div>').join('') + '</div>';
  if (thinkBad.length >= 5) {
    const a = avg(thinkBad), m = avg(thinkAll), quick = thinkBad.filter(s => s < Math.max(1.5, m * .4)).length / thinkBad.length * 100;
    h += '<p style="font-size:14px">Antes dos erros graves você pensou em média <b>' + sp(a, 1) + ' s</b>; nos lances em geral, <b>' + sp(m, 1) + ' s</b>. ' + sp(quick) + '% dos erros graves foram lances rápidos demais (menos de 40% do seu tempo médio).</p>';
  }
  return h || '<p class="muted">Sem dados de relógio nas partidas analisadas.</p>';
}
const STH = {};
async function renderStats() {
  const ready = analyzedReady(), key0 = statsData().key;
  if (STH.rec && STH.rec[0] === key0) $('#stRec').innerHTML = STH.rec[1]; else { const h = recordsHtml(); STH.rec = [key0, h]; $('#stRec').innerHTML = h; }
  for (const id of ['stPhase', 'stOpen', 'stEnd', 'stClock']) if (!ready || !$('#' + id).dataset.k || $('#' + id).dataset.k !== statsData().key) $('#' + id).innerHTML = CALC;
  if (!ready) { await warmPrep(); if (S.view !== 'stats') return; }
  const key = statsData().key;
  for (const [id, fn] of [['stPhase', phaseCostHtml], ['stOpen', openingsDeep], ['stEnd', tradesEndsHtml], ['stClock', clockDeepHtml]]) {
    await new Promise(r => setTimeout(r, 0)); if (S.view !== 'stats') return;
    const el = $('#' + id); if (el.dataset.k === key && !el.innerHTML.includes('Calculando')) continue;
    if (!STH[id] || STH[id][0] !== key) STH[id] = [key, await fn()];
    if (S.view !== 'stats') return;
    el.innerHTML = '<div class="stack fade" style="gap:12px">' + STH[id][1] + '</div>'; el.dataset.k = key;
  }
}

/* ---------- adversário humano: Maia3 (CSSLab, Universidade de Toronto) ---------- */
const MAIA_SRC = {
  ort: ['https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/ort.wasm.min.js', 'c6bc9f8e1d0ecc3983a57910e6a30b2230a512bcd2e0207cd64306459c3de7b4'],
  mjs: ['https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/ort-wasm-simd-threaded.mjs', '90a557d15c02bac4504d95b67f431d8594635ed2a0a62a7f2cd83d090ff91d3e'],
  wasm: ['https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/ort-wasm-simd-threaded.wasm', '45eaee27761ad883742a8d4b8fce1538d60ce43b51adf1726fafccc59b8c1a15'],
  moves: ['https://raw.githubusercontent.com/CSSLab/maia-platform-frontend/15cef70619bbd7d70c5b0575af3bcf907aeed62c/src/lib/engine/data/all_moves_maia3.json', 'e3351a233174e99d9ddca981681b65a444d191e8a6b474e27bd8fad8514af8d7'],
  model: ['https://raw.githubusercontent.com/CSSLab/maia-platform-frontend/15cef70619bbd7d70c5b0575af3bcf907aeed62c/public/maia3/maia3_simplified.onnx', '47172964fecdc8ee8018e15059dc679baef550766bc7adacec227ada1288624b']
};
const MAIA_WORKER = "let session=null;self.onmessage=async e=>{const d=e.data;try{if(d.type==='init'){importScripts(d.ortUrl);ort.env.logLevel='error';ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths={mjs:d.mjsUrl,wasm:d.wasmUrl};session=await ort.InferenceSession.create(new Uint8Array(d.model),{executionProviders:['wasm'],graphOptimizationLevel:'all'});postMessage({type:'ready'});}else if(d.type==='run'){const f={tokens:new ort.Tensor('float32',new Float32Array(d.tokens),[1,64,12]),elo_self:new ort.Tensor('float32',new Float32Array([d.elo]),[1]),elo_oppo:new ort.Tensor('float32',new Float32Array([d.elo]),[1])};const r=await session.run(f);const lm=new Float32Array(r.logits_move.data),lv=new Float32Array(r.logits_value.data);postMessage({type:'out',id:d.id,lm:lm.buffer,lv:lv.buffer},[lm.buffer,lv.buffer]);}}catch(err){postMessage({type:'error',id:d.id,message:String(err&&err.message||err)});}};";
const MAIA = { st: 'off', prog: 0, w: null, M: null, R: null, q: new Map(), n: 0, err: '' };
async function sha256Hex(buf) { const h = await crypto.subtle.digest('SHA-256', buf); return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join(''); }
async function maiaFile(k, onBytes) {
  const [url, hash] = MAIA_SRC[k]; const ck = 'maia:' + k + ':' + hash.slice(0, 12);
  const cached = await kv.get(ck, null); if (cached && cached.byteLength) return cached;
  const r = await fetch(url); if (!r.ok) throw new Error('http ' + r.status);
  let buf;
  if (onBytes && r.body && r.headers.get('content-length')) {
    const total = +r.headers.get('content-length'), rd = r.body.getReader(), parts = []; let got = 0;
    for (;;) { const { done: dn, value } = await rd.read(); if (dn) break; parts.push(value); got += value.length; onBytes(got, total); }
    const u = new Uint8Array(got); let o = 0; for (const p of parts) { u.set(p, o); o += p.length; } buf = u.buffer;
  } else buf = await r.arrayBuffer();
  if (await sha256Hex(buf) !== hash) throw new Error('integridade');
  kv.set(ck, buf); return buf;
}
const maiaReady = () => MAIA.st === 'ready';
async function maiaLoad() {
  if (MAIA.st === 'ready' || MAIA.st === 'loading') return MAIA.p;
  MAIA.st = 'loading'; MAIA.prog = 0; MAIA.err = ''; maiaUi();
  MAIA.p = (async () => {
    try {
      const sizes = { ort: .05, mjs: .02, wasm: 11.9, moves: .06, model: 45.7 }, tot = 57.73; let base = 0;
      const get = async k => { const b = await maiaFile(k, (g) => { MAIA.prog = Math.min(99, (base + g / 1e6) / tot * 100); maiaUi(); }); base += sizes[k]; MAIA.prog = Math.min(99, base / tot * 100); maiaUi(); return b; };
      const ortJs = await get('ort'), mjs = await get('mjs'), wasm = await get('wasm'), moves = await get('moves'), model = await get('model');
      MAIA.M = JSON.parse(new TextDecoder().decode(moves)); MAIA.R = []; for (const k in MAIA.M) MAIA.R[MAIA.M[k]] = k;
      const blob = (b, t) => URL.createObjectURL(new Blob([b], { type: t }));
      const w = new Worker(blob(MAIA_WORKER, 'text/javascript'));
      await new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('tempo')), 60000);
        w.onmessage = e => { if (e.data.type === 'ready') { clearTimeout(t); res(); } else if (e.data.type === 'error') { clearTimeout(t); rej(new Error(e.data.message)); } };
        w.postMessage({ type: 'init', ortUrl: blob(ortJs, 'text/javascript'), mjsUrl: blob(mjs, 'text/javascript'), wasmUrl: blob(wasm, 'application/wasm'), model: model.slice(0) });
      });
      w.onmessage = e => { const d = e.data, cb = MAIA.q.get(d.id); if (!cb) return; MAIA.q.delete(d.id); if (d.type === 'out') cb.res(d); else cb.rej(new Error(d.message)); };
      MAIA.w = w; MAIA.st = 'ready'; MAIA.prog = 100; store.set('maiaOk', true);
    } catch (e) { MAIA.st = 'error'; MAIA.err = String(e && e.message || e); }
    maiaUi();
  })();
  return MAIA.p;
}
function maiaMirrorFen(f) {
  const [pos, a, c, ep, h, n] = f.split(' ');
  const sw = r => r.split('').map(ch => /[a-z]/.test(ch) ? ch.toUpperCase() : /[A-Z]/.test(ch) ? ch.toLowerCase() : ch).join('');
  const cc = c === '-' ? '-' : c.split('').map(x => x === x.toUpperCase() ? x.toLowerCase() : x.toUpperCase()).sort((x, y) => 'KQkq'.indexOf(x) - 'KQkq'.indexOf(y)).join('');
  return pos.split('/').reverse().map(sw).join('/') + ' ' + (a === 'w' ? 'b' : 'w') + ' ' + (cc || '-') + ' ' + (ep === '-' ? '-' : ep[0] + (9 - +ep[1])) + ' ' + (h || 0) + ' ' + (n || 1);
}
async function maiaPredict(fen, elo) {
  if (!maiaReady()) throw new Error('maia');
  const black = fen.split(' ')[1] === 'b', f2 = black ? maiaMirrorFen(fen) : fen;
  const tok = new Float32Array(768), PT = 'PNBRQKpnbrqk', rows = f2.split(' ')[0].split('/');
  for (let r = 0; r < 8; r++) { let file = 0; for (const ch of rows[r]) { if (/\d/.test(ch)) file += +ch; else { tok[((7 - r) * 8 + file) * 12 + PT.indexOf(ch)] = 1; file++; } } }
  const legal = new Chess(f2).moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
  const id = ++MAIA.n;
  const d = await new Promise((res, rej) => { MAIA.q.set(id, { res, rej }); MAIA.w.postMessage({ type: 'run', id, tokens: tok.buffer, elo: elo || 1500 }, [tok.buffer]); });
  const lm = new Float32Array(d.lm), lv = new Float32Array(d.lv);
  const mir = s => s[0] + (9 - +s[1]);
  const idx = legal.map(u => [u, MAIA.M[u]]).filter(x => x[1] != null);
  const mx = Math.max.apply(null, idx.map(x => lm[x[1]])); const ex = idx.map(x => Math.exp(lm[x[1]] - mx)); const s = ex.reduce((a, b) => a + b, 0) || 1;
  const pol = idx.map((x, k) => [black ? mir(x[0].slice(0, 2)) + mir(x[0].slice(2, 4)) + x[0].slice(4) : x[0], ex[k] / s]).sort((a, b) => b[1] - a[1]);
  const m3 = Math.max(lv[0], lv[1], lv[2]), e0 = Math.exp(lv[0] - m3), e1 = Math.exp(lv[1] - m3), e2 = Math.exp(lv[2] - m3); let wp = (e2 + .5 * e1) / (e0 + e1 + e2); if (black) wp = 1 - wp;
  return { pol, wp: wp * 100 };
}
async function maiaMove(fen, elo) {
  const r = await maiaPredict(fen, elo); const top = r.pol.filter(x => x[1] >= .06); const L = top.length ? top : r.pol.slice(0, 1);
  const s = L.reduce((a, x) => a + x[1], 0); let t = Math.random() * s; for (const x of L) { t -= x[1]; if (t <= 0) return x[0]; } return L[0][0];
}
function maiaUi() {
  const el = $('#maiaBox'); if (el) el.innerHTML = maiaBoxHtml();
  const ab = $('#maiaAn'); if (ab && S.view === 'analise') ab.innerHTML = maiaAnHtml();
}
function maiaBoxHtml() {
  if (MAIA.st === 'ready') return '<span class="muted" style="font-size:13px">Maia pronto: o adversário erra e acerta como um jogador humano do nível escolhido.</span>';
  if (MAIA.st === 'loading') return '<div class="stack" style="gap:6px"><span class="muted" style="font-size:13px">Baixando o Maia… ' + Math.round(MAIA.prog) + '%</span><div class="prog"><i style="width:' + MAIA.prog + '%"></i></div></div>';
  return '<div class="stack" style="gap:6px"><span class="muted" style="font-size:13px">' + (MAIA.st === 'error' ? 'Não consegui baixar o Maia agora (' + esc(MAIA.err) + '). ' : '') + 'O adversário humano usa o Maia, um modelo da Universidade de Toronto treinado com milhões de partidas humanas. Download único de cerca de 58 MB, conferido antes de usar.</span><button class="btn small accent" type="button" data-maia="load">' + (MAIA.st === 'error' ? 'Tentar de novo' : 'Baixar o Maia') + '</button></div>';
}
function styleSeg() {
  const st = store.get('arStyle', 'engine'), me = (S.games.find(g => g.tc === 'blitz' && g.mR) || S.games.find(g => g.mR) || {}).mR || 1400;
  const lv = store.get('maiaElo', Math.round(me / 100) * 100);
  let h = '<div class="stack" style="gap:6px"><span class="label">Estilo do adversário</span><div class="seg" role="group"><button type="button" data-ar="style:engine" aria-pressed="' + (st === 'engine') + '">Motor (Stockfish)</button><button type="button" data-ar="style:human" aria-pressed="' + (st === 'human') + '">Humano (Maia)</button></div></div>';
  if (st === 'human') h += '<div class="stack" style="gap:6px"><span class="label">Nível do humano</span><div class="seg" role="group">' + [1100, 1300, 1500, 1700, 1900].map(e => '<button type="button" data-ar="melo:' + e + '" aria-pressed="' + (lv === e) + '">' + e + '</button>').join('') + '</div><div id="maiaBox">' + maiaBoxHtml() + '</div></div>';
  return h;
}
const arHuman = () => store.get('arStyle', 'engine') === 'human';
const maiaElo = () => store.get('maiaElo', Math.round(((S.games.find(g => g.mR) || {}).mR || 1400) / 100) * 100);
/* na Análise: o que um humano do seu nível jogaria */
var MAIA_AN = null;
function maiaAnHtml() {
  if (!MAIA_AN) return '<button class="btn small" type="button" data-maia="pos">Como jogaria um humano de ~' + maiaElo() + '?</button>';
  if (MAIA_AN.loading) return '<p class="muted" style="font-size:13.5px">' + (MAIA.st === 'loading' ? 'Baixando o Maia… ' + Math.round(MAIA.prog) + '%' : 'Consultando o Maia…') + '</p>';
  if (MAIA_AN.err) return '<p class="muted" style="font-size:13.5px">' + esc(MAIA_AN.err) + '</p>';
  const r = MAIA_AN;
  return '<div class="blk"><h3>Jogadores de ~' + r.elo + ' aqui</h3><div class="hgrp">' + r.top.map(([san, p]) => '<div class="hrow"><span class="mono">' + esc(fig(san)) + '</span><span class="hbar"><i style="width:' + (p * 100) + '%"></i></span><b class="mono">' + Math.round(p * 100) + '%</b><span></span></div>').join('') + '</div>' + (r.trap ? '<div class="warn">Posição traiçoeira: ' + Math.round(r.trap.p * 100) + '% dos jogadores desse nível jogariam ' + esc(fig(r.trap.san)) + ', que perde ' + Math.round(r.trap.loss) + ' pontos de chance segundo o motor.</div>' : '') + '</div>';
}
async function maiaAnalyze() {
  const P = currentP(); if (!P) return; const n = S.ply, fen = P.fens[n], elo = maiaElo();
  MAIA_AN = { loading: true, fen }; maiaUi();
  try {
    if (!maiaReady()) { await maiaLoad(); if (!maiaReady()) throw new Error(MAIA.err || 'sem Maia'); }
    const r = await maiaPredict(fen, elo); if (currentP() !== P || S.ply !== n) return;
    const c = new Chess(fen), top = r.pol.slice(0, 4).map(([u, p]) => { const m = new Chess(fen).move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); return [m ? m.san : u, p, u]; });
    let trap = null; const ev = P.evs ? P.evs[n] : null, stm = c.turn();
    if (ev && ev.best && top[0][2] !== ev.best && top[0][1] >= .25) {
      try { const m = new Chess(fen); m.move({ from: top[0][2].slice(0, 2), to: top[0][2].slice(2, 4), promotion: top[0][2][4] }); const e2 = await evalPos(m.fen(), 600); const loss = sideWp(ev, stm) - sideWp(e2, stm); if (loss >= 12) trap = { san: top[0][0], p: top[0][1], loss }; } catch (e) { /* sem motor */ }
    }
    MAIA_AN = { fen, elo, top: top.map(x => [x[0], x[1]]), trap };
  } catch (e) { MAIA_AN = { err: MAIA.st === 'error' ? 'Não consegui baixar o Maia agora.' : 'O Maia não está disponível aqui.' }; }
  if (currentP() === P && S.ply === n) maiaUi();
}

/* ---------- Ache o erro ---------- */
function spotRounds(n) {
  const out = [], gs = shuffle(analyzedGames().slice());
  for (const g of gs) {
    if (out.length >= n) break; const P = prep(g); if (!P.cls) continue;
    const errs = P.cls.map((c, i) => ({ c, i })).filter(x => P.moves[x.i].color === g.c && (x.c.k === 'blunder' || x.c.k === 'mistake') && x.c.loss >= 20 && x.i >= 6);
    if (!errs.length) continue; const e = errs[Math.floor(Math.random() * errs.length)];
    const s = Math.max(0, e.i - 4 - Math.floor(Math.random() * 3)), t = Math.min(P.moves.length - 1, e.i + 2);
    let clean = true; for (let j = s; j <= t; j++) if (j !== e.i && (P.cls[j].k === 'blunder' || P.cls[j].k === 'mistake' || P.cls[j].k === 'miss')) clean = false;
    if (clean) out.push({ gid: g.id, s, t, err: e.i });
  }
  return out;
}
function startSpot() {
  stopArenaTimers();
  const A = S.arena = { kind: 'spot', lobby: false, rounds: spotRounds(5), r: 0, ok: 0, title: 'Ache o erro', sub: 'Um trecho da sua partida: em que lance a coisa desandou?' };
  arBoard(); AR.setLive(null); AR.setArrows([]); $('#arClkTop').innerHTML = ''; $('#arClkBot').innerHTML = '';
  if (!A.rounds.length) { arHead(A.title, ''); $('#arPanel').innerHTML = '<p>Analise mais partidas para gerar trechos.</p>'; return; }
  spotLoad();
}
function spotLoad() {
  const A = S.arena, R = A.rounds[A.r], g = S.games.find(x => x.id === R.gid), P = prep(g);
  A.pick = null; A.shown = R.s; AR.setFlip(g.c === 'b'); AR.setPosition(P.fens[R.s], false); AR.setMarks({}); AR.setArrows([]);
  arHead(A.title, 'vs ' + g.opp + ' · ' + dateLabel(g.end, true)); spotPanel(); spotPlay();
}
function spotPlay() {
  const A = S.arena, R = A.rounds[A.r], P = prep(S.games.find(x => x.id === R.gid)); const token = A.playTok = {};
  AR.setPosition(P.fens[R.s], false); A.shown = R.s; spotPanel();
  const step = j => { if (S.arena !== A || A.playTok !== token || j > R.t + 1) return; AR.setPosition(P.fens[j], true); const m = P.moves[j - 1]; AR.setMarks(m ? { last: [m.from, m.to] } : {}); A.shown = j; spotPanel(); setTimeout(() => step(j + 1), 750); };
  setTimeout(() => step(R.s + 1), 600);
}
function spotPanel() {
  const A = S.arena; if (!A || A.kind !== 'spot') return; const R = A.rounds[A.r], g = S.games.find(x => x.id === R.gid), P = prep(g);
  let h = '<div style="display:flex;justify-content:space-between"><span class="label">Trecho ' + (A.r + 1) + ' de ' + A.rounds.length + '</span><span class="mono muted">' + A.ok + ' acerto' + (A.ok === 1 ? '' : 's') + '</span></div>';
  h += '<p>Você jogou de ' + SIDE[g.c] + '. Veja o trecho e toque no lance <b>seu</b> que mudou a partida.</p><div class="spot">';
  for (let j = R.s; j <= R.t; j++) {
    const m = P.moves[j], mine = m.color === g.c, cls = A.pick != null ? (j === R.err ? ' ok' : j === A.pick ? ' no' : '') : '';
    h += '<button type="button" class="sp' + (mine ? '' : ' them') + cls + (A.shown === j + 1 ? ' cur' : '') + '" ' + (mine && A.pick == null ? 'data-ar="spick:' + j + '"' : 'disabled') + '><span class="mono">' + esc(moveNum(j) + fig(m.san)) + '</span></button>';
  }
  h += '</div><div class="vxacts"><button class="btn small" type="button" data-ar="sreplay">Ver de novo</button></div>';
  if (A.pick != null) {
    const right = A.pick === R.err, C = coachFor(P, R.err);
    h += '<div class="fb ' + (right ? 'ok' : 'no') + '">' + (right ? 'Isso! ' : 'Não foi esse. ') + 'O erro foi ' + esc(moveNum(R.err) + fig(P.moves[R.err].san)) + ' (' + CLS[P.cls[R.err].k].t.toLowerCase() + ': ' + pct(P.cls[R.err].wb) + ' → ' + pct(P.cls[R.err].wa) + ').</div>';
    h += '<div class="blk"><h3>Por quê</h3><p>' + esc(C.punish.concat(C.best ? ['Melhor era ' + fig(C.best.san) + (C.best.why ? ', que ' + C.best.why : '') + '.'] : []).join(' ')) + '</p></div>';
    h += '<div class="vxacts"><button class="btn small primary" type="button" data-ar="snext">' + (A.r + 1 < A.rounds.length ? 'Próximo trecho' : 'Ver resultado') + '</button><button class="btn small" type="button" data-openply="' + g.id + ':' + (R.err + 1) + '">Abrir na análise</button></div>';
  }
  if (A.over) h = '<div class="fb ' + (A.ok >= 3 ? 'ok' : 'hint') + '">Você achou ' + A.ok + ' de ' + A.rounds.length + ' erros.</div><p style="font-size:14px">Reconhecer o momento em que a partida virou é o primeiro passo para não repetir. Nos trechos que você errou, o lance escolhido parecia mais suspeito que o erro real: vale olhar as duas posições na análise.</p><div class="vxacts"><button class="btn primary" type="button" data-ar="restart">Jogar de novo</button></div>';
  $('#arPanel').innerHTML = '<div class="stack" style="gap:14px">' + h + '</div>';
}
function spotAction(a) {
  const A = S.arena; if (!A || A.kind !== 'spot') return;
  const R = A.rounds[A.r];
  if (a.startsWith('spick:') && A.pick == null) {
    A.pick = +a.slice(6); A.playTok = null; const P = prep(S.games.find(x => x.id === R.gid)), right = A.pick === R.err; if (right) A.ok++; haptic(right ? 'ok' : 'err');
    const eb = P.evs[R.err], m = P.moves[R.err]; AR.setPosition(P.fens[R.err], false);
    AR.setMarks({ last: [m.from, m.to], bad: m.to }); AR.setArrows(eb && eb.best ? [{ from: eb.best.slice(0, 2), to: eb.best.slice(2, 4), cls: 'a-best' }, { from: m.from, to: m.to, cls: 'a-bad' }] : []);
    spotPanel(); return;
  }
  if (a === 'sreplay') { AR.setArrows([]); spotPlay(); return; }
  if (a === 'snext') { if (A.r + 1 < A.rounds.length) { A.r++; spotLoad(); } else { A.over = true; act('spot'); spotPanel(); } }
}

/* ---------- padrões de mate ---------- */
const MATES = [
  { id: 'corredor', t: 'Mate do corredor', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', n: 1, idea: 'O rei rocado fica preso atrás dos próprios peões. Uma torre ou dama na última fileira dá mate.', tips: ['Confira se o rei adversário tem "respiro" (um peão avançado ao lado dele).', 'Do seu lado, um lance como h3 evita esse mate.'] },
  { id: 'abafado', t: 'Mate abafado', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', n: 1, idea: 'O rei está cercado pelas próprias peças e o cavalo, que salta por cima delas, dá o mate.', tips: ['Procure o rei no canto, com torre e peões em volta.', 'O cavalo ataca a casa vizinha ao canto: f7 ou f2.'] },
  { id: 'beijo', t: 'Mate do beijo', fen: 'k7/4Q3/1K6/8/8/8/8/8 w - - 0 1', n: 1, idea: 'A dama encosta no rei adversário e é protegida por outra peça (aqui, o rei), que não pode ser capturada.', tips: ['A dama precisa estar protegida.', 'Há mais de uma casa que funciona.'] },
  { id: 'escada', t: 'Mate da escada', fen: '6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1', n: 2, idea: 'Duas peças pesadas se revezam: uma corta uma fileira, a outra dá xeque na seguinte, empurrando o rei até a borda.', tips: ['Primeiro corte a 7ª fileira.', 'Depois o xeque na 8ª.'] },
  { id: 'anastasia', t: 'Mate de Anastásia', fen: '5r2/4Nppk/8/8/8/3R4/5PPP/6K1 w - - 0 1', n: 1, idea: 'O cavalo tira as casas de fuga do rei e a torre dá mate na coluna da borda.', tips: ['O cavalo em e7 controla g8 e g6.', 'A torre entra na coluna h.'] },
  { id: 'arabe', t: 'Mate árabe', fen: '7k/1R6/5N2/8/8/8/8/6K1 w - - 0 1', n: 1, idea: 'Torre e cavalo: o cavalo protege a torre e cobre a casa de fuga no canto.', tips: ['O cavalo em f6 protege h7.', 'A torre encosta no rei.'] },
  { id: 'pastor', t: 'Mate do pastor', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', n: 1, idea: 'Dama e bispo atacam f7, a casa mais fraca no início, protegida só pelo rei.', tips: ['Conte quem ataca e quem defende f7.', 'Do lado das pretas, ...g6 ou ...De7 evitam o mate.'] },
  { id: 'dragona', t: 'Mate da dragona', fen: '3rkr2/8/8/8/2Q5/8/8/4K3 w - - 0 1', n: 1, idea: 'As próprias torres ao lado do rei tiram as casas de fuga, como dragonas num ombro.', tips: ['A dama dá xeque de frente, a uma casa de distância.', 'As casas d7 e f7 ficam cobertas pela dama.'] },
  { id: 'damiano', t: 'Mate de Damiano', fen: '5rk1/6p1/6PQ/8/8/8/8/6K1 w - - 0 1', n: 1, idea: 'Um peão avançado protege a dama, que encosta no rei pela coluna da borda.', tips: ['O peão em g6 protege h7.', 'A dama entra em h7.'] },
  { id: 'boden', t: 'Mate de Boden', fen: '2kr4/p2n4/8/8/5B2/8/4B3/6K1 w - - 0 1', n: 1, idea: 'Dois bispos em diagonais cruzadas dão mate no rei rocado na ala da dama.', tips: ['Um bispo cobre b8 e c7.', 'O outro dá o xeque de a6.'] }
];
function mateKind(fen) {
  const B = parseBoard(fen), stm = fen.split(' ')[1], k = B.findIndex(p => p && p.t === 'k' && p.c === stm); if (k < 0) return 'outros';
  const op = other(stm), chk = attackers(B, k, op); if (!chk.length) return 'outros';
  const cp = B[chk[0]], kf = k % 8, kr = k >> 3, adj = [];
  for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) if ((df || dr) && on(kf + df, kr + dr)) adj.push((kr + dr) * 8 + kf + df);
  if (cp.t === 'n' && adj.every(j => B[j] && B[j].c === stm)) return 'abafado';
  const back = stm === 'w' ? 0 : 7, fwd = stm === 'w' ? 1 : -1;
  if (kr === back && (cp.t === 'r' || cp.t === 'q') && (chk[0] >> 3) === back) { const front = [-1, 0, 1].map(d => on(kf + d, kr + fwd) ? (kr + fwd) * 8 + kf + d : null).filter(x => x != null); if (front.every(j => B[j] && B[j].c === stm)) return 'corredor'; }
  if (cp.t === 'q' && adj.includes(chk[0]) && attackers(B, chk[0], op).length) return 'beijo';
  if ((cp.t === 'r' || cp.t === 'q') && adj.some(j => B[j] == null && attackers(B, j, op).some(a => B[a].t === 'n'))) return 'anastasia';
  if (cp.t === 'b') return 'boden';
  return 'outros';
}
let MATESTAT = null;
function mateStats() {
  if (MATESTAT && MATESTAT.n === S.games.length) return MATESTAT;
  const by = {}; let gave = 0, got = 0;
  for (const g of S.games) {
    const mine = g.oRes === 'checkmated', theirs = g.res === 'checkmated'; if (!mine && !theirs) continue;
    const P = prep(g); const k = mateKind(P.fens[P.fens.length - 1]); const x = by[k] = by[k] || { gave: [], got: [] };
    (mine ? x.gave : x.got).push(g); if (mine) gave++; else got++;
  }
  MATESTAT = { n: S.games.length, by, gave, got }; return MATESTAT;
}
function matesLobbyHtml() {
  const st = mateStats(), d = done();
  let h = '<p>Os padrões de mate mais comuns, para resolver contra o motor. Cada um traz a ideia e o que olhar no tabuleiro.</p>';
  h += '<p style="font-size:14px">Nas suas partidas: você deu <b>' + st.gave + '</b> mates e levou <b>' + st.got + '</b>.</p>';
  h += '<div class="stack" style="gap:6px;max-height:50vh;overflow:auto">' + MATES.map((p, i) => { const x = st.by[p.id] || { gave: [], got: [] }, ok = d['mates:' + p.id] && d['mates:' + p.id].ok; return '<button class="repmv arow" type="button" data-ar="pick:' + i + '"' + (S.arena.sel === i ? ' aria-current="true"' : '') + '><span style="min-width:0"><b>' + esc(p.t) + '</b><span class="muted" style="display:block;font-size:12.5px">Mate em ' + p.n + (x.gave.length || x.got.length ? ' · nas suas partidas: deu ' + x.gave.length + ', levou ' + x.got.length : '') + '</span></span><span></span>' + (ok ? '<span class="tag W" style="padding:3px 7px">feito</span>' : '<span></span>') + '</button>'; }).join('') + '</div>';
  const p = MATES[Math.min(S.arena.sel, MATES.length - 1)], x = st.by[p.id];
  lobbyPreview(p.fen, 'w');
  h += '<div class="blk"><h3>' + esc(p.t) + '</h3><p>' + esc(p.idea) + '</p>' + (x && (x.gave.length || x.got.length) ? '<p class="muted" style="font-size:13px">Exemplos seus: ' + x.gave.slice(0, 2).map(g => gLink(g, 'você deu vs ' + g.opp)).concat(x.got.slice(0, 2).map(g => gLink(g, 'você levou vs ' + g.opp))).join(' · ') + '</p>' : '') + '</div><div class="vxacts"><button class="btn primary" type="button" data-ar="go">Resolver</button></div>';
  return h;
}
function startMate(p) {
  arStart({ kind: 'mates', title: p.t, sub: 'Mate em ' + p.n, fen: p.fen, user: p.fen.split(' ')[1], goal: 'mate', limit: p.n, lesson: { idea: p.idea, tips: p.tips }, elo: 0, key: 'mates:' + p.id, sel: MATES.indexOf(p) });
}

/* ---------- às cegas ---------- */
function blindApply() {
  const el = $('#pzBoard'); if (!el) return; const v = store.get('blind', 'off');
  el.dataset.blind = PZ && !PZ.done ? v : 'off';
  const box = $('#pzBlindTxt'); if (!box) return;
  if (v === 'all' && PZ && !PZ.done) {
    const B = parseBoard(PZ.fen), L = { w: [], b: [] }, ord = 'kqrbnp';
    B.forEach((p, i) => { if (p) L[p.c].push([ord.indexOf(p.t), fig((p.t === 'p' ? '' : p.t.toUpperCase()) + iSq(i))]); });
    box.hidden = false; box.innerHTML = ['w', 'b'].map(c => '<p><b>' + cap(SIDE[c]) + ':</b> <span class="mono">' + L[c].sort((a, b) => a[0] - b[0]).map(x => x[1]).join(' ') + '</span></p>').join('');
  } else { box.hidden = true; box.innerHTML = ''; }
}
const blindReveal = () => blindApply();

/* ---------- fila de revisão ---------- */
function startQueue(ids, label) {
  if (!ids.length) { toast('Nenhuma partida para revisar'); return; }
  S.queue = { ids, label }; openGame(ids[0], 0);
}
function queueBar(g) {
  const Q = S.queue; if (!Q) return ''; const i = Q.ids.indexOf(g.id); if (i < 0) return '';
  return '<div class="qbar"><span class="mono">' + esc(Q.label) + ' · ' + (i + 1) + ' de ' + Q.ids.length + '</span>' + (i > 0 ? '<button class="btn small" type="button" data-q="prev">‹ Anterior</button>' : '') + (i + 1 < Q.ids.length ? '<button class="btn small primary" type="button" data-q="next">Próxima ›</button>' : '<button class="btn small" type="button" data-q="end">Concluir</button>') + '</div>';
}
function queueAction(a) {
  const Q = S.queue, P = currentP(); if (!Q || !P) return; const i = Q.ids.indexOf(P.g.id);
  if (a === 'end') { S.queue = null; toast('Revisão concluída'); renderAnalise(); return; }
  const j = a === 'next' ? i + 1 : i - 1; if (Q.ids[j]) openGame(Q.ids[j], 0);
}

/* ---------- toque duplo para confirmar o lance ---------- */
const confirmOn = () => store.get('confirm', false);

/* ---------- árvore de aberturas do adversário ---------- */
function oppTree(games) {
  const T = { w: { n: 0, W: 0, D: 0, L: 0, ch: {} }, b: { n: 0, W: 0, D: 0, L: 0, ch: {} } };
  for (const g of games) { const r = rk(g); let node = T[g.c]; node.n++; node[r]++; for (const m of g.mv.split(' ').slice(0, 12)) { node = node.ch[m] = node.ch[m] || { n: 0, W: 0, D: 0, L: 0, ch: {} }; node.n++; node[r]++; } }
  const prune = n => { for (const k in n.ch) { if (n.ch[k].n < 2) delete n.ch[k]; else prune(n.ch[k]); } };
  prune(T.w); prune(T.b); return T;
}
let DT = null, DTB = null;
function dosTreeHtml(D) {
  if (!D.tree) return '';
  DT = DT && DT.opp === D.opp ? DT : { opp: D.opp, c: 'w', path: [] };
  let node = D.tree[DT.c]; for (const m of DT.path) node = node && node.ch[m]; if (!node) { DT.path = []; node = D.tree[DT.c]; }
  const kids = Object.entries(node.ch).sort((a, b) => b[1].n - a[1].n).slice(0, 8);
  const turnTheirs = (DT.path.length % 2 === 0) === (DT.c === 'w');
  return '<div class="hgrp"><span class="label">Árvore de aberturas dele</span><div class="seg" role="group"><button type="button" data-dt="c:w" aria-pressed="' + (DT.c === 'w') + '">Ele de brancas</button><button type="button" data-dt="c:b" aria-pressed="' + (DT.c === 'b') + '">Ele de pretas</button></div>' +
    '<div class="dtree"><div id="dosBoard" class="dosboard"></div><div class="stack" style="gap:6px;min-width:0"><div class="crumbs"><button type="button" data-dt="up:0">Início</button>' + DT.path.map((m, i) => '<button type="button" data-dt="up:' + (i + 1) + '">' + esc((i % 2 === 0 ? (i / 2 + 1) + '.' : '') + fig(m)) + '</button>').join('') + '</div><span class="muted" style="font-size:12.5px">' + (turnTheirs ? 'Lances dele aqui' : 'Lances dos adversários dele aqui') + ' · aproveitamento dele</span>' +
    (kids.length ? kids.map(([m, x]) => '<button class="repmv" type="button" data-dt="go:' + esc(m) + '"><b class="mono">' + esc(fig(m)) + '</b><span class="wdl"><i style="flex:' + x.W + '"></i><i style="flex:' + x.D + '"></i><i style="flex:' + x.L + '"></i></span><span class="mono">' + sp(nodeScore(x)) + '% · ' + x.n + '</span></button>').join('') : '<p class="muted" style="font-size:13px">Sem mais partidas a partir daqui.</p>') + '</div></div></div>';
}
function dosTreeBoard() {
  const el = $('#dosBoard'); if (!el || !DT) return; DTB = new Board(el); DTB.setFlip(DT.c === 'b');
  const c = new Chess(); let last = null; for (const m of DT.path) { try { last = c.move(m); } catch (e) { break; } }
  DTB.setPosition(c.fen(), false); DTB.setMarks(last ? { last: [last.from, last.to] } : {});
}
function dosTreeAction(a, D) {
  if (a.startsWith('c:')) { DT.c = a.slice(2); DT.path = []; }
  else if (a.startsWith('up:')) DT.path = DT.path.slice(0, +a.slice(3));
  else if (a.startsWith('go:')) DT.path.push(a.slice(3));
  const box = $('#dosTree'); if (box) { box.innerHTML = dosTreeHtml(D); dosTreeBoard(); }
}

/* ---------- pré-cálculo em tempo ocioso (a primeira visita a cada aba fica leve) ---------- */
(function idleWarm() {
  const idle = window.requestIdleCallback ? f => requestIdleCallback(f, { timeout: 2000 }) : f => setTimeout(f, 60);
  const jobs = [() => lists(), () => punishQueue(), () => theoryQueue(), () => compareCard(), () => buildTraining()];
  // depois dos cálculos, monta em segundo plano as abas ainda não abertas (escondidas, não desenham)
  for (const v of ['partidas', 'treino', 'analise']) jobs.push(() => { if (S.view === v || VKEY[v] === viewKey(v)) return; const cur = S.view; renderView(v); VKEY[v] = viewKey(v); S.view = cur; });
  const run = () => { const j = jobs.shift(); if (!j) return; try { j(); } catch (e) { /* segue */ } idle(run); };
  setTimeout(() => warmPrep().then(() => idle(run)), 2500);
})();

/* ---------- recepção do Painel: saudação, o dia em partidas e frases de enxadristas ---------- */
const QUOTES = [
  ['Tática é saber o que fazer quando há algo a fazer; estratégia é saber o que fazer quando não há nada a fazer.', 'Savielly Tartakower'],
  ['Vence quem comete o penúltimo erro.', 'Savielly Tartakower'],
  ['Ninguém nunca ganhou uma partida desistindo.', 'Savielly Tartakower'],
  ['Quando encontrar um bom lance, procure um melhor.', 'Emanuel Lasker'],
  ['Sem erro não pode haver brilhantismo.', 'Emanuel Lasker'],
  ['Ajude suas peças para que elas possam ajudar você.', 'Paul Morphy'],
  ['Os peões são a alma do xadrez.', 'François-André Philidor'],
  ['Xadrez é a luta contra o erro.', 'Johannes Zukertort'],
  ['Mesmo um plano ruim é melhor que plano nenhum.', 'Mikhail Chigorin'],
  ['Xadrez é vida.', 'Bobby Fischer'],
  ['Não acredito em psicologia. Acredito em bons lances.', 'Bobby Fischer'],
  ['Você aprende muito mais com uma partida que perde do que com uma que ganha.', 'José Raúl Capablanca'],
  ['Para melhorar seu jogo, estude os finais antes de tudo.', 'José Raúl Capablanca'],
  ['Leve o adversário para uma floresta escura, onde 2 + 2 = 5 e o caminho de saída só tem espaço para um.', 'Mikhail Tal'],
  ['A ameaça é mais forte que a execução.', 'Aron Nimzowitsch'],
  ['O rei é uma peça de combate. Use-o!', 'Wilhelm Steinitz'],
  ['Jogue a abertura como um livro, o meio-jogo como um mágico e o final como uma máquina.', 'Rudolf Spielmann'],
  ['Xadrez é 99% tática.', 'Richard Teichmann'],
  ['Xadrez é tudo: arte, ciência e esporte.', 'Anatoly Karpov'],
  ['Quem ataca pode se arrepender de um lance ruim, mas é muito pior se arrepender para sempre de uma oportunidade que deixou passar.', 'Garry Kasparov']
];
let QI = null, QT = 0;
function showQuote(step) {
  const el = $('#pnQuote'); if (!el) return;
  if (QI == null) { const d = new Date(); QI = (d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate()) % QUOTES.length; }
  else QI = (QI + (step || 1) + QUOTES.length) % QUOTES.length;
  const [t, a] = QUOTES[QI];
  el.innerHTML = '<blockquote class="qtext">' + esc(t) + '</blockquote><figcaption><span>' + esc(a) + '</span><span class="qnav"><button type="button" data-quote="-1" aria-label="Frase anterior">‹</button><button type="button" data-quote="1" aria-label="Próxima frase">›</button></span></figcaption>';
  if (el.animate) for (const c of el.querySelectorAll('.qtext,figcaption>span:first-child')) c.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.2,.8,.2,1)' });
}
function quoteTimer() { if (QT) clearInterval(QT); QT = setInterval(() => { if (S.view === 'painel' && !document.hidden) showQuote(1); }, 11000); }
function renderHero() {
  const h = new Date().getHours(), G = S.games;
  const hi = h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  $('#h-painel').textContent = hi + ', ' + (S.me || 'enxadrista') + '!';
  $('#pnWhen').textContent = cap(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }));
  if (!$('#pnQuote').innerHTML) { showQuote(0); quoteTimer(); }
  if (!G.length) { $('#pnToday').innerHTML = '<p class="hero-line">Sincronize sua conta e eu te conto como foram as partidas do dia.</p>'; $('#pnQuick').innerHTML = ''; return; }
  const H = habits(), T = H.today.slice().sort((a, b) => a.end - b.end);
  const W = T.filter(g => rk(g) === 'W').length, D = T.filter(g => rk(g) === 'D').length, L = T.length - W - D;
  let line, mood = '';
  if (!T.length) {
    const last = G[0], days = Math.floor((Date.now() / 1000 - last.end) / 86400);
    line = 'Nenhuma partida hoje ainda. A última foi ' + (days <= 0 ? 'mais cedo' : days === 1 ? 'ontem' : 'há ' + days + ' dias') + ', ' + (rk(last) === 'W' ? 'uma vitória' : rk(last) === 'D' ? 'um empate' : 'uma derrota') + ' contra ' + esc(last.opp) + '.';
    mood = 'Que tal 3 exercícios de aquecimento antes da primeira?';
  } else {
    const parts = [W && W + (W === 1 ? ' vitória' : ' vitórias'), D && D + (D === 1 ? ' empate' : ' empates'), L && L + (L === 1 ? ' derrota' : ' derrotas')].filter(Boolean);
    line = 'Hoje já foram <b>' + T.length + (T.length === 1 ? ' partida' : ' partidas') + '</b>: ' + parts.join(', ').replace(/, ([^,]*)$/, ' e $1') + '.';
    const dl = Object.entries(H.deltas).filter(([, v]) => v != null && v !== 0).map(([k, v]) => TC[k].toLowerCase() + ' <b class="' + (v > 0 ? 'up' : 'down') + '">' + (v > 0 ? '+' : '−') + Math.abs(v) + '</b>');
    if (dl.length) line += ' Rating de hoje: ' + dl.join(', ') + '.';
    mood = H.lossRun >= 2 ? H.lossRun + ' derrotas seguidas: uma pausa curta agora costuma valer mais que a próxima partida.' : W >= 3 && W > L * 2 ? 'Dia inspirado. Aproveite, mas sem pressa nos lances.' : L > W ? 'Dia difícil até aqui. Revise uma das derrotas antes de continuar.' : 'Bora para a próxima? Olhe xeques, capturas e ameaças antes de cada lance.';
  }
  let html = '<p class="hero-line">' + line + '</p><p class="muted">' + esc(mood) + '</p>';
  if (T.length) html += '<div class="todayg">' + T.slice(-8).map(g => { const P = S.an[g.id] ? prep(g) : null, acc = P && P.acc ? pct(P.acc[g.c]) : ''; return '<button type="button" class="tg ' + rk(g) + '" data-openply="' + g.id + ':0"><b>' + ({ W: 'V', D: 'E', L: 'D' }[rk(g)]) + '</b><span>vs ' + esc(g.opp) + '</span>' + (acc ? '<i class="mono">' + acc + '</i>' : '') + '</button>'; }).join('') + '</div>';
  html += '<div class="vxacts">' + (T.length ? '<button class="btn small primary" type="button" data-queue="today">Revisar as de hoje</button>' : '<button class="btn small primary" type="button" data-pz="warm">Aquecer com 3 exercícios</button>') + '<a class="btn small" href="#treino">Ir para o treino</a></div>';
  $('#pnToday').innerHTML = html;
  // números rápidos
  const asc = G.slice().sort((a, b) => a.end - b.end); let win = 0, unb = 0;
  for (let i = asc.length - 1; i >= 0 && rk(asc[i]) === 'W'; i--) win++;
  for (let i = asc.length - 1; i >= 0 && rk(asc[i]) !== 'L'; i--) unb++;
  const tc = (G.find(g => g.tc === 'blitz' && g.mR) ? 'blitz' : (G.find(g => g.mR) || {}).tc) || 'blitz';
  const rNow = (G.find(g => g.tc === tc && g.mR) || {}).mR, wk = Date.now() / 1000 - 7 * 86400;
  const r7 = (asc.filter(g => g.tc === tc && g.mR && g.end < wk).pop() || {}).mR;
  const week = G.filter(g => g.end >= wk), ws = scoreOf(week);
  const accs = analyzedGames().slice().sort((a, b) => b.end - a.end).slice(0, 10).map(g => prep(g)).filter(P => P.acc).map(P => P.acc[P.g.c]);
  const q = [
    [win ? win + (win === 1 ? ' vitória' : ' vitórias') : unb ? unb + ' sem perder' : '—', win ? 'sequência atual' : unb ? 'sequência atual' : 'sem sequência agora'],
    [dailyCount() + ' de ' + GOAL, 'exercícios de hoje' + (streakDays() > 1 ? ' · ' + streakDays() + ' dias seguidos' : '')],
    [ws == null ? '—' : sp(ws) + '%', 'aproveitamento em 7 dias · ' + week.length + ' partidas'],
    [accs.length ? pct(avg(accs)) : '—', 'precisão nas 10 últimas analisadas']
  ];
  $('#pnQuick').innerHTML = q.map(([b, s]) => '<div class="qs"><b>' + esc(b) + '</b><span>' + esc(s) + '</span></div>').join('');
}
