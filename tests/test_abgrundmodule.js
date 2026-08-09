// Die vier Abgrund-Standortmodule (28.07.2026, v8.334.0, Roadmap Phase 2).
//
// Drucktank, Echolotmast, Splitterofen, Nullfeldanker. Sie sind der eigentliche Punkt der Uebung:
// gefunden werden sie NUR unten, wirken tun sie OBEN. Ein Spieler, der nie taucht, soll sie sich
// wuenschen; einer, der taucht, soll etwas davon im normalen Spiel haben.
//
// Was hier geprueft wird und warum:
//
//   1) Jedes Modul hat eine VERRECHNUNGSSTELLE. Der teuerste Fehler dieses Projekts waere ein Modul
//      mit versprochener, aber nirgends verrechneter Wirkung - das gab es hier schon einmal
//      (Modul-Text-Audit 24.07.2026) und es faellt niemandem auf, weil die Karte ja etwas anzeigt.
//   2) Jedes hat einen DECKEL, und der wird an uebertriebenen Werten gemessen, nicht an heutigen.
//      Ein Deckel, den die aktuellen Zahlen nie erreichen, ist gruen und beweist nichts.
//   3) Der Nullfeldanker beruehrt als einziges Modul Kampfkraft. Er darf NICHT in defensePower()
//      liegen, weil dieser Wert an die Bestenliste und als PvP-Verteidigung an andere Spieler
//      VEROEFFENTLICHT wird.
//   4) Regel 7: eigenes gezeichnetes Icon, vollstaendige Beschreibung mit Deckelangabe.
const fs = require('fs');
const path = require('path');
const SPIELDATEI = path.join(__dirname, '..', 'weltraum_kolonie.html');
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

function fnAus(n){
  const m = js.match(new RegExp('function\\s+'+n+'\\s*\\('));
  if (!m) throw new Error('Funktion nicht gefunden: '+n);
  const i = js.indexOf(m[0]);
  let d=0, s=js.indexOf('{', i+m[0].length), k=s;
  for (; k<js.length; k++){ if(js[k]==='{')d++; else if(js[k]==='}'){d--; if(!d)break;} }
  return js.slice(i, k+1);
}
function arrAus(name){
  const i = js.indexOf('const '+name+' = [');
  let d=0, s=js.indexOf('[', i), k=s;
  for (; k<js.length; k++){ if(js[k]==='[')d++; else if(js[k]===']'){d--; if(!d)break;} }
  return js.slice(s, k+1);
}
const zahl = n => Number((js.match(new RegExp('const '+n+' = ([\\d.]+)'))||[])[1]);

const MODULE_DEFS = new Function("const HERKUNFT_NORMAL='normal', HERKUNFT_ABGRUND='abgrund', HERKUNFT_BOSS='boss', HERKUNFT_UNIKAT='unikat'; return "+arrAus('MODULE_DEFS'))();
const VIER = ['drucktank','echolotmast','splitterofen','nullfeldanker'];
const defOf = k => MODULE_DEFS.find(d => d.key === k);

