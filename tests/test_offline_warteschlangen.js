// Warteschlangen offline (27.07.2026, v8.314.0).
//
// Spieler-Report: "Warteschlangen werden nicht abgearbeitet, wenn man offline ist." Der Befund
// stimmte zur Hälfte, und genau das machte ihn zäh: Der Auftrag, der beim Verlassen SCHON lief,
// war beim Zurückkommen fertig - seine endTime stand fest in der Vergangenheit, und
// processConstructionQueue()/processResearch() vergleichen gegen Date.now(). Alles, was dahinter
// WARTETE, rührte sich nicht: activateQueuedJobs() vergibt startTime/endTime erst im Moment der
// Ausführung und startet pro Gruppe nur einen Auftrag pro Tick.
//
// Gemessen vor dem Umbau, zwei Stunden Abwesenheit, drei Bauaufträge zu je 60 Sekunden:
//   Solarkraftwerk 20 -> 21 (EINER von drei), zwei Aufträge noch in der Schlange, einer davon
//   gerade erst gestartet. Forschung: die laufende fertig, die erste Warteschlangen-Forschung
//   startete im Moment der Rückkehr, die zweite wartete weiter.
//
// Der Test setzt lastTick zwei Stunden zurück und lädt das Spiel - das ist der echte Offline-Pfad,
// nicht ein direkter Aufruf der Funktion.
//
// Geprüft wird:
//   1) alle drei Bauaufträge sind fertig (Gebäudestufe +3, Warteschlange leer)
//   2) alle drei Forschungen sind fertig (die laufende plus beide aus der Warteschlange)
//   3) der Deckel: bei 30 Stunden Abwesenheit wird nur für 8 Stunden gebaut, nicht für 30
//   4) ein Auftrag, der beim Zurückkommen noch mitten in der Bauzeit steckt, läuft mit
//      Teilfortschritt weiter (startTime liegt in der Vergangenheit) statt bei 0 anzufangen
//   5) das "Willkommen zurück"-Fenster nennt die fertigen Aufträge - sonst stünde man vor
//      gestiegenen Stufen ohne Erklärung
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

// Ein Bauauftrag muss GENAU die Felder tragen, die queueConstruction() setzt - ein von Hand
// zusammengeschriebener Auftrag mit fehlenden Feldern rendert "undefined" in der Fortschrittskarte
// und misst am Ende etwas anderes als das Spiel wirklich tut.
function bauauftrag(i, bezahlt, endTime){
  return { id:'job'+i, kind:'building', planet:'home', key:'solar', qty:1, paid:bezahlt,
           startTime: bezahlt ? endTime-60000 : null, endTime: bezahlt ? endTime : null,
           totalDur:60, label:'Solarkraftwerk (+1)', icon:'ti-sun',
           cost:{ erz:100, kristalle:50 }, specialItemKey:null, specialItemQty:0 };
}

function save(stundenWeg, opts){
  opts = opts || {};
  const vor = Date.now() - stundenWeg*3600*1000;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
    // Reichlich Ressourcen: Der Test prüft die ZEIT-Logik, nicht die Bezahlbarkeit. Wäre der
    // Vorrat knapp, könnte ein grüner Lauf auch vom Zufall der Offline-Gutschrift kommen.
    resources:{energie:9e6,erz:9e6,kristalle:9e6,deuterium:9e6,antimaterie:9e5,forschungspunkte:9e5},
    buildings:{solar:20,mine:20,labor:14,lager:20,werft:12}, research:{},
    fleet:{jaeger:100,missions:[]}, colonies:{}, activeBasePlanet:'home',
    player:{id:'u',name:'A',avatarKey:null},
    constructionQueue: opts.jobs !== undefined ? opts.jobs : [
      bauauftrag(1, true, vor+60000), bauauftrag(2, false), bauauftrag(3, false) ],
    activeResearch: opts.keineForschung ? null : { key:'rsolar', targetLevel:1, endTime: vor+30000 },
    researchQueue: opts.keineForschung ? [] : ['rerz','rkristall'],
    buildQueue:[], battleStats:{wins:5,losses:1}, xp:20000, credits:50000, buffs:[],
    lastTick: vor, colonyNames:{} });
}

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

