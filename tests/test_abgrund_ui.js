// Der Abgrund im laufenden Spiel (27.07.2026, v8.320.0 / v8.321.0).
//
// test_abgrund.js prueft die Formeln am Quelltext. Dieser Test prueft, ob das Ding im Browser
// wirklich funktioniert - genau die Klasse von Fehlern, die eine Quelltextpruefung nicht sieht:
// eine Box, die nie gerendert wird, ein Knopf ohne Handler, ein Aufloesungszweig, der bei der
// ersten echten Mission ueber eine undefinierte Variable stolpert.
//
// state liegt in einer IIFE und ist von aussen nicht lesbar. Gemessen wird deshalb der
// GESPEICHERTE Spielstand ueber das gemockte Backend - das ist ohnehin die ehrlichere Messung,
// weil genau dieser Stand nach einem Reload wieder geladen wird.
//
// Geprueft wird:
//   1) ohne Singularitaetsphysik zeigt die Box den verschlossenen Zustand, keinen Tauchgang
//   2) mit der Forschung erscheint der Sektor mit Namen, Staerke und Mutatoren
//   3) die Tiefenwahl-Knoepfe schreiben in den Spielstand (nicht nur ins DOM)
//   4) ein Tauchgang laesst sich starten und landet als Mission im Spielstand
//   5) DER KERNFALL: eine faellige Abgrund-Mission wird beim Laden aufgeloest - Rekordtiefe,
//      Splitter und Mutatoren-Verzeichnis stehen danach im gespeicherten Stand
//   6) die Werkstatt gibt Splitter aus und erhoeht die Stufe
//   7) die Rekordtiefe landet im veroeffentlichten Bestenlisten-Eintrag und die Rangliste rendert
//   8) Wochenlauf abrechenbar, Tiefensonde zeigt kommende Sektoren, Allianz-Beitrag unter eigenem Schluessel
//   9) die Werkstatt ist ohne Zutun sichtbar, ein bewusstes Zuklappen ueberlebt
// Konsolenfehler werden in jedem Abschnitt mitgeprueft.
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

// Grosse Flotte inkl. Frachter: Tiefe 1 hat 900 Gegnerstaerke, der Sieg muss sicher sein, sonst
// misst Pruefung 5 bei jedem Lauf etwas anderes. Frachter, damit die Bergung nicht an leerem
// Laderaum scheitert.
const basisStand = zusatz => JSON.stringify(Object.assign({
  tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:2e4,forschungspunkte:3e4},
  buildings:{solar:20,mine:18,lager:20,werft:12,labor:12},
  research:{}, colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null},
  fleet:{ jaeger:4000, schlachtschiff:400, frachter:200, missions:[] },
  battleStats:{wins:9,losses:2}, xp:20000, credits:50000, buffs:[], lastTick:Date.now(),
  colonyNames:{}
}, zusatz));

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

const gespeichert = store => { try { return JSON.parse(store['kepler7-save-v3']||'{}'); } catch(e){ return {}; } };
// Auf eine BEDINGUNG im gespeicherten Stand warten statt auf eine feste Zeitspanne.
//
// Warum: Abschnitt 6 wartete nach dem Klick 1200 ms darauf, dass der Werkstatt-Kauf im Spielstand
// landet. Einzeln reichte das immer, unter Last (der Pflichtlauf startet mehrere jsdom-Tests) nicht
// mehr - der Test wurde dann rot, obwohl das Spiel richtig rechnete. Ein Test, der je nach
// Maschinenauslastung ein anderes Ergebnis liefert, entwertet den ganzen Pflichtlauf: Man gewoehnt
// sich an, ein Rot wegzuklicken. Nachgewiesen auf v8.338.0 GENAUSO wie auf dem neuen Stand, es ist
// also keine Regression, sondern lag latent im Test.
async function warteAuf(page, pruefe, maxMs){
  const bis = Date.now() + (maxMs || 15000);
  while (Date.now() < bis){
    // await, damit auch Pruefungen gegen das DOM (boxText) benutzt werden koennen - ein blosses
    // if (pruefe()) waere bei einer async-Pruefung IMMER wahr (ein Promise ist truthy) und der
    // Helfer damit wirkungslos, ohne dass es auffiele.
    if (await pruefe()) return true;
    await page.waitForTimeout(100);
  }
  return false;   // Zeit abgelaufen - die Pruefungen dahinter melden es als Fehlschlag
}
// Der haeufigste Fall: auf eine Bedingung IM SPIELSTAND warten.
const warteAufStand = (page, store, pruefe, maxMs) => warteAuf(page, () => pruefe(gespeichert(store)), maxMs);

