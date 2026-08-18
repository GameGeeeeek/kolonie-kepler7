// Primordial: die achte Modulstufe, gebunden an den Bergbau (16.08.2026).
//
// WAS AUF DEM SPIEL STEHT. Die Stufe ist der dritte Abnehmer der Tier-3-Kette und soll den Bergbau
// zwingend voraussetzen. Genau das ist leicht zu verlieren, und zwar auf einem Weg, der nirgends
// auffällt: `nextRarityOf` läuft über die REIHENFOLGE von MODULE_RARITY. Eine neue Stufe am Ende
// wird damit automatisch zum Verschmelzungsziel der vorletzten - drei Exotische ergäben ein
// primordiales Modul, ganz ohne je zum Gürtel geflogen zu sein, und die ganze Kette wäre umgangen.
// Prüfung 3 hält die Sperre fest.
//
// GEPRUEFT WIRD ausserdem:
//   1. Die Stufe steht am ENDE der Tabelle. Reihenfolge ist hier Bedeutung, nicht Geschmack: Sie
//      bestimmt die Schmelzkette UND die Rangsortierung (an mehreren Stellen Object.keys).
//   2. Die BACKEND-Kopie kennt sie mit demselben Faktor. Der Kommentar an der Frontend-Tabelle
//      warnt seit v8.443.0 wörtlich davor - ohne Eintrag zahlt der Überfall-Schutz die stärkste
//      Modulstufe des Spiels mit Faktor 1 aus, also wie ein gewöhnliches Modul.
//   4. Sie ist nicht aus Fragmenten fertigbar, HAT aber einen Zerlegewert. Beides einzeln: Das
//      erste ist die Absicht, das zweite verhindert, dass `||1` einen Unsinnswert liefert.
//   5. Die Schmiede hängt an der zweiten Tier-3-Forschung und kostet NUR Tier-3-Material - keine
//      Protomaterie, die steckt schon in den Baukosten der beiden Fabriken (doppelt gezählt wäre
//      derselbe Rohstoff zweimal).
//   6. Alle VIER Schmiede-Knöpfe gehen durch EINE Funktion. Das ist keine Stilfrage: Vorher standen
//      dort zwei fast wortgleiche Kopien, und der Kommentar in einer davon beschreibt den Schaden -
//      das Herkunfts-Schloss aus v8.356.0 war „für alle vier Schmieden" reklamiert und in einer nie
//      angekommen; alle acht Abgrund-Standortmodule liessen sich kaufen, ohne je getaucht zu sein.
//   7. Der Hilfetext LEITET seine Stufenliste aus der Tabelle ab, statt sie aufzuzählen. Vorher
//      stand dort „sieben Seltenheitsstufen" samt Namen und Prozentwerten - eine neunte Stufe
//      hätte ihn wieder zur Falschaussage gemacht.
//
// GEGENPROBE (Arbeitsregel 1), an einer Kopie über KEPLER_SPIELDATEI:
//   - Am Stand v8.530.0 fallen 1, 2, 3, 4a, 5, 6 und 7 (nichts davon existiert dort).
//   - Nimmt man die Sperre in fuseModules heraus, fällt GENAU 3.
//   - Schiebt man primordial vor exotisch, fällt GENAU 1.
//   - Setzt man protomaterie in PRIMORDIAL_CRAFT_BASE, fällt GENAU 5c (28 Prüfungen gelaufen).
//   - Liest primordialCraftCost() den Zähler nicht mehr, fallen 5d und 5e.
//   - Nimmt man das Math.min gegen PRIMORDIAL_CRAFT_MAX heraus, fällt GENAU 5e.
//   - Streicht man primordialModulesForged aus dem Prestige-Zweig, fällt GENAU 5f.
//   - Stellt man die alte, ungeschuetzte Kostenzeile wieder her UND traegt eine Ressource nur in
//     PRIMORDIAL_CRAFT_BASE ein, fällt GENAU 5c2 (unsauber: protomaterie=NaN). Genau so ist der
//     Fehler gefunden worden: Die Sabotage „protomaterie in die Kosten" lief am alten Code GRÜN
//     durch, weil Math.min(undefined, x) NaN ergibt und `!NaN` wahr ist - eine Gegenprobe, die
//     nicht anschlägt, ist der Befund, nicht der Beweis (Regel 26).
const fs = require('fs');
const path = require('path');
const { SPIELDATEI, SERVER_JS, pruefer, ueberspringen } = require('./lib/umgebung');
const { check, ende } = pruefer();

const S = fs.readFileSync(SPIELDATEI, 'utf8');
const NEU = 'primordial';

function tabelle(marke, ende_, name) {
  const v = S.indexOf(marke);
  const b = v < 0 ? -1 : S.indexOf(ende_, v);
  if (v < 0 || b < 0) { check('0-anker: ' + name, false, { v, b }); return null; }
  try { return new Function(S.slice(v, b + ende_.length) + '\nreturn ' + name + ';')(); }
  catch (e) { check('0-bau: ' + name, false, e.message); return null; }
}
const RAR = tabelle('  const MODULE_RARITY = {', '\n  };', 'MODULE_RARITY');
check('0: MODULE_RARITY wurde gelesen', !!RAR, RAR ? Object.keys(RAR) : null);
if (!RAR) return ende();

// ---- 1) Reihenfolge ist Bedeutung ------------------------------------------------------------
const reihe = Object.keys(RAR);
check('1: die neue Stufe steht am ENDE der Tabelle (Schmelzkette und Rangsortierung lesen die Reihenfolge)',
  reihe[reihe.length - 1] === NEU, reihe);
// Und sie ist wirklich die stärkste - eine Stufe am Ende mit kleinerem Faktor wäre ein stiller
// Rückschritt für jeden, der auf sie hochschmilzt.
const staerker = reihe.every((k, i) => i === 0 || RAR[k].mult > RAR[reihe[i - 1]].mult);
check('1b: die Faktoren steigen über die ganze Kette monoton', staerker,
  Object.fromEntries(reihe.map(k => [k, RAR[k].mult])));

// ---- 2) Die Backend-Kopie ---------------------------------------------------------------------
if (!SERVER_JS) {
  check('2: die Backend-Kopie wurde geprüft', false,
    'server.js nicht gefunden - dieser Test braucht das Nachbar-Repo, weil die Tabelle dort dupliziert ist');
} else {
  const B = fs.readFileSync(SERVER_JS, 'utf8');
  const m = B.match(/const MODULE_RARITY_MULT = \{([^}]*)\}/);
  let bt = null;
  try { bt = m ? new Function('return {' + m[1] + '};')() : null; } catch (e) {}
  check('2-vorab: MODULE_RARITY_MULT im Backend gelesen', !!bt, bt ? Object.keys(bt).length : null);
  if (bt) {
    // Generisch über ALLE Stufen: So fällt auch eine neunte auf, nicht nur diese eine.
    const fehlt = reihe.filter(k => bt[k] === undefined);
    const abweichend = reihe.filter(k => bt[k] !== undefined && bt[k] !== RAR[k].mult)
      .map(k => k + ': Frontend ' + RAR[k].mult + ' vs Backend ' + bt[k]);
    check('2: das Backend kennt JEDE Seltenheitsstufe (sonst zahlt der Überfall-Schutz sie mit Faktor 1 aus)',
      fehlt.length === 0, fehlt);
    check('2b: und mit denselben Faktoren', abweichend.length === 0, abweichend);
  }
}

// ---- 3) Verschmelzen führt NICHT hin ----------------------------------------------------------
/* Der eigentliche Grund für diesen Test. Ohne die Sperre wäre die stärkste Modulstufe des Spiels
   über drei Exotische erreichbar - ohne Bergbau, ohne Tier 3, ohne einen einzigen Flug. */
const vonF = S.indexOf('  function fuseModules(isShip, instKey){');
const bisF = vonF < 0 ? -1 : S.indexOf('\n  }', vonF);
check('3-anker: fuseModules ist auffindbar', vonF >= 0 && bisF > vonF);
const fuse = (vonF >= 0 && bisF > vonF) ? S.slice(vonF, bisF) : '';
check('3: der Sprung nach Primordial ist beim Verschmelzen gesperrt',
  new RegExp("if \\(next === '" + NEU + "'\\)").test(fuse));
check('3b: und die Meldung nennt den einzigen Weg beim Namen',
  /Urmaterie-Schmiede/.test(fuse.slice(fuse.indexOf("next === '" + NEU + "'"), fuse.indexOf("next === '" + NEU + "'") + 320)));

// ---- 4) Fragmente: nicht fertigbar, aber zerlegbar --------------------------------------------
const craft = (S.match(/const MODULE_FRAGMENT_CRAFT_COST = \{([^}]*)\}/) || [])[1] || '';
const wert = (S.match(/const MODULE_FRAGMENT_VALUE = \{([^}]*)\}/) || [])[1] || '';
check('4-vorab: beide Fragment-Tabellen gelesen', craft.length > 10 && wert.length > 10);
check('4a: Primordial ist NICHT aus Fragmenten fertigbar (wie Mythisch und Exotisch)',
  craft.indexOf(NEU) < 0, craft.trim().slice(0, 120));
