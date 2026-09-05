// Der Planet im Hintergrund passt zum Kampfort (05.08.2026, Wunsch Sascha).
//
// SPIELER-WUNSCH: „können wir noch die optik des planeten im hintergrund anpassen je nachdem wo der
// kampf stattfindet". Bis dahin war der Boden bei JEDEM Gefecht derselbe dunkelblaue Halbkreis -
// egal ob man einen Eismond, einen Vulkanplaneten oder ein Trümmerfeld umkreiste. Die Art der Welt
// steht für alle 499 Planeten längst im Spiel (PLANETS[].type), sie kam nur nie in der Wiedergabe an.
//
// WAS DIESER TEST PRÜFT, und warum so: Nicht „die Farbe ist #2c4a5e" - das wäre eine Momentaufnahme,
// die bei jeder Nachjustierung rot würde, ohne dass etwas kaputt wäre. Geprüft wird die Eigenschaft:
// ZWEI VERSCHIEDENE WELTEN ERGEBEN ZWEI VERSCHIEDENE BILDER. Gemessen wird als Pixelunterschied im
// Bodenbereich der Leinwand.
//
// Die Gegenprobe gehört zwingend dazu: Derselbe Ort zweimal muss dasselbe Bild ergeben. Ohne sie
// wäre der Test auch dann grün, wenn der Hintergrund schlicht zufällig wäre.
const fs = require('fs');
const path = require('path');
const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// ============================================================================
// TEIL 1: die Stiltabelle statisch prüfen (Sekunden, kein Browser)
// ============================================================================
// Warum überhaupt statisch, wo der Browserteil unten doch das echte Bild misst? Weil der
// Browserteil nur DREI Welten anfährt. Ein Tippfehler in einer der neun anderen Zeilen bliebe
// unbemerkt - und er ist teuer: `addColorStop` wirft bei ungültiger Farbe, die Wiedergabe wäre auf
// dieser Weltensorte tot. Genau das ist beim Schreiben der Tabelle passiert (`#1d3span` statt
// `#1d3242` in der Eis-Zeile), und der Syntax-Check sieht es nicht - es ist eine gültige
// Zeichenkette. Diese drei Prüfungen kosten nichts und decken alle zwölf Zeilen ab.
{
  const src = fs.readFileSync(require('./lib/spieldatei').SPIELDATEI, 'utf8');
  const a = src.indexOf('var ORT_STIL = {');
  const b = src.indexOf('\n    };', a);
  check('Stiltabelle ORT_STIL gefunden', a >= 0 && b > a);
  const tabelle = src.slice(a, b);
  const zeilen = [...tabelle.matchAll(/^\s{6}([a-z]+):\s*\{([^}]*)\}/gm)].map(m => ({ typ: m[1], inhalt: m[2] }));
  /* KEINE FESTE ANZAHL MEHR (mitgezogen 05.09.2026, GR-9): Die Tabelle waechst, sobald ortTyp eine
     neue Sorte liefern kann - zuletzt um erdwelt und leerenwelt, die beiden Terraform-Ziele, die
     vorher still auf 'heimat' zurueckfielen. Eine eingetippte 12 haette das als Fehler gemeldet,
     obwohl es die Behebung war. Geprueft wird jetzt die REGEL: jede Sorte, die das Spiel als
     Kampfort kennt, hat einen Eintrag - die Liste dafuer kommt aus dem Spielquelltext selbst
     (PLANET_TYPE_INFO plus TERRAFORM_TARGET_TYPES plus die beiden Sonderorte heimat und mond). */
  const infoBlock = (() => { const i = src.indexOf('const PLANET_TYPE_INFO = {'); const e = src.indexOf('\n  };', i); return i >= 0 && e > i ? src.slice(i, e) : ''; })();
  const erwartet = [...new Set([
    'heimat', 'mond',
    ...[...infoBlock.matchAll(/^\s{4}([a-z]+):\s*\{\s*label:/gm)].map(m => m[1]),
    ...(((src.match(/const TERRAFORM_TARGET_TYPES = \[([^\]]*)\]/) || ['', ''])[1].match(/'([a-z]+)'/g) || []).map(x => x.replace(/'/g, '')))
  ])];
  const habe = zeilen.map(z => z.typ);
  check('die Liste der erwarteten Weltensorten liess sich aus dem Spiel lesen (sonst misst die naechste Pruefung nichts)',
    erwartet.length >= 12, erwartet);
  check('jede Weltensorte, die das Spiel als Kampfort kennt, hat einen Eintrag in ORT_STIL',
    erwartet.every(t => habe.includes(t)), { fehlt: erwartet.filter(t => !habe.includes(t)), habe });

  // 1a) Jede Farbe ist eine gültige Farbe.
  const kaputt = [];
  for (const z of zeilen){
    for (const m of z.inhalt.matchAll(/([abc]):\s*'([^']*)'/g)){
      if (!/^#[0-9a-fA-F]{6}$/.test(m[2])) kaputt.push(z.typ + '.' + m[1] + '=' + m[2]);
    }
    const land = z.inhalt.match(/land:\s*'([^']*)'/);
    // Die Landfarbe ist bewusst ein ABGESCHNITTENES rgba( - der Zeichencode hängt die Deckkraft
    // an. Fehlt das Komma am Ende, entsteht beim Zusammensetzen Unsinn.
    if (!land || !/^rgba\(\d{1,3},\d{1,3},\d{1,3},$/.test(land[1])) kaputt.push(z.typ + '.land=' + (land ? land[1] : '(fehlt)'));
    if (!/\bflecken:\s*\d+/.test(z.inhalt)) kaputt.push(z.typ + '.flecken fehlt');
  }
  check('1: jede Farbe der Tabelle ist gueltig', kaputt.length === 0,
    { kaputt, hinweis:'addColorStop wirft bei ungueltiger Farbe - die Wiedergabe waere auf dieser Welt tot.' });

  // 1b) GEGENPROBE zu 1a: Die Prüfung muss eine kaputte Farbe auch wirklich ablehnen. Ohne das
  // wäre oben vielleicht nur eine Regex grün, die auf alles passt.
  check('1: Gegenprobe - eine kaputte Farbe wuerde erkannt',
    !/^#[0-9a-fA-F]{6}$/.test('#1d3span') && !/^rgba\(\d{1,3},\d{1,3},\d{1,3},$/.test('rgba(24,34,58'));

  // 1c) DIE eigentliche Regel: Jede Weltensorte, die es im Spiel gibt, hat einen Eintrag.
  // Fehlt einer, fällt diese Welt still auf das Heimat-Aussehen zurück - der Kampf sähe dort
  // wieder aus wie überall, ohne dass irgendwo etwas rot wird. Eine neue Planetensorte in
  // PLANETS schlägt hier künftig sofort an.
  const pa = src.indexOf('const PLANETS = [');
  const pb = src.indexOf('\n  ];', pa);
  const typen = [...new Set([...src.slice(pa, pb).matchAll(/type:'([a-z]+)'/g)].map(m => m[1]))];
  check('PLANETS-Block gelesen', typen.length >= 8, typen.length);
  const bekannt = new Set(zeilen.map(z => z.typ));
  const fehlend = typen.filter(t => !bekannt.has(t));
  check('1: jede Planetensorte des Spiels hat einen Stil', fehlend.length === 0,
    { fehlend, hinweis:'Neue Planetensorte? Eine Zeile in ORT_STIL ergaenzen, sonst sieht sie aus wie die Heimatbasis.' });
}

// ============================================================================
// TEIL 2: das echte Bild messen
// ============================================================================

const FLOTTE = { jaeger:60, destroyers:120, schlachtschiff:40, kreuzer:80 };
const ABWEHR = { flak:20, turm:18, laser:14 };
// Ein eingehender Überfall führt Ort, beide Flotten und die Anlagen mit - der vollständigste Bericht.
const bericht = (planet) => ({ id:'r'+planet, time:Date.now(), ts:Date.now(), type:'raid', result:'win',
  faction:'Söldnerkonvoi', attackPower:9000, defensePower:12000, targetPlanet: planet,
  fleet:{ destroyers:40 }, destroyedShips:{ destroyers:9 },
  stationedFleet: FLOTTE, ownLostShips:{}, defenseBefore: ABWEHR });

function backend(store, berichte){ return async r => {
  const req=r.request(); const p=req.url().split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:'u',username:'A',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:false,tier:null}});
  if(p==='reports')return j({reports:berichte});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p.startsWith('storage/')){const k=decodeURIComponent(p.slice(8));if(req.method()==='PUT')return j({ok:true,version:2});if(store[k]!==undefined)return j({key:k,value:store[k],version:1});return j({e:1},404);}
  return j([]);
};}
const save = () => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e5,erz:9e5,kristalle:6e5,deuterium:4e5,antimaterie:9e4,forschungspunkte:3e4},
  buildings:Object.assign({solar:22,mine:20,labor:14,lager:30,werft:14}, ABWEHR),
  research:{rkampf:6}, fleet:Object.assign({missions:[]}, FLOTTE), colonies:{}, activeBasePlanet:'home',
  player:{id:'u',name:'A',avatarKey:null}, battleStats:{wins:9,losses:1}, xp:9e5, credits:5e5,
  buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

