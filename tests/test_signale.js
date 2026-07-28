// Expeditions-Signale v8.298.15 (Inhaltspaket 5/5).
//
// Signale sind das erste Expeditions-Feature mit ZUSTAND, der zwischen zwei Missionen lebt - und
// genau daran koennen sie still danebengehen:
//   - Ein Signal in einem UNENTDECKTEN System waere kein Angebot, sondern eine Sackgasse.
//   - Zwei Signale im selben System machen die Karte unleserlich; mehr als drei entwerten die Wahl.
//   - Wuerde das Ziel LIVE aus state gelesen statt beim Start eingebacken, koennte man es waehrend
//     des Flugs umstellen - derselbe Fehler, den withdrawOnContact/encounterChance dort vermeiden.
//   - Zwei Expeditionen auf dasselbe Signal: die zweite kaeme garantiert leer zurueck.
//   - Ein ABGELAUFENES Signal darf den normalen Fundwurf nicht verschlucken.
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const whitelist = new Set([...src.matchAll(/^\s*\.(ti-[a-z0-9-]+):before/gm)].map(m => m[1]));

// ---------------------------------------------------------------- Signal-Block ausfuehrbar machen
const von = src.indexOf('const SIGNAL_MAX = ');
const bis = src.indexOf('function randomFindableRareItem', von);
check('Signal-Block in der Spieldatei gefunden', von > 0 && bis > von);
if (von < 0 || bis < von){ console.log('\nFAIL'); process.exit(1); }
const block = src.slice(von, bis);

// Attrappen fuer alles, was resolveSignalFind anfasst. Bewusst so schlank wie moeglich: was hier
// gestubbt wird, prueft dieser Test NICHT - geprueft wird die Signal-Logik selbst.
function baue(opts){
  opts = opts || {};
  const ctx = {};
  const state = {
    expeditionSignals: opts.signale || [],
    discovered: opts.discovered || {},
    signalDrought: opts.drought || 0,
    rareItems: {}, moduleFragments: 0, expeditionChain: opts.chain || null,
    expeditionCodex: { specials:{}, rares:{}, chainCompleted:0, signalsFollowed:0 }
  };
  const protokoll = { xp:0, res:null, module:0, codexRares:[] };
  // Echolotmast (v8.334.0): Das Modul verlaengert die Peilungsfrist. Ohne Modul ist der Bonus 0 -
  // dann muessen alle bisherigen Fristpruefungen unveraendert gelten. Abschnitt 9 dreht ihn hoch.
  let mastBonus = 0;
  ctx.setMast = (v) => { mastBonus = v; };
  const PLANETS = [], STAR_SYSTEMS = [];
  for (let i = 0; i < 6; i++){
    STAR_SYSTEMS.push({ id:'s'+i, name:'System '+i });
    PLANETS.push({ id:'p'+i, system:'s'+i });
  }
  new Function('ctx', 'state', 'PLANETS', 'STAR_SYSTEMS', 'EXPEDITION_CHAIN_NEEDED', 'RARE_ITEMS',
    'RES_DEFS', 'randomFindableRareItem', 'grantRandomModule', 'gainResources', 'addXp',
    'recordCodexRare', 'ensureExpeditionCodex', 'fmt', 'moduleBonusTotal', block +
    ';ctx.MAST_DECKEL=SIGNAL_MAST_DECKEL;ctx.MAX=SIGNAL_MAX;ctx.LIFETIME=SIGNAL_LIFETIME_MS;ctx.CHANCE=SIGNAL_SPAWN_CHANCE;ctx.PITY=SIGNAL_PITY_AFTER;ctx.TYPES=SIGNAL_TYPES;' +
    'ctx.spawn=maybeSpawnSignal;ctx.resolve=resolveSignalFind;ctx.active=activeSignals;ctx.prune=pruneSignals;ctx.typeOf=signalTypeOf;'
  )(ctx, state, PLANETS, STAR_SYSTEMS, 3,
    [{ key:'r1', name:'Testmaterial', icon:'ti-diamond', chance:0.01 }],
    [{ key:'erz', label:'Erz' }, { key:'kristalle', label:'Kristalle' }, { key:'deuterium', label:'Deuterium' }, { key:'antimaterie', label:'Antimaterie' }],
    () => ({ key:'r1', name:'Testmaterial', icon:'ti-diamond' }),
    () => { protokoll.module++; return 'Testmodul'; },
    (r) => { protokoll.res = r; },
    (x) => { protokoll.xp += x; },
    (k) => { protokoll.codexRares.push(k); },
    () => state.expeditionCodex,
    (n) => String(n),
    // Echolotmast (v8.334.0): Ohne Modul ist der Bonus 0, die Peilungsfrist also unveraendert.
    // Abschnitt 9 dreht ihn hoch und prueft, dass die Frist wirklich mitwaechst UND am Deckel haelt.
    (eff) => (eff === 'signal' ? mastBonus : 0));
  return { ctx, state, protokoll, STAR_SYSTEMS };
}