let wt = null; try { wt = new Function('return {' + wert + '};')(); } catch (e) {}
const ohneWert = wt ? reihe.filter(k => !(k in wt)) : ['nicht lesbar'];
check('4b: JEDE Stufe hat einen Zerlegewert (sonst liefert der ||1-Notnagel einen Unsinnswert)',
  ohneWert.length === 0, ohneWert);

// ---- 5) Die Schmiede --------------------------------------------------------------------------
check('5a: sie hängt an der zweiten Tier-3-Forschung',
  /function primordialForgeUnlocked\(\)\{ return \(state\.research\.rkausalanker\|\|0\) >= 1; \}/.test(S));
/* Seit v8.556.0 sind die Kosten PROGRESSIV (Etappe C des Wirtschafts-Rebalance): eine Funktion
   ueber state.primordialModulesForged statt einer festen Tabelle. Geprueft wird deshalb der
   AUSGEFUEHRTE Block (Regel 43) und die Regel an BEIDEN Enden - beim ersten Modul und am Deckel.
   Ein Test, der nur den Anfangspreis liest, saehe eine spaeter eingeschleuste Protomaterie-
   Forderung nicht, wenn sie erst mit der Stueckzahl dazukaeme. */
let kostenApi = null;
try {
  const von = S.indexOf('const PRIMORDIAL_CRAFT_BASE');
  const bis = S.indexOf('function primordialForgeUnlocked');
  kostenApi = (von >= 0 && bis > von)
    ? new Function('state', S.slice(von, bis) + '; return { primordialCraftCost, PRIMORDIAL_CRAFT_BASE, PRIMORDIAL_CRAFT_JE, PRIMORDIAL_CRAFT_MAX };')
    : null;
} catch (e) { kostenApi = null; }
check('5-bau: der Kostenblock der Schmiede laesst sich ausfuehren', !!kostenApi);
if (kostenApi){
  const bei = n => { const st = { primordialModulesForged: n }; const api = kostenApi(st); return { api, kosten: api.primordialCraftCost() }; };
  const erstes = bei(0), amDeckel = bei(500);
  check('5b: sie kostet BEIDE Tier-3-Ressourcen',
    erstes.kosten.hohlraumgitter > 0 && erstes.kosten.kausalanker > 0, erstes.kosten);
  check('5c: und KEINE Protomaterie - die steckt schon in den Baukosten der beiden Fabriken',
    !erstes.kosten.protomaterie && !amDeckel.kosten.protomaterie,
    { erstes: erstes.kosten, amDeckel: amDeckel.kosten });
  /* JEDER Posten muss eine endliche positive Zahl sein. Das ist keine Formalie: Beim Bau lieferte
     eine Ressource, die nur in BASE steht, `Math.min(undefined, x)` = NaN - und `!NaN` ist wahr,
     die Pruefung darueber haette das durchgewinkt. Ein NaN in den Kosten landet ueber
     payPrimordialCraft() im Spielstand, und ein NaN im Spielstand laesst den Backend-Sanity-Check
     den GANZEN Stand ablehnen (Vorfall 21.07.2026). Gefunden hat das die Gegenprobe, nicht der
     Code-Blick. */
  const unsauber = [...Object.entries(erstes.kosten), ...Object.entries(amDeckel.kosten)]
    .filter(([k, v]) => !Number.isFinite(v) || v <= 0).map(([k, v]) => k + '=' + v);
  check('5c2: jeder Kostenposten ist eine endliche positive Zahl (kein NaN in den Spielstand)',
    unsauber.length === 0, { unsauber, erstes: erstes.kosten, amDeckel: amDeckel.kosten });
  // Die neue Eigenschaft selbst: Der Preis STEIGT und ist GEDECKELT. Beide Richtungen, sonst
  // waere ein versehentlich konstanter Preis (Zaehler nie gelesen) genauso gruen.
  check('5d: der Preis steigt mit der Zahl der bereits gefertigten Module',
    bei(6).kosten.hohlraumgitter > erstes.kosten.hohlraumgitter &&
    bei(6).kosten.kausalanker > erstes.kosten.kausalanker,
    { nach0: erstes.kosten, nach6: bei(6).kosten });
  check('5e: und er ist gedeckelt - der Deckel wird erreicht und nicht ueberschritten',
    amDeckel.kosten.hohlraumgitter === erstes.api.PRIMORDIAL_CRAFT_MAX.hohlraumgitter &&
    amDeckel.kosten.kausalanker === erstes.api.PRIMORDIAL_CRAFT_MAX.kausalanker,
    { amDeckel: amDeckel.kosten, deckel: erstes.api.PRIMORDIAL_CRAFT_MAX });
  // Der Zaehler ist die Zahl der je GESCHMIEDETEN Module. Waere er der Inventarbestand, waere
  // Ausruesten oder Verschmelzen eine Preissenkung - deshalb muss er das Prestige ueberleben,
  // das die Module selbst behaelt (keepModules). Der Aufstieg-Zweig loescht beide, dort nicht.
  const prestigeBlock = (() => {
    const i = S.indexOf('credits: 250 + prestigeStartLvl*100');
    return i < 0 ? '' : S.slice(Math.max(0, i - 3000), i);
  })();
  check('5f: der Zaehler ueberlebt das Prestige (sonst waere Prestige eine Preissenkung)',
    /primordialModulesForged: state\.primordialModulesForged/.test(prestigeBlock),
    { blockGefunden: prestigeBlock.length > 0 });
}

