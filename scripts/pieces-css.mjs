// Gera vendor/pieces-extra.css a partir das peças em vendor/pieces/<conjunto>/*.svg (licenças abertas, ver README).
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let css = '';
for (const set of ['merida', 'chessnut', 'fantasy', 'spatial']) {
  for (const c of 'wb') for (const p of 'PNBRQK') {
    const svg = fs.readFileSync(path.join(R, 'vendor/pieces', set, c + p + '.svg'));
    const u = 'url("data:image/svg+xml;base64,' + svg.toString('base64') + '")';
    css += ':root[data-pieces="' + set + '"] .pc.' + c + p.toLowerCase() + '{background-image:' + u + '}\n';
    if ((c + p) === 'wN' || (c + p) === 'bQ') css += '.sheet .sw .swp[data-pieces="' + set + '"] .pc.' + c + p.toLowerCase() + '{background-image:' + u + '}\n';
  }
}
// amostras do conjunto clássico (cburnett) para a tela de ajustes
const cb = fs.readFileSync(path.join(R, 'vendor/pieces-cburnett.css'), 'utf8');
for (const k of ['wn', 'bq']) { const m = cb.match(new RegExp('\\.pc\\.' + k + '\\s*\\{([^}]*)\\}')); if (m) css += '.sheet .sw .swp[data-pieces="classic"] .pc.' + k + '{' + m[1] + '}\n'; }
fs.writeFileSync(path.join(R, 'vendor/pieces-extra.css'), css);
console.log('ok', css.length);
