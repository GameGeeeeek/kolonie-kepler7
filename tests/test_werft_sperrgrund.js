// SP-2: Ein gesperrter Werft-Knopf sagt, WAS fehlt - und "zu teuer" ist gar keine Sperre.
//
// FORTSETZUNG VON SP-1 (test_forschung_sperrgrund.js). Dort war der Fund: startResearch() prueft
// laengst jeden Sperrgrund und hat fuer jeden eine Meldung, sie waren nur unerreichbar, weil der
// Knopf `disabled` trug. In der Werft liegt derselbe Fall - mit ZWEI Verschaerfungen:
//
//   A) EIN STILLER ABBRUCH. Der Klickpfad begann mit `if (!def || !shipRequirementsMet(def))
//      return;` - ohne jede Meldung. Solange der Knopf gesperrt war, fiel das nicht auf (der Klick
//      kam nie an). Nimmt man nur den Riegel weg, ist genau das der Zweig, der den Spieler ohne
//      Antwort stehen laesst. Der Grund muss also MIT dem Riegel weichen, nicht danach.
//
//   B) "ZU TEUER" WAR NIE EINE SPERRE. Gemessen am Code: queueConstruction reiht einen Bauauftrag
//      ausdruecklich auch dann ein, wenn er noch nicht bezahlbar ist ("wird immer eingereiht,
//      Bezahlung und Start passieren automatisch sobald bezahlbar", Feature-Wunsch 13.07.2026).
//      Der Baukorb-Knopf direkt daneben macht das auch sichtbar: Er heisst "Baukorb bauen" oder
//      "Baukorb einreihen", je nach Deckung, und ist NIE wegen fehlender Deckung gesperrt.
//      Der Einzelknopf sperrte bei genau derselben Lage. Das war keine Balance-Regel, sondern eine
//      Inkonsistenz - dieselbe Handlung war ueber den Baukorb erlaubt und ueber den Knopf nicht.
//      Er verhaelt sich jetzt wie sein Nachbar: klickbar, Beschriftung wechselt auf "Einreihen".
//
// GEGENPROBE (gemessen am Stand vor der Aenderung): Es MUESSEN fallen - Pruefung 1 (Riegel weg),
// 2 und 3 (die beiden Sperrgruende werden genannt), 4 und 5 (Einreihen moeglich und beschriftet).
// Gruen bleiben MUESSEN die Anker 0 und die Gegenrichtung 6.
//
// LEHRE AUS SP-1, hier von Anfang an angewandt: NICHT den ersten gesperrten Knopf klicken. Der
// scheitert meist an den Kosten, und alle uebrigen Sperrzweige bleiben unbetreten - so blieb in
// SP-1 ein Fehler in zwei Dritteln aller Faelle unentdeckt. Dieser Test steuert jeden Sperrgrund
// EINZELN an und liest die dafuer noetigen Schiffsschluessel aus der Spieldatei, statt sie
// einzutippen (Regel statt Momentaufnahme).
const { starteBrowser, SPIEL_URL, SPIELDATEI, ruhigeUhren, pruefer, logMitschnitt, logZeilen } = require('./lib/umgebung');
const fs = require('fs');
const { check, ende } = pruefer();
const DATEI = process.env.KEPLER_TESTDATEI || SPIEL_URL;

const now = Date.now();
// Mittlere Lage, bewusst so gewaehlt, dass ALLE DREI Faelle gleichzeitig im Bild sind:
// etwas Erz und Kristall (also ist mindestens ein Schiff bezahlbar und mindestens eines nicht),
// keine Forschung (Voraussetzungs-Sperre) und keine Allianz (Allianzschiff-Sperre).
const SPIELSTAND = JSON.stringify(Object.assign({}, ruhigeUhren(), {
  tutorialSeen: true, newbieWelcomeSeen: true,
  seenTabHints: { basis:1, forschung:1, flotte:1, karte:1 },
  resources: { energie:400, erz:400, kristalle:120, deuterium:40, antimaterie:0, forschungspunkte:0 },
  buildings: { solar:4, mine:4, lager:4, werft:3, labor:1 }, research: {},
  fleet: { jaeger:0, missions:[] }, colonies: {}, activeBasePlanet: 'home',
  player: { id:'u', name:'AdmiralX' }, xp: 10, credits: 0, prestige: 0, buffs: [],
  lastTick: now, colonyNames: {}, colonyNotes: {}, modules: {}, shipModules: {},
  equippedShipModules: {}, moduleFragments: 0, constructionQueue: []
}));

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok: true });
  if (p === 'me') return j({ userId: 'u', username: 'AdmiralX', homeSystem: 'kepler', homeSlot: 0, attackShieldMs: 0 });
  if (p.startsWith('storage/')) { const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT') { try { store[k] = JSON.parse(req.postData() || '{}').value; } catch (e) {} return j({ ok: true }); }
    if (store[k] !== undefined) return j({ key: k, value: store[k], version: 1 }); return j({ e: 1 }, 404); }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p))
    return j(p.includes('pending') ? { reward: null } : []);
  return j({});
};}

