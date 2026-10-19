// Prüft die Admin-Seite im echten Browser gegen eine simulierte GitHub-API (nichts davon trifft dein echtes Repository).
// Voraussetzung: node dev-server.mjs läuft.
import { readFileSync } from 'node:fs';
import { launch, BASE } from './pw.mjs';
import { createChecker, jpegSize } from './util.mjs';
import { createMock, TOKEN } from './mock-github.mjs';

const t = createChecker();
const today = new Date().toLocaleDateString('sv-SE');

const browser = await launch();
const errors = [];

// Testfotos: Screenshots der Seite in Quer- und Hochformat, größer als das, was die Admin-Seite behalten soll
async function photo(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const buf = await page.screenshot({ type: 'jpeg', quality: 90 });
  await ctx.close();
  return buf;
}
const landscape = await photo(3000, 2000);
const portrait = await photo(1200, 2400);

const mock = createMock({ 'data/listings.json': readFileSync(new URL('../data/listings.json', import.meta.url)) });
const ctx = await browser.newContext({ viewport: { width: 400, height: 900 } });
const page = await ctx.newPage();
const external = new Set();
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (e) => errors.push(e.message));
page.on('request', (r) => { const u = new URL(r.url()); if (!['127.0.0.1', 'api.github.com'].includes(u.hostname) && u.protocol.startsWith('http')) external.add(u.hostname); });
const notFound = [];
page.on('response', (r) => { if (r.status() === 404 && r.url().startsWith(BASE)) notFound.push(r.url()); });
page.on('dialog', (d) => d.accept());
await page.route('https://api.github.com/**', mock.handle);

const clearToasts = () => page.evaluate(() => document.querySelector('#toasts').replaceChildren());
const toast = async (kind) => (await page.waitForSelector(`.toast--${kind}`, { timeout: 15000 })).textContent();
const rowOf = (text) => page.locator('li.row', { hasText: text });

// 1. Anmeldung
await page.goto(`${BASE}/admin/`, { waitUntil: 'networkidle' });
t.ok(await page.locator('form.panel input[name=token]').isVisible(), 'Ohne Token erscheint die Anmeldung');
await page.fill('input[name=token]', 'falsch');
await page.click('button[type=submit]');
await page.waitForSelector('.error');
t.ok((await page.textContent('.error')).includes('ungültig'), 'Falsches Token: verständliche Fehlermeldung', await page.textContent('.error'));
t.ok(await page.evaluate(() => localStorage.getItem('leosrigs.token')) === null, 'Falsches Token wird nicht gespeichert');
await page.fill('input[name=token]', TOKEN);
await page.click('button[type=submit]');
await page.waitForSelector('ul.rows');
t.ok(await page.locator('li.row').count() === 4, 'Nach Anmeldung: 4 Einträge in der Liste');
t.ok(await page.evaluate(() => localStorage.getItem('leosrigs.token')) === TOKEN, 'Gutes Token wird im Browser gemerkt');

// 2. Status schnell ändern
await clearToasts();
await rowOf('Büro-PC').locator('select').selectOption('reserved');
t.ok((await toast('ok')).includes('Gespeichert'), 'Statuswechsel meldet "Gespeichert"');
t.ok(mock.listings().find((l) => l.id === 'beispiel-office-i5').status === 'reserved', 'Status landet im Repository (reserved)');
t.ok(mock.lastMessage().startsWith('Status:'), 'Commit-Text beschreibt die Änderung', mock.lastMessage());
await clearToasts();
await rowOf('Streaming-PC').locator('select').selectOption('sold');
await toast('ok');
const sold = mock.listings().find((l) => l.id === 'beispiel-streaming-12700k');
t.ok(sold.status === 'sold' && sold.sold === today, 'Verkauft setzt Verkaufsdatum', sold);
await clearToasts();
await rowOf('Einsteiger-Gaming-PC').locator('select').selectOption('available');
await toast('ok');
t.ok(!('sold' in mock.listings().find((l) => l.id === 'beispiel-ryzen3600-1660s')), 'Zurück auf verfügbar entfernt das Verkaufsdatum');

// 3. Validierung: ohne Foto geht es nicht
await page.click('text=+ Neues Angebot');
await page.fill('input[name=title]', 'Test-PC Ünïcode i5');
await page.fill('input[name=price]', '333');
await page.fill('textarea[name=flaws]', 'Keine bekannten Mängel.');
const before = mock.commitCount();
await clearToasts();
await page.click('button:has-text("Speichern & veröffentlichen")');
t.ok((await toast('error')).includes('Foto'), 'Ohne Foto: Fehlermeldung statt Speichern');
t.ok(mock.commitCount() === before, 'Ohne Foto wird nichts committet');

