// Kampf-Wiedergabe „Orbitalsturm" (03.08.2026, v8.390.0).
//
// Die neue Wiedergabe zeichnet auf eine Leinwand statt Symbolreihen zu bewegen. Damit
// verschiebt sich, was ein Test ueberhaupt sehen kann: Ob ein Schiff getroffen wurde,
// steht in keinem DOM-Knoten mehr. Geprueft wird deshalb dort, wo es nachpruefbar ist -
// an den Zahlen der Tafel, an der Bilanz und an den Bildpunkten der Leinwand selbst.
//
// DIE VIER PUNKTE, UND WARUM GERADE DIE:
//
//   1. Jede abspielbare Kampfart oeffnet, zeichnet wirklich und benennt den Gegner.
//      „Oeffnet" allein genuegt nicht - ein schwarzes Rechteck oeffnet auch.
//
//   2. DIE BILANZ ZEIGT DIE ZAHLEN DES BERICHTS. Das ist der Punkt, an dem dieser Test
//      entstanden ist: Beim Einbau stellte sich heraus, dass bilanzBauen() als einzige
//      Anzeigestelle nie auf echte Daten umgestellt worden war und weiterhin die
//      Festwerte des Prototyps nannte - „Jäger 340", „Verluste Lumekx", „Schildkuppel:
//      zusammengebrochen". Aufgefallen war es nicht im Bild, sondern beim Lesen; der
//      Prototyp-Test daneben prüfte nur die Fusszeile der Bilanz, nie das Verlustgitter.
//      Der wiederkehrende Fehlertyp dieses Projekts in Reinform.
//
//   3. DIE EHRLICHKEITSREGEL. Der Adapter erfindet nichts, und die Anzeige darf das
//      auch nicht. Zwei Faelle sind konkret geprueft: eine Gegnerflotte, die der
//      Bericht gar nicht fuehrt (PvP/Leerenriss), und Angreiferverluste bei einem
//      verlorenen Ueberfall - der Bericht fuehrt sie NUR bei gewonnener Abwehr mit,
//      „keine Verluste" waere dort eine Messung, die es nicht gab.
//
//   4. DIE BILDROLLE HAELT BEIM SCHLIESSEN AN. Ohne das liefe requestAnimationFrame
//      unsichtbar weiter - teurer als alles, was die Anzeige-Bremse aus v8.387.0
//      einspart. Gemessen wird an den Bildpunkten der Leinwand: Erst wird belegt, dass
//      die Messung Bewegung ueberhaupt SIEHT (bei offener Wiedergabe aendern sich die
//      Punkte), dann dass sie nach dem Schliessen keine mehr sieht. Ohne den ersten
//      Teil waere der zweite wertlos - eine Messung, die nie etwas findet, findet auch
//      dann nichts, wenn etwas da ist.
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const grund = { fleet:{ jaeger:820, cruisers:160, destroyers:40, schlachtschiff:8 },
                fromPlanet:'Kepler-7b', debrisPlanet:'home' };
