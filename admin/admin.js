import cfg from '../config.js';
import { $, h, pcArt, fmtPrice, photoUrl, thumbUrl, safeUrl, STATUS_LABEL, SPEC_FIELDS } from '../js/lib.js';
import { Repo, ApiError } from './github.js';

const TOKEN_KEY = 'leosrigs.token';
const MAX_PHOTOS = 12;
const app = $('#app');
const IMG = (path) => `../${path}`;

const S = { listings: [], draft: null };
let repo = null;

const store = {
  get() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set(v) { try { localStorage.setItem(TOKEN_KEY, v); } catch { /* nur für diese Sitzung merken */ } },
  del() { try { localStorage.removeItem(TOKEN_KEY); } catch { /* egal */ } },
};

const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in Ortszeit
const mount = (...nodes) => app.replaceChildren(...nodes.flat().filter(Boolean));

function toast(content, kind = 'ok') {
  const el = h('div', { class: `toast toast--${kind}` }, content);
  $('#toasts').append(el);
  setTimeout(() => el.remove(), kind === 'error' ? 12000 : 7000);
}

function setBusy(text) {
  $('#busy').hidden = !text;
  $('#busyText').textContent = text || '';
}

window.addEventListener('beforeunload', (e) => { if (!$('#busy').hidden) e.preventDefault(); });

function friendly(err) {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Das Token ist ungültig oder abgelaufen. Bitte neu anmelden.';
    if (err.status === 403 || err.status === 404) return 'Kein Zugriff: Das Token braucht für dieses Repository die Berechtigung „Contents: Read and write“.';
    if (err.status === 409 || err.status === 422) return 'Zwischenzeitlich wurde etwas anderes gespeichert. Bitte Seite neu laden und noch einmal versuchen.';
    return `GitHub meldet einen Fehler (${err.status}): ${err.message}`;
  }
  if (err instanceof TypeError) return 'Keine Verbindung zu GitHub. Bist du online?';
  return err.message || String(err);
}

/* ---------- Speichern ---------- */

// Liest die aktuelle Liste frisch von GitHub, wendet die Änderung an und speichert alles als einen Commit
async function mutate(message, change, { files = [], deletions = [] } = {}) {
  setBusy('Speichere …');
  try {
    const data = await repo.readListings();
    change(data);
    data.updated = today();
    await repo.commit(message, [{ path: 'data/listings.json', content: `${JSON.stringify(data, null, 2)}\n` }, ...files], deletions);
    S.listings = data.listings;
    return true;
  } catch (err) {
    console.error(err);
    toast(friendly(err), 'error');
    return false;
  } finally {
    setBusy(null);
  }
}

const onlineHint = () => toast(h('span', {}, 'Gespeichert. Auf der Seite sichtbar in ca. 1–2 Minuten.', h('a', { href: '../', target: '_blank', rel: 'noopener' }, 'Seite öffnen')));

async function scaleToJpeg(bitmap, max, quality) {
  const k = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bitmap.width * k));
  c.height = Math.max(1, Math.round(bitmap.height * k));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality).split(',')[1];
}

// Handyfotos sind 3–8 MB: für die Seite reichen 1600 px (Detailansicht) und 640 px (Karten)
async function processImage(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`Das Foto „${file.name}“ konnte nicht gelesen werden. Bitte als JPG oder PNG versuchen.`);
  }
  try {
    return { full: await scaleToJpeg(bitmap, 1600, 0.82), thumb: await scaleToJpeg(bitmap, 640, 0.8) };
  } finally {
    bitmap.close();
  }
}

const slug = (s) => s.toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'pc';

const photoFiles = (l) => (l.photos || []).flatMap((p) => [photoUrl(p), thumbUrl(p)]);

