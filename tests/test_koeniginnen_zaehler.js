// KS-2: Der Königinnen-Zähler - die einzige Bedrohung, die man kommen sieht.
//
//   node tests/test_koeniginnen_zaehler.js
//
// DIE REGEL STEHT IM SERVER: Ab `NEST_KOENIGIN_AB = 4` Nestern eines Volkes schluepft die
// Koenigin am AELTESTEN (nach `seit`). Sie haelt 4.000.000 Lebenspunkte. Bis heute sah der
// Spieler sie erst, wenn sie da war - dabei liegen die Daten laengst im Client: Jede Nest-Nutzlast
// fuehrt `volk` und `seit`.
//
// GEPRUEFT WIRD DIE REGEL, in beide Richtungen:
//   1a  Bei drei Nestern eines Volkes nennt das Kartenmenue den Stand „3 von 4" und das SYSTEM,
//       in dem sie schluepfen wird - das aelteste, nicht das staerkste.
//   1b  Am Thronnest steht der Zaehler auch AUF DER KARTE, nicht nur im Titel: Auf dem Handy gibt
//       es keinen Tooltip.
//   1c  Ist die Koenigin schon da, sagt der Text das - und zaehlt nicht weiter.
//   2a  DER SATZ, DER NICHT DASTEHEN DARF: „breitet sich nicht weiter aus" o.ae. Der Kommentar im
//       Server verspricht das, sein Code nicht - der Ausbreitungsfilter lautet
//       `if (!v || !(v.ausbreitMult > 0) || n.stufe < 3) continue;` und kennt keine Koenigin;
//       Stufe 5 ist groesser als 3. Ein Versprechen ohne Code gehoert nicht in die Anzeige, und
//       diese Pruefung haelt das fest, damit es nicht spaeter „der Vollstaendigkeit halber"
//       hineinwandert.
//   2b  Das AELTESTE zaehlt, nicht das staerkste. Gemessen mit einer Vorlage, in der beide
//       auseinanderfallen - sonst waere 1a auch mit der falschen Regel gruen.
//   3a  ZWEI VOELKER IM SELBEN SYSTEM (Befund der Durchsicht an PR #614): Der Zaehler wird fuer
//       JEDES Volk gerechnet, nicht nur fuer das des staerksten Nestes. Steht hier das Thronnest
//       der Verglühten bei 3 von 4 und daneben ein hoeherstufiges Nest der Nomaden von Vex, waehlte
//       die erste Fassung das zweite - und die Warnung verschwand ausgerechnet am bedrohten
//       Thronsystem. Gezeigt wird das DRAENGENDSTE Volk, also das mit dem kleinsten Rest.
//       Der Server erzeugt diesen Zustand heute nicht (`nestSystemFrei` lehnt ein belegtes System
//       ab); der Client ist aber seit jeher fuer mehrere Nester je System geschrieben und zaehlt
//       sie im Titel ausdruecklich. Geprueft wird also der Client, nicht der Server.
//
// GEGENPROBE 1: `KEPLER_SPIELDATEI` auf den Stand vor KS-2, Aufruf mit KEPLER_KOENIGIN_GEGENPROBE=alt.
// Dort fallen 1a, 1b, 1c, 2b und 3a - den Zaehler gibt es nicht. 2a bleibt gruen (der falsche Satz
// stand auch vorher nirgends) und ist damit kein Beleg fuer KS-2, sondern der Waechter dagegen.
// GEGENPROBE 2: `KEPLER_SPIELDATEI` auf den Stand VOR der Mehrvolk-Rechnung (Commit 3b9a794),
// Aufruf mit KEPLER_KOENIGIN_GEGENPROBE=voelker. Dort faellt genau 3a.
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { oeffneSektorMitSystem } = require('./lib/karte');
const { check, ende } = pruefer();
const ergebnis = {};
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };

const SAB = process.env.KEPLER_KOENIGIN_GEGENPROBE || '';
const MUSS_FALLEN = { alt: ['1a', '1b', '1c', '2b', '3a'], voelker: ['3a'] };
const now = Date.now();

/* DREI Nester EINES Volkes. Das AELTESTE (`seit` am kleinsten) steht in `vega`, das STAERKSTE
   (hoechste Stufe) in `kepler` - beide fallen bewusst auseinander, sonst waere 2b nicht messbar
   und 1a auch mit der falschen Regel gruen. */
