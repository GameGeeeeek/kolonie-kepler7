// Jede Werftkarte zeigt die Signatur - alle fuenf Kartenformen (04.09.2026).
//
//   node tests/test_werft_signatur.js
//
// DER ANLASS, gemessen. Seit v8.660.0 verspricht die Patchnote: "Die Zahl steht auf JEDER
// Werftkarte", und "auf der Werftkarte steht ab 600 gleich dabei, was das bedeutet". Die Zeile
// wurde bewusst NEBEN die 25-Zweig-Metakette gesetzt, weil 20 der 45 Schiffe dort gar keine Zeile
// bekommen - richtig entschieden, und trotzdem blieben SIEBEN Karten uebrig.
//
// Die Werft zeichnet ihre Karten in FUENF Formen. Gemessen an der gerenderten Werft: 46 Karten,
// 7 ohne die Zahl.
//
//   Normalkarte (SHIP_DEFS-Schleife, dritter Ausgang)      hatte sie
//   unlockItems, gesperrt      (Mondzerstoerer, 1000)      fehlte
//   unlockEventParts, gesperrt (sechs Event-Schiffe)       fehlte
//   Superschlachtschiff, gesperrt (800)                    fehlte
//   Superschlachtschiff, frei     (800)                    fehlte
//
// Die Schleife hat DREI Ausgaenge, nicht einen. Und die gesperrten Karten sind gerade die, an
// denen die Kaufentscheidung faellt: Beim Mondzerstoerer verbrennt man vier seltene Gegenstaende.
//
// WIE HIER GEPRUEFT WIRD: an der GERENDERTEN Werft, ueber `#fleet .card-row` - also ALLE Karten.
// Der erste Entwurf dieses Tests mass `.card-row.ship-card` und war damit blind fuer genau die
// Familien, an denen es fehlte: Die gesperrten Karten tragen diese Klasse nicht (gemessen:
// 46 Karten, davon 38 mit ship-card). Eine Vollstaendigkeitspruefung, die ueber eine Klasse geht,
// die nicht alle Mitglieder tragen, ist gruen und belegt nichts.
//
// GEGENPROBE, gemessen gegen den Stand vor der Aenderung
// (KEPLER_SPIELDATEI=<origin/main:weltraum_kolonie.html> node tests/test_werft_signatur.js):
// Exit 1, es fallen GENAU SECHS: 1, 2, 3, 4, 6 und 6b. Gruen bleiben die drei Anker (1-anker,
// 2-anker, 6-anker), Pruefung 5 (der Zusatz steht nicht auf jeder Karte - das stimmt auch vorher,
// nur mit 12 statt 14 Karten) und die beiden Fehlerpruefungen 5b/6c.
// Pruefung 1 benennt am alten Stand alle acht fehlenden Karten selbst:
//   {"ohne":["Kometenjäger","Enterschiff","Phantomschiff","Riftwächter","Gesandtenschiff",
//            "Schürfschiff","Mondzerstörer gesperrt","Superschlachtschiff gesperrt"]}
// Acht, nicht sieben: Der erste Messlauf zaehlte sieben, weil das Superschlachtschiff dort
// freigeschaltet war und seine gesperrte Karte gar nicht im Bild stand.
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const FILE = SPIEL_URL;

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId:'u', username:'Werfttest', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData() || '{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p))
    return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

/* Zwei Spielstaende, weil eine Werft nicht alle fuenf Kartenformen gleichzeitig zeigen kann: Das
   Superschlachtschiff ist entweder gesperrt oder frei. Alle vier seltenen Gegenstaende liegen im
   Inventar, damit die gesperrte Mondzerstoerer-Karte ueberhaupt gezeichnet wird; ohne Event-Teile
   und ohne Forschungsfreigabe stehen die sechs Event-Schiffe gesperrt da. Genug Ressourcen, damit
   keine Karte an einer Kostenpruefung haengt. */
function spielstand(zusatz){ return JSON.stringify(Object.assign({
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie:999999, erz:999999, kristalle:999999, deuterium:99999, antimaterie:9999, forschungspunkte:9999 },
  buildings: { solar:12, mine:12, werft:10, labor:8 },
  research: { rkampf:10, rkampf2:10, rantimaterie:10 },
  fleet: { jaeger:5, schlachtschiff:2, missions:[] },
  colonies: {}, activeBasePlanet: 'home',
  player: { id:'u', name:'Werfttest', allianceTag:'', avatarKey:null },
  battleStats: { wins:0, losses:0 }, xp:5000, buffs:[], lastTick: Date.now(),
  colonyNames:{}, colonyNotes:{}, modules:{}, shipModules:{}, equippedShipModules:{}, moduleFragments:0,
  rareItems: { antimateriekern:1, kristallherz:1, alte_technologie:1, leerensplitter:5 },
  unlocked: {}
}, zusatz || {})); }
const GESPERRT = spielstand({});
const FREI     = spielstand({ fleet:{ superschlachtschiff:1, jaeger:5, schlachtschiff:2, missions:[] }, unlocked:{ superschlachtschiff:true } });

/* Der Schiffsfilter "Nur baubare Schiffe anzeigen" wird hier BEWUSST nicht angefasst: Das Spiel
   normalisiert state.uiHideLockedShips beim Laden auf false (weltraum_kolonie.html, applyState-
   Defaults), er ist also immer aus. Ein Klick auf das Umschaltsymbol wuerde ihn EINSCHALTEN und die
   gesperrten Karten verstecken - genau die, um die es hier geht. Der erste Entwurf dieses Tests
   klickte auf `[data-toggle-hide-locked] i.ti-check`; dieses Symbol existiert nie, der Zweig lief
   also in keinem Lauf. Sollte die Vorgabe je auf "an" wechseln, faellt das an den Ankern auf. */
async function oeffneWerft(browser, stand){
  const ctx = await browser.newContext({ viewport:{ width:1100, height:1800 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend({ 'kepler7-save-v3': stand }));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token','tok'); });
  await page.goto(FILE); await page.waitForTimeout(2500);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display='none'; }); });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="flotte"]'); if (b) b.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const b = document.querySelector('[data-fleet-subtab="werft"]') || document.querySelector('[data-fleet-subtab]');
    if (b) b.click();
  });
  await page.waitForTimeout(1500);
  const karten = await page.evaluate(() => [...document.querySelectorAll('#fleet .card-row')].map(c => ({
    name: (c.querySelector('.bname') ? c.querySelector('.bname').textContent : '?').replace(/\s+/g,' ').trim().slice(0,34),
    text: c.textContent.replace(/\s+/g,' '),
    klassen: c.className,
    superFrei: !!c.querySelector('[data-scrapship="superschlachtschiff"]'),
    superGesperrt: !!c.querySelector('[data-unlock="superschlachtschiff"]'),
    event: /event-locked-card/.test(c.className)
  })));
  return { ctx, karten, errs };
}

(async () => {
  const browser = await starteBrowser();

  // ==== A) Die Werft mit allen gesperrten Kartenformen ============================================
  const a = await oeffneWerft(browser, GESPERRT);
  const k = a.karten;

  /* Die Anker zuerst. Ohne sie waere "alle Karten tragen die Zeile" bei null Karten gruen - und
     genauso bei einer Werft, in der die gesperrten Formen gar nicht vorkommen. Jede der drei
     Familien wird deshalb einzeln nachgewiesen, BEVOR ueber sie geurteilt wird. */
  check('1-anker: die Werft zeigt eine ganze Reihe Karten', k.length >= 40, k.length);
  const mond  = k.find(c => /Mondzerstörer/.test(c.name) && /research-locked/.test(c.klassen));
  const evs   = k.filter(c => c.event);
  const supG  = k.find(c => c.superGesperrt);
  check('2-anker: die drei gesperrten Kartenformen stehen im Bild',
    !!mond && evs.length >= 5 && !!supG,
    { mondzerstoerer: !!mond, eventSchiffe: evs.length, superschlachtschiff: !!supG });

  // ---- 1) Die Regel ueber ALLE Karten -----------------------------------------------------------
  const ohne = k.filter(c => !/Signatur/.test(c.text)).map(c => c.name);
  check('1: JEDE Werftkarte zeigt die Signatur', ohne.length === 0, { ohne });

  // ---- 2/3/4) Die drei Formen, die sie nicht hatten ---------------------------------------------
  /* Einzeln benannt statt nur ueber Pruefung 1 mitgezaehlt: Faellt eine Familie spaeter weg, soll
     die Meldung sagen WELCHE - eine Sammelpruefung mit leerer Liste sagt das nicht. */
  /* "1.0k", nicht "1.000": fmt() kuerzt ab 1000 auf eine Nachkommastelle mit k - gemessen, nicht
     angenommen (mein erster Entwurf erwartete hier "1.000" und fiel). Die Schreibweise steht
     bewusst als Literal drin: Sie ist eine Anzeigestelle dieser Zahl, und wer fmt() aendert,
     aendert damit, was auf der teuersten Karte der Werft steht. */
  if (mond) check('2: die gesperrte Mondzerstoerer-Karte nennt Signatur 1.0k',
    /Signatur\s*1\.0k/.test(mond.text) && /nicht zu verbergen/.test(mond.text), mond.text.slice(0,220));
  const evOhne = evs.filter(c => !/Signatur/.test(c.text)).map(c => c.name);
  check('3: alle gesperrten Event-Schiff-Karten nennen ihre Signatur', evOhne.length === 0, { evOhne, gesamt: evs.length });
  if (supG) check('4: die gesperrte Superschlachtschiff-Karte nennt Signatur 800',
    /Signatur\s*800/.test(supG.text) && /nicht zu verbergen/.test(supG.text), supG.text.slice(0,170));

  // ---- 5) Gegenrichtung: der Zusatz ist NICHT ueberall ------------------------------------------
  /* Ohne diese Pruefung waere eine Fassung gruen, die den Zusatz bedingungslos an jede Karte
     haengt - dann stuende an einem Jaeger (Signatur 10) "nicht zu verbergen", und die Zeile saegte
     die Aussage ab, die sie treffen soll. Er trifft 14 Klassen, nicht eine: 13 in SHIP_DEFS ab
     Signatur 600 plus das Superschlachtschiff. */
  const mitZusatz = k.filter(c => /nicht zu verbergen/.test(c.text)).length;
  check('5: der Zusatz steht NICHT auf jeder Karte', mitZusatz > 0 && mitZusatz < k.length,
    { mitZusatz, karten: k.length });
  check('5b: keine JS-Fehler', a.errs.length === 0, a.errs.slice(0,3));
  await a.ctx.close();

  // ==== B) Die freigeschaltete Superschlachtschiff-Karte ==========================================
  /* Die fuenfte Form. Sie ist ein zweiter handgeschriebener Block und in Abschnitt A nicht zu
     sehen - dort ist das Schiff gesperrt. */
  const b = await oeffneWerft(browser, FREI);
  const supF = b.karten.find(c => c.superFrei);
  check('6-anker: die freigeschaltete Superschlachtschiff-Karte steht im Bild', !!supF,
    supF ? supF.name : b.karten.map(c=>c.name).slice(0,6));
  if (supF){
    check('6: sie nennt die Signatur 800', /Signatur\s*800/.test(supF.text), supF.text.slice(0,170));
    check('6b: samt Zusatz "nicht zu verbergen"', /nicht zu verbergen/.test(supF.text), supF.text.slice(0,170));
  }
  check('6c: keine JS-Fehler im freigeschalteten Zustand', b.errs.length === 0, b.errs.slice(0,3));
  await b.ctx.close();

  await browser.close();
  ende();
})();
