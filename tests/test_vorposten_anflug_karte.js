// KS-6: Der Anflug auf den eigenen Vorposten steigt auf die oberen Kartenebenen.
//
//   node tests/test_vorposten_anflug_karte.js
//
// BIS HIERHER lebte der Alarm nur im EINEN geoeffneten System (roter Ring am Marker). Wer ihn
// sehen wollte, musste das System schon offen haben. Ueber `karteSystemBadges` erscheint er jetzt
// auch am Systemplatz der Sektoransicht - und ueber die vorhandene Aggregation im Regions-Tooltip
// der Uebersicht.
//
// GEPRUEFT WIRD DIE REGEL, und die drei Auflagen sind Teil davon:
//   1a  Ein laufender Anflug macht aus dem 🛰 ein 🔥, und der Titel nennt Verband und Schiffszahl.
//   1b  Das gewoehnliche 🛰 steht dann NICHT zusaetzlich da - zwei Abzeichen fuer dasselbe Objekt
//       waeren zwei Anzeigestellen fuer eine Sache.
//   2a  AUFLAGE 1: Ein Anflug, dessen Ankunft VORBEI ist, loest keinen Alarm aus. Der Server haelt
//       ihn bis zu zwei Stunden danach in der Liste (VORPOSTEN_ANFLUG_GNADE) - ohne den Filter
//       brennte die Uebersicht stundenlang fuer ein Gefecht, das vorbei ist. Dann steht wieder das
//       gewoehnliche 🛰 da.
//   2b  AUFLAGE 3: Die Warnung haengt NICHT am Ereignis-Schalter. Eine abschaltbare Warnung vor
//       dem eigenen Totalverlust ist keine. Gemessen mit ausgeschalteter Ereignis-Ebene.
//   2c  AUFLAGE 3, zweite Haelfte: KEINE laufende Restzeit im Titel - die Karte baut sich im
//       Sekundentakt neu.
//
// GEGENPROBE: `KEPLER_SPIELDATEI` auf den Stand vor KS-6, Aufruf mit KEPLER_ANFLUG_GEGENPROBE=alt.
// Dort fallen 1a, 1b und 2b. 2a und 2c bleiben gruen (es gibt gar kein Alarm-Abzeichen, das zu
// frueh oder zu geschwaetzig sein koennte) und sind damit keine Belege fuer KS-6, sondern die
// Waechter ueber seine Auflagen.
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSektorMitSystem } = require('./lib/karte');
const { check, ende } = pruefer();
const ergebnis = {};
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };

const SAB = process.env.KEPLER_ANFLUG_GEGENPROBE || '';
const MUSS_FALLEN = { alt: ['1a', '1b', '2b'] };
const SYS = 'vega';
const now = Date.now();

const STUFEN = [1,2,3,4,5,6,7,8].map(n => ({ stufe:n, name:'Stufe '+n, kernLp: 20000*n, verteidigung: 2500*n,
  garnisonMax: 300*n, flug:0.06, prod:0.015, scan:1, kosten: n===1?null:{ erz:1000 } }));

/* `anflugArt` steuert, was in der Liste steht: 'laufend' = Ankunft in der Zukunft,
   'vorbei' = Ankunft schon geschehen (der Server haelt sie zwei Stunden lang weiter in der
   Liste), 'keiner' = leere Liste. */
let anflugArt = 'laufend';
function vpDoc(){
  const anflug = anflugArt === 'laufend' ? [{ tag:'RIV', schiffe: 1200, ankunftAt: now + 25*60000 }]
               : anflugArt === 'vorbei'  ? [{ tag:'RIV', schiffe: 1200, ankunftAt: now - 25*60000 }]
               : [];
  return { id:'vp-a', sys:SYS, besitzer:'u', besitzerName:'A', seit: now - 864e5,
    stufe:8, name:'Sternenwerft', zweig:'werft', zweigName:'Werft', maxStufe:8,
    kern:{ lp:100000, lpMax:100000 }, verteidigung:20000,
    garnisonAnzahl:0, garnisonMax:3000, garnison:{}, slots:5, module:[], modulBoni:null,
    projekte:[], projektBoni:null, lager:{}, lagerVollAb: now+36e5, dockBereit:0,
    abbauAb:null, schutzBis:0, ausbauAb: now-1000,
    nutzen:{ flug:0.2, prod:0.05, scan:3, flugDeckel:0.5 }, eigener:true,
    anflug, meinLetzterSchlag:0, letzterKampf:null, kampfverlauf:[], naechsteStufe:null };
}

