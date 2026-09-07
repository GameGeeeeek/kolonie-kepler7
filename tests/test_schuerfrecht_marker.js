// GR-11: Der Marker des Schuerfrechts sagt WIE STARK, WER und OB ES GERADE GESCHUETZT IST
// (Auftrag Sascha, 07.09.2026 - A, B und C aus dem Entwurf „Wer schürft hier").
//
//   node tests/test_schuerfrecht_marker.js
//
// DER BEFUND, gegen den das gebaut wurde: Der Ring am Vorkommen trug genau EIN Bit - fremd/eigen
// und bewacht/unbewacht. Der Server schickt zu jedem Recht laengst `halterName`, `tag`, `seit`,
// `eskorte` und `schutzBis`; alles davon stand nur im Kartenmenue und im <title> - und einen
// Titel-Tooltip gibt es auf dem Handy nicht.
//
// GEPRUEFT WIRD AM GERENDERTEN MARKER, nicht am Quelltext („im DOM vorhanden" ist nicht „fuer den
// Spieler sichtbar"), und es wird die REGEL gemessen, nicht eine Momentaufnahme:
//   A  Der Bogen WAECHST mit der Eskorte. Gemessen wird nicht „bei 10 Schiffen ist er 0.75 lang",
//      sondern dass fuenf Staerken eine monoton steigende Folge ergeben - und dass die staerkste
//      Eskorte SICHTBAR ist. Der Randfall dahinter: Ein SVG-Bogen ueber exakt 360 Grad hat
//      identischen Start- und Endpunkt und wird als NICHTS gezeichnet; die staerkste Eskorte
//      saehe damit aus wie gar keine. Deshalb misst 1e die gezeichnete Laenge (getTotalLength),
//      nicht das Vorhandensein eines Knotens.
//   B  Das Kuerzel steht am Vorkommen UND traegt die Klasse `planet-label`. Die Klasse ist nicht
//      Kosmetik: An ihr haengt kbLabelsEntflechten (KB-19), und nur so erbt eine neue
//      Beschriftungsart den Schutz gegen Ueberdeckung, statt ihn nachgereicht zu bekommen.
//   C  Der Puls laeuft NUR waehrend der Schutzfrist (`schutzBis`) - beide Richtungen gemessen.
//      Ein Marker, der immer pulst, sagt nichts.
//   D  Keiner der drei Zusaetze nimmt dem Vorkommen den Klick (`pointer-events="none"`), und der
//      Tap oeffnet weiterhin das Kartenmenue - gemessen mit elementFromPoint, nicht geglaubt.
//      DIESE PRUEFUNG HAT SICH SOFORT BEZAHLT GEMACHT: Sie fand, dass das Kuerzel des einen
//      Vorkommens ueber der MITTE des naechsten liegt (die Guertelbahn steht eng) und - weil es
//      im eigenen Knoten haengt - dessen Tipp abfing. Ein Tipp auf den Marker oeffnete das
//      falsche Menue. Die Klassenzugehoerigkeit zu `planet-label` schuetzt davor NICHT: Der
//      Entflechter schiebt Beschriftungen gegeneinander, nicht von fremden Koerpern weg.
//
// GEGENPROBE: `KEPLER_SPIELDATEI` auf den Stand vor GR-11 (`git show 1d9f443^:weltraum_kolonie.html`)
// - dort faellt die unten GEMESSENE Liste. Aufruf mit KEPLER_GR11_GEGENPROBE=alt.
//
// WAS DIESER WAECHTER BEIM ERSTEN LAUF GEFUNDEN HAT, bevor irgendetwas gruen war: `x` und `y` sind
// im Kartencode ZEICHENKETTEN (toFixed). GR-11 rechnete mit ihnen - `(y + rr + 7).toFixed(...)` -
// und warf beim Zeichnen. Folge war nicht ein fehlender Zusatz, sondern ein KOMPLETT fehlendes
// Vorkommen auf der Karte, in jedem System. Der Bogen bekam ausserdem eine zusammengehaengte
// x-Koordinate. Beides stand im Commit und haette ohne diesen Test die Auslieferung erreicht.
const { starteBrowser, SPIEL_URL, SPIELDATEI, ruhigeUhren, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check: rohCheck, ende } = pruefer();
const ergebnis = {};
const check = (name, bedingung, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bedingung; rohCheck(name, bedingung, zusatz); };

