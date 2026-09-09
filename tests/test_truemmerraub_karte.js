// KS-8: Die Piraten-Truemmerraeuber stehen auf der Karte.
//
//   node tests/test_truemmerraub_karte.js
//
// DIE LUECKE, gemessen: Die Raeuber hatten KEINE dauerhafte Anzeige ausserhalb der
// Verteidigungs-Box - nur einen Toast von gut vier Sekunden bei zehn Minuten Frist. Die Karte
// zeigt das Truemmerfeld laengst (das „T"-Zeichen); sie musste nur noch sagen, dass jemand daran
// arbeitet.
//
// GEPRUEFT WIRD DIE REGEL:
//   1a  Waehrend eines Raubs traegt das Truemmer-Zeichen ein anderes Symbol und einen Puls.
//   1b  Der vorhandene Klicktext nennt den Raub ZUERST - eine Recycler-Restzeit ist neben einer
//       laufenden Pluenderung die falsche erste Auskunft - samt Restzeit und dem Weg zum Abfangen.
//   2a  OHNE Raub ist alles wie vorher: „T", kein Puls. Ohne diese Gegenrichtung waere 1a auch
//       dann gruen, wenn das Zeichen IMMER so aussaehe.
//   2b  KEIN zweites antippbares Ding auf denselben Koordinaten. Zwei Klickziele uebereinander
//       sind die meistreparierte Stelle dieser Karte; diese Anzeige braucht keines.
//   3a  DAS FELD EINES MONDES (dritte Durchsicht an PR #614): `pickRaidTargetPlanet` zieht aus
//       `['home', ...Object.keys(state.colonies)]`, und Mondkolonien wohnen dort unter
//       `moon_<planetId>` - ein abgewehrter Ueberfall auf einem Mond legt sein Truemmerfeld also
//       unter diesem Schluessel an, und `pirateDebrisRaidCandidates` zaehlt jeden Schluessel des
//       Bestands auf. Die Karte kannte nur den Planetenschluessel; ein zehnminuetiger Raub am
//       Mondfeld stand nirgends. Gemessen mit genau diesem Spielstand.
//   3b  UND DER HEIMATMOND (vierte Durchsicht an PR #614): Die Heimatbasis wird GETRENNT von der
//       Planetenschleife gezeichnet, ihr Truemmerzeichen fragt nur `debrisFields.home`. `moon_home`
//       ist derselbe Fall wie 3a auf dem zweiten Zeichenweg - zwei Wege, dieselbe Zusage.
//
// NICHT ENTHALTEN und das steht hier, damit niemand es fuer vergessen haelt: die FLUGBAHN der
// Abfangflotte. `MISSION_LINIEN` kennt 'intercept-pirates' nicht, und die Art dort aufzunehmen
// waere eine eigene Entscheidung mit eigener Kopie-Familie (test_sprungtor_route 2a haelt die
// Liste fest) - kein Beiwerk dieser Anzeige.
//
// GEGENPROBE: `KEPLER_SPIELDATEI` auf den Stand vor KS-8, Aufruf mit KEPLER_RAUB_GEGENPROBE=alt.
// Dort fallen 1a und 1b. 2a und 2b bleiben gruen und sind die Waechter ueber die Auflagen.
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();
const ergebnis = {};
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };

const SAB = process.env.KEPLER_RAUB_GEGENPROBE || '';
/* GEMESSEN, nicht gesetzt: Am Stand vor KS-8 gibt es gar kein Mond-Abzeichen, also fallen 3a bis
   3d dort mit; `flaeche` ist der Stand mit der ALTEN Platzierung unten links, dort verlieren beide
   Abzeichen Punkte an die Beschriftung (der Heimatmond vier von fuenf). */
const MUSS_FALLEN = { alt: ['1a', '1b', '3a', '3b', '3c', '3d'], mond: ['3a'], heimatmond: ['3b'],
                      flaeche: ['3c', '3d'] };
/* Der Traeger des Mondes wird aus der Spieldatei GELESEN, nicht erfunden: Ein erfundener
   Schluessel liefert keinen Kartenknoten, und die Pruefung waere still leer. */
const fsM = require('fs');
const QUELLE = fsM.readFileSync(process.env.KEPLER_SPIELDATEI || require('./lib/umgebung').SPIELDATEI, 'utf8');
const MONDPLANET = ((QUELLE.match(/\{ id:'(\w+)',[^\n]*system:'kepler'/g) || [])
  .map(z => (z.match(/id:'(\w+)'/) || [])[1]).filter(Boolean))[0];
const now = Date.now();

function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0 });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, unlockedAlienRaces:[],
      collapsedSystems:{}, activeWormhole:null, activePirateFaction:null, activeWar:null,
      news:[], controlledSystems:{}, factions:{}, alienNester:[], wrackKonvois:[] });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    return j({});
  };
}

