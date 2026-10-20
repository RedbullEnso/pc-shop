// Alles, was du an der Seite ändern willst, steht hier. Kein Programmieren nötig.
// Stellen mit "PRÜFEN" enthalten Zusagen an Käufer: nur stehen lassen, wenn sie für dich stimmen.

export default {
  brand: 'LEOS RIGS',
  tagline: 'Gebrauchte PCs. Ehrlich beschrieben.',

  // Ort, z. B. 'Raum Mainz'. Leer lassen = wird nirgends angezeigt.
  region: 'Raum Wiesbaden',

  // Kontaktwege. Leer lassen = wird nicht angezeigt. Deine private Handynummer steht nirgends.
  // PLATZHALTER, vor dem Livegang durch die echten Links ersetzen!
  discord: 'https://discord.gg/EC435FswWH', // Einladungslink zu deinem Verkaufs-Server (läuft nie ab)
  discordChannel: 'anfragen', // Kanal, in den Käufer schreiben sollen
  kleinanzeigen: 'https://www.kleinanzeigen.de/', // Link zu deinem Kleinanzeigen-Profil
  email: '',
  // Optional, nur mit eigener Nummer (nur Ziffern, mit Vorwahl, ohne +), z. B. '491701234567'
  whatsapp: '',

  // Wohin die Admin-Seite speichert (dein GitHub-Repository)
  repo: { owner: 'RedbullEnso', name: 'pc-shop', branch: 'main' },

  // Öffentliche Adresse der Seite (für Links in WhatsApp-Nachrichten). Leer = automatisch.
  siteUrl: '',

  categories: ['Gaming-PC', 'Office-PC', 'Laptop', 'Komponenten', 'Sonstiges'],
  conditions: ['Neuwertig', 'Sehr gut', 'Gut', 'Gebraucht'],

  // Häkchen, die du beim Einstellen setzen kannst. Nur anhaken, was du wirklich gemacht hast.
  checks: [
    'Stresstest bestanden',
    'Temperaturen geprüft',
    'Windows frisch installiert',
    'Alle Anschlüsse getestet',
    'Spiele-Test gelaufen',
    'Innen gereinigt',
  ],

  // PRÜFEN: Ablauf, wie du ihn tatsächlich anbietest
  steps: [
    {
      title: 'Anfragen',
      text: 'Tritt dem Discord-Server bei und drück im Kanal „anfragen“ auf „Anfrage starten“. Du bekommst einen privaten Kanal, den nur du und ich sehen. Ein Klick auf „Anfragen“ kopiert die Nachricht schon.',
    },
    {
      title: 'Ansehen & testen',
      text: 'Bei der Abholung kannst du den PC in Ruhe ansehen und starten. Alle Mängel, die ich kenne, stehen vorher in der Anzeige.',
    },
    {
      title: 'Bezahlen & mitnehmen',
      text: 'Zahlung und Übergabe klären wir direkt per Nachricht, bevor du losfährst.',
    },
  ],

  // PRÜFEN: Antworten müssen zu deinem Vorgehen passen
  faq: [
    {
      q: 'Gibt es Garantie?',
      a: 'Das ist ein Privatverkauf: Garantie, Gewährleistung und Rücknahme sind ausgeschlossen, soweit das gesetzlich zulässig ist. Dafür beschreibe ich jeden PC so genau wie möglich, inklusive aller Mängel, die ich kenne.',
    },
    {
      q: 'Kann ich den PC vorher testen?',
      a: 'Ja. Bei der Abholung kannst du ihn ansehen und starten.',
    },
    {
      q: 'Ist der Preis verhandelbar?',
      a: 'Steht beim Preis „VB“, kannst du mir ein Angebot machen. Ohne „VB“ ist der Preis fest.',
    },
    {
      q: 'Wird auch versendet?',
      a: 'Nur wenn beim Angebot „Versand möglich“ steht. Die Kosten besprechen wir vorher.',
    },
    {
      q: 'Wie bezahle ich?',
      a: 'Das klären wir direkt per Nachricht, bevor du losfährst.',
    },
  ],
};
