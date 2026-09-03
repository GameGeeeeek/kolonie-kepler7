// Ein uebervolles Kartenmenue laesst sich scrollen (03.09.2026).
//
//   node tests/test_kartenmenue_scrollen.js
//
// DER ANLASS IST GEMESSEN. Spieler-Report Sascha zum eigenen Vorposten: "beim 2. Feldlager von
// mir kann ich draufklicken, aber die Liste kann nicht runter scrollen." Nachgemessen am
// Handyformat 390x844: Das Menue hat scrollHeight 590 gegen clientHeight 420 - 170 px Inhalt
// stehen unter der Kante, die Bildlaufleiste ist sichtbar, und trotzdem kam niemand hin.
//
// DIE URSACHE WAR EINE ZEILE, DIE ZWEI DINGE AUF EINMAL TAT:
//     window.addEventListener('scroll', closeKarteMenu, true);
// Gemeint war: Scrollt die SEITE, verliert das fixe Menue seinen Marker und gehoert geschlossen.
// Getroffen hat es auch das Scrollen IM Menue. Scroll-Ereignisse steigen nicht auf - aber die
// EINFANGPHASE laeuft durch window, und capture:true haengt genau dort. Solange die Menues zwei
// bis fuenf Eintraege hatten, war das folgenlos; mit dem Hoehendeckel (max-height/overflow-y,
// E1b-2) und dem gewachsenen Vorposten-Menue (sechs Eintraege, Begruendungen, Infoblock) wurde
// daraus eine unerreichbare untere Haelfte - "Vorposten aufgeben" und "Projekte" darunter.
//
// DIE UEBERTRAGBARE FALLE: Ein Lauscher mit capture:true am window sieht JEDES gleichnamige
// Ereignis der ganzen Seite, auch die aus dem eigenen Aufbau. Wer so einen Lauscher schreibt,
// muss sagen, WESSEN Ereignis er meint - hier ueber e.target.
//
// GEPRUEFT WIRD (Verhalten, nicht Beschriftung):
//   1. Quelltext-Anker: Deckel, overscroll-behavior, die Zielpruefung im Lauscher.
//   2. Das Menue laeuft im Testfall wirklich ueber (sonst belegen 3 und 4 nichts).
//   3. Mausrad ueber dem Menue: es SCROLLT und bleibt offen.
//   4. Ein Wisch (scrollTop, derselbe Ereignisweg wie am Handy): dito.
//   5. GEGENSTUECK: Scrollt die SEITE, schliesst es weiterhin.
//   6. GEGENSTUECK: Scrollt ein anderer Kasten der Seite, schliesst es weiterhin.
//
// GEGENPROBE gegen origin/main (KEPLER_SPIELDATEI=<alte Datei>): dort fallen gemessen 1b, 1c,
// 3a, 3b, 4a und 4b. 2, 5 und 6 bleiben gruen - genau das ist ihre Zusage: an der Seiten- und
// Fremdscroll-Reaktion und am Deckel hat sich NICHTS geaendert.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const ROH = fs.readFileSync(SPIELDATEI, 'utf8');
const SAVE_KEY = 'kepler7-save-v3';

// ---------------------------------------------------------------- 1. Quelltext-Anker
const KMENU_CSS = (() => {
  const i = ROH.indexOf('.kmenu { position');
  return i < 0 ? '' : ROH.slice(i, i + 400);
})();
check('1-anker: die .kmenu-Regel ist auffindbar', KMENU_CSS.length > 0);
check('1a: der Hoehendeckel steht weiterhin (ohne ihn gibt es nichts zu scrollen)',
  /max-height:/.test(KMENU_CSS) && /overflow-y:\s*auto/.test(KMENU_CSS));
// Ohne diese Zeile scrollt am unteren Ende der Liste die SEITE weiter - und die schliesst das
// Menue dann voellig zu Recht. Der Spieler saehe wieder "geht nicht", nur eine Zeile spaeter.
check('1b: die Liste haengt am Ende nicht in die Seite durch',
  /overscroll-behavior:\s*contain/.test(KMENU_CSS));
