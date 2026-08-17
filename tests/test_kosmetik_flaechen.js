// Kosmetik auf allen Flaechen, die sie ZEICHNEN sollen (17.08.2026).
//
// ZWEI BEFUNDE HABEN ZU DIESEM TEST GEFUEHRT:
//
// 1) Die WOCHENLIGA zeigte gar keine Kosmetik. Sie rief kosmetikFarbAttr()/kosmetikEmblem()
//    korrekt auf, dampfte ihre Liste vorher aber auf ein neues Objekt ein, in dem `cosmetics`
//    schlicht fehlte - die Helfer bekamen also ein Objekt ohne das Feld und lieferten stumm ''.
//    Das ist exakt derselbe Fehler, den der Kommentar direkt darueber fuer `isSupporter`
//    beschreibt (05.08.2026) - die zweite Anzeigestelle, die die alte Annahme behielt.
//
// 2) Der globale CHAT war die einzige Namensliste ganz ohne Auszeichnung: feste Farbe fuer alle,
//    kein Emblem, keine Unterstuetzer-Pille. Er zeigt sie jetzt - aber NICHT aus der Nachricht.
//
// DIE SICHERHEITSFRAGE UND WARUM SIE HIER GEPRUEFT WIRD: Chatnachrichten schreibt der Client
// selbst in den geteilten Speicher. Wuerde die Anzeige eine in der Nachricht mitgeschickte Farbe
// benutzen, koennte sich jeder die Goldspender-Farbe geben - auf einer Flaeche, die allen gehoert.
// Deshalb kommt die Kosmetik ueber die authorId aus dem BESTENLISTEN-Cache, den der Server bei
// jedem Lesen frisch anreichert. Abschnitt 3 ist die Probe darauf: eine Nachricht mit gefaelschtem
// cosmetics-Feld darf nichts einfaerben.
//
// GEPRUEFT WERDEN REGELN, KEINE MOMENTAUFNAHMEN:
//   1. Jede Flaeche, die einen Namen aus Bestenlisten-Daten zeichnet, zeigt Farbe UND Emblem
//      fuer einen Traeger - und KEINE zeigt etwas fuer jemanden ohne Kosmetik (eingebaute
//      Gegenprobe: ohne sie waere der Test auch dann gruen, wenn ueberall bedingungslos
//      eingefaerbt wuerde).
//   2. Der Chat faerbt nach der authorId, nicht nach dem Nachrichteninhalt.
//   3. Wer keinen Bestenlisten-Eintrag hat, erscheint schlicht ohne Auszeichnung - der ehrliche
//      Ausfall statt eines geratenen Aussehens.
//
// GEGENPROBE (Regel 1, in beide Richtungen gefahren, gleiche Pruefungszahl 11/11): Am Stand davor
// fallen 1a-1d, 2 und 3 - aber NICHT alle aus demselben Grund, und das gehoert dazugesagt:
//   - 1c faellt mit farbe:0 - der echte Wochenliga-Fehler, der Anlass dieses Tests.
//   - 1a/1b/1d fallen nur mit embleme:0, weil es em_leuchtfeuer dort noch nicht gab; ihre
//     FARB-Zaehlung war schon vorher richtig. Sie sind also Wachposten, kein Fehlerbeleg.
//   - 2 faellt, weil der alte Chat gar nichts auszeichnete.
//   - 3 faellt am alten Stand ebenfalls - aber aus dem FALSCHEN Grund: Es ist dort gar nichts
//     gefaerbt, also ist auch farbe===1 verletzt. Abschnitt 3 belegt die Sicherheitsregel erst
//     ab dem neuen Stand; er ist die Absicherung gegen die naheliegende FALSCHE Umsetzung
//     (Kosmetik aus der Nachricht lesen), nicht gegen den alten Stand.
const fs = require('fs');
const path = require('path');
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const ICH = 'u-ich';
const GOLD = { namensfarbe: 'nf_gold', emblem: 'em_leuchtfeuer' };   // Traeger
const OHNE = { namensfarbe: 'nf_standard', emblem: 'em_keins' };     // Gegenprobe

// Die Farbe wird NICHT eingetippt, sondern aus KOSMETIK_LOOK der Spieldatei gelesen (Regel 4:
// Werte ablesen, nie raten - und der Test soll nicht falsch anschlagen, wenn der Farbton sich
// aendert).
const SRC = fs.readFileSync(path.join(__dirname, '..', 'weltraum_kolonie.html'), 'utf8');
const JS = SRC.match(/<script>([\s\S]*)<\/script>/)[1];
const LOOK_BLOCK = JS.slice(JS.indexOf('const KOSMETIK_LOOK = {'), JS.indexOf('};', JS.indexOf('const KOSMETIK_LOOK = {')));
const goldFarbe = (LOOK_BLOCK.match(/nf_gold:\s*\{[^}]*farbe:'([^']+)'/) || [])[1];
const leuchtIcon = (LOOK_BLOCK.match(/em_leuchtfeuer:\s*\{[^}]*icon:'([^']+)'/) || [])[1];

// Der Wochenschlüssel wird mit der ECHTEN Funktion aus der Spieldatei gebildet, nicht nachgebaut:
// Sie rechnet auf den lokalen Montag, und ein nachgebautes Datum waere spaetestens am naechsten
// Wochenwechsel falsch. Ohne passenden Schluessel filtert renderWeeklyLeague die Fixture-Eintraege
// weg - der Abschnitt haette dann eine leere Liste gemessen und waere trivial durchgelaufen
// (genau das ist beim ersten Lauf passiert und hat die Vorab-Pruefung 1c-vorab ausgeloest).
const weekKeyOf = new Function('return ' + JS.slice(JS.indexOf('function weekKeyOf(')).slice(0, JS.slice(JS.indexOf('function weekKeyOf(')).indexOf('\n  }') + 4))();
const WOCHE = weekKeyOf(Date.now());

const CHAT_KEYS = {
  'globalchat:msg:1000-a': JSON.stringify({ authorId: 'u-lume', authorName: 'Lumekx', authorAllianceTag: 'GG', text: 'Traeger mit Kosmetik', ts: Date.now() - 60000 }),
  'globalchat:msg:1001-b': JSON.stringify({ authorId: 'u-ohne', authorName: 'Aryen82', authorAllianceTag: null, text: 'ohne Kosmetik', ts: Date.now() - 50000 }),
  // Der Faelschungsversuch: fremde Id NICHT gesetzt, aber ein cosmetics-Feld in der Nachricht.
  // Genau so saehe der naheliegende Umsetzungsfehler aus - und genau das darf nichts bewirken.
  'globalchat:msg:1002-c': JSON.stringify({ authorId: 'u-fremd', authorName: 'Faelscher', authorAllianceTag: null, text: 'ich faerbe mich selbst', ts: Date.now() - 40000, cosmetics: GOLD })
};

const EINTRAEGE = {
  ['leaderboard:' + ICH]: JSON.stringify({ id: ICH, name: 'GameGeeeeek', allianceTag: 'GG', score: 1131816, weekScore: 500, weekKey: WOCHE, ships: 900, bp: 400, lastSeen: Date.now(), isSupporter: true, supporterTier: 'gold', cosmetics: GOLD }),
  'leaderboard:u-lume': JSON.stringify({ id: 'u-lume', name: 'Lumekx', allianceTag: 'GG', score: 154896, weekScore: 300, weekKey: WOCHE, ships: 300, bp: 120, lastSeen: Date.now(), isSupporter: true, supporterTier: 'bronze', cosmetics: GOLD }),
  'leaderboard:u-ohne': JSON.stringify({ id: 'u-ohne', name: 'Aryen82', score: 95, weekScore: 10, weekKey: WOCHE, ships: 5, bp: 1, lastSeen: Date.now() - 9e6, isSupporter: false, supporterTier: null, cosmetics: OHNE })
};

function backend(store){ return async r => {
  const req = r.request(); const u = req.url(); const p = u.split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: ICH, username: 'GameGeeeeek', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true, supporter: { active: true, tier: 'gold' } });
  if (p === 'reports') return j({ reports: [] });
  if (p === 'pending-rewards/claim') return j({ reward: null });
  if (p === 'cosmetics') return j({ katalog: [], besitz: [], auswahl: GOLD, staub: 0 });
  if (p === 'storage-list'){
    const pref = decodeURIComponent((u.split('prefix=')[1] || '').split('&')[0]);
    return j({ keys: Object.keys(store).filter(k => k.startsWith(pref)) });
  }
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT') return j({ ok: true, version: 2 });
    if (store[k] !== undefined) return j({ key: k, value: store[k], shared: true, version: 1 });
    return j({ e: 1 }, 404);
  }
  return j([]);
};}

const save = () => JSON.stringify({ tutorialSeen: true, newbieWelcomeSeen: true,
  nextPlanetEventCheck: Date.now() + 3600000, nextTraderCheck: Date.now() + 3600000,
  resources: { energie: 9e8, erz: 9e8, kristalle: 9e8, deuterium: 9e8, antimaterie: 9e6, forschungspunkte: 9e5 },
  buildings: { solar: 30, mine: 28, labor: 20, lager: 60, werft: 20 }, research: {}, fleet: { missions: [], jaeger: 100 },
  colonies: {}, activeBasePlanet: 'home',
  player: { id: ICH, name: 'GameGeeeeek', avatarKey: null, allianceTag: 'GG' },
  friends: [{ id: 'u-lume', name: 'Lumekx' }, { id: 'u-ohne', name: 'Aryen82' }],
  xp: 9e6, credits: 5e6, buffs: [], lastTick: Date.now(), colonyNames: {}, modules: {}, shipModules: {} });

// Je Flaeche zaehlen: Wie oft steht die Goldfarbe da, wie oft das Leuchtfeuer-Icon, und welche
// Namen kommen ueberhaupt vor. Der Namensteil ist die Absicherung dagegen, dass eine Null-Zaehlung
// nur bedeutet, dass die Liste leer ist (Regel 37: eine Pruefung hinter einer nicht eingetretenen
// Bedingung ist gruen ohne Aussage).
// Gezaehlt wird das VOLLSTAENDIGE Attribut, das kosmetikFarbAttr() erzeugt (` style="color:X;"`),
// nicht die blosse Zeichenfolge `color:X`: Die Liga-Pillen schreiben `border-color:` mit denselben
// Farbwerten, und `border-color:#fac775` ENTHAELT `color:#fac775`. Der erste Anlauf zaehlte
// dadurch 4 statt 2 - ein zu weiter Suchausdruck, der wie ein Fehler im Spiel aussah.
const ZAEHLEN = (sel, farbe, icon) => {
  const box = document.querySelector(sel);
  if (!box) return null;
  const html = box.innerHTML || '';
  const txt = box.textContent || '';
  const farbTreffer = html.split('style="color:' + farbe + ';"').length - 1;
  const iconTreffer = html.split('ti ' + icon).length - 1;
  return { farbe: farbTreffer, embleme: iconTreffer,
           hatLumekx: /Lumekx/.test(txt), hatAryen: /Aryen82/.test(txt), hatFaelscher: /Faelscher/.test(txt) };
};

(async () => {
  check('0-vorab: Goldfarbe und Leuchtfeuer-Icon aus KOSMETIK_LOOK abgelesen',
    !!goldFarbe && !!leuchtIcon, { goldFarbe, leuchtIcon });
  if (!goldFarbe || !leuchtIcon) return ende();

  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend(Object.assign({ 'kepler7-save-v3': save() }, EINTRAEGE, CHAT_KEYS)));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4500);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }));
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-tab]')].find(x => x.getAttribute('data-tab') === 'punkte'); if (b) b.click(); });
  await page.waitForTimeout(2600);

  // ============================================================ 1) Die Listen-Flaechen
  const f = await page.evaluate(({ z, farbe, icon }) => {
    const fn = new Function('sel', 'farbe', 'icon', 'return (' + z + ')(sel, farbe, icon)');
    return { volle: fn('#leaderboard', farbe, icon), seite: fn('#fpLeaderboard', farbe, icon),
             freunde: fn('#friendsBox', farbe, icon), liga: fn('#weeklyLeagueBox', farbe, icon) };
  }, { z: ZAEHLEN.toString(), farbe: goldFarbe, icon: leuchtIcon });

  check('1a-vorab: beide Namen stehen ueberhaupt in der vollen Rangliste',
    !!(f.volle && f.volle.hatLumekx && f.volle.hatAryen), f.volle);
  // Zwei Traeger (ich + Lumekx), einer ohne - also GENAU zwei, nie drei.
  check('1a: die volle Rangliste faerbt die Traeger und nur die',
    !!(f.volle && f.volle.farbe === 2 && f.volle.embleme === 2), f.volle);
  check('1b: das Status-Seitenmenue ebenso',
    !!(f.seite && f.seite.farbe === 2 && f.seite.embleme === 2), f.seite);
  // DER BEFUND, der diesen Test ausgeloest hat.
  check('1c-vorab: beide Namen stehen in der Wochenliga (sonst misst 1c nichts)',
    !!(f.liga && f.liga.hatLumekx && f.liga.hatAryen), f.liga);
  check('1c: die Wochenliga faerbt sie auch - sie tat es nie, weil `cosmetics` in ihrer Projektion fehlte',
    !!(f.liga && f.liga.farbe === 2 && f.liga.embleme === 2), f.liga);
  check('1d: die Freundesliste faerbt genau einen der beiden Freunde',
    !!(f.freunde && f.freunde.farbe === 1 && f.freunde.embleme === 1 && f.freunde.hatLumekx && f.freunde.hatAryen), f.freunde);

  // ============================================================ 2) Der Chat
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-tab]')].find(x => x.getAttribute('data-tab') === 'galaxie'); if (b) b.click(); });
  await page.waitForTimeout(2400);
  await page.evaluate(() => { const el = document.getElementById('chatPanelGlobalBox'); if (el) el.style.display = 'block'; });
  await page.waitForTimeout(1800);
  const chat = await page.evaluate(({ z, farbe, icon }) => {
    const fn = new Function('sel', 'farbe', 'icon', 'return (' + z + ')(sel, farbe, icon)');
    return fn('#chatPanelGlobalBox', farbe, icon);
  }, { z: ZAEHLEN.toString(), farbe: goldFarbe, icon: leuchtIcon });

  check('2-vorab: alle drei Nachrichten stehen im Chat (sonst messen 2 und 3 nichts)',
    !!(chat && chat.hatLumekx && chat.hatAryen && chat.hatFaelscher), chat);
  check('2: der Chat faerbt den Traeger - er war bis heute die einzige Namensliste ohne jede Auszeichnung',
    !!(chat && chat.farbe >= 1 && chat.embleme >= 1), chat);

  // ============================================================ 3) Die Sicherheitsprobe
  // Genau EINE Faerbung darf im Chat stehen: die von Lumekx, dessen Bestenlisten-Eintrag sie
  // traegt. Aryen82 hat einen Eintrag ohne Kosmetik, der Faelscher hat gar keinen - dafuer aber
  // ein cosmetics-Feld in seiner NACHRICHT. Kaeme die Zahl auf 2, waere genau der Fehler drin,
  // gegen den dieser Abschnitt gebaut ist.
  check('3: der Faelschungsversuch in der Nachricht bewirkt nichts - gefaerbt wird nach authorId',
    !!(chat && chat.farbe === 1 && chat.embleme === 1),
    { gemessen: chat, hinweis: 'Mehr als 1 = die Nachricht wurde als Quelle benutzt statt der Bestenlisten-Eintrag.' });

  check('keine JS-Fehler', errs.length === 0, errs.slice(0, 3));
  await ctx.close();
  await browser.close();
  return ende();
})().catch(e => { console.error(e); process.exit(1); });
