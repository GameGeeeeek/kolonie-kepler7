// Kampf-Wiedergabe als Hochkant-Video (04.08.2026, Spieler-Wunsch Sascha:
// „Kampfbericht exportierbar machen damit man sie auf TikTok posten kann").
//
// Ein Standbild reicht dafuer nicht - was die Wiedergabe sehenswert macht, ist die Bewegung.
// Aufgenommen wird deshalb eine eigene 1080x1920-Flaeche, in die das laufende Gefecht
// gestempelt wird, mit Namen, Kraefteverhaeltnis, Ausgang und Bilanz drumherum.
//
// GEMESSEN WIRD DIE FERTIGE DATEI, nicht der Quelltext: Der Test laedt den erzeugten Clip in
// ein <video>-Element und liest videoWidth/videoHeight aus. Eine Pruefung auf "1080" im Code
// waere wertlos - genau die Zeile kann stimmen, waehrend der Recorder etwas anderes liefert.
//
// Zweiter Punkt, und der ist der unangenehmere: Der Knopf darf NICHT dastehen, wo der Browser
// keine Aufnahme kann. Ein Knopf, der nichts tut, ist schlechter als kein Knopf - und ob
// MediaRecorder/captureStream vorhanden sind, entscheidet sich erst im Browser. Der Test
// nimmt beides ausdruecklich weg und prueft, dass der Knopf dann verschwindet.
const { starteBrowser, devices, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

const FLOTTE = { jaeger:152, destroyers:2418, schlachtschiff:7234, frachtergross:3324,
  waechter:10089, recycler:283, kreuzer:96 };
const ABWEHR = { flak:55, turm:50, laser:45, raketen:33, gauss:29, schild:25, plasma:21 };
const UEBERFALL = { id:'r1', time:Date.now(), ts:Date.now(), type:'raid', result:'win',
  faction:'Söldnerkonvoi', attackPower:41200, defensePower:23400, targetPlanet:'home',
  fleet:{ destroyers:179 }, destroyedShips:{ destroyers:31 },
  stationedFleet: FLOTTE, ownLostShips:{}, defenseBefore: ABWEHR };

function backend(store, berichte){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p==='reports')return j({reports:berichte});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT')return j({ok:true,version:2});if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  return j([]);
};}
const save = () => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:9e4,forschungspunkte:3e4},
  buildings:Object.assign({solar:22,mine:20,labor:14,lager:30,werft:14}, ABWEHR),
  research:{rkampf:9}, fleet:Object.assign({missions:[]}, FLOTTE), colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null}, battleStats:{wins:99,losses:2}, xp:9e5, credits:5e5,
  buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

async function wiedergabeOeffnen(browser, vorbereiten){
  const ctx = await browser.newContext(Object.assign({}, devices['iPhone 13']));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': save() }, [UEBERFALL]));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  if (vorbereiten) await page.addInitScript(vorbereiten);
  await page.goto(SPIEL_URL); await page.waitForTimeout(3600);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}));
  await page.evaluate(() => { const x=document.getElementById('headerReportsBtn'); if(x)x.click(); });
  await page.waitForTimeout(1600);
  await page.evaluate(() => { const x=document.querySelector('[data-watch-battle]'); if(x)x.click(); });
  await page.waitForTimeout(2000);
  return { page, errs, ctx };
}

