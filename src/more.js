/* =====================================================================
   Versão 1.2: desafios contra o motor, Raio-X, curso de finais, treino de
   relógio, Adivinhe o lance, dossiê do adversário, plano semanal, cartão
   da partida e perfil em radar. Este arquivo é inserido dentro do app.js.
   ===================================================================== */

/* ---------- utilidades comuns ---------- */
const sideWp = (e, side) => side === 'w' ? wpWhite(e) : 100 - wpWhite(e);
function evFor(e, side) {
  if (!e) return 0;
  if (e.mated) return e.mated === side ? -10000 : 10000;
  if (e.mate === 0) return 0;
  if (e.mate != null) { const mine = (e.mate > 0) === (side === 'w'); return mine ? 10000 - Math.abs(e.mate) : -10000 + Math.abs(e.mate); }
  return side === 'w' ? (e.cp || 0) : -(e.cp || 0);
}
function evSide(e, side) {
  const v = evFor(e, side);
  if (Math.abs(v) >= 9000) return (v > 0 ? '+' : '−') + 'M' + (10000 - Math.abs(v));
  const x = v / 100; return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(1).replace('.', ',');
}
const curFen = A => A.fens[A.fens.length - 1];
const bareKing = (fen, color) => !parseBoard(fen).some(p => p && p.c === color && p.t !== 'k');
function act(kind, n) {
  const a = store.get('act', {}), k = dayKey(new Date()); const d = a[k] = a[k] || {};
  d[kind] = (d[kind] || 0) + (n || 1); store.set('act', a); cloudPrefsPush();
}
const actOn = (day, kind) => ((store.get('act', {})[dayKey(day)] || {})[kind]) || 0;
const done = () => store.get('arena', {});
function markDone(key, ok) { const d = done(); const e = d[key] = d[key] || { n: 0, ok: 0 }; e.n++; if (ok) e.ok = 1; e.t = Date.now(); store.set('arena', d); cloudPrefsPush(); }

/* ---------- vibração (Android) ---------- */
async function capCall(pl, m, o) {
  const C = window.Capacitor;
  if (!C || !NATIVE || NATIVE.platform !== 'android') throw new Error('na');
  const P = C.Plugins && C.Plugins[pl];
  if (P && typeof P[m] === 'function') return P[m](o || {});
  if (typeof C.nativePromise === 'function') return C.nativePromise(pl, m, o || {});
  throw new Error('na');
}
let HAPT_OK = true;
function vib(kind) { try { if (navigator.vibrate && (NATIVE || matchMedia('(pointer:coarse)').matches)) navigator.vibrate(kind === 'err' ? [30, 40, 30] : kind === 'ok' ? 18 : kind === 'cap' ? 14 : 8); } catch (e) { /* sem vibração */ } }
function haptic(kind) {
  if (!store.get('hap', true)) return;
  if (NATIVE && NATIVE.platform === 'android' && HAPT_OK) {
    const call = kind === 'err' ? capCall('Haptics', 'notification', { type: 'ERROR' }) : kind === 'ok' ? capCall('Haptics', 'notification', { type: 'SUCCESS' }) : capCall('Haptics', 'impact', { style: kind === 'cap' ? 'MEDIUM' : 'LIGHT' });
    call.catch(() => { HAPT_OK = false; vib(kind); }); return;
  }
  vib(kind);
}

/* ---------- tabela de finais (Lichess, até 7 peças) ---------- */
let TB_DOWN = 0;
async function tbProbe(fen) {
  const n = fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length; if (n > 7 || Date.now() < TB_DOWN) return null;
  const url = 'https://tablebase.lichess.ovh/standard?fen=' + encodeURIComponent(fen);
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(url, { signal: ctl.signal }); clearTimeout(t);
    if (r.ok) return await r.json();
  } catch (e) { /* tenta pelo aplicativo */ }
  try { if (NATIVE && NATIVE.fetchText) return JSON.parse(await Promise.race([NATIVE.fetchText(url), sleep(5000).then(() => { throw new Error('t'); })])); } catch (e) { /* sem tabela */ }
  TB_DOWN = Date.now() + 120000; return null;
}
const TB_WIN = { loss: 1, 'blessed-loss': 1, 'maybe-loss': 1 }, TB_LOSE = { win: 1, 'cursed-win': 1, 'maybe-win': 1 };

/* ---------- listas: vitórias que escaparam, posições para defender, seus finais ---------- */
let LISTS = null, LISTKEY = '';
function lists() {
  const key = acctKey() + ':' + analyzedGames().length + ':' + (S.games[0] ? S.games[0].id : '');
  if (LISTS && LISTKEY === key) return LISTS;
  const conv = [], def = [], ends = []; let reached = 0;
  for (const g of analyzedGames()) {
    const P = prep(g); if (!P.cls) continue; const me = g.c, r = rk(g);
    const wp = P.evs.map(e => sideWp(e, me)); const myTurn = i => (i % 2 === 0) === (me === 'w');
    let iw = -1; for (let i = 10; i < P.moves.length; i++) if (myTurn(i) && wp[i] >= 85) { iw = i; break; }
    if (iw >= 0) {
      reached++;
      if (r !== 'W') {
        let slip = null;
        for (let j = iw; j < P.moves.length; j++) if (myTurn(j) && P.cls[j].loss >= 10 && wp[j + 1] < 75) { slip = { ply: j, before: wp[j], after: wp[j + 1], san: P.moves[j].san }; break; }
        conv.push({ gid: g.id, ply: iw, wp: wp[iw], ev: P.evs[iw], slip, end: g.end, opp: g.opp, res: r });
      }
    }
    if (r === 'L') {
      for (let i = 12; i < P.moves.length; i++) {
        if (!myTurn(i)) continue; const v = evFor(P.evs[i], me);
        if (v <= -120 && v >= -400) { def.push({ gid: g.id, ply: i, wp: wp[i], ev: P.evs[i], end: g.end, opp: g.opp }); break; }
      }
    }
    for (let i = 0; i < P.moves.length; i++) {
      if (!myTurn(i)) continue; const c = P.cls[i];
      if (c.k !== 'blunder' && c.k !== 'mistake') continue;
      if (phaseOf(parseBoard(P.fens[i]), i) !== 'final' || c.wb < 30) continue;
      ends.push({ gid: g.id, ply: i, wp: c.wb, ev: P.evs[i], end: g.end, opp: g.opp, mode: c.wb >= 70 ? 'convert' : 'hold', san: P.moves[i].san, after: c.wa });
      break;
    }
  }
  const byEnd = (a, b) => b.end - a.end;
  LISTS = { conv: conv.sort(byEnd), def: def.sort(byEnd), ends: ends.sort(byEnd), reached };
  LISTKEY = key; return LISTS;
}