// ---- 6) Ein Weg, nicht vier -------------------------------------------------------------------
/* Die vier Knöpfe (Standort/Schiff × mythisch/primordial) müssen durch DIESELBE Funktion laufen.
   Geprüft wird nicht der Stil, sondern die Folge: Die Herkunfts-Sperren stehen nur dort, und beim
   letzten Mal hat eine Kopie sie verschluckt. */
const einstiege = ['craftMythicLocationModule', 'craftMythicShipModule', 'craftPrimordialLocationModule', 'craftPrimordialShipModule'];
const nichtDelegiert = einstiege.filter(fn => {
  const i = S.indexOf('function ' + fn + '(defKey){');
  return i < 0 || S.slice(i, i + 200).indexOf('craftForgedModule(') < 0;
});
check('6a: alle vier Schmiede-Einstiege delegieren an craftForgedModule', nichtDelegiert.length === 0, nichtDelegiert);
const vonC = S.indexOf('  function craftForgedModule(isShip, defKey, plan){');
const bisC = vonC < 0 ? -1 : S.indexOf('\n  }', vonC);
const kern = (vonC >= 0 && bisC > vonC) ? S.slice(vonC, bisC) : '';
check('6b-anker: craftForgedModule ist auffindbar', kern.length > 200);
check('6b: und trägt beide Herkunfts-Sperren (Abgrund und Unikat)',
  /HERKUNFT_ABGRUND/.test(kern) && /HERKUNFT_UNIKAT/.test(kern));
// Die Knöpfe müssen auch verdrahtet sein - ein Knopf ohne Handler ist eine tote Fläche.
for (const attr of ['data-craft-primordial-loc', 'data-craft-primordial-ship']) {
  const imMarkup = S.indexOf('<button ' + attr + '=') >= 0;
  const imHandler = S.indexOf("querySelectorAll('[" + attr + "]')") >= 0;
  check('6c: ' + attr + ' ist als Knopf UND als Handler da', imMarkup && imHandler, { imMarkup, imHandler });
}

// ---- 7) Der Hilfetext kann nicht mehr veralten ------------------------------------------------
check('7: der Hilfe-Abschnitt leitet seine Stufenliste aus MODULE_RARITY ab, statt sie aufzuzählen',
  /Ausrüstbare Module mit ' \+ Object\.keys\(MODULE_RARITY\)\.length \+ ' Seltenheitsstufen/.test(S));
// Gescopt auf die LIVE-Texte: Der Patchnote-Eintrag zu v8.532.0 zitiert die alte Formulierung
// als Beschreibung des Umbaus, und Patchnotes sind unveraenderliche Historie (Hausregel 6/33).
const pnA = S.indexOf('const PATCHNOTES = [');
const pnEnde = pnA >= 0 ? S.slice(pnA).search(/\n\s*\];/) : -1;
check('7b-vorab: der PATCHNOTES-Block ist auffindbar (fuer die gescopte Negativpruefung)',
  pnA > 0 && pnEnde > 0, { pnA, pnEnde });
const SohneNotes = (pnA > 0 && pnEnde > 0) ? S.slice(0, pnA) + S.slice(pnA + pnEnde) : S;
check('7b: und es steht keine feste Stufenzahl mehr daneben',
  !/sieben Seltenheitsstufen/.test(SohneNotes));

ende();
