// Bergungsgut - der zweite Abgrund-Werkstoff (28.07.2026, v8.333.0, Roadmap Phase 1).
//
// Splitter bezahlen die Werkstatt, Bergungsgut bezahlt die kommende Tiefenflotte und die
// Abgrund-Module. Zwei Toepfe, damit sich beides unabhaengig ausbalancieren laesst - liefen sie
// ueber dieselbe Zahl, wuerde jeder Schiffsbau die Werkstatt zurueckwerfen und umgekehrt.
//
// Dieser Test faehrt zweigleisig, weil die beiden Fehlerklassen verschieden sind:
//
//   A) Die FORMEL wird in Node ausgefuehrt (schnell, deterministisch, exakte Zahlen).
//   B) Die ANZEIGE wird im Browser an einem ECHTEN Tauchgang geprueft. Das ist hier der teure,
//      aber noetige Teil: Bergungsgut hat vier Anzeigestellen (Ueberschrift, Vorschau, Log,
//      Kampfbericht), und der wiederkehrende Fehler dieses Projekts ist nicht die kaputte Mechanik,
//      sondern die zweite Anzeigestelle, die stumm bleibt (CLAUDE.md Regel 6). Genau das war beim
//      Bericht schon der Fall: abgrundSplitter und abgrundMutatoren wurden seit jeher hineingeschrieben
//      und nie gelesen. Ein Quelltext-Test haette das nicht gemerkt - der Bericht sah vollstaendig aus.
const fs = require('fs');
const path = require('path');
const { starteBrowser, devices, SPIEL_URL } = require('./lib/umgebung');
const SPIELDATEI = path.join(__dirname, '..', 'weltraum_kolonie.html');
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

let fail=false;
const check=(n,c,x)=>{ console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail=fail||!c; };

function fnAus(n){
  const m = js.match(new RegExp('function\\s+'+n+'\\s*\\('));
  if (!m) throw new Error('Funktion nicht gefunden: '+n);
  const i = js.indexOf(m[0]);
  let d=0, s=js.indexOf('{', i+m[0].length), k=s;
  for (; k<js.length; k++){ if(js[k]==='{')d++; else if(js[k]==='}'){d--; if(!d)break;} }
  return js.slice(i, k+1);
}

// ---- A) Die Fundformel, ausgefuehrt ----
const G = new Function(`
  const ABGRUND_WAECHTER_BERGUNG = ${(js.match(/const ABGRUND_WAECHTER_BERGUNG = (\d+)/)||[])[1]};
  ${fnAus('abgrundBergungsgut')}
  return { abgrundBergungsgut, ABGRUND_WAECHTER_BERGUNG };
`)();
const B = G.abgrundBergungsgut;

const tiefen = [1,2,5,10,25,50,100,250,500,1000];
check('A: der Ertrag steigt mit der Tiefe streng monoton',
  tiefen.every((t,i) => i===0 || B(t,false) > B(tiefen[i-1],false)),
  tiefen.map(t=>t+':'+B(t,false)));
// Die Roadmap nennt "rund 5-40 je Tauchgang" als Zielgroesse. Wird die Formel spaeter angefasst,
// soll auffallen, wenn sie diesen Rahmen verlaesst - sonst verschiebt sich die gesamte Preisliste
// der Tiefenflotte still mit.
check('A: Tiefe 1 liefert eine kleine, aber brauchbare Menge (3-8)', B(1,false) >= 3 && B(1,false) <= 8, { t1:B(1,false) });
check('A: Tiefe 100 liefert rund 40 (30-55)', B(100,false) >= 30 && B(100,false) <= 55, { t100:B(100,false) });
check('A: nie weniger als 1 - auch bei unsinniger Eingabe',
  B(0,false) >= 1 && B(undefined,false) >= 1 && B(-5,false) >= 1,
  { null0:B(0,false), undef:B(undefined,false), negativ:B(-5,false) });

// Der Waechter-Faktor ist der EINZIGE Grund, eine bereits geknackte Zehnertiefe erneut zu tauchen:
// Der Wiederholungsabschlag drueckt den Ertrag, das Waechter-Vielfache hebt ihn darueber.
check('A: ein Waechter gibt ein echtes Vielfaches, kein Trostpflaster',
  tiefen.every(t => B(t,true) >= B(t,false)*3), tiefen.map(t=>t+':'+(B(t,true)/B(t,false)).toFixed(2)));
