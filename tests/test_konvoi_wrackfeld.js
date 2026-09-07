// Das Wrackfeld des Konvois als gerenderte Kachel (GR-10, 07.09.2026).
//
//   node tests/test_konvoi_wrackfeld.js
//
// DER ANLASS: Der Wrackkonvoi war das LETZTE Kartenobjekt, das noch flaches SVG war. Vorposten
// (vorpostenSilhouette), Nester (nestBildUrl) und Festungen sind seit der Grafik-Runde gerenderte
// <image>-Kacheln; hier standen weiterhin drei gleiche cyanfarbene Rauten bei 30, 150 und 270 Grad.
// Die Form sagte nichts darueber, WAS das Objekt ist.
//
// DIE SCHARFE MESSUNG DIESER DATEI IST DIE DREHSYMMETRIE. Drei identische Formen auf einem Kreis
// im Abstand von 120 Grad sind konstruktionsbedingt drehsymmetrisch: Dreht man das Bild um 120
// Grad, aendert sich fast nichts. Drei VERSCHIEDENE Schiffsruempfe in verschiedenen Lagen sind es
// nicht. Genau das misst 2a - und zwar gegen eine im Test selbst gezeichnete KONTROLLE mit der
// alten Geometrie, damit die Schwelle gemessen und nicht geraten ist.
//
// GEPRUEFT WIRD:
//   0a-0c  Quelltext: der Marker holt sich die Kachel, der Rueckfall ist da, die Bake blinkt.
//   1a-1c  Der gerenderte Marker traegt ein <image> mit einer Datenadresse, und die drei alten
//          Rauten stehen nicht mehr darin.
//   2-anker/2a  Die Kachel ist nicht drehsymmetrisch - gemessen gegen die alte Geometrie.
//   2b     Sie ist ueberhaupt gefuellt (sonst misst 2a das Nichts).
//   3a     Kein JavaScript-Fehler beim Zeichnen.
//
// Gegenprobe: siehe Fuss der Datei.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];
const SYS = 'chronos';

/* ---- 0) Quelltext: die Verbindung, nicht die Enden -------------------------------------------- */
{
  const von = JS.indexOf("data-map-konvoi=");
  const blockVon = JS.lastIndexOf('if (karteEbeneAn(\'ereignisse\'))', von);
  const block = (von > 0 && blockVon > 0) ? JS.slice(blockVon, von + 2200) : '';
  check('0-anker: der Konvoi-Zweig der Karte ist auffindbar (sonst messen 0a-0c nichts)',
    von > 0 && blockVon > 0 && /konvoiImSystem/.test(block), { laenge: block.length });
  check('0a: der Marker holt sich die gerenderte Kachel',
    /konvoiBildUrl\(\)/.test(block) && /<image href=/.test(block), {});
  /* Der Rueckfall ist PFLICHT und kein Beiwerk: Ohne Canvas - oder wenn toDataURL wirft, etwa bei
     abgeschalteten Bilddaten - stuende sonst gar nichts an der Stelle, und ein Angriffsziel waere
     unsichtbar. Vorposten und Nest halten denselben Rueckfall. */
  check('0b: es gibt einen Rueckfall auf die alte Zeichnung',
    /kvUrl\s*\?/.test(block) && /polygon points=/.test(block), {});
  /* Die Kachel ist zwischengespeichert und kann sich nicht bewegen. Ohne ein bewegtes Teil liest
     sich der Marker als Kulisse statt als Ziel - deshalb bleiben Peilring UND Bake SVG. */
  check('0c: die Notbake blinkt und bleibt SVG',
    /<animate attributeName="opacity"/.test(block) && /animateTransform/.test(block), {});
}

