// Die Sprungleiste in ALLEN FUENF Panels (Etappe UI-5b, 12.09.2026).
//
// WAS HIER ABGESICHERT WIRD
// -------------------------
// `.jumpnav` ist eine Einstellung (`state.uiJumpNav`, standardmaessig AUS) und existiert fuenfmal:
// `#jumpnav-basis`, `-forschung`, `-punkte`, `-fortschritt`, `-einstellungen`. Gefuellt wird sie auf
// zwei Arten: Basis und Forschung sammeln ihre `.section-title`-Ueberschriften selbst ein und
// springen auf `[data-acc-key]`; Punktestand, Fortschritt und Einstellungen lesen die
// `.prog-section[data-sec]`-Abschnitte des Panels und springen auf diese. Bis UI-5b war die zweite
// Haelfte eine handgepflegte Liste, und genau dort sassen zwei Befunde.
//
// DREI ZUSAGEN, DREI PRUEFGRUPPEN:
//
//   A  Ein Sprung landet so, dass der Abschnittstitel unter der klebenden Reiterleiste steht und
//      vollstaendig im Bild ist - in allen fuenf Panels. GEMESSEN am Grundstand v8.724.0 bei
//      900x1000 mit kompaktem Kopf: Basis und Forschung trugen `scroll-margin-top: 168px`, die
//      drei anderen 0px, und jeder Sprung dort landete auf `zielOben 0` unter einer Leiste bis
//      158 - der Titel lag vollstaendig hinter ihr.
//
//   B  Die Leiste der drei handgepflegten Reiter nennt genau die SICHTBAREN Abschnitte des Panels,
//      mit dem Icon aus deren Markup. GEMESSEN am Grundstand: Fortschritt hatte 20 Abschnitte, die
//      Leiste nannte 12 - nicht erreichbar waren profil, uebersicht, bonibilanz, kompendium,
//      allianztitel, allianzanstrich, dailylogin und aussehen.
//
//   D  Ein Knoten mit `role="button"` und `tabindex="0"` laesst sich per Tastatur ausloesen, ohne
//      dass die Leertaste die Seite wegscrollt - und ohne Skriptfehler, auch wenn er eine
//      SVG-Gruppe ist. GEMESSEN am Grundstand auf der Sektorkarte: 16 der 34 so ausgezeichneten
//      Knoten sind `<g>`-Gruppen, bei keiner ist `click` eine Funktion, und ein Enter darauf warf
//      `TypeError: el.click is not a function`.
//
// DIE ANSCHLAG-FALLE (Hausregel: erst messen, dann urteilen)
// ---------------------------------------------------------
// Steht die Seite beim Sprung am unteren Anschlag, liegt das Ziel zufaellig frei - die Messung
// meldet dann Glueck statt der Regel und bliebe auch bei fehlendem Ausgleich still gruen. Jede
// Einzelmessung fuehrt deshalb `scrollY`, `maxScroll` und ein Anschlag-Kennzeichen mit; Messungen
// am Anschlag gehen NICHT ins Urteil ein, und V4 verlangt ausdruecklich, dass je Reiter genug
// Messungen ABSEITS des Anschlags uebrig bleiben. Ohne diese Vorbedingung waere A2 in einem kurzen
// Panel wertlos.
//
// GEGENPROBEN (KEPLER_SPRUNGMARKEN_GEGENPROBE=<stand>, Spieldatei per KEPLER_SPIELDATEI umlenken):
//   =alt         der Grundstand v8.724.0 unveraendert
//   =sabotageA   `.prog-section[data-sec]` aus dem `scroll-margin-top`-Selektor entfernt
//   =sabotageB   die eingesammelte Abschnittsliste bei 12 Eintraegen abgeschnitten
//   =sabotageC   die ausloesende Zeile des delegierten keydown-Handlers entfernt
// Die MUSS_FALLEN-Listen sind GEMESSEN (erst mit leeren Listen laufen lassen, dann eingetragen),
// nicht geraten. Eine Sabotage, die gruen bleibt, ist ein Befund ueber die PRUEFUNG - nicht ueber
// die Sabotage; eine ueberzaehlige rote Pruefung ebenso.
const { starteBrowser, SPIEL_URL, ruhigeUhren, versionAbfangen } = require('./lib/umgebung');

const DATEI = SPIEL_URL;
const SAB = process.env.KEPLER_SPRUNGMARKEN_GEGENPROBE || '';

