// Eine Forschung, die teurer ist als das Lager, blockiert die Warteschlange nicht mehr (05.08.2026).
//
// GEFUNDEN bei der Untersuchung des Spieler-Reports "nach dem Update wird die Forschung nicht
// wieder gestartet". Der Report selbst hat sehr wahrscheinlich eine andere Ursache - die Suche legte
// aber eine echte, dauerhafte Sackgasse frei:
//
// Die vier Ewigkeitsforschungen (rewig_prod/-bau/-def/-lager) haben maxLevel 999 und Kosten x1,32
// bis x1,38 JE STUFE. Das Lager hat einen HARTEN Deckel (SOFT_CAP_OVERFLOW_RATE = 0). Sobald der
// Kopf der Warteschlange bei irgendeiner Grundressource mehr kostet, als das Lager fassen kann, ist
// er NIE WIEDER bezahlbar - und weil nur researchQueue[0] betrachtet wurde, stand ab da die GANZE
// Schlange still. Dauerhaft, ohne jede Erklärung.
//
// Nachgerechnet mit der echten Kostenformel base * costMult^(stufe-1):
//     Lagerdeckel   1 Mio. -> Wand ab Stufe 16-18
//     Lagerdeckel  20 Mio. -> Wand ab Stufe 25-29
// Die Kosten wachsen exponentiell, der Lagerbonus der Ewigkeitsforschung nur logarithmisch - die
// Wand ist unausweichlich, es ist nur eine Frage, wann.
//
// WAS DIESER TEST PRÜFT - die Unterscheidung, auf die alles ankommt:
//   1. DAUERHAFT unmöglich (Kosten > Lagerdeckel) -> wird übersprungen, die Schlange läuft weiter,
//      und der Eintrag bleibt erhalten (das Lager kann ja wachsen).
//   2. GEGENPROBE: NUR VORÜBERGEHEND zu arm (Kosten > Bestand, aber <= Deckel) -> blockiert
//      weiterhin. Ohne diesen Punkt hätte ich die Warteschlangen-Reihenfolge stillschweigend
//      abgeschafft: Wer eine teure Forschung nach vorne zieht, WILL auf sie warten.
//   3. Die Anzeige sagt, warum - im Warteschlangen-Eintrag UND auf der Forschungskarte.
const fs = require('fs');
/* SPIELDATEI kommt aus lib/umgebung und nicht aus einem eigenen path.join (19.08.2026). Vorher
   stand der Pfad hier fest - eine Gegenprobe mit KEPLER_SPIELDATEI las dann die ECHTE Datei und
   war aus dem falschen Grund gruen, also genau die Falle aus der Korrektur zu CLAUDE.md-Regel 14.
   Dasselbe gilt fuer weitere Tests im Repo; dieser ist der zweite behobene. */
const { starteBrowser, SPIEL_URL, SPIELDATEI, warteBis } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// ---- Teil 1: die Wand ist rechnerisch real (ohne Browser, Sekunden)
{
  const src = fs.readFileSync(SPIELDATEI, 'utf8');
  const js = src.match(/<script>([\s\S]*)<\/script>/)[1];
  check('forschungUeberLager() existiert', /function forschungUeberLager\(/.test(js));
  // Der harte Deckel ist die Voraussetzung dafür, dass die Wand überhaupt dauerhaft ist. Wäre er
  // weich (Überlauf > 0), wüchse der Bestand weiter und der Test hier wäre gegenstandslos.
  const soft = js.match(/const SOFT_CAP_OVERFLOW_RATE\s*=\s*([\d.]+)/);
  check('1: der Lagerdeckel ist hart (Überlaufrate 0)', !!soft && parseFloat(soft[1]) === 0,
    { wert: soft ? soft[1] : '(nicht gefunden)' });
  // Und die Ewigkeitsforschungen wachsen wirklich exponentiell über jede Lagergröße hinaus.
  const ewig = [...js.matchAll(/key:'(rewig_[a-z]+)'[^\n]*?costMult:\s*([\d.]+)/g)].map(m => ({ key:m[1], mult:parseFloat(m[2]) }));
  check('1: vier Ewigkeitsforschungen mit Kostenfaktor > 1 gefunden',
    ewig.length === 4 && ewig.every(e => e.mult > 1), ewig);
  check('1: sie haben keine Maximalstufe, die die Wand verhindern würde',
    (js.match(/maxLevel:999, endless:true/g) || []).length >= 4);
}

// ---- Teil 2: das Verhalten im echten Spiel
// 'rewig_lager' auf einer Stufe, deren Kosten weit über jedem erreichbaren Lager liegen. Damit die
// Forschung überhaupt eingereiht sein DARF, muss ihre Voraussetzung (rsingularitaet) erfüllt sein.
const HOHE_STUFE = 40;   // 9000 * 1.38^39 ist astronomisch - garantiert über jedem Lager

function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:false,tier:null}});
  if(p==='reports')return j({reports:[]});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p==='storage-list')return j({keys:[]});
  if(p.startsWith('storage/')){
    const k=decodeURIComponent(p.slice(8));
    if(req.method()==='PUT'){ try { store[k] = JSON.parse(req.postData()).value; } catch(e){} return j({ok:true,version:2}); }
    if(store[k]!==undefined)return j({key:k,value:store[k],version:1});
    return j({e:1},404);
  }
  return j([]);
};}

