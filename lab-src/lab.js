/* eslint-env browser */
// STYLES, SPECIMENS and DEFAULTS are injected above this file by build.mjs.

const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const spec = $('#spec');

// Treatments added after the first 100 were written; older styles omit them.
const DEFAULT_X = { sect: 'none', part: 'none', mark: 'none' };

const LS = { fav: 'lab.favs', last: 'lab.last', doc: 'lab.doc', size: 'lab.size' };
const favs = new Set(JSON.parse(localStorage.getItem(LS.fav) || '[]'));

// Base size is set for the whole lab, not per style: comparing 100 designs only
// works if they are all set at the same size.
const SIZES = [16, 18, 20];
let size = Number(localStorage.getItem(LS.size)) || DEFAULTS.size;
if (!SIZES.includes(size)) size = DEFAULTS.size;

let cur = 0;
let docIdx = Number(localStorage.getItem(LS.doc) || 0);
let sheetOpen = false;
let filter = 'all';

// ── fonts ───────────────────────────────────────────────────────────
// 100 styles reach for more families than any page should load at once, so
// each style's fonts are fetched the first time it is shown and never again.
const slug = (f) => f.toLowerCase().replace(/\s+/g, '-');
const loaded = new Set();

function fontHref(st) {
  const want = new Map();
  const add = (fam, w) => {
    if (!fam) return;
    const k = slug(fam);
    const prev = want.get(k);
    // Union the weights when one family fills several roles.
    want.set(k, prev ? [...new Set([...prev.split(','), ...w.split(',')])].sort().join(',') : w);
  };
  add(st.fonts.body, st.weights.body);
  add(st.fonts.display, st.weights.display);
  // The label font is its own role: a condensed grotesque used for micro-type
  // rarely ships the display weight, so it carries its own request.
  add(st.fonts.label, st.weights.label || st.weights.display);
  add(st.fonts.mono, st.weights.mono);
  const fam = [...want].map(([k, w]) => `${k}:${w}`).join('|');
  return `https://fonts.bunny.net/css?family=${fam}&display=swap`;
}

function loadFonts(st) {
  const href = fontHref(st);
  if (loaded.has(href)) return;
  loaded.add(href);
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = href;
  document.head.appendChild(l);
}

// ── applying a style ────────────────────────────────────────────────
const CAMEL_TO_VAR = (k) => '--' + k;

function tokens(st) {
  return { ...DEFAULTS, ...st.v };
}

