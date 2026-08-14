// Schaetzungen fremder Flotten (Spionagebericht + simuliertes PvP).
//
// Beide Stellen trugen bis zum 01.08.2026 eine HANDGEPFLEGTE Summe aus neun Schiffstypen
// (Kreuzer, Kleines Schiff, Zerstoerer, Jaeger, Bomber, Schlachtschiff, Traeger,
// Superschlachtschiff, Waechter). Die elf Kampfklassen, die seither dazugekommen sind, fehlten
// darin und flossen mit 0 ein - darunter die vier staerksten des Spiels:
// Singularitaets-Vernichter (280), Fusionsdreadnought (180), Leerenjaeger (140), Hyperbomber (130).
// Eine aufgeklaerte Apex-Flotte las sich dadurch als nahezu wehrlos.
//
// Exakt dieselbe Fehlerklasse war am 20.07.2026 schon einmal in attackPowerRaw() behoben worden
// ("8 Kampfschiffstypen trugen 0 Angriffskraft bei") - in den Schaetzungen ueberlebte sie, weil
// niemand sie als zweite Anzeigestelle derselben Groesse gesucht hat. Dieser Test prueft deshalb
// nicht nur die heutigen Werte, sondern die EIGENSCHAFT, die den Rueckfall verhindert: Die
// Schaetzung leitet sich aus ATTACK_SHIP_KEYS/SHIP_DEFS ab, ein neues Schiff ist automatisch drin.
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
function schnitt(von, bis){
  const a = src.indexOf(von), b = src.indexOf(bis, a);
  if (a < 0 || b < 0) throw new Error('Abschnitt nicht gefunden: ' + von);
  return src.slice(a, b);
}

// ---- Teil 1: die Funktionen wirklich ausfuehren -----------------------------------------------
// SHIP_DEFS verweist per costFn auf Kostenfunktionen, die hier nicht mitgeschnitten werden. Ihre
// Namen werden aus dem Abschnitt selbst gezogen und als leere Variablen vorangestellt - sonst
// wirft schon das Anlegen des Arrays einen ReferenceError. Bewusst automatisch statt als Liste:
// eine handgepflegte Liste waere genau die Sorte Zweitkopie, die dieser Test bekaempft.
// Endmarke ist das Array-Ende selbst (Einrueckung mit drei Leerzeichen), nicht die naechste
// Konstante: Dazwischen steht Code, der BUILDING_DEFS anfasst und hier nichts zu suchen hat.
const defsSlice   = schnitt('const SHIP_DEFS = [', '\n  ];\n  const SUPER_SPEED') + '\n  ];';
// Endmarke: die Stelle, an der bis v8.497.0 'const CARGO_PER_FRACHTER = 300' stand - die Konstante
// ist in der Tabelle CARGO_PER_SHIP aufgegangen, an ihrem Platz steht jetzt der Verweis darauf.
// Die Marke muss GENAU dort bleiben: Der Ausschnitt braucht alles bis dahin, unter anderem
// shipBaseAtk. Eine zu frueh gesetzte Endmarke (erster Versuch: der Kommentar hinter
// KAMPF_SHIP_KEYS) laesst den Test mit "shipBaseAtk is not defined" abstuerzen - laut, nicht still,
// und das ist der Grund, warum hier ein Anker und kein Suchmuster steht.
const keysSlice   = schnitt("const EXPLORE_SHIP_KEYS = ['ships'];", '// Die Zahlen stehen in CARGO_PER_SHIP weiter oben');
// KAMPF_SHIP_KEYS leitet sich seit v8.497.0 aus CARGO_SHIP_KEYS ab, und das steht weiter oben in
// der Datei - ohne diesen Zusatz wirft der Ausschnitt beim Ausfuehren einen ReferenceError. Auch
// hier aus der Datei geholt statt nachgebaut: Eine eingetippte Kopie waere beim vierten Frachter
// wieder falsch, und zwar unbemerkt, weil der Test dann nur mit den falschen Schluesseln rechnete.
const cargoSlice  = schnitt('const CARGO_PER_SHIP = {', '\n  /* Passiver Lagerbeitrag');
const dimSlice    = schnitt('const MEGA_FLEET_THRESHOLD = 300;', '\n  // Flotten-Diversitäts-Bonus');
const kostenNamen = [...new Set([...defsSlice.matchAll(/costFn:\s*(\w+)/g)].map(m => m[1]))];

