// Fraktions-Rivalitäten und Parteinahme im Krieg v8.298.20 (Fraktions-Ausbau, Paket 3/6).
//
// Ausgangslage (Spieler-Screenshot): Ruf 100 bei beiden sichtbaren Fraktionen, Verbuendet,
// dauerhaft. Ruf konnte nur steigen; wer einmal oben war, hatte das ganze System fuer immer
// abgeschlossen. Der Kastentext behauptete zwar, die Fraktionen wuerden sich gegenseitig Gebiete
// abnehmen - spielerisch war das folgenlos.
//
// Geprueft wird:
//   1) es gibt genau zwei Rivalen-Paare, symmetrisch und ohne Selbstbezug
//   2) Ueberschwappen: Zuwachs kostet beim Rivalen, VERLUST nuetzt ihm (beides!)
//   3) Buendnis-Exklusivitaet: zwei Rivalen koennen nicht gleichzeitig verbuendet sein
//   4) Altstaende mit doppeltem Buendnis werden deterministisch bereinigt (staerkeres gewinnt)
//   5) hoechstens ZWEI Buendnisse insgesamt sind erreichbar - der Endzustand aus dem Screenshot
//      ist damit unmoeglich
//   6) die Schwellen 30/70 und der Kartell-Rabatt sind UNANGETASTET (Backend-Paritaet!)
const { SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

// ---------------------------------------------------------------- Block ausführbar machen
const von = src.indexOf('const FACTION_RIVALS = {');
const bis = src.indexOf('function changeFactionRep', von);
check('Rivalen-Block gefunden', von > 0 && bis > von);
if (von < 0 || bis < von){ console.log('\nFAIL'); process.exit(1); }
const block = src.slice(von, bis);

function baue(rep){
  const ctx = {};
  const state = { factionRep: Object.assign({ kartell:0, legion:0, void:0, schatten:0 }, rep || {}) };
  const meldungen = [];
  new Function('ctx', 'state', 'log', 'galaxyCache', 'REP_MIN', 'REP_MAX',
    block + ';ctx.RIVALS=FACTION_RIVALS;ctx.SPILL=RIVAL_SPILL;ctx.ALLY=REP_ALLY_THRESHOLD;' +
    'ctx.rivalOf=rivalOf;ctx.spill=applyRivalSpill;ctx.enforce=enforceRivalExclusivity;ctx.enforceAll=enforceAllRivalExclusivity;ctx.setRaw=setFactionRepRaw;'
  )(ctx, state, (t)=>meldungen.push(t), { factions:{
      kartell:{id:'kartell',name:'Aschen-Kartell'}, legion:{id:'legion',name:'Eisenlegion'},
      void:{id:'void',name:'Void-Marodeure'}, schatten:{id:'schatten',name:'Schattenbund'} } },
    -100, 100);
  return { ctx, state, meldungen };
}

const u = baue();
const R = u.ctx.RIVALS;

// ---------------------------------------------------------------- 1) Paare
check('1: alle vier Fraktionen haben einen Rivalen',
  ['kartell','legion','void','schatten'].every(f => !!R[f]), R);
check('1: die Rivalität ist symmetrisch',
  Object.keys(R).every(f => R[R[f]] === f), Object.keys(R).map(f => f+'->'+R[f]+'->'+R[R[f]]));
check('1: keine Fraktion ist ihr eigener Rivale', Object.keys(R).every(f => R[f] !== f));
check('1: es sind genau zwei Paare (Wirtschaft und Militär)',
  R.kartell === 'schatten' && R.legion === 'void', R);
check('1: der Überschwapp-Anteil ist spürbar, aber kein Nullsummenspiel',
  u.ctx.SPILL > 0.1 && u.ctx.SPILL < 1, u.ctx.SPILL);

// ---------------------------------------------------------------- 2) Überschwappen
const g = baue({ legion: 40, void: 40 });
g.ctx.spill('legion', +20);
check('2: Ruf-Gewinn kostet beim Rivalen',
  g.state.factionRep.void < 40, { void: g.state.factionRep.void, erwartetEtwa: 40 - Math.round(20*u.ctx.SPILL) });
check('2: und zwar ungefähr der eingestellte Anteil',
  g.state.factionRep.void === 40 - Math.round(20*u.ctx.SPILL), g.state.factionRep.void);
const v = baue({ legion: 40, void: 40 });
v.ctx.spill('legion', -20);
check('2: Ruf-VERLUST nützt dem Rivalen ("der Feind meines Feindes")',
  v.state.factionRep.void > 40, v.state.factionRep.void);
const k = baue({ kartell: 10, schatten: 10 });
k.ctx.spill('kartell', +3);
check('2: auch kleine Änderungen kommen an (mindestens 1 Punkt)',
  k.state.factionRep.schatten === 9, k.state.factionRep.schatten);
// Das Ueberschwappen darf die andere Haelfte nicht beruehren.
const q = baue({ kartell: 50, schatten: 50, legion: 50, void: 50 });
q.ctx.spill('kartell', +20);
check('2: das andere Paar bleibt unberührt',
  q.state.factionRep.legion === 50 && q.state.factionRep.void === 50,
  { legion: q.state.factionRep.legion, void: q.state.factionRep.void });
// Grenzen halten.
const gr = baue({ kartell: 0, schatten: -100 });
gr.ctx.spill('kartell', +50);
check('2: der Rivale fällt nicht unter das Minimum', gr.state.factionRep.schatten === -100, gr.state.factionRep.schatten);

// ---------------------------------------------------------------- 3) Bündnis-Exklusivität
const ALLY = u.ctx.ALLY;
const b = baue({ legion: 85, void: 90 });
const gedreht = b.ctx.enforce('legion');
check('3: zwei Rivalen können nicht beide verbündet sein', gedreht === true);
check('3: der Rivale fällt knapp unter die Bündnis-Schwelle, nicht ins Bodenlose',
  b.state.factionRep.void === ALLY - 1, { void: b.state.factionRep.void, schwelle: ALLY });
check('3: die bevorzugte Fraktion behält ihr Bündnis', b.state.factionRep.legion === 85);
check('3: der Spieler wird darüber informiert',
  b.meldungen.some(t => /kündigt das Bündnis auf/.test(t)), b.meldungen);
const c = baue({ legion: 85, void: 40 });
check('3: steht der Rivale ohnehin nicht im Bündnis, passiert nichts',
  c.ctx.enforce('legion') === false && c.state.factionRep.void === 40);
const d = baue({ legion: 40, void: 85 });
check('3: und ohne eigenes Bündnis ebenfalls nicht',
  d.ctx.enforce('legion') === false && d.state.factionRep.void === 85);

// ---------------------------------------------------------------- 4) Altstände
const alt = baue({ kartell: 100, schatten: 100, legion: 100, void: 100 });
alt.ctx.enforceAll();
const verbuendet = ['kartell','schatten','legion','void'].filter(f => alt.state.factionRep[f] >= ALLY);
check('4: ein Altstand mit vier Bündnissen behält genau zwei', verbuendet.length === 2, alt.state.factionRep);
check('4: und zwar eines je Paar',
  (alt.state.factionRep.kartell >= ALLY) !== (alt.state.factionRep.schatten >= ALLY) &&
  (alt.state.factionRep.legion >= ALLY) !== (alt.state.factionRep.void >= ALLY));
const stark = baue({ legion: 75, void: 95 });
stark.ctx.enforceAll();
check('4: bei ungleichem Ruf gewinnt das STÄRKERE Bündnis',
  stark.state.factionRep.void === 95 && stark.state.factionRep.legion === ALLY - 1, stark.state.factionRep);
// Determinismus bei Gleichstand: zweimal derselbe Ausgang, nicht zufaellig.
const t1 = baue({ legion: 80, void: 80 }); t1.ctx.enforceAll();
const t2 = baue({ legion: 80, void: 80 }); t2.ctx.enforceAll();
check('4: bei Gleichstand ist das Ergebnis deterministisch, nicht zufällig',
  JSON.stringify(t1.state.factionRep) === JSON.stringify(t2.state.factionRep), t1.state.factionRep);
check('4: mehrfaches Aufrufen ändert nichts mehr (stabiler Zustand)',
  (() => { const x = baue({ kartell:100, schatten:100 }); x.ctx.enforceAll(); const a1 = JSON.stringify(x.state.factionRep); x.ctx.enforceAll(); x.ctx.enforceAll(); return a1 === JSON.stringify(x.state.factionRep); })());

// ---------------------------------------------------------------- 5) Endzustand unmöglich
// Der Kern der Aufgabe: "alle vier auf Verbuendet" darf sich nicht mehr herstellen lassen.
const sim = baue({});
for (let runde = 0; runde < 400; runde++){
  for (const f of ['kartell','legion','void','schatten']){
    sim.ctx.setRaw(f, (sim.state.factionRep[f]||0) + 12);
    sim.ctx.spill(f, +12);
    sim.ctx.enforce(f);
  }
}
const amEnde = ['kartell','schatten','legion','void'].filter(f => sim.state.factionRep[f] >= ALLY);
check('5: selbst mit 400 Runden Ruf-Aufbau bleiben höchstens zwei Bündnisse',
  amEnde.length <= 2, { verbuendet: amEnde, stand: sim.state.factionRep });
check('5: zwei Bündnisse sind aber sehr wohl erreichbar (nicht überkorrigiert)',
  amEnde.length === 2, { verbuendet: amEnde });

// ---------------------------------------------------------------- 6) Backend-Parität
// Die Schwellen 30/70 und der Kartell-Marktrabatt sind im Backend gespiegelt
// (marketDiscountPctFor in server.js). Eine einseitige Aenderung hier wuerde Anzeige und
// Server-Rechnung auseinanderlaufen lassen - deshalb festgenagelt.
check('6: die Bündnis-Schwelle ist unverändert 70', ALLY === 70, ALLY);
check('6: repTierOf nutzt weiterhin 70 und 30',
  /if \(rep >= 70\) return \{ key:'verbuendet'/.test(src) && /if \(rep >= 30\) return \{ key:'freundlich'/.test(src));
check('6: der Kartell-Marktrabatt ist unverändert 5%/10%',
  /let pct = lvl === 2 \? 0\.10 : \(lvl === 1 \? 0\.05 : 0\);/.test(src));

// ---------------------------------------------------------------- 7) Verdrahtung
check('7: das Überschwappen hängt an changeFactionRep',
  /applyRivalSpill\(fid, delta\);/.test(src));
check('7: und die Exklusivität greift nur bei einem Ruf-GEWINN',
  /if \(delta > 0\) enforceRivalExclusivity\(fid\);/.test(src));
check('7: Altstände werden beim Rendern bereinigt',
  /enforceAllRivalExclusivity\(\);/.test(src));
check('7: das Überschwappen läuft NICHT über changeFactionRep (keine Endlosschleife)',
  !/function applyRivalSpill[\s\S]{0,400}changeFactionRep/.test(src));
// Parteinahme im Krieg
check('7: Kriegsparteien werden über den Namen der Fraktion zugeordnet',
  /function warFactionIdByName\(name\)/.test(src));
check('7: die Parteinahme kostet echte Ressourcen und gilt einmal je Krieg',
  /if \(!canAfford\(WAR_SUPPORT_COST\)\)/.test(src) && /if \(warSupportedSide\(\)\)\{ log\('Du hast in diesem Krieg bereits Partei ergriffen/.test(src));
check('7: der Kriegsschlüssel enthält das Ablaufdatum (neuer Krieg = neue Entscheidung)',
  /w\.factionA\+'\|'\+w\.factionB\+'\|'\+w\.system\+'\|'\+\(w\.expiresAt\|\|0\)/.test(src));
check('7: nicht-diplomatische Kriegsparteien lassen sich nicht unterstützen',
  /\(keine Diplomatie\)/.test(src));
check('7: die Parteinahme läuft über changeFactionRep - das Überschwappen greift also automatisch',
  /changeFactionRep\(fid, WAR_SUPPORT_REP\);/.test(src));
check('7: beide neuen Zustandsfelder haben einen Vorgabewert',
  (src.match(/if \(state\.warSupport === undefined\) state\.warSupport = null;/g)||[]).length === 2 &&
  (src.match(/if \(state\.warSidesTaken === undefined\) state\.warSidesTaken = 0;/g)||[]).length === 2);

// ---------------------------------------------------------------- 8) Anzeigestellen (CLAUDE.md 6)
check('8: jede Fraktionskarte nennt ihren Rivalen', /Rivale: <strong>\$\{factionNameOf\(rival\)\}<\/strong>/.test(src));
check('8: und weist auf die Bündnis-Sperre hin, wenn sie greift',
  /solange dieses Bündnis steht, ist dort keines möglich/.test(src));
check('8: die Kriegskarte steht im Fraktions-Kasten', /Krieg um \$\{sysName\}/.test(src) && /data-war-support=/.test(src));
check('8: und ist verdrahtet', /\[data-war-support\]/.test(src));
check('8: der Einleitungstext des Kastens erklärt die Rivalitäten',
  /Je zwei stehen sich als <strong>Rivalen<\/strong> gegenüber/.test(src));
check('8: die Hilfe hat einen eigenen Abschnitt zu Rivalitäten',
  /title:'Rivalitäten: du kannst nicht mit allen befreundet sein'/.test(src));
check('8: und einen zu Fraktionskriegen', /title:'Fraktionskriege: Partei ergreifen'/.test(src));
check('8: die Hilfe nennt die richtigen Kosten und den richtigen Ruf-Gewinn',
  /4\.000 Erz, 2\.500 Kristalle, 1\.200 Deuterium/.test(src) && /\+22 Ruf und 800 Kredite/.test(src));
check('8: neuer Erfolg auf die Parteinahme, mit Kategorie und Icon',
  /key:'kriegspartei'/.test(src) && /kriegspartei:'handel'/.test(src) && /kriegspartei:'ti-sword'/.test(src));

console.log(fail ? '\nFAIL' : '\nPASS');
process.exit(fail ? 1 : 0);
