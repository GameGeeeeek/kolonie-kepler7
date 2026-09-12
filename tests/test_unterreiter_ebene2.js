// Die zweite Ebene: klebende Statusleiste, Zeilenhoehe am Handy, unbekannter Schluessel (UI-5a).
//
// DREI BEFUNDE, alle am 12.09.2026 am Stand v8.723.0 gemessen:
//
// A) Die klebende Flotten-Statusleiste lag am Handy HINTER der Reiterleiste. Bei 390x844,
//    Reiter Flotte, Unterreiter Werft (Seite 15962 px scrollbar), Scrollposition 1400 klebte
//    `.tabs` bei 0-159 px und `#fleetStickyBar` bei 4-54 px: 50 von 50 px Ueberlappung, und
//    `document.elementFromPoint` in der Mitte der Statusleiste lieferte `.tabs`. Die hoehere
//    Stapelnummer der Statusleiste (30 gegen 25) half nicht, weil `.tab-panel.active` ueber
//    `animation: tabIn ... forwards` ein eigener Stapelkontext ist - die 30 gelten nur INNERHALB
//    des Panels.
//    WARUM DIESER TEST EINE LANGE SEITE BRAUCHT: Mit Unterreiter „Flotte & Verlegen" ist die
//    Seite nur 838 px scrollbar, die Statusleiste erreicht ihren Klebepunkt nie, und die Messung
//    saehe „alles in Ordnung". Der Test prueft deshalb ausdruecklich zuerst, dass die Seite lang
//    genug ist - sonst beweist er nichts.
//
// B) Die Galaxie-Zeile war bei 390 px 120 px hoch (6 Pillen auf DREI Zeilen), die Allianz-Zeile
//    78 px (zwei Zeilen). Beide hatten gar keine CSS-Regel, nur Inline-Stile; die gleichartige
//    Ebenen-Leiste der Sektorkarte loeste dasselbe Problem seit v8.505.0 einzeilig und wischbar.
//
// C) Ein Unterreiter-Schluessel, den es nicht (mehr) gibt, blendete ALLE Panels des Reiters aus -
//    in allen vier Zeilen. Gemessen mit je einem Spielstand, der 'erfunden-xyz' trug: 0 von 3
//    bzw. 0 von 6 bzw. 0 von 4 Panels sichtbar, 0 Knoepfe aktiv. `test_angriffsziel_reiter.js`
//    haelt genau das seit dem 05.08.2026 im Kommentar fest.
//
// GEGENPROBE (ausgefuehrt, nicht behauptet): gegen eine Kopie des Standes v8.723.0
// (`KEPLER_SPIELDATEI=<kopie> node tests/test_unterreiter_ebene2.js`) endet der Lauf mit Code 1,
// und es fallen GENAU acht Pruefungen: A2, A3, A4 (Ueberlappung 50 px, Treffer in den Reitern),
// B-Galaxie (120 px, drei Zeilen) und alle vier C-Pruefungen (0 sichtbare Panels).
// Alles andere bleibt gruen - darunter ausdruecklich A5 (am PC war nie etwas kaputt) und
// B-Allianz: die Allianz-Zeile war mit 78 px / zwei Zeilen schon vorher INNERHALB der Zusage,
// sie ist aus Gleichmass mitgezogen worden. Wer diese Pruefung schaerfer stellt, muss den
// Vertrag aendern, nicht den Test.
const { starteBrowser, SPIELDATEI, ruhigeUhren, pruefer } = require('./lib/umgebung');
const path = require('path');
const FILE = 'file://' + path.resolve(SPIELDATEI);

