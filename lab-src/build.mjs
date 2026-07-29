// Assembles lab-src/* plus the extracted specimens into one standalone
// style-lab.html at the repo root. Run: node lab-src/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULTS } from './contract.js';
import A from './styles-a.js';
import B from './styles-b.js';
import C from './styles-c.js';
import D from './styles-d.js';
import E from './styles-e.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const read = (p) => readFileSync(join(HERE, p), 'utf8');

const STYLES = [...A, ...B, ...C, ...D, ...E];

// ── validation: a broken style is worse than a missing one ──────────
const problems = [];
const names = new Set();
const VALID = {
  h2: ['plain', 'rule-over', 'rule-under', 'band', 'numbered', 'outdent', 'caps', 'kicker', 'evatitle'],
  sect: ['none', 'bar', 'cutin', 'plate', 'monolith'],
  part: ['none', 'kanji', 'eva', 'seele'],
  link: ['underline', 'thick', 'mark', 'bracket', 'weight', 'dotted'],
  code: ['flat', 'framed', 'inverted', 'ruled', 'tinted'],
  quote: ['indent', 'rule', 'oversize', 'ground', 'caps'],
  img: ['raw', 'framed', 'matte', 'dim', 'invert-hint'],
  toc: ['list', 'rail', 'boxed', 'inline', 'numbered', 'spine'],
  table: ['rules', 'zebra', 'boxed', 'minimal'],
  mark: ['none', 'monogram'],
};
STYLES.forEach((s, i) => {
  const at = `#${i + 1} ${s.name}`;
  if (names.has(s.name)) problems.push(`${at}: duplicate name`);
  names.add(s.name);
  for (const k of ['name', 'group', 'mood', 'thesis', 'fonts', 'weights', 'v', 'x']) {
    if (!s[k]) problems.push(`${at}: missing ${k}`);
  }
  if (!['dark', 'light'].includes(s.mood)) problems.push(`${at}: bad mood ${s.mood}`);
  for (const [k, allowed] of Object.entries(VALID)) {
    const v = s.x?.[k] ?? DEFAULTS[k];
    if (!allowed.includes(v)) problems.push(`${at}: bad ${k} treatment "${v}"`);
  }
  // A cut-in style without a third ground would fall back to the page colour
  // and silently lose the alternation that defines it.
  if (['cutin', 'plate'].includes(s.x?.sect) && !s.v?.plate) {
    problems.push(`${at}: sect="${s.x.sect}" needs a plate ground`);
  }
  for (const k of Object.keys(s.v || {})) {
    if (!(k in DEFAULTS)) problems.push(`${at}: unknown token "${k}"`);
  }
  if (!s.fonts?.body || !s.fonts?.mono) problems.push(`${at}: fonts.body and fonts.mono are required`);
  const m = { ...DEFAULTS, ...s.v }.measure;
  if (m < 55 || m > 80) problems.push(`${at}: measure ${m}ch outside 55-80`);
});
if (STYLES.length < 100) problems.push(`expected at least 100 styles, got ${STYLES.length}`);
if (problems.length) {
  console.error('BUILD FAILED\n' + problems.map((p) => '  ' + p).join('\n'));
  process.exit(1);
}

const specimens = JSON.parse(readFileSync(join(ROOT, '.lab-build', 'specimens.json'), 'utf8'));

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>style lab</title>
<style>
${read('chrome.css')}
${read('skeleton.css')}
</style>
</head>
<body>

<div id="stage">
  <article id="spec" class="lab-article">
    <header class="lab-site">
      <span class="lab-site-mark" role="img" aria-label="Magistr"></span>
      <span class="lab-site-title">Magistr and Maps</span>
      <nav class="lab-site-nav"><span>Thoughts</span><span>About</span></nav>
    </header>
    <header class="lab-mast">
      <div class="lab-kicker" id="mast-kicker"></div>
      <h1 id="mast-title"></h1>
      <div class="lab-meta" id="mast-meta"></div>
    </header>
    <div id="body"></div>
  </article>
</div>

<div id="chrome">
  <button class="btn" id="prev" title="Previous style (left arrow)">‹</button>
  <button class="btn" id="next" title="Next style (right arrow)">›</button>
  <div class="cell"><span id="idx"></span></div>
  <div class="cell"><strong id="name"></strong><span id="group"></span></div>
  <div class="cell grow"><span id="thesis"></span></div>
  <div class="cell"><span id="fontline"></span></div>
  <button class="btn" id="sizebtn" title="Body size, 16 / 18 / 20 (b)">20px <kbd>b</kbd></button>
  <button class="btn" id="fav" title="Keep this one (f)" aria-pressed="false">◆ <kbd>f</kbd></button>
  <button class="btn" id="copy" title="Copy this style's token block (c)">copy <kbd>c</kbd></button>
  <button class="btn" id="docbtn" title="Switch specimen (s)"><span id="doc"></span> <kbd>s</kbd></button>
  <button class="btn" id="sheetbtn" title="Every style at once (g)">all ${STYLES.length} <kbd>g</kbd></button>
  <button class="btn" id="helpbtn" title="Keys (?)"><kbd>?</kbd></button>
</div>

<div id="sheet">
  <div id="sheethead">
    <h2>All ${STYLES.length}</h2>
    <span class="hint">Click to jump. Fonts load as tiles scroll into view.</span>
    <div id="filters">
      <button class="chip" data-f="all" aria-pressed="true">all</button>
      <button class="chip" data-f="dark">dark</button>
      <button class="chip" data-f="light">light</button>
      <button class="chip" data-f="fav">kept</button>
      <button class="chip" id="exportfavs">copy kept</button>
      <button class="chip" id="closesheet">close</button>
    </div>
  </div>
  <div id="grid"></div>
</div>

<div id="help">
  <div class="panel">
    <h3>Keys</h3>
    <dl>
      <dt>← →</dt><dd>step one style</dd>
      <dt>↑ ↓</dt><dd>jump ten</dd>
      <dt>1-${STYLES.length}</dt><dd>type a number to go there</dd>
      <dt>g</dt><dd>every style as tiles</dd>
      <dt>f</dt><dd>keep / drop this one</dd>
      <dt>c</dt><dd>copy this style's token block</dd>
      <dt>e</dt><dd>copy every kept style</dd>
      <dt>b</dt><dd>body size 16 / 18 / 20 (shift reverses)</dd>
      <dt>s</dt><dd>swap specimen post</dd>
      <dt>r</dt><dd>random</dd>
      <dt>t</dt><dd>back to top</dd>
      <dt>esc</dt><dd>close</dd>
    </dl>
  </div>
</div>

<div id="toast"></div>

<script>
const DEFAULTS = ${JSON.stringify(DEFAULTS)};
const STYLES = ${JSON.stringify(STYLES)};
const SPECIMENS = ${JSON.stringify(specimens)};
</script>
<script>
${read('lab.js')}
</script>
</body>
</html>
`;

const out = join(ROOT, 'style-lab.html');
writeFileSync(out, html);

const fonts = new Set();
STYLES.forEach((s) => Object.values(s.fonts).forEach((f) => f && fonts.add(f)));
const groups = [...new Set(STYLES.map((s) => s.group))];
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)}KB)`);
console.log(`${STYLES.length} styles · ${STYLES.filter((s) => s.mood === 'dark').length} dark / ${STYLES.filter((s) => s.mood === 'light').length} light`);
console.log(`${fonts.size} typefaces · ${groups.length} groups: ${groups.join(', ')}`);
