import cfg from '../config.js';
import {
  $, h, icon, pcArt, waLink, listingUrl, fmtPrice, fmtDate, specLine,
  photoUrl, thumbUrl, STATUS_LABEL, SPEC_FIELDS,
} from './lib.js';

const state = { all: [], cat: 'Alle', sort: 'new', failed: false };
const WA_HELLO = 'Hallo, ich habe eine Frage zu deinen PCs.';
const newest = (a, b) => (b.added || '').localeCompare(a.added || '');
const price = (l) => h('span', { class: 'price' }, fmtPrice(l.price), l.negotiable && h('small', {}, 'VB'));

const TRUST = [
  ['camera', 'Echte Fotos', 'Vom echten Gerät, nicht aus dem Katalog'],
  ['list', 'Vollständige Specs', 'Jedes Bauteil einzeln aufgeführt'],
  ['shield', 'Auf Mängel geprüft', 'Jeder PC wird vor dem Verkauf kontrolliert'],
  ['chat', 'Direkter Kontakt', 'Kein Zwischenhändler, ich antworte selbst'],
];

async function loadListings() {
  const res = await fetch('data/listings.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.listings) ? data.listings : [];
}

/* ---------- Bausteine ---------- */

function cover(l, thumb = true) {
  const p = l.photos?.[0];
  const img = h('img', {
    src: p ? (thumb ? thumbUrl(p) : photoUrl(p)) : pcArt(l.id),
    alt: `${l.title}`,
    loading: 'lazy',
    decoding: 'async',
    width: 640,
    height: 480,
  });
  if (p && thumb) img.addEventListener('error', () => { img.src = photoUrl(p); }, { once: true });
  return img;
}

function badge(l) {
  return [
    l.status !== 'available' && h('span', { class: `badge badge--${l.status}` }, STATUS_LABEL[l.status]),
    l.demo && h('span', { class: 'badge badge--demo' }, 'Beispiel'),
  ];
}

function card(l, i = 0) {
  return h('a', { class: 'card reveal', href: `#pc=${l.id}`, data: { status: l.status }, style: { '--i': i } },
    h('div', { class: 'card__media' }, cover(l), badge(l)),
    h('div', { class: 'card__body' },
      h('div', { class: 'card__cat' }, l.category),
      h('h3', { class: 'card__title' }, l.title),
      h('p', { class: 'card__spec' }, specLine(l)),
      h('div', { class: 'card__foot' }, price(l), h('span', { class: 'card__more' }, 'Details →'))));
}

const observer = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); observer.unobserve(e.target); }
  }, { threshold: 0.05 })
  : null;

function reveal(root) {
  for (const el of root.querySelectorAll('.reveal:not(.in)')) {
    if (observer) observer.observe(el); else el.classList.add('in');
  }
}

/* ---------- Seitenteile ---------- */

function renderStatic() {
  document.title = `${cfg.brand} – ${cfg.tagline}`;
  $('#brand').textContent = cfg.brand;
  $('#footBrand').textContent = `© ${new Date().getFullYear()} ${cfg.brand}`;

  for (const id of ['#waTop', '#waHero']) {
    const a = $(id);
    a.href = waLink(cfg, WA_HELLO);
    a.target = '_blank';
  }

  $('#trust').replaceChildren(...TRUST.map(([ic, t, s]) =>
    h('div', { class: 'trust__item' },
      h('div', { class: 'trust__icon' }, icon(ic, 22)),
      h('div', {}, h('b', {}, t), h('span', {}, s)))));

  $('#steps').replaceChildren(...cfg.steps.map((s, i) =>
    h('div', { class: 'step reveal', style: { '--i': i } }, h('h3', {}, s.title), h('p', {}, s.text))));

  $('#faqList').replaceChildren(...cfg.faq.map((f) =>
    h('details', { class: 'reveal' }, h('summary', {}, f.q), h('p', {}, f.a))));

  $('#contactLinks').replaceChildren(
    h('a', { class: 'btn btn--wa', href: waLink(cfg, WA_HELLO), target: '_blank', rel: 'noopener' }, icon('wa'), 'WhatsApp schreiben'),
    cfg.email && h('a', { class: 'btn btn--ghost', href: `mailto:${cfg.email}` }, 'E-Mail'),
    cfg.kleinanzeigen && h('a', { class: 'btn btn--ghost', href: cfg.kleinanzeigen, target: '_blank', rel: 'noopener' }, 'Kleinanzeigen-Profil'));
}