// 4. Neues Angebot mit zwei großen Fotos, Prüfpunkten, Spezifikationen
await page.fill('input[name=spec_cpu]', 'Intel Core i5-12400F');
await page.fill('input[name=spec_gpu]', 'RTX 3060');
await page.check('input[name=check][value="Stresstest bestanden"]');
await page.fill('input[placeholder="Eigenen Punkt ergänzen"]', 'Neue Wärmeleitpaste');
await page.click('button:text-is("Hinzufügen")');
await page.setInputFiles('input[type=file]', [
  { name: 'quer.jpg', mimeType: 'image/jpeg', buffer: landscape },
  { name: 'hoch.jpg', mimeType: 'image/jpeg', buffer: portrait },
]);
t.ok(await page.locator('.photo').count() === 2, 'Zwei Fotos erscheinen als Vorschau');
t.ok(await page.locator('.photo__lead').count() === 1, 'Erstes Foto ist als Titelbild markiert');
await page.locator('.photo').nth(1).locator('button[aria-label="Nach vorn"]').click();
t.ok(await page.locator('.photo').first().locator('img').evaluate((i) => i.naturalHeight > i.naturalWidth), 'Foto lässt sich nach vorn schieben (Hochformat jetzt zuerst)');
await page.uncheck('input[name=pickup]');
await clearToasts();
await page.click('button:has-text("Speichern & veröffentlichen")');
t.ok((await toast('error')).includes('Abholung oder Versand'), 'Ohne Übergabeart: Fehlermeldung');
await page.check('input[name=pickup]');
await clearToasts();
await page.click('button:has-text("Speichern & veröffentlichen")');
t.ok((await toast('ok')).includes('Gespeichert'), 'Neues Angebot: "Gespeichert"');
const added = mock.listings()[0];
t.ok(added.id.startsWith('test-pc-uenicode-i5-'), 'ID aus Titel gebaut (Umlaute/Sonderzeichen bereinigt)', added.id);
t.ok(added.price === 333 && added.status === 'available' && added.added === today, 'Preis, Status, Datum korrekt', added);
t.ok(added.specs.cpu === 'Intel Core i5-12400F' && added.specs.gpu === 'RTX 3060' && !('ram' in added.specs), 'Nur ausgefüllte Spezifikationen gespeichert', added.specs);
t.ok(added.checks.join('|') === 'Stresstest bestanden|Neue Wärmeleitpaste', 'Prüfpunkte inkl. eigenem Punkt gespeichert', added.checks);
t.ok(added.handover.pickup === true && added.handover.shipping === false, 'Übergabe gespeichert');
t.ok(added.photos.length === 2, 'Zwei Fotos im Eintrag', added.photos);
let maxFull = 0;
for (const p of added.photos) {
  const full = mock.files().get(`img/${p}`);
  const thumb = mock.files().get(`img/${p.replace(/\.jpg$/, '-t.jpg')}`);
  const fs = full && jpegSize(full);
  const ts = thumb && jpegSize(thumb);
  t.ok(fs && ts, `Foto ${p} und Vorschaubild sind echte JPEGs`);
  if (fs && ts) {
    maxFull = Math.max(maxFull, fs.width, fs.height);
    t.ok(Math.max(fs.width, fs.height) <= 1600, `Foto auf <= 1600 px verkleinert (${fs.width}x${fs.height})`);
    t.ok(Math.max(ts.width, ts.height) <= 640, `Vorschaubild auf <= 640 px (${ts.width}x${ts.height})`);
    t.ok(full.length < 600_000, `Foto bleibt klein (${Math.round(full.length / 1024)} KB)`);
  }
}
const firstDims = jpegSize(mock.files().get(`img/${added.photos[0]}`));
t.ok(firstDims.height > firstDims.width, 'Reihenfolge übernommen: Hochformat ist Titelbild', firstDims);
t.ok(mock.lastMessage().startsWith('Neu: Test-PC'), 'Commit-Text "Neu: …"', mock.lastMessage());
t.ok(mock.requests.filter((r) => r === 'PATCH /git/refs/heads/main').length === mock.commitCount(), 'Pro Änderung genau ein Commit (atomar)');

