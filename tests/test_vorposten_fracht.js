// VP-1: Die Abholung vom Vorposten wird ein Transportverband.
//
//   node tests/test_vorposten_fracht.js
//
// AUFTRAG Sascha (08.09.2026, woertlich): „wenn man ressourcen abholt von dem vorposten macht sich
// ein transportverband auf dem heimatplaneten auf den weg, man bekommt erst die ressourcen wenn
// der verband angekommen ist, und er nimmt fuer die dauer des hinwegs und rueckflugs einen
// flottenslot ein."
//
// GEPRUEFT WIRD DIE REGEL:
//   1a  Eine eintreffende `vorposten-lager`-Belohnung wird NICHT sofort gebucht - der Bestand
//       bleibt, wo er war.
//   1b  Stattdessen entsteht eine Mission 'vorposten-fracht', die die Fracht eingefroren mitfuehrt.
//   1c  Sie belegt einen Flottenslot. Gemessen an der Anzeige, nicht an der Rechnung.
//   1d  Der Flugrabatt des Vorpostens steckt in der eingefrorenen Flugzeit - auch dann, wenn die
//       Einloesung frueher antwortet als der Abruf des Vorpostens. Gemessen als Verhaeltnis
//       zweier sonst gleicher Laeufe, nicht gegen eine eingetippte Sollzeit.
//   2a  Bei der ANKUNFT wird gebucht - Bestand steigt, und die Meldung sagt, dass der Verband
//       zurueck ist. Gemessen mit einer Mission, deren Ankunft schon vorbei ist.
//   2b  Die Schiffe aus dem Sternendock reisen mit und kommen an.
//   3a  DER RUECKFALL: Ist kein Flottenslot frei, wird SOFORT gebucht statt verworfen. Das ist
//       die wichtigste Pruefung des Satzes - eine verlorene Lieferung waere Spielerschaden.
//   4a  Der Kartenmenue-Grund nennt die Flugzeit, bevor geklickt wird.
//
// GEGENPROBE: `KEPLER_SPIELDATEI` auf den Stand vor VP-1, Aufruf mit KEPLER_FRACHT_GEGENPROBE=alt.
// Dort bucht der Claim-Zweig sofort -> 1a, 1b, 1c, 4a fallen; 2a/2b/3a bleiben gruen, weil das
// alte Verhalten genau der Rueckfall ist (gemessen, nicht angenommen).
const fsF = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const ergebnis = {};
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };

const ICH = 'u-ich';
const SYS = 'vega';
const now = Date.now();
const GEGENPROBE = process.env.KEPLER_FRACHT_GEGENPROBE || '';
const MUSS_FALLEN = { alt: ['1a', '1b', '1c', '4a'], standort: ['2d'], mond: ['2e'], kalt: ['1d'] };

const STUFEN = [1,2,3,4,5,6,7,8].map(s => ({ stufe:s, name:'Stufe '+s, kernLp: 20000*s, verteidigung: 2500*s,
  garnisonMax: 300*s, flug:0.06, prod:0.015, scan:1, kosten: s===1?null:{ erz:1000 } }));
const ZWEIGE = [{ key:'werft', name:'Werft', kurz:'x', namen:{4:'Werftgerüst',5:'Dockring',6:'Schiffsschmiede',7:'Flottenwerft',8:'Sternenwerft'}, mult:{} }];

/* Der Flugrabatt der Vorlage steht als KONSTANTE da, weil 1d gegen ihn rechnet. Eine zweite,
   eingetippte 0.2 in der Erwartung waere genau die Sorte Zahl, die beim naechsten Vorlagen-Umbau
   still falsch wird. */
const VP_FLUG_RABATT = 0.2;
function vpDoc(over){
  return Object.assign({
    id:'vp-1', sys:SYS, besitzer:ICH, besitzerName:'Ich', seit: now - 86400000,
    stufe:8, name:'Sternenwerft', zweig:'werft', zweigName:'Werft', maxStufe:8,
    kern:{ lp: 100000, lpMax: 100000 }, verteidigung: 20000,
    garnisonAnzahl: 0, garnisonMax: 3000, garnison:{},
    slots:5, module:[], modulBoni:null, projekte:[], projektBoni:null,
    lager:{ erz: 5000, kristalle: 2000, deuterium: 500 }, lagerVollAb: now + 36e5, dockBereit: 0,
    abbauAb:null, schutzBis:0, ausbauAb: now - 1000,
    nutzen:{ flug:VP_FLUG_RABATT, prod:0.05, scan:3, flugDeckel:0.5 }, eigener:true,
    anflug:[], meinLetzterSchlag:0, letzterKampf:null, kampfverlauf:[], naechsteStufe:null
  }, over || {});
}

