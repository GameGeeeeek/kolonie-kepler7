// Der Planet hinter der Oberfläche - das Orbitalglas (Bündel F, 06.09.2026, Grafik-Aufnahme).
//
//   node tests/test_kulissenplanet.js
//
// GEMESSEN AM ALTEN STAND: Der Kulissenplanet unten links trug nur die GRUNDFARBE seines Typs
// (aktiverStandortTon liest PLANET_TYPE_INFO[typ].color) auf einem linearen Verlauf. Seit Bündel A
// hat jeder der 13 Weltentypen eine echte Textur, die auf der Karte, in der Kachel und auf dem
// Planetenboden der Kampf-Wiedergabe liegt. Der Ort, an dem man gerade STEHT, war damit die
// einzige Stelle im Spiel, an der eine Eiswelt aussah wie eine Lavawelt in anderer Farbe.
//
// WARUM HIER EIN MERKMAL GELESEN WIRD UND KEIN BILD GEMESSEN:
// Der Planet ist ausdrücklich Kulisse - 0,42 Gesamtdeckkraft, die Textur darin noch einmal 0,55.
// Eine Rauheitsmessung auf der zusammengesetzten Leinwand (#bgstars trägt Sterne UND Planet) wurde
// versucht und GEMESSEN verworfen: Sie lieferte am alten wie am neuen Stand Werte zwischen 3 und 7
// und war am neuen sogar niedriger - gemessen wurden Sterne und Farbbänderung, nicht die
// Oberfläche. Der Zeichner schreibt deshalb seinen Zustand als data-standort an die Leinwand,
// dasselbe Muster wie die data-vp-*-Merkmale am Vorposten, und der Wächter LIEST ihn.
//
// DIE ARBEITSTEILUNG DER WÄCHTER (bewusst, damit hier nichts doppelt und nichts gar nicht steht):
//   tests/test_planeten_texturen.js sichert, dass die 13 Texturen existieren, deterministisch
//     sind und sich voneinander unterscheiden (dort 1f: mindestens 30 % andere Pixel).
//   DIESER Test sichert, dass der Kulissenplanet sie auch WIRKLICH benutzt - dass der Zweig läuft
//     und mit einem echten Weltentyp läuft, nicht mit dem Vorgabe-Blau.
//
// Gegenprobe: siehe Fuß der Datei.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];
const ICH = 'u-ich';
const now = Date.now();

// Die im Spiel zeigbaren Weltentypen kommen aus dem Quelltext, nicht aus einer Liste im Testkopf.
const TYPEN = (() => {
  const m = JS.match(/const PLANET_TYPE_INFO = \{([\s\S]{0,4000}?)\n  \};/);
  return m ? [...m[1].matchAll(/^\s{4}(\w+)\s*:/gm)].map(x => x[1]) : [];
})();

check('0-anker: die Weltentypen sind aus dem Quelltext gelesen', TYPEN.length >= 10, TYPEN.length);
check('0a: die Textur wird auf die Kugel geschnitten und liegt UNTER dem Terminator',
  /\/\/ Die Oberfläche des Weltentyps, auf die Kugel geschnitten\./.test(JS)
  && /c\.drawImage\(tex, \(tex\.width - kante\)\/2, 0, kante, kante, px - pr, py - pr, pr\*2, pr\*2\);/.test(JS)
  && JS.indexOf('c.drawImage(tex, (tex.width - kante)') < JS.indexOf('// Terminator: weicher'));
/* Der quadratische Mittelausschnitt ist kein Schönheitsdetail: Die Textur ist ein 2:1-Streifen
   (voller Rundumblick). Wird die volle Breite in einen Kreis gezwängt, entsteht das
   strahlenförmige Artefakt aus dem Fehlerbericht vom 16.07.2026 - derselbe Fehler, den
   drawPlanetMiniIcon und getPlanetTextureDataUrl schon einmal hatten. */
