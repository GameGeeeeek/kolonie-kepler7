// Hochkant gedrehte Karten auf dem Handy (27.07.2026, v8.315.0).
//
// Spieler-Report mit fünf Fotos vom Handy. Zwei Fehlerbilder, eine Wurzel: .card-row ist als
// WAAGERECHTE Zeile entworfen (align-items:center, justify-content:space-between) und wird an rund
// 95 Stellen per Inline-Style auf flex-direction:column gedreht. Drei Regeln kippen dabei mit ins
// Senkrechte und werden dort falsch:
//   (1) justify-content:space-between verteilt die Kinder über die volle KARTENHÖHE. In den
//       Wischleisten sind alle Karten so hoch wie die höchste (align-items:stretch) - gemessen
//       klaffte in einer 177 px hohen Rollen-Karte ein Loch von 114 px zwischen Titel und Text.
//   (2) flex-wrap:wrap (unter 480px) bricht in eine zweite SPALTE statt in eine zweite Zeile.
//   (3) > *:last-child{flex:1 1 100%} meint "eigene Zeile"; senkrecht sind 100% aber die HÖHE.
//       (2)+(3) zusammen stellten den "Wählen"-Knopf hochkant über die ganze Kartenhöhe rechts
//       neben den Text, wo ihn der Kartenrand halb abschnitt.
//
// Dieselbe Fehlerklasse war am 25.07.2026 schon für die Modul-Slots dran (.mod-slot). Dort wurde
// sie für EINE Stelle gelöst; die Wischleisten blieben übrig.
//
// Zweites Foto, Boni-Bilanz: Titel brachen mitten im Wort ("Angriff/skraft", "Heimatb/asis").
// Ursache war overflow-wrap:anywhere - es meldet dem Flex-Layout Mindestbreite NULL, die Textspalte
// durfte also beliebig schmal werden, weil der Zahlenblock daneben mit white-space:nowrap
// unschrumpfbar war. Drei Änderungen zusammen: break-word statt anywhere (Mindestbreite = längstes
// Wort), flex-wrap auf .bname (Name und Ortszusatz sind eigene Flex-Items), und der Zahlenblock in
// zwei kurze Zeilen statt einer langen.
//
// Geprüft wird an der WIRKUNG, nicht an der CSS-Regel:
//   1) kein Loch: in den Wischleisten-Karten kein Abstand > 40px zwischen zwei Kindern
//   2) nichts ragt über den Kartenrand hinaus
//   3) der Knopf ist voll da und anklickbar (er war halb abgeschnitten)
//   4) Boni-Bilanz: kein Überlauf und keine Überlappung, über vier Gerätebreiten
//   5) kein Wortumbruch mitten im Wort im Titel
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI, ruhigeUhren } = require('./lib/umgebung');
const fs = require('fs');

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}

// prestige:2 sorgt dafür, dass in der Boni-Bilanz wirklich Werte stehen (sonst wäre Prüfung 4 an
// lauter Nullzeilen gemessen und damit fast leer wahr).
const SAVE = JSON.stringify({ ...ruhigeUhren(), tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:2e4,forschungspunkte:3e4},
  buildings:{solar:22,mine:20,labor:14,lager:16,werft:14}, research:{}, fleet:{jaeger:600,missions:[]},
  colonies:{}, activeBasePlanet:'home', player:{id:'u',name:'A',avatarKey:null},
  planetRoles:{ home:'forschung' }, prestige:2, xp:260000,
  battleStats:{wins:64,losses:11}, credits:180000, buffs:[], lastTick:Date.now(), colonyNames:{} });

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

async function seite(browser, breite){
  const store={'kepler7-save-v3':SAVE};
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], {
    viewport:{width:breite,height:900}, isMobile:true, hasTouch:true }));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  // Der Rollenwechsel fragt per confirm() nach. Playwright verwirft Dialoge sonst stillschweigend,
  // setPlanetRole kehrt dann sofort zurück - und der Klicktest hätte "wirkt nicht" gemeldet,
  // obwohl der Knopf einwandfrei ist.
  page.on('dialog', d => d.accept());
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(2700);
  await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='none';});});
  return { page, ctx, errs };
}

(async () => {
  const browser = await starteBrowser();

  // ------------------------------------------------- 1-3) Wischleisten-Karten (Planeten-Rolle)
  {
    const { page, ctx, errs } = await seite(browser, 412);
    const m = await page.evaluate(()=>{
      const karten=[...document.querySelectorAll('[data-hscroll="roles"] > .card-row')];
      let luecke=0, ueber=0;
      for (const k of karten){
        const kr=k.getBoundingClientRect();
        const kids=[...k.children].map(c=>c.getBoundingClientRect());
        for (let i=1;i<kids.length;i++) luecke=Math.max(luecke, Math.round(kids[i].top-kids[i-1].bottom));
        for (const c of kids) ueber=Math.max(ueber, Math.round(c.right-kr.right));
      }
      const knopf=document.querySelector('[data-hscroll="roles"] [data-set-planet-role]');
      const kb=knopf?knopf.getBoundingClientRect():null;
      return { anzahl:karten.length, luecke, ueber,
               knopfBreit: kb?Math.round(kb.width):0, knopfHoch: kb?Math.round(kb.height):0,
               knopfText: knopf?knopf.textContent.trim():null };
    });
    // Nicht-Leerheit zuerst: Ohne Karten misst der Rest nichts.
    check('1: die Rollen-Wischleiste ist gerendert', m.anzahl >= 3, m);
    // Schwelle 25px: Der normale Abstand zwischen den Kartenzeilen liegt bei 16px. Die erste
    // Fassung dieses Tests ließ 40px durch - in der Rot-Probe blieb sie damit grün, weil das Loch
    // ohne die justify-content-Regel bei 37px lag (die zweite Regel für das letzte Kind allein
    // fängt schon den größten Teil ab). Erst 25px trennt "in Ordnung" von "kaputt".
    check('1: kein Loch zwischen den Kartenzeilen (war 114px in 177px Kartenhöhe)',
      m.luecke <= 25, { luecke:m.luecke });
    check('2: nichts ragt über den Kartenrand hinaus', m.ueber <= 0, { ueber:m.ueber });
    // Der Knopf stand hochkant als eigene Spalte über die ganze Kartenhöhe: breiter als hoch ist
    // die Messung, die genau das ausschließt.
    check('3: der Knopf liegt waagerecht, nicht hochkant als zweite Spalte',
      m.knopfBreit > m.knopfHoch * 1.5, { breit:m.knopfBreit, hoch:m.knopfHoch });
    // Zweite, absolute Messung: flex:1 1 100% am letzten Kind streckt den Knopf senkrecht auf die
    // gesamte Restfläche der Karte - gemessen 86px statt der normalen 44px. Das Seitenverhältnis
    // allein fängt das nicht, ein 220x86-Knopf ist immer noch breiter als hoch; ohne diese Zeile
    // blieb die Rot-Probe für die last-child-Regel grün.
    check('3: der Knopf ist nicht senkrecht aufgeblasen (war 86px statt 44px)',
      m.knopfHoch > 0 && m.knopfHoch <= 60, { hoch:m.knopfHoch });
    check('3: und trägt seinen vollen Text', m.knopfText === 'Wählen' || m.knopfText === 'Umbauen', m.knopfText);

    // Er muss auch wirklich klickbar sein - breit genug allein hilft nichts, wenn der Handler am
    // abgeschnittenen Knoten hängt. Ohne bisherige Rolle setzt der erste Klick sie sofort, die Karte
    // trägt danach den "Aktiv"-Haken.
    const vorher = await page.evaluate(()=>document.querySelectorAll('[data-hscroll="roles"] .badge-done').length);
    await page.evaluate(()=>{const b=document.querySelector('[data-hscroll="roles"] [data-set-planet-role]'); if(b) b.click();});
    await page.waitForTimeout(900);
    const nachher = await page.evaluate(()=>document.querySelectorAll('[data-hscroll="roles"] .badge-done').length);
    check('3: ein Klick darauf wirkt', vorher === 0 && nachher === 1, { vorher, nachher });
    check('keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ------------------------------------------------- 4+5) Boni-Bilanz über vier Gerätebreiten
  for (const breite of [320, 360, 412, 480]){
    const { page, ctx } = await seite(browser, breite);
    await page.evaluate(()=>{const b=document.querySelector('.tab-btn[data-tab="fortschritt"]');if(b)b.click();});
    await page.waitForTimeout(1000);
    const m = await page.evaluate(()=>{
      const karten=[...document.querySelectorAll('#bonusBalanceBox .card-row')];
      let ueberlauf=0, ueberlapp=0, schuld=null;
      for (const k of karten){
        const kr=k.getBoundingClientRect();
        const kopf=k.firstElementChild;
        if (kopf && kopf.children.length===2){
          const a=kopf.children[0].getBoundingClientRect(), b=kopf.children[1].getBoundingClientRect();
          ueberlapp=Math.max(ueberlapp, Math.round(a.right-b.left));
        }
        for (const el of k.querySelectorAll('*')){
          const r=el.getBoundingClientRect();
          const u=Math.round(r.right-(kr.right-16)); // 16 = rechte Polsterung der Karte
          if (u>ueberlauf){ ueberlauf=u; schuld=el.tagName+'.'+el.className+' :: '+el.textContent.slice(0,30); }
        }
      }
      return { karten:karten.length, ueberlauf, ueberlapp, schuld,
               seitenlauf: Math.round(document.documentElement.scrollWidth-document.documentElement.clientWidth) };
    });
    check(breite+'px | 4: die Boni-Bilanz ist gefüllt', m.karten >= 10, m.karten);
    check(breite+'px | 4: nichts ragt über den Kartenrand', m.ueberlauf <= 0, { ueberlauf:m.ueberlauf, schuld:m.schuld });
    check(breite+'px | 4: Text und Zahlen überlappen sich nicht', m.ueberlapp <= 0, m.ueberlapp);
    check(breite+'px | 4: die Seite läuft nicht waagerecht über', m.seitenlauf <= 0, m.seitenlauf);
    await ctx.close();
  }

  // ------------------------------------------------- 5) kein Umbruch mitten im Wort
  // Gemessen wird JEDES WORT einzeln, nicht die Zeilenzahl des ganzen Titels: "Treibstoffkosten
  // (Module)" darf sehr wohl zweizeilig sein - es bricht an der Leerstelle, und das ist richtig.
  // Falsch ist nur ein Bruch INNERHALB eines Wortes, und der zeigt sich daran, dass der Range um
  // dieses eine Wort zwei Rechtecke statt einem liefert. Der erste Entwurf maß den ganzen Textknoten
  // und schlug deshalb bei einem völlig korrekten Umbruch an.
  {
    const { page, ctx } = await seite(browser, 412);
    await page.evaluate(()=>{const b=document.querySelector('.tab-btn[data-tab="fortschritt"]');if(b)b.click();});
    await page.waitForTimeout(1000);
    const m = await page.evaluate(()=>{
      const zerrissen=[]; let geprueft=0;
      for (const el of document.querySelectorAll('#bonusBalanceBox .bname, #bonusBalanceBox .bmeta')){
        for (const knoten of el.childNodes){
          if (knoten.nodeType !== 3) continue;
          const text = knoten.textContent;
          // "Wort" heißt hier: Zeichenkette ohne jede erlaubte Trennstelle. Bindestrich, Klammer und
          // Schrägstrich SIND welche - "Saison-Events," darf dort umbrechen, das ist richtiges Deutsch
          // und kein Fehler. Der erste Entwurf trennte nur an Leerzeichen und meldete deshalb vier
          // völlig korrekte Umbrüche als Defekt.
          const re = /[^\s\-–—/()]+/g; let m;
          while ((m = re.exec(text)) !== null){
            if (m[0].length < 4) continue; // "·", "von", "max." brechen ohnehin nie
            const rng = document.createRange();
            rng.setStart(knoten, m.index);
            rng.setEnd(knoten, m.index + m[0].length);
            geprueft++;
            if (rng.getClientRects().length > 1) zerrissen.push(m[0]);
          }
        }
      }
      return { geprueft, zerrissen };
    });
    // Schutz gegen eine leere Wahrheit: Ohne geprüfte Wörter könnte die Hauptprüfung nie etwas finden.
    check('5: es wurden wirklich Wörter gemessen', m.geprueft >= 60, m.geprueft);
    check('5: kein Wort bricht mitten im Wort um (war "Angriff/skraft", "Heimatb/asis")',
      m.zerrissen.length === 0, m.zerrissen.slice(0,6));
    await ctx.close();
  }

  // ------------------------------------------------- Quelltext-Prüfungen
  const src = fs.readFileSync(SPIELDATEI, 'utf8');
  check('Q: die gedrehte card-row nimmt die Zeilen-Regeln zurück',
    /\.card-row\[style\*="flex-direction:column"\] \{ justify-content: flex-start; flex-wrap: nowrap; \}/.test(src)
    && /\.card-row\[style\*="flex-direction:column"\] > \*:last-child \{ flex: 0 0 auto; \}/.test(src));
  // Der Attribut-Selektor greift nur, solange die Inline-Schreibweise einheitlich bleibt. Fügt
  // jemand ein "flex-direction: column" mit Leerzeichen ein, greift die Regel dort still nicht mehr.
  check('Q: die Inline-Schreibweise ist einheitlich ohne Leerzeichen',
    (src.match(/flex-direction: +column/g)||[]).length === 0,
    (src.match(/flex-direction: +column/g)||[]).length);
  check('Q: der Textblock meldet das längste Wort als Mindestbreite',
    /\.card-row \.left > div:last-child \{ min-width:0; overflow-wrap:break-word; \}/.test(src));
  check('Q: .bname darf umbrechen', /\.bname \{[^}]*flex-wrap:wrap;/.test(src));

  console.log('\n' + (fail ? 'FAIL' : 'PASS'));
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
