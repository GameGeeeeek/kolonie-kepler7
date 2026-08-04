// Das Unterstuetzer-Abzeichen steht in JEDER Spielerliste (05.08.2026, Spieler-Report Sascha).
//
// SPIELER-REPORT, mit zwei Bildern: „Das Tassen Abzeichen wird immernoch nicht in der Bestenliste
// angezeigt." Auf dem einen Bild die Bestenliste im Status-Seitenmenue ohne Abzeichen, auf dem
// anderen der Unterstuetzer-Kasten, der „Abzeichen aktiv (Bronze) - noch 30 Tag(e)" meldet. Der
// Rang war also da und wurde trotzdem nicht gezeigt.
//
// NACHGEMESSEN, fuenf Stellen, die einen Spielernamen aus den Bestenlisten-Daten zeichnen - genau
// EINE hatte das Abzeichen:
//     Punkte-Tab, volle Rangliste ..... ja
//     Status-Seitenmenue .............. nein   <- die Liste auf Saschas Bild
//     Wochenliga ...................... nein
//     Freundesliste ................... nein
//     Spielerprofil ................... nein
//
// Der Server war unschuldig: Mit echten HTTP-Anfragen gegen server.js geprueft, liefert
// GET /api/storage/leaderboard:<id> korrekt isSupporter=true fuer den Spender UND fuer einen
// manuell vergebenen Rang, false fuer ein Konto ohne beides. Es war reine Anzeige - dieselbe Falle
// wie bei den Allianz-Icons am selben Tag (vier Stellen mit fest eingebautem Markup).
//
// WAS DIESER TEST PRUEFT: nicht „an Stelle X steht eine Tasse" (das waere die Momentaufnahme,
// die beim naechsten Umbau nichts mehr aussagt), sondern zwei Regeln:
//   1. Das Pillen-Markup entsteht an GENAU EINER Stelle im Quelltext. Eine zweite Kopie ist der
//      Anfang des naechsten Auseinanderlaufens.
//   2. Jede der fuenf Listen zeigt es fuer einen Unterstuetzer - und KEINE zeigt es fuer einen
//      Nicht-Unterstuetzer. Der zweite Teil ist die eingebaute Gegenprobe: Ohne ihn waere der Test
//      auch dann gruen, wenn ueberall bedingungslos eine Tasse stuende.
const fs = require('fs');
const path = require('path');
const { starteBrowser, SPIEL_URL } = require('./lib/umgebung');

let fail = false;
const check = (n, c, x) => { console.log((c ? 'OK  ' : 'FAIL') + ' - ' + n + (x !== undefined ? ' | ' + JSON.stringify(x) : '')); fail = fail || !c; };