/* Die Schiffe fuer die beiden Sperrgruende MESSEN statt eintippen - aber vom DOM aus, nicht aus
   der Datei heraus. Der erste Anlauf zerlegte SHIP_DEFS zeilenweise und fand kein einziges
   Allianzschiff: Ein Schiffseintrag geht ueber MEHRERE Zeilen, der Schluessel steht in der einen
   und `allianzSchiff:true` in der naechsten. Schlimmer noch lieferte er einen Schluessel, den die
   Werft gar nicht zeigt - der Test tippte dann ins Leere und meldete "kein Grund genannt", obwohl
   der Knopf nur nicht existierte. Jetzt ist die Reihenfolge umgekehrt: Erst fragen, welche Schiffe
   WIRKLICH im Bild stehen, dann in der Spieldatei nachschlagen, welches davon welches Tor traegt. */
/* GEMESSEN, nicht angenommen: Ein Schiffseintrag beginnt mit "{ key:'" (Leerzeichen nach der
   Klammer, 1218 Vorkommen in der Spieldatei), ein Voraussetzungs-Objekt dagegen mit "{key:'"
   (ohne, 60 Vorkommen). Genau daran laesst sich der Eintrag sauber abgrenzen. Zwei Anlaeufe
   davor scheiterten: zeilenweise (ein Eintrag geht ueber mehrere Zeilen) und "bis zum naechsten
   key:'" (das trifft die Voraussetzungen MITTEN im Eintrag und schneidet vor allianzSchiff ab). */