const ctx = {};
const superWeight = schnitt('const SUPERSCHLACHTSCHIFF_DEF_WEIGHT = ', '\n');
new Function('ctx', 'var ' + kostenNamen.join(', ') + ';\n' + defsSlice + '\n' + superWeight + '\n' + dimSlice + '\n' + cargoSlice + '\n' + keysSlice
  + ';ctx.SHIP_DEFS=SHIP_DEFS; ctx.KEYS=ATTACK_SHIP_KEYS; ctx.atk=shipBaseAtk;'
  + 'ctx.eAtk=estimateEnemyFleetAtk; ctx.eDef=estimateEnemyFleetDefense; ctx.dim=diminishingShipCount;')(ctx);

check('Kostenfunktions-Namen automatisch erkannt', kostenNamen.length > 5, kostenNamen.length);
check('SHIP_DEFS geladen', ctx.SHIP_DEFS.length > 20, ctx.SHIP_DEFS.length);

// Das Superschlachtschiff ist der einzige Schiffstyp OHNE SHIP_DEFS-Eintrag. Genau daran ist der
// Sonderfall entstanden, der sich frueher als Ternaer an vier Stellen wiederholte.
check('Superschlachtschiff steht nicht in SHIP_DEFS (Grund fuer den Sonderfall)',
  !ctx.SHIP_DEFS.some(d => d.key === 'superschlachtschiff'));
check('shipBaseAtk kennt es trotzdem', ctx.atk('superschlachtschiff') === 220, ctx.atk('superschlachtschiff'));
check('shipBaseAtk liest normale Klassen aus SHIP_DEFS', ctx.atk('cruisers') === 20 && ctx.atk('singularitaetsvernichter') === 280,
  { cruisers: ctx.atk('cruisers'), vernichter: ctx.atk('singularitaetsvernichter') });
check('shipBaseAtk gibt fuer Unbekanntes 0 statt undefined', ctx.atk('gibtesnicht') === 0, ctx.atk('gibtesnicht'));

// ---- Teil 2: die elf frueher fehlenden Klassen zaehlen jetzt ----------------------------------
// Die neun, die die alte Summe kannte - alles andere mit einem atk-Wert fiel hinten runter.
const ALTE_LISTE = ['cruisers','ships','destroyers','jaeger','bomber','schlachtschiff','carrier','superschlachtschiff','waechter'];
const kampfKlassen = ctx.KEYS.filter(k => ctx.atk(k) > 0);
const frueherFehlend = kampfKlassen.filter(k => !ALTE_LISTE.includes(k));
check('Es gibt mehr Kampfklassen als die alte Liste kannte', frueherFehlend.length >= 10,
  { gesamt: kampfKlassen.length, frueherFehlend: frueherFehlend.length });

const nullZaehler = frueherFehlend.filter(k => ctx.eAtk({ [k]: 10 }) <= 0);
check('KEINE frueher fehlende Klasse schaetzt sich auf 0', nullZaehler.length === 0, nullZaehler);

// Der konkrete Spielerfall aus dem Bericht: eine reine Apex-Flotte.
const apex = { singularitaetsvernichter: 12, fusionsdreadnought: 20, leerenjaeger: 30, hyperbomber: 25 };
check('Apex-Flotte wird nicht mehr als wehrlos gemeldet', ctx.eAtk(apex) > 1000, ctx.eAtk(apex));
check('Apex-Flotte haette unter der alten Liste exakt 0 ergeben',
  Object.keys(apex).every(k => !ALTE_LISTE.includes(k)));

// ---- Teil 3: die Eigenschaft, die den Rueckfall verhindert ------------------------------------
// Wenn die Schaetzung ueber ATTACK_SHIP_KEYS laeuft, ist ein kuenftiges Schiff automatisch dabei.
// Der Nachweis: JEDE Klasse aus ATTACK_SHIP_KEYS mit atk>0 muss die Schaetzung erhoehen.
const stumm = ctx.KEYS.filter(k => ctx.atk(k) > 0 && ctx.eAtk({ [k]: 5 }) === 0);
check('Jede angriffsfaehige Klasse wirkt sich auf die Schaetzung aus', stumm.length === 0, stumm);
check('Frachter tragen weiter 0 bei (stehen nur wegen der Beute in der Liste)',
  ctx.eAtk({ frachter: 50, frachtergross: 50 }) === 0, ctx.eAtk({ frachter: 50, frachtergross: 50 }));