// vorrat: wie viel Erz/Kristalle im Lager liegen. lager: Stufe des Lagergebäudes (setzt den Deckel).
const save = (queue, forschung, vorrat, lagerStufe, produziert) => JSON.stringify({
  tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{ energie:vorrat, erz:vorrat, kristalle:vorrat, deuterium:vorrat, antimaterie:vorrat, forschungspunkte:vorrat },
  // produziert=false schaltet die Produktionsgebaeude ab - nur so bleibt ein Vorrat von 0 auch
  // ueber die Testdauer bei 0. Mit laufenden Minen war 'rsolar' nach wenigen Sekunden bezahlbar,
  // und die Gegenprobe hat den blockierten Zustand nie zu Gesicht bekommen.
  buildings:{ solar: produziert===false?0:30, mine: produziert===false?0:28, labor:30, lager:lagerStufe, werft:20 },
  research: forschung, activeResearch:null, researchQueue: queue,
  fleet:{missions:[]}, colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null}, xp:9e6, credits:9e6,
  buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

async function lauf(browser, queue, forschung, vorrat, lagerStufe, produziert, bedingung){
  const store = { 'kepler7-save-v3': save(queue, forschung, vorrat, lagerStufe, produziert) };
  const ctx = await browser.newContext({ viewport:{width:1400,height:1000} });
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  await page.route('**/api/**', backend(store));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4000);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(i=>{const o=document.getElementById(i); if(o)o.style.display='none';}));
  // Ein paar Ticks laufen lassen, damit tryStartQueuedResearch mehrfach zum Zuge kommt.
  await page.waitForTimeout(4000);
  await page.evaluate(() => { const b=[...document.querySelectorAll('[data-tab]')].find(x=>x.getAttribute('data-tab')==='forschung'); if(b)b.click(); });
  await page.waitForTimeout(1500);
  const d = await page.evaluate(() => {
    const box = document.getElementById('researchQueueBox');
    return { warteschlangeText: box ? (box.textContent||'').replace(/\s+/g,' ').trim() : null };
  });
  // Der gespeicherte Stand ist die Wahrheit über activeResearch/researchQueue - das state-Objekt
  // selbst liegt nicht auf window.
  const lies = () => { try { return JSON.parse(store['kepler7-save-v3']); } catch(e){ return null; } };
  /* Wo der Aufrufer sagt, WORAUF er wartet, wird darauf gewartet statt auf die 1500 ms oben.
     Gemessen unter echter Last: Ohne das erwischt der Test den Stand mitten in der Bewegung -
     `rsolar` schon aus der Warteschlange genommen, `activeResearch` noch nicht gesetzt.

     DIE FRIST IST NICHT GERATEN: Das Spiel speichert per `setInterval(save, 10000)`, also alle
     10 s. Die festen Wartezeiten oben summieren sich auf 9500 ms und liegen damit KNAPP VOR dem
     ersten Autosave - genau die Kante. 15 s decken ein volles Speicherintervall samt Anlauf ab.
     Ein erster Versuch mit 8 s war kuerzer als das Intervall selbst und fiel unter Last erneut;
     gekostet wird die Frist ohnehin nur, wenn die Bedingung ausbleibt - sonst kehrt warteBis
     sofort zurueck.

     Die Gegenprobe unten gibt bewusst KEINE Bedingung mit: Sie behauptet, dass NICHTS startet, und
     darauf kann man nicht warten - dort bleibt die feste Wartezeit die ehrlichere Messung. */
  let stand = bedingung ? await warteBis(() => { const t = lies(); return bedingung(t) ? t : null; }, 15000) : null;
  if (!stand) stand = lies();
  await ctx.close();
  return { d, stand, errs };
}

