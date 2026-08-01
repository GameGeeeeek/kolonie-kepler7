// Fünf Verstrickungen zwischen vorhandenen Systemen (01.08.2026).
//
// DER BEFUND, DER DAZU GEFÜHRT HAT
// --------------------------------
// Mehrere große Systeme redeten nur mit sich selbst:
//   - veteranRankOf() wurde an DREI Stellen gelesen, zweimal davon dieselbe Kampfzahl.
//   - Alle Fraktions-Rangvergünstigungen wirkten INNERHALB des Fraktionsreiters, und changeFactionRep()
//     wurde ausschließlich von Fraktions-Aktionen gerufen. Ruf war ein geschlossener Kreis.
//   - state.spyIntel wurde an fünf Stellen gelesen - alle fünf reine Anzeige.
//   - DOCTRINE_DEFS waren drei Zahlen ohne Verbindung zu Rollen, Fraktionen oder Abgrund.
//
// WIE DIESER TEST GEBAUT IST
// --------------------------
// Die ganze Spieldatei läuft in einer IIFE (Zeile 3625) - von außen ist keine einzige Funktion
// erreichbar, auch nicht im Browser. Deshalb drei Ebenen, jede mit ihrer eigenen Aufgabe:
//
//   1. RECHNUNG (Sandbox): Die neuen Helfer werden aus der echten Datei herausgeschnitten und mit
//      injizierten Abhängigkeiten ausgeführt - dasselbe Muster wie test_bonibilanz.js. Damit wird
//      die Zahl geprüft, nicht ihre Beschreibung.
//   2. VERDRAHTUNG (Quelltext): Ein richtig rechnender Helfer nützt nichts, wenn ihn niemand aufruft.
//      Jede der fünf Verbindungen wird an ihrer Verbrauchsstelle als vollständige Zeile nachgewiesen.
//   3. ANZEIGE (Browser): Die Karten müssen die neuen Zahlen auch nennen (CLAUDE.md Regel 6).
//
// Dazu der FRONTEND/BACKEND-GLEICHSTAND: Zwei der Verbindungen (Legion-Bündnis, Doktrin-Synergie)
// und der Aufklärungsvorteil werden im PvP vom Server nachgerechnet. Genau dafür gibt es in
// CLAUDE.md den Fallstrick "Backend hat teils eigene Kopien von Frontend-Formeln".
const { starteBrowser, SPIELDATEI, SPIEL_URL } = require('./lib/umgebung');
const fs = require('fs');
const path = require('path');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const src = fs.readFileSync(SPIELDATEI, 'utf8');

// Schneidet von einem Marker bis zum ersten Vorkommen des Endmarkers DAHINTER. Bewusst mit
// konkreten Endmarkern statt einer Klammerzählung - CLAUDE.md warnt ausdrücklich davor, einer
// naiven Regex über verschachtelte Array-Literale zu vertrauen.
function schnitt(von, bis, ohneEnde){
  const a = src.indexOf(von);
  if (a < 0) return null;
  const b = src.indexOf(bis, a + von.length);
  return b < 0 ? null : src.slice(a, ohneEnde ? b : b + bis.length);
}

// ================================================================= 1. RECHNUNG (Sandbox)
// Die Endmarker sind die jeweils NÄCHSTE Deklaration, ausgeschlossen - sonst nähme der Schnitt
// deren öffnende Klammer mit und der Block wäre unausgeglichen.
const blockFraktion = schnitt('const FACTION_OUTSIDE = {', '  // Ein Satz für die Fraktionskarte', true);
const blockVeteran  = schnitt('const VETERAN_ROLE_EXTRA = {', '  // Erklärzeile für die Veteranenkarte', true);
const blockDoktrin  = schnitt('const DOCTRINE_DEFS = [', '\n  ];');
const blockDokFn    = schnitt('function doctrineSynActive(doc){', '\n  }');
const blockSpy      = schnitt('const SPY_EDGE_MS = ', '\n  }');
check('Fraktions-Block ausgeschnitten', !!blockFraktion);
check('Veteranen-Block ausgeschnitten', !!blockVeteran);
check('Doktrin-Tabelle ausgeschnitten', !!blockDoktrin);
check('Doktrin-Funktionen ausgeschnitten', !!blockDokFn);
check('Spionage-Block ausgeschnitten', !!blockSpy);
if (!blockFraktion || !blockVeteran || !blockDoktrin || !blockDokFn || !blockSpy){
  console.log('\nFAIL'); process.exit(1);
}

// --- B: Fraktionsbündnis wirkt außerhalb ---------------------------------------------------------
// factionEffectLevel wird injiziert: 0 = kein Effekt, 1 = freundlich, 2 = verbündet.
function fraktionsBonus(fid, stufe){
  const ctx = {};
  new Function('ctx', 'factionEffectLevel',
    blockFraktion + ';ctx.b=factionOutsideBonus;ctx.t=FACTION_OUTSIDE;'
  )(ctx, () => stufe);
  return { bonus: ctx.b(fid), tabelle: ctx.t };
}
const legionTab = fraktionsBonus('legion', 0).tabelle;
check('vier Fraktionen haben einen Wirkort außerhalb',
  ['legion','kartell','void','schatten'].every(f => legionTab[f]), Object.keys(legionTab));
for (const fid of ['legion','kartell','void','schatten']){
  const ohne = fraktionsBonus(fid, 0).bonus;
  const freund = fraktionsBonus(fid, 1).bonus;
  const verb = fraktionsBonus(fid, 2).bonus;
  check(fid + ': 0 ohne Bündnis, und Verbündet bringt mehr als Freundlich',
    ohne === 0 && freund > 0 && verb > freund, { ohne, freund, verb });
}
check('Legion-Bündnis: +3% freundlich / +6% verbündet (Backend-Spiegel)',
  fraktionsBonus('legion', 1).bonus === 0.03 && fraktionsBonus('legion', 2).bonus === 0.06);

// --- A: Veteranenrang x Planetenrolle ------------------------------------------------------------
// planetRoleOf und veteranRankOf werden injiziert - so misst der Test die KOPPLUNG, nicht die
// Rangtabelle (die hat ihren eigenen Ort und darf sich unabhängig verschieben).
function vetExtra(rolle, rangBonus, art){
  const ctx = {};
  new Function('ctx', 'planetRoleOf', 'veteranRankOf',
    blockVeteran + ';ctx.f=veteranRoleExtra;ctx.t=VETERAN_ROLE_EXTRA;'
  )(ctx, () => (rolle ? { key: rolle } : null), () => ({ bonus: rangBonus }));
  return { wert: ctx.f('home', art), tabelle: ctx.t };
}
const vetTab = vetExtra(null, 0, 'def').tabelle;
check('genau drei Rollen sind mit dem Veteranenrang gekoppelt',
  Object.keys(vetTab).length === 3, Object.keys(vetTab));
check('Festungs-Welt: der Rang zählt auf die Verteidigung ein zweites Mal (Faktor 1,0)',
  vetExtra('fortress', 0.08, 'def').wert === 0.08, vetExtra('fortress', 0.08, 'def').wert);
check('Werft-Welt: Bauzeit-Anteil ist das 1,5-fache des Rangs',
  Math.abs(vetExtra('shipyard', 0.08, 'build').wert - 0.12) < 1e-9);
check('Tiefenhafen: Splitter-Anteil ist das Doppelte des Rangs',
  Math.abs(vetExtra('deepport', 0.08, 'abgrund').wert - 0.16) < 1e-9);
// Zwei Gegenproben. Die erste verhindert, dass die nächste "Vollständigkeits"-Runde allen sieben
// Rollen etwas gibt; die zweite, dass eine Rolle für die FALSCHE Wirkungsart zahlt.
for (const rolle of ['mining','trade','science','logistics']){
  check(rolle + ' bekommt vom Veteranenrang nichts',
    ['def','build','abgrund'].every(a => vetExtra(rolle, 0.08, a).wert === 0));
}
check('Festungs-Welt zahlt NICHT auf Bauzeit oder Splitter',
  vetExtra('fortress', 0.08, 'build').wert === 0 && vetExtra('fortress', 0.08, 'abgrund').wert === 0);
check('ohne Kampferfahrung ist die Kopplung überall 0',
  ['fortress','shipyard','deepport'].every((r,i) => vetExtra(r, 0, ['def','build','abgrund'][i]).wert === 0));

// --- E: Doktrin-Synergie -------------------------------------------------------------------------
function doktrin(key, rollen){
  const ctx = {};
  new Function('ctx', 'state', 'hasRoleAnywhere',
    blockDoktrin + ';' + blockDokFn.replace('function doctrineSynActive', 'function doctrineSynActive')
    + '\n  function activeDoctrine(){ return state.doctrine ? DOCTRINE_DEFS.find(d=>d.key===state.doctrine) : null; }'
    + ';ctx.m=doctrineMultOf;ctx.a=doctrineSynActive;ctx.d=DOCTRINE_DEFS;'
  )(ctx, { doctrine: key }, r => rollen.includes(r));
  return ctx;
}
check('jede Doktrin hat eine Synergie mit einer Rolle',
  doktrin(null, []).d.every(d => d.syn && d.syn.rolle && d.syn.text), doktrin(null, []).d.map(d => d.key + '→' + (d.syn||{}).rolle));
check('Offensiv-Doktrin ohne Werft-Welt: nur der Grundwert 1,20',
  doktrin('doc_offensive', []).m('atkMult') === 1.20);
check('Offensiv-Doktrin MIT Werft-Welt: 1,20 × 1,08',
  Math.abs(doktrin('doc_offensive', ['shipyard']).m('atkMult') - 1.20*1.08) < 1e-9);
check('  ... und die falsche Rolle bringt ihr nichts',
  doktrin('doc_offensive', ['fortress','trade','mining']).m('atkMult') === 1.20);
check('Verteidigungs-Doktrin MIT Festungs-Welt: 1,20 × 1,08',
  Math.abs(doktrin('doc_defensive', ['fortress']).m('defMult') - 1.20*1.08) < 1e-9);
check('Logistik-Doktrin MIT Handels-Welt wirkt auf Treibstoff UND Lager',
  Math.abs(doktrin('doc_logistics', ['trade']).m('fuelMult') - 0.80*0.92) < 1e-9
  && Math.abs(doktrin('doc_logistics', ['trade']).m('cargoMult') - 1.20*1.08) < 1e-9);
check('ohne Doktrin ist jeder Multiplikator neutral',
  ['atkMult','defMult','fuelMult','cargoMult'].every(s => doktrin(null, ['shipyard','fortress','trade']).m(s) === 1));
// Die Synergie darf die andere Seite nicht anfassen - sonst wäre die Offensiv-Doktrin heimlich auch
// eine Verteidigungs-Doktrin.
check('die Synergie einer Doktrin fasst nur ihre eigene Seite an',
  doktrin('doc_offensive', ['shipyard']).m('defMult') === 0.85
  && doktrin('doc_defensive', ['fortress']).m('atkMult') === 0.85);

// --- D: Aufklärungsvorteil -----------------------------------------------------------------------
function spyEdge(intel){
  const ctx = {};
  new Function('ctx', 'state', blockSpy + ';ctx.f=spyIntelEdge;ctx.b=SPY_EDGE_BONUS;ctx.ms=SPY_EDGE_MS;')
    (ctx, { spyIntel: intel ? { gegner: intel } : {} });
  return ctx;
}
const jetzt = Date.now();
check('frische, unentdeckte Aufklärung gibt den Zuschlag',
  spyEdge({ capturedAt: jetzt, detected: false }).f('gegner') === spyEdge(null).b);
check('ohne Aufklärung kein Zuschlag', spyEdge(null).f('gegner') === 0);
check('ENTDECKTE Aufklärung gibt keinen Zuschlag - die Spionageabwehr verteidigt zweimal',
  spyEdge({ capturedAt: jetzt, detected: true }).f('gegner') === 0);
check('Aufklärung älter als 30 Minuten gibt keinen Zuschlag',
  spyEdge({ capturedAt: jetzt - 31*60*1000, detected: false }).f('gegner') === 0);
check('  ... 29 Minuten alt aber schon',
  spyEdge({ capturedAt: jetzt - 29*60*1000, detected: false }).f('gegner') > 0);
check('ein anderes Ziel bekommt den Zuschlag nicht',
  spyEdge({ capturedAt: jetzt, detected: false }).f('jemand-anders') === 0);

// --- C: Fundmeldung ------------------------------------------------------------------------------
const fundKosten = Number((src.match(/FUNDMELDUNG_SPLITTER = (\d+)/) || [])[1]);
const fundRep = Number((src.match(/FUNDMELDUNG_REP = (\d+)/) || [])[1]);
const fundRepVoid = Number((src.match(/FUNDMELDUNG_REP_VOID = (\d+)/) || [])[1]);
check('Fundmeldung: Kosten und Ertrag sind gesetzt', fundKosten > 0 && fundRep > 0, { fundKosten, fundRep });
check('die Void-Marodeure zahlen mehr - die Tiefe ist ihr Thema', fundRepVoid > fundRep, { fundRep, fundRepVoid });
// Bergungsgut bleibt unhandelbar: Die Fundmeldung darf NUR Splitter anfassen. Sonst wäre der
// ausdrückliche Verzicht beim Tiefenaufkäufer stillschweigend aufgehoben.
const meldeBlock = schnitt('function meldeFund(fid){', '\n  }');
check('meldeFund() fasst ausschließlich Splitter an, kein Bergungsgut',
  !!meldeBlock && /a\.splitter/.test(meldeBlock) && !/bergungsgut/i.test(meldeBlock));
check('meldeFund() setzt eine Sperrzeit', !!meldeBlock && /state\.fundmeldungLastAt\[fid\] = Date\.now\(\)/.test(meldeBlock));

// ================================================================= 2. VERDRAHTUNG (Quelltext)
// Ein richtig rechnender Helfer nützt nichts, wenn ihn niemand aufruft. Jede Verbindung an ihrer
// Verbrauchsstelle - als vollständige Zeile, nicht als Namensfund irgendwo in der Datei.
const verdrahtung = [
  ['Legion → Angriffskraft',      /combatBonus \+= factionOutsideBonus\('legion'\);/g, 2],
  ['Kartell → Handelsrouten',     /routeYieldMult\(\)\{[^\n]*factionOutsideBonus\('kartell'\)/, 1],
  ['Void → Abgrundsplitter',      /factionOutsideBonus\('void'\)/, 1],
  ['Schatten → Spionage-Tarnung', /Math\.min\(0\.6, shieldLvl\*0\.06\) \* \(1 - factionOutsideBonus\('schatten'\)\)/, 1],
  ['Veteran → Verteidigung',      /combatBonus \+= veteranRoleExtra\(planetKey, 'def'\);/, 1],
  ['Veteran → Schiffsbauzeit',    /e \*= \(1 - veteranRoleExtra\(planetKey, 'build'\)\);/, 1],
  ['Veteran → Abgrundsplitter',   /veteranRoleExtra\(planetKey, 'abgrund'\)/, 1],
  ['Aufklärung → PvP-Vorschau',   /attackPower\(previewFleet, state\.activeBasePlanet\) \* \(1 \+ spyEdge\)/, 1],
  ['Aufklärung → Solo-Auflösung', /attackPower\(m\.composition\|\|fleet, planetKey\) \* \(1 \+ spyIntelEdge\(m\.targetId\)\)/, 1],
  ['Aufklärung → Spionagebericht',/attackPower\(currentFleet\(\)\) \* \(1 \+ berichtEdge\)/, 1]
];
for (const [name, re, mind] of verdrahtung){
  const n = re.global ? (src.match(re) || []).length : (re.test(src) ? 1 : 0);
  check('verdrahtet: ' + name, n >= mind, { gefunden: n, erwartet: mind });
}
// Die vier Doktrin-Anwendungsstellen laufen jetzt durch EINE Funktion. Bleibt eine der alten Zeilen
// stehen, vergisst genau sie die Synergie - das war der eigentliche Punkt der Umstellung.
for (const alt of ['if (doc) power *= doc.atkMult;', 'if (doc) power *= doc.defMult;',
                   'if (doc) cost *= doc.fuelMult;', 'if (doc) cap *= doc.cargoMult;']){
  check('alte Doktrin-Zeile ist weg: ' + alt, !src.includes(alt));
}
check('alle vier Doktrin-Seiten laufen über doctrineMultOf()',
  ["doctrineMultOf('atkMult')", "doctrineMultOf('defMult')",
   "doctrineMultOf('fuelMult')", "doctrineMultOf('cargoMult')"].every(s => src.includes(s)));

// ================================================================= 3. FRONTEND/BACKEND-GLEICHSTAND
const BE_PFAD = path.join(path.dirname(SPIELDATEI), '..', 'kolonie-kepler7-backend', 'server.js');
if (!fs.existsSync(BE_PFAD)){
  console.log('HINWEIS - Backend-Repo nicht daneben ausgecheckt, Gleichstands-Prüfung übersprungen.');
} else {
  const be = fs.readFileSync(BE_PFAD, 'utf8');
  const feLegion = (blockFraktion.match(/legion:[^\n]*freundlich:([\d.]+),\s*verbuendet:([\d.]+)/) || []);
  const beLegion = (be.match(/LEGION_ALLY_ATK\s*=\s*\{\s*freundlich:\s*([\d.]+),\s*verbuendet:\s*([\d.]+)/) || []);
  check('Legion-Bündnis: Frontend und Backend nennen dieselben Werte',
    !!feLegion[1] && feLegion[1] === beLegion[1] && feLegion[2] === beLegion[2],
    { frontend:[feLegion[1], feLegion[2]], backend:[beLegion[1], beLegion[2]] });
  check('Legion-Bündnis: Backend nutzt dieselben Ruf-Schwellen 30/70 wie repTierOf()',
    /rep >= 70\) return LEGION_ALLY_ATK\.verbuendet/.test(be) && /rep >= 30\) return LEGION_ALLY_ATK\.freundlich/.test(be));
  const feEdge = (src.match(/SPY_EDGE_BONUS = ([\d.]+)/) || [])[1];
  const beEdge = (be.match(/SPY_EDGE_BONUS = ([\d.]+)/) || [])[1];
  check('Aufklärungsvorteil: gleicher Zuschlag auf beiden Seiten', !!feEdge && feEdge === beEdge, { feEdge, beEdge });
  check('Aufklärungsvorteil: gleiches Zeitfenster auf beiden Seiten',
    /SPY_EDGE_MS = 30\*60\*1000/.test(src) && /SPY_EDGE_MS = 30 \* 60 \* 1000/.test(be));
  check('Aufklärungsvorteil: Backend ignoriert entdeckte Aufklärung genau wie das Frontend',
    /if \(!it \|\| it\.detected\) return 0;/.test(be));
  check('Aufklärungsvorteil: Backend wendet ihn auf BEIDE Angriffskraft-Werte an',
    /computeAttackPower\(attacker, targetFleetSummary\) \* spyEdgeMult/.test(be)
    && /computeAttackPower\(attacker, null\) \* spyEdgeMult/.test(be));
  const beSynVon = be.indexOf('const DOCTRINE_SYN = {');
  const beSyn = beSynVon > 0 ? be.slice(beSynVon, be.indexOf('};', beSynVon)) : '';
  for (const [dk, rolle] of [['doc_offensive','shipyard'], ['doc_defensive','fortress'], ['doc_logistics','trade']]){
    const feHat = new RegExp("key:'" + dk + "'[\\s\\S]{0,1200}?syn:\\{ rolle:'" + rolle + "'").test(src);
    const beHat = new RegExp(dk + ":\\s*\\{\\s*rolle:\\s*'" + rolle + "'").test(beSyn);
    check('Doktrin-Synergie ' + dk + ' → ' + rolle + ': beide Seiten einig', feHat && beHat, { feHat, beHat });
  }
  check('Doktrin-Synergie: Backend prüft die Rolle wirklich (nicht nur Tabelle)',
    /hasRoleAnywhereServer\(save, syn\.rolle\)/.test(be));

  // Und jetzt die Backend-Seite AUSFÜHREN statt sie nur zu lesen. Gleiche Konstanten heißen noch
  // nicht gleiches Verhalten: Der Server liest andere Felder (save.factionRep statt state.factionRep,
  // save.planetSpecialization statt hasRoleAnywhere) und hat seine eigenen Schwellen ausgeschrieben.
  // Ein Zahlendreher in `rep >= 30` wäre von der Textprüfung oben nicht zu sehen.
  function beSchnitt(von, bis, ohneEnde){
    const a = be.indexOf(von); if (a < 0) return '';
    const b = be.indexOf(bis, a + von.length);
    return b < 0 ? '' : be.slice(a, ohneEnde ? b : b + bis.length);
  }
  const beCtx = {};
  new Function('ctx',
    beSchnitt('const LEGION_ALLY_ATK', 'function spyIntelEdge(save, targetUserId) {', true)
    + beSchnitt('function spyIntelEdge(save, targetUserId) {', '\n}')
    + beSchnitt('const DOCTRINE_MULTS', 'function doctrineMult(save, side) {', true)
    + beSchnitt('function doctrineMult(save, side) {', '\n}')
    + ';ctx.legion=legionAllianceBonus;ctx.spy=spyIntelEdge;ctx.doc=doctrineMult;'
  )(beCtx);
  const nu = Date.now();
  check('Backend rechnet: Legion 0 / 0,03 / 0,06 an den Schwellen 0 / 30 / 70',
    beCtx.legion({ factionRep:{ legion:29 } }) === 0
    && beCtx.legion({ factionRep:{ legion:30 } }) === 0.03
    && beCtx.legion({ factionRep:{ legion:69 } }) === 0.03
    && beCtx.legion({ factionRep:{ legion:70 } }) === 0.06);
  check('Backend rechnet: Feindschaft gibt keinen Kampfbonus und ein fehlendes Feld stürzt nicht ab',
    beCtx.legion({ factionRep:{ legion:-80 } }) === 0 && beCtx.legion({}) === 0);
  check('Backend rechnet: Aufklärungsvorteil frisch/entdeckt/alt/leer',
    beCtx.spy({ spyIntel:{ x:{ capturedAt:nu, detected:false } } }, 'x') === Number(feEdge)
    && beCtx.spy({ spyIntel:{ x:{ capturedAt:nu, detected:true } } }, 'x') === 0
    && beCtx.spy({ spyIntel:{ x:{ capturedAt:nu - 31*60*1000 } } }, 'x') === 0
    && beCtx.spy({}, 'x') === 0);
  check('Backend rechnet: Doktrin-Synergie nur mit der PASSENDEN Rolle',
    beCtx.doc({ doctrine:'doc_offensive', planetSpecialization:{} }, 'atk') === 1.20
    && Math.abs(beCtx.doc({ doctrine:'doc_offensive', planetSpecialization:{ a:'shipyard' } }, 'atk') - 1.20*1.08) < 1e-9
    && beCtx.doc({ doctrine:'doc_offensive', planetSpecialization:{ a:'fortress' } }, 'atk') === 1.20
    && beCtx.doc({}, 'atk') === 1);
  // Der eigentliche Gleichstand: dieselbe Lage muss auf beiden Seiten dieselbe Zahl ergeben.
  for (const [dk, rolle, seite] of [['doc_offensive','shipyard','atk'], ['doc_defensive','fortress','def'],
                                    ['doc_logistics','trade','atk']]){
    const feWert = doktrin(dk, [rolle]).m(seite + 'Mult');
    const beWert = beCtx.doc({ doctrine:dk, planetSpecialization:{ a:rolle } }, seite);
    check('gleiche Zahl auf beiden Seiten: ' + dk + ' + ' + rolle + ' (' + seite + ')',
      Math.abs(feWert - beWert) < 1e-9, { feWert, beWert });
  }
}

