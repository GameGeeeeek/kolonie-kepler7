// Die Reiterleiste auf dem Handy: alle zwölf Reiter gleichzeitig erreichbar?
//
// WAS HIER ABGESICHERT WIRD (01.08.2026)
// --------------------------------------
// Die Leiste war eine Wischleiste mit 1.455px Inhalt in einem 348px breiten Fenster - zwei von
// zwölf Reitern waren ganz sichtbar. Jetzt ist sie ein 6x2-Raster mit Symbol und Beschriftung.
//
// Drei Fallen, an denen der Umbau unterwegs jeweils gescheitert ist, und die dieser Test deshalb
// einzeln festhält:
//
//   1. DOPPELTE SYMBOLE. Expedition und Sektorkarte trugen BEIDE ti-map-2 und unterschieden sich
//      nur in der Farbe. Mit Beschriftung ging das durch; in einer engen Rasterzelle ist das Symbol
//      das Erkennungsmerkmal. Geprüft wird die EIGENSCHAFT (keine zwei Reiter teilen sich ein
//      Symbol), nicht "Expedition hat einen Kompass" - sonst müsste der Test bei jedem neuen
//      Reiter nachgezogen werden und würde ein neues Duplikat trotzdem durchlassen.
//
//   2. REIHENFOLGE IM STYLESHEET. Der Raster-Block stand zuerst VOR der Basisregel .tab-btn. Eine
//      @media-Abfrage erhöht die Spezifität nicht - die spätere Basisregel gewann mit font-size,
//      padding und gap zurück, die Knöpfe wurden 64px hoch und sechs Beschriftungen brachen ab.
//      Der Test misst deshalb die WIRKUNG (nichts abgeschnitten), nicht die Existenz der Regel.
//
//   3. DIE SEITLICHEN KLAPPEN. .edge-tab steht mit position:fixed auf halber Höhe und liegt mit
//      z-index:50 ÜBER der Leiste (z-index:25). Ein Reiter darunter ist nicht antippbar. Das war
//      schon vorher so - gemessen verdeckten die Klappen bereits "Basis" und "Forschung".
//      ENTSCHEIDEND: auf ZWEI Bildschirmgrößen prüfen. Der erste Reparaturversuch (top:64%) räumte
//      die Leiste auf 390x844 frei und schob die Klappe auf 360x740 wieder hinein. Eine Messung auf
//      nur einer Größe hätte das durchgewinkt.
const { starteBrowser, SPIELDATEI } = require('./lib/umgebung');
const path = require('path');
const fs = require('fs');
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

const SPEICHER = JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  seenTabHints:{ basis:1, verteidigung:1, forschung:1, flotte:1, expedition:1, karte:1,
                 galaxie:1, allianz:1, offiziere:1, markt:1, punkte:1, fortschritt:1 },
  resources:{ energie:412000, erz:388000, kristalle:264000, deuterium:151000, antimaterie:19400, forschungspunkte:31200 },
  buildings:{ solar:20, mine:19, raffinerie:15, synth:13, labor:12, werft:12, hangar:8, lager:12 },
  research:{ rsolar:8, rerz:8, rkampf:7 }, fleet:{ jaeger:420, missions:[] },
  colonies:{}, activeBasePlanet:'home', shipMarks:{},
  player:{ id:'u', name:'A', allianceTag:'', avatarKey:null }, battleStats:{ wins:5, losses:1 },
  xp:64000, buffs:[], lastTick:Date.now(), colonyNames:{}, colonyNotes:{} });

// Zwei Größen, und das ist keine Kür: siehe Falle 3 im Kopf dieser Datei.
const GROESSEN = [{ name:'iPhone 14  390x844', w:390, h:844 },
                  { name:'klein      360x740', w:360, h:740 }];