// ---- 1) Vollstaendigkeit nach CLAUDE.md Regel 7 ----
check('1: alle vier Module sind angelegt', VIER.every(k => !!defOf(k)), VIER.filter(k=>!defOf(k)));
const ICON_KEYS = new Set(Array.from(js.matchAll(/^\s{4}([a-z][a-z0-9_]*): `<svg/gm)).map(m=>m[1]));
for (const k of VIER){
  const d = defOf(k); if (!d) continue;
  // Ein ti-*-Icon waere hier der von CLAUDE.md ausdruecklich als "Notnagel" bezeichnete Fallback.
  check('1: '+k+' hat ein eigenes GEZEICHNETES Icon (kein ti-*-Notnagel)',
    !/^ti-/.test(d.icon) && ICON_KEYS.has(d.icon), { icon:d.icon });
  // "Lagerkapazitaet (vertieft)" war der Spieler-Report, der Regel 7 ausgeloest hat: ein Kuerzel,
  // das sich wie eine fehlende Beschreibung liest. Verlangt ist ein ganzer Satz, der die Wirkung
  // wirklich erklaert.
  check('1: '+k+' hat eine vollstaendige Beschreibung, keinen Kuerzel-Text',
    d.desc && d.desc.length >= 180 && /\. /.test(d.desc), { laenge: d.desc ? d.desc.length : 0 });
  // ... aber KEINE Obergrenze darin. Das ist die Gegenrichtung derselben Disziplin und stammt aus
  // einem eigenen Spieler-Report: Die Boni-Bilanz nennt jeden Deckel an EINER Stelle, damit nicht
  // zwanzig Beschreibungen dieselbe Zahl wiederholen und beim naechsten Balance-Pass zwanzig
  // Stellen veralten. Keine der 13 aelteren Modulbeschreibungen nennt ihren Deckel; diese vier
  // duerfen es auch nicht. tests/test_bonibilanz.js prueft dasselbe von der anderen Seite - hier
  // steht es mit, damit ein neues Abgrund-Modul nicht erst dort auffliegt.
  check('1: '+k+' wiederholt seine Obergrenze NICHT (die nennt die Boni-Bilanz)',
    !/gedeckelt|Obergrenze/.test(d.desc||''), (d.desc||'').slice(0,80));
  check('1: '+k+' traegt die Abgrund-Herkunft', d.quelle === 'abgrund', { quelle:d.quelle });
}
// Jeder Effektname braucht eine Beschriftung, sonst steht auf der Modulkarte der rohe Schluessel.
const LABEL = new Function('return '+js.slice(js.indexOf('{', js.indexOf('const MODULE_EFFECT_LABEL')), js.indexOf('};', js.indexOf('const MODULE_EFFECT_LABEL'))+1))();
check('1: jeder neue Effekt hat eine deutsche Beschriftung',
  VIER.every(k => !!LABEL[defOf(k).effect]),
  VIER.map(k => defOf(k).effect+' -> '+(LABEL[defOf(k).effect]||'FEHLT')));

// ---- 2) Jedes Modul hat eine echte Verrechnungsstelle ----
// Nicht "der Effektname kommt irgendwo vor", sondern: an einer Stelle, die ihn wirklich verbraucht.
const VERRECHNUNG = {
  storage:  /contrib \*= \(1 \+ moduleBonusAt\(planet, 'storage'\)\)/,
  signal:   /moduleBonusTotal\('signal'\)/,
  ofen:     /moduleBonusTotal\('ofen'\)/,
  nullfeld: /moduleBonusAt\(planetKey, 'nullfeld'\)/
};
for (const k of VIER){
  const eff = defOf(k).effect;
  check('2: '+k+' ('+eff+') wird wirklich irgendwo verrechnet', VERRECHNUNG[eff].test(js));
}

// ---- 3) Drucktank: Tiefenskalierung, ausgefuehrt ----
const skala = new Function('state, ABGRUND_TIEFENSKALA_DECKEL', fnAus('abgrundTiefenSkala') + '; return abgrundTiefenSkala;');
const S = best => skala({ abgrund:{ best } }, zahl('ABGRUND_TIEFENSKALA_DECKEL'))();
check('3: ohne Abgrund-Erfahrung wirkt der Drucktank einfach (Faktor 1)', S(0) === 1, { f:S(0) });
check('3: bei Rekordtiefe 40 doppelt', Math.abs(S(40)-2) < 1e-9, { f:S(40) });
check('3: der Faktor steigt streng monoton bis zum Deckel',
  [0,10,40,80,120].every((t,i,a) => i===0 || S(t) > S(a[i-1])), [0,10,40,80,120].map(t=>t+':'+S(t)));
// DER wichtige Teil: Der Abgrund hat keine oberste Tiefe. Ohne Deckel wuechse ein einzelnes Modul
// unbegrenzt weiter - gemessen an einer absurden Tiefe, nicht an einer erreichbaren.
const DECKEL = zahl('ABGRUND_TIEFENSKALA_DECKEL');
check('3: der Deckel haelt auch bei absurder Rekordtiefe',
  S(100000) === DECKEL && S(1e9) === DECKEL, { bei100k:S(100000), deckel:DECKEL });
check('3: ein Spielstand ohne Abgrund-Objekt stuerzt nicht ab (Anzeige rechnet trotzdem)',
  skala({}, zahl('ABGRUND_TIEFENSKALA_DECKEL'))() === 1);
// Die Skalierung muss in moduleInstanceInfo sitzen, nicht an der Verbrauchsstelle - sonst gaebe es
// eine zweite Stelle (Kartenanzeige, Set-Boni, Schmelze), die sie vergessen kann.
check('3: die Skalierung sitzt in moduleInstanceInfo, also auf JEDEM Pfad',
  /tiefenSkala \? abgrundTiefenSkala\(\) : 1/.test(fnAus('moduleInstanceInfo')));
check('3: und nur der Drucktank traegt das Flag',
  MODULE_DEFS.filter(d=>d.tiefenSkala).map(d=>d.key).join() === 'drucktank');

// ---- 4) Echolotmast: Peilungsfrist ----
check('4: die Frist wird beim ENTSTEHEN der Peilung eingebrannt, nicht bei jedem Blick neu gerechnet',
  /expiresAt: Date\.now\(\)\+Math\.round\(SIGNAL_LIFETIME_MS\*\(1\+mast\)\)/.test(js));
check('4: der Mast ist gedeckelt', /Math\.min\(SIGNAL_MAST_DECKEL, moduleBonusTotal\('signal'\)\)/.test(js));
const mastDeckel = zahl('SIGNAL_MAST_DECKEL');
check('4: der Deckel ist eine sinnvolle Groesse (zwischen +50% und +300%)',
  mastDeckel >= 0.5 && mastDeckel <= 3, { deckel: mastDeckel });

// ---- 5) Splitterofen: nimmt nichts weg ----
const ofenStelle = js.slice(js.indexOf("const ofen = Math.min(ABGRUND_OFEN_DECKEL"), js.indexOf("const ofen = Math.min(ABGRUND_OFEN_DECKEL")+420);
check('5: der Ofen ist gedeckelt', /Math\.min\(ABGRUND_OFEN_DECKEL/.test(ofenStelle));
check('5: er schreibt Modulfragmente gut', /state\.moduleFragments = \(state\.moduleFragments\|\|0\) \+ fragmente/.test(ofenStelle));
// Die Zusicherung aus der Beschreibung: "Das Bergungsgut selbst bleibt dir vollstaendig erhalten."
// Ein Ofen, der doch abzieht, waere ein Textfehler mit echten Folgen.
check('5: er zieht KEIN Bergungsgut ab - die Beschreibung sagt, es bleibt vollstaendig erhalten',
  !/a\.bergung\s*-=|a\.bergung = \(a\.bergung\|\|0\) -/.test(js), ofenStelle.split('\n').slice(0,4));
check('5: die Gutschrift des Bergungsguts steht VOR dem Ofen (er rechnet mit dem vollen Betrag)',
  js.indexOf('a.bergung = (a.bergung||0) + bergungsgut') < js.indexOf('const ofen = Math.min(ABGRUND_OFEN_DECKEL'));

// ---- 6) Nullfeldanker: die eine Grenze ----
const NF = new Function(
  'state, moduleBonusAt, ABGRUND_NULLFELD_DECKEL',
  fnAus('nullfeldSchub') + '; return nullfeldSchub;'
);
const nfDeckel = zahl('ABGRUND_NULLFELD_DECKEL');
const nf = (basis, angreifer, eigene) => NF({}, () => basis, nfDeckel)('home', angreifer, eigene);
check('6: ohne Modul keine Wirkung', nf(0, 2000, 1000) === 0);
check('6: bei Gleichstand keine Wirkung', nf(0.12, 1000, 1000) === 0, { f:nf(0.12,1000,1000) });
check('6: bei eigener Ueberlegenheit keine Wirkung', nf(0.12, 500, 1000) === 0);
check('6: bei Unterzahl greift er', nf(0.12, 2000, 1000) > 0, { f:nf(0.12,2000,1000) });
check('6: und zwar staerker, je groesser die Unterzahl',
  nf(0.12, 1500, 1000) < nf(0.12, 2000, 1000),
  { anderthalbfach:nf(0.12,1500,1000), doppelt:nf(0.12,2000,1000) });
check('6: bei doppelter Uebermacht wirkt er voll', Math.abs(nf(0.12, 2000, 1000) - 0.12) < 1e-9);
// Deckel an einem uebertriebenen Modulwert gemessen: Mit den heutigen Zahlen (base 0.12) wird er
// nie erreicht, waere also eine Pruefung, die gar nicht fehlschlagen kann.
check('6: der Deckel haelt auch bei absurd starkem Modul',
  nf(9.9, 10000, 1000) === nfDeckel, { f:nf(9.9,10000,1000), deckel:nfDeckel });
check('6: unsinnige Eingaben liefern 0 statt NaN',
  nf(0.12, 0, 1000) === 0 && nf(0.12, 2000, 0) === 0 && !isNaN(nf(0.12, NaN, 1000)));

// DIE Grenze: Der Anker darf die veroeffentlichte Verteidigung nicht anfassen. defensePower() geht
// in die Bestenliste und als PvP-Verteidigungswert an andere Spieler.
check('6: der Anker liegt NICHT in der allgemeinen Verteidigungssumme (defenseCombatBonusRaw)',
  !/nullfeld/.test(fnAus('defenseCombatBonusRaw')));
check('6: und nicht in defensePower() (die Zahl geht an Bestenliste und PvP)',
  !/nullfeld/.test(fnAus('defensePower')));
// Er darf ueberhaupt nur an EINER Stelle verrechnet werden, und die ist die NPC-Abwehr.
const schubAufrufe = (js.match(/nullfeldSchub\(/g)||[]).length;
check('6: es gibt genau eine Verrechnungsstelle (Definition + ein Aufruf)',
  schubAufrufe === 2, { vorkommen: schubAufrufe });
check('6: und die liegt in executeRaid, der NPC-Abwehr', /nullfeldSchub\(/.test(fnAus('executeRaid')));
// Der Bericht ist die EINZIGE Stelle, an der der Spieler den Anker je zu sehen bekommt.
check('6: der Ueberfallbericht weist den Anker aus - auch wenn er nicht gegriffen hat',
  /Nullfeldanker: <strong>\+/.test(js) && /Nullfeldanker: ohne Wirkung/.test(js));
check('6: ohne eingebauten Anker bleibt das Feld null, damit der Bericht schweigt',
  /moduleBonusAt\(targetPlanet, 'nullfeld'\) > 0 \? nullfeldSchubWert : null/.test(js));

// ---- 7) Der Fundweg ----
// Ohne ihn faellt keins der vier je - grantRandomModule() zieht aus normaler Herkunft.
check('7: es gibt einen eigenen Abgrund-Fundweg', /function grantAbgrundModule/.test(js));
// Seit 31.07.2026 zieht derselbe Fundweg aus BEIDEN Toepfen: Die sechs Abgrund-Schiffsmodule aus
// v8.335.0 waren bis dahin nie gefallen, weil hier nur MODULE_DEFS stand (siehe
// tests/test_abgrund_module2.js). Geprueft wird weiterhin, dass beide Ziehungen ueber fundPool()
// mit Abgrund-Herkunft laufen - das ist die Eigenschaft, um die es hier geht.
check('7: und der zieht ueber den gemeinsamen Pool mit Abgrund-Herkunft',
  /fundPool\(MODULE_DEFS, \{ quelle: HERKUNFT_ABGRUND/.test(fnAus('grantAbgrundModule'))
  && /fundPool\(SHIP_MODULE_DEFS, \{ quelle: HERKUNFT_ABGRUND/.test(fnAus('grantAbgrundModule')));
const C = new Function('ABGRUND_MODUL_CHANCE_DECKEL', fnAus('abgrundModulChance')+'; return abgrundModulChance;')(zahl('ABGRUND_MODUL_CHANCE_DECKEL'));
check('7: die Fundchance steigt mit der Tiefe',
  [1,10,50].every((t,i,a) => i===0 || C(t,false) > C(a[i-1],false)), [1,10,50].map(t=>t+':'+C(t,false).toFixed(3)));
check('7: ein Waechter verdoppelt sie', Math.abs(C(10,true) - C(10,false)*2) < 1e-9);
check('7: sie ist gedeckelt - auch in absurder Tiefe',
  C(1e6,true) === zahl('ABGRUND_MODUL_CHANCE_DECKEL'), { bei1e6:C(1e6,true) });
check('7: in Tiefe 1 ist sie spuerbar, aber keine Gewissheit',
  C(1,false) > 0.02 && C(1,false) < 0.25, { t1:C(1,false) });
// Der Fund muss auch ohne Waechter moeglich sein, sonst ist der Abgrund fuer jeden verschlossen,
// dessen Flotte fuer eine Zehnertiefe (noch) nicht reicht.
check('7: der Fund haengt nicht am Waechter', C(5,false) > 0);
check('7: und die Vergabe steht ausserhalb des Waechter-Zweigs',
  js.indexOf('abgrundModulName = grantAbgrundModule(tiefe)') < js.indexOf('if (sektor.waechter){\n              // Erstsieg'));
// Seltenheit an der Tiefe: die zweite Belohnungsachse, die einen Spieler mit Drucktank weitertauchen laesst.
check('7: die Seltenheit haengt an der Tiefe', /Math\.min\(0\.45, t\/150\)/.test(fnAus('grantAbgrundModule')));

// ---- 8) Anzeige: der Tauchbericht sagt, was passiert ist ----
check('8: der Bericht nennt ein geborgenes Abgrund-Modul', /Aus dem Wrackfeld geborgen:/.test(js));
check('8: und die Fragmente aus dem Splitterofen', /Der Splitterofen hat daraus/.test(js));
check('8: die Protokollzeile nennt beides ebenfalls',
  /Modulfragmente \(Splitterofen\)/.test(js) && /Aus dem Wrackfeld geborgen: '\+abgrundModulName/.test(js));

console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
process.exit(fail ? 1 : 0);
