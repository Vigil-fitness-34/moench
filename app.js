/* Mönch-Modus: eine App für den Tag. Mönch-Säulen, Routinen, Top 3, Uni (früher Lernklar), Aufgaben,
   Geld, Essen (früher Sonnenklar). Alles lokal (localStorage), kein Server. */
(() => {
'use strict';

const KEY = 'moench-v1';
const OLD_KEY = 'sonnenklar-v1'; // gleiche Adresse: alte Sonnenklar-Daten werden beim ersten Start übernommen
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9);
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = n => Math.round(n).toLocaleString('de-DE');
// Logischer Tag beginnt um 4 Uhr, damit eine Abendroutine nach Mitternacht noch zum Vortag zählt.
const lnow = () => new Date(Date.now() - 4 * 3600e3);
const dk = (d = lnow()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => dk();
const WD = ['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa'];
const WEEK = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
const WDL = { mo: 'Montag', di: 'Dienstag', mi: 'Mittwoch', do: 'Donnerstag', fr: 'Freitag', sa: 'Samstag', so: 'Sonntag' };
const SLOTS = { f: 'Frühstück', m: 'Mittag', a: 'Abend' };
const MEALS = ['Frühstück', 'Mittag', 'Abend', 'Snack'];
const ICON = { m: 'ph-sun-horizon', e: 'ph-moon-stars' };
const RNAME = { m: 'Morgenroutine', e: 'Abendroutine' };

/* ---------- State ---------- */
const defaults = () => ({
  v: 1,
  set: { name: '', eve: 15, theme: 'system', kcal: 2300, protein: 140, water: 8, hideHint: false },
  routines: {
    m: [
      { id: uid(), t: 'Glas Wasser trinken', min: 1 },
      { id: uid(), t: 'Bett machen', min: 2 },
      { id: uid(), t: '10 Minuten bewegen', min: 10 },
      { id: uid(), t: '10 Minuten meditieren', min: 10 },
      { id: uid(), t: 'Kalt duschen', min: 5 },
      { id: uid(), t: 'Frühstück ohne Handy', min: 15 },
      { id: uid(), t: 'Top 3 für heute festlegen', min: 3 }
    ],
    e: [
      { id: uid(), t: 'Morgen kurz planen', min: 5 },
      { id: uid(), t: 'Zimmer und Schreibtisch aufräumen', min: 10 },
      { id: uid(), t: 'Handy weg, Flugmodus an', min: 1 },
      { id: uid(), t: '3 Sätze Tagebuch', min: 5 },
      { id: uid(), t: '20 Minuten lesen', min: 20 }
    ]
  },
  log: {},
  todos: [],
  recipes: [],
  plan: {},
  shop: { c: {}, extra: [] },
  ean: {},
  ft: null,
  mk: mkDefaults(),
  geld: { week: 150, save: 0, payday: 1, items: [], wish: [], saved: {}, notBought: 0 },
  ideas: [],
  meds: medDefaults(),
  goals: {},
  cal: { events: [], name: '' },
  work: workDefaults()
});
function workDefaults() { const d = new Date(Date.now() - 4 * 3600e3); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return { on: true, target: 16, startBal: -30, start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, log: {} }; }
// Einnehmen: Tabletten (mit Enddatum) und Supplemente, jeden Tag abhaken, kommen mit Wecker in den Kalender
function medDefaults() {
  const d = new Date(Date.now() - 4 * 3600e3); d.setDate(d.getDate() + 30);
  const until = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return [
    { id: 'tabl', t: 'Tabletten', time: '08:00', until },
    { id: 'supp', t: 'Supplemente', time: '08:00', until: '' }
  ];
}
// Mönch-Modus: Säulen (jeden Tag), feste Blöcke (stehen im Kalender), Laufzeit
function mkDefaults() {
  return {
    on: false, start: null, end: null, wake: '07:30', book: '',
    why: 'Klausuren bestehen · P4 auf echtes Geld bringen · Finanzen im Griff',
    pillars: [
      { id: 'wake', t: 'Aufgestanden bis {wake}', i: 'ph-alarm' },
      { id: 'lern', t: 'Lernblock fürs Studium', i: 'ph-brain', auto: 'uni' },
      { id: 'p4', t: 'P4-Block erledigt', i: 'ph-storefront' },
      { id: 'sport', t: 'Training', i: 'ph-barbell' },
      { id: 'lesen', t: 'Abends gelesen', i: 'ph-book-open' },
      { id: 'social', t: 'Social Media unter 30 Min', i: 'ph-device-mobile-slash' },
      { id: 'geld', t: 'Nichts Ungeplantes gekauft', i: 'ph-wallet' }
    ],
    blocks: [
      { id: 'b-p4', t: 'P4-Block', i: 'ph-storefront', days: ['di', 'do'], time: '19:00', min: 90 },
      { id: 'b-p4s', t: 'P4-Block', i: 'ph-storefront', days: ['sa'], time: '10:00', min: 180 },
      { id: 'b-lesen', t: 'Lesen', i: 'ph-book-open', days: ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'], time: '21:30', min: 20 },
      { id: 'b-woche', t: 'Wochenplanung', i: 'ph-calendar-check', days: ['so'], time: '18:00', min: 20 }
    ],
    phone: {}
  };
}

let S, migrated = false;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
if (!S) { try { S = JSON.parse(localStorage.getItem(OLD_KEY)); migrated = !!S; } catch (e) { S = null; } }
if (!S || !S.routines) {
  S = defaults();
  // Beispiel-Wochenplan, damit Essen nicht leer startet
  S.plan = { mo: { f: 'b1', m: 'b5', a: 'b7' }, di: { f: 'b2', m: 'b8', a: 'b6' }, mi: { f: 'b4', m: 'b5', a: 'b9' },
    do: { f: 'b1', m: 'b11', a: 'b10' }, fr: { f: 'b3', m: 'b10', a: 'b12' }, sa: { f: 'b12' }, so: { f: 'b3' } };
} else {
  const d = defaults();
  S.set = Object.assign(d.set, S.set);
  for (const k of ['log', 'plan', 'ean']) S[k] = S[k] || {};
  for (const k of ['todos', 'recipes', 'ideas']) S[k] = S[k] || [];
  S.shop = Object.assign({ c: {}, extra: [] }, S.shop);
  S.mk = Object.assign(mkDefaults(), S.mk);
  S.geld = Object.assign(d.geld, S.geld);
  S.goals = S.goals || {};
  if (!Array.isArray(S.meds)) S.meds = medDefaults();
  S.work = Object.assign(workDefaults(), S.work);
  S.cal = Object.assign({ events: [], name: '' }, S.cal);
}
if (!S.set.mkRoutines) {
  S.set.mkRoutines = true;
  const has = (w, re) => S.routines[w].some(x => re.test(x.t));
  if (!has('m', /medit/i)) S.routines.m.splice(Math.min(2, S.routines.m.length), 0, { id: uid(), t: '10 Minuten meditieren', min: 10 });
  if (!has('e', /aufräum/i)) S.routines.e.unshift({ id: uid(), t: 'Zimmer und Schreibtisch aufräumen', min: 10 });
  if (!has('e', /lesen/i)) S.routines.e.push({ id: uid(), t: '20 Minuten lesen', min: 20 });
}
if (migrated) { S.set.onboarded = false; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

// Andere Fenster (zweiter Tab) über Änderungen informieren
const bc = 'BroadcastChannel' in window ? new BroadcastChannel('moench') : null;
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); if (bc) bc.postMessage('changed'); } catch (e) { toast('Speichern fehlgeschlagen. Speicher voll?'); } };
const save = () => { persist(); render(); };

const L = (d = today()) => {
  const l = S.log[d] || (S.log[d] = {});
  l.m = l.m || []; l.e = l.e || []; l.food = l.food || []; l.top = l.top || [];
  l.w = l.w || 0; l.fm = l.fm || 0; l.meds = l.meds || []; l.mk = l.mk || []; l.blk = l.blk || [];
  return l;
};
const allRecipes = () => [...window.BUILTIN_RECIPES, ...S.recipes];
const getR = id => allRecipes().find(r => r.id === id);

/* ---------- UI-State ---------- */
const params = new URLSearchParams(location.search);
const ui = {
  tab: ['heute', 'uni', 'aufgaben', 'geld', 'essen', 'routinen'].includes(params.get('tab')) ? params.get('tab') : 'heute',
  which: null, rWhich: null, todoF: 'heute', foodSeg: 'tagebuch', foodDay: null,
  rq: '', rtag: 'Alle', portions: 1, newId: null, focusSel: null, tabChanged: true, skip: new Set()
};
const curWhich = () => {
  if (ui.which) return ui.which;
  const h = new Date().getHours();
  return (h >= S.set.eve || h < 4) ? 'e' : 'm';
};

/* ---------- Maskottchen "Sunni" ---------- */
function sunni(mood = 'ok', night = false) { return window.MK_MONK(mood, { night }); }

const LINES = {
  m0: ['Guten Morgen! Erst Wasser, dann Welt.', 'Ein Schritt reicht für den Anfang.', 'Noch im Bett? Ich zähle bis drei.', 'Aufstehen ist die halbe Miete. Den Rest machen wir zusammen.'],
  m1: ['Läuft bei dir. Noch {n} Schritte.', 'Stark angefangen. Dranbleiben!', 'Noch {n}, dann gehört der Tag dir.'],
  m2: ['Morgenroutine durch. Boss-Modus aktiviert.', 'Geschafft! Jetzt die Top 3 rocken.', 'Das wird ein guter Tag.'],
  e0: ['Feierabend? Ich hab schon die Schlafmütze auf.', 'Runterfahren in {n} kleinen Schritten.', 'Der Tag war lang. Lass ihn sauber ausklingen.'],
  e1: ['Fast im Bett. Noch {n}.', 'Sehr gut. Handy schon weggelegt?', 'Noch {n} Schritte bis zur Kuscheldecke.'],
  e2: ['Abendroutine geschafft. Gute Nacht, Champion.', 'Alles erledigt. Morgen-Du sagt danke.', 'Ab ins Bett. Ich mach das Licht aus.']
};
function moodOf(w) {
  const r = S.routines[w], l = L();
  const done = r.filter(s => l[w].includes(s.id)).length;
  const p = r.length ? done / r.length : 0;
  const stage = p >= 1 ? 2 : p > 0 ? 1 : 0;
  const arr = LINES[w + stage];
  const dayNum = Math.floor(lnow().getTime() / 864e5);
  return { mood: ['sleepy', 'ok', 'happy'][stage], line: arr[(dayNum + done) % arr.length].replace('{n}', r.length - done), done, total: r.length, p };
}

/* ---------- Rezepte: Mengen ---------- */
const { parseIng, fmtIng } = window.SK;
function guessEmoji(t) {
  const s = t.toLowerCase();
  const map = [[/hafer|oats|müsli|porridge/, '🥣'], [/pancake|pfannkuchen/, '🥞'], [/ei\b|eier|rührei|omelett/, '🍳'], [/hähnchen|huhn|chicken|pute/, '🍗'],
    [/lachs|fisch|thunfisch/, '🐟'], [/nudel|pasta|spaghetti|bolognese/, '🍝'], [/salat|bowl/, '🥗'], [/shake|smoothie/, '🥤'], [/wrap|burrito/, '🌯'],
    [/reis|risotto/, '🍚'], [/curry/, '🍛'], [/suppe|eintopf|chili/, '🍲'], [/brot|sandwich|toast/, '🥪'], [/quark|skyr|joghurt/, '🥣'],
    [/steak|rind|hack/, '🥩'], [/kartoffel/, '🥔'], [/pizza/, '🍕'], [/burger/, '🍔'], [/apfel|obst/, '🍎'], [/gemüse|ofen/, '🫑']];
  for (const [re, e] of map) if (re.test(s)) return e;
  return '🍽️';
}
function guessMeal() { const h = new Date().getHours(); return h < 11 ? 'Frühstück' : h < 15 ? 'Mittag' : h < 18 ? 'Snack' : 'Abend'; }

/* ---------- Render ---------- */
const view = $('#view');
// In der Mac-App (Electron) gibt es eine Brücke für Menüleiste und Mini-Fenster
const DESK = window.sonnenklarDesktop || null;
function deskStatus() {
  if (!DESK) return;
  const w = curWhich(), mo = moodOf(w);
  DESK.status(`${w === 'e' ? '🌙' : '☀️'} ${mo.done}/${mo.total}`, `${RNAME[w]}: ${mo.done} von ${mo.total} erledigt`);
}
function render() {
  deskStatus();
  document.body.dataset.area = ui.tab === 'routinen' ? 'heute' : ui.tab;
  if (document.body.classList.contains('widget-mode')) { $('#view').innerHTML = widgetHTML(); return; }
  document.querySelectorAll('.tab[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab || (ui.tab === 'routinen' && b.dataset.tab === 'heute')));
  const html = { heute: rHeute, routinen: rRoutinen, uni: () => UNI.html(), aufgaben: rAufgaben, geld: rGeld, essen: rEssen }[ui.tab]();
  view.innerHTML = `<div class="${ui.tabChanged ? 'view-in' : ''}">${html}</div>`;
  ui.tabChanged = false;
  if (ui.focusSel) { const el = $(ui.focusSel); if (el) el.focus(); ui.focusSel = null; }
  ui.newId = null;
  renderPip();
  tickTimer();
}

const head = (title, sub = '', extra = '') => `<header class="top"><div>${sub ? `<p class="date">${sub}</p>` : ''}<h1>${title}</h1></div>
  <div class="row">${extra}<button class="icon-btn mobile-only" data-act="settings" aria-label="Einstellungen"><i class="ph-duotone ph-gear-six"></i></button></div></header>`;

function stepsHTML(w, compact = false) {
  const l = L();
  return S.routines[w].map(s => {
    const d = l[w].includes(s.id);
    return `<button class="step ${d ? 'done' : ''} ${ui.pulse === s.id ? 'pulse' : ''}" data-act="toggleStep" data-w="${w}" data-id="${s.id}">
      <span class="check"><i class="ph-duotone ph-check"></i></span><span class="t">${esc(s.t)}</span>${!compact && s.min ? `<span class="mins num">${s.min} Min</span>` : ''}</button>`;
  }).join('');
}

function rHeute() {
  const hh = new Date().getHours();
  const hi = hh < 11 ? 'Guten Morgen' : hh < 17 ? 'Hallo' : 'Guten Abend';
  const date = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const hint = isIOS && !standalone && !S.set.hideHint ? `<div class="hint"><i class="ph-duotone ph-export"></i><p>In Safari auf <b>Teilen</b> und <b>Zum Home-Bildschirm</b>. Dann ist es eine echte App.</p><button class="x-btn" data-act="hideHint" aria-label="Ausblenden"><i class="ph-duotone ph-x"></i></button></div>` : '';
  const top1 = (candidates().find(c => !ui.skip.has(c.key)) || {}).key || '';
  return `${head(`${hi}${S.set.name ? ', ' + esc(S.set.name) : ''}`, date, timerPill())}${hint}
  <div class="today simple">
    ${briefing()}
    ${nowCard()}
    ${top1.startsWith('med:') ? '' : medsCard()}
    ${pasteBanner()}
    ${dayCard()}
    ${workCard()}
    ${habitStrip()}
    ${top3Card()}
    ${phoneLine()}
  </div>`;
}

/* ---------- Jetzt dran: genau eine Sache ---------- */
// Reihenfolge = Priorität. Später-Klicks gelten nur bis zum nächsten Öffnen der App.
function candidates() {
  const k = today(), now = nowMin(), l = L(), out = [];
  const w = curWhich();
  for (const m of medsActive()) if (!l.meds.includes(m.id) && now >= tmin(m.time) - 30)
    out.push({ key: 'med:' + m.id, ic: 'ph-pill', t: `${m.t} nehmen`, sub: 'Dauert zehn Sekunden. Jetzt, solange du dran denkst.', act: `data-act="med" data-id="${m.id}"`, btn: 'Genommen' });
  const routineNext = which => {
    const r = S.routines[which], i = r.findIndex(s => !l[which].includes(s.id));
    if (i < 0) return;
    const s = r[i];
    out.push({ key: 'r:' + s.id, ic: ICON[which], t: s.t, sub: `${RNAME[which]} · Schritt ${i + 1} von ${r.length}${s.min ? ` · ${s.min} Min` : ''}`,
      act: `data-act="toggleStep" data-w="${which}" data-id="${s.id}"`, btn: 'Erledigt', alt: `<button class="btn sm ghost" data-act="focus" data-w="${which}"><i class="ph-duotone ph-play"></i>Mit Timer</button>`, prog: [i, r.length] });
  };
  if (w === 'm') routineNext('m');
  for (const e of UNI.occOn(k)) if (now >= UNI.tmin(e.start) - 10 && now < UNI.tmin(e.end))
    out.push({ key: 'ev:' + e.id, ic: UNI.KIND[e.kind].i, t: `${UNI.KIND[e.kind].n}: ${esc(e.sid ? UNI.sName(e.sid) : e.title)}`, sub: `Bis ${e.end}${e.room ? ' · ' + esc(e.room) : ''}. Handy weg, mitschreiben.`, act: '', btn: '' });
  for (const b of blocksOn(k)) {
    const s = tmin(b.time);
    if (now >= s - 10 && now < s + (+b.min || 30) && !(l.blk || []).includes(b.id))
      out.push({ key: 'b:' + b.id, ic: b.i || 'ph-square', t: b.t, sub: `${b.min} Min, jetzt. Handy weg, Timer läuft.`, act: `data-act="blockGo" data-id="${b.id}"`, btn: 'Timer starten' });
  }
  const tasks = UNI.todayPlan().tasks.filter(t => !UNI.isDone(t.key));
  for (const t of tasks) if (t.at == null || t.at <= now + 15)
    out.push({ key: 'u:' + t.key, ic: 'ph-brain', t: esc(UNI.taskTitle(t)), sub: esc(UNI.taskSub(t)), act: `data-act="u.startTask" data-key="${t.key}"`, btn: 'Lern-Session starten' });
  l.top.forEach((t, i) => { if (!t.done) out.push({ key: 'top:' + i, ic: 'ph-target', t: esc(t.t), sub: `Top ${i + 1} für heute. 50 Minuten, dann Pause.`, act: `data-act="topGo" data-i="${i}"`, btn: 'Fokus starten', alt: `<button class="btn sm ghost" data-act="topToggle" data-i="${i}"><i class="ph-duotone ph-check"></i>Schon erledigt</button>` }); });
  if (!l.top.length && w === 'm') out.push({ key: 'top:new', ic: 'ph-target', t: 'Top 3 festlegen', sub: 'Was bringt dich heute wirklich weiter? Unten eintragen.', act: 'data-act="focusTop"', btn: 'Eintragen' });
  for (const t of tasks) if (t.at != null && t.at > now + 15)
    out.push({ key: 'u:' + t.key, ic: 'ph-brain', t: esc(UNI.taskTitle(t)), sub: `Geplant ab ${UNI.fmtHM(t.at)}. Früher anfangen geht immer.`, act: `data-act="u.startTask" data-key="${t.key}"`, btn: 'Jetzt schon starten' });
  if (S.mk.on) {
    const pil = id => S.mk.pillars.find(p => p.id === id && !pillarDone(p));
    const sp = pil('sport'); if (sp && hourNow() < 21) out.push({ key: 'p:sport', ic: sp.i, t: esc(pillarText(sp)), sub: 'Tasche packen, los. Danach hakst du es hier ab.', act: `data-act="pillar" data-id="sport"`, btn: 'Erledigt' });
    const p4 = pil('p4'); if (p4) out.push({ key: 'p:p4', ic: p4.i, t: esc(pillarText(p4)), sub: 'Eine Sache für P4, die Geld bringt. Nicht basteln, verkaufen.', act: `data-act="pillar" data-id="p4"`, btn: 'Erledigt', alt: `<button class="btn sm ghost" data-act="ftQuick" data-min="50" data-t="P4"><i class="ph-duotone ph-timer"></i>50 Min Timer</button>` });
  }
  if (w === 'e') routineNext('e');
  if (S.mk.on) for (const p of S.mk.pillars) if (!pillarDone(p) && !out.some(o => o.key === 'p:' + p.id) && (p.id !== 'lern' || !tasks.length))
    out.push({ key: 'p:' + p.id, ic: p.i || 'ph-circle', t: esc(pillarText(p)), sub: 'Mönch-Säule für heute.', act: `data-act="pillar" data-id="${p.id}"`, btn: 'Erledigt' });
  return out;
}
const hourNow = () => new Date().getHours();
function nowCard() {
  const all = candidates(), list = all.filter(c => !ui.skip.has(c.key));
  const c = list[0], next = list[1];
  if (!c) {
    const ev = hourNow() >= 20;
    return `<section class="now done"><div class="now-top"><div class="mascot">${sunni('happy', ev)}</div><div><p class="eyebrow">Jetzt dran</p><h2>${all.length ? 'Alles andere später.' : ev ? 'Feierabend. Gut gemacht.' : 'Alles erledigt.'}</h2></div></div>
      <p class="now-sub">${all.length ? 'Du hast alles verschoben. Tipp auf Neu laden, dann zeig ich dir die erste Sache wieder.' : ev ? 'Handy weg, Buch raus. Morgen-Du sagt danke.' : 'Durchatmen. Oder eine Idee für morgen parken.'}</p>
      ${all.length ? `<button class="btn sm" data-act="skipReset"><i class="ph-duotone ph-arrow-counter-clockwise"></i>Neu laden</button>` : ''}</section>`;
  }
  const night = curWhich() === 'e';
  return `<section class="now ${night ? 'night' : ''}"><div class="now-top"><div class="mascot">${sunni(ui.skip.size ? 'ok' : 'happy', night)}</div><div><p class="eyebrow">Jetzt dran</p><h2 key="${esc(c.key)}">${c.t}</h2></div></div>
    <p class="now-sub"><i class="ph-duotone ${c.ic}"></i> ${c.sub}</p>
    ${c.prog ? `<div class="bar"><i style="--w:${Math.round(c.prog[0] / c.prog[1] * 100)}%"></i></div>` : ''}
    <div class="now-actions">${c.btn ? `<button class="btn primary" ${c.act}><i class="ph-duotone ${/Timer|Session|Fokus|starten/.test(c.btn) ? 'ph-play' : 'ph-check'}"></i>${c.btn}</button>` : ''}${c.alt || ''}<button class="btn sm ghost" data-act="skip" data-key="${esc(c.key)}">Später</button></div>
    ${next ? `<p class="now-next">Danach: ${next.t}</p>` : ''}
  </section>`;
}

/* ---------- Mönch-Modus ---------- */
const pdk = k => new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
const addD = (k, n) => { const d = pdk(k); d.setDate(d.getDate() + n); return dk(d); };
const diffD = (a, b) => Math.round((pdk(b) - pdk(a)) / 864e5);
const tmin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const fmtDate = k => pdk(k).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
const eur = n => (Math.round(n * 100) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const monday = (k = today()) => addD(k, -((pdk(k).getDay() + 6) % 7));
const ym = (k = today()) => k.slice(0, 7);
const wdOfK = k => WD[pdk(k).getDay()];

const mkTotal = () => S.mk.start && S.mk.end ? diffD(S.mk.start, S.mk.end) + 1 : 90;
const mkDay = () => S.mk.start ? diffD(S.mk.start, today()) + 1 : 0;
const pillarText = p => p.t.replace('{wake}', S.mk.wake || '07:30');
const uniMin = k => { try { return UNI.S().sessions.filter(x => x.date === k).reduce((a, x) => a + x.min, 0); } catch (e) { return 0; } };
function pillarDone(p, k = today()) {
  const l = S.log[k];
  if (l && l.mk && l.mk.includes(p.id)) return true;
  return p.auto === 'uni' && uniMin(k) >= 20;
}
const mkNeed = () => Math.max(1, S.mk.pillars.length - 1); // ein Joker pro Tag
const mkDone = (k = today()) => S.mk.pillars.filter(p => pillarDone(p, k)).length;
const dayWon = k => S.mk.pillars.length > 0 && mkDone(k) >= mkNeed();
function mkStreak() {
  if (!S.mk.start) return 0;
  let n = 0, k = today();
  if (!dayWon(k)) k = addD(k, -1);
  while (k >= S.mk.start && dayWon(k)) { n++; k = addD(k, -1); }
  return n;
}
const PCOL = { wake: 'saffron', lern: 'lapis', p4: 'terra', sport: 'sage', lesen: 'plum', social: 'teal', geld: 'saffron' };
function monkCard() {
  if (!S.mk.on) return `<section class="monk cta"><p class="eyebrow"><i class="ph-fill ph-flame"></i>Mönch-Modus</p><h2>Ein Fokus. Jeden Tag.</h2>
    <p class="monk-why">Ein paar feste Säulen pro Tag, alles andere wird geparkt. Du legst fest, wie lange.</p>
    <button class="btn primary" data-act="mkSetup"><i class="ph-duotone ph-play"></i>Mönch-Modus starten</button></section>`;
  const total = mkTotal(), day = mkDay();
  if (day > total) {
    let won = 0; for (let k = S.mk.start; k <= S.mk.end; k = addD(k, 1)) if (dayWon(k)) won++;
    return `<section class="monk"><p class="eyebrow"><i class="ph-fill ph-flame"></i>Mönch-Modus</p><h2>Geschafft: ${won} von ${total} Tagen gewonnen</h2>
      <p class="monk-why">${esc(S.mk.why)}</p><button class="btn primary" data-act="mkSetup"><i class="ph-duotone ph-arrow-clockwise"></i>Neue Runde starten</button></section>`;
  }
  const n = S.mk.pillars.length, done = mkDone(), need = mkNeed(), won = done >= need, st = mkStreak();
  let dots = '';
  for (let i = 13; i >= 0; i--) {
    const k = addD(today(), -i);
    const cls = k < S.mk.start ? 'off' : dayWon(k) ? 'won' : mkDone(k) ? 'part' : '';
    dots += `<i class="${cls} ${i === 0 ? 'is-today' : ''}" title="${fmtDate(k)}"></i>`;
  }
  return `<section class="monk ${won ? 'won' : ''}">
    <div class="monk-head"><div><p class="eyebrow"><i class="ph-fill ph-flame"></i>Mönch-Modus</p><h2>Tag ${day} <span>von ${total}</span></h2></div>
      <div class="monk-score"><b class="num">${done}/${n}</b><small>${won ? 'Tag gewonnen' : `noch ${need - done} bis gewonnen`}</small></div></div>
    <div class="bar"><i style="--w:${Math.round(day / total * 100)}%"></i></div>
    <p class="monk-why">${esc(S.mk.why)} · noch ${total - day} ${total - day === 1 ? 'Tag' : 'Tage'} bis ${fmtDate(S.mk.end)}</p>
    <div class="pillars">${S.mk.pillars.map(p => {
      const d = pillarDone(p), auto = p.auto === 'uni' && d && !(L().mk || []).includes(p.id);
      const sub = p.id === 'lesen' && S.mk.book ? esc(S.mk.book) : auto ? `${uniMin(today())} Min gelernt` : p.auto === 'uni' ? 'hakt sich nach 20 Min Lernen selbst ab' : '';
      return `<button class="pillar ${d ? 'done' : ''} ${ui.pulse === p.id ? 'pulse' : ''}" style="--pc:var(--${PCOL[p.id] || 'saffron'})" data-act="pillar" data-id="${p.id}"><i class="ph-duotone ${p.i || 'ph-circle'} pi"></i><span class="t">${esc(pillarText(p))}${sub ? `<small>${sub}</small>` : ''}</span><span class="check"><i class="ph-duotone ph-check"></i></span></button>`;
    }).join('')}</div>
    <div class="monk-foot"><div class="mdots" aria-label="Die letzten 14 Tage">${dots}</div>
      <span class="small"><i class="ph-fill ph-fire"></i> <b class="num">${st}</b> ${st === 1 ? 'Tag' : 'Tage'} am Stück · 1 Joker pro Tag</span>
      <button class="link" data-act="mkSettings">Anpassen</button></div>
  </section>`;
}
const medsActive = (k = today()) => S.meds.filter(m => !m.until || m.until >= k);
function medsCard() {
  const ms = medsActive(); if (!ms.length) return '';
  const l = L(), done = ms.filter(m => l.meds.includes(m.id)).length, all = done === ms.length;
  if (all && !ui.showMeds) return '';
  const late = !all && ms.some(m => !l.meds.includes(m.id) && nowMin() > tmin(m.time) + 60);
  return `<section class="card meds ${all ? 'all' : ''} ${late ? 'late' : ''}"><div class="card-head"><h2><span class="hic"><i class="ph-duotone ph-pill"></i></span>Einnehmen</h2><button class="link" data-act="medsEdit">Anpassen</button></div>
    <div class="med-row">${ms.map(m => { const d = l.meds.includes(m.id); const left = m.until ? diffD(today(), m.until) : null;
      return `<button class="med ${d ? 'done' : ''}" data-act="med" data-id="${m.id}"><span class="check"><i class="ph-duotone ph-check"></i></span><span class="t">${esc(m.t)}<small>${d ? 'genommen' : `ab ${m.time}`}${left != null ? ` · noch ${left + 1} ${left ? 'Tage' : 'Tag'}` : ''}</small></span></button>`; }).join('')}</div>
    ${late ? `<p class="small late-hint">Noch nicht genommen. Jetzt, solange du dran denkst.</p>` : ''}
  </section>`;
}
function medsSheet() {
  openSheet(`${sheetHead('Einnehmen')}<p class="muted small" style="margin-bottom:12px">Erscheint jeden Morgen ganz oben. Mit Enddatum verschwindet es danach von selbst. Beim Eintragen in den Kalender bekommt jedes einen Wecker.</p>
  <div class="stack" style="gap:12px">${S.meds.map(m => `<div class="blk"><div class="row"><input class="input" data-med="${m.id}" data-k="t" value="${esc(m.t)}" aria-label="Name"><button class="mini" data-act="medDel" data-id="${m.id}" aria-label="Löschen"><i class="ph-duotone ph-trash"></i></button></div>
    <div class="row"><label class="f" style="flex:1">Uhrzeit<input class="input" type="time" data-med="${m.id}" data-k="time" value="${m.time}"></label><label class="f" style="flex:1">Bis (optional)<input class="input" type="date" data-med="${m.id}" data-k="until" value="${m.until || ''}"></label></div></div>`).join('')}</div>
  <button class="btn block" data-act="medAdd" style="margin-top:12px"><i class="ph-duotone ph-plus"></i>Hinzufügen</button>`);
}
const PHONE = [
  ['home', 'Mönch-Modus zum Home-Bildschirm hinzufügen (Safari, Teilen)'],
  ['old', 'Sonnenklar und Lernklar vom Home-Bildschirm löschen. Deine Daten sind hier drin.'],
  ['focus', 'Fokus „Mönch“ mit eigenem Home-Bildschirm: nur WhatsApp, Kalender, Mönch-Modus, Sales Universe'],
  ['limit', 'Bildschirmzeit: Social Media max. 30 Min am Tag, Code von jemand anderem setzen lassen'],
  ['night', 'Auszeit ab 22 Uhr, Handy lädt außerhalb vom Schlafzimmer, Buch liegt aufs Kissen']
];
function phoneCard() {
  const ph = S.mk.phone || {};
  if (!S.mk.on || ph.hide || PHONE.every(([k]) => ph[k])) return '';
  const n = PHONE.filter(([k]) => ph[k]).length;
  return `<section class="card phone"><div class="card-head"><h2><span class="hic"><i class="ph-duotone ph-device-mobile"></i></span>Handy aufräumen</h2><span class="muted small num">einmalig · ${n}/${PHONE.length}</span></div>
    <div class="steps">${PHONE.map(([k, t]) => `<button class="step ${ph[k] ? 'done' : ''}" data-act="phone" data-id="${k}"><span class="check"><i class="ph-duotone ph-check"></i></span><span class="t">${t}</span></button>`).join('')}</div>
    <button class="link" data-act="phoneHide">Ausblenden</button></section>`;
}
function timerPill() {
  if (!S.ft) return '';
  return `<button class="btn sm primary timer-pill" data-act="tab" data-tab="aufgaben"><i class="ph-duotone ph-timer"></i><span id="ftMini" class="num">…</span></button>`;
}
const blocksOn = k => S.mk.blocks.filter(b => b.days.includes(wdOfK(k)));
function dayCard() {
  const k = today(), now = nowMin(), rows = [];
  const row = (m, end, cls, ic, title, sub, right) => rows.push({ m, h: `<div class="tl ${cls} ${end != null && end <= now ? 'past' : ''} ${m <= now && end != null && end > now ? 'live' : ''}">
    <span class="tl-time num">${m >= 0 && m < 1440 ? UNI.fmtHM(m) : '–'}</span><i class="ph-duotone ${ic} tl-ic"></i><span class="tl-main"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span>${right || ''}</div>` });
  for (const e of UNI.occOn(k)) row(UNI.tmin(e.start), UNI.tmin(e.end), 'uni', UNI.KIND[e.kind].i, esc(e.sid ? UNI.sName(e.sid) : e.title), `${UNI.KIND[e.kind].n} bis ${e.end}${e.room ? ' · ' + esc(e.room) : ''}`, '');
  for (const x of UNI.futureExams().filter(x => x.date === k)) row(x.time ? UNI.tmin(x.time) : 0, null, 'exam', 'ph-seal-warning', `${esc(x.type || 'Prüfung')} ${esc(UNI.sName(x.sid))}`, 'Heute. Du packst das.', '');
  for (const t of UNI.todayPlan().tasks) {
    const d = UNI.isDone(t.key);
    row(t.at != null ? t.at : 1439, null, `task ${d ? 'done' : ''}`, 'ph-brain', esc(UNI.taskTitle(t)), esc(UNI.taskSub(t)),
      d ? '<i class="ph-fill ph-check-circle tl-ok"></i>' : `<button class="tl-play" data-act="u.startTask" data-key="${t.key}" aria-label="Lern-Session starten"><i class="ph-fill ph-play"></i></button>`);
  }
  for (const b of blocksOn(k)) row(tmin(b.time), tmin(b.time) + (+b.min || 0), 'block', b.i || 'ph-square', esc(b.t), `${b.min} Min`, `<button class="tl-play" data-act="blockGo" data-id="${b.id}" aria-label="Fokus-Timer starten"><i class="ph-fill ph-play"></i></button>`);
  for (const e of S.cal.events.filter(e => e.d === k)) row(e.s ? tmin(e.s) : -1, e.e ? tmin(e.e) : null, 'cal', 'ph-calendar-blank', esc(e.t), e.s ? (e.e ? `bis ${e.e}` : 'Termin') : 'ganztägig', '');
  for (const e of (S.cal.own || []).filter(e => e.d === k)) row(e.s ? tmin(e.s) : -1, e.e ? tmin(e.e) : null, 'cal', 'ph-users-three', esc(e.t), e.e ? `bis ${e.e}` : 'Termin', `<button class="mini" data-act="ownDel" data-id="${e.id}" aria-label="Termin löschen"><i class="ph-duotone ph-x"></i></button>`);
  rows.sort((a, b) => a.m - b.m);
  const i = rows.findIndex(r => r.m > now);
  const nowLine = `<div class="tl-now"><span class="num">${UNI.fmtHM(now)}</span></div>`;
  if (rows.length) rows.splice(i < 0 ? rows.length : i, 0, { h: nowLine });
  const ex = UNI.futureExams().filter(x => x.date > k).slice(0, 3);
  const setup = !UNI.hasSubjects();
  return `<section class="card day-card"><div class="card-head"><h2><span class="hic"><i class="ph-duotone ph-calendar-dots"></i></span>Heute</h2><div class="row" style="gap:6px"><button class="mini" data-act="ownAdd" aria-label="Termin eintragen" title="Termin eintragen"><i class="ph-duotone ph-plus"></i></button><button class="link" data-act="calSheet">Kalender</button></div></div>
    ${rows.length ? `<div class="tl-list">${rows.map(r => r.h).join('')}</div>` : `<p class="muted">Nichts Festes heute. Termin mit + eintragen oder unter Kalender deinen iPhone-Kalender verbinden.</p>`}
    ${ex.length ? `<div class="exams-row">${ex.map(x => { const d = UNI.diffD(today(), x.date); return `<button class="pill-ex" data-act="u.open" data-v="faecher" style="--c:${UNI.sColor(x.sid)}"><b class="num">${d}</b> ${d === 1 ? 'Tag' : 'Tage'} bis ${esc(x.type || 'Prüfung')} ${esc(UNI.sName(x.sid))}</button>`; }).join('')}</div>` : ''}
    ${setup ? `<button class="btn sm block-btn" data-act="u.open" data-v="heute"><i class="ph-duotone ph-graduation-cap"></i>Uni einrichten: Fächer, Prüfungen, Stundenplan</button>` : ''}
  </section>`;
}
/* ---------- Heute: Briefing, Kalender, Gewohnheiten ---------- */
const calOn = k => [...S.cal.events, ...(S.cal.own || [])].filter(e => e.d === k);
const joinDE = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' und ' + a[a.length - 1];
function briefing() {
  const k = today(), now = nowMin();
  const cal = calOn(k), vl = UNI.occOn(k), tasks = UNI.todayPlan().tasks.filter(t => !UNI.isDone(t.key)), blocks = blocksOn(k);
  const parts = [];
  if (cal.length) parts.push(`${cal.length} ${cal.length === 1 ? 'Termin' : 'Termine'}`);
  if (vl.length) parts.push(`${vl.length}× Uni`);
  if (tasks.length) parts.push(`${tasks.length}× Lernen`);
  const named = blocks.filter(b => !/lesen|wochenplan/i.test(b.t)).map(b => b.t);
  if (named.length) parts.push(joinDE([...new Set(named)]));
  let s = parts.length ? `Heute: ${joinDE(parts)}.` : 'Heute steht nichts Festes an. Guter Tag für Deep Work.';
  const next = [
    ...cal.filter(e => e.s).map(e => ({ m: tmin(e.s), t: e.t })),
    ...vl.map(e => ({ m: UNI.tmin(e.start), t: e.sid ? UNI.sName(e.sid) : e.title })),
    ...blocks.map(b => ({ m: tmin(b.time), t: b.t }))
  ].filter(x => x.m > now).sort((a, b) => a.m - b.m)[0];
  if (next) s += ` Als Nächstes um ${UNI.fmtHM(next.m)}: ${next.t}.`;
  if (S.work.on) { const w = workCalc(); if (w.left > 0) s += ` Werkstudent: noch ${fh(w.left)} diese Woche.`; }
  const ex = UNI.futureExams().filter(x => x.date >= k)[0];
  if (ex) { const d = UNI.diffD(k, ex.date); s += d === 0 ? ` Heute ist ${ex.type || 'Prüfung'} ${UNI.sName(ex.sid)}.` : ` ${ex.type || 'Prüfung'} ${UNI.sName(ex.sid)} in ${d} ${d === 1 ? 'Tag' : 'Tagen'}.`; }
  return `<div class="brief"><div class="brief-m">${sunni('ok', curWhich() === 'e')}</div><p>${esc(s)}</p></div>`;
}
const SHORT = { wake: 'Früh auf', lern: 'Lernen', p4: 'P4', sport: 'Training', lesen: 'Lesen', social: 'Social', geld: 'Kein Kauf' };
function habitStrip() {
  const mm = moodOf('m'), me = moodOf('e');
  const routines = `<div class="routine-row">
      <button class="rchip ${mm.p >= 1 ? 'done' : ''}" data-act="focus" data-w="m"><i class="ph-duotone ph-sun-horizon"></i>Morgen <b class="num">${mm.done}/${mm.total}</b></button>
      <button class="rchip ${me.p >= 1 ? 'done' : ''}" data-act="focus" data-w="e"><i class="ph-duotone ph-moon-stars"></i>Abend <b class="num">${me.done}/${me.total}</b></button>
      <button class="rchip ghost" data-act="tab" data-tab="routinen" aria-label="Routinen anpassen"><i class="ph-duotone ph-pencil-simple"></i>Anpassen</button></div>`;
  if (!S.mk.on) return `<section class="card habits"><div class="card-head"><h2><span class="hic"><i class="ph-duotone ph-repeat"></i></span>Routinen</h2></div>${routines}
    <button class="btn sm" data-act="mkSetup" style="margin-top:12px"><i class="ph-duotone ph-flame"></i>Mönch-Modus starten</button></section>`;
  const n = S.mk.pillars.length, done = mkDone(), won = done >= mkNeed(), st = mkStreak();
  const total = mkTotal(), day = Math.min(mkDay(), total);
  return `<section class="card habits ${won ? 'won' : ''}">
    <div class="card-head"><h2><span class="hic"><i class="ph-duotone ph-flame"></i></span>Tag ${day}<span class="muted small" style="font-family:inherit;margin-left:6px">von ${total}</span></h2>
      <button class="link" data-act="mkSettings">${won ? 'Gewonnen' : `${done}/${n}`}${st ? ` · ${st} 🔥` : ''}</button></div>
    <div class="hab-row">${S.mk.pillars.map(p => { const d = pillarDone(p);
      return `<button class="hab ${d ? 'done' : ''} ${ui.pulse === p.id ? 'pulse' : ''}" style="--pc:var(--${PCOL[p.id] || 'saffron'})" data-act="pillar" data-id="${p.id}" title="${esc(pillarText(p))}" aria-label="${esc(pillarText(p))}"><span class="hab-i"><i class="ph-duotone ${p.i || 'ph-circle'}"></i></span><small>${esc(SHORT[p.id] || p.t.split(' ').slice(0, 2).join(' '))}</small></button>`; }).join('')}</div>
    ${routines}
  </section>`;
}
function top3Card() {
  const top = L().top;
  return `<section class="card top3"><div class="card-head"><h2><span class="hic"><i class="ph-duotone ph-target"></i></span>Top 3</h2><span class="muted small num">${top.filter(t => t.done).length}/${top.length || 3}</span></div>
    ${top.map((t, i) => `<div class="slot ${t.done ? 'done' : ''}"><button class="n" data-act="topToggle" data-i="${i}">${t.done ? '<i class="ph-duotone ph-check"></i>' : i + 1}</button><button class="txt" data-act="topToggle" data-i="${i}">${esc(t.t)}</button><button class="x-btn" data-act="topDel" data-i="${i}" aria-label="Entfernen"><i class="ph-duotone ph-x"></i></button></div>`).join('')}
    ${top.length < 3 ? `<form class="slot" data-form="top"><span class="n">${top.length + 1}</span><input id="topIn" class="empty-in" name="t" autocomplete="off" placeholder="${top.length ? 'Und was noch?' : 'Was bringt dich heute wirklich weiter?'}"><button class="add-btn" style="width:36px;height:36px;font-size:16px" aria-label="Hinzufügen"><i class="ph-duotone ph-plus"></i></button></form>` : ''}
  </section>`;
}
function phoneLine() {
  const ph = S.mk.phone || {};
  if (!S.mk.on || ph.hide || PHONE.every(([k]) => ph[k])) return '';
  return `<button class="phone-line" data-act="phoneSheet"><i class="ph-duotone ph-device-mobile"></i><span>Handy aufräumen <small>einmalig · ${PHONE.filter(([k]) => ph[k]).length}/${PHONE.length}</small></span><i class="ph-duotone ph-caret-right"></i></button>`;
}
function phoneSheet() {
  const ph = S.mk.phone || {};
  openSheet(`${sheetHead('Handy aufräumen')}<p class="muted small" style="margin-bottom:12px">Einmal machen, dann ist Ruhe. Weniger Apps, weniger Lärm.</p>
    <div class="steps" style="display:grid;gap:8px">${PHONE.map(([k, t]) => `<button class="step ${ph[k] ? 'done' : ''}" data-act="phone" data-id="${k}"><span class="check"><i class="ph-duotone ph-check"></i></span><span class="t">${t}</span></button>`).join('')}</div>
    <button class="btn ghost block" data-act="phoneHide" style="margin-top:12px">Nicht mehr anzeigen</button>`);
}
function pasteBanner() {
  if (!S.cal.shortcut || S.cal.pasted === today()) return '';
  return `<button class="paste-banner" data-act="calPaste"><i class="ph-duotone ph-clipboard-text"></i><span>Kalender von heute einfügen<small>Dein Kurzbefehl hat ihn kopiert. Einmal tippen.</small></span></button>`;
}
function ownSheet() {
  openSheet(`${sheetHead('Termin eintragen')}
  <form class="form" data-form="own" style="display:grid;gap:10px">
    <label class="f">Was?<input class="input" name="t" placeholder="z. B. Meeting mit Kunde, Cold Calling" autocomplete="off" autofocus></label>
    <div style="display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:8px"><label class="f">Tag<input class="input" type="date" name="d" value="${today()}"></label><label class="f">Von<input class="input" type="time" name="s" value="${pad(Math.min(23, new Date().getHours() + 1))}:00"></label><label class="f">Bis<input class="input" type="time" name="e"></label></div>
    <button class="btn primary block"><i class="ph-duotone ph-plus"></i>Eintragen</button>
  </form>`);
}
function pasteSheet() {
  openSheet(`${sheetHead('Termine einfügen')}<p class="muted small" style="margin-bottom:10px">Eine Zeile pro Termin: <b>2026-11-10 14:00|15:00|Meeting</b></p>
  <form class="form" data-form="paste" style="display:grid;gap:10px"><textarea class="input" name="txt" rows="7" placeholder="2026-11-10 14:00|15:00|Meeting"></textarea><button class="btn primary block">Übernehmen</button></form>`);
}
function importPasted(txt) {
  const out = [];
  const iso = d => { const m = d.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); return m ? `${m[3]}-${pad(m[2])}-${pad(m[1])}` : d; };
  for (const line of String(txt || '').split(/\r?\n/)) {
    const m = line.trim().match(/^(\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4})[ T,]+(\d{1,2}:\d{2})\s*\|\s*(?:\d{4}-\d{2}-\d{2}\s+|\d{1,2}\.\d{1,2}\.\d{4}\s+)?(\d{1,2}:\d{2})?\s*\|\s*(.+)$/);
    if (!m) continue;
    const d = iso(m[1]), s = m[2].padStart(5, '0'), e = (m[3] || '').padStart(m[3] ? 5 : 0, '0');
    out.push(s === '00:00' && (!e || e === '00:00') ? { d, t: m[4].trim(), src: 'paste' } : { d, s, e, t: m[4].trim(), src: 'paste' });
  }
  if (!out.length) { toast('Keine Termine erkannt. Format: 2026-11-10 14:00|15:00|Titel'); return false; }
  const days = new Set(out.map(x => x.d));
  S.cal.events = S.cal.events.filter(e => !days.has(e.d)).concat(out);
  S.cal.shortcut = true; S.cal.pasted = today();
  persist(); closeSheet(); render();
  const t = out.filter(x => x.d === today()).length;
  toast(t ? `${t} ${t === 1 ? 'Termin' : 'Termine'} heute. Steht unter „Heute“.` : `${out.length} Termine übernommen.`);
  return true;
}
/* ---------- Werkstudent: Stundenkonto ---------- */
// Konto = Startstand + alle eingetragenen Stunden − Soll für jede abgeschlossene Woche seit Start.
function workCalc() {
  const w = S.work, m0 = monday();
  const weeksDone = Math.max(0, Math.round(diffD(w.start, m0) / 7));
  const sum = (from, to) => Object.entries(w.log).filter(([k]) => k >= from && k <= to).reduce((a, [, h]) => a + h, 0);
  const before = sum('0000', addD(m0, -1)), week = sum(m0, addD(m0, 6)), todayH = w.log[today()] || 0;
  const balStart = w.startBal + before - w.target * weeksDone; // Stand am Montag dieser Woche
  const endK = S.mk.end && S.mk.end > m0 ? S.mk.end : addD(m0, 70);
  const weeksLeft = Math.max(4, Math.ceil(diffD(m0, endK) / 7));
  const extra = balStart < 0 ? Math.ceil(-balStart / weeksLeft) : 0;
  const goal = w.target + extra;
  return { week, todayH, goal, extra, bal: balStart + week - w.target, balStart, left: Math.max(0, goal - week) };
}
const fh = h => (Math.round(h * 10) / 10).toLocaleString('de-DE') + ' Std';
function workCard() {
  if (!S.work.on) return '';
  const c = workCalc(), p = Math.min(100, c.week / Math.max(1, c.goal) * 100);
  return `<section class="card work"><div class="card-head"><h2><span class="hic"><i class="ph-duotone ph-briefcase"></i></span>Werkstudent</h2><button class="link" data-act="workSheet">Konto ${c.balStart >= 0 ? '+' : ''}${fh(c.balStart)}</button></div>
    <div class="mm"><b class="num">${fh(c.week)}</b><span class="muted small">von ${fh(c.goal)} diese Woche${c.extra ? ` (${c.target || S.work.target} + ${c.extra} zum Aufholen)` : ''}</span></div>
    <div class="bar"><i style="--w:${p}%"></i></div>
    <div class="work-add"><span class="muted small">Heute ${fh(c.todayH)}</span>${[1, 4, 8].map(h => `<button class="chip" data-act="workAdd" data-h="${h}">+${h} Std</button>`).join('')}</div>
  </section>`;
}
function workSheet() {
  const w = S.work, c = workCalc();
  const days = Object.entries(w.log).filter(([k]) => k >= monday()).sort();
  openSheet(`${sheetHead('Werkstudent')}
  <div class="set-sec"><p class="muted small">Stundenkonto am Montag: <b>${fh(c.balStart)}</b>. Um bis ${fmtDate(S.mk.end || addD(today(), 70))} auf null zu kommen, brauchst du pro Woche <b>${fh(c.goal)}</b>.</p>
    <form class="add-row" data-form="work"><input class="input num" name="h" inputmode="decimal" placeholder="Stunden, z. B. 5,5" autocomplete="off"><input class="input" type="date" name="d" value="${today()}" style="max-width:150px"><button class="add-btn" aria-label="Eintragen"><i class="ph-duotone ph-plus"></i></button></form>
    <div class="list" style="margin-top:10px">${days.map(([k, h]) => `<div class="money-row"><i class="ph-duotone ph-clock"></i><span class="t">${pdk(k).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' })}</span><b class="num">${fh(h)}</b><button class="mini" data-act="workDel" data-k="${k}" aria-label="Löschen"><i class="ph-duotone ph-trash"></i></button></div>`).join('') || '<p class="muted small">Diese Woche noch nichts eingetragen.</p>'}</div></div>
  <div class="set-sec"><h3>Vertrag</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="f">Soll pro Woche<input class="input num" type="number" min="0" step="0.5" data-work="target" value="${w.target}"></label><label class="f">Stand zum Start<input class="input num" type="number" step="0.5" data-work="startBal" value="${w.startBal}"></label></div>
    <p class="muted small" style="margin-top:6px">Stand zum Start = dein Stundenkonto am ${fmtDate(w.start)} (minus = du schuldest Stunden).</p>
    <button class="btn ghost block" data-act="workBlock" style="margin-top:10px"><i class="ph-duotone ph-calendar-plus"></i>Feste Arbeitstage als Blöcke eintragen</button></div>`);
}
function goalsCard() {
  const wk = monday(), g = S.goals[wk] || [];
  const isSun = wdOfK(today()) === 'so';
  return `<section class="card top3 wkgoals"><div class="card-head"><h2><span class="hic"><i class="ph-duotone ph-flag-pennant"></i></span>3 Ergebnisse diese Woche</h2><span class="muted small num">${g.filter(x => x.done).length}/${g.length || 3}</span></div>
    ${g.map((t, i) => `<div class="slot ${t.done ? 'done' : ''}"><button class="n" data-act="goalToggle" data-i="${i}">${t.done ? '<i class="ph-duotone ph-check"></i>' : i + 1}</button><button class="txt" data-act="goalToggle" data-i="${i}">${esc(t.t)}</button><button class="x-btn" data-act="goalDel" data-i="${i}" aria-label="Entfernen"><i class="ph-duotone ph-x"></i></button></div>`).join('')}
    ${g.length < 3 ? `<form class="slot" data-form="goal"><span class="n">${g.length + 1}</span><input id="goalIn" class="empty-in" name="t" autocomplete="off" placeholder="${g.length ? 'Was noch bis Sonntag?' : 'Was muss bis Sonntag fertig sein?'}"><button class="add-btn" style="width:36px;height:36px;font-size:16px" aria-label="Hinzufügen"><i class="ph-duotone ph-plus"></i></button></form>` : ''}
    <p class="muted small" style="margin-top:8px">${isSun ? 'Sonntag: Woche abhaken, Ideen durchgehen, nächste Woche planen.' : 'Gemessen wird an Ergebnissen, nicht an Beschäftigung.'}</p>
  </section>`;
}
function ideaCard() {
  const n = S.ideas.length, isSun = wdOfK(today()) === 'so';
  return `<section class="card idea"><div class="card-head"><h2><span class="hic"><i class="ph-duotone ph-lightbulb"></i></span>Neue Idee?</h2>${n ? `<button class="link" data-act="ideasOpen">${n} geparkt</button>` : ''}</div>
    <p class="muted small">Aufschreiben, nicht anfangen. Sonntags schaust du drauf, das meiste kann dann weg.</p>
    <form class="add-row" data-form="idea"><input id="ideaIn" class="input" name="t" autocomplete="off" placeholder="z. B. neue App, neues Projekt, neues Tool"><button class="add-btn" aria-label="Parken"><i class="ph-duotone ph-local-parking"></i></button></form>
    ${isSun && n ? `<button class="btn sm" data-act="ideasOpen" style="margin-top:10px"><i class="ph-duotone ph-broom"></i>Jetzt durchgehen</button>` : ''}
  </section>`;
}

/* ---------- Geld ---------- */
const CATS = [['essen', 'Essen & Trinken', 'ph-hamburger'], ['aus', 'Ausgehen', 'ph-beer-stein'], ['shop', 'Shopping', 'ph-shopping-bag'], ['abo', 'Abos', 'ph-repeat'], ['weg', 'Transport', 'ph-train'], ['sonst', 'Sonstiges', 'ph-dots-three']];
const catOf = c => CATS.find(x => x[0] === c) || CATS[CATS.length - 1];
function weekMoney() {
  const m = monday(), e = addD(m, 6), k = today();
  const items = S.geld.items.filter(x => x.d >= m && x.d <= e);
  const spent = items.reduce((a, x) => a + x.a, 0), left = S.geld.week - spent;
  const days = diffD(k, e) + 1;
  return { items, spent, left, perDay: left / Math.max(1, days), days };
}
const paydayDue = () => S.geld.save > 0 && +today().slice(8, 10) >= S.geld.payday && !S.geld.saved[ym()];
function spendForm(id) {
  return `<form class="spend-form" data-form="spend"><input id="${id}" class="input num" name="a" inputmode="decimal" autocomplete="off" placeholder="€" aria-label="Betrag"><input class="input" name="t" autocomplete="off" placeholder="Wofür?" aria-label="Wofür">
    <select class="input" name="c" aria-label="Kategorie">${CATS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select><button class="add-btn" aria-label="Eintragen"><i class="ph-duotone ph-plus"></i></button></form>`;
}
function geldMini() {
  const w = weekMoney(), p = Math.max(0, Math.min(100, w.spent / Math.max(1, S.geld.week) * 100));
  return `<section class="card money-mini"><div class="card-head"><h2><span class="hic"><i class="ph-duotone ph-wallet"></i></span>Geld diese Woche</h2><button class="link" data-act="tab" data-tab="geld">Details</button></div>
    ${paydayDue() ? `<button class="payday" data-act="saveToggle"><i class="ph-duotone ph-piggy-bank"></i><span>Gehalt da? Erst <b>${eur(S.geld.save)}</b> aufs Sparkonto. Tippen, wenn erledigt.</span></button>` : ''}
    <div class="mm"><b class="num ${w.left < 0 ? 'neg' : ''}">${eur(w.left)}</b><span class="muted small">übrig von ${eur(S.geld.week)}${w.left > 0 ? ` · ${eur(w.perDay)} pro Tag` : ''}</span></div>
    <div class="bar ${w.left < 0 ? 'over' : ''}"><i style="--w:${p}%"></i></div>
    ${spendForm('spendHome')}
  </section>`;
}
function rGeld() {
  const w = weekMoney(), g = S.geld, k = today();
  const mItems = g.items.filter(x => ym(x.d) === ym(k)), mSum = mItems.reduce((a, x) => a + x.a, 0);
  const lastYm = ym(addD(ym(k) + '-01', -1)), lSum = g.items.filter(x => ym(x.d) === lastYm).reduce((a, x) => a + x.a, 0);
  const byCat = CATS.map(([c, l, i]) => ({ c, l, i, s: mItems.filter(x => x.c === c).reduce((a, x) => a + x.a, 0) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
  const mx = Math.max(1, ...byCat.map(x => x.s));
  const p = Math.max(0, Math.min(100, w.spent / Math.max(1, g.week) * 100));
  const row = x => `<div class="money-row"><i class="ph-duotone ${catOf(x.c)[2]}"></i><span class="t">${esc(x.t || catOf(x.c)[1])}<small>${fmtDate(x.d)} · ${catOf(x.c)[1]}</small></span><b class="num">${eur(x.a)}</b><button class="mini" data-act="spendDel" data-id="${x.id}" aria-label="Löschen"><i class="ph-duotone ph-trash"></i></button></div>`;
  return `${head('Geld', 'Langfristig denken, nicht kurzfristig')}
  <div class="stack geld">
    <section class="card money-week"><div class="card-head"><h2><span class="hic"><i class="ph-duotone ph-calendar-blank"></i></span>Diese Woche</h2><span class="muted small">Mo ${fmtDate(monday())} bis So</span></div>
      <div class="mm big"><b class="num ${w.left < 0 ? 'neg' : ''}">${eur(w.left)}</b><span class="muted">übrig von ${eur(g.week)}${w.left > 0 ? ` · noch ${eur(w.perDay)} pro Tag` : w.left < 0 ? ' · drüber, nächste Woche gegensteuern' : ''}</span></div>
      <div class="bar ${w.left < 0 ? 'over' : ''}"><i style="--w:${p}%"></i></div>
      ${spendForm('spendIn')}
      <div class="list" style="margin-top:12px">${w.items.slice().sort((a, b) => b.ts - a.ts).map(row).join('') || '<p class="muted small">Noch nichts ausgegeben diese Woche. Jede Ausgabe kurz eintragen, auch die 3 € Kaffee.</p>'}</div>
    </section>
    <section class="card"><div class="card-head"><h2><span class="hic"><i class="ph-duotone ph-piggy-bank"></i></span>Gehaltstag: zuerst sparen</h2></div>
      ${g.save > 0 ? `<button class="payday ${g.saved[ym()] ? 'ok' : ''}" data-act="saveToggle"><i class="ph-duotone ${g.saved[ym()] ? 'ph-check-circle' : 'ph-piggy-bank'}"></i><span>${g.saved[ym()] ? `Diesen Monat erledigt: <b>${eur(g.save)}</b> gespart.` : `Am ${g.payday}. gehen <b>${eur(g.save)}</b> aufs Sparkonto, bevor du etwas ausgibst. Tippen, wenn erledigt.`}</span></button>
        <p class="muted small" style="margin-top:8px">Am besten als Dauerauftrag bei deiner Bank. Dann musst du gar nicht dran denken.</p>` : `<p class="muted">Leg unten einen Sparbetrag fest. Der geht jeden Monat zuerst weg, der Rest ist zum Leben.</p>`}
    </section>
    <section class="card"><div class="card-head"><h2><span class="hic"><i class="ph-duotone ph-chart-pie-slice"></i></span>${new Date().toLocaleDateString('de-DE', { month: 'long' })}</h2><b class="num">${eur(mSum)}</b></div>
      ${byCat.map(x => `<div class="hbar"><span><i class="ph-duotone ${x.i}"></i> ${x.l}</span><div class="bar thin"><i style="--w:${Math.round(x.s / mx * 100)}%"></i></div><b class="num">${eur(x.s)}</b></div>`).join('') || '<p class="muted small">Noch keine Ausgaben in diesem Monat.</p>'}
      ${lSum ? `<p class="muted small" style="margin-top:10px">Letzter Monat: ${eur(lSum)}</p>` : ''}
    </section>
    <section class="card"><div class="card-head"><h2><span class="hic"><i class="ph-duotone ph-hourglass-medium"></i></span>Wunschliste</h2>${g.notBought ? `<span class="pill-ok">${eur(g.notBought)} nicht ausgegeben</span>` : ''}</div>
      <p class="muted small">72-Stunden-Regel: Was du willst, kommt erst hier rein. Willst du es nach 3 Tagen immer noch, okay.</p>
      <form class="spend-form" data-form="wish"><input class="input" name="t" autocomplete="off" placeholder="Was willst du kaufen?" aria-label="Was"><input class="input num" name="a" inputmode="decimal" autocomplete="off" placeholder="€" aria-label="Preis"><button class="add-btn" aria-label="Auf die Wunschliste"><i class="ph-duotone ph-plus"></i></button></form>
      <div class="list" style="margin-top:12px">${g.wish.map(x => { const ok = Date.now() - x.ts > 72 * 3600e3; const h = Math.ceil((72 * 3600e3 - (Date.now() - x.ts)) / 3600e3);
        return `<div class="money-row"><i class="ph-duotone ${ok ? 'ph-lock-open' : 'ph-hourglass'}"></i><span class="t">${esc(x.t)}<small>${ok ? 'Wartezeit vorbei. Willst du es noch?' : `noch ${h} Std. warten`}</small></span><b class="num">${eur(x.a)}</b>
          <button class="mini" data-act="wishDrop" data-id="${x.id}" title="Doch nicht" aria-label="Doch nicht kaufen"><i class="ph-duotone ph-x"></i></button>${ok ? `<button class="mini" data-act="wishBuy" data-id="${x.id}" title="Gekauft" aria-label="Gekauft"><i class="ph-duotone ph-check"></i></button>` : ''}</div>`; }).join('')}</div>
    </section>
    <section class="card"><div class="card-head"><h2><span class="hic"><i class="ph-duotone ph-sliders-horizontal"></i></span>Deine Zahlen</h2></div>
      <div class="three"><label class="f">Wochenbudget €<input class="input num" type="number" min="0" inputmode="decimal" data-gset="week" value="${g.week}"></label>
      <label class="f">Sparen pro Monat €<input class="input num" type="number" min="0" inputmode="decimal" data-gset="save" value="${g.save}"></label>
      <label class="f">Gehaltstag<input class="input num" type="number" min="1" max="31" data-gset="payday" value="${g.payday}"></label></div>
      <p class="muted small" style="margin-top:8px">Wochenbudget = alles, was nicht Miete, Versicherung oder feste Abos ist. Keine Anlageberatung, nur Überblick.</p>
    </section>
  </div>`;
}

/* ---------- Kalender ---------- */
function exportAll() {
  const items = UNI.exportItems();
  const k0 = today(), end = S.mk.end && S.mk.end > k0 ? S.mk.end : addD(k0, 90);
  const until = window.LK_ICS.dt(end) + 'T235900';
  const BY = { mo: 'MO', di: 'TU', mi: 'WE', do: 'TH', fr: 'FR', sa: 'SA', so: 'SU' };
  for (const b of S.mk.blocks) {
    if (!b.days.length) continue;
    let k = k0; while (!b.days.includes(wdOfK(k))) k = addD(k, 1);
    items.push({ uid: `moench-${b.id}@moench`, title: `${b.t} · Mönch-Modus`, date: k, time: b.time, min: +b.min || 30,
      rrule: `FREQ=WEEKLY;BYDAY=${b.days.map(d => BY[d]).join(',')};UNTIL=${until}`, desc: `Handy weg, Timer an. ${location.origin + location.pathname}`, alarms: ['-PT5M'] });
  }
  if (S.geld.save > 0) {
    let k = k0.slice(0, 8) + String(Math.min(28, S.geld.payday)).padStart(2, '0'); if (k < k0) k = addD(ym(addD(ym(k0) + '-01', 32)) + '-01', Math.min(28, S.geld.payday) - 1);
    items.push({ uid: 'moench-payday@moench', title: `Gehalt: zuerst ${eur(S.geld.save)} sparen`, date: k, time: '09:00', min: 10,
      rrule: `FREQ=MONTHLY;BYMONTHDAY=${Math.min(28, S.geld.payday)};UNTIL=${until}`, alarms: ['PT0M'] });
  }
  for (const m of medsActive()) {
    const u = m.until && m.until < end ? m.until : end;
    items.push({ uid: `moench-med-${m.id}@moench`, title: `${m.t} nehmen 💊`, date: k0, time: m.time, min: 5,
      rrule: `FREQ=DAILY;UNTIL=${window.LK_ICS.dt(u)}T235900`, alarms: ['PT0M'] });
  }
  if (S.mk.on && S.mk.end) items.push({ uid: 'moench-ende@moench', title: 'Mönch-Modus: Ziel erreicht? Bilanz ziehen', date: S.mk.end, alarms: ['-PT12H'] });
  return items;
}
function calSheet() {
  const c = S.cal, n = c.events.filter(e => e.d >= today()).length;
  openSheet(`${sheetHead('Kalender')}
  <div class="set-sec"><h3>iPhone-Kalender verbinden</h3>
    <p class="muted small">Eine Web-App darf deinen Kalender nicht selbst lesen. Ein Kurzbefehl kopiert ihn dir jeden Morgen, die App fügt ihn mit einem Tipp ein. Einmal einrichten, ca. 3 Minuten:</p>
    <ol class="howto">
      <li>App <b>Kurzbefehle</b>, neuer Kurzbefehl „Mönch Kalender“.</li>
      <li>Aktion <b>Kalenderereignisse suchen</b>: Startdatum <b>ist heute</b>.</li>
      <li>Aktion <b>Wiederholen mit jedem Objekt</b>, darin <b>Text</b>:<br><code>Startdatum|Enddatum|Titel</code><br>Startdatum antippen, Format <b>Benutzerdefiniert</b>: <code>yyyy-MM-dd HH:mm</code>. Enddatum: <code>HH:mm</code>.</li>
      <li>Danach <b>Text kombinieren</b> (mit Neue Zeile) und <b>In Zwischenablage kopieren</b>.</li>
      <li>Reiter <b>Automation</b>: Tageszeit 6:00, täglich, <b>Sofort ausführen</b>, Kurzbefehl „Mönch Kalender“.</li>
    </ol>
    <div class="row" style="flex-wrap:wrap;gap:8px"><button class="btn primary" data-act="calPaste"><i class="ph-duotone ph-clipboard-text"></i>Jetzt einfügen</button><button class="btn ghost" data-act="pasteSheet">Von Hand einfügen</button></div>
    ${n ? `<p class="small" style="margin-top:8px">${n} kommende Termine geladen. <button class="link" data-act="calClear">Entfernen</button></p>` : ''}</div>
  <div class="set-sec"><h3>Einzelner Termin</h3><button class="btn block" data-act="ownAdd"><i class="ph-duotone ph-plus"></i>Termin eintragen</button></div>
  <div class="set-sec"><h3>Uni-Stundenplan</h3><button class="btn block" data-act="u.importIcs"><i class="ph-duotone ph-graduation-cap"></i>Stundenplan aus dem Uni-Portal (.ics)</button>
    <button class="btn ghost block" data-act="calPick" style="margin-top:8px"><i class="ph-duotone ph-file-arrow-up"></i>Andere .ics-Datei laden</button></div>
  <div class="set-sec"><h3>Andersrum: in deinen Kalender</h3><p class="muted small">Lernzeiten, feste Blöcke, Prüfungen, Tabletten und Gehaltstag mit Wecker. Dann klingelt dein iPhone, auch wenn die App zu ist.</p>
    <button class="btn block" data-act="calExport"><i class="ph-duotone ph-calendar-plus"></i>In meinen Kalender eintragen</button>
    <button class="btn ghost block" data-act="mkBlocks" style="margin-top:8px"><i class="ph-duotone ph-squares-four"></i>Feste Blöcke bearbeiten</button></div>`);
}
function importCal(txt, name) {
  const ICS = window.LK_ICS; let evs;
  try { evs = ICS.parse(txt); } catch (e) { toast('Die Datei konnte ich nicht lesen.'); return; }
  const from = addD(today(), -1), to = addD(today(), 120), out = [];
  const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  for (const ev of evs) {
    if (ev.status === 'CANCELLED') continue;
    for (const o of ICS.expand(ev)) {
      const d = dk(o.date); if (d < from || d > to) continue;
      out.push(ev.s.allDay ? { d, t: ev.sum || 'Termin' } : { d, s: hm(o.date), e: hm(o.end), t: ev.sum || 'Termin' });
      if (out.length > 800) break;
    }
  }
  if (!out.length) { toast('Keine kommenden Termine gefunden.'); return; }
  S.cal.events = out; S.cal.name = name; persist(); calSheet(); render();
  toast(`${out.length} Termine übernommen.`);
}
function mkSettingsSheet() {
  const m = S.mk;
  openSheet(`${sheetHead('Mönch-Modus anpassen')}
  <div class="set-sec"><label class="f">Wofür machst du das?<input class="input" data-mk="why" value="${esc(m.why)}"></label>
    <div class="two" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="f">Start<input class="input" type="date" data-mk="start" value="${m.start || today()}"></label><label class="f">Ende<input class="input" type="date" data-mk="end" value="${m.end || addD(today(), 89)}"></label></div>
    <div class="two" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="f">Aufstehen bis<input class="input" type="time" data-mk="wake" value="${m.wake}"></label><label class="f">Aktuelles Buch<input class="input" data-mk="book" value="${esc(m.book)}" placeholder="Titel"></label></div></div>
  <div class="set-sec"><h3>Deine Säulen</h3><p class="muted small">Jeden Tag abhaken. Ein Tag ist gewonnen, wenn höchstens eine fehlt.</p>
    <div class="list">${m.pillars.map(p => `<div class="rstep"><i class="ph-duotone ${p.i || 'ph-circle'}" style="font-size:20px;color:var(--accent-deep)"></i><input class="input" data-pil="${p.id}" value="${esc(p.t)}" aria-label="Säule"><span class="acts"><button class="mini" data-act="pilDel" data-id="${p.id}" aria-label="Löschen"><i class="ph-duotone ph-trash"></i></button></span></div>`).join('')}</div>
    ${m.pillars.length < 9 ? `<form class="add-row" data-form="pil"><input id="pilIn" class="input" name="t" autocomplete="off" placeholder="Neue Säule, z. B. 10 Cold Calls"><button class="add-btn" aria-label="Hinzufügen"><i class="ph-duotone ph-plus"></i></button></form>` : ''}</div>
  <div class="set-sec"><button class="btn block" data-act="mkBlocks"><i class="ph-duotone ph-squares-four"></i>Feste Blöcke (Kalender)</button>
    <button class="btn ghost block" data-act="mkStop" style="margin-top:8px"><i class="ph-duotone ph-pause"></i>Mönch-Modus pausieren</button></div>`);
}
function mkBlocksSheet() {
  openSheet(`${sheetHead('Feste Blöcke')}<p class="muted small" style="margin-bottom:12px">Stehen jeden Tag unter „Dein Tag“ und kommen beim Eintragen in deinen Kalender. Play startet den Fokus-Timer.</p>
  <div class="stack" style="gap:12px">${S.mk.blocks.map(b => `<div class="blk"><div class="row"><input class="input" data-blk="${b.id}" data-k="t" value="${esc(b.t)}" aria-label="Name"><button class="mini" data-act="blkDel" data-id="${b.id}" aria-label="Löschen"><i class="ph-duotone ph-trash"></i></button></div>
    <div class="days-row">${WEEK.map(d => `<button class="dchip ${b.days.includes(d) ? 'on' : ''}" data-act="blkDay" data-id="${b.id}" data-d="${d}">${WDL[d].slice(0, 2)}</button>`).join('')}</div>
    <div class="row"><label class="f" style="flex:1">Uhrzeit<input class="input" type="time" data-blk="${b.id}" data-k="time" value="${b.time}"></label><label class="f" style="flex:1">Minuten<input class="input num" type="number" min="5" max="480" data-blk="${b.id}" data-k="min" value="${b.min}"></label></div></div>`).join('')}</div>
  <button class="btn block" data-act="blkAdd" style="margin-top:12px"><i class="ph-duotone ph-plus"></i>Block hinzufügen</button>`);
}

function waterHTML(l) {
  const g = S.set.water;
  let s = '';
  for (let i = 0; i < g; i++) s += `<button class="glass ${i < l.w ? 'full' : ''}" data-act="water" data-n="${i + 1}" aria-label="${i + 1} Gläser"></button>`;
  return s + `<span class="muted small num" style="margin-left:6px">${l.w}/${g} Gläser Wasser</span>`;
}

const streak = w => window.SK.streak(S, w);
function streakHTML() {
  const sm = streak('m'), se = streak('e');
  const t = lnow(); const dow = (t.getDay() + 6) % 7;
  const start = new Date(t); start.setDate(t.getDate() - dow - 28);
  const tk = today();
  let cells = '';
  for (let i = 0; i < 35; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const k = dk(d), l = S.log[k];
    const cls = w => !l ? '' : l[w + 'f'] ? 'full' : (l[w] && l[w].length ? 'part' : '');
    cells += `<div class="d ${k === tk ? 'today' : ''} ${k > tk ? 'future' : ''}" title="${d.toLocaleDateString('de-DE')}"><i class="${cls('m')}"></i><i class="${cls('e')}"></i></div>`;
  }
  return `<div class="card-head"><h2>Deine Serie</h2></div>
    <div class="streak"><div class="big num"><i class="ph-fill ph-fire"></i>${sm}</div><p class="muted">${sm === 1 ? 'Tag' : 'Tage'} Morgenroutine am Stück.<br>Abend: ${se} ${se === 1 ? 'Tag' : 'Tage'}.</p></div>
    <div class="wk">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(x => `<span>${x}</span>`).join('')}</div>
    <div class="heat">${cells}</div>
    <div class="heat-legend"><span>Oben: Morgen</span><span>Unten: Abend</span></div>`;
}

function rRoutinen() {
  const w = ui.rWhich || curWhich();
  const r = S.routines[w];
  const total = r.reduce((a, s) => a + (+s.min || 0), 0);
  return `${head('Routinen', 'Dein fester Ablauf')}
  <div class="stack">
    <div class="seg wide"><button class="${w === 'm' ? 'on' : ''}" data-act="rWhich" data-w="m"><i class="ph-duotone ph-sun-horizon"></i>Morgen</button><button class="${w === 'e' ? 'on' : ''}" data-act="rWhich" data-w="e"><i class="ph-duotone ph-moon-stars"></i>Abend</button></div>
    <section class="card">
      <div class="card-head"><h2>${RNAME[w]}</h2><span class="muted small num">${r.length} Schritte, ca. ${total} Min</span></div>
      <div class="list">${r.map((s, i) => `<div class="rstep ${ui.newId === s.id ? 'new' : ''}"><span class="grip num">${i + 1}</span>
        <button class="t" data-act="editStep" data-w="${w}" data-id="${s.id}">${esc(s.t)}${s.min ? ` <span class="muted small num">${s.min} Min</span>` : ''}</button>
        <span class="acts"><button class="mini" data-act="moveStep" data-w="${w}" data-id="${s.id}" data-d="-1" aria-label="Nach oben" ${i === 0 ? 'disabled style="opacity:.3"' : ''}><i class="ph-duotone ph-arrow-up"></i></button>
        <button class="mini" data-act="moveStep" data-w="${w}" data-id="${s.id}" data-d="1" aria-label="Nach unten" ${i === r.length - 1 ? 'disabled style="opacity:.3"' : ''}><i class="ph-duotone ph-arrow-down"></i></button>
        <button class="mini" data-act="delStep" data-w="${w}" data-id="${s.id}" aria-label="Löschen"><i class="ph-duotone ph-trash"></i></button></span></div>`).join('') || `<div class="empty"><span class="em">🧩</span>Noch leer. Was machst du als Erstes?</div>`}</div>
      <form class="add-row" data-form="step" data-w="${w}"><input id="stepIn" class="input" name="t" autocomplete="off" placeholder="Neuer Schritt, z. B. Zähne putzen"><input class="input min-in num" name="min" type="number" min="0" max="240" inputmode="numeric" placeholder="Min" aria-label="Minuten"><button class="add-btn" aria-label="Hinzufügen"><i class="ph-duotone ph-plus"></i></button></form>
    </section>
    <section class="card" style="display:flex;gap:14px;align-items:center">
      <div class="mascot" style="width:64px;height:64px">${sunni('ok', w === 'e')}</div>
      <p class="muted">Im <b style="color:var(--text)">Fokus-Modus</b> siehst du immer nur einen Schritt, mit Timer. Kein Grübeln, einfach machen.</p>
    </section>
    <button class="btn primary block" data-act="focus" data-w="${w}"><i class="ph-duotone ph-play"></i>${RNAME[w]} starten</button>
  </div>`;
}

function todoHTML(t) {
  return `<div class="todo ${t.done ? 'done' : ''} ${ui.newId === t.id ? 'new' : ''}"><button class="check" data-act="todoToggle" data-id="${t.id}" aria-label="Erledigt"><i class="ph-duotone ph-check"></i></button>
    <span class="t">${esc(t.t)}</span><span class="acts">
    ${t.done ? '' : `<button class="mini" data-act="todoMove" data-id="${t.id}" aria-label="${t.when === 'heute' ? 'Auf später' : 'Auf heute'}" title="${t.when === 'heute' ? 'Auf später schieben' : 'Auf heute holen'}"><i class="ph-duotone ${t.when === 'heute' ? 'ph-calendar-plus' : 'ph-sun'}"></i></button>`}
    <button class="mini" data-act="todoDel" data-id="${t.id}" aria-label="Löschen"><i class="ph-duotone ph-trash"></i></button></span></div>`;
}

const RING = 2 * Math.PI * 52;
function rAufgaben() {
  const f = ui.todoF;
  if (f === 'ideen') return rIdeen();
  const cnt = w => S.todos.filter(t => !t.done && t.when === w).length;
  const list = f === 'erledigt' ? S.todos.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 40)
    : S.todos.filter(t => !t.done && t.when === f);
  const l = L();
  const ft = S.ft;
  const openTop = l.top.filter(t => !t.done);
  return `${head('Aufgaben', 'Fokus statt Chaos')}
  <div class="stack">
    ${goalsCard()}
    <section class="card timer-card">
      <div class="ring"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="52" fill="none" stroke-width="10"/><circle id="ftRing" class="fg" cx="60" cy="60" r="52" fill="none" stroke-width="10" stroke-dasharray="${RING}" stroke-dashoffset="${RING}"/></svg><div class="lbl num" id="ftLbl">25:00</div></div>
      <div>
        <h2>Fokus-Block</h2>
        <p class="muted small" id="ftSub">${ft ? (ft.label ? 'Gerade: ' + esc(ft.label) : 'Läuft. Handy weg, Tab zu.') : `Heute schon <b class="num">${l.fm}</b> Min im Fokus.`}</p>
        ${ft ? `<div class="presets" style="margin-top:12px">
            <button class="btn sm primary" data-act="ftPause"><i class="ph-duotone ${ft.end ? 'ph-pause' : 'ph-play'}"></i>${ft.end ? 'Pause' : 'Weiter'}</button>
            <button class="btn sm ghost" data-act="ftStop"><i class="ph-duotone ph-stop"></i>Abbrechen</button></div>`
        : `<div class="presets">${[25, 50, 90].map(m => `<button class="btn sm ${m === 25 ? 'primary' : ''}" data-act="ftStart" data-min="${m}">${m} Min</button>`).join('')}</div>
           ${openTop.length ? `<div class="chips">${openTop.map((t, i) => `<button class="chip ${ui.ftLabel === t.t ? 'on' : ''}" data-act="ftLabel" data-t="${esc(t.t)}">${esc(t.t)}</button>`).join('')}</div>` : ''}`}
      </div>
    </section>
    <form class="add-row" data-form="todo" data-when="${f === 'später' ? 'später' : 'heute'}" style="margin:0"><input id="todoIn" class="input" name="t" autocomplete="off" placeholder="${f === 'später' ? 'Für später merken' : 'Neue Aufgabe für heute'}"><button class="add-btn" aria-label="Hinzufügen"><i class="ph-duotone ph-plus"></i></button></form>
    <div class="seg wide"><button class="${f === 'heute' ? 'on' : ''}" data-act="todoF" data-f="heute">Heute <span class="count num">${cnt('heute')}</span></button><button class="${f === 'später' ? 'on' : ''}" data-act="todoF" data-f="später">Später <span class="count num">${cnt('später')}</span></button><button class="${f === 'ideen' ? 'on' : ''}" data-act="todoF" data-f="ideen">Ideen <span class="count num">${S.ideas.length}</span></button><button class="${f === 'erledigt' ? 'on' : ''}" data-act="todoF" data-f="erledigt">Erledigt</button></div>
    <div class="list">${list.map(todoHTML).join('') || `<div class="empty"><span class="em">${f === 'erledigt' ? '🏆' : '🌤️'}</span>${f === 'erledigt' ? 'Hier landet alles, was du wegschaffst.' : f === 'heute' ? 'Alles erledigt. Stark.' : 'Nichts geparkt.'}</div>`}</div>
    ${f === 'erledigt' && list.length ? `<button class="btn ghost" data-act="todoClear"><i class="ph-duotone ph-broom"></i>Erledigte aufräumen</button>` : ''}
  </div>`;
}

function rEssen() {
  const s = ui.foodSeg;
  const segs = [['tagebuch', 'ph-notebook', 'Tagebuch'], ['plan', 'ph-calendar-dots', 'Plan'], ['rezepte', 'ph-cooking-pot', 'Rezepte'], ['einkauf', 'ph-basket', 'Einkauf']];
  const body = { tagebuch: rTagebuch, plan: rPlan, rezepte: rRezepte, einkauf: rEinkauf }[s]();
  return `${head('Essen', 'Plan, Rezepte, Tagebuch')}
  <div class="stack"><div class="seg wide">${segs.map(([k, ic, lab]) => `<button class="${s === k ? 'on' : ''}" data-act="foodSeg" data-s="${k}"><i class="ph-duotone ${ic}"></i><span>${lab}</span></button>`).join('')}</div>${body}</div>`;
}

function rTagebuch() {
  const day = ui.foodDay || today(); const l = L(day);
  const d = new Date(day + 'T12:00');
  const label = day === today() ? 'Heute' : d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  const kcal = l.food.reduce((a, f) => a + (+f.kcal || 0), 0), prot = l.food.reduce((a, f) => a + (+f.p || 0), 0);
  const groups = MEALS.map(m => { const es = l.food.filter(f => f.meal === m); return es.length ? `<div class="mgroup"><h3>${m}</h3>${es.map(f => `<div class="food-entry ${ui.newId === f.id ? 'new' : ''}"><span class="t">${esc(f.t)}</span><span class="v num">${f.kcal ? nf(f.kcal) + ' kcal' : ''}${f.p ? '<br>' + nf(f.p) + ' g P' : ''}</span><button class="mini" data-act="foodDel" data-id="${f.id}" aria-label="Löschen"><i class="ph-duotone ph-trash"></i></button></div>`).join('')}</div>` : ''; }).join('');
  return `<div class="daynav"><button class="icon-btn" data-act="foodDay" data-d="-1" aria-label="Vorheriger Tag"><i class="ph-duotone ph-caret-left"></i></button><b>${label}</b><button class="icon-btn" data-act="foodDay" data-d="1" aria-label="Nächster Tag" ${day >= today() ? 'disabled style="opacity:.3"' : ''}><i class="ph-duotone ph-caret-right"></i></button></div>
  <section class="card">
    <div class="goals"><div class="goal"><b class="num">${nf(kcal)}</b> <small class="num">/ ${nf(S.set.kcal)} kcal</small><div class="bar" style="margin:8px 0 0"><i style="--w:${Math.min(100, kcal / S.set.kcal * 100)}%"></i></div></div>
    <div class="goal"><b class="num">${nf(prot)}</b> <small class="num">/ ${S.set.protein} g Protein</small><div class="bar" style="margin:8px 0 0"><i style="--w:${Math.min(100, prot / S.set.protein * 100)}%"></i></div></div></div>
    <div class="water">${waterHTML(l)}</div>
  </section>
  <section class="card">
    <div class="card-head"><h2>Gegessen</h2><div class="row"><button class="btn sm primary" data-act="foodPhoto"><i class="ph-duotone ph-camera"></i>Scannen</button><button class="btn sm" data-act="logFromRecipe"><i class="ph-duotone ph-cooking-pot"></i>Aus Rezept</button></div></div>
    ${groups || `<div class="empty"><span class="em">🍽️</span>Noch nichts eingetragen.</div>`}
    <form class="form" data-form="food" style="display:grid;gap:10px;margin-top:14px">
      <input id="foodIn" class="input" name="t" autocomplete="off" placeholder="Was gab's? z. B. Döner" required>
      <div class="row"><input class="input num" name="kcal" type="number" min="0" inputmode="numeric" placeholder="kcal" aria-label="kcal"><input class="input num" name="p" type="number" min="0" inputmode="numeric" placeholder="Protein g" aria-label="Protein in Gramm">
      <select class="input" name="meal" aria-label="Mahlzeit">${MEALS.map(m => `<option ${m === guessMeal() ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <button class="btn dark"><i class="ph-duotone ph-plus"></i>Eintragen</button>
    </form>
  </section>`;
}

function slotHTML(day, k) {
  const v = (S.plan[day] || {})[k];
  const r = typeof v === 'string' ? getR(v) : null;
  const txt = r ? r.t : v && v.t;
  if (!txt) return `<button class="pslot empty-slot" data-act="planPick" data-day="${day}" data-slot="${k}"><span class="lab">${SLOTS[k]}</span><i class="ph-duotone ph-plus"></i></button>`;
  return `<button class="pslot" data-act="planPick" data-day="${day}" data-slot="${k}"><span class="lab">${SLOTS[k]}</span><span class="em">${r ? r.e : '🍽️'}</span><span class="nm">${esc(txt)}</span></button>`;
}
function rPlan() {
  const td = WD[lnow().getDay()];
  return `<div class="row" style="flex-wrap:wrap"><button class="btn sm primary" data-act="planDice"><i class="ph-duotone ph-dice-five"></i>Lücken würfeln</button><button class="btn sm" data-act="tab-shop"><i class="ph-duotone ph-basket"></i>Einkaufsliste</button><button class="btn sm ghost" data-act="planClear"><i class="ph-duotone ph-eraser"></i>Leeren</button></div>
  <div class="plan">${WEEK.map(d => `<div class="pday ${d === td ? 'today' : ''}"><div class="dn">${WDL[d].slice(0, 2)}<small>${d === td ? 'Heute' : WDL[d]}</small></div>${Object.keys(SLOTS).map(k => slotHTML(d, k)).join('')}</div>`).join('')}</div>`;
}

function rRezepte() {
  const tags = ['Alle', 'Mein Plan', 'Frühstück', 'Mittag', 'Abend', 'Snack', 'schnell', 'High Protein', 'vegetarisch', 'Meal Prep', 'Eigene'];
  return `<div class="row"><input id="rq" class="input" placeholder="Rezept oder Zutat suchen" value="${esc(ui.rq)}" autocomplete="off" aria-label="Suche"><button class="btn sm ghost" data-act="importOpen" title="Plan oder Rezepte einfügen"><i class="ph-duotone ph-clipboard-text"></i>Einfügen</button></div>
  <div class="chips">${tags.map(t => `<button class="chip ${ui.rtag === t ? 'on' : ''}" data-act="rtag" data-t="${t}">${t}</button>`).join('')}</div>
  <div class="rgrid" id="rgrid">${rgridHTML()}</div>`;
}
function rgridHTML() {
  const q = ui.rq.trim().toLowerCase();
  const list = allRecipes().filter(r => (ui.rtag === 'Alle' || (ui.rtag === 'Eigene' ? !r.id.startsWith('b') : (r.tags || []).includes(ui.rtag)))
    && (!q || r.t.toLowerCase().includes(q) || (r.ing || []).join(' ').toLowerCase().includes(q)));
  return list.map((r, i) => `<button class="rcard" style="--i:${i}" data-act="openRecipe" data-id="${r.id}"><div class="pic"><span>${r.e}</span></div><div class="body"><b>${esc(r.t)}</b>
    <div class="meta num"><span><i class="ph-duotone ph-timer"></i>${r.min || '?'} Min</span>${r.kcal ? `<span><i class="ph-duotone ph-fire"></i>${r.kcal}</span>` : ''}${r.p ? `<span>${r.p} g P</span>` : ''}</div></div></button>`).join('')
    + `<button class="rcard add" data-act="editRecipe"><span><i class="ph-duotone ph-plus-circle"></i><br>Eigenes Rezept</span></button>`;
}

function shopItems() {
  const agg = new Map();
  for (const d of WEEK) for (const k of Object.keys(SLOTS)) {
    const v = (S.plan[d] || {})[k]; const r = typeof v === 'string' ? getR(v) : null; if (!r) continue;
    for (const line of r.ing || []) {
      const i = parseIng(line); const key = i.n.toLowerCase() + '|' + i.u;
      const cur = agg.get(key) || { key, n: i.n, u: i.u, q: i.q == null ? null : 0 };
      if (i.q != null && cur.q != null) cur.q += i.q;
      agg.set(key, cur);
    }
  }
  return [...agg.values()].sort((a, b) => a.n.localeCompare(b.n, 'de'));
}
function rEinkauf() {
  const items = shopItems();
  return `<section class="card shop">
    <div class="card-head"><h2>Für deinen Wochenplan</h2>${Object.keys(S.shop.c).length ? `<button class="link" data-act="shopReset">Zurücksetzen</button>` : ''}</div>
    ${items.map(i => `<button class="item ${S.shop.c[i.key] ? 'done' : ''}" data-act="shopToggle" data-key="${esc(i.key)}"><span class="check"><i class="ph-duotone ph-check"></i></span><span class="t">${esc(i.n)}</span><span class="q num">${fmtIng(i)}</span></button>`).join('')
      || `<div class="empty"><span class="em">🧺</span>Plan ein paar Rezepte, dann steht hier, was du brauchst.</div>`}
    ${S.shop.extra.map(x => `<div class="item ${x.done ? 'done' : ''}"><button class="check" data-act="extraToggle" data-id="${x.id}"><i class="ph-duotone ph-check"></i></button><span class="t">${esc(x.t)}</span><button class="mini" data-act="extraDel" data-id="${x.id}" aria-label="Löschen"><i class="ph-duotone ph-trash"></i></button></div>`).join('')}
    <form class="add-row" data-form="extra"><input id="extraIn" class="input" name="t" autocomplete="off" placeholder="Extra, z. B. Kaffee"><button class="add-btn" aria-label="Hinzufügen"><i class="ph-duotone ph-plus"></i></button></form>
  </section>`;
}

/* ---------- Sheets ---------- */
const sheetEl = $('#sheet');
function openSheet(html) {
  sheetEl.innerHTML = `<div class="sheet-wrap"><div class="sheet-bg" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`;
  sheetEl.hidden = false;
  const first = sheetEl.querySelector('[autofocus]'); if (first && matchMedia('(hover:hover)').matches) first.focus();
}
function closeSheet() { sheetEl.hidden = true; sheetEl.innerHTML = ''; sheetEl.className = ''; ui.fotoRun = null; ui.ean = null; }
const sheetHead = t => `<div class="sheet-head"><h2>${t}</h2><button class="icon-btn" data-act="closeSheet" aria-label="Schließen"><i class="ph-duotone ph-x"></i></button></div>`;

function recipeSheet(id) {
  const r = getR(id); if (!r) return;
  const k = ui.portions;
  const own = !r.id.startsWith('b');
  openSheet(`${sheetHead(esc(r.t))}<div class="r-hero"><span>${r.e}</span></div>
    <div class="meta num" style="font-size:14px;margin-bottom:14px"><span><i class="ph-duotone ph-timer"></i>${r.min || '?'} Min</span>${r.kcal ? `<span><i class="ph-duotone ph-fire"></i>ca. ${r.kcal * k} kcal</span>` : ''}${r.p ? `<span>ca. ${r.p * k} g Protein</span>` : ''}${(r.tags || []).map(t => `<span class="chip" style="padding:3px 9px">${esc(t)}</span>`).join('')}</div>
    <div class="card-head"><h3>Zutaten</h3><div class="portions"><button class="icon-btn" data-act="portions" data-d="-1" data-id="${r.id}" aria-label="Weniger"><i class="ph-duotone ph-minus"></i></button><b class="num">${k} ${k === 1 ? 'Portion' : 'Portionen'}</b><button class="icon-btn" data-act="portions" data-d="1" data-id="${r.id}" aria-label="Mehr"><i class="ph-duotone ph-plus"></i></button></div></div>
    <div class="ing">${(r.ing || []).map(parseIng).map(i => `<div><b class="num">${fmtIng(i, k)}</b><span>${esc(i.n)}</span></div>`).join('')}</div>
    ${(r.steps || []).length ? `<h3>So geht's</h3><ol class="steps-ol">${r.steps.map(s => `<li><span>${esc(s)}</span></li>`).join('')}</ol>` : ''}
    <div class="two" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <button class="btn primary" data-act="ateRecipe" data-id="${r.id}"><i class="ph-duotone ph-fork-knife"></i>Gegessen</button>
      <button class="btn" data-act="toPlan" data-id="${r.id}"><i class="ph-duotone ph-calendar-plus"></i>In den Plan</button>
    </div>
    ${own ? `<div class="row" style="margin-top:10px"><button class="btn ghost sm" data-act="editRecipe" data-id="${r.id}"><i class="ph-duotone ph-pencil-simple"></i>Bearbeiten</button><button class="btn ghost sm" data-act="delRecipe" data-id="${r.id}"><i class="ph-duotone ph-trash"></i>Löschen</button></div>` : ''}`);
}

function editRecipeSheet(id) {
  const r = id ? getR(id) : { e: '', t: '', min: '', kcal: '', p: '', tags: [], ing: [], steps: [] };
  openSheet(`${sheetHead(id ? 'Rezept bearbeiten' : 'Eigenes Rezept')}
  <form class="form" data-form="recipe" data-id="${id || ''}">
    <div class="row"><label class="f" style="width:84px">Emoji<input class="input" name="e" value="${esc(r.e)}" maxlength="4" placeholder="🍲"></label><label class="f" style="flex:1">Name<input class="input" name="t" value="${esc(r.t)}" required autofocus placeholder="z. B. Omas Linsensuppe"></label></div>
    <div class="three"><label class="f">Minuten<input class="input num" name="min" type="number" min="0" value="${esc(r.min)}"></label><label class="f">kcal<input class="input num" name="kcal" type="number" min="0" value="${esc(r.kcal)}"></label><label class="f">Protein g<input class="input num" name="p" type="number" min="0" value="${esc(r.p)}"></label></div>
    <label class="f">Kategorien (mit Komma)<input class="input" name="tags" value="${esc((r.tags || []).join(', '))}" placeholder="Mittag, schnell, High Protein"></label>
    <label class="f">Zutaten, eine pro Zeile (für 1 Portion)<textarea class="input" name="ing" placeholder="200 g Hähnchen&#10;1 Stk Paprika">${esc((r.ing || []).join('\n'))}</textarea></label>
    <label class="f">Zubereitung, ein Schritt pro Zeile<textarea class="input" name="steps" placeholder="Alles schnippeln.&#10;Anbraten.">${esc((r.steps || []).join('\n'))}</textarea></label>
    <button class="btn primary"><i class="ph-duotone ph-check"></i>Speichern</button>
  </form>`);
}

function planPickSheet(day, slot) {
  const v = (S.plan[day] || {})[slot];
  const want = SLOTS[slot];
  const list = allRecipes().slice().sort((a, b) => ((b.tags || []).includes(want) - (a.tags || []).includes(want)));
  openSheet(`${sheetHead(`${WDL[day]}, ${want}`)}
    <form class="add-row" data-form="planText" data-day="${day}" data-slot="${slot}" style="margin-top:0"><input class="input" name="t" placeholder="Freitext, z. B. Essen mit Kunden" value="${v && v.t ? esc(v.t) : ''}"><button class="add-btn" aria-label="Übernehmen"><i class="ph-duotone ph-check"></i></button></form>
    <input class="input" id="pickQ" placeholder="Rezept suchen" style="margin-top:10px" autocomplete="off">
    <div class="pick-list" id="pickList">${list.map(r => `<button class="pick" data-act="planSet" data-day="${day}" data-slot="${slot}" data-id="${r.id}" data-s="${esc(r.t.toLowerCase())}"><span class="em">${r.e}</span><span><b>${esc(r.t)}</b><span class="muted small num">${r.min || '?'} Min${r.kcal ? ', ca. ' + r.kcal + ' kcal' : ''}${(r.tags || []).includes(want) ? '' : ''}</span></span></button>`).join('')}</div>
    ${v ? `<button class="btn ghost block" style="margin-top:12px" data-act="planSet" data-day="${day}" data-slot="${slot}" data-id=""><i class="ph-duotone ph-eraser"></i>Platz leeren</button>` : ''}`);
}

function toPlanSheet(id) {
  const r = getR(id);
  const td = WD[lnow().getDay()];
  const def = (r.tags || []).includes('Frühstück') ? 'f' : (r.tags || []).includes('Mittag') ? 'm' : 'a';
  openSheet(`${sheetHead('In den Wochenplan')}<p class="muted" style="margin-bottom:14px">${r.e} ${esc(r.t)}</p>
    <form class="form" data-form="toPlan" data-id="${id}"><div class="two">
      <label class="f">Tag<select class="input" name="day">${WEEK.map(d => `<option value="${d}" ${d === td ? 'selected' : ''}>${WDL[d]}</option>`).join('')}</select></label>
      <label class="f">Mahlzeit<select class="input" name="slot">${Object.entries(SLOTS).map(([k, v]) => `<option value="${k}" ${k === def ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
      <button class="btn primary"><i class="ph-duotone ph-check"></i>Eintragen</button></form>`);
}

function logRecipeSheet() {
  openSheet(`${sheetHead('Aus Rezept eintragen')}<input class="input" id="pickQ" placeholder="Rezept suchen" autocomplete="off" autofocus>
    <div class="pick-list" id="pickList">${allRecipes().map(r => `<button class="pick" data-act="ateRecipe" data-id="${r.id}" data-s="${esc(r.t.toLowerCase())}"><span class="em">${r.e}</span><span><b>${esc(r.t)}</b><span class="muted small num">${r.kcal ? 'ca. ' + r.kcal + ' kcal' : ''}${r.p ? ', ' + r.p + ' g P' : ''}</span></span></button>`).join('')}</div>`);
}

function stepSheet(w, id) {
  const s = S.routines[w].find(x => x.id === id); if (!s) return;
  openSheet(`${sheetHead('Schritt bearbeiten')}<form class="form" data-form="stepEdit" data-w="${w}" data-id="${id}">
    <label class="f">Was?<input class="input" name="t" value="${esc(s.t)}" required autofocus></label>
    <label class="f">Dauer in Minuten (für den Timer, 0 = ohne)<input class="input num" name="min" type="number" min="0" max="240" value="${s.min || 0}"></label>
    <button class="btn primary"><i class="ph-duotone ph-check"></i>Speichern</button></form>`);
}

const IMPORT_EXAMPLE = `# Overnight Oats | Frühstück, schnell | 5 Min | 430 kcal | 27 g Protein
- 60 g Haferflocken
- 150 g Skyr
1. Alles mischen und über Nacht kühlen.

# Hähnchen-Reis-Bowl | Mittag | 25 Min | 650 kcal | 49 g Protein
- 150 g Hähnchenbrust
- 80 g Reis

Mo Frühstück: Overnight Oats
Mo Mittag: Hähnchen-Reis-Bowl`;
function importSheet() {
  openSheet(`${sheetHead('Plan oder Rezepte einfügen')}
  <p class="muted small" style="margin-bottom:10px">Kopier deinen Ernährungsplan hier rein. Jedes Rezept beginnt mit <b>#</b>, Zutaten mit <b>-</b>, Schritte mit <b>1.</b>. Zeilen wie <b>Mo Mittag: Rezeptname</b> landen direkt im Wochenplan.</p>
  <form class="form" data-form="import"><textarea class="input" name="txt" style="min-height:220px;font-size:14px" placeholder="${esc(IMPORT_EXAMPLE)}"></textarea>
  <button class="btn primary"><i class="ph-duotone ph-download-simple"></i>Übernehmen</button></form>`);
}
function parseImport(txt) {
  const out = []; const plan = []; let cur = null, mode = 'ing';
  const dayRe = /^(mo|di|mi|do|fr|sa|so)[a-zä]*\.?\s+(frühstück|fruehstueck|mittag\w*|abend\w*)\s*:\s*(.+)$/i;
  for (let raw of txt.split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    let m;
    if ((m = line.match(dayRe))) { const s = m[2].toLowerCase().startsWith('f') ? 'f' : m[2].toLowerCase().startsWith('m') ? 'm' : 'a'; plan.push({ d: m[1].toLowerCase(), s, t: m[3].trim() }); continue; }
    if (line.startsWith('#')) {
      const parts = line.replace(/^#+\s*/, '').split('|').map(x => x.trim()).filter(Boolean);
      let t = parts.shift() || 'Rezept'; let e = '';
      const em = t.match(/^(\p{Extended_Pictographic}️?)\s*/u); if (em) { e = em[1]; t = t.slice(em[0].length); }
      cur = { id: 'c' + uid(), e: e || guessEmoji(t), t, min: 0, kcal: 0, p: 0, tags: [], ing: [], steps: [] }; mode = 'ing';
      for (const p of parts) {
        if ((m = p.match(/(\d+)\s*min/i))) cur.min = +m[1];
        else if ((m = p.match(/(\d+)\s*kcal/i))) cur.kcal = +m[1];
        else if ((m = p.match(/(\d+)\s*g\b/i))) cur.p = +m[1];
        else cur.tags.push(...p.split(',').map(x => x.trim()).filter(Boolean));
      }
      out.push(cur); continue;
    }
    if (!cur) continue;
    if (/^[-*•]\s*/.test(line)) { cur.ing.push(line.replace(/^[-*•]\s*/, '')); continue; }
    if (/^\d+[.)]\s*/.test(line)) { cur.steps.push(line.replace(/^\d+[.)]\s*/, '')); mode = 'steps'; continue; }
    (mode === 'steps' || cur.ing.length ? cur.steps : cur.steps).push(line);
  }
  return { recipes: out, plan };
}

function settingsSheet() {
  const st = S.set;
  openSheet(`${sheetHead('Einstellungen')}
  <div class="set-sec"><label class="f">Dein Name<input class="input" data-set="name" value="${esc(st.name)}" placeholder="Wie soll die App dich nennen?"></label>
    <label class="f">Abendroutine zeigen ab<select class="input" data-set="eve">${[14, 15, 16, 17, 18, 19, 20, 21].map(h => `<option value="${h}" ${+st.eve === h ? 'selected' : ''}>${h}:00 Uhr</option>`).join('')}</select></label>
    <div><p class="f" style="font-size:13px;font-weight:650;color:var(--muted);margin-bottom:6px">Design</p><div class="seg">${[['system', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([k, v]) => `<button class="${st.theme === k ? 'on' : ''}" data-act="theme" data-t="${k}">${v}</button>`).join('')}</div></div></div>
  <div class="set-sec"><h3>Tagesziele</h3><div class="three"><label class="f">kcal<input class="input num" type="number" data-set="kcal" value="${st.kcal}"></label><label class="f">Protein g<input class="input num" type="number" data-set="protein" value="${st.protein}"></label><label class="f">Gläser Wasser<input class="input num" type="number" min="1" max="16" data-set="water" value="${st.water}"></label></div></div>
  <div class="set-sec"><h3>Foto-Kalorien</h3><p class="muted small">Ist ein Barcode auf dem Foto, liest die App ihn selbst und holt die Nährwerte kostenlos von Open Food Facts, ganz ohne Schlüssel. Für alles andere: Fotografier dein Essen, Claude erkennt die Zutaten und schätzt Menge, kcal und Protein. Dafür brauchst du einen eigenen API-Schlüssel von <b>console.anthropic.com</b> (Menüpunkt API Keys). Er bleibt nur auf diesem Gerät und kommt in keinen Export. Ein Foto kostet etwa 2 bis 3 Cent.</p>
    <label class="f">API-Schlüssel<input id="kiKeyIn" class="input" type="password" autocomplete="off" spellcheck="false" autocapitalize="off" placeholder="${kiKey() ? 'Hinterlegt, endet auf …' + esc(kiKey().slice(-4)) : 'sk-ant-…'}"></label>
    ${kiKey() ? `<div class="row"><span class="muted small" style="flex:1"><i class="ph-duotone ph-check-circle"></i> Foto-Erkennung ist bereit.</span><button class="btn sm ghost" data-act="kiKeyDel"><i class="ph-duotone ph-trash"></i>Schlüssel löschen</button></div>` : ''}</div>
  <div class="set-sec"><h3>Mönch-Modus</h3><div class="row" style="flex-wrap:wrap"><button class="btn sm" data-act="mkSettings"><i class="ph-duotone ph-flame"></i>Säulen und Laufzeit</button><button class="btn sm" data-act="mkBlocks"><i class="ph-duotone ph-squares-four"></i>Feste Blöcke</button><button class="btn sm" data-act="medsEdit"><i class="ph-duotone ph-pill"></i>Einnehmen</button><button class="btn sm" data-act="tab" data-tab="routinen"><i class="ph-duotone ph-repeat"></i>Routinen</button></div></div>
  <div class="set-sec"><h3>Kalender und Uni</h3><div class="row" style="flex-wrap:wrap"><button class="btn sm" data-act="calSheet"><i class="ph-duotone ph-calendar-plus"></i>Kalender</button><button class="btn sm" data-act="u.settings"><i class="ph-duotone ph-graduation-cap"></i>Lernzeiten und Erinnerungen</button></div></div>
  <div class="set-sec"><h3>Deine Daten</h3><p class="muted small">Alles bleibt auf diesem Gerät, ohne Konto. Mit Export und Import ziehst du um, zum Beispiel vom Laptop aufs Handy.</p>
    <div class="row" style="flex-wrap:wrap"><button class="btn sm" data-act="export"><i class="ph-duotone ph-download-simple"></i>Exportieren</button><button class="btn sm" data-act="import"><i class="ph-duotone ph-upload-simple"></i>Importieren</button><button class="btn sm ghost" data-act="reset"><i class="ph-duotone ph-warning"></i>Alles löschen</button></div></div>`);
}

// Widget-Skript einmal laden, damit "Code kopieren" ohne Wartezeit funktioniert (Zwischenablage braucht den Klick)
let WTPL = '';
const widgetData = () => window.SK.buildWidgetData(S, allRecipes());
const scriptableCode = () => WTPL.replace('/*DATA*/null', JSON.stringify(widgetData()));
function widgetCodeSheet() {
  openSheet(`${sheetHead('Widgets für iPhone und Mac')}
  <a class="btn primary block" href="widgets.html" style="margin-bottom:16px"><i class="ph-duotone ph-squares-four"></i>Alle 12 Widgets ansehen</a>
  <h3>iPhone</h3><ol class="howto">
    <li>Lade die Gratis-App <b>Scriptable</b> aus dem App Store.</li>
    <li>Tippe unten auf <b>Code kopieren</b>.</li>
    <li>In Scriptable oben rechts auf <b>+</b>, Code einfügen, Skript „Sonnenklar“ nennen.</li>
    <li>Home-Bildschirm lange drücken, <b>+</b>, Scriptable in klein, mittel oder groß hinzufügen.</li>
    <li>Widget gedrückt halten, <b>Widget bearbeiten</b>: Skript „Sonnenklar“, bei Parameter das Design eintragen, z. B. <b>M3</b>.</li>
  </ol>
  <p class="muted small" style="margin-bottom:12px">Klein: S1 bis S4, Mittel: M1 bis M4, Groß: L1 bis L4. Morgens zeigen sie die Morgenroutine, ab ${S.set.eve} Uhr die Abendroutine. Abhaken machst du in der App, danach tippst du auf <b>Widgets aktualisieren</b> und der neue Stand landet im Widget.</p>
  <h3>Mac</h3><p class="muted small" style="margin:6px 0 12px">Ab macOS Sonoma kannst du iPhone-Widgets auf den Mac-Schreibtisch legen: Rechtsklick auf den Schreibtisch, <b>Widgets bearbeiten</b>, dann bei „iPhone“ das Scriptable-Widget wählen. Dafür müssen Mac und iPhone mit derselben Apple-ID angemeldet sein. Für ein Widget zum Abhaken öffne Sonnenklar in Chrome oder Edge und nutze das <b>Mini-Widget</b>.</p>
  <h3>Windows</h3><p class="muted small" style="margin:6px 0 12px">Sonnenklar in Edge oder Chrome öffnen, oben in der Adressleiste auf <b>App installieren</b>. Dann in der App: Einstellungen, <b>Mini-Widget öffnen</b>. Das schwebt immer im Vordergrund.</p>
  <div class="two" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <button class="btn dark" data-act="copyCode"><i class="ph-duotone ph-copy"></i>Code kopieren</button>
    <button class="btn" data-act="widgetSync"><i class="ph-duotone ph-arrows-clockwise"></i>Aktualisieren</button>
  </div>`);
}

/* ---------- Fokus-Modus (Routine Schritt für Schritt) ---------- */
const focusEl = $('#focus');
let F = null, fTick = null, wake = null;
function openFocus(w) {
  const r = S.routines[w];
  if (!r.length) { toast('Leg erst ein paar Schritte an.'); ui.tab = 'routinen'; ui.rWhich = w; ui.tabChanged = true; render(); return; }
  const l = L();
  let i = r.findIndex(s => !l[w].includes(s.id)); if (i < 0) i = 0;
  F = { w, i, start: Date.now(), paused: false, pausedAt: 0, beeped: false, finished: false };
  try { navigator.wakeLock && navigator.wakeLock.request('screen').then(x => { wake = x; }).catch(() => {}); } catch (e) {}
  focusEl.hidden = false; renderFocus();
  clearInterval(fTick); fTick = setInterval(tickFocus, 250);
}
function closeFocus() { F = null; focusEl.hidden = true; focusEl.innerHTML = ''; clearInterval(fTick); if (wake) { wake.release().catch(() => {}); wake = null; } render(); }
function fmtT(s) { const neg = s < 0; s = Math.abs(Math.round(s)); return `${neg ? '+' : ''}${Math.floor(s / 60)}:${pad(s % 60)}`; }
function renderFocus() {
  if (!F) return;
  const r = S.routines[F.w], l = L(), night = F.w === 'e';
  focusEl.className = 'focus' + (night ? ' night' : '');
  if (F.finished) {
    const done = r.filter(s => l[F.w].includes(s.id)).length;
    const all = done === r.length;
    focusEl.innerHTML = `<div class="fhead"><span><i class="ph-duotone ${ICON[F.w]}"></i> ${RNAME[F.w]}</span><button class="fbtn-x" data-act="fClose" aria-label="Schließen"><i class="ph-duotone ph-x"></i></button></div>
      <div class="fmid"><div class="fmascot">${sunni(all ? 'happy' : 'ok', night)}</div><div class="fstep">${all ? (night ? 'Feierabend. Gute Nacht!' : 'Morgen gewonnen!') : `${done} von ${r.length} geschafft`}</div>
      <p class="fcount">${all ? (night ? 'Alles erledigt. Morgen-Du sagt danke.' : 'Jetzt die Top 3 angehen.') : 'Der Rest wartet in der Liste. Auch gut.'}</p></div>
      <div class="factions" style="grid-template-columns:1fr"><button class="fb main" data-act="fClose">Fertig</button></div>`;
    return;
  }
  const s = r[F.i];
  focusEl.innerHTML = `<div class="fhead"><span><i class="ph-duotone ${ICON[F.w]}"></i> ${RNAME[F.w]}</span><button class="fbtn-x" data-act="fClose" aria-label="Schließen"><i class="ph-duotone ph-x"></i></button></div>
    <div class="fmid">
      <div class="fmascot" style="width:110px;height:110px">${sunni('ok', night)}</div>
      <p class="fcount num">Schritt ${F.i + 1} von ${r.length}</p>
      <div class="fstep" key="${s.id}">${esc(s.t)}</div>
      ${s.min ? `<div class="ftime num" id="fTime">${fmtT(s.min * 60)}</div><button class="btn sm" style="background:rgba(0,0,0,.12);color:inherit" data-act="fPause" id="fPauseBtn"><i class="ph-duotone ${F.paused ? 'ph-play' : 'ph-pause'}"></i>${F.paused ? 'Weiter' : 'Pause'}</button>` : ''}
      <div class="fdots">${r.map((x, j) => `<i class="${j === F.i ? 'on' : l[F.w].includes(x.id) ? 'ok' : ''}"></i>`).join('')}</div>
    </div>
    <div class="factions"><button class="fb alt" data-act="fSkip">Später</button><button class="fb main" data-act="fDone"><i class="ph-duotone ph-check"></i>Geschafft</button></div>`;
}
function tickFocus() {
  if (!F || F.finished) return;
  const s = S.routines[F.w][F.i]; if (!s || !s.min) return;
  const el = $('#fTime'); if (!el) return;
  const el2 = (F.paused ? F.pausedAt : Date.now()) - F.start;
  const left = s.min * 60 - el2 / 1000;
  el.textContent = fmtT(left);
  el.classList.toggle('over', left < 0);
  if (left <= 0 && !F.beeped) { F.beeped = true; beep(); try { navigator.vibrate && navigator.vibrate([120, 80, 120]); } catch (e) {} }
}
function focusNext() {
  const r = S.routines[F.w], l = L();
  let n = -1;
  for (let j = F.i + 1; j < r.length; j++) if (!l[F.w].includes(r[j].id)) { n = j; break; }
  if (n < 0) {
    F.finished = true;
    if (r.every(s => l[F.w].includes(s.id))) confetti(90);
  } else { F.i = n; F.start = Date.now(); F.paused = false; F.beeped = false; }
  renderFocus();
}

/* ---------- Mini-Widget ---------- */
let pipWin = null;
function widgetHTML() {
  const w = curWhich(), mo = moodOf(w), l = L();
  return `<div class="widget">
    <div class="wtop"><div class="mascot">${sunni(mo.mood, w === 'e')}</div><div><b>${RNAME[w]}</b><span class="muted small num">${mo.done} von ${mo.total} erledigt</span></div></div>
    <div class="bar" style="margin:0"><i style="--w:${Math.round(mo.p * 100)}%"></i></div>
    <div class="steps" style="margin:0">${stepsHTML(w, true)}</div>
    ${l.top.length ? `<p class="wt">Top 3</p><div class="steps" style="margin:0">${l.top.map((t, i) => `<button class="step ${t.done ? 'done' : ''}" data-act="topToggle" data-i="${i}"><span class="check"><i class="ph-duotone ph-check"></i></span><span class="t">${esc(t.t)}</span></button>`).join('')}</div>` : ''}
    <div class="wrow"><button class="btn sm" data-act="water" data-n="${Math.min(S.set.water, l.w + 1)}"><i class="ph-duotone ph-drop"></i>Wasser <span class="num">${l.w}/${S.set.water}</span></button><button class="btn sm primary" data-act="focus" data-w="${w}"><i class="ph-duotone ph-play"></i>Fokus</button></div>
  </div>`;
}
function renderPip() {
  if (!pipWin) return;
  const root = pipWin.document.getElementById('wroot');
  if (root) root.innerHTML = widgetHTML();
}
async function openPip() {
  if (DESK) { DESK.mini(); closeSheet(); return; }
  if (!('documentPictureInPicture' in window)) {
    toast('Das Mini-Widget klappt in Chrome und Edge. Alternativ: diese Seite mit ?widget in einem kleinen Fenster öffnen.');
    return;
  }
  try {
    pipWin = await window.documentPictureInPicture.requestWindow({ width: 340, height: 520 });
    const d = pipWin.document;
    document.querySelectorAll('link[rel="stylesheet"], style').forEach(n => d.head.appendChild(n.cloneNode(true)));
    d.documentElement.dataset.theme = document.documentElement.dataset.theme || '';
    if (!document.documentElement.dataset.theme) delete d.documentElement.dataset.theme;
    d.title = 'Sonnenklar';
    d.body.className = 'pip';
    d.body.innerHTML = '<div id="wroot"></div>';
    d.addEventListener('click', onClick);
    pipWin.addEventListener('pagehide', () => { pipWin = null; });
    closeSheet();
    renderPip();
  } catch (e) { toast('Mini-Widget konnte nicht öffnen.'); }
}

/* ---------- Fokus-Timer (Deep Work) ---------- */
function tickTimer() {
  const lbl = $('#ftLbl'), ring = $('#ftRing');
  const ft = S.ft;
  if (!ft) { if (lbl) lbl.textContent = '25:00'; if (ring) ring.style.strokeDashoffset = RING; if (document.title !== 'Mönch-Modus' && !UNI.focusOpen()) document.title = 'Mönch-Modus'; return; }
  const left = ft.end ? (ft.end - Date.now()) / 1000 : ft.left;
  if (left <= 0) {
    const m = Math.round(ft.dur / 60);
    S.ft = null; L().fm += m; persist();
    beep(); confetti(60); toast(`${m} Minuten Fokus geschafft. Stark!`);
    try { if ('Notification' in window && Notification.permission === 'granted') new Notification('Fokus-Block fertig', { body: `${m} Minuten durchgezogen. Kurze Pause!`, icon: 'icons/icon-192.png' }); } catch (e) {}
    render(); return;
  }
  const t = fmtT(left);
  if (lbl) lbl.textContent = t;
  const mini = $('#ftMini'); if (mini) mini.textContent = t;
  if (ring) ring.style.strokeDashoffset = RING * (left / ft.dur);
  document.title = `${t} Fokus`;
}
setInterval(tickTimer, 1000);

/* ---------- Effekte ---------- */
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2700);
}
function confetti(n = 60) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('div'); c.className = 'confetti';
  const cols = ['#f45d2f', '#16181c', '#ffb59c', '#fafaf7', '#c8441c'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.background = cols[i % cols.length];
    p.style.setProperty('--x', (Math.random() * 240 - 120) + 'px');
    p.style.setProperty('--r', (Math.random() * 900 - 450) + 'deg');
    p.style.setProperty('--d', (1.3 + Math.random() * 1.1) + 's');
    p.style.animationDelay = Math.random() * .25 + 's';
    if (i % 3 === 0) p.style.borderRadius = '50%';
    c.appendChild(p);
  }
  document.body.appendChild(c); setTimeout(() => c.remove(), 3000);
}
let actx = null;
function beep() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    [0, .18, .36].forEach((t, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = [660, 880, 1046][i];
      g.gain.setValueAtTime(0.0001, actx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, actx.currentTime + t + .02);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + t + .16);
      o.connect(g).connect(actx.destination); o.start(actx.currentTime + t); o.stop(actx.currentTime + t + .18);
    });
  } catch (e) {}
}
const buzz = () => { try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} };