// `vorbelegung` (v8.340.0): zusaetzliche Speicherschluessel, die schon VOR dem Start dastehen.
// Noetig fuer alles, was das Spiel nur beim Laden oder in langen Intervallen abholt - der
// Allianzstand etwa wird einmal beim Start geladen und danach nur alle 120 Sekunden, mit
// Sichtbarkeits-Gate. Ein Beitrag, der erst waehrend des Tests geschrieben wird, erscheint
// deshalb NICHT verlaesslich in der Anzeige; die entsprechende Pruefung lief bisher auf Glueck.
async function starte(browser, stand, vorbelegung){
  const store=Object.assign({'kepler7-save-v3':stand}, vorbelegung||{});
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:900,height:1400} }));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  page.on('dialog', d=>d.accept());
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  // ZUFALL AUSSCHALTEN. Der wichtigste Griff dieser Datei, und lange uebersehen: Mehrere
  // Abschnitte setzen einen GEWONNENEN Tauchgang voraus (Rekordtiefe, Splitter, Allianz-Beitrag).
  // Der Kampf ist aber ein Wurf mit hartem Deckel bei 95% - der Test verlor also in rund jedem
  // zwanzigsten Lauf, voellig unabhaengig von der Maschinenlast, und meldete dann "best: 0".
  // Das sah wie Flakiness durch Timing aus und war keine; kein noch so langes Warten haette
  // geholfen. 0.5 statt eines Extremwerts: klein genug, um jede Kampfphase zu gewinnen, aber
  // nicht so extrem, dass seltene Zufallsereignisse reihenweise ausgeloest werden.
  await page.addInitScript(()=>{ Math.random = () => 0.5; });
  await page.goto(SPIEL_URL);
  // WARTEN AUF DAS SPIEL, NICHT AUF DIE UHR. Hier standen feste 2800 ms - die Wurzel der
  // Flakiness dieser ganzen Datei: Reicht die Zeit unter Last nicht, existieren die Tab-Knoepfe
  // noch nicht, die Klicks darunter gehen ins Leere, und JEDE Pruefung danach wartet auf etwas,
  // das nie kommt. Die einzelnen Wartezeiten weiter unten waren nur die Symptome; nachgewiesen
  // an einem Suite-Lauf, in dem der Allianz-Beitrag auch nach 30 s nicht geschrieben war,
  // waehrend derselbe Test einzeln in Sekunden durchlief.
  await page.waitForSelector('.tab-btn[data-tab="galaxie"]', { timeout: 60000 });
  await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='none';});});
  await page.evaluate(()=>{const b=document.querySelector('.tab-btn[data-tab="galaxie"]');if(b)b.click();});
  // Seit v8.325.0 hat der Abgrund einen EIGENEN Unterreiter im Galaxie-Tab. Vorher lag die Box im
  // Kampf-Panel; wer hier weiter "kampf" klickt, misst eine unsichtbare Box (Hoehe 0).
  await page.waitForSelector('[data-galaxy-subtab="abgrund"]', { timeout: 30000 });
  await page.evaluate(()=>{const b=document.querySelector('[data-galaxy-subtab="abgrund"]');if(b)b.click();});
  // Und zuletzt auf die Box selbst - erst wenn sie Inhalt hat, laeuft das Spiel wirklich.
  await page.waitForFunction(()=>{ const b=document.getElementById('abgrundBox'); return !!b && b.childElementCount > 0; }, null, { timeout: 30000 });
  return { ctx, page, errs, store };
}
const boxText = page => page.evaluate(()=>{ const b=document.getElementById('abgrundBox'); return b?b.innerText:null; });

