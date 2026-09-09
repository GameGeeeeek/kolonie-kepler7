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
//   2b  DER EINE EINSTIEG AUSSERHALB DES MENUES (zweite Durchsicht an PR #614): Der Knopf
//       „Vorposten errichten" in der Detailtafel geht nicht durch `openKarteMenu` und blieb als
//       einziger slotkostender Karteneinstieg stumm. Geprueft wird beides, was ihn heilt: der Satz
//       aus derselben Quelle (`slotSatz`) im Knopftitel, und die Sperre VOR der Rueckfrage -
//       sie stand danach, der Spieler bestaetigte also einen Bau, der in derselben Sekunde
//       abgelehnt wurde.
//   2c  UND ZWAR SICHTBAR, nicht nur im `title` (dritte Durchsicht an PR #614). Genau dieser
//       Knopf wurde am 02.09.2026 umgebaut, WEIL es am Telefon kein Hover gibt; der erste
//       Nachtrag stellte den Satz ausgerechnet wieder dorthin. Gemessen wird deshalb am
//       gerenderten Knopf: Bei belegten Slots traegt sein sichtbarer TEXT den Stand, und der
//       Titel daneben die lange Fassung.
//
// GEGENPROBE: `KEPLER_SPIELDATEI` auf den Stand vor KS-1, Aufruf mit KEPLER_SLOT_GEGENPROBE=alt.
// Dort fallen 1a, 1b, 2a und 2b - den Satz gibt es nicht. 1c bleibt gruen (der Satz fehlt
// ueberall, also auch dort, wo er fehlen soll) und ist damit kein Beleg fuer KS-1, sondern der
// Waechter gegen die naechste Uebertreibung.
// GEGENPROBE 2: Stand vor dem Nachtrag (Commit 90f1179), Aufruf mit KEPLER_SLOT_GEGENPROBE=knopf.
// Dort fallen 2a (15 statt 16 Marken) und 2b.
const fsS = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();
const ergebnis = {};
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };

const SAB = process.env.KEPLER_SLOT_GEGENPROBE || '';
const MUSS_FALLEN = { alt: ['1a', '1b', '2a', '2b', '2c'], knopf: ['2a', '2b', '2c'], sichtbar: ['2c'] };

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
    /* Der Bau-Knopf zeichnet sich nur mit einem Server, der Vorposten KENNT (`vorpostenCache.aktiv`)
       - das Sammelmuster weiter unten lieferte fuer `vorposten` eine leere Liste, und damit gab es
       den Knopf im Test gar nicht. Ohne diese Route waere 2c still leer. */
    if (p === 'vorposten') return j({ ok:true, aktiv:true, bauAktiv:true, maxJeKonto:3, schutzMs:43200000,
      abklingMs:14400000, ausbauMs:43200000, garnisonFaktor:0.5, zweigAb:4, maxStufe:8, zweige:[],
      stufen:[1,2,3,4,5,6,7,8].map(n => ({ stufe:n, name:'Stufe '+n, kernLp:20000*n, verteidigung:2500*n,
        garnisonMax:300*n, flug:0.06, prod:0.015, scan:1, kosten: n===1?null:{ erz:1000 } })),
      liste:[], eigene:0, modulDefs:[], modulSeltenheiten:{}, modulBestand:{}, modulSlotsMax:5,
      projektDefs:[], projekteAktiv:true, flugDeckel:0.5, abbauMs:86400000, abbauAktiv:true,
      lagerAktiv:true, dockMax:7 });
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
    /* 2c: Am gerenderten Knopf gemessen, nicht am Quelltext - der Befund war ja gerade, dass der
       Satz im `title` steht und damit am Telefon unsichtbar ist. Ein Quelltext-Muster koennte das
       eine nicht vom anderen unterscheiden. Der sichtbare Text ist `textContent`; der Titel wird
       daneben mitgeprueft, damit die lange Fassung nicht beim Umbau verlorengeht. */
    const knopf = await voll.page.evaluate(() => {
      const b = document.querySelector('[data-vorposten-bau]');
      return b ? { da:true, text: (b.textContent||'').trim(), titel: b.getAttribute('title')||'' } : { da:false };
    });
    merke('2c: bei belegten Slots steht der Stand SICHTBAR auf dem Bau-Knopf, nicht nur im Titel',
      knopf.da === true && /Slots belegt/.test(knopf.text || '')
        && /Alle \d+ Flottenslots sind belegt/.test(knopf.titel || ''),
      knopf);

    await voll.ctx.close();

    /* 2a: Die Marke steht an jedem Eintrag, der wirklich einen Slot kostet - gezaehlt im
       Quelltext, weil kein Lauf alle neun Kartenmenues gleichzeitig oeffnen kann. Die Zahl ist
       GEMESSEN (08.09.2026): Erkunden, Kolonisieren (Planet), Kolonisieren (Mond), Spaehen,
       Angreifen, Monde belagern, NPC-Angriff, Nest, Konvoi, Garnison entsenden, Vorposten-
       Angriff, Festung, Abbaumission, Anfechtung, Eskorte - und seit der zweiten Durchsicht an
       PR #614 die Garnison am VERBUENDETEN Vorposten, die als einzige der beiden
       Garnison-Eintraege ohne Marke dastand. */
    const marken = (QUELLE.match(/slot: true/g) || []).length;
    merke('2a: alle 16 slotkostenden Karteneintraege tragen die Marke', marken === 16,
      { gemessen: marken, erwartet: 16 });

    /* 2b: Der Knopf ausserhalb des Menues. Beide Anker werden VOR der Benutzung auf Existenz
       geprueft - fehlt einer, liefert `indexOf` -1, und ein Vergleich zweier -1 waere aus dem
       falschen Grund gruen. Der Rumpf wird bis `pay(gesamt)` geschnitten, also ueber die ganze
       Vorpruefung; dass dieser Endanker existiert, gehoert mit zur Bedingung. */
    const vonBau = QUELLE.indexOf('function vorpostenBauStarten(');
    const bisBau = vonBau >= 0 ? QUELLE.indexOf('pay(gesamt);', vonBau) : -1;
    const rumpf = (vonBau >= 0 && bisBau > vonBau) ? QUELLE.slice(vonBau, bisBau) : '';
    const iSperre = rumpf.indexOf('if (fleetLimitBlocks()) return;');
    const iFrage = rumpf.indexOf('if (!confirm(');
    const titelZeile = /const titelB = [^\n]*\+ slotSatz\(\);/.test(QUELLE)
      && /data-vorposten-bau="1"[^\n]*escapeHtml\(titelB\)/.test(QUELLE);
    merke('2b: der Bau-Knopf nennt den Slot und sperrt VOR der Rueckfrage',
      titelZeile && iSperre >= 0 && iFrage >= 0 && iSperre < iFrage,
      { titelZeile, sperre: iSperre, frage: iFrage, rumpfDa: rumpf.length > 0 });
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
