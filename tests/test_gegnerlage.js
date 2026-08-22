// Die Gegnerstärke steht auf der KARTE, nicht nur im Galaxie-Reiter (E1b, 22.08.2026).
//
//   node tests/test_gegnerlage.js
//
// DER ANLASS IST GEMESSEN, am gerenderten Spiel und nicht am Quelltext. Wer einen Gegner über die
// Karte angriff - also über den Weg, den KB-4 zum Hauptweg gemacht hat -, flog blind:
//
//   Kartenmenü:      ein Eintrag ("Angreifen"), KEINE einzige Zahl.
//   Flottenwahl:     nur Flugzeit und Treibstoff.
//   Galaxie-Reiter:  "Gegner-Verteidigungspunkte: 30 · Deine Angriffskraft: 0 · Erfolgschance ~5%
//                     Gegnerische Flotte: 2 · Schwachstelle: Jäger – nicht mitgeführt · 40s
//                     Flugzeit · 19 Treibstoff · Frachtkapazität: 0 – ohne Frachter geht die Beute
//                     verloren! · 40 Erz 20 Energie"
//
// Sechs Auskünfte fehlten auf dem Kartenweg, darunter die Erfolgschance und die Frachtwarnung.
//
// WARUM DIESER TEST DIE EINE RECHENSTELLE PRÜFT UND NICHT NUR DIE ANZEIGE. Der Galaxie-Reiter
// hatte seine fünfzehn Zwischenwerte inline stehen. Eine zweite Vorschau daneben wäre genau die
// zweite Anzeigestelle gewesen, die beim nächsten Balance-Schritt auseinanderläuft (Checkliste
// Punkt 6) - und der Kommentar an der alten Stelle sagte das selbst: "die Vorschau und der Kampf
// benutzen dieselbe Funktion". Deshalb rechnen beide Anzeigestellen über npcKampfLage(), und
// Abschnitt 4 misst genau das: dieselbe Flotte, derselbe Gegner, BEIDE Wege - die genannte
// Erfolgschance muss zeichengleich sein.
//
// GEPRUEFT WIRD:
//   1. Quelltext: npcKampfLage/npcVorschauHtml/npcEnterZeileHtml existieren je GENAU EINMAL, und
//      renderGalaxy rechnet nicht mehr selbst.
//   2. Kartenmenü: der Infoblock ist SICHTBAR (Regel 55) und nennt Verteidigung, Flotte,
//      Schwachstelle und Beute.
//   3. Flottenwahl: die Vorschau nennt Erfolgschance, Gegnerflotte, Schwachstelle, Enterphase,
//      Frachtkapazität und Beute.
//   4. Karte und Galaxie-Reiter nennen dieselbe Erfolgschance (die EINE Rechenstelle).
//   5. Die WIRKUNG statt der Beschriftung (Regel 61): zwei Läufe, die sich NUR in der Flotte
//      unterscheiden, müssen verschiedene Zahlen zeigen - und die Schwachstellen-Zeile muss ihre
//      Aussage umdrehen, wenn die passende Klasse mitfliegt.
//   6. Gegenrichtung: ohne gewähltes Kampfschiff steht kein Zahlensalat da, sondern die
//      Aufforderung, eines zu wählen.
//
// GEGENPROBE (beidseitig gefahren, identische 30 Prüfnamen per diff verglichen - Regel 60):
// Gegen origin/main per KEPLER_SPIELDATEI fallen 25 Prüfungen - 1a-1e, alle von 2 bis 5 und 6a.
// Zwei Beobachtungen daraus gehören hierher:
//
//   6b bleibt grün, aber AUS DEM FALSCHEN GRUND (Regel 28): "keine Erfolgschance ohne gewähltes
//   Kampfschiff" ist am alten Stand trivial erfüllt, weil es dort überhaupt keine gibt. Die
//   Prüfung trägt erst zusammen mit 6a etwas aus.
//
//   4 meldet am alten Stand {"karte":null,"galaxieReiter":71} - der Galaxie-Reiter nennt also
//   VOR und NACH dem Umbau dieselben 71%. Das ist der Beleg, dass das Herausziehen der Rechnung
//   nach npcKampfLage die Zahl nicht verschoben hat, und zwar über einen Anker, den der Umbau
//   nicht berühren konnte (Regel 62).
//
// FIXTURE-FALLE, die einen Anlauf gekostet hat und in CLAUDE.md steht: storageGet kehrt bei einer
// 404-Antwort ausdrücklich ZURÜCK statt auf localStorage zurückzufallen. Wer alle /api/-Aufrufe
// pauschal auf 404 legt, bootet ein LEERES Spiel - die Flottenwahl meldete dann "An diesem
// Standort stehen keine passenden Schiffe", und jede Vorschau-Prüfung wäre aus dem falschen Grund
// grün gewesen (Regel 28). Der Spielstand kommt deshalb über die geroutete Storage-Antwort.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
const SAVE_KEY = 'kepler7-save-v3';
/* Gemessen gewaehlt, nicht gegriffen: Die Solmark-Kriegsflotte traegt 2200 Verteidigung und die
   Schwachstelle "Bomber", und sie verlangt keine Forschung (sonst faende Abschnitt 4 sie nicht in
   der NPC-Liste des Galaxie-Reiters). Die 2200 sind der eigentliche Grund - der erste Entwurf
   nahm die Sternenzerstoerer-Flotte mit 600, und gegen die stand der Messverband mit 3,9k
   Angriffskraft in BEIDEN Laeufen am 95%-Deckel von battleWinChance. 5c mass damit den Deckel
   statt der Bomber-Wirkung (Arbeitsregel 7). Die Vorabpruefung 5-deckel haelt das fest. */
const SYS = 'solmark';
const NPC_ID = 'raider11';

// ---- 1) Quelltext: EINE Rechenstelle -------------------------------------------------------
const defs = n => (JS.match(new RegExp('function\\s+' + n + '\\s*\\(', 'g')) || []).length;
check('1a: npcKampfLage existiert genau einmal', defs('npcKampfLage') === 1, { n: defs('npcKampfLage') });
check('1b: npcVorschauHtml existiert genau einmal', defs('npcVorschauHtml') === 1, { n: defs('npcVorschauHtml') });
check('1c: npcEnterZeileHtml existiert genau einmal', defs('npcEnterZeileHtml') === 1, { n: defs('npcEnterZeileHtml') });
check('1d: die Gegner-Flottenwahl zieht ihre Vorschau daraus', /vorschau:\s*\(flotte\)\s*=>\s*npcVorschauHtml\(flotte, npcId\)/.test(JS));
/* Die eigentliche Zusage: renderGalaxy rechnet NICHT mehr selbst. Geprüft wird die URSACHE
   (die Zwischenwerte kommen aus der Lage), nicht eine Schreibweise - eine Suche nach
   "const L = npcKampfLage" allein wäre auch dann grün, wenn daneben die alte Rechnung stünde. */
const GAL = (() => {
  const i = JS.indexOf("setBoxHtml(document.getElementById('npcList')");
  const j = i < 0 ? -1 : JS.indexOf('} // Ende Galaxie-Tab-Guard', i);
  return (i >= 0 && j > i) ? JS.slice(i, j) : '';
})();
check('1-anker: der npcList-Block ist auffindbar', GAL.length > 500, { laenge: GAL.length });
check('1e: renderGalaxy rechnet die Kampflage nicht mehr selbst',
  GAL.includes('npcKampfLage(n, attackFleet)')
  && !/battleWinChance\(/.test(GAL) && !/npcEffectiveDefense\(/.test(GAL) && !/counterMultiplier\(/.test(GAL),
  { lage: GAL.includes('npcKampfLage(n, attackFleet)'),
    chance: /battleWinChance\(/.test(GAL), defense: /npcEffectiveDefense\(/.test(GAL), konter: /counterMultiplier\(/.test(GAL) });

function save(flotte){
  const jetzt = Date.now();
  const gesehen = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil']) gesehen[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:gesehen,
    resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:9e4,forschungspunkte:3e4},
    buildings:{solar:22,mine:20,labor:14,lager:30,werft:14}, research:{},
    fleet: Object.assign({ missions:[] }, flotte),
    colonies:{}, activeBasePlanet:'home', player:{ id:'u', name:'A', avatarKey:null },
    xp:9e5, credits:5e5, buffs:[], lastTick:jetzt, colonyNames:{}, modules:{}, shipModules:{},
    nextPlanetEventCheck: jetzt+3600000, nextTraderCheck: jetzt+3600000 });
}

async function tab(browser, flotte){
  const store = { [SAVE_KEY]: save(flotte) };
  const ctx = await browser.newContext({ viewport:{ width:1400, height:1000 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', async r => {
    const req = r.request();
    const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null,
      unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[], alienNester:[] });
    if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    return j({ ok:true });
  });
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.remove(); }));
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
  await page.waitForTimeout(900);
  return { ctx, page, errs };
}