/* ---------- Aktionen ---------- */
function setFull(w, l) { const r = S.routines[w]; l[w + 'f'] = r.length > 0 && r.every(s => l[w].includes(s.id)); }
function toggleStep(w, id) {
  const l = L(); const a = l[w]; const i = a.indexOf(id);
  const was = l[w + 'f'];
  if (i >= 0) a.splice(i, 1); else { a.push(id); ui.pulse = id; buzz(); }
  setFull(w, l);
  if (!was && l[w + 'f']) { confetti(90); toast(w === 'm' ? 'Morgenroutine geschafft! 🔥' : 'Abendroutine geschafft. Gute Nacht! 🌙'); }
}
function addFood(entry, day = today()) { const f = Object.assign({ id: uid() }, entry); L(day).food.push(f); ui.newId = f.id; }

/* ---------- Foto-Kalorien ---------- */
// Das Foto geht direkt vom Gerät an die Claude-API. Der Schlüssel liegt nur auf
// diesem Gerät, getrennt von KEY, damit er weder im Export noch in Widgets landet.
// Ohne Schlüssel, offline oder bei Fehlern bleibt die manuelle Eingabe.
const KI_KEY = 'sonnenklar-ki-key';
const kiKey = () => { try { return localStorage.getItem(KI_KEY) || ''; } catch (e) { return ''; } };
const FOTO_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['essen', 'name', 'zutaten', 'hinweis', 'barcode'],
  properties: {
    barcode: { type: 'string', description: 'Ziffern eines Strichcodes (EAN), wenn sie auf dem Foto lesbar sind, sonst leer' },
    essen: { type: 'boolean', description: 'false, wenn auf dem Foto kein Essen oder Getränk zu sehen ist' },
    name: { type: 'string', description: 'kurzer deutscher Name des Gerichts, z. B. "Spaghetti Bolognese"' },
    zutaten: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'gramm', 'kcal', 'protein'],
      properties: { name: { type: 'string' }, gramm: { type: 'number', description: 'geschätzte Menge in Gramm (Getränke in ml)' }, kcal: { type: 'number' }, protein: { type: 'number', description: 'Protein in Gramm' } } } },
    hinweis: { type: 'string', description: 'ein kurzer Satz, was die Schätzung unsicher macht, oder leer' },
  },
};
const FOTO_PROMPT = `Du schätzt Nährwerte von Essensfotos für ein persönliches Ernährungstagebuch.
Erkenne jede sichtbare Komponente (Beilage, Soße, Öl, Getränk) als eigene Zutat.
Schätze die Menge über Tellergröße, Besteck und Verpackungen. Rechne kcal und Protein mit üblichen Nährwerttabellen für genau diese Menge.
Denk an Unsichtbares, das fast immer dabei ist (Bratfett, Dressing), wenn es zum Gericht passt.
Schreib alle Namen auf Deutsch, kurz und alltagsnah. Runde Gramm auf 5, kcal auf ganze Zahlen, Protein auf ganze Gramm.
Ist kein Essen zu sehen, setze essen auf false und lass die Zutaten leer.
Sind unter einem Strichcode die Ziffern lesbar, schreib sie ohne Leerzeichen in barcode.`;