/* `opt.missionen` setzt fertige Missionen in den Spielstand - so laesst sich die ANKUNFT messen,
   ohne auf einen echten Flug zu warten. `opt.slotsVoll` fuellt die Flottenslots mit Erkundungen,
   damit der Rueckfall greift. */
function spielstand(opt){
  opt = opt || {};
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil','sammlung']) g[t] = true;
  const missionen = (opt.missionen || []).slice();
  if (opt.slotsVoll) for (let i = 0; i < 8; i++)
    missionen.push({ id: 8000+i, type:'explore', targetId:'thessa', startTime: now, endTime: now + 9e6, composition:{ spaeher: 1 } });
  return JSON.stringify({
    tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:1000, kristalle:1000, deuterium:1000, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:60, werft:14 }, research:{},
    fleet:{ jaeger:80, cruisers:12, spaeher:20, frachter:10, missions: missionen },
    /* `aufKolonie` stellt den AKTIVEN Standort auf eine Kolonie, waehrend der Verband an der
       Heimatflotte haengt - der Fall aus der Durchsicht an PR #613. */
    /* `mondMitMission` stellt den Fall des P1-Befunds her: Kolonie ohne Missionen, ihr MOND mit
       einer - und der Mond geht beim Aufgeben der Kolonie mit verloren. */
    colonies: opt.mondMitMission
      ? { [KOLONIE]: { fleet:{ cruisers: 0, missions: [] }, buildings:{}, resources:{} },
          ['moon_' + KOLONIE]: { fleet:{ cruisers: 0, missions: [ Object.assign({}, angekommenSpaet) ] }, buildings:{}, resources:{} } }
      : (opt.aufKolonie ? { [KOLONIE]: { fleet:{ cruisers: 0, missions: [] }, buildings:{}, resources:{} } } : {}),
    discovered: (opt.aufKolonie || opt.mondMitMission) ? { [KOLONIE]: true, ['moon_' + KOLONIE]: true } : {},
    activeBasePlanet: (opt.aufKolonie || opt.mondMitMission) ? KOLONIE : 'home', player:{ id:ICH, name:'Ich' },
    xp:9e5, credits:5e5, buffs:[], lastTick: now, colonyNames:{}, modules:{}, shipModules:{},
    nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5, weeklySystemsSeen:14,
    schubGesehen:true, lastSeenReportTime: now });
}

