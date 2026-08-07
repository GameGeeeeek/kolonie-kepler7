// Boss-Statuseffekte im Allianz-Raid (v8.438.0, Modul-Ausbau Etappe 2).
//
// ARCHITEKTUR: Brand/Frost/Schock haengen an der Verbandszusammensetzung und werden VOLLSTAENDIG
// serverseitig entschieden (/allianceraid/resolve, ALLIANCE_RAID_STATUS) - der Client zeigt nur
// die server-gesetzten Felder (doc.status, brandSchaden/statusVorher/statusNeu). Es gibt also
// keinen Spiegel, der driften kann - aber die ANZEIGETEXTE des Clients nennen die Server-Zahlen,
// und genau diese Nennung wird hier gegeneinander geprueft (die "zweite Anzeigestelle mit der
// alten Annahme" ist der Hausfehler dieses Projekts, CLAUDE.md Pflicht 6).
//
// GEPRUEFT WIRD:
//   1) Server: Konstanten existieren; Brand wirkt VOR dem Beschuss, Schock deckt die Schwaeche,
//      Frost senkt die Gegenwehr; neue Status aus Anteilen; erlegter Boss nimmt Status mit;
//      /claim reicht die drei Felder typgeprueft durch.
//   2) Paritaet: Die Prozentzahlen der Server-Konstanten stehen woertlich in Client-Hilfe und
//      Status-Texten (15/25/30% Anteile, 6%/20% Wirkungen).
//   3) Client: Boss-Karte zeigt doc.status, der Bericht die drei Zeilen (Browser-Beweis liegt in
//      test_raidbericht - dort traegt der gestellte Bericht die neuen Felder).
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren ausgefuehrt): am alten Stand fallen 1a und 3a durch.
const fs = require('fs');
const { SPIELDATEI, SERVER_JS, pruefer, ueberspringen } = require('./lib/umgebung');
const { check, ende } = pruefer();

const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
if (!SERVER_JS) ueberspringen('Backend-Repo liegt nicht daneben - Boss-Status ist server-entschieden, ohne server.js ist nur die halbe Wahrheit pruefbar.');
const SRV = fs.readFileSync(SERVER_JS, 'utf8');

// ---- 1) Server
const konst = (SRV.match(/const ALLIANCE_RAID_STATUS = \{[\s\S]{0,900}?\n\};/) || [''])[0];
check('1a: ALLIANCE_RAID_STATUS existiert mit allen drei Effekten',
  konst.includes('brand:') && konst.includes('frost:') && konst.includes('schock:'), konst.length);
const resolveVon = SRV.indexOf("app.post('/api/allianceraid/resolve'");
const resolveEnde = SRV.indexOf('\napp.', resolveVon + 10);
const resolve = resolveVon > 0 ? SRV.slice(resolveVon, resolveEnde) : '';
check('1b: resolve-Handler gefunden', resolve.length > 1000);
check('1c: Brand frisst Rest-HP VOR der Schadensrechnung (brandSchaden vor const damage)',
  resolve.indexOf('brandSchaden = Math.min(doc.hp,') > 0 &&
  resolve.indexOf('brandSchaden = Math.min(doc.hp,') < resolve.indexOf('const damage = Math.min(doc.hp,'));
check('1d: Schock deckt die Trefferschwaeche unabhaengig von der Zusammensetzung',
  resolve.includes("statusVorher.schock ? true :"));
check('1e: Frost senkt die Gegenwehr um die Konstanten-Wirkung',
  resolve.includes('statusVorher.frost ? Math.round(counterRoh * (1 - ALLIANCE_RAID_STATUS.frost.wirkung))'));
check('1f: neue Status aus SCHIFFSANTEILEN der Verbandsflotte',
  resolve.includes('n / gesamtSchiffe >= sdef.anteil'));
check('1g: ein erlegter Boss nimmt seine Status mit',
  resolve.includes('doc.status = destroyed ? null : statusNeu;'));
const claimVon = SRV.indexOf("app.post('/api/allianceraid/claim'");
const claim = SRV.slice(claimVon, SRV.indexOf('\napp.', claimVon + 10));
check('1h: /claim reicht die drei Felder typgeprueft durch',
  claim.includes("typeof res_.brandSchaden === 'number'") &&
  claim.includes('Array.isArray(res_.statusVorher)') && claim.includes('Array.isArray(res_.statusNeu)'));

// ---- 2) Paritaet der Zahlen: Server-Konstanten woertlich in den Client-Texten
const zahl = (name, feld) => Number((konst.match(new RegExp(name + ':[^}]*' + feld + ':\\s*([\\d.]+)')) || [])[1]);
const proz = x => Math.round(x * 100);
const paare = [
  ['brand-Anteil',  proz(zahl('brand','anteil')),  'ab ' + proz(zahl('brand','anteil')) + '% Bomber-Anteil'],
  ['frost-Anteil',  proz(zahl('frost','anteil')),  'ab ' + proz(zahl('frost','anteil')) + '% Kreuzer/Zerst'],
  ['schock-Anteil', proz(zahl('schock','anteil')), 'ab ' + proz(zahl('schock','anteil')) + '% J'],
  ['brand-Wirkung', proz(zahl('brand','wirkung')), 'verliert ' + proz(zahl('brand','wirkung')) + '% Rest-H'],
  ['frost-Wirkung', proz(zahl('frost','wirkung')), 'Gegenwehr −' + proz(zahl('frost','wirkung')) + '%']
];
for (const [name, wert, textStueck] of paare){
  check('2: Client-Text nennt die Server-Zahl (' + name + ' = ' + wert + '%)',
    Number.isFinite(wert) && JS.includes(textStueck), textStueck);
}

// ---- 3) Client-Verdrahtung
check('3a: die Boss-Karte zeigt doc.status',
  JS.includes('Boss-Status für die nächste Welle:') && JS.includes('raidStatusText(Object.keys(doc.status)'));
check('3b: der Bericht rendert Brand-Schaden, wirkende und hinterlassene Status',
  JS.includes('Brand aus der Vorwelle:') &&
  JS.includes('Wirkende Status aus der Vorwelle:') &&
  JS.includes("raidStatusText(r.statusNeu)"));
check('3c: der Claim uebernimmt die drei Felder typgeprueft in den Bericht',
  JS.includes("brandSchaden: (typeof data.brandSchaden === 'number') ? data.brandSchaden : 0"));

ende();
