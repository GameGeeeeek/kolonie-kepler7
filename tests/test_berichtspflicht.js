// Jeder Angriff braucht einen Bericht, den der Spieler auch SIEHT und VERSTEHT.
//
// AUFTRAG (Sascha, 19.08.2026): "fuer alle angriffe egal ob auf alien spieler bastionen bericht
// verfassen das der spieler nachvollziehen kann was geschehen ist pruefe ob ueberall vorhanden."
//
// DER ANLASS, gemessen am Stand v8.585.0:
//   moon-siege und moon-siege-defense wurden erzeugt (Z. 52630/52654/52658), aber renderReportsBox
//   kannte sie nicht - und die Verzweigungskette dort endet OHNE Abschluss-`else`. `title` und
//   `body` blieben auf '', gemessen im Browser eine Karte mit 22 Zeichen: Ergebnis-Pille und Datum,
//   sonst nichts. Ein Angriff auf einen fremden SPIELER, und der Bericht sagte gar nichts.
//   Schlimmer noch die Einfaerbung: `reportIsPositive` behandelt `result==='destroyed'` seit
//   v8.430.0 pauschal als Erfolg ("zerstoerte GEGNERISCHE Basis"). Beim Verteidiger heisst dasselbe
//   Wort das Gegenteil - gemessen stand "Gewonnen" ueber dem dauerhaften Verlust einer Kolonie und
//   "Verloren" ueber einer geglueckten Abwehr.
//
// WARUM DIESER TEST DATENGETRIEBEN IST (Hausregel 40):
//   Eine namensbasierte Suche findet nur, woran man schon gedacht hat. Der Test liest deshalb ALLE
//   `pushReport({ type:'X'` aus der Spieldatei und haelt sie gegen die Zweige des Zeichners und
//   gegen REPORT_CATEGORIES. Eine kuenftige Angriffsart ohne Zeichner-Zweig faellt damit auf, ohne
//   dass jemand sie kennen muss - und die Gegenrichtung (ein Zweig ohne Erzeuger) ebenso.
//
// Abschnitt 1 misst den Quelltext, Abschnitt 2 das GERENDERTE Spiel (Hausregel 61: nicht das
// Etikett pruefen, sondern die Wirkung).
//
// ZUR SCHRANKE IN ABSCHNITT 2: Der erste Entwurf verlangte eine Mindest-ZEICHENZAHL (40, weil die
// leere Karte gemessen 22 traegt). Das ist eine Momentaufnahme (Hausregel 3) und schlug prompt bei
// `random-event` an - einer voellig korrekten, nur kurzen Karte. Gemessen wird jetzt die REGEL:
// Was bleibt uebrig, wenn man Ergebnis-Pille und Zeitstempel abzieht? Bei der leeren Karte ist das
// exakt nichts, bei jeder sprechenden etwas.

const { starteBrowser, SPIEL_URL, SPIELDATEI, pruefer } = require('./lib/umgebung');
const fs = require('fs');

const { check, ende } = pruefer();
const S = fs.readFileSync(SPIELDATEI, 'utf8');

// PATCHNOTES sind unveraenderliche Historie und zitieren Behebungen woertlich - jede VERNEINENDE
// Aussage ueber die Datei muss sie ausschneiden (Hausregel 46).
const OHNE_HISTORIE = (() => {
  const v = S.indexOf('  const PATCHNOTES = [');
  const b = v < 0 ? -1 : S.indexOf('\n  ];', v);
  return (v >= 0 && b > v) ? S.slice(0, v) + S.slice(b) : S;
})();

// ---- Abschnitt 1: Quelltext -----------------------------------------------------------------

// Der Zeichner-Block. Sein Anker wird SELBST geprueft - fehlt er, liefe der Slice bis fast ans
// Dateiende und jede Aussage darueber waere vacuous (Hausregel 6).
const zA = OHNE_HISTORIE.indexOf('  function renderReportsBox(){');
check('1-anker: renderReportsBox gefunden', zA > 0, { index: zA });
const zRest = zA > 0 ? OHNE_HISTORIE.slice(zA) : '';
const zEnde = zRest.indexOf('\n  function ', 200);
check('1-anker2: Blockende gefunden', zEnde > 0, { laenge: zEnde });
const ZEICHNER = (zA > 0 && zEnde > 0) ? zRest.slice(0, zEnde) : '';

const erzeugt = [...new Set((OHNE_HISTORIE.match(/pushReport\(\{ *type: *'[a-z0-9-]+'/g) || [])
  .map(t => t.split("'")[1]))].sort();
const gezeichnet = new Set((ZEICHNER.match(/r\.type *=== *'[a-z0-9-]+'/g) || []).map(t => t.split("'")[1]));

check('1-vorab: es werden ueberhaupt Berichtsarten erzeugt', erzeugt.length >= 15, { anzahl: erzeugt.length });
check('1-vorab2: der Zeichner kennt ueberhaupt Arten', gezeichnet.size >= 15, { anzahl: gezeichnet.size });

const ohneZweig = erzeugt.filter(t => !gezeichnet.has(t));
check('1a: JEDE erzeugte Berichtsart hat einen Zeichner-Zweig', ohneZweig.length === 0, { ohneZweig });

// Gegenrichtung (Hausregel 33): Ein Zweig, den nichts mehr erzeugt, ist toter Code - ausser er
// gehoert zu einer Art, die der SERVER erzeugt. Die stehen namentlich hier, damit ein Wegfall
// auffaellt statt stillschweigend zu passieren.
const VOM_SERVER = new Set(['attack-sent','attack-received','sabotage-sent','sabotage-received',
                            'raid','npc-attack','player-attack']);
const ohneErzeuger = [...gezeichnet].filter(t => !erzeugt.includes(t) && !VOM_SERVER.has(t)).sort();
check('1b: kein Zeichner-Zweig ohne Erzeuger', ohneErzeuger.length === 0, { ohneErzeuger });

// Kategorien: Wer durch alle Listen faellt, landet ueber den Rueckfall in 'Sonstiges'. Fuer einen
// KAMPF-Bericht ist das eine Falschaussage - gemessen lagen moon-siege, moon-siege-defense und
// pvp-fleet-loss dort, der Kampf-Filter zeigte 2 von 5.
const kA = OHNE_HISTORIE.indexOf('  const REPORT_CATEGORIES = [');
check('1-anker3: REPORT_CATEGORIES gefunden', kA > 0, { index: kA });
const kBlock = kA > 0 ? OHNE_HISTORIE.slice(kA, OHNE_HISTORIE.indexOf('\n  ];', kA)) : '';
const inKategorie = new Set((kBlock.match(/'[a-z0-9-]+'/g) || []).map(t => t.slice(1, -1)));

// Was ein KAMPF-Bericht ist, wird aus den DATEN abgeleitet statt benannt: Jede Art, deren
// Zeichner-Zweig von einem Kampfausgang spricht (Verluste, Angreifer, zerstoert, abgewehrt).
const KAMPF_MERKMAL = /ownLostShips|lostShips|lostText|attackerName|attackerTag|verluste|Verluste|ZERSTÖRT|abgewehrt|durchbrochen/;
const kampfArten = erzeugt.filter(t => {
  const i = ZEICHNER.indexOf("r.type === '" + t + "'");
  if (i < 0) return false;
  const j = ZEICHNER.indexOf("} else if (r.type ===", i + 10);
  return KAMPF_MERKMAL.test(ZEICHNER.slice(i, j > i ? j : i + 1600));
});
check('1-vorab3: es wurden Kampf-Berichtsarten erkannt', kampfArten.length >= 5, { kampfArten });

const kampfOhneKategorie = kampfArten.filter(t => !inKategorie.has(t));
check('1c: jede Kampf-Berichtsart steht in einer Kategorie', kampfOhneKategorie.length === 0,
  { kampfOhneKategorie, hinweis: 'sonst faellt sie ueber den Rueckfall auf "Sonstiges"' });

// ---- Abschnitt 2: das gerenderte Spiel -------------------------------------------------------
//
// Hausregel 61: Zu jeder Pruefung "der Zweig existiert" gehoert eine, die MISST, was der Spieler
// sieht. Gefuettert wird je Art ein synthetischer Bericht; verlangt ist eine Karte, die mehr als
// Pille und Datum traegt. Die Schranke ist als REGEL formuliert (Hausregel 3): Der reine
// Pille-plus-Datum-Rumpf ist gemessen 22 Zeichen lang.
// Pille und Datum sind das, was der Zeichner IMMER schreibt - auch fuer eine Art, die er nicht
// kennt. Alles darueber hinaus ist die eigentliche Auskunft.
const ohnePilleUndDatum = t => t
  .replace(/Gewonnen|Verloren|Abgewehrt|Angeschlagen|Erlegt/g, '')
  .replace(/\d\d\.\d\d\., \d\d:\d\d/g, '')
  .replace(/\s+/g, ' ').trim();

function backend(berichte){ return route => {
  const p = route.request().url().split('/api/')[1].split('?')[0];
  const j = (b, s) => route.fulfill({ status: s || 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p === 'reports') return j({ reports: berichte });
  if (p.startsWith('storage/')) return j({ e:1 }, 404);
  if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p))
    return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

// Ein Bericht je erzeugter Art, mit den Feldern, die die Zweige ueblicherweise lesen. Absichtlich
// GENERISCH: Der Test soll eine neue Art abdecken, ohne dass jemand ihre Felder hier nachtraegt -
// ein Zweig, der bei fehlenden Feldern eine leere Karte baut, ist selbst ein Befund.
const felder = t => ({
  id: 'r-' + t, time: Date.now(), type: t, result: 'destroyed',
  targetName:'Ziel', targetMoonName:'Luna', targetPlayerName:'Gegner', moonName:'Mein Mond',
  attackerName:'Angreifer', attackerTag:'ABC', targetTag:'XYZ', fleetName:'Verband',
  system:'chronos', systemName:'Chronos', chancePct:50, battlePoints:10, damage:100,
  attackPower:1000, defensePower:500, fromPlanet:'Kepler-7b', debrisPlanet:'home',
  itemName:'Fund', rewardLabel:'Belohnung', eventName:'Ereignis', choice:'A', outcome:'B',
  systemName2:'', rank:1, escortPower:100, stufe:'Schanze', volk:'Kryll-Schwarm',
  sorte:'eisen', groesse:'gross', collected:{}, totalCollected:0, recyclerCount:1, durationSec:60
});

(async () => {
  const browser = await starteBrowser();
  const berichte = erzeugt.map(felder);
  const ctx = await browser.newContext({ viewport:{ width:1100, height:1600 } });
  const page = await ctx.newPage();
  const seitenfehler = []; page.on('pageerror', e => seitenfehler.push(String(e.message || e)));
  await page.route('**/api/**', backend(berichte));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token','tok'); });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3000);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
    'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }));
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="berichte"]'); if (b) b.click(); });
  await page.waitForTimeout(2000);

  const gemessen = await page.evaluate(() => {
    const box = document.getElementById('reportsBox');
    if (!box) return null;
    // Die Karten sind die direkten Kinder mit Zeitstempel - der Zeichner baut sie so.
    return [...box.children]
      .filter(el => /\d\d\.\d\d\., \d\d:\d\d/.test(el.textContent))
      .map(el => el.textContent.replace(/\s+/g, ' ').trim());
  });

  check('2-vorab: der Berichte-Reiter hat alle Karten gezeichnet',
    Array.isArray(gemessen) && gemessen.length === berichte.length,
    { gezeichnet: gemessen ? gemessen.length : null, erwartet: berichte.length });

  const stumm = (gemessen || []).map((t, i) => ({ art: erzeugt[i], uebrig: ohnePilleUndDatum(t) }))
    .filter(x => x.uebrig.length === 0);
  check('2: JEDE Berichtskarte sagt mehr als Pille und Datum', stumm.length === 0,
    { stumm: stumm.map(x => x.art),
      beleg: (gemessen || []).map((t, i) => erzeugt[i] + ':' + ohnePilleUndDatum(t).length).join(' ') });

  check('2b: keine Seitenfehler beim Zeichnen', seitenfehler.length === 0, { seitenfehler: seitenfehler.slice(0,3) });

  // ---- Abschnitt 3: die Verteidiger-Seite darf einen Verlust nicht als Sieg zeichnen ----------
  //
  // Gemessen als PAAR - jede Haelfte allein waere auch dann erfuellt, wenn die Einfaerbung
  // komplett fehlte (Hausregel 61/62).
  const paar = [
    { id:'d1', time:Date.now(), type:'moon-siege-defense', result:'destroyed', attackerName:'X', moonName:'Mond' },
    { id:'d2', time:Date.now(), type:'moon-siege-defense', result:'survived',  attackerName:'X', moonName:'Mond' }
  ];
  const ctx2 = await browser.newContext({ viewport:{ width:1100, height:1600 } });
  const page2 = await ctx2.newPage();
  await page2.route('**/api/**', backend(paar));
  await page2.addInitScript(() => { localStorage.setItem('kepler7_token','tok'); });
  await page2.goto(SPIEL_URL);
  await page2.waitForTimeout(3000);
  await page2.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
    'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }));
  await page2.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="berichte"]'); if (b) b.click(); });
  await page2.waitForTimeout(2000);
  const urteile = await page2.evaluate(() => {
    const box = document.getElementById('reportsBox');
    return [...box.children].filter(el => /\d\d\.\d\d\., \d\d:\d\d/.test(el.textContent))
      .map(el => /Gewonnen/.test(el.textContent) ? 'Gewonnen' : (/Verloren/.test(el.textContent) ? 'Verloren' : '?'));
  });
  check('3-vorab: beide Verteidigungs-Karten gezeichnet', urteile.length === 2, { urteile });
  check('3: mein zerstoerter Mond gilt NICHT als Sieg', urteile[0] === 'Verloren', { urteile });
  check('3b: mein verteidigter Mond gilt als Sieg', urteile[1] === 'Gewonnen', { urteile });

  // ---- Abschnitt 4: ein Angriff OHNE Kampf nennt seinen Grund --------------------------------
  //
  // Neun Stellen schrieben ihren Grund bis v8.588.0 ausschliesslich ins `#log` - und das hat keinen
  // Stapel, `log()` ueberschreibt sich mit der naechsten Meldung selbst (Hausregel 47). Beim
  // OFFLINE-Nachholen (showLog === false) erschien er nie. Sie delegieren jetzt an
  // `angriffOhneKampf`; der Zeichner faengt `keinKampf` in EINEM Zweig ab.
  const einmal = (OHNE_HISTORIE.match(/function angriffOhneKampf\(/g) || []).length;
  check('4a: angriffOhneKampf ist genau EINMAL definiert', einmal === 1, { definitionen: einmal,
    hinweis: 'eine zweite Kopie kann wieder auseinanderlaufen - das war der Vorfall (Hausregel 43)' });

  const aufrufer = (OHNE_HISTORIE.match(/angriffOhneKampf\(/g) || []).length - einmal;
  check('4b: der Helfer hat Aufrufer', aufrufer >= 8, { aufrufer });

  // Der Weltboss-Zweig hatte ein leeres `catch(e){}` - ein Netzabbruch liess die Mission SPURLOS
  // verschwinden. Geprueft wird die URSACHE, nicht die Schreibweise (Hausregel 40): Der catch des
  // Weltboss-Aufrufs muss einen Bericht erzeugen.
  const wbA = OHNE_HISTORIE.indexOf("'/worldboss/resolve'");
  check('4-anker: Weltboss-Aufloesung gefunden', wbA > 0, { index: wbA });
  const wbBlock = wbA > 0 ? OHNE_HISTORIE.slice(wbA, wbA + 6000) : '';
  const wbCatch = /\} catch\(e\)\{\s*\}/.test(wbBlock);
  check('4c: der Weltboss-catch verschluckt den Fehler NICHT mehr', !wbCatch,
    { leererCatch: wbCatch, hinweis: 'ein leerer catch laesst die Mission spurlos verschwinden' });
  check('4d: der Weltboss-Block erzeugt Berichte fuer seine Ausgaenge ohne Kampf',
    (wbBlock.match(/angriffOhneKampf\(/g) || []).length >= 3,
    { treffer: (wbBlock.match(/angriffOhneKampf\(/g) || []).length });

  // ---- Abschnitt 5: gemessen im Spiel ---------------------------------------------------------
  const ohneKampf = [
    { id:'k1', time:Date.now(), type:'nest-angriff', keinKampf:true, ziel:'Nest der Kryll bei Chronos',
      grund:'Das Nest war bei der Ankunft nicht mehr da – gefallen oder weitergezogen.' },
    { id:'k2', time:Date.now(), type:'npc-attack', keinKampf:true, ziel:'Weltboss',
      grund:'Die Verbindung brach ab, bevor der Angriff ausgewertet werden konnte – deine Flotte ist unversehrt.' }
  ];
  const ctx3 = await browser.newContext({ viewport:{ width:1100, height:1600 } });
  const page3 = await ctx3.newPage();
  await page3.route('**/api/**', backend(ohneKampf));
  await page3.addInitScript(() => { localStorage.setItem('kepler7_token','tok'); });
  await page3.goto(SPIEL_URL);
  await page3.waitForTimeout(3000);
  await page3.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
    'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
    .forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }));
  await page3.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="berichte"]'); if (b) b.click(); });
  await page3.waitForTimeout(2000);
  const karten3 = await page3.evaluate(() => {
    const box = document.getElementById('reportsBox');
    return [...box.children].filter(el => /\d\d\.\d\d\., \d\d:\d\d/.test(el.textContent))
      .map(el => el.textContent.replace(/\s+/g,' ').trim());
  });
  check('5-vorab: beide Karten ohne Kampf gezeichnet', karten3.length === 2, { anzahl: karten3.length });

  // Die eigentliche Aussage: der GRUND steht auf der Karte. Geprueft wird die Regel (der Grundtext
  // taucht auf), nicht eine Schreibweise (Hausregel 3).
  const grundFehlt = ohneKampf.filter((r, i) => !(karten3[i] || '').includes(r.grund.slice(0, 40)));
  check('5: die Karte nennt den GRUND, warum kein Kampf stattfand', grundFehlt.length === 0,
    { ohneGrund: grundFehlt.map(r => r.type), gemessen: karten3.map(t => t.slice(0, 70)) });

  // Gegenrichtung: Ein Ausgang, der nichts gekostet hat, darf nicht als Niederlage dastehen.
  const alsVerlust = karten3.filter(t => /Verloren/.test(t));
  check('5b: kein Kampf gilt NICHT als Niederlage', alsVerlust.length === 0,
    { alsVerlust: alsVerlust.map(t => t.slice(0, 60)) });

  // ---- Abschnitt 6: ein abgeprallter Angriff zaehlt NICHT als verlorener Kampf ---------------
  //
  // Der Nebeneffekt, der beim Erweitern auf attack-player fast durchgerutscht waere: Ein
  // `keinKampf`-Bericht vom Typ `player-attack` faellt in `battleOutcomeOf` auf die Zeile
  //   if (r.type === 'npc-attack' || r.type === 'player-attack') return r.result === 'win' ? 'win' : 'loss';
  // und haette einen am Schutzschild abgeprallten Angriff als NIEDERLAGE in die Kampf-Bilanz
  // geschrieben. Gemessen wird die WIRKUNG (der Zaehler bewegt sich nicht), nicht die Zeile.
  const bilanz = [
    { id:'b1', time:Date.now(), type:'player-attack', keinKampf:true, ziel:'Gegner',
      grund:'Das Ziel stand unter Angriffs-Schutzschild – der Angriff prallte ab.' }
  ];
  const ctx4 = await browser.newContext({ viewport:{ width:1100, height:1400 } });
  const page4 = await ctx4.newPage();
  await page4.route('**/api/**', backend(bilanz));
  await page4.addInitScript(() => { localStorage.setItem('kepler7_token','tok'); });
  await page4.goto(SPIEL_URL);
  await page4.waitForTimeout(2500);

  // Der Block wird aus der Spieldatei geschnitten und AUSGEFUEHRT - "der Code sieht richtig aus"
  // ist kein Beleg (Hausregel 43). Der Aufbau liegt in try/catch und meldet sich als eigene,
  // benannte Pruefung, statt den Testlauf zu beenden (Hausregel 34).
  let bilanzUrteile = null, bauFehler = null;
  try {
    const a = OHNE_HISTORIE.indexOf('  function battleOutcomeOf(r){');
    const b = OHNE_HISTORIE.indexOf('\n  }', a);
    const rumpf = OHNE_HISTORIE.slice(a, b + 4);
    const fn = new Function('return (' + rumpf.trim().replace(/^function /, 'function ') + ')')();
    bilanzUrteile = {
      abgeprallt: fn({ type:'player-attack', keinKampf:true }),
      echterSieg: fn({ type:'player-attack', result:'win' }),
      echteNiederlage: fn({ type:'player-attack', result:'loss' })
    };
  } catch(e){ bauFehler = String(e.message || e); }

  check('6-bau: battleOutcomeOf laesst sich schneiden und ausfuehren', bauFehler === null, { bauFehler });
  check('6: ein abgeprallter Angriff zaehlt gar nicht in die Kampf-Bilanz',
    bilanzUrteile !== null && bilanzUrteile.abgeprallt === null, { bilanzUrteile });
  // Gegenrichtung: Die echten Ausgaenge muessen unveraendert zaehlen, sonst haette die neue Zeile
  // die ganze Bilanz stillgelegt (Hausregel 33).
  check('6b: echter Sieg und echte Niederlage zaehlen weiterhin',
    bilanzUrteile !== null && bilanzUrteile.echterSieg === 'win' && bilanzUrteile.echteNiederlage === 'loss', { bilanzUrteile });

  await ctx4.close();
  await ctx3.close();
  await ctx.close(); await ctx2.close(); await browser.close();
  await ende();
})();
