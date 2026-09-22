#!/usr/bin/env python3
"""One-time transport importer. Produces readable German/English pairs in en.json.
The indexed transport files are not runtime inputs and are removed after import.
Both the original game and the extracted ordered source lists are SHA-256 pinned.
"""
import hashlib
import json
import re
import shutil
from pathlib import Path
from bs4 import BeautifulSoup, Comment, Doctype
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
source = (ROOT / 'weltraum_kolonie.html').read_text(encoding='utf-8')
assert hashlib.sha256(source.encode()).hexdigest() == 'd2e1a3525a0b657b36022725fc2c7175f90a94281575a52cbda419040bafb24e', 'Source changed: refuse indexed import'
soup = BeautifulSoup(source[:source.index('<script>')], 'html.parser')
texts = sorted(set(re.sub(r'\s+', ' ', str(n)).strip() for n in soup.find_all(string=True)
    if not isinstance(n, (Comment, Doctype))
    and not any(p.name in ('script', 'style', 'noscript') for p in n.parents)
    and re.search(r'[A-Za-zÄÖÜäöüß]', str(n))))
attrs = sorted(set(str(el[key]).strip() for el in soup.find_all(True)
    for key in ('title', 'placeholder', 'aria-label', 'alt') if el.has_attr(key) and str(el[key]).strip()))
assert hashlib.sha256(json.dumps(texts, ensure_ascii=False).encode()).hexdigest() == 'be7a2e8988a9733568324a18c2e00aff1a9380a8e191fe91424160d72818e674'
assert hashlib.sha256(json.dumps(attrs, ensure_ascii=False).encode()).hexdigest() == 'be4eb8e5f70f06b01c5131521f7f9e6c1fa0a053e5e349b663b28b9f5a43f4c1'
def normalize(text):
    return re.sub(r'\s+', ' ', text).strip().replace(chr(8220), '"')
pairs = {}
for sources, files in [(texts, sorted(HERE.glob('en-*.tsv'))), (attrs, [HERE / 'attrs-en.tsv'])]:
    imported = set()
    for file in files:
        for line in file.read_text(encoding='utf-8').splitlines():
            number, english = line.split('\t', 1)
            index = int(number)
            assert index not in imported and english.strip()
            imported.add(index)
            german = normalize(sources[index])
            if german != english:
                pairs[german] = english
    assert imported == set(range(len(sources))), 'Missing translations'