const SAB = process.env.KEPLER_GR11_GEGENPROBE || '';
/* GEMESSEN gegen 1d9f443^ (Stand vor GR-11), nicht geschaetzt. Zwei Eintraege fehlen hier
   bewusst: 1a (die Vorkommen werden gezeichnet) und 1b (unbewacht = gestrichelt) sind auch
   vorher richtig - sie sind die Vorbedingung, gegen die 1c bis 1e ueberhaupt etwas aussagen,
   und kein Beleg fuer GR-11. Ein erster Entwurf hatte sie mit aufgelistet; die Messung hat das
   widerlegt. */
const MUSS_FALLEN = { alt: ['1c', '1d', '1e', '2a', '2b', '3a', '4b'] };

const SAVE_KEY = 'kepler7-save-v3';
const SYS = 'chronos';
const PLATZ = '3';

/* Fuenf Staerken auf fuenf Plaetzen im SELBEN Bild: So misst 1a die Regel („mehr Schiffe, laengerer
   Bogen") in einem einzigen Lauf, statt fuenf Laeufe zu vergleichen, in denen sich auch anderes
   geaendert haben koennte. Die Zahlen liegen bewusst in den Faechern der Schwellen 1/5/15/40 -
   0 (unbewacht), 1, 8, 25, 60 - und nicht auf ihnen: Ein Test, der genau auf einer Kappe misst,
   meldet bei jeder Feinjustierung rot, ohne dass die Aussage kaputt waere. */
const STAERKEN = { '1': 0, '2': 1, '3': 8, '4': 25, '5': 60 };

function serverFeld(opt){
  opt = opt || {};
  const plaetze = {};
  for (const p of Object.keys(STAERKEN)){
    plaetze[p] = { sorte:'eisen', groesse:'brocken', vorrat:90000, halter:'x2', halterName:'Rivale',
      tag:'RIV', seit:1, eskorte: STAERKEN[p] ? { jaeger: STAERKEN[p] } : {},
      schutzBis: opt.schutz ? Date.now() + 90*60*1000 : 0 };
  }
  return { systeme:[SYS], felder:{ [SYS]: { plaetze } } };
}
function backend(store, opt){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'asteroid/field') return j(serverFeld(opt));
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'notifications') return req.method() === 'POST' ? j({ ok:true }) : j({ notifications: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|reports|galaxy|vorposten/.test(p))
      return j(p.includes('pending') ? { reward:null } : (p === 'galaxy'
        ? { npcEmpireStrength:1, marketTrend:1, unlockedAlienRaces:[], collapsedSystems:{}, activeWormhole:null, news:[], controlledSystems:{}, factions:{}, alienNester: [] }
        : []));
    return j({});
  };
}
const SPIELSTAND = JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen: true, newbieWelcomeSeen: true, seenTabHints: { basis:1, karte:1, galaxie:1 },
  resources: { energie:148000, erz:152000, kristalle:131000, deuterium:92000, antimaterie:3900, forschungspunkte:12200 },
  buildings: { solar:18, mine:17, kristallmine:15, labor:10, lager:12, werft:8 },
  research: {}, fleet: { jaeger:120, transporter:30, missions:[] }, colonies: {},
  activeBasePlanet: 'home', player: { id:'u', name:'AdmiralX' }, xp:152000, credits:384000
}));

