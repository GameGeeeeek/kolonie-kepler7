// Zwei Wege, auf denen der Spieler etwas verliert, ohne es zu wollen (gefunden bei der
// Ursachensuche zum Report vom 14.09.2026, bewusst erst nach v8.732.0 angefasst):
//
//   A) Der ABMELDEKNOPF lud neu, ohne zu speichern - bis zu zehn Sekunden Fortschritt weg, und der
//      Bestätigungsdialog verspricht wörtlich das Gegenteil. Die Reihenfolge ist dabei die ganze
//      Sache: sitzungBeenden() setzt sitzungAktiv = false, danach ist useBackend() false und ein
//      save() ginge in den LOKALEN Speicher statt auf den Server. Gespeichert werden muss also
//      VOR dem Abmelden. Genau das misst 1b - über die Reihenfolge der Server-Aufrufe, nicht über
//      einen Endzustand, der auch aus einem lokalen Schreibvorgang stammen könnte.
//
//   B) Das ✕ (und die Pfeile) an beiden Warteschlangen entfernten nach POSITION aus der letzten
//      Zeichnung. Verschiebt sich die Liste zwischen Zeichnung und Klick, trifft es einen anderen
//      Eintrag. Gemessen wird die Regel: Es geht der Eintrag, der am Knopf steht - nicht der, der
//      zufällig gerade an dieser Stelle liegt.
//
// GEGENPROBE (gemessen, beide Richtungen, Prüfnamen per diff verglichen - identisch):
//   neuer Stand -> Exit 0, alle 8 Prüfungen grün
//   alter Stand -> Exit 1, sechs fallen; die Messwerte sind der eigentliche Beleg:
//     1a / 1b   Spur ["logout","save"] - erst abgemeldet, DANN gespeichert. Und dieses Speichern
//               ist wertlos: nach sitzungBeenden() ist useBackend() false, es ginge in den
//               lokalen Speicher. Auf dem Server kommt nichts an.
//     B1        gemessen ["synth"] statt ["fusionsreaktor"] - das ✕ hat den FALSCHEN Eintrag
//               entfernt. Das ist die Form, die ein Spieler als "mein Eintrag ist weg" erlebt.
//     B2        gemessen ["synth","fusionsreaktor"] - der Klick tat stumm gar nichts.
//     B1/B2-anker  data-bq-key gab es noch nicht (null).
//   1c ist an BEIDEN Ständen grün: Der Serverstand geht beim Abmelden nicht kaputt, er ist nur
//   nicht aktuell. Ohne diese Prüfung könnte 1a/1b grün werden, indem beim Abmelden irgendetwas
//   geschrieben wird - auch etwas Falsches.
//   Alter Stand: KEPLER_SPIELDATEI=<kopie von HEAD> node tests/test_verlustwege_knoepfe.js
const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

const FILE = SPIEL_URL;
const MEIN_ID = 'u';
const KEY = 'kepler7-save-v3';
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// Der Mock schneidet die REIHENFOLGE der Aufrufe mit - darauf kommt es bei A an.
function backend(store, spur){ return async r => {
  const req = r.request(); const u = new URL(req.url()); const p = u.pathname.split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: MEIN_ID, username: 'Knopftest', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0, hasEmail: true, wantsPatchnotes: true });
  if (p === 'logout'){ spur.push('logout'); return j({ ok: true }); }
  if (p === 'storage-list') { const prefix = u.searchParams.get('prefix') || ''; return j({ keys: Object.keys(store).filter(k => k.startsWith(prefix) && !k.startsWith('__v:')) }); }
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){
      if (k === KEY) spur.push('save');
      try { store[k] = JSON.parse(req.postData() || '{}').value; store['__v:'+k] = (store['__v:'+k]||0)+1; } catch(e){}
      return j({ ok: true, version: store['__v:'+k] });
    }
    if (store[k] !== undefined) return j({ key: k, value: store[k], version: store['__v:'+k]||1 });
    return j({ e: 1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward: null } : []);
  return j({});
};}

const stand = (extra) => JSON.stringify(Object.assign({
  tutorialSeen: true, newbieWelcomeSeen: true, seenTabHints: {},
  resources: { energie: 5, erz: 5, kristalle: 0, deuterium: 0, antimaterie: 0, forschungspunkte: 0 },
  buildings: { solar: 1, mine: 1, labor: 1 }, research: {},
  fleet: { jaeger: 0, missions: [] }, colonies: {}, activeBasePlanet: 'home',
  player: { id: MEIN_ID, name: 'Knopftest', allianceTag: null, avatarKey: null },
  battleStats: { wins: 0, losses: 0 }, xp: 0, buffs: [],
  colonyNames: {}, modules: {}, shipModules: {}, equippedShipModules: {}
}, extra));

async function laden(browser, extra){
  const store = { [KEY]: stand(extra) };
  const spur = [];
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1100 } });
  const page = await ctx.newPage();
  await page.route('**/api/**', backend(store, spur));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  // confirm() beantwortet im Test niemand - und beim Abmelden wie beim Baustellen-Konto haengt
  // genau daran der Ablauf. Immer JA. (Nicht auswerten: Der Abmeldeknopf laedt die Seite neu, ein
  // Merker im Fenster ueberlebt das nicht. Die Spur liegt deshalb im Testprozess, nicht im Browser.)
  await page.addInitScript(() => { window.confirm = () => true; });
  await page.goto(FILE);
  await page.waitForTimeout(4000);
  await page.evaluate(() => { ['welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  return { ctx, page, store, spur };
}
const gespeichert = (store) => { try { return JSON.parse(store[KEY]); } catch(e){ return {}; } };

(async () => {
  const browser = await starteBrowser();

  // ================================================= A) Abmelden speichert - und zwar VORHER
  {
    // fusionsreaktor kostet Deuterium und Kristalle, davon hat der Stand nichts und produziert
    // auch nichts - der Eintrag kann also nicht abgearbeitet werden und verschwindet nur, wenn er
    // verloren geht. (Ein billiges Gebaeude hatte sich im ersten Entwurf selbst weggebaut, und die
    // Pruefung haette das als Datenverlust gemeldet.)
    const { ctx, page, store, spur } = await laden(browser, {
      buildQueue: [{ planet: 'home', key: 'fusionsreaktor' }]
    });

    /* Auf einen Takt-Schreibvorgang WARTEN und erst dann abmelden: Danach ist der naechste Takt
       zehn Sekunden entfernt (setInterval(save, 10000)), ein 'save' im Messfenster kann also nur
       vom Abmelden stammen. Ohne dieses Warten waere 1a auch am alten Stand irgendwann gruen -
       naemlich dann, wenn zufaellig ein Takt dazwischenfaellt. */
    spur.length = 0;
    for (let i = 0; i < 40 && !spur.includes('save'); i++) await page.waitForTimeout(500);
    check('A-anker: der Takt schreibt (sonst misst das Zeitfenster nichts)', spur.includes('save'), spur);
    spur.length = 0;

    await page.evaluate(() => document.getElementById('logoutBtn').click());
    await page.waitForTimeout(2500);
    const fenster = spur.slice(0, spur.indexOf('logout') + 1);

    check('1a: beim Abmelden wird gespeichert', fenster.includes('save'), spur.slice(0, 6));
    check('1b: und zwar VOR dem Abmelden (sonst ginge es in den lokalen Speicher)',
      spur.indexOf('logout') >= 0 && spur.indexOf('save') >= 0 && spur.indexOf('save') < spur.indexOf('logout'),
      spur.slice(0, 6));
    check('1c: der Spielstand auf dem Server ist danach unversehrt',
      (gespeichert(store).buildQueue || []).some(q => q.key === 'fusionsreaktor'),
      (gespeichert(store).buildQueue || []).map(q => q.key));
    await ctx.close();
  }

  // ================================================= B) Das ✕ trifft den Eintrag, nicht die Stelle
  // Zwei Formen desselben Fehlers, beide gemessen:
  //   B1 der veraltete Index zeigt noch INS Feld -> es geht der FALSCHE Eintrag
  //   B2 der veraltete Index zeigt DAHINTER      -> es geht gar nichts, stumm
  // B1 ist die schlimmere und die, die ein Spieler als "mein Eintrag ist weg" erlebt.
  for (const fall of [
    { name: 'B1', stale: '1', erwartetNeu: ['fusionsreaktor'], erwartetAlt: ['synth'] },
    { name: 'B2', stale: '2', erwartetNeu: ['synth'],          erwartetAlt: ['synth','fusionsreaktor'] },
  ]){
    const { ctx, page, store } = await laden(browser, {
      buildQueue: [{ planet: 'home', key: 'raffinerie' }, { planet: 'home', key: 'synth' }, { planet: 'home', key: 'fusionsreaktor' }]
    });
    const gezeichnet = await page.evaluate(() => Array.from(document.querySelectorAll('#buildQueueBox [data-buildqueue-remove]')).map(b => b.getAttribute('data-bq-key')));
    check(fall.name+'-anker: die drei Einträge sind gezeichnet und tragen ihren Schlüssel',
      JSON.stringify(gezeichnet) === JSON.stringify(['raffinerie','synth','fusionsreaktor']), gezeichnet);

    /* Den Knopf aus der AKTUELLEN Zeichnung festhalten und dann die Liste unter ihm wegziehen -
       genau die Lage, die der Takt erzeugt, waehrend der Spieler zielt. Der festgehaltene Knopf
       bleibt danach im Speicher, auch wenn die Box neu gezeichnet wird; er traegt also noch die
       alte Position UND (seit der Reparatur) den alten Schluessel. */
    const alterKnopf = await page.evaluateHandle(st => document.querySelector('#buildQueueBox [data-buildqueue-remove="'+st+'"]'), fall.stale);
    await page.evaluate(() => document.querySelector('#buildQueueBox [data-buildqueue-remove="0"]').click());
    await page.waitForTimeout(400);
    await alterKnopf.evaluate(el => el.click());
    await page.waitForTimeout(500);

    const rest = (gespeichert(store).buildQueue || []).map(q => q.key);
    check(fall.name+': das ✕ trifft den Eintrag, der an ihm steht (nicht die Position)',
      JSON.stringify(rest) === JSON.stringify(fall.erwartetNeu),
      { gemessen: rest, erwartet: fall.erwartetNeu, amAltenStand: fall.erwartetAlt });
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? 'FAIL - Verlustwege Knöpfe' : 'OK - Verlustwege Knöpfe');
  process.exit(fail ? 1 : 0);
})();
