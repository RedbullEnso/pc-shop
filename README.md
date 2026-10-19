# LEOS RIGS – PC-Verkaufsseite

Statische Seite ohne Build-Schritt (HTML + CSS + JavaScript). Die Angebote stehen in `data/listings.json`, die Fotos in `img/`. Neue Angebote stellst du über die Admin-Seite `/admin/` ein, auch vom Handy.

## Vorschau am Rechner

```
node dev-server.mjs        # http://127.0.0.1:5176/  (nur dieser Rechner, Admin: /admin/)
node tests/site.mjs        # 38 Prüfungen der öffentlichen Seite
node tests/admin.mjs       # 55 Prüfungen des Admin-Bereichs (simulierte GitHub-API)
```

## Angebote einstellen (Admin)

1. `https://<deine-seite>/admin/` öffnen (Lesezeichen auf dem Handy-Homescreen).
2. Beim ersten Mal ein GitHub-Token einfügen (Anleitung steht auf der Seite). Es bleibt nur in diesem Browser.
3. **+ Neues Angebot**: Titel, Preis, Fotos, Daten, Mängel eintragen, **Speichern & veröffentlichen**.
4. Nach ca. 1–2 Minuten ist es auf der Seite. Verkauft/reserviert stellst du direkt in der Liste um.

Fotos werden im Browser auf 1600 px (Detail) und 640 px (Karten) verkleinert, ein Handyfoto wird so ca. 200–400 KB groß. Jede Änderung ist ein einzelner Commit im Repository, also nachvollziehbar und rückgängig zu machen.

Alternativ kannst du mir Fotos und Daten schicken, ich trage sie in `data/listings.json` ein.

## Einstellungen

Alles in `config.js`: Name, WhatsApp-Nummer, Ort, optionale E-Mail/Kleinanzeigen-Link, Kategorien, Prüfpunkte, Ablauf-Schritte und FAQ.

## Vor dem Livegang

- [ ] WhatsApp-Nummer in `config.js` (aktuell Platzhalter `490000000000`)
- [ ] Ort (`region`) in `config.js`, falls gewünscht
- [ ] Impressum und Datenschutz ausfüllen (`impressum.html`, `datenschutz.html`, Hinweisbox löschen)
- [ ] Texte mit Zusagen prüfen (`steps` und `faq` in `config.js`, Vertrauensleiste in `js/app.js`)
- [ ] Beispieleinträge in der Admin-Seite löschen (Button „Beispiele löschen“)
- [ ] Repository + GitHub Pages einrichten, Token erzeugen

## Aufbau

```
index.html, js/app.js     öffentliche Seite (Raster, Filter, Detailansicht mit Galerie)
admin/                    Verwaltung: Formular, Foto-Verkleinerung, Speichern per GitHub-API
data/listings.json        alle Angebote
img/<id>/                 Fotos (<n>.jpg und <n>-t.jpg als Vorschau)
config.js                 Einstellungen und Texte
css/, fonts/              Stil und lokal eingebundene Schriften (keine Fremdserver)
tests/                    Browser-Tests
```

Sicherheit: Alle Texte aus den Daten werden als Text eingefügt, nie als HTML. Die Seiten haben eine Content-Security-Policy; die Admin-Seite darf nur mit `api.github.com` sprechen. Das Token braucht nur „Contents: Read and write“ für dieses eine Repository.
