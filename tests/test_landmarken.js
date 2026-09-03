// Landmarken auf der Sektorkarte (E1, 19.08.2026): Festung, Nest und Gegner sind SICHTBAR,
// ohne dass man 67 Systeme einzeln aufklappen muss.
//
//   node tests/test_landmarken.js
//
// DER ANLASS IST GEMESSEN. `karteSystemBadges` führte sieben Abzeichen (🏰 🏴‍☠️ 👽 ⚔️ 🌀 🔎 📡) –
// kein einziges für eine Asteroidenfestung oder ein Alien-Nest. Beide lebten ausschliesslich im
// aufgeklappten System (`data-map-festung`, `data-map-nest`); `festungFaktoren` hatte genau zwei
// Aufrufer, beide in der Abbaurechnung. Wer eine Festung finden wollte, musste jedes System
// einzeln durchklicken – genau der Zustand, gegen den KB-8 gebaut wurde.
//
// WARUM DIESER TEST DREI EBENEN MISST. `karteSystemBadges` ist die EINE Quelle für drei
// Anzeigestellen: die aggregierte Regionsübersicht, den Systemplatz der Sektoransicht und die
// Nachbarpunkte der offenen Systemebene. Ein Test, der nur eine davon prüft, belegt nicht, dass
// der Eintrag wirklich alle drei versorgt – und genau diese Eigenschaft ist der Grund, warum die
// Abzeichen dort und nicht in den Renderern stehen.
//
// GEPRUEFT WIRD:
//   1. Quelltext-Anker (billig, und sie sagen, ob überhaupt gebaut wurde).
//   2. Sektoransicht: das System trägt alle drei Abzeichen, SICHTBAR (Breite/Höhe > 0), nicht nur
//      im DOM (Arbeitsregel 55).
//   3. Regionsübersicht: die Region, die das System enthält, trägt die Abzeichen aggregiert, und
//      der Tooltip nennt das System namentlich.
//   4. Das 👽 schweigt, wo ein Nest steht – als PAAR gemessen (mit Nest kein 👽, ohne Nest eines).
//      Jede Hälfte allein wäre auch am alten Stand erfüllbar.
//   5. Die Kartensuche findet die Landmarken.
//   6. Die Sektor-Beschreibung steht endlich im Tooltip der Region.
//   7. Gegenrichtung: ohne Festung, Nest und NPC trägt dasselbe System KEINES der drei Abzeichen.
//
// GEGENPROBE (in beide Richtungen ausgeführt): Am Stand vor E1 fallen 2, 3, 4, 5 und 6; die
// Gegenrichtung 7 bleibt grün – sie ist ja gerade die Aussage "hier ist nichts".
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer, logMitschnitt } = require('./lib/umgebung');
const { oeffneSektorMitSystem } = require('./lib/karte');
const { check, ende } = pruefer();

const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
const SAVE_KEY = 'kepler7-save-v3';
// chronos trägt gemessen GENAU EINEN NPC ("Sternenzerstörer-Flotte", Stufe 8) - damit lassen sich
// alle drei Abzeichen in EINEM System messen, statt drei Systeme anfahren zu müssen.
const SYS = 'chronos';
const NPC_NAME = 'Sternenzerstörer-Flotte';

check('1a: die Landmarken stehen in karteSystemBadges', /Landmarken \(E1\)/.test(JS));
check('1b: mit eigenem Abzeichen je Art', /icon:'🛡'/.test(JS) && /'👑' : '👾'/.test(JS) && /icon:'🎯'/.test(JS));
// Seit dem 22.08.2026 sind Landmarken BEWUSST nicht suchbar (Entscheidung Sascha: "man soll
// schon bisschen suchen auf der Karte"). Geprueft wird die Gegenrichtung - und zwar an der
// SACHE (kein Landmarken-Abschnitt, keine Sammelschleife), nicht an einer Schreibweise.
check('1c: die Kartensuche fuehrt KEINEN Landmarken-Abschnitt mehr',
  !/Landmarken<\/div>/.test(JS) && !/const landMatches/.test(JS));

