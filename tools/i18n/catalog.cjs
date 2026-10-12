'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const CATALOG_FILE = 'kepler-english.json';
function catalogueBytes(catalogue) {
  if (!catalogue || Array.isArray(catalogue) || typeof catalogue !== 'object') throw Error('Invalid English catalogue');
  for (const [key,value] of Object.entries(catalogue)) {
    if (!key || typeof value !== 'string' || !value.trim()) throw Error('Invalid English catalogue entry');
  }
  return Buffer.from(JSON.stringify(catalogue) + '\n');
}
function catalogueUrl(catalogue) {
  return CATALOG_FILE + '?v=' + crypto.createHash('sha256').update(catalogueBytes(catalogue)).digest('hex').slice(0,16);
}
function renderRuntime(catalogue, {external=false}={}) {
  const template = fs.readFileSync(path.join(__dirname,'runtime.js'),'utf8').replace(/\r\n/g,'\n').trimEnd();
  if (template.split('/* K7_CATALOG */{}').length !== 2) throw Error('Expected one English catalogue placeholder');
  const value = external ? 'K7_LANGUAGE === "en" ? await k7LoadEnglishCatalogue('+JSON.stringify(catalogueUrl(catalogue))+') : {}'
    : JSON.stringify(catalogue).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  return template.replace('/* K7_CATALOG */{}',value);
}
module.exports = {CATALOG_FILE,catalogueBytes,catalogueUrl,renderRuntime};
