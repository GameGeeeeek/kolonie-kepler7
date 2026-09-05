// Modul-Sets im Spiel (Etappe V7, Frontend-Haelfte, 05.09.2026, Backend #245).
//
//   node tests/test_vorposten_sets_ui.js
//
// Der Server kennt die Sets seit #245: `modulSetDefs` (die Tabelle), `modulSetsAktiv` (der
// Schalter), `zweigSlots` (wieviel Platz die Ausrichtung dazugibt) und je Vorposten `sets` (welche
// Sets STEHEN) plus `setBoni`. Das Spiel muss davon dreierlei zeigen:
//
//   1. IM STECKPLATZ-FENSTER, was ein Set bringt und WELCHES Stueck noch fehlt - genau die Frage,
//      die man beim Bestuecken hat. Ohne den fehlenden Namen muesste man die Tabelle im Kopf haben.
//   2. IN DER STATIONSTAFEL, welche Sets stehen - fuer JEDEN sichtbar, wie Steckplaetze und
//      Verteidigung. Ein Angreifer soll sehen, warum diese Station haerter ist, als ihre
//      Modulliste vermuten laesst.
//   3. NICHTS DAVON, solange der Schalter liegt (Abschnitt 4). Der Server rechnet dann ohne Sets;
//      eine Anzeige waere eine Behauptung ueber eine Zahl, die es nicht gibt.
//
// WAS HIER BEWUSST NICHT NACHGERECHNET WIRD: ob ein Set steht. Das sagt `v.sets`, und der Server
// ist Autoritaet fuer alles, was Kern, Verteidigung und Garnison hebt. Gerechnet wird hier nur,
// welches Stueck FEHLT - das ist Auskunft, keine Regel (Pruefung 0b haelt das fest).
//
// Gegenprobe: siehe Fuss der Datei.
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check, ende } = pruefer();

const src = fs.readFileSync(SPIELDATEI, 'utf8');
const ICH = 'u-ich';
const SYS = 'vega';
const ohneKommentar = t => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, '');

/* 0c: DIE ZWEIGWAHL NENNT DEN STECKPLATZ. Sie laeuft ueber `prompt`, laesst sich also im Browser
   nur ueber einen Klick auf „Ausbauen" auf genau der Wahlstufe messen; die Regel ist eine reine
   Textregel, deshalb hier am Quelltext. Die Wahl gilt fuer immer - und seit V7 entscheidet sie
   mit, wie viele Module die Station traegt (Befund der Durchsicht 05.09.2026, dieselbe Luecke wie
   bei der Schiffsbauzeit in V2). */
check('0c: die einmalige Ausrichtungswahl nennt den Steckplatz-Zuschlag',
  /vorpostenCache\.modulSetsAktiv && \(\(vorpostenCache\.zweigSlots \|\| \{\}\)\[va\.zweig\] \|\| 0\) > 0/.test(src)
  && /Steckplatz – nur hier ist die Sternwacht/.test(src));
check('0d: der Zusatzplatz wird aus `v.slots` gerechnet, nicht aus der Tabelle daneben',
  /const zusatzPlatz = Math\.max\(0, slots - leiterPlatz\);/.test(src));