async function lauf(browser, opt){
  opt = opt || {};
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  let belohnungRaus = false;
  const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }),
               'kepler7-save-v3': spielstand(opt) };
  await page.route('**/api/**', async r => {
    const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[],
      activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[], alienNester:[], controlledSystems:{}, wrackKonvois:[] });
    if (p === 'vorposten'){
      /* TRAEGE ANTWORT (1d). Im echten Start ist der Wettlauf schon ohne Zutun entschieden -
         `loadGalaxyState` muss /galaxy abwarten, BEVOR es /vorposten ueberhaupt schickt, waehrend
         die Einloesung mit einer Anfrage auskommt. Der Mock erfuellt beide sofort, und dann
         entscheidet die Taktzuteilung des Browsers. Eine Pruefung, die davon abhaengt, misst
         Glueck. Die Verzoegerung macht die REIHENFOLGE zur Vorgabe statt zum Zufall. */
      if (opt.vorpostenTraege) await new Promise(res => setTimeout(res, opt.vorpostenTraege));
      return j({ ok:true, aktiv:true, bauAktiv:true, maxJeKonto:3, schutzMs:43200000, abklingMs:14400000,
      ausbauMs:43200000, garnisonFaktor:0.5, stufen:STUFEN, zweige:ZWEIGE, zweigAb:4, maxStufe:8, liste:[vpDoc(opt.vp)], eigene:1,
      modulDefs:[], modulSeltenheiten:{}, modulBestand:{}, modulSlotsMax:5, projektDefs:[], projekteAktiv:true,
      flugDeckel:0.5, abbauMs:86400000, abbauAktiv:true, lagerAktiv:true, dockMax:7 });
    }
    if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
    if (p === 'reports') return j(req.method() === 'POST' ? { ok:true } : { reports:[] });
    if (p === 'players-map') return j({ players:[] });
    if (p === 'pending-rewards/claim'){
      const b = (opt.belohnung && !belohnungRaus) ? (belohnungRaus = true, opt.belohnung) : null;
      return j({ reward: b });
    }
    if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
    if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]); return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
    if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8)); if (req.method() === 'PUT'){ try { st[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true, version:2 }); } if (st[k] !== undefined) return j({ key:k, value:st[k], version:1 }); return j({ error:'nicht gefunden' }, 404); }
    return j({ ok:true });
  });
  /* Das Protokoll wird MITGESCHNITTEN, nicht am Ende gelesen: log() schreibt in EIN Element, der
     Endzustand nennt nur die letzte Meldung. */
  await page.addInitScript(() => {
    localStorage.setItem('kepler7_token', 'tok');
    window.__logs = [];
    /* WARTEN, BIS ES DAS ELEMENT GIBT. Erster Entwurf haengte den Beobachter einmalig an
       DOMContentLoaded - in einem Lauf war `#log` da noch nicht erzeugt, `beobachte()` kehrte
       stumm zurueck, und der Mitschnitt blieb LEER. Das sah aus wie „keine Meldung" und war
       „nicht hingesehen": genau die Sorte Pruefung, die aus dem falschen Grund rot wird. */
    const beobachte = () => {
      const l = document.getElementById('log');
      if (!l) return false;
      /* GEMESSEN WIRD DER EREIGNISVERLAUF, NICHT DER ENDZUSTAND. `log()` ersetzt das innerHTML
         von EINEM Element. Ein Beobachter, der beim Feuern `l.textContent` liest, bekommt den
         Stand NACH allen Aenderungen dieses Takts - fallen drei Meldungen zusammen, sieht er
         dreimal die letzte. Genau so ist die Ankunftsmeldung des Transportverbands verloren
         gegangen, waehrend Bestand und Schiffe nachweislich gebucht waren.
         Die `addedNodes` jedes einzelnen Datensatzes tragen dagegen den Text, der in genau
         diesem Schritt hineingeschrieben wurde - auch wenn er laengst ersetzt ist. */
      new MutationObserver((saetze) => {
        for (const satz of saetze){
          let t = '';
          for (const n of satz.addedNodes) t += (n.textContent || '');
          if (!t && satz.type === 'characterData') t = (satz.target.textContent || '');
          t = t.replace(/\s+/g, ' ').trim();
          if (t && t !== window.__logs[window.__logs.length - 1]) window.__logs.push(t);
        }
      }).observe(l, { subtree: true, childList: true, characterData: true });
      return true;
    };
    if (!beobachte()){
      const timer = setInterval(() => { if (beobachte()) clearInterval(timer); }, 20);
      setTimeout(() => clearInterval(timer), 15000);
    }
  });
  await page.goto(SPIEL_URL); await page.waitForTimeout(6500);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display='none'; }));
  return { ctx, page, errs, st };
}

/* DER SPIELSTAND WIRD AUS DEM GEFAELSCHTEN SERVER-SPEICHER GELESEN, nicht aus localStorage.
   Erster Entwurf las localStorage und bekam ueberall `null` - im Server-Modus schreibt das Spiel
   den Stand ueber PUT /api/storage/kepler7-save-v3, und genau den faengt die Route oben in `st`
   auf. Gemessen wird damit, was WIRKLICH gespeichert wurde, nicht was nebenbei im Browser liegt. */
async function stand(l){
  const logs = await l.page.evaluate(() => (window.__logs || []).slice());
  let sv = null;
  try { sv = JSON.parse(l.st['kepler7-save-v3']); } catch(e){}
  return { save: sv, logs };
}

