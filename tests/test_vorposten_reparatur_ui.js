// Die Kern-Reparatur am Vorposten im Spiel (VP-R, Frontend-Haelfte, 14.09.2026).
//
// DER ANLASS IST WIEDER DIE LUECKE SELBST - dieselbe Fehlerklasse wie bei V4: Der Server bot
// POST /api/vorposten/reparieren seit dem 14.09.2026 an (Commit ab67960), und KEINE Stelle im
// Spiel rief ihn. Gemessen vor dieser Aenderung: `grep -c 'vorposten/reparieren'
// weltraum_kolonie.html` = 0, und tests/test_vorposten_paritaet.js fiel in 1b mit
// fehltImFrontend: ["/reparieren"]. Beide Seiten waren fuer sich stimmig; nur die Verbindung
// fehlte. Abschnitt 0 misst deshalb die VERBINDUNG, nicht die Enden.
//
// DIE ZWEITE ZUSAGE, UND DIE WICHTIGERE: Das Spiel rechnet hier NICHTS nach. Die Route nimmt nur
// `system` - der Betrag kommt nicht aus dem Request, sondern wird auf dem Server aus dem
// gemessenen Lagerstand abgeleitet, aus derselben Funktion, aus der auch die Vorschau in
// GET /api/vorposten stammt. Waere im Spiel eine Kostentabelle oder eine Heilrate, gaebe es zwei
// Wahrheiten, die beim naechsten Balance-Pass auseinanderlaufen. 5a und 5b bewachen das.
//
// GEPRUEFT:
//   0a      Es gibt GENAU EINE Stelle, die den Reparatur-Endpunkt ruft.
//   0-anker Die Funktion ist lesbar (sonst messen 0b-0e nichts).
//   0b      Sie bucht nichts selbst - die Rohstoffe liegen im Stationslager, nicht beim Spieler.
//   0c      Der Netzfehler wird gefangen (backendFetch faengt nichts ab).
//   0d      Sie laedt die Vorposten danach neu.
//   0e      Sie ruft KEIN claimPendingRewards - die Reparatur legt keine Belohnung an, sie heilt
//           sofort am Ziel. Ein Claim hier waere ein Zweig ins Leere.
//   1a      Das Spiel liest wirklich `reparaturAktiv` (Katalog) UND `.reparatur` (je Station).
//   2a/2b/2c  Der Menue-Eintrag steht am eigenen Vorposten, fehlt bei ausgeschaltetem Schalter
//           und fehlt am fremden.
//   3a/3b/3c  Die drei Ablehnungsgruende in der Reihenfolge des Servers: unversehrt, gesperrt
//           (mit Restzeit AUS gesperrtBis), Lager leer.
//   4a/4b   Die Info-Zeile in der Stationstafel nennt Heilung UND Kosten, und steht am fremden
//           Vorposten nicht.
//   5a      Der Request traegt genau {system} - gemessen am abgefangenen Request.
//   5b      Die Kostenzahl ist NICHT aus der Heilung abgeleitet.
//   6a      Nach dem Klick wird GET /api/vorposten erneut gerufen.
//
// GEGENPROBEN (Spieldatei per KEPLER_SPIELDATEI auf eine sabotierte Kopie umlenken). Die Liste ist
// GEMESSEN am 14.09.2026 gegen DIESE Fassung des Tests - Exit 1 allein genuegt nicht, es muessen
// GENAU diese Pruefungen fallen. Alle siebzehn Staende tragen dieselben 30 Pruefnamen wie der
// gruene Lauf (per diff verglichen, nicht gezaehlt).
//
//   Stand             sabotiert                                      es fallen
//   sabZweiterRuf     eine zweite Kopie des Aufrufs                  0a
//   sabName           Funktion umbenannt                             0-anker, 0c, 0d
//   sabBucht          pay(daten.verbraucht) eingesetzt               0b
//   sabOhneCatch      .catch(() => null) entfernt                    0c
//   sabOhneLaden      Neuladen im ERFOLGSpfad entfernt               0d, 6a
//   sabOhneNachladen  Neuladen im ABLEHNUNGSpfad entfernt            0d, 6d
//   sabClaim          claimPendingRewards() eingesetzt               0e
//   sabOhneSchalter   der reparaturAktiv-Riegel entfernt             2b
//   sabFremd          derselbe Eintrag auch im fremden Zweig         2c
//   sabGrundTausch    Grund-Kette umsortiert                         3a
//   sabDritterZweig   der dritte Grund-Zweig geloescht               3c
//   sabFesteZeit      Sperre wieder aus dem Schnappschuss            3d
//   sabOhneKosten     kosten aus der Info-Zeile entfernt             4a
//   sabZeileFremd     v.eigener aus der Zeilenbedingung raus         4b
//   sabZweitesFeld    zweites Feld im Body                           5a
//   sabAusHeilung     Kosten aus heilung abgeleitet                  2a2, 5b
//   sabTextAusbau     der Zusatz in der Ausbau-Rueckfrage entfernt   1b
//
// DREI STAENDE GAB ES IN DER ERSTEN FASSUNG NICHT - sie sind das Ergebnis der adversarischen
// Durchsicht, und jeder deckt eine Pruefung auf, die vorher aus dem falschen Grund gruen war:
//   * sabDritterZweig: 3c suchte die Silbe „Lager" - die steht auch im Erfolgsgrund. Faellt der
//     dritte Zweig ersatzlos weg, greift der Erfolgszweig, und die Pruefung waere gruen geblieben.
//   * sabFesteZeit: 3d gab es gar nicht. Die Sperre kam aus dem Server-Schnappschuss, und der ist
//     bis zu zwei Minuten alt, waehrend die Sperre vier Stunden dauert.
//   * sabOhneLaden: 0d verlangte EIN Vorkommen von ladeVorposten() - und seit auch der
//     Ablehnungspfad neu laedt, war das schon durch ihn erfuellt. Jetzt sind es zwei.
//
// ZWEI EHRLICHE EINSCHRAENKUNGEN, beide gemessen:
//   * sabName laesst 0b und 0e NICHT fallen. Beide sind VERNEINUNGEN ("bucht nichts", "ruft
//     keinen Claim"), und an einem leeren Rumpf sind Verneinungen wahr. Genau dafuer gibt es
//     0-anker: Er faellt zuerst und sagt, dass die beiden nichts mehr messen.
//   * sabGrundTausch laesst nur 3a fallen, nicht auch 3c. Die vertauschte Kette liefert fuer den
//     Fall „leeres Lager" zufaellig denselben Text - die Reihenfolge ist an ihrem ERSTEN Glied
//     bewacht, den dritten Zweig bewacht stattdessen sabDritterZweig.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = src.match(/<script>([\s\S]*)<\/script>/)[1];
const ICH = 'u-ich';
const SYS = 'vega';

