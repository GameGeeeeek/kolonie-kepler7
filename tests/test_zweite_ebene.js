// Die zweite Ebene: klebende Statusleiste, Handy-Hoehe der fuenf Knopfzeilen, unbekannte
// Unterreiter-Schluessel (UI-5a, 12.09.2026).
//
// WAS HIER ABGESICHERT WIRD - DIE DREI ZUSAGEN DES AENDERUNGSSATZES
// -----------------------------------------------------------------
// A  Klebt die Reiterleiste (`body.compact-head .tabs`, position sticky, top 0), klebt die
//    Statusleiste der zweiten Ebene DARUNTER und bleibt sichtbar und antippbar.
// B  Am Handy (390 px) ist keine der fuenf Knopfzeilen der zweiten Ebene hoeher als zwei
//    Knopfzeilen, und kein Knopf ist unerreichbar.
// C  Ein Unterreiter-Schluessel, den es nicht (mehr) gibt, faellt auf den ERSTEN Knopf seiner
//    Zeile zurueck, statt alle Panels auszublenden.
//
// FUENF FALLEN, DIE DIESE PRUEFUNG EINZELN ABFAENGT:
//
//   1. DIE SEITE MUSS LANG GENUG SEIN. Der Fehler von A tritt nur auf, wenn die zweite Leiste
//      ihren Klebepunkt ueberhaupt ERREICHT. Gemessen am 12.09.2026 bei 390x844: mit
//      `fleetSubTab:'flotte'` ist die Flotten-Seite 838 px scrollbar - die Leiste klebt nie, und
//      eine Pruefung an diesem Stand ist STILL GRUEN, egal wie kaputt das CSS ist. Mit
//      `fleetSubTab:'werft'` sind es rund 15900 px, und der Fehler tritt auf. A0 misst die
//      Scrollhoehe deshalb als eigene Pruefung und faellt, wenn sie zu kurz ist.
//
//   2. DIE STAPELNUMMER BEWEIST NICHTS. Die Statusleiste trug schon vorher z-index 30 gegen 25
//      der Reiterleiste und lag trotzdem dahinter: `.tab-panel.active` traegt
//      `animation: tabIn ... forwards` auf `transform` und ist damit dauerhaft ein eigener
//      STAPELKONTEXT - die 30 gelten nur INNERHALB des Panels. Gemessen wird deshalb, was der
//      Spieler sieht: die UEBERLAPPUNG der beiden Baender und `document.elementFromPoint` auf der
//      Mitte der Leiste, nicht `z-index`.
//
//   3. DIE ZUSAGE GILT FUER JEDE KLEBENDE LEISTE DER ZWEITEN EBENE, nicht nur fuer die eine der
//      Flotte. A2 sucht deshalb ALLE sichtbaren Elemente mit `position:sticky` innerhalb eines
//      `.tab-panel` und prueft jedes gegen die Reiterleiste - eine zweite, spaeter eingebaute
//      Leiste faellt damit von selbst auf.
//
//   4. AM PC DARF SICH NICHTS GEAENDERT HABEN. Ohne `compact-head` (ab 1001 px) klebt die
//      Reiterleiste gar nicht (gemessen bei 1400 px: position=static), und die Statusleiste
//      gehoert dort weiter auf ihre 4 px. Wer den `body.compact-head`-Vorsatz der neuen Regel
//      vergisst, schiebt sie am PC grundlos um 100 px nach unten - A6 misst genau das.
//
//   5. DIE ZEILENZAHL IST SCHRIFTUNABHAENGIGER ALS EINE PIXELHOEHE. B zaehlt die verschiedenen
//      Oberkanten der SICHTBAREN Knoepfe, nicht Pixel: Das bleibt aussagekraeftig, wenn eine
//      andere Schrift jede Zeile um ein paar Pixel aendert, und faellt, sobald eine Zeile
//      umbricht. Dazu die Gegenfrage, die eine einzeilige Leiste erst brauchbar macht: Ist der
//      Inhalt breiter als der Kasten, MUSS er wischbar sein - sonst ist die Zeile zwar niedrig,
//      aber die hinteren Knoepfe sind unerreichbar.
//
// ERWARTUNGSWERTE SIND GEMESSEN, NICHT EINGETIPPT:
//   * Welche Schluessel eine Zeile kennt und welcher davon der ERSTE ist, liest der Test aus dem
//     MARKUP der geladenen Seite (die `data-*-subtab`-Attribute) - dieselbe Quelle, aus der auch
//     `unterreiterSchluessel()` seine Liste nimmt. Eine eingetippte Liste waere bei jedem neuen
//     Knopf falsch.
//   * Die Hoehe der Reiterleiste wird gemessen und nicht angenommen (sie ist gemessen 94 px am PC
//     und 159 px am Handy und waechst mit jedem Reiter und jedem Banner darueber).
//   * Der erfundene Schluessel fuer C ist bewusst einer, den kein Build je tragen wird.
//
// GEGENPROBEN (KEPLER_ZWEITEEBENE_GEGENPROBE=<stand>, Spieldatei per KEPLER_SPIELDATEI umlenken):
//   =alt         der Ausgangsstand v8.723.0 unveraendert - dort faellt der Kern von A und C
//   =sabotageA   die Regel `body.compact-head .fleet-sticky { top: ... }` ersatzlos entfernt
//   =sabotageB   `.pillen-leiste` in der 700-px-Media-Regel auf flex-wrap:wrap / overflow-x:visible
//   =sabotageC   `unterreiterSchluessel` gibt den Wert ungeprueft zurueck (die Listenpruefung faellt weg)
//   =sabotageD   der `body.compact-head`-Vorsatz der neuen Regel entfernt - die PC-Gegenrichtung
// Die vier Sabotagen entstehen aus der AKTUELLEN Spieldatei, je Sabotage genau eine Fundstelle
// (Abbruch vor dem Schreiben, wenn die Zeichenkette nicht genau einmal vorkommt).
// Die MUSS_FALLEN-Listen sind GEMESSEN (erst laufen lassen, dann eingetragen), nicht geraten.
// Eine Sabotage, die gruen bleibt, ist ein Befund ueber die PRUEFUNG - nicht ueber die Sabotage.
const { starteBrowser, SPIEL_URL, ruhigeUhren, versionAbfangen } = require('./lib/umgebung');