function apply(i, { push = true } = {}) {
  cur = (i + STYLES.length) % STYLES.length;
  const st = STYLES[cur];
  const t = tokens(st);

  loadFonts(st);

  const s = stage.style;
  for (const [k, v] of Object.entries(t)) {
    if (v === null || v === undefined || typeof v === 'boolean') continue;
    s.setProperty(CAMEL_TO_VAR(k), String(v));
  }
  // Nulled tokens must be cleared, or the previous style's value survives.
  for (const [k, v] of Object.entries(t)) {
    if (v === null || v === undefined) s.removeProperty(CAMEL_TO_VAR(k));
  }
  s.setProperty('--size', String(size)); // lab-wide, overrides the style's token
  s.setProperty('--fontBody', `'${st.fonts.body}'`);
  s.setProperty('--fontDisplay', `'${st.fonts.display || st.fonts.body}'`);
  s.setProperty('--fontMono', `'${st.fonts.mono}'`);
  s.setProperty('--fontLabel', `'${st.fonts.label || st.fonts.display || st.fonts.body}'`);

  const x = st.x;
  for (const key of ['h2', 'sect', 'part', 'link', 'code', 'quote', 'img', 'toc', 'table', 'mark']) {
    spec.setAttribute('data-' + key, x[key] ?? DEFAULT_X[key]);
  }
  // The spine reserves a column by padding the stage, which sits above the
  // article, so the stage has to see the treatment too.
  stage.setAttribute('data-toc', x.toc);
  // Each language stamps its sections differently: the landing uses daiji
  // parts, Eva uses episode numbers, SEELE uses the committee plates.
  const mark = {
    kanji: (n, path) => [`其ノ${daiji(n)}`, path],
    eva: (n, path) => [`第${daiji(n)}話`, path],
    seele: (n) => [`SEELE ${String(n).padStart(2, '0')}`, 'sound only'],
  }[x.part];
  spec.querySelectorAll('.lab-sect').forEach((s) => {
    if (!mark) return;
    const [a, b] = mark(Number(s.dataset.n), s.dataset.path);
    s.querySelector('.lab-part i').textContent = a;
    s.querySelector('.lab-part span').textContent = b;
  });
  spec.setAttribute('data-bleed', String(!!t.bleed));

  // The author numbers his own section headings ("## 3. Nvidia, mapped").
  // Treatments that supply their own numbering would render "03 3. Nvidia",
  // which reads as a bug in the design rather than a clash in the content, so
  // the manual number is hidden for exactly those treatments and restored
  // everywhere else.
  const strip = (el, on) => {
    if (el.dataset.orig === undefined) el.dataset.orig = el.innerHTML;
    el.innerHTML = on ? el.dataset.orig.replace(/^\s*\d+[.)]\s+/, '') : el.dataset.orig;
  };
  spec.querySelectorAll('#body h2').forEach((h) => strip(h, x.h2 === 'numbered'));
  spec.querySelectorAll('.lab-toc > ul > li > a').forEach((a) => strip(a, x.toc === 'numbered'));

  // chrome
  $('#idx').innerHTML = `<b>${String(cur + 1).padStart(3, '0')}</b>/${STYLES.length}`;
  $('#name').textContent = st.name;
  const g = $('#group');
  g.textContent = st.group;
  g.dataset.mood = st.mood;
  $('#thesis').textContent = st.thesis;
  const fam = [st.fonts.display || st.fonts.body, st.fonts.body, st.fonts.mono];
  $('#fontline').textContent = `${[...new Set(fam)].join(' / ')} · ${size}px · ${t.measure}ch · ${t.lh}`;
  $('#sizebtn').firstChild.textContent = `${size}px `;
  $('#fav').classList.toggle('on', favs.has(st.name));
  $('#fav').setAttribute('aria-pressed', String(favs.has(st.name)));
  document.title = `${String(cur + 1).padStart(3, '0')} ${st.name} — style lab`;

  localStorage.setItem(LS.last, String(cur));
  if (push) history.replaceState(null, '', `#${cur + 1}`);
  $('#grid').querySelectorAll('.tile').forEach((el) => {
    el.classList.toggle('current', Number(el.dataset.i) === cur);
  });
}

// ── sections ────────────────────────────────────────────────────────
// Hugo emits a flat run of h2 / p / ul. The cut-in treatments need each
// section to be one element so it can own a ground, so group every h2 with the
// content that follows it. Content before the first h2 is the standfirst and
// stays outside, exactly as the landing keeps its masthead separate.

// 其ノ壹 … the daiji numerals the anifilias landing stamps on each card.
const DAIJI = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖', '拾'];
const daiji = (n) => (n <= 10 ? DAIJI[n] : n < 20 ? '拾' + DAIJI[n - 10] : String(n));

function wrapSections() {
  const body = $('#body');
  const kids = [...body.children];
  let sect = null;
  let n = 0;
  for (const el of kids) {
    if (el.tagName === 'H2') {
      sect = document.createElement('section');
      // g* drives the three-ground cut-in, p* the two-ground alternation.
      // A two-ground pattern cannot ride the n%3 cycle: it would land
      // page / plate / page / page / plate and read as an irregularity.
      sect.className = `lab-sect g${n % 3} p${n % 2}`;
      n += 1;
      sect.dataset.n = String(n);
      sect.dataset.path = (el.textContent || '')
        .toLowerCase()
        .replace(/^\s*\d+[.)]\s*/, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 34);
      el.replaceWith(sect);
      const part = document.createElement('div');
      part.className = 'lab-part';
      part.innerHTML = '<i></i><span></span>';
      sect.appendChild(part);
      sect.appendChild(el);
    } else if (sect) {
      sect.appendChild(el);
    }
  }
}

// ── specimen switching ──────────────────────────────────────────────
function renderDoc() {
  const d = SPECIMENS[docIdx];
  $('#mast-title').textContent = d.title;
  $('#mast-kicker').textContent = d.label;
  $('#mast-meta').innerHTML =
    `<span>${d.date.slice(0, 10)}</span><span>${d.note}</span><span>${d.tags.slice(0, 3).join(' · ')}</span>`;
  $('#body').innerHTML = d.body;
  wrapSections();
  // Give wide tables their own scroll container so the page never scrolls sideways.
  $('#body').querySelectorAll('table').forEach((tb) => {
    if (tb.parentElement.classList.contains('lab-tablewrap')) return;
    const w = document.createElement('div');
    w.className = 'lab-tablewrap';
    tb.replaceWith(w);
    w.appendChild(tb);
  });
  $('#doc').textContent = d.label;
  localStorage.setItem(LS.doc, String(docIdx));
}

