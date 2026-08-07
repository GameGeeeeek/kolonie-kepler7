// Zweite Abgrund-Modulrunde (v8.356.0) - und die zwei Fehler, die beim Entwurf dazu auffielen.
//
// DIE ZWEI FEHLER, die dieser Test dauerhaft festnagelt. Beide sind live gewesen, beide gegenlaeufig:
//
//   A) DIE SECHS ABGRUND-SCHIFFSMODULE SIND NIE GEFALLEN. grantAbgrundModule() zog ausschliesslich
//      aus MODULE_DEFS. Die ab_*-Module tragen quelle:'abgrund' und sind damit aus jedem normalen
//      Pool ausgeschlossen - es gab also keinen einzigen Weg, sie zu bekommen, obwohl die Patchnote
//      zu v8.335.0 "Klassen-Module, die nur bei Tauchgängen fallen" verspricht. Zwoelf Tage tote
//      Inhalte, die niemand vermisst hat, weil man ihr Fehlen nicht sieht.
//   B) UND GLEICHZEITIG WAREN SIE FERTIGBAR. Die vier Schmiedelisten filterten nach klasse und
//      craftOnly, nicht nach quelle - Zeile 42485 bot sogar schlicht alle MODULE_DEFS an. Wer nie
//      getaucht war, konnte sich jedes der zehn Abgrund-Module aus Modulfragmenten bauen. Das
//      Herkunfts-Schloss aus v8.332.0 war an genau dieser Stelle wirkungslos.
//
// Der Test prueft deshalb BEIDE Richtungen: dass die Module fallen, und dass sie sich nicht
// nachbauen lassen. Eine Sperre nur in der Liste zaehlt dabei nicht - eine Liste, die einen Knopf
// weglaesst, ist keine Sperre; der Handler muss es auch pruefen.
//
// Dazu die sechs neuen selbst: eigene Fundstufe, Verrechnungsstelle, Deckel, Icon, Beschreibung.
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

// Ein Array-Literal ausfuehrbar herausschneiden (Klammern zaehlen statt Regex - die desc-Texte
// enthalten Klammern und Anfuehrungszeichen, eine naive Regex terminiert daran falsch).
function arrAus(name){
  const i = js.indexOf('const '+name+' = [');
  if (i < 0) throw new Error('Array nicht gefunden: '+name);
  let d = 0, s = js.indexOf('[', i), k = s;
  for (; k < js.length; k++){ if (js[k]==='[') d++; else if (js[k]===']'){ d--; if(!d) break; } }
  return new Function("const HERKUNFT_ABGRUND='abgrund', HERKUNFT_BOSS='boss'; return "+js.slice(s, k+1)+';')();
}
const MODULE_DEFS = arrAus('MODULE_DEFS');
const SHIP_MODULE_DEFS = arrAus('SHIP_MODULE_DEFS');
const abgrundStandort = MODULE_DEFS.filter(d => d.quelle === 'abgrund');
const abgrundSchiff = SHIP_MODULE_DEFS.filter(d => d.quelle === 'abgrund');

// ---------------------------------------------------------------- 1. Bestand
check('Abgrund-Standortmodule gelesen', abgrundStandort.length === 8, abgrundStandort.map(d=>d.key));
check('Abgrund-Schiffsmodule gelesen', abgrundSchiff.length === 8, abgrundSchiff.map(d=>d.key));
const neueKeys = ['taktschmiede','krustenpresse','wrackleser','prisenwaage','ab_drucklot','ab_ballastspiegel'];
for (const k of neueKeys){
  const def = MODULE_DEFS.concat(SHIP_MODULE_DEFS).find(d => d.key === k);
  check('neues Modul vorhanden: '+k, !!def);
  if (!def) continue;
  check(k+': stammt aus dem Abgrund', def.quelle === 'abgrund');
  // Regel 7: eigenes Icon (kein ti-*-Notnagel) und eine vollstaendige Beschreibung.
  check(k+': hat ein eigenes gezeichnetes Icon', typeof def.icon === 'string' && !def.icon.startsWith('ti-'), def.icon);
  check(k+': das Icon ist in ICONS hinterlegt', js.indexOf('    '+def.icon+': `') > 0);
  check(k+': hat eine vollstaendige Beschreibung', typeof def.desc === 'string' && def.desc.length >= 140);
  check(k+': die Beschreibung nennt den Deckel oder die Nicht-Stapelbarkeit',
    /gedeckelt|deckel|bis −|bis \+|stapelt nicht/i.test(def.desc));
}

