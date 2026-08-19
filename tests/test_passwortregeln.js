// Passwort-Mindestlaenge 8: Waechter ueber die Frontend-Seite und die PARITAET zum Backend
// (Sicherheits-Audit 18.08.2026, Vorschlag P5).
//
// WARUM DIE PARITAET DER KERN DIESES TESTS IST
// -------------------------------------------
// Der Ausloeser des ganzen Audits war ein Video ueber vibe-gecodete Login-Screens, und seine
// dritte Zeile lautet: "Mind. 8 Zeichen: Front ✓, Server ✗". Der Fehler, vor dem gewarnt wird,
// ist also nicht eine falsche Zahl, sondern ZWEI Zahlen, die auseinanderlaufen. Genau das kann
// hier passieren: Die Regel steht im Backend (PASSWORT_MIN in server.js) und die Vorpruefung im
// Frontend, in zwei getrennten Repos, die ueber zwei getrennte fest verdrahtete Befehle desselben
// Webhooks live gehen. Pruefung 4 haelt beide Zahlen zusammen - dieselbe Kopie-Familie wie
// test_kosmetik_paritaet.js und SHIP_SCORE_WEIGHTS.
//
// WAS DAS FRONTEND BEWUSST NICHT PRUEFT
// -------------------------------------
// Nur die LAENGE. Die Liste der bekannten Passwoerter (2.122 Eintraege, 19 kB) bleibt im Backend;
// sie hier zu spiegeln waere eine zweite Wahrheit, die auseinanderlaufen kann, und 19 kB in einer
// Datei, die jeder Spieler bei jedem Aufruf laedt. Der Server ist die Autoritaet und nennt in dem
// Fall den Grund. Pruefung 3b haelt fest, dass die Vorpruefung wirklich nur die Laenge ist - sonst
// entstuende genau die zweite Wahrheit, die hier vermieden werden soll.
//
// DIE WICHTIGSTE GEGENRICHTUNG IST 2b
// -----------------------------------
// Das Passwortfeld ist DASSELBE fuer Anmelden und Registrieren. Ein festes "mind. 8 Zeichen" waere
// im Anmelde-Modus eine Falschaussage gegenueber genau den Bestandskonten, die die Aenderung
// schuetzt: Wer sein Konto vor dem 19.08.2026 mit sechs Zeichen angelegt hat, meldet sich weiter
// damit an. Die Angabe darf deshalb nur im Registrier-Modus stehen.
//
// AUSFUEHREN: node tests/test_passwortregeln.js
//
// GEGENPROBE (19.08.2026). Beide laufen ueber die Env-Umleitungen aus umgebung.js, nie per Tausch
// der echten Dateien - ein `cp alt.html weltraum_kolonie.html` waere ein Edit an der Spieldatei und
// machte jeden gleichzeitig laufenden Pruef lauf wertlos (Regel 14, Nachtrag 15.08.2026).
//
// Es braucht ZWEI Gegenproben, weil dieser Test zwei verschiedene Dateien misst - eine ueber die
// Spieldatei allein haette die Paritaets-Pruefung gar nicht bewegt:
//
//   (a) alte Spieldatei  (KEPLER_SPIELDATEI=/tmp/.../alt.html):   10 Pruefungen, 4 rot
//       2 (kein Platzhalter im Registrier-Modus), 3 und 3-wirkung (keine Vorpruefung: die
//       Meldung kam vom fehlgeschlagenen Serveraufruf, und die Anfrage ging mit
//       ["file:///api/register"] wirklich raus), 3c (Reset-Feld nennt noch die 6).
//   (b) Backend mit abweichender Zahl (KEPLER_BACKEND_SERVER auf eine Kopie mit
//       PASSWORT_MIN = 6):                                        10 Pruefungen, 1 rot
//       4, mit dem sprechenden Beleg {"backend":6,"frontendErwartet":8}.
//
// Beide Male dieselben 10 Pruefungen wie am gruenen Stand (Regel 34). Und die Umleitung hat
// nachweislich GEGRIFFEN - eine still ignorierte Env-Variable saehe aus wie eine bestandene
// Gegenprobe (CLAUDE.md, Korrektur vom 15.08.2026): 3c las in (a) "mind. 6 Zeichen" aus der Kopie,
// die es in der echten Datei nicht mehr gibt.
//
// Gruen bleiben in (a) die Gegenrichtungen und Kontrollen: 0-aufbau, 2b, 3b, 4. 2b ("im
// Anmelde-Modus steht KEINE Zahl") ist dort trivial erfuellt, weil ueberhaupt keine Zahl gesetzt
// wurde - genau deshalb ist sie allein kein Beleg und steht neben 2.

const { starteBrowser, SPIEL_URL, SPIELDATEI, SERVER_JS, pruefer } = require('./lib/umgebung');
const fs = require('fs');

const MIN_ERWARTET = 8;
const { check, ende } = pruefer();

