// Wie ein Spieler auf die Front wirkt: Bollwerk, Tagesdegression und was der Server dem Client
// darüber überhaupt noch verrät.
//
// Die Front aus v8.475.0 bewegte sich bisher NUR aus dem Stärkeverhältnis der Fraktionen - der
// Spieler sah einen Balken, an dem er nichts ändern konnte. Diese Prüfung deckt den ersten echten
// Hebel ab: das Bollwerk über /api/faction/attack, die einzige Handlung, deren Ausgang ohnehin
// serverseitig fällt und die deshalb schwer wiegen darf (250/60 gegen 40/30 der übrigen).
//
// WIE GEMESSEN WIRD: wie beim Front- und Kriegstest - der ECHTE Funktionsquelltext aus server.js
// wird herausgeschnitten und mit gestellten Nachbarn ausgeführt. Kein Nachbau.
//
// GEGENPROBE (beide Richtungen, 10.08.2026):
//   Alter Stand (`git -C ../kolonie-kepler7-backend show HEAD:server.js`): rkBeitrag, rkDegression,
//   rkZielEintrag und galaxyFuerClient existieren nicht - der Test bricht schon an den
//   „gefunden"-Prüfungen ab.
//   Gezielt kaputtgemacht - und zwar mit dem, was WIRKLICH herauskam, nicht mit dem, was ich vorher
//   hineingeschrieben hatte (zwei der fünf Vorhersagen waren falsch, siehe die Anmerkungen):
//     - RK_TAGESSTUFEN auf [[100,1.0],[100,1.0],[100,1.0]] → A4 („die ersten hundert sind mehr wert
//       als die letzten"), C1 („der WIRKSAME Wert, nicht der rohe") und G3 (Patchnote nennt 210).
//       NICHT A2: Der Deckel wird aus RK_TAGESSTUFEN abgeleitet und wandert deshalb mit - das ist
//       Absicht (Hausregel 3: die Regel prüfen, nicht die Momentaufnahme), meine Vorhersage war falsch.
//     - `ausserSys`-Filter entfernt → B2 („das eigene Beutesystem nie") und B5.
//     - Beitragenden-Eintrag vor die wirksam-Prüfung gezogen → C3 („wertlose Punkte machen niemanden
//       zum Beitragenden").
//     - galaxyFuerClient in /api/galaxy übersprungen → E6 („nutzt wirklich den gefilterten Weg").
//       NICHT E1: Das prüft die Funktion selbst, und die ist ja noch heil - deshalb steht E6
//       überhaupt daneben.
//     - rkAktiveSpieler zurück auf `u.lastSeen` → F1 und F2.

const { SERVER_JS, ueberspringen, pruefer, SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

if (!SERVER_JS) ueberspringen('Prüft Backend-Code - das Backend-Repo (kolonie-kepler7-backend) liegt hier nicht daneben.');

const { check, ende } = pruefer();
const src = fs.readFileSync(process.env.KEPLER_BACKEND_SERVER || SERVER_JS, 'utf8');

// ---- Quelltext holen ---------------------------------------------------------------------------
// Gleiche Extraktoren wie in test_randkriege_front.js. Der Konstanten-Extraktor unterscheidet nach
// dem WERT, ob ein Komma das Ende ist: Array-/Objektliterale reichen bis zum Semikolon, einfache
// Werte enden am ersten Komma (`const RK_UNTEN = 300, RK_OBEN = 700;`).
function holeFunktion(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) return null;
  const schluss = src.indexOf('\n}', start);
  return schluss < 0 ? null : src.slice(start, schluss + 2);
}
function holeKonstante(name) {
  const eigen = src.match(new RegExp('^const ' + name + ' = ([^;]+);', 'm'));
  if (eigen) {
    const wert = eigen[1].trim();
    if (wert[0] === '{' || wert[0] === '[') return 'const ' + name + ' = ' + wert + ';';
    return 'const ' + name + ' = ' + wert.split(',')[0].trim() + ';';
  }
  const kette = src.match(new RegExp('^const [^;\n]*\\b' + name + ' = ([^;,\n]+)[;,]', 'm'));
  return kette ? 'const ' + name + ' = ' + kette[1].trim() + ';' : null;
}