check('0a: es gibt GENAU EINE Stelle, die den Reparatur-Endpunkt ruft',
  (JS.match(/'\/vorposten\/reparieren'/g) || []).length === 1,
  { treffer: (JS.match(/'\/vorposten\/reparieren'/g) || []).length });
{
  const von = JS.indexOf('async function vorpostenReparieren(');
  const rumpf = von < 0 ? '' : JS.slice(von, JS.indexOf('\n  }', von));
  check('0-anker: die Reparaturfunktion ist lesbar (sonst messen 0b-0e nichts)',
    von > 0 && /vorposten\/reparieren/.test(rumpf), { laenge: rumpf.length });
  /* 0b: Die Rohstoffe liegen im STATIONSLAGER, nicht beim Spieler. Wer hier `pay()` riefe oder
     `state.resources` anfasste, zoege dem Spieler ein zweites Mal etwas ab - und zwar aus einem
     ganz anderen Topf als dem, den der Server geleert hat. Im Spiel saehe das zunaechst richtig
     aus, weil die Zahlen plausibel faellen. */
  check('0b: die Reparaturfunktion bucht NICHTS selbst',
    !/state\.resources/.test(rumpf) && !/gainResources\(/.test(rumpf) && !/\bpay\(/.test(rumpf), {});
  check('0c: der Netzfehler wird gefangen - wie an jeder anderen Vorposten-Aktion',
    /backendFetch\('\/vorposten\/reparieren'[^\n]*\.catch\(/.test(rumpf) || /try\s*\{/.test(rumpf),
    { auszug: (rumpf.match(/backendFetch\([^\n]{0,44}/) || [])[0] });
  /* ZWEIMAL, nicht einmal (gemessen 14.09.2026): Seit auch der Ablehnungspfad neu laedt, war eine
     Pruefung auf EIN Vorkommen schon durch ihn erfuellt - der Stand ohne das Neuladen im
     Erfolgspfad blieb bei 0d gruen und fiel nur noch ueber 6a. Beide Wege brauchen es: der
     Erfolgspfad, weil der Kern geheilt ist, und der Ablehnungspfad, weil drei der acht
     Ablehnungen „dein Zwischenspeicher ist alt" heissen. */
  check('0d: sie laedt die Vorposten neu - auf BEIDEN Wegen, Erfolg wie Ablehnung',
    (rumpf.match(/ladeVorposten\(\)/g) || []).length >= 2,
    { treffer: (rumpf.match(/ladeVorposten\(\)/g) || []).length });
  /* 0e: Die Route legt KEINE Belohnung an (kein pushPendingReward, kein eigener type) - sie heilt
     synchron am Ziel. Ein claimPendingRewards() hier waere ein Zweig ins Leere und liesse kuenftig
     jemanden glauben, es gaebe eine Warteschlange, die es nicht gibt. Der Unterschied zur
     Abholung darueber, die den Claim BRAUCHT, ist genau der Punkt. */
  check('0e: sie ruft KEIN claimPendingRewards - die Reparatur legt keine Belohnung an',
    !/claimPendingRewards\(/.test(rumpf), {});
}
/* 1a ist der Waechter, den es fuer die Abholung nicht gab: Beide Felder sind die Schnittstelle
   zum Server. Verschwindet eines - etwa durch einen Tippfehler beim naechsten Umbau -, faellt der
   Knopf still aus, ohne dass eine Browser-Pruefung das zwingend bemerkt. */
/* 1b/1c: Die beiden Textstellen, die diese Aenderung mitgezogen hat. „Ein Ausbau heilt nicht"
   steht an ZWEI Orten; wer spaeter einen davon umformuliert, ohne den anderen, erzeugt genau den
   Widerspruch, den die Hausregel verbietet. Und der Hilfe-Absatz ist die einzige Stelle, die
   erklaert, WER reparieren darf. */
check('1b: die Ausbau-Rueckfrage nennt die Reparatur aus dem Stationslager',
  /Ein Ausbau heilt nicht[^']*Reparatur aus dem Stationslager/.test(JS), {});
check('1c: der Vorposten-Hilfetext nennt das Reparieren UND wer es darf',
  /reparieren<\/strong> l[^<]*sst sich der Kern/.test(JS) && /nur der <strong>Besitzer<\/strong>/.test(JS), {});
check('1a: das Spiel liest `reparaturAktiv` (Katalog) UND `.reparatur` (je Station)',
  /\breparaturAktiv\b/.test(JS) && /\.reparatur\b/.test(JS),
  { aktiv: /\breparaturAktiv\b/.test(JS), jeStation: /\.reparatur\b/.test(JS) });

const now = Date.now();
const STUFEN = [1,2,3,4,5,6,7,8].map(s => ({ stufe:s, name:'Stufe '+s, kernLp:20000*s, verteidigung:2500*s,
  garnisonMax:300*s, flug:0.06, prod:0.015, scan:1, werft:0, markt:0, lager:1200*s, kosten:{ erz:1000 } }));
/* DIE ZAHLEN SIND ABSICHTLICH UNGLEICH. `heilung` und die Summe von `kosten` duerfen NICHT
   auseinander ableitbar sein - der Server rundet die drei Rohstoffe einzeln, deshalb kann der
   Verbrauch die Heilung um wenige Einheiten uebersteigen (nie zugunsten des Besitzers). Waeren
   hier runde, gleiche Wunschzahlen, koennte 5b nicht zwischen "aus der Antwort gelesen" und
   "nachgerechnet" unterscheiden. */
// Unter 1000, weil fmt() erst darueber kuerzt ("2.7k"): Nur ungekuerzte Zahlen lassen 5b
// zwischen "aus der Antwort gelesen" und "nachgerechnet" unterscheiden.
const ABLEHNUNG = 'Im Lager dieser Station liegt nichts, woraus sich reparieren ließe.';
const HEILUNG = 437;
const KOSTEN = { erz: 281, kristalle: 94, deuterium: 75 };   // Summe 450, absichtlich nicht 437
function rep(over){
  return Object.assign({ aktiv:true, moeglich:true, gesperrt:false, gesperrtBis:0,
    fehlend:9000, heilung:HEILUNG, kosten:KOSTEN, vorrat:12000 }, over || {});
}
function vp(over){
  return Object.assign({ id:'vp1', sys:SYS, besitzer:ICH, besitzerName:'Ich', seit: now-86400000,
    stufe:8, name:'Orbitalfeste', zweig:'handel', zweigName:'Handelsknoten', maxStufe:8,
    kern:{ lp:6000000, lpMax:6500000 }, verteidigung:850000, garnisonAnzahl:0, garnisonMax:14000, garnison:{},
    schutzBis:0, ausbauAb: now-1000, eigener:true, meinLetzterSchlag:0, letzterKampf:null,
    slots:0, module:[], modulBoni:null, projekte:[], projektBoni:null, projektLaeuft:null, projektMoeglich:[],
    naechsteStufe:null, anflug:[],
    nutzen:{ flug:0.30, prod:0.13, scan:5, werft:0, markt:0, flugDeckel:0.5 },
    lager:{ erz:84375, kristalle:28125, deuterium:22500 },
    lagerRate:{ erz:28125, kristalle:9375, deuterium:7500 },
    lagerVollAb: now + 9 * 3600 * 1000,
    reparatur: rep() }, over || {});
}
function spielstand(){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:60, werft:14 }, research:{}, fleet:{ jaeger:80, cruisers:12, spaeher:20, missions: [] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:5000, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}

(async () => {
  const browser = await starteBrowser();
  async function messe(vpDoc, opt){
    opt = opt || {};
    const ctx = await browser.newContext({ viewport:{ width:1280, height:1000 } });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    // Gezaehlt wird der Katalog-Abruf: 6a misst, dass nach dem Klick NEU geladen wird.
    let vorpostenAbrufe = 0;
    let reparaturBody = null, reparaturRufe = 0;
    const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }),
      'kepler7-save-v3': spielstand() };
    await page.route('**/api/**', async r => {
      const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
      const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
      if (p === 'health') return j({ ok:true });
      if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
      if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:[] });
      if (p === 'vorposten/reparieren'){
        reparaturRufe++;
        try { reparaturBody = JSON.parse(req.postData() || '{}'); } catch(e){ reparaturBody = null; }
        if (opt.ablehnen) return j({ error: ABLEHNUNG, leer: true }, 400);
        return j({ ok:true, geheilt: HEILUNG, verbraucht: KOSTEN, vorposten: vpDoc });
      }
      if (p === 'vorposten'){
        vorpostenAbrufe++;
        return j({ ok:true, aktiv:true, bauAktiv:true, maxJeKonto:3, schutzMs:0, abklingMs:14400000,
          ausbauMs:43200000, garnisonFaktor:0.5, stufen:STUFEN,
          zweige:[{ key:'handel', name:'Handelsknoten', kurz:'Verdient.', namen:{8:'Sternenmarkt'}, mult:{} }],
          zweigAb:4, maxStufe:8, modulDefs:[], modulSeltenheiten:{}, modulBaubar:['gewoehnlich'],
          modulAusbauKosten:250, modulBauAbklingMs:0, modulBestand:{}, modulBauAb:0,
          projektDefs: [], projekteAktiv: false, flugDeckel:0.5,
          lagerAktiv:true, lagerStunden:12,
          // Der Schalter steht auf Antwort-Ebene, NICHT im Vorposten-Objekt: er ist ein
          // Katalogfeld. Im Vorposten-Objekt wuerde er den Fingerabdruck von Pruefung 10a des
          // Paritaetstests verletzen.
          reparaturAktiv: opt.reparaturAktiv !== false,
          liste:[vpDoc], eigene: vpDoc.eigener ? 1 : 0 });
      }
      if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
      if (p === 'reports') return j(req.method() === 'POST' ? { ok:true } : { reports:[] });
      if (p === 'players-map') return j({ players:[] });
      if (p === 'pending-rewards/claim') return j({ reward:null });
      if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
      if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]);
        return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
      if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8));
        if (req.method() === 'PUT'){ try { st[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
        return st[k] === undefined ? j({ error:'nix' }, 404) : j({ value: st[k] }); }
      return j({ ok:true });
    });
    /* DIE MELDUNG WIRD MITGESCHNITTEN, nicht am Ende abgelesen: `log()` schreibt per innerHTML und
       ueberschreibt sich selbst, und in einem Idle-Spiel rollt jede Meldung weiter. Wer den
       Endzustand liest, misst „stand am Ende noch da", nicht „ist erschienen". */
    await page.addInitScript(() => {
      localStorage.setItem('kepler7_token', 'tok'); window.confirm = () => true;
      window.__logMit = [];
      document.addEventListener('DOMContentLoaded', () => {
        const l = document.getElementById('log');
        if (!l) return;
        new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes)
          window.__logMit.push((n.textContent || '').replace(/\s+/g, ' ').trim()); }).observe(l, { childList:true, subtree:true });
      });
    });
    await page.goto(SPIEL_URL); await page.waitForTimeout(6000);
    await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
      .forEach(id => { const n = document.getElementById(id); if (n) n.style.display = 'none'; }));
    await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
    await page.waitForTimeout(600);
    await oeffneSystemUeberSektoren(page, SYS);
    await page.waitForTimeout(1000);
    await page.evaluate(() => { const n = document.querySelector('[data-map-vorposten]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true })); });
    // Auf das Menue warten, nicht auf die Uhr. Der Selektor ist `.kmenu` und bleibt es: Ein
    // Rueckfall auf document.body erwischt den <script>-Block und misst den Quelltext statt der
    // Oberflaeche (Lehre aus test_vorposten_lager_ui).
    await page.waitForFunction(() => {
      const m = document.querySelector('.kmenu');
      return m && /Vorposten/.test(m.textContent || '');
    }, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(300);
    const g = await page.evaluate(() => {
      const m = document.querySelector('.kmenu');
      if (!m) return { da:false };
      const knopf = [...m.querySelectorAll('[data-kmenu-i]')].find(b => /Kern reparieren/.test(b.textContent || ''));
      /* Der Grund ist der DIREKTE Nachbar des Knopfes. Ein erster Entwurf suchte per
         `knopf.parentElement.querySelector('.kmenu-grund')` - und traf damit den Grund des ERSTEN
         Eintrags im Menue ("Hoechste Stufe erreicht."), weil alle Eintraege sich denselben
         Elternknoten teilen. Vier Pruefungen waren dadurch rot, ohne dass am Code etwas fehlte. */
      const gElem = knopf && knopf.nextElementSibling && knopf.nextElementSibling.classList.contains('kmenu-grund')
        ? knopf.nextElementSibling : null;
      const grund = gElem ? gElem.textContent : null;
      const info = m.querySelector('.kmenu-info');
      const zeile = info ? info.querySelector('[data-vp-reparatur]') : null;
      return { da:true,
        knopfDa: !!knopf,
        gesperrt: knopf ? knopf.hasAttribute('disabled') : null,
        grund: grund ? grund.replace(/\s+/g, ' ').trim() : null,
        zeileDa: !!zeile,
        zeile: zeile ? (zeile.textContent || '').replace(/\s+/g, ' ').trim() : null,
        zeileHeilung: zeile ? Number(zeile.getAttribute('data-vp-reparatur')) : null };
    });
    let abrufeVorKlick = vorpostenAbrufe;
    if (opt.klicken && g.knopfDa && !g.gesperrt){
      await page.evaluate(() => {
        const m = document.querySelector('.kmenu');
        for (const b of m.querySelectorAll('[data-kmenu-i]'))
          if (/Kern reparieren/.test(b.textContent || '')){ b.click(); return; }
      });
      await page.waitForTimeout(2500);
    }
    const meldungen = await page.evaluate(() => window.__logMit || []);
    await ctx.close();
    return Object.assign(g, { errs, reparaturBody, reparaturRufe, vorpostenAbrufe, abrufeVorKlick, meldungen });
  }

  // ---- 2: der Eintrag selbst
  const a = await messe(vp());
  check('2-anker: das Kartenmenue ist ueberhaupt offen (sonst misst 2a nichts)', a.da === true, {});
  check('2a: der Eintrag „Kern reparieren" steht am eigenen Vorposten und ist nicht gesperrt',
    a.knopfDa === true && a.gesperrt === false, { da:a.knopfDa, gesperrt:a.gesperrt });
  check('2a2: der Grund nennt Heilung UND Kosten aus der Vorschau',
    !!a.grund && a.grund.indexOf(String(HEILUNG)) >= 0 && a.grund.indexOf('281') >= 0, { grund:a.grund });

  const b = await messe(vp(), { reparaturAktiv:false });
  check('2b: bei ausgeschaltetem Schalter steht der Eintrag GAR NICHT da',
    b.da === true && b.knopfDa === false, { knopfDa:b.knopfDa });

  const c = await messe(vp({ eigener:false, besitzer:'u-fremd', besitzerName:'Fremd' }));
  check('2c: am fremden Vorposten steht der Eintrag nicht - nur der Besitzer darf reparieren',
    c.da === true && c.knopfDa === false, { knopfDa:c.knopfDa });

  /* ---- 3: die Gruende, in der Reihenfolge des Servers ------------------------------------------
     Seit dem 15.09.2026 sind es fuenf: Die zwei Vorhaben, die die Station belegen, stehen VORN -
     genauso wie am Endpunkt. Naennte das Menue einen anderen Grund als die Ablehnung, die man
     bekaeme, waere es eine zweite, widersprechende Auskunft ueber dieselbe Station. */
  /* GEGENPROBE zu den dreien, gemessen am 15.09.2026:
       sabVpAbbau (die Abbau-Bedingung stillgelegt) -> 3-abbau und 3-abbau-vorrang fallen, 31 gruen
       sabVpUmbau (die Umbau-Bedingung stillgelegt) -> 3-umbau faellt, 32 gruen
     BEIDE STAENDE LEGEN DIE BEDINGUNG STILL (`if (false && ...)`), sie LOESCHEN DIE ZEILE NICHT.
     Der erste Anlauf loeschte sie - und dann beginnt die naechste Zeile mit `else if`, also ein
     Syntaxfehler: Der Stand parste gar nicht, 25 Pruefungen fielen, und er belegte damit nur
     "Datei kaputt" statt "Grund fehlt". Ein Stand, der aus dem falschen Grund rot ist, ist so
     wertlos wie einer, durch den nichts faellt. */
  const abbauBis = now + 53 * 60 * 1000;   // 53 Minuten - kommt sonst nirgends vor
  const gAb = await messe(vp({ abbauAb: abbauBis, reparatur: rep({ moeglich:false }) }));
  check('3-abbau: eine Station im Abbau ist gesperrt, und der Grund nennt den Abbau',
    gAb.knopfDa === true && gAb.gesperrt === true && /abgebaut/i.test(gAb.grund || ''), { grund:gAb.grund });
  /* Der Abbau-Grund muss VOR dem Kernzustand greifen. Ohne diese Pruefung waere die Reihenfolge
     unbewacht: Eine Station im Abbau MIT unversehrtem Kern saehe sonst „Der Kern ist unversehrt" -
     wahr, aber nicht die Auskunft, die der Besitzer braucht. */
  const gVor = await messe(vp({ abbauAb: abbauBis, kern:{ lp:6500000, lpMax:6500000 },
    reparatur: rep({ fehlend:0, heilung:0, moeglich:false }) }));
  check('3-abbau-vorrang: der Abbau wird auch dann genannt, wenn der Kern unversehrt ist',
    gVor.gesperrt === true && /abgebaut/i.test(gVor.grund || '') && !/unversehrt/i.test(gVor.grund || ''), { grund:gVor.grund });

  /* MIT FENSTER, NICHT AUF DIE MINUTE (berichtigt im selben Lauf, 15.09.2026). Die erste Fassung
     verlangte /4[01]m/ bei 41 gesetzten Minuten - und mass damit die Wanduhr mit: Zwischen `now`
     und dem Zeichnen vergeht die Laufzeit der vorigen Pruefungen, gemessen kam „noch 39m 44s"
     heraus. Dieselbe Fehlerklasse, die test_abgrund heute schon gekostet hat.
     Die AUSSAGE ist „die Restzeit kommt AUS umruestenAb", nicht „sie ist exakt 41 Minuten".
     Deshalb ein Fenster, wie es 3b eine Handvoll Zeilen weiter unten auch benutzt - die Stunde
     macht den Wert trotzdem eindeutig: Aus einer festen Zahl oder einer anderen Quelle faellt
     kein „1h 3x/4xm". */
  const umbauBis = now + 101 * 60 * 1000;   // 1h 41m - kommt sonst nirgends vor
  const gUm = await messe(vp({ umruestenAb: umbauBis, umruestenZiel:'festung', reparatur: rep({ moeglich:false }) }));
  check('3-umbau: eine Station in der Umruestung ist gesperrt, die Restzeit kommt AUS umruestenAb',
    gUm.knopfDa === true && gUm.gesperrt === true && /umgerüstet/i.test(gUm.grund || '')
    && /1h [34][0-9]m/.test(gUm.grund || ''), { grund:gUm.grund });

  const d = await messe(vp({ kern:{ lp:6500000, lpMax:6500000 }, reparatur: rep({ fehlend:0, heilung:0, moeglich:false }) }));
  check('3a: unversehrter Kern - gesperrt, und der Grund sagt „unversehrt"',
    d.knopfDa === true && d.gesperrt === true && /unversehrt/i.test(d.grund || ''), { grund:d.grund });

  const bis = now + 77 * 60 * 1000;   // 77 Minuten - eine Zahl, die nirgends sonst vorkommt
  const e = await messe(vp({ reparatur: rep({ gesperrt:true, gesperrtBis:bis, moeglich:false }) }));
  check('3b: unter Beschuss - gesperrt, und die Restzeit kommt AUS gesperrtBis',
    e.knopfDa === true && e.gesperrt === true && /1h 1[0-9]m/.test(e.grund || ''), { grund:e.grund });

  const f = await messe(vp({ reparatur: rep({ heilung:0, kosten:{}, vorrat:0, moeglich:false }) }));
  /* DEN EIGENEN SATZ, NICHT DIE SILBE (Durchsicht 14.09.2026, Schwere hoch). Die erste Fassung
     suchte /Lager/i - und das Wort steht auch im Erfolgsgrund („aus dem Stationslager"). Faellt
     der dritte Zweig ersatzlos weg, greift dort der Erfolgszweig, der Grund enthaelt weiter
     „Lager", und die Pruefung waere gruen geblieben. Jetzt steht der eigene Satz drin. */
  check('3c: leeres Stationslager - gesperrt, und der Grund nennt SEINEN eigenen Satz',
    f.knopfDa === true && f.gesperrt === true && /liegt nichts, woraus/.test(f.grund || ''), { grund:f.grund });

  /* 3d: DIE SPERRE LAEUFT AB, WAEHREND DER ZWISCHENSPEICHER STEHT. Der Server hat `gesperrt:true`
     und `moeglich:false` geschickt, aber `gesperrtBis` liegt inzwischen in der Vergangenheit -
     genau die Lage nach jeder Belagerung, weil der Katalog nur alle zwei Minuten frisch wird und
     die Sperre vier Stunden dauert. Wer die Booleans abschreibt, zeigt einen grauen Knopf mit
     „reparieren geht in 0s". */
  const h = await messe(vp({ reparatur: rep({ gesperrt:true, gesperrtBis: now - 60000, moeglich:false }) }));
  check('3d: abgelaufene Sperre - der Knopf ist wieder benutzbar, obwohl der Server noch gesperrt meldete',
    h.knopfDa === true && h.gesperrt === false && !/0s/.test(h.grund || ''), { grund:h.grund, gesperrt:h.gesperrt });

  // ---- 4: die Info-Zeile
  check('4a: die Info-Zeile nennt die Heilung UND die Kosten',
    a.zeileDa === true && a.zeileHeilung === HEILUNG && (a.zeile || '').indexOf('281') >= 0,
    { zeile:a.zeile, heilung:a.zeileHeilung });
  check('4b: am fremden Vorposten steht die Info-Zeile nicht',
    c.zeileDa === false, { zeile:c.zeile });
  /* Die Zeile haengt an DREI Bedingungen (Schalter, eigener Vorposten, beschaedigter Kern). 4a/4b
     bewachten nur zwei davon - die dritte war ungeprueft (Durchsicht 14.09.2026). */
  check('4c: bei ausgeschaltetem Schalter fehlt auch die Info-Zeile', b.zeileDa === false, { zeile:b.zeile });
  check('4d: am unversehrten Kern fehlt die Info-Zeile', d.zeileDa === false, { zeile:d.zeile });

  // ---- 5: was ueber die Leitung geht
  const k = await messe(vp(), { klicken:true });
  check('5-anker: der Klick ist wirklich angekommen', k.reparaturRufe === 1, { rufe:k.reparaturRufe });
  /* 5a misst den ABGEFANGENEN Request, nicht das Markup: Nur so faellt die Pruefung auch dann,
     wenn jemand ein Feld in einer Variablen versteckt. Der Server nimmt genau `system` - jedes
     weitere Feld waere eine Zahl, die der Client bestimmen will, und genau das verbietet die
     Bauart (dieselbe Regel wie bei /api/attack). */
  check('5a: der Request traegt GENAU {system} - kein Betrag, keine Menge',
    !!k.reparaturBody && Object.keys(k.reparaturBody).length === 1 && k.reparaturBody.system === SYS,
    { body:k.reparaturBody });
  /* 5b: HEILUNG und die Summe von KOSTEN sind absichtlich ungleich - gemessen 437 gegen 450. Ein
     Frontend, das die Kosten aus der Heilung ableitet, zeigte hier „437 Erz" statt „281 Erz" -
     eine Zahl, die der Server nie geschickt hat. */
  check('5b: die Kostenzahl ist NICHT aus der Heilung abgeleitet',
    !!a.grund && a.grund.indexOf('281 Erz') >= 0 && a.grund.indexOf('437 Erz') < 0,
    { grund:a.grund });
  check('6a: nach dem Klick werden die Vorposten NEU geladen',
    k.vorpostenAbrufe > k.abrufeVorKlick, { vorher:k.abrufeVorKlick, nachher:k.vorpostenAbrufe });
  /* 6b: Der Klickpfad prueft sonst nur das OB, nicht das WAS (Durchsicht 14.09.2026). Die
     Erfolgsmeldung muss BEIDE Zahlen der ANTWORT tragen - und zwar die aus der Antwort, nicht die
     aus der Vorschau. Beide sind hier zufaellig gleich; entscheidend ist, dass sie ueberhaupt
     erscheinen und nicht auseinander abgeleitet sind. */
  const erfolg = (k.meldungen || []).filter(m => /wiederhergestellt/.test(m)).pop() || '';
  check('6b: die Erfolgsmeldung nennt die geheilten Punkte UND den Verbrauch aus der Antwort',
    erfolg.indexOf(String(HEILUNG)) >= 0 && erfolg.indexOf('281 Erz') >= 0, { meldung:erfolg });
  /* 6c: Der Ablehnungsweg. Der Servertext gewinnt - das Spiel bildet keinen der acht Fehlerfaelle
     nach -, und danach wird NEU GELADEN, weil drei der acht Ablehnungen heissen „dein
     Zwischenspeicher ist alt". */
  const ab = await messe(vp(), { klicken:true, ablehnen:true });
  const abMeldung = (ab.meldungen || []).filter(m => /reparieren/i.test(m)).pop() || '';
  check('6c: bei Ablehnung steht der SERVERTEXT im Spiel, nicht eine eigene Nachbildung',
    abMeldung.indexOf('liegt nichts, woraus') >= 0, { meldung:abMeldung });
  check('6d: auch nach einer Ablehnung werden die Vorposten neu geladen',
    ab.vorpostenAbrufe > ab.abrufeVorKlick, { vorher:ab.abrufeVorKlick, nachher:ab.vorpostenAbrufe });

  check('J1: keine JS-Fehler', a.errs.length === 0 && k.errs.length === 0, a.errs.slice(0,3).concat(k.errs.slice(0,3)));
  await browser.close();
  ende();
})().catch(e => { console.log('FAIL - Testlauf abgebrochen: ' + e.message); process.exit(1); });
