// Prüft die öffentliche Seite im echten Browser. Voraussetzung: node dev-server.mjs läuft.
import { launch, BASE } from './pw.mjs';
import { readFileSync } from 'node:fs';
import cfg from '../config.js';
import { createChecker } from './util.mjs';

const t = createChecker();
const BASE_HOST = new URL(BASE).hostname; // lokal 127.0.0.1, live z. B. redbullenso.github.io
const browser = await launch();
const errors = [];

async function open(url, { viewport = { width: 1280, height: 800 }, listings, image, config } = {}) {
  const ctx = await browser.newContext({ viewport });
  // Fremde Adressen (Discord, Kleinanzeigen) nie wirklich aufrufen; Zwischenablage mitschneiden statt schreiben
  await ctx.route((u) => u.hostname !== BASE_HOST, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'extern' }));
  await ctx.addInitScript(() => {
    window.__copied = [];
    if (navigator.clipboard) navigator.clipboard.writeText = async (text) => { window.__copied.push(text); };
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  if (listings) {
    await page.route('**/data/listings.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ listings }) }));
  }
  if (config) await page.route('**/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: config }));
  if (image) await page.route('**/img/**', (r) => r.fulfill({ contentType: 'image/jpeg', body: image }));
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  return { ctx, page };
}

// Screenshot der Seite als Testfoto (3000 x 2000), dient auch als Fotoersatz
async function bigJpeg() {
  const { ctx, page } = await open('/', { viewport: { width: 3000, height: 2000 } });
  const buf = await page.screenshot({ type: 'jpeg', quality: 85 });
  await ctx.close();
  return buf;
}

// 1. Grundansicht, Zähler, Filter, Sortierung
{
  const { ctx, page } = await open('/');
  t.ok(await page.locator('#grid .card').count() === 3, 'Raster zeigt 3 nicht verkaufte PCs');
  t.ok(await page.locator('#soldGrid .card').count() === 1, 'Verkauft-Bereich zeigt 1 PC');
  t.ok((await page.textContent('#heroCount')).startsWith('2 PCs'), 'Hero zählt 2 verfügbare PCs', await page.textContent('#heroCount'));
  await page.click('#chips button:has-text("Office-PC")');
  t.ok(await page.locator('#grid .card').count() === 1, 'Filter Office-PC -> 1 Karte');
  await page.click('#chips button:has-text("Alle")');
  await page.selectOption('#sort', 'asc');
  t.ok((await page.locator('#grid .card .price').first().textContent()).startsWith('249'), 'Preis aufsteigend: 249 € zuerst', await page.locator('#grid .card .price').first().textContent());
  await page.selectOption('#sort', 'desc');
  t.ok((await page.locator('#grid .card .price').first().textContent()).startsWith('849'), 'Preis absteigend: 849 € zuerst');
  await ctx.close();
}

// 2. Detailansicht, Kontaktwege (Discord kopiert die Nachricht), Schließen, Zurück-Taste, Direktlink
{
  const { ctx, page } = await open('/');
  await page.selectOption('#sort', 'asc');
  await page.locator('#grid .card').first().click();
  await page.waitForSelector('dialog#detail[open]');
  t.ok(page.url().endsWith('#pc=beispiel-office-i5'), 'Adresse bekommt #pc=<id>', page.url());
  t.ok((await page.textContent('dialog .info h2')).includes('Büro-PC'), 'Detailtitel stimmt');
  t.ok(await page.getAttribute('dialog .btn--discord', 'href') === cfg.discord, 'Discord-Button zeigt auf den Einladungslink aus config.js');
  t.ok(await page.getAttribute('dialog .btn--discord', 'target') === '_blank' && (await page.getAttribute('dialog .btn--discord', 'rel')).includes('noopener'), 'Discord-Link öffnet in neuem Tab mit noopener');
  t.ok(await page.locator('dialog .cta__note').isHidden(), 'Hinweis erscheint erst nach dem Klick');
  await page.click('dialog .btn--discord');
  const copied = await page.evaluate(() => window.__copied);
  t.ok(copied.length === 1 && copied[0].includes('Büro-PC Core i5-10400') && copied[0].includes('249 €') && copied[0].includes('#pc=beispiel-office-i5'), 'Klick kopiert Nachricht mit Titel, Preis und Link', copied);
  const note = await page.textContent('dialog .cta__note');
  t.ok(note.includes('Nachricht kopiert') && note.includes('„anfragen“'), 'Hinweis nennt den Kanal "anfragen"', note);
  t.ok(await page.getAttribute('dialog .btn--ghost[href^="https"]', 'href') === cfg.kleinanzeigen, 'Ohne eigene Anzeige: Kleinanzeigen-Profil verlinkt');
  t.ok(await page.locator('dialog .btn--wa').count() === 0, 'Ohne WhatsApp-Nummer in config.js kein WhatsApp-Button');
  t.ok(await page.locator('dialog .specs div').count() === 5, 'Datenblatt zeigt 5 Zeilen');
  t.ok(await page.locator('dialog .flaws').count() === 1, 'Mängelkasten vorhanden');
  await page.click('dialog .detail__x');
  await page.waitForSelector('dialog#detail:not([open])', { state: 'attached' });
  t.ok(!page.url().includes('#pc='), 'Schließen entfernt #pc= aus der Adresse (Zurück-Taste)', page.url());
  await page.locator('#grid .card').first().click();
  await page.waitForSelector('dialog#detail[open]');
  await page.keyboard.press('Escape');
  await page.waitForSelector('dialog#detail:not([open])', { state: 'attached' });
  t.ok(true, 'Escape schließt die Ansicht');
  const links = await page.locator('#contactLinks a').evaluateAll((as) => as.map((a) => a.textContent.trim()));
  t.ok(links.length === 2 && links[0].includes('Discord') && links[1].includes('Kleinanzeigen'), 'Kontaktbereich zeigt Discord und Kleinanzeigen', links);
  t.ok((await page.textContent('#contactHow')).includes('„anfragen“'), 'Kontaktbereich erklärt den Ablauf auf Discord');
  await ctx.close();

  const direct = await open('/#pc=beispiel-streaming-12700k');
  t.ok(await direct.page.locator('dialog#detail[open]').count() === 1, 'Direktlink öffnet die Detailansicht');
  t.ok((await direct.page.textContent('dialog .btn--discord')).includes('nachfragen'), 'Reservierter PC: Button "Auf Discord nachfragen"');
  await direct.page.click('dialog .detail__x');
  t.ok(!direct.page.url().includes('#pc='), 'Direktlink: Schließen säubert die Adresse', direct.page.url());
  await direct.ctx.close();

  const sold = await open('/#pc=beispiel-ryzen3600-1660s');
  t.ok(await sold.page.locator('dialog [aria-disabled="true"]').count() === 1, 'Verkaufter PC: Button deaktiviert');
  t.ok((await sold.page.textContent('dialog .btn--discord')).includes('Ähnlichen PC'), 'Verkaufter PC bietet "Ähnlichen PC anfragen"');
  await sold.ctx.close();

  // Eigene Kleinanzeigen-Anzeige wird verlinkt; unsichere oder fremde Links nie
  const ad = (id, adUrl) => ({
    id, title: `Anzeige ${id}`, category: 'Gaming-PC', status: 'available', price: 1, negotiable: false, condition: 'Gut',
    specs: {}, checks: [], flaws: 'Keine.', description: '', handover: { pickup: true, shipping: false }, photos: [], added: '2026-10-19', adUrl,
  });
  const good = await open('/#pc=a1', { listings: [ad('a1', 'https://www.kleinanzeigen.de/s-anzeige/test/123')] });
  t.ok((await good.page.textContent('dialog .btn--ghost[href^="https"]')).includes('Anzeige auf Kleinanzeigen'), 'Gültiger adUrl: Button "Anzeige auf Kleinanzeigen"');
  t.ok(await good.page.getAttribute('dialog .btn--ghost[href^="https"]', 'href') === 'https://www.kleinanzeigen.de/s-anzeige/test/123', 'Button zeigt auf die Anzeige');
  await good.ctx.close();
  for (const bad of ['javascript:window.__pwned=1', 'https://kleinanzeigen.de.evil.example/x', 'http://www.kleinanzeigen.de/x', 'https://evil.example/']) {
    const r = await open('/#pc=a2', { listings: [ad('a2', bad)] });
    t.ok(await r.page.getAttribute('dialog .btn--ghost[href^="https"]', 'href') === cfg.kleinanzeigen, `Unzulässiger adUrl wird ignoriert (${bad})`);
    t.ok(await r.page.locator('a[href^="javascript:"]').count() === 0, `Kein javascript:-Link (${bad})`);
    await r.ctx.close();
  }

  // WhatsApp bleibt optional: erscheint nur, wenn config.js eine Nummer enthält
  const waCfg = readFileSync(new URL('../config.js', import.meta.url), 'utf8').replace("whatsapp: ''", "whatsapp: '491234567'");
  const wa = await open('/#pc=beispiel-office-i5', { config: waCfg });
  const href = await wa.page.getAttribute('dialog .btn--wa', 'href');
  t.ok(href?.startsWith('https://wa.me/491234567?text=') && decodeURIComponent(href).includes('Büro-PC Core i5-10400'), 'Mit Nummer in config.js erscheint der WhatsApp-Button mit Text', href);
  await wa.ctx.close();
}

// 3. Fotos: Galerie mit Vor/Zurück und Tastatur
{
  const jpg = await bigJpeg();
  const listing = {
    id: 'foto-test', title: 'Foto-Test-PC', category: 'Gaming-PC', status: 'available', price: 500, negotiable: false,
    condition: 'Gut', specs: { cpu: 'X' }, checks: [], flaws: 'Keine.', description: '', handover: { pickup: true, shipping: true },
    photos: ['foto-test/a.jpg', 'foto-test/b.jpg', 'foto-test/c.jpg'], added: '2026-10-19',
  };
  const { ctx, page } = await open('/', { listings: [listing], image: jpg });
  await page.locator('#grid .card').first().click();
  await page.waitForSelector('dialog#detail[open]');
  t.ok(await page.locator('.gallery__thumbs button').count() === 3, 'Galerie zeigt 3 Vorschaubilder');
  t.ok((await page.getAttribute('.gallery__main', 'alt')).includes('Foto 1 von 3'), 'Startet bei Foto 1');
  await page.click('.gallery__nav--next');
  t.ok((await page.getAttribute('.gallery__main', 'alt')).includes('Foto 2 von 3'), 'Weiter-Pfeil -> Foto 2');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  t.ok((await page.getAttribute('.gallery__main', 'alt')).includes('Foto 1 von 3'), 'Pfeiltasten laufen im Kreis');
  const box = await page.locator('.gallery__main').boundingBox();
  t.ok(Math.abs(box.width / box.height - 4 / 3) < 0.02, 'Galeriebild hat 4:3 (keine überhohe Darstellung)', box);
  await ctx.close();
}

// 4. Sicherheit: Text aus den Daten wird nie als HTML ausgeführt
{
  const evil = {
    id: 'evil', title: '<img src=x onerror="window.__pwned=1"> PC', category: '<b>Kat</b>', status: 'available', price: 1, negotiable: false,
    condition: 'Gut', specs: { cpu: '<script>window.__pwned=1</script>' }, checks: ['<i>x</i>'], flaws: '<u>y</u>', description: '<svg onload="window.__pwned=1">',
    handover: { pickup: true, shipping: false }, photos: [], added: '2026-10-19',
  };
  const { ctx, page } = await open('/', { listings: [evil] });
  await page.locator('#grid .card').first().click();
  await page.waitForSelector('dialog#detail[open]');
  t.ok(await page.evaluate(() => window.__pwned === undefined), 'Eingeschleustes HTML/JS wird nicht ausgeführt');
  t.ok((await page.textContent('dialog .info h2')).includes('<img src=x'), 'Der Text erscheint wörtlich statt als HTML');
  await ctx.close();
}

// 5. Leere Liste und Ladefehler
{
  const { ctx, page } = await open('/', { listings: [] });
  t.ok(await page.locator('#grid .empty a[href="#kontakt"]').count() === 1, 'Leere Liste zeigt Hinweis mit Kontakt-Button');
  t.ok(await page.locator('#verkauft').isHidden(), 'Verkauft-Bereich bleibt ohne Einträge versteckt');
  await ctx.close();
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.route('**/data/listings.json', (r) => r.fulfill({ status: 500, body: 'x' }));
  await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
  t.ok((await p2.textContent('#grid')).includes('nicht geladen'), 'Ladefehler zeigt verständliche Meldung');
  await ctx2.close();
}

// 6. Handy-Breiten: kein seitliches Scrollen
for (const width of [320, 390, 768]) {
  const { ctx, page } = await open('/', { viewport: { width, height: 800 } });
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  t.ok(over <= 0, `Keine horizontale Scrollleiste bei ${width} px`, over);
  await page.locator('#grid .card').first().click();
  await page.waitForSelector('dialog#detail[open]');
  const over2 = await page.evaluate(() => { const d = document.querySelector('dialog'); return d.scrollWidth - d.clientWidth; });
  t.ok(over2 <= 0, `Detailansicht ohne Überbreite bei ${width} px`, over2);
  await ctx.close();
}

// 7. Rechtsseiten laden
for (const path of ['/impressum.html', '/datenschutz.html', '/admin/']) {
  const { ctx, page } = await open(path);
  t.ok((await page.title()).length > 0, `${path} lädt`);
  await ctx.close();
}

t.ok(errors.length === 0, 'Keine Konsolenfehler', errors);
await browser.close();
t.done();