async function saveListing(listing, draft) {
  const isNew = !draft.id;
  const id = draft.id || `${slug(listing.title)}-${Date.now().toString(36).slice(-4)}`;
  const stamp = Date.now().toString(36);
  const files = [];
  const photos = [];

  try {
    setBusy('Fotos werden verkleinert …');
    for (const [n, p] of draft.photos.entries()) {
      if (p.path) { photos.push(p.path); continue; }
      const path = `${id}/${stamp}-${n + 1}.jpg`;
      const { full, thumb } = await processImage(p.file);
      files.push({ path: photoUrl(path), content: full, encoding: 'base64' }, { path: thumbUrl(path), content: thumb, encoding: 'base64' });
      photos.push(path);
    }
  } catch (err) {
    setBusy(null);
    toast(friendly(err), 'error');
    return;
  }

  const kept = new Set(photos);
  const deletions = draft.originalPhotos.filter((p) => !kept.has(p)).flatMap((p) => [photoUrl(p), thumbUrl(p)]);
  const entry = { ...listing, id, photos, added: draft.added || today() };
  if (draft.demo) entry.demo = true;
  if (entry.status === 'sold') entry.sold = draft.sold || today();

  const ok = await mutate(`${isNew ? 'Neu' : 'Update'}: ${entry.title}`, (data) => {
    const i = data.listings.findIndex((x) => x.id === id);
    if (i >= 0) data.listings[i] = entry; else data.listings.unshift(entry);
  }, { files, deletions });
  if (ok) { discardPreviews(draft); onlineHint(); viewList(); }
}

async function setStatus(l, status) {
  const ok = await mutate(`Status: ${l.title} → ${STATUS_LABEL[status]}`, (data) => {
    const t = data.listings.find((x) => x.id === l.id);
    if (!t) throw new Error('Das Angebot gibt es nicht mehr. Bitte Seite neu laden.');
    t.status = status;
    if (status === 'sold') t.sold = t.sold || today(); else delete t.sold;
  });
  if (ok) onlineHint();
  viewList();
}

async function removeListing(l) {
  if (!confirm(`„${l.title}“ endgültig löschen? Die Fotos werden mit entfernt.`)) return;
  const ok = await mutate(`Entfernt: ${l.title}`, (data) => {
    data.listings = data.listings.filter((x) => x.id !== l.id);
  }, { deletions: photoFiles(l) });
  if (ok) onlineHint();
  viewList();
}

async function removeDemos() {
  const demos = S.listings.filter((l) => l.demo);
  if (!confirm(`${demos.length} Beispieleinträge löschen?`)) return;
  const ids = new Set(demos.map((l) => l.id));
  const ok = await mutate('Beispieleinträge entfernt', (data) => {
    data.listings = data.listings.filter((x) => !ids.has(x.id));
  }, { deletions: demos.flatMap(photoFiles) });
  if (ok) onlineHint();
  viewList();
}

/* ---------- Anmeldung ---------- */

async function connect(token, { silent = false } = {}) {
  repo = new Repo(cfg.repo, token);
  setBusy('Verbinde …');
  try {
    const info = await repo.info();
    if (!info.permissions?.push) throw new Error('Dieses Token darf nicht ins Repository schreiben. Bitte „Contents: Read and write“ vergeben.');
    S.listings = (await repo.readListings()).listings;
    store.set(token);
    viewList();
  } catch (err) {
    repo = null;
    if (silent) store.del();
    viewLogin(friendly(err));
  } finally {
    setBusy(null);
  }
}

function viewLogin(error) {
  const input = h('input', { type: 'password', name: 'token', placeholder: 'github_pat_…', autocomplete: 'off', spellcheck: 'false', required: true });
  const { owner, name } = cfg.repo;
  mount(h('div', { class: 'shell login' },
    h('form', { class: 'panel', onsubmit: (e) => { e.preventDefault(); connect(input.value.trim()); } },
      h('h2', {}, 'Verwaltung'),
      h('p', { class: 'muted' }, 'Einmalig ein Zugangs-Token von GitHub einrichten. Es bleibt nur in diesem Browser gespeichert.'),
      h('ol', {},
        h('li', {}, h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, 'Token-Seite öffnen'), ' (bei GitHub angemeldet)'),
        h('li', {}, 'Name z. B. „Verwaltung“, Ablauf nach Wunsch. Bei „Repository access“: ', h('b', {}, 'Only select repositories'), ' → ', h('code', {}, `${owner}/${name}`)),
        h('li', {}, 'Unter „Repository permissions“: ', h('b', {}, 'Contents'), ' → ', h('b', {}, 'Read and write'), '. „Generate token“ klicken.'),
        h('li', {}, 'Token kopieren und hier einfügen.')),
      error && h('p', { class: 'error', role: 'alert' }, error),
      h('label', { class: 'field' }, h('span', {}, 'Token'), input),
      h('button', { class: 'btn btn--primary', type: 'submit' }, 'Verbinden'))));
  input.focus();
}