check('0b: der Zeichner nimmt den quadratischen Mittelausschnitt, nicht die volle Streifenbreite',
  /const kante = tex\.height;/.test(JS));
/* Der Zwischenspeicher muss sich merken, OB die Textur da war. Sonst bliebe ein Planet, dessen
   Textur beim allerersten Bild noch nicht fertig war, für den Rest der Sitzung flach - der Sprite
   wird ja nur bei Schlüsselwechsel neu gebaut. */
check('0c: der Zwischenspeicher merkt sich, ob die Textur da war',
  /const merk = key \+ \(tex \? '\|textur' : '\|flach'\);/.test(JS)
  && /if \(planetSprite && planetSpriteKey === merk\) return planetSprite;/.test(JS)
  && /planetSpriteKey = merk;/.test(JS));

function spielstand(){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil','sammlung']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:60, werft:14 }, research:{}, fleet:{ jaeger:80, cruisers:12, missions:[] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:5e5, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }), 'kepler7-save-v3': spielstand() };
  await page.route('**/api/**', async r => {
    const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[], alienNester:[], controlledSystems:{}, wrackKonvois:[] });
    if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
    if (p === 'reports') return j(req.method() === 'POST' ? { ok:true } : { reports:[] });
    if (p === 'players-map') return j({ players:[] });
    if (p === 'pending-rewards/claim') return j({ reward:null });
    if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
    if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]); return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
    if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8)); if (req.method() === 'PUT'){ try { st[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true, version:2 }); } if (st[k] !== undefined) return j({ key:k, value:st[k], version:1 }); return j({ error:'nicht gefunden' }, 404); }
    return j({ ok:true });
  });
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(6000);

  const m = await page.evaluate(() => {
    const cv = document.getElementById('bgstars');
    return { da: !!cv, standort: cv ? (cv.dataset.standort || null) : null,
             breite: cv ? cv.width : 0, hoehe: cv ? cv.height : 0 };
  });
  check('1-vorab: die Kulissen-Leinwand steht und hat Fenstergröße, ohne Skriptfehler',
    m.da && m.breite > 100 && m.hoehe > 100 && errs.length === 0,
    { breite: m.breite, hoehe: m.hoehe, fehler: errs.slice(0,2) });
  const teil = String(m.standort || '').split('|');
  check('1a: der Kulissenplanet meldet, dass er die Textur seines Typs gezeichnet hat',
    teil[1] === 'textur', { standort: m.standort });
  /* Nicht nur "irgendein Typ": Das Vorgabe-Blau und der Mond sind die beiden Zweige OHNE Textur.
     Meldet der Planet einen von beiden, hat die Fixture keinen echten Standort - dann wäre 1a
     grün, ohne dass je eine Weltentextur im Spiel war. */
  check('1b: und zwar mit einem echten Weltentyp, nicht mit dem Vorgabe-Blau',
    TYPEN.includes(teil[0]), { typ: teil[0], bekannteTypen: TYPEN.length });

  await ctx.close();
  await browser.close();
  ende();
})().catch(e => { console.log('FAIL - Ausnahme: ' + (e && e.stack || e)); process.exit(1); });
//
// GEGENPROBE GEMESSEN 06.09.2026:
//   grün: node tests/test_kulissenplanet.js                                   (7 von 7)
//   rot am Stand vor Bündel F (KEPLER_SPIELDATEI=/tmp/alt.html): 0a 0b 0c 1a 1b (fünf von sieben).
//     Prüfnamen beider Läufe per diff verglichen und identisch (7 zu 7).
//     1a meldet dort standort:null - es gibt kein Merkmal, weil es den Zweig nicht gibt.
// Warum 1b überhaupt neben 1a steht: 1a allein wäre grün zu bekommen, ohne dass je eine
// Weltentextur im Spiel war - nämlich wenn die Fixture keinen echten Standort hätte und der
// Zeichner auf das Vorgabe-Blau fiele. 1b prüft deshalb den GRUND mit, nicht nur den Zustand.
