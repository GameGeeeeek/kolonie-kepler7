// Unterstuetzer-Abzeichen und Sofort-Hintergrund (28.07.2026, v8.327.0).
//
// Zwei Spieler-Reports aus einer Meldung:
//
// 1) "Habe gespendet, aber keine Kaffeetasse bekommen." Die Freischaltung war ein reiner Handgriff
//    ganz unten im Fortschritt-Tab. Seit v8.327.0 fragt versucheKofiAutoFreischaltung() von selbst
//    nach. Diese Automatik hat drei Eigenschaften, die still kaputtgehen koennen, ohne dass
//    irgendwo ein Fehler auftaucht:
//      - sie darf NICHT laufen, solange keine E-Mail hinterlegt ist (sonst Anfragen ins Leere fuer
//        jeden Spieler, der nie gespendet hat),
//      - sie darf bei Misserfolg NICHTS melden (Misserfolg ist der Normalfall fuer jeden, der die
//        E-Mail nur eingetragen hat) -
//      - und sie MUSS beim Uebergang "war nicht aktiv -> ist jetzt aktiv" genau einmal melden.
//        Meldet sie bei jedem Durchlauf, springt den Spender alle 30 Minuten dieselbe Meldung an.
//    Alle drei sind Verhalten, kein Text - deshalb wird die echte Funktion aus der Spieldatei
//    geschnitten und mit einer nachgebauten backendFetch-Antwort AUSGEFUEHRT. Ein Token-Suchlauf
//    ueber den Quelltext wuerde hier nichts aussagen (siehe CLAUDE.md-Lehre aus mehreren Runden).
//
// 2) "Weisser Balken beim Aufruf aus der Google-Suche in Firefox." Der grosse <style>-Block beginnt
//    mit dem Symbol-Font als Base64-Blob; die erste `html, body`-Regel steht rund 26.400 Zeichen
//    spaeter. Ein winziger eigener <style>-Block DAVOR faerbt die Leinwand sofort. Der ist nur dann
//    wirksam, wenn er wirklich vorne steht - und nur dann richtig, wenn seine Farbe zu den beiden
//    anderen Stellen passt, an denen dieselbe Hintergrundfarbe steht (theme-color-Meta und der
//    Endpunkt des Verlaufs in `html, body`). Das ist genau der Fehlertyp aus CLAUDE.md-Regel 6:
//    eine zweite Anzeigestelle, die die alte Annahme behaelt.
const fs = require('fs');
const path = require('path');
const SPIELDATEI = path.join(__dirname, '..', 'weltraum_kolonie.html');
const src = fs.readFileSync(SPIELDATEI, 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

let fail = false;
const check = (n, c, x) => { console.log((c?'OK  ':'FAIL')+' - '+n+(x!==undefined?' | '+JSON.stringify(x):'')); fail = fail || !c; };

// Eine Funktion samt Rumpf aus der Datei schneiden (Klammerzaehlung, keine Regex ueber die ganze
// Datei - die terminiert bei dieser Dateigroesse falsch, siehe CLAUDE.md-Fallstricke).
function fnAus(name){
  const m = js.match(new RegExp('(?:async\\s+)?function\\s+'+name+'\\s*\\('));
  if (!m) throw new Error('Funktion nicht gefunden: '+name);
  const i = js.indexOf(m[0]);
  let d = 0, s = js.indexOf('{', i + m[0].length), k = s;
  for (; k < js.length; k++){ if (js[k]==='{') d++; else if (js[k]==='}'){ d--; if(!d) break; } }
  return js.slice(i, k+1);
}
function objAus(name){
  const i = js.indexOf('const '+name+' = {');
  if (i < 0) throw new Error('Objekt nicht gefunden: '+name);
  let d = 0, s = js.indexOf('{', i), k = s;
  for (; k < js.length; k++){ if (js[k]==='{') d++; else if (js[k]==='}'){ d--; if(!d) break; } }
  return js.slice(s, k+1);
}
function konstAus(name){
  const m = js.match(new RegExp('const\\s+'+name+'\\s*=\\s*([^;\\n]+);'));
  if (!m) throw new Error('Konstante nicht gefunden: '+name);
  return m[1].trim();
}

// ---- 1) Stufentabelle: eine Quelle, drei Verwender ----
const KOFI_STUFEN = eval('('+objAus('KOFI_STUFEN')+')');
check('1: KOFI_STUFEN kennt genau die drei Server-Stufen',
  ['bronze','silver','gold'].every(k => KOFI_STUFEN[k]) && Object.keys(KOFI_STUFEN).length === 3,
  Object.keys(KOFI_STUFEN));
check('1: jede Stufe hat Medaille, Stufenname und Pillen-Beschriftung',
  Object.values(KOFI_STUFEN).every(s => s.icon && s.name && s.badge));
// Die frueher doppelt gepflegte Kopie in der Bestenliste darf nicht wieder auftauchen - genau die
// war der Grund, dass eine Stufenaenderung an zwei Stellen nachgezogen werden musste.
check('1: es gibt keine zweite Stufentabelle mehr (SUPPORTER_TIER_META ist weg)',
  !/const\s+SUPPORTER_TIER_META\s*=/.test(js));
// Alle drei Verwendungsstellen ziehen aus derselben Tabelle.
const nutzerVonStufen = (js.match(/KOFI_STUFEN/g) || []).length;
check('1: KOFI_STUFEN wird von mehreren Stellen benutzt, nicht nur definiert',
  nutzerVonStufen >= 4, { treffer: nutzerVonStufen });

// ---- 2) Verhalten der automatischen Freischaltung ----
// Umgebung nachbauen: nur das, was die Funktion wirklich anfasst. Alles andere bleibt ein Zaehler,
// damit sichtbar wird, WAS sie aufgerufen hat.
function baueUmgebung(antwort, opt){
  const o = opt || {};
  const u = {
    meldungen: [], speicherungen: 0, renders: 0, bestenlisten: 0, anfragen: [],
    state: { kofiEmail: o.email === undefined ? 'spender@beispiel.de' : o.email,
             kofiAbzeichenAktiv: !!o.warAktiv },
    useBackend: () => o.backend !== false,
    log: (msg, icon, typ) => u.meldungen.push({ msg, icon, typ }),
    save: () => { u.speicherungen++; },
    render: () => { u.renders++; },
    loadLeaderboard: () => { u.bestenlisten++; },
    backendFetch: async (pfad, opts) => {
      u.anfragen.push({ pfad, body: JSON.parse(opts.body) });
      return { ok: antwort.httpOk !== false, json: async () => antwort.daten };
    }
  };
  return u;
}
const QUELLEN = [
  'const KOFI_AUTO_INTERVALL = '+konstAus('KOFI_AUTO_INTERVALL')+';',
  'let kofiAutoLetzterVersuch = 0;',
  'let kofiAutoLaeuft = false;',
  'const KOFI_STUFEN = '+objAus('KOFI_STUFEN')+';',
  fnAus('kofiStufenText'),
  fnAus('kofiFreischaltungAnfragen'),
  fnAus('versucheKofiAutoFreischaltung')
].join('\n');
function ladeAutomatik(u){
  const f = new Function('umgebung', `
    const { state, useBackend, log, save, render, loadLeaderboard, backendFetch } = umgebung;
    ${QUELLEN}
    return { versuch: versucheKofiAutoFreischaltung, sperreLoesen: () => { kofiAutoLetzterVersuch = 0; } };
  `);
  return f(u);
}
const ANTWORT_AKTIV = { daten: { ok:true, active:true, tier:'gold', daysLeft:27 } };

// (a) ohne hinterlegte E-Mail darf gar keine Anfrage rausgehen
{
  const u = baueUmgebung(ANTWORT_AKTIV, { email: '' });
  const a = ladeAutomatik(u);
  a.versuch().then(() => {
    check('2a: ohne hinterlegte Ko-fi-E-Mail geht keine Anfrage raus',
      u.anfragen.length === 0 && u.meldungen.length === 0, { anfragen: u.anfragen.length });
    weiter();
  });
}

function weiter(){
  // (b) Erfolgsfall: genau eine Anfrage, genau eine Meldung, Bestenliste wird neu geladen
  const u = baueUmgebung(ANTWORT_AKTIV);
  const a = ladeAutomatik(u);
  a.versuch().then(async () => {
    check('2b: mit E-Mail geht genau eine Anfrage an /claim-supporter',
      u.anfragen.length === 1 && u.anfragen[0].pfad === '/claim-supporter'
        && u.anfragen[0].body.email === 'spender@beispiel.de', u.anfragen);
    check('2b: der Uebergang auf "aktiv" wird genau einmal gemeldet',
      u.meldungen.length === 1, u.meldungen.map(m=>m.msg));
    check('2b: die Meldung nennt die Stufe im Klartext',
      /Gold/.test(u.meldungen[0].msg||''), u.meldungen[0] && u.meldungen[0].msg);
    check('2b: die Meldung ist als Erfolg eingefaerbt und traegt ein Icon',
      u.meldungen[0].typ === 'good' && /^ti-/.test(u.meldungen[0].icon||''), u.meldungen[0]);
    check('2b: die Bestenliste wird nachgeladen, damit die Tasse sofort erscheint',
      u.bestenlisten === 1);
    check('2b: der neue Zustand landet im Spielstand',
      u.state.kofiAbzeichenAktiv === true && u.state.kofiAbzeichenStufe === 'gold'
        && u.state.kofiAbzeichenTage === 27 && u.speicherungen >= 1, u.state);

    // (c) zweiter Durchlauf direkt danach: die Sperre haelt, KEINE zweite Anfrage
    const vorher = u.anfragen.length;
    await a.versuch();
    check('2c: ein sofortiger zweiter Durchlauf wird von der 30-Minuten-Sperre abgefangen',
      u.anfragen.length === vorher, { vorher, nachher: u.anfragen.length });

    // (d) Sperre geloest, aber Abzeichen war schon aktiv: Anfrage ja, Meldung nein
    a.sperreLoesen();
    await a.versuch();
    check('2d: nach geloester Sperre laeuft die Anfrage wieder',
      u.anfragen.length === vorher + 1, { anfragen: u.anfragen.length });
    check('2d: ein bereits aktives Abzeichen wird NICHT erneut gemeldet',
      u.meldungen.length === 1, u.meldungen.map(m=>m.msg));

    // (e) Misserfolg (Adresse dem Server unbekannt): still, und der Spielstand bleibt unberuehrt
    const u2 = baueUmgebung({ httpOk:false, daten:{ error:'Keine Spende unter dieser Adresse.' } });
    const a2 = ladeAutomatik(u2);
    await a2.versuch();
    check('2e: eine abgelehnte Anfrage meldet dem Spieler nichts',
      u2.meldungen.length === 0, u2.meldungen);
    check('2e: eine abgelehnte Anfrage laesst den Spielstand unveraendert',
      u2.state.kofiAbzeichenAktiv === false && u2.state.kofiAbzeichenStufe === undefined, u2.state);

    // (f) Server nicht erreichbar: darf nicht durchschlagen
    const u3 = baueUmgebung(ANTWORT_AKTIV);
    u3.backendFetch = async () => { throw new Error('offline'); };
    const a3 = ladeAutomatik(u3);
    let geworfen = false;
    try { await a3.versuch(); } catch(e){ geworfen = true; }
    check('2f: ein Netzfehler wirft nicht bis nach oben durch',
      !geworfen && u3.meldungen.length === 0);

    // (g) ohne Backend (Solo-Modus) passiert nichts
    const u4 = baueUmgebung(ANTWORT_AKTIV, { backend:false });
    const a4 = ladeAutomatik(u4);
    await a4.versuch();
    check('2g: im Solo-Modus ohne Backend geht keine Anfrage raus',
      u4.anfragen.length === 0);

    teil3();
  });
}

function teil3(){
  // ---- 3) Fehlermeldung nennt die eigentliche Ursache ----
  // Der haeufigste Ablehnungsgrund ist eine andere Adresse als die bei Ko-fi hinterlegte. Stand der
  // Hinweis nicht da, raet der Spieler - genau das war der Report.
  const quelle = fnAus('kofiFreischaltungAnfragen');
  check('3: der Fehlertext erklaert die E-Mail-Bedingung statt nur "fehlgeschlagen"',
    /E-Mail-Adresse, mit der bezahlt wurde/.test(quelle));

  // ---- 4) Der Sofort-Hintergrund steht wirklich vorne ----
  // HTML-Kommentare raus, BEVOR nach <style> gesucht wird: der Erklaerkommentar ueber dem
  // Sofort-Block spricht selbst ueber "<style>" und wuerde sonst als Stilblock mitgezaehlt. (Genau
  // darauf ist dieser Test beim ersten Lauf hereingefallen - die Messung war falsch, nicht die
  // Aenderung.) Ersetzt wird laengengleich, damit alle Positionen weiter auf src passen.
  const ohneKommentare = src.replace(/<!--[\s\S]*?-->/g, m => ' '.repeat(m.length));
  const kopf = ohneKommentare.slice(0, ohneKommentare.indexOf('</head>'));
  const stellen = [];
  let p = -1;
  while ((p = kopf.indexOf('<style>', p+1)) >= 0) stellen.push(p);
  check('4: es gibt mindestens zwei <style>-Bloecke im Kopf (Sofort-Block + Hauptblock)',
    stellen.length >= 2, { bloecke: stellen.length });

  const ersterBlock = kopf.slice(stellen[0], kopf.indexOf('</style>', stellen[0]));
  check('4: der ERSTE Stilblock ist der winzige Sofort-Block, nicht der Hauptblock',
    ersterBlock.length < 300 && !/@font-face/.test(ersterBlock), { laenge: ersterBlock.length });
  check('4: er faerbt die Leinwand (html/body) und setzt color-scheme',
    /html\s*,\s*body\s*\{[^}]*background:/.test(ersterBlock) && /color-scheme\s*:\s*dark/.test(ersterBlock),
    ersterBlock.trim());

  // Regel 6: dieselbe Farbe steht an drei Stellen. Weichen sie ab, blitzt beim Laden eine falsche
  // Farbe auf - und genau das war der gemeldete Fehler, nur in Weiss.
  const sofortFarbe = (ersterBlock.match(/background:\s*(#[0-9a-fA-F]{6})/) || [])[1];
  const iHtmlBody = src.indexOf('html, body {');
  const htmlBodyRegel = src.slice(iHtmlBody, src.indexOf('}', iHtmlBody));
  const verlaufFarben = htmlBodyRegel.match(/#[0-9a-fA-F]{6}/g) || [];
  const endFarbe = verlaufFarben[verlaufFarben.length - 1];
  check('4: die Sofort-Farbe entspricht dem Endpunkt des Verlaufs in `html, body`',
    !!sofortFarbe && sofortFarbe.toLowerCase() === (endFarbe||'').toLowerCase(),
    { sofort: sofortFarbe, verlaufsende: endFarbe });

  // theme-color darf abweichen (es faerbt die Browserleiste, nicht die Seite), muss aber ebenfalls
  // dunkel sein - sonst ist der helle Balken nur vom Seiteninhalt in die Leiste gewandert.
  const themeColor = (src.match(/name="theme-color"\s+content="(#[0-9a-fA-F]{6})"/) || [])[1];
  const hell = f => { const n = parseInt(f.slice(1),16); return ((n>>16&255)*0.299 + (n>>8&255)*0.587 + (n&255)*0.114); };
  check('4: theme-color und Sofort-Farbe sind beide dunkel (Helligkeit < 40 von 255)',
    !!themeColor && hell(themeColor) < 40 && hell(sofortFarbe) < 40,
    { themeColor, themeHell: +hell(themeColor).toFixed(1), sofort: sofortFarbe, sofortHell: +hell(sofortFarbe).toFixed(1) });

  // Der Sofort-Block ist nur dann sinnvoll, wenn im Hauptblock wirklich viel VOR der ersten
  // Hintergrundregel steht. Faellt das eines Tages weg (Font ausgelagert), ist der Block ueberfluessig
  // - dann soll dieser Test daran erinnern, statt still weiterzulaufen.
  const hauptStart = stellen[stellen.length-1];
  const abstand = src.indexOf('html, body {', hauptStart) - hauptStart;
  check('4: im Hauptblock steht weiterhin viel vor der ersten Hintergrundregel (sonst waere der Sofort-Block unnoetig)',
    abstand > 5000, { zeichenVorDerRegel: abstand });

  console.log(fail ? '\nFEHLGESCHLAGEN' : '\nAlles gruen');
  process.exit(fail ? 1 : 0);
}