const BERICHTE = [
  // NPC: die einzige Art, die BEIDE Flotten, BEIDE Verlustlisten und die Phasen fuehrt.
  Object.assign({ id:'npc', ts:Date.now(), type:'npc-attack', result:'win',
    npcName:'Kryllid-Nest (Stufe 4)', attackPower:52600, defensePower:38900, chancePct:71,
    ownLostShips:{ jaeger:96, cruisers:12 },
    npcFleet:{ jaeger:600, cruisers:120 }, destroyedNpcShips:{ jaeger:600, cruisers:82 },
    phasen:[{ name:'Anflug', chance:0.72, gewonnen:true,  power:52600 },
            { name:'Hauptgefecht', chance:0.58, gewonnen:false, power:49100 },
            { name:'Entscheidung', chance:0.64, gewonnen:true,  power:51300 }] }, grund),
  // Eingehender Ueberfall, VERLOREN: der Bericht fuehrt die Angreiferverluste nicht mit.
  Object.assign({ id:'raid', ts:Date.now(), type:'raid', result:'loss', faction:'Kryllid-Schwarm',
    attackPower:41200, defensePower:23400, targetPlanet:'home',
    ownLostShips:{ jaeger:96, cruisers:12 },
    stationedFleet:{ jaeger:300, cruisers:40 },
    defenseBefore:{ turm:12, laser:10, schild:6 } }, grund),
  Object.assign({ id:'pvp', ts:Date.now(), type:'player-attack', result:'win', targetName:'AdmiralY',
    attackPower:60000, defensePower:30000, targetPlanet:'home',
    ownLostShips:{ jaeger:40 } }, grund),
  Object.assign({ id:'void', ts:Date.now(), type:'void-rift', result:'win', targetPlanet:'home',
    attackPower:44000, defensePower:61000, chancePct:26, ownLostShips:{ jaeger:60 } }, grund),
  Object.assign({ id:'pir', ts:Date.now(), type:'pirate-debris-raid', result:'win',
    targetPlanet:'home', attackPower:9000, defensePower:4000,
    destroyedShips:{ jaeger:60 }, ownLostShips:{ jaeger:10 } }, grund),
  Object.assign({ id:'ally', ts:Date.now(), type:'alliance-base-attack', result:'win', targetTag:'NYX',
    attackPower:50000, defensePower:20000, damage:1200, ownLostShips:{ jaeger:25 } }, grund),
];
const ERWARTETER_GEGNER = { npc:'Kryllid-Nest', raid:'Kryllid-Schwarm', pvp:'AdmiralY',
                            void:'Leerenriss', pir:'Piraten-Trümmerräuber', ally:'Allianzbasis' };

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p==='reports')return j({reports:BERICHTE});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT')return j({ok:true,version:2});if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  return j([]);
};}
const save=()=>JSON.stringify({tutorialSeen:true,newbieWelcomeSeen:true,
  resources:{energie:5e5,erz:5e5,kristalle:3e5,deuterium:2e5,antimaterie:2e4,forschungspunkte:3e4},
  buildings:{solar:22,mine:20,kristallmine:18,labor:14,lager:30,werft:14,turm:12,laser:10,schild:6},
  research:{rkampf:9}, fleet:{jaeger:600,missions:[]}, colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null}, battleStats:{wins:9,losses:2}, xp:260000, credits:180000,
  buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

// Fingerabdruck der Leinwand: jede 997. Bildpunktgruppe, damit die Probe billig bleibt und
// trotzdem ueber die ganze Flaeche streut (997 ist prim - ein glatter Schritt koennte sich
// auf eine Bildspalte legen und Bewegung genau daneben uebersehen).
const abdruck = page => page.evaluate(() => {
  const cv = document.getElementById('osCv');
  if (!cv || !cv.width) return null;
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let h = 0;
  for (let i = 0; i < d.length; i += 997) h = (h * 31 + d[i]) | 0;
  return h;
});

(async () => {
  // ------------------------------------------------------------- 0) Quelle
  const src = fs.readFileSync(SPIELDATEI, 'utf8');
  check('0: die Wiedergabe liegt in einer eigenen Kapsel',
    /const Wiedergabe = \(function\(\)\{/.test(src));
  // Die Kapsel darf nur eine kleine, benannte Flaeche nach aussen geben - sie enthaelt
  // rund 200 Namen auf oberster Ebene, von denen zehn in der Spieldatei bereits vergeben
  // sind. zustand() kam am 03.08.2026 dazu: reine Auskunft fuer den Prueflauf, kein
  // Schalter. Alles Weitere gehoert NICHT nach draussen.
  check('0: sie gibt genau starte(), beende() und zustand() nach aussen',
    /return \{ starte: starte, beende: beende, zustand: zustand \};/.test(src));
  // Die zehn Namen, die es in der Spieldatei bereits gibt - ohne Kapsel wuerde einer den
  // anderen still ueberschreiben.
  check('0: die alte Wiedergabe ist restlos entfernt',
    !/function buildBattleSequence|function renderBattleFleetIcons|function spawnBattleShot/.test(src));
  // Gesucht sind ZEICHENKETTEN IM CODE, nicht Erwaehnungen: Der Kommentar ueber
  // bilanzBauen() zitiert die alten Festwerte absichtlich, um zu erklaeren, was dort
  // stand - die erste Fassung dieser Pruefung schlug genau daran an.
  for (const [was, muster] of [['ORBIT LUMEKX', /'ORBIT LUMEKX'/],
                               ['Verluste Lumekx', /'Verluste Lumekx'/],
                               ['Bilanzzeile "Jäger 340"', /reihe\(sp1, ?'Jäger', ?'340'\)/],
                               ['Sieguntertitel des Prototyps', /Orbit von Lumekx gebrochen/]])
    check('0: kein Prototyp-Festwert im Code - ' + was, !muster.test(src));

  // ------------------------------------------------- 0b) Echte Schiffsmodelle
  // Die Wiedergabe zeichnete sechs Silhouetten fuer 40 Schiffstypen. Seit dem
  // 03.08.2026 rechnet sie die Formen aus SHIP_HULL_DEFS um - dieselben Umrisse, die
  // der Spieler in der Flottenliste sieht. Geprueft wird die UMRECHNUNG selbst,
  // ausgefuehrt: Ob die Nase oben landet und die Laenge stimmt, ist Geometrie und
  // laesst sich ausrechnen, statt es an einem Bild zu beurteilen.
  {
    const a = src.indexOf('function rumpfAusSpielmodell(');
    const q = a < 0 ? '' : src.slice(a, src.indexOf('\n    }', a) + 6);
    check('0b: rumpfAusSpielmodell() gefunden', q.length > 400, q.length);
    check('0b: sie liest die Formen des Spiels, statt eine zweite Liste zu fuehren',
      /SHIP_HULL_DEFS\[shipKey\]/.test(q));
    if (q.length > 400){
      // Ein Modell wie im Spiel: Nase rechts (x gross), Mitte bei y=50.
      const HULL = { pruef: { pts: [[92,50],[60,40],[20,44],[20,56],[60,60]] } };
      const f = new Function('SHIP_HULL_DEFS', 'var modellSpeicher={};\n' + q + '\n return rumpfAusSpielmodell;')(HULL);
      const r = f('pruef', 30);
      check('0b: ein unbekanntes Schiff liefert null statt eines Platzhalters', f('gibtesnicht', 30) === null);
      check('0b: die Spannweite wird eingehalten', r && r.spanne === 30);
      const xs = [], ys = [];
      for (let i = 0; i < r.punkte.length; i += 2){ xs.push(r.punkte[i]); ys.push(r.punkte[i+1]); }
      // Die Nase des Spielmodells (x=92) muss in der Wiedergabe ganz OBEN liegen (kleinstes y).
      check('0b: die Nase zeigt nach oben', Math.abs(ys[0] - Math.min(...ys)) < 0.001, { nase: ys[0], min: Math.min(...ys) });
      // Laenge = Spannweite, und das Modell ist um seine Mitte zentriert.
      const laenge = Math.max(...ys) - Math.min(...ys);
      check('0b: die Laenge entspricht der Spannweite', Math.abs(laenge - 30) < 0.001, laenge);
      check('0b: es ist um seine Mitte zentriert',
        Math.abs(Math.max(...ys) + Math.min(...ys)) < 0.001 && Math.abs(Math.max(...xs) + Math.min(...xs)) < 0.001);
      check('0b: der Umriss wird als farbige Kante nachgezogen',
        r.kanten.length === 1 && r.kanten[0].length === r.punkte.length + 2);
      check('0b: das Triebwerk sitzt am Heck (hinter der Mitte)', r.motoren[0][1] > 0, r.motoren[0]);
    }
    // Jedes Schiff des Spiels muss ein Modell haben - sonst faellt ausgerechnet das
    // neueste Schiff still auf die Platzhalter-Silhouette zurueck.
    // Ausschnitt auf SHIP_DEFS begrenzen: Das erste Muster fing die BUILDING_DEFS mit
    // (solar, mine, raffinerie ...) und meldete Gebaeude als Schiffe ohne Modell.
    const hull = src.slice(src.indexOf('const SHIP_HULL_DEFS = {'), src.indexOf('const SHIP_DEFS'));
    const sd = src.indexOf('const SHIP_DEFS');
    const schiffBlock = src.slice(sd, src.indexOf('\n  ];', sd));
    // Nur ZEILENANFAENGE: Schiffe fuehren ihre Freischaltung als requires:[{key:'r...'}],
    // und ein Muster ohne Anker zog die Forschungsschluessel mit herein.
    const schiffe = [...schiffBlock.matchAll(/^\s*\{ key:'([a-zA-Z_]+)'/gm)].map(m => m[1]);
    check('0b: die Schiffsliste wurde gefunden', schiffe.length >= 20, schiffe.length);
    const ohne = schiffe.filter(k => !new RegExp('\\b' + k + ':\\s*\\{ pts:').test(hull));
    check('0b: jedes Schiff hat ein Modell (sonst Platzhalter)', ohne.length === 0, ohne.slice(0, 6));
  }

  const browser = await starteBrowser();
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{ width:1280, height:900 } }));
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': save() }));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(3200);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  // Der Berichte-Bereich hat keinen Reiterknopf - er wird ueber das Kopfsymbol geoeffnet.
  await page.evaluate(() => { const x = document.getElementById('headerReportsBtn'); if (x) x.click(); });
  await page.waitForTimeout(1600);

  const knoepfe = await page.evaluate(() => [...document.querySelectorAll('[data-watch-battle]')].map(b => b.getAttribute('data-watch-battle')));
  check('1: alle sechs Kampfarten haben einen Knopf', BERICHTE.every(r => knoepfe.includes(r.id)), knoepfe);

  const oeffne = async id => {
    await page.evaluate(rid => {
      const b = [...document.querySelectorAll('[data-watch-battle]')].find(x => x.getAttribute('data-watch-battle') === rid);
      if (b) b.click();
    }, id);
    await page.waitForTimeout(1400);
  };
  const schliesse = async () => {
    await page.evaluate(() => { const c = document.getElementById('battleModalCloseBtn'); if (c) c.click(); });
    await page.waitForTimeout(500);
  };

  // ------------------------------------------------- 1) oeffnen, zeichnen, benennen
  for (const r of BERICHTE){
    await oeffne(r.id);
    const z = await page.evaluate(() => {
      const cv = document.getElementById('osCv');
      let hell = 0;
      if (cv && cv.width){
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        // Der Grund ist #060812 - alles deutlich darueber ist gezeichnet.
        for (let i = 0; i < d.length; i += 4000) if (d[i] > 12 || d[i+1] > 12 || d[i+2] > 24) hell++;
      }
      return { offen: document.getElementById('battleModalOverlay').classList.contains('open'),
               titel: (document.getElementById('battleModalTitle') || {}).textContent || '',
               hell, tafelD: (document.getElementById('osTafelD') || {}).textContent || '' };
    });
    check('1: ' + r.id + ' - die Wiedergabe oeffnet', z.offen === true);
    check('1: ' + r.id + ' - es wird wirklich gezeichnet', z.hell > 100, z.hell);
    check('1: ' + r.id + ' - der Gegner ist benannt (' + ERWARTETER_GEGNER[r.id] + ')',
      z.titel.includes(ERWARTETER_GEGNER[r.id]), z.titel.slice(0, 70));
    await schliesse();
  }

  // ------------------------------------------------- 2) Bilanz aus echten Zahlen
  await oeffne('npc');
  await page.evaluate(() => { const b = document.getElementById('osBtnEnde'); if (b) b.click(); });
  await page.waitForTimeout(2800);
  const bilanz = await page.evaluate(() => (document.getElementById('osBilanz') || {}).textContent.replace(/\s+/g, ' '));
  // ownLostShips: jaeger 96, cruisers 12 - destroyedNpcShips: jaeger 600 (von 600), cruisers 82
  check('2: die Bilanz nennt die eigenen Verluste des Berichts',
    /Jäger ?96/.test(bilanz) && /Kreuzer ?12/.test(bilanz), bilanz.slice(0, 120));
  check('2: sie nennt die Verluste des Gegners aus dem Bericht',
    /Kreuzer ?82/.test(bilanz) && /Jäger ?600/.test(bilanz), bilanz.slice(0, 160));
  check('2: restlos vernichtete Klassen sind als solche kenntlich', /600 \(alle\)/.test(bilanz));
  check('2: keine Zahl des Prototyps mehr in der Bilanz',
    !/340/.test(bilanz) && !/Lumekx/.test(bilanz), bilanz.slice(0, 160));
  const tafelA = await page.evaluate(() => (document.getElementById('osTafelA') || {}).textContent.replace(/\s+/g, ' '));
  // 1.028 Ruempfe minus 108 Verluste = 920. Tafel und Bilanz muessen dieselbe Groesse
  // gleich beziffern - der Klassiker, an dem dieses Projekt schon mehrfach haengengeblieben ist.
  check('2: die Tafel rechnet mit denselben Verlusten wie die Bilanz',
    /920/.test(tafelA) && /1\.028/.test(tafelA), tafelA.slice(0, 80));
  await schliesse();

  // ------------------------------------------------- 3) Ehrlichkeitsregel
  await oeffne('pvp');
  const pvpTafel = await page.evaluate(() => (document.getElementById('osTafelD') || {}).textContent.replace(/\s+/g, ' '));
  check('3: eine nicht aufgeklaerte Gegnerflotte wird als solche benannt',
    /nicht aufgeklärt/.test(pvpTafel), pvpTafel.slice(0, 110));
  check('3: statt einer erfundenen Flotte steht dort die Abwehrkraft',
    /Abwehrkraft/.test(pvpTafel) && /30\.000/.test(pvpTafel), pvpTafel.slice(0, 80));
  await schliesse();

  await oeffne('raid');
  await page.evaluate(() => { const b = document.getElementById('osBtnEnde'); if (b) b.click(); });
  await page.waitForTimeout(2800);
  const raidBilanz = await page.evaluate(() => (document.getElementById('osBilanz') || {}).textContent.replace(/\s+/g, ' '));
  check('3: unbekannte Angreiferverluste werden NICHT als „keine Verluste" ausgegeben',
    !/keine Verluste/.test(raidBilanz) && /führt die Verluste dieser Seite nicht mit/.test(raidBilanz),
    raidBilanz.slice(0, 200));
  // Der Bestand (28) und die Aussage "standen bereit" sind der Kern; das Substantiv
  // heisst seit 03.08.2026 "Anlagen" statt "Stellungen", weil "Stellung" jetzt die
  // GEZEICHNETE Figur meint und mehrere Anlagen zusammenfassen kann.
  check('3: die Bodenabwehr nennt den Bestand, keine Ausfallquote',
    /28 (Anlagen|Stellungen) standen bereit/.test(raidBilanz) && !/ausgefallen/.test(raidBilanz),
    raidBilanz.slice(-90));
  await schliesse();

  // ------------------------------------------------- 4) die Bildrolle haelt an
  await oeffne('npc');
  const a1 = await abdruck(page);
  await page.waitForTimeout(900);
  const a2 = await abdruck(page);
  // Erst der Nachweis, dass die Messung Bewegung ueberhaupt sieht.
  check('4: bei offener Wiedergabe sieht die Messung Bewegung', a1 !== null && a1 !== a2, { a1, a2 });
  await schliesse();
  const b1 = await abdruck(page);
  await page.waitForTimeout(1500);
  const b2 = await abdruck(page);
  check('4: nach dem Schliessen zeichnet die Bildrolle NICHT mehr weiter', b1 === b2, { b1, b2 });

  check('keine JS-Fehler in der ganzen Runde', errs.length === 0, errs.slice(0, 3));
  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
