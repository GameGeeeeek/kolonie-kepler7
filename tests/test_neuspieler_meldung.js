// Die Neue-Spieler-Meldung im Spiel: Schalter und Postfach-Zeile (22.08.2026, Auftrag Sascha).
//
// Das Backend meldet den Typ 'neuer-spieler' an das Betreiberkonto, sobald ein neu angelegtes Konto
// die Kolonie zum ersten Mal oeffnet. Im Frontend braucht das DREI Stellen, und jede fehlende
// ergibt einen eigenen Fehler:
//   - notifPrefsCache ohne 'neuspieler' -> der Schalter steht beim Laden auf "aus", obwohl der
//     Server "an" meldet (genau dieser Fehler war am 02.08.2026 ein Spielerbericht);
//   - kein Schalter -> die Kategorie ist nicht abschaltbar. Das waere hier besonders teuer: Sascha
//     hat die Buendelung ausdruecklich abgewaehlt, und /api/register laesst gemessen 1.440 Konten
//     je Tag und IP zu - der Schalter ist die einzige Notbremse, wenn das Postfach zulaeuft;
//   - kein NOTIF_EVENT_INFO-Eintrag -> das Postfach zeigt Glocke und das Wort "Ereignis".
//
// DER SCHALTER IST NUR FUER DAS BETREIBERKONTO SICHTBAR, und Abschnitt 1 misst das als PAAR. Jede
// Haelfte allein waere wertlos: "der Fremde sieht ihn nicht" ist auch dann gruen, wenn ihn NIEMAND
// sieht, und "der Betreiber sieht ihn" auch dann, wenn ihn JEDER sieht.
//
// GEMESSEN WIRD SICHTBARKEIT, NICHT EXISTENZ (Regel 55): Die Zeile steht mit style="display:none"
// im Markup und wird erst per JS eingeblendet - ein Test auf "das Element gibt es" waere in beiden
// Laeufen gruen.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

// Statisch: der Vorgabe-Zwischenspeicher MUSS den Schluessel kennen. Keine Doppelung zu Abschnitt 2
// (dort meldet der Server false) - hier geht es um den Fall, dass er gar nichts sagt.
check('0: notifPrefsCache kennt die Kategorie neuspieler', /notifPrefsCache = \{[^}]*neuspieler:true/.test(JS));

const PREFS = { enabled:true, messages:true, pact:true, weltboss:true, raid:true, allianceraid:true,
                alliancebase:true, chat:true, patchnotes:true, application:true, spy:true,
                attack:true, leaderboard:true, completion:true, neuspieler:true };

function backend(store, zustand){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s2=200) => r.fulfill({status:s2, contentType:'application/json', body:JSON.stringify(o)});
  if (p === 'health') return j({ok:true});
  if (p === 'me') return j({userId:'u',username:zustand.name,homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:false,tier:null}});
  if (p === 'reports') return j({reports:[]});
  if (p === 'pending-rewards/claim') return j({reward:null});
  if (p === 'storage-list') return j({keys:[]});
  if (p === 'notification-prefs'){
    if (req.method() === 'POST'){
      try { zustand.gesendet.push(JSON.parse(req.postData())); } catch(e){}
      return j(Object.assign({}, zustand.prefs));
    }
    return j(Object.assign({}, zustand.prefs));
  }
  if (p === 'notifications') return j({ notifications: zustand.postfach });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()).value; } catch(e){} return j({ok:true,version:2}); }
    if (store[k] !== undefined) return j({key:k,value:store[k],version:1});
    return j({e:1},404);
  }
  return j([]);
};}

const jetzt = Date.now();
const SAVE = JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9000, erz:9000, kristalle:5000, deuterium:2000, forschungspunkte:500},
  buildings:{solar:8, mine:8, lager:6, werft:4}, research:{}, constructionQueue:[],
  fleet:{jaeger:20, missions:[]}, colonies:{}, activeBasePlanet:'home',
  player:{id:'u', name:'A', avatarKey:null}, xp:1000, credits:5000, buffs:[],
  lastTick:jetzt, colonyNames:{}, modules:{}, shipModules:{},
  // Ereignis-Uhren pinnen (Regel 18) - ein Planeten-Ereignis waehrend der Messung schiebt die
  // Einstellungen-Liste und kann eine Sichtbarkeitsmessung kippen.
  nextPlanetEventCheck: jetzt + 3600000, nextTraderCheck: jetzt + 3600000 });