/* `mitRaub` ist der EINZIGE Unterschied zwischen beiden Laeufen - alles andere bleibt gleich,
   sonst maesse 2a etwas, das sich auch aus einem anderen Grund unterscheiden koennte. */
function spielstand(mitRaub, mond){
  return JSON.stringify({
    tutorialSeen:true, newbieWelcomeSeen:true,
    resources:{ energie:48000, erz:52000, kristalle:31000, deuterium:20000, antimaterie:900, forschungspunkte:2200 },
    buildings:{ solar:18, mine:17, kristallmine:15, labor:10, lager:12, werft:9 },
    research:{}, fleet:{ jaeger:400, cruisers:60, ships:3, missions:[] },
    discovered:{}, colonies:{}, activeBasePlanet:'home',
    debrisFields: mond
      ? { [mond]: { erz: 4000, kristalle: 1500 } }
      : { home: { erz: 4000, kristalle: 1500 } },
    pirateDebrisRaid: mitRaub
      ? { planetKey: mond || 'home', fleet:{ recycler:4, jaeger:2 }, power: 120,
          startTime: now - 60000, endTime: now + 480000, interceptArrival:null, interceptSource:null }
      : null,
    player:{ id:'u', name:'A' }, xp:52000, credits:184000, buffs:[], lastTick: now,
    colonyNames:{}, colonyNotes:{}, activeEvent:null,
    nextPlanetEventCheck: now + 36e5, nextTraderCheck: now + 36e5, nextRaidTime: now + 36e5
  });
}

async function messen(mitRaub, browser, mond){
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend({ 'kepler7-save-v3': spielstand(mitRaub, mond) }));
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
  const offen = await oeffneSystemUeberSektoren(page, 'kepler');
  await page.waitForTimeout(1800);
  const m = await page.evaluate(schluessel => {
    const svg = document.getElementById('galaxyMapSvg');
    /* Beim Mondlauf wird GENAU sein Marker gesucht, nicht der erste beste: Ein Treffer auf dem
       Planetenmarker daneben waere aus dem falschen Grund gruen. */
    const g = svg && (schluessel ? svg.querySelector('[data-map-debris="' + schluessel + '"]')
                                 : svg.querySelector('[data-map-debris]'));
    if (!g) return { marker:false };
    const t = g.querySelector('text');
    return { marker:true,
      zeichen: t ? (t.textContent || '').trim() : '',
      puls: g.querySelectorAll('animate').length,
      klickziele: svg.querySelectorAll('[data-map-debris]').length,
      /* TREFFERFLAECHE: Rechtecke des Abzeichens und der naechstliegenden Beschriftung, dazu das
         Element, das ein Tipp auf die Abzeichenmitte wirklich trifft. Beides am gerenderten
         Bild, nicht gerechnet. */
      flaeche: (() => {
        /* Der Puls laeuft weit ueber die Scheibe hinaus, `getBoundingClientRect()` der Gruppe
           waere also viel zu gross. Gemessen wird die SCHEIBE - das ist, was der Spieler trifft. */
        const scheibe = g.querySelector('circle');
        const r = scheibe.getBoundingClientRect();
        const mx = r.left + r.width/2, my = r.top + r.height/2, d = r.width/4;
        const punkte = [[mx,my],[mx-d,my],[mx+d,my],[mx,my-d],[mx,my+d]];
        const treffer = punkte.map(([x,y]) => {
          const e = document.elementFromPoint(x, y);
          return e ? (e.closest('[data-map-debris]') ? 'abzeichen'
                   : (e.tagName + '.' + (e.getAttribute('class')||''))) : 'nichts';
        });
        return { treffer, eigene: treffer.filter(t => t === 'abzeichen').length, punkte: punkte.length };
      })() };
  }, mond || null);
  /* Der Klicktext kommt aus dem VORHANDENEN Klickziel - dasselbe, das der Spieler antippt. Der
     Klick loest `pushToast(...)` aus (gemessen an der Verdrahtung), also wird der TOAST gelesen und
     nicht das Protokoll: Der erste Entwurf las `#log` und bekam dessen aelteste Zeile - die
     Pruefung „nennt den Raub zuerst" fiel damit auf richtigem Code durch. */
  await page.evaluate(schluessel => {
    const n = document.querySelector('#galaxyMapSvg ' +
      (schluessel ? '[data-map-debris="' + schluessel + '"]' : '[data-map-debris]'));
    if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:200, clientY:200 }));
  }, mond || null);
  await page.waitForTimeout(400);
  const text = await page.evaluate(() => {
    const t = [...document.querySelectorAll('.toast, [class*=toast]')]
      .map(e => (e.textContent || '').trim()).filter(Boolean);
    return t.length ? t[t.length-1] : '';
  });
  await ctx.close();
  return Object.assign(m, { offen, text, errs });
}

