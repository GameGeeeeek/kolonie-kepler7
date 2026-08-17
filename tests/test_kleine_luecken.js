// Kleine Luecken gehen nicht mehr verloren (05.08.2026).
//
// VORGESCHICHTE: Am selben Tag wurde behoben, dass ein eingefrorenes Geraet seine Zeit verliert
// (tests/test_wachauf_nachholen.js). Der erste Anlauf holte aber NUR Luecken ab 90 Sekunden nach
// und schrieb darunter bedingungslos `state.lastTick = Date.now()` - warf also alles darunter weg.
// Das war derselbe Fehler noch einmal, nur kleiner und viel haeufiger:
//
// Ein Browser drosselt einen laenger verborgenen Tab auf EINE Timer-Weckung je Minute. Die Luecke
// betrug damit dauerhaft rund 60 Sekunden - stabil UNTER der Schwelle. Verbucht wurde die eine
// Sekunde des Ticks, die uebrigen 59 verschwanden mit dem Zeitstempel. Gemessen: rund 1,5 %.
// Wer das Spiel offen liegen liess, stand damit deutlich SCHLECHTER da als jemand, der es schliesst -
// denn beim naechsten Laden holt applyOfflineProgress das volle Offline-Fenster nach.
//
// DIE BEHEBUNG hat zwei Teile, und dieser Test prueft beide:
//   (a) Unterhalb der Schwelle rueckt die Uhr um GENAU die eine Sekunde vor, die der Tick verbucht.
//       Der Rest bleibt stehen, sammelt sich an und wird nachgeholt, sobald er die Schwelle reisst.
//   (b) Die Meldung haengt an einer EIGENEN, groesseren Schwelle. Sonst stuende nach einer Nacht im
//       Hintergrund im Minutentakt dieselbe Zeile im Protokoll.
//
// WIE HIER GEMESSEN WIRD: wie im Schwestertest - nur Date.now() vorstellen, nie die Uhr-Hilfen des
// Treibers. Die feuern versaeumte Timer nach und wuerden das Spiel kuenstlich heilen.
const fs = require('fs');
const path = require('path');
const { starteBrowser, SPIEL_URL, SPIELDATEI } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// ---- 0) VIER EINZEILIGE SPERREN, deren ganzes Risiko darin besteht, spaeter wieder zu verschwinden.
// applyOfflineProgress lief bis zum 05.08.2026 ausschliesslich beim Seitenstart. Seit der Tick sie
// auch im laufenden Spiel ruft, sind vier Stellen darin zweideutig geworden - jede hier mit der
// REGEL geprueft, nicht mit einem Textschnipsel, damit ein Umformulieren den Test nicht bricht.
{
  const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
  const von = JS.indexOf('function applyOfflineProgress(');
  const fn = JS.slice(von, JS.indexOf('\n  function ', von + 50));
  check('0: applyOfflineProgress gefunden', von > 0 && fn.length > 1000, { laenge: fn.length });

  // (a) Die Zusammenfassung fuers "Willkommen zurueck"-Fenster gehoert dem Seitenstart. Loescht der
  //     Tick sie bedingungslos, kann sie zwischen load() und dem Fenster verschwinden.
  check('0a: lastOfflineSummary wird nur beim Seitenstart geleert, nicht vom laufenden Tick',
    /if\s*\(!imLauf\)\s*lastOfflineSummary\s*=\s*null/.test(fn),
    { gefunden: (fn.match(/lastOfflineSummary\s*=\s*null[^;]*/)||['(keine Zuweisung)'])[0] });

  // (b) Der Rueckkehrer-Boost sind SECHS multiplikative Buffs - ein zweiter Satz waere x2,25 statt
  //     der vorgesehenen +50 %.
  check('0b: der Rückkehrer-Boost hat eine Dopplungssperre',
    /returning-player/.test(fn) && /some\(/.test(fn) &&
    /RETURNING_PLAYER_THRESHOLD_SEC\s*&&\s*!/.test(fn));

  // (c) "Willkommen zurück" ist genau die Formulierung, wegen der es das imLauf-Flag gibt. Sie stand
  //     trotzdem in der Boost-Zeile - mitten im Spiel, direkt ueber der Ruhezustands-Meldung.
  // ERSTER ANLAUF WAR VACUOUS, deshalb hier ausdruecklich: Der Ausschnitt lief urspruenglich von
  // 'returningBoostGranted)' bis 'MELDUNG_IM_LAUF_AB_SEK'. Fehlt die zweite Marke - genau der Fall
  // in der ALTEN Fassung, gegen die der Test anschlagen soll -, liefert indexOf -1, und
  // slice(x, -1) laeuft bis kurz vors Ende der Funktion. In diesem viel zu grossen Ausschnitt stand
  // 'imLauf' natuerlich irgendwo, und die Pruefung war gruen, obwohl die Sperre fehlte.
  // Jetzt wird am Begruessungstext selbst verankert: Die 200 Zeichen davor muessen ihn als Zweig
  // einer Bedingung auf imLauf ausweisen.
  // `lastIndexOf` statt `indexOf`, weil ein KOMMENTAR ueber der Stelle denselben Text zitieren
  // koennte - genau das passierte im zweiten Anlauf, und der Test schlug dann auf gesundem Code an.
  {
    const gruss = 'Willkommen zurück! Du warst über 24 Stunden weg';
    const at = fn.lastIndexOf(gruss);
    const davor = at > 0 ? fn.slice(Math.max(0, at-200), at) : '';
    check('0c: die Rückkehrer-Meldung begrüßt nicht mitten im Spiel',
      at > 0 && /imLauf/.test(davor) && davor.includes('?'),
      { davor: davor.slice(-90) });
  }

  // (d) Happy Hour in der Nachholung: erlaubt, aber NUR wenn die ganze Luecke im laufenden Fenster
  //     liegt. Ohne diese Einschraenkung bekaeme eine achtstuendige Luecke den Bonus dafuer, dass
  //     jetzt gerade zufaellig eine Happy Hour laeuft.
  check('0d: Happy Hour gilt in der Nachholung nur bei ganz im Fenster liegender Lücke',
    /if\s*\(imLauf\)/.test(fn) && /hh\.startedAt/.test(fn) && /capped\*1000/.test(fn) &&
    /noHappyHour:\s*!happyHourGilt/.test(fn));

  // (e) Dieselbe Sperre fuer die Comeback-Kette. Sie liegt AUSSERHALB von applyOfflineProgress und
  //     war deshalb beim ersten Durchgang uebersehen worden - dieselbe Begruessung an jemanden, der
  //     nie weg war, nur aus einer anderen Funktion.
  {
    const cq = JS.slice(JS.indexOf('function startComebackQuest('),
                        JS.indexOf('function grantComebackReward('));
    const gruss = 'Willkommen zurück, Kommandant';
    const at = cq.lastIndexOf(gruss);
    const davor = at > 0 ? cq.slice(Math.max(0, at-200), at) : '';
    check('0e: auch die Comeback-Kette begrüßt nicht mitten im Spiel',
      at > 0 && /imLauf/.test(davor) && davor.includes('?') &&
      /startComebackQuest\(imLauf\)/.test(JS),
      { durchgereicht: /startComebackQuest\(imLauf\)/.test(JS) });
  }
}

// Kraeftige Produktion, riesiges Lager - der Lagerdeckel darf nicht die bindende Groesse sein,
// sonst misst der Test ihn statt der Nachholung (Fehler aus dem Schwestertest, dort dokumentiert).
const save = () => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:5000, erz:5000, kristalle:5000, deuterium:5000, antimaterie:100, forschungspunkte:100},
  buildings:{solar:30, mine:28, raffinerie:25, synth:20, labor:10, lager:5000, werft:10},
  research:{}, activeResearch:null, researchQueue:[], fleet:{missions:[]}, colonies:{},
  activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null},
  xp:1000, credits:1000, buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{},
  // EREIGNIS-UHREN PINNEN (Arbeitsregel 18) - ohne das misst dieser Test den Zufall mit.
  // maybeSpawnPlanetEvent() prueft `now < nextPlanetEventCheck`; die Vorgabe ist 0, der erste
  // Check feuert also GARANTIERT und legt ein ZUFAELLIGES Ereignis auf die Heimatwelt, das die
  // Produktion fuer seine Laufzeit multipliziert (prodAll/res, gute UND schlechte). Der Test
  // stellt die Uhr um ueber 800 Spielsekunden vor - das Ereignis laeuft also mitten im Lauf ab
  // und die Produktion aendert sich genau einmal. Gemessen (vier Laeufe): die Rate war INNERHALB
  // eines Laufs exakt konstant, unterschied sich aber ZWISCHEN den Laeufen (6,05 / 7,57 / 8,70 /
  // 10,59 Erz/s), und der gemeldete Anteil folgte exakt dem Verhaeltnis Rate-Ende/Rate-Anfang:
  // 0,870 -> 87,0 %, 1,000 -> 100,0 %, 1,250 -> 121,5 %. Nicht die Gutschrift schwankte, sondern
  // die Bezugsgroesse. Der naechste Check liegt danach 2-4 h entfernt, ein Tag Vorlauf reicht also.
  nextPlanetEventCheck: Date.now() + 24*3600*1000,
  nextTraderCheck: Date.now() + 24*3600*1000 });

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