// Der Spielerweg: System öffnen, Gegner antippen, Menü lesen.
async function kartenmenue(page){
  const auf = await oeffneSystemUeberSektoren(page, SYS);
  if (!auf) return { auf:false };
  await page.evaluate(id => {
    const g = document.querySelector('#galaxyMapSvg [data-map-npc="' + id + '"]');
    if (g) g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, NPC_ID);
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const m = document.querySelector('.kmenu');
    if (!m) return { auf:true, da:false };
    const info = m.querySelector('.kmenu-info');
    // SICHTBARKEIT statt blosser Existenz (Regel 55) - ein Block hinter einem geschlossenen
    // <details> oder mit Hoehe 0 waere im DOM da und fuer den Spieler trotzdem nicht.
    const r = info ? info.getBoundingClientRect() : null;
    return { auf:true, da:!!info, hoehe: r ? Math.round(r.height) : 0,
      text: info ? (info.textContent||'').replace(/\s+/g,' ').trim() : '' };
  });
}
// Flottenwahl oeffnen, komplette Flotte waehlen, die Vorschau-Zeilen lesen.
async function flottenwahl(page, kompletteFlotte){
  await page.evaluate(() => { const b=[...document.querySelectorAll('.kmenu button')].find(x=>/Angreifen/.test(x.textContent||'')); if(b) b.click(); });
  await page.waitForTimeout(700);
  if (kompletteFlotte !== false){
    await page.evaluate(() => { const b=[...document.querySelectorAll('#fwahlOverlay button')].find(x=>/Komplette Flotte/.test(x.textContent||'')); if(b) b.click(); });
  } else {
    await page.evaluate(() => { const b=[...document.querySelectorAll('#fwahlOverlay button')].find(x=>/^Nichts$/.test((x.textContent||'').trim())); if(b) b.click(); });
  }
  await page.waitForTimeout(600);
  return page.evaluate(() => {
    const ov = document.getElementById('fwahlOverlay');
    if (!ov || ov.style.display === 'none') return { da:false };
    return { da:true, zeilen:[...ov.querySelectorAll('.bmeta')].map(d => (d.textContent||'').replace(/\s+/g,' ').trim()) };
  });
}
// Dieselbe Zahl auf dem ANDEREN Weg - der Galaxie-Reiter.
async function galaxieChance(page){
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="galaxie"]'); if (b) b.click(); });
  await page.waitForTimeout(1200);
  return page.evaluate(id => {
    const l = document.getElementById('npcList');
    if (!l) return null;
    const k = [...l.children].find(c => c.querySelector('[data-attack="' + id + '"]'));
    if (!k) return null;
    const m = (k.textContent||'').match(/Erfolgschance ~(\d+)%/);
    return m ? parseInt(m[1], 10) : null;
  }, NPC_ID);
}
const chanceAus = zeilen => {
  const z = (zeilen||[]).find(x => /Erfolgschance/.test(x));
  const m = z && z.match(/~(\d+)%/);
  return m ? parseInt(m[1], 10) : null;
};

