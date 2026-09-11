// Der RSS-Feed der Patchnotes (patchnotes.xml), 11.09.2026, Auftrag Sascha: "kannst du den rss feed
// anbinden an die patchnotes?"
//
// WAS HIER VERTEIDIGT WIRD
// ------------------------
// Der Feed ist ein zweites Erzeugnis von build-patchnotes.js - dieselbe Quelle wie patchnotes.html
// (der PATCHNOTES-Block im Spiel plus Archiv), dieselben Anker. Drei Dinge koennen dabei still
// kaputtgehen, und jedes sieht fuer einen Feedreader wie "keine Neuigkeiten" aus:
//   1. Der Feed ist VERALTET - jemand hat eine Version vergeben, aber den Generator nicht laufen
//      lassen (Abschnitt 3 baut ihn deshalb an einer Kopie neu und vergleicht Byte fuer Byte).
//   2. Der Feed ist KEIN gueltiges XML - ein nacktes "&" im Titel, ein "]]>" im Text, und der
//      Reader verwirft alles (Abschnitt 1 prueft die Maskierung ausserhalb von CDATA).
//   3. Niemand FINDET ihn - ohne <link rel="alternate"> auf den Seiten muss man die Adresse kennen
//      (Abschnitt 2).
//
// Kein Browser, kein Server: reine Quelltext- und Dateipruefung (Sekunden). Pfade ueber
// lib/spieldatei, damit eine Gegenprobe an einer Kopie wirklich die Kopie liest.
//
// GEGENPROBE (beide Richtungen gefahren, 11.09.2026):
//   gruen: node tests/test_patchnotes_feed.js
//   rot:   Feed von Hand veraendert (ein Zeichen in patchnotes.xml) -> 3b faellt;
//          patchnotes.xml entfernt -> 1a und alles danach faellt.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { SPIELDATEI, WURZEL } = require('./lib/spieldatei');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const FEED = path.join(WURZEL, 'patchnotes.xml');
const SEITE = path.join(WURZEL, 'patchnotes.html');
const THEMENSEITEN = ['weltraum-browsergame.html', 'idle-spiel-browser.html', 'allianzen-pvp.html', 'spielanleitung.html'];
const OFFEN = 20;   // wie PATCHNOTES_IM_SPIEL im Generator: die Versionen, die noch im Spiel stehen

// ---------------------------------------------------------------- 1. Der Feed selbst
check('1a: patchnotes.xml existiert', fs.existsSync(FEED));
const xml = fs.existsSync(FEED) ? fs.readFileSync(FEED, 'utf8') : '';
check('1b: XML-Kopf, RSS 2.0, Kanaltitel, Link auf die Seite und Selbstverweis (atom:link rel="self")',
  /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<rss version="2\.0"/.test(xml) &&
  /<channel>\s*<title>Kolonie Kepler-7[^<]*<\/title>/.test(xml) &&
  /<link>https:\/\/www\.gamegeeeeek\.de\/patchnotes\.html<\/link>/.test(xml) &&
  /<atom:link href="https:\/\/www\.gamegeeeeek\.de\/patchnotes\.xml" rel="self" type="application\/rss\+xml"\/>/.test(xml));

// Maskierung: Ausserhalb von CDATA darf kein nacktes "&" oder "<" in Textinhalten stehen. Gemessen
// wird der Text OHNE die CDATA-Abschnitte und OHNE die Tags selbst.
const ohneCdata = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
const textNurInhalt = ohneCdata.replace(/<[^>]+>/g, '');
const nackteAmpersands = (textNurInhalt.match(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g) || []).length;
check('1c: ausserhalb von CDATA ist jedes "&" maskiert und kein "<" im Text', nackteAmpersands === 0 && !/</.test(textNurInhalt), { nackteAmpersands });
check('1d: kein CDATA-Abschnitt enthaelt ein vorzeitiges "]]>"',
  (xml.match(/<!\[CDATA\[/g) || []).length === (xml.match(/\]\]>/g) || []).length);

const items = xml.split('<item>').slice(1).map(t => t.split('</item>')[0]);
check('1e: genau ' + OFFEN + ' Eintraege - die Versionen, die auch im Spiel stehen', items.length === OFFEN, items.length);