// `state` liegt in der Spieldatei innerhalb einer Kapselung und ist im Fenster nicht sichtbar -
// page.evaluate(()=>state) läuft in einen ReferenceError. Gemessen wird deshalb am GESPEICHERTEN
// Stand, den das Spiel direkt nach dem Laden ans (hier nachgestellte) Backend schickt. Das ist
// obendrein die härtere Prüfung: Was hier nicht ankommt, überlebt auch keinen echten Reload.
async function lade(browser, spielstand){
  const store={'kepler7-save-v3':spielstand};
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:900,height:1100} }));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL);
  // Auf das Speichern nach dem Laden warten: lastTick wird dabei auf jetzt gesetzt, der geladene
  // Stand trug ihn Stunden zurück. Erst dann steht im Speicher der Stand NACH der Offline-Rechnung.
  const alt = JSON.parse(spielstand).lastTick;
  for (let i=0; i<40; i++){
    await page.waitForTimeout(300);
    const s = holen(store);
    if (s && s.lastTick && s.lastTick > alt + 60000) break;
  }
  return { page, ctx, errs, store };
}

function holen(store){
  const v = store['kepler7-save-v3'];
  if (v === undefined) return null;
  try { return typeof v === 'string' ? JSON.parse(v) : v; } catch(e){ return null; }
}

function stand(store){
  const s = holen(store) || {};
  const q = s.constructionQueue || [];
  return {
    solar: (s.buildings||{}).solar,
    offen: q.length,
    bezahltOffen: q.filter(j=>j.paid).length,
    laufendStart: q.filter(j=>j.paid).map(j=>j.startTime),
    rsolar: (s.research||{}).rsolar||0, rerz: (s.research||{}).rerz||0, rkristall: (s.research||{}).rkristall||0,
    fSchlange: (s.researchQueue||[]).length, fAktiv: !!s.activeResearch
  };
}

