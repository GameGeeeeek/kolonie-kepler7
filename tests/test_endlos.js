// Endlos-Fortschritt (27.07.2026, v8.319.0).
//
// Ausgangsbefund, am Code gemessen:
//   Forschung:      43 Zweige, 584 Stufen, ALLE gedeckelt
//   Aufstiegs-Baum: 6 Zweige x 10 Stufen, Kosten (Stufe+1) -> 330 Essenz fuer ALLES
//   Essenz-Ertrag:  score/5000 + prestige*3 + kampfpunkte/200 -> ueber 100 je Aufstieg
// Nach drei bis vier Aufstiegen war der komplette Meta-Baum gekauft. Der endgueltigste Reset des
// Spiels brachte danach gar nichts mehr, und Sternenessenz war eine Waehrung ohne Ware. Genau dort
// hoeren Langzeitspieler auf.
//
// Der Test prueft die MATHEMATIK der neuen Kurven, nicht nur ihre Anwesenheit. Der eigentliche
// Fallstrick bei "endlos" ist naemlich nicht, dass etwas fehlt, sondern dass es explodiert: Ein
// unbegrenzter linearer Bonus waere schlimmer als die Wand, die er ersetzt.
//
// Geprueft wird:
//   1) Aufstiegsknoten: keine Obergrenze, Kosten steigen ueberproportional, Ertrag flacht ab
//   2) Ewigkeitsforschungen: vorhanden, ohne echte Grenze, logarithmischer Nutzen
//   3) und sie zaehlen NICHT als "alles erforscht" (sonst waeren Erfolg und Nexus unerreichbar)
//   4) Prestige-Perks mit Preis: jeder hat Vorteil UND Nachteil, beide verdrahtet
//   5) Mega-Projekt-Stufen: Kosten x2.6, Bonussumme konvergiert
//   6) Prestige-Herausforderung: Gegner UND Beute skalieren mit demselben Faktor
//   7) Backend-Vertraeglichkeit: keine Stufe kann ueber SAVE_SANITY_LIMITS laufen
const fs = require('fs');
const path = require('path');
const SPIELDATEI = path.join(__dirname, '..', 'weltraum_kolonie.html');
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

// Datenbloecke aus der Spieldatei ziehen und auswerten - so misst der Test die echten Werte statt
// abgeschriebener Kopien, die beim naechsten Balance-Pass veralten wuerden.
function block(name){
  const i = js.indexOf('const '+name+' = [');
  if (i < 0) return null;
  let d=0, s=js.indexOf('[', i), k=s;
  for(;k<js.length;k++){ if(js[k]==='[')d++; else if(js[k]===']'){d--; if(!d)break;} }
  return js.slice(s, k+1);
}
const RESEARCH = eval(block('RESEARCH_DEFS'));
const PERKS = eval(block('PRESTIGE_PERKS'));

// WICHTIG - warum die Formeln hier nicht nachgebaut werden:
// Die erste Fassung dieses Tests bildete die Kostenkurve als eigene Zeile nach ("const kosten =
// lvl => lvl < 10 ? lvl+1 : ..."). In der Rot-Probe fiel auf, dass das NICHTS prueft: Setzt man die
// Kostenformel in der Spieldatei auf die alte lineare zurueck, bleibt der Test gruen - er misst ja
// seine eigene Kopie. Alle mathematischen Pruefungen waren damit leer wahr, genau die, um die es
// hier geht. Jetzt werden die echten Funktionen aus dem Quelltext geschnitten und ausgefuehrt.
function fnAus(name){
  const i = js.indexOf('function '+name+'(');
  if (i < 0) throw new Error('Funktion nicht gefunden: '+name);
  let d=0, s=js.indexOf('{', i), k=s;
  for(;k<js.length;k++){ if(js[k]==='{')d++; else if(js[k]==='}'){d--; if(!d)break;} }
  return js.slice(i, k+1);
}
// Minimaler Kontext: nur was die geschnittenen Funktionen wirklich anfassen.
function baueKontext(zustand){
  const quelle = [
    'const ASCENSION_SOFT_CAP = 10, ASCENSION_LATE_RATE = 0.2;',
    'const MEGA_STAGE_COST_MULT = 2.6;',
    'const PRESTIGE_CHALLENGE_FROM = 10;',
    'const MEGA_PROJECTS = [];',
    'function hasMegaProject(k){ return !!(state.megaProjects && state.megaProjects[k]); }',
    fnAus('ascNodeCost'), fnAus('ascLevel'), fnAus('ascBonus'),
    fnAus('ewigBonus'), fnAus('megaStage'), fnAus('megaStageFactor'), fnAus('megaStageCost'),
    fnAus('prestigeChallengeMult'),
    'return { ascNodeCost, ascBonus, ascLevel, ewigBonus, megaStage, megaStageFactor, megaStageCost, prestigeChallengeMult };'
  ].join('\n');
  return new Function('state', quelle)(zustand);
}
const G = baueKontext({ ascension:{ tree:{} }, research:{}, megaProjects:{}, megaProjectStages:{}, prestige:0 });
// Nicht-Leerheit: Waere der Schnitt fehlgeschlagen, wuerden unten lauter undefined verglichen.
check('0: die echten Formeln wurden aus der Spieldatei geladen',
  typeof G.ascNodeCost === 'function' && typeof G.megaStageFactor === 'function'
  && typeof G.prestigeChallengeMult === 'function' && G.ascNodeCost(0) === 1,
  { probe: G.ascNodeCost(0) });