(async () => {
  const browser = await starteBrowser();
  const mit  = await messen(true, browser);
  const ohne = await messen(false, browser);
  const mond = await messen(true, browser, 'moon_' + MONDPLANET);
  const heimatmond = await messen(true, browser, 'moon_home');
  await browser.close();

  merke('0a: das Truemmer-Zeichen steht in beiden Laeufen', mit.marker === true && ohne.marker === true,
    { mit: mit.marker, ohne: ohne.marker });
  merke('1a: waehrend eines Raubs traegt es ein anderes Zeichen und pulst',
    mit.zeichen === '☠' && mit.puls >= 2,
    { zeichen: mit.zeichen, puls: mit.puls });
  merke('1b: der vorhandene Klicktext nennt den Raub ZUERST, mit Restzeit und Weg zum Abfangen',
    /^[^\n]*Piraten plündern dieses Trümmerfeld/.test((mit.text||'').trim())
    && /noch \d/.test(mit.text || '') && /Verteidigungs-Reiter/.test(mit.text || ''),
    { auszug: (mit.text || '').slice(0, 150) });
  merke('2a: ohne Raub ist alles wie vorher - „T", kein Puls',
    ohne.zeichen === 'T' && ohne.puls === 0 && !/plündern/.test(ohne.text || ''),
    { zeichen: ohne.zeichen, puls: ohne.puls });
  merke('2b: kein zweites antippbares Ding auf denselben Koordinaten',
    mit.klickziele === ohne.klickziele && mit.klickziele === 1,
    { mit: mit.klickziele, ohne: ohne.klickziele });
  /* 3a: Derselbe Massstab wie 1a und 1b, nur am Mondschluessel. Der Traegerplanet steht daneben,
     damit ein leerer MONDPLANET nicht als stille gruene Pruefung durchgeht. */
  merke('3a: das Truemmerfeld eines MONDES bekommt denselben Marker und Klicktext',
    !!MONDPLANET && mond.marker === true && mond.zeichen === '☠' && mond.puls >= 2
      && /Piraten plündern dieses Trümmerfeld/.test(mond.text || ''),
    { traeger: MONDPLANET, marker: mond.marker, zeichen: mond.zeichen, puls: mond.puls,
      auszug: (mond.text || '').slice(0, 90) });
  /* 3b: Derselbe Massstab auf dem ZWEITEN Zeichenweg. Die Heimatbasis steht nur im eigenen
     Heimatsystem, das der Lauf ohnehin oeffnet (kepler). */
  merke('3b: auch der HEIMATMOND bekommt Marker und Klicktext',
    heimatmond.marker === true && heimatmond.zeichen === '☠' && heimatmond.puls >= 2
      && /Piraten plündern dieses Trümmerfeld/.test(heimatmond.text || ''),
    { marker: heimatmond.marker, zeichen: heimatmond.zeichen, puls: heimatmond.puls,
      auszug: (heimatmond.text || '').slice(0, 90) });
  /* 3c/3d: DIE TREFFERFLAECHE (fuenfte Durchsicht an PR #614). Ein Abzeichen, dessen Flaeche eine
     SPAETER gezeichnete Beschriftung abfaengt, hat seinen Klicktext nur auf dem Papier -
     `.planet-label` setzt kein `pointer-events`. Gemessen wird die Zusage selbst: Ein Tipp auf das
     Abzeichen landet IM Abzeichen, an fuenf Punkten seiner Scheibe (Mitte und vier Richtungen),
     nicht nur in der Mitte - ein halb verdecktes Abzeichen faellt sonst nicht auf.
     BEWUSST NICHT geprueft wird, ob irgendeine Beschriftung sein Rechteck SCHNEIDET: Der
     Beschriftungs-Entflechter nimmt als Hindernis nur die gezeichneten Koerper, nie Abzeichen -
     das ist eine ausdrueckliche Entscheidung (Kommentar an `kbLabelsEntflechten`), und kein
     Abzeichen dieser Karte erfuellt sie. Eine Pruefung, die mehr verlangt als der Entwurf
     einloest, misst nicht die Zusage, sondern eine Wunschvorstellung. */
  merke('3c: jeder Punkt des Mond-Abzeichens faengt seinen eigenen Tipp',
    !!mond.flaeche && mond.flaeche.eigene === mond.flaeche.punkte, mond.flaeche);
  merke('3d: dasselbe am Heimatmond', 
    !!heimatmond.flaeche && heimatmond.flaeche.eigene === heimatmond.flaeche.punkte, heimatmond.flaeche);
  merke('2c: keine Skriptfehler', (mit.errs||[]).length === 0 && (ohne.errs||[]).length === 0,
    { mit: (mit.errs||[]).slice(0,2), ohne: (ohne.errs||[]).slice(0,2) });

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