/* ---------- Liste ---------- */

function topbar() {
  return h('div', { class: 'topbar' },
    h('b', {}, `${cfg.brand} · Verwaltung`),
    h('a', { href: '../', target: '_blank', rel: 'noopener' }, 'Seite ansehen'),
    h('button', { class: 'linkbtn', type: 'button', onclick: () => { store.del(); repo = null; viewLogin(); } }, 'Abmelden'));
}

function thumbImg(l, cls) {
  const p = l.photos?.[0];
  const img = h('img', { class: cls, src: p ? IMG(thumbUrl(p)) : pcArt(l.id), alt: '', loading: 'lazy' });
  // frisch hochgeladene Fotos sind erst nach dem Veröffentlichen erreichbar
  img.addEventListener('error', () => { img.src = pcArt(l.id); }, { once: true });
  return img;
}

function viewList() {
  S.draft = null;
  const items = [...S.listings].sort((a, b) => (b.added || '').localeCompare(a.added || ''));
  const demos = items.filter((l) => l.demo);
  mount(h('div', { class: 'shell' },
    topbar(),
    h('div', { class: 'bar' },
      h('h1', {}, 'Deine Angebote'),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: () => viewEditor(null) }, '+ Neues Angebot')),
    items.length
      ? h('ul', { class: 'rows' }, items.map((l) => {
        const select = h('select', {
          'aria-label': `Status von ${l.title}`,
          onchange: (e) => setStatus(l, e.target.value),
        }, Object.entries(STATUS_LABEL).map(([v, t]) => h('option', { value: v, selected: v === l.status }, t)));
        return h('li', { class: 'row' },
          thumbImg(l, 'row__img'),
          h('div', { class: 'row__main' },
            h('b', {}, l.title, l.demo && h('span', { class: 'tag' }, 'Beispiel')),
            h('span', { class: 'muted' }, `${fmtPrice(l.price)}${l.negotiable ? ' VB' : ''} · ${l.category}`)),
          h('div', { class: 'row__act' },
            select,
            h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => viewEditor(l) }, 'Bearbeiten'),
            h('button', { class: 'btn btn--danger btn--sm', type: 'button', onclick: () => removeListing(l) }, 'Löschen')));
      }))
      : h('p', { class: 'panel muted' }, 'Noch keine Angebote. Mit „Neues Angebot“ geht es los.'),
    demos.length > 0 && h('div', { class: 'demo-note' },
      h('span', {}, `${demos.length} Beispieleinträge sind noch drin.`),
      h('button', { class: 'btn btn--danger btn--sm', type: 'button', onclick: removeDemos }, 'Beispiele löschen'))));
}

/* ---------- Formular ---------- */

function newDraft() {
  return {
    id: null, title: '', category: cfg.categories[0], status: 'available', price: '', negotiable: false,
    condition: cfg.conditions[1] || cfg.conditions[0], specs: {}, checks: [], flaws: '', description: '', adUrl: '',
    handover: { pickup: true, shipping: false }, photos: [], originalPhotos: [],
  };
}

function discardPreviews(draft) {
  for (const p of draft.photos) if (p.url) URL.revokeObjectURL(p.url);
}

const field = (label, control, { required = false, hint } = {}) =>
  h('label', { class: 'field' }, h('span', {}, label, required && h('em', {}, ' *')), control, hint && h('span', { class: 'hint' }, hint));

const select = (name, options, value) =>
  h('select', { name }, options.map((o) => h('option', { value: o, selected: o === value }, o)));