/* Eine Mission, die noch LANGE unterwegs ist - sie soll beim Aufgeben im Weg stehen, nicht
   waehrend des Tests ankommen. */
const angekommenSpaet = { id: 4712, type:'vorposten-fracht', targetId: SYS, system: SYS,
  startTime: now, endTime: now + 9e6, fleetName:'Transportverband',
  fracht: { type:'vorposten-lager', system: SYS, name:'Sternenwerft', erz: 3000 } };
const BELOHNUNG = { type:'vorposten-lager', system: SYS, name:'Sternenwerft',
                    erz: 5000, kristalle: 2000, deuterium: 500 };
/* Eine ECHTE Kolonie-Kennung aus der Spieldatei, keine erfundene: Ein unbekannter Schluessel
   wuerde als Standort still ignoriert, und der Test maesse dann gar nichts. */
const KOLONIE = (fsF.readFileSync(SPIELDATEI, 'utf8').match(/\{ id:'(\w+)',[^\n]*system:'kepler'/g) || [])
  .map(z => (z.match(/id:'(\w+)'/) || [])[1]).filter(x => x && x !== 'home')[0] || 'thessa';

(async () => {
  const browser = await starteBrowser();

  // ---- 1) Die Belohnung wird zum Verband ------------------------------------------------------
  const a = await lauf(browser, { belohnung: BELOHNUNG });
  const sa = await stand(a);
  const missionenA = (sa.save && sa.save.fleet && sa.save.fleet.missions) || [];
  const fracht = missionenA.filter(m => m && m.type === 'vorposten-fracht');
  merke('1a: die Fracht wird NICHT sofort gebucht - der Bestand bleibt',
    !!sa.save && Math.round(sa.save.resources.erz) < 3000,
    { erz: sa.save && Math.round(sa.save.resources.erz), logs: sa.logs.slice(-2) });
  merke('1b: stattdessen fliegt ein Transportverband, der die Fracht eingefroren mitfuehrt',
    fracht.length === 1 && !!fracht[0].fracht && Number(fracht[0].fracht.erz) === 5000
    && fracht[0].endTime > fracht[0].startTime,
    { anzahl: fracht.length, fracht: fracht[0] && fracht[0].fracht, dauerS: fracht[0] && Math.round((fracht[0].endTime - fracht[0].startTime)/1000) });
  const slots = await a.page.evaluate(() => {
    const el = document.getElementById('fpFleetCount');
    return el ? (el.textContent || '').trim() : null;
  });
  /* Die Anzeige lautet „(1/2)" - gemessen wird die ERSTE Zahl, nicht das Zeichenmuster. */
  const belegt = slots ? Number((slots.match(/(\d+)\s*\//) || [])[1]) : null;
  merke('1c: er belegt einen Flottenslot', belegt >= 1, { anzeige: slots, belegt });
  await a.ctx.close();

  /* ---- 1d) DER FLUGRABATT UEBERLEBT DEN KALTEN ZWISCHENSPEICHER ------------------------------
     Befund der Durchsicht an PR #613, bestaetigt an der Aufrufkette: `vorpostenFlugMult` liest
     `vorpostenCache`, und den fuellt beim Start erst /galaxy -> /vorposten - zwei Anfragen
     nacheinander, waehrend die Einloesung mit einer auskommt. Traf sie zuerst ein, stand der
     Speicher leer, `vorpostenAn()` gab null, und der Verband bekam die UNGEKUERZTE Flugzeit
     eingefroren. Eingefroren heisst fuer immer: die Mission rechnet nie nach.

     GEMESSEN WIRD DIE REGEL, NICHT EINE ZAHL: zweimal derselbe Lauf mit derselben traegen
     Antwort, einmal mit Rabatt in der Vorlage und einmal ohne. Der Unterschied zwischen beiden
     Dauern IST der Rabatt. Eine eingetippte Sollzeit waere beim naechsten Umbau der Flugformel
     still falsch; dieser Vergleich nicht.

     Am Stand vor der Behebung sind beide Dauern GLEICH - der Rabatt kam in keinem der beiden
     Laeufe an, und genau das faellt hier auf. */
  const dauerVon = async (rabatt) => {
    const l = await lauf(browser, { belohnung: BELOHNUNG, vorpostenTraege: 400,
                                    vp: { nutzen:{ flug: rabatt, prod:0.05, scan:3, flugDeckel:0.5 } } });
    const sv = await stand(l);
    await l.ctx.close();
    const m = (((sv.save || {}).fleet || {}).missions || []).filter(x => x && x.type === 'vorposten-fracht')[0];
    return m ? (m.endTime - m.startTime) : null;
  };
  const mitRabatt = await dauerVon(VP_FLUG_RABATT);
  const ohneRabatt = await dauerVon(0);
  const verhaeltnis = (mitRabatt && ohneRabatt) ? (mitRabatt / ohneRabatt) : null;
  merke('1d: der Flugrabatt des Vorpostens wirkt, auch wenn die Einloesung vor /vorposten antwortet',
    verhaeltnis !== null && Math.abs(verhaeltnis - (1 - VP_FLUG_RABATT)) < 0.01,
    { mitRabattS: mitRabatt && Math.round(mitRabatt/1000), ohneRabattS: ohneRabatt && Math.round(ohneRabatt/1000),
      verhaeltnis: verhaeltnis && +verhaeltnis.toFixed(3), erwartet: 1 - VP_FLUG_RABATT });

  // ---- 2) Die Ankunft --------------------------------------------------------------------------
  const angekommen = { id: 4711, type:'vorposten-fracht', targetId: SYS, system: SYS,
    startTime: now - 60000, endTime: now - 1000, fleetName:'Transportverband',
    fracht: { type:'vorposten-lager', system: SYS, name:'Sternenwerft',
              erz: 4000, kristalle: 1500, deuterium: 400, schiffe: { cruisers: 2 } } };
  const b = await lauf(browser, { missionen: [angekommen] });
  const sb = await stand(b);
  merke('2a: bei der Ankunft wird gebucht - und die Meldung sagt, dass der Verband zurueck ist',
    !!sb.save && Math.round(sb.save.resources.erz) >= 4000
    && sb.logs.some(t => /Transportverband ist zurück/.test(t)),
    { erz: sb.save && Math.round(sb.save.resources.erz), logs: sb.logs.filter(t => /Transportverband/.test(t)) });
  merke('2b: die Schiffe aus dem Sternendock reisen mit und kommen an',
    !!sb.save && (sb.save.fleet.cruisers || 0) >= 14,
    { cruisers: sb.save && sb.save.fleet.cruisers });
  /* 2d: DER VERBAND LIEFERT DORT AB, WO ER GESTARTET IST. Befund der Durchsicht an PR #613:
     `vorpostenFrachtBuchen` rief `currentFleet()` - den GERADE aktiven Standort. Wer waehrend des
     Fluges auf eine Kolonie wechselt, haette seine Sternendock-Schiffe dort bekommen, an einem
     Ort, den ihm niemand versprochen hat. Die Rohstoffe sind global und davon nicht betroffen. */
  const d2 = await lauf(browser, { missionen: [angekommen], aufKolonie: true });
  const sd = await stand(d2);
  merke('2d: die Schiffe landen am STARTORT des Verbands, nicht am gerade aktiven Standort',
    !!sd.save && (sd.save.fleet.cruisers || 0) >= 14
    && ((sd.save.colonies[KOLONIE] || {}).fleet || {}).cruisers === 0,
    { kolonie: KOLONIE, heimat: sd.save && sd.save.fleet.cruisers,
      aufKolonie: sd.save && ((sd.save.colonies[KOLONIE]||{}).fleet||{}).cruisers,
      logs: sd.logs.filter(t => /Transportverband/.test(t)) });
  await d2.ctx.close();

  /* 2e: DIE FRACHT DARF NICHT MIT DER KOLONIE VERSCHWINDEN. Befund P1 der zweiten Durchsicht an
     PR #613: `abandonColony` prueft die Missionen der KOLONIE, loescht aber den zugehoerigen Mond
     mit - ohne dessen Missionen anzusehen. Das Loch ist aelter als VP-1 (jede von einem Mond
     gestartete Mission traf es), der Transportverband macht es nur leichter erreichbar.
     Gemessen wird ueber den echten Knopf, nicht am Quelltext: `confirm` wird auf „ja" gestellt,
     damit ein fehlender Riegel WIRKLICH loeschen wuerde - sonst waere die Pruefung aus dem
     falschen Grund gruen. */
  const e2 = await lauf(browser, { mondMitMission: true });
  await e2.page.evaluate(() => { window.confirm = () => true; });
  await e2.page.evaluate(() => { const b = document.getElementById('colonyAbandonBtn'); if (b) b.click(); });
  await e2.page.waitForTimeout(900);
  const nachAufgabe = await e2.page.evaluate((k) => ({
    kolonieDa: !!document.querySelector('#colonyAbandonBtn'),
    knopfDa: !!document.getElementById('colonyAbandonBtn'),
    logs: (window.__logs || []).slice(-4)
  }), KOLONIE);
  const se = await stand(e2);
  merke('2e: der Mond mit unterwegs befindlicher Fracht verhindert das Aufgeben der Kolonie',
    !!se.save && !!se.save.colonies && !!se.save.colonies['moon_' + KOLONIE]
    && (((se.save.colonies['moon_' + KOLONIE] || {}).fleet || {}).missions || []).some(m => m && m.id === 4712),
    { kolonienNachher: se.save && Object.keys(se.save.colonies || {}),
      logs: nachAufgabe.logs });
  await e2.ctx.close();

  merke('2c: die angekommene Mission belegt keinen Slot mehr',
    !!sb.save && !((sb.save.fleet.missions||[]).some(m => m && m.id === 4711)),
    { missionen: sb.save && (sb.save.fleet.missions||[]).map(m => m && m.type) });
  await b.ctx.close();

  // ---- 3) Der Rueckfall ------------------------------------------------------------------------
  const c = await lauf(browser, { belohnung: BELOHNUNG, slotsVoll: true });
  const sc = await stand(c);
  const frachtC = ((sc.save && sc.save.fleet && sc.save.fleet.missions) || []).filter(m => m && m.type === 'vorposten-fracht');
  merke('3a: ohne freien Flottenslot wird SOFORT gebucht statt verworfen',
    !!sc.save && Math.round(sc.save.resources.erz) >= 5000 && frachtC.length === 0,
    { erz: sc.save && Math.round(sc.save.resources.erz), verbaende: frachtC.length,
      logs: sc.logs.filter(t => /Lager deines Vorpostens|Flottenslot/.test(t)) });
  await c.ctx.close();

  // ---- 4) Die Ankuendigung ---------------------------------------------------------------------
  const d = await lauf(browser, {});
  await d.page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await d.page.waitForTimeout(700);
  const quelle = fsF.readFileSync(SPIELDATEI, 'utf8');
  merke('4a: der Kartenmenue-Grund kuendigt Flugzeit und Flottenslot an, bevor geklickt wird',
    /ein Transportverband fliegt hin und zurück/.test(quelle) && /belegt so lange einen Flottenslot/.test(quelle),
    { gefunden: /ein Transportverband fliegt hin und zurück/.test(quelle) });
  merke('4b: kein Skriptfehler', d.errs.length === 0 && a.errs.length === 0 && b.errs.length === 0 && c.errs.length === 0,
    { fehler: [].concat(a.errs, b.errs, c.errs, d.errs).slice(0,2) });
  await d.ctx.close();

  await browser.close();
  if (GEGENPROBE){
    const soll = MUSS_FALLEN[GEGENPROBE] || [];
    const gefallen = soll.filter(n => ergebnis[n] === false);
    console.log('GEGENPROBE ' + GEGENPROBE + ': ' + gefallen.length + '/' + soll.length + ' der Pflichtliste gefallen (' +
      soll.map(n => n + '=' + (ergebnis[n] === false ? 'rot' : 'gruen')).join(' ') + ')');
    if (gefallen.length !== soll.length){
      console.log('FAIL - Gegenprobe unvollstaendig: ' + soll.filter(n => ergebnis[n] !== false).join(', ') + ' blieben gruen');
      process.exitCode = 1; return;
    }
    process.exitCode = 0; return;
  }
  ende();
})().catch(e => { console.error('FAIL - Abbruch:', e); process.exit(1); });