// Der Weg zu den Einstellungen ist der KOPFKNOPF, nicht ein Reiter: Es gibt kein
// `.tab-btn[data-tab="einstellungen"]` - die zwoelf Reiterknoepfe heissen basis, verteidigung,
// forschung, flotte, expedition, karte, galaxie, allianz, offiziere, markt, punkte, fortschritt.
// Ein `if (b) b.click()` auf einen geratenen Namen schluckt den Fehlgriff STILL, und ein Test, der
// danach nur `className` liest, bleibt gruen, obwohl der Reiter nie aufging (Regel 4/28). Genau so
// war der erste Entwurf hier, und `1e-vorab` hat es gemeldet.
// switchTab() selbst scheidet aus - die Funktion lebt im Modulscope und ist von aussen nicht
// aufrufbar (Regel 47); gedrueckt wird der Knopf, den auch ein Spieler drueckt.
const overlaysWeg = () => {
  ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
};
const oeffneEinstellungen = () => {
  ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
  const b = document.getElementById('headerProfileBtn');
  if (b) b.click();
};
const oeffneBerichte = () => {
  ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
  const b = document.getElementById('headerReportsBtn');
  if (b) b.click();
};
// Sichtbarkeit heisst: das Element ist im Layout und hat eine Hoehe. offsetParent allein reicht
// nicht (ein Element mit Hoehe 0 haette eines), eine Hoehe allein auch nicht.
const schalterLage = () => {
  const el = document.querySelector('[data-notif-cat="neuspieler"]');
  if (!el) return { da:false };
  const zeile = el.closest('.card-row');
  const r = zeile ? zeile.getBoundingClientRect() : null;
  return { da:true, sichtbar: !!(zeile && zeile.offsetParent !== null && r.height > 0),
           hoehe: r ? Math.round(r.height) : 0, text: zeile ? zeile.textContent.trim() : '' };
};

async function seite(browser, zustand){
  const ctx = await browser.newContext({ viewport:{width:1280,height:900} });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend({ 'kepler7-save-v3': SAVE }, zustand));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(3000);
  return { ctx, page, errs };
}

