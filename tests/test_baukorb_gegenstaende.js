// Der Baukorb darf seltene Gegenstände nicht vermehren (Befund der Durchsicht zu v8.665.0).
//
// DAS LOCH, gemessen am Stand davor: queueConstruction stempelt für jedes Schiff aus
// SPECIAL_UNIT_ITEMS automatisch `specialItemKey` und `specialItemQty` an den Auftrag - im
// Vertrauen darauf, dass der AUFRUFER den Gegenstand vorher abgezogen hat. Der Einzelknopf tut
// das (`state.rareItems[key] = haveItems - qty`), der Baukorb tat es nie. cancelConstruction
// erstattet die gestempelte Menge dagegen bedingungslos zurueck. Daraus folgten zwei Schaeden:
//
//   A) VERMEHRUNG. Korb einreihen (nichts geht ab), Auftrag abbrechen (Erstattung kommt an) -
//      der Vorrat steigt. Beliebig oft wiederholbar, ohne jede Grenze.
//   B) GRATIS-SCHIFFE. Laesst man den Auftrag stattdessen durchlaufen, zahlt activateQueuedJobs
//      nur die Ressourcen; die Schiffe entstehen, ohne dass ein Gegenstand verbraucht wurde.
//
// Beides ist Wirtschaft, nicht Optik - deshalb ein eigener Waechter statt einer Zeile in einem
// bestehenden Test. Geprueft wird die REGEL: Was der Korb einreiht, muss beim Einreihen abgehen,
// und ein Abbruch darf hoechstens auf den Ausgangsstand zurueckfuehren, nie darueber.
//
// GEGENPROBE (Stand vor der Behebung): Es MUESSEN 2 und 3 fallen - der Vorrat bleibt beim
// Einreihen unveraendert und steigt nach dem Abbruch ueber den Ausgangswert. Gruen bleiben MUESSEN
// die Anker 0 und 1.
const { starteBrowser, SPIEL_URL, SPIELDATEI, ruhigeUhren, pruefer, logMitschnitt, logZeilen } = require('./lib/umgebung');
const fs = require('fs');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;

// Das Schiff wird aus der Spieldatei GEMESSEN, nicht eingetippt: gesucht ist ein Eintrag aus
// SPECIAL_UNIT_ITEMS, der ohne Allianz baubar ist (Allianzschiffe scheitern sonst schon am Tor).
function sonderSchiffe(){
  const quelle = fs.readFileSync(SPIELDATEI, 'utf8');
  const zeile = (quelle.match(/const SPECIAL_UNIT_ITEMS = \{([^}]*)\}/) || [])[1] || '';
  return [...zeile.matchAll(/(\w+)\s*:\s*'([a-z_]+)'/g)].map(m => {
    const key = m[1], i = quelle.indexOf("{ key:'" + key + "'");
    const j = i < 0 ? -1 : quelle.indexOf("{ key:'", i + 8);
    const eintrag = i < 0 ? '' : quelle.slice(i, j < 0 ? i + 1200 : j);
    return { key, item: m[2], name: (eintrag.match(/name:'([^']+)'/) || [])[1] || key,
             forschung: [...eintrag.matchAll(/\{key:'(\w+)',level:(\d+)\}/g)].map(x => [x[1], Number(x[2])]) };
  });
}
// Fuer den Spielstand: die Forschung ALLER Sonderschiffe freischalten und jeden Gegenstand geben.
function sonderSchiff(){
  const alle = sonderSchiffe();
  return { forschung: [].concat(...alle.map(a => a.forschung)), items: alle.map(a => a.item) };
}