// ---------------------------------------------------------------- 1) Form der Signalarten
const u0 = baue();
check('1: vier Signalarten', u0.ctx.TYPES.length === 4, u0.ctx.TYPES.length);
check('1: jede Art hat ein Icon aus der Whitelist',
  u0.ctx.TYPES.every(t => whitelist.has(t.icon)), u0.ctx.TYPES.filter(t => !whitelist.has(t.icon)).map(t => t.key + '=' + t.icon));
// CLAUDE.md Regel 7: vollstaendige, selbsterklaerende Beschreibung - kein Kuerzel-Text.
check('1: jede Art hat eine vollständige Beschreibung (ganzer Satz, nennt die Wirkung)',
  u0.ctx.TYPES.every(t => t.desc && t.desc.length >= 80 && /garantiert/.test(t.desc)),
  u0.ctx.TYPES.filter(t => !t.desc || t.desc.length < 80).map(t => t.key + '=' + (t.desc || '').length));
check('1: keine doppelten Schlüssel und jede Art hat ein positives Gewicht',
  new Set(u0.ctx.TYPES.map(t => t.key)).size === 4 && u0.ctx.TYPES.every(t => t.gewicht > 0));
check('1: die Beschreibungen sind auf Deutsch mit Umlauten, nicht transliteriert',
  !u0.ctx.TYPES.some(t => /(fuer|groess|zusaetz|zufaell|Waehr|naechst|vollstaend)/.test(t.desc)),
  u0.ctx.TYPES.filter(t => /(fuer|groess|zusaetz|zufaell|Waehr|naechst|vollstaend)/.test(t.desc)).map(t => t.key));

// ---------------------------------------------------------------- 2) Spawn nur in entdeckten Systemen
const ohneEntdeckung = baue({ discovered: {} });
let trefferOhne = 0;
for (let i = 0; i < 500; i++) if (ohneEntdeckung.ctx.spawn()) trefferOhne++;
check('2: ohne ein einziges entdecktes System entsteht kein Signal', trefferOhne === 0, { treffer: trefferOhne });

const zwei = baue({ discovered: { p0:true, p1:true } });
const gesehen = new Set();
for (let i = 0; i < 4000; i++){
  const r = zwei.ctx.spawn();
  if (r) gesehen.add(r.sys.id);
  zwei.state.expeditionSignals.length = 0; // Platz schaffen, damit der Spawn nicht am Deckel scheitert
}
check('2: Signale entstehen ausschließlich in entdeckten Systemen',
  gesehen.size > 0 && [...gesehen].every(id => id === 's0' || id === 's1'), [...gesehen]);
check('2: und verteilen sich über ALLE entdeckten Systeme, nicht nur das erste',
  gesehen.size === 2, [...gesehen]);

// ---------------------------------------------------------------- 3) Deckel und ein Signal je System
const alle = baue({ discovered: { p0:true, p1:true, p2:true, p3:true, p4:true, p5:true } });
for (let i = 0; i < 3000; i++) alle.ctx.spawn();
check('3: höchstens ' + alle.ctx.MAX + ' Signale gleichzeitig',
  alle.state.expeditionSignals.length === alle.ctx.MAX, alle.state.expeditionSignals.length);
const systeme = alle.state.expeditionSignals.map(s => s.systemId);
check('3: höchstens ein Signal je System', new Set(systeme).size === systeme.length, systeme);
check('3: jedes Signal hat eine eindeutige Kennung, ein Ablaufdatum und eine gültige Art',
  alle.state.expeditionSignals.every(s => s.id && s.expiresAt > Date.now() && u0.ctx.TYPES.some(t => t.key === s.kind)) &&
  new Set(alle.state.expeditionSignals.map(s => s.id)).size === alle.ctx.MAX,
  alle.state.expeditionSignals);

