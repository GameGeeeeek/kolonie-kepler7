// #expeditionBox: Zwischenspeicher (02.08.2026).
//
// Sie war mit rund 11,6 kB Markup pro Sekunde die letzte grosse Liste, die der Haupt-Tick Zeichen
// fuer Zeichen identisch neu geschrieben hat - uebrig geblieben aus der Runde v8.310.0/v8.311.0,
// weil der damalige automatische Umbau hier ZWEIMAL gescheitert ist: Der Klammernzaehler hielt ein
// Semikolon INNERHALB eines Template-Literals fuer ein Anweisungsende und setzte die schliessende
// Klammer mitten in einen CSS-Wert. Deshalb von Hand, und deshalb dieser Test.
//
// Was hier geprueft wird, und warum jeder Punkt noetig ist:
//
//   1. Das DOM bleibt ueber mehrere Ticks BESTEHEN. Geprueft wird das ueber eine Markierung am
//      Knoten, nicht ueber einen Textvergleich: Der Text soll ja gleich bleiben, ein Textvergleich
//      koennte also aus dem falschen Grund gelingen. Ein innerHTML-Neuschreiben vernichtet die
//      Markierung zwangslaeufig.
//   2. Die Knoepfe wirken NACH uebersprungenen Ticks weiter. Hier ist das anders als bei den
//      Listen aus v8.310.0: Die Verdrahtung liegt IM if-Zweig, wird bei uebersprungenem Tick also
//      NICHT neu gesetzt. Das geht nur gut, weil die alten Knoten samt Handler stehen bleiben -
//      und genau das muss belegt sein, nicht angenommen.
//   3. Eine echte Aenderung baut die Box sofort wieder auf.
//   4. Die waagerechte Scrollposition der Wischleiste (data-hscroll="exptype") ueberlebt den
//      Neuaufbau. setBoxHtml ruft intern setHtmlPreservingScroll - das darf beim Umbau nicht
//      verloren gehen.
//   5. Das Flottenname-Feld verliert beim Tippen nicht den Fokus (isTypingIn-Schutz bleibt).
const { starteBrowser, devices, SPIEL_URL } = require('./lib/umgebung');

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}

// Genug Forschung und Schiffe, damit die Expeditionsbox ueberhaupt vollstaendig erscheint.
function save(){
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
    resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:2e4,forschungspunkte:3e4},
    buildings:{solar:22,mine:20,kristallmine:18,labor:14,lager:16,werft:14,turm:8,laser:10,schild:6},
    research:{rkampf:9,rsolar:9,rerz:8,rexpedition:5,rantrieb:8},
    fleet:{jaeger:600,cruisers:120,destroyers:60,bomber:40,forscher:12,frachtergross:20,missions:[]},
    colonies:{}, activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null},
    battleStats:{wins:9,losses:2}, xp:260000, credits:180000, buffs:[], lastTick:Date.now(),
    colonyNames:{}, modules:{}, shipModules:{},
    // Anstrich im Besitz, aber NICHT aktiv - Abschnitt 6 aktiviert ihn ueber die Oberflaeche.
    allianceSkins:['allianz_gold'] });
}

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

const markiere = (page) => page.evaluate(() => {
  const b=document.getElementById('expeditionBox');
  if(!b || !b.firstElementChild) return false;
  b.firstElementChild.__marke = 1; return true;
});
const markeDa = (page) => page.evaluate(() => {
  const b=document.getElementById('expeditionBox');
  return !!(b && b.firstElementChild && b.firstElementChild.__marke === 1);
});

