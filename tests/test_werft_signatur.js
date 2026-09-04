// Jede Werftkarte zeigt die Signatur - auch die des Superschlachtschiffs (04.09.2026).
//
//   node tests/test_werft_signatur.js
//
// DER ANLASS, gemessen. Seit v8.660.0 verspricht die Patchnote: "Die Zahl steht auf JEDER
// Werftkarte", und "auf der Werftkarte steht ab 600 gleich dabei, was das bedeutet". Die Zeile
// wurde bewusst NEBEN die 25-Zweig-Metakette gesetzt, weil 20 der 45 Schiffe dort gar keine Zeile
// bekommen - richtig entschieden, und trotzdem blieb eine Karte uebrig:
//
// Die Werft baut ihre Karten an ZWEI Orten. Die datengetriebene Schleife ueber SHIP_DEFS bekam die
// Zeile; der handgeschriebene Block des Superschlachtschiffs nicht - das Schiff steht wie ueberall
// in keiner Liste. Ausgerechnet dort faellt es auf: Signatur 800 liegt ueber TARNUNG_GRENZE, es ist
// also das EINZIGE Schiff der Werft, bei dem der Zusatz "nicht zu verbergen" ueberhaupt zutrifft
// (Kausalitaetsbrecher und Mondzerstoerer stehen mit 1000 in SHIP_DEFS und bekamen ihn).
//
// WIE HIER GEPRUEFT WIRD: an der GERENDERTEN Karte, nicht am Quelltext. Eine Zaehlpruefung ueber
// die Datei ("wie oft kommt die Zeile vor?") kann nicht wissen, ob eine handgeschriebene Karte
// daneben steht, die sie nicht hat - genau das war der Fehler. Der Test misst die REGEL:
// jede Schiffskarte in der Werft traegt die Zeile. Eine kuenftige Sonderkarte faellt damit auf,
// ohne dass jemand daran denken muss.
const { starteBrowser, SPIEL_URL, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const FILE = SPIEL_URL;

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId:'u', username:'Werfttest', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData() || '{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p))
    return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

/* Das Superschlachtschiff ist freigeschaltet UND vorhanden: Nur dann zeichnet die Werft seine
   volle Karte (die gesperrte Fassung ist ein anderer Block - der traegt die Zeile ebenfalls, steht
   hier aber nicht im Bild). Genug Ressourcen, damit keine Karte an einer Kostenpruefung haengt. */
const SPIELSTAND = JSON.stringify({
  tutorialSeen: true, newbieWelcomeSeen: true,
  resources: { energie:999999, erz:999999, kristalle:999999, deuterium:99999, antimaterie:9999, forschungspunkte:9999 },
  buildings: { solar:12, mine:12, werft:10, labor:8 },
  research: { rkampf:10, rkampf2:10, rantimaterie:10 },
  fleet: { superschlachtschiff:1, jaeger:5, schlachtschiff:2, missions:[] },
  colonies: {}, activeBasePlanet: 'home',
  player: { id:'u', name:'Werfttest', allianceTag:'', avatarKey:null },
  battleStats: { wins:0, losses:0 }, xp:5000, buffs:[], lastTick: Date.now(),
  colonyNames:{}, colonyNotes:{}, modules:{}, shipModules:{}, equippedShipModules:{}, moduleFragments:0,
  rareItems: { antimateriekern:1 },
  unlocked: { superschlachtschiff:true }
});

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport:{ width:1100, height:1600 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const store = { 'kepler7-save-v3': SPIELSTAND };
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token','tok'); });
  await page.goto(FILE); await page.waitForTimeout(2500);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display='none'; }); });

  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="flotte"]'); if (b) b.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const b = document.querySelector('[data-fleet-subtab="werft"]') || document.querySelector('[data-fleet-subtab]');
    if (b) b.click();
  });
  await page.waitForTimeout(1200);

  const karten = await page.evaluate(() => [...document.querySelectorAll('#fleet .card-row.ship-card')].map(c => ({
    name: (c.querySelector('.bname') ? c.querySelector('.bname').textContent : '').replace(/\s+/g,' ').trim().slice(0,40),
    text: c.textContent.replace(/\s+/g,' '),
    super: !!c.querySelector('[data-scrapship="superschlachtschiff"]')
  })));

  // ---- 1) Die Regel ----------------------------------------------------------------------------
  /* Der Anker zuerst: Ohne ihn waere "alle Karten tragen die Zeile" bei NULL Karten gruen - die
     haeufigste Art, wie eine Vollstaendigkeitspruefung nichts belegt. */
  check('1-anker: die Werft zeigt eine ganze Reihe Schiffskarten', karten.length >= 10, karten.length);
  const ohne = karten.filter(k => !/Signatur/.test(k.text)).map(k => k.name);
  check('1: JEDE Schiffskarte der Werft zeigt die Signatur', ohne.length === 0, { ohne });

  // ---- 2) Der gemessene Anlassfall -------------------------------------------------------------
  const sup = karten.find(k => k.super);
  check('2-anker: die Karte des Superschlachtschiffs steht im Bild', !!sup, sup ? sup.name : karten.map(k=>k.name).slice(0,6));
  if (sup){
    check('2: sie nennt die Signatur 800', /Signatur\s*800/.test(sup.text), sup.text.slice(0,200));
    /* Der Zusatz ist der eigentliche Inhalt der Zusage: 800 liegt ueber der Grenze, und das
       Superschlachtschiff ist das einzige Schiff der Werft, bei dem er ueberhaupt faellig wird -
       Kausalitaetsbrecher und Mondzerstoerer (1000) stehen in SHIP_DEFS und hatten ihn immer. */
    check('2b: und den Zusatz "nicht zu verbergen"', /nicht zu verbergen/.test(sup.text), sup.text.slice(0,200));
  }

  // ---- 3) Gegenrichtung: der Zusatz ist NICHT ueberall -------------------------------------------
  /* Ohne diese Pruefung waere eine Fassung gruen, die den Zusatz bedingungslos an jede Karte
     haengt - dann stuende an einem Jaeger (Signatur 10) "nicht zu verbergen", und die Zeile
     saegte die Aussage ab, die sie treffen soll. */
  const mitZusatz = karten.filter(k => /nicht zu verbergen/.test(k.text)).length;
  check('3: der Zusatz steht NICHT auf jeder Karte', mitZusatz > 0 && mitZusatz < karten.length,
    { mitZusatz, karten: karten.length });

  check('4: keine JS-Fehler', errs.length === 0, errs.slice(0,3));

  await ctx.close(); await browser.close();
  ende();
})();
