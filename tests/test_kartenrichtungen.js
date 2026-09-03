// Die Karte in jede Richtung: Wischen ist kein Tipp, und die Pfeiltasten wirken auf allen
// Ebenen, die einen Nachbarn haben (03.09.2026).
//
//   node tests/test_kartenrichtungen.js
//
// ZWEI BEFUNDE, beide am Quelltext gemessen und hier am gerenderten Spiel belegt:
//
//   (a) `galaxyMapDidDrag` schuetzte 13 Klickstellen - ALLE im aufgeklappten System. Die
//       Regionsuebersicht (`[data-sektor]`) und die Sektoransicht (`[data-sektor-sys]`) gingen
//       leer aus, obwohl Schwenken und Zoomen dort genauso aktiv sind (der Handler haengt am
//       `svg`, nicht an einer Ebene). Ein Wischen konnte dort als Tipp durchgehen.
//   (b) Die Pfeiltasten wirkten nur bei offenem System. Der Kommentar begruendete das mit "in den
//       Sektor-Ansichten gibt es kein naechstes System" - das stimmte, als er geschrieben wurde,
//       und war seit KB-4 ueberholt: Die Sektoransicht HAT einen Nachbarsektor, mit Knopf und
//       Wischgeste. Am PC war das die einzige der drei Ebenen ohne Tastenweg.
//
// BEIDE HAELFTEN werden geprueft, und das ist hier die halbe Miete: Ein Wisch-Schutz laesst sich
// trivial erfuellen, indem der Klick GAR NICHTS mehr tut. Jede Sperr-Pruefung hat deshalb ihre
// Gegenrichtung - derselbe Knoten, nur ohne Bewegung, MUSS oeffnen (Hausregel 33).
const { SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

/* DIE MESSVORRICHTUNG - und warum sie mit synthetischen Ereignissen arbeitet.
   Der erste Entwurf fuhr echte Zeigerbewegungen (page.mouse) und scheiterte an etwas, das mit der
   geprueften Regel nichts zu tun hat: Ueber dem Kartenkasten liegt im ausgeloggten Zustand die
   Login-Karte, elementFromPoint liefert dort INPUT#loginPassword statt eines Kartenknotens - in
   beiden erprobten Fenstergroessen. Ein Test, der daran haengt, misst die Ueberdeckung und nicht
   den Wisch-Schutz.
   Gemessen wird deshalb die REGEL an ihrer Quelle: Die Handler lesen mousedown auf dem SVG,
   mousemove am window (Schwelle DRAG_THRESHOLD = 6) und danach das click des Knotens. Genau diese
   drei Ereignisse werden gestellt - derselbe Weg, den tests/lib/karte.js und die uebrigen
   Kartentests dieses Repos seit jeher gehen. */
const WISCH = 40;   // deutlich ueber DRAG_THRESHOLD = 6

// Ein Wischen: druecken, ueber die Schwelle ziehen, dann klickt der Browser den Knoten an.
async function wischenAuf(page, sel){
  return page.evaluate(({ s, w }) => {
    const svg = document.getElementById('galaxyMapSvg');
    const g = document.querySelector(s);
    if (!svg || !g) return false;
    const r = g.getBoundingClientRect();
    const x = r.left + r.width/2, y = r.top + r.height/2;
    svg.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
    for (let i = 1; i <= 4; i++)
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x + (w/4)*i, clientY: y }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x + w, clientY: y }));
    g.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x + w, clientY: y }));
    return true;
  }, { s: sel, w: WISCH });
}
// Ein Tipp: dieselbe Kette OHNE Bewegung.
async function tippenAuf(page, sel){
  return page.evaluate(s => {
    const svg = document.getElementById('galaxyMapSvg');
    const g = document.querySelector(s);
    if (!svg || !g) return false;
    const r = g.getBoundingClientRect();
    const x = r.left + r.width/2, y = r.top + r.height/2;
    svg.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }));
    g.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
    return true;
  }, sel);
}
const knotenDa = (page, sel) => page.evaluate(s => !!document.querySelector(s), sel);

/* Der Tastenhandler kehrt bei einem fokussierten INPUT/TEXTAREA/SELECT sofort zurueck - zu Recht,
   sonst blaetterte die Karte, waehrend jemand seinen Namen tippt. Im ausgeloggten Zustand steht der
   Fokus aber gerade dort: Die Login-Karte liegt ueber dem Kartenkasten, #loginPassword ist ein
   INPUT. Gemessen: Ohne dieses blur() kam KEIN Tastendruck an - weder der Sektorwechsel noch das
   Seiten-Scrollen -, und beide Pruefungen meldeten "wirkt nicht", obwohl der Code stimmte.
   Ein Spieler, der gerade die Karte bedient hat, hat den Fokus nicht im Passwortfeld. */
const fokusAusFormular = page => page.evaluate(() => {
  const a = document.activeElement;
  if (a && a !== document.body && typeof a.blur === 'function') a.blur();
  return document.activeElement ? document.activeElement.tagName : null;
});

async function karteOeffnen(page){
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
     'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
      .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; });
    const b = document.querySelector('.tab-btn[data-tab="karte"]'); if (b) b.click();
  });
  await page.waitForTimeout(1200);
}
// Zur Regionsuebersicht zurueck, egal wo die Karte gerade steht.
async function zurUebersicht(page){
  for (let i = 0; i < 3; i++){
    await page.evaluate(() => {
      const h = document.querySelector('#galaxyMapSvg [data-kb-knopf="heimweg"]');
      if (h) h.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const b = document.getElementById('galaxyBackBtn');
      if (b && b.style.display !== 'none') b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(400);
    if (await knotenDa(page, '#galaxyMapSvg [data-sektor]')) return true;
  }
  return false;
}
const sektorenOffen = page => page.evaluate(() => !!document.querySelector('#galaxyMapSvg [data-sektor-sys]'));
const systemOffen   = page => page.evaluate(() => !!document.querySelector('#galaxyMapSvg [data-planet]'));
const systemListe   = page => page.evaluate(() => [...document.querySelectorAll('#galaxyMapSvg [data-sektor-sys]')]
  .map(g => g.getAttribute('data-sektor-sys')).join(','));

(async () => {
  const browser = await starteBrowser();
  // Dasselbe Fenster wie test_kartenbedienung: Bei 1280x720 liegt die Login-Karte
  // (#loginCardNormal) ueber dem Kartenkasten, elementFromPoint liefert dann INPUT#loginPassword
  // statt eines Knotens - gemessen, nicht vermutet.
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(String(e)));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2500);
  await karteOeffnen(page);
  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));
  check('0-anker: die Regionsuebersicht steht', await zurUebersicht(page), {});

  /* ---- 1) Regionsuebersicht: der Tipp ZUERST ---------------------------------------------------
     Die Reihenfolge ist die Messvorrichtung, nicht Geschmack: Erst wird belegt, dass ein Tipp an
     genau dieser Stelle die Region oeffnet - danach ist "Wischen oeffnet nicht" eine Aussage ueber
     den Wisch-Schutz und nicht ueber einen danebengegangenen Zeiger. */
  check('1-vorab: ein Regionsknoten steht auf der Karte', await knotenDa(page, '#galaxyMapSvg [data-sektor]'), {});
  await tippenAuf(page, '#galaxyMapSvg [data-sektor]');
  await page.waitForTimeout(900);
  const nachTipp1 = await sektorenOffen(page);
  check('1: ein Tipp auf einen Regionsknoten oeffnet die Region', nachTipp1 === true,
    { sektoransichtOffen: nachTipp1 });

  check('1b-vorab: die Uebersicht steht wieder', await zurUebersicht(page), {});
  await wischenAuf(page, '#galaxyMapSvg [data-sektor]');
  await page.waitForTimeout(900);
  const nachWisch1 = await sektorenOffen(page);
  check('1b: ein Wischen ueber DENSELBEN Knoten oeffnet sie NICHT', nachWisch1 === false,
    { sektoransichtOffen: nachWisch1, hinweis: 'ohne galaxyMapDidDrag-Pruefung geht das Wischen als Tipp durch' });

  // Fuer die naechsten Abschnitte muss die Sektoransicht offen sein - der Wisch-Schutz hat sie
  // gerade zugehalten, also einmal richtig tippen.
  await tippenAuf(page, '#galaxyMapSvg [data-sektor]');
  await page.waitForTimeout(900);

  // ---- 2) Sektoransicht: Wischen oeffnet kein System --------------------------------------------
  check('2-vorab: ein Systemknoten der Sektoransicht steht da', await knotenDa(page, '#galaxyMapSvg [data-sektor-sys]'), {});
  await wischenAuf(page, '#galaxyMapSvg [data-sektor-sys]');
  await page.waitForTimeout(900);
  const nachWisch2 = await systemOffen(page);
  check('2: ein Wischen ueber einen Systemknoten oeffnet das System NICHT', nachWisch2 === false,
    { systemOffen: nachWisch2 });
  // Auch hier die Gegenrichtung, sonst belegt 2 nur, dass der Knoten tot ist.
  await tippenAuf(page, '#galaxyMapSvg [data-sektor-sys]');
  await page.waitForTimeout(1200);
  const nachTipp2 = await systemOffen(page);
  check('2b: ein Tipp auf denselben Knoten oeffnet das System sehr wohl', nachTipp2 === true,
    { systemOffen: nachTipp2 });
  /* Zurueck auf die SEKTOREBENE fuer Abschnitt 3 - und zwar ueber den Spielerweg (Uebersicht,
     dann Region antippen), nicht ueber galaxyBackBtn. Gemessen: Der Zurueck-Knopf landet nicht in
     der Sektoransicht, sondern in einer Ansicht mit ALLEN Systemen; karteSektorOffen ist dort
     null, und die Pfeiltasten haetten dort zu Recht nichts zu tun. Der erste Entwurf hat genau
     das gemessen und Abschnitt 3 faelschlich als kaputt gemeldet. */
  check('3-anker: die Sektoransicht laesst sich wieder aufsuchen', await zurUebersicht(page), {});
  await tippenAuf(page, '#galaxyMapSvg [data-sektor]');
  await page.waitForTimeout(900);

  // ---- 3) Pfeiltasten wechseln den Nachbarsektor -------------------------------------------------
  const listeVorher = await systemListe(page);
  check('3-vorab: die Sektoransicht steht und traegt Systeme', listeVorher.length > 0, { listeVorher });
  check('3-fokus: der Fokus liegt nicht in einem Eingabefeld',
    ['BODY', null, 'SVG'].includes(await fokusAusFormular(page)), {});
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(300);
  const scrollVor = await page.evaluate(() => Math.round(window.scrollY));
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(900);
  const listeRechts = await systemListe(page);
  const systemAufgegangen = await systemOffen(page);
  check('3: → wechselt in der Sektoransicht den Nachbarsektor',
    listeRechts.length > 0 && listeRechts !== listeVorher, { listeVorher, listeRechts });
  // Die alte Regel gilt weiter: Auf dieser Ebene darf keine Taste ein SYSTEM oeffnen.
  check('3b: dabei geht kein System auf', systemAufgegangen === false, { systemAufgegangen });
  // Und ← muss zurueckfuehren - ein Schritt vor, einer zurueck, wieder am Ausgangspunkt.
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(900);
  const listeZurueck = await systemListe(page);
  check('3c: ← fuehrt wieder zum Ausgangssektor zurueck',
    listeRechts !== listeVorher && listeZurueck === listeVorher, { listeVorher, listeRechts, listeZurueck });
  /* ↑/↓ bleiben frei (dieselbe Abwaegung wie in test_kartentasten): Sie scrollen die Seite, und
     unter der Karte steht die Detailtafel. Gemessen wird die Regel zweifach - der Sektor darf
     sich NICHT aendern, und wo die Seite ueberhaupt Spielraum hat, muss sie scrollen. Der
     Spielraum wird geprueft, nicht angenommen: Stand die Seite schon am Anschlag, belegte ein
     unveraendertes scrollY gar nichts (Hausregel 34). */
  const spielraum = await page.evaluate(() => {
    window.scrollTo(0, 0);
    return Math.round(document.documentElement.scrollHeight - window.innerHeight);
  });
  await page.waitForTimeout(300);
  const scrollVorAb = await page.evaluate(() => Math.round(window.scrollY));
  await fokusAusFormular(page);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(500);
  const nachAb = await page.evaluate(() => ({ y: Math.round(window.scrollY), liste: [...document.querySelectorAll('#galaxyMapSvg [data-sektor-sys]')].map(g => g.getAttribute('data-sektor-sys')).join(',') }));
  check('3d: ↓ laesst den Sektor unberuehrt - die Karte kapert die Taste nicht',
    nachAb.liste === listeZurueck, { vorher: listeZurueck.slice(0, 60), nachher: nachAb.liste.slice(0, 60) });
  check('3e: und wo die Seite Spielraum hat, scrollt sie weiterhin',
    spielraum <= 0 || nachAb.y > scrollVorAb,
    { spielraum, scrollVor: scrollVorAb, scrollNach: nachAb.y,
      hinweis: spielraum <= 0 ? 'kein Spielraum - die Pruefung ist hier gegenstandslos' : '' });

  check('9: keine Skriptfehler im ganzen Lauf', fehler.length === 0, fehler.slice(0, 3));
  await ctx.close();
  await ende(async () => browser.close());
})();