(async () => {
  let fail = false;
  const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };
  const src = fs.readFileSync(SPIELDATEI, 'utf8');
  const b = await starteBrowser();
  const store = {}; store['kepler7-save-v3'] = SPEICHER;

  async function oeffne(w, h){
    const ctx = await b.newContext({ viewport:{ width:w, height:h }, hasTouch:w<=700, isMobile:w<=700 });
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
    return { ctx, page };
  }

  // ---- 1: Kein Reiter teilt sich sein Symbol mit einem anderen ----------------------------------
  {
    const { ctx, page } = await oeffne(390, 844);
    const symbole = await page.evaluate(() => {
      return [...document.querySelectorAll('.tabs .tab-btn')].map(btn => {
        const i = btn.querySelector('i.ti');
        if (i) return { tab: btn.getAttribute('data-tab'),
                        symbol: [...i.classList].find(c => c.startsWith('ti-') ) || '?' };
        const svg = btn.querySelector('svg');
        // Die Pfaddaten sind die Identität der Zeichnung - zwei verschiedene SVGs mit gleichem
        // Inhalt waeren genauso ein Duplikat wie zwei gleiche ti-Klassen.
        return { tab: btn.getAttribute('data-tab'),
                 symbol: 'svg:' + [...svg.querySelectorAll('*')].map(e => e.getAttribute('d') || e.tagName).join('|').slice(0, 60) };
      });
    });
    check('alle zwölf Reiter gefunden', symbole.length === 12, symbole.length);
    const zaehler = {};
    for (const s of symbole) (zaehler[s.symbol] = zaehler[s.symbol] || []).push(s.tab);
    const doppelt = Object.entries(zaehler).filter(([, tabs]) => tabs.length > 1)
      .map(([sym, tabs]) => tabs.join('+') + ' teilen ' + sym.slice(0, 24));
    check('kein Symbol wird von zwei Reitern benutzt', doppelt.length === 0, doppelt);
    // Gegenprobe: Der Scan erkennt Symbole ueberhaupt (nicht alles '?').
    check('Gegenprobe: die Symbole wurden wirklich gelesen',
      symbole.every(s => s.symbol && s.symbol !== '?'), symbole.map(s => s.tab + '=' + s.symbol.slice(0, 14)));
    // Und die Expedition traegt eine eigene Zeichnung, keinen Schriftglyph mehr.
    const exp = symbole.find(s => s.tab === 'expedition');
    check('die Expedition hat eine eigene Zeichnung', !!exp && exp.symbol.startsWith('svg:'), exp && exp.symbol.slice(0, 30));
    await ctx.close();
  }
  // Die Zeichnung muss im Strich-Stil der Nachbarglyphen stehen, sonst ist sie in der Leiste der
  // Fremdkoerper - deshalb currentColor statt Farbverlauf.
  check('die Reiter-Zeichnung nutzt currentColor (Strich-Stil wie die Schriftglyphen daneben)',
    /\.tab-icon-badge \.tab-svg-icon \{[^}]*stroke:currentColor/.test(src));
  check('und keinen Farbverlauf', !/\.tab-svg-icon[^}]*url\(#g/.test(src));

  // ---- 2 + 3: Das Raster auf beiden Handy-Größen ------------------------------------------------
  for (const g of GROESSEN){
    const { ctx, page } = await oeffne(g.w, g.h);
    const m = await page.evaluate(() => {
      const bar = document.querySelector('.tabs'), bb = bar.getBoundingClientRect();
      const btns = [...bar.querySelectorAll('.tab-btn')];
      const drin = el => { const r = el.getBoundingClientRect();
        return r.left >= bb.left - 1 && r.right <= bb.right + 1 && r.top >= bb.top - 1 && r.bottom <= bb.bottom + 1; };
      const klappen = [...document.querySelectorAll('.edge-tab')].map(e => e.getBoundingClientRect());
      return {
        anzeige: getComputedStyle(bar).display,
        hoehe: Math.round(bb.height),
        ganz: btns.filter(drin).length,
        alle: btns.length,
        // scrollWidth > clientWidth heisst: der Text passt nicht in den Knopf.
        abgeschnitten: btns.filter(x => x.scrollWidth > x.clientWidth + 1).map(x => x.getAttribute('data-tab')),
        zuKlein: btns.filter(x => { const r = x.getBoundingClientRect(); return r.height < 32 || r.width < 32; })
                     .map(x => x.getAttribute('data-tab')),
        verdeckt: btns.filter(x => { const r = x.getBoundingClientRect();
          return klappen.some(k => r.left < k.right && r.right > k.left && r.top < k.bottom && r.bottom > k.top); })
          .map(x => x.getAttribute('data-tab')),
        wischbar: bar.scrollWidth > bar.clientWidth + 2,
        klappen: klappen.length
      };
    });
    const p = g.name + ': ';
    check(p + 'die Leiste ist ein Raster, keine Wischleiste', m.anzeige === 'grid' && !m.wischbar, m);
    check(p + 'ALLE zwölf Reiter sind gleichzeitig sichtbar', m.ganz === m.alle && m.alle === 12, { ganz: m.ganz, alle: m.alle });
    check(p + 'keine Beschriftung wird abgeschnitten', m.abgeschnitten.length === 0, m.abgeschnitten);
    check(p + 'jeder Reiter bleibt ein treffbares Ziel (>=32px)', m.zuKlein.length === 0, m.zuKlein);
    check(p + 'die seitlichen Klappen verdecken keinen Reiter', m.verdeckt.length === 0, m.verdeckt);
    check(p + 'Gegenprobe: es gibt überhaupt Klappen zu kollidieren', m.klappen >= 2, m.klappen);
    // Klicken muss funktionieren - ein Raster nutzt nichts, wenn die Handler nicht mehr greifen.
    const gewechselt = await page.evaluate(async () => {
      const ziel = document.querySelector('.tab-btn[data-tab="markt"]');
      ziel.click();
      await new Promise(r => setTimeout(r, 700));
      return document.querySelector('.tab-btn[data-tab="markt"]').classList.contains('active');
    });
    check(p + 'ein Reiter am Ende der Leiste lässt sich anklicken (Markt)', gewechselt === true);
    await ctx.close();
  }

  // ---- 4: Auf breiten Bildschirmen bleibt alles beim Alten --------------------------------------
  {
    const { ctx, page } = await oeffne(1440, 900);
    const m = await page.evaluate(() => {
      const bar = document.querySelector('.tabs');
      const btn = bar.querySelector('.tab-btn');
      return { anzeige: getComputedStyle(bar).display,
               schrift: getComputedStyle(btn).fontSize,
               richtung: getComputedStyle(btn).flexDirection,
               trenner: [...bar.querySelectorAll('.tab-group-divider')].filter(d => d.getBoundingClientRect().width > 0).length };
    });
    check('Desktop: weiterhin Fluss-Layout, kein Raster', m.anzeige === 'flex', m);
    check('Desktop: weiterhin volle Schriftgröße', parseFloat(m.schrift) >= 12, m.schrift);
    check('Desktop: die drei Domänen-Trenner sind weiterhin sichtbar', m.trenner === 3, m.trenner);
    await ctx.close();
  }

  await b.close();
  console.log(fail ? '\nFAIL' : '\nPASS');
  process.exit(fail ? 1 : 0);
})();