(async () => {
  const browser = await starteBrowser();

  // ============================== 1) Der Knopf steht da und stoert die Reihe nicht
  {
    const { page, errs, ctx } = await wiedergabeOeffnen(browser);
    const m = await page.evaluate(() => {
      const b = document.getElementById('osBtnVideo');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      const reihe = document.querySelector('#osWrap .knoepfe').getBoundingClientRect();
      const w = document.getElementById('osWrap');
      return { sichtbar: getComputedStyle(b).display !== 'none',
               unten: Math.round(reihe.bottom), fenster: window.innerHeight,
               breite: Math.round(r.width), ueberlauf: w.scrollHeight - w.clientHeight,
               buehne: Math.round(document.getElementById('osBuehne').getBoundingClientRect().height) };
    });
    check('1: der Video-Knopf ist da', !!m && m.sichtbar, m);
    // Fuenf Knoepfe statt vier duerfen die Buehne nicht auffressen und nichts hinausdruecken.
    check('1: die Knopfreihe bleibt vollständig im Bild', m && m.unten <= m.fenster, m);
    check('1: nichts läuft dabei über den Rand', m && m.ueberlauf <= 0, { ueberlauf: m && m.ueberlauf });
    check('1: und die Bühne bleibt brauchbar groß (>= 25%)',
      m && m.buehne >= m.fenster*0.25, { buehne: m && m.buehne, fenster: m && m.fenster });
    check('keine JS-Fehler (Knopf)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 2) Ohne Aufnahmefähigkeit verschwindet er
  // Der Browser entscheidet das, nicht der Quelltext - also wird ihm die Fähigkeit
  // ausdrücklich weggenommen.
  {
    const { page, errs, ctx } = await wiedergabeOeffnen(browser, () => {
      try { delete window.MediaRecorder; } catch(e){ window.MediaRecorder = undefined; }
      try { delete HTMLCanvasElement.prototype.captureStream; } catch(e){}
    });
    const sichtbar = await page.evaluate(() => {
      const b = document.getElementById('osBtnVideo');
      return !!b && getComputedStyle(b).display !== 'none';
    });
    check('2: ohne MediaRecorder ist der Knopf ausgeblendet', sichtbar === false);
    check('keine JS-Fehler (ohne MediaRecorder)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ============================== 3) Die Datei selbst: hochkant, echt, nicht leer
  {
    const { page, errs, ctx } = await wiedergabeOeffnen(browser);
    // Statt den Download abzufangen wird der Blob direkt eingesammelt: shareCardBlobFlow
    // legt ihn per createObjectURL an, und genau diesen Aufruf hoert der Test mit.
    await page.evaluate(() => {
      window.__clip = null;
      const orig = URL.createObjectURL.bind(URL);
      URL.createObjectURL = function(b){ if (b && /^video\//.test(b.type||'')) window.__clip = b; return orig(b); };
      // Den Download-Klick ins Leere laufen lassen - die Datei ist schon eingesammelt.
      const ao = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function(){ if (this.download) return; return ao.call(this); };
    });
    await page.click('#osBtnVideo');
    // Der Clip laeuft mit doppeltem Tempo, rund 25 Sekunden - grosszuegig warten.
    let da = false;
    for (let i = 0; i < 120; i++){
      da = await page.evaluate(() => !!window.__clip);
      if (da) break;
      await page.waitForTimeout(1000);
    }
    check('3: es ist wirklich eine Videodatei entstanden', da);
    if (da){
      const m = await page.evaluate(async () => {
        const b = window.__clip;
        const url = URL.createObjectURL(b);
        const v = document.createElement('video');
        v.muted = true; v.src = url;
        const masse = await new Promise(res => {
          v.onloadedmetadata = () => res({ w: v.videoWidth, h: v.videoHeight, dauer: v.duration });
          v.onerror = () => res(null);
          setTimeout(() => res(null), 8000);
        });
        return { typ: b.type, bytes: b.size, masse };
      });
      check('3: der Behälter ist ein Videoformat', /^video\//.test(m.typ||''), { typ: m.typ });
      check('3: und nicht leer', m.bytes > 200*1024, { kB: Math.round(m.bytes/1024) });
      // DER Punkt der ganzen Uebung: 9:16 statt der Buehnenform des Geraets.
      check('3: das Bild ist hochkant im 9:16-Format (1080x1920)',
        m.masse && m.masse.w === 1080 && m.masse.h === 1920, m.masse);
      // Ein Clip von zwei Sekunden waere ein abgebrochener Durchlauf, kein Gefecht.
      check('3: er zeigt einen ganzen Durchlauf (>= 15 s)',
        m.masse && m.masse.dauer >= 15, { dauer: m.masse && Math.round(m.masse.dauer) });
      // Und kurz genug fuer eine Kurzvideo-Plattform.
      check('3: bleibt aber kurz genug für TikTok & Co. (<= 45 s)',
        m.masse && m.masse.dauer <= 45, { dauer: m.masse && Math.round(m.masse.dauer) });
    }
    // Nach der Aufnahme muss der Knopf wieder benutzbar sein und seine Beschriftung zurückhaben.
    const knopf = await page.evaluate(() => {
      const b = document.getElementById('osBtnVideo');
      return { aus: b.disabled, text: b.textContent.trim() };
    });
    check('3: der Knopf ist danach wieder benutzbar', knopf.aus === false && !/Aufnahme/.test(knopf.text), knopf);
    check('keine JS-Fehler (Aufnahme)', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
