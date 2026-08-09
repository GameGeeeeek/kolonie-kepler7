// Die großen Listen: Zwischenspeicher (27.07.2026, v8.310.0 und v8.311.0).
//
// Ausgangsbefund - GEMESSEN, nicht geschätzt: Ein MutationObserver über sechs Sekunden zeigt, dass
// vier Listen jede Sekunde komplett neu geschrieben werden, solange ihr Reiter offen ist:
//
//     #research           73.9 kB Markup     Forschung-Reiter
//     #buildings          27.7 kB            Basis-Reiter
//     #defenseBuildings   21.3 kB            Verteidigung-Reiter
//     #planetRoleBox       3.9 kB            Basis-Reiter
//
// Zusammen rund 127 kB pro Sekunde, auf genau den Reitern, auf denen man am meisten sitzt.
//
// v8.311.0, zweite Messrunde nach denselben vier: Es gibt eine zweite Klasse von Boxen, die NICHT
// an einen Reiter gebunden ist und deshalb auf JEDEM Reiter mitläuft, auch wo sie unsichtbar ist:
//
//     #npcList            57.2 kB Markup     lief auf jedem Reiter mit
//     #factionBox         18.5 kB
//     #attackFleetBox     11.9 kB
//     #terraformBox        4.1 kB
//     #pirateLairBox       1.1 kB
//     #colonyDashboard     1.1 kB
//     #relocateAllQuickBox 1.1 kB
//     #qtySelect(Def/Fleet) 3x 0.2 kB
//
// Nicht umgestellt, weil ihr Markup sich WIRKLICH jede Sekunde ändert: #orbitalStationBox (zeigt
// die Restzeit eines laufenden Ausbaus), #buildQueueBox/#researchQueueBox (Countdown),
// #happyHourBox (Restzeit), #resbar (Rohstoffzähler). Nachgemessen, nicht angenommen: ein
// Vergleich des Markups über zwei Sekunden zeigt bei #orbitalStationBox "11m 58s" -> "11m 56s".
//
// KERNPUNKT DIESES TESTS - die Signatur ist das FERTIGE MARKUP, nicht eine Liste von Werten.
// CLAUDE.md sagt, das Muster dürfe nur auf Boxen OHNE Live-Countdown angewandt werden. Das gilt für
// Wert-Signaturen: Wer den Countdown darin vergisst, friert die Anzeige ein. Beim vollen Markup
// kann das nicht passieren - läuft ein Countdown, ist das Markup jede Sekunde ein anderes und die
// Box wird neu geschrieben. Abschnitt 4 belegt genau das an der Verteidigungsliste, die bei einem
// laufenden Bauauftrag eine Restzeit anzeigt.
//
// Geprüft wird:
//   1) ohne Änderung bleibt das DOM der drei Listen über mehrere Ticks bestehen
//   2) die Knöpfe wirken weiterhin (sie werden zentral am Ende des Ticks verdrahtet, nicht beim
//      Schreiben der Liste - deshalb ist das hier ungefährlich, aber es muss belegt sein)
//   3) eine echte Änderung baut die Liste sofort wieder auf
//   4) bei laufendem Bauauftrag schreibt die Verteidigungsliste weiter jede Sekunde - die
//      Selbstkorrektur der Markup-Signatur
//   5) die animierten Canvas-Grafiken der Verteidigung überleben übersprungene Ticks
//      (refreshDefenseMiniIcons läuft seit v8.310.0 nur noch beim echten Neuaufbau)
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');
const fs = require('fs');

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}