// rkGutschrift, rkWochenKonto und serverWeekKey sind seit v8.479.0 dazugekommen: rkBeitrag ruft
// rkGutschrift auf, und ohne die drei stirbt der herausgeschnittene Code mit
// "rkGutschrift is not defined". Das ist der Preis dafuer, echten Quelltext auszufuehren statt ihn
// nachzubauen - dafuer faellt hier auf, wenn rkBeitrag eine neue Abhaengigkeit bekommt.
const FN = ['loadOrInitRandkriege', 'rkTagesSchluessel', 'rkTagesKonto', 'rkDegression',
  'rkZielEintrag', 'serverWeekKey', 'rkWochenKonto', 'rkGutschrift', 'rkBeitrag',
  'galaxyFuerClient', 'getUserLastSeen', 'rkAktiveSpieler'];
const KONST = ['FACTION_RIVALS', 'RK_FRONT_PAARE', 'RK_OBEN', 'RK_UNTEN', 'RK_TAGESSTUFEN',
  'RK_BOLLWERK_ERFOLG', 'RK_BOLLWERK_FEHLSCHLAG', 'RK_BEITRAG_FENSTER', 'RK_HANDLUNGEN',
  'RK_MARKE_JE_PUNKTE', 'RK_MARKEN_WOCHE', 'RK_DIENSTGRADE'];
const fnQ = FN.map(n => ({ n, q: holeFunktion(n) }));
const kQ = KONST.map(n => ({ n, q: holeKonstante(n) }));
for (const { n, q } of fnQ) check(n + ' gefunden', !!q && q.length > 40, q ? q.length : 0);
for (const { n, q } of kQ) check('Konstante ' + n + ' gefunden', !!q, q);
if (fnQ.some(x => !x.q) || kQ.some(x => !x.q)) ende();

// ---- Gestellte Umgebung ------------------------------------------------------------------------
// Eine Uhr, die sowohl `Date.now()` als auch `new Date()` festhält - rkTagesSchluessel bildet den
// Tagesschlüssel über new Date().toISOString(), rkBeitrag stempelt über Date.now().
function festeUhr(ms) {
  const F = function () { return new Date(ms); };
  F.now = () => ms;
  return F;
}
const T0 = Date.UTC(2026, 7, 10, 12, 0, 0);

function baueApi(opt) {
  const o = opt || {};
  // db.users führt KEIN lastSeen - der Zeitstempel liegt in db.shared['leaderboard:<id>']. Genau
  // diese Annahme war im ersten Anlauf geraten statt abgelesen, deshalb baut das Fixture jetzt
  // beide Orte so, wie der Server sie wirklich führt. Der erfundene Schlüssel taucht nirgends auf.
  const users = {}, shared = {};
  for (const [name, wert] of Object.entries(o.users || {})) {
    const uid = wert.userId || name;
    users[name] = { userId: uid };
    if (wert.lastSeen) shared['leaderboard:' + uid] = JSON.stringify({ lastSeen: wert.lastSeen });
    if (wert.nurAmBenutzer) users[name].lastSeen = wert.nurAmBenutzer;   // die falsche Annahme von damals
  }
  // `private` gehört dazu, auch wenn dieser Test es lange nicht brauchte: galaxyFuerClient liest
  // seit den Frontbeiträgen db.private[userId].__rkBasis. Ein Fixture ohne den Bereich ist keine
  // schlanke Nachbildung, sondern eine falsche - der Test starb mit
  // "Cannot read properties of undefined". Der echte Server legt db.private immer an.
  const kontext = { db: { users, shared, private: o.private || {} }, Date: festeUhr(o.jetzt || T0) };
  const namen = Object.keys(kontext);
  const koerper = kQ.map(x => x.q).join('\n') + '\n' + fnQ.map(x => x.q).join('\n\n')
    + '\nreturn { ' + FN.join(', ') + ', ' + KONST.join(', ') + ' };';
  return new Function(...namen, koerper)(...namen.map(k => kontext[k]));
}
// Eine Front mit drei Abschnitten, alle Werte von Hand gesetzt - so ist jede Auswahl nachrechenbar.
function baueGalaxie(werte) {
  const paar = ['kartell', 'schatten'];
  return {
    randkriege: {
      fronten: [{
        a: paar[0], b: paar[1],
        systeme: (werte || [750, 500, 250]).map((kp, i) => ({
          sys: 's' + (i + 1), kp, puffer: { a: 0, b: 0 }, beitragende: {}
        }))
      }]
    }
  };
}
const api = baueApi();
const FRONT_KEY = 'kartell|schatten';