(async () => {
  const browser = await starteBrowser();
  const store={'kepler7-save-v3':save()};
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:900,height:1300} }));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(2700);
  await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='none';});});

  // #expeditionBox liegt im EIGENEN Reiter "expedition" (tab-expedition), nicht unter "flotte".
  // Sie wird zwar auf beiden Reitern gerendert, ist auf "flotte" aber unsichtbar - und ein
  // unsichtbares Feld nimmt keinen Fokus an und hat scrollWidth 0. Der erste Anlauf dieses Tests
  // klickte auf "flotte" und meldete daraufhin zwei Fehler, die es gar nicht gab.
  await page.evaluate(()=>{const b=document.querySelector('.tab-btn[data-tab="expedition"]'); if(b) b.click();});
  await page.waitForTimeout(1200);
  const sichtbar = await page.evaluate(()=>{
    const e=document.getElementById('expeditionBox');
    return !!e && e.getClientRects().length > 0;
  });
  check('0: die Box ist wirklich SICHTBAR (sonst waeren 4 und 5 nicht aussagekraeftig)', sichtbar === true);

  const groesse = await page.evaluate(()=>{const b=document.getElementById('expeditionBox'); return b?b.innerHTML.length:-1;});
  check('0: #expeditionBox ist gerendert', groesse > 2000, groesse);
  if (groesse <= 2000){
    console.log('\nFEHLGESCHLAGEN (Box kam nicht zustande - alles Weitere waere ein falsches Gruen)');
    await browser.close(); process.exit(1);
  }

  // ---------------------------------------------------------------- 1) DOM bleibt stehen
  check('1: die Box laesst sich markieren', await markiere(page) === true);
  await page.waitForTimeout(3400);            // mindestens drei Sekunden-Ticks
  check('1: nach drei Ticks steht derselbe Knoten noch da', await markeDa(page) === true);

  // ---------------------------------------------------------------- 2) Knoepfe wirken weiter
  // Die Verdrahtung liegt IM if-Zweig; nach uebersprungenen Ticks wurde sie NICHT neu gesetzt.
  const vorher = await page.evaluate(()=>{
    const b=document.querySelector('[data-expedition-type].sel, [data-expedition-type]');
    return b ? b.getAttribute('data-expedition-type') : null;
  });
  const andererTyp = await page.evaluate(()=>{
    const alle=[...document.querySelectorAll('[data-expedition-type]')];
    return alle.length > 1 ? alle[alle.length-1].getAttribute('data-expedition-type') : null;
  });
  check('2: es gibt mehrere Expeditionstypen zum Umschalten', !!andererTyp && andererTyp !== vorher,
    { vorher, andererTyp });
  if (andererTyp){
    await page.evaluate(t=>{ document.querySelector('[data-expedition-type="'+t+'"]').click(); }, andererTyp);
    await page.waitForTimeout(700);
    const jetztAktiv = await page.evaluate(t=>{
      const b=document.querySelector('[data-expedition-type="'+t+'"]');
      return !!b && /5dcaa5/.test(b.getAttribute('style')||'');
    }, andererTyp);
    check('2: der Klick nach drei uebersprungenen Ticks wirkt noch', jetztAktiv === true);
    // 3) und die echte Aenderung hat die Box neu gebaut
    check('3: die echte Aenderung baut die Box neu auf (Markierung ist weg)',
      await markeDa(page) === false);
  }

  // ---------------------------------------------------------------- 4) Scrollposition
  const hatLeiste = await page.evaluate(()=>!!document.querySelector('#expeditionBox [data-hscroll="exptype"]'));
  check('4: die Wischleiste mit data-hscroll ist da', hatLeiste === true);
  if (hatLeiste){
    await page.evaluate(()=>{ document.querySelector('#expeditionBox [data-hscroll="exptype"]').scrollLeft = 60; });
    // Eine echte Aenderung erzwingen, damit die Box wirklich neu geschrieben wird.
    await page.evaluate(()=>{ if (typeof state !== 'undefined'){ state.expeditionRisk = state.expeditionRisk === 'hoch' ? 'normal' : 'hoch'; } });
    await page.evaluate(()=>{ const b=document.querySelector('[data-expedition-risk]'); if(b) b.click(); });
    await page.waitForTimeout(900);
    const links = await page.evaluate(()=>{
      const e=document.querySelector('#expeditionBox [data-hscroll="exptype"]'); return e?e.scrollLeft:-1;
    });
    check('4: die waagerechte Scrollposition ueberlebt den Neuaufbau', links > 0, links);
  }

  // ---------------------------------------------------------------- 5) Tippen behaelt den Fokus
  const feldDa = await page.evaluate(()=>!!document.getElementById('customFleetNameInputExp'));
  check('5: das Flottenname-Feld ist vorhanden', feldDa === true);
  if (feldDa){
    await page.focus('#customFleetNameInputExp');
    await page.type('#customFleetNameInputExp', 'Testflotte');
    await page.waitForTimeout(2600);          // zwei Ticks waehrend das Feld den Fokus hat
    const zustand = await page.evaluate(()=>{
      const e=document.getElementById('customFleetNameInputExp');
      return { fokus: document.activeElement === e, wert: e ? e.value : null };
    });
    check('5: das Feld behaelt Fokus und Inhalt ueber zwei Ticks',
      zustand.fokus === true && zustand.wert === 'Testflotte', zustand);
  }

  // ------------------------------------------------- 6) Flottenanstrich erreicht die Eskorte
  // Der Anstrich wird von refreshShipMiniIcons() per JS als canvas.style.filter gesetzt und taucht
  // im erzeugten HTML NIRGENDS auf. refreshShipMiniIcons steht seit der Umstellung im if-Zweig -
  // ohne activeFleetSkinFilter() im Cache-Schluessel bliebe ein Anstrichwechsel bei sonst gleichem
  // Markup wirkungslos: Die Schiffe in der Flottenliste faerben sich um, die Eskorte-Schiffe hier
  // nicht. Zwei Anzeigestellen desselben Anstrichs, die sich widersprechen.
  //
  // Der Anstrich wird ueber die OBERFLAECHE gewechselt, nicht ueber Innereien: Das Spiel laeuft in
  // einer gekapselten Funktion, page.evaluate sieht state/ALLIANCE_SKIN_DEFS gar nicht. Ein erster
  // Anlauf tat deshalb nur so, als wuerde er etwas setzen - und haette bei einem echten Fehler
  // trotzdem gruen gemeldet.
  //
  // EHRLICHKEIT ZUR AUSSAGEKRAFT: Dieser Abschnitt belegt das ERGEBNIS ("der Anstrich kommt an"),
  // nicht die Notwendigkeit des Cache-Schluessels. Nachgemessen: Auch OHNE activeFleetSkinFilter()
  // im Schluessel besteht er - der Weg ueber den Allianz-Reiter und zurueck baut die Box ohnehin
  // neu auf (die gesetzten Knoten-Marken sind danach weg). Ein Fall, in dem ein Anstrichwechsel das
  // Markup dieser Box unveraendert laesst, liess sich ueber die Oberflaeche nicht herstellen.
  // Der Schluessel bleibt trotzdem vollstaendig: Er kostet nichts, macht den Markup-Vergleich
  // luecklos und entspricht dem, was #fleet seit der Umstellung mit ausdruecklicher Begruendung
  // tut. Wer ihn spaeter entfernt, entfernt eine Absicherung, keinen nachgewiesenen Fehler -
  // und dieser Absatz sagt ihm, dass dieser Test das nicht auffangen wuerde.
  const vorAnstrich = await page.evaluate(()=>{
    const c=document.querySelector('#expeditionBox canvas[data-ship-icon]');
    return c ? (c.style.filter || '') : null;
  });
  check('6: es gibt Eskorte-Schiffsgrafiken zum Einfaerben', vorAnstrich !== null, vorAnstrich);

  await page.evaluate(()=>{const b=document.querySelector('.tab-btn[data-tab="allianz"]'); if(b) b.click();});
  await page.waitForTimeout(1200);
  const knopf = await page.evaluate(()=>{
    const b=document.querySelector('[data-equip-alliance-skin]:not([data-equip-alliance-skin=""])');
    if(!b) return null; b.click(); return b.getAttribute('data-equip-alliance-skin');
  });
  check('6: der Anstrich laesst sich in der Oberflaeche aktivieren', !!knopf, knopf);
  if (knopf){
    await page.evaluate(()=>{const b=document.querySelector('.tab-btn[data-tab="expedition"]'); if(b) b.click();});
    await page.waitForTimeout(1400);
    const nachAnstrich = await page.evaluate(()=>{
      const c=document.querySelector('#expeditionBox canvas[data-ship-icon]');
      const f=document.querySelector('#fleet canvas[data-ship-icon]');
      return { eskorte: c ? (c.style.filter || '') : null, flotte: f ? (f.style.filter || '') : null };
    });
    check('6: der Anstrichwechsel erreicht die Eskorte-Schiffe',
      !!nachAnstrich.eskorte && nachAnstrich.eskorte !== vorAnstrich,
      { vorher: vorAnstrich, nachher: nachAnstrich.eskorte });
  }

  check('keine JS-Fehler', errs.length === 0, errs.slice(0,3));

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
