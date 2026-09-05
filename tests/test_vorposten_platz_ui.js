// Der freie Platz und die Schiffe auswaerts (#50/#51, Frontend-Haelfte, 05.09.2026).
//
// ZWEI FRAGEN AUS SICHT DES VERBUENDETEN, die das Spiel nicht beantwortete:
//
// #50 „Wieviel darf ich noch schicken?" Der Client rechnete `garnisonMax - garnisonAnzahl` und
// nannte das „frei". Fuer den Besitzer stimmt das. Fuer einen Verbuendeten ist es die FALSCHE
// Grenze, denn der Server deckelt zusaetzlich die Summe aller Nicht-Besitzer. Im Quelltext stand
// das sogar als Begruendung, warum die Zahl nicht genannt wird - „ein Versprechen ueber eine Zahl,
// die dieses Spiel nicht kennt". Seit dem Backend-PR kennt es sie: `meinPlatz` kommt aus DERSELBEN
// Funktion, mit der /vorposten/stationieren annimmt.
//
// #51 „Wo stehen meine Schiffe eigentlich?" Wer beigesteuert hatte, fand sie nirgends wieder: Die
// Flottenposition kennt nur fliegende eigene Flotten, die Vorposten-Liste nur EIGENE Stationen
// (`meineVorposten()` filtert auf `v.eigener`), und die Zahl stand ausschliesslich im Kartenmenue
// der fremden Station. Wer vergessen hatte, WO er beigesteuert hat, musste jedes System einzeln
// aufmachen - und beim Fall der Station verlor er Schiffe, von denen er nicht mehr wusste, dass
// sie dort standen.
//
// DIE VORLAGE MISST DEN UNTERSCHIED. `garnisonAnzahl:900` bei `garnisonMax:14000` und
// `meinPlatz:100`: Die alte Rechnung ergibt 13100, die richtige 100. Jede Pruefung, die die neue
// Zahl sucht, schliesst die alte damit aus - und umgekehrt. Eine Vorlage, in der beide Zahlen
// zusammenfielen, koennte den Fehler nicht zeigen.
//
// GEPRUEFT:
//   0-anker  vpMeinPlatz ist auffindbar (sonst misst 0a-0c nichts).
//   0a  Sie LIEST `meinPlatz` und rechnet fuer den Verbuendeten nichts nach - eine zweite Fassung
//       der Deckel-Formel waere die Kopie-Familie, die hier schon mehrfach auseinanderlief.
//   0b  Der Rueckfall auf die alte Rechnung steht HINTER `v.eigener`: Fuer ihn gibt es den
//       Fremdanteil nicht, fuer den Verbuendeten gibt es keine ehrliche Ersatzzahl.
//   0c  Alle Lesestellen gehen ueber diese eine Funktion.
//   0d  Die Liste „auswaerts" haengt NICHT an `verbuendet` - wie der Rueckruf-Eintrag.
//   0e  Jede Groesse der Zeile steht in ihrer Signatur (die Falle, die in der Liste darueber
//       schon dreimal zuschlug: Anflug-Countdown, lpMax/garnisonMax, umruestenAb).
//   1a  Der Menueeintrag nennt dem Verbuendeten SEINE Zahl (100), nicht die der Station (13100).
//   1b  Die Stationstafel traegt sie als `data-vp-meinplatz`.
//   1c  Bei `meinPlatz:0` ist der Eintrag GESPERRT und nennt den Grund - vorher war er bedienbar,
//       der Flug ging los und angenommen wurde nichts.
//   1d  Fehlt das Feld (Serverstand vor #50), bleibt es beim alten Text: keine erfundene Zahl,
//       und der Eintrag bleibt bedienbar.
//   1e  Ein Fremder OHNE Buendnis bekommt die Zeile NICHT, obwohl `meinPlatz` in der Antwort
//       steht - der Server rechnet dort nur Deckel, keine Berechtigung.
//   2a  Die Flottenwahl nennt DIESELBE Zahl wie das Menue (Anzeige und Anzeige einig).
//   2b  ... und die Warnung „zu viele" misst gegen SEINEN Platz, nicht gegen die Stationsgrenze.
//       Gegen die Stationsgrenze gaebe es bei 260 Schiffen gar keine Warnung.
//   2c  ... und die SPERRE des Dialogs liegt am selben Deckel. Diese Pruefung gibt es, weil die
//       Gegenprobe gezeigt hat, dass die Sperre von keiner anderen gedeckt war.
//   3a  #51: Der Kasten nennt Station, System, den EIGENEN Anteil und den Kernzustand.
//   3b  ... und traegt das System als Sprungziel.
//   3c  EIGENE Vorposten stehen nicht darin - dafuer gibt es den Kasten darueber.
//   3d  Ohne beigesteuerte Schiffe bleibt er versteckt (keine Ueberschrift ohne Gegenstand).
//   3e  Ein AUFGELOESTES Buendnis nimmt die Zeile nicht weg - die Schiffe stehen weiter dort,
//       und der Server gibt sie heraus.
//   4a  Keine Seitenfehler in allen sechs Laeufen.
//
// Gegenprobe: siehe Fuss der Datei.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = src.match(/<script>([\s\S]*)<\/script>/)[1];
/* KOMMENTARE ZUERST STREICHEN. Diese Regel steht in docs/TESTING.md, weil sie schon zweimal
   verletzt wurde: Ein Waechter fand sein Suchwort im erklaerenden Kommentar und blieb gruen,
   obwohl der Code die Regel nicht mehr trug. */