// Alle vier Arten muessen ueberhaupt vorkommen - eine Art mit Gewicht, die nie gewuerfelt wird,
// waere toter Inhalt.
const arten = new Set();
const wurf = baue({ discovered: { p0:true } });
for (let i = 0; i < 6000; i++){ const r = wurf.ctx.spawn(); if (r) arten.add(r.typ.key); wurf.state.expeditionSignals.length = 0; }
check('3: alle vier Arten treten tatsächlich auf', arten.size === 4, [...arten]);

// Spawnrate: grob im Bereich der Konstante (kein Balance-Urteil, nur "die Konstante wirkt").
// signalDrought wird je Runde zurueckgesetzt, damit hier die GRUNDCHANCE gemessen wird und nicht
// der Pechstraehnen-Schutz - der bekommt gleich seine eigenen Pruefungen.
let treffer = 0;
const rate = baue({ discovered: { p0:true } });
for (let i = 0; i < 20000; i++){ rate.state.signalDrought = 0; if (rate.ctx.spawn()) treffer++; rate.state.expeditionSignals.length = 0; }
check('3: die Spawn-Wahrscheinlichkeit entspricht der Konstante',
  Math.abs(treffer/20000 - rate.ctx.CHANCE) < 0.02, { gemessen: +(treffer/20000).toFixed(3), erwartet: rate.ctx.CHANCE });

// ---------------------------------------------------------------- 4) Ablauf
const abgelaufen = baue({ signale: [
  { id:'alt', systemId:'s0', kind:'cache', expiresAt: Date.now() - 1000 },
  { id:'neu', systemId:'s1', kind:'cache', expiresAt: Date.now() + 60000 }
]});
check('4: abgelaufene Signale verschwinden aus der Anzeige',
  abgelaufen.ctx.active().length === 1 && abgelaufen.ctx.active()[0].id === 'neu',
  abgelaufen.ctx.active().map(s => s.id));
check('4: ein abgelaufenes Signal löst KEINEN Fund aus (der normale Wurf greift wieder)',
  abgelaufen.ctx.resolve('alt', 1) === null);
check('4: ein unbekanntes Signal löst ebenfalls keinen Fund aus',
  abgelaufen.ctx.resolve('gibtsnicht', 1) === null);
check('4: die Laufzeit ist eine sinnvolle Spanne (30 Min. bis 12 Std.)',
  abgelaufen.ctx.LIFETIME >= 30*60*1000 && abgelaufen.ctx.LIFETIME <= 12*60*60*1000,
  { minuten: abgelaufen.ctx.LIFETIME/60000 });

// ---------------------------------------------------------------- 5) Garantierter Fund je Art
function fund(kind, chain){
  const u = baue({ signale: [{ id:'x', systemId:'s0', kind, expiresAt: Date.now()+60000 }], chain });
  const r = u.ctx.resolve('x', 1);
  return { r, u };
}
const fMat = fund('material');
check('5: Materialpeilung bringt garantiert ein seltenes Material',
  !!fMat.r && fMat.u.state.rareItems.r1 === 1 && fMat.u.protokoll.codexRares.length === 1,
  { text: fMat.r && fMat.r.text });
const fMod = fund('modul');
check('5: Technik-Echo bringt garantiert ein Modul UND Modulfragmente',
  !!fMod.r && fMod.u.protokoll.module === 1 && fMod.u.state.moduleFragments === 4,
  { module: fMod.u.protokoll.module, fragmente: fMod.u.state.moduleFragments });
const fCache = fund('cache');
check('5: Frachtsignal bringt garantiert einen Ressourcen-Cache aus vier Rohstoffen',
  !!fCache.r && fCache.u.protokoll.res && Object.keys(fCache.u.protokoll.res).length === 4 &&
  Object.values(fCache.u.protokoll.res).every(v => v > 0), fCache.u.protokoll.res);
const fKette = fund('kette', { fragments:0, readyFinale:false });
check('5: Kartenfragment-Signal bringt garantiert ein Fragment',
  !!fKette.r && fKette.u.state.expeditionChain.fragments === 1, fKette.u.state.expeditionChain);