// ---- A. Die Tagesdegression -----------------------------------------------------------------
// Geprüft wird die REGEL, nicht eine Momentaufnahme: dass der Grenzwert nie steigt und dass die
// Tagessumme gedeckelt ist. Die Stufen selbst dürfen sich ändern, ohne dass der Test falsch wird -
// die erwarteten Zahlen werden aus RK_TAGESSTUFEN ABGELEITET, nicht eingetippt.
{
  const stufen = api.RK_TAGESSTUFEN;
  const erwarteterDeckel = stufen.reduce((a, [breite, faktor]) => a + breite * faktor, 0);
  const gesamtBreite = stufen.reduce((a, [breite]) => a + breite, 0);

  // A1: ein einzelner großer Beitrag wird über die Stufen aufgeteilt.
  const einBeitrag = api.rkDegression(0, 250);
  let vonHand = 0, rest = 250;
  for (const [breite, faktor] of stufen) { const n = Math.min(rest, breite); vonHand += n * faktor; rest -= n; }
  check('A1: ein großer Beitrag wird über die Stufen verteilt', Math.abs(einBeitrag - vonHand) < 1e-9,
    { roh: 250, wirksam: einBeitrag });

  // A2: der Tagesdeckel. In kleinen Häppchen zugeführt darf nicht mehr herauskommen als am Stück.
  let summe = 0, bisher = 0;
  for (let i = 0; i < 200; i++) { summe += api.rkDegression(bisher, 10); bisher += 10; }
  check('A2: Tagesdeckel ist die Summe der Stufen, egal in wie vielen Schritten',
    Math.abs(summe - erwarteterDeckel) < 1e-9, { gemessen: summe, erwartet: erwarteterDeckel });
  check('A2: derselbe Deckel auch bei einem einzigen Riesenbeitrag',
    Math.abs(api.rkDegression(0, 999999) - erwarteterDeckel) < 1e-9, api.rkDegression(0, 999999));

  // A3: der Grenzwert fällt monoton - jede weitere Zehnerportion ist höchstens so viel wert wie die
  // davor. Ohne diese Prüfung könnte eine vertauschte Stufe unbemerkt durchgehen.
  let letzter = Infinity, monoton = true;
  for (let b = 0; b < gesamtBreite + 50; b += 10) {
    const wert = api.rkDegression(b, 10);
    if (wert > letzter + 1e-9) monoton = false;
    letzter = wert;
  }
  check('A3: der Grenzwert steigt nie wieder an', monoton);

  // A4: und der letzte wirksame Punkt ist echt weniger wert als der erste - sonst wäre die ganze
  // Degression nur Dekoration.
  const ersterHunderter = api.rkDegression(0, 100);
  const letzterHunderter = api.rkDegression(gesamtBreite - 100, 100);
  check('A4: die ersten hundert Punkte sind mehr wert als die letzten',
    ersterHunderter > letzterHunderter * 1.5,
    { erste: ersterHunderter, letzte: letzterHunderter, verhaeltnis: (ersterHunderter / letzterHunderter).toFixed(2) });
  check('A4: hinter der letzten Stufe ist ein Beitrag wirkungslos',
    api.rkDegression(gesamtBreite, 500) === 0);
}

