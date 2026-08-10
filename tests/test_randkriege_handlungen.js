// Die fünf Handlungen an der Front: Meinen Frontend und Backend dieselben Zahlen – und stimmen die
// Zähler, an denen sie hängen, überhaupt mit dem überein, was der Server abliest?
//
// Warum genau das die riskante Stelle ist: Vier der fünf Handlungen werden über die DIFFERENZ eines
// Lebenszeit-Zählers im Spielstand gemessen. Der Server liest dafür `save[<feldname>]`. Ein Tippfehler
// im Feldnamen erzeugt keinen Fehler, sondern eine stille Null – die Handlung gäbe dann für immer
// „nichts offen" zurück, ohne dass irgendwo etwas rot würde. Dieser Test verbindet beide Seiten.
//
// Dazu die klassische zweite Anzeigestelle (Hausregel 6): Gewichte und Kosten stehen im Backend,
// werden im Frontend nur ANGEZEIGT und zusätzlich im Hilfetext genannt. Drei Orte für dieselbe Zahl –
// hier werden sie gegeneinander geprüft. Die Patchnote bleibt bewusst außen vor (Begründung in
// Abschnitt 5): Sie ist unveränderliche Historie und darf nicht nachträglich mitgezogen werden.
//
// GEGENPROBE (beide Richtungen, 10.08.2026):
//   Alter Stand (`git show HEAD:weltraum_kolonie.html`): FRONT_HANDLUNGEN existiert nicht, der Test
//   bricht an „FRONT_HANDLUNGEN gefunden" ab.
//   Gezielt kaputtgemacht, jeweils genau die erwartete Prüfung rot – die gemessenen Ergebnisse
//   stehen am Ende dieser Datei, nicht meine Vorhersage.