// GEMESSEN am 12.09.2026, je Stand ein eigener Lauf.
const MUSS_FALLEN = {
  alt:       ['A2', 'B1', 'B3', 'D4'],
  sabotageA: ['A2'],
  sabotageB: ['B1'],
  sabotageC: ['D1', 'D2']
};

const ergebnis = {};
let fail = false;
const check = (n, c, x) => {
  console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : ''));
  fail = fail || !c;
};
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };

// Das Messfenster - EINE Quelle, weil die Schranke in D3 ein Zehntel seiner Hoehe ist.
const FENSTER = { width: 900, height: 1000 };
const REITER = ['basis', 'forschung', 'punkte', 'fortschritt', 'einstellungen'];
// Die drei Reiter, die ihre Leiste aus `.prog-section[data-sec]` fuellen - dort sassen A und B.
const HANDGEPFLEGT = ['punkte', 'fortschritt', 'einstellungen'];
// Die drei Schalter im Abschnitt Uebersichtlichkeit, je Zeile ihr sichtbarer Schalter.
const SCHALTER = [
  ['uiJumpNavToggleRow', 'uiJumpNavSwitch'],
  ['uiCollapsibleToggleRow', 'uiCollapsibleSwitch'],
  ['uiTwoColToggleRow', 'uiTwoColSwitch']
];

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData() || '{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

// Einstellungen haengen NICHT an der Reiterleiste - es gibt kein `.tab-btn[data-tab="einstellungen"]`,
// der Reiter wird ueber `#headerProfileBtn` geoeffnet. Wer das uebersieht, misst am geschlossenen
// Panel und bekommt still gruene Zahlen.
async function oeffneReiter(page, tab){
  await page.evaluate(t => {
    if (t === 'einstellungen'){ const h = document.getElementById('headerProfileBtn'); if (h) h.click(); }
    else { const b = document.querySelector('.tab-btn[data-tab="' + t + '"]'); if (b) b.click(); }
  }, tab);
  await page.waitForTimeout(1800);
}