(async () => {
  const browser = await starteBrowser();

  // ---------------------------------------------- 1) PAAR: nur der Betreiber sieht den Schalter
  let alsBetreiber = null, alsFremder = null;
  {
    const zustand = { name:'GameGeeeeek', prefs: Object.assign({}, PREFS), gesendet: [], postfach: [] };
    const { ctx, page, errs } = await seite(browser, zustand);
    await page.evaluate(oeffneEinstellungen);
    await page.waitForTimeout(1500);
    const offen = await page.evaluate(() => {
      const p = document.getElementById('tab-einstellungen');
      return !!(p && p.classList.contains('active'));
    });
    check('1-vorab: der Einstellungen-Reiter ist offen', offen, { offen });
    alsBetreiber = await page.evaluate(schalterLage);
    check('1a: der Betreiber SIEHT den Schalter (nicht nur: er existiert)',
      alsBetreiber.da && alsBetreiber.sichtbar, alsBetreiber);
    check('1b: er ist beschriftet und sagt, dass er nur das Betreiberkonto betrifft',
      /Neue Spieler/.test(alsBetreiber.text) && /Betreiberkonto/.test(alsBetreiber.text),
      alsBetreiber.text);

    // Er muss auch WIRKEN - "der Knopf ist da" waere auch bei einem toten Knopf gruen.
    await page.evaluate(() => { const el = document.querySelector('[data-notif-cat="neuspieler"]'); if (el) el.click(); });
    await page.waitForTimeout(800);
    const letzte = zustand.gesendet[zustand.gesendet.length-1];
    check('1c: das Umlegen schickt neuspieler:false an den Server',
      !!letzte && letzte.neuspieler === false, letzte);
    check('1d: keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }
  {
    const zustand = { name:'Anna', prefs: Object.assign({}, PREFS), gesendet: [], postfach: [] };
    const { ctx, page, errs } = await seite(browser, zustand);
    await page.evaluate(oeffneEinstellungen);
    await page.waitForTimeout(1500);
    alsFremder = await page.evaluate(schalterLage);
    check('1e: ein anderes Konto sieht ihn NICHT', !alsFremder.sichtbar, alsFremder);
    // Die Gegenkontrolle: Der Reiter war wirklich offen und andere Schalter STEHEN da - sonst
    // waere 1e auch dann gruen, wenn die ganze Liste gar nicht gerendert wurde (Regel 28).
    const andere = await page.evaluate(() => {
      const el = document.querySelector('[data-notif-cat="attack"]');
      const z = el && el.closest('.card-row');
      return !!(z && z.offsetParent !== null && z.getBoundingClientRect().height > 0);
    });
    check('1e-vorab: die Einstellungen-Liste ist bei ihm ueberhaupt sichtbar', andere, { andereSchalterSichtbar: andere });
    check('1f: keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }
  // Erst das PAAR sagt etwas aus.
  check('1g: das PAAR - sichtbar beim Betreiber, unsichtbar beim Fremden',
    !!alsBetreiber && !!alsFremder && alsBetreiber.sichtbar && !alsFremder.sichtbar,
    { betreiber: alsBetreiber && alsBetreiber.sichtbar, fremder: alsFremder && alsFremder.sichtbar });

  // -------------------------------- 2) meldet der Server false, steht der Schalter auf AUS
  {
    const zustand = { name:'GameGeeeeek', prefs: Object.assign({}, PREFS, { neuspieler:false }), gesendet: [], postfach: [] };
    const { ctx, page } = await seite(browser, zustand);
    await page.evaluate(oeffneEinstellungen);
    await page.waitForTimeout(1500);
    const aus = await page.evaluate(() => {
      const el = document.querySelector('[data-notif-cat="neuspieler"]');
      const ein = document.querySelector('[data-notif-cat="attack"]');
      return { neu: el ? el.className : null, vergleich: ein ? ein.className : null };
    });
    // Gegen eine EINGESCHALTETE Kategorie derselben Liste verglichen statt gegen einen geratenen
    // Klassennamen (Regel 4): Der Unterschied muss sichtbar sein, wie er auch immer heisst.
    check('2a: bei neuspieler:false steht er anders als ein eingeschalteter derselben Liste',
      aus.neu !== null && aus.neu !== aus.vergleich, aus);
    await ctx.close();
  }

  // ------------------------------------------- 3) die Postfach-Zeile zeigt echten Text
  {
    const zustand = { name:'GameGeeeeek', prefs: Object.assign({}, PREFS), gesendet: [], postfach: [
      { id:'n1', type:'neuer-spieler', time: Date.now()-60000, payload:{ username:'Kolonist7', gesamt:12 }, ziel:'galaxie:rang' }
    ]};
    const { ctx, page, errs } = await seite(browser, zustand);
    await page.evaluate(oeffneBerichte);
    await page.waitForTimeout(1500);
    // Vorab: Der Reiter ist wirklich offen. Ohne diese Zeile waere 3a "unsichtbar" und man wuesste
    // nicht, ob die Meldung fehlt oder nur der Reiter zu ist (Regel 37).
    const reiterOffen = await page.evaluate(() => {
      const p = document.getElementById('tab-berichte');
      return !!(p && p.classList.contains('active'));
    });
    check('3-vorab: der Berichte-Reiter ist offen', reiterOffen, { offen: reiterOffen });

    const zeile = await page.evaluate(() => {
      const el = document.querySelector('[data-notif-go="galaxie:rang"]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { text: el.textContent.trim(), klickbar: el.getAttribute('role') === 'button',
               sichtbar: el.offsetParent !== null && r.height > 0 };
    });
    check('3a: die Meldung erscheint im Postfach, sichtbar und anklickbar',
      !!zeile && zeile.sichtbar && zeile.klickbar, zeile);
    check('3b: sie nennt den Namen des Neulings und die Gesamtzahl',
      !!zeile && /Kolonist7/.test(zeile.text) && /12/.test(zeile.text), zeile && zeile.text);
    // Der eigentliche Punkt: OHNE NOTIF_EVENT_INFO-Eintrag stuende hier das Wort "Ereignis" - eine
    // Zeile, die dasteht und nichts sagt. Genau das faellt niemandem auf, weil nichts bricht.
    check('3c: sie ist NICHT der Sammel-Rueckfall "Ereignis"',
      !!zeile && !/^Ereignis/.test(zeile.text.replace(/^\s+/, '')), zeile && zeile.text);
    // Und sie behauptet nicht mehr, als sie belegen kann: Der ausloesende erste Save feuert
    // automatisch beim ersten Boot, also heisst es "geoeffnet" und nicht "spielt".
    check('3d: sie sagt "geoeffnet" und behauptet kein Spielen',
      !!zeile && /geöffnet/.test(zeile.text), zeile && zeile.text);
    check('3e: keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  await browser.close();
  ende();
})();