pairs.update({
 'Kolonie Kepler-7 – Kostenloses Weltraum-Idle-Spiel im Browser':'Kolonie Kepler-7 – Free space idle browser game',
 'Anmelden':'Log in','Abbrechen':'Cancel','Basis':'Base','Forschung':'Research','Flotte':'Fleet','Offiziere':'Officers','Markt':'Market','Fortschritt':'Progress','Nachrichten':'Messages','Berichte':'Reports','Erfolge':'Achievements','Erz':'Ore','Kristalle':'Crystals','Energie':'Energy','Deuterium':'Deuterium','Antimaterie':'Antimatter','Forschungspunkte':'Research points','Kredite':'Credits',
 'Nanolegierung':'Nano-alloy','Quantenchips':'Quantum chips','Reinkristalle':'Pure crystals','Fusionskerne':'Fusion cores','KI-Matrizen':'AI matrices','Metamaterial':'Metamaterial','Singularitätskerne':'Singularity cores','Hohlraumgewebe':'Void weave','Kausalanker':'Causal anchors',
 'Bauen':'Build','Ausbauen':'Upgrade','Erforschen':'Research','Abreißen':'Demolish','Aktivieren':'Activate','Deaktivieren':'Deactivate','Einsammeln':'Collect','Abholen':'Claim','Freischalten':'Unlock','Anheuern':'Hire','Befördern':'Promote','Verkaufen':'Sell','Kaufen':'Buy','Herstellen':'Craft','Zerlegen':'Dismantle','Ausrüsten':'Equip','Ablegen':'Unequip','Reparieren':'Repair','Aufrüsten':'Upgrade','Starten':'Start','Angreifen':'Attack','Zurückrufen':'Recall','Entlassen':'Dismiss','Stufe':'Level','Stufen':'Levels','Kosten':'Cost','Dauer':'Duration','Produktion':'Production','Kapazität':'Capacity','Bestand':'Owned','Verfügbar':'Available','Gesperrt':'Locked','Freigeschaltet':'Unlocked','Maximal':'Maximum','Maximum erreicht':'Maximum reached','Voraussetzungen':'Requirements','Voraussetzung':'Requirement','Benötigt':'Requires','Fehlt':'Missing','Fertig':'Done','Fertig!':'Done!','Bereit':'Ready','Aktiv':'Active','Inaktiv':'Inactive','An':'On','Aus':'Off','Ja':'Yes','Nein':'No',
 'Gewöhnlich':'Common','Ungewöhnlich':'Uncommon','Selten':'Rare','Episch':'Epic','Legendär':'Legendary','gewoehnlich':'common','ungewoehnlich':'uncommon','gewöhnlich':'common','ungewöhnlich':'uncommon','selten':'rare','episch':'epic','legendär':'legendary','legendaer':'legendary','Seltenheit':'Rarity','Bonus':'Bonus','Effekt':'Effect','Keine':'None','Leer':'Empty','Alle':'All','Heute':'Today','Gestern':'Yesterday','Gesamt':'Total','Geschwindigkeit':'Speed','Panzerung':'Armour','Schild':'Shield','Schilde':'Shields','Laderaum':'Cargo capacity','Reichweite':'Range','Schaden':'Damage','Angriff':'Attack','Verteidigung':'Defence','Kampfpunkte':'Combat points','Angriffspunkte':'Attack points',
 'Solarkraftwerk':'Solar power plant','Erzmine':'Ore mine','Kristallraffinerie':'Crystal refinery','Deuteriumsynthetisierer':'Deuterium synthesizer','Fusionsreaktor':'Fusion reactor','Nanolegierungsfabrik':'Nano-alloy factory','Quantenchipfabrik':'Quantum chip factory','Kristalllabor':'Crystal laboratory','Fusionsschmiede':'Fusion forge','KI-Labor':'AI laboratory','Metamaterialweberei':'Metamaterial weaver','Singularitätsreaktor':'Singularity reactor','Hohlraumweberei':'Void weaver','Kausalanker-Werk':'Causal anchor factory','Aufbereitungsanlage':'Processing plant','Habitat-Kuppel':'Habitat dome','Lagerkomplex':'Storage complex','Hochsicherheitslager':'High-security storage','Kryolager':'Cryogenic storage','Fusions-Werftkern':'Fusion shipyard core','Quanten-Assemblierwerft':'Quantum assembly yard','Kryo-Archiv':'Cryogenic archive','Gravitations-Stabilisator':'Gravity stabilizer','Autonomiekern':'Autonomy core','Verteidigungsturm':'Defence turret','Flak-Batterie':'Flak battery','Schildgenerator':'Shield generator','Ionenschild':'Ion shield','Lasergeschütz':'Laser turret','Plasmawerfer':'Plasma launcher','Raketensilo':'Missile silo','Gauss-Kanone':'Gauss cannon','Railgun-Batterie':'Railgun battery','Void-Barriere':'Void barrier','Forschungslabor':'Research laboratory','Bergungswerft':'Salvage yard','Kristallfestung':'Crystal fortress','Resonanzschild-Emitter':'Resonance shield emitter','Urmaterie-Reaktor':'Primordial matter reactor','Verteidigungsbunker':'Defence bunker','Nano-Verteidigungsplattform':'Nano-defence platform','Signaturscanner':'Signature scanner','Quanten-Sensorphalanx':'Quantum sensor phalanx','Hochenergie-Schildkuppel':'High-energy shield dome','Fusionsbastion':'Fusion bastion','KI-Verteidigungskern':'AI defence core','Metamaterial-Panzerwall':'Metamaterial bulwark','Singularitäts-Geschützturm':'Singularity turret','Tresor':'Vault','Abhorchposten':'Listening post','Mondschildgenerator':'Lunar shield generator','Botschaftsviertel':'Embassy district',
 'Jäger':'Fighter','Bomber':'Bomber','Zerstörer':'Destroyer','Schlachtschiff':'Battleship','Wächter':'Guardian','Träger':'Carrier','Kreuzer':'Cruiser','Fregatte':'Frigate','Korvette':'Corvette','Forschungsschiff':'Research vessel','Kolonieschiff':'Colony ship','Transporter':'Transport ship','Großer Transporter':'Large transport ship','Spionagesonde':'Spy probe','Bergungsschiff':'Salvage vessel','Bergbauschiff':'Mining ship','Schlachtschiffe':'Battleships','Schiffe':'Ships','Module':'Modules','Admiral':'Admiral','Ingenieur':'Engineer','Wissenschaftler':'Scientist','Navigator':'Navigator','Händler':'Merchant','Spion':'Spy','Taktiker':'Tactician',
 'Produktion & Wirtschaft':'Production & economy','Waffen & Kampf':'Weapons & combat','Verteidigung & Schilde':'Defence & shields','Logistik & Infrastruktur':'Logistics & infrastructure','Grundlagen':'Fundamentals','Spezialisierungen':'Specializations','Tagesaufgaben':'Daily tasks','Belohnung':'Reward','Belohnungen':'Rewards','Abgeschlossen':'Completed','In Arbeit':'In progress','In Bau':'Under construction','In Forschung':'Researching','Warteschlange':'Queue','Bauwarteschlange':'Construction queue','Forschungswarteschlange':'Research queue','Keine aktive Forschung':'No active research','Keine aktiven Missionen':'No active missions','Noch keine Einträge.':'No entries yet.','Noch keine Module vorhanden.':'No modules yet.','Keine Module vorhanden.':'No modules available.','Nicht genug Ressourcen.':'Not enough resources.','Nicht genug Kredite.':'Not enough credits.','Bitte warten…':'Please wait…','Wird geladen…':'Loading…','Lädt…':'Loading…','Verbindung wird hergestellt…':'Connecting…','Verbindung fehlgeschlagen.':'Connection failed.','Ungültiger Benutzername oder Passwort.':'Invalid username or password.','Bitte Benutzername und Passwort eingeben.':'Please enter your username and password.'
})
patterns = [
 ['Stufe {0}','Level {0}'],['Stufe {0}/{1}','Level {0}/{1}'],['Stufe {0} → {1}','Level {0} → {1}'],['Level {0}','Level {0}'],['Schritt {0}/{1}','Step {0}/{1}'],['Schritt {0} von {1}','Step {0} of {1}'],['{0} frei','{0} free'],['{0} belegt','{0} occupied'],['{0} übrig','{0} remaining'],['{0} verfügbar','{0} available'],['{0} Schiffe','{0} ships'],['{0} Punkte','{0} points'],['{0} Kredite','{0} credits'],['Kosten: {0}','Cost: {0}'],['Dauer: {0} s','Duration: {0} s'],['Gesamt: {0}','Total: {0}'],['Bestand: {0}','Owned: {0}'],['Produktion: +{0}/s','Production: +{0}/s'],['Kapazität: {0}','Capacity: {0}'],['Noch {0} Sekunden','{0} seconds remaining']
]
output = {'status':'beta', 'language':'en', 'entries':list(pairs.items()), 'patterns':patterns}
(ROOT / 'i18n/en.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Imported', len(pairs), 'explicit German/English pairs; runtime uses no numeric source indices.')
shutil.rmtree(HERE)