// ================================================================= 4. ANZEIGE (Browser)
// CLAUDE.md Regel 6: Eine Mechanik ohne Anzeigestelle ist die Hälfte des Fehlers. Geprüft wird an
// den Karten, die der Spieler wirklich sieht.
function backendStub(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s=200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'K', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

(async () => {
  // Doktrinen brauchen rkampf2 und rschildmatrix je Stufe 5, sonst zeigt die Box nur "gesperrt" -
  // dann prüfte der Test die Sperrmeldung statt der Synergie.
  const store = { 'kepler7-save-v3': JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
    seenTabHints:{ basis:1, verteidigung:1, forschung:1, flotte:1, galaxie:1 },
    resources:{ energie:9e5, erz:9e5, kristalle:9e5, deuterium:9e5, antimaterie:9e4, forschungspunkte:9e4 },
    buildings:{ solar:22, mine:20, labor:14, werft:15, lager:14, turm:12, schild:9 },
    research:{ rsolar:8, rkampf:8, rkampf2:6, rschildmatrix:6 },
    fleet:{ jaeger:500, schlachtschiff:60, frachter:40, spaeher:10, missions:[] },
    colonies:{}, activeBasePlanet:'home', doctrine:'doc_offensive',
    veteranXp:{ home: 5000 }, planetSpecialization:{ home:'fortress' },
    player:{ id:'u', name:'K', allianceTag:'', avatarKey:null }, battleStats:{ wins:20, losses:3 },
    xp:120000, buffs:[], lastTick:Date.now() }) };

  const b = await starteBrowser();
  const ctx = await b.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backendStub(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2600);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
      .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; });
  });

  // Veteranenkarte steht im Galaxie-Tab über der Angriffsflotten-Auswahl.
  for (const tab of ['galaxie','forschung','basis']){
    await page.evaluate(t => { const el = document.querySelector('.tab-btn[data-tab="'+t+'"]'); if (el) el.click(); }, tab);
    await page.waitForTimeout(900);
  }
  const sicht = await page.evaluate(() => {
    const txt = id => { const e = document.getElementById(id); return e ? e.textContent : ''; };
    return { doktrin: txt('doctrineBox'), body: document.body.textContent || '' };
  });
  check('Doktrin-Karte nennt die Synergie', /Synergie/.test(sicht.doktrin), sicht.doktrin.slice(0, 160));
  check('Doktrin-Karte weist aus, dass die Werft-Welt fehlt',
    /keine Werft-Welt/.test(sicht.doktrin), sicht.doktrin.slice(0, 200));

  // Veteranenkarte: der Rollen-Zusatz muss dastehen (Festungs-Welt mit Höchstrang im Spielstand).
  check('Veteranenkarte nennt die Rollen-Zusatzwirkung',
    /zählt auf ihre Verteidigung ein zweites Mal/.test(sicht.body), null);
  check('Hilfe kennt den Aufklärungsvorteil', /Aufklärungsvorteil/.test(src));
  check('Hilfe kennt die Fundmeldung', /Fundmeldung/.test(src));

  check('keine Skriptfehler', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})();
