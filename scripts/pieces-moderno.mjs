// Conjunto original "Moderno" do Peão Passado: formas geométricas encorpadas com sombreado suave.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(R, 'vendor/pieces/moderno'); fs.mkdirSync(OUT, { recursive: true });

const base = (x0, x1) => '<path class="b" d="M' + (x0 + 4) + ' 80h' + (x1 - x0 - 8) + 'a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4H' + (x0 + 4) + 'a4 4 0 0 1-4-4v-3a4 4 0 0 1 4-4z"/>';
const SHAPES = {
  P: '<path class="b" d="M37 80c4-8 5-15 6-21h14c1 6 2 13 6 21z"/><ellipse class="b" cx="50" cy="58" rx="12" ry="4"/><circle class="b" cx="50" cy="41" r="11.5"/><ellipse class="h" cx="46" cy="36.5" rx="4.5" ry="3.2"/>',
  R: '<path class="b" d="M33 80l3-37h28l3 37z"/><path class="b" d="M28 23h10v7h6.5v-7h11v7H62v-7h10v17a3 3 0 0 1-3 3H31a3 3 0 0 1-3-3z"/><path class="l" d="M36 60h28"/><rect class="h" x="31" y="26" width="5" height="10" rx="2"/>',
  B: '<path class="b" d="M38 80c4-9 6-17 7-25h10c1 8 3 16 7 25z"/><ellipse class="b" cx="50" cy="54" rx="13" ry="4.5"/><path class="b" d="M50 17c12 11 17 21 13 31-2 4-24 4-26 0-4-10 1-20 13-31z"/><circle class="b" cx="50" cy="13" r="4.5"/><path class="l" d="M56 27l-9 12"/><ellipse class="h" cx="44" cy="33" rx="3" ry="6" transform="rotate(20 44 33)"/>',
  N: '<path class="b" d="M33 80c2-8 4-14 7-18-7-1-14-4-17-10-2-4 0-8 4-10l9-7c2-6 4-12 5-20l7 8c13 0 24 12 24 30 0 12-3 20-4 27z"/><circle class="e" cx="45" cy="33" r="2.6"/><path class="l" d="M58 30c6 6 8 14 7 24"/><path class="l" d="M27 50h5"/>',
  Q: '<path class="b" d="M33 80c5-9 7-17 8-23h18c1 6 3 14 8 23z"/><ellipse class="b" cx="50" cy="56" rx="17" ry="4.5"/><path class="b" d="M32 54L24 30l15 12 11-19 11 19 15-12-8 24z"/><circle class="b" cx="24" cy="29" r="4.5"/><circle class="b" cx="50" cy="21" r="4.5"/><circle class="b" cx="76" cy="29" r="4.5"/><ellipse class="h" cx="44" cy="40" rx="3" ry="5"/>',
  K: '<path class="b" d="M33 80c5-9 7-17 8-25h18c1 8 3 16 8 25z"/><ellipse class="b" cx="50" cy="54" rx="17" ry="4.5"/><path class="b" d="M33 51c-4-13 5-23 17-23s21 10 17 23z"/><path class="b" d="M46.5 7h7v7h6v7h-6v8h-7v-8h-6v-7h6z"/><ellipse class="h" cx="42" cy="38" rx="4" ry="5"/>'
};
const COL = {
  w: { a: '#ffffff', b: '#d9d3c5', s: '#2a2a2a', l: '#2a2a2a', h: 'rgba(255,255,255,.9)', e: '#2a2a2a' },
  b: { a: '#55595e', b: '#17191c', s: '#0b0c0d', l: 'rgba(255,255,255,.55)', h: 'rgba(255,255,255,.22)', e: '#f2efe7' }
};
for (const c of 'wb') for (const p of 'PRBNQK') {
  const k = COL[c], id = 'g' + c + p;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="' + k.a + '"/><stop offset="1" stop-color="' + k.b + '"/></linearGradient></defs>' +
    '<style>.b{fill:url(#' + id + ');stroke:' + k.s + ';stroke-width:3.2;stroke-linejoin:round}.l{fill:none;stroke:' + k.l + ';stroke-width:3;stroke-linecap:round}.h{fill:' + k.h + ';stroke:none}.e{fill:' + k.e + '}</style>' +
    '<ellipse cx="50" cy="91" rx="' + (p === 'P' ? 24 : 31) + '" ry="4" fill="rgba(0,0,0,.18)"/>' + (p === 'P' ? base(29, 71) : base(21, 79)) + SHAPES[p] + '</svg>';
  fs.writeFileSync(path.join(OUT, c + p + '.svg'), svg);
}
console.log('ok');