// Diminishing Returns laufen mit - sonst liest sich ein Massenschwarm als eine Kraft, die er im
// Kampf nie erreicht, und die Schaetzung waere gerade bei den groessten Flotten am weitesten daneben.
check('Diminishing Returns wirken in der Schaetzung',
  ctx.eAtk({ jaeger: 10000 }) < 10000 * ctx.atk('jaeger'),
  { geschaetzt: ctx.eAtk({ jaeger: 10000 }), naiv: 10000 * ctx.atk('jaeger') });

// Verteidigungsschaetzung: reine Verteidigungsschiffe muessen zaehlen, obwohl sie nie angreifen.
check('Metamaterial-Titan zaehlt in der Verteidigung, nicht im Angriff',
  ctx.eDef({ metamaterialtitan: 10 }) > 0 && ctx.eAtk({ metamaterialtitan: 10 }) === 0,
  { def: ctx.eDef({ metamaterialtitan: 10 }), atk: ctx.eAtk({ metamaterialtitan: 10 }) });
check('Superschlachtschiff zaehlt auch in der Verteidigungsschaetzung',
  ctx.eDef({ superschlachtschiff: 10 }) > 0, ctx.eDef({ superschlachtschiff: 10 }));

// ---- Teil 4: keine abgeschriebene Summe mehr im Quelltext -------------------------------------
// Der Rueckfall saehe wieder genauso aus: eine Kette aus (x.cruisers||0)*20 + ... irgendwo im Code.
//
// Gescannt wird eine Fassung OHNE reine Kommentarzeilen: Die Kommentare, die den behobenen Fehler
// beschreiben, zitieren die alte Form zwangslaeufig im Wortlaut - ein Test, der darauf anschlaegt,
// bestraft die Dokumentation des Fehlers statt seinen Rueckfall. Bewusst nur ganze Kommentarzeilen
// entfernt und nicht jedes "//": In Zeichenketten steckt es auch (https://), und ein naiver Schnitt
// wuerde dort mitten im Code abschneiden.
const codeOnly = src.split('\n').filter(z => !z.trim().startsWith('//')).join('\n');
const abgeschrieben = [...codeOnly.matchAll(/\(\s*\w+(?:\.\w+)*\.cruisers\s*\|\|\s*0\s*\)\s*\*\s*20/g)];
check('Keine handgepflegte Angriffssumme mehr im Quelltext', abgeschrieben.length === 0, abgeschrieben.length);
const superTernaer = [...codeOnly.matchAll(/superschlachtschiff'\s*\?\s*220/g)];
check('Kein Superschlachtschiff-Ternaer mehr im Quelltext', superTernaer.length === 0, superTernaer.length);
// Schaerfer als der Ternaer-Scan: Die 220 stand zuletzt auch als nackter Faktor im Code
// (diminishingShipCount(superCount) * 220 * DEF_WEIGHT, "Angriffspunkte 220" in zwei Werftkarten,
// shipStatBarsHtml(220, ...) und zweimal als nachgebautes def-Objekt) - dieselbe Zahl, jedes Mal
// anders geschrieben, deshalb hat der Ternaer-Scan allein sie nicht gefunden.
//
// Genau DREI Code-Stellen duerfen sie noch nennen, und jede hat einen Grund:
//   shipBaseAtk      - die Nachschlagefunktion selbst, das einzige Zuhause des Sonderfalls
//   attackPowerRaw   - die kanonische Angriffsformel, in der ALLE Klassenwerte inline stehen
//   COUNTER_ROLE_ATK - bewusste Spiegelung der Backend-Tabelle, zeichengleich geprueft von
//                      test_flottenbalance.js (der Server hat kein SHIP_DEFS, das ist die einzige
//                      Form, in der sich die Gleichheit beider Seiten ueberhaupt beweisen laesst)
// Der Test prueft die Stellen namentlich statt nur ihre Anzahl: Eine neue Kopie waere sonst
// unauffaellig, sobald jemand gleichzeitig eine alte entfernt.
const superZeilen = codeOnly.split('\n').filter(z => z.includes('220') && z.includes('superschlachtschiff')).map(z => z.trim());
const erlaubt = [
  z => z.startsWith("if (key === 'superschlachtschiff') return 220;"),
  z => z.startsWith('let power = dm(') && z.includes("dm('superschlachtschiff',f.superschlachtschiff)*220"),
  z => z.includes('superschlachtschiff:220') && z.includes('cruisers:20')
];
const unerlaubt = superZeilen.filter(z => !erlaubt.some(f => f(z)));
check('Keine unerklaerte 220-Kopie im Quelltext', unerlaubt.length === 0, unerlaubt);
check('Alle drei erlaubten Stellen sind noch da', erlaubt.every(f => superZeilen.some(f)), superZeilen.length);
// Gegenprobe: Der Scan muss die alte Form ueberhaupt erkennen koennen - sonst waere das gruene
// Ergebnis oben nur ein Beweis dafuer, dass die Regex nichts findet.
check('Gegenprobe: die alte Form wuerde erkannt',
  /\(\s*\w+(?:\.\w+)*\.cruisers\s*\|\|\s*0\s*\)\s*\*\s*20/.test('const x = (entry.cruisers||0)*20 + 1;')
  && /superschlachtschiff'\s*\?\s*220/.test("k==='superschlachtschiff' ? 220 : 0"));

// ---- Teil 5: der Spionagebericht rechnet mit der Phasenformel ---------------------------------
// Er nannte bis heute einen einzelnen Wurf (max(0.1,min(0.9,p/(p+d)))) und behauptete im Kommentar
// daneben, das sei "gleiche Formel wie die tatsaechliche Kampfaufloesung". Seit v8.295.0 laeuft der
// Kampf in drei Phasen - der Bericht widersprach damit der Vorschau im Profil fuer dasselbe Ziel.
const spyBlock = schnitt("} else if (r.type === 'spy-report'){", 'if (r.spyShielded)');
check('Spionagebericht nutzt battleWinChance', spyBlock.includes('battleWinChance('));
check('Spionagebericht nutzt die PvP-Phasengrenzen', spyBlock.includes('PVP_PHASE_MIN') && spyBlock.includes('PVP_PHASE_MAX'));
check('Spionagebericht rechnet die Konterwirkung ein', spyBlock.includes('counterMultiplier('));
check('Kein einzelner Wurf mehr im Spionagebericht', !/Math\.max\(0\.1,\s*Math\.min\(0\.9/.test(spyBlock));
check('Spionagebericht nutzt die gemeinsame Schaetzung', spyBlock.includes('estimateEnemyFleetAtk('));

// Der simulierte PvP-Pfad (Solo-Modus ohne Server) war der letzte Kampfpfad mit einem einzigen Wurf,
// waehrend Hilfe und Vorschau ueberall drei Phasen versprechen.
const simBlock = schnitt('// Simulierter Modus (kein eigener Server)', 'const statLine');
check('Simuliertes PvP loest in drei Phasen auf', simBlock.includes('resolveBattlePhases('));
check('Simuliertes PvP nutzt die PvP-Deckel', simBlock.includes('PVP_PHASE_MIN'));
check('Simuliertes PvP nutzt die gemeinsame Verteidigungsschaetzung', simBlock.includes('estimateEnemyFleetDefense('));
check('Kein einzelner Wurf mehr im simulierten PvP', !/Math\.random\(\)\s*<\s*chance/.test(simBlock));

// ---- Teil 6: Werftmarken auch in der PvP-Vorschau ---------------------------------------------
// v8.354.0 schrieb sie in die NPC-Vorschau und alle vier Kampfberichte - mit der Begruendung, eine
// Vorschau ohne sie waere die Anzeigestelle, die die alte Annahme behaelt. Die PvP-Vorschau blieb
// dabei aus, obwohl die Marken auch dort laengst in der angezeigten Angriffskraft steckten.
const vorschauBlock = schnitt('// Angriffs-Vorschau-Panel (Idee 9)', '// Aufklärungs');
const markenBlock = schnitt('let previewMarkHtml', 'const intel =');
check('PvP-Vorschau bildet einen Werftmarken-Hinweis', markenBlock.includes('fleetMarksSnapshot('));
check('PvP-Vorschau nennt den Angriffsanteil der Marken', markenBlock.includes('fleetMarkAtkShare('));
check('Der Hinweis wird auch ausgegeben', vorschauBlock.includes('previewMarkHtml'));

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