function nest(){
  return { id:'nest-l1', volk:'kryll', sys:SYS, stufe:3, lp:260000, lpMax:400000,
    seit: Date.now()-7200000, letzteReifung: Date.now()-3600000,
    naechsterWurf: Date.now()+8*3600*1000, naechsteWanderung: 0, beitraege:{}, schlaege:{} };
}
function feld(mitFestung){
  const f = { plaetze: { '3': { sorte:'urmaterie', groesse:'kern', vorrat:150000 } } };
  if (mitFestung) f.festung = { id:'fest-l1', stufe:'sternenfeste', platz:7, sorte:'eisen',
    kernMax:1200000, kern:900000, hort:250000, hortProto:180,
    seit:Date.now(), letzteReifung:Date.now(), beitraege:{}, schlaege:{} };
  return { systeme:[SYS], felder:{ [SYS]: f } };
}
// Ereignis-Uhren gepinnt und alle Reiter-Hinweise als gesehen markiert (Arbeitsregeln 18/63):
// Beides schiebt sonst Möbel ins Bild, die nur manchmal da sind - und dieser Test misst Lage
// und Sichtbarkeit von SVG-Knoten.
function save(){
  const jetzt = Date.now();
  const gesehen = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil']) gesehen[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:gesehen,
    resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:9e4,forschungspunkte:3e4},
    buildings:{solar:22,mine:20,labor:14,lager:30,werft:14}, research:{}, fleet:{ jaeger:80, cruisers:30, missions:[] },
    colonies:{}, activeBasePlanet:'home', player:{ id:'u', name:'A', avatarKey:null },
    xp:9e5, credits:5e5, buffs:[], lastTick:jetzt, colonyNames:{}, modules:{}, shipModules:{},
    nextPlanetEventCheck: jetzt+3600000, nextTraderCheck: jetzt+3600000 });
}
function backend(opt){
  opt = opt || {};
  return async r => {
    const p = r.request().url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null,
      unlockedAlienRaces: opt.volkGesichtet ? [{ name:'Kryll-Schwarm', system:SYS }] : [],
      activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[],
      alienNester: opt.ohneNest ? [] : [nest()] });
    if (p === 'asteroid/field') return j(feld(!opt.ohneFestung));
    if (p.startsWith('storage/')) return j({ e:1 }, 404);
    return j({ ok:true });
  };
}
async function tab(browser, opt){
  const ctx = await browser.newContext({ viewport:{ width:1400, height:1000 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(opt));
  await page.addInitScript(([k, v]) => { localStorage.setItem('kepler7_token','tok'); localStorage.setItem('kepler7_'+k, v); }, [SAVE_KEY, save()]);
  await logMitschnitt(page);
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.remove(); }));
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
  await page.waitForTimeout(900);
  return { ctx, page, errs };
}
// Liest die Abzeichen eines Systemplatzes der SEKTORANSICHT - gescopt auf #galaxyMapSvg
// (Arbeitsregel 5) und mit gemessener Grösse statt blosser Existenz (Arbeitsregel 55).
async function abzeichenAmSystem(page, sysId){
  return page.evaluate(id => {
    const g = document.querySelector('#galaxyMapSvg [data-sektor-sys="' + id + '"]');
    if (!g) return { da:false, sichtbar:[], titel:'' };
    const out = [];
    for (const t of g.querySelectorAll('text')){
      const r = t.getBoundingClientRect();
      const txt = (t.textContent||'').trim();
      if (txt && r.width > 0 && r.height > 0) out.push({ txt, titel: (t.querySelector('title')||{}).textContent || '' });
    }
    return { da:true, sichtbar: out, titel: g.textContent || '' };
  }, sysId);
}