(async () => {
  const S = fs.readFileSync(SPIELDATEI, 'utf8');

  // ---------------------------------------------------------------------------------------
  // 4: PARITAET gegen das Backend. Bewusst ZUERST, weil sie keinen Browser braucht und der
  // teuerste Fehler dieser Aenderung ist - zwei Repos, die verschiedene Zahlen nennen.
  // ---------------------------------------------------------------------------------------
  if (!SERVER_JS) {
    // Kein stiller Uebersprung der GANZEN Datei: Der Rest misst das Frontend und laeuft weiter.
    // Ein Test, der sich selbst ueberspringt, ist keine Gegenprobe (Regel 22).
    check('4-vorab: server.js des Nachbar-Repos gefunden', false,
      'ohne das Nachbar-Repo bleibt die Paritaet ungeprueft - siehe Skill backend-abgleich');
  } else {
    const B = fs.readFileSync(SERVER_JS, 'utf8');
    const m = B.match(/const\s+PASSWORT_MIN\s*=\s*(\d+)/);
    check('4-vorab: PASSWORT_MIN steht in server.js', !!m,
      m ? undefined : 'ohne den Anker misst Pruefung 4 nichts (Regel 6)');
    if (m) {
      const backend = Number(m[1]);
      check('4: Frontend und Backend nennen DIESELBE Mindestlaenge',
        backend === MIN_ERWARTET, { backend, frontendErwartet: MIN_ERWARTET });
    }
  }

  // ---------------------------------------------------------------------------------------
  // 3b: die Vorpruefung ist wirklich nur eine LAENGENpruefung
  // ---------------------------------------------------------------------------------------
  // Wer hier spaeter eine Liste bekannter Passwoerter einbaut, erzeugt die zweite Wahrheit, die
  // dieser Test verhindern soll - und 19 kB in der Spieldatei. Gemessen an der Abwesenheit eines
  // Listen-Ankers im Registrier-Zweig.
  {
    const von = S.indexOf("if (loginMode === 'register'){");
    const bis = S.indexOf("const body = { username, password };", von > 0 ? von : 0);
    const zweig = (von >= 0 && bis > von) ? S.slice(von, bis) : '';
    check('3b-bereich: der Registrier-Zweig liess sich eingrenzen', zweig.length > 0,
      { von, bis });   // ohne den Anker waere die Aussage vacuous (Regel 6)
    check('3b: die Vorpruefung ist nur eine Laengenpruefung (keine Passwortliste im Frontend)',
      zweig.length > 0 && !/BEKANNTE_PASSW|passwoerter-bekannt|schwachePassw/i.test(zweig));
  }

  const browser = await starteBrowser();
  const seite = await browser.newPage();
  const fehlerAusKonsole = [];
  seite.on('pageerror', e => fehlerAusKonsole.push(String(e && e.message || e)));
  await seite.goto(SPIEL_URL, { waitUntil: 'domcontentloaded' });
  await seite.waitForTimeout(1200);

  const login = await seite.$('#loginPassword');
  check('0-aufbau: die Anmeldemaske ist da', !!login,
    login ? undefined : { konsole: fehlerAusKonsole.slice(0, 3) });
  if (!login) return ende(async () => browser.close());

  // ---------------------------------------------------------------------------------------
  // 2 / 2b: der Platzhalter folgt dem Modus
  // ---------------------------------------------------------------------------------------
  const platzhalter = async () => seite.$eval('#loginPassword', el => el.placeholder || '');

  // Anmelde-Modus ist der Startzustand.
  check('2b: im ANMELDE-Modus nennt das Passwortfeld KEINE Mindestlaenge',
    !/\d+\s*Zeichen/.test(await platzhalter()), { platzhalter: await platzhalter() });

  await seite.click('#registerTabBtn');
  await seite.waitForTimeout(150);
  {
    const p = await platzhalter();
    check('2: im REGISTRIER-Modus nennt das Passwortfeld die Mindestlaenge 8',
      new RegExp('mind\\.?\\s*' + MIN_ERWARTET + '\\s*Zeichen', 'i').test(p), { platzhalter: p });
  }

  // ---------------------------------------------------------------------------------------
  // 3: die WIRKUNG - ein zu kurzes Passwort wird gar nicht erst abgeschickt
  // ---------------------------------------------------------------------------------------
  // Gemessen wird die Wirkung, nicht das Etikett (Regel 61): Es genuegt nicht, dass eine
  // Fehlermeldung erscheint - es darf auch KEINE Anfrage an /api/register rausgehen. Genau das
  // unterscheidet eine echte Vorpruefung von einer Meldung, die der Server geschickt hat.
  {
    const anfragen = [];
    seite.on('request', r => { if (/\/api\//.test(r.url())) anfragen.push(r.url()); });

    await seite.fill('#loginUsername', 'Pruefkommandant');
    await seite.fill('#loginEmail', 'pruef@example.invalid');
    await seite.fill('#loginPassword', 'Ab3!xyz');           // sieben Zeichen
    const tos = await seite.$('#loginTosCheckbox');
    if (tos) await tos.check();
    await seite.click('#loginSubmitBtn');
    await seite.waitForTimeout(400);

    const meldung = await seite.$eval('#loginError', el => el.textContent || '');
    check('3: sieben Zeichen werden vom Frontend abgelehnt, und die Meldung nennt die 8',
      new RegExp('mindestens\\s*' + MIN_ERWARTET + '\\s*Zeichen', 'i').test(meldung), { meldung });
    check('3-wirkung: dabei geht KEINE Anfrage an den Server raus',
      anfragen.length === 0, { anfragen });
  }

  // ---------------------------------------------------------------------------------------
  // 3c: der Reset-Dialog nennt dieselbe Zahl
  // ---------------------------------------------------------------------------------------
  // Er ist ein EIGENES Feld mit eigenem Platzhalter - die Umschaltung aus 2/2b erreicht ihn nicht.
  // Beim Audit war das die einzige Frontend-Stelle, die ueberhaupt eine Laenge prueft; sie
  // deshalb mitzunehmen ist der ganze Punkt von Hausregel 6.
  {
    const p = await seite.$eval('#resetNewPassword', el => el.placeholder || '').catch(() => '');
    check('3c: das Reset-Feld nennt die Mindestlaenge 8',
      new RegExp('mind\\.?\\s*' + MIN_ERWARTET + '\\s*Zeichen', 'i').test(p), { platzhalter: p });
  }

  await ende(async () => browser.close());
})().catch(async e => {
  console.error('FAIL - Testlauf abgebrochen:', e && e.message ? e.message : e);
  process.exit(1);
});
