// Die Beschriftungen der Regionsuebersicht sind am Handy LESBAR (KB-21, 22.08.2026).
//
//   node tests/test_uebersicht_schrift.js
//
// DER ANLASS IST GEMESSEN. Die vier Beschriftungen standen in SVG-NUTZERKOORDINATEN fest
// (15/10,5/10/13), waehrend die Skala am Formfaktor haengt: Am PC ergab das 11,8 px
// Schriftgroesse, am Handy 4,7. Gerendert war der Regionsname dort 7 px hoch, die zwei
// Metazeilen je 4 px - vorhanden, aber nicht lesbar. Gleichzeitig ueberlappten sich am Handy
// acht Textpaare (bei 360x640 vierzehn), weil drei Zeilen mit Konturstrich in 27 Nutzereinheiten
// gedraengt standen.
//
// WAS KB-21 AENDERT, und warum es ein PAAR ist:
//   (a) Der Faktor uF hebt jede Zeile auf mindestens KB_UEBERSICHT_MIN_PX echte Pixel und ist
//       nach unten bei 1 gedeckelt - der PC bleibt damit unveraendert. Nur beide Haelften
//       zusammen sind die Zusage: "am Handy groesser" allein waere auch von einer Aenderung
//       erfuellt, die den PC mit aufblaest und dort alles zerschiebt.
//   (b) Am schmalen Kasten faellt "N Systeme" weg. Sie ist die einzige der drei Zeilen, die der
//       Spieler auch abzaehlen kann (die Punkte stehen daneben) - und sie muss dafuer im Titel
//       und im aria-label auftauchen, sonst ist es kein Verlagern, sondern ein Loeschen.
//
// DIE SCHRANKE IN 4 IST ABSOLUT, nicht aus der Spieldatei gelesen (Arbeitsregel 75): Eine
// Prüfung, die ihren Erwartungswert aus KB_UEBERSICHT_MIN_PX zieht, laesst sich durch Aendern
// genau dieser Konstante entschaerfen. Gemessen sind es 2 Ueberlappungen bei 390x844 und 3 bei
// 360x640 - die Schranke liegt bei 4 und faengt damit jede Verschlechterung, ohne bei
// Messrauschen anzuschlagen. Am alten Stand waren es 8 bzw. 14.
//
// GEZAEHLT WERDEN ALLE TEXTPAARE, auch die innerhalb einer Region - dort liegt der Gewinn.
//
// DIE VERBLEIBENDE UEBERLAPPUNG ist NAMENTLICH als bekannte Ausnahme hinterlegt und keine
// Nachlaessigkeit: "Solmark-Reichweite" (322 Sektor-Einheiten breit) und "Obsidian-Saum" (244)
// liegen rund 200 Einheiten auseinander - zwei Beschriftungen, die zusammen breiter sind als ihr
// Abstand, ueberlappen in JEDER Position. Ein probeweise gebauter Block-Schieber brachte
// gemessen 3 auf 2 an genau einer Fensterbreite; er ist deshalb bewusst nicht eingebaut.
//
// GEGENPROBE gegen origin/main (KEPLER_SPIELDATEI): dort fallen NEUN der vierzehn - 0a, 0b, 1,
// 2a, 3a, 3b, 4a, 4b und 4c -, bei identischer Pruefliste (per diff ueber die reinen Pruefnamen
// verglichen, nicht gezaehlt: die Belege hinter dem | unterscheiden sich naturgemaess).
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const ROH = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = ROH.match(/<script>([\s\S]*)<\/script>/)[1];
const OHNE_KOMMENTARE = JS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const SAVE_KEY = 'kepler7-save-v3';

check('0a: die Mindestgroesse steht als benannte Konstante',
  /const KB_UEBERSICHT_MIN_PX = \d+;/.test(OHNE_KOMMENTARE));
