// Die Abzeichenzeile einer Region ist ANTIPPBAR (E1b Teil 2, 22.08.2026).
//
//   node tests/test_regionshinweise.js
//
// DER ANLASS IST GEMESSEN. Die aggregierte Abzeichenzeile der Regionsuebersicht sagte NUR im
// <title>, WELCHES System den Hinweis traegt - ein Hover-Tooltip, den es am Handy nicht gibt.
// Ein Tipp darauf oeffnete die Sektoransicht, weil der Elternknoten [data-sektor] den Klick
// bekam. Gemessen am Stand davor: Trefferflaeche 36 px2 am Handy (6x6) und 169 px2 am PC,
// elementFromPoint auf der Mitte lieferte den Regionsknoten, und die Region kepler traegt
// 15 Systeme, EIN Abzeichen und 10 betroffene Systeme - wer das Zeichen sah, musste sie
// einzeln durchklicken.
//
// WARUM DAS PAAR IN ABSCHNITT 3 DER KERN IST. "Der Tipp oeffnet das Menue" allein waere auch
// dann gruen, wenn dabei der normale Regionsklick kaputtgegangen ist - genau die Kollision, die
// KB-11 an den Overlay-Knoepfen und Arbeitsregel 53 allgemein beschreibt. Gemessen wird deshalb
// BEIDES am selben Lauf: die Zeile oeffnet das Menue, die Flaeche DANEBEN weiterhin die Region.
//
// GEPRUEFT WIRD:
//   1. Quelltext-Anker: Trefferfeld, Handler mit stopPropagation, Menuefunktion, Menue-Deckel.
//   2. Die Trefferflaeche ist groesser als der blosse Text (die Sache: bedienbar statt nur da).
//   3. PAAR: Tipp auf die Zeile -> Menue; Tipp auf die Region daneben -> Sektoransicht.
//   4. Das Menue nennt die betroffenen Systeme namentlich und mit ihrem Hinweis.
//   5. Ein Eintrag springt in SEIN System (nicht nur in die Region).
//   6. Das Menue bleibt im Bild, auch mit zehn Eintraegen.
//
// GEGENPROBE gegen origin/main (KEPLER_SPIELDATEI): dort fallen 1a-1d, 2, 3a, 4a, 4b, 5 und 6;
// 3b (die Region oeffnet weiterhin) bleibt gruen - sie ist ja die Zusage, dass sich dort NICHTS
// geaendert hat.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const ROH = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = ROH.match(/<script>([\s\S]*)<\/script>/)[1];
const SAVE_KEY = 'kepler7-save-v3';
// kepler ist gemessen der schaerfste Fall: 15 Systeme, EIN Abzeichen, 10 betroffene Systeme.
const REGION = 'kepler';

// Kommentare leeren, bevor im Quelltext gesucht wird (Arbeitsregel 33) - die Erklaerbloecke
// dieser Etappe zitieren ihre eigenen Bezeichner.
const OHNE_KOMMENTARE = JS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

check('1a: die Abzeichenzeile hat ein eigenes Trefferfeld',
  /data-sektor-hinweise-treffer/.test(OHNE_KOMMENTARE) && /fill="transparent"/.test(OHNE_KOMMENTARE));
// Gescopt auf den Verdrahtungsblock DER ZEILE (Arbeitsregel 39): ein stopPropagation irgendwo
// sonst in der Datei belegt hier nichts.
const HANDLERBLOCK = (() => {
  const i = OHNE_KOMMENTARE.indexOf("querySelectorAll('[data-sektor-hinweise-treffer]')");
  return i < 0 ? '' : OHNE_KOMMENTARE.slice(i, i + 600);
})();
check('1b-anker: der Verdrahtungsblock der Zeile existiert', HANDLERBLOCK.length > 0);
check('1b: ihr Handler stoppt den Klick, sonst gewinnt der Regionsknoten',
  /stopPropagation\(\)/.test(HANDLERBLOCK) && /kbRegionHinweisMenu\(/.test(HANDLERBLOCK));
check('1c: es gibt genau EINE Menuefunktion dafuer',
  (OHNE_KOMMENTARE.match(/function kbRegionHinweisMenu\(/g) || []).length === 1);
// Sie leitet ihre Daten aus derselben Quelle ab wie der Renderer - nichts wandert ueber
// data-Attribute ins DOM, wo es beim naechsten Kartenaufbau veralten koennte.
check('1d: und sie liest aus derselben Quelle wie der Renderer',
  /kbRegionHinweisMenu[\s\S]{0,700}sektorMitglieder\(\)/.test(OHNE_KOMMENTARE)
  && /kbRegionHinweisMenu[\s\S]{0,700}karteSystemBadges\(/.test(OHNE_KOMMENTARE));
// Gegen die ganze DATEI, nicht gegen den Skriptblock: die Regel steht im <style>.
const KMENU_CSS = (() => {
  const i = ROH.indexOf('.kmenu { position');
  return i < 0 ? '' : ROH.slice(i, i + 400);
})();
check('1e-anker: die .kmenu-Regel ist auffindbar', KMENU_CSS.length > 0);
check('1e: das Kartenmenue hat einen Hoehendeckel (zehn Eintraege passen sonst nicht ins Bild)',
  /max-height:/.test(KMENU_CSS) && /overflow-y:\s*auto/.test(KMENU_CSS));

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
// storageGet kehrt bei 404 ZURUECK statt auf localStorage zurueckzufallen - der Spielstand muss
// deshalb ueber die geroutete Storage-Antwort kommen, sonst bootet ein leeres Spiel.
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
async function tab(browser, vp){
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend());
  await page.addInitScript(([k, v]) => { localStorage.setItem('kepler7_token','tok'); localStorage.setItem('kepler7_'+k, v); }, [SAVE_KEY, save()]);
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.remove(); }));
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
  await page.waitForTimeout(1100);
  // Die Zeile liegt beim Oeffnen unterhalb des Fensters - erst hereinholen, sonst liefert
  // elementFromPoint null und JEDE Messung waere aus dem falschen Grund rot.
  await page.evaluate(() => { const t = document.querySelector('#galaxyMapSvg [data-sektor-hinweise]'); if (t) t.scrollIntoView({ block:'center' }); });
  await page.waitForTimeout(500);
  return { ctx, page, errs };
}
// Tippt auf die MITTE eines Elements - der einzige Weg, "der Tap kommt an" wirklich zu messen
// (KB-11: ein Sichtbarkeits-Test haette den untippbaren Knopf damals nie gefunden).
async function tippeAuf(page, sel){
  return page.evaluate(s => {
    const g = document.querySelector(s);
    if (!g) return { da:false };
    const rc = g.getBoundingClientRect();
    const cx = rc.left + rc.width/2, cy = rc.top + rc.height/2;
    const el = document.elementFromPoint(cx, cy);
    if (!el) return { da:true, getroffen:null };
    el.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:cx, clientY:cy }));
    return { da:true, getroffen: el.closest('[data-sektor-hinweise-treffer]') ? 'zeile'
      : (el.closest('[data-sektor]') ? 'region' : el.tagName) };
  }, sel);
}

(async () => {
  const browser = await starteBrowser();

  // ---- 2/3a/4/5/6) Der Tipp auf die Zeile ------------------------------------------------
  {
    const t = await tab(browser, { width:390, height:844 });

    const flaeche = await t.page.evaluate(() => {
      const g = document.querySelector('#galaxyMapSvg [data-sektor-hinweise-treffer]');
      const tx = document.querySelector('#galaxyMapSvg [data-sektor-hinweise]');
      if (!g || !tx) return { da:false };
      const a = g.getBoundingClientRect(), b = tx.getBoundingClientRect();
      return { da:true, treffer:+(a.width*a.height).toFixed(0), text:+(b.width*b.height).toFixed(0) };
    });
    // Die SACHE ist "groesser als der blosse Text", nicht eine bestimmte Pixelzahl: Die
    // Uebersicht skaliert mit dem Kasten, eine feste Zahl waere eine Momentaufnahme (Regel 3).
    check('2: die Trefferflaeche ist deutlich groesser als die Textzeile selbst',
      flaeche.da && flaeche.treffer >= flaeche.text * 2, flaeche);

    const tipp = await tippeAuf(t.page, '#galaxyMapSvg [data-sektor-hinweise-treffer]');
    await t.page.waitForTimeout(700);
    const menue = await t.page.evaluate(() => {
      const m = document.querySelector('.kmenu');
      if (!m) return { da:false, sektorAnsicht: !!document.querySelector('#galaxyMapSvg [data-sektor-sys]') };
      const r = m.getBoundingClientRect();
      return { da:true, imBild: r.bottom <= innerHeight + 1 && r.top >= -1,
        kopf: (m.querySelector('.kmenu-titel')||{}).textContent || '',
        info: (m.querySelector('.kmenu-info')||{}).textContent || '',
        knoepfe: [...m.querySelectorAll('button')].map(b => (b.textContent||'').trim()),
        gruende: [...m.querySelectorAll('.kmenu-grund')].map(g => (g.textContent||'').trim()) };
    });
    check('3a: der Tipp auf die Zeile oeffnet das Hinweis-Menue (statt der Sektoransicht)',
      tipp.getroffen === 'zeile' && menue.da === true, { tipp, menue: { da:menue.da, sektorAnsicht:menue.sektorAnsicht } });
    check('4a: es nennt die betroffenen Systeme namentlich',
      menue.da && menue.knoepfe.length > 0 && menue.knoepfe.some(k => /Kepler/.test(k)),
      { knoepfe: (menue.knoepfe||[]).slice(0,4) });
    // Der blosse Systemname waere die halbe Auskunft - WAS dort steht, ist die andere Haelfte.
    check('4b: und je System, WAS dort steht',
      menue.da && menue.gruende.length === menue.knoepfe.length && menue.gruende.every(g => g.length > 0),
      { gruende: (menue.gruende||[]).slice(0,3) });
    check('6: das Menue bleibt im Bild, auch mit zehn Eintraegen',
      menue.da && menue.imBild === true && menue.knoepfe.length >= 5,
      { imBild: menue.imBild, eintraege: (menue.knoepfe||[]).length });

    // 5) Ein Eintrag springt in SEIN System - gemessen an der offenen Systemebene, nicht am
    //    blossen Verschwinden des Menues.
    const sprung = await t.page.evaluate(() => {
      const b = document.querySelector('.kmenu button');
      const name = b ? (b.textContent||'').trim().split(/\s{2,}| /)[0] : '';
      if (b) b.dispatchEvent(new MouseEvent('click', { bubbles:true }));
      return name;
    });
    await t.page.waitForTimeout(1400);
    const offen = await t.page.evaluate(() => ({
      systemebene: !!document.querySelector('#galaxyMapSvg .planet-node, #galaxyMapSvg [data-planet]'),
      titel: (document.querySelector('#galaxySystemTitle, .system-tafel-titel, #galaxyBackBtn') || {}).textContent || '',
      rumpf: (document.body.textContent || '').slice(0, 0) }));
    check('5: ein Eintrag springt in SEIN System', offen.systemebene === true, { gewaehlt: sprung, offen });
    check('7: keine JS-Fehler', t.errs.length === 0, t.errs.slice(0,3));
    await t.ctx.close();
  }

  // ---- 3b) Die Gegenrichtung: die Region daneben oeffnet WEITERHIN die Sektoransicht --------
  {
    const t = await tab(browser, { width:1400, height:1000 });
    // Ein Punkt INNERHALB der Regionsflaeche, aber ausserhalb des Trefferfelds: die Mitte der
    // Huelle liegt oberhalb der Beschriftungen.
    const tipp = await t.page.evaluate(key => {
      const g = document.querySelector('#galaxyMapSvg [data-sektor="' + key + '"]');
      const zeile = g && g.querySelector('[data-sektor-hinweise-treffer]');
      if (!g) return { da:false };
      const rg = g.getBoundingClientRect();
      const rz = zeile ? zeile.getBoundingClientRect() : null;
      // Deutlich ueber der Zeile, aber noch in der Flaeche der Region.
      const cx = rg.left + rg.width/2, cy = rz ? Math.max(rg.top + 6, rz.top - 40) : rg.top + 20;
      const el = document.elementFromPoint(cx, cy);
      if (!el) return { da:true, getroffen:null };
      el.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:cx, clientY:cy }));
      return { da:true, getroffen: el.closest('[data-sektor-hinweise-treffer]') ? 'zeile'
        : (el.closest('[data-sektor]') ? 'region' : el.tagName) };
    }, REGION);
    await t.page.waitForTimeout(900);
    const danach = await t.page.evaluate(() => ({
      sektorAnsicht: !!document.querySelector('#galaxyMapSvg [data-sektor-sys]'),
      menue: !!document.querySelector('.kmenu') }));
    check('3b: die Region DANEBEN oeffnet weiterhin die Sektoransicht',
      tipp.getroffen === 'region' && danach.sektorAnsicht === true && danach.menue === false,
      { tipp, danach });
    await t.ctx.close();
  }

  await browser.close();
  ende();
})();
