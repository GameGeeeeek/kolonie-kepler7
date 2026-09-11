// Weit entwickelter Spielstand ueber die echte Storage-API. Bewusst nur ein TEILSTAND:
// load() macht Object.assign(state, save), fehlende Felder behalten ihre Defaults - der
// Seed kann so nicht am Schema vorbeigehen, auch wenn das Spiel 250 Versionen weiter ist.
const fs = require('fs');
const BASE = 'http://127.0.0.1:3001/api';
const html = fs.readFileSync(process.argv[2], 'utf8');
const planetIds = [...html.matchAll(/\{ id:'([a-zA-Z0-9_-]+)', system:'/g)].map(m => m[1]);
const bld = lv => ({ solar:lv, mine:lv-1, raffinerie:lv-3, synth:lv-5, fusionsreaktor:lv-9,
  habitat:lv-7, lager:lv-6, turm:lv-12, schild:lv-14, laser:lv-11, plasma:lv-16,
  raketen:lv-15, gauss:lv-18, labor:lv-8, festung:Math.max(0, lv-24) });
(async () => {
  const r = await fetch(BASE + '/login', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ username:'Kommandant', password:'demo123456' }) });
  const j = await r.json();
  if (!r.ok) { console.error('Login fehlgeschlagen:', j); process.exit(1); }
  const discovered = {}; planetIds.slice(0, 46).forEach(id => discovered[id] = true);
  const colonies = {};
  for (const id of ['rhea','aion','draconis','nyxar','oberon'])
    if (planetIds.includes(id)) colonies[id] = { buildings: bld(26), fleet: {} };
  const save = {
    tutorialSeen: true, seenTabHints: {},
    player: { id:'demo-kommandant', name:'Kommandant', allianceTag:'' },
    // Deutlich unter dem Lagerdeckel, damit die Zaehler sichtbar laufen statt "Lager voll".
    resources: { energie:38_400, erz:41_200, kristalle:33_900, deuterium:27_600,
                 antimaterie:2_140, forschungspunkte:19_800 },
    buildings: bld(34),
    research: { rsolar:20, rerz:20, rkristall:20, rdeuterium:18, rsolar2:12, rerz2:12,
                rkristall2:10, rdeuterium2:9, rlager:16, rlager2:8, rfusion:11, rkampf:14,
                rkampf2:7, rantimaterie:9, rbauplan:7, rmodultechnik:6, rnanotech:5 },
    fleet: { ships:24, cruisers:186, destroyers:94, frachter:142, colonyShips:6, jaeger:640,
             schlachtschiff:78, spaeher:31, carrier:12, bomber:113, superschlachtschiff:2, missions:[] },
    discovered, colonies,
    credits: 184_500, xp: 412_000, prestige: 3, battlePoints: 26_400, commandPoints: 910,
    battleStats: { wins:143, losses:27 }, npcKills: 318, bossKills: 11,
    lastTick: Date.now() - 8*3600*1000
  };
  const pr = await fetch(BASE + '/storage/kepler7-save-v3?shared=false', {
    method:'PUT', headers:{'Content-Type':'application/json','Authorization':'Bearer '+j.token},
    body: JSON.stringify({ value: JSON.stringify(save) }) });
  console.log('Spielstand:', pr.status, '| Planeten erkannt:', planetIds.length);
  if (!pr.ok) console.error(await pr.text());
})();