const { SERVER_JS, ueberspringen, pruefer, SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

if (!SERVER_JS) ueberspringen('Prüft Backend-Code - das Backend-Repo (kolonie-kepler7-backend) liegt hier nicht daneben.');

const { check, ende } = pruefer();
const be = fs.readFileSync(process.env.KEPLER_BACKEND_SERVER || SERVER_JS, 'utf8');
const fe = fs.readFileSync(SPIELDATEI, 'utf8');

// ---- Beide Listen aus den echten Dateien holen --------------------------------------------------
function objektNach(quelle, name, oeffner, schliesser) {
  const start = quelle.indexOf('const ' + name + ' = ' + oeffner);
  if (start < 0) return null;
  // Klammern zählen statt einer Regex zu vertrauen: Beide Listen enthalten geschweifte Klammern in
  // ihren Einträgen, eine naive Regex würde am ersten inneren `}` abbrechen (bekannter Fallstrick).
  let tiefe = 0, i = quelle.indexOf(oeffner, start);
  for (; i < quelle.length; i++) {
    const c = quelle[i];
    if (c === oeffner) tiefe++;
    else if (c === schliesser) { tiefe--; if (tiefe === 0) break; }
  }
  if (tiefe !== 0) return null;
  const literal = quelle.slice(quelle.indexOf(oeffner, start), i + 1);
  try { return new Function('return ' + literal + ';')(); } catch (e) { return null; }
}

const beHandlungen = objektNach(be, 'RK_HANDLUNGEN', '{', '}');
const feHandlungen = objektNach(fe, 'FRONT_HANDLUNGEN', '[', ']');
const beKosten = objektNach(be, 'RK_NACHSCHUB_KOSTEN', '{', '}');
const feKosten = objektNach(fe, 'FRONT_NACHSCHUB_KOSTEN', '{', '}');
check('RK_HANDLUNGEN gefunden', !!beHandlungen && Object.keys(beHandlungen).length >= 4, beHandlungen && Object.keys(beHandlungen));
check('FRONT_HANDLUNGEN gefunden', Array.isArray(feHandlungen) && feHandlungen.length >= 4, feHandlungen && feHandlungen.length);
check('RK_NACHSCHUB_KOSTEN gefunden', !!beKosten, beKosten);
check('FRONT_NACHSCHUB_KOSTEN gefunden', !!feKosten, feKosten);
if (!beHandlungen || !feHandlungen || !beKosten || !feKosten) ende();

function zahlAus(quelle, name) {
  // `^\\s*const`, nicht `^const`: Im Frontend stehen die Konstanten zwei Leerzeichen eingerückt
  // (alles liegt in einer IIFE). Der erste Versuch fand FRONT_NACHSCHUB_PUNKTE deshalb nicht und
  // meldete einen Zahlenunterschied, den es gar nicht gab.
  const m = quelle.match(new RegExp('^\\s*const ' + name + ' = ([^;]+);', 'm'));
  if (!m) return null;
  try { return new Function('return ' + m[1] + ';')(); } catch (e) { return null; }
}
const bePunkte = zahlAus(be, 'RK_NACHSCHUB_PUNKTE');
const fePunkte = zahlAus(fe, 'FRONT_NACHSCHUB_PUNKTE');
const beSperre = zahlAus(be, 'RK_NACHSCHUB_SPERRE_MS');
const beBollwerk = zahlAus(be, 'RK_BOLLWERK_ERFOLG');
const beStufen = objektNach(be, 'RK_TAGESSTUFEN', '[', ']');

// ---- 1. Dieselben Handlungen, dieselben Zahlen --------------------------------------------------
{
  const beArten = Object.keys(beHandlungen).sort();
  const feArten = feHandlungen.map(h => h.art).sort();
  check('1: beide Seiten kennen dieselben Handlungen',
    JSON.stringify(beArten) === JSON.stringify(feArten), { backend: beArten, frontend: feArten });
  for (const h of feHandlungen) {
    const b = beHandlungen[h.art];
    if (!b) { check('1: ' + h.art + ' ist dem Server bekannt', false); continue; }
    check('1: ' + h.art + ' – gleicher Zähler', b.feld === h.feld, { backend: b.feld, frontend: h.feld });
    check('1: ' + h.art + ' – gleiche Einheit', b.einheit === h.einheit, { backend: b.einheit, frontend: h.einheit });
    check('1: ' + h.art + ' – gleiches Gewicht', b.punkte === h.punkte, { backend: b.punkte, frontend: h.punkte });
  }
  check('1: Nachschubkosten stimmen überein',
    JSON.stringify(beKosten) === JSON.stringify(feKosten), { backend: beKosten, frontend: feKosten });
  check('1: Nachschubgewicht stimmt überein', bePunkte === fePunkte, { backend: bePunkte, frontend: fePunkte });
  // Die Sperrzeit steht im Frontend nur als Rechenausdruck in der Anzeige - sie muss dieselbe sein,
  // sonst zeigt der Countdown eine Bereitschaft an, die der Server noch ablehnt.
  const feSperreStd = (fe.match(/nachschubZuletzt \|\| 0;\s*\n\s*const wartet = Math\.max\(0, zuletzt \+ (\d+)\*3600\*1000/) || [])[1];
  check('1: dieselbe Sperrzeit in der Anzeige', Number(feSperreStd) * 3600 * 1000 === beSperre,
    { frontendStunden: feSperreStd, backendMs: beSperre });
}

// ---- 2. Die Zähler gibt es im Spielstand wirklich ------------------------------------------------
// Das ist der Kern: Ein Feldname, den der Server abliest, den das Spiel aber nie schreibt, liefert
// stumm 0. Geprüft wird deshalb für JEDEN Träger, dass er im Frontend erhöht wird.
{
  for (const [art, b] of Object.entries(beHandlungen)) {
    const erhoeht = new RegExp('state\\.' + b.feld + '\\s*=\\s*\\(state\\.' + b.feld + '\\s*\\|\\|\\s*0\\)\\s*\\+').test(fe)
      || new RegExp('state\\.' + b.feld + '\\s*\\+=').test(fe);
    check('2: ' + art + ' – der Zähler ' + b.feld + ' wird im Spiel erhöht', erhoeht, b.feld);
  }
  // Und die beiden NEUEN Zähler stehen in applyStateDefaults - sonst wären sie nach Prestige,
  // Aufstieg oder dem Zurücksetzen-Knopf undefined statt 0.
  const start = fe.indexOf('function applyStateDefaults(){');
  const stop = fe.indexOf('\n  function ', start + 10);
  check('2: applyStateDefaults ist abgegrenzt', start > 0 && stop > start, { start, stop });
  const defaults = (start > 0 && stop > start) ? fe.slice(start, stop) : '';
  for (const feld of ['piratennesterGeraeumt', 'fundmeldungenGesamt']) {
    check('2: ' + feld + ' hat einen Vorgabewert', defaults.includes(feld), feld);
  }
  // Genau EINE Erhöhungsstelle je neuem Zähler - zwei wären eine Doppelzählung, und die fiele
  // sonst niemandem auf.
  for (const feld of ['piratennesterGeraeumt', 'fundmeldungenGesamt']) {
    const n = (fe.match(new RegExp('state\\.' + feld + ' = \\(state\\.' + feld + '\\|\\|0\\) \\+ 1', 'g')) || []).length;
    check('2: ' + feld + ' wird an genau einer Stelle erhöht', n === 1, n);
  }
}

// ---- 3. Die Gewichtsordnung des Entwurfs hält ----------------------------------------------------
// Das Bollwerk ist die einzige server-autoritative Handlung und muss deshalb schwerer wiegen als
// jede der clientseitig gemessenen. Kippt das, ist die ganze Begründung der Gewichte hinfällig.
{
  const groesstes = Math.max(...Object.values(beHandlungen).map(h => h.punkte), bePunkte);
  check('3: das Bollwerk wiegt schwerer als jede andere Handlung', beBollwerk > groesstes,
    { bollwerk: beBollwerk, groessteAndere: groesstes });
  // Und keine Handlung darf für sich allein den Tagesdeckel sprengen, sonst wäre die Degression
  // wirkungslos.
  const breite = beStufen.reduce((a, st) => a + st[0], 0);
  for (const [art, h] of Object.entries(beHandlungen)) {
    check('3: ' + art + ' schöpft den Tag nicht mit einer einzigen Einheit aus', h.punkte < breite,
      { punkte: h.punkte, tagesbreite: breite });
  }
}

// ---- 4. Der Endpunkt hängt richtig zusammen ------------------------------------------------------
{
  const start = be.indexOf("app.post('/api/randkriege/handlung'");
  const stop = be.indexOf('\n});', start);
  check('4: der Endpunkt ist abgegrenzt', start > 0 && stop > start, { start, stop });
  const block = (start > 0 && stop > start) ? be.slice(start, stop) : '';
  check('4: der Basiswert liegt im privaten Serverbereich, nicht im Spielstand',
    /rkBasisVon\(req\.userId\)/.test(block) && /__rkBasis/.test(be) && !/save\.__rkBasis/.test(be));
  check('4: Rücksetzung des Zählers wird erkannt', /if \(jetzt < gemerkt\)/.test(block));
  check('4: und dabei nichts gutgeschrieben', /grund: 'zurueckgesetzt'/.test(block));
  check('4: der Basiswert wandert erst NACH einer angenommenen Buchung mit',
    block.indexOf('rkBeitrag(') < block.lastIndexOf('basis[def.feld] = gemerkt'), {
      rkBeitrag: block.indexOf('rkBeitrag('), basis: block.lastIndexOf('basis[def.feld] = gemerkt') });
  check('4: eine nicht aufgebaute Front verbraucht nichts',
    (block.match(/return res\.status\(409\)/g) || []).length === 2);
  check('4: der Ertrag wird VOR dem Abbuchen der Rohstoffe geprüft',
    block.indexOf('rkVorschau') < block.indexOf('save.resources[r] -= menge'), {
      vorschau: block.indexOf('rkVorschau'), abbuchen: block.indexOf('save.resources[r] -= menge') });
  check('4: die Nachschub-Sperrzeit wird serverseitig geführt', /__rkNachschubAt/.test(block));
  check('4: der geänderte Spielstand geht mit neuer Version zurück',
    /setSaveValue\(req\.userId, JSON\.stringify\(save\)\)/.test(block) && /saveVersion/.test(block));
}

// ---- 5. Vierter und fünfter Ort derselben Zahlen: Hilfe und Patchnote ----------------------------
{
  const s = fe.indexOf("{ title:'Was du sonst an die Front liefern kannst'");
  const e = s < 0 ? -1 : fe.indexOf('\n      { title:', s + 10);
  check('5: der Hilfe-Abschnitt ist abgegrenzt', s > 0 && e > s, { s, e });
  const hilfe = (s > 0 && e > s) ? fe.slice(s, e) : '';
  for (const [art, h] of Object.entries(beHandlungen)) {
    check('5: der Hilfetext nennt das Gewicht von ' + art, hilfe.includes(String(h.punkte)), h.punkte);
  }
  check('5: und das des Nachschubs', hilfe.includes(String(bePunkte)), bePunkte);
  for (const [r, menge] of Object.entries(beKosten)) {
    check('5: der Hilfetext nennt die Kosten ' + r, hilfe.includes(menge.toLocaleString('de-DE')), menge);
  }
  // Die Patchnote wird geprüft - aber als REGEL, nicht als Momentaufnahme (Arbeitsregel 3).
  //
  // Hier stand zuerst „die OBERSTE Patchnote nennt dieselben Gewichte". Das setzt voraus, dass die
  // oberste die eigene ist, und gilt genau bis zur nächsten Version: v8.477.0 (weicher Deckel im
  // PvP) schob sich davor, und der Test wurde auf völlig korrektem Code rot. Mein zweiter Anlauf
  // war, die Prüfung ganz zu streichen - mit der Begründung, sie ließe sich nur durch ein
  // rückwirkendes Editieren der Historie grün halten. Das war falsch: In einer parallelen Sitzung
  // ist am Schwestertest (test_randkriege_beitrag.js, Abschnitt G3) die bessere Lösung entstanden,
  // und die steht jetzt auch hier. Geprüft wird, dass IRGENDEIN Eintrag alle Gewichte zusammen
  // nennt. Ändern sich die Zahlen im Code, findet sich kein Eintrag mehr - es muss also eine neue
  // Patchnote geschrieben werden, statt eine alte umzuschreiben.
  const eintraege = fe.match(/\{ version:'[\d.]+', date:'[^']*', changes:\[[\s\S]{0,8000}?\n    \]\},/g) || [];
  check('5: es wurden Patchnote-Einträge gefunden', eintraege.length > 10, eintraege.length);
  const alleGewichte = Object.values(beHandlungen).map(h => String(h.punkte)).concat(String(bePunkte));
  check('5: ein Patchnote-Eintrag nennt alle Gewichte zusammen',
    eintraege.some(t => alleGewichte.every(z => t.includes(z))), alleGewichte);
}

// ---- 6. Der gestrichene Konvoi steht nicht mehr als Routen-Tick da -------------------------------
// Der Entwurf wollte „1 Kriegspunkt je Routen-Tick". Handelsrouten sind im Spiel ausdrücklich passiv
// gebaut („bewusst kein Kampf-/Eskorte-System"); ein Punkt je Tick hätte den Tagesdeckel in einer
// Viertelstunde ohne eine einzige Entscheidung ausgeschöpft. Gezählt wird stattdessen der Ertrag.
{
  const konvoi = beHandlungen.konvoi;
  check('6: der Konvoi hängt am Ertrag, nicht am Takt',
    !!konvoi && konvoi.feld === 'tradeRouteLifetimeCredits' && konvoi.einheit >= 100, konvoi);
  check('6: der Bau-Grundsatz "Routen bleiben passiv" steht unverändert im Code',
    /bewusst kein Kampf-\/\n?\s*\/\/ Eskorte-System \(Routen bleiben passiv\)/.test(fe)
    || fe.includes('Eskorte-System (Routen bleiben passiv)'));
}

ende();

// GEMESSENE GEGENPROBEN (10.08.2026), jeweils eine Sabotage, dann der Testlauf:
//   RK_HANDLUNGEN.konvoi.punkte 25 → 26 .......... „1: konvoi – gleiches Gewicht"
//   RK_HANDLUNGEN.fundmeldung.feld auf einen
//     Namen, den das Spiel nicht schreibt ........ „2: fundmeldung – der Zähler ... wird erhöht"
//   RK_BOLLWERK_ERFOLG 250 → 30 .................. „3: das Bollwerk wiegt schwerer ..."
//   `basis[def.feld] = ...` VOR rkBeitrag ........ „4: der Basiswert wandert erst NACH ..."
//   rkVorschau-Wache im Nachschub entfernt ....... „4: der Ertrag wird VOR dem Abbuchen geprüft"