// ---- B. Welcher Frontabschnitt bekommt den Beitrag? ------------------------------------------
{
  const front = baueGalaxie([750, 690, 320]).randkriege.fronten[0];
  check('B1: das gewünschte System gewinnt, wenn es Front ist',
    api.rkZielEintrag(front, 'kartell', { wunschSys: 's3' }).sys === 's3');
  check('B1: ein unbekanntes Wunschsystem fällt auf die Regel zurück',
    !!api.rkZielEintrag(front, 'kartell', { wunschSys: 'gibtesnicht' }));
  check('B2: das eigene Beutesystem wird nie gewählt',
    api.rkZielEintrag(front, 'kartell', { ausserSys: 's2' }).sys !== 's2',
    api.rkZielEintrag(front, 'kartell', { ausserSys: 's2' }).sys);
  // Seite a drückt nach OBEN. Noch nicht gewonnen sind s2 (690) und s3 (320); am nächsten dran
  // ist s2. Genau dort lohnt der nächste Punkt am meisten.
  check('B3: für Seite a der am weitesten fortgeschrittene noch offene Abschnitt',
    api.rkZielEintrag(front, 'kartell', {}).sys === 's2', api.rkZielEintrag(front, 'kartell', {}).sys);
  // Seite b drückt nach UNTEN. Offen sind alle drei (alle über 300); am nächsten dran ist s3.
  check('B3: für Seite b spiegelbildlich',
    api.rkZielEintrag(front, 'schatten', {}).sys === 's3', api.rkZielEintrag(front, 'schatten', {}).sys);

  // B4: steht die eigene Seite überall schon oben, stützt der Beitrag den schwächsten Abschnitt.
  const alleOben = baueGalaxie([980, 800, 720]).randkriege.fronten[0];
  check('B4: sind alle Abschnitte gewonnen, geht der Beitrag an den schwächsten',
    api.rkZielEintrag(alleOben, 'kartell', {}).sys === 's3', api.rkZielEintrag(alleOben, 'kartell', {}).sys);

  const leer = { a: 'kartell', b: 'schatten', systeme: [] };
  check('B5: eine leere Front liefert kein Ziel', api.rkZielEintrag(leer, 'kartell', {}) === null);
  const nurEins = baueGalaxie([750]).randkriege.fronten[0];
  check('B5: der einzige Abschnitt, ausgeschlossen, liefert kein Ziel',
    api.rkZielEintrag(nurEins, 'kartell', { ausserSys: 's1' }) === null);
}

