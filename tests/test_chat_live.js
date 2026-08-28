// Chat-Großetappe B/C (28.08.2026): Live-Chat mit Bündel-Abruf, Historie und Komfort.
//
// WAS DIESE ETAPPE GEBAUT HAT - und was dieser Test je Stück MISST statt behauptet:
//   * EIN Lader/Renderer für beide Kanäle (chatKanalZeichnen/chatVerlaufHtml). Vorher hatte der
//     globale Chat Kosmetik und Scroll-Schutz, der Allianz-Chat NICHTS davon - die klassische
//     zweite Anzeigestelle (Punkt 6 der Checkliste). Abschnitt 1c misst die Kosmetik deshalb im
//     ALLIANZ-Kanal - im globalen wäre sie auch am alten Stand grün (test_kosmetik_flaechen).
//   * Bündel-Abruf GET /api/chat/:kanal (Backend #181): EINE Anfrage statt ~1+50 Einzelanfragen
//     gegen das 240/min-Limit. Abschnitt 1a zählt die Anfragen; Abschnitt 2 ist das PAAR dazu -
//     ein alter Server (404) muss über den alten Weg trotzdem liefern ("der Server darf
//     hinterherhinken, das Frontend nicht"), und der Poll darf dort NICHT weiterlaufen (2b):
//     der Rückfall-Weg kostet ~51 Anfragen je Durchlauf und risse das Limit.
//   * Live-Poll alle 6 s bei OFFENEM Panel (1f/1g): neue Nachrichten erscheinen von selbst, und
//     die Lesestelle eines hochgescrollten Lesers wird dabei NICHT angefasst.
//   * Historie über "Ältere anzeigen" (1d/1e): Tiefe 30 -> 130 -> ... -> CHAT_TIEFE_MAX, und die
//     Anker-Rechnung hält die Lesestelle, während oben 100 Nachrichten dazuwachsen.
//   * Tages-Trenner (1b): bei einem 300er-Verlauf ließ formatRelativeTime allein nicht erkennen,
//     wo ein Tag endet.
//
// DIE PARITÄT (0a/0b) IST IM CODE VERSPROCHEN: Der Kommentar an CHAT_TIEFE_MAX sagt wörtlich
// "CHAT_KEEP_PER_CHANNEL = 300 in server.js - wer dort ändert, zieht CHAT_TIEFE_MAX mit,
// test_chat_live prüft die Parität". Eine Anzeigetiefe ÜBER der Aufbewahrung verspräche Historie,
// die der Server längst weggeräumt hat; eine darunter ließe Aufbewahrtes unerreichbar.
//
// ZWEI MESS-ENTSCHEIDUNGEN, beide aus dem Code abgelesen statt geraten (Regel 4):
//   * checkChatUnread() macht periodisch storage-LIST-Anfragen mit Chat-Präfix - völlig legitim
//     (Ungelesen-Badge, liest nur die Schlüsselliste). Die Kennzahl für "der alte Ladeweg lief"
//     sind deshalb die storage/<prefix>:msg:-EINZEL-GETs, nie die Listen.
//   * Beim Öffnen laufen BEIDE Kanal-Lader parallel; im 404-Fall kann jeder einen eigenen
//     chat/-Versuch machen, bevor der erste chatBuendelFehlt setzt - 2a erlaubt deshalb 1-2.
//
// GEGENPROBE (Regel 1, beidseitig gefahren, identische 22 Prüfnamen per diff verglichen -
// Regel 60): Gegen origin/main (v8.615.0, vor der Etappe) per KEPLER_SPIELDATEI fallen 15 -
// 0-vorab/0b (Konstanten fehlen; 0a bleibt grün, die BACKEND-Konstante gab es schon), 1a mit
// {"global":0,"allianz":0} (kein Bündel-Abruf), 1b-vorab/1b (keine Trenner), 1c-vorab/1c (der
// alte Allianz-Renderer kannte weder Bündel-Nachrichten noch Kosmetik), 1d-vorab/1d/1e (kein
// "Ältere anzeigen"), 1f-vorab/1f/1g/1g2 (kein Poll, und die leere Box klemmt scrollTop auf 0),
// 2a mit {"chat":0,"einzel":4} (der alte Weg lief - er WAR der Weg -, aber ohne Bündel-Versuch
// davor). GRÜN bleiben MÜSSEN 0a, 1h und 2b - ohne Poll gibt es nichts, was gegen den alten
// Server pollen könnte; eine dieser drei rot hieße WERKZEUGFEHLER, nicht Befund (Regel 71).
//
// ZWEI NACHGEZOGENE BEFUNDE (v8.618.0, verifizierte Bot-Meldungen am Live-Stand v8.617.0):
//   * Abschnitt 3: Der Riegel gegen den teuren alten Weg griff NUR bei 404. Jeder andere
//     Fehlschlag (429/500/502, Netzabbruch, ok-Antwort ohne Nachrichtenliste) fiel je 6-s-Poll
//     auf storage-list + Einzel-GETs durch - ~51 Anfragen je Durchlauf gegen das 240/min-Limit,
//     dieselbe Kette wie beim Markt-Sammelauftrag. Seit v8.618.0 liefert der Lader dort null,
//     der Zeichner lässt den Bestand stehen (leere Box: Erklärzeile statt stummer Fläche,
//     Regel 35), und der Poll versucht das Bündel weiter - die Selbstheilung (3c) ist die
//     Zusage der Erklärzeile ("neuer Versuch läuft automatisch", Regel 11: Texte sind
//     Versprechen).
//   * Abschnitt 4: Der Zeichner konsumierte das chatErweitert-Flag NACH seinem await - ein
//     langsamer 30er-Poll konnte ein frisch geklicktes "Ältere anzeigen" (130) überschreiben.
//     Seit v8.618.0 trägt jeder Lauf eine Laufnummer (chatLadeLauf) und wirft sein Ergebnis
//     weg, wenn inzwischen ein jüngerer gestartet ist. Das Rennen wird DETERMINISTISCH gestellt
//     (limit=30-Antworten künstlich um 1,5 s verzögert, limit=130 sofort) und 4-vorab belegt am
//     Antwort-Mitschnitt, dass es wirklich stattfand - sonst wäre 4a auch ohne Rennen grün
//     (Regel 28).
// Gegenprobe dazu gegen v8.617.0 per KEPLER_SPIELDATEI: es fallen GENAU 3a (Einzel-GETs liefen),
// 3a2 (Altbestand statt Erklärzeile), 3b (der Poll fuhr den alten Weg im Takt weiter) und 4a
// (die Box sprang zurück auf 30). GRÜN bleiben MÜSSEN 3-vorab, 3c, 3z, 4-vorab0, 4-vorab und 4z
// - eine davon rot hieße WERKZEUGFEHLER, nicht Befund (Regel 71).
const fs = require('fs');
const { starteBrowser, SPIEL_URL, SERVER_JS, pruefer, ruhigeUhren } = require('./lib/umgebung');
const { SPIELDATEI } = require('./lib/spieldatei');
const { check, ende } = pruefer();

const SRC = fs.readFileSync(SPIELDATEI, 'utf8');
const JS = SRC.match(/<script>([\s\S]*)<\/script>/)[1];

// ============================================================ 0) Quelltext: die Parität
const tiefen = JS.match(/const CHAT_TIEFE_START = (\d+), CHAT_TIEFE_SCHRITT = (\d+), CHAT_TIEFE_MAX = (\d+);/);
check('0-vorab: die drei Tiefen-Konstanten stehen in der Spieldatei', !!tiefen,
  tiefen ? { start: tiefen[1], schritt: tiefen[2], max: tiefen[3] } : 'nicht gefunden');
if (SERVER_JS) {
  const BACK = fs.readFileSync(SERVER_JS, 'utf8');
  const keep = BACK.match(/const CHAT_KEEP_PER_CHANNEL = (\d+);/);
  check('0a: CHAT_KEEP_PER_CHANNEL steht im Backend (sonst misst 0b nichts)', !!keep,
    keep ? keep[1] : 'nicht gefunden');
  check('0b: Anzeigetiefe == Aufbewahrung des Servers (CHAT_TIEFE_MAX == CHAT_KEEP_PER_CHANNEL)',
    !!(tiefen && keep && tiefen[3] === keep[1]),
    { front: tiefen && tiefen[3], back: keep && keep[1] });
} else {
  // Bewusst KEINE stillschweigend grüne Prüfung (Regel 22: ein Test, der sich still überspringt,
  // ist keine Gegenprobe) - die Zeile steht sichtbar im Protokoll.
  console.log('SKIP - 0a/0b: kolonie-kepler7-backend liegt nicht daneben, Parität ungeprüft');
}

// Farbe/Emblem aus KOSMETIK_LOOK abgelesen, nie eingetippt (Muster aus test_kosmetik_flaechen).
const LOOK_BLOCK = JS.slice(JS.indexOf('const KOSMETIK_LOOK = {'), JS.indexOf('};', JS.indexOf('const KOSMETIK_LOOK = {')));
const goldFarbe = (LOOK_BLOCK.match(/nf_gold:\s*\{[^}]*farbe:'([^']+)'/) || [])[1];
const leuchtIcon = (LOOK_BLOCK.match(/em_leuchtfeuer:\s*\{[^}]*icon:'([^']+)'/) || [])[1];

const ICH = 'u-ich';
const GOLD = { namensfarbe: 'nf_gold', emblem: 'em_leuchtfeuer' };
const OHNE = { namensfarbe: 'nf_standard', emblem: 'em_keins' };

// 160 globale Nachrichten: 1..150 auf "gestern" (26 h zurück, minütlich), 151..160 auf "heute".
// Das 30er-Startfenster (131..160) überspannt damit BEIDE Tage -> zwei Tages-Trenner; nach
// "Ältere anzeigen" (31..160) ebenso. Die Texte sind durchnummeriert, damit die Zählung im DOM
// über /Nachricht \d+/ läuft statt über ein Markup-Detail (Regel 3).
const JETZT = Date.now();
function globalNachrichten() {
  const liste = [];
  for (let i = 1; i <= 160; i++) {
    const ts = i <= 150 ? JETZT - 26 * 3600e3 + i * 30e3 : JETZT - 600e3 + (i - 150) * 50e3;
    liste.push({ authorId: i % 2 ? 'u-lume' : 'u-ohne', authorName: i % 2 ? 'Lumekx' : 'Aryen82',
      authorAllianceTag: i % 2 ? 'GG' : null, text: 'Nachricht ' + i, ts });
  }
  return liste;
}
function allianzNachrichten() {
  return [
    { authorId: 'u-lume', authorName: 'Lumekx', text: 'Traeger im Allianzkanal', ts: JETZT - 120e3 },
    { authorId: 'u-ohne', authorName: 'Aryen82', text: 'ohne Kosmetik im Allianzkanal', ts: JETZT - 60e3 }
  ];
}

const EINTRAEGE = {
  ['leaderboard:' + ICH]: JSON.stringify({ id: ICH, name: 'GameGeeeeek', allianceTag: 'GG', score: 1131816, ships: 900, bp: 400, lastSeen: JETZT, isSupporter: true, supporterTier: 'gold', cosmetics: GOLD }),
  'leaderboard:u-lume': JSON.stringify({ id: 'u-lume', name: 'Lumekx', allianceTag: 'GG', score: 154896, ships: 300, bp: 120, lastSeen: JETZT, isSupporter: true, supporterTier: 'bronze', cosmetics: GOLD }),
  'leaderboard:u-ohne': JSON.stringify({ id: 'u-ohne', name: 'Aryen82', score: 95, ships: 5, bp: 1, lastSeen: JETZT - 9e6, isSupporter: false, supporterTier: null, cosmetics: OHNE })
};

const save = () => JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie: 9e8, erz: 9e8, kristalle: 9e8, deuterium: 9e8, antimaterie: 9e6, forschungspunkte: 9e5 },
  buildings: { solar: 30, mine: 28, labor: 20, lager: 60, werft: 20 }, research: {}, fleet: { missions: [], jaeger: 100 },
  colonies: {}, activeBasePlanet: 'home',
  player: { id: ICH, name: 'GameGeeeeek', avatarKey: null, allianceTag: 'GG' },
  xp: 9e6, credits: 5e6, buffs: [], lastTick: Date.now(), colonyNames: {}, modules: {}, shipModules: {}
}));

// Der Mock führt die Nachrichten als Node-Arrays (opts.globalMsgs) - der Poll-Test schiebt von
// außen eine neue Nachricht hinein, ohne die Seite anzufassen. `anfragen` sammelt jede Anfrage
// DEKODIERT (storageGet schickt den Schlüssel URL-encodiert, %3A würde jeden Filter verfehlen).
function backend(opts) {
  return async r => {
    const req = r.request(); const u = req.url();
    const rest = u.split('/api/')[1]; const p = rest.split('?')[0];
    opts.anfragen.push(req.method() + ' ' + decodeURIComponent(rest));
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (p === 'chat/global' || p === 'chat/allianz') {
      if (opts.chat404) return j({ error: 'Cannot GET' }, 404);
      // Abschnitt 3: ein VORUEBERGEHEND gestoerter Server (500/502/429) - bewusst kein 404,
      // denn genau der Unterschied ist der Gegenstand.
      if (opts.chatFehler) return j({ error: 'kaputt' }, opts.chatFehler);
      // Abschnitt 4: limit=30-Antworten kuenstlich verzoegern, damit das Lade-Rennen
      // deterministisch entsteht statt auf Wanduhr-Glueck zu warten (Regel 8/18-Familie).
      if (opts.langsam30 && /limit=30$/.test(rest)) await new Promise(res => setTimeout(res, opts.langsam30));
      const limit = Math.max(1, parseInt((rest.split('limit=')[1] || '50'), 10) || 50);
      const liste = p === 'chat/global' ? opts.globalMsgs : opts.allianzMsgs;
      const teil = liste.slice(-limit);
      if (opts.antworten) opts.antworten.push(rest); // Antwort-Reihenfolge fuer 4-vorab
      return j({ ok: true, nachrichten: teil, neuesteTs: teil.length ? teil[teil.length - 1].ts : 0 });
    }
    if (p === 'health') return j({ ok: true });
    if (p === 'me') return j({ userId: ICH, username: 'GameGeeeeek', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true, supporter: { active: true, tier: 'gold' } });
    if (p === 'reports') return j({ reports: [] });
    if (p === 'pending-rewards/claim') return j({ reward: null });
    if (p === 'cosmetics') return j({ katalog: [], besitz: [], auswahl: GOLD, staub: 0 });
    if (p === 'storage-list') {
      const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]);
      return j({ keys: Object.keys(opts.store).filter(k => k.startsWith(pref)) });
    }
    if (p.startsWith('storage/')) {
      const k = decodeURIComponent(p.slice(8));
      if (req.method() === 'PUT') return j({ ok: true, version: 2 });
      if (opts.store[k] !== undefined) return j({ key: k, value: opts.store[k], shared: true, version: 1 });
      return j({ e: 1 }, 404);
    }
    return j([]);
  };
}

// Zählt Goldfarbe/Emblem in einer Box - das VOLLSTÄNDIGE Attribut aus kosmetikFarbAttr()
// (` style="color:X;"`), nicht die bloße Farbe: `color:${o.farbe}` der Namenszeile steht in einem
// zusammengesetzten style und darf nicht mitzählen (Lehre aus test_kosmetik_flaechen).
const ZAEHLEN_SRC = `(sel, farbe, icon) => {
  const box = document.querySelector(sel);
  if (!box) return null;
  const html = box.innerHTML || '';
  const txt = box.textContent || '';
  return { farbe: html.split('style="color:' + farbe + ';"').length - 1,
           embleme: html.split('ti ' + icon).length - 1,
           hatLumekx: /Lumekx/.test(txt), hatAryen: /Aryen82/.test(txt) };
}`;

async function booten(browser, opts) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend(opts));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4500);
  await page.evaluate(() => ['tutorialOverlay', 'welcomeNewOverlay', 'welcomeBackOverlay', 'updateNoticeOverlay', 'kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }));
  return { ctx, page, errs };
}

const chatAnfragen = a => a.filter(x => x.includes(' chat/'));
const einzelGets = a => a.filter(x => /^GET storage\/(globalchat|alliance:GG):msg:/.test(x));

(async () => {
  check('0c-vorab: Goldfarbe und Leuchtfeuer-Icon aus KOSMETIK_LOOK abgelesen', !!goldFarbe && !!leuchtIcon, { goldFarbe, leuchtIcon });
  const browser = await starteBrowser();

  // ============================================================ 1) Der Bündel-Weg (neuer Server)
  const o1 = { anfragen: [], store: Object.assign({ 'kepler7-save-v3': save() }, EINTRAEGE), globalMsgs: globalNachrichten(), allianzMsgs: allianzNachrichten(), chat404: false };
  const l1 = await booten(browser, o1);
  // Der Punkte-Reiter füllt den leaderboardCache - die Quelle der Chat-Kosmetik (Vorbild
  // test_kosmetik_flaechen; ausdrücklich NICHT der Galaxie-Reiter, der ruft selbst loadGlobalChat).
  await l1.page.evaluate(() => { const b = [...document.querySelectorAll('[data-tab]')].find(x => x.getAttribute('data-tab') === 'punkte'); if (b) b.click(); });
  await l1.page.waitForTimeout(2600);

  o1.anfragen.length = 0;
  await l1.page.evaluate(() => document.getElementById('chatEdgeTab').click());
  await l1.page.waitForTimeout(1800);

  const offen = await l1.page.evaluate(() => document.getElementById('chatPanel').classList.contains('open'));
  check('1-vorab: das Panel ist offen', offen === true, { offen });
  const a1 = { global: o1.anfragen.filter(x => x.includes(' chat/global')).length,
               allianz: o1.anfragen.filter(x => x.includes(' chat/allianz')).length,
               einzel: einzelGets(o1.anfragen).length };
  check('1a: das Öffnen kostet je Kanal EINE Bündel-Anfrage und keinen einzigen Einzel-GET',
    a1.global === 1 && a1.allianz === 1 && a1.einzel === 0, a1);

  // Kosmetik im ALLIANZ-Kanal (initial sichtbar) - der Kanal, der sie am alten Stand NICHT hatte.
  const alli = await l1.page.evaluate(({ z, farbe, icon }) => new Function('return ' + z)()('#chatPanelAllianceBox', farbe, icon), { z: ZAEHLEN_SRC, farbe: goldFarbe, icon: leuchtIcon });
  check('1c-vorab: beide Namen stehen im Allianz-Kanal (sonst misst 1c nichts)', !!(alli && alli.hatLumekx && alli.hatAryen), alli);
  check('1c: der Allianz-Kanal färbt den Träger und nur den (Kosmetik über die authorId)',
    !!(alli && alli.farbe === 1 && alli.embleme === 1), alli);

  // Auf den globalen Kanal wechseln - dort liegen Historie, Trenner und der Poll-Gegenstand.
  await l1.page.evaluate(() => document.getElementById('chatPanelTabGlobal').click());
  await l1.page.waitForTimeout(900);
  const start = await l1.page.evaluate(() => {
    const box = document.getElementById('chatPanelGlobalBox');
    const trenner = [...box.querySelectorAll('div.bmeta')].map(d => d.textContent.trim()).filter(t => /^—.+—$/.test(t));
    return { anzahl: (box.textContent.match(/Nachricht \d+/g) || []).length, trenner,
             neueste: /Nachricht 160/.test(box.textContent) };
  });
  check('1b-vorab: das Startfenster zeigt 30 Nachrichten inklusive der neuesten', start.anzahl === 30 && start.neueste, start);
  // Die REGEL, nicht die Beschriftung: Nachrichten zweier Kalendertage ergeben genau zwei
  // Trennzeilen, und der jüngere Tag heißt "Heute". Der ältere ist je nach Uhrzeit "Gestern"
  // oder ein Datum (kurz nach Mitternacht liegt jetzt-26h zwei Kalendertage zurück) - eine
  // Prüfung auf das Wort "Gestern" wäre eine Momentaufnahme der Testuhrzeit (Regel 3).
  check('1b: zwei Tages-Trennzeilen, die jüngere sagt Heute',
    start.trenner.length === 2 && start.trenner[1] === '— Heute —', start.trenner);

  // "Ältere anzeigen": Lesestelle nach OBEN setzen, den Anker merken, klicken.
  const knopfDa = await l1.page.evaluate(() => {
    const box = document.getElementById('chatPanelGlobalBox');
    box.scrollTop = 0;
    const mk = box.querySelector('[data-chat-mehr="global"]');
    const anker = [...box.querySelectorAll('div')].find(d => d.textContent.trim() === 'Nachricht 131');
    return { knopf: !!mk, ankerTop: anker ? anker.getBoundingClientRect().top : null };
  });
  check('1d-vorab: der Ältere-anzeigen-Knopf steht da und der Anker ist gefunden',
    knopfDa.knopf && knopfDa.ankerTop !== null, knopfDa);
  o1.anfragen.length = 0;
  await l1.page.evaluate(() => { const mk = document.querySelector('#chatPanelGlobalBox [data-chat-mehr="global"]'); if (mk) mk.click(); });
  await l1.page.waitForTimeout(1200);
  const nach = await l1.page.evaluate(() => {
    const box = document.getElementById('chatPanelGlobalBox');
    const anker = [...box.querySelectorAll('div')].find(d => d.textContent.trim() === 'Nachricht 131');
    return { anzahl: (box.textContent.match(/Nachricht \d+/g) || []).length,
             ankerTop: anker ? anker.getBoundingClientRect().top : null, scrollTop: box.scrollTop };
  });
  const limitAnfrage = o1.anfragen.find(x => x.includes(' chat/global') && x.includes('limit=130'));
  check('1d: der Klick fragt limit=130 an und die Box zeigt 130 Nachrichten',
    !!limitAnfrage && nach.anzahl === 130, { limitAnfrage: limitAnfrage || o1.anfragen.filter(x => x.includes(' chat/')), anzahl: nach.anzahl });
  // Die Anker-Rechnung: 100 Nachrichten wachsen OBEN dazu, die vorher oberste bleibt an ihrer
  // Fensterposition (scrollTop > 100 belegt, dass wirklich verschoben wurde und nicht bloß
  // nichts neu gezeichnet - Regel 28).
  check('1e: die Lesestelle bleibt beim Nachladen stehen (Anker-Rechnung)',
    knopfDa.ankerTop !== null && nach.ankerTop !== null && Math.abs(nach.ankerTop - knopfDa.ankerTop) <= 6 && nach.scrollTop > 100,
    { vorher: knopfDa.ankerTop, nachher: nach.ankerTop, scrollTop: nach.scrollTop });

  // Der Poll: 6-s-Takt an der Wanduhr. Erst der Ruhefall (unveränderte Daten bewegen nichts),
  // dann der Neuigkeitsfall (die Nachricht erscheint, die Lesestelle bleibt trotzdem).
  await l1.page.evaluate(() => { document.getElementById('chatPanelGlobalBox').scrollTop = 300; });
  o1.anfragen.length = 0;
  await l1.page.waitForTimeout(8000);
  const ruhe = await l1.page.evaluate(() => document.getElementById('chatPanelGlobalBox').scrollTop);
  const pollAnfragen = o1.anfragen.filter(x => x.includes(' chat/global')).length;
  check('1f-vorab: der Poll lief im Messfenster wirklich (sonst misst 1f nichts)', pollAnfragen >= 1, { pollAnfragen });
  check('1f: ein Poll ohne Neues bewegt die Lesestelle nicht', Math.abs(ruhe - 300) <= 2, { scrollTop: ruhe });

  o1.globalMsgs.push({ authorId: 'u-lume', authorName: 'Lumekx', authorAllianceTag: 'GG', text: 'Poll-Botschaft', ts: Date.now() });
  let pollSichtbar = false;
  for (let i = 0; i < 19 && !pollSichtbar; i++) {
    await l1.page.waitForTimeout(500);
    pollSichtbar = await l1.page.evaluate(() => /Poll-Botschaft/.test(document.getElementById('chatPanelGlobalBox').textContent));
  }
  const nachPoll = await l1.page.evaluate(() => document.getElementById('chatPanelGlobalBox').scrollTop);
  check('1g: eine neue Nachricht erscheint binnen des Poll-Takts von selbst', pollSichtbar === true, { pollSichtbar });
  check('1g2: und die Lesestelle des hochgescrollten Lesers bleibt dabei stehen', Math.abs(nachPoll - 300) <= 2, { scrollTop: nachPoll });

  // Panel zu -> der Poll verstummt. Gemessen an den ANFRAGEN, nicht am Timer-Handle (Regel 61).
  await l1.page.evaluate(() => document.getElementById('chatPanelCloseBtn').click());
  await l1.page.waitForTimeout(300);
  o1.anfragen.length = 0;
  await l1.page.waitForTimeout(7500);
  const nachZu = chatAnfragen(o1.anfragen).length;
  check('1h: nach dem Schließen kommt keine einzige Chat-Anfrage mehr', nachZu === 0, { nachZu, anfragen: chatAnfragen(o1.anfragen).slice(0, 3) });

  check('1z: keine JS-Fehler im Bündel-Lauf', l1.errs.length === 0, l1.errs.slice(0, 3));
  await l1.ctx.close();

  // ============================================================ 2) Der Rückfall (alter Server, 404)
  const altStore = Object.assign({ 'kepler7-save-v3': save() }, EINTRAEGE);
  // Schlüsselformat wie das Spiel es schreibt: <ts>-<rand> hinter dem Präfix (checkChatUnread
  // parst den Zeitstempel daraus). Einfüge-Reihenfolge = chronologisch, storageList liefert sie so.
  for (let i = 1; i <= 3; i++) altStore['globalchat:msg:' + (JETZT - (4 - i) * 60e3) + '-alt' + i] = JSON.stringify({ authorId: 'u-lume', authorName: 'Lumekx', authorAllianceTag: 'GG', text: 'Altbestand ' + i, ts: JETZT - (4 - i) * 60e3 });
  altStore['alliance:GG:msg:' + (JETZT - 90e3) + '-alta'] = JSON.stringify({ authorId: 'u-ohne', authorName: 'Aryen82', text: 'Allianz-Altbestand', ts: JETZT - 90e3 });
  const o2 = { anfragen: [], store: altStore, globalMsgs: [], allianzMsgs: [], chat404: true };
  const l2 = await booten(browser, o2);

  o2.anfragen.length = 0;
  await l2.page.evaluate(() => document.getElementById('chatEdgeTab').click());
  await l2.page.waitForTimeout(2000);
  await l2.page.evaluate(() => document.getElementById('chatPanelTabGlobal').click());
  await l2.page.waitForTimeout(1200);
  const alt = await l2.page.evaluate(() => ({
    global: /Altbestand 3/.test(document.getElementById('chatPanelGlobalBox').textContent),
    allianz: /Allianz-Altbestand/.test(document.getElementById('chatPanelAllianceBox').textContent)
  }));
  const a2 = { chat: chatAnfragen(o2.anfragen).length, einzel: einzelGets(o2.anfragen).length };
  check('2a: gegen den alten Server läuft nach dem 404-Versuch der alte Weg und liefert beide Kanäle',
    a2.chat >= 1 && a2.chat <= 2 && a2.einzel >= 3 && alt.global && alt.allianz, Object.assign({}, a2, alt));

  // Der Rate-Limit-Schutz: Gegen einen Server ohne Bündel-Route pollt das Panel bewusst NICHT -
  // der Rückfall-Weg kostet ~51 Anfragen je Durchlauf. Gemessen an Bündel-Versuchen UND
  // Einzel-GETs; die storage-LISTEN des Ungelesen-Checkers zählen absichtlich nicht mit.
  o2.anfragen.length = 0;
  await l2.page.waitForTimeout(8000);
  const still = { chat: chatAnfragen(o2.anfragen).length, einzel: einzelGets(o2.anfragen).length };
  check('2b: der Poll bleibt gegen den alten Server still (kein Bündel-Versuch, kein Einzel-GET)',
    still.chat === 0 && still.einzel === 0, still);

  check('2z: keine JS-Fehler im Rückfall-Lauf', l2.errs.length === 0, l2.errs.slice(0, 3));
  await l2.ctx.close();

  // ============================================================ 3) Der VORÜBERGEHEND gestörte Server
  // (500 statt 404). Der Store trägt bewusst Legacy-Altbestand: Am Stand v8.617.0 fiel der Lader
  // hier auf den alten Weg durch und zeigte ihn - die Einzel-GETs und der Altbestand im DOM sind
  // die MESSBARE Signatur des Fehlers, nicht bloß seine Beschriftung (Regel 61).
  const stoerStore = Object.assign({ 'kepler7-save-v3': save() }, EINTRAEGE);
  for (let i = 1; i <= 3; i++) stoerStore['globalchat:msg:' + (JETZT - (4 - i) * 60e3) + '-alt' + i] = JSON.stringify({ authorId: 'u-lume', authorName: 'Lumekx', authorAllianceTag: 'GG', text: 'Altbestand ' + i, ts: JETZT - (4 - i) * 60e3 });
  const o3 = { anfragen: [], store: stoerStore, globalMsgs: globalNachrichten(), allianzMsgs: allianzNachrichten(), chat404: false, chatFehler: 500 };
  const l3 = await booten(browser, o3);

  o3.anfragen.length = 0;
  await l3.page.evaluate(() => document.getElementById('chatEdgeTab').click());
  await l3.page.waitForTimeout(2000);
  await l3.page.evaluate(() => document.getElementById('chatPanelTabGlobal').click());
  await l3.page.waitForTimeout(1200);
  const stoer = await l3.page.evaluate(() => {
    const t = document.getElementById('chatPanelGlobalBox').textContent || '';
    return { nichtErreichbar: /Chat gerade nicht erreichbar/.test(t), altbestand: /Altbestand/.test(t),
             leerFalsch: /Noch keine Nachrichten/.test(t) };
  });
  const a3 = { chat: chatAnfragen(o3.anfragen).length, einzel: einzelGets(o3.anfragen).length };
  check('3-vorab: der Bündel-Versuch lief gegen den gestörten Server (sonst misst 3a nichts)',
    a3.chat >= 1, a3);
  check('3a: ein 500 fällt NICHT auf den alten Weg durch (kein einziger Einzel-GET)',
    a3.einzel === 0, a3);
  check('3a2: die leere Box erklärt die Störung, statt Altbestand oder "Noch keine Nachrichten" zu behaupten',
    stoer.nichtErreichbar === true && stoer.altbestand === false && stoer.leerFalsch === false, stoer);

  // Der Poll versucht das Bündel WEITER (der 404-Riegel darf hier nicht greifen - sonst gäbe es
  // die Selbstheilung nicht), aber weiterhin ohne einen einzigen Einzel-GET.
  o3.anfragen.length = 0;
  await l3.page.waitForTimeout(8000);
  const s3 = { chat: chatAnfragen(o3.anfragen).length, einzel: einzelGets(o3.anfragen).length };
  check('3b: der Poll versucht das Bündel weiter und flutet dabei nicht den alten Weg',
    s3.chat >= 1 && s3.einzel === 0, s3);

  // Die Selbstheilung ist die Zusage der Erklärzeile ("neuer Versuch läuft automatisch") - sie
  // MUSS an beiden Ständen grün sein; rot hieße, die Zeile lügt (Regel 11).
  o3.chatFehler = 0;
  let geheilt = false;
  for (let i = 0; i < 20 && !geheilt; i++) {
    await l3.page.waitForTimeout(500);
    geheilt = await l3.page.evaluate(() => /Nachricht 160/.test(document.getElementById('chatPanelGlobalBox').textContent));
  }
  check('3c: sobald der Server wieder antwortet, heilt der nächste Poll die Box von selbst', geheilt === true, { geheilt });

  check('3z: keine JS-Fehler im Störungs-Lauf', l3.errs.length === 0, l3.errs.slice(0, 3));
  await l3.ctx.close();

  // ============================================================ 4) Das Lade-Rennen (Poll gegen Klick)
  const o4 = { anfragen: [], antworten: [], store: Object.assign({ 'kepler7-save-v3': save() }, EINTRAEGE), globalMsgs: globalNachrichten(), allianzMsgs: allianzNachrichten(), chat404: false, langsam30: 0 };
  const l4 = await booten(browser, o4);
  await l4.page.evaluate(() => document.getElementById('chatEdgeTab').click());
  await l4.page.waitForTimeout(1800);
  await l4.page.evaluate(() => document.getElementById('chatPanelTabGlobal').click());
  await l4.page.waitForTimeout(900);
  const start4 = await l4.page.evaluate(() => (document.getElementById('chatPanelGlobalBox').textContent.match(/Nachricht \d+/g) || []).length);
  check('4-vorab0: das Startfenster steht (30 Nachrichten), bevor das Rennen gestellt wird', start4 === 30, { anzahl: start4 });

  // Rennen stellen: Ab jetzt brauchen 30er-Antworten 1,5 s. Auf den NÄCHSTEN Poll-Start warten
  // (die Anfrage steht im Mitschnitt, BEVOR die Verzögerung beginnt), dann sofort "Ältere
  // anzeigen" klicken - dessen 130er-Antwort kommt zuerst, der langsame 30er-Poll danach.
  o4.langsam30 = 1500;
  o4.anfragen.length = 0; o4.antworten.length = 0;
  let pollGestartet = false;
  for (let i = 0; i < 150 && !pollGestartet; i++) {
    await new Promise(res => setTimeout(res, 50));
    pollGestartet = o4.anfragen.some(x => x.includes(' chat/global') && /limit=30$/.test(x));
  }
  await l4.page.evaluate(() => { const mk = document.querySelector('#chatPanelGlobalBox [data-chat-mehr="global"]'); if (mk) mk.click(); });
  await l4.page.waitForTimeout(2500);
  const idx130 = o4.antworten.findIndex(x => x.includes('chat/global') && /limit=130$/.test(x));
  const idx30 = o4.antworten.findIndex(x => x.includes('chat/global') && /limit=30$/.test(x));
  check('4-vorab: das Rennen fand wirklich statt (130er-Antwort VOR der langsamen 30er-Antwort)',
    pollGestartet && idx130 >= 0 && idx30 >= 0 && idx130 < idx30, { pollGestartet, idx130, idx30, antworten: o4.antworten.slice(0, 6) });
  const rennen = await l4.page.evaluate(() => (document.getElementById('chatPanelGlobalBox').textContent.match(/Nachricht \d+/g) || []).length);
  check('4a: der überholte 30er-Poll überschreibt das frische Nachladen NICHT (Box bleibt bei 130)',
    rennen === 130, { anzahl: rennen });

  check('4z: keine JS-Fehler im Rennen-Lauf', l4.errs.length === 0, l4.errs.slice(0, 3));
  await l4.ctx.close();
  await browser.close();
  return ende();
})().catch(e => { console.error(e); process.exit(1); });
