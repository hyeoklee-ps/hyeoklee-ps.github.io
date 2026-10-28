const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const script = fs.readFileSync(`${__dirname}/regenerative.js`, 'utf8');
const calls = [];
const listeners = {};
const status = {textContent:'', classList:{add(){},remove(){},toggle(){}}};
const next = {disabled:false, textContent:'다음 2편 생성',addEventListener(name,fn){listeners.next=fn;}};
const nodes = {
  'panel-regen':{}, regenList:{replaceChildren(){}}, regenStatus:status, regenNextBtn:next,
};
const document = {
  getElementById(id){return nodes[id];},
  querySelector(selector){
    assert.equal(selector,'[data-tab="regen"]');
    return {addEventListener(name,fn){listeners.tab=fn;}};
  },
};
async function fetch(url, options){
  calls.push({url,method:options && options.method || 'GET'});
  return {ok:true,json:async()=>({episodes:[],active:null})};
}
vm.runInNewContext(script,{document,fetch,setTimeout,clearTimeout});
assert.equal(calls.length,0,'loading the page does not generate episodes');
listeners.tab();
setImmediate(()=>{
  assert.deepEqual(calls,[{url:'https://blog-diagram-api.dlgur007.workers.dev/api/regenerative',method:'GET'}]);
  assert.equal(status.textContent.includes('1편'),true);
  console.log('regenerative tab first-load regression passed');
});
