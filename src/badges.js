/* ---------- Conquistas: insígnias em cinco níveis, raridades e prestígio ----------
   Tudo é calculado a partir dos dados do app (partidas, treinos, revisões), então
   as insígnias aparecem iguais em todos os aparelhos depois da sincronização. */

const TIERS = [
  { n: 'Bronze', m: 'bronze', xp: 10 }, { n: 'Prata', m: 'silver', xp: 25 }, { n: 'Ouro', m: 'gold', xp: 50 },
  { n: 'Platina', m: 'plat', xp: 100 }, { n: 'Diamante', m: 'diam', xp: 200 }
];
const RARE_XP = 120, ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const pl = (n, a, b) => n === 1 ? a : b;
// formato e esmalte de cada categoria
const BCATS = [
  { id: 'treino', n: 'Treino', d: 'Modos de treino do app', shape: 'hex' },
  { id: 'partidas', n: 'Nas suas partidas', d: 'O que você faz no tabuleiro de verdade', shape: 'shield' },
  { id: 'habito', n: 'Hábito', d: 'Constância é o que faz o rating subir', shape: 'round' },
  { id: 'raras', n: 'Raridades', d: 'Momentos raros do xadrez. Cada uma tem um nível só', shape: 'oct' }
];

/* ícones: traço em grade de 24; as peças são silhuetas cheias */
const PIECE = {
  pawn: 'M12 3.2a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM9.3 9.9h5.4a.9.9 0 0 1 0 1.8H9.3a.9.9 0 0 1 0-1.8zM10.3 12.4h3.4c.2 2.6 1.4 4.3 3 5.5H7.3c1.6-1.2 2.8-2.9 3-5.5zM6.4 18.7h11.2c.6 0 1 .4 1 1v.6c0 .6-.4 1-1 1H6.4c-.6 0-1-.4-1-1v-.6c0-.6.4-1 1-1z',
  knight: 'M7.2 21.3h11.1v-1.6c0-.8-.3-1.5-.9-2 .6-3.6-.3-7.3-2.6-9.8-1.3-1.4-2.9-2.3-4.6-2.6l-.5 1.6c-1 .4-1.9 1.1-2.5 2L5.3 11.4c-.3.5-.2 1.1.3 1.4l.9.6c.5.3 1.1.3 1.5-.1l1.5-1.3c.7 0 1.3-.2 1.8-.6-.4 2.3-1.8 4-3.1 5.4-.7.7-1 1.6-1 2.6zM10.4 8.6a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6z',
  bishop: 'M12 2.6a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zM12 6.4c2.8 1.8 4.1 4 4.1 6.2 0 1.9-1.1 3.2-2.5 3.8l.4 1.5h-4l.4-1.5c-1.4-.6-2.5-1.9-2.5-3.8 0-2.2 1.3-4.4 4.1-6.2zM6.5 18.7h11c.6 0 1 .4 1 1v.6c0 .6-.4 1-1 1h-11c-.6 0-1-.4-1-1v-.6c0-.6.4-1 1-1z',
  rook: 'M6.3 3.6h2.4v2.1h1.9V3.6h2.8v2.1h1.9V3.6h2.4v4.6l-1.7 1.4v6.3l1.7 1.7v.8H6.3v-.8L8 15.9V9.6L6.3 8.2zM5.6 18.8h12.8c.6 0 1 .4 1 1v.5c0 .6-.4 1-1 1H5.6c-.6 0-1-.4-1-1v-.5c0-.6.4-1 1-1z',
  queen: 'M4.3 7.2a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zM8.4 4.8a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zM12 3.8a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zM15.6 4.8a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zM19.7 7.2a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zM4.9 10.4l3.9 2.6.2-4.6 3 4.2 3-4.2.2 4.6 3.9-2.6-2.2 6.6H7.1zM6.6 17.9h10.8l.4 1H6.2zM5.6 19.4h12.8c.6 0 1 .3 1 .8s-.4.9-1 .9H5.6c-.6 0-1-.4-1-.9s.4-.8 1-.8z',
  king: 'M11.1 2h1.8v1.9h1.9v1.8h-1.9v1.9h-1.8V5.7H9.2V3.9h1.9zM12 8.3c3.6 0 6.2 1.7 6.2 4.1 0 1.6-1 2.9-2.3 3.9l.5 1.5H7.6l.5-1.5c-1.3-1-2.3-2.3-2.3-3.9 0-2.4 2.6-4.1 6.2-4.1zM6.5 18.7h11c.6 0 1 .4 1 1v.6c0 .6-.4 1-1 1h-11c-.6 0-1-.4-1-1v-.6c0-.6.4-1 1-1z'
};
// peça em miniatura dentro de um símbolo: mesma silhueta das peças, com traço de espessura fixa
const mini = (p, x, y, k, cls) => '<path' + (cls ? ' class="' + cls + '"' : '') + ' d="' + PIECE[p] + '" transform="translate(' + x + ' ' + y + ') scale(' + k + ')" vector-effect="non-scaling-stroke"/>';
const ICONS = {
  alerta: { f: '<path d="M12 3.2 21.4 19.6H2.6z"/>', s: '<path d="M12 3.2 21.4 19.6H2.6z"/><path d="M12 9.2v5"/><circle cx="12" cy="16.9" r="1" fill="currentColor"/>' },
  memoria: { f: '<rect x="4" y="4" width="16" height="16" rx="2.5"/>', s: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4 12h16M12 4v16" stroke-opacity=".45"/><rect x="12" y="4" width="8" height="8" fill="currentColor" stroke="none" opacity=".35"/><rect x="4" y="12" width="8" height="8" fill="currentColor" stroke="none" opacity=".35"/><path d="M7.5 7.5h.01M16.5 16.5h.01" stroke-width="2.6"/>' },
  estante: { f: '<path d="M4.5 4h3.6v16H4.5zM9.6 4h3.6v16H9.6z"/>', s: '<path d="M4.5 4h3.6v16H4.5zM9.6 4h3.6v16H9.6zM14.6 5.4l3.4-.9 3.4 14.6-3.4.9z"/><path d="M4.5 7.5h3.6M9.6 7.5h3.6M4.5 16.5h3.6M9.6 16.5h3.6"/><path d="M3 20.5h18"/>' },
  // f: mancha de cor translúcida (o corpo); s: linha de tinta (a leitura)
  alvo: { f: '<circle cx="11" cy="13" r="8"/>', s: '<circle cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="4.6"/><circle cx="11" cy="13" r="1.4" fill="currentColor"/><path d="M11 13 20 4M16.6 3.6 20.4 3.6 20.4 7.4"/>' },
  raio: { f: '<path d="M13.5 2.5 5 13.5h6.5l-1 8 8.5-11.5h-6.5z"/>', s: '<path d="M13.5 2.5 5 13.5h6.5l-1 8 8.5-11.5h-6.5z"/><path d="M3.2 5.5 4.8 7M20.8 18.5 19.2 17M2.8 18h1.8"/>' },
  garfo: { f: '<circle cx="5.5" cy="7" r="2.6"/><circle cx="12" cy="4.6" r="2.6"/><circle cx="18.5" cy="7" r="2.6"/>', s: '<path d="M12 21v-6.5M12 14.5 6.6 8.9M12 14.5V7.2M12 14.5l5.4-5.6"/><circle cx="5.5" cy="7" r="2.6"/><circle cx="12" cy="4.6" r="2.6"/><circle cx="18.5" cy="7" r="2.6"/><circle cx="12" cy="14.5" r="1.1" fill="currentColor"/>' },
  olho: { f: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/>', s: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3.4"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><path d="M13.6 10.6l.9-.9"/>' },
  oposicao: { f: '<rect x="3" y="15" width="18" height="5.5" rx="1"/>', s: '<path d="M3 15h18M3 20.5h18M9 15v5.5M15 15v5.5"/><path d="M6 4v3.2M4.6 5.4h2.8M18 4v3.2M16.6 5.4h2.8"/><path d="M6 8c1.9 0 3 1 3 2.4 0 1-.6 1.7-1.3 2.2l.3 1.4H4l.3-1.4C3.6 12.1 3 11.4 3 10.4 3 9 4.1 8 6 8zM18 8c1.9 0 3 1 3 2.4 0 1-.6 1.7-1.3 2.2l.3 1.4h-4l.3-1.4c-.7-.5-1.3-1.2-1.3-2.2 0-1.4 1.1-2.4 3-2.4z"/>' },
  grade: { f: '<path d="M9.2 9h6.8l-.8 6H8.4z"/>', s: '<path d="M10 3.5 7.6 20.5M17 3.5l-2.4 17M4 9h16.5M3.5 15H20"/>' },
  livro: { f: '<path d="M12 6.5C9.5 5 6.5 4.5 3.5 5v13c3-.5 6 0 8.5 1.5zM12 6.5c2.5-1.5 5.5-2 8.5-1.5v13c-3-.5-6 0-8.5 1.5z"/>', s: '<path d="M12 6.5C9.5 5 6.5 4.5 3.5 5v13c3-.5 6 0 8.5 1.5 2.5-1.5 5.5-2 8.5-1.5V5c-3-.5-6 0-8.5 1.5zM12 6.5v13"/><path d="M6 8.6c1.3-.1 2.6.1 3.6.6M6 11.6c1.3-.1 2.6.1 3.6.6M14.4 9.2c1-.5 2.3-.7 3.6-.6M14.4 12.2c1-.5 2.3-.7 3.6-.6"/>' },
  bandeira: { f: '<path d="M6 4h3.3v2.7H6zM12.6 4h3.3v2.7h-3.3zM9.3 6.7h3.3v2.6H9.3zM15.9 6.7h3.3v2.6h-3.3zM6 9.3h3.3V12H6zM12.6 9.3h3.3V12h-3.3z"/>', s: '<path d="M6 21.5V3.5"/><path d="M6 4h13.2v8H6"/>' },
  scan: { f: '<path d="M12 7.2a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM10.6 12.2h2.8c.1 1.6.8 2.6 1.8 3.3H8.8c1-.7 1.7-1.7 1.8-3.3zM8.2 16.2h7.6v1.6H8.2z"/>', s: '<path d="M3.5 8.5V3.5h5M15.5 3.5h5v5M20.5 15.5v5h-5M8.5 20.5h-5v-5"/><path d="M3 12h3M18 12h3" opacity=".7"/>' },
  relogio: { f: '<rect x="2.5" y="9" width="19" height="11" rx="2"/>', s: '<rect x="2.5" y="9" width="19" height="11" rx="2"/><circle cx="8" cy="14.5" r="3.2"/><circle cx="16" cy="14.5" r="3.2"/><path d="M8 14.5V12.6M16 14.5l1.4-1.2M5.5 9V6.8h4V9M14.5 9V7.8h4V9"/>' },
  martelo: { f: '<path d="m13.2 3.2 7.6 7.6-3 3-7.6-7.6z"/>', s: '<path d="m13.2 3.2 7.6 7.6-3 3-7.6-7.6z"/><path d="M11.8 9.2 3.8 17.2l3 3 8-8M3 21.5h8"/>' },
  onda: { f: '<circle cx="12" cy="12" r="3.4"/>', s: '<circle cx="12" cy="12" r="1.6" fill="currentColor"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.2 5.2a9.6 9.6 0 0 0 0 13.6M18.8 5.2a9.6 9.6 0 0 1 0 13.6"/>' },
  detetive: { f: '<circle cx="10.5" cy="10.5" r="6.5"/>', s: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5.5 5.5"/><path d="M8.7 8.7a1.8 1.8 0 1 1 2.6 1.6c-.6.3-.8.7-.8 1.3"/><circle cx="10.5" cy="13.8" r=".6" fill="currentColor"/>' },
  ciclo: { f: '<circle cx="12" cy="12" r="4.2"/>', s: '<path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18.5 2.5v4.2h-4.2M5.5 21.5v-4.2h4.2"/><path d="M12 9.8v2.4l1.6 1"/>' },
  chapeu: { f: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/>', s: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.5c1.5 1.5 3.5 2.2 5.5 2.2s4-.7 5.5-2.2V11M21.5 9v5.5"/><circle cx="21.5" cy="15.5" r="1" fill="currentColor"/>' },
  estrela: { f: '<path d="m11 4 2.5 5.1 5.6.8-4 4 .9 5.5-5-2.6-5 2.6.9-5.5-4-4 5.6-.8z"/>', s: '<path d="m11 4 2.5 5.1 5.6.8-4 4 .9 5.5-5-2.6-5 2.6.9-5.5-4-4 5.6-.8z"/><path d="M19.5 2.5v3M18 4h3M20.5 15.5v2M19.5 16.5h2"/>' },
  mira: { f: '<circle cx="12" cy="12" r="7"/>', s: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.6"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/>' },
  escudook: { f: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9.2C7.5 20 4 17 4 12V6z"/>', s: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9.2C7.5 20 4 17 4 12V6z"/><path d="m8.5 12 2.5 2.5 4.5-4.5"/>' },
  subida: { f: '<path d="M3 20.5V17.5l6-6 4 4 8-8.5v13.5z"/>', s: '<path d="M3 17.5 9 11.5l4 4 8-8.5M15 7h6v6M3 20.5h18"/>' },
  montanha: { f: '<path d="M2.5 20.5 9.5 8.5l4 6.2 2.5-4 5.5 9.8z"/>', s: '<path d="M2.5 20.5 9.5 8.5l4 6.2 2.5-4 5.5 9.8z"/><path d="M9.5 8.5V3.5l3 1.2-3 1.2"/><circle cx="4.5" cy="6" r="1.4" fill="currentColor"/>' },
  ampulheta: { f: '<path d="M8.6 6h6.8c-.6 2-3.4 3.4-3.4 5.2C12 9.4 9.2 8 8.6 6zM12 15.5c1.8 0 4 1.6 4 4.5H8c0-2.9 2.2-4.5 4-4.5z"/>', s: '<path d="M6.5 3h11M6.5 21h11M8 3c0 5 8 6 8 9s-8 4-8 9M16 3c0 5-8 6-8 9s8 4 8 9"/>' },
  trofeu: { f: '<path d="M8 3.5h8v6a4 4 0 0 1-8 0z"/>', s: '<path d="M8 3.5h8v6a4 4 0 0 1-8 0zM8 5.5H5a3 3 0 0 0 3 4.3M16 5.5h3a3 3 0 0 1-3 4.3M12 13.5v4M8.5 21h7M9.5 17.5h5"/><path d="M12 5.8v3.4" opacity=".7"/>' },
  colecao: { f: '<path d="m12 3.5 8.5 4.8L12 13 3.5 8.3z"/>', s: '<path d="m12 3.5 8.5 4.8L12 13 3.5 8.3z"/><path d="m3.5 12.4 8.5 4.8 8.5-4.8M3.5 16.4l8.5 4.8 8.5-4.8"/>' },
  promo: { f: '<path d="m5 9 2.3-4.8 4.7 3.5 4.7-3.5L19 9z"/>' + mini('pawn', 8.4, 12.4, .3), s: '<path d="m5 9 2.3-4.8 4.7 3.5 4.7-3.5L19 9z"/><path d="M5.5 11.2h13"/>' + mini('pawn', 8.4, 12.4, .3) },
  biblioteca: { f: '<path d="M4 20V5h3v15zM9 20V4h3v16z"/>', s: '<path d="M4 20V5h3v15M9 20V4h3v16M14.5 20.5l-1-15 3-.4 1.6 15z"/><path d="M3 20.5h18M4 8h3M9 7h3M4 16.5h3M9 17h3"/>' },
  lua: { f: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', s: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/><path d="M16 3.5v3M14.5 5h3M20.5 8v2M19.5 9h2"/>' },
  chama: { f: '<path d="M12 9.5c.4 2 3 3.2 3 6.2a3 3 0 0 1-6 0c0-1.4.6-2.3 1.3-2.9.1 1.2.7 1.9 1.3 1.9 0-1.9-.8-3.1.4-5.2z"/>', s: '<path d="M12 3c.6 3.2 5 5.2 5 10.2a5 5 0 0 1-10 0c0-2.3 1.1-3.8 2.2-4.8.2 2 1.1 3.1 2.2 3.1 0-3.2-1.4-5.2.6-8.5z"/>' },
  lupa: { f: '<circle cx="10.5" cy="10.5" r="6.5"/>', s: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5.5 5.5M7.8 12.8v-1.6M10.5 12.8V8.2M13.2 12.8v-3"/>' },
  calendario: { f: '<path d="M5.5 5h13a2 2 0 0 1 2 2v3h-17V7a2 2 0 0 1 2-2z"/>', s: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="m9 15 2 2 4-4"/>' },
  meta: { f: '<circle cx="12" cy="12" r="8.5"/>', s: '<circle cx="12" cy="12" r="8.5"/><path d="m8 12.3 2.7 2.7 5.6-5.7"/>' },
  ep: { f: mini('pawn', 2.5, 9, .42) + mini('pawn', 12.5, 9, .42), s: mini('pawn', 2.5, 9, .42) + mini('pawn', 12.5, 9, .42) + '<path d="M8 7.5 15 2.8M11.6 2.8H15v3.4"/>' },
  onda2: { f: '<path d="M2.5 14.5c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 1.5-1 3-1.5V21h-19z"/>', s: '<path d="M2.5 14.5c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 1.5-1 3-1.5M2.5 19c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 1.5-1 3-1.5"/><path d="M12 3v2.6M10.7 4.3h2.6M12 6.8c1.7 0 2.7.8 2.7 2 0 .7-.4 1.2-1 1.6l.2.9h-3.8l.2-.9c-.6-.4-1-.9-1-1.6 0-1.2 1-2 2.7-2z"/>' },
  roque: { f: mini('rook', 1.5, 3.5, .42) + mini('king', 12.5, 3.5, .42), s: mini('rook', 1.5, 3.5, .42) + mini('king', 12.5, 3.5, .42) + '<path d="M3.5 18.5h17M7 21l-3.5-2.5L7 16M17 16l3.5 2.5L17 21"/>' },
  cem: { f: '<rect x="2.5" y="6" width="19" height="12" rx="3"/>', s: '<rect x="2.5" y="6" width="19" height="12" rx="3"/><text x="12" y="15.2" text-anchor="middle" font-size="8.6" font-weight="800" fill="currentColor" stroke="none" font-family="system-ui,sans-serif" letter-spacing="-.3">100</text>' },
  gema: { f: '<path d="M6.5 4h11L21 9H3z"/>', s: '<path d="M6.5 4h11l3.5 5-9 11L3 9z"/><path d="M3 9h18M9.5 4 8 9l4 11 4-11-1.5-5"/>' },
  olhofechado: { f: '<path d="M2.5 7.5h19v4.5h-19z"/>', s: '<path d="M2.5 7.5h19v4.5h-19z"/><path d="M5 15.5c2 1.7 4.5 2.6 7 2.6s5-.9 7-2.6M7.5 17.4 6.5 19.6M16.5 17.4l1 2.2M12 18.1v2.4"/>' },
  sequencia: { f: '<path d="M4 6l5 6-5 6h3.5l5-6-5-6z"/>', s: '<path d="m4 6 5 6-5 6M10.5 6l5 6-5 6M17 6l3.5 6-3.5 6"/>' },
  marcador: { f: '<path d="M6.5 3.5h11v17L12 16.5l-5.5 4z"/>', s: '<path d="M6.5 3.5h11v17L12 16.5l-5.5 4z"/><path d="m9.2 9.2 2 2 3.6-3.6"/>' },
  chave: { f: '<circle cx="7.5" cy="12" r="4.5"/>', s: '<circle cx="7.5" cy="12" r="4.5"/><circle cx="7.5" cy="12" r="1.5"/><path d="M12 12h9M17 12v3.4M20.5 12v2.6"/>' },
  presente: { f: '<rect x="3.5" y="9" width="17" height="4"/>', s: '<rect x="3.5" y="9" width="17" height="11.5" rx="1.5"/><path d="M3.5 13h17M12 9v11.5M12 9c-1.5-3.5-5.5-4.5-6-2s3 2 6 2zM12 9c1.5-3.5 5.5-4.5 6-2s-3 2-6 2z"/>' },
  yin: { f: '<circle cx="12" cy="12" r="8.5"/>', s: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/><circle cx="7.8" cy="12" r="1.3" fill="currentColor"/>' },
  roquelongo: { f: mini('rook', 12, 2.5, .45), s: mini('king', 1.5, 2.5, .45) + mini('rook', 12, 2.5, .45) + '<path d="M20.5 18.5h-17M7 16l-3.5 2.5L7 21"/>' },
  cruz: { f: '<path d="M8 8h4v4H8zM12 12h4v4h-4z"/>', s: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8v8H8z"/><path d="M12 8v8M8 12h8" opacity=".6"/>' },
  batimento: { f: '<path d="M12 20.5S3.5 15.5 3.5 9.3A4.3 4.3 0 0 1 12 7.5a4.3 4.3 0 0 1 8.5 1.8c0 6.2-8.5 11.2-8.5 11.2z"/>', s: '<path d="M2.5 13h4l2-4.5 3.5 9 2.5-6.5 1.5 2h5.5"/>' },
  cronometro: { f: '<circle cx="12" cy="13.5" r="7.5"/>', s: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V8.6M10 2.5h4M18.5 6.5 20 5"/><path d="M12 8.6l2.6.9-2.6.9" fill="currentColor"/>' },
  bandeirabranca: { f: '<path d="M5.5 4.5c3-1.8 5.5 1.8 8.5 0s3.5-1 4.5-.5v8c-1-.5-1.5-1.3-4.5.5s-5.5-1.8-8.5 0z"/>', s: '<path d="M5.5 21V3.5"/><path d="M5.5 4.5c3-1.8 5.5 1.8 8.5 0s3.5-1 4.5-.5v8c-1-.5-1.5-1.3-4.5.5s-5.5-1.8-8.5 0"/>' },
  espadas: { f: '<path d="M4 4h3.5l6 6-3.5 3.5-6-6zM20 4h-3.5l-6 6 3.5 3.5 6-6z"/>', s: '<path d="m4 4 9.5 9.5M20 4l-9.5 9.5M4 4v3.5M4 4h3.5M20 4v3.5M20 4h-3.5M6.5 15.5l2 2M17.5 15.5l-2 2M5 19.5l2.5-2.5M19 19.5 16.5 17"/>' },
  retorno: { f: '<path d="M4.5 10h10a5 5 0 0 1 0 10H11v-4h3.5a1 1 0 0 0 0-2h-10z"/>', s: '<path d="M9 14.5 4.5 10 9 5.5"/><path d="M4.5 10h10a5 5 0 0 1 0 10H11"/>' },
  globo: { f: '<circle cx="12" cy="12" r="8.5"/>', s: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M5 7.5h14M5 16.5h14M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z"/>' },
  degraus: { f: '<path d="M3.5 20.5v-4.5h4.5v-4.5h4.5V7h4.5v13.5z"/>', s: '<path d="M3.5 20.5h17M3.5 20.5v-4.5h4.5v-4.5h4.5V7h4.5v13.5"/><path d="M17 7V2.5l3 1.3-3 1.3"/>' },
  grade4: { f: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>', s: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>' },
  cafe: { f: '<path d="M4.5 9.5h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/>', s: '<path d="M4.5 9.5h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zM16.5 11h1.5a2.5 2.5 0 0 1 0 5h-1.8M8 3.5c-.8 1 .8 2 0 3M12 3.5c-.8 1 .8 2 0 3M3.5 21.5h14"/>' },
  exclama: { f: '<rect x="6" y="3" width="12" height="18" rx="4"/>', s: '<path d="M12 6.5v8"/><circle cx="12" cy="17.6" r="1.2" fill="currentColor"/>' },
  sol: { f: '<path d="M7.5 15.5a4.5 4.5 0 0 1 9 0z"/>', s: '<path d="M7.5 15.5a4.5 4.5 0 0 1 9 0M12 6.5v2M5.6 9.1l1.4 1.4M18.4 9.1 17 10.5M3 15.5h18M6 19h12"/>' },
  coroa: { f: '<path d="m3.5 8.5 4.2 4 4.3-7 4.3 7 4.2-4-1.8 10H5.3z"/>', s: '<path d="m3.5 8.5 4.2 4 4.3-7 4.3 7 4.2-4-1.8 10H5.3z"/><path d="M5.5 21h13"/><circle cx="12" cy="14.5" r="1.2" fill="currentColor"/>' },
  marcha: { f: mini('pawn', 3, 7.5, .55), s: mini('pawn', 3, 7.5, .55) + '<path d="M17 20V6M13.5 9.5 17 6l3.5 3.5"/><path d="M17 3.2v.01" stroke-width="2.4"/>' },
  bobo: { f: '<path d="M4 16.5 6.5 5.5l5.5 6 5.5-6 2.5 11z"/>', s: '<path d="M4 16.5 6.5 5.5l5.5 6 5.5-6 2.5 11z"/><path d="M4 16.5h16v3.5H4z"/><circle cx="6.5" cy="4.2" r="1.3"/><circle cx="17.5" cy="4.2" r="1.3"/><circle cx="12" cy="18.2" r=".7" fill="currentColor"/>' },
  dupla: { f: '<path d="m2.5 10 2.8 2.6L8.5 7.5l3.2 5.1 2.8-2.6-1.3 7H3.8z"/>', s: '<path d="m9.5 7.5 2.8 2.6 3.2-5.1 3.2 5.1L21.5 7.5l-1.3 7h-9.4z"/><path d="m2.5 10 2.8 2.6L8.5 7.5l3.2 5.1M3.8 17h9.4M4.5 20.5h15"/>' }
};

/* as insígnias. v(X): valor atual; lv: metas dos cinco níveis; rare: um nível só */
const BADGES = [
  // treino
  { id: 'tatico', cat: 'treino', t: 'Tático', ic: 'alvo', lv: [25, 100, 300, 750, 1500], d: n => 'Resolva ' + n + ' exercícios tirados das suas partidas', v: X => X.solved },
  { id: 'relampago', cat: 'treino', t: 'Relâmpago', ic: 'raio', lv: [8, 15, 22, 30, 40], d: n => 'Faça ' + n + ' acertos numa só Corrida', v: X => X.rbest },
  { id: 'kotov', cat: 'treino', t: 'Árvore de Kotov', ic: 'garfo', lv: [5, 20, 50, 120, 250], d: n => 'Tenha o melhor lance entre os seus candidatos ' + n + ' vezes', v: X => X.candFound },
  { id: 'autopsia', cat: 'treino', t: 'Autópsia', ic: 'olho', lv: [1, 5, 15, 40, 100], d: n => 'Tire 70% ou mais de autocrítica em ' + n + ' ' + pl(n, 'partida', 'partidas') + ' no Você primeiro', v: X => X.self70 },
  { id: 'oposicao', cat: 'treino', t: 'Oposição', ic: 'oposicao', lv: () => [2, 5, 9, 13, ENDS.length], d: n => 'Conclua ' + n + ' lições do curso de finais', v: X => X.ends },
  { id: 'rede', cat: 'treino', t: 'Rede de mate', ic: 'grade', lv: () => [5, 10, 15, 20, MATES.length], d: n => 'Resolva ' + n + ' padrões de mate', v: X => X.mates },
  { id: 'livro', cat: 'treino', t: 'Livro aberto', ic: 'livro', lv: [10, 40, 100, 200, 400], d: n => 'Fixe ' + n + ' posições do seu repertório', v: X => X.rep },
  { id: 'tecnica', cat: 'treino', t: 'Técnica', ic: 'bandeira', lv: [1, 3, 8, 15, 30], d: n => 'Converta ' + n + ' ' + pl(n, 'vitória que tinha escapado', 'vitórias que tinham escapado'), v: X => X.conv },
  { id: 'fortaleza', cat: 'treino', t: 'Fortaleza', ic: 'p:rook', lv: [1, 3, 8, 15, 30], d: n => 'Salve ' + n + ' ' + pl(n, 'posição difícil', 'posições difíceis'), v: X => X.def },
  { id: 'anticapivara', cat: 'treino', t: 'Anticapivara', ic: 'alerta', lv: [10, 40, 120, 300, 700], d: n => 'Ache ' + n + ' capivaradas no Qual é a capivarada?', v: X => X.capiOk },
  { id: 'fotografica', cat: 'treino', t: 'Memória fotográfica', ic: 'memoria', lv: [8, 10, 12, 14, 15], d: n => 'Acerte ' + n + ' de 15 numa rodada de Memória', v: X => X.memBest },
  { id: 'estante', cat: 'treino', t: 'Estante de táticas', ic: 'estante', lv: [10, 50, 150, 400, 1000], d: n => 'Resolva ' + n + ' puzzles da Biblioteca de táticas', v: X => X.libOk },
  { id: 'leitor', cat: 'treino', t: 'Leitor', ic: 'livro', lv: [10, 50, 150, 400, 1000], d: n => 'Aprenda ' + n + ' linhas e exercícios na Biblioteca', v: X => X.bibL },
  { id: 'raiox', cat: 'treino', t: 'Raio-X', ic: 'scan', lv: [4, 7, 10, 13, 16], d: n => 'Acerte ' + n + ' posições numa rodada do Raio-X', v: X => X.xbest },
  { id: 'zeitnot', cat: 'treino', t: 'Zeitnot', ic: 'relogio', lv: [1, 3, 8, 15, 30], d: n => 'Vença ' + n + ' ' + pl(n, 'partida', 'partidas') + ' no treino de relógio', v: X => X.clockW },
  { id: 'castigo', cat: 'treino', t: 'Castigo', ic: 'martelo', lv: [5, 25, 75, 150, 300], d: n => 'Puna ' + n + ' erros no modo Puna o erro', v: X => X.punish },
  { id: 'teorico', cat: 'treino', t: 'Teórico', ic: 'chapeu', lv: [10, 40, 100, 250, 500], d: n => 'Resolva ' + n + ' posições no modo Teoria', v: X => X.theory },
  { id: 'telepata', cat: 'treino', t: 'Telepata', ic: 'onda', lv: [1, 5, 15, 40, 100], d: n => 'Jogue ' + n + ' ' + pl(n, 'rodada', 'rodadas') + ' de Adivinhe o lance', v: X => X.guess },
  { id: 'detetive', cat: 'treino', t: 'Detetive', ic: 'detetive', lv: [1, 5, 15, 40, 100], d: n => 'Complete ' + n + ' ' + pl(n, 'rodada', 'rodadas') + ' de Ache o erro', v: X => X.spot },
  { id: 'memoria', cat: 'treino', t: 'Memória de elefante', ic: 'ciclo', lv: [10, 40, 100, 250, 500], d: n => 'Leve ' + n + ' exercícios à revisão de 3 semanas ou mais', v: X => X.srsLong },
  // partidas
  { id: 'brilhante', cat: 'partidas', t: 'Lance brilhante', ic: 'estrela', lv: [3, 10, 25, 50, 100], d: n => 'Jogue ' + n + ' ' + pl(n, 'lance brilhante', 'lances brilhantes'), v: X => X.brill },
  { id: 'maquina', cat: 'partidas', t: 'Precisão de máquina', ic: 'mira', lv: [10, 40, 100, 250, 500], d: n => 'Termine ' + n + ' partidas com 90% ou mais de precisão', v: X => X.acc90 },
  { id: 'semcapivara', cat: 'partidas', t: 'Sem capivara', ic: 'escudook', lv: [10, 40, 100, 250, 500], d: n => 'Jogue ' + n + ' partidas de 30+ lances sem nenhuma capivarada', v: X => X.clean },
  { id: 'ressurreicao', cat: 'partidas', t: 'Ressurreição', ic: 'subida', lv: [3, 10, 25, 50, 100], d: n => 'Vença ' + n + ' ' + pl(n, 'partida', 'partidas') + ' depois de estar com 20% ou menos de chance', v: X => X.comeback },
  { id: 'golias', cat: 'partidas', t: 'Davi e Golias', ic: 'montanha', lv: [1, 5, 15, 30, 60], d: n => 'Vença ' + n + ' ' + pl(n, 'adversário', 'adversários') + ' com 200 pontos ou mais acima de você', v: X => X.giant },
  { id: 'carrasco', cat: 'partidas', t: 'Carrasco', ic: 'p:king', lv: [50, 200, 500, 1000, 2500], d: n => 'Vença ' + n + ' partidas por xeque-mate', v: X => X.mateW },
  { id: 'miniatura', cat: 'partidas', t: 'Miniatura', ic: 'ampulheta', lv: [5, 25, 75, 200, 500], d: n => 'Dê mate em até 25 lances ' + n + ' ' + pl(n, 'vez', 'vezes'), v: X => X.mini },
  { id: 'invicto', cat: 'partidas', t: 'Invicto', ic: 'trofeu', lv: [5, 8, 11, 14, 18], d: n => 'Vença ' + n + ' partidas seguidas', v: X => X.winRow },
  { id: 'colecao', cat: 'partidas', t: 'Coleção de mates', ic: 'colecao', lv: [1, 2, 3, 4, 5], d: n => n === 1 ? 'Dê xeque-mate' : 'Dê mate com ' + n + ' peças diferentes (peão, cavalo, bispo, torre, dama)', v: X => X.mateTypes },
  { id: 'peaopassado', cat: 'partidas', t: 'Peão passado', ic: 'marcha', lv: [5, 25, 100, 300, 750], d: n => 'Promova ' + n + ' ' + pl(n, 'peão', 'peões') + ' nas suas partidas', v: X => X.promos },
  { id: 'enciclopedia', cat: 'partidas', t: 'Enciclopédia', ic: 'biblioteca', lv: [25, 75, 150, 300, 500], d: n => 'Jogue ' + n + ' aberturas diferentes', v: X => X.openings },
  { id: 'coruja', cat: 'partidas', t: 'Coruja', ic: 'lua', lv: [10, 50, 150, 400, 1000], d: n => 'Vença ' + n + ' partidas entre meia-noite e 5 da manhã', v: X => X.nightW },
  { id: 'maratonista', cat: 'partidas', t: 'Maratonista', ic: 'p:pawn', lv: [500, 2000, 5000, 10000, 20000], d: n => 'Jogue ' + n.toLocaleString('pt-BR') + ' partidas', v: X => X.games },
  // mais treino
  { id: 'vendado', cat: 'treino', t: 'Olhos vendados', ic: 'olhofechado', lv: [5, 25, 75, 150, 300], d: n => 'Resolva ' + n + ' exercícios no modo às cegas ou sem peões', v: X => X.blind },
  { id: 'emchamas', cat: 'treino', t: 'Em chamas', ic: 'sequencia', lv: [5, 10, 15, 20, 30], d: n => 'Acerte ' + n + ' seguidos numa Corrida', v: X => X.rushTop },
  { id: 'revisor', cat: 'treino', t: 'Revisor', ic: 'marcador', lv: [10, 50, 150, 400, 1000], d: n => 'Revise ' + n + ' posições do seu repertório', v: X => X.repReviews },
  // mais partidas
  { id: 'otimo', cat: 'partidas', t: 'Ótimo lance', ic: 'exclama', lv: [5, 25, 75, 150, 300], d: n => 'Jogue ' + n + ' ótimos lances (!) nas partidas analisadas', v: X => X.great },
  { id: 'especialista', cat: 'partidas', t: 'Especialista', ic: 'chave', lv: [25, 75, 150, 300, 600], d: n => 'Jogue ' + n + ' partidas com a mesma abertura', v: X => X.topOpening },
  { id: 'gambiteiro', cat: 'partidas', t: 'Gambiteiro', ic: 'presente', lv: [5, 25, 75, 150, 300], d: n => 'Vença ' + n + ' partidas num gambito', v: X => X.gambitW },
  { id: 'trevas', cat: 'partidas', t: 'Lado sombrio', ic: 'yin', lv: [10, 50, 150, 400, 1000], d: n => 'Vença ' + n + ' partidas de pretas', v: X => X.blackW },
  { id: 'roquelongo', cat: 'partidas', t: 'Roque longo', ic: 'roquelongo', lv: [5, 25, 75, 150, 300], d: n => 'Vença ' + n + ' partidas depois de rocar grande', v: X => X.longCastleW },
  { id: 'reinocentro', cat: 'partidas', t: 'Rei no centro', ic: 'cruz', lv: [5, 25, 75, 150, 300], d: n => 'Vença ' + n + ' partidas de 30+ lances sem rocar', v: X => X.noCastleW },
  { id: 'resistencia', cat: 'partidas', t: 'Resistência', ic: 'batimento', lv: [5, 25, 75, 150, 300], d: n => 'Vença ' + n + ' partidas de 60 lances ou mais', v: X => X.longW },
  { id: 'bandeira', cat: 'partidas', t: 'O relógio é peça', ic: 'cronometro', lv: [5, 25, 75, 150, 300], d: n => 'Vença ' + n + ' partidas no tempo', v: X => X.timeW },
  { id: 'rendicao', cat: 'partidas', t: 'Bandeira branca', ic: 'bandeirabranca', lv: [25, 100, 250, 500, 1000], d: n => 'Faça ' + n + ' adversários abandonarem', v: X => X.resignW },
  { id: 'rival', cat: 'partidas', t: 'Rivalidade', ic: 'espadas', lv: [5, 15, 30, 60, 100], d: n => 'Jogue ' + n + ' partidas contra o mesmo adversário', v: X => X.rival },
  { id: 'revanche', cat: 'partidas', t: 'Revanche', ic: 'retorno', lv: [1, 5, 15, 40, 100], d: n => 'Vença logo depois de perder para o mesmo adversário ' + n + ' ' + pl(n, 'vez', 'vezes'), v: X => X.revenge },
  { id: 'cosmopolita', cat: 'partidas', t: 'Cosmopolita', ic: 'globo', lv: [50, 200, 500, 1000, 2000], d: n => 'Enfrente ' + n.toLocaleString('pt-BR') + ' adversários diferentes', v: X => X.opponents },
  { id: 'patamar', cat: 'partidas', t: 'Patamar', ic: 'degraus', lv: [800, 1000, 1200, 1500, 1800], d: n => 'Chegue a ' + n + ' de rating em algum ritmo', v: X => X.peak },
  { id: 'polivalente', cat: 'partidas', t: 'Polivalente', ic: 'grade4', lv: [1, 2, 3, 4], d: n => n === 1 ? 'Vença uma partida' : 'Vença em ' + n + ' ritmos diferentes (bullet, blitz, rápida, diária)', v: X => X.tcW },
  { id: 'sessao', cat: 'partidas', t: 'Sessão maratona', ic: 'cafe', lv: [15, 30, 50, 75, 100], d: n => 'Jogue ' + n + ' partidas num só dia', v: X => X.dayMax },
  { id: 'madrugador', cat: 'habito', t: 'Madrugador', ic: 'sol', lv: [5, 25, 75, 150, 300], d: n => 'Vença ' + n + ' partidas entre 5 e 8 da manhã', v: X => X.morningW },
  // hábito
  { id: 'disciplina', cat: 'habito', t: 'Disciplina de ferro', ic: 'chama', lv: [3, 7, 21, 60, 180], d: n => 'Bata a meta diária ' + n + ' dias seguidos', v: X => X.streak },
  { id: 'analista', cat: 'habito', t: 'Analista', ic: 'lupa', lv: [25, 100, 300, 750, 1500], d: n => 'Analise ' + n + ' partidas com o motor', v: X => X.analyzed },
  { id: 'clube', cat: 'habito', t: 'Sócio do clube', ic: 'calendario', lv: [5, 20, 60, 150, 365], d: n => 'Treine em ' + n + ' dias diferentes', v: X => X.daysActive },
  { id: 'meta', cat: 'habito', t: 'Meta batida', ic: 'meta', lv: [3, 15, 50, 120, 300], d: n => 'Bata a meta diária em ' + n + ' dias', v: X => X.goalDays },
  // raridades
  { id: 'enpassant', cat: 'raras', rare: true, t: 'En passant', ic: 'ep', d: () => 'Capture en passant numa partida analisada', v: X => X.ep },
  { id: 'subpromocao', cat: 'raras', rare: true, t: 'Subpromoção', ic: 'p:knight', d: () => 'Promova um peão a cavalo, bispo ou torre', v: X => X.underpromo },
  { id: 'afogamento', cat: 'raras', rare: true, t: 'Afogamento', ic: 'onda2', d: () => 'Termine uma partida empatada por afogamento', v: X => X.stalemate },
  { id: 'matedepeao', cat: 'raras', rare: true, t: 'Mate de peão', ic: 'p:pawn', d: () => 'Dê xeque-mate com um peão', v: X => X.pawnMate },
  { id: 'roquefatal', cat: 'raras', rare: true, t: 'Roque fatal', ic: 'roque', d: () => 'Dê xeque-mate roqueando', v: X => X.castleMate },
  { id: 'centenaria', cat: 'raras', rare: true, t: 'Centenária', ic: 'cem', d: () => 'Jogue uma partida de 100 lances ou mais', v: X => X.long100 },
  { id: 'pastor', cat: 'raras', rare: true, t: 'Mate do pastor', ic: 'p:queen', d: () => 'Dê mate de brancas em até 4 lances', v: X => X.scholar },
  { id: 'louco', cat: 'raras', rare: true, t: 'Mate do louco', ic: 'bobo', d: () => 'Dê mate de pretas no segundo lance', v: X => X.fool },
  { id: 'reiguerreiro', cat: 'raras', rare: true, t: 'Rei guerreiro', ic: 'coroa', d: () => 'Vença com o seu rei na 6ª fileira do adversário', v: X => X.kingWalk },
  { id: 'fabrica', cat: 'raras', rare: true, t: 'Fábrica de damas', ic: 'dupla', d: () => 'Promova dois peões na mesma partida', v: X => X.doublePromo },
  { id: 'coroacao', cat: 'raras', rare: true, t: 'Coroação', ic: 'promo', d: () => 'Dê xeque-mate promovendo um peão', v: X => X.promoMate },
  { id: 'perpetuo', cat: 'raras', rare: true, t: 'Xeque perpétuo', ic: 'ciclo', d: () => 'Empate por repetição dando xeque nos seus três últimos lances', v: X => X.perpetual },
  { id: 'perfeita', cat: 'raras', rare: true, t: 'Partida perfeita', ic: 'gema', d: () => 'Termine uma partida de 25+ lances sem imprecisão, erro ou capivarada', v: X => X.perfect }
];
const bLv = b => b.rare ? [1] : typeof b.lv === 'function' ? b.lv() : b.lv;
const bMax = b => bLv(b).length;
function bLevel(b, v) { let l = 0; for (const t of bLv(b)) if (v >= t) l++; return l; }
function bXp(b, l) { if (!l) return 0; if (b.rare) return RARE_XP; let s = 0; for (let i = 0; i < l; i++) s += TIERS[i].xp; return s; }
const bTierName = (b, l) => b.rare ? 'Rara' : TIERS[l - 1].n;

/* prestígio: a escada das peças. Depois do Rei, cada 3.000 XP é uma promoção */
const RANKS = [
  { n: 'Peão', p: 'pawn', xp: 0, m: 'bronze', d: 'Todo grande jogador começou aqui. Cada passo à frente conta.' },
  { n: 'Cavalo', p: 'knight', xp: 400, m: 'silver', d: 'Você já salta por cima dos obstáculos.' },
  { n: 'Bispo', p: 'bishop', xp: 1200, m: 'gold', d: 'Você enxerga longe, pelas diagonais.' },
  { n: 'Torre', p: 'rook', xp: 2800, m: 'plat', d: 'Força nas colunas abertas.' },
  { n: 'Dama', p: 'queen', xp: 5000, m: 'diam', d: 'A peça mais poderosa do tabuleiro.' },
  { n: 'Rei', p: 'king', xp: 8000, m: 'royal', d: 'O centro de tudo. Daqui em diante, cada 3.000 XP é uma promoção.' }
];
const PROMO_XP = 3000;
function rankOf(xp) {
  let i = 0; while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const promo = i === RANKS.length - 1 ? Math.floor((xp - RANKS[i].xp) / PROMO_XP) : 0;
  const base = i === RANKS.length - 1 ? RANKS[i].xp + promo * PROMO_XP : RANKS[i].xp;
  const next = i === RANKS.length - 1 ? base + PROMO_XP : RANKS[i + 1].xp;
  return { i, promo, base, next, f: Math.max(0, Math.min(1, (xp - base) / (next - base))), step: i + promo };
}
const rankName = r => RANKS[r.i].n + (r.promo ? ' · Promoção ' + roman(r.promo) : '');
function roman(n) { const v = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [k, r] of v) while (n >= k) { s += r; n -= k; } return s; }

/* ---------- desenho: disco chapado, um sinal e um anel que conta o nível ----------
   As cores vêm de variáveis CSS por nível (.t0 a .t5 e .tr), então o mesmo desenho
   funciona no tema claro e no escuro. Sem degradês nem filtros: é leve para desenhar 40 de uma vez. */
function ensureBadgeDefs() { /* nada a preparar: o desenho não usa definições compartilhadas */ }
function glyph(ic, x, y, s, big) {
  const open = '<svg class="gl" x="' + x + '" y="' + y + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24">';
  // peças: corpo em cor translúcida, contorno em tinta e um ponto de luz
  if (ic.startsWith('p:')) { const d = PIECE[ic.slice(2)]; return open + (big ? '<path class="gsh" d="' + d + '" transform="translate(.35 .6)"/>' : '') + '<path class="gf" d="' + d + '" fill-rule="evenodd"/><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/></svg>'; }
  const I = ICONS[ic], line = ' fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
  return open + '<g class="gf">' + I.f + '</g>' + (big ? '<g class="gsh"' + line + ' transform="translate(.35 .6)">' + I.s + '</g>' : '') + '<g' + line + '>' + I.s + '</g></svg>';
}
// anel em n segmentos iguais, com intervalos iguais; os k primeiros acesos, a partir do topo
function ring(n, k, r) {
  const gap = n > 1 ? 11 : 0, step = 360 / n; let h = '';
  for (let i = 0; i < n; i++) {
    const a0 = (-90 + i * step + gap / 2) * Math.PI / 180, a1 = (-90 + (i + 1) * step - gap / 2) * Math.PI / 180;
    const x0 = 32 + r * Math.cos(a0), y0 = 32 + r * Math.sin(a0), x1 = 32 + r * Math.cos(a1), y1 = 32 + r * Math.sin(a1);
    h += n === 1 ? '<circle class="seg' + (k ? ' on' : '') + '" cx="32" cy="32" r="' + r + '"/>'
      : '<path class="seg' + (i < k ? ' on' : '') + '" d="M' + x0.toFixed(2) + ' ' + y0.toFixed(2) + 'A' + r + ' ' + r + ' 0 0 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + '"/>';
  }
  return h;
}
const tierCls = (b, l) => !l ? 'bt0' : b.rare ? 'btr' : 'bt' + l;
function badgeSvg(id, lvl, size, extra) {
  const b = BADGES.find(x => x.id === id), cls = tierCls(b, lvl);
  const body = b.rare
    ? '<path class="seg' + (lvl ? ' on' : '') + '" d="M32 3.6 60.4 32 32 60.4 3.6 32z" stroke-linejoin="round"/><path class="disk" d="M32 10.2 53.8 32 32 53.8 10.2 32z"/>' + glyph(b.ic, 19.5, 19.5, 25, size > 100)
    : ring(bMax(b), lvl, 29) + '<circle class="disk" cx="32" cy="32" r="24.2"/>' + '<path class="gls" d="M11.6 22.5A22.5 22.5 0 0 1 52.4 22.5 34 26 0 0 0 11.6 22.5z"/><circle class="edge" cx="32" cy="32" r="23.4"/>' + glyph(b.ic, 17, 17, 30, size > 100);
  return '<svg class="bd ' + cls + (extra ? ' ' + extra : '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 64 64" aria-hidden="true">' + body + '</svg>';
}
const RANK_T = ['bt1', 'bt2', 'bt3', 'bt4', 'bt5', 'btr'];
function rankSvg(r, size, dim) {
  const R = RANKS[r.i];
  return '<svg class="bd rk ' + (dim ? 'bt0' : RANK_T[r.i]) + '" width="' + size + '" height="' + size + '" viewBox="0 0 64 64" aria-hidden="true">' + ring(RANKS.length, dim ? 0 : r.i + 1, 29) + '<circle class="disk" cx="32" cy="32" r="24.2"/>' + '<path class="gls" d="M11.6 22.5A22.5 22.5 0 0 1 52.4 22.5 34 26 0 0 0 11.6 22.5z"/><circle class="edge" cx="32" cy="32" r="23.4"/>' + glyph('p:' + R.p, 18, 17.5, 28, size > 100) +
    (r.promo ? '<text class="pr" x="32" y="52.5" text-anchor="middle">' + roman(r.promo) + '</text>' : '') + '</svg>';
}

/* ---------- estatísticas ---------- */
let BGAME = null, BGKEY = '';
function myPly(g, i) { return (i % 2 === 0) === (g.c === 'w'); }
function badgeGameStats() {
  const key = dataKey() + ':' + (GP.ready ? 1 : 0);
  if (BGAME && BGKEY === key) return BGAME;
  const X = { games: S.games.length, mateW: 0, giant: 0, mini: 0, winRow: 0, analyzed: 0, brill: 0, acc90: 0, clean: 0, comeback: 0, promos: 0, underpromo: 0, openings: 0, nightW: 0, mateTypes: 0, pawnMate: 0, castleMate: 0, stalemate: 0, long100: 0, ep: 0, perfect: 0 };
  Object.assign(X, { blackW: 0, longCastleW: 0, noCastleW: 0, longW: 0, timeW: 0, resignW: 0, rival: 0, revenge: 0, opponents: 0, peak: 0, tcW: 0, dayMax: 0, morningW: 0, topOpening: 0, gambitW: 0, scholar: 0, fool: 0, kingWalk: 0, doublePromo: 0, promoMate: 0, perpetual: 0, great: 0 });
  const peaks = new Map(), opc = new Map(), oppc = new Map(), lastVs = new Map(), tcs = new Set(), days = new Map();
  const ops = new Set(), mt = new Set(); let row = 0;
  for (const g of S.games.slice().sort((a, b) => a.end - b.end)) {
    const r = rk(g), mv = g.mv ? g.mv.split(' ') : [];
    const on = opName(g); ops.add(on); opc.set(on, (opc.get(on) || 0) + 1);
    const ok = (g.opp || '').toLowerCase(); oppc.set(ok, (oppc.get(ok) || 0) + 1);
    if (g.tc && g.mR) { const pk = peaks.get(g.tc) || { n: 0, m: 0 }; pk.n++; pk.m = Math.max(pk.m, g.mR); peaks.set(g.tc, pk); }
    const dk = dayKey(new Date(g.end * 1000)); days.set(dk, (days.get(dk) || 0) + 1);
    let castled = 0, myProm = 0, kingFar = false, myN = 0;
    for (let i = 0; i < mv.length; i++) {
      if (!myPly(g, i)) continue; const t = mv[i]; myN++;
      if (t.startsWith('O-O-O')) castled = 2; else if (t.startsWith('O-O')) castled = castled || 1;
      if (t.includes('=')) myProm++;
      if (t[0] === 'K') { const sq = t.replace(/[+#x]/g, '').slice(-2), rank = +sq[1]; if ((g.c === 'w' && rank >= 6) || (g.c === 'b' && rank <= 3)) kingFar = true; }
    }
    if (myProm >= 2) X.doublePromo = 1;
    if (g.res === 'repetition' && mv.length >= 6) { const mine = []; for (let i = mv.length - 1; i >= 0 && mine.length < 3; i--) if (myPly(g, i)) mine.push(mv[i]); if (mine.length === 3 && mine.every(t => t.endsWith('+'))) X.perpetual = 1; }
    const prev = lastVs.get(ok); lastVs.set(ok, r);
    if (mv.length >= 200) X.long100 = 1;
    if (g.res === 'stalemate') X.stalemate = 1;
    for (let i = 0; i < mv.length; i++) if (myPly(g, i) && mv[i].includes('=')) { X.promos++; if (/=[NBR]/.test(mv[i])) X.underpromo = 1; }
    if (r === 'W') {
      row++; X.winRow = Math.max(X.winRow, row);
      if (g.c === 'b') X.blackW++; if (castled === 2) X.longCastleW++; if (!castled && myN >= 30) X.noCastleW++;
      if (mv.length >= 120) X.longW++; if (g.oRes === 'timeout') X.timeW++; if (g.oRes === 'resigned') X.resignW++;
      if (prev === 'L') X.revenge++; if (g.tc) tcs.add(g.tc); if (kingFar) X.kingWalk = 1;
      if (/gambit/i.test(g.op || '')) X.gambitW++;
      { const hh = new Date(g.end * 1000).getHours(); if (hh >= 5 && hh < 8) X.morningW++; }
      if (g.oRes === 'checkmated') { if (g.c === 'w' && mv.length <= 7) X.scholar = 1; if (g.c === 'b' && mv.length <= 4) X.fool = 1; const lt = mv[mv.length - 1] || ''; if (lt.includes('=') && lt.endsWith('#')) X.promoMate = 1; }
      if (g.oR && g.mR && g.oR - g.mR >= 200) X.giant++;
      const h = new Date(g.end * 1000).getHours(); if (h < 5) X.nightW++;
      const last = mv[mv.length - 1] || '';
      if (g.oRes === 'checkmated' && last.endsWith('#') && myPly(g, mv.length - 1)) {
        X.mateW++; if (mv.length <= 50) X.mini++;
        const pc = /^[NBRQK]/.test(last) ? last[0] : /^O-O/.test(last) ? 'K' : 'P';
        if (pc !== 'K') mt.add(pc); if (pc === 'P') X.pawnMate = 1; if (/^O-O/.test(last)) X.castleMate = 1;
      } else if (g.oRes === 'checkmated') X.mateW++;
    } else if (r === 'L') row = 0;
  }
  X.openings = ops.size; X.mateTypes = mt.size;
  X.topOpening = Math.max(0, ...opc.values()); X.rival = Math.max(0, ...oppc.values()); X.opponents = oppc.size; X.tcW = tcs.size; X.peak = Math.max(0, ...[...peaks.values()].filter(v => v.n >= 20).map(v => v.m)); X.dayMax = Math.max(0, ...days.values());
  for (const g of analyzedGames()) {
    X.analyzed++; const P = prepIf(g); if (!P || !P.cls) continue;
    let blunder = false, sloppy = false, mine = 0, low = false;
    P.cls.forEach((c, i) => {
      const m = P.moves[i]; if (m.color !== g.c) return; mine++;
      if (c.k === 'brill') X.brill++; if (c.k === 'great') X.great++; if (c.k === 'blunder') blunder = true;
      if (c.k === 'inacc' || c.k === 'mistake' || c.k === 'blunder' || c.k === 'miss') sloppy = true;
      if (m.flags && m.flags.includes('e')) X.ep = 1;
      if (i >= 10 && P.evs[i] && sideWp(P.evs[i], g.c) <= 20) low = true;
    });
    if (P.acc && P.acc[g.c] >= 90 && mine >= 15) X.acc90++;
    if (!blunder && mine >= 30) X.clean++;
    if (!sloppy && mine >= 25) X.perfect = 1;
    if (low && rk(g) === 'W') X.comeback++;
  }
  BGAME = X; BGKEY = key; return X;
}
function maxStreak() {
  const d = store.get('daily', {}), days = Object.keys(d).filter(k => d[k] >= GOAL).sort(); let best = 0, run = 0, prev = null;
  for (const k of days) { const t = new Date(k + 'T12:00:00').getTime(); run = prev != null && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = t; }
  return Math.max(best, streakDays());
}
function badgeStats() {
  const X = Object.assign({}, badgeGameStats()), ar = store.get('arena', {}), cnt = p => Object.keys(ar).filter(k => k.startsWith(p) && ar[k].ok).length;
  const act = store.get('act', {}), daily = store.get('daily', {}), tot = k => Object.values(act).reduce((s, d) => s + (d[k] || 0), 0);
  X.solved = Object.keys(store.get('solved', {})).length;
  X.rbest = store.get('rbest', 0); X.candFound = store.get('cand', {}).found || 0;
  X.self70 = Object.values(store.get('self', {})).filter(x => x.s >= 70).length;
  X.ends = cnt('end:'); X.mates = cnt('mates:'); X.conv = cnt('convert:'); X.def = cnt('defend:') + cnt('mine:');
  X.rep = Object.values(store.get('rep', {})).filter(x => x.b >= 2).length;
  X.capiOk = (store.get('capi', {}).ok) || 0; X.memBest = (store.get('mem', {}).best) || 0; X.libOk = Object.values(store.get('libDone', {})).filter(x => x === 1).length; X.bibL = Object.keys((store.get('bib', {}) || {}).c || {}).length;
  X.xbest = store.get('xbest', 0); X.clockW = store.get('clockHist', []).filter(x => x.res === 'W').length;
  X.blind = tot('blind'); X.repReviews = tot('rep'); X.rushTop = (store.get('rush', {}).top) || 0;
  X.punish = tot('punish'); X.theory = tot('theory'); X.guess = tot('guess'); X.spot = tot('spot');
  X.srsLong = Object.values(store.get('srs', {})).filter(e => e.b >= 4).length;
  const days = new Set(Object.keys(daily).filter(k => daily[k] > 0)); for (const k in act) if (Object.values(act[k]).some(v => v > 0)) days.add(k);
  X.daysActive = days.size; X.goalDays = Object.keys(daily).filter(k => daily[k] >= GOAL).length;
  X.streak = maxStreak();
  return X;
}
function badgeTotals(B) {
  let xp = 0, lv = 0, nb = 0, rare = 0;
  for (const b of BADGES) { const l = B[b.id] ? B[b.id].l : 0; if (!l) continue; nb++; lv += l; xp += bXp(b, l); if (b.rare) rare++; }
  const maxLv = BADGES.reduce((s, b) => s + bMax(b), 0), wx = wkXp(); xp += wx;
  return { xp, lv, nb, rare, maxLv, wx, rank: rankOf(xp) };
}

/* ---------- verificação e comemoração ---------- */
let BSTAT = null;
function badgeCheck() {
  if (!S.games.length && !Object.keys(store.get('solved', {})).length) return;
  let X; try { X = BSTAT = badgeStats(); } catch (e) { return; }
  const B = store.get('bdg', {}), first = !store.get('bdgInit', false), fresh = [];
  const before = badgeTotals(B).rank;
  for (const b of BADGES) {
    const l = Math.min(bLevel(b, b.v(X) || 0), bMax(b)), cur = B[b.id] ? B[b.id].l : 0;
    if (l > cur) { B[b.id] = { l, t: Date.now() }; fresh.push({ b, l }); }
  }
  const wkFresh = first ? (wkCheck(), []) : wkCheck();
  if (!fresh.length && !wkFresh.length) { if (first) store.set('bdgInit', true); refreshWeekly(); return; }
  store.set('bdg', B); store.set('bdgInit', true);
  const after = badgeTotals(B).rank; store.set('prestige', Math.max(store.get('prestige', 0), after.step)); cloudPrefsPush();
  if (first) { toast('Você já tem ' + fresh.length + ' insígnia' + (fresh.length > 1 ? 's' : '') + ' e o prestígio de ' + rankName(after) + '. Veja em Conquistas.'); refreshBadgeSpots(); return; }
  for (const f of wkFresh) BQ.push(f);
  for (const f of fresh) BQ.push(f);
  if (after.step > before.step) BQ.push({ rank: after });
  refreshWeekly();
  badgeShowNext(); refreshBadgeSpots();
}
let BCHK = 0;
function badgeSoon() { clearTimeout(BCHK); BCHK = setTimeout(() => { (window.requestIdleCallback || (f => setTimeout(f, 0)))(() => badgeCheck(), { timeout: 2500 }); }, 1500); }
function refreshBadgeSpots() {
  const p = $('#pnBadges'); if (p && S.view === 'painel') p.innerHTML = pnBadgesHtml();
  if (S.view === 'conquistas') renderConquistas();
  const tb = document.querySelector('[data-v="conquistas"] .nb-dot'); if (tb) tb.hidden = !store.get('bdgNew', false);
}
const BQ = [];
function chime(big) {
  if (!store.get('snd', true)) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume();
    const t0 = AC.currentTime, notes = big ? [392, 523.25, 659.25, 783.99, 1046.5, 1318.5] : [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const o = AC.createOscillator(), g = AC.createGain(); o.type = 'triangle'; o.frequency.value = f;
      const t = t0 + i * (big ? .11 : .09); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.15, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + (big ? .9 : .55));
      o.connect(g).connect(AC.destination); o.start(t); o.stop(t + 1);
    });
  } catch (e) { /* sem áudio */ }
}
function badgeShowNext() {
  if (!BQ.length || $('#bfx')) return;
  if (document.hidden) { document.addEventListener('visibilitychange', badgeShowNext, { once: true }); return; }
  ensureBadgeDefs(); store.set('bdgNew', true);
  const it = BQ.shift(), more = BQ.length ? ' · mais ' + BQ.length : '';
  const el = document.createElement('div'); el.id = 'bfx'; el.className = 'bfx'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  let body;
  if (it.wk) {
    el.setAttribute('aria-label', 'Desafio concluído: ' + it.wk.t);
    body = '<span class="label">Desafio da semana' + more + '</span><div class="bfx-badge"><svg class="bd bt3" viewBox="0 0 64 64" width="150" height="150" aria-hidden="true">' + ring(3, 3, 29) + '<circle class="disk" cx="32" cy="32" r="24.2"/>' + glyph(it.wk.ic, 17, 17, 30, true) + '</svg></div><h2>Desafio concluído</h2><span class="tag tier-3">+' + (WK_XP + (it.all ? WK_BONUS : 0)) + ' XP' + (it.all ? ' · os três da semana!' : '') + '</span><p class="muted">' + esc(it.wk.t) + '</p>';
  } else if (it.rank) {
    const R = RANKS[it.rank.i];
    el.setAttribute('aria-label', 'Promovido a ' + rankName(it.rank));
    body = '<span class="label">Promoção' + more + '</span><div class="bfx-badge">' + rankSvg(it.rank, 170) + '</div><h2>Promovido a ' + esc(rankName(it.rank)) + '</h2><p class="muted">' + esc(R.d) + '</p>';
  } else {
    const { b, l } = it;
    el.setAttribute('aria-label', 'Nova conquista: ' + b.t);
    body = '<span class="label">' + (b.rare ? 'Insígnia rara' : l > 1 ? 'Subiu de nível' : 'Nova conquista') + more + '</span><div class="bfx-badge">' + badgeSvg(b.id, l, 170) + '</div><h2>' + esc(b.t) + '</h2><span class="tag tier-' + (b.rare ? 'r' : l) + '">' + bTierName(b, l) + (b.rare ? '' : ' · nível ' + ROMAN[l - 1]) + ' · +' + (bXp(b, l) - bXp(b, l - 1)) + ' XP</span><p class="muted">' + esc(b.d(bLv(b)[l - 1])) + '</p>';
  }
  el.innerHTML = '<div class="bfx-card' + (it.rank ? ' promo' : '') + '">' + body + '<div class="vxacts" style="justify-content:center"><button class="btn primary" type="button" data-bfx="ok">' + (BQ.length ? 'Próxima' : 'Continuar') + '</button><a class="btn" href="#conquistas" data-bfx="all">Ver conquistas</a></div></div>';
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('on'));
  haptic('ok'); chime(!!it.rank);
  const btn = el.querySelector('[data-bfx="ok"]'); try { btn.focus({ preventScroll: true }); } catch (e) { /* sem foco */ }
}
function badgeClose(all) {
  const el = $('#bfx'); if (!el) return; el.classList.remove('on');
  if (all) BQ.length = 0;
  setTimeout(() => { el.remove(); badgeShowNext(); }, 220);
}
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-bfx],#bfx'); if (!t) return;
  if (t.dataset.bfx === 'ok') badgeClose(false); else if (t.dataset.bfx === 'all') badgeClose(true); else if (t.id === 'bfx' && e.target.id === 'bfx') badgeClose(false);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#bfx')) badgeClose(false); });

/* ---------- aba Conquistas e cartão no Painel ---------- */
function badgeProgress(b, X) {
  const lv = bLv(b), v = b.v(X) || 0, l = Math.min(bLevel(b, v), lv.length), next = lv[Math.min(l, lv.length - 1)], prev = l ? lv[l - 1] : 0;
  return { v, l, next, f: l >= lv.length ? 1 : Math.max(0, Math.min(1, (v - prev) / Math.max(1, next - prev))) };
}
const fmtXp = n => n.toLocaleString('pt-BR');
function pnBadgesHtml() {
  ensureBadgeDefs();
  const B = store.get('bdg', {}), T = badgeTotals(B), got = BADGES.filter(b => B[b.id] && B[b.id].l).sort((a, b) => B[b.id].t - B[a.id].t);
  return '<div class="pnb-head"><a href="#conquistas" class="pnb-rank">' + rankSvg(T.rank, 64) + '</a><div class="stack" style="gap:4px;min-width:0;flex:1"><span class="label">Prestígio</span><b style="font-size:18px">' + esc(rankName(T.rank)) + '</b><div class="bbar sm"><i style="transform:scaleX(' + T.rank.f.toFixed(3) + ')"></i></div><span class="muted mono" style="font-size:12px">' + fmtXp(T.xp) + ' / ' + fmtXp(T.rank.next) + ' XP</span></div></div>' +
    '<div class="pnb">' + (got.length ? got.slice(0, 6).map(b => '<a href="#conquistas" class="pnb-i" title="' + esc(b.t + ' · ' + bTierName(b, B[b.id].l)) + '">' + badgeSvg(b.id, B[b.id].l, 50) + '</a>').join('') : '') + '</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span class="muted" style="font-size:13.5px">' + T.nb + ' de ' + BADGES.length + ' insígnias</span><a class="btn small" href="#conquistas">Ver conquistas</a></div>';
}
let CQF = 'all', CQKEY = '', CQSEEN = false;
function renderConquistas(force) {
  store.set('bdgNew', false);
  const key = dataKey() + ':' + JSON.stringify(store.get('bdg', {})) + ':' + CQF + ':' + (GP.ready ? 1 : 0);
  if (!force && key === CQKEY && $('#cqGrid').childElementCount) return;
  CQKEY = key;
  const grid = $('#cqGrid'); if (!CQSEEN) { CQSEEN = true; grid.classList.add('anim'); setTimeout(() => grid.classList.remove('anim'), 1800); }
  const dot = document.querySelector('[data-v="conquistas"] .nb-dot'); if (dot) dot.hidden = true;
  const X = BSTAT = badgeStats(), B = store.get('bdg', {}), T = badgeTotals(B), R = RANKS[T.rank.i];
  const P = BADGES.map(b => ({ b, p: badgeProgress(b, X), got: Math.min(B[b.id] ? B[b.id].l : 0, bMax(b)) }));
  // prestígio
  const nextName = T.rank.i < RANKS.length - 1 ? RANKS[T.rank.i + 1].n : 'Promoção ' + roman(T.rank.promo + 1);
  $('#cqHero').innerHTML = '<div class="cq-hero-in"><div class="cq-emb">' + rankSvg(T.rank, 132) + '</div><div class="stack" style="gap:6px;min-width:0;flex:1"><span class="label">Prestígio</span><h2 class="cq-rank">' + esc(rankName(T.rank)) + '</h2><p class="muted" style="font-size:14px">' + esc(R.d) + '</p>' +
    '<div class="bbar lg"><i style="transform:scaleX(' + T.rank.f.toFixed(3) + ')"></i></div><span class="mono muted" style="font-size:12.5px">' + fmtXp(T.xp) + ' XP · faltam ' + fmtXp(Math.max(0, T.rank.next - T.xp)) + ' para ' + esc(nextName) + '</span></div></div>' +
    '<div class="cq-ladder" role="list" aria-label="Escada de prestígio">' + RANKS.map((r, i) => '<div class="cq-step' + (i < T.rank.i ? ' done' : i === T.rank.i ? ' cur' : '') + '" role="listitem">' + rankSvg({ i, promo: 0 }, 46, i > T.rank.i) + '<span>' + r.n + '</span><span class="mono">' + fmtXp(r.xp) + '</span></div>').join('') + '</div>' +
    '<div class="cq-stats"><div><b>' + T.nb + '<small>/' + BADGES.length + '</small></b><span>insígnias</span></div><div><b>' + T.lv + '<small>/' + T.maxLv + '</small></b><span>níveis</span></div><div><b>' + T.rare + '<small>/' + BADGES.filter(b => b.rare).length + '</small></b><span>raras</span></div><div><b>' + fmtXp(T.xp) + '</b><span>XP</span></div></div>';
  // quase lá
  const near = P.filter(x => x.p.l < bMax(x.b) && x.p.f > 0 && !x.b.rare).sort((a, b) => b.p.f - a.p.f).slice(0, 4);
  $('#cqNext').innerHTML = near.length ? '<h2 class="h-card">Quase lá</h2><div class="cq-near">' + near.map(x => '<button type="button" class="cq-n" data-cqgo="' + x.b.id + '">' + badgeSvg(x.b.id, x.p.l + 1, 52, 'ghost') + '<div class="stack" style="gap:3px;min-width:0;flex:1;text-align:left"><b>' + esc(x.b.t) + ' · ' + TIERS[x.p.l].n + '</b><div class="bbar sm"><i style="transform:scaleX(' + x.p.f.toFixed(3) + ')"></i></div><span class="muted mono" style="font-size:12px">' + fmtXp(Math.round(x.p.v)) + ' / ' + fmtXp(x.p.next) + ' · +' + TIERS[x.p.l].xp + ' XP</span></div></button>').join('') + '</div>' : '';
  // filtro e grade
  $$('#cqFilter button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cqf === CQF)));
  const keep = x => CQF === 'all' || (CQF === 'got' ? x.got > 0 : x.got < bMax(x.b));
  $('#cqGrid').innerHTML = BCATS.map(cat => {
    const items = P.filter(x => x.b.cat === cat.id && keep(x)); if (!items.length) return '';
    const n = P.filter(x => x.b.cat === cat.id && x.got).length, all = P.filter(x => x.b.cat === cat.id).length;
    return '<section class="stack" style="gap:10px"><div class="cq-cat"><h2 class="h-card">' + cat.n + '</h2><span class="muted">' + n + ' de ' + all + ' · ' + esc(cat.d) + '</span></div><div class="cq-grid">' + items.map((x, i) => cqCard(x, B, i)).join('') + '</div></section>';
  }).join('') || '<p class="muted">Nada aqui ainda.</p>';
}
function cqCard(x, B, i) {
  const { b, p, got } = x, max = bMax(b), lv = bLv(b);
  const tiers = b.rare ? '<span class="' + (got ? 'ok' : '') + '">' + (got ? '✓ ' : '') + esc(b.d()) + ' · +' + RARE_XP + ' XP' + (got && B[b.id] ? ' · ' + dateLabel(Math.floor(B[b.id].t / 1000)) : '') + '</span>'
    : lv.map((t, i) => '<span class="' + (got > i ? 'ok' : '') + '"><b>' + TIERS[i].n + '</b> ' + esc(b.d(t)) + ' · +' + TIERS[i].xp + ' XP</span>').join('');
  return '<button type="button" class="cq' + (got ? ' got' : '') + (b.rare ? ' rare' : '') + (got >= max ? ' max' : '') + '" data-cq="' + b.id + '" id="cq-' + b.id + '" aria-expanded="false" style="--i:' + (i || 0) + '"' + ((i || 0) < 10 ? ' data-a' : '') + '><span class="cq-b ' + tierCls(b, got) + '">' + badgeSvg(b.id, got, 88) + '</span>' +
    '<b>' + esc(b.t) + '</b><span class="cq-t">' + (got ? bTierName(b, got) + (b.rare ? '' : ' · ' + ROMAN[got - 1]) : 'Bloqueada') + '</span>' +
    (got < max ? '<div class="bbar sm"><i style="transform:scaleX(' + p.f.toFixed(3) + ')"></i></div><span class="muted cq-d">' + esc(b.rare ? b.d() : b.d(p.next)) + (b.rare ? '' : ' · <span class="mono">' + fmtXp(Math.min(Math.round(p.v), p.next)) + '/' + fmtXp(p.next) + '</span>') + '</span>' : '<span class="muted cq-d">' + (b.rare ? esc(b.d()) : 'Todos os níveis conquistados') + '</span>') +
    '<span class="cq-more"><span class="cq-in">' + tiers + '</span></span><i class="cq-sh" aria-hidden="true"></i></button>';
}
document.addEventListener('click', e => {
  if (!e.target.closest) return;
  if (e.target.closest('[data-go-cq]')) { location.hash = 'conquistas'; return; }
  const f = e.target.closest('[data-cqf]'); if (f) { CQF = f.dataset.cqf; renderConquistas(); return; }
  const g = e.target.closest('[data-cqgo]'); if (g) {
    if (CQF !== 'all') { CQF = 'all'; renderConquistas(); }
    const c = $('#cq-' + g.dataset.cqgo); if (!c) return;
    $$('#cqGrid .cq.open').forEach(o => { if (o !== c) { o.classList.remove('open'); o.setAttribute('aria-expanded', 'false'); } });
    c.classList.add('open', 'flash'); c.setAttribute('aria-expanded', 'true');
    c.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    setTimeout(() => c.classList.remove('flash'), 1200); return;
  }
  const c = e.target.closest('[data-cq]'); if (!c) return;
  const on = c.getAttribute('aria-expanded') !== 'true'; c.setAttribute('aria-expanded', String(on)); c.classList.toggle('open', on);
});

// inclinação suave e reflexo que acompanham o ponteiro (só com mouse ou caneta)
let CQTILT = null;
document.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch' || S.view !== 'conquistas') return;
  const c = e.target.closest && e.target.closest('.cq');
  if (CQTILT && CQTILT !== c) { CQTILT.style.removeProperty('--rx'); CQTILT.style.removeProperty('--ry'); CQTILT.classList.remove('tilt'); CQTILT = null; }
  if (!c || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  c.style.setProperty('--rx', ((.5 - y) * 7).toFixed(2) + 'deg'); c.style.setProperty('--ry', ((x - .5) * 9).toFixed(2) + 'deg');
  c.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); c.style.setProperty('--my', (y * 100).toFixed(1) + '%');
  c.classList.add('tilt'); CQTILT = c;
}, { passive: true });

/* ---------- Desafios da semana ----------
   Três missões por semana (segunda a domingo), sorteadas com uma semente fixa da semana,
   uma de partidas, uma de treino e uma de hábito. O progresso é calculado dos dados;
   cada desafio vale 60 XP e completar os três dá mais 60. */
const WK_XP = 60, WK_BONUS = 60;
function weekStart(d) { const x = new Date(d || Date.now()); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
const weekKey = d => dayKey(weekStart(d));
function wkDays(ws) { const out = []; for (let i = 0; i < 7; i++) { const d = new Date(ws); d.setDate(d.getDate() + i); out.push(dayKey(d)); } return out; }
function seeded(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
// contexto da semana: o que aconteceu desde segunda
function wkCtx(ws) {
  const t0 = ws.getTime() / 1000, days = wkDays(ws), act = store.get('act', {}), daily = store.get('daily', {});
  const G = S.games.filter(g => g.end >= t0), tot = k => days.reduce((s, d) => s + ((act[d] || {})[k] || 0), 0);
  const top = AGG && AGG.openings && AGG.openings[0];
  const C = {
    G, wins: G.filter(g => rk(g) === 'W'),
    solved: days.reduce((s, d) => s + (daily[d] || 0), 0), goalDays: days.filter(d => (daily[d] || 0) >= GOAL).length,
    rush: Math.max(0, ...(store.get('rushLog', []).filter(x => x.t >= t0 * 1000).map(x => x.ok))),
    cand: tot('cand'), rep: tot('rep'), punish: tot('punish'), spot: tot('spot'),
    self: Object.values(store.get('self', {})).filter(x => x.t >= t0 * 1000).length,
    top
  };
  C.analyzed = G.filter(g => S.an[g.id]).length;
  return C;
}
// cada modelo: categoria, meta (pode depender do histórico), texto, progresso, ícone, onde fazer
const WK_POOL = [
  { id: 'vitorias', cat: 'jogo', ic: 'trofeu', goal: () => { const t = Date.now() / 1000 - 56 * 86400, w = S.games.filter(g => g.end >= t && rk(g) === 'W').length / 8; return Math.max(3, Math.min(15, Math.round(w * .6))); }, t: n => 'Vença ' + n + ' partidas', v: C => C.wins.length },
  { id: 'abertura', cat: 'jogo', ic: 'chave', when: C => !!C.top, goal: () => 2, t: (n, C) => 'Vença ' + n + ' com ' + opName({ op: C.top.name }) + ' (' + (C.top.color === 'w' ? 'brancas' : 'pretas') + ')', v: C => C.wins.filter(g => g.c === C.top.color && opName(g) === opName({ op: C.top.name })).length },
  { id: 'pretas', cat: 'jogo', ic: 'yin', goal: () => 3, t: n => 'Vença ' + n + ' partidas de pretas', v: C => C.wins.filter(g => g.c === 'b').length },
  { id: 'mate', cat: 'jogo', ic: 'p:king', goal: () => 1, t: () => 'Vença uma partida por xeque-mate', v: C => C.wins.filter(g => g.oRes === 'checkmated').length },
  { id: 'limpa', cat: 'jogo', ic: 'escudook', goal: () => 2, t: n => 'Jogue ' + n + ' partidas analisadas sem capivarada', v: C => C.G.filter(g => { const P = S.an[g.id] && prepIf(g); return P && P.cls && !P.cls.some((c, i) => P.moves[i].color === g.c && c.k === 'blunder'); }).length },
  { id: 'precisao', cat: 'jogo', ic: 'mira', goal: () => 1, t: () => 'Termine uma partida analisada com 85% de precisão', v: C => C.G.filter(g => { const P = S.an[g.id] && prepIf(g); return P && P.acc && P.acc[g.c] >= 85; }).length },
  { id: 'exercicios', cat: 'treino', ic: 'alvo', goal: () => 30, t: n => 'Resolva ' + n + ' exercícios', v: C => C.solved, go: 'data-pz="mine"' },
  { id: 'corrida', cat: 'treino', ic: 'raio', goal: () => Math.max(8, Math.min(25, (store.get('rbest', 0) || 6) + 2)), t: n => 'Faça ' + n + ' acertos numa Corrida', v: C => C.rush, go: 'data-pz="timed"' },
  { id: 'candidatos', cat: 'treino', ic: 'garfo', goal: () => 2, t: n => 'Complete ' + n + ' rodadas de Lances candidatos', v: C => C.cand, go: 'data-ar="open:cand"' },
  { id: 'castigo', cat: 'treino', ic: 'martelo', goal: () => 8, t: n => 'Puna ' + n + ' erros no modo Puna o erro', v: C => C.punish, go: 'data-pz="punish"' },
  { id: 'detetive', cat: 'treino', ic: 'detetive', goal: () => 2, t: n => 'Complete ' + n + ' rodadas de Ache o erro', v: C => C.spot, go: 'data-ar="open:spot"' },
  { id: 'repertorio', cat: 'treino', ic: 'livro', goal: () => 20, t: n => 'Revise ' + n + ' posições do repertório', v: C => C.rep, go: 'data-ar="open:rep"' },
  { id: 'meta', cat: 'habito', ic: 'calendario', goal: () => 4, t: n => 'Bata a meta diária em ' + n + ' dias', v: C => C.goalDays, go: 'data-pz="mine"' },
  { id: 'voceprimeiro', cat: 'habito', ic: 'olho', goal: () => 2, t: n => 'Faça o Você primeiro em ' + n + ' partidas', v: C => C.self, go: 'data-ar="open:self"' },
  { id: 'analise', cat: 'habito', ic: 'lupa', goal: () => 3, t: n => 'Analise ' + n + ' partidas desta semana', v: C => C.analyzed, go: 'href="#partidas"' }
];
let WKC = null;
function weekChallenges() {
  const ws = weekStart(), key = dayKey(ws) + ':' + (S.me || ''), C = wkCtx(ws);
  if (!WKC || WKC.key !== key) {
    const rnd = seeded(key), pick = [];
    for (const cat of ['jogo', 'treino', 'habito']) {
      const opts = WK_POOL.filter(x => x.cat === cat && (!x.when || x.when(C)));
      const it = opts[Math.floor(rnd() * opts.length)]; if (it) pick.push({ m: it, n: it.goal() });
    }
    WKC = { key, ws, pick };
  }
  return { ws, C, list: WKC.pick.map(({ m, n }) => { const v = Math.min(n, m.v(C) || 0); return { id: m.id, ic: m.ic, t: m.t(n, C), n, v, done: v >= n, go: m.go }; }) };
}
// XP vindo dos desafios: guardado por semana, para não perder o que já foi feito
function wkXp() { const H = store.get('wkHist', {}); let x = 0; for (const k in H) { const d = H[k] || 0; x += d * WK_XP + (d >= 3 ? WK_BONUS : 0); } return x; }
function wkCheck() {
  let W; try { W = weekChallenges(); } catch (e) { return []; }
  const H = store.get('wkHist', {}), k = dayKey(W.ws), done = W.list.filter(x => x.done).length, prev = H[k] || 0, fresh = [];
  if (done > prev) { H[k] = done; store.set('wkHist', H); W.list.filter(x => x.done).slice(prev).forEach(x => fresh.push({ wk: x, all: done >= 3 && prev < 3 })); }
  return fresh;
}
function weeklyHtml() {
  const W = weekChallenges(), done = W.list.filter(x => x.done).length;
  const end = new Date(W.ws); end.setDate(end.getDate() + 7); const left = Math.max(1, Math.ceil((end - Date.now()) / 864e5));
  return '<div class="wk-head"><div class="stack" style="gap:2px"><h2 class="h-card">Desafios da semana</h2><span class="muted" style="font-size:13px">' + done + ' de 3 · termina em ' + left + ' dia' + (left > 1 ? 's' : '') + ' · ' + WK_XP + ' XP cada, +' + WK_BONUS + ' pelos três</span></div><div class="wk-dots" aria-hidden="true">' + [0, 1, 2].map(i => '<i class="' + (i < done ? 'on' : '') + '"></i>').join('') + '</div></div>' +
    '<div class="wk-list">' + W.list.map(x => '<div class="wk-it' + (x.done ? ' done' : '') + '"><span class="wk-ic bd ' + (x.done ? 'bt3' : 'bt0') + '"><svg viewBox="0 0 64 64" width="44" height="44" aria-hidden="true"><circle class="disk" cx="32" cy="32" r="30"/>' + glyph(x.ic, 14, 14, 36) + '</svg></span>' +
      '<div class="stack" style="gap:5px;min-width:0;flex:1"><b>' + esc(x.t) + '</b><div class="bbar sm"><i style="transform:scaleX(' + (x.v / x.n).toFixed(3) + ')"></i></div><span class="muted mono" style="font-size:12px">' + x.v + ' / ' + x.n + (x.done ? ' · feito' : '') + '</span></div>' +
      (x.done ? '<span class="wk-ok" aria-label="Feito">✓</span>' : x.go ? (x.go.startsWith('href') ? '<a class="btn small" ' + x.go + '>Ir</a>' : '<button class="btn small" type="button" ' + x.go + '>Ir</button>') : '') + '</div>').join('') + '</div>';
}

function refreshWeekly() { const w = $('#pnWeekly'); if (w && S.view === 'painel') w.innerHTML = weeklyHtml(); }