(async () => {
  const browser = await starteBrowser();

  // ---- 2/3/4) Der volle Fall: Verband OHNE die Schwachstelle (Bomber) ------------------------
  /* Traegerschiffe sind Pflicht, und zwar reichlich: capFighterSelection kappt Jaeger UND Bomber
     auf die Hangar-Kapazitaet der mitgeschickten Traeger, und deployableFighters bedient dabei
     ZUERST die Jaeger. Der erste Entwurf hatte carrier:10 (= 60 Plaetze) bei 60 Jaegern - fuer
     die 18 Bomber blieb nichts uebrig, sie flogen gar nicht mit, und 5b/5c fielen auf voellig
     korrektem Code durch. Dieselbe Falle steht in CLAUDE.md bei den Festungs-Rollenfaktoren.
     Mit 30 Traegern (180 Plaetze) passen beide Klassen; die Vorab-Pruefung 5-hangar belegt es
     MESSEND, statt es zu glauben. */
  const OHNE = { jaeger:60, cruisers:30, destroyers:20, schlachtschiff:12, carrier:30, frachter:25, enterschiff:6 };
  const MIT  = Object.assign({}, OHNE, { bomber:18 });
  let chanceKarteOhne = null, chanceGalOhne = null, zeilenOhne = [];
  {
    const t = await tab(browser, OHNE);
    const km = await kartenmenue(t.page);
    check('2-anker: das System steht offen und das Gegner-Menü ist auf', km.auf === true && km.da === true, km);
    check('2a: der Infoblock ist SICHTBAR (Höhe > 0)', km.hoehe > 0, { hoehe: km.hoehe });
    check('2b: er nennt die Verteidigung', /Verteidigung/.test(km.text) && /\d/.test(km.text), { text: km.text });
    check('2c: er nennt die feindliche Flotte', /Flotte:/.test(km.text), { text: km.text });
    check('2d: er nennt die Schwachstelle', /Schwachstelle:/.test(km.text), { text: km.text });
    check('2e: er nennt die Beute', /Beute bei Sieg/.test(km.text), { text: km.text });

    const fw = await flottenwahl(t.page);
    zeilenOhne = fw.zeilen || [];
    check('3-anker: die Flottenwahl steht offen', fw.da === true);
    check('3a: die Vorschau nennt die Erfolgschance', zeilenOhne.some(z => /Erfolgschance ~\d+%/.test(z)), { zeilen: zeilenOhne });
    check('3b: sie nennt die gegnerische Flotte', zeilenOhne.some(z => /Gegnerische Flotte/.test(z)), { zeilen: zeilenOhne });
    check('3c: sie nennt die Schwachstelle', zeilenOhne.some(z => /Schwachstelle:/.test(z)), { zeilen: zeilenOhne });
    check('3d: sie nennt die Enterphase', zeilenOhne.some(z => /Enterphase/.test(z)), { zeilen: zeilenOhne });
    check('3e: sie nennt die Frachtkapazität', zeilenOhne.some(z => /Frachtkapazität/.test(z)), { zeilen: zeilenOhne });
    check('3f: sie nennt die Beute', zeilenOhne.some(z => /Beute bei Sieg/.test(z)), { zeilen: zeilenOhne });

    chanceKarteOhne = chanceAus(zeilenOhne);
    chanceGalOhne = await galaxieChance(t.page);
    /* DIE zentrale Prüfung: Beide Wege nennen dieselbe Zahl, weil sie dieselbe Funktion rechnen.
       Baut jemand später eine zweite Rechnung, fällt genau das hier auf. */
    check('4: Karte und Galaxie-Reiter nennen dieselbe Erfolgschance',
      chanceKarteOhne !== null && chanceKarteOhne === chanceGalOhne,
      { karte: chanceKarteOhne, galaxieReiter: chanceGalOhne });
    check('4b: der Lauf blieb ohne Konsolenfehler', t.errs.length === 0, { errs: t.errs.slice(0,3) });
    await t.ctx.close();
  }

  // ---- 5) Die WIRKUNG statt der Beschriftung (Regel 61) -------------------------------------
  /* Zwei Läufe, die sich NUR im Bomber unterscheiden. Eine Prüfung auf "das Wort Schwachstelle
     steht da" wäre in beiden Fällen grün - sie misst das Etikett. Gemessen wird deshalb, dass
     die Aussage sich UMDREHT und dass die genannte Zahl eine andere ist. */
  {
    const t = await tab(browser, MIT);
    await kartenmenue(t.page);
    const fw = await flottenwahl(t.page);
    const zeilenMit = fw.zeilen || [];
    /* Fliegen die Bomber ueberhaupt mit? Ohne diesen Beleg misst der Abschnitt nicht die
       Schwachstelle, sondern den Hangardeckel - und ein Fehlschlag saehe aus wie ein Fehler im
       Spiel (Regel 28/37). Gemessen an der Verbandsgroesse, die die Flottenwahl selbst nennt. */
    const zahlAus = zeilen => { const z=(zeilen||[]).find(x=>/ Schiffe · /.test(x)); const m=z&&z.match(/^([\d.]+k?) Schiffe/); return m?m[1]:null; };
    check('5-hangar: der zweite Verband ist um die Bomber groesser',
      zahlAus(zeilenMit) !== null && zahlAus(zeilenOhne) !== null && zahlAus(zeilenMit) !== zahlAus(zeilenOhne),
      { ohneBomber: zahlAus(zeilenOhne), mitBomber: zahlAus(zeilenMit) });
    check('5-deckel: die Messung steht nicht am 95%-Anschlag', chanceKarteOhne !== null && chanceKarteOhne < 95,
      { chance: chanceKarteOhne });
    const schwaecheOhne = zeilenOhne.find(z => /Schwachstelle:/.test(z)) || '';
    const schwaecheMit  = zeilenMit.find(z => /Schwachstelle:/.test(z)) || '';
    check('5-anker: beide Läufe haben eine Schwachstellen-Zeile', !!schwaecheOhne && !!schwaecheMit,
      { ohne: schwaecheOhne, mit: schwaecheMit });
    check('5a: ohne die passende Klasse sagt sie, dass sie FEHLT', /fehlt im Verband/.test(schwaecheOhne), { zeile: schwaecheOhne });
    check('5b: mit ihr sagt sie, dass sie DABEI ist', /im Verband dabei/.test(schwaecheMit), { zeile: schwaecheMit });
    const chanceMit = chanceAus(zeilenMit);
    check('5c: die genannte Erfolgschance ist eine andere', chanceMit !== null && chanceKarteOhne !== null && chanceMit !== chanceKarteOhne,
      { ohneBomber: chanceKarteOhne, mitBomber: chanceMit });
    check('5d: und auch der Galaxie-Reiter zieht mit', await galaxieChance(t.page) === chanceMit,
      { karte: chanceMit });
    await t.ctx.close();
  }

  // ---- 6) Gegenrichtung: ohne Kampfschiff kein Zahlensalat ----------------------------------
  {
    const t = await tab(browser, OHNE);
    await kartenmenue(t.page);
    const fw = await flottenwahl(t.page, false);
    const zeilen = fw.zeilen || [];
    check('6a: ohne gewähltes Kampfschiff steht die Aufforderung da',
      zeilen.some(z => /Wähle mindestens ein Kampfschiff/.test(z)), { zeilen });
    check('6b: und KEINE Erfolgschance', !zeilen.some(z => /Erfolgschance/.test(z)), { zeilen });
    await t.ctx.close();
  }

  await browser.close();
  ende();
})();
