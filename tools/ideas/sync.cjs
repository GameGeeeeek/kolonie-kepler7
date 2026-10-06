'use strict';
// Development sources remain readable; the Pi receives the single game HTML as before.
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '../..'), file = path.join(root, 'weltraum_kolonie.html');
let html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
for (const [name, start, end, anchor] of [
  ['runtime.js', '/* K7_IDEAS_BEGIN */', '/* K7_IDEAS_END */', '  function render(){'],
  ['styles.css', '/* K7_IDEAS_CSS_BEGIN */', '/* K7_IDEAS_CSS_END */', '</style>']
]) {
  const content = start + '\n' + fs.readFileSync(path.join(__dirname, name), 'utf8').trimEnd() + '\n' + end + '\n';
  const begin = html.indexOf(start), finish = html.indexOf(end);
  if ((begin >= 0) !== (finish >= 0)) throw new Error('Incomplete source markers: ' + name);
  if (name === 'styles.css') {
    // Keep the tiny immediate-background block tiny. Also migrate an older embedding.
    if (begin >= 0) html = html.slice(0, begin) + html.slice(finish + end.length).replace(/^\r?\n/, '');
    const headEnd = html.indexOf('</head>');
    if (headEnd < 0) throw new Error('Expected document head');
    const blocks = [...html.slice(0, headEnd).matchAll(/^[ \t]*<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gm)];
    const main = blocks.reduce((largest, block) => !largest || block[1].length > largest[1].length ? block : largest, null);
    if (blocks.length < 2 || !main || main[1].length < 10000) throw new Error('Expected main stylesheet and immediate background');
    const insert = main.index + main[0].lastIndexOf('</style>');
    html = html.slice(0, insert) + content + html.slice(insert);
    continue;
  }
  if (begin >= 0 && finish >= begin) html = html.slice(0, begin) + content + html.slice(finish + end.length).replace(/^\r?\n/, '');
  else {
    if (html.split(anchor).length !== 2) throw new Error('Ambiguous insertion anchor: ' + anchor);
    html = html.replace(anchor, content + anchor);
  }
}
const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'locales/en.json'), 'utf8'));
Object.assign(catalogue, JSON.parse(fs.readFileSync(path.join(__dirname, 'en.json'), 'utf8')));
const translation = /const K7_TRANSLATIONS = [^\r\n]+;/g;
if ((html.match(translation) || []).length !== 1) throw new Error('Expected one translation catalogue');
html = html.replace(translation, () => 'const K7_TRANSLATIONS = ' + JSON.stringify(catalogue).replace(/</g, '\\u003c') + ';');
fs.writeFileSync(file, html);
fs.writeFileSync(path.join(root, 'locales/en.json'), JSON.stringify(catalogue, null, 2) + '\n');
console.log('Ideas runtime, styles and translation catalogue synchronized.');