function konvoiObj(){
  return { id:'konvoi-test-1', sys:SYS, lp:260000, lpMax:400000, seit: Date.now() - 3600000,
    schlaege:{}, beute:{ essenz:12, kampfpunkte:18, xp:200, credits:5000, modulChance:0.3 } };
}

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport:{ width:1280, height:1000 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null,
      unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[],
      alienNester:[], wrackKonvois:[konvoiObj()] });
    if (p === 'asteroid/field') return j({ systeme:[SYS], felder:{ [SYS]: { plaetze:{} } } });
    if (p === 'reports') return j(req.method() === 'POST' ? { ok:true } : { reports:[] });
    if (p === 'pending-rewards/claim') return j({ reward:null });
    if (p.startsWith('storage/')) return j({ e:1 }, 404);
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p)) return j([]);
    return j({});
  });
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3800);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
    .forEach(id => { const e = document.getElementById(id); if (e) e.remove(); }));
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
  await page.waitForTimeout(600);
  await oeffneSystemUeberSektoren(page, SYS);
  await page.waitForTimeout(1200);

  const marker = await page.evaluate(() => {
    const g = document.querySelector('[data-map-konvoi]');
    if (!g) return { da:false };
    const im = g.querySelector('image');
    return { da:true, html: g.innerHTML,
      bild: im ? (im.getAttribute('href') || im.getAttribute('xlink:href') || '') : null,
      rauten: g.querySelectorAll('polygon').length };
  });

  /* ---- 1) Der gerenderte Marker ------------------------------------------------------------- */
  check('1-anker: der Kartenknoten des Konvois wurde ueberhaupt gezeichnet',
    marker.da === true, { gefunden: marker.da });
  check('1a: er traegt eine gerenderte Kachel als Datenadresse',
    !!marker.bild && /^data:image\//.test(marker.bild), { anfang: (marker.bild || '').slice(0, 22),
      laenge: (marker.bild || '').length });
  /* Die drei Rauten sind der ALTE Zustand. Stehen sie noch da, wurde die Kachel nur DAVOR gelegt
     statt sie zu ersetzen - dann liegt das Wrackfeld auf drei cyanfarbenen Karos. */
  check('1b: die drei alten Rauten stehen nicht mehr im Marker',
    marker.rauten === 0, { polygone: marker.rauten });
  /* 1c und 1d sind BEWUSST getrennt. Ein erster Entwurf prüfte beides in einer Zeile - damit fiel
     sie am alten Stand mit, obwohl der Peilring dort völlig in Ordnung war, und konnte gar nicht
     mehr melden, dass der Umbau ihn beschaedigt. Eine Pruefung, die zwei Dinge zugleich behauptet,
     kann keines von beiden allein belegen. 1c schuetzt das Vorhandene, 1d misst das Neue. */
  check('1c: der Peilring dreht sich weiter - der Umbau hat ihn nicht mitgenommen',
    /animateTransform/.test(marker.html || ''), {});
  check('1d: die Notbake blinkt im Marker',
    /<animate /.test(marker.html || ''), {});

  /* ---- 2) Die Kachel selbst: keine Drehsymmetrie -------------------------------------------- */
  /* SCHWELLE ERST GEMESSEN, DANN GESETZT. Die Kontrolle zeichnet die ALTE Geometrie (drei gleiche
     Rauten bei 30/150/270) und misst ihre 120-Grad-Drehselbstaehnlichkeit; die echte Kachel wird
     mit demselben Verfahren gemessen. Zwischen beiden muss ein Vielfaches liegen, sonst misst die
     Pruefung nicht die FORM, sondern das Rauschen der Rasterung. */
  const mass = await page.evaluate(async (url) => {
    const S = 168, FELD = 16;
    const rastere = (cv) => {
      const c = cv.getContext('2d');
      const d = c.getImageData(0, 0, cv.width, cv.height).data, W = cv.width, H = cv.height;
      const summe = new Float64Array(FELD*FELD), zahl = new Float64Array(FELD*FELD);
      let hs = 0, n = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
        const i = (y*W+x)*4; if (d[i+3] <= 40) continue;
        n++; const h = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]; hs += h;
        const q = ((y*FELD/H)|0)*FELD + ((x*FELD/W)|0);
        summe[q] += h; zahl[q]++;
      }
      const mittel = n ? hs/n : 1, out = [];
      for (let q = 0; q < FELD*FELD; q++){
        if (zahl[q] < 6){ out.push(0); continue; }
        const rel = (summe[q]/zahl[q]) / (mittel || 1);
        out.push(rel > 1.10 ? 1 : (rel < 0.90 ? -1 : 0));
      }
      return { raster: out, belegt: n };
    };
    const dreh = (cv, grad) => {
      const o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height;
      const c = o.getContext('2d');
      c.translate(cv.width/2, cv.height/2); c.rotate(grad*Math.PI/180);
      c.drawImage(cv, -cv.width/2, -cv.height/2);
      return o;
    };
    const abstand = (a, b) => { let d = 0; for (let q = 0; q < 256; q++) if (a[q] !== b[q]) d++; return d; };
    const selbst = (cv) => Math.min(abstand(rastere(cv).raster, rastere(dreh(cv,120)).raster),
                                    abstand(rastere(cv).raster, rastere(dreh(cv,240)).raster));

    // Kontrolle: die ALTE Geometrie, im Test selbst gezeichnet.
    const alt = document.createElement('canvas'); alt.width = alt.height = S;
    { const c = alt.getContext('2d'), cx = S/2, cy = S/2, r = S*0.30;
      c.globalAlpha = 0.85; c.fillStyle = '#8fd0ea';
      for (let j = 0; j < 3; j++){
        const rad = (30 + j*120)*Math.PI/180, rr = r*(0.5 + 0.12*j);
        const x = cx + rr*Math.cos(rad), y = cy + rr*Math.sin(rad), s = r*0.32;
        c.beginPath(); c.moveTo(x-s,y); c.lineTo(x,y-s*0.8); c.lineTo(x+s,y); c.lineTo(x,y+s*0.8);
        c.closePath(); c.fill();
      } }
    if (!url) return { fehler: 'keine Kachel' };
    const im = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
    if (!im) return { fehler: 'Kachel laedt nicht' };
    const neu = document.createElement('canvas'); neu.width = neu.height = S;
    neu.getContext('2d').drawImage(im, 0, 0, S, S);
    return { altSym: selbst(alt), neuSym: selbst(neu),
      altBelegt: rastere(alt).belegt, neuBelegt: rastere(neu).belegt };
  }, marker.bild);

  check('2-anker: beide Bilder sind gefuellt (sonst misst 2a das Nichts)',
    !mass.fehler && mass.altBelegt > 400 && mass.neuBelegt > 2000,
    { altBelegt: mass.altBelegt, neuBelegt: mass.neuBelegt, fehler: mass.fehler });
  /* SCHWELLE 40, GEMESSEN am 07.09.2026: die alte Geometrie kommt auf 0, das Wrackfeld auf 52
     Rasterfelder Unterschied. Die Schwelle liegt weit ueber dem Kontrollwert und weit
     unter dem Messwert - sie soll melden, dass die drei Formen wieder gleich geworden sind, und
     keine Stilfrage entscheiden. */
  check('2a: die Kachel ist NICHT drehsymmetrisch - es sind drei verschiedene Wracks',
    !mass.fehler && mass.neuSym >= 40 && mass.altSym < 20,
    { kontrolleAlt: mass.altSym, gemessenNeu: mass.neuSym, schwelle: 40 });
  check('3a: kein JavaScript-Fehler beim Zeichnen', errs.length === 0, errs.slice(0, 3));

  /* ---- 4) Die Bruchgeometrie: gerechnet, nicht betrachtet ------------------------------------
     DER TEUERSTE BEFUND DIESES AUFTRAGS. Die erste Fassung von kvBruch warf die beiden
     Schnittpunkte aus der Punktliste und haengte die Bruchkante immer HINTEN an. Das stimmt nur,
     wenn die Schnittpunkte zufaellig am Listenende liegen - und das tun sie fast nie: Alle
     Ruempfe in SHIP_HULL_DEFS beginnen am Bug, also am groessten x, weshalb die rechte Haelfte
     ihre Schnittpunkte immer MITTEN in der Liste hat. GEMESSEN waren 5 der 6 Stuecke
     ueberschlagen, das linke Frachterstueck mit Flaeche 24 statt 617 - zu einer Schleife
     kollabiert.
     WARUM KEIN BILDVERGLEICH DAS GEFANGEN HAETTE: Ein Wrack ist der eine Gegenstand, bei dem
     kaputte Geometrie wie Absicht aussieht. Abschnitt 2 blieb gruen, weil ein ueberschlagenes
     Polygon genauso wenig drehsymmetrisch ist wie ein heiles. Diese Pruefung rechnet deshalb:
     Ein Polygon ohne Selbstschnitt, und die beiden Haelften ergeben zusammen wieder den ganzen
     Rumpf. Beides sind REGELN, keine Momentaufnahmen - sie gelten auch, wenn sich die Ruempfe,
     die Schnittstellen oder die Zackenzahl aendern. */
  {
    const von = JS.indexOf('function kvBruch(');
    const bis = JS.indexOf('\n  function kvStueck(', von);
    const rumpfVon = JS.indexOf('const SHIP_HULL_DEFS = {');
    const rumpfBis = JS.indexOf('\n    function ', rumpfVon);
    const wracksVon = JS.indexOf('const KONVOI_WRACKS = [');
    const wracksBis = JS.indexOf('];', wracksVon);
    check('4-anker: kvBruch, SHIP_HULL_DEFS und KONVOI_WRACKS sind schneidbar (sonst misst 4 nichts)',
      von > 0 && bis > von && rumpfVon > 0 && rumpfBis > rumpfVon && wracksVon > 0 && wracksBis > wracksVon,
      { kvBruch: von > 0, huellen: rumpfVon > 0, wracks: wracksVon > 0 });
    let ergebnis = { fehler: 'nicht ausgefuehrt' };
    try {
      const saatVon = JS.indexOf('function kvSaat(');
      const f = new Function(JS.slice(rumpfVon, rumpfBis) + '\n' + JS.slice(saatVon, bis)
        + '\n' + JS.slice(wracksVon, wracksBis + 2)
        + '\nreturn { kvBruch, SHIP_HULL_DEFS, KONVOI_WRACKS };')();
      const flaeche = p => { let a = 0; for (let i = 0; i < p.length; i++){ const q = p[(i+1)%p.length]; a += p[i][0]*q[1] - q[0]*p[i][1]; } return Math.abs(a/2); };
      const schnitt = p => {
        const o = (x,y,z) => (y[0]-x[0])*(z[1]-x[1]) - (y[1]-x[1])*(z[0]-x[0]);
        const kr = (a,b,c,d) => { const d1=o(c,d,a), d2=o(c,d,b), d3=o(a,b,c), d4=o(a,b,d);
          return ((d1>0&&d2<0)||(d1<0&&d2>0)) && ((d3>0&&d4<0)||(d3<0&&d4>0)); };
        const n = p.length;
        for (let i = 0; i < n; i++) for (let j = i+2; j < n; j++){
          if (i === 0 && j === n-1) continue;
          if (kr(p[i], p[(i+1)%n], p[j], p[(j+1)%n])) return true;
        }
        return false;
      };
      const zeilen = [];
      let ueberschlagen = 0, fehlend = 0;
      f.KONVOI_WRACKS.forEach((teil, n) => {
        const d = f.SHIP_HULL_DEFS[teil.key];
        if (!d){ fehlend++; zeilen.push({ key: teil.key, fehlt: true }); return; }
        const st = f.kvBruch(d.pts, teil.bei, n + 1);
        if (!st){ fehlend++; zeilen.push({ key: teil.key, kvBruch: null }); return; }
        const ganz = flaeche(d.pts);
        const summe = st.reduce((a, poly) => a + flaeche(poly), 0);
        const kaputt = st.filter(schnitt).length;
        ueberschlagen += kaputt;
        zeilen.push({ key: teil.key, anteil: Math.round(100 * summe / ganz), ueberschlagen: kaputt });
      });
      ergebnis = { zeilen, ueberschlagen, fehlend, anzahl: f.KONVOI_WRACKS.length };
    } catch (e){ ergebnis = { fehler: String(e) }; }

    check('4a: alle drei Ruempfe sind vorhanden und lassen sich zerschneiden',
      !ergebnis.fehler && ergebnis.anzahl === 3 && ergebnis.fehlend === 0, ergebnis);
    /* Genau die Luecke, die Abschnitt 2 offen liess: Faellt ein Rumpfschluessel weg, verschwindet
       das Wrack still - `if (!d) return;` im Zeichner. Zwei Wracks sind ebenso wenig
       drehsymmetrisch wie drei, 2a bliebe also gruen. */
    check('4b: kein Bruchstueck ueberschlaegt sich',
      !ergebnis.fehler && ergebnis.ueberschlagen === 0,
      { ueberschlagen: ergebnis.ueberschlagen, zeilen: ergebnis.zeilen });
    /* Die zweite Haelfte derselben Regel: Ein Schnitt darf nichts verschlucken. Die Spanne
       95-105 % faengt den Zackenversatz auf (er traegt etwas Flaeche zu oder ab), nicht aber
       einen Kollaps - der alte Stand kam auf 53 %. */
    check('4c: die beiden Haelften ergeben zusammen wieder den ganzen Rumpf',
      !ergebnis.fehler && (ergebnis.zeilen || []).every(z => z.anteil >= 95 && z.anteil <= 105),
      { anteile: (ergebnis.zeilen || []).map(z => z.key + '=' + z.anteil + '%') });
  }

  /* ---- 5) Der Marker bleibt antippbar -------------------------------------------------------
     Der Umbau hat den einzigen gefuellten Kern des Markers in den Rueckfall verschoben und das
     Bild mit pointer-events="none" versehen. Uebrig blieben ein gestrichelter Faden, eine Bake
     von 1,2 Einheiten und der Rumpfbalken - in der Mitte, wo der Finger hingeht, war nichts.
     Die Bestandstests fangen das nicht: sie schicken das Klickereignis DIREKT an den Knoten
     (`n.dispatchEvent(new MouseEvent('click'))`) und umgehen die Trefferpruefung vollstaendig.
     Diese Pruefung fragt deshalb den Browser, WAS an der Mitte des Markers liegt. */
  const treffer = await page.evaluate(() => {
    const g = document.querySelector('[data-map-konvoi]');
    if (!g) return { da:false };
    const b = g.getBoundingClientRect();
    const x = b.left + b.width/2, y = b.top + b.height/2;
    const el = document.elementFromPoint(x, y);
    return { da:true, trifft: !!(el && el.closest('[data-map-konvoi]')),
      getroffen: el ? (el.tagName + (el.getAttribute('fill') ? ' fill=' + el.getAttribute('fill') : '')) : null,
      breite: Math.round(b.width), hoehe: Math.round(b.height) };
  });
  check('5-anker: der Marker hat eine messbare Flaeche auf dem Bildschirm',
    treffer.da && treffer.breite > 4 && treffer.hoehe > 4,
    { breite: treffer.breite, hoehe: treffer.hoehe });
  check('5a: ein Tipp auf die MITTE des Markers trifft ihn wirklich',
    treffer.trifft === true, treffer);

  await ctx.close(); await browser.close();
  ende();
})();

/* GEGENPROBE (07.09.2026), jeweils NUR die Spieldatei angefasst, Pruefnamen beider Laeufe per
   `diff` verglichen:

   Am Stand vor diesem Auftrag (`git show origin/main:weltraum_kolonie.html`) FALLEN 0a, 0b, 0c,
   1a, 1b, 1d, 2-anker und 2a. 1b faellt dort mit `polygone: 3` - genau die drei Rauten, die dieser
   Auftrag ersetzt; 2a und der 2-Anker fallen, weil es ueberhaupt keine Kachel gibt.
   GRUEN bleiben dort 0-anker, 1-anker, 1c und 3a: Der Kartenknoten wurde immer gezeichnet, der
   Peilring drehte sich immer, und es gab nie einen Zeichenfehler - es fehlte nur das Bild. Genau
   diese Aufteilung ist der Beleg, dass die Anker messen und nicht bloss mitfallen.

   EIN EIGENER MESSFEHLER, gefunden von genau dieser Gegenprobe: 1c prüfte zuerst Peilring UND
   Bake in einer Zeile und fiel am alten Stand mit - obwohl der Peilring dort in Ordnung war. Die
   Fussnote behauptete das Gegenteil. Aufgeloest wurde das an der PRUEFUNG, nicht an der Fussnote:
   1c schuetzt jetzt allein das Vorhandene, 1d misst allein das Neue.

   ZWEITE RUNDE, aus der adversarischen Durchsicht desselben Aenderungssatzes (07.09.2026). Sie
   hat ZWEI echte Fehler gefunden, die kein Bildvergleich haette finden koennen. Gegenprobe gegen
   den Stand VOR der Korrektur (Commit c2d1146, also den eigenen ersten Wurf):

   4b FAELLT dort mit `ueberschlagen: 5` - fuenf der sechs Bruchstuecke waren ueberschlagene
      Polygone. kvBruch warf die beiden Schnittpunkte aus der Punktliste und haengte die
      Bruchkante immer HINTEN an; das stimmt nur, wenn die Schnittpunkte am Listenende liegen,
      und das tun sie fast nie.
   4c FAELLT mit `frachtergross=25%`, `carrier=76%`, `cruisers=48%` - drei Viertel des Frachters
      fehlten schlicht. Nach der Korrektur ergeben beide Haelften ueberall wieder 100 %.
   5a FAELLT mit `getroffen: "ellipse fill=url(#sysNebelSonne)"`. Das ist der Beleg, den kein
      DOM-Test liefern kann: Ein Tipp auf die MITTE des Konvoi-Markers traf die SONNE des Systems.
      Der Umbau hatte den einzigen gefuellten Kern in den Rueckfall verschoben und das Bild mit
      pointer-events="none" versehen - der Klick ging durch den Marker hindurch. Die drei
      Bestandstests (test_A2_ui, test_konvoi_frist, test_pve_abklingsperre) schicken das
      Klickereignis direkt an den Knoten und konnten das gar nicht sehen.
   GRUEN bleiben dort 4-anker, 4a und 5-anker: Die Ruempfe waren da, kvBruch lieferte etwas, und
   der Marker hatte eine Flaeche - nur war das Gelieferte falsch und die Flaeche nicht treffbar.

   WARUM ABSCHNITT 2 DAS NICHT GEFANGEN HAT, und warum das kein Versagen ist: Ein ueberschlagenes
   Polygon ist genauso wenig drehsymmetrisch wie ein heiles. Ein Wrack ist ausserdem der eine
   Gegenstand, bei dem kaputte Geometrie wie Absicht aussieht - auf dem Bildschirm sah der erste
   Wurf plausibel aus. Deshalb RECHNET Abschnitt 4, statt zu betrachten.

   WARUM DIE KONTROLLE IN 2a IM TEST SELBST GEZEICHNET WIRD und nicht aus der Spieldatei kommt:
   Nach diesem Auftrag gibt es die alte Geometrie dort nicht mehr (ausser im Rueckfall, den man
   ohne Canvas nicht messen kann). Eine Pruefung, deren Vergleichsmass mit dem gemessenen
   Gegenstand verschwindet, misst hinterher nichts mehr. Die Kontrolle steht deshalb hier - sie
   ist die Definition von "drei gleiche Formen auf einem Kreis", nicht eine Kopie des alten Codes.
*/
