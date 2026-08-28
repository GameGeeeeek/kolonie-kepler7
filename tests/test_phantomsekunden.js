// Phantom-Sekunden (v8.459.0, Task #50): Tick-Gutschrift ist an den Uhr-Fortschritt gekoppelt.
//
// HINTERGRUND (Befund 08./09.08.2026): Jeder Tick-AUFRUF schrieb fix 1 s Produktion gut, die
// Uhr rueckte aber nur um min(tickJetzt, lastTick+1000) vor. Feuern gedrosselte Timer
// gebuendelt nach, entstehen Gutschriften OHNE Uhr-Fortschritt - test_kleine_luecken 1c mass
// unter Suite-Last 121-125% statt 100%.
//
// MESSAUFBAU (Regel 8: NUR Date.now anfassen; Regel 2/7: Rate MESSEN, grosses Lager, damit
// nicht der Deckel gemessen wird):
//   Phase A: Produktionsrate am laufenden Spiel messen (Zeitachse lastTick, nicht Wanduhr).
//   Phase B: Uhr EINFRIEREN, ~4 Sekunden real warten - die setInterval-Ticks feuern weiter,
//            sehen aber keinen Uhr-Fortschritt. Neu: nichts wird gutgeschrieben. Alt: jeder
//            dieser Aufrufe schrieb eine volle Phantom-Sekunde gut.
//   Phase C: Uhr wieder freigeben - die Produktion muss normal weiterlaufen (Regel 12:
//            der Fix darf keine Zeit verlieren, er erfindet nur keine mehr).
// Gemessen wird je Phase der Quotient gutgeschrieben / (rate * lastTick-Fortschritt).
//
// GEGENPROBE (Arbeitsregel 1, beim Einfuehren in beide Richtungen ausgefuehrt): am alten
// Stand (v8.458.0) faellt 2b durch - die eingefrorene Phase schreibt dort weiter gut,
// obwohl die Zeitachse stillsteht.
//
// NACHTRAG 22.08.2026 - DIE BEZUGSGROESSE WANDERT, UND 2c HAT SIE MITGEMESSEN.
// 2c hielt den Zuwachs der Auftau-Phase gegen eine Rate, die GANZ AM ANFANG gemessen wurde -
// rund 45 Sekunden vorher. Springt die Produktion dazwischen, ist der Quotient falsch, ohne
// dass am Messgegenstand etwas verkehrt waere. Gemessen im Suite-Lauf: 80,0 %, und
// 5,99 / 7,49 = 0,800 - die HAPPY HOUR war zwischen Phase A und Phase C zu Ende.
// Sie ist die zweite nicht pinnbare Ereignis-Uhr: Sie steht nicht im Spielstand, laeuft
// deterministisch 12:00-13:00 und 20:00-21:00 LOKALER Zeit (HAPPY_HOUR_WINDOWS) und
// multipliziert in ratesPerSecond genau die hier gemessene Erz-Rate. `currentHappyHour()`
// liest dafuer `new Date()` - das Einfrieren von `Date.now` in Phase B fasst sie nicht an.
//
// BEHOBEN WIE BEI test_kleine_luecken 1c, und aus demselben Grund NICHT durch eine weitere
// Schranke: Die Rate wird unmittelbar VOR und NACH dem Messfenster gemessen, 2c-vorab prueft
// ZUERST, ob sie sich gehalten hat, und bei nachgewiesener Wanderung wird das Messfenster
// WIEDERHOLT (hoechstens VERSUCHE Anlaeufe - eine Fenstergrenze trifft nur einen davon).
// Die Schranke von 2c bleibt unangetastet: Sie zu weiten waere nicht von "Test entschaerft"
// zu unterscheiden (Regel 26).
//
// BEIDE RICHTUNGEN GEMESSEN, an einer Kopie der Spieldatei, deren currentHappyHour() nach
// 30 Sekunden Laufzeit anspringt (KEPLER_SPIELDATEI) - der Anlassfall, deterministisch
// nachgestellt statt auf eine Fenstergrenze gewartet:
//   ALTER Stand: 2c faellt mit {"spanne":"25.6","anteil":"125.0 %"}.
//   NEUER Stand: Anlauf 1 meldet 25,0 % Abweichung und 125,0 % Anteil, Anlauf 2 steht bei
//                0,0 % und 100,0 % - gruen, und das Protokoll zeigt beide Anlaeufe.
//
// DIE GRENZE DIESER WACHE, gemessen und bewusst nicht weiter ausgebaut: Sie kennt die Rate an
// ZWEI Punkten. Ein Sprung, der dazwischen liegt UND wieder zuruecknimmt, entgeht ihr - an
// einer Kopie, die alle 20 Sekunden umschaltet, stand 2c-vorab bei 1,3 % (also gruen), waehrend
// 2c mit 124,0 % fiel. Fuer die echte Happy Hour ist das kein Fall: Sie springt an
// Stundengrenzen und flackert nicht, ueber ein 60-Sekunden-Fenster kann sie hoechstens EINMAL
// wechseln - und dann sind die zwei Messpunkte nachweislich verschieden. Eine Rate MITTEN in
// der Auftau-Phase laesst sich nicht messen: Dort steht die Uhr bzw. laeuft die Nachholung, die
// Rate ist per Konstruktion nicht konstant. Wer hier mehr will, braucht einen anderen
// Messaufbau, keine dritte Schranke.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// ---- statisch: die Kopplung existiert und sitzt an der richtigen Stelle
check('1a: die Gutschrift rechnet mit tickAnteil aus dem Uhr-Fortschritt',
  JS.includes('const tickAnteil = Math.max(0, (uhrDanach - uhrVorher) / 1000);') &&
  JS.includes('applySoftCappedGain(state.resources, r, rates[r] * tickAnteil, cap);') &&
  JS.includes('if (tickAnteil > 0) processTier2Factories(tickAnteil);'));
