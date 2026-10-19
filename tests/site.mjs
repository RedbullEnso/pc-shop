// Prüft die öffentliche Seite im echten Browser. Voraussetzung: node dev-server.mjs läuft.
import { launch, BASE } from './pw.mjs';
import { createChecker } from './util.mjs';

const t = createChecker();
const browser = await launch();
const errors = [];

async function open(url, { viewport = { width: 1280, height: 800 }, listings, image } = {}) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  if (listings) {
    await page.route('**/data/listings.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ listings }) }));
  }
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

// 2. Detailansicht, WhatsApp-Link, Schließen, Zurück-Taste, Direktlink
{
  const { ctx, page } = await open('/');
  await page.selectOption('#sort', 'asc');
  await page.locator('#grid .card').first().click();
  await page.waitForSelector('dialog#detail[open]');
  t.ok(page.url().endsWith('#pc=beispiel-office-i5'), 'Adresse bekommt #pc=<id>', page.url());
  t.ok((await page.textContent('dialog .info h2')).includes('Büro-PC'), 'Detailtitel stimmt');
  const wa = await page.getAttribute('dialog .btn--wa', 'href');
  const text = decodeURIComponent(wa.split('?text=')[1] || '');
  t.ok(wa.startsWith('https://wa.me/490000000000?text='), 'WhatsApp-Link zeigt auf die Nummer aus config.js', wa);
  t.ok(text.includes('Büro-PC Core i5-10400') && text.includes('249 €') && text.includes('#pc=beispiel-office-i5'), 'WhatsApp-Text enthält Titel, Preis und Link', text);
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
  await ctx.close();

  const direct = await open('/#pc=beispiel-streaming-12700k');
  t.ok(await direct.page.locator('dialog#detail[open]').count() === 1, 'Direktlink öffnet die Detailansicht');
  t.ok((await direct.page.textContent('dialog .btn--wa')).includes('reserviert'), 'Reservierter PC: Button "Nachfragen (reserviert)"');
  await direct.page.click('dialog .detail__x');
  t.ok(!direct.page.url().includes('#pc='), 'Direktlink: Schließen säubert die Adresse', direct.page.url());
  await direct.ctx.close();

  const sold = await open('/#pc=beispiel-ryzen3600-1660s');
  t.ok(await sold.page.locator('dialog [aria-disabled="true"]').count() === 1, 'Verkaufter PC: Button deaktiviert');
  await sold.ctx.close();
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
  t.ok(await page.locator('#grid .empty').count() === 1, 'Leere Liste zeigt Hinweis mit WhatsApp-Button');
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