check('0a: das Spiel haelt KEINE eigene Set-Tabelle - sie kommt vom Server',
  /function vpSetDefs\(\)\{ return vorpostenCache\.modulSetsAktiv \? \(vorpostenCache\.modulSetDefs \|\| \[\]\)/.test(src)
  && !/const VP_MODUL_SET_DEFS = \[/.test(src) && !/const VP_ZWEIG_SLOTS = /.test(src));
{
  /* Kommentare vorher streichen: der erklaerende Text an dieser Stelle nennt `v.sets` selbst
     (Lehre 0d aus test_vorposten_verbuendet_ui). */
  const von = src.indexOf('function vpSetStand(');
  const rumpf = von < 0 ? '' : ohneKommentar(src.slice(von, src.indexOf('\n  }', von)));
  check('0-anker: vpSetStand ist lesbar (sonst misst 0b nichts)', von > 0 && rumpf.length > 120, { laenge: rumpf.length });
  check('0b: ob ein Set STEHT, sagt der Server - nachgerechnet wird nur, was fehlt',
    /v && v\.sets/.test(rumpf) && /erfuellt: stehen\.has\(def\.key\)/.test(rumpf)
    && !/teile\.every/.test(rumpf), { auszug: rumpf.slice(0, 200).replace(/\s+/g, ' ') });
}

const now = Date.now();
const MODUL_DEFS = [
  { key:'kernpanzer', name:'Kernpanzerung', icon:'ti-shield', wirkung:'kern', basis:0.08, desc:'Verstärkt den Kern der Station.' },
  { key:'geschuetz', name:'Geschützbank', icon:'ti-sword', wirkung:'verteidigung', basis:0.10, desc:'Zusätzliche Geschütze.' },
  { key:'hangar', name:'Hangarerweiterung', icon:'ti-rocket', wirkung:'garnison', basis:0.12, desc:'Mehr Liegeplätze.' },
  { key:'sprungrechner', name:'Sprungrechner', icon:'ti-atom-2', wirkung:'flug', basis:0.15, desc:'Rechnet Sprungbahnen vor.' },
  { key:'raffinerie', name:'Umlaufraffinerie', icon:'ti-building-factory-2', wirkung:'prod', basis:0.15, desc:'Verarbeitet im Orbit.' },
  { key:'horchposten', name:'Horchposten', icon:'ti-antenna-bars-5', wirkung:'scan', basis:1, desc:'Lauscht weiter ins System.' }
];
const SET_DEFS = [
  { key:'trutzring', name:'Trutzring', icon:'ti-shield', teile:['kernpanzer','geschuetz'],
    boni:{ kern:0.10, verteidigung:0.10 }, desc:'Kernpanzerung und Geschützbank greifen ineinander.' },
  { key:'flottenbasis', name:'Flottenbasis', icon:'ti-rocket', teile:['hangar','sprungrechner'],
    boni:{ garnison:0.10, flug:0.03 }, desc:'Liegeplätze und Sprungbahnen aus einer Hand.' },
  /* SECHS TEILE - das Set, das mehr Steckplaetze verlangt, als die meisten Stationen haben. Ohne
     eines dieser Art koennte 2d („nennt den Grund statt einer Fehlliste") gar nicht messen. */
  { key:'sternwacht', name:'Sternwacht', icon:'ti-antenna-bars-5',
    teile:['kernpanzer','geschuetz','hangar','sprungrechner','raffinerie','horchposten'],
    boni:{ kern:0.10, verteidigung:0.10, garnison:0.10 }, desc:'Alle sechs Systeme laufen zusammen.' }
];
const SELTENHEITEN = { gewoehnlich:{ label:'Gewöhnlich', mult:1.0 }, ungewoehnlich:{ label:'Ungewöhnlich', mult:1.4 }, selten:{ label:'Selten', mult:2.0 }, episch:{ label:'Episch', mult:2.8 }, legendaer:{ label:'Legendär', mult:4.0 } };
const STUFEN = [1,2,3,4,5,6,7,8].map(s => ({ stufe:s, name:'Stufe '+s, kernLp:20000*s, verteidigung:2500*s, garnisonMax:300*s, flug:0.06, prod:0.015, scan:1, kosten: s===1?null:{ erz:1000 } }));
/* DIE VORLAGE FUEHRT NUR FELDER, DIE vorpostenFuerClient WIRKLICH SCHICKT - `sets` und `setBoni`
   sind am Sender abgelesen (Backend #245), nicht aus dem Konzeptpapier. Eine Vorlage, die ein Feld
   erfindet, prueft nur sich selbst (Lehre vom 05.09.2026, docs/TESTING.md). */
const vp = { id:'vp1', sys:SYS, besitzer:ICH, besitzerName:'Ich', seit: now-86400000, stufe:8, name:'Sternenfestung',
  zweig:'festung', zweigName:'Festungsring', maxStufe:8, kern:{ lp:900000, lpMax:1000000 }, verteidigung:250000,
  garnisonAnzahl:0, garnisonMax:4800, garnison:{}, schutzBis:0, ausbauAb: now-1000,
  nutzen:{ flug:0.15, prod:0.04, scan:4 }, eigener:true, meinLetzterSchlag:0, letzterKampf:null,
  slots:6, module:['kernpanzer:selten','geschuetz:episch','hangar:gewoehnlich'],
  modulBoni:{ kern:0.16, verteidigung:0.28, garnison:0.12, flug:0, prod:0, scan:0 },
  sets:['trutzring'], setBoni:{ kern:0.10, verteidigung:0.10, garnison:0, flug:0, prod:0, scan:0, werft:0, markt:0 },
  naechsteStufe:null };
function spielstand(){
  const g = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil','sammlung']) g[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:g, activeEvent:{ key:'__testruhe__', bis: now+9e8 },
    resources:{ energie:9e5, erz:9e5, kristalle:6e5, deuterium:4e5, antimaterie:9e4, forschungspunkte:3e4 },
    buildings:{ solar:22, mine:20, labor:14, lager:60, werft:14 }, research:{}, fleet:{ jaeger:80, cruisers:12, missions:[] },
    colonies:{}, discovered:{}, activeBasePlanet:'home', player:{ id:ICH, name:'Ich' }, xp:9e5, credits:5000, buffs:[],
    lastTick: now, colonyNames:{}, modules:{}, shipModules:{}, nextPlanetEventCheck: now+36e5, nextTraderCheck: now+36e5,
    weeklySystemsSeen:14, schubGesehen:true, lastSeenReportTime: now });
}