async function karte(browser, opt){
  const store = { [SAVE_KEY]: SPIELSTAND };
  const ctx = await browser.newContext({ viewport: { width:1280, height:900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store, opt || {}));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']){
      const e = document.getElementById(id); if (e) e.remove();
    }
    const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click();
  });
  await page.waitForTimeout(700);
  await oeffneSystemUeberSektoren(page, SYS);
  await page.waitForTimeout(1200);
  return { ctx, page, errs };
}
/* Misst je Platz die GEZEICHNETE Laenge des Staerkebogens. getTotalLength() ist hier der Kern der
   Messung und nicht Bequemlichkeit: Ein <path> mit identischem Start- und Endpunkt EXISTIERT im
   DOM und hat Laenge 0 - genau der Randfall des Vollkreises. Der Vollkreis-Zweig zeichnet deshalb
   ein <circle>; dessen Umfang wird hier gleichwertig gerechnet. */
async function bogenLaengen(page){
  return page.evaluate((plaetze) => {
    const out = {};
    for (const p of plaetze){
      const g = document.querySelector(`[data-map-asteroid="${p}"]`);
      if (!g){ out[p] = null; continue; }
      let laenge = 0, art = 'keiner';
      const pfad = g.querySelector('path[stroke-linecap="round"]');
      if (pfad){ laenge = pfad.getTotalLength(); art = 'bogen'; }
      else {
        // Der Vollkreis-Zweig: der KRAEFTIGE Ring (stroke-width 1.9), nicht der schwache darunter.
        const voll = [...g.querySelectorAll('circle')]
          .find(c => c.getAttribute('stroke-width') === '1.9' && !c.querySelector('animate'));
        if (voll){ laenge = 2 * Math.PI * Number(voll.getAttribute('r') || 0); art = 'vollkreis'; }
      }
      out[p] = { laenge: Math.round(laenge * 100) / 100, art };
    }
    return out;
  }, Object.keys(STAERKEN));
}