const WIED = Number((js.match(/const ABGRUND_WIEDERHOLUNG = ([\d.]+)/)||[])[1]);
check('A: die Wiederholung eines Waechters lohnt trotz Abschlag mehr als ein frischer Sektor gleicher Tiefe',
  Math.round(B(50,true)*WIED) > B(50,false),
  { waechterWiederholt: Math.round(B(50,true)*WIED), frisch: B(50,false), abschlag: WIED });

// Bergungsgut ist knapper als Splitter. Das ist Absicht und der Grund, warum die Preise der
// Tiefenflotte spaeter ueberhaupt greifen: Was DRAUSSEN wirkt, muss teurer sein als was nur im
// Abgrund wirkt.
const splitterBei = t => Math.max(1, Math.round(3 + t*0.8));
check('A: Bergungsgut faellt ab Tiefe 5 durchweg knapper als Splitter',
  tiefen.filter(t=>t>=5).every(t => B(t,false) < splitterBei(t)),
  tiefen.filter(t=>t>=5).map(t=>t+': B'+B(t,false)+' vs S'+splitterBei(t)));

// CLAUDE.md-Fallstrick: "N Minuten eigene Produktion" als Belohnungsformel waechst mit dem Konto
// statt mit der Leistung. Hier gemessen statt behauptet: Die Funktion darf ueberhaupt nichts aus
// dem Spielstand lesen - sonst haenge der Ertrag an der Wirtschaft.
const formelQuelle = fnAus('abgrundBergungsgut');
check('A: die Formel liest nichts aus dem Spielstand (kein state, keine Produktionsrate)',
  !/\bstate\b|ratesPerSecond|production|storageCap/.test(formelQuelle), formelQuelle.trim());
check('A: gleiche Eingabe, gleiches Ergebnis (kein Zufall in der Formel)',
  new Set(Array.from({length:50}, ()=>B(37,false))).size === 1);

// Backend: SAVE_SANITY_LIMITS lehnt den GESAMTEN Spielstand mit HTTP 400 ab, sobald EIN Zahlenfeld
// die Grenze reisst (CLAUDE.md, Vorfall 21.07.2026). Bergungsgut ist ein NEUES speicherbares
// Zahlenfeld - der Abgleich gehoert in dieselbe Runde, nicht danach.
const absurd = 50*365*100*B(10000,true);   // 50 Waechter-Tauchgaenge taeglich, Tiefe 10.000, 100 Jahre
check('A: selbst absurdes Dauerspiel bleibt weit unter dem Ressourcen-Limit von 1e15',
  absurd < 1e13, { hoechstwert: absurd.toExponential(2) });

// ---- Der zweite Topf muss ein zweiter Topf bleiben ----
const vergabe = js.slice(js.indexOf('const bergungsgut = Math.max('), js.indexOf('const bergungsgut = Math.max(')+320);
check('A: Bergungsgut bekommt bewusst KEINEN Werkstatt-/Reliquienbonus (sonst waere die Kopplung zurueck)',
  !/abgrundKanalBonus/.test(vergabe), vergabe.split('\n')[0]);
check('A: der Wiederholungsabschlag gilt dagegen sehr wohl (sonst waere Tiefe 10 eine Dauerquelle)',
  /wiederholung/.test(vergabe));
check('A: Bergungsgut und Splitter liegen in getrennten Feldern',
  /a\.bergung = \(a\.bergung\|\|0\) \+ bergungsgut/.test(js) && /a\.splitter = \(a\.splitter\|\|0\) \+ splitter/.test(js));