function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s=200) => r.fulfill({ status:s, contentType:'application/json', body:JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending-rewards/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}

const SPEICHER = extra => JSON.stringify(Object.assign({ ...ruhigeUhren(), tutorialSeen:true, newbieWelcomeSeen:true,
  seenTabHints:{ basis:1, verteidigung:1, forschung:1, flotte:1, expedition:1, karte:1,
                 galaxie:1, allianz:1, offiziere:1, markt:1, punkte:1, fortschritt:1 },
  resources:{ energie:412000, erz:388000, kristalle:264000, deuterium:151000, antimaterie:19400, forschungspunkte:31200 },
  buildings:{ solar:20, mine:19, raffinerie:15, synth:13, labor:12, werft:12, hangar:8, lager:12, turm:10, schild:8, laser:9 },
  research:{ rsolar:8, rerz:8, rkristall:6, rkampf:7, rfusion:5, rexpedition:4 },
  fleet:{ jaeger:420, schlachtschiff:60, bomber:90, frachter:60, spaeher:20, missions:[] },
  colonies:{}, activeBasePlanet:'home', shipMarks:{},
  player:{ id:'u', name:'A', allianceTag:'', avatarKey:null }, battleStats:{ wins:22, losses:4 },
  xp:64000, buffs:[], lastTick:Date.now(), colonyNames:{}, colonyNotes:{} }, extra||{}));

async function seite(b, breite, extra){
  const store = {}; store['kepler7-save-v3'] = SPEICHER(extra);
  const ctx = await b.newContext({ viewport:{ width:breite, height:844 }, hasTouch:breite<=700, isMobile:breite<=700 });
  const page = await ctx.newPage();
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => { localStorage.setItem('kepler7_token', 'tok'); });
  await page.goto(FILE);
  await page.waitForTimeout(2400);
  await page.evaluate(() => {
    ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay']
      .forEach(i => { const o = document.getElementById(i); if (o) o.style.display = 'none'; });
  });
  await page.waitForTimeout(900);
  page._ctx = ctx;
  return page;
}
async function reiter(page, tab){
  await page.evaluate(t => { const b = document.querySelector('.tab-btn[data-tab="'+t+'"]'); if (b) b.click(); }, tab);
  await page.waitForTimeout(1200);
}

// Die fuenf Knopfreihen der zweiten Ebene, so wie sie im Markup stehen.
const ZEILEN = [
  { name:'Flotte',      tab:'flotte',    leiste:'#fleetSubtabs',      attribut:'data-fleet-subtab',    aktiv:'on' },
  { name:'Offiziere',   tab:'offiziere', leiste:'#officerSubtabs',    attribut:'data-officer-subtab',  aktiv:'on' },
  { name:'Galaxie',     tab:'galaxie',   leiste:'#galaxySubtabBar',   attribut:'data-galaxy-subtab',   aktiv:'active', panels:'.galaxy-subpanel' },
  { name:'Allianz',     tab:'allianz',   leiste:'#allianceSubtabBar', attribut:'data-alliance-subtab', aktiv:'active', panels:'.alliance-subpanel' },
  { name:'Sektorkarte', tab:'karte',     leiste:'#karteEbenenLeiste', attribut:'data-karte-ebene',     aktiv:'active', mehrfach:true }
];
// Die drei Flotten-Unterpanels stehen in einer Skript-Tabelle, nicht am Markup - hier als Liste,
// damit der Test „genau EINES ist sichtbar" ueberhaupt messen kann.
const PANEL_IDS = {
  Flotte:    ['fleetSubWerft','fleetSubFlotte','fleetSubMissionen'],
  Offiziere: ['offSubOffiziere','offSubModule','offSubShipModule']
};