(async () => {
  const browser = await starteBrowser();
  // rsingularitaet freischalten, damit die Ewigkeitsforschung überhaupt einreihbar ist.
  // rsingularitaet ist die Voraussetzung der Ewigkeitsforschungen. 'rsolar' steht bewusst NICHT
  // darin - Stufe 0, keine Voraussetzungen, 50 Erz: garantiert startbar.
  // ERST falsch gebaut: Ich hatte 'rlager' auf Stufe 1 als zweiten Eintrag genommen - der wurde
  // korrekt als "schon auf Maximalstufe" verworfen, und der Test mass dadurch nichts.
  const basis = { rsingularitaet:1, rewig_lager: HOHE_STUFE-1 };

  // --- 1) Die Sackgasse steht VORNE, dahinter eine billige, bezahlbare Forschung.
  {
    const { d, stand, errs } = await lauf(browser, ['rewig_lager','rsolar'], basis, 5e5, 30, undefined, st => st && st.activeResearch);
    check('2: keine JS-Fehler', errs.length === 0, errs.slice(0,2));
    const laeuft = stand && stand.activeResearch;
    check('2: die dahinter stehende Forschung ist gestartet, statt blockiert zu werden',
      !!laeuft && laeuft.key === 'rsolar',
      { activeResearch: laeuft, warteschlange: stand && stand.researchQueue });
    // Der unbezahlbare Eintrag darf NICHT verloren gehen - das Lager kann ja wachsen.
    check('2: der übersprungene Eintrag bleibt in der Warteschlange erhalten',
      !!stand && (stand.researchQueue||[]).indexOf('rewig_lager') >= 0, stand && stand.researchQueue);
    // Und die Anzeige erklärt es.
    check('3: die Warteschlange erklärt, warum der Eintrag nicht startet',
      !!d.warteschlangeText && /Lager/i.test(d.warteschlangeText) && /fasst|Lagerkapazität/i.test(d.warteschlangeText),
      d.warteschlangeText ? d.warteschlangeText.slice(0,220) : null);
  }

  // --- 2) GEGENPROBE: nur vorübergehend zu arm. Muss WEITERHIN blockieren.
  // Ohne diese Prüfung hätte ich die Bedeutung der Warteschlangen-Reihenfolge abgeschafft.
  {
    // Dieselbe Forschung wie oben, nur auf STUFE 1: kostet 9.000 Kristalle - mehr als der leere
    // Vorrat, aber deutlich UNTER dem Lagerdeckel. Damit ist sie voruebergehend unbezahlbar und
    // nicht dauerhaft unmoeglich - genau die Unterscheidung, um die es geht.
    // Zwei Anlaeufe waren noetig: Mit 'rsolar' (50 Erz) war die Forschung trotz abgeschalteter
    // Minen binnen Sekunden bezahlbar - es gibt eine Grundproduktion. Der blockierte Zustand war
    // deshalb nie messbar, und die Gegenprobe lief ins Leere.
    const { stand } = await lauf(browser, ['rewig_lager','rerz'], { rsingularitaet:1 }, 0, 30, false);
    const laeuft = stand && stand.activeResearch;
    check('2: Gegenprobe – bloße Armut haelt die Warteschlange weiterhin an',
      !laeuft, { activeResearch: laeuft, hinweis:'nichts haette starten duerfen - weder rewig_lager noch rerz' });
    check('2: Gegenprobe – und KEIN Eintrag wurde vorgezogen',
      !!stand && (stand.researchQueue||[]).join(',') === 'rewig_lager,rerz',
      { warteschlange: stand && stand.researchQueue });
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
