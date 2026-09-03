// SP-1: Ein gesperrter Forschungsknopf sagt, WAS fehlt (v8.659.0).
//
// GEMESSEN am 03.09.2026 ueber alle 13 Reiter: 201 von 206 sichtbaren gesperrten Knoepfen trugen
// keinerlei Erklaerung - kein title, kein aria-label, nichts. Forschung war mit 62 der groesste
// Block. Der Spieler sah grau und erfuhr nicht, ob ihm Ressourcen, eine Voraussetzung oder nur
// Geduld fehlten.
//
// DER FUND WAR EIN ANDERER ALS ERWARTET: startResearch() prueft laengst JEDEN Sperrgrund und hat
// fuer jeden eine Meldung. Sie waren nur unerreichbar, weil der Knopf `disabled` trug - ein Klick
// darauf kommt nie an. Die Behebung ist deshalb das Entfernen des Riegels, nicht das Bauen einer
// neuen Grund-Funktion. Dasselbe Muster wie beim Vorposten-Knopf (vorpostenBauStarten): immer
// klickbar, der Klick nennt den Grund. Das wirkt auf dem Handy genauso wie am PC - ein `title`
// haette dort nichts genuetzt, weil es kein Hover gibt.
//
// Zwei der bestehenden Meldungen waren zu duenn und wurden geschaerft: "Voraussetzung nicht
// erfuellt" und "Nicht genug Ressourcen" nennen jetzt, WAS genau fehlt.
//
// PRUEFUNG 4 KAM AUS EINEM ECHTEN FEHLER (Codex-Befund am PR, 03.09.2026): Eine Voraussetzung steht
// in ZWEI Formen in RESEARCH_DEFS - als blosser Schluessel ('rminentechnik' = Stufe 1) und als
// {key, level}. Die erste Fassung der Meldung las req.key/req.level unbedingt und liess damit jede
// Voraussetzung in Zeichenketten-Form unter den Tisch fallen: Der Spieler bekam wieder nur den
// generischen Satz. Pruefungen 1-3 waren gruen, weil sie den ERSTEN gesperrten Knopf klicken, und
// der scheitert an den Kosten - der Voraussetzungs-Zweig wurde nie betreten. Pruefung 4 klickt
// deshalb gezielt eine Forschung, deren Voraussetzung in Zeichenketten-Form steht. Die betroffenen
// Schluessel werden aus der Spieldatei GELESEN, nicht eingetippt (Regel statt Momentaufnahme).
const { starteBrowser, SPIEL_URL, SPIELDATEI, ruhigeUhren, pruefer, logMitschnitt, logZeilen } = require('./lib/umgebung');
const fs = require('fs');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;

const now = Date.now();
// Bewusst arm: So ist der erste Forschungsknopf garantiert gesperrt, und zwar an den KOSTEN.
const SPIELSTAND = JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen: true, newbieWelcomeSeen: true,
  seenTabHints: { basis:1, forschung:1, flotte:1, karte:1 },
  resources: { energie:5, erz:5, kristalle:0, deuterium:0, antimaterie:0, forschungspunkte:0 },
  buildings: { solar:2, mine:2, lager:2, labor:1 }, research: {},
  fleet: { jaeger:0, missions:[] }, colonies: {}, activeBasePlanet: 'home',
  player: { id:'u', name:'AdmiralX' }, xp: 10, credits: 0, prestige: 0, buffs: [],
  lastTick: now, colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {},
  equippedShipModules: {}, moduleFragments: 0
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.route('**/api/**', backend({ 'kepler7-save-v3': SPIELSTAND }));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await logMitschnitt(page);
  await page.goto(DATEI); await page.waitForTimeout(2600);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="forschung"]'); if (b) b.click(); });
  await page.waitForTimeout(1400);

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  const knoepfe = await page.evaluate(() => {
    const els = [...document.querySelectorAll('#tab-forschung [data-research]')]
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    return { anzahl: els.length,
             gesperrt: els.filter(e => !e.classList.contains('affordable')).length,
             mitRiegel: els.filter(e => e.disabled).length };
  });
  check('0-anker: gesperrte Forschungsknöpfe im Bild', knoepfe.gesperrt >= 5, knoepfe);
  if (knoepfe.gesperrt < 5) return ende(async () => browser.close());

  // 1) Der Riegel ist weg - sonst kommt der Klick nie an.
  check('1) kein gesperrter Forschungsknopf trägt noch einen disabled-Riegel',
    knoepfe.mitRiegel === 0, knoepfe);

  // 2) Der Klick auf einen gesperrten Knopf nennt den Grund - und zwar KONKRET.
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('#tab-forschung [data-research]')]
      .find(e => !e.classList.contains('affordable'));
    if (el) el.click();
  });
  await page.waitForTimeout(700);
  const log = (await logZeilen(page)).join('\n');
  check('2) der Klick beantwortet die Frage "was fehlt mir?"',
    /Dafür fehlt noch: .+/.test(log), log.split('\n').filter(z => /fehlt|Voraussetzung|Ressourc/i.test(z)).slice(-2));

  // 3) Die Gegenrichtung: Die Antwort nennt eine MENGE und einen Namen, nicht nur "nicht genug".
  //    Ohne sie waere auch die alte, nichtssagende Meldung gruen.
  check('3) und nennt Menge und Namen, nicht nur "nicht genug"',
    /Dafür fehlt noch: [^\n]*\d[^\n]*[A-Za-zÄÖÜäöü]/.test(log),
    (log.match(/Dafür fehlt noch: [^\n]*/) || ['(keine Zeile)'])[0]);

  // 4) Beide Datenformen einer Voraussetzung werden gelesen. In RESEARCH_DEFS steht sie mal als
  //    blosser Schluessel, mal als {key, level}; wer nur die zweite Form kennt, schweigt bei der
  //    ersten. Die betroffenen Forschungen werden aus der Datei gemessen, nicht eingetippt.
  const quelle = fs.readFileSync(SPIELDATEI, 'utf8');
  const defs = quelle.slice(quelle.indexOf('const RESEARCH_DEFS = ['), quelle.indexOf('function findeForschung'));
  const mitTextForm = [...defs.matchAll(/key:'(r[a-z0-9]+)'[^\n]*requires:\['([a-z0-9]+)'/g)]
    .map(m => ({ key: m[1], braucht: m[2] }));
  check('4-anker: RESEARCH_DEFS enthält Voraussetzungen in Zeichenketten-Form',
    mitTextForm.length > 0, mitTextForm);

  if (mitTextForm.length){
    const ziel = mitTextForm[0];
    const brauchtName = (quelle.match(new RegExp("key:'" + ziel.braucht + "', name:'([^']+)'")) || [])[1] || null;
    const geklickt = await page.evaluate(k => {
      const el = document.querySelector('#tab-forschung [data-research="' + k + '"]');
      if (!el) return false;
      el.scrollIntoView({ block: 'center' }); el.click(); return true;
    }, ziel.key);
    await page.waitForTimeout(700);
    const log4 = (await logZeilen(page)).join('\n');
    check('4-anker: der Knopf der Zeichenketten-Forschung ist da und klickbar', geklickt, ziel);
    check('4) auch eine Voraussetzung in Zeichenketten-Form wird beim Namen genannt',
      !!brauchtName && log4.includes(brauchtName),
      { forschung: ziel.key, erwarteterName: brauchtName,
        zeile: (log4.match(/Dafür fehlt noch: [^\n]*/g) || ['(keine Zeile)']).slice(-1)[0] });
  }

  await ctx.close();
  await ende(async () => browser.close());
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });
