// Ein eingefrorenes Gerät verliert seine Zeit nicht mehr (05.08.2026).
//
// BEFUND, gemessen: Schläft ein Gerät mit offenem Spiel, frieren die Timer ein. Beim Aufwachen
// laufen sie weiter - aber der Haupt-Tick rechnet in FESTEN Ein-Sekunden-Schritten und holt die
// Lücke nicht nach. Nachgeholt wurde ausschließlich beim Seitenstart (applyOfflineProgress).
// Schlimmer: `doSave()` stempelte `state.lastTick` auf jetzt, und gespeichert wird alle 10
// Sekunden. Beim Aufwachen war die Nacht damit binnen Sekunden aus dem Spielstand gelöscht, ohne
// je gutgeschrieben worden zu sein.
// Ein Lauf mit acht Stunden Uhrsprung ohne Ticks ergab: 339 Erz statt der erwarteten 163.386 -
// also 0,2 %. Der Rest war ersatzlos weg.
//
// URSACHE: Trotz seines Namens war `lastTick` nie ein Tick-Zeitstempel, sondern ein
// SPEICHER-Zeitstempel - genau eine Stelle schrieb ihn (doSave), genau eine las ihn (load).
//
// WIE HIER EIN EINGEFRORENER TAB NACHGESTELLT WIRD: Das Spiel rechnet ausschließlich mit
// Date.now(). Verschiebt man NUR Date.now() um Stunden nach vorn, ist aus Sicht des Spiels die
// Zeit vergangen, während real nur ein paar Ticks gelaufen sind - genau das Modell "Tab war
// eingefroren". Bewusst NICHT die Uhr-Hilfen des Browsertreibers: die feuern die versäumten Timer
// nach und würden das Spiel künstlich heilen.
//
// GEPRÜFT WIRD:
//   1. Die Lücke wird gutgeschrieben, ohne dass die Seite neu geladen werden muss.
//   2. DIE DOPPELGUTSCHRIFT-FALLE: Ein zweiter Durchlauf ohne neuen Zeitsprung darf NICHTS mehr
//      geben. Genau dieser Fehler ist dem Projekt am 21.07.2026 schon einmal passiert.
//   3. Normale Sekunden lösen keine Nachholung aus - sonst käme mitten im Spiel ständig eine
//      "Ruhezustand"-Meldung.
const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// Kräftige Produktion, damit acht Stunden einen klar messbaren Unterschied ergeben.
const save = () => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:5000, erz:5000, kristalle:5000, deuterium:5000, antimaterie:100, forschungspunkte:100},
  // Lager BEWUSST riesig: Im ersten Anlauf stand hier lager:60, das ergibt einen Deckel von
  // 24.800 - und genau dort landete der Endstand. Gemessen wurde damit der Lagerdeckel, nicht die
  // Nachholung, und jeder weitere Zeitsprung ergab zwangslaeufig 0. Der Deckel darf hier nicht die
  // bindende Groesse sein.
  buildings:{solar:30, mine:28, raffinerie:25, synth:20, labor:10, lager:5000, werft:10},
  research:{}, activeResearch:null, researchQueue:[], fleet:{missions:[]}, colonies:{},
  activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null},
  // Ereignis-Uhren in die FERNE Zukunft pinnen (Arbeitsregel 18: bei 0 feuert der erste
  // Planeten-Ereignis-Check GARANTIERT). Ohne die Pinnung feuerte beim 8-Stunden-Sprung eine
  // Meldungs-Salve (Planeten-Ereignis, Haendler, Raid ...), und weil der Toast-Stapel nur drei
  // Meldungen haelt, verdraengte sie je nach Salvengroesse genau die gepruefte Ruhezustand-Zeile -
  // der Test war einzeln gruen und in der Suite rot (17.08.2026). Das Spiel schuetzt die Zeile
  // seither zusaetzlich per toast-wichtig (tests/test_toast_verdraengung.js); die Pinnung bleibt
  // trotzdem, damit dieser Test die NACHHOLUNG misst und nicht die Toast-Konkurrenz.
  nextPlanetEventCheck: Date.now() + 365*24*3600*1000, lastEventTime: Date.now(),
  nextTraderCheck: Date.now() + 365*24*3600*1000, nextRaidTime: Date.now() + 365*24*3600*1000,
  nextFactionGift: Date.now() + 365*24*3600*1000,
  xp:1000, credits:1000, buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

// Der gespeicherte Stand ist die Wahrheit - state liegt nicht auf window.
function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:false,tier:null}});
  if(p==='reports')return j({reports:[]});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p==='storage-list')return j({keys:[]});
  if(p.startsWith('storage/')){
    const k=decodeURIComponent(p.slice(8));
    if(req.method()==='PUT'){ try { store[k] = JSON.parse(req.postData()).value; } catch(e){} return j({ok:true,version:2}); }
    if(store[k]!==undefined)return j({key:k,value:store[k],version:1});
    return j({e:1},404);
  }
  return j([]);
};}

// Verschiebt die Uhr der SEITE, ohne dass Timer nachfeuern.
// ERSTER ANLAUF WAR KAPUTT: Ein Proxy um Date, dessen get-Falle fuer 'now' auf `Date.now`
// zurueckgriff - und `Date` war da bereits der Proxy selbst. Ergebnis: unendliche Rekursion,
// "Maximum call stack size exceeded", und der Test mass gar nichts mehr (die Doppelgutschrift-
// Pruefung war dadurch sogar scheinbar gruen, weil nie etwas gutgeschrieben wurde).
// Es braucht den Proxy gar nicht: Das Spiel rechnet mit Date.now(), und die eine Funktion laesst
// sich direkt ersetzen.
const UHR_VORSTELLEN = (stunden) => {
  window.__versatz = (window.__versatz || 0) + stunden*3600*1000;
  if (!window.__uhrGepatcht){
    window.__uhrGepatcht = true;
    const echt = Date.now.bind(Date);
    Date.now = function(){ return echt() + (window.__versatz || 0); };
  }
};

