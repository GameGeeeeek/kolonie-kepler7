// Werkstoff-Zeile (Gleichmaß Etappe 1, 11.09.2026): Protomaterie und die Fabrik-Ketten stehen unter
// der Ressourcenleiste als schmale, umbrechende Chips mit einer Kopfzeile, die zählt, wie viele
// Lager voll und wie viele Ketten gedrosselt sind. „Aufklappen" zeigt die vollen Karten; die Wahl
// liegt im Spielstand (uiWerkstoffeOffen) und wird gespeichert.
//
// AUSGANGSLAGE (v8.720.0): #tier2ResBadges war eine zweite Karten-Leiste in voller Kartengröße,
// so hoch wie die Hauptleiste, obwohl sie für die meisten Spieler nur eine oder zwei Karten trug.
// Die Ketten-Karten trugen ein Tabler-<i>-Icon statt des gezeichneten RES_ICONS-Symbols, der
// Tooltip fehlte, solange die Kette normal lief, und ein gedrosselter Betrieb war nur in der
// Rate-Zeile zu erkennen - die es eingeklappt nicht gibt.
//
// WELCHE FEHLKLASSEN DIESER TEST FÄNGT:
//   1a-1c  Die Kopfzeile ZÄHLT falsch (Zahl der Karten, volle Lager, gedrosselte Ketten) - die
//          Erwartung kommt aus den Karten im Container selbst, nicht aus eingetippten Zahlen.
//   2a-2e  Die Vorgabe ist nicht mehr „eingeklappt", oder der Chip-Modus blendet nicht aus, oder
//          er blendet zu viel aus: Die Altwächter (test_sprungleiste, test_kettenauslastung,
//          test_protomaterie_karte_gesperrt) lesen .label/.value/.rate/.t2-fill aus dem DOM, die
//          müssen in BEIDEN Zuständen da sein.
//   3a-3b  Die Ketten fallen zurück auf das Tabler-<i>-Icon (kein gezeichnetes Symbol).
//   4a-4e  Klappen: Klick schaltet um, der Zustand überlebt den nächsten Tick, zweiter Klick zurück.
//   5a-5b  Persistenz: Die Wahl geht in den gespeicherten Spielstand und kommt beim Laden zurück.
//   6a-6c  Einsteiger ohne Fabrik sehen die Protomaterie-Karte plus einen Hinweis, wo es weitergeht;
//          sobald eine Kette da ist, ist der Hinweis weg.
//   7a-7c  Handy (390 px): Tippziel 44 px, keine Querscroll-Breite, jeder Chip ganz im Container.
//   8a-8b  Eingeklappt trägt die FARBE den Status (voll und gedrosselt in Bernstein).
//   9a     Auf/Zu steht in der Signatur des Renderers: Ein reiner Zustandswechsel (ohne Klick, also
//          ohne lastTier2BadgeSig = null) zeichnet beim nächsten Tick neu - die Wertlisten-Falle.
//
// GEGENPROBEN (KEPLER_WERKSTOFFZEILE_GEGENPROBE=<stand>, Spieldatei per KEPLER_SPIELDATEI umlenken):
//   =alt         v8.720.0 unverändert - dort fällt der Kern
//   =sabotageA   Ketten-Symbol zurück auf das Tabler-<i>            -> 3a/3b
//   =sabotageB   'W:'-Teil aus der Signatur entfernt                -> 9a
//   =sabotageC   Vorgabe uiWerkstoffeOffen = true                   -> Vorgabe-Prüfungen
//   =sabotageD   Kopfzeile ans ENDE der Leiste statt an den Anfang  -> 1a
//   =sabotageE   Protomaterie zählt nicht als „Lager voll"           -> 6d
// Die MUSS_FALLEN-Listen sind GEMESSEN (erst laufen lassen, dann eingetragen), nicht geraten.
const { starteBrowser, SPIEL_URL, ruhigeUhren } = require('./lib/umgebung');

const ergebnis = {};
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };
const SAB = process.env.KEPLER_WERKSTOFFZEILE_GEGENPROBE || '';
const MUSS_FALLEN = {
  alt:       ['V2','1a','1b','1c','1d','2a','2b','2g','2c','2d','3a','3b','8a','8b','4a','4b','4c','5a','4d','4e','9a','5b','6b','6d','7a'],
  sabotageA: ['3a','3b'],
  sabotageB: ['9a'],
  sabotageC: ['2a','2b','2c','2d','8a','8b','4a','4b','4c','5a','4d','4e'],
  sabotageD: ['1a'],
  sabotageE: ['6d']
};

// Nanolegierungsfabrik Stufe 15: Deckel 200 + 15*150 = 2450 - der Bestand liegt genau am Deckel,
// damit die Kette „Lager voll" meldet (bei Gleichstand gewinnt in tier2Step das Lager).
// Quantenchipfabrik Stufe 5 will 0,01 Chips/s und dafür 0,05 Deuterium je Sekunde; der Bestand
// liegt DARUNTER und kein Deuteriumsynthetisierer füllt nach (vgl. die „arm"-Variante in
// test_tier2_hinweis.js) - sonst wäre der Mangel bis zur Messung längst behoben.
const NANO_DECKEL = 2450;

function backend(store, sendungen){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p==='reports')return j({reports:[]});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p.startsWith('storage/')){
    const k=decodeURIComponent(p.slice(8));
    if(req.method()==='PUT'){
      // Der Spielstand kommt als { value, expectedVersion }; value ist die JSON-Zeichenkette des
      // Spielstands. Aufgehoben wird sie roh - die Prüfung sucht den Schlüssel im Text.
      if (sendungen && k === 'kepler7-save-v3'){ try { const b = JSON.parse(req.postData()||'{}'); sendungen.push(typeof b.value === 'string' ? b.value : JSON.stringify(b.value)); } catch(e){ sendungen.push('KAPUTT: ' + e.message); } }
      return j({ok:true,version:2});
    }
    if(store[k]!==undefined)return j({key:k,value:store[k],version:1});
    return j({e:1},404);
  }
  return j([]);
};}

// art: 'fabrik' (Nano am Deckel, Chips gedrosselt), 'einsteiger' (keine Fabrik, kein Bestand).
const save = (art, extra) => JSON.stringify(Object.assign({ ...ruhigeUhren(), tutorialSeen:true, newbieWelcomeSeen:true,
  resources: art === 'fabrik'
    ? { energie:9e8, erz:9e8, kristalle:9e8, deuterium:0.01, antimaterie:9e6, forschungspunkte:3e4, nanolegierungen:NANO_DECKEL, hochenergiekristalle:10 }
    : { energie:500, erz:500, kristalle:200, deuterium:50, antimaterie:0, forschungspunkte:0 },
  buildings: art === 'fabrik'
    ? { solar:30, mine:28, labor:20, lager:60, werft:14, nanolegierungsfabrik:15, quantenchipfabrik:5 }
    : { solar:2, mine:2 },
  research: art === 'fabrik' ? { rnanotech:5, rquantenphysik:1 } : {},
  colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null}, xp: art === 'fabrik' ? 9e5 : 0, credits: art === 'fabrik' ? 5e5 : 0,
  buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} }, extra || {}));

async function seite(browser, spielstand, opts){
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: opts.viewport || { width:1400, height:1000 } });
  const page = await ctx.newPage(); const errs=[]; const sendungen=[];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': spielstand }, sendungen));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  /* `state` liegt in der Spieldatei innerhalb einer Kapselung und ist im Fenster nicht sichtbar
     (page.evaluate(() => state) läuft in einen ReferenceError, siehe test_offline_warteschlangen).
     Der Signatur-Test (9a) braucht aber die LEBENDE Referenz: Er muss den Zustand ändern, OHNE den
     Klick-Pfad zu nehmen (der löscht die Signatur selbst). Der Haken: doSave() ruft
     JSON.stringify(state) mit dem echten Objekt auf - der Umschlag hier merkt sich das Objekt, das
     wie der Spielstand aussieht (resources, buildings, lastTick; kein Backend-Umschlag mit value). */
  await page.addInitScript(() => {
    const orig = JSON.stringify;
    JSON.stringify = function(v){
      if (v && typeof v === 'object' && !Array.isArray(v) && v.resources && v.buildings
          && Object.prototype.hasOwnProperty.call(v, 'lastTick') && !('value' in v)) window.__spielstandRef = v;
      return orig.apply(this, arguments);
    };
  });
  await page.goto(SPIEL_URL); await page.waitForTimeout(4200);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}));
  return { ctx, page, errs, sendungen };
}

// Alles, was der Test an der Leiste abliest - in EINEM Griff, gescopt auf #tier2ResBadges.
const LESEN = () => {
  const el = document.getElementById('tier2ResBadges');
  if (!el) return null;
  const kopf = el.querySelector(':scope > button.werkstoffe-kopf');
  const karten = Array.from(el.querySelectorAll('.rescard'));
  const rect = el.getBoundingClientRect();
  const farbe = (sel) => { const k = el.querySelector(sel); return k ? getComputedStyle(k).color : null; };
  const nano = el.querySelector('.rescard[data-res="nanolegierungen"]');
  return {
    kopfDa: !!kopf,
    kopfErstes: !!kopf && el.firstElementChild === kopf,
    kopfText: kopf ? kopf.textContent.replace(/\s+/g,' ').trim() : '',
    kopfHoehe: kopf ? kopf.getBoundingClientRect().height : 0,
    ariaExpanded: kopf ? kopf.getAttribute('aria-expanded') : null,
    kompakt: el.classList.contains('werkstoffe-kompakt'),
    klasseWerkstoffe: el.classList.contains('werkstoffe'),
    klasseResbar: el.classList.contains('resbar'),
    resbarVorher: (() => { const r = document.getElementById('resbar'); return !!(r && (r.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)); })(),
    anzahl: karten.length,
    voll: karten.filter(k => k.classList.contains('t2-full')).length,
    drossel: karten.filter(k => k.classList.contains('t2-drossel')).length,
    keys: karten.map(k => k.getAttribute('data-res')),
    labelDisplays: Array.from(el.querySelectorAll('.rescard:not([data-gesperrt]) .label')).map(l => getComputedStyle(l).display),
    gesperrtLabelDisplay: (() => { const l = el.querySelector('.rescard[data-gesperrt] .label'); return l ? getComputedStyle(l).display : null; })(),
    titel: karten.filter(k => k.getAttribute('data-res') !== 'protomaterie').map(k => ({ key: k.getAttribute('data-res'), label: (k.querySelector('.label')||{}).textContent || '', wert: ((k.querySelector('.value')||{}).textContent || '').replace(/\s+/g,' ').trim(), titel: k.getAttribute('title') || '' })),
    kartenHoehen: karten.map(k => Math.round(k.getBoundingClientRect().height)),
    nanoTeile: nano ? ['.label','.value','.rate','.t2-fill'].filter(s => !!nano.querySelector(s)) : [],
    badges: Array.from(el.querySelectorAll('.icon-badge')).map(b => ({ svg: !!b.querySelector('svg'), ti: !!b.querySelector('i.ti') })),
    farbeVoll: farbe('.rescard.t2-full .value'),
    farbeDrossel: farbe('.rescard.t2-drossel .value'),
    hinweise: Array.from(el.querySelectorAll('.werkstoffe-hinweis')).map(h => h.textContent.trim()),
    scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
    kartenAusserhalb: karten.filter(k => { const r = k.getBoundingClientRect(); return r.left < rect.left - 0.5 || r.right > rect.right + 0.5 || r.top < rect.top - 0.5 || r.bottom > rect.bottom + 0.5; }).map(k => k.getAttribute('data-res')),
    offenImState: window.__spielstandRef ? window.__spielstandRef.uiWerkstoffeOffen : 'kein Haken'
  };
};

