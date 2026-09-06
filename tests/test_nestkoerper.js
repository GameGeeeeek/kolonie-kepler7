// Die Alien-Nester als Brutkörper (Bündel D, 06.09.2026, Grafik-Aufnahme).
//
//   node tests/test_nestkoerper.js
//
// GEMESSEN AM ALTEN STAND: Der Kartenmarker war ein dunkler Kreis mit sechs Punkten in Volksfarbe
// auf einem leicht versetzten Radius - er las sich als Blume, nicht als Nest. Die fünf Stufen
// unterschieden sich nur im Radius (11 bzw. 15 Einheiten) und im Namen, die vier Völker nur in
// der Farbe. Am Handy blieben davon 20 Pixel mit ein paar Punkten.
//
// DIE REGELN, DIE HIER GEHALTEN WERDEN:
//   A) Jede Kombination aus Volk und Stufe hat ein eigenes Bild - 20 Stück, keins leer.
//   B) Die Völker sind an der FORM zu unterscheiden, nicht nur an der Farbe. Sonst hätte der
//      Umbau nichts gebracht, was die alte Punkteblume nicht auch konnte.
//   C) Der Körper füllt die Kachel. Der Kernradius steht im Spiel fest (r = 11, Königin 15); ein
//      Körper, der nur die halbe Kachel belegt, ist am Handy 15 statt 20 Pixel groß. Genau das
//      war im Entwurf so und ist beim Einbau nachgemessen und behoben worden.
//   D) Kein Zufall zur Laufzeit. Zwei Aufrufe müssen dasselbe Bild liefern, sonst wandert das
//      Nest bei jedem Neuaufbau der Karte.
//   E) Die Farbe kommt aus ALIEN_VOELKER, nicht aus einer zweiten Tabelle daneben.
//
// GEGENPROBE, gemessen am 06.09.2026 gegen origin/main (v8.690.0):
//   grün: node tests/test_nestkoerper.js
//   rot:  git show origin/main:weltraum_kolonie.html > /tmp/alt.html
//         KEPLER_SPIELDATEI=/tmp/alt.html KEPLER_TESTDATEI=file:///tmp/alt.html node tests/test_nestkoerper.js
//   Am alten Stand fallen alle Quelltext-Prüfungen und der Kartenteil; die Bildprüfungen laufen
//   dort gar nicht, weil es den Zeichner nicht gibt - genau das meldet 1-anker.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const HTML = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = HTML.match(/<script>([\s\S]*)<\/script>/)[1];

