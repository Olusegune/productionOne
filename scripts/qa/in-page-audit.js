// In-page interface audit. Paste into the browser console of the running app (dev server or the packaged app's debug port),
// then run:  await window.__audit(['Projects','Story','Design','Review','Direct','Deliver'])
// Per workspace it reports: horizontal overflow, text under 12 px, text below WCAG AA contrast (4.5:1, 3:1 for large text), and click targets under 24 px.
// Run it at 1024, 1280, 1440 and 1920 px wide, in the dark theme and with document.documentElement.setAttribute('data-theme','light').
// Wait about 2.5 s after changing theme or size before running it, so colour transitions have settled.
window.__audit = async (names) => {
  const w = (ms) => new Promise((r) => setTimeout(r, ms));
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] } };
  const bgOf = (el) => { const layers = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break } } let base = { r: 13, g: 16, b: 23 }; for (const l of layers.reverse()) base = { r: l.r * l.a + base.r * (1 - l.a), g: l.g * l.a + base.g * (1 - l.a), b: l.b * l.a + base.b * (1 - l.a) }; return base };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4) }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b) };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05) };
  const out = [];
  for (const name of names) {
    [...document.querySelectorAll('.po-tabs button')].find((b) => (b.getAttribute('aria-label') || '').startsWith(name))?.click(); await w(800);
    const main = document.querySelector('.po-main');
    const res = { name, vw: innerWidth, overflowX: document.documentElement.scrollWidth > innerWidth + 1 || (main ? main.scrollWidth > main.clientWidth + 1 : false), smallText: 0, lowContrast: [], smallTargets: 0 };
    const seen = new Set();
    for (const el of document.querySelectorAll('.po-shell *')) {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
        const size = parseFloat(cs.fontSize); if (size < 12) res.smallText++;
        const fg = parse(cs.color);
        if (fg) { const bg = bgOf(el); const mixed = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) }; const cr = ratio(mixed, bg); const large = size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight) >= 700); if (cr < (large ? 3 : 4.5)) { const k = el.textContent.trim().slice(0, 30) + '|' + cr.toFixed(1); if (!seen.has(k)) { seen.add(k); res.lowContrast.push(k) } } }
      }
      if (['BUTTON', 'A', 'SELECT'].includes(el.tagName) && (r.width < 24 || r.height < 24)) res.smallTargets++;
    }
    res.lowContrast = res.lowContrast.slice(0, 8);
    out.push(res);
  }
  return out;
};
