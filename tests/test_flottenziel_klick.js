// FL-1: Jede laufende Mission sagt und zeigt, WOHIN sie fliegt (v8.655.0).
//
// ANLASS: Wunsch des Betreibers, "wenn eine Flotte unterwegs ist, soll immer anklickbar sein,
// wohin sie fliegt".
//
// GEMESSEN vorher: Von den Missionszeilen im Status-Menue rechts trug genau EINE ein Klickziel -
// die Abbaumission (data-fp-asteroid). Alle uebrigen nannten ihr Ziel im Text und waren toter
// Text; wer wissen wollte, wo seine Flotte hinfliegt, musste das Ziel auf der Karte selbst suchen.
//
// GEPRUEFT WIRD DIE REGEL, nicht eine Liste: Das Fixture stellt sieben Missionsarten gleichzeitig
// ins Feld, und der Test verlangt fuer JEDE ein Klickziel - ausser fuer die namentlich benannten
// Ausnahmen. Kommt eine achte Art dazu, faellt Pruefung 2, ohne dass jemand sie eintragen muss.
//
// Die Ausnahme ist Teil der Zusage und wird MITGEPRUEFT (Pruefung 3): Expedition und
// Abgrund-Tauchgang fliegen nicht zu einem Ort auf der Karte, sondern ins Unerkundete. Ein Klick,
// der irgendwohin springt, waere schlechter als keiner. Ohne diese Gegenrichtung koennte jemand
// "alles anklickbar" bauen und der Test bliebe gruen.
const { starteBrowser, SPIEL_URL, ruhigeUhren, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;

const now = Date.now();
const ende_ = now + 3600000;   // alle Missionen laufen noch eine Stunde

// Sieben Arten gleichzeitig. 'expedition' ist die Ausnahme und MUSS ohne Klickziel bleiben.
const MISSIONEN = [
  { id: 1, type:'attack',          targetId:'raider1', startTime:now, endTime:ende_, fleetName:'Vorhut',  composition:{ jaeger:10 } },
  { id: 2, type:'explore',         targetId:'rhea',    startTime:now, endTime:ende_, fleetName:'Späher',   composition:{ jaeger:2 } },
  { id: 3, type:'mining',          system:'kepler', platz:0, startTime:now, endTime:ende_, fleetName:'Fuhre', composition:{ schuerfschiff:2 }, sorte:'eisen', groesse:'splitter', menge:1000 },
  { id: 4, type:'mining-escort',   system:'kepler', platz:1, startTime:now, endTime:ende_, fleetName:'Wache', composition:{ jaeger:4 } },
  { id: 5, type:'vorposten-bau',   targetId:'orion',   system:'orion',  startTime:now, endTime:ende_, fleetName:'Bautrupp', composition:{ transporter:5 } },
  { id: 6, type:'festung-angriff', system:'nebel',     startTime:now, endTime:ende_, fleetName:'Sturm',   composition:{ bomber:8 } },
  { id: 7, type:'expedition',      startTime:now, endTime:ende_, fleetName:'Fernflug', escortPower:120, escortComposition:{ jaeger:6 } },
  /* Die drei folgenden kamen aus der Durchsicht am PR (03.09.2026) - der erste Entwurf dieses
     Tests hatte KEINEN Rueckflug, keinen Umzug nach Hause und keinen Spielerangriff im Feld, und
     genau deshalb sind dort drei Fehler durchgegangen. Ein Waechter ist nur so gut wie sein
     Fixture; diese drei Zeilen sind der eigentliche Ertrag der Durchsicht. */
  { id: 8, type:'mining-recall',   system:'kepler', platz:2, startTime:now, endTime:ende_, fleetName:'Eskorte kehrt', schiffe:{ jaeger:3 } },
  { id: 9, type:'relocate',        targetId:'home',    startTime:now, endTime:ende_, fleetName:'Umzug', composition:{ transporter:3 } },
  { id:10, type:'attack-player',   targetId:'u_fremd', targetPlanet:'rhea', targetName:'Fremdling', standortName:'Eismond Rhea', startTime:now, endTime:ende_, fleetName:'Raubzug', composition:{ jaeger:20 } }
];
const OHNE_ZIEL_ERWARTET = [7];   // die Expedition, namentlich

const SPIELSTAND = JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen: true, newbieWelcomeSeen: true,
  seenTabHints: { basis:1, karte:1, galaxie:1, flotte:1 },
  resources: { energie:148000, erz:152000, kristalle:131000, deuterium:92000, antimaterie:3900, forschungspunkte:12200 },
  buildings: { solar:18, mine:17, kristallmine:15, labor:10, lager:12, werft:8 },
  research: { flottenkoordination: 8 },
  fleet: { jaeger:120, bomber:40, transporter:30, schuerfschiff:6, missions: MISSIONEN },
  colonies: {}, activeBasePlanet: 'home', player: { id:'u', name:'AdmiralX' },
  xp: 152000, credits: 384000, prestige: 4, buffs: [], lastTick: now,
  colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {}, equippedShipModules: {}, moduleFragments: 12
}));

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: 'u', username: 'AdmiralX', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0 });
  if (p.startsWith('storage/')) { const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
    if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 }); return j({ e: 1 }, 404); }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p))
    return j(p.includes('pending') ? { reward: null } : []);
  return j({});
};}

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.route('**/api/**', backend({ 'kepler7-save-v3': SPIELSTAND }));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(DATEI); await page.waitForTimeout(2800);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  // Das Status-Menue rechts aufklappen.
  await page.evaluate(() => { const b = document.getElementById('fpToggleBtn'); if (b) b.click(); });
  await page.waitForTimeout(1400);

  const zeilen = await page.evaluate(() => {
    const l = document.getElementById('fleetPositionList');
    if (!l) return null;
    return [...l.querySelectorAll('.fleet-position-item')].map(el => ({
      text: (el.querySelector('.fp-name') || el).textContent.trim().slice(0, 46),
      hatZiel: !!(el.getAttribute('data-fp-mziel') || el.getAttribute('data-fp-asteroid')),
      ziel: el.getAttribute('data-fp-mziel') || el.getAttribute('data-fp-asteroid') || '',
      was: el.getAttribute('data-fp-mwas') || '',
      zeiger: getComputedStyle(el).cursor
    }));
  });

  check('0-vorab: Statusmenü offen und alle sieben Missionen gezeichnet',
    !!zeilen && zeilen.length === MISSIONEN.length, zeilen ? zeilen.length : null);
  if (!zeilen || zeilen.length !== MISSIONEN.length) return ende(async () => browser.close());
  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  const ohne = zeilen.filter(z => !z.hatZiel);
  check('1) jede Missionszeile mit Kartenort ist anklickbar',
    ohne.length === OHNE_ZIEL_ERWARTET.length, { ohneZiel: ohne.map(z => z.text) });

  const mitZeiger = zeilen.filter(z => z.hatZiel && z.zeiger === 'pointer').length;
  check('2) und sieht auch anklickbar aus (Zeiger)',
    mitZeiger === zeilen.length - OHNE_ZIEL_ERWARTET.length, { mitZeiger, erwartet: zeilen.length - OHNE_ZIEL_ERWARTET.length });

  // Die Gegenrichtung: Ohne sie waere "alles anklickbar machen" auch gruen.
  const expZeile = zeilen.find(z => /Expedition/i.test(z.text));
  check('3) die Expedition bleibt bewusst OHNE Klickziel (kein Ort auf der Karte)',
    !!expZeile && !expZeile.hatZiel, expZeile);

  /* 4-6: die drei Faelle aus der PR-Durchsicht. Sie pruefen nicht "hat ein Ziel", sondern
     "zeigt auf das RICHTIGE" - ein Rueckflug, der zum verlassenen Ort springt, behauptet das
     Gegenteil dessen, was in seiner Zeile steht. */
  const rueck = zeilen.find(z => /kehrt/i.test(z.text));
  check('4) der Rückflug zeigt nach HAUSE, nicht zum verlassenen Vorkommen',
    !!rueck && rueck.hatZiel && !/data-map-asteroid|asteroid=/.test(rueck.ziel) && /home|data-map-moon/.test(rueck.ziel),
    rueck);

  const umzug = zeilen.find(z => /Umzug/i.test(z.text));
  check('5) ein Umzug zur Heimatbasis hat ein Ziel (home steht nicht in PLANETS)',
    !!umzug && umzug.hatZiel, umzug);

  const raub = zeilen.find(z => /Raubzug|Fremdling/i.test(z.text));
  check('6) der Spielerangriff nimmt den gewählten Standort, nicht die Benutzerkennung',
    !!raub && raub.hatZiel && raub.ziel.indexOf('u_fremd') < 0 && /rhea/.test(raub.ziel), raub);

  // Und der Klick tut wirklich etwas: Angriff auf raider1 -> dessen System kepler, NPC blinkt.
  const wirkung = await page.evaluate(async () => {
    const l = document.getElementById('fleetPositionList');
    const el = [...l.querySelectorAll('[data-fp-mziel]')].find(x => /Marodeure|Vorhut/i.test(x.textContent));
    if (!el) return { fehler: 'Angriffszeile nicht gefunden' };
    el.click();
    await new Promise(r => setTimeout(r, 900));
    const reiter = document.querySelector('.tab-btn[data-tab="karte"]');
    return {
      karteOffen: !!(reiter && reiter.classList.contains('active')),
      npcDa: !!document.querySelector('[data-map-npc]'),
      blinkt: !!document.querySelector('.fundort-blink')
    };
  });
  check('7) ein Klick öffnet die Karte am Ziel und hebt es hervor',
    wirkung.karteOffen && wirkung.npcDa && wirkung.blinkt, wirkung);

  await ctx.close();
  await ende(async () => browser.close());
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });
