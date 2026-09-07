// KB-22: Der Beschriftungs-Entflechter gibt nicht mehr auf, solange ein Platz frei ist.
//
//   node tests/test_beschriftung_ausweichen.js
//
// DER FEHLERBERICHT (Sascha, 07.09.2026): "Planetenname überdeckt die Mitte eines
// Asteroiden-Vorkommens". Die naheliegende Vermutung war, dass kbLabelsEntflechten das Vorkommen
// gar nicht kennt - sein Körper ist ein <polygon>, und der Entflechter greift `image`, dann
// `circle.body`, dann den größten Kreis. GEMESSEN war es anders: Er kennt es, sieht die Kollision
// und GIBT AUF. Eine instrumentierte Kopie protokollierte wörtlich `frei=false` für beide Namen.
//
// Der Grund ist die Ausweichrichtung. Ein Planetenname steht UNTER seinem Planeten, "weg vom
// eigenen Objekt" heißt damit "weiter nach unten" - und unten liegt die Gürtelbahn. Alle sieben
// erlaubten Plätze landeten auf dem nächsten Vorkommen. Nach OBEN, über den eigenen Planeten
// hinweg, wäre der erste Schritt frei gewesen; diese Richtung probierte er nie.
//
// GEPRÜFT WIRD DIE REGEL, nicht die Momentaufnahme. Nicht "Chronos-3 liegt bei y=105,7", sondern:
//   1b  KEINE Beschriftung verdeckt die MITTE eines fremden Kartenobjekts. Die Mitte ist das, was
//       den Marker unlesbar und (vor GR-11) untippbar machte - der Rand ist Kosmetik.
//   1c  Liegt eine Beschriftung überhaupt auf einem fremden Objekt, dann ist in der GANZEN
//       Kandidatenliste kein Platz frei. Das ist die eigentliche Aussage: Aufgeben ist nur dann
//       erlaubt, wenn es nichts zu holen gibt. Die Hindernismenge hier ist ABSICHTLICH weiter als
//       die des Entflechters (alle anderen Beschriftungen statt nur der bereits gesetzten) - was
//       diese Prüfung als frei ansieht, hätte er erst recht als frei gesehen. Ein falsches Rot ist
//       damit ausgeschlossen; ein falsches Grün wäre der teurere Fehler.
//
//       DIESE PRÜFUNG WAR IM ERSTEN ENTWURF FALSCH, und der Fehler ist lehrreich genug für einen
//       Absatz: Sie rechnete die Kandidaten von der ENDLAGE aus. Der Entflechter rechnet sie aber
//       von der AUSGANGSLAGE aus - bei einer verschobenen Beschriftung sind das zwei verschiedene
//       Raster, und die Prüfung verlangte einen Platz, den er nie erreichen konnte. Sie meldete
//       prompt rot an einem Stand, der nachweislich richtig gewählt hatte (instrumentierte Kopie:
//       alle neun Lagen belegt, gewählt wurde die mit der kleinsten Überdeckung).
//       Die Ausgangslage wird deshalb GEMESSEN statt geraten: Beschriftungen derselben Objektart
//       sitzen mit demselben natürlichen Abstand an ihrem Objekt; der häufigste Abstand im Bild
//       IST dieser natürliche (die meisten Beschriftungen werden nie verschoben). Wer davon
//       abweicht, wurde um genau diese Differenz verschoben. Trägt eine Art weniger als drei
//       Beschriftungen, ist der häufigste Wert kein Beleg - dann wird sie übersprungen.
//   1d  Der seitliche Versatz bleibt im Rahmen (höchstens 12 Einheiten von der Objektmitte). Der
//       erste Entwurf von KB-16 erlaubte 42 senkrecht, und "Deine Basis" landete unter dem
//       NACHBARPLANETEN. Die Zuordnung Label->Objekt ist wichtiger als jede gelöste Kollision.
//   1e  Keine Beschriftung liegt näher an der Mitte eines FREMDEN Objekts als an der ihres eigenen.
//       Dieselbe Lehre, in der Form, die auch freistehende Beschriftungen erfasst.
//   1g  Keine überdeckte Beschriftung blieb mangels Bezugsgröße ungeprüft. Der Wächter zählt aus,
//       was er NICHT beurteilen konnte - sonst wäre 1c grün, sobald die Bezugsmessung wegfällt.
//
// GEGENPROBE: `KEPLER_SPIELDATEI` auf den Stand vor der Reparatur (`git show 890ff38:weltraum_kolonie.html`),
// Aufruf mit KEPLER_ENTFLECHTER_GEGENPROBE=alt. Die unten GEMESSENE Liste muss dort fallen.
const { starteBrowser, SPIEL_URL, ruhigeUhren, pruefer } = require('./lib/umgebung');
const { oeffneSystemUeberSektoren } = require('./lib/karte');
const { check: rohCheck, ende } = pruefer();
const ergebnis = {};
const check = (name, bedingung, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bedingung; rohCheck(name, bedingung, zusatz); };

const SAB = process.env.KEPLER_ENTFLECHTER_GEGENPROBE || '';
/* GEMESSEN gegen 890ff38 (Stand vor KB-22), nicht geschätzt. 1a fehlt hier bewusst: Es ist die
   Vorbedingung (das Gürtelsystem zeigt überhaupt genug Objekte), gilt an beiden Ständen und
   belegt nichts über die Reparatur. 1d und 1e gelten am alten Stand ebenfalls - der alte Code
   überschritt den Rahmen nie und verirrte keine Beschriftung, er blieb einfach liegen. 1g gilt
   dort ebenfalls: Die Kürzel der Vorkommen überlappen am alten Stand zwar sichtbar, aber nicht die
   GEMESSENE Fläche, an der 1c ansetzt - also gibt es dort auch nichts zu übergehen. Ein erster
   Entwurf hatte 1e und 1g mit aufgelistet; beide Male hat die Messung das widerlegt. */
const MUSS_FALLEN = { alt: ['1b', '1c'] };

const SAVE_KEY = 'kepler7-save-v3';
const SYS = 'chronos';
/* Fünf belegte Gürtelplätze im selben Bild: Der Fehler braucht DICHTE - ein einzelnes Vorkommen
   hat immer Platz daneben. Jeder Halter bringt zusätzlich sein Kürzel als eigene Beschriftung mit,
   die Beschriftungen konkurrieren also auch untereinander. Das ist genau die Lage aus dem Bericht. */
const PLAETZE = ['1', '2', '3', '4', '5'];

function serverFeld(){
  const plaetze = {};
  for (const p of PLAETZE){
    plaetze[p] = { sorte:'eisen', groesse:'brocken', vorrat:90000, halter:'x2', halterName:'Rivale',
      tag:'RIV', seit:1, eskorte:{ jaeger: 8 }, schutzBis: 0 };
  }
  return { systeme:[SYS], felder:{ [SYS]: { plaetze } } };
}
function backend(store){
  return async r => {
    const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
    const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
    if (p === 'health') return j({ ok:true });
    if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
    if (p === 'asteroid/field') return j(serverFeld());
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

/* Misst am GERENDERTEN Bild. Die Flächenwahl (image -> circle.body -> größter Kreis) ist bewusst
   dieselbe wie in kbLabelsEntflechten: Gemessen wird gegen das, was der Entflechter als belegt
   ansieht - sonst prüfte der Test eine andere Karte als die, die er beurteilt. Für die MITTE (1b)
   und die Zuordnung (1e) zählt dagegen die Gruppe als GANZES, denn das ist, was der Spieler sieht. */
async function lage(page){
  return page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find(s => s.querySelector('.planet-node'));
    if (!svg) return { fehler: 'kein SVG mit .planet-node' };
    const OBJEKTE = '.planet-node';
    const kasten = el => { try { const b = el.getBBox(); return b && b.width ? { x:b.x, y:b.y, w:b.width, h:b.height } : null; } catch(e){ return null; } };
    const flaechen = [];
    svg.querySelectorAll(OBJEKTE).forEach(g => {
      let el = g.querySelector('image') || g.querySelector('circle.body');
      if (!el){
        const kreise = [...g.querySelectorAll('circle')];
        if (kreise.length) el = kreise.reduce((a, c) => (+c.getAttribute('r') > +a.getAttribute('r') ? c : a));
      }
      if (!el) return;
      const b = kasten(el), ganz = kasten(g);
      if (!b || !ganz) return;
      flaechen.push({ nr: flaechen.length, b, ganz,
        art: [...g.attributes].map(a => a.name).filter(n => n.startsWith('data-')).join(',') });
      g.__nr = flaechen.length - 1;
    });
    const texte = [...svg.querySelectorAll('text.planet-label')];
    const labels = texte.map(t => {
      const eigen = t.closest(OBJEKTE);
      return { text:(t.textContent||'').trim().slice(0, 28), box: kasten(t),
               eigenNr: eigen && eigen.__nr !== undefined ? eigen.__nr : -1 };
    }).filter(l => l.box);
    return { flaechen, labels };
  });
}

const schneidet = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const mitteIn = (k, f) => {
  const cx = f.ganz.x + f.ganz.w/2, cy = f.ganz.y + f.ganz.h/2;
  return cx >= k.x && cx <= k.x + k.w && cy >= k.y && cy <= k.y + k.h;
};
const abstand = (k, f) => Math.hypot((k.x + k.w/2) - (f.ganz.x + f.ganz.w/2), (k.y + k.h/2) - (f.ganz.y + f.ganz.h/2));

(async () => {
  const browser = await starteBrowser();
  const store = { [SAVE_KEY]: SPIELSTAND };
  const ctx = await browser.newContext({ viewport: { width:1280, height:900 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(String(e)));
  await page.route('**/api/**', backend(store));
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
  await page.waitForTimeout(1500);

  const l = await lage(page);
  if (l.fehler){ check('0a: Systemebene gezeichnet', false, l.fehler); await ctx.close(); await browser.close(); return ende(); }

  const vorkommen = l.flaechen.filter(f => /data-map-asteroid/.test(f.art));
  const namen = l.labels.filter(x => x.eigenNr >= 0);
  check('1a: dichtes Gürtelsystem gerendert (Vorbedingung)',
    vorkommen.length >= 4 && namen.length >= 6,
    vorkommen.length + ' Vorkommen, ' + namen.length + ' Beschriftungen mit eigenem Objekt');

  // 1b - die Mitte
  const mitten = [];
  for (const x of l.labels)
    for (const f of l.flaechen)
      if (f.nr !== x.eigenNr && mitteIn(x.box, f)) mitten.push(x.text + ' auf ' + f.art);
  check('1b: keine Beschriftung verdeckt die Mitte eines fremden Objekts',
    mitten.length === 0, mitten.join(' | ') || 'keine');

  // 1c - aufgegeben, obwohl ein Platz frei war?
  /* Der natürliche Abstand je Objektart, GEMESSEN als häufigster Wert im Bild (siehe Kopf). Der
     Schlüssel rundet auf eine Nachkommastelle, damit Fließkomma-Rauschen keine zwei Klassen aus
     einem Wert macht. */
  const haeufigster = (werte) => {
    const zaehler = {};
    for (const v of werte){ const k = v.toFixed(1); zaehler[k] = (zaehler[k] || 0) + 1; }
    let besterK = null, besteN = 0;
    for (const k of Object.keys(zaehler)) if (zaehler[k] > besteN){ besteN = zaehler[k]; besterK = k; }
    return { wert: besterK === null ? null : parseFloat(besterK), anzahl: besteN };
  };
  const natuerlich = {};
  const uebersprungen = [];
  for (const art of [...new Set(namen.map(x => l.flaechen[x.eigenNr].art))]){
    const gleiche = namen.filter(x => l.flaechen[x.eigenNr].art === art);
    const dy = haeufigster(gleiche.map(x => x.box.y - l.flaechen[x.eigenNr].b.y));
    const dx = haeufigster(gleiche.map(x => (x.box.x + x.box.w/2) - (l.flaechen[x.eigenNr].b.x + l.flaechen[x.eigenNr].b.w/2)));
    if (gleiche.length < 3 || dy.anzahl < 3 || dx.anzahl < 3){ uebersprungen.push(art + ' (' + gleiche.length + ')'); continue; }
    natuerlich[art] = { dy: dy.wert, dx: dx.wert };
  }
  const versaeumt = [];
  let geprueft = 0;
  for (const x of l.labels){
    const draufliegend = l.flaechen.filter(f => f.nr !== x.eigenNr && schneidet(x.box, f.b));
    if (!draufliegend.length) continue;
    const eigenF = x.eigenNr >= 0 ? l.flaechen[x.eigenNr] : null;
    const n = eigenF ? natuerlich[eigenF.art] : null;
    if (!eigenF || !n) continue;   // ohne gemessene Ausgangslage keine Aussage - lieber nichts sagen als falsch
    geprueft++;
    // Ausgangslage: die Endlage um den gemessenen Versatz zurückgeschoben.
    const versatzY = (x.box.y - eigenF.b.y) - n.dy;
    const versatzX = ((x.box.x + x.box.w/2) - (eigenF.b.x + eigenF.b.w/2)) - n.dx;
    const start = { x: x.box.x - versatzX, y: x.box.y - versatzY, w: x.box.w, h: x.box.h };
    const richtung = (start.y + start.h/2 >= eigenF.b.y + eigenF.b.h/2) ? 1 : -1;
    const plaetze = [];
    for (let v = 1; v <= 2; v++) plaetze.push({ dy: richtung*7*v, dx: 0 });
    for (let v = 1; v <= 2; v++) plaetze.push({ dy: -richtung*7*v, dx: 0 });
    for (const s of [8, -8, 12, -12]) plaetze.push({ dy: 0, dx: s });
    const andere = l.labels.filter(y => y !== x).map(y => y.box);
    const frei = plaetze.filter(p => {
      const k = { x: start.x + p.dx, y: start.y + p.dy, w: start.w, h: start.h };
      return !l.flaechen.some(f => f.nr !== x.eigenNr && schneidet(k, f.b)) && !andere.some(a => schneidet(k, a));
    });
    if (frei.length) versaeumt.push(x.text + ' liegt auf ' + draufliegend.map(f => f.art).join('/') +
      ', obwohl ' + frei.length + ' Plätze frei sind (z. B. dy=' + frei[0].dy + ' dx=' + frei[0].dx + ')');
  }
  check('1c: liegengeblieben nur, wenn kein Platz frei war', versaeumt.length === 0,
    (versaeumt.join(' | ') || 'keine') + ' [' + geprueft + ' Beschriftungen mit Überdeckung geprüft' +
    (uebersprungen.length ? ', Arten ohne Bezugsgröße: ' + uebersprungen.join(', ') : '') + ']');

  /* 1c kann nur urteilen, wo es eine gemessene Ausgangslage gibt. Ohne diese Prüfung hier würde
     die Lücke still wachsen: Fiele die Bezugsgröße irgendwann für ALLE Arten weg, wäre 1c grün,
     ohne eine einzige Beschriftung angesehen zu haben - grün aus dem falschen Grund, und das ist
     so schlecht wie rot. Gezählt wird deshalb ausdrücklich, was 1c NICHT beurteilen konnte. */
  const uebergangen = l.labels.filter(x => {
    if (!l.flaechen.some(f => f.nr !== x.eigenNr && schneidet(x.box, f.b))) return false;
    const eigenF = x.eigenNr >= 0 ? l.flaechen[x.eigenNr] : null;
    return !eigenF || !natuerlich[eigenF.art];
  }).map(x => x.text);
  check('1g: keine überdeckte Beschriftung blieb mangels Bezugsgröße ungeprüft',
    uebergangen.length === 0, uebergangen.join(' | ') || 'keine');

  // 1d - der Rahmen
  const weit = namen.filter(x => {
    const f = l.flaechen.find(g => g.nr === x.eigenNr);
    return Math.abs((x.box.x + x.box.w/2) - (f.b.x + f.b.w/2)) > 12.5;
  }).map(x => x.text);
  check('1d: seitlicher Versatz bleibt im Rahmen (<= 12)', weit.length === 0, weit.join(' | ') || 'keine');

  // 1e - die Zuordnung
  const verirrt = [];
  for (const x of namen){
    const eigenF = l.flaechen.find(f => f.nr === x.eigenNr);
    const dEigen = abstand(x.box, eigenF);
    const naeher = l.flaechen.filter(f => f.nr !== x.eigenNr && abstand(x.box, f) < dEigen);
    if (naeher.length) verirrt.push(x.text + ' steht näher an ' + naeher[0].art);
  }
  check('1e: keine Beschriftung steht näher an einem fremden Objekt als am eigenen',
    verirrt.length === 0, verirrt.join(' | ') || 'keine');

  check('1f: keine Skriptfehler beim Zeichnen', fehler.length === 0, fehler.slice(0, 2).join(' | ') || 'keine');

  await ctx.close();
  await browser.close();

  if (SAB){
    const soll = MUSS_FALLEN[SAB] || [];
    const gefallen = soll.filter(n => ergebnis[n] === false);
    console.log('GEGENPROBE ' + SAB + ': ' + gefallen.length + '/' + soll.length + ' der Pflichtliste gefallen (' +
      soll.map(n => n + '=' + (ergebnis[n] === false ? 'rot' : 'gruen')).join(' ') + ')');
    if (gefallen.length !== soll.length){
      console.log('FAIL - Gegenprobe unvollstaendig: ' + soll.filter(n => ergebnis[n] !== false).join(', ') + ' blieben gruen');
      process.exitCode = 1;
      return;
    }
    process.exitCode = 0;
    return;
  }
  ende();
})().catch(e => { console.error('FAIL - Abbruch:', e); process.exit(1); });