// Gescopt auf den Lauscher selbst (Arbeitsregel 39), Kommentare vorher entfernt (Regel 33) -
// dieser Erklaerblock hier zitiert seine eigenen Bezeichner.
const OHNE_KOMMENTARE = ROH.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const LAUSCHER = (() => {
  const i = OHNE_KOMMENTARE.indexOf("window.addEventListener('scroll'");
  return i < 0 ? '' : OHNE_KOMMENTARE.slice(i, i + 320);
})();
check('1c-anker: der Scroll-Lauscher des Kartenmenues ist auffindbar', LAUSCHER.length > 0);
check('1c: er fragt, WESSEN Scrollen es war, statt jedes zu schliessen',
  /karteMenuEl\.contains\(e\.target\)/.test(LAUSCHER) && /closeKarteMenu\(\)/.test(LAUSCHER));

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
function backend(){
  return async r => {
    const p = r.request().url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null,
      unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[], alienNester:[] });
    if (p === 'storage/' + SAVE_KEY) return j({ value: save(), version: 1 });
    if (p.startsWith('storage/')) return j({ e:1 }, 404);
    return j({ ok:true });
  };
}

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport: { width:390, height:844 } });
  const page = await ctx.newPage();
  await page.route('**/api/**', backend());
  await page.addInitScript(([k, v]) => { localStorage.setItem('kepler7_token','tok'); localStorage.setItem('kepler7_'+k, v); }, [SAVE_KEY, save()]);
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.remove(); }));
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
  await page.waitForTimeout(1100);

  // Als uebervolles Menue dient die Abzeichenzeile der Region kepler: gemessen zehn Eintraege -
  // derselbe Fall, fuer den der Hoehendeckel ueberhaupt eingebaut wurde. Ein Vorposten braeuchte
  // Serverzustand; die Sperre sass ohnehin im gemeinsamen Traeger, nicht im Vorposten-Menue.
  async function oeffne(){
    // Erst schliessen und die Zeile ins Bild holen: ein offenes Menue verdeckt sie sonst, und
    // elementFromPoint traefe einen Menue-Knopf statt der Zeile (so ging der erste Anlauf daneben).
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => { const t = document.querySelector('#galaxyMapSvg [data-sektor-hinweise]'); if (t) t.scrollIntoView({ block:'center' }); });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const g = document.querySelector('#galaxyMapSvg [data-sektor-hinweise-treffer]');
      if (!g) return;
      const rc = g.getBoundingClientRect();
      const cx = rc.left + rc.width/2, cy = rc.top + rc.height/2;
      const el = document.elementFromPoint(cx, cy);
      if (el) el.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:cx, clientY:cy }));
    });
    await page.waitForTimeout(600);
  }
  const zustand = () => page.evaluate(() => {
    const m = document.querySelector('.kmenu');
    if (!m) return { da:false };
    const r = m.getBoundingClientRect();
    return { da:true, scrollTop:m.scrollTop, ueberlauf:m.scrollHeight - m.clientHeight,
             mitte:[Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)] };
  });

  // -------------------------------------------------------------- 2. Der Testfall laeuft ueber
  await oeffne();
  const a0 = await zustand();
  // Ohne echten Ueberlauf waeren 3 und 4 gruen, ohne irgendetwas zu belegen (Arbeitsregel 62).
  check('2: das geoeffnete Menue laeuft wirklich ueber (sonst belegt der Rest nichts)',
    a0.da === true && a0.ueberlauf > 40, a0);

  // -------------------------------------------------------------- 3. Mausrad
  if (a0.da){ await page.mouse.move(a0.mitte[0], a0.mitte[1]); await page.mouse.wheel(0, 120); }
  await page.waitForTimeout(400);
  const a1 = await zustand();
  check('3a: das Rad ueber dem Menue schliesst es NICHT', a1.da === true, a1);
  check('3b: und es scrollt dabei wirklich', a1.da === true && a1.scrollTop > 0, { scrollTop: a1.scrollTop });

  // -------------------------------------------------------------- 4. Wisch am Handy
  await oeffne();
  const b0 = await zustand();
  await page.evaluate(() => { const m = document.querySelector('.kmenu'); if (m) m.scrollTop = 150; });
  await page.waitForTimeout(400);
  const b1 = await zustand();
  check('4a: ein Wisch im Menue schliesst es NICHT', b0.da === true && b1.da === true, { vorher:b0.da, nachher:b1.da });
  check('4b: und der Inhalt darunter wird erreichbar', b1.da === true && b1.scrollTop > 0, { scrollTop: b1.scrollTop });

  // -------------------------------------------------------------- 5./6. Die Gegenstuecke
  // Ohne diese beiden waere "schliesst nicht mehr beim Scrollen" die stille Nebenwirkung der
  // Reparatur: Das Menue ist position:fixed und stuende nach einem Seitenscroll neben seinem
  // Marker (Arbeitsregel 53 - die Kollision misst man im selben Lauf, nicht spaeter).
  await oeffne();
  const c0 = await zustand();
  await page.evaluate(() => window.scrollBy(0, 200));
  await page.waitForTimeout(400);
  const c1 = await zustand();
  check('5: scrollt die SEITE, schliesst das Menue weiterhin',
    c0.da === true && c1.da === false, { vorher:c0.da, nachher:c1.da });

  await oeffne();
  const d0 = await zustand();
  await page.evaluate(() => {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;width:50px;height:40px;overflow-y:auto;z-index:1;';
    box.innerHTML = '<div style="height:400px"></div>';
    document.body.appendChild(box);
    box.scrollTop = 100;
  });
  await page.waitForTimeout(400);
  const d1 = await zustand();
  check('6: scrollt ein anderer Kasten der Seite, schliesst es ebenfalls weiterhin',
    d0.da === true && d1.da === false, { vorher:d0.da, nachher:d1.da });

  await browser.close();
  ende();
})();
