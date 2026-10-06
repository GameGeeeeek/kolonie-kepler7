'use strict';
// Only source guards before browser creation run here. This is not a browser-test result.
// The unchanged complete tests must also pass in tests/run.js or pruflauf.js.
const Module=require('node:module'),load=Module._load,write=process.stdout.write;
let failed=false;
process.stdout.write=function(chunk,...args){if(/(?:^|\n)FAIL(?:\s|$)/.test(String(chunk)))failed=true;return write.call(this,chunk,...args);};
function stop(){console.log('SOURCE PREFLIGHT STOP before browser');process.exit(failed?1:0);}
Module._load=function(request,parent,isMain){
  const result=load.call(this,request,parent,isMain);
  if(/(?:^|[/\\])umgebung$/.test(request)&&result&&typeof result.starteBrowser==='function')return {...result,starteBrowser:async()=>stop()};
  if(/playwright|puppeteer/.test(request)&&result){
    if(result.chromium)result.chromium.launch=async()=>stop();
    if(typeof result.launch==='function')result.launch=async()=>stop();
  }
  return result;
};