function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0 });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, unlockedAlienRaces:[],
      collapsedSystems:{}, activeWormhole:null, activePirateFaction:null, activeWar:null,
      news:[], controlledSystems:{}, factions:{}, alienNester:[], wrackKonvois:[] });
    if (p === 'vorposten') return j({ ok:true, aktiv:true, bauAktiv:true, maxJeKonto:3, schutzMs:43200000,
      abklingMs:14400000, ausbauMs:43200000, garnisonFaktor:0.5, stufen:STUFEN, zweigAb:4, maxStufe:8,
      zweige:[{ key:'werft', name:'Werft', kurz:'x', namen:{8:'Sternenwerft'}, mult:{} }],
      liste:[vpDoc()], eigene:1, modulDefs:[], modulSeltenheiten:{}, modulBestand:{}, modulSlotsMax:5,
      projektDefs:[], projekteAktiv:true, flugDeckel:0.5, abbauMs:86400000, abbauAktiv:true, lagerAktiv:true, dockMax:7 });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    return j({});
  };
}

async function oeffnen(page){
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
     'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.remove(); });
    const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click();
  });
  await page.waitForTimeout(1200);
  await oeffneSektorMitSystem(page, SYS);
  await page.waitForTimeout(1500);
}

async function messen(page){
  return page.evaluate(sysId => {
    const svg = document.getElementById('galaxyMapSvg');
    const g = svg && svg.querySelector('[data-sektor-sys="' + sysId + '"]');
    if (!g) return { knoten:false };
    const eigen = t => { const l = t.lastChild; return (l && l.nodeType === 3) ? l.nodeValue.trim() : ''; };
    const zeichen = [...g.querySelectorAll('text')].map(eigen).filter(Boolean);
    const titel = [...g.querySelectorAll('title')].map(t => t.textContent);
    return { knoten:true, zeichen, titel,
             alarmTitel: titel.find(t => /im Anflug/.test(t)) || '',
             vorpostenTitel: titel.find(t => /Kern \d+%/.test(t)) || '' };
  }, SYS);
}

(async () => {
  const browser = await starteBrowser();
  const store = {};
  store['kepler7-save-v3'] = JSON.stringify({
    tutorialSeen:true, newbieWelcomeSeen:true,
    resources:{ energie:48000, erz:52000, kristalle:31000, deuterium:20000, antimaterie:900, forschungspunkte:2200 },
    buildings:{ solar:18, mine:17, kristallmine:15, labor:10, lager:12, werft:9 },
    research:{}, fleet:{ jaeger:400, ships:3, missions:[] },
    discovered:{}, colonies:{}, activeBasePlanet:'home',
    player:{ id:'u', name:'A' }, xp:52000, credits:184000, buffs:[], lastTick: now,
    colonyNames:{}, colonyNotes:{}, activeEvent:null,
    nextPlanetEventCheck: now + 36e5, nextTraderCheck: now + 36e5, nextRaidTime: now + 36e5
  });

  const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
  const page = await ctx.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));

  // ---- 1) Laufender Anflug ---------------------------------------------------------------------
  await oeffnen(page);
  const m1 = await messen(page);
  merke('0a: der Knoten steht', m1.knoten === true, { zeichen: m1.zeichen });
  merke('1a: ein laufender Anflug zeigt 🔥 und nennt Verband und Schiffszahl',
    (m1.zeichen || []).includes('🔥') && /1 Verband im Anflug/.test(m1.alarmTitel) && /1\.2k Schiffen|1200 Schiffen/.test(m1.alarmTitel),
    { zeichen: m1.zeichen, alarm: m1.alarmTitel });
  merke('1b: das gewoehnliche 🛰 steht dann nicht zusaetzlich da',
    !(m1.zeichen || []).includes('🛰'), { zeichen: m1.zeichen });
  merke('2c: der Titel traegt KEINE laufende Restzeit',
    !!m1.alarmTitel && !/\d+\s*(s|Min\.|m\b|h\b)/.test(m1.alarmTitel.replace(/Schiffen/, '')),
    { alarm: m1.alarmTitel });

  // ---- 2) Ereignis-Ebene aus: die Warnung bleibt ------------------------------------------------
  await page.evaluate(() => {
    const k = document.querySelector('#karteEbenenLeiste [data-karte-ebene="ereignisse"]');
    if (k) k.click();
  });
  await page.waitForTimeout(1200);
  const m2 = await messen(page);
  merke('2b: die Warnung haengt NICHT am Ereignis-Schalter',
    (m2.zeichen || []).includes('🔥'), { zeichen: m2.zeichen });
  await page.evaluate(() => {
    const k = document.querySelector('#karteEbenenLeiste [data-karte-ebene="ereignisse"]');
    if (k) k.click();
  });
  await page.waitForTimeout(600);

  // ---- 3) Anflug vorbei: kein Alarm mehr, aber wieder das gewoehnliche Zeichen ------------------
  anflugArt = 'vorbei';
  await oeffnen(page);
  const m3 = await messen(page);
  merke('2a: ein Anflug, dessen Ankunft vorbei ist, loest keinen Alarm aus',
    !(m3.zeichen || []).includes('🔥') && (m3.zeichen || []).includes('🛰'),
    { zeichen: m3.zeichen });

  merke('2d: keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
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
