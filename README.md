# LEOS RIGS – PC-Verkaufsseite

Statische Seite ohne Build-Schritt (HTML + CSS + JavaScript). Die Angebote stehen in `data/listings.json`, die Fotos in `img/`. Neue Angebote stellst du über die Admin-Seite `/admin/` ein, auch vom Handy.

## Vorschau am Rechner

```
node dev-server.mjs        # http://127.0.0.1:5176/  (nur dieser Rechner, Admin: /admin/)
node tests/site.mjs        # 57 Prüfungen der öffentlichen Seite
node tests/admin.mjs       # 58 Prüfungen des Admin-Bereichs (simulierte GitHub-API)
```

## Angebote einstellen (Admin)

1. `https://<deine-seite>/admin/` öffnen (Lesezeichen auf dem Handy-Homescreen).
2. Beim ersten Mal ein GitHub-Token einfügen (Anleitung steht auf der Seite). Es bleibt nur in diesem Browser.
3. **+ Neues Angebot**: Titel, Preis, Fotos, Daten, Mängel eintragen, **Speichern & veröffentlichen**.
4. Nach ca. 1–2 Minuten ist es auf der Seite. Verkauft/reserviert stellst du direkt in der Liste um.

Fotos werden im Browser auf 1600 px (Detail) und 640 px (Karten) verkleinert, ein Handyfoto wird so ca. 200–400 KB groß. Jede Änderung ist ein einzelner Commit im Repository, also nachvollziehbar und rückgängig zu machen.

Alternativ kannst du mir Fotos und Daten schicken, ich trage sie in `data/listings.json` ein.

## Einstellungen

Alles in `config.js`: Name, Ort, Kontaktwege (Discord-Einladungslink, Kleinanzeigen-Profil, optional E-Mail oder WhatsApp), Kategorien, Prüfpunkte, Ablauf-Schritte und FAQ. Deine private Handynummer steht nirgends.

Kontakt: „Auf Discord anfragen“ kopiert die Nachricht (PC, Preis, Link) und öffnet den Server; Käufer fügen sie im Kanal „anfragen“ ein. Beim Angebot kannst du optional den Link zur Kleinanzeigen-Anzeige eintragen, dann verlinkt die Seite dorthin.

## Vor dem Livegang

- [ ] Discord-Server anlegen (Kanal „anfragen“, nur dort schreiben erlaubt) und Einladungslink in `config.js` (`discord`, aktuell Platzhalter)
- [ ] Kleinanzeigen-Profil-Link in `config.js` (`kleinanzeigen`)
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