// ---- C. Der Beitrag selbst -------------------------------------------------------------------
{
  const g = baueGalaxie();
  const r = api.rkBeitrag(g, 'kartell', 'spielerA', 250, { wunschSys: 's2' });
  const e = g.randkriege.fronten[0].systeme.find(x => x.sys === 's2');
  check('C1: der Beitrag landet im Puffer der eigenen Seite', e.puffer.a > 0 && e.puffer.b === 0, e.puffer);
  check('C1: gemeldet wird der WIRKSAME Wert, nicht der rohe', r.punkte === e.puffer.a && r.punkte < r.roh,
    { roh: r.roh, wirksam: r.punkte });
  check('C2: das Konto ist als Beitragender mit seiner Seite vermerkt',
    e.beitragende.spielerA && e.beitragende.spielerA.seite === 'kartell' && e.beitragende.spielerA.ts === T0,
    e.beitragende.spielerA);
  // Der Beitrag darf den Stand NICHT direkt bewegen - das macht ausschließlich der Weltentakt,
  // und zwar erst nach der Auslöschung gegen die Gegenseite.
  check('C6: der Kontrollpunktstand bleibt unberührt', e.kp === 500, e.kp);

  // Die Gegenseite füllt den anderen Puffer.
  api.rkBeitrag(g, 'schatten', 'spielerB', 40, { wunschSys: 's2' });
  check('C1: die Gegenseite füllt den Puffer b', e.puffer.b > 0 && e.beitragende.spielerB.seite === 'schatten', e.puffer);

  // C3: über den Tagesdeckel hinaus kommt nichts mehr an - und ein Konto, das nichts Wirksames
  // beiträgt, darf auch nicht als Beitragender zählen. Sonst könnte ein Großkonto die
  // Mehr-Konten-Sperre im Takt mit wertlosen Punkten aufschließen.
  const g2 = baueGalaxie();
  api.rkBeitrag(g2, 'kartell', 'viel', 1000, { wunschSys: 's1' });
  const e2 = g2.randkriege.fronten[0].systeme.find(x => x.sys === 's1');
  const pufferNachDeckel = e2.puffer.a;
  const r2 = api.rkBeitrag(g2, 'kartell', 'viel', 500, { wunschSys: 's1' });
  check('C3: hinter dem Tagesdeckel kommt nichts mehr an',
    r2.punkte === 0 && e2.puffer.a === pufferNachDeckel, { vorher: pufferNachDeckel, nachher: e2.puffer.a });
  const g3 = baueGalaxie();
  api.rkBeitrag(g3, 'kartell', 'satt', 1000, { wunschSys: 's1' });
  api.rkBeitrag(g3, 'kartell', 'satt', 500, { wunschSys: 's2' });
  const e3 = g3.randkriege.fronten[0].systeme.find(x => x.sys === 's2');
  check('C3: wertlose Punkte machen niemanden zum Beitragenden',
    !e3.beitragende.satt, Object.keys(e3.beitragende));

  // C4: das Tageskonto zählt ROHE Punkte (die Degression greift auf ihnen) und wird beim
  // Tageswechsel geleert.
  check('C4: das Tageskonto führt die rohe Summe',
    g2.randkriege.tag.konten.viel[FRONT_KEY] === 1500, g2.randkriege.tag.konten.viel);
  const apiMorgen = baueApi({ jetzt: T0 + 24 * 3600 * 1000 });
  apiMorgen.rkBeitrag(g2, 'kartell', 'viel', 100, { wunschSys: 's1' });
  check('C4: ein neuer Tag setzt das Konto zurück',
    g2.randkriege.tag.konten.viel[FRONT_KEY] === 100, g2.randkriege.tag);
  check('C4: und der Beitrag wirkt danach wieder voll',
    e2.puffer.a > pufferNachDeckel, { vorher: pufferNachDeckel, nachher: e2.puffer.a });

  // C5: Randfälle liefern null statt zu werfen.
  check('C5: ohne angelegte Front kein Beitrag',
    api.rkBeitrag({ randkriege: { fronten: [] } }, 'kartell', 'x', 50, {}) === null);
  check('C5: eine unbekannte Seite trägt nichts bei',
    api.rkBeitrag(baueGalaxie(), 'niemand', 'x', 50, {}) === null);
  check('C5: null Punkte sind kein Beitrag', api.rkBeitrag(baueGalaxie(), 'kartell', 'x', 0, {}) === null);
  check('C5: ohne Konto kein Beitrag', api.rkBeitrag(baueGalaxie(), 'kartell', '', 50, {}) === null);
}