(async () => {
  const browser = await starteBrowser();

  // ---------------------------------------------------------------- 1+2) zwei Stunden weg
  {
    const { page, ctx, errs, store } = await lade(browser, save(2));
    const s = stand(store);
    check('1: alle drei Bauaufträge sind fertig (Stufe 20 -> 23)', s.solar === 23, s);
    check('1: die Bauwarteschlange ist leer', s.offen === 0, s);
    check('2: die laufende Forschung ist fertig', s.rsolar === 1, s);
    check('2: die erste Forschung aus der Warteschlange ist fertig', s.rerz === 1, s);
    check('2: die zweite Forschung aus der Warteschlange ist fertig', s.rkristall === 1, s);
    check('2: die Forschungswarteschlange ist leer und nichts läuft mehr',
      s.fSchlange === 0 && s.fAktiv === false, s);

    // 5) Die Zusammenfassung MUSS es nennen - der Fortschritt, der den Spieler am meisten
    // interessiert, darf nicht die einzige Größe sein, die das Fenster verschweigt.
    let fenster = null;
    for (let i=0;i<20 && !fenster;i++){
      await page.waitForTimeout(300);
      fenster = await page.evaluate(()=>{
        const b=document.getElementById('welcomeBackBody');
        return (b && b.textContent) ? b.textContent : null;
      });
    }
    check('5: das Willkommen-zurück-Fenster nennt die fertigen Bauaufträge',
      !!fenster && /Bauaufträge fertiggestellt/.test(fenster), fenster && fenster.slice(0,220));
    check('5: und die abgeschlossenen Forschungen',
      !!fenster && /Forschungen abgeschlossen/.test(fenster), fenster && fenster.slice(0,220));
    check('keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ---------------------------------------------------------------- 3) der 8-Stunden-Deckel
  // 30 Stunden weg, 20 Aufträge zu je 50 Minuten. In 30 Stunden gingen alle 20 durch, in 8
  // Stunden nur 9 (9x50min = 7,5 Std., der zehnte ragt über das Fenster hinaus). Die 50 Minuten
  // sind mit Absicht KEIN glatter Teiler der 8 Stunden: Bei glatt aufgehender Dauer endet der
  // letzte Auftrag exakt zur Fenstergrenze und es bliebe gar kein angefangener Auftrag übrig -
  // Prüfung 4 hätte dann nichts zu messen und wäre leer wahr.
  {
    const vor = Date.now() - 30*3600*1000;
    const lang = [];
    for (let i=0;i<20;i++){
      const j = bauauftrag(i, false);
      j.totalDur = 3000;
      lang.push(j);
    }
    const { page, ctx, errs, store } = await lade(browser, save(30, { jobs:lang, keineForschung:true }));
    const s = stand(store);
    check('3: der Deckel greift - nicht alle 20 Aufträge sind fertig', s.solar < 40, s);
    check('3: in 8 Stunden gehen genau 9 der 50-Minuten-Aufträge durch (20 -> 29)', s.solar === 29, s);
    check('3: die restlichen Aufträge stehen noch in der Warteschlange', s.offen === 11, s);
    // 4) Der neunte Auftrag wurde innerhalb des Fensters gestartet und läuft beim Zurückkommen
    // mit Teilfortschritt weiter - startTime liegt VOR jetzt. Fängt er bei 0 an, ist die
    // Rückdatierung kaputt und der Spieler verliert die angefangene Stunde.
    check('4: ein Auftrag läuft mit Teilfortschritt weiter (Start liegt in der Vergangenheit)',
      s.bezahltOffen === 1 && s.laufendStart[0] < Date.now() - 600000,
      { bezahltOffen:s.bezahltOffen, startVorSek: s.laufendStart[0] ? Math.round((Date.now()-s.laufendStart[0])/1000) : null });
    check('keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ---------------------------------------------------------------- Quelltext-Prüfungen
  const src = fs.readFileSync(SPIELDATEI, 'utf8');
  check('Q: die Simulation existiert genau einmal',
    (src.match(/function simulateOfflineQueues\(/g)||[]).length === 1);
  check('Q: sie wird aus applyOfflineProgress mit demselben Deckel aufgerufen',
    /const queues = simulateOfflineQueues\(capped\);/.test(src));
  // Der Deckel ist Bedingung, nicht Zierde: Die Aufträge werden aus Ressourcen bezahlt, die für
  // genau dieses Fenster gutgeschrieben wurden.
  // Bis 01.08.2026 stand hier das Literal 8*3600, und diese Prüfung hat genau darauf gezeigt. Seit
  // das Offline-Fenster mit dem Autonomiekern ausbaubar ist, kommt der Deckel aus
  // offlineWindowSec(). Die zu schützende Aussage ist dieselbe geblieben und sogar wichtiger
  // geworden: Gutschrift und Simulation müssen aus EINER Quelle kommen. Ein längeres Fenster nur
  // für die Warteschlange würde Aufträge aus Ressourcen bezahlen, die es nie gegeben hat.
  //
  // Geprüft wird deshalb die KETTE, nicht mehr eine Zahl: capped kommt aus offlineWindowSec(),
  // offlineWindowSec() ist Grundwert plus gedeckeltem Bonus, und der Bonus hängt an den wirklich
  // gebauten Stufen. Bräche irgendein Glied, stünden wieder zwei Fenster nebeneinander.
  check('Q: der Deckel kommt aus offlineWindowSec()',
    (src.match(/const capped = Math\.min\(seconds, offlineWindowSec\(\)\);/g)||[]).length === 1);
  check('Q: es gibt kein zweites, hart kodiertes Offline-Fenster mehr',
    !/Math\.min\(seconds,\s*\d+\*3600\)/.test(src));
  check('Q: offlineWindowSec ist Grundwert plus gedeckeltem Bonus',
    /function offlineWindowSec\(stufen\)\{ return OFFLINE_BASE_SEC \+ offlineWindowBonusSec\(stufen\); \}/.test(src)
    && /return Math\.min\(OFFLINE_BONUS_CAP_SEC, n \* OFFLINE_BONUS_PER_LEVEL_SEC\);/.test(src));
  check('Q: der Bonus zählt die wirklich gebauten Autonomiekern-Stufen',
    /allBuildingSets\(\)\.reduce\(\(a,b\)=>a\+\(b\.autonomiekern\|\|0\),0\)/.test(src));
  // Der Grundwert muss der sein, den die Verhaltensprüfungen oben unterstellen (dort wird mit
  // 8 Stunden gerechnet) - sonst prüfen die vier Fälle darüber still gegen ein anderes Fenster.
  const basis = Number((src.match(/const OFFLINE_BASE_SEC = (\d+)\*3600;/)||[])[1]);
  check('Q: der Grundwert ist der, mit dem die Verhaltensprüfungen rechnen', basis === 8, basis);
  check('Q: beide Schleifen haben einen Endlos-Schutz',
    /let schutz = 200;/.test(src) && /let schutz = 60;/.test(src));
  check('Q: die Zusammenfassung führt beide Zahlen mit',
    /bauten: queues\.bauten, forschungen: queues\.forschungen/.test(src));

  console.log('\n' + (fail ? 'FAIL' : 'PASS'));
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