// 5. Bearbeiten: Foto entfernen, Preis ändern
await page.waitForSelector('ul.rows');
await rowOf('Test-PC').locator('button:has-text("Bearbeiten")').click();
t.ok(await page.inputValue('input[name=title]') === 'Test-PC Ünïcode i5', 'Bearbeiten lädt die gespeicherten Werte');
t.ok(await page.locator('input[name=check][value="Neue Wärmeleitpaste"]').isChecked(), 'Eigener Prüfpunkt erscheint wieder und ist angehakt');
const removedPhoto = added.photos[0];
await page.locator('.photo').first().locator('button[aria-label="Foto entfernen"]').click();
await page.fill('input[name=price]', '300');
await page.check('input[name=negotiable]');
await clearToasts();
await page.click('button:has-text("Speichern & veröffentlichen")');
await toast('ok');
const edited = mock.listings().find((l) => l.id === added.id);
t.ok(edited.price === 300 && edited.negotiable === true, 'Preis und VB geändert');
t.ok(edited.photos.length === 1 && edited.photos[0] === added.photos[1], 'Entferntes Foto ist aus dem Eintrag raus');
t.ok(!mock.paths().includes(`img/${removedPhoto}`) && !mock.paths().includes(`img/${removedPhoto.replace(/\.jpg$/, '-t.jpg')}`), 'Entferntes Foto und Vorschaubild sind aus dem Repo gelöscht');
t.ok(edited.added === added.added && edited.id === added.id, 'ID und Einstelldatum bleiben beim Bearbeiten');
t.ok(mock.listings().length === 5, 'Bearbeiten legt keinen Duplikat-Eintrag an');

// 6. Konflikt: Speichern schlägt fehl -> verständliche Meldung, nichts verändert
mock.failNextPatch = true;
const statusBefore = mock.listings().find((l) => l.id === 'beispiel-office-i5').status;
await clearToasts();
await rowOf('Büro-PC').locator('select').selectOption('available');
t.ok((await toast('error')).includes('neu laden'), 'Konflikt beim Speichern: Hinweis zum Neuladen');
t.ok(mock.listings().find((l) => l.id === 'beispiel-office-i5').status === statusBefore, 'Bei Konflikt bleibt der Stand im Repository unverändert');
t.ok(await page.locator('ul.rows').count() === 1, 'Liste bleibt nach Fehler bedienbar');

// 7. Löschen
await clearToasts();
await rowOf('Test-PC').locator('button:has-text("Löschen")').click();
await toast('ok');
t.ok(!mock.listings().some((l) => l.id === added.id), 'Gelöschtes Angebot ist weg');
t.ok(!mock.paths().some((p) => p.startsWith(`img/${added.id}/`)), 'Alle Fotos des gelöschten Angebots sind mit entfernt', mock.paths());

// 8. Beispieleinträge auf einmal löschen
await clearToasts();
await page.click('.demo-note button');
await toast('ok');
t.ok(mock.listings().length === 0, 'Beispieleinträge gelöscht');
t.ok(await page.locator('text=Noch keine Angebote').count() === 1, 'Leere Liste zeigt Hinweis');

// 9. Abmelden und stilles Wiederanmelden
await page.click('button:has-text("Abmelden")');
t.ok(await page.locator('input[name=token]').isVisible(), 'Abmelden zeigt wieder die Anmeldung');
t.ok(await page.evaluate(() => localStorage.getItem('leosrigs.token')) === null, 'Abmelden löscht das Token im Browser');
await page.evaluate((tok) => localStorage.setItem('leosrigs.token', tok), TOKEN);
mock.pushAllowed = false;
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.error');
t.ok((await page.textContent('.error')).includes('nicht ins Repository schreiben'), 'Token ohne Schreibrecht wird erkannt');
t.ok(await page.evaluate(() => localStorage.getItem('leosrigs.token')) === null, 'Unbrauchbares Token wird wieder gelöscht');

// 10. Abschluss
t.ok(external.size === 0, 'Admin spricht nur mit der eigenen Seite und api.github.com', [...external]);
// Erwartet: absichtlich falsches Token (401), erzwungener Konflikt (422 + Log) und Vorschaubilder, die erst nach dem Veröffentlichen online sind (404 unter /img/)
const expected = /status of (401|404|422)|ApiError: Update is not a fast forward/;
t.ok(errors.filter((e) => !expected.test(e)).length === 0, 'Keine unerwarteten Konsolenfehler in der Admin-Seite', errors.filter((e) => !expected.test(e)));
t.ok(notFound.every((u) => u.includes('/img/')), 'Einzige 404-Antworten sind noch nicht veröffentlichte Fotos', notFound.filter((u) => !u.includes('/img/')));

await browser.close();
t.done();