// ---------------------------------------------------------------- 2. Eigene Fundstufe
for (const k of neueKeys){
  const def = MODULE_DEFS.concat(SHIP_MODULE_DEFS).find(d => d.key === k);
  check(k+': faellt erst ab einer Mindesttiefe', def && def.minTiefe === 40, def && def.minTiefe);
}
// Die zehn alten duerfen KEINE Mindesttiefe bekommen haben - sonst waere die zweite Fundstufe
// nachtraeglich auch fuer sie gezogen worden und ein Anfaenger fande gar nichts mehr.
const alteMitSchranke = abgrundStandort.concat(abgrundSchiff)
  .filter(d => !neueKeys.includes(d.key) && d.minTiefe);
check('die zehn vorhandenen Module bleiben ohne Mindesttiefe', alteMitSchranke.length === 0,
  alteMitSchranke.map(d=>d.key));
check('fundPool() kennt die Mindesttiefe', /if \(d\.minTiefe && o\.tiefe !== undefined && \(o\.tiefe\|\|0\) < d\.minTiefe\) return false;/.test(js));
// Ohne uebergebene Tiefe darf die Schranke NICHT greifen - sonst verschwaenden die Module aus
// Kompendium und Schmiede-Anzeigen, wo es gar nicht ums Finden geht.
check('ohne Tiefe greift die Schranke bewusst nicht', /o\.tiefe !== undefined/.test(js));

// ---------------------------------------------------------------- 3. Fehler A: der Fundweg
check('grantAbgrundModule zieht aus BEIDEN Toepfen',
  /const standort = fundPool\(MODULE_DEFS, \{ quelle: HERKUNFT_ABGRUND, tiefe: t \}\);/.test(js)
  && /const schiff = fundPool\(SHIP_MODULE_DEFS, \{ quelle: HERKUNFT_ABGRUND, tiefe: t \}\);/.test(js));
// Gleichverteilt ueber alle Module, nicht 50/50 ueber die Toepfe: Sonst waere ein einzelnes
// Schiffsmodul haeufiger als ein einzelnes Standortmodul, nur weil sein Topf kleiner ist.
check('gleichverteilt ueber alle Module, nicht 50/50 ueber die Toepfe',
  /const alle = standort\.concat\(schiff\);/.test(js));
check('der Fund landet im richtigen Inventar',
  /const inv = istSchiff \? state\.shipModules : state\.modules;/.test(js));
