// Kleine gemeinsame Helfer für Seite und Admin. Kein Framework, kein innerHTML mit Nutzertext.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// h('div', { class: 'x', onclick: fn, data: { a: 1 } }, 'Text', child, [children])
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'data') for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) el.style.setProperty(sk, sv);
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const STATUS_LABEL = { available: 'Verfügbar', reserved: 'Reserviert', sold: 'Verkauft' };

// Reihenfolge = Reihenfolge in Datenblatt und Admin-Formular
export const SPEC_FIELDS = [
  ['cpu', 'Prozessor', 'z. B. Intel Core i5-12400F'],
  ['gpu', 'Grafikkarte', 'z. B. NVIDIA RTX 3060 Ti 8 GB'],
  ['ram', 'Arbeitsspeicher', 'z. B. 16 GB DDR4-3200'],
  ['storage', 'Speicher', 'z. B. 1 TB NVMe SSD'],
  ['mainboard', 'Mainboard', 'z. B. MSI B660M'],
  ['psu', 'Netzteil', 'z. B. 650 W 80+ Bronze'],
  ['case', 'Gehäuse / Kühlung', 'z. B. Mesh-Gehäuse, Tower-Kühler'],
  ['os', 'Betriebssystem', 'z. B. Windows 11 Pro (aktiviert)'],
];

export const fmtPrice = (n) => `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(n)} €`;

export const fmtDate = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

export const specLine = (l) => ['cpu', 'gpu', 'ram', 'storage'].map((k) => l.specs?.[k]).filter(Boolean).join(' · ');

// Fotos liegen unter img/<pfad>.jpg, die kleine Version unter img/<pfad>-t.jpg
export const photoUrl = (p) => `img/${p}`;
export const thumbUrl = (p) => `img/${p.replace(/\.jpg$/i, '-t.jpg')}`;

export function waLink(cfg, text) {
  return `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(text)}`;
}

export function listingUrl(cfg, id) {
  const base = cfg.siteUrl || `${location.origin}${location.pathname.replace(/index\.html$/, '')}`;
  return `${base.replace(/\/?$/, '/')}#pc=${id}`;
}

// Platzhalterbild, wenn ein Angebot (noch) kein Foto hat. Nur Zahlen, nie Nutzertext.
export function pcArt(seed) {
  let n = 0;
  for (const ch of String(seed)) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = 175 + (n % 100);
  const a = `hsl(${hue} 90% 62%)`;
  const b = `hsl(${hue + 55} 90% 64%)`;
  const fans = [120, 190, 260]
    .map((cy) => {
      const blades = [0, 60, 120, 180, 240, 300]
        .map((r) => `<ellipse cy="-13" rx="5.5" ry="11" transform="rotate(${r})" fill="${a}" opacity=".55"/>`)
        .join('');
      return `<g transform="translate(300 ${cy})"><circle r="28" fill="#0b0f15" stroke="${a}" stroke-opacity=".7" stroke-width="2"/>${blades}<circle r="5" fill="${a}"/></g>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480">
<defs>
<radialGradient id="g" cx="50%" cy="62%" r="60%"><stop offset="0" stop-color="${a}" stop-opacity=".28"/><stop offset="1" stop-color="${a}" stop-opacity="0"/></radialGradient>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<linearGradient id="p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#151c27"/><stop offset="1" stop-color="#0c1017"/></linearGradient>
</defs>
<rect width="640" height="480" fill="#0d1118"/><rect width="640" height="480" fill="url(#g)"/>
<ellipse cx="320" cy="424" rx="170" ry="16" fill="#000" opacity=".5"/>
<rect x="228" y="62" width="184" height="354" rx="18" fill="#10151d" stroke="#273142" stroke-width="2"/>
<rect x="240" y="76" width="160" height="326" rx="10" fill="url(#p)" stroke="#1d2635"/>
${fans}
<rect x="256" y="334" width="128" height="26" rx="4" fill="#1a2230" stroke="#2b3649"/>
<rect x="262" y="344" width="64" height="4" rx="2" fill="${a}" opacity=".85"/>
<rect x="384" y="86" width="5" height="306" rx="2.5" fill="url(#s)"/>
<rect x="246" y="414" width="22" height="8" rx="3" fill="#1b2330"/><rect x="372" y="414" width="22" height="8" rx="3" fill="#1b2330"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const ICONS = {
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  list: '<path d="M9 12l2 2 4-4"/><path d="M5 4h14v16H5z"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chevL: '<path d="M15 5l-7 7 7 7"/>',
  chevR: '<path d="M9 5l7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  share: '<path d="M12 4v11M8 8l4-4 4 4M5 13v7h14v-7"/>',
  pin: '<path d="M12 21s-6-5.6-6-10a6 6 0 0112 0c0 4.4-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
  box: '<path d="M4 8l8-4 8 4v9l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v9"/>',
  wa: '<path d="M4 20l1.3-4.2A8 8 0 1112 20a8 8 0 01-3.7-.9z"/><path d="M9 8.8c0 3 2.2 5.2 5.2 5.2l1-1.3-1.9-1-.8.7a3.6 3.6 0 01-1.9-1.9l.7-.8-1-1.9z"/>',
};

export function icon(name, size = 20) {
  const wrap = document.createElement('span');
  wrap.className = 'ico';
  wrap.setAttribute('aria-hidden', 'true');
  const svg = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`,
    'image/svg+xml',
  ).documentElement;
  wrap.append(document.importNode(svg, true));
  return wrap;
}
