// The token contract.
//
// Every one of the 100 styles is a block of custom properties, not a
// stylesheet. One article skeleton (skeleton.css) consumes them. That means
// switching styles is a single attribute swap with no reflow of structure,
// and it means the winner ports into the Hugo theme by copying its block:
// the theme reads the same names.
//
// Base size is a lab-wide control, not a per-style choice: comparing designs
// only means something if they are all set at the same size. It defaults to
// 20px for the main text and cycles 16 / 18 / 20 from the chrome.
//
// Every other type value is relative, so a style has to hold across that whole
// range. --measure is in ch, so the column keeps its character count and only
// grows physically; a style that only works at one size does not work.

export const DEFAULTS = {
  // grounds and ink
  page: 'oklch(0.155 0.006 60)',   // the field behind everything
  field: null,                      // article ground; null means inherit page
  ink: 'oklch(0.925 0.006 85)',     // body prose
  strong: null,                     // headings; null means inherit ink
  mute: null,                       // meta, captions, TOC; null derives from ink
  accent: 'oklch(0.455 0.192 27)',  // the one hue, as a FILL: bands, marks, grounds
  accentInk: 'oklch(0.945 0.006 85)', // text sitting on an accent ground
  // The fill hue is usually too dark to carry text on the page ground. Anything
  // that paints the accent as type or a thin mark uses this instead: the same
  // hue lifted toward the ink until it is legible. Null derives it.
  accentText: null,
  rule: null,                       // hairlines; null derives from ink at low alpha
  codeBg: null,
  codeInk: null,
  quoteBg: null,
  quoteInk: null,
  markBg: null,                     // <mark> / inline emphasis ground
  // The third ground. Only the cut-in treatments use it: SHAFT alternates
  // black / red / bone across whole cards, so a two-ground contract cannot
  // express the language at all.
  plate: null,
  plateInk: null,

  // type
  fontBody: 'Archivo',
  fontDisplay: null,                // null means reuse body
  fontMono: 'Sometype Mono',
  fontLabel: null,                  // micro-labels; null means reuse display
  size: 20,                         // px. Lab-wide, overridden by the size control.
  lh: 1.62,                         // body leading
  measure: 68,                      // ch
  scale: 1.32,                       // modular ratio between heading steps
  bodyWeight: 400,
  // Light type on a dark ground blooms: strokes optically thicken and counters
  // fill in. A little positive tracking and extra leading buys it back. Dark
  // styles want roughly +0.006em and +0.05 lh over their light equivalents.
  bodyTrack: '0',
  boldWeight: 700,
  dispWeight: 700,
  dispTrack: '-0.02em',
  dispLh: 1.1,
  dispCase: 'none',
  labelTrack: '0.24em',
  labelSize: 11,

  // rhythm and structure
  space: 1.0,                       // multiplier on the vertical rhythm
  ruleW: 1,                         // px
  radius: 0,
  bleed: false,                     // let h2 bands run full width of viewport

  // treatments, enumerated; skeleton.css switches on these
  h2: 'plain',      // plain rule-over rule-under band numbered outdent caps kicker evatitle
  // Whole-section grounds. 'none' leaves the essay on one ground; 'cutin'
  // alternates page / accent / plate across full-bleed cards with a hard bar
  // between them; 'plate' alternates two grounds only.
  sect: 'none',     // none bar cutin plate monolith
  part: 'none',     // none kanji eva seele — the micro-label stamped on each section
  link: 'underline',// underline thick mark bracket weight dotted
  code: 'flat',     // flat framed inverted ruled tinted
  quote: 'indent',  // indent rule oversize ground caps
  img: 'raw',       // raw framed matte dim invert-hint
  toc: 'list',      // list rail boxed inline numbered spine
  table: 'rules',   // rules zebra boxed minimal
  mark: 'none',     // none monogram — the calligraphic mark, in site chrome only
};

// Weights requested from the font CDN. Only what a style actually paints.
export const DEFAULT_WEIGHTS = { body: '400,400i,700', display: '700', mono: '400' };

export const TREATMENTS = {
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
