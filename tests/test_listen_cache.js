// Die vier großen Listen: Zwischenspeicher (27.07.2026, v8.310.0).
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
  return JSON.stringify(Object.assign({ tutorialSeen:true, newbieWelcomeSeen:true,
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

  // ------------------------------------------------- 4) laufender Auftrag: Selbstkorrektur
  // Ein bezahlter Bauauftrag auf ein Verteidigungsgebäude erzeugt in der Liste eine Restzeit-Karte.
  // Deren Text ändert sich jede Sekunde - das Markup also auch, und die Box MUSS weiter neu
  // geschrieben werden. Das ist der Beleg dafür, dass eine Markup-Signatur nichts einfrieren kann.
  {
    const { page, ctx, errs } = await spiel(browser, {});
    await reiter(page, 'verteidigung');
    // Der Auftrag wird vom Spiel selbst erzeugt statt im Spielstand erfunden. Ein handgebauter
    // Auftrag hat beim ersten Versuch eine Fortschrittskarte mit dem Text "undefined" erzeugt -
    // ihm fehlten Felder, die das Spiel beim echten Einreihen setzt. Der Test hätte damit einen
    // Zustand geprüft, den es im Spiel nie gibt.
    await page.evaluate(()=>{const b=document.querySelector('[data-build="turm"]'); if(b) b.click();});
    await page.waitForTimeout(1300);
    const start = await page.evaluate(()=>{const b=document.getElementById('defenseBuildings');
      return { laenge:b?b.innerHTML.length:-1, karte:/Verteidigungsturm \(\+1\)/.test(b?b.textContent:''),
               undef:/undefined/.test(b?b.textContent:'') };});
    check('4: die Verteidigungsliste zeigt den laufenden Auftrag als Fortschrittskarte',
      start.laenge > 2000 && start.karte === true, start);
    check('4: und die Karte enthält kein undefined', start.undef === false, start);
    check('4: die Liste lässt sich markieren', await markiere(page, 'defenseBuildings') === true);
    await page.waitForTimeout(3400);
    const nach = await page.evaluate(()=>{const b=document.getElementById('defenseBuildings');
      return { da:!!(b && b.firstElementChild && b.firstElementChild.__marke), canvas:b?b.querySelectorAll('canvas').length:-1 };});
    check('4: bei laufendem Countdown wird sie weiterhin jede Sekunde neu geschrieben',
      nach.da === false, nach);
    check('4: und die animierten Grafiken sind dabei erhalten geblieben', nach.canvas > 0, nach);
    check('4: keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
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
  check('Q: der Leer-Fall ist im Helfer abgesichert',
    /boxHtmlCache\[schluessel\] === html && box\.childElementCount/.test(src));
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
