#!/usr/bin/env node
'use strict';
// Development-only compiler. acorn/acorn-walk are NOT shipped or loaded by the game.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const acorn = require('acorn');
const walk = require('acorn-walk');
const ROOT = path.resolve(__dirname, '../..');
const FILE = path.join(ROOT, 'weltraum_kolonie.html');
const DISPLAY_FIELDS = new Set(['name', 'label', 'title', 'desc', 'effectDesc', 'nicheDesc', 'text', 'hint', 'body']);
const HTML_ATTRIBUTES = new Set(['title', 'placeholder', 'aria-label', 'alt']);
const DISPLAY_ASSIGNMENTS = new Set(['innerHTML', 'outerHTML', 'textContent', 'innerText', 'title', 'placeholder']);
const MESSAGE_CALLS = new Set(['log', 'pushToast', 'confirm', 'alert', 'prompt']);
const DEFINITIONS = new Set(['RES_DEFS','BUILDING_DEFS','RESEARCH_DEFS','SHIP_DEFS','TIER2_DEFS','MODULE_DEFS','SHIP_MODULE_DEFS','ITEM_DEFS','DOCTRINE_DEFS','PRESTIGE_PERKS','RESEARCH_MILESTONES','LEVEL_REWARDS','DAILY_QUEST_DEFS','ACHIEVEMENTS','HELP_SECTIONS','TUTORIAL_STEPS','ALLIANCE_TECH_DEFS','ALLIANCE_BUILDING_DEFS','OFFICER_DEFS','SKILL_TREE','COMPENDIUM_CATS','MODULE_SET_DEFS','SHIP_MODULE_SET_DEFS','CREDIT_SHOP','BONUS_GROUPS']);
const BEGIN = '/* K7_ENGLISH_RUNTIME_BEGIN */';
const END = '/* K7_ENGLISH_RUNTIME_END */';
const q = JSON.stringify;
function decode(text) {
  const named = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0',middot:'·',ndash:'–',mdash:'—',hellip:'…',times:'×',auml:'ä',ouml:'ö',uuml:'ü',Auml:'Ä',Ouml:'Ö',Uuml:'Ü',szlig:'ß'};
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (full, key) => {
    if (key[0] === '#') { const n = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : +key.slice(1); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : full; }
    return named[key] === undefined ? full : named[key];
  });
}
// Quote-aware HTML scanner. It never rewrites selectors, styles, event handlers, URLs or IDs.
function htmlSegments(text) {
  const parts = []; let pos = 0, rawTag = null;
  while (pos < text.length) {
    if (rawTag) {
      const end = text.toLowerCase().indexOf('</' + rawTag, pos);
      if (end < 0) break;
      pos = end; rawTag = null;
    }
    if (text.startsWith('<!--', pos)) { const end = text.indexOf('-->', pos + 4); pos = end < 0 ? text.length : end + 3; continue; }
    if (text[pos] === '<' && /^<\/?[A-Za-z!]/.test(text.slice(pos, pos + 3))) {
      const start = pos; let quote = null; pos++;
      for (; pos < text.length; pos++) {
        const c = text[pos];
        if (quote) { if (c === quote) quote = null; }
        else if (c === '"' || c === "'") quote = c;
        else if (c === '>') { pos++; break; }
      }
      const tag = text.slice(start, pos);
      const name = (tag.match(/^<([A-Za-z][\w:-]*)/) || [])[1];
      const attr = /([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g; let m;
      while ((m = attr.exec(tag))) {
        if (!HTML_ATTRIBUTES.has(m[1].toLowerCase())) continue;
        const valueStart = start + m.index + m[0].indexOf(m[2]) + 1;
        parts.push({start:valueStart, end:valueStart + m[3].length, attr:true});
      }
      if (name && /^(script|style|textarea)$/i.test(name)) rawTag = name.toLowerCase();
    } else {
      const start = pos; pos++;
      while (pos < text.length && !(text[pos] === '<' && /^<\/?[A-Za-z!]/.test(text.slice(pos, pos + 3)))) pos++;
      parts.push({start, end:pos, attr:false});
    }
  }
  return parts;
}
function translatedPieces(text, segments, catalog, used) {
  const edits = [];
  for (const segment of segments) {
    const source = text.slice(segment.start, segment.end);
    const trimmed = source.trim();
    const key = decode(trimmed);
    if (!key || !Object.prototype.hasOwnProperty.call(catalog, key)) continue;
    const start = segment.start + source.indexOf(trimmed);
    edits.push({start, end:start + trimmed.length, key});
    used.add(key);
  }
  return edits;
}
function valueExpression(text, changes) {
  if (!changes.length) return null;
  const parts = []; let last = 0;
  for (const change of changes) {
    if (change.start > last) parts.push(q(text.slice(last, change.start)));
    parts.push('k7h(' + q(change.key) + ')'); last = change.end;
  }
  if (last < text.length) parts.push(q(text.slice(last)));
  return '(' + parts.join(' + ') + ')';
}
function propertyName(node) { return node && node.type === 'MemberExpression' && !node.computed ? node.property.name : null; }
function inside(child, parent) { return child.start >= parent.start && child.end <= parent.end; }
function directDisplay(node, ancestors, templatePositions) {
  for (let i = ancestors.length - 2; i >= 0; i--) {
    const parent = ancestors[i];
    if (parent.type === 'Property' && (parent.key.name || parent.key.value) === 'PATCHNOTES') return false;
    if (parent.type === 'BinaryExpression' && !['+'].includes(parent.operator)) return false;
    if (parent.type === 'CallExpression') {
      if (parent.callee.type === 'Identifier' && MESSAGE_CALLS.has(parent.callee.name) && parent.arguments[0] && inside(node, parent.arguments[0])) return true;
      if (propertyName(parent.callee) === 'setAttribute' && parent.arguments[0]?.type === 'Literal' && HTML_ATTRIBUTES.has(parent.arguments[0].value) && parent.arguments[1] && inside(node, parent.arguments[1])) return true;
    }
    if (parent.type === 'AssignmentExpression' && DISPLAY_ASSIGNMENTS.has(propertyName(parent.left)) && inside(node, parent.right)) return true;
    if (parent.type === 'TemplateLiteral') {
      const entry = templatePositions.get(parent);
      if (!entry) return false;
      return entry.visibleExpressions.some(expression => inside(node, expression));
    }
    if (parent.type === 'Statement' || parent.type === 'VariableDeclarator' || parent.type === 'ReturnStatement') return false;
  }
  return false;
}
function compile(original, catalog) {
  if (original.includes(BEGIN)) throw new Error('Already localized. Restore the unchanged base before rebuilding; never stack transforms.');
  const start = original.indexOf('<script>') + '<script>'.length;
  const end = original.lastIndexOf('</script>');
  if (start < '<script>'.length || end <= start) throw new Error('Expected the single game script.');
  const code = original.slice(start, end);
  const ast = acorn.parse(code, {ecmaVersion:'latest'});
  const edits = [], used = new Set(), candidates = new Set(), templatePositions = new Map();
  let patchnotes = null;
  const taggedTemplates = new Set();
  walk.simple(ast, {TaggedTemplateExpression(node) { taggedTemplates.add(node.quasi); }});
  walk.simple(ast, {VariableDeclarator(node) { if (node.id.name === 'PATCHNOTES') patchnotes = node; }});
  const history = node => patchnotes && inside(node, patchnotes);
  const add = (s, e, replacement) => edits.push({start:s + start, end:e + start, replacement});
  walk.simple(ast, {
    TemplateLiteral(node) {
      if (history(node) || taggedTemplates.has(node)) return;
      let combined = '', position = 0; const ranges = [], expressions = [];
      node.quasis.forEach((part, i) => {
        const value = part.value.cooked;
        if (value === null) return;
        ranges.push({node:part, start:position, value}); combined += value; position += value.length;
        if (node.expressions[i]) { const marker = 'K7EXPR' + i + 'END'; expressions.push({node:node.expressions[i], start:position, end:position + marker.length}); combined += marker; position += marker.length; }
      });
      if (!/<\/?[a-z][\s>]/i.test(combined) && !/<[a-z][\w:-]*\b/i.test(combined)) return;
      const segments = htmlSegments(combined);
      const visibleExpressions = expressions.filter(x => segments.some(s => x.start >= s.start && x.end <= s.end)).map(x => x.node);
      templatePositions.set(node, {visibleExpressions});
      for (const range of ranges) {
        const local = segments.map(s => ({start:Math.max(0, s.start - range.start), end:Math.min(range.value.length, s.end - range.start), attr:s.attr})).filter(s => s.start < s.end);
        for (const s of local) { const key = decode(range.value.slice(s.start, s.end).trim()); if (key) candidates.add(key); }
        const changes = translatedPieces(range.value, local, catalog, used);
        if (!changes.length) continue;
        // Re-escape the cooked template chunk; the original JS interpolations remain unchanged.
        const escape = value => value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
        let result = '', last = 0;
        for (const change of changes) { result += escape(range.value.slice(last, change.start)) + '${k7h(' + q(change.key) + ')}'; last = change.end; }
        result += escape(range.value.slice(last));
        add(range.node.start, range.node.end, result);
      }
    }
  });
  walk.fullAncestor(ast, (node, _, ancestors) => {
    if (history(node) || ancestors.some(parent => parent.type === 'TaggedTemplateExpression')) return;
    const parent = ancestors[ancestors.length - 2];
    if (node.type === 'VariableDeclaration' && (parent?.type === 'BlockStatement' || parent?.type === 'Program')) {
      const names = node.declarations.filter(d => DEFINITIONS.has(d.id.name)).map(d => d.id.name);
      if (names.length) add(node.end, node.end, '\n  ' + names.map(name => 'k7RegisterDefinitions(' + name + ');').join('\n  '));
    }
    if (node.type === 'MemberExpression' && DISPLAY_FIELDS.has(propertyName(node)) && directDisplay(node, ancestors, templatePositions)) {
      if (parent?.type === 'AssignmentExpression' && parent.left === node || parent?.type === 'UpdateExpression' || parent?.type === 'UnaryExpression' && parent.operator === 'delete') return;
      // Leaves the original definition object and all saved/user-owned objects untouched.
      add(node.start, node.end, 'k7View(' + code.slice(node.object.start, node.object.end) + ')' + (node.optional ? '?.' : '.') + propertyName(node));
    }
    if (node.type !== 'Literal' || typeof node.value !== 'string') return;
    if (parent?.type === 'Property' && parent.key === node || parent?.type === 'MemberExpression') return;
    const raw = node.value;
    if (raw === 'de-DE' && parent?.type === 'CallExpression' && /^(toLocaleString|toLocaleDateString|toLocaleTimeString)$/.test(propertyName(parent.callee) || '')) {
      add(node.start, node.end, '(K7_LANGUAGE === "en" ? "en-GB" : "de-DE")'); return;
    }
    if (/<\/?[a-z][\w:-]*\b/i.test(raw)) {
      const segments = htmlSegments(raw);
      for (const segment of segments) { const key = decode(raw.slice(segment.start, segment.end).trim()); if (key) candidates.add(key); }
      const changes = translatedPieces(raw, segments, catalog, used);
      const expression = valueExpression(raw, changes);
      if (expression) add(node.start, node.end, expression);
    } else if (directDisplay(node, ancestors, templatePositions)) {
      const key = raw.trim(); if (key) candidates.add(key);
      if (Object.prototype.hasOwnProperty.call(catalog, raw)) { used.add(raw); add(node.start, node.end, 'k7t(' + q(raw) + ')'); }
      else if (key && Object.prototype.hasOwnProperty.call(catalog, key)) {
        used.add(key); const at = raw.indexOf(key);
        add(node.start, node.end, '(' + q(raw.slice(0, at)) + ' + k7t(' + q(key) + ') + ' + q(raw.slice(at + key.length)) + ')');
      }
    }
  });
  edits.sort((a,b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < edits.length; i++) if (edits[i].start < edits[i-1].end) throw new Error('Overlapping translation edits at ' + edits[i].start);
  let output = original;
  for (const edit of edits.slice().reverse()) output = output.slice(0, edit.start) + edit.replacement + output.slice(edit.end);
  const runtime = fs.readFileSync(path.join(__dirname, 'runtime.js'), 'utf8').replace('/* K7_CATALOG */{}', q(catalog).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'));
  const anchor = '(function(){';
  const at = output.indexOf(anchor, start);
  if (at < start) throw new Error('Missing main IIFE.');
  output = output.slice(0, at + anchor.length) + '\n  ' + BEGIN + '\n' + runtime + '\n  ' + END + '\n' + output.slice(at + anchor.length);
  const finalStart = output.indexOf('<script>') + 8;
  new Function(output.slice(finalStart, output.lastIndexOf('</script>')));
  return {output, report:{edits:edits.length, catalogEntries:Object.keys(catalog).length, matchedLiteralKeys:used.size, candidates:[...candidates].sort()}};
}
function main() {
  const source = fs.readFileSync(FILE, 'utf8');
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales/en.json'), 'utf8'));
  for (const [key,value] of Object.entries(catalog)) if (!key || typeof value !== 'string' || !value.trim()) throw new Error('Invalid translation: ' + key);
  const built = compile(source, catalog);
  const report = {...built.report, baseSha256:crypto.createHash('sha256').update(source).digest('hex'), outputSha256:crypto.createHash('sha256').update(built.output).digest('hex')};
  const reportPath = process.env.K7_I18N_REPORT || path.join(require('node:os').tmpdir(), 'kepler-i18n-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  if (!process.argv.includes('--check')) fs.writeFileSync(FILE, built.output);
  console.log(JSON.stringify({edits:report.edits,catalogEntries:report.catalogEntries,matchedLiteralKeys:report.matchedLiteralKeys,report:reportPath}));
}
if (require.main === module) main();
module.exports = {compile, htmlSegments, translatedPieces, decode};
