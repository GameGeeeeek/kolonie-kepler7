// Das Flottenwahl-Feld erscheint dort, wo der Angriff startet (05.08.2026).
//
// SPIELER-WUNSCH Sascha, woertlich: "wenn man Angriffe starten will finde ich es umstaendlich
// vorher irgendwo zu tippen volle Flotte dem Angriff hinzufuegen, warum bauen wir es nicht ein
// egal wo wir einen Angriff starten kommt ein Feld wo man aussuchen kann was man wegschicken
// will mit einem kleinen Reiter komplette Flotte".
//
// AUSGANGSLAGE, gemessen: Es gibt ZWOELF Stellen, an denen eine Flotte losgeschickt wird, und
// bis hierher GENAU EINE, an der man Schiffe waehlen konnte - die Box im Galaxie-Tab. Wer aus der
// Bestenliste, der Sektorkarte, einem Bericht oder dem Allianz-Tab angriff, schickte etwas los,
// das er woanders eingestellt hatte und im Moment des Klicks nicht sah.
//
// DER ENTSCHEIDENDE ENTWURFSPUNKT: Das Feld hat KEINEN eigenen Auswahlzustand. Es schreibt in
// dasselbe attackFleetSelection[planetKey], aus dem alle 22 Lesestellen von buildAttackFleet
// bereits ihre Flotte ziehen. Es entsteht also eine zweite BEDIENSTELLE, keine zweite QUELLE -
// und damit kann keine der 22 Stellen der neuen Bedienung widersprechen.
//
// GEPRUEFT WIRD:
//   1. Die Regel am Quelltext: eine Quelle, kein eigener Zustand, Overlay an document.body.
//   2. Im Browser: Der PvP-Knopf oeffnet das Feld, statt direkt loszuschicken.
//   3. Der Reiter "Komplette Flotte" waehlt wirklich alles Verfuegbare.
//   4. "Nichts" sperrt den Startknopf mit ausgeschriebener Begruendung.
//   5. Der Start schickt GENAU das los, was im Feld stand - der eigentliche Zweck.
//   6. DIE TICK-FALLE: Das Feld ueberlebt mehrere Sekunden, ohne dass der Haupt-Tick es
//      zuruecksetzt oder schliesst. Genau daran sind in diesem Projekt schon <details>, <select>
//      und die Verlegungs-Mengen gescheitert.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// ---- 1) die Regel am Quelltext
{
  const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
  check('1: die drei Funktionen gibt es genau einmal',
    ['oeffneFlottenwahl','schliesseFlottenwahl','zeichneFlottenwahl'].every(f =>
      (JS.match(new RegExp('function '+f+'\\b','g'))||[]).length === 1));

  const z = JS.slice(JS.indexOf('function zeichneFlottenwahl('), JS.indexOf('function verdrahteFlottenwahlZeilen('));
  // KEIN eigener Auswahlzustand - es muss getAttackSelection benutzen.
  check('1: das Feld benutzt dieselbe Auswahl wie alle Angriffe',
    /getAttackSelection\(state\.activeBasePlanet/.test(z));
  // Und es darf keinen eigenen Speicher anlegen.
  check('1: es legt keinen zweiten Auswahlspeicher an',
    !/fwahlSelection|fwahlAuswahl\s*=/.test(JS));

  // Overlay an document.body - sonst wuerde render() es mitreissen.
  const o = JS.slice(JS.indexOf('function oeffneFlottenwahl('), JS.indexOf('function schliesseFlottenwahl('));
  check('1: das Overlay hängt an document.body', /document\.body\.appendChild/.test(o));

  // Neu gezeichnet wird es von SEINEN EIGENEN Handlern, nicht mit dem globalen render().
  check('1: es zeichnet sich selbst neu statt das ganze Spiel',
    /verdrahteFlottenwahlZeilen\(ov, state\.activeBasePlanet, cf, zeichneFlottenwahl\)/.test(z));
}

const SAVE = () => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:9e5,deuterium:9e5,antimaterie:900,forschungspunkte:900},
  buildings:{solar:20,mine:18,labor:10,lager:40,werft:14}, research:{},
  // Kampfschiffe UND Frachter - damit "Ohne Zivilschiffe" etwas zu tun hat.
  fleet:{ jaeger:60, cruisers:30, frachter:10, missions:[] }, colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'Ich',avatarKey:null}, galaxySubTab:'kampf',
  xp:5000, credits:5000, buffs:[], lastTick:Date.now(), colonyNames:{} });

