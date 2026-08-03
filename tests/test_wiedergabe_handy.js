// Kampf-Wiedergabe auf dem Handy und die Parteifarben (03.08.2026, Spieler-Report Sascha).
//
// ZWEI BEFUNDE AUS EINEM EINZIGEN BILDSCHIRMFOTO - beide entstanden dadurch, dass ich die
// neue Wiedergabe mit MUSTERFLOTTEN aus sechs Schiffsklassen geprueft hatte und mit einem
// Angriff statt einer Verteidigung. Saschas echter Spielstand deckte beides sofort auf.
//
//   1. DIE BUEHNE WAR AUF DEM HANDY NICHT ZU SEHEN. Die Bestandstafeln stehen dort im
//      normalen Fluss. Bei 22 Schiffsklassen PLUS 22 Abwehrarten sind das 44 Zeilen -
//      gemessen 880 px in einem 666 px hohen Fenster. Die Buehne begann bei y=934, also
//      vollstaendig unterhalb des Bildschirms. Vom Gefecht war NICHTS zu sehen.
//      Sechs Klassen passten noch; deshalb prueft dieser Test mit einer echten Spaetspiel-
//      Flotte, nicht mit einer bequemen.
//
//   2. DIE EIGENE FLOTTE FLOG IN GEGNERROT. KLASSEN[k].farbe wird beim ANLEGEN des Objekts
//      einmal aus F.an/F.ver gelesen; der Farbtausch fuer eingehende Ueberfaelle ("Gruen ist
//      im ganzen Spiel meins") aendert nur F.an/F.ver und erreichte die Rumpfbilder nie -
//      atlantenBauen() backt sie aber genau aus diesem Feld. Bei jedem eingehenden Ueberfall
//      war die eigene Verteidigung rot und der Angreifer gruen. Gemessen an den Bildpunkten
//      der Leinwand: vorher 2.704 rote / 0 gruene im Verband, nachher 0 / 907.
//
//   3. DIE KNOPFREIHE FEHLTE AUF GERAETEN MIT KERBE (zweiter Report, 03.08.2026).
//      #osWrap traegt height:100% UND - seit der ersten Reparatur - ein Rand-Polster fuer
//      Kerbe und Home-Leiste. Es fehlte aber box-sizing:border-box AUF #osWrap SELBST:
//      "#osWrap *" trifft die Nachfahren, nie das Element. Das Polster addierte sich also
//      zur vollen Hoehe - gemessen 757 px in einem 664 px hohen Fenster -, und
//      overflow:hidden schnitt unten Protokoll und Knopfreihe ab. Im Emulator faellt das
//      NICHT auf: env(safe-area-inset-*) meldet dort 0. Dieser Test stellt die Raender
//      deshalb ausdruecklich nach.
//      Zweiter Teil desselben Fehlers: min-height:40vh auf der Buehne. Sie ist der einzige
//      Teil, der nachgeben kann - bestand sie auf ihrer Hoehe, wurde die Fussleiste
//      hinausgedrueckt.
//
// Beide Punkte werden hier GEMESSEN, nicht am Quelltext behauptet: eine Regel, die im CSS
// steht, aber von einer spaeteren Regel ueberschrieben wird, bestuende jede Textpruefung.
// Genau das ist beim ersten Reparaturversuch passiert - der Medienblock lag vor den
// Grundregeln, und `align-items:flex-start` gewann.
const { starteBrowser, devices, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// Eine ECHTE Spaetspiel-Flotte: 22 Schiffsklassen, 20 Abwehrarten. Mit sechs Klassen waere
// dieser Test gruen und die Oberflaeche trotzdem kaputt.
const FLOTTE = { jaeger:152, cruisers:96, destroyers:2418, bomber:15, schlachtschiff:7234,
  superschlachtschiff:2, carrier:89, frachtergross:3324, recycler:283, spaeher:97, forscher:33,
  spionageschiff:164, enterschiff:196, colonyShips:71, waechter:10089, hyperbomber:33,
  hyperjaeger:24, quantenkreuzer:43, nanoklinge:40, metamaterialtitan:22, fusionsdreadnought:3,
  leerenjaeger:2, singularitaetsvernichter:6 };
const ABWEHR = { flak:55, turm:50, laser:45, ionenschild:39, raketen:33, gauss:29, bunker:29,
  voidbarriere:27, schild:25, plasma:21, railgun:20, resonanzschild:19, nanoplattform:13,
  sensorphalanx:12, schildkuppel:8, kiKern:6, fusionsbastion:5, panzerwall:5, kristallfestung:3,
  singularitaetsturm:1 };

// Eingehender Ueberfall: ICH stehe am Planeten (Seite D) und muss gruen sein.
const UEBERFALL = { id:'r1', ts:Date.now(), type:'raid', result:'win', faction:'Söldnerkonvoi',
  attackPower:41200, defensePower:23400, targetPlanet:'home',
  fleet:{ destroyers:179 }, destroyedShips:{ destroyers:31 },
  stationedFleet: FLOTTE, ownLostShips:{}, defenseBefore: ABWEHR };
// Eigener Angriff: ICH fliege an (Seite A) und muss ebenfalls gruen sein.
const ANGRIFF = { id:'a1', ts:Date.now(), type:'npc-attack', result:'win',
  npcName:'Kryllid-Nest (Stufe 5)', attackPower:90000, defensePower:40000,
  targetPlanet:'home', debrisPlanet:'home',
  fleet:{ schlachtschiff:3000, destroyers:1200, jaeger:4000 }, ownLostShips:{ jaeger:400 },
  npcFleet:{ jaeger:2000, cruisers:400 }, destroyedNpcShips:{ jaeger:2000, cruisers:250 } };

function backend(store, berichte){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p==='reports')return j({reports:berichte});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT')return j({ok:true,version:2});if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  return j([]);
};}
const save = () => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:9e4,forschungspunkte:3e4},
  buildings:Object.assign({solar:22,mine:20,labor:14,lager:30,werft:14}, ABWEHR),
  research:{rkampf:9}, fleet:Object.assign({missions:[]}, FLOTTE), colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null}, battleStats:{wins:99,losses:2}, xp:9e5, credits:5e5,
  buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

// Zaehlt je waagerechtem Band die deutlich roten und deutlich gruenen Bildpunkte.
// Band 0 = oben (Anflugbahn), Band 9 = unten (Planetenboden).
const BAENDER = 10;
const baender = page => page.evaluate((B) => {
  const cv = document.getElementById('osCv');
  if (!cv || !cv.width) return null;
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const aus = [];
  for (let k = 0; k < B; k++){
    const y0 = Math.floor(cv.height*k/B), y1 = Math.floor(cv.height*(k+1)/B);
    let rot = 0, gruen = 0;
    for (let y = y0; y < y1; y += 3) for (let x = 0; x < cv.width; x += 3){
      const i = (y*cv.width+x)*4, R = d[i], G = d[i+1], Bl = d[i+2];
      if (R > 110 && R > G+45 && R > Bl+45) rot++;
      else if (G > 110 && G > R+40 && G > Bl+20) gruen++;
    }
    aus.push({ rot, gruen });
  }
  return aus;
}, BAENDER);
const summe = (b, von, bis, feld) => b.slice(von, bis+1).reduce((a, x) => a + x[feld], 0);

async function spielStarten(browser, berichte, wartezeit){
  const ctx = await browser.newContext(Object.assign({}, devices['iPhone 13']));
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': save() }, berichte));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(3600);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  await page.evaluate(() => { const x = document.getElementById('headerReportsBtn'); if (x) x.click(); });
  await page.waitForTimeout(1600);
  await page.evaluate(() => { const x = document.querySelector('[data-watch-battle]'); if (x) x.click(); });
  await page.waitForTimeout(wartezeit || 2500);
  return { page, errs, ctx };
}