(async () => {
  const browser = await starteBrowser();
  async function messe(opt){
    const o = opt || {};
    const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    const st = { ['leaderboard:'+ICH]: JSON.stringify({ id:ICH, name:'Ich', score:9000, ships:20, bp:9, lastSeen:now, ownedPlanets:[] }), 'kepler7-save-v3': spielstand() };
    const doc = Object.assign({}, vp, o.vp || {});
    await page.route('**/api/**', async r => {
      const req = r.request(), u = req.url(), p = u.split('/api/')[1].split('?')[0];
      const j = (x, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(x) });
      if (p === 'health') return j({ ok:true });
      if (p === 'me') return j({ userId:ICH, username:'Ich', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
      if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null, unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[], alienNester:[], controlledSystems:{}, wrackKonvois:[] });
      if (p === 'vorposten') return j({ ok:true, aktiv:true, bauAktiv:true, maxJeKonto:3, schutzMs:43200000, abklingMs:14400000, ausbauMs:43200000,
        garnisonFaktor:0.5, stufen:STUFEN, zweige:[{ key:'festung', name:'Festungsring', kurz:'Hält Systeme.', namen:{8:'Sternenfestung'}, mult:{} }],
        zweigAb:4, maxStufe:8, modulDefs:MODUL_DEFS, modulSeltenheiten:SELTENHEITEN, modulBaubar:['gewoehnlich','ungewoehnlich'],
        modulAusbauKosten:250, modulBauAbklingMs:21600000, modulBestand:{ 'sprungrechner:selten':1 }, modulBauAb:0,
        zweigAb:4,
        /* DIE TABELLE REIST IMMER MIT - auch bei liegendem Schalter. So macht es der Server
           (`modulSetDefs: VP_MODUL_SET_DEFS` steht dort unbedingt, nur `modulSetsAktiv` haengt am
           Schalter). Die erste Fassung liess sie bei ausgeschaltetem Schalter weg; damit konnte
           4a einen Client, der den Schalter IGNORIERT, gar nicht mehr erkennen - es gab ja nichts
           zu zeigen. Gemessen am 05.09.2026: Sabotage E fiel deshalb ins Leere. */
        modulSetDefs: SET_DEFS,
        modulSetsAktiv: o.setsAktiv !== false,
        zweigSlots: { werft:0, handel:0, festung:1 },
        projektDefs:[], projekteAktiv:false, lagerAktiv:false, allianzAktiv:false,
        liste:[doc], eigene:1 });
      if (p === 'asteroid/field') return j({ systeme:[], felder:{} });
      if (p === 'reports') return j(req.method() === 'POST' ? { ok:true } : { reports:[] });
      if (p === 'players-map') return j({ players:[] });
      if (p === 'pending-rewards/claim') return j({ reward:null });
      if (p === 'chat/global' || p === 'chat/allianz') return j({ ok:true, nachrichten:[], neuesteTs:0 });
      if (p === 'storage-list'){ const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]); return j({ keys: Object.keys(st).filter(k => k.startsWith(pref)) }); }
      if (p.startsWith('storage/')){ const k = decodeURIComponent(p.slice(8)); if (req.method() === 'PUT'){ try { st[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true, version:2 }); } if (st[k] !== undefined) return j({ key:k, value:st[k], version:1 }); return j({ error:'nicht gefunden' }, 404); }
      return j({ ok:true });
    });
    await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); window.confirm = () => true; });
    await page.goto(SPIEL_URL); await page.waitForTimeout(6000);
    await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const x = document.getElementById(id); if (x) x.style.display='none'; }));
    await page.evaluate(() => { const x = document.querySelector('.tab-btn[data-tab="karte"]'); if (x) x.click(); });
    await page.waitForTimeout(800);
    await oeffneSystemUeberSektoren(page, SYS);
    await page.waitForTimeout(1200);
    await page.evaluate(() => { const n = document.querySelector('[data-map-vorposten]'); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles:true })); });
    /* Der Container heisst `.kmenu` - KEIN Rueckfall auf document.body: Dessen textContent enthaelt
       den <script>-Block, also den Quelltext, und jede Textpruefung waere vacuous. */
    await page.waitForFunction(() => {
      const m = document.querySelector('.kmenu');
      return m && /Steckplätze/.test(m.textContent || '');
    }, null, { timeout: 20000 }).catch(() => {});
    const menue = await page.evaluate(() => {
      const m = document.querySelector('.kmenu');
      if (!m) return { text: null, sets: null };
      const z = m.querySelector('[data-vp-sets]');
      return { text: (m.textContent || '').replace(/\s+/g, ' ').trim(), sets: z ? Number(z.getAttribute('data-vp-sets')) : null };
    });
    await page.evaluate(() => { const b = [...document.querySelectorAll('.kmenu button')].find(x => /Steckplätze/.test(x.textContent)); if (b) b.click(); });
    await page.waitForFunction(() => {
      const o = document.getElementById('vorpostenModulOverlay');
      return o && o.classList.contains('open');
    }, null, { timeout: 20000 }).catch(() => {});
    const fenster = await page.evaluate(() => {
      const o = document.getElementById('vorpostenModulOverlay');
      if (!o) return { offen:false, text:null, sets:[], ohnePlatz:0, raus:[] };
      return { offen: o.classList.contains('open'), text: (o.textContent || '').replace(/\s+/g, ' ').trim(),
        sets: [...o.querySelectorAll('[data-vp-set]')].map(n => ({ key: n.getAttribute('data-vp-set'),
          voll: n.getAttribute('data-vp-set-voll') === '1', zugross: n.getAttribute('data-vp-set-zugross') === '1' })),
        ohnePlatz: o.querySelectorAll('[data-vp-ohne-platz]').length,
        raus: [...o.querySelectorAll('[data-vp-modul-raus]')].map(b => b.getAttribute('data-vp-modul-raus')) };
    });
    await ctx.close();
    return { menue, fenster, errs };
  }

  const an = await messe({});
  check('1-anker: Boot ohne Skriptfehler, Menue und Steckplatz-Fenster sind offen',
    an.errs.length === 0 && typeof an.menue.text === 'string' && an.menue.text.length > 40
    && an.menue.text.length < 20000 && an.fenster.offen === true,
    { errs: an.errs.slice(0, 2), laenge: an.menue.text === null ? null : an.menue.text.length });
  check('1a: die Stationstafel nennt die stehenden Sets beim Namen',
    an.menue.sets === 1 && /Sets: Trutzring/.test(an.menue.text) && !/Flottenbasis/.test(an.menue.text),
    { sets: an.menue.sets, auszug: (an.menue.text.match(/Sets:[^·]*/) || [])[0] });
  check('1b: und den sechsten Steckplatz samt seiner Herkunft',
    /3 von 6 Steckplätzen belegt/.test(an.fenster.text) && /dazu 1 durch deine Ausrichtung/.test(an.fenster.text),
    { auszug: (an.fenster.text.match(/\d von \d Steckplätzen[^.]*\./) || [])[0] });
  check('2-anker: alle drei Sets der Tabelle stehen im Fenster', an.fenster.sets.length === SET_DEFS.length,
    { sets: an.fenster.sets, erwartet: SET_DEFS.length });
  check('2a: das stehende Set ist als solches gekennzeichnet und nennt seinen Bonus',
    an.fenster.sets.some(x => x.key === 'trutzring' && x.voll)
    && /Trutzring steht/.test(an.fenster.text) && /\+10% Kern · \+10% Verteidigung/.test(an.fenster.text),
    { auszug: (an.fenster.text.match(/Trutzring[^·]*·[^–]*/) || [])[0] });
  check('2b: das offene Set nennt, WELCHES Stueck noch fehlt',
    an.fenster.sets.some(x => x.key === 'flottenbasis' && !x.voll)
    && /Es fehlt noch Sprungrechner\./.test(an.fenster.text) && !/Flottenbasis steht/.test(an.fenster.text),
    { auszug: (an.fenster.text.match(/Flottenbasis[\s\S]{0,140}/) || [])[0] });
  check('2c: jedes Set zeigt seine Beschreibung - sonst reist sie umsonst mit',
    /Kernpanzerung und Geschützbank greifen ineinander/.test(an.fenster.text)
    && /Liegeplätze und Sprungbahnen aus einer Hand/.test(an.fenster.text),
    { auszug: (an.fenster.text.match(/Trutzring[\s\S]{0,180}/) || [])[0] });
  /* 2d: DIE STATION HAT SECHS PLAETZE, die Sternwacht ist also erreichbar - hier wird nur die
     Fehlliste geprueft, den Grund-Zweig misst 6a am Vorposten mit fuenf Plaetzen. */
  check('2d: ein erreichbares Set zaehlt seine fehlenden Stuecke mit Komma auf, nicht mit „und und"',
    /Es fehlt noch Sprungrechner, Umlaufraffinerie und Horchposten\./.test(an.fenster.text)
    && !/und Umlaufraffinerie und/.test(an.fenster.text),
    { auszug: (an.fenster.text.match(/Sternwacht[\s\S]{0,200}/) || [])[0] });
  /* 3a: Der Server ist Autoritaet. Steht ein Set in `v.sets`, ohne dass die eingebauten Module es
     hergeben, zeigt das Spiel es TROTZDEM - es rechnet nicht nach. Das ist die Probe darauf, dass
     hier keine zweite Rechenstelle entstanden ist. */
  const fremd = await messe({ vp: { sets: ['trutzring', 'flottenbasis'] } });
  check('3a: das Spiel folgt `v.sets` und rechnet nicht selbst nach',
    fremd.fenster.sets.filter(x => x.voll).length === 2 && /Sets: Trutzring, Flottenbasis/.test(fremd.menue.text),
    { sets: fremd.fenster.sets, auszug: (fremd.menue.text.match(/Sets:[^·]*/) || [])[0] });
  /* 6: EINE STATION MIT ZU WENIG PLAETZEN. Zwei Dinge auf einmal, beide aus der Durchsicht:
     Die Sternwacht darf ihr keine Fehlliste vorhalten (sie kann sie nie erreichen), und das
     sechste Modul, fuer das es keinen Steckplatz gibt, muss trotzdem sichtbar und ausbaubar
     bleiben - es gehoert dem Besitzer, und der Server gibt es heraus. */
  const eng = await messe({ vp: { slots: 5, sets: ['trutzring', 'flottenbasis'],
    module: ['kernpanzer:selten','geschuetz:episch','hangar:gewoehnlich','sprungrechner:selten','raffinerie:selten','horchposten:selten'] } });
  check('6-anker: auch der Lauf mit zu wenig Plaetzen hat das Fenster geoeffnet', eng.fenster.offen === true,
    { offen: eng.fenster.offen });
  check('6a: ein Set, das mehr Plaetze braucht, nennt den GRUND statt einer Fehlliste',
    eng.fenster.sets.some(x => x.key === 'sternwacht' && x.zugross)
    && /Braucht 6 Steckplätze – du hast 5\./.test(eng.fenster.text)
    && !/Es fehlt noch Horchposten/.test(eng.fenster.text),
    { sets: eng.fenster.sets, auszug: (eng.fenster.text.match(/Sternwacht[\s\S]{0,140}/) || [])[0] });
  check('6b: das Modul ohne Steckplatz bleibt sichtbar, sagt warum es nicht wirkt, und ist ausbaubar',
    eng.fenster.ohnePlatz === 1 && /Kein Steckplatz mehr dafür/.test(eng.fenster.text)
    && eng.fenster.raus.includes('5'),
    { ohnePlatz: eng.fenster.ohnePlatz, raus: eng.fenster.raus });

  // 4: liegt der Schalter, gibt es die Anzeige nicht - und der Zusatzplatz wird nicht behauptet.
  const aus = await messe({ setsAktiv: false, vp: { slots: 5, sets: [] } });
  check('4-anker: auch der Lauf mit liegendem Schalter hat das Fenster geoeffnet', aus.fenster.offen === true,
    { offen: aus.fenster.offen });
  check('4a: mit liegendem Schalter gibt es weder Set-Abschnitt noch Set-Zeile',
    aus.fenster.sets.length === 0 && aus.menue.sets === null && !/Sets:/.test(aus.menue.text)
    && !/durch deine Ausrichtung/.test(aus.fenster.text),
    { sets: aus.fenster.sets, zeile: aus.menue.sets, auszug: aus.fenster.text.slice(0, 120) });
  const alle = [...an.errs, ...fremd.errs, ...aus.errs, ...eng.errs];
  check('5a: kein JavaScript-Fehler in den vier Durchlaeufen', alle.length === 0, alle.slice(0, 3));

  await browser.close();
  ende();
})().catch(e => { console.log('FAIL - Ausnahme: ' + (e && e.stack || e)); process.exit(1); });

