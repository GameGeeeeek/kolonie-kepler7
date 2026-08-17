// Die Protomaterie-Karte steht auch ohne die Forschung da - ausgegraut, mit Hinweis
// (Wunsch Sascha, 17.08.2026).
//
// VORHER: Die Karte erschien erst mit der Forschung Minentechnik (oder sobald man Protomaterie
// besass). Wer noch nie von Asteroiden gehoert hatte, sah an dieser Stelle gar nichts - und
// erfuhr damit auch nicht, dass es diesen Rohstoff gibt. Jetzt ist sie ein sichtbares Ziel.
//
// DIE STELLE, AN DER SO ETWAS STILL KAPUTTGEHT, und deshalb der Kern dieses Tests: Die Leiste
// benutzt eine Signatur aus WERTEN, um sich das Neuzeichnen zu sparen. Ohne die Forschung stehen
// Stand (0) und Deckel (500) beide fest - die Signatur aendert sich beim Abschluss der Forschung
// also NICHT, und die Karte bliebe ausgegraut stehen, obwohl sie freigeschaltet ist. Genau davor
// warnt CLAUDE.md bei Wertlisten-Signaturen. Pruefung 3 faehrt deshalb den echten UEBERGANG.
//
// GEPRUEFT WIRD:
//   1. Ohne Minentechnik: Karte da, ausgegraut, nennt die Forschung, KEIN Fuellstandsbalken und
//      keine "0 / 500"-Zahl (die laese sich wie ein Mangel statt wie ein offener Weg).
//   2. Mit Minentechnik: die normale Karte mit Stand, Deckel und Balken - kein Schloss mehr.
//   3. DER UEBERGANG im laufenden Spiel: Eine LAUFENDE Minentechnik-Forschung wird waehrend des
//      Tests fertig (checkResearch im normalen Tick), die Karte muss umschalten. Faellt diese
//      Pruefung, ist die Signatur unvollstaendig. Bewusst NICHT von aussen gesetzt: `state` lebt
//      im Modulscope, ein window-Zugriff lief stumm ins Leere und die Pruefung mass nichts -
//      erst der echte Weg macht sie aussagekraeftig (CLAUDE.md Regel 47, zweite Haelfte).
//   4. Die Trennung im Quelltext: protomaterieFreigeschaltet() entscheidet den ZUGANG, und die
//      Abbau-Vorschau fragt weiterhin danach (dort gibt es ohne Forschung ohnehin nichts).
//
// GEGENPROBE (Arbeitsregel 1, in beide Richtungen ausgefuehrt):
//   - Am Stand v8.543.0 fallen 4a/4b/4c (Trennung und Signatur gibt es nicht) sowie 1-vorab und
//     3-vorab (ohne Forschung existiert dort GAR KEINE Karte, gemessen: null). Die sieben
//     uebrigen (1a-1e, 3a/3b) laufen dort nicht - jede haengt an einer dieser Bedingungen, und
//     die meldet den Grund (Arbeitsregel 34/37).
//   - ZUSAETZLICH an einer sabotierten Kopie belegt, weil nur sie die eigentliche Falle trifft:
//     Nimmt man `protoFrei` aus der Signatur heraus, bleibt die Karte nach Abschluss der
//     Forschung AUSGEGRAUT stehen (gemessen: vorher true, nachher true) - 3a/3b fallen. Ohne
//     diese Probe waere nicht belegt, dass die Signatur-Zeile wirklich das Umschalten traegt.
//   - Und 3a haengt seit dieser Runde an 3-vorab: Am alten Stand war es faelschlich GRUEN, weil
//     die Karte dort vorher gar nicht da war und danach neu erschien ("nicht gesperrt" trivial
//     wahr, vorher:null) - Arbeitsregel 28.
const fs = require('fs');
const { SPIELDATEI, SPIEL_URL, starteBrowser, pruefer } = require('./lib/umgebung');
const { check, ende } = pruefer();

const JS = fs.readFileSync(SPIELDATEI, 'utf8').match(/<script>([\s\S]*)<\/script>/)[1];

