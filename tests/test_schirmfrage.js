// UI-9: Tasten wirken nicht mehr durch Fenster hindurch - Waechter zur Schirmfrage, 14.09.2026.
//
//   node tests/test_schirmfrage.js
//   KEPLER_SPIELDATEI=<kopie> node tests/test_schirmfrage.js
//
// DIE FRAGE, um die es geht, lautet NICHT „ist die Kartenflaeche zu sehen?", sondern
// „beansprucht gerade ein Fenster den Schirm?". Der gemessene Schaden entsteht dadurch, dass ueber
// der Seite ein Fenster steht und die Taste trotzdem die Seite bedient; ob die Karte darunter im
// Bild liegt, ist belanglos - sie liegt es ohnehin nicht.
//
// DER SCHADEN, GEMESSEN am Stand vor der Reparatur (900x1000, System aufgeklappt, Kampf-
// Wiedergabe darueber): ArrowRight schob den viewBox von `327.9 150.2 201.5 225.2' auf
// `176.0 255.8 336.8 177.2', `+' weiter auf `224.1 281.2 240.5 126.6'. Und bei offenem
// Tutorial-Fenster wechselte die Ziffer `2' den Reiter auf Verteidigung.
//
// ZWEI RICHTUNGEN, und die zweite ist die wichtigere:
//   A  Mit Fenster ueber dem Schirm tun die Tasten NICHTS.
//   B  OHNE Fenster tun sie weiterhin GENAU DAS, was sie sollen. Ohne B waere „alle Tasten
//      abschalten" eine erlaubte Antwort auf A - und schlimmer als der Fehler selbst.
//
// GEGENPROBE (gemessen, beide Richtungen, Pruefnamen per diff verglichen - identisch):
//   neuer Stand -> Exit 0, alle 26 Pruefungen gruen
//   alter Stand -> Exit 1, GENAU diese elf fallen:
//     4                 der Deckungs-Waechter nennt die zwei unverbuchten Lauscher beim Namen
//     1a/1b  je Breite  die Karte bewegte sich unter der Wiedergabe
//                       (390: 272.4 288.4 143.9 112.1 -> 397.7 167.8 201.5 106.0)
//     2      je Breite  die Ziffer wechselte den Reiter unter dem Tutorial: karte -> verteidigung
//     1c     je Breite  auch bei offenem Kartenmenue bewegte sich die Karte
//     5b     je Breite  eine harte Deckschicht sperrte NICHT - es fragte ja gar nichts
//   AN BEIDEN STAENDEN GRUEN und genau deshalb wichtig: 3a, 3b, 3c (ohne Fenster wirken die
//   Tasten weiter) und 5a (pointer-events:none sperrt nicht). Ohne sie waere „alle Tasten
//   abschalten" eine erlaubte Antwort - und schlimmer als der Fehler.
//   Alter Stand: KEPLER_SPIELDATEI=<kopie von HEAD> node tests/test_schirmfrage.js
//
// DAZU EIN DECKUNGS-WAECHTER (Pruefung 4): Jeder keydown-Lauscher am document ist verbucht -
// entweder fragt er die Schirmfrage, oder er steht mit Begruendung auf der Ausnahmeliste. Ein
// neuer Lauscher, der still hinzukommt, faellt damit auf.
const { starteBrowser, SPIEL_URL, SPIELDATEI, ruhigeUhren, versionAbfangen } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const fs = require('fs');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// ---------------------------------------------------------------- 4) Deckungs-Waechter
/* Die Ausnahmen sind EINZELN begruendet, nicht pauschal. Wer hier einen Lauscher eintraegt, muss
   sagen warum - und wer einen neuen schreibt, ohne ihn einzutragen, faellt auf. */
const AUSNAHMEN = [
  { was: '_merkeSelect', grund: 'merkt nur das Ziel, aendert nichts' },
  { was: 'offen',        grund: 'gehoert der Wiedergabe selbst, gated durch ihren eigenen Offen-Zustand' },
  { was: 'escapeAusgang',grund: 'misst bereits fensterObenauf' },
  { was: 'statustafelObenauf', grund: 'misst bereits selbst' },
  { was: 'fensterLage',  grund: 'Boden der Escape-Kette - darf bei `weg` zugreifen, Begruendung steht dort' },
  { was: "role') !== 'button'", grund: 'folgt dem Fokus (e.target), nicht der Flaeche' },
  { was: "event.target.closest('[data-claim-quest],[data-quest-nav]')", grund: 'bedient ausschließlich die fokussierte Tagesaufgabe; Enter/Leertaste und Wiederholung werden geprüft' },
  { was: 'closeLoginModal', grund: 'gehoert dem Fenster selbst, gated durch dessen Offen-Zustand' },
  { was: 'closeCommandMenu(true);event.preventDefault();event.stopImmediatePropagation()',
    grund: 'Escape/Tab gehören dem Kommando-Menü selbst; Offen-Zustand UND fensterObenauf(menu) werden darunter separat ausgeführt und geprüft' },
];
{
  const html = fs.readFileSync(SPIELDATEI, 'utf8');
  const stellen = [];
  let p = html.indexOf("document.addEventListener('keydown'");
  while (p >= 0){ stellen.push(p); p = html.indexOf("document.addEventListener('keydown'", p + 1); }
  check('4-anker: die keydown-Lauscher sind auffindbar (sonst misst 4 nichts)', stellen.length >= 8, stellen.length);
  const unverbucht = [];
  for (const pos of stellen){
    const rumpf = html.slice(pos, pos + 1400);
    if (/schirmBeansprucht\(\)/.test(rumpf)) continue;                 // fragt die Schirmfrage
    if (AUSNAHMEN.some(a => rumpf.indexOf(a.was) >= 0)) continue;      // begruendete Ausnahme
    unverbucht.push(html.slice(pos, pos + 120).replace(/\s+/g, ' '));
  }
  check('4: jeder keydown-Lauscher am document ist verbucht', unverbucht.length === 0, unverbucht);

  const initVon = html.indexOf('  function initCommandShell(){');
  const initBis = html.indexOf('\n  function ', initVon + 10);
  const menuLauscherTreffer = initVon >= 0 && initBis > initVon
    ? [...html.slice(initVon, initBis).matchAll(/document\.addEventListener\('keydown',event=>\{([\s\S]*?)\n    \},true\);/g)] : [];
  const menuLauscher = menuLauscherTreffer.length===1 ? menuLauscherTreffer[0] : null;
  check('4-Menü-anker: der eigene Kommando-Menü-Lauscher ist eindeutig eingegrenzt',
    !!menuLauscher && menuLauscher[1].includes('menu.querySelectorAll') && menuLauscher[1].includes('closeCommandMenu(true)'));
  if (menuLauscher){
    let offen = false, obenauf = true, geschlossen = 0, verhindert = 0, gestoppt = 0;
    const doc = { activeElement:null };
    const first = { disabled:false, getClientRects:()=>[{}], focus(){ doc.activeElement = this; } };
    const last = { disabled:false, getClientRects:()=>[{}], focus(){ doc.activeElement = this; } };
    const menu = { classList:{ contains:token=>token==='open'&&offen }, querySelectorAll:()=>[first,last], contains:e=>e===first||e===last };
    const lauscher = new Function('menu','fensterObenauf','closeCommandMenu','document',
      'return event=>{' + menuLauscher[1] + '};')(menu, element=>element===menu&&obenauf, restore=>{if(restore===true)geschlossen++;}, doc);
    const taste = (key, shiftKey=false) => lauscher({ key, shiftKey,
      preventDefault(){ verhindert++; }, stopImmediatePropagation(){ gestoppt++; } });
    taste('Escape');
    check('4-Menü: geschlossenes Menü beansprucht Escape nicht', geschlossen===0 && verhindert===0 && gestoppt===0);
    geschlossen=verhindert=gestoppt=0;
    offen=true; obenauf=false; doc.activeElement=last; taste('Escape'); taste('Tab');
    check('4-Menü: ein verdecktes Menü beansprucht weder Escape noch Tab',
      geschlossen===0 && verhindert===0 && gestoppt===0 && doc.activeElement===last);
    geschlossen=verhindert=gestoppt=0; doc.activeElement=last;
    obenauf=true; taste('Escape');
    check('4-Menü: das oberste offene Menü bedient seinen Escape-Ausgang', geschlossen===1 && verhindert===1 && gestoppt===1);
    taste('Tab');
    check('4-Menü: das oberste offene Menü hält Tab in seinen eigenen Bedienelementen', doc.activeElement===first && verhindert===2);
  }
}

const PLANETEN = ['vesna', 'rhea', 'aion'];
function stand(){
  const now = Date.now();
  return JSON.stringify({
    ...ruhigeUhren(),
    tutorialSeen:true, newbieWelcomeSeen:true, updateNoticeSeen:true,
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:2e4, forschungspunkte:3e4 },
    buildings:{ solar:24, mine:22, kristallmine:20, labor:16, lager:18, werft:16, turm:10 },
    research:{ rkampf:10 }, fleet:{ jaeger:2000, bomber:400, frachter:200, missions:[] },
    colonies:{}, activeBasePlanet:'home', player:{ id:'u', name:'A', avatarKey:null },
    discovered: PLANETEN.reduce((a,p) => (a[p] = true, a), {}),
    battleStats:{ wins:120, losses:14 }, xp:2600000, credits:1800000, buffs:[], lastTick:now,
    colonyNames:{}, modules:{}, shipModules:{}, equippedShipModules:{}
  });
}
const UEBERFALL = { id:'r1', time:Date.now(), ts:Date.now(), type:'raid', result:'win',
  faction:'Söldnerkonvoi', attackPower:41200, defensePower:23400, targetPlanet:'home',
  fleet:{ destroyers:179 }, destroyedShips:{ destroyers:31 },
  stationedFleet:{ jaeger:152, destroyers:2418, schlachtschiff:7234 }, ownLostShips:{},
  defenseBefore:{ flak:55, turm:50, laser:45 } };
const OVERLAYS = ['tutorialOverlay','welcomeNewOverlay','updateNoticeOverlay',
                  'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'];
function backendEinfach(store, berichte){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'reports' && berichte) return j({ reports: berichte });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'leaderboard') return j([]);
    if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (/reports|messages|ranking|wars|halloffame|bounty|friends|pending|notifications|market|chat/.test(p))
      return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}
const VIEWBOX = () => { const s = document.getElementById('galaxyMapSvg'); return s ? s.getAttribute('viewBox') : null; };
const REITER  = () => { const b = document.querySelector('.tab-btn.active'); return b ? b.getAttribute('data-tab') : null; };
const HINWEISLAGE = () => {
  const bar=document.getElementById('tabHintBar'),svg=document.getElementById('galaxyMapSvg');
  return {display:bar?getComputedStyle(bar).display:null,height:bar?.getBoundingClientRect().height||0,
    scroll:scrollY,svgTop:svg?.getBoundingClientRect().top,
    focus:{tag:document.activeElement?.tagName,id:document.activeElement?.id||'',hint:document.activeElement?.getAttribute('data-tab-hint-dismiss')}};
};

async function oeffneKartenreiter(page){
  const menu = page.locator('#commandMenuToggle');
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  await page.locator('.tab-btn[data-tab="karte"]').click();
}

async function warteAufRuhigeKarte(page){
  await page.evaluate(()=>{ delete window.__schirmKartenruhe; });
  try{
    const handle = await page.waitForFunction(()=>{
      const svg=document.getElementById('galaxyMapSvg');
      if(!svg)return false;
      const r=svg.getBoundingClientRect(),text=svg.getAttribute('viewBox');
      const viewBox=(text||'').trim().split(/\s+/).map(Number);
      const aktuell={viewBox,text,scroll:scrollY,bounds:[r.left,r.top,r.width,r.height]};
      const messung=window.__schirmKartenruhe||(window.__schirmKartenruhe={anker:null,seit:0,frames:0});
      messung.letzte=aktuell;
      if(viewBox.length!==4||viewBox.some(n=>!Number.isFinite(n))||!r.width||!r.height)return false;
      const gleich=messung.anker&&viewBox.every((n,i)=>Math.abs(n-messung.anker.viewBox[i])<=0.01)
        &&Math.abs(aktuell.scroll-messung.anker.scroll)<=0.1
        &&aktuell.bounds.every((n,i)=>Math.abs(n-messung.anker.bounds[i])<=0.1);
      if(!gleich){messung.anker=aktuell;messung.seit=performance.now();messung.frames=1;return false;}
      messung.frames++;
      const ruhigMs=performance.now()-messung.seit;
      return ruhigMs>=200&&messung.frames>=3?{...aktuell,ruhigMs,frames:messung.frames}:false;
    },null,{polling:'raf',timeout:6000});
    const result=await handle.jsonValue();await handle.dispose();return result;
  }catch(error){
    const letzte=await page.evaluate(()=>window.__schirmKartenruhe?.letzte||null);
    throw new Error('Native ViewBox, Scrollposition und SVG-Bounds wurden binnen 6s nicht für 200ms ruhig: '+JSON.stringify(letzte),{cause:error});
  }
}