// Kette komplett: der Fund darf nicht ersatzlos verpuffen.
const fKetteVoll = fund('kette', { fragments:3, readyFinale:true });
check('5: bei bereits vollständiger Kette gibt es einen Ersatz statt eines Blindgängers',
  !!fKetteVoll.r && fKetteVoll.u.state.moduleFragments === 4 && fKetteVoll.u.state.expeditionChain.readyFinale === true,
  { fragmente: fKetteVoll.u.state.moduleFragments });
// Das dritte Fragment muss das Finale scharf schalten - sonst haenge die Kette bei 3/3 fest.
const fKetteLetzte = fund('kette', { fragments:2, readyFinale:false });
check('5: das letzte Fragment schaltet das Schatzdepot-Finale scharf',
  fKetteLetzte.u.state.expeditionChain.readyFinale === true, fKetteLetzte.u.state.expeditionChain);
check('5: jeder Fund liefert Text und Icon für die Anzeige',
  [fMat, fMod, fCache, fKette, fKetteVoll].every(f => f.r && f.r.text && f.r.text.length > 20 && f.r.icon));
check('5: jeder Fund gibt zusätzlich Erfahrung',
  [fMat, fMod, fCache, fKette].every(f => f.u.protokoll.xp > 0));

// ---------------------------------------------------------------- 6) Signal wird VERBRAUCHT
const verbrauch = baue({ signale: [
  { id:'a', systemId:'s0', kind:'cache', expiresAt: Date.now()+60000 },
  { id:'b', systemId:'s1', kind:'cache', expiresAt: Date.now()+60000 }
]});
check('6: der erste Zugriff liefert den Fund', !!verbrauch.ctx.resolve('a', 1));
check('6: das Signal ist danach weg', verbrauch.ctx.active().length === 1 && verbrauch.ctx.active()[0].id === 'b');
check('6: ein zweiter Zugriff auf dasselbe Signal liefert nichts mehr',
  verbrauch.ctx.resolve('a', 1) === null);
// Der Ertragsmultiplikator muss durchschlagen - sonst waere das Frachtsignal bei schwacher
// Expedition genauso gross wie bei starker.
const klein = baue({ signale: [{ id:'x', systemId:'s0', kind:'cache', expiresAt: Date.now()+60000 }] });
klein.ctx.resolve('x', 1);
const gross = baue({ signale: [{ id:'x', systemId:'s0', kind:'cache', expiresAt: Date.now()+60000 }] });
gross.ctx.resolve('x', 2);
check('6: der Ressourcen-Cache skaliert mit dem Expeditionsertrag',
  gross.protokoll.res.erz === klein.protokoll.res.erz * 2,
  { einfach: klein.protokoll.res.erz, doppelt: gross.protokoll.res.erz });

// ---------------------------------------------------------------- 6b) Pechsträhnen-Schutz
// Ohne ihn waere die Tagesaufgabe "1 Peilung ansteuern" an einem Pechtag unerfuellbar gewesen.
const pity = baue({ discovered: { p0:true } });
check('6b: der Pechsträhnen-Deckel ist gesetzt und sinnvoll (3 bis 20 Expeditionen)',
  Number.isFinite(pity.ctx.PITY) && pity.ctx.PITY >= 3 && pity.ctx.PITY <= 20, { pity: pity.ctx.PITY });
// Laengste Durststrecke ueber viele Laeufe: darf NIE ueber dem Deckel liegen.
let laengsteDurststrecke = 0;
{
  const u = baue({ discovered: { p0:true } });
  let seitLetztem = 0;
  for (let i = 0; i < 20000; i++){
    seitLetztem++;
    if (u.ctx.spawn()){ laengsteDurststrecke = Math.max(laengsteDurststrecke, seitLetztem); seitLetztem = 0; }
    u.state.expeditionSignals.length = 0;
  }
}
check('6b: nach spätestens ' + pity.ctx.PITY + ' erfolglosen Expeditionen kommt garantiert eine Peilung',
  laengsteDurststrecke <= pity.ctx.PITY, { laengsteDurststrecke });
check('6b: und der Schutz ersetzt nicht den Zufall (kurze Strähnen kommen weiterhin vor)',
  laengsteDurststrecke > 1, { laengsteDurststrecke });
