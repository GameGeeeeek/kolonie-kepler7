/* Waechter fuer den Inventar-Haenger nach einem Massenkauf.
   Anlass (Spieler-Report Sascha, 21.08.2026): "ich hatte 200 millionen credits und hab bei
   modulblaupausen alles auf einmal gekauft, jetzt haengt das spiel sobald ich ins inventar will".

   Gemessen war die Ursache dreiteilig, und dieser Test bewacht alle drei Teile:
     (A) fuseAnzahl lief JE KARTE ueber ALLE Inventar-Schluessel. Weil der Schluessel den
         Hauptwert-Wurf UND die Zweitwerte enthaelt, stapeln gekaufte Module praktisch nie -
         20.000 Blaupausen sind 20.000 Schluessel, also 400 Mio Vergleiche je Neuzeichnung.
     (B) Die Liste zeichnete JEDEN Eintrag - 100 MB Markup.
     (C) Der "Max"-Knopf des Kredit-Shops hatte gar keine Obergrenze.

   Gemessen im Browser, vorher (origin/main) gegen nachher - Aufbau bis zur ersten Karte:
        50 Module:      62 ms /  0,25 MB  ->    60 ms / 0,25 MB
     4.000 Module:  30.628 ms / 20,1  MB  ->   158 ms / 0,60 MB   (das Fixture dieses Tests)
     5.000 Module:  30.343 ms / 24,6  MB  ->   109 ms / 0,60 MB
    20.000 Module: 485.186 ms /  100  MB  ->   206 ms / 0,62 MB

   Haerter noch als der Aufbau ist der laengste EINZELNE Long Task - die Zeit, in der der
   Browser auf nichts mehr reagiert: bei 4.000 Modulen 15.186 ms gegen 90 ms.               */
const path = require('path');
const B = path.join(__dirname, 'lib');
const { SPIEL_URL, SPIELDATEI, starteBrowser, pruefer } = require(B + '/umgebung');
const fs = require('fs');
const JS = fs.readFileSync(SPIELDATEI, 'utf8');
const { check, ende } = pruefer();
const SAVE_KEY = 'kepler7-save-v3';

// Patchnotes sind unveraenderliche Historie und koennen jeden gesuchten Ausdruck zitieren -
// verneinende Pruefungen und Zaehler schneiden sie deshalb heraus (Hausregel 46).
const PN_VON = JS.indexOf('  const PATCHNOTES = [');
const PN_BIS = PN_VON < 0 ? -1 : JS.indexOf('\n  ];', PN_VON);
const ohnePatchnotes = i => !(PN_VON >= 0 && PN_BIS > PN_VON && i >= PN_VON && i <= PN_BIS);

function backend(store){
  return async r => {
    const req = r.request(), p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData() || '{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    if (p === 'notifications') return j({ notifications: [] });
    if (p === 'reports') return req.method() === 'POST' ? j({ ok:true }) : j({ reports: [] });
    if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p))
      return j(p.includes('pending') ? { reward:null } : []);
    return j({});
  };
}

/* Die Modultypen und Substat-Effekte kommen AUS DER DATEI, nicht aus dem Gedaechtnis
   (Hausregel 4). Ein erfundener Typ faellt in moduleInstanceInfo durch, und der Test
   maesse dann eine leere Liste statt des Deckels. */
function typenAusDatei(){
  const v = JS.indexOf('const MODULE_DEFS = [');
  const b = JS.indexOf('const SHIP_MODULE_DEFS', v);
  return [...JS.slice(v, b).matchAll(/\{ ?key:'([a-z0-9_]+)'/g)].map(m => m[1]);
}
function effekteAusDatei(){
  const m = JS.match(/const MODULE_SUB_EFFECT_LABEL = \{[^}]*\}/);
  return m ? [...m[0].matchAll(/(\w+):/g)].map(x => x[1]).filter(x => x !== 'MODULE_SUB_EFFECT_LABEL') : [];
}
function rangAusDatei(){
  const v = JS.indexOf('const MODULE_RARITY = {');
  const b = JS.indexOf('};', v);
  return [...JS.slice(v, b).matchAll(/^\s{4}(\w+):\s*\{/gm)].map(m => m[1]);
}

(async () => {
  // ================= 1) Quelltext: die drei Teile sind verdrahtet =================
  const deckelM = JS.match(/const MODUL_INVENTAR_MAX_KARTEN = (\d+);/);
  const kaufM   = JS.match(/const MODUL_INVENTAR_KAUF_DECKEL = (\d+);/);
  check('1-vorab: beide Deckel-Konstanten stehen in der Datei', !!deckelM && !!kaufM,
    { karten: deckelM && deckelM[1], kauf: kaufM && kaufM[1] });
  if (!deckelM || !kaufM) return ende();
  const MAX_KARTEN = Number(deckelM[1]), KAUF_DECKEL = Number(kaufM[1]);

  /* ABSOLUTE Schranken - und sie sind der Grund, warum dieser Test etwas belegt.
     Alle Pruefungen darunter vergleichen die gemessene Zahl gegen die Konstante AUS DER DATEI.
     Wer den Deckel auf 999999 setzt, haelt sie damit weiterhin ein, und der ganze Test waere
     trivial gruen: eine Erwartung, die aus derselben Groesse stammt wie der Messgegenstand,
     kann nicht fehlschlagen (Hausregel 62). Genau so ist die Gegenprobe "kartendeckel_weg"
     zuerst durchgerutscht.
     Die Werte sind gemessen, nicht gegriffen: Bei 5.000 gezeichneten Eintraegen stand der
     Aufbau bei 30 Sekunden und 25 MB Markup, bei 120 bei 0,06 Sekunden und 0,6 MB. 500 ist die
     Obergrenze des Vertretbaren, 20 die Untergrenze, unter der ein ganz normales Inventar
     abgeschnitten wuerde. Fuer den Kaufdeckel gilt dasselbe: 3.000 sind gemessen 159 kB
     Spielstand, 20.000 sind 980 kB - und der Spielstand reist bei JEDEM Speichern zum Server. */
  check('1-vorab2: der Karten-Deckel liegt im gemessen vertretbaren Bereich',
    MAX_KARTEN >= 20 && MAX_KARTEN <= 500, { deckel: MAX_KARTEN, erlaubt: '20..500' });
  check('1-vorab3: der Kauf-Deckel liegt im gemessen vertretbaren Bereich',
    KAUF_DECKEL >= 200 && KAUF_DECKEL <= 5000, { deckel: KAUF_DECKEL, erlaubt: '200..5000' });

  // 1a: der Zaehler-Index existiert genau einmal und BEIDE Renderschleifen bauen ihn.
  const idxDefs = (JS.match(/function fuseIndexBauen\(/g) || []).length;
  check('1a: fuseIndexBauen ist genau EINMAL definiert', idxDefs === 1, idxDefs);
  check('1a2: beide Modul-Inventare bauen den Index',
    JS.includes('fuseIndexBauen(state.modules, false)') && JS.includes('fuseIndexBauen(state.shipModules, true)'));

  /* 1b: KEINE Karte darf fuseAnzahl ohne Index rufen. Datengetrieben ueber alle Aufrufe
     (Hausregel 40) - eine dritte Inventarliste faellt damit auf, ohne dass jemand an sie
     gedacht haben muss. Der Einzelaufruf in fuseModules ist die benannte Ausnahme: er laeuft
     genau einmal je Klick und braucht keinen Index. */
  const rufe = [...JS.matchAll(/fuseAnzahl\((state\.\w+|inv), ([^)]*)\)/g)]
    .filter(m => ohnePatchnotes(m.index))
    .map(m => ({ text: m[0], mitIndex: m[2].split(',').length >= 2 }));
  const ohneIndex = rufe.filter(r => !r.mitIndex).map(r => r.text);
  check('1b-vorab: es gibt ueberhaupt fuseAnzahl-Aufrufe', rufe.length >= 3, rufe.length);
  check('1b: jeder Aufruf in einer Kartenliste traegt den Index',
    ohneIndex.length === 1 && ohneIndex[0].startsWith('fuseAnzahl(inv,'),
    { ohneIndex, hinweis: 'erlaubt ist genau der Einzelaufruf in fuseModules (inv, instKey)' });

  // 1c: der Zuschnitt ist die EINE Sortier- und Deckelstelle.
  const zufe = (JS.match(/modulInventarZuschnitt\(invKeys\)/g) || []).length;
  check('1c: beide Inventare gehen durch modulInventarZuschnitt', zufe === 2, zufe);
  const hinweisRufe = (JS.match(/modulInventarDeckelHinweis\(zuschnittS?\)/g) || []).length;
  check('1c2: beide zeichnen auch den Hinweis auf die versteckten Eintraege', hinweisRufe === 2, hinweisRufe);

  // ============ 2) Ausgefuehrt: Index und Zuschnitt rechnen dasselbe wie vorher ============
  const schneide = (kopf) => {
    const v = JS.indexOf(kopf);
    if (v < 0) return null;
    const b = JS.indexOf('\n  }', v);
    return b > v ? JS.slice(v, b + 4) : null;
  };
  let sandbox = null, bauFehler = null;
  try {
    const teile = [
      'const MODULE_RARITY = {' + rangAusDatei().map(k => k + ':{}').join(',') + '};',
      // Hausregel 36: JEDE Abhaengigkeit einer geschnittenen Funktion wird ebenfalls aus der
      // Datei geschnitten. moduleLevelOf klemmt an MODULE_LEVEL_MAX - ohne die Konstante starb
      // der erste Anlauf mit einem ReferenceError, und zwar erst beim AUFRUF, also ausserhalb
      // des Bau-try/catch (Hausregel 34, zweite Haelfte - deshalb steht unten ein zweites).
      JS.match(/const MODULE_LEVEL_MAX = \d+;/)[0],
      JS.match(/function moduleLevelOf\(instKey\)\{[^\n]*/)[0],
      schneide('function fuseGeschwister(inv, instKey){'),
      schneide('function fuseGruppeVon(instKey){'),
      schneide('function fuseIndexBauen(inv, isShip){'),
      schneide('function fuseAnzahl(inv, instKey, idx){'),
      schneide('function rarRang(rarity){'),
      schneide('function moduleInvVergleich(a, b){'),
      schneide('function modulInventarZuschnitt(keys){'),
      'const MODUL_INVENTAR_MAX_KARTEN = ' + MAX_KARTEN + ';',
      'let _rarRangCache = null;',
      JS.match(/const MODULE_WERT_MIN = \d+, MODULE_WERT_MAX = \d+;/)[0],
      schneide('function moduleWertOf(instKey){'),
      'const state = { modules:{}, shipModules:{}, moduleLocks:[] };',
      'function modulGesperrt(){ return false; }',
      'return { fuseAnzahl, fuseIndexBauen, modulInventarZuschnitt, moduleInvVergleich, state };'
    ];
    if (teile.some(t => !t)) throw new Error('ein Block liess sich nicht schneiden');
    sandbox = new Function(teile.join('\n'))();
  } catch (e) { bauFehler = String(e.message || e); }
  // Hausregel 34: der Aufbau ist eine eigene, benannte Pruefung - sonst stirbt der Test
  // mitten drin und die uebrigen Pruefungen laufen nie.
  check('2-bau: die Helfer lassen sich schneiden und ausfuehren', !!sandbox, bauFehler);
  if (!sandbox) return ende();

  // Fixture fuer die Rechen-Pruefungen: viele Schluessel derselben Gruppe plus Streuung.
  const TYPEN = typenAusDatei(), EFF = effekteAusDatei(), RANG = rangAusDatei().slice(0, 5);
  const inv = {};
  let lauf = 1;
  const naechste = m => (lauf = (lauf * 48271) % 2147483647) % m;    // deterministisch, kein Date/Random
  for (let i = 0; i < 4000; i++){
    const t = TYPEN[naechste(TYPEN.length)], r = RANG[naechste(RANG.length)];
    const a = EFF[naechste(EFF.length)], b = EFF[naechste(EFF.length)];
    inv[t + ':' + r + ':1:' + a + (10 + naechste(16)) + '.' + b + (10 + naechste(16)) + '.w' + (90 + naechste(21))] = 1;
  }
  sandbox.state.modules = inv;
  const keys = Object.keys(inv);
  // Absolut gemessen, nicht gegen den Deckel: Sonst haenge die Aussagekraft dieses Fixtures an
  // genau der Zahl, die hier geprueft werden soll.
  check('2-vorab: das Fixture hat genug Streuung', keys.length >= 3500, keys.length);

  /* 2a: Der Index liefert EXAKT dieselbe Zahl wie der alte Scan - fuer JEDEN Schluessel.
     Das ist die Korrektheits-Haelfte: Ein schneller Zaehler, der falsch zaehlt, waere
     schlimmer als der langsame (der 3->1-Knopf haenge dann an einer erfundenen Menge). */
  let idx = null, laufFehler = null, abweichungen = [];
  try {
    idx = sandbox.fuseIndexBauen(inv, false);
    for (const k of keys){
      const mit = sandbox.fuseAnzahl(inv, k, idx), ohne = sandbox.fuseAnzahl(inv, k);
      if (mit !== ohne) abweichungen.push({ k, mit, ohne });
      if (abweichungen.length > 3) break;
    }
  } catch (e) { laufFehler = String(e.message || e); }
  /* Hausregel 34, zweite Haelfte: Der BAU einer Sandbox kann gelingen und ihr AUFRUF trotzdem
     werfen - eine fehlende Konstante faellt erst zur Laufzeit auf. Genau so ist der erste Anlauf
     dieses Tests gestorben, mitten drin, und die uebrigen Pruefungen liefen nie. */
  check('2a-lauf: die Helfer laufen auch durch (nicht nur bauen)', !laufFehler, laufFehler);
  if (laufFehler) return ende();
  check('2a: der Index zaehlt fuer JEDEN Schluessel dasselbe wie der alte Scan',
    abweichungen.length === 0, abweichungen);

  /* 2b/2c: Der Zuschnitt sortiert bei grossen Bestaenden FACHWEISE. Das ist der Kern der
     Beschleunigung - und es darf die Reihenfolge nicht veraendern. Geprueft wird das als PAAR
     gegen das volle Sortieren; jede Haelfte allein waere auch von einer kaputten Fassung
     erfuellbar (eine leere Liste ist "gedeckelt", eine ungedeckelte ist "gleich sortiert"). */
  const z = sandbox.modulInventarZuschnitt(keys.slice());
  check('2b: die Liste ist auf den Deckel gekuerzt und der Rest wird BEZIFFERT',
    z.sichtbar.length === MAX_KARTEN && z.gesamt === keys.length
    && z.versteckt === keys.length - MAX_KARTEN,
    { sichtbar: z.sichtbar.length, versteckt: z.versteckt, gesamt: z.gesamt });
  const vollSortiert = keys.slice().sort(sandbox.moduleInvVergleich).slice(0, MAX_KARTEN);
  const gleich = z.sichtbar.length === vollSortiert.length && z.sichtbar.every((k, i) => k === vollSortiert[i]);
  check('2c: fachweise sortiert ist ZEICHENGLEICH mit vollstaendig sortiert', gleich,
    gleich ? null : { fachweise: z.sichtbar.slice(0, 5), voll: vollSortiert.slice(0, 5) });

  // Gegenrichtung: unter dem Deckel wird nichts versteckt und trotzdem sortiert.
  const klein = keys.slice(0, 20);
  const zk = sandbox.modulInventarZuschnitt(klein.slice());
  const kleinVoll = klein.slice().sort(sandbox.moduleInvVergleich);
  check('2d: unter dem Deckel bleibt alles sichtbar - und ist trotzdem sortiert',
    zk.versteckt === 0 && zk.sichtbar.length === 20
    && zk.sichtbar.every((k, i) => k === kleinVoll[i]), { versteckt: zk.versteckt });

  // ==================== 3) Gemessen im Spiel ====================
  /* fmt() kommt AUS DER DATEI (Hausregel 36): Der Hinweistext laesst seine Zahlen durch fmt
     laufen, und fmt rundet ("3.9k"). Wer im Test String(3880) erwartet, prueft eine
     SCHREIBWEISE statt der Regel und faellt auf korrektem Code durch - genau so beim ersten
     Anlauf passiert. Die Rundung ist hier auch richtig: Der Hinweis nennt eine
     Groessenordnung, keine Freischaltschwelle. */
  let fmtSpiel = null;
  try {
    const fv = JS.indexOf('function fmt(n){');
    const fb = fv < 0 ? -1 : JS.indexOf('\n  }', fv);
    if (fv > 0 && fb > fv) fmtSpiel = new Function(JS.slice(fv, fb + 4) + '\nreturn fmt;')();
  } catch (e) {}
  check('3-vorab2: fmt liess sich aus der Spieldatei schneiden', typeof fmtSpiel === 'function');
  if (typeof fmtSpiel !== 'function') return ende();

  const browser = await starteBrowser();
  try {
    // --- Ausgangsstand holen
    const ctx0 = await browser.newContext();
    const p0 = await ctx0.newPage();
    const s0 = {};
    await p0.route('**/api/**', backend(s0));
    await p0.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
    await p0.goto(SPIEL_URL);
    await p0.waitForTimeout(3500);
    const basis = JSON.parse(s0[SAVE_KEY] || '{}');
    await ctx0.close();
    check('3-vorab: ein Ausgangs-Spielstand liess sich holen', !!basis.resources);
    if (!basis.resources) return ende();

    // Ein Lauf mit frei waehlbarem Modul-Bestand. Gemessen wird IMMER aus dem Mock-Store, nie aus
    // localStorage: Der Spielstand liegt beim Backend-Mock, und der erste Anlauf las deshalb 0
    // Eintraege (Hausregel 65 - ein Messwerkzeug, das an der falschen Quelle horcht).
    async function lauf(anzahl, mengenKnopf){
      const stand = JSON.parse(JSON.stringify(basis));
      const fern = Date.now() + 365 * 24 * 3600 * 1000;
      for (const k of ['nextPlanetEventCheck','lastEventTime','nextTraderCheck','nextRaidTime','nextFactionGift'])
        if (stand[k] !== undefined) stand[k] = fern;
      stand.activeEvent = null; stand.buffs = [];
      stand.seenTabHints = ['basis','forschung','bau','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil'];
      const teil = {};
      Object.keys(inv).slice(0, anzahl).forEach(k => { teil[k] = 1; });
      stand.modules = teil;
      stand.credits = 500000000;                       // der gemeldete Fall: sehr viele Kredite

      const ctx = await browser.newContext({ viewport: { width: 1200, height: 1400 } });
      const page = await ctx.newPage();
      const fehler = [];
      page.on('pageerror', e => fehler.push(String(e.message || e)));
      const store = {}; store[SAVE_KEY] = JSON.stringify(stand);
      await page.route('**/api/**', backend(store));
      await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
      /* Der Mitschnitt haengt per addInitScript, laeuft also VOR dem ersten Tick und sammelt
         lueckenlos. Ausgewertet werden die RECORDS, nicht der aktuelle Text: log() schreibt
         mehrere Zeilen im SELBEN synchronen Block (ein Kauf loest eine Erfolgs-Salve aus), und
         der Callback laeuft erst als Microtask danach - wer dort den Endstand liest, sieht nur
         die letzte Zeile der Salve. Genau daran ist der erste Anlauf gescheitert: Die
         Kuerzungs-Meldung war von "Erfolg freigeschaltet: Perfekter Wurf" ueberschrieben.
         (CLAUDE.md, Abschnitt zum MutationObserver-Mitschnitt.) */
      await page.addInitScript(() => {
        window.__logMitschnitt = [];
        const start = () => {
          if (!document.body) return false;
          new MutationObserver(recs => {
            const el = document.getElementById('log');
            if (!el) return;
            for (const r of recs){
              if (r.target !== el && !el.contains(r.target)) continue;
              for (const n of r.addedNodes){
                const t = (n.textContent || '').trim();
                if (t && window.__logMitschnitt[window.__logMitschnitt.length - 1] !== t) window.__logMitschnitt.push(t);
              }
            }
          }).observe(document.body, { childList:true, characterData:true, subtree:true });
          return true;
        };
        if (!start()) document.addEventListener('DOMContentLoaded', start);
      });
      await page.goto(SPIEL_URL);
      await page.waitForTimeout(3500);
      await page.evaluate(() => { for (const id of ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay']){ const e = document.getElementById(id); if (e) e.remove(); } });

      // Modul-Reiter: Zeit bis zur ersten Karte + Kartenzahl + Hinweis
      const t0 = Date.now();
      await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="offiziere"]'); if (b) b.click(); });
      let karten = 0;
      for (let i = 0; i < 60; i++){
        karten = await page.evaluate(() => document.querySelectorAll('[data-equip-module]').length).catch(() => 0);
        if (karten > 0) break;
        await page.waitForTimeout(500);
      }
      const dauer = Date.now() - t0;
      const hinweis = await page.evaluate(() => {
        const b = document.getElementById('moduleBox');
        if (!b) return null;
        return [...b.querySelectorAll('.lb-note')].map(e => e.textContent.trim())
          .find(t => /nicht gezeichnet|weitere sind vorhanden/.test(t)) || null;
      });

      // Markt-Reiter: Max-Knopf lesen, dann ueber den SPIELERWEG kaufen
      await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="markt"]'); if (b) b.click(); });
      await page.waitForTimeout(1200);
      const maxKnopf = await page.evaluate(() => {
        const b = document.querySelector('[data-shop-buy="blaupause"]');
        if (!b) return null;
        const karte = b.closest('.card-row');
        const mx = karte && karte.querySelector('[data-shop-qty="blaupause"][data-shop-qty-n="max"]');
        return mx ? mx.textContent.trim() : null;
      });
      /* Gemessen wird der MITSCHNITT von #log, nicht der Endstand und nicht "irgendein neuer
         Knoten": #log hat keinen Stapel und ueberschreibt sich mit jeder Meldung selbst
         (Nachtrag zu Hausregel 47). Der erste Anlauf sammelte jeden addedNode im body - und
         fing damit die neu gezeichneten Shop-KARTEN ein statt der Meldung. Beobachtet wird
         document.body und #log je Mutation frisch per id gelesen, weil der Boot den Container
         einmal ersetzt. */
      const meldungen = await page.evaluate(async (knopf) => {
        const ab = (window.__logMitschnitt || []).length;      // nur die Zeilen AB dem Kauf
        const mx = document.querySelector('[data-shop-qty="blaupause"][data-shop-qty-n="' + knopf + '"]');
        if (mx) mx.click();
        await new Promise(r => setTimeout(r, 400));
        const kauf = document.querySelector('[data-shop-buy="blaupause"]');
        if (kauf) kauf.click();
        await new Promise(r => setTimeout(r, 1200));
        return (window.__logMitschnitt || []).slice(ab);
      }, mengenKnopf);
      await page.waitForTimeout(600);
      let nachher = -1;
      try { nachher = Object.keys(JSON.parse(store[SAVE_KEY] || '{}').modules || {}).length; } catch(e){}
      await ctx.close();
      return { karten, dauer, hinweis, maxKnopf, meldungen, nachher, fehler, vorher: Object.keys(teil).length };
    }

    /* ===== Lauf A: WEIT ueber dem Kaufdeckel - der gemeldete Fall =====
       4.000 Eintraege, 500 Mio Kredite. Am ausgelieferten Stand (origin/main) brauchte GENAU
       dieses Fixture gemessene 30,6 Sekunden bis zur ersten Karte, mit einer einzelnen
       Blockade von 15,2 Sekunden mittendrin; heute sind es 0,16 Sekunden.
       Die 12-Sekunden-Schranke unten ist eine BEDIENBARKEITS-Aussage, kein Feintuning
       (Hausregel 62) - sie liegt weit von beiden Messwerten weg und wettet nicht auf
       Wanduhr-Glueck. Hier stand zuerst "rund 19 Sekunden": eine HOCHRECHNUNG aus der
       5.000er-Messung, die nachgemessen um die Haelfte danebenlag. Eine Zahl in einem
       Kommentar ist ein Versprechen wie eine im Patchnote (Hausregel 11). */
    const A = await lauf(4000, 'max');
    check('3a: der Modul-Reiter zeichnet binnen 12 Sekunden', A.karten > 0 && A.dauer < 12000,
      { karten: A.karten, dauer: A.dauer });
    check('3b: hoechstens MODUL_INVENTAR_MAX_KARTEN Karten gezeichnet', A.karten <= MAX_KARTEN,
      { karten: A.karten, deckel: MAX_KARTEN });
    check('3b2: und zwar absolut gemessen, nicht nur "was die Konstante gerade erlaubt"',
      A.karten <= 500, { karten: A.karten, absoluteSchranke: 500, fixture: A.vorher });
    check('3c-vorab: unter der Liste steht ein Hinweis auf die versteckten Eintraege', !!A.hinweis, A.hinweis);
    check('3c: der Hinweis nennt BEIDE Zahlen (in der Schreibweise des Spiels) und den Weg heraus',
      !!A.hinweis && A.hinweis.includes(String(MAX_KARTEN))
      && A.hinweis.includes(String(fmtSpiel(A.vorher - MAX_KARTEN)))
      && /verschrotten/i.test(A.hinweis),
      { hinweis: A.hinweis, erwartetSichtbar: MAX_KARTEN, erwartetVersteckt: fmtSpiel(A.vorher - MAX_KARTEN) });
    check('3d-vorab: die Modul-Blaupause hat einen Max-Knopf', !!A.maxKnopf, A.maxKnopf);
    check('3d: ueber dem Deckel wird der Kauf ABGELEHNT und der Bestand waechst nicht',
      A.nachher === A.vorher, { vorher: A.vorher, nachher: A.nachher });
    check('3d2: und die Ablehnung nennt den GRUND, nicht nur ein Nein',
      A.meldungen.some(t => /Inventar/i.test(t) && /voll|Grenze/i.test(t)),
      { meldungen: A.meldungen.slice(0, 2) });
    check('3f: keine Seitenfehler (Lauf A)', A.fehler.length === 0, A.fehler.slice(0, 3));

    /* ===== Lauf B: die GEGENRICHTUNG, und sie ist der eigentliche Beleg =====
       Ein Deckel, der IMMER ablehnt, waere von Lauf A allein vollstaendig erfuellt. Hier ist
       noch Platz - also MUSS gekauft werden, und zwar exakt bis an den Deckel: nicht mehr
       (sonst greift er nicht) und nicht weniger (sonst waere er eine verkappte Sperre).
       Die Bezugsgroesse kommt von aussen: 500 Mio Kredite reichen fuer 50.000 Blaupausen,
       der freie Platz ist 40 - ein Fehler kann beide Seiten nicht gemeinsam verschieben
       (Hausregel 62). */
    /* Gewaehlt wird bewusst der feste x10-Knopf bei nur 5 freien Plaetzen. Ueber "Max" waere
       der Kuerzungspfad gar nicht erreichbar - der Knopf deckelt ja bereits richtig, und
       `qty > platz` waere dann nie wahr. Genau daran ist der erste Entwurf gescheitert: Er
       maass eine Kuerzung, die es im gewaehlten Weg gar nicht geben konnte (Hausregel 67 -
       ein unerreichbarer Pfad ist kein Testproblem, sondern eine Aussage ueber das Bauwerk).
       Der Spieler erreicht ihn ueber einen festen Mengenknopf oder einen veralteten Wert. */
    const B = await lauf(KAUF_DECKEL - 5, '10');
    check('3g-vorab: Lauf B startet wirklich knapp unter dem Deckel',
      B.vorher === KAUF_DECKEL - 5, { vorher: B.vorher, deckel: KAUF_DECKEL });
    const imKnopfB = B.maxKnopf ? Number((B.maxKnopf.match(/[\d.]+/g) || ['0']).pop().replace(/\./g, '')) : -1;
    check('3g: der Max-Knopf nennt den freien Platz, nicht die bezahlbare Menge',
      imKnopfB === 5, { imKnopf: imKnopfB, freierPlatz: 5, bezahlbar: Math.floor(500000000 / 10000) });
    check('3h: der x10-Kauf wird auf den freien Platz GEKUERZT statt abgelehnt',
      B.nachher === KAUF_DECKEL, { vorher: B.vorher, nachher: B.nachher, deckel: KAUF_DECKEL,
        hinweis: 'gewaehlt waren 10, frei waren 5' });
    /* Der Beleg zeigt die TREFFENDE Zeile, nicht die letzten beiden des Mitschnitts: Ein Kauf
       loest eine Erfolgs-Salve aus, und `slice(-2)` zeigte deshalb zweimal "Erfolg
       freigeschaltet" - eine gruene Pruefung mit einem Beleg, der etwas anderes behauptet
       (Hausregel 37). Bei einem Fehlschlag steht jetzt der ganze Mitschnitt da. */
    const kuerzZeile = B.meldungen.find(t => /gekürzt/i.test(t) && /Inventar/i.test(t));
    check('3h2: und die Meldung sagt, DASS gekuerzt wurde - statt still zu kuerzen',
      !!kuerzZeile, kuerzZeile ? { zeile: kuerzZeile } : { mitschnitt: B.meldungen });
    check('3f2: keine Seitenfehler (Lauf B)', B.fehler.length === 0, B.fehler.slice(0, 3));
  } finally {
    await browser.close();
  }
  ende();
})();
