/* Gemeinsame Helfer für App und Widget-Galerie: Mengen parsen und den Widget-Datenstand bauen. */
(() => {
'use strict';
const pad = n => String(n).padStart(2, '0');
const lnow = () => new Date(Date.now() - 4 * 3600e3);
const dk = (d = lnow()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEK = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];

function parseIng(line) {
  const m = String(line).trim().match(/^(\d+(?:[.,]\d+)?|\d+\/\d+)\s*(g|kg|ml|l|EL|TL|Stk|Prise|Dose|Scheibe|Scheiben|Bund|Pck|Zehe|Zehen|Handvoll|Becher|Tasse)?\s+(.+)$/i);
  if (!m) return { q: null, u: '', n: String(line).trim() };
  const q = m[1].includes('/') ? m[1].split('/').reduce((a, b) => a / b) : parseFloat(m[1].replace(',', '.'));
  return { q, u: m[2] || '', n: m[3] };
}
const fmtQ = q => q == null ? '' : (q < 10 ? Math.round(q * 2) / 2 : Math.round(q)).toLocaleString('de-DE');
const fmtIng = (i, k = 1) => [i.q != null ? fmtQ(i.q * k) : '', i.u].filter(Boolean).join(' ');

function streak(S, w) {
  let n = 0; const d = lnow();
  if (!(S.log[dk(d)] || {})[w + 'f']) d.setDate(d.getDate() - 1);
  for (;;) { const l = S.log[dk(d)]; if (l && l[w + 'f']) { n++; d.setDate(d.getDate() - 1); } else break; }
  return n;
}

// Kompakter Stand für die Scriptable-Widgets (wird ins Skript eingebettet oder per Link übergeben)
function buildWidgetData(S, recipes) {
  const day = dk(), l = S.log[day] || {};
  const doneIds = w => l[w] || [];
  const getR = id => recipes.find(r => r.id === id);
  const rec = {};
  const week = WEEK.map(d => ['f', 'm', 'a'].map(k => {
    const v = (S.plan[d] || {})[k];
    const r = typeof v === 'string' ? getR(v) : null;
    if (r) {
      rec[r.id] = rec[r.id] || { e: r.e, t: r.t, min: r.min || 0, kcal: r.kcal || 0, p: r.p || 0,
        ing: (r.ing || []).slice(0, 10).map(parseIng).map(i => [fmtIng(i), i.n]) };
      return [r.e, r.t, r.id];
    }
    return v && v.t ? ['🍽️', v.t, ''] : [];
  }));
  const lvl = (x, w) => !x ? 0 : x[w + 'f'] ? 2 : (x[w] && x[w].length ? 1 : 0);
  const heat = [];
  for (let i = 13; i >= 0; i--) { const d = lnow(); d.setDate(d.getDate() - i); const x = S.log[dk(d)]; heat.push([lvl(x, 'm'), lvl(x, 'e')]); }
  const food = l.food || [];
  return {
    v: 1, ts: Date.now(), day, eve: +S.set.eve, name: S.set.name || '',
    r: { m: S.routines.m.map(s => [s.t, doneIds('m').includes(s.id) ? 1 : 0, +s.min || 0]),
         e: S.routines.e.map(s => [s.t, doneIds('e').includes(s.id) ? 1 : 0, +s.min || 0]) },
    top: (l.top || []).map(t => [t.t, t.done ? 1 : 0]),
    w: l.w || 0, wg: +S.set.water,
    kcal: food.reduce((a, f) => a + (+f.kcal || 0), 0), kg: +S.set.kcal,
    p: food.reduce((a, f) => a + (+f.p || 0), 0), pg: +S.set.protein,
    week, rec, sm: streak(S, 'm'), se: streak(S, 'e'), heat
  };
}

window.SK = { pad, lnow, dk, WEEK, parseIng, fmtQ, fmtIng, streak, buildWidgetData };
})();
