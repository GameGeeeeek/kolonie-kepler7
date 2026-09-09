// KS-3: Nest und Wrackkonvoi sagen, wie viele schon dran waren.
//
//   node tests/test_pve_beitrag.js
//
// DIE LUECKE, gemessen: Die Beute von Nest und Konvoi wird nach SCHADENSANTEIL geteilt. Die
// Festung sagt das laengst (`festungBeitragDaten` rechnet Summe, eigenen Anteil und Zahl der
// Beitragenden); Nest und Konvoi kannten die Zahlen nur nicht. Wer angriff, merkte hinterher, dass
// sein Anteil 8 Prozent war.
//
// GEPRUEFT WIRD DIE REGEL:
//   1a  Das Nestmenue nennt die ZAHL der Beitragenden und den eigenen Anteil in Prozent.
//   1b  Wer noch nicht dabei war, bekommt das gesagt - statt einer 0-Prozent-Zeile, die wie ein
//       Fehler aussieht.
//   1c  Dasselbe am Wrackkonvoi.
//   2a  KEINE NAMEN. Die stehen in `beitraege` (die Karten-Route gibt die Galaxie roh heraus) -
//       sie anzuzeigen machte aus einer PvE-Auskunft eine PvP-Zielliste. Gemessen am ganzen
//       Menue-Text, nicht an einem Feld.
//   2b  Ohne jeden Beitrag steht die Zeile GAR NICHT da - eine Zeile „0 Kommandanten" waere
//       Rauschen an einem frischen Ziel.
//
// GEGENPROBE: `KEPLER_SPIELDATEI` auf den Stand vor KS-3, Aufruf mit KEPLER_BEITRAG_GEGENPROBE=alt.
// Dort fallen 1a, 1b und 1c. 2a und 2b bleiben gruen (es gibt gar keine Zeile) und sind damit
// keine Belege fuer KS-3, sondern die Waechter ueber seine Auflagen.
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();
const ergebnis = {};
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };

const SAB = process.env.KEPLER_BEITRAG_GEGENPROBE || '';
const MUSS_FALLEN = { alt: ['1a', '1b', '1c'] };
const SYS = 'vega';
const ICH = 'u-ich';
const now = Date.now();

/* Drei Beitraege, davon einer meiner: 7000 von 12000 sind 58 Prozent. Die Zahlen sind so gewaehlt,
   dass der Prozentwert weder 0 noch 100 ist - beide waeren auch mit einer kaputten Rechnung
   erreichbar. Die NAMEN stehen bewusst drin: 2a soll belegen, dass sie NICHT angezeigt werden. */
const BEITRAEGE = { [ICH]: { name:'Ich', schaden: 7000 },
                    'u-riva': { name:'Rivale', schaden: 3000 },
                    'u-dritt': { name:'Dritter', schaden: 2000 } };

let nestBeitraege = BEITRAEGE;
let konvoiBeitraege = { 'u-riva': { name:'Rivale', schaden: 4000 } };

function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0 });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, unlockedAlienRaces:[],
      collapsedSystems:{}, activeWormhole:null, activePirateFaction:null, activeWar:null,
      news:[], controlledSystems:{}, factions:{},
      alienNester: [{ id:'n1', sys:SYS, volk:'verglueht', stufe:3, lp:30000, lpMax:40000,
        seit: now - 864e5, letzteReifung: now - 864e5, beitraege: nestBeitraege, schlaege: {} }],
      wrackKonvois: [{ id:'k1', sys:SYS, lp:20000, lpMax:40000, seit: now - 36e5,
        beitraege: konvoiBeitraege, schlaege: {} }] });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    return j({});
  };
}

async function menueText(page, selektor){
  return page.evaluate(sel => {
    const n = document.querySelector('#galaxyMapSvg ' + sel);
    if (!n) return { knoten:false };
    n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:200, clientY:200 }));
    const m = document.querySelector('.kmenu');
    return { knoten:true, text: m ? (m.textContent || '') : '' };
  }, selektor);
}

(async () => {
  const browser = await starteBrowser();
  const store = {};
  store['kepler7-save-v3'] = JSON.stringify({
    tutorialSeen:true, newbieWelcomeSeen:true,
    resources:{ energie:48000, erz:52000, kristalle:31000, deuterium:20000, antimaterie:900, forschungspunkte:2200 },
    buildings:{ solar:18, mine:17, kristallmine:15, labor:10, lager:12, werft:9 },
    research:{}, fleet:{ jaeger:400, cruisers:60, ships:3, missions:[] },
    discovered:{}, colonies:{}, activeBasePlanet:'home',
    player:{ id:ICH, name:'Ich' }, xp:52000, credits:184000, buffs:[], lastTick: now,
    colonyNames:{}, colonyNotes:{}, activeEvent:null,
    nextPlanetEventCheck: now + 36e5, nextTraderCheck: now + 36e5, nextRaidTime: now + 36e5
  });

  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
     'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.remove(); });
    const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click();
  });
  await page.waitForTimeout(700);
  const offen = await oeffneSystemUeberSektoren(page, SYS);
  await page.waitForTimeout(2000);
  merke('0a: die Systemebene steht', offen === true, { offen });

  const nest = await menueText(page, '[data-map-nest]');
  merke('0b: das Nestmenue oeffnet', nest.knoten === true && !!nest.text, { knoten: nest.knoten });
  merke('1a: es nennt die Zahl der Beitragenden und den eigenen Anteil',
    /3 Kommandanten haben hier bereits Schaden gemacht/.test(nest.text)
    && /Dein Anteil bisher: 7\.0k Schaden \(58%\)/.test(nest.text),
    { auszug: (nest.text.match(/[^.]*Kommandanten[^.]*\.[^.]*\./) || [''])[0] });
  merke('2a: keine Namen der Beitragenden im Menue',
    !/Rivale|Dritter/.test(nest.text), { treffer: (nest.text.match(/Rivale|Dritter/g) || []) });

  await page.evaluate(() => { const m = document.querySelector('.kmenu'); if (m) m.remove(); });
  const konvoi = await menueText(page, '[data-map-konvoi]');
  merke('1c: dasselbe steht am Wrackkonvoi - dort ohne eigenen Beitrag',
    konvoi.knoten === true && /Ein Kommandant hat hier bereits Schaden gemacht/.test(konvoi.text),
    { auszug: (konvoi.text.match(/[^.]*Kommandant[^.]*\./) || [''])[0] });
  merke('1b: wer noch nicht dabei war, bekommt das gesagt',
    /Du warst noch nicht dabei/.test(konvoi.text),
    { auszug: (konvoi.text.match(/Du warst[^.]*\./) || [''])[0] });

  // ---- 2b) Ganz ohne Beitrag steht die Zeile gar nicht da ---------------------------------------
  nestBeitraege = {}; konvoiBeitraege = {};
  await page.reload();
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
     'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.remove(); });
    const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click();
  });
  await page.waitForTimeout(700);
  await oeffneSystemUeberSektoren(page, SYS);
  await page.waitForTimeout(2000);
  const leer = await menueText(page, '[data-map-nest]');
  merke('2b: ohne jeden Beitrag steht die Zeile gar nicht da',
    leer.knoten === true && !/Kommandant/.test(leer.text), { text: (leer.text || '').slice(0, 120) });

  merke('2c: keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await browser.close();

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