check('1b: die Uhr rueckt auf dieselbe Groesse vor (eine Formel, keine zwei)',
  JS.includes('const uhrDanach = Math.min(tickJetzt, uhrVorher + 1000);') &&
  JS.includes('state.lastTick = uhrDanach;'));

// Fixture wie in test_kleine_luecken (dort erprobt): kraeftige Produktion, riesiges Lager -
// der Lagerdeckel darf nicht die bindende Groesse sein (Regel 7). Der erste Anlauf dieses
// Tests nutzte ein eigenes Fixture und mass prompt rate=0.
const save = () => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:5000, erz:5000, kristalle:5000, deuterium:5000, antimaterie:100, forschungspunkte:100},
  buildings:{solar:30, mine:28, raffinerie:25, synth:20, labor:10, lager:5000, werft:10},
  research:{}, activeResearch:null, researchQueue:[], fleet:{missions:[]}, colonies:{},
  activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null},
  xp:1000, credits:1000, buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{},
  // Ereignis-Uhren in die Zukunft (gleiche Haertung wie test_listen_cache): der erste
  // Planeten-Ereignis-Check feuert sonst GARANTIERT und verschiebt die Messung.
  nextPlanetEventCheck: Date.now() + 3600000, nextTraderCheck: Date.now() + 3600000 });

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s2=200) => r.fulfill({status:s2, contentType:'application/json', body:JSON.stringify(o)});
  if (p === 'health') return j({ok:true});
  if (p === 'me') return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:false,tier:null}});
  if (p === 'reports') return j({reports:[]});
  if (p === 'pending-rewards/claim') return j({reward:null});
  if (p === 'storage-list') return j({keys:[]});
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()).value; } catch(e){} return j({ok:true,version:2}); }
    if (store[k] !== undefined) return j({key:k,value:store[k],version:1});
    return j({e:1},404);
  }
  return j([]);
};}

