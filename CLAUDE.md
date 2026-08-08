# CLAUDE.md – kolonie-kepler7 (Frontend)

Browserbasiertes Weltraum-Kolonie-Idle-Spiel, komplett in **einer Datei** `weltraum_kolonie.html` (~56.400 Zeilen: HTML + CSS + Vanilla-JS in `<script>`, kein Build-Schritt, kein Framework). Deployt auf Saschas Raspberry Pi (nginx), erreichbar unter `gamegeeeeek.de` / `www.gamegeeeeek.de` per DynDNS (Domain-Offensive) – **nicht** über GitHub Pages (dort ist Pages deaktiviert, Stand 20.07.2026).

## Kritische Regel: zwei Dateien synchron halten

Der Pi-Deploy kopiert `weltraum_kolonie.html` (nicht `index.html`) ins Ausgabeverzeichnis. **Bei jeder Änderung müssen beide Dateien identisch sein** – am Ende jeder Session:
```
cp weltraum_kolonie.html index.html
```

## Vor jedem Commit (Pflicht, keine Ausnahme)

**Kurzform: `node tests/run.js`** – der Prüflauf im Repo führt die Punkte 1–4 automatisch aus und
danach alle Tests unter `tests/`. Exit-Code 0 heißt sauber. `node tests/run.js --nur-pflicht` macht
nur die schnellen Prüfungen (Sekunden statt Minuten). Details: `tests/README.md`.

Bis zum 25.07.2026 lagen die Tests ausschließlich im Sitzungs-Scratchpad unter `/tmp` und waren mit
dem Container weg – das Repo hatte **keinen einzigen Test**. Entsprechend verrottet waren die alten:
von 16 stichprobenartig gestarteten liefen nur 6. Was jetzt unter `tests/` liegt, ist bewusst
kuratiert (nur was nachweislich läuft und etwas prüft) und darf **nicht** wieder ins Scratchpad
abwandern – ein neuer Test gehört ins Repo, sonst gibt es ihn beim nächsten Mal nicht mehr.

1. **Syntax-Check**: `node -e "new Function(fs.readFileSync('weltraum_kolonie.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1])"`
2. **Icon-Whitelist-Check**: `node check-icons.js` ausführen (Exit-Code 0 = sauber). Prüft automatisch (a) alle `ti-*`-Verwendungen gegen die ~69 Icons des eingebetteten Icon-Fonts (Whitelist wird per Regex aus der Datei selbst gezogen, nie aus dem Gedächtnis geraten) und (b) alle nicht-`ti-*`-`icon:'X'`-Werte in den DEFS-Arrays gegen die Schlüssel des `ICONS`-Objekts. Eingeführt nach dem `ti-gift`-Bug (v8.77.1), der vor dem Commit nicht auffiel – das Skript macht genau diesen Fehlertyp jetzt automatisch sichtbar.
3. **JSDOM-Boot+Tab-Sweep**: Datei in jsdom laden, `runScripts:'dangerously'`, alle Tab-Buttons durchklicken, auf Konsolenfehler prüfen. Mit realistischem Spielstand (mehrere Kolonien inkl. Mond, aktive Forschung/Missionen) – ein leerer Spielstand übersieht Bugs, die erst bei voller Array-Traversierung auftreten.
4. **VERSION-Konstante erhöhen + neuer PATCHNOTES-Eintrag** (deutsch). Patchnotes-Einträge sind unveränderliche Historie – nie rückwirkend editieren, auch wenn sie veraltete Zahlen zeigen. **Danach `node build-patchnotes.js` ausführen** – das erzeugt die öffentliche `patchnotes.html` neu (Startseite verlinkt sie im Kopfmenü und in der Fußzeile). Die Seite wird nie von Hand bearbeitet; sie zieht ihren Inhalt aus dem PATCHNOTES-Array der Spieldatei, damit es keine zweite Liste gibt, die veraltet. `tests/test_patchnotesseite.js` schlägt an, wenn die Seite hinterherhinkt, und prüft nebenbei **alle** `href="*.html"` der Spieldatei gegen den tatsächlichen Dateibestand – genau daran fiel auf, dass `patchnotes.html` von zwei Stellen verlinkt war, aber nie existierte.
5. Bei Mechanik-/Balance-Änderungen: **HELP_SECTIONS und TUTORIAL_STEPS** live-Texte mit aktualisieren (nicht die Patchnotes-Historie).
6. **Nach jeder Mechanik-Änderung ALLE Anzeigestellen derselben Größe suchen, nicht nur die eine, die man gerade im Kopf hat.** Der wiederkehrende Fehler dieses Projekts ist nicht die kaputte Mechanik – die stimmte jedes Mal –, sondern eine **zweite Anzeigestelle, die die alte Annahme behielt**. Vier Belege in einer einzigen Session (25.07.2026): (a) die PvP-Angriffsvorschau urteilte noch binär („erfolgversprechend"/„aussichtslos"), obwohl der Kampf seit v8.295.0 in drei Phasen mit 10–90%-Deckel läuft – die NPC-Vorschau war längst umgestellt, PvP nicht; (b) direkt daneben hatte das Bedrohungs-Banner eigene Schwellen und konnte der Vorschau widersprechen; (c) der Hilfe-Abschnitt „Kampfphasen" nannte nur die 5%/95% der NPC-Kämpfe; (d) 15 Event-Texte schickten Spieler auf Erkundungen, obwohl die Teile nur auf Expeditionen fallen. Konkretes Vorgehen: nach dem Umbau **erst greppen, dann committen** – nach dem Namen der geänderten Funktion/Konstante (`grep -n "battleWinChance\|PHASE_CHANCE"`), nach den Wörtern, mit denen die Größe dem Spieler präsentiert wird (Chance, Prozent, „%", Verdikt-Formulierungen), und nach den Grenzwerten als Literal („95%", „5%"). Jede Fundstelle einzeln prüfen: sagt sie noch die Wahrheit? Betroffen sind erfahrungsgemäß Vorschau, Banner/Kurzurteil, Bericht, HELP_SECTIONS, TUTORIAL_STEPS und die `desc`-Texte der DEFS-Arrays.
7. **Jeder neue Inhalt braucht Icon UND vollständige Beschreibung (Pflicht, keine Ausnahme).** Wird irgendetwas Neues hinzugefügt – Forschung (`RESEARCH_DEFS`), Gebäude (`BUILDING_DEFS`), Schiff (`SHIP_DEFS`/Superschiffe), Modul, Offizier, Doktrin, Event, Item usw. –, gehört von Anfang an dazu: (a) ein **eigenes Icon** (handgezeichnetes SVG in `ICONS`/`RES_ICONS`/`SHIP_HULL_DEFS` per Key, oder ein gültiges `ti-*`-Icon aus der 69er-Whitelist; der `iconHtmlFor`-Fallback auf `ti-flask` ist nur Notnagel, kein Ersatz) **und** (b) eine **vollständige, selbsterklärende `desc`/`effectDesc`** – ein ganzer Satz, der Wirkung und ggf. Stapelverhalten/Deckel nennt (Vorbild: `rexpedition`), **nicht** nur ein knapper Kürzel-Text wie „Lagerkapazität (vertieft)" (Spieler-Report 22.07.2026: das las sich wie eine fehlende Beschreibung). Nach dem Einfügen prüfen: `node check-icons.js` (Icon) und einen Render-Blick auf die Karte (Beschreibung erscheint vollständig).

## Arbeitsregeln aus gemachten Fehlern (05.–06.08.2026, auf Wunsch von Sascha festgehalten)

Jede dieser Regeln ist die Destillation eines Fehlers, der in diesen zwei Tagen WIRKLICH passiert
ist. Sie gelten ab sofort, nicht als Empfehlung. **Diese Liste ist fortlaufend**: Wer (auch in
künftigen Sitzungen) einen eigenen Fehler macht, der eine übertragbare Regel hergibt, trägt ihn
hier nach – mit dem konkreten Vorfall als Beleg, nicht als Allgemeinplatz.

**Tests:**
1. **Jeder neue Test braucht eine Gegenprobe, und sie wird in BEIDE Richtungen ausgeführt** –
   grün am neuen Stand, rot am alten (per `git show HEAD:datei` oder gezielt kaputtgemachter
   Kopie). Der Prestige-Test war DREIMAL hintereinander scheinbar grün, ohne irgendetwas zu
   belegen: Knopf hieß „Zurücksetzen" statt „Prestige" (kein Klick, kein Reset, „hat überlebt"
   bestand trivial), dann Knopf disabled (Testspielstand unter der Punktschwelle), dann fehlte der
   Klick auf die Bonus-Auswahl, die den Reset erst schreibt. Aufgefallen ist alles NUR an der
   Gegenprobe.
2. **Gegenproben vergleichen gegen den GEMESSENEN Ausgangsstand, nie gegen eingetippte Zahlen.**
   Die Prestige-Gegenprobe verglich gegen feste `28`/`8` und wurde selbst wertlos, als der
   Spielstand angehoben wurde – sie meldete „zurückgesetzt", obwohl nichts geschehen war.
3. **Tests prüfen die REGEL, nicht die Momentaufnahme.** `test_recycler_sammelauftrag` verglich
   eine Rückgabezeile Zeichen für Zeichen und schlug an, sobald ein weiterer Summand dazukam –
   obwohl die geprüfte Eigenschaft unverändert galt. Richtig: prüfen, dass der Term Teil des
   Rückgabewerts IST, egal was sonst noch dort steht.