function save(zusatz){
  // nextPlanetEventCheck/nextTraderCheck in die Zukunft (Befund 08.08.2026): Bei 0 feuert der
  // ERSTE Planeten-Ereignis-Check GARANTIERT ein Ereignis (kein Wahrscheinlichkeits-Gate) - und
  // je nach Phasenlage der langsamen Verarbeitungsspur landet Log+render() mitten im Messfenster
  // und vernichtet die Marke. Der Test schien dann zu beweisen, der Cache sei tot ("da:false"),
  // obwohl der Neuaufbau voellig korrekt war. Mehrfach als Suite-Flake aufgetreten, an diesem Tag
  // erstmals BEIDSEITIG reproduziert (alter wie neuer Stand rot) und damit als Fixture-Luecke
  // erkannt: Der Cache-Test muss CACHING messen, nicht Ereignis-Glueck - echte Langzeit-Speicher
  // haben diese Felder ohnehin gesetzt.
  return JSON.stringify(Object.assign({ tutorialSeen:true, newbieWelcomeSeen:true,
    nextPlanetEventCheck: Date.now() + 3600000, nextTraderCheck: Date.now() + 3600000,
    resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:2e4,forschungspunkte:3e4},
    buildings:{solar:22,mine:20,kristallmine:18,labor:14,lager:16,werft:14,turm:8,laser:10,schild:6},
    research:{rkampf:9,rsolar:9,rerz:8}, fleet:{jaeger:600,missions:[]},
    colonies:{}, activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null},
    battleStats:{wins:9,losses:2}, xp:260000, credits:180000, buffs:[], lastTick:Date.now(),
    colonyNames:{}, modules:{}, shipModules:{} }, zusatz));
}

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

// Die Markierung hängt am DOM-Knoten, nicht am Markup - ein innerHTML-Neuschreiben vernichtet sie
// zwangsläufig. Ein Textvergleich könnte dagegen aus dem falschen Grund gelingen: Der Text SOLL ja
// gleich bleiben.
const markiere = (page, id) => page.evaluate(x => {
  const b=document.getElementById(x); if(!b || !b.firstElementChild) return false;
  b.firstElementChild.__marke = 1; return true;
}, id);
async function reiter(page, name){
  await page.evaluate(x=>{const b=document.querySelector('.tab-btn[data-tab="'+x+'"]'); if(b) b.click();}, name);
  await page.waitForTimeout(900);
}

async function spiel(browser, zustand){
  const store={'kepler7-save-v3':save(zustand)};
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:900,height:1200} }));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(2700);
  await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='none';});});
  return { page, ctx, errs };
}