const kartenKlicklage = (page, punkt) => page.evaluate(p=>{
  const hit=p.hit?document.elementFromPoint(p.x,p.y):null,menu=document.querySelector('.kmenu');
  const svg=document.getElementById('galaxyMapSvg'),hint=document.getElementById('tabHintBar');
  return {hitTarget:hit?{tag:hit.tagName,id:hit.id,planet:hit.closest('[data-planet]')?.getAttribute('data-planet')||null}:null,
    menu:menu?{visible:!!menu.getClientRects().length,bounds:menu.getBoundingClientRect().toJSON()}:null,
    viewBox:svg?.getAttribute('viewBox'),scroll:scrollY,svg:svg?.getBoundingClientRect().toJSON(),
    hint:hint?{display:getComputedStyle(hint).display,height:hint.getBoundingClientRect().height}:null,
    focus:{tag:document.activeElement?.tagName,id:document.activeElement?.id||'',hint:document.activeElement?.getAttribute('data-tab-hint-dismiss')}};
},punkt);

async function beginneNativeRenderMessung(page){
  await page.evaluate(()=>{
    const button=document.querySelector('[data-build="mine"]');
    if(!button||typeof button.onclick!=='function'||!button.onclick.toString().includes("btn.getAttribute('data-build')"))
      throw new Error('Der tatsächlich zugewiesene native Bau-Handler als Render-Anker fehlt');
    // render() weist diesen nativen Handler am Ende jedes Durchlaufs neu zu, auch wenn seine
    // Texte/Styles unverändert bleiben. Nur die Funktionsidentität lesen: keine Ersetzung
    // von Renderer, Timer, Handler oder Scroll-/Kartenmechanismus.
    window.__schirmRenderMessung={handler:button.onclick,seit:performance.now()};
  });
}

async function warteAufNativenRender(page){
  const handle=await page.waitForFunction(()=>{
    const messung=window.__schirmRenderMessung,button=document.querySelector('[data-build="mine"]');
    if(!messung||!button||typeof button.onclick!=='function'||button.onclick===messung.handler)return false;
    if(!button.onclick.toString().includes("btn.getAttribute('data-build')"))return false;
    return{seit:messung.seit,beobachtet:performance.now(),scroll:scrollY,
      hinweisHoehe:document.getElementById('tabHintBar')?.getBoundingClientRect().height||0,echterHandlerGewechselt:true};
  },null,{polling:'raf',timeout:6000});
  const messung=await handle.jsonValue();await handle.dispose();
  return messung;
}

const nativerPlanetentreffer = page => page.evaluate(() => {
  const svg=document.getElementById('galaxyMapSvg'),sr=svg.getBoundingClientRect();
  const knoten=[...svg.querySelectorAll('.planet-node[data-planet]')]
    .filter(n=>n.getAttribute('data-planet')!=='__home__');
  const proben=[];
  for(const node of knoten){
    for(const teil of [...node.querySelectorAll('image,circle,ellipse,path,text'),node]){
      const r=teil.getBoundingClientRect();if(!r.width||!r.height)continue;
      const x=r.left+r.width/2,y=r.top+r.height/2;
      if(x<Math.max(0,sr.left)||x>Math.min(innerWidth,sr.right)||y<Math.max(0,sr.top)||y>Math.min(innerHeight,sr.bottom))continue;
      const hit=document.elementFromPoint(x,y);
      if(hit&&node.contains(hit))return{planet:node.getAttribute('data-planet'),x,y,hit:true};
      if(proben.length<8)proben.push({planet:node.getAttribute('data-planet'),x,y,hit:hit?.id||hit?.tagName||null});
    }
  }
  return{hit:false,knoten:knoten.length,karte:sr.toJSON(),proben};
});

(async () => {
  const browser = await starteBrowser();
  for (const [b, h] of [[390, 844], [900, 1000]]){
    const ctx = await browser.newContext({ viewport: { width: b, height: h } });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', e => fehler.push(b + 'px: ' + String(e)));
    await versionAbfangen(page);
    await page.route('**/api/**', backendEinfach({ 'kepler7-save-v3': stand() }, [UEBERFALL]));
    await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
    await page.goto(SPIEL_URL);
    await page.waitForFunction(()=>document.getElementById('loadstate')?.textContent.startsWith('Spielstand automatisch geladen'),null,{timeout:60000});
    await page.evaluate(ids => ids.forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; }), OVERLAYS);
    // Der gespeicherte Stand hat noch keinen Tageslogin: dessen natives Fenster echt schließen.
    await page.locator('#welcomeBackDismissBtn').waitFor({state:'visible',timeout:60000});
    await page.locator('#welcomeBackDismissBtn').click();
    if(await page.locator('#commandMenuToggle').count())await page.locator('#commandMenuToggle').waitFor({state:'visible',timeout:60000});
    await page.waitForTimeout(500);
    const P = (t) => b + ': ' + t;

    await oeffneKartenreiter(page);
    await page.waitForTimeout(1300);
    const sysDa = await oeffneSystemUeberSektoren(page, 'vega');
    check(P('V-anker: das System steht wirklich aufgeklappt (sonst misst nichts)'), sysDa === true);

    // ======================= B) OHNE Fenster muessen die Tasten WIRKEN =======================
    // Diese Richtung zuerst: Ohne sie waere „alles abschalten" eine erlaubte Antwort auf A.
    const ruhe0=await warteAufRuhigeKarte(page);
    check(P('Kamera-anker: die native Karte ist vor den Tastenmessungen mindestens 200ms ruhig'),ruhe0.ruhigMs>=200&&ruhe0.frames>=3,ruhe0);
    const vb0 = await page.evaluate(VIEWBOX);
    await page.keyboard.press('ArrowRight'); await warteAufRuhigeKarte(page);
    const vb1 = await page.evaluate(VIEWBOX);
    check(P('3a: ohne Fenster bewegt ArrowRight die Karte weiterhin'), vb1 !== vb0 && !!vb1, { vb0, vb1 });
    await page.keyboard.press('+'); await warteAufRuhigeKarte(page);
    const vb2 = await page.evaluate(VIEWBOX);
    check(P('3b: ohne Fenster zoomt + weiterhin'), vb2 !== vb1, { vb1, vb2 });

    const r0 = await page.evaluate(REITER);
    await page.keyboard.press('2'); await page.waitForTimeout(600);
    const r1 = await page.evaluate(REITER);
    check(P('3c: ohne Fenster wechselt die Ziffer weiterhin den Reiter'), !!r1 && r1 !== r0, { r0, r1 });

    // zurueck auf die Karte fuer die Sperr-Messungen
    await oeffneKartenreiter(page);
    await page.waitForTimeout(1200);

    // ======================= A) MIT Fenster duerfen sie NICHTS tun ==========================
    await page.evaluate(() => { const x = document.getElementById('headerReportsBtn'); if (x) x.click(); });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const x = document.querySelector('[data-watch-battle]'); if (x) x.click(); });
    await page.waitForTimeout(1500);
    const wDa = await page.evaluate(() => !!document.getElementById('battleModalOverlay')?.classList.contains('open'));
    check(P('1-anker: die Kampf-Wiedergabe steht wirklich offen'), wDa === true);
    const w0 = await page.evaluate(VIEWBOX);
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(600);
    const w1 = await page.evaluate(VIEWBOX);
    check(P('1a: mit Fenster bewegt ArrowRight die Karte NICHT'), w1 === w0, { w0, w1 });
    await page.keyboard.press('+'); await page.waitForTimeout(600);
    check(P('1b: mit Fenster zoomt + NICHT'), (await page.evaluate(VIEWBOX)) === w0);
    await page.evaluate(() => { const o = document.getElementById('battleModalOverlay'); if (o) o.classList.remove('open'); });
    await page.waitForTimeout(400);

    // Ziffer unter dem Tutorial-Fenster - das Fenster hat gar keinen Tastenausgang.
    /* Erst einen echten Reiter aktiv machen: headerReportsBtn laesst gemessen KEINEN .tab-btn
       aktiv zurueck, und eine Pruefung, die null gegen null vergleicht, misst zu wenig. */
    await oeffneKartenreiter(page);
    await page.waitForTimeout(900);
    await page.evaluate(() => { const o = document.getElementById('tutorialOverlay'); if (o) o.style.display = 'flex'; });
    await page.waitForTimeout(400);
    const t0 = await page.evaluate(REITER);
    check(P('2-anker: vor der Messung ist wirklich ein Reiter aktiv (sonst misst 2 null gegen null)'), t0 === 'karte', { t0 });
    await page.keyboard.press('2'); await page.waitForTimeout(600);
    const t1 = await page.evaluate(REITER);
    check(P('2: mit Fenster wechselt die Ziffer den Reiter NICHT'), t1 === t0, { t0, t1 });
    // Den sichtbaren Ersthinweis unmittelbar nach einem echten nativen Render nachreichen.
    // So erfasst dieser Fall auch die nächste Renderphase, ohne die Spieluhr zu manipulieren.
    await beginneNativeRenderMessung(page);
    console.log('INFO - '+P('nativer Render vor Tutorial-Ausgang')+' | '+JSON.stringify(await warteAufNativenRender(page)));
    const hinweisVor=await page.evaluate(HINWEISLAGE);
    // Der native Ausgang reicht den während des Tutorials unterdrückten Ersthinweis sofort
    // nach. Bloßes Verstecken verschöbe dessen Layoutwirkung bis zum nächsten Spieltick.
    await page.locator('#tutorialSkipBtn').click();
    await page.locator('#tutorialOverlay').waitFor({state:'hidden'});
    console.log('INFO - '+P('nativer Tutorial-Ausgang')+' | '+JSON.stringify({vor:hinweisVor,nach:await page.evaluate(HINWEISLAGE)}));
    // Dieser echte Ersthinweis bleibt sichtbar, während das native Kartenmenü geöffnet wird.
    // Verstanden hier wegzuklicken würde den gemessenen verzögerten Scrollfehler verdecken.
    await page.locator('#tabHintBar [data-tab-hint-dismiss="karte"]').waitFor({state:'visible',timeout:6000});
    await page.waitForTimeout(300);

    /* DER SONDERFALL, vorher gemessen: Das Kartenmenue deckt die Bildmitte NICHT (390x844 wie
       900x1000). Es wird deshalb gesondert gefragt - eine Deckprobe allein wuerde es durchlassen. */
    /* Der Knoten heisst [data-planet] und traegt seinen Klick-Lauscher aus dem Kartenaufbau
       (weltraum_kolonie.html: `node.addEventListener('click', ... planetMapMenu(e, pid))`).
       `__home__` ist ausgenommen - es oeffnet kein Menue. Der erste Entwurf riet auf
       `[data-sys]`/`circle` und traf gar nichts; der Anker darunter hat das gemeldet, statt die
       Pruefung still durchzuwinken. */
    await page.locator('#galaxyMapSvg').scrollIntoViewIfNeeded();
    const klickruhe=await warteAufRuhigeKarte(page);
    check(P('Kamera-anker: der native Planetentreffer wird auf mindestens 200ms ruhiger Geometrie gemessen'),klickruhe.ruhigMs>=200&&klickruhe.frames>=3,klickruhe);
    // Ein Gruppenzentrum kann zwischen Planet und Beschriftung liegen oder außerhalb der
    // sichtbaren Karte. Nach der Overlayfolge ausschließlich einen wirklich gemalten Treffer
    // wählen und den nativen Pointerweg benutzen, damit Drag-/Close-Handler ebenfalls wirken.
    const menuDa=await nativerPlanetentreffer(page);
    if (menuDa.hit) await page.mouse.click(menuDa.x,menuDa.y);
    const sofort=await kartenKlicklage(page,menuDa);
    await beginneNativeRenderMessung(page);
    await page.waitForTimeout(800);
    const nativerRender=await warteAufNativenRender(page);
    const nach800ms=await kartenKlicklage(page,menuDa);
    const kmenuOffen = await page.locator('.kmenu').isVisible();
    check(P('1c-anker: das Kartenmenue liess sich oeffnen (sonst ist 1c ungeprueft)'),menuDa.hit&&kmenuOffen,{menuDa,sofort,nach800ms,nativerRender});
    if(!kmenuOffen){
      // Der ursprüngliche Wächter ist bereits streng rot. Nur zur vollständigen Gegenprobe
      // das echte Menü erneut öffnen, damit auch der unveränderte Tastenwächter ausgeführt
      // wird. Koordinate/Hit/Stabilität werden erneut gemessen; kein force-/Script-Klick.
      await page.locator('#galaxyMapSvg').scrollIntoViewIfNeeded();
      await warteAufRuhigeKarte(page);
      const wiederaufnahme=await nativerPlanetentreffer(page);
      if(!wiederaufnahme.hit)throw new Error('Kein echter Planetentreffer zur Fortsetzung: '+JSON.stringify(wiederaufnahme));
      await page.mouse.click(wiederaufnahme.x,wiederaufnahme.y);
      await page.locator('.kmenu').waitFor({state:'visible'});
      console.log('INFO - '+P('native Menü-Wiederaufnahme nach rotem Anker')+' | '+JSON.stringify(await kartenKlicklage(page,wiederaufnahme)));
    }
    const k0=await page.evaluate(VIEWBOX);
    await page.keyboard.press('ArrowRight');await page.waitForTimeout(600);
    check(P('1c: bei offenem Kartenmenue bewegt ArrowRight die Karte NICHT'),(await page.evaluate(VIEWBOX))===k0,{k0,menuDa});
    await page.keyboard.press('Escape');await page.waitForTimeout(400);

    /* M4 als Dauerwaechter: Eine Deckschicht mit pointer-events:none darf die Schirmfrage nicht
       stoeren - sonst sperrten Klick-Funken, Konfetti und Erfolgs-Abzeichen die Tasten. Die
       Gegenprobe steht daneben: Dieselbe Schicht OHNE pointer-events:none MUSS sperren, sonst
       misst die Pruefung nur, dass mein Messmittel nicht ankommt. */
    await oeffneKartenreiter(page);
    await page.waitForTimeout(1200);
    await oeffneSystemUeberSektoren(page, 'vega');
    await page.evaluate(() => {
      const d = document.createElement('div'); d.id = '__deko';
      d.style.cssText = 'position:fixed; inset:0; z-index:9999; pointer-events:none;';
      document.body.appendChild(d);
    });
    const d0 = await page.evaluate(VIEWBOX);
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(600);
    check(P('5a: eine Schicht mit pointer-events:none sperrt die Tasten NICHT'),
      (await page.evaluate(VIEWBOX)) !== d0, { d0 });
    await page.evaluate(() => {
      const a = document.getElementById('__deko'); if (a) a.remove();
      const d = document.createElement('div'); d.id = '__dekoHart';
      d.style.cssText = 'position:fixed; inset:0; z-index:9999;';
      document.body.appendChild(d);
    });
    const e0 = await page.evaluate(VIEWBOX);
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(600);
    check(P('5b: dieselbe Schicht OHNE pointer-events:none sperrt sehr wohl (Messmittel taugt)'),
      (await page.evaluate(VIEWBOX)) === e0, { e0 });
    await page.evaluate(() => { const d = document.getElementById('__dekoHart'); if (d) d.remove(); });

    check(P('J: keine Skriptfehler'), fehler.length === 0, fehler.slice(0, 2));
    await ctx.close();
  }
  await browser.close();
  console.log(fail ? 'FAIL - Schirmfrage' : 'OK - Schirmfrage');
  process.exit(fail ? 1 : 0);
})();
