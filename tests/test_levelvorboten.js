// Levelaufstiegs-Hinweise: zwei Meldungen auf DERSELBEN Stufe loeschen einander.
//
// Der Anlass (21.08.2026, Phase 6): Ein neuer Vorbote fuer die Asteroidenfestungen wurde auf
// Stufe 12 gelegt - dort feuert in addXp() aber bereits der fest verdrahtete Abgrund-Vorbote.
// Beide schreiben im SELBEN synchronen Block eine lange Erklaerung per log(), und `#log` hat
// keinen Stapel: Es ueberschreibt sich mit jeder Meldung selbst (CLAUDE.md, Nachtrag zu
// Arbeitsregel 47). Die zuerst geschriebene Erklaerung waere also spurlos verschwunden - und
// zwar endgueltig, denn die Marke (state.abgrundVorbote bzw. state.vorboten[key]) steht danach
// trotzdem auf true. Der Hinweis kommt nie wieder.
//
// Geprueft wird deshalb die REGEL, nicht die Momentaufnahme: Keine Stufe darf zwei erklaerende
// Meldungen tragen. Der Test liest BEIDE Quellen aus der Spieldatei - die VORBOTEN-Tabelle und
// die fest verdrahteten `after >= N`-Zweige in addXp() - und haelt sie gegeneinander. Eine
// kuenftige Meldung faellt damit auf, ohne dass jemand an sie gedacht haben muss
// (Arbeitsregel 40).
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

// ---------------------------------------------------------------- 1) die VORBOTEN-Tabelle
// Anker zuerst pruefen: Ohne ihn liefert indexOf -1, der Slice liefe bis Dateiende und jede
// Aussage darunter waere vacuous (Arbeitsregel 6).
const tabVon = src.indexOf('const VORBOTEN = [');
const tabBis = tabVon < 0 ? -1 : src.indexOf('\n  ];', tabVon);
check('1-anker: die VORBOTEN-Tabelle laesst sich schneiden', tabVon > 0 && tabBis > tabVon, { tabVon, tabBis });
const tabelle = (tabVon > 0 && tabBis > tabVon) ? src.slice(tabVon, tabBis) : '';

// key:'tier2' traegt eine ZIFFER - ein Zeichenklassen-Muster ohne 0-9 uebersieht den Eintrag
// stillschweigend. Genau das ist beim Messen dieses Befundes einmal passiert und sah aus wie
// "die Tabelle hat nur vier Eintraege".
const vorboten = [...tabelle.matchAll(/key:'([a-z0-9_]+)'[\s\S]{0,80}?level:(\d+)/g)]
  .map(m => ({ key: m[1], level: Number(m[2]) }));
check('1: alle Vorboten gelesen (mindestens fuenf)', vorboten.length >= 5,
  vorboten.map(v => v.key + '@' + v.level));

// ------------------------------------------------- 2) die fest verdrahteten Meldungen in addXp
const xpVon = src.indexOf('function addXp(amount)');
const xpBis = xpVon < 0 ? -1 : src.indexOf('\n  function ', xpVon + 10);
check('2-anker: der addXp-Block laesst sich schneiden', xpVon > 0 && xpBis > xpVon, { xpVon, xpBis });
const xpBlock = (xpVon > 0 && xpBis > xpVon) ? src.slice(xpVon, xpBis) : '';
// Nur was VOR maybeShowVorbote(after) steht, konkurriert mit einem Vorboten im selben Block.
const vorAufruf = xpBlock.split('maybeShowVorbote(after)')[0];
check('2-anker: maybeShowVorbote wird aus addXp aufgerufen (sonst misst der Test nichts)',
  xpBlock.indexOf('maybeShowVorbote(after)') > 0);

const festeMeldungen = [];
for (const m of vorAufruf.matchAll(/after >= (\d+)/g)) {
  const dahinter = vorAufruf.slice(m.index, m.index + 900);
  if (dahinter.includes('log(')) festeMeldungen.push(Number(m[1]));
}
check('2: fest verdrahtete Erklaer-Meldungen gefunden', festeMeldungen.length >= 2, festeMeldungen);

// ---------------------------------------------------------------- 3) die eigentliche Regel
const kollisionen = vorboten.filter(v => festeMeldungen.includes(v.level));
check('3: kein Vorbote liegt auf einer Stufe, die schon eine feste Meldung traegt',
  kollisionen.length === 0,
  { kollidiert: kollisionen.map(v => v.key + '@' + v.level), festeMeldungen });

const dopplungen = vorboten
  .map(v => v.level)
  .filter((l, i, a) => a.indexOf(l) !== i);
check('3b: und keine zwei Vorboten teilen sich eine Stufe', dopplungen.length === 0,
  { doppelt: [...new Set(dopplungen)], alle: vorboten.map(v => v.key + '@' + v.level) });

// Die Gegenrichtung (Arbeitsregel 33): Verschwindet eine feste Meldung, ist das genauso ein
// Befund - dann misst 3 naemlich nichts mehr, ohne dass es auffiele.
check('3c: die Abgrund-Meldung auf Stufe 12 steht noch (sonst ist 3 nur noch halb wirksam)',
  festeMeldungen.includes(12) && /state\.abgrundVorbote/.test(vorAufruf), festeMeldungen);

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