function eintragVon(quelle, key){
  const anfang = "{ key:'" + key + "'";
  const i = quelle.indexOf(anfang);
  if (i < 0) return '';
  const j = quelle.indexOf("{ key:'", i + anfang.length);
  return quelle.slice(i, j < 0 ? i + 1200 : j);
}
function sperrgrundSchiffe(schluessel){
  const quelle = fs.readFileSync(SPIELDATEI, 'utf8');
  const allianz = [];
  let forschung = null;
  for (const k of schluessel){
    const e = eintragVon(quelle, k);
    if (!e) continue;
    if (/allianzSchiff:\s*true/.test(e)) allianz.push(k);
    // Ein Schiff, das NUR an der Forschung haengt: requires ja, kein Allianztor, keine Tiefe.
    if (!forschung && /requires:\s*\[[^\]]+\]/.test(e) && !/allianzSchiff/.test(e) && !/tiefe:/.test(e)) forschung = k;
  }
  return { allianz, forschung };
}

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.route('**/api/**', backend({ 'kepler7-save-v3': SPIELSTAND }));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await logMitschnitt(page);
  await page.goto(DATEI); await page.waitForTimeout(2600);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay'].forEach(id => { const o = document.getElementById(id); if (o) o.style.display = 'none'; }); });
  await page.evaluate(() => { const b = document.querySelector('.tab-btn[data-tab="flotte"]'); if (b) b.click(); });
  await page.waitForTimeout(900);
  await page.evaluate(() => { const b = document.querySelector('[data-fleet-subtab="werft"]'); if (b) b.click(); });
  await page.waitForTimeout(1400);

  check('0-vorab: Boot ohne Skriptfehler', fehler.length === 0, fehler.slice(0, 2));

  const knoepfe = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[data-buyship]')]
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    return { anzahl: els.length,
             schluessel: els.map(e => e.getAttribute('data-buyship')),
             mitRiegel: els.filter(e => e.disabled).length,
             einreihen: els.filter(e => /Einreihen/.test(e.textContent||'')).length,
             bauen: els.filter(e => /Bauen/.test(e.textContent||'')).length };
  });
  const zahlen = { anzahl: knoepfe.anzahl, mitRiegel: knoepfe.mitRiegel,
                   einreihen: knoepfe.einreihen, bauen: knoepfe.bauen };
  check('0-anker: Werft-Knöpfe im Bild', knoepfe.anzahl >= 5, zahlen);
  if (knoepfe.anzahl < 5) return ende(async () => browser.close());

  const { allianz: allianzKandidaten, forschung } = sperrgrundSchiffe(knoepfe.schluessel);
  check('0-anker: beide Sperrgrund-Arten aus der Spieldatei gelesen',
    allianzKandidaten.length > 0 && !!forschung,
    { allianzSchiffe: allianzKandidaten, forschungsSchiff: forschung });

  // 1) Kein Werft-Knopf ist mehr unantippbar - sonst kommt keine der Meldungen je an.
  check('1) kein Werft-Knopf trägt noch einen disabled-Riegel', knoepfe.mitRiegel === 0, zahlen);

  // Gezielt EINEN Knopf antippen und nur die dabei entstandenen Meldungen lesen.
  async function tippeAn(key){
    const vorher = (await logZeilen(page)).length;
    const da = await page.evaluate(k => {
      const el = document.querySelector('[data-buyship="' + k + '"]');
      if (!el) return false;
      el.scrollIntoView({ block: 'center' }); el.click(); return true;
    }, key);
    await page.waitForTimeout(600);
    const alle = await logZeilen(page);
    return { da, neu: alle.slice(vorher).join('\n') };
  }

  // 2) Fehlende Forschung wird beim Namen genannt - der Zweig, der vorher STILL abbrach.
  const f = await tippeAn(forschung);
  check('2) fehlende Forschung wird als Grund genannt, nicht verschwiegen',
    f.da && /Dafür fehlt noch: .*Stufe \d/.test(f.neu), { schiff: forschung, meldung: f.neu.slice(0, 160) });

  /* 3) Das Allianztor ebenso - ein zweiter Sperrgrund, den Prüfung 2 nicht mit abdeckt.
        Geprüft wird die REGEL "irgendein Allianzschiff nennt die Allianz", nicht ein bestimmtes:
        Ein einzelnes Schiff kann zusätzlich an einer Forschung hängen, und dann gewinnt der
        andere Grund - das wäre richtiges Verhalten, würde aber diese Prüfung fälschlich rot
        färben (gemessen am Leerenjäger, der zuerst Leerentechnologie Stufe 5 verlangt). */
  let allianzMeldung = '', allianzSchiff = null;
  for (const k of allianzKandidaten){
    const a = await tippeAn(k);
    if (a.da && /Allianz/.test(a.neu)){ allianzMeldung = a.neu; allianzSchiff = k; break; }
    if (a.da && !allianzMeldung) { allianzMeldung = a.neu; allianzSchiff = k; }
  }
  check('3) das Allianztor wird als Grund genannt',
    /Allianz/.test(allianzMeldung),
    { geprüft: allianzKandidaten, schiff: allianzSchiff, meldung: allianzMeldung.slice(0, 160) });

  // 4) "Zu teuer" ist keine Sperre: Der Knopf sagt "Einreihen" statt "Bauen".
  check('4) unbezahlbare, aber baubare Schiffe heißen "Einreihen"', knoepfe.einreihen > 0, zahlen);

  // 5) Und das Antippen reiht wirklich ein - gemessen am Ereignisverlauf, nicht am DOM-Endzustand.
  const teuer = await page.evaluate(() => {
    const el = [...document.querySelectorAll('[data-buyship]')].find(e => /Einreihen/.test(e.textContent||''));
    if (!el) return null;
    const k = el.getAttribute('data-buyship');
    el.scrollIntoView({ block: 'center' }); el.click();
    return k;
  });
  await page.waitForTimeout(700);
  const log5 = (await logZeilen(page)).join('\n');
  check('5) und der Klick reiht den Auftrag wirklich ein',
    !!teuer && /zur Warteschlange auf .* hinzugefügt/.test(log5),
    { schiff: teuer, zeile: (log5.match(/[^\n]*zur Warteschlange[^\n]*/) || ['(keine)'])[0] });

  // 6) Die Gegenrichtung: Bezahlbares heißt weiterhin "Bauen". Ohne sie wäre auch ein Knopf grün,
  //    der stur immer "Einreihen" sagt - die Beschriftung trüge dann keine Information mehr.
  check('6) bezahlbare Schiffe heißen weiterhin "Bauen"', knoepfe.bauen > 0, zahlen);

  await ctx.close();
  await ende(async () => browser.close());
})().catch(e => { console.error('Testlauf abgebrochen:', e); process.exit(1); });