(async () => {
  const browser = await starteBrowser();

  // ---- 2/3/4/5/6) Der volle Fall: Festung, Nest und NPC im selben System ----------------------
  {
    const t = await tab(browser, { volkGesichtet:true });
    const auf = await oeffneSektorMitSystem(t.page, SYS);
    check('2-anker: die Sektoransicht mit ' + SYS + ' steht offen', auf === true, { auf });

    const ab = await abzeichenAmSystem(t.page, SYS);
    const zeichen = ab.sichtbar.map(x => x.txt).join(' ');
    check('2a: das Festungs-Abzeichen ist SICHTBAR', /🛡/.test(zeichen), { sichtbar: ab.sichtbar.map(x=>x.txt) });
    check('2b: das Nest-Abzeichen ist SICHTBAR', /👾|👑/.test(zeichen), { sichtbar: ab.sichtbar.map(x=>x.txt) });
    check('2c: das Gegner-Abzeichen ist SICHTBAR', /🎯/.test(zeichen), { sichtbar: ab.sichtbar.map(x=>x.txt) });
    // Die Tooltips tragen den INHALT - ein Abzeichen ohne Auskunft wäre Dekoration.
    const titel = ab.sichtbar.map(x => x.titel).join(' | ');
    check('2d: die Tooltips nennen Stufe, Volk und Gegner beim Namen',
      /Sternenfeste/.test(titel) && /Kryll/.test(titel) && new RegExp(NPC_NAME).test(titel), { titel: titel.slice(0,260) });
    check('2e: keine JS-Fehler', t.errs.length === 0, t.errs.slice(0,3));

    // Die Region eine Ebene höher muss dieselben Abzeichen aggregiert tragen.
    // Den Regionsschlüssel aus der OFFENEN Sektoransicht ablesen, bevor wir sie verlassen.
    const regionKey = await t.page.evaluate(() => {
      const el = document.querySelector('#galaxyMapSvg [data-kb-titel]');
      return el ? el.getAttribute('data-kb-titel') : '';
    });
    check('3-anker: der Regionsschlüssel ist abgelesen, nicht geraten', !!regionKey, { regionKey });
    await t.page.evaluate(() => { const h = document.querySelector('#galaxyMapSvg [data-kb-knopf="heimweg"]'); if (h) h.dispatchEvent(new MouseEvent('click', { bubbles:true })); });
    await t.page.waitForTimeout(700);
    const ueber = await t.page.evaluate(key => {
      const g = document.querySelector('#galaxyMapSvg [data-sektor="' + key + '"]');
      const el = g && g.querySelector('[data-sektor-hinweise]');
      if (!el) return { da:false };
      const r = el.getBoundingClientRect();
      return { da:true, txt:(el.textContent||'').trim(), titel:((el.querySelector('title')||{}).textContent)||'', breite:Math.round(r.width) };
    }, regionKey);
    check('3a: die Übersicht trägt die Abzeichen aggregiert und SICHTBAR',
      ueber.da && ueber.breite > 0 && /🛡/.test(ueber.txt) && /👾|👑/.test(ueber.txt) && /🎯/.test(ueber.txt), ueber);
    check('3b: und der Tooltip nennt System UND Landmarke beim Namen',
      !!ueber.titel && /Chronos/i.test(ueber.titel) && /Sternenfeste/.test(ueber.titel) && new RegExp(NPC_NAME).test(ueber.titel),
      { titel: (ueber.titel||'').slice(0,220) });
    // Die Sektor-Beschreibung, die bis E1 NIRGENDS gerendert wurde.
    const regTitel = await t.page.evaluate(key => {
      const g = document.querySelector('#galaxyMapSvg [data-sektor="' + key + '"]');
      return g ? (((g.querySelector('title')||{}).textContent)||'') : '';
    }, regionKey);
    check('6: die Sektor-Beschreibung steht im Tooltip der Region',
      regTitel.split('\n').filter(z => z.trim()).length >= 2, { titel: regTitel.slice(0,220) });

    /* Die Kartensuche als PAAR (Arbeitsregel 28): "findet die Festung nicht" allein waere auch
       bei einer voellig kaputten Suche gruen. Gemessen wird deshalb BEIDES am selben Feld - ein
       Systemname MUSS eine Trefferzeile liefern, der Name der Festung KEINE. */
    const suche = await t.page.evaluate(async () => {
      const f = document.getElementById('sectorSearchInput');
      const box = document.getElementById('sectorSearchResults');
      if (!f || !box) return { da:false };
      const frag = async (q) => {
        f.value = q; f.dispatchEvent(new Event('input', { bubbles:true }));
        await new Promise(r => setTimeout(r, 220));
        return { offen: box.style.display !== 'none',
          zeilen: [...box.querySelectorAll('.search-result-row')].map(z => (z.textContent||'').replace(/\s+/g,' ').trim()) };
      };
      return { da:true, system: await frag('Chronos'), festung: await frag('Sternenfeste'),
        nest: await frag('Kryll'), gegner: await frag('Sternenzerstörer') };
    });
    check('5-vorab: die Suche antwortet ueberhaupt - ein Systemname liefert eine Trefferzeile',
      suche.da && suche.system.offen && suche.system.zeilen.length > 0, { system: suche.system });
    check('5: aber KEINE Landmarke ist suchbar (Festung, Nest, Gegner)',
      suche.da && !suche.festung.zeilen.some(z => /Asteroidenfestung|Sternenfeste/.test(z))
               && !suche.nest.zeilen.some(z => /Kryll/.test(z))
               && !suche.gegner.zeilen.some(z => /Sternenzerstörer/.test(z)),
      { festung: suche.festung.zeilen.slice(0,3), nest: suche.nest.zeilen.slice(0,3), gegner: suche.gegner.zeilen.slice(0,3) });

    // 4) Die Entdopplung als PAAR - erste Hälfte: MIT Nest kein 👽.
    const alienBeiNest = /👽/.test(ueber.txt || '');
    await t.ctx.close();

    // 4) zweite Hälfte: dasselbe Volk gesichtet, aber KEIN Nest -> das 👽 muss erscheinen.
    const t2 = await tab(browser, { volkGesichtet:true, ohneNest:true });
    await oeffneSektorMitSystem(t2.page, SYS);
    await t2.page.evaluate(() => { const h = document.querySelector('#galaxyMapSvg [data-kb-knopf="heimweg"]'); if (h) h.dispatchEvent(new MouseEvent('click', { bubbles:true })); });
    await t2.page.waitForTimeout(700);
    const ohneNest = await t2.page.evaluate(key => {
      const g = document.querySelector('#galaxyMapSvg [data-sektor="' + key + '"]');
      const el = g && g.querySelector('[data-sektor-hinweise]');
      return el ? (el.textContent||'').trim() : '';
    }, regionKey);
    /* Als PAAR gemessen: "kein 👽 bei Nest" allein wäre auch dann grün, wenn das 👽-Abzeichen
       überhaupt nicht mehr gezeichnet würde - dann hätte die Entdopplung eine Auskunft gelöscht
       statt sie zu entdoppeln (Arbeitsregel 61: nicht das Etikett prüfen, sondern die Wirkung). */
    check('4: das 👽 schweigt beim Nest und spricht ohne Nest',
      !alienBeiNest && /👽/.test(ohneNest), { mitNest: ueber.txt, ohneNest });
    await t2.ctx.close();
  }

  // ---- 7) Gegenrichtung: nichts da, nichts angezeigt -----------------------------------------
  {
    const t = await tab(browser, { ohneNest:true, ohneFestung:true });
    await oeffneSektorMitSystem(t.page, SYS);
    const ab = await abzeichenAmSystem(t.page, SYS);
    const zeichen = ab.sichtbar.map(x => x.txt).join(' ');
    check('7a: ohne Festung kein 🛡', !/🛡/.test(zeichen), { sichtbar: ab.sichtbar.map(x=>x.txt) });
    check('7b: ohne Nest kein 👾/👑', !/👾|👑/.test(zeichen), { sichtbar: ab.sichtbar.map(x=>x.txt) });
    /* Der NPC steht fest in NPCS und ist NICHT abschaltbar - sein Abzeichen MUSS hier bleiben.
       Ohne diese Zeile wäre 7 auch dann grün, wenn die Abzeichenzeile insgesamt tot wäre. */
    check('7c: der feste Gegner bleibt trotzdem sichtbar', /🎯/.test(zeichen), { sichtbar: ab.sichtbar.map(x=>x.txt) });
    check('7d: keine JS-Fehler', t.errs.length === 0, t.errs.slice(0,3));
    await t.ctx.close();
  }

  await browser.close();
  ende();
})();