const ergebnis = {};
let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };
const merke = (name, bed, zusatz) => { ergebnis[String(name).split(':')[0]] = !!bed; check(name, bed, zusatz); };

const SAB = process.env.KEPLER_ZWEITEEBENE_GEGENPROBE || '';
// GEMESSEN am 12.09.2026: erst mit leeren Listen gefahren, die roten Namen eingetragen, dann jeden
// Stand erneut gefahren, bis alle Exit 0 lieferten.
// WAS DABEI AUFFIEL UND HIER STEHEN BLEIBT: A3 bleibt am Ausgangsstand GRUEN, obwohl die Leiste
// dort unsichtbar ist - sie lag gemessen bei [4,54] und damit durchaus innerhalb des Fensters, nur
// eben HINTER der Reiterleiste. A3 ist deshalb bewusst die schwaechste der vier A-Pruefungen und
// traegt die Zusage nicht allein; A2 (Ueberlappung) und A4 (Trefferflaeche) tun das. Die Pruefung
// bleibt trotzdem: Sie faengt den anderen Fehlerweg ab, bei dem ein zu grosser Abstand die Leiste
// aus dem Bild schiebt, statt sie zu verdecken.
// B4 (Allianz) bleibt am Ausgangsstand ebenfalls gruen: Die Zeile brach dort mit 78 px auf ZWEI
// Knopfzeilen um und erfuellte die Zusage damit schon vorher. Sie ist trotzdem mitgezogen worden,
// und die Pruefung haelt nur die Zusage fest, nicht die Mitnahme.
const MUSS_FALLEN = {
  alt:       ['A2', 'A4', 'A5', 'B3', 'C1', 'C2', 'C3', 'C4'],
  sabotageA: ['A2', 'A4', 'A5'],
  sabotageB: ['B3'],
  sabotageC: ['C1', 'C2', 'C3', 'C4'],
  sabotageD: ['A6']
};

// Ein Schluessel, den keine der vier Knopfzeilen je tragen wird - der Bindestrich-Rahmen macht ihn
// beim Lesen eines Spielstands sofort als Test-Wert erkennbar.
const ERFUNDEN = 'erfunden-xyz-gibt-es-nicht';