// Kein Build-Schritt in Sonnenklar, darum direkt per fetch statt SDK
async function askClaude(jpegB64, signal) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'x-api-key': kiKey(), 'anthropic-version': '2026-10-21',
      'anthropic-beta': 'server-side-fallback-2026-07-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({
      model: 'claude-opus-5-5', max_tokens: 16000, fallbacks: 'default', system: FOTO_PROMPT,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: FOTO_SCHEMA } },
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpegB64 } }, { type: 'text', text: 'Was ist auf dem Teller?' }] }],
    }),
  });
  const res = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (res.error && res.error.message) || '';
    throw new Error(r.status === 401 ? 'Dein API-Schlüssel stimmt nicht.' : /credit/i.test(msg) ? 'Auf deinem Anthropic-Konto ist kein Guthaben mehr.'
      : r.status === 429 || r.status === 529 ? 'Die Bild-KI ist gerade überlastet. Probier es gleich nochmal.' : 'Die Bild-KI ist gerade nicht erreichbar.');
  }
  if (res.stop_reason === 'refusal') throw new Error('Die Bild-KI wollte dieses Foto nicht auswerten.');
  const block = (res.content || []).find(b => b.type === 'text');
  if (res.stop_reason === 'max_tokens' || !block) throw new Error('Die Bild-KI hat keine vollständige Antwort geliefert.');
  return JSON.parse(block.text);
}

