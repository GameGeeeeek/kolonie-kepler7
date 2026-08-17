# CLAUDE.md – kolonie-kepler7 (Frontend)

Browserbasiertes Weltraum-Kolonie-Idle-Spiel, komplett in **einer Datei** `weltraum_kolonie.html` (~56.400 Zeilen: HTML + CSS + Vanilla-JS in `<script>`, kein Build-Schritt, kein Framework). Deployt auf Saschas Raspberry Pi (nginx), erreichbar unter `gamegeeeeek.de` / `www.gamegeeeeek.de` per DynDNS (Domain-Offensive) – **nicht** über GitHub Pages (dort ist Pages deaktiviert, Stand 20.07.2026).

## Lokale KI-Infrastruktur (GameGeeeeek AI Hub)

Seit 16.08.2026 ist der komplette Quelltext dieses Repos (plus Backend und Social Hub) in
einer lokalen RAG-Wissensbasis auf Saschas M715q indexiert. Fragen wie „wo wird der
Kampfbericht erzeugt?" lassen sich darüber beantworten, ohne die 60.000-Zeilen-Datei in
einen Prompt zu kopieren – `POST /kepler/ask` gegen AI Core (`192.168.178.45:8000`),
Antwort kommt mit Datei- und Zeilenangabe.

**Wichtig:** Der Index veraltet mit jedem Release. Nach größeren Änderungen an
`weltraum_kolonie.html` gehört ein erneuter Ingestion-Lauf dazu (Befehl in
`gamegeeeeek-ai-core/README.md`) – eine Automatisierung dafür steht noch aus.

Gesamtbild, Roadmap und was als Nächstes gebaut wird (Coding Agent, Test Agent, Game
Designer, KI-Kampfberichte, Mission Generator, NPCs, Wiki-Assistent):
**`gamegeeeeek-ai-core/docs/AI-HUB-ROADMAP.md`**. Die dort geplanten Kepler-Agenten
verändern langfristig, wie an diesem Repo gearbeitet wird – vor größeren Vorhaben lohnt
ein Blick.

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