// Die fuenf Knopfzeilen der zweiten Ebene, in drei Bauarten. `panels` ist der Selektor der
// Flaechen, die die Zeile umschaltet; die Sektorkarte ist eine MEHRFACHWAHL ohne Panels und ohne
// Rueckfall-Frage - sie zaehlt deshalb nur bei B mit.
const ZEILEN = [
  { nr: 1, name: 'Flotte',      reiter: 'flotte',    leiste: '#fleetSubtabs',     attr: 'data-fleet-subtab',    aktiv: 'on',     panels: '#tab-flotte > div[id^="fleetSub"]:not(#fleetSubtabs)' },
  { nr: 2, name: 'Offiziere',   reiter: 'offiziere', leiste: '#officerSubtabs',   attr: 'data-officer-subtab',  aktiv: 'on',     panels: '#tab-offiziere > div[id^="offSub"]' },
  { nr: 3, name: 'Galaxie',     reiter: 'galaxie',   leiste: '#galaxySubtabBar',  attr: 'data-galaxy-subtab',   aktiv: 'active', panels: '.galaxy-subpanel[data-galaxy-sub]' },
  { nr: 4, name: 'Allianz',     reiter: 'allianz',   leiste: '#allianceSubtabBar', attr: 'data-alliance-subtab', aktiv: 'active', panels: '.alliance-subpanel[data-alliance-sub]' },
  { nr: 5, name: 'Sektorkarte', reiter: 'karte',     leiste: '#karteEbenenLeiste', attr: 'data-karte-ebene',     aktiv: 'active', panels: null }
];

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0 });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

/* Der Spielstand ist bewusst reich: Eine arme Werft zeigt wenige Karten, und dann ist die
   Flotten-Seite zu kurz, als dass die Statusleiste ihren Klebepunkt erreichte (Falle 1). Der
   Spread von ruhigeUhren() steht VORNE, damit alles dahinter gewinnt (lib/umgebung.js). */
function spielstand(extra){
  return JSON.stringify(Object.assign({
    ...ruhigeUhren(), tutorialSeen:true, newbieWelcomeSeen:true,
    seenTabHints:{ basis:1, verteidigung:1, forschung:1, flotte:1, expedition:1, karte:1,
                   galaxie:1, allianz:1, offiziere:1, markt:1, punkte:1, fortschritt:1, sammlung:1 },
    resources:{ energie:412000, erz:388000, kristalle:264000, deuterium:151000, antimaterie:19400, forschungspunkte:31200 },
    buildings:{ solar:20, mine:19, raffinerie:15, synth:13, labor:12, werft:12, hangar:8, lager:12 },
    research:{ rsolar:8, rerz:8, rkampf:7 }, fleet:{ jaeger:420, missions:[] },
    colonies:{}, activeBasePlanet:'home', shipMarks:{}, discovered:{ rhea:true, aion:true },
    player:{ id:'u', name:'A', allianceTag:'' }, battleStats:{ wins:5, losses:1 },
    xp:64000, buffs:[], lastTick:Date.now(), colonyNames:{}, colonyNotes:{}
  }, extra || {}));
}

const fehler = [];
async function seite(browser, breite, stand){
  const store = {}; store['kepler7-save-v3'] = stand;
  const ctx = await browser.newContext({ viewport:{ width:breite, height:844 }, hasTouch: breite <= 700 });
  const page = await ctx.newPage();
  page.on('pageerror', e => fehler.push(breite + 'px pageerror: ' + e));
  await versionAbfangen(page);
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay',
     'kofiEmailPromptOverlay','conflictOverlay','prestigePerkOverlay']
      .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; });
  });
  return { ctx, page };
}
async function reiter(page, tab){
  await page.evaluate(t => { const b = document.querySelector('.tab-btn[data-tab="' + t + '"]'); if (b) b.click(); }, tab);
  await page.waitForTimeout(1400);
}

/* Was am gescrollten Flotten-Tab gemessen wird. Alles davon ist das, WAS DER SPIELER SIEHT:
   Rechtecke, Ueberlappung, Trefferflaeche - keine Stapelnummer (Falle 2). */