// ── contact sheet ───────────────────────────────────────────────────
function buildSheet() {
  const grid = $('#grid');
  grid.innerHTML = '';
  STYLES.forEach((st, i) => {
    const t = tokens(st);
    const b = document.createElement('button');
    b.className = 'tile';
    b.dataset.i = String(i);
    b.dataset.mood = st.mood;
    b.dataset.group = st.group;
    b.dataset.fav = String(favs.has(st.name));
    b.style.setProperty('--tp', t.page);
    b.style.setProperty('--ti', t.ink);
    b.style.setProperty('--ts', t.strong || t.ink);
    b.style.setProperty('--ta', t.accent);
    b.style.setProperty('--tai', t.accentInk);
    b.title = `${st.name} — ${st.thesis}`;
    const band = st.x.h2 === 'band';
    b.innerHTML =
      `<div class="mini" style="font-family:'${st.fonts.display || st.fonts.body}',sans-serif">` +
      (band ? `<span class="mb">SECTION HEAD</span>` : `<div class="mh">Section head</div>`) +
      `<div class="ml"></div><div class="ml"></div><div class="ml s"></div>` +
      `<div class="mr"></div>` +
      `<div class="ml"></div><div class="ml"></div><div class="ml s"></div>` +
      `</div>` +
      (favs.has(st.name) ? `<span class="star">◆</span>` : '') +
      `<span class="tn"><span>${st.name}</span><i>${String(i + 1).padStart(3, '0')}</i></span>`;
    b.addEventListener('click', () => {
      apply(i);
      closeSheet();
    });
    grid.appendChild(b);
  });
  // Tiles only pull their webfonts once they are actually on screen.
  const io = new IntersectionObserver(
    (entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        loadFonts(STYLES[Number(e.target.dataset.i)]);
        obs.unobserve(e.target);
      }
    },
    { rootMargin: '300px' },
  );
  grid.querySelectorAll('.tile').forEach((el) => io.observe(el));
  applyFilter();
}

function applyFilter() {
  $('#grid')
    .querySelectorAll('.tile')
    .forEach((el) => {
      const ok =
        filter === 'all' ||
        (filter === 'fav' && el.dataset.fav === 'true') ||
        filter === el.dataset.mood;
      el.style.display = ok ? '' : 'none';
    });
  $('#filters')
    .querySelectorAll('.chip')
    .forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.f === filter)));
}

function openSheet() {
  sheetOpen = true;
  $('#sheet').classList.add('open');
  $('#grid').querySelector(`.tile[data-i="${cur}"]`)?.scrollIntoView({ block: 'center' });
}
function closeSheet() {
  sheetOpen = false;
  $('#sheet').classList.remove('open');
}

// ── favourites and export ───────────────────────────────────────────
function toggleFav() {
  const n = STYLES[cur].name;
  favs.has(n) ? favs.delete(n) : favs.add(n);
  localStorage.setItem(LS.fav, JSON.stringify([...favs]));
  apply(cur, { push: false });
  const tile = $('#grid').querySelector(`.tile[data-i="${cur}"]`);
  if (tile) {
    tile.dataset.fav = String(favs.has(n));
    tile.querySelector('.star')?.remove();
    if (favs.has(n)) {
      const s = document.createElement('span');
      s.className = 'star';
      s.textContent = '◆';
      tile.appendChild(s);
    }
    applyFilter();
  }
  toast(favs.has(n) ? `Kept ${n}` : `Dropped ${n}`);
}

function exportCss(st) {
  const t = tokens(st);
  const lines = Object.entries(t)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'boolean')
    .map(([k, v]) => `  --${k}: ${v};`);
  return (
    `/* ${String(STYLES.indexOf(st) + 1).padStart(3, '0')} — ${st.name} (${st.group}, ${st.mood})\n` +
    `   ${st.thesis}\n` +
    `   fonts: ${fontHref(st)} */\n` +
    `:root {\n` +
    `  --fontBody: '${st.fonts.body}';\n` +
    `  --fontDisplay: '${st.fonts.display || st.fonts.body}';\n` +
    `  --fontMono: '${st.fonts.mono}';\n` +
    `  --fontLabel: '${st.fonts.label || st.fonts.display || st.fonts.body}';\n` +
    lines.join('\n') +
    `\n  --bleed: ${t.bleed};\n}\n` +
    `/* treatments */\n` +
    Object.entries(st.x)
      .map(([k, v]) => `[data-${k}="${v}"]`)
      .join('\n') +
    '\n'
  );
}