function renderHero() {
  const open = state.all.filter((l) => l.status === 'available');
  $('#heroDot').classList.toggle('dot--off', !open.length);
  $('#heroCount').textContent = state.failed ? 'Angebote konnten nicht geladen werden'
    : open.length ? `${open.length} ${open.length === 1 ? 'PC' : 'PCs'} aktuell verfügbar`
      : 'Gerade ist nichts frei, schau bald wieder rein';

  const pick = [...open].sort(newest)[0] || [...state.all].filter((l) => l.status === 'reserved').sort(newest)[0];
  $('#feature').replaceChildren(pick
    ? h('a', { class: 'feature', href: `#pc=${pick.id}` },
      h('img', { class: 'feature__img', src: pick.photos?.[0] ? photoUrl(pick.photos[0]) : pcArt(pick.id), alt: pick.title, width: 640, height: 480, fetchpriority: 'high' }),
      h('div', { class: 'feature__body' },
        h('span', { class: 'feature__tag' }, 'Neu im Angebot'),
        h('h2', { class: 'feature__title' }, pick.title),
        h('div', { class: 'feature__row' }, h('span', {}, specLine(pick).split(' · ').slice(0, 2).join(' · ')), price(pick))))
    : h('div', { class: 'feature' }, h('img', { class: 'feature__img', src: pcArt('leer'), alt: '', width: 640, height: 480 })));
}

function renderFilters() {
  const open = state.all.filter((l) => l.status !== 'sold');
  const cats = ['Alle', ...new Set(open.map((l) => l.category))];
  if (!cats.includes(state.cat)) state.cat = 'Alle';
  const box = $('#chips');
  box.hidden = cats.length < 3; // mit nur einer Kategorie bringt der Filter nichts
  box.replaceChildren(...cats.map((c) =>
    h('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(c === state.cat),
      onclick: () => { state.cat = c; renderFilters(); renderGrid(); },
    }, c)));
  $('#offersLead').textContent = cfg.region ? `Abholung: ${cfg.region}. Alle Preise in Euro.` : 'Alle Preise in Euro, Privatverkauf.';
}

function renderGrid() {
  if (state.failed) {
    $('#grid').replaceChildren(h('div', { class: 'empty' },
      h('p', {}, 'Die Angebote konnten gerade nicht geladen werden. Bitte lade die Seite neu oder schreib mir direkt.'),
      h('a', { class: 'btn btn--wa', href: waLink(cfg, WA_HELLO), target: '_blank', rel: 'noopener' }, icon('wa'), 'Per WhatsApp fragen')));
    return;
  }
  const rank = { available: 0, reserved: 1 };
  let items = state.all.filter((l) => l.status !== 'sold' && (state.cat === 'Alle' || l.category === state.cat));
  items.sort(state.sort === 'asc' ? (a, b) => a.price - b.price
    : state.sort === 'desc' ? (a, b) => b.price - a.price
      : (a, b) => rank[a.status] - rank[b.status] || newest(a, b));
  const grid = $('#grid');
  grid.replaceChildren(...(items.length ? items.map(card) : [
    h('div', { class: 'empty' },
      h('p', {}, 'Aktuell ist alles vergeben. Neue PCs kommen laufend dazu. Schreib mir, wenn du etwas Bestimmtes suchst.'),
      h('a', { class: 'btn btn--wa', href: waLink(cfg, WA_HELLO), target: '_blank', rel: 'noopener' }, icon('wa'), 'Per WhatsApp fragen')),
  ]));
  reveal(grid);
}