const A_MESSEN = (zielPos) => {
  const scrollbar = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo(0, Math.min(zielPos, Math.max(0, scrollbar)));
  return new Promise(fertig => setTimeout(() => {
    const tabs = document.querySelector('.tabs');
    if (!tabs) return fertig({ fehlt:'.tabs' });
    const ts = getComputedStyle(tabs), tr = tabs.getBoundingClientRect();
    const klebt = ts.position === 'sticky';
    // Das klebende BAND der Reiterleiste - nur wenn sie wirklich klebt, sonst gibt es keines.
    const band = klebt ? [tr.top, tr.bottom] : null;
    const sichtbar = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && el.offsetParent !== null; };
    // ALLE klebenden Elemente der zweiten Ebene, nicht nur die der Flotte (Falle 3).
    const zweite = [...document.querySelectorAll('.tab-panel *')]
      .filter(el => getComputedStyle(el).position === 'sticky' && sichtbar(el))
      .map(el => {
        const r = el.getBoundingClientRect(), c = getComputedStyle(el);
        const mx = r.left + r.width / 2, my = r.top + r.height / 2;
        const treffer = document.elementFromPoint(mx, my);
        return {
          id: el.id || null, klasse: String(el.className || '').slice(0, 24),
          panel: (el.closest('.tab-panel') || {}).id || null,
          cssTop: c.top, rect: [Math.round(r.top), Math.round(r.bottom)],
          ueberlappung: band ? Math.round(Math.max(0, Math.min(band[1], r.bottom) - Math.max(band[0], r.top))) : 0,
          imBild: r.top >= -1 && r.bottom <= window.innerHeight + 1,
          getroffen: !!treffer && (treffer === el || el.contains(treffer)),
          traf: treffer ? (treffer.tagName.toLowerCase() + (treffer.id ? '#' + treffer.id : '') + '.' + String(treffer.className || '').slice(0, 20)) : null
        };
      });
    fertig({
      scrollbar, scrollY: Math.round(window.scrollY),
      compact: document.body.classList.contains('compact-head'),
      tabsPos: ts.position, tabsHoehe: Math.round(tr.height), tabsRect: [Math.round(tr.top), Math.round(tr.bottom)],
      sprungAbstand: getComputedStyle(document.documentElement).getPropertyValue('--sprung-abstand').trim(),
      zweite
    });
  }, 450));
};

/* Was an EINER Knopfzeile gemessen wird. `zeilen` zaehlt die verschiedenen Oberkanten der
   SICHTBAREN Knoepfe (Falle 5); `ersterSchluessel` kommt aus dem Markup, nicht aus einer Liste. */
const ZEILE_MESSEN = (a) => {
  const l = document.querySelector(a.leiste);
  if (!l) return { fehlt: a.leiste };
  const cs = getComputedStyle(l), r = l.getBoundingClientRect();
  const knoepfe = [...l.querySelectorAll('[' + a.attr + ']')];
  const sicht = knoepfe.filter(b => { const br = b.getBoundingClientRect(); return br.width > 0 && br.height > 0; });
  const panels = a.panels ? [...document.querySelectorAll(a.panels)] : [];
  const offen = panels.filter(p => getComputedStyle(p).display !== 'none' && p.offsetParent !== null);
  return {
    hoehe: Math.round(r.height), knoepfe: knoepfe.length, sichtbar: sicht.length,
    zeilen: [...new Set(sicht.map(b => Math.round(b.getBoundingClientRect().top)))].length,
    wrap: cs.flexWrap, overflowX: cs.overflowX, anzeige: cs.display,
    breiterAlsKasten: l.scrollWidth > l.clientWidth + 2,
    schluessel: knoepfe.map(b => b.getAttribute(a.attr)),
    ersterSchluessel: knoepfe.length ? knoepfe[0].getAttribute(a.attr) : null,
    aktive: knoepfe.filter(b => b.classList.contains(a.aktiv)).map(b => b.getAttribute(a.attr)),
    panelsGesamt: panels.length, panelsOffen: offen.length,
    offeneIds: offen.map(p => p.id || p.getAttribute('data-galaxy-sub') || p.getAttribute('data-alliance-sub'))
  };
};