(async () => {
  const browser = await starteBrowser();

  // ------------------------------------------------- 1-3) die drei Listen ohne laufenden Auftrag
  {
    const { page, ctx, errs } = await spiel(browser, {});

    for (const [tab, id] of [['basis','buildings'], ['verteidigung','defenseBuildings'], ['forschung','research']]){
      await reiter(page, tab);
      const start = await page.evaluate(x=>{const b=document.getElementById(x); return b?b.innerHTML.length:-1;}, id);
      check('1: #'+id+' ist gerendert', start > 2000, start);
      check('1: #'+id+' lässt sich markieren', await markiere(page, id) === true);
      await page.waitForTimeout(3400); // mindestens drei Sekunden-Ticks
      const nach = await page.evaluate(x=>{const b=document.getElementById(x);
        return { da:!!(b && b.firstElementChild && b.firstElementChild.__marke), canvas: b?b.querySelectorAll('canvas').length:-1 };}, id);
      check('1: #'+id+' wird über mehrere Ticks NICHT neu geschrieben', nach.da === true, nach);
      if (id === 'defenseBuildings'){
        // 5) refreshDefenseMiniIcons() läuft seit v8.310.0 nur noch beim echten Neuaufbau. Wären
        // die Canvas-Grafiken davon abhängig, jede Sekunde neu gesetzt zu werden, wären sie jetzt
        // weg - das ist die Gegenprobe zu dieser Umstellung.
        check('5: die animierten Verteidigungs-Grafiken überleben übersprungene Ticks',
          nach.canvas > 0, nach);
      }
    }

    // 2+3) Der Knopf muss wirken, und die Änderung muss die Liste sofort neu aufbauen.
    // Die Handler dieser Listen werden zentral am Ende jedes Ticks gesetzt (querySelectorAll über
    // das ganze Dokument), nicht beim Schreiben der Liste - anders als bei den Modul-Boxen. Genau
    // deshalb ist das hier ungefährlich; der Test hält es fest, damit es beim nächsten Umbau
    // auffällt, falls jemand das Verdrahten in den Schreibzweig zieht.
    await reiter(page, 'basis');
    await markiere(page, 'buildings');
    await page.waitForTimeout(2400);
    // Am Meldungs-Log gemessen, nicht an der Bau-Warteschlange: Bei genug Rohstoffen wird ein
    // eingereihter Auftrag sofort abgearbeitet, die Warteschlange bleibt also leer. Ein Test auf
    // "steht in der Warteschlange" wäre rot geworden, obwohl der Knopf einwandfrei funktioniert -
    // beim ersten Durchlauf genau so passiert.
    await page.evaluate(()=>{const b=document.querySelector('[data-queue="solar"]'); if(b) b.click();});
    await page.waitForTimeout(1200);
    const nachKlick = await page.evaluate(()=>{
      const l=document.getElementById('log');
      const b=document.getElementById('buildings');
      return { gemeldet: l ? /Solarkraftwerk.*ausgebaut/.test(l.textContent) : false,
               marke: !!(b && b.firstElementChild && b.firstElementChild.__marke) };
    });
    check('2: der Einreihen-Knopf wirkt auch nach übersprungenen Ticks noch',
      nachKlick.gemeldet === true, nachKlick);
    check('3: und die Änderung hat die Gebäudeliste neu aufgebaut', nachKlick.marke === false, nachKlick);
    check('keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ------------------------------------------------- 6) #fleet, die groesste Box des Spiels
  // Nachgemessen am 01.08.2026: 157,5 kB Markup, jede Sekunde komplett neu geschrieben - deutlich
  // mehr als #research (92,5 kB), das den Cache seit v8.310.0 hat. Direkt danach lief
  // refreshShipMiniIcons() ueber JEDES canvas[data-ship-icon] darin.
  {
    const { page, ctx, errs } = await spiel(browser, { fleet:{ jaeger:600, bomber:120, frachter:80, missions:[] } });
    await reiter(page, 'flotte');
    const start = await page.evaluate(()=>{const b=document.getElementById('fleet'); return b?b.innerHTML.length:-1;});
    check('6: #fleet ist gerendert und wirklich gross', start > 20000, start);
    // Uhr fuer das Messfenster einfrieren (Befund 08.08.2026, im Geist von Arbeitsregel 8):
    // Laeuft REAL gerade ein Kalender-Event (z.B. Void-Anomalie), zeigt die Event-Schiff-Karte
    // in #fleet einen SEKUNDENGENAUEN Countdown - das Markup aendert sich dann jede Sekunde,
    // setBoxHtml schreibt voellig KORREKT neu (das Muster ist selbstkorrigierend), und die
    // Marke stirbt. Der Test war damit nur ausserhalb der Event-Zeitfenster gruen - an diesem
    // Abend erstmals als Serie aufgefallen und per innerHTML-Setter-Falle auf genau diese
    // Countdown-Zeile zurueckverfolgt (alter wie neuer Stand identisch rot). Mit stehender Uhr
    // steht jeder legitime Countdown still, und gemessen wird die REGEL: keine Neuschreibung
    // bei unveraendertem Inhalt. Ein kaputter Cache (schreibt trotz gleichem Markup) faellt
    // weiterhin durch, denn die Marke stirbt am Schreiben, nicht am Inhalt.
    // Erst einfrieren, DANN markieren - zwischen Markieren und Einfrieren kann sonst noch ein
    // echter Tick mit tickendem Countdown feuern und die Marke vor Messbeginn vernichten
    // (beim Einfuehren im ersten Lauf genau so passiert).
    await page.evaluate(() => { window.__dateEcht = Date.now; const fest = Date.now(); Date.now = () => fest; });
    // Nach dem Einfrieren schreibt der NAECHSTE Tick noch genau einmal (das Markup springt vom
    // letzten echten auf den eingefrorenen Zeitpunkt) - erst danach steht es still. Deshalb einen
    // Tick verstreichen lassen, BEVOR markiert wird.
    await page.waitForTimeout(1300);
    check('6: #fleet laesst sich markieren', await markiere(page, 'fleet') === true);
    await page.waitForTimeout(3400);
    const nach = await page.evaluate(()=>{const b=document.getElementById('fleet');
      return { da:!!(b && b.firstElementChild && b.firstElementChild.__marke),
               canvas: b?b.querySelectorAll('canvas[data-ship-icon]').length:-1 };});
    // Uhr wieder freigeben - der Bauknopf-Teil unten braucht echte Zeit.
    await page.evaluate(() => { if (window.__dateEcht) Date.now = window.__dateEcht; });
    check('6: #fleet wird ueber mehrere Ticks NICHT neu geschrieben', nach.da === true, nach);
    // Gegenprobe zur gesparten Canvas-Arbeit: Die Schiffsgrafiken duerfen uebersprungene Ticks
    // ueberleben - refreshShipMiniIcons() laeuft jetzt nur noch beim echten Neuaufbau.
    check('6: die Schiffsgrafiken ueberleben uebersprungene Ticks', nach.canvas > 3, nach);

    // Der Kaufknopf muss nach uebersprungenen Ticks weiter wirken. Die Handler dieser Liste werden
    // zentral ueber document.querySelectorAll gesetzt, nicht im Schreibzweig - deshalb treffen sie
    // die stehengebliebenen Knoten erneut.
    // An der BAU-WARTESCHLANGE gemessen, nicht an der Laenge des Meldungs-Logs: Das Log rotiert,
    // seine Zeichenzahl kann nach einem erfolgreichen Klick gleich bleiben oder sogar sinken. Beim
    // ersten Durchlauf genau so passiert - der Knopf wirkte, die Sonde meldete trotzdem Rot.
    const vorher = await page.evaluate(()=>document.querySelectorAll('[data-cancel-construction]').length);
    await page.evaluate(()=>{const b=document.querySelector('[data-buyship="jaeger"]'); if(b) b.click();});
    await page.waitForTimeout(1300);
    const nachKlick = await page.evaluate((v)=>{
      const b=document.getElementById('fleet');
      return { auftraege: document.querySelectorAll('[data-cancel-construction]').length,
               vorher: v,
               marke: !!(b && b.firstElementChild && b.firstElementChild.__marke) };
    }, vorher);
    check('6: der Bauknopf wirkt auch nach uebersprungenen Ticks noch',
      nachKlick.auftraege > nachKlick.vorher, nachKlick);
    check('6: und der Bauauftrag hat die Flottenliste neu aufgebaut', nachKlick.marke === false, nachKlick);

    // 7) DIE SKIN-FALLE. activeFleetSkinFilter() wird per JS als canvas.style.filter gesetzt und
    // taucht im erzeugten Markup NIRGENDS auf. Stuende der Skin nicht im Cache-Schluessel, bliebe
    // ein Skin-Wechsel bei sonst gleichem Markup wirkungslos - genau die Art stiller Fehler, die
    // ein Markup-Vergleich sonst gerade verhindert.
    check('7: der Skin steht im Cache-Schluessel, nicht nur im Markup',
      /setBoxHtml\(fleetEl, 'fleet\|' \+ activeFleetSkinFilter\(\)/.test(
        require('fs').readFileSync(SPIELDATEI, 'utf8')));
    check('keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ------------------------------------------------- 4) laufender Auftrag: Selbstkorrektur
  // Ein bezahlter Bauauftrag auf ein Verteidigungsgebäude erzeugt eine Restzeit-Karte, deren Text
  // sich jede Sekunde ändert - das Markup also auch, und DIESE Box MUSS weiter neu geschrieben
  // werden. Das ist der Beleg dafür, dass eine Markup-Signatur nichts einfrieren kann. Seit
  // v8.460.0 wohnt die Karte in der eigenen kleinen #defenseJobs-Box (Splitbox-Muster wie
  // fleetJobs): der Countdown tickt dort sekündlich weiter, während die großen Anlagen-Kacheln
  // in #defenseBuildings stillstehen. Erwartungen mitgezogen (Arbeitsregel 9) - vorher prüfte
  // dieser Abschnitt, dass die KACHELLISTE sekündlich neu geschrieben wird; genau das war die
  // gemessene Verschwendung (21,3 kB je Sekunde), die die Splitbox abstellt.
  {
    const { page, ctx, errs } = await spiel(browser, {});
    await reiter(page, 'verteidigung');
    // Der Auftrag wird vom Spiel selbst erzeugt statt im Spielstand erfunden. Ein handgebauter
    // Auftrag hat beim ersten Versuch eine Fortschrittskarte mit dem Text "undefined" erzeugt -
    // ihm fehlten Felder, die das Spiel beim echten Einreihen setzt. Der Test hätte damit einen
    // Zustand geprüft, den es im Spiel nie gibt.
    await page.evaluate(()=>{const b=document.querySelector('[data-build="turm"]'); if(b) b.click();});
    await page.waitForTimeout(1300);
    const start = await page.evaluate(()=>{const j=document.getElementById('defenseJobs');
      const b=document.getElementById('defenseBuildings');
      return { laenge:b?b.innerHTML.length:-1, karte:/Verteidigungsturm \(\+1\)/.test(j?j.textContent:''),
               inListe:/Verteidigungsturm \(\+1\)/.test(b?b.textContent:''),
               undef:/undefined/.test(j?j.textContent:'') };});
    check('4: der laufende Auftrag steht als Fortschrittskarte in der defenseJobs-Splitbox',
      start.laenge > 2000 && start.karte === true && start.inListe === false, start);
    check('4: und die Karte enthält kein undefined', start.undef === false, start);
    check('4: beide Boxen lassen sich markieren',
      await markiere(page, 'defenseJobs') === true && await markiere(page, 'defenseBuildings') === true);
    await page.waitForTimeout(3400);
    const nach = await page.evaluate(()=>{const j=document.getElementById('defenseJobs');
      const b=document.getElementById('defenseBuildings');
      return { jobsDa:!!(j && j.firstElementChild && j.firstElementChild.__marke),
               listeDa:!!(b && b.firstElementChild && b.firstElementChild.__marke),
               canvas:b?b.querySelectorAll('canvas').length:-1 };});
    check('4: bei laufendem Countdown wird die Splitbox weiterhin jede Sekunde neu geschrieben',
      nach.jobsDa === false, nach);
    check('4: die Kachelliste steht dabei still (der Countdown zwingt sie nicht mehr zum Neuaufbau)',
      nach.listeDa === true, nach);
    check('4: und die animierten Grafiken sind dabei erhalten geblieben', nach.canvas > 0, nach);
    check('4: keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ------------------------------------------- 6) die reiterunabhängigen Boxen (v8.311.0)
  // #npcList ist mit 57 kB die zweitgrößte Box des Spiels und hing an KEINEM Reiter - sie lief auf
  // jedem mit, auch auf dem Basis-Reiter, wo sie niemand sieht. Der Test steht deshalb bewusst auf
  // dem Galaxie-Reiter (wo sie sichtbar ist) UND prüft danach den Basis-Reiter.
  {
    const { page, ctx, errs } = await spiel(browser, {});
    await reiter(page, 'galaxie');
    for (const id of ['npcList','factionBox','colonyDashboard']){
      const start = await page.evaluate(x=>{const b=document.getElementById(x); return b?b.innerHTML.length:-1;}, id);
      check('6: #'+id+' ist gerendert', start > 500, start);
      check('6: #'+id+' lässt sich markieren', await markiere(page, id) === true);
    }
    await page.waitForTimeout(3400);
    const nach = await page.evaluate(()=>{
      const w = x => { const b=document.getElementById(x); return { da:!!(b && b.firstElementChild && b.firstElementChild.__marke),
        canvas: b?b.querySelectorAll('canvas').length:-1 }; };
      return { npc:w('npcList'), fak:w('factionBox'), kol:w('colonyDashboard') };
    });
    check('6: #npcList wird über mehrere Ticks NICHT neu geschrieben', nach.npc.da === true, nach.npc);
    check('6: #factionBox ebenso', nach.fak.da === true, nach.fak);
    check('6: #colonyDashboard ebenso', nach.kol.da === true, nach.kol);
    // refreshPlanetMiniIcons() läuft seit v8.311.0 nur noch beim echten Neuaufbau - dieselbe
    // Gegenprobe wie bei den Verteidigungs-Grafiken.
    check('6: die gezeichneten Planeten im Kolonie-Überblick überleben übersprungene Ticks',
      nach.kol.canvas > 0, nach.kol);
    // Und auf einem Reiter, auf dem #npcList gar nicht sichtbar ist, darf sie erst recht nicht
    // arbeiten - genau das war der Befund.
    await reiter(page, 'basis');
    await markiere(page, 'npcList');
    await page.waitForTimeout(3400);
    const aufBasis = await page.evaluate(()=>{const b=document.getElementById('npcList');
      return !!(b && b.firstElementChild && b.firstElementChild.__marke);});
    check('6: #npcList steht auch auf einem fremden Reiter still', aufBasis === true);
    check('6: keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ------------------------------------------------- Quelltext-Prüfungen
  const src = fs.readFileSync(SPIELDATEI, 'utf8');
  check('Q: es gibt genau eine setBoxHtml-Definition',
    (src.match(/function setBoxHtml\(/g)||[]).length === 1);
  check('Q: alle vier Listen laufen darüber',
    /setBoxHtml\(document\.getElementById\('buildings'\), 'buildings'/.test(src)
    && /setBoxHtml\(document\.getElementById\('defenseBuildings'\), 'defenseBuildings'/.test(src)
    && /setBoxHtml\(document\.getElementById\('research'\), 'research'/.test(src)
    && (src.match(/setBoxHtml\(roleBox, 'planetRoleBox'/g)||[]).length === 2);
  // childElementCount ist kein Beiwerk: Räumt irgendwer eine Box von außen leer, muss der
  // Neuaufbau trotz gleicher Signatur laufen.
  // Der Helfer muss BEIDE Sonderfälle abdecken: eine von außen geleerte Box (childElementCount)
  // und eine absichtlich leere (Terraforming/Orbitalstation auf einem Mond schreiben ''). Ohne den
  // zweiten Teil hätte die absichtlich leere Box jeden Tick ein wirkungsloses innerHTML='' bekommen.
  check('Q: der Leer-Fall ist im Helfer abgesichert',
    /boxHtmlCache\[schluessel\] === html && \(box\.childElementCount \|\| !html\)/.test(src));
  check('Q: auch die reiterunabhängigen Boxen laufen über den Helfer',
    /setBoxHtml\(document\.getElementById\('npcList'\), 'npcList'/.test(src)
    && /setBoxHtml\(box, 'factionBox'/.test(src)
    && /setBoxHtml\(veteranRankBox, 'veteranRankBox'/.test(src)  // Nachfolger der 05.08. entfernten attackFleetBox
    && /setBoxHtml\(pirateLairBox, 'pirateLairBox'/.test(src)
    && (src.match(/setBoxHtml\(terraBox, 'terraformBox'/g)||[]).length === 2
    && (src.match(/setBoxHtml\(orbitalBox, 'orbitalStationBox'/g)||[]).length === 2
    && (src.match(/setBoxHtml\(document\.getElementById\('qtySelect/g)||[]).length === 3);
  check('Q: die Planeten-Mini-Icons werden nur beim echten Neuaufbau neu gesetzt',
    /if \(kolNeu\) refreshPlanetMiniIcons/.test(src));
  check('Q: die Canvas-Grafiken werden nur beim echten Neuaufbau neu gesetzt',
    /if \(defNeu\) refreshDefenseMiniIcons\(\);/.test(src));
  // Die Begründung, warum das Muster hier trotz Countdown erlaubt ist, gehört in den Code -
  // sonst entfernt sie beim nächsten Mal jemand mit Verweis auf CLAUDE.md.
  check('Q: die Begründung zur Countdown-Selbstkorrektur steht im Code',
    /selbstkorrigierend/.test(src));

  console.log('\n' + (fail ? 'FAIL' : 'PASS'));
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
