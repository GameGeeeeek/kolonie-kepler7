// KS-1: Der Flottenslot steht am Karteneintrag, nicht erst nach dem Klick.
//
//   node tests/test_flottenslot_ampel.js
//
// DER BEFUND (Kartenanalyse 08.09.2026, gemessen): `fleetLimitBlocks()` tut nur zweierlei -
// `log()` und `return true`. Es meldet sich also erst NACH Zielwahl, Flottenwahl und Startklick,
// an 25 Aufrufstellen. Bei anfangs zwei Slots (`maxConcurrentFleets`) laeuft ein normaler Spieler
// mehrmals die Woche dagegen und fuellt eine Schiffswahl umsonst aus. Das Hausmuster stand halb
// angewendet da: `asteroidMapMenu` schrieb seit jeher „(belegt einen Flottenslot)".
//
// GEPRUEFT WIRD DIE REGEL, in beide Richtungen im SELBEN Menue:
//   1a  Mit freien Slots nennt der Eintrag den Stand, bevor geklickt wird.
//   1b  Sind alle belegt, sagt er das - und nennt nicht mehr „belegt einen Slot", als waere noch
//       einer frei. Gemessen an DEMSELBEN Eintrag, nur mit anderem Spielstand: Ein zweiter
//       Eintrag koennte aus einem anderen Grund anders lauten.
//   1c  Ein Eintrag OHNE Slotkosten bekommt den Satz NICHT. Ohne diese Gegenrichtung waere 1a
//       auch dann gruen, wenn der Satz an JEDEM Eintrag klebte - und dann saehe der Spieler ihn
//       auch dort, wo er nicht stimmt.
//   2a  DIE KOPIE-FAMILIE: Die Zahl der markierten Eintraege im Quelltext. Der Satz entsteht an
//       EINER Stelle (openKarteMenu), die Marke `slot: true` steht an jedem Eintrag, der wirklich
//       einen Slot kostet. Wer ein neues Kartenmenue baut und die Marke vergisst, faellt hier.
//
// GEGENPROBE: `KEPLER_SPIELDATEI` auf den Stand vor KS-1, Aufruf mit KEPLER_SLOT_GEGENPROBE=alt.
// Dort fallen 1a, 1b und 2a - den Satz gibt es nicht. 1c bleibt gruen (der Satz fehlt ueberall,
// also auch dort, wo er fehlen soll) und ist damit kein Beleg fuer KS-1, sondern der Waechter
// gegen die naechste Uebertreibung.
const fsS = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();
const ergebnis = {};
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };

const SAB = process.env.KEPLER_SLOT_GEGENPROBE || '';
const MUSS_FALLEN = { alt: ['1a', '1b', '2a'] };

const SYS = 'chronos';
const SAVE_KEY = 'kepler7-save-v3';
const jetzt = Date.now();

/* Der Zielplanet wird aus der Spieldatei GELESEN, nicht erfunden: Ein erfundener Schluessel
   liefert keinen Kartenknoten, das Menue oeffnet nicht, und der Test waere still leer. */
const QUELLE = fsS.readFileSync(SPIELDATEI, 'utf8');
const ZIEL = (QUELLE.match(/\{ id:'(\w+)',[^\n]*system:'chronos'/g) || [])
  .map(z => (z.match(/id:'(\w+)'/) || [])[1]).filter(Boolean)[0];

function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, unlockedAlienRaces:[], collapsedSystems:{},
      activeWormhole:null, news:[], controlledSystems:{}, factions:{}, alienNester: [] });
    if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
    if (p === 'storage-list') return j({ keys: Object.keys(store) });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|reports|vorposten|players-map|chat/.test(p))
      return j(p.includes('pending') ? { reward:null } : []);
    return j({ ok:true });
  };
}

async function karte(browser, store){
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']){
      const e = document.getElementById(id); if (e) e.remove();
    }
    const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click();
  });
  await page.waitForTimeout(700);
  await oeffneSystemUeberSektoren(page, SYS);
  await page.waitForTimeout(2500);
  return { ctx, page, errs };
}

/* Oeffnet das Menue des Zielplaneten und liest LABEL UND GRUND als Paare. Der Grund allein
   reichte nicht: 1c muss sagen koennen, WELCHER Eintrag den Satz nicht traegt. */
async function menue(page, planetId){
  return page.evaluate(id => {
    const n = document.querySelector('#galaxyMapSvg [data-planet="' + id + '"]');
    if (!n) return { knoten:false };
    n.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 200 }));
    const m = document.querySelector('.kmenu');
    if (!m) return { knoten:true, menue:false };
    /* JEDER Knopf wird aufgenommen, auch einer OHNE Grundzeile. Der erste Entwurf sammelte nur
       Paare aus Knopf und Grund - Eintraege ohne Grund fielen heraus, und damit war 1c leer und
       aus dem falschen Grund gruen (gemessen: `geprueft: []`). */
    const paare = [];
    for (const kind of m.children){
      if (kind.tagName === 'BUTTON') paare.push({ label: (kind.textContent || '').trim(), grund: null });
      else if (kind.classList.contains('kmenu-grund') && paare.length) paare[paare.length-1].grund = (kind.textContent || '').trim();
    }
    return { knoten:true, menue:true, paare };
  }, planetId);
}

(async () => {
  const browser = await starteBrowser();
  try {
    merke('0a: ein Planet in ' + SYS + ' steht in der Spieldatei', !!ZIEL, { ZIEL });
    if (!ZIEL) return;

    // Erst den Ausgangsstand holen, damit der Testspielstand vom Spiel selbst stammt.
    const s0 = {};
    const t0 = await karte(browser, s0);
    const basis = JSON.parse(s0[SAVE_KEY] || '{}');
    await t0.ctx.close();
    merke('0b: das Spiel hat einen Ausgangsstand geliefert', !!basis.buildings, Object.keys(basis).length);
    if (!basis.buildings) return;

    /* Zwei Spielstaende, die sich NUR in der Zahl laufender Missionen unterscheiden. Die Grenze
       wird nicht eingetippt, sondern aus dem Spiel abgeleitet: `maxConcurrentFleets` ist
       2 + Flottenkoordination + Fertigkeiten; ohne Forschung sind es zwei. Der volle Stand setzt
       deshalb zwei Verlegungen mit eigener groupId - ein Verband mit gleicher groupId zaehlte nur
       als EINER, und der Test maesse dann den falschen Zustand. */
    const stand = (voll) => {
      const st = JSON.parse(JSON.stringify(basis));
      /* DAS ZIEL IST EINE EIGENE KOLONIE - nicht Kulisse, sondern die Vorbedingung von 1c: Nur
         dann traegt das Menue auch einen Eintrag OHNE Slotkosten („Als aktive Basis wählen").
         Ohne ihn misst 1c eine leere Liste und ist aus dem falschen Grund gruen. */
      st.colonies = Object.assign({}, st.colonies, { [ZIEL]: { buildings:{ solar:3 }, name:'Vorwerk' } });
      st.discovered = Object.assign({}, st.discovered, { [ZIEL]: true });
      st.fleet = Object.assign({}, st.fleet, { jaeger:200, spaeher:20, cruisers:40, colonyShips:3, missions: [] });
      st.research = Object.assign({}, st.research, { rflottenkoord: 0 });
      if (voll) st.fleet.missions = [1,2].map(i => ({ id: 8000+i, type:'relocate', targetId:'home', groupId:'g'+i,
        startTime: jetzt-1000, endTime: jetzt+9e6, fleetName:'Verlegung '+i, composition:{ jaeger: 1 } }));
      const fern = jetzt + 365*24*3600*1000;
      for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift']) if (st[k] !== undefined) st[k] = fern;
      st.activeEvent = null; st.buffs = [];
      return JSON.stringify(st);
    };

    const frei = await karte(browser, { [SAVE_KEY]: stand(false) });
    const mFrei = await menue(frei.page, ZIEL);
    /* Der Knopf heisst „Erkunden" oder „Erneut erkunden", je nachdem ob das Ziel schon
       entdeckt ist - gesucht wird deshalb unabhaengig von Gross- und Kleinschreibung. Der erste
       Entwurf traf mit /Erkunden/ genau dann nicht mehr, als das Fixture eine Kolonie bekam. */
    const erkFrei = (mFrei.paare || []).find(x => /erkund/i.test(x.label || ''));
    merke('1a: mit freien Slots nennt der Karteneintrag den Stand vor dem Klick',
      mFrei.menue === true && !!erkFrei && /Belegt einen Flottenslot \(\d+ von \d+ belegt\)/.test(erkFrei.grund),
      { paare: mFrei.paare });
    /* 1c misst die GEGENRICHTUNG im selben Menue: „Als aktive Basis wählen" kostet keinen Slot. */
    const ohneSlot = (mFrei.paare || []).filter(x => !/erkund|kolonis/i.test(x.label || ''));
    merke('1c: ein Eintrag ohne Slotkosten bekommt den Satz NICHT',
      ohneSlot.length >= 1 && ohneSlot.every(x => !/Flottenslot/.test(x.grund || '')),
      { geprueft: ohneSlot.map(x => x.label), traeger: ohneSlot.filter(x => /Flottenslot/.test(x.grund || '')) });
    merke('1d: keine Skriptfehler', frei.errs.length === 0, frei.errs.slice(0, 2));
    await frei.ctx.close();

    const voll = await karte(browser, { [SAVE_KEY]: stand(true) });
    const mVoll = await menue(voll.page, ZIEL);
    const erkVoll = (mVoll.paare || []).find(x => /erkund/i.test(x.label || ''));
    merke('1b: sind alle Slots belegt, sagt DERSELBE Eintrag genau das',
      mVoll.menue === true && !!erkVoll && /Alle \d+ Flottenslots sind belegt/.test(erkVoll.grund)
      && !/Belegt einen Flottenslot/.test(erkVoll.grund),
      { grund: erkVoll && erkVoll.grund });
    await voll.ctx.close();

    /* 2a: Die Marke steht an jedem Eintrag, der wirklich einen Slot kostet - gezaehlt im
       Quelltext, weil kein Lauf alle neun Kartenmenues gleichzeitig oeffnen kann. Die Zahl ist
       GEMESSEN (08.09.2026): Erkunden, Kolonisieren (Planet), Kolonisieren (Mond), Spaehen,
       Angreifen, Monde belagern, NPC-Angriff, Nest, Konvoi, Garnison entsenden, Vorposten-
       Angriff, Festung, Abbaumission, Anfechtung, Eskorte. */
    const marken = (QUELLE.match(/slot: true/g) || []).length;
    merke('2a: alle 15 slotkostenden Karteneintraege tragen die Marke', marken === 15,
      { gemessen: marken, erwartet: 15 });
  } finally {
    await browser.close();
  }

  if (SAB){
    const soll = MUSS_FALLEN[SAB] || [];
    const gefallen = soll.filter(n => ergebnis[n] === false);
    console.log('GEGENPROBE ' + SAB + ': ' + gefallen.length + '/' + soll.length + ' gefallen (' +
      soll.map(n => n + '=' + (ergebnis[n] === false ? 'rot' : 'gruen')).join(' ') + ')');
    if (gefallen.length !== soll.length){
      console.log('FAIL - Gegenprobe unvollstaendig: ' + soll.filter(n => ergebnis[n] !== false).join(', ') + ' blieben gruen');
      process.exitCode = 1; return;
    }
    process.exitCode = 0; return;
  }
  ende();
})().catch(e => { console.error('FAIL - Abbruch:', e); process.exit(1); });