// Die Versionen im Spiel, in Reihenfolge - aus dem PATCHNOTES-Block, nicht aus der Seite.
const spiel = fs.readFileSync(SPIELDATEI, 'utf8');
const VERSION = (spiel.match(/const VERSION = '([\d.]+)'/) || [])[1];
const blockVon = spiel.indexOf('const PATCHNOTES = [');
const blockBis = spiel.indexOf('\n  ];', blockVon);
const block = spiel.slice(blockVon, blockBis);
const versionenImSpiel = [...block.matchAll(/\n[ \t]*\{ version:'([\d.]+)'/g)].map(m => m[1]);
const versionenImFeed = items.map(t => (t.match(/<guid isPermaLink="false">kolonie-kepler7-v([\d.]+)<\/guid>/) || [])[1] || null);
check('1f: die Eintraege sind genau die Versionen aus dem Spiel, in derselben Reihenfolge (neueste zuerst)',
  JSON.stringify(versionenImFeed) === JSON.stringify(versionenImSpiel.slice(0, OFFEN)), { feed: versionenImFeed.slice(0, 3), spiel: versionenImSpiel.slice(0, 3) });
check('1g: der neueste Eintrag ist die VERSION des Spiels', versionenImFeed[0] === VERSION, { feed: versionenImFeed[0], VERSION });

const seite = fs.existsSync(SEITE) ? fs.readFileSync(SEITE, 'utf8') : '';
const ankerFehlen = items.map(t => (t.match(/<link>https:\/\/www\.gamegeeeeek\.de\/patchnotes\.html#(v[\d-]+)<\/link>/) || [])[1])
  .filter(a => !a || !seite.includes('id="' + a + '"'));
check('1h: jeder Eintrag verlinkt einen Anker, den patchnotes.html wirklich hat', ankerFehlen.length === 0, ankerFehlen.slice(0, 3));

const datenKaputt = items.filter(t => {
  const p = (t.match(/<pubDate>([^<]+)<\/pubDate>/) || [])[1];
  return !p || Number.isNaN(Date.parse(p));
});
check('1i: jeder Eintrag hat ein lesbares pubDate (RFC 822)', datenKaputt.length === 0, datenKaputt.length);
// Das Datum des Eintrags (dd.mm.yyyy) ist der Tag des pubDate - keine Verschiebung ueber Mitternacht.
const eintraegeImSpiel = [...block.matchAll(/\{ version:'([\d.]+)', date:'(\d{2})\.(\d{2})\.(\d{4})'/g)].map(m => ({ v: m[1], tag: m[4] + '-' + m[3] + '-' + m[2] }));
const tagFalsch = items.map((t, i) => {
  const p = new Date((t.match(/<pubDate>([^<]+)<\/pubDate>/) || [])[1]);
  const e = eintraegeImSpiel[i];
  return e && p.toISOString().slice(0, 10) !== e.tag ? { v: e.v, erwartet: e.tag, feed: p.toISOString().slice(0, 10) } : null;
}).filter(Boolean);
check('1j: der Tag des pubDate ist der Tag des Eintrags', tagFalsch.length === 0, tagFalsch.slice(0, 2));

const titelKaputt = items.filter((t, i) => {
  const titel = (t.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
  return !titel.startsWith('v' + versionenImFeed[i]) || /<|&[a-z]+;/.test(titel.replace(/&(amp|lt|gt|quot|apos);/g, ''));
});
check('1k: jeder Titel beginnt mit der Version und ist reiner Text (keine Tags, keine HTML-Entities)', titelKaputt.length === 0, titelKaputt.length);
check('1l: die Beschreibung traegt die Aenderungen als HTML in CDATA', items.every(t => /<description><!\[CDATA\[<ul><li>[\s\S]+<\/li><\/ul>\]\]><\/description>/.test(t)));

// ---------------------------------------------------------------- 2. Auffindbar
const LINK = /<link rel="alternate" type="application\/rss\+xml"[^>]*href="https:\/\/www\.gamegeeeeek\.de\/patchnotes\.xml"/;
check('2a: patchnotes.html verweist im Kopf auf den Feed (rel="alternate")', LINK.test(seite));
check('2b: patchnotes.html verlinkt den Feed auch sichtbar', /href="patchnotes\.xml"/.test(seite));
for (const datei of THEMENSEITEN) {
  const html = fs.readFileSync(path.join(WURZEL, datei), 'utf8');
  check('2c ' + datei + ': verweist im Kopf auf den Feed', LINK.test(html));
}

// ---------------------------------------------------------------- 3. Nicht veraltet: an einer Kopie neu gebaut
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kepler-feed-'));
  for (const f of ['weltraum_kolonie.html', 'patchnotes-archiv.json']) fs.copyFileSync(path.join(WURZEL, f), path.join(dir, f));
  const lauf = spawnSync(process.execPath, [path.join(WURZEL, 'build-patchnotes.js')], { env: Object.assign({}, process.env, { KEPLER_WURZEL: dir }), encoding: 'utf8' });
  check('3a: der Generator laeuft an der Kopie durch und schreibt den Feed', lauf.status === 0 && fs.existsSync(path.join(dir, 'patchnotes.xml')), (lauf.stdout || '').split('\n').slice(-3));
  const neu = fs.existsSync(path.join(dir, 'patchnotes.xml')) ? fs.readFileSync(path.join(dir, 'patchnotes.xml'), 'utf8') : null;
  check('3b: der eingecheckte Feed ist Byte fuer Byte der, den der Generator aus dem heutigen Stand baut', neu !== null && neu === xml,
    neu === null ? 'kein Feed gebaut' : { eingecheckt: xml.length, gebaut: neu.length });
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\n' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