// Öffnet die Wiedergabe für den Bericht zu diesem Ort und gibt das Bodenband als Rohdaten zurück.
async function bodenBild(browser, planet){
  const ctx = await browser.newContext({ viewport:{width:1280,height:860} });
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend({ 'kepler7-save-v3': save() }, [bericht(planet)]));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(3800);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}));
  await page.evaluate(() => { const x=document.getElementById('headerReportsBtn'); if(x)x.click(); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const x=document.querySelector('[data-watch-battle]'); if(x)x.click(); });
  await page.waitForTimeout(2200);
  const d = await page.evaluate(() => {
    const c = document.querySelector('#osBuehne canvas');
    if (!c) return null;
    const g = c.getContext('2d');
    // Nur das Bodenband: Der Planetenboden liegt bei 80% der Leinwandhöhe. Darüber fliegen die
    // Schiffe, und die sollen das Ergebnis nicht verrauschen.
    const y0 = Math.floor(c.height * 0.82), hh = Math.max(1, Math.floor(c.height * 0.14));
    const bild = g.getImageData(0, y0, c.width, hh).data;
    // Mittlere Farbe UND eine grobe Prüfsumme - die Farbe allein könnte bei zwei verschiedenen
    // Mustern zufällig gleich sein.
    let r=0, gr=0, b=0, summe=0, n=0;
    for (let i=0;i<bild.length;i+=4){ r+=bild[i]; gr+=bild[i+1]; b+=bild[i+2]; summe=(summe + bild[i]*3 + bild[i+1]*5 + bild[i+2]*7) % 1000003; n++; }
    const z = (()=>{ try { return JSON.parse(document.getElementById('osWrap').dataset.zustand); } catch(e){ return null; } })();
    return { r:Math.round(r/n), g:Math.round(gr/n), b:Math.round(b/n), summe, breit:c.width, hoch:c.height, tSim: z ? z.t : null };
  });
  await ctx.close();
  return { d, errs };
}
const abstand = (a, b) => Math.abs(a.r-b.r) + Math.abs(a.g-b.g) + Math.abs(a.b-b.b);

