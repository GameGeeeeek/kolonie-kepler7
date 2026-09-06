// Die isometrischen Bausätze (Bündel C, 05.09.2026, Grafik-Aufnahme).
//
//   node tests/test_bausaetze.js
//
// GEMESSEN AM ALTEN STAND: Die Verteidigung hatte 21 flache Graustahl-Trapeze mit demselben
// Sockel, zwei Anlagen (resonanzschild, signaturscanner) fielen ganz heraus und zeigten ein
// 42-px-Schloss. Der Basis-Reiter - die Startseite des Spiels - trug 24-px-Piktogramme in einer
// 42er-Kachel, und 17 von 30 Karten zeigten nur ein graues Tabler-Schloss: die halbe Startseite
// war bildlos. Beide Reiter sprachen außerdem zwei verschiedene Bildsprachen.
//
// DIE REGELN, DIE HIER GEHALTEN WERDEN:
//   A) Jedes Gebäude hat ein Bauwerk. Kein Schlüssel ohne Bausatz, kein leeres Bild.
//   B) Beide Bausätze teilen EINE Maschine. Wäre die Isometrie zweimal getragen, liefen Basis und
//      Verteidigung wieder auseinander - genau der Zustand, den das Bündel beendet.
//   C) Der Ausbau ist sichtbar. Stufe 20 muss mehr Masse zeigen als Stufe 1, sonst ist der
//      Ausbaustand ein Versprechen ohne Bild.
//   D) Nichts wird abgeschnitten. Ein Rohr, das über den Bildrand ragt, sieht auf der Kachel aus
//      wie ein Fehler - und bei 64 Pixeln fällt es niemandem beim Zeichnen auf.
//   E) Kein Zeit-Parameter. Das alte Bild war ein zufälliger Frame einer nie laufenden Animation
//      (das Raketensilo mal mit, mal ohne Rakete). Zwei Aufrufe müssen dasselbe Bild liefern.
//
// GEGENPROBE, gemessen am 05.09.2026 gegen origin/main (v8.687.0):
//   grün: node tests/test_bausaetze.js
//   rot:  git show origin/main:weltraum_kolonie.html > /tmp/alt.html
//         KEPLER_SPIELDATEI=/tmp/alt.html node tests/test_bausaetze.js
//   Am alten Stand fallen alle Quelltext-Prüfungen (0a bis 0e); die Bildprüfungen 1a bis 1e laufen
//   dort gar nicht, weil es die Maschine nicht gibt - genau das meldet 1-anker.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, ruhigeUhren, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();
const S = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = S.match(/<script>([\s\S]*)<\/script>/)[1];

/* ---- 0) Quelltext ---------------------------------------------------------------------------- */
check('0a: die alte Trapez-Tabelle und ihr Zeichner sind weg',
  !/const DEFENSE_ART = \{/.test(JS) && !/function drawDefenseArt\(/.test(JS));
check('0b: es gibt EINE Werkzeugkiste für beide Bausätze',
  (JS.match(/function isoWerkzeug\(c, S, T\)\{/g) || []).length === 1
  && /function zeichneAnlage\(c, S, key, stand\)\{/.test(JS)
  && /function zeichneGebaeude\(c, S, key, stand\)\{/.test(JS)
  && (JS.match(/const W = isoWerkzeug\(c, S, T\);/g) || []).length === 2);
check('0c: kein Zeit-Parameter mehr im Bild',
  !/function drawDefenseMiniIcon\(key, canvas\)\{[\s\S]{0,400}Date\.now\(\)/.test(JS));
/* Die Leuchtfarbe kommt aus BUILDING_DEFS, nicht aus einer abgeschriebenen zweiten Tabelle -
   sonst laufen Kachel und Karte auseinander (die wiederkehrende Fehlerklasse dieses Projekts). */
check('0d: die Leuchtfarbe wird aus der Def gelesen, nicht abgeschrieben',
  /const def = BUILDING_DEFS\.find\(d => d\.key === key\);/.test(JS)
  && /T\.glut = \(def && def\.fg\) \|\| T\.akzent;/.test(JS));
check('0e: die Kachel trägt beide Bausätze und wird nach dem Rebuild gesetzt',
  /if \(isoBausatz\(def\.key\)\)\{/.test(JS)
  && /data-bicon="\$\{def\.key\}"/.test(JS)
  && /if \(basisNeu\) refreshBuildingIcons\(document\.getElementById\('buildings'\)\);/.test(JS));

/* Fixture wie in test_defcards: das Spiel laeuft in einer IIFE, alles kommt ueber den Spielstand.
   Bewusst OHNE die Forschungen, die die Tier-2-Fabriken freischalten - so stehen im selben Reiter
   baubare UND gesperrte Karten, und beide lassen sich in einem Lauf pruefen. */
function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}
const mkSave = () => JSON.stringify({ ...ruhigeUhren(), tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:5e5,erz:5e5,kristalle:3e5,deuterium:2e5,antimaterie:9e3,forschungspunkte:2e4},
  buildings:{solar:20,mine:18,raffinerie:12,lager:14,labor:10,werft:8,habitat:6,tresor:3},
  research:{rsolar:6,rerz:6}, fleet:{jaeger:50,missions:[]}, colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',allianceTag:'',avatarKey:null}, battleStats:{wins:1,losses:0},
  xp:5000, credits:20000, buffs:[], lastTick:Date.now(), colonyNames:{}, colonyNotes:{} });

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('about:blank');

  /* Die ganze Maschine wird aus der Spieldatei geschnitten und isoliert ausgeführt - geprüft
     werden Regeln über die Bilder, nicht ein Bild gegen eine Momentaufnahme.
     Anker: von der Familientabelle bis zum Ende von zeichneGebaeude. */
  const von = JS.indexOf('    const ANLAGE_FAMILIE = {');
  const endAnker = '\n    function isoBild(art, key, stand, px){';
  const bis = von < 0 ? -1 : JS.indexOf(endAnker, von);
  check('1-anker: die Maschine ist im Quelltext auffindbar', von > 0 && bis > von, { von, bis });

  let m = null;
  if (von > 0 && bis > von) {
    const code = JS.slice(von, bis);
    /* Die echten Höchststufen und Leuchtfarben aus BUILDING_DEFS - der Zeichner liest sie, und
       ein erfundener Stellvertreter würde die Ausbaustände verschieben. */
    const gebBlock = JS.slice(JS.indexOf('const BUILDING_DEFS'), JS.indexOf('const BUILDING_DEFS') + 90000);
    const defs = [];
    for (const t of gebBlock.matchAll(/key:'([^']+)'[\s\S]{0,400}?fg:'([^']+)'/g)) {
      const nach = gebBlock.slice(t.index, t.index + 600);
      const mx = nach.match(/maxLevel:\s*(\d+)/);
      defs.push({ key: t[1], fg: t[2], maxLevel: mx ? +mx[1] : null });
    }
    check('1-defs: die Gebäudedefinitionen sind gelesen', defs.length >= 45, defs.length);

    m = await page.evaluate(({ code, defs }) => {
      const api = new Function('BUILDING_DEFS', code +
        '\nreturn { zeichneAnlage, zeichneGebaeude, ANLAGE_FAMILIE, GEBAEUDE_FAMILIE, ' +
        'anlageAusbaustand, gebaeudeAusbaustand, isoTon };')(defs);
      const S = 128;
      const mal = (art, key, stand) => {
        const cv = document.createElement('canvas'); cv.width = cv.height = S;
        const c = cv.getContext('2d');
        (art === 'anlage' ? api.zeichneAnlage : api.zeichneGebaeude)(c, S, key, stand);
        return c.getImageData(0, 0, S, S).data;
      };
      /* `n` zaehlt alles Bemalte, `rand` NUR deckende Pixel am Bildrand: der weiche Bodenschatten
         der Buehne reicht bewusst bis an den Rand (gemessen 45 Randpixel je Anlage) und ist kein
         Beschnitt - ein herausragendes Rohr dagegen ist deckend. */
      const messe = d => {
        let n = 0, rand = 0;
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const a = d[(y * S + x) * 4 + 3];
          if (a > 24) n++;
          if (a > 240 && (x === 0 || y === 0 || x === S - 1 || y === S - 1)) rand++;
        }
        return { n, rand };
      };
      /* Wie viele Pixel unterscheiden zwei Staende? Der Ausbau muss SICHTBAR sein - ob er dabei
         Flaeche gewinnt (zweites Rohr) oder nur das Bild aendert (Lichterreihe, Ring, Fenster),
         ist gleichgueltig. Eine reine Flaechenmessung liesse genau die Anlagen durchfallen, deren
         Anbau innerhalb der Silhouette sitzt. */
      const unterschied = (a, b) => {
        let n = 0;
        for (let i = 0; i < a.length; i += 4)
          if (Math.abs(a[i] - b[i]) > 12 || Math.abs(a[i+1] - b[i+1]) > 12
              || Math.abs(a[i+2] - b[i+2]) > 12 || Math.abs(a[i+3] - b[i+3]) > 12) n++;
        return n;
      };
      const out = { anlage: {}, gebaeude: {}, gleich: null, fehler: [] };
      for (const art of ['anlage', 'gebaeude']) {
        const tab = art === 'anlage' ? api.ANLAGE_FAMILIE : api.GEBAEUDE_FAMILIE;
        for (const key of Object.keys(tab)) {
          try {
            const bild = [0, 1, 2].map(st => mal(art, key, st));
            const w = bild.map(messe);
            w[1].diff = unterschied(bild[0], bild[1]);
            w[2].diff = unterschied(bild[0], bild[2]);
            out[art][key] = w;
          } catch (e) {
            out.fehler.push(art + ' ' + key + ' ' + e.message);
            out[art][key] = [{ n:0, rand:0 }, { n:0, rand:0, diff:0 }, { n:0, rand:0, diff:0 }];
          }
        }
      }
      // E) Zwei Aufrufe derselben Anlage liefern dasselbe Bild (kein Zufall, keine Uhr).
      const a1 = mal('anlage', 'raketen', 1), a2 = mal('anlage', 'raketen', 1);
      let diff = 0;
      for (let i = 0; i < a1.length; i++) if (a1[i] !== a2[i]) diff++;
      out.gleich = diff;
      // Der Ausbaustand des Abhorchpostens (maxLevel 4) muss über seine Höchststufe rechnen,
      // sonst erreicht diese Anlage Stand 1 und 2 nie.
      out.abhorch = [api.anlageAusbaustand(1, 4), api.anlageAusbaustand(2, 4), api.anlageAusbaustand(4, 4)];
      out.turm = [api.anlageAusbaustand(1, 20), api.anlageAusbaustand(5, 20), api.anlageAusbaustand(10, 20)];
      return out;
    }, { code, defs });
  }

  if (m) {
    check('1a: kein Zeichenfehler in 156 Bildern', m.fehler.length === 0, m.fehler.slice(0, 6));
    const alle = [...Object.entries(m.anlage).map(([k, v]) => ['anlage ' + k, v]),
                  ...Object.entries(m.gebaeude).map(([k, v]) => ['gebaeude ' + k, v])];
    check('1b: beide Bausätze sind vollständig',
      Object.keys(m.anlage).length === 23 && Object.keys(m.gebaeude).length === 29,
      { anlagen: Object.keys(m.anlage).length, gebaeude: Object.keys(m.gebaeude).length });
    /* A) Kein leeres Bild. Die Zahl ist gemessen, nicht gesetzt: das dünnste Bauwerk
       (Abhorchposten, Stand 0) belegt rund 2600 Pixel von 16384. */
    const leer = alle.filter(([, v]) => v.some(s => s.n < 900)).map(([k, v]) => k + ' ' + JSON.stringify(v.map(s => s.n)));
    check('1c: jedes Bild trägt ein Bauwerk', leer.length === 0, leer.slice(0, 6));
    /* C) Der Ausbau ist sichtbar. Gemessen als Anteil geänderter Pixel am Bild (128x128 = 16384).
       Die Schwelle 1,5 % ist am schwächsten Paar abgelesen und liegt darunter, nicht darüber:
       geprüft wird, dass jeder Schritt WAHRNEHMBAR ist, nicht wie groß er ausfällt. */
    const schwelle = 16384 * 0.015;
    const schwach = alle.filter(([, v]) => v[1].diff < schwelle || v[2].diff < schwelle)
      .map(([k, v]) => k + ' ' + v[1].diff + '/' + v[2].diff);
    check('1d: jeder Ausbaustand ist im Bild zu sehen', schwach.length === 0, schwach.slice(0, 10));
    /* D) Nichts ragt über den Rand. */
    const beschnitten = alle.filter(([, v]) => v.some(s => s.rand > 0)).map(([k, v]) => k + ' ' + v.map(s => s.rand).join('/'));
    check('1e: kein Bauwerk stößt deckend an den Bildrand', beschnitten.length === 0, beschnitten.slice(0, 6));
    check('1f: zwei Aufrufe liefern dasselbe Bild', m.gleich === 0, m.gleich);
    /* Der Abhorchposten hat maxLevel 4 - mit festen Schwellen 5/10 bliebe er ewig auf Stand 0. */
    check('1g: auch eine Anlage mit niedriger Höchststufe wächst',
      m.abhorch[0] === 0 && m.abhorch[2] === 2, m.abhorch);
    check('1h: Anlagen mit hoher Höchststufe behalten die Schwellen 5 und 10',
      m.turm[0] === 0 && m.turm[1] === 1 && m.turm[2] === 2, m.turm);
  }

  /* ---- 2) Im echten Basis-Reiter ---------------------------------------------------------
     Die isolierte Maschine kann tadellos zeichnen und die Kachel trotzdem leer bleiben - der
     Rebuild ersetzt alle Canvas-Elemente, und wer danach nicht auffrischt, hat weisse Flecken auf
     der Startseite. Gemessen wird deshalb im gebauten Reiter, nicht am Quelltext. */
  const store = {}; store['kepler7-save-v3'] = mkSave();
  const ctx2 = await browser.newContext({ viewport:{ width:1280, height:1400 }, deviceScaleFactor:2 });
  const seite = await ctx2.newPage(); const fehlerSeite = [];
  seite.on('pageerror', e => fehlerSeite.push(String(e)));
  await seite.route('**/api/**', backend(store));
  await seite.addInitScript(() => { localStorage.setItem('kepler7_token','tok'); });
  await seite.goto(SPIEL_URL); await seite.waitForTimeout(1800);
  await seite.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  await seite.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="basis"]'); if (b) b.click(); });
  await seite.waitForTimeout(1200);
  const reiter = await seite.evaluate(() => {
    /* Nur die GEBÄUDEkarten: im selben Kasten steht auch die Leerlaufkarte, die keinen
       Gebäudenamen trägt. Die Zahl der gefundenen Karten wird unten mitgeprüft, damit ein zu
       enger Filter die Messung nicht still leerlaufen lässt. */
    const zeilen = Array.from(document.querySelectorAll('#buildings .card-row'))
      .filter(z => z.querySelector('.bname'));
    return zeilen.map(zeile => {
      const kachel = zeile.querySelector('.bicon'), cv = zeile.querySelector('canvas[data-bicon]');
      let bemalt = 0;
      if (cv) { try {
        const d = cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 24) bemalt++;
      } catch(e){ bemalt = -1; } }
      return {
        name: (zeile.querySelector('.bname')||{}).textContent || '',
        gesperrt: zeile.classList.contains('research-locked'),
        gross: !!(kachel && kachel.classList.contains('bicon-def')),
        canvas: !!cv, bemalt,
        schlossOhneBild: !!(kachel && !cv && kachel.querySelector('i.ti-lock')),
        schlossAbzeichen: !!(kachel && kachel.querySelector('.lock-badge'))
      };
    });
  });
  check('2-anker: alle 29 Gebäudekarten sind gebaut', reiter.length === 29, reiter.length);
  check('2a: keine Skriptfehler beim Aufbau', fehlerSeite.length === 0, fehlerSeite.slice(0,3));
  check('2b: jede Gebäudekarte trägt die große Kachel mit Bauwerk',
    reiter.every(z => z.gross && z.canvas), reiter.filter(z => !(z.gross && z.canvas)).map(z => z.name).slice(0,6));
  /* DIE Prüfung dieses Bündels: kein leeres Canvas. Genau das wäre der Fehler, den ein
     vergessener refreshBuildingIcons erzeugt - und im Quelltext sähe alles richtig aus. */
  const leerImReiter = reiter.filter(z => z.bemalt < 400).map(z => z.name.trim() + ':' + z.bemalt);
  check('2c: keine Kachel bleibt leer', leerImReiter.length === 0, leerImReiter.slice(0,8));
  /* Das nackte Tabler-Schloss ohne Bild war der Zustand auf 17 von 30 Karten. */
  const nacktesSchloss = reiter.filter(z => z.schlossOhneBild).map(z => z.name.trim());
  check('2d: keine Karte zeigt mehr nur ein Schloss', nacktesSchloss.length === 0, nacktesSchloss.slice(0,8));
  const gesperrt = reiter.filter(z => z.gesperrt);
  check('2e: gesperrte Karten zeigen Bauwerk UND Schloss-Abzeichen',
    gesperrt.length > 0 && gesperrt.every(z => z.canvas && z.bemalt >= 400 && z.schlossAbzeichen),
    { gesperrt: gesperrt.length, ohne: gesperrt.filter(z => !z.schlossAbzeichen).map(z => z.name.trim()).slice(0,5) });

  /* ---- 3) Die Befunde der adversarischen Durchsicht ----------------------------------------
     Vier bestätigte Befunde, jeder mit einer eigenen Prüfung. Alle vier sind Fehlerklassen, die
     dieses Projekt kennt: dieselbe Größe aus zwei Quellen, und ein Zwischenspeicher, dessen
     Schlüssel nicht mitträgt, was das Bild verändert. */
  /* 3a: Die Kachel und die Stufenpille daneben müssen aus DERSELBEN Quelle lesen. state.buildings
     ist immer die Heimat; auf einer Kolonie stünde sonst ein Bauwerk im Heimat-Ausbaustand neben
     einer Zeile mit der Kolonie-Stufe. Geprüft wird die Quelle, nicht ein Bild: buildingRowHtml
     liest currentBuildings() (als `activeB`), also muss isoStufe dasselbe tun - und im ganzen
     Bausatz-Block darf state.buildings gar nicht mehr vorkommen. */
  const blockVon = JS.indexOf('    const ANLAGE_FAMILIE = {');
  const blockBis = JS.indexOf('    function refreshDefenseMiniIcons(){');
  const block = blockVon > 0 && blockBis > blockVon ? JS.slice(blockVon, blockBis) : '';
  check('3-anker: der Bausatz-Block ist abgegrenzt', block.length > 1000, block.length);
  check('3a: die Kachel liest die Stufe aus derselben Quelle wie die Karte',
    /const b = typeof currentBuildings === 'function' \? currentBuildings\(\)/.test(block)
    && !/state\.buildings\[/.test(block)
    && /const activeB = currentBuildings\(\);/.test(JS),
    { imBlock: (block.match(/state\.buildings/g)||[]).length });
  /* 3b: Das gebackene Berichtsbild hing bisher nur am Schlüssel. Seit das Bild vom Ausbaustand
     abhängt, veraltete es nach dem nächsten Ausbau für den Rest der Sitzung. schiffBildKlasse
     macht es eine Funktion höher richtig vor - der Schlüssel trägt mit, was das Bild verändert. */
  check('3b: das gebackene Anlagenbild trägt den Ausbaustand im Schlüssel',
    /function anlageBildKlasse\(key, stufe\)\{/.test(JS)
    && /const merk = 'anlage\|' \+ key \+ '\|' \+ stand;/.test(JS)
    && /drawDefenseMiniIcon\(key, cv, stufe\);/.test(JS)
    && /const kl = anlageBildKlasse\(k, v\);/.test(JS));
  /* 3c: Auf dem Planetenboden steht oft eine FREMDE Verteidigung. Ohne durchgereichte Stufe
     stempelte sie den eigenen Ausbaustand - und der Zwischenspeicher hätte der zweiten Anlage
     desselben Typs das Bild der ersten gegeben. */
  check('3c: der Planetenboden nimmt den Ausbaustand der jeweiligen Stellung',
    /function anlagenBild\(geb, stufe\)\{/.test(JS)
    && /var merk = geb \+ '\|' \+ stand;/.test(JS)
    && /var bild = anlagenBild\(an\.geb, an\.stufe\);/.test(JS)
    && /stufe: stufe, nr: j/.test(JS)
    && /return \{ key:x\.key, form:x\.form, stufe:x\.anzahl,/.test(JS)
    && /z\.appendChild\(abwehrBild\(a\.form, a\.key, a\.anzahl\)\);/.test(JS));
  /* 3d: Der Bildspeicher ist nach Pixelkante geschlüsselt, und die Wiedergabe rechnet sie aus
     Fenstergröße und Bildschirmdichte - ohne Deckel legt jede neue Größe einen weiteren Satz an.
     Die Wiedergabe räumt ihre eigenen Zwischenspeicher beim Schließen; dieser muss mit. */
  check('3d: der Bildspeicher hat einen Deckel und wird mitgeräumt',
    /const ISO_CACHE_DECKEL = \d+;/.test(JS)
    && /Object\.keys\(ISO_BILD_CACHE\)\.length >= ISO_CACHE_DECKEL\) ISO_BILD_CACHE = \{\};/.test(JS)
    && (JS.match(/if \(typeof isoBildSpeicherLeeren === 'function'\) isoBildSpeicherLeeren\(\);/g)||[]).length === 2);

  await browser.close();
  ende();
})();