(async () => {
  const browser = await starteBrowser();
  const store = {};
  const now = Date.now();
  /* Der Spread der ruhigen Uhren steht VORNE, damit alles danach gewinnt (lib/umgebung.js).
     `compactHead: true` ist Absicht und keine Bequemlichkeit: Nur unter `body.compact-head` klebt
     die Reiterleiste, und nur dann gibt es den Fehler, den A messen soll.
     `uiCollapsibleSections: false` ebenfalls: Ein aufklappender Abschnitt veraendert die
     Seitenhoehe waehrend des Sprungs, und dann misst A einen Uebergangszustand statt der Regel. */
  store['kepler7-save-v3'] = JSON.stringify(Object.assign({ ...ruhigeUhren() }, {
    tutorialSeen: true, newbieWelcomeSeen: true,
    seenTabHints: { basis:1, verteidigung:1, forschung:1, flotte:1, expedition:1, karte:1,
                    galaxie:1, allianz:1, offiziere:1, markt:1, punkte:1, fortschritt:1, sammlung:1 },
    compactHead: true,
    uiJumpNav: true, uiCollapsibleSections: false, uiTwoColumn: false, collapsedSections: {},
    resources: { energie:48000, erz:52000, kristalle:31000, deuterium:20000, antimaterie:900, forschungspunkte:2200 },
    buildings: { solar:18, mine:17, kristallmine:15, labor:10, lager:12, werft:9 },
    research: {}, fleet: { jaeger:100, ships:3, missions:[] },
    discovered: { rhea:true, aion:true }, colonies: {}, activeBasePlanet: 'home',
    player: { id:'u', name:'A' }, xp: 52000, credits: 184000, buffs: [], lastTick: now,
    colonyNames: {}, colonyNotes: {}
  }));

  const ctx = await browser.newContext({ viewport: FENSTER });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push('pageerror: ' + e));
  await versionAbfangen(page);
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(DATEI);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay',
     'kofiEmailPromptOverlay', 'conflictOverlay', 'prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
  });

  merke('V1: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  // ---- V2) Vorbedingung: die Leiste klebt ueberhaupt ------------------------------------------
  // Ohne klebende Reiterleiste gibt es nichts, wovor ein Sprungziel Abstand halten muesste - A
  // waere dann trivial gruen.
  const kopf = await page.evaluate(() => {
    const t = document.querySelector('.tabs');
    return { kompakt: document.body.classList.contains('compact-head'),
             klebt: !!t && getComputedStyle(t).position === 'sticky',
             leisteUnten: t ? Math.round(t.getBoundingClientRect().bottom) : null };
  });
  merke('V2: kompakter Kopf aktiv und die Reiterleiste klebt',
    kopf.kompakt && kopf.klebt && kopf.leisteUnten > 0, kopf);

  // Aufwaermrunde: jeden Reiter einmal oeffnen, BEVOR gemessen wird. GEMESSEN am 12.09.2026: Beim
  // allerersten Besuch der Basis waechst der Inhalt ueber dem Sprungziel noch waehrend der weichen
  // Scroll-Bewegung (Titel landete auf 1082 statt 168, danach dreimal in Folge auf 168). Das ist
  // eine Anlaufeigenschaft des ersten Aufbaus, kein Befund ueber die Sprungmarken - gemessen wird
  // deshalb am eingeschwungenen Panel.
  for (const tab of REITER) await oeffneReiter(page, tab);

  // ---- V3/B/A) je Reiter: Leiste lesen, dann jeden Eintrag wirklich anspringen ----------------
  const leisten = {};
  const spruenge = {};
  for (const tab of REITER){
    await oeffneReiter(page, tab);
    leisten[tab] = await page.evaluate(t => {
      const leiste = document.getElementById('jumpnav-' + t);
      const panel = document.getElementById('tab-' + t);
      if (!leiste || !panel) return { fehlt:true };
      const eintraege = [...leiste.querySelectorAll('a')].map(a => {
        const ikon = a.firstElementChild;
        const text = (ikon ? a.textContent.replace(ikon.textContent, '') : a.textContent).trim();
        return { key: a.getAttribute('data-jump-to') || a.getAttribute('data-jump-acc'),
                 art: a.hasAttribute('data-jump-to') ? 'sec' : 'acc',
                 text, ikon: ikon ? ikon.outerHTML : '' };
      });
      // Die Abschnitte kommen aus dem PANEL-Markup, die Eintraege aus der erzeugten Leiste - zwei
      // verschiedene Quellen. Beide aus derselben zu nehmen hiesse, die Datei mit sich selbst zu
      // vergleichen.
      const abschnitte = [...panel.querySelectorAll('.prog-section[data-sec]')].map(s => {
        const k = s.querySelector('.prog-sec-header');
        const erst = k ? k.firstElementChild : null;
        const chevron = !!(erst && erst.classList && erst.classList.contains('prog-chevron'));
        return { key: s.getAttribute('data-sec'),
                 verborgen: s.style.display === 'none' || getComputedStyle(s).display === 'none',
                 kopfText: k ? k.textContent.replace(/\s+/g, ' ').trim() : '',
                 ikon: (erst && !chevron) ? erst.outerHTML : '' };
      });
      return { fehlt:false, sichtbar: leiste.style.display !== 'none' && !!leiste.offsetParent,
               eintraege, abschnitte };
    }, tab);

    const anzahl = leisten[tab].fehlt ? 0 : leisten[tab].eintraege.length;
    const zeilen = [];
    for (let i = 0; i < anzahl; i++){
      zeilen.push(await page.evaluate(async ([t, idx]) => {
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 350));
        const a = document.querySelectorAll('#jumpnav-' + t + ' a')[idx];
        if (!a) return { fehlt:true };
        const key = a.getAttribute('data-jump-to') || a.getAttribute('data-jump-acc');
        /* Gemessen wird, was der Spieler SIEHT: die Lage des Abschnittstitels im Fenster.
           Bei den handgepflegten Reitern ist das die `.prog-sec-header` des Abschnitts, bei den
           selbstwartenden die `[data-acc-key]`-Ueberschrift selbst. */
        const zielEl = () => {
          const sec = a.getAttribute('data-jump-to');
          if (sec){
            const box = document.querySelector('.prog-section[data-sec="' + CSS.escape(sec) + '"]');
            return box ? box.querySelector('.prog-sec-header') : null;
          }
          return document.querySelector('[data-acc-key="' + CSS.escape(a.getAttribute('data-jump-acc')) + '"]');
        };
        /* Auf RUHE warten statt auf eine Dauer: `scrollIntoView({behavior:'smooth'})` braucht
           seine Zeit, und der Inhalt ueber dem Ziel kann waehrenddessen noch wachsen. Beobachtet
           werden Fensterlage, Scroll-Position UND Dokumenthoehe zusammen - eine davon allein
           steht auch mitten in der Bewegung still. */
        const messe = () => {
          const e = zielEl(); if (!e) return null;
          return Math.round(e.getBoundingClientRect().top) + ':' + Math.round(window.scrollY) +
                 ':' + Math.round(document.documentElement.scrollHeight);
        };
        a.click();
        let vorlauf = null, gleich = 0;
        for (let k = 0; k < 40 && gleich < 3; k++){
          await new Promise(r => setTimeout(r, 150));
          const jetzt = messe();
          gleich = (jetzt !== null && jetzt === vorlauf) ? gleich + 1 : 0;
          vorlauf = jetzt;
        }
        const e = zielEl();
        if (!e) return { key, keinZiel:true };
        const rr = e.getBoundingClientRect();
        const leiste = document.querySelector('.tabs');
        const lb = leiste.getBoundingClientRect();
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const sy = Math.round(window.scrollY);
        return { key, oben: Math.round(rr.top), unten: Math.round(rr.bottom),
                 leisteUnten: Math.round(lb.bottom),
                 klebt: getComputedStyle(leiste).position === 'sticky',
                 scrollY: sy, maxScroll: Math.round(maxScroll),
                 amAnschlag: sy >= Math.round(maxScroll) - 2,
                 fenster: window.innerHeight, ruhig: gleich >= 3 };
      }, [tab, i]));
    }
    spruenge[tab] = zeilen;
  }

  merke('V3: alle fuenf Sprungleisten sind sichtbar und gefuellt',
    REITER.every(t => !leisten[t].fehlt && leisten[t].sichtbar && leisten[t].eintraege.length > 0),
    REITER.map(t => t + '=' + (leisten[t].fehlt ? 'fehlt' : (leisten[t].sichtbar ? '' : 'unsichtbar:') + leisten[t].eintraege.length)).join(' '));

  // ---- V4) Die Anschlag-Vorbedingung ----------------------------------------------------------
  const frei = {};
  for (const t of REITER) frei[t] = spruenge[t].filter(z => !z.keinZiel && !z.fehlt && !z.amAnschlag).length;
  merke('V4: je Reiter gibt es Spruenge ABSEITS des unteren Anschlags (sonst misst A2 nur Glueck)',
    REITER.every(t => frei[t] >= 1), frei);

  // ---- A1) Die Seite ist nach jedem Sprung zur Ruhe gekommen ---------------------------------
  const unruhig = [];
  for (const t of REITER) for (const z of spruenge[t]) if (!z.keinZiel && !z.fehlt && !z.ruhig) unruhig.push(t + '/' + z.key);
  merke('A1: jeder Sprung kam zur Ruhe und fand sein Ziel',
    unruhig.length === 0 && REITER.every(t => spruenge[t].every(z => !z.keinZiel && !z.fehlt)),
    { unruhig: unruhig.slice(0, 4),
      ohneZiel: REITER.flatMap(t => spruenge[t].filter(z => z.keinZiel || z.fehlt).map(z => t + '/' + z.key)).slice(0, 4) });

  // ---- A2) Der Kern: kein Ziel steht hinter der klebenden Leiste ------------------------------
  // Nur Messungen ABSEITS des Anschlags zaehlen (siehe Kopf). Die Schranke ist die GEMESSENE
  // Unterkante der Leiste, keine getippte Zahl - sie waechst mit jedem Reiter und jedem Banner.
  const verdeckt = [];
  for (const t of REITER) for (const z of spruenge[t]){
    if (z.keinZiel || z.fehlt || z.amAnschlag || !z.klebt) continue;
    if (!(z.oben >= z.leisteUnten - 4)) verdeckt.push({ reiter:t, key:z.key, oben:z.oben, leisteUnten:z.leisteUnten, scrollY:z.scrollY, maxScroll:z.maxScroll });
  }
  merke('A2: kein Sprungziel steht hinter der klebenden Reiterleiste (alle fuenf Reiter)',
    verdeckt.length === 0,
    { verdeckt: verdeckt.slice(0, 5), gemessen: REITER.map(t => t + '=' + frei[t]).join(' ') });

  // ---- A3) Und es steht danach vollstaendig im Bild -------------------------------------------
  const angeschnitten = [];
  for (const t of REITER) for (const z of spruenge[t]){
    if (z.keinZiel || z.fehlt) continue;
    if (!(z.unten <= z.fenster && z.oben >= 0)) angeschnitten.push({ reiter:t, key:z.key, oben:z.oben, unten:z.unten, fenster:z.fenster });
  }
  merke('A3: der Abschnittstitel steht nach dem Sprung vollstaendig im Fenster',
    angeschnitten.length === 0, angeschnitten.slice(0, 5));

  // ---- B1) Vollstaendigkeit: die Leiste nennt genau die sichtbaren Abschnitte -----------------
  const luecken = [];
  for (const t of HANDGEPFLEGT){
    const sollKeys = leisten[t].abschnitte.filter(s => !s.verborgen).map(s => s.key).sort();
    const istKeys = leisten[t].eintraege.map(e => e.key).sort();
    if (sollKeys.join(',') !== istKeys.join(',')){
      luecken.push({ reiter:t, fehlen: sollKeys.filter(k => istKeys.indexOf(k) < 0),
                     zuviel: istKeys.filter(k => sollKeys.indexOf(k) < 0),
                     soll: sollKeys.length, ist: istKeys.length });
    }
  }
  merke('B1: die Leiste nennt genau die sichtbaren Abschnitte ihres Panels',
    luecken.length === 0,
    { luecken, gemessen: HANDGEPFLEGT.map(t => t + '=' + leisten[t].abschnitte.filter(s => !s.verborgen).length + '/' + leisten[t].eintraege.length).join(' ') });

  // ---- B2) Verborgene Abschnitte gehoeren NICHT hinein ----------------------------------------
  // Mit eigener Vorbedingung: gaebe es keinen verborgenen Abschnitt, waere die Pruefung leer.
  const verborgen = HANDGEPFLEGT.flatMap(t => leisten[t].abschnitte.filter(s => s.verborgen).map(s => ({ reiter:t, key:s.key })));
  const verborgenDrin = verborgen.filter(v => leisten[v.reiter].eintraege.some(e => e.key === v.key));
  merke('B2: kein verborgener Abschnitt steht in der Leiste (und es gibt ueberhaupt einen)',
    verborgen.length >= 1 && verborgenDrin.length === 0, { verborgen, verborgenDrin });

  // ---- B3) Icon und Beschriftung stammen aus dem Markup ---------------------------------------
  // Die Regel, nicht die Momentaufnahme: Verglichen wird der Eintrag mit SEINEM Abschnittskopf.
  // Eine gepflegte Liste, die vom Markup abweicht, faellt hier - eine abgelesene nie.
  const abweichung = [];
  for (const t of HANDGEPFLEGT){
    for (const e of leisten[t].eintraege){
      const sec = leisten[t].abschnitte.find(s => s.key === e.key);
      if (!sec){ abweichung.push({ reiter:t, key:e.key, grund:'kein Abschnitt' }); continue; }
      if (e.ikon !== sec.ikon) abweichung.push({ reiter:t, key:e.key, grund:'Icon', leiste:e.ikon, markup:sec.ikon });
      else if (!e.text) abweichung.push({ reiter:t, key:e.key, grund:'leere Beschriftung' });
      else if (sec.kopfText.indexOf(e.text) < 0) abweichung.push({ reiter:t, key:e.key, grund:'Beschriftung', leiste:e.text, markup:sec.kopfText });
    }
  }
  const mitIkon = HANDGEPFLEGT.reduce((n, t) => n + leisten[t].eintraege.filter(e => e.ikon).length, 0);
  merke('B3: jeder Eintrag traegt Icon und Beschriftung seines Abschnittskopfs',
    abweichung.length === 0 && mitIkon >= 1, { abweichung: abweichung.slice(0, 4), mitIkon });

  merke('E1: bis hierher keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  // ---- D) Tastatur ----------------------------------------------------------------------------
  // Gemessen wird, ob der SCHALTER umspringt - nicht, ob irgendwo ein Handler im Quelltext steht.
  await oeffneReiter(page, 'einstellungen');
  const enterErgebnis = [], leerErgebnis = [], scrollDelta = [];
  for (const [zeile, schalter] of SCHALTER){
    for (const taste of ['Enter', 'Space']){
      const vor = await page.evaluate(([z, s]) => {
        const el = document.getElementById(z);
        if (!el) return { fehlt:true };
        el.scrollIntoView({ block:'center' });
        el.focus();
        const sw = document.getElementById(s);
        return { an: !!sw && sw.classList.contains('on'), fokus: document.activeElement === el,
                 scrollY: Math.round(window.scrollY) };
      }, [zeile, schalter]);
      await page.keyboard.press(taste);
      await page.waitForTimeout(700);
      const nach = await page.evaluate(s => {
        const sw = document.getElementById(s);
        return { an: !!sw && sw.classList.contains('on'), scrollY: Math.round(window.scrollY) };
      }, schalter);
      const gekippt = !vor.fehlt && vor.fokus && nach.an !== vor.an;
      (taste === 'Enter' ? enterErgebnis : leerErgebnis).push({ zeile, gekippt, vor, nach });
      scrollDelta.push({ zeile, taste, delta: Math.abs(nach.scrollY - vor.scrollY) });
    }
  }
  merke('D1: Enter loest alle drei Uebersichtlichkeits-Schalter aus',
    enterErgebnis.length === SCHALTER.length && enterErgebnis.every(r => r.gekippt),
    enterErgebnis.filter(r => !r.gekippt));
  merke('D2: die Leertaste loest alle drei Uebersichtlichkeits-Schalter aus',
    leerErgebnis.length === SCHALTER.length && leerErgebnis.every(r => r.gekippt),
    leerErgebnis.filter(r => !r.gekippt));
  /* Die Seite darf dabei nicht wegscrollen. Ein voller Leertasten-Sprung waere nahezu eine
     Fensterhoehe; die Schranke liegt bei einem Zehntel davon. Die verbleibende Bewegung ist keine
     Scroll-Reaktion, sondern Layout: Das Einschalten der Sprungmarken fuegt die Leiste ein und
     verschiebt alles darunter (gemessen 14 px). */
  const grenze = Math.round(FENSTER.height / 10);
  merke('D3: keine der beiden Tasten scrollt die Seite weg',
    scrollDelta.every(d => d.delta < grenze), { grenze, gross: scrollDelta.filter(d => d.delta >= grenze) });

  // ---- D4) Dieselbe Zusage fuer die SVG-Gruppen der Sektorkarte -------------------------------
  // `click()` steht an HTMLElement, nicht an SVGElement. Der delegierte Handler muss das
  // aushalten; tut er es nicht, sieht der Spieler nichts und die Konsole einen TypeError.
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
  await page.waitForTimeout(2600);
  const svgStand = await page.evaluate(() => {
    const alle = [...document.querySelectorAll('[role="button"][tabindex="0"]')];
    const svg = alle.filter(e => e.ownerSVGElement && e.getBoundingClientRect().width > 1);
    const g = svg[0];
    if (!g) return { kein:true, gesamt: alle.length };
    g.focus();
    return { kein:false, gesamt: alle.length, svg: svg.length,
             ohneClickFn: svg.filter(e => typeof e.click !== 'function').length,
             fokusOk: document.activeElement === g, marke: g.getAttribute('class') };
  });
  const fehlerVorTaste = fehler.length;
  if (!svgStand.kein) await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  const neueFehler = fehler.slice(fehlerVorTaste);
  merke('D4: Enter auf einer SVG-Gruppe der Sektorkarte wirft keinen Skriptfehler',
    !svgStand.kein && svgStand.fokusOk && svgStand.ohneClickFn >= 1 && neueFehler.length === 0,
    { svgStand, neueFehler: neueFehler.slice(0, 2) });

  await ctx.close();
  await browser.close();

  if (SAB){
    const soll = MUSS_FALLEN[SAB] || [];
    const gefallen = Object.keys(ergebnis).filter(n => ergebnis[n] === false);
    const fehlend = soll.filter(n => ergebnis[n] !== false);
    const unerwartet = gefallen.filter(n => soll.indexOf(n) < 0);
    if (fehlend.length) console.log('FAIL - Gegenprobe unvollstaendig: ' + fehlend.join(' ') + ' blieben gruen');
    else if (unerwartet.length) console.log('FAIL - Gegenprobe UEBERZAEHLIG: ' + unerwartet.join(' ') + ' fiel zusaetzlich');
    else console.log('GEGENPROBE ' + SAB + ': ' + gefallen.length + '/' + soll.length + ' gefallen (' + gefallen.map(n => n + '=rot').join(' ') + ')');
    process.exit((fehlend.length || unerwartet.length) ? 1 : 0);
  }
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.log('FAIL - Testlauf abgebrochen: ' + e.message);
  process.exit(1);
});
