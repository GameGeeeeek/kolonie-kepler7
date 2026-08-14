---
name: anzeigestellen
description: 'Nach jeder Mechanik- oder Balance-Änderung im Spiel kolonie-kepler7 ALLE Anzeigestellen derselben Größe finden, nicht nur die eine im Kopf. Der wiederkehrende Fehler dieses Projekts ist nicht die kaputte Mechanik, sondern eine zweite Anzeigestelle (Vorschau, Banner, Bericht, Hilfetext, Event-Text), die die alte Annahme behält. IMMER verwenden, wenn eine Formel, Schwelle, Kampfphase, Gewinnchance, ein Prozentwert oder eine ähnliche Spielgröße geändert wird — auch ohne explizite Nachfrage nach "wo wird das noch angezeigt".'
---

# Anzeigestellen (kolonie-kepler7)

Nach einer Mechanik-Änderung ist die Mechanik selbst fast immer korrekt umgebaut — der Fehler
sitzt fast immer in einer **zweiten Stelle, die den Wert dem Spieler zeigt** und die alte Annahme
behalten hat. Vier Belege in einer einzigen Session: die PvP-Vorschau urteilte noch binär, obwohl
der Kampf längst dreiphasig lief; das Bedrohungs-Banner hatte eigene, widersprechende Schwellen;
der Hilfe-Abschnitt „Kampfphasen" nannte nur die alten Werte; 15 Event-Texte verwiesen auf die
falsche Aktivität.

## Vorgehen: erst greppen, dann committen

Nach jedem Umbau einer Spielgröße drei Suchen fahren, **bevor** committet wird:

1. **Nach dem Namen** der geänderten Funktion/Konstante:
   `grep -n "funktionsName\|KONSTANTE_NAME" weltraum_kolonie.html`
2. **Nach den Wörtern**, mit denen die Größe dem Spieler präsentiert wird: „Chance", „Prozent",
   „%", Verdikt-Formulierungen wie „erfolgversprechend"/„aussichtslos".
3. **Nach den Grenzwerten als Literal**: z. B. „95%", „5%", oder die konkrete Zahl der alten
   Schwelle.

Jede Fundstelle einzeln prüfen: **sagt sie noch die Wahrheit?**

## Wo es erfahrungsgemäß hakt

- Die eigentliche Vorschau/der Rechner
- Banner/Kurzurteil daneben (kann der Vorschau eigenständig widersprechen)
- Der Bericht nach der Aktion
- `HELP_SECTIONS` (Hilfe-Texte)
- `TUTORIAL_STEPS` (Tutorial-Texte)
- Die `desc`-Texte der `*_DEFS`-Arrays
- Event-Texte, die auf eine bestimmte Aktivität verweisen (z. B. „geh auf Erkundung", obwohl der
  Beleg nur auf Expeditionen fällt)

## Zwei benachbarte Regeln

- **Jede neue Schwelle**: beide Seiten durchdenken — was passiert *knapp darunter*, und wirft der
  Zweig darunter Zustand weg? Eine Schwelle entscheidet den Rechenweg, nie, ob Zeit/Zustand
  überhaupt zählt.
- **Patchnotes sind Versprechen** — eine Behauptung wie „die Schwelle liegt hoch genug" vorher
  messen, nicht nur behaupten. Ein Patchnote-Eintrag ist selbst eine Anzeigestelle.