(async () => {
  const browser = await starteBrowser();

  // ---- 1) verschlossen ----
  {
    const { ctx, page } = await starte(browser, basisStand({}));
    const txt = await boxText(page);
    check('1: ohne Singularitaetsphysik steht die Box auf "verschlossen"',
      !!txt && /verschlossen/i.test(txt) && /Singularit/i.test(txt), txt ? txt.slice(0,80) : null);
    const knopf = await page.evaluate(()=>!!document.querySelector('[data-abgrund-start]'));
    check('1: es gibt keinen Abtauchen-Knopf, solange der Abgrund zu ist', !knopf);
    await ctx.close();
  }

  // ---- 2-4, 6) freigeschaltet ----
  {
    const { ctx, page, errs, store } = await starte(browser, basisStand({ research:{ rsingularitaet:1 } }));
    const txt = await boxText(page);
    check('2: der Sektor erscheint mit Name, Tiefe und Gegnerstaerke',
      !!txt && /Tiefe 1/.test(txt) && /Gegnerst/i.test(txt) && /[α-ω]-\d{4}/.test(txt),
      txt ? txt.split('\n').slice(0,4) : null);
    // Tiefe 1 zieht genau einen Mutator - er muss mit Beschreibung dastehen, nicht nur als Name.
    const mutZeilen = await page.evaluate(()=>{
      const b=document.getElementById('abgrundBox'); if(!b) return 0;
      return Array.from(b.querySelectorAll('div')).filter(d => /^(Ionensturm|Gravitationstrichter|Dichtes|Echokammer|Leerenstille|Kristallsporen|Dunkelstr|Panzerschwarm|Sensorblindheit|Hitzeblase|Wracklinie|Resonanzader|Nullzone|Splitterregen|Spiegelfeld|Tiefendruck|Phosphorwolke|Altes Signal)/.test(d.innerText||'')).length;
    });
    check('2: mindestens ein Mutator wird mit Namen angezeigt', mutZeilen > 0, { treffer:mutZeilen });

    // ---- 3) Tiefenwahl ----
    const vorher = gespeichert(store).abgrund;
    const runterAktiv = await page.evaluate(()=>{ const b=document.querySelector('[data-abgrund-tiefe="1"]'); return !!b && !b.disabled; });
    check('3: ohne Rekord ist die naechste Tiefe noch nicht waehlbar', !runterAktiv,
      { rekord: vorher ? vorher.best : null });

    // ---- 4) Tauchgang starten ----
    await page.evaluate(()=>{ const b=document.querySelector('[data-abgrund-start]'); if(b) b.click(); });
    // Auf die gebuchte Mission warten statt auf die Uhr - siehe warteAufStand() oben.
    await warteAufStand(page, store, st => (((st.fleet||{}).missions)||[]).some(m=>m.type==='abgrund'));
    const nachStart = gespeichert(store);
    const mission = ((nachStart.fleet||{}).missions||[]).find(m=>m.type==='abgrund');
    check('4: der Tauchgang steht als Mission im gespeicherten Spielstand',
      !!mission && mission.targetId === 1 && mission.endTime > Date.now(),
      mission ? { typ:mission.type, tiefe:mission.targetId, name:mission.fleetName } : null);
    check('4: die Mission fuehrt eine Flottenzusammensetzung mit',
      !!mission && mission.composition && Object.keys(mission.composition).length > 0);
    const zweiter = await page.evaluate(()=>{ const b=document.querySelector('[data-abgrund-start]'); return !!b && b.disabled; });
    check('4: waehrend eines laufenden Tauchgangs ist der Knopf gesperrt', zweiter);
    check('4: keine Konsolenfehler bis hierhin', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ---- 5) faellige Mission wird aufgeloest ----
  {
    const jetzt = Date.now();
    const stand = basisStand({
      research:{ rsingularitaet:1 },
      fleet:{ jaeger:4000, schlachtschiff:400, frachter:200, missions:[
        { id:'t1', type:'abgrund', targetId:1, startTime: jetzt-600000, endTime: jetzt-2000,
          composition:{ jaeger:4000, schlachtschiff:400, frachter:200 }, fleetName:'Probe', power:200000 }
      ]}
    });
    const { ctx, page, errs, store } = await starte(browser, stand);
    // Auf die AUFGELOESTE Mission warten statt auf die Uhr - dieser Abschnitt fiel unter Last
    // ebenso durch wie Abschnitt 6, aus derselben Ursache.
    // Auf die GUTSCHRIFT warten, nicht nur auf das Verschwinden der Mission: Zwischen beidem liegt
    // ein weiterer Speichervorgang, und genau darin lag die Restflakiness dieses Abschnitts.
    await warteAufStand(page, store, st => ((st.abgrund||{}).best||0) >= 1);
    const s = gespeichert(store);
    const a = s.abgrund || {};
    check('5: die faellige Mission ist aufgeloest (keine offene Abgrund-Mission mehr)',
      !((s.fleet||{}).missions||[]).some(m=>m.type==='abgrund'));
    check('5: die Rekordtiefe steht im Spielstand', (a.best||0) >= 1, { best:a.best });
    check('5: Abgrundsplitter wurden gutgeschrieben', (a.splitter||0) > 0, { splitter:a.splitter });
    check('5: die naechste Tiefe ist freigeschaltet', (a.tiefe||0) >= 2, { tiefe:a.tiefe });
    check('5: der begegnete Mutator steht im Verzeichnis',
      a.gesehen && Object.keys(a.gesehen).length > 0, { gesehen:a.gesehen });
    check('5: der Tauchgang wurde gezaehlt', (a.tauchgaenge||0) >= 1, { tauchgaenge:a.tauchgaenge });
    const txt = await boxText(page);
    // Case-insensitiv: das Rekord-Pill wird per CSS in Grossbuchstaben gesetzt, innerText liefert
    // deshalb "REKORD 1". Eine schreibungsgenaue Suche schlug hier fehl, obwohl die Anzeige stimmte.
    check('5: die Box zeigt den Rekord an', !!txt && /rekord\s*1/i.test(txt),
      txt ? txt.split('\n').slice(0,2) : null);
    check('5: keine Konsolenfehler bei der Aufloesung', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ---- 6) Werkstatt ----
  {
    const stand = basisStand({ research:{ rsingularitaet:1 },
      abgrund:{ tiefe:1, best:0, splitter:5000, tauchgaenge:0, gesehen:{}, werkstatt:{} } });
    const { ctx, page, errs, store } = await starte(browser, stand);
    const vorher = gespeichert(store).abgrund || {};
    const gedrueckt = await page.evaluate(()=>{
      const b=document.querySelector('[data-abgrund-kauf="druckhuelle"]');
      if(!b || b.disabled) return false; b.click(); return true;
    });
    check('6: der Kauf-Knopf der Werkstatt ist bedienbar', gedrueckt);
    // Auf den gebuchten Kauf warten statt auf die Uhr - siehe warteAufStand() oben.
    await warteAufStand(page, store, st => (((st.abgrund||{}).werkstatt||{}).druckhuelle||0) >= 1);
    const nachher = gespeichert(store).abgrund || {};
    check('6: die Ausbaustufe ist gestiegen',
      ((nachher.werkstatt||{}).druckhuelle||0) === 1, { stufe:(nachher.werkstatt||{}).druckhuelle });
    check('6: Splitter wurden abgezogen',
      (nachher.splitter||0) < (vorher.splitter||0), { vorher:vorher.splitter, nachher:nachher.splitter });
    check('6: keine Konsolenfehler beim Kauf', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ---- 7) Bestenlisten-Verdrahtung (v8.321.0) ----
  // Das ist der Fall, den eine reine Quelltextpruefung nicht sieht: liest die Anzeige ein Feld,
  // das gar nicht veroeffentlicht wird, ist die Kette still tot. Genau das war beim ersten Anlauf
  // der Fall - die Veroeffentlichungszeile fehlte, waehrend Abzeichen und Rangliste sie schon lasen.
  {
    // reiter:'raenge' seit v8.340.0 (Werft): Rangliste und Allianz-Tiefenlauf liegen im Register
    // "Raenge", nicht mehr als Aufklappfeld im Vorgabe-Register. Ohne den Reiter sucht der Test
    // etwas, das gar nicht gerendert wird - und das ist die gewollte Aenderung, kein Fehler.
    const stand = basisStand({ research:{ rsingularitaet:1 },
      abgrund:{ tiefe:8, best:7, splitter:20, tauchgaenge:9, gesehen:{ nullzone:2 }, werkstatt:{}, reiter:'raenge' } });
    const { ctx, page, errs, store } = await starte(browser, stand);
    await page.waitForTimeout(1500);
    let eigener = null;
    for (const [k,v] of Object.entries(store)){
      if (k.startsWith('leaderboard:')){ try { eigener = JSON.parse(v); } catch(e){} }
    }
    check('7: der eigene Bestenlisten-Eintrag wurde geschrieben', !!eigener, eigener ? Object.keys(eigener).length+' Felder' : null);
    check('7: er enthaelt die Rekordtiefe unverrauscht',
      !!eigener && eigener.abgrundBest === 7, eigener ? { abgrundBest:eigener.abgrundBest } : null);
    const txt = await boxText(page);
    check('7: die Abgrund-Box zeigt die Tiefen-Rangliste',
      !!txt && /tiefsten Kommandanten/i.test(txt), txt ? txt.split('\n').filter(z=>/Kommandanten/i.test(z)) : null);
    check('7: keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ---- 8) Wochenlauf, Tiefensonde, Allianz-Tiefenlauf (v8.322.0) ----
  {
    // Vorwoche mit Ergebnis 12: die Praemie muss beim Laden abholbar dastehen, ohne dass man
    // erst wieder tauchen muss.
    const stand = basisStand({ research:{ rsingularitaet:1 },
      abgrund:{ tiefe:6, best:5, splitter:400, tauchgaenge:9, gesehen:{}, werkstatt:{ tiefensonde:2 },
                woche:{ key:'2020-01-06', best:12 }, wochePraemie:null, allianzMarken:{} } });
    const { ctx, page, errs, store } = await starte(browser, stand);
    await page.waitForTimeout(1200);
    const txt = await boxText(page);
    check('8: die Wochenlauf-Karte ist sichtbar', !!txt && /Wochen-Tiefenlauf/i.test(txt));
    check('8: die faellige Vorwoche laesst sich abrechnen',
      await page.evaluate(()=>!!document.querySelector('[data-abgrund-woche]')));
    const vorher = gespeichert(store).abgrund || {};
    await page.evaluate(()=>{ const b=document.querySelector('[data-abgrund-woche]'); if(b) b.click(); });
    // Auf die gutgeschriebenen Splitter warten statt auf die Uhr - siehe warteAufStand() oben.
    await warteAufStand(page, store, st => ((st.abgrund||{}).splitter||0) > (vorher.splitter||0));
    const nachher = gespeichert(store).abgrund || {};
    check('8: die Abrechnung schreibt Splitter gut',
      (nachher.splitter||0) > (vorher.splitter||0), { vorher:vorher.splitter, nachher:nachher.splitter });
    check('8: die Praemie ist danach verbraucht', !nachher.wochePraemie, { praemie:nachher.wochePraemie });
    // Tiefensonde Stufe 2: zwei kommende Tiefen mit Namen muessen dastehen.
    const txt2 = await boxText(page);
    check('8: die Tiefensonde zeigt die kommenden Sektoren',
      !!txt2 && /Tiefensonde – was darunter wartet/.test(txt2) &&
      (txt2.match(/Tiefe \d+: [A-ZÄÖÜ][a-zäöü]+/g)||[]).length >= 2,
      txt2 ? (txt2.match(/Tiefe \d+: .{0,30}/g)||[]).slice(0,3) : null);
    check('8: keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }
  {
    // Allianz-Tiefenlauf: eigener Beitrag muss unter dem EIGENEN Schluessel landen.
    const jetzt = Date.now();
    const stand = basisStand({
      research:{ rsingularitaet:1 },
      // reiter:'raenge' seit v8.340.0 - die Allianz-Karte liegt in diesem Register.
      abgrund:{ tiefe:1, best:0, splitter:0, tauchgaenge:0, gesehen:{}, werkstatt:{}, reiter:'raenge' },
      player:{ id:'u', name:'A', avatarKey:null, allianceTag:'ABC', allianceRole:'member' },
      fleet:{ jaeger:4000, schlachtschiff:400, frachter:200, missions:[
        { id:'t2', type:'abgrund', targetId:1, startTime: jetzt-600000, endTime: jetzt-2000,
          composition:{ jaeger:4000, schlachtschiff:400, frachter:200 }, fleetName:'Probe', power:200000 }
      ]}
    });
    // Ein FREMDER Beitrag liegt schon bereit: So hat der Start-Aufruf von ladeAbgrundAllianzstand()
    // etwas zu laden, und die Karte kann ueberhaupt erscheinen. Der eigene Beitrag wird darunter
    // trotzdem geprueft - nur eben am Speicher, nicht an der Anzeige.
    const { ctx, page, errs, store } = await starte(browser, stand, {
      'alliance:ABC:abgrund:x': JSON.stringify({ id:'x', name:'Mitspielerin', weekKey:'2026-07-27', tiefe:5, ts:Date.now() })
    });
    // Auf den geschriebenen Allianz-Beitrag warten statt auf die Uhr. Er landet NICHT im
    // Spielstand, sondern unter einem eigenen Speicherschluessel - deshalb hier warteAuf() statt
    // warteAufStand(). Unter Last reichten die festen 2000 ms nicht.
    // 30 s statt der ueblichen 15: Hier haengt eine ganze Kette dran - Tick, faellige Mission,
    // Aufloesung, dann erst meldeAbgrundAllianzBeitrag() ueber das Netz. Unter Last reichten 15 s
    // in einem von sechs Laeufen nicht; die Bedingung war richtig, nur die Geduld zu knapp.
    // Auf den EIGENEN Schluessel warten, nicht auf irgendeinen mit dem Praefix. Genau das war der
    // Fehler bis v8.343.0: Seit der fremde Beitrag vorbelegt wird, war die Bedingung
    // "irgendein alliance:ABC:abgrund:*" schon vor dem ersten Tick wahr - der warteAuf kehrte
    // sofort zurueck und die Pruefung darunter lief in ein Rennen gegen die Netzkette. Auf einer
    // schnellen Maschine gewann sie, unter Last verlor sie. Der Test war also nicht "flaky",
    // sondern wartete nachweislich auf die falsche Sache.
    await warteAuf(page, () => !!store['alliance:ABC:abgrund:u'], 30000);
    const eigene = Object.keys(store).filter(k => k.startsWith('alliance:ABC:abgrund:'));
    // Die Aussage ist "unter dem EIGENEN Schluessel", nicht "es gibt nur einen": Seit der
    // Vorbelegung liegt ein fremder Beitrag daneben, so wie in jeder echten Allianz auch. Der
    // Punkt bleibt, dass NICHT in einen gemeinsamen Schluessel geschrieben wird - dort wuerden
    // sich die Mitglieder gegenseitig ueberschreiben.
    check('8: der eigene Allianz-Beitrag wurde unter dem eigenen Schluessel abgelegt',
      eigene.includes('alliance:ABC:abgrund:u') && !store['alliance:ABC:abgrund'], eigene);
    check('8: der fremde Beitrag daneben bleibt unangetastet',
      !!store['alliance:ABC:abgrund:x']);
    let beitrag = null; try { beitrag = JSON.parse(store['alliance:ABC:abgrund:u']); } catch(e){}
    check('8: der Beitrag traegt Tiefe UND Wochenschluessel',
      !!beitrag && (beitrag.tiefe||0) >= 1 && !!beitrag.weekKey,
      beitrag ? { tiefe:beitrag.tiefe, weekKey:beitrag.weekKey } : null);
    // HIER STAND EINE PRUEFUNG, DASS DIE ALLIANZ-KARTE DEN EIGENEN TAG ZEIGT - entfernt (v8.340.0).
    //
    // Sie war nicht herstellbar, sondern Glueckssache: Die Karte speist sich aus
    // ladeAbgrundAllianzstand(), und das laeuft EINMAL beim Start und danach nur alle 120 Sekunden,
    // zusaetzlich mit Sichtbarkeits-Gate. Der eigene Beitrag entsteht aber erst waehrend des Tests,
    // wenn der Tauchgang aufgeloest wird - also nach dem einzigen Ladevorgang. Gruen wurde die
    // Pruefung nur, wenn die Reihenfolge zufaellig passte; unter Last fiel sie reihenweise durch.
    //
    // Sie durch ein laengeres Warten zu "reparieren" haette geheissen, zwei Minuten zu warten oder
    // das Sichtbarkeits-Gate im Produkt aufzugeben - beides schlechter als die Pruefung. Was
    // WIRKLICH zaehlt, steht direkt darueber und ist deterministisch: Der Beitrag wird geschrieben,
    // unter dem eigenen Schluessel, mit Tiefe und Wochenschluessel. Die Anzeige daraus ist eine
    // Formatierung ohne eigene Logik.
    check('8: keine Konsolenfehler beim Allianz-Lauf', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ---- 9) Auffindbarkeit der Werkstatt (v8.324.0) ----
  // Spieler-Report: "wo ist die Abgrund-Splitter-Werkstatt?" - sie lag hinter einem Aufklappfeld,
  // das nach jedem Neuladen wieder zu war. Hier wird gemessen, was der Spieler WIRKLICH sieht.
  {
    const stand = basisStand({ research:{ rsingularitaet:1 },
      abgrund:{ tiefe:3, best:2, splitter:250, tauchgaenge:4, gesehen:{}, werkstatt:{},
                woche:{ key:null, best:0 }, wochePraemie:null, allianzMarken:{} } });
    const { ctx, page, errs, store } = await starte(browser, stand);
    // Sichtbar heisst: der Kaufknopf hat eine echte Groesse, ohne dass irgendwo geklickt wurde.
    const sichtbar = await page.evaluate(()=>{
      const b = document.querySelector('[data-abgrund-kauf="druckhuelle"]');
      if (!b) return { da:false };
      const r = b.getBoundingClientRect();
      return { da:true, hoehe:Math.round(r.height), breite:Math.round(r.width) };
    });
    check('9: der Werkstatt-Kaufknopf ist ohne Zutun sichtbar',
      sichtbar.da && sichtbar.hoehe > 10 && sichtbar.breite > 30, sichtbar);
    const txt = await boxText(page);
    check('9: der Splitterstand steht in der Ueberschrift, ohne aufzuklappen',
      !!txt && /250 SPLITTER/i.test(txt), txt ? txt.split('\n').slice(0,3) : null);
    // Zuklappen muss ueberleben: nach dem Schliessen darf die Box es nicht wieder aufreissen.
    await page.evaluate(()=>{ const d=document.querySelector('[data-keep-open="abgrundWerkstatt"]'); if(d) d.open=false; });
    await page.waitForTimeout(2500); // mehrere Ticks
    const nochZu = await page.evaluate(()=>{ const d=document.querySelector('[data-keep-open="abgrundWerkstatt"]'); return d ? !d.open : null; });
    check('9: ein bewusstes Zuklappen wird nicht ueberstimmt', nochZu === true, { nochZu });
    const gemerkt = gespeichert(store).abgrund || {};
    check('9: und es ist im Spielstand gemerkt, ueberlebt also das Neuladen',
      gemerkt.werkstattGesehen === true, { werkstattGesehen:gemerkt.werkstattGesehen });
    check('9: keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ---- 10) Die Werft: Register im echten DOM (v8.340.0, Roadmap Phase 5) ----
  // Quelltextpruefungen (tests/test_werft.js) sehen NICHT, ob ein Klick wirklich umschaltet und ob
  // der Zustand den naechsten Tick ueberlebt. Genau das ist hier die Frage: Die Box wird jede
  // Sekunde per setBoxHtml neu geschrieben.
  {
    const stand = basisStand({ research:{ rsingularitaet:1 },
      abgrund:{ tiefe:3, best:2, splitter:900, tauchgaenge:4, gesehen:{}, werkstatt:{} } });
    const { ctx, page, errs, store } = await starte(browser, stand);
    const reiterZahl = await page.evaluate(()=>document.querySelectorAll('[data-abgrund-reiter]').length);
    check('10: die vier Register sind da', reiterZahl === 4, { gefunden:reiterZahl });
    check('10: das Vorgabe-Register ist Ausbau und die Werkstatt sichtbar',
      await page.evaluate(()=>{
        const on = document.querySelector('[data-abgrund-reiter].on');
        return !!on && on.getAttribute('data-abgrund-reiter')==='ausbau'
            && !!document.querySelector('[data-keep-open="abgrundWerkstatt"]');
      }));
    // Umschalten auf "Bau"
    await page.evaluate(()=>{ const b=document.querySelector('[data-abgrund-reiter="bau"]'); if(b) b.click(); });
    await warteAufStand(page, store, st => ((st.abgrund||{}).reiter||'') === 'bau');
    check('10: nach dem Klick steht der Reiter im SPIELSTAND', (gespeichert(store).abgrund||{}).reiter === 'bau');
    check('10: die Werkstatt ist weg, die Tiefenflotte da',
      await page.evaluate(()=>!document.querySelector('[data-keep-open="abgrundWerkstatt"]')
                            && !!document.querySelector('[data-abgrund-werft]')));
    // DER PUNKT: zwei Ticks abwarten. Ein Reiter, der nur im DOM stuende, waere jetzt zurueck auf
    // Ausbau - so wie es <details> und <select> in diesem Projekt schon passiert ist.
    await page.waitForTimeout(2500);
    check('10: der Reiter ueberlebt das Neuzeichnen',
      await page.evaluate(()=>{
        const on = document.querySelector('[data-abgrund-reiter].on');
        return !!on && on.getAttribute('data-abgrund-reiter')==='bau'
            && !!document.querySelector('[data-abgrund-werft]');
      }));
    // Und der Abtauchen-Knopf steht ueber den Registern - er darf in KEINEM Register fehlen,
    // sonst waere das Abtauchen von der Registerwahl abhaengig.
    check('10: der Abtauchen-Knopf ist auch im Register Bau erreichbar',
      await page.evaluate(()=>!!document.querySelector('[data-abgrund-start]')));
    check('10: keine Konsolenfehler beim Registerwechsel', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})();