(async () => {
  const browser = await starteBrowser();

  // ============================== Fabrik-Spielstand: Kopfzeile, Vorgabe, Symbole, Klappen, Persistenz, Farbe, Signatur
  {
    const { ctx, page, errs, sendungen } = await seite(browser, save('fabrik'));
    const z = await page.evaluate(LESEN);
    merke('V1: Vorbedingung - #tier2ResBadges ist da', !!z);
    const z0 = z || {};
    // Das Fixture muss BEIDE Zähler > 0 liefern, sonst prüft 1b/1c ins Leere. Wird hier gemessen,
    // nicht angenommen: Der Zustand entsteht aus tier2Step, nicht aus dem Spielstand allein.
    merke('V2: Vorbedingung - mindestens ein volles Lager, eine gedrosselte und eine normal laufende Kette im Fixture',
      z0.voll > 0 && z0.drossel > 0 && z0.anzahl > z0.voll + z0.drossel + 1, { voll: z0.voll, drossel: z0.drossel, keys: z0.keys });
    merke('V3: Vorbedingung - der Haken hat den Spielstand gefangen (Speichern nach dem Laden)',
      z0.offenImState !== 'kein Haken', { sendungen: sendungen.length, state: z0.offenImState });

    // ---- 1) Kopfzeile zählt, was in der Leiste steht
    // Streng mit Leerzeichen: Der Knopf wird vorgelesen, und ohne Trenner zwischen den Spans klebte
    // „Werkstoffe·3" bzw. „gedrosseltAufklappen" zusammen (gemessen 11.09.2026, seitdem getrennt).
    const mN = /Werkstoffe · (\d+)/.exec(z0.kopfText || '');
    const mV = /(\d+) Lager voll/.exec(z0.kopfText || '');
    const mG = /(\d+) gedrosselt/.exec(z0.kopfText || '');
    merke('1a: Kopfzeile ist ein Knopf als erstes Kind und nennt die Zahl der Karten',
      z0.kopfDa && z0.kopfErstes && !!mN && Number(mN[1]) === z0.anzahl, { text: z0.kopfText, erstes: z0.kopfErstes, karten: z0.anzahl });
    merke('1b: „N Lager voll" = Zahl der .t2-full-Karten', !!mV && Number(mV[1]) === z0.voll, { text: z0.kopfText, voll: z0.voll });
    merke('1c: „N gedrosselt" = Zahl der .t2-drossel-Karten', !!mG && Number(mG[1]) === z0.drossel, { text: z0.kopfText, drossel: z0.drossel });
    merke('1d: Container behält id, Klasse resbar und bekommt werkstoffe; #resbar steht davor',
      z0.klasseResbar && z0.klasseWerkstoffe && z0.resbarVorher, { resbar: z0.klasseResbar, werkstoffe: z0.klasseWerkstoffe, vorher: z0.resbarVorher });

    // ---- 2) Vorgabe: eingeklappt
    merke('2a: Vorgabe ist kompakt (Klasse werkstoffe-kompakt, aria-expanded=false)',
      z0.kompakt && z0.ariaExpanded === 'false', { kompakt: z0.kompakt, aria: z0.ariaExpanded });
    merke('2b: eingeklappt ist jedes .label der Ketten ausgeblendet', z0.labelDisplays.length > 0 && z0.labelDisplays.every(d => d === 'none'), z0.labelDisplays);
    merke('2f: die gesperrte Protomaterie-Karte behaelt eingeklappt ihren Namen', z0.gesperrtLabelDisplay !== null && z0.gesperrtLabelDisplay !== 'none', z0.gesperrtLabelDisplay);
    // Tooltip: eingeklappt ist er die einzige Namensquelle des Chips - auch bei einer Kette OHNE Statussatz.
    merke('2g: jede Ketten-Karte hat einen Tooltip, der mit Name und „Bestand / Deckel" beginnt',
      z0.titel.length > 0 && z0.titel.every(k => k.titel.indexOf(k.label.trim() + ' · ' + k.wert.replace(' / ', ' / ')) === 0),
      z0.titel.map(k => k.titel.slice(0, 60)));
    merke('2c: eingeklappt ist jede Karte höchstens 40 px hoch', z0.anzahl > 0 && z0.kartenHoehen.every(h => h <= 40), z0.kartenHoehen);
    merke('2d: uiWerkstoffeOffen ist im Spielstand als false vorbelegt', z0.offenImState === false, z0.offenImState);
    merke('2e: DOM-Vertrag der Altwächter: Nano-Karte trägt .label, .value, .rate und .t2-fill auch eingeklappt',
      z0.nanoTeile.length === 4, z0.nanoTeile);

    // ---- 3) Symbole
    merke('3a: jede .icon-badge der Leiste enthält ein gezeichnetes <svg>', z0.badges.length > 0 && z0.badges.every(b => b.svg), z0.badges);
    merke('3b: keine .icon-badge enthält ein Tabler-<i class="ti">', z0.badges.length > 0 && z0.badges.every(b => !b.ti), z0.badges);

    // ---- 8) Farbe im Kompaktzustand (vor dem Klappen gemessen)
    merke('8a: eingeklappt ist .value der vollen Karte bernsteinfarben', z0.farbeVoll === 'rgb(224, 165, 72)', z0.farbeVoll);
    merke('8b: eingeklappt ist .value der gedrosselten Karte bernsteinfarben', z0.farbeDrossel === 'rgb(224, 165, 72)', z0.farbeDrossel);
    merke('6c: im Fabrik-Spielstand gibt es keinen Einsteiger-Hinweis', z0.hinweise.length === 0, z0.hinweise);

    // ---- 4) Klappen per Klick
    const sendungenVorKlick = sendungen.length;
    let z1 = {}, z2 = {}, z3 = {};
    try {
      const kopf = await page.$('#tier2ResBadges > #werkstoffeToggle');
      if (kopf) { await kopf.click(); await page.waitForTimeout(400); z1 = (await page.evaluate(LESEN)) || {}; }
    } catch (e) { console.log('   (Klick 1 fehlgeschlagen: ' + e.message + ')'); }
    merke('4a: Klick auf die Kopfzeile klappt auf (Klasse weg, aria-expanded=true)',
      z1.kompakt === false && z1.ariaExpanded === 'true', { kompakt: z1.kompakt, aria: z1.ariaExpanded });
    merke('4b: aufgeklappt ist jedes .label sichtbar', !!z1.labelDisplays && z1.labelDisplays.length > 0 && z1.labelDisplays.every(d => d !== 'none'), z1.labelDisplays);
    merke('4c: state.uiWerkstoffeOffen ist nach dem Klick true', z1.offenImState === true, z1.offenImState);
    // ---- 5a) Persistenz: save() laeuft synchron aus dem onclick, die PUT-Sendung kommt binnen
    // Millisekunden. Gemessen wird deshalb im 400-ms-Fenster direkt nach dem Klick - ein weites Fenster
    // wuerde unter Pruflauf-Last vom 10-s-Autosave gerettet, und ein fehlendes save() im Klickpfad
    // bliebe unsichtbar (Befund der Durchsicht, 11.09.2026).
    const neueSendungen = sendungen.slice(sendungenVorKlick);
    merke('5a: binnen 400 ms nach dem Aufklappen wurde ein Spielstand mit uiWerkstoffeOffen:true gesendet',
      neueSendungen.length > 0 && neueSendungen.some(s => /"uiWerkstoffeOffen":true/.test(s)), { sendungen: neueSendungen.length });
    // Ein Tick mit render() darf den Zustand nicht zurückdrehen (Signatur-Cache vs. Neuaufbau).
    await page.waitForTimeout(2500);
    z2 = (await page.evaluate(LESEN)) || {};
    merke('4d: nach 2,5 s (mindestens ein Tick mit render) weiterhin offen', z2.kompakt === false && z2.ariaExpanded === 'true', { kompakt: z2.kompakt, aria: z2.ariaExpanded });

    try {
      const kopf = await page.$('#tier2ResBadges > #werkstoffeToggle');
      if (kopf) { await kopf.click(); await page.waitForTimeout(400); z3 = (await page.evaluate(LESEN)) || {}; }
    } catch (e) { console.log('   (Klick 2 fehlgeschlagen: ' + e.message + ')'); }
    merke('4e: zweiter Klick klappt wieder ein', z3.kompakt === true && z3.ariaExpanded === 'false' && z3.offenImState === false,
      { kompakt: z3.kompakt, aria: z3.ariaExpanded, state: z3.offenImState });

    // ---- 9) Signatur: Zustandswechsel OHNE Klick (also ohne lastTier2BadgeSig = null)
    // Wer 'W:' aus der Signatur streicht, sieht hier den eingefrorenen Kompaktzustand.
    let z9 = {};
    try {
      await page.evaluate(() => { if (window.__spielstandRef) window.__spielstandRef.uiWerkstoffeOffen = true; });
      await page.waitForTimeout(2500);
      z9 = (await page.evaluate(LESEN)) || {};
    } catch (e) { console.log('   (Signatur-Schritt fehlgeschlagen: ' + e.message + ')'); }
    merke('9a: state.uiWerkstoffeOffen = true ohne Klick zeichnet beim nächsten Tick offen (Auf/Zu steht in der Signatur)',
      z9.offenImState === true && z9.kompakt === false && z9.ariaExpanded === 'true', { state: z9.offenImState, kompakt: z9.kompakt, aria: z9.ariaExpanded });

    merke('J1: keine JS-Fehler (Fabrik)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 5b) Zweiter Kontext: gespeichert offen -> startet offen
  {
    const { ctx, page, errs } = await seite(browser, save('fabrik', { uiWerkstoffeOffen: true }));
    const z = (await page.evaluate(LESEN)) || {};
    merke('5b: Spielstand mit uiWerkstoffeOffen:true startet aufgeklappt',
      z.kopfDa && z.kompakt === false && z.ariaExpanded === 'true' && z.labelDisplays.length > 0 && z.labelDisplays.every(d => d !== 'none'),
      { kompakt: z.kompakt, aria: z.ariaExpanded, label: z.labelDisplays });
    merke('J2: keine JS-Fehler (offen geladen)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 6) Einsteiger ohne Fabrik
  {
    const { ctx, page, errs } = await seite(browser, save('einsteiger'));
    const z = (await page.evaluate(LESEN)) || {};
    merke('6a: ohne Fabrik und Bestand steht genau eine Karte, die Protomaterie',
      z.anzahl === 1 && z.keys[0] === 'protomaterie', z.keys);
    merke('6b: dazu genau ein Hinweis „Weitere Werkstoffe …"',
      z.hinweise.length === 1 && /Weitere Werkstoffe/.test(z.hinweise[0]), z.hinweise);
    merke('J3: keine JS-Fehler (Einsteiger)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 6d) Protomaterie freigeschaltet UND voll: zaehlt in der Kopfzeile mit
  {
    const { ctx, page, errs } = await seite(browser, save('einsteiger', {
      research: { rminentechnik: 1 },
      resources: { energie:500, erz:500, kristalle:200, deuterium:50, antimaterie:0, forschungspunkte:0, protomaterie: 500 } }));
    const z = (await page.evaluate(LESEN)) || {};
    // Deckel 500 ohne Aufbereitung (PROTOMATERIE_LAGER_BASIS) - gemessen: die Karte traegt t2-full.
    merke('6d: freigeschaltete, volle Protomaterie zaehlt als „1 Lager voll" und traegt t2-full',
      z.anzahl === 1 && z.voll === 1 && /1 Lager voll/.test(z.kopfText || ''), { text: z.kopfText, voll: z.voll });
    merke('J5: keine JS-Fehler (Protomaterie voll)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 7) Handy 390x844
  {
    const { ctx, page, errs } = await seite(browser, save('fabrik'), { viewport: { width:390, height:844 } });
    const z = (await page.evaluate(LESEN)) || {};
    merke('7a: am Handy ist die Kopfzeile mindestens 44 px hoch (Tippziel)', z.kopfDa && z.kopfHoehe >= 44, z.kopfHoehe);
    merke('7b: am Handy keine Querscroll-Breite', z.scrollWidth > 0 && z.scrollWidth <= z.innerWidth, { scroll: z.scrollWidth, innen: z.innerWidth });
    merke('7c: am Handy liegt jede Karte ganz innerhalb von #tier2ResBadges', z.anzahl > 0 && z.kartenAusserhalb.length === 0, z.kartenAusserhalb);
    merke('J4: keine JS-Fehler (Handy)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  await browser.close();

  if (SAB){
    const soll = MUSS_FALLEN[SAB] || [];
    const gefallen = Object.keys(ergebnis).filter(n => ergebnis[n] === false);
    const fehlend = soll.filter(n => ergebnis[n] !== false);
    const unerwartet = gefallen.filter(n => soll.indexOf(n) < 0);
    if (fehlend.length) console.log('FAIL - Gegenprobe unvollstaendig: '+fehlend.join(' ')+' blieben gruen');
    else if (unerwartet.length) console.log('FAIL - Gegenprobe UEBERZAEHLIG: '+unerwartet.join(' ')+' fiel zusaetzlich');
    else console.log('GEGENPROBE '+SAB+': '+gefallen.length+'/'+soll.length+' gefallen ('+gefallen.map(n=>n+'=rot').join(' ')+')');
    process.exit((fehlend.length || unerwartet.length) ? 1 : 0);
  }
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL - Testlauf abgebrochen: ' + e.message); process.exit(1); });