const PORTIONEN = [[0.5, '½'], [0.75, '¾'], [1, '1'], [1.25, '1¼'], [1.5, '1½'], [2, '2']];
const MEAL_SLOT = { Frühstück: 'f', Mittag: 'm', Abend: 'a' };

// Lange Kante auf 1024 px: reicht der KI, hält Upload und Kosten klein
function shrinkPhoto(file, max = 1024) {
  return new Promise((ok, fail) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('kein Bild')); };
    img.src = url;
  });
}

/* ---------- Barcode ---------- */
// Jedes Foto wird zuerst auf dem Gerät nach einem Strichcode durchsucht. Gefundene
// Produkte kommen aus Open Food Facts (frei, ohne Schlüssel) und werden in S.ean
// gemerkt, damit derselbe Joghurt beim nächsten Mal auch offline klappt.
const EAN_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
// Safari auf dem iPhone hat keinen eingebauten BarcodeDetector, dann ZXing als WebAssembly
const ZXING_URL = 'https://cdn.jsdelivr.net/npm/barcode-detector@3.2.2/dist/iife/ponyfill.js';
let detector = null;
function loadScript(src) {
  return new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.append(s); });
}
async function getDetector() {
  if (detector) return detector;
  let BD = window.BarcodeDetector;
  if (BD) { try { const f = await BD.getSupportedFormats(); if (!EAN_FORMATS.some(x => f.includes(x))) BD = null; } catch (e) { BD = null; } }
  if (!BD) { if (!window.BarcodeDetectionAPI) await loadScript(ZXING_URL); BD = window.BarcodeDetectionAPI.BarcodeDetector; }
  return (detector = new BD({ formats: EAN_FORMATS }));
}
// Prüfziffer, damit falsch gelesene Ziffern (vor allem von der Bild-KI) nicht nachgeschlagen werden
function eanOk(c) {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(c)) return false;
  const d = [...c].map(Number), last = d.pop();
  const sum = d.reverse().reduce((a, x, i) => a + x * (i % 2 ? 1 : 3), 0);
  return (10 - sum % 10) % 10 === last;
}
async function findBarcode(file) {
  const scan = async () => {
    // Volle Handy-Auflösung ist unnötig langsam, 1600 px reichen für Strichcodes
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close && bmp.close();
    const codes = await (await getDetector()).detect(c);
    const hit = codes.map(x => x.rawValue).find(eanOk);
    return hit || null;
  };
  try { return await Promise.race([scan(), new Promise(ok => setTimeout(() => ok(null), 12000))]); } catch (e) { return null; }
}
// Liefert das Produkt, null wenn unbekannt oder ohne Nährwerte; wirft, wenn das Netz fehlt
async function lookupEan(code) {
  if (S.ean[code]) return S.ean[code];
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
  let j;
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_de,brands,nutriments,serving_quantity,product_quantity,product_quantity_unit`, { signal: ctl.signal });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('off');
    j = await r.json();
  } finally { clearTimeout(t); }
  if (j.status !== 1 || !j.product) return null;
  const p = j.product, n = p.nutriments || {};
  const kcal = n['energy-kcal_100g'] != null ? +n['energy-kcal_100g'] : n.energy_100g != null ? n.energy_100g / 4.184 : null;
  if (kcal == null || isNaN(kcal)) return null;
  const prod = { n: (p.product_name_de || p.product_name || '').trim() || 'Produkt', b: String(p.brands || '').split(',')[0].trim(),
    kcal: Math.round(kcal), p: Math.round((+n.proteins_100g || 0) * 10) / 10,
    serv: Math.round(+p.serving_quantity || 0), pack: Math.round(+p.product_quantity || 0), ml: /ml|l/i.test(p.product_quantity_unit || '') };
  S.ean[code] = prod;
  return prod;
}
const eanMsg = code => `Den Barcode ${code} kennt Open Food Facts noch nicht.`;
// true: Produkt-Sheet ist offen; sonst ein Hinweistext für den Weg über die Bild-KI
async function tryEan(code, src, run) {
  let prod;
  try { prod = await lookupEan(code); } catch (e) { return `Barcode ${code} erkannt, aber die Produktsuche ist gerade nicht erreichbar.`; }
  if (ui.fotoRun !== run) return true;
  if (!prod) return eanMsg(code);
  ui.ean = { code, src, prod, g: prod.serv || 100, meal: guessMeal() };
  eanSheet();
  return true;
}
const eanAmounts = pr => [pr.serv && [pr.serv, '1 Portion'], [100, '100'], pr.pack && pr.pack !== pr.serv && pr.pack !== 100 && [pr.pack, 'Packung']].filter(Boolean);
function eanLiveHTML() {
  const e = ui.ean, pr = e.prod, u = pr.ml ? 'ml' : 'g';
  return `<div class="seg wide">${eanAmounts(pr).map(([g, l]) => `<button class="${e.g === g ? 'on' : ''}" data-act="eanG" data-g="${g}">${l === '100' ? `100 ${u}` : `${l} · ${nf(g)} ${u}`}</button>`).join('')}</div>
  <div class="goals foto-sum"><div class="goal"><b class="num">${nf(pr.kcal * e.g / 100)}</b> <small>kcal</small></div><div class="goal"><b class="num">${nf(pr.p * e.g / 100)}</b> <small>g Protein</small></div></div>`;
}
function eanSheet() {
  const e = ui.ean, pr = e.prod, u = pr.ml ? 'ml' : 'g';
  openSheet(`${sheetHead('Barcode erkannt')}
  <div class="foto-top"><img src="${e.src}" alt=""><label class="f">Name<input id="eanName" class="input" value="${esc(pr.b && !pr.n.toLowerCase().includes(pr.b.toLowerCase()) ? `${pr.n} (${pr.b})` : pr.n)}"></label></div>
  <p class="muted small num">${nf(pr.kcal)} kcal und ${String(pr.p).replace('.', ',')} g Protein pro 100 ${u}</p>
  <label class="f" style="margin-top:12px">Menge in ${u}<input id="eanG" class="input num" type="number" min="1" inputmode="numeric" value="${e.g}"></label>
  <div id="eanLive">${eanLiveHTML()}</div>
  <div class="row" style="margin-top:14px"><select id="eanMeal" class="input" aria-label="Mahlzeit">${MEALS.map(m => `<option ${m === e.meal ? 'selected' : ''}>${m}</option>`).join('')}</select>
    <button class="btn primary" data-act="eanSave"><i class="ph-duotone ph-check"></i>Eintragen</button></div>
  <p class="muted small" style="text-align:center;margin-top:12px">Nährwerte von Open Food Facts · ${esc(e.code)}</p>`);
}

async function analysePhoto(file) {
  ui.foto = null; ui.ean = null;
  let src;
  try { src = await shrinkPhoto(file); } catch (e) { return fotoManualSheet('Das Bild ließ sich nicht öffnen.'); }
  const run = ui.fotoRun = uid();
  const wait = txt => openSheet(`${sheetHead('Sunni schaut hin')}<div class="foto-wait"><img src="${src}" alt=""><i></i></div><p class="muted small" style="text-align:center;margin-top:12px">${txt}</p>`);
  wait('Suche Barcode und Zutaten. Dauert ein paar Sekunden.');
  const code = await findBarcode(file);
  if (ui.fotoRun !== run) return;
  let note = '';
  if (code) {
    wait(`Barcode ${esc(code)} erkannt. Suche das Produkt …`);
    note = await tryEan(code, src, run);
    if (note === true) return;
  }
  if (!kiKey()) return code ? fotoManualSheet(note) : fotoManualSheet('Kein Barcode gefunden. Für die Foto-Erkennung von Essen fehlt noch dein API-Schlüssel.', true);
  if (!navigator.onLine) return fotoManualSheet(note || 'Du bist gerade offline.');
  wait('Erkenne Zutaten und schätze die Menge. Dauert ein paar Sekunden.');
  let res;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 90000);
  try { res = await askClaude(src.split(',')[1], ctl.signal); } catch (e) {
    if (ui.fotoRun !== run) return; // Sheet wurde inzwischen geschlossen
    return fotoManualSheet(e.name === 'AbortError' || e instanceof TypeError || e instanceof SyntaxError ? 'Die Bild-KI ist gerade nicht erreichbar.' : e.message);
  } finally { clearTimeout(t); }
  if (ui.fotoRun !== run) return;
  // Strichcode nur von der KI gelesen (z. B. unscharf): trotzdem Open Food Facts fragen
  const kc = String(res.barcode || '').replace(/\D/g, '');
  if (!code && eanOk(kc)) { wait(`Barcode ${esc(kc)} erkannt. Suche das Produkt …`); if (await tryEan(kc, src, run) === true) return; }
  if (ui.fotoRun !== run) return;
  if (!res.essen || !(res.zutaten || []).length) return fotoManualSheet(note || 'Auf dem Foto war kein Essen zu erkennen.');
  ui.foto = { src, name: res.name || '', hint: res.hinweis || '', k: 1, meal: guessMeal(),
    items: res.zutaten.map(z => ({ n: z.name, g: +z.gramm || 0, kcal: +z.kcal || 0, p: +z.protein || 0, on: true })) };
  fotoSheet();
}

const fotoSum = () => { const f = ui.foto, on = f.items.filter(i => i.on); return { kcal: on.reduce((a, i) => a + i.kcal, 0) * f.k, p: on.reduce((a, i) => a + i.p, 0) * f.k }; };
function fotoLiveHTML() {
  const f = ui.foto, s = fotoSum();
  return `<div class="foto-items">${f.items.map((i, x) => `<div class="food-entry ${i.on ? '' : 'off'}"><span class="t">${esc(i.n)}<small class="muted num">${nf(i.g * f.k)} g</small></span><span class="v num">${nf(i.kcal * f.k)} kcal<br>${nf(i.p * f.k)} g P</span><button class="mini" data-act="fotoItem" data-i="${x}" aria-label="${i.on ? 'Entfernen' : 'Wieder dazunehmen'}"><i class="ph-duotone ${i.on ? 'ph-x' : 'ph-arrow-counter-clockwise'}"></i></button></div>`).join('')}</div>
  <p class="foto-label">Portion</p>
  <div class="seg wide">${PORTIONEN.map(([k, l]) => `<button class="${f.k === k ? 'on' : ''}" data-act="fotoK" data-k="${k}">${l}×</button>`).join('')}</div>
  <div class="goals foto-sum"><div class="goal"><b class="num">${nf(s.kcal)}</b> <small>kcal</small></div><div class="goal"><b class="num">${nf(s.p)}</b> <small>g Protein</small></div></div>`;
}
function fotoSheet() {
  const live = $('#fotoLive'); if (live) { live.innerHTML = fotoLiveHTML(); return; }
  const f = ui.foto;
  openSheet(`${sheetHead('Das liegt auf dem Teller')}
  <div class="foto-top"><img src="${f.src}" alt=""><label class="f">Name<input id="fotoName" class="input" value="${esc(f.name)}" placeholder="Was gab's?"></label></div>
  <div id="fotoLive">${fotoLiveHTML()}</div>
  <p class="muted small">${f.hint ? esc(f.hint) + ' ' : ''}Geschätzt, kann um 20 bis 30 % danebenliegen.</p>
  <div class="row" style="margin-top:14px"><select id="fotoMeal" class="input" aria-label="Mahlzeit">${MEALS.map(m => `<option ${m === f.meal ? 'selected' : ''}>${m}</option>`).join('')}</select>
    <button class="btn primary" data-act="fotoSave"><i class="ph-duotone ph-check"></i>Eintragen</button></div>
  <button class="link" data-act="fotoManual" style="display:block;margin:16px auto 0">Lieber selbst eintragen</button>`);
}
function fotoManualSheet(msg, needKey = false) {
  const f = ui.foto, s = f ? fotoSum() : null;
  const name = f ? ($('#fotoName') ? $('#fotoName').value : f.name) : '';
  const meal = (f && $('#fotoMeal') ? $('#fotoMeal').value : f && f.meal) || guessMeal();
  openSheet(`${sheetHead('Selbst eintragen')}${msg ? `<div class="foto-msg"><i class="ph-duotone ph-info"></i><span>${esc(msg)} ${needKey ? 'Bis dahin trägst du es einfach selbst ein.' : 'Trag es einfach selbst ein.'}${needKey ? `<br><button class="link" data-act="settings">Schlüssel in den Einstellungen eintragen</button>` : ''}</span></div>` : ''}
  <form class="form" data-form="fotoManual">
    <label class="f">Was gab's?<input id="fotoManIn" class="input" name="t" autocomplete="off" required value="${esc(name)}" placeholder="z. B. Döner" autofocus></label>
    <div class="three"><label class="f">kcal<input class="input num" name="kcal" type="number" min="0" inputmode="numeric" value="${s ? Math.round(s.kcal) : ''}"></label><label class="f">Protein g<input class="input num" name="p" type="number" min="0" inputmode="numeric" value="${s ? Math.round(s.p) : ''}"></label>
    <label class="f">Mahlzeit<select class="input" name="meal">${MEALS.map(m => `<option ${m === meal ? 'selected' : ''}>${m}</option>`).join('')}</select></label></div>
    <button class="btn dark"><i class="ph-duotone ph-plus"></i>Eintragen</button>
  </form>`);
}

function act(a, el) {
  const d = el.dataset;
  if (a.startsWith('u.')) return UNI.act(a.slice(2), el);
  switch (a) {
    case 'skip': ui.skip.add(d.key); return render();
    case 'skipReset': ui.skip.clear(); return render();
    case 'med': { const l = L(); const i = l.meds.indexOf(d.id); if (i >= 0) l.meds.splice(i, 1); else { l.meds.push(d.id); buzz(); if (medsActive().every(m => l.meds.includes(m.id))) toast('Genommen. Abgehakt für heute.'); } return save(); }
    case 'medsEdit': return medsSheet();
    case 'medAdd': S.meds.push({ id: uid(), t: 'Neu', time: '08:00', until: '' }); persist(); return medsSheet();
    case 'medDel': S.meds = S.meds.filter(m => m.id !== d.id); persist(); render(); return medsSheet();
    case 'pillar': {
      const l = L(), p = S.mk.pillars.find(x => x.id === d.id); if (!p) return;
      const was = dayWon(today()), i = l.mk.indexOf(p.id);
      if (i >= 0) l.mk.splice(i, 1); else if (!pillarDone(p)) { l.mk.push(p.id); ui.pulse = p.id; buzz(); }
      else { l.mk.push(p.id); }
      if (!was && dayWon(today())) { confetti(90); toast('Tag gewonnen. Genau so.'); }
      persist(); render(); ui.pulse = null; return;
    }
    case 'mkSetup': O.i = 0; onbEl.hidden = false; return renderOnb();
    case 'mkSettings': return mkSettingsSheet();
    case 'mkStop': if (!confirm('Mönch-Modus pausieren? Deine Daten bleiben.')) return; S.mk.on = false; closeSheet(); return save();
    case 'pilDel': S.mk.pillars = S.mk.pillars.filter(p => p.id !== d.id); persist(); render(); return mkSettingsSheet();
    case 'mkBlocks': return mkBlocksSheet();
    case 'blkDay': { const b = S.mk.blocks.find(x => x.id === d.id); if (!b) return; b.days = b.days.includes(d.d) ? b.days.filter(x => x !== d.d) : WEEK.filter(x => x === d.d || b.days.includes(x)); persist(); render(); return mkBlocksSheet(); }
    case 'blkDel': S.mk.blocks = S.mk.blocks.filter(b => b.id !== d.id); persist(); render(); return mkBlocksSheet();
    case 'blkAdd': S.mk.blocks.push({ id: 'b-' + uid(), t: 'Neuer Block', i: 'ph-square', days: ['mo'], time: '09:00', min: 60 }); persist(); return mkBlocksSheet();
    case 'blockGo': { const b = S.mk.blocks.find(x => x.id === d.id); if (!b) return; const l = L(); if (!l.blk.includes(b.id)) l.blk.push(b.id); startFt(+b.min || 50, b.t); return; }
    case 'topGo': { const t = L().top[+d.i]; if (t) startFt(50, t.t); return; }
    case 'ftQuick': return startFt(+d.min || 50, d.t || '');
    case 'focusTop': { const i = $('#topIn'); if (i) { i.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => i.focus(), 300); } return; }
    case 'phone': { const ph = S.mk.phone || (S.mk.phone = {}); ph[d.id] = !ph[d.id]; if (ph[d.id]) buzz(); if (PHONE.every(([k]) => ph[k])) { confetti(70); toast('Handy aufgeräumt. Weniger Lärm, mehr Fokus.'); closeSheet(); return save(); } persist(); render(); return phoneSheet(); }
    case 'phoneHide': S.mk.phone.hide = true; closeSheet(); return save();
    case 'goalToggle': { const g = S.goals[monday()] || []; const t = g[+d.i]; if (!t) return; t.done = !t.done; if (t.done) { buzz(); if (g.length === 3 && g.every(x => x.done)) { confetti(80); toast('Alle drei Wochenziele. Stark.'); } } return save(); }
    case 'goalDel': (S.goals[monday()] || []).splice(+d.i, 1); return save();
    case 'ideasOpen': ui.tab = 'aufgaben'; ui.todoF = 'ideen'; ui.tabChanged = true; closeSheet(); document.body.scrollTo(0, 0); return render();
    case 'ideaDel': S.ideas = S.ideas.filter(x => x.id !== d.id); return save();
    case 'ideaTodo': { const x = S.ideas.find(i => i.id === d.id); if (!x) return; S.todos.unshift({ id: uid(), t: x.t, when: 'später', done: false }); S.ideas = S.ideas.filter(i => i.id !== d.id); toast('Liegt jetzt unter Später.'); return save(); }
    case 'spendDel': S.geld.items = S.geld.items.filter(x => x.id !== d.id); return save();
    case 'saveToggle': { const m = ym(); S.geld.saved[m] = !S.geld.saved[m]; if (S.geld.saved[m]) { confetti(60); toast('Zuerst gespart. Langfristig gedacht.'); } return save(); }
    case 'wishBuy': { const x = S.geld.wish.find(w => w.id === d.id); if (!x) return; S.geld.items.push({ id: uid(), d: today(), a: x.a, t: x.t, c: 'shop', ts: Date.now() }); S.geld.wish = S.geld.wish.filter(w => w.id !== d.id); return save(); }
    case 'wishDrop': { const x = S.geld.wish.find(w => w.id === d.id); if (!x) return; S.geld.notBought += x.a; S.geld.wish = S.geld.wish.filter(w => w.id !== d.id); toast(`${eur(x.a)} nicht ausgegeben.`); return save(); }
    case 'calSheet': return calSheet();
    case 'ownAdd': return ownSheet();
    case 'ownDel': S.cal.own = (S.cal.own || []).filter(e => e.id !== d.id); return save();
    case 'pasteSheet': return pasteSheet();
    case 'phoneSheet': return phoneSheet();
    case 'calPaste': if (!navigator.clipboard || !navigator.clipboard.readText) return pasteSheet(); navigator.clipboard.readText().then(t => { if (!importPasted(t)) pasteSheet(); }).catch(() => pasteSheet()); return;
    case 'workAdd': { const k = today(); S.work.log[k] = Math.round(((S.work.log[k] || 0) + +d.h) * 10) / 10; buzz(); toast(`+${d.h} Std eingetragen.`); return save(); }
    case 'workDel': delete S.work.log[d.k]; persist(); render(); return workSheet();
    case 'workSheet': return workSheet();
    case 'workBlock': S.mk.blocks.push({ id: 'b-' + uid(), t: 'Werkstudent', i: 'ph-briefcase', days: [], time: '09:00', min: 480 }); persist(); toast('Tage antippen, Uhrzeit setzen.'); return mkBlocksSheet();
    case 'calExport': return UNI.exportIcs();
    case 'calPick': return $('#calFile').click();
    case 'calClear': S.cal = { events: [], name: '' }; persist(); render(); return calSheet();
    case 'calUrl': return loadCalUrl(($('#calUrl') || {}).value);
    case 'tab': ui.tab = d.tab; ui.tabChanged = true; closeSheet(); if (d.tab === 'aufgaben' && ui.todoF === 'ideen') ui.todoF = 'heute'; document.body.scrollTo(0, 0); return render();
    case 'tab-shop': ui.foodSeg = 'einkauf'; return render();
    case 'settings': return settingsSheet();
    case 'closeSheet': return closeSheet();
    case 'hideHint': S.set.hideHint = true; return save();
    case 'which': ui.which = d.w; return render();
    case 'showDone': ui.showDone = true; return render();
    case 'rWhich': ui.rWhich = d.w; return render();
    case 'toggleStep': toggleStep(d.w, d.id); persist(); render(); ui.pulse = null; return;
    case 'focus': if (DESK && document.body.classList.contains('widget-mode')) return DESK.focus(d.w); if (pipWin) window.focus(); return openFocus(d.w);
    case 'fClose': return closeFocus();
    case 'fDone': { const l = L(); const s = S.routines[F.w][F.i]; if (s && !l[F.w].includes(s.id)) { l[F.w].push(s.id); setFull(F.w, l); persist(); } buzz(); return focusNext(); }
    case 'fSkip': return focusNext();
    case 'fPause': if (F.paused) { F.start += Date.now() - F.pausedAt; F.paused = false; } else { F.pausedAt = Date.now(); F.paused = true; } return renderFocus();
    case 'topToggle': { const t = L().top[+d.i]; if (!t) return; t.done = !t.done; if (t.done) { buzz(); if (L().top.every(x => x.done) && L().top.length === 3) { confetti(70); toast('Alle drei erledigt. Unternehmer-Tag gewonnen!'); } } return save(); }
    case 'topDel': L().top.splice(+d.i, 1); return save();
    case 'water': { const l = L(ui.tab === 'essen' && ui.foodDay ? ui.foodDay : today()); const n = +d.n; l.w = l.w === n ? n - 1 : n; buzz(); if (l.w === S.set.water) toast('Wasserziel erreicht. Prost! 💧'); return save(); }
    case 'editStep': return stepSheet(d.w, d.id);
    case 'moveStep': { const r = S.routines[d.w]; const i = r.findIndex(s => s.id === d.id); const j = i + +d.d; if (j < 0 || j >= r.length) return; [r[i], r[j]] = [r[j], r[i]]; return save(); }
    case 'delStep': { const r = S.routines[d.w]; const i = r.findIndex(s => s.id === d.id); if (i >= 0) r.splice(i, 1); setFull(d.w, L()); return save(); }
    case 'todoF': ui.todoF = d.f; return render();
    case 'todoToggle': { const t = S.todos.find(x => x.id === d.id); if (!t) return; t.done = !t.done; t.doneAt = t.done ? Date.now() : null; if (t.done) buzz(); return save(); }
    case 'todoMove': { const t = S.todos.find(x => x.id === d.id); if (t) t.when = t.when === 'heute' ? 'später' : 'heute'; return save(); }
    case 'todoDel': S.todos = S.todos.filter(x => x.id !== d.id); return save();
    case 'todoClear': S.todos = S.todos.filter(x => !x.done); return save();
    case 'ftStart': S.ft = { dur: +d.min * 60, end: Date.now() + +d.min * 60000, label: ui.ftLabel || '' }; ui.ftLabel = null;
      try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
      return save();
    case 'ftPause': if (S.ft.end) { S.ft.left = (S.ft.end - Date.now()) / 1000; S.ft.end = null; } else { S.ft.end = Date.now() + S.ft.left * 1000; } return save();
    case 'ftStop': S.ft = null; return save();
    case 'ftLabel': ui.ftLabel = ui.ftLabel === d.t ? null : d.t; return render();
    case 'foodSeg': ui.foodSeg = d.s; return render();
    case 'foodDay': { const dt = new Date((ui.foodDay || today()) + 'T12:00'); dt.setDate(dt.getDate() + +d.d); const k = dk(dt); ui.foodDay = k > today() ? today() : k; return render(); }
    case 'foodDel': { const l = L(ui.foodDay || today()); l.food = l.food.filter(f => f.id !== d.id); return save(); }
    case 'logFromRecipe': return logRecipeSheet();
    case 'foodPhoto':
      // Kein Schlüssel nötig: Barcodes klappen auch ohne, erst danach entscheidet analysePhoto
      ui.foto = null; $('#photoFile').click(); return;
    case 'kiKeyDel': try { localStorage.removeItem(KI_KEY); } catch (e) {} toast('Schlüssel von diesem Gerät gelöscht.'); return settingsSheet();
    case 'fotoItem': { const i = ui.foto.items[+d.i]; i.on = !i.on; return fotoSheet(); }
    case 'fotoK': ui.foto.k = +d.k; return fotoSheet();
    case 'fotoManual': return fotoManualSheet();
    case 'eanG': ui.ean.g = +d.g; $('#eanG').value = d.g; $('#eanLive').innerHTML = eanLiveHTML(); return;
    case 'eanSave': {
      const e = ui.ean, g = +$('#eanG').value, meal = $('#eanMeal').value;
      if (!(g > 0)) { toast('Wie viel war es? Trag die Menge ein.'); return; }
      addFood({ t: $('#eanName').value.trim() || e.prod.n, kcal: Math.round(e.prod.kcal * g / 100), p: Math.round(e.prod.p * g / 100), meal, slot: MEAL_SLOT[meal], src: 'barcode', ean: e.code }, ui.foodDay || today());
      ui.ean = null; closeSheet(); toast('Eingetragen. Guten Appetit!'); return save();
    }
    case 'fotoSave': {
      const f = ui.foto, s = fotoSum(), meal = $('#fotoMeal').value;
      if (!f.items.some(i => i.on)) { toast('Alle Zutaten entfernt. Nimm eine wieder dazu.'); return; }
      addFood({ t: $('#fotoName').value.trim() || 'Foto-Mahlzeit', kcal: Math.round(s.kcal), p: Math.round(s.p), meal, slot: MEAL_SLOT[meal], src: 'foto' }, ui.foodDay || today());
      ui.foto = null; closeSheet(); toast('📸 Eingetragen. Guten Appetit!'); return save();
    }
    case 'openRecipe': ui.portions = 1; return recipeSheet(d.id);
    case 'portions': ui.portions = Math.max(1, Math.min(12, ui.portions + +d.d)); return recipeSheet(d.id);
    case 'ateRecipe': {
      const r = getR(d.id); const meal = guessMeal();
      const day = ui.tab === 'essen' && ui.foodSeg === 'tagebuch' && ui.foodDay ? ui.foodDay : today();
      const slot = { Frühstück: 'f', Mittag: 'm', Abend: 'a' }[meal];
      const k = ui.portions || 1;
      addFood({ t: r.t + (k > 1 ? ` (${k}x)` : ''), kcal: (r.kcal || 0) * k, p: (r.p || 0) * k, meal, rid: r.id, slot }, day);
      closeSheet(); toast(`${r.e} eingetragen. Guten Appetit!`); return save();
    }
    case 'toPlan': return toPlanSheet(d.id);
    case 'editRecipe': return editRecipeSheet(d.id);
    case 'delRecipe': if (!confirm('Rezept wirklich löschen?')) return; S.recipes = S.recipes.filter(r => r.id !== d.id); closeSheet(); return save();
    case 'rtag': ui.rtag = d.t; return render();
    case 'planPick': return planPickSheet(d.day, d.slot);
    case 'planSet': { const p = S.plan[d.day] || (S.plan[d.day] = {}); if (d.id) p[d.slot] = d.id; else delete p[d.slot]; closeSheet(); return save(); }
    case 'planDice': {
      let n = 0;
      for (const day of WEEK) for (const [k, lab] of Object.entries(SLOTS)) {
        const p = S.plan[day] || (S.plan[day] = {}); if (p[k]) continue;
        const pool = allRecipes().filter(r => (r.tags || []).includes(lab)); if (!pool.length) continue;
        p[k] = pool[Math.floor(Math.random() * pool.length)].id; n++;
      }
      toast(n ? `🎲 ${n} Lücken gefüllt.` : 'Dein Plan ist schon voll.'); if (n) confetti(30); return save();
    }
    case 'planClear': if (!confirm('Ganzen Wochenplan leeren?')) return; S.plan = {}; return save();
    case 'shopToggle': if (S.shop.c[d.key]) delete S.shop.c[d.key]; else { S.shop.c[d.key] = 1; buzz(); } return save();
    case 'shopReset': S.shop.c = {}; S.shop.extra = S.shop.extra.filter(x => !x.done); return save();
    case 'extraToggle': { const x = S.shop.extra.find(e => e.id === d.id); if (x) x.done = !x.done; return save(); }
    case 'extraDel': S.shop.extra = S.shop.extra.filter(e => e.id !== d.id); return save();
    case 'importOpen': return importSheet();
    case 'theme': S.set.theme = d.t; applyTheme(); persist(); return settingsSheet();
    case 'widgetSync': location.href = 'scriptable:///run/Sonnenklar?data=' + encodeURIComponent(JSON.stringify(widgetData())); return;
    case 'copyCode': if (!WTPL) { toast('Widget-Code lädt noch. Gleich nochmal tippen.'); return; } navigator.clipboard.writeText(scriptableCode()).then(() => toast('Code kopiert. Ab in Scriptable damit!'), () => toast('Kopieren ging nicht. Markier den Code von Hand.')); return;
    case 'export': {
      const blob = new Blob([JSON.stringify(Object.assign({}, S, { _uni: UNI.S() }), null, 1)], { type: 'application/json' });
      const a2 = document.createElement('a'); a2.href = URL.createObjectURL(blob); a2.download = `moench-backup-${today()}.json`; a2.click();
      setTimeout(() => URL.revokeObjectURL(a2.href), 2000); return;
    }
    case 'import': return $('#importFile').click();
    case 'reset': if (!confirm('Wirklich alles löschen? Routinen, Aufgaben, Tagebuch und eigene Rezepte sind dann weg.')) return; localStorage.removeItem(KEY); localStorage.removeItem(UNI.key); localStorage.removeItem(KI_KEY); location.reload(); return;
  }
}

function onClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (el.tagName === 'A') e.preventDefault();
  act(el.dataset.act, el);
}
document.addEventListener('click', onClick);
document.querySelectorAll('.tab[data-tab]').forEach(b => b.addEventListener('click', () => { ui.tab = b.dataset.tab; ui.tabChanged = true; document.body.scrollTo(0, 0); render(); }));

document.addEventListener('submit', e => {
  const f = e.target; const k = f.dataset.form; if (!k) return;
  e.preventDefault();
  const v = Object.fromEntries(new FormData(f).entries());
  const t = (v.t || '').trim();
  switch (k) {
    case 'own': { if (!t) return; (S.cal.own || (S.cal.own = [])).push({ id: uid(), d: v.d || today(), s: v.s || '', e: v.e || '', t }); closeSheet(); toast('Eingetragen.'); return save(); }
    case 'paste': importPasted(v.txt); return;
    case 'work': { const h = parseFloat(String(v.h || '').replace(',', '.')); if (!(h > 0)) { toast('Wie viele Stunden?'); return; } const k = v.d || today(); S.work.log[k] = Math.round(((S.work.log[k] || 0) + h) * 10) / 10; persist(); render(); toast(`${fh(h)} eingetragen.`); return workSheet(); }
    case 'goal': { if (!t) return; const g = S.goals[monday()] || (S.goals[monday()] = []); if (g.length >= 3) return; g.push({ t, done: false }); ui.focusSel = g.length < 3 ? '#goalIn' : null; return save(); }
    case 'idea': if (!t) return; S.ideas.unshift({ id: uid(), t, ts: Date.now() }); toast('Geparkt. Sonntag schaust du drauf.'); ui.focusSel = null; return save();
    case 'spend': { const a = parseFloat(String(v.a || '').replace(',', '.')); if (!(a > 0)) { toast('Betrag fehlt.'); return; } S.geld.items.push({ id: uid(), d: today(), a: Math.round(a * 100) / 100, t, c: v.c || 'sonst', ts: Date.now() }); buzz(); ui.focusSel = '#' + f.querySelector('input').id; return save(); }
    case 'wish': { const a = parseFloat(String(v.a || '').replace(',', '.')) || 0; if (!t) return; S.geld.wish.unshift({ id: uid(), t, a, ts: Date.now() }); toast('Auf der Liste. In 3 Tagen nochmal fragen.'); return save(); }
    case 'pil': { if (!t) return; S.mk.pillars.push({ id: 'p-' + uid(), t, i: 'ph-check-circle' }); persist(); render(); mkSettingsSheet(); setTimeout(() => $('#pilIn') && $('#pilIn').focus(), 30); return; }
    case 'top': if (!t) return; L().top.push({ t, done: false }); ui.focusSel = L().top.length < 3 ? '#topIn' : null; return save();
    case 'todo': { if (!t) return; const td = { id: uid(), t, when: f.dataset.when, done: false }; S.todos.unshift(td); ui.newId = td.id; ui.focusSel = '#' + f.querySelector('input').id; return save(); }
    case 'step': { if (!t) return; const s = { id: uid(), t, min: Math.max(0, +v.min || 0) }; S.routines[f.dataset.w].push(s); setFull(f.dataset.w, L()); ui.newId = s.id; ui.focusSel = '#stepIn'; return save(); }
    case 'stepEdit': { const s = S.routines[f.dataset.w].find(x => x.id === f.dataset.id); if (s) { s.t = t || s.t; s.min = Math.max(0, +v.min || 0); } closeSheet(); return save(); }
    case 'food': if (!t) return; addFood({ t, kcal: +v.kcal || 0, p: +v.p || 0, meal: v.meal }, ui.foodDay || today()); ui.focusSel = '#foodIn'; return save();
    case 'fotoManual': if (!t) return; addFood({ t, kcal: +v.kcal || 0, p: +v.p || 0, meal: v.meal, slot: MEAL_SLOT[v.meal] }, ui.foodDay || today()); ui.foto = null; closeSheet(); toast('Eingetragen.'); return save();
    case 'extra': if (!t) return; S.shop.extra.push({ id: uid(), t, done: false }); ui.focusSel = '#extraIn'; return save();
    case 'planText': { const p = S.plan[f.dataset.day] || (S.plan[f.dataset.day] = {}); if (t) p[f.dataset.slot] = { t }; else delete p[f.dataset.slot]; closeSheet(); return save(); }
    case 'toPlan': { const p = S.plan[v.day] || (S.plan[v.day] = {}); p[v.slot] = f.dataset.id; closeSheet(); toast(`Eingeplant: ${WDL[v.day]}, ${SLOTS[v.slot]}`); return save(); }
    case 'recipe': {
      if (!t) return;
      const lines = s => String(s || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
      const data = { e: (v.e || '').trim() || guessEmoji(t), t, min: +v.min || 0, kcal: +v.kcal || 0, p: +v.p || 0,
        tags: String(v.tags || '').split(',').map(x => x.trim()).filter(Boolean), ing: lines(v.ing), steps: lines(v.steps) };
      const id = f.dataset.id;
      if (id) Object.assign(S.recipes.find(r => r.id === id), data); else S.recipes.push(Object.assign({ id: 'c' + uid() }, data));
      closeSheet(); ui.foodSeg = 'rezepte'; toast('Rezept gespeichert.'); return save();
    }
    case 'import': {
      const res = parseImport(v.txt || '');
      if (!res.recipes.length && !res.plan.length) { toast('Nichts erkannt. Rezepte mit # beginnen.'); return; }
      for (const r of res.recipes) { const i = S.recipes.findIndex(x => x.t.toLowerCase() === r.t.toLowerCase()); if (i >= 0) { r.id = S.recipes[i].id; S.recipes[i] = r; } else S.recipes.push(r); }
      let pn = 0;
      for (const p of res.plan) {
        const r = allRecipes().find(x => x.t.toLowerCase() === p.t.toLowerCase()) || allRecipes().find(x => x.t.toLowerCase().includes(p.t.toLowerCase()));
        (S.plan[p.d] || (S.plan[p.d] = {}))[p.s] = r ? r.id : { t: p.t }; pn++;
      }
      closeSheet(); ui.rtag = 'Alle'; confetti(50);
      toast(`${res.recipes.length} Rezepte${pn ? ` und ${pn} Plan-Einträge` : ''} übernommen.`); return save();
    }
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'kiKeyIn') {
    const v = e.target.value.trim(); if (!v) return;
    try { localStorage.setItem(KI_KEY, v); } catch (x) { toast('Speichern fehlgeschlagen.'); return; }
    toast('Schlüssel gespeichert. Foto-Erkennung ist bereit.'); return settingsSheet();
  }
  const ds = e.target.dataset || {}, val0 = e.target.value;
  if (ds.mk) { S.mk[ds.mk] = val0.trim(); if (ds.mk === 'start' && S.mk.end && S.mk.end < S.mk.start) S.mk.end = addD(S.mk.start, 89); persist(); render(); return; }
  if (ds.pil) { const p = S.mk.pillars.find(x => x.id === ds.pil); if (p && val0.trim()) { p.t = val0.trim(); persist(); render(); } return; }
  if (ds.blk) { const b = S.mk.blocks.find(x => x.id === ds.blk); if (b) { b[ds.k] = ds.k === 'min' ? Math.max(5, +val0 || 30) : val0.trim() || b[ds.k]; persist(); render(); } return; }
  if (ds.med) { const m = S.meds.find(x => x.id === ds.med); if (m) { m[ds.k] = ds.k === 't' ? (val0.trim() || m.t) : val0; persist(); render(); } return; }
  if (ds.work) { S.work[ds.work] = parseFloat(String(val0).replace(',', '.')) || 0; persist(); render(); return workSheet(); }
  if (ds.gset) { const n = parseFloat(String(val0).replace(',', '.')) || 0; S.geld[ds.gset] = ds.gset === 'payday' ? Math.max(1, Math.min(31, Math.round(n) || 1)) : Math.max(0, n); persist(); render(); return; }
  if (e.target.id === 'calFile' && e.target.files[0]) { const file = e.target.files[0]; file.text().then(txt => importCal(txt, file.name.replace(/\.ics$/i, ''))); e.target.value = ''; return; }
  const k = ds.set; if (!k) return;
  const val = e.target.value;
  S.set[k] = ['eve', 'kcal', 'protein', 'water'].includes(k) ? Math.max(k === 'water' ? 1 : 0, Math.min(k === 'water' ? 16 : 99999, +val || 0)) : val.trim();
  persist(); render();
});
document.addEventListener('input', e => {
  if (e.target.id === 'eanG' && ui.ean) { ui.ean.g = +e.target.value || 0; $('#eanLive').innerHTML = eanLiveHTML(); }
  if (e.target.id === 'rq') { ui.rq = e.target.value; const g = $('#rgrid'); if (g) g.innerHTML = rgridHTML(); }
  if (e.target.id === 'pickQ') { const q = e.target.value.toLowerCase(); document.querySelectorAll('#pickList .pick').forEach(p => { p.hidden = q && !p.dataset.s.includes(q); }); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!sheetEl.hidden) closeSheet(); else if (F) closeFocus(); }
  if (F && !F.finished && (e.key === 'Enter' || e.key === ' ') && !e.target.closest('input,textarea,button')) { e.preventDefault(); act('fDone', focusEl); }
});
$('#importFile').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  file.text().then(txt => {
    const data = JSON.parse(txt);
    if (!data || !data.routines) throw new Error('kein Backup');
    if (data._uni) { localStorage.setItem(UNI.key, JSON.stringify(data._uni)); delete data._uni; }
    if (!confirm('Backup laden? Die aktuellen Daten auf diesem Gerät werden ersetzt.')) return;
    localStorage.setItem(KEY, JSON.stringify(data)); location.reload();
  }).catch(() => toast('Das ist keine Mönch- oder Sonnenklar-Sicherung.'));
  e.target.value = '';
});
$('#photoFile').addEventListener('change', e => {
  const file = e.target.files[0]; e.target.value = '';
  if (file) analysePhoto(file);
});

function applyTheme() {
  const t = S.set.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  if (pipWin) { const de = pipWin.document.documentElement; if (t === 'light' || t === 'dark') de.dataset.theme = t; else delete de.dataset.theme; }
}

// Tageswechsel, Routinenwechsel und Uhrzeit-Begrüßung aktuell halten
let lastKey = today() + curWhich();
setInterval(() => { const k = today() + curWhich(); if (k !== lastKey) { lastKey = k; if (!F) render(); } }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !F && sheetEl.hidden) render(); });
window.addEventListener('storage', e => { if (e.key === KEY) { try { S = JSON.parse(e.newValue); render(); } catch (x) {} } });
if (bc) bc.onmessage = () => { try { S = JSON.parse(localStorage.getItem(KEY)) || S; } catch (x) {} if (!F) render(); };

/* ---------- Einführung beim ersten Start: Name und Tagesziele ---------- */
const onbEl = $('#onb');
const O = { i: 0, name: S.set.name, end: S.mk.end || addD(today(), 89), wake: S.mk.wake, book: S.mk.book, week: S.geld.week, save: S.geld.save, payday: S.geld.payday };
function renderOnb() {
  const steps = 3, p = Math.round((O.i + 1) / steps * 100);
  const top = `<div class="onb-top"><div class="bar"><i style="--w:${p}%"></i></div><button class="onb-skip" data-onb="skip">Später</button></div>`;
  let mid, bot;
  if (O.i === 0) {
    mid = `<div class="mascot">${sunni('happy', false)}</div><h1>Mönch-Modus</h1><p class="lead">Eine App statt vielen. Sie sagt dir, was jetzt dran ist: Studium, P4, Training, Lesen, Geld. Alles andere wird geparkt.${migrated ? ' Deine Routinen und Aufgaben aus Sonnenklar sind schon drin.' : ''} Wie heißt du?</p>
      <input class="input" id="onbName" placeholder="Dein Vorname" value="${esc(O.name)}" autocomplete="given-name">`;
    bot = `<button class="btn primary block" data-onb="next">Weiter</button>`;
  } else if (O.i === 1) {
    mid = `<div class="mascot">${sunni('ok', false)}</div><h1>Deine Regeln${O.name ? `, ${esc(O.name)}` : ''}</h1><p class="lead">Wie lange ziehst du durch? Vorschlag: 90 Tage, bis nach der Klausurenphase.</p>
      <div class="two"><label class="f">Bis wann?<input class="input" type="date" id="onbEnd" value="${O.end}"></label><label class="f">Aufstehen bis<input class="input" type="time" id="onbWake" value="${O.wake}"></label></div>
      <label class="f">Welches Buch liest du gerade? (optional)<input class="input" id="onbBook" value="${esc(O.book)}" placeholder="Titel"></label>`;
    bot = `<button class="btn primary block" data-onb="next">Weiter</button><button class="btn ghost block" data-onb="back">Zurück</button>`;
  } else {
    mid = `<div class="mascot">${sunni('ok', false)}</div><h1>Geld im Griff</h1><p class="lead">Ein festes Wochenbudget für alles außer Miete und Fixkosten. Und am Gehaltstag zuerst sparen, dann leben.</p>
      <div class="three"><label class="f">Pro Woche €<input class="input num" type="number" min="0" inputmode="decimal" id="onbWeek" value="${O.week}"></label><label class="f">Sparen €/Monat<input class="input num" type="number" min="0" inputmode="decimal" id="onbSave" value="${O.save || ''}" placeholder="z. B. 200"></label><label class="f">Gehaltstag<input class="input num" type="number" min="1" max="31" id="onbPay" value="${O.payday}"></label></div>`;
    bot = `<button class="btn primary block" data-onb="done"><i class="ph-fill ph-flame"></i>Mönch-Modus starten</button><button class="btn ghost block" data-onb="back">Zurück</button>`;
  }
  onbEl.innerHTML = `${top}<div class="onb-mid" key="${O.i}">${mid}</div><div class="onb-bot">${bot}</div>`;
}
function readOnb() {
  const v = id => $('#' + id) && $('#' + id).value;
  if ($('#onbName')) O.name = v('onbName').trim();
  if ($('#onbEnd')) O.end = v('onbEnd') || O.end;
  if ($('#onbWake')) O.wake = v('onbWake') || O.wake;
  if ($('#onbBook')) O.book = v('onbBook').trim();
  if ($('#onbWeek')) O.week = Math.max(0, parseFloat(v('onbWeek')) || 0);
  if ($('#onbSave')) O.save = Math.max(0, parseFloat(v('onbSave')) || 0);
  if ($('#onbPay')) O.payday = Math.max(1, Math.min(31, parseInt(v('onbPay'), 10) || 1));
}
function finishOnb(go) {
  readOnb();
  if (O.name) S.set.name = O.name;
  if (go) {
    Object.assign(S.mk, { on: true, start: today(), end: O.end > today() ? O.end : addD(today(), 89), wake: O.wake, book: O.book });
    Object.assign(S.geld, { week: O.week, save: O.save, payday: O.payday });
  }
  S.set.onboarded = true; persist();
  onbEl.hidden = true; onbEl.innerHTML = ''; render();
  if (go) { confetti(90); toast('Tag 1. Los geht’s.'); }
}
onbEl.addEventListener('click', e => {
  const b = e.target.closest('[data-onb]'); if (!b) return;
  readOnb();
  const a = b.dataset.onb;
  if (a === 'next') { O.i = Math.min(2, O.i + 1); renderOnb(); }
  else if (a === 'back') { O.i = Math.max(0, O.i - 1); renderOnb(); }
  else if (a === 'done') finishOnb(true);
  else if (a === 'skip') finishOnb(false);
});
onbEl.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); const b = onbEl.querySelector('[data-onb="next"], [data-onb="done"]'); b && b.click(); } });

/* ---------- Fokus-Timer starten, Kalender-Link, Ideen ---------- */
function startFt(min, label) {
  S.ft = { dur: min * 60, end: Date.now() + min * 60000, label: label || '' };
  try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
  toast(`${min} Minuten ${label ? label + ' ' : ''}laufen. Handy weg.`);
  save();
}
async function loadCalUrl(u) {
  u = String(u || '').trim().replace(/^webcal:/i, 'https:');
  if (!/^https:\/\//i.test(u)) { toast('Bitte einen webcal://- oder https://-Link.'); return; }
  S.cal.url = u; persist();
  try {
    const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status);
    importCal(await r.text(), 'Kalender-Link');
  } catch (e) { toast('Der Kalender blockt das direkte Laden. Nimm die .ics-Datei.'); }
}
function rIdeen() {
  const cnt = w => S.todos.filter(t => !t.done && t.when === w).length;
  return `${head('Aufgaben', 'Fokus statt Chaos')}
  <div class="stack">
    <div class="seg wide"><button data-act="todoF" data-f="heute">Heute <span class="count num">${cnt('heute')}</span></button><button data-act="todoF" data-f="später">Später <span class="count num">${cnt('später')}</span></button><button class="on" data-act="todoF" data-f="ideen">Ideen <span class="count num">${S.ideas.length}</span></button><button data-act="todoF" data-f="erledigt">Erledigt</button></div>
    ${ideaCard()}
    <section class="card"><div class="card-head"><h2><span class="hic"><i class="ph-duotone ph-local-parking"></i></span>Geparkt</h2></div>
      <p class="muted small" style="margin-bottom:10px">Jeden Sonntag einmal durch: Passt das zu Studium, P4, Training oder Geld? Dann wird es eine Aufgabe. Sonst weg damit.</p>
      <div class="list">${S.ideas.map(x => `<div class="todo"><span class="t">${esc(x.t)}<small class="muted" style="display:block;font-size:12px">${fmtDate(dk(new Date(x.ts)))}</small></span><span class="acts"><button class="mini" data-act="ideaTodo" data-id="${x.id}" title="Zur Aufgabe machen" aria-label="Zur Aufgabe machen"><i class="ph-duotone ph-arrow-bend-up-right"></i></button><button class="mini" data-act="ideaDel" data-id="${x.id}" title="Weg damit" aria-label="Löschen"><i class="ph-duotone ph-trash"></i></button></span></div>`).join('') || `<div class="empty"><span class="em">🅿️</span>Nichts geparkt. Sehr gut.</div>`}</div>
    </section>
  </div>`;
}

/* ---------- Uni-Bereich (früher Lernklar) ---------- */
const UNI = window.MK_UNI({
  render: () => render(),
  go: tab => { ui.tab = tab; ui.tabChanged = true; closeSheet(); document.body.scrollTo(0, 0); render(); },
  busy: () => !!F,
  exportItems: () => exportAll(),
  name: () => S.set.name,
  toast, confetti, beep
});

if (!S.set.onboarded && !params.has('widget')) { onbEl.hidden = false; renderOnb(); }

/* ---------- Start ---------- */
$('.brand-mascot').innerHTML = sunni('ok', false);
applyTheme();
if (params.has('widget')) document.body.classList.add('widget-mode');
render();
const fq = params.get('focus'); if (fq === 'm' || fq === 'e') openFocus(fq);
if (DESK) DESK.onCommand(cmd => {
  if (cmd === 'focus:m' || cmd === 'focus:e') { if (F) closeFocus(); openFocus(cmd.slice(-1)); }
  else if (cmd === 'tab:aufgaben') { closeSheet(); ui.tab = 'aufgaben'; ui.tabChanged = true; render(); }
});
else if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__S = () => S;
window.__mk = { exportAll, candidates, ics: () => window.LK_ICS.build(exportAll(), 'Mönch-Modus'), uni: UNI };
})();