(async () => {
  const browser = await starteBrowser();

  // ================= A: die klebende zweite Ebene, Handy ==========================================
  {
    const { ctx, page } = await seite(browser, 390, spielstand({ fleetSubTab: 'werft' }));
    await reiter(page, 'flotte');
    const a = await page.evaluate(A_MESSEN, 1400);

    // A0 ist die Vorbedingung, ohne die alles Weitere still gruen waere (Falle 1). Die Schranke
    // 5000 px liegt weit ueber der gemessenen kurzen Seite (838 px mit `fleetSubTab:'flotte'`)
    // und weit unter der gemessenen langen (rund 15900 px mit 'werft').
    merke('A0: die Flotten-Seite ist lang genug, dass die zweite Leiste ihren Klebepunkt erreicht',
      a.scrollbar > 5000 && a.scrollY > 1000,
      { scrollbar: a.scrollbar, scrollY: a.scrollY });
    // A1 ist die zweite Vorbedingung: ohne klebende Reiterleiste gibt es die Frage von A gar nicht.
    merke('A1: bei 390 px traegt die Seite compact-head und die Reiterleiste klebt oben am Bildrand',
      a.compact === true && a.tabsPos === 'sticky' && a.tabsRect[0] <= 1 && a.tabsHoehe > 0,
      { compact: a.compact, tabsPos: a.tabsPos, tabsRect: a.tabsRect, tabsHoehe: a.tabsHoehe });

    const leisten = a.zweite || [];
    // A2 ohne gefundene Leiste waere ueber einer leeren Menge trivial gruen - deshalb die Anzahl
    // ausdruecklich mit in die Bedingung.
    const ueberlappend = leisten.filter(l => l.ueberlappung > 0);
    merke('A2: keine klebende Leiste der zweiten Ebene ueberlappt die Reiterleiste',
      leisten.length >= 1 && ueberlappend.length === 0,
      { gefunden: leisten.length, ueberlappend: ueberlappend.slice(0, 3), alle: leisten.slice(0, 3) });
    const ausserhalb = leisten.filter(l => !l.imBild);
    merke('A3: jede klebende Leiste der zweiten Ebene liegt vollstaendig im Bild',
      leisten.length >= 1 && ausserhalb.length === 0,
      { ausserhalb: ausserhalb.slice(0, 3) });
    const verdeckt = leisten.filter(l => !l.getroffen);
    merke('A4: die Mitte jeder klebenden Leiste ist antippbar, nicht von der Reiterleiste verdeckt',
      leisten.length >= 1 && verdeckt.length === 0,
      { verdeckt: verdeckt.slice(0, 3) });
    await ctx.close();
  }

  // ================= A5: dieselbe Frage an der oberen Kante des kompakten Kopfes ==================
  {
    const { ctx, page } = await seite(browser, 700, spielstand({ fleetSubTab: 'werft' }));
    await reiter(page, 'flotte');
    const a = await page.evaluate(A_MESSEN, 1400);
    const leisten = a.zweite || [];
    const schlecht = leisten.filter(l => l.ueberlappung > 0 || !l.imBild || !l.getroffen);
    merke('A5: auch bei 700 px klebt die zweite Ebene unter der Reiterleiste und bleibt antippbar',
      a.compact === true && a.tabsPos === 'sticky' && a.scrollbar > 5000
      && leisten.length >= 1 && schlecht.length === 0,
      { compact: a.compact, tabsPos: a.tabsPos, scrollbar: a.scrollbar, gefunden: leisten.length, schlecht: schlecht.slice(0, 2) });
    await ctx.close();
  }

  // ================= A6 + B(PC): am PC darf sich nichts geaendert haben ===========================
  {
    const { ctx, page } = await seite(browser, 1400, spielstand({ fleetSubTab: 'werft' }));
    await reiter(page, 'flotte');
    const a = await page.evaluate(A_MESSEN, 1400);
    const leisten = a.zweite || [];
    // Am PC klebt die Reiterleiste NICHT (gemessen: position=static), die Statusleiste gehoert
    // deshalb weiter auf ihre eigenen 4 px - nicht auf den Leistenabstand (gemessen 104 px).
    // Faellt der `body.compact-head`-Vorsatz der neuen Regel weg, rutscht sie genau dorthin.
    const versetzt = leisten.filter(l => l.rect[0] > 60);
    merke('A6: am PC klebt die Reiterleiste nicht und die zweite Ebene steht unveraendert oben',
      a.compact === false && a.tabsPos === 'static' && leisten.length >= 1 && versetzt.length === 0,
      { compact: a.compact, tabsPos: a.tabsPos, sprungAbstand: a.sprungAbstand, leisten: leisten.map(l => ({ id: l.id, cssTop: l.cssTop, rect: l.rect })) });

    // Die Gegenrichtung zu B: oberhalb der 700-px-Schwelle bleiben die Zeilen umbrechend und
    // gerade NICHT wischbar - gemessen flex-wrap:wrap und overflow-x:visible bei allen dreien,
    // die die Media-Regel betrifft. Ein zu weit gefasster Medienbereich faellt hier auf.
    const pcSchlecht = [];
    for (const z of ZEILEN){
      await reiter(page, z.reiter);
      const m = await page.evaluate(ZEILE_MESSEN, z);
      if (m.fehlt || m.zeilen > 1 || m.overflowX !== 'visible') pcSchlecht.push({ zeile: z.name, m });
    }
    merke('B0: am PC sind alle fuenf Knopfzeilen einzeilig und ohne Wischbereich',
      pcSchlecht.length === 0, pcSchlecht.slice(0, 3));
    await ctx.close();
  }

  // ================= B: die fuenf Knopfzeilen am Handy ============================================
  {
    const { ctx, page } = await seite(browser, 390, spielstand({}));
    for (const z of ZEILEN){
      await reiter(page, z.reiter);
      const m = await page.evaluate(ZEILE_MESSEN, z);
      const da = !m.fehlt && m.knoepfe > 0 && m.sichtbar > 0;
      // Zwei Fragen in einer Pruefung, weil nur beide zusammen die Zusage sind: hoechstens zwei
      // Knopfzeilen UND kein Knopf, der dabei unerreichbar wird.
      const niedrig = da && m.zeilen <= 2;
      const erreichbar = da && (!m.breiterAlsKasten || m.overflowX === 'auto' || m.overflowX === 'scroll');
      merke('B' + z.nr + ': die Zeile ' + z.name + ' hat am Handy hoechstens zwei Knopfzeilen und laesst keinen Knopf unerreichbar',
        da && niedrig && erreichbar, m);
    }
    await ctx.close();
  }

  // ================= C: der unbekannte Schluessel =================================================
  {
    const stand = spielstand({ fleetSubTab: ERFUNDEN, officerSubTab: ERFUNDEN,
                               galaxySubTab: ERFUNDEN, allianceSubTab: ERFUNDEN });
    const { ctx, page } = await seite(browser, 1400, stand);
    for (const z of ZEILEN){
      if (!z.panels) continue;   // die Sektorkarte ist Mehrfachwahl, sie hat keine Rueckfall-Frage
      await reiter(page, z.reiter);
      const m = await page.evaluate(ZEILE_MESSEN, z);
      const da = !m.fehlt && m.panelsGesamt > 0 && m.knoepfe > 0;
      // Der erfundene Schluessel darf in der Zeile gar nicht vorkommen - sonst pruefte C nichts.
      const wirklichUnbekannt = da && m.schluessel.indexOf(ERFUNDEN) < 0;
      // GEMESSEN wird, ob ein Panel SICHTBAR ist - nicht, was im Spielstand steht: Der Spielstand
      // wird bewusst nicht berichtigt, die Anzeige faellt nur zurueck.
      const einsOffen = da && m.panelsOffen === 1;
      const ersterAktiv = da && m.aktive.length === 1 && m.aktive[0] === m.ersterSchluessel;
      merke('C' + z.nr + ': ein unbekannter Schluessel laesst die Zeile ' + z.name + ' auf ihren ERSTEN Reiter zurueckfallen',
        da && wirklichUnbekannt && einsOffen && ersterAktiv, m);
    }
    await ctx.close();
  }

  merke('J1: keine Skriptfehler in allen Messlaeufen', fehler.length === 0, fehler.slice(0, 3));

  await browser.close();

  if (SAB){
    const soll = MUSS_FALLEN[SAB] || [];
    const gefallen = Object.keys(ergebnis).filter(n => ergebnis[n] === false);
    const fehlend = soll.filter(n => ergebnis[n] !== false);
    const unerwartet = gefallen.filter(n => soll.indexOf(n) < 0);
    if (fehlend.length) console.log('FAIL - Gegenprobe unvollstaendig: ' + fehlend.join(' ') + ' blieben gruen');
    else if (unerwartet.length) console.log('FAIL - Gegenprobe UEBERZAEHLIG: ' + unerwartet.join(' ') + ' fiel zusaetzlich');
    else console.log('GEGENPROBE ' + SAB + ': ' + gefallen.length + '/' + soll.length + ' gefallen (' + gefallen.map(n => n + '=rot').join(' ') + ')');
    process.exit((fehlend.length || unerwartet.length) ? 1 : 0);
  }
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.log('FAIL - Testlauf abgebrochen: ' + e.message);
  process.exit(1);
});