function renderSold() {
  const sold = state.all.filter((l) => l.status === 'sold').sort((a, b) => (b.sold || b.added || '').localeCompare(a.sold || a.added || '')).slice(0, 6);
  $('#verkauft').hidden = !sold.length;
  $('#soldGrid').replaceChildren(...sold.map(card));
  reveal($('#soldGrid'));
}

/* ---------- Detailansicht ---------- */

let galleryNav = null;

function buildGallery(l) {
  const photos = l.photos || [];
  const full = photos.length ? photos.map(photoUrl) : [pcArt(l.id)];
  let idx = 0;
  const main = h('img', { class: 'gallery__main', src: full[0], alt: `${l.title}, Foto 1 von ${full.length}`, width: 1600, height: 1200 });
  const buttons = photos.map((p, n) => {
    const img = h('img', { src: thumbUrl(p), alt: '', loading: 'lazy' });
    img.addEventListener('error', () => { img.src = photoUrl(p); }, { once: true });
    return h('button', { type: 'button', 'aria-label': `Foto ${n + 1} anzeigen`, onclick: () => show(n) }, img);
  });
  function show(n) {
    idx = (n + full.length) % full.length;
    main.src = full[idx];
    main.alt = `${l.title}, Foto ${idx + 1} von ${full.length}`;
    buttons.forEach((b, k) => { if (k === idx) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
  }
  galleryNav = full.length > 1 ? (d) => show(idx + d) : null;
  const el = h('div', { class: 'gallery' },
    main,
    full.length > 1 && h('button', { class: 'gallery__nav gallery__nav--prev', type: 'button', 'aria-label': 'Vorheriges Foto', onclick: () => show(idx - 1) }, icon('chevL')),
    full.length > 1 && h('button', { class: 'gallery__nav gallery__nav--next', type: 'button', 'aria-label': 'Nächstes Foto', onclick: () => show(idx + 1) }, icon('chevR')),
    buttons.length > 1 && h('div', { class: 'gallery__thumbs' }, buttons));
  if (buttons.length) show(0);
  return el;
}

async function share(l, btn) {
  const url = listingUrl(cfg, l.id);
  try {
    if (navigator.share) { await navigator.share({ title: `${l.title} – ${cfg.brand}`, url }); return; }
    await navigator.clipboard.writeText(url);
    btn.lastChild.textContent = 'Link kopiert';
  } catch (err) {
    if (err?.name !== 'AbortError') btn.lastChild.textContent = url;
  }
}

function buildDetail(l) {
  const specs = SPEC_FIELDS.filter(([k]) => l.specs?.[k]);
  const msg = [
    `Hallo, ich interessiere mich für „${l.title}“ (${fmtPrice(l.price)}${l.negotiable ? ' VB' : ''}).`,
    l.status === 'reserved' ? 'Er ist als reserviert markiert. Falls die Reservierung platzt, wäre ich gern der Nächste.' : 'Ist er noch verfügbar?',
    listingUrl(cfg, l.id),
  ].join('\n');
  const shareBtn = h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => share(l, shareBtn) }, icon('share'), h('span', {}, 'Link teilen'));

  return h('article', { class: 'detail' },
    h('button', { class: 'detail__x', type: 'button', 'aria-label': 'Schließen', onclick: requestClose }, icon('close', 22)),
    buildGallery(l),
    h('div', { class: 'info' },
      h('div', {},
        h('span', { class: 'info__cat' }, l.category),
        h('h2', {}, l.title),
        h('div', { class: 'info__price' },
          price(l),
          h('span', { class: `status status--${l.status}` }, STATUS_LABEL[l.status]),
          l.demo && h('span', { class: 'status' }, 'Beispielangebot'))),
      h('div', { class: 'cta' },
        l.status === 'sold'
          ? [
            h('span', { class: 'btn btn--ghost', 'aria-disabled': 'true' }, 'Bereits verkauft'),
            h('a', { class: 'btn btn--wa', href: waLink(cfg, `Hallo, „${l.title}“ ist schon weg. Hast du etwas Ähnliches?`), target: '_blank', rel: 'noopener' }, icon('wa'), 'Ähnlichen PC anfragen'),
          ]
          : h('a', { class: 'btn btn--wa', href: waLink(cfg, msg), target: '_blank', rel: 'noopener' }, icon('wa'), l.status === 'reserved' ? 'Nachfragen (reserviert)' : 'Per WhatsApp anfragen'),
        shareBtn,
        l.status !== 'sold' && h('p', { class: 'cta__note' }, 'Du schreibst direkt mit mir, ohne Registrierung.')),
      specs.length > 0 && h('div', {}, h('h3', {}, 'Technische Daten'),
        h('dl', { class: 'specs' }, specs.map(([k, label]) => h('div', {}, h('dt', {}, label), h('dd', {}, l.specs[k]))))),
      l.checks?.length > 0 && h('div', {}, h('h3', {}, 'Geprüft'),
        h('ul', { class: 'checks' }, l.checks.map((c) => h('li', {}, icon('check'), c)))),
      l.flaws && h('div', {}, h('h3', {}, 'Mängel & Hinweise'), h('div', { class: 'flaws' }, l.flaws)),
      l.description && h('div', {}, h('h3', {}, 'Beschreibung'), h('p', { class: 'prose' }, l.description)),
      h('div', { class: 'meta' },
        l.condition && h('span', {}, `Zustand: ${l.condition}`),
        l.handover?.pickup && h('span', {}, icon('pin', 16), cfg.region ? `Abholung ${cfg.region}` : 'Abholung'),
        l.handover?.shipping && h('span', {}, icon('box', 16), 'Versand möglich'),
        l.added && h('span', {}, `Eingestellt am ${fmtDate(l.added)}`))));
}

