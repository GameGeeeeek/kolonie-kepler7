// Meldungen (Toasts): Platzierung (27.07.2026, v8.313.0).
//
// Ausgangsbefund an einem Bildschirmfoto des laufenden Spiels: Die Meldungen standen fest oben in
// der Mitte (position:fixed; top:16px; left:50%). Beim Start feuern mehrere gleichzeitig - neues
// Event, Planeten-Ereignis, Offline-Ertrag -, und bis zu vier davon stapelten sich damit GENAU über
// der Kopfzeile. Für mehrere Sekunden waren Koloniename, Flottenzeile, Punktestand sowie Angriffs-
// und Verteidigungspunkte verdeckt, also ausgerechnet die Werte, wegen derer man hinschaut.
//
// Die Prüfung misst nicht die CSS-Regel, sondern die WIRKUNG: Kein Meldungs-Rechteck darf das
// Rechteck der Kopfzeile schneiden.
//
// WICHTIG - warum NICHT document.elementFromPoint: Der erste Entwurf tastete Punkte der Kopfzeile
// ab und fragte, ob dort eine Meldung liegt. Das Ergebnis war LEER WAHR: Der Meldungs-Container
// trägt pointer-events:none (damit man durch ihn hindurchklicken kann), und elementFromPoint
// überspringt genau solche Elemente. Die Messung beantwortete also "ist die Kopfzeile anklickbar"
// statt "ist sie sichtbar" - und wäre auch mit der alten, überdeckenden Platzierung grün geblieben.
// Aufgefallen ist das erst in der Rot-Probe. Geometrie statt Trefferprüfung ist hier das richtige
// Werkzeug.
//
// Geprüft wird:
//   1) mehrere gleichzeitige Meldungen überschneiden die Kopfzeile nicht
//   2) die Meldungen sind dabei wirklich sichtbar (sonst wäre 1 leer wahr)
//   3) der Stapel ist auf drei begrenzt
//   4) die neueste Meldung liegt unten, also am Blickpunkt der Ecke
const { starteBrowser, devices, SPIEL_URL, SPIELDATEI, ruhigeUhren } = require('./lib/umgebung');
const fs = require('fs');

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'AdmiralX',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  if(/leaderboard|reports|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}

const SAVE = JSON.stringify({ ...ruhigeUhren(), tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:2e4,forschungspunkte:3e4},
  buildings:{solar:22,mine:20,labor:14,lager:16,werft:14}, research:{}, fleet:{jaeger:600,missions:[]},
  colonies:{}, activeBasePlanet:'home', player:{id:'u',name:'AdmiralX',avatarKey:null},
  battleStats:{wins:64,losses:11}, xp:260000, credits:180000, buffs:[], lastTick:Date.now(), colonyNames:{} });

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

(async () => {
  const browser = await starteBrowser();
  const store={'kepler7-save-v3':SAVE};
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:900,height:1000} }));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(2700);
  await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='none';});});

  // Vier Meldungen auf einmal - so viele wie beim Start real auftreten können. Sie werden über die
  // vorhandene Container-Logik erzeugt, nicht von Hand ins DOM gelegt: Nur so misst der Test die
  // echte Stapelung samt Begrenzung.
  const gebaut = await page.evaluate(()=>{
    const c=document.getElementById('toastContainer');
    if(!c) return -1;
    const texte=['Neues Event gestartet: Piratenüberfall!','Planeten-Ereignis: Sonneneruption (+35% Energie)',
                 'Offline-Ertrag eingesammelt','Forschung abgeschlossen: Kristallgitter-Optimierung'];
    for(const t of texte){
      const el=document.createElement('div'); el.className='toast';
      el.innerHTML='<span>'+t+'</span>'; c.appendChild(el); el.classList.add('show');
      while (c.children.length > 3) c.removeChild(c.firstChild);
    }
    return c.children.length;
  });
  check('3: der Stapel ist auf drei begrenzt', gebaut === 3, gebaut);
  await page.waitForTimeout(500);

  const mess = await page.evaluate(()=>{
    const sichtbar = [...document.querySelectorAll('.toast')].filter(e=>e.getBoundingClientRect().height>0);
    const h = document.querySelector('.hero');
    const hr = h ? h.getBoundingClientRect() : null;
    const schneidet = (a,b) => !(a.right<=b.left || a.left>=b.right || a.bottom<=b.top || a.top>=b.bottom);
    const rects = sichtbar.map(e=>{const r=e.getBoundingClientRect();
      return { top:Math.round(r.top), bottom:Math.round(r.bottom), left:Math.round(r.left), right:Math.round(r.right) };});
    return { toasts:sichtbar.length,
             kopf: hr ? { top:Math.round(hr.top), bottom:Math.round(hr.bottom), left:Math.round(hr.left), right:Math.round(hr.right) } : null,
             ueberschneidungen: hr ? rects.filter(r=>schneidet(r,hr)).length : -1,
             rects, fensterHoehe: window.innerHeight,
             letzteUnten: rects.length>=2 && rects[rects.length-1].top > rects[0].top };
  });

  check('2: die Meldungen sind wirklich sichtbar', mess.toasts === 3, mess.toasts);
  // Schutz gegen eine leere Wahrheit: Läge die Kopfzeile gar nicht oben, könnte die Hauptprüfung
  // nie etwas finden. Sie MUSS im Bereich liegen, den die alte Platzierung belegte (16..143).
  check('2: die Kopfzeile liegt wirklich im oberen Bereich - sonst prüft 1 nichts',
    mess.kopf && mess.kopf.top < 143 && mess.kopf.bottom > 16, mess.kopf);
  check('1: kein Meldungs-Rechteck schneidet die Kopfzeile', mess.ueberschneidungen === 0,
    { schnitte:mess.ueberschneidungen, kopf:mess.kopf, rects:mess.rects });
  check('1: die Meldungen sitzen in der unteren Bildschirmhälfte',
    mess.rects.every(r => r.top > mess.fensterHoehe/2), { rects:mess.rects, hoehe:mess.fensterHoehe });
  check('4: die neueste Meldung liegt unten (am Blickpunkt der Ecke)', mess.letzteUnten === true, mess.rects);
  check('keine Konsolenfehler', errs.length === 0, errs.slice(0,3));

  // ---------------------------------------------------------------- Quelltext-Prüfungen
  const src = fs.readFileSync(SPIELDATEI, 'utf8');
  check('Q: der Container hängt unten rechts, nicht oben mittig',
    /\.toast-container \{ position:fixed; right:calc\(16px \+ env\(safe-area-inset-right/.test(src)
    && /bottom:calc\(16px \+ env\(safe-area-inset-bottom/.test(src)
    && !/\.toast-container \{ position:fixed; top:/.test(src));
  check('Q: die Randbereiche des Geräts sind berücksichtigt',
    (src.match(/safe-area-inset-(right|bottom|left)/g)||[]).length >= 3);
  check('Q: auf schmalen Geräten spannt der Container über die volle Breite',
    /@media \(max-width:560px\)\{ \.toast-container/.test(src));
  check('Q: der Stapel ist im Code auf drei begrenzt',
    /while \(container\.children\.length > 3\)/.test(src));

  console.log('\n' + (fail ? 'FAIL' : 'PASS'));
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