(async () => {
  const browser = await starteBrowser();
  const store = { 'kepler7-save-v3': save() };
  const ctx = await browser.newContext({ viewport:{width:1280,height:900} });
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  // WO DIE MELDUNG WIRKLICH ZU FINDEN IST - zwei Fehlversuche vorweg, weil sie lehrreich sind:
  // (1) #log direkt auslesen: Das Element zeigt immer nur die JEWEILS LETZTE Meldung.
  // (2) MutationObserver bzw. Abtasten von #log: Beides sah die Nachhol-Meldung nicht. Grund ist
  //     nicht die Beobachtung, sondern der Ablauf - applyOfflineProgress laeuft SYNCHRON im
  //     selben Tick, und unmittelbar danach schreibt ein Planeten-Ereignis dieselbe Zeile
  //     wieder um. Zwischen beidem liegen Millisekunden; kein Abtasten der Welt erwischt das.
  // Die TOASTS bleiben dagegen mehrere Sekunden stehen (pushToast, ~4,2 s, bis zu drei gleichzeitig).
  // Dort ist die Meldung sicher zu sehen.
  await page.addInitScript(() => {
    window.__meldungen = [];
    let zuletzt = '';
    setInterval(() => {
      const c = document.getElementById('toastContainer');
      if (!c) return;
      const t = (c.textContent || '').trim();
      if (t && t !== zuletzt){ zuletzt = t; window.__meldungen.push(t); }
    }, 120);
  });
  await page.goto(SPIEL_URL); await page.waitForTimeout(4500);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(i=>{const o=document.getElementById(i); if(o)o.style.display='none';}));
  await page.waitForTimeout(2000);

  const lies = async () => { try { return JSON.parse(store['kepler7-save-v3']); } catch(e){ return null; } };
  const vorher = await lies();
  check('Ausgangsstand gelesen', !!vorher && typeof vorher.resources.erz === 'number', vorher && vorher.resources.erz);

  // ---- 3) ZUERST die Gegenprobe: normale Sekunden loesen KEINE Nachholung aus.
  // Zuerst, weil sie zeigt, dass die Messung ueberhaupt zwischen "normal" und "Luecke" trennt.
  {
    await page.waitForTimeout(4000);
    const s = await lies();
    const zuwachsNormal = s.resources.erz - vorher.resources.erz;
    const alle = await page.evaluate(() => (window.__meldungen||[]).join(' | '));
    check('3: im normalen Betrieb kommt keine Ruhezustand-Meldung', !/Ruhezustand|nachgetragen/.test(alle), alle.slice(0,120));
    check('3: und der Zuwachs bleibt im Rahmen weniger Sekunden',
      zuwachsNormal >= 0 && zuwachsNormal < 2000, { zuwachsNormal });
  }

  const vorSprung = await lies();

  // ---- 1) Acht Stunden Uhrsprung OHNE dass Ticks gelaufen waeren
  await page.evaluate(UHR_VORSTELLEN, 8);
  await page.waitForTimeout(5000);   // ein paar echte Ticks, damit die Luecke bemerkt wird
  const nachSprung = await lies();
  const gutgeschrieben = nachSprung.resources.erz - vorSprung.resources.erz;

  // Was waere ohne Deckel zu erwarten? Der Deckel (offlineWindowSec, Standard 8 h) und die
  // Lagerkapazitaet begrenzen das - deshalb wird nicht auf eine exakte Zahl geprueft, sondern
  // darauf, dass ueberhaupt SUBSTANTIELL gutgeschrieben wurde. Vor der Behebung waren es 0,2 %.
  check('1: die Luecke wird ohne Neuladen gutgeschrieben', gutgeschrieben > 20000,
    { gutgeschrieben, vorher: vorSprung.resources.erz, nachher: nachSprung.resources.erz });
  const alleMeldungen = await page.evaluate(() => (window.__meldungen||[]).join(' | '));
  // Im Fehlschlag ALLE mitgeschnittenen Meldungen ausgeben (Arbeitsregel 37): "(nicht gefunden)"
  // allein liess am 17.08.2026 offen, WAS stattdessen zu sehen war - die Ursache (Toast-Salve
  // verdraengt die Zeile) musste erst von Hand gesucht werden.
  check('1: und das Spiel sagt, was passiert ist', /Ruhezustand|nachgetragen/.test(alleMeldungen),
    (alleMeldungen.match(/[^|]*(Ruhezustand|nachgetragen)[^|]*/)||['(nicht gefunden) gesehen: '+alleMeldungen.slice(0,300)])[0].trim().slice(0,340));
  // Kein "Willkommen zurueck"-Fenster mitten im Spiel.
  const fenster = await page.evaluate(() => {
    const o = document.getElementById('welcomeBackOverlay');
    return !!(o && o.offsetParent !== null);
  });
  check('1: aber KEIN "Willkommen zurück"-Fenster mitten im Spiel', fenster === false);

  // ---- 2) DIE DOPPELGUTSCHRIFT-FALLE
  // Ohne neuen Zeitsprung darf ein weiterer Durchlauf nichts Nennenswertes mehr geben.
  {
    const a = await lies();
    await page.waitForTimeout(6000);
    const b = await lies();
    const nochmal = b.resources.erz - a.resources.erz;
    check('2: ein zweiter Durchlauf ohne neuen Zeitsprung gibt NICHTS mehr',
      nochmal < 3000,
      { nochmal, hinweis:'Nur die paar reguläre Sekunden - keine zweite Offline-Gutschrift.' });
  }

  // ---- 2b) Und nach einem NEUEN Sprung wieder schon.
  {
    const a = await lies();
    await page.evaluate(UHR_VORSTELLEN, 3);
    await page.waitForTimeout(5000);
    const b = await lies();
    check('2: ein NEUER Zeitsprung wird wieder gutgeschrieben', (b.resources.erz - a.resources.erz) > 10000,
      { zuwachs: b.resources.erz - a.resources.erz });
  }

  check('keine JS-Fehler', errs.length === 0, errs.slice(0,3));
  await ctx.close(); await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