/* ---------- curso de finais: posições conferidas com o Stockfish ---------- */
const ENDS = [
  { id: 'qmate', t: 'Mate com dama e rei', g: 'Mates básicos', fen: '8/8/3k4/8/8/8/8/4K2Q w - - 0 1', goal: 'mate', idea: 'A dama encurrala o rei adversário numa caixa cada vez menor; quando ele chega à borda, o seu rei se aproxima e ajuda no mate.', tips: ['Fique com a dama a um salto de cavalo do rei inimigo: isso o empurra para a borda sem dar afogamento.', 'A dama sozinha não dá mate: traga o seu rei.', 'Antes de cada lance, confira se o rei adversário ainda tem uma casa livre. Sem casa e sem xeque é afogamento, empate.'] },
  { id: 'rmate', t: 'Mate com torre e rei', g: 'Mates básicos', fen: '3k4/8/8/8/8/8/8/R3K3 w - - 0 1', goal: 'mate', idea: 'A torre funciona como uma parede que corta o rei adversário. O seu rei se aproxima e, quando os reis ficam frente a frente, a torre dá xeque e empurra o rei para trás.', tips: ['Corte o rei com a torre numa fileira ou coluna.', 'Quando os reis estiverem frente a frente (oposição), dê xeque com a torre.', 'Se o rei inimigo atacar a torre, mande-a para o outro lado do tabuleiro.'] },
  { id: 'square', t: 'A regra do quadrado', g: 'Finais de peões', fen: '8/8/8/5k2/1P6/8/8/7K b - - 0 1', goal: 'draw', need: 6, user: 'b', idea: 'Trace um quadrado da casa do peão até a fileira de promoção. Se o seu rei consegue entrar nesse quadrado, ele alcança o peão.', tips: ['O peão em b4 promove em b8: o quadrado vai de b4 a f8.', 'Seu rei em f5 já está dentro: vá na direção do peão.', 'Um passo para o lado errado e o peão escapa.'] },
  { id: 'opp', t: 'Oposição para vencer', g: 'Finais de peões', fen: '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1', goal: 'promote', idea: 'Com rei e peão contra rei, o rei vai na frente do peão. Ganhe a oposição (reis frente a frente com uma casa entre eles, e o adversário a jogar) para abrir caminho.', tips: ['Primeiro o rei, depois o peão.', 'O lance de peão serve para passar a vez e recuperar a oposição.', 'Rei na 6ª fileira na frente do peão ganha sempre (menos com peão de torre).'] },
  { id: 'rookpawn', t: 'Peão de torre: o canto salva', g: 'Finais de peões', fen: '8/8/8/5k2/8/8/6KP/8 b - - 0 1', goal: 'draw', need: 8, user: 'b', idea: 'Contra o peão de torre, se o seu rei chega ao canto de promoção (h8), é empate: o rei adversário não consegue tirá-lo de lá sem dar afogamento.', tips: ['Vá para h8 ou para as casas vizinhas.', 'Não precisa capturar o peão: basta ocupar o canto.', 'Ficar preso longe do canto perde.'] },
  { id: 'wrongb', t: 'Bispo da cor errada', g: 'Finais de peças menores', fen: '8/8/5k2/8/7P/3B4/6K1/8 b - - 0 1', goal: 'draw', need: 8, user: 'b', idea: 'Peão de torre com um bispo que não controla a casa de promoção: h8 é escura e o bispo anda nas claras. Se o seu rei chegar ao canto, é empate.', tips: ['Vá para g7 e h8 e fique por ali.', 'O bispo de casas claras nunca expulsa o rei de h8.', 'Aqui o afogamento é seu amigo.'] },
  { id: 'lucena', t: 'Posição de Lucena', g: 'Finais de torre', fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1', goal: 'promote', idea: 'O final de torre mais importante para ganhar. Corte o rei adversário e "construa a ponte": a torre vai para a 4ª fileira para bloquear os xeques laterais.', tips: ['Primeiro um xeque para afastar o rei adversário: Td1+.', 'Depois a torre vai para a 4ª fileira: Td4.', 'Saia com o rei; quando vierem os xeques, interponha a torre.'] },
  { id: 'philidor', t: 'Defesa Philidor', g: 'Finais de torre', fen: '4k3/8/8/4PK2/8/8/7R/1r6 b - - 0 1', goal: 'draw', need: 10, user: 'b', idea: 'A defesa clássica do final de torre: a torre fica na 6ª fileira até o peão avançar; aí ela volta para a 1ª e dá xeques por trás.', tips: ['Torre para a 6ª fileira agora: Tb6.', 'Quando o peão chegar à 6ª, a torre vai para a 1ª fileira e dá xeques pelas costas.', 'O rei fica na frente do peão.'] },
  { id: 'qvp', t: 'Dama contra peão na 7ª', g: 'Finais de dama', fen: '8/8/8/8/8/8/3pk3/K6Q w - - 0 1', goal: 'win', idea: 'Contra peão central ou de cavalo na 7ª, a dama vence: com xeques e ataques ao peão, obrigue o rei adversário a ficar na frente do próprio peão e use cada um desses tempos para aproximar o seu rei.', tips: ['Xeques que ganham tempo: o rei inimigo precisa bloquear o peão.', 'Toda vez que ele ocupa a casa de promoção, o seu rei dá um passo.', 'Capture o peão quando o seu rei estiver perto.'] }
];
const GOALTXT = { mate: 'Dê xeque-mate.', promote: 'Promova o peão (ou deixe o adversário só com o rei) sem perder a vitória.', win: 'Vença: deixe o adversário só com o rei ou dê mate.', draw: 'Segure o empate.' };

/* ---------- arena: o tabuleiro dos desafios ---------- */
let AR = null, ARTICK = 0;
const AR_ELOS = [[1350, '1350'], [1600, '1600'], [1900, '1900'], [2200, '2200'], [0, 'Máximo']];
const KIND_LAB = { convert: 'Converter a vitória', defend: 'Defenda a posição', end: 'Curso de finais', mine: 'Seus finais', clock: 'Treino de relógio', xray: 'Raio-X da peça', spot: 'Ache o erro', mates: 'Padrões de mate' };
function openArena(kind) {
  stopArenaTimers();
  S.arena = { kind, lobby: true, sel: 0 };
  if (location.hash === '#arena') { S.view = ''; route(); } else location.hash = 'arena';
}
function stopArenaTimers() { if (ARTICK) clearInterval(ARTICK); ARTICK = 0; }
function arBoard() {
  if (!AR) {
    AR = new Board($('#arBoard'));
    AR.el.addEventListener('pointerdown', e => { const A = S.arena; if (A && A.kind === 'xray' && !A.lobby) xrayTap(e); });
  }
  return AR;
}
function renderArena() {
  arBoard(); const A = S.arena;
  if (arHuman() && MAIA.st === 'off' && store.get('maiaOk', false)) maiaLoad();
  if (!A) { $('#arHead').innerHTML = ''; $('#arPanel').innerHTML = '<p>Escolha um treino na aba Treino.</p><a class="btn primary" href="#treino">Ir para o Treino</a>'; AR.setPosition('8/8/8/8/8/8/8/8 w - - 0 1', false); return; }
  if (!analyzedReady() && A.kind !== 'end' && A.kind !== 'clock') { $('#arPanel').innerHTML = CALC; warmPrep().then(() => { if (S.view === 'arena') renderArena(); }); return; }
  if (A.lobby) renderLobby(); else arDraw(false);
}
function arHead(title, sub) {
  $('#arHead').innerHTML = '<div class="stack" style="gap:3px;min-width:0"><span class="label">' + esc(KIND_LAB[S.arena.kind] || 'Treino') + '</span><span class="who">' + esc(title) + '</span>' + (sub ? '<span class="muted" style="font-size:13.5px">' + esc(sub) + '</span>' : '') + '</div><div style="display:flex;gap:8px;flex-wrap:wrap">' + (S.arena.lobby ? '' : '<button class="btn small" type="button" data-ar="lobby">Outras posições</button>') + '<a class="btn small" href="#treino">Voltar ao treino</a></div>';
}
function eloSeg() { const v = store.get('arElo', 1600); return '<div class="stack" style="gap:6px"><span class="label">Força do adversário (motor)</span><div class="seg" role="group">' + AR_ELOS.map(([e, t]) => '<button type="button" data-ar="elo:' + e + '" aria-pressed="' + (v === e) + '">' + t + '</button>').join('') + '</div></div>'; }
function itemRow(x, i, extra) {
  const d = done()[S.arena.kind + ':' + x.gid + ':' + x.ply];
  return '<button class="repmv arow" type="button" data-ar="pick:' + i + '"' + (S.arena.sel === i ? ' aria-current="true"' : '') + '><span style="min-width:0;display:flex;flex-direction:column;gap:1px"><b>vs ' + esc(x.opp) + ' · ' + dateLabel(x.end) + '</b><span class="muted" style="font-size:12.5px">' + extra + '</span></span><span class="mono">' + esc(evSide(x.ev, S.games.find(g => g.id === x.gid).c)) + '</span>' + (d && d.ok ? '<span class="tag W" style="padding:3px 7px">feito</span>' : d ? '<span class="tag plain" style="padding:3px 7px">tentado</span>' : '<span></span>') + '</button>';
}
function lobbyPreview(fen, color, last) {
  AR.setLive(null); AR.setFlip(color === 'b'); AR.setPosition(fen, false); AR.setMarks(last ? { last } : {}); AR.setArrows([]);
  $('#arClkTop').innerHTML = ''; $('#arClkBot').innerHTML = '';
}
function renderLobby() {
  const A = S.arena, k = A.kind; let h = '';
  if (k === 'convert' || k === 'defend' || k === 'mine') {
    const Ls = lists(), items = k === 'convert' ? Ls.conv : k === 'defend' ? Ls.def : Ls.ends;
    const head = {
      convert: ['Vitórias que escaparam', 'Em ' + Ls.reached + ' partidas analisadas você chegou a ter 85% ou mais de chance de vencer; ' + Ls.conv.length + ' delas não viraram vitória. Jogue de novo a partir do momento em que você estava ganhando e feche a partida.'],
      defend: ['Posições para segurar', 'Partidas que você perdeu depois de ficar um pouco pior (entre −1,2 e −4). Volte para esse momento e tente salvar: empatar, igualar ou aguentar 25 lances.'],
      mine: ['Seus finais', 'Finais das suas partidas em que você errou. Recomece do lance anterior ao erro: se estava ganhando, converta; se estava equilibrado, segure.']
    }[k];
    arHead(head[0], items.length + ' posições');
    h += '<p>' + esc(head[1]) + '</p>' + styleSeg() + (arHuman() ? '' : eloSeg());
    if (!items.length) h += '<p class="muted">Ainda não há posições assim nas suas partidas analisadas.</p>';
    else {
      A.sel = Math.min(A.sel, items.length - 1);
      h += '<div class="stack" style="gap:6px;max-height:46vh;overflow:auto">' + items.slice(0, 80).map((x, i) => itemRow(x, i, k === 'convert' ? (x.slip ? 'A vantagem foi embora em ' + moveNum(x.slip.ply) + fig(x.slip.san) + ' (' + pct(x.slip.before) + ' → ' + pct(x.slip.after) + ')' : 'A vantagem foi embora aos poucos') : k === 'mine' ? (x.mode === 'convert' ? 'Converter: ' : 'Segurar: ') + 'você jogou ' + fig(x.san) + ' (' + pct(x.wp) + ' → ' + pct(x.after) + ')' : 'Chance de vitória ' + pct(x.wp))).join('') + '</div>';
      const x = items[A.sel], g = S.games.find(y => y.id === x.gid), P = prep(g), pm = x.ply > 0 ? P.moves[x.ply - 1] : null;
      lobbyPreview(P.fens[x.ply], g.c, pm ? [pm.from, pm.to] : null);
      h += '<div class="vxacts"><button class="btn primary" type="button" data-ar="go">Começar esta posição</button><button class="btn small" type="button" data-openply="' + g.id + ':' + x.ply + '">Ver na partida</button></div>';
    }
  } else if (k === 'end') {
    arHead('Curso de finais', ENDS.filter(e => done()['end:' + e.id] && done()['end:' + e.id].ok).length + ' de ' + ENDS.length + ' lições concluídas');
    const groups = []; for (const e of ENDS) if (!groups.includes(e.g)) groups.push(e.g);
    h += '<p>Posições essenciais para jogar contra o motor. Com internet, o adversário usa a tabela de finais do Lichess, que joga perfeitamente e avisa no mesmo lance se você deixou escapar o resultado.</p>';
    h += groups.map(gr => '<div class="stack" style="gap:6px"><span class="label">' + esc(gr) + '</span>' + ENDS.map((e, i) => e.g !== gr ? '' : '<button class="repmv arow" type="button" data-ar="pick:' + i + '"' + (A.sel === i ? ' aria-current="true"' : '') + '><span style="min-width:0"><b>' + esc(e.t) + '</b><span class="muted" style="display:block;font-size:12.5px">' + esc(GOALTXT[e.goal]) + ' Você joga de ' + SIDE[e.user || 'w'] + '.</span></span><span></span>' + (done()['end:' + e.id] && done()['end:' + e.id].ok ? '<span class="tag W" style="padding:3px 7px">feito</span>' : '<span></span>') + '</button>').join('') + '</div>').join('');
    const e = ENDS[Math.min(A.sel, ENDS.length - 1)];
    lobbyPreview(e.fen, e.user || 'w');
    h += '<div class="blk"><h3>' + esc(e.t) + '</h3><p>' + esc(e.idea) + '</p></div><div class="vxacts"><button class="btn primary" type="button" data-ar="go">Começar a lição</button></div>';
    const me = lists().ends.length; if (me) h += '<button class="btn small accent" type="button" data-ar="open:mine">Treinar os finais das suas partidas (' + me + ')</button>';
  } else if (k === 'clock') {
    arHead('Treino de relógio', 'Partida contra o motor com relógio de verdade');
    const su = A.su = A.su || { tc: store.get('clkTc', '180+0'), color: 'w' };
    const TCS = [['60+0', '1+0'], ['180+0', '3+0'], ['180+2', '3+2'], ['300+0', '5+0'], ['600+0', '10+0']];
    h += '<p>O relógio corre de verdade e o motor também gasta tempo. A barra de ritmo mostra quanto do seu tempo você já usou em relação à meta: no máximo 20% até o lance 10, 60% até o 25 e 85% até o 40. No fim, o app confere seus lances e mostra quantos erros vieram com pouco tempo.</p>';
    h += '<div class="stack" style="gap:6px"><span class="label">Ritmo</span><div class="seg" role="group">' + TCS.map(([v, t]) => '<button type="button" data-ar="tc:' + v + '" aria-pressed="' + (su.tc === v) + '">' + t + '</button>').join('') + '</div></div>';
    h += styleSeg() + (arHuman() ? '' : eloSeg()) + '<div class="stack" style="gap:6px"><span class="label">Você joga de</span><div class="seg" role="group"><button type="button" data-ar="col:w" aria-pressed="' + (su.color === 'w') + '">Brancas</button><button type="button" data-ar="col:b" aria-pressed="' + (su.color === 'b') + '">Pretas</button></div></div>';
    h += '<div class="vxacts"><button class="btn primary" type="button" data-ar="go">Começar a partida</button></div>' + clockHistHtml();
    lobbyPreview('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', su.color);
  } else if (k === 'mates') {
    arHead('Padrões de mate', MATES.filter(p => done()['mates:' + p.id] && done()['mates:' + p.id].ok).length + ' de ' + MATES.length + ' resolvidos');
    h += matesLobbyHtml();
  } else if (k === 'spot') {
    arHead('Ache o erro', 'Trechos das suas partidas');
    h += '<p>O app mostra um trecho de uma partida sua, lance a lance. Toque no lance seu que mudou a partida. Treina o olhar para o momento em que a coisa desanda, que costuma passar despercebido durante o jogo.</p><div class="vxacts"><button class="btn primary" type="button" data-ar="go">Começar (5 trechos)</button></div>';
    lobbyPreview('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'w');
  } else if (k === 'xray') {
    arHead('Raio-X da peça', 'Visão de tabuleiro contra o relógio');
    h += '<p>Em 60 segundos, toque em todas as <b>peças soltas</b> de cada posição: cavalos, bispos, torres e damas, das duas cores, que não têm nenhuma peça defendendo. Depois toque em Conferir. As que estiverem soltas <i>e</i> atacadas aparecem em vermelho: são as penduradas, o tipo de erro que custou ' + (buildTraining().tags.hang || 0) + ' dos seus erros graves.</p>';
    h += '<p class="muted">Recorde: ' + store.get('xbest', 0) + ' posições certas.</p><div class="vxacts"><button class="btn primary" type="button" data-ar="go">Começar (60 s)</button></div>';
    const pos = xrayPositions(1)[0]; if (pos) lobbyPreview(pos.fen, pos.fen.split(' ')[1]);
  }
  $('#arPanel').innerHTML = '<div class="stack fade" style="gap:14px">' + h + '</div>';
}
function arLobbyAction(a) {
  const A = S.arena; if (!A) return;
  if (a === 'lobby') { stopArenaTimers(); S.arena = { kind: A.kind === 'mine' ? 'mine' : A.kind, lobby: true, sel: A.sel || 0, su: A.su }; renderArena(); return; }
  if (a.startsWith('open:')) { S.arena = { kind: a.slice(5), lobby: true, sel: 0 }; renderArena(); return; }
  if (a.startsWith('elo:')) { store.set('arElo', +a.slice(4)); renderLobby(); return; }
  if (a.startsWith('style:')) { store.set('arStyle', a.slice(6)); if (a.slice(6) === 'human' && MAIA.st === 'off' && store.get('maiaOk', false)) maiaLoad(); renderLobby(); return; }
  if (a.startsWith('melo:')) { store.set('maiaElo', +a.slice(5)); renderLobby(); return; }
  if (a.startsWith('pick:')) { A.sel = +a.slice(5); renderLobby(); return; }
  if (a.startsWith('tc:')) { A.su.tc = a.slice(3); store.set('clkTc', A.su.tc); renderLobby(); return; }
  if (a.startsWith('col:')) { A.su.color = a.slice(4); renderLobby(); return; }
  if (a === 'go') {
    if (A.kind === 'end') return startLesson(ENDS[Math.min(A.sel, ENDS.length - 1)]);
    if (A.kind === 'clock') { if (arHuman() && !maiaReady()) { toast(MAIA.st === 'loading' ? 'Espere o Maia terminar de baixar' : 'Baixe o Maia primeiro, ou escolha o adversário Motor'); return; } return startClock(A.su); }
    if (A.kind === 'xray') return startXray();
    if (A.kind === 'spot') return startSpot();
    if (A.kind === 'mates') return startMate(MATES[Math.min(A.sel, MATES.length - 1)]);
    if (arHuman() && !maiaReady()) { toast(MAIA.st === 'loading' ? 'Espere o Maia terminar de baixar' : 'Baixe o Maia primeiro, ou escolha o adversário Motor'); return; }
    const Ls = lists(), items = A.kind === 'convert' ? Ls.conv : A.kind === 'defend' ? Ls.def : Ls.ends;
    if (items[A.sel]) startFromGame(A.kind, items[A.sel], A.sel);
  }
}
function startFromGame(kind, x, sel) {
  const g = S.games.find(y => y.id === x.gid); const P = prep(g);
  const mode = kind === 'mine' ? x.mode : kind;
  const v0 = evFor(x.ev, g.c);
  const cfg = mode === 'convert' ? { goal: 'convert', winAbove: kind === 'mine' ? 600 : 700, failBelow: kind === 'mine' ? 50 : 150 }
    : mode === 'defend' ? { goal: 'defend', even: -50, survive: 25, surviveMin: -250, failBelow: -800 }
      : { goal: 'hold', even: Math.max(150, v0 + 150), survive: 20, surviveMin: -150, failBelow: -500 };
  const pm = x.ply > 0 ? P.moves[x.ply - 1] : null;
  arStart(Object.assign({
    kind, sel, title: 'vs ' + g.opp + ' · ' + dateLabel(g.end, true), sub: opName(g), fen: P.fens[x.ply], user: g.c, elo: store.get('arElo', 1600),
    src: { gid: g.id, ply: x.ply, slip: x.slip || null }, key: kind + ':' + g.id + ':' + x.ply, last0: pm ? [pm.from, pm.to] : null, ev: x.ev
  }, cfg));
}
function startLesson(e) {
  arStart({ kind: 'end', title: e.t, sub: e.g, fen: e.fen, user: e.user || 'w', goal: e.goal, need: e.need || 0, lesson: e, elo: 0, tb: true, key: 'end:' + e.id, sel: ENDS.indexOf(e) });
}
function arStart(o) {
  stopArenaTimers();
  if (o.kind !== 'end' && o.kind !== 'mates' && arHuman() && maiaReady()) { o.human = maiaElo(); o.sub = (o.sub ? o.sub + ' · ' : '') + 'adversário humano ~' + o.human; }
  const A = S.arena = Object.assign({ lobby: false, fens: [o.fen], moves: [], status: 'play', msg: '', thinking: false, userMoves: 0, big: 0, hints: 0, undos: 0, hint: null, t0: Date.now() }, o);
  arBoard(); AR.setFlip(A.user === 'b'); AR.setPosition(A.fen, false);
  arDraw(false);
  if (A.kind !== 'clock' && !A.ev && A.kind !== 'end') evalPos(A.fen, 400).then(e => { if (S.arena === A && !A.ev) { A.ev = e; arPanel(); } }).catch(() => {});
  if (curFen(A).split(' ')[1] !== A.user) arEngine(A);
}
function arDraw(animate) {
  const A = S.arena; if (!A || A.lobby) return;
  const fen = curFen(A), m = A.moves[A.moves.length - 1];
  AR.setPosition(fen, animate);
  const marks = {}; if (m) marks.last = [m.from, m.to]; else if (A.last0) marks.last = A.last0;
  const ch = new Chess(fen); if (ch.inCheck()) { const B = parseBoard(fen); const k = B.findIndex(p => p && p.t === 'k' && p.c === ch.turn()); if (k >= 0) marks.check = iSq(k); }
  AR.setMarks(marks);
  AR.setArrows(A.hint && A.hint.full ? [{ from: A.hint.uci.slice(0, 2), to: A.hint.uci.slice(2, 4), cls: 'a-best' }] : []);
  if (A.hint && !A.hint.full) AR.setMarks(Object.assign({}, marks, { sel: A.hint.uci.slice(0, 2) }));
  arHead(A.title, A.sub); arClocks(); arPanel(); arArm();
}
function arArm() {
  const A = S.arena; if (!A || A.lobby || A.kind === 'xray') { if (AR) AR.setLive(null); return; }
  const fen = curFen(A), c = new Chess(fen);
  if (A.status !== 'play' || A.thinking || c.turn() !== A.user || c.isGameOver()) { AR.setLive(null); return; }
  const dests = {}; for (const mv of c.moves({ verbose: true })) { const a = dests[mv.from] = dests[mv.from] || []; if (!a.includes(mv.to)) a.push(mv.to); }
  AR.setLive({ color: A.user, dests, marks: AR.marks, onMove: (f, t) => arUserMove(f, t) });
}
function arPush(A, m, fen) { A.moves.push(m); A.fens.push(fen); }
async function arUserMove(from, to) {
  const A = S.arena; if (!A || A.status !== 'play' || A.thinking) return;
  const c = new Chess(curFen(A)); let m; try { m = c.move({ from, to, promotion: 'q' }); } catch (e) { arArm(); return; }
  if (A.kind === 'clock' && !clockMove(A, A.user)) return;
  A.hint = null; arPush(A, m, c.fen()); A.userMoves++; haptic(m.captured ? 'cap' : 'move');
  arDraw(true);
  if (A.kind === 'clock') A.spent.push({ s: A.lastSpent, left: A.clock.t[A.user] / 1000 });
  if (arGameOver(A)) return;
  if (A.limit && A.userMoves >= A.limit) return arFinish(false, 'Ainda não é mate. Este padrão fecha em ' + A.limit + ' lance' + (A.limit > 1 ? 's' : '') + ': desfaça e tente de novo.', true);
  if (A.kind === 'end' && A.tb && !A.tbOff) {
    A.thinking = true; arPanel();
    const r = await tbProbe(c.fen()); A.thinking = false; if (S.arena !== A) return;
    if (r && r.category) {
      A.tbCat = r.category; A.tbMoves = r.moves || [];
      const userWins = TB_WIN[r.category], userLoses = TB_LOSE[r.category];
      if ((A.goal !== 'draw' && !userWins) || (A.goal === 'draw' && userLoses)) return arFinish(false, A.goal === 'draw' ? fig(m.san) + ' perde: com jogo perfeito o adversário agora vence. Desfaça e tente outro lance.' : fig(m.san) + ' deixa escapar a vitória: com jogo perfeito do adversário, isto agora é ' + (r.category === 'draw' || r.category === 'blessed-loss' || r.category === 'cursed-win' ? 'empate' : 'derrota') + '. Desfaça e tente outro lance.', true);
      if ((A.goal === 'promote' && (m.promotion || bareKing(c.fen(), other(A.user)))) || (A.goal === 'win' && bareKing(c.fen(), other(A.user)))) return arFinish(true, m.promotion ? 'Peão promovido e a vitória está garantida.' : 'O adversário ficou só com o rei: vitória garantida.');
      if (A.goal === 'draw' && A.userMoves >= A.need) return arFinish(true, 'Empate seguro: você encontrou a defesa certa.');
    } else A.tbOff = true;
  }
  await arEngine(A);
}
function clockThink(A) { const opp = other(A.user), left = A.clock.t[opp]; return Math.max(150, Math.min(2500, left / 38 + A.clock.inc * 600)); }
async function arEngine(A) {
  if (A.status !== 'play') return;
  A.thinking = true; arPanel(); arArm();
  const fen = curFen(A); let uci = null;
  if (A.kind === 'end' && A.tb && !A.tbOff) {
    if (!A.tbMoves) { const r = await tbProbe(fen); if (r && r.moves) A.tbMoves = r.moves; else A.tbOff = true; }
    if (A.tbMoves && A.tbMoves.length && A.tbMoves[0].uci) uci = A.tbMoves[0].uci;
  }
  A.tbMoves = null;
  if (!uci && A.human && maiaReady()) {
    const t0 = performance.now();
    try { uci = await maiaMove(fen, A.human); } catch (e) { uci = null; }
    if (A.kind === 'clock') { const want = Math.min(clockThink(A), 600 + Math.random() * 1400), el = performance.now() - t0; if (el < want) await sleep(want - el); }
    else { const el = performance.now() - t0; if (el < 450) await sleep(450 - el); }
  }
  if (!uci) {
    const ms = A.kind === 'clock' ? clockThink(A) : A.kind === 'end' ? 900 : 700;
    try { await Engine.init(); const r = await Engine.go(fen, ms, { elo: A.elo || 0 }); uci = r.best; }
    catch (e) { A.noEngine = true; }
  }
  if (S.arena !== A || A.status !== 'play') return;
  A.thinking = false;
  if (!uci) { A.msg = 'O motor não carregou neste aparelho.'; arDraw(false); return; }
  if (A.kind === 'clock' && !clockMove(A, other(A.user))) return;
  const c = new Chess(fen); let m;
  try { m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined }); } catch (e) { arDraw(false); return; }
  arPush(A, m, c.fen()); arDraw(true);
  if (arGameOver(A)) return;
  if (A.kind === 'clock') return;
  if (A.kind !== 'end' || A.tbOff || !A.tb) {
    try { A.ev = await evalPos(c.fen(), A.kind === 'end' ? 600 : 400); } catch (e) { A.ev = null; }
    if (S.arena !== A || A.status !== 'play') return;
    arCheckEval(A);
  }
  arPanel();
}
function arGameOver(A) {
  const c = new Chess(curFen(A)); if (!c.isGameOver()) return false;
  if (c.isCheckmate()) {
    const userMated = c.turn() === A.user;
    if (A.kind === 'clock') return clockEnd(A, userMated ? 'L' : 'W', userMated ? 'Xeque-mate: o motor venceu.' : 'Xeque-mate! Você venceu.');
    return arFinish(!userMated, userMated ? 'Xeque-mate: o adversário venceu.' : 'Xeque-mate! ' + (A.goal === 'defend' || A.goal === 'hold' || A.goal === 'draw' ? 'Você não só segurou como venceu.' : 'Objetivo cumprido.'));
  }
  const why = c.isStalemate() ? 'afogamento' : c.isThreefoldRepetition() ? 'repetição' : c.isInsufficientMaterial() ? 'material insuficiente' : 'regra dos 50 lances';
  if (A.kind === 'clock') return clockEnd(A, 'D', 'Empate por ' + why + '.');
  const drawOk = A.goal === 'draw' || A.goal === 'defend' || A.goal === 'hold';
  return arFinish(drawOk, 'Empate por ' + why + '. ' + (drawOk ? 'Objetivo cumprido.' : 'A vitória escapou.'), !drawOk && A.kind === 'end');
}
function arCheckEval(A) {
  const e = A.ev; if (!e) return; const v = evFor(e, A.user), fen = curFen(A);
  if (A.goal === 'convert') {
    if (v >= A.winAbove || bareKing(fen, other(A.user))) { A.big++; if (A.big >= 2 || bareKing(fen, other(A.user)) || v >= 9000) return arFinish(true, 'Vantagem decisiva (' + evSide(e, A.user) + '): vitória convertida.'); } else A.big = 0;
    if (v < A.failBelow) return arFinish(false, 'A vantagem escapou: a avaliação caiu para ' + evSide(e, A.user) + '.');
  } else if (A.goal === 'defend' || A.goal === 'hold') {
    if (v >= A.even) return arFinish(true, 'Você igualou a partida (' + evSide(e, A.user) + ').');
    if (A.userMoves >= A.survive && v >= A.surviveMin) return arFinish(true, 'Você aguentou ' + A.userMoves + ' lances sem deixar a posição cair (' + evSide(e, A.user) + ').');
    if (v <= A.failBelow) return arFinish(false, 'A posição caiu: ' + evSide(e, A.user) + '.');
  } else if (A.kind === 'end') {
    if (A.goal === 'draw') { if (v <= -400) return arFinish(false, 'A posição agora está perdida (' + evSide(e, A.user) + '). Desfaça e tente outro lance.', true); if (A.userMoves >= A.need) return arFinish(true, 'Empate seguro: você encontrou a defesa certa.'); }
    else {
      if (v < 200) return arFinish(false, 'A vantagem escapou (' + evSide(e, A.user) + '). Desfaça e tente outro lance.', true);
      const last = A.moves[A.moves.length - 2];
      if ((A.goal === 'promote' && ((last && last.promotion && last.color === A.user) || bareKing(fen, other(A.user)))) || (A.goal === 'win' && bareKing(fen, other(A.user)))) return arFinish(true, 'Objetivo cumprido, e a vitória está garantida.');
    }
  }
}
function arFinish(ok, msg, canUndo) {
  const A = S.arena; if (!A || A.status !== 'play') return true;
  A.status = ok ? 'won' : 'lost'; A.msg = msg; A.canUndo = !!canUndo; A.thinking = false;
  haptic(ok ? 'ok' : 'err');
  if (A.key && A.kind !== 'clock') markDone(A.key, ok && !A.hints);
  if (!A.counted) { A.counted = true; act(A.kind === 'mine' ? 'end' : A.kind); }
  arDraw(false); return true;
}
function arUndo() {
  const A = S.arena; if (!A || A.thinking || A.kind === 'clock' || A.kind === 'xray') return;
  let popped = false;
  while (A.moves.length) { const m = A.moves.pop(); A.fens.pop(); if (m.color === A.user) { popped = true; break; } }
  if (!popped) return;
  A.status = 'play'; A.msg = ''; A.undos++; A.userMoves = Math.max(0, A.userMoves - 1); A.big = 0; A.hint = null; A.tbMoves = null;
  arDraw(false);
  if (A.kind !== 'end' || A.tbOff) evalPos(curFen(A), 400).then(e => { if (S.arena === A) { A.ev = e; arPanel(); } }).catch(() => {});
}
async function arHint() {
  const A = S.arena; if (!A || A.status !== 'play' || A.thinking || A.kind === 'clock') return;
  if (A.hint && !A.hint.full) { A.hint.full = true; A.hints++; arDraw(false); return; }
  let uci = null;
  if (A.kind === 'end' && A.tb && !A.tbOff) { const r = await tbProbe(curFen(A)); if (r && r.moves && r.moves[0]) uci = r.moves[0].uci; }
  if (!uci) { try { await Engine.init(); const e = await evalPos(curFen(A), 900); uci = e.best; } catch (e) { uci = null; } }
  if (!uci || S.arena !== A) return;
  A.hints++; A.hint = { uci, full: false }; arDraw(false);
}
function arPanel() {
  const A = S.arena; if (!A || A.lobby) return; if (A.kind === 'xray') return xrayPanel();
  const fen = curFen(A), c = new Chess(fen), m = A.moves.length ? A.moves[A.moves.length - 1] : null;
  let h = '';
  const goal = A.kind === 'clock' ? 'Partida ' + A.clock.label + ' contra ' + (A.human ? 'um humano de ~' + A.human + ' (Maia)' : 'o motor (' + (A.elo ? 'força ~' + A.elo : 'força máxima') + ')') + '. Você joga de ' + SIDE[A.user] + '.'
    : A.goal === 'convert' ? 'Você está ganhando. Converta: chegue a uma vantagem decisiva (mais de +' + Math.round(A.winAbove / 100) + ') ou dê mate sem deixar a avaliação cair abaixo de +' + sp(A.failBelow / 100, 1) + '.'
      : A.goal === 'defend' ? 'Você está pior. Segure: iguale a partida, consiga um empate ou aguente ' + A.survive + ' lances sem a avaliação passar de ' + sp(A.surviveMin / 100, 1) + '.'
        : A.goal === 'hold' ? 'Posição equilibrada. Segure: aguente ' + A.survive + ' lances sem a avaliação passar de ' + sp(A.surviveMin / 100, 1) + ', ou consiga mais.'
          : GOALTXT[A.goal] + (A.goal === 'draw' ? ' Aguente ' + A.need + ' lances com a defesa certa.' : A.limit ? ' Mate em ' + A.limit + '.' : '');
  h += '<div class="blk"><h3>Objetivo</h3><p>' + esc(goal) + '</p></div>';
  if (A.lesson && A.status === 'play' && !A.moves.length) h += '<div class="blk"><h3>A ideia</h3><p>' + esc(A.lesson.idea) + '</p><ul class="facts">' + A.lesson.tips.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
  if (A.status !== 'play') h += '<div class="fb ' + (A.status === 'won' ? 'ok' : A.status === 'drawn' ? 'hint' : 'no') + '">' + esc(A.msg) + '</div>';
  else if (A.thinking) h += '<p class="muted">O adversário está pensando…</p>';
  else if (c.turn() === A.user) h += '<p class="muted">Sua vez.</p>';
  if (A.msg && A.status === 'play') h += '<div class="warn">' + esc(A.msg) + '</div>';
  if (A.kind === 'clock') h += clockPanel(A);
  else if (A.kind === 'mates') { /* sem avaliação: o objetivo é o mate */ }
  else {
    if (A.kind !== 'end' || A.tbOff) { if (A.ev) h += '<p class="muted" style="font-size:13.5px">Avaliação do motor: <b class="mono" style="color:var(--ink)">' + esc(evSide(A.ev, A.user)) + '</b> (do seu ponto de vista)</p>'; }
    else if (A.tbCat) h += '<p class="muted" style="font-size:13.5px">Tabela de finais: ' + (TB_WIN[A.tbCat] ? 'você vence com jogo perfeito' : TB_LOSE[A.tbCat] ? 'o adversário vence com jogo perfeito' : 'empate com jogo perfeito') + '.</p>';
    if (A.kind === 'end' && A.tbOff && A.tb) h += '<p class="muted" style="font-size:12.5px">Sem a tabela de finais agora (offline?): o adversário é o Stockfish.</p>';
    let i = A.moves.length - 1; while (i >= 0 && A.moves[i].color !== A.user) i--;
    if (i >= 0) { const um = A.moves[i]; h += '<div class="blk"><h3>Seu último lance: ' + esc(fig(um.san)) + '</h3><p>' + esc(ideaSentences(factsFor(A.fens[i], um, 40 + i), um).join(' ')) + '</p></div>'; }
    if (A.hint) { const B = parseBoard(fen), p = B[sqI(A.hint.uci.slice(0, 2))]; h += '<div class="bestbox"><h3>Dica</h3><p>' + esc(A.hint.full ? 'A seta mostra o melhor lance.' : 'Pense em ' + (p ? pz(p.t) : 'a peça') + ' de ' + A.hint.uci.slice(0, 2) + '. Toque em Dica de novo para ver o lance.') + '</p></div>'; }
    if (A.status !== 'play' && A.src) {
      const g = S.games.find(x => x.id === A.src.gid);
      if (A.src.slip) h += '<p style="font-size:14px">Na partida, a vantagem foi embora em <b>' + esc(moveNum(A.src.slip.ply) + fig(A.src.slip.san)) + '</b>: chance de ' + pct(A.src.slip.before) + ' para ' + pct(A.src.slip.after) + '.</p>';
      h += '<div class="vxacts"><button class="btn small" type="button" data-openply="' + g.id + ':' + ((A.src.slip ? A.src.slip.ply : A.src.ply) + 1) + '">Ver o lance na partida</button></div>';
    }
  }
  const acts = [];
  if (A.status === 'play' && A.kind !== 'clock') acts.push('<button class="btn small" type="button" data-ar="hint">Dica</button>');
  if (A.kind !== 'clock' && A.moves.some(x => x.color === A.user) && !A.thinking && (A.status === 'play' || A.canUndo)) acts.push('<button class="btn small" type="button" data-ar="undo">Desfazer</button>');
  if (A.kind === 'clock' && A.status === 'play') acts.push('<button class="btn small" type="button" data-ar="resign">Desistir</button>');
  acts.push('<button class="btn small" type="button" data-ar="restart">Recomeçar</button>');
  if (A.status !== 'play' && A.kind !== 'clock') acts.push('<button class="btn small primary" type="button" data-ar="next">Próxima posição</button>');
  if (A.status !== 'play' && A.kind === 'clock') acts.push('<button class="btn small primary" type="button" data-ar="lobby">Nova partida</button>');
  h += '<div class="vxacts">' + acts.join('') + '</div>';
  if (A.undos || A.hints) h += '<p class="muted" style="font-size:12.5px">' + (A.hints ? A.hints + ' dica' + (A.hints > 1 ? 's' : '') : '') + (A.hints && A.undos ? ' · ' : '') + (A.undos ? A.undos + ' lance' + (A.undos > 1 ? 's' : '') + ' desfeito' + (A.undos > 1 ? 's' : '') : '') + '. Para contar como feito, resolva sem dicas.</p>';
  $('#arPanel').innerHTML = '<div class="stack" style="gap:14px">' + h + '</div>';
}
function arAction(a) {
  const A = S.arena; if (!A) return;
  if (A.lobby || a === 'lobby' || a.startsWith('open:')) return arLobbyAction(a);
  if (A.kind === 'spot' && a !== 'restart') return spotAction(a);
  if (a === 'hint') return arHint();
  if (a === 'undo') return arUndo();
  if (a === 'resign' && A.kind === 'clock') return clockEnd(A, 'L', 'Você desistiu.');
  if (a === 'restart') { if (A.kind === 'clock') return startClock(A.su); if (A.kind === 'xray') return startXray(); if (A.kind === 'spot') return startSpot(); if (A.kind === 'mates') return startMate(MATES[A.sel]); if (A.lesson) return startLesson(A.lesson); const Ls = lists(), items = A.kind === 'convert' ? Ls.conv : A.kind === 'defend' ? Ls.def : Ls.ends; if (items[A.sel]) return startFromGame(A.kind, items[A.sel], A.sel); return; }
  if (a === 'next') {
    if (A.kind === 'mates') return startMate(MATES[(A.sel + 1) % MATES.length]);
    if (A.lesson) { const i = ENDS.indexOf(A.lesson); return startLesson(ENDS[(i + 1) % ENDS.length]); }
    const Ls = lists(), items = A.kind === 'convert' ? Ls.conv : A.kind === 'defend' ? Ls.def : Ls.ends;
    if (items.length) { const n = (A.sel + 1) % items.length; return startFromGame(A.kind, items[n], n); }
  }
  if (a === 'xcheck') return xrayCheck();
  if (A.kind === 'spot') return spotAction(a);
  if (a === 'xnext') return xrayNext();
}