(async () => {
  const { check, ende } = pruefer();
  const b = await starteBrowser();

  // ---- A: die klebende Statusleiste am Handy --------------------------------------------------
  {
    const page = await seite(b, 390);
    await reiter(page, 'flotte');
    const lang = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    // Ohne diese Vorbedingung misst der Test nichts: Eine kurze Seite laesst die Statusleiste
    // ihren Klebepunkt nie erreichen, und jede Ueberlappungs-Pruefung waere trivial gruen.
    check('A0 die Flotten-Seite ist lang genug, damit die zweite Leiste ueberhaupt klebt', lang > 5000, { scrollbar: lang });
    await page.evaluate(() => window.scrollTo(0, 1400));
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const t = document.querySelector('.tabs'), s = document.getElementById('fleetStickyBar');
      const rt = t.getBoundingClientRect(), rs = s.getBoundingClientRect();
      const x = Math.round(rs.left + rs.width/2), y = Math.round(rs.top + rs.height/2);
      const treffer = document.elementFromPoint(x, y);
      return { compact: document.body.classList.contains('compact-head'),
               tabsPos: getComputedStyle(t).position,
               tabsTop: Math.round(rt.top), tabsBottom: Math.round(rt.bottom),
               stickyTop: Math.round(rs.top), stickyBottom: Math.round(rs.bottom),
               ueberlappung: Math.round(Math.max(0, Math.min(rt.bottom, rs.bottom) - Math.max(rt.top, rs.top))),
               trefferInLeiste: !!treffer && s.contains(treffer),
               imBild: rs.top >= 0 && rs.bottom <= window.innerHeight };
    });
    check('A1 der Kompaktmodus ist an und die Reiterleiste klebt', m.compact && m.tabsPos === 'sticky', m);
    check('A2 die zweite klebende Leiste ueberlappt die Reiterleiste NICHT', m.ueberlappung === 0, m);
    check('A3 sie klebt unterhalb der Reiterleiste und steht vollstaendig im Bild',
      m.stickyTop >= m.tabsBottom && m.imBild, m);
    check('A4 ihre Mitte ist antippbar - der Treffer liegt in der Leiste, nicht in den Reitern',
      m.trefferInLeiste, m);
    await page._ctx.close();
  }

  // ---- A am PC: dort darf sich nichts geaendert haben ------------------------------------------
  {
    const page = await seite(b, 1400);
    await reiter(page, 'flotte');
    await page.evaluate(() => window.scrollTo(0, 1400));
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const t = document.querySelector('.tabs'), s = document.getElementById('fleetStickyBar');
      return { compact: document.body.classList.contains('compact-head'),
               tabsPos: getComputedStyle(t).position, stickyCssTop: getComputedStyle(s).top,
               stickyTop: Math.round(s.getBoundingClientRect().top) };
    });
    // Am PC klebt die Reiterleiste gar nicht (gemessen: position static), also gibt es nichts
    // auszuweichen - die Statusleiste bleibt an ihren 4 px. Die Gegenrichtung mitzupruefen ist
    // Hausregel: ein Versatz, den niemand braucht, waere hier der Fehler.
    check('A5 am PC klebt die Reiterleiste nicht und die Statusleiste bleibt an ihrem alten Platz',
      !m.compact && m.tabsPos === 'static' && m.stickyTop === 4, m);
    await page._ctx.close();
  }

  // ---- B: keine Zeile der zweiten Ebene ist am Handy hoeher als zwei Knopfzeilen ---------------
  {
    const page = await seite(b, 390);
    for (const z of ZEILEN){
      await reiter(page, z.tab);
      const m = await page.evaluate(sel => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const kinder = [...el.children].filter(k => getComputedStyle(k).display !== 'none');
        const zeilen = new Set(kinder.map(k => Math.round(k.getBoundingClientRect().top))).size;
        return { hoehe: Math.round(el.getBoundingClientRect().height), knoepfe: kinder.length, zeilen };
      }, z.leiste);
      check('B ' + z.name + ': hoechstens zwei Knopfzeilen bei 390 px',
        !!m && m.knoepfe > 0 && m.zeilen <= 2, Object.assign({ leiste: z.leiste }, m || {}));
    }
    await page._ctx.close();
  }

  // ---- C: ein unbekannter Schluessel laesst den Reiter nicht leer ------------------------------
  for (const z of ZEILEN.filter(x => !x.mehrfach)){
    const zustandsSchluessel = { Flotte:'fleetSubTab', Offiziere:'officerSubTab', Galaxie:'galaxySubTab', Allianz:'allianceSubTab' }[z.name];
    const extra = {}; extra[zustandsSchluessel] = 'erfunden-xyz';
    const page = await seite(b, 390, extra);
    await reiter(page, z.tab);
    const m = await page.evaluate(zz => {
      const sichtbar = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
      const leiste = document.querySelector(zz.leiste);
      const knoepfe = leiste ? [...leiste.querySelectorAll('[' + zz.attribut + ']')] : [];
      const ersterKey = knoepfe.length ? knoepfe[0].getAttribute(zz.attribut) : null;
      const panels = zz.panels
        ? [...document.querySelectorAll(zz.panels)].map(sichtbar)
        : zz.ids.map(id => sichtbar(document.getElementById(id)));
      return { ersterKey, sichtbare: panels.filter(Boolean).length, panels: panels.length,
               aktiv: knoepfe.filter(k => k.classList.contains(zz.aktiv)).map(k => k.getAttribute(zz.attribut)) };
    }, { leiste: z.leiste, attribut: z.attribut, aktiv: z.aktiv, panels: z.panels, ids: PANEL_IDS[z.name] });
    check('C ' + z.name + ': unbekannter Schluessel faellt auf den ERSTEN Reiter zurueck, statt alles auszublenden',
      m.sichtbare === 1 && m.aktiv.length === 1 && m.aktiv[0] === m.ersterKey, m);
    await page._ctx.close();
  }

  await b.close();
  ende();
})();
