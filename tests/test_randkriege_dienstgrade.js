// Dienstgrade und Frontlager: Meinen Frontend und Backend dieselben Stufen und dieselben Preise?
//
// Warum das die riskante Stelle ist: Der Server kennt vom Frontlager NUR Preis und
// Dienstgrad-Schranke (RK_LAGER) – was ein Posten gibt, weiß allein das Frontend. Das ist Absicht
// (keine zweite Katalogkopie), hat aber eine Kehrseite: Läuft ein Preis auseinander, zeigt das
// Spiel „3 Marken", der Server bucht 5 ab, und der Fehler fällt erst dem Spieler auf. Genauso bei
// den Stufenschwellen: Die Anzeige sagt „Marschall erreicht", der Server lehnt den Kauf ab.
//
// GEGENPROBE (beide Richtungen, 10.08.2026) – gemessene Ergebnisse am Dateiende, nicht meine
// Vorhersage.

const { SERVER_JS, ueberspringen, pruefer, SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

if (!SERVER_JS) ueberspringen('Prüft Backend-Code - das Backend-Repo (kolonie-kepler7-backend) liegt hier nicht daneben.');

const { check, ende } = pruefer();
const be = fs.readFileSync(process.env.KEPLER_BACKEND_SERVER || SERVER_JS, 'utf8');
const fe = fs.readFileSync(SPIELDATEI, 'utf8');

// Klammern zählen statt einer Regex zu vertrauen - beide Listen enthalten geschweifte Klammern in
// ihren Einträgen (bekannter Fallstrick in dieser Datei).
function literalNach(quelle, name, oeffner, schliesser) {
  const start = quelle.indexOf('const ' + name + ' = ' + oeffner);
  if (start < 0) return null;
  let tiefe = 0, i = quelle.indexOf(oeffner, start);
  for (; i < quelle.length; i++) {
    if (quelle[i] === oeffner) tiefe++;
    else if (quelle[i] === schliesser) { tiefe--; if (tiefe === 0) break; }
  }
  if (tiefe !== 0) return null;
  try { return new Function('return ' + quelle.slice(quelle.indexOf(oeffner, start), i + 1) + ';')(); }
  catch (e) { return null; }
}
function zahlAus(quelle, name) {
  const m = quelle.match(new RegExp('^\\s*const ' + name + ' = ([^;]+);', 'm'));
  if (!m) return null;
  try { return new Function('return ' + m[1] + ';')(); } catch (e) { return null; }
}

const beGrade = literalNach(be, 'RK_DIENSTGRADE', '[', ']');
const feGrade = literalNach(fe, 'DIENSTGRADE', '[', ']');
const beLager = literalNach(be, 'RK_LAGER', '{', '}');
const feLager = literalNach(fe, 'FRONT_LAGER', '[', ']');
check('RK_DIENSTGRADE gefunden', Array.isArray(beGrade) && beGrade.length === 6, beGrade && beGrade.length);
check('DIENSTGRADE gefunden', Array.isArray(feGrade) && feGrade.length === 6, feGrade && feGrade.length);
check('RK_LAGER gefunden', !!beLager && Object.keys(beLager).length >= 5, beLager && Object.keys(beLager));
check('FRONT_LAGER gefunden', Array.isArray(feLager) && feLager.length >= 5, feLager && feLager.length);
if (!beGrade || !feGrade || !beLager || !feLager) ende();

const beMarke = zahlAus(be, 'RK_MARKE_JE_PUNKTE');
const beWoche = zahlAus(be, 'RK_MARKEN_WOCHE');
const beStufen = literalNach(be, 'RK_TAGESSTUFEN', '[', ']');

// ---- 1. Dieselben Stufen -------------------------------------------------------------------------
{
  for (let i = 0; i < beGrade.length; i++) {
    const b = beGrade[i], f = feGrade[i];
    check('1: Stufe ' + (i + 1) + ' – gleiche Nummer', !!f && b.nr === f.nr, { backend: b.nr, frontend: f && f.nr });
    check('1: Stufe ' + (i + 1) + ' – gleicher Schlüssel', !!f && b.key === f.key, { backend: b.key, frontend: f && f.key });
    check('1: Stufe ' + (i + 1) + ' – gleiche Schwelle', !!f && b.schwelle === f.schwelle, { backend: b.schwelle, frontend: f && f.schwelle });
    check('1: Stufe ' + (i + 1) + ' – gleicher Name', !!f && b.name === f.name, { backend: b.name, frontend: f && f.name });
  }
  // Die Leiter muss aufsteigend sein - sonst liefert die "letzter Treffer"-Schleife auf beiden
  // Seiten etwas anderes, je nachdem wie sie durchläuft.
  const steigend = (l) => l.every((g, i) => i === 0 || g.schwelle > l[i - 1].schwelle);
  check('1: die Schwellen steigen streng an (Backend)', steigend(beGrade), beGrade.map(g => g.schwelle));
  check('1: die Schwellen steigen streng an (Frontend)', steigend(feGrade), feGrade.map(g => g.schwelle));
  check('1: die Nummern sind 1..6 in Reihenfolge',
    beGrade.every((g, i) => g.nr === i + 1), beGrade.map(g => g.nr));
}

// ---- 2. Dieselben Preise und Schranken -----------------------------------------------------------
{
  const feKeys = feLager.map(p => p.key).sort();
  const beKeys = Object.keys(beLager).sort();
  check('2: beide Seiten kennen dieselben Posten',
    JSON.stringify(feKeys) === JSON.stringify(beKeys), { frontend: feKeys, backend: beKeys });
  for (const p of feLager) {
    const b = beLager[p.key];
    if (!b) { check('2: ' + p.key + ' ist dem Server bekannt', false); continue; }
    check('2: ' + p.key + ' – gleicher Preis', b.kosten === p.kosten, { backend: b.kosten, frontend: p.kosten });
    check('2: ' + p.key + ' – gleiche Dienstgrad-Schranke', b.grad === p.grad, { backend: b.grad, frontend: p.grad });
    check('2: ' + p.key + ' – die Schranke gibt es als Stufe', p.grad >= 1 && p.grad <= beGrade.length, p.grad);
  }
}

// ---- 3. Jeder Posten ist vollständig beschrieben ------------------------------------------------
// Hausregel 7: Jeder neue Inhalt braucht Icon UND eine vollständige, selbsterklärende Beschreibung -
// kein Kürzel. Geprüft wird die REGEL (Satzform, Mindestlänge), nicht ein bestimmter Wortlaut.
{
  const whitelist = new Set((fe.match(/\.ti-[a-z0-9-]+:before/g) || []).map(x => x.slice(1).replace(':before', '')));
  check('3: die Icon-Whitelist wurde gelesen', whitelist.size > 30, whitelist.size);
  for (const p of feLager) {
    check('3: ' + p.key + ' hat ein Icon aus der Whitelist', whitelist.has(p.icon), p.icon);
    check('3: ' + p.key + ' hat einen Namen', typeof p.name === 'string' && p.name.length >= 4, p.name);
    check('3: ' + p.key + ' hat eine vollständige Beschreibung',
      typeof p.desc === 'string' && p.desc.length >= 60 && /[.!]$/.test(p.desc.trim()),
      p.desc && { laenge: p.desc.length, ende: p.desc.trim().slice(-1) });
    check('3: ' + p.key + ' liefert etwas', typeof p.gib === 'function');
  }
  // Ein Posten, der scheitern KANN, muss einen eigenen Fehlertext haben - die Marken sind dann
  // schon abgebucht, und ein Spieler ohne Erklärung hielte das für einen Verlust ohne Grund.
  for (const p of feLager) {
    const kannScheitern = /return sig \?|\? \(/.test(String(p.gib));
    if (kannScheitern) check('3: ' + p.key + ' erklärt den Fehlschlag', typeof p.fehler === 'string' && p.fehler.length > 20, p.fehler);
  }
}

// ---- 4. Die Mechanik ist serverseitig verdrahtet ---------------------------------------------------
{
  check('4: Dienstpunkte und Marken hängen an rkBeitrag, nicht an den Endpunkten',
    /rkGutschrift\(rk, userId, seiteId, wirksam\);/.test(be)
    && (be.match(/rkGutschrift\(/g) || []).length === 2,
    (be.match(/rkGutschrift\(/g) || []).length);
  check('4: gutgeschrieben wird der WIRKSAME Wert', !/rkGutschrift\([^)]*rohPunkte/.test(be));
  check('4: das Wochenkonto benutzt den Server-Wochenschlüssel', /rk\.woche\.stempel !== woche/.test(be) && /serverWeekKey\(Date\.now\(\)\)/.test(be));
  check('4: der Markenbestand liegt im Weltzustand, nicht im privaten Bereich',
    /rk\.marken\[userId\]/.test(be) && !/__frontmarken|__rkMarken/.test(be));
  const start = be.indexOf("app.post('/api/randkriege/lager'");
  const stop = be.indexOf('\n});', start);
  check('4: der Lager-Endpunkt ist abgegrenzt', start > 0 && stop > start, { start, stop });
  const block = (start > 0 && stop > start) ? be.slice(start, stop) : '';
  check('4: der Preis kommt aus RK_LAGER, nicht aus dem Request', /def\.kosten/.test(block) && !/req\.body[^)]*kosten/.test(block));
  check('4: der Dienstgrad wird geprüft', /rkBesterGrad\(rk, req\.userId\)/.test(block) && /grad < def\.grad/.test(block));
  check('4: der Bestand wird geprüft, bevor abgebucht wird',
    block.indexOf('bestand < def.kosten') < block.indexOf('rk.marken[req.userId] = bestand - def.kosten'));
}

// ---- 5. Die Zahlen stehen auch im Hilfetext ------------------------------------------------------
// Vierte Anzeigestelle derselben Größe (Hausregel 6).
{
  const s = fe.indexOf("{ title:'Dienstgrade und das Frontlager'");
  const e = s < 0 ? -1 : fe.indexOf('\n      { title:', s + 10);
  check('5: der Hilfe-Abschnitt ist abgegrenzt', s > 0 && e > s, { s, e });
  const hilfe = (s > 0 && e > s) ? fe.slice(s, e) : '';
  for (const g of beGrade) {
    check('5: der Hilfetext nennt ' + g.name, hilfe.includes(g.name), g.name);
    check('5: … mit der Schwelle ' + g.schwelle, hilfe.includes(g.schwelle.toLocaleString('de-DE')), g.schwelle);
  }
  check('5: der Hilfetext nennt den Umrechnungskurs', hilfe.includes(String(beMarke)), beMarke);
  check('5: … und den Wochendeckel', /zwölf|12/.test(hilfe), beWoche);
  check('5: der Wochendeckel ist auch wirklich zwölf', beWoche === 12, beWoche);
}

// ---- 6. Die Leiter ist als Langzeitziel gebaut ----------------------------------------------------
// Die Aussage „rund zwei Monate täglichen Dienstes" steht im Hilfetext und in der Patchnote. Sie
// wird hier NACHGERECHNET statt geglaubt: Der Tagesdeckel folgt aus RK_TAGESSTUFEN, die höchste
// Schwelle aus RK_DIENSTGRADE. Ändert jemand eine der beiden, fällt die Behauptung auf.
{
  const tagesDeckel = beStufen.reduce((a, st) => a + st[0] * st[1], 0);
  const tage = beGrade[beGrade.length - 1].schwelle / tagesDeckel;
  check('6: der höchste Grad dauert mindestens 30 Tage täglichen Dienstes an einer Front',
    tage >= 30, { tagesDeckel, tage: tage.toFixed(1) });
  check('6: und höchstens 90 – sonst ist es kein Ziel mehr, sondern eine Mauer',
    tage <= 90, { tage: tage.toFixed(1) });
  // Und der Wochendeckel muss erreichbar sein: zwei Fronten, sieben Tage.
  const markenMoeglich = (tagesDeckel * 2 * 7) / beMarke;
  check('6: der Wochendeckel ist erreichbar, aber nicht geschenkt',
    markenMoeglich > beWoche && markenMoeglich < beWoche * 3,
    { moeglich: markenMoeglich.toFixed(1), deckel: beWoche });
  // Der teuerste Posten muss in vertretbarer Zeit erreichbar sein.
  const teuerster = Math.max(...Object.values(beLager).map(p => p.kosten));
  check('6: der teuerste Posten ist in höchstens zwei Wochen bezahlbar', teuerster <= beWoche * 2,
    { teuerster, wochendeckel: beWoche });
}

ende();

// GEMESSENE GEGENPROBEN (10.08.2026) - jede Sabotage einzeln gefahren:
//   RK_LAGER.bergung.kosten 5 → 6 ............... „2: bergung – gleicher Preis"
//   RK_DIENSTGRADE[5].schwelle 11000 → 1100 ..... „6: der höchste Grad dauert mindestens 30 Tage"
//                                                 (und „1: Stufe 6 – gleiche Schwelle")
//   rkGutschrift mit rohPunkte statt wirksam .... „4: gutgeschrieben wird der WIRKSAME Wert"
//   Bestandsprüfung hinter die Abbuchung ........ „4: der Bestand wird geprüft, bevor abgebucht wird"
//   desc eines Postens auf ein Kürzel gekürzt ... „3: … hat eine vollständige Beschreibung"