(async () => {
  const browser = await starteBrowser();
  try {
    // ---- 1) A: der Staerkebogen ------------------------------------------------------------------
    const t1 = await karte(browser);
    const bg = await bogenLaengen(t1.page);
    const da = Object.keys(STAERKEN).every(p => bg[p] !== null);
    check('1a: alle fuenf Vorkommen sind gezeichnet', da, bg);
    const l = p => (bg[p] && bg[p].laenge) || 0;
    /* Unbewacht: KEIN Staerkebogen, sondern der gestrichelte Ring - „eine offene Einladung, und
       man sieht es auf der Karte". Ein Bogen der Laenge null waere unsichtbar statt aussagekraeftig. */
    const gestrichelt = await t1.page.evaluate(() => {
      const g = document.querySelector('[data-map-asteroid="1"]');
      return g ? [...g.querySelectorAll('circle')].some(c => c.getAttribute('stroke-dasharray')) : false;
    });
    check('1b: ohne Eskorte bleibt es der gestrichelte Ring - kein Bogen der Laenge null',
      gestrichelt === true && (bg['1'] || {}).art === 'keiner', { platz1: bg['1'], gestrichelt });
    check('1c: mit Eskorte traegt der Marker einen Staerkebogen',
      ['2','3','4','5'].every(p => bg[p] && bg[p].art !== 'keiner'),
      { '2':bg['2'], '3':bg['3'], '4':bg['4'], '5':bg['5'] });
    /* DIE REGEL, nicht die Zahl: mehr Schiffe -> laengerer Bogen, streng monoton ueber alle vier
       bewachten Staerken. Ein fest verdrahteter Bogen erfuellte 1c, aber niemals 1d. */
    check('1d: und er WAECHST streng mit der Eskorte (1 < 8 < 25 < 60 Schiffe)',
      l('2') > 0 && l('3') > l('2') && l('4') > l('3') && l('5') > l('4'),
      { '1 Schiff':l('2'), '8':l('3'), '25':l('4'), '60':l('5') });
    /* DER RANDFALL, der ohne eigenen Zweig erst im Spiel auffiele: 360 Grad = identischer Start-
       und Endpunkt = gar nichts gezeichnet. Die staerkste Eskorte saehe aus wie keine. */
    check('1e: die staerkste Eskorte ist SICHTBAR - der Vollkreis wird nicht zu nichts',
      (bg['5'] || {}).art === 'vollkreis' && l('5') > 20, { platz5: bg['5'] });

    // ---- 2) B: das Halter-Kuerzel ----------------------------------------------------------------
    const kuerzel = await t1.page.evaluate(() => {
      const g = document.querySelector('[data-map-asteroid="3"]');
      if (!g) return { da:false };
      const t = [...g.querySelectorAll('text')].find(x => /RIV/.test(x.textContent||''));
      if (!t) return { da:false, texte: [...g.querySelectorAll('text')].map(x => x.textContent) };
      const b = t.getBoundingClientRect();
      return { da:true, text: (t.textContent||'').trim(), klassen: t.getAttribute('class') || '',
        breite: Math.round(b.width), hoehe: Math.round(b.height) };
    });
    check('2a: der Marker nennt den Halter - und zwar SICHTBAR (gemessene Flaeche > 0)',
      kuerzel.da === true && /RIV/.test(kuerzel.text || '') && kuerzel.breite > 0 && kuerzel.hoehe > 0, kuerzel);
    /* Die Klasse ist die eigentliche Zusage: An `planet-label` haengt kbLabelsEntflechten. Ohne
       sie stuende das Kuerzel da, wuerde aber von jeder Nachbarbeschriftung ueberdeckt - genau der
       Fehler, den KB-19 fuer drei andere Kartenobjektarten schon einmal beheben musste. */
    check('2b: es traegt planet-label und erbt damit den Schutz gegen Ueberdeckung (KB-19)',
      /\bplanet-label\b/.test(kuerzel.klassen || ''), { klassen: kuerzel.klassen });

    // ---- 4) D: der Klick bleibt beim Vorkommen ---------------------------------------------------
    /* Drei neue Zeichen ueber dem Marker sind drei neue Gelegenheiten, ihm den Klick wegzunehmen.
       Gemessen wird, WAS unter dem Finger liegt (elementFromPoint), nicht ob ein Attribut im
       Markup steht.
       WOGEGEN GENAU: gegen die DREI ZUSAETZE aus GR-11 - Staerkebogen, Schutzpuls, Halter-
       Kuerzel. Ein erster Entwurf verlangte stattdessen, dass die Marker-Mitte ueberhaupt zum
       eigenen Knoten gehoert. Das fiel - aber aus einem fremden Grund: Am Vorkommen 5 liegt der
       PLANETENNAME „Chronos-3" ueber der Mitte, und zwar GEMESSEN AUCH AM STAND VOR GR-11
       (Lauf vom 07.09.2026 gegen 1d9f443^). Eine Pruefung, die daran rot wird, misst eine
       fremde, aeltere Ueberdeckung und macht diesen Waechter unbrauchbar - „eine Pruefung, die
       aus dem falschen Grund faellt, ist so schlecht wie eine, die aus dem falschen Grund gruen
       ist". Der vorbestehende Befund ist gemeldet, aber nicht Gegenstand dieses Tests. */
    const klick = await t1.page.evaluate((plaetze) => {
      const istZusatz = (el) => {
        if (!el) return null;
        if (el.tagName === 'text' && /planet-label/.test(el.getAttribute('class')||'')
            && /^\[?[A-Z]{2,4}\]?$/.test((el.textContent||'').trim())) return 'kuerzel';
        if (el.tagName === 'path' && el.getAttribute('stroke-linecap') === 'round') return 'bogen';
        if (el.tagName === 'circle' && el.querySelector && el.querySelector('animate')) return 'puls';
        return null;
      };
      const treffer = {};
      for (const p of plaetze){
        const g = document.querySelector(`[data-map-asteroid="${p}"]`);
        if (!g){ treffer[p] = 'kein Knoten'; continue; }
        const k = g.querySelector('polygon');
        if (!k){ treffer[p] = 'kein Koerper'; continue; }
        const b = k.getBoundingClientRect();
        treffer[p] = istZusatz(document.elementFromPoint(Math.round(b.left + b.width/2), Math.round(b.top + b.height/2)));
      }
      // Und ein Tipp MITTEN AUF das Kuerzel selbst: er darf dort nicht haengenbleiben.
      const t = document.querySelector('[data-map-asteroid="3"] text.planet-label');
      let aufKuerzel = 'kein Kuerzel';
      if (t){
        const b = t.getBoundingClientRect();
        aufKuerzel = istZusatz(document.elementFromPoint(Math.round(b.left + b.width/2), Math.round(b.top + b.height/2)));
      }
      // Der Tap selbst muss weiterhin das Kartenmenue oeffnen.
      const g5 = document.querySelector('[data-map-asteroid="5"]');
      if (g5) g5.dispatchEvent(new MouseEvent('click', { bubbles:true }));
      return { treffer, aufKuerzel, menue: !!document.querySelector('.kmenu') };
    }, Object.keys(STAERKEN));
    check('4a: keiner der drei Zusaetze legt sich auf die Mitte eines Vorkommens',
      Object.keys(STAERKEN).every(p => klick.treffer[p] === null), klick.treffer);
    check('4b: und ein Tipp MITTEN AUF das Kuerzel bleibt nicht daran haengen',
      klick.aufKuerzel === null, { getroffen: klick.aufKuerzel });
    check('4c: der Tap oeffnet weiterhin das Kartenmenue', klick.menue === true, klick);
    check('4d: keine Skriptfehler beim Zeichnen', t1.errs.length === 0, t1.errs.slice(0, 2));

    // ---- 3) C: der Schutzpuls, beide Richtungen --------------------------------------------------
    /* Zwei Laeufe, die sich NUR in `schutzBis` unterscheiden. Ein Marker, der immer pulst, sagt
       nichts - deshalb ist 3b (kein Puls ohne Frist) genauso wichtig wie 3a.
       DIE MESSUNG STEHT VOR DEM SCHLIESSEN DES TABS. Erster Entwurf mass danach, fing die
       Ausnahme mit .catch(() => -1) und meldete rot - eine Pruefung, die nur ihren eigenen
       Ablauffehler misst. Deshalb ist der Rueckfallwert hier weg: Wirft die Messung, faellt der
       Test mit Grund, statt eine Zahl zu erfinden. */
    const pulsZaehlen = (page) => page.evaluate(() =>
      document.querySelectorAll('[data-map-asteroid] circle > animate[attributeName="r"]').length);
    const ohnePuls = await pulsZaehlen(t1.page);
    await t1.ctx.close();
    const t3 = await karte(browser, { schutz: true });
    const mitPuls = await pulsZaehlen(t3.page);
    check('3a: waehrend der Schutzfrist pulst der Marker', mitPuls >= Object.keys(STAERKEN).length,
      { pulse: mitPuls, vorkommen: Object.keys(STAERKEN).length });
    await t3.ctx.close();
    check('3b: ohne Schutzfrist pulst er NICHT - ein Marker, der immer pulst, sagt nichts',
      ohnePuls === 0, { ohneFrist: ohnePuls, mitFrist: mitPuls });
  } finally {
    await browser.close();
  }

  if (SAB){
    const soll = MUSS_FALLEN[SAB] || [];
    const gefallen = Object.keys(ergebnis).filter(n => ergebnis[n] === false).sort();
    const fehlt = soll.filter(k => gefallen.indexOf(k) < 0);
    const zuviel = gefallen.filter(k => soll.indexOf(k) < 0);
    console.log('\nGegenprobe „' + SAB + '": gefallen ' + JSON.stringify(gefallen) + ', erwartet ' + JSON.stringify(soll));
    if (fehlt.length || zuviel.length){
      console.log('FAIL - Gegenprobe: nicht gefallen ' + JSON.stringify(fehlt) + ', unerwartet gefallen ' + JSON.stringify(zuviel));
      process.exit(1);
    }
    console.log('PASS - Gegenprobe: genau die erwarteten Pruefungen sind gefallen.');
    process.exit(0);
  }
  ende();
})();
