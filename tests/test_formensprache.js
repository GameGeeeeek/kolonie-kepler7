// Eine Formensprache im ganzen Spiel (Grafik-Audit 26.07.2026, v8.302.0).
//
// BEFUND, der zu diesem Test führte: Das Spiel sprach zwei Formensprachen gleichzeitig. Die FLÄCHEN
// (Karten, Kacheln, Unterreiter, Modals) waren über zehn Grafik-Runden hinweg auf den HUD-Look mit
// geschnittener Ecke umgestellt worden, die BEDIENELEMENTE nie: 158 border-radius-Angaben in zwölf
// verschiedenen Größen gegen 18 clip-path-Schnittecken in neun Größen. Ausgerechnet die
// meistgeklickten Dinge - Bau-/Kauf-Buttons, die zwölf Reiter, Eingabefelder, Icon-Kacheln - blieben
// weiche App-Pillen auf HUD-Karten.
//
// Der Test hält beide Enden fest:
//   1) QUELLE: die vier --cut-Stufen existieren und werden über EINE Polygon-Formel angewandt
//   2) QUELLE: unterhalb des Stylesheets (JS-Vorlagen) gibt es kein px-border-radius mehr - genau
//      dort entsteht neuer Code, und eine Inline-Angabe kann von keiner CSS-Regel korrigiert werden
//   3) LAUFZEIT: über alle Tabs hinweg hat KEIN sichtbares Element eine px-Rundung. Echte Kreise
//      (Avatare, Statuspunkte, border-radius:50%) sind ausgenommen - sie sind gewollt.
// Punkt 3 ist der eigentliche Wächter: Punkt 1+2 lassen sich umgehen, indem jemand eine neue
// CSS-Klasse mit border-radius anlegt. Der Laufzeit-Durchgang sieht das trotzdem.
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI, ruhigeUhren } = require('./lib/umgebung');
const fs = require('fs');

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'AdmiralX',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}

// Realistischer Stand: viele Gebäude/Schiffe/Erfolge, damit möglichst viele Kachel- und
// Kartentypen wirklich gerendert werden. Ein leerer Stand zeigt die halbe Oberfläche nicht.
const SAVE = JSON.stringify({ ...ruhigeUhren(), tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:2e4,forschungspunkte:3e4},
  buildings:{solar:22,mine:20,kristallmine:18,deutsynth:16,labor:14,lager:16,werft:14,hangar:10,habitat:12,orbitalstation:4,raketenwerfer:12,laser:10,schild:6},
  research:{rkampf:9,rsolar:9,rerz:8,rmodultechnik:4,rexpedition:5},
  fleet:{jaeger:600,cruisers:200,destroyers:90,bomber:60,carrier:50,enterschiff:14,recycler:20,frachter:60,forscher:8,spaeher:20,schlachtschiff:20,missions:[]},
  unlocked:{enterschiff:true}, debrisFields:{ home:{erz:42000,kristalle:19000} },
  colonies:{}, activeBasePlanet:'home', discovered:{},
  player:{id:'u',name:'AdmiralX',allianceTag:'',avatarKey:'crown'},
  prisengut:1800, enterhaken:2, boardedShips:31, boardings:9, boardAttempts:12,
  battleStats:{wins:64,losses:11}, xp:260000, credits:180000, buffs:[], lastTick:Date.now(),
  colonyNames:{}, colonyNotes:{}, modules:{}, shipModules:{}, expeditionsCompleted:24 });

(async () => {
  // ---------------------------------------------------------------- 1+2: Quelle
  const src = fs.readFileSync(SPIELDATEI,'utf8');
  for (const t of ['--cut-xs','--cut-sm','--cut-md','--cut-lg'])
    check('1: Ecken-Stufe '+t+' ist definiert', new RegExp(t+': ?[0-9]+px;').test(src));
  // Die Formel steht genau einmal - sonst wäre wieder jede Fläche ihre eigene Handzahl.
  const formeln = (src.match(/polygon\(var\(--cut\) 0, 100% 0/g)||[]).length;
  check('1: es gibt genau EINE gemeinsame Schnittecken-Formel', formeln === 1, formeln);
  check('1: sie hängt an --cut, nicht an festen Zahlen',
    /clip-path: polygon\(var\(--cut\) 0, 100% 0, 100% calc\(100% - var\(--cut\)\)/.test(src));

  // lastIndexOf, nicht indexOf: die Datei hat ZWEI <style>-Blöcke (ein kleiner im <head> für den
  // Ladebildschirm, dann das eigentliche Stylesheet). Mit indexOf endete der "JS-Vorlagen"-Abschnitt
  // schon bei Zeile 129 und die Prüfung las in Wahrheit das komplette Haupt-Stylesheet mit - sie
  // hätte also unter falschem Namen angeschlagen. Die Rot-Probe hat genau das sichtbar gemacht.
  // ---------------------------------------------------------------- Rahmenstärken (v8.303.0)
  // BEFUND: fünf Stärken (0.5/1/1.5/2/3px) für in Wahrheit drei Aufgaben. 46 Vollrahmen lagen auf
  // 0.5px, 32 auf 1px - beide im selben Ruhezustand, nur zu verschiedenen Zeiten geschrieben.
  for (const t of ['--bw-1','--bw-2','--bw-rail'])
    check('1: Rahmen-Stufe '+t+' ist definiert', new RegExp(t+': ?[0-9.]+px;').test(src));
  // Die Stufen müssen unterscheidbar bleiben: ein Ruhezustand, der so dick ist wie die
  // Hervorhebung, trägt keine Information mehr.
  const bw = t => parseFloat((src.match(new RegExp(t+': ?([0-9.]+)px;'))||[])[1]);
  check('1: Ruhezustand ist dünner als die Hervorhebung', bw('--bw-1') < bw('--bw-2'), [bw('--bw-1'), bw('--bw-2')]);
  check('1: die Akzentleiste ist die kräftigste Stufe', bw('--bw-rail') > bw('--bw-2'), [bw('--bw-2'), bw('--bw-rail')]);
  // Genau EIN fester px-Rahmenwert darf übrig bleiben: der verdiente Zierring um den Avatar
  // (.frame-ring). Er ist kein Rahmen im Sinne der Skala und im Code ausdrücklich begründet.
  const festeRahmen = src.match(/border(?:-[a-z]+)?: ?[0-9.]+px/g) || [];
  check('1: nur der begründete Zierring hat noch einen festen px-Rahmen',
    festeRahmen.length === 1 && /3px/.test(festeRahmen[0]), festeRahmen);
  check('1: und seine Ausnahme ist im Code begründet',
    /AUSSERHALB der --bw-Skala/.test(src) && /\.frame-ring \{[^}]*border:3px/.test(src));

  const stil = src.lastIndexOf('</style>');
  const vorlagen = src.slice(stil);
  const inline = vorlagen.match(/border-radius: ?[0-9]+px/g) || [];
  check('2: keine px-Rundung mehr in den JS-Vorlagen', inline.length === 0, inline.slice(0,5));
  // Echte Kreise sollen es weiterhin geben - wäre der Wert 0, hätte jemand beim Entfernen der
  // Rundungen zu grob gefegt und aus Avataren und Statuspunkten Kanten gemacht.
  // Die Schwelle gilt für die JS-Vorlagen ALLEIN (dort liegen 8 der Kreise), der Rest steckt im
  // Stylesheet - beim ersten Anlauf war sie gegen die ganze Datei geeicht und schlug fälschlich an.
  const kreiseVorlagen = (vorlagen.match(/border-radius: ?50%/g)||[]).length;
  const kreiseGesamt = (src.match(/border-radius: ?50%/g)||[]).length;
  check('2: echte Kreise in den JS-Vorlagen sind unangetastet', kreiseVorlagen >= 5, kreiseVorlagen);
  check('2: echte Kreise insgesamt sind unangetastet', kreiseGesamt > 25, kreiseGesamt);

  // ---------------------------------------------------------------- 3: Laufzeit
  const browser = await starteBrowser();
  const store={'kepler7-save-v3':SAVE};
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:900,height:1400} }));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(2800);
  await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='none';});});

  const tabs=['basis','forschung','flotte','verteidigung','galaxie','karte','expedition','markt','allianz','offiziere','fortschritt','punkte'];
  const gesamt={};
  for(const t of tabs){
    await page.evaluate(x=>{const b=document.querySelector('.tab-btn[data-tab="'+x+'"]');if(b)b.click();},t);
    await page.waitForTimeout(900);
    const r = await page.evaluate(()=>{
      const out={};
      document.querySelectorAll('*').forEach(e=>{
        const c=getComputedStyle(e);
        const roh=c.borderTopLeftRadius||'';
        // Prozentangaben sind IMMER Kreise/Ellipsen und gewollt. Muss vor dem parseFloat stehen:
        // parseFloat('50%') ergibt 50, und die Halbe-Breite-Prüfung darunter hält das dann
        // fälschlich für eine 50px-Rundung (so ist .map-radar-sweep beim ersten Lauf aufgeschlagen
        // - ein Fehler in der Messung, nicht im Spiel).
        if(roh.includes('%')) return;
        const br=parseFloat(roh)||0;
        if(br<3) return;
        // Echter Kreis/Pille in px: Radius >= halbe Breite und rundum gleich. Ebenfalls gewollt.
        const w=e.getBoundingClientRect().width;
        if(c.borderTopLeftRadius===c.borderTopRightRadius && br>=w/2-1) return;
        const k=e.tagName.toLowerCase()+(typeof e.className==='string'&&e.className.trim()?'.'+e.className.trim().split(/\s+/).slice(0,2).join('.'):'');
        out[k]=(out[k]||0)+1;
      });
      return out;
    });
    for(const [k,v] of Object.entries(r)) gesamt[k]=(gesamt[k]||0)+v;
  }
  const rest=Object.entries(gesamt).sort((a,b)=>b[1]-a[1]);
  check('3: über alle 12 Tabs hat kein Element eine px-Rundung', rest.length === 0, rest.slice(0,8));

  // Gegenprobe zur Messung selbst: Kreise MÜSSEN gefunden werden, sonst prüft der Durchgang oben
  // in Wahrheit nichts (z.B. weil der Selektor nichts trifft oder die Seite leer geblieben ist).
  const rundeDa = await page.evaluate(()=>{
    let n=0; document.querySelectorAll('*').forEach(e=>{ const c=getComputedStyle(e);
      if((c.borderTopLeftRadius||'').includes('%') || parseFloat(c.borderTopLeftRadius)>=e.getBoundingClientRect().width/2-1 && parseFloat(c.borderTopLeftRadius)>3) n++; });
    return n;
  });
  check('3: die Messung sieht überhaupt Elemente (Kreise sind vorhanden)', rundeDa > 3, rundeDa);

  // Der Schnitt ist wirklich aktiv - nicht nur "keine Rundung", sondern die HUD-Ecke. Bewusst
  // `button.buy` statt `button`: das erste <button> im Dokument ist der Schließen-Knopf des
  // Seitenmenüs, und der ist eine der wenigen GEWOLLTEN Kreis-Ausnahmen. Der erste Lauf ist genau
  // darüber gestolpert - auch das ein Fehler in der Prüfung, nicht im Spiel.
  await page.evaluate(()=>{const b=document.querySelector('.tab-btn[data-tab="flotte"]');if(b)b.click();});
  await page.waitForTimeout(900);
  const geschnitten = await page.evaluate(()=>{
    const q=s=>{const e=document.querySelector(s); return e ? (getComputedStyle(e).clipPath||'').startsWith('polygon') : null;};
    return { kaufButton:q('button.buy'), tab:q('.tab-btn'), karte:q('.card-row'), eingabe:q('input[type=text]'), kachel:q('.bicon') };
  });
  check('3: Kauf-Button, Reiter, Karte, Eingabefeld und Icon-Kachel tragen die Schnittecke',
    Object.values(geschnitten).every(v=>v===true), geschnitten);
  // Und die gewollten Ausnahmen sind wirklich Kreise geblieben - sonst hätte die Umstellung
  // über das Ziel hinausgeschossen und aus Avataren und Schließen-Knöpfen Kanten gemacht.
  const kreisAusnahmen = await page.evaluate(()=>{
    const e=document.querySelector('.fp-close-btn');
    if(!e) return 'fehlt';
    const c=getComputedStyle(e);
    return { clip:c.clipPath, radius:c.borderTopLeftRadius };
  });
  check('3: die gewollten Kreis-Ausnahmen sind rund geblieben',
    kreisAusnahmen && kreisAusnahmen.clip === 'none' && (kreisAusnahmen.radius||'').includes('%'), kreisAusnahmen);

  check('keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
  console.log('\n' + (fail ? 'FAIL' : 'PASS'));
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