function viewEditor(listing) {
  const d = listing
    ? { ...newDraft(), ...structuredClone(listing), originalPhotos: [...(listing.photos || [])], photos: (listing.photos || []).map((path) => ({ path })) }
    : newDraft();
  S.draft = d;

  const photosBox = h('div', { class: 'photos' });
  const fileInput = h('input', {
    type: 'file', accept: 'image/*', multiple: true, class: 'sr', 'aria-label': 'Fotos auswählen',
    onchange: () => {
      for (const file of fileInput.files) {
        if (d.photos.length >= MAX_PHOTOS) { toast(`Höchstens ${MAX_PHOTOS} Fotos pro Angebot.`, 'error'); break; }
        d.photos.push({ file, url: URL.createObjectURL(file) });
      }
      fileInput.value = '';
      renderPhotos();
    },
  });

  function move(i, by) {
    const j = i + by;
    [d.photos[i], d.photos[j]] = [d.photos[j], d.photos[i]];
    renderPhotos();
  }
  function renderPhotos() {
    photosBox.replaceChildren(...d.photos.map((p, i) => {
      const img = h('img', { src: p.url || IMG(thumbUrl(p.path)), alt: `Foto ${i + 1}` });
      img.addEventListener('error', () => { img.src = pcArt(d.id || 'neu'); }, { once: true });
      return h('div', { class: 'photo' },
        img,
        i === 0 && h('span', { class: 'photo__lead' }, 'Titelbild'),
        h('div', { class: 'photo__bar' },
          h('button', { type: 'button', 'aria-label': 'Nach vorn', disabled: i === 0, onclick: () => move(i, -1) }, '←'),
          h('button', { type: 'button', 'aria-label': 'Foto entfernen', onclick: () => { if (p.url) URL.revokeObjectURL(p.url); d.photos.splice(i, 1); renderPhotos(); } }, '✕'),
          h('button', { type: 'button', 'aria-label': 'Nach hinten', disabled: i === d.photos.length - 1, onclick: () => move(i, 1) }, '→')));
    }));
  }

  const checkOptions = [...new Set([...cfg.checks, ...d.checks])];
  const checksBox = h('div', {});
  const addCheck = (text, checked) => checksBox.append(
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'check', value: text, checked }), text));
  checkOptions.forEach((c) => addCheck(c, d.checks.includes(c)));
  const customCheck = h('input', { type: 'text', placeholder: 'Eigenen Punkt ergänzen', maxlength: 60 });
  const addCustom = () => {
    const t = customCheck.value.trim();
    if (!t || [...checksBox.querySelectorAll('input')].some((i) => i.value === t)) return;
    addCheck(t, true);
    customCheck.value = '';
  };
  customCheck.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } });

  const form = h('form', { class: 'form', novalidate: false },
    h('div', { class: 'panel' },
      h('h2', {}, listing ? 'Angebot bearbeiten' : 'Neues Angebot'),
      field('Titel', h('input', { type: 'text', name: 'title', required: true, maxlength: 90, value: d.title, placeholder: 'z. B. Gaming-PC Ryzen 5 5600 + RTX 3060 Ti' }), { required: true }),
      h('div', { class: 'grid2' },
        field('Kategorie', select('category', cfg.categories, d.category)),
        field('Zustand', select('condition', cfg.conditions, d.condition))),
      h('div', { class: 'grid2' },
        field('Preis in €', h('input', { type: 'number', name: 'price', required: true, min: 0, step: 1, inputmode: 'numeric', value: d.price }), { required: true }),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'negotiable', checked: d.negotiable }), 'Verhandlungsbasis (VB)')),
      field('Status', h('select', { name: 'status' }, Object.entries(STATUS_LABEL).map(([v, t]) => h('option', { value: v, selected: v === d.status }, t))))),

    h('div', { class: 'panel' },
      h('h2', {}, 'Fotos'),
      h('p', { class: 'hint' }, 'Echte Fotos vom Gerät: außen, innen, Anschlüsse, laufend. Das erste Foto ist das Titelbild. Sie werden automatisch verkleinert.'),
      photosBox,
      h('div', {}, fileInput, h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => fileInput.click() }, '+ Fotos hinzufügen'))),

    h('div', { class: 'panel' },
      h('h2', {}, 'Technische Daten'),
      h('div', { class: 'grid2' }, SPEC_FIELDS.map(([k, label, ph]) =>
        field(label, h('input', { type: 'text', name: `spec_${k}`, maxlength: 90, value: d.specs[k] || '', placeholder: ph }))))),

    h('div', { class: 'panel' },
      h('h2', {}, 'Geprüft'),
      h('p', { class: 'hint' }, 'Nur anhaken, was du wirklich gemacht hast. Das sehen Käufer als Liste.'),
      checksBox,
      h('div', { class: 'adder' }, customCheck, h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: addCustom }, 'Hinzufügen'))),

    h('div', { class: 'panel' },
      h('h2', {}, 'Texte'),
      field('Mängel & Hinweise', h('textarea', { name: 'flaws', required: true, maxlength: 600, placeholder: 'Kratzer, Macken, Besonderheiten. Gibt es nichts: „Keine bekannten Mängel.“' }, d.flaws), { required: true, hint: 'Ehrlichkeit schafft Vertrauen. Pflichtfeld.' }),
      field('Beschreibung', h('textarea', { name: 'description', maxlength: 2000, placeholder: 'Wofür taugt der PC, wie lange genutzt, was wurde aufgerüstet …' }, d.description)),
      field('Link zur Kleinanzeigen-Anzeige (optional)', h('input', { type: 'text', name: 'adUrl', inputmode: 'url', maxlength: 300, value: d.adUrl || '', placeholder: 'https://www.kleinanzeigen.de/s-anzeige/…' }), { hint: 'Steht der PC auch bei Kleinanzeigen, verlinkt die Seite dorthin. Käufer sehen dort auch dein Profil.' })),

    h('div', { class: 'panel' },
      h('h2', {}, 'Übergabe'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'pickup', checked: d.handover.pickup }), 'Abholung'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'shipping', checked: d.handover.shipping }), 'Versand möglich')),

    h('div', { class: 'actions' },
      h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { discardPreviews(d); viewList(); } }, 'Abbrechen'),
      h('button', { class: 'btn btn--primary', type: 'submit' }, 'Speichern & veröffentlichen')));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!d.photos.length) { toast('Bitte mindestens ein Foto hinzufügen. Ohne echte Fotos wirkt das Angebot nicht vertrauenswürdig.', 'error'); return; }
    const fd = new FormData(form);
    if (!fd.has('pickup') && !fd.has('shipping')) { toast('Bitte Abholung oder Versand auswählen.', 'error'); return; }
    const specs = {};
    for (const [k] of SPEC_FIELDS) {
      const v = String(fd.get(`spec_${k}`) || '').trim();
      if (v) specs[k] = v;
    }
    const adRaw = String(fd.get('adUrl') || '').trim();
    const adUrl = adRaw && safeUrl(adRaw, 'kleinanzeigen.de');
    if (adRaw && !adUrl) { toast('Der Kleinanzeigen-Link muss mit https:// beginnen und auf kleinanzeigen.de zeigen.', 'error'); return; }
    saveListing({
      title: String(fd.get('title')).trim(),
      category: fd.get('category'),
      status: fd.get('status'),
      price: Math.round(Number(fd.get('price'))),
      negotiable: fd.has('negotiable'),
      condition: fd.get('condition'),
      specs,
      checks: fd.getAll('check'),
      flaws: String(fd.get('flaws')).trim(),
      description: String(fd.get('description') || '').trim(),
      handover: { pickup: fd.has('pickup'), shipping: fd.has('shipping') },
      ...(adUrl && { adUrl }),
    }, d);
  });

  renderPhotos();
  mount(h('div', { class: 'shell' }, topbar(), form));
  window.scrollTo(0, 0);
}

/* ---------- Start ---------- */

const saved = store.get();
if (saved) connect(saved, { silent: true }); else viewLogin();
