// Paste into the console on style-lab.html. Walks all 100 styles and reports
// any that fail the PRODUCT.md contrast floors.
//
// Colours are resolved through a 1x1 canvas rather than parsed: Chrome returns
// computed colours still in oklch(), so reading the numbers out of the string
// and treating them as RGB silently produces nonsense.
(() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const rgb = (s) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = (a) => 0.2126 * lin(a[0]) + 0.7152 * lin(a[1]) + 0.0722 * lin(a[2]);
  const ratio = (a, b) => {
    const x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  const stage = document.querySelector('#stage');
  const rows = [];
  const start = Number(location.hash.slice(1)) || 1;

  for (let i = 0; i < STYLES.length; i++) {
    apply(i, { push: false });
    const cs = getComputedStyle(stage);
    const ground = rgb(cs.backgroundColor);
    rows.push({
      '#': i + 1,
      name: STYLES[i].name,
      body: +ratio(ground, rgb(getComputedStyle(document.querySelectorAll('#body p')[3]).color)).toFixed(2),
      muted: +ratio(ground, rgb(getComputedStyle(document.querySelector('.lab-meta')).color)).toFixed(2),
      accentText: +ratio(ground, rgb(cs.getPropertyValue('--_accentText'))).toFixed(2),
      onAccent: +ratio(rgb(cs.getPropertyValue('--accent')), rgb(cs.getPropertyValue('--accentInk'))).toFixed(2),
    });
  }
  apply(start - 1);

  const fails = rows.filter((r) => r.body < 7 || r.muted < 4.5 || r.accentText < 4.5 || r.onAccent < 4.5);
  console.table(fails.length ? fails : rows);
  console.log(
    fails.length
      ? `${fails.length} style(s) below floor (body AAA 7:1, others AA 4.5:1)`
      : `all ${rows.length} pass — body min ${Math.min(...rows.map((r) => r.body)).toFixed(2)}:1`,
  );
  return rows;
})();