const NESTER_DREI = [
  { id:'n-alt',   sys:'vega',   volk:'verglueht', stufe:2, lp:15000, lpMax:20000, seit: now - 5*864e5, letzteReifung: now - 864e5 },
  { id:'n-mitte', sys:'kepler', volk:'verglueht', stufe:4, lp:60000, lpMax:80000, seit: now - 2*864e5, letzteReifung: now - 864e5 },
  { id:'n-jung',  sys:'rhea',   volk:'verglueht', stufe:1, lp:8000,  lpMax:10000, seit: now - 1*864e5, letzteReifung: now - 864e5 }
];
/* Dieselbe Lage plus ein STAERKERES Nest eines ZWEITEN Volkes im selben System vega. `stark` -
   das staerkste Nest des Systems - ist damit das der Nomaden von Vex (Stufe 4 gegen Stufe 2), das
   draengende Volk bleiben aber die Verglühten (3 von 4 gegen 1 von 4). */
const NESTER_ZWEI_VOELKER = NESTER_DREI.concat([
  { id:'n-vex', sys:'vega', volk:'vex', stufe:4, lp:60000, lpMax:80000, seit: now - 3*864e5, letzteReifung: now - 864e5 }
]);
/* Dieselbe Lage, aber die Koenigin ist schon da (Stufe 5 am aeltesten). */
const NESTER_KOENIGIN = NESTER_DREI.map((n, i) => Object.assign({}, n,
  i === 0 ? { stufe:5, lp:3.5e6, lpMax:4e6 } : {}));

let nester = NESTER_DREI;

function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0 });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, unlockedAlienRaces:[],
      collapsedSystems:{}, activeWormhole:null, activePirateFaction:null, activeWar:null,
      news:[], controlledSystems:{}, factions:{}, alienNester: nester, wrackKonvois: [] });
    if (p.startsWith('storage/')){
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
      if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
      return j({ e:1 }, 404);
    }
    return j({});
  };
}

async function oeffnen(page){
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
     'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.remove(); });
    const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click();
  });
  await page.waitForTimeout(1200);
  await oeffneSektorMitSystem(page, 'vega');
  await page.waitForTimeout(1200);
}

/* Liest das Nestmenue des Systems und den Kartenzaehler. Das Menue oeffnet der Nest-MARKER der
   Systemebene; in der Sektoransicht gibt es nur das Abzeichen. Gemessen wird deshalb beides
   getrennt: der Zaehler am Abzeichen (Sektoransicht) und der Satz im Menue (Systemebene). */
async function karteMessen(page){
  return page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    if (!svg) return { svg:false };
    const g = svg.querySelector('[data-sektor-sys="vega"]');
    const eigen = t => { const l = t.lastChild; return (l && l.nodeType === 3) ? l.nodeValue.trim() : ''; };
    const zaehler = g ? [...g.querySelectorAll('[data-kb-schwarm]')].map(t => eigen(t)) : [];
    const titel = g ? [...g.querySelectorAll('title')].map(t => t.textContent) : [];
    return { svg:true, knoten:!!g, zaehler, titel };
  });
}