check('und die Seltenheits-Substats kennen die Modulart', /rollModuleSubs\(rarity, istSchiff, gezogen\.effect\)/.test(js));
// Es bleibt EIN Fund je Tauchgang - die Chance darf sich nicht nebenbei verdoppelt haben.
check('es gibt weiterhin nur einen Fundaufruf je Tauchgang',
  (js.match(/grantAbgrundModule\(/g) || []).length === 2);

// ---------------------------------------------------------------- 4. Fehler B: das Schloss
check('die Standort-Schmelze filtert ueber fundPool', /fundPool\(MODULE_DEFS\)\.map\(def =>/.test(js));
check('die Schiffs-Schmelze ebenso', /fundPool\(SHIP_MODULE_DEFS\)\.filter\(d=>d\.klasse===klasse\)/.test(js));
check('die mythische SCHIFFS-Schmiede ebenso',
  (js.match(/fundPool\(SHIP_MODULE_DEFS\)\.filter\(d=>d\.klasse===klasse\)/g) || []).length === 2);
// Die VIERTE Liste - nachgetragen am 01.08.2026, weil sie hier gefehlt hat.
//
// Dieser Test behauptete mit "die mythische Schmiede ebenso" seine Vollstaendigkeit, zaehlte aber
// zweimal dieselbe SCHIFFS-Konstruktion (Schmiede + Schmelze). Die mythische STANDORT-Schmiede kam
// darin nie vor - und war als einzige der vier bis zum 01.08.2026 ungesperrt geblieben, in der
// Liste wie im Handler. Freigeschaltet wird sie durch rsingularitaet, dieselbe Forschung, die den
// Abgrund oeffnet: Wer nie tauchte, konnte sich alle acht Abgrund-Standortmodule schlicht kaufen.
// Deshalb steht hier jetzt eine Zaehlung ueber BEIDE MODULE_DEFS-Listen statt eines einzelnen
// Treffers - ein blosses .test() waere schon vorher gruen gewesen, weil die Schmelze es erfuellt.
check('die mythische STANDORT-Schmiede filtert ebenfalls ueber fundPool',
  (js.match(/fundPool\(MODULE_DEFS\)\.map\(def =>/g) || []).length === 2,
  (js.match(/fundPool\(MODULE_DEFS\)\.map\(def =>/g) || []).length);
check('keine ungefilterte MODULE_DEFS-Knopfliste mehr',
  !/\+ MODULE_DEFS\.map\(def => `<button/.test(js));
// Und die Handler dahinter - eine Liste ohne Knopf ist keine Sperre.
check('craftModuleFromFragments sperrt Abgrund-Module im HANDLER',
  /if \(\(def\.quelle\|\|HERKUNFT_NORMAL\) === HERKUNFT_ABGRUND\)\{ log\('Ausrüstung aus dem Abgrund lässt sich nicht nachbauen/.test(js));
check('craftMythicShipModule ebenso',
  /if \(\(def\.quelle\|\|HERKUNFT_NORMAL\) === HERKUNFT_ABGRUND\)\{ log\('Ausrüstung aus dem Abgrund lässt sich nicht schmieden/.test(js));
// Beide mythischen Handler muessen die Sperre tragen, nicht nur der fuer Schiffsmodule.
check('craftMythicLocationModule ebenso',
  (js.match(/=== HERKUNFT_ABGRUND\)\{ log\('Ausrüstung aus dem Abgrund lässt sich nicht schmieden/g) || []).length === 2,
  (js.match(/=== HERKUNFT_ABGRUND\)\{ log\('Ausrüstung aus dem Abgrund lässt sich nicht schmieden/g) || []).length);
// Der alte, handgeschriebene Filter darf nicht zurueckkommen.
check('kein handgeschriebener Klassenfilter mehr, der die Herkunft uebersieht',
  !/SHIP_MODULE_DEFS\.filter\(d=>d\.klasse===klasse && !d\.craftOnly\)/.test(js));

// ---------------------------------------------------------------- 5. Verrechnungsstellen
// Der teuerste Fehler waere ein Modul mit versprochener, aber nirgends verrechneter Wirkung.
const stellen = [
  ['Taktschmiede → shipMarkDuration', /eff \*= \(1 - Math\.min\(ABGRUND_TAKT_DECKEL, moduleBonusTotal\('markenzeit'\)\)\);/],
  // Nur im planetKey-Zweig: Die Rohdauer bleibt bonusfrei und isoliert nachrechenbar.
  ['Taktschmiede haengt am Standortzweig', /if \(planetKey\)\{\s*eff = effectiveBuildTimeEach/],
  ['Krustenpresse → terraformDuration', /Math\.min\(ABGRUND_KRUSTE_DECKEL, moduleBonusAt\(state\.activeBasePlanet, 'terraform'\)\)/],
  // Ohne schliessende Klammer am Ende: geprueft wird, dass der gedeckelte Wrack-Term Teil der
  // Ratenformel IST - nicht, dass er der einzige Summand bleibt (Arbeitsregel 3: Regel statt
  // Momentaufnahme; seit v8.429.0 steht dort zusaetzlich der Faehigkeitsbaum-Bonus eco8).
  ['Wrackleser → Truemmerabbau', /fleet\.recycler \* 8 \* \(1 \+ Math\.min\(ABGRUND_WRACK_DECKEL, moduleBonusTotal\('wrack'\)\)/],
  ['Prisenwaage → Prisengut-Auszahlung', /const waage = 1 \+ Math\.min\(ABGRUND_PRISE_DECKEL, moduleBonusTotal\('prise'\)\);/],
  ['Drucklot → Bann', /function drucklotAktiv\(flotte\)\{[\s\S]{0,200}'raffiniert', 'drucklot'/],
  ['Ballastspiegel → Niederlage', /Math\.min\(ABGRUND_BALLAST_DECKEL, abgrundSchiffsmodul\(m\.composition \|\| fleet, 'frachter', 'ballast'\)\)/]
];
for (const [name, re] of stellen) check('verrechnet: '+name, re.test(js));
// Jeder Deckel als benannte Konstante, damit ihn der naechste Balance-Pass findet.
for (const k of ['ABGRUND_TAKT_DECKEL','ABGRUND_KRUSTE_DECKEL','ABGRUND_WRACK_DECKEL','ABGRUND_PRISE_DECKEL','ABGRUND_BALLAST_DECKEL']){
  check('Deckel als benannte Konstante: '+k, new RegExp('const '+k+' = 0\\.\\d+;').test(js));
}
// Die Krustenpresse ist die einzige der vier, die am STANDORT wirkt - Terraforming ist ein
// Vorhaben je Standort, moduleBonusTotal() haette eine Presse auf allen Welten wirken lassen.
check('nur die Krustenpresse wirkt standortgebunden', /moduleBonusAt\(state\.activeBasePlanet, 'terraform'\)/.test(js));
// resolveBoarding() muss rein rechnerisch bleiben: Die Funktion loest den Kampf auf und wird von
// tests/test_enterung.js isoliert ausgefuehrt. Ein Wirtschaftsbonus darin haette sie an den
// Modulbestand gekoppelt - der Bonus gehoert an die Auszahlung, nicht in die Kampfrechnung.
check('die Prisenwaage steckt NICHT in resolveBoarding',
  /ergebnis\.prisengut \+= nimm \* \(SHIP_SCORE_WEIGHTS\[k\]\|\|10\) \* PRISENGUT_PER_WEIGHT;/.test(js));

// ---------------------------------------------------------------- 6. Drucklot: keine zweite Mechanik
// Es benutzt die vorhandene Bann-Bedienung. Ein zweiter Auswahlweg fuer dieselbe Sache waere genau
// die Zweitfassung, die dieses Projekt vermeidet.
check('das Drucklot geht dem gekauften Vorrat VOR',
  /if \(!lot\) a\.gegenmassnahmen -= 1;/.test(js));
check('und Vorschau wie Start pruefen dieselbe Bedingung (Regel 6)',
  (js.match(/lot(Aktiv)? \|\| \(a\.gegenmassnahmen\|\|0\) > 0/g) || []).length === 2);
check('der Bann-Knopf erscheint auch ohne Vorrat, wenn ein Drucklot mitfliegt',
  /gegenVorrat > 0 \|\| lotAktiv \|\| vorgemerkt/.test(js));

// ---------------------------------------------------------------- 7. Ballastspiegel: Grenzen
check('der Ballastspiegel rettet NUR Rohstoffe, keine Splitter/Bergungsgut',
  !/abgrundSplitter:[\s\S]{0,80}abgrundBallast/.test(js));
check('er respektiert den Frachtraum wie ein Sieg', /const skalaL = rohSummeL > 0 \? Math\.min\(1, kapL\/rohSummeL\) : 1;/.test(js));
check('und das Lager', /Math\.min\(capL, \(state\.resources\[r\]\|\|0\)\+carried\)/.test(js));
// Regel 6: Log UND Bericht muessen ihn nennen.
check('der Log nennt die gerettete Menge', /Der Ballastspiegel hat '\+fmt\(gerettetSumme\)/.test(js));
check('der Kampfbericht nennt ihn ebenfalls', /r\.abgrundBallast\) body \+=/.test(js));

// ---------------------------------------------------------------- 8. Texte
check('die Hilfe beschreibt die zweite Fundstufe', /title:'Die zweite Fundstufe – ab Tiefe 40'/.test(js));
// Die Hilfe ist auf ZWEI Eintraege verteilt (ein einzelner waere ueber der 2000-Zeichen-Grenze
// gelandet, die tests/test_abgrund.js zieht). Geprueft wird, dass alle sechs irgendwo vorkommen.
const hilfeVon = js.indexOf("title:'Die zweite Fundstufe");
const hilfeBis = js.indexOf("ausschließlich Tauchbeute", hilfeVon);
const hilfeText = js.slice(hilfeVon, hilfeBis);
const fehlend = neueKeys.filter(k => {
  const def = MODULE_DEFS.concat(SHIP_MODULE_DEFS).find(d => d.key === k);
  return !def || hilfeText.indexOf('<strong>'+def.name+'</strong>') < 0;
});
check('die Hilfe nennt alle sechs Module', fehlend.length === 0, fehlend);
check('sie ist auf zwei Eintraege verteilt (2000-Zeichen-Grenze)',
  /title:'Drucklot und Ballastspiegel/.test(js));
check('sie sagt, dass sich keins nachbauen laesst', /Keins der sechs lässt sich nachbauen/.test(js));
// Der Patchnotes-Eintrag von v8.356.0, in dem beide Fehler dokumentiert sind.
//
// Hier stand bis zum 01.08.2026 ein fester Ausschnitt: die ersten 12.000 Zeichen ab dem Array-
// Anfang. Das Array waechst aber nach OBEN - jede neue Version schiebt v8.356.0 weiter nach hinten,
// und der Test wurde zwei Versionen spaeter rot, ohne dass sich an der geprueften Sache etwas
// geaendert hatte. Ein Test, der am Kalender scheitert statt an der Sache, verliert genau dann sein
// Vertrauen, wenn man es braucht. Jetzt wird der Eintrag namentlich gesucht.
const pn356 = js.indexOf("{ version:'8.356.0'");
check('der Patchnotes-Eintrag zu v8.356.0 existiert noch', pn356 > 0);
const eintrag356 = pn356 > 0 ? js.slice(pn356, js.indexOf("{ version:'8.355.0'", pn356)) : '';
check('die Patchnotes nennen beide Fehler',
  /nie gefallen/.test(eintrag356) && /Modulfragmenten nachbauen/.test(eintrag356));
const version = (js.match(/const VERSION = '([\d.]+)'/) || [])[1];
const neuester = (js.match(/const PATCHNOTES = \[\s*\{ version:'([\d.]+)'/) || [])[1];
check('VERSION und neuester Patchnotes-Eintrag stimmen ueberein', version === neuester, { version, neuester });

console.log('\n' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