/* ---- 0) Quelltext ---------------------------------------------------------------------------- */
check('0a: es gibt einen Zeichner und einen Bildspeicher',
  /function nestZeichneBrutkoerper\(c, S, volk, stufe\)\{/.test(JS)
  && /function nestBildUrl\(volk, stufe\)\{/.test(JS)
  && /const NEST_BILD_CACHE = \{\};/.test(JS));
/* Die Volksfarbe darf nicht ein zweites Mal dastehen - sonst laufen Marker und Bild bei der
   nächsten Farbänderung auseinander (die wiederkehrende Fehlerklasse dieses Projekts). */
check('0b: die Farbe kommt aus der vorhandenen Völker-Tabelle',
  /const v = nestVolk\(volk\);/.test(JS)
  && (JS.match(/const ALIEN_VOELKER = \{/g) || []).length === 1);
check('0c: die Karte setzt das Bild und behält den Rückfall',
  /const nestBild = nestBildUrl\(nest\.volk, nest\.stufe\);/.test(JS)
  && /<image href="\$\{nestBild\}"/.test(JS)
  && /: \[0, 60, 120, 180, 240, 300\]\.map\(g => \{/.test(JS));
/* Der weiße Punkt der Königin steckt jetzt im Bild (als leuchtender Schlund). Stünde er weiter
   darüber, läge ein weißer Fleck mitten auf dem gerenderten Körper. */
check('0d: der alte Königinnen-Punkt liegt nur noch im Rückfall',
  /\$\{\(koenigin && !nestBild\) \?/.test(JS));

/* ---- Fixture wie in test_nest_ui: das Spiel laeuft in einer IIFE, das Nest kommt ueber die
   Galaxie-Antwort. Zwei Voelker und zwei Stufen in EINEM System, damit sich in einem Lauf
   pruefen laesst, dass die Bilder je Nest VERSCHIEDEN sind - ein Lauf mit einem Nest waere
   auch von einem fest verdrahteten Bild erfuellt. */
const SAVE_KEY = 'kepler7-save-v3';
const SYS = 'chronos';
function nest(id, volk, stufe){
  return { id, volk, sys:SYS, stufe, lp:260000, lpMax:400000,
    seit: Date.now() - 7200000, letzteReifung: Date.now() - 3600000,
    naechsterWurf: Date.now() + 8*3600*1000, naechsteWanderung: 0, beitraege:{}, schlaege:{} };
}
function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null,
      unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[],
      alienNester: [nest('n1','kryll',3), nest('n2','vex',5)] });
    if (p === 'asteroid/field') return j({ systeme:[SYS], felder:{ [SYS]: { plaetze:{} } } });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData() || '{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p))
      return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('about:blank');

  /* Der Zeichner wird aus der Spieldatei geschnitten und isoliert ausgeführt - geprüft werden
     Regeln über die Bilder, nicht ein Bild gegen eine Momentaufnahme. */
  const von = JS.indexOf('    const NEST_BILD = 168;');
  const endAnker = '\n      return NEST_BILD_CACHE[key];\n    }\n';
  const bisRoh = von < 0 ? -1 : JS.indexOf(endAnker, von);
  const bis = bisRoh < 0 ? -1 : bisRoh + endAnker.length;
  check('1-anker: der Zeichner ist im Quelltext auffindbar', von > 0 && bis > von, { von, bis });

  let m = null;
  if (von > 0 && bis > von) {
    const code = JS.slice(von, bis);
    // Die echten Volksfarben aus ALIEN_VOELKER - erfundene würden die Formprüfung verfälschen.
    const vBlock = JS.slice(JS.indexOf('const ALIEN_VOELKER = {'), JS.indexOf('const ALIEN_VOELKER = {') + 4000);
    const voelker = [...vBlock.matchAll(/^\s{4}(\w+):\s*\{[\s\S]*?farbe:'(#[0-9a-fA-F]{6})'/gm)]
      .map(x => ({ key: x[1], farbe: x[2] }));
    check('1-voelker: die Völker sind aus der Tabelle gelesen', voelker.length === 4, voelker.map(v => v.key));

    m = await page.evaluate(({ code, voelker }) => {
      const tab = {}; voelker.forEach(v => { tab[v.key] = { farbe: v.farbe, name: v.key }; });
      const bauen = farbeVon => new Function('nestVolk', code + '\nreturn { nestZeichneBrutkoerper, nestBildUrl, NEST_BILD };')(farbeVon);
      const api = bauen(k => tab[k] || { farbe:'#8fd694' });
      /* ZWEITE Ausfertigung derselben Zeichner mit einer FREMDEN Farbe für jedes Volk. Damit
         lässt sich prüfen, dass die Rasterung wirklich farbunabhängig ist: dieselbe Form in
         Magenta muss denselben Abstand-0 ergeben wie in Volksfarbe. Der erste Anlauf verglich
         dasselbe Objekt mit sich selbst - das ist für jede Eingabe 0 und belegt gar nichts. */
      const apiBunt = bauen(() => ({ farbe:'#ff2fd0' }));
      const S = api.NEST_BILD;
      const malMit = (a, volk, st) => {
        const cv = document.createElement('canvas'); cv.width = cv.height = S;
        const c = cv.getContext('2d'); a.nestZeichneBrutkoerper(c, S, volk, st);
        return c.getImageData(0, 0, S, S).data;
      };
      const mal = (volk, st) => malMit(api, volk, st);
      /* Umriss als Maske (Kasten, Fläche, Rand) und - für den Volksvergleich - ein 16x16-Raster
         der HELLIGKEIT innerhalb des Körpers, auf seinen eigenen Mittelwert normiert.
         Warum nicht der Umriss: Kryll und Xantheer sind beide ein Klumpen; ihr Unterschied liegt
         in der Haut (viele kleine Blasen gegen segmentierte Platten mit dunklen Nähten). Ein
         Umriss-Raster sah davon nichts und war mit 13 von 256 Feldern nur knapp grün - es hätte
         auch vier gleiche Klumpen in vier Farben durchgehen lassen, also genau den Zustand, den
         dieses Bündel beendet. Die Normierung auf den eigenen Mittelwert macht den Vergleich
         farbunabhängig: gemessen wird das Muster, nicht der Farbton. */
      const form = d => {
        let x0=S, x1=-1, y0=S, y1=-1, n=0, rand=0;
        const summe = new Float64Array(256), zahl = new Float64Array(256);
        let hellSumme = 0;
        for (let y=0;y<S;y++) for (let x=0;x<S;x++){
          const i = (y*S+x)*4, a = d[i+3];
          if (a > 40){
            n++; if (x<x0) x0=x; if (x>x1) x1=x; if (y<y0) y0=y; if (y>y1) y1=y;
            const h = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
            hellSumme += h;
            const f = ((y*16/S)|0)*16 + ((x*16/S)|0);
            summe[f] += h; zahl[f]++;
          }
          if (a > 200 && (x===0 || y===0 || x===S-1 || y===S-1)) rand++;
        }
        const mittel = n ? hellSumme / n : 1;
        // Je Feld: heller als der Körperschnitt (1), dunkler (-1), oder nicht belegt (0).
        const raster = [];
        for (let f=0; f<256; f++){
          if (zahl[f] < 6){ raster.push(0); continue; }
          const rel = (summe[f]/zahl[f]) / (mittel || 1);
          raster.push(rel > 1.10 ? 1 : (rel < 0.90 ? -1 : 0));
        }
        return { breite:x1-x0+1, hoehe:y1-y0+1, n, rand, raster };
      };
      const out = { bilder:{}, fehler:[], gleich:null, kb:{} };
      for (const v of voelker.map(x => x.key)) for (const st of [1,2,3,4,5]){
        try { out.bilder[v+':'+st] = form(mal(v, st)); }
        catch(e){ out.fehler.push(v+':'+st+' '+e.message); }
      }
      // D) Zwei Aufrufe, ein Bild.
      const a1 = mal('vex', 3), a2 = mal('vex', 3);
      let diff = 0; for (let i=0;i<a1.length;i++) if (a1[i] !== a2[i]) diff++;
      out.gleich = diff;
      for (const v of voelker.map(x => x.key)){
        const u = api.nestBildUrl(v, 5);
        out.kb[v] = u ? Math.round(u.length * 0.75 / 1024) : -1;
      }
      out.S = S;
      // Für die echte Farbkontrolle: dieselbe Form, fremde Farbe.
      out.buntRaster = {};
      for (const v of ['kryll','xantheer']) out.buntRaster[v] = form(malMit(apiBunt, v, 3)).raster;
      return out;
    }, { code, voelker });
  }

  if (m) {
    const alle = Object.entries(m.bilder);
    check('1a: kein Zeichenfehler in 20 Bildern', m.fehler.length === 0, m.fehler.slice(0, 5));
    check('1b: alle vier Völker mal fünf Stufen sind da', alle.length === 20, alle.length);
    /* A) Kein leeres Bild. Die Zahl ist gemessen, nicht gesetzt: das kleinste Bild (Sporenherd)
       belegt rund 6300 von 28224 Bildpunkten. */
    const leer = alle.filter(([, f]) => f.n < 2500).map(([k, f]) => k + ':' + f.n);
    check('1c: jedes Bild trägt einen Körper', leer.length === 0, leer.slice(0, 6));
    /* C) Der Körper füllt die Kachel. Im Entwurf war Stufe 1 nur 44-48 % breit und damit am
       Handy 15 statt 20 Pixel; die Schwelle liegt unter dem gemessenen Minimum (58 %). */
    const zuKlein = alle.filter(([, f]) => Math.max(f.breite, f.hoehe) < m.S * 0.55)
      .map(([k, f]) => k + ' ' + (100*Math.max(f.breite,f.hoehe)/m.S).toFixed(0) + '%');
    check('1d: der Körper füllt die Kachel auf jeder Stufe', zuKlein.length === 0, zuKlein.slice(0, 8));
    check('1e: nichts stößt deckend an den Bildrand',
      alle.every(([, f]) => f.rand === 0), alle.filter(([, f]) => f.rand > 0).map(([k, f]) => k + ':' + f.rand).slice(0, 6));
    /* B) Die Völker sind an Form UND Haut zu unterscheiden, nicht an der Farbe. Verglichen wird
       die farbnormierte Helligkeitsrasterung derselben Stufe. GEMESSENER BEREICH über alle
       18 Paarungen: 26 (kryll/xantheer auf Stufe 1) bis 78 (Stufe 5). Die Kontrollzeile darunter
       belegt, dass dieselbe Zeichnung mit sich selbst 0 ergibt - vier gleiche Klumpen in vier
       Farben lägen also bei 0, nicht bei 26. Die Schwelle 20 liegt unter dem gemessenen Minimum;
       sie soll das Verschwinden der Formmerkmale melden, nicht eine Stilfrage entscheiden.
       Das schwächste Paar habe ich zusätzlich angesehen: Kryll trägt runde Blasen auf glatter
       Haut, Xantheer sichtbare Segmentnähte - auch bei 20 Pixeln zu trennen. */
    const abstand = (a, b) => { let d = 0; for (let q = 0; q < 256; q++) if (a.raster[q] !== b.raster[q]) d++; return d; };
    let minAbstand = 999, paar = null, alleAbstaende = [];
    const vk = [...new Set(alle.map(([k]) => k.split(':')[0]))];
    for (const st of [1, 3, 5]) for (let i = 0; i < vk.length; i++) for (let j = i+1; j < vk.length; j++){
      const a = m.bilder[vk[i]+':'+st], b = m.bilder[vk[j]+':'+st];
      if (!a || !b) continue;
      const d = abstand(a, b);
      alleAbstaende.push(vk[i]+'/'+vk[j]+':'+st+'='+d);
      if (d < minAbstand){ minAbstand = d; paar = vk[i]+'/'+vk[j]+' St'+st; }
    }
    /* KONTROLLE, die wirklich etwas belegt: DIESELBE Form in einer fremden Farbe (Magenta) muss
       denselben Rasterabstand nahe 0 ergeben. Ein erster Anlauf verglich dasselbe Objekt mit sich
       selbst - das ist für jede Eingabe 0 und hätte auch eine Rasterung durchgehen lassen, die
       schlicht die Farbe misst. Genau die Prüfung, die aus dem falschen Grund grün ist.
       GEMESSEN: Ein Farbwechsel bewegt 3 (kryll) bis 5 (xantheer) Rasterfelder - die Normierung
       fängt ihn also nicht vollständig ab, aber fast. Ein VOLKSwechsel bewegt 26 bis 78. Zwischen
       beiden liegt Faktor fünf, und darauf beruht die Aussagekraft von 1f. Die Schwelle 8 liegt
       über der gemessenen Farbwirkung und weit unter der Formwirkung. */
    const buntAbstand = v => { let d = 0; const a = m.bilder[v+':3'].raster, b = m.buntRaster[v];
      for (let q = 0; q < 256; q++) if (a[q] !== b[q]) d++; return d; };
    check('1f-kontrolle: dieselbe Form in fremder Farbe rastert gleich',
      buntAbstand('kryll') <= 8 && buntAbstand('xantheer') <= 8,
      { kryll: buntAbstand('kryll'), xantheer: buntAbstand('xantheer') });
    console.log('       (gemessene Abstände: ' + alleAbstaende.join(' ') + ')');
    check('1f: die Völker unterscheiden sich in Form und Haut, nicht nur in der Farbe',
      minAbstand >= 20, { schwaechstesPaar: paar, felderUnterschied: minAbstand });
    check('1g: zwei Aufrufe liefern dasselbe Bild', m.gleich === 0, m.gleich);
    /* Ein Bild im DOM je Nest im offenen System - die Größe war im Konzept ausdrücklich gedeckelt. */
    const zuGross = Object.entries(m.kb).filter(([, kb]) => kb < 0 || kb > 40);
    check('1h: keine data-URL über 40 kB', zuGross.length === 0, m.kb);
  }
  /* ---- 2) Auf der echten Karte -------------------------------------------------------------
     Der Zeichner kann tadellos arbeiten und der Marker trotzdem leer bleiben - etwa wenn das
     <image> nie geschrieben wird oder die data-URL nicht ankommt. Gemessen wird deshalb im
     gebauten SVG, nicht am Quelltext. */
  const store = {};
  const ctx2 = await browser.newContext({ viewport:{ width:1280, height:900 } });
  const seite = await ctx2.newPage(); const fehlerSeite = [];
  seite.on('pageerror', e => fehlerSeite.push(String(e)));
  await seite.route('**/api/**', backend(store));
  await seite.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await seite.goto(SPIEL_URL);
  await seite.waitForTimeout(3500);
  await seite.evaluate(() => {
    for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']){
      const e = document.getElementById(id); if (e) e.remove();
    }
  });
  await seite.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
  await seite.waitForTimeout(700);
  await oeffneSystemUeberSektoren(seite, SYS);
  await seite.waitForTimeout(600);
  const karte = await seite.evaluate(() => {
    const knoten = Array.from(document.querySelectorAll('[data-map-nest]'));
    return knoten.map(k => {
      const bild = k.querySelector('image');
      const kreise = k.querySelectorAll('circle');
      const r = bild ? bild.getBoundingClientRect() : null;
      const balken = k.querySelector('rect');
      const text = k.querySelector('text');
      const rb = balken ? balken.getBoundingClientRect() : null;
      const rt = text ? text.getBoundingClientRect() : null;
      return {
        // Liegt der Balken UNTER und die Beschriftung ÜBER dem Bild? Gemessen in Bildschirm-
        // koordinaten, nicht am Attribut - eine Zahl im Markup sagt nicht, wo etwas landet.
        top: r ? r.top : 0, hoehe: r ? r.height : 0,
        balkenTop: rb ? rb.top : 0, textBottom: rt ? rt.bottom : 0,
        id: k.getAttribute('data-map-nest'),
        hatBild: !!bild,
        quelleLaenge: bild ? (bild.getAttribute('href') || '').length : 0,
        quelleAnfang: bild ? (bild.getAttribute('href') || '').slice(0, 22) : '',
        breite: r ? Math.round(r.width) : 0, hoehe: r ? Math.round(r.height) : 0,
        // Der alte Marker hatte SECHS Punktkreise plus Hof und Grundkreis; jetzt bleiben zwei.
        kreise: kreise.length,
        weisserPunkt: Array.from(kreise).some(c => (c.getAttribute('fill') || '') === '#fff')
      };
    });
  });
  check('2-anker: beide Nester stehen auf der Karte', karte.length === 2, karte.length);
  check('2a: keine Skriptfehler beim Aufbau', fehlerSeite.length === 0, fehlerSeite.slice(0, 3));
  check('2b: jedes Nest trägt ein gerendertes Bild',
    karte.length === 2 && karte.every(k => k.hatBild && k.quelleAnfang.startsWith('data:image/png')),
    karte.map(k => k.id + ':' + k.hatBild + ':' + k.quelleAnfang));
  /* Sichtbar, nicht nur im DOM (Hausregel): der Marker muss auf dem Schirm Fläche haben. */
  check('2c: die Bilder sind auf dem Schirm wirklich zu sehen',
    karte.every(k => k.breite > 20 && k.hoehe > 20), karte.map(k => k.id + ' ' + k.breite + 'x' + k.hoehe));
  /* Zwei verschiedene Nester, zwei verschiedene Bilder - sonst wäre ein fest verdrahtetes Bild
     ebenso grün. */
  check('2d: die beiden Nester zeigen verschiedene Bilder',
    karte.length === 2 && karte[0].quelleLaenge !== karte[1].quelleLaenge,
    karte.map(k => k.id + ':' + k.quelleLaenge));
  /* Die sechs Punkte sind weg, und der weiße Königinnen-Punkt liegt nicht mehr über dem Bild. */
  check('2e: die alte Punkteblume ist verschwunden',
    karte.every(k => k.kreise <= 2 && !k.weisserPunkt), karte.map(k => k.id + ' Kreise:' + k.kreise + ' weiss:' + k.weisserPunkt));
  /* BEFUND AUS DEM FOTO: Balken und Beschriftung sassen am Kernradius, das Bild reicht aber
     bis r x 1,5 - der Lebensbalken lief quer durch den Koerper, und bei der Koenigin (r = 15)
     stand die Beschriftung auf dem Bild.
     GEMESSEN WIRD GEGEN DEN KOERPER, NICHT GEGEN DIE KACHEL: Die Kachel ist quadratisch, der
     Koerper darin rund - eine Pruefung gegen die Bildkante verlangte einen Abstand, den es gar
     nicht braucht, und drueckte Balken und Text so weit nach aussen, dass sie den Nachbarmarker
     trafen (genau das ist beim ersten Anlauf passiert). Die Koerperhoehe kommt aus der Messung
     in Abschnitt 1, wird also nicht angenommen, sondern gerechnet. */
  const anteilHoehe = k => {
    const f = m && m.bilder[k]; return f ? f.hoehe / m.S : 1;
  };
  const koerperGrenzen = (k, art) => {
    // Bildbox: 3 r hoch, in der Mitte des Markers. Der Körper füllt davon `anteil`.
    const rG = k.hoehe / 3, mitte = k.top + k.hoehe / 2, halb = k.hoehe * anteilHoehe(art) / 2;
    void rG;
    return { oben: mitte - halb, unten: mitte + halb };
  };
  check('2f: Balken und Beschriftung liegen nicht auf dem Körper',
    karte.every(k => {
      const art = k.id === 'n1' ? 'kryll:3' : 'vex:5';
      const g = koerperGrenzen(k, art);
      return k.balkenTop >= g.unten - 1 && k.textBottom <= g.oben + 1;
    }),
    karte.map(k => {
      const art = k.id === 'n1' ? 'kryll:3' : 'vex:5';
      const g = koerperGrenzen(k, art);
      return k.id + ' Körper ' + Math.round(g.oben) + '-' + Math.round(g.unten)
           + ' | Balken ' + Math.round(k.balkenTop) + ' | Text bis ' + Math.round(k.textBottom);
    }));

  await browser.close();
  ende();
})();