const now = Date.now();
function spielstand(schiff){
  const research = {};
  for (const [k, lvl] of (schiff ? schiff.forschung : [])) research[k] = lvl + 2;
  const rareItems = {}; for (const it of (schiff ? schiff.items : [])) rareItems[it] = 3;
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte']) g[t] = 1;
  return JSON.stringify(Object.assign({}, ruhigeUhren(), {
    tutorialSeen: true, newbieWelcomeSeen: true, seenTabHints: g,
    resources: { energie:9e6, erz:9e6, kristalle:9e6, deuterium:9e6, antimaterie:9e5, forschungspunkte:9e4 },
    buildings: { solar:20, mine:20, lager:40, werft:14, labor:12 }, research,
    fleet: { jaeger:0, missions:[] }, colonies: {}, activeBasePlanet: 'home',
    /* Allianz UND Allianzforschung UND Abgrundtiefe: Ohne das eine oder andere laesst
       shipRequirementsMet die Sonderschiffe gar nicht in den Korb, und der Test misst dann
       eine leere Menge. inAllianz() liest state.player.allianceTag - nicht die /api/me-Antwort. */
    player: { id:'u', name:'AdmiralX', allianceTag:'TST' }, xp: 9e5, credits: 5e5, prestige: 0, buffs: [],
    allianceResearch: { ra_verbund:20, ra_werftnorm:20, ra_schildnetz:20, ra_sternenschmiede:20 },
    abgrund: { best: 99 },
    lastTick: now, colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {},
    equippedShipModules: {}, moduleFragments: 0, constructionQueue: [], rareItems
  }));
}

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
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  const page = await ctx.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  const store = { 'kepler7-save-v3': spielstand(sonderSchiff()) };
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  /* cancelConstruction fragt per confirm() nach ("Bau abbrechen?"). Ohne Antwort bleibt der
     Dialog offen und der Klick verpufft - der erste Anlauf dieses Tests hielt genau deshalb den
     Abbruch fuer erfolgt, obwohl die Warteschlange unveraendert blieb. Aufgefallen ist das nur,
     weil Pruefung 3 einen eigenen Anker bekam. */
  page.on('dialog', d => d.accept());
  await logMitschnitt(page);
  await page.goto(DATEI); await page.waitForTimeout(2600);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="flotte"]'); if (b) b.click(); });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const b = document.querySelector('[data-fleet-subtab="werft"]'); if (b) b.click(); });
  await page.waitForTimeout(1400);

  /* Das Schiff wird VOM DOM AUS gewaehlt: erst fragen, was wirklich im Korb steht, dann in der
     Spieldatei nachschlagen, welches davon einen Gegenstand verbraucht. Andersherum lief der
     erste Anlauf ins Leere - er waehlte das Superschlachtschiff, das einen eigenen Block hat und
     im Korb ueberhaupt nicht vorkommt, und meldete "nicht abgezogen", obwohl es nur kein
     Eingabefeld gab. Dieselbe Lehre wie beim Werft-Test einen Tag zuvor. */
  const imKorb = await page.evaluate(() =>
    [...document.querySelectorAll('[data-basket-ship]')].map(e => e.getAttribute('data-basket-ship')));
  const sonder = sonderSchiffe();
  const schiff = sonder.find(x => imKorb.indexOf(x.key) >= 0) || null;
  check('0-anker: ein Schiff mit Gegenstandskosten steht wirklich im Baukorb', !!schiff,
    { imKorb: imKorb.length, sonderbekannt: sonder.map(x => x.key), gewaehlt: schiff && schiff.key });
  if (!schiff) return ende(async () => browser.close());

  // Der Vorrat wird aus dem gespeicherten Spielstand gelesen - das ist die Zahl, um die es geht.
  const vorratAus = (roh) => { try { return (JSON.parse(roh).rareItems || {})[schiff.item] || 0; } catch (e) { return null; } };
  const auftragsZahl = (roh) => { try { return (JSON.parse(roh).constructionQueue || []).length; } catch (e) { return null; } };
  const vorher = vorratAus(store['kepler7-save-v3']);
  check('1-anker: der Vorrat des Gegenstands steht im Spielstand', vorher >= 2,
    { gegenstand: schiff.item, vorrat: vorher, schiff: schiff.name });

  // 2) Einreihen über den Baukorb MUSS den Vorrat senken.
  const eingereiht = await page.evaluate(k => {
    const inp = document.querySelector('[data-basket-ship="' + k + '"]');
    if (!inp) return null;
    inp.value = '2';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    const btn = document.getElementById('shipBasketBuildBtn');
    if (!btn) return null;
    btn.click();
    return true;
  }, schiff.key);
  await page.waitForTimeout(900);
  const nachEinreihen = vorratAus(store['kepler7-save-v3']);
  check('2) das Einreihen über den Baukorb zieht den Gegenstand ab',
    !!eingereiht && nachEinreihen !== null && nachEinreihen < vorher,
    { vorher, nachher: nachEinreihen, eingereiht: !!eingereiht });

  // 3) Und ein Abbruch führt höchstens auf den Ausgangsstand zurück, nie darüber.
  const auftraegeVor = auftragsZahl(store['kepler7-save-v3']);
  const abgebrochen = await page.evaluate(() => {
    const btn = document.querySelector('[data-cancel-construction]');
    if (!btn) return false;
    btn.click(); return true;
  });
  await page.waitForTimeout(900);
  const nachAbbruch = vorratAus(store['kepler7-save-v3']);
  const auftraegeNach = auftragsZahl(store['kepler7-save-v3']);
  /* ANKER ZUERST: Ohne den Nachweis, dass wirklich abgebrochen wurde, waere die Regelpruefung
     darunter leer - "nicht mehr als vorher" ist auch dann wahr, wenn gar nichts passiert ist.
     Genau diese Sorte leerer Pruefung hat die Durchsicht einen Absatz weiter oben gefunden. */
  check('3-anker: der Abbruch hat den Auftrag wirklich aus der Warteschlange genommen',
    abgebrochen && auftraegeNach !== null && auftraegeNach < auftraegeVor,
    { vorher: auftraegeVor, nachher: auftraegeNach, geklickt: abgebrochen });
  check('3) die Erstattung führt GENAU auf den Ausgangsstand zurück, nicht darüber',
    nachAbbruch === vorher,
    { vorher, nachEinreihen, nachAbbruch });

  // 4) Und ohne Vorrat wird gar nicht erst eingereiht, mit einem Wort dazu.
  await page.evaluate(k => {
    const inp = document.querySelector('[data-basket-ship="' + k + '"]');
    if (inp){ inp.value = '99'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
  }, schiff.key);
  await page.waitForTimeout(400);
  const vorRest = vorratAus(store['kepler7-save-v3']);
  await page.evaluate(() => { const b = document.getElementById('shipBasketBuildBtn'); if (b) b.click(); });
  await page.waitForTimeout(800);
  const nachRest = vorratAus(store['kepler7-save-v3']);
  check('4) mehr bestellen als vorhanden vermehrt nichts',
    nachRest !== null && nachRest >= 0 && nachRest <= vorRest, { vorRest, nachRest });

  await ctx.close();
  await ende(async () => browser.close());
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });
