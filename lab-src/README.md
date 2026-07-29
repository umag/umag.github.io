# Style lab

`style-lab.html` at the repo root: one standalone file, 116 designs, two real
posts. Open it directly, no server needed. It is not published (Hugo builds to
`docs/`, so root files never ship).

## Using it

| key | |
|---|---|
| `←` `→` | step one style |
| `↑` `↓` | jump ten |
| type `1`-`100` | go to that number |
| `b` | body size 16 / 18 / 20 (shift reverses) |
| `g` | all 100 as tiles |
| `f` | keep / drop |
| `c` | copy this style's token block |
| `e` | copy every kept style |
| `s` | swap specimen post |
| `r` | random |
| `?` | keys |

Favourites and last position persist in localStorage. The URL hash is the style
number, so `style-lab.html#47` is linkable.

## How it is put together

Each style is a **token block**, not a stylesheet: `skeleton.css` reads ~30
custom properties and seven treatment attributes and knows nothing about any
individual design. Two consequences:

- switching is one attribute swap, so 100 designs cost one page
- the winner ports into the Hugo theme by copying its block, because the theme
  will read the same names

`contract.js` is the authority on what those names mean.

### Files

| | |
|---|---|
| `contract.js` | token names, defaults, valid treatment values |
| `styles-a..d.js` | styles 001-100, 25 per file |
| `styles-e.js` | 101-116: the SHAFT and Evangelion ports, plus the long-read, red-intensity and bone/black variants |
| `skeleton.css` | the article; consumes the contract |
| `chrome.css` | the lab UI, locked palette so it never blends with a specimen |
| `lab.js` | switching, contact sheet, favourites, export |
| `build.mjs` | validates, then assembles `style-lab.html` |
| `check-fonts.mjs` | every family and weight against the Bunny catalogue |
| `lab-hugo.toml` | overlay so Chroma emits classes, not inline Monokai |

### Rebuilding

```sh
hugo --config hugo.toml,lab-src/lab-hugo.toml --destination .lab-build --quiet
node .lab-build/extract.mjs      # pull the two specimens out of the real build
node lab-src/build.mjs           # validate + assemble
node lab-src/check-fonts.mjs     # optional: catalogue check
```

`build.mjs` refuses to write on a duplicate name, an unknown token, an invalid
treatment, a measure outside 55-80ch, a cut-in style with no third ground, or
fewer than 100 styles.

## The direct ports (101-107)

Styles 001-005 were *in* the anifilias language. 101-102 **are** it: the SHAFT
cut-in is not a coloured heading, it is whole cards of black, red and bone butted
against each other with a 9px bar. That needed three things the original contract
could not express, so it grew them:

- a third ground (`plate` / `plateInk`), because two grounds cannot alternate three ways
- `sect: cutin | plate | monolith`, with lab.js wrapping each h2 and its content
  in a `.lab-sect` so a section can own a ground
- `part: kanji | eva | seele`, the micro-label stamped on each card

103-107 are Evangelion: **SEELE Monolith** and **Sound Only** are the committee
(slabs in a void, vermilion outline, `SEELE 02 / SOUND ONLY`), **Eva Title Card**
and **Eva A-Part** are the episode typographics (第四話 in kanji over Mincho set
far past the column), **NERV Terminal** is the readout. The title cards are
Matisse EB in the show, which is not free; Shippori Mincho B1 at 800 is the
closest available cut.

## The long-read variants (108-110)

Alternating black and bone across five short landing cards is punctuation.
Across 6,700 words it is an eye test every section: the pupil re-adapts at each
boundary. 108-110 keep the Monogatari language and hold the reading ground
still, in increasing order of quiet:

- **108 Nocturne** — still three alternating grounds, but the bone card becomes
  a deep red-black. The alternation survives; the luminance jump does not.
- **109 Bar** — the cut-in becomes the section *head*, not the section. Full-bleed
  bar and red plate, prose never leaves the black.
- **110 Quiet** — one ground. The 9px bar and the daiji marker do all the
  sectioning.

## The red axis (111-113)

The hue is fixed by PRODUCT.md: one ink, `oklch(0.455 0.192 27)`, retuned per
ground rather than swapped. So when the red reads as aggressive the levers are
**area** and **chroma**, not hue. Three points on that axis, all on the Bar
chassis:

- **111 Oxblood** — same band area, dropped to `oklch(0.315 0.105 25)`. The
  plate is still there and stops shouting.
- **112 Ember** — keeps the full-saturation red and spends almost none of it:
  the 9px bar and the daiji marker, nothing filled.
- **113 Ash** — one red thread. A greyed brick on the bar and nowhere else.

## Bone and black (114-116)

The original palette minus the red card, read three ways:

- **114 Bone** — daylight. Bone page, black ink, one ground; red survives only
  on the bar and the daiji marker.
- **115 Two-Tone** — the original alternation with the red card removed, bone
  and black cutting against each other. Note this reinstates the luminance flip
  that 108-110 exist to avoid.
- **116 Ink** — two colours and no third. Bone on black, no red anywhere.

Two-ground alternation rides an `n % 2` class, not the cut-in's `n % 3`: on the
three-cycle it would land page / plate / page / page / plate and read as an
irregularity rather than a rhythm.

## Readability

Applied to all 110 in `skeleton.css`:

| practice | how |
|---|---|
| measure 45-75ch | `--measure` in `ch`, every style validated into 55-80 |
| leading 1.5-1.7, more on dark | per style; dark variants run 1.64-1.68 |
| no pure black or white | every ground and ink is tinted, chroma 0.002-0.01 |
| contrast high but not maximal | AAA body everywhere; pure white on pure black halates |
| widow and orphan control | `text-wrap: pretty` on p and li, `balance` on headings |
| hanging punctuation | `hanging-punctuation: first allow-end last` |
| optical sizing | `font-optical-sizing: auto` |
| tracking for light-on-dark | `--bodyTrack`, ~+0.006em on the dark variants |
| colour is never the only channel | links carry an underline, not just a hue |
| light-ground images on dark | matted rather than dropped in raw |

The one that most changes how a dark page feels is **bloom**: light strokes on a
dark ground optically thicken and counters fill in, so type that is correct on
white reads heavy and tight on black. The fix is a touch more leading, slightly
positive tracking, and pulling the ink back from pure white. 101 was set at
lh 1.5 with no tracking, which is why it read denser than it should have;
108-110 are at 1.64-1.68 with +0.006em.

## Decisions worth knowing

**Body size is lab-wide, default 20px.** Comparing 100 designs only means
something if they are all set at the same size, so size is a control rather than
a per-style choice. `b` cycles 16 / 18 / 20 and the choice sticks.

Everything else is relative, so a style has to hold across that range. `--measure`
is in `ch`, so the column keeps its character count and only grows physically:
68ch is 843px at 20px and 674px at 16px. Checked at all three sizes for every
style, 300 combinations, no overflow and no rail collisions.

**Fill vs text accent.** `--accent` is a fill: bands, marks, grounds. Anything
painting the accent *as type* uses `--accentText`, the same hue lifted toward
the ink until legible. PRODUCT.md requires this, and the raw anifilias red is
2.48:1 on its own black, which fails as text and is fine as a band.

**Custom properties resolve where declared, not where used.** This is the one
that bit hardest. A cut-in section sets its own `--ink` and `--page`, but
`--_strong: var(--strong, var(--ink))` declared up on `#stage` had *already*
resolved against the stage's ink, so bone cards rendered near-white headings on
bone. The derived block is now declared on the sections too, and inverted cards
reset `--rule` / `--mute` / `--codeBg` to `initial` (the only value `var()`
treats as absent) so they re-derive from their own ground.

**Syntax colour comes from the style.** The site's normal build lets Chroma
write Monokai inline, which overrides the code tokens and drops a dark box into
the 25 light styles. `lab-hugo.toml` switches to classes so keywords take the
accent and comments take the muted ink, in every style.

**Manual heading numbers.** Post 21 numbers its own sections. Treatments that
supply numbering hide the manual one so the design reads true rather than
showing "03 3. Nvidia".

## Measured, not assumed

Across all 116, checked in-browser:

- body prose vs **its own section ground**: AAA (7:1) everywhere
- headings, muted meta, accent-as-text, part markers, text on accent bands: AA everywhere
- no horizontal overflow, no rail collisions, at 16 and 20px
- all 69 families and every requested weight resolve on Bunny

Rerun the contrast sweep by pasting `contrast-check.js` into the console.