// Der Zaehler darf NICHT laufen, wenn ein Spawn ohnehin unmoeglich waere - sonst wuerde jemand mit
// drei liegenden Peilungen einen Anspruch ansammeln, den er nie "erlitten" hat.
const satt = baue({ discovered: { p0:true, p1:true, p2:true } });
for (let i = 0; i < 3; i++) satt.state.expeditionSignals.push({ id:'x'+i, systemId:'s'+i, kind:'cache', expiresAt: Date.now()+60000 });
for (let i = 0; i < 50; i++) satt.ctx.spawn();
check('6b: am Deckel läuft der Pech-Zähler nicht mit', (satt.state.signalDrought||0) === 0, { drought: satt.state.signalDrought });
const unbekannt = baue({ discovered: {} });
for (let i = 0; i < 50; i++) unbekannt.ctx.spawn();
check('6b: ohne entdecktes System ebenfalls nicht', (unbekannt.state.signalDrought||0) === 0, { drought: unbekannt.state.signalDrought });
// Eine erfolgreiche Peilung setzt den Zaehler zurueck.
const reset = baue({ discovered: { p0:true }, drought: 7 });
let versuche = 0;
while (!reset.ctx.spawn() && versuche < 50) versuche++;
check('6b: eine aufgefangene Peilung setzt den Pech-Zähler zurück',
  (reset.state.signalDrought||0) === 0, { drought: reset.state.signalDrought, versuche });

// ---------------------------------------------------------------- 6c) Kodex-Zähler
const zaehler = baue({ signale: [
  { id:'a', systemId:'s0', kind:'cache', expiresAt: Date.now()+60000 },
  { id:'b', systemId:'s1', kind:'material', expiresAt: Date.now()+60000 },
  { id:'c', systemId:'s2', kind:'kette', expiresAt: Date.now()-1000 }
], chain:{ fragments:0, readyFinale:false } });
zaehler.ctx.resolve('a', 1);
zaehler.ctx.resolve('b', 1);
zaehler.ctx.resolve('c', 1); // abgelaufen - darf NICHT zaehlen
check('6c: jede angekommene Peilung erhöht den Kodex-Zähler',
  zaehler.state.expeditionCodex.signalsFollowed === 2, { gezaehlt: zaehler.state.expeditionCodex.signalsFollowed });
check('6c: eine verfallene Peilung zählt nicht mit',
  zaehler.ctx.resolve('c', 1) === null && zaehler.state.expeditionCodex.signalsFollowed === 2);

// ---------------------------------------------------------------- 7) Verdrahtung in der Spieldatei
check('7: das Ziel wird beim START in die Mission eingebacken, nicht live gelesen',
  /signalId \}\);/.test(src) && /const signalFund = m\.signalId \? resolveSignalFind\(m\.signalId, mult\) : null;/.test(src));
check('7: ein angesteuertes Signal wird sofort gesperrt, damit keine zweite Expedition draufgeht',
  /sig\.enRoute = true;/.test(src) && /!s\.enRoute/.test(src));
check('7: die Zielwahl wird nach dem Start zurückgesetzt',
  /state\.expeditionTargetSignal = null;/.test(src));
// Genau EIN Aufrufer (die Deklaration ausgenommen) - aus dem Haupt-Tick heraus wuerden Signale
// ohne eigenes Zutun regnen und die Entscheidung entwerten.
check('7: Signale entstehen nur bei einer heimkehrenden Expedition, nicht im Haupt-Tick',
  (src.match(/(?<!function )maybeSpawnSignal\(\)/g) || []).length === 1,
  (src.match(/.{40}maybeSpawnSignal\(\)/g) || []));
check('7: der Signalfund überschreibt den normalen Fundwurf VOR dem Schatzdepot-Finale',
  src.indexOf('const signalFund = m.signalId') < src.indexOf('} else if (state.expeditionChain && state.expeditionChain.readyFinale)'));
check('7: alle drei neuen Zustandsfelder haben einen Vorgabewert für Altstände',
  /if \(!Array\.isArray\(state\.expeditionSignals\)\) state\.expeditionSignals = \[\];/.test(src) &&
  /if \(state\.expeditionTargetSignal === undefined\) state\.expeditionTargetSignal = null;/.test(src) &&
  /if \(!Number\.isFinite\(state\.signalDrought\)\) state\.signalDrought = 0;/.test(src));