/* GEGENPROBE, fuenf Richtungen gemessen am 05.09.2026 (Pruefnamen beider Laeufe per `diff`).

   A+D (ein Lauf, zwei verschiedene Stellen): Set-Abschnitt im Fenster abgeschaltet UND
       `zusatzPlatz` fest auf 0 -> 1b, 2-anker, 2a, 2b UND 3a fallen. 3a gehoert zu A: Ohne den
       Abschnitt gibt es keine `[data-vp-set]`-Zeilen mehr, die es lesen koennte.
   B   `vpSetStand` rechnet selbst nach (`teile.every`) statt `v.sets` zu glauben -> 0b und 3a
       fallen, sonst nichts. Das ist die Probe darauf, dass hier keine zweite Rechenstelle fuer
       einen PvP-Wert entstanden ist.
   C   Die Set-Zeile in der Stationstafel entfernt -> 1a und 3a fallen.
   E   `vpSetDefs` ignoriert `modulSetsAktiv` -> 0a und 4a fallen.

   EIN EIGENER MESSFEHLER, hier festgehalten: Sabotage E fiel im ersten Anlauf INS LEERE. Die
   Vorlage liess `modulSetDefs` bei liegendem Schalter weg - der Server schickt die Tabelle aber
   IMMER, nur `modulSetsAktiv` haengt am Schalter. Ein Client, der den Schalter ignoriert, haette
   in dieser Vorlage schlicht nichts anzuzeigen gehabt, und 4a blieb gruen. Wieder dieselbe Lehre:
   Eine Vorlage muss den echten Sender nachbilden, sonst prueft sie sich selbst. */
