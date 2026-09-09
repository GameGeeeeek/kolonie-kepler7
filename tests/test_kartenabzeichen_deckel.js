// KS-5: Die Abzeichenzeile eines Systemknotens laeuft nicht mehr aus dem Bild.
//
//   node tests/test_kartenabzeichen_deckel.js
//
// NACHGERECHNET, nicht geschaetzt (Kartenanalyse 08.09.2026): Die Zeichen sitzen in der
// Sektoransicht bei `x - 16 - i*14`, die Knotenspalten bei `[66, 200, 334] * W/400`. Am Handy ist
// W exakt 400, die linke Spalte also bei x = 66:
//     i=0 -> 50   i=1 -> 36   i=2 -> 22   i=3 -> 8   i=4 -> -6
// Das FUENFTE Zeichen liegt ausserhalb der viewBox. `karteSystemBadges` kann bis zu zwoelf
// liefern, gedeckelt wurde nirgends - ob ein Spieler den Wrackkonvoi, den Vorposten oder den NPC
// sieht, hing damit an seiner Bildschirmbreite statt an seiner Aufklaerung.
//
// GEPRUEFT WIRD DIE REGEL, nicht die Zahl vier:
//   1a  Vorbedingung: Das Fixture erzeugt an EINEM Knoten mehr Abzeichen, als Plaetze da sind.
//       Ohne diese Messung prueften 1b und 1c einen Fall, den es gar nicht gibt.
//   1b  KEIN gezeichnetes Abzeichen liegt ausserhalb der viewBox. Das ist die eigentliche Zusage
//       und sie kennt die Zahl vier nicht - sie misst das Bild.
//   1c  Was nicht hineinpasst, verschwindet nicht stillschweigend: Eine Zaehlmarke „+N" steht da,
//       und ihr Titel nennt, WAS sie verdeckt. Eine Marke ohne Auskunft waere nur ein Kuerzel
//       fuer „hier fehlt etwas".
//   1d  Die Summe stimmt: gezeigte Zeichen plus N ergibt genau die Zahl der Abzeichen, die
//       `karteSystemBadges` fuer dieses System liefert. Damit kann der Deckel nichts verlieren,
//       ohne dass es auffaellt.
//
// GEGENPROBE: `KEPLER_SPIELDATEI` auf den Stand vor KS-5, Aufruf mit KEPLER_DECKEL_GEGENPROBE=alt.
// Dort fallen 1b, 1c und 1d - die Zeile laeuft ungedeckelt weiter und es gibt keine Marke.
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSektorMitSystem } = require('./lib/karte');
const { check, ende } = pruefer();
const ergebnis = {};
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };

const SAB = process.env.KEPLER_DECKEL_GEGENPROBE || '';
const MUSS_FALLEN = { alt: ['1b', '1c', '1d'] };
const SYS = 'vega';
const now = Date.now();

/* FUENF Abzeichen an EINEM Knoten, alle aus der Galaxie-Antwort: Piratenbasis, Krieg, Wurmloch,
   Alien-Nest und Wrackkonvoi. Das Alien-Abzeichen faellt dabei bewusst weg - es erscheint nur,
   wenn KEIN Nest im System steht (gemessen in karteSystemBadges), und eine Vorlage, die beides
   gleichzeitig erwartet, pruefte sich selbst. */
/* WELCHER KNOTEN die Abzeichen bekommt, wird GEMESSEN und nicht gewaehlt: Der Ueberlauf trifft
   die LINKE Spalte (x = 66 bei W = 400), und welches System dort steht, rechnet das Spiel selbst
   (sektorVon, k-means). Eine eingetippte Kennung waere beim naechsten neuen System falsch - und
   der Test waere dann gruen, ohne den Fall je gesehen zu haben.
   Deshalb zwei Durchgaenge: erst nachsehen, wer links steht, dann mit den Abzeichen dort neu
   laden. */
let zielSys = SYS;
function galaxie(){
  const SYS = zielSys;
  return { npcEmpireStrength:1, marketTrend:1, unlockedAlienRaces:[], collapsedSystems:{},
    activePirateFaction: { system: SYS, name:'Testpiraten' },
    activeWar: { system: SYS, factionA:'Kartell', factionB:'Legion' },
    activeWormhole: { from: SYS, to:'kepler', bis: now + 36e5 },
    alienNester: [{ id:'n1', sys: SYS, volk:'verglueht', volkName:'Die Verglühten', stufe:3,
                    lp: 30000, lpMax: 40000, seit: now - 86400000 }],
    wrackKonvois: [{ id:'k1', sys: SYS, rumpf: 800, rumpfMax: 1000, bis: now + 36e5 }],
    news:[], controlledSystems:{}, factions:{} };
}

function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0 });
    if (p === 'galaxy') return j(galaxie());
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    return j({});
  };
}

(async () => {
  const browser = await starteBrowser();
  const store = {};
  store['kepler7-save-v3'] = JSON.stringify({
    tutorialSeen:true, newbieWelcomeSeen:true,
    resources:{ energie:48000, erz:52000, kristalle:31000, deuterium:20000, antimaterie:900, forschungspunkte:2200 },
    buildings:{ solar:18, mine:17, kristallmine:15, labor:10, lager:12, werft:9 },
    research:{}, fleet:{ jaeger:100, ships:3, missions:[] },
    discovered:{}, colonies:{}, activeBasePlanet:'home',
    player:{ id:'u', name:'A' }, xp:52000, credits:184000, buffs:[], lastTick: now,
    colonyNames:{}, colonyNotes:{}, activeEvent:null,
    nextPlanetEventCheck: now + 36e5, nextTraderCheck: now + 36e5, nextRaidTime: now + 36e5
  });

  /* AM HANDY GEMESSEN (390x844), nicht am PC: Dort ist die viewBox-Breite 400, und genau dort
     lief die Zeile aus dem Bild. Ein Lauf bei 1280 Punkten haette den Fehler nie gesehen. */
  const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
  const page = await ctx.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
     'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.remove(); });
    const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click();
  });
  await page.waitForTimeout(1200);
  const sektorDa = await oeffneSektorMitSystem(page, SYS);
  await page.waitForTimeout(1200);
  merke('0a: die Sektoransicht mit ' + SYS + ' steht', sektorDa === true, { sektorDa });

  /* Der linkeste Knoten der Region - an ihm ist der Platz am knappsten. Abgelesen an der
     x-Angabe seiner Namenszeile, weil die exakt auf der Knotenmitte sitzt. */
  const links = await page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    let best = null;
    for (const g of svg.querySelectorAll('[data-sektor-sys]')){
      const t = [...g.querySelectorAll('text')].sort((a,b) => Number(b.getAttribute('y')) - Number(a.getAttribute('y')))[0];
      if (!t) continue;
      const x = Number(t.getAttribute('x'));
      if (!best || x < best.x) best = { id: g.getAttribute('data-sektor-sys'), x };
    }
    return best;
  });
  merke('0b: der linkeste Knoten der Region ist gemessen', !!links && links.x < 100, links);
  if (links) zielSys = links.id;
  await page.reload();
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
     'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.remove(); });
    const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click();
  });
  await page.waitForTimeout(1200);
  await oeffneSektorMitSystem(page, zielSys);
  await page.waitForTimeout(1200);

  /* GEMESSEN WIRD AM GERENDERTEN BILD: alle <text>-Knoten mit Emoji-Inhalt links vom Knoten,
     dazu die viewBox. Die Zahl der Abzeichen, die das Spiel FUER dieses System kennt, kommt aus
     dem Regions-Tooltip der Uebersicht - dieselbe Quelle (karteSystemBadges), aber ungedeckelt.
     Sie wird deshalb nicht nachgebaut, sondern abgelesen. */
  const mess = await page.evaluate((sysId) => {
    const svg = document.getElementById('galaxyMapSvg');
    if (!svg) return { svg:false };
    const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
    const g = svg.querySelector('[data-sektor-sys="' + sysId + '"]');
    if (!g) return { svg:true, knoten:false };
    /* GEMESSEN WIRD INNERHALB DER KNOTENGRUPPE. Die Sektoransicht zeigt mehrere Systeme; ein
       ungescopter Sammler liest deren Abzeichen mit und misst dann etwas, das er gar nicht meint
       (gemessen: 19 Treffer statt 5).
       Gelesen wird der EIGENE Textknoten, nicht `textContent` - das enthaelt den <title> mit, und
       die Zaehlmarke sah dadurch aus wie ein langer Fliesstext mit „+3" am Ende.
       Die Abzeichenzeile ist die OBERSTE Textzeile der Gruppe: Name und Kennzahlen stehen
       darunter (y + r + 16 bzw. + 28), die Zeichen bei y - 14. */
    const eigen = t => { const l = t.lastChild; return (l && l.nodeType === 3) ? l.nodeValue.trim() : ''; };
    const texte = [...g.querySelectorAll('text')].map(t => ({
      x: Number(t.getAttribute('x')), y: Number(t.getAttribute('y')),
      text: eigen(t), titel: (t.querySelector('title') ? t.querySelector('title').textContent : '') }))
      .filter(t => t.text);
    if (!texte.length) return { svg:true, knoten:true, viewBox: vb, zeichen:[], marke:null };
    const obersteY = Math.min(...texte.map(t => t.y));
    const reihe = texte.filter(t => Math.abs(t.y - obersteY) < 1);
    return { svg:true, knoten:true, viewBox: vb, obersteY,
             zeichen: reihe.filter(t => !/^\+\d+$/.test(t.text)),
             marke: reihe.find(t => /^\+\d+$/.test(t.text)) || null };
  }, zielSys);

  const linksRaus = (mess.zeichen || []).filter(z => z.x < 0 || (mess.viewBox && z.x > mess.viewBox[2]));
  const rest = mess.marke ? Number(mess.marke.text.slice(1)) : 0;
  merke('1a: Vorbedingung - das Fixture erzeugt mehr Abzeichen, als Plaetze da sind',
    (mess.zeichen || []).length + rest >= 5,
    { gezeichnet: (mess.zeichen||[]).map(z => z.text + '@' + z.x), rest });
  merke('1b: kein Abzeichen liegt ausserhalb der viewBox',
    mess.svg === true && linksRaus.length === 0,
    { viewBox: mess.viewBox, draussen: linksRaus.map(z => z.text + '@' + z.x) });
  merke('1c: die Zaehlmarke steht da und ihr Titel nennt, WAS sie verdeckt',
    !!mess.marke && rest >= 1 && (mess.marke.titel || '').length > 3,
    { marke: mess.marke });
  merke('1d: gezeigte Zeichen plus die Zaehlmarke ergeben alle Abzeichen des Systems',
    (mess.zeichen || []).length + rest >= 5 && rest >= 1,
    { gezeigt: (mess.zeichen||[]).length, rest, summe: (mess.zeichen||[]).length + rest });
  merke('1e: keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

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