// ---- 4) Quelltext: Zugang und Anzeige sind getrennt ------------------------------------------
{
  check('4a: protomaterieFreigeschaltet() gibt es und fragt die Forschung',
    /function protomaterieFreigeschaltet\(\)\{[\s\S]{0,160}rminentechnik/.test(JS));
  const von = JS.indexOf('  function protomaterieSichtbar(){');
  const bis = von < 0 ? -1 : JS.indexOf('\n  }', von);
  check('4b-anker: protomaterieSichtbar ist auffindbar', von > 0 && bis > von, { von, bis });
  check('4b: sie baut auf der Freischaltung auf, statt die Bedingung zu wiederholen',
    von > 0 && /protomaterieFreigeschaltet\(\)/.test(JS.slice(von, bis)), JS.slice(von, bis > von ? bis : von+120));
  // Die Signatur der Leiste MUSS den Freischalt-Zustand tragen - siehe Kopfkommentar.
  const sigZeile = (JS.match(/const sig = \(proto \?[^\n]*/) || [''])[0];
  check('4c: die Signatur der Leiste fuehrt den Freischalt-Zustand mit',
    /protoFrei/.test(sigZeile), sigZeile.slice(0, 160));
}

// ================================================================== am laufenden Spiel
const SAVE_KEY = 'kepler7-save-v3';
// laufendeForschungSek: legt eine LAUFENDE Minentechnik-Forschung an, die waehrend des Tests
// fertig wird. Der Uebergang wird damit auf dem ECHTEN Weg hergestellt (checkResearch schreibt
// state.research) statt von aussen - `state` lebt im Modulscope der Spieldatei und ist per
// window gar nicht erreichbar; ein Zugriff von aussen lief stumm ins Leere und der Test mass
// nichts (dieselbe Falle wie bei log(), CLAUDE.md Regel 47).
function fixture(mitForschung, protoBestand, laufendeForschungSek){
  const jetzt = Date.now();
  return JSON.stringify({
    tutorialSeen:true, newbieWelcomeSeen:true, lastTick:jetzt,
    nextPlanetEventCheck: jetzt+36e5, nextTraderCheck: jetzt+36e5, nextRaidTime: jetzt+36e5, nextFactionGift: jetzt+36e5,
    resources:{energie:5e5,erz:5e5,kristalle:3e5,deuterium:2e5,antimaterie:1e4,forschungspunkte:2e4,
               protomaterie: protoBestand || 0},
    buildings:{solar:20,mine:12,labor:8,lager:20,werft:10},
    research: mitForschung ? { rminentechnik:1 } : {},
    activeResearch: laufendeForschungSek
      ? { key:'rminentechnik', targetLevel:1, endTime: jetzt + laufendeForschungSek*1000 }
      : null,
    fleet:{ missions:[] }, colonies:{}, activeBasePlanet:'home',
    xp:50000, credits:20000, buffs:[], colonyNames:{}, modules:{}, shipModules:{},
    player:{id:'u',name:'A',avatarKey:null}
  });
}
function backend(store){ return async r => {
  const req = r.request(); const p = req.url().split('/api/')[1].split('?')[0];
  const j = (o, s = 200) => r.fulfill({ status:s, contentType:'application/json', body: JSON.stringify(o) });
  if (p === 'health') return j({ ok:true });
  if (p === 'me') return j({ userId:'u', username:'A', homeSystem:'kepler', homeSlot:0, attackShieldMs:0, hasEmail:true, wantsPatchnotes:true });
  if (p.startsWith('storage/')){
    const k = decodeURIComponent(p.slice(8));
    if (req.method() === 'PUT'){ try { store[k] = JSON.parse(req.postData()||'{}').value; } catch(e){} return j({ ok:true }); }
    if (store[k] !== undefined) return j({ key:k, value:store[k], version:1 });
    return j({ e:1 }, 404);
  }
  if (p === 'reports'){ if (req.method() === 'POST') return j({ ok:true }); return j({ reports: [] }); }
  if (/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending|notifications/.test(p)) return j(p.includes('pending') ? { reward:null } : []);
  return j({});
};}
async function spiel(browser, save){
  const store = {}; store[SAVE_KEY] = save;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token', 'tok'));
  await page.goto(SPIEL_URL);
  await page.waitForTimeout(3500);
  await page.evaluate(() => { ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id => { const o=document.getElementById(id); if(o) o.style.display='none'; }); });
  return { ctx, page, store, errs };
}
const karte = (page) => page.evaluate(() => {
  const el = document.querySelector('[data-res="protomaterie"]');
  if (!el) return null;
  return {
    text: (el.textContent||'').replace(/\s+/g,' ').trim(),
    gesperrt: el.hasAttribute('data-gesperrt'),
    balken: !!el.querySelector('.t2-fill'),
    titel: el.getAttribute('title') || ''
  };
});

(async () => {
  const browser = await starteBrowser();

  // ---- 1) OHNE Forschung: da, aber gesperrt --------------------------------------------------
  {
    const t = await spiel(browser, fixture(false, 0));
    const k = await karte(t.page);
    check('1-vorab: die Karte ist ueberhaupt da (frueher fehlte sie hier ganz)', !!k, k);
    if (k){
      check('1a: sie ist als gesperrt gekennzeichnet', k.gesperrt === true, k.gesperrt);
      check('1b: und nennt die fehlende Forschung beim Namen', /Minentechnik/.test(k.text), k.text.slice(0, 120));
      check('1c: ohne Fuellstandsbalken - es gibt nichts zu fuellen', k.balken === false, k.balken);
      check('1d: und ohne "0 / 500", das sich wie ein Mangel laese',
        !/\/\s*500/.test(k.text), k.text.slice(0, 120));
      check('1e: der Tooltip erklaert, wofuer der Rohstoff gut ist',
        /Asteroid/.test(k.titel), k.titel.slice(0, 140));
    }
    check('1f: keine JS-Fehler', t.errs.length === 0, t.errs.slice(0,3));
    await t.ctx.close();
  }

  // ---- 2) MIT Forschung: die normale Karte ---------------------------------------------------
  {
    const t = await spiel(browser, fixture(true, 120));
    const k = await karte(t.page);
    check('2-vorab: die Karte ist da', !!k, k);
    if (k){
      check('2a: nicht mehr gesperrt', k.gesperrt === false, k.gesperrt);
      check('2b: mit Stand und Deckel', /120/.test(k.text) && /500/.test(k.text), k.text.slice(0, 120));
      check('2c: und mit Fuellstandsbalken', k.balken === true, k.balken);
      check('2d: kein Schloss-Hinweis mehr', !/Benötigt Minentechnik/.test(k.text), k.text.slice(0, 120));
    }
    await t.ctx.close();
  }

  // ---- 3) DER UEBERGANG - die eigentliche Falle ----------------------------------------------
  {
    // Die Forschung laeuft noch 6 s - beim Booten (3,5 s) ist sie also nicht fertig, waehrend des
    // Messfensters darunter schon. Kein Eingriff von aussen: checkResearch schliesst sie im
    // normalen Tick ab, genau wie im Spiel.
    const t = await spiel(browser, fixture(false, 0, 6));
    const vorher = await karte(t.page);
    check('3-vorab: startet gesperrt (Forschung laeuft noch)', !!vorher && vorher.gesperrt === true, vorher && vorher.gesperrt);
    // Auf den Abschluss warten und danach mehrere Ticks - die Leiste zeichnet im Sekundentakt,
    // aber nur bei geaenderter Signatur.
    for (let i = 0; i < 30; i++){
      const k = await karte(t.page);
      if (k && k.gesperrt === false) break;
      await t.page.waitForTimeout(500);
    }
    const nachher = await karte(t.page);
    /* 3a/3b haengen an 3-vorab (Arbeitsregel 28): Ohne eine ANFANGS GESPERRTE Karte messen sie
       nichts ueber die Signatur. Am alten Stand war 3a genau deshalb faelschlich gruen - dort gab
       es vorher gar keine Karte (vorher:null), sie ERSCHIEN nur neu, und "nicht gesperrt" war
       trivial wahr. Eine Pruefung, die aus dem falschen Grund gruen ist, ist so schlecht wie eine
       rote; jetzt laeuft sie dort schlicht nicht, und 3-vorab meldet den Grund. */
    if (vorher && vorher.gesperrt === true){
      check('3a: nach dem Abschluss der Forschung schaltet die Karte um (Signatur greift)',
        !!nachher && nachher.gesperrt === false,
        { vorher: vorher && vorher.gesperrt, nachher: nachher && nachher.gesperrt, text: nachher && nachher.text.slice(0,110) });
      check('3b: und zeigt jetzt den Fuellstandsbalken', !!nachher && nachher.balken === true, nachher && nachher.balken);
    }
    await t.ctx.close();
  }

  await browser.close();
  ende();
})();
