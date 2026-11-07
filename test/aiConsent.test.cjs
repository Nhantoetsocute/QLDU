const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const babel=require('@babel/core');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function consentModule(storage) {
  let reset;
  const module={exports:{}};
  const source=babel.transformSync(fs.readFileSync(require('node:path').join(__dirname,'../src/services/aiConsent.js'),'utf8'),{
    configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs'],
  }).code;
  vm.runInNewContext(source,{module,exports:module.exports,require(name){
    if(name==='@react-native-async-storage/async-storage') return storage;
    if(name==='./privacyStorage') return {subscribePrivacyReset(listener){reset=listener;return ()=>{};}};
    throw new Error('Unexpected dependency');
  },Set,Promise});
  return {service:module.exports,reset:()=>reset()};
}
test('AI stays off by default and old notice versions require renewed consent',async()=>{
  const f=consentModule({getItem:async()=> 'old-version'});
  assert.equal(f.service.currentAiConsent(),false);
  assert.equal(await f.service.readAiConsent(),false);
});
test('revoking AI during an outstanding grant updates mounted screens immediately and persists the denial last',async()=>{
  const started=deferred(),finish=deferred();let saved;
  const f=consentModule({setItem:async(key,value)=>{started.resolve();await finish.promise;saved=value;},removeItem:async()=>{saved=null;}});
  const values=[];f.service.subscribeAiConsent(value=>values.push(value));
  const grant=f.service.setAiConsent(true);await started.promise;
  const revoke=f.service.setAiConsent(false);
  assert.equal(f.service.currentAiConsent(),false);
  assert.deepEqual(values,[true,false]);
  finish.resolve();await Promise.all([grant,revoke]);assert.equal(saved,null);
});
test('logout waits for a consent write before cache deletion so consent cannot reappear after logout',async()=>{
  const started=deferred(),finish=deferred();let saved;
  const storage={setItem:async(key,value)=>{started.resolve();await finish.promise;saved=value;},removeItem:async()=>{saved=null;}};
  const f=consentModule(storage);
  const grant=f.service.setAiConsent(true);await started.promise;
  const cleanup=f.reset().then(()=>storage.removeItem());
  assert.equal(f.service.currentAiConsent(),false);
  finish.resolve();await Promise.all([grant,cleanup]);assert.equal(saved,null);
});
test('a stale storage read cannot reenable AI after revocation',async()=>{
  const started=deferred(),read=deferred();
  const f=consentModule({getItem:async()=>{started.resolve();return read.promise;},removeItem:async()=>{}});
  const loading=f.service.readAiConsent();await started.promise;
  await f.service.setAiConsent(false);
  read.resolve(f.service.AI_CONSENT_VERSION);
  assert.equal(await loading,false);assert.equal(f.service.currentAiConsent(),false);
});