// ---- D. Das Bollwerk hängt wirklich am Angriff ------------------------------------------------
{
  const start = src.indexOf("app.post('/api/faction/attack'");
  const stop = src.indexOf('\n});', start);
  // Regel 6 der Hausregeln: Ein Slice mit indexOf-Endanker prüft ZUERST, dass der Anker existiert -
  // sonst liefe der Ausschnitt bis fast ans Dateiende und jede Prüfung darauf wäre wertlos.
  check('D0: der Angriffs-Endpunkt ist abgegrenzt', start > 0 && stop > start, { start, stop });
  const block = start > 0 && stop > start ? src.slice(start, stop) : '';
  check('D1: der Angriff trägt für den RIVALEN des Besitzers bei',
    /FACTION_RIVALS\[owner\.id\]/.test(block) && /rkBeitrag\(g, rkSeite, req\.userId/.test(block));
  check('D2: bei Erfolg fällt das eroberte System als Ziel aus',
    /success \? \{ ausserSys: systemId \}/.test(block));
  check('D2: bei Misserfolg geht der Beitrag genau dorthin',
    /\{ wunschSys: systemId \}/.test(block));
  check('D3: die Gewichte stehen als Konstante, nicht als Zahl im Endpunkt',
    /RK_BOLLWERK_ERFOLG/.test(block) && /RK_BOLLWERK_FEHLSCHLAG/.test(block) && !/\b250\b/.test(block));
  check('D3: Erfolg wiegt deutlich schwerer als Misserfolg',
    api.RK_BOLLWERK_ERFOLG >= api.RK_BOLLWERK_FEHLSCHLAG * 3,
    { erfolg: api.RK_BOLLWERK_ERFOLG, fehlschlag: api.RK_BOLLWERK_FEHLSCHLAG });
  check('D4: beide Antworten melden das Frontergebnis',
    (block.match(/front: rkErgebnis/g) || []).length === 2,
    (block.match(/front: rkErgebnis/g) || []).length);
  // Und das Bollwerk muss über der Tagesdegression noch etwas bewirken - ein Gewicht unterhalb der
  // ersten Stufe wäre nach zwei Angriffen wirkungslos.
  check('D5: ein erfolgreiches Bollwerk füllt allein schon mehr als eine Stufe',
    api.rkDegression(0, api.RK_BOLLWERK_ERFOLG) > api.RK_TAGESSTUFEN[0][0],
    api.rkDegression(0, api.RK_BOLLWERK_ERFOLG));
}

// ---- E. Was der Client zu sehen bekommt --------------------------------------------------------
{
  const g = baueGalaxie();
  api.rkBeitrag(g, 'kartell', 'ich', 60, { wunschSys: 's1' });
  api.rkBeitrag(g, 'kartell', 'jemand', 60, { wunschSys: 's1' });
  api.rkBeitrag(g, 'schatten', 'gegner', 60, { wunschSys: 's1' });
  g.controlledSystems = { s9: 'ich' };
  const raus = api.galaxyFuerClient(g, 'ich');
  const roh = JSON.stringify(raus);
  check('E1: keine Pufferstände beim Client', !/"puffer"/.test(roh));
  check('E1: keine Beitragenden-Liste beim Client', !/"beitragende"/.test(roh) && !roh.includes('jemand'));
  const e = raus.randkriege.fronten[0].systeme.find(x => x.sys === 's1');
  check('E2: Systemname und Stand bleiben erhalten', e.sys === 's1' && e.kp === 750, e);
  check('E2: alles außerhalb der Randkriege geht unverändert durch',
    JSON.stringify(raus.controlledSystems) === JSON.stringify(g.controlledSystems));
  check('E3: die Zahl der Beitragenden je Seite wird gemeldet',
    e.beitragendeA === 2 && e.beitragendeB === 1, { a: e.beitragendeA, b: e.beitragendeB });
  check('E3: "dabei" gilt nur für den Abrufenden', e.dabei === true
    && api.galaxyFuerClient(g, 'fremder').randkriege.fronten[0].systeme[0].dabei === false);
  check('E4: die Tagessumme ist die eigene', raus.randkriege.meinTag[FRONT_KEY] === 60,
    raus.randkriege.meinTag);
  // Der Basiswert der Differenz-Handlungen geht als KOPIE mit raus - der Client rechnet die offene
  // Menge daraus gegen seinen eigenen Spielstand aus. Fremde Basiswerte haben dort nichts verloren.
  const mitBasis = baueApi({ private: { ich: { __rkBasis: { expeditionsCompleted: 7 } },
    fremder: { __rkBasis: { expeditionsCompleted: 99 } } } });
  const rausB = mitBasis.galaxyFuerClient(g, 'ich');
  check('E4: der eigene Basiswert wird mitgeliefert',
    rausB.randkriege.meineBasis.expeditionsCompleted === 7, rausB.randkriege.meineBasis);
  check('E4: jede Handlung hat einen Eintrag, auch ohne Fortschritt',
    Object.keys(rausB.randkriege.meineBasis).length === Object.keys(mitBasis.RK_HANDLUNGEN).length,
    rausB.randkriege.meineBasis);
  check('E4: kein fremder Basiswert in der Antwort',
    !JSON.stringify(rausB.randkriege).includes('99'), rausB.randkriege.meineBasis);
  check('E4: die Tagesbreite kommt aus den Stufen',
    rausB.randkriege.tagesBreite === api.RK_TAGESSTUFEN.reduce((a, st) => a + st[0], 0),
    rausB.randkriege.tagesBreite);
  check('E4: ein Fremder sieht seine eigene (leere) Summe',
    JSON.stringify(api.galaxyFuerClient(g, 'fremder').randkriege.meinTag) === '{}');
  // Eine Galaxie ohne Front darf unverändert durchgehen - sonst bräche der erste Start.
  const ohne = { controlledSystems: {} };
  check('E5: eine Galaxie ohne Randkriege geht unverändert durch',
    api.galaxyFuerClient(ohne, 'ich') === ohne);
  check('E6: /api/galaxy nutzt wirklich den gefilterten Weg',
    /res\.json\(galaxyFuerClient\(loadOrInitGalaxy\(\), req\.userId\)\)/.test(src));
}

// ---- F. Der Aktivitätszähler liest den echten Ort ----------------------------------------------
// Das ist die Behebung eines Fehlers aus dem eigenen Vorlauf: rkAktiveSpieler las `u.lastSeen` -
// ein Feld, das es auf den Benutzerobjekten nicht gibt. Die Funktion lieferte immer 0, damit war
// die Mehr-Konten-Sperre im Takt auf "einer reicht" geklemmt.
{
  // Die Zusammensetzung ist so gewählt, dass richtig und falsch VERSCHIEDENE Zahlen ergeben: zwei
  // Konten mit frischem Bestenlisten-Eintrag, eines mit altem, eines mit dem erfundenen Feld von
  // damals. Richtig sind das 2, mit dem alten Lesefehler wäre es 1. Eine Prüfung, die bei beiden
  // Ständen dieselbe Zahl erwartet, würde hier gar nichts belegen - genau das war der erste Versuch.
  const a = baueApi({
    users: {
      frisch:  { userId: 'u1', lastSeen: T0 - 1000 },
      frisch2: { userId: 'u4', lastSeen: T0 - 2000 },
      alt:     { userId: 'u2', lastSeen: T0 - 40 * 3600 * 1000 },
      erfunden:{ userId: 'u3', nurAmBenutzer: T0 - 1000 }     // nur das Feld von damals
    }
  });
  check('F1: zählt über die Bestenliste', a.rkAktiveSpieler() === 2, a.rkAktiveSpieler());
  check('F1: ein lastSeen NUR am Benutzerobjekt zählt nicht mit', a.rkAktiveSpieler() === 2);
  check('F2: der Quelltext liest nicht mehr am Benutzerobjekt',
    !/for \(const u of Object\.values\(db\.users\)\) if \(\(u\.lastSeen/.test(src));
  check('F2: sondern über getUserLastSeen', /getUserLastSeen\(u\.userId\) > grenze/.test(src));
  const b = baueApi({ users: {} });
  check('F3: ohne Konten sind null aktiv', b.rkAktiveSpieler() === 0);
}

// ---- G. Frontend und Server meinen dieselben Zahlen --------------------------------------------
// Zweite Anzeigestelle (Hausregel 6): Der Hilfetext im Spiel nennt die Gewichte des Bollwerks. Ein
// Zahlendreher dort wäre für den Spieler eine Lüge, die niemand bemerkt.
{
  const fe = fs.readFileSync(SPIELDATEI, 'utf8');
  // Hausregel 6: Ein Slice mit indexOf-Endanker prüft ZUERST, dass beide Anker existieren - sonst
  // läuft der Ausschnitt bis fast ans Dateiende und jede Prüfung darauf wäre vacuous.
  const start = fe.indexOf("{ title:'Die Front verschieben: das Bollwerk'");
  const stop = start < 0 ? -1 : fe.indexOf("\n      { title:", start + 10);
  check('G0: der Hilfe-Abschnitt zum Bollwerk ist abgegrenzt', start > 0 && stop > start, { start, stop });
  const hilfe = (start > 0 && stop > start) ? fe.slice(start, stop) : '';
  check('G1: der Hilfetext nennt die Erfolgszahl des Servers',
    hilfe.includes(String(api.RK_BOLLWERK_ERFOLG)), api.RK_BOLLWERK_ERFOLG);
  check('G1: und die Zahl für den Fehlschlag',
    hilfe.includes(String(api.RK_BOLLWERK_FEHLSCHLAG)), api.RK_BOLLWERK_FEHLSCHLAG);
  // Der Tagesdeckel wird ABGELEITET, nicht eingetippt - ändert sich RK_TAGESSTUFEN, muss der
  // Hilfetext mitziehen, und genau das soll hier auffallen.
  const deckel = api.RK_TAGESSTUFEN.reduce((a, [breite, faktor]) => a + breite * faktor, 0);
  check('G2: und den wirksamen Tagesdeckel', hilfe.includes(String(deckel)), deckel);
  for (const [breite, faktor] of api.RK_TAGESSTUFEN) {
    check('G2: die Stufe ' + breite + ' zu ' + Math.round(faktor * 100) + '% steht im Hilfetext',
      hilfe.includes(String(breite)) && (faktor === 1 || hilfe.includes(Math.round(faktor * 100) + '%')));
  }
  // Und die Patchnote verspricht dieselben Zahlen - sie ist die Stelle, die am ehesten veraltet.
  //
  // GEPRUEFT WIRD DIE REGEL, NICHT DIE MOMENTAUFNAHME (Arbeitsregel 3): Der erste Anlauf griff sich
  // die OBERSTE Patchnote und setzte damit voraus, dass sie die eigene ist. Das gilt genau bis zur
  // naechsten Version - hier war es v8.477.0 (weicher Deckel im PvP), die sich davorschob und den
  // Test auf voellig korrektem Code rot werden liess. Jetzt wird JEDER Eintrag geprueft und
  // verlangt, dass EINER von ihnen alle drei Zahlen zusammen nennt (nicht ueber mehrere verteilt).
  // Die Zusage bleibt damit dieselbe: Aendern sich die Zahlen im Code, findet sich kein Eintrag
  // mehr, der die neuen nennt - es muss also eine neue Patchnote geschrieben werden.
  const eintraege = fe.match(/\{ version:'[\d.]+', date:'[^']*', changes:\[[\s\S]{0,4000}?\n    \]\},/g) || [];
  const nennt = (t) => t.includes(String(api.RK_BOLLWERK_ERFOLG)) && t.includes(String(api.RK_BOLLWERK_FEHLSCHLAG));
  check('G3: eine Patchnote nennt dieselben Gewichte',
    eintraege.some(nennt), { eintraege: eintraege.length });
  check('G3: und dieselbe Patchnote denselben Tagesdeckel',
    eintraege.some(t => nennt(t) && t.includes(String(deckel))), deckel);
}

ende();
