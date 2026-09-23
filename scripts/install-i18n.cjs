#!/usr/bin/env node
'use strict';
// Sources stay readable; the deployed game stays self-contained. Never edit the generated block.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const START = '/* KEPLER_LANGUAGE_BUNDLE_START */';
const END = '/* KEPLER_LANGUAGE_BUNDLE_END */';
const ANCHOR = '<script>\n(function(){\n  const LOCAL_PREFIX';
function buildBundle() {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n/en.json'), 'utf8'));
  const runtime = fs.readFileSync(path.join(ROOT, 'i18n/runtime.js'), 'utf8').trim();
  if (!Array.isArray(catalog.entries) || !catalog.entries.length) throw new Error('Empty language catalog');
  const seen = new Set();
  for (const pair of catalog.entries) {
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some(x => typeof x !== 'string' || !x.trim())) throw new Error('Invalid language entry');
    if (seen.has(pair[0])) throw new Error('Duplicate language source: ' + pair[0]);
    seen.add(pair[0]);
  }
  // No catalog value can terminate the enclosing HTML script, even in future translations.
  const json = JSON.stringify(catalog).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  if (/<\/script/i.test(runtime)) throw new Error('Runtime contains an HTML script terminator');
  const digest = crypto.createHash('sha256').update(json + '\n' + runtime).digest('hex');
  return START + '\n// Source SHA-256: ' + digest + '\n(function(){\nconst KEPLER_LANGUAGE_CATALOG = ' + json + ';\n' + runtime + '\n})();\n' + END + '\n';
}
function install(source) {
  const start = source.indexOf(START), end = source.indexOf(END);
  if ((start < 0) !== (end < 0)) throw new Error('Incomplete language bundle markers');
  let clean = source;
  if (start >= 0) {
    if (end <= start || source.indexOf(START, start + START.length) >= 0 || source.indexOf(END, end + END.length) >= 0) throw new Error('Ambiguous language bundle markers');
    clean = source.slice(0, start) + source.slice(end + END.length).replace(/^\n/, '');
  }
  if (clean.indexOf(ANCHOR) < 0 || clean.indexOf(ANCHOR) !== clean.lastIndexOf(ANCHOR)) throw new Error('Expected unique game bootstrap not found; refusing to modify file');
  return clean.replace(ANCHOR, () => '<script>\n' + buildBundle() + '(function(){\n  const LOCAL_PREFIX');
}
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some(x => x !== '--check')) throw new Error('Usage: node scripts/install-i18n.cjs [--check]');
  const file = path.join(ROOT, 'weltraum_kolonie.html');
  const source = fs.readFileSync(file, 'utf8');
  const result = install(source);
  if (args.includes('--check')) {
    if (result !== source) { console.error('Language bundle is stale: run node scripts/install-i18n.cjs'); process.exitCode = 1; }
    else console.log('Language bundle is up to date');
  } else if (source !== result) {
    const temporary = file + '.i18n.tmp';
    fs.writeFileSync(temporary, result); fs.renameSync(temporary, file);
    console.log('Installed self-contained German/English language bundle');
  } else console.log('Language bundle unchanged');
}
module.exports = { install, buildBundle, START, END };