// ============================================================================
// TEIL 1: eine Quelle, keine Kopien (statisch, Sekunden)
// ============================================================================
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'weltraum_kolonie.html'), 'utf8');
  const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

  check('supporterPille() existiert', /function supporterPille\(/.test(js));
  check('supporterPilleKlein() existiert (schmale Listen)', /function supporterPilleKlein\(/.test(js));

  // Wo wird die CSS-Klasse `pill-supporter-<stufe>` ERZEUGT? Gemeint sind Vorlagen-Ausdruecke,
  // nicht die CSS-Regeln selbst - deshalb auf die Stellen mit eingesetzter Stufe eingegrenzt.
  //
  // Die Regel ist NICHT "genau ein Vorkommen" (es sind zwei: die volle und die schmale Variante),
  // sondern: JEDES Vorkommen liegt INNERHALB der beiden Helfer. Genau das ist die Eigenschaft, die
  // zaehlt - eine Kopie in einer Listenfunktion ist der Anfang des naechsten Auseinanderlaufens,
  // eine zweite Variante im Helfer selbst ist es nicht.
  const bereich = (name) => {
    const a = js.indexOf('function ' + name + '(');
    return a < 0 ? null : [a, js.indexOf('\n  }', a)];
  };
  const helfer = [bereich('supporterPille'), bereich('supporterPilleKlein')].filter(Boolean);
  check('1: beide Helfer im Quelltext gefunden', helfer.length === 2);
  const erzeuger = [...js.matchAll(/pill-supporter-\$\{/g)];
  const ausserhalb = erzeuger.filter(m => !helfer.some(([a,b]) => m.index > a && m.index < b));
  check('1: das Pillen-Markup entsteht NUR in den beiden Helfern', ausserhalb.length === 0,
    { stellenGesamt: erzeuger.length, davonAusserhalb: ausserhalb.length,
      hinweis:'Neue Spielerliste? supporterPille(e) bzw. supporterPilleKlein(e) aufrufen statt das Markup zu kopieren.' });

  // Gegenprobe zu 1: Der Suchausdruck muss ueberhaupt etwas finden - sonst waere "nichts
  // ausserhalb" trivial wahr, auch wenn das Abzeichen komplett verschwunden ist.
  check('1: Gegenprobe – der Suchausdruck findet die Stellen wirklich', erzeuger.length >= 2,
    { gefunden: erzeuger.length });

  // Und die fuenf Listen rufen die Funktion auch auf. Statisch geprueft, damit ein Wegfall sofort
  // auffaellt und nicht erst im Browserteil unten.
  const aufrufe = (js.match(/supporterPille\(|supporterPilleKlein\(/g) || []).length;
  // 2 Definitionen + mindestens 5 Aufrufstellen
  check('1: die Pille wird an mindestens fünf Stellen abgerufen', aufrufe >= 7,
    { vorkommen: aufrufe, davonDefinitionen: 2 });

  // ---- Kaffeetasse statt Medaille (05.08.2026, Wunsch Sascha)
  // Die Stufen-Tabelle ist die eine Quelle - auch fuer die Zeile "Abzeichen aktiv (Bronze)" im
  // Unterstuetzer-Kasten, die dasselbe `icon` benutzt. Beide zusammen halten oder beide zusammen
  // fallen; ein Rueckfall auf Medaillen an nur einer Stelle waere genau der Bruch, der hier auffallen soll.
  const tab = js.slice(js.indexOf('const KOFI_STUFEN = {'), js.indexOf('};', js.indexOf('const KOFI_STUFEN = {')));
  const stufen = [...tab.matchAll(/(bronze|silver|gold):\s*\{\s*icon:'([^']*)'/g)].map(m => ({ stufe:m[1], icon:m[2] }));
  check('1: alle drei Stufen tragen die Kaffeetasse', stufen.length === 3 && stufen.every(s => s.icon === '☕'), stufen);

  // DIE WICHTIGE FOLGEFRAGE: Wenn das Symbol die Stufe nicht mehr unterscheidet, muss es etwas
  // anderes tun - sonst sind Bronze, Silber und Gold ununterscheidbar geworden und die Stufen
  // waeren faktisch abgeschafft, ohne dass es jemand beschlossen haette.
  // ACHTUNG, hier lag der Test zuerst falsch: Gesucht wurde in `js` (dem <script>-Inhalt), die
  // Farbregeln stehen aber im <style>-Block. Ergebnis waren drei "FEHLT" bei voellig gesundem Code.
  // Deshalb hier ueber `src`, die ganze Datei.
  const farben = ['bronze','silver','gold'].map(t => {
    const m = src.match(new RegExp('\\.pill-supporter-' + t + '\\s*\\{([^}]*)\\}'));
    return { stufe:t, regel: m ? m[1].trim() : null };
  });
  check('1: jede Stufe hat eine eigene Farbregel', farben.every(f => f.regel), farben.map(f => f.stufe + (f.regel?'':' FEHLT')));
  const verschieden = new Set(farben.map(f => f.regel)).size;
  check('1: die drei Farbregeln unterscheiden sich voneinander', verschieden === 3,
    { verschiedene: verschieden, hinweis:'Gleiches Symbol UND gleiche Farbe = die Stufen waeren nicht mehr unterscheidbar.' });

  // Und die Farbe muss auch in den SCHMALEN Listen ankommen. Dort stand die Tasse zwischenzeitlich
  // nackt in einem <span> ohne Klasse - drei nackte Tassen sehen identisch aus, weil das System
  // Emoji in ihrer eigenen Farbe zeichnet und CSS-`color` daran nicht greift.
  const kleinBlock = js.slice(js.indexOf('function supporterPilleKlein('), js.indexOf('function supporterPilleKlein(') + 700);
  check('1: auch die schmale Variante trägt die Stufen-Klasse',
    /pill-supporter-\$\{/.test(kleinBlock),
    { hinweis:'Ohne Klasse waeren Bronze/Silber/Gold im Seitenmenue nicht auseinanderzuhalten.' });
}

// ============================================================================
// TEIL 2: die fünf Listen im echten Browser
// ============================================================================
const ICH = 'u-ich';
// Ich = Gold-Unterstuetzer, Lumekx = Bronze-Unterstuetzer, Aryen82 = ohne alles (die Gegenprobe).
const EINTRAEGE = {
  ['leaderboard:'+ICH]:   JSON.stringify({ id:ICH, name:'GameGeeeeek', allianceTag:'GG', score:1131816, ships:900, bp:400, lastSeen:Date.now(), isSupporter:true,  supporterTier:'gold' }),
  ['leaderboard:u-lume']: JSON.stringify({ id:'u-lume', name:'Lumekx', allianceTag:'GG', score:154896, ships:300, bp:120, lastSeen:Date.now(), isSupporter:true,  supporterTier:'bronze' }),
  ['leaderboard:u-ohne']: JSON.stringify({ id:'u-ohne', name:'Aryen82', score:95, ships:5, bp:1, lastSeen:Date.now()-9e6, isSupporter:false, supporterTier:null })
};

function backend(store){ return async r => {
  const req=r.request(); const u=req.url(); const p=u.split('/api/')[1].split('?')[0];
  const j=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
  if(p==='health')return j({ok:true});
  if(p==='me')return j({userId:ICH,username:'GameGeeeeek',homeSystem:'kepler',homeSlot:0,attackShieldMs:0,hasEmail:true,wantsPatchnotes:true,supporter:{active:true,tier:'gold',exempt:false,granted:false,until:Date.now()+30*86400000}});
  if(p==='reports')return j({reports:[]});
  if(p==='pending-rewards/claim')return j({reward:null});
  if(p==='storage-list'){
    const pref = decodeURIComponent((u.split('prefix=')[1]||'').split('&')[0]);
    return j({ keys: Object.keys(store).filter(k=>k.startsWith(pref)) });
  }
  if(p.startsWith('storage/')){
    const k=decodeURIComponent(p.slice(8));
    if(req.method()==='PUT')return j({ok:true,version:2});
    if(store[k]!==undefined)return j({key:k,value:store[k],shared:true,version:1});
    return j({e:1},404);
  }
  return j([]);
};}
const save = () => JSON.stringify({ tutorialSeen:true, newbieWelcomeSeen:true,
  resources:{energie:9e8,erz:9e8,kristalle:9e8,deuterium:9e8,antimaterie:9e6,forschungspunkte:9e5},
  buildings:{solar:30,mine:28,labor:20,lager:60,werft:20}, research:{}, fleet:{missions:[],jaeger:100},
  colonies:{}, activeBasePlanet:'home',
  player:{id:ICH,name:'GameGeeeeek',avatarKey:null,allianceTag:'GG'},
  // Beide Freunde: ein Unterstuetzer und ein Nicht-Unterstuetzer, damit die Gegenprobe auch hier greift.
  friends:[{id:'u-lume',name:'Lumekx'},{id:'u-ohne',name:'Aryen82'}],
  xp:9e6, credits:5e6, buffs:[], lastTick:Date.now(), colonyNames:{}, modules:{}, shipModules:{} });

// Zaehlt je Liste, wie viele Unterstuetzer-Abzeichen darin stehen.
// Gezaehlt wird die Stufen-KLASSE, nicht das Symbol: Seit dem 05.08.2026 tragen alle drei Stufen
// dieselbe Kaffeetasse (Wunsch Sascha), und die Tasse taucht im Spiel auch ausserhalb der
// Abzeichen auf (Kopfleisten-Knopf, Abschnittsueberschrift). Die Klasse pill-supporter-<stufe>
// entsteht dagegen ausschliesslich in supporterPille()/supporterPilleKlein().
const ZAEHLEN = (sel) => {
  const box = document.querySelector(sel);
  if (!box) return null;
  const html = box.innerHTML || '';
  const txt = (box.textContent || '');
  return { pillen: (html.match(/pill-supporter-\w+/g) || []).length,
           tassen: (txt.match(/☕/g) || []).length,
           hatLumekx: /Lumekx/.test(txt), hatAryen: /Aryen82/.test(txt) };
};

(async () => {
  const browser = await starteBrowser();
  const ctx = await browser.newContext({ viewport:{width:1400,height:1000} });
  const page = await ctx.newPage(); const errs=[];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|CORS|ERR_/.test(m.text())) errs.push(m.text()); });
  await page.route('**/api/**', backend(Object.assign({ 'kepler7-save-v3': save() }, EINTRAEGE)));
  await page.addInitScript(() => localStorage.setItem('kepler7_token','tok'));
  await page.goto(SPIEL_URL); await page.waitForTimeout(4500);
  await page.evaluate(() => ['tutorialOverlay','welcomeNewOverlay','welcomeBackOverlay','updateNoticeOverlay','kofiEmailPromptOverlay'].forEach(id=>{const o=document.getElementById(id); if(o)o.style.display='none';}));
  await page.evaluate(() => { const b=[...document.querySelectorAll('[data-tab]')].find(x=>x.getAttribute('data-tab')==='punkte'); if(b)b.click(); });
  await page.waitForTimeout(2600);

  // ---- Die drei Listen, die immer sichtbar sind
  const seite = await page.evaluate((f) => {
    const z = new Function('sel', 'return (' + f + ')(sel)');
    return { seitenmenue: z('#fpLeaderboard'), volleListe: z('#leaderboard'), freunde: z('#friendsBox') };
  }, ZAEHLEN.toString());

  // Zwei Unterstuetzer stehen in der Liste, einer nicht - also genau ZWEI Abzeichen, nie drei.
  check('2: die volle Rangliste zeigt beide Unterstützer',
    seite.volleListe && seite.volleListe.pillen === 2, seite.volleListe);
  check('2: das Status-Seitenmenü zeigt sie auch (die Liste aus dem Spieler-Report)',
    seite.seitenmenue && seite.seitenmenue.pillen === 2, seite.seitenmenue);
  // GEGENPROBE, eingebaut: Der Nicht-Unterstützer steht in beiden Listen und darf KEINS haben.
  // Ohne diese Zeile wäre der Test auch dann grün, wenn überall bedingungslos eine Tasse stünde.
  check('2: Gegenprobe – Aryen82 steht in den Listen und trägt KEIN Abzeichen',
    !!(seite.volleListe && seite.volleListe.hatAryen && seite.seitenmenue.hatAryen &&
       seite.volleListe.pillen === 2 && seite.seitenmenue.pillen === 2),
    { volleListe: seite.volleListe, seitenmenue: seite.seitenmenue });
  // Freundesliste: beide Freunde stehen drin, genau einer ist Unterstützer.
  check('2: die Freundesliste zeigt genau ein Abzeichen (ein Freund von zweien)',
    seite.freunde && seite.freunde.pillen === 1 && seite.freunde.hatLumekx && seite.freunde.hatAryen,
    seite.freunde);

  // ---- Wochenliga: braucht Einträge der LAUFENDEN Woche, die der Client selbst bildet.
  // Deshalb hier über die echte Funktion, statt einen Wochenschlüssel zu raten, der morgen falsch ist.
  const liga = await page.evaluate((f) => {
    const roh = document.querySelector('#weeklyLeagueBox');
    if (!roh) return null;
    const z = new Function('sel', 'return (' + f + ')(sel)');
    return z('#weeklyLeagueBox');
  }, ZAEHLEN.toString());
  check('2: die Wochenliga zeigt das Abzeichen des eigenen Unterstützer-Kontos',
    liga && liga.pillen >= 1, liga);

  // ---- Spielerprofil eines Unterstützers, und danach eines Nicht-Unterstützers
  const profil = async (id) => {
    await page.evaluate(i => { const r=document.querySelector('[data-profile="'+i+'"]'); if(r)r.click(); }, id);
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => {
      const n = document.getElementById('profileModalName');
      return n ? { name:(n.textContent||'').trim(), pillen:(n.innerHTML.match(/pill-supporter-\w+/g)||[]).length } : null;
    });
    await page.evaluate(() => { const o=document.getElementById('playerProfileOverlay'); if(o) o.style.display='none'; });
    return r;
  };
  const pLume = await profil('u-lume');
  const pOhne = await profil('u-ohne');
  check('2: das Spielerprofil eines Unterstützers zeigt das Abzeichen',
    pLume && pLume.pillen === 1 && /Lumekx/.test(pLume.name), pLume);
  check('2: Gegenprobe – das Profil eines Nicht-Unterstützers zeigt keins',
    pOhne && pOhne.pillen === 0 && /Aryen82/.test(pOhne.name), pOhne);

  check('keine JS-Fehler', errs.length === 0, errs.slice(0,3));
  await ctx.close();
  await browser.close();
  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
})();