(async () => {
  const browser = await starteBrowser();
  const store = { 'kepler7-save-v3': save() };
  const ctx = await browser.newContext({ viewport:{width:1280,height:900} });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(2700);
  const lies = () => { try { return JSON.parse(store['kepler7-save-v3']); } catch(e){ return null; } };
  // Gespeichert wird alle 10 s (setInterval(save, 10000)) - jede Phase wartet deshalb laenger
  // als einen Autosave-Takt, sonst vergleicht lies() zweimal denselben alten Stand (genau so
  // fiel der erste Anlauf dieses Tests mit rateSpanne=0 durch). Der Autosave-Timer ist ein
  // ECHTER Timer und feuert auch bei eingefrorener Spiel-Uhr weiter - er schreibt also
  // verlaesslich den Stand der gefrorenen Phase.

  // Die Bezugsgroesse wird JE ANLAUF neu gemessen, vor und nach dem Messfenster.
  const messeRate = async () => {
    const v = lies(); await page.waitForTimeout(11500); const n = lies();
    const spanne = (n.lastTick - v.lastTick) / 1000;
    return { rate: spanne > 0 ? (n.resources.erz - v.resources.erz) / spanne : 0, spanne };
  };

  const VERSUCHE = 3;
  const protokoll = [];
  let letzte = null;
  for (let versuch = 1; versuch <= VERSUCHE; versuch++){
    // ---- Phase A: Rate messen (Zeitachse lastTick)
    const { rate, spanne: rateSpanne } = await messeRate();

    // ---- Phase B: Uhr einfrieren, Ticks feuern weiter
    await page.evaluate(() => { window.__dateEcht = Date.now; const fest = Date.now(); Date.now = () => fest; });
    // Der erste eingefrorene Tick bucht noch den Rest bis "fest"; danach ein Autosave-Takt,
    // damit b0 sicher ein Stand AUS der gefrorenen Phase ist.
    await page.waitForTimeout(11500);
    const b0 = lies(); const erzB0 = b0.resources.erz;
    await page.waitForTimeout(11000); // ~11 weitere Tick-AUFRUFE ohne Uhr-Fortschritt + 1 Autosave
    const b1 = lies();

    // ---- Phase C: Uhr freigeben. Die gefrorene Spanne ist REAL vergangene Zeit - sie liegt
    // ueber der Nachhol-Schwelle und wird am Stueck nachgeholt; zusammen mit dem normalen
    // Weiterlauf muss der Anteil wieder bei ~100% liegen (Regel 12: der Fix verliert keine
    // Zeit, er erfindet nur keine mehr - und die Nachholung wird hier gleich mitgeprueft).
    await page.evaluate(() => { if (window.__dateEcht) Date.now = window.__dateEcht; });
    await page.waitForTimeout(12500);
    const c1 = lies();

    // ---- Phase D: dieselbe Groesse noch einmal - hat sie sich ueber den ganzen Lauf gehalten?
    const { rate: rateNach } = await messeRate();

    const cSpanne = (c1.lastTick - b1.lastTick) / 1000;
    const cAnteil = (c1.resources.erz - b1.resources.erz) / (rate * cSpanne);
    const abweichung = rate > 0 ? Math.abs(rateNach - rate) / rate : 1;
    letzte = { rate, rateNach, abweichung, rateSpanne, erzB0, b0, b1, cSpanne, cAnteil };
    protokoll.push({ versuch, vor: rate.toFixed(2), nach: rateNach.toFixed(2),
                     abweichung: (abweichung*100).toFixed(1)+' %', anteil: (cAnteil*100).toFixed(1)+' %' });
    if (abweichung < 0.03) break;   // Bezugsgroesse steht - dieser Anlauf zaehlt
  }

  check('2a: die Rate ist messbar und positiv', letzte.rate > 0 && letzte.rateSpanne >= 5,
    { rate: letzte.rate.toFixed(2), s: letzte.rateSpanne });
  check('2b: bei stehender Uhr wird NICHTS gutgeschrieben (keine Phantom-Sekunden)',
    Math.abs(letzte.b1.resources.erz - letzte.erzB0) < letzte.rate * 0.75
    && Math.abs(letzte.b1.lastTick - letzte.b0.lastTick) < 1100,
    { zuwachs: (letzte.b1.resources.erz - letzte.erzB0).toFixed(2), proSek: letzte.rate.toFixed(2),
      uhr: letzte.b1.lastTick - letzte.b0.lastTick });
  // Faellt diese Zeile, ist die BEZUGSGROESSE gewandert - nicht die Nachholung schuld. Genau
  // dieser Unterschied hat bei test_kleine_luecken einmal Tage gekostet (Regel 20/21).
  check('2c-vorab: die Produktionsrate haelt sich ueber den ganzen Lauf (sonst misst 2c sie mit)',
    letzte.abweichung < 0.03, { anlaeufe: protokoll.length, protokoll });
  check('2c: Auftauen holt die reale Zeit nach und laeuft normal weiter (Anteil nahe 100%)',
    letzte.cSpanne >= 15 && letzte.cAnteil > 0.85 && letzte.cAnteil < 1.15,
    { spanne: letzte.cSpanne.toFixed(1), anteil: (letzte.cAnteil * 100).toFixed(1) + ' %',
      anlaeufe: protokoll.length });

  check('3: keine JS-Fehler', errs.length === 0, errs.slice(0, 3));
  await browser.close();
  ende();
})().catch(e => { console.error(e); process.exit(1); });
