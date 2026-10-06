'use strict';
// Language may change number formatting, but never values, signs, variables or markup structure.
const protectedToken=/\{\d+\}|https?:\/\/[^\s<>]+|[+−±-]?\d[\d.,]*(?:%|×)?/g;
function canonical(token,english=false){
  if(token.startsWith('{')||/^https?:/.test(token))return token;
  const sign=token.startsWith('±')?'±':token.startsWith('-')||token.startsWith('−')?'-':'';
  const unit=token.endsWith('%')?'%':token.endsWith('×')?'×':'';
  let value=token.replace(/^[+−±-]/,'').replace(/[%×]$/,'').replace(/[.,]+$/,'');
  value=english?value.replace(/,/g,''):value.replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.');
  const number=Number(value);
  return Number.isFinite(number)?sign+number+unit:token;
}
function counts(items){const map=new Map();for(const item of items)map.set(item,(map.get(item)||0)+1);return [...map].sort(([a],[b])=>a.localeCompare(b));}
function validate(source,target){
  if(typeof target!=='string'||!target.trim())return ['empty translation'];
  const from=[...source.matchAll(protectedToken)].map(m=>m[0]);
  const known=new Set(from),to=[...target.matchAll(protectedToken)].map(m=>m[0]);
  const errors=[];
  const a=counts(from.map(t=>canonical(t))),b=counts(to.map(t=>canonical(t,!known.has(t))));
  if(JSON.stringify(a)!==JSON.stringify(b))errors.push('numbers, signs, URLs or variables differ');
  const tags=text=>[...text.matchAll(/<\/?([a-z][\w:-]*)\b[^>]*>/gi)].map(m=>m[0].replace(/\s+/g,' ').trim());
  if(JSON.stringify(tags(source))!==JSON.stringify(tags(target)))errors.push('markup structure differs');
  if(/K\s*K\s*E\s*E\s*P\s*\d+\s*X/i.test(target))errors.push('draft marker remains');
  return errors;
}
module.exports={validate,canonical,protectedToken};