(async () => {
  const browser = await starteBrowser();

  // ============================== 1) Die Buehne ist auf dem Handy zu sehen
  {
    const { page, errs, ctx } = await spielStarten(browser, [UEBERFALL]);
    const m = await page.evaluate(() => {
      const r = id => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return { oben: Math.round(b.top), hoehe: Math.round(b.height) }; };
      return { fenster: window.innerHeight, kopf: r('osKopf'), buehne: r('osBuehne'), tafelD: r('osTafelD') };
    });
    // Der Kern des Befunds: Die Buehne begann UNTERHALB des Bildschirms.
    check('1: die Buehne beginnt im sichtbaren Bereich',
      m.buehne && m.buehne.oben < m.fenster * 0.55, { oben: m.buehne && m.buehne.oben, fenster: m.fenster });
    check('1: sie bekommt einen brauchbaren Anteil des Bildschirms (>= 30%)',
      m.buehne && m.buehne.hoehe >= m.fenster * 0.30,
      { hoehe: m.buehne && m.buehne.hoehe, anteil: m.buehne ? Math.round(m.buehne.hoehe/m.fenster*100)+'%' : '?' });
    // Die Tafel darf nicht ueber ihren Deckel hinauswachsen - vorher 874 px.
    check('1: die Bestandstafel bleibt gedeckelt und scrollt in sich',
      m.tafelD && m.tafelD.hoehe <= m.fenster * 0.32,
      { tafel: m.tafelD && m.tafelD.hoehe, deckel: Math.round(m.fenster*0.32) });
    check('1: der Kopfbereich sprengt das Fenster nicht', m.kopf && m.kopf.hoehe < m.fenster * 0.35, m.kopf);

    // Der Schalter muss die Buehne wirklich groesser machen - und die Leinwand mitwachsen.
    const vorher = m.buehne.hoehe;
    await page.evaluate(() => { const t = document.getElementById('osToggleTafeln'); if (t) t.click(); });
    await page.waitForTimeout(1200);
    const nach = await page.evaluate(() => {
      const b = document.getElementById('osBuehne').getBoundingClientRect();
      const cv = document.getElementById('osCv');
      let hell = 0;
      const d = cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
      for (let i = 0; i < d.length; i += 4000) if (d[i] > 12 || d[i+1] > 12 || d[i+2] > 24) hell++;
      return { hoehe: Math.round(b.height), fenster: window.innerHeight, cvHoehe: cv.height, gemalt: hell };
    });
    check('1: „Listen" räumt die Bühne frei (>= 60% des Bildschirms)',
      nach.hoehe >= nach.fenster * 0.60, { vorher, nachher: nach.hoehe, anteil: Math.round(nach.hoehe/nach.fenster*100)+'%' });
    // Ohne Neumessung bliebe die Leinwand in der alten Groesse und das Bild waere verzerrt.
    check('1: die Leinwand wird dabei neu vermessen und zeichnet weiter',
      nach.cvHoehe > 0 && nach.gemalt > 100, { cvHoehe: nach.cvHoehe, gemalt: nach.gemalt });
    check('keine JS-Fehler (Handy-Aufbau)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 5) Beide Schalter, und die Steuerung bleibt
  // „Daten" klappt Abschnitte, Kraftschiene und Protokoll weg - die Knopfreihe NICHT.
  // Das ist der Punkt, an dem dieser Schalter kaputtgehen koennte: Wer beim Zuklappen
  // die Steuerung verliert, kommt nur noch ueber „Schliessen" wieder heraus.
  {
    const { page, errs, ctx } = await spielStarten(browser, [UEBERFALL]);
    const mess = () => page.evaluate(() => {
      const bu = document.getElementById('osBuehne').getBoundingClientRect();
      const kn = document.querySelector('#osWrap .knoepfe').getBoundingClientRect();
      const w = document.getElementById('osWrap');
      const cv = document.getElementById('osCv');
      let hell = 0;
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 0; i < d.length; i += 4000) if (d[i] > 12 || d[i+1] > 12 || d[i+2] > 24) hell++;
      return { buehne: Math.round(bu.height), fenster: window.innerHeight,
               knoepfe: kn.height > 10 && kn.bottom <= window.innerHeight + 1,
               ueberlauf: w.scrollHeight - w.clientHeight,
               cvPasst: Math.abs((parseFloat(cv.style.height) || 0) - bu.height) <= 2,
               gemalt: hell };
    });
    const a = await mess();
    await page.evaluate(() => document.getElementById('osToggleLeiste').click());
    await page.waitForTimeout(900);
    const b2 = await mess();
    await page.evaluate(() => document.getElementById('osToggleTafeln').click());
    await page.waitForTimeout(900);
    const c = await mess();

    check('5: „Daten" vergrößert die Bühne spürbar', b2.buehne > a.buehne + 40,
      { vorher: a.buehne, nachher: b2.buehne });
    check('5: beide Schalter zusammen räumen sie fast frei (>= 60%)',
      c.buehne >= c.fenster * 0.60, { hoehe: c.buehne, anteil: Math.round(c.buehne/c.fenster*100)+'%' });
    // Der eigentliche Risikopunkt.
    check('5: die Steuerknöpfe bleiben in JEDEM Zustand sichtbar',
      a.knoepfe && b2.knoepfe && c.knoepfe, { alles: a.knoepfe, ohneDaten: b2.knoepfe, ohneBeides: c.knoepfe });
    check('5: nichts läuft dabei über den Rand hinaus',
      a.ueberlauf <= 0 && b2.ueberlauf <= 0 && c.ueberlauf <= 0,
      { a: a.ueberlauf, b: b2.ueberlauf, c: c.ueberlauf });
    // Ohne Neumessung bliebe die Leinwand in der alten Groesse - das Bild waere verzerrt
    // statt groesser, und der Boden landete wieder ausserhalb.
    check('5: die Leinwand wird nach jedem Umschalten neu vermessen',
      b2.cvPasst && c.cvPasst, { ohneDaten: b2.cvPasst, ohneBeides: c.cvPasst });
    check('5: und es wird weiter gezeichnet', c.gemalt > 100, c.gemalt);
    check('keine JS-Fehler (Schalter)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 4) Die Bodenabwehr ist wirklich im Bild
  // BEFUND (dritter Report, 03.08.2026): "Verteidiger Geschütze sieht man nicht."
  // starte() rief messen() BEVOR hudNeuAufbauen() die Bestandstafeln fuellte. Auf dem
  // Handy stehen die im Fluss - die Buehne schrumpft dadurch. Gemessen wurde also die
  // NOCH LEERE Anordnung: Leinwand 492 px hoch, Buehne danach 295 px. Der Planetenboden
  // liegt bei 80 % der LEINWANDhoehe, also bei y=394 - ausserhalb des Sichtbaren. Die
  // Bodenabwehr wurde gezeichnet und war trotzdem nicht zu sehen.
  // Geprueft wird beides: dass Leinwand und Buehne gleich hoch sind (die Ursache), und
  // dass unten wirklich Anlagenfarbe im Bild liegt (die Wirkung).
  //
  // ZWEITER BEFUND an derselben Stelle (vierter Report, 03.08.2026): "Die Verteidigung
  // sieht man kaum." Sie war jetzt IM Bild, aber rund 23 px hoch und in fuenf Silhouetten
  // fuer 22 Anlagen. Seit v8.394.0 zeichnet die Wiedergabe die echten Gebaeudegrafiken des
  // Spiels (drawDefenseMiniIcon) in Bildhoehen-Groesse. Die Messung folgt dem: gezaehlt
  // werden STAHLGRAUE Punkte (Sockel #5b6570 -> #242a31) im Bodenband. Der Planet selbst
  // ist dort satt gruen/blau getoent, faellt also nicht in diese Signatur.
  //
  // GEGENPROBE IM TEST SELBST: derselbe Bericht ohne defenseBefore. Findet die Messung
  // dort aehnlich viel, misst sie den Planeten und nicht die Anlagen - dann ist der
  // gruene Haken wertlos. Gemessen: 4.292 mit Abwehr, 1.328 ohne.
  {
    const messen = page => page.evaluate(() => {
      const cv = document.getElementById('osCv');
      const bu = document.getElementById('osBuehne').getBoundingClientRect();
      const cssH = parseFloat(cv.style.height) || cv.clientHeight;
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let stahl = 0;
      for (let y = Math.floor(cv.height * 0.72); y < cv.height; y += 2)
        for (let x = 0; x < cv.width; x += 2){
          const i = (y*cv.width+x)*4, R = d[i], G = d[i+1], B = d[i+2];
          const mx = Math.max(R,G,B), mn = Math.min(R,G,B);
          if (mn > 52 && mx - mn < 42) stahl++;
        }
      let z = null; try { z = JSON.parse(document.getElementById('osWrap').dataset.zustand); } catch(e){}
      return { cssH: Math.round(cssH), buehne: Math.round(bu.height), stahl: stahl, z: z };
    });
    const { page, errs, ctx } = await spielStarten(browser, [UEBERFALL], 3000);
    const m = await messen(page);
    // Die Ursache: Wird zu frueh gemessen, ist die Leinwand hoeher als ihre Buehne.
    check('4: Leinwand und Bühne sind gleich hoch (es wird nach dem Tafelaufbau gemessen)',
      Math.abs(m.cssH - m.buehne) <= 2, { leinwand: m.cssH, buehne: m.buehne });
    // Schwelle aus drei Messungen: 4.295 mit echten Gebaeudegrafiken, 2.636 mit den
    // alten Notsilhouetten, 1.328 ganz ohne Bodenabwehr.
    check('4: die Bodenabwehr liegt sichtbar im unteren Bildbereich',
      m.stahl > 3500, { stahlpunkte: m.stahl });
    // Die echten Gebaeudegrafiken, nicht die Notsilhouetten. Gezaehlt werden STELLUNGEN
    // mit Bild, nicht gebackene Bilder - letztere fuellen auch die Tafelzeilen, weshalb
    // die Gegenprobe damit gruen blieb, obwohl auf dem Boden nichts davon ankam.
    // EINE dokumentierte Ausnahme: der Resonanzschild-Emitter. Er ist die einzige der 22
    // Anlagen mit einem handgezeichneten SVG in ICONS statt einer Canvas-Grafik - ihm eine
    // zweite zu geben haette das SVG zu totem Code gemacht (siehe Kommentar bei DEFENSE_ART
    // und tests/test_iconabdeckung.js). Er steht als Schildgenerator-Silhouette auf dem
    // Boden. Kommt eine ZWEITE Anlage ohne Bild dazu, wird dieser Test rot - und genau das
    // soll er, denn dann ist es keine bewusste Ausnahme mehr, sondern eine Luecke.
    check('4: es sind die echten Gebäudegrafiken des Spiels (bis auf die eine Ausnahme)',
      m.z && m.z.anlagen > 0 && m.z.anlagenMitBild >= m.z.anlagen - 1,
      { mitBild: m.z && m.z.anlagenMitBild, stellungen: m.z && m.z.anlagen });
    // Gross genug, um die Silhouette zu erkennen - 23 px waren es vorher.
    check('4: sie sind groß genug, um sie zu unterscheiden (>= 34 px)',
      m.z && m.z.anlagenHoehe >= 34, { hoehe: m.z && m.z.anlagenHoehe });
    // Und nicht so viele, dass daraus wieder ein Strich am Horizont wird.
    check('4: und nicht so viele, dass sie zum Strich verschmelzen (<= 16 auf dem Handy)',
      m.z && m.z.anlagen > 0 && m.z.anlagen <= 16, { stellungen: m.z && m.z.anlagen });
    check('keine JS-Fehler (Bodenabwehr)', errs.length === 0, errs.slice(0,3));
    await ctx.close();

    // Gegenprobe: derselbe Kampf ohne jede Bodenabwehr.
    const OHNE = Object.assign({}, UEBERFALL, { id:'r-ohne', defenseBefore: {} });
    const g = await spielStarten(browser, [OHNE], 3000);
    const mo = await messen(g.page);
    check('4: die Messung misst wirklich die Anlagen (Gegenprobe ohne Abwehr)',
      mo.stahl * 2 < m.stahl, { mitAbwehr: m.stahl, ohneAbwehr: mo.stahl });
    check('4: ohne Bodenabwehr steht auch keine Stellung auf dem Boden',
      mo.z && mo.z.anlagen === 0, { stellungen: mo.z && mo.z.anlagen });
    await g.ctx.close();
  }

  // ============================== 3) Geraeteraender: nichts wird abgeschnitten
  // env(safe-area-inset-*) meldet im Emulator 0 - die Raender werden hier ausdruecklich
  // nachgestellt, sonst prueft dieser Abschnitt genau den Fall NICHT, wegen dem es ihn gibt.
  for (const geraet of ['iPhone 13', 'iPhone SE']){
    if (!devices[geraet]) continue;
    const ctx = await browser.newContext(Object.assign({}, devices[geraet]));
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.route('**/api/**', backend({ 'kepler7-save-v3': save() }, [UEBERFALL]));
    await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
    await page.goto(SPIEL_URL); await page.waitForTimeout(3400);
    await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
    await page.evaluate(() => { const x = document.getElementById('headerReportsBtn'); if (x) x.click(); });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const x = document.querySelector('[data-watch-battle]'); if (x) x.click(); });
    await page.waitForTimeout(1800);
    // Ein iPhone mit Dynamic Island: oben ~59 px, unten ~34 px.
    await page.addStyleTag({ content: '#osWrap{padding-top:59px !important;padding-bottom:34px !important;}' });
    await page.waitForTimeout(700);

    const m = await page.evaluate(() => {
      const w = document.getElementById('osWrap');
      const k = document.querySelector('#osWrap .knoepfe').getBoundingClientRect();
      const e = document.getElementById('osBtnEnde').getBoundingClientRect();
      return { fenster: window.innerHeight, ueberlauf: w.scrollHeight - w.clientHeight,
               boxSizing: getComputedStyle(w).boxSizing,
               knoepfeUnten: Math.round(k.bottom), endeUnten: Math.round(e.bottom),
               buehne: Math.round(document.getElementById('osBuehne').getBoundingClientRect().height) };
    });
    check('3: ' + geraet + ' - box-sizing liegt auf #osWrap selbst', m.boxSizing === 'border-box', m.boxSizing);
    check('3: ' + geraet + ' - nichts wird unten abgeschnitten', m.ueberlauf <= 0, { ueberlauf: m.ueberlauf });
    // Der eigentliche Befund: Die Knopfreihe war ganz aus dem Bild.
    check('3: ' + geraet + ' - die Knopfreihe ist vollständig sichtbar',
      m.knoepfeUnten <= m.fenster && m.endeUnten <= m.fenster,
      { knoepfeUnten: m.knoepfeUnten, endeUnten: m.endeUnten, fenster: m.fenster });
    check('3: ' + geraet + ' - und die Bühne bleibt trotzdem brauchbar (>= 25%)',
      m.buehne >= m.fenster * 0.25, { buehne: m.buehne, anteil: Math.round(m.buehne/m.fenster*100)+'%' });

    // ---- DER AUSGANG. Vierter Report, 03.08.2026: "man kann nicht aus dieser
    // Simulation raus tappen." Ursache war eine Randabstands-Regel, die im Block mit
    // `and (max-height:640px)` gelandet war und auf einem 932 px hohen iPhone deshalb
    // NIE griff - Titelzeile samt × lag unter der Statusleiste. Geprueft wird die
    // WIRKUNG, nicht die Regel: liegt der Knopf frei, ist er gross genug, und laesst
    // sich die Wiedergabe damit wirklich schliessen.
    const b = await page.evaluate(() => {
      const e = document.getElementById('battleModalCloseBtn').getBoundingClientRect();
      // Was liegt an der Mitte des Knopfes wirklich obenauf? Ein verdeckter Knopf
      // sieht in getBoundingClientRect() genauso aus wie ein freier.
      const oben = document.elementFromPoint(e.left + e.width/2, e.top + e.height/2);
      return { oben: Math.round(e.top), breite: Math.round(e.width), hoehe: Math.round(e.height),
               frei: !!(oben && (oben.id === 'battleModalCloseBtn' || oben.closest('#battleModalCloseBtn'))) };
    });
    check('3: ' + geraet + ' - der Schließen-Knopf liegt unterhalb des Geräterands',
      b.oben >= 59, { oben: b.oben, rand: 59 });
    check('3: ' + geraet + ' - er ist mit dem Daumen zu treffen (>= 44x40)',
      b.breite >= 44 && b.hoehe >= 40, { breite: b.breite, hoehe: b.hoehe });
    check('3: ' + geraet + ' - und nichts liegt darüber', b.frei, b);
    await page.click('#battleModalCloseBtn');
    await page.waitForTimeout(500);
    check('3: ' + geraet + ' - der Klick darauf schließt die Wiedergabe wirklich',
      await page.evaluate(() => !document.getElementById('battleModalOverlay').classList.contains('open')));
    // Zweiter Ausgang: Escape. Ein bildschirmfuellendes Fenster mit genau EINEM Ziel
    // war der Kern des Befunds - der Klick auf den Hintergrund greift auf dem Handy nie,
    // weil #osWrap das Overlay restlos ausfuellt.
    await page.evaluate(() => { const x = document.querySelector('[data-watch-battle]'); if (x) x.click(); });
    await page.waitForTimeout(1200);
    const offen = await page.evaluate(() => document.getElementById('battleModalOverlay').classList.contains('open'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    check('3: ' + geraet + ' - Escape ist ein zweiter Weg hinaus',
      offen && await page.evaluate(() => !document.getElementById('battleModalOverlay').classList.contains('open')));

    // ---- UND DIE REGEL SELBST, per CSSOM. Diese eine Pruefung muss den Quelltext
    // befragen, und zwar aus einem gemessenen Grund: Die Messungen darueber stellen die
    // Geraeteraender mit einem eigenen `padding` NACH, weil env(safe-area-inset-*) im
    // Emulator 0 meldet. Genau deshalb bleiben sie gruen, wenn man die echte env()-Regel
    // aus der Datei entfernt - gegengeprueft am 03.08.2026, das Ergebnis war "Alles
    // gruen". Der Fehler, der den Spieler eingesperrt hat, war aber KEIN fehlender Wert,
    // sondern eine Regel im falschen Medienblock (`and (max-height:640px)`), die auf
    // einem 932 px hohen iPhone nie griff. Gefragt wird deshalb genau das: Gibt es die
    // Regel, und TRIFFT ihre Bedingung auf DIESEM Geraet zu?
    const regel = await page.evaluate(() => {
      const raus = { gefunden: false, bedingung: null, greift: false };
      for (const bl of Array.from(document.styleSheets)){
        let rules; try { rules = bl.cssRules; } catch(e){ continue; }
        const geh = (liste, bedingung) => {
          for (const r of Array.from(liste || [])){
            if (r.media) { geh(r.cssRules, r.conditionText || r.media.mediaText); continue; }
            if (!r.selectorText || !/(^|,)\s*#osWrap\s*$/.test(r.selectorText)) continue;
            const t = r.style && r.style.getPropertyValue('padding-top');
            if (!t || !/safe-area-inset-top/.test(t)) continue;
            raus.gefunden = true;
            raus.bedingung = bedingung || '(keine)';
            raus.greift = raus.greift || !bedingung || window.matchMedia(bedingung).matches;
          }
        };
        geh(rules, null);
      }
      return raus;
    });
    check('3: ' + geraet + ' - es gibt überhaupt ein Randpolster für den Gerätrand', regel.gefunden, regel);
    check('3: ' + geraet + ' - und seine Medienbedingung trifft auf DIESES Gerät zu',
      regel.greift, { bedingung: regel.bedingung, fenster: await page.evaluate(() => window.innerHeight) });
    check('keine JS-Fehler (' + geraet + ', Ränder)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 6) Wie viele Schiffe zeigt das Bild?
  // BEFUND (vierter Report, 03.08.2026): "Die Schiffe, die angreifen, sind zu wenig."
  // Der Massstab hing bis dahin ALLEIN an der Bildbreite - auf dem Telefon fest
  // "1 Rumpf = 16 Schiffe". Ein Angriff mit 266 Schiffen wurde damit zu 17 Ruempfen:
  // ein fast leeres Bild fuer eine volle Flotte. Seit v8.394.0 gibt die Bildflaeche die
  // Zahl der Modelle vor und der Massstab ergibt sich aus der echten Flottengroesse.
  //
  // Geprueft mit ZWEI Flotten, denn genau daran haette man sich vertun koennen: eine
  // kleine muss dicht gezeichnet werden, eine riesige darf das Bild nicht sprengen.
  {
    const KLEIN = { id:'k1', ts:Date.now(), type:'npc-attack', result:'win',
      npcName:'Kryllid-Nest (Stufe 3)', attackPower:9000, defensePower:4000,
      targetPlanet:'home', debrisPlanet:'home',
      fleet:{ schlachtschiff:120, destroyers:96, jaeger:50 }, ownLostShips:{ jaeger:12 },
      npcFleet:{ jaeger:80, cruisers:20 }, destroyedNpcShips:{ jaeger:80, cruisers:12 } };
    for (const [name, bericht, mind, hoechst] of [['kleine Flotte (366 Schiffe)', KLEIN, 60, 200],
                                                  ['Spätspiel (24.615 Schiffe)', UEBERFALL, 60, 200]]){
      const { page, errs, ctx } = await spielStarten(browser, [bericht], 2600);
      const z = await page.evaluate(() => { try { return JSON.parse(document.getElementById('osWrap').dataset.zustand); } catch(e){ return null; } });
      check('6: ' + name + ' - genug Modelle im Bild (>= ' + mind + ')',
        z && z.ruempfe >= mind, { schiffe: z && z.schiffe, modelle: z && z.ruempfe, massstab: z && z.massstab });
      check('6: ' + name + ' - und nicht so viele, dass das Bild kippt (<= ' + hoechst + ')',
        z && z.ruempfe <= hoechst, { modelle: z && z.ruempfe });
      // Jede Seite muss sichtbar sein - bei 177 gegen 24.615 trug der gemeinsame
      // Massstab dem Angreifer genau EINEN Rumpf zu.
      check('6: ' + name + ' - beide Seiten haben einen eigenen Massstab, wenn nötig',
        z && z.massA >= 1 && z.massD >= 1, { angreifer: z && z.massA, verteidiger: z && z.massD });
      // Die echten Schiffsmodelle des Spiels, nicht die Notsilhouette.
      check('6: ' + name + ' - es sind die Schiffsbilder des Spiels',
        z && z.spielatlanten > 0 && z.spielatlanten === z.modellAtlanten,
        { ausDemSpiel: z && z.spielatlanten, modelle: z && z.modellAtlanten });
      check('keine JS-Fehler (' + name + ')', errs.length === 0, errs.slice(0,3));
      await ctx.close();
    }
  }

  // ============================== 2) „Grün ist meins" - in BEIDE Richtungen
  {
    // Eingehender Ueberfall: meine Verteidigung steht am Planeten, in den Baendern
    // oberhalb des Bodens. Vor der Reparatur war dort 2.704 rot / 0 gruen.
    const { page, errs, ctx } = await spielStarten(browser, [UEBERFALL], 3000);
    const b = await baender(page);
    check('2: die Leinwand liefert Messwerte', Array.isArray(b) && b.length === BAENDER);
    if (b){
      const rot = summe(b, 3, 6, 'rot'), gruen = summe(b, 3, 6, 'gruen');
      check('2: beim eingehenden Überfall ist die EIGENE Verteidigung grün, nicht rot',
        gruen > 50 && gruen > rot * 3, { gruen, rot });
    }
    check('keine JS-Fehler (Überfall)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }
  {
    // Eigener Angriff: ich komme von aussen (obere Baender), der Gegner steht unten.
    const { page, errs, ctx } = await spielStarten(browser, [ANGRIFF], 9000);
    const b = await baender(page);
    if (b){
      const obenG = summe(b, 0, 2, 'gruen'), obenR = summe(b, 0, 2, 'rot');
      const untenR = summe(b, 4, 8, 'rot'), untenG = summe(b, 4, 8, 'gruen');
      check('2: beim eigenen Angriff fliegt die eigene Flotte grün heran',
        obenG > 50 && obenG > obenR * 3, { gruen: obenG, rot: obenR });
      check('2: und der Gegner steht in Rot am Planeten',
        untenR > 20 && untenR > untenG, { rot: untenR, gruen: untenG });
    }
    check('keine JS-Fehler (Angriff)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