// ---------------------------------------------------------------- 1) Aufstiegs-Baum
{
  check('1: die harte Obergrenze ist weg', !/ASCENSION_NODE_MAX/.test(js));
  check('1: Softcap und Spaet-Rate sind benannte Konstanten',
    /const ASCENSION_SOFT_CAP = 10;/.test(js) && /const ASCENSION_LATE_RATE = 0\.2;/.test(js));
  check('1: die Kaufpruefung nutzt die neue Kostenfunktion',
    /const cost = ascNodeCost\(lvl\);/.test(js));

  // Die Formeln aus der Datei nachbilden und ihre EIGENSCHAFTEN pruefen.
  const CAP = 10;
  const kosten = G.ascNodeCost;
  // ascBonus liest die Stufe aus state - fuer jede Messung einen eigenen Kontext bauen.
  const wirkung = lvl => baueKontext({ ascension:{ tree:{ prod:lvl } }, research:{} }).ascBonus('prod');

  // Bis zum Softcap darf sich NICHTS geaendert haben - sonst waere das eine stille
  // Verschlechterung fuer alle, die noch nicht dort sind.
  const altKosten = lvl => lvl + 1;
  let gleich = true;
  for (let l=0; l<CAP; l++) if (kosten(l) !== altKosten(l)) gleich = false;
  check('1: bis Stufe 10 kostet alles exakt wie vorher', gleich,
    { neu:[...Array(CAP).keys()].map(kosten), alt:[...Array(CAP).keys()].map(altKosten) });

  // Kosten muessen ueberproportional wachsen, sonst laeuft die Essenz davon.
  check('1: ab Stufe 11 steigen die Kosten sprunghaft', kosten(10) > kosten(9)*4,
    { stufe10:kosten(9), stufe11:kosten(10) });
  check('1: und weiter ueberproportional', kosten(49) > kosten(19)*4,
    { stufe20:kosten(19), stufe50:kosten(49) });

  // Ertrag muss abflachen: die zweiten zehn Stufen duerfen deutlich weniger bringen als die ersten.
  const ersteZehn = wirkung(10) - wirkung(0);
  const zweiteZehn = wirkung(20) - wirkung(10);
  check('1: der Ertrag flacht nach Stufe 10 ab', zweiteZehn < ersteZehn * 0.3,
    { ersteZehn, zweiteZehn });
  // Und er waechst trotzdem immer weiter - "endlos" heisst nicht "wirkungslos".
  check('1: jede weitere Stufe bringt trotzdem noch etwas', wirkung(101) > wirkung(100),
    { s100:wirkung(100), s101:wirkung(101) });
  check('1: die Anzeige nennt die wirksame Stufe', /wirksam \$\{wirksam\.toFixed\(1\)\}/.test(js));
}