check('7: der Kodex-Zähler bekommt auch in ensureExpeditionCodex einen Vorgabewert (Altstände)',
  /if \(!Number\.isFinite\(state\.expeditionCodex\.signalsFollowed\)\) state\.expeditionCodex\.signalsFollowed = 0;/.test(src));

// ---------------------------------------------------------------- 7b) Tagesaufgabe
check('7b: es gibt eine Tagesaufgabe für Peilungen mit eigenem Icon und Sprungziel',
  /\{ key:'signal', name:'1 Peilung ansteuern', icon:'ti-antenna-bars-5'/.test(src) &&
  /nav:\{ tab:'expedition' \}/.test(src));
check('7b: sie misst den Zuwachs seit Tagesbeginn (Schnappschuss-Muster wie battle/expedition/npc)',
  /if \(key==='signal'\) return Math\.max\(0, \(\(state\.expeditionCodex\|\|\{\}\)\.signalsFollowed\|\|0\) - \(dq\.startSignalsFollowed\|\|0\)\);/.test(src));
check('7b: und der Tagesbeginn legt den Schnappschuss an',
  /startSignalsFollowed: \(state\.expeditionCodex\|\|\{\}\)\.signalsFollowed\|\|0,/.test(src));
// available-Praedikat: die Aufgabe darf gar nicht erst gezogen werden, solange der Spieler noch
// nicht genug Expeditionen fliegt, um regelmaessig Peilungen aufzufangen.
check('7b: sie kommt erst in den Pool, wenn genug Expeditionen geflogen wurden',
  /available: \(\) => \(state\.expeditionsCompleted\|\|0\) >= 15/.test(src));
check('7b: das Icon steht als CSS-Regel im Icon-Subset',
  /\.ti-antenna-bars-5:before\{content:"\\eccb"\}/.test(src));

// ---------------------------------------------------------------- 7c) Kodex-Stufe
check('7c: es gibt eine Kodex-Stufe für angesteuerte Peilungen',
  /\{ key:'signals12', name:'Signalhorcher', icon:'ti-antenna-bars-5'/.test(src) &&
  /have:\(\)=>ensureExpeditionCodex\(\)\.signalsFollowed\|\|0, need:12/.test(src));
check('7c: die Kodex-Kopfzeile zeigt den Peilungs-Zähler mit an',
  /× Schatzdepot · \$\{codex\.signalsFollowed\|\|0\}× Peilung/.test(src));

// ---------------------------------------------------------------- 7d) Galaxie-Karte: Zwischenspeicher
check('7d: die Karte schreibt nur bei geändertem Markup neu',
  /if \(inner === lastGalaxyMapMarkup\) return;/.test(src) && /lastGalaxyMapMarkup = inner;/.test(src));
check('7d: der viewBox wird trotzdem immer gesetzt (Zoom/Pan ändern das Markup nicht)',
  src.indexOf("svg.setAttribute('viewBox'") < src.indexOf('if (inner === lastGalaxyMapMarkup) return;'));
check('7d: ein leeres SVG erzwingt den Neuaufbau',
  /if \(!svg\.firstChild\) lastGalaxyMapMarkup = null;/.test(src));
// Voraussetzung fuer den Zwischenspeicher UND fuer sich ein Anzeigefehler: das Sternenfeld wurde
// jede Sekunde neu ausgewuerfelt und sprang sichtbar.
check('7d: das Sternenfeld ist deterministisch statt zufällig',
  /hashStringToFloat\('stern'\+i\+'x'\)/.test(src) &&
  !/<circle cx="\$\{\(Math\.random\(\)\*950\)/.test(src));
check('7d: das Karten-Abzeichen trägt keinen Countdown mehr (der würde den Neuaufbau erzwingen)',
  !/badges\.push\(\{ icon:'📡'[^}]*fmtDuration/.test(src));

// ---------------------------------------------------------------- 8) Anzeigestellen (CLAUDE.md 6)
check('8: der Expeditions-Reiter zeigt die Peilungen mit Restzeit an',
  /data-signal-target=/.test(src) && /Aufgefangene Peilungen/.test(src));
check('8: und der Klick-Handler dafür ist verdrahtet',
  /document\.querySelectorAll\('\[data-signal-target\]'\)/.test(src));
check('8: ohne Peilung erklärt die Box, wie man an eine kommt',
  /Keine Peilung aufgefangen/.test(src));
// Kein Signatur-Cache: die Box hat einen sichtbar herunterzaehlenden Countdown (CLAUDE.md).
check('8: die Signal-Box nutzt bewusst KEINEN Signatur-Cache (Live-Countdown)',
  !/lastSignalSig/.test(src) && /Verfällt in \$\{fmtDuration/.test(src));
check('8: die Galaxie-Karte markiert Systeme mit Peilung',
  /signalBySystem\[s\.id\]/.test(src) && /badges\.push\(\{ icon:'📡'/.test(src));
check('8: der Start meldet das angesteuerte Ziel im Protokoll',
  /Kurs auf die Peilung: /.test(src));
check('8: die Ankunft meldet eine neu aufgefangene Peilung',
  /Peilung aufgefangen: /.test(src));
check('8: die Hilfe erklärt Peilungen',
  /Expeditions-Signale \(Peilungen\)/.test(src));
check('8: die Hilfe nennt Deckel, Laufzeit und alle vier Arten',
  /höchstens 3 Peilungen/.test(src) && /nach 2 Stunden/.test(src) &&
  ['Materialpeilung', 'Technik-Echo', 'Frachtsignal', 'Kartenfragment-Signal'].every(n => new RegExp(n).test(src)));

// ---------------------------------------------------------------- 9) Echolotmast (v8.334.0)
// Das Abgrund-Standortmodul verlaengert die Frist aufgefangener Peilungen. Geprueft wird an einer
// WIRKLICH ERZEUGTEN Peilung, nicht an der Konstanten - die Frist entsteht in maybeSpawnSignal(),
// und genau dort koennte der Faktor fehlen, ohne dass irgendeine Konstante das verraet.
{
  const u = baue({ discovered: { p0:true } });
  const frist = () => {
    u.state.expeditionSignals.length = 0;      // Platz schaffen, sonst greift der Deckel
    u.ctx.spawn(true);
    const a = u.state.expeditionSignals;
    return a.length ? a[a.length-1].expiresAt - Date.now() : null;
  };
  const ohne = frist();
  check('9: ohne Mast gilt die normale Frist von zwei Stunden',
    Math.abs(ohne - u.ctx.LIFETIME) < 5000, { ohne, normal: u.ctx.LIFETIME });

  u.ctx.setMast(0.5);
  const mitHalb = frist();
  check('9: mit Mast wird die Frist laenger', mitHalb > ohne * 1.4, { ohne, mitHalb });
  check('9: und zwar genau um den Bonus (nicht irgendwie mehr)',
    Math.abs(mitHalb - u.ctx.LIFETIME * 1.5) < 5000, { mitHalb, erwartet: u.ctx.LIFETIME*1.5 });

  // Der Deckel an einem absurd hohen Bonus gemessen: Mit den heutigen Modulwerten wird er nie
  // erreicht, eine Pruefung an realistischen Zahlen koennte also gar nicht fehlschlagen.
  u.ctx.setMast(99);
  const mitAbsurd = frist();
  check('9: der Deckel haelt auch bei absurdem Bonus',
    Math.abs(mitAbsurd - u.ctx.LIFETIME * (1 + u.ctx.MAST_DECKEL)) < 5000,
    { mitAbsurd, deckel: u.ctx.MAST_DECKEL, erwartet: u.ctx.LIFETIME*(1+u.ctx.MAST_DECKEL) });

  // Die Zusicherung aus der Modulbeschreibung: bereits liegende Peilungen behalten ihre Frist.
  // Sonst wuerde ein spaeter ausgebautes Modul eine Peilung mitten im Anflug verkuerzen.
  const vorher = u.state.expeditionSignals.map(x => x.expiresAt);
  u.ctx.setMast(0);
  u.ctx.prune();
  check('9: eine bereits liegende Peilung behaelt ihre Frist, wenn der Mast wegfaellt',
    vorher.length > 0 && u.state.expeditionSignals.every((x,i) => x.expiresAt === vorher[i]),
    { vorher, nachher: u.state.expeditionSignals.map(x=>x.expiresAt) });
}

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