/* ---------- treino de relógio ---------- */
const PACE = [[10, 20], [25, 60], [40, 85]];
function startClock(su) {
  const [b, inc] = su.tc.split('+').map(Number);
  arStart({ kind: 'clock', title: 'Relógio ' + (b / 60) + '+' + inc, sub: 'Você de ' + SIDE[su.color] + ' · motor ' + (store.get('arElo', 1600) || 'máximo'), su, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', user: su.color, elo: store.get('arElo', 1600), goal: 'play', spent: [],
    clock: { base: b, inc, label: (b / 60) + '+' + inc, t: { w: b * 1000, b: b * 1000 }, side: 'w', since: performance.now() } });
  const A = S.arena; ARTICK = setInterval(() => clockTick(A), 100);
}
function clockNow(A, side) { const C = A.clock; return C.t[side] - (A.status === 'play' && C.side === side ? performance.now() - C.since : 0); }
function clockTick(A) {
  if (S.arena !== A || A.status !== 'play') { if (S.arena !== A) clearInterval(ARTICK); return; }
  for (const s of ['w', 'b']) if (clockNow(A, s) <= 0) { A.clock.t[s] = 0; return clockEnd(A, s === A.user ? 'L' : 'W', s === A.user ? 'Seu tempo acabou.' : 'O tempo do motor acabou: você venceu.'); }
  arClocks();
  const pb = $('#paceNow'); if (pb) pb.outerHTML = paceHtml(A);
}
function clockMove(A, side) {
  const C = A.clock, el = performance.now() - C.since;
  if (C.side !== side) return true;
  C.t[side] -= el; if (C.t[side] <= 0) { C.t[side] = 0; clockEnd(A, side === A.user ? 'L' : 'W', side === A.user ? 'Seu tempo acabou.' : 'O tempo do motor acabou: você venceu.'); return false; }
  C.t[side] += C.inc * 1000; if (side === A.user) A.lastSpent = el / 1000;
  C.side = other(side); C.since = performance.now(); return true;
}
const fmtClock = ms => { ms = Math.max(0, ms); const s = ms / 1000; if (s < 10) return '0:0' + s.toFixed(1).replace('.', ','); return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
function arClocks() {
  const A = S.arena;
  if (!A || A.lobby || A.kind !== 'clock') { $('#arClkTop').innerHTML = ''; $('#arClkBot').innerHTML = ''; return; }
  const row = side => { const ms = clockNow(A, side), on = A.status === 'play' && A.clock.side === side; return '<div class="clk' + (on ? ' on' : '') + (ms < A.clock.base * 150 ? ' low' : '') + '"><span>' + (side === A.user ? 'Você' : 'Stockfish' + (A.elo ? ' ~' + A.elo : '')) + '</span><b class="mono">' + fmtClock(ms) + '</b></div>'; };
  $('#arClkTop').innerHTML = row(other(A.user)); $('#arClkBot').innerHTML = row(A.user);
}
function paceHtml(A) {
  const used = (1 - clockNow(A, A.user) / 1000 / A.clock.base) * 100, n = A.moves.filter(m => m.color === A.user).length;
  const tgt = PACE.find(p => n <= p[0]) || PACE[PACE.length - 1];
  const over = used > tgt[1];
  return '<div id="paceNow" class="stack" style="gap:6px"><span class="label">Ritmo</span><div class="pace"><i style="width:' + Math.max(0, Math.min(100, used)).toFixed(1) + '%"' + (over ? ' class="over"' : '') + '></i>' + PACE.map(p => '<em style="left:' + p[1] + '%"></em>').join('') + '</div><span class="muted" style="font-size:13px">Lance ' + n + ' · você usou <b style="color:var(--ink)">' + sp(Math.max(0, used)) + '%</b> do tempo · meta até o lance ' + tgt[0] + ': ' + tgt[1] + '%' + (over ? ' · <b style="color:var(--loss)">acima da meta</b>' : '') + '</span></div>';
}
function clockPanel(A) {
  let h = A.status === 'play' ? paceHtml(A) : '';
  if (A.review) h += A.review;
  return h;
}
function clockEnd(A, res, msg) {
  if (A.status !== 'play') return true;
  const C = A.clock; if (C.side && A.status === 'play') C.t[C.side] = Math.max(0, clockNow(A, C.side));
  A.status = res === 'W' ? 'won' : res === 'D' ? 'drawn' : 'lost'; A.res = res; A.msg = msg; A.thinking = false; stopArenaTimers();
  haptic(res === 'W' ? 'ok' : res === 'L' ? 'err' : 'move');
  if (!A.counted) { A.counted = true; act('clock'); }
  A.review = '<p class="muted">Conferindo seus lances com o motor…</p>';
  arDraw(false); clockReview(A); return true;
}
async function clockReview(A) {
  const evs = [];
  try {
    await Engine.init();
    for (let i = 0; i < A.fens.length; i++) { if (S.arena !== A) return; evs.push(await evalPos(A.fens[i], 120)); }
  } catch (e) { A.review = '<p class="muted">O motor não carregou para conferir os lances.</p>'; if (S.arena === A) arPanel(); return; }
  const base = A.clock.base, low = base * 0.15; let k = 0, errs = 0, errLow = 0; const accs = [], marks = [];
  for (let i = 0; i < A.moves.length; i++) {
    const m = A.moves[i]; if (m.color !== A.user) continue;
    const wb = sideWp(evs[i], A.user), wa = sideWp(evs[i + 1], A.user), loss = Math.max(0, wb - wa);
    accs.push(Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669)));
    const sp0 = A.spent[k] || { s: 0, left: base }; k++;
    if (loss >= 20) { errs++; const isLow = sp0.left < low; if (isLow) errLow++; marks.push(moveNum(i) + fig(m.san) + (isLow ? ' (com ' + Math.round(sp0.left) + ' s)' : '')); }
  }
  const usedAt = n => { const x = A.spent[n - 1]; return x ? (1 - x.left / base) * 100 : null; };
  const paceTxt = PACE.map(([n, t]) => { const u = usedAt(n); return u == null ? null : 'lance ' + n + ': ' + sp(u) + '% (meta ' + t + '%)' + (u > t ? ' ✕' : ' ✓'); }).filter(Boolean);
  const acc = avg(accs);
  A.review = '<div class="blk"><h3>Resumo</h3><p>Precisão estimada: <b>' + (acc == null ? '—' : sp(acc) + '%') + '</b> · erros graves: <b>' + errs + '</b>' + (errs ? ', ' + errLow + ' com menos de 15% do tempo' : '') + '.</p>' + (marks.length ? '<p class="muted" style="font-size:13.5px">Erros: ' + esc(marks.slice(0, 6).join(', ')) + '.</p>' : '') + (paceTxt.length ? '<p class="muted" style="font-size:13.5px">Ritmo: ' + esc(paceTxt.join(' · ')) + '.</p>' : '') + '</div>';
  const H = store.get('clockHist', []); H.unshift({ t: Date.now(), tc: A.clock.label, res: A.res, acc: acc == null ? null : Math.round(acc), errs, errLow, p10: usedAt(10), p25: usedAt(25), elo: A.elo }); store.set('clockHist', H.slice(0, 30));
  if (S.arena === A) arPanel();
}
function clockHistHtml() {
  const H = store.get('clockHist', []); if (!H.length) return '';
  return '<div class="stack" style="gap:6px"><span class="label">Suas últimas partidas de relógio</span><div class="tbl"><table><thead><tr><th>Quando</th><th>Ritmo</th><th>Res.</th><th>Precisão</th><th>Erros</th><th>Com pouco tempo</th><th>Tempo usado no lance 10</th></tr></thead><tbody>' +
    H.slice(0, 8).map(x => '<tr><td>' + new Date(x.t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') + '</td><td class="mono">' + esc(x.tc) + '</td><td>' + ({ W: 'V', D: 'E', L: 'D' }[x.res] || '—') + '</td><td class="mono">' + (x.acc == null ? '—' : x.acc + '%') + '</td><td class="mono">' + x.errs + '</td><td class="mono">' + x.errLow + '</td><td class="mono">' + (x.p10 == null ? '—' : sp(x.p10) + '%') + '</td></tr>').join('') + '</tbody></table></div></div>';
}

/* ---------- Raio-X da peça ---------- */
function looseOf(B) { const out = []; for (let i = 0; i < 64; i++) { const p = B[i]; if (!p || p.t === 'k' || p.t === 'p') continue; if (!attackers(B, i, p.c).length) out.push(i); } return out; }
function xrayPositions(n) {
  const gs = analyzedGames().length ? analyzedGames() : S.games; const out = [];
  if (!gs.length) return out;
  for (let k = 0; k < 600 && out.length < n; k++) {
    const g = gs[Math.floor(Math.random() * gs.length)]; const mv = g.mv.split(' '); if (mv.length < 28) continue;
    const P = prep(g); const ply = 14 + Math.floor(Math.random() * (Math.min(P.fens.length - 1, 80) - 14)); const fen = P.fens[ply]; if (!fen) continue;
    const B = parseBoard(fen), loose = looseOf(B); if (!loose.length || loose.length > 5) continue;
    out.push({ fen, loose, hang: loose.filter(i => attackers(B, i, other(B[i].c)).length) });
  }
  return out;
}
function startXray() {
  stopArenaTimers();
  const A = S.arena = { kind: 'xray', lobby: false, q: null, pos: xrayPositions(40), i: 0, sel: new Set(), ok: 0, miss: 0, end: Date.now() + 60000, over: false, reveal: false, title: 'Raio-X da peça', sub: 'Toque nas peças soltas e depois em Conferir' };
  arBoard(); AR.setLive(null); AR.setArrows([]); $('#arClkTop').innerHTML = ''; $('#arClkBot').innerHTML = '';
  if (!A.pos.length) { arHead(A.title, ''); $('#arPanel').innerHTML = '<p>Sincronize algumas partidas para gerar posições.</p>'; return; }
  xrayLoad(); ARTICK = setInterval(() => { if (S.arena !== A) { stopArenaTimers(); return; } if (Date.now() >= A.end) xrayOver(); else { const t = $('#xTimer'); if (t) t.textContent = Math.ceil((A.end - Date.now()) / 1000) + ' s'; } }, 250);
}
function xrayLoad() {
  const A = S.arena; A.q = A.pos[A.i % A.pos.length]; A.sel = new Set(); A.reveal = false;
  AR.setFlip(A.q.fen.split(' ')[1] === 'b'); AR.setPosition(A.q.fen, false); AR.setMarks({}); arHead(A.title, A.sub); xrayPanel();
}
function xrayTap(e) {
  const A = S.arena; if (!A || A.over || A.reveal || !A.q) return;
  const i = AR.sqAt(e); if (i == null) return; const p = parseBoard(A.q.fen)[i]; if (!p || p.t === 'k' || p.t === 'p') return;
  if (A.sel.has(i)) A.sel.delete(i); else A.sel.add(i);
  haptic('move'); AR.setMarks({ pick: Array.from(A.sel).map(iSq) }); xrayPanel();
}
function xrayCheck() {
  const A = S.arena; if (!A || A.over || A.reveal) return; A.reveal = true;
  const want = new Set(A.q.loose), ok = Array.from(A.sel).filter(i => want.has(i)), wrong = Array.from(A.sel).filter(i => !want.has(i)), missed = A.q.loose.filter(i => !A.sel.has(i));
  const right = !wrong.length && !missed.length; if (right) A.ok++; else A.miss++;
  A.last = { right, ok: ok.length, wrong: wrong.length, missed: missed.length };
  AR.setMarks({ okp: ok.filter(i => !A.q.hang.includes(i)).map(iSq), hangp: A.q.loose.filter(i => A.q.hang.includes(i)).map(iSq), wrongp: wrong.map(iSq), missp: missed.filter(i => !A.q.hang.includes(i)).map(iSq) });
  haptic(right ? 'ok' : 'err'); xrayPanel();
  if (right) setTimeout(() => { if (S.arena === A && A.reveal && !A.over) xrayNext(); }, 900);
}
function xrayNext() { const A = S.arena; if (!A || A.over) return; A.i++; xrayLoad(); }
function xrayOver() {
  const A = S.arena; if (!A || A.over) return; A.over = true; stopArenaTimers();
  const best = store.get('xbest', 0); if (A.ok > best) store.set('xbest', A.ok); cloudPrefsPush(); act('xray');
  A.final = { best, rec: A.ok > best }; xrayPanel();
}
function xrayPanel() {
  const A = S.arena; if (!A || !A.q) return; let h = '';
  if (A.over) {
    h += '<div class="fb ' + (A.final.rec ? 'ok' : 'hint') + '">Tempo esgotado: ' + A.ok + ' posiç' + (A.ok === 1 ? 'ão certa' : 'ões certas') + ' e ' + A.miss + ' com erro.' + (A.final.rec ? ' Novo recorde!' : ' Recorde: ' + A.final.best + '.') + '</div>';
    h += '<p style="font-size:14px">Leve isso para as suas partidas: antes de cada lance, olhe as peças soltas dos dois lados. Peça solta é alvo de garfo, de ataque duplo e de captura.</p><div class="vxacts"><button class="btn primary" type="button" data-ar="restart">Jogar de novo</button><button class="btn small" type="button" data-pz="punish">Treinar "Puna o erro"</button></div>';
  } else {
    h += '<div style="display:flex;justify-content:space-between;align-items:center"><b class="mono" id="xTimer" style="font-size:22px">' + Math.ceil((A.end - Date.now()) / 1000) + ' s</b><span class="mono muted">' + A.ok + ' certas · ' + A.miss + ' erradas</span></div>';
    h += '<p>Toque em todas as <b>peças soltas</b> (sem defensor), das duas cores. Peões e reis não contam.</p><p class="muted" style="font-size:13.5px">Selecionadas: ' + A.sel.size + '</p>';
    if (A.reveal) {
      const L2 = A.last; h += '<div class="fb ' + (L2.right ? 'ok' : 'no') + '">' + (L2.right ? 'Certo! ' : 'Quase. ') + A.q.loose.length + ' peça' + (A.q.loose.length > 1 ? 's soltas' : ' solta') + (A.q.hang.length ? ', ' + A.q.hang.length + ' delas atacada' + (A.q.hang.length > 1 ? 's' : '') + ' (em vermelho: pendurada' + (A.q.hang.length > 1 ? 's' : '') + ')' : '') + '.' + (L2.wrong ? ' ' + L2.wrong + ' marcada' + (L2.wrong > 1 ? 's' : '') + ' a mais.' : '') + (L2.missed ? ' Faltou marcar ' + L2.missed + '.' : '') + '</div>';
      if (!L2.right) h += '<div class="vxacts"><button class="btn primary" type="button" data-ar="xnext">Próxima</button></div>';
    } else h += '<div class="vxacts"><button class="btn primary" type="button" data-ar="xcheck">Conferir</button></div>';
  }
  $('#arPanel').innerHTML = '<div class="stack" style="gap:14px">' + h + '</div>';
}

/* ---------- Puna o erro: posições logo depois de um erro seu ---------- */
let PNQ = null, PNQK = '';
function punishQueue() {
  const k = acctKey() + ':' + analyzedGames().length; if (PNQ && PNQK === k) return PNQ;
  const out = []; PNQ = out; PNQK = k;
  for (const g of analyzedGames()) {
    const P = prep(g); if (!P.cls) continue;
    P.cls.forEach((c, i) => {
      if (P.moves[i].color !== g.c || (c.k !== 'blunder' && c.k !== 'mistake') || c.loss < 20) return;
      const ea = P.evs[i + 1]; if (!ea || !ea.best) return; const m = P.moves[i];
      out.push({ key: 'pn:' + g.id + ':' + i, gid: g.id, ply: i + 1, fen: P.fens[i + 1], side: other(g.c), best: ea.best, ev: ea, played: m.san, k: c.k, loss: c.loss, kind: 'punish', last: [m.from, m.to], opp: g.opp, end: g.end, mate: isMateFor(ea, other(g.c)) ? Math.abs(ea.mate) : 0 });
    });
  }
  return out.sort((a, b) => b.loss - a.loss);
}

/* ---------- Adivinhe o lance (revisão ativa na Análise) ---------- */
function guessList(P) {
  const g = P.g, mine = [];
  P.cls.forEach((c, i) => { if (P.moves[i].color !== g.c) return; const eb = P.evs[i]; if (!eb || !eb.best) return; if (c.loss >= 8) mine.push({ i, w: c.loss }); });
  mine.sort((a, b) => b.w - a.w); const pick = mine.slice(0, 4).map(x => x.i);
  P.cls.forEach((c, i) => {
    if (pick.length >= 6 || i === 0 || P.moves[i].color !== g.c || pick.includes(i)) return;
    const pc = P.cls[i - 1]; if ((pc.k === 'blunder' || pc.k === 'mistake') && (c.k === 'best' || c.k === 'brill' || c.k === 'great' || c.k === 'exc') && P.evs[i] && P.evs[i].best) pick.push(i);
  });
  return pick.sort((a, b) => a - b);
}
function startGuess() {
  const P = currentP(); if (!P || !P.cls) { toast('Analise a partida com o motor primeiro.'); return; }
  const list = guessList(P); if (!list.length) { toast('Esta partida não tem momentos decisivos seus para adivinhar.'); return; }
  S.vx = null; S.vxSetup = null; $('#vxBar').hidden = true;
  S.guess = { gid: P.g.id, list, idx: 0, pts: 0, res: [], phase: 'ask' };
  guessShow();
}
function guessCoach(h) { $('#coach').innerHTML = '<div class="stack fade" style="gap:14px"><div class="hd"><span class="label">Adivinhe o lance · ' + Math.min(S.guess.idx + 1, S.guess.list.length) + ' de ' + S.guess.list.length + '</span><span class="mono muted" style="margin-left:auto;font-size:13px">' + S.guess.pts + ' pts</span></div>' + h + '</div>'; }
function guessShow() {
  const G = S.guess, P = currentP(); if (!G || !P) return;
  if (G.idx >= G.list.length) return guessSummary();
  if (G.phase === 'reveal') return guessReveal();
  const i = G.list[G.idx]; G.phase = 'ask';
  S.flip = P.g.c === 'b'; AB.setFlip(S.flip); $('#evV').classList.toggle('flip', S.flip);
  AB.setPosition(P.fens[i], false);
  const pm = i > 0 ? P.moves[i - 1] : null; AB.setMarks(pm ? { last: [pm.from, pm.to] } : {}); AB.setArrows([]);
  updateEval(null, P.g.c);
  const cur = $('#gcur'); if (cur) cur.style.left = (i / Math.max(1, P.moves.length) * 100) + '%';
  $$('#moves .mv').forEach(b => b.setAttribute('aria-current', 'false'));
  const ctx = pm ? 'O adversário acabou de jogar ' + moveNum(i - 1) + fig(pm.san) + '.' : '';
  const pc = i > 0 ? P.cls[i - 1] : null;
  guessCoach('<p><b>Lance ' + (Math.floor(i / 2) + 1) + ' das ' + SIDE[P.g.c] + ': sua vez.</b> ' + esc(ctx) + (pc && BAD[pc.k] ? ' Será que dá para punir?' : '') + '</p><p class="muted">Pense como na partida: xeques, capturas e ameaças dos dois lados. Depois mova a peça.</p>' +
    '<p class="muted" style="font-size:13px">Pontos: 3 pelo lance do motor, 2 se quase tão bom, 1 se razoável.</p><div class="vxacts"><button class="btn small" type="button" data-guess="skip">Pular</button><button class="btn small" type="button" data-guess="exit">Sair</button></div>');
  guessArm();
}
function guessArm() {
  const G = S.guess, P = currentP(); if (!G || !P || G.phase !== 'ask') { if (AB) AB.setLive(null); return; }
  const fen = P.fens[G.list[G.idx]], c = new Chess(fen); const dests = {};
  for (const m of c.moves({ verbose: true })) { const a = dests[m.from] = dests[m.from] || []; if (!a.includes(m.to)) a.push(m.to); }
  AB.setLive({ color: c.turn(), dests, marks: AB.marks, onMove: (f, t) => guessMove(f, t) });
}
async function guessMove(from, to) {
  const G = S.guess, P = currentP(); if (!G || G.phase !== 'ask') return;
  const i = G.list[G.idx]; const c = new Chess(P.fens[i]); let m; try { m = c.move({ from, to, promotion: 'q' }); } catch (e) { guessArm(); return; }
  G.phase = 'wait'; AB.setLive(null); AB.setPosition(c.fen(), true); AB.setMarks({ last: [m.from, m.to] });
  const eb = P.evs[i], uci = m.from + m.to + (m.promotion || ''); let pts, loss = 0;
  if (uci === eb.best) pts = 3;
  else {
    guessCoach('<p class="muted">Conferindo ' + esc(fig(m.san)) + ' com o motor…</p>');
    try { await Engine.init(); const r = await evalPos(c.fen(), 700); loss = Math.max(0, sideWp(eb, P.g.c) - sideWp(r, P.g.c)); } catch (e) { loss = null; }
    pts = loss == null ? 0 : loss < 4 ? 2 : loss < 12 ? 1 : 0;
  }
  if (S.guess !== G) return;
  G.pts += pts; G.res.push({ i, san: m.san, uci, pts, loss, same: P.moves[i].san === m.san });
  haptic(pts >= 2 ? 'ok' : pts ? 'move' : 'err');
  G.phase = 'reveal'; guessReveal();
}
function guessReveal() {
  const G = S.guess, P = currentP(); const r = G.res[G.res.length - 1]; if (!r) { G.phase = 'ask'; return guessShow(); }
  const i = r.i, eb = P.evs[i], gm = P.moves[i], gc = P.cls[i], C = coachFor(P, i);
  const bl = lineSan(P.fens[i], eb.pv.length ? eb.pv : [eb.best]);
  AB.setPosition(P.fens[i], false);
  const arrows = [{ from: eb.best.slice(0, 2), to: eb.best.slice(2, 4), cls: 'a-best' }];
  if (gm.from + gm.to !== eb.best.slice(0, 4)) arrows.push({ from: gm.from, to: gm.to, cls: BAD[gc.k] ? 'a-bad' : 'a-next' });
  AB.setArrows(arrows); AB.setMarks({ ok: r.pts >= 2 ? r.uci.slice(2, 4) : null, bad: r.pts < 2 ? r.uci.slice(2, 4) : null, last: [r.uci.slice(0, 2), r.uci.slice(2, 4)] });
  updateEval(eb, P.g.c);
  const verdict = r.pts === 3 ? 'Exato: é o lance do motor. +3' : r.pts === 2 ? 'Muito bom: quase tão forte quanto o lance do motor. +2' : r.pts === 1 ? 'Razoável, mas havia algo melhor. +1' : 'Esse lance custa caro' + (r.loss != null ? ' (−' + Math.round(r.loss) + ' pontos de chance)' : '') + '. 0';
  let h = '<div class="fb ' + (r.pts >= 2 ? 'ok' : r.pts ? 'hint' : 'no') + '">Você jogou ' + esc(fig(r.san)) + '. ' + esc(verdict) + '</div>';
  h += '<div class="bestbox"><h3>Melhor: ' + esc(moveNum(i) + fig(bl[0] ? bl[0].san : eb.best)) + '</h3><p>' + esc((bl[0] ? (ideaShort(factsFor(P.fens[i], bl[0].m, i), bl[0].m) ? cap(ideaShort(factsFor(P.fens[i], bl[0].m, i), bl[0].m)) + '. ' : '') : '') + (bl.length > 1 ? 'Linha: ' + bl.slice(0, 5).map(x => fig(x.san)).join(' ') + '.' : '')) + '</p></div>';
  h += '<div class="blk"><h3' + (BAD[gc.k] ? ' class="bad"' : '') + '>Na partida: ' + esc(fig(gm.san)) + ' <span class="kb k-' + gc.k + '">' + esc(CLS[gc.k].s) + ' ' + CLS[gc.k].t + '</span></h3><p>' + esc((r.same ? 'Você repetiu o lance da partida. ' : '') + [C.verdict[0], C.punish[0]].filter(Boolean).join(' ')) + '</p></div>';
  h += '<div class="vxacts"><button class="btn primary small" type="button" data-guess="next">' + (G.idx + 1 < G.list.length ? 'Próximo momento' : 'Ver resultado') + '</button><button class="btn small" type="button" data-guess="open:' + (i + 1) + '">Ver na partida</button></div>';
  guessCoach(h);
}
function guessSummary() {
  const G = S.guess, P = currentP(); const max = G.list.length * 3, pc = G.pts / Math.max(1, max) * 100;
  const best = store.get('guess', {}); const prev = best[G.gid]; if (!prev || G.pts > prev) { best[G.gid] = G.pts; store.set('guess', best); }
  if (!G.counted) { G.counted = true; act('guess'); }
  AB.setLive(null); AB.setArrows([]);
  const nota = pc >= 80 ? 'Ótima leitura: você encontraria quase tudo.' : pc >= 50 ? 'Boa parte das ideias já está aí; o resto vira treino.' : 'Esses momentos são exatamente os seus pontos de treino.';
  guessCoach('<div class="fb ' + (pc >= 50 ? 'ok' : 'hint') + '">Você fez <b>' + G.pts + ' de ' + max + ' pontos</b> (' + sp(pc) + '%). ' + esc(nota) + '</div><div class="moments">' + G.res.map(r => '<button type="button" data-guess="open:' + (r.i + 1) + '"><span class="kb ' + (r.pts >= 2 ? 'k-best' : r.pts ? 'k-inacc' : 'k-blunder') + '">+' + r.pts + '</span><span class="mono">' + esc(moveNum(r.i) + fig(r.san)) + '</span><span class="muted" style="margin-left:auto;font-size:13px">motor: ' + esc(fig((lineSan(P.fens[r.i], [P.evs[r.i].best])[0] || {}).san || '')) + '</span></button>').join('') + '</div><div class="vxacts"><button class="btn small" type="button" data-guess="again">Repetir</button><button class="btn small" type="button" data-guess="exit">Voltar à análise</button><button class="btn small accent" type="button" data-card>Cartão da partida</button></div>');
}
function guessAction(a) {
  const G = S.guess; if (!G) return;
  if (a === 'exit') { S.guess = null; const P = currentP(); if (P) showPly(P, S.ply, false); return; }
  if (a === 'skip') { G.res.push({ i: G.list[G.idx], san: '—', uci: '', pts: 0, loss: null, same: false }); G.idx++; G.phase = 'ask'; return guessShow(); }
  if (a === 'next') { G.idx++; G.phase = 'ask'; return guessShow(); }
  if (a === 'again') { S.guess = null; return startGuess(); }
  if (a.startsWith('open:')) { S.guess = null; const n = +a.slice(5); const P = currentP(); S.ply = n; showPly(P, n, false); }
}

/* ---------- dossiê do adversário ---------- */
async function oppGames(opp) {
  const out = [], lo = opp.toLowerCase();
  const plays = pg => { const m = pg.match(/\[White "([^"]*)"\][\s\S]*?\[Black "([^"]*)"\]/) || pg.match(/\[Black "([^"]*)"\][\s\S]*?\[White "([^"]*)"\]/); return !!m && (m[1].toLowerCase() === lo || m[2].toLowerCase() === lo); };
  if (S.plat === 'chesscom') {
    const arch = await browserText('https://api.chess.com/pub/player/' + encodeURIComponent(opp.toLowerCase()) + '/games/archives', t => t.includes('"archives"') || /not found|"code"\s*:\s*0/i.test(t));
    const urls = Array.from(new Set(arch.match(/https:\/\/api\.chess\.com\/pub\/player\/[^"\s]+\/games\/\d{4}\/\d{2}/g) || [])).slice(-3).reverse();
    for (const u of urls) {
      if (out.length >= 300) break;
      try { const tx = await browserText(u, t => monthOk(t, u)); tx.replace(/"pgn":"((?:[^"\\]|\\.)*)"/g, (_, x) => { try { const pg = JSON.parse('"' + x + '"'); if (!plays(pg)) return ''; const g = pgnToGame(pg, opp); if (g) out.push(g); } catch (e) { /* trecho truncado */ } return ''; }); } catch (e) { /* segue com o que tiver */ }
    }
  } else {
    const tx = await browserText('https://lichess.org/api/games/user/' + encodeURIComponent(opp) + '?max=200&opening=true', t => t.includes('[Event') || t.trim().length < 400);
    for (const p of splitPgns(tx)) { if (!plays(p)) continue; const g = pgnToGame(p, opp); if (g) out.push(g); }
  }
  return out.sort((a, b) => b.end - a.end);
}
function dossierStats(opp, games) {
  const tally = (L, key) => { const o = {}; for (const g of L) { const k = key(g); if (!k) continue; const x = o[k] = o[k] || { k, n: 0, W: 0, D: 0, L: 0 }; x.n++; x[rk(g)]++; } return Object.values(o).sort((a, b) => b.n - a.n); };
  const w = games.filter(g => g.c === 'w'), b = games.filter(g => g.c === 'b');
  const losses = games.filter(g => rk(g) === 'L'), wins = games.filter(g => rk(g) === 'W');
  const lossHow = {}; for (const g of losses) lossHow[g.res] = (lossHow[g.res] || 0) + 1;
  const myW = repTree('w'), myB = repTree('b');
  const myFirst = Object.entries(myW.ch).sort((x, y) => y[1].n - x[1].n)[0];
  const vsMy = myFirst ? tally(b.filter(g => g.mv.split(' ')[0] === myFirst[0]), g => g.mv.split(' ')[1]) : [];
  const theirFirst = tally(w, g => g.mv.split(' ')[0]);
  const myReplyTo = m => { const n = myB.ch[m]; if (!n) return null; const r = Object.entries(n.ch).sort((x, y) => y[1].n - x[1].n)[0]; return r ? { m: r[0], n: r[1].n, s: nodeScore(r[1]) } : null; };
  const opN = g => opName(g).split(',')[0].replace(/\s+with\s.*$/i, '').trim();
  const opsW = tally(w, opN).filter(x => x.n >= 3), opsB = tally(b, opN).filter(x => x.n >= 3);
  const h2h = S.games.filter(g => g.opp.toLowerCase() === opp.toLowerCase());
  const tcs = tally(games, g => g.tc); const mainTc = tcs[0] ? tcs[0].k : null;
  const rNow = mainTc ? (games.find(g => g.tc === mainTc && g.mR) || {}).mR : null;
  const rOld = mainTc ? (games.slice().reverse().find(g => g.tc === mainTc && g.mR) || {}).mR : null;
  const shortL = losses.filter(g => g.mv.split(' ').length <= 50).length;
  const avgLen = avg(games.map(g => Math.ceil(g.mv.split(' ').length / 2)));
  return { opp, n: games.length, from: games.length ? games[games.length - 1].end : 0, to: games.length ? games[0].end : 0, score: scoreOf(games), sw: scoreOf(w), sb: scoreOf(b), nW: w.length, nB: b.length, losses: losses.length, wins: wins.length, lossHow, vsMy, myFirst: myFirst ? myFirst[0] : null, theirFirst: theirFirst.slice(0, 4).map(x => Object.assign(x, { mine: myReplyTo(x.k) })), opsW: opsW.slice(0, 5), opsB: opsB.slice(0, 5), h2h, mainTc, rNow, rOld, shortL, avgLen, recent: scoreOf(games.slice(0, 20)), tree: oppTree(games), t: Date.now() };
}
function dossierTips(D) {
  const t = [], s = x => (x.W + x.D / 2) / Math.max(1, x.n) * 100;
  const to = D.lossHow.timeout || 0;
  if (D.losses >= 8 && to / D.losses >= 0.25) t.push('Perde muito no relógio: ' + sp(to / D.losses * 100) + '% das derrotas dele são por tempo. Em posições equilibradas, jogue rápido e simples e deixe o relógio trabalhar.');
  if (D.losses >= 8 && D.shortL / D.losses >= 0.4) t.push('Muitas derrotas curtas (' + sp(D.shortL / D.losses * 100) + '% em até 25 lances): costuma errar cedo. Jogue ativo na abertura e procure táticas logo.');
  if (D.losses >= 8 && (D.lossHow.checkmated || 0) / D.losses >= 0.2) t.push('Leva mate com frequência (' + sp((D.lossHow.checkmated || 0) / D.losses * 100) + '% das derrotas): ataque o rei dele.');
  const weak = D.opsW.concat(D.opsB).filter(x => x.n >= 5).sort((a, b) => s(a) - s(b))[0];
  if (weak && s(weak) < 45) t.push('Ponto fraco: ' + weak.k + ' (' + weak.n + ' partidas, ' + sp(s(weak)) + '%).');
  const strong = D.opsW.concat(D.opsB).filter(x => x.n >= 5).sort((a, b) => s(b) - s(a))[0];
  if (strong && s(strong) > 60) t.push('Ponto forte: ' + strong.k + ' (' + strong.n + ' partidas, ' + sp(s(strong)) + '%). Se puder, evite.');
  if (D.vsMy[0] && D.myFirst && D.vsMy[0].n >= 3) t.push('Contra 1.' + fig(D.myFirst) + ', que você joga de brancas, ele costuma responder 1…' + fig(D.vsMy[0].k) + ' (' + D.vsMy[0].n + ' vezes, ' + sp(s(D.vsMy[0])) + '% para ele).');
  if (D.recent != null && D.score != null && D.recent < D.score - 10) t.push('Fase ruim: nas últimas 20 partidas fez só ' + sp(D.recent) + '%.');
  if (D.recent != null && D.score != null && D.recent > D.score + 10) t.push('Em boa fase: ' + sp(D.recent) + '% nas últimas 20 partidas.');
  if (!t.length) t.push('Nenhum padrão forte nas partidas recentes: jogue o seu jogo e confira xeques, capturas e ameaças a cada lance.');
  return t;
}
async function openDossier(opp) {
  if (!opp) return;
  const m = $('#dos'); m.hidden = false; $('#dosTitle').textContent = 'Dossiê de ' + opp; $('#dosBody').innerHTML = '<p class="muted">Lendo as partidas públicas de ' + esc(opp) + ' no ' + PLAT[S.plat] + '…</p>';
  const key = 'dos:' + S.plat + ':' + opp.toLowerCase();
  let D = await kv.get(key, null);
  if (!D || Date.now() - D.t > 6 * 3600 * 1000) {
    try { const gs = await oppGames(opp); if (!gs.length) throw { code: 'nogames' }; D = dossierStats(opp, gs); kv.set(key, D); }
    catch (e) {
      if ($('#dosTitle').textContent !== 'Dossiê de ' + opp) return;
      $('#dosBody').innerHTML = '<p>' + (e && e.code === 'no_mcp' ? 'O dossiê lê a API pública do ' + PLAT[S.plat] + ' e precisa do app para Windows/Android ou do app Claude para computador.' : 'Não consegui ler as partidas de ' + esc(opp) + ' agora.') + '</p>' + (D ? '<p class="muted">Mostrando a última versão salva.</p>' : '');
      if (!D) return;
    }
  }
  if ($('#dosTitle').textContent !== 'Dossiê de ' + opp) return;
  renderDossier(D);
}
function renderDossier(D) {
  const s = x => (x.W + x.D / 2) / Math.max(1, x.n) * 100;
  const row = (lab, x) => '<div class="hrow"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis">' + esc(lab) + '</span><span class="wdl"><i style="flex:' + x.W + '"></i><i style="flex:' + x.D + '"></i><i style="flex:' + x.L + '"></i></span><b class="mono">' + sp(s(x)) + '%</b><span class="mono muted">' + x.n + '</span></div>';
  const LH = D.lossHow, lh = [['resigned', 'desistência'], ['timeout', 'tempo'], ['checkmated', 'mate'], ['abandoned', 'abandono']].filter(([k]) => LH[k]).map(([k, n]) => n + ' ' + sp(LH[k] / Math.max(1, D.losses) * 100) + '%').join(' · ');
  const h2 = D.h2h.length ? (() => { const W = D.h2h.filter(g => rk(g) === 'W').length, Dd = D.h2h.filter(g => rk(g) === 'D').length; return 'Você ' + W + ' V · ' + Dd + ' E · ' + (D.h2h.length - W - Dd) + ' D contra ele.'; })() : 'Primeiro encontro registrado.';
  let h = '<p class="muted" style="font-size:13.5px">' + D.n + (D.n === 1 ? ' partida recente (' : ' partidas recentes (') + '' + dateLabel(D.from) + ' a ' + dateLabel(D.to) + ')' + (D.rNow ? ' · rating ' + (TC[D.mainTc] || '').toLowerCase() + ' ' + D.rNow + (D.rOld && D.rOld !== D.rNow ? ' (era ' + D.rOld + ')' : '') : '') + ' · ' + esc(h2) + '</p>';
  h += '<div class="lgstats"><div><b class="mono">' + sp(D.score) + '%</b><span>aproveitamento</span></div><div><b class="mono">' + sp(D.sw) + '%</b><span>de brancas</span></div><div><b class="mono">' + sp(D.sb) + '%</b><span>de pretas</span></div><div><b class="mono">' + sp(D.avgLen) + '</b><span>lances por partida</span></div></div>';
  h += '<div class="callout"><span class="label">Como jogar contra ele</span><ul class="facts">' + dossierTips(D).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
  if (D.theirFirst.length) h += '<div class="hgrp"><span class="label">De brancas ele abre com</span>' + D.theirFirst.map(x => row('1.' + fig(x.k) + (x.mine ? ' · você costuma responder ' + fig(x.mine.m) + ' (' + sp(x.mine.s) + '%)' : ''), x)).join('') + '</div>';
  if (D.vsMy.length) h += '<div class="hgrp"><span class="label">Contra 1.' + esc(fig(D.myFirst)) + ' (o seu primeiro lance de brancas)</span>' + D.vsMy.slice(0, 4).map(x => row('1…' + fig(x.k), x)).join('') + '</div>';
  if (D.opsW.length) h += '<div class="hgrp"><span class="label">Aberturas dele de brancas</span>' + D.opsW.map(x => row(x.k, x)).join('') + '</div>';
  if (D.opsB.length) h += '<div class="hgrp"><span class="label">Aberturas dele de pretas</span>' + D.opsB.map(x => row(x.k, x)).join('') + '</div>';
  if (lh) h += '<p style="font-size:14px">Como ele perde: ' + esc(lh) + '.</p>';
  if (D.tree) h += '<div id="dosTree">' + dosTreeHtml(D) + '</div>';
  h += '<p class="muted" style="font-size:12.5px">Aproveitamento do ponto de vista dele. Atualizado a cada 6 horas.</p>';
  $('#dosBody').innerHTML = h; S.dos = D; dosTreeBoard();
}

/* ---------- plano semanal ---------- */
const PLAN_T = {
  puz: { t: 'Exercícios dos seus erros', n: 10, go: 'data-pz="mine"' },
  xray: { t: 'Raio-X da peça (60 s)', n: 1, go: 'data-ar="open:xray"' },
  convert: { t: 'Converter vitórias', n: 2, go: 'data-ar="open:convert"' },
  defend: { t: 'Defenda a posição', n: 1, go: 'data-ar="open:defend"' },
  end: { t: 'Lição de finais', n: 1, go: 'data-ar="open:end"' },
  clock: { t: 'Partida de relógio', n: 1, go: 'data-ar="open:clock"' },
  guess: { t: 'Adivinhe o lance', n: 1, go: 'data-guess-last' },
  theory: { t: 'Posições de teoria', n: 5, go: 'data-pz="theory"' },
  punish: { t: 'Puna o erro', n: 5, go: 'data-pz="punish"' }
};
const DOW = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
function weekStart(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }
function planWeights() {
  const T = buildTraining(), Ls = lists(), C = clockStats(); const w = {}, why = {};
  let lost = 0, to = 0; for (const k in C.tc) { lost += C.tc[k].L; to += C.tc[k].T; }
  if (Ls.reached) { w.convert = Ls.conv.length / Ls.reached; why.convert = sp(w.convert * 100) + '% das partidas em que você esteve ganhando (85%+) não viraram vitória (' + Ls.conv.length + ' de ' + Ls.reached + ').'; }
  if (T.errs) {
    w.xray = T.tags.hang / T.errs; why.xray = sp(w.xray * 100) + '% dos seus erros graves deixaram material para o adversário ganhar.';
    w.punish = T.tags.tactic / T.errs * 0.8; why.punish = sp(T.tags.tactic / T.errs * 100) + '% dos seus erros graves deixaram passar uma tática.';
    w.end = T.phase.final / T.errs * 1.2; why.end = sp(T.phase.final / T.errs * 100) + '% dos seus erros graves aconteceram no final.';
  }
  if (lost) { w.clock = to / lost * 1.3; why.clock = sp(to / lost * 100) + '% das suas derrotas foram no tempo.'; }
  w.defend = 0.18; w.guess = 0.16;
  if (REPORT && REPORT.errors.length) { w.theory = 0.2; why.theory = REPORT.errors.length + ' posições de abertura em que você costuma errar.'; }
  return { w, why };
}
function weekPlan() {
  const ws = weekStart(new Date()), key = 'plan:' + dayKey(ws); const saved = store.get(key, null); if (saved && saved.v === 1) return saved;
  const { w, why } = planWeights(); const kinds = Object.keys(w).filter(k => w[k] > 0.02);
  const credit = {}; kinds.forEach(k => { credit[k] = 0; }); const tot = kinds.reduce((s, k) => s + w[k], 0) || 1;
  const days = [];
  for (let d = 0; d < 7; d++) {
    const tasks = ['puz']; const picks = d === 6 ? 1 : 2;
    for (let p = 0; p < picks; p++) {
      kinds.forEach(k => { credit[k] += w[k]; });
      const k = kinds.filter(x => !tasks.includes(x)).sort((a, b) => credit[b] - credit[a])[0];
      if (!k) break; credit[k] -= tot; tasks.push(k);
    }
    days.push(tasks);
  }
  const top = Object.keys(why).sort((a, b) => w[b] - w[a]).slice(0, 3).map(k => why[k]);
  const plan = { v: 1, start: ws.getTime(), days, why: top };
  store.set(key, plan); return plan;
}
const taskDone = (day, k) => k === 'puz' ? (store.get('daily', {})[dayKey(day)] || 0) : actOn(day, k);
function ring(f, size, on) { const r = size / 2 - 4, c = 2 * Math.PI * r; return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--surface-2)" stroke-width="4"></circle><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + (on ? 'var(--accent)' : 'var(--best)') + '" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + (Math.min(1, f) * c).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"></circle></svg>'; }
function renderPlan() {
  const p = weekPlan(), today = new Date(); today.setHours(0, 0, 0, 0); const ti = Math.round((today - p.start) / 86400000);
  const dayF = (d, tasks) => { const dt = new Date(p.start + d * 86400000); return avg(tasks.map(k => Math.min(1, taskDone(dt, k) / PLAN_T[k].n))) || 0; };
  let h = '<div class="week">' + p.days.map((tasks, d) => { const f = dayF(d, tasks); return '<div class="wday' + (d === ti ? ' on' : '') + (d < ti ? ' past' : '') + '">' + ring(f, 40, d === ti) + '<span>' + DOW[d] + '</span>' + (f >= 1 ? '<b class="ok">✓</b>' : '') + '</div>'; }).join('') + '</div>';
  const tasks = p.days[Math.max(0, Math.min(6, ti))] || [];
  h += '<div class="stack" style="gap:8px"><span class="label">Hoje</span>' + tasks.map(k => { const T = PLAN_T[k], n = taskDone(today, k), ok = n >= T.n; return '<div class="ptask' + (ok ? ' ok' : '') + '"><span class="pchk">' + (ok ? '✓' : '') + '</span><span style="min-width:0"><b>' + esc(T.t) + '</b><span class="muted mono" style="display:block;font-size:12.5px">' + Math.min(n, T.n) + ' de ' + T.n + '</span></span><button class="btn small' + (ok ? '' : ' primary') + '" type="button" ' + T.go + '>' + (ok ? 'De novo' : 'Começar') + '</button></div>'; }).join('') + '</div>';
  if (p.why.length) h += '<details class="lesson"><summary>Por que este plano</summary><div class="body"><ul>' + p.why.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul><p class="muted" style="font-size:13px">O plano é montado toda segunda-feira com as suas partidas mais recentes.</p></div></details>';
  const rh = store.get('remH', -1);
  h += '<div class="stack" style="gap:6px"><span class="label">Lembrete diário' + (NATIVE && NATIVE.platform === 'android' ? '' : NATIVE ? ' (com o app aberto)' : '') + '</span><div class="seg" role="group">' + [[-1, 'Desligado'], [8, '8h'], [12, '12h'], [19, '19h'], [21, '21h']].map(([v, t]) => '<button type="button" data-rem="' + v + '" aria-pressed="' + (rh === v) + '">' + t + '</button>').join('') + '</div></div>';
  return h;
}
async function setReminder(h) {
  store.set('remH', h); cloudPrefsPush();
  if (NATIVE && NATIVE.platform === 'android') {
    try {
      await capCall('LocalNotifications', 'requestPermissions');
      await capCall('LocalNotifications', 'cancel', { notifications: [{ id: 7001 }] }).catch(() => {});
      if (h >= 0) await capCall('LocalNotifications', 'schedule', { notifications: [{ id: 7001, title: 'Lance a Lance', body: 'Hora do treino: o seu plano de hoje leva uns 15 minutos.', schedule: { on: { hour: h, minute: 0 }, allowWhileIdle: true } }] });
      toast(h >= 0 ? 'Lembrete marcado para as ' + h + 'h' : 'Lembrete desligado');
    } catch (e) { toast('O lembrete precisa da versão 1.2 do aplicativo'); }
  } else if (h >= 0) {
    try { if (window.Notification && Notification.permission === 'default') await Notification.requestPermission(); } catch (e) { /* sem notificações */ }
    toast(NATIVE ? 'Lembrete às ' + h + 'h enquanto o app estiver aberto' : 'Lembrete às ' + h + 'h enquanto a página estiver aberta');
  } else toast('Lembrete desligado');
  if (S.view === 'treino') { const el = $('#trPlan'); if (el) el.innerHTML = renderPlan(); }
}
setInterval(() => {
  const h = store.get('remH', -1); if (h < 0 || (NATIVE && NATIVE.platform === 'android')) return;
  const now = new Date(); if (now.getHours() !== h) return; const k = dayKey(now); if (store.get('remSeen', '') === k) return;
  store.set('remSeen', k);
  try { if (window.Notification && Notification.permission === 'granted') new Notification('Lance a Lance', { body: 'Hora do treino: o seu plano de hoje leva uns 15 minutos.' }); else toast('Hora do treino: o plano de hoje está na aba Treino'); } catch (e) { toast('Hora do treino: o plano de hoje está na aba Treino'); }
}, 60000);

/* ---------- cartão da partida (imagem para salvar ou compartilhar) ---------- */
function pieceImg(code) {
  return new Promise(res => {
    const el = document.createElement('div'); el.className = 'pc ' + code; el.style.cssText = 'position:fixed;left:-200px;top:0;width:40px;height:40px';
    document.body.appendChild(el); const bg = getComputedStyle(el).backgroundImage; el.remove();
    const m = bg && bg.match(/url\("?(.*?)"?\)$/); if (!m) return res(null);
    const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = m[1];
  });
}
function cardMoment(P) {
  const g = P.g; let best = null, brill = null;
  P.cls.forEach((c, i) => { if (P.moves[i].color !== g.c) return; if (c.k === 'brill' && !brill) brill = i; if (BAD[c.k] && c.k !== 'inacc' && (best == null || c.loss > P.cls[best].loss)) best = i; });
  if (brill != null) return { i: brill, kind: 'brill' };
  if (best != null) return { i: best, kind: 'bad' };
  return { i: P.moves.length - 1, kind: 'end' };
}
async function makeCard(P) {
  const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const g = P.g, R = resultOf(g), cs = getComputedStyle(document.documentElement);
  const C = { bg1: '#0e1412', bg2: '#1a2722', ink: '#eef1ee', mut: '#98a59f', acc: '#d9a440', win: '#5cc596', loss: '#e86464', draw: '#a3aca8' };
  const gr = x.createLinearGradient(0, 0, W, H); gr.addColorStop(0, C.bg1); gr.addColorStop(1, C.bg2); x.fillStyle = gr; x.fillRect(0, 0, W, H);
  await (document.fonts && document.fonts.ready);
  const font = (w, s, mono) => (w + ' ' + s + 'px ' + (mono ? '"Geist Mono",ui-monospace,monospace' : '"Geist",system-ui,sans-serif'));
  x.fillStyle = C.acc; x.font = font(700, 26); x.fillText('LANCE A LANCE', 72, 96);
  x.fillStyle = C.mut; x.font = font(500, 26); x.textAlign = 'right'; x.fillText(tcLabel(g) + ' · ' + dateLabel(g.end, true), W - 72, 96); x.textAlign = 'left';
  const me = S.me + (g.mR ? ' (' + g.mR + ')' : ''), op = g.opp + (g.oR ? ' (' + g.oR + ')' : '');
  const fit = (t, w0, maxW) => { let s2 = w0; x.font = font(800, s2); while (x.measureText(t).width > maxW && s2 > 26) { s2 -= 2; x.font = font(800, s2); } };
  const wN = g.c === 'w' ? me : op, bN = g.c === 'w' ? op : me;
  x.fillStyle = C.ink; fit(wN, 50, W - 144); x.fillText(wN, 72, 172);
  x.fillStyle = C.mut; x.font = font(500, 32); x.fillText('vs', 72, 226); x.fillStyle = C.ink; fit(bN, 50, W - 192); x.fillText(bN, 120, 228);
  const rc = R.k === 'W' ? C.win : R.k === 'L' ? C.loss : C.draw; x.fillStyle = rc; x.font = font(700, 28); x.fillText(R.label.trim(), 72, 278);
  const mo = P.cls ? cardMoment(P) : { i: P.moves.length - 1, kind: 'end' };
  const fen = P.fens[mo.i + 1] || P.fens[P.fens.length - 1], B = parseBoard(fen), mm = P.moves[mo.i];
  const bs = 720, bx = (W - bs) / 2, by = 312, q = bs / 8, flip = g.c === 'b';
  const sl = cs.getPropertyValue('--sq-l').trim() || '#e8e3d2', sd = cs.getPropertyValue('--sq-d').trim() || '#6e8c88';
  x.save(); x.beginPath(); x.roundRect ? x.roundRect(bx, by, bs, bs, 18) : x.rect(bx, by, bs, bs); x.clip();
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { x.fillStyle = (r + f) % 2 === 0 ? sl : sd; x.fillRect(bx + f * q, by + r * q, q, q); }
  const at = i => { const f = i % 8, r = i >> 3; return flip ? [bx + (7 - f) * q, by + r * q] : [bx + f * q, by + (7 - r) * q]; };
  if (mm) { x.fillStyle = 'rgba(222,176,46,.45)'; for (const s of [mm.from, mm.to]) { const [px, py] = at(sqI(s)); x.fillRect(px, py, q, q); } }
  const imgs = {}; for (const p of B) if (p && !imgs[p.c + p.t]) imgs[p.c + p.t] = await pieceImg(p.c + p.t);
  B.forEach((p, i) => { if (!p) return; const im = imgs[p.c + p.t]; const [px, py] = at(i); if (im) x.drawImage(im, px, py, q, q); });
  x.restore();
  if (mm && P.cls) { const c = P.cls[mo.i], [px, py] = at(sqI(mm.to)), col = { brill: '#22b8c9', great: '#5b8fe0', best: '#5cc596', blunder: '#e86464', mistake: '#f0904a', miss: '#c58be0' }[c.k]; if (col) { x.fillStyle = col; x.beginPath(); x.arc(px + q - 8, py + 8, 26, 0, Math.PI * 2); x.fill(); x.fillStyle = '#0e1412'; x.font = font(800, 24); x.textAlign = 'center'; x.fillText(CLS[c.k].s, px + q - 8, py + 17); x.textAlign = 'left'; } }
  let y = by + bs + 66;
  if (P.acc) {
    const cnt = k => P.cls.filter((c, i) => P.moves[i].color === g.c && c.k === k).length;
    const stats = [[pct(P.acc[g.c]), 'sua precisão'], [pct(P.acc[other(g.c)]), 'adversário'], [String(cnt('brill') + cnt('great')), 'brilhantes e ótimos'], [String(cnt('blunder')), 'capivaradas']];
    stats.forEach(([v, l], k) => { const sx = 72 + k * 240; x.fillStyle = C.ink; x.font = font(700, 48, true); x.fillText(v, sx, y); x.fillStyle = C.mut; x.font = font(500, 22); x.fillText(l, sx, y + 34); });
    y += 96;
  }
  if (mm) {
    const lab = mo.kind === 'brill' ? 'Lance brilhante: ' : mo.kind === 'bad' ? 'Lance decisivo: ' : 'Posição final, depois de ';
    let t = lab + moveNum(mo.i) + fig(mm.san);
    if (mo.kind === 'bad' && P.evs) { const C2 = coachFor(P, mo.i); if (C2.best) t += ' · melhor era ' + fig(C2.best.san); }
    x.fillStyle = C.ink; x.font = font(600, 30); x.fillText(t.length > 60 ? t.slice(0, 59) + '…' : t, 72, y);
  }
  x.fillStyle = C.mut; x.font = font(500, 24); const on = opName(g); x.fillText(on.length > 70 ? on.slice(0, 69) + '…' : on, 72, H - 64);
  return new Promise(res => cv.toBlob(b => res(b), 'image/png'));
}
async function openCard() {
  const P = currentP(); if (!P) return;
  $('#card').hidden = false; $('#cardImg').innerHTML = '<p class="muted">Montando o cartão…</p>';
  try {
    const blob = await makeCard(P); const url = URL.createObjectURL(blob); S.cardBlob = blob; S.cardName = 'lance-a-lance-' + P.g.id + '.png';
    $('#cardImg').innerHTML = '<img src="' + url + '" alt="Cartão da partida vs ' + esc(P.g.opp) + '">';
  } catch (e) { $('#cardImg').innerHTML = '<p>Não consegui montar o cartão neste aparelho.</p>'; }
}
async function saveCard(share) {
  const blob = S.cardBlob, name = S.cardName; if (!blob) return;
  if (NATIVE && NATIVE.platform === 'android') {
    try {
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
      if (!share) { try { await capCall('Filesystem', 'writeFile', { path: 'Lance a Lance/' + name, data: b64, directory: 'DOCUMENTS', recursive: true }); toast('Imagem salva em Documentos/Lance a Lance'); return; } catch (e) { /* sem acesso a Documentos: usa o compartilhamento */ } }
      const w = await capCall('Filesystem', 'writeFile', { path: name, data: b64, directory: 'CACHE', recursive: true });
      await capCall('Share', 'share', { title: 'Minha partida no Lance a Lance', files: [w.uri] });
      return;
    } catch (e) { toast('Salvar e compartilhar precisam da versão 1.2 do aplicativo'); return; }
  }
  try { const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; if (dl) { await dl.save({ filename: name, data: blob }); toast('Imagem salva'); return; } } catch (e) { if (e && e.code === 'declined') return; }
  if (share && navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], name, { type: 'image/png' })] })) { try { await navigator.share({ files: [new File([blob], name, { type: 'image/png' })] }); return; } catch (e) { /* cancelado */ } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('Imagem salva');
}

/* ---------- perfil em radar ---------- */
function profileOf(games) {
  const z = () => ({ ph: { abertura: [0, 0], 'meio-jogo': [0, 0], final: [0, 0] }, conv: [0, 0], def: [0, 0], to: [0, 0] });
  const R = { me: z(), op: z(), n: 0 };
  for (const g of games) {
    const P = prep(g); if (!P.cls) continue; R.n++;
    P.cls.forEach((c, i) => { const s = P.moves[i].color === g.c ? R.me : R.op, ph = phaseOf(parseBoard(P.fens[i]), i); s.ph[ph][1]++; if (c.k === 'blunder' || c.k === 'mistake' || c.k === 'miss') s.ph[ph][0]++; });
    for (const [side, who] of [[g.c, 'me'], [other(g.c), 'op']]) {
      const wp = P.evs.map(e => sideWp(e, side)).slice(10); const res = rk(g) === 'D' ? 'D' : (rk(g) === 'W') === (side === g.c) ? 'W' : 'L';
      if (wp.some(v => v >= 85)) { R[who].conv[1]++; if (res === 'W') R[who].conv[0]++; }
      if (wp.some(v => v <= 15)) { R[who].def[1]++; if (res !== 'L') R[who].def[0]++; }
      if (res === 'L') { R[who].to[1]++; if ((side === g.c ? g.res : g.oRes) === 'timeout') R[who].to[0]++; }
    }
  }
  const rate = a => a[1] ? a[0] / a[1] : null;
  // escala logarítmica: o dobro de erros que os adversários = 25; a metade = 75
  const sc = r => Math.max(5, Math.min(95, 50 + 25 * Math.log2(r)));
  const lower = (m, o) => m == null || o == null || o <= 0 ? 50 : sc(o / Math.max(m, 1e-6));
  const higher = (m, o) => m == null || o == null || o <= 0 ? 50 : sc(Math.max(m, 1e-6) / o);
  return {
    n: R.n, raw: R,
    ax: [
      { k: 'tactic', t: 'Tática', v: lower(rate(R.me.ph['meio-jogo']), rate(R.op.ph['meio-jogo'])), go: 'data-pz="punish"' },
      { k: 'opening', t: 'Abertura', v: lower(rate(R.me.ph.abertura), rate(R.op.ph.abertura)), go: 'data-pz="theory"' },
      { k: 'end', t: 'Finais', v: lower(rate(R.me.ph.final), rate(R.op.ph.final)), go: 'data-ar="open:end"' },
      { k: 'clock', t: 'Relógio', v: lower(rate(R.me.to), rate(R.op.to)), go: 'data-ar="open:clock"' },
      { k: 'convert', t: 'Conversão', v: higher(rate(R.me.conv), rate(R.op.conv)), go: 'data-ar="open:convert"' },
      { k: 'defend', t: 'Defesa', v: higher(rate(R.me.def), rate(R.op.def)), go: 'data-ar="open:defend"' }
    ]
  };
}
let RADAR = null, RADARKEY = '';
function radarCard() {
  const key = LISTKEY + ':' + analyzedGames().length; const gs = analyzedGames().slice().sort((a, b) => b.end - a.end);
  if (gs.length < 20) return '<h2 class="h-card">Seu perfil</h2><p class="muted">Analise pelo menos 20 partidas para montar o radar.</p>';
  if (!RADAR || RADARKEY !== key) { const half = Math.min(60, Math.floor(gs.length / 2)); RADAR = { now: profileOf(gs.slice(0, half)), before: profileOf(gs.slice(half, half * 2)), half }; RADARKEY = key; }
  const { now, before, half } = RADAR, n = now.ax.length, cx = 150, cy = 140, R0 = 100;
  const pt = (k, v) => { const a = -Math.PI / 2 + k * 2 * Math.PI / n, r = v / 100 * R0; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
  const poly = ax => ax.map((a, k) => pt(k, a.v).map(z => z.toFixed(1)).join(',')).join(' ');
  let svg = '<svg viewBox="0 0 300 290" class="radar" role="img" aria-label="Perfil: ' + now.ax.map(a => a.t + ' ' + Math.round(a.v)).join(', ') + '">';
  for (const lv of [25, 50, 75, 100]) svg += '<polygon points="' + now.ax.map((a, k) => pt(k, lv).join(',')).join(' ') + '" fill="none" stroke="var(--line)" stroke-width="' + (lv === 50 ? 1.6 : 1) + '"' + (lv === 50 ? ' stroke-dasharray="3 3"' : '') + '></polygon>';
  now.ax.forEach((a, k) => { const [x2, y2] = pt(k, 100); svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="var(--line)"></line>'; const [lx, ly] = pt(k, 124); svg += '<text x="' + lx.toFixed(1) + '" y="' + (ly + 4).toFixed(1) + '" text-anchor="middle" class="rl">' + a.t + '</text>'; });
  if (before.n >= 10) svg += '<polygon points="' + poly(before.ax) + '" fill="none" stroke="var(--muted)" stroke-width="1.6" stroke-dasharray="4 3"></polygon>';
  svg += '<polygon points="' + poly(now.ax) + '" fill="color-mix(in srgb,var(--accent) 22%,transparent)" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round"></polygon>';
  now.ax.forEach((a, k) => { const [x2, y2] = pt(k, a.v); svg += '<circle cx="' + x2.toFixed(1) + '" cy="' + y2.toFixed(1) + '" r="3.5" fill="var(--accent)"></circle>'; });
  svg += '</svg>';
  const weakest = now.ax.slice().sort((a, b) => a.v - b.v)[0];
  const rows = now.ax.map((a, k) => { const b = before.n >= 10 ? before.ax[k].v : null, d = b == null ? null : a.v - b; return '<div class="hrow"><span>' + a.t + '</span><span class="hbar"><i style="width:' + a.v + '%"></i><em style="left:50%"></em></span><b class="mono">' + Math.round(a.v) + '</b><span class="mono ' + (d == null ? 'muted' : d >= 0 ? 'up' : 'down') + '">' + (d == null ? '' : (d >= 0 ? '+' : '−') + Math.abs(Math.round(d))) + '</span></div>'; }).join('');
  return '<div class="stack" style="gap:2px"><h2 class="h-card">Seu perfil</h2><p class="sub">50 = igual aos adversários do seu nível. Linha cheia: suas ' + half + ' partidas analisadas mais recentes; tracejada: as ' + half + ' anteriores.</p></div><div class="radarbox">' + svg + '<div class="hgrp" style="min-width:0">' + rows + '</div></div>' +
    '<div class="vxacts"><span style="font-size:14px">Ponto mais fraco agora: <b>' + weakest.t + '</b>.</span><button class="btn small accent" type="button" ' + weakest.go + '>Treinar ' + weakest.t.toLowerCase() + '</button></div>';
}

/* ---------- treino: blocos da aba ---------- */
function hubHtml() {
  const Ls = lists(), pn = punishQueue().length, d = done();
  const endsOk = ENDS.filter(e => d['end:' + e.id] && d['end:' + e.id].ok).length;
  const tile = (go, t, big, sub) => '<button class="tile" type="button" ' + go + '><span class="label">' + t + '</span><b class="mono">' + big + '</b><span class="muted">' + sub + '</span></button>';
  return tile('data-ar="open:convert"', 'Converter a vitória', Ls.conv.length, 'partidas ganhas que escaparam') +
    tile('data-ar="open:defend"', 'Defenda a posição', Ls.def.length, 'posições perdidas para salvar') +
    tile('data-ar="open:xray"', 'Raio-X da peça', store.get('xbest', 0), 'recorde em 60 s') +
    tile('data-pz="punish"', 'Puna o erro', pn, 'posições logo depois de um erro seu') +
    tile('data-ar="open:end"', 'Curso de finais', endsOk + '/' + ENDS.length, 'lições · ' + Ls.ends.length + ' finais seus') +
    tile('data-ar="open:clock"', 'Treino de relógio', store.get('clockHist', []).length, 'partidas com relógio') +
    tile('data-guess-last', 'Adivinhe o lance', Object.keys(store.get('guess', {})).length, 'partidas revisadas') +
    tile('data-ar="open:spot"', 'Ache o erro', 5, 'trechos por rodada') +
    tile('data-ar="open:mates"', 'Padrões de mate', MATES.filter(p => d['mates:' + p.id] && d['mates:' + p.id].ok).length + '/' + MATES.length, 'padrões resolvidos') +
    (Object.keys(CRIT).length ? tile('data-pz="crit"', 'Lance único', critQueue().length, 'momentos críticos seus') : tile('data-crit-bulk', 'Lance único', '—', 'calcular nas últimas 30 partidas'));
}

/* ---------- modo foco ---------- */
function toggleFocus(on) {
  const root = document.documentElement; const v = on == null ? !root.classList.contains('focus') : on;
  root.classList.toggle('focus', v);
  try { if (v && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); if (!v && document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) { /* sem tela cheia */ }
  setTimeout(movePill, 50);
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.documentElement.classList.contains('focus')) document.documentElement.classList.remove('focus'); });