// ---------------------------------------------------------------- 2+3) Ewigkeitsforschungen
{
  const ewig = RESEARCH.filter(r => r.endless);
  check('2: es gibt Ewigkeitsforschungen', ewig.length >= 4, ewig.map(r=>r.key));
  check('2: sie decken verschiedene Bereiche ab', new Set(ewig.map(r=>r.key)).size === ewig.length);
  // Kosten muessen exponentiell steigen - sonst waere die Stufe 100 in Reichweite und der
  // logarithmische Nutzen wuerde zur Farce.
  check('2: ihre Kosten steigen exponentiell', ewig.every(r => r.costMult >= 1.3),
    ewig.map(r=>({k:r.key, m:r.costMult})));
  // Die Sicherheitsschranke muss klar unter dem Backend-Limit liegen (siehe Pruefung 7).
  check('2: die Sicherheitsschranke liegt bei 999', ewig.every(r => r.maxLevel === 999),
    ewig.map(r=>r.maxLevel));
  check('2: jede hat eine vollstaendige Beschreibung',
    ewig.every(r => r.desc && r.desc.length > 120 && /ohne Maximalstufe/.test(r.desc)),
    ewig.map(r=>({k:r.key, len:(r.desc||'').length})));

  // Der Nutzen: logarithmisch. Doppelte Stufe darf NICHT doppelten Bonus geben.
  const ewigBonus = (lvl, f) => baueKontext({ research:{ rewig_prod: lvl }, ascension:{tree:{}} }).ewigBonus('rewig_prod', f);
  check('2: doppelte Stufe gibt deutlich weniger als doppelten Bonus',
    ewigBonus(20, 0.05) < ewigBonus(10, 0.05) * 1.4,
    { s10:ewigBonus(10,0.05), s20:ewigBonus(20,0.05) });
  check('2: selbst Stufe 1000 bleibt unter +55%', ewigBonus(1000, 0.05) < 0.55, ewigBonus(1000,0.05));
  check('2: aber jede Stufe bringt weiterhin etwas', ewigBonus(501,0.05) > ewigBonus(500,0.05));

  // Alle vier muessen auch WIRKEN - eine Forschung ohne Wirkungsstelle waere eine Attrappe.
  for (const r of ewig)
    check('2: '+r.key+' ist an einer Wirkungsstelle verdrahtet',
      new RegExp("ewigBonus\\('"+r.key+"'").test(js));

  // 3) Der kritische Nebeneffekt.
  check('3: sie zaehlen nicht als "alles erforscht"',
    /allResearchMaxed\(\)\{ return RESEARCH_DEFS\.filter\(r=>!isEndlessResearch\(r\)\)\.every/.test(js));
  check('3: auch der Erfolg "Forschungs-Meister" nimmt sie aus',
    (js.match(/RESEARCH_DEFS\.filter\(r=>!isEndlessResearch\(r\)\)\.every/g)||[]).length >= 2);
}

// ---------------------------------------------------------------- 4) Perks mit Preis
{
  const mitPreis = ['blitzforscher','schwarm','sparwerft'];
  for (const k of mitPreis){
    const p = PERKS.find(x=>x.key===k);
    check('4: Perk "'+k+'" existiert', !!p);
    if (!p) continue;
    // Ein Perk mit Preis MUSS beide Seiten nennen - sonst waehlt man ihn ahnungslos.
    check('4: '+k+' nennt Vorteil und Nachteil', /dafür|dafuer/.test(p.desc) && p.desc.length > 60, p.desc);
    // Und beide Seiten muessen verdrahtet sein. Ein Nachteil ohne Wirkung waere ein reiner Bonus.
    const treffer = (js.match(new RegExp("prestigePerkCount\\('"+k+"'\\)","g"))||[]).length;
    check('4: '+k+' ist mindestens zweimal verdrahtet (Vorteil UND Nachteil)', treffer >= 2, treffer);
  }
  check('4: der Schiffskosten-Rabatt sitzt zentral in der Kostenfunktion',
    /function shipCostPerkMult\(\)/.test(js));
  // Wenn "Max" den Rabatt nicht kennt, zeigt der Knopf weniger an, als bezahlbar waere.
  check('4: und auch die Max-Menge kennt ihn',
    /const perk = shipCostPerkMult\(\); \/\/ denselben Rabatt/.test(js));
}

// ---------------------------------------------------------------- 5) Mega-Projekt-Stufen
{
  check('5: es gibt Ausbaustufen', /function megaStage\(/.test(js) && /function megaStageCost\(/.test(js));
  check('5: der Kostenfaktor ist benannt', /const MEGA_STAGE_COST_MULT = 2\.6;/.test(js));
  const faktor = st => baueKontext({ megaProjectStages:{ dysonschwarm:st }, megaProjects:{}, research:{}, ascension:{tree:{}} }).megaStageFactor('dysonschwarm');
  check('5: Stufe 1 wirkt wie bisher (Faktor 1)', faktor(1) === 1, faktor(1));
  check('5: jede Stufe gibt die Haelfte der vorherigen',
    Math.abs((faktor(3)-faktor(2)) - (faktor(2)-faktor(1))/2) < 1e-9,
    { s1:faktor(1), s2:faktor(2), s3:faktor(3) });
  // Der springende Punkt: Die Summe darf nicht davonlaufen.
  check('5: die Bonussumme konvergiert gegen das Doppelte', faktor(50) < 2 && faktor(50) > 1.99, faktor(50));
  check('5: Ausbaustufen erst, wenn alle drei stehen',
    /!MEGA_PROJECTS\.every\(p2 => hasMegaProject\(p2\.key\)\)/.test(js));
  // Das seltene Item darf nur einmal faellig sein - es ist die knappste Ressource des Spiels.
  check('5: das seltene Item wird nur fuer die erste Stufe verlangt',
    /if \(proj\.unlockItem && stufe === 0\)/.test(js));
}

// ---------------------------------------------------------------- 6) Prestige-Herausforderung
{
  check('6: die Skalierung existiert und ist benannt',
    /const PRESTIGE_CHALLENGE_FROM = 10;/.test(js) && /function prestigeChallengeMult\(\)/.test(js));
  const mult = p => baueKontext({ prestige:p, research:{}, ascension:{tree:{}} }).prestigeChallengeMult();
  check('6: unter Prestige 10 aendert sich nichts', mult(0)===1 && mult(9)===1 && mult(10)===1);
  check('6: darueber steigt es', mult(20) > 1, mult(20));
  check('6: und ist bei doppelter Staerke gedeckelt', mult(1000) === 2, mult(1000));
  check('6: die Gegner nutzen sie', /npcEffectiveDefense\(npc\)\{[^}]*prestigeChallengeMult\(\)/.test(js));
  // Ohne mitskalierende Beute waere Prestigen eine Bestrafung - das ist der Kern dieser Aenderung.
  check('6: die Beute skaliert mit demselben Faktor',
    /const herausforderung = prestigeChallengeMult\(\);/.test(js)
    && /amt\*factor\*herausforderung/.test(js));
  check('6: auch die Kampfpunkte', /npc\.level\*10 \* tier2EventBpMult\(m\.composition\) \* herausforderung/.test(js));
}

// ---------------------------------------------------------------- 7) Backend-Vertraeglichkeit
// CLAUDE.md, Vorfall 21.07.2026: Ein einziges Zahlenfeld ueber SAVE_SANITY_LIMITS laesst das
// Backend den GESAMTEN Spielstand mit HTTP 400 ablehnen - dann speichert gar nichts mehr. Wer
// Obergrenzen anhebt, muss das mitpruefen. Die dort genannten Limits: Gebaeude/Forschung 10000.
{
  const BACKEND_MAX_RESEARCH = 10000;
  const ewig = RESEARCH.filter(r => r.endless);
  check('7: keine Forschungsstufe kann das Backend-Limit erreichen',
    ewig.every(r => r.maxLevel < BACKEND_MAX_RESEARCH * 0.2),
    { maxLevel: ewig.map(r=>r.maxLevel), limit: BACKEND_MAX_RESEARCH });
  // Aufstiegsstufen sind nach oben offen - hier schuetzt die Kostenkurve. Gegenrechnung: Wie viel
  // Essenz braeuchte Stufe 200? Wenn das jenseits jeder erreichbaren Menge liegt, ist es sicher.
  let summe = 0; for (let l=0; l<200; l++) summe += G.ascNodeCost(l);
  check('7: Aufstiegsstufe 200 braeuchte mehr als 500.000 Essenz', summe > 500000, Math.round(summe));
}

console.log('\n' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