4. **Fixture-Schlüssel und Bediennamen aus dem Code ablesen, nie raten.** Erfunden wurden:
   Unter-Reiter `'rangliste'` (heißt `'rang'`; bei unbekanntem Schlüssel blendet die Anzeige stur
   ALLE Panels aus), Knopftext „Prestige" (heißt „Zurücksetzen"), Funktionsname
   `zeichneSchiffsIcons` (heißt `refreshShipMiniIcons`). Vor Benutzung: `grep`.
5. **`document.querySelector` in Tests IMMER auf den Container beschränken.** Die
   `data-atksel-*`-Knöpfe existieren doppelt (alte Box UND Overlay); der ungescopte Selektor traf
   die Box, änderte den GEMEINSAMEN Zustand, und das Overlay stand scheinbar still – der Test
   verglich zweimal denselben Stand und schien zu beweisen, die Vorschau sei tot.
6. **Ein Slice mit `indexOf`-Endanker prüft zuerst, dass der Anker EXISTIERT.** Fehlt er (genau
   der Fall im alten Stand, gegen den der Test anschlagen soll), liefert `indexOf` −1, der Slice
   läuft fast bis zum Dateiende, und die Prüfung wird vacuous. Ebenso: `lastIndexOf` statt
   `indexOf`, wenn ein KOMMENTAR denselben Text zitieren könnte wie der Code.
7. **Messen, was gemessen werden soll – nicht den Deckel.** Ein Testspielstand mit kleinem Lager
   maß den Lagerdeckel statt der Offline-Nachholung (Endstand landete exakt auf der Kappe, jeder
   weitere Sprung ergab zwangsläufig 0). Erwartungswerte aus dem Spiel ableiten (Rate messen),
   nicht raten; Zeitachse ist `lastTick` aus dem Spielstand, nicht die Wanduhr des Tests.
8. **Eingefrorene Tabs simuliert man, indem man NUR `Date.now()` vorstellt** – nie die Uhr-Hilfen
   des Browsertreibers (die feuern versäumte Timer nach und heilen das Spiel künstlich) und nie
   per Proxy um `Date` (Endlosrekursion, und die Doppelgutschrift-Prüfung war dadurch scheinbar
   grün, weil nie etwas gutgeschrieben wurde).
9. **Erwartungen im Test mitziehen, wenn sich der Testablauf ändert.** Nach Umbau des Ablaufs auf
   „nur Kreuzer wählen" prüfte die Endkontrolle noch auf die Jäger des alten Ablaufs – der Test
   fiel auf korrektem Code durch.

**Befunde und Auslieferung:**
10. **Befunde von Hilfsläufen erst am Code verifizieren, DANN weitergeben.** Zwei als
    „Hausregel-Verstoß" gemeldete Funde (`exoticFpProdMult` als rohe Multiplikation, fehlender
    Boden bei `tiefenraum`) hielten der Nachprüfung nicht stand – die ganze FP-Kette ist bewusst
    multiplikativ, und der Boden fehlt nur bei Termen, die mit Stufenzahlen skalieren. Beides war
    an Sascha schon weitergegeben und musste zurückgenommen werden. Ebenso prüfen, ob ein Melder
    die veraltete `index.html` statt `weltraum_kolonie.html` gelesen hat (Zeilennummern passen
    dann auf die falsche Datei).
11. **Patchnotes sind Versprechen – Behauptungen darin vorher messen.** Der Eintrag zu v8.418.0
    versprach, die Erkennungsschwelle liege „hoch genug" – sie lag bei 90 s und damit ÜBER dem
    Takt, in dem Browser gedrosselte Tabs wecken (~60 s); der eigene Patchnote-Eintrag war eine
    Stunde später die „zweite Anzeigestelle mit der alten Annahme".
12. **Bei jeder neuen Schwelle beide Seiten durchdenken: Was passiert KNAPP DARUNTER – und wirft
    der Zweig darunter Zustand weg?** Die 90-s-Schwelle mit bedingungslosem
    `lastTick = Date.now()` darunter löschte dauerhaft 59 von 60 Sekunden (gemessen 1,5 %).
    Eine Schwelle entscheidet den Rechenweg, nie, ob Zeit/Zustand zählt. Und die Gegenrichtung
    mitprüfen: dieselbe Behebung schrieb zunächst eine Sekunde je Nachholung DOPPELT gut (+1,7 %).