const ohneKommentar = t => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, '');
const ICH = 'u-ich';
const SYS = 'vega';

// ---- 0) Quelltext: die eine Auslesestelle --------------------------------------------------
{
  const von = JS.indexOf('function vpMeinPlatz(');
  const rumpf = von < 0 ? '' : ohneKommentar(JS.slice(von, JS.indexOf('\n  }', von)));
  check('0-anker: vpMeinPlatz ist auffindbar und genau einmal definiert (sonst misst 0a-0c nichts)',
    von > 0 && (JS.match(/function vpMeinPlatz\(/g) || []).length === 1 && rumpf.length > 80,
    { laenge: rumpf.length, definitionen: (JS.match(/function vpMeinPlatz\(/g) || []).length });
  check('0a: sie liest `meinPlatz` vom Server, statt den Fremdanteil nachzurechnen',
    /v\.meinPlatz/.test(rumpf) && !/ALLIANZ|anteil|Anteil/.test(rumpf), { auszug: rumpf.slice(0, 200) });
  /* Der Rueckfall darf NUR den Besitzer betreffen. Faende er auch fuer den Verbuendeten statt,
     stuende die alte, falsche Zahl wieder da - nur an einer neuen Stelle. */
  const eigVon = rumpf.indexOf('v.eigener');
  const grenzVon = rumpf.indexOf('garnisonMax');
  check('0b: der Rueckfall auf die alte Rechnung steht hinter `v.eigener`, und die Funktion endet auf `null`',
    eigVon > 0 && grenzVon > eigVon && /return null;\s*$/.test(rumpf.trim()),
    { eigener: eigVon, garnisonMax: grenzVon, ende: rumpf.trim().slice(-40) });
  check('0c: alle Lesestellen gehen ueber diese eine Funktion (Flottenwahl, Kartenmenue, Tafel)',
    (JS.match(/vpMeinPlatz\(/g) || []).length >= 5,
    { aufrufe: (JS.match(/vpMeinPlatz\(/g) || []).length });
}
// ---- 0d/0e) Quelltext: die Liste „auswaerts" ------------------------------------------------
{
  const von = JS.indexOf("document.getElementById('fpVorpostenFremdSection')");
  const bis = von < 0 ? -1 : JS.indexOf('lastVpFremdSig = fremdSig;', von);
  const block = (von < 0 || bis < 0) ? '' : ohneKommentar(JS.slice(von, bis));
  check('0-anker2: der Block der Fremd-Liste ist auffindbar (sonst messen 0d/0e nichts)',
    von > 0 && bis > von && block.length > 400, { laenge: block.length });
  /* NICHT an `verbuendet`, aus demselben Grund wie der Rueckruf-Eintrag im Kartenmenue: Wer die
     Allianz verlassen hat, ist nicht mehr `verbuendet`, seine Schiffe stehen aber weiter dort. */
  check('0d: der Filter haengt am BEITRAG, nicht am Buendnis',
    /!v\.eigener && vpMeineGarnison\(v\) > 0/.test(block) && !/v\.verbuendet/.test(block),
    { auszug: (block.match(/\.filter\([^\n]*/) || [''])[0] });
  /* Jede Groesse, die in der Zeile steht, MUSS in der Signatur stehen. Sonst friert die Anzeige
     ein, ohne dass etwas kaputt aussieht - dreimal gemessen in der Liste darueber. */
  const sigVon = block.indexOf('const fremdSig =');
  const sig = sigVon < 0 ? '' : block.slice(sigVon, block.indexOf('.join(', sigVon));
  /* BEIDE NAMEN, nicht nur der angezeigte (Codex-Befund am PR, 05.09.2026): Die Zeile zeigt
     `eigenName || name`, der TOOLTIP nennt ueber `vpTitel(v)` beide. Steht ein eigener Name,
     veraendert ein Ausbau nur `v.name` - mit `(eigenName || name)` in der Signatur bliebe sie
     gleich und der Tooltip nennte weiter die alte Stufe. `v.name` muss also EIGENSTAENDIG darin
     stehen, nicht als Rueckfall hinter dem eigenen Namen; deshalb wird hier auf das ODER geprueft,
     nicht nur auf das Vorkommen der beiden Woerter. */
  check('0e: die Signatur traegt jede Groesse der Zeile - beide Namen einzeln, Anteil, Kern, Besitzer, System',
    /vpMeineGarnison\(v\)/.test(sig) && /kernProz\(v\)/.test(sig) && /besitzerName/.test(sig)
    && /eigenName/.test(sig) && /v\.name/.test(sig) && !/eigenName \|\| v\.name/.test(sig)
    && /v\.sys/.test(sig), { signatur: sig.replace(/\s+/g, ' ') });
}

const now = Date.now();
const STUFEN = [1,2,3,4,5,6,7,8].map(s => ({ stufe:s, name:'Stufe '+s, kernLp:20000*s, verteidigung:2500*s,
  garnisonMax:300*s, flug:0.06, prod:0.015, scan:1, werft:0, markt:0, lager:0, kosten:{ erz:1000 } }));
/* DIE ZAHLEN SIND DER MESSPUNKT: 900 von 14000 belegt heisst „13100 frei" nach der alten Rechnung
   und „100" nach der richtigen. Wer die eine Zahl findet, findet die andere nicht. */
function vp(over){
  return Object.assign({ id:'vp1', sys:SYS, besitzer:'u-partner', besitzerName:'Partner', seit: now-86400000,
    stufe:8, name:'Orbitalfeste', eigenName:null, zweig:'festung', zweigName:'Festungsring', maxStufe:8,
    kern:{ lp:3250000, lpMax:6500000 }, verteidigung:850000, garnisonAnzahl:900, garnisonMax:14000,
    meinPlatz:100,
    schutzBis:0, ausbauAb: now-1000, eigener:false, meinLetzterSchlag:0,
    letzterKampf:null, slots:0, module:[], modulBoni:null, sets:[], projekte:[], projektBoni:null,
    projektLaeuft:null, projektMoeglich:[], naechsteStufe:null, anflug:[],
    nutzen:{ flug:0.30, prod:0.13, scan:5, werft:0, markt:0, flugDeckel:0.5 },
    lager:{}, lagerRate:{}, lagerVollAb:0,
    verbuendet:true, meineGarnison:{ jaeger:200 } }, over || {});
}
/* Der Serverstand VOR #50 schickt das Feld gar nicht - `meinPlatz:null` waere eine andere Lage
   (ein Server, der ausdruecklich „unbekannt" sagt). Gemessen wird die echte: der Schluessel fehlt. */
function vpOhnePlatz(over){ const o = vp(over); delete o.meinPlatz; return o; }
function spielstand(){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil']) g[t] = true;
  /* KEINE JAEGER: capFighterSelection kappt Jaeger und Bomber auf die Hangarplaetze der
     mitgeschickten Traeger - ohne Traeger flogen 400 Jaeger als NULL Schiffe mit, und 2b haette
     auf voellig korrektem Code nichts gemessen (dieselbe Falle steht in test_gegnerlage.js).
     Kreuzer und Zerstoerer haengen an keinem Hangar. 260 Schiffe: mehr als die 100, die er
     schicken darf - aber WENIGER als die 13100, die die alte Rechnung freigegeben haette. */
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:60, werft:14 }, research:{}, fleet:{ cruisers:200, destroyers:60, missions:[] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:5000, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}

(async () => {
  const browser = await starteBrowser();
  async function messe(liste, opts){
    opts = opts || {};
    const ctx = await browser.newContext({ viewport:{ width:1280, height:1000 } });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }),
      'kepler7-save-v3': spielstand() };
    await page.route('**/api/**', async r => {
      const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
      const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
      if (p === 'health') return j({ ok:true });
      if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
      if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:[] });
      if (p === 'vorposten') return j({ ok:true, aktiv:true, bauAktiv:true, maxJeKonto:3, schutzMs:0, abklingMs:0,
        ausbauMs:43200000, garnisonFaktor:0.5, stufen:STUFEN,
        zweige:[{ key:'festung', name:'Festungsring', kurz:'Haelt Systeme.', namen:{8:'Sternenfestung'}, mult:{} }],
        zweigAb:4, maxStufe:8, modulDefs:[], modulSeltenheiten:{}, modulBaubar:['gewoehnlich'],
        modulAusbauKosten:250, modulBauAbklingMs:0, modulBestand:{}, modulBauAb:0,
        projektDefs:[], projekteAktiv:false, flugDeckel:0.5, lagerAktiv:false, lagerStunden:12,
        abbauAktiv:true, abbauMs:86400000,
        allianzAktiv:true, liste, eigene: liste.filter(v => v.eigener).length });
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
    await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); window.confirm = () => false; });
    await page.goto(SPIEL_URL); await page.waitForTimeout(6000);
    await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
      .forEach(id => { const n = document.getElementById(id); if (n) n.style.display = 'none'; }));

    /* DIE LEISTE WIRD IN render() GEBAUT, unabhaengig davon, ob das Seitenmenue gerade aufgeklappt
       ist - gemessen an der Stelle im Quelltext, an der der Kasten entsteht. Deshalb genuegt es,
       den DOM zu lesen; ein Klick auf den Aufklapper waere eine zweite, unnoetige Fehlerquelle. */
    const leiste = await page.evaluate(() => {
      const sec = document.getElementById('fpVorpostenFremdSection');
      const liste = document.getElementById('fpVorpostenFremdList');
      const zahl = document.getElementById('fpVorpostenFremdCount');
      return { da: !!sec, sichtbar: sec ? sec.style.display !== 'none' : null,
        anzahl: zahl ? (zahl.textContent || '').trim() : null,
        text: liste ? (liste.textContent || '').replace(/\s+/g, ' ').trim() : null,
        ziele: liste ? [...liste.querySelectorAll('[data-fp-vp-fremd]')].map(b => b.getAttribute('data-fp-vp-fremd')) : [] };
    });

    let menue = { text:null, meinPlatz:null, gruende:[], gesperrt:null }, fwahl = { da:false, zeilen:[], zuviel:null };
    if (opts.menue !== false){
      await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
      await page.waitForTimeout(600);
      await oeffneSystemUeberSektoren(page, SYS);
      await page.waitForTimeout(1000);
      await page.evaluate(() => { const n = document.querySelector('[data-map-vorposten]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true })); });
      /* Der Container heisst `.kmenu` - KEIN Rueckfall auf document.body: Dessen textContent
         enthaelt den <script>-Block, also den Quelltext, und jede Textpruefung waere vacuous. */
      await page.waitForFunction(() => {
        const m = document.querySelector('.kmenu');
        return m && /Vorposten/.test(m.textContent || '');
      }, null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(300);
      menue = await page.evaluate(() => {
        const m = document.querySelector('.kmenu');
        if (!m) return { text:null, meinPlatz:null, gruende:[], gesperrt:null };
        const zeile = m.querySelector('[data-vp-meinplatz]');
        const knopf = [...m.querySelectorAll('button')].find(b => /Garnison beisteuern/.test(b.textContent || ''));
        return { text: (m.textContent || '').replace(/\s+/g, ' ').trim(),
          meinPlatz: zeile ? Number(zeile.getAttribute('data-vp-meinplatz')) : null,
          tafel: zeile ? (zeile.textContent || '').replace(/\s+/g, ' ').trim() : null,
          gruende: [...m.querySelectorAll('.kmenu-grund')].map(x => (x.textContent || '').replace(/\s+/g, ' ').trim()),
          gesperrt: knopf ? (knopf.disabled === true || knopf.classList.contains('disabled')) : null };
      });
      if (opts.flottenwahl){
        await page.evaluate(() => { const b = [...document.querySelectorAll('.kmenu button')].find(x => /Garnison beisteuern/.test(x.textContent || '')); if (b) b.click(); });
        await page.waitForTimeout(800);
        await page.evaluate(() => { const b = [...document.querySelectorAll('#fwahlOverlay button')].find(x => /Komplette Flotte/.test(x.textContent || '')); if (b) b.click(); });
        await page.waitForTimeout(700);
        fwahl = await page.evaluate(() => {
          const ov = document.getElementById('fwahlOverlay');
          if (!ov || ov.style.display === 'none') return { da:false, zeilen:[], zuviel:null };
          const w = ov.querySelector('[data-vp-zuviel]');
          return { da:true, zeilen: [...ov.querySelectorAll('.bmeta')].map(d => (d.textContent || '').replace(/\s+/g, ' ').trim()),
            zuviel: w ? Number(w.getAttribute('data-vp-zuviel')) : null };
        });
      }
    }
    await ctx.close();
    return { leiste, menue, fwahl, errs };
  }

  const verb   = await messe([vp()], { flottenwahl:true });
  const voll   = await messe([vp({ meinPlatz:0 })]);
  const alt    = await messe([vpOhnePlatz()]);
  const fremd  = await messe([vp({ verbuendet:false, meineGarnison:{} })]);
  const exVerb = await messe([vp({ verbuendet:false })]);
  const eigen  = await messe([vp({ eigener:true, besitzer:ICH, besitzerName:'Ich', verbuendet:false })], { menue:false });

  const laeufe = { verb, voll, alt, fremd, exVerb, eigen };

  check('1-anker: das Kartenmenue wurde in allen fuenf Karten-Laeufen gezeichnet',
    [verb, voll, alt, fremd, exVerb].every(x => typeof x.menue.text === 'string' && x.menue.text.length > 40 && x.menue.text.length < 20000),
    { laengen: [verb, voll, alt, fremd, exVerb].map(x => x.menue.text === null ? null : x.menue.text.length) });

  const grundVon = (l, wort) => (l.menue.gruende || []).find(g => new RegExp(wort).test(g)) || '';
  {
    /* Der Eintrag steht ueber SEINER Zahl. 13100 waere die Grenze der STATION - genau die Zahl,
       die er vorher las, bevor er 13000 Schiffe umsonst losschickte. */
    const g = grundVon(verb, 'Verstärkt|Deine Schiffe bleiben');
    check('1a: der Menueeintrag nennt dem Verbuendeten SEINE Zahl (100), nicht die der Station (13100)',
      /noch 100 an/.test(g) && !/13100/.test(g) && !/13\.100/.test(g), { grund: g });
  }
  check('1b: die Stationstafel traegt den freien Platz als Zahl',
    verb.menue.meinPlatz === 100 && /Für dich noch/.test(verb.menue.tafel || ''),
    { attribut: verb.menue.meinPlatz, zeile: verb.menue.tafel });
  {
    const g = grundVon(voll, 'kein Platz mehr frei');
    /* NUR Sperre und Grund - das Attribut gehoert 1b. Beides in EINER Pruefung haette bedeutet,
       dass eine Sabotage an der Tafel auch diese hier faellt, und die Zuordnung waere hin. */
    check('1c: bei `meinPlatz:0` ist der Eintrag gesperrt und nennt den Grund',
      voll.menue.gesperrt === true && /ausgeschöpft/.test(g),
      { gesperrt: voll.menue.gesperrt, grund: g });
  }
  {
    const g = grundVon(alt, 'Verstärkt|Deine Schiffe bleiben');
    check('1d: fehlt das Feld, gibt es keine erfundene Zahl - und der Eintrag bleibt bedienbar',
      alt.menue.gesperrt === false && alt.menue.meinPlatz === null
      && /ist aber begrenzt/.test(g) && !/\bnoch \d+ an\b/.test(g),
      { gesperrt: alt.menue.gesperrt, attribut: alt.menue.meinPlatz, grund: g });
  }
  check('1e: ein Fremder OHNE Buendnis bekommt die Zeile nicht, obwohl `meinPlatz` in der Antwort steht',
    fremd.menue.meinPlatz === null && !/Für dich noch/.test(fremd.menue.text || ''),
    { attribut: fremd.menue.meinPlatz, auszug: (fremd.menue.text || '').slice(0, 160) });

  // ---- 2) Die Flottenwahl -------------------------------------------------------------------
  check('2-anker: die Flottenwahl ging auf und wurde befuellt (sonst messen 2a/2b nichts)',
    verb.fwahl.da === true && verb.fwahl.zeilen.length >= 2, { zeilen: verb.fwahl.zeilen.length });
  {
    const z = (verb.fwahl.zeilen || []).find(x => /Garnison:/.test(x)) || '';
    check('2a: die Flottenwahl nennt DIESELBE Zahl wie das Menue - Anzeige und Anzeige sind einig',
      /noch 100 an/.test(z) && !/13100/.test(z), { zeile: z });
  }
  {
    /* 260 Schiffe gegen 100 Platz = 160 zu viel. Gegen die Stationsgrenze (13100) gaebe es
       ueberhaupt keine Warnung - die Zahl unterscheidet die beiden Rechnungen eindeutig. */
    const z = (verb.fwahl.zeilen || []).find(x => /mehr, als/.test(x)) || '';
    check('2b: die Warnung misst gegen SEINEN Platz, nicht gegen die Stationsgrenze',
      verb.fwahl.zuviel === 160 && /annimmt/.test(z), { zuviel: verb.fwahl.zuviel, zeile: z });
  }

  /* 2c: DIE SPERRE DER FLOTTENWAHL - eine Luecke, die erst die Gegenprobe gezeigt hat.

     Lauf B setzte diese Sperre zurueck auf `frei` und erwartete, dass 1c faellt. 1c blieb GRUEN,
     und zu Recht: Sie misst den Eintrag im KARTENMENUE, der an einer anderen Rechnung haengt. Die
     Sperre im Dialog war damit von KEINER Pruefung gedeckt.

     Im Spiel erreicht man sie kaum - bei `meinPlatz:0` ist der Menueeintrag schon gesperrt, der
     Dialog geht gar nicht auf. Sie greift erst, wenn die Vorposten-Daten sich waehrend des offenen
     Dialogs erneuern. Genau deshalb ist sie eine Pruefung wert: Ungedeckter Code, der selten
     laeuft, altert unbemerkt. Gemessen wird am Quelltext, weil der Weg dorthin im Browser von
     einem Zufall abhinge. */
  {
    const sendVon = JS.indexOf('function vorpostenGarnisonSenden(');
    const rumpf = sendVon < 0 ? '' : ohneKommentar(JS.slice(sendVon, JS.indexOf('\n  async function vorpostenGarnisonAnkunft', sendVon)));
    const sperrVon = rumpf.indexOf('sperre:');
    const sperre = sperrVon < 0 ? '' : rumpf.slice(sperrVon, rumpf.indexOf('start:', sperrVon));
    check('2-anker2: die Sperre der Flottenwahl ist auffindbar (sonst misst 2c nichts)',
      sendVon > 0 && sperre.length > 80 && sperre.length < 1200, { laenge: sperre.length });
    check('2c: die Sperre liegt am selben Deckel wie Vorschau und Warnung, nicht an `frei`',
      /deckel < 1/.test(sperre) && !/\bfrei < 1/.test(sperre), { sperre: sperre.replace(/\s+/g, ' ').slice(0, 220) });
  }

  // ---- 3) #51: die Schiffe auswaerts --------------------------------------------------------
  check('3a: der Kasten nennt Station, System, den eigenen Anteil und den Kernzustand',
    verb.leiste.sichtbar === true && verb.leiste.anzahl === '(1)'
    && /Orbitalfeste/.test(verb.leiste.text || '') && /200 von dir/.test(verb.leiste.text || '')
    && /Kern 50%/.test(verb.leiste.text || '') && /Partner/.test(verb.leiste.text || ''),
    { sichtbar: verb.leiste.sichtbar, anzahl: verb.leiste.anzahl, text: verb.leiste.text });
  check('3b: die Zeile traegt das System als Sprungziel',
    JSON.stringify(verb.leiste.ziele) === JSON.stringify([SYS]), { ziele: verb.leiste.ziele });
  check('3c: EIGENE Vorposten stehen nicht darin - dafuer gibt es den Kasten darueber',
    eigen.leiste.da === true && eigen.leiste.sichtbar === false && eigen.leiste.ziele.length === 0,
    { sichtbar: eigen.leiste.sichtbar, ziele: eigen.leiste.ziele, text: eigen.leiste.text });
  check('3d: ohne beigesteuerte Schiffe bleibt er versteckt',
    fremd.leiste.sichtbar === false && (fremd.leiste.text || '') === '',
    { sichtbar: fremd.leiste.sichtbar, text: fremd.leiste.text });
  check('3e: ein aufgeloestes Buendnis nimmt die Zeile nicht weg - die Schiffe stehen weiter dort',
    exVerb.leiste.sichtbar === true && /200 von dir/.test(exVerb.leiste.text || ''),
    { sichtbar: exVerb.leiste.sichtbar, text: exVerb.leiste.text });

  check('4a: keine Seitenfehler in allen sechs Laeufen',
    Object.values(laeufe).every(l => l.errs.length === 0),
    Object.fromEntries(Object.entries(laeufe).map(([k, l]) => [k, l.errs.slice(0, 2)])));

  await browser.close();
  ende();
})();

/* GEGENPROBE, fuenf Laeufe am 05.09.2026 gemessen. Die Pruefnamen jedes Laufs wurden per `diff`
   gegen den Basislauf verglichen - in allen fuenf Laeufen war die Liste identisch, es ist also
   keine Pruefung verschwunden (die Schlusszeile mitzuzaehlen statt Namen zu vergleichen, hat in
   diesem Repo schon einmal eine fehlende Pruefung verdeckt).

   Jede Sabotage traf eine NACHWEISLICH andere Codestelle; die „was fallen MUSS"-Liste stand VOR
   dem Lauf fest. Zwei Vorhersagen waren falsch - sie stehen unten, weil sie das Wertvollste an
   dieser Gegenprobe sind.

   LAUF A - vier Sabotagen. Vorhergesagt: 0d, 0e, 1a, 2b, 3e. Gefallen: genau diese fuenf.
     s1  Kartenmenue-Grund wieder ohne die Zahl                    -> 1a
     s3  Flottenwahl-Deckel zurueck auf `frei`                     -> 2b
     s6  Fremd-Liste wieder an `verbuendet` gehaengt               -> 0d, 3e
     s8  `kernProz` aus der Signatur genommen                      -> 0e

   LAUF B - vier Sabotagen. Vorhergesagt: 1b, 1c, 2a, 3c, 3d. Gefallen: 1b, 2a, 3c, 3d.
     s2  Tafel-Zeile abgeschaltet                                  -> 1b
     s4  Vorschau-Text zurueck auf den alten Wortlaut              -> 2a
     s5  Sperre der Flottenwahl zurueck auf `frei`                 -> NICHTS
     s12 Kasten immer sichtbar                                     -> 3c, 3d

     FEHLPROGNOSE 1, und die wichtigste Erkenntnis dieser Gegenprobe: Ich erwartete, dass s5 die
     Pruefung 1c faellt. 1c blieb GRUEN, und das ist richtig - sie misst den Eintrag im
     KARTENMENUE, der an `freiV` haengt, nicht an `deckel`. Die Sperre im Dialog war damit von
     KEINER Pruefung gedeckt. Haette ich hier nur „fuenf vorhergesagt, vier gefallen, nah genug"
     notiert, waere die Luecke offen geblieben. Pruefung 2c und Lauf E sind die Antwort darauf.

   LAUF C - eine Sabotage: `vpMeinPlatz` liest das Serverfeld nicht mehr.
     Vorhergesagt: 0a, 1a, 1b, 1c, 2a, 2b. Gefallen: diese sechs UND 0b, 1d.

     FEHLPROGNOSE 2, beide Zusatztreffer sind richtig: Die Sabotage ersetzte den Feldzugriff SAMT
     der Zeile `if (v.eigener){` durch `if (true){`. Damit verschwand `v.eigener` aus dem Rumpf
     (0b prueft genau dessen Stellung) und der Rueckfall galt auch fuer Nicht-Besitzer - im
     „alter Server"-Lauf stand dann die alte Zahl 13100 in der Tafel, was 1d faellt. Eine
     Sabotage, die zwei Regeln zugleich aufhebt, faellt zwei Pruefungen; das ist kein Fehler der
     Pruefungen, sondern eine ungenaue Vorhersage.

   LAUF D - drei Sabotagen. Vorhergesagt: 0b, 0d, 1d, 1e, 3c. Gefallen: genau diese fuenf.
     s10 Rueckfall gilt auch dem Verbuendeten                      -> 0b, 1d
     s11 Tafel-Zeile ohne `v.verbuendet`                           -> 1e
     s7  Fremd-Liste ohne `!v.eigener`                             -> 0d, 3c

   LAUF E - zwei Sabotagen, nach der Luecke aus Lauf B. Vorhergesagt: 1c, 2c. Gefallen: genau
   diese zwei.
     s13 Kartenmenue rechnet wieder mit der Grenze der STATION     -> 1c
     s5  Sperre der Flottenwahl zurueck auf `frei`                 -> 2c

   LAUF G - eine Sabotage, nach einem Befund der Durchsicht am PR (Codex, P2). Vorhergesagt: 0e.
   Gefallen: genau 0e.
     s14 Signatur zurueck auf `(v.eigenName || v.name)`                -> 0e

     DER BEFUND WAR RICHTIG UND MEINE EIGENE REGEL HAETTE IHN FANGEN MUESSEN. Die Zeile zeigt
     `eigenName || name`, der TOOLTIP aber `vpTitel(v)` - und der nennt BEIDE. Steht ein eigener
     Name, aendert ein Ausbau nur `v.name`; die Signatur blieb gleich, die Zeile wurde nicht neu
     gebaut, und der Tooltip nannte weiter die alte Stufe. Ich hatte „jede Groesse, die in der
     Zeile steht" als „jede Groesse, die im sichtbaren Text steht" gelesen - der Tooltip gehoert
     aber genauso dazu. 0e prueft seither, dass `v.name` EIGENSTAENDIG in der Signatur steht und
     nicht als Rueckfall hinter dem eigenen Namen (`!/eigenName \|\| v\.name/`), sonst waere die
     alte Fassung wieder gruen.

   NICHT GEDECKT, bewusst: Die Farbe des Kernbalkens (`kernFarbe`) und die Reihenfolge der drei
   Angaben in der Zeile. Beides ist Darstellung ohne Regel dahinter - eine Pruefung darauf waere
   eine Momentaufnahme, kein Verhalten, und stuende jeder kuenftigen Umgestaltung im Weg.

   Die Bauplan-Seite derselben Aenderung steht in tests/test_vorposten_verbuendet_ui.js (Pruefung
   0i, eigene Gegenprobe im Fuss dort). Diese Datei prueft, was der Spieler wirklich liest. */