// Gescopt auf den Uebersichts-Renderer (Arbeitsregel 39) - eine Skala-Rechnung irgendwo sonst
// in der Datei belegt hier nichts.
const RENDERER = (() => {
  const i = OHNE_KOMMENTARE.indexOf('function sektorUebersichtBauen(');
  if (i < 0) return '';
  const j = OHNE_KOMMENTARE.indexOf('\n  function ', i + 30);
  return OHNE_KOMMENTARE.slice(i, j < 0 ? i + 8000 : j);
})();
check('0b-anker: der Uebersichts-Renderer ist auffindbar', RENDERER.length > 500);
check('0b: der Faktor wird aus der GEMESSENEN Skala gebildet und nie kleiner als 1',
  /const uSkala = /.test(RENDERER) && /Math\.max\(1, KB_UEBERSICHT_MIN_PX/.test(RENDERER));

function save(){
  const jetzt = Date.now();
  const gesehen = {}; for (const t of ['basis','forschung','werft','flotte','karte','galaxie','allianz','markt','fortschritt','verteidigung','module','profil']) gesehen[t] = true;
  return JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true, seenTabHints:gesehen,
    resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:9e4,forschungspunkte:3e4},
    buildings:{solar:22,mine:20,labor:14,lager:30,werft:14}, research:{}, fleet:{ jaeger:80, cruisers:30, missions:[] },
    colonies:{}, activeBasePlanet:'home', player:{ id:'u', name:'A', avatarKey:null },
    xp:9e5, credits:5e5, buffs:[], lastTick:jetzt, colonyNames:{}, modules:{}, shipModules:{},
    nextPlanetEventCheck: jetzt+3600000, nextTraderCheck: jetzt+3600000 });
}
// storageGet kehrt bei 404 ZURUECK statt auf localStorage zurueckzufallen - der Spielstand muss
// deshalb ueber die geroutete Storage-Antwort kommen, sonst bootet ein leeres Spiel.
function backend(){
  return async r => {
    const p = r.request().url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'galaxy') return j({ npcEmpireStrength:1, marketTrend:1, activePirateFaction:null,
      unlockedAlienRaces:[], activeWar:null, collapsedSystems:{}, activeWormhole:null, news:[], alienNester:[] });
    if (p === 'storage/' + SAVE_KEY) return j({ value: save(), version: 1 });
    if (p.startsWith('storage/')) return j({ e:1 }, 404);
    return j({ ok:true });
  };
}
async function messe(browser, vp){
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await page.route('**/api/**', backend());
  await page.addInitScript(([k, v]) => { localStorage.setItem('kepler7_token','tok'); localStorage.setItem('kepler7_'+k, v); }, [SAVE_KEY, save()]);
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.remove(); }));
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click(); });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const svg = document.getElementById('galaxyMapSvg');
    if (!svg) return { da:false };
    // getComputedStyle liefert an einem SVG-Text die font-size in NUTZERkoordinaten, nicht in
    // Bildschirmpixeln - genau der Unterschied, um den es in dieser Etappe geht. Die effektive
    // Groesse ist erst fontSize x Skala; ein Test, der nur die eine misst, sieht die Sache nicht.
    const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
    const skala = svg.getBoundingClientRect().width / (vb[2] || 1);
    const gruppen = [...svg.querySelectorAll('[data-sektor]')];
    // Gegriffen wird ueber die ROLLE der Zeile, nie ueber ihre Position im DOM: Der Name ist der
    // einzige Text mit system-ui, die Systemzahl der einzige, der auf " Systeme" endet.
    const namen = [], meta = [], systemzeilen = [];
    for (const g of gruppen){
      for (const t of g.querySelectorAll('text')){
        const fs = parseFloat(getComputedStyle(t).fontSize);
        const b = t.getBoundingClientRect();
        const txt = (t.textContent || '');
        // Die Abzeichenzeile setzt NUR font-size und erbt system-ui vom SVG - ein Filter auf die
        // Schriftfamilie allein traf sie mit und meldete am PC 13 px statt der 15 des Namens
        // (Arbeitsregel 51: ueber die benannte Rolle greifen, nie ueber einen Wert, den auch
        // Nachbarn tragen). Sie traegt als einzige data-sektor-hinweise.
        if (t.hasAttribute('data-sektor-hinweise')) continue;
        if (/system-ui/.test(getComputedStyle(t).fontFamily)) namen.push({ fs, h:b.height, txt });
        else if (/^\d+ Systeme$/.test(txt)) systemzeilen.push(txt);
        else meta.push({ fs, h:b.height, txt });
      }
    }
    // ALLE Textpaare, auch die INNERHALB einer Region. Ein erster Entwurf zaehlte nur Paare
    // zwischen verschiedenen Regionen und war deshalb am alten Stand genauso gruen (dort wie
    // hier 2) - eine Pruefung ohne Aussage (Arbeitsregel 28). Der gemessene Gewinn von KB-21
    // liegt genau innerhalb der Regionen: Bei 4 px Schrift ist der Konturstrich (3
    // Nutzereinheiten) fast so breit wie die Glyphen, und die drei Zeilen in 27 Einheiten
    // Abstand fressen einander an - das ist der graue Matsch des Ausgangsbilds, nicht ein
    // Messartefakt.
    const alleTexte = [];
    for (const g of gruppen) for (const t of g.querySelectorAll('text')){
      const b = t.getBoundingClientRect();
      alleTexte.push({ txt:(t.textContent||'').slice(0,24), l:b.left, tp:b.top, w:b.width, h:b.height });
    }
    const koll = [];
    for (let i = 0; i < alleTexte.length; i++) for (let j = i+1; j < alleTexte.length; j++){
      const a = alleTexte[i], b = alleTexte[j];
      if (a.l < b.l+b.w && b.l < a.l+a.w && a.tp < b.tp+b.h && b.tp < a.tp+a.h) koll.push(a.txt + ' / ' + b.txt);
    }
    const erste = gruppen[0];
    // Die Abzeichenzeile wandert mit der Schrift - ihr Trefferfeld muss den Tap weiterhin
    // bekommen (Arbeitsregel 53: wer verschiebt, misst die neue Stelle mit).
    let tipp = null;
    const zeile = svg.querySelector('[data-sektor-hinweise-treffer]');
    if (zeile){
      zeile.scrollIntoView({ block:'center' });
      const rc = zeile.getBoundingClientRect();
      const el = document.elementFromPoint(rc.left + rc.width/2, rc.top + rc.height/2);
      tipp = el ? (el.closest('[data-sektor-hinweise-treffer]') ? 'zeile' : (el.closest('[data-sektor]') ? 'region' : el.tagName)) : null;
    }
    return { da:true, gruppen:gruppen.length, skala:+skala.toFixed(3),
      nameUser: namen.length ? Math.min.apply(null, namen.map(n => n.fs)) : 0,
      nameMin: namen.length ? +(Math.min.apply(null, namen.map(n => n.fs)) * skala).toFixed(1) : 0,
      metaMin: meta.length ? +(Math.min.apply(null, meta.map(n => n.fs)) * skala).toFixed(1) : 0,
      systemzeilen: systemzeilen.length, koll,
      titel: erste ? (erste.querySelector('title') || {}).textContent || '' : '',
      aria: erste ? erste.getAttribute('aria-label') || '' : '',
      tipp };
  });
  await ctx.close();
  return r;
}

(async () => {
  const browser = await starteBrowser();
  const handy = await messe(browser, { width:390, height:844 });
  const eng   = await messe(browser, { width:360, height:640 });
  const pc    = await messe(browser, { width:1600, height:1040 });
  await browser.close();

  check('1-vorab: die Uebersicht zeichnet alle acht Regionen', handy.da && handy.gruppen === 8, { gruppen: handy.gruppen });
  // Gemessen am alten Stand: Name 4,7 px, Metazeile 3,1. Heute 9,0 und 6,0. Die Schranken sind
  // absolut und liegen zwischen beiden Staenden (Arbeitsregel 75) - die kleineren Zeilen bleiben
  // proportional kleiner als der Name, deshalb zwei verschiedene Werte.
  check('1: am Handy ist der Regionsname mindestens 8 px und die Metazeile mindestens 5 px',
    handy.nameMin >= 8 && handy.metaMin >= 5, { name: handy.nameMin, meta: handy.metaMin, skala: handy.skala });
  // Die Gegenrichtung, und sie ist die Haelfte der Zusage: Am PC ist der Faktor gemessen 0,76
  // und wird auf 1 gedeckelt - dort steht die Schrift also byte-genau wie vorher bei 15
  // Nutzereinheiten. Eine Aenderung, die den PC mit aufblaest, faellt hier.
  check('1b: am PC bleibt die Schrift, wie sie war (Faktor 1, kein Aufblasen)',
    pc.nameUser === 15, { fontSizeNutzer: pc.nameUser, effektivPx: pc.nameMin });

  check('2a: am Handy steht keine "N Systeme"-Zeile mehr', handy.systemzeilen === 0, { zeilen: handy.systemzeilen });
  check('2b: am PC steht sie weiterhin (dort ist sie lesbar)', pc.systemzeilen === 8, { zeilen: pc.systemzeilen });
  // Verlagert, nicht geloescht - sonst waere 2a eine Loeschung mit gutem Gewissen.
  check('3a: die Systemzahl steht im Titel der Region', / \d+ Systeme /.test(handy.titel), { titel: handy.titel.slice(0,80) });
  check('3b: und im aria-label', /\d+ Systeme\./.test(handy.aria), { aria: handy.aria.slice(0,80) });

  // Absolute Schranke (Arbeitsregel 75), gemessen: 2 bei 390x844 und 3 bei 360x640; am Stand
  // davor 8 bzw. 14.
  check('4a: am Handy ueberlappen hoechstens 4 Textpaare',
    handy.koll.length <= 4, { anzahl: handy.koll.length, bsp: handy.koll.slice(0,3) });
  check('4b: auch am engen Handy (360x640)',
    eng.koll.length <= 4, { anzahl: eng.koll.length, bsp: eng.koll.slice(0,3) });
  // Bekannte Ausnahme, NAMENTLICH statt pauschal ausgeblendet: Solmark-Reichweite und
  // Obsidian-Saum sind zusammen breiter als der Abstand ihrer Regionen.
  check('4c: und die verbleibenden sind die bekannte Solmark/Obsidian-Paarung',
    handy.koll.every(k => /Solmark|Obsidian/.test(k)), { rest: handy.koll });

  // null hiesse: elementFromPoint hat gar nichts getroffen (Zeile ausserhalb des Fensters) -
  // das ist KEIN Bestehen, sondern eine Messung, die nicht stattgefunden hat (Arbeitsregel 28).
  check('5: die Abzeichenzeile bekommt den Tap weiterhin (sie ist mitgewandert)',
    handy.tipp === 'zeile', { getroffen: handy.tipp });
  ende();
})();