// Es gibt ZWEI Sektor-Bauplaetze: abgrundSektor() baut ihn, abgrundSektorMitBann() ueberschreibt
// die vom Bann betroffenen Felder per Object.assign. Beim Einbau landete der Wert zuerst nur im
// zweiten - die Vorschau zeigte "+NaN Bergungsgut" und der Tauchgang schrieb NaN in den Spielstand
// (was das Backend als Save-Verstoss ablehnen wuerde, siehe CLAUDE.md). Der Basiswert gehoert in
// den Basisbauplatz, und zwar genau EINMAL.
check('A: der Basissektor traegt das Bergungsgut',
  /return \{ tiefe:t,[^\n]*bergung:/.test(fnAus('abgrundSektor')));
check('A: es gibt nur EINE Stelle, die die Fundformel aufruft (keine zweite Wahrheit)',
  (js.match(/abgrundBergungsgut\(/g)||[]).length === 2,   // 1x Definition, 1x Aufruf
  { vorkommen: (js.match(/abgrundBergungsgut\(/g)||[]).length });

// Symbol: CLAUDE.md Regel 7 - jeder neue Inhalt braucht ein EIGENES gezeichnetes Icon, kein
// ti-*-Notnagel. Geprueft wird, dass wirklich gezeichnet wurde und nicht nur ein leeres <svg> steht.
const sym = new Function(fnAus('bergungsgutSymbol')+'; return bergungsgutSymbol;')()(20);
check('B0: Bergungsgut hat ein eigenes gezeichnetes Symbol mit echtem Pfadinhalt',
  /^<svg/.test(sym) && (sym.match(/<path/g)||[]).length >= 3 && sym.length > 300,
  { pfade:(sym.match(/<path/g)||[]).length, laenge:sym.length });
check('B0: das Symbol nimmt die Farbe seiner Umgebung an (currentColor, nicht fest eingefaerbt)',
  /currentColor/.test(sym) && !/#[0-9a-f]{6}/i.test(sym));

// ---- B) Die vier Anzeigestellen im echten Browser ----
function backend(store){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT'){try{store[k]=JSON.parse(req.postData()||'{}').value;}catch(e){}return j({ok:true});}if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  // Berichte liegen NICHT im Spielstand, sondern beim Server: pushReport() schickt sie per POST,
  // die Anzeige holt sie per GET zurueck. Ein Mock, der auf beides eine leere Liste antwortet,
  // laesst die Berichte-Box leer - dann prueft man nichts. Hier werden sie deshalb wirklich
  // gehalten, damit der gerenderte Bericht der ist, den der Tauchgang erzeugt hat.
  if(p==='reports'){
    if(req.method()==='POST'){
      try { const r = JSON.parse(req.postData()||'{}').report || {};
            store.__berichte.unshift(Object.assign({ id:'r'+(++store.__nr), time:Date.now() }, r)); } catch(e){}
      return j({ok:true});
    }
    return j({ reports: store.__berichte });
  }
  if(/leaderboard|messages|ranking|wars|halloffame|bounty|friends|pending/.test(p))return j(p.includes('pending')?{reward:null}:[]);
  return j({});
};}

// Grosse Flotte inkl. Frachter: Tiefe 1 muss sicher gewonnen werden, sonst misst der Abschnitt bei
// jedem Lauf etwas anderes.
const stand = zusatz => JSON.stringify(Object.assign({
  tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:2e4,forschungspunkte:3e4},
  buildings:{solar:20,mine:18,lager:20,werft:12,labor:12},
  research:{ rsingularitaet:1 }, colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null},
  fleet:{ jaeger:4000, schlachtschiff:400, frachter:200, missions:[] },
  battleStats:{wins:9,losses:2}, xp:20000, credits:50000, buffs:[], lastTick:Date.now(), colonyNames:{}
}, zusatz));
const gespeichert = store => { try { return JSON.parse(store['kepler7-save-v3']||'{}'); } catch(e){ return {}; } };

async function starte(browser, roh){
  const store={'kepler7-save-v3':roh, __berichte:[], __nr:0};
  const ctx = await browser.newContext(Object.assign({}, devices['Desktop Chrome'], { viewport:{width:900,height:1400} }));
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e=>errs.push(String(e)));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  page.on('dialog', d=>d.accept());
  await page.route('**/api/**', backend(store));
  await page.addInitScript(()=>localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(2800);
  await page.evaluate(()=>{['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id);if(o)o.style.display='none';});});
  await page.evaluate(()=>{const b=document.querySelector('.tab-btn[data-tab="galaxie"]');if(b)b.click();});
  await page.evaluate(()=>{const b=document.querySelector('[data-galaxy-subtab="abgrund"]');if(b)b.click();});
  await page.waitForTimeout(1200);
  return { ctx, page, errs, store };
}
const boxText = page => page.evaluate(()=>{ const b=document.getElementById('abgrundBox'); return b?b.innerText:null; });

(async () => {
  const browser = await starteBrowser();

  // ---- B1) Ueberschrift und Vorschau, bevor getaucht wurde ----
  {
    const { ctx, page, errs } = await starte(browser, stand({
      abgrund:{ tiefe:1, best:0, splitter:120, bergung:77, tauchgaenge:0, gesehen:{}, werkstatt:{} }
    }));
    const txt = await boxText(page);
    check('B1: die Ueberschrift zeigt den Bergungsgut-Bestand neben den Splittern',
      !!txt && /77\s*Bergungsgut/i.test(txt), txt ? txt.split('\n').slice(0,3) : null);
    check('B1: die Splitter stehen weiterhin daneben (die zweite Waehrung verdraengt die erste nicht)',
      !!txt && /120\s*Splitter/i.test(txt));
    check('B1: die Tauchgang-Vorschau nennt den erwarteten Bergungsgut-Ertrag',
      !!txt && /\+\s*\d+\s*Bergungsgut/i.test(txt),
      txt ? (txt.split('\n').find(z=>/Bergung ~/.test(z))||'').slice(0,240) : null);
    check('B1: keine Konsolenfehler', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  // ---- B2) Echter Tauchgang: Gutschrift, Log und Bericht ----
  {
    const jetzt = Date.now();
    const { ctx, page, errs, store } = await starte(browser, stand({
      abgrund:{ tiefe:1, best:0, splitter:0, bergung:0, tauchgaenge:0, gesehen:{}, werkstatt:{} },
      fleet:{ jaeger:4000, schlachtschiff:400, frachter:200, missions:[
        { id:'t1', type:'abgrund', targetId:1, startTime: jetzt-600000, endTime: jetzt-2000,
          composition:{ jaeger:4000, schlachtschiff:400, frachter:200 }, fleetName:'Probe', power:200000 }
      ]}
    }));
    await page.waitForTimeout(1800);
    const a = (gespeichert(store).abgrund)||{};
    check('B2: der Tauchgang schreibt Bergungsgut gut', (a.bergung||0) > 0, { bergung:a.bergung });
    check('B2: und Splitter unabhaengig davon ebenfalls', (a.splitter||0) > 0, { splitter:a.splitter });
    // Der gutgeschriebene Betrag muss der FORMEL entsprechen - nicht irgendeiner Zahl, die zufaellig
    // groesser als null ist. (Frueher stand hier "beide Betraege muessen sich unterscheiden"; in
    // Tiefe 1 liefern beide Formeln aber zufaellig dieselbe 4, die Pruefung mass also nur Glueck.)
    check('B2: der gutgeschriebene Betrag ist genau der Formelwert fuer Tiefe 1',
      (a.bergung||0) === B(1,false), { gutgeschrieben:a.bergung, formel:B(1,false) });

    const txt = await boxText(page);
    check('B2: die Ueberschrift zeigt den neuen Bestand',
      !!txt && new RegExp(a.bergung+'\\s*Bergungsgut','i').test(txt),
      txt ? txt.split('\n').slice(0,3) : null);

    // Der Kampfbericht: DIE Stelle, an der abgrundSplitter und abgrundMutatoren bis v8.333.0 stumm
    // blieben. Hier wird der wirklich gerenderte Text gelesen, nicht das gespeicherte Feld.
    const bericht = await page.evaluate(async () => {
      const t = document.querySelector('.tab-btn[data-tab="berichte"]');
      if (t) t.click();
      await new Promise(r => setTimeout(r, 600));
      // Berichte kommen vom Server, nicht aus dem Spielstand - erst nachladen lassen.
      const b = document.getElementById('refreshReportsBtn');
      if (b) b.click();
      await new Promise(r => setTimeout(r, 1200));
      document.querySelectorAll('#reportsBox details').forEach(d => { d.open = true; });
      await new Promise(r => setTimeout(r, 400));
      const box = document.getElementById('reportsBox');
      return box ? box.innerText : null;
    });
    check('B2: der Kampfbericht ist erreichbar', !!bericht, bericht === null ? 'keine Berichte-Box gefunden' : undefined);
    if (bericht){
      check('B2: der Bericht nennt das Bergungsgut', /Bergungsgut/i.test(bericht),
        bericht.split('\n').filter(z=>/Tiefe|Bergung|Splitter/i.test(z)).slice(0,6));
      check('B2: der Bericht nennt die Abgrundsplitter (bis v8.333.0 gespeichert, aber nie angezeigt)',
        /Abgrundsplitter/i.test(bericht));
      check('B2: der Bericht nennt die Sektorbedingungen (ebenfalls bis v8.333.0 stumm)',
        /Sektorbedingungen/i.test(bericht));
    }
    check('B2: keine Konsolenfehler beim Aufloesen und Anzeigen', errs.length === 0, errs.slice(0,3));
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nPASS');
  process.exit(fail ? 1 : 0);
})();