13. **Nach einem Squash-Merge ist ein später aus der Oberfläche erzeugter PR desselben Branches
    ein DUPLIKAT** – vor dem Mergen `git diff origin/master <branch>` prüfen; ist er leer,
    schließen statt mergen (passiert bei Backend-PR #79).

**Arbeitsumgebung:**
14. **Während `node tests/run.js` läuft, die Spieldatei NICHT anfassen** – die Tests lesen sie
    live; committed wird erst nach grünem Ergebnis (der Merge ist seit dem Webhook die
    Auslieferung selbst).
15. **Auf das Suite-Ende über eine Marker-Zeile warten (`EXIT=` in der Log-Datei), nicht per
    `pgrep`** – das eigene Warte-Kommando enthält den Suchbegriff und meldet ewig „läuft".
    Kein `pkill` mit breitem Muster: es traf die eigenen Wartejobs und einmal die eigene Shell
    mitsamt dem anstehenden Commit (Exit 144).
16. **Python-Ersetzskripte brechen bei `count != 1` ab, bevor sie schreiben** – genau das hat
    einen stillen Fehlgriff verhindert, als das Veteranen-Icon-Markup anders aussah als erwartet.
    Dieses Muster beibehalten.
17. **Einen Suite-Lauf über seine Task-ID und Logdatei verfolgen und VOR jedem Edit an der
    Spieldatei gezielt diesen einen Lauf beenden – nie den Zustand per `pgrep` auf den Befehlstext
    „bestätigen".** Vorfall 07.08.2026: Nach einem Fehlschlag wurde der falsche (längst beendete)
    Hintergrund-Lauf gestoppt und die Spieldatei editiert, während der eigentliche Lauf noch las –
    dessen Restergebnis war damit wertlos, und zeitweise liefen ZWEI Suiten parallel (Playwright-
    Flake-Risiko durch Ressourcenkonkurrenz). Verschärfend meldete `pgrep -f "node tests/run.js"`
    in beide Richtungen Falsches: Es traf den EIGENEN alten Warte-Job (dessen Kommandozeile den
    Suchtext enthält) und meldete „läuft" nach dem Stopp bzw. lieferte dessen PID für ein `kill`.
    Das ist derselbe Mechanismus wie in Regel 15, nur auf Prozess- statt Log-Ebene – wer wissen
    will, ob die Suite lebt, prüft die Marker-Zeile ihrer Logdatei oder `ps` nach echten
    `node`-Prozessen, nie ein Muster, das die eigenen Werkzeuge selbst enthalten.

## Icon-Font ist ein SUBSET (seit v8.296.0)

Der eingebettete Icon-Font enthält **nur die 69 tatsächlich verwendeten Icons** (10,8 KB), nicht mehr den kompletten Tabler-Font (446,7 KB / 5.071 Glyphen). Das spart bei jedem Seitenaufruf rund ein Drittel der Übertragung (gzip 1.345 KB → 919 KB), weil Base64 um ein Drittel aufbläht und WOFF2 als bereits komprimiertes Format von gzip kaum noch profitiert.

**Ein neues `ti-*`-Icon einzubauen reicht deshalb NICHT mehr aus** – der Glyph fehlt dann schlicht im Font, `check-icons.js` schlägt an. Vorgehen:

1. CSS-Regel in `weltraum_kolonie.html` ergänzen: `.ti-neuesicon:before { content: "\eXXX"; }` (Codepoint aus der Tabler-Webfont-CSS)
2. `node build-icon-subset.js` ausführen – baut den Font neu und aktualisiert **beide** HTML-Dateien
3. `node check-icons.js` zur Kontrolle

Das Skript zieht die Icon-Liste **aus der Spieldatei selbst** (alle `.ti-*:before`-Regeln), es gibt also keine zweite Liste, die veralten könnte. Quelle ist das mitversionierte `tabler-icons-full.woff2` – bewusst im Repo und **nicht** per npm nachgeladen, weil eine andere Tabler-Version still abweichende Glyphen liefern könnte. Abhängigkeit: `pip install fonttools brotli`.

## Bekannte Fallstricke

- **Doppelte Funktionsdeklarationen**: JS überschreibt bei zwei `function name(){}` mit demselben Namen stillschweigend die erste mit der zweiten – bei dieser Dateigröße schon einmal passiert (`renderWorldBoss` existierte zweimal, die spätere/falsche gewann). Vor Änderungen an einer Funktion: `grep -n "function funktionsname"` prüfen, dass es nur eine Definition gibt.
- **Naive Regex über die ganze Datei** kann an verschachtelten `]`/`}` in Array-Literalen falsch terminieren. Immer mit `grep -n` auf konkrete Zeilennummern verifizieren, nicht blind einer Regex vertrauen.
- **Nach Bulk-Einfügen in Arrays** (PLANETS, RESEARCH_DEFS etc.): Regex-Check auf `,\s*,` (doppeltes Komma ist gültiges JS, crasht aber `Array.find()`).
- **Neue Box mit `<input>`/`<textarea>`**, die von einem wiederkehrenden Trigger (Haupt-Tick, `setInterval`) neu gerendert wird: braucht von Anfang an `isTypingIn('boxId')`-Schutz, sonst verliert das Feld beim Tippen den Fokus.
- **Jeder Bedienzustand, der NUR im DOM steckt, überlebt das Neuzeichnen nicht.** Der Haupt-Tick schreibt Boxen jede Sekunde per `innerHTML` neu – alles, was der Browser selbst verwaltet und was nicht im erzeugten HTML wieder mitgeschrieben wird, ist danach weg. Drei Ausprägungen, alle am 25.07.2026 als echte Spielerfehler aufgetreten: (a) **`<details>`** klappte nach einer Sekunde von selbst wieder zu (gesperrte Event-Schiff-Karten, Allianzbasis-Ausbaustufen, Teilnehmerlisten) → `data-keep-open="<schlüssel>"` + `detailsOpenAttr()`; (b) **`<select>`** sprang auf die erste Option zurück – beim Allianz-Raid sogar folgenschwer, weil der Startknopf `sel.value` erst im Moment des Klicks liest und der Raid dadurch still mit der Vorgabedauer statt der gewählten startete → `data-keep-value="<schlüssel>"` + `selectedAttrFor()`; (c) **waagerechte Scrollposition** der Wischleisten → `setHtmlPreservingScroll()` statt `innerHTML =` (bereits überall angewandt, wo `data-hscroll` mit Schlüssel vorkommt). `isTypingIn()` hilft hier nur halb: Es greift ausschließlich, solange das Element den Fokus hat – sobald man wegklickt, ist der Zustand wieder verloren (genau so war der Musterangriff-Fehler verdeckt). Beim Bau einer neuen Box also von Anfang an fragen: **Kann der Spieler hier etwas einstellen, das nirgends im erzeugten HTML wieder auftaucht?**
- **BUILDING_DEFS mit `category:'defense'`**: `defVal`/`atkVal` müssen explizit gesetzt sein (mind. `0`), sonst kippt die globale Verteidigungsberechnung auf `NaN` (kein `||0`-Fallback an der Summierstelle).
- **"N Minuten eigene Produktion" als Belohnungsformel** taucht mehrfach auf (Piratennester, Fraktionsgeschenke, Wochenliga, Tagesaufgaben) – bei starker Wirtschaft schnell explosiv. Bei neuen Belohnungsmechaniken diesem Muster bewusst ausweichen oder hart deckeln.
- **Additive+gedeckelte Bonus-Gruppen statt reiner Multiplikation**: Produktion UND Kampfkraft nutzen bewusst `1 + Math.min(1.0, summe_kleiner_boni)` statt `×1.1×1.15×1.2×…`, um explosionsartiges Aufschaukeln vieler kleiner Boni zu verhindern. Neue "kleine, stapelnde" Boni gehören in diese Gruppe, nicht als eigene Multiplikation.
- **Backend-`saveSanityViolation` kann das Speichern KOMPLETT einfrieren (Vorfall 21.07.2026, mehrere Stunden Fehlersuche)**: Der Backend-Endpunkt `PUT /api/storage/kepler7-save-v3` (`server.js`) lehnt den GESAMTEN Spielstand mit **HTTP 400** ab, sobald EIN Zahlenfeld die `SAVE_SANITY_LIMITS` übersteigt (oder NaN/Infinity/negativ ist). Passiert das dauerhaft, wird **gar nichts mehr gespeichert** und jeder Reload lädt den letzten akzeptierten Stand → Symptom beim Spieler: „**immer 8 Std. offline / Tagesbonus, Bauqueue und Forschung wie zurückgesetzt / immer derselbe Kampfbericht** bei jedem Reload". Betrifft nur weit entwickelte Konten, daher extrem schwer zu reproduzieren. Konkrete Ursache: `maxBuildingLevel`/`maxResearchLevel` waren **60**, `maxCredits` **1e8** – von Langzeit-Konten real überschritten. **Regeln daraus:** (1) Das Frontend darf eine Nicht-OK-Save-Antwort (v.a. 400) **NIE still verschlucken** – seit v8.187.0 meldet `saveGameStateVersioned`/`notifySaveRejected` das laut (Log + Toast); dieses Verhalten nicht wieder entfernen. (2) Wer im Spiel neue **speicherbare Zahlenfelder** einführt oder **Level-/Ressourcen-/Kredit-Obergrenzen anhebt**, MUSS gleichzeitig prüfen, dass die Backend-`SAVE_SANITY_LIMITS` klar darüber liegen (aktuell großzügig: Gebäude/Forschung 10000, Kredite 1e12, Schiffe 1e9, Ressourcen 1e15, XP 1e14). (3) Ablehnungen werden serverseitig als `[save-reject] userId=… reason=…` geloggt – bei Save-Problemen zuerst `docker logs` des Backends prüfen.

## Architektur-Kurzüberblick

- Ein einziges `state`-Objekt, per `save()`/localStorage bzw. Server-Sync persistiert
- Backend-Kommunikation optional (`useBackend()`) – Solo-Modus funktioniert ohne Server, Allianzen/Markt/Weltboss brauchen ihn
- Geteilter Speicher (Allianzen, Markt, Weltboss) läuft über generische `storageGet/storageSet/storageList`-Aufrufe gegen das Backend, mit Schlüsselpräfixen wie `alliance:<TAG>:...`
- Rendering: kein virtuelles DOM, direktes `innerHTML`-Neuschreiben pro Box, getriggert vom Haupt-Tick (1×/Sekunde) und bei Nutzeraktionen
- **Signatur-Cache-Muster für `render*Box()`-Funktionen ohne Live-Countdown**: `let lastXSig = null;` vor der Funktion, am Anfang eine Signatur aus allen angezeigten Werten bilden, bei Gleichheit zum Vorlauf `return` statt `innerHTML` neu zu schreiben (Beispiele: `renderAllianceBaseHero`, `renderDominance`, `renderGalaxyNews`, `renderReportsBox`, `renderAllianceTitlesBox`/`renderAllianceSkinsBox`, `renderDailyLoginBox`, `renderFpAllianceDonation`, `renderFpLeaderboard`). **Nur anwenden, wenn die Box KEINEN Live-Countdown (`Date.now()`-Differenz, die sichtbar hochzählt) enthält** – sonst würde die Anzeige sichtbar einfrieren (bewusst NICHT angewendet auf `renderAutoExploreTourBox`, `renderAbhorchpostenBox`, `renderFactions`/`renderMarket`/`renderTradeRoutes`, die stattdessen `isTypingIn()` nutzen). Neue `render*Box()`-Funktionen ohne Countdown sollten dieses Muster von Anfang an übernehmen statt jeden Tick blind neu aufzubauen.
- **`setBoxHtml(box, schluessel, html)` – die Variante mit MARKUP-Signatur (seit v8.310.0)**, für große Listen, die im Haupt-Tick per `innerHTML` neu geschrieben werden. Statt einer Wertliste ist die Signatur das fertige Markup. Zwei Folgen: (a) Sie kann nicht unvollständig sein – kein neu hinzugekommenes Anzeigefeld kann sie stillschweigend veralten lassen, was bei einer Wertliste die typische Falle ist; (b) **die Countdown-Einschränkung von oben gilt hier NICHT** – läuft ein Countdown, ist das Markup jede Sekunde ein anderes und die Box wird neu geschrieben, läuft keiner, steht sie still. Die Prüfung ist selbstkorrigierend. Der Aufbau der Zeichenkette ist billig; teuer sind `innerHTML` und die anschließenden `querySelectorAll`-Verdrahtungsläufe, und genau die entfallen. Angewandt auf `#research` (73,9 kB), `#buildings` (27,7 kB), `#defenseBuildings` (21,3 kB), `#planetRoleBox` (3,9 kB) – zusammen rund 127 kB Markup pro Sekunde. `childElementCount` als zweite Bedingung im Helfer: Räumt irgendwer die Box von außen leer, muss der Neuaufbau trotz gleicher Signatur laufen. **Vor jeder neuen Anwendung prüfen, WO die Klick-Handler gesetzt werden**: Laufen sie im selben Zweig wie das Schreiben (wie bei den Modul-Boxen), sind sie nach einem übersprungenen Tick nicht neu gesetzt – das geht gut, weil die alten Knoten samt Handler stehen bleiben, muss aber getestet werden (`tests/test_modulbox_cache.js`, `tests/test_listen_cache.js` klicken beide nach mehreren übersprungenen Sekunden). **Messen statt schätzen**: Welche Box wirklich jeden Tick neu geschrieben wird, zeigt ein `MutationObserver` auf `document.body` mit `childList:true, subtree:true`, der die Treffer je Ziel-Element zählt – die statische Suche nach `render*`-Funktionen übersieht die großen Listen, weil die gar keine eigenen Funktionen sind, sondern inline im Haupt-Tick stehen.
- **Sichtbarkeits-Gate für reines Anzeige-Polling**: `setInterval`s, die nur Daten zum ANZEIGEN nachladen (Bestenliste, Berichte, Nachrichten, Galaxie-Zustand, Allianzbasis-Kriegszustand/Spenden-Rangliste, Versions-Check), prüfen `document.visibilityState === 'visible'`, bevor sie feuern – spart Server-Anfragen/Akku im Hintergrund-Tab. **Bewusst NICHT** auf Timer mit echter Spielmechanik angewendet (`maybeScheduleRaid`, `maybeSchedulePirateDebrisRaid`, `maybeSpawnVoidRift`, `maybeSpawnTrader`, `refreshAllianceMusterAttack`) – deren Timing soll auch im Hintergrund-Tab real weiterlaufen.

## Proaktive Vorschläge

Der Nutzer möchte am Ende einer Session bzw. auf Nachfrage aktiv auf weitere Optimierungs- und Verbesserungsmöglichkeiten hingewiesen werden – sowohl Code/Performance (z. B. weitere `render*Box()`-Kandidaten für das Signatur-Cache-Muster, weitere reine Anzeige-`setInterval`s für das Sichtbarkeits-Gate, doppelte/tote Funktionen) als auch Grafik/Spielinhalt. Nicht nur auf explizite Nachfrage warten, sondern von sich aus konkrete, im Code begründete Vorschläge einbringen (nicht spekulativ – vor dem Vorschlagen kurz grep/lesen, um zu bestätigen, dass es sich wirklich lohnt).

## Deploy

**Ein Push nach `main` geht von selbst live** (verifiziert 05.08.2026 am Container-Log des Pi und am Quelltext). Bis dahin stand hier „live geht es erst, wenn Sascha manuell zieht" – das war überholt und hat zu falschen Auskünften geführt.

Der Weg: GitHub ruft nach jedem Push den **Deploy-Webhook** des Backends auf (`POST /api/deploy-webhook`, `server.js:6297`, abgesichert per HMAC-SHA256 gegen `DEPLOY_WEBHOOK_SECRET`). Der Repo-**Name** aus dem Payload wählt einen von zwei **fest verdrahteten** Befehlen aus `DEPLOY_TARGETS` – nie etwas aus dem Request-Body, das schützt gegen Command-Injection:

```
'kolonie-kepler7'         → cd /deploy/kolonie-kepler7 && git pull -q && cp -f *.html /deploy/web/ && (cp -f *.png /deploy/web/ || true) && (cp -f robots.txt sitemap.xml /deploy/web/ || true) && (cp -f manifest.json service-worker.js /deploy/web/ || true)
'kolonie-kepler7-backend' → cd /app && git pull -q && (chown -R 1000:1000 .git || true)
```

Der Webhook feuert bei **jedem** Push, auch auf Feature-Branches; dort findet der `git pull` auf dem ausgecheckten `main` schlicht nichts (`Deploy-Webhook erfolgreich für kolonie-kepler7: (keine Änderungen)`). Erst der Merge nach `main` liefert wirklich aus. **GitHub Pages** ist weiterhin nicht aktiviert (Settings → Pages: Source = „None") und deployt nichts.

Zwei Folgen daraus, beide am 05.08.2026 als echte Probleme aufgetreten – und noch am selben Tag behoben (Backend-PR #78). Sie bleiben hier stehen, weil beide Male die Symptome schwer zuzuordnen waren:

- **Die Kopierliste war von Hand gepflegt und deshalb unvollständig.** Kopiert wurden nur `weltraum_kolonie.html`, `manifest.json`, die Icons und `service-worker.js` – **nicht** `index.html`, **nicht** `patchnotes.html`, und keine der übrigen Seiten. Von den acht Seiten, die die Spieldatei verlinkt, war im Ausgabeverzeichnis keine einzige vorhanden; bei Impressum und Datenschutzerklärung ist das eine Pflichtangabe, kein Schönheitsfehler. **Behoben:** `DEPLOY_WEB_COPY` kopiert jetzt pauschal `*.html`, `*.png`, `robots.txt`, `sitemap.xml`, `manifest.json` und `service-worker.js`, statt eine Liste zu pflegen, die wieder veralten kann. Was wirklich ausgeliefert wird, zeigt `docker exec kepler7-nginx ls -la /usr/share/nginx/html/` (an den Zeitstempeln sieht man, welche Dateien stillstehen).
- **Der Backend-Pull lief als root und sperrte Sascha aus.** `/app` **ist** per Bind-Mount `/DATA/kepler7/backend`, und der Container läuft als root. Jeder Backend-Push legt damit root-eigene Objekte in `.git/objects` an; ein danach von Hand ausgeführtes `git`/`git stash` scheitert an „Unzureichende Berechtigung zum Hinzufügen eines Objektes zur Repository-Datenbank .git/objects". Bricht so ein Webhook-Pull mitten im Merge ab, bleiben zusätzlich `HEAD.lock`/`AUTO_MERGE.lock` und ein halb angewendeter, **vorgemerkter** Stand liegen – dann ist `git diff` leer (zeigt nur Nicht-Vorgemerktes), `git checkout -- server.js` wirkungslos (holt aus dem Index zurück, nicht aus HEAD), und der Pull bricht dauerhaft ab. Aufräumen:
  ```
  sudo chown -R sascha:sascha /DATA/kepler7/backend
  cd /DATA/kepler7/backend && rm -f .git/*.lock && git merge --abort 2>/dev/null; git stash && git pull origin master
  ```
  **Behoben:** Seit dem 05.08.2026 hängt `(chown -R 1000:1000 .git || true)` fest im Backend-Deploy-Befehl – der nächste Push erzeugt die root-eigenen Objekte zwar weiterhin, gibt sie aber sofort wieder frei. Das obige Aufräumen bleibt nur für Altlasten oder einen mittendrin abgebrochenen Pull nötig. Numerisch und nicht per Name, weil der Container den Benutzer nicht kennt; uid/gid 1000 ist Sascha. **Nie `sudo git …` auf dem Pi ausführen**, das verschlimmert es nur.

### Pi-Laufzeit-Setup (Docker) und TLS-Zertifikat

Der „nginx auf dem Pi" ist **kein systemd-nginx**, sondern läuft als **Docker-Container** (Vorfall 21.07.2026 – Zertifikat deckte nur `gamegeeeeek.de`, nicht `www.` → `NET::ERR_CERT_COMMON_NAME_INVALID` auf www). Wichtige Fakten für künftige Zertifikats-/Deploy-Fragen:

- **Container**: `kepler7-nginx` (Image `nginx:alpine`) bedient 80+443; `kepler7-backend` ist das Node-Backend (nginx proxyt `/api/` intern auf `http://kepler7-backend:3001/api/`). Ein **systemd-`nginx`** existiert auf dem Host nur als Altlast und ist bewusst **deaktiviert** (`systemctl disable --now nginx`) – ihn zu starten scheitert an „Address already in use", weil Docker die Ports hält. **Nicht** versuchen, den systemd-nginx zu benutzen.
- **Host-Mounts des nginx-Containers**: `/DATA/kepler7/certbot/conf → /etc/letsencrypt` (**hier liegen die Zertifikate**), `/DATA/kepler7/certbot/www → /var/www/certbot` (ACME-Webroot), `/DATA/kepler7/nginx/nginx.conf → /etc/nginx/conf.d/default.conf`, `/DATA/kepler7/web → /usr/share/nginx/html` (die Spieldateien).
- **Das Zertifikat MUSS immer BEIDE Domains abdecken**: `gamegeeeeek.de` **und** `www.gamegeeeeek.de` (Canonical/OG-Tags, sitemap.xml, robots.txt zeigen alle auf `www.` als kanonische Domain). Zertifikats-Linie heißt `gamegeeeeek.de` (`live/gamegeeeeek.de/`); die `ssl_certificate`-Pfade in der nginx.conf zeigen dorthin.
- **Neu ausstellen/erweitern** (downtime-frei, Webroot-Challenge über den laufenden Container – **kein** nginx.conf-Edit nötig, `--cert-name` hält die Linie stabil):
  ```
  docker run --rm -v /DATA/kepler7/certbot/conf:/etc/letsencrypt -v /DATA/kepler7/certbot/www:/var/www/certbot certbot/certbot certonly --webroot -w /var/www/certbot --cert-name gamegeeeeek.de -d gamegeeeeek.de -d www.gamegeeeeek.de --expand --non-interactive --agree-tos -m luftsascha@icloud.com
  docker exec kepler7-nginx nginx -s reload
  ```
  (Vorher risikofrei mit `--dry-run` testen.) Prüfen: `echo | openssl s_client -connect www.gamegeeeeek.de:443 -servername www.gamegeeeeek.de 2>/dev/null | openssl x509 -noout -text | grep -A1 "Subject Alternative Name"` → beide DNS-Namen müssen erscheinen.
- **Auto-Erneuerung** läuft per root-crontab (`certbot renew --quiet` im certbot-Container mit denselben Volumes, danach nginx-Reload/Restart). `certbot renew` nutzt die gespeicherte Renewal-Config und erneuert damit automatisch **beide** Domains – die `-d`-Namen nicht erneut angeben.
- Der Host `certbot.timer` (systemd) ist eine **harmlose Altlast** und kennt die Docker-Volume-Zertifikate nicht – ignorieren.

**PRs sofort mergen**: Offene PRs nach dem Push ohne Rückfrage direkt mergen (nicht als Draft offen lassen) – sonst landen Änderungen nicht auf `main`. Gilt für Frontend- und Backend-Repo gleichermaßen. **Seit der Webhook bekannt ist, wiegt das schwerer als gedacht**: Der Merge ist nicht bloß ein Zwischenschritt zu einem späteren manuellen Deploy, sondern die Auslieferung selbst – was gemerged wird, steht Sekunden später auf `gamegeeeeek.de`. Der Prüflauf (`node tests/run.js`, grün) ist deshalb keine Formalie, sondern das einzige, was zwischen einer Änderung und den Spielern steht.
