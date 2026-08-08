// Drei Build-System-Erfolge (v8.456.0, Task #47): Exotisch-Besitz, Perfekter Wurf,
// gespeicherte Vorlage - alle rein zustandsbasiert, kein neuer Zaehler.
//
// GEPRUEFT WIRD (die Helfer AUSGEFUEHRT, moduleWertOf ist der ECHTE Parser):
//   1) "Besitzen" heisst Inventar ODER eingebaut, in BEIDEN Modulsystemen - inkl. der Falle,
//      dass equipModule Module aus der Inventar-Zaehlkarte herausnimmt (wer sein einziges
//      Exotisch-Modul einbaut, darf den Erfolg nicht dadurch verlieren).
//   2) Der Wurf-Erfolg misst gegen MODULE_WERT_MAX, und die Beschreibung nennt dieselbe Zahl
//      (Regel 6: der Text ist eine zweite Anzeigestelle der Konstante).
//   3) Der Vorlagen-Erfolg zaehlt beide Vorlagen-Speicher.
//   4) Verdrahtung: drei ACHIEVEMENTS-Eintraege nutzen die Helfer in check UND progress,
//      jeder hat Kategorie (ACH_CAT) und eigenes Icon (ACH_ICONS, aus der Font-Whitelist).
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren in beide Richtungen ausgefuehrt): am alten
// Stand (v8.455.0) fallen 1a und 4a-4c durch.
const fs = require('fs');
const { SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- Extraktion (Regel 6: Anker-Existenz vor dem Slice)
const von = JS.indexOf('function besitztModulMitSeltenheit(s, rarKey){');
const bis = von < 0 ? -1 : JS.indexOf('const ACHIEVEMENTS = [', von);
check('1a: Helfer-Block gefunden (bis vor ACHIEVEMENTS)', von > 0 && bis > von);
if (von < 0 || bis < 0) return ende();
const quelle = JS.slice(von, bis);

// Echter Wert-Parser + Konstanten aus der Datei (Regel 4).
const wertVon = JS.indexOf('function moduleWertOf(instKey){');
const wertQuelle = JS.slice(wertVon, JS.indexOf('\n  }', wertVon) + 4);
const konst = JS.match(/const MODULE_WERT_MIN = (\d+), MODULE_WERT_MAX = (\d+);/);
check('1b: Wert-Konstanten gefunden', !!konst, konst && konst.slice(1, 3));
const WERT_MAX = Number(konst[2]);
const api = new Function(konst[0] + '\n' + wertQuelle + '\n' + quelle
  + '\nreturn { besitztModulMitSeltenheit, besitztModulMitWert, hatVorlageGespeichert };')();

// ---- 1) Exotisch: Inventar UND Slots, beide Systeme
check('1c: Exotisch im Standort-Inventar zaehlt',
  api.besitztModulMitSeltenheit({ modules: { 'waffen:exotisch:2:atk15.w104': 1 } }, 'exotisch') === true);
check('1d: Exotisch EINGEBAUT zaehlt (Inventar-Zaehlkarte ist dann leer)',
  api.besitztModulMitSeltenheit({ equippedShipModules: { frachter: ['fracht:exotisch'] } }, 'exotisch') === true);
check('1e: ohne Exotisch kein Erfolg (Mythisch reicht nicht)',
  api.besitztModulMitSeltenheit({ modules: { 'waffen:mythisch:9': 1 } }, 'exotisch') === false);

// ---- 2) Perfekter Wurf: gegen die Konstante gemessen, Text stimmt ueberein
check('2a: ein w' + WERT_MAX + '-Modul erfuellt, ' + (WERT_MAX - 1) + '% nicht (echter Parser)',
  api.besitztModulMitWert({ modules: { ['waffen:selten:1:w' + WERT_MAX]: 1 } }, WERT_MAX) === true &&
  api.besitztModulMitWert({ modules: { ['waffen:selten:1:w' + (WERT_MAX - 1)]: 1 } }, WERT_MAX) === false);
check('2b: der Wurf steckt auch hinter Substat-Tokens',
  api.besitztModulMitWert({ equippedModules: { home: ['waffen:legendaer:3:atk15.w' + WERT_MAX] } }, WERT_MAX) === true);
check('2c: der Erfolg misst gegen MODULE_WERT_MAX, nicht gegen eine getippte Zahl',
  JS.includes('besitztModulMitWert(s, MODULE_WERT_MAX)'));
check('2d: die Beschreibung nennt dieselbe Zahl wie die Konstante',
  JS.includes('maximalen Hauptwert-Wurf von ' + WERT_MAX + '%'));

// ---- 3) Vorlagen: beide Speicher
check('3: beide Vorlagen-Speicher zaehlen, leere Objekte nicht',
  api.hatVorlageGespeichert({ moduleLoadouts: { home: { A: ['waffen:selten'] } } }) === true &&
  api.hatVorlageGespeichert({ shipModuleLoadouts: { frachter: { B: [] } } }) === true &&
  api.hatVorlageGespeichert({ moduleLoadouts: {}, shipModuleLoadouts: {} }) === false &&
  api.hatVorlageGespeichert({}) === false);

// ---- 4) Verdrahtung: Eintraege, Kategorie, Icons
for (const [key, helfer] of [['module_exotic', 'besitztModulMitSeltenheit'],
                              ['module_wurf110', 'besitztModulMitWert'],
                              ['module_vorlage', 'hatVorlageGespeichert']]){
  const iVon = JS.indexOf("key:'" + key + "'");
  const eintrag = iVon < 0 ? '' : JS.slice(iVon, iVon + 500);
  check('4a: ' + key + ' existiert und nutzt ' + helfer + ' in check und progress',
    iVon > 0 && (eintrag.match(new RegExp(helfer, 'g')) || []).length >= 2);
  check('4b: ' + key + ' hat eine Kategorie', new RegExp(key + ":'(forschung|aufbau|meister)'").test(JS));
  const icon = (JS.match(new RegExp(key + ":'(ti-[a-z0-9-]+)'")) || [])[1];
  check('4c: ' + key + ' hat ein eigenes Icon aus der Font-Whitelist',
    !!icon && new RegExp('\\.' + icon + ':before').test(HTML), icon);
}

ende();