(async () => {
  const browser = await starteBrowser();
  const store = {};
  store['kepler7-save-v3'] = JSON.stringify({
    tutorialSeen:true, newbieWelcomeSeen:true,
    resources:{ energie:48000, erz:52000, kristalle:31000, deuterium:20000, antimaterie:900, forschungspunkte:2200 },
    buildings:{ solar:18, mine:17, kristallmine:15, labor:10, lager:12, werft:9 },
    research:{}, fleet:{ jaeger:400, cruisers:60, ships:3, missions:[] },
    discovered:{}, colonies:{}, activeBasePlanet:'home',
    player:{ id:'u', name:'A' }, xp:52000, credits:184000, buffs:[], lastTick: now,
    colonyNames:{}, colonyNotes:{}, activeEvent:null,
    nextPlanetEventCheck: now + 36e5, nextTraderCheck: now + 36e5, nextRaidTime: now + 36e5
  });

  const ctx = await browser.newContext({ viewport:{ width:390, height:844 } });
  const page = await ctx.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));

  await oeffnen(page);
  const m1 = await karteMessen(page);
  merke('0a: der Knoten vega steht in der Sektoransicht', m1.knoten === true, { svg: m1.svg });

  /* GENAU DER TITEL DES SCHWARM-SATZES, nicht alle zusammen. Die Gruppe traegt mehrere <title> -
     den des Knotens („Vega-System"), den des Dominanzrings, den des Abzeichens. Der erste Treffer
     auf „Verglühten" war der des Rings und damit gar nicht der gemessene Text; ein Blob aus allen
     dagegen liess 2b am ALTEN Stand gruen bleiben, weil „Vega-System" dort ohnehin vorkommt.
     Gesucht wird deshalb der Satz selbst - fehlt er, ist der Titel leer und die Pruefung faellt,
     statt aus dem falschen Grund gruen zu sein. */
  const schwarmTitel = (m1.titel || []).find(t => /von 4 Nestern|bereits geschlüpft/.test(t)) || '';
  const nestTitel = schwarmTitel;
  merke('1a: der Stand steht am Nest-Abzeichen - drei von vier, und WO sie schluepft',
    /3 von 4 Nestern/.test(nestTitel) && /Vega-System/.test(nestTitel),
    { titel: nestTitel });
  merke('1b: am Thronnest steht der Zaehler auch sichtbar auf der Karte',
    (m1.zaehler || []).some(z => z === '3/4'), { zaehler: m1.zaehler });
  merke('2b: gezaehlt wird das AELTESTE, nicht das staerkste (Stufe 4 steht in kepler)',
    /Vega-System/.test(nestTitel) && !/Kepler-System/.test(nestTitel),
    { titel: nestTitel });

  // ---- Zwei Voelker im selben System -----------------------------------------------------------
  nester = NESTER_ZWEI_VOELKER;
  await oeffnen(page);
  const m3 = await karteMessen(page);
  const schwarmTitel3 = (m3.titel || []).find(t => /von 4 Nestern|bereits geschlüpft/.test(t)) || '';
  /* DREI Bedingungen, weil zwei davon einzeln nichts belegen: Der Titel muss vom staerksten Nest
     stammen (Nomaden von Vex), der Schwarm-Satz von den Verglühten, und der Zaehler auf der Karte
     muss deren Stand tragen. Ohne die erste Bedingung waere die Pruefung auch dann gruen, wenn das
     zweite Volk gar nicht im Bild ist - und misst dann nur noch einmal 1a. */
  merke('3a: bei zwei Voelkern im System zaehlt das draengende, nicht das staerkste Nest',
    /Nomaden von Vex/.test(schwarmTitel3) && /Verglühten: 3 von 4 Nestern/.test(schwarmTitel3)
      && (m3.zaehler || []).some(z => z === '3/4'),
    { titel: schwarmTitel3, zaehler: m3.zaehler });

  // ---- Die Koenigin ist schon da ---------------------------------------------------------------
  nester = NESTER_KOENIGIN;
  await oeffnen(page);
  const m2 = await karteMessen(page);
  const koeniginTitel = (m2.titel || []).find(t => /von 4 Nestern|bereits geschlüpft/.test(t)) || '';
  merke('1c: ist sie geschluepft, sagt der Text das - und zaehlt nicht weiter',
    /bereits geschlüpft/.test(koeniginTitel) && !/von 4 Nestern/.test(koeniginTitel),
    { titel: koeniginTitel });
  merke('1d: und der Zaehler verschwindet dann', (m2.zaehler || []).length === 0, { zaehler: m2.zaehler });

  /* 2a: DER SATZ, DER NICHT DASTEHEN DARF. Gemessen am QUELLTEXT und nicht am Bild: Er soll auch
     dort nicht auftauchen, wo dieser Lauf gerade nicht hinsieht. Gesucht wird in der Naehe der
     Koenigin-Texte, nicht in der ganzen Datei - „breitet sich aus" ist ein gewoehnlicher Satz. */
  const fs2 = require('fs');
  const quelle = fs2.readFileSync(process.env.KEPLER_SPIELDATEI || require('./lib/umgebung').SPIELDATEI, 'utf8');
  const vonKoenig = quelle.indexOf('function nestSchwarmSatz');
  const block = vonKoenig >= 0 ? quelle.slice(vonKoenig, vonKoenig + 2500) : '';
  merke('2a: die Anzeige verspricht NICHT, dass das Volk aufhoert sich auszubreiten',
    !/hört (das Volk )?auf,? sich auszubreiten|breitet sich (dann |ab da )?nicht (mehr )?weiter aus|Der Schwarm sammelt sich/i.test(block),
    { gefunden: (block.match(/aus(breit|zubreiten)[^\n]{0,60}/g) || []).slice(0, 3), blockDa: vonKoenig >= 0 });

  merke('2c: keine Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  await browser.close();

  if (SAB){
    const soll = MUSS_FALLEN[SAB] || [];
    const gefallen = soll.filter(n => ergebnis[n] === false);
    console.log('GEGENPROBE ' + SAB + ': ' + gefallen.length + '/' + soll.length + ' gefallen (' +
      soll.map(n => n + '=' + (ergebnis[n] === false ? 'rot' : 'gruen')).join(' ') + ')');
    if (gefallen.length !== soll.length){
      console.log('FAIL - Gegenprobe unvollstaendig: ' + soll.filter(n => ergebnis[n] !== false).join(', ') + ' blieben gruen');
      process.exitCode = 1; return;
    }
    process.exitCode = 0; return;
  }
  ende();
})().catch(e => { console.error('FAIL - Abbruch:', e); process.exit(1); });
