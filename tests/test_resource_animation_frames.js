'use strict';
// Execute the game's own counter with frame timestamps that can precede performance.now().
// The frame clock is controlled here; production, saved resources and browser timers are not mocked.
const fs = require('node:fs');
const vm = require('node:vm');
const { SPIELDATEI } = require('./lib/spieldatei');

let checks = 0, failures = 0;
function check(name, condition, detail) {
  checks++;
  if (!condition) failures++;
  console.log((condition ? 'OK' : 'FAIL') + ' - ' + name +
    (condition || detail === undefined ? '' : ' ' + JSON.stringify(detail)));
}

function exercise(nativeFunction, prefix, from, to) {
  const element = {}, cap = 12000, writes = [], frames = new Map();
  const animations = new WeakMap();
  let clock = 100, nextFrame = 0;
  const context = vm.createContext({
    resValAnimFrames: animations,
    prefersReducedMotionMq: { matches: false },
    powerSaveActive: () => false,
    performance: { now: () => clock },
    requestAnimationFrame: callback => { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    resWertSchreiben: (target, value, capacity) => writes.push({ target, value, capacity })
  });
  const animate = vm.runInContext(nativeFunction + '\nanimateResValue;', context, { timeout: 1000 });
  const pump = timestamp => {
    const entry = frames.entries().next().value;
    if (!entry) throw Error(prefix + ': no pending native frame');
    frames.delete(entry[0]);
    clock = Math.max(clock, timestamp);
    entry[1](timestamp);
    return writes[writes.length - 1]?.value;
  };
  const withinStocks = value => Number.isFinite(value) &&
    value >= Math.min(from, to) && value <= Math.max(from, to);

  animate(element, from, to, cap);
  check(prefix + '0: der echte Animationspfad plant einen Frame',
    writes.length === 0 && frames.size === 1 && animations.has(element));

  // The observed regression used a frame about 18 ms before the animation's performance.now().
  const early = pump(82);
  check(prefix + '1: Frühframe bleibt zwischen den beiden realen Beständen',
    withinStocks(early), { from, to, early, frame: 82, start: 100 });
  check(prefix + '2: Frühframe lässt die Animation weiterlaufen',
    frames.size === 1 && animations.has(element));

  const middle = pump(290);
  check(prefix + '3: Zwischenframe bewegt sich innerhalb der realen Bestände',
    withinStocks(middle) && middle !== from && middle !== to, { from, to, middle });

  const final = pump(700);
  check(prefix + '4: verspäteter Schlussframe zeichnet exakt den Zielbestand',
    final === to, { to, final });
  check(prefix + '5: abgeschlossene Animation hinterlässt keinen Frame',
    frames.size === 0 && !animations.has(element));
  check(prefix + '6: jeder Frame schreibt nur die ursprüngliche Anzeige und Kapazität',
    writes.length === 3 && writes.every(write => write.target === element && write.capacity === cap));
}

try {
  const source = fs.readFileSync(SPIELDATEI, 'utf8');
  // The native outer closing brace has two-space indentation; nested braces are deeper.
  const matches = [...source.matchAll(/^  function animateResValue\(el, from, to, cap\)\{\r?\n[\s\S]*?^  \}\r?$/gm)];
  check('S0: die native Animationsfunktion wird eindeutig aus SPIELDATEI gelesen', matches.length === 1);
  if (matches.length !== 1) throw Error('Expected one native animateResValue function');
  exercise(matches[0][0], 'R', 90000, 3.2129e9);
  exercise(matches[0][0], 'F', 3.2129e9, 90000);
} catch (error) {
  failures++;
  console.error(error.stack);
}
console.log(checks + ' checks, ' + failures + ' failures');
process.exitCode = failures ? 1 : 0;
