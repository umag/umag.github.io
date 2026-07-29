// Cross-checks every family named by the 100 styles against the Bunny Fonts
// catalogue, and every requested weight against what that family ships.
// A font that silently falls back to Georgia makes a style a lie, so this
// runs as part of the build loop rather than being eyeballed in the browser.
import A from './styles-a.js';
import B from './styles-b.js';
import C from './styles-c.js';
import D from './styles-d.js';
import E from './styles-e.js';

const STYLES = [...A, ...B, ...C, ...D, ...E];
const slug = (f) => f.toLowerCase().replace(/\s+/g, '-');

const res = await fetch('https://fonts.bunny.net/list');
if (!res.ok) {
  console.error(`catalogue fetch failed: ${res.status}`);
  process.exit(2);
}
const list = await res.json();

const used = new Map(); // slug -> { name, weights:Set, styles:[] }
for (const s of STYLES) {
  const roles = [
    [s.fonts.body, s.weights.body],
    [s.fonts.display, s.weights.display],
    [s.fonts.label, s.weights.label || s.weights.display],
    [s.fonts.mono, s.weights.mono],
  ];
  for (const [fam, w] of roles) {
    if (!fam) continue;
    const k = slug(fam);
    if (!used.has(k)) used.set(k, { name: fam, weights: new Set(), styles: [] });
    const e = used.get(k);
    w.split(',').forEach((x) => e.weights.add(x.trim()));
    if (!e.styles.includes(s.name)) e.styles.push(s.name);
  }
}

const missing = [];
const badWeights = [];

for (const [k, e] of [...used].sort()) {
  const entry = list[k];
  if (!entry) {
    missing.push(`${e.name} (${k}) — used by: ${e.styles.join(', ')}`);
    continue;
  }
  const have = new Set(entry.weights.map(String));
  const haveItalic = (entry.styles || []).includes('italic');
  for (const w of e.weights) {
    const italic = w.endsWith('i');
    const num = italic ? w.slice(0, -1) : w;
    if (!have.has(num)) badWeights.push(`${e.name}: weight ${num} not available (has ${[...have].join(',')})`);
    else if (italic && !haveItalic) badWeights.push(`${e.name}: no italic cut, but ${w} requested`);
  }
}

console.log(`${used.size} families referenced by ${STYLES.length} styles`);
if (missing.length) {
  console.log(`\nNOT IN CATALOGUE (${missing.length}):`);
  missing.forEach((m) => console.log('  ' + m));
}
if (badWeights.length) {
  console.log(`\nWEIGHT MISMATCH (${badWeights.length}):`);
  [...new Set(badWeights)].forEach((m) => console.log('  ' + m));
}
if (!missing.length && !badWeights.length) console.log('all families and weights resolve');
process.exit(missing.length || badWeights.length ? 1 : 0);