// Verschiebt die Uhr der SEITE um SEKUNDEN, ohne dass Timer nachfeuern.
const UHR_VOR = (sek) => {
  window.__versatz = (window.__versatz || 0) + sek*1000;
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
  // Meldungen ueber die Toasts einsammeln - #log zeigt immer nur die letzte Zeile, und ein
  // Planeten-Ereignis ueberschreibt die Nachhol-Zeile noch im selben Tick (im Schwestertest
  // ausfuehrlich dokumentiert).
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

  const lies = () => { try { return JSON.parse(store['kepler7-save-v3']); } catch(e){ return null; } };

  // DIE PRODUKTIONSRATE WIRD GEMESSEN, NICHT GERATEN - und zwar am laufenden Spiel.
  // `ratesPerSecond()` waere die direkte Quelle, steht aber nicht auf window: das ganze Spiel liegt
  // in einer Kapsel, page.evaluate kommt nicht heran (erster Anlauf: "ratesPerSecond is not
  // defined"). Also aus zwei gespeicherten Staenden ableiten. Als Zeitachse dient `lastTick` aus
  // dem Spielstand selbst und nicht die Wanduhr des Tests - damit misst der Quotient genau das,
  // was das Spiel als "eine Sekunde" verbucht hat.
  const messeRate = async (ms = 12000) => {
    const a = lies();
    await page.waitForTimeout(ms);              // sicher ueber einen Autosave hinweg
    const b = lies();
    const sek = (b.lastTick - a.lastTick) / 1000;
    return { rate: sek > 0 ? (b.resources.erz - a.resources.erz) / sek : 0, sek };
  };
  const { rate, sek: rateSek } = await messeRate();
  check('Erz-Rate am laufenden Spiel gemessen', rate > 1 && rateSek > 5, { rate: rate.toFixed(1), sek: rateSek });

  // ---- 1) DER GEDROSSELTE HINTERGRUND-TAB
  // Zehnmal je 60 Sekunden Luecke = 10 Minuten. Genau das Muster, das der Browser erzeugt.
  const vorher = lies();
  const RUNDEN = 10, LUECKE_SEK = 60;
  for (let i = 0; i < RUNDEN; i++){
    await page.evaluate(UHR_VOR, LUECKE_SEK);
    await page.waitForTimeout(1400);   // ein bis zwei echte Ticks, wie beim gedrosselten Tab
  }
  await page.waitForTimeout(2500);     // Autosave abwarten
  const nachher = lies();
  const bekommen = nachher.resources.erz - vorher.resources.erz;
  // Zeitachse ist `lastTick` aus dem Spielstand, NICHT die Wanduhr des Tests: Sonst blieben die
  // echten Sekunden zwischen den Spruengen unberuecksichtigt, und der Quotient laege systematisch
  // ueber 100 % - womit die Obergrenze unten nichts mehr aussagen wuerde.
  const spielzeit = (nachher.lastTick - vorher.lastTick) / 1000;
  const anteil = bekommen / (rate * spielzeit);
  // Vor der Behebung waren es 1,5 % - der Abstand zur Untergrenze ist riesig.
  check('1: der gedrosselte Hintergrund-Tab bekommt seine Zeit (vorher: 1,5 %)',
    anteil > 0.9, { bekommen: Math.round(bekommen), spielzeit: Math.round(spielzeit), anteil: (anteil*100).toFixed(1)+' %' });

  // ---- 1b) DIE ANSAMMLUNG - der eigentliche Kern der Behebung
  // Pruefung 1 ist streng genommen kein Beweis fuer die Ansammlung: 60 s reissen die Schwelle
  // sofort, es laeuft also jedes Mal direkt die grosse Nachholung. Hier sind die Spruenge
  // ABSICHTLICH kleiner als die Schwelle (10 s), einzeln loesen sie also NIE eine Nachholung aus.
  // Trotzdem muss am Ende die Zeit da sein - genau das leistet die stehen gebliebene Restschuld:
  // sie waechst, bis sie die Schwelle reisst, und wird dann am Stueck nachgeholt.
  // Vorher war jeder einzelne dieser Spruenge ersatzlos weg.
  {
    const a = lies();
    const KLEIN_RUNDEN = 8, KLEIN_SEK = 5;
    for (let i = 0; i < KLEIN_RUNDEN; i++){
      await page.evaluate(UHR_VOR, KLEIN_SEK);
      await page.waitForTimeout(1300);
    }
    await page.waitForTimeout(2500);
    const b = lies();
    // Erwartet: die gesprungene Zeit PLUS die real vergangene Zeit dazwischen. Als Zeitachse dient
    // wieder lastTick aus dem Spielstand, damit beides zusammen sauber erfasst ist.
    const spielzeit = (b.lastTick - a.lastTick) / 1000;
    const bekommen = b.resources.erz - a.resources.erz;
    const anteil = bekommen / (rate * spielzeit);
    check('1b: auch Luecken UNTER der Schwelle sammeln sich an und werden nachgeholt',
      anteil > 0.85, { bekommen: Math.round(bekommen), spielzeit: Math.round(spielzeit),
                       anteil: (anteil*100).toFixed(1)+' %' });
  }

  // ---- 1c) DIE ANDERE RICHTUNG: es darf auch nicht ZU VIEL sein
  // Der Tick verbucht unten ohnehin seine eine regulaere Sekunde; die laesst sich vom Nachhol-Zweig
  // aus nicht ueberspringen. Bekaeme die Nachholung die volle Luecke, waeren es 61 gutgeschriebene
  // Sekunden fuer 60 vergangene - bei einem gedrosselten Tab eine dauerhafte Ueberzahlung und damit
  // das Spiegelbild des Fehlers, den dieser Umbau gerade beseitigt. Die Nachholung deckt deshalb
  // `luecke - 1` ab.
  // ABSICHTLICH VIELE KLEINE SPRUENGE knapp ueber der Schwelle: Der Fehler betraegt eine Sekunde je
  // Nachholung, faellt also bei kurzen Luecken am staerksten ins Gewicht. Bei den 60er-Spruengen aus
  // Pruefung 1 waeren es nur ~1,7 % und damit im Messrauschen; hier sind es rund 8 %.
  // DIE BEZUGSGROESSE WIRD HIER NEU GEMESSEN, unmittelbar vor und nach dem Messfenster - und die
  // Prueffrage lautet zuerst: hat sich die Produktion ueberhaupt gehalten? Diese Schranke ist mit
  // 5 % die engste des Tests; sie ist damit die einzige, bei der eine still verschobene
  // Produktionsrate als "zu viel gutgeschrieben" durchschlaegt. Genau so ist der Test frueher in
  // Serie umgefallen (siehe Fixture-Kommentar): gegen eine EINMAL am Anfang gemessene Rate
  // verglichen, waehrend ein zufaelliges Planeten-Ereignis sie mittendrin veraendert hatte.
  // Faellt 1c-vorab, weiss man sofort, dass die BEZUGSGROESSE gewandert ist und nicht die
  // Nachholung schuld ist - der Unterschied, der beim ersten Mal Tage gekostet hat.
  /* NACHTRAG 17.08.2026 - die ZWEITE nicht gepinnte Ereignis-Uhr: die HAPPY HOUR.
     Der Fixture-Kommentar oben pinnt Planeten-Ereignis und Haendler; die Happy Hour blieb offen,
     weil sie nicht im Spielstand steht. Sie laeuft deterministisch 12:00-13:00 und 20:00-21:00
     LOKALER Zeit (HAPPY_HOUR_WINDOWS) und multipliziert in ratesPerSecond genau die hier
     gemessene Erz-Rate (Typ 'bergbau' +40% Erz/Kristalle, Typ 'alle' +25% auf alles).
     `currentHappyHour()` liest dafuer `new Date()` - der UHR_VOR-Patch fasst nur `Date.now()` an
     und kann sie deshalb nicht wegschieben.
     GEMESSEN am 17.08.2026: In einem Suite-Lauf ueber die 20:00-Grenze meldete 1c-vorab
     `{"vor":"4.72","nach":"5.55","abweichung":"17.6 %"}` und 1c daraufhin 114,1 %. Zwei Minuten
     spaeter, MITTEN im Fenster gefahren, stand die Rate zweimal stabil auf exakt 5,55 (0,0 %) -
     5,55 ist also die Rate MIT, 4,72 die ohne Happy Hour, und der Sprung lag exakt auf der
     Fenstergrenze. Kein Spielfehler, keine Regression: eine gewanderte BEZUGSGROESSE, genau der
     Fall, fuer den 1c-vorab gebaut wurde (Regel 20/21).
     WARUM WIEDERHOLEN STATT SCHRANKE LOCKERN (Regel 26 - nicht nachbessern, bis es gruen ist):
     Die 5-%-Schranke von 1c ist die einzige Stelle, an der eine echte Ueberzahlung auffaellt; sie
     zu weiten wuerde genau die Aussage wegnehmen, wegen der es den Test gibt. Stattdessen wird
     das Messfenster WIEDERHOLT, wenn die Bezugsgroesse nachweislich gewandert ist - bei stabiler
     Rate prueft 1c unveraendert scharf. Erst wenn sie auch nach VERSUCHE Anlaeufen nicht steht,
     ist es ein Fehlschlag, und der nennt dann alle gemessenen Raten. Eine Fenstergrenze trifft
     hoechstens einen Anlauf; zwei Anlaeufe hintereinander koennen nicht beide darauf fallen. */
  {
    const VERSUCHE = 3, N = 15, SPRUNG = 12;   // SPRUNG knapp ueber der Schwelle (10 s)
    const protokoll = [];
    let letzte = null;
    for (let versuch = 1; versuch <= VERSUCHE; versuch++){
      const { rate: rateVor } = await messeRate();
      const a = lies();
      for (let i = 0; i < N; i++){
        await page.evaluate(UHR_VOR, SPRUNG);
        await page.waitForTimeout(1300);
      }
      await page.waitForTimeout(2500);
      const b = lies();
      const { rate: rateNach } = await messeRate();
      const spielzeit = (b.lastTick - a.lastTick) / 1000;
      const anteil = (b.resources.erz - a.resources.erz) / (rateVor * spielzeit);
      const abweichung = rateVor > 0 ? Math.abs(rateNach - rateVor) / rateVor : 1;
      letzte = { rateVor, rateNach, abweichung, anteil, spielzeit };
      protokoll.push({ versuch, vor: rateVor.toFixed(2), nach: rateNach.toFixed(2),
                       abweichung: (abweichung*100).toFixed(1)+' %', anteil: (anteil*100).toFixed(1)+' %' });
      if (abweichung < 0.02) break;   // Bezugsgroesse steht - dieser Anlauf zaehlt
    }
    check('1c-vorab: die Produktionsrate haelt sich ueber das Messfenster (sonst misst 1c sie mit)',
      letzte.abweichung < 0.02, { anlaeufe: protokoll.length, protokoll });
    check('1c: und nicht mehr, als Zeit vergangen ist (keine Sekunde je Nachholung obendrauf)',
      letzte.anteil < 1.05, { nachholungen: N, spielzeit: Math.round(letzte.spielzeit),
                              anteil: (letzte.anteil*100).toFixed(1)+' %', anlaeufe: protokoll.length });
  }

  // ---- 2) DIE MELDUNGSFLUT
  // Zehn Nachholungen a 60 s duerfen NICHT zehn Protokollzeilen ergeben - im Hintergrund liefe das
  // die ganze Nacht und haette alles andere aus dem Protokoll verdraengt.
  {
    const alle = await page.evaluate(() => (window.__meldungen||[]).join(' | '));
    const treffer = (alle.match(/Ruhezustand|nachgetragen/g) || []).length;
    check('2: die Nachholung meldet sich bei kurzen Luecken NICHT bei jeder Runde',
      treffer === 0, { treffer, runden: RUNDEN });
  }

  // ---- 3) GEGENPROBE ZU 2: bei einer LANGEN Luecke meldet sie sich sehr wohl.
  // Ohne diese Pruefung waere 2 auch dann gruen, wenn die Meldung ganz verschwunden waere.
  {
    await page.evaluate(UHR_VOR, 20*60);
    await page.waitForTimeout(3000);
    const alle = await page.evaluate(() => (window.__meldungen||[]).join(' | '));
    check('3: bei einer langen Luecke meldet sie sich sehr wohl',
      /Ruhezustand|nachgetragen/.test(alle),
      (alle.match(/[^|]*(Ruhezustand|nachgetragen)[^|]*/)||['(nicht gefunden)'])[0].trim().slice(0,140));
  }

  // ---- 4) DIE UHR LAEUFT NICHT DAVON
  // Im Normalbetrieb darf der Zeitstempel weder zurueckfallen noch in die Zukunft wandern - sonst
  // baute sich still eine Schuld auf, die spaeter als "Offline" gutgeschrieben wuerde.
  {
    await page.waitForTimeout(5000);
    const abstand = await page.evaluate(() => Date.now() - (JSON.parse(localStorage.getItem('kepler7-save-v3')||'{}').lastTick || 0));
    // localStorage kann leer sein, wenn nur ueber das Backend gespeichert wird - dann ueber den Server.
    const s = lies();
    const echterAbstand = (abstand > 0 && abstand < 1e12) ? abstand : null;
    const serverAbstand = s && s.lastTick ? await page.evaluate(t => Date.now() - t, s.lastTick) : null;
    const gemessen = echterAbstand !== null ? echterAbstand : serverAbstand;
    check('4: der Zeitstempel bleibt im Normalbetrieb dicht an jetzt (keine stille Schuld)',
      gemessen !== null && gemessen >= 0 && gemessen < 15000, { abstandMs: gemessen });
  }

  check('keine JS-Fehler', errs.length === 0, errs.slice(0,3));
  await ctx.close();

  // ---- 5) WAS IN DER LUECKE PASSIERT, WIRD AUCH BERICHTET
  // Die Nachholung ruft checkMissions(). Beim Seitenstart bleibt das absichtlich stumm - das
  // "Willkommen zurueck"-Fenster fasst zusammen. Mitten im Spiel gibt es dieses Fenster nicht:
  // Bliebe es stumm, kaeme eine Expedition aus einer Minute Hintergrund-Lage kommentarlos zurueck.
  // Schiffe wieder da, Rohstoffe veraendert, Fund im Inventar - und keine Zeile, die das erklaert.
  // Eigener Kontext, weil die Mission sonst schon in den Messrunden oben verfallen waere.
  {
    const ctx2 = await browser.newContext({ viewport:{width:1280,height:900} });
    const p2 = await ctx2.newPage(); const errs2 = [];
    p2.on('pageerror', e => errs2.push(String(e)));
    // Die Rundreise-Rueckkehr ist der schlanksten Missionspfad mit eigener Protokollzeile
    // ('Auto-Erkunder zurück auf ... – Rundreise abgeschlossen.') und braucht sonst nichts.
    const mitMission = JSON.parse(save());
    mitMission.fleet.missions = [{ id: 1, type:'explore', targetId:'home',
      startTime: Date.now(), endTime: Date.now() + 40000,
      fleetName:'Auto-Erkunder', composition:{ships:1}, tourReturn:true }];
    await p2.route('**/api/**', backend({ 'kepler7-save-v3': JSON.stringify(mitMission) }));
    await p2.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
    await p2.addInitScript(() => {
      window.__meldungen = [];
      let zuletzt = '';
      setInterval(() => {
        const c = document.getElementById('toastContainer');
        if (!c) return;
        const t = (c.textContent || '').trim();
        if (t && t !== zuletzt){ zuletzt = t; window.__meldungen.push(t); }
      }, 120);
    });
    await p2.goto(SPIEL_URL); await p2.waitForTimeout(4500);
    await p2.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(i=>{const o=document.getElementById(i); if(o)o.style.display='none';}));
    // Die Mission laeuft noch (40 s). Jetzt eine Luecke, in der sie faellig wird.
    await p2.evaluate(UHR_VOR, 90);
    await p2.waitForTimeout(4000);
    const alle2 = await p2.evaluate(() => (window.__meldungen||[]).join(' | '));
    check('5: eine Mission, die in der Luecke faellig wird, meldet sich im Protokoll',
      /Auto-Erkunder|Rundreise/.test(alle2),
      (alle2.match(/[^|]*(Auto-Erkunder|Rundreise)[^|]*/)||['(nicht gefunden): '+alle2.slice(0,160)])[0].trim().slice(0,160));
    check('5: keine JS-Fehler', errs2.length === 0, errs2.slice(0,3));
    await ctx2.close();
  }
  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