(async () => {
  const browser = await starteBrowser();

  // 'vesna' ist ein Trümmerfeld (type asteroid, grau), 'rhea' ein Eismond (type wasserwelt, blau),
  // 'home' die Heimatbasis (das bisherige Aussehen). Drei bewusst weit auseinanderliegende Welten.
  const messungen = {};
  for (const ort of ['vesna', 'rhea', 'home']){
    const { d, errs } = await bodenBild(browser, ort);
    check('Bodenband von „'+ort+'" gemessen', !!d && d.breit > 100, d);
    check('keine JS-Fehler bei „'+ort+'"', errs.length === 0, errs.slice(0,3));
    messungen[ort] = d;
  }

  // ---- Der Punkt: verschiedene Welten sehen verschieden aus
  if (messungen.vesna && messungen.rhea && messungen.home){
    const av = abstand(messungen.vesna, messungen.rhea);
    const ah = abstand(messungen.vesna, messungen.home);
    // 12 Stufen Gesamtabstand über drei Kanäle ist wenig verlangt und trotzdem weit jenseits von
    // Rundungsrauschen - identische Bilder ergäben exakt 0.
    check('Trümmerfeld und Eismond zeigen verschiedene Böden', av >= 12,
      { abstand: av, asteroid: messungen.vesna, wasserwelt: messungen.rhea });
    check('und beide unterscheiden sich von der Heimatbasis', ah >= 12,
      { abstand: ah, heimat: messungen.home });
  }

  // ---- GEGENPROBE: derselbe Ort zweimal ergibt dasselbe Bild
  // Ohne sie wäre der Test auch dann grün, wenn der Hintergrund schlicht zufällig wäre - und dann
  // hätte er mit dem Kampfort nichts zu tun.
  {
    const { d } = await bodenBild(browser, 'vesna');
    // ERST auf Gleichheit geprueft, das war falsch gemessen: Im Bodenband stehen nicht nur der
    // Hintergrund, sondern auch die bewegten Schiffe und Geschosse - zwei Durchgaenge treffen nie
    // exakt dieselbe Bildphase. Der Hintergrund SELBST ist sehr wohl reproduzierbar (feste Saat
    // 20260802); was hier schwankt, ist der Vordergrund.
    //
    // Geprueft wird deshalb der ABSTAND, und die Zahlen trennen sauber: derselbe Ort zweimal ergab
    // gemessen 1, zwei verschiedene Welten 33 und 34. Die Schwelle 5 liegt weit ueber dem Rauschen
    // und weit unter dem echten Unterschied - genau das macht die Aussage belastbar.
    const rauschen = (d && messungen.vesna) ? abstand(d, messungen.vesna) : 999;
    check('derselbe Ort ergibt reproduzierbar dieselbe Welt', rauschen <= 5,
      { abstand: rauschen, erneut: d, zuvor: messungen.vesna });
    // Und die Trennschaerfe ausdruecklich als Zahl festhalten: Der Unterschied zwischen zwei Welten
    // muss ein Vielfaches des Rauschens sein, sonst misst der Test oben nur Zufall.
    const echt = (messungen.vesna && messungen.rhea) ? abstand(messungen.vesna, messungen.rhea) : 0;
    check('der Unterschied zwischen zwei Welten ist ein Vielfaches des Rauschens',
      echt >= Math.max(12, rauschen * 4), { unterschied: echt, rauschen });
  }

  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