function openDetail(l) {
  const dlg = $('#detail');
  dlg.replaceChildren(buildDetail(l));
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
  document.documentElement.classList.add('modal-open');
  document.title = `${l.title} – ${cfg.brand}`;
}

function closeDetail() {
  const dlg = $('#detail');
  if (dlg.open) dlg.close();
  document.documentElement.classList.remove('modal-open');
  document.title = `${cfg.brand} – ${cfg.tagline}`;
}

// Zurück-Taste schließt die Ansicht, wenn wir sie selbst geöffnet haben; bei Direktlink nur die Adresse säubern
function requestClose() {
  if (history.state?.pc) { history.back(); return; }
  history.replaceState(null, '', location.pathname + location.search);
  route();
}

function route() {
  const m = /^#pc=([\w-]+)$/.exec(location.hash);
  const l = m && state.all.find((x) => x.id === m[1]);
  if (l) openDetail(l); else closeDetail();
}

function wireEvents() {
  const dlg = $('#detail');
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); requestClose(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) requestClose(); });
  dlg.addEventListener('keydown', (e) => {
    if (!galleryNav) return;
    if (e.key === 'ArrowLeft') galleryNav(-1);
    if (e.key === 'ArrowRight') galleryNav(1);
  });
  window.addEventListener('popstate', route);
  window.addEventListener('hashchange', route);

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#pc="]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    history.pushState({ pc: 1 }, '', a.getAttribute('href'));
    route();
  });

  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(); });
}

/* ---------- Start ---------- */

renderStatic();
wireEvents();
reveal(document);

try {
  state.all = await loadListings();
} catch (err) {
  console.error(err);
  state.failed = true;
}

renderHero();
renderFilters();
renderGrid();
renderSold();
route();
