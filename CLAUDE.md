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

### Graphify (`/graphify`) – Wissensgraph-Skill, eingecheckt seit 22.08.2026

Auftrag Sascha („installiere graphyfi"): Die Claude-Code-Skill **Graphify** liegt als
`.claude/skills/graphify/` im Repo (SKILL.md + `references/`, Stand 0.9.48 laut
`.graphify_version`) und ist damit in jeder Session verfügbar, die dieses Repo enthält –
lokal wie im Remote-Container. `/graphify <pfad>` baut aus einem Ordner einen abfragbaren
Wissensgraphen (`graphify-out/`: interaktives `graph.html`, `GRAPH_REPORT.md`,
`graph.json`); `/graphify query "<frage>"` beantwortet Fragen aus dem bestehenden Graphen.

Drei Dinge, die man vor der Benutzung wissen muss (alle gemessen, nicht aus der README
übernommen):

- **Das CLI installiert sich selbst nach.** Die SKILL.md prüft beim Aufruf, ob das
  `graphify`-Kommando existiert, und installiert sonst das PyPI-Paket **`graphifyy`**
  (doppeltes y – der Name `graphify` auf PyPI gehört jemand anderem und ist NICHT dieses
  Werkzeug) per `uv`/`pip` nach. Deshalb genügt die eingecheckte Skill auch im frischen
  Container. Für die eigenen Rechner: `pipx install graphifyy && graphify install`.
- **`weltraum_kolonie.html` ist für Graphify ein DOKUMENT, kein Code.** `graphify.detect`
  klassifiziert `.html` als `document` (gemessen 22.08.2026) – die Spieldatei liefe also
  durch die LLM-Extraktion statt durch den tree-sitter-AST: bei 4,9 MB teuer und ohne
  Call-Graph. Für „wo steht was in der Spieldatei" bleibt der RAG-Index oben
  (`POST /kepler/ask`) das Werkzeug. Graphifys Stärke liegt bei echten Code-Dateien:
  `tests/*.js` hier, `server.js` im Backend, Social Hub (TypeScript), AI Core (Python).
- **Aktualisieren heißt neu kopieren:** `pip install -U graphifyy && graphify install`
  schreibt die neue Fassung nach `~/.claude/skills/graphify/`; von dort SKILL.md,
  `references/` und `.graphify_version` hierher übernehmen. Die Kopie ist bewusst nur in
  DIESEM Repo eingecheckt – die Nachbar-Repos hängen in den Sessions ohnehin mit daneben,
  und vier gleichnamige Kopien würden getrennt veralten.

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

    **Nachtrag 17.08.2026 – fünftes Mal, und diesmal STAND die Warnung im Protokoll.** Nach einem
    Rebase-Zyklus (Nummernkollision mit v8.539.0) wurde nur das Frontend neu auf `origin/main`
    aufgesetzt; der Backend-Klon blieb einen Commit hinter #116 (Meilenstein-Embleme). Die
    Pflichtprüfung meldete in Zeile 5 des Protokolls völlig korrekt „origin/master ist alt (geholt
    vor 2,1 Stunden)" – gelesen hat das niemand, und der Lauf fiel erst 20 Minuten später an
    `test_kosmetik_paritaet` („ueberzaehlig: em_funke…"). Zwei Lehren: (a) Ein Rebase auf einen
    weitergelaufenen `main` ist IMMER auch ein Backend-Moment – dieselbe fremde Lieferung, die die
    eigene Nummer belegt hat, bringt oft den passenden Backend-Commit mit, und `naechste-version.js`
    holt nur das Frontend. Der `git pull` im Nachbar-Klon gehört fest in den Rebase-Ablauf, VOR den
    Suite-Start. (b) Die Pflichtprüfungs-Zeilen am Protokollanfang direkt nach dem Suite-Start
    einmal LESEN – die Warnzeile stand da, bevor der erste Test lief; ein Werkzeug, dessen Ausgabe
    niemand ansieht, prüft nichts (dieselbe Familie wie Regel 31).
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

    **Nachtrag 21.08.2026 – DREI Kollisionen an einem Tag, und die umgedrehte Reihenfolge hat
    keine davon verhindert.** Dieselbe Lieferung musste v8.598.0 → 8.599.0 → 8.600.0 → **8.601.0**
    durchlaufen. Der Ablauf von oben wurde jedes Mal korrekt eingehalten: Nummer erst nach dem
    grünen Lauf, `naechste-version.js` unmittelbar davor, Kollisionsprüfung als eigener Befehl.
    Das ist auch nicht die Lücke – **die Lücke ist arithmetisch.** Ein voller Lauf dauert gemessen
    45 bis 52 Minuten; wer die Nummer danach vergibt, hat trotzdem noch die Zeit für
    `build-patchnotes.js`, `--nummer`, Commit und Merge offen. Liegt der Auslieferungstakt der
    parallelen Sitzungen darunter, konvergiert es nicht.
    **Was wirklich hilft, ist nicht eine weitere Regel, sondern die Größe des Fensters.** Drei
    Möglichkeiten, alle drei am 21.08. durchgerechnet: (a) Nach dem grünen Lauf nur noch
    umnummerieren und SOFORT mergen – das Fenster schrumpft auf die zwei Minuten von `--nummer`;
    (b) den vollen Lauf VOR der letzten fremden Lieferung starten und nach einem Rebase nur den
    gezielten Betroffenheits-Sweep plus `--nur-pflicht` fahren (Regel 40/58) – das kostet zwei
    Minuten statt fünfzig, deckt aber nur die betroffenen Bereiche ab; (c) auf ein ruhiges Fenster
    warten. **Gewählt wurde (a) plus (b):** Nach dem Rebase liefen erst die vier Tests der fremden
    Lieferung einzeln (`test_belagerungsplan` 32, `test_herkunft` 33, `test_items` 25,
    `test_protomaterie` 43 – alle grün), dann der volle Lauf, dann in EINEM Zug Nummer, `--nummer`,
    Commit, Merge. Der Rebase selbst ist billig, solange man den überholten Nummern-Commit
    **überspringt** statt seinen Konflikt aufzulösen (`git rebase --skip`) – die zwei Inhalts-
    Commits liefen beide Male sauber durch.
    **Und der Beleg gehört zu jedem Rebase, nicht nur zum ersten:** beide Seiten NACHZÄHLEN. Nach
    dem dritten Aufsetzen: eigene Markierungen 8 von 8 (`MODUL_INVENTAR_KAUF_DECKEL` 5×,
    `fuseIndexBauen` 4×, `rarRang` 8×), fremde 3 von 3 (`belagerungsplan` 14×, `kbRunderKasten` 9×),
    alle sieben Testdateien byte-identisch zum Fernstand, CLAUDE.md um die 161 Zeilen der fremden
    Doku gewachsen. Ohne diese Zählung ist „der Rebase lief sauber" eine Behauptung.

    **Nachtrag 22.08.2026 – `git checkout --theirs` auf eine TESTDATEI ist genau die stille
    Löschung, vor der diese Regel warnt.** Beim Merge von `origin/main` standen drei Testdateien im
    Konflikt, alle drei von einer Parallelsitzung angefasst. Für zwei davon war die fremde Fassung
    beim Lesen erkennbar besser, für die dritte nicht – und ich habe trotzdem alle drei pauschal auf
    `--theirs` gesetzt. Das hat `test_schiffsmodul_paritaet.js` um einen **ganzen Abschnitt mit neun
    Prüfungen** gekürzt (`5-anker` bis `5f`, die Set-Parität), ohne einen Konflikt, ohne eine
    Meldung, und der Prüflauf wäre danach grün gewesen – der Test misst dann eben weniger.
    **Gemerkt habe ich es nur, weil ich danach die Prüf-NAMEN verglichen habe**, nicht die Datei:
    32 gegen 23. Aufgesetzt statt ersetzt sind es 33, und beide Seiten sind vollständig drin.
    **Vorgehen:** Nach jedem Konflikt in einer Testdatei die Prüfnamen aller drei Fassungen
    (`HEAD`, `origin/main`, Ergebnis) per `comm` gegeneinander halten – `comm -23 <(HEAD) <(jetzt)`
    muss LEER sein, und dasselbe für die fremde Seite. Das kostet zehn Sekunden und ist die einzige
    Messung, die „ich habe nichts verloren" belegt statt behauptet. Die zwei anderen Dateien haben
    diese Messung übrigens **bestätigt**, nicht widerlegt: Meine eine `test_pvp_deckel`-Prüfung
    steht dort als vier (Hülle hart UND Schild ungedeckelt, je Repo einzeln), meine
    Rechenform-Prüfung als `6e3` neben ihrer Musterliste `6e`/`6e2` – die fremde Fassung war
    wirklich die stärkere, und jetzt ist das gemessen und nicht geglaubt.

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
    **Nachtrag 18.08.2026 – ein musterbasierter Test ist nur so gut wie sein Muster, und mein
    eigener hat seine ANLASSFAMILIE nicht gefangen.** Der datengetriebene Rundflug-Wächter (Regel
    oben zur Rundflug-Regel) suchte nach `/2` oder `*500` im `endTime`-Ausdruck. Zwei Review-Bot-
    Befunde am PR #432 haben nachgewiesen – und ich habe beide am Code gegengemessen –, dass er
    damit genau die Form übersieht, die `intercept-pirates` und `void-rift` kaputt gemacht hatte:
    `dur = relocationDuration(...)` (schon einweg) und dann `endTime: jetzt + dur*1000`. In dem
    Ausdruck steht weder `/2` noch `*500`. Gemessen an einer eingefügten, frei erfundenen
    Missionsart: der neue Detektor schlägt an, **der alte hätte sie stillschweigend durchgelassen**.
    **Die Ursache war, dass das Muster das SYMPTOM beschrieb statt der URSACHE.** „Halbiert den
    Ausdruck" ist eine von zwei Arten, einwegig zu sein; „schöpft aus einer Einweg-Dauerquelle" ist
    die andere und die eigentliche. Ein Muster, das eine einzelne Schreibweise kodiert, ist eine
    namensbasierte Suche in Verkleidung – mit genau deren Schwäche (Regel 40). **Vorgehen:** Beim
    Bau eines musterbasierten Wächters die Frage stellen, welche Größe die Regel wirklich verletzt,
    und nach DER suchen; danach die eigene Anlassfamilie als Gegenprobe einspeisen – schlägt der
    Wächter am ursprünglichen Vorfall nicht an, ist er keiner. Und der Detektor muss **belegen, dass
    er seine Quelle findet** (`1j-quelle`: mindestens zwei Blöcke leiten aus `relocationDuration`
    ab), sonst erblindet er still, sobald die Quelle umbenannt wird.
    **Zweite Hälfte desselben Vorfalls, und sie ist Regel 39 an einem Test, der eine ZAHLUNG
    schützt:** `1k-treibstoff` prüfte `missionFuelCostSplit(flug, flotte)` über die GANZE Datei.
    Denselben Aufruf enthält auch die Vorschau. Fällt die Startfunktion auf `flug/2` zurück, kündigt
    der Dialog weiter die Rundreise an, abgebucht wird die Hälfte – und die Prüfung bleibt grün, weil
    der Treffer aus der Vorschau kommt (an einer sabotierten Kopie gemessen: genau so). Jede Prüfung,
    deren Suchbegriff auch an einer ANZEIGE-Stelle vorkommt, muss auf die Stelle gescopt werden,
    deren VERHALTEN sie schützt – und der Anker dieses Bereichs gehört selbst geprüft (`1k-bereich`),
    sonst ist die Aussage vacuous (Regel 6).

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
47. **Eine Prüfung auf eine TOAST-Meldung konkurriert mit der Ereignis-Salve des Spiels – der
    Stapel hält nur drei, und die älteste fliegt SYNCHRON raus.** Vorfall 17.08.2026:
    `test_wachauf_nachholen` einzeln grün, im Suite-Lauf rot („(nicht gefunden)"). Kein
    Test-Artefakt: Beim Stunden-Nachholen feuert eine Meldungs-Salve (das Planeten-Ereignis bei
    ungepinnten Uhren GARANTIERT – Regel 18 –, dazu Händler/Raid/Tagesreset je nach Lauf), und ab
    vier Meldungen verdrängte sie ausgerechnet die geprüfte Erklärzeile, bevor der 120-ms-Poll sie
    sah – für den SPIELER genauso unsichtbar, denn `#log` darüber überschreibt sich mit jeder
    Meldung selbst. Behoben in beiden Hälften: `pushToast` wirft beim Überlauf zuerst Unwichtige
    raus (`toast-wichtig`; Rückfall auf `firstChild`, sonst liefe die Schleife bei lauter
    Wichtigen endlos), die drei Nachhol-/Rückkehr-Zeilen tragen die Marke
    (`test_toast_verdraengung.js` führt den ECHTEN Block mit dem echten `escapeHtml` aus, Regel
    36/43), und die Wachauf-Fixture pinnt ihre Ereignis-Uhren, damit sie die NACHHOLUNG misst und
    nicht die Toast-Konkurrenz. Übertragbar: (a) Wer eine neue „diese eine Zeile erklärt den
    ganzen Vorgang"-Meldung baut, markiert sie als `wichtig`; (b) bei „einzeln grün, in der Suite
    rot" an einem Toast-Test zuerst die SALVENGRÖSSE verdächtigen, nicht die Last – dieselbe
    Familie wie Regel 20, und der Fehlschlag muss ausgeben, was STATTDESSEN zu sehen war
    (Regel 37).

    **Nachtrag 17.08.2026 – dieselbe Falle eine Etage tiefer: `#log`.** Noch am selben Tag fiel
    `test_fundort_knopf` in der Suite und blieb einzeln grün. Er misst nicht den Toast, sondern
    `#log` – und der hat gar keinen Stapel, er **überschreibt sich mit jeder Meldung selbst**. Der
    Knopf hatte seine Auskunft korrekt erzeugt (die Prüfung davor, der Sprung auf die Karte, war
    grün); eine beliebige spätere Zeile hatte sie nur ersetzt, bevor der Test 1,2 s danach ablas.
    Der Fehlschlag meldete `""`, weil er nur den fehlenden Treffer ausgab – was dort STATTDESSEN
    stand, verschwieg er. **Vorgehen:** Jede Prüfung auf eine Protokollzeile misst den
    MITSCHNITT, nicht den Endstand – `MutationObserver` auf `#log` per `addInitScript`, der jede
    Änderung in ein Array schiebt (läuft damit vor dem ersten Tick und sammelt lückenlos). Die
    geprüfte Aussage ist „die Zeile ist ERSCHIENEN", nicht „sie steht am Ende noch da" – das sind
    zwei verschiedene Fragen, und nur die erste gehört dem Knopf. Der Beleg im Fehlschlag zeigt
    bei fehlendem Treffer die letzten Zeilen des Mitschnitts.
    **Und zur Gegenprobe selbst, weil sie fast wertlos geblieben wäre:** Der erste Versuch stellte
    den Fehlerfall mit `log('…')` her – die Funktion lebt im Modulscope der Spieldatei und ist von
    außen nicht aufrufbar, der Aufruf lief stumm ins Leere, beide Lesarten sahen die Zeile, und
    die Probe meldete „nicht aussagekräftig" statt eines Befunds. Wer eine Spielmeldung von außen
    nachstellen will, schreibt `#log` direkt (`innerHTML =`) – also genau das, was `log()` intern
    tut (dieselbe Familie wie Regel 15/17/19: nie ein Messwerkzeug, das sich selbst im Weg steht).
48. **Ein Fix, der die teure OPERATION ersetzt, aber dieselbe PIXELFLÄCHE mit derselben FREQUENZ
    bewegt, ändert NICHTS – und das merkt nur, wer nach dem Fix DIESELBE Messung wiederholt.**
    Vorfall 17.08.2026 (KB-9a, „steckt im zoom einige sekunden"): Die Ausschluss-Messung hatte die
    zwei Deko-Nebel des Seitenhintergrunds als ~89 % der Hauptthread-Last überführt (9.521 →
    1.035 ms Long Tasks je 10 s ohne sie). Der naheliegende Fix – Verlauf je Nebel EINMAL in eine
    Kachel vorrendern, je Frame nur noch `drawImage` – brachte exakt null (9.567 ms): Teuer war
    nie die Verlaufs-ERZEUGUNG, sondern das Bewegen der Megapixel-Fläche in jedem der 30 Frames;
    ein Blit derselben Größe schaufelt dieselben Pixel. Getragen hat erst, Fläche×Frequenz zu
    senken: eigene Leinwand `#bgnebel`, neu gemalt nur bei geändertem quantisiertem Drift-Versatz
    (~alle paar Sekunden) – danach 1.174 ms, exakt das Profil der Ausschluss-Messung. Zweite
    Hälfte desselben Vorfalls: Die Quantisierung war zuerst 2 px und malte je nach Driftphase bis
    zu ~3×/s – auch DAS fiel nur an der wiederholten Messung auf, nicht am Code. Vorgehen:
    (a) Nach jedem Fix-Versuch DIESELBE Messung fahren, die den Befund geliefert hat – „plausibel
    behoben" ist kein Messwert (dieselbe Familie wie Regel 11/20); (b) bei Mal-/Kompositions-
    kosten zuerst fragen, welche FLÄCHE wie OFT bewegt wird, nicht welches Werkzeug sie bewegt.
49. **Wer eine FLÄCHE verkleinert, muss alles nachmessen, was frei darin positioniert ist – und
    „sichtbar" ist dabei nicht dasselbe wie „bedienbar".** Vorfall 17.08.2026 (KB-10 → KB-11):
    Die Kastenhöhe der Systemebene fiel von 420 auf 230 px. Darin schwebten zwei Overlays, die
    sich vorher nie begegnet waren: der ›-Blätterknopf (rechts mittig) und der senkrechte
    Zoomstapel (rechts unten, 3 Knöpfe = 120 px). Im kleineren Kasten überlappten sie, und weil
    der Stapel später im DOM steht, fing ER die Taps: `document.elementFromPoint()` auf der
    Mitte des ›-Knopfes lieferte `galaxyZoomInBtn`. Der Spieler tippte auf „nächstes System"
    und zoomte. **Jeder Test, der nur `style.display !== 'none'` oder `offsetParent` prüft,
    meldet hier grün** – der Knopf ist ja da und sichtbar. **Vorgehen:** (a) Nach jeder
    Größenänderung eines Containers alle `position:absolute`-Kinder darin auf Überlappung
    prüfen (Rechtecke schneiden), nicht nur den geänderten Teil; (b) Bedienbarkeit von Knöpfen
    über `elementFromPoint` auf ihre MITTE testen – das ist die einzige Prüfung, die „der Tap
    kommt an" wirklich misst; (c) dabei die Gegenrichtung mitprüfen, damit die Reparatur nicht
    still ein anderes Verhalten aufhebt (hier: Blättern darf NICHT scrollen, das erste Öffnen
    weiterhin schon).
50. **Wer eine ZEICHNUNG nur für einen Formfaktor umbaut, muss jede daran hängende Kennzahl an
    DIESELBE Schranke hängen – sonst wirkt die Anpassung ausgerechnet dort, wo die alte Zeichnung
    noch gilt.** Vorfall 17.08.2026 (KB-12): Die Orbit-Geometrie wurde am schmalen Kasten runder
    gelegt (`kbOrbitMass`, ab da hinter `window.innerWidth <= 700`), die zugehörige Kastenhöhe
    aber BEDINGUNGSLOS von 0,44 auf 0,78 der Breite gezogen – am PC, wo die flache Zeichnung
    unverändert weitergilt, wuchs der Kasten dadurch von 325 auf 480 px. Sichtbar war das kaum
    (nur mehr toter Raum), kaputt war etwas anderes: Die Kastenmitte lag jetzt unterhalb des
    Fensters, `elementFromPoint` dort lieferte `null`, und das Ziehen der Karte kam gar nicht mehr
    an (`test_kartenbedienung` 2a/2b, Treue 1 → 0, „bewegt: 0" auf beiden Achsen). Die erste
    Diagnose war falsch und hat Zeit gekostet – verdächtigt wurde ein Layout-Thrashing durch
    `getBoundingClientRect` in der neuen Geometriefunktion, umgebaut auf `window.innerWidth`, und
    der Test blieb rot. Gefunden hat es erst eine Messung, die NEBEN dem Messwert auch das Umfeld
    ausgab (viewBox, Kastenmaße UND `elementFromPoint` auf dem Zieh-Punkt) – dieselbe Familie wie
    Regel 37: Ein Fehlschlag, der nur „0 bewegt" meldet, sagt nicht, dass der Zeiger gar nichts
    getroffen hat. **Vorgehen:** (a) Beim Umbau für einen Formfaktor die Schranke EINMAL als
    benannte Funktion hinschreiben (`kbSchmalerKasten()`) und jede abhängige Stelle daran hängen –
    der Ersetzer prüft am Ende, dass sie an ALLEN Stellen benutzt wird; (b) den anderen
    Formfaktor als eigene Prüfung führen, nicht als Annahme (`test_kartengroesse` 3/3b misst den
    PC-Kasten mit, obwohl KB-12 nur das Handy betraf).
51. **Ein Testselektor, der eine Form über ihr GEOMETRIE-Attribut sucht, trifft auch ihre Maske in
    `<defs>` – und die liefert ein leeres Rechteck bei 0/0.** Aus derselben Etappe: `test_kartengroesse`
    suchte die Planetenscheibe als „`circle` mit r=11 oder 14". Texturierte Planeten tragen genau
    denselben Radius ein zweites Mal in einem `<clipPath>`; `getBoundingClientRect` liefert dort
    0/0, und der Test meldete 7 von 8 Planeten als „außerhalb des Kartenkastens" – am PC-Stand
    ebenso, wo sich gar nichts geändert hatte. Das ist Regel 39 eine Ebene tiefer (nicht eine
    zweite Tabelle mit demselben Schlüssel, sondern ein zweites Element mit demselben Attribut).
    **Vorgehen:** Anzeigeelemente über ihre BENANNTE Rolle greifen (`image`, `circle.body`), nicht
    über einen Zahlenwert, den auch Hilfskonstrukte tragen – und ein Messwert, der auf dem
    UNVERÄNDERTEN Stand genauso ausfällt, ist ein Werkzeugfehler, kein Befund.
52. **Wer eine Geometrie umbaut, muss auch alles nachmessen, was auf EIGENEN, fest verdrahteten
    Bahnen im selben Raum liegt – und die Einzelfall-Lösung, die einen solchen Konflikt schon
    einmal behoben hat, ist der Hinweis, dass es weitere Betroffene gibt.** Vorfall 17.08.2026
    (KB-13, Fehler aus der eigenen Auslieferung v8.553.0): KB-12 legte die Planetenbahnen am
    schmalen Kasten enger und runder. Die Marker (NPC, Boss, fremde Spieler, eigene Heimatbasis)
    saßen aber auf eigenen Bahnen aus der alten Streifen-Geometrie (`homeSlotXY` Kreis r=50,
    `npcMarkerXY` Ellipse 78×24), beide seinerzeit auf die ALTE erste Planetenbahn hin gewählt.
    Gemessen über alle 77 Systeme: vor KB-12 lagen 0 von 15 Markern auf einer Planetenscheibe,
    danach **15 von 15** – jedes System mit NPC, Mittenabstand 17,1 bei nötigen 22–27,7 Einheiten.
    Kein Test hat es bemerkt, weil keiner Marker gegen Planeten prüfte; gefunden wurde es beim
    Nachmessen einer ganz anderen Vermutung. Bezeichnend: Für die HEIMATBASIS gab es den
    Kollisionsschieber längst, samt Kommentar über den Spieler-Report, der ihn ausgelöst hatte
    („Prime direkt auf der Heimatbasis") – als einzige Kopie. **Eine solche Einzelfall-Lösung ist
    ein Inventar-Hinweis wie in Regel 44: Wer sie findet, fragt sofort, wer denselben Konflikt
    haben kann und ihn nicht gelöst bekommt.** Behoben, indem der Schieber zu EINER Funktion wurde
    (`kbMarkerFrei`), die alle drei Markerarten benutzen, und beide Markerbahnen aus derselben
    Quelle wie die Planeten abgeleitet werden (`kbOrbitRx(1)`; am PC nachgemessen byte-identisch).
    Wächter `tests/test_kartenmarker.js`.
53. **Ein Fix, der etwas VERSCHIEBT, erzeugt Kollisionen an der neuen Stelle – also nach dem Fix
    alle Paarungen messen, nicht nur die reparierte.** Aus derselben Etappe, in drei Runden:
    (a) Der Schieber rückte die Marker frei, aber die NPC-NAMEN standen weiter unter dem Marker
    und lagen nun auf den Planetennamen (gemessen: 11 von 15 Systemen) – behoben, indem
    Marker-Namen über den Marker wandern, wo nie ein Planetenname steht. (b) Ein Boss blieb übrig,
    weil sein pulsierender Ring (r bis 19) größer ist als der Mindestabstand – der Schieber kennt
    jetzt den sichtbaren Markerradius. (c) Danach zeigte der Screenshot einen Namen quer über einer
    fremden Scheibe, also die dritte Paarung TEXT×SCHEIBE, die bis dahin niemand gemessen hatte.
    **Die Paarungen sind Marker×Scheibe, Text×Text und Text×Scheibe – wer nur die erste prüft,
    hält eine Verschiebung für eine Lösung.** Zum dritten Fall die zweite Lehre: Er ist ALT
    („Deine Basis" liegt an beiden Formfaktoren und schon vor KB-12 auf dem Nachbarplaneten Rhea)
    und hängt an der Textlänge, nicht an den Markerpositionen. Er ist deshalb bewusst **keine**
    Prüfung, sondern eine INFO-Zeile im Test: Eine Prüfung, die vom ersten Tag an rot ist, wird zu
    einem dauerhaft ignorierten Fehlschlag und entwertet den ganzen Lauf. Offen als eigene Etappe.
    **Nachtrag 18.08.2026 – erledigt als KB-16 (Label-Ausweichlogik), und die Umsetzung hat Regel 53
    ein zweites Mal bestätigt:** Der erste Entwurf erlaubte 42 Einheiten Versatz. Damit fand jedes
    Label einen freien Platz, die gemessene Kollisionszahl stand auf 0 – und „Deine Basis" war so
    weit gewandert, dass es unter dem NACHBARPLANETEN Rhea stand und optisch zu diesem gehörte. Die
    Paarung, die ich gelöst hatte, war gemessen; die, die ich zerstört hatte (Label→Objekt), nicht.
    Gesehen nur am Screenshot. Seitdem ist der Versatz gedeckelt (senkrecht 21, danach seitlich 12
    Einheiten), und findet sich darin kein freier Platz, bleibt das Label an seinem Objekt – eine
    überlappende Beschriftung ist ehrlicher als eine, die beim falschen Planeten steht.
    `test_kartenbeschriftung` prüft deshalb NEBEN der Kollisionsfreiheit den Abstand jedes Labels zu
    SEINEM Objekt; die Gegenprobe an einer Kopie ohne Deckel fällt genau daran (56,8 statt max. 48).
    **Nachtrag 19.08.2026 – KB-17, und die übersehene Paarung war diesmal MARKER×MARKER.** Phase 3
    setzt bis zu drei Nester in dasselbe System. Alle drei liefen durch `kbMarkerFrei()`, also durch
    genau den Schieber, den KB-13 gegen diese Fehlerklasse gebaut hat – und lagen im gerenderten
    Bild trotzdem übereinander. Der Grund: Der Schieber kannte Sonne und Planeten, aber **nicht die
    anderen Marker**. Er schob jeden von ihnen auf dieselbe freie Stelle. Kein Test sah es;
    `test_kartenmarker` prüfte Marker×Scheibe und Text×Text, nicht Marker×Marker. Gefunden allein am
    Screenshot (Regel 42).
    **Drei Ursachen steckten dahinter, jede allein hätte gereicht:**
    (a) **Mehr WINKEL trennt auf einer flachen Bahn nicht.** Die Nestbahn übernahm `ry` aus
    `kbOrbitMass()` – am PC 0,30. Gemessen: 44° Schritt = 41 Einheiten (nötig 43), 60° = 27 bei
    vieren, und erst `ry` 0,60 mit 72° = 60 Einheiten. Auf einer flachen Ellipse entsteht der
    Abstand fast nur aus der X-Differenz, und der Kosinus ist symmetrisch – das vierte Nest landet
    wieder neben dem ersten. **Wer Marker auf einer Bahn auffächert, rechnet den ABSTAND nach, nicht
    den Winkel.** `homeSlotXY` benutzt aus genau diesem Grund seit jeher einen KREIS; die Einsicht
    war da und stand nur an der falschen Stelle.
    (b) **`markerR` muss der SICHTBARE Radius sein, nicht der gezeichnete.** Der Nest-Knoten pulst
    auf das Doppelte, übergeben wurde zuerst `r`. Das ist dieselbe Ursache wie beim Boss-Puls in (b)
    oben, zum zweiten Mal – weil der AUFRUFER den Wert liefert und der Schieber ihn nicht selbst
    ermitteln kann. Wer eine neue Markerart anmeldet, gibt ihren sichtbaren Hof an, nicht ihren
    Zeichenradius.
    (c) **Eine Schieber-Schleife kann an den VERSUCHEN scheitern statt am Platz.** 14 Anläufe mal
    5 Einheiten Schrittweite am schmalen Kasten reichen für 70 Einheiten; die Königin mit ihrem
    30-Einheiten-Hof blieb dadurch bei 32,1 statt 41 stehen und gab auf – sie lieferte also genau
    die Kollision zurück, gegen die sie gebaut ist, ohne ein einziges Anzeichen. Ein Schieber, der
    aufgibt, muss das entweder melden oder genug Anläufe haben (jetzt 24).
    **Übertragbar über die Karte hinaus: Wer einen Kollisionsschieber um eine neue Objektart
    erweitert, muss ihm die schon PLATZIERTEN Objekte bekannt machen** – ein Schieber, der nur den
    festen Untergrund kennt, schiebt alle Beweglichen auf denselben Fleck, und je mehr Arten
    dazukommen, desto sicherer. `buildMap` führt deshalb `platzierteMarker`; Festung, Asteroiden,
    Nester, Heimatbasis, fremde Spieler und NPCs melden sich dort an. `test_kartenmarker` prüft die
    Paarung seither als eigene Zeile (1b); die Gegenprobe am Stand vor KB-17 fällt mit vier
    Fehlschlägen, darunter 18,6 statt der nötigen 42,4 Einheiten zwischen zwei Nestern am PC.
55. **Wer einer KOMPAKTKARTE etwas hinzufügt, muss nachsehen, ob es hinter dem „Details"-Griff
    landet – „im DOM vorhanden" ist nicht „für den Spieler sichtbar".** Vorfall 18.08.2026 (VT-1,
    Kennwert-Balken der Verteidigungsanlagen): Die Balken wurden an `prodLine` angehängt, weil dort
    die bisherige Wirkungszeile stand. `prodLine` liegt aber in
    `<details class="karten-info">` – auf jeder GEBAUTEN Anlage waren sie damit zugeklappt;
    sichtbar waren sie nur auf den gesperrten Karten, die keinen Griff haben. Ein Test auf
    „`.sstat` existiert" wäre grün gewesen, ein Blick in den Quelltext ebenfalls unauffällig –
    aufgefallen ist es allein am gerenderten Screenshot (Regel 42). Die Schiffskarten machen es
    richtig: Dort liegen die Balken im Kartenkörper, und der Patchnote zum Kompakt-Umbau hält
    ausdrücklich fest, dass „Statusbalken, Marken, Kosten, Baufortschritt und alle Knöpfe immer
    sichtbar bleiben" – hinter den Griff gehört nur Erklärtext. **Vorgehen:** (a) Beim Einhängen in
    eine Karte die umgebende Struktur lesen, nicht nur die Variable, an die man anhängt;
    (b) die Prüfung darauf misst SICHTBARKEIT, nicht Existenz – `closest('details')` und dessen
    `open`-Zustand bzw. eine gemessene Höhe > 0 (`test_verteidigungsbalken` Abschnitt 2, Gegenprobe
    an einer Kopie mit den Balken zurück im Griff).

49. **Die Happy Hour ist die ZWEITE ungepinnte Ereignis-Uhr – und sie lässt sich nicht über den
    Spielstand pinnen.** Vorfall 17.08.2026: `test_kleine_luecken` fiel im Suite-Lauf an
    `1c-vorab` (`{"vor":"4.72","nach":"5.55","abweichung":"17.6 %"}`) und blieb einzeln grün –
    dasselbe Bild wie beim Planeten-Ereignis-Vorfall (Regel 20/21), nur mit einer anderen Uhr.
    Das Fixture pinnt `nextPlanetEventCheck` und `nextTraderCheck`, weil beide IM Spielstand
    stehen; die Happy Hour steht dort nicht. Sie läuft deterministisch **12:00–13:00 und
    20:00–21:00 LOKALER Zeit** (`HAPPY_HOUR_WINDOWS`) und multipliziert in `ratesPerSecond` genau
    die gemessene Erz-Rate (Typ `bergbau` +40 % Erz/Kristalle, `alle` +25 % auf alles). Dazu
    liest `currentHappyHour()` **`new Date()`** – der übliche Test-Patch fasst nur `Date.now()`
    an und schiebt sie deshalb nicht mit.
    **Wie der Mechanismus belegt wurde (Regel 20: erst der Mechanismus, dann der Befund):** Zwei
    Läufe um 20:23 und 20:27 UTC – also MITTEN im Fenster – standen beide stabil auf exakt 5,55.
    Damit ist 5,55 die Rate MIT und 4,72 die ohne Happy Hour, und der Sprung lag exakt auf der
    20:00-Grenze. Ohne diese zweite Messung hätte „+17,6 % Produktion" wie eine echte Regression
    der gerade gebauten Änderung ausgesehen.
    **Vorgehen für jeden Test, der eine Produktionsrate als Bezugsgröße nutzt:** (a) Damit rechnen,
    dass die Rate an vier festen Uhrzeiten je Tag springt – ein Lauf über eine Fenstergrenze misst
    zwei verschiedene Welten; (b) die Konstanz nicht nur PRÜFEN, sondern bei erkannter Wanderung
    das Messfenster WIEDERHOLEN (`test_kleine_luecken` 1c: max. 3 Anläufe, alle Raten im
    Fehlschlag protokolliert) – eine Fenstergrenze trifft höchstens einen Anlauf; (c) die Schranke
    dabei NICHT lockern (Regel 26) – sie ist bei 1c die einzige Stelle, an der eine echte
    Überzahlung auffällt, und die Gegenprobe gegen eine sabotierte Kopie
    (`applyOfflineProgress(luecke)` statt `luecke-1`) muss weiterhin mit ~107 % anschlagen,
    während `1c-vorab` grün bleibt.

    **Nachtrag 28.08.2026 – dieselbe Flanke an einem ZWEITEN Test, und die Wache hat eine
    benennbare Grenze.** `test_phantomsekunden` 2c hielt den Zuwachs seiner Auftau-Phase gegen
    eine Rate, die 45 Sekunden vorher gemessen worden war, und meldete im Suite-Lauf 80,0 % –
    exakt 5,99/7,49, also das Ende einer Happy Hour zwischen Phase A und Phase C. Behoben nach
    demselben Muster (Rate vor UND nach dem Messfenster, `2c-vorab` prüft zuerst die Konstanz,
    bei nachgewiesener Wanderung wird wiederholt); die Schranke von 2c blieb unangetastet.
    **Der Anlassfall ist dabei deterministisch nachgestellt worden statt auf eine Fenstergrenze
    zu warten:** eine Kopie der Spieldatei, deren `currentHappyHour()` nach 30 Sekunden Laufzeit
    anspringt (`KEPLER_SPIELDATEI`). Am alten Stand fällt 2c mit 125,0 %, am neuen meldet Anlauf 1
    genau diese 125,0 % und Anlauf 2 steht bei 100,0 %.
    **Zwei Dinge daraus, die über den Einzelfall hinausgehen:** (a) Der erste Sabotage-Versuch gab
    `type:'alle'` als ZEICHENKETTE zurück – `hh.type` ist aber ein Objekt aus `HAPPY_HOUR_TYPES`
    mit `resources`/`pct`, und der Lauf starb an `.includes` auf `undefined` mit 0,0 % Anteil.
    Eine Sabotage, die etwas ANDERES kaputtmacht als gedacht, belegt nichts – sie muss den
    Anlassfall treffen, nicht bloß rot sein. (b) Die Wache kennt die Rate an ZWEI Punkten; ein
    Sprung, der dazwischen liegt und wieder zurückgeht, entgeht ihr (an einer alle 20 Sekunden
    flackernden Kopie gemessen: `2c-vorab` 1,3 %, während 2c mit 124,0 % fiel). Für die echte
    Happy Hour ist das kein Fall – sie springt an Stundengrenzen –, aber die Grenze steht
    namentlich im Test, statt sie durch eine dritte Schranke zu verdecken.

57. **Eine EINMALZAHLUNG muss in den SPEICHER passen, nicht nur in den Zufluss — und der Speicher
    ist in beiden Stufen gedeckelt.** Vorfall 18.08.2026 beim Bau der Bastionsmarken: Die
    Kostentabelle war sauber nach der Messkonvention aus `docs/verteidigung-flotte-konzept.md`
    kalibriert („ein Posten kostet so viele Sekunden, wie sein knappster Rohstoff braucht") und
    landete beim Endschritt bei **11,6 Mio Erz**. Gemessen im Browser an einem ambitionierten
    Endausbau (11 Standorte, Lagerkomplex 45, Kryolager auf der Maximalstufe 15, 500 Frachter)
    fasst das Basis-Lager aber **803.800**. Die Zahlung war also nicht teuer, sondern um den Faktor
    100 unbezahlbar; im Browser-Test stand der Kaufknopf grau, und zwar völlig zu Recht.
    **Die Konvention war nicht falsch — sie beantwortet eine andere Frage.** Sie misst, wie lange
    man auf eine Menge WARTET. Ob man sie im Moment der Zahlung überhaupt BESITZEN kann, ist eine
    zweite, unabhängige Schranke: `storageCap()` für Tier 1, `tier2StorageCap()` für Tier 2. Das
    ist dieselbe Familie wie Regel 41 (Protomaterie), nur mit der anderen Schranke — dort begrenzt
    der FLUSS, hier der SPEICHER.
    **Vorgehen für jede neue Einmalzahlung** (Marke, Freischaltung, Mega-Stufe, Shop-Posten):
    (a) Den größten Einzelposten gegen BEIDE Deckel rechnen, nicht gegen den Zufluss;
    (b) den Deckel MESSEN statt zu schätzen — er hängt an Gebäudestufen UND an der Frachterflotte
    (`LAGER_PER_SHIP`), eine Rechnung im Kopf trifft ihn nicht; (c) die Prüfung in den Test
    aufnehmen (`tests/test_bastionsmarken.js` 4d für Tier 2, 4g/4h für Tier 1, jeweils gegen den
    größten Schritt beim höchsten Klassenfaktor — beidseitig gegengeprüft: die alte Tabelle lässt
    beide anschlagen); (d) wenn der Deckel die Menge erdrückt, ist die richtige Antwort **Zeit**,
    nicht Material — Zeit ist die einzige Größe des Spiels ohne Lagerdeckel.

    **Befund am BESTEHENDEN Spiel, der dabei aufgefallen ist** (gemessen, nicht behauptet, und auf
    `SHIP_DEFS` gescopt — der erste Anlauf hatte Gebäude mitgegriffen, Regel 39): Bei **40 von 44
    Schiffsklassen** liegt der Mk-X-Schritt der Werftmarken über diesem gemessenen Deckel — vom
    Spionagekreuzer (860.000 Erz) bis zum Sternenbanner (17,2 Mio, 21× Lager). Der Deckel ist
    allerdings **nicht hart**: Jeder Großfrachter trägt +1.000 bei. Für den Jäger fehlen also nur
    57 weitere Großfrachter, fürs Schlachtschiff 4.701, fürs Sternenbanner 16.397 — der Weg über
    den Lagerkomplex ist dagegen tot (Stufe 46 kostet 1,9 Mio Erz, Stufe 56 schon 18 Mio). Die
    obersten Werftmarken der schweren Klassen verlangen damit faktisch eine Frachterflotte, die
    reiner Lagerraum ist. Das ist eine Balance-Entscheidung und gehört zur Schiffskosten-Reform,
    nicht in eine stille Korrektur.

59. **Ein Konstantenfeld, das nur der ANKÜNDIGUNGSTEXT liest, ist keine umgesetzte Mechanik – und
    ein `grep` nach dem Namen behauptet das Gegenteil.** Vorfall 18.08.2026 (Asteroidenfestungen,
    Backend): Die Stufentabelle führte neben `blockade` (Abbauladung) ein Feld `proto` mit
    0,50/0,75/1,00 für die Protomaterie-Drosselung – im Konzept der eigentliche Zahn der ganzen
    Blockade, weil Protomaterie die einzige Größe ist, die im Endspiel nicht in der Eigenproduktion
    untergeht. `grep "st.proto"` fand einen Treffer, sah also benutzt aus. Der einzige Treffer war
    die **Galaxie-Nachricht, die die Drosselung ankündigt** („drosselt … die Protomaterie um
    100 %"). Die Mechanik selbst existierte nicht: Die Protomaterie je Fuhre hängt im Frontend
    allein an der GRÖSSE des Vorkommens (`proto: protoJeFuhre(a)`), nicht an der Ladung – die
    Ladungskürzung erreicht sie nie. Der Server versprach dem Spieler also etwas, was kein Code
    einlöste. **Vorgehen:** Wer prüfen will, ob eine Tabellenspalte wirklich wirkt, sieht die
    Fundstellen einzeln an und fragt bei jeder, ob sie etwas BERECHNET oder nur etwas BEHAUPTET.
    Ein Treffer in einem Text-, Log- oder Tooltip-Bauteil zählt als „nicht benutzt". Das ist die
    Gegenrichtung zu Regel 32: Dort existiert eine Zahl nur zur Laufzeit und wird beim Suchen
    übersehen, hier existiert sie nur im Versprechen und wird beim Suchen fälschlich für vorhanden
    gehalten – und ein zu Unrecht für vorhanden gehaltener Mechanismus fällt nie wieder auf.
60. **Eine Backend-Phase, die eine spielersichtbare ZAHL ändert, darf nicht vor ihrem Frontend live
    gehen – und „jede Phase ist für sich auslieferbar" ist eine Behauptung, die man je Phase
    nachprüft.** Vorfall 18.08.2026: Das Konzept versprach für alle sechs Phasen „für sich
    auslieferbar und lässt das Spiel in einem sinnvollen Zustand zurück". Für Phase 1 stimmte das
    nicht: Ein Merge des Backends allein hätte binnen Stunden eine Festung entstehen lassen, deren
    Blockade die Abbauladung um bis zu 55 % kürzt, während das Frontend die ungekürzte Vorschau
    zeigt und den Grund nicht kennt – gemessen an `echt = daten.menge`, der Client verbucht
    kommentarlos den kleineren Serverwert. Eine stille Verschlechterung, für die ein Spieler zu
    Recht einen Fehlerbericht schreibt, und obendrein eine Galaxie-Nachricht, die eine Wirkung
    ankündigt, die es noch nicht gibt. **Dass der Merge die Auslieferung IST und beide Repos über
    getrennte fest verdrahtete Befehle desselben Webhooks live gehen, macht das zur Regel und nicht
    zur Vorsichtsmaßnahme** – dieselbe Asymmetrie hat den Deploy schon dreimal auseinanderlaufen
    lassen. **Vorgehen:** (a) Vor dem Merge einer Backend-Phase durchgehen, welche Zahl ein Spieler
    ohne das zugehörige Frontend anders sieht als vorher; ist es eine, gehört der auslösende Teil
    hinter einen benannten Schalter (`FESTUNG_SPAWN_AKTIV = false`), der im Frontend-PR umgelegt
    wird; (b) den Schalter in den Test aufnehmen, sonst kippt er unbemerkt früher
    (`test_festung_http.js` Abschnitt 10); (c) alles andere trotzdem sofort mergen – Endpunkte,
    Härtungen und Tests, die ohne Auslöser nichts tun, sind live besser als im Zweig.

61. **Ein Test, der das ETIKETT prüft statt der WIRKUNG, ist bei der Gegenprobe grün – und merkt
    es nicht.** Vorfall 18.08.2026 (Asteroidenfestungen, Frontend): `test_festung_ui` prüfte, dass
    die Abbau-Vorschau das Wort „gedrosselt" und den Stufennamen zeigt. Beides hängt am
    VORHANDENSEIN der Festung, nicht an der Rechnung. Die Gegenprobe – der Festungsfaktor aus
    `abbauPlan` entfernt – blieb deshalb **grün**: Der Erklärtext stand weiter da, die Ladung war
    unverändert voll, und der Test bemerkte nichts. Der Spieler hätte genau das erlebt, was diese
    ganze Phase verhindern soll: eine Zeile, die eine Drosselung ankündigt, und eine Zahl, die
    keine zeigt.
    **Vorgehen:** Zu jeder Prüfung „der Text sagt X" gehört eine, die X **misst**. Hier: dieselbe
    Flotte, dasselbe Vorkommen, einmal mit und einmal ohne Festung, und die angezeigte Ladung muss
    sich unterscheiden (gemessen 2,4k gegen 5,4k). Erst damit fällt die Gegenprobe – und zwar mit
    dem sprechenden Beleg `{"mitFestung":"5.4k","ohneFestung":"5.4k"}`. Das ist dieselbe Familie wie
    Regel 3 (die REGEL prüfen, nicht die Momentaufnahme), nur eine Stufe grundsätzlicher: nicht die
    Beschriftung der Regel prüfen, sondern die Regel.
62. **Eine Prüfung, die ihren Erwartungswert aus derselben Größe ableitet, die sie prüft, kann nicht
    fehlschlagen.** Aus derselben Etappe: `4b` prüfte, dass die Mission die vom Server gebuchte
    Menge trägt – `mission.ladung === round(gesendeterWunsch * 0,45)`. Schickt der Client
    versehentlich die schon gekürzte Zahl (Doppelkürzung, der Spieler bekäme 0,45 × 0,45 = 20 %
    statt 45 %), stimmt das Verhältnis **weiterhin**: 2430 → 1094 ist genauso „45 % des Gesendeten"
    wie 5400 → 2430. Die Gegenprobe lief grün durch.
    Aufgelöst hat es erst ein **absoluter Anker von außerhalb der Rechnung**: der Wunsch aus einem
    zweiten Lauf OHNE Festung. Er ist die Kapazität der Flotte, und die hängt nicht davon ab, ob
    eine Festung im System steht – beide Läufe müssen dieselbe Zahl senden. Damit fällt die
    Gegenprobe mit `{"mitFestung":2430,"ohneFestung":5400}`.
    **Vorgehen:** Bei jeder Prüfung der Form „Ergebnis == f(Eingabe)" fragen, ob ein Fehler BEIDE
    Seiten gleichzeitig verschiebt. Wenn ja, ist eine Bezugsgröße nötig, die der fehlerhafte Pfad
    nicht berührt – ein zweiter Lauf mit geänderter Bedingung, ein fester Erwartungswert aus dem
    Spiel, oder eine Invariante („diese Größe darf sich dadurch gar nicht ändern"). Das ist die
    Gegenrichtung zu Regel 2: Dort verrottet ein eingetippter Erwartungswert, hier fehlt einer.

65. **Ein Test, der seinen Messwert aus dem GESPEICHERTEN Spielstand liest, misst nur die
    Zeitpunkte, an denen `save()` gelaufen ist.** Vorfall 19.08.2026 (B4): Das Messfenster
    „Ressourcen vorher/nachher" las zweimal denselben Stand und meldete `zuwachsMit: 0` — der
    Spielstand wird nicht jede Sekunde geschrieben, sondern nur bei Ereignissen. Die Zahl sah aus
    wie ein Befund („der Abzweig frisst ALLES") und war ein Artefakt des Messwerkzeugs. Behoben,
    indem beide Enden des Fensters von einem Klick eingerahmt werden, der `save()` auslöst — der
    Stand ist dann an beiden Enden nachweislich frisch. Dieselbe Familie wie Regel 15/17/19: nie
    ein Messwerkzeug, das sich selbst im Weg steht.
    **Zweite Hälfte desselben Vorfalls, und sie ist Regel 4:** Gemessen wurde **Erz** — die
    Forschung, gegen die gemessen wurde, kostet aber gar kein Erz, sondern Kristalle, Deuterium und
    Forschungspunkte. Der Abzweig war korrekt und traf nur eine andere Ressource; der Test sah an
    seinem Gegenstand vorbei. Seitdem leitet er die gemessenen Ressourcen aus dem Spiel ab (die
    Schlüssel, die wirklich auf dem Konto liegen), statt sie zu benennen.
66. **Ein eigener `dialog`-Handler in Playwright schaltet die automatische Abweisung AB — wer den
    Dialog nur mitschreibt, lässt den auslösenden Klick für immer hängen.** Aus derselben Etappe:
    `page.on('dialog', d => protokoll.push(d.message()))` sah nach einem harmlosen Mitschnitt aus
    und ließ den Test in den 300-s-Timeout laufen. Der Handler MUSS `d.dismiss()` (oder
    `d.accept()`) aufrufen — und welches von beiden, ist zugleich die geprüfte Richtung: Abbrechen
    darf nichts entfernen, Bestätigen schon.
67. **Lässt sich ein Codepfad im Test nicht herstellen, ist die Frage nicht, wie man ihn erzwingt,
    sondern warum es ihn gibt — und die Antwort ist manchmal ein echter Fund.** Aus derselben
    Etappe: Der Versuch, den Erforschen-Knopf mit gedecktem Baustellen-Konto zu messen, lief auf
    ein leeres Konto. Grund: `baustelleAufraeumen` löst ein Konto auf, sobald sein Posten die
    Warteschlange verlässt — der Kartenpfad ist für ein angespartes Konto also unerreichbar, und
    das war vorher niemandem klar. Der Umweg über diese Frage hat den eigentlichen Fund geliefert:
    Die Rückgabe klemmt am Lagerdeckel, ein Konto ist kurz vor dem Ziel zwangsläufig größer als
    der Deckel, und ein Fehlgriff auf das ✕ hätte tagelanges Ansparen vernichtet — mit der
    Erklärung nur im Protokoll, also nach der Tat. Daraus wurde die Rückfrage vor dem Entfernen.
    **Ein unerreichbarer Pfad ist kein Testproblem, sondern eine Aussage über das Bauwerk.**

68. **Ein Test kann einen Fehler als REGEL festhalten – dann ist er nicht der Wächter, sondern der
    Grund, warum niemand hinsieht.** Vorfall 19.08.2026: Die drei PvE-Auflösungen (Anfechtung,
    Festungsschlag, Nest-Schlag) gaben beim Auflösen die ÜBERLEBENDEN wieder in `fleet` – die
    Schiffe stehen dort aber die ganze Mission über schon drin (nur der Flottenplatz ist belegt,
    `computeAwayByType` hält sie von einer zweiten Verplanung zurück). Gemessen: 20 Kreuzer im
    Bestand, 20 davon im Verband, 4 Verluste – danach standen **36** da. Ein Schlag mit der
    Vorauswahl verdoppelte den Bestand also nahezu, seit v8.491.0 und über drei Auslieferungen
    hinweg.
    **`test_geteiltes_asteroidfeld` 8e hat genau das verlangt**: `nachher === vorher + mitgeflogen
    − Verluste`, und `vorher` wird gelesen, NACHDEM die Mission gestartet ist. Der Test war grün,
    seine Formulierung („die Schiffe sind zurück – abzüglich GENAU der Verluste des Servers") las
    sich richtig, und er hat den Fehler dadurch drei Auslieferungen lang zementiert: Wer die
    Rechnung anfasste, wurde von ihm zurückgepfiffen.
    **Vorgehen:** (a) Eine Erwartung, die eine SUMME aus zwei Größen bildet, muss benennen, wo
    jede herkommt – hier hätte die Frage „ist `mitgeflogen` in `vorher` schon enthalten?" gereicht;
    (b) zu jeder Prüfung „der Endstand ist X" gehört die Gegenrichtung als eigene Zeile („und der
    Bestand ist dabei NICHT gewachsen", jetzt 8e2) – eine Invariante fällt auf, wo ein Erwartungs-
    wert mitwandert (dieselbe Familie wie Regel 62); (c) wer einen Fehler behebt, für den ein Test
    grün ist, korrigiert den TEST und schreibt den Messwert in seinen Kommentar, statt ihn
    stillschweigend anzupassen.
69. **Vor dem Bau eines größeren Vorhabens prüfen, ob es auf `origin/main` schon steht – nicht nur,
    ob die eigene VERSIONSNUMMER frei ist.** Vorfall 19.08.2026: Die Alien-Nester Phase 3
    (Frontend) wurde in zwei Sitzungen parallel gebaut. Die andere war zuerst fertig und ging als
    v8.582.0 (#448) live; meine Fassung war damit ein Duplikat – Kartenknoten, Kartenmenü,
    Angriffsmission, Bericht, Hilfetext und sogar `test_nest_ui.js`/`test_nest_paritaet.js` gab es
    danach zweimal. `naechste-version.js` hätte das nicht gemeldet, es prüft nur Nummern; gemerkt
    habe ich es erst beim `git fetch` vor dem vollen Lauf, also nach der ganzen Arbeit.
    **Richtig ist NICHT, den Konflikt aufzulösen** (dabei verschwindet still die eine oder die
    andere Fassung, Regel 23): neu auf `origin/main` aufsetzen und nur das behalten, was dort
    wirklich fehlt. Hier war das der Flottenfehler aus Regel 68 – die fremde Lieferung hatte ihn
    vom Nachbarn geerbt, war also sogar der Anlass, ihn an EINER Stelle zu beheben.
    **Vorgehen:** Vor dem ersten Zeichen Code `git fetch && git log --oneline -5 origin/main` und
    die Betreffzeilen LESEN; bei einem Vorhaben aus einer Phasenliste zusätzlich `git ls-tree
    origin/main tests/ | grep <thema>` – ein bereits gelieferter Wächter ist der sicherste Beleg,
    dass die Etappe schon steht. Und wer parallel arbeitet, sichert vor dem Neuaufsetzen JEDE Zeile
    aus `git status --short` (Regel 54).

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

    **Nachtrag 18.08.2026 – die Variante, bei der die Werkzeugmeldung nicht zu FRÜH, sondern
    einfach FALSCH ist.** Ein voller Lauf lief diesmal wirklich durch (52 Minuten, alle 265 Tests
    im Protokoll), und die Abschlussmeldung des Werkzeugs lautete „completed (exit code 0)". Im
    Protokoll stand:

    ```
    === Ergebnis ===
    270 Prüfungen, 1 fehlgeschlagen
    EXIT=1
    ```

    Die Null der Meldung war der Exit des äußeren Shell-Befehls (`node … > log 2>&1; echo EXIT=$? >> log`),
    dessen letztes Glied das `echo` ist – und ein `echo` gelingt immer. Das ist derselbe
    Mechanismus wie Regel 19 (`echo EXIT=$?` hinter einer Pipe), nur eine Ebene höher: Nicht die
    Pipe verdeckt den Test, sondern das Kommando, das den Marker schreibt. Der Fehlschlag war hier
    harmlos (die absichtlich zurückgestellte `index.html`-Gleichheit, Regel 23), aber die Meldung
    hätte genauso einen echten verdeckt.
    **Es gilt ausschliesslich die Marker-Zeile IM PROTOKOLL, nie das Exit-Feld der
    Werkzeugmeldung** – auch dann nicht, wenn der Lauf nachweislich vollständig durchgelaufen ist.
    Wer den Marker per `;` anhängt, macht die Werkzeugmeldung strukturell nutzlos; das ist in
    Ordnung, solange man sie auch nicht liest.
61. **Ein Prüflauf, der bei einem Fehlschlag nur GEFILTERTE Zeilen zeigt, verschweigt im
    Ernstfall genau die Zeile, die der Testautor für diesen Fall hinterlegt hat.** Vorfall
    18.08.2026: `test_reiterleiste.js` fiel im vollen Lauf, einzeln war er grün. Für exakt diesen
    Fall schreibt er eine Diagnosezeile – „WARNUNG - die Reiterleiste kam in 6 s nicht zur Ruhe,
    gemessen wird trotzdem". Im Protokoll stand sie nicht: `tests/run.js` zeigte bei einem
    Fehlschlag nur Zeilen, die auf `/^FAIL|Error|Cannot find/` passen, gekappt bei sechs. Die
    Antwort auf „hat die Wartelogik aufgegeben?" war damit weg, und die Fehlersuche begann bei
    null. Es ist der **einzige** Test im Repo, der so eine Zeile schreibt – und ausgerechnet der
    ist gefallen.
    Das ist dieselbe Familie wie Regel 25/37: Ein Messwerkzeug, das nur einen Teil der möglichen
    Ausgaben kennt, verschweigt im Fehlerfall die Ursache. **Die Lehre ist aber nicht „das Muster
    erweitern"** – ein Muster deckt immer nur den einen Fall ab, an den man gerade gedacht hat.
    Seit dem 18.08.2026 schreibt `run.js` bei jedem Fehlschlag die **vollständige** Ausgabe nach
    `<tmp>/kepler7-fehlschlaege/<test>.log` und nennt den Pfad im Protokoll; die sechs gefilterten
    Zeilen bleiben zusätzlich für die Lesbarkeit (`WARNUNG` gehört jetzt mit ins Muster).
    Beidseitig gegengeprüft an einem Wegwerf-Test, der eine WARNUNG-Zeile, eine FAIL-Zeile und
    eine musterlose Zeile schreibt: Der alte Stand zeigt **nur** die FAIL-Zeile, der neue alle
    drei bzw. die Datei mit allen dreien. **Wer eine neue Diagnosezeile in einen Test schreibt,
    muss sich seither nicht mehr fragen, ob das Muster sie kennt.**
    Nebenbei ein Werkzeugfehler bei genau dieser Gegenprobe, der die Regel bestätigt: Der erste
    Versuch fuhr den alten `run.js` aus dem Scratchpad – dort zeigt `__dirname` woandershin, der
    Lauf fand keinen einzigen Test und meldete stattdessen einen ENOENT auf die Spieldatei. Ein
    Prüflauf, der aus dem falschen Verzeichnis gestartet wird, misst nicht den alten Stand,
    sondern gar nichts (dieselbe Familie wie Regel 56).

19. **`echo EXIT=$?` hinter einer Pipe misst das LETZTE Pipe-Glied, nie den Test** – `node
    test.js | grep FAIL; echo EXIT=$?` meldet den grep-Status (0 = Treffer gefunden!). Vorfall
    09.08.2026: Ein roter Test schien dadurch grün gemeldet. Exit-Codes immer ohne Pipe messen
    (Ausgabe in Datei umleiten, `echo EXIT=$?` direkt dahinter) oder `${PIPESTATUS[0]}` nutzen –
    dieselbe Familie wie Regel 15/17: nie ein Messwerkzeug, das sich selbst im Weg steht.

    **Nachtrag 22.08.2026 – dieselbe Familie ohne jede Pipe: eine Kommandosubstitution VOR dem
    `$?`.** Ein Betroffenheits-Durchgang über 17 Tests meldete „alle grün" und war es nicht –
    einer war rot. Die Schleife lautete

    ```sh
    node tests/$t.js > log 2>&1; echo "$(printf '%-32s' $t) EXIT=$?"
    ```

    Die Substitution `$(printf …)` steht **links** vom `$?`, läuft also während der Expansion
    zuerst und setzt `$?` auf ihren eigenen Status. **Jedes gemeldete `EXIT=0` war der Status von
    `printf`.** Weder eine Pipe noch ein `;`-Kommando dazwischen – die bisherigen Formulierungen
    dieser Regel greifen hier also beide nicht, und genau deshalb ist es durchgerutscht.
    **Vorgehen:** Der Status wird UNMITTELBAR nach dem Befehl in eine Variable gelesen, bevor
    irgendeine andere Expansion läuft – danach darf beliebig formatiert werden:

    ```sh
    node tests/$t.js > log 2>&1
    rc=$?
    n=$(grep -cE '^(OK|FAIL) +- ' log)
    printf '%-32s EXIT=%s Pruefungen=%s\n' "$t" "$rc" "$n"
    ```

    Zweite Hälfte desselben Vorfalls, beim Vergleich zweier Läufe: `grep -oE '^(OK|FAIL) +- …'`
    nimmt das VERDIKT mit in den Vergleich – der `diff` meldet dann genau die eine Prüfung als
    Unterschied, die kippen SOLL, und „identische Prüfliste" ist nie erfüllt. Verglichen wird der
    reine Prüf-NAME (`sed -E 's/^(OK|FAIL) +- //'`).
54. **Ein Sicherungs-Patch vor einem Rebase wird mit `git diff HEAD -- datei` gebildet, nie mit
    `git diff -- datei` – und man prüft seine GRÖSSE, bevor man den Arbeitsbaum wegwirft.**
    Vorfall 17.08.2026, beim zweiten Rebase-Zyklus von KB-13: Die CLAUDE.md-Ergänzungen waren nach
    dem ERSTEN Rebase per `git apply --3way` eingespielt worden – und `git apply` legt seine
    Änderungen **vorgemerkt** ab. `git diff -- CLAUDE.md` zeigt aber nur Nicht-Vorgemerktes, lief
    also ins Leere und überschrieb die gute Sicherung aus dem ersten Zyklus mit einer 0-Byte-Datei.
    Der `git checkout -B … -f` unmittelbar danach hat die Arbeit dann endgültig entfernt; zwei
    ausführliche Regeln mussten aus dem Sitzungsverlauf neu geschrieben werden. Genau diese Falle
    steht in diesem Dokument schon einmal (Backend-Deploy: „`git diff` ist leer, zeigt nur
    Nicht-Vorgemerktes"), dort für einen halb angewendeten Pull. **Vorgehen:** (a) Sicherung immer
    gegen `HEAD` bilden; (b) `wc -c` auf den Patch, bevor irgendetwas zurückgesetzt wird – 0 Bytes
    heißt, es gibt keine Sicherung; (c) bei Dateien, die nicht aus einem Skript reproduzierbar
    sind (CLAUDE.md, neue Tests), lieber eine echte Kopie ablegen als einen Patch.

    **Nachtrag 19.08.2026 – die Regel steht da, und ich bin trotzdem hineingelaufen.** Beim
    Neuaufsetzen für P5 (Nummernkollision, zweimal hintereinander) habe ich vor dem
    `git checkout -f -B` sauber gesichert: den Patch der Spieldatei, `wc -c` geprüft, die neue
    Testdatei als echte Kopie. Die CLAUDE.md-Ergänzung, die ich eine halbe Stunde vorher
    geschrieben hatte, war in der Sicherung **nicht dabei** – sie war zu dem Zeitpunkt längst
    fertig und damit aus dem Blick. Der harte Checkout hat sie verworfen; aufgefallen ist es erst,
    weil `git status --short` unmittelbar vor dem Commit vier statt fünf Dateien zeigte.
    **Die Lücke ist nicht die Regel, sondern ihre Anwendung: Gesichert wird, woran man GERADE
    arbeitet – verloren geht, was schon fertig war.** Deshalb vor jedem `checkout -f`/`reset --hard`
    nicht überlegen, was zu sichern ist, sondern `git status --short` lesen und JEDE Zeile darin
    versorgen. Zwei Sekunden, und die Frage „habe ich an alles gedacht?" stellt sich nicht mehr.
    Bezeichnend: Die Backend-CLAUDE.md desselben Vorhabens überlebte, weil es dort keinen Checkout
    gab – der Unterschied war reines Glück, nicht Umsicht.
56. **Ein `cd` in den Nachbar-Klon und ein Testaufruf gehören NIE in denselben Befehl.** Vorfall
    18.08.2026, dreimal an einem Tag: `cd ../kolonie-kepler7-backend && git pull; for t in …; do
    node tests/$t.js; done` – der `cd` gilt für den Rest der Zeile, die Tests liefen also im
    BACKEND-Verzeichnis und starben an `MODULE_NOT_FOUND`. Die Ausgabe sah jedes Mal aus wie sechs
    rote Tests („EXIT=1"), war aber gar kein Testergebnis. Verräterisch ist allein die erste Zeile
    des Protokolls (`node:internal/modules/cjs/loader`), nicht der Exit-Code – dieselbe Familie wie
    Regel 25: Ein Messwerkzeug, das nur einen Teil der möglichen Ausgaben kennt, meldet einen
    Fehlschlag, wo keiner ist. **Vorgehen:** Backend-Pull als EIGENER Befehl, Testläufe als eigener
    Befehl mit vorangestelltem `cd /home/user/kolonie-kepler7 &&`. Und bei einem Fehlschlag, der
    ALLE Tests gleichzeitig trifft, zuerst die erste Protokollzeile ansehen: Ein echter Fehler
    trifft selten sechs unabhängige Tests auf einmal.

    **Nachtrag 21.08.2026 – schlimmer als hier steht: das Arbeitsverzeichnis überlebt den
    BEFEHL.** Die Regel oben sagt „nicht in denselben Befehl"; gemessen wirkt ein `cd` in den
    Nachbar-Klon auch in ALLEN FOLGENDEN Bash-Aufrufen weiter, weil das Werkzeug das
    Arbeitsverzeichnis zwischen den Aufrufen behält. Konkret passiert: Ein `cd
    ../kolonie-kepler7-backend` für einen Pull, drei Aufrufe später ein `grep` in `CLAUDE.md` –
    und gelesen wurde die BACKEND-CLAUDE.md. Die Suche lieferte „nichts gefunden", was wie eine
    fehlende Zielstelle aussieht und in Wahrheit die falsche Datei war. Verraten hat es allein die
    Zeilenzahl (1.704 statt 4.316) – dieselbe Familie wie Regel 10 („hat der Melder die veraltete
    `index.html` gelesen?"), nur beim eigenen Werkzeug.
    **Vorgehen:** JEDER Befehl bekommt sein Verzeichnis vorangestellt (`cd /home/user/kolonie-kepler7
    && …`), auch wenn der vorherige schon dort stand – und wer eine Suche in einer bekannten Datei
    ins Leere laufen sieht, prüft ZUERST `pwd` und die Dateigröße, bevor er die Zielstelle für
    verschwunden hält.

58. **Nach einem Rebase auf einen fremden Stand prüft „mein Bereich ist nicht betroffen" genau das
    Falsche – der Fehler, den man sich EINHANDELT, liegt im fremden Teil.** Vorfall 18.08.2026:
    Bei KB-13, VT-1 und KB-15 wurde je nach einem Rebase argumentiert, die fremde Lieferung berühre
    0 Zeilen des eigenen Bereichs (per `git diff` gemessen), und statt eines zweiten vollen Laufs
    liefen nur die betroffenen Tests plus `--nummer`. Das ist für die eigene Arbeit richtig und
    übersieht die andere Richtung: Mit v8.562.0 kam ein typografisches `"` in einen Patchnote, das
    `test_forschungstexte` (Hausstil der Anführungszeichen) reißt – und weil dieser Test weder zum
    Kartenbereich noch zu den vier `--nummer`-Tests gehört, ging **v8.564.0 mit rotem Prüflauf
    live**. Aufgefallen ist es erst beim nächsten vollen Lauf, eine Etappe später.
    Eine Historien-Messung über 60 Commits (`historie_pruefen.js` im Scratchpad-Muster: je Commit
    Anführungszeichen, Dateigleichheit, VERSION-zu-Patchnote und Syntax prüfen) zeigte vier
    betroffene Commits – alle vom selben Tag, alle Folge desselben einen Zeichens.
    **Vorgehen:** Nach einem Rebase mindestens `node tests/run.js --nur-pflicht` fahren; das kostet
    Sekunden und deckt genau die dateiweiten Prüfungen ab, die ein fremder Commit reißen kann.
    Der `--nummer`-Modus genügt dafür NICHT – er fährt nur die vier Tests am Patchnotes-Block.
59. **Ein Kommentar im Kopf der Datei darf das Trennzeichen NICHT wörtlich enthalten, an dem ein
    Werkzeug die Datei zerlegt.** Vorfall 18.08.2026 beim Einbau der CSP-meta-Zeilen: Der
    erklärende Kommentar darüber beschrieb, dass die ganze Spiellogik ein einziger
    Inline-Skriptblock ist – und schrieb das öffnende Skript-Tag dabei wörtlich hin. Der
    Pflicht-Syntax-Check (Punkt 1 der Checkliste) schneidet den Programmtext aber per
    `match(/<script>([\s\S]*)<\/script>/)` aus, also **ab dem ersten Vorkommen**. Der stand
    ab da im Kommentar, 56.000 Zeilen vor dem echten Block; der Check parste den Kommentartext
    und meldete `SyntaxError: Unexpected identifier 'also'` – einen Fehler, den es im Spiel gar
    nicht gab. Wer dem folgt, sucht im Programmtext nach einem Fehler, der im Kommentar steht.
    **Das ist Regel 6/33/46 eine Etage höher:** Dort zitiert ein Kommentar den TEXT, nach dem ein
    Werkzeug sucht; hier zitiert er das TRENNZEICHEN, an dem es die Datei zerteilt – die Wirkung
    ist ungleich größer, weil danach jede Aussage des Werkzeugs auf den falschen Ausschnitt geht.
    **Vorgehen:** Im Kopfbereich der Datei nie `<script>`/`</script>` wörtlich schreiben –
    „Inline-Skriptblock" umschreibt es gefahrlos. Und wenn der Syntax-Check nach einer reinen
    KOMMENTAR-Änderung anschlägt, ist der erste Verdacht nicht der Code, sondern der Ausschnitt:
    `node -e "const s=…; console.log(s.indexOf('<'+'script>'))"` gegen die erwartete Zeile halten.
60. **Ein `grep`-Zähler über ein Testprotokoll zählt auch dessen SCHLUSSZEILE mit.** Aus derselben
    Etappe: Zum Vergleich der Prüfungszahl zwischen grünem Lauf und Gegenprobe (Regel 34) wurde
    `grep -cE '^(OK  |FAIL)'` benutzt. Ergebnis: 7 gegen 8 – also scheinbar eine unvollständige
    Gegenprobe, mit genau dem Alarm, den Regel 34 verlangt. In Wahrheit endet ein roter Lauf mit
    der Zusammenfassungszeile `FAIL`, ein grüner mit `PASS`; nur die eine passte auf das Muster.
    Die Prüfungen waren beide Male dieselben sieben. **Vorgehen:** Auf das Trennzeichen der
    Prüfzeilen mitmatchen (`'^(OK|FAIL) +- '`), und die Prüf-NAMEN beider Läufe per `diff`
    vergleichen statt nur ihre Anzahl – das beantwortet die eigentliche Frage („liefen dieselben
    Prüfungen?") direkt, statt sie über eine Zahl zu erraten. Dieselbe Familie wie Regel 15/17/19:
    ein Messwerkzeug, das sich selbst im Weg steht.
57. **„Es fehlt" und „es ist unsichtbar" sind zwei verschiedene Befunde – und nur die Messung
    unterscheidet sie.** Vorfall 18.08.2026 (KB-15, Fokusring der Kartenknoten): Der Verdacht
    lautete „die Knoten haben keinen Fokusstil", belegt durch ein fehlendes CSS – es gibt keinen
    `.sektor-sys`-Block. `getComputedStyle` auf dem fokussierten `<g>` lieferte aber
    `outline-style: auto`, `outline-width: 5px`, `outline-color: rgb(16,16,16)`: Der Ring war da,
    der Browser malte ihn in Fast-Schwarz, und auf dem dunklen Kartengrund sah ihn niemand. Die
    Behebung ist dieselbe (eine sichtbare Farbe setzen), der TEST aber ein völlig anderer: „eine
    outline ist gesetzt" wäre schon vorher grün gewesen und hätte nichts belegt. Geprüft wird
    deshalb, dass die outline EXPLIZIT gesetzt ist (`style !== 'auto'`) und hell genug für dunklen
    Grund – die Gegenprobe am alten Stand meldet exakt `rgb(16,16,16)` / `auto` / 5 px.
    **Zweite Hälfte desselben Vorfalls, und sie ist die eigentliche Lehre:** Der erste Testentwurf
    verglich die Ringfarbe gegen die Hintergrundfarbe des Kartenkastens – der ist `rgba(0,0,0,0)`,
    und die ganze Elternkette bis zum `body` ebenso, weil die Seite ihren Grund über die
    Canvas-Leinwände `#bgnebel`/`#bgstars` malt. Der Vergleich lief damit gegen eine Farbe, die gar
    nichts malt, und war zufällig grün (Hausregel 21: erst die Bezugsgröße prüfen). Wo es keine
    CSS-Bezugsfarbe GIBT, ist eine absolute, begründete Schranke ehrlicher als ein Differenzwert
    gegen Nichts – und die Vorab-Prüfung hält fest, dass die Fläche wirklich transparent ist, damit
    die Wahl nachvollziehbar bleibt.
59. **Ein Schlüssel kann ein zweites Mal in DERSELBEN Tabelle stehen – als Rückverweis.** Vorfall
    18.08.2026 (TX-1): Der Ersetzer suchte die Zeile einer Forschung über
    `zeile.includes("key:'rmodultechnik'")` und fand ZWEI. Die zweite war der Nachbareintrag
    `rmodulslots`, der `requires:[{key:'rmodultechnik',level:5}]` trägt – und der hat selbst ein
    `desc:'`, hätte also ohne die `count !== 1`-Wache (Hausregel 16) den Text der falschen
    Forschung bekommen. Das ist Regel 39 eine Ebene tiefer: dort eine zweite TABELLE mit demselben
    Schlüssel, hier ein Rückverweis INNERHALB der Tabelle, den kein Scoping auf den Tabellenblock
    findet. **Vorgehen:** Den Schlüssel am EINTRAGSANFANG verankern (`/^\s*\{ ?key:'X',/`), nie
    irgendwo in der Zeile suchen. Und die Wache ist der Grund, warum es auffiel – ein Ersetzer ohne
    Trefferzahl-Prüfung hätte still den Nachbartext überschrieben, und `node --check` wäre grün
    geblieben, weil ein falscher Text syntaktisch einwandfrei ist.
60. **Wer Anzeigetexte umschreibt, muss vorher wissen, welche ZAHL welcher Test aus ihnen liest –
    und dass manche Prüfung eine SCHREIBWEISE festnagelt statt einer Regel.** Aus derselben Etappe,
    drei Befunde in einem Durchgang: (a) `rsingularitaet` muss jedes daran hängende Tor benennen,
    inklusive der „neun Tiefenschiffe" mit der HEUTIGEN Zahl als Zahlwort
    (`test_forschungsmeilensteine` 5b, bewusst streng, damit beim zehnten Schiff nicht weiter
    „neun" durchgeht) – beim Kürzen war sie mit rausgeflogen; (b) `autonomiekern` muss neben den
    Konstanten (45 Minuten, +6 Stunden, 8 Stufen) auch das ABGELEITETE Gesamtfenster „14 Stunden"
    nennen, also genau die Zahl, die der Spieler sonst selbst ausrechnen müsste; (c)
    `test_levelfortschritt` verlangt die Wortfolge „8 summierten Stufen" – das ist eine
    Momentaufnahme im Sinne von Regel 3 und blockiert eine Umformulierung. **Die Entscheidung dazu
    gehört zur Regel:** Der Text wurde an die Wortfolge angepasst, NICHT die Prüfung gelockert. Eine
    Etappe, die Texte umschreibt, darf nicht nebenbei die Wächter aufweichen, die genau diese Texte
    bewachen – sonst ist am Ende weder der Text noch die Prüfung belegt (Regel 26 in der
    Anwendung). Gefunden hat alle drei der Betroffenheits-Durchgang VOR dem vollen Lauf
    (`grep -ln "RESEARCH_DEFS\|BUILDING_DEFS\|effectDesc" tests/*.js`, dann jeden Treffer einzeln),
    Kosten zwei Minuten statt zweier 25-Minuten-Läufe – Regel 40 zum zweiten Mal bestätigt.

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
- **Wer einem BESTANDS-Gebäude nachträglich ein `maxLevel` gibt, braucht eine NEUE Kappungs-Marke** (16.08.2026, Labor-Deckel): `deckelKappung()` läuft einmalig je Marke; Bestandskonten tragen `deckelKappung2026`/`2026b` längst, mit einer alten Marke als Wache liefe die Kappung für das neue Gebäude dort nie – der Deckel „bedeutete für Bestandskonten nichts", exakt der Spieler-Report, der zum zweiten Durchgang führte. Ablauf: nächste Marke (`2026c` → `2026d` …) als Wache setzen, alle älteren mitsetzen, die neue Marke in BEIDEN Reset-Bewahrlisten ergänzen (Suchbegriff `deckelKappung2026`) UND in der Abstreif-Liste von `tests/test_t1_deckel.js` (der Kommentar dort verlangt es wörtlich; vergessen = Test fälschlich rot, weil die Kappung im Fixture sofort zurückkehrt). Die Schleife selbst ist generisch und idempotent – neuer Code ist nicht nötig. Das Labor bekam bewusst maxLevel 25 OHNE `flachAb`: Abflachung senkt vorhandene Raten (das war Teil des Minen-Umbaus), ein reiner Deckel nicht.
- **Ein temporärer Fehler darf NIE zur Abmeldung führen – und das serverseitige Rate-Limit gilt für ALLE `/api`-Routen** (Spieler-Report Sascha 17.08.2026: „400 Mio im Markt verkaufen, irgendwann werde ich einfach ausgeloggt"). Die Kette, komplett gemessen: Der Markt-Sammelauftrag zerlegt in Tranchen zu `MARKET_MAX_PER_TRADE` (1 Mio) und feuerte sie **ohne Pause** – bei 400 Mio also 400 Anfragen in einer knappen halben Minute. `app.use('/api', globalApiRateLimit)` im Backend deckelt aber **240 Anfragen/Minute je Verbindung**, und zwar für alles: Handel, Speichern, Marktdaten, Bestenliste. Der 429 traf danach auch den 409-Zweig von `saveGameStateVersioned`, dessen Versions-Nachladen (`storageGet`) still auf localStorage zurückfällt und einen Wert **ohne** `version` liefert – dort stand `handleSaveConflict()`, also Token löschen und Abmelde-Dialog. **Zwei Lehren:** (a) Wer eine Schleife baut, die den Server anspricht, rechnet sie gegen dieses Limit (jetzt `MARKET_BULK_PAUSE_MS`, und ein 429 lässt warten statt abbrechen); (b) `handleSaveConflict()` gehört ausschließlich an den Fall „Server hat geantwortet und nennt beharrlich eine fremde Version" (drei erfolglose Nachladeversuche) – ein *gescheitertes* Nachladen ist kein Beleg für eine zweite Sitzung, dort meldet jetzt nur `notifySaveRejected`. `tests/test_marktlimit_abmeldung.js` prüft beide Richtungen; am Stand v8.540.0 fällt es mit `{"token":"WEG"}` und gemessenen 56 ms Anfrage-Abstand.
- **Jede Flotte, die irgendwohin fliegt und wiederkommt, ist HIN UND ZURÜCK unterwegs – die Missionsdauer deckt beide Wege** (Auftrag Sascha, 17.08.2026). Die Regel gilt ab sofort für jede neue Missionsart, ohne Ausnahme: Wer eine Flotte losschickt, bekommt sie nicht am Ziel zurück, sondern zu Hause. Sauber gebaut ist das an der **Abbaumission** – sie ist das Vorbild: `flug` ist die Rundreise, `hinBis = jetzt + flug/2` die Ankunft, `abbauBis` das Ende der Arbeit, `endTime = flug + abbau` die Heimkehr; die Vorschau zeigt „Hinflug · Abbau · Rückflug (gesamt …)". Ebenso in Ordnung sind alle Arten, bei denen die Flotte für die volle `dur` weg ist und erst am `endTime` wieder zur Verfügung steht (Erkundung, Kolonisierung, NPC-Angriff, Spielerangriff, Spionage, Weltboss, Expedition). **Bewusst einwegig und deshalb KEIN Verstoß** sind Verlegungen (`relocate`) und das Stationieren an der Allianzbasis (`defend-base`, mit eigener `defend-base-return`-Mission für den Rückweg) sowie die Eskorte am Vorkommen – dort bleiben die Schiffe wirklich am Ziel. **Am 17.08.2026 verletzten genau zwei Arten die Regel – `intercept-pirates` und `void-rift`; beide sind seit v8.563.0 (18.08.2026) umgebaut und gelten jetzt als Vorbild für zeitkritische Missionen.**

**KORREKTUR 18.08.2026 – es war ein DRITTER dabei, und dieser Absatz hat ihn übersehen: `asteroid-contest`.** Gefunden beim Entwurf der Asteroidenfestungen, weil die neue Angriffsmission sich am nächsten Nachbarn orientieren sollte – und der Nachbar war falsch. Die Anfechtung setzte `endTime: jetzt + (flug/2)*1000`, also die halbe Rundreise: Die Flotte war zu Hause, sobald sie am Vorkommen ankam. Bezeichnend ist, WARUM die Aufzählung oben ihn nicht nannte: Sie entstand aus einer Suche nach `relocationDuration(` und nach `*Arrival`-Feldern – die Anfechtung benutzt beides nicht, sie halbiert eine schon fertige Rundreise. **Eine namensbasierte Suche findet nur, woran man schon gedacht hat** (Regel 40), und hier war die Folge eine Liste, die sich vollständig LAS („genau zwei Arten") und es nicht war. Deshalb prüft `tests/test_rundflug.js` seit dem 18.08.2026 **datengetrieben**: Abschnitt 1j liest ALLE `missions.push({`-Blöcke aus der Spieldatei, filtert die mit halbierter Dauer (`/2` oder `*500` im `endTime`) und hält sie gegen eine **namentliche Erlaubnisliste** der bewusst einwegigen Arten (`EINWEGIG_ERLAUBT`). Eine neue Missionsart mit halbierter Dauer fällt damit auf, ohne dass jemand an sie gedacht haben muss – und verschwindet eine erlaubte Art, ist das genauso ein Befund (Regel 33, Gegenrichtung mitprüfen).
  Die Behebung selbst folgt **Form A**, nicht dem `hinBis`-Muster der beiden zeitkritischen Missionen: Ein Vorkommen läuft nicht ab, es gibt also keine Frist, für die der Code eine Ankunftszeit bräuchte. `endTime = jetzt + flug*1000`, Kampf bei der Heimkehr, Treibstoff über `missionFuelCostSplit(flug, flotte)`. **Die Wahl zwischen den zwei Formen hängt allein daran, ob das Ziel eine Frist hat** – nicht daran, welches Muster gerade nebenan steht. Der Befund und die Lösung stehen hier, weil er sich wiederholen kann: Beide setzten `dur = relocationDuration(...)`, also die EINWEG-Verlegezeit, schrieben sie zusätzlich als `raid.interceptArrival` bzw. `rift.attackArrival` – nannten sie also selbst „Ankunft" – und beendeten die Mission trotzdem an genau diesem Zeitpunkt. Die Flotte ist damit in dem Moment wieder zu Hause, in dem sie am Ziel ankommt; der Rückflug fehlt ersatzlos. Der Grund dafür ist nachvollziehbar und muss beim Umbau erhalten bleiben: Beide Missionen sind **fristgebunden** (`if (dur*1000 >= remainMs)` – die Flotte muss vor dem Abzug der Piraten bzw. dem Kollaps des Risses da sein), und dafür braucht der Code die Ankunftszeit. Richtig ist deshalb nicht, die Dauer zu verdoppeln, sondern das **Muster der Abbaumission** zu übernehmen: Kampf bei `hinBis` auflösen, `endTime` auf `2×dur` setzen. Wer eine neue zeitkritische Mission baut, macht es von Anfang an so.
  **So gebaut (v8.563.0):** Der Kampf liegt in `ankunftsKampf()` und wird aus einem eigenen Durchgang in `checkMissions` ausgelöst, der VOR dem `endTime`-Filter läuft – die Mission läuft zu diesem Zeitpunkt ja noch. `m.kampfErledigt` sorgt dafür, dass er genau einmal feuert; ohne diese Marke löst ihn jeder Tick des Rückflugs erneut aus. Der `endTime`-Zweig holt den Kampf für **Altbestand ohne `hinBis`** nach, sonst käme jede beim Update fliegende Flotte ergebnislos heim. Drei Dinge, die dabei nur mitgedacht auffielen: (a) Die Schiffe bleiben während der ganzen Mission in `fleet` gezählt (nur der Slot ist belegt) – `applyCombatLosses` trifft bei der Ankunft also dieselben Schiffe wie vorher am Missionsende; (b) der bloße Countdown auf der Missionskarte hätte still seine Bedeutung gewechselt, deshalb steht dort jetzt „Anflug"/„Rückflug"; (c) der **Rückruf** löschte `raid.interceptArrival`/`rift.attackArrival` nicht – ein zweiter Versuch blieb bis zum Ablauf des Ereignisses gesperrt. Diese Sackgasse gab es schon vorher, sie fiel nur nie auf, weil es ohne Rückflug kaum einen Grund zum Zurückrufen gab. Wächter: `tests/test_rundflug.js` – es misst die Regel als **Paar** (bei der Ankunft liegt ein Bericht vor UND die Mission läuft noch), denn jede Hälfte allein wäre auch am alten Stand erfüllbar.
- **Der Markt hat einen serverseitigen Tagesumsatz-Deckel für VERKAUFSERLÖSE** (17.08.2026, Auftrag Sascha; `MARKT_TAGES_ERLOES_MAX` = 5 Mio Credits je Konto und UTC-Tag in `server.js`). Anlass, komplett durchgemessen: 400 Mio Erz brachten in ~6 Minuten 66 Mio Credits – die Slippage schützt nur die ERSTE Tranche (eine 1-Mio-Tranche drückt den Preis auf den Boden 0,30, wo er für alle weiteren bleibt), und 66 Mio Credits waren im Kredit-Shop 206 legendäre Module. Das Strukturproblem ist dasselbe wie bei der Protomaterie (Regel 41): Rohstoffe skalieren mit dem Imperium, die Modulwirtschaft nicht – jeder ungedeckelte Kanal dazwischen bricht. **Vier Dinge, die man beim Anfassen wissen muss:** (a) Die Ablehnung ist ein **400, bewusst kein 429** – den 429 deutet der Sammelauftrag als vorübergehend und wiederholt dieselbe Tranche dreimal mit je 20 s Wartezeit; (b) `tagesRest`/`tagesMax` reisen in JEDER Antwort mit (GET /market und /market/trade, auch in der Ablehnung), das Frontend zeigt die Kontingent-Zeile NUR, wenn das Feld da ist – ein alter Server bekommt keine erfundene Aussage; (c) die Restzeit bis zum Reset wird als DAUER auf Minuten gerundet angezeigt, nie sekundengenau – sonst schriebe `setBoxHtml` die Markt-Box im Sekundentakt neu (die Tick-Unruhe von v8.538.0), und nie als Uhrzeit („Mitternacht" wäre für deutsche Spieler 1–2 Uhr nachts gelogen); (d) die **Modulfragment-Lieferung** im Kredit-Shop ist auf 5/Tag begrenzt (`FRAGMENT_LIEFERUNG_PRO_TAG`, `dailyModuleOffer`-Muster, Zähler überlebt beide Resets über die Bewahrlisten) – klientenseitige Spielregel wie die Warteschlangen-Grenzen, keine Sicherheitsgrenze. **Entschieden am 17.08.2026 (Sascha): Verkaufsrouten zählen auf DASSELBE Kontingent.** Der `sell`-Zweig von `processTradeRoutes` prüft `routenKontingentRest()` VOR der Buchung (Pause mit Ein-Mal-je-Tag-Meldung statt Teilverkauf), `routenErloesVerbuchen()` senkt den Spiegel sofort und sammelt, `routenErloesMelden()` meldet GEBÜNDELT je Durchlauf an `POST /market/routen-erloes` (eine Anfrage je Minute statt eine je Route – das 240/min-Limit gilt für alles). Solo nutzt den lokalen Zähler `state.routenVerkaufTag` mit `ROUTEN_KONTINGENT_LOKAL` = derselben Grenze (test_markt_kontingent 1h prüft die Paritaet gegen server.js). WICHTIG: `marktTagesRest === null` (Server hat sich noch nicht geäußert) blockiert NICHT – eine Route, die am fehlenden Marktabruf verhungert, wäre ein unverständlicher Fehler; deshalb liegt der Fixture-`nextTick` im Test ~8s in der Zukunft, damit der Spiegel vor dem ersten Zyklus steht. Tests: `tests/test_markt_kontingent.js` (Frontend) und `tests/test_marktdeckel_http.js` (Backend-Repo, deren erster Markt-HTTP-Test überhaupt).
- **Ein MutationObserver-Mitschnitt braucht die RECORDS, nicht den Endstand des Callbacks** (17.08.2026, beim Markt-Kontingent-Test doppelt gemessen – Verschärfung von Regel 47): (a) Wer den `#log`-KNOTEN direkt beobachtet, sitzt nach dem Boot am verwaisten Original – der Boot ersetzt den Container einmal per innerHTML; beobachtet wird `document.body`, und `#log` wird je Mutation frisch per id gelesen. (b) Der Callback läuft als Microtask NACH einem synchronen Block – ein Shop-Kauf schreibt seine Meldung und löst im SELBEN Block eine Erfolgs-Salve aus (drei weitere `log()`-Aufrufe); wer im Callback den aktuellen Text liest, sieht nur die letzte Zeile der Salve. Die MutationRECORDS (`addedNodes` je Record) enthalten dagegen jeden einzelnen Schreibvorgang. Muster in `test_markt_kontingent.js`.
- **"N Minuten eigene Produktion" als Belohnungsformel** taucht mehrfach auf (Piratennester, Fraktionsgeschenke, Wochenliga, Tagesaufgaben) – bei starker Wirtschaft schnell explosiv. Bei neuen Belohnungsmechaniken diesem Muster bewusst ausweichen oder hart deckeln.
- **Additive+gedeckelte Bonus-Gruppen statt reiner Multiplikation**: Produktion UND Kampfkraft nutzen bewusst `1 + Math.min(1.0, summe_kleiner_boni)` statt `×1.1×1.15×1.2×…`, um explosionsartiges Aufschaukeln vieler kleiner Boni zu verhindern. Neue "kleine, stapelnde" Boni gehören in diese Gruppe, nicht als eigene Multiplikation.
- **Backend-`saveSanityViolation` kann das Speichern KOMPLETT einfrieren (Vorfall 21.07.2026, mehrere Stunden Fehlersuche)**: Der Backend-Endpunkt `PUT /api/storage/kepler7-save-v3` (`server.js`) lehnt den GESAMTEN Spielstand mit **HTTP 400** ab, sobald EIN Zahlenfeld die `SAVE_SANITY_LIMITS` übersteigt (oder NaN/Infinity/negativ ist). Passiert das dauerhaft, wird **gar nichts mehr gespeichert** und jeder Reload lädt den letzten akzeptierten Stand → Symptom beim Spieler: „**immer 8 Std. offline / Tagesbonus, Bauqueue und Forschung wie zurückgesetzt / immer derselbe Kampfbericht** bei jedem Reload". Betrifft nur weit entwickelte Konten, daher extrem schwer zu reproduzieren. Konkrete Ursache: `maxBuildingLevel`/`maxResearchLevel` waren **60**, `maxCredits` **1e8** – von Langzeit-Konten real überschritten. **Regeln daraus:** (1) Das Frontend darf eine Nicht-OK-Save-Antwort (v.a. 400) **NIE still verschlucken** – seit v8.187.0 meldet `saveGameStateVersioned`/`notifySaveRejected` das laut (Log + Toast); dieses Verhalten nicht wieder entfernen. (2) Wer im Spiel neue **speicherbare Zahlenfelder** einführt oder **Level-/Ressourcen-/Kredit-Obergrenzen anhebt**, MUSS gleichzeitig prüfen, dass die Backend-`SAVE_SANITY_LIMITS` klar darüber liegen (aktuell großzügig: Gebäude/Forschung 10000, Kredite 1e12, Schiffe 1e9, Ressourcen 1e15, XP 1e14). (3) Ablehnungen werden serverseitig als `[save-reject] userId=… reason=…` geloggt – bei Save-Problemen zuerst `docker logs` des Backends prüfen.

## Architektur-Kurzüberblick

- Ein einziges `state`-Objekt, per `save()`/localStorage bzw. Server-Sync persistiert
- Backend-Kommunikation optional (`useBackend()`) – Solo-Modus funktioniert ohne Server, Allianzen/Markt/Weltboss brauchen ihn
- Geteilter Speicher (Allianzen, Markt, Weltboss) läuft über generische `storageGet/storageSet/storageList`-Aufrufe gegen das Backend, mit Schlüsselpräfixen wie `alliance:<TAG>:...`
- **Weltboss-Archetypen sind ein Frontend/Backend-PAAR mit separater Reihenfolge-Tabelle** (v8.565.0, fünfter Archetyp „Piratenboss"): `WORLDBOSS_ARCHETYPEN` + `WORLDBOSS_ARCHETYP_FOLGE` in der Spieldatei spiegeln `WORLDBOSS_ARCHETYPES_PLAYABLE` + `WORLDBOSS_ARCHETYPE_FOLGE` in `server.js` – der Kampf wird serverseitig gerechnet, die Boss-Karte zeigt nur an; laufen die beiden auseinander, verspricht die Vorschau andere Faktoren, als der Kampf benutzt. Die Reihenfolge steht bewusst NICHT als nacktes Modulo über der Archetypen-Tabelle: Der Bossname läuft im Fünferzyklus, und die Paarung Name×Archetyp soll sich erst nach 20 Stufen wiederholen (kgV-Argument als Kommentar an der Tabelle; ein fünfter Archetyp im `% length` hätte den Zyklus von 20 auf 5 einbrechen lassen – die Erweiterung hätte die Abwechslung geviertelt, obwohl sie eine Variante HINZUFÜGT). Wer einen Archetyp ergänzt: BEIDE Tabellen und BEIDE Folgen erweitern, Paar-Periode ≥ 20 halten, HP nicht anfassen (die Belohnung hängt an der Stufe, ein zäherer/dünnerer Boss verschöbe still die Belohnungsrate). Der Galaxie-Nachrichten-Boss (`WORLD_BOSS_ARCHETYPES` in `server.js`, `spawnWorldBoss`) ist ein DRITTER, eigener Satz mit `hpMult`/`durH` – sein `trait`-Text landet wörtlich in der Galaxie-Nachricht und muss beschreiben, was diese zwei Werte wirklich tun (der erste Entwurf des Piraten-Traits erfand „Agilität" und „Flankenfeuer", zwei Mechaniken, die es nicht gibt). Wächter: `tests/test_inhalt_v8373.js` – Deckungsgleichheit über 60 Stufen, „jeder Tabelleneintrag kommt im Stufenlauf vor", Paar-Periode frühestens 20.
- Rendering: kein virtuelles DOM, direktes `innerHTML`-Neuschreiben pro Box, getriggert vom Haupt-Tick (1×/Sekunde) und bei Nutzeraktionen
- **Die Sektoren-Karte ist seit KB-4 (16.08.2026, Auftrag Sascha: „Es soll nur noch die Sektoren Modus Karte geben") die EINZIGE Karte.** Feste Ansichten: Übersicht (8 Regionen, `SEKTOR_DEFS`/`sektorVon`) → Sektoransicht (`sektorAnsichtBauen`, daumengroße Plätze) → aufgeklapptes System. Die frühere Freiflug-Zeichnung in `buildGalaxyMap` ist **nicht tot** – sie ist der Renderer der GEÖFFNETEN Systemebene (`galaxyOpenSystem`) samt Zoom/Pan, Kartenmenü, Routen, Territorien, Wurmloch, Frontsegmenten. Die Einstellung `uiSektorKarte` existiert nicht mehr (altes Feld im Spielstand ist inert). Knoten-Extras (Abzeichen, Fraktions-Wappen/-Ring, Kontroll-Ring, Kollaps, Randkriege-Balken) kommen für BEIDE Renderer aus `karteSystemBadges()`/`karteFrontStand()` – wer dort etwas ergänzt, versorgt automatisch beide (Regel 44). Seit KB-5 zeigt die Übersicht je Region die aggregierten Hinweis-Icons ihrer Systeme (`data-sektor-hinweise`, Tooltip nennt das System), und das 🔎-Abzeichen der Sektoransicht trägt die stärkste bekannte Verteidigung (`data-kb-intel-dp`, Farbcodierung wie am Spieler-Marker: cyan frisch, grau veraltet, amber entdeckt). Die Frontsegmente der Randkriege sind seit KB-5b ersatzlos entfernt (sie waren für die Galaxie-Übersicht gebaut und müllten die Systemebene zu – Spieler-Report mit Screenshot); die Front lebt am Kontrollbalken der Sektoransicht. Mit KB-6 ist die GESAMTE Galaxie-Kulisse aus der Systemebene raus (Territoriums-terrGlow-Flächen, Spiralarm-Deko, Galaxie-Zentrum, Wurmloch-Linie – zweiter Spieler-Report „Immernoch die alte Ansicht"): Die Systemebene zeigt nur noch Raum, Sternenfeld, Sonne/Planeten/Marker und die Nachbar-Punkte; NPC-Besitz = Ring+Wappen der Sektoransicht, Wurmloch = 🌀-Abzeichen an beiden Endpunkten (karteSystemBadges). KB-7 („Karte fährt nach unten", am Messprotokoll nachvollzogen): Das mobile Scroll-Ziel beim System-Öffnen ist der KARTENKASTEN, nicht mehr die Tafel; galaxyOeffne stellt die Kastenhöhe VOR der Kamera-Zielberechnung um; galaxyCamFahre(sofort) springt aus Sektor-Ansichten (Fahrt nur System→System), galaxySchliesse bricht die Fahrt ab; der „fokussierte Start-Ausschnitt" (galaxyMapFocused) ist entfernt – er kaperte seit KB-4 das erste geöffnete System. galaxyCamTarget hat eine Mindesthöhe von 190 Einheiten (KB-7c) – auf breiten PC-Kästen wäre h=w×Verhältnis kleiner als die ~135 Einheiten der Systemebene und die Ansicht massiv überzoomt; breite Kästen zeigen stattdessen seitlich mehr Nachbarschaft. Mit KB-8 (17.08.2026, Auftrag Sascha: „entferne die asteroiden gürtel … jedes system Durchklicken") sind die Gürtelansicht (KB-3) und die frei liegenden Gürtel-Felder der Sektoransicht ersatzlos entfernt – Asteroiden leben NUR noch im aufgeklappten System (buildMap, `data-map-asteroid`; das Kartenmenü `asteroidMapMenu` zeigt Sorte, Vorrat und Schürfrecht), das Gürtelsystem markiert der gestrichelte goldene Ring + „Gürtelsystem"-Untertitel am Systemknoten (`istGuertelSystem` bleibt in Gebrauch). Bewusst entfallen sind die Dauer-Anzeige freier Plätze („X von 10 belegt") und der immer sichtbare Vorrats-Balken – im Patchnote ehrlich benannt (Regel-44-Inventar aus dem Workflow-Bericht). KB-8b: `sektorAnsichtBauen` errechnet eine adaptive Breite `W = clamp(400..1200, H·Kastenverhältnis)` – am PC füllt die Sektoransicht den Kasten, am Handy bleibt W exakt 400; Spalten, Spiegelung, Titel/Fußzeile und ›-Knopf skalieren mit W. Wächter: `tests/test_sektorbreite.js` (Erwartung aus dem GEMESSENEN Kastenverhältnis) und `tests/test_guertel_im_system.js` (Ersatz für den entfernten `test_guertelansicht.js`). KB-9 (17.08.2026, Auftrag Sascha „bessere bedienbarkeit … steckt im zoom einige sekunden … system nach system durchsucht"): (a) Der Zoom-Hänger war NICHT die Karte – die zwei Deko-NEBEL des Seitenhintergrunds komponierten sich 30×/s als Vollbild-Verläufe und belegten gemessen ~89 % des Hauptthreads (Ausschluss-Messung; Details Regel 48). Sie liegen seit KB-9a als vorgerenderte Kacheln auf einer eigenen Leinwand `#bgnebel` UNTER `#bgstars`, die nur bei geändertem 6-px-quantisiertem Drift-Versatz neu gemalt wird (`nebelZeichnen`); Wächter `tests/test_hintergrund_maler.js` (createRadialGradient-Zählhaken, BEWUSST auf die zwei Leinwände gescopt – ungescopt zählte er die legitimen 40-px-Mini-Icon-Maler mit und fiel auf korrektem Code durch). (b) System-Blättern ohne Zurück-Knopf (KB-9b): ‹ ›-Overlay-Knöpfe direkt am Kartenkasten (`galaxySysPrev/NextBtn`, Sichtbarkeit über `updateGalaxyBackButton`), und BEIDE Knopfpaare (Karte + Tafel-◀/▶) blättern in EINER geografischen Reihenfolge `karteSystemReihenfolge()` (Sektor für Sektor, innerhalb Nord→Süd/West→Ost; vorher Spiral-Layout-Ordnung, die kreuz und quer sprang). Wer Tests baut, die per ▶ zu einem BESTIMMTEN System navigieren: Spielerweg über `tests/lib/karte.js` nehmen, nie Klickzahlen der Reihenfolge (genau daran fiel `test_systemstatus` 3 – ein ▶-Klick war dort als „führt nach vega" verdrahtet). Die Ebenen-Leiste wirkt und erscheint auch in der Sektoransicht; nur der Routen-Knopf gehört der Systemebene (dort verborgen = keine Falschaussage). `galaxyOeffne` merkt sich die Region des Systems – jeder Sprung (Suchfeld, Berichte-Knöpfe, Allianz) landet beim Schließen in der richtigen Sektoransicht. KB-10 (17.08.2026, Video-Report „Immernoch schlecht bedienbar am Handy"): Die Kastenhöhe der OFFENEN Systemebene folgt am Hochformat der Kastenbreite (`kbSystemKastenHoehe()` = clamp(230..420, Breite×0,6), EINE Helferfunktion für galaxyOeffne UND Tick-Pfad) – die feste 420px-Höhe war bei ~135 Einheiten Inhalt zu ~70 % toter Raum (gemessen: Kamera 410×495 Einheiten am 390er-Viewport). Und das KB-7-Scroll-Ziel zieht die Höhe der Sticky-Reiter-Leiste des kompakten Kopfs ab (`.tabs` ist dort position:sticky und verdeckte sonst 118 px Kartenoberkante samt Sonne); test_karte_mobil 2b misst die Schranke seither an der GEMESSENEN Leiste statt als feste Zahl. KB-11 (17.08.2026, dritter Video-Report derselben Runde): Drei Nachwehen von KB-10, alle gemessen – (a) der ›-Blätterknopf (rechts mittig) und der SENKRECHTE Zoomstapel (120 px hoch, rechts unten) überlappten im kompakten Kasten so, dass `elementFromPoint` auf der Knopfmitte `galaxyZoomInBtn` lieferte: Der Knopf war nicht verdeckt, sondern **untippbar**. Der Stapel steht am Handy jetzt WAAGERECHT (`.map-zoom` unter 700 px, `flex-direction:row-reverse`). (b) Die 190er-Kamera-Mindesthöhe aus KB-7c wirkt am schmalen Kasten genau falsch herum – sie vergrößert dort die BREITE und verkleinert die Karte; ersetzt durch `GALAXY_SYSTEM_MAX_SCALE` (2,2 = der Wert, den die alte Regel am PC erzeugte), dazu am Handy ein auf den echten Planeteninhalt eingezogener Ausschnitt (370 statt 410 Einheiten, +11 % Darstellung); die Kastenhöhe folgt jetzt 0,44×Breite (clamp 190..420) statt 0,6. (c) Der KB-10-Scroll lief bei JEDEM `galaxyOeffne` – auch beim Blättern, wo die Karte längst im Bild steht (gemessen: hochgescrollt auf 300, ein ›-Klick sprang auf 843 zurück); er hängt jetzt an `!kbWarOffen`. Wächter: `tests/test_karte_handy_bedienung.js` prüft die Knöpfe per `elementFromPoint` statt auf Sichtbarkeit – **ein Sichtbarkeits-Test hätte diesen Fehler nie gefunden** – und beide Scroll-Richtungen (Blättern ruhig, erstes Öffnen weiterhin zur Karte). Browser-SEITEN-Zoom ist abgestellt (Viewport-Meta `maximum-scale=1`/`user-scalable=no`, `touch-action:manipulation` auf html/body, `gesturestart`-Abfang für iOS) – der Karten-Zoom lebt im Spiel. **KB-12 (17.08.2026, Screenshot-Report „die Karte ist wirklich extrem mini … genauso groß wie die Karte davor"): Am schmalen Kasten wird die SYSTEMZEICHNUNG SELBST umgestellt, nicht mehr nur der Ausschnitt.** KB-10 und KB-11 hatten beide an Kastenhöhe bzw. Skala-Deckel gedreht und beide Male blieb es zu klein – geometrisch zwingend: Die Systemebene zeichnete einen 600×180-Einheiten-STREIFEN (`rx = 42+orbit*43`, `ry = rx*0,3`), und wer davon alle Planeten zeigen will, kann auf 348 px Kastenbreite höchstens 0,85 vergrößern, EGAL wie hoch der Kasten ist (begrenzend ist die Breite, nicht die Höhe). Seit KB-12 liegen die Bahnen am Handy enger und runder (`kbOrbitMass()` = `{30, 18, ry 0,85}` statt `{42, 43, ry 0,3}`) – aus dem Streifen wird ein 364×262-Feld, also die Form eines Hochformat-Bildschirms; gemessen 12 → 20 px Planetendurchmesser, und die zwei äußeren Planeten (Moryth, Draconis) waren vorher am Kastenrand abgeschnitten. `kbOrbitMass()`/`kbOrbitRx()` sind die EINE Quelle für Planetenbahnen, Gürtelbahn (`guertelRx()`, ersetzt die Konstante `GUERTEL_RX`), Peilringe und Orbit-Ringe. Der Kamera-Ausschnitt kommt am Handy aus den TATSÄCHLICH vorhandenen Orbits des Systems (`kbOrbitRx(maxOrbit)+34`, mal `GALAXY_SYSTEM_SCALE`) statt aus dem Maximum – ein System mit drei Planeten wird stärker vergrößert als eines mit acht. **Alle drei Umschaltstellen hängen an `kbSchmalerKasten()` (`window.innerWidth <= 700`, dieselbe Schranke wie die `.map-zoom`-Media-Query und das Scroll-Gate) – auch die Kastenhöhe: 0,78×Breite (clamp 240..480) am Handy, weiter 0,44 (clamp 190..420) am PC.** Die Kastenhöhe bedingungslos umzustellen war der eine Fehler dieser Etappe und hat das Ziehen der Karte am PC getötet (Regel 50). Wächter: `tests/test_kartengroesse.js` misst den Planetendurchmesser in PIXELN auf dem Report-Gerät (390×844) plus die PC-Gegenrichtung. **KB-13 (17.08.2026) ist die Nachwehe von KB-12 und war ein ausgelieferter Fehler:** Die Marker liegen auf EIGENEN Bahnen (`homeSlotXY` Kreis r=50, `npcMarkerXY` Ellipse 78×24), die KB-12 nicht mitgezogen hatte – über alle 77 Systeme gemessen lagen danach 15 von 15 Markern auf einer Planetenscheibe (vorher 0), Mittenabstand 17,1 bei nötigen 22–27,7 Sektor-Einheiten. Seitdem leiten beide Bahnen ihre Maße aus `kbOrbitRx(1)` ab (Faktoren 0,588 bzw. 0,918 – am PC exakt die alten 50 bzw. 78/24 Einheiten; nachgemessen sind dort alle Planetenpositionen byte-identisch), und der Kollisionsschieber, den es bis dahin nur als Einzelkopie an der Heimatbasis gab, ist als `kbMarkerFrei()` die EINE Quelle für Heimatbasis, fremde Spieler und NPCs (Regel 43/52). Er kennt den sichtbaren Markerradius, weil der Boss-Puls-Ring bis r=19 geht; seine zwei Kennzahlen (Mindestabstand, Schrittweite) hängen an `kbOrbitMass().schritt`, sonst schöbe er am Handy über das halbe System. NPC-Namen stehen seither ÜBER dem Marker – unter ihm konkurrierten sie mit den Planetennamen (gemessen: 11 von 15 Systemen). Wächter: `tests/test_kartenmarker.js` prüft Marker×Scheibe und Text×Text auf beiden Formfaktoren und schreibt Text×Scheibe als INFO-Zeile mit (dieser Fall ist älter als KB-12 und hängt an der Textlänge – siehe Regel 53). **KB-14 (18.08.2026, Auftrag Sascha „bedienung über pfeiltasten wenn man am pc ist"): Tastatur-Bedienung der offenen Systemebene** – `←`/`→` blättern durch die Systeme (über `systemNachbarOeffnen`, also dieselbe geografische Reihenfolge wie die ‹ ›-Knöpfe), `+`/`−` zoomen. Der Tastatur-Zoom ruft NICHT eine zweite Kopie der Rechnung, sondern das `zoomBy` des Karten-IIFE, das sich dafür als `galaxyTastenZoom` nach außen meldet (Regel 43). **`↑`/`↓` sind bewusst NICHT belegt**: Sie scrollen die Seite, und unter der Karte steht die Detailtafel, die man bei offenem System liest – wer sie kapert, nimmt dem Spieler genau dann das Scrollen. `←`/`→` scrollen nur waagerecht, wo es auf dieser Seite nichts zu scrollen gibt, kosten also niemanden etwas; dieselbe Abwägung wie beim Mausrad, das nur MIT Strg zoomt. Die Tasten wirken ausschließlich bei OFFENEM System (in den Sektor-Ansichten gibt es kein „nächstes System"), nicht bei gesetztem Strg/Meta/Alt (Browser-Kürzel bleiben) und nicht mit Fokus in `INPUT`/`TEXTAREA`/`SELECT`/contentEditable; das `preventDefault` steht bewusst HINTER diesen Prüfungen, sonst schluckte die Karte fremde Tastendrücke. Die Belegung hängt an keiner Bildschirmbreite – wer eine Tastatur hat, soll sie benutzen können. Auffindbar über den Hilfe-Abschnitt „Karte bedienen (Maus, Finger, Tastatur)" und die Tooltips der ‹ ›-Knöpfe; ein Kürzel, das nirgends steht, gibt es für den Spieler nicht. Wächter: `tests/test_kartentasten.js` – prüft die belegten Tasten UND die Gegenrichtungen (↓ scrollt weiterhin, mit Fokus im Suchfeld blättert nichts, in der Sektoransicht öffnet nichts). **KB-15 (18.08.2026) vervollständigt das: ein SICHTBARER Fokusring auf den Kartenknoten.** Alle drei tastaturerreichbaren Knotenarten – Regionen (`[data-sektor]`), Systemknoten (`.sektor-sys`) und die Ebenen-Knöpfe (`[data-kb-knopf]`) – trugen längst `role="button" tabindex="0" aria-label`; gemessen hatten sie auch einen Ring, nämlich den des Browsers in `rgb(16,16,16)`, auf dem dunklen Kartengrund also unsichtbar (Details Regel 57). Die Regel steht bei ihrem Vorbild `.card-row[role="button"]:focus-visible` und gilt über `#galaxyMapSvg [role="button"]` für alle drei Arten auf einmal – ein neuer Knotentyp erbt sie automatisch, statt dass drei Einzelregeln auseinanderlaufen. `box-shadow` scheidet aus (`inset` gibt es auf SVG-Elementen nicht), `outline` dagegen trägt auf einem `<g>` nachweislich; `:focus-visible` statt `:focus` aus demselben Grund wie beim Vorbild – sonst bekäme jeder MAUSKLICK auf ein System einen Ring, der bis zum nächsten Klick stehen bliebe. Wächter: `tests/test_kartenfokus.js` (misst alle drei Knotenarten, echtes Tabben und die Maus-Gegenrichtung). **KB-16 (18.08.2026) schließt den seit KB-13 offenen Beschriftungs-Fall: `kbLabelsEntflechten(svg)` schiebt Labels aus belegten Flächen heraus.** Der Durchgang läuft NACH dem Einfügen des Markups (erst dann steht die echte Textbreite fest – aus der Zeichenzahl geschätzt wäre sie bei einer Proportionalschrift geraten) und misst mit `getBBox()` in SVG-Nutzerkoordinaten, also zoom-unabhängig. Jedes Label weicht WEG von seinem eigenen Objekt aus (Planetennamen nach unten, Marker-Namen nach oben), senkrecht höchstens 21 Einheiten, danach seitlich höchstens 12; findet sich darin kein freier Platz, bleibt es an seinem Objekt. Der Aufruf steht bewusst HINTER dem `lastSystemLayerMarkup`-Cache-Riegel – bei einem übersprungenen Neuaufbau stehen die entflochtenen Texte ohnehin noch da. Kosten gemessen: 0,012 ms je Durchgang bei 9 Texten und 9 Flächen, keine zusätzlichen Long Tasks. Gemessen über alle 77 Systeme: Text-auf-Scheibe am Handy 11 → 1, am PC 1 → 0, ohne neue Text-auf-Text- oder Marker-Kollisionen. Der eine Rest („Deine Basis" auf Rhea im Heimatsystem am Handy) ist in `tests/test_kartenbeschriftung.js` NAMENTLICH als bekannte Ausnahme hinterlegt, nicht pauschal ausgeblendet – jeder andere Fall schlägt an. **KB-17 (19.08.2026) ist die Nachwehe der Alien-Nester und war der erste Fall, in dem sich zwei MARKER begegnet sind:** Phase 3 setzt bis zu drei Nester in dasselbe System; alle drei liefen durch `kbMarkerFrei()` und lagen im gerenderten Bild trotzdem übereinander, weil der Schieber nur Sonne und Planeten kannte und jeden auf dieselbe freie Stelle schob. `buildMap` führt seither `platzierteMarker` – Festung, Asteroiden, Nester, Heimatbasis, fremde Spieler und NPCs melden sich dort an, und jeder neue Marker erbt den Schutz automatisch. Dazu drei Ursachen, jede allein hinreichend (Details Regel 53): die Nestbahn ist RUNDER als die Planetenbahn (`Math.max(0.60, kbOrbitMass().ry)`), weil auf einer flachen Ellipse selbst 60° Winkelabstand nur 27 statt der nötigen 43 Einheiten ergeben; `markerR` ist der SICHTBARE Radius (der Nest-Knoten pulst auf das Doppelte, `sichtR = r*2`); und die Schieber-Schleife hat 24 statt 14 Anläufe, weil sie sonst an den VERSUCHEN scheitert statt am Platz (die Königin blieb bei 32,1 statt 41 Einheiten stehen und gab auf). `test_kartenmarker.js` prüft Marker×Marker seither als eigene Zeile (1b). **KB-18 (19.08.2026, v8.583.0, Spieler-Report Sascha mit Screenshot: „bug gefunden flotte ist von meiner heimatbasis gestartet"): Eine Missionslinie startete an einer Heimatbasis, die es im gezeigten System gar nicht gibt.** Die Ursache war die REIHENFOLGE der Verzweigung, die den Ursprung der Flugbahn bestimmt: Der `originKey === 'home'`-Zweig stand VORNE und fragte `originInView` gar nicht ab, während der Kolonie-Zweig daneben längst auf die Sonne zurückfiel. `homeMarkerPos` ist ein Punkt auf der Heimat-Slot-Bahn (Kreis r=50 um die Sonne) – im fremden System bezeichnet er nichts. Gemessen (Heimat in `kepler`, Erkundung nach `thessa` im System `vega`): im fremden System vorher **50,0** Einheiten neben der Sonne, nachher **0,0**; im Heimatsystem vorher wie nachher **74,1** (der echte, kollisionsverschobene Marker). Behoben, indem ZUERST nach `originInView` gefragt wird – damit steht die Regel „Ursprung nicht im Bild → Sonne als Platzhalter" nur noch an EINER Stelle. **Die Gegenrichtung ist der eigentliche Punkt:** Der naheliegende Fix („immer die Sonne nehmen") hätte die Linie auch im Heimatsystem von der Basis losgelöst; `tests/test_flugbahn_ursprung.js` prüft deshalb beide Systeme und zusätzlich, dass es der VERSCHOBENE Marker ist und nicht die rohe Slot-Position.
  **Zwei Dinge zum Namen und zum Kommentar, weil beide wiederkehren können:** (a) Der Kommentar an `homeMarkerPos` beschrieb das Fehlverhalten ausdrücklich als Absicht („rohe Heimatposition als Fallback, z.B. Missionslinien, wenn das Heimatsystem gerade nicht angezeigt wird") – genau deshalb hat es so lange überlebt, und genau deshalb ist er mitgezogen worden; ein Kommentar, der eine alte Annahme festhält, ist eine zweite Anzeigestelle (Punkt 6). (b) Die Etappe hieß bei der Auslieferung versehentlich **KB-17** – der Name war am selben Tag schon von der Alien-Nester-Arbeit belegt (Marker×Marker, siehe oben). Der Code heißt seit v8.584.0 KB-18, die Patchnotes bleiben als unveränderliche Historie stehen. **Bei parallel arbeitenden Sitzungen ist die nächste freie Etappennummer genauso zu prüfen wie die Versionsnummer** – ein `grep -c "KB-<n>" CLAUDE.md weltraum_kolonie.html` vor der Vergabe kostet Sekunden.

**KB-19 (19.08.2026): Der Beschriftungs-Entflechter kannte nur DREI der inzwischen SECHS Kartenobjektarten.** `kbLabelsEntflechten` sammelte seine belegten Flächen und die Zuordnung „Label gehört zu diesem Objekt" über eine NAMENSLISTE (`.planet-node[data-planet], [data-map-npc], [data-map-player]`). Gemessen gibt es aber sechs Arten von `planet-node`-Gruppen: dazu **Asteroiden** (`data-map-asteroid`, seit KB-8), **Alien-Nester** (`data-map-nest`) und **Asteroidenfestungen** (`data-map-festung`) – alle drei kamen nach KB-16 dazu und haben den Schutz nie geerbt. Im gerenderten Bild gemessen: am Handy lag der Planetenname „Vesna" auf einer Nest-Scheibe, am PC „Abyssos" auf einem Asteroiden im System `rand`. **Behoben über die KLASSE statt über drei weitere Namen** – alle sechs Arten tragen `.planet-node`, und keine solche Gruppe existiert ohne `data-`Attribut; eine neue Markerart erbt den Schutz damit automatisch, genau wie beim Kollisionsschieber `kbMarkerFrei` (Regel 52). Eine um drei Namen ergänzte Liste hätte die NÄCHSTE neue Art wieder durchfallen lassen (Regel 40).
  **Die eigentliche Lehre steckt aber im WÄCHTER:** `test_kartenbeschriftung` trug dieselbe Namensliste wie der Code und hatte damit exakt denselben blinden Fleck – der Fehler konnte ihm gar nicht auffallen. **Eine Prüfung, die die Namensliste der Implementierung spiegelt, erbt deren Lücke.** Er greift jetzt über dieselbe Klasse und hat eine neue Prüfung **1b** für die Richtung, die KB-19 behoben hat (Text auf einem NICHT-Planeten) – die alte Prüfung 1 steigt bei `!o.istPlanet` aus und misst nur Planetenscheiben. Dazu kamen drei Alien-Nester und eine Festung ins Fixture: Ohne sie war die Erweiterung **vacuous**, die Gegenprobe am alten Stand blieb grün (genau so gemessen, und das war der Befund – Regel 26). Beidseitig gefahren: 15 Prüfungen in beiden Richtungen, am alten Stand fallen genau die zwei 1b-Prüfungen.
  **Ein neuer bekannter Fall, gemessen statt weggeblendet:** Mit drei Nestern im Heimatsystem liegt „Schwarmstock" auf der Scheibe von Rhea-Nachbar `vesna`. Das ist kein Fehler, sondern der Deckel aus KB-16: Alle drei Nest-Namen sitzen bei dy = −20,3 an ihrer natürlichen Stelle über dem Marker, „Sporenherd" wich um dx = 8 seitlich aus, „Schwarmstock" fand innerhalb von 21 senkrecht bzw. 12 seitlich keinen freien Platz und bleibt deshalb an seinem eigenen Objekt. Er steht NAMENTLICH in der Ausnahmeliste, mit der Messung als Begründung – wer den Deckel anhebt, prüft zuerst Abschnitt 4 (Abstand zum eigenen Objekt).

**KB-20 (21.08.2026, Spieler-Report Sascha mit zwei Screenshots: „karten sind unterschiedlich groß bitte selbe größe wie die größere karte"): Der Kartenkasten ist am PC in beiden Ansichten gleich hoch – und die Zeichnung wächst mit.** Beide Höhen kamen aus EINER Zeile: `kbWrap.style.height = kbSektorModus ? 'max(480px, calc(100dvh - 175px))' : kbSystemKastenHoehe()`. Gemessen bei 1920×1040: Sektoransicht 1258×**865** px, offene Systemebene 1258×**420** px (der Deckel aus KB-11). Am Handy 390×844: 348×669 gegen 348×271.

**Drei Varianten gebaut und EINZELN gemessen, bevor eine ausgeliefert wurde** – die Zahlen sind der Grund für die Wahl, nicht eine nachträgliche Begründung:

| Variante | Ausschnitt | Skala | Planet | Kasten |
|---|---|---|---|---|
| nur die Kastenhöhe angehoben | 572×393 | 2,20 | 28 px | zu 54 % leer |
| dazu den Skala-Deckel weglassen | 223×153 | 5,65 | 73 px | Inhalt **beschnitten** |
| Höhe + runde Bahnen + Ausschnitt, der beide Richtungen fasst | 284×195 | 4,43 | **57 px** | gefüllt, nichts beschnitten |

Sascha hat die dritte gewählt (beide Bilder vorgelegt) und ausdrücklich: **das Handy bleibt, wie es ist.**

**Der Befund, der die ganze Etappe erklärt: Mehr Kastenhöhe heißt nicht mehr Karte.** Die Vergrößerung hängt an `GALAXY_SYSTEM_MAX_SCALE` (2,2) und wird aus der BREITE gerechnet – ein höherer Kasten fügt nur senkrechten Leerraum hinzu. Erst die runde Bahn-Geometrie macht den Inhalt schmaler (380 statt 600 Einheiten) und lässt ihn den Kasten füllen. Das ist geometrisch dieselbe Einsicht wie KB-12, nur auf den PC übertragen.

**Vier Stellen, alle an EINER benannten Schranke** (Regel 50):
- **`kbRunderKasten()`** – die Schranke selbst: `kbSchmalerKasten() || Kastenhöhe/Kastenbreite > 0,5`. Die 0,5 ist gerechnet, nicht gewählt: Die flache Zeichnung hat das Verhältnis 0,30 und füllt einen Kasten mit Verhältnis r nur zu 0,30/r – ab 0,5 bleiben also 40 % leer. **Nicht mehr an der Fensterbreite:** Ein Hochformat-Handy und ein hoher PC-Kasten haben dasselbe geometrische Problem. Sehr breite Bildschirme bleiben dadurch von selbst bei der flachen Zeichnung.
- **`kbOrbitMass()`** hängt daran statt an `kbSchmalerKasten()`.
- **`galaxyCamTarget`**: `kbEng = kbRunderKasten()`, dazu eine Korrektur, die den Ausschnitt in BEIDER Richtung fassen lässt – sie gilt bewusst nur am breiten Kasten (`kbEng && !kbSchmalerKasten()`), weil sie am Handy die Skala von 1,56 auf 1,39 drücken, die Karte also VERKLEINERN würde. Der Skala-Deckel gilt nur noch für die flache Zeichnung; am Handy hat er nie gebunden (gemessen 1,56 gegen 2,2).
- **`KB_SEKTOR_KASTEN_HOEHE`** als benannte Konstante, die beide Anzeigestellen benutzen – genau die zwei Stellen mit verschiedenen Zahlen waren der Report.

**Warum das Handy unangetastet bleibt, gemessen statt angenommen:** Dort ist die BREITE die bindende Richtung. Ein gleich hoher Kasten (669 px) ließe die Planeten bei 20 px und den Kasten zu 63 % leer – genau der tote Raum, den KB-10 entfernt hat.

**Drei Bestandstests hielten das ALTE Verhalten als Regel fest** (Regel 45) und sind mitgezogen worden, jeder auf die EIGENSCHAFT statt auf eine Momentaufnahme:
- `test_kartengroesse` 3 verlangte „der PC-Kasten bleibt flach (h/b ≤ 0,5) – sonst wieder toter Raum". Genau das ist absichtlich aufgehoben. Geprüft wird jetzt, was die Schranke MEINTE: kein toter Raum, gemessen als Anteil der Kastenhöhe, den die Zeichnung belegt. **Die neue Schranke ist gemessen**, alle drei Werte bei 900×1000: Stand davor 0,556 (Planet 23 px), KB-20 0,514 (Planet 43 px), nur-die-Höhe-angehoben **0,219** – der Fall, den die Prüfung fangen muss. 0,40 liegt mit Abstand dazwischen. Die Füllung bleibt durch KB-20 also praktisch gleich, während die Planeten fast doppelt so groß werden.
- `test_kartengroesse` 3b und `test_kartenbedienung` 2 griffen die GEOMETRISCHE Kastenmitte. Der Kasten ist jetzt höher als der sichtbare Fensterausschnitt – genau wie die Sektoransicht das seit jeher ist –, die Mitte liegt also darunter (gemessen y=1016 bei 1000 px Fensterhöhe). Gegriffen wird jetzt die SICHTBARE Mitte: die Stelle, an der ein echter Zeiger ankommt. Bei einem Kasten, der ganz ins Fenster passt, ist es derselbe Punkt wie vorher. **Gegengeprobt an einer Kopie mit abgeschaltetem Ziehen: 2a/2b fallen weiterhin mit Treue 0** – die Prüfung ist nicht aufgeweicht.
- `test_flugbahn_ursprung` 3b verglich gegen die feste Zahl 50 („die rohe Slot-Bahn"). Die Heimatbahn wird seit KB-13 aus `kbOrbitRx(1)` abgeleitet; mit runden Bahnen fällt die von 85 auf 48, die Slot-Bahn von 50 auf 28,2 – der Test fiel auf völlig richtigem Code durch (gemessen 43,3). Er misst jetzt, dass der Linienstart AUF dem gezeichneten Marker liegt (Abweichung 0,00), was zugleich schärfer ist: Die alte Schranke hätte jede Position jenseits von 50 durchgelassen.
- `test_galaxiekarte` 2 verlangte eine Ausschnittsbreite zwischen 300 und 500; der korrekte runde Ausschnitt ist 222,6. Geprüft wird jetzt „unter 500" (also ein System statt der 950 Einheiten breiten Galaxie) plus die neue Zeile 2b: kein Planet ragt aus dem Kasten.

**Neu als Wächter für den Report selbst:** `test_kartengroesse` Abschnitt 4 misst die Kastenhöhe der Sektoransicht VOR dem Öffnen und hält sie gegen die der Systemebene – auf einem breiten Fenster (1600×1040), wo der alte 420er-Deckel wirklich bindet. Gegenprobe gegen den Stand davor: 13 Prüfungen in beiden Richtungen bei identischen Prüfnamen (per `diff` verglichen), rot sind genau 3a (Planet 23 px) und 4 mit `{"sektoransicht":865,"systemebene":420}` – also Saschas Meldung als Messwert. Zeile 4b hält die Gegenrichtung fest: Am Handy MUSS die Systemebene flacher bleiben; fällt sie, hat jemand das Handy mitangeglichen, ohne den Absatz darüber zu lesen.

**Ein Fund nebenbei, unabhängig von KB-20** (Regel 34): `test_kartenbedienung` starb bei der Gegenprobe mit einem `TypeError`, statt einen benannten Fehlschlag zu melden – 6 statt 15 Prüfungen, keine einzige FAIL-Zeile, und der rote Exit-Code sah aus wie eine gelungene Gegenprobe. Die Wache dafür ist eingebaut.

**KB-20b + GR-1 (21.08.2026): Das Wurmloch-Portal bekommt eine abgeleitete Position und eine neue Zeichnung – und der erste Teil war eine Regression, die KB-20 erzeugt hat.** Das Portal saß fest bei `(665, 28)` von 700×230 Sektor-Einheiten, also am äußersten Rand des alten, breiten Systemfelds. Mit dem engeren Ausschnitt von KB-20 lag es gemessen **241 px hinter der rechten Kastenkante – vollständig unsichtbar, nicht angeschnitten** (am Stand davor: ganz im Kasten). **Am HANDY war es schon seit KB-12 draußen** (v8.553.0, 17.08.2026, gemessen 133 px) – ein vier Tage lang ausgelieferter Fehler, den niemand gemeldet hat, weil ein Wurmloch selten ist.

Das ist Regel 52 in Reinform. **Gefunden hat es kein Test, sondern ein Durchgang über ALLE Kinder der Systemebene**, der ausgibt, was aus dem Kasten fällt – genau vier Dinge: drei Sternenfeld-Punkte von r=1,1 (vom SVG ohnehin abgeschnitten, kein Spielobjekt) und das Portal. **Dieser Durchgang gehört nach jedem Geometrie-Umbau dazu**; die vorhandenen Tests messen nur `.planet-node`-Gruppen und hätten es nie gesehen.

Behoben wie bei allen anderen Markern: Die Bahn kommt aus `kbOrbitRx(maxOrbit) * 0,92` bei 325°, das Portal läuft durch `kbMarkerFrei()` und meldet sich in `platzierteMarker` an. Der Faktor 0,92 hält es in BEIDEN Zeichnungen im Bild – rund bei 144 von 242 sichtbaren Einheiten, flach bei 316 von 350; die Bahn ist runder als die Planetenbahn (mindestens 0,55), damit es nicht auf der Ekliptik zwischen den Planeten klebt.

**Die Zeichnung** ist eine Akkretionsscheibe (Spieler-Wunsch Sascha: „soll wie ein wurmloch aussehen", dann „gefallen mir nicht mehr details mehr farbe", nach acht vorgelegten Entwürfen „entwurf a gefällt mir aber vielleicht doch zu knallig mit den farben ändern so das es ins spiel passt"). Der Sog liest sich an der Geometrie – die glühende Innenkante ist vor dem dunklen Zentrum hochgebogen –, nicht an einem Ring. **Die Farben sind auf die gemessene Spielpalette umgestellt**: Lavendel `#af9ce6` (die Farbe, die das Portal schon vorher trug), Violett `#7f77dd`, Cyan `#5ce1ff`, Gold `#fac775`. Alle 40 Farben des Entwurfs liefen durch eine Zuordnungstabelle, die abbricht, wenn eine Farbe keine Entsprechung hat ODER die Tabelle eine Farbe führt, die es gar nicht gibt. **Rot bleibt bewusst draußen** – es ist im Spiel die Farbe für Gefahr (`#e24b4a`), und ein Wurmloch ist kein Gegner.

**Die Gruppe trägt bewusst KEIN `planet-node`, und das ist gemessen:** Sie ist die einzige Kartenobjekt-Gruppe mit einer `scale`-Transformation (die Zeichnung ist für viewBox 0 0 100 100 gebaut). `kbLabelsEntflechten` misst belegte Flächen mit `getBBox()`, und das liefert die EIGENEN Nutzerkoordinaten **ohne** die Transformation – im Browser nachgemessen meldet der größte Kreis **82** Einheiten, während das Portal auf der Karte **27,9** Einheiten breit ist (vorher r=14, also 28). Mit der Klasse hätte der Entflechter eine fast dreimal zu große Fläche angenommen. **Wer das Portal später doch aufnehmen will, macht zuerst den Entflechter transform-fest** – nicht die Klasse hier setzen.

Wächter: `tests/test_wurmloch_portal.js` (11 Prüfungen, PC und Handy). Gegenprobe an einer Kopie mit der festen Position: 11 Prüfungen in beiden Richtungen bei identischen Prüfnamen, rot sind genau 1 und 2 mit `ueberRechts` 225 bzw. 127. `test_kartenmarker` 3b/3b2 führt das Portal seither in seiner **namentlichen** Erlaubnisliste – genau dieser Wächter hat die neue Aufrufstelle beim ersten Lauf als „überzählig" gemeldet, also gearbeitet wie gebaut.


**KB-20c bis KB-20e (21.08.2026) sind die drei Befunde einer adversarischen Durchsicht VOR dem
Merge – und der schwerste war einer, den mein eigener „was fällt aus dem Kasten"-Durchgang übersehen
hatte.** Er fand vier Dinge (drei Sternenfeld-Punkte und das Portal) und meldete alles andere als
sauber. Die **Allianzbasis** stand aber genauso auf einem festen Punkt (`translate(165,52)`) – sie
fehlte in der Messung schlicht, weil die Fixture gar keine Allianz hatte. **Ein Durchgang über „alle
Objekte" misst nur die Objekte, die die Fixture erzeugt** – wer so einen Sweep fährt, prüft zuerst,
welche Objektarten unter seinen Bedingungen überhaupt entstehen können.

- **KB-20c – die Allianzbasis kommt auf eine abgeleitete Bahn.** Nachgerechnet lag Sektor-x 165 bei
  **18 von 69** Systemen ganz außerhalb des Ausschnitts und bei **37 weiteren** angeschnitten – nur
  14 wären vollständig im Bild. (Unabhängig nachgerechnet: Links der Sonne sind
  `kbOrbitRx(maxOrbit) + 34` Sektor-Einheiten sichtbar, bei maxOrbit 5 also 154; die Basis braucht
  185 für ihre Mitte und 215 für ihren sichtbaren Modellrand von 30. Die Zahl hängt nicht am
  Formfaktor, weil der Ausschnitt in Sektor-Einheiten gerechnet wird. **Hier stand zuerst „23
  weitere" – die ließ sich beim Nachrechnen nicht reproduzieren und ist korrigiert**; Regel 41 gilt
  auch für die eigenen Zahlen von gestern.) Die
  Basis hat auf der Karte **keine zweite Darstellung** – fällt sie aus dem Ausschnitt, ist sie für
  den Spieler weg. Behoben wie beim Portal: `kbOrbitRx(kbMaxOrbit) * 0,80` bei 205°, durch
  `kbMarkerFrei` geschoben, in `platzierteMarker` angemeldet. 0,80 statt 0,92 hält sie **innerhalb**
  der Portalbahn, damit sich die zwei großen Strukturen nicht am selben Rand drängen; der Radius 30
  ist der **sichtbare** Rand des größten Modells, nicht sein Zeichenradius (dieselbe Lehre wie beim
  Boss-Puls und beim Nest). `kbMaxOrbit` steht seither als EINE Quelle direkt hinter `sysPlanets` –
  Portal und Basis lasen ihn vorher jeweils selbst.
- **KB-20d – die Schranke misst die ZIELhöhe, nicht die aktuelle.** Ohne das entschieden Kastenhöhe
  und Zeichnung getrennt: Bei einem breiten, flachen Fenster (ab 1472 px Breite) bekam der Kasten
  die volle Sektor-Höhe, während die Zeichnung flach blieb. Gemessen bei 1920×804: Kasten 1258×629,
  Verhältnis exakt 0,500, Füllung 0,351 – **zwei Pixel Fensterhöhe mehr kippen die Zeichnung von
  flach auf rund** (die zunächst notierten „47 %" hielten 0,351 gegen eine Füllung aus einem
  ANDEREN Viewport und waren damit keine Messung, sondern eine Mischung zweier). `kbRunderKasten()` misst deshalb `max(480, innerHeight − 175)` gegen die gemessene
  Kastenbreite (kein Zirkelschluss: die Breite hängt nicht an der Höhe), hat einen 200-ms-Zwischen-
  speicher (es läuft ~677-mal je Kartenaufbau) und behält bei einem VERSTECKTEN Reiter den zuletzt
  gültigen Stand, statt eine Antwort zu erfinden. `kbSystemKastenHoehe()` gibt die volle
  Sektor-Höhe nur noch zurück, wo auch die runde Zeichnung gilt.
- **KB-20e – eine Fenstergrößenänderung bei OFFENEM System zog nichts nach.** Bis KB-20 war das
  folgenlos (Ausschnitt und Kastenhöhe hingen beide an der Breite); seither können Kastenhöhe,
  Zeichnung und Kamera aus **drei verschiedenen Momenten** stammen. Gemessen 1920×1040 → 1920×780
  an einem System mit Orbit 10: Direkt nach der Änderung sieht alles unauffällig aus. Erst der
  nächste Neuaufbau – **ein Zoom-Klick genügt** – löst alles auf einmal ein, und dann liegen
  **sechs von zehn Planeten außerhalb des Kastens** (`["gx031"…"gx036"]`). `kbFensterNachziehen()`
  setzt deshalb entprellt (220 ms) Höhe, Zeichnung und Kamera in genau dieser Reihenfolge neu; der
  Zwischenspeicher aus KB-20d wird dabei ausdrücklich verworfen, damit die Zusage nicht an der
  Reihenfolge zweier Zahlen hängt. Die zwei Sektor-Ansichten brauchen nichts davon – ihre Höhe ist
  ein CSS-Ausdruck mit `100dvh` und folgt dem Fenster von selbst.

**Wächter:** `tests/test_kartenresize.js` (7 Prüfungen). Er prüft **nicht** einzelne Zahlen, sondern
die Eigenschaft: *Nach einer Größenänderung steht die Karte so da, wie sie stünde, wenn das Fenster
von Anfang an diese Größe gehabt hätte.* Jede Messung läuft deshalb als PAAR gegen eine Kontrolle,
die direkt in der Zielgröße startet – gemessen ist die viewBox danach zeichengleich
(`199.8 92.8 571.8 190.9`). Dazu `test_kartengroesse` Abschnitt 5 für das **flache Band** (1920×700:
flache Zeichnung UND flache Kastenhöhe als PAAR – die Gegenprobe mit zurückgenommenem KB-20d meldet
`{"zeichnungVerh":0.32,"kasten":{"h":525}}`) und `test_kartenmarker` **1c**.

**`test_kartenmarker` 1c ist die eigentliche Lehre dieser Runde.** Der Test maß bis dahin
ausschließlich Abstände ZWISCHEN Objekten und stellte die Frage „liegt das überhaupt im Kasten?" nie
– genau deshalb hat er weder gesehen, dass das Portal am Handy seit KB-12 **vier Tage** unsichtbar
war, noch die Allianzbasis. 1c misst das jetzt **datengetrieben über alle sechs Markerarten**, eine
neue erbt den Schutz automatisch (Regel 40). Beide Gegenproben fallen spezifisch und mit sprechendem
Beleg: Basis zurück auf den festen Punkt → 29 px (Handy) bzw. 61 px (PC) über die linke Kante;
Portal zurück → 127 bzw. 270 px über die rechte.

**Zwei Werkzeugfehler aus dieser Runde, beide über den Einzelfall hinaus:**
1. **Zwei Messläufe teilten sich EIN Speicher-Objekt.** `test_kartenmarker` fährt Handy und PC
   nacheinander gegen dasselbe `store`, und das Spiel schreibt darin während des Laufs herum. Im
   Handy-Lauf stand die Allianzbasis auf der Karte, im PC-Lauf danach nicht mehr – bei identischem
   Code und identischer Fixture. **Ein Messwerkzeug, dessen erster Lauf den zweiten verändert, misst
   nicht zweimal dasselbe** (dieselbe Familie wie Regel 15/17/19). Jeder Lauf bekommt seither eine
   eigene Kopie.
2. **Eine Fixture-Ergänzung im Spielstand allein genügt nicht, wenn ein Lade-Pfad sie überschreibt.**
   `loadAllianceBase` setzt `state.allianceBase` beim Boot **bedingungslos** auf das, was der Server
   liefert – bei fehlendem Schlüssel also auf `null`. Die Basis muss deshalb im *geteilten Speicher*
   der Fixture liegen, nicht nur im Spielstand. Gefunden hat es die eigene Vorab-Prüfung
   (`gemesseneArten` ohne `allianzbasis`), nicht das Nachdenken – Regel 37 in der Anwendung.

**Und ein Beinahe-Fehler in eigener Sache, gemessen statt geglaubt:** In den Kommentar am
Entflechter war zunächst „in 2,3 % der Fälle überlappt eine Beschriftung das Portal" geschrieben –
eine Zahl aus einer Zusammenfassung, die eine ganz andere Größe gemessen hatte. Sie ist wieder raus,
bevor sie ausgeliefert wurde: **eine Zahl, die man nicht selbst gemessen hat, gehört nicht in den
Quelltext** (Regel 41). Der offene Befund selbst steht jetzt dort ausformuliert – `kbLabelsEntflechten`
misst mit `getBBox()`, das die `scale`-Transformation des Portals **nicht** kennt (gemessen 82 gegen
27,9 Einheiten), und wer das Portal dort aufnehmen will, macht den Entflechter **zuerst**
transform-fest.

**KB-20f bis KB-20i (21.08.2026) sind die Befunde einer ZWEITEN adversarischen Durchsicht – und
drei der vier waren Regressionen, die mein eigener Änderungssatz erzeugt hatte.** Der Wert dieser
Runde liegt genau darin: Die erste Durchsicht hatte den Änderungssatz von KB-20c/d/e geprüft, die
zweite prüfte, was er selbst kaputtgemacht hat.

- **KB-20f – jede Fenstergrößenänderung warf den ZOOM weg.** Der Handler aus KB-20e rief Höhe,
  `buildMap()` und `galaxyCamFahre(true)` **bedingungslos**. Zoom und Verschiebung leben aber
  ausschließlich in `galaxyMapViewBox`, und `galaxyCamFahre(true)` ersetzt dieses Objekt durch den
  Vorgabe-Ausschnitt. Am PC traf das jedes Ziehen am Fensterrahmen, am Handy schon das Auf- und
  Zuklappen der Bildschirmtastatur (der Viewport-meta trägt `interactive-widget=resizes-content`,
  und das Suchfeld der Karte öffnet sie). Neu gezielt wird nur noch, wenn sich wirklich etwas
  Kamerarelevantes geändert hat – sonst zieht `galaxyVerhaeltnisAngleichen()` nur die HÖHE des
  Ausschnitts nach und lässt die Breite, also die Zoomstufe, stehen. **Diese zoom-erhaltende
  Antwort existierte längst; KB-20e hatte eine zerstörende danebengestellt.**
  Der erste Entwurf ließ die zwei Zeilen weg, weil ich annahm, das erledige der nächste
  `buildGalaxyMap()`. Gemessen läuft der gar nicht, wenn sich sonst nichts geändert hat –
  `test_kartenresize` 3 hat es gefangen (Kastenverhältnis 0,576 gegen Kameraverhältnis 0,688).
  **Eine Annahme ist kein Messwert** (Regel 48).
- **KB-20g – am PC scrollte beim Öffnen nichts, und die Karte stand außerhalb des Fensters.** Der
  Scroll aus KB-7/KB-10 galt nur am Handy (`innerWidth <= 700`). Seit KB-20 ist der Kasten am PC so
  hoch wie in den Sektor-Ansichten: gemessen bei 1600×1040 stehen nach dem Öffnen **325 von 865 px**
  der Karte im Bild und **alle vier** Overlay-Knöpfe (‹ › + −) außerhalb des Fensters. Die
  Breiten-Schranke bleibt als ODER stehen (das Handy verhält sich exakt wie bisher), dazu kommt die
  Frage nach der SACHE: Ist genug vom Kasten im Bild? Gemessen gegen das hier maximal Erreichbare –
  ein Kasten, der höher als das Fenster ist, kann nie ganz sichtbar sein, und ein Scroll darf nicht
  daran hängen, dass er Unmögliches verlangt. **Ein Bestandsfall kam dabei mit heraus:** Bei
  1920×700 war die Karte schon vor KB-20 zu **0 px** sichtbar.
- **KB-20h – der Kollisionsschieber schob die Allianzbasis aus dem Bild.** `kbMarkerFrei` wich
  ausschließlich nach AUSSEN aus. Mit den echten Funktionen der Datei nachgemessen (ausgeführt,
  nicht nachgebaut): Bei der runden Zeichnung landeten **14 von 138** Markern draußen – alle die
  Allianzbasis, bis zu 18,2 Einheiten über die linke Kante, weil ihr fester Winkel 205° fast auf dem
  Bahnwinkel −160° der Orbits 3, 9 und 15 liegt und sie deshalb um 71 bis 81 Einheiten nach außen
  wandert. Bei der flachen Zeichnung waren es 0. Wer eine Obergrenze mitgibt, bekommt jetzt einen
  zweiten Durchgang nach INNEN; findet sich auch dort nichts, wird gekappt – ein Marker, der eine
  Scheibe überlappt, aber IM BILD steht, ist ehrlicher als einer, den niemand sieht (dieselbe
  Abwägung wie beim Label-Deckel von KB-16). Ohne `maxRadius` verhält sich die Funktion byte-genau
  wie vorher; das ist die Zusage für die fünf übrigen Markerarten.
  **Der erste Entwurf war wirkungslos und sah richtig aus:** Er prüfte die Grenze nur am
  SCHLEIFENENDE – im Anlassfall findet die Schleife aber nach vier bis fünf Schritten einen freien
  Platz, nur eben einen außerhalb des Bildes. Aufgefallen ist es allein daran, dass dieselbe Messung
  danach WIEDERHOLT wurde und unverändert 14 von 138 meldete (Regel 48).
- **KB-20i – der KB-20e-Kommentar beschrieb einen Mechanismus, den der Code nicht hat.** Er sagte,
  die Kastenhöhe stehe „als fester Pixelwert im style-Attribut" und der Schaden sei ein Beschnitt
  oben und unten. Beides ist nachgemessen falsch: Am breiten runden Kasten ist die Höhe
  `KB_SEKTOR_KASTEN_HOEHE`, also ein CSS-Ausdruck mit `100dvh`, und das SVG hat kein
  `preserveAspectRatio` – es gilt `xMidYMid meet`, das nie beschneidet. **Direkt nach der Änderung
  ist gemessen gar nichts draußen**; die Karte wird nur unnötig klein (1920×1040 → 1920×810: Kasten
  folgt 865 → 635 px, die Kamera behält ihre 362×248,9 Einheiten, der Planetendurchmesser fällt von
  87 auf 56 px). Der Schaden kommt beim nächsten Neuaufbau – ein Zoom-Klick genügt: 1920×1040 →
  1920×780 ohne den Handler springt der Kasten von 605 auf 420 px, die Zeichnung kippt von rund
  (358×323 Einheiten) auf flach (755×262), während die Kamera weiter den engen runden Ausschnitt von
  258,6 Einheiten hält – danach liegen **alle sechs** gemessenen Planeten außerhalb, bis zu 1713 px
  weit. Die Kontrolle, die von Anfang an 1920×780 groß ist, hat nach demselben Zoom-Klick zwei
  Objekte knapp am Rand (139 bzw. 83 px) – das ist der normale Preis des Hineinzoomens und der
  Beleg, dass die sechs nicht vom Klick kommen.
  **Die Lehre ist nicht der Einzelfall:** Ein Kommentar, der eine Begründung nennt, die man nicht
  gemessen hat, ist eine zweite Anzeigestelle mit Ablaufdatum – beim nächsten Lesen wird er als
  REGEL gelesen. Dasselbe ist in dieser Sitzung schon zweimal passiert (die „23 weiteren"
  angeschnittenen Systeme und die „47 %", beide korrigiert).

**Zwei Lücken am Portal, beide aus derselben Durchsicht:**
Der Systemname aus der Serverantwort ging **ohne `escapeHtml`** in ein Attribut (jetzt escaped, wie
jede andere Serverzeichenkette), und das Portal ignorierte die Ebene **„Ereignisse"**, obwohl zwei
Texte sie versprechen – das Gate umschließt jetzt auch `kbMarkerFrei` und die Anmeldung in
`platzierteMarker`, damit ein abgeschaltetes Portal auch keinen Platz mehr belegt.
Dazu ein **`prefers-reduced-motion`-Gate** (`kbBewegungAus()`): Wer Bewegung abbestellt hat, bekommt
das Portal statisch statt mit 36 Dauerschleifen – die Zeichnung bleibt vollständig, nur die
Animations-Tags fallen weg (alle 36 sind selbstschließend, nachgemessen; gemessen 0 Animationen und
41 Formen gegen 36/41).
**Die Kostenmessung dazu ist ehrlich unentschieden und steht so auch im Quelltext:** Unter
4-facher CPU-Drosselung kostet das Portal nachweislich (mit 4.478–8.600 ms Long Tasks je 10 s, ohne
1.083–1.330, also Faktor 3–6). **WELCHER Bestandteil, ließ sich NICHT auflösen** – die Variante ohne
die `<animate>`-Tags streute 2.628–5.947 und überlappte die unveränderte vollständig; ein erster
Lauf hatte sie als Hauptkostenträger gemeldet, die Wiederholung hat das widerlegt (Regel 20). Ohne
Drosselung sind es in beiden Fällen 0 Long Tasks, und das Portal steht in höchstens zwei von 69
Systemen. **Ein blinder Umbau der Zeichnung wäre damit nicht gedeckt.**

**Drei Bestandstests waren auf dieselbe Weise blind und sind mitgezogen worden:**
- `test_flugbahn_ursprung` 3b leitete die Markerposition aus dem LABEL ab (`y − 20`). `kbLabelsEntflechten`
  darf ein Label aber um bis zu 21 Einheiten senkrecht und 12 seitlich verschieben (KB-16), während
  3b darunter 1,0 Einheiten Toleranz verlangt – der Test war also nur so lange grün, wie dieses eine
  Label zufällig an seiner natürlichen Stelle bleibt. Gegriffen werden jetzt die **direkten
  `circle`-Kinder** der Heimat-Gruppe (der Maskenkreis liegt in einem `clipPath`, der Mondkreis und
  der Orbitalring in eigenen `<g>` – Regel 51), und eine Vorab-Prüfung belegt, dass sie sich einig
  sind. Beidseitig gegengeprüft an einer Kopie, in der jedes Label um 21 Einheiten ausweicht: der
  alte Griff fällt mit `abweichung 21.00` auf völlig korrektem Code, der neue bleibt grün; und mit
  der Linie zurück auf der rohen Slot-Position fällt der neue mit `abweichung 15.10`.
- `test_kartenbeschriftung` hatte **kein `activeWormhole`** in seiner Galaxie-Antwort und sah die
  neue Portal-Beschriftung deshalb nie – obwohl sie ein `text.planet-label` ist, das AUSSERHALB der
  Portal-Gruppe liegt und für den Entflechter damit eine freistehende Beschriftung ohne eigenes
  Objekt ist, die andere verdrängen kann. Gemessen mit der Fixture: kepler 12 → 13 Texte, vega
  7 → 8. Eine Vorab-Prüfung hält fest, dass sie wirklich mitgemessen wird.
- Und sein **„PC"-Lauf bei 1280×900 bekommt seit KB-20 die RUNDE Zeichnung** (gemessen: Kasten
  738×725, Verhältnis 0,98; Zeichnung 0,81) – die flache, für die er ursprünglich kalibriert wurde,
  maß danach niemand mehr. Dazu ein dritter Formfaktor **„PC flach" (1920×700)**, und weil ein
  dritter Lauf nur dann einer ist, wenn er wirklich etwas anderes zeichnet, misst eine
  Vorab-Prüfung das Zeichnungsverhältnis je Formfaktor gegen dieselbe 0,5-Schranke, die
  `kbRunderKasten` benutzt (gemessen rund 0,54–0,83, flach 0,21–0,33). Am flachen PC gibt es
  übrigens **null** bekannte Ausnahmen – kein Fehlschlag, der vom ersten Tag an rot wäre (Regel 53).

**Wächter:** `test_kartenresize` (12 Prüfungen, Zoom-Erhalt als eigenes PAAR),
`test_karte_handy_bedienung` (Overlay-Knöpfe per `elementFromPoint`, jetzt auch am PC),
`test_kartenmarker` 1c (datengetrieben über alle sechs Markerarten),
`test_wurmloch_portal` (21 Prüfungen: Ereignisse-Ebene als PAAR über den Spielerweg, Reduced-Motion
als PAAR aus Animationszahl UND Formzahl) und `test_kartenbeschriftung` (24 Prüfungen).

**Tests navigieren über `tests/lib/karte.js`** (`oeffneSystemUeberSektoren`/`oeffneSektorMitSystem` – Spielerweg per DOM-Klicks, Region wird nie geraten, wartet die Kamerafahrt samt Folge-Tick ab).
- **Kennwert-Balken sind EINE Bildsprache für Schiffe UND Verteidigungsanlagen** (VT-1, 18.08.2026, Auftrag Sascha „bei verteidigung auch wie bei flotte die balken"). Die Werft zeichnet je Schiff vier beschriftete Mikro-Balken (`shipStatBarsHtml`, CSS-Klasse `.sstat`, Balken im Verhältnis zum besten Wert der Flotte); die Verteidigungskarten standen bis dahin auf dem Stand davor – eine Fließtext-Zeile mit Mitteldots. `defenseStatBarsHtml(def, lvl)` zeichnet jetzt drei Balken je Anlage: **Angriff** (`atkVal`), **Vert.** (`defVal`) und **Schild** (`def.shield`, beim Laden als `round(defVal*0,4)` abgeleitet und in `defensePower` ein eigener Summand – also eine echte Größe, keine erfundene). Bewusste Entscheidungen dabei: (a) **dieselbe CSS-Klasse und dieselben Farben** wie die Schiffe (Angriff rot, Schild cyan, Verteidigung violett) – eine zweite Balken-Klasse wäre die typische zweite Anzeigestelle, die beim nächsten Umbau ausei­nanderläuft; (b) **kein vierter Balken „Bauzeit"** – dort ist weniger besser, ein langer Balken läse sich aber wie ein guter Wert; (c) die Balken zeigen den Wert **je Stufe** (die zwischen Anlagen vergleichbare Größe, wie „je Schiff" bei der Flotte), die vorhandene Zeile „aktuell → nach Ausbau" bleibt daneben, weil sie eine andere Frage beantwortet; (d) **Abhorchposten und Mondschild bekommen keine Balken** – sie tragen ihre Wirkung in eigenen Regeln (`atkVal`/`defVal` beide 0), drei Nullbalken wären dort nichtssagend (dieselbe Ausnahme kennt `defenseLockedPreview()` schon). Die Balken hängen im Kartenkörper, **nicht** hinter dem „Details"-Griff – siehe Regel 55, das war der Fehler des ersten Anlaufs. Wächter: `tests/test_verteidigungsbalken.js` (Erwartungswerte aus `BUILDING_DEFS` gelesen, Sichtbarkeit statt Existenz geprüft).
- **Signatur-Cache-Muster für `render*Box()`-Funktionen ohne Live-Countdown**: `let lastXSig = null;` vor der Funktion, am Anfang eine Signatur aus allen angezeigten Werten bilden, bei Gleichheit zum Vorlauf `return` statt `innerHTML` neu zu schreiben (Beispiele: `renderAllianceBaseHero`, `renderDominance`, `renderGalaxyNews`, `renderReportsBox`, `renderAllianceTitlesBox`/`renderAllianceSkinsBox`, `renderDailyLoginBox`, `renderFpAllianceDonation`, `renderFpLeaderboard`). **Nur anwenden, wenn die Box KEINEN Live-Countdown (`Date.now()`-Differenz, die sichtbar hochzählt) enthält** – sonst würde die Anzeige sichtbar einfrieren; bei Countdown-Boxen stattdessen `setBoxHtml` (Markup-Signatur, selbstkorrigierend – siehe unten). **Korrektur 16.08.2026:** Hier stand, `renderAutoExploreTourBox`/`renderAbhorchpostenBox` nutzten „stattdessen `isTypingIn()`" – das war falsch, beide schreiben nacktes `innerHTML` ohne jeden Schutz (nachgesehen, nicht erinnert; sie enthalten Live-Countdowns, weshalb die WERTLISTEN-Signatur dort zu Recht fehlt – ein Tipp-Schutz war nie da und ist mangels Eingabefeldern auch nicht nötig). `renderFactions`/`renderMarket`/`renderTradeRoutes` nutzen tatsächlich `bedienungLaeuft()`/`isTypingIn()`, Markt und Routen seit v8.538.0 zusätzlich `setBoxHtml`. Neue `render*Box()`-Funktionen ohne Countdown sollten dieses Muster von Anfang an übernehmen statt jeden Tick blind neu aufzubauen.
- **`setBoxHtml(box, schluessel, html)` – die Variante mit MARKUP-Signatur (seit v8.310.0)**, für große Listen, die im Haupt-Tick per `innerHTML` neu geschrieben werden. Statt einer Wertliste ist die Signatur das fertige Markup. Zwei Folgen: (a) Sie kann nicht unvollständig sein – kein neu hinzugekommenes Anzeigefeld kann sie stillschweigend veralten lassen, was bei einer Wertliste die typische Falle ist; (b) **die Countdown-Einschränkung von oben gilt hier NICHT** – läuft ein Countdown, ist das Markup jede Sekunde ein anderes und die Box wird neu geschrieben, läuft keiner, steht sie still. Die Prüfung ist selbstkorrigierend. Der Aufbau der Zeichenkette ist billig; teuer sind `innerHTML` und die anschließenden `querySelectorAll`-Verdrahtungsläufe, und genau die entfallen. Angewandt auf `#research` (73,9 kB), `#buildings` (27,7 kB), `#defenseBuildings` (21,3 kB), `#planetRoleBox` (3,9 kB) – zusammen rund 127 kB Markup pro Sekunde. `childElementCount` als zweite Bedingung im Helfer: Räumt irgendwer die Box von außen leer, muss der Neuaufbau trotz gleicher Signatur laufen. **Vor jeder neuen Anwendung prüfen, WO die Klick-Handler gesetzt werden**: Laufen sie im selben Zweig wie das Schreiben (wie bei den Modul-Boxen), sind sie nach einem übersprungenen Tick nicht neu gesetzt – das geht gut, weil die alten Knoten samt Handler stehen bleiben, muss aber getestet werden (`tests/test_modulbox_cache.js`, `tests/test_listen_cache.js` klicken beide nach mehreren übersprungenen Sekunden). **Messen statt schätzen**: Welche Box wirklich jeden Tick neu geschrieben wird, zeigt ein `MutationObserver` auf `document.body` mit `childList:true, subtree:true`, der die Treffer je Ziel-Element zählt – die statische Suche nach `render*`-Funktionen übersieht die großen Listen, weil die gar keine eigenen Funktionen sind, sondern inline im Haupt-Tick stehen.

  **Zweite Mess-Runde (16.08.2026, v8.538.0)** – dieselbe Messung über alle zwölf Reiter fand 40 Elemente, die auf JEDEM Reiter jede Sekunde byte-identisch neu schrieben. Daraus drei Erweiterungen des Musters:
  - **`setBoxText(el, text)`** – das Gegenstück zu `setBoxHtml` für reine TEXT-Anzeigen: Eine `textContent`-Zuweisung ersetzt den Textknoten auch bei identischem Inhalt; der Helfer schreibt nur bei wirklich geändertem Text. Angewandt auf die ~25 Status-Labels und Kennzahlen (Automatik-Zeilen, Hero-Leiste, Profil, `creditsDisplay`, An/Aus-Labels), die vorher ungeschützt waren. Neue Text-Label-Schreiber im Tick nehmen von Anfang an `setBoxText`.
  - **Alle Zweige einer Box laufen über DENSELBEN `setBoxHtml`-Schlüssel** (Gastmodus-Notiz, Ladenotiz, Hauptinhalt – Beispiele `marketBox`, `moduleMarketBox`, `traderBox`, `doctrineBox`): Ein Zweig, der am Schlüssel vorbei direkt `innerHTML` schreibt, macht den Cache beim nächsten Zustandswechsel still falsch (die Notiz käme nie wieder durch, weil der Cache sie noch für gezeichnet hält).
  - **`renderModuleMarket` war das Lehrstück gegen Wertlisten-Buckets**: Seine Signatur bündelte die Kredite in 1000er-Schritten – kippte die Bezahlbarkeit eines Angebots INNERHALB eines Buckets, blieb der Kauf-Knopf fälschlich ausgegraut. Ersetzt durch die Markup-Signatur; das `disabled`-Attribut steht im Markup und kann nicht veralten. Wer eine Wertlisten-Signatur über einen abgeleiteten/gerundeten Wert bildet, prüfe, ob die ROHGRÖSSE unterhalb der Rundung sichtbare Zustände kippen kann.
  Umgestellt in dieser Runde außerdem: `tradeRouteBox` (1,45 kB/s, größter Einzelposten), `fleetStickyBar`, `missionsActive`/`expeditionsActive`/`fleetPositionList` (Leer-Notizen; mit Countdown schreiben sie weiter), `relocateBox`, `inventoryBox`, `scoreLogBox`, `rareItemsBox`, `kofiTopSupporterBox`, die drei Verlaufs-SVGs (`scoreHistorySvg`/`creditsHistorySvg`/`prodHistorySvg` – `innerHTML` und `childElementCount` funktionieren auf SVG-Elementen genauso). Dazu ein 10s-Cooldown in `loadMarketState`: Liefert der Server dauerhaft eine ok-Antwort ohne Marktdaten (real passiert 15.08.2026, Backend hing hinter dem Frontend), fragte der Lade-Zweig 1×/s an UND zeichnete je Antwort ein zweites Mal – gemessen 2 volle renderMarket-Läufe und 86.000 Anfragen/Tag je offenem Markt-Tab. Wächter: `tests/test_tickruhe.js` (eingefrorene Uhr nach Regel 18 für „steht still", laufende Mission für „friert nicht ein", Klicks nach übersprungenen Ticks für die Verdrahtung im Schreibzweig) und `tests/test_marktriegel_bauboxen.js` 2a–2c (Cooldown gebremst UND Selbstheilung lebt).
- **Content-Security-Policy: `connect-src 'self'` als zweite Linie um das Sitzungs-Token**
  (18.08.2026, Sicherheits-Audit Punkt 5). Der Token liegt in `localStorage['kepler7_token']` und
  ist damit in JS-Reichweite; eine XSS-Lücke könnte ihn mit einer Zeile auslesen. Beim Audit wurde
  **keine** gefunden (Chat, Nachrichten und Allianz-Tags laufen durch `escapeHtml`, Allianznamen
  über `setBoxText`, und Spielernamen können bauartbedingt kein Markup enthalten – `server.js`
  erlaubt nur `[a-zA-Z0-9_\-äöüÄÖÜß]{3,18}`). Die CSP ändert daran nichts, sondern die FOLGE:
  Auslesen ja, **wegschicken nein**.
  Tragfähig ist das, weil das Spiel ausschließlich mit dem eigenen `/api` spricht – gemessen 9
  `fetch`-Ziele, alle relativ, dazu kein `XMLHttpRequest`, kein `WebSocket`, kein `sendBeacon`,
  kein `EventSource`. Die fremden Hosts (Discord, Ko-fi, Instagram, TikTok, YouTube) stehen
  ausschließlich in `<a href>`-Links, und die begrenzt `connect-src` nicht.
  **Drei Dinge, die man beim Anfassen wissen muss:**
  (a) **Kein `default-src`, und das ist eine Entscheidung.** Nicht genannte Direktiven fallen nur
  dann auf `default-src` zurück, wenn es eines GIBT. Ohne bleiben Schrift (Base64-Datei-URI),
  Inline-Stile und der Inline-Skriptblock unberührt. Ein `script-src` bräuchte hier zwingend
  `'unsafe-inline'` (die ganze Spiellogik ist EIN Block) und wäre damit wirkungslos – das ist eine
  eigene, größere Etappe. `tests/test_csp_verbindung.js` 1b hält das fest.
  (b) **`frame-ancestors`, HSTS und `nosniff` wirken in einem meta-Tag NICHT** – sie müssen als
  echte Kopfzeilen aus der nginx.conf des Pi kommen. An der Produktion gemessen fehlten dort am
  18.08.2026 **alle** Sicherheits-Kopfzeilen; der kopierfertige Block steht in
  `gamegeeeeek-ai-core/docs/sicherheits-audit-2026-08-18.md`. Eine Kopfzeilen-CSP ERSETZT die
  meta-Zeile übrigens nicht, sie gilt zusätzlich – beide zusammen sind so streng wie die strengere.
  (c) **`strict-origin-when-cross-origin` statt `no-referrer`**: Verify- und Reset-Links tragen
  ihren Token in der URL (`?verify=…`). Der gewählte Wert entfernt Pfad UND Abfrage bei fremden
  Zielen – der Token ist damit vollständig geschützt –, lässt aber die bloße Herkunft stehen, so
  dass Ko-fi weiterhin sieht, dass der Besucher aus dem Spiel kam. `no-referrer` hätte auch das
  genommen, ohne zusätzlichen Schutz.
  Wächter: `tests/test_csp_verbindung.js` – misst an einem echten Browser über HTTP (unter
  `file://` ist `'self'` eine undurchsichtige Herkunft, „gleiche Herkunft erlaubt" ließe sich dort
  gar nicht messen; eigener Port 3241). Das PAAR ist der Beleg: fremde Herkunft blockiert UND
  eigene erlaubt – 2b allein wäre ohne jede CSP trivial grün, 2a allein auch bei einer viel zu
  strengen CSP, die das Spiel lahmlegt. Gemessen wird das `securitypolicyviolation`-Ereignis, nicht
  „der Aufruf ist gescheitert": Ein CSP-Block und eine nicht auflösbare Adresse werfen BEIDE einen
  `TypeError`, das allein belegt also nichts (Regel 28).
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

**Meilenstein-Embleme (17.08.2026):** `em_funke`/`em_leitstern`/`em_leuchtfeuer` hängen an der
Bedingungsart `spender_je` – der **höchsten je erreichten** Spendenstufe. Sie laufen bewusst nie ab
(Details und der Messbefund dazu in der Backend-CLAUDE.md). Für das Frontend heißt das nur: Ihre
`desc` muss diese Eigenschaft ausdrücklich nennen, sonst liest sich das Stück wie ein weiteres
Spender-Abzeichen, das mit dem Rang verschwindet – und genau das tut es nicht.

**Die Freischaltbedingung steht bewusst NICHT im Frontend.** Sie kommt mit dem Katalog vom Server;
`kosmetikBedingungText()` fasst sie nur in Worte. Eine zweite Liste hier wäre die Anzeigestelle, die
eine Bedingung verspricht, die der Server anders durchsetzt – der Spieler spielt dann auf etwas hin,
das ihm danach verweigert wird. `tests/test_kosmetik_paritaet.js` wacht über beide Richtungen und
schlägt an, sobald der Server eine Bedingungsart einführt, die das Frontend nicht übersetzen kann.

Gezeichnet wird an **sechs** Namensstellen (Bestenliste, Seitenmenü/FP-Rangliste, Wochenliga,
Freundesliste, Profilkarte, globaler Chat), alle über `kosmetikFarbAttr()`/`kosmetikEmblem()`.

**Der Chat kam am 17.08.2026 dazu – und die Art, wie, ist die eigentliche Aussage.** Hier stand
vorher, er zeige Kosmetik bewusst nicht, weil seine Nachrichten die Auswahl nicht mitführen. Genau
deshalb darf sie auch nicht aus der Nachricht kommen: Chatnachrichten schreibt der Client selbst in
den geteilten Speicher, eine mitgeschickte Farbe wäre in fünf Sekunden gefälscht. Der Weg ist
stattdessen derselbe wie bei der Freundesliste – Zuordnung über `authorId` zum
`leaderboardCache`, den der Server bei jedem Lesen frisch anreichert. Die `authorId` wiederum prüft
der Server beim Schreiben gegen den angemeldeten Nutzer (`checkChatKeyPermission`): geprüfte
Identität, geprüftes Aussehen. Wer keinen Bestenlisten-Eintrag hat, erscheint schlicht ohne
Auszeichnung – der ehrliche Ausfall statt eines geratenen Aussehens.
`tests/test_kosmetik_flaechen.js` Abschnitt 3 ist die Probe darauf: eine Nachricht mit gefälschtem
`cosmetics`-Feld darf nichts einfärben.

**Zwei Fallen, beide real aufgetreten und beide von derselben Art:**
- **Die Wochenliga zeigte nie Kosmetik.** Sie rief die Zeichen-Helfer korrekt auf, dampfte ihre
  Liste vorher aber auf ein neues Objekt ein, in dem `cosmetics` fehlte – die Helfer bekamen ein
  Objekt ohne das Feld und lieferten stumm `''`. Derselbe Fehler war dort am 05.08.2026 schon
  einmal mit `isSupporter` passiert, und der Kommentar darüber beschrieb ihn bereits. **Wer eine
  Projektion auf wenige Felder baut, muss JEDES Feld mitnehmen, das die Zeile zeichnet** – und es
  gibt in `renderWeeklyLeague` zwei Projektionen (die Liste und den eigenen Nachtrag).
- **Signatur-Caches müssen die Kosmetik enthalten.** `renderFpLeaderboard` und `renderFriendsBox`
  zeichnen sie, führten sie aber nicht in ihrer Signatur – ein Farb- oder Emblemwechsel eines
  anderen Spielers schlug erst durch, wenn sich zufällig dessen Punktestand bewegte. Dafür gibt es
  jetzt `kosmetikSig(e)`; wer eine Box baut, die Kosmetik zeichnet, nimmt sie mit auf.

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


## Bastionsmarken (V2a, 18.08.2026, v8.567.0)

Das Werftmarken-Muster für Verteidigungsanlagen: zehn Stufen je Anlage, +3 % Verteidigungs- **und**
Angriffswert je Stufe, gültig für die ganze Anlagenklasse an **allen** Standorten. Der Schildanteil
läuft mit, weil er aus `defVal` abgeleitet ist.

**Der Hebel ist die Reichweite, nicht der Prozentsatz.** `defensePower(planetKey)` zählt je
Standort, und `pickRaidTargetPlanet` zieht gleichverteilt. Eine Anlagenstufe hilft nur dort, wo sie
steht; eine Marke wirkt überall. Bei elf Standorten ist das der elffache Zuwachs.

**Was sie ausdrücklich NICHT tut**, und das steht so auch im Hilfetext und im Patchnote: den
gemessenen Abstand zu Schiffen schließen (`docs/verteidigung-flotte-konzept.md` 1.1 — Faktor 7,2 bei
einem Tag Einkommen, 21,6 bei einem Jahr). Und sie ändert den **Punktestand nicht** — das wäre
Vorschlag V3 des Konzepts und ein rückwirkender Ranglisten-Eingriff.

**Die EINE Stelle, an der die Marke zu einem Faktor wird, ist `bastionMarkMult()`.** Jede Rechen-
und Anzeigestelle geht dort durch: `defensePower`, `defenseAttackPower`, `bastionDefVal`/
`bastionAtkVal` (Kartenzeile, gesperrte Vorschau), die Kennwert-Balken. Sie wirkt **nie** durch
Mutation an `def.defVal`/`def.atkVal` — eine veränderte Definition würde von jeder Anzeige, jedem
Test und dem Punktestand mitgelesen, und der Server kennt sie nicht.

**Fünf Dinge, die man beim Anfassen wissen muss:**

- **Der Deckel steht in `bastionMarkOf()`, der LESE-Funktion** — nicht nur an der Kaufstelle.
  Dieselbe Lehre wie bei `shipMarkOf`, deren Kommentar sie wörtlich festhält: Ein manipulierter
  Stand liefe sonst durch jede Rechenstelle und löste die Backend-Sanity-Prüfung aus, die den
  GANZEN Spielstand ablehnt.
- **Backend-Parität ist Pflicht.** `computeDefensePower()` entscheidet jedes PvP und wendet
  `bastionMarkMultServer()` an BEIDEN Summierstellen an (Heimat und Kolonien). Dazu
  `SAVE_SANITY_LIMITS.maxBastionMark` = 1000 (großzügig, aus demselben Grund wie `maxShipMark`:
  ein zu enges Limit sperrt einen echten Spieler vom Speichern aus, und das ist der teurere
  Fehler).
- **Die Kostentabelle ist gegen BEIDE Lagerdeckel kalibriert, nicht gegen den Zufluss** — siehe
  Regel 57. Tier 1 ist Anerkennungsbetrag (50 % des gemessenen Deckels beim höchsten
  Klassenfaktor), Tier 2 ist Tor und Senke (42 % des jeweiligen T2-Lagers je Endschritt), die
  ZEIT ist der Hauptpreis (28 h je Leiter bei Faktor 1, 56 h bei 7, ~31 Tage fürs komplette Set).
- **`BASTION_MARK_CLASS_CAP` = 7 ist die Lagerschranke, keine Rundung.** Er senkt die nötige
  Kettengröße von 84 auf 69 Fabrikstufen. Der eigentliche Wächter gegen eine unerfüllbare Zahlung
  ist aber die KOSTENTABELLE: Der rohe Faktor des stärksten Gebäudes ist 8,4, ein höherer Deckel
  kann die Schranke gar nicht reißen — eine angehobene Tier-2-Menge sehr wohl.
- **Zwei Anlagen tragen keine Marke** (Abhorchposten, Mondschildgenerator): `defVal` und `atkVal`
  beide 0, ein Prozentsatz darauf wäre wirkungslos. Die Ausnahme wird über `bastionMarkFaehig()`
  aus den WERTEN abgeleitet, nicht als Namensliste geführt — dieselbe Ausnahme kennen
  `defenseStatBarsHtml` und `defenseLockedPreview` schon.

**Der Ausbau hat einen EIGENEN Auftragsplatz** (`state.bastionMarkJob`), nicht den der Werft: Ein
Bastions-Ausbau, der den Werftmarken-Umbau blockiert, wäre eine Kopplung, die niemand erwartet.
Bewusst ohne Gebäude-, Offiziers- oder Modulrabatt — es gibt keine „Werft für Verteidigung", und
ein Rabatt aus dem Schiffsbau wäre eine Zahl, die niemand nachrechnen kann.

**Prestige-Erhalt ist der ZWECK, nicht ein Detail** (`keepBastionMarks`), und der Aufstieg hat mit
dem **Bastionsregister** (40 % Essenz) den ersten Erhaltungspfad, der nicht die Flotte betrifft.

Wächter: `tests/test_bastionsmarken.js` (48 Prüfungen, Quelltext + Backend-Parität mit
ausgeführtem Funktionsvergleich) und `tests/test_bastionsmarken_ui.js` (26 Prüfungen am
gerenderten Spiel — Sichtbarkeit statt Existenz, Kauf, Abbruch, Wirkung je Anlagenklasse).

## Aliens und Asteroidenfestungen (Konzept 18.08.2026, ALLE Phasen fertig)

Auftrag Sascha: „Ich würde gerne noch aliens und asteroidenfestungen einführen die soll man auf der
karte sehen und angreifen können entwickle ein detailiertes konzept", danach „Alles umsetzten".

**Das Konzept liegt in `docs/aliens-asteroidenfestungen-konzept.md`** (1.530 Zeilen) und ist die
Quelle für alles Weitere – Ziele, Zahlen, Anzeigestellen, Testplan, offene Entscheidungen. Wer daran
arbeitet, liest es zuerst. Hier steht nur der **Stand** und was beim Umsetzen anders entschieden
wurde als dort.

### Die sechs Phasen und wo sie stehen

| Phase | Inhalt | Stand |
|---|---|---|
| **0a** | Schreibsperre für `asteroids:*` im geteilten Speicher | **fertig**, Backend #124 |
| **0b** | `asteroid-contest` bekommt seinen Rückflug, `test_rundflug.js` datengetrieben | **fertig**, #432 (v8.568.0) |
| **0c** | den vestigialen `db.galaxy.worldBoss` entfernen | **fertig**, Backend #125 |
| **1** | Festungen ohne Bauteile: Entstehen, Blockade, Hort, Angriffsmission, Karte | **fertig** – Backend #126/#131/#132, Frontend v8.569.0 |
| **2** | Schildkuppel, Geschütztürme, Zielwahl, Rollenfaktoren | **fertig** – Backend #133, Frontend siehe unten |
| **3** | Nester Stufe 1–5: Reifen, Ausbreiten, Königin, Angriff | **fertig** – Backend #137, Frontend siehe unten |
| **4** | `npcEmpireStrength` wird beweglich (Tauziehen gegen den Nestbestand) | **fertig** – Backend #145, Frontend v8.585.0 |
| **5** | Musterangriff-Zielart `alien-nest` | **fertig** – Backend #149, Frontend v8.590.0 |
| **6** | Feinschliff: Embleme, Kompendium, Vorbote | **fertig** – Backend #150, Frontend v8.597.0. Der `belagerungsplan` folgte am 21.08.2026 mit v8.600.0, mit **umgewidmeter** Wirkung – Begründung im eigenen Abschnitt |

### Was beim Umsetzen ANDERS entschieden wurde als im Konzept

Das Konzept ist älter als der Code. Jede dieser Abweichungen ist eine Entscheidung mit Grund – wer
sie für ein Versehen hält und „repariert", baut den jeweiligen Fehler wieder ein. Die
Backend-Einzelheiten stehen in der Backend-CLAUDE.md unter „Asteroidenfestungen".

- **Die Abklingzeit liegt an der Festung, nicht im Spielstand.** Der Entwurf sah
  `save.festungLetzterSchlag[sysId]` vor – der Spielstand ist klientenautoritativ, ein gelöschtes
  Feld hätte die einzige Bremse der Mechanik per Entwicklerkonsole abschaltbar gemacht.
- **Gezählt wird der angekommene Schaden, nicht der volle Wurf.** Gemessen: Mit dem vollen Wurf
  stünde der letzte Angreifer bei 84,2 % des Hortes statt bei den 40 %, die seiner Arbeit
  entsprechen.
- **Die Kern-Lebenspunkte sind neu gerechnet** (30.000/250.000/1,2 Mio statt 120.000/450.000/1,5
  Mio). Die Konzeptzahl hätte für die Schanze **neunzehn** Schläge bedeutet – fast fünf Tage allein,
  ausgerechnet am Einsteigerziel. Wieder Regel 41: ein Konzept ist kein Messergebnis.
- **Die Angriffsmission folgt Form A** (kein `hinBis`), weil eine Festung keine Frist hat.
- **Phase 1 hat bewusst keine Bauteile und keine Zielwahl** – die sind Phase 2. Der Grundverlust je
  Schlag (6/9/12 %) ist deshalb absichtlich niedrig: Die Geschütztürme sollen ihn später vervielfachen,
  und der Wert, den man sich mit dem Turmbeschuss erkauft, ist der ganze Zweck der Bauteile.
- **Phase 2 hat ZWEI Bauteile, nicht drei.** Das Konzept sprach von Schild, Türmen und Kern als drei
  Bauteilen – der Kern ist aber kein Bauteil, sondern die Festung selbst: Er hat keine eigenen LP
  neben `fest.kern`, kann nicht zerstört werden, ohne dass die Festung fällt, und braucht deshalb
  keinen Eintrag in `FESTUNG_BAUTEILE`. Er trägt nur eine ROLLE (`FESTUNG_KERN_ROLLE`, `kapital`,
  0,85–1,30). Ein dritter Tabelleneintrag hätte eine LP-Leiste versprochen, die es nicht gibt.

### Was die Frontend-Phase 1 gebracht hat – und die drei Funde dabei

Gebaut wurde: der Kartenknoten (gezackte Bastion mit Puls-Ring auf dem Gürtelplatz, `data-map-festung`),
das Kartenmenü (`festungMapMenu` – Kern, Blockade, Hort, Angriffs-Eintrag mit Grund bei Sperre), die
Angriffsmission (`oeffneFestungsangriff`/`sendFestungsMission`, **Form A**), ihre Auflösung
(`festungAufloesen` – wortgleich zu `anfechtungAufloesen`), der Bericht, der Belohnungstyp `festung`
in `claimPendingRewards` und der Hilfetext. Wächter: `tests/test_festung_ui.js` (23 Prüfungen am
gerenderten Spiel) und `tests/test_festung_paritaet.js` (Tabellen-Parität gegen `server.js`).

**Die Stufentabelle liegt jetzt in BEIDEN Repos** – `FESTUNG_STUFEN` im Frontend führt nur, was die
Vorschau wirklich braucht (`blockade`, `proto`, `kern`, `name`). Sie muss dort liegen, weil
`abbauPlan()` **vor** dem Serveraufruf läuft; ohne sie nennt die Vorschau eine Ladung, die die
Mission nicht einhält. `test_festung_paritaet.js` hält beide Seiten zusammen. Dieselbe Kopie-Familie
wie `ASTEROID_SORTEN`/`AST_SORTEN`.

**Drei Funde, jeder von einem Test gefangen, keiner beim Lesen des Codes:**

1. **Die Blockade war komplett wirkungslos** (Backend, behoben in #131). Sie kürzte die
   Anti-Betrugs-Obergrenze, und die hat per Konstruktion „Faktor 3,5 Luft" – gemessen für vier
   typische Flotten band sie **in keinem Fall**. Aufgefallen erst beim Nachrechnen der beiden
   Kapazitäten gegeneinander für die Vorschau. Einzelheiten in der Backend-CLAUDE.md.
2. **Der Missionsstart fror die UNGEDROSSELTE Protomaterie ein**, während die Vorschau drosselte –
   gefangen von `test_protomaterie` 6c, der genau diese Doppelung seit der Sorten-Umstellung prüft.
   Der Kommentar dort sagt es wörtlich: „die Vorschau darf nicht zweite Zahl neben der echten sein".
   Behoben, indem beide Stellen `protoJeFuhre(a) * faktor` rechnen, mit dem SERVERWERT
   (`protoBlockade`) als Vorrang und dem lokalen Faktor als Rückfall für den Solo-Betrieb.
3. **Die Missionstyp-Liste steht ZWEIMAL in der Datei** (`m.type==='asteroid-contest' || …`, Zeilen
   ~21855 und ~59543). Ein Ersetzer mit `count==1` bricht dort ab – und wer nur eine Stelle pflegt,
   hat die klassische zweite Anzeigestelle. Dazu kommen ein eigener Zweig in der Missionskarte und
   einer in der Flottenleiste: Ohne sie fällt eine neue Missionsart in den generischen Zweig und
   steht dort als **„Erkundungsziel"**, weil der `PLANETS.find(p => p.id === m.targetId)` sucht.

**Zwei Lehren für TESTS, beide aus Gegenproben dieser Etappe** – sie stehen unten als Arbeitsregeln
61 und 62, weil sie über diesen Fall hinausgehen.

### Was die Frontend-Phase 2 gebracht hat – und die Falle beim Messen

Gebaut wurde: die **Zielwahl** in der Angriffs-Vorschau (`data-fest-ziel`-Knöpfe für jedes stehende
Bauteil plus immer den Kern), die **Rollenfaktoren** je Ziel, die **Bauteil-Balken** in Vorschau und
Kartenmenü, das Ziel in Missionskarte, Flottenleiste und Bericht, und der erweiterte Hilfetext.
Wächter: `tests/test_festung_ui.js` Abschnitt 6 (42 Prüfungen insgesamt, vier Gegenproben) und
`tests/test_festung_paritaet.js` 5-anker…5g.

Vier Entscheidungen, die man kennen muss:

- **`festungZiel` ist eine MODULVARIABLE, nicht im DOM.** Der Flottendialog zeichnet sich bei jeder
  Änderung neu; ein `<select>` oder ein `data-`-Attribut darin verlöre seinen Wert. Genau dieser
  Fehler hat beim Allianz-Raid dazu geführt, dass still mit der Vorgabedauer gestartet wurde (siehe
  „Jeder Bedienzustand, der NUR im DOM steckt").
- **Der Rollenanteil wird EXAKT wie im Backend gerechnet** (`festungRohkraft`: Grundwert je
  Schiffsklasse aus `SHIP_DEFS` mal `diminishingShipCount`), **nicht** über `attackPowerRaw`. Der
  Unterschied ist der Punkt: `attackPowerRaw` trägt klassenspezifische Modulboni, die sich beim
  Bilden eines ANTEILS nicht herauskürzen – die Vorschau nennte dann einen anderen Faktor als den,
  mit dem der Server rechnet. Die zweite Zahl neben der echten.
- **Das Ziel reist in der MISSION mit, nicht im Request.** `/api/festung/angriff` nimmt weiterhin
  keinen einzigen Kampfparameter aus dem Body entgegen – dieselbe Eigenschaft wie `/api/attack` und
  derselbe Weg wie beim Gefechtsvorrat.
- **Ohne Bauteile sieht der Spieler genau das, was er vorher sah.** Eine Festung aus Phase 1 (oder
  jede, solange `FESTUNG_BAUTEILE_AKTIV` aus ist) trägt kein `bauteile`-Feld; `festungZiele()`
  liefert dann nur `['kern']`, und der ganze Abschnitt fällt weg – kein leerer Kasten, keine Wahl
  ohne Wirkung. Gegenrichtung als Prüfung: `test_festung_ui.js` 6l.

**Die Namen kollidieren mit zwei Verteidigungsgebäuden – geprüft und bewusst so gelassen.**
`Schildkuppel` und `Geschütztürme` heißen fast wie die Gebäude **Hochenergie-Schildkuppel** und
**Singularitäts-Geschützturm**. Beide Gebäude tragen einen unterscheidenden Vorsatz, die Schlüssel
sind verschieden (`schild`/`tuerme` gegen `schildkuppel`/`singularitaetsturm`), und die Flächen
liegen weit auseinander: eigener Verteidigungs-Reiter gegen Kartenmenü einer fremden Festung. Wer
hier prüft oder greppt, muss die Suche trotzdem auf ihren Block scopen (Regel 39) – eine Suche nach
`Schildkuppel` über die ganze Datei trifft zuerst das Gebäude.

**Die Falle beim Messen, und sie ist Arbeitsregel 7 in neuem Gewand:** Der erste Entwurf von
Abschnitt 6 gab dem Verband 80 Jäger und sonst nichts – ein reiner Abfangjäger-Verband, damit die
drei Faktoren maximal auseinanderliegen. Gemessen kam für ALLE drei Ziele der untere Anschlag
heraus (0,70/0,70/0,85). Der Grund stand in der Auswahlzeile daneben: „nur 0 passen in den
Hangar". `capFighterSelection()` kappt Jäger und Bomber auf die Hangar-Kapazität der
**mitgeschickten** Träger (`hangarCapacity`: 6 je Carrier) – ohne einen einzigen Träger fiel die
Auswahl auf 0 Jäger zurück, übrig blieben die Frachter, und der Rollenanteil war für jede Rolle 0.
Der Test hätte damit den **Hangardeckel** gemessen statt der Rollenwirkung. Behoben, indem der
Verband 20 Träger mitbekommt (der Carrier ist seit der Umwidmung vom 02.08.2026 selbst `abfang`,
der Verband bleibt also sortenrein): danach 1,60 gegen die Türme, 0,70 gegen den Schild, 0,85 gegen
den Kern. **Übertragbar: Wer eine Flotte für eine Messung zusammenstellt, prüft, ob sie in dieser
Form überhaupt fliegen darf** – die Auswahl-UI sagt es, wenn man sie liest.

### Was die Frontend-Phase 3 gebracht hat (Alien-Nester)

Gebaut wurde: die **Frontend-Kopie** von `ALIEN_VOELKER`/`NEST_STUFEN`, der **Kartenknoten**
(pulsierende Zellform, `data-map-nest`), `nestMapMenu()`, die **Angriffsmission**
(`oeffneNestAngriff`/`sendNestMission`/`nestVorschauHtml`, **Form A**), ihre Auflösung
(`nestAufloesen`), der Bericht, der Belohnungstyp `alien-nest` in `claimPendingRewards`, die
Missionslinie und ein eigener Hilfe-Abschnitt. Wächter: `tests/test_nest_ui.js` (20 Prüfungen am
gerenderten Spiel, zwei Gegenproben) und `tests/test_nest_paritaet.js` (11 Prüfungen).

Vier Entscheidungen, die man kennen muss:

- **Der Nest-Marker hat einen EIGENEN Winkel (340°), `npcMarkerXY()` hat 200° fest verdrahtet.**
  Zwei Marker mit demselben festen Winkel lägen exakt aufeinander, und nur der Kollisionsschieber
  trennte sie zufällig – genau die Fehlerklasse, die KB-13 behoben hat. Mehrere Nester im selben
  System fächern über den Index auf; beide laufen durch `kbMarkerFrei()`.
- **`missionMapZiel()` braucht einen eigenen Zweig.** Ein Nest ist kein Planet; die generische
  Suche (`PLANETS.find`) fiele ins Leere und die Missionslinie bliebe aus. Derselbe Grund wie bei
  den eigenen Zweigen in Missionskarte und Flottenleiste, wo die Mission sonst als
  **„Erkundungsziel"** stünde.
- **`system` reist in der Mission mit** – nicht als Schmuck: Der Server erkennt daran, dass ein
  Nest der Nomaden **weitergezogen** ist. Ohne das Feld liefe der Anflug gegen das neue System, als
  wäre nichts geschehen. `test_nest_ui.js` 4c prüft es, die Gegenprobe ohne das Feld fällt.
- **Der Ausgang `verpasst` kostet nichts und nennt den Grund.** Vollzählig zurück, keine Verluste,
  keine Abklingzeit, und die Meldung sagt, was passiert ist. Ein stilles `ok` wäre hier die
  Falschaussage, vor der dieses Projekt seine Anzeigestellen schützt.

**Die Vorschau MISST die Schwäche, statt sie zu benennen** – das ist Arbeitsregel 61 in der
Anwendung. Eine Prüfung auf „das Wort Jäger steht da" wäre grün, egal was die Flotte trägt.
`test_nest_ui.js` fährt deshalb ZWEI Läufe mit identischer Fixture bis auf einen Punkt (Jäger dabei
oder nicht) und verlangt eine **andere Aussage**; die Gegenprobe mit fest auf `true` gesetztem
Treffer fällt genau daran.

**Zwei Fallen, beide beim Bauen aufgetreten:**

- **`loadGalaxy` heißt `loadGalaxyState`.** Der erste Entwurf hatte den Namen geraten und ihn hinter
  `typeof loadGalaxy === 'function'` versteckt – der Wächter hätte den Fehler **still** gemacht: Der
  Galaxie-Zustand wäre nach einem Schlag nie nachgezogen worden, und niemand hätte es gemerkt
  (Arbeitsregel 4, verschärft: ein `typeof`-Wächter über einem geratenen Namen ist schlimmer als
  der nackte Aufruf, weil er den Absturz verschluckt, der ihn verraten hätte).
- **Zwei Icons waren nicht im Subset-Font** (`ti-crown`, `ti-arrows-right-left`). `check-icons.js`
  hat sie vor dem Commit gefangen; ersetzt durch vorhandene, statt den Font zu vergrößern.

### Der Fund, der die Auslieferungsreihenfolge festlegt

`FESTUNG_SPAWN_AKTIV` steht im Backend auf **`false`** und wird erst im **Frontend-PR der Phase 1**
umgelegt. Der Grund ist gemessen: Ginge das Backend allein live, entstünde binnen Stunden eine
Festung, deren Blockade die Abbauladung um bis zu 55 % kürzt – während `abbauPlan()` die
ungekürzte Vorschau zeigt und `echt = daten.menge` still den kleineren Serverwert verbucht. Der
Spieler bekäme weniger, als die Vorschau ihm versprach, ohne einen Hinweis worauf. Dazu käme eine
ausdrückliche Falschaussage: Die Galaxie-Nachricht beim Entstehen kündigt die
Protomaterie-Drosselung an, und die kann ohne das Frontend gar nicht wirken.

### Was die Frontend-Phase 1 an der Protomaterie beachten muss (vorab gemessen)

Die Ladungskürzung erledigt der Server allein – `echt = daten.menge`, das Frontend verbucht seine
Zahl. Die **Protomaterie dagegen erreicht der Server nicht**: Sie hängt allein an der GRÖSSE des
Vorkommens und wird an **zwei** Stellen gebildet, die im Gleichschritt bleiben müssen:

- `abbauPlan()` (Z. 55722) – die **Vorschau**, läuft VOR dem Serveraufruf.
- `oeffneAbbaumission()` (Z. 55912) – der **Missionsstart**, friert den Wert in die Mission ein.

Der Kommentar an der zweiten Stelle sagt es selbst: „die Vorschau darf nicht zweite Zahl neben der
echten sein". Genau das ist hier die Falle. **Die Vorschau kann den Faktor nicht aus der
Serverantwort nehmen** – die kommt erst nach dem Start. Sie muss ihn aus dem Felddokument lesen
(`state.asteroidFeld[sys].festung.stufe`) und mit einer **Frontend-Kopie der Stufentabelle**
rechnen; der Missionsstart nimmt dagegen `protoBlockade` aus der Antwort, weil dort der Server
Autorität ist. Zwei Quellen für dieselbe Zahl heißt: **eine Paritätsprüfung ist Pflicht**, genau wie
bei `test_asteroid_paritaet.js` für `AST_SORTEN`. Ohne sie driften Vorschau und Buchung auseinander,
sobald jemand eine Stufe ändert – und der Spieler sieht eine Zahl, die die Mission nicht einhält.

62. **Ein Grenzwert, der gegen einen ÜBERGANGSWERT kalibriert wurde, misst nicht die Sache – und
    er sieht dabei komfortabel aus.** Vorfall 19.08.2026: `test_sprungleiste` fiel im vollen
    Prüflauf mit `{"vorher":0,"nachher":1733,"zielOben":314}` gegen die Schranke „< 300"; einzeln
    lieferte er dreimal hintereinander exakt **182** – bei IDENTISCHER Scroll-Position. Gleiche
    Scrollhöhe, anderes Ziel heißt: Der Inhalt ÜBER dem Ziel wächst nach dem Sprung noch (gemessene
    Zusammensetzung: `.hero` 138, `#resbar` 86, `#tier2ResBadges` 38, `#dailyQuestBar` 28,
    `.tabs` 108, `#planetRoleBox` 252, `#orbitalStationBox` 211 – die fehlenden 146 px passen auf
    die Tagesaufgaben-Leiste, deren Höhe am Inhalt hängt).
    Der Test wartete **1,2 Sekunden fest** und maß damit einen Zwischenstand. Seit er auf die RUHE
    wartet (dieselbe Wartung wie `warteBisRuhe` in `test_reiterleiste`), liefert er **261 px schon
    am Stand VOR der laufenden Etappe** – die scheinbare Reserve von 118 px waren in Wahrheit 39.
    **Die 300 beschrieben einen Zustand, den das Spiel nie einnimmt.**
    **Vorgehen:** (a) Eine Anzeige-Kennzahl wird im FERTIGEN Zustand gemessen, nie nach einem festen
    Schlaf – ein Schlaf misst Wanduhr-Glück; (b) wer dabei feststellt, dass der eingeschwungene Wert
    dauerhaft anders liegt als der Grenzwert vermuten ließ, hat den Grenzwert zu prüfen und nicht
    den Messwert wegzuerklären; (c) der neue Grenzwert wird als REGEL formuliert
    („oberes Bilddrittel", aus der gemessenen Fensterhöhe abgeleitet), nicht als Literal – sonst
    steht in einem halben Jahr dieselbe Frage wieder an. **Und die Lockerung braucht ihren Beleg:**
    Eine sabotierte Kopie ohne `scrollIntoView` muss weiterhin anschlagen (gemessen: `zielOben`
    1915 statt 270). Ohne diesen Beleg ist „Schranke angepasst" nicht von „Test entschärft" zu
    unterscheiden (Regel 26).
    Zwei Beifunde derselben Messung: Die Prüfung kannte die Gegenrichtung nicht – ein Sprung, der
    das Ziel HINTER der klebenden Reiterleiste parkt, sah in der Zahl gut aus (jetzt `2b`). Und die
    laufende Etappe hatte selbst 29 px zu `#planetRoleBox` beigetragen und damit 9 px der Reserve
    gekostet – nicht die Ursache des Fehlschlags, aber gemessen und genannt statt verschwiegen.
    **Der Befund daraus ist am 21.08.2026 nachgemessen und behoben** – siehe den Abschnitt
    „Das Bild bleibt still" weiter unten. Er war größer als hier notiert: Es driftet nicht nur ein
    Sprungziel, sondern die Lesestelle JEDES Spielers, sobald ein Banner über ihm auftaucht oder
    abläuft. **KORREKTUR 22.08.2026 zum zweiten Halbsatz** („87 von 160 Tests pinnen
    `nextPlanetEventCheck` nicht – dieselbe Flanke wartet dort"): Das war eine Hochrechnung, keine
    Messung, und sie ist falsch. Von 42 Fensterlage-Tests fällt gegen eine Kopie mit 90 % Spawn je
    Tick **genau einer**; das Banner steht dort zwar (144 px gemessen), die Tests messen nur nichts,
    was es verschiebt. Und *pinnen* hilft gegen das Banner ohnehin nicht – der Filter zählte die
    falsche Eigenschaft. Einzelheiten im Abschnitt „Der Riegel gegen das Ereignis-Banner".

63. **Die Tab-Hinweisleiste ist 166 px hoch, steht ÜBER dem Tab-Inhalt, und ihr Erscheinen ist ein
    RENNEN gegen die Test-Vorbereitung.** Vorfall 19.08.2026, drei Prüfläufe hintereinander mit je
    einem einzelnen Fehlschlag, jeder einzeln grün: `test_reiterleiste`, dann `test_sprungleiste`,
    dann `test_kartenbedienung` – und beim Nachstellen sprang er auf `test_kartengroesse` über.
    Alle vier melden dasselbe: „Element sitzt tiefer als erwartet" bzw. „Mitte liegt außerhalb des
    Fensters".
    **Der Mechanismus:** `maybeShowTabHint` blendet die Leiste aus, solange ein Overlay steht
    (`tabHintBlocked()`). Jeder Test blendet in seiner Vorbereitung genau diese Overlays aus –
    läuft danach noch ein Haupt-Tick, erscheint die Leiste und schiebt **alles darunter um 166 px**;
    misst der Test vorher, nicht. Gemessen an der Zerlegung des Abstands über dem Kartenkasten:
    `#tabHintBar=166` neben `div.tabs=108`, `#resbar=86`, `div.hero=138`.
    **`test_reiterleiste` macht es seit jeher richtig** und setzt `seenTabHints` für alle zwölf
    Reiter; den drei anderen fehlte es. Seit dem 19.08.2026 setzen sie es ebenfalls.
    **Vorgehen für jeden Test, der FENSTERLAGE misst** (Mitte im Bild, Element nicht verdeckt,
    Sprungziel oben): Die Fixture muss die Möbel abschalten, die nur manchmal da sind –
    `seenTabHints` für alle Reiter, `nextPlanetEventCheck`/`nextTraderCheck` gepinnt. Gemessen sind
    **88 von 147** Tests, die das Spiel mit Spielstand booten und `nextPlanetEventCheck` nicht
    pinnen. **KORREKTUR 22.08.2026:** Der Halbsatz „die Flanke wartet dort weiter" galt für die
    Reiter-Hinweisleiste dieses Vorfalls – für das EREIGNIS-BANNER ist er nachgemessen und falsch
    (41 von 42 Fensterlage-Tests bleiben auch bei 90 % Spawn grün). Und `nextPlanetEventCheck` ist
    für das Banner ohnehin die falsche Größe; siehe „Der Riegel gegen das Ereignis-Banner".
    **Und die Lehre über die Fixture hinaus:** Ein Fehlschlag, der bei jedem Lauf ein anderes Opfer
    sucht, ist kein Wackeln von drei Tests, sondern EIN Zustand, der drei Tests trifft. Wer ihn je
    Test „stabilisiert", baut drei Pflaster über eine Ursache (genau das war hier zweimal passiert).

64. **Ein Grenzwert für eine Scroll-Lage muss die Frage stellen: Kann die Seite überhaupt weiter?**
    Aus demselben Vorfall, und es hat mich zwei Anläufe gekostet. `test_sprungleiste` prüfte
    „zielOben < 300", dann in meiner ersten Korrektur „oberes Bilddrittel". Beide Male war die Zahl
    auf eine zufällige Seitenlänge kalibriert: Die geprüfte Überschrift ist der **letzte** Abschnitt
    der Seite. Wie weit sie nach oben kommt, hängt allein daran, wie viel Seite unter ihr liegt –
    nach dem Abschalten der 166-px-Hinweisleiste war die Seite kürzer, die Seite lief auf ihren
    Anschlag (`scrollY 1225 = maxScroll`), und das Ziel blieb bei 508. Kein Fehler, sondern Physik.
    Geprüft wird deshalb die EIGENSCHAFT (die Überschrift ist vollständig im Bild und nicht hinter
    der klebenden Leiste) plus die Zusatzbedingung „im oberen Drittel, **solange die Seite noch
    scrollen kann**".
    **Zwei Beifunde, beide gemessen:**
    (a) Meine eigene Ruhe-Wartung war zuerst falsch gebaut: Sie beobachtete die **Dokument**-Lage
    des Ziels – und die ändert sich beim Scrollen überhaupt nicht. Die Schleife meldete sofort
    „ruhig", mitten in der weichen Scroll-Animation, und lieferte je nach Zufall 270, 508 oder
    628 px. **Ein Messwerkzeug, das die falsche Größe beobachtet, ist schlimmer als ein fester
    Schlaf – es sieht nach Sorgfalt aus.** Beobachtet werden jetzt Fensterlage UND Scroll-Position.
    (b) Mit korrekter Wartung landete das Ziel bei `zielOben: 0` – also **vollständig hinter der
    klebenden Reiterleiste** (`leisteUnten: 108`). `scrollIntoView({block:'start'})` setzt es exakt
    auf die Fensterkante. Das ist ein echter Bedienfehler derselben Klasse wie KB-10 und seit dem
    19.08.2026 behoben: `body.compact-head [data-acc-key] { scroll-margin-top: 128px; }` – die dafür
    gebaute CSS-Eigenschaft, kein JS, keine zweite Rechnung, und sie wirkt auf jedes künftige
    Sprungziel automatisch. Beide Gegenproben getrennt gefahren und jede fällt spezifisch: ohne
    `scroll-margin` genau `2b`, ohne `scrollIntoView` genau `2`.

70. **Es gibt eine Ereignisquelle, die man GAR NICHT pinnen kann – und die Regel „Ereignis-Uhren
    pinnen" verleitet dazu, das Gegenteil zu glauben.** Vorfall 19.08.2026:
    `test_klappen_kollision` fiel im vollen Lauf an seiner „ohne Ereignis"-Vorabprüfung mit einem
    **152 px hohen Fremd-Banner** bei 360×740, während 390×844 und 360×640 im selben Lauf sauber
    waren; die vier Kollisionsprüfungen derselben Größe blieben grün. Der Kommentar im Test sagte
    ausdrücklich, die zwei gepinnten Uhren (`nextPlanetEventCheck`, `nextTraderCheck`) sorgten
    dafür, dass das Banner „AUSSCHLIESSLICH dann steht, wenn dieser Test es setzt". **Das war
    falsch, und zwar messbar:** Das Banner hängt an `state.activeEvent`, und das setzt
    `maybeSpawnRandomEvent()` – eine Funktion **ohne jede Uhr**, die je Tick mit 0,25 % würfelt.
    `state.lastEventTime` wird zwar geschrieben, aber **nirgends als Sperre gelesen** (der
    Kommentar an der Funktion sagt es selbst: „keine feste Mindestpause mehr"); wer sie pinnt,
    pinnt nichts. Über acht Boots à ~4 s Tickzeit sind das rund 8 % je Testlauf – genau die
    Größenordnung von „meistens grün, gelegentlich rot".
    **Vorgehen:** (a) Wer eine Ereignisquelle stilllegen will, prüft, ob sie überhaupt eine
    Zustandsgröße HAT, an der man drehen kann – ein `grep` nach dem Feld genügt nicht, es muss
    auch GELESEN werden (Regel 59 in der Anwendung auf eine Testvorbereitung); (b) lässt sie sich
    nicht stilllegen, wird die Störung über den **Spielerweg** weggeräumt und das Wegräumen
    **gemeldet** – hier der „Ignorieren"-Knopf des Banners, bis zu drei Anläufe, und
    `streuEreignisWeggeklickt` steht im Beleg jeder Prüfung. Ein Griff in den Modulscope scheidet
    aus, der ist von außen nicht erreichbar (Regel 47), und ein Test, der Spielinternes nachbaut,
    misst nicht mehr das Spiel (Regel 36). (c) Die Schranke selbst bleibt unangetastet – sonst ist
    „Störung entfernt" nicht von „Test entschärft" zu unterscheiden (Regel 26).
    **Gegenprobe in beide Richtungen an einer Kopie mit 0,25 statt 0,0025 je Tick:** alter Stand
    5 rote Prüfungen, neuer Stand 0 – bei identischen 16 Prüfnamen in beiden Läufen (per `diff`
    verglichen, nicht gezählt – Regel 60). Und der Beleg, dass die Behebung wirklich gegriffen hat
    statt zufällig ruhig geblieben zu sein: `streuEreignisWeggeklickt` stand im grünen Lauf auf
    1/2/1, gegen die echte Spieldatei auf 0/0/0.
    **KORREKTUR 22.08.2026 – hier stand „jeder Test, der FENSTERLAGE misst, ist ihr ausgesetzt", und
    das ist nachgemessen falsch.** Gegen eine Kopie mit 90 % Spawn je Tick fällt von 42
    Fensterlage-Tests **genau einer**: dieser hier, und zwar an seiner eigenen Klick-Reparatur. Das
    Banner steht in den anderen sehr wohl (144 px), sie messen nur INNERHALB von Containern oder
    scrollen ihr Ziel vorher in den Blick. Ausgesetzt ist, wer eine ABSOLUTE Fensterlage ohne
    Scrollen misst – hier, weil `.edge-tab` am VIEWPORT hängt. Seit dem 22.08.2026 ist die
    Reparatur durch einen RIEGEL ersetzt (`ruhigeUhren()` setzt ein unsichtbares `activeEvent` und
    trifft damit `if (state.activeEvent) return;` in der ersten Zeile derselben Funktion) – die
    Reparatur war besiegbar, der Riegel nicht. Einzelheiten und beide Gegenproben im Abschnitt
    „Der Riegel gegen das Ereignis-Banner".

71. **Eine Gegenprobe per Env-Umleitung braucht eine Wache, die sagt, WAS fallen muss – sonst ist
    ihr Grün nicht von einem Werkzeugfehler zu unterscheiden.** Vorfall 19.08.2026 (Phase 4,
    Weltlage-Zeile): Drei Gegenproben liefen an sabotierten Kopien der Spieldatei, alle drei
    blieben **grün**, und nach Regel 26 wäre das der Befund gewesen – „der Test belegt nichts".
    Er belegte durchaus etwas; das Mess-Skript hatte nur `env = dict(os.environ, …)` gebaut und
    beim `subprocess.call` **das `env=env` vergessen**. Gelesen wurde also dreimal die echte
    Datei. Das ist wörtlich die Falle aus der Korrektur zu Regel 14 („eine still ignorierte
    Env-Variable sieht aus wie eine bestandene Gegenprobe"), nur eine Ebene höher: nicht die
    Variable wurde ignoriert, sie kam nie an.
    **Vorgehen:** Jede Gegenprobe führt eine Liste der Prüfungen mit, die bei ihr fallen MÜSSEN,
    und meldet ausdrücklich `WERKZEUGFEHLER`, wenn eine davon grün bleibt. Damit ist der
    Unterschied zwischen „die Sabotage greift nicht" und „der Test taugt nichts" wieder sichtbar –
    und man erkennt ihn im Protokoll, nicht erst beim Nachdenken. Gemessen nach der Behebung:
    Sabotage „Zeile immer zeichnen" → genau `2a`, „Zeile nie zeichnen" → `1a/1b/1c/3a` (plus die
    vier abhängigen Nest-Prüfungen), „alter Hilfetext" → `5a/5b`.

## Sektorkarte E1: Landmarken (19.08.2026)

Auftrag Sascha: „entwerfe mehr tiefgründigen Content für die Sektorkarte", danach „okay e 1 weiter".
Konzept mit allen fünf Etappen, sieben begründeten Ablehnungen und den offenen Messfragen:
**`docs/sektorkarte-konzept.md`**. Hier steht nur, was E1 gebaut hat.

**Der Befund, aus dem E1 entstand:** `karteSystemBadges` führte sieben Abzeichen (🏰 🏴‍☠️ 👽 ⚔️ 🌀
🔎 📡) – **kein einziges für eine Asteroidenfestung oder ein Alien-Nest**. Beide lebten
ausschliesslich im aufgeklappten System; `festungFaktoren` hatte genau zwei Aufrufer, beide in der
Abbaurechnung. Wer eine Festung finden wollte, musste jedes der 67 Systeme einzeln durchklicken –
genau der Zustand, gegen den KB-8 gebaut wurde.

**`karteSystemBadges` speist DREI Anzeigestellen, nicht zwei.** Das Konzept nannte die
Regionsübersicht (aggregiert) und die Sektoransicht; gemessen gibt es einen dritten Aufrufer in
`buildGalaxyMap` für die **Nachbarpunkte der offenen Systemebene**. Ein Eintrag dort versorgt alle
drei – und deshalb steht neuer Karteninhalt dort und nicht in den Renderern.

**Drei neue Abzeichen:** 🛡 Festung (Stufenname, Kernstand in Prozent, Blockade), 👾/👑 Nest (Volk,
stärkste Stufe, Schwäche; mehrere im selben System bekommen EIN Abzeichen mit Zahl), 🎯 Gegner
(Name und Stufe). **🎯 und nicht ⚔️** – das Schwerter-Zeichen ist an den Fraktionskrieg vergeben,
zwei Bedeutungen für dasselbe Symbol wären die zweite Anzeigestelle in Reinform.

**Das 👽 schweigt jetzt, wo ein Nest steht.** Der Backend-Kommentar an `nestOrteNachfuehren` sagt
es selbst: Der Server führt den Ort des „Volk entdeckt"-Eintrags auf das **stärkste Nest** nach,
damit ein Frontend ohne Nest-Kenntnis „weiterhin ein sinnvolles Alien-Abzeichen am richtigen Ort"
zeigt. Es war also der Notnagel für genau die Zeit vor E1; mit dem 👾 daneben stünden zwei
Abzeichen für dieselbe Sache am selben Ort. **Gemessen wird das als PAAR** (mit Nest kein 👽, ohne
Nest eines) – jede Hälfte allein wäre auch dann erfüllt, wenn das 👽 ganz verschwunden wäre, und
dann hätte die Entdopplung eine Auskunft gelöscht statt sie zu entdoppeln.

**Ein ausgelieferter Bestandsfehler nebenbei behoben:** `MISSION_LINIEN` führte sechs Missionsarten
– `festung-angriff` fehlte. Der Leser filtert mit `filter(mm => MISSION_LINIEN[mm.type])`, ein
unbekannter Typ verschwindet also **stillschweigend**. Der Nest-Angriff (v8.582.0) hatte beide
Zweige bekommen, der ältere Festungsschlag (v8.569.0) nicht: Man sah seinen Nest-Verband über die
Karte fliegen, seinen Festungsverband nicht. `missionMapZiel` braucht dafür einen eigenen Zweig –
eine Festung ist kein Planet, die generische `PLANETS.find`-Suche fällt ins Leere.

**Vier Dinge, die man beim Anfassen wissen muss:**

- **Die Nester gehören in `karteAuffangSignatur`, aber SCHLANK.** Ohne Anteil stünde ein gefallenes
  Nest bis zum 5-Sekunden-Vollbau weiter auf der Karte; mit `JSON.stringify` der ganzen Liste
  erzwänge die beim Reifen wandernde LP einen Kartenneubau je Tick. Deshalb `id:stufe:lp/1000`.
  `state.asteroidFeld` ist längst drin – die Festung reist damit ohnehin mit.
- **Kein Vorhang vor den Daten.** `ladeAsteroidfeld` ersetzt `state.asteroidFeld` in EINEM Abruf
  durch alle Felder des Servers, `galaxyCache.alienNester` reist vollständig mit. Eine Sperre wäre
  eine, die jede Entwicklerkonsole in fünf Sekunden aufzieht.
- **Zwei geratene Namen hat erst die Prüfung gefangen:** `NEST_KOENIGIN_STUFE` existiert nicht (der
  Bestandscode erkennt die Königin an `stufe >= 5`), und die drei Renderer lesen an einem Abzeichen
  **nur** `icon` und `title` – ein `farbe`-Feld wäre toter Code gewesen. Der Syntax-Check hätte den
  ersten Fall NICHT gefangen: `new Function` parst nur und führt nie aus (Arbeitsregel 4/38).
- **`ti-bug` ist nicht im Subset-Font**, `check-icons.js` hat es vor dem Commit gefangen. Ersetzt
  durch `ti-alien` – das ist im Subset UND wird vom Nest-Kartenmenü bereits benutzt, also dieselbe
  Bildsprache statt einer zweiten daneben.

**Die `sk.desc` wird endlich gerendert.** Sie stand seit jeher in `SEKTOR_DEFS` und war nirgends zu
sehen (`grep -c "Der stille Norden"` lieferte 1, nur die Definition) – siehe die Korrektur im
Abschnitt „Sektor-Eigenschaften". Sie steht jetzt im `<title>` des Regionsknotens, bewusst **nicht**
als vierte Textzeile: Die Zeile darunter trägt schon die Abzeichen, und acht Regionen mit je einem
Satz würden die Übersicht zumüllen.

**Was E1 ausdrücklich NICHT gebaut hat** (steht als E1b im Konzept): die antippbare Abzeichenzeile
mit namentlicher Systemliste, den `npcMapMenu`-Infoblock mit gemessener Gegnerstärke aus
`state.npcIntel`, Kopf/Fuss/Legende der Übersicht und das fehlende `system`-Feld in
`shareIntelWithAlliance`. E1 beantwortet „was steht wo" – „wie stark ist es" ist die nächste Frage.

Wächter: `tests/test_landmarken.js` (19 Prüfungen auf allen drei Kartenebenen, Sichtbarkeit statt
Existenz gemessen). Gegenprobe gegen den Stand vor E1: 13 rot bei identischen Prüfnamen. **Zwei
Prüfungen waren dabei zunächst aus dem falschen Grund grün** – die Kartensuche fiel auf ihren
eigenen Suchbegriff herein (die leere Box antwortet `Keine Treffer für "Sternenfeste".` und
ZITIERT ihn damit), und der Übersichts-Tooltip nannte sein System schon vorher namentlich, weil das
👽 dort stand. Beide sind seither auf eine echte Trefferzeile bzw. auf die neuen Auskünfte gescopt.

## Eine PvE-Auflösung ZIEHT AB (19.08.2026) – der Fehler, der drei Auslieferungen überlebt hat

**Die Schiffe eines Verbandes bleiben während der ganzen Mission in `fleet` gezählt.** Nur der
Flottenplatz ist belegt, und `computeAwayByType()` hält sie als „unterwegs" von einer zweiten
Verplanung zurück. Wer beim Auflösen die ÜBERLEBENDEN wieder addiert, zählt sie deshalb ein zweites
Mal.

Genau das taten **alle drei** PvE-Auflösungen: `anfechtungAufloesen` (seit v8.491.0),
`festungAufloesen` (v8.569.0) und `nestAufloesen` (v8.582.0). Gemessen an einer Fixture mit
20 Kreuzern, 20 davon im Verband, 4 Verlusten: danach standen **36** da. Ein Schlag mit der
Vorauswahl – also der ganzen Kampfflotte – hat den Bestand je Mal nahezu verdoppelt.

**Der Fehler ist durch KOPIEREN gewandert.** Der Festungsschlag hat ihn von der Anfechtung geerbt,
der Nest-Schlag vom Festungsschlag; jede der drei Stellen war für sich plausibel („die Flotte kommt
zurück"). Der NPC-Angriff macht es seit jeher richtig – `applyCombatLosses` ZIEHT AB und gibt nichts
zurück –, aber niemand hat die beiden Wege nebeneinandergelegt.

**Behoben mit EINER Funktion, nicht mit drei Korrekturen** (Hausregel 43):

```js
function pveVerlusteBuchen(fleet, verluste){
  for (const [k, weg] of Object.entries(verluste || {})) if (weg > 0) fleet[k] = Math.max(0, (fleet[k]||0) - weg);
}
```

Alle drei Auflösungen sammeln jetzt `verluste` (statt `zurueck`) und buchen dort. **Die Zweige ohne
Kampf brauchen gar nichts mehr** – Server nicht erreichbar, Nest weitergezogen, Festung schon
gefallen: leeres `verluste`, und die Flotte steht ohnehin vollzählig da. Das ist der eigentliche
Gewinn der Umstellung: Der Fall „kein Kampf" hatte vorher eine eigene Schleife, die man beim
Kopieren mitnehmen musste.

**Drei Dinge, die man beim Anfassen wissen muss:**

- **`pveVerlusteBuchen` darf es nur EINMAL geben.** Eine zweite Kopie kann wieder auseinanderlaufen –
  das war ja der Vorfall. `tests/test_flotte_rueckkehr.js` 1a prüft die Zahl der Definitionen.
- **Der Wächter ist datengetrieben, nicht namensbasiert** (Regel 40): Er liest JEDE Funktion der
  Form `…Aufloesen(m, planetKey, fleet)` aus der Spieldatei, verlangt die Delegation an den Helfer
  und verbietet jede Zuweisung auf `fleet[...]`, die einen Plus-Term enthält. Eine vierte PvE-
  Missionsart fällt damit auf, ohne dass jemand an sie gedacht haben muss. Gegenprobe gegen den
  Stand vor der Behebung: Er benennt `anfechtungAufloesen` und `festungAufloesen` samt der Zeile.
- **`mining-recall` addiert legitim** und ist deshalb keine Auflösung im Sinne des Wächters: Die
  Eskorte wurde beim Stationieren wirklich aus `fleet` herausgerechnet, sie muss zurückkommen. Wer
  eine neue Missionsart baut, entscheidet also zuerst: Verlassen die Schiffe `fleet` beim Start?
  Wenn nein (der Normalfall), gilt diese Regel.

Wächter: `tests/test_flotte_rueckkehr.js` (11 Prüfungen, drei Gegenproben – sabotierte Kopie, Stand
vor der Behebung, und die ausgeführte Wirkung des Helfers) sowie `test_geteiltes_asteroidfeld` 8e/8e2
(Ende zu Ende an der Anfechtung, gemessen 16 statt 36). Der Test, der den Fehler bis dahin als REGEL
festgehalten hat, steht als Arbeitsregel 68.

## Die Klappen weichen der Reiterleiste aus (18.08.2026)

**Der Fund kam aus einem Fehlschlag, den zwei Sitzungen vorher als Wackeln abgehakt hatten.**
`test_reiterleiste.js` fiel im vollen Prüflauf und war einzeln grün – auf 390x844 mit
`["galaxie","fortschritt"]`, auf 360x740 mit `["basis","karte","galaxie","fortschritt"]`. Die
naheliegende Erklärung („unter Suite-Last zu früh gemessen") war schon zweimal angenommen und
hatte je eine Verstärkung der Wartelogik nach sich gezogen. Sie ist **gemessen falsch**: zwölf
Läufe, sechs davon unter vier CPU-Lasterzeugern, 0 Fehlschläge.

**Der Mechanismus, deterministisch reproduziert:** `.edge-tab` hängt am VIEWPORT (am Handy
`bottom:8%`), `.tabs` am INHALT darüber. Wird `#eventBanner` sichtbar – ein Zufallsereignis, 138
bis 164 px hoch –, rutscht die Leiste in das feste Band der Klappen. Weil die Klappen `z-index:50`
tragen und die Leiste `25`, ist der Reiter darunter nicht bloß verdeckt, sondern **nicht
antippbar**. Gemessen am Stand davor, mit `state.activeEvent` im Spielstand:

| Größe | Leiste | Klappen | verdeckt |
|---|---|---|---|
| 390x844 | 600..717 | 685..776 | `galaxie`, `fortschritt` |
| 360x740 | 570..687 | 589..681 | `basis`, `karte`, `galaxie`, `fortschritt` |
| 360x640 | 570..687 | 497..589 | `basis`, `karte` |

Die ersten beiden Zeilen sind **zeichengleich** mit dem, was der Prüflauf gemeldet hatte. Damit war
der Fehlschlag reproduziert statt weiter als Zufall verbucht – vier von zwölf Reitern tot, darunter
der, auf dem der Spieler startet.

**Behoben durch Ausweichen, nicht durch eine dritte Zahl.** Zwei frühere Behebungen (`top:64%` →
`bottom:8%`) haben je eine Bildschirmgröße freigeräumt und eine andere zugestellt; ein dritter
fester Prozentwert hätte dasselbe getan, denn es gibt keinen richtigen: Die Leiste kann jede Höhe
annehmen, die der Inhalt über ihr hergibt. `klappenFrei()` ist deshalb **die EINE Quelle für beide
Klappen** (Vorbild `kbMarkerFrei`, Regel 52): Es misst die Leiste, weicht bevorzugt nach unten aus,
sonst nach oben, und lässt die Klappe stehen, wenn nirgends Platz ist – eine überlappende Klappe ist
ehrlicher als eine, die halb aus dem Bild hängt (dieselbe Abwägung wie beim Label-Deckel von KB-16).

**Drei Dinge, die man beim Anfassen wissen muss:**

- **Der Aufruf steht HINTER dem `#eventBanner`-Block in `render()`, nicht am Kopf.** Am Anfang des
  Takts gemessen kennt `klappenFrei` die Bannerhöhe dieses Takts noch nicht und wiche erst eine
  Sekunde später aus – für den Spieler eine Sekunde lang tote Reiter, für einen Test ein Rennen.
  Genau dieser Reihenfolgefehler war der erste Anlauf, und er fiel nur an der wiederholten Messung
  auf (Regel 48).
- **Die natürliche Lage wird GEMESSEN, nicht aus `8%` nachgerechnet.** Ein nachgerechneter Wert
  wäre eine zweite Wahrheit neben dem CSS und liefe beim nächsten Media-Query-Umbau auseinander.
- **Die Gegenrichtung gehört dazu:** Am PC (>700 px) wird ein gesetzter Versatz ausdrücklich
  zurückgenommen, sonst bliebe dort eine Verschiebung stehen, die niemand erklären könnte.

**Und die Lehre über den Einzelfall hinaus – sie ist die eigentliche:** Ein Test, der „gelegentlich
fällt", meldet unter Umständen einen ECHTEN Befund, den man nur nicht deterministisch stellen kann.
Wer die Wartelogik verstärkt, bis er grün ist, hat das Signal weggedämpft, nicht die Ursache
behoben – das ist Regel 26, angewandt auf eine wiederkehrende Flanke statt auf eine Gegenprobe.
Richtig ist, den auslösenden Zustand zu SUCHEN (hier: was steht über der Leiste, das nur manchmal da
ist?) und ihn dann deterministisch zu stellen. Wächter: `tests/test_klappen_kollision.js`
(16 Prüfungen, drei Bildschirmgrößen × mit/ohne Ereignis, dazu `elementFromPoint` auf die
ausgewichenen Klappen selbst – Regel 53: wer etwas verschiebt, misst die neue Stelle mit – und die
PC-Gegenrichtung). Beidseitig gegengeprüft: am Stand davor fallen genau die drei „mit
Ereignis"-Prüfungen, bei identischer Prüfungszahl.
`test_reiterleiste.js` pinnt seither seine Ereignis-Uhren (Regel 18) und misst wieder nur seinen
eigenen Gegenstand; der Bannerfall hat jetzt seinen eigenen, deterministischen Wächter.

## Sektor-Eigenschaften (Etappe 3, 18.08.2026)

Die acht Regionen der Karte trugen bis dahin nur `cx/cy/tint/desc`. `sektorVon` wurde
**ausschließlich zum Zeichnen** benutzt – der Sektor eines Planeten hatte auf nichts im Spiel eine
Auswirkung. Ihre Beschreibungen versprachen aber seit jeher welche („ergiebige Gürtelbahnen",
„reich an Anomalien", „voller Passagen").

**Der Befund, der die Etappe geprägt hat, ist die Gegenrichtung zu Regel 59:** Dort existiert eine
Zahl nur im Ankündigungstext und wird beim `grep` fälschlich für vorhanden gehalten. Hier existierte
die Ankündigung, aber **die `desc` wurde nirgends gerendert** – gemessen, nachdem ich selbst zuvor
behauptet hatte, sie erscheine auf der Übersichts-Tafel (der Kommentar über `SEKTOR_DEFS` sagte das
sogar wörtlich, und er war falsch). Ein Versprechen, das nur im Quelltext steht, ist für den Spieler
weder ein Versprechen noch ein Bruch – es ist gar nichts. **Deshalb gehörte zu dieser Etappe die
Anzeigestelle genauso zwingend wie die Mechanik.**

**Vier Regeln, nach denen die Belegung entstanden ist** (sie stehen als Kommentar über
`SEKTOR_DEFS`, hier nur die Kurzform):

1. **Nur Boni, keine Mali.** Die Wirkung greift rückwirkend für jede bestehende Kolonie; wer vorher
   dort gesiedelt hat, darf dafür nicht bestraft werden. Der **Kepler-Kern bleibt neutral** – wo
   jeder anfängt, soll nichts locken und nichts abschrecken.
2. **Jede Wirkung löst den Text ein, der schon dastand**, und jede Beschreibung nennt jetzt ihre
   Zahl (`test_sektoreigenschaften` 1d prüft die REGEL, nicht die Formulierung).
3. **Nur Kanäle, die der Server NICHT nachrechnet** – Produktion, Expeditions-Ausbeute,
   Abgrundsplitter, Flugzeit (für Flugzeit gemessen: 0 Treffer in `server.js`). Angriff und
   Verteidigung sind bewusst außen vor: Sie entscheiden PvP, und eine Sektor-Tabelle im Backend wäre
   eine zweite Kopie, die auseinanderlaufen kann. **Das ist dieselbe Wahl wie bei den drei neuen
   Doktrinen (Etappe 2) und aus demselben Grund** – ein hängender Backend-Deploy kann so keine
   Abweichung erzeugen.
4. **Additiv in die jeweils vorhandene, gedeckelte Gruppe**, nie eine eigene Multiplikation. Die
   Flugzeit ist die Ausnahme und dort schon die Hausform (`allianceBaseFlightMult`).

Belegung: `wispern` +8 % Produktion · `solmark` +12 % Expeditionen · `obsidian` +12 % Produktion ·
`meridian` −10 % Flugzeit · `pulsar` +10 % Expeditionen · `ilyra` −12 % Flugzeit · `rand` +15 %
Splitter · `kepler` neutral.

**Die vier Rechenstellen** (`sektorBonus` ist Summand, `sektorFlugMult` Faktor):
`ratesPerSecond` (nur der ROHSTOFF-Zweig – der Laborzweig bleibt frei, weil „ergiebige
Gürtelbahnen" eine Aussage über Rohstoffe ist, nicht über Laborarbeit), die additive
Expeditions-Gruppe, `abgrundSplitterFaktor` und `missionDurationFor` direkt neben
`allianceBaseFlightMult`.

**Woran was hängt** – das ist die Frage, die ein Spieler stellt, und sie steht deshalb im
Hilfetext: Produktion und Splitter am **Standort**, Expedition am **Startpunkt**, Flugzeit am
**Ziel**. Ein Mond zählt zum Sektor seines Planeten (`sektorVonPlanet` löst `moon_<planet>` über
`moonParentKey` auf; ohne diesen Zwischenschritt bekäme JEDER Mond des Spiels den Bonus 0).
`_sektorCache` ist eine dauerhafte `Map` – die Zuordnung Planet→Sektor ändert sich zur Laufzeit nie.

**VIER Anzeigestellen**, alle aus `sektorEffektKurz()`/`sektorEffektLang()` – EINE Quelle für Karte,
Tooltip, Hilfe und Standort-Zeile: (a) eigene Textzeile am Regionsknoten der Übersicht plus
`<title>`/`aria-label` mit der Langform; (b) eine dritte Kopfzeile in der Sektoransicht; (c) der
Hilfe-Eintrag „Sektoren haben Eigenschaften", **aus `SEKTOR_DEFS` abgeleitet** (Reihenfolge vorher
gemessen, nicht geschätzt – `SEKTOR_DEFS` steht weit vor `HELP_SECTIONS`, Regel 38); (d) eine Zeile
am AKTUELLEN Standort im Basis-Reiter, **bewusst auch im Mond-Zweig** von `planetRoleBox` – ein Mond
bekommt den Bonus wirklich, und eine Zeile, die dort schweigt, wäre die klassische zweite
Anzeigestelle (Punkt 6).

**KORREKTUR 19.08.2026 – hier standen FÜNF, und die fünfte gibt es nicht.** Aufgeführt war „die
Beschreibung jedes Sektors" (`SEKTOR_DEFS[].desc`). Gemessen: `grep -c "Der stille Norden"` und
`grep -c "alte Handelspfade"` liefern je **1** – nur die Definition selbst. Kein Leser von
`SEKTOR_DEFS` benutzt `desc`; die acht ausformulierten Regionstexte liegen ungenutzt in der Datei,
und der Kommentar über der Tabelle behauptet weiterhin „desc erscheint auf der Übersichts-Tafel".
**Das ist bitter, weil der Abschnitt direkt darüber genau diesen Befund beschreibt** – die Etappe
entstand ja daraus, dass die `desc` nichts einlöste. Die TEXTE wurden damals aktualisiert (jede
nennt jetzt ihre Zahl), die ANZEIGESTELLE wurde nie gebaut, und die Liste hat sie trotzdem
mitgezählt. Ein Versprechen, das nur im Quelltext steht, ist für den Spieler gar nichts – und eine
Dokumentation, die eine nicht existierende Anzeigestelle führt, ist die zweite Stufe desselben
Fehlers.
**Übertragbar:** Wer eine Liste von Anzeigestellen aufschreibt, misst jede einzeln nach (`grep`
nach einer Zeichenkette, die NUR dort vorkommen kann) – „ich habe es gerade gebaut" ist kein Beleg
dafür, dass es gerendert wird. Die `desc` endlich zu zeigen steht als Teil von E1 in
`docs/sektorkarte-konzept.md`.

**`SEKTOR_KANAL_TEXT` ist der Angelpunkt für alles Künftige.** Wer einen neuen Kanal in `mod`
einträgt, ergänzt ihn dort – sonst zeigt die Karte den Bonus nicht an. `test_sektoreigenschaften`
1a/1e prüfen beides **datengetrieben**: Jeder benutzte Kanal braucht einen Anzeigetext UND eine
Rechenstelle; 1e2 prüft die Gegenrichtung (ein Aufruf für einen Kanal, den keine Tabelle mehr führt,
liest dauerhaft 0 und sieht im Quelltext trotzdem nach Wirkung aus). Wächter:
`tests/test_sektoreigenschaften.js` (28 Prüfungen – Tabelle, Verdrahtung, ausgeführte Helfer,
gerendertes Spiel und eine gemessene Produktionswirkung von +12 % über zwei Läufe mit
unterschiedlichem Heimatsystem).

**Ein Werkzeugfehler bei der Gegenprobe, und er ist die Wiederholung eines dokumentierten:**
`test_abgrundbezug` hatte den Pfad zur Spieldatei FEST verdrahtet (`path.join(__dirname, '..',
'weltraum_kolonie.html')`). Die Gegenprobe mit `KEPLER_SPIELDATEI=/tmp/alt.html` las damit die echte
Datei und meldete 84 von 84 grün – also scheinbar „die neue Prüfung belegt nichts", während sie in
Wahrheit nie am alten Stand gelaufen war. Genau die Falle aus „Korrektur 15.08.2026". Behoben, indem
der Pfad aus `tests/lib/umgebung` kommt; danach fällt am alten Stand exakt die eine neue Prüfung,
bei identischer Prüfungszahl. **Wer eine Gegenprobe per Env-Umleitung fährt, prüft am Messergebnis,
dass sie gegriffen hat** – „alles grün" ist hier kein Ergebnis, sondern ein Verdacht.

## Baustellen-Konto (Etappe B4, 19.08.2026)

Der Ausweg aus der **Lagerwand**. Gemessen: Die Kosten der einzigen unbegrenzt wiederholbaren
Inhalte wachsen exponentiell (Ewigkeitsforschungen, `costMult` 1,32–1,38 je Stufe), der Lagerdeckel
nicht. Gegen den gemessenen Endausbau-Deckel (803.800 — 11 Standorte, Lagerkomplex 45, Kryolager 15,
500 Frachter) steht die Wand bei Stufe **15 bis 18 von 999**. Weil `SOFT_CAP_OVERFLOW_RATE` 0 ist,
lässt sich der Betrag auch nicht ansparen: Der Posten ist dann nicht teuer, sondern unbezahlbar.
Bitter dabei — `rewig_lager`, die Forschung, die den Deckel anhebt, läuft als erste hinein.

**Die Antwort:** ein zweckgebundenes Konto je Posten. Ein wählbarer Anteil (0/25/50/75 %) der
laufenden Produktion fließt nicht ins Lager, sondern direkt auf dieses Konto — der Betrag muss also
nie gleichzeitig im Lager liegen. Kein Deckel wird angefasst, keine Kostenformel geändert. Der
Posten wird **nicht billiger, nur bezahlbar**; die Wartezeit bleibt dieselbe.

Konzept, Messungen und die verworfenen Alternativen: `docs/baustellen-konto-konzept.md`
(Abschnitt 7 listet, was beim Umsetzen anders entschieden wurde als dort).

**Der Umfang ist bewusst die FORSCHUNGS-Warteschlange, nicht alle drei.** Dort beißt die Wand, und
die Erkundung hat **fünfzehn** Stellen gezählt, an denen Warteschlangen geleert oder gekürzt werden
— jede weitere Schlange vervielfacht die Zahl der Stellen, an denen ein Konto verwaisen kann.

**Fünf Dinge, die man beim Anfassen wissen muss:**

- **`baustelleRestKosten(kosten, schluessel)` ist DIE eine Stelle, an der das Konto verrechnet
  wird.** Fünf Stellen brauchen die Zahl: `startResearch`, `tryStartQueuedResearch`, die
  Warteschlangen-Box und **beide** Forschungskarten. Beim ersten Anlauf hatten die zwei Karten die
  volle Summe behalten — der Erforschen-Knopf blieb grau, obwohl das Konto den Posten längst
  gedeckt hatte. Genau der Fehler, gegen den diese Etappe geschrieben ist, in der eigenen
  Lieferung (Punkt 6 der Checkliste).
- **Der Abzweig steht in `applySoftCappedGain` VOR der Deckel-Entscheidung.** Dahinter wäre er
  wirkungslos: Genau im Zustand „Lager voll" ist der Zuwachs dann schon verworfen — und das ist der
  Zustand, in dem das Konto gebraucht wird. `test_baustellenkonto` 1b prüft die REIHENFOLGE im
  Funktionsrumpf, nicht die bloße Anwesenheit.
- **Aufgeräumt wird per ABGLEICH im Takt (`baustelleAufraeumen`), nicht an den fünfzehn
  Entfernungsstellen.** Eine davon zu vergessen — oder die nächste, die jemand später dazubaut —
  ist nach Lage der Dinge der Normalfall. Dieselbe Antwort wie bei `astFreiePlaetze` im Backend:
  eine Quelle statt vieler Aufrufer, die alle daran denken müssen.
- **Einzahlender Posten ist NICHT der Kopf der Schlange, sondern der erste Eintrag ÜBER dem
  Lagerdeckel** (`baustelleZiel`, 900-ms-Zwischenspeicher wie `storageCapCached`). Der Kopf ist im
  Normalfall bezahlbar; ein Konto darauf wäre wirkungslos, und der Spieler müsste umsortieren, um
  überhaupt sparen zu können.
- **Tier-2-Material sammelt das Konto nicht.** Es hängt an der Produktion der sechs
  Grundressourcen, und `forschungUeberLager` prüft auch nur die (Tier 2 hat einen eigenen, kleinen
  Deckel). Die Wand ist eine T1-Wand. Wer das übersieht, baut einen Test, der aus dem falschen
  Grund rot ist — genau so beim ersten Anlauf von Abschnitt 3 passiert (es fehlte nicht das Konto,
  sondern der Nanolegierungs-Bestand).

**Die Rückfrage vor dem Entfernen ist keine Höflichkeit, sondern die Folge einer Messung.** Die
Rückgabe läuft über `gainResources` und klemmt damit am Lagerdeckel — und ein Konto ist kurz vor
dem Ziel *zwangsläufig* größer als der Deckel, denn genau dafür existiert es. Ohne Rückfrage kostet
ein Fehlgriff auf das kleine ✕ tagelanges Ansparen, und die Erklärung dafür stünde nur im
Protokoll, also nach der Tat. Der Dialog nennt beide Zahlen (was zurückpasst, was verloren ginge) —
dieselbe Abwägung wie beim Forschungsabbruch daneben, der seine 50-%-Erstattung ebenfalls vorher
ansagt. Aufgefallen ist das erst beim TESTEN: Der Versuch, den Kartenpfad zu messen, lief auf einen
leeren Spielstand, weil `baustelleAufraeumen` das Konto sofort auflöst, sobald der Posten die
Schlange verlässt.

**Über Prestige und Aufstieg wandert der ANTEIL mit, nicht das Guthaben.** Das Guthaben hängt an
einer Forschungsstufe, und die ist nach dem Reset weg — es zu bewahren wäre Guthaben ohne Posten.
Der Anteil ist eine Einstellung, und eine still zurückgedrehte Einstellung ist genau die Sorte
Änderung, die ein Spieler zu Recht meldet. Gefährlich ist er dort nicht: Liegt kein Posten über dem
Deckel, liefert `baustelleZiel()` null und es wird nichts abgezweigt (`test_baustellenkonto` 4).

**Kein Eintrag in den Backend-`SAVE_SANITY_LIMITS`, und das ist eine bewusste Nicht-Änderung.** Die
Prüfung dort ist eine Positivliste über wenige Felder; das Konto steht nicht darin und löst deshalb
keine Ablehnung aus. Ein Limit hätte nur gegen einen gefälschten Spielstand genützt — und der ist
bauartbedingt ohnehin möglich (die verteidigte Grenze ist „kann ich etwas anfassen, das ANDEREN
gehört?"). Dagegen hätte ein zu enges Limit einen echten Spieler vom Speichern ausgesperrt, und das
ist der teurere Fehler (dieselbe Begründung wie bei `maxShipMark`).

Wächter: `tests/test_baustellenkonto.js` (32 Prüfungen — Quelltext-Verdrahtung, gemessene Wirkung,
gerendertes Spiel, fünf Gegenproben).

**Drei Lehren aus dem Bau dieses Tests, jede über den Einzelfall hinaus** — sie stehen weiter oben
als Arbeitsregeln 65–67.

## Die Weltlage: die galaktische Gegnerstärke wird sichtbar (Phase 4, 19.08.2026)

Das Backend (kolonie-kepler7-backend#145) hat `npcEmpireStrength` beweglich gemacht: kein
Zeitzähler mehr, sondern ein **Tauziehen gegen den Nestbestand**. Der Server leitet aus den
Alien-Nestern einen Zielwert ab und lässt die Wehrkraft mit 4 % je Tick dorthin laufen.

**Ein Schwierigkeitsregler, den der Spieler bewegt, aber nicht sieht, ist kein Spielelement** –
deshalb gehört die Anzeige zu dieser Phase und nicht in ein späteres „Feinschliff". Die Zeile steht
oben im Galaxie-Tab (`renderGalaxyNews`, neben dem Kopfgeld-Banner) und sagt drei Dinge: wo die
Wehrkraft steht, wohin sie läuft, und **warum** (Zahl der Nester).

**Drei Zustände, und der dritte ist SCHWEIGEN.** Das Backend schreibt `npcStaerkeZiel` nur im
Tor-Zweig – ein Server vor Phase 4 und der Solo-Betrieb führen das Feld gar nicht. Dann entfällt die
Zeile **ersatzlos**. Ein „unbekannt" wäre hier die Falschaussage: Der Spieler könnte daraus nichts
ableiten, und es sähe aus wie eine kaputte Anzeige. Das ist Regel 35 in ihrer Gegenrichtung – dort
braucht eine wartende Box einen dritten Zustand, hier braucht eine Box, für die es nichts zu sagen
gibt, gar keinen.

**Die Schwelle für „steht" ist die Auflösung der Anzeige selbst** (0,01): Darunter stünden im Text
zwei gleiche Zahlen, und eine Richtung zu behaupten wäre Rauschen statt Aussage.

**Vielfache schreibt dieses Spiel als SUFFIX** (`1,77x`, wie „gedeckelt bei 2,5x" im Hilfetext) –
der erste Entwurf hatte `x1,77` und damit eine zweite Schreibweise für dieselbe Größe. Aufgefallen
erst am gerenderten Text, nicht am Code.

**Zwei Hilfetexte sagten seit Phase 3/4 die Unwahrheit** und sind mitgezogen worden (Punkt 6 der
Checkliste): „NPC-Reiche wachsen" behauptete, der Multiplikator „steigt langsam über die Zeit" –
er kann jetzt auch **fallen**; und der Abschnitt daneben nannte die Alienvölker „reine
Weltgeschichte … kein direkter Gameplay-Effekt außer der Anzeige selbst", während sie seit Phase 3
angreifbare Nester anlegen und seit Phase 4 die Wehrkraft steuern.

**Die Zahlen stehen bewusst NICHT im Frontend.** Basis, Steigung und Deckel kennt nur der Server;
die Zeile zeigt, was er schickt. Eine Frontend-Kopie wäre eine zweite Wahrheit, die beim nächsten
Balance-Schritt auseinanderläuft – dieselbe Entscheidung wie bei den Kosmetik-Bedingungen.

Wächter: `tests/test_weltlage.js` (12 Prüfungen am gerenderten Spiel, drei Gegenproben). Er misst
die WIRKUNG statt der Beschriftung (Regel 61): Zwei Läufe mit unterschiedlichem Ist-Wert müssen
unterschiedliche **Zahlen** zeigen; eine Prüfung auf „das Wort Wehrkraft steht da" wäre in beiden
Fällen grün. Und die wichtigste Prüfung ist `2a` – ohne das Feld darf **nichts** dastehen.

## Der Verband kann ein Alien-Nest angreifen (Phase 5, Frontend, 21.08.2026)

Das Backend (kolonie-kepler7-backend#149) hat dem Musterangriff eine `zielArt` gegeben. Diese
Hälfte macht sie bedienbar — und zieht die Anzeigestellen nach, die sonst still falsch würden.

**`musterZielText(doc)` ist die EINE Quelle für die Zielbezeichnung.** Vier Stellen lasen vorher
`doc.targetTag` roh: Ergebniszeile, Sammelphase, „Verband unterwegs" und die Allianz-Nachricht. Bei
einem Nest ist der Wert `null` — dort stünde also viermal **„[null]"**. Das ist Punkt 6 der
Checkliste in Reinform: Nicht die Mechanik geht kaputt, sondern die zweite Anzeigestelle. Auch die
Überschrift der Box heißt nicht mehr „Koordinierter Allianzbasis-Angriff", sondern „Koordinierter
Angriff", und der Hilfe-Eintrag ebenso.

**Die Zielart-Wahl erscheint NUR, wenn es Nester gibt.** Ein Server vor Phase 3/5 führt
`alienNester` gar nicht; eine Auswahl mit leerem Zweig wäre ein Versprechen ohne Gegenstand. Ohne
Nester sieht der Spieler exakt das Formular von vorher — derselbe dritte Zustand wie bei der
Weltlage-Zeile.

**Beide Auswahlfelder tragen `data-keep-value`.** Die Box wird im Sekundentakt per `innerHTML` neu
geschrieben, und ein `<select>` ohne Merker springt dabei auf die erste Option zurück — beim
Allianz-Raid hat genau das einmal still die falsche Dauer gestartet. Der aktuelle Wert wird aus
demselben Merker GELESEN, weil davon abhängt, welches Eingabefeld überhaupt gezeigt wird.

**Der claim-Zweig für ein Nest fasst die Währungsfelder nicht an.** Der Server zahlt dort bewusst
keine Basisangriffs-Währung (die Bergung liegt anteilig im Belohnungsfach) und schickt
`newCredits`/`newForschungspunkte` deshalb gar nicht erst mit den üblichen Werten — wer sie
übernähme, schriebe `undefined` in den Spielstand. Der Bericht bekam denselben Zweig: „DAS NEST
WURDE ZERSTÖRT", und bei einem verpassten Anflug den GRUND statt eines stillen „abgewehrt".

Wächter: `tests/test_muster_nest_ui.js` (14 Prüfungen, zwei Gegenproben — `musterZielText` durch
`doc.targetTag` ersetzt → `1d`/`2a` fallen; die Wahl bedingungslos gezeichnet → `3a` fällt).

**Zwei Prüfungen waren dabei zunächst aus dem falschen Grund grün, und beide Male hat es die
eigene Vorab-Prüfung gemeldet** (Regel 28/37): Erst rendert die Box gar nichts, weil
`renderAllianceMusterBox` ohne `state.allianceBase` sofort aussteigt — `3a` („keine Zielart-Wahl")
war damit trivial erfüllt. Und `4b` suchte „Königin" im ganzen Box-Markup, wo es auch im
Einleitungstext steht; gescopt auf das Auswahlfeld und über den **Spielerweg** gewählt (Auswahl
setzen, `change` auslösen) misst es die Liste wirklich.

## Zwei PvE-Meilensteine, zwei Sammlungen, ein Vorbote (Phase 6, Frontend, 21.08.2026)

Die letzte Phase der Asteroidenfestungen/Alien-Nester. Gebaut wurde wenig; **gefunden wurde viel**,
und das ist der eigentliche Inhalt dieses Abschnitts.

**Gebaut:** die zwei `KOSMETIK_LOOK`-Einträge zu `em_festungsbrecher`/`em_schwarmbrecher`, die zwei
`kosmetikBedingungText`-Zweige (`festungen`/`koeniginnen`), zwei Kompendium-Kategorien
(Asteroidenfestungen, Alien-Völker), ein Vorbote auf Stufe 13, und `state.festungTypen`/
`state.nestVoelker` in **beiden** Reset-Bewahrlisten. Die Zähler der EMBLEME liegen serverseitig
(`user.pveKills`), die Kompendium-Sammlungen im Spielstand – der Unterschied ist Absicht: Ein
Emblem steht in der Bestenliste, also auf einer Fläche, die allen gehört; eine Sammlung ist
persönlich.

**Eingeordnet statt behauptet** (die Prüfung hat die Frage gestellt, die Messung hat sie
beantwortet): `festungen`/`koeniginnen` liegen mit `kauf` und `abgewehrt` am **Nutzerobjekt** –
der stärksten Verankerung, die `kosmetikBedingungErfuellt` kennt. **Sechs** bestehende Bedingungen
(`prestige`, `aufstieg`, `kampfpunkte`, `abgrund`, `erfolge`, `bosse`) lesen dagegen direkt aus dem
klientenautoritativen Spielstand. Dass die zugrundeliegende Flottenkraft aus dem Spielstand kommt,
ist die dokumentierte Projektgrenze und kein neues Loch – die zwei neuen Wege sind besser verankert
als sechs vorhandene.

### Die sechs Funde – drei beim Lesen des eigenen Diffs, drei aus der adversarischen Prüfung

**1. Zwei erfundene Begründungen in Kommentaren.** Beide behaupteten, `FESTUNG_STUFEN` sei „ein
Array mit führendem null". Gemessen: ein Objekt mit drei benannten Schlüsseln, `ALIEN_VOELKER`
eines mit vier. Dieselbe Familie wie die erfundene Wander-Begründung aus Phase 4 – ein Kommentar,
der beim nächsten Lesen als REGEL gelesen wird.

**2. Zwei Namensräume für dieselbe Sammlung.** `state.festungTypen` sammelte den ANZEIGENAMEN
(`r.stufeName`), `total()` zählte die SCHLÜSSEL – während `nestVoelker` daneben schon richtig
`r.volk` benutzte. Die Zahl stimmte zufällig (drei zu drei); eine spätere Umbenennung hätte `have`
über `total` steigen lassen. Beide sammeln jetzt Schlüssel.

**3. Der Kompendium-Hilfetext log seit v8.343.0 – und ein Test nagelte die Lüge fest.** Er sagte
„in **acht** Kategorien" und zählte acht namentlich auf; `COMPENDIUM_CATS` führt **13**.
`test_kompendium.js` prüfte wörtlich `/… in acht Kategorien/` – wer den Text hätte richtigstellen
wollen, wäre von genau dieser Prüfung zurückgepfiffen worden. Das ist **Arbeitsregel 68** in
Reinform, und der Text hat den Fehler durch drei Auslieferungen getragen (Reliquien/Konstellationen
→ 10, Unikate → 11, Phase 6 → 13).
Behoben nicht mit einer korrigierten Ziffer, sondern **gerechnet**: `'+COMPENDIUM_CATS.length+'`
und die Namen aus `COMPENDIUM_CATS.map(...)`. Reihenfolge vorher gemessen, nicht geschätzt
(Regel 38): `COMPENDIUM_CATS` steht bei Zeichen 2.441.037, `HELP_SECTIONS` bei 3.985.418 – die
Ableitung im Array-Literal ist gedeckt. Der Ausdruck steht zusätzlich in der `gerechnet`-Liste von
`test_zaehlangaben.js`, damit die Ziffer nicht zurückkehrt.

**4. Eine DRITTE Anzeigestelle, und die älteste.** Über `#compendiumBox` steht eine statische
Einleitungszeile im Markup – sie zählte die **ursprünglichen fünf** Kategorien auf und hinkt damit
seit v8.298 hinterher. Gefunden nicht im Quelltext, sondern am **gerenderten** Spiel (Regel 42).
Statisches Markup kann nicht aus der Tabelle ableiten; sie zählt deshalb gar nicht mehr auf. Die
Beschreibung jeder Kategorie steht ohnehin in ihrer eigenen Zeile – der Renderer gibt `cat.name`
UND `cat.desc` aus.

**5. Der Vorbote auf Stufe 12 hätte den Abgrund-Hinweis gelöscht.** Auf Stufe 12 feuert in `addXp()`
der fest verdrahtete Abgrund-Vorbote, und `maybeShowVorbote()` läuft im SELBEN synchronen Block
unmittelbar danach. **`#log` hat keinen Stapel** (Nachtrag zu Regel 47): Die zuerst geschriebene
Erklärung wäre weg, bevor sie jemand liest – und `state.abgrundVorbote` stünde trotzdem auf `true`,
der Hinweis käme also **nie wieder**. Der Festungs-Vorbote liegt deshalb auf **13**.
Bezeichnend: Der Kopfkommentar der Tabelle kannte die Regel längst („je Levelaufstieg höchstens
EINER – sonst schlagen zwei Toasts gleichzeitig auf und beide gehen unter"), aber nur für zwei
VORBOTEN untereinander, nicht gegen die fest verdrahteten Hinweise daneben. Er sagt das jetzt.

**6. Ein ausgelieferter DATENVERLUST, älter als Phase 6.** `claimPendingRewards()` hat kein
abschließendes `save()`; jeder Zweig speichert selbst. Von den acht riefen **genau zwei** keines –
`festung` (seit v8.569.0) und `alien-nest` (seit v8.582.0). Warum das Verlust ist und nicht
Schlamperei: `POST /api/pending-rewards/claim` macht serverseitig `list.shift()` **und** `saveDb()`.
Die Belohnung ist in dem Moment, in dem der Client sie hält, aus der Warteschlange verschwunden –
es gibt keinen zweiten Versuch. Wer den Reiter schließt, bevor ein anderes Ereignis speichert,
verliert Hort, Protomaterie, Kampfpunkte, Erfahrung und Kredite endgültig. Und
`claimPendingRewards()` läuft **beim Start des Spiels** – genau dann, wenn jemand kurz reinsieht.

**7. Die Einleitungszeile der Kosmetik-Box zählte die Freischaltwege auf** („Prestige, Aufstieg,
Kampfpunkte, Rekordtiefe, Erfolge, Sektor-Bosse und abgewehrte Angriffe") und kannte die zwei neuen
nicht. Dieselbe Fehlerklasse wie 3 und 4, in derselben Lieferung zum **dritten** Mal. Sie nennt
jetzt nur noch die drei stabilen Oberbegriffe (Fortschritt / Unterstützer-Rang / Sternenstaub);
was ein einzelnes Stück verlangt, steht bei ihm selbst.

### Die Wächter

- `tests/test_levelvorboten.js` (8 Prüfungen) – liest BEIDE Quellen aus der Spieldatei, die
  VORBOTEN-Tabelle und die fest verdrahteten `after >= N`-Zweige mit `log()`, und hält sie
  gegeneinander. Beidseitig gegengeprüft: der Anlassfall (Vorbote zurück auf 12) reißt `3`, zwei
  Vorboten auf derselben Stufe reißen `3b`, bei identischen Prüflisten.
- `tests/test_belohnungen_speichern.js` (6 Prüfungen) – prüft JEDEN Zweig von
  `claimPendingRewards`, nicht eine Namensliste; ein neunter Belohnungstyp ist automatisch dabei.
  Gegenprobe am Stand vor der Behebung: `{"ohneSave":["festung","alien-nest"]}`.
- `test_kompendium.js` 5a/5b/5c/5d/5d2, `test_zaehlangaben.js` (Kompendium-Stelle),
  `test_kosmetik_paritaet.js` 7/7b – alle beidseitig gegengeprüft.

**Eine Lehre über den eigenen Wächter, die fast durchgerutscht wäre:** Die erste Gegenprobe zu
`test_belohnungen_speichern` benannte nur `alien-nest` statt beider Zweige. Grund: Mein
Erklärkommentar im Festungs-Zweig **zitiert** den Aufruf („die EINZIGEN der acht ohne save()"), und
die rohe Textsuche sah ihn als vorhanden an. Das ist **Arbeitsregel 33** wörtlich, hier an einem
Test, der einen Datenverlust bewacht. Kommentare werden jetzt vor dem Suchen geleert, und eine
Vorab-Prüfung (`2-vorab`) belegt, dass das Leeren gegriffen hat.

72. **Eine Einleitungszeile, die aufzählt, was direkt darunter ohnehin Zeile für Zeile steht, ist
    eine zweite Anzeigestelle mit Ablaufdatum.** Vorfall 21.08.2026, **dreimal in einer einzigen
    Lieferung**: der Kompendium-Hilfetext („acht Kategorien" bei 13), die statische Zeile über
    `#compendiumBox` (fünf bei 13) und die Einleitung der Kosmetik-Box (sieben Freischaltwege bei
    neun). Alle drei zählten auf, was der Renderer darunter je Zeile mit `name` UND `desc` ausgibt.
    Keine der drei ist je nachgezogen worden – über v8.298, v8.343.0, v8.464.0 und drei
    Aliens-Phasen hinweg.
    **Vorgehen:** (a) Vor jedem neuen Eintrag in einer Tabelle, die gerendert wird, die Umgebung
    nach Aufzählungen derselben Tabelle absuchen – nicht nur nach dem Konstantennamen, sondern nach
    Zahlwörtern und nach den NAMEN der bestehenden Einträge; (b) steht die Aufzählung in JS und die
    Tabelle davor, wird sie ABGELEITET (`'+TABELLE.length+'`, `TABELLE.map(...)`) – Reihenfolge
    vorher messen (Regel 38); (c) steht sie in statischem Markup, kann sie nicht ableiten – dann
    ersatzlos entzählen, denn eine handgepflegte Kopie neben der Liste wird immer wieder falsch;
    (d) den Ausdruck in die `gerechnet`-Liste von `test_zaehlangaben.js` eintragen, damit die Ziffer
    nicht zurückkehrt.
73. **Ein Codepfad, der eine Belohnung entgegennimmt, die der Server beim Ausliefern LÖSCHT, muss
    sie sofort speichern – und „die anderen Zweige tun es ja" ist kein Beleg.** Vorfall 21.08.2026:
    Zwei von acht Zweigen in `claimPendingRewards()` riefen kein `save()`; die Funktion hat kein
    abschließendes. Der Server hatte die Belohnung zu dem Zeitpunkt bereits per `list.shift()` +
    `saveDb()` entfernt – ein zweiter Versuch existiert nicht. Beide Zweige waren die neuesten
    (v8.569.0 und v8.582.0), beide wurden aus einem Nachbarn kopiert, der sein `save()` weiter unten
    stehen hatte.
    **Vorgehen:** Bei jedem Ergebnis, das von einer serverseitigen WARTESCHLANGE kommt, zuerst
    nachsehen, ob der Server es beim Ausliefern verbraucht. Wenn ja, ist das Speichern Teil des
    Empfangens und keine Fleißarbeit – und die Prüfung darauf gehört datengetrieben über ALLE
    Zweige, nicht als Namensliste (Regel 40).

74. **Eine adversarische Prüfung, die den Arbeitsbaum liest, während der Autor ihn korrigiert,
    misst ein bewegliches Ziel – und ihr „widerlegt"-Fach mischt danach zwei völlig verschiedene
    Dinge.** Vorfall 21.08.2026: Eine Prüfung mit 44 Agenten (sechs Blickwinkel, je Befund zwei
    Skeptiker) meldete am Ende **19 Befunde, 0 bestätigt**. Das las sich wie „am Änderungssatz war
    nichts". Tatsächlich hatte ich vier davon während der laufenden Prüfung behoben – darunter
    einen ausgelieferten **Datenverlust** –, und der Skeptiker schrieb das sogar hin: *„Der Befund
    hält am geprüften Arbeitsstand NICHT mehr stand – er ist dort bereits behoben. Wichtig für die
    Einordnung: Er war inhaltlich RICHTIG, nicht falsch."*
    Wer nur das Fach zählt statt die Begründungen zu lesen, zieht daraus den genau falschen
    Schluss – und schlimmer: Beim nächsten Mal lässt er die Prüfung weg, weil sie ja „nichts
    gefunden" hat.
    **Vorgehen:** (a) Entweder die Prüfung gegen eine eingefrorene KOPIE laufen lassen
    (`KEPLER_SPIELDATEI` auf einen Schnappschuss), dann ist das Ergebnis eindeutig; (b) oder – wenn
    parallel gearbeitet wird, was der Normalfall ist – die BEGRÜNDUNGEN lesen, nicht die Bilanz.
    Ein Urteil „widerlegt" hat mindestens drei Bedeutungen: *war nie ein Problem*, *ist eine
    dokumentierte Absicht*, und *war ein Problem und ist schon behoben*. Nur die ersten beiden
    entlasten. (c) Ein Befund, den man selbst am Code nachgemessen hat, steht über jedem Urteil
    einer Prüfung – die Messung ist der Beleg, das Urteil nur eine zweite Meinung (Regel 10 in
    beide Richtungen gelesen).
    **Was die Prüfung in dieser Sitzung wirklich geleistet hat**, gemessen statt behauptet: Sie
    hat drei echte Fehler geliefert, die ich beim eigenen Durchgang übersehen hatte – den
    Datenverlust in `claimPendingRewards`, die Vorboten-Kollision auf Stufe 12 und die
    Aufzählung in der Kosmetik-Box. Und ihre Skeptiker haben zwei meiner eigenen neuen Texte
    verteidigt, die ich sonst womöglich „vorsichtshalber" abgeschwächt hätte: Der erzählerische
    Halbsatz im Vorboten ist Genre (alle fünf Vorboten mischen Weltfiktion mit harten Zahlen, und
    die ZAHLEN stimmen), und „vier bis sieben Schläge" liegt nach Nachrechnung MIT den
    Phase-2-Bauteilen (Schild 12.000 LP, Türme 7.500, Kern-Durchlass 0,35) am unteren Rand der
    Wirklichkeit statt darüber. **Eine Prüfung, die auch das Richtige verteidigt, ist mehr wert
    als eine, die nur Fehler zählt.**

## Ein Gegenstand wird nur verbraucht, wenn er WIRKT (21.08.2026)

Zwei der drei offenen Punkte aus Phase 6 sind damit erledigt; der dritte (`belagerungsplan`) ist
noch am selben Tag gefolgt und steht unten.

### Der ausgelieferte Datenverlust in `activateItem`

`activateItem` buchte das Exemplar ab, **bevor** `item.activate()` lief. Der erste Durchgang fand
**vier** Gegenstände, die `null` zurückgeben, wenn sie nichts bewirken können — und damit eine
**leere Protokollzeile** erzeugten (`escapeHtml(null)` liefert `''`, ausgeführt gemessen). Behoben
durch Umdrehen der Reihenfolge: erst wirken lassen, nur bei Wirkung abbuchen, statt `null` ein
`{ fehler: '<Grund>' }`.

**Der zweite Durchgang hat die Familie verdreifacht — und das ist die eigentliche Lehre.** Eine
adversarische Prüfung gegen den eingefrorenen Änderungssatz meldete, dass **neun weitere**
Gegenstände genau dasselbe tun, nur unauffälliger: Sie melden ihre Nicht-Wirkung als **ganz
normalen Text** und werden deshalb ebenso verbraucht. Nachgemessen stimmt das:

| Gegenstand | Seltenheit | was er meldete, während er verschwand |
|---|---|---|
| `forschungsboost` | selten | „verpufft wirkungslos" |
| `baubeschleuniger` | ungewöhnlich | „verpufft wirkungslos" |
| `bergungsdrohnen` | ungewöhnlich | „kehren unverrichteter Dinge zurück" |
| `sternenkartenkopie` | selten | „wird archiviert, ohne etwas hinzuzufügen" |
| `umschulungsbefehl` | selten | „löse zuerst den vorhandenen ein" |
| `forschungsdurchbruch` | **mythisch** | „wandert ins Archiv und wartet auf seinen Moment" |
| `urwerkzeug` | **mythisch** | „findet nichts, woran es arbeiten könnte" |
| `werftkommando` | **mythisch** | „rückt unverrichteter Dinge ab" |
| `ab_sternenkarte` | episch | „Die Karte bleibt leer" |

**Zwei dieser Texte waren obendrein eine Falschaussage:** „wird archiviert" und „wandert ins Archiv
und wartet auf seinen Moment" behaupten eine Aufbewahrung, die es nicht gibt — das Exemplar war
weg. Und `umschulungsbefehl` verspricht in seiner eigenen `desc` wörtlich **„Bleibt liegen, bis du
sie einlöst"**, während der zweite genau dabei vernichtet wurde.

**Die übertragbare Lehre: Ich hatte den MECHANISMUS behoben, nicht die KLASSE.** `return null` war
die auffällige Hälfte (leere Zeile), der gewöhnliche Text die unauffällige — und beide Hälften
kosten dasselbe. Wer einen Fehler an seiner Erscheinungsform erkennt, findet nur die Fälle, die
sich gleich erscheinen. Die Frage muss lauten *„was ist hier eigentlich falsch?"* (ein Exemplar
verschwindet ohne Gegenleistung), nicht *„wie sah es aus?"*.

Alle dreizehn tragen jetzt die `{ fehler }`-Form, jeder Grund ist ein ganzer Satz und sagt
ausdrücklich, dass das Exemplar erhalten bleibt.

**Drei Entscheidungen, die man beim Anfassen kennen muss:**

- **`{ fehler: '<Grund>' }` statt `null`.** Eine Form, die sonst niemand benutzt.
- **Ein zweiter Zweig fängt ein blankes falsy ab.** Wer künftig eine `activate()` ohne Rückgabe
  baut, verliert dadurch kein Exemplar mehr.
- **Beide Meldungen sind `wichtig` markiert** (Arbeitsregel 47): Der Toast-Stapel hält nur drei,
  und eine Erklärung, warum gerade NICHTS passiert ist, darf nicht als erste verdrängt werden.

### Was der Wächter abdeckt — und was ausdrücklich nicht

Der stumme Ausgang (`return null` / `return;` / `return false`) ist **strukturell** erkennbar, mit
null Fehlalarmen. Die Nicht-Wirkung als gewöhnlicher Text ist es **nicht** — und beide naheliegenden
Wege sind gemessen untauglich:

- **Über die WORTWAHL** (kein/nicht/bereits/leer): meldet den `umschulungsbefehl` als Fehler, dessen
  **Erfolgs**meldung „kostet dich nichts" lautet.
- **Über die STRUKTUR** („Rückgabe vor der ersten Zustandsänderung"): liefert 23 Treffer, von denen
  die meisten legitime Erfolgs- und Auskunftsmeldungen sind.

Deshalb steht daneben eine **benannte Regressionsliste** der dreizehn — dasselbe Mittel wie die acht
Schiffsklassen in `test_werft_massenflotten`, und aus demselben Grund: Die Liste ist ein
historischer Befund, keine ableitbare Tabelle. Ein **vierzehnter** fällt dort nicht auf; das ist die
bewusst benannte Grenze und steht als Kommentar im Test, damit niemand den Anspruch für breiter
hält, als er ist.

### Sechs Abgrund-Gegenstände fielen aus ganz gewöhnlicher Erkundung (behoben 21.08.2026)

Gefunden beim Nachmessen der Fundwege für den Belagerungsplan, also nebenbei – und es war ein
**ausgelieferter** Fehler.

`checkMissions` hat zwei Fundstellen für Gegenstände. Die **Expedition** zieht über
`fundPool(ITEM_DEFS)`, und ihr Kommentar sagt die Regel wörtlich: „Expeditionen sind eine NORMALE
Fundquelle und dürfen deshalb keine Abgrund-Gegenstände ausschütten." Die **Erkundung** daneben –
älter, im selben `checkMissions` – iterierte roh über das volle Array. Gemessen:

| | |
|---|---|
| `ITEM_DEFS` gesamt | 30 |
| roher Zweig zog daraus | 29 |
| `fundPool()` zieht daraus | 23 |
| **fielen zu Unrecht** | `ab_tiefenlot`, `ab_bannspule`, `ab_rueckholanker`, `ab_sternenkarte`, `ab_waechterruf`, **`ab_grundberuehrung` (mythisch)** |

Erwartungswert **0,176 je Funddurchlauf** – während `grantAbgrundItem()` dieselben Stücke eigens
nach Seltenheit gewichtet, ausdrücklich damit „die Grundberührung ein Ereignis bleibt, kein
regelmäßiger Ertrag". Die Absicht war also nicht nur dokumentiert, sie war **daneben umgesetzt**.

**Mitgenommen: die zweite rohe Ziehung im selben Zweig.** `for (const ri of RARE_ITEMS)` steht
zwei Zeilen darunter. Heute ändert die Umstellung dort **nichts** – gemessen trägt kein Eintrag
eine fremde Herkunft, und den einen mit `chance:0` (`leerensplitter`) fängt `Math.random() < 0`
ohnehin ab. Sie ist trotzdem umgestellt, weil damit die Regel „kein Fundtopf zieht roh"
**ausnahmslos** wird – und erst eine ausnahmslose Regel lässt sich als Prüfung schreiben.

**Die Lehre betrifft den WÄCHTER, nicht den Code.** `test_herkunft.js` hatte für genau diese
Fehlerklasse einen Abschnitt B – und der nannte die Expedition **beim Namen**. Eine namensbasierte
Prüfung findet nur, woran man schon gedacht hat (Regel 40); die ältere Fundstelle nebenan konnte
ihr gar nicht auffallen. Sie verbietet jetzt die **FORM** (`for (… of ITEM_DEFS)` und
`RARE_ITEMS[Math.floor`), kennt keinen einzigen Namen mehr, und eine neue Fundstelle fällt auf,
ohne dass jemand an sie gedacht haben muss. Dazu `B-vorab`, das belegt, dass der Ausdruck die
verbotene Form überhaupt erkennt – sonst wäre die Prüfung auch dann grün, wenn er nichts mehr
trifft (Regel 71).

**Und der Test las seine Datei über einen fest verdrahteten Pfad** – der Defekt, den die
Arbeitsregeln unter „Korrektur 15.08.2026" als Falle beschreiben und von dem 19 weitere Tests
betroffen sind. Ohne die Umstellung auf `lib/umgebung` hätte die Gegenprobe die echte Datei
gelesen und wäre grün gewesen. Jetzt fällt sie am alten Stand mit den zwei Zeilennummern im Beleg:
`["Zeile 47804: for (const item of ITEM_DEFS){", "Zeile 47815: for (const ri of RARE_ITEMS){"]`.

**Derselbe Defekt hat am selben Tag ein zweites Mal zugeschlagen, in `test_items.js`** – und
diesmal beim Versuch, eine Gegenprobe zu fahren, die es zu widerlegen galt. Auch dort ist der
Pfad jetzt auf `lib/umgebung` umgestellt. **Die Reihenfolge der Diagnose ist die eigentliche
Lehre:** Die erste Sabotage blieb grün, der Verdacht fiel sofort auf die Env-Variable (weil sie
gerade zum zweiten Mal genau so ausgefallen war) – gemessen war die Umleitung danach aber
nachweislich angekommen, und schuld war meine **zu schwache Sabotage** (sie ersetzte nur den
ersten Satz, der Rest der Beschreibung stand noch da). Ein bestätigter erster Verdacht ist nicht
automatisch die Ursache; erst die Messung *„was liest der Parser eigentlich?"* hat es geklärt.

### Meine eigene „strukturelle" Behebung war eine Namensliste in Verkleidung (21.08.2026)

Zweimal am selben Tag ist `test_protomaterie` 8b-bau gefallen, und beim zweiten Mal war **meine
Behebung des ersten Males** die Ursache.

`8b-bau` setzt den Hilfe-Eintrag aus der Spieldatei zusammen und führt ihn aus. Dafür müssen die
Konstanten, aus denen der Text seine Zahlen ableitet, im Geltungsbereich stehen.

1. **Erster Fall:** `FESTUNG_ABKLING_STD` kam dazu, der Hilfetext leitete daraus ab, die dort
   eingetippte **Namensliste** kannte ihn nicht → `"FESTUNG_ABKLING_STD is not defined"`.
2. **Behebung:** geschnitten wurde fortan „über die FORM" – `/\n  const FESTUNG_[A-Z_]+ = /`.
3. **Zweiter Fall, Stunden später:** `BELAGERUNGSPLAN_SENKUNG` kam dazu, derselbe Fehlschlag stand
   wieder da, nur mit einem anderen Namen darin.

**Ein Namenspräfix ist keine Form.** `FESTUNG_[A-Z_]+` fängt jede künftige `FESTUNG_*`-Konstante
und keine einzige andere – das ist wörtlich der Nachtrag zu Arbeitsregel 40 („ein Muster, das eine
einzelne Schreibweise kodiert, ist eine namensbasierte Suche in Verkleidung"), nur dass ich es
selbst gebaut habe, während ich glaubte, die Fehlerklasse zu schließen. Die Prüffrage dagegen
lautet: *Welche Eigenschaft brauche ich wirklich?* Antwort: „die Konstanten, die dieser Text
BENUTZT" – und die kann man aus dem Text selbst lesen, statt sie zu benennen.

**Behoben ohne einen einzigen Namen:** Die Bezeichner werden aus dem geschnittenen Hilfe-Eintrag
gesammelt, ihre Deklarationen aus der Datei geschnitten, und das transitiv wiederholt (was diese
Deklarationen ihrerseits brauchen). Was der Kopf ohnehin mitgibt, steht in `schonDa` – sonst
stünde eine Deklaration doppelt im Text (`has already been declared`).

**Die Gegenprobe belegt die KLASSE, nicht nur den Anlassfall** (Regel 40 Nachtrag: die eigene
Anlassfamilie einspeisen). Gemessen an einer Kopie mit einer frei erfundenen, fremd benannten
Konstante (`ZIERWERT_PROBE`) im Festungs-Hilfetext:

| | alte Regel | neue Regel |
|---|---|---|
| echte Datei (`BELAGERUNGSPLAN_SENKUNG`) | `… is not defined` | grün |
| Kopie (`ZIERWERT_PROBE`) | `ZIERWERT_PROBE is not defined` | grün |

**Und ein Werkzeugfehler dabei, der die Gegenprobe fast entwertet hätte:** Der erste Versuch fuhr
die alte Fassung aus `/tmp` – dort löst `require('./lib/umgebung')` nicht auf, der Lauf starb mit
`Cannot find module` und meldete **0 Prüfungen**. Das sah aus wie „die alte Regel ist grün".
Dieselbe Familie wie Regel 56/61: Ein Prüflauf aus dem falschen Verzeichnis misst nicht den alten
Stand, sondern gar nichts. Die Kopie liegt seither in `tests/` und wird danach entfernt.
Die Prüfungszahlen der beiden Läufe unterscheiden sich übrigens legitim (40 gegen 43): Fällt
`8b-bau`, laufen `8c`/`8d`/`8e` nicht – das ist genau erklärbar und kein verdeckter Abbruch
(Regel 34).

### Ein abgeleiteter Text braucht einen Parser, der Ableitungen lesen kann (21.08.2026)

Die Beschreibung des Belagerungsplans leitet ihre Prozentzahl aus `BELAGERUNGSPLAN_SENKUNG` ab,
statt sie einzutippen (Reihenfolge vorher gemessen, Regel 38: Konstante bei Zeichen 2.055.030,
`ITEM_DEFS` bei 4.914.443). Damit war sie die **erste** zusammengesetzte `desc` im ganzen Block –
gemessen: 0 von 30 vorher.

`test_items.js` las sie mit `desc:'([^']*)'` und schnitt deshalb am ersten Apostroph ab, den die
Verkettung mitbringt. Der Test meldete „unvollständiger Beschreibungssatz" für einen Satz, der
vollständig dasteht.

**Die bequeme Lösung wäre gewesen, die Zahl wieder einzutippen.** Richtig ist das Gegenteil
(Regel 43): Der Parser liest jetzt bis zum **nächsten Feld** und ersetzt eingesetzte Ausdrücke
durch einen Platzhalter – geprüft werden Länge und Schlusszeichen, nicht der eingesetzte Wert.
Damit kann jede künftige abgeleitete Beschreibung gelesen werden, und der Test ist **stärker** als
vorher, nicht nachgiebiger. Beidseitig gegengeprüft an zwei Sabotagen auf genau dieser
zusammengesetzten Beschreibung: zu kurz → rot, ohne Schlusszeichen → rot, echter Stand → grün.

### Die Festungs-Abklingzeit ist eine Konstante geworden

`FESTUNG_ABKLING_STD = 6` steht jetzt neben `NEST_ABKLING_STD = 4`. Sie hatte **fünf** lebende
Fundstellen als eingetippte Ziffer – vier Anzeigen und, schwerer wiegend, **die Sperre selbst**
(`meinLetzter + 6*3600*1000` im Kartenmenü, also die Entscheidung, ob der Angriffs-Eintrag
überhaupt anklickbar ist). Das war nicht bloß Kosmetik: Die Zahl ist eine **Kopie von
`FESTUNG_ABKLING_MS` aus `server.js`**. Liefen die zwei auseinander, zeigte die Karte den Schlag
als frei an und `/api/festung/angriff` antwortete mit 403 – oder umgekehrt sperrte das Frontend
etwas, das der Server längst erlaubt.

Reihenfolge vorher **gemessen**, nicht geschätzt (Regel 38): Alle fünf Leser stehen hinter der
Konstante; der Hilfetext-Treffer, den `indexOf` zuerst fand, war ein **Patchnote** und nicht der
Hilfetext – die echte Fundstelle liegt 3,3 Mio Zeichen weiter hinten.

Wächter: `test_festung_paritaet.js` 6-anker/6a/6b (Wert gegen Wert, Stunden gegen Millisekunden –
ein Textvergleich fiele hier zwangsläufig durch und wäre kein Befund) und die `gerechnet`-Liste von
`test_zaehlangaben.js`, damit die Ziffer im Hilfetext nicht zurückkehrt.

### Der Wächter und die vier Fallen beim Bauen

`tests/test_gegenstand_verbrauch.js` (17 Prüfungen, Gegenprobe beidseitig: **9 rot** am
ausgelieferten Stand bei identischer Prüfliste). Er misst die Regel im Quelltext UND die
**Wirkung im echten Spiel**: dieselbe Bannspule zweimal aktiviert, Bestand von der Karte
abgelesen. Am alten Stand steht dort nach dem zweiten Klick `null` – die Zeile verschwindet ganz,
weil der Bestand auf 0 fällt.

Vier Dinge sind dabei schiefgegangen, jedes eine Regel dieses Dokuments in Aktion:

1. **Der Endanker war falsch.** Beide Gegenstandstabellen enden mit **drei** Leerzeichen
   (`   ];`), nicht mit zweien. Ein `indexOf('\n  ];')` greift daneben und liefert einen zu langen
   Block (Regel 6). Der Test schneidet jetzt per Regex auf eine Zeile, die nur aus Leerraum und
   `];` besteht – und prüft zusätzlich, dass im Block keine fremde Tabelle anfängt.
2. **Der Spielstand-Schlüssel war geraten** (Regel 4). Im Solo-Betrieb heißt er
   `kepler7_` + `kepler7-save-v3`; ich hatte den blanken Namen aus einem Test kopiert, der ihn über
   die Backend-Route ausliefert. Das Spiel startete daraufhin **frisch** (gemessen: Credits 0, Erz
   10/800), und das leere Inventar sah wie ein Befund aus. **Und die Korrektur allein reichte
   nicht:** `storageGet` kehrt bei einer 404-Antwort des Backends ausdrücklich ZURÜCK
   (`if (res.status === 404) return null;`), statt auf den lokalen Speicher durchzufallen – wer
   alle `/api/`-Aufrufe pauschal auf 404 legt, bekommt nie einen geladenen Spielstand. Der Test
   serviert ihn deshalb über die geroutete Storage-Antwort.
3. **Eine Prüfung war aus dem falschen Grund grün** (Regel 28). Mein zweiter Toggle-Klick hat die
   Karte wieder ZUGEKLAPPT, der Aktivieren-Knopf war weg, und `if (b) b.click()` tat nichts –
   „das Exemplar bleibt liegen" war damit trivial erfüllt. Gemeldet hat es nur die Prüfung
   daneben, die den GRUND im Protokoll verlangt. Seither ist die Anwesenheit des Knopfes eine
   eigene, benannte Vorab-Prüfung: **eine Messung, die nichts anklickt, darf nicht grün sein.**
4. **Zwei Prüfungen waren in der ersten Gegenprobe vacuous grün**, weil `every` über eine leere
   Liste trivial wahr ist – am alten Stand gibt es ja gar keine Gründe. Sie verlangen jetzt zuerst
   einen WERT, dann die Beziehung. Genau derselbe Befund wie beim `/api/health`-Test zwei Tage
   vorher; **wer eine Prüfung über eine Menge formuliert, die es am Vergleichsstand nicht gibt,
   prüft sonst nur, dass sie fehlt.**

### Der `belagerungsplan` – entschieden und gebaut am 21.08.2026 (v8.600.0)

Vorgelegt mit drei Optionen, gewählt von Sascha: **die Wirkung umwidmen.** Statt eines Extraschlags
senkt der Plan die **eigenen Verluste** des nächsten Festungsschlags um
`BELAGERUNGSPLAN_SENKUNG` (40 %).

Der Grund, warum die Konzept-Fassung nicht gebaut wird, bleibt als Messung wichtig: Der Hort ist
streng nullsummig (`anteil = schaden/summe`, `if (!(anteil > 0)) continue;`). Ein Extraschlag
**addiert nichts, er verschiebt** – gerechnet an einer Sternenfeste 180.000 Erz, 96 Protomaterie
und 18 Kampfpunkte, die von benannten Mitstreitern zum Planbesitzer wandern. Die Fairness-
Begründung im Konzept („er stapelt sich nicht") ist damit nachweislich falsch, und das dort
genannte Spielstand-Feld `festungLetzterSchlag` gibt es seit Phase 1 nicht mehr.

Die gewählte Wirkung nimmt niemandem etwas weg: **Verluste bucht ohnehin der Client** (das ist die
dokumentierte Arbeitsteilung des Festungsschlags – der Server schreibt den Spielstand des
Angreifers nicht), der Hort bleibt unberührt, und es braucht **null Backend-Zeilen**.

**Fünf Entscheidungen aus dem Bau, jede vorher gemessen:**

- **Die Vormerkung reist in der MISSION mit** (`m.belagerungsplan`), nicht als Zustandsflagge.
  Verbraucht wird sie beim **Start**, wie die vier Abgrund-Vormerkungen, deren Kopfkommentar den
  Grund festhält („sonst könnte ein verlorener Kampf sie zurückgeben"). Hier kommt ein zweiter
  Grund dazu, den die Tauchgänge nicht haben: Es können **zwei Festungsschläge gleichzeitig
  fliegen**. Eine Flagge, die erst bei der Auflösung gelesen wird, wirkte beim falschen Schlag oder
  bei beiden.
- **Kam gar kein Kampf zustande, kommt der Plan ZURÜCK.** Das ist kein Widerspruch zur Regel oben:
  Ein verlorener Kampf ist ein Kampf, der Plan hat gewirkt. Der `angriffOhneKampf`-Zweig dagegen
  kostet nach eigener Ansage **nichts** – ein Gegenstand, der dort verschwände, wäre genau der
  Fehler, der Stunden vorher für dreizehn Gegenstände behoben wurde (v8.598.0).
- **Der Bericht bekommt `verluste`, nicht `daten.eigeneVerluste`.** Sonst nennte er die
  ungekürzte Serverzahl, während eine andere gebucht wird – die klassische zweite Anzeigestelle
  (Punkt 6). Ohne Plan sind beide identisch; der Unterschied entsteht erst mit ihm, und genau dann
  fällt so etwas niemandem auf.
- **Die Vorschau RECHNET ihn ein, statt ihn zu nennen** (Regel 61) und stellt die ungekürzte Spanne
  als Gegenrechnung daneben. Gemessen: 12–18 % ohne, 7–11 % mit Plan. Eine Zeile „Plan aktiv" neben
  einer unveränderten Spanne wäre das Etikett statt der Wirkung – und der Spieler könnte nicht
  sehen, was der Plan ihm bringt.
- **Herkunft NORMAL, also der reguläre Fundtopf.** Der Hort der Festung schied aus: Er läuft über
  `pushPendingReward` im Backend, und die gewählte Fassung sollte ja gerade ohne Backend-Zeilen
  auskommen. Ein klientenseitiger Wurf im `festung`-Zweig von `claimPendingRewards` wäre gegangen,
  hätte aber eine **Farm-Lücke** geöffnet: Gemessen fällt eine Schanze (Kern 30.000) für ein
  Endspiel-Konto in **einem** Schlag, eine Sternenfeste (1,2 Mio) braucht fünf – wer die Chance an
  den FALL hängt, farmt Schanzen. Jede Gegenmaßnahme wäre eine neue, erfundene Zahlentabelle
  gewesen. Der reguläre Topf braucht keine: 0,012 ist exakt die Chance der drei anderen epischen
  Gegenstände.

**Ein Fund des eigenen Wächters, und er ist der Wert musterbasierter Tests in Reinform:**
`test_iconabdeckung` 10 meldete `ti-list-details → tiefenkarte, belagerungsplan` – das gewählte
Symbol war längst vergeben. Umgestellt auf `ti-building-fortress` (frei, im Subset, und dieselbe
Bildsprache wie der Festungsbericht). **Kein `grep` hätte das gefunden**, weil man nach der
Kollision erst sucht, wenn man sie vermutet.

Wächter: `tests/test_belagerungsplan.js` (32 Prüfungen – Quelltext-Verdrahtung, Aktivierung über
den Spielerweg, zwei **Paar-Messungen** und der Kein-Kampf-Zweig). Gegenprobe gegen `origin/main`
per `KEPLER_SPIELDATEI`: **25 rot bei identischen 32 Prüfnamen** (per `diff` verglichen, nicht
gezählt – Regel 60). Die zwei Paar-Messungen sind der Kern: Vorschau und gebuchte Verluste werden
je zweimal mit **identischer Serverantwort** gefahren, nur die Vormerkung unterscheidet die Läufe –
der Anker liegt damit außerhalb der geprüften Rechnung (Regel 62). Gemessen: 80 gegen 88 von 100
Kreuzern übrig.

**Und ein Fehlgriff beim Bau des Tests, den seine eigene Vorab-Prüfung gefangen hat:** Nach der
Aktivierung stand die Gegenstandskarte noch offen; der zweite Toggle-Klick klappte sie **zu**, der
Aktivieren-Knopf war weg, und „der zweite Versuch verbraucht nichts" war aus dem falschen Grund
grün (Regel 28) – exakt derselbe Fehlgriff wie in `test_gegenstand_verbrauch` einen Tag vorher. Der
Test sieht jetzt erst nach und klappt nur bei Bedarf auf.

### Der Fundort-Knopf log bei Nest- und Festungsberichten (behoben 21.08.2026)

`zeigeAsteroidFundort` kannte zwei Fälle: einen Bericht MIT Gürtelplatz und einen alten ohne. Nest-
und Festungsberichte tragen aber **grundsätzlich keinen** `platz` – sie meinen ein Ziel im System,
keinen Platz auf der Gürtelbahn. Beide stehen trotzdem in der Eignungsliste des Knopfes, fielen
damit in den Altbestands-Zweig und meldeten über einen **minutenalten** Bericht: „Der Bericht
stammt aus der Zeit vor dieser Anzeige und kennt nur das System."

**Die Festungs-Hälfte war seit v8.569.0 live**, also drei Tage. Aufgefallen ist sie erst, als der
Nest-Bericht denselben Knopf bekam und dieselbe Zeile erzeugte – ein zweiter Betroffener macht
einen Einzelfall sichtbar, den man allein übersieht (dieselbe Familie wie Regel 52: die
Einzelfall-Lösung ist der Hinweis, dass es weitere Betroffene gibt, hier in der Gegenrichtung).

Behoben mit einem eigenen Zweig für **beide** Arten, der sagt, was den Spieler dort JETZT erwartet
– dieselbe Ehrlichkeit, die der Vorkommen-Zweig darunter schon leistet: Nest steht noch (mit
Lebenspunkten) bzw. ist gefallen oder weitergezogen; Festung steht noch (mit Kernanteil) bzw. der
Gürtel ist wieder frei. Das Nest wird dabei **über sein Volk** gesucht, weil in einem System
mehrere Nester stehen können und der Bericht genau eines meint.

**Die übertragbare Frage, die hier gefehlt hat:** Wer eine neue Berichtsart in die Eignungsliste
eines Knopfes aufnimmt, prüft, ob sie die Felder überhaupt trägt, auf die dieser Knopf sich stützt.
Ein Knopf, der erscheint, aber nur den Rückfallzweig erreicht, ist keine Funktion mit Lücke – er
ist eine Falschaussage.

Wächter: `tests/test_fundort_knopf.js` Abschnitt 6 (8 Prüfungen). Er misst je Art **beide
Richtungen** – Ziel steht noch und Ziel ist weg –, denn eine Meldung, die immer dasselbe sagt, wäre
auch von einem festen Text erfüllt (Regel 61). Die Fixture kann dafür `galaxy` und `asteroid/field`
injizieren; ohne Injektion bleibt es beim lokal erzeugten Gürtel, damit die Abbau-Fälle ihren
ablesbaren Platz behalten (Regel 4). Beidseitig gegengeprüft: 19 Prüfungen in jeder Richtung, und
am Stand davor fallen genau die sechs neuen Inhaltsprüfungen, jede mit der alten Zeile als Beleg.

## GR-2: Lebenspunkte als Balken, Belohnungen als Zeile (21.08.2026)

Nest- und Festungsmenü nannten ihre Lebenspunkte nur als Zahlenpaar („260.0k von 400.0k") und das
Nest-Menü **keine einzige** mögliche Belohnung. Beides ist jetzt da: ein Füllbalken je Leiste und
eine Zeile, die sagt, was beim Fall zu holen ist.

**`kartenFuellBalken(label, wert, max, farbe, tip)` ist die EINE Quelle für alle vier Balken**
(Nest-Kern, Festungs-Kern, Schildkuppel, Geschütztürme). Fünf Entscheidungen darin:

- **Die CSS-Klasse war zuerst `.sstat` (die Kennwertform der Werft) – das war falsch und ist mit
  GR-3 korrigiert.** Der Absatz bleibt hier stehen, weil die Fehlerfamilie wiederkehrt: Ich hatte
  „dieselbe Klasse wie Werft und Verteidigung" als Vorteil verbucht (VT-1-Präzedenz) und dabei die
  falsche Frage beantwortet. Ein Lebenspunkte-Rest ist kein Kennwert-VERGLEICH, sondern ein
  FÜLLSTAND – und für die zeichnet das Spiel gemessen an **60** Stellen `.progress-outer`, an nur
  **drei** `.sstat`. Die nächste dieser 60 stand im SELBEN Kartenmenü direkt nebenan (der
  Asteroiden-Vorrat seit v8.512.0). Einzelheiten unter GR-3.
- **Der Unterschied VERGLEICH gegen FÜLLSTAND steht im Titel, nicht im Balken.** Bei Schiffen misst
  ein Balken den Wert *im Verhältnis zur besten Klasse der Flotte*, hier den Rest eines einzelnen
  Objekts. Gleiche Bildsprache, andere Bedeutung – der Tooltip sagt es („nicht ein Vergleich mit
  anderen Nestern").
- **Der Prozentwert stand zuerst rechts IM Balken** (das `.v`-Feld ist 30 px breit, „260.0k" passt
  dort nicht). Seit GR-3 steht er in der Zeile darüber – dem Muster, das die Angriffs-Vorschau
  schon immer hatte.
- **Die Farbe wird GEPRÜFT, nicht durchgereicht** (`/^#[0-9a-fA-F]{3,8}$/`, sonst der Violett-Ton
  des Spiels). Sie kommt aus `ALIEN_VOELKER`/`FESTUNG_STUFEN`/`FESTUNG_BAUTEILE` und geht in ein
  `style`-Attribut – dieselbe Lehre wie bei GR-1, wo alle 40 Farben des Portal-Entwurfs durch eine
  Tabelle liefen, die bei einer unbekannten Farbe abbricht.
- **Das Label hieß „Rest" – und genau daran ist die ganze Formwahl gescheitert.** Der erste
  Entwurf hatte „Kern"/„Nest" und doppelte damit die Zeile darüber; „Rest" löste die Doppelung und
  machte das Label dafür nichtssagend. Im gerenderten Bild stand es dreimal untereinander. Siehe
  GR-3.

**Die Belohnungszahlen sind aus `server.js` herübergekommen** – `NEST_STUFEN` trägt jetzt
`kampfpunkte`/`xp`/`credits`, `FESTUNG_STUFEN` `kampfpunkte`. **`punkte` bewusst NICHT:** Das ist
die Stufengewichtung fürs Tauziehen der Weltlage (Phase 4) und hat im Frontend keine
Anzeigestelle – ein Feld, das nur mitkopiert wird, ist die Sorte Zahl, die später jemand für
benutzt hält (Regel 59).

**„Hort" bleibt „Hort", und das ist eine Entscheidung gegen die eigene Formulierung.** Der erste
Entwurf schrieb „Beim Fall zu holen:" und riss `test_festung_ui` 2b. Gemessen steht „Hort" 25-mal
in der Datei, mehrfach in `HELP_SECTIONS` – es ist der etablierte Begriff. Angepasst wurde der
TEXT, nicht der Wächter (dieselbe Abwägung wie bei TX-1: Regel 3 gegen Regel 26, und hier lag der
Fall auf der Seite des Wächters).

### Die eigentliche strukturelle Änderung: beide Paritätstests sind datengetrieben

`test_nest_paritaet` 3b verglich `name` und `lp` als **Namensliste**, `test_festung_paritaet` 2a
`kern`, `blockade` und `proto`. Ein neu übernommenes Feld wäre damit stillschweigend ungeprüft
geblieben – genau der Fall, der mit den Belohnungszahlen anstand. Beide vergleichen jetzt **jedes
Feld, das die Frontend-Tabelle führt**; das Backend darf mehr haben (`punkte`, `hortStd`,
`fernBis`), das Frontend aber nichts, was dort fehlt oder abweicht. `farbe` ist namentlich
ausgenommen und reine Frontend-Kosmetik. Ein fünftes Feld ist damit automatisch mitgeprüft, ohne
dass jemand an es gedacht haben muss (Regel 40).

Gegenproben, beide beidseitig gefahren, identische Prüflisten per `diff` verglichen (Regel 60):
Backend-Kopie mit `kampfpunkte: 16` statt 15 → genau `3b` bzw. `2a` fallen, mit dem sprechenden
Beleg `{"stufe":1,"feld":"kampfpunkte","front":15,"back":16}`. 12 bzw. 26 Prüfungen in jeder
Richtung.

### Die Wächter messen die WIRKUNG, nicht die Anwesenheit

`test_nest_ui` Abschnitt 6 und `test_festung_ui` Abschnitt 7 fahren je ZWEI Läufe, die sich nur im
Lebenspunkte-Stand bzw. in der Stufe unterscheiden. Gemessen wird die **sichtbare Geometrie** – der
Anteil, den die Füllung von ihrer Schiene einnimmt –, nicht das `style`-Attribut, das auch dann
dastünde, wenn eine CSS-Regel den Balken flachlegt (Regel 55). Die Festungs-Fixture gibt den drei
Balken absichtlich drei VERSCHIEDENE Anteile (75/50/25 %): Ein Lauf mit gleichen Werten wäre auch
von drei identischen Balken erfüllt.

Drei Gegenproben an sabotierten Kopien, jede mit der Liste der Prüfungen, die fallen MÜSSEN
(Regel 71): fester Anteil 50 % → `6b`/`6c`/`7b`; Balken abgeschaltet → `6-vorab`/`6a`/`7-vorab`/`7a`;
Bergungszeile abgeschaltet → `6d`/`6e`.

**Ein Werkzeugfehler im eigenen neuen Test, gefangen am Beleg:** Die Bergungszeile wurde zuerst per
`/Bergung:[^]{0,120}/` aus dem Fließtext des Menüs geschnitten – ein **geratenes Zeichenfenster**,
das sichtbar in die Nachbarzeile lief („… geteilt Wirksam dagegen: Jäger im Verba"). Das ist
wörtlich die Regel, die einen Abschnitt weiter oben steht („Ein GERATENES Fenster ist kein Scope"),
im selben Atemzug verletzt. Gegriffen wird jetzt das `.bmeta`-ELEMENT. Aufgefallen ist es nur, weil
der Fehlschlag-Beleg den Treffer mit ausgibt – ein Test, der nur „grün" meldet, hätte es verdeckt.

**Und Regel 15 hat sich zum zweiten Mal bestätigt, mit demselben Exit-Code:** Ein `pkill -f 'node
-c'` gegen einen eigenen hängengebliebenen Hilfsbefehl traf die eigene Shell (Exit 144). Die Regel
steht seit dem 06.08.2026 wörtlich in diesem Dokument, samt Exit-Code. **Kein `pkill` mit einem
Muster, das die eigenen Werkzeuge selbst enthalten können** – hängende Prozesse werden über `ps`
identifiziert und einzeln über ihre PID beendet, oder man lässt sie laufen.

## GR-3: eine Balkenform im Kartenmenü – und wie ich die falsche gewählt hatte (21.08.2026)

GR-2 hatte den Füllbalken in der `.sstat`-Kennwertform der Werft gezeichnet. GR-3 stellt ihn auf
die **Hausform `.progress-outer`** um, zieht den **Asteroiden-Vorrat auf dieselbe Funktion** und
schreibt den Prozentwert in die **Zeile über** dem Balken. Damit gibt es im Kartenmenü eine Form
statt zweier, und `kartenFuellBalken()` ist die eine Quelle für alle fünf Balken.

**Gefunden hat es der Screenshot, nicht der Test** (Regel 42, zum wiederholten Mal). Die Wächter
aus GR-2 maßen den Füllanteil und waren grün; im Bild stand das Label aber **dreimal
untereinander „REST"** – es trennte die drei Leisten also gar nicht. Und genau „drei Leisten ohne
Label sind nicht unterscheidbar" war mein einziges Argument für die schmale Form gewesen. Das
Argument war nicht falsch angewandt, es war **von meinem eigenen Code widerlegt**, und ich hatte
das Bild nach dem Label-Wechsel nicht noch einmal angesehen.

**Die Messung, die die Entscheidung trägt:** `.progress-outer` steht an **60** Stellen der Datei,
`.sstat` an **drei**. Für einen FÜLLSTAND ist die Hausform also die etablierte Antwort; `.sstat`
bleibt, wo ein Balken einen VERGLEICH zeigt (Anteil am stärksten Wert der Klasse) – Werft und
Verteidigung. Wer das verwechselt, liest einen kurzen Balken als „schwache Anlage" statt als
„fast zerstört", und deshalb sind es weiterhin zwei Formen und nicht eine über alles.

**Der Beleg, den ich bei GR-2 schlicht nicht gesucht hatte:** Die **Angriffs-Vorschau** schreibt
den Prozentwert seit jeher in die Zeile – `Kern 900.0k von 1.20M (75%)`, und bei den Bauteilen
ebenso (`weltraum_kolonie.html` Z. 14684/14722/14760). GR-3 erfindet also kein Muster, sondern
bringt das Kartenmenü auf das, was zwei Bildschirme weiter längst steht. Aufgefallen ist das erst,
als eine Sabotage-Wache mit `count == 1` abbrach, weil derselbe Ausdruck **zweimal** vorkam
(Hausregel 16 hat hier nicht nur einen Fehlgriff verhindert, sondern einen Befund geliefert).

**Drei Varianten wurden gebaut, gerendert und vorgelegt**, bevor eine ausgeliefert wurde – Sascha
hat C gewählt:

| Variante | Form | warum nicht |
|---|---|---|
| A | `.sstat` mit sprechenden Labels (KERN/SCHILD/TÜRME) | das Label wiederholt die Zeile darüber, und zwei Formen bleiben |
| B | Hausform ohne Prozent | der Prozentwert fällt ersatzlos weg |
| **C** | **Hausform + Prozent in der Zeile** | **gewählt: eine Form, keine Doppelung, nichts verloren** |

**Der Asteroid sieht nach der Umstellung byte-genau gleich aus** (Screenshot vorher/nachher
verglichen) – er hat ja schon vorher diese Form gezeichnet, jetzt nur nicht mehr mit eigenem
Markup. Das ist die Zusage der Umstellung: eine Quelle, kein sichtbarer Bruch.

**Die Wächter sind mitgezogen und dabei SCHÄRFER geworden** (Hausregel 43, nicht „passend
gemacht"): Sie messen weiter den Füllanteil, jetzt aber zusätzlich, dass die **Prozentzahl der
Zeile zum gezeichneten Balken passt** (`6b2`, `7b2`). Das ist eine Fehlerklasse, die es vor GR-3
gar nicht geben konnte – die Zahl stand ja im Balken selbst. Belegt durch eine eigene Sabotage:
Mit einer Zeile, die immer „50 %" sagt, fallen **genau** `6b2` und `7b2` und sonst nichts.

Drei Gegenproben, alle beidseitig, identische Prüflisten (27 bzw. 47 Prüfungen in jeder Richtung):

| Sabotage | fällt | Beleg |
|---|---|---|
| Zeile sagt immer 50 % | `6b2` / `7b2` | `{"zeilenProzent":[50,50,50],"balkenAnteile":[0.75,0.5,0.25]}` |
| Balken misst nicht | `6b` `6c` / `7b` | `{"gemessen":[0.5,0.5,0.5]}` |
| kein Balken | `6-vorab` `6a` / `7-vorab` `7a` | `{"anzahl":0}` |

**Die übertragbare Lehre steht nicht in der Formwahl, sondern im Ablauf:** Ich hatte das Label
nach dem ersten Screenshot von „Kern" auf „Rest" geändert – und das Bild danach nicht erneut
angesehen. Eine Änderung an genau der Eigenschaft, die eine Gestaltungsentscheidung trägt, verlangt
denselben Blick noch einmal (Regel 48, hier auf eine Anzeige statt auf eine Messung angewandt).

## GR-4 wurde gemessen und NICHT gebaut (21.08.2026)

Seit KB-20b steht im Quelltext, `kbLabelsEntflechten` müsse „zuerst transform-fest" gemacht werden,
damit das Wurmloch-Portal in den Entflechter aufgenommen werden kann – `getBBox()` liefert für das
Portal 82 statt der gezeichneten 27,9 Einheiten, weil es die `scale`-Transformation nicht kennt.
Der Satz stand da als offene Baustelle, mit der Begründung „eine Beschriftung kann das Portal
überlappen".

**Nachgemessen ist das nicht der Fall.** In allen VIER Fällen – PC und Handy, beide
Wurmloch-Systeme – überlappt **keine** der 8 bis 10 Beschriftungen das Portal. Gemessen wurde in
BILDSCHIRM-Koordinaten (`getBoundingClientRect`), also mit allen Transformationen drin: genau das,
was der Spieler sieht.

**Der Umbau bleibt deshalb ungebaut, und das ist die Entscheidung, nicht ein Aufschub.** Er hätte
eine CTM-Rechnung gekostet, deren Referenzsystem man erst wählen muss – und die naheliegende Wahl
ist gemessen falsch: `svg.getCTM()` liefert **3,315**, während Knoten und Texte **1,942** tragen
(das SVG-Wurzelelement misst zu seinem ELTERN-viewport, nicht zu seiner eigenen viewBox). Man
bräuchte also ein Referenzelement aus dem Zielsystem oder eine Rückrechnung des 21-Einheiten-
Versatzes. Das ist tragbare Komplexität – aber nicht für ein Problem, das im Bild nicht vorkommt.

**Zwei Lehren, beide über den Einzelfall hinaus:**

1. **Ein Kommentar, der eine offene Baustelle beschreibt, muss ihren Schaden BEZIFFERN, nicht
   behaupten.** „Kann überlappen" ist eine Vermutung; „überlappt in 0 von 4 gemessenen Fällen" ist
   eine Entscheidungsgrundlage. Der Kommentar trägt jetzt die Messung samt Datum – wer den Umbau
   später doch braucht (etwa weil eine neue Objektart mit eigener Skalierung dazukommt), misst
   ZUERST neu. Das ist dieselbe Familie wie KB-20i, nur in der nützlichen Richtung: Dort stand eine
   erfundene Begründung im Kommentar, hier eine ungemessene.
2. **Der Werkzeugfehler bei der Messung selbst ist der Grund, warum sie fast schiefging.** Der erste
   Selektor suchte die Portal-Gruppe als „`<g>` mit `scale` im transform" und traf einen
   Zoom-Container: Portalbreite **786 px** statt 54, und *jede* der zehn Beschriftungen wurde als
   Überlappung gemeldet. Das Ergebnis sah aus wie ein dringender Befund. Verraten hat es allein die
   Größenordnung – ein Objekt von 27,9 Sektor-Einheiten kann keine 786 px breit sein. Gegriffen
   wird jetzt `[data-map-wurmloch]`, also die BENANNTE Rolle (Regel 4/51). **Ein Messwert, der die
   erwartete Größenordnung um das Vierzehnfache verfehlt, ist ein Werkzeugfehler, kein Befund.**

## E1b: die Gegnerstärke steht endlich auf der Karte (22.08.2026)

Die zweite Hälfte der Landmarken-Etappe. **E1 hat beantwortet, WAS wo steht** (Festung, Nest,
Gegner als Abzeichen); **E1b beantwortet, WIE STARK es ist.**

**Der Befund ist am gerenderten Spiel gemessen, nicht aus dem Quelltext geschlossen.** Wer einen
Gegner über die KARTE angriff — also über den Weg, den KB-4 zum Hauptweg gemacht hat —, flog
blind:

| | Kartenweg | Galaxie-Reiter |
|---|---|---|
| Kartenmenü | ein Eintrag („Angreifen"), **keine einzige Zahl** | — |
| Erfolgschance | **fehlt** | ~5% |
| Gegner-Verteidigung | **fehlt** | 30 |
| Gegnerflotte | **fehlt** | 2 Schiffe |
| Schwachstelle | **fehlt** | „Jäger – nicht mitgeführt" |
| Enterphase | **fehlt** | „~78% · bis zu 3 Schiffe kaperbar" |
| Frachtwarnung | **fehlt** | „ohne Frachter geht die Beute verloren!" |
| Beute | **fehlt** | 40 Erz 20 Energie |
| Flugzeit / Treibstoff | ja | ja |

Sieben Auskünfte fehlten. Der Gegner war damit das einzige **Angriffsziel** ohne Infoblock im
Kartenmenü — datengetrieben gemessen: von sieben Kartenmenüs tragen vier einen (Region, Nest,
Festung, Asteroid), und ausgerechnet die drei ohne (Planet, Mond, fremder Spieler) sind die, bei
denen man keinen Verband gegen eine bekannte Stärke abwägt.

### Gebaut als EINE Rechenstelle, nicht als zweite Vorschau daneben

`npcKampfLage(npc, flotte)` ist die eine Quelle. Der Galaxie-Reiter hatte seine **fünfzehn**
Zwischenwerte inline stehen; eine Kopie davon in der Kartenvorschau wäre genau die zweite
Anzeigestelle gewesen, die beim nächsten Balance-Schritt auseinanderläuft (Checkliste Punkt 6) —
und der Kommentar an der alten Stelle sagte das selbst: *„die Vorschau und der Kampf benutzen
dieselbe Funktion"*. Beide Anzeigestellen ziehen ihre Zahlen jetzt dort heraus; verschieden ist
nur das Markup. Dasselbe gilt für `npcEnterZeileHtml` — die Enterphase stand ebenfalls inline und
fehlte der Karte deshalb vollständig.

**Der Beleg dafür steht im Test und ist die zentrale Prüfung**: dieselbe Flotte, derselbe Gegner,
BEIDE Wege — die genannte Erfolgschance muss zeichengleich sein (gemessen 71% und 71%, mit
Bombern 86% und 86%).

**Und die Gegenprobe hat nebenbei belegt, dass der Umbau die Zahl nicht verschoben hat**: Am Stand
vor E1b meldet dieselbe Prüfung `{"karte":null,"galaxieReiter":71}` — der Galaxie-Reiter nennt vor
wie nach dem Umbau 71%. Das ist ein Anker, den der Umbau nicht berühren konnte (Regel 62).

### Vier Entscheidungen, die man beim Anfassen kennen muss

- **Der Infoblock im Kartenmenü zeigt NUR, was ohne gewählte Flotte gilt** (Stufe, Verteidigung,
  feindliche Flotte, Schwachstelle, Beute). Alles, was an der eigenen Auswahl hängt —
  Erfolgschance, Konter, Treibstoff, Fracht — steht eine Ebene weiter in der Flottenwahl und zieht
  dort live mit; im Menü wäre es auf den Stand beim Öffnen eingefroren, also genau die Sorte Zahl,
  die später nicht mehr stimmt. `openKarteMenu` hatte den `infoHtml`-Parameter längst, nur nutzte
  ihn der Gegner nicht.
- **Die Vorschau MISST ihre Aussagen, statt sie zu benennen** (Regel 61): Die Schwachstellen-Zeile
  sagt, ob die passende Klasse wirklich im Verband steht, und die Frachtzeile warnt nur, wenn es
  wirklich keinen Laderaum gibt.
- **`ti-gift` gibt es im Subset-Font nicht.** `check-icons.js` hat es vor dem Commit gefangen —
  genau der Fehlertyp, für den das Skript nach dem `ti-gift`-Bug (v8.77.1) gebaut wurde. Ersetzt
  durch `ti-diamond`, statt den Font zu vergrößern.
- **Das Konzept nannte `state.npcIntel` — dieses Feld gibt es nicht** (gemessen: 0 Treffer). Die
  Aufklärung heißt `state.spyIntel` und betrifft ausgespähte SPIELER, nicht NPCs; die
  Gegnerstärke kommt aus `npcEffectiveDefense`. Ein Konzept beschreibt die Absicht, nicht den Code
  (Regel 4/41).

### Ein Bestandstest ist mitgezogen worden — und dabei SCHÄRFER geworden

`test_vorschau_schwaeche` 3b/3c suchte die Vorschau-Rechnung über ihre Variablennamen in
`renderGalaxy` (`powerRohPreview`, `schwaecheGenutzt`, `attackFleet`). Seit E1b liegt sie in
`npcKampfLage`; der Ausschnitt fand seine Marken nicht mehr und meldete `{"a":-1,"b":-1}` auf
völlig korrektem Code — also eine festgenagelte FUNDSTELLE statt der Regel (Regel 3).

Die bequeme Lösung wäre gewesen, die neuen Namen einzusetzen. Geprüft wird stattdessen die
Eigenschaft, und zwar in **beide** Richtungen: Die Vorschau bildet ihre Basis mit
`weaknessPhasenBasis` (3b/3c) **und** es gibt sie nur EINMAL (3b2). Eine zweite Vorschau, die die
Basis anders bildet, fällt damit auf — vorher wäre sie unbemerkt geblieben, solange die alte
Stelle noch stimmte (Regel 43). Beidseitig gegengeprüft an einer Kopie mit eingebauter
Zweitrechnung: `{"stellen":2}`, bei 20 Prüfungen in allen drei Läufen.

### Zwei Fixture-Fallen, beide beim Bauen aufgetreten und beide dokumentiert

1. **`storageGet` kehrt bei 404 ausdrücklich ZURÜCK**, statt auf localStorage zurückzufallen. Wer
   alle `/api/`-Aufrufe pauschal auf 404 legt — was mehrere Kartentests tun, weil sie nur Abzeichen
   messen —, bootet ein **leeres** Spiel: Die Flottenwahl meldete „An diesem Standort stehen keine
   passenden Schiffe", und jede Vorschau-Prüfung wäre aus dem falschen Grund grün gewesen
   (Regel 28). Der Spielstand kommt deshalb über die geroutete Storage-Antwort.
2. **`capFighterSelection` kappt Jäger UND Bomber auf die Trägerkapazität, und
   `deployableFighters` bedient dabei ZUERST die Jäger.** Der erste Entwurf hatte 10 Träger
   (= 60 Plätze) bei 60 Jägern — für die 18 Bomber blieb nichts, sie flogen gar nicht mit, und die
   Schwachstellen-Prüfungen fielen auf korrektem Code durch. Die Vorabprüfung `5-hangar` belegt
   seither MESSEND, dass der zweite Verband wirklich größer ist.

### Und der Deckel, den man beim Messen einer Chance immer trifft

`5c` („die Erfolgschance ist eine andere") fiel zunächst mit `{"ohneBomber":95,"mitBomber":95}`.
Kein Fehler: `battleWinChance` deckelt bei 95%, und der Messverband stand mit 3,9k Angriffskraft
gegen 600 Verteidigung in **beiden** Läufen am Anschlag — gemessen wurde also der Deckel statt der
Bomber-Wirkung (Regel 7). Gewählt ist seither die **Solmark-Kriegsflotte** (2200 Verteidigung,
Schwachstelle Bomber, keine Forschungssperre — sonst fände Abschnitt 4 sie nicht in der NPC-Liste
des Galaxie-Reiters). `5-deckel` hält die Bedingung als eigene Vorabprüfung fest: **Wer eine
gedeckelte Größe misst, prüft zuerst, dass die Messung nicht am Anschlag steht.**

Wächter: `tests/test_gegnerlage.js` (30 Prüfungen). Gegenprobe gegen `origin/main` per
`KEPLER_SPIELDATEI`: **25 rot bei identischen 30 Prüfnamen** (per `diff` verglichen, nicht gezählt
— Regel 60).

## E1b Teil 2: die Abzeichenzeile ist antippbar — und die Suche zeigt KEINE Landmarken mehr (22.08.2026)

**Zwei Änderungen, die gegenläufig aussehen und dieselbe Absicht haben:** Die Karte soll verraten,
*wo* etwas los ist — aber nicht als Liste, die man abarbeitet. Auftrag Sascha: „Die Suche soll nur
Planeten zeigen keine Gegner das wäre zu einfach man soll schon bisschen suchen auf der Karte."

### Der Befund, am gerenderten Spiel gemessen

Die aggregierte Abzeichenzeile der Regionsübersicht nannte das betroffene System **nur im
`<title>`** — ein Hover-Tooltip, den es am Handy nicht gibt. Ein Tipp darauf öffnete die
Sektoransicht, weil der Elternknoten `[data-sektor]` den Klick bekam.

| | vor der Etappe | danach |
|---|---|---|
| Trefferfläche Handy | 36 px² (6×6) | **126 px²** (14×9) |
| Trefferfläche PC | 169 px² (13×13) | **731 px²** (34×21) |
| `elementFromPoint` auf der Mitte | Regionsknoten | **die Zeile selbst** |
| Tipp | öffnet die Sektoransicht | öffnet das Hinweis-Menü |

**Der schärfste Fall ist gemessen `kepler`: 15 Systeme, EIN Abzeichen, 10 betroffene Systeme.**
Wer das 🎯 sah, musste sie einzeln durchklicken. `rand` ist die andere Richtung: 12 Systeme, eines
betroffen — dort ist das Suchen am teuersten.

### Vier Entscheidungen beim Bau

- **Das Menü liest aus derselben Quelle wie der Renderer** (`sektorMitglieder()` +
  `karteSystemBadges()`). Nichts wandert über `data`-Attribute ins DOM, wo es beim nächsten
  Kartenaufbau veralten könnte — dieselbe Überlegung wie bei `npcKampfLage` einen Tag vorher.
- **Das Trefferfeld liegt UNTER der Zeile im freien Bereich des Knotens** (Name +0, Systeme +16,
  Eigenschaft +27, Abzeichen +44). Es kapert damit keine andere Beschriftung — und der Handler
  ruft `stopPropagation`, sonst gewinnt der Regionsknoten darunter.
- **Jeder Eintrag springt in SEIN System**, nicht nur in die Region. Das ist der eigentliche
  Mehrwert: Die Region öffnet der Knoten daneben ohnehin.
- **`.kmenu` hat einen Höhendeckel bekommen** (`max-height:min(60vh, 420px)`, `overflow-y:auto`).
  Bei zehn Einträgen ragte es sonst unten aus dem Bild; bei den bisherigen Menüs mit zwei bis
  fünf Einträgen ändert sich nichts.

### Die Landmarken sind aus der Kartensuche RAUS — eine Spieldesign-Entscheidung

E1 hatte Festungen, Nester und Gegner am 19.08. in `performSectorSearch` aufgenommen. Sie sind
seit dem 22.08. wieder draußen: **wer sie finden will, sucht auf der Karte.** Wer das zurückdreht,
dreht eine Entscheidung zurück, kein Versehen — der Kommentar an der Stelle sagt das mit Saschas
Wortlaut, damit es beim nächsten Lesen nicht wie eine Lücke aussieht.

**Der Weg dorthin ist die eigentliche Lehre.** Mein erster Vorschlag war das Gegenteil: Gemessen
fand die Suche Festungen und Nester über generische Wörter („festung" → 1 Treffer, „nest" → 1),
bei Gegnern aber „Keine Treffer" — es gibt kein generisches Wort für NPCs. Ich hatte das als
Lücke gemeldet und „gegner"/„npc"/„flotte" ergänzt (gemessen 0 → 8 Treffer). Sascha hat es
abgelehnt und dabei die Richtung umgedreht. **Eine gemessene Asymmetrie ist nicht automatisch ein
Fehler** — sie kann auch die Absicht sein, die noch niemand aufgeschrieben hat. Vor dem
Vereinheitlichen lohnt die Frage, ob die Ungleichheit gewollt ist.

### Zwei Hilfetexte mitgezogen (Checkliste Punkt 6)

Beide standen im selben Abschnitt „Landmarken: was in einem System steht":

1. „Suchen kann man sie ebenfalls: Das Suchfeld über der Karte findet jetzt auch *Sternenfeste*…"
   — war nach der Entfernung eine **Falschaussage** und sagt jetzt ausdrücklich das Gegenteil.
2. „der Tooltip nennt das System" — nicht falsch, aber **unvollständig**, seit die Zeile antippbar
   ist. Sie nennt jetzt beide Wege und sagt dazu, dass der Tooltip die PC-Zugabe ist.

### Die Grenze, die bleibt und benannt gehört

**Am Handy ist die Fläche mit 14×9 px weiterhin kein Fingerziel** (Empfehlung 44×44 = 1936 px²).
Größer geht nur, wenn das Trefferfeld den halben Regionsknoten kapert — dann öffnete ein Tipp auf
die Region nicht mehr die Sektoransicht. Die Ursache liegt tiefer: Auf der Übersicht sind am Handy
**alle** Beschriftungen 6–9 px hoch, also kaum lesbar. Das ist eine eigene Etappe wert und steht
hier, damit es nicht als übersehen gilt.

**Die Sektoransicht ist bewusst nicht angefasst.** Dort trägt jedes Abzeichen ebenfalls nur einen
Hover-Tooltip — aber ein Tipp auf den Systemknoten daneben öffnet das System und zeigt alles. Ein
zweites Trefferfeld über einem bereits klickbaren Knoten wäre genau die Kollision aus KB-11.

### Wächter

`tests/test_regionshinweise.js` (15 Prüfungen). **Der Kern ist das PAAR in Abschnitt 3:** Die Zeile
öffnet das Menü UND die Fläche daneben öffnet weiterhin die Sektoransicht. Die erste Hälfte allein
wäre auch dann grün, wenn der normale Regionsklick dabei kaputtgegangen ist — genau die Kollision
aus Regel 53. Gemessen wird über `elementFromPoint` auf die MITTE, nicht über Sichtbarkeit; ein
Sichtbarkeits-Test hätte den Anlassfall nie gefunden (KB-11).

Gegenprobe gegen `origin/main`: **12 von 15 fallen, bei identischen Prüfnamen** — und `3b` bleibt
grün, weil sie ja gerade zusagt, dass sich am Regionsklick nichts geändert hat.

`test_landmarken` 1c und 5 sind mitgezogen und dabei **schärfer** geworden (Regel 43): Aus „die
Suche findet die Festung" wurde ein PAAR — ein Systemname MUSS eine Trefferzeile liefern, die
Namen von Festung, Nest und Gegner KEINE. Ohne die erste Hälfte wäre „findet keine Landmarke" auch
bei einer völlig kaputten Suche grün (Regel 28). Beidseitig gegengeprüft: 20 identische Prüfnamen,
am alten Stand fallen genau die zwei.

### Zwei eigene Werkzeugfehler beim Bau des Wächters

1. **Eine Prüfung suchte das CSS im `<script>`-Block.** `.kmenu` steht im `<style>`; der Test las
   `JS` statt der ganzen Datei und meldete den Höhendeckel als fehlend, obwohl er dastand. Seitdem
   liest er `ROH` für CSS-Fragen — und hat für beide Ausschnitte einen eigenen `*-anker`, damit
   ein leerer Ausschnitt auffällt statt vacuous grün zu sein (Regel 6).
2. **Ein Muster kodierte die Klammer-Reihenfolge** (`-treffer']).forEach` statt `-treffer]').forEach`)
   und fiel auf korrektem Code durch. Ersetzt durch einen auf den Verdrahtungsblock **gescopten**
   Ausschnitt (Regel 39): Ein `stopPropagation` irgendwo sonst in der Datei belegt hier nichts.

## KB-21: die Regionsübersicht war am Handy nicht lesbar (22.08.2026)

Der offene Rest aus E1b Teil 2 — dort stand als benannte Grenze: „Am Handy sind **alle**
Beschriftungen der Übersicht 6–9 px hoch, also kaum lesbar. Das ist eine eigene Etappe wert."

**Die Ursache ist eine Einheit, nicht eine Zahl.** Die vier Beschriftungen standen in
SVG-**Nutzerkoordinaten** fest (15 / 10,5 / 10 / 13), während die Skala am Formfaktor hängt.
Gemessen:

| | Kasten | Skala | Regionsname | Metazeile |
|---|---|---|---|---|
| PC 1600×1040 | 1088 px | 0,785 | 11,8 px | 7,9 px |
| Handy 390×844 | 348 px | 0,313 | **4,7 px** | **3,1 px** |

Dieselbe Zeichnung, ein Drittel der Größe. Und der Konturstrich (`paint-order:stroke`,
3 Nutzereinheiten) ist bei dieser Schriftgröße fast so breit wie die Glyphen — die drei Zeilen in
27 Einheiten Abstand fraßen einander an. Gezählt über **alle** Textpaare der acht Regionen:
**8 Überlappungen** bei 390×844 und **14** bei 360×640.

### Zwei Änderungen, und die zweite ist die wirksamere

- **`KB_UEBERSICHT_MIN_PX` = 9** ist die eine benannte Größe, aus der Schriftgrößen,
  Zeilenabstände, Konturstriche und das Trefferfeld der Abzeichenzeile abgeleitet werden
  (Regel 50). Der Faktor kommt aus der **gemessenen** Skala (`uRect.width / (x1-x0)`) und ist
  nach unten **bei 1 gedeckelt**: Am PC ist er gerechnet 0,76, dort bleibt also alles byte-genau
  wie vorher. Eine Schrift, die wächst, während ihr Zeilenabstand steht, klebt zusammen — deshalb
  hängt beides an derselben Zahl.
- **Am schmalen Kasten fällt die Zeile „N Systeme" weg** und wandert in `<title>` und
  `aria-label`. Sie ist die einzige der drei, die der Spieler auch abzählen kann (die Punkte
  stehen daneben); die Eigenschaft dagegen ist eine Spielmechanik und bleibt — sie war Gegenstand
  einer eigenen Etappe mit der ausdrücklichen Begründung „ein Bonus, den nur der Quelltext kennt,
  gibt es für den Spieler nicht".

Gemessen danach, an vier Fensterbreiten:

| | Regionsname | Metazeile | Überlappungen |
|---|---|---|---|
| Handy 390×844 | 4,7 → **9,0 px** | 3,1 → **6,0 px** | 8 → **2** |
| Handy 360×640 | — | — | 14 → **3** |
| PC 1600×1040 | 11,8 (unverändert) | 7,9 (unverändert) | 8 (unverändert) |

### Der Block-Schieber wurde gebaut, gemessen und WIEDER ENTFERNT

Der naheliegende dritte Schritt war ein Entflechter für die Beschriftungsblöcke — dasselbe Muster
wie `kbLabelsEntflechten` (KB-16) und `kbMarkerFrei` (KB-13), nur eine Ebene größer: den ganzen
Block (Name, Eigenschaft, Abzeichen) verschieben, gedeckelt, erst senkrecht und dann seitlich.
Er war fertig, lief und **brachte gemessen 3 auf 2 an genau einer Fensterbreite und sonst nichts.**

**Der Grund ist geometrisch und deshalb übertragbar: Ein Schieber löst gar nichts, wenn die zu
trennenden Objekte zusammen breiter sind als ihr Abstand.** Der Solmark-Block ist bei dieser
Schriftgröße 322 Sektor-Einheiten breit, der Obsidian-Block 244, und ihre Regionen liegen rund 200
Einheiten auseinander — 566 gegen 200. Es gibt keine Position, in der sie sich nicht überlappen;
der Deckel von 50 Einheiten war dabei nicht einmal die bindende Schranke. Was hier wirkt, sind
kürzere **Namen** oder mehr Abstand, nicht mehr Rechnung.

Sechzig Zeilen für eine Überlappung an einer Breite sind keine Behebung. Der Schieber ist deshalb
raus, und die Begründung steht als Kommentar an `KB_UEBERSICHT_MIN_PX` — wer die Zahl anhebt,
liest dort zuerst, warum Schieben die Antwort nicht ist.

**Die verbleibende Solmark/Obsidian-Überlappung steht NAMENTLICH im Wächter** (`4c`), nicht
pauschal ausgeblendet — dieselbe Behandlung wie „Deine Basis"/Rhea in KB-16. Jede andere fällt auf.

### Drei Fehler am eigenen Wächter, jeder eine bekannte Familie

1. **`getComputedStyle(text).fontSize` liefert an einem SVG-Text NUTZERkoordinaten, nicht
   Bildschirmpixel** — also genau die Größe, um die es in dieser Etappe geht, in der falschen
   Einheit. Die erste Fassung verglich 15 gegen eine Pixel-Schranke und fiel auf korrektem Code
   durch. Die effektive Größe ist erst `fontSize × Skala`.
2. **Der Namensfilter traf die Abzeichenzeile mit.** Sie setzt nur `font-size` und **erbt**
   `system-ui` vom SVG; ein Filter auf die Schriftfamilie meldete deshalb am PC 13 px statt der 15
   des Namens (Regel 51: über die benannte Rolle greifen, nie über einen Wert, den auch Nachbarn
   tragen). Gegriffen wird jetzt über `data-sektor-hinweise`.
3. **Die Tipp-Prüfung ließ `null` als Bestehen durchgehen** — und `null` heißt, dass
   `elementFromPoint` gar nichts getroffen hat, weil die Zeile außerhalb des Fensters lag. Der
   Kommentar daneben behauptete sogar, es werde vorher hereingescrollt; der Code tat es nicht
   (Regel 28, dazu ein Kommentar, der eine ungemessene Begründung führt).

**Und die Kollisionszählung war aus dem falschen Grund grün.** Sie zählte zuerst nur Paare
zwischen **verschiedenen** Regionen — und die waren am alten Stand genauso 2 wie heute. Der ganze
gemessene Gewinn liegt **innerhalb** der Regionen, wo die drei Zeilen einander anfraßen. Eine
Prüfung, die den Gegenstand ihrer Etappe nicht misst, ist keine, auch wenn sie plausibel aussieht.

Wächter: `tests/test_uebersicht_schrift.js` (14 Prüfungen). Gegenprobe gegen `origin/main`:
**9 rot bei identischer Prüfliste** (per `diff` über die reinen Prüfnamen verglichen, nicht
gezählt — Regel 60).

## Event-Schiffe tragen Frachtraum — und der Erzgreifer wirkt endlich (28.08.2026)

Entscheidung Sascha, aus zwei vorgelegten Wegen: **Event-Schiffen Frachtraum geben** (die Alternative
wäre gewesen, das Modul umzuwidmen).

**Der Befund stand seit dem 21.08.2026 als Nebenbefund im Klassen-Set-Abschnitt und war gemessen:**
`ev_erzgreifer` („Erzgreifer-Ausleger", `cargo`, `base:0.25`, Klasse `eventflotte`) bewirkte
**nichts**. Der `cargo`-Kanal wurde ausschließlich als `shipModuleBonusFor('frachter', 'cargo')`
gelesen, und alle drei Frachtschiffe gehören zur Klasse `frachter` — Event-Schiffe hatten überhaupt
keinen Frachtraum, auf den ein Prozentsatz hätte wirken können. Seine Beschreibung versprach
ausdrücklich „erhöht die Frachtkapazität aller Event-Schiffe deutlich".

### Vier Änderungen, jede aus einer Messung

- **`CARGO_PER_SHIP` trägt drei Event-Schiffe** (Enterschiff, Phantomschiff, Riftwächter, je 80).
  Die Zahl ist begründet, nicht gegriffen: **Vier davon ersetzen gut einen Kleinen Frachter**
  (320 zu 300). Damit bleibt die dokumentierte Regel „wer Beute heimbringen will, nimmt Frachter
  mit" unangetastet — eine reine Event-Flotte geht aber nicht mehr mit leeren Händen zurück.
  Bewusst **nicht** nach Angriffswert gestaffelt: Frachtraum hängt am Rumpf, nicht an der Bewaffnung.
- **`fleetCargoCapacity` liest den Bonus je KLASSE** statt fest über `'frachter'`. Das ist keine
  Erfindung, sondern die Angleichung an das Hausmuster: `speed`, `fuel`, `hull` und `shield` tun
  das an ihren vier Verbrauchsstellen längst (`cls ? shipModuleBonusFor(cls, …) : 0`), `cargo` war
  der einzige Kanal mit fest verdrahteter Klasse.
- **`mineLaderaum`: der Bunker des Schürfschiffs bekommt den `eventflotte`-Bonus.** Das Schürfschiff
  IST ein Event-Schiff, und sein Frachtraum ist dieser Bunker (`MINE_CARGO_JE_SCHIFF` = 400).
- **`maybeAutoReinforce` übergeht kein Kampfschiff mehr** — siehe der eigene Abschnitt darunter.

### Zwei Schiffe bleiben bewusst außen vor, jedes aus einem gemessenen Grund

- **Das Schürfschiff steht NICHT in `CARGO_PER_SHIP`.** `mineLaderaum()` addiert Bunker **und**
  `fleetCargoCapacity(flotte)`; ein Eintrag dort zählte in genau dieser Summe ein zweites Mal.
  Gemessen an einer Kopie mit Eintrag: **8.000 statt 4.000** für zehn Schürfschiffe.
- **Das Gesandtenschiff bekommt keinen Frachtraum.** Es steht weder in `ATTACK_SHIP_KEYS` noch in
  `MINE_SHIP_KEYS` — seine Wirkung ist passiv („+15% Ruf-Zuwachs, solange mind. eins in der Flotte
  steht"). Ein Frachtraum an ihm wäre toter Code (Regel 59). Die Modulbeschreibung sagt das jetzt
  ausdrücklich, statt weiter pauschal „aller Event-Schiffe" zu behaupten.

### Der Rückfall in `fleetCargoCapacity` ist kein Schönheitsfehler

`shipClassKeyFor(k) || 'frachter'` — der zweite Teil verhindert eine **stille Verschlechterung**:
Der **Urmaterie-Koloss gehört gemessen zu KEINER Modulklasse**, bekam über die alte pauschale Zeile
aber den Frachter-Cargo-Bonus. Ohne den Rückfall hätte dieser Umbau ihm den weggenommen — genau die
unbestellte Zweitänderung aus dem Schiffskosten-Nachtrag. Die Regel lautet deshalb: *Ein Schiff, das
Frachtraum trägt und keiner Klasse angehört, wird beim Frachtraum wie ein Frachter behandelt.*
`test_eventfracht` 4-vorab misst die Klassenlosigkeit, bevor 4a die Wirkung prüft.

### Der Bestandsfehler, der dabei herausfiel: die automatische Verstärkung übersprang den Koloss

`maybeAutoReinforce()` verlegt bei einem erkannten Überfall die stärksten Kampfschiffe einer anderen
Kolonie. Sie sprang über **jedes** Schiff in `CARGO_SHIP_KEYS` — mit der Begründung im Kommentar,
Frachter hätten „Angriffswert 0". Das war deckungsgleich, solange jedes Schiff mit Frachtraum
wirklich atk 0 hatte. **Seit dem Urmaterie-Koloss (21.08.2026, 250 Angriff bei 2.000 Frachtraum)
stimmt es nicht mehr:** Eines der stärksten Schiffe des Spiels wurde von der automatischen
Verteidigung stillschweigend ausgeschlossen.

Die Zeile prüft jetzt dieselbe datengetriebene Form wie `KAMPF_SHIP_KEYS`
(`CARGO_SHIP_KEYS.includes(k) && !schiffTraegtAngriff(k)`). **Die Lehre ist dieselbe wie bei
`KAMPF_SHIP_KEYS` selbst, nur eine Anzeigestelle weiter:** Als der Koloss gebaut wurde, ist die eine
Stelle mitgezogen worden und die zweite nicht — Punkt 6 der Checkliste, diesmal nicht an einem Text,
sondern an einer zweiten Filterregel mit derselben Absicht.

**Nachgemessen, weil es beim Bauen offen blieb: Er wirkt auch auf Expeditionen.**
`EXPEDITION_SHIP_KEYS` ist `['forscher','spaeher'].concat(ATTACK_SHIP_KEYS)`, die drei Event-Schiffe
sind dort also wählbar, und die Fundauflösung rechnet `EXPEDITION_BASE_CARGO +
fleetCargoCapacity(escortFleet)`. Für ein Modul, das ausschließlich AUF Expeditionen zu finden ist,
ist das die passende Wirkung — und es ist gemessen, nicht angenommen.

### Wächter

`tests/test_eventfracht.js` (26 Prüfungen, fünf Gegenproben). Er misst die **Wirkung** und fährt
jede Aussage als **PAAR** — zwei Läufe, identisch bis auf einen Punkt:

| | |
|---|---|
| **3a** | der Erzgreifer erhöht den Frachtraum (800 → 1.000) |
| **3b/3c** | und er wirkt **nicht** auf Frachter, das Frachter-Modul **nicht** auf Event-Schiffe |
| **4a** | der Koloss behält seinen Bonus (10.000 → 12.000) |
| **5c/5d** | der Bunker steigt (4.000 → 5.000), ohne Doppelzählung |
| **6b/6c** | das Gesandtenschiff fliegt wirklich nirgends mit — die drei anderen schon |

Der Schneider ist **transitiv statt namensbasiert**: Was zur Laufzeit fehlt, wird aus derselben Datei
nachgeschnitten, und der Nachlade-Versuch umschließt **Aufbau UND Aufruf** — eine geschnittene
Funktion wirft oft erst beim Aufruf (die Lehre aus `4-bau3` in `test_schiffsmodul_paritaet`). Die
Stücke werden dabei in der Reihenfolge der **Originaldatei** zusammengesetzt: `CARGO_SHIP_KEYS` ist
`Object.keys(CARGO_PER_SHIP)` und wird beim Laden ausgewertet — stünde es davor, fände es seine
Quelle in der temporalen Todeszone (Regel 38 im Kleinen).

Gegenproben, alle mit 26 Prüfungen in beide Richtungen: Stand vor der Etappe → 11 rot; Rückfall
entfernt → `4a`; `cargo` wieder pauschal → `3a`/`3c`; Schürfschiff in `CARGO_PER_SHIP` →
`5-vorab`/`5a`/`5d`; Auto-Verstärkung zurück → `7a`.

### Ein Bestandstest hielt die alte SCHREIBWEISE fest

`test_flotte_v8375` 1 verlangte wörtlich `shipModuleBonusFor('frachter', 'cargo')` und fiel auf
völlig korrektem Code durch — eine Momentaufnahme statt der Regel (Regel 3), und zwar zwei Zeilen
unter einem Kommentar, der genau diese Lehre für die Zeile davor beschreibt. Geprüft wird jetzt die
Eigenschaft („der Modul-Bonus steht neben dem Markenbonus"), **plus eine neue Zeile**, die den
Zugewinn festhält: Er muss je Klasse gelesen werden. Eine Rückkehr zur festen Verdrahtung fällt
damit auf — vorher wäre sie unbemerkt geblieben (Regel 43: stärker, nicht passend).

**Zwei eigene Werkzeugfehler dabei, beide sofort gefangen:**
- Mein erstes Muster `shipModuleBonusFor\([^)]*'cargo'\)` scheiterte am **inneren Funktionsaufruf**
  im Argument: `[^)]*` bricht an dessen schließender Klammer ab. Gelesen wird jetzt zeilenweise —
  ein Muster, das eine Schreibweise kodiert, war ja gerade der Anlass.
- Der Test schneidet `fleetCargoCapacity` aus und **führt sie aus**; `shipClassKeyFor` fehlte in
  seiner Bausteinliste, und der Lauf starb mittendrin statt eine benannte Prüfung zu melden. Die
  Funktion wird jetzt mitgegeben (nicht durch etwas Ähnliches ersetzt, Regel 36), und `1-lauf`
  fängt den Fehlschlag als eigene Prüfung ab (Regel 34).

## Nächstes Projekt: Beute, Sets und Instanzen (Auftrag 18.08.2026)

Auftrag Sascha: „Findbare Module die zusammen set Bonus geben sowie Dungeons und raids mit
Belohnungen die es nur dort gibt vielleicht macht es Sinn eine item Struktur einzubauen."
Ausgearbeitet in **`docs/beute-und-instanzen-konzept.md`**.

**Verhältnis zu den Asteroidenfestungen (Abschnitt darüber):** Die beiden Projekte treffen sich
bei Teil C (Instanzen). Die Festungen bringen angreifbare PvE-Ziele auf die Karte und haben mit
dem Hort bereits eine eigene Beutequelle; dieses Konzept liefert dazu die Frage, WAS dort fällt
und wie es sich von regulärer Beute unterscheidet (Herkunfts-Schloss). Wer an einem der beiden
arbeitet, liest den jeweils anderen Abschnitt mit – sonst entstehen zwei Beutetische nebeneinander.

**Der Satz, der hier stehen muss, damit ihn niemand übersieht: Ein großer Teil davon ist bereits
gebaut.** Wer das nicht nachmisst, stellt ein zweites System neben ein vorhandenes — genau der
Fehler, den dieses Projekt bei den Bonusgruppen schon einmal gemacht hat. Gemessen am 18.08.2026:

- **Set-Boni gibt es.** `MODULE_SET_DEFS` führt neun Sets: vier benannte (alles oder nichts) und
  fünf **Boss-Sets** mit je vier Teilen und gestaffelten Stufen (2/3/4 Teile, additiv). Gerechnet
  in `setBonusAt(planetKey, effect)`, additiv, unter denselben nachgelagerten Deckeln wie alles
  andere. Dazu Sockel (2 je Standort, `SOCKET_POOL` bewusst ohne `raidloss`/`atk` — client-only,
  keine PvP-Parität nötig).
- **„Nur hier zu bekommen" gibt es als Mechanik.** Das Feld `quelle` an einem Modul ist ein
  Herkunfts-Schloss mit vier Werten (`normal`/`abgrund`/`boss`/`unikat`); `fundPool` filtert
  danach, und es hält Boss-Set-Teile und Unikate aus **jedem** regulären Fundtopf, aus **beiden**
  Schmieden und aus der **Modulbörse** heraus. Vergeben wird ausschließlich über
  `grantBossSetModule()` bzw. `grantUnikatModul()`. Wer neue exklusive Beute baut, benutzt dieses
  Schloss — es ist erprobt und braucht kein neues System.
- **Raids gibt es.** `ALLIANCE_RAID_BOSSE` führt fünf Gegner mit eigenen KAMPFREGELN, nicht nur
  anderen Zahlen: Schwäche (Schiffsklasse), Malus ohne sie (0,75–0,80), eigener Verlust- und
  Beutefaktor, Beute-Schwerpunkt. Jeder lässt sein eigenes Vier-Teile-Set fallen.
- **Ein Dungeon gibt es — er heißt Abgrund.** Tiefenläufe, Mutatoren, Wächter, zwölf Reliquien mit
  gestaffelten Satz-Boni (`ABGRUND_RELIKT_SATZ`), eigene Währungen, eigene Werkstatt, eigene Rolle.

**Die vier gemessenen Lücken** (das ist das eigentliche Projekt):

1. ~~`SHIP_MODULE_DEFS` (44 Module) hat **keinen einzigen** Set-Bonus — 0 Treffer.~~
   **ERLEDIGT am 21.08.2026 mit v8.607.0** (`SHIP_MODULE_SET_DEFS`, acht Klassen-Sets, Wächter
   `tests/test_schiffsmodul_sets.js` — eigener Abschnitt weiter unten). Der Satz stand hier noch
   als offene Lücke, während die Etappe längst live war, und hat mich am 22.08.2026 dazu
   gebracht, sie ein zweites Mal vorzuschlagen — **eine Doku-Zeile ist kein Messwert**
   (Regel 10/69): Vor jedem Vorschlag aus einer solchen Liste einmal `grep` gegen die Spieldatei.
2. Alle 20 Boss-Set-Teile fallen **ausschließlich** nach einer Allianz-Raid-Welle. Solo ist keines
   davon je erreichbar — die größte inhaltliche Sperre im Modulsystem.
3. Keine gestufte Schwierigkeit mit **eigenem** Beutetisch: Ein Boss lässt dieselben Teile fallen,
   egal wie stark die Allianz ist; die Abgrund-Reliquien enden bei Tiefe 120.
4. **Fünf parallele Gegenstands-Systeme** (`MODULE_DEFS` 182, `SHIP_MODULE_DEFS` 44, `ITEM_DEFS` 30,
   `RARE_ITEMS` 6, `ABGRUND_RELIKTE` 12) ohne gemeinsame Auskunft.

**Zur „Item-Struktur" die Entscheidung, die im Konzept begründet ist: KEIN Umbau der Speicherform.**
Der Modul-Schlüssel (`typ:seltenheit:…`) ist tragend; der Kommentar an den Sockeln hält fest, dass
schon ein fünftes Schlüssel-Segment „genau die Fehlerklasse aus dem Schmelze-Bugfix" gewesen wäre.
Vorgeschlagen ist stattdessen eine **abgeleitete Beschreibungs-Schicht** über die fünf Listen
(key/name/icon/art/seltenheit/herkunft/desc) — sie liest sie, statt eine sechste Liste zu führen,
und trägt zugleich die automatische `desc`-Prüfung, die Hausregel 7 bisher von Hand absichert.
## Schiffskosten: die Mengenskalierung ist raus, und wonach die Preise jetzt gesetzt sind (18.08.2026)

Auftrag Sascha: „Es ist doch 'n bisschen blöd, dass die Schlachtschiffe beziehungsweise alle
Schiffe, dass das ja weiterproduzierten immer teurer wird. Nimm das wieder raus. Passe aber alle
alle Kosten für alle Schiffe neu an."

**Entfernt ist der Mengenfaktor an ZWEI Stellen**, nicht nur an der offensichtlichen:
`scaledShipCost` (`factor = nth <= 250 ? 1 + nth*0.004 : 2*Math.pow(1.002, nth-250)`) und
`tiefenschiffKosten` (`basis * (n||1) * (1 + 0.004*(n-1))`). Die zweite war die schlimmere: Weil
die Werft `costFn(startCount+i)` **je Stück** aufruft, multiplizierte das `basis*n` den Stückpreis
mit dem Bestand — das 25. Lotsenboot kostete 19.161 statt 750. Wer nur die erste Stelle sucht,
findet sie nicht (Regel 6, zweite Anzeigestelle).

**Was der Bestand weiterhin entscheidet:** die Tier-2-Komponenten (`SHIP_T2_KOMPONENTEN`, „ab dem
250. Kreuzer kosten sie zusätzlich Nanolegierungen"). Das ist A2 der Wirtschaftsreform und war nie
gemeint — ein Ersetzer, der beides in einem Zug wegräumt, nimmt still eine ganze Etappe mit.

### Wonach die 36 neuen Preise gesetzt sind — und der Fehler, den das erst sichtbar gemacht hat

Der Massstab ist **T1-Äquivalent je Angriffspunkt**, und beide Hälften kommen aus Tabellen des
Spiels, nicht aus dem Gefühl: Der Rohstoffwert wird **rekursiv aus `TIER2_DEFS`** entwickelt (die
echten Fabrikrezepte — wer ein Rezept ändert, verschiebt damit automatisch die Erwartung), der
Angriffswert ist `COUNTER_ROLE_ATK`. Gemessen: **Spreizung 91,1× → 22,1×.**

Der Rest ist bewusst nicht 1×: Grosskampfschiffe bündeln Wirkung in EINEM Flottenplatz, und
Flottenplätze sind knapp. Ein Unikat wie der Mondzerstörer (`maxOwned:1`) darf teuer sein.

**Zwei meiner eigenen 36 Zahlen waren falsch, und BEIDE fielen erst beim Nachmessen auf** — nicht
beim Lesen des Codes, nicht in zwölf betroffenen Bestandstests:

- **Hyperjäger: 210 Nanolegierungen für 30 Angriff**, während die **Nanoklinge** daneben 140 für
  55 Angriff kostet. Strikt dominiert — 1,5× der Preis für 55 % der Wirkung. Ein Schiff, das
  niemand je baut, ist so tot wie ein nicht gebautes. Bezeichnend: Der ALTE Wert (70) war
  richtig, meine Verdreifachung war der Fehler.
- **Bergungsfrachter: 180/75/35** — faktisch derselbe Preis wie der Grosse Frachter (391 gegen
  373 T1-Äquivalent), aber doppelter Frachtraum UND **doppeltes Punktegewicht** (80 gegen 40).
  Damit war er die billigste Punktequelle des Spiels, also eine Ranglisten-Verzerrung — genau die
  Sorte Fehler, die dieses Projekt nicht rückwirkend korrigieren kann.

Korrigiert auf 75 Nanolegierungen bzw. 340/145/70. Der Hyperjäger liegt damit bei 48,0 je
Angriffspunkt, genau zwischen Nanoklinge (48,9) und Quantenkreuzer (49,2); die beiden grossen
Frachter liegen auf **beiden unabhängigen Bezugsgrössen** gleichauf (0,25 je Frachteinheit, ~9,3
je Punktegewicht). **Die Ursache war beide Male dieselbe: eine Zahl aus der ABSICHT gesetzt statt
gegen die Nachbarn gemessen** (Regel 41).

### Nachtrag 18.08.2026 (v8.579.0): die Massenflotten-Komponente ist auch raus

Auftrag Sascha: „Massenflotte muss noch raus."

`SHIP_T2_KOMPONENTEN` (Etappe A2 des Wirtschafts-Umbaus) liess acht Kampfschiff-Klassen oberhalb
einer Bestands-Schwelle je weiterem Schiff zusaetzlich Tier-2-Material kosten — Kreuzer und
Wächter ab 250, Zerstörer und Bomber ab 200, Schlachtschiff und Trägerschiff ab 100, Leerenjäger
ab 50, Superschlachtschiff ab 25.

**Warum sie beim ersten Durchgang stehengeblieben war — und warum das falsch war.** Der Kommentar
an der Stelle argumentierte, sie sei „keine Preisstaffel, sondern eine Schwelle: ein Tor in die
Fabrikkette, kein Aufschlag auf den Grundpreis, und es war nicht Gegenstand des Auftrags". Aus der
Sicht des SPIELERS ist dieser Unterschied keiner: Ab einer Stueckzahl wird Weiterbauen teurer, und
genau das sollte der Auftrag beseitigen. **Eine Mechanik danach zu beurteilen, als was sie gemeint
war, statt als was sie sich anfuehlt, ist derselbe Fehler wie eine zweite Anzeigestelle** — nur
eine Ebene frueher, in der Absicht statt im Text.

Entfernt sind: die Tabelle, der Zweig in `scaledShipCost`, **beide** Werft-Ankuendigungen (die
Schiffskarte und die eigene Zeile des Superschlachtschiffs — es hat keinen `SHIP_DEFS`-Eintrag und
brauchte deshalb schon immer eine zweite Kopie) und der zugehoerige Halbsatz im Hilfe-Abschnitt
„Imperiums-Skalierung der Kosten".

**`scaledShipCost` liest den Bestand damit gar nicht mehr** — weder ueber einen Faktor noch ueber
eine Schwelle. Die Parameter `shipKey` und `n` bleiben in der Signatur, weil alle 36
Kostenfunktionen sie uebergeben; der Kommentar sagt ausdruecklich, dass sie bewusst ungelesen sind
(sonst „raeumt" sie beim naechsten Mal jemand weg und aendert dabei 36 Aufrufstellen).

**Der Test ist dadurch staerker geworden, nicht schwaecher** (Regel 43). `test_werft_massenflotten`
hielt vorher die Komponente fest; jetzt prueft er, dass der Bestand den Preis ueberhaupt nicht mehr
beruehrt — und zwar ausgefuehrt, nicht gegreppt: Alle acht frueheren Klassen werden bei
`Schwelle−1`, `Schwelle`, `Schwelle+1` und `Schwelle×10` durchgerechnet und duerfen keinen
einzigen Tier-2-Posten bekommen (`3b`), und derselbe Preis muss bei Bestand 0 und 99.999 als
VOLLSTAENDIGES Objekt identisch sein (`4a`) — ein Vergleich je Feld haette einen neu
hinzugekommenen Posten uebersehen. Die acht Klassen stehen als **historische Regressionsliste** im
Test, nicht aus einer Tabelle gelesen: Die Tabelle gibt es ja gerade nicht mehr.
`test_baukorb` 3c und `test_schiffskosten` 3c sind aus demselben Grund invertiert.

**Eine Balance-Folge, die benannt gehoert:** Damit faellt die einzige Senke, die grosse Flotten in
Tier-2-Material zahlen liess. Wer Hunderte Schiffe einer Klasse stapelt, braucht die Fabrikkette
dafuer nicht mehr. Was den Massenbau bremst, sind jetzt ausschliesslich Bauzeit und Werft.

### Nachtrag 18.08.2026 (v8.577.0): die Preise mussten wieder hoch — und warum

Auftrag Sascha nach der Auslieferung: „Ändere das" — zur gemeldeten Folge, dass grosse Flotten
schwerer Schiffe deutlich billiger wurden (300 Leerenjäger 201.000 statt 1,25 Mio Erz).

**Die Ursache war gemessen und strukturell, nicht eine Frage einzelner Zahlen.** Der alte Stand
trug einen **systematischen Aufschlag für schwere Schiffe**: Aufwand je Angriffspunkt wächst mit
der Schiffsgrösse, gefittet `∝ atk^0,540`. Für die Schiffe OHNE Angriffswert ergibt derselbe Fit
über das Punktegewicht `∝ gw^0,547` bei praktisch gleichem Vorfaktor (4,58 gegen 4,53) — **ein und
dasselbe Gesetz über beide Gruppen**. Meine Reform hatte den Exponenten auf 0 gesetzt, also den
Aufschlag ersatzlos eingeebnet. Genau das liess die schweren Flotten kollabieren.

**Und ein Rechenfehler in meiner ersten Korrektur, der sie fast wertlos gemacht hätte:** Ich hatte
den Boden mit `Anteil × Staffelfaktor` kalibriert. Richtig ist `Anteil / Staffelfaktor` — die alte
Staffelung machte spätere Stücke ja teurer, ein flacher Preis muss also HÖHER liegen als der alte
ERSTPREIS, um dieselbe Flotte zu kosten. Mit dem falschen Vorzeichen landete der erste Anlauf bei
0,35–0,6× statt der beabsichtigten 0,83×. Aufgefallen ist es erst beim Nachmessen der
Flottenkosten — die Rechnung sah beim Hinschreiben richtig aus (Regel 48: nach dem Fix DIESELBE
Messung wiederholen, „plausibel behoben" ist kein Messwert).

**Umgesetzt als Boden: kein Schiff unter 1,25× seines ALTEN Grundpreises.** Damit kostet eine
Flotte gegenüber früher 1,04× bei 100 Stück, 0,83× bei 250 und 0,61× bei 500 — Median über alle
36 Schiffe. Kleine Flotten also unverändert, grosse moderat billiger, weil genau das der Zweck des
Wegfalls der Strafe ist. **Der Preis dafür ist arithmetisch unvermeidbar und gehört benannt:** Wer
die Staffelung entfernt UND die Flottenkosten halten will, muss den Stückpreis über den alten
Erstpreis heben. Beides zugleich gibt es nicht.

Der **Jäger** bleibt die bewusste Ausnahme (1,79× bei 250 Stück) — er war die billigste Quelle von
Flottenpunkten.

### Der Fund, der die Anhebung fast unbrauchbar gemacht hätte: die MISCHUNG war verrutscht

Nach der Anhebung stimmte das T1-Äquivalent jedes Schiffs auf 1,25× — und trotzdem war das
Ergebnis falsch. Gemessen je EINZELNEM Rohstoff: Beim Mondzerstörer stieg das Erz auf das
3,80-fache, während die Kristalle auf 0,57 FIELEN; beim Sternenbanner 2,69 gegen 0,82; beim
Leerenjäger stieg Erz auf 2,56, während die Antimaterie auf 0,67 fiel. Die Ursache war meine
eigene Reform: Sie hatte nicht nur die Höhe, sondern auch die MISCHUNGSVERHÄLTNISSE neu gesetzt,
und die Anhebung skalierte dann diese neuen Vektoren.

**Damit ändert sich, welcher Rohstoff ein Schiff überhaupt begrenzt** — und das hat niemand
bestellt. Eine Aggregatgrösse wie „T1-Äquivalent" schützt davor gerade nicht: Sie ist eine
gewichtete Summe, und Gewichte, die ich selbst gewählt habe, können eine Verschiebung zwischen
den Posten exakt ausgleichen, während sich im Spiel der Engpass verschiebt.

**Behoben, indem jedes Schiff seinen ALTEN Rohstoff-Vektor zurückbekommt und nur skaliert wird**
(`neu = alt × Skala`), statt die neu erfundenen Vektoren zu skalieren. Gemessene Mischungs-Drift
danach: höchstens Faktor 1,267, und das ist reines Rundungsrauschen auf kleinen Ganzzahlen
(Antimaterie 10 → 12,5 → 15).

**Vorgehen, unabhängig von diesem Fall:** Wer eine Grösse anhebt, die aus MEHREREN Posten besteht,
prüft die Posten EINZELN und nicht nur ihre Summe. Und wenn nur die Höhe geändert werden soll,
skaliert man den Originalvektor — jede Neuerfindung der Zusammensetzung ist eine zweite,
unbestellte Änderung, die sich hinter einer stimmenden Summe versteckt.

### Die Lehre, die über diesen Fall hinausgeht: eine Schranke relativ zum MEDIAN wandert mit

`1b` verlangte ursprünglich „nicht mehr als das 3,5-fache des **Medians**". Das funktionierte genau
so lange, wie die Preise flach lagen. Mit dem wiederhergestellten Aufschlag stieg der Median von
32,9 auf 48 — und **derselbe kaputte Hyperjäger, der vorher beim 4,09-fachen anschlug, stand danach
beim 2,8-fachen und wäre stillschweigend durchgelaufen.** Die Prüfung war nicht falsch, sie war
durch eine legitime Balance-Entscheidung entschärft worden, ohne dass jemand sie angefasst hätte.

**Vorgehen:** Eine Schranke, die sich auf eine Kennzahl der eigenen Population bezieht (Median,
Mittelwert, Maximum), entschärft sich selbst, sobald die ganze Population wandert. Wer eine solche
Schranke setzt, prüft sie nach JEDER Änderung, die alle Werte gemeinsam verschiebt — oder bezieht
sie besser auf das GESETZ, dem die Werte folgen. `1b` misst deshalb jetzt die Abweichung von einer
bei jedem Lauf neu gefitteten Potenzkurve: Der Exponent kommt aus den Daten, ein einzelnes Schiff
kann ihn kaum verschieben, und eine gemeinsame Anhebung aller Preise lässt ihn unberührt.

Zwei weitere Entscheidungen an diesem Test, beide aus Fehlschlägen entstanden:

- **Die Kurve lässt Wächter und Carrier aus** — datengetrieben über das Verhältnis Punktegewicht zu
  Angriffswert (2,50 und 2,00; der nächste ist der Kreuzer bei 1,25, die Schranke liegt bei 1,5),
  nicht als Namensliste. Ihr Wert liegt in Abwehr bzw. Trägerkapazität; der Carrier lag schon im
  ALTEN Spiel beim 5,07-fachen jeder Angriffs-Kurve. Ohne diese Abgrenzung meldete `1b` ihn als
  Ausreisser — ein Fehlschlag, der vom ersten Tag an dagestanden hätte (Regel 53).
- **Die Prüfung auf die Gesamtspreizung ist ersatzlos gestrichen.** Sie ist zweimal gewandert, ohne
  dass ein Fehler vorlag: 16,3× nach der Einebnung, 22,5× nach der Wiederherstellung, 28,5× im
  alten Spiel. Eine Zahl, deren Schranke bei jeder legitimen Balance-Entscheidung nachgezogen
  werden muss, misst die Entscheidung und nicht den Fehler. Was sie fangen sollte, fängt `1b`
  schärfer.

### `tests/test_schiffskosten.js` — und die drei Entwürfe, die es NICHT geworden ist

Der Wächter kennt keine Sollpreise, er prüft Verhältnisse (Regel 3) und ist musterbasiert, findet
also auch ein Schiff, an das niemand gedacht hat (Regel 40). Drei Entwürfe sind unterwegs
gescheitert, und die Gründe sind übertragbar:

1. **Dominanz über den ANGRIFFSWERT** meldete sofort Carrier (atk 15), Wächter (8) und
   Enterschiff (25) — Schiffe, deren Wert absichtlich woanders liegt (Trägerkapazität, Abwehr,
   Entern). Die Prüfung unterstellte, Angriff sei der einzige Wert.
2. **Dominanz über das PUNKTEGEWICHT bei gleicher Rohstoffbasis** meldete elf Paare, von denen
   keines ein Fehler war: `erz+kristalle+deuterium` teilen sich Frachter, Enterschiff, Recycler,
   Gesandtenschiff und Paktkorvette. **„Gleiche Rohstoffe" ist keine Austauschbeziehung** — und
   eine echte steht nirgends in den Daten. Der Dominanz-Vergleich ist deshalb **ersatzlos
   gestrichen**: Eine Prüfung, die vom ersten Tag an rot ist, wird zu einem dauerhaft ignorierten
   Fehlschlag und entwertet den ganzen Lauf (Regel 53).
3. **Die Ausreisser-Schranke MIT Unikaten** war wertlos: Der Mondzerstörer steht legitim beim
   3,79-fachen des Medians, der kaputte Hyperjäger stand beim 4,09-fachen — dazwischen passt keine
   vertrauenswürdige Schranke. Erst das Ausnehmen der `maxOwned`-Schiffe schafft Abstand (legitimes
   Maximum 2,91×, Schranke 3,5×).

**Und eine Prüfung war vacuous, obwohl sie am neuen Stand grün und plausibel aussah:** 3b suchte
nach der WORTFORM der alten Skalierung (`base*(1+0.004*(n-1))`) und lief an der Gegenprobe vorbei,
weil die sie als `a * factor` mit vorher berechnetem `factor` schreibt. Ein Muster, das eine
einzelne Schreibweise kodiert, ist eine namensbasierte Suche in Verkleidung (Regel 40). Geprüft
wird jetzt die URSACHE: Die Schleife über `base` muss ihren Betrag unverändert durchreichen
(`c[r] = Math.ceil(a)`) — das fängt jede Faktor-Form.

Drei Gegenproben, alle beidseitig gefahren, alle 18 Prüfungen in JEDER Richtung gelaufen
(Regel 34): Hyperjäger zurück → 1b mit Faktor 4,09; Bergungsfrachter zurück → 2c/2d mit Faktor
1,91; beide Skalierungen zurück → zusätzlich 3b und 3d.

### Der Werkzeugfehler, der die ganze Etappe fast entwertet hätte

Die erste Gegenprobe zu `test_tiefenflotte` blieb am ALTEN Stand **grün** — nach Regel 26 also ein
Befund. Er lag nicht am Test, sondern am Messwerkzeug: `test_tiefenflotte.js` las die Spieldatei
über einen **fest verdrahteten Pfad** statt über `lib/umgebung`, und `KEPLER_SPIELDATEI` wurde
still ignoriert. Beide Läufe lasen dieselbe echte Datei. Das ist wörtlich die Falle aus der
Korrektur zu Regel 14 — „eine still ignorierte Env-Variable sieht aus wie eine bestandene
Gegenprobe".

**ERLEDIGT am 21.08.2026 — und der Durchgang hat mehr gefunden, als hier stand.** An dieser
Stelle stand: „Gemessen: 19 weitere Tests haben denselben Defekt … der Rest ist offen und lohnt
einen eigenen Durchgang." Gefunden wurden **25**. Die ursprüngliche Suche
(`grep -Ln "lib/umgebung" tests/test_*.js`) übersah sieben, die `lib/umgebung` sehr wohl einbinden
und den Quelltext **trotzdem** fest verdrahtet lasen — die unangenehmere Hälfte: Bei einer
Gegenprobe läuft der Browser auf der Kopie und die Quelltext-Prüfung auf dem Original. Der Test ist
dann halb umgeleitet und sagt trotzdem nichts. **Wer nach dieser Fehlerklasse sucht, sucht nach der
LESESTELLE (`path.join(__dirname, '..', 'weltraum_kolonie.html')`), nicht nach dem fehlenden
`require`** — sonst findet er nur die Hälfte (Regel 40 an der Suche selbst).

**Die Pfade liegen jetzt in `tests/lib/spieldatei.js`, nicht in `lib/umgebung.js`** — und das ist
keine Ordnungsfrage: `require('./lib/umgebung')` zieht Playwright hoch, gemessen **282 ms** je
Lauf. Genau deshalb hatten die reinen Quelltext-Tests ihren eigenen `path.join`; sie alle auf
`umgebung` zu setzen hätte den Defekt behoben und dafür Sekunden Suite-Zeit für einen Browser
verheizt, den sie nie starten. Das neue Modul kostet **1 ms** und lädt nachweislich kein Playwright.
`lib/umgebung.js` bezieht seine Pfade von dort und reicht sie unverändert weiter — eine zweite
Fassung derselben Pfadlogik wäre genau die zweite Wahrheit, gegen die das Ganze sich richtet.

**Der Beleg gehört zur Umstellung, nicht daneben:** Für jeden der 25 Tests wurde ein Lauf gegen die
echte Datei und einer gegen eine leere Kopie gefahren. Alle 25 liefern normal `EXIT=0`, umgeleitet
`EXIT=1` und eine andere Ausgabe. Wäre die Ausgabe gleich, wäre die Env-Variable weiterhin still
ignoriert worden — und genau das sieht aus wie eine bestandene Gegenprobe.

**Dazu ein Fehler im eigenen Mess-Skript, gleiche Familie:** Die Gegenproben-Schleife schrieb
`node … > log; ok=$(grep -c OK log); fl=$(grep -c FAIL log); echo "EXIT=$?"` — und `$?` war der
Status des letzten `grep`, nicht des Tests. Alle drei Gegenproben meldeten „EXIT=0", während sie in
Wahrheit korrekt rot waren. Das ist Regel 19 eine Ebene höher: nicht die Pipe verdeckt den
Exit-Code, sondern das Kommando, das man zwischen Test und Auswertung stellt.

## Beschreibungstexte: was gekürzt wird und was nie (TX-Etappen, ab 18.08.2026)

Auftrag Sascha: „alle texte von gebäuden schiffen forschung etc überarbeiten teilweise zu viele
infos und man merkt das es ki inhalt ist". Gemessener Ausgangsstand, block-gescopt gelesen (nicht
per loser Regex – ein erster Anlauf zählte Schiffe zu den Gebäuden):

| Tabelle | Texte | Median | max | über 250 |
|---|---|---|---|---|
| `MODULE_DEFS.desc` | 47 | 262 | 612 | 30 |
| `RESEARCH_DEFS.desc` | 53 | 205 | 630 | 16 |
| `SHIP_MODULE_DEFS.desc` | 44 | 108 | 446 | 10 |
| `SHIP_DEFS.desc` | 9 | 264 | 369 | 5 |
| `BUILDING_DEFS.effectDesc` | 46 | 26 | 435 | 5 |

**Die vier Muster, an denen der KI-Duktus hängt** – und nur die fliegen raus: (1) Selbstlob und
Einordnung statt Information („Das Tor zum Endspiel", „Der Abschluss der Verarbeitungskette");
(2) Entwickler-Historie im Spielertext („zählen seit dem 17.07.2026 mit", „war bisher ausschließlich
über das Goldrausch-Event erreichbar"); (3) Klammern in Klammern und nachgeschobene Halbsätze mit
Gedankenstrich; (4) Erklärungen zweiter Ordnung – was die Forschung freischaltet, was daran
wiederum hängt, und was ohne sie alles verschlossen bleibt.

**Was unangetastet bleibt: jede Zahl.** Mehrere Tests lesen Werte aus diesen Texten und vergleichen
sie gegen die Konstanten (`test_forschungstexte` gegen `effectPerLevel`/`maxLevel`,
`test_levelfortschritt` gegen das Offline-Fenster, `test_forschungsmeilensteine` gegen die Zahl der
Tiefenschiffe). Auch ABGELEITETE Zahlen bleiben – das Gesamtfenster „14 Stunden" ist 8 + 6, und
genau deshalb steht es da: Der Spieler soll es nicht selbst ausrechnen müssen. Ebenso bleibt die
Mindestlänge von 50 Zeichen gewahrt (Spieler-Report 22.07.2026: ein Kürzel las sich wie eine
fehlende Beschreibung).

**Stand der Etappen:**
- **TX-1** (v8.570.0): 14 Forschungs-`desc` und 4 Gebäude-`effectDesc`, zusammen 6.412 → 3.821
  Zeichen. Danach stehen in `RESEARCH_DEFS` nur noch zwei Texte über 250 Zeichen (`rewig_prod`,
  `rewig_lager`) – beide lang, weil sie echte Zahlenreihen nennen, und deshalb unverändert.
  **`rflottenkoord` ist die Ausnahme, die die Regel zeigt:** Der Text bleibt mit ~520 Zeichen lang,
  weil DREI Tests je eine eigene Zusage daraus einfordern – „Parallelkommando"
  (`test_faehigkeitsbaum` 4b), „Recycler-Gruppe" (`test_recycler_sammelauftrag` 5), die
  Verlegungs-Aussage samt Verband-Ausnahme (`test_pvp_bericht`). Der erste, kurze Entwurf hatte alle
  vier weggekürzt und genau diese drei Tests gerissen. Länge ist hier kein Ballast, sondern vier
  belegte Zusagen; gestrichen wurde nur, was nichts zusagt.
  **Ein Zielkonflikt musste dabei zugunsten des Auftrags entschieden werden.** `test_pvp_bericht`
  verlangte wörtlich „Flottenverlegungen zwischen eigenen Planeten zählen **seit dem 17.07.2026**
  mit" – ein Auslieferungsdatum im SPIELERTEXT, also Muster 2. Bequem wäre gewesen, es stehen zu
  lassen. Stattdessen ist das Datum aus BEIDEN Fundorten raus (Forschungsbeschreibung und
  HELP_SECTIONS – ein Fundort allein hätte zwei Anzeigestellen mit unterschiedlicher Aussage
  ergeben, Punkt 6), und im Test ist das Datum im Muster **optional**
  (`zählen (?:seit dem \d{2}\.\d{2}\.\d{4} )?mit`). Die geprüften Eigenschaften sind unverändert:
  beide Stellen müssen die Aussage tragen (Gegenprobe gefahren – mit einer entfernten Aussage meldet
  der Test `beide Stellen sagen jetzt das Richtige | 1`), die alte Falschaussage „zählen nicht mit"
  trifft das Muster nachweislich NICHT (gemessen 0), und die datierte Altform würde weiterhin
  akzeptiert (gemessen 1). **Das ist der Unterschied zwischen einer festgenagelten SCHREIBWEISE
  lösen und eine Prüfung aufweichen** – Regel 3 gegen Regel 26, und hier lag der Fall auf der Seite
  von Regel 3.
- **`SHIP_DEFS` bleibt unverändert.** Hier stand zwischenzeitlich, die Tabelle habe gar kein
  `desc` – das war eine zu enge Prüfung (angesehen wurde nur der ERSTE Eintrag). Die neun
  Tiefenschiffe haben eines, `test_schiffstexte.js` existiert eigens dafür, dass es auch gerendert
  wird, und alle neun Texte nennen Wirkung, Grenze und Gegenbeispiel, ohne eines der vier Muster
  zu tragen (Regel 32 in der Gegenrichtung: ein zu Unrecht verworfener Fund fällt nie wieder auf).
- **TX-2** (v8.572.0): `MODULE_DEFS`, 14 Texte, 5.752 → 4.627 Zeichen. Der Block hat 56 `desc`-Texte
  (block-gescopt zwischen `const MODULE_DEFS = [` und `const SHIP_MODULE_DEFS`), Median 262.

  **Die wichtigste Entscheidung ist eine Nicht-Änderung: die 20 BOSS-SET-Texte bleiben.** Sie waren
  der erste Verdacht, weil sie einander fast wortgleich lesen („Teil des Boss-Sets X (droppt nur bei
  Y): <Bild> – <Wirkung>. Ab 2 Set-Teilen am selben Standort kommen die X-Stufenboni dazu."). Beim
  Durchlesen ist das kein KI-Duktus: Jeder Satzteil trägt eine eigene Auskunft (welches Set, wo es
  fällt, was es tut, ab wann die Stufenboni greifen), und eine gleichförmige Struktur über zwanzig
  gleichartige Gegenstände ist Gestaltung, keine Wiederholung. Wer sie „entschlackt", nimmt
  Information weg. **Wiederholung ist erst dann ein Befund, wenn der wiederholte Teil nichts sagt.**

  Gekürzt wurde stattdessen Muster 1 und 4: Rangaussagen („als einziges Modul im Spiel"),
  Spielempfehlungen („ideal, um Angriffe zu Ketten zu verbinden", „wer von Kampf zu Kampf zieht,
  hält ihn dauerhaft aufrecht"), Einordnungen („Damit ist er die Brücke nach oben") und Erklärungen
  über das SPIEL statt über den Gegenstand (woher Trümmerfelder kommen, was Prisengut ist, wie die
  Terraforming-Staffel läuft).

  **Drei Testbedingungen, vorher gemessen und teils GEGENLÄUFIG – wer hier etwas ändert, prüft sie
  zuerst:**
  - `test_bonibilanz` 6 verbietet `/gedeckelt|Obergrenze/` in JEDEM Modultext, **case-sensitiv**.
    Die Bestandstexte kommen nur durch, weil dort „**G**edeckelt bei +45%" am SATZANFANG steht. Wer
    denselben Satz in einen längeren einbettet und klein schreibt, reißt den Test – und zwar an
    einer Stelle, die mit der eigenen Änderung nichts zu tun zu haben scheint.
  - `test_abgrund_module2` verlangt bei Abgrund-Modulen umgekehrt
    `/gedeckelt|deckel|bis −|bis \+|stapelt nicht/i` und `desc.length >= 140`;
    `test_abgrundmodule` und `test_abgrund_gegenstaende` verlangen `>= 180`. Der Ersetzer führt
    deshalb eine Untergrenze von 190 Zeichen für alle geänderten Texte.
  - `test_vorschau_konsistenz` verbietet Funktionsaufrufe in einer `desc`.

  **Der Ersetzer prüft selbst, dass JEDE ZAHL des alten Textes im neuen wieder vorkommt** – die
  einzige Wache dieser Etappe, die den INHALT statt der Form absichert. Alles andere (Apostroph,
  Mindestlänge, verbotene Wortform, Datum, Anführungszeichen) prüft nur, dass der neue Text die
  Umgebung nicht sprengt.

  **Und eine Form-Falle, die TX-1 nicht hatte:** Die Modul-Einträge sind ZWEIZEILIG – Kopfzeile mit
  `key`/`effect`/`base`, `desc` auf der Folgezeile. Der TX-1-Ersetzer suchte Anker und `desc` in
  DERSELBEN Zeile und fand hier null Treffer. Richtig ist, vom Eintragsanfang bis zum NÄCHSTEN
  Eintragsanfang zu suchen – dann kann der Treffer nie aus einem fremden Eintrag stammen
  (Hausregel 39/59 in der mehrzeiligen Variante).
- **TX-3** (v8.593.0, 21.08.2026): `SHIP_MODULE_DEFS`, sechs Abgrund-Texte, 2.129 → 1.637 Zeichen
  (`ab_ballastspiegel` 446→288, `ab_schwarmoptik` 387→334, `ab_stillgaenger` 342→290,
  `ab_bergungsklaue` 341→240, `ab_resonanzlanze` 320→258, `ab_tiefenkiel` 293→227). Der Block hat
  44 `desc`-Texte, Median 108 – die meisten sind längst knapp, gekürzt wurden nur die zehn über
  250 Zeichen, und dort nur Muster 1 (Selbstlob/Einordnung: „ein Aufklärer, der vorausschaut, statt
  zu kämpfen"; „macht aus den schwersten Sektoren die lohnendsten") und Muster 4 (Erklärungen über
  das SPIEL statt über den Gegenstand).

  **Die Testbedingung ist hier GEGENLÄUFIG zu TX-2 und muss vorher gelesen werden:**
  `test_abgrund_schiffsmodule` prüft **genau sechs** Schlüssel (`ab_tiefenkiel`, `ab_schwarmoptik`,
  `ab_resonanzlanze`, `ab_bergungsklaue`, `ab_stillgaenger`, `ab_waechterbann`) auf
  `desc.length >= 200` **und** darauf, dass `/gedeckelt|Obergrenze/` dort *nicht* vorkommt – während
  `test_abgrund_module2` bei den MODULEN genau umgekehrt eine Deckel-Aussage verlangt.
  `ab_ballastspiegel` gehört NICHT zu den sechs; sein „gedeckelt bei 40%" ist eine echte Zahl und
  bleibt. Der Ersetzer führt deshalb eine Untergrenze von 210 Zeichen (Luft zur 200er-Schranke) und
  bricht bei jeder Verletzung ab, bevor er schreibt.

  **Bewusst NICHT angefasst:** `ab_drucklot` und `ab_waechterbann` – dort trägt jeder Satz eine
  eigene Auskunft (wie viele Mutatoren ein Sektor hat, dass genau einer gestrichen wird, die
  Abgrenzung „hilft beim Feststecken, nicht beim Abernten"); dazu die zwei Event-Module, deren
  Schiffslisten Information sind und keine Füllung. Dieselbe Entscheidung wie bei den 20
  Boss-Set-Texten in TX-2.
## Passwort-Mindestlänge 8 (19.08.2026, Sicherheits-Audit P5, v8.579.0)

Die Regel selbst steht im Backend (`PASSWORT_MIN`, sechs Prüfungen inklusive einer Liste von 2.122
bekannten Passwörtern). Das Frontend prüft **nur die Länge** vorab – die Liste dort zu spiegeln wäre
eine zweite Wahrheit und 19 kB in einer Datei, die jeder Spieler bei jedem Aufruf lädt.

**Vier Anzeigestellen, und die vierte ist die, die man übersieht:**

1. Der `#resetNewPassword`-Platzhalter – eigenes Feld, eigener Text.
2. Die Reset-Prüfung im Skriptblock.
3. **Die Registrier-Vorprüfung, die es vorher gar nicht gab.** Bis hierher prüfte das Frontend beim
   Registrieren keine Passwortlänge; nur der Server tat es, und der Spieler erfuhr es erst nach dem
   Absenden. Sicherheitlich war das harmlos – die Richtung ist die umgekehrte der Videolücke.
4. Der Platzhalter des Passwortfelds, **modusabhängig**: Das Feld ist DASSELBE für Anmelden und
   Registrieren. Ein festes „mind. 8 Zeichen" wäre im Anmelde-Modus eine Falschaussage gegenüber
   genau den Bestandskonten, die die Änderung schützt.

**Ein Fund, der die Suche selbst betrifft (Regel 32 in Reinform):** Der Audit-Bericht nannte eine
Frontend-Prüfung, die es für die Registrierung nie gab, und `grep "api/register"` findet in der
Spieldatei **null** Treffer – der Pfad entsteht erst zur Laufzeit als `fetch('/api/'+loginMode)`.
Wer nach dem Literal sucht, schließt daraus, das Spiel registriere gar nicht. Beim Nachprüfen einer
Route also immer auch nach der ZUSAMMENSETZUNG suchen, nicht nur nach dem fertigen Pfad.

Wächter: `tests/test_passwortregeln.js` (10 Prüfungen). Sein Kern ist die **Parität** gegen
`PASSWORT_MIN` in `server.js` – zwei Repos, die über getrennte Befehle desselben Webhooks live
gehen, und der Fehler, vor dem das Auslöser-Video warnt, ist genau „zwei Zahlen, die auseinander
laufen". Gemessen statt behauptet wird auch die WIRKUNG: Bei sieben Zeichen darf **keine Anfrage**
an den Server rausgehen (am alten Stand ging sie mit `["file:///api/register"]` wirklich raus).

**Es braucht ZWEI Gegenproben**, weil der Test zwei verschiedene Dateien misst – eine über die
Spieldatei allein hätte die Paritätsprüfung nie bewegt (`KEPLER_SPIELDATEI` → 4 rot;
`KEPLER_BACKEND_SERVER` auf eine Kopie mit `PASSWORT_MIN = 6` → 1 rot, mit dem sprechenden Beleg
`{"backend":6,"frontendErwartet":8}`).

**Die Auslieferungsreihenfolge ist hier ausnahmsweise gleichgültig** – anders als bei den Festungen
(Regel 60) gibt es keine still verschlechterte Zahl: Geht das Backend zuerst live, lehnt der Server
ein 7-Zeichen-Passwort mit klarem Grund ab; geht das Frontend zuerst, blockt die Vorprüfung etwas,
das der Server genommen hätte. Beides ist verständlich, keines ist still. Ein Schalter ist deshalb
nicht nötig – die zwei PRs gehören trotzdem zusammen gemerged, damit die Paritätsprüfung nicht gegen
die alte Zahl läuft.
## Jeder Angriff schreibt einen Bericht, den der Spieler SIEHT und VERSTEHT (Auftrag 19.08.2026)

**Wortlaut: „für alle angriffe egal ob auf alien spieler bastionen bericht verfassen das der
spieler nachvollziehen kann was geschehen ist prüfe ob überall vorhanden."**

Die Regel gilt ab sofort für **jede** neue Angriffs- oder Kampfart, ohne Ausnahme. Und sie hat drei
Hälften, weil ein Bericht an drei verschiedenen Stellen ausfallen kann – alle drei sind am
19.08.2026 real gemessen worden:

1. **Er entsteht gar nicht.** Ein Codepfad ohne `pushReport`. Typisch sind nicht der Sieg und die
   Niederlage, sondern die *unauffälligen* Ausgänge: Server nicht erreichbar, Ziel schon gefallen,
   Abklingzeit, Anfängerschutz, Nest weitergezogen. Die tragen im Bestand oft nur ein `log()` –
   und **`#log` hat keinen Stapel, es überschreibt sich mit der nächsten Meldung selbst**. Eine
   Erklärung, die nur dort steht, ist für den Spieler nach Sekunden weg (dieselbe Messung wie in
   Regel 47). Ein Toast hält drei Einträge und ist genauso wenig ein Ersatz.
2. **Er wird nicht gezeichnet.** `renderReportsBox` ist eine `if/else if`-Kette über `r.type` –
   **ohne Abschluss-`else`**. `title` und `body` starten auf `''`; eine Art ohne Zweig ergibt also
   eine Karte, die nur Ergebnis-Pille und Datum trägt. Gemessen: **22 Zeichen**.
3. **Er sagt nichts oder das Falsche.** Ein Zweig, der den Hergang nicht nennt – oder, schlimmer,
   ihn umdreht.

### Der Anlass, dreimal gemessen im Browser

`moon-siege` und `moon-siege-defense` – der Mondzerstörer, also ein Angriff auf einen **Spieler** –
waren die einzigen zwei erzeugten Berichtsarten **ohne Zeichner-Zweig**. Gemessen an einer Fixture
mit je einem Bericht:

| Bericht | vorher | nachher |
|---|---|---|
| ich zerstöre einen fremden Mond | „Gewonnen", 22 Zeichen | 146 Zeichen |
| **mein** Mond wurde zerstört | „**Gewonnen**", 22 Zeichen | „Verloren", 189 Zeichen |
| mein Mond wurde verteidigt | „**Verloren**", 22 Zeichen | „Gewonnen", 184 Zeichen |

**Die zweite Zeile ist der eigentliche Fehler und eine Lehre für sich.** `reportIsPositive`
behandelt `result === 'destroyed'` seit v8.430.0 pauschal als Erfolg; der Kommentar dort sagt
ausdrücklich „zerstörte **gegnerische** Basis – der beste Ausgang". Für `alliance-base-attack` ist
das richtig. Beim VERTEIDIGER der Mondbelagerung heißt dasselbe Wort das Gegenteil – die Karte
meldete „Gewonnen" über dem dauerhaften Verlust einer Kolonie und „Verloren" über einer geglückten
Abwehr, also in **beide** Richtungen falsch. **Übertragbar: Ein Zustandswort, das global
interpretiert wird, muss an jeder Stelle dieselbe Bedeutung haben – wer eine Verteidiger-Sicht
einführt, prüft jedes solche Wort einzeln.** Die Ausnahme steht deshalb VOR der generischen Zeile,
wie die zwei Zweige darüber.

Dazu fielen **drei** Kampf-Berichtsarten aus der Kategorie „Kämpfe" und landeten über den Rückfall
unter „Sonstiges" (`moon-siege`, `moon-siege-defense`, `pvp-fleet-loss`) – gemessen zeigte der
Kampf-Filter **2 von 5**, jetzt 6 von 6.

### Der schwerste Fund war kein fehlender Bericht, sondern ein ABSTURZ

`const pVerlustfrei` stand innerhalb von `if (encountered){ … }`, die drei Berichtsstellen
(`withdrawn`, `destroyed`, `weakened`/`defended`) liegen in **Geschwister**-Blöcken. `const` ist
block-scoped – **jede Expedition mit Feindbegegnung** starb also an
`ReferenceError: pVerlustfrei is not defined`, mitten in `checkMissions`.

Gemessen im echten Spiel, zwei Läufe mit identischer Fixture bis auf ein Feld:

```
encounterChance 1 → berichte: []                 + ReferenceError im Spielstand-Lade-Handler
encounterChance 0 → berichte: ["expedition/success"]
```

Live seit **v8.525.0 (16.08.2026)**, also drei Tage. Der Schaden reicht über den fehlenden Bericht
hinaus: Die fällige Mission wird VOR der Auflösungsschleife aus `fleet.missions` gefiltert, die
Expedition ist danach also ersatzlos weg; Verluste und teils sogar Beute sind zu dem Zeitpunkt
bereits gebucht. Und weil kein `try/catch` im Pfad liegt, bricht der Rest des Tick-Durchlaufs ab.

**Drei Lehren, jede über den Einzelfall hinaus:**
- **Der Syntax-Check findet das NICHT** – `new Function` parst nur und führt nie aus. Das ist
  Regel 38 in einer neuen Ausprägung: dort die temporale Todeszone, hier der Blockscope.
- **Wer einen Wert in einem `if`-Block berechnet, der in einem GESCHWISTER-Block gelesen wird,
  deklariert ihn eine Ebene höher** – genau dort, wo `enemyPower`, `ratio` und
  `schwerVerlustAnteil` schon stehen. Die richtige Zeile stand direkt daneben.
- **Gefunden hat es kein Lesen des Codes, sondern der PAAR-Lauf** (mit/ohne Begegnung). Ein
  einzelner Lauf ohne Begegnung war grün und sah vollständig aus.

### Der Wächter: `tests/test_berichtspflicht.js`

**Datengetrieben, nicht namensbasiert** (Regel 40) – er liest ALLE `pushReport({ type:'X'` aus der
Spieldatei und hält sie gegen die Zweige des Zeichners und gegen `REPORT_CATEGORIES`. Eine künftige
Angriffsart ohne Zeichner-Zweig fällt damit auf, **ohne dass jemand an sie gedacht haben muss**.
15 Prüfungen:

- `1a` jede erzeugte Art hat einen Zeichner-Zweig · `1b` die Gegenrichtung (ein Zweig ohne
  Erzeuger ist toter Code; die sieben serverseitig erzeugten Arten stehen namentlich als
  Ausnahme, damit ihr Wegfall auffällt).
- `1c` jede **Kampf**-Berichtsart steht in einer Kategorie. Was ein Kampfbericht ist, wird aus den
  DATEN abgeleitet (der Zweig spricht von Verlusten, Angreifer, zerstört, abgewehrt), nicht als
  Namensliste geführt.
- `2` **im gerenderten Spiel**: je erzeugter Art ein synthetischer Bericht, und jede Karte muss
  außer Pille und Datum etwas tragen. Die Fixture ist bewusst GENERISCH – ein Zweig, der bei
  fehlenden Feldern eine leere Karte baut, ist selbst ein Befund.
- `3`/`3b` das PAAR der Verteidiger-Sicht (zerstört ≠ Sieg, verteidigt = Sieg). Jede Hälfte allein
  wäre auch bei komplett fehlender Einfärbung erfüllt.

**Die Schranke von Abschnitt 2 ist die zweite Lehre dieses Tests.** Der erste Entwurf verlangte eine
Mindest-ZEICHENZAHL (40, weil die leere Karte 22 trägt) und schlug prompt bei `random-event` an –
einer völlig korrekten, nur kurzen Karte. Das war eine Momentaufnahme (Regel 3). Gemessen wird jetzt
die REGEL: *Was bleibt übrig, wenn man Ergebnis-Pille und Zeitstempel abzieht?* Bei der leeren Karte
ist das exakt nichts, bei jeder sprechenden etwas. Der Fehlschlag gibt zusätzlich je Art die
Inhaltslänge aus (Regel 37), damit die Ursache im Protokoll steht statt in einer späteren Sitzung.

Gegenprobe gegen den ausgelieferten Stand: **5 rot bei identischen 15 Prüfnamen** (per `diff`
verglichen, nicht gezählt – Regel 60), und jede benennt ihren Fall: `["moon-siege",
"moon-siege-defense"]`, `["pvp-fleet-loss"]`, `["Gewonnen","Verloren"]`.

### Zweite Etappe (v8.589.0): `angriffOhneKampf` – EIN Helfer für neun Stellen

Neun Ausgänge schrieben ihren Grund **ausschließlich** ins `#log`: Server nicht erreichbar,
Abklingzeit, Ziel schon gefallen, Nest weitergezogen, zu spät angekommen. Alle neun waren
strukturgleich, also gab es dafür eine Funktion statt neun Einzelkorrekturen (Regel 43):

```js
function angriffOhneKampf(typ, ziel, grund, felder){
  pushReport(Object.assign({ type: typ, keinKampf: true, ziel, grund }, felder || {}));
}
```

**Der Bericht trägt denselben `type` wie der geglückte Angriff.** Damit landet er in derselben
Kategorie, und die Kartenknöpfe („Zeigen, wo das war") greifen unverändert. Der Zeichner fängt
`keinKampf` in **einem** Zweig ganz vorn ab, statt in jedem Typ-Zweig erneut — und
`reportIsPositive` gibt dafür `true` zurück: Ein Ausgang, der nichts gekostet hat, ist keine
Niederlage. Am Stand davor gemessen las die Karte **„Angriff auf undefined (Stufe undefined) ·
Verloren"**.

**Das `log()` an der Aufrufstelle bleibt bewusst stehen** – es ist die sofortige Rückmeldung, der
Bericht das bleibende Protokoll. Zwei verschiedene Fragen, zwei verschiedene Orte.

**Der Weltboss war der schlimmste Fall, und zwar wegen einer Zeile daneben.** Sein `catch(e){}`
war leer — ein Netzabbruch oder eine nicht-JSON-Antwort (die 502-Seite des nginx) ließ die Mission
**spurlos** verschwinden. Und seine zwei anderen Ausgänge hängen an `showLog !== false`: Beim
**Offline-Nachholen** steht das auf `false`, der Spieler erfuhr dort also auch vorher schon gar
nichts. Genau deshalb ist der Bericht dort wichtiger als die Meldung.

**`faction-attack` bekam einen ganz neuen Berichtstyp** – er kannte bis dahin **keinen einzigen**
`pushReport`, obwohl sein Misserfolg echte Schiffe kostet und der Server Angriffskraft,
Verteidigung und Verlustliste mitliefert. Dazu ein Zeichner-Zweig und ein Eintrag in der
Kampf-Kategorie.

**`battleOutcomeOf` kannte drei Arten nicht** (`moon-siege`, `moon-siege-defense`,
`faction-attack`) – eine gewonnene Mondbelagerung zählte weder in die Kampf-Bilanz noch löste sie
die Kampf-Nachwirkung aus. Beim Mond stehen **zwei** Zeilen da, weil `destroyed` beim Angreifer
Sieg und beim Verteidiger das Gegenteil heißt.

Der Wächter wuchs dafür auf **23 Prüfungen**: `4a` (der Helfer existiert genau einmal), `4c` (der
Weltboss-`catch` verschluckt nichts mehr — geprüft wird die URSACHE, nicht die Schreibweise),
`5`/`5b` gemessen im Spiel (die Karte nennt den Grund UND gilt nicht als Niederlage). Gegenprobe
gegen v8.588.0: **6 rot bei identischen 23 Prüfnamen**.

### Dritte Etappe: die fünf letzten Angreifer-Stellen — und der Nebeneffekt, der fast durchrutschte

`resolvePlayerAttackMission` (drei Ausgänge: Ziel unter Schutzschild, Server lehnt ab, Verbindung
weg) und der Allianzbasis-Angriff (zwei: Verbindung weg, Server lehnt ab) laufen jetzt ebenfalls
über `angriffOhneKampf`. Alle fünf hingen an `showLog !== false` — beim **Offline-Nachholen**
erfuhr der Spieler dort also gar nichts.

**Der Nebeneffekt ist die eigentliche Lehre dieser Etappe.** Ein `keinKampf`-Bericht vom Typ
`player-attack` fällt in `battleOutcomeOf` auf die Zeile

```js
if (r.type === 'npc-attack' || r.type === 'player-attack') return r.result === 'win' ? 'win' : 'loss';
```

— ein am Schutzschild **abgeprallter** Angriff wäre also als **Niederlage** in die Kampf-Bilanz
gewandert. Gemessen an der ausgeführten Funktion: alter Stand `abgeprallt: "loss"`, neuer Stand
`abgeprallt: null`. `if (r.keinKampf) return null;` steht deshalb ganz vorn, aus demselben Grund wie
das `'escaped'` der Piraten sechs Zeilen darunter: **kein Kampf ist kein Ausgang.**

Das ist Punkt 6 der Checkliste in seiner unangenehmsten Form: Nicht eine Anzeigestelle behielt die
alte Annahme, sondern eine **Auswertung**, die einen neuen Zustand nach einer Regel beurteilte, die
für ihn nie gedacht war. Wer ein neues Zustandsfeld einführt (`keinKampf`, `verpasst`, …), sucht
deshalb jede Funktion, die nach `result`/`type` urteilt — nicht nur jede, die zeichnet.

Wächter: Abschnitt 6 des Berichtspflicht-Tests, **ausgeführt** statt gegreppt (Hausregel 43) und
mit der Gegenrichtung als eigener Zeile (`6b`: echter Sieg und echte Niederlage zählen weiterhin —
sonst hätte die neue Zeile die ganze Bilanz stilllegen können).

### Was NOCH offen ist – gemessen, aber nicht behoben

**Nichts mehr aus der ursprünglichen Liste.** Der letzte Punkt (der angefochtene Schürfrecht-Halter)
ist am 21.08.2026 mit v8.597.0 erledigt – und war beim Nachmessen viel mehr als eine Berichtslücke,
siehe den eigenen Abschnitt „Wer sein Schürfrecht verteidigt" weiter unten.

**KORREKTUR zur eigenen Liste:** Hier stand „wer ausgespäht wird (nur Postfach-Meldung)" als
Lücke. Nachgemessen ist das **keine**: Die Verteidiger-Benachrichtigung läuft über
`storageSet('spyping:'+targetId, …)` **und eine eigene, abschaltbare Web-Push-Kategorie**. Der
Spieler wird also benachrichtigt — nur nicht per Bericht, und das ist eine Gestaltungsentscheidung,
keine stille Lücke. Der Eintrag stammte aus einem Prüf-Durchgang, dessen Urteil am Wochenlimit
ausgefallen war; ich hatte ihn als „ungeprüft" markiert und trotzdem in der Liste geführt. **Ein
ungeprüfter Befund gehört nicht in dieselbe Aufzählung wie ein gemessener** (Regel 10).

**Ausdrücklich KEINE Lücke sind die Start-Prüfungen** (`sendAllianceBaseAttack` &Co.: „nicht genug
Treibstoff", „alle Kampfschiffe im Einsatz", „Abklingzeit"). Dort ist die Flotte nie geflogen — ein
Bericht über einen Angriff, den es nicht gab, wäre selbst eine Falschaussage. Geprüft und bewusst
so gelassen.

**Wer eine dieser Stellen anfasst, baut den Bericht ein, statt nur zu loggen** – und `1a` des
Wächters sorgt dafür, dass die neue Art dann auch gezeichnet wird.

### Bonuscodes (21.08.2026, v8.598.0 · Backend #155)

**Auftrag Sascha:** „ich will ab und zu mal bonuscodes posten wo die spieler kleine geschenke
bekommen die codes sollen aber nur eine gewisse gültigkeit haben also max 1 mal pro account einlösbar
und nur 1 woche etc aktiv am liebsten baust du mir das in den admin bereich ein."

Fünfter Reiter im Admin-Overlay („Codes"), Eingabefeld unter **Einstellungen → Bonuscode einlösen**,
Gutschrift über die Belohnungs-Warteschlange. Die serverseitigen Regeln und ihre Begründungen stehen
in der **Backend-CLAUDE.md**; hier nur, was das Frontend angeht.

### Der eigene `type:'bonuscode'` in `claimPendingRewards` ist PFLICHT, nicht Kosmetik

`claimPendingRewards` weist einen unbekannten Belohnungstyp **nicht ab** – er fällt in den
Rückfall-Zweig, und der meldet wörtlich **„Dankeschön vom Team: +500 Kredite für deinen
Bug-Report!"**. Bei einem Code ohne `credits` steht dort sogar **„+NaN Kredite"**, weil die Meldung
außerhalb des `if (r.credits)` liegt. Beides in der Gegenprobe gemessen (`3a`/`3f`), nicht vermutet.

**Der Zweig darf außerdem nicht werfen.** `claimPendingRewards` läuft komplett in einem stillen
`try/catch`, und der Server hat den Eintrag beim Abholen **bereits aus der Warteschlange entfernt** –
eine Ausnahme bricht die Schleife ab und die Belohnung ist unwiederbringlich weg. Deshalb filtert
der Zweig jeden Wert einzeln (`Math.floor`, `> 0`), statt dem Server zu vertrauen.

Roh addiert wie der `festung`-Zweig darüber, also **ohne Lagerdeckel**: Ein Geschenk, das am vollen
Lager verpufft, wäre die unfreundlichere Auslegung, und die Beträge sind klein.

### Die Fläche folgt dem Referral-Block – bis auf einen Punkt

Das Eingabefeld liegt im vorhandenen `prog-section data-sec="konto"` (kein eigener Abschnitt, sonst
bräuchte es einen Eintrag in `PROG_SECTIONS.einstellungen`), mit derselben Sichtbarkeitsbedingung
`useBackend() && accountUsername`. **Der Unterschied ist die Ablehnung:** Der Einladungs-Bonus
verschweigt seine bewusst – er löst sich im Hintergrund ein, ohne dass der Spieler etwas angeklickt
hat, und der Kommentar dort begründet es. Ein Bonuscode ist eine **bewusste Bedienhandlung**; ein
stiller Fehlschlag wäre genau die tote Fläche, gegen die Regel 35 geschrieben ist. Der Grund steht
deshalb in einer **bleibenden** Zeile (`#bonusCodeStatus`) – `log()` überschreibt sich mit der
nächsten Meldung selbst.

Dazu ein **Bericht** (`type:'bonuscode'`, ohne Gewonnen/Verloren-Pille, eigenes Symbol `ti-award`) –
die dauerhafte Auskunft, was gutgeschrieben wurde.

### Zwei Fallen, beide beim Bauen aufgetreten

- **Die Verdrahtung MUSS `onclick =` sein, nie `addEventListener`.** Sie liegt in `render()`, und das
  läuft jede Sekunde – ein `addEventListener` hätte nach einer Minute 60 Handler und schickte den
  Code 60-mal ab. `test_bonuscodes` 5a misst das über den Spielerweg: ein Klick nach mehreren Ticks
  darf genau **eine** Anfrage auslösen.
- **`resName` gibt es nicht, die Funktion heißt `resLabel`** (Regel 4: Namen ablesen, nicht raten).
  Der Syntax-Check hätte das nicht gefangen – `new Function` parst nur.

### Die Gaben-Felder im Admin-Bereich kommen VOM SERVER

`GET /admin/bonuscodes` liefert `gaben` und `laufzeiten` mit; das Frontend zeichnet die Eingabefelder
daraus. Eine Tabelle hier wäre die zweite Kopie der Obergrenzen, die beim nächsten Umbau
auseinanderläuft – dieselbe Entscheidung wie bei den Kosmetik-Bedingungen. `test_bonuscodes` 6b/6c
hält das fest.

Wächter: `tests/test_bonuscodes.js` (27 Prüfungen, zwei Gegenproben). **Die zweite Gegenprobe ist die
aussagekräftige:** Nur den `bonuscode`-Zweig entfernt, alles andere gelassen – dann meldet das Spiel
`{"zeilen":["Dankeschön vom Team: +500 Kredite für deinen Bug-Report!"]}` bzw. `+NaN Kredite`, und
Erz wie Kampfpunkte kommen gar nicht erst an.

**Und ein eigener Werkzeugfehler, der Regel 34 belegt:** Die erste Gegenprobe gegen `origin/main`
lief mit **24 statt 27** Prüfungen – der Test starb beim Aufbau von Abschnitt 6e, weil es die
Admin-Felder dort nicht gibt, und `6e`/`6f` liefen nie. Der rote Exit-Code sah wie eine vollständige
Gegenprobe aus. Der Aufbau steht seitdem in `try/catch` und meldet seinen Fehlschlag als eigene
Prüfung `6e-bau`.

## Wer sein Schürfrecht verteidigt (21.08.2026, v8.597.0) – die Lücke war nicht der Text

Der letzte offene Punkt der Berichts-Familie. Nachgemessen im Browser war er **zwei** Befunde, und
der zweite ist der schwerere:

**(1) Die Berichtslücke.** In BEIDEN Ausgängen gab es nur eine `log()`-Zeile – die überschreibt sich
mit der nächsten Meldung selbst (Regel 47) und ist beim Offline-Nachholen ganz stummgeschaltet.
Gemessen: `reports: []` in beiden Läufen. Das Postfach nennt den Vorgang zwar, aber es gibt ihn nur
mit eigenem Server, es lässt sich wegwischen, und es nennt weder die verlorenen Schiffstypen noch,
was übrig ist.

**(2) Die Geisterflotte.** `asteroidEskortenSync()` überspringt jeden Platz, der nicht mehr mir
gehört (`p.halter !== eigen`). Nach einer **verlorenen** Anfechtung gehört er dem Angreifer – der
lokale Eskorten-Eintrag blieb also mit der vollständigen **Vorkampf**-Flotte stehen. Gemessen: 20
Kreuzer stationiert, Recht verloren, das Kartenmenü bot „Gestrandete Eskorte zurückrufen (**20
Schiffe**)" an, und ein Klick erzeugte eine `mining-recall`-Mission mit 20 Kreuzern – obwohl der
Server sie in diesem Kampf vernichtet hatte (`gegnerVerlustAnteil = 1`, wenn der Angreifer gewinnt).
**Ein verlorenes Schürfrecht kostete den Verteidiger damit keinen einzigen Schiffsverlust.** Wer
nicht zurückrief, hatte stattdessen einen dauerhaft blockierten Flottenslot – und die einzige
Meldung, die er dabei zu sehen bekam, war falsch: „Das Schürfrecht bleibt bestehen, ist aber
unbewacht."

**Die übertragbare Lehre, und sie ist der Kern dieser Etappe: Ein Zustand, den der Code nicht
UNTERSCHEIDEN kann, existiert für ihn nicht.** Ein aufgegebenes Recht sieht im Felddokument genau
wie ein verlorenes aus – Halter weg, `eskorte` weg, denn `/asteroid/release` löscht sie ebenfalls.
Nur im ersten Fall stehen die Schiffe wirklich noch da, und das Kartenmenü bietet den Rückruf zu
Recht an. Ein Fix, der die beiden Fälle **rät**, vernichtet im aufgegebenen Fall Schiffe – und das
ist die teurere Richtung. Die Unterscheidung muss deshalb von dort kommen, wo sie **entsteht**:
`vork.letzterKampf` (Backend #151), geschrieben in beiden Ausgängen der Anfechtung.

**Vier Dinge, die man beim Anfassen wissen muss:**

- **`asteroidVerteidigungBuchen()` ist die EINE Buchungsstelle** (Regel 43). Beide Wege gehen
  hindurch: der Kampfvermerk und der **Rückfall** über die gemessene Differenz (alter Server, oder
  ein Kampf von vor v8.597.0). Der Rückfall kennt weder Angreifer noch Ausgang – der Bericht sagt
  dann „ein Angreifer", statt etwas zu behaupten.
- **Der Vermerk-Zweig steht VOR dem Halter-Filter**, und genau darin liegt der Punkt: Im gemessenen
  Fehlerfall gehört das Vorkommen jemand anderem. Dahinter wäre er wirkungslos.
  `test_schuerfrecht_verteidigung` 0c prüft die REIHENFOLGE im Funktionsrumpf, nicht die
  Anwesenheit.
- **Zwei Wachen, beide nötig.** `kampfGebucht` verhindert die Doppelbuchung im **abgewehrten** Fall,
  wo der Eintrag stehen bleibt; `zeit >= seit` schützt vor einem Vermerk, der **älter** ist als die
  Stationierung – er hängt am Vorkommen und überlebt einen Besitzwechsel. Ohne die zweite würde eine
  frisch stationierte Eskorte durch einen längst abgegoltenen Kampf dezimiert (Abschnitt 3 des
  Wächters).
- **Abgezogen wird nie mehr, als lokal wirklich steht.** Der Server kann einen älteren Bestand
  kennen; die sichere Richtung ist die kleinere Zahl.

**Der Hilfetext beschrieb die Anfechtung nur aus ANGREIFER-Sicht** („Verlierst du, behält der Halter
sein Recht und du deine Überlebenden") – über die eigene Wache stand kein Wort. Der Abschnitt nennt
jetzt beide Ausgänge, inklusive der unbequemen Zahl: Geht das Recht verloren, ist die Wache
**vollständig** gefallen.

**Die Auslieferungsreihenfolge ist hier gleichgültig** (anders als bei den Festungen, Regel 60):
Backend allein live schreibt ein Feld, das niemand liest; Frontend allein live liest ein Feld, das es
nicht gibt, der Zweig feuert nie, und der Rückfall über die Differenz arbeitet weiter wie bisher.
Kein Schalter nötig.

Wächter: `tests/test_schuerfrecht_verteidigung.js` (26 Prüfungen – Quelltext-Reihenfolge, gemessene
Wirkung, gerenderte Berichtskarte, Kartenmenü und die Rückruf-Meldung). Gegenprobe gegen
`origin/main` per `KEPLER_SPIELDATEI`: **16 rot bei identischen 26 Prüfnamen** (per `diff`
verglichen, nicht gezählt – Regel 60), und `1e` zeigt den Vorfall wörtlich:
`{"eintraege":["Gestrandete Eskorte zurückrufen (20 Schiffe)"]}`.

**Ein Werkzeugfehler dabei, der Regel 28 belegt:** Der erste Entwurf las die gerenderten
Berichtskarten und fand **keine** – der Mock legte den Bericht ohne `id` und `time` ab, die der echte
Server in `addReport` ergänzt. Ohne Zeitstempel zeichnet der Client keine Datumszeile, und die
Kartensuche des Tests fand nichts. Die Folgeprüfung „die Karte ist NICHT als Gewonnen markiert" war
dadurch **grün über einer leeren Zeichenkette**. Seitdem steht vor jeder Kartenprüfung eine
`*-vorab`-Zeile, die belegt, dass überhaupt eine Karte gezeichnet wurde. **Wer einen Server
nachbaut, muss auch das nachbauen, was der echte Server ERGÄNZT – nicht nur, was er speichert.**

**Und eine Verschärfung an `test_berichtspflicht` aus demselben Anlass:** Seine Erzeuger-Suche
verlangte `type:` direkt hinter der öffnenden Klammer und übersah damit jeden `pushReport`-Aufruf mit
umbrochenem Argumentobjekt – der neue Typ wurde als „Zweig ohne Erzeuger" gemeldet. Das ist derselbe
Fehler, gegen den dieser Test gebaut ist, nur im Messwerkzeug: ein Muster, das eine SCHREIBWEISE
kodiert statt der Sache (Regel 3/40). Wäre nur der Erzeuger dagewesen und der Zweig nicht, hätte
`1a` den Fehlschlag **verschwiegen**. Er liest jetzt mehrzeilig, und `1-vorab2b` belegt, dass er die
umbrochene Form wirklich findet – sonst erblindet er still, sobald jemand das Muster wieder verengt.

### Ein erfolgreicher Bericht trug die Pille „Verloren" (21.08.2026, v8.597.0)

**Spieler-Report Sascha mit Screenshot:** „warum wird der bericht als verloren markiert ich habe
ressourcen abgebaut undzwar erfolgreich."

`reportIsPositive()` urteilte am Ende allein nach `result` und akzeptierte nur `'win'` oder
`'destroyed'`. **Eine Berichtsart, die gar kein `result` führt, fiel damit zwangsläufig auf
„Verloren"** – roter Streifen, rote Pille, Warndreieck, und im Filter unter „Nur Rückschläge".
Betroffen waren gemessen **vier** ausgelieferte Arten: `mining` (die häufigste Berichtsart des
ganzen Spiels), `peilung`, `debris-cleared` und `deckelausgleich`. Auf dem Screenshot standen 38,0k
Erz und 1,6k Antimaterie als Ertrag – und daneben „VERLOREN".

**Derselbe Screenshot zeigte eine zweite Ausprägung:** Die KI-Abfangautomatik („Piraten vertrieben")
trägt `result:'ki-intercept'` – ein Wert, den die Liste nicht kannte. `'escaped'` steht bewusst
weiter nicht drin: Dort sind die Piraten mit der Beute weg, das *ist* ein Rückschlag.

**Die Behebung ist nicht, vier Namen nachzutragen – die Regel wird umgedreht.** Eine von Hand
geführte Positivliste ist genau die Fehlerklasse dieses Projekts (Regel 40); sie hätte beim nächsten
neuen Berichtstyp erneut versagt. Seit v8.597.0 gilt: **Eine Berichtsart ohne Ergebnisbegriff ist
kein Rückschlag.** Rot bekommt nur, wer nachweislich etwas verloren hat; die zwei Arten, die das
ohne `result` tun (`pvp-fleet-loss`, `deckelkappung`), stehen namentlich in
`REPORT_OHNE_ERGEBNIS_NEGATIV`. Eine künftige Art ist damit **automatisch richtig** eingefärbt statt
automatisch falsch.

**Drei Stellen, drei Wahrheiten – und die dritte hätte ich fast übersehen:**

1. `reportIsPositive` – Pille, Streifenfarbe, Ergebnis-Filter. Die Regelumkehr.
2. `REPORT_SPECIAL_GREEN_TYPES` – dort tragen die vier Arten jetzt **gar keine Pille**. Über einer
   heimgekehrten Abbaufuhre ist auch „Gewonnen" schief; die Frage stellt sich dort nicht.
3. **`const won`** (Z. 40352) – eine ZWEITE Wahrheit über „Erfolg", die nur `result` gegen
   `'win'`/`'destroyed'` prüft. Sie steuert das Kartensymbol im Rückfall, und deshalb trug die
   KI-Abfangautomatik weiterhin ein **Warndreieck** über vertriebenen Piraten. Der Rückfall benutzt
   jetzt `positive`; `won` bleibt für die PvP-Titel („Sieg"/„Niederlage"), wo es wirklich um den
   Kampfausgang geht. Gefunden hat es kein Lesen des Codes, sondern die Frage, warum der Screenshot
   ein Warndreieck zeigt.

Dazu haben `mining`, `peilung`, `debris-cleared` und die zwei Deckel-Arten jetzt **eigene
Kartensymbole** statt Schild bzw. Warndreieck – alle fünf benutzen die Zeichner-Zweige im Text schon,
sind also nachweislich im Icon-Subset. Und `const isSpecial` (Z. 40930) war **toter Code**: definiert,
nirgends gelesen. Entfernt.

**Der Wächter ist datengetrieben** (`test_berichtspflicht` Abschnitt 7): Er rechnet JEDE erzeugte
Berichtsart durch die ausgeführte `reportIsPositive` und meldet, welche als Rückschlag gilt. Zwei
Gegenproben, beide beidseitig gefahren – Regelumkehr zurück → `7a` mit 13 Namen; `ki-intercept` aus
der Liste → `7c` mit `{"kiAbfang":false}`. Jede Gegenprobe führt die Liste der Prüfungen mit, die
fallen MÜSSEN, und meldet `WERKZEUGFEHLER`, wenn eine grün bleibt (Regel 71).

**Zwei eigene Werkzeugfehler beim Bau dieses Wächters, beide sofort gefangen:**

- Der erste Entwurf las die `result`-Werte je Art aus einem **Fenster von 700 Zeichen** hinter dem
  `pushReport`-Aufruf und meldete 21 Arten als „ohne Ergebnis" – darunter `moon-siege` und
  `alliance-base-attack`, die sehr wohl eines tragen. Wörtlich der Fehler, der im Abschnitt direkt
  darunter als Regel steht. **Das Fenster braucht es gar nicht:** Die Funktion selbst sagt, wer über
  einen eigenen Zweig verfügt und wer generisch behandelt wird.
- `asteroid-contest` wurde dabei als „falsch rot" gemeldet – ein Testartefakt, kein Befund: Die Art
  hat einen eigenen Zweig über `gewonnen`, und der Test fütterte ein Objekt ohne dieses Feld. **Arten
  mit eigenem Zweig gehören nicht zur Fehlerklasse** und werden ausgenommen.

**Und ein Test musste angepasst werden, ohne ihn zu schwächen** (Regel 26/43): `test_raidbericht` 3a
suchte die Wortform `r.result==='win' || r.result==='destroyed'` und fiel auf korrektem Code durch,
als die Werte in die benannte Liste wanderten – eine festgenagelte SCHREIBWEISE (Regel 3). Er
**führt** die Funktion jetzt aus und prüft die Eigenschaft, dazu die Gegenrichtung (`3a2`: ein
verlorener Angriff bleibt negativ). Das fängt mehr als vorher, nicht weniger.

### Ein GERATENES Fenster ist kein Scope (zweimal am 21.08.2026)

Beim Nachmessen der ausgelieferten Datei zweimal derselbe Werkzeugfehler, beide Male fast als
Befund weitergegeben:

- `grep -c '} catch(e){}$'` über die **ganze** Spieldatei meldete 135 leere catch-Blöcke. Die
  Aussage galt dem Weltboss; gescopt auf seinen Block ist sie eindeutig. Viele der 135 sind
  legitim (`localStorage`-Zugriffe).
- `S.slice(p, p+4000)` um `resolvePlayerAttackMission` meldete **0** Berichte. Die Funktion ist
  **16.570** Zeichen lang — das Fenster endete vor den Aufrufstellen. Über die echte Klammertiefe
  gemessen: 3.

**Vorgehen:** Ein Block wird über seine **Grenze** geschnitten (Klammertiefe, Anker-Paar), nie über
eine geschätzte Zeichenzahl — und der Anker selbst gehört geprüft (Regel 6). Ein `+4000` ist
dieselbe Art Annahme wie ein eingetippter Erwartungswert (Regel 2): Es sieht nach Messung aus und
ist eine Schätzung. Beide Male hat nur das Nachrechnen VOR dem Weitergeben den Fehlalarm
verhindert (Regel 10).

### Die Kurzform für jede neue Angriffsart

1. **Jeder** Ausgang schreibt `pushReport` – auch „kein Kampf", „abgelehnt", „Ziel weg". Der
   Bericht nennt den **Grund**.
2. Der Berichtstyp braucht einen **Zweig in `renderReportsBox`** und einen Eintrag in
   `REPORT_CATEGORIES`.
3. Der Zweig nennt: mit welcher Flotte, gegen was, mit welchem Ausgang, welche Verluste, welche
   Beute – und **warum** es so ausging.
4. Bei einer VERTEIDIGER-Sicht: `reportIsPositive` prüfen, bevor man sich auf `result` verlässt.

## Rückfragen: immer mit Auswahlmöglichkeiten (Wunsch Sascha, 18.08.2026)

**Wortlaut des Auftrags: „wenn du fragen hast gib mir immer auswahlmöglichkeit".**

Eine offene Frage („Wie soll ich das machen?", „Was meinst du dazu?") schiebt die ganze Denkarbeit
zurück und kostet Sascha mehr Zeit als das Problem wert ist. Gefragt wird deshalb **nie ohne
vorbereitete Antworten**:

- **Konkrete, benannte Optionen** statt einer offenen Frage – jede so formuliert, dass man sie
  auswählen kann, ohne nachzufragen, was gemeint ist.
- **Je Option die Folge dazusagen**, nicht nur den Namen: was sie kostet, was sie bringt, was sie
  ausschließt. Eine Auswahl ohne Konsequenzen ist wieder eine offene Frage, nur mit Knöpfen.
- **Eine Empfehlung nennen und begründen** – sie steht an erster Stelle und ist als solche
  gekennzeichnet. Wer eine Wahl vorlegt, hat sich schon Gedanken gemacht; die gehören dazu.
- Technisch heißt das: **`AskUserQuestion` mit 2–4 Optionen**, nicht eine Frage im Fließtext.

**Und die Vorbedingung, die diese Regel erst richtig macht:** Gefragt wird ohnehin nur, wenn
verschiedene Lesarten zu *wesentlich* anderer Arbeit führen. Alles, was sich aus dem Code, dem
Konzept oder den Hausregeln beantworten lässt, wird gemessen statt gefragt (Regel 10/41: erst
nachsehen, dann behaupten). Eine Auswahl vorzulegen ist kein Ersatz dafür, selbst nachzusehen.

## Sprache: durchgehend Deutsch (Auftrag Sascha, 19.08.2026)

„immer auf deutsch bitte" – das gilt für **alles**, was aus dieser Arbeit herauskommt, nicht nur
für den Spielertext: Antworten im Sitzungsverlauf, Commit-Botschaften, PR-Titel und -Beschreibungen,
Kommentare im Quelltext, Prüfungsnamen in den Tests und die Einträge in dieser Datei.

Der Grund ist derselbe wie bei allem anderen hier: Sascha liest es. Ein englischer Befund in einem
PR-Text ist für ihn Arbeit, die er nicht bestellt hat – und ein Bericht, den der Adressat nur mit
Mühe liest, ist kein Bericht (dieselbe Überlegung wie bei der Restzeit-Anzeige des Markts, die
bewusst als Dauer und nicht als Uhrzeit erscheint).

**Die eine Ausnahme sind Bezeichner im Code**, wo die Umgebung sie vorgibt: `fleet`, `state`,
`composition`, `type:'nest-angriff'`, HTTP-Feldnamen, Backend-Antworten. Sie stehen im Vertrag mit
dem Server bzw. mit dem Bestand und werden nicht eingedeutscht – neue EIGENE Bezeichner dagegen
schon (`pveVerlusteBuchen`, `baustelleRestKosten`, `kbMarkerFrei`), so wie es dieses Projekt seit
jeher hält.

## Das Sitzungs-Token liegt nicht mehr in localStorage (19.08.2026, Audit P3 Etappe b)

Bis hierher stand der Token in `localStorage['kepler7_token']`. Beim Audit wurde **keine** XSS-Lücke
gefunden, aber bei 56.400 Zeilen mit direktem `innerHTML`-Rendern ist die Frage nicht, ob je eine
entsteht – und die erste wäre mit **einer Zeile** eine vollständige Kontoübernahme gewesen. Seit
Etappe b trägt die Sitzung ein HttpOnly-Cookie (`kepler7_sid`), das JavaScript gar nicht erst lesen
kann. Die Backend-Hälfte (`POST /api/logout`, Cookie-Nachreichung) steht in der Backend-CLAUDE.md.

**Die eine Zeile, die jeden Spieler gleichzeitig ausgesperrt hätte** – im Browser gemessen, bevor
etwas gebaut wurde: `'Bearer '+authToken` ergibt bei `authToken === null` wörtlich den Header
`Bearer null`. Die Wache des Servers sieht damit einen Bearer-Header und schaut das Cookie **gar
nicht mehr an**; jede frische Anmeldung wäre in einen 401 gelaufen. `backendFetch` setzt den Header
deshalb nur noch bei wirklich vorhandenem Token. Dieselbe Messung hat nebenbei gezeigt, dass
`credentials: 'include'` **nicht gebraucht** wird: Ein nacktes `fetch()` schickt das Cookie bei
gleicher Herkunft von selbst mit (Gegenprobe `credentials:'omit'` – dann nicht).

**`authToken` taugt nicht mehr als „bin ich angemeldet?" – dafür gibt es `sitzungAktiv`.** Bei einer
frischen Anmeldung bleibt `authToken` bewusst `null`; er ist nur noch der **Altbestand**. Zwei
Stellen lasen ihn als Flagge, und beide wären zu Falschaussagen geworden: `useBackend()` hätte das
ganze Mehrspieler-Spiel abgeschaltet, und `asteroidClaim` hätte einem angemeldeten Spieler „Dafür
musst du angemeldet sein" gesagt (Punkt 6, die klassische zweite Anzeigestelle – gefunden per
`grep`, nicht beim Lesen).

**Die Reihenfolge im Boot IST der Migrationsweg**, und sie ist bewusst so herum: erst `/me` **ohne**
Bearer (dann entscheidet das Cookie), erst danach ein noch gespeicherter Token. Greift das Cookie,
wird der gespeicherte Token weggeräumt – ohne Neuanmeldung. Greift es nicht, spielt der Spieler
exakt wie vorher weiter. **Niemand wird durch diese Auslieferung ausgesperrt**, und genau das ist
die Prüffrage, an der die Auslieferbarkeit hängt – nicht die Behebung selbst.

**Abmelden braucht seit dem eine Server-Route.** Ein HttpOnly-Cookie kann JavaScript nicht löschen;
ohne `POST /api/logout` hätte ein Klick auf „Abmelden" den localStorage-Rest weggeräumt, neu
geladen – und das Cookie hätte den Spieler stillschweigend **wieder angemeldet** (gemessen, siehe
unten). Das `await` vor dem `location.reload()` ist deshalb keine Höflichkeit: Lädt die Seite neu,
bevor die Antwort da ist, kommt die Lösch-Kopfzeile nie an.

**Und `sitzungBeenden()` prüft den STATUS, nicht nur, dass der Aufruf nicht geworfen hat.** Ein 404
wirft nicht. Kennt der Server die Route nicht – weil sein Deploy hängt, und das ist diesem Projekt
**sechsmal** passiert, zuletzt genau mit dem Commit dieser Etappe –, käme sonst ein stilles
„abgemeldet" heraus, während die Sitzung weiterlebt. Auf einem geteilten Gerät ist das genau der
Fall, den ein Abmeldeknopf verhindern soll. Bei `false` wird deshalb **nicht** neu geladen, der
lokale Zustand **nicht** abgebaut (sonst stünde das Spiel halb angemeldet da – außen lebendig,
innen tot), und der Fehlschlag wird benannt. Dasselbe Muster kennt „Alle Sitzungen beenden" schon,
das den 404 eines veralteten Servers seit jeher ausspricht statt ihn zu verschlucken.
Die zwei Verlust-Pfade (`handleSaveConflict`, `handleSessionSuperseded`) rufen dagegen
`sitzungLokalAbraeumen()` **unbedingt** auf: Dort ist die Sitzung ohnehin verloren, und es gibt
nichts, was der Spieler stattdessen tun könnte.

### Drei Funde aus den Gegenproben, jeder über den Einzelfall hinaus

1. **Eine Prüfung, die die ANZEIGE misst statt des Mechanismus, war gegen einen kaputten Server
   grün.** Der erste Entwurf von `test_sitzungscookie_front.js` fragte nach dem Abmelden nur, ob
   wieder der Anmeldebildschirm steht. Gegen einen Server, dessen `/api/logout` das Cookie **nicht**
   löscht, blieb das grün. Isoliert nachgemessen ist der Unterschied eindeutig – echter Server:
   Kekse `[]`, `/api/me` 401; ohne Löschung: Cookie bleibt, `/api/me` **200**. Geprüft wird deshalb
   zuerst der Cookie-Bestand des Browsers und die Antwort des Servers, erst danach die Anzeige.
   (Arbeitsregel 61, hier an einer Sicherheitsfrage.)
2. **Ein verwaister Prozess aus einem abgebrochenen Lauf entwertet jede spätere Gegenprobe.** Zwei
   frühe Läufe waren an einem Playwright-Timeout gestorben und hatten ihr Backend nicht abgeräumt.
   Die „sabotierte" Gegenprobe sprach danach mit dem **echten** Server von vorhin – sie war grün und
   belegte nichts, und ich habe eine ganze Runde lang die falsche Erklärung gesucht. Behoben in
   beide Richtungen: Der äußere Fehlerausgang räumt jetzt auf, **und** der Test prüft vor dem Start,
   ob der Port schon belegt ist. Dieselbe Familie wie Regel 15/17/19 – nie ein Messwerkzeug, das
   sich selbst im Weg steht. **Übertragbar: Wer einen Test schreibt, der einen Serverprozess
   startet, muss beide Enden versorgen – Aufräumen im Fehlerfall UND eine Wache gegen einen fremden
   Prozess auf demselben Port.**
3. **Ein Test, der die REPRÄSENTATION einer Sache misst, veraltet mit jedem Umbau daran.**
   `test_marktlimit_abmeldung` prüfte „die Sitzung besteht" am Token in `localStorage` – nach dem
   Umbau meldete es für JEDEN Lauf „abgemeldet", auch für einen völlig gesunden. Die bequeme Lösung
   wäre gewesen, die Prüfung zu streichen; die geschützte Eigenschaft („ein temporärer Fehler darf
   NIE zur Abmeldung führen") gilt ja unverändert. Sie misst jetzt die **Wirkung** und ist dadurch
   schärfer als vorher: Ein abgemeldetes Spiel setzt `saveConflictDetected` und stellt das Speichern
   **komplett** ein – `2a2` verlangt also, dass nach dem Rate-Limit weiter Speicherversuche
   ankommen (gemessen 3 → 4), und `3b` als Gegenstück, dass sie beim ECHTEN Konflikt aufhören
   (4 → 4). Erst das Paar sagt etwas aus. Nebenbei war `3b` vorher „das Token ist entfernt" – seit
   dem Umbau trivial erfüllt, weil nie eines geschrieben wird (Regel 28).

### Der Wächter

`tests/test_sitzungscookie_front.js` (22 Prüfungen) startet den **echten** `server.js` aus dem
Nachbar-Repo und legt einen winzigen Proxy davor, damit Spieldatei und `/api` aus Browser-Sicht
dieselbe Herkunft haben – sonst schickt der Browser das Cookie gar nicht erst mit. Liegt das
Backend-Repo nicht daneben, überspringt er sich mit klarer Meldung. Ein Test gegen einen
nachgebauten Server hätte genau das gemessen, was ich beim Nachbauen angenommen habe.

**Die entscheidende Prüfung ist 5/6, nicht 1.** Dass nach einer frischen Anmeldung nichts mehr in
`localStorage` steht, ist die Behebung. Ob sie ausgeliefert werden DARF, entscheidet 5: ob eine
BESTEHENDE Anmeldung von vor heute noch hereinkommt. 6 misst dazu, dass so ein Spieler auch wirklich
migriert – ohne das wäre die Behebung für den Bestand 180 Tage lang wirkungslos.

**Drei** Gegenproben, alle beidseitig gefahren, alle **22** Prüfungen in jeder Richtung gelaufen:
alte Spieldatei → **9 rot**; Server ohne Cookie-Löschung → **3 rot**, darunter der Beleg
`{"anmeldeflaeche":false,"abmeldeknopf":true}` (ohne die Route meldet „Abmelden" wieder an);
Spieldatei ohne die Statusprüfung → **2 rot** mit `{"markeUeberlebt":false}`.

**Prüfung 8 hat die Gegenprobe zweimal gebraucht, und der erste Entwurf ist die eigentliche Lehre:**
Er fragte „steht der Spieler noch im Spiel?" – und blieb grün, obwohl die Seite neu geladen hatte,
weil das lebende Cookie ihn sofort wieder anmeldete. **Beide Fälle sehen danach identisch aus.**
Gemessen wird deshalb das Neuladen SELBST, über eine Marke im `window`, die es zerstört. Regel 28 an
einer Stelle, an der der Unterschied zwischen „behoben" und „sieht behoben aus" ein
Sicherheitsunterschied ist.

**Ein Nebenbefund, der ohne die Cookie-Messung untergegangen wäre:** Das ALTE Frontend lässt gegen
den neuen Server nach dem „Abmelden" ein **gültiges** Sitzungs-Cookie auf dem Gerät zurück (gemessen:
`kekse ["kepler7_sid"]`, `/api/me` 200). Es meldet den Spieler nicht wieder an – das alte Frontend
sieht das Cookie ja gar nicht –, aber die Sitzung lebt weiter. Das ist der Grund, diese Etappe zügig
auszuliefern statt sie liegen zu lassen.

### Auslieferungsreihenfolge: das Backend MUSS zuerst

Anders als bei P5 ist die Reihenfolge hier nicht gleichgültig. Ein Frontend, das auf das Cookie
setzt, wäre gegen einen Server ohne `POST /api/logout` und ohne Cookie-Nachreichung sofort im
Fehlerfall – der Abmeldeknopf meldete nicht ab, und Bestandssitzungen migrierten nie. Der
Backend-PR gehört deshalb **vor** diesem gemerged, und danach die 401/404-Routenmessung gefahren
(`POST /api/logout` muss 401 oder 200 liefern, nicht 404; mit einer erfundenen Route als
Negativkontrolle und einer alten als Gegenkontrolle).

**Die Bedingung ist seit dem 21.08.2026, 04:17 UTC erfüllt** – und die Wartezeit darauf betrug
**44,5 Stunden** (siebter Deploy-Ausfall, Einzelheiten in der Backend-CLAUDE.md). Gemessen, mit
beiden Kontrollen im selben Lauf:

```
POST /api/logout                 200   (neu mit #142)
POST /api/musterattack/create    401   (alte Kontrollroute)
POST /api/gibtesnicht            404   (Negativkontrolle)
```

**Belegt wurde dabei die WIRKUNG, nicht der Statuscode** (Arbeitsregel 61): Die Antwort trägt
`Set-Cookie: kepler7_sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure` – und zwar **genau
einmal**. Das ist der Fehler, den der eigene Test gefangen hatte (die Nachreichung schrieb erst
eine frische Sitzung über 180 Tage und darüber deren Löschung), live gegengeprüft. Ein 200 allein
hätte auch eine Route belegt, die gar nichts löscht.

**Nebenbefund aus derselben Messung:** Das `Secure` steht da. Damit ist `req.secure` hinter dem
nginx des Pi nachweislich korrekt – also genau die Entscheidung, die der erste Entwurf über
`PUBLIC_URL.startsWith('https://')` falsch getroffen hätte (eine Fallunterscheidung über eine
Konfiguration, die nur einen Wert annehmen KANN, ist keine). Sie ist damit nicht mehr nur
begründet, sondern an der Produktion gemessen.

## Die Flottenverteidigung sagte im Kampf etwas anderes als auf dem Bildschirm (21.08.2026)

Beim Vorbereiten von Teil A des Beute-Konzepts (Set-Boni für die Schiffsklassen-Module) war die
Frage, ob die neuen Sets auf `atk`/`hull`/`shield` wirken dürfen. Das Konzept sagt, alle drei gingen
in die Kampfkraft. **Gemessen stimmt das nur für `atk`** — und beim Nachmessen fielen vier
Abweichungen zwischen `shipDefenseContribution()` hier und `computeDefensePower()` im Backend auf.

Die vollständige Begründung, die Zahlen und die Entscheidung stehen in der **Backend-CLAUDE.md**
unter „Die Flottenverteidigung war eine Vereinfachung". Für dieses Repo zählt:

- **Das Frontend gilt** (Entscheidung Sascha). Seine vier Konstruktionen sind im Quelltext
  begründet, die Server-Vereinfachungen waren erfunden. Der Server ist auf das Frontend
  angeglichen, nicht umgekehrt — an `shipDefenseContribution` ändert sich **nichts**.
- **`hull` und `shield` sind ab jetzt PvP-relevant.** Bis hierher waren sie faktisch
  klientenseitig, weil der Server sie gar nicht las. Wer an ihnen etwas ändert, ändert damit einen
  server-autoritativen Kampfwert und muss die Backend-Kopie mitpflegen — dieselbe Kopie-Familie wie
  `SHIP_SCORE_WEIGHTS`/`computeScoreServer`.
- **Die Synergien sind die Wache.** `SHIP_SYNERGY_DEFS` trägt gemessen ausschließlich
  `speed`/`fuel`/`cargo`; nur deshalb darf der Server sie ignorieren. **Wer dort je eine auf
  `hull`/`shield`/`atk` anlegt, muss sie im Backend nachziehen** — `tests/test_schiffsmodul_paritaet.js`
  3a schlägt sonst an.

Wächter: `tests/test_schiffsmodul_paritaet.js` (heute **32 gelaufene Prüfungen**, vier Gegenproben —
jede speist eine der vier Abweichungen wieder ein und reißt ihre eigene Prüfung, bei jeweils
gleicher Prüfungszahl). Die vier Gegenproben sind seinerzeit bei 23 gefahren worden; der Abschnitt
zu den Klassen-Sets weiter unten hat neun weitere Prüfungen hinzugefügt.

**Und eine Arbeitsregel-Bestätigung aus dem Bau dieses Tests, zum dritten Mal an einem Tag:** Seine
Bausteinliste war eine Liste von 21 benannten Blöcken. Die Gegenprobe zur Schild-Basis baute
`shipShield()` wieder ein, das darin fehlte — der Test brach am Aufbau ab statt an der geprüften
Zeile, fuhr **14 statt 22** Prüfungen, und die Sabotage sah dadurch grün aus (Regel 34). Gefangen
hat es nur die `WERKZEUGFEHLER`-Wache des Messskripts (Regel 71). Der Sammler holt seither
Konstanten **und Funktionen** transitiv, kennt beide Deklarationsformen (Objektliteral und IIFE)
und leert Kommentare vor dem Sammeln (Regel 33) — die Liste ist auf die zwei Zielfunktionen
geschrumpft.

**Seit dem 22.08.2026 fängt der Test das selbst** (`4-bau3: kein Laufzeitfehler in den
Messaufrufen`): Die zwei Messaufrufe laufen durch einen Wrapper, der einen geworfenen Fehler
festhält, `null` zurückgibt und den Lauf weiterlaufen lässt. Beidseitig gegengeprüft: ohne die
Wache **15 Prüfungen und keine einzige FAIL-Zeile** — ein roter Exit-Code ohne jede Aussage —, mit
ihr 23 Prüfungen und der Grund im Protokoll
(`4-bau3 | {"fehler":"SHIP_MODULE_SET_DEFS is not defined"}`) — beides gemessen an dem Stand, den
der Test damals hatte; heute sind es 32.
**Die übertragbare Lehre geht über diesen Test hinaus: Ein `try/catch` um den AUFBAU (Regel 34)
genügt nicht, wenn die geschnittene Funktion erst beim AUFRUF wirft.** Genau daran ist es hier
gescheitert — der Aufbau war längst gefasst, der Lauf starb trotzdem mittendrin. Wer Funktionen
aus der Spieldatei schneidet und ausführt, fasst BEIDE Seiten: das Zusammensetzen und jeden
einzelnen Aufruf. Sonst hängt die Diagnose daran, dass zufällig ein Messskript mit
„was muss fallen"-Liste danebensteht (Regel 71) — und im Suite-Lauf steht dort keines.

## Etappe D: Protomaterie bekommt Abnehmer (21.08.2026)

Der Befund, aus dem die Etappe entstand, ist derselbe wie beim Kausalitätsbrecher: **Protomaterie
war eine reine EINMALZAHLUNGS-Währung.** Zwei Fabriken, die Mega-Ausbaustufen — wer die durch hatte,
hatte für den Bergbau keinen Grund mehr. Eine Ressource ohne wiederkehrenden Abnehmer ist kein
Wirtschaftskreislauf, sondern eine Checkliste.

**Fünf Posten, und die Reihenfolge ist Absicht:**

| | Posten | gemessen |
|---|---|---|
| D1 | Lagerdeckel je Aufbereitungsanlage 100 → 150 | Deckel 2.500 → 3.500 |
| D2 | Mega-Ausbaustufen-Anteil 400 → 600 | bleibt bei 17 % des Speichers statt 16 % |
| D3 | Orbitalstation Stufe 8 als erste **direkte** Proto-Stufe | 60 je Standort, über elf Standorte 660 = 26–78 Stunden |
| D4 | **Urmaterie-Koloss** — der erste wiederkehrende Abnehmer | 30 Protomaterie je Schiff |
| D5 | Schürfer-Faktor: volle Ausbeute erst ab 10 Schürfschiffen | schließt die Ein-Schiff-Pendelroute |

**D1 steht bewusst VORNE** (Regel 57): Der Lagerdeckel ist die Schranke, an der jede Proto-Senke
hängt — er wird angehoben, *bevor* unten neue Abnehmer dazukommen. Und angehoben wird die
**Stufenrate**, nicht die Basis, damit der Zuwachs am Ausbau der Aufbereitungsanlage hängt statt
geschenkt zu sein. D2 zieht im Gleichschritt nach, sonst verschöbe sich still das Verhältnis
„der Betrag lässt sich ansparen".

**D5 ist eine Behebung, kein Balance-Schritt.** Die Protomaterie je Fuhre hängt allein an der
GRÖSSE des Vorkommens, nie an der Ladung — eine Fuhre mit EINEM Schürfschiff brachte deshalb exakt
so viel wie eine mit fünfzig. Wer Flottenplätze hatte, konnte sie in lauter Ein-Schiff-Pendelrouten
zerlegen und die Ausbeute vervielfachen, ohne je eine Bergbauflotte zu bauen. Drei Entscheidungen
dabei, jede gegen einen naheliegenden Fehler:

- **Keine Skalierung ÜBER der Schwelle.** Der feste Fuhren-Charakter bleibt; sonst wäre die
  Protomaterie plötzlich mengenskaliert und liefe genau in die Falle aus Regel 41.
- **Gezählt werden echte Schürfschiffe, nicht `MINE_SHIP_KEYS`.** Dort stehen auch die drei
  Frachter — zehn Frachter mit einem Schürfschiff wären wieder dieselbe Pendelroute.
- **Der Faktor steht IN `protoJeFuhre`, nicht an ihren zwei Aufrufstellen.** Vorschau und
  Missionsstart dürfen nicht auseinanderlaufen; `test_protomaterie` 6c hat genau diese Dopplung
  schon einmal gefangen.

### Der Urmaterie-Koloss — und die acht Stellen, an denen er nicht existierte

`atk:250`, Frachtraum 2.000, Bauzeit 30 Minuten, `defWeight:1.8`, Punktegewicht 175, hinter
`rkausalanker`; Kosten 30 Protomaterie + 8 Hohlraumgitter + 6 Kausalanker. Die Kosten sind
**gemessen**, nicht aus dem Konzept übernommen (Regel 41): gegen die gefittete Preiskurve der
Kampfschiffe, nicht gegen das Gefühl.

**Der eigentliche Inhalt dieses Abschnitts ist aber der Fund.** Ein Schiff lebt in diesem Projekt an
**16 Stellen**, verteilt über zwei Repos — gemessen, nicht geschätzt: zehn im Frontend, sechs im
Backend. Beim Anlegen waren **acht** davon gepflegt, alle im Frontend (Icon, Rumpfzeichnung,
Kostenfunktion, `SHIP_DEFS`, `CARGO_PER_SHIP`, `COUNTER_ROLE_OF`, `COUNTER_ROLE_ATK`,
`SHIP_SCORE_WEIGHTS`). Die **acht fehlenden** sind genau die, in denen ein fehlender Eintrag still
0 oder einen falschen Vorgabewert ergibt — der Koloss wäre baubar gewesen und im Kampf auf beiden
Seiten nicht vorhanden:

| Tabelle | Repo | ohne Eintrag |
|---|---|---|
| `ATTACK_SHIP_KEYS` | Frontend | nicht mitwählbar für Angriff, Eskorte, Expedition, Abbau |
| `attackPowerRaw` | Frontend | trägt **0** Angriff bei |
| `rawFleetPower` | Backend | trägt **0** Angriff bei (PvP) |
| `SHIP_ATK_VALUES` | Backend | **0** in Verteidigung UND `fleetShieldSum` — ohne Vorgabewert |
| `SHIP_DEF_WEIGHTS` | Backend | Vorgabegewicht 1 statt 1,8 |
| `COUNTER_ROLE_ATK` | Backend | zählt nicht in die Flottenbalance |
| `COUNTER_ROLE_OF` | Backend | Werftmarken-Schild 0,03 statt kapital 0,04 |
| `SHIP_SCORE_WEIGHTS` | Backend | Punktestand seiner Besitzer zu niedrig |

**Warum `test_angriffssumme` das nicht melden konnte, ist die Lehre:** Er leitet seine Erwartung aus
`ATTACK_SHIP_KEYS` ab — und dort fehlte der Koloss ebenfalls. Er fiel damit durch **beide** Netze
desselben Wächters. Gemeldet hat ihn erst `test_eskorte_schiffe` 3 von der anderen Seite. Zwei der
acht (`SHIP_ATK_VALUES`, `SHIP_DEF_WEIGHTS`) hat **gar kein Test** gefunden — die fielen erst beim
Durchgehen aller Tabellen auf, die eine Schiffsklasse führen. **Diese Flanke ist seit dem 22.08.2026
geschlossen**, siehe den Abschnitt darunter: `test_paritaet_tabellen` Abschnitt 5 liest sie.
**Übertragbar: Ein Wächter, der Soll und Ist aus DERSELBEN Liste zieht, ist blind für eine Lücke in
genau dieser Liste.** Wer eine neue Schiffsklasse anlegt, zählt sie in beiden Repos nach —
`grep -c "<schluessel>"` muss **10** im Frontend und **6** im Backend ergeben.

**Zwei Klassen waren bewusst NICHT ergänzt worden**, obwohl derselbe Durchgang sie als „fehlend"
zeigte: `mondzerstoerer` fehlt in `SHIP_ATK_VALUES`/`SHIP_DEF_WEIGHTS` als **dokumentierte Absicht**
(der Backend-Kommentar sagt, ihn aufzunehmen „wäre eine ungewollte Änderung der PvP-Kampfkraft"),
und `kausalitaetsbrecher` fehlte in `SHIP_DEF_WEIGHTS`/`SHIP_SHIELD_EXPLICIT`. Das zweite war ein
Bestands-Balancefall — gemessen, benannt, und ausdrücklich **nicht** nebenbei geändert: Eine PvP-Zahl
im Vorbeigehen zu verschieben ist genau die unbestellte Zweitänderung aus dem Schiffskosten-Nachtrag.
**Sascha hat sie am 22.08.2026 entschieden: angleichen** (Backend #168, `defWeight` 1,8 und Schild
120). Er war größer als hier stand: „170 statt 120" war die halbe Angriffskraft, also genau die
**erfundene Schildbasis, die `shipShield()` bis zum 21.08.2026 lieferte** — nach dessen Entfernung
trug das Schiff **0** Schild. Ausgeführt gemessen (die zwei Server-Funktionen geschnitten und
gefahren, nicht nachgerechnet): **136 statt 365** Verteidigungspunkte je Schiff, mit voller
Kampfforschung 267 statt 600. Nicht +19 %, sondern **+168 %**.

### Der Wächter dafür: `test_paritaet_tabellen` Abschnitt 5 (22.08.2026)

Sieben Prüfungen über `SHIP_ATK_VALUES`, `SHIP_DEF_WEIGHTS` und `SHIP_SHIELD_EXPLICIT`. Geprüft wird
die **WIRKUNG, nicht die Tabellenmitgliedschaft**: Ein Schiff ohne Eintrag ist kein Fehler, es
bekommt den Vorgabewert (defWeight 1, Schild 0); falsch ist erst ein abweichender wirksamer Wert.
Drei Richtungen, die eine Feld-für-Feld-Prüfung nicht hätte — **5c2** (ein Eintrag, den
`SHIP_ATK_VALUES` nicht kennt, wird von beiden Schleifen nie gelesen: stiller toter Code, Regel 59),
**5d** (ein Schiff MIT Kampfwerten, das dort fehlt, trägt null ohne jeden Vorgabewert — die Richtung,
an der der Urmaterie-Koloss beinahe gescheitert wäre) und **5b** (das Superschlachtschiff hat keinen
`SHIP_DEFS`-Eintrag und wird trotzdem verglichen, aus `SUPERSCHLACHTSCHIFF_SHIELD`/
`SUPERSCHLACHTSCHIFF_DEF_WEIGHT`/`shipBaseAtk` — es blind auszunehmen wäre die schwächere Lösung).
Sieben Gegenproben, jede mit ihrer „was muss fallen"-Liste (Regel 71), alle mit 37 gelaufenen
Prüfungen in beide Richtungen.

**Der Werkzeugfehler beim Bau ist die eigentliche Lehre:** Die erste Messung las `SHIP_DEFS`
**zeilenweise** — wie Abschnitt 4 direkt daneben, wo das richtig ist — und meldete drei Abweichungen
bei Paktkorvette, Bundeskreuzer und Sternenbanner. Die drei Allianzschiffe tragen ihr `defWeight`
aber auf der **zweiten Zeile** ihres Eintrags; es gab keine einzige Abweichung. Beinahe wären drei
erfundene Befunde weitergegeben worden (Regel 10 hat sie abgefangen). Das ist dieselbe Familie wie
die zweizeiligen Modul-Einträge aus TX-2: Geschnitten wird vom Eintragsanfang bis zum **nächsten**
Eintragsanfang, und `5-vorab` belegt an der Paktkorvette, dass die mehrzeilige Lesung greift — sonst
wäre der Abschnitt still blind für jedes mehrzeilig definierte Schiff.

### Frachtraum UND Angriff: die erste Ausnahme von „Frachter kämpfen nicht"

`KAMPF_SHIP_KEYS` leitete sich seit v8.497.0 als „alles aus `ATTACK_SHIP_KEYS` außer den Frachtern"
ab. Gemessen tragen alle drei Frachter `atk:0` — die Gleichsetzung „hat Frachtraum" = „kämpft nicht"
war also nie eine Annahme, sondern ein Messwert. Der Koloss ist der erste Rumpf, für den sie nicht
mehr gilt.

**Sascha hat die Hybrid-Fassung gewählt** (drei Optionen vorgelegt: Hybrid behalten, Frachtraum
streichen, Angriff streichen). Umgesetzt datengetrieben statt als Namensliste:

```js
function schiffTraegtAngriff(key){ const d = SHIP_DEFS.find(s => s.key === key); return !!(d && d.atk > 0); }
const KAMPF_SHIP_KEYS = ATTACK_SHIP_KEYS.filter(k => !CARGO_SHIP_KEYS.includes(k) || schiffTraegtAngriff(k));
```

Reihenfolge vorher **gemessen**, nicht geschätzt (Regel 38): `SHIP_DEFS` bei Zeichen 2.771.655,
`KAMPF_SHIP_KEYS` bei 2.859.336 — die Ableitung ist gedeckt. Ein zweiter solcher Rumpf erbt die
Ausnahme automatisch.

**Beide Wächter sind dadurch STÄRKER geworden, nicht nachgiebiger** (Regel 43). Das ist der Punkt,
an dem eine Ausnahme zur Lockerung verkommen kann: Ohne die Gegenrichtung hätte man den Koloss
später aus der Angriffssumme nehmen können, und niemand hätte es bemerkt.

- `test_angriffssumme` teilt die Frachter jetzt datengetrieben in **bewaffnet** und **unbewaffnet**
  (`atk` aus dem `SHIP_DEFS`-Block gelesen) und verlangt für die bewaffneten ausdrücklich, dass sie
  in der Summe UND in `KAMPF_SHIP_KEYS` stehen — die neuen Zeilen 1 und 2b.
- `test_flotte_v8375` 3 prüfte die Ableitung **Zeichen für Zeichen als Regex** und fiel damit auf
  völlig korrektem Code durch (Regel 3: eine Momentaufnahme statt der Eigenschaft). Geprüft werden
  jetzt die drei Bestandteile einzeln; eine handgeschriebene Klassenliste fällt weiterhin auf, eine
  legitime Erweiterung nicht.

### Zwei eigene Werkzeugfehler, beide vor der Weitergabe gefangen

1. **Ein geratener Exportname.** `tests/lib/spieldatei.js` exportiert `SERVER_JS`, nicht
   `SERVERDATEI` — der geratene Name lief in einen `TypeError`. Regel 4, und die Umgebung sagt es,
   wenn man sie liest.
2. **Ein geratener Endanker beim Schneiden von `COUNTER_ROLE_OF`/`COUNTER_ROLE_ATK`.** Der zu große
   Ausschnitt ließ mich schließen, der Kausalitätsbrecher sei eine „Rolle ohne Gewicht" — ein
   Befund, der schon fast weitergegeben war. Über die echte Klammertiefe nachgemessen sind beide
   Tabellen vollständig konsistent, und der Kausalitätsbrecher steht in **keiner** von beiden.
   Wörtlich der Abschnitt „Ein GERATENES Fenster ist kein Scope" — zum dritten Mal innerhalb weniger
   Tage, und nur das Nachrechnen VOR dem Weitergeben hat den Fehlalarm verhindert (Regel 10).

### Der Rebase-Moment — und die Warnzeile, die diesmal gelesen wurde

Beim Start des vollen Laufs meldete Pflichtprüfung 5: *„Backend-Klon auf Höhe von origin/master,
aber origin/master ist alt (geholt vor 20,7 Stunden)."* Der Nachtrag vom 17.08.2026 zu Regel 22
beschreibt genau diesen Fall — dort stand die Warnung ebenfalls in Zeile fünf des Protokolls, und
der Lauf fiel zwanzig Minuten später. Diesmal ist sie **direkt nach dem Start** gelesen und der Lauf
sofort gestoppt worden (Regel 14/17); ein `git fetch` zeigte:

- **Backend vier Commits weiter** (#155, #156, #158, #159) — darunter #156 „Flottenverteidigung:
  vier Abweichungen zum Frontend angeglichen", also mitten im eigenen Bereich.
- **Frontend sieben Commits weiter**, vier davon mit Versionsnummer (v8.601.0 – v8.604.0).

Gemessen statt vermutet: #156 fasst die **Funktionen** an (`fleetShieldSum`,
`weightedFleetDefensePower`), nicht die Tabellen-**Definitionen** — beide Änderungssätze liegen in
verschiedenen Zeilen, der Rebase lief in beiden Repos konfliktfrei. Danach beide Seiten belegt
(Nachtrag zu Regel 13): vier fremde Patchnotes vorhanden, sechs eigene Marken im Backend vorhanden,
und der
eigene Änderungssatz gegen `origin/main` enthält nichts als Etappe D.

**Die Lehre ist nicht neu, aber sie hat diesmal getragen:** Ein 50-Minuten-Lauf gegen einen
veralteten Nachbarn ist nicht bloß langsam, er ist für jede Paritätsprüfung **wertlos** — und die
einzige Stelle, an der man das rechtzeitig sieht, ist Zeile fünf des Protokolls.

Wächter dieser Etappe: `tests/test_protomaterie.js` (Schürfer-Faktor, Vorschau-Parität),
`tests/test_orbital_tier3.js` (Stufe 8), `tests/test_schiffskosten.js` (der Koloss in der
Preiskurve), `tests/test_angriffssumme.js` und `tests/test_flotte_v8375.js` (die Hybrid-Regel),
dazu `test_eskorte_schiffe`, `test_konter_paritaet`, `test_paritaet_tabellen` und `test_werftmarken`
für die Backend-Parität.

## Klassen-Sets für die Schiffsmodule (Teil A, 21.08.2026, v8.603.0)

Auftrag Sascha: „Findbare Module die zusammen set Bonus geben." Set-Boni gab es im Spiel schon –
aber ausschließlich bei den STANDORT-Modulen (`MODULE_SET_DEFS`) und den Boss-Sets. Die 44
Schiffsklassen-Module hatten **keinen einzigen** (gemessen: 0 Treffer). Jede der acht Klassen hat
jetzt ein Set aus drei namentlich festgelegten Modulen, gestaffelt bei zwei und drei Teilen.

### Drei Entscheidungen, alle vorher gemessen

- **Bestimmte Schlüssel statt „N beliebige".** Der erste Entwurf wollte nach ANZAHL staffeln wie
  die Boss-Sets. Gemessen ist das hier **keine Entscheidung**: `equipShipModule` verbietet zwei
  Module desselben TYPS an einer Klasse („je Typ ist nur EIN Modul erlaubt"), es gibt also gar
  keine Stapel-Alternative – „zwei beliebige" wäre schlicht eine Belohnung dafür, einen zweiten
  Slot gekauft zu haben. Mit benannten Schlüsseln entsteht die Wahl: Bei drei Slots kostet das
  volle Set ALLE drei, die Zwischenstufe lässt einen Platz frei.
- **Kein Set trägt einen Kanal, den seine Klasse nicht verbraucht.** Gemessen:
  `hull`/`shield`/`speed`/`fuel` wirken in **allen** Klassen (generisch über `cls`), `atk` nur in
  `schlachtschiff` und `raffiniert`, `cargo` nur in `frachter`, `siegechance` im Frontend
  **gar nicht**. Ein Set-Bonus auf `atk` für die Schwere Linie wäre ein Tabellenfeld, das nur der
  Anzeigetext liest (Regel 59). `test_schiffsmodul_paritaet.js` 5d **leitet diese Zuordnung aus
  der Spieldatei ab** statt sie einzutippen – führt jemand einen Kanal neu generisch ein, wird die
  Wache automatisch lockerer; schafft jemand eine Verbrauchsstelle ab, schlägt sie an.
- **Der Mondzerstörer bekommt bewusst kein `atk`.** Der Server verbraucht es (Mondangriff), das
  Frontend nicht – die Vorschau verschwiege sonst eine Wirkung, die im Kampf eintritt.

### Zwei Stellen, die man kennen muss

**Der Bonus fließt an EINER Stelle ein:** `shipModuleBonusFor`. Damit erreicht er jede
Verbrauchsstelle automatisch – Tempo, Treibstoff, Laderaum, Hülle, Schild, Angriff. Eine eigene
Addition je Rechenstelle wäre die übliche zweite Wahrheit.

**Die Anzeige liegt in einer eigenen Funktion** (`shipModuleSetZeilenHtml`), damit sie ohne den
ganzen Renderer messbar ist – und weil ein Set ohne Anzeige eine versteckte Mechanik wäre: Der
Spieler könnte nicht erkennen, warum sich sein Angriffswert beim Modultausch ändert.

**PvP-Parität ist Pflicht.** Der Set-Bonus trägt `atk`/`hull`/`shield`; die Tabelle liegt als Kopie
in `server.js`, eingespeist in BEIDE Verbrauchspfade (`shipModuleBonus` für `atk`,
`shipModulKlassenBoni` für `hull`/`shield`), jeweils **vor** dem Deckel wie vorne.

### Drei Bestandstests hielten das ALTE Verhalten fest

Alle drei sind mitgezogen worden, und zwar **schärfer** statt passend (Regel 43/68):

- **`test_pvp_deckel`** verlangte, dass `'hull'` im Backend **gar nicht vorkommt** („solange der
  Server ihn nicht kennt"). Das war richtig und ist überholt. Geprüft wird jetzt die Parität:
  **beide Seiten deckeln hart** – aus „eine Seite kennt ihn nicht" wird „beide deckeln gleich".
- **`test_wertstreuung` 6e** zählte Aufrufstellen und verlangte genau **2**. Meine dritte war
  korrekt (ohne sie zählte der gewürfelte Hauptwert in der Verteidigung nicht). Ein Zähler kann
  nicht zwischen „eine Stelle vergisst den Wurf" und „es gibt eine mehr" unterscheiden (Regel 33);
  geprüft wird jetzt die REGEL, und der Fehlschlag **nennt die Zeile**.
- **`test_schiffssynergien`** schnitt `shipModuleBonusFor` aus und starb an
  `shipModuleSetBonus is not defined` – dieselbe Bausteinlisten-Falle wie `test_protomaterie` am
  selben Tag. Die zwei Funktionen und die Tabelle werden jetzt mitgeschnitten.

### Der Befund, der die Gegenprobe fast unmöglich gemacht hätte

Die Gegenprobe zum Hüllen-Deckel blieb grün, obwohl das Backend sabotiert war: **`test_pvp_deckel`
verdrahtete den BACKEND-Pfad fest** und ignorierte `KEPLER_BACKEND_SERVER` still. Der Durchgang vom
21.08.2026 hatte 25 Tests von genau diesem Defekt befreit – aber er suchte die Leser der
**Spieldatei**; die Leser von `server.js` blieben unberührt.

**Gemessen sind zwölf Tests betroffen** – zehn ganz, und zwei (`test_raid_bosswahl`,
`test_verstrickungen`) **trotz** vorhandenem `SERVER_JS`-Import, also halb umgeleitet: Bei ihnen
liefe der Browser auf der Kopie und die Backend-Prüfung auf dem Original. **Wer nach dieser
Fehlerklasse sucht, sucht nach der LESESTELLE (`kolonie-kepler7-backend'` im `path.join`), nicht
nach dem fehlenden `require`** – sonst findet er wieder nur die Hälfte.

**ERLEDIGT am 22.08.2026, und die Zahl „zwölf" oben war schon beim Schreiben eine Momentaufnahme.**
Zehn hat eine Parallelsitzung mit #481 umgestellt, `test_pvp_deckel` kam über #484, und der letzte
war `test_werftmarken` – der einzige, der KEINEN `SERVER_JS`-Import hatte, sondern eine **eigene
Kandidatenliste** mit veralteten `/workspace`-Pfaden. Sie funktionierte heute noch, weil ihr
dritter Kandidat zufällig griff; die Umleitung ignorierte sie trotzdem still.

**Der Beleg gehört zur Behebung, nicht daneben** – am alten Stand waren beide Läufe (normal und
`KEPLER_BACKEND_SERVER=/tmp/leer_server.js`) **byte-identisch**, danach Exit 0 / 323 Prüfungen
gegen Exit 1 / 312 mit `FAIL - Markenblock im Backend gefunden`, bei identischer Prüfliste zum
alten Stand (per `diff` verglichen, nicht gezählt – Regel 60). Die 323 → 312 sind erklärbar und
kein verdeckter Abbruch: Ohne gefundenen Block laufen die davon abhängigen Prüfungen nicht.

**Die Klasse ist damit geschlossen, und auch das ist gemessen statt angenommen:** Alle **elf**
Tests, die `server.js` lesen, wurden einmal normal und einmal umgeleitet gefahren – jeder liefert
umgeleitet eine ANDERE Ausgabe. Wäre sie gleich, würde die Env-Variable weiterhin still ignoriert,
und genau das sieht aus wie eine bestandene Gegenprobe.

Nebenbei mitgenommen: `test_werftmarken` bezog seine Pfade aus `lib/umgebung` und zog damit
Playwright hoch (gemessen 282 ms), obwohl es **keinen Browser** benutzt (0 Treffer auf
`playwright`/`starteBrowser`/`SPIEL_URL`). Es liest jetzt aus `lib/spieldatei`.

### Ein Nebenbefund, der NICHT behoben ist

Das Event-Modul **`ev_erzgreifer`** („Erzgreifer-Ausleger", `cargo`, `base:0.25` – der höchste
Frachtwert der Tabelle) bewirkt **nichts**. `cargo` wird ausschließlich für die Frachter-Klasse
gelesen, und alle drei Frachtschiffe (`frachter`, `frachtergross`, `bergungsfrachter`) gehören
dorthin – **Event-Schiffe haben überhaupt keine Frachtkapazität** (`CARGO_PER_SHIP` führt genau
diese drei). Seine Beschreibung verspricht ausdrücklich „erhöht die Frachtkapazität aller
Event-Schiffe deutlich … Exklusiv". Eine per-Klasse-Umstellung von `fleetCargoCapacity` änderte
daran nichts; es bräuchte Frachtraum für Event-Schiffe oder eine Umwidmung des Moduls. **Das ist
eine Entscheidung über die Identität eines Event-Gegenstands und liegt bei Sascha.**

Wächter: `tests/test_schiffsmodul_sets.js` (17 Prüfungen, drei Gegenproben) und
`tests/test_schiffsmodul_paritaet.js` (32 Prüfungen, davon neun aus Abschnitt 5).

**Eine Lücke im eigenen Wächter, die nur die Gegenprobe gezeigt hat:** Abschnitt 1 rief
`shipModuleSetBonus` **direkt** auf und blieb deshalb grün, als die Einspeisung in
`shipModuleBonusFor` entfernt wurde – er maß die Mechanik, aber nicht, dass sie ANGESCHLOSSEN ist.
Das ist Regel 61 am eigenen Test; gefangen hat es die `WERKZEUGFEHLER`-Wache des Messskripts
(Regel 71). Prüfung `1e` schließt es, **gescopt auf den Rumpf** von `shipModuleBonusFor` – ein
Aufruf irgendwo sonst in der Datei zählt nicht (Regel 39).

## Der Riegel gegen das Ereignis-Banner — und die Flanke, die viel schmaler ist als behauptet (22.08.2026)

Arbeitsregel 70 hielt fest, dass sich `maybeSpawnRandomEvent()` **nicht pinnen** lässt: keine Uhr,
0,25 % je Tick, und `state.lastEventTime` wird zwar geschrieben, aber nirgends als Sperre gelesen.
Die dortige Antwort war eine **Reparatur** — das Banner über den „Ignorieren"-Knopf wegklicken.
Diese Etappe ersetzt sie durch eine **Verhinderung** und misst dabei nebenbei, wie groß die Flanke
wirklich ist. Das Ergebnis widerlegt meine eigene Ausgangsannahme (Regel 26 in ihrer nützlichen
Richtung: eine Gegenprobe, die nicht anschlägt, IST der Befund).

### Die Sperre, die es doch gibt — sie stand in der ersten Zeile derselben Funktion

`if (state.activeEvent) return;`. Ein Ereignis mit einem Schlüssel, den `RANDOM_EVENTS` **nicht**
kennt, legt den Würfel damit still **und bleibt selbst unsichtbar**: Der Renderer findet keine
Definition und fällt in seinen else-Zweig, der das Banner auf `display:none` setzt. Regel 70 hatte
nach einer UHR gesucht und war deshalb daran vorbeigelaufen.

`ruhigeUhren()` in `tests/lib/umgebung.js` liefert seither **alle drei** Störquellen auf einmal:
`nextPlanetEventCheck`, `nextTraderCheck` und `activeEvent: { key: '__testruhe__' }`. Der
Unterstrich-Rahmen macht den Schlüssel im Spielstand sofort als Test-Riegel erkennbar, das
Ablaufdatum liegt weit in der Zukunft, damit der Tick ihn nicht per `resolveEvent('B')` auflöst.

**Gemessen an einer Kopie der Spieldatei mit 90 % Spawn je Tick** (die Fixture-Form der
Fensterlage-Tests, 390×844):

| | Banner |
|---|---|
| ohne Riegel | **144 px, sichtbar** |
| mit Riegel | **0 px, unsichtbar** |

### Die Einbaustelle ist eine Entscheidung: der Spread steht VORNE

`JSON.stringify({ ...ruhigeUhren(), tutorialSeen:true, … })` — damit gewinnt alles, was danach
kommt. Wer ein ECHTES Ereignis messen will, setzt `activeEvent` dahinter und bekommt es.
Andersherum (Spread am Ende, wie ihn der erste Nutzer `test_benachrichtigung_abgleich` hatte) hätte
der Helfer ein bewusst gesetztes Ereignis **still überschrieben**, und der Test hätte gemessen,
dass kein Banner steht, obwohl er eines wollte. `test_klappen_kollision` zeigt beide Hälften in
einer Datei, gegen dieselbe 90-%-Kopie gemessen: **0 px** ohne Ereignis, **138 px** (390×844) bzw.
**164 px** (360×740) mit gesetztem. Der Riegel verhindert den ZUFALL, nicht die Absicht.

### Der EINE Test, bei dem sich ein Ergebnis ändert — und warum eine Reparatur dort verliert

`test_klappen_kollision` hatte die Klick-Reparatur, und sie ist **besiegbar**: Gegen die 90-%-Kopie
erschöpfte sie ihre drei Anläufe und maß danach ein Banner von **153 bzw. 207 px** — genau die
Störung, gegen die sie klickt, nur mit einem schnelleren Würfel. **Eine Reparatur, die in einer
Schleife gegen eine weiterlaufende Quelle anläuft, gewinnt nur, solange die Quelle langsam genug
ist.** Mit dem Riegel: `EXIT=0`, Banner 0 px, bei identischen 16 Prüfnamen (per `diff` verglichen,
nicht gezählt — Regel 60). Die Reparatur ist deshalb ersatzlos entfernt; der Beleg ist jetzt die
`bannerHoehe` in der Vorab-Prüfung, die weiterhin 0 zeigen muss.

### Der eigentliche Befund: 41 von 42 Tests sind der Flanke GAR NICHT ausgesetzt

Die Regeln 62, 63 und 70 sagen übereinstimmend, die Flanke sei breit („87 von 160 Tests … dieselbe
Flanke wartet dort", „jeder Test, der FENSTERLAGE misst, ist ihr ausgesetzt"). **Das war nie
gemessen, und es stimmt nicht.** Gemessen am 22.08.2026, alle gegen dieselbe 90-%-Kopie:

| Gruppe | Tests | rot |
|---|---|---|
| Fensterlage-Tests OHNE gepinnte Uhren | 18 | **0** |
| Fensterlage-Tests MIT gepinnten Uhren (u. a. die vier aus Regel 63) | 23 | **0** |
| `test_klappen_kollision` | 1 | **1** |

**Das Banner steht in diesen Tests wirklich** (144 px, oben gemessen) — sie messen nur nichts, was
es verschiebt. Der Mechanismus dahinter, benannt statt vermutet (Regel 20): Das Banner sitzt im
Seitenfluss über dem Reiter-Inhalt. Wer INNERHALB eines Containers misst (Rechteck-Differenzen,
SVG-viewBox, relative Geometrie) oder sein Ziel vorher in den Blick scrollt, merkt davon nichts.
Ausgesetzt ist nur, wer eine ABSOLUTE Fensterlage ohne Scrollen misst — und das ist die
Klappen/Reiterleisten-Kollision, weil `.edge-tab` am VIEWPORT hängt.

**Und der Vorfall aus Regel 63 war eine andere Störquelle:** Dort ging es um die
**Reiter-Hinweisleiste** (166 px), und die ist über `seenTabHints` längst abgeschaltet. Die zwei
Fälle sind in Regel 70 zusammengezogen worden, obwohl nur einer das Banner betrifft.

### Mein eigenes Auswahlkriterium war zuerst falsch — und zwar auf genau die Weise, vor der Regel 70 warnt

Der erste Durchgang filterte „Tests, die `nextPlanetEventCheck` NICHT pinnen". **Pinnen hilft gegen
das Banner aber gar nicht** — die 23 Tests, die pinnen, sind ihm genauso ausgesetzt wie die 18, die
es nicht tun, und ausgerechnet die vier aus Regel 63 waren dadurch AUSGESCHLOSSEN. Wer nach der
falschen Eigenschaft filtert, bekommt eine Liste, die sich vollständig LIEST und die eigentlich
betroffenen Fälle nicht enthält (dieselbe Familie wie die Rundflug-Liste, Regel 40).

### Was übernommen wurde — und was ausdrücklich nicht

Übernommen haben den Riegel **20 Tests**: `test_klappen_kollision` (dort ändert er ein Ergebnis)
und die 18 Fensterlage-Tests ohne gepinnte Uhren, dazu `test_benachrichtigung_abgleich`, das ihn
schon hatte und nur auf die einheitliche Form gezogen wurde. Für die 18 ist er **prophylaktisch,
und das steht hier, damit es niemand für eine Behebung hält**: Er greift nachweislich (144 → 0 px),
ändert aber heute kein einziges Ergebnis. Sein Wert liegt darin, dass eine künftige Prüfung in
einer dieser Dateien nicht still einem 144-px-Zufall ausgesetzt ist.

**Die 23 Tests mit gepinnten Uhren sind NICHT angefasst** — gemessen 0 rot, und ein Ersetzer über
weitere 23 Testdateien ist genau der Fall aus Regel 24. Wer sie später doch umstellt, hat mit
diesem Abschnitt die Messung, gegen die er es begründen muss.

**Kein automatischer Einbau in `starteBrowser`**, obwohl das eine Zeile statt zwanzig wäre: Ein
Test, der das Zufallsereignis absichtlich messen will, wäre still sabotiert, und niemand fände die
Ursache in seiner eigenen Datei. Der Riegel steht dort, wo man ihn beim Lesen des Tests sieht.

**Ein Helfer, der es NICHT geworden ist:** `tests/lib/stoerungen.js` (`ereignisBannerWegraeumen`,
`bannerStehtNoch`) war die ausgebaute Fassung der Klick-Reparatur und ist wieder entfernt worden,
bevor sie jemand benutzt hat — sie hätte die messbar schwächere Antwort neben der stärkeren stehen
lassen, und ein unbenutzter Helfer wird beim nächsten Lesen für die Lösung gehalten.

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

**KORREKTUR 18.08.2026 – der Satz oben stimmte nur zur Hälfte, und das hat den Backend-Deploy
49 Stunden lahmgelegt.** Entfernt waren die drei Zeilen aus der **root**-crontab. Sie standen
ZUSÄTZLICH in Saschas **Nutzer-crontab** (`/var/spool/cron/crontabs/sascha`) und liefen dort
unverändert weiter – am 18.08. um 10:40 alle drei wortgleich nachgemessen, zwei Tage nach der
angeblichen Behebung. Am 16.08. um 09:13:16 kollidierte einer dieser Läufe mit dem Webhook-Pull,
hinterließ `.git/index.lock`, und ab da scheiterte jeder weitere Backend-Pull: Der Pi stand auf
#109, während elf Commits (#110–#120) aufliefen.

**Für dieses Repo sind daran zwei Dinge wichtig:**

- **Der Frontend-Deploy lief die ganze Zeit sauber** – zum dritten Mal dieselbe Asymmetrie: im
  Frontend lief nur EIN Cron-Konkurrent, im Backend zwei. Ein grüner Frontend-Deploy beweist
  weiterhin nichts über den Backend-Deploy. Nach jedem Merge, der beide Repos betrifft, gehört die
  401/404-Routenmessung dazu (Einzelheiten in der Backend-CLAUDE.md).
- **Die Frontend-Cron-Zeile ist am 18.08. mit entfernt worden.** Sie war reine Doppelarbeit: Der
  Webhook kopiert seit dem 05.08. das komplette Set (`*.html`, `*.png`, `robots.txt`,
  `sitemap.xml`, `manifest.json`, `service-worker.js`), die Cron-Zeile nur
  `weltraum_kolonie.html`. Seither ist der Webhook wirklich die einzige Auslieferung – vorher war
  dieser Satz eine Behauptung.

**Die übertragbare Lehre, unabhängig vom Pi:** Eine Prüfung, die nur an EINEM Ort nachsieht,
beantwortet stillschweigend eine andere Frage als die gestellte. Das ist dieselbe Familie wie die
Fernreferenz-Falle in `tests/run.js` („0 Commits hinterher" hieß nie „aktuell", sondern nur „auf
dem Stand des letzten Holens"). Cron-Zeilen können in fünf Ablagen stehen: der eigenen crontab,
der von root, `/etc/crontab`, `/etc/cron.d/` und als systemd-Timer. Und Datei-Eigentümer sind
dabei kein Beweis – root darf in eine sascha-eigene Logdatei anhängen, ohne dass sich der
Eigentümer ändert.

**Nachtrag 18.08.2026, abends – fünftes Mal, gemessen unmittelbar nach einer eigenen Auslieferung.**
Nach dem Merge von v8.569.0 (Frontend) und #127 (Backend) stand das Frontend binnen Sekunden live auf
`8.569.0`, während der Backend-Deploy hing: `/api/festung/angriff` aus #126 antwortete **404**, und
zwar auch mehrere Minuten später noch. Dem Pi fehlten damit #126 und #127. Dieselbe Asymmetrie wie
am 14./15./16./18.08. – der Frontend-Deploy beweist weiterhin nichts über den Backend-Deploy.

**Der Schaden war diesmal die harmlose Sorte, und das ist kein Zufall, sondern Bauart:** Der
Kosmetik-Katalog kommt VOM SERVER. Ein alter Server liefert die neuen Stücke einfach nicht, das
Spiel zeigt sie also nicht an – kein toter Ladezustand, keine Falschaussage (das ist Schadensklasse
(a) aus dem Kopfkommentar von `test_kosmetik_paritaet.js`). Die clientseitige Hälfte derselben
Lieferung – Erfolge und Titel – lief sofort. Wer eine Lieferung auf beide Repos verteilt, sollte
diese Richtung bewusst wählen: **Der Server darf hinterherhinken, das Frontend nicht.**

**Und ein Messfehler, der beinahe zu einer falschen Diagnose geführt hätte.** Als Marker für #126
wurden zwei Routen genommen, beide über `git log -S '<route>' -- server.js` gefunden, beide
scheinbar aus #126. Sie antworteten unterschiedlich (401 und 404), was aussah, als sei ein einzelner
Commit halb ausgeliefert – unmöglich, und genau deshalb der Hinweis auf einen Werkzeugfehler.
Ursache: **`git log -S` findet den Commit, der die Zeile zuletzt ANGEFASST hat, nicht den, der die
Route ANGELEGT hat.** `/api/asteroid/contest` existierte längst und wurde von #126 nur geändert.
**Vorgehen:** Eine Marker-Route wird gegen die ALTE Datei geprüft
(`git show <commit-davor>:server.js | grep "app.post('/api/…"`) – fehlt sie dort, ist sie ein
gültiger Marker. Dazu weiterhin beide Kontrollen im selben Lauf: eine erfundene Route muss 404
liefern, eine alte 401 (dieselbe Familie wie Regel 15/17/19 – nie ein Messwerkzeug, das sich selbst
im Weg steht).

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

## Das Inventar hing nach einem Massenkauf (21.08.2026, Spieler-Report)

**Wortlaut Sascha:** „problem entstanden ich hatte 200millioen credits und hab bei modulblaupausen
alles auf einmal gekauft jettzt hängt das spiel sobald ich ins inventar will!"

Kein Wackeln, kein Ladefehler – **das Spiel stand wirklich**. Gemessen im Browser an einem
Fixture, das den gemeldeten Fall nachstellt, Aufbau bis zur ersten Modulkarte:

| Module | vorher | nachher | Markup vorher → nachher |
|---|---|---|---|
| 50 | 62 ms | 60 ms | 0,25 MB → 0,25 MB |
| 4.000 | **30.628 ms** | 158 ms | 20,1 MB → 0,60 MB |
| 5.000 | 30.343 ms | 109 ms | 24,6 MB → 0,60 MB |
| 20.000 | **485.186 ms** | 206 ms | 100 MB → 0,62 MB |

Härter noch als der Aufbau ist der längste EINZELNE Long Task – die Zeit, in der der Browser auf
gar nichts mehr reagiert: bei 4.000 Modulen **15.186 ms gegen 90 ms**.

### Die Ursache war dreiteilig, und nur der erste Teil ist die eigentliche Überraschung

**(A) Der Schlüssel enthält einen ZUFALLSWURF – gekaufte Module stapeln deshalb nie.** Seit der
Wert-Streuung (v8.444.0) baut `grantRandomModule` den Schlüssel als
`typ:seltenheit:1:<subs>.w<wurf>`; darin stecken die gewürfelten Zweitwerte UND der
Hauptwert-Wurf. Zwei Blaupausen desselben Typs landen damit praktisch immer auf zwei
verschiedenen Schlüsseln. 20.000 Käufe sind also 20.000 Inventar-Einträge, nicht ein Stapel mit
`×20000`. Der Kommentar an `fuseGeschwister` sagt das sogar wörtlich („identische Schluessel gibt
es bei Funden faktisch nicht mehr") – nur hatte niemand die Folge für die LISTE zu Ende gedacht.

**(B) Darauf lief eine quadratische Schleife.** Jede gezeichnete Modulkarte rief `fuseAnzahl`, und
das lief über `fuseGeschwister` durch **alle** Inventar-Schlüssel. 20.000 Karten × 20.000
Schlüssel = 400 Mio Vergleiche – je Neuzeichnung, und die Box wird im Sekundentakt geschrieben.

**(C) Der „Max"-Knopf des Kredit-Shops hatte gar keine Obergrenze** (`Math.floor(credits / cost)`).
Bei 200 Mio Krediten waren das 20.000 Blaupausen in einem Klick.

### Behoben in drei Teilen – und keiner davon allein hätte gereicht

1. **`fuseIndexBauen(inv, isShip)`** baut den Zähler EINMAL je Renderdurchgang statt einmal je
   Karte; `fuseAnzahl(inv, instKey, idx)` nimmt ihn optional entgegen. Der Einzelaufruf in
   `fuseModules` läuft weiter ohne Index – er feuert genau einmal je Klick. Die Gruppe eines
   Moduls (Typ, Seltenheit, Stufe) steht als `fuseGruppeVon` an EINER Stelle, damit Index und
   `fuseGeschwister` nicht auseinanderlaufen können.
2. **`modulInventarZuschnitt(keys)`** zeichnet höchstens `MODUL_INVENTAR_MAX_KARTEN` = 120
   Einträge und **beziffert den Rest** statt ihn zu verschweigen. Der Hinweis nennt beide Zahlen,
   sagt, dass nichts verloren ist, und zeigt auf die Schnell-verschrotten-Knöpfe.
3. **`MODUL_INVENTAR_KAUF_DECKEL` = 3.000** begrenzt, wie viele Einträge ein KAUF hinterlassen
   darf. `shopMaxMenge(item)` ist dabei die EINE Stelle, die „wie viel geht höchstens"
   beantwortet – vorher stand die Rechnung zweimal da (Kartenbeschriftung und Max-Knopf), und
   **beide kannten weder das Tageslimit noch den Inventar-Platz**: Der Knopf versprach eine Menge,
   die der Kauf danach stillschweigend kürzte.

**Der Zuschnitt sortiert bei großen Beständen FACHWEISE, und das ist der halbe Gewinn.** Volles
Sortieren ruft `moduleInvVergleich` n·log(n)-mal, und der ruft je Vergleich `moduleLevelOf` und
`moduleWertOf` – bei 20.000 Modulen rund 285.000 Vergleiche für eine Liste, von der 120 Einträge
gezeichnet werden. **Die Reihenfolge bleibt dabei identisch, und das ist keine Hoffnung, sondern
folgt aus der Bauart des Vergleichs:** Seine erste Stufe ist der Seltenheitsrang. Wer die Fächer
in Rangordnung abarbeitet und jedes mit demselben Vergleich sortiert, bekommt exakt die Ordnung
des vollen Sortierens. `test_inventar_deckel` 2c misst das als Paar gegen das volle Sortieren.

Nebenbei: `moduleInvVergleich` zog bei **jedem** Vergleich zweimal ein frisches
`Object.keys(MODULE_RARITY)`. Die Rangordnung wird jetzt einmal in `rarRang` abgeleitet – bewusst
ABGELEITET und nicht als Namensliste hingeschrieben, `MODULE_RARITY` ist die einzige Quelle der
Rangfolge (siehe `nextRarityOf`).

### Die Zahlen sind gemessen, nicht gegriffen

- **120 Karten:** Bei 5.000 gezeichneten Einträgen stand der Aufbau bei 30 s und 25 MB, bei 120 bei
  0,06 s und 0,6 MB. Weit über jedem regulären Inventar – wer so viele hält, hat sie gekauft.
- **3.000 Einträge:** 3.000 sind gemessen **0 Long Tasks** und 159 kB Spielstand, 5.000 schon
  588 ms/10 s und 257 kB, 20.000 dann 1.557 ms/10 s und 980 kB (normal sind 17 kB). 3.000 ist die
  höchste gemessene Stufe ohne messbare Belastung. **Der Spielstand wiegt dabei schwerer als die
  Bildrate: Er reist bei JEDEM Speichern zum Server.**

**Gedeckelt wird nur das HINZUFÜGEN durch Kauf.** Funde aus Expeditionen und Sonden bleiben
unberührt, und wer heute schon darüber liegt, verliert nichts – dieselbe Regel wie bei den
Komfort-Grenzen. Ebenfalls außen vor sind Tagesangebot und Wochen-Angebot: Die liefern ein Modul
je Tag bzw. Woche und können den Bestand bauartbedingt nicht sprengen. Die Unterscheidung läuft
**datengetrieben über das Feld `toModules`**, nicht über eine Namensliste.

### Zwei Anzeigestellen, die still falsch geworden wären

- Der Titel des Max-Knopfes sagte „Höchste mit deinen Krediten kaufbare Menge" – mit dem Deckel
  eine Falschaussage.
- Der Hilfe-Abschnitt „Kredit-Shop" behauptete „Alles andere ist beliebig oft kaufbar". Das war
  seit dem Fragment-Tageslimit (17.08.2026) schon falsch und wurde es jetzt ein zweites Mal.

Beide nennen jetzt ihre Grenzen, und der Hilfetext leitet die Zahl aus der Konstante ab
(Reihenfolge vorher gemessen: beide Konstanten stehen vor `HELP_SECTIONS`, Regel 38 geprüft).

### Wächter: `tests/test_inventar_deckel.js` (32 Prüfungen, fünf Gegenproben)

Er misst die WIRKUNG, nicht die Beschriftung – und zwar als **Paar**: Lauf A weit über dem Deckel
(Kauf wird abgelehnt, Grund genannt, Bestand wächst nicht), Lauf B knapp darunter (Kauf findet
statt und füllt **genau** bis an den Deckel). **Ohne Lauf B wäre auch ein Deckel grün, der immer
ablehnt.** Alle fünf Gegenproben beidseitig gefahren, jede mit ihrer eigenen „was muss fallen"-Liste
und `WERKZEUGFEHLER`-Meldung (Regel 71); überall 32 Prüfungen in beide Richtungen.

**Fünf Werkzeugfehler beim Bau dieses Tests – jeder eine bekannte Familie, und der vierte ist der
lehrreichste:**

1. **Geschnittene Funktionen ohne ihre Abhängigkeiten** (Regel 36), gleich viermal: `rarRang`
   fehlte `moduleInvVergleich`, `fuseGruppeVon` fehlte `fuseAnzahl` (in **drei** Bestandstests:
   `test_wertstreuung`, `test_seltenheiten`, und im neuen Test selbst), `MODULE_LEVEL_MAX` fehlte
   `moduleLevelOf`. Letzteres warf erst beim AUFRUF – also außerhalb des Bau-`try/catch`; seitdem
   ist auch das Ausführen eine eigene, benannte Prüfung (`2a-lauf`, Regel 34).
   `test_seltenheiten` lief dadurch mit **10 statt 21** Prüfungen und meldete trotzdem nur „rot".
2. **Indizes aus zwei verschiedenen Strings verglichen:** Die Prüfung „niemand sortiert am
   Zuschnitt vorbei" suchte in `JS_OHNE_HISTORIE`, hielt die Treffer aber gegen Blockgrenzen aus
   `JS` – der herausgeschnittene Patchnotes-Block verschiebt alle Indizes, also lag **jede**
   Fundstelle scheinbar außerhalb.
3. **Den Spielstand aus `localStorage` gelesen**, obwohl er beim Backend-Mock liegt (Regel 65):
   gemessen wurden 0 Einträge, was wie ein Befund aussah.
4. **Einen Kürzungspfad gemessen, den der gewählte Weg gar nicht erreichen kann.** Über „Max"
   deckelt der Knopf ja bereits richtig – `qty > platz` ist dann nie wahr. Der Pfad ist nur über
   einen festen Mengenknopf (×10 bei 5 freien Plätzen) oder einen veralteten Wert erreichbar.
   Das ist Regel 67: **ein unerreichbarer Pfad ist kein Testproblem, sondern eine Aussage über das
   Bauwerk** – hier eine gute, denn sie heißt, dass der Normalweg gar nicht erst in die Kürzung
   läuft.
5. **Den MutationObserver den Endstand lesen lassen statt der Records:** Ein Kauf löst eine
   Erfolgs-Salve im selben synchronen Block aus, und der Callback läuft als Microtask danach – die
   Kürzungs-Meldung war von „Erfolg freigeschaltet: Perfekter Wurf" überschrieben. Muster jetzt wie
   in `test_markt_kontingent.js`, per `addInitScript` und über die Records.
   Dazu war der BELEG einer grünen Prüfung falsch: `slice(-2)` zeigte zweimal „Erfolg
   freigeschaltet", während die geprüfte Zeile weiter vorn stand – eine grüne Prüfung, deren
   Beleg etwas anderes behauptet (Regel 37).

75. **Ein Erwartungswert, der die geprüfte KONSTANTE aus derselben Datei liest, lässt sich durch
    Ändern der Konstante entschärfen – das ist Regel 62 an einer Schranke statt an einer Formel.**
    Vorfall 21.08.2026: `3b` prüfte „höchstens `MODUL_INVENTAR_MAX_KARTEN` Karten gezeichnet" und
    las den Deckel aus der Spieldatei. Die Gegenprobe setzte ihn auf 999999 – und die Prüfung
    blieb **grün**, völlig folgerichtig: Die sabotierte Konstante wurde ja eingehalten. Gemeldet
    hat es nur die „was muss fallen"-Liste der Gegenprobe (Regel 71); ohne sie wäre der Test mit
    einer Lücke ausgeliefert worden, die genau den Anlassfall durchlässt.
    **Vorgehen:** Zu jeder Prüfung gegen eine Konstante aus der geprüften Datei gehört eine zweite
    mit einem **absoluten, begründeten Anker** – hier `3b2` („höchstens 500 Karten, egal was die
    Konstante sagt") und `1-vorab2`/`1-vorab3` („der Deckel liegt im gemessen vertretbaren
    Bereich"). Die absoluten Zahlen kommen aus der Messung, nicht aus dem Gefühl. Dasselbe galt für
    das Fixture selbst: Seine Vorab-Prüfung hing an `MAX_KARTEN * 5` und wanderte damit mit.

76. **Ein Zufallswurf im SCHLÜSSEL macht aus einem Stapel eine Liste – und aus jeder Schleife
    darüber eine quadratische.** Aus demselben Vorfall, und es ist die Ursache dahinter: Der
    Modul-Schlüssel trägt seit v8.444.0 die gewürfelten Zweitwerte und den Hauptwert-Wurf. Damit
    ist `state.modules` kein Stapelzähler mehr (`typ → Anzahl`), sondern eine Liste von Unikaten,
    und jede Rechnung „je Eintrag über alle Einträge" wächst quadratisch. Der Kommentar an
    `fuseGeschwister` benannte die Eigenschaft korrekt – gefehlt hat die Frage, was sie für die
    ANZEIGE bedeutet.
    **Vorgehen:** Wer einem Schlüssel ein gewürfeltes Segment hinzufügt, prüft anschließend jede
    Stelle, die über die Schlüssel dieser Sammlung iteriert, auf ihre Ordnung – und jede Stelle,
    die eine Obergrenze für die Sammlung annimmt (Renderlisten, Sortierungen, der Spielstand
    selbst). Die Kosten treten erst bei einem Spieler auf, der die Sammlung wirklich füllt, also
    Monate nach der Auslieferung und außerhalb jedes Tests mit Normal-Fixture.

77. **Ein `\uXXXX`-Escape im Patchnote-Text macht die dateiweiten Zeichenprüfungen BLIND.**
    Vorfall 21.08.2026: Der Patchnote zu v8.599.0 entstand über ein Python-Skript, das seine
    Umlaute als `ä`/`ß` schrieb (23 Stück). Das ist zur Laufzeit korrekt – JavaScript
    löst die Escapes in einem String-Literal auf, und die erzeugte `patchnotes.html` zeigte
    einwandfrei „Sehr große Inventare…". Trotzdem war es ein Fehler, und zwar ein unsichtbarer:
    Die Pflichtprüfung „Anführungszeichen im Hausstil" sucht nach dem **Literal** U+201C im
    Quelltext. Fünf falsche Anführungszeichen standen als `“` da und wurden deshalb **nicht
    gefunden** – der Prüflauf war grün, und v8.599.0 wäre mit demselben Hausstil-Verstoß live
    gegangen, der schon v8.564.0 mit rotem Prüflauf ausgeliefert hat (Regel 58).
    Aufgefallen ist es nur, weil die Escapes als STIL-Abweichung auffielen (1.473 echte Umlaute in
    der Datei gegen 23 Escapes) und ich sie vor dem Merge ersetzt habe – erst danach schlug die
    Prüfung an.
    **Vorgehen:** Wer Spielertext über ein Skript einfügt, schreibt die Sonderzeichen **direkt**
    hinein (Python-Quelldateien sind UTF-8, `io.open(..., encoding='utf-8')` genügt) – nie als
    Escape. Ein Escape ist kein Schreibfehler, sondern eine TARNUNG: Er versteckt das Zeichen vor
    jeder Prüfung, die den Quelltext liest, und genau solche Prüfungen sind hier die
    Pflichtprüfungen. Und wer einen Patchnote noch vor dem Merge umschreibt, fährt danach
    `--nummer` erneut – die Änderung sieht harmlos aus und kann eine dateiweite Prüfung kippen.
    **Die zweite Hälfte ist die eigentliche Lehre:** Ein Prüflauf, der grün ist, weil das Gesuchte
    in einer anderen Kodierung dasteht, ist die Familie aus Regel 32 (Literal gesucht, Rechenform
    übersehen) – nur umgekehrt gefährlich: Dort wird ein Fund zu Unrecht verworfen, hier meldet
    das Werkzeug Sauberkeit, wo keine ist.

## Die Belohnungsvorschau des Allianz-Raids (22.08.2026)

Auftrag Sascha: „allianz raid deutlich optisch aktraktiver gestalkten weniger text und vsl.
belohnungen einblenden." **Gebaut am 22.08.2026**; der Abschnitt darunter ist die Vorabmessung
vom 21.08., die die Etappe möglich gemacht hat – **sie widerlegt meine eigene erste
Einschätzung.**

Notiert hatte ich, eine exakte Vorschau sei unmöglich, weil die Belohnung am Platz ALLER
Teilnehmer hängt. Gemessen stimmt das nicht: `ranking` wird **beim Abflug** gebildet und nach
Angriffskraft sortiert (`server.js`, `onTime.slice().sort((a,b) => (b.power||0) - (a.power||0))`),
und dieselbe Liste wandert unverändert ins Wellen-Ergebnis, aus dem `/claim` den Platz liest. Damit
stehen nach dem Versand **alle** Eingaben von `allianceRaidRewardFor` fest:

| Eingabe | Woher im Frontend |
|---|---|
| `share` | eigene `power` / `doc.dispatch.totalPower` |
| `platz` | Index in `doc.dispatch.ranking` |
| `anzahl` | Länge derselben Liste |
| `boss` | `ALLIANCE_RAID_BOSSE` liegt im Frontend (`beuteMult`, `schwerpunkt`) |
| `level` | `doc.level` |
| `destroyed` | **das Einzige, was offen ist** |

Eine Vorschau ist deshalb kein Schätzwert mit Spanne, sondern ein **PAAR aus zwei exakten Werten**:
„Boss überlebt" (Faktor 0,6, keine Antimaterie, keine Fragmente) und „Boss fällt" (Faktor 1,0).

**Der Preis ist eine Kopie-Familie.** `allianceRaidRewardFor` müsste im Frontend nachgebaut werden –
mit Paritätsprüfung als Pflicht, wie bei `FESTUNG_STUFEN` und `SHIP_SCORE_WEIGHTS`. Die Alternative
ist ein Feld vom Server (ein Backend-PR, keine zweite Formel). Diese Wahl gehört Sascha vorgelegt,
nicht still entschieden.

**Zum Textumfang, gemessen statt geschätzt:** `renderAllianceRaidBox` ist 15.462 Zeichen über 166
Zeilen; darin stehen elf Erklär-Blöcke mit zusammen ~1.100 Zeichen Prosa. Die zwei längsten sind
der Beitritts-Hinweis („Wer beitritt, lässt seine Flotte erst zur Allianzbasis fliegen…", 126) und
die Verband-Zusammenfassung (167). Wer hier kürzt, prüft vorher jede Zeile gegen die
TX-Muster – Muster 1 und 4 dürfen weg, jede ZAHL bleibt.

### Was daraus gebaut wurde – und die vier Funde dabei

**Entschieden von Sascha (22.08.2026): Frontend-Kopie mit Paritätstest**, nicht ein Serverfeld. Die
Abwägung wurde vorher gemessen statt geschätzt, und die Messung hat sie deutlich verschoben: Die
**teure Hälfte der Kopie gibt es längst** – `ALLIANCE_RAID_BOSSE` mit `beuteMult`/`schwerpunkt`
steht in beiden Repos und wird von `test_raid_bosswahl` schon Feld für Feld verglichen. Neu
hinzugekommen sind nur EINE Zahl (`ALLIANCE_RAID_RANK_SPREAD = 0.9`) und drei Funktionen. Dazu kam
die Lage: Ein Serverfeld hätte einen Backend-Deploy gebraucht, und der hing zu dem Zeitpunkt seit
zehn Stunden (Ausfall Nr. 9).

**Die Vorschau ist ein PAAR, kein Schätzwert mit Spanne.** Nach dem Abflug ist von den sechs
Eingaben der Formel genau EINE offen – ob der Boss fällt. Beide Werte sind exakt. Sie steht
deshalb im `enroute`-Zweig und nicht in der Sammelphase: `/checkdispatch` friert die Rangliste
beim Abflug ein, und dieselbe Liste liest später `/claim` für den Platz. Vorher stünde dort eine
Zahl, die sich noch ändert.

**Wer nicht mitgeflogen ist, sieht NICHTS statt einer Null** – dieselbe Entscheidung wie bei der
Weltlage-Zeile: Gibt es nichts zu sagen, wird nichts gesagt. Ebenso bei einem Dokument ohne
`ranking` (älterer Server).

**Vier Funde beim Bauen, jeder gemessen:**

1. **Meine eigene Notiz über den Textumfang war falsch.** Hier stand „elf Erklär-Blöcke mit
   zusammen ~1.100 Zeichen Prosa". Sauber gemessen – HTML-Tags und `${…}`-Ausdrücke entfernt,
   Kommentare raus – sind es **6 Sätze mit 430 Zeichen**. Die alte Zahl stammte von einem
   Extraktor, der Code für Prosa hielt. **Ein Messwerkzeug, das die falsche Größe misst, ist
   schlimmer als keins** – es liefert eine Zahl, die man später glaubt.
2. **„Zu viel Text" war die DOPPLUNG, nicht die Menge.** Im Zustand „kein Raid" stand der
   Bossname **dreimal** sichtbar (Kopfzeile, Regelzeile, geschlossenes Auswahlfeld, das seine
   gewählte Option anzeigt) und der Beutetext **zweimal**. Die Regelzeile trägt jetzt nur noch die
   KAMPFREGEL – sie steht nirgends sonst, und genau sie muss die Allianz vor dem Ausrufen
   einplanen können. Gemessen: `textContent` 526 → 483 Zeichen. **Das ist ehrlich wenig**, und der
   Grund gehört dazu: Der Großteil des scheinbaren Textes sind die **eingeklappten**
   Auswahl-Optionen, die `textContent` mitzählt und der Spieler gar nicht sieht.
3. **Die Ausnahme, die eine stille Verschlechterung verhindert:** Ein einfaches Mitglied sieht
   **kein** Auswahlfeld. Ohne Sonderfall wäre ihm die Beute-Auskunft ersatzlos genommen worden –
   der Beutetext bleibt dort deshalb stehen (`test_raid_vorschau` 5-vorab/5a, beidseitig grün und
   genau deshalb ein Beleg).
4. **Die zwei Konstanten heißen NICHT gleich:** vorne `ALLIANCE_RAID_BOSSE`, hinten
   `ALLIANCE_RAID_BOSSES`. Mein Paritätstest suchte einen Namen für beide Seiten und fand die
   Backend-Tabelle nicht. Wer hier greppt, greppt zweimal.

**Und ein Fehlgriff, den die `count != 1`-Wache abgefangen hat** (Hausregel 16): Die Zeile
„…Angriffskraft – trifft geschlossen am Ziel ein." steht **zweimal** in der Datei – einmal im
Raid, einmal im **Musterangriff**. Zwei verschiedene Mechaniken mit demselben Wortlaut. Ohne die
Wache hätte ich die Vorschau in den Musterangriff geschrieben; die Ersetzung ist seither auf den
Block von `renderAllianceRaidBox` gescopt (Regel 39).

**Ein fünfter Fund, und er kam aus dem vollen Prüflauf statt aus dem eigenen Durchgang:** Die
Trennlinie über der Vorschau stand als `border-top:1px` da — die einzige feste Pixelzahl der ganzen
Datei neben dem begründeten Zierring. `test_formensprache` 1 zählt genau das über die **ganze**
Spieldatei und meldete `["border:3px","border-top:1px"]`. Gemessen gibt es dieselbe Trennlinie mit
derselben Farbe im Haus **18-mal** als `border-top:var(--bw-1)`; ich hatte also nicht eine Lücke
gefüllt, sondern eine zweite Schreibweise neben eine etablierte gestellt.
**Übertragbar: Wer neues Markup mit INLINE-Stilen schreibt, ist von den dateiweiten Stilwächtern
betroffen — auch wenn der eigene Bereich mit CSS nichts zu tun hat.** Der Betroffenheits-Sweep
(Regel 40/45) muss deshalb nicht nur nach der geänderten Konstante greppen, sondern auch nach den
Eigenschaften, die man im Markup gerade benutzt (`border`, `border-radius`, Farbliterale) — zwei
Minuten `grep -c "border-top:var(--bw-1)"` hätten die Hausform sofort genannt.

### Die Optik: Variante C, und warum drei gebaut wurden

Der erste Halbsatz des Auftrags („deutlich optisch attraktiver") war nach der ersten Runde noch
offen – geliefert waren nur die Belohnungen und die Textentdopplung. Nachgeholt am 22.08.2026 nach
dem Verfahren von GR-3: **drei Varianten gebaut, gerendert und vorgelegt**, Sascha hat gewählt.

| Variante | Höhe | warum nicht |
|---|---|---|
| JETZT | 376 px | Tabelle ohne Symbole, beide Spalten gleich gewichtet |
| A – Tabelle mit Symbolen, Erfolgsspalte grün hinterlegt | 413 px | mehr Fläche, zwei Spalten bleiben |
| B – Kacheln | **287 px** | 24 % niedriger, braucht dafür eine Erklärzeile; nicht spaltenweise vergleichbar |
| **C – eine Spalte, Überlebt-Wert in Klammern** | 413 px | **gewählt** |

**Die Symbole sind gemessen, nicht gewählt.** `miniResIcon` ist der Hausbaustein und kennt
`credits` als Sonderfall; für die drei Größen ohne `RES_ICONS`-Eintrag wurden die im Spiel
etablierten Symbole ausgezählt statt ausgesucht – Kampfpunkte `ti-sword` (14 Fundstellen),
Erfahrung `ti-star`, Modulfragmente `ti-box`. Alle im Subset-Font, `check-icons.js` sauber.

**Der Wächter wurde dabei STÄRKER, nicht passend gemacht** (Regel 43/68): Er las die zwei Werte als
*zweite und dritte Tabellenzelle* – mit C gibt es nur noch eine Wertzelle, die Prüfung wäre auf
korrektem Code durchgefallen. Sie liest jetzt **alle Zahlen der Wertzellen** und prüft damit die
Regel statt der Spaltenzahl (Regel 3); ein künftiger Spaltenumbau kann ihr den Gegenstand nicht
mehr still entziehen. Dazu `2c`, das das Neue misst – jede Beutezeile trägt ihr Symbol; die
Gegenprobe mit entfernten Symbolen fällt genau daran und benennt alle acht Zeilen, bei 17
identischen Prüfnamen in beiden Richtungen.

**Ein sechster Fund, beim Rendern der Optik-Varianten – und er saß in MEINER eigenen Fixture:**
Sie setzte den Allianz-Unterreiter auf `'krieg'`. Den Schlüssel hat es **nie** gegeben (über die
Historie gemessen: `git log -S 'data-alliance-subtab="krieg"'` liefert null Treffer); die vier
echten heißen `uebersicht`/`mitglieder`/`ausbau`/`verwaltung`, und der Raid-Kasten wohnt in
`uebersicht`. Bei einem unbekannten Schlüssel blendet die Anzeige **alle** Allianz-Panels aus –
wörtlich die Falle aus Regel 4, nur mit einem anderen Schlüssel. Erfunden wurde er am 16.08. in
`test_allianzraid_anzeige.js`, und ich habe ihn beim Kopieren der Fixture in
`test_raid_vorschau.js` weitergetragen.
**Beide Tests maßen den Kasten also, während er unsichtbar war** – `textContent` liefert auch bei
`display:none` Text (Regel 55). Aufgefallen ist es nicht am Quelltext, sondern daran, dass der
Screenshot **leer** war (Regel 42). Beide Fixturen sind korrigiert, und `test_raid_vorschau` hat
jetzt `1-vorab2`, das die SICHTBARKEIT misst; die Gegenprobe mit dem alten Schlüssel fällt genau
daran (`{"sichtbar":false}`), bei identischen 16 Prüfnamen.
**Zwei Werkzeugfehler derselben Runde, beide über den Einzelfall hinaus:** (a) Der Screenshot war
auch nach der Korrektur leer, weil `welcomeBackOverlay` sich nach dem `style.display='none'`
**wieder einblendet** – weggeräumt wird es jetzt über den Spielerweg (seinen eigenen Knopf,
Regel 70), und der Beleg ist `elementFromPoint` auf die Kastenmitte statt bloßer Sichtbarkeit
(Regel 49). (b) Ein Element-Screenshot eines Kastens bei y=2698 in einem 1400 px hohen Fenster
liefert ein leeres Bild, ohne zu scheitern – die Dateigröße verrät es (516 Bytes gegen 49 kB).
**Ein Bild, das man nicht ansieht, ist kein Messwert; und ein leeres Bild ist erst dann ein
Befund, wenn das Werkzeug nachweislich funktioniert.**

**Die Wächter:** `tests/test_raid_belohnung_paritaet.js` (10 Prüfungen) führt BEIDE Fassungen aus
und rechnet sie über ein Raster aus Stufe, Anteil, Platz, Teilnehmerzahl, Ausgang und allen fünf
Bossen gegeneinander – **1.800 Kombinationen, null Abweichung**. Verglichen werden ZAHLEN, nicht
Text: Ein Textvergleich schlüge an jeder Kommentaränderung fehl und wäre eine Momentaufnahme
(Regel 3). Gegenprobe mit `ALLIANCE_RAID_RANK_SPREAD` auf 0,8: genau `2a` fällt, mit
`{"front":{"credits":284},"back":{"credits":299}}`.

`tests/test_raid_vorschau.js` (15 Prüfungen) misst am gerenderten Spiel. Sein Kern ist `2a`: Die
zwei Spalten müssen **verschiedene Zahlen** nennen – eine Vorschau, deren beide Hälften gleich
sind, sagt nichts aus, und eine Prüfung auf „das Wort Beute steht da" wäre in beiden Fällen grün
(Regel 61). Gegenprobe gegen `origin/main`: **8 rot bei identischer Prüfliste** (per `diff`
verglichen, nicht gezählt – Regel 60).

## Das Bild bleibt still, wenn sich Unsichtbares darüber ändert (21.08.2026)

**Der Befund, im Browser gemessen und nicht aus dem Quelltext geschlossen:** Ändert etwas
**vollständig oberhalb des Sichtfensters** seine Höhe, rutscht alles darunter unter dem Leser weg.
Die Seite scrollt dabei gar nicht – `scrollY` bleibt unverändert, der Inhalt bewegt sich. Gemessene
Auslöser: Ereignis-Banner **138 px**, Reiter-Hinweisleiste **166–302 px**, Tagesaufgaben-Leiste bis
zu **146 px** Höhenänderung. Ein Sprungziel wanderte dadurch von `top:128` auf **`top:−30`**, also
teilweise aus dem Bild.

**Die eingebaute Scroll-Verankerung des Browsers greift hier NICHT** – und das ist der Teil, der
zuerst nachgemessen gehört, bevor jemand eine eigene baut: `overflow-anchor` steht auf der ganzen
Kette (`#eventBanner` → `#game-root` → `body` → `html`) auf `auto`, es schaltet sie also nichts ab.
Trotzdem glich das Ausblenden eines 138-px-Banners bei `scrollY` 1500 exakt **0 px** aus.

**`bildRuhigHalten()` misst EINE Zahl statt vieler Beobachter:** die Dokumentlage der Lesekante
(`.tab-panel.active`). Das ist genau „wie viel Inhalt steht über dem Lesebereich" – egal, welches
Banner sich geändert hat und ob per `display`, per Inhalt oder per Media-Query. Ein
`ResizeObserver` je Banner hätte eine Falle: Ein `display:none`-Element hat sein Rechteck bei 0/0,
seine alte Lage ist damit weg, und die Entscheidung „lag es über dem Bild?" nicht mehr zu treffen.

**Was bewusst NICHT ausgeglichen wird: alles Sichtbare** (Entscheidung Sascha). Liegt die Lesekante
im Bild, sieht der Spieler die Änderung passieren – ein Scroll-Ausgleich wäre dort selbst der
Sprung, den die Funktion verhindern soll. Gemessen: bei sichtbarer Änderung `scrollAusgleich: 0`,
bei unsichtbarer `−172`.

**Drei Dinge, die man beim Anfassen wissen muss:**

- **Der Aufruf steht HINTER `klappenFrei()` in `render()`**, also hinter allen Kopf-Eingriffen
  desselben Takts. Weiter vorne kennte er die Bannerhöhe dieses Takts noch nicht und glich erst
  eine Sekunde später aus – dieselbe Reihenfolge-Überlegung wie bei `klappenFrei` selbst.
- **Der Reiterwechsel muss ausgenommen sein.** Ein anderes Panel hat eine andere Dokumentlage; ein
  Ausgleich darauf wäre ein erfundener Sprung. Deshalb merkt sich die Funktion das Panel-Element
  und setzt beim Wechsel nur neu an (`test_bildruhe` Abschnitt 3).
- **`scrollBy` lässt die Dokumentlage unverändert** (`r.top` fällt um d, `scrollY` steigt um d) –
  der gemerkte Wert bleibt danach gültig und muss nicht nachgeführt werden.

Wächter: `tests/test_bildruhe.js` (9 Prüfungen). Er misst das **Paar**: unsichtbare Änderung → Bild
steht (Drift 0, Ausgleich über `scrollY`), sichtbare Änderung → **nichts** wird gescrollt. Ohne die
zweite Hälfte wäre ein viel zu breiter Ausgleich grün. Beidseitig gegengeprüft: am Stand davor
fallen genau `1a` und `1b` mit `{"drift":-172,"scrollAusgleich":0}`, bei identischen Prüfnamen.

## Drei Richtungen für EINE Regel — und die dritte ist die gefährlichste (22.08.2026)

Nach Backend-#156 stand `test_wertstreuung` 6e rot, ohne dass ein Fehler vorlag: Die Prüfung
**zählte** die Stellen, an denen der Server einen Modulbeitrag nachrechnet, und verlangte genau
zwei. Eine völlig richtige dritte (`shipModulKlassenBoni`) ließ sie durchfallen — eine
Momentaufnahme statt einer Regel (Regel 3/33).

**Die Regel lautet: Wer einen Modulbeitrag aus Seltenheit UND Stufe rechnet, muss den Wurf
mitnehmen.** Sonst rechnet der Server für ein gewürfeltes Modul einen anderen Wert als der Client,
und das entscheidet PvP.

**Zwei Sitzungen haben sie am selben Tag unabhängig behoben, mit verschiedenen Zuschnitten — und
die sind komplementär, keiner ist der bessere.** Das ist gemessen, nicht abgewogen: an drei
sabotierten Backend-Kopien, jede mit ihrer „was fallen MUSS"-Liste (Regel 71).

| eingespeister Fehler | Musterliste (`6e`/`6e2`) | Rechenform (`6e3`) |
|---|---|---|
| eine erlaubte Stelle **verliert** den Wurf | fällt | fällt |
| eine **neue** Stelle **hat** den Wurf | fällt („gehört eingetragen") | grün — die Regel gilt ja |
| eine **neue** Stelle rechnet Seltenheit × Stufe und **vergisst** den Wurf | **grün** | fällt, nennt die Zeile |

**Die dritte Zeile ist der gefährliche Fall, und die Musterliste sieht ihn strukturell nicht.** Sie
geht von den Zeilen aus, die den Wurf ENTHALTEN — eine Stelle ohne ihn steht in dieser Liste gar
nicht, ist also weder „fehlend" noch „unbekannt" und fällt durch beide Maschen. Die zweite Zeile
ist dafür der historische Fall von #156, und den sieht nur sie: Sie erzwingt, dass eine neue Stelle
bewusst eingetragen wird.

**Deshalb stehen seit dem 22.08.2026 alle drei nebeneinander** (`6e`, `6e2`, `6e3`), und wer hier
aufräumt, misst vorher die drei Zeilen der Tabelle nach. Der Unterschied im Zuschnitt: `6e`/`6e2`
gehen von der ERSCHEINUNGSFORM aus (wo steht der Wurf?), `6e3` von der Größe, welche die Regel
verletzt (wo wird Seltenheit × Stufe gerechnet?) — das ist der Nachtrag zu Regel 40 in der
Anwendung.

**Ein Fund nebenbei, und er betrifft jede Fehlermeldung dieses Tests:** Der Kommentar-Filter
ersetzte Blockkommentare durch **ein** Leerzeichen und faltete damit jeden mehrzeiligen Kommentar
auf eine Zeile zusammen. Gemessen meldete der Test „Zeile 2243" für `raidlossProtectionMult`, das
in `server.js` bei **3577** steht — 1.334 Zeilen daneben. Kommentare werden deshalb **geleert**
(jedes Zeichen außer dem Zeilenumbruch durch ein Leerzeichen ersetzt), nicht entfernt. Eine
Fehlermeldung, die auf die falsche Zeile zeigt, schickt den Nächsten an den falschen Ort — und sie
sieht dabei aus wie eine gute Meldung.

**Die Arbeitsteilung selbst ist die zweite Lehre, und sie ist Regel 69 zum zweiten Mal.** Ich hatte
alle drei roten Tests parallel zu einer anderen Sitzung gebaut, deren PR seit dem Vorabend offen
war; zwei davon habe ich wieder zurückgenommen, weil ihre Antworten besser waren (der
Klammertiefen-Schnitt statt eines dritten Endankers, Regel 40). **Wer eine ROTE Prüfung auf `main`
vorfindet, sieht zuerst nach, ob dafür schon ein PR offen ist** — ein roter Test ist die Sorte
Befund, die mehrere Sitzungen gleichzeitig sehen, und anders als bei einem Feature merkt man die
Dopplung erst am Ende.

## Abgrund C2: die zweite Reliquienreihe zahlt in Sternenessenz (22.08.2026)

Teil C des Beute-Konzepts, Etappe C2. Das Konzept nennt sie „reines Schreiben" — sechs weitere
Reliquien in derselben Form wie die zwölf vorhandenen. **Gemessen stimmt das nicht, und der Befund
hat die ganze Bauform entschieden.**

### Der Befund: die vier Reliquien-Kanäle sind GEDECKELT, und einer stand schon bei 83 %

`ABGRUND_RELIKT_DECKEL` begrenzt, was das Kabinett je Kanal geben darf. Der Kommentar daneben
begründete das mit „eine Bremse für den Fall, dass später weitere Reliquien dazukommen und niemand
mehr nachrechnet" — **genau dieser Fall trat jetzt ein.** Gemessen VOR C2 (zwölf Reliquien plus die
vier Satz-Stufen):

| Kanal | Summe | Deckel | Auslastung |
|---|---|---|---|
| `splitter` | 0,290 | 0,35 | **83 %** |
| `kraft` | 0,145 | 0,25 | 58 % |
| `beute` | 0,180 | 0,35 | 51 % |
| `verlust` | 0,090 | 0,20 | 45 % |

Der Splitter-Kanal hatte also **0,06 Luft**, und eine Reihe im Stil der ersten hätte ihn gerissen.
Die Rechnung dazu ist eine KONSTRUKTION und steht deshalb ausgeschrieben statt als blanke Zahl
(die Lehre aus KB-20i): Die erste Reihe verteilt je Kanal genau drei Stücke zu 0,04–0,05, und der
Satz bedient `splitter` zweimal. Eine gleich gebaute zweite Reihe gäbe ihm zwei weitere Stücke
(2 × 0,05) plus eine Satz-Stufe (0,05) — also 0,290 + 0,15 = **0,44 gegen einen Deckel von 0,35**.
Neun Prozentpunkte wären still im Deckel verschwunden: **eine Belohnung, die der Spieler bekommt,
sieht und nie erhält.** Das ist die Wirkung-ohne-Anzeige, gegen die Regel 59 geschrieben ist.

### Die Entscheidung (Sascha): Sternenessenz-Meilensteine

Vorgelegt mit drei Optionen; gewählt wurde **kleine, deckelverträgliche Prozente PLUS
Tiefen-Meilensteine in Sternenessenz**. Der Grund, warum gerade diese Währung: Sie ist die einzige,
die **Prestige UND Aufstieg übersteht** (`state.ascension.essence`) — eine Belohnung für eine
Sammlung, die über Wochen entsteht, darf nicht beim nächsten Reset verschwinden. Und sie hat
**keinen Deckel**, unterliegt also nicht dem Befund, der die Etappe ausgelöst hat.

Gemessen NACH C2 (18 Reliquien, sechs Satz-Stufen): `kraft` 78 %, `verlust` 75 %, `splitter` 83 %,
`beute` 77 % — **kein Kanal gerissen, und je Kanal bleiben 0,05 bis 0,08 Luft für eine dritte
Reihe.** Der Splitter-Kanal wird von der zweiten Reihe bewusst **gar nicht** bedient; er ist der
engste, und sein Anteil ist deshalb unverändert bei 83 %.

`ABGRUND_TIEFEN_MEILENSTEINE` zahlt bei Rekordtiefe 25/50/75/100/125/150/180 zusammen **58
Sternenessenz und 17.800 Kredite**. Die Schwellen stehen bewusst schon ab Tiefe 25 — die zweite
Reihe beginnt zwar erst bei 130, aber ein Belohnungspfad, der erst dort einsetzt, wäre für jeden
unerreichbar, der die erste Reihe noch sammelt.

### Vier Entscheidungen, die man beim Anfassen kennen muss

- **Die erste Reihe steht geschlossen VORNE** (`reihe:1`, dann `reihe:2`). Der Index entscheidet
  über `i % length`, welche Tiefe welches Stück fallen lässt — ein Reihe-2-Stück dazwischen
  veränderte **rückwirkend** die Beute einer Tiefe, die ein Spieler längst geholt hat.
  `test_abgrund_meilensteine` 1d hält das fest.
- **Der Bestandserfolg `abgrundkabinett` ist auf `reihe === 1` gescopt, und das war Pflicht.**
  Ohne diesen Zusatz hätte die Erweiterung sein Ziel still von zwölf auf achtzehn verschoben — für
  einen Spieler bei 11 von 12 wäre der Erfolg über Nacht in weite Ferne gerückt, ohne dass er etwas
  getan hätte. Die vollständige Sammlung bekommt deshalb einen **zweiten** Erfolg
  (`abgrundkabinett2`, „Kurator beider Reihen"). Das ist derselbe Gedanke wie „Deckel dürfen niemals
  Daten löschen": Eine Erweiterung darf niemandem etwas wegnehmen, das er schon fast hatte.
- **`ABGRUND_RELIKT_SATZ` hängt an den REIHEN, nicht an einer Zahl.** Alle vier alten Stufennamen
  sind mitgezogen worden, und das war keine Kosmetik: „Vollständiges Kabinett" bei zwölf Stücken war
  ab dem Moment eine Falschaussage, in dem das Kabinett achtzehn Fächer hat — genau die zweite
  Anzeigestelle, die eine Erweiterung stehen lässt (Checkliste Punkt 6).
- **Der Hilfetext kann seine Summen NICHT ableiten**, und das ist gemessen statt geschätzt
  (Regel 38): `HELP_SECTIONS` steht rund 2,4 Mio Zeichen VOR `ABGRUND_TIEFEN_MEILENSTEINE`, ein
  Zugriff träfe die Tabelle in ihrer temporalen Todeszone und das Spiel startete gar nicht.
  Dort stehen deshalb feste Werte MIT Kommentar — und `test_abgrund_meilensteine` 4a/4b/4c hält sie
  gegen die gerechnete Summe der Tabelle (Regel 72: eine Aufzählung neben der Liste wird sonst
  still falsch).

### Zwei Kommentare waren falsch — beide korrigiert

**1. „Die Reliquie steht im selben Eintrag wie Name und Portrait, nicht in einer dritten Liste."**
Nachgemessen gibt es **drei** parallele Listen: `ABGRUND_WAECHTER_NAMEN` (Z. 49487),
`ABGRUND_WAECHTER_BILDER` (Z. 49951) und `ABGRUND_RELIKTE` — und alle drei sind über `i % length`
gekoppelt, mit je einer eigenen Aufrufstelle. Genau die Konstruktion, vor der der Satz zu schützen
vorgab, IST die gebaute Lösung. Das ist die KB-20i-Familie: eine erfundene Begründung, die beim
nächsten Lesen als REGEL gelesen wird.

**2. Die Deckel-Begründung stammte aus der Zeit der zwölf Reliquien** („sie greifen erst weit hinter
dem, was zwölf Reliquien zusammen geben"). Seit C2 binden sie fast. Der Kommentar nennt jetzt die
gemessene Auslastung je Kanal und sagt ausdrücklich: **Wer eine dritte Reihe baut, rechnet zuerst
dort nach.**

### Der Wächter — und die Lehre aus seiner einen roten Prüfung

`tests/test_abgrund_meilensteine.js` (29 Prüfungen, vier Gegenproben, alle beidseitig gefahren bei
identischer Prüfliste). Er misst die drei parallelen Listen, die Deckel-Auslastung **ausgeführt**,
die Monotonie der Meilenstein-Tabelle, die Hilfetext-Summen, die Verdrahtung und die **Wirkung im
gerenderten Spiel als PAAR**: Ein Konto mit Rekordtiefe 180 bekommt beim Laden alle sieben Marken
und die gemessenen 58 Essenz, ein Konto ohne Tiefe keine — und ein **zweiter** Lauf auf demselben
Stand zahlt nichts nach.

**Prüfung `2d` war zuerst rot, und meine Prüfung war schuld, nicht die Tabelle.** Sie verlangte,
kein Stück der zweiten Reihe gebe mehr als das schwächste der ersten — global über alle Kanäle
gerechnet, und damit `{"groesstesZweite":0.03,"kleinstesErste":0.025}`. Beide Zahlen stammen aber
aus **verschiedenen Kanälen**: 0,03 ist ein `beute`-Wert der zweiten Reihe, 0,025 ein
`verlust`-Wert der ersten. Die Kanäle haben von Haus aus verschiedene Größenordnungen
(`beute` 0,03–0,05 gegen `verlust` 0,02–0,035), der Vergleich maß also den KANAL-Unterschied statt
der Reihen-Abstufung. Je Kanal gerechnet ist die zweite Reihe überall schwächer, wie beabsichtigt.
**Das ist Regel 21 an einer Testerwartung: Wer zwei Werte vergleicht, prüft zuerst, ob ihre
Bezugsgröße dieselbe ist** — sonst misst man eine Eigenschaft der Achse statt der Sache. Die Prüfung
läuft jetzt je Kanal und hat eine Vorab-Zeile (`2d-vorab`), die belegt, dass es überhaupt Kanäle
gibt, in denen beide Reihen vertreten sind; ohne sie wäre sie über einer leeren Menge trivial grün.

Die vier Gegenproben, jede mit ihrer „was fallen MUSS"-Liste und `WERKZEUGFEHLER`-Meldung
(Regel 71), 29 Prüfungen in jeder Richtung:

| Sabotage | fällt | Beleg |
|---|---|---|
| `ABGRUND_RELIKT_DECKEL.splitter` auf 0,25 | `2a` | `{"gerissen":["splitter"]}` |
| Marke aus `abgrundUeberReset` entfernt | `5a` | der Rumpf ohne sie |
| `checkAbgrundMeilensteine` an der Ladestelle entfernt | `5b`, `6a`, `6b` | `{"bekommen":0,"erwartet":7}` |
| Erfolg zurück auf die ganze Tabelle | `5c` | die Erfolgs-Zeile |

**Die dritte Zeile ist die aussagekräftigste**: Quelltext-Verdrahtung (`5b`) und gemessene Wirkung
(`6a`/`6b`) fallen zusammen und meinen damit nachweislich dasselbe. `6c` bleibt dabei grün und muss
es — es ist der Negativfall (kein Nachtrag ohne Tiefe) und ohne den Aufruf trivial erfüllt.

### Der Betroffenheits-Sweep hat die Hälfte übersehen — und der volle Lauf hat die Rechnung gestellt

Vor dem vollen Lauf lief der Sweep nach Regel 40/45: `grep -ln` über die geänderten KONSTANTEN
(`ABGRUND_RELIKTE`, `ABGRUND_RELIKT_DECKEL`, `ABGRUND_CHRONIK`, `abgrundkabinett` …), 14 Treffer,
alle grün. Der volle Lauf fiel trotzdem — an `test_abgrund_prestige` 3, der keine dieser Konstanten
liest, sondern die FUNKTION `ensureAbgrund` zerlegt.

**Der Sweep muss beide Seiten greppen: die geänderten Tabellen UND die geänderten Funktionen.**
Eine zweite Runde über `ensureAbgrund|abgrundUeberReset|abgrundReliktDef|ascension` fand acht
weitere Tests — zwei Minuten Arbeit gegen einen 50-Minuten-Lauf, der nach dem ersten Fehlschlag
ohnehin wertlos ist (Regel 14). Das ist derselbe Befund wie beim Nachtrag zu Regel 45, dort für ein
DOM-Merkmal statt für einen Containernamen: **Man greppt, woran man gerade denkt, und das ist beim
Bauen die Tabelle — kaputt geht aber die Funktion daneben.**

**Der Fehlschlag selbst war der Test in seiner besten Form.** `test_abgrund_prestige` 3 führt eine
handgepflegte Liste der Felder, die `ensureAbgrund` anlegen darf, und macht jedes unbekannte rot —
mit dem Hinweis „Neues Feld? In `abgrundUeberReset` entscheiden, ob es den Aufstieg überlebt". Er
ERZWINGT also die Entscheidung, statt sie zu erraten, und genau deshalb ist die Namensliste hier
richtig und keine Schwäche: Eine Ableitung könnte „bewusst zurückgesetzt" nicht von „vergessen"
unterscheiden.
**Behoben wurde er trotzdem nicht durch das Eintragen des Namens** — das hätte die Wache nur
stillgestellt, ohne dass irgendwo geprüft wäre, WIE entschieden wurde (Regel 43). Das Feld steht
jetzt zusätzlich in der Fixture UND in der Bleib-Prüfung von Abschnitt 2; die Gegenprobe (Marke aus
`abgrundUeberReset` entfernt) reißt `2: der Aufstieg behaelt meilensteine` bei identischen 36
Prüfnamen. Erst damit ist die Entscheidung gemessen statt quittiert.
**Und die Prüflisten wurden per `diff` verglichen, nicht gezählt** — der erste Vergleich meldete
„verschieden", und der einzige Unterschied war die SCHLUSSZEILE (`Alles gruen` gegen
`FEHLGESCHLAGEN`). Regel 60, zum wiederholten Mal.

**Vier Bestandstests halten die Kopplung mit:** `test_relikte` 86 (RELIKTE == NAMEN),
`test_abgrund_symbole` 74 (NAMEN == BILDER), `test_kompendium` und `test_erfolgsicons` (der zweite
Erfolg braucht ein Symbol in `ACH_ICONS`). In `test_relikte` sind dabei vier festgenagelte
SCHREIBWEISEN zu REGELN geworden (Regel 3): Die Wiederkehr wird nicht mehr gegen die feste Tiefe
130 geprüft, sondern als Periode über alle Tiefen, und die Zahl der Reliquien im Hilfetext kommt
aus einer Zahlwort-Zuordnung statt aus dem Wort „zwölf".


## Die Hausstil-Wache war gegen ihre eigene Fehlerklasse blind (28.08.2026)

Arbeitsregel 77 beschreibt seit dem 21.08.2026, dass ein `\uXXXX`-Escape die dateiweiten
Zeichenprüfungen blind macht. Sie stand als Warnung da, gemessen war sie an einem BEINAHE-Fall
(v8.599.0, vor dem Merge bemerkt). Beim Nachmessen der ausgelieferten Datei stellte sich heraus:
Der Fall ist längst eingetreten.

```
U+201C als LITERAL (wonach die Pflichtprüfung suchte) : 0
U+201C als ESCAPE  (was sie NICHT sah)                : 8
```

**Vier der acht standen in LEBENDEM Spielertext** — zwei `log()`-Meldungen der Modulschmiede
(„benötigt die Forschung …", „…es X geschmiedet") und zweimal die Titelzeile des Teilen-Bildes
(`ctx.fillText('\u201E'+titleDef.title+'\u201C', …)`). Die anderen vier liegen in PATCHNOTES
(Versionen 8.526.0 und 8.587.0) und sind unveränderliche Historie.

**Der Kommentar der Prüfung sagte ausdrücklich, das verbotene Zeichen komme „in 6,17 MB Datei und
986 Patchnote-Einträgen NULL Mal vor".** Das stimmte — für die SCHREIBWEISE, nach der sie suchte.
Genau die Sorte Satz, die beim nächsten Lesen als Beweis gelesen wird.

### Die Regel liegt jetzt in EINER Datei, nicht in zwei Kopien

`tests/lib/hausstil.js` ist die Implementierung; `tests/run.js` (Pflichtprüfung, läuft in allen
drei Modi) und `test_forschungstexte.js` sind nur noch die zwei AUSFÜHRUNGSSTELLEN. Bis hierher
stand an beiden ein eigenes `includes('“')` — solange die Regel eine Zeile war, ging das gut; mit
der Escape-Behandlung wären die zwei Kopien beim nächsten Anfassen auseinandergelaufen. Der
Kommentar in `run.js` benannte die Absicht schon vorher richtig („kein zweiter Maßstab, sondern ein
früherer Zeitpunkt") — jetzt ist sie auch gebaut.

**Die vier historischen Ausnahmen hängen an ihrer VERSION, nicht an einer Zeilennummer.** Eine
Zeilennummer ist beim nächsten Patchnote falsch; die Version ändert sich nie. Und die Ausnahme gilt
NUR für diese zwei Versionen, nicht für den ganzen PATCHNOTES-Block — ein NEUER Patchnote mit der
Escape-Schreibweise fällt weiterhin auf. Das ist genau der Fall, der bei v8.599.0 nur deshalb nicht
live ging, weil die Escapes zufällig als Stil-Abweichung auffielen.

### Die Messung, die den Wert belegt

| | alte Regel | neue Regel |
|---|---|---|
| Escape in lebendem Text (die Anlassfamilie) | **grün — sieht nichts** | rot, nennt Zeile 28130 |
| Literal U+201C | rot | rot |

Vier Gegenproben, alle beidseitig gefahren, 21 Prüfungen in jeder Richtung bei identischer
Prüfliste, jede mit `WERKZEUGFEHLER`-Wache (Regel 71):

| Sabotage | Ergebnis |
|---|---|
| Escape zurück in den Schmiede-Text | rot, `Escape \u201c Zeile 28130` |
| Literal U+201C statt des geraden Zeichens | rot, `Literal U+201C Zeile 28130` |
| NEUER Patchnote (9.999.0) mit Escape | rot — die Ausnahme gilt nicht für den Block |
| `HISTORIE`-Liste geleert | rot mit den vier historischen Stellen — die Liste ist kein toter Code (Regel 59) |

**Die dritte und die vierte Zeile gehören zusammen:** Ohne die dritte wäre die Ausnahme zu breit
(jeder künftige Patchnote dürfte tarnen), ohne die vierte wäre sie womöglich wirkungslos und
niemand hätte es gemerkt.

### Ein Datums-Befund nebenbei, und er ist eine Messregel

Die Pflichtprüfung meldete „Backend-Klon … geholt vor 129,2 Stunden", eine Stunde nachdem ich ihn
gezogen hatte. Kein Fehler der Prüfung: Die **Containeruhr war um 5,3 Tage weitergesprungen** (die
Sitzung lag dazwischen still). Nachgemessen an einer unabhängigen Uhr — dem `Date`-Kopf des Pi —
war wirklich der 28.08., während meine Commits vom selben Sitzungsverlauf den 22.08. tragen.
**Vorgehen: Wer ein Datum in einen Patchnote oder in diese Datei schreibt, misst es an einer
EXTERNEN Uhr** (`curl -sI https://www.gamegeeeeek.de/ | grep -i '^date:'`), nicht am Gefühl für
den Sitzungsverlauf — der kann beliebig lange Pausen enthalten, und ein falsch datierter Patchnote
ist unveränderliche Historie.
## Der Betreiber erfährt, wenn ein neuer Spieler anfängt (22.08.2026)

Auftrag Sascha: „füge hinzu wenn sich neuer spieler anmeldet und spielt bekommt gamegeeeeek eine
push nachricht." Über `AskUserQuestion` gewählt: **Auslöser ist das erste Öffnen des Spiels**
(nicht die Registrierung) und **eine Meldung je Neuling, sofort** (keine Bündelung).

Die serverseitige Hälfte samt Begründungen steht in der **Backend-CLAUDE.md**. Hier nur, was das
Frontend angeht — und der Fund, der dabei herausfiel.

### Vier Stellen, und die vierte ist die, die man übersieht

`neuspieler` in `notifPrefsCache`, ein `NOTIF_EVENT_INFO`-Eintrag, eine Zeile im Markup der
Benachrichtigungs-Box, und die **Sichtbarkeit** dieser Zeile. Die Kategorien-Aufzählung steht im
Spiel an fünf Stellen (`getNotifPrefs` und `POST /api/notification-prefs` im Backend,
`notifPrefsCache`, das `data-notif-cat`-Markup und `NOTIF_EVENT_INFO` hier) — wer eine davon
vergisst, bekommt keinen Fehler, sondern eine stille Lücke.

**Der `NOTIF_EVENT_INFO`-Eintrag ist Pflicht, nicht Zierde.** Ohne ihn zeichnet das Postfach die
Zeile über den Rückfall am Ende: Glocke, graue Farbe und wörtlich das Wort **„Ereignis"** statt
einer Auskunft. Gemessen, nicht vermutet — die Gegenprobe mit entferntem Eintrag zeigt genau das.

**Der Schalter ist NUR für das Betreiberkonto sichtbar**, und das folgt aus Saschas zweiter Wahl:
Ohne Bündelung bekommt das Postfach je Neuling einen Eintrag, und es hält 30. Ein Schalter, den
jeder sieht, aber nur einer je auslöst, wäre eine tote Fläche mit einem Versprechen daran — genau
die Sorte Falschaussage, gegen die Regel 35 geschrieben ist. Die Prüfung ist **bewusst keine
Sicherheitsgrenze** und muss keine sein: Der Server schlägt die Kategorie ohnehin nur am
Betreiberkonto nach; ein fremdes Konto kann sie setzen, gelesen wird sie dort nie.

**Der Text sagt „geöffnet", nicht „spielt".** Der Auslöser ist der erste Spielstand-Save, und der
feuert automatisch beim ersten Boot — die Meldung behauptet damit nur, was sie belegen kann.

### Der Fund: der Kategorie-Wächter war seit dem 02.08.2026 blind

`test_pushkategorien` prüfte den Postfach-Text nur für **einen** Typ — mit dem Kommentar „geprüft
wird deshalb nur, dass der NEUE Typ einen hat". Der „neue Typ" war `alliance-raid` vom 02.08.2026;
**jeder Typ danach war ungeprüft**. Belegt an einer Sabotage: Der Eintrag des neuen
`neuer-spieler` ließ sich entfernen, und der Test blieb grün.

Gemessen fehlt der Text bei **fünf** Bestandstypen (`alliance-application`, `feedback-received`,
`message`, `player-reported`, `referral-milestone`) — alle fünf zeigen im Postfach „Ereignis". Sie
stehen jetzt als **namentliche** Ausnahmeliste da, nicht mehr als „u. ä." im Kommentar: Ein
sechster fällt damit auf, ohne dass jemand an ihn gedacht haben muss (Regel 40), und die Lücke
bleibt sichtbar statt in einer Floskel zu verschwinden. Dazu die Gegenrichtung (`2c`, Regel 33):
Wer einen der fünf Texte nachträgt, muss den Namen aus der Liste nehmen — sonst wächst eine Liste
mit, die niemand mehr liest.

**Die übertragbare Lehre steht unten als Arbeitsregel 79**, weil sie über diesen Test hinausgeht.

### Zwei Fallen beim Bau des Frontend-Wächters

- **`data-tab="einstellungen"` gibt es nicht.** Ein geratener Reiter-Name (Regel 4), und
  `if (b) b.click()` verschluckt ihn still — der Test klickte nichts und maß trotzdem etwas. Der
  Weg zu den Benachrichtigungs-Einstellungen läuft über `headerProfileBtn`; die Berichte-Box über
  `headerReportsBtn`. **Die Vorlage, aus der ich kopiert hatte (`test_chatpush_schalter.js`),
  trägt denselben Fehler und merkt ihn nie**, weil sie nur `className` liest. Seitdem stehen
  `1-vorab` und `3-vorab` davor, die belegen, dass die Fläche überhaupt offen ist.
- **Die Sichtbarkeit wird als PAAR gemessen** (Regel 61): Betreiberkonto sieht den Schalter,
  ein anderes Konto nicht. Jede Hälfte allein wäre auch dann grün, wenn die Zeile ganz fehlt.

Wächter: `tests/test_neuspieler_meldung.js` (17 Prüfungen — Sichtbarkeits-Paar, Schalterzustand,
Postfach-Zeile) und `tests/test_pushkategorien.js` (erweitert). Die Backend-Hälfte prüft
`tests/test_neuspieler_push_http.js` im Nachbar-Repo (30 Prüfungen, Port 3231).

Gegenprobe gegen `origin/main` per `KEPLER_SPIELDATEI`: **9 rot bei identischen 17 Prüfnamen** (per
`diff` verglichen, nicht gezählt — Regel 60). `3c` zeigt den Anlassfall wörtlich, statt ihn zu
behaupten: `"Ereignis22.08., 19:07 · tippen zum Öffnen"` — genau die Zeile, die das Postfach ohne
`NOTIF_EVENT_INFO`-Eintrag zeichnet.

**Die zwei PRs gehören zusammen gemerged**, obwohl die Reihenfolge sonst gleichgültig wäre (ein
Frontend ohne Server-Kategorie zeigt einen Schalter ohne Wirkung, ein Server ohne Frontend schickt
eine Meldung, die das Postfach als „Ereignis" zeichnet — beides harmlos): `test_pushkategorien`
hält Backend-Kategorien und Frontend-Schalter zusammen und fällt bei einer Seite allein.

78. **Ein Test, der PERSISTENZ über einen Serverstopp misst, darf nicht SIGTERM benutzen — der
    Graceful Shutdown schreibt genau den Eintrag mit, dessen Verlust gemessen werden soll.**
    Vorfall 22.08.2026: Abschnitt 6 von `test_neuspieler_push_http` sollte belegen, dass die
    Meldung einen Neustart überlebt. Sie tut das nur, weil `pushNotificationEvent` in `db.private`
    schreibt und `saveDb()` folgt — die Prüfung wäre also die Absicherung gegen einen Umbau auf
    reines RAM. Mit `SIGTERM` ist sie **wertlos**: Der Handler flusht die Datenbank auf Platte,
    also auch einen Eintrag, der nur im Speicher stand. Ein Umbau auf RAM-only bliebe grün.
    Verschärfend hatte ich in den Kommentar geschrieben, SIGKILL „misst etwas anderes" — das war
    ungemessen und falsch herum. Gemeldet hat es allein die `WERKZEUGFEHLER`-Wache der Gegenprobe
    (Regel 71): Die Sabotage „nur im RAM halten" ließ Abschnitt 6 grün.
    **Vorgehen:** Wer Persistenz misst, beendet den Prozess so, wie er im Ernstfall stirbt —
    `SIGKILL`, kein Aufräumen, kein Flush. Und die Gegenrichtung gehört dazu (`6a3`): Nach einem
    SIGKILL muss der Eintrag da sein, weil er WIRKLICH auf Platte lag, nicht weil ihn der Stopp
    noch hingeschrieben hat.

79. **Ein Wächter, der nur „den NEUEN Fall" prüft, ist ab dem übernächsten Fall blind — und sein
    eigener Kommentar tarnt das als Absicht.** Vorfall 22.08.2026: `test_pushkategorien` prüfte den
    Postfach-Text für genau einen Typ, mit der Begründung „geprüft wird deshalb nur, dass der NEUE
    Typ einen hat". Das war beim Schreiben (02.08.2026) richtig und ab dem nächsten Typ falsch;
    gemessen fehlten fünf. Ein „u. ä." im Kommentar verschleiert dabei doppelt: Es behauptet
    Vollständigkeit („und ähnliche"), ohne eine einzige Zahl zu nennen, und es macht die Lücke
    unsichtbar für den, der später den Test liest.
    **Vorgehen:** Ein Wächter prüft die MENGE, nicht das jüngste Mitglied. Bestandslücken werden
    **namentlich** ausgenommen (nie als Sammelbegriff), mit dem Datum der Messung — dann fällt ein
    neuer Fall auf, ohne dass jemand an ihn gedacht haben muss (Regel 40), und die Ausnahmeliste
    braucht ihre Gegenrichtung (Regel 33): Ein Name, der längst behoben ist, gehört heraus.
    Das ist die Familie von Regel 68, eine Ebene höher: Dort hält ein Test einen FEHLER als Regel
    fest, hier hält er eine LÜCKE als Absicht fest.

## Der Urmateriekern war unauffindbar — zwei Mechanismen, ein Komplettpaket (28.08.2026)

**Spieler-Report Sascha: „Habe alle Systeme durchgeschaut kein einzigen urmaterie Asteroiden
gefunden."** Adversarisch geprüft (16 Agenten, Nullhypothese „Pech beim Würfeln" aktiv widerlegt —
Regel 20): Die Ziehlogik ist korrekt (1 Mio Ziehungen: 2,892 % bei erwarteten 2,91 %), aber ZWEI
Mechanismen machten den Report trotzdem zwingend statt unglücklich:

1. **Die Zeitlücke.** Die Felder entstanden am 16.08. mit der Sortentabelle VOR Backend #117 — die
   Startpopulation konnte bauartbedingt keinen Urmateriekern enthalten, und neue Sorten entstehen
   nur nach vollständiger Leerförderung (p = 3/103 je Neuwurf). Am Messtag lag P(kein einziger
   Kern in der ganzen Galaxie) bei 55–74 % — **deterministisch null zum Start, danach Tropf**.
2. **Die Unsichtbarkeit.** Jedes Vorkommen wurde nach GRÖSSE gefärbt (`g.farbe`), nie nach Sorte —
   ein Urmateriekern sah exakt aus wie ein Eisenbrocken gleicher Größe. Hilfetext („das Symbol die
   Sorte") und Patchnote („Auf der Karte fällt er sofort auf — goldgeadert") versprachen etwas,
   das kein Pixel einlöste (Regel 59-Familie: das Versprechen existierte nur im Text).

Sascha hat das **Komplettpaket** gewählt: Sichtbarkeit + einmalige Nachsaat (~3 Kerne) +
Mindestbestand-Regel. Die Backend-Hälfte steht in der Backend-CLAUDE.md; hier das Frontend.

### Die Zeichnung: Gold hängt an der SORTE, alles andere bleibt bei der Größe

An BEIDEN Zeichenstellen (Gürtel `data-map-asteroid` UND Schürfpeilung — die Peilung ist die
klassische zweite Anzeigestelle, Punkt 6) gilt: `istUrmaterie = a.sorte === PROTOMATERIE_SORTE`
→ Körper `#8a5f1c`, Ader-Rand und Innenkreis `#ffe6ab`. **Die Weiche hängt an der Konstante,
nicht an einem zweiten Literal** — `test_urmaterie_karte` 0b hält das fest. Alle anderen Sorten
zeichnen unverändert nach Größenfarbe; das ist die Zusage der Etappe (1b misst die Gegenrichtung
am Eisenbrocken GLEICHER Größe — nur so belegt der Unterschied die Sorte und nicht die Größe).

**Der Kartenmenü-Kopf trägt jetzt das gezeichnete Sortensymbol** (`iconHtmlFor(so.icon,
'ti-pick')` statt festem `ti-pick`) — damit haben alle zehn `ast_*`-Icons in `ICONS` ihre erste
LESESTELLE überhaupt (Regel 42/59: ein gezeichnetes Symbol, das niemand einbindet, existiert für
den Spieler nicht). Die `so`-Deklaration ist dafür VOR den Kopf gezogen; die alte weiter unten ist
raus (sonst doppeltes `const`).

### Der Hilfetext — und die Falschaussage, die der eigene Screenshot gefangen hat

Der erste Entwurf schrieb „das einzige warme, goldgeaderte Gestein zwischen lauter grauen
Brocken". **Am gerenderten Bild gemessen ist das falsch** (Regel 11/42): Die GRÖSSENFARBEN sind
grau nur bei Splitter/Brocken — ein Eisen-KERN ist warmes Orange (`#e0a548`), ein Koloss rosa.
Das immer wahre Merkmal ist die **helle Ader statt des dunklen Rands** (alle anderen Vorkommen
tragen `#0a0d1a`), und daran hängt der Text jetzt. Der Patchnote der Sorten-Einführung trägt die
alte Formulierung weiter — unveränderliche Historie; `test_urmaterie_karte` 0d2 prüft mit
PATCHNOTES-Exzision (Regel 46), dass sie in den lebenden Text nicht zurückkehrt.

### Wächter und Gegenproben

`tests/test_urmaterie_karte.js` (16 Prüfungen): Quelltext (0a–0d2), Paar-Messung am gerenderten
Spiel (Urmaterie gold, Eisen gleicher Größe unverändert, die Ader NUR beim Urmaterium), Kartenmenü
(SVG vorhanden, die zwei Sorten-SVGs VERSCHIEDEN — sonst wäre auch ein festes Bild grün, Regel 61).
Gegenprobe gegen `origin/main` per `KEPLER_SPIELDATEI`: **9 rot bei identischen 16 Prüfnamen**, und
`1-vorab` zeigt den Anlassfall wörtlich — beide Vorkommen identisch `#e0a548`, ununterscheidbar.
`1-vorab` und `1b` MÜSSEN dabei grün bleiben (Werkzeugfehler-Wache, Regel 71).

**Und die erste Pflichtliste der Backend-Gegenprobe war doppelt falsch — die Lehre steht im
Test-Kopf von `test_urmaterie_boden_http.js` im Nachbar-Repo:** `1b`/`1d`/`3c` waren am alten Stand
aus dem FALSCHEN Grund grün (leere Liste bzw. `undefined === undefined`, Regel 28 — dieselbe
Familie wie bei `test_health_commit_http`: erst einen WERT verlangen, dann die Beziehung), und `3b`
fiel dort sehr wohl, weil es gegen den in `3a` GEMESSENEN Bestand prüft. Eine Pflichtliste ist
selbst eine Behauptung, bis die Gegenprobe sie gemessen hat.