function copyTokens() {
  const css = exportCss(STYLES[cur]);
  navigator.clipboard.writeText(css).then(
    () => toast('Token block copied'),
    () => toast('Clipboard blocked; see console'),
  );
  console.log(css);
}

function exportFavs() {
  if (!favs.size) return toast('No favourites yet');
  const out = STYLES.filter((s) => favs.has(s.name)).map(exportCss).join('\n');
  navigator.clipboard.writeText(out).then(
    () => toast(`${favs.size} favourite${favs.size > 1 ? 's' : ''} copied`),
    () => toast('Clipboard blocked; see console'),
  );
  console.log(out);
}

function cycleSize(dir = 1) {
  size = SIZES[(SIZES.indexOf(size) + dir + SIZES.length) % SIZES.length];
  localStorage.setItem(LS.size, String(size));
  apply(cur, { push: false });
  toast(`Body ${size}px`);
}

let toastT;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), 1600);
}

// ── keyboard ────────────────────────────────────────────────────────
let jump = '';
let jumpT;
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;

  if (k === 'Escape') {
    if ($('#help').classList.contains('open')) return $('#help').classList.remove('open');
    if (sheetOpen) return closeSheet();
    return;
  }
  if (k >= '0' && k <= '9') {
    jump += k;
    clearTimeout(jumpT);
    jumpT = setTimeout(() => {
      const n = parseInt(jump, 10);
      jump = '';
      if (n >= 1 && n <= STYLES.length) {
        apply(n - 1);
        closeSheet();
      }
    }, 420);
    return;
  }

  switch (k) {
    case 'ArrowRight': case 'j': apply(cur + 1); e.preventDefault(); break;
    case 'ArrowLeft': case 'k': apply(cur - 1); e.preventDefault(); break;
    case 'ArrowDown': apply(cur + 10); e.preventDefault(); break;
    case 'ArrowUp': apply(cur - 10); e.preventDefault(); break;
    case 'g': sheetOpen ? closeSheet() : openSheet(); break;
    case 'f': toggleFav(); break;
    case 'c': copyTokens(); break;
    case 'e': exportFavs(); break;
    case 'r': apply(Math.floor(Math.random() * STYLES.length)); break;
    case 'b': cycleSize(e.shiftKey ? -1 : 1); break;
    case 's':
      docIdx = (docIdx + 1) % SPECIMENS.length;
      renderDoc();
      apply(cur, { push: false });
      scrollTo({ top: 0 });
      break;
    case 't': scrollTo({ top: 0, behavior: 'smooth' }); break;
    case '?': case '/': $('#help').classList.toggle('open'); break;
  }
});

// ── wiring ──────────────────────────────────────────────────────────
$('#prev').addEventListener('click', () => apply(cur - 1));
$('#next').addEventListener('click', () => apply(cur + 1));
$('#fav').addEventListener('click', toggleFav);
$('#sizebtn').addEventListener('click', () => cycleSize(1));
$('#copy').addEventListener('click', copyTokens);
$('#sheetbtn').addEventListener('click', () => (sheetOpen ? closeSheet() : openSheet()));
$('#docbtn').addEventListener('click', () => {
  docIdx = (docIdx + 1) % SPECIMENS.length;
  renderDoc();
  apply(cur, { push: false });
  scrollTo({ top: 0 });
});
$('#helpbtn').addEventListener('click', () => $('#help').classList.toggle('open'));
$('#help').addEventListener('click', (e) => {
  if (e.target.id === 'help') $('#help').classList.remove('open');
});
$('#closesheet').addEventListener('click', closeSheet);
$('#exportfavs').addEventListener('click', exportFavs);
$('#filters').addEventListener('click', (e) => {
  const c = e.target.closest('.chip');
  if (!c) return;
  filter = c.dataset.f;
  applyFilter();
});

renderDoc();
buildSheet();
const fromHash = parseInt(location.hash.slice(1), 10);
apply(
  Number.isInteger(fromHash) && fromHash >= 1 && fromHash <= STYLES.length
    ? fromHash - 1
    : Number(localStorage.getItem(LS.last) || 0),
);
