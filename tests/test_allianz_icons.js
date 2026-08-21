// Jede Allianz-Struktur hat ein eigenes, gezeichnetes Icon (05.08.2026).
//
// SPIELER-REPORT Sascha, mit Bild: „hier sind keine richtigen icons bei forschung allianz".
// Nachgezählt: Alle 37 Allianz-Einträge (16 Technologien, 7 Gebäude, 7 Großprojekte, 7
// Weltprojekte) trugen ein generisches ti-*-Symbol - als einzige große Inhaltsfamilie des Spiels
// ohne eigene Zeichnung, während Forschung, Gebäude, Schiffe und Module längst welche haben.
//
// Schlimmer noch: elf davon teilten sich ihr Symbol mit einem Nachbarn.
//   ti-users              -> ALLE FÜNF Expansions-Stufen
//   ti-shield-lock        -> Verteidigungspakt + Bollwerk-Protokoll
//   ti-sword              -> Flottendoktrin + Elite-Flottendoktrin
//   ti-building-factory-2 -> Sternenwerft + Verbundraffinerie
// Fünf aufeinanderfolgende Karten sahen also buchstäblich identisch aus.
//
// Der Test prüft die REGEL, nicht eine Liste von Namen: jede Struktur hat einen ICONS-Eintrag, und
// keine zwei Strukturen teilen sich eine Zeichnung. Damit fällt beim nächsten neuen Allianzprojekt
// sofort auf, wenn es wieder mit einem Schrift-Icon durchrutscht.
const fs = require('fs');
const path = require('path');
// Pfad ueber die gemeinsame Quelle, nicht fest verdrahtet: Sonst wird KEPLER_SPIELDATEI
// still ignoriert und eine Gegenprobe liest die ECHTE Datei - sie sieht dann aus wie
// bestanden (CLAUDE.md, Korrektur zu Regel 14).
const { SPIELDATEI } = require('./lib/spieldatei');
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const LISTEN = ['ALLIANCE_TECH_DEFS', 'ALLIANCE_BUILDING_DEFS', 'ALLIANCE_ENDGAME_PROJECT_DEFS', 'ALLIANCE_WORLD_PROJECT_DEFS'];
const alle = [];
for (const name of LISTEN){
  const a = js.indexOf('const ' + name + ' = [');
  const b = js.indexOf('\n  ];', a);
  check('Liste ' + name + ' gefunden', a >= 0 && b > a);
  if (a < 0 || b < 0) continue;
  const blok = js.slice(a, b);
  for (const m of blok.matchAll(/key:'([a-z0-9_]+)'[\s\S]{0,900}?icon:'([a-zA-Z0-9_-]+)'/g)){
    alle.push({ liste: name, key: m[1], icon: m[2] });
  }
}
check('alle 37 Allianz-Strukturen erfasst', alle.length === 37, alle.length);

// ICONS-Schlüssel einsammeln. Bewusst über die Schlüssel-Zeilen statt über ein Auswerten der
// Datei: Der ICONS-Block ist mehrere hundert Kilobyte SVG, den will hier niemand ausführen.
const ikA = js.indexOf('const ICONS = {');
const ikB = js.indexOf('\n  };', ikA);
const ICON_KEYS = new Set([...js.slice(ikA, ikB).matchAll(/^\s{4}([a-zA-Z0-9_]+):\s*`/gm)].map(m => m[1]));
check('ICONS-Block gelesen', ICON_KEYS.size > 200, ICON_KEYS.size);

// ---- 1) Jede Struktur hat eine eigene Zeichnung
{
  const ohne = alle.filter(e => !ICON_KEYS.has(e.key));
  check('1: jede Allianz-Struktur hat einen eigenen ICONS-Eintrag', ohne.length === 0,
    { ohne: ohne.map(e => e.key),
      hinweis:'Neues Allianzprojekt? Ein gezeichnetes SVG unter seinem Schluessel in ICONS ergaenzen (CLAUDE.md Regel 7).' });
}

// ---- 2) Keine zwei Strukturen sehen gleich aus
// Das war der eigentliche Ärger: nicht dass die Symbole schlicht waren, sondern dass fünf Karten
// hintereinander dasselbe zeigten.
{
  const proSvg = {};
  for (const e of alle){
    const m = js.match(new RegExp('\\n    ' + e.key + ': `([\\s\\S]*?)`,'));
    const svg = m ? m[1] : '(fehlt)';
    (proSvg[svg] = proSvg[svg] || []).push(e.key);
  }
  const doppelt = Object.values(proSvg).filter(g => g.length > 1);
  check('2: keine zwei Strukturen teilen sich dieselbe Zeichnung', doppelt.length === 0, doppelt);
}

// ---- 3) Die fünf Expansions-Stufen sind auseinanderzuhalten
// Sie stehen direkt untereinander und unterscheiden sich inhaltlich nur in der Zahl - genau
// deshalb müssen sie sich optisch am deutlichsten unterscheiden.
{
  const stufen = ['a_expand1','a_expand2','a_expand3','a_expand4','a_expand5'];
  const roemisch = ['I','II','III','IV','V'];
  const fehlend = stufen.filter((k, i) => {
    const m = js.match(new RegExp('\\n    ' + k + ': `([\\s\\S]*?)`,'));
    return !m || m[1].indexOf('>' + roemisch[i] + '<') < 0;
  });
  check('3: jede Expansions-Stufe traegt ihre Stufenzahl im Bild', fehlend.length === 0, fehlend);
}

// ---- 4) Die Liste ZEICHNET die Icons auch
// Ohne diesen Abschnitt wären die SVGs vorhanden und trotzdem unsichtbar - genau der Fehler, der
// dem Projekt am 30.07.2026 schon einmal passiert ist (def.desc war geschrieben, wurde aber nie
// gerendert). Vier Stellen zeichnen dieselbe Zeile.
{
  const stellen = (js.match(/iconHtmlFor\(t\.key, t\.icon/g) || []).length;
  check('4: alle vier Zeichenstellen holen das Icon ueber iconHtmlFor', stellen === 4, stellen);
  // Bewusst auf die ALLIANZ-Kachel eingegrenzt (34px, violetter Grund) statt pauschal nach
  // `<i class="ti ${t.icon}">` zu suchen: `t` ist im Rest der Datei an sechs weiteren Stellen etwas
  // voellig anderes (Titel, Tagesaufgaben, Meilensteine) und traegt dort ein t.color. Eine breite
  // Suche waere rot, ohne dass etwas kaputt waere - ein Test, der bei fremdem Code anschlaegt,
  // wird beim naechsten Mal abgeschaltet statt gelesen.
  const kachel = /width:34px; height:34px; background:rgba\(126,119,221,0\.18\); color:#c3bef5;">\s*<i class="ti /g;
  const alteFassung = (js.match(kachel) || []).length;
  check('4: keine Allianz-Kachel schreibt mehr das Schrift-Icon fest ein', alteFassung === 0, alteFassung);
}

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);