**Und nicht nur Fehler (ausdrücklicher Wunsch von Sascha, 16.08.2026: „Speichere alles immer in
Claude md"):** Auch Architektur-Entscheidungen, neue Muster und der jeweils gültige Stand größerer
Umbauten gehören NOCH IN DERSELBEN SESSION hierher – nicht erst auf Nachfrage. Was nur im
Sitzungsverlauf steht, ist mit dem Container weg; diese Datei ist das Gedächtnis des Projekts
(genau so, wie die Tests seit dem 25.07.2026 ins Repo gehören statt ins Scratchpad).

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

    **Nachtrag 15.08.2026 – derselbe Squash, anderer Schaden: ein Patch gegen die falsche Basis.**
    Beim Umsetzen einer Änderung auf einen inzwischen weitergelaufenen `main` wurde der eigene
    Änderungssatz als `git diff <main-Commit> HEAD` gebildet. Das sieht richtig aus und ist es
    nicht: Der Eltern-Commit der eigenen Arbeit war ein **lokaler** Commit mit gleichem Inhalt, der
    gesquashte auf `main` ein anderer – und **dazwischen lag eine fremde Auslieferung** (v8.500.0
    „Detailtafel"), die beim Blick auf nur den obersten Commit von `main` übersehen worden war. Der
    so erzeugte Patch hatte 8 statt der eigenen 5 Hunks; die drei zusätzlichen waren **Löschungen
    der fremden Arbeit** (`.system-tafel`, die farbige Sonnenscheibe, der fremde Patchnote-Eintrag).
    Angewandt hätte er sie spurlos entfernt – und der Prüflauf wäre grün geblieben, weil gelöschte
    Grafik-Arbeit keinen Test reißt.
    **Vorgehen:** (a) Den eigenen Änderungssatz IMMER gegen den **Eltern des eigenen Commits**
    bilden (`git diff <commit>^ <commit> -- datei`), nie gegen einen Fremdstand, den man für
    inhaltsgleich hält; (b) **abgelehnte Hunks in Bereichen, die man nie angefasst hat, sind ein
    Alarmsignal** – nicht wegräumen, sondern nachsehen, was der Patch dort will (genau daran ist es
    aufgefallen); (c) nach dem Umsetzen beide Seiten belegen: eine Handvoll Markierungen der FREMDEN
    Arbeit zählen und die eigenen Änderungen zählen, bevor committet wird.

20. **Eine Korrelation ist keine Ursache – und ein Befund wird erst weitergegeben, wenn der
    MECHANISMUS benannt ist.** Vorfall 09./10.08.2026: `test_kleine_luecken` 1c meldete mal 121,5 %,
    mal 100 %. Weil die roten Läufe zufällig in der Suite lagen und die grünen einzeln, wurde
    „unter Suite-Last" zur Ursache erklärt und Sascha zweimal als echter Spielfehler gemeldet
    („zweiter Überzahlungs-Pfad neben v8.459.0"). Beides war falsch: Die Suite fährt ihre Tests
    **sequenziell** (`spawnSync` in einer Schleife), und mit vier CPU-Lasterzeugern kam sauber
    100,0 % heraus. Die echte Ursache fand erst eine Messung, die MEHRERE Verdächtige gleichzeitig
    abfragte (Rate am Anfang **und** am Ende, Einmalzahlungen, Schnappschuss-Rennen): Der gemeldete
    Anteil war exakt `Rate_Ende / Rate_Anfang` (0,870 → 87,0 %; 1,000 → 100,0 %; 1,250 → 121,5 %).
    Nicht die Gutschrift schwankte, sondern die Bezugsgröße. Konkret: Innerhalb eines Laufs war die
    Produktion exakt konstant, zwischen den Läufen nicht – ein zufälliges Planeten-Ereignis (siehe
    Regel 18: `nextPlanetEventCheck` ist 0, der erste Check feuert GARANTIERT) multiplizierte die
    Produktion und lief mitten im Test ab. **Vorgehen daraus:** (a) Bei schwankenden Messwerten
    zuerst prüfen, ob die BEZUGSGRÖSSE stabil ist, bevor der Messgegenstand verdächtigt wird;
    (b) die vermutete Ursache aktiv zu widerlegen versuchen (hier: Last künstlich erzeugen) statt
    nur bestätigende Fälle zu zählen; (c) einen Verdacht erst weitergeben, wenn er als Mechanismus
    im Code benannt werden kann – „korreliert mit X" ist noch kein Befund. Das ist dieselbe Familie
    wie Regel 10, dort für Befunde aus Hilfsläufen, hier für eigene.
21. **Ein Test, dessen Aussage von einer über Minuten konstanten Größe abhängt, misst diese Größe
    mit – also selbst nachmessen und die Konstanz zur eigenen Prüfung machen.** Aus demselben
    Vorfall: 1c verglich gegen eine Rate, die EINMAL ganz am Anfang gemessen wurde, und schlug
    deshalb in BEIDE Richtungen falsch an (87 % hätte auch 1a mit seiner 90-%-Schranke gerissen).
    Seit der Behebung misst 1c seine Bezugsgröße unmittelbar vor und nach dem Messfenster und
    prüft ZUERST, ob sie sich gehalten hat (`1c-vorab`). Fällt die, weiß man sofort, dass die
    Bezugsgröße gewandert ist – statt tagelang den Messgegenstand zu verdächtigen.

22. **Fällt ein Test, der das BACKEND liest, ist der erste Verdacht der eigene Backend-Klon – und
    ein Kontrollversuch im `git worktree` beweist dort gar nichts.** Vorfall 10.08.2026, zweimal am
    selben Tag: `test_randkriege_*` fielen nach einem Merge. Sie lesen `RK_HANDLUNGEN` &Co. aus
    `server.js`; das Backend-Repo daneben stand zwei bzw. drei Commits zurück, während `main` im
    Frontend schon die passende Fassung hatte. Die Tests waren korrekt, das Spiel war korrekt, nur
    die Nachbardatei war alt. **Verschärfend war der Kontrollversuch selbst wertlos:** Ein
    `git worktree` unter `/tmp` hat kein Nachbarverzeichnis `kolonie-kepler7-backend`, `umgebung.js`
    findet den Backend-Quelltext dort nicht, und die Tests **überspringen sich still und melden
    grün**. Damit schien bewiesen, der Merge sei schuld. **Vorgehen:** (a) Bei jedem Fehlschlag
    eines Tests, der `SERVERDATEI`/`server.js` liest, zuerst
    `cd ../kolonie-kepler7-backend && git fetch && git log --oneline -1 origin/master` vergleichen;
    (b) einen Kontrollversuch nie in einem Worktree fahren, dem die Nachbar-Repos fehlen – ein Test,
    der sich überspringt, ist keine Gegenprobe (dieselbe Familie wie Regel 15/17/19: nie ein
    Messwerkzeug, das sich selbst im Weg steht).

22. **Vor JEDER Messung BEIDE Repos auf ihren Ursprung ziehen – nicht nur das, an dem man gerade
    arbeitet.** Vorfall 10.08.2026, zweimal am selben Tag: `test_randkriege_front` und
    `test_randkriege_beitrag` lesen `server.js` aus dem Nachbarverzeichnis. Das Backend-
    Arbeitsverzeichnis stand aber noch auf einem eigenen Branch von vor einer Stunde – beim ersten
    Mal fehlten die geprüften Funktionen komplett, beim zweiten Mal stimmte eine Schwelle nicht.
    Beide Male sah es nach einem echten Fehler im Spiel aus und war ein veralteter Nachbar. Das ist
    dieselbe Familie wie Regel 10 („hat der Melder die veraltete `index.html` gelesen?"), nur eine
    Ebene höher: nicht die falsche Datei, sondern das falsche Repo-Verzeichnis.

    **Nachtrag 11.08.2026 – drittes Mal, jetzt maschinell sichtbar.** Wieder dasselbe Bild: Nach
    einem vollen Prüflauf (25 Min.) standen `test_ausbaubarer_deckel` und `test_pvp_deckel` rot,
    beide nach einem `git pull` im Backend-Klon sofort grün. Die Regel „vorher beide Repos ziehen"
    hat beim dritten Mal genauso wenig geholfen wie beim zweiten – eine Regel, an die man sich
    erinnern muss, ist bei einer Aufgabe, die man mehrmals täglich macht, keine Absicherung.
    `tests/run.js` meldet deshalb seit v8.485.0 als fünfte Pflichtprüfung, ob der Nachbar-Klon
    hinter `origin/master` steht, **bevor** der erste Test läuft. Bewusst ohne `git fetch` (der
    Prüflauf soll nicht ans Netz) und bewusst gegen `origin/master` statt `@{u}`: Genau im
    Fehlerfall steht der Klon auf einem eigenen Branch ohne Fernbezug, und `@{u}` bricht dort mit
    „no upstream configured" ab – das Messwerkzeug stünde sich wieder selbst im Weg (Regel
    15/17/19). Kein Fehlschlag, nur eine Zeile – aber eine, die in Zeile fünf des Protokolls steht
    statt eine halbe Stunde später. Gegenprobe beidseitig gefahren: mit zurückgesetztem Klon meldet
    sie „ist 2 Commit(s) HINTER origin/master", danach ist sie still.

    **Nachtrag 16.08.2026 – viertes Mal, und diesmal hat die Prüfung von oben ENTWARNUNG gegeben.**
    Sie meldete „Backend-Klon auf Höhe von origin/master"; ein `git fetch` unmittelbar danach zeigte
    den Klon **drei Commits zurück** (#108–#110). Der Grund steckt im bewussten Verzicht auf `git
    fetch`: Verglichen wird gegen die zuletzt geholte Fernreferenz, und die war zehn Stunden alt.
    „0 Commits hinterher" hieß also nie „aktuell", sondern nur „auf dem Stand des letzten Holens" –
    und weil die Zeile das nicht dazusagte, las sie sich wie eine Freigabe. Damit gab ausgerechnet
    das Werkzeug, das diese Regel maschinell absichern soll, in seinem eigenen Fehlerfall Entwarnung
    (dieselbe Familie wie Regel 15/17/19: ein Messwerkzeug, das sich selbst im Weg steht – hier
    besonders bitter, weil es genau gegen diesen Fehler gebaut wurde).
    **Behoben:** Die Zeile nennt jetzt IMMER das Alter der Fernreferenz („geholt vor 2 Minuten") und
    schlägt an, sobald es über einer Stunde liegt – auch wenn der Abstand 0 ist. Gemessen wird
    `FETCH_HEAD`, weil git die Datei bei jedem `fetch` neu schreibt, auch wenn nichts Neues kam;
    `refs/remotes/<fern>` und `packed-refs` sind nur Notnägel und höchstens zu alt, was die
    ungefährliche Richtung ist (dann steht „mindestens" davor). Alle fünf Zweige einzeln
    gegengeprüft: frisch still, 10 Std. laut, 61 Min. laut, 59 Min. still, fehlendes `FETCH_HEAD`
    mit „mindestens", zurückgesetzter Klon weiterhin „ist 2 Commit(s) HINTER".
    **Die übertragbare Lehre**, unabhängig von diesem Skript: Eine Prüfung, die auf einem
    ZWISCHENGESPEICHERTEN Stand fußt, muss das Alter dieses Stands mitmelden. Sonst beantwortet sie
    stillschweigend eine andere Frage als die gestellte – hier „stimmt mein Klon mit meiner letzten
    Kopie überein?" statt „stimmt mein Klon mit dem Ursprung überein?".
23. **Die Versionsnummer erst unmittelbar VOR dem Commit vergeben – und `main` in diesem Moment
    noch einmal ansehen.** Am 10.08.2026 wurde dieselbe Änderung FÜNFMAL umnummeriert (v8.472.0 →
    8.473 → 8.475 → 8.476 → 8.477 → 8.483), weil parallel ausgeliefert wurde und jede fremde
    Version die eigene überholte. Jede Kollision kostet einen vollen Prüflauf (~25 Min) – bei einem
    Auslieferungstakt darunter konvergiert das nicht von selbst; irgendwann ist Warten auf ein
    ruhiges Fenster die schnellere Lösung. Gemerkt hat man es jedes Mal erst an Konflikten beim
    Cherry-Pick; **die aufzulösen wäre der Fehler gewesen** – dabei verschwindet still entweder die
    fremde oder die eigene Arbeit. Richtig: neu auf den aktuellen `main` aufsetzen, umnummerieren,
    Patchnote HINTER der fremden einsortieren. Und: Ein neuer Commit auf `main` heißt nicht
    automatisch Kollision – erst prüfen, ob er die eigene Nummer oder dieselben Dateien überhaupt
    berührt (PR #321 war reine Dokumentation).

    **Nachtrag 15.08.2026 – vierte Kollision in Folge, jetzt maschinell abgesichert.** Dieselbe
    Änderung musste v8.500.0 → 8.502.0 → 8.503.0 durchlaufen, weil die Sektorkarten-Reihe parallel
    lieferte, während der 25-Minuten-Lauf lief. Die Regel „main noch einmal ansehen" hat beim
    vierten Mal so wenig geholfen wie beim zweiten – eine Regel, an die man sich erinnern muss, ist
    bei einer Aufgabe, die man mehrmals täglich macht, keine Absicherung (dieselbe Begründung wie
    bei der Backend-Klon-Prüfung, Regel 22). **Der Ablauf ist deshalb umgedreht: Die Nummer wird
    erst NACH dem grünen vollen Prüflauf vergeben.**

    ```
    1. Änderung bauen (VERSION und PATCHNOTES noch NICHT anfassen)
    2. node tests/run.js                 der volle Lauf, ~25 Min
    3. node naechste-version.js          holt origin/main, nennt die freie Nummer, Exit 1 bei Kollision
    4. VERSION + Patchnote eintragen, node build-patchnotes.js, cp weltraum_kolonie.html index.html
    5. node tests/run.js --nummer        Pflichtprüfungen + die 4 Tests am Patchnotes-Block, ~15 s
    6. committen, PR, mergen
    ```

    Schritt 5 schließt die Lücke, die Schritt 4 aufreißt: Nach dem vollen Lauf ist die Spieldatei
    noch einmal angefasst worden, „der Lauf war grün" gilt also streng genommen für einen anderen
    Stand. `--nummer` prüft genau das, was eine Nummernvergabe kaputtmachen kann – Syntax,
    Dateigleichheit, VERSION-zu-Patchnote, die erzeugte `patchnotes.html` und die vier Tests, die den
    Patchnotes-Block lesen. Der Modus meldet außerdem, wenn eine dieser vier Dateien fehlt: sonst
    liefe er still mit weniger Tests durch und meldete trotzdem „sauber".

    `naechste-version.js` liest **alle** Versionen aus `origin/main` – die Konstante UND jeden
    Patchnotes-Eintrag. Genau daran ist es aufgefallen: v8.500.0 kam zusammen mit v8.501.0 in EINEM
    Commit, und wer nur die `VERSION`-Konstante ansieht, übersieht die erste.
24. **Ein pauschaler Ersetzer über TESTDATEIEN braucht dieselbe Sorgfalt wie einer über den
    Spielcode.** Beim Umbenennen der Aufrufstelle (`weicherDeckel(` → `deckelWeich(`) am 10.08.2026
    gingen in einem Rutsch drei Dinge schief: (a) eine zu breite Ausnahme (`weicherDeckel(d`)
    schützte versehentlich `weicherDeckel(defenseCombatBonusRaw`; (b) die **Backend**-Erwartungen
    wurden mit umbenannt, obwohl dort bewusst die alte Schreibweise gilt; (c) die zwei Stellen, an
    denen der Test die aus der Datei geholte Funktion **ausführt**, wurden mit umbenannt – der Test
    stürzte danach mit `ReferenceError` ab. In einer Testdatei stehen Suchmuster für fremden Code
    und ausgeführter eigener Code nebeneinander; ein Textersetzer sieht den Unterschied nicht.
    Nach so einem Lauf jede Datei einzeln per **Exit-Code** prüfen (siehe Regel 25).
25. **Der Exit-Code ist die Wahrheit, ein `grep` über die Ausgabe ist nur Beiwerk.** Aus demselben
    Vorfall: `node test.js 2>&1 | grep -E "^FAIL"` blieb leer, und das wurde als „grün" gemeldet –
    der Test war in Wirklichkeit mit einem `ReferenceError` abgestürzt, dessen Meldung auf kein
    `FAIL`-Muster passt. Dieselbe Familie wie Regel 19 (Exit-Code hinter einer Pipe): Ein
    Messwerkzeug, das nur einen Teil der möglichen Ausgaben kennt, meldet Erfolg, wo keiner ist.

26. **Eine Gegenprobe, die am ALTEN Stand grün bleibt, ist kein Beweis – sie ist der Befund.** Nicht
    nachbessern, bis sie zufällig rot wird, sondern fragen, WARUM sie grün war: Meist misst der Test
    einen Zustand, der sich von selbst wieder einrenkt. Vorfall 10.08.2026: `test_weltboss_rennen`
    prüfte den Inhalt der Weltboss-Box, nachdem der Server die Schreibung abgelehnt hatte – grün an
    beiden Ständen, weil `loadWorldBoss()` bei jedem Bestenlisten-Durchlauf erneut läuft und den
    lokalen Notnagel überschreibt. Der Unterschied lebte nur im Fenster zwischen Ablehnung und
    nächstem Abruf. Belegbar wurde er erst an etwas, das BLEIBT: der Ansage „<Name> - Stufe 7 ist
    erschienen!" für einen Boss, den es nie gab (mitgeschnitten per MutationObserver auf die
    Einblendungen). Faustregel: Heilt sich der Messgegenstand beim nächsten Takt, miss stattdessen
    das, was der Spieler in diesem Takt zu SEHEN bekommen hat.
27. **Eine Endstands-Prüfung nach mehreren Schreibversuchen misst nur den LETZTEN.** Aus demselben
    Vorfall: Der Weltboss-Test schrieb fünf Fälschungen und prüfte danach einmal die Datenbank. Die
    letzte Fälschung schrieb zufällig wieder Stufe 1 mit vollem maxHp – also sah der Endstand
    unauffällig aus und alle vier Prüfungen waren grün, während Fälschung 1 einen Boss mit 2,08e45
    HP durchgelassen hatte. Gemessen wird hinter JEDEM einzelnen Schreibversuch, nicht am Ende.
28. **Eine Prüfung, die aus dem falschen Grund grün ist, ist so schlecht wie eine rote.** Die
    „übersprungene Stufe wird abgelehnt"-Prüfung stand hinter dem bereits gesetzten lebenden Boss
    und schlug deshalb im Zweig „Boss lebt" an – ein Duplikat der Prüfung davor, die Stufenregel war
    überhaupt nicht belegt. Wenn eine Sperre mehrere Gründe kennt, den GRUND mitprüfen (hier: der
    Fehlertext muss „Stufe 4" nennen), nicht nur den Statuscode.
29. **Neue Testports gegen die vorhandenen prüfen.** `test_geteilter_speicher_http.js` startet zwei
    Server und belegte mit Port+1 die 3199 von `test_systemliste_http.js`; der fiel danach mit
    ECONNREFUSED aus und der Fehler sah aus, als läge er an der gerade gebauten Härtung.
    `grep -n "PORT = " tests/*.js` vor der Wahl.

31. **Die Kollisionsprüfung nie mit dem Commit in EINEM Befehl verketten – sie ist eine
    Entscheidung, kein Log-Output.** Vorfall 14.08.2026: `git log merge-base..origin/main && git
    commit && git push` zeigte den fremden Commit (#352 hatte v8.499.0 belegt) korrekt an, aber
    die `&&`-Kette lief ungerührt weiter und pushte die eigene v8.499.0 hinterher – nur weil der
    Merge ein separater Schritt war, fiel die Kollision VOR der Auslieferung auf. Beim ersten Mal
    am selben Tag (#350) war die Prüfung ein eigener Befehl, und die Kollision wurde sauber
    abgefangen. Richtig: Prüfbefehl absetzen, Ausgabe LESEN, erst dann in einem neuen Befehl
    committen. Dieselbe Familie wie Regel 25: Ein Werkzeug, dessen Ergebnis niemand auswertet,
    prüft nichts.

34. **Ein Test, der beim AUFBAU seiner Messvorrichtung abstürzt, hat seine übrigen Prüfungen nicht
    ausgeführt – und der rote Exit-Code verdeckt genau das.** Vorfall 15.08.2026: Die Gegenprobe zu
    `test_tier2_karte` schnitt einen Funktionsblock aus der Spieldatei und führte ihn per
    `new Function` aus. Am ALTEN Stand gibt es die geprüfte Funktion nicht – der Aufbau warf einen
    `ReferenceError`, der Test brach mitten drin ab, und die wichtigste Prüfung (die Aufrufer-Suche,
    die alle drei rohen Rechenstellen benennen sollte) lief nie. Exit-Code 1 sah aus wie eine
    gelungene Gegenprobe; in Wahrheit war nur ein Viertel der Prüfungen gefahren, und was die
    übrigen gesagt hätten, hat niemand gesehen. Das ist die Gegenrichtung zu Regel 25: Dort meldet
    ein Absturz fälschlich GRÜN, hier fälschlich „rot aus dem richtigen Grund".
    **Vorgehen:** Jeden `new Function`/`require`/Parser-Aufruf im Test in `try/catch` fassen und den
    Fehlschlag als eigene, benannte Prüfung melden (`3-bau: der Block lässt sich ausführen`), statt
    ihn den Testlauf beenden zu lassen. Und bei jeder Gegenprobe die ANZAHL der gelaufenen
    Prüfungen mit dem grünen Lauf vergleichen – fehlen welche, ist die Gegenprobe unvollständig,
    egal wie rot sie aussieht.
32. **Eine gemeldete Anzeigezahl ist erst widerlegt, wenn auch nach ihrer RECHENFORM gesucht wurde
    – nicht nur nach dem gerenderten Literal.** Vorfall 15.08.2026: Ein Hilfslauf meldete, der
    Forschung-Tab werbe mit „6% je Labor, Deckel 75%", während die Konstanten 4,5% und 45% lauten.
    Die Gegenprüfung suchte `grep "6% je Labor"` und `grep "75%"` im Forschungsbereich, fand nichts
    und stand kurz davor, den Fund als widerlegt zurückzugeben. Im Code steht aber
    `Math.min(75,labCount*6)+'%'` – die Zahl entsteht erst zur Laufzeit und kommt als Text nirgends
    vor. Gefunden hat sie erst eine Suche nach dem UMFELD (`verkürz`, `Zeitersparnis`) statt nach
    dem Wert. **Vorgehen:** Beim Nachprüfen einer Zahl immer beides suchen – das Literal UND die
    Rechenform (`*6`, `Math.min(75`, `PER_LEVEL`, den Konstantennamen). Ein „nicht gefunden" ist
    sonst kein Beweis, sondern nur eine zu enge Suche. Das ist die Gegenrichtung zu Regel 10: Dort
    wird ein Fund zu Unrecht geglaubt, hier zu Unrecht verworfen – und ein zu Unrecht verworfener
    Fund fällt nie wieder auf, weil niemand mehr hinsieht.
33. **Eine Prüfung, die Aufrufstellen im Quelltext ZÄHLT, muss Kommentare vorher entfernen – und
    darf ihre Erwartung nicht als blanke Zahl führen.** Vorfall 15.08.2026, beide Hälften am selben
    Test: `test_ausbaubarer_deckel` 2d zählte `weicherDeckel(`-Treffer über den rohen Quelltext und
    verlangte genau 3. Ein neuer, völlig legitimer vierter Aufruf ließ ihn auf 5 springen, weil der
    erklärende Kommentar daneben den Aufruf ZITIERT – der Zähler sah den Unterschied nicht (das ist
    Regel 6, zweite Hälfte, nur auf einen Zähler statt auf einen Slice angewandt). Und die Meldung
    lautete `{"direkteAufrufe":5}` – sie sagte nicht, WELCHE Stelle dazugekommen war, also musste
    von Hand gegriffen werden, um überhaupt zu beurteilen, ob der Zuwachs erlaubt ist. Ein Zähler
    ist außerdem eine Momentaufnahme (Regel 3). **Richtig:** Kommentare vor dem Zählen leeren, die
    erlaubten Stellen NAMENTLICH als Musterliste führen, den Fehlschlag die nicht passenden Zeilen
    ausgeben lassen – und die Gegenrichtung mitprüfen (verschwindet eine erlaubte Stelle, ist das
    genauso ein Befund wie eine neue).

35. **Ein Ladezustand, aus dem es kein Entkommen gibt, ist eine Falschaussage – er behauptet, es
    gehe gleich weiter.** Vorfall 15.08.2026: Der neue Abschnitt „Aussehen" zeigte „Lädt…", solange
    der Katalog fehlte, und rief den Abruf erneut auf. Antwortete der Server dauerhaft nicht, stand
    dort für immer „Lädt…" – stumm, ohne Hinweis auf die Ursache. Genau das war live zu sehen, als
    der Frontend-Deploy durchlief und der Backend-Deploy hängen blieb: Die Spieldatei fragte
    `/api/cosmetics` ab, bekam 404, und die Fläche war tot. **Vorgehen:** Jede Box, die auf den
    Server wartet, braucht drei Zustände statt zwei – lädt, da, und *nicht erreichbar*. Der dritte
    nennt den Grund, sagt, dass es von selbst weitergeht, und sagt, was NICHT verloren ist. Und er
    gehört in den Test: `test_kosmetik_auswahl.js` Abschnitt 7 lässt den Server mit 404 antworten,
    genau wie an dem Tag.
36. **Ein Test, der eine Hilfsfunktion des Spiels durch einen Platzhalter ersetzt, prüft nicht mehr
    das Spiel.** Vorfall 15.08.2026: `test_kosmetik_paritaet` schnitt `kosmetikBedingungText()` aus
    der Datei und führte sie mit `fmt = String` aus, weil die echte `fmt` nicht im Zugriff schien.
    Die Prüfung „die Schwelle steht im Text" war damit grün – im Spiel stand aber „5.0k
    Kampfpunkte", denn `fmt()` rundet, und für eine Freischaltschwelle ist das wertlos. Aufgefallen
    ist es nur, weil ein zweiter Test daneben den ECHTEN gerenderten Text las. **Vorgehen:** Fehlt
    einer geschnittenen Funktion eine Abhängigkeit, wird auch die aus der Datei geschnitten und
    mitgegeben – nie durch etwas Ähnliches ersetzt. Dieselbe Familie wie Regel 22 (veralteter
    Nachbar) und 25 (unvollständiges Messwerkzeug): Was gemessen wird, ist dann nicht, was läuft.
    Zweite Hälfte desselben Vorfalls: Die Prüfung verlangte den Schwellenwert als `String(wert)` und
    schlug an, als 5000 völlig korrekt als „5.000" ausgegeben wurde – ein Test darf die REGEL
    verlangen („die Schwelle steht da"), nicht eine Schreibweise (Regel 3).
37. **Eine Prüfung, die hinter einer Bedingung steht, die nicht eintrat, ist grün ohne Aussage –
    also gehört die Bedingung selbst geprüft, und ihr Fehlschlag muss den GRUND nennen.** Vorfall
    15.08.2026: `test_sternenstaub_http` Abschnitt 5 zählte abgewehrte Angriffe und prüfte die
    Gutschrift dagegen. Alle fünf Angriffe prallten am **Anfängerschutz** ab (403), `abgewehrt` war
    0, und die beiden Folgeprüfungen wurden dadurch trivial grün – nur die Vorab-Prüfung war rot,
    und sie meldete lediglich `{"abgewehrt":0}`. Woran es lag, musste von Hand gesucht werden.
    **Vorgehen:** Die Antworten des Servers mitführen und im Fehlschlag ausgeben (jetzt:
    `["403:Ziel steht unter Angriffs-Schutzschild.", …]`) – dann steht die Ursache im Protokoll
    statt in einer späteren Sitzung. Und für Tests am Angriffs-Endpunkt gilt: Frisch angelegte
    Konten sind unangreifbar, `db.private[<id>].__attackShieldUntil` muss in der Vorbereitung auf 0.

38. **Eine Zahl in einem Text aus einer Konstante ABZULEITEN geht nur, wenn die Konstante WEITER
    OBEN in der Datei steht – und der Syntax-Check sagt das nicht.** Vorfall 16.08.2026, dreimal am
    selben Tag. Der richtige Reflex („die Zahl aus der Konstante holen, dann kann sie nicht
    veralten") läuft in eine Falle, sobald der Text in einem Array-Literal steht, das beim LADEN
    ausgewertet wird: `CREDIT_SHOP`, `HELP_SECTIONS`, `MEGA_PROJECTS`, jedes `*_DEFS`. Eine
    `const`, die weiter unten steht, liegt zu diesem Zeitpunkt in der temporalen Todeszone – der
    Zugriff wirft einen `ReferenceError`, und das Spiel startet gar nicht erst. Konkret beinahe
    passiert bei den Fragment-Fertigungskosten (`MODULE_FRAGMENT_CRAFT_COST` steht hinter
    `CREDIT_SHOP`) und beim Hilfetext zu den Mega-Ausbaustufen (`MEGA_STAGE_COST_MULT` steht hinter
    `HELP_SECTIONS`). **Der Syntax-Check findet das NICHT**, weil `new Function(...)` nur parst und
    nie ausführt; erst der JSDOM-Boot des vollen Prüflaufs würde es fangen – eine halbe Stunde
    später. **Vorgehen:** Vor jeder Ableitung die Reihenfolge messen, nicht schätzen –
    `node -e "const s=…; console.log(s.indexOf('const ZIEL') < s.indexOf('const QUELLE'))"`. Steht
    die Quelle dahinter, gehört dort ein fester, korrekter Wert hin (mit Kommentar, warum nicht
    abgeleitet). Funktionsaufrufe sind unkritisch, die sind hochgezogen – nur `const`/`let` nicht.
39. **Ein Schlüssel kann in MEHREREN Tabellen vorkommen – eine ungescopte Suche greift die
    falsche.** Vorfall 16.08.2026: `test_mega_tier2` suchte die Zeile mit `key:'forschungsnexus'`
    über die ganze Datei. Der Schlüssel existiert aber zweimal: einmal als Mega-Projekt
    (Zeile 43671) und einmal als ERFOLG „Wächter des Wissens" (Zeile 18789). `.find()` liefert den
    ersten Treffer, also den Erfolg – der Test prüfte die falsche Tabelle und fiel durch, obwohl
    der Code stimmte. Das ist dieselbe Familie wie Regel 6 (Kommentar zitiert denselben Text) und
    Regel 5 (ungescopter `querySelector`), nur eine Ebene höher: nicht ein Kommentar neben dem
    Code, sondern eine zweite Tabelle mit denselben Schlüsseln. **Vorgehen:** Jede Suche nach einem
    Eintrag zuerst auf den Block seiner Tabelle beschränken (`S.slice(vonTabelle, bisTabelle)`), und
    beim Anlegen eines neuen Schlüssels kurz `grep -c "key:'<name>'"` – ist die Zahl größer als 1,
    muss jede Prüfung darauf gescopt sein.
40. **Eine namensbasierte Suche nach Anzeigestellen findet nur, woran man schon gedacht hat – die
    musterbasierten Tests finden den Rest. Deshalb gehören sie VOR den vollen Lauf, nicht danach.**
    Vorfall 16.08.2026, eine einzige Lieferung (achte Modulstufe): Vor dem ersten Zeichen Code wurde
    ausdrücklich der Anzeigestellen-Durchgang gefahren, mit den drei Suchen aus der Checkliste. Er
    fand neun Stellen – und übersah **neun weitere**, jede aus einem anderen Grund:
    (a) Drei Nebentabellen heißen anders als das, wonach gesucht wurde (`MODULE_SELL_CREDITS`,
    `MODULE_SUB_RANGE`, `SHIP_MODULE_RARITY_ORDER` – gesucht worden war nach `MODULE_RARITY` und
    `MODULE_FRAGMENT_*`); (b) der Tutorial-Text nennt überhaupt keine Konstante, nur das Zahlwort
    „sieben Seltenheiten von Gewöhnlich bis Exotisch" – nach *Zahlwörtern* hatte niemand gesucht,
    obwohl `TUTORIAL_STEPS` wörtlich auf der Checkliste steht; (c) das Icon des neuen Erfolgs liegt
    in einer eigenen Map (`ACH_ICONS`) weit weg vom Erfolg selbst.
    Gefunden hat alle drei Gruppen **kein** Grep, sondern Tests, die *keine Namen kennen*:
    `test_seltenheiten.js` prüft JEDE Nebentabelle gegen die geparste Rang-Ordnung,
    `test_erfolgsicons.js` JEDEN `ACHIEVEMENTS`-Schlüssel gegen `ACH_ICONS`, `test_tutorial.js` die
    Zahlwörter im Text gegen `Object.keys(...)`. Genau darin liegt ihr Wert: Sie finden auch, woran
    niemand gedacht hat.
    **Vorgehen:** Nach dem Bauen und **vor** dem vollen Lauf die Tests einzeln fahren, die den
    geänderten Bereich anfassen – `grep -ln "GEAENDERTE_KONSTANTE\|Nachbarbegriff" tests/*.js`, dann
    jeden Treffer starten. Das kostet zwei Minuten und hat an diesem Tag fünf Fehlschläge in EINEM
    Rutsch sichtbar gemacht, die sonst über drei 25-Minuten-Läufe einzeln hereingetröpfelt wären
    (jeder Lauf war nach dem ersten Fehlschlag ohnehin wertlos). Der volle Lauf bleibt Pflicht – er
    ist die Absicherung, nicht das Suchwerkzeug.
41. **Ein Konzept ist kein Messergebnis. Bevor eine Konzept-Zahl umgesetzt wird, wird sie
    nachgerechnet – auch wenn das Konzept aus derselben Feder stammt.** Vorfall 16.08.2026: Das
    Tier-3-Konzept sah Protomaterie als laufenden Eingangsstoff der beiden neuen Fabriken vor
    (`protomaterie: 1` bzw. `2` je Einheit). Nachgerechnet frisst eine EINZIGE voll ausgebaute Kette
    bei den üblichen Kettenraten rund 16 Protomaterie je Stunde, über zehn Standorte 162 – gegen
    eine Einnahme von 11 bis 32. Der Bestand hätte dauerhaft bei null gestanden, rund um die Uhr
    abgesaugt, und die Senke, die zwei Stunden vorher ausgeliefert worden war (Mega-Ausbaustufen ab
    Stufe 6), wäre nie bezahlbar gewesen. Die Ursache war strukturell, nicht eine Frage der
    Feinjustierung: **Eine Dauerfabrik skaliert mit Standorten und Stufen, eine flugzeitgebundene
    Ressource tut das nicht** – die beiden Größen laufen zwangsläufig auseinander.
    Dasselbe Konzept sprach außerdem von der „vierten Modulstufe über Legendär"; tatsächlich gab es
    darüber längst zwei (Mythisch, Exotisch), es wäre die achte gewesen. **Vorgehen:** Jede Zahl und
    jede Mengenangabe aus einem Konzept vor dem Umsetzen einmal gegen den echten Stand rechnen bzw.
    greppen. Ein Konzept beschreibt die Absicht, nicht den Code.
42. **Ein gezeichnetes Symbol in `RES_ICONS`/`ICONS` heißt nicht, dass die Oberfläche es auch
    zeigt.** Vorfall 16.08.2026 (Spieler-Report Sascha mit Screenshot): Die Ressourcenkarte der
    Protomaterie trug eine **Spitzhacke** – also das Werkzeug statt des Stoffes. Das handgezeichnete
    SVG lag längst in `RES_ICONS`, die Karte hatte aber ein festes `<i class="ti ti-pick">` im
    Markup. Zwei Wahrheiten für dasselbe Symbol, und die sichtbare war die falsche. Der eigene Test
    hatte nur geprüft, DASS ein `RES_ICONS`-Eintrag existiert – nicht, dass ihn jemand benutzt.
    **Vorgehen:** Nach dem Anlegen eines Symbols `grep -n "<schluessel>" weltraum_kolonie.html` und
    nachsehen, ob die Anzeigestelle es wirklich einbindet; im Zweifel das Symbol aus der
    ausgelieferten Datei ziehen und rendern (Playwright-Screenshot), statt es zu behaupten. Und
    beim Zeichnen selbst: erst ansehen, dann behaupten – der erste Entwurf wirkte gerendert wie eine
    Münze, der zweite war bei 20 px kaum von Erz zu unterscheiden. Beides fiel nur am Bild auf.
43. **Wer zwei Kopien zu einer Funktion zusammenführt, macht die Tests darauf STÄRKER – nicht
    passend.** Vorfall 16.08.2026: Die zwei fast wortgleichen Schmiede-Funktionen wurden auf eine
    zusammengezogen (ihr eigener Kommentar dokumentierte, dass genau diese Dopplung schon einmal
    eine Sicherheitssperre verschluckt hatte). Danach fiel `test_abgrund_module2`, weil er die
    Sperre **wörtlich in beiden benannten Funktionen** verlangte. Die bequeme Lösung wäre gewesen,
    die Prüfung auf „irgendwo vorhanden" abzuschwächen. Richtig war das Gegenteil: Sie prüft jetzt,
    dass die Sperre **genau einmal** existiert (eine zweite Kopie kann wieder auseinanderlaufen –
    das war der Vorfall) und dass **jeder** Einstieg dorthin delegiert. Ein fünfter Schmiede-Knopf
    ohne Sperre fällt damit auf; vorher hätte ihn niemand bemerkt.
    **Und die Verhaltensgleichheit wird ausgeführt, nicht gelesen:** Der Block wurde per
    `new Function` mit einem Mini-Fixture gefahren und gemessen, dass Abgrund-Modul und Unikat
    abgelehnt werden und ein normales Modul entsteht. „Der Code sieht gleich aus" ist kein Beleg.

44. **Wird ein MODUS abgeschaltet, ist der tote Zweig kein totes Gewicht, sondern ein Inventar –
    dort leben Inhalte und Aufräumarbeiten, die sonst NIRGENDS existieren.** Vorfall 16.08.2026,
    dreimal in EINER Etappe (KB-4, „nur noch die Sektoren-Karte"): (a) Sämtliche Knoten-Extras der
    Galaxie-Übersicht (Ereignis-Abzeichen 🏴‍☠️👽⚔️🏰, Aufklärung 🔎📡, Fraktions-Wappen,
    Kontroll-Ring, Kollaps, Randkriege-Balken) lebten NUR im Übersichts-Zweig des
    Freiflug-Renderers – der „offen"-Zweig zeichnet Nachbarn als nackte Punkte – und wären mit dem
    Abschalten still aus dem Spiel verschwunden (gefunden von test_karte_ebenen 1b: Abzeichen weg,
    Territorium noch da); (b) die Frontsegmente hingen an `if (!offen)` und wären tot gewesen;
    (c) buildMap() versteckt nebenbei die ◀/▶-Tafelzeile samt ✕ – im Sektor-Zweig läuft buildMap
    nie, die Zeile blieb nach dem Schließen sichtbar stehen (test_karte_mobil 3). **Vorgehen:**
    Nach dem Abschalten eines Modus alle Bedingungen auf den Moduszustand greppen (`!offen`,
    `uiX &&`, `galaxyOpenSystem`) und je Zweig ZWEI Fragen stellen: Welcher INHALT lebt nur hier –
    und welche AUFRÄUMARBEIT (style.display-Rückstellung, Handler-Abbau) lief nur hier? Portiertes
    gehört in EINE gemeinsame Quelle für beide Renderer (karteSystemBadges/karteFrontStand), nicht
    in eine zweite Kopie.
45. **Der Betroffenheits-Sweep über die Tests greppt nach dem DOM-MERKMAL, nicht nach dem
    Container – und nach den QUELLTEXT-Ankern, die der Umbau entfernt.** Aus derselben Etappe:
    Gesucht wurde nach `galaxyMapSvg|buildGalaxyMap` – sechs Bergbau-/Peilungs-Tests klicken aber
    nur `[data-system-node="…"]`, ohne den Container je zu nennen; der volle Prüflauf fiel nach
    Minuten an test_abbaumission und war verloren (~25 Min). Ein zweiter Lauf fiel an einer
    Erwartung, die eine BEWUSSTE Verhaltensänderung derselben Etappe noch verneinte
    (test_sektoransicht: „Ebenen-Leiste zu") – wer ein Verhalten absichtlich ändert, sucht sofort
    nach Tests, die das ALTE Verhalten als Regel prüfen (`grep -ln "eiste" tests/*.js`), nicht erst
    nach dem Fehlschlag. Dieselbe Familie wie Regel 32/40: Eine zu enge Suche ist kein Beweis –
    hier kostet sie je einen vollen Lauf.
46. **Ein Patchnote, der eine Behebung beschreibt, ZITIERT die alte Formulierung – und reißt damit
    den Test für genau diese Behebung.** Vorfall 16.08.2026: Der Hilfetext sagte „sieben
    Seltenheitsstufen"; die Behebung stellte ihn auf eine Ableitung um, und der Test hielt das mit
    `!JS.includes('sieben Seltenheitsstufen')` fest. Grün. Eine Stunde später fiel er – weil der
    Patchnote zu eben dieser Auslieferung den alten Wortlaut zitiert, um zu erklären, was behoben
    wurde. Die Prüfung durchsuchte die GANZE Datei und fand ihren eigenen Behebungs-Eintrag wieder.
    Das ist dieselbe Familie wie Punkt 6, zweite Hälfte (ein Kommentar zitiert denselben Text), nur
    eine Etage größer und mit einer Besonderheit: **PATCHNOTES sind unveränderliche Historie**, man
    kann den Wortlaut dort also nicht anpassen – die Prüfung muss sich anpassen.
    **Vorgehen:** Jede Prüfung der Form „dieser Text steht NICHT mehr in der Datei" schneidet den
    PATCHNOTES-Block vorher heraus:
    ```js
    const OHNE_HISTORIE = (() => {
      const v = S.indexOf('  const PATCHNOTES = [');
      const b = v < 0 ? -1 : S.indexOf('\n  ];', v);
      return (v >= 0 && b > v) ? S.slice(0, v) + S.slice(b) : S;
    })();
    ```
    Positive Prüfungen („der Text steht da") sind unkritisch – nur die verneinenden. Und beim
    Schreiben eines Patchnotes lohnt der Gedanke: Zitiere ich hier gerade eine Zeichenkette, auf
    die ein Test negativ prüft?

    **Nachtrag zur Fehlersuche selbst:** Der erste Verdacht war regelkonform der veraltete
    Backend-Klon (Regel 22) – er war tatsächlich zwei Commits zurück, und nach dem Nachziehen
    blieben die Tests trotzdem rot, nur mit ANDEREN Fehlschlägen. Ein bestätigter erster Verdacht
    ist nicht automatisch die Ursache; erst der zweite Blick auf die konkrete Fehlermeldung führte
    zum Patchnote. Ein veralteter Nachbar kann gleichzeitig wahr und irrelevant sein.

**Arbeitsumgebung:**
14. **Während `node tests/run.js` läuft, die Spieldatei NICHT anfassen** – die Tests lesen sie
    live; committed wird erst nach grünem Ergebnis (der Merge ist seit dem Webhook die
    Auslieferung selbst).

    **Nachtrag 15.08.2026 – die Ausnahme, an die niemand denkt: die eigene GEGENPROBE.** Regel 1
    verlangt, jede neue Prüfung auch am alten Stand zu fahren, und der übliche Griff dafür ist
    `cp alt.html weltraum_kolonie.html` … messen … zurückkopieren. Das sind **Edits an der
    Spieldatei** – während eines laufenden Prüflaufs also genau das, was Regel 14 verbietet. Genau
    so passiert: Ein Lauf war bei 144 von 211 Tests, als für eine Gegenprobe zweimal die Datei
    getauscht wurde; sein Ergebnis war damit wertlos und die 20 Minuten weg. Dass die Datei danach
    byteweise wieder stimmte (`git status` leer), hilft nicht – die Tests dazwischen haben einen
    anderen Stand gelesen. **Vorgehen:** Gegenproben laufen VOR dem vollen Lauf oder NACH ihm, nie
    daneben; wer während eines Laufs unbedingt messen muss, tut es an einer KOPIE unter anderem
    Pfad (`KEPLER_SPIELDATEI`, siehe Korrektur unten), nie am Original. Und: Wenn der Lauf ohnehin
    schon einen Fehlschlag gemeldet hat, ist er wertlos – dann diesen einen Lauf über seine
    Task-ID beenden (Regel 17), erst danach editieren.

    **Korrektur 15.08.2026 – der Env-Name lautet `KEPLER_SPIELDATEI`, ein nacktes `SPIELDATEI=`
    wird still ignoriert.** Hier stand „die Testumgebung nimmt `SPIELDATEI` per Env entgegen" –
    zum Zeitpunkt der Niederschrift stimmte das gar nicht (der Pfad war fest verdrahtet), und
    genau einmal hat es in die Irre geführt: Eine Gegenprobe mit `SPIELDATEI=/tmp/kaputt.html`
    las die ECHTE Datei und blieb grün; verraten haben es erst die identischen Anker-Indizes in
    beiden Läufen (dieselbe Familie wie Regel 15/17/19: das Messwerkzeug stand sich selbst im
    Weg). Zwei Sessions fanden das unabhängig am selben Tag; seit #369 gibt es den Env-Weg
    wirklich – als `KEPLER_SPIELDATEI` in `tests/lib/umgebung.js`, wirksam für alle Tests, die
    `SPIELDATEI`/`SPIEL_URL` von dort beziehen (Playwright-Boot UND Quelltext-Lesen). Wer eine
    Umleitung setzt, prüft am Messergebnis, dass sie GRIFF (z. B. an verschobenen Anker-Indizes
    oder einem Wert, der nur in der Kopie steht) – eine still ignorierte Env-Variable sieht aus
    wie eine bestandene Gegenprobe.
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
18. **Ein Anzeige-Test, der „diese Box schreibt NICHT neu" misst, friert für sein Messfenster
    die Uhr ein (`Date.now` festhalten, dann einen Tick verstreichen lassen, DANN markieren) –
    sonst misst er Wanduhr-Glück statt der Regel.** Vorfall 08./09.08.2026: `test_listen_cache`
    fiel in Serie, an altem wie neuem Stand identisch. Per `innerHTML`-Setter-Falle (Setter am
    Element überschreiben, `new Error().stack` je Schreiber sammeln) auf zwei echte Ursachen
    zurückverfolgt: (a) Beim frischen Fixture feuert der ERSTE Planeten-Ereignis-Check
    GARANTIERT (kein Wahrscheinlichkeits-Gate bei `nextPlanetEventCheck` 0) – Fixtures pinnen
    solche Ereignis-Uhren in die Zukunft; (b) lief real ein Kalender-Event, tickte in `#fleet`
    ein sekundengenauer Countdown, und `setBoxHtml` schrieb völlig KORREKT jede Sekunde neu –
    der Test war nur außerhalb der Event-Zeitfenster grün. Mit stehender Uhr steht jeder
    legitime Countdown still, und ein kaputter Cache fällt weiterhin durch (die Marke stirbt
    am Schreiben, nicht am Inhalt).
30. **Ein Hintergrundlauf, der eine Subshell mit `&` startet, meldet den Abschluss der SUBSHELL –
    nicht den des Tests darin.** Vorfall 10.08.2026: `(node tests/run.js > log; echo EXIT=$? >> log) &`
    wurde als Hintergrundbefehl gestartet; die Werkzeugmeldung „completed, exit code 0" kam nach
    Sekunden und bezog sich auf die äußere Shell, während die Suite noch minutenlang lief. Um ein
    Haar wurde auf dieser Grundlage committet. Dieselbe Familie wie Regel 15/17: Es gilt weiterhin
    ausschließlich die Marker-Zeile `EXIT=` in der Logdatei – eine Abschlussmeldung des Werkzeugs
    ist kein Ersatz dafür, wenn zwischen ihr und dem Test noch eine Shell steht. Entweder den Test
    OHNE umschließende Subshell in den Hintergrund geben, oder auf den Marker warten
    (`until grep -q "^EXIT=" log; do sleep 10; done`).

    **Nachtrag 16.08.2026 – dasselbe noch einmal, und die Formulierung oben ist schuld.** Gestartet
    wurde `nohup node tests/run.js > log 2>&1 &` – und zwar über den Hintergrund-Modus des
    Werkzeugs. Da steht keine Klammer-Subshell, die Regel schien also eingehalten; in Wahrheit sind
    `&` und der Hintergrund-Modus ZWEI Ebenen, und die Meldung „completed, exit code 0" kam nach
    Sekunden für die äußere. Verraten hat es erst, dass das Protokoll nach dem ersten Test aufhörte
    – `ps` zeigte den echten `node`-Prozess mit 35 Sekunden Laufzeit noch quicklebendig.
    **Die Regel schärfer gefasst:** Wer den Hintergrund-Modus des Werkzeugs benutzt, schreibt den
    Befehl NACKT hin (`node tests/run.js > log 2>&1`) – kein `&`, kein `nohup`, keine Klammern.
    Beides zusammen ist immer eine Ebene zu viel. Und wer sich nicht sicher ist, prüft die
    Zeilenzahl des Protokolls gegen die angekündigte Testzahl, bevor er der Meldung glaubt: Ein
    voller Lauf hat gut zweihundert Zeilen, nicht fünf.
19. **`echo EXIT=$?` hinter einer Pipe misst das LETZTE Pipe-Glied, nie den Test** – `node
    test.js | grep FAIL; echo EXIT=$?` meldet den grep-Status (0 = Treffer gefunden!). Vorfall
    09.08.2026: Ein roter Test schien dadurch grün gemeldet. Exit-Codes immer ohne Pipe messen
    (Ausgabe in Datei umleiten, `echo EXIT=$?` direkt dahinter) oder `${PIPESTATUS[0]}` nutzen –
    dieselbe Familie wie Regel 15/17: nie ein Messwerkzeug, das sich selbst im Weg steht.

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
- **Die Sektoren-Karte ist seit KB-4 (16.08.2026, Auftrag Sascha: „Es soll nur noch die Sektoren Modus Karte geben") die EINZIGE Karte.** Feste Ansichten: Übersicht (8 Regionen, `SEKTOR_DEFS`/`sektorVon`) → Sektoransicht (`sektorAnsichtBauen`, daumengroße Plätze, freie Gürtelfelder) → aufgeklapptes System → Gürtelansicht. Die frühere Freiflug-Zeichnung in `buildGalaxyMap` ist **nicht tot** – sie ist der Renderer der GEÖFFNETEN Systemebene (`galaxyOpenSystem`) samt Zoom/Pan, Kartenmenü, Routen, Territorien, Wurmloch, Frontsegmenten. Die Einstellung `uiSektorKarte` existiert nicht mehr (altes Feld im Spielstand ist inert). Knoten-Extras (Abzeichen, Fraktions-Wappen/-Ring, Kontroll-Ring, Kollaps, Randkriege-Balken) kommen für BEIDE Renderer aus `karteSystemBadges()`/`karteFrontStand()` – wer dort etwas ergänzt, versorgt automatisch beide (Regel 44). Seit KB-5 zeigt die Übersicht je Region die aggregierten Hinweis-Icons ihrer Systeme (`data-sektor-hinweise`, Tooltip nennt das System), und das 🔎-Abzeichen der Sektoransicht trägt die stärkste bekannte Verteidigung (`data-kb-intel-dp`, Farbcodierung wie am Spieler-Marker: cyan frisch, grau veraltet, amber entdeckt). Die Frontsegmente der Randkriege sind seit KB-5b ersatzlos entfernt (sie waren für die Galaxie-Übersicht gebaut und müllten die Systemebene zu – Spieler-Report mit Screenshot); die Front lebt am Kontrollbalken der Sektoransicht. Mit KB-6 ist die GESAMTE Galaxie-Kulisse aus der Systemebene raus (Territoriums-terrGlow-Flächen, Spiralarm-Deko, Galaxie-Zentrum, Wurmloch-Linie – zweiter Spieler-Report „Immernoch die alte Ansicht"): Die Systemebene zeigt nur noch Raum, Sternenfeld, Sonne/Planeten/Marker und die Nachbar-Punkte; NPC-Besitz = Ring+Wappen der Sektoransicht, Wurmloch = 🌀-Abzeichen an beiden Endpunkten (karteSystemBadges). Die Ebenen-Leiste wirkt und erscheint auch in der Sektoransicht; nur der Routen-Knopf gehört der Systemebene (dort verborgen = keine Falschaussage). `galaxyOeffne` merkt sich die Region des Systems – jeder Sprung (Suchfeld, Berichte-Knöpfe, Allianz) landet beim Schließen in der richtigen Sektoransicht. Browser-SEITEN-Zoom ist abgestellt (Viewport-Meta `maximum-scale=1`/`user-scalable=no`, `touch-action:manipulation` auf html/body, `gesturestart`-Abfang für iOS) – der Karten-Zoom lebt im Spiel. **Tests navigieren über `tests/lib/karte.js`** (`oeffneSystemUeberSektoren`/`oeffneSektorMitSystem` – Spielerweg per DOM-Klicks, Region wird nie geraten, wartet die Kamerafahrt samt Folge-Tick ab).
- **Signatur-Cache-Muster für `render*Box()`-Funktionen ohne Live-Countdown**: `let lastXSig = null;` vor der Funktion, am Anfang eine Signatur aus allen angezeigten Werten bilden, bei Gleichheit zum Vorlauf `return` statt `innerHTML` neu zu schreiben (Beispiele: `renderAllianceBaseHero`, `renderDominance`, `renderGalaxyNews`, `renderReportsBox`, `renderAllianceTitlesBox`/`renderAllianceSkinsBox`, `renderDailyLoginBox`, `renderFpAllianceDonation`, `renderFpLeaderboard`). **Nur anwenden, wenn die Box KEINEN Live-Countdown (`Date.now()`-Differenz, die sichtbar hochzählt) enthält** – sonst würde die Anzeige sichtbar einfrieren (bewusst NICHT angewendet auf `renderAutoExploreTourBox`, `renderAbhorchpostenBox`, `renderFactions`/`renderMarket`/`renderTradeRoutes`, die stattdessen `isTypingIn()` nutzen). Neue `render*Box()`-Funktionen ohne Countdown sollten dieses Muster von Anfang an übernehmen statt jeden Tick blind neu aufzubauen.
- **`setBoxHtml(box, schluessel, html)` – die Variante mit MARKUP-Signatur (seit v8.310.0)**, für große Listen, die im Haupt-Tick per `innerHTML` neu geschrieben werden. Statt einer Wertliste ist die Signatur das fertige Markup. Zwei Folgen: (a) Sie kann nicht unvollständig sein – kein neu hinzugekommenes Anzeigefeld kann sie stillschweigend veralten lassen, was bei einer Wertliste die typische Falle ist; (b) **die Countdown-Einschränkung von oben gilt hier NICHT** – läuft ein Countdown, ist das Markup jede Sekunde ein anderes und die Box wird neu geschrieben, läuft keiner, steht sie still. Die Prüfung ist selbstkorrigierend. Der Aufbau der Zeichenkette ist billig; teuer sind `innerHTML` und die anschließenden `querySelectorAll`-Verdrahtungsläufe, und genau die entfallen. Angewandt auf `#research` (73,9 kB), `#buildings` (27,7 kB), `#defenseBuildings` (21,3 kB), `#planetRoleBox` (3,9 kB) – zusammen rund 127 kB Markup pro Sekunde. `childElementCount` als zweite Bedingung im Helfer: Räumt irgendwer die Box von außen leer, muss der Neuaufbau trotz gleicher Signatur laufen. **Vor jeder neuen Anwendung prüfen, WO die Klick-Handler gesetzt werden**: Laufen sie im selben Zweig wie das Schreiben (wie bei den Modul-Boxen), sind sie nach einem übersprungenen Tick nicht neu gesetzt – das geht gut, weil die alten Knoten samt Handler stehen bleiben, muss aber getestet werden (`tests/test_modulbox_cache.js`, `tests/test_listen_cache.js` klicken beide nach mehreren übersprungenen Sekunden). **Messen statt schätzen**: Welche Box wirklich jeden Tick neu geschrieben wird, zeigt ein `MutationObserver` auf `document.body` mit `childList:true, subtree:true`, der die Treffer je Ziel-Element zählt – die statische Suche nach `render*`-Funktionen übersieht die großen Listen, weil die gar keine eigenen Funktionen sind, sondern inline im Haupt-Tick stehen.
- **Sichtbarkeits-Gate für reines Anzeige-Polling**: `setInterval`s, die nur Daten zum ANZEIGEN nachladen (Bestenliste, Berichte, Nachrichten, Galaxie-Zustand, Allianzbasis-Kriegszustand/Spenden-Rangliste, Versions-Check), prüfen `document.visibilityState === 'visible'`, bevor sie feuern – spart Server-Anfragen/Akku im Hintergrund-Tab. **Bewusst NICHT** auf Timer mit echter Spielmechanik angewendet (`maybeScheduleRaid`, `maybeSchedulePirateDebrisRaid`, `maybeSpawnVoidRift`, `maybeSpawnTrader`, `refreshAllianceMusterAttack`) – deren Timing soll auch im Hintergrund-Tab real weiterlaufen.

## Unterstützer, Kosmetik und Sternenstaub (Etappen 1–5, 15./16.08.2026)

Das Premium-Programm hängt an einer Handvoll Stellen, die man kennen muss, bevor man daran etwas
ändert oder etwas Neues danebenbaut. Die Reihenfolge hier ist die, in der es gebaut wurde.

### Die EINE Liste der Vorteile

`UNTERSTUETZER_VORTEILE` (nahe `automatikFreigeschaltet`) ist die einzige Quelle für das, was der
Rang bringt. Der Spender-Bereich im Fortschritt-Tab zeichnet ausschließlich daraus. **Ein neuer
Unterstützer-Vorteil gehört dorthin, sonst wirbt die Fläche weiter mit dem alten Stand** – genau der
Fehlertyp aus Regel 6, nur an einer Stelle, die man beim Bauen nicht ansieht.

Zwei Fallen darin, beide real aufgetreten:
- **`desc` ist eine FUNKTION, keine Zeichenkette.** Die Kostenkonstanten (`AUTO_REPAIR_COST_KERNE`
  &Co.) stehen zehntausende Zeilen WEITER UNTEN. Eine direkt zusammengebaute Zeichenkette erwischt
  sie in ihrer Temporal Dead Zone, und das Spiel stirbt beim Laden mit `ReferenceError`. Im
  Quelltext sehen beide Schreibweisen gleich aus – nur der Browser merkt den Unterschied
  (`test_unterstuetzer_bereich.js` fängt es).
- Die Zahlen in den Beschreibungen kommen aus Konstanten bzw. vom Server, nie eingetippt.

### Kosmetik: Aussehen hier, Besitz beim Server

`KOSMETIK_LOOK` im Frontend enthält **nur Aussehen und Beschreibung**. Wer ein Stück besitzt,
entscheidet ausschließlich `KOSMETIK_DEFS` in `server.js` – eine Namensfarbe steht in der
BESTENLISTE, also auf einer Fläche, die allen gehört, und wäre im Spielstand in fünf Sekunden
gefälscht. Die Grenze ist dieselbe wie überall in diesem Projekt: „Kann ich etwas anfassen, das
ANDEREN gehört oder allen gemeinsam?"

**Die Freischaltbedingung steht bewusst NICHT im Frontend.** Sie kommt mit dem Katalog vom Server;
`kosmetikBedingungText()` fasst sie nur in Worte. Eine zweite Liste hier wäre die Anzeigestelle, die
eine Bedingung verspricht, die der Server anders durchsetzt – der Spieler spielt dann auf etwas hin,
das ihm danach verweigert wird. `tests/test_kosmetik_paritaet.js` wacht über beide Richtungen und
schlägt an, sobald der Server eine Bedingungsart einführt, die das Frontend nicht übersetzen kann.

Gezeichnet wird an **fünf** Namensstellen (Bestenliste, Seitenmenü, FP-Rangliste, Freundesliste,
Profilkarte), alle über `kosmetikFarbAttr()`/`kosmetikEmblem()`. Der globale Chat zeigt Kosmetik
bewusst NICHT – seine Nachrichten führen die Auswahl nicht mit, und ein halb umgesetztes Feature
wäre schlimmer als ein ehrlich begrenztes.

### Was NICHT in `state` liegt – und warum

`supporterAktiv`/`supporterStufe`/`supporterQuelle`, `kosmetikBesitz`/`kosmetikGetragen`,
`staubStand`, `berichtsArchiv`: alles Modul-Variablen, die bei jedem Start frisch vom Server kommen.
`state` gehört dem Spieler, liegt in localStorage und ist mit den Entwicklerwerkzeugen in fünf
Sekunden umgeschrieben. Ein alter Spielstand kann diese Werte damit nicht mitbringen, und ein
Ausloggen nimmt sie zuverlässig wieder mit. **Neue serverseitig verantwortete Größen gehören
ebenfalls hierher, nicht in `state`.**

### Komfort-Grenzen: eine Tabelle, und nichts löscht etwas

`KOMFORT_GRENZEN` deckelt Warteschlangen, Notizlänge und Freundesliste; `komfortGrenze(key)` liest
den aktuellen Rang. Vor dem Umbau stand die Freundeslisten-Grenze an DREI Stellen und die der
Warteschlangen an zwei. Auch der Hilfetext zieht jetzt daraus (`HELP_SECTIONS` steht weit hinter der
Tabelle und kann sie beim Aufbau auslesen).

**Die Regel, die über allem steht: Gedeckelt wird nur das HINZUFÜGEN.** Läuft ein Rang aus, bleibt
alles Eingereihte, jede gespeicherte Notiz und jeder Freund erhalten – es lässt sich nur nichts Neues
mehr über die kleine Grenze hinaus anhängen. Beim Berichts-Archiv sorgt dafür eine Wachstumsregel im
Backend. Ein Deckel, der beim Ablauf Daten wegwirft, bestraft das Aufhören statt das Unterstützen,
und der Betroffene merkt es erst, wenn er nachsehen will. **Wer hier einen neuen Deckel einzieht,
prüft zuerst, was er beim Ablauf anrichtet.**

### Der Wochenpass wurde bewusst NICHT gebaut

Er stand auf der Liste und ist nach der Analyse gestrichen worden – das steht hier, damit ihn nicht
in drei Monaten jemand naiv neu vorschlägt. Ein Pass misst Fortschritt („5 Angriffe geflogen",
„10 Forschungen abgeschlossen"), und **alle** diese Größen stehen im klientenautoritativen
Spielstand. Ein Pass darauf ist eine Belohnungsmaschine mit Selbstbedienung. Beschränkt man ihn auf
die zwei serverseitig belegbaren Quellen, ist er nur eine Fortschrittsleiste vor dem, was der
Sternenstaub ohnehin tut. Statt einer Schauseite kamen deshalb zwei neue Freischaltwege dazu
(Erfolge, Sektor-Bosse). Der Patchnote zu v8.525.0 sagt das den Spielern ausdrücklich – ein
angekündigtes und dann still weggelassenes Feature ist schlimmer als eines, das nie erwähnt wurde.

**Dieselbe Prüffrage gilt für jedes künftige Belohnungssystem:** Kann der Server die Bedingung
SELBST beobachten? Wenn nein, ist die Belohnung faktisch für jeden frei verfügbar, der es darauf
anlegt – dann entweder bewusst kosmetisch halten oder die Quelle wechseln.


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

**Der Webhook ist seit dem 16.08.2026 die EINZIGE Auslieferung – vorher lief eine Cron-Kopie
daneben.** In der root-crontab des Pi standen bis dahin drei Altlasten, die dasselbe taten wie der
Webhook, nur zusätzlich und alle paar Minuten:

```
*/10 * * * * cd /DATA/kepler7/kolonie-kepler7 && git pull -q && cp weltraum_kolonie.html /DATA/kepler7/web/
*/10 * * * * cd /DATA/kepler7/backend && git pull -q
*/5  * * * * /DATA/kepler7/backend/deploy/autodeploy.sh >> …/autodeploy.log 2>&1
```

Für das Frontend war das nur Doppelarbeit (und eine ärmere: Die Cron-Zeile kopierte allein
`weltraum_kolonie.html`, der Webhook seit dem 05.08. das komplette Set aus `*.html`, `*.png`,
`robots.txt`, `sitemap.xml`, `manifest.json`, `service-worker.js`). **Im Backend hat es dreimal den
Deploy zerlegt** – zwei git-Prozesse im selben Repo ergeben `index.lock`-Fehler, und weil Cron dort
als root lief, entstanden alle paar Minuten root-eigene `.git`-Objekte. Details und Belege stehen in
der Backend-CLAUDE.md. Die drei Zeilen sind entfernt; wer sie in einer Anleitung von früher
wiederfindet, trägt sie **nicht** wieder ein.

**Was daraus für Auskünfte folgt:** Wenn eine Änderung nach einem Merge nicht live ist, war früher
plausibel „der Cron-Job kommt gleich". Das gilt nicht mehr – kommt sie nicht an, ist der Webhook
selbst gescheitert, und sein Fehler steht ausschließlich im Container-Log
(`docker logs --tail 60 kepler7-backend`, Zeilen `Deploy-Webhook Fehler für …`). Nichts holt das
später von selbst nach.

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
- **Das Zertifikat MUSS ALLE genutzten Namen abdecken**: `gamegeeeeek.de`, `www.gamegeeeeek.de` (Canonical/OG-Tags, sitemap.xml, robots.txt zeigen alle auf `www.` als kanonische Domain) und inzwischen `social.gamegeeeeek.de`. Zertifikats-Linie heißt `gamegeeeeek.de` (`live/gamegeeeeek.de/`); die `ssl_certificate`-Pfade in der nginx.conf zeigen dorthin.

  **Vorfall 14.08.2026 – dasselbe wie am 21.07.2026, nur andersherum.** Beim Live-Check nach einem
  Merge antwortete `https://www.gamegeeeeek.de/` gar nicht mehr, sondern brach mit „SSL: no
  alternative certificate subject name matches target host name" ab; der Apex lieferte im selben
  Lauf sauber 200. Gemessen am ausgelieferten Zertifikat (ausgestellt 10.08.2026, gültig bis
  08.11.2026):
  ```
  X509v3 Subject Alternative Name:
      DNS:gamegeeeeek.de, DNS:social.gamegeeeeek.de
  ```
  `www.` fehlt – bei einer Ausstellung am 10.08. wurde `social.` aufgenommen und `www.` dabei
  fallengelassen. Weil `certbot` die `-d`-Namen in der Renewal-Config **speichert**, zieht jedes
  spätere `certbot renew` diesen Satz weiter fort; das heilt nicht von selbst. Wirkung: Genau der
  Hostname, auf den Canonical-Tag, OG-Tags, sitemap.xml und robots.txt zeigen – also der, über den
  Suchmaschinen und geteilte Links kommen –, zeigt jedem Besucher eine Zertifikatswarnung.
  **Zwei Lehren:** (a) Wer eine Subdomain hinzufügt, gibt **alle** bisherigen `-d`-Namen erneut mit
  (der Befehl unten ist deshalb die vollständige Liste, nicht der Zusatz); (b) der Live-Check nach
  einem Merge läuft über `www.` – über den Apex geprüft wäre der Ausfall unsichtbar geblieben,
  genau das ist hier fast passiert.

  **BEHOBEN am 16.08.2026 – der Ausfall lief sechs Tage.** Er wurde am 14.08. gefunden und
  dokumentiert, aber nicht repariert; die Renewal-Config schrieb den unvollständigen Namenssatz
  bis dahin unbefristet fort. Der Befehl unten (mit `--expand` und der VOLLSTÄNDIGEN Liste) hat ihn
  in einem Zug korrigiert – Trockenlauf sauber, echter Lauf ohne Ausfall, `nginx -s reload`, fertig.
  Danach von außen gegengemessen:
  ```
  X509v3 Subject Alternative Name:
      DNS:gamegeeeeek.de, DNS:social.gamegeeeeek.de, DNS:www.gamegeeeeek.de
  notBefore=Aug 16 08:01:09 2026 GMT   notAfter=Nov 14 08:01:08 2026 GMT
  ```
  Alle drei Namen antworten wieder mit 200; `www.` hatte vorher mit einem TLS-Fehler abgebrochen
  (curl-Exit 60). Weil `--expand` die Liste IN DIE RENEWAL-CONFIG schreibt, zieht das nächtliche
  `certbot renew` ab jetzt alle drei Namen fort – das ist die eigentliche Reparatur, nicht das
  einzelne Zertifikat.

  **Zwei Vorprüfungen, die vor so einem Lauf zwei Minuten kosten und einen Fehlschlag ersparen**
  (beide vorher gefahren): (a) Lösen alle Namen auf DIESELBE Adresse? (`getent hosts <name>` je
  Name – zeigt einer woandershin, scheitert dessen Challenge und der ganze Lauf bricht ab);
  (b) wird `http://<name>/.well-known/acme-challenge/x` direkt bedient? Erwartet ist **404 ohne
  Umleitung** – eine 301 auf https hieße, dass die `.well-known`-Ausnahme in der nginx.conf fehlt
  und die Webroot-Challenge nicht durchkommt.

  **Und der Grund, warum `--cert-name gamegeeeeek.de` im Befehl steht:** Ohne diesen Zusatz legt
  certbot eine ZWEITE Linie an (`gamegeeeeek.de-0001`), während die `ssl_certificate`-Pfade der
  nginx.conf weiter auf die alte zeigen. Der Lauf meldete dann Erfolg, und live änderte sich
  nichts – ein Fehlschlag, der wie ein Erfolg aussieht.
- **Neu ausstellen/erweitern** (downtime-frei, Webroot-Challenge über den laufenden Container – **kein** nginx.conf-Edit nötig, `--cert-name` hält die Linie stabil). Immer die VOLLSTÄNDIGE Namensliste angeben, nie nur den neuen Namen:
  ```
  docker run --rm -v /DATA/kepler7/certbot/conf:/etc/letsencrypt -v /DATA/kepler7/certbot/www:/var/www/certbot certbot/certbot certonly --webroot -w /var/www/certbot --cert-name gamegeeeeek.de -d gamegeeeeek.de -d www.gamegeeeeek.de -d social.gamegeeeeek.de --expand --non-interactive --agree-tos -m "$CERTBOT_MAIL"
  docker exec kepler7-nginx nginx -s reload
  ```
  `$CERTBOT_MAIL` ist Saschas Kontaktadresse für die Ablauf-Warnungen von Let's Encrypt – sie steht
  bewusst **nicht** im Repo (der Quelltext ist öffentlich), sondern wird beim Aufruf gesetzt bzw. ist
  in der bestehenden Renewal-Config unter `/DATA/kepler7/certbot/conf/renewal/gamegeeeeek.de.conf`
  bereits hinterlegt – bei einer reinen Erneuerung braucht es sie deshalb gar nicht.
  (Vorher risikofrei mit `--dry-run` testen.) Prüfen: `echo | openssl s_client -connect www.gamegeeeeek.de:443 -servername www.gamegeeeeek.de 2>/dev/null | openssl x509 -noout -ext subjectAltName` → **alle drei** DNS-Namen müssen erscheinen. Aus dieser Sitzung heraus geht dasselbe durch den Agent-Proxy mit `-proxy 127.0.0.1:$PORT` (der Port steht in `$HTTPS_PROXY`) – ohne den Zusatz kommt `s_client` gar nicht erst hinaus, und der Fehlschlag sähe aus wie ein Serverproblem.
- **Auto-Erneuerung** läuft per root-crontab (`certbot renew --quiet` im certbot-Container mit denselben Volumes, danach nginx-Reload/Restart). `certbot renew` nutzt die gespeicherte Renewal-Config und erneuert damit automatisch **den dort gespeicherten Namenssatz** – die `-d`-Namen nicht erneut angeben. Kehrseite und Grund des Vorfalls oben: Ist der Satz einmal falsch, erneuert `renew` den Fehler unbefristet weiter; korrigieren lässt er sich nur über ein `certonly --expand` mit vollständiger Liste.
- Der Host `certbot.timer` (systemd) ist eine **harmlose Altlast** und kennt die Docker-Volume-Zertifikate nicht – ignorieren.

**PRs sofort mergen**: Offene PRs nach dem Push ohne Rückfrage direkt mergen (nicht als Draft offen lassen) – sonst landen Änderungen nicht auf `main`. Gilt für Frontend- und Backend-Repo gleichermaßen. **Seit der Webhook bekannt ist, wiegt das schwerer als gedacht**: Der Merge ist nicht bloß ein Zwischenschritt zu einem späteren manuellen Deploy, sondern die Auslieferung selbst – was gemerged wird, steht Sekunden später auf `gamegeeeeek.de`. Der Prüflauf (`node tests/run.js`, grün) ist deshalb keine Formalie, sondern das einzige, was zwischen einer Änderung und den Spielern steht.
