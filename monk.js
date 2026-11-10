/* Der kleine Mönch: Maskottchen der App. Stimmung: ok, happy, sleepy (meditiert), stress.
   Optionen: night (Mond, ruhiger), book (hält ein Buch). Farben fest, damit er auf jedem Hintergrund passt. */
window.MK_MONK = function (mood = 'ok', o = {}) {
  const ink = '#1b1e27', skin = '#f3c9a2', skinD = '#e2ad80', robe = o.night ? '#c9731a' : '#e48a1c', robeD = o.night ? '#8f4f10' : '#b4650a';
  const eyes = {
    ok: `<ellipse cx="42.5" cy="42" rx="2.5" ry="3" fill="${ink}"/><ellipse cx="57.5" cy="42" rx="2.5" ry="3" fill="${ink}"/><circle cx="43.3" cy="41" r=".9" fill="#fff"/><circle cx="58.3" cy="41" r=".9" fill="#fff"/>`,
    happy: `<path d="M38.5 43.5 q4 -5 8 0 M53.5 43.5 q4 -5 8 0" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
    sleepy: `<path d="M38.5 42 q4 3.4 8 0 M53.5 42 q4 3.4 8 0" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    stress: `<circle cx="42.5" cy="42" r="2" fill="${ink}"/><circle cx="57.5" cy="42" r="2" fill="${ink}"/><path d="M38 36.5 l8 1.6 M62 36.5 l-8 1.6" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`
  }[mood] || '';
  const mouth = {
    ok: `<path d="M46 50 q4 3.2 8 0" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    happy: `<path d="M44 48.5 q6 8 12 0 z" fill="${ink}"/><path d="M46.6 52 q3.4 2 6.8 0 q-3.4 -1.4 -6.8 0z" fill="#ef7f6e"/>`,
    sleepy: `<path d="M47 50.5 h6" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`,
    stress: `<path d="M46 51.5 q4 -2.6 8 0" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
  }[mood] || '';
  const hands = o.book
    ? `<g class="book"><path d="M33 70 L50 74 L67 70 L67 85 L50 89 L33 85 Z" fill="#fffdf8"/><path d="M50 74 L50 89" stroke="${ink}" stroke-opacity=".2" stroke-width="1.4"/><path d="M33 70 L50 74 L67 70" stroke="#4a5bd4" stroke-width="2.4" fill="none" stroke-linejoin="round"/><ellipse cx="33" cy="79" rx="4" ry="3.4" fill="${skin}"/><ellipse cx="67" cy="79" rx="4" ry="3.4" fill="${skin}"/></g>`
    : `<path d="M44 74 q6 -9 12 0 q-6 5 -12 0z" fill="${skin}"/><path d="M50 67.5 v10" stroke="${skinD}" stroke-width="1.2"/>`;
  const extra = o.night ? `<path d="M84 12 a8 8 0 1 0 6 13 a6.4 6.4 0 1 1 -6 -13z" fill="#f2d48b"/>` : '';
  const zz = mood === 'sleepy' && !o.book ? `<text class="zz" x="76" y="34" font-size="13" font-weight="800" fill="currentColor" font-family="inherit" opacity=".6">z</text>` : '';
  const drop = mood === 'stress' ? `<path class="drop" d="M75 26 q4.5 6 0 9 q-4.5 -3 0 -9z" fill="#7cc4ff"/>` : '';
  return `<svg viewBox="0 0 100 100" class="sunni mmonk ${mood}" aria-hidden="true">
    <ellipse cx="50" cy="97" rx="26" ry="3" fill="#000" opacity=".1"/>
    <g class="bodyg">
      <path d="M21 97 Q22 63 50 59 Q78 63 79 97 Z" fill="${robe}"/>
      <path d="M33 63.5 Q52 74 71 96.5 L61 97 Q46 79 28 68 Z" fill="${robeD}"/>
      <path d="M41 60.5 q9 6 18 0" stroke="${robeD}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      ${hands}
      <circle cx="29.5" cy="42" r="4.2" fill="${skin}"/><circle cx="70.5" cy="42" r="4.2" fill="${skin}"/>
      <circle cx="50" cy="40" r="21" fill="${skin}"/>
      <ellipse cx="42" cy="27.5" rx="7.5" ry="3.8" fill="#fff" opacity=".45" transform="rotate(-20 42 27.5)"/>
      <circle cx="50" cy="31" r="1.7" fill="#e48a1c"/>
      <g class="eyes">${eyes}</g>${mouth}
      <circle cx="37" cy="48" r="3.2" fill="#ef7f6e" opacity=".4"/><circle cx="63" cy="48" r="3.2" fill="#ef7f6e" opacity=".4"/>
    </g>${extra}${zz}${drop}</svg>`;
};