const GEGNER = { id:'feind1', name:'Zielperson', score:12000, level:12, allianceTag:'XYZ',
                 ships:{jaeger:10}, defensePower:500, buildLvl:10, colonyCount:2 };

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'Ich',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:false,tier:null}});
  if(p==='reports')return j({reports:[]});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p==='storage-list')return j({keys:['leaderboard:feind1']});
  if(p.startsWith('storage/')){
    const k=decodeURIComponent(p.slice(8));
    if(req.method()==='PUT'){ try { store[k]=JSON.parse(req.postData()).value; } catch(e){} return j({ok:true,version:2}); }
    if(k==='leaderboard:feind1') return j({key:k, value: JSON.stringify(GEGNER), version:1});
    if(store[k]!==undefined)return j({key:k,value:store[k],version:1});
    return j({e:1},404);
  }
  return j([]);
};}

const OFFEN = () => {
  const o = document.getElementById('fwahlOverlay');
  return !!(o && o.classList.contains('open'));
};
// Die im Feld angezeigten Mengen, je Schiffstyp - aus dem Markup gelesen, nicht aus dem Zustand.
const MENGEN = () => {
  const o = document.getElementById('fwahlOverlay');
  if (!o) return null;
  const raus = {};
  o.querySelectorAll('[data-atksel-inc]').forEach(b => {
    const k = b.getAttribute('data-atksel-inc');
    const pille = b.previousElementSibling;
    raus[k] = parseInt((pille && pille.textContent || '0').trim(), 10) || 0;
  });
  return raus;
};

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport:{width:1400,height:1000} });
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  // Der Store MUSS ausserhalb greifbar bleiben: Der Spielstand liegt im Backend-Mock, nicht im
  // localStorage - im ersten Anlauf suchte die Pruefung dort und fand nie eine Mission.
  const store = { 'kepler7-save-v3': SAVE() };
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  page.on('dialog', d => d.accept());
  await page.goto(SPIEL_URL); await page.waitForTimeout(4500);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(i=>{const o=document.getElementById(i); if(o)o.style.display='none';}));
  await page.evaluate(() => {
    const b=[...document.querySelectorAll('[data-tab]')].find(x=>x.getAttribute('data-tab')==='galaxie');
    if(b)b.click();
  });
  await page.waitForTimeout(2000);

  // Ziel ueber den echten Weg markieren.
  await page.evaluate(() => { const b=document.querySelector('[data-duel]'); if(b)b.click(); });
  await page.waitForTimeout(1500);

  // ---- 2) Der Knopf oeffnet das Feld, statt direkt loszuschicken.
  check('2: vorher ist kein Feld offen', !(await page.evaluate(OFFEN)));
  const gabKnopf = await page.evaluate(() => {
    const b = document.getElementById('pendingAttackBtn');
    if (!b || b.disabled) return false;
    b.click(); return true;
  });
  check('2: der Angriffsknopf war da und freigeschaltet', gabKnopf);
  await page.waitForTimeout(800);
  check('2: er öffnet das Flottenwahl-Feld', await page.evaluate(OFFEN));
  const kopf = await page.evaluate(() => {
    const t = document.querySelector('#fwahlOverlay .fwahl-titel');
    return t ? t.textContent.trim() : null;
  });
  check('2: mit dem Namen des Ziels im Kopf', /Zielperson/.test(kopf||''), kopf);

  // ---- 3) "Komplette Flotte" wählt wirklich alles Verfügbare.
  await page.evaluate(() => document.querySelector('[data-fwahl-alle]').click());
  await page.waitForTimeout(400);
  const alle = await page.evaluate(MENGEN);
  check('3: "Komplette Flotte" wählt alles - auch die Frachter',
    alle.jaeger === 60 && alle.cruisers === 30 && alle.frachter === 10, alle);

  // Frachtraum-Zeile (Idee Sascha 06.08.2026): Mit Transportern steht die Gesamt-Frachtmenge
  // samt Aufschluesselung im Fuss - 10 Kleine Frachter x 300 = 3.0k.
  const fussText = () => (document.querySelector('#fwahlOverlay .fwahl-fuss')||{}).textContent.replace(/\s+/g,' ') || '';
  const fussMit = await page.evaluate(fussText);
  check('3: mit Transportern steht die Gesamt-Frachtmenge im Fuß',
    /Frachtraum gesamt: 3\.0k/.test(fussMit) && /10× Kleiner Frachter/.test(fussMit),
    fussMit.match(/Frachtraum[^A-Z]*/)?.[0]?.trim());

  // Und "Ohne Zivilschiffe" laesst die Frachter stehen - der Unterschied ist der Punkt.
  await page.evaluate(() => document.querySelector('[data-fwahl-kampf]').click());
  await page.waitForTimeout(400);
  const kampf = await page.evaluate(MENGEN);
  check('3: "Ohne Zivilschiffe" lässt die Frachter daheim',
    kampf.jaeger === 60 && kampf.cruisers === 30 && kampf.frachter === 0, kampf);
  // DIE GEGENPROBE zur Frachtzeile ist die Live-Umschaltung selbst: Ohne Frachter verschwindet
  // die Mengenzeile, und weil dieser Auftrag Beute fuehrt (fracht:true), erscheint stattdessen
  // die rote Warnung. Ohne diese Pruefung waere die Zeile auch gruen, wenn sie immer da stuende.
  const fussOhne = await page.evaluate(fussText);
  check('3: ohne Frachter weicht die Zeile der Beute-Warnung',
    !/Frachtraum gesamt/.test(fussOhne) && /Ohne Frachter geht die gesamte Beute verloren/.test(fussOhne),
    fussOhne.match(/(Frachtraum|Ohne Frachter)[^·]*/)?.[0]?.trim());

  // ---- 4) "Nichts" sperrt den Start, mit Begründung.
  await page.evaluate(() => document.querySelector('[data-fwahl-nichts]').click());
  await page.waitForTimeout(400);
  const leer = await page.evaluate(() => {
    const b = document.querySelector('[data-fwahl-start]');
    // GEZIELT die Sperrbegruendung, nicht irgendeine Warnung: .fwahl-warn traegt auch die
    // Frachtraum-Warnung, und die stand im ersten Anlauf zuerst im Markup - der Test las sie
    // und meldete einen Fehlschlag, obwohl die Begruendung sehr wohl da war.
    const w = document.querySelector('#fwahlOverlay [data-fwahl-sperre]');
    return { gesperrt: !!(b && b.disabled), grund: w ? w.textContent.trim() : null };
  });
  check('4: ohne Schiffe ist der Start gesperrt', leer.gesperrt);
  check('4: und der Grund steht ausgeschrieben da', /mindestens ein Schiff/i.test(leer.grund||''), leer.grund);

  // ---- 6) DIE TICK-FALLE, vor dem Start geprüft: mehrere Sekunden stehen lassen.
  // Genau hier sind in diesem Projekt schon <details>, <select> und die Verlegungs-Mengen
  // gescheitert - der Haupt-Tick schreibt Boxen jede Sekunde neu.
  await page.evaluate(() => {
    const o = document.getElementById('fwahlOverlay');
    o.querySelector('[data-atksel-max="cruisers"]').click();
  });
  await page.waitForTimeout(4000);   // vier Sekunden-Ticks
  const nachTicks = await page.evaluate(MENGEN);
  check('6: das Feld ist nach vier Sekunden noch offen', await page.evaluate(OFFEN));
  check('6: und die Auswahl steht unverändert da', nachTicks.cruisers === 30 && nachTicks.jaeger === 0,
    { nachTicks, hinweis:'Der Haupt-Tick darf die Eingabe nicht zurücksetzen.' });

  // ---- 5) DER ZWECK: der Start schickt genau das los, was im Feld stand.
  await page.evaluate(() => document.querySelector('[data-fwahl-start]').click());
  await page.waitForTimeout(2500);
  check('5: nach dem Start ist das Feld zu', !(await page.evaluate(OFFEN)));
  let gesendet = null;
  try {
    const st = JSON.parse(store['kepler7-save-v3']);
    const m = ((st.fleet||{}).missions||[]).find(x => x.type === 'attack-player');
    gesendet = m ? m.composition : null;
  } catch(e){}
  check('5: es fliegt genau die gewählte Flotte (30 Kreuzer, keine Jäger)',
    !!gesendet && gesendet.cruisers === 30 && !(gesendet.jaeger > 0),
    gesendet || '(Mission nicht gefunden - siehe Hinweis im Test)');

  check('keine JS-Fehler', errs.length === 0, errs.slice(0,3));
  await ctx.close();

  // ---- 7) DIE ZEITKRITISCHEN EINSTIEGE: Piraten abfangen, mit LIVE-Countdown.
  // Hier war der alte Umweg am teuersten: Zum Zusammenstellen musste man in den Galaxie-Tab,
  // waehrend der Abzugs-Countdown lief - und die Flugzeitpruefung scheiterte dann an genau den
  // Sekunden, die der Tab-Wechsel gekostet hatte.
  // Eigener Kontext mit laufendem Piraten-Ueberfall im Spielstand.
  {
    const ctx2 = await browser.newContext({ viewport:{width:1400,height:1000} });
    const p2 = await ctx2.newPage(); const errs2 = [];
    p2.on('pageerror', e => errs2.push(String(e)));
    const mitRaid = JSON.parse(SAVE());
    mitRaid.pirateDebrisRaid = { planetKey:'home', fleet:{jaeger:14}, power:900,
      startTime: Date.now()-30000, endTime: Date.now()+540000, interceptArrival: null, interceptSource: null };
    await p2.route('**/api/**', backend({ 'kepler7-save-v3': JSON.stringify(mitRaid) }));
    await p2.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
    p2.on('dialog', d => d.accept());
    await p2.goto(SPIEL_URL); await p2.waitForTimeout(4500);
    await p2.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(i=>{const o=document.getElementById(i); if(o)o.style.display='none';}));
    // Der Abfangen-Knopf steht im Verteidigung-Tab.
    await p2.evaluate(() => {
      const b=[...document.querySelectorAll('[data-tab]')].find(x=>x.getAttribute('data-tab')==='verteidigung');
      if(b)b.click();
    });
    await p2.waitForTimeout(2200);
    const knopfDa = await p2.evaluate(() => {
      const b = document.getElementById('interceptPiratesBtn');
      if (!b) return false;
      b.click(); return true;
    });
    check('7: der Abfangen-Knopf öffnet das Feld', knopfDa && await p2.evaluate(OFFEN));
    // Der Countdown muss WIRKLICH ticken - zwei Ablesungen im Abstand von gut zwei Sekunden
    // muessen verschiedene Werte zeigen. Eine stehende Zahl waere bei einem zeitkritischen
    // Einsatz gefaehrlicher als gar keine.
    const ablesung = () => {
      const el = document.querySelector('#fwahlOverlay [data-fwahl-count]');
      return el ? el.textContent.trim() : null;
    };
    const t1 = await p2.evaluate(ablesung);
    await p2.waitForTimeout(2400);
    const t2 = await p2.evaluate(ablesung);
    check('7: der Countdown im Feld tickt live', !!t1 && !!t2 && t1 !== t2, { t1, t2 });
    // Und der Start schickt die Abfangmission wirklich los.
    await p2.evaluate(() => document.querySelector('[data-fwahl-alle]').click());
    await p2.waitForTimeout(300);
    await p2.evaluate(() => document.querySelector('[data-fwahl-start]').click());
    await p2.waitForTimeout(2000);
    const abgefangen = await p2.evaluate(() => {
      // Ueber die Anzeige messen: Nach dem Start zeigt die Box die anfliegende Abfangflotte.
      const box = document.getElementById('pirateDebrisRaidBox');
      return box ? /abfangen|Abfang|unterwegs/i.test(box.textContent||'') : false;
    });
    check('7: nach dem Start ist die Abfangflotte unterwegs', abgefangen);
    check('7: keine JS-Fehler', errs2.length === 0, errs2.slice(0,3));
    await ctx2.close();
  }

  // ---- 8) DER NPC-EINSTIEG: Angriffs-Knopf im Galaxie-Tab, mit LIVE-Vorschau.
  // Flugzeit und Treibstoff standen bisher nur im Kartenmenue, eingefroren auf den Stand beim
  // Oeffnen. Im Feld muessen sie mit der Auswahl MITZIEHEN - das ist der Kern der Pruefung:
  // andere Auswahl -> andere Flugzeit.
  {
    const ctx3 = await browser.newContext({ viewport:{width:1400,height:1000} });
    const p3 = await ctx3.newPage(); const errs3 = [];
    p3.on('pageerror', e => errs3.push(String(e)));
    const store3 = { 'kepler7-save-v3': SAVE() };
    await p3.route('**/api/**', backend(store3));
    await p3.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
    p3.on('dialog', d => d.accept());
    await p3.goto(SPIEL_URL); await p3.waitForTimeout(4500);
    await p3.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(i=>{const o=document.getElementById(i); if(o)o.style.display='none';}));
    await p3.evaluate(() => {
      const b=[...document.querySelectorAll('[data-tab]')].find(x=>x.getAttribute('data-tab')==='galaxie');
      if(b)b.click();
    });
    await p3.waitForTimeout(2200);
    const npcGeklickt = await p3.evaluate(() => {
      const b = document.querySelector('[data-attack]');
      if (!b) return null;
      b.click(); return b.getAttribute('data-attack');
    });
    check('8: der NPC-Angriffsknopf öffnet das Feld', !!npcGeklickt && await p3.evaluate(OFFEN), { npc: npcGeklickt });
    const vorschau = () => {
      const f = document.querySelector('#fwahlOverlay .fwahl-fuss');
      const m = (f && f.textContent || '').match(/Flugzeit ~([^·]+)·/);
      return m ? m[1].trim() : null;
    };
    // ALLE Klicks aufs Overlay beschraenkt: Die data-atksel-Knoepfe existieren ZWEIMAL im
    // Dokument - einmal in der alten Galaxie-Box, einmal im Overlay - und die Box kommt im DOM
    // zuerst. Der erste Anlauf klickte per document.querySelector die BOX-Knoepfe: Die Auswahl
    // aenderte sich (gemeinsamer Zustand!), aber das Overlay zeichnete nicht neu, und die
    // Flugzeit-Pruefung verglich zweimal denselben stehengebliebenen Stand.
    const imFeld = (sel) => `document.querySelector('#fwahlOverlay ${sel}').click()`;
    await p3.evaluate(new Function(imFeld('[data-fwahl-alle]')));
    await p3.waitForTimeout(300);
    const flugVoll = await p3.evaluate(vorschau);
    // Die Kreuzer (speed 70, am langsamsten) raus - das langsamste Schiff bestimmt das Tempo,
    // die Flugzeit MUSS sinken. (Die Jaeger sind ohnehin vom Hangar-Deckel auf 0 gekappt: ohne
    // Traeger fliegen sie nicht mit - deshalb zaehlt der Fuss hier 40 Schiffe, nicht 100.)
    await p3.evaluate(new Function(imFeld('[data-atksel-none="cruisers"]')));
    await p3.waitForTimeout(300);
    const flugSchnell = await p3.evaluate(vorschau);
    check('8: die Flugzeit-Vorschau zieht live mit der Auswahl mit',
      !!flugVoll && !!flugSchnell && flugVoll !== flugSchnell, { flugVoll, flugSchnell });
    // Fuer den Start: nur die Kreuzer.
    await p3.evaluate(new Function(imFeld('[data-fwahl-nichts]')));
    await p3.evaluate(new Function(imFeld('[data-atksel-max="cruisers"]')));
    await p3.waitForTimeout(300);
    await p3.evaluate(new Function(imFeld('[data-fwahl-start]')));
    await p3.waitForTimeout(2000);
    let npcMission = null;
    try {
      const st = JSON.parse(store3['kepler7-save-v3']);
      npcMission = ((st.fleet||{}).missions||[]).find(x => x.type === 'attack') || null;
    } catch(e){}
    // Erwartet werden die 30 KREUZER, die oben gewaehlt wurden - und null Jaeger. (Die Jaeger
    // koennten hier ohnehin nicht mitfliegen: ohne Traeger kappt der Hangar-Deckel sie auf 0.)
    check('8: der Start schickt die NPC-Mission mit genau dieser Flotte los',
      !!npcMission && (npcMission.composition||{}).cruisers === 30 && !((npcMission.composition||{}).jaeger > 0),
      npcMission ? { ziel: npcMission.targetId, cruisers: npcMission.composition.cruisers, jaeger: npcMission.composition.jaeger||0 } : '(keine Mission)');
    check('8: keine JS-Fehler', errs3.length === 0, errs3.slice(0,3));
    await ctx3.close();
  }
  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
