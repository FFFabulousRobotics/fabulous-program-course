import {esc,markdown} from '../public/html.js';
import {resultView,runResultView} from '../public/result-views.js';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=(await readFile(new URL('../public/fabulous.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/loadRoute\(\);\s*$/,'');
const user={id:'u',username:'member',displayName:'测试成员',role:'member'};
const bootstrap={user,weeks:[],lessons:[],stats:{}};
const lesson={lesson:{id:'l',weekId:'w',title:'教程',fillQuestions:[],codeTask:null},progress:{read:false},draft:{source:'server',answers:{}}};
function setup(){
 const app={innerHTML:''},events={},calls=[],nodes=new Map([['#app',app],['#toast-region',{append(){},replaceChildren(){}}]]);
 const profileButton={type:'button',form:null,dataset:{action:'profile'},setAttribute(name,value){this[name]=value;}};
 nodes.set('[data-action="profile"]',profileButton);
 nodes.set('.topbar',{insertAdjacentHTML(position,html){nodes.set('#profile-panel',{html,remove(){nodes.delete('#profile-panel');}});}});
 const context=vm.createContext({esc,markdown,resultView,runResultView,AbortController,console,setTimeout,clearTimeout,
  sessionStorage:{getItem:()=>'',setItem(){},removeItem(){}},location:{hash:'#/lesson/l'},
  document:{querySelector:s=>nodes.get(s)||null,addEventListener:(event,fn)=>(events[event]||=[]).push(fn),createElement:()=>({remove(){}})},
  window:{addEventListener:(event,fn)=>(events['window:'+event]||=[]).push(fn),scrollTo(){}},
  disposeSections(){},assessmentClick:()=>false,assessmentChange(){},publicationChange(){},
  dashboardView:()=>'<div>课程首页</div>',problemsView:()=>'<div>课后练习</div>',
  fetch:async(path,options)=>{calls.push({path,options});return {ok:true,status:200,json:async()=>path==='/api/bootstrap'?bootstrap:path.startsWith('/api/lessons/')?lesson:{}};}
 });
 vm.runInContext(source,context);
 vm.runInContext('S={...fresh(),token:"a",user:'+JSON.stringify(user)+'};renderLesson=()=>{app.innerHTML="lesson "+S.source;};renderRecords=()=>{app.innerHTML="records";};',context);
 return {context,app,nodes,calls,profileButton,run:code=>vm.runInContext(code,context),dispatch:(name,event)=>Promise.all((events[name]||[]).map(fn=>fn(event)))};
}
const profile=setup();
const event={target:{closest:selector=>selector==='button'||selector==='[data-action="profile"]'?profile.profileButton:null}};
await profile.dispatch('click',event);assert.equal(profile.calls.length,0);assert.equal(profile.run('S.profileOpen'),true);assert.ok(profile.nodes.has('#profile-panel'));
assert.ok(profile.run('shell("重新渲染")').includes('id="profile-panel"'),'Loading completion must retain an already-open profile panel');
assert.ok(profile.run('shell("")').includes('type="button" class="user-menu"'));
await profile.dispatch('click',event);assert.equal(profile.run('S.profileOpen'),false);assert.ok(!profile.nodes.has('#profile-panel'));
await profile.dispatch('click',event);await profile.dispatch('keydown',{key:'Escape',target:{id:''}});assert.equal(profile.run('S.profileOpen'),false);

const parallel=setup(),release=new Map();
parallel.context.fetch=(path,options)=>{parallel.calls.push({path,options});return new Promise(resolve=>release.set(path,()=>resolve({ok:true,status:200,json:async()=>path==='/api/bootstrap'?bootstrap:lesson})));};
const navigation=parallel.run('loadRoute()');
assert.deepEqual(parallel.calls.map(c=>c.path).sort(),['/api/bootstrap','/api/lessons/l']);
release.get('/api/bootstrap')();release.get('/api/lessons/l')();await navigation;assert.equal(parallel.app.innerHTML,'lesson server');
await parallel.run('loadRoute()');assert.equal(parallel.calls.length,2,'Revisiting a route within TTL must reuse both responses');
await parallel.run('saveDraft()');assert.equal(parallel.calls.length,2,'Unedited drafts must not send PUT requests');

const switching=setup();await switching.run('loadRoute()');let releaseSave;
switching.context.fetch=(path,options)=>{switching.calls.push({path,options});if(options.method==='PUT')return new Promise(resolve=>releaseSave=()=>resolve({ok:true,status:200,json:async()=>({})}));return Promise.resolve({ok:true,status:200,json:async()=>({})});};
switching.run('S.source="unsaved local edit";S.page="lesson";draftRevision++;S.draftStatus="保存中…";location.hash="#/records";');
await switching.dispatch('window:hashchange',{});await new Promise(r=>setImmediate(r));
assert.equal(switching.app.innerHTML,'records','Navigation must not wait for a slow draft PUT');
switching.context.location.hash='#/lesson/l';await switching.run('loadRoute()');
assert.equal(switching.run('S.source'),'unsaved local edit','Returning before autosave finishes must not restore stale server text');
releaseSave();await switching.run('saveChain');

const cache=setup();await cache.run('routeData("/api/bootstrap")');await cache.run('routeData("/api/bootstrap")');assert.equal(cache.calls.length,1);
await cache.run('post("/api/progress/l",{})');await cache.run('routeData("/api/bootstrap")');assert.equal(cache.calls.length,3,'Writes invalidate cached progress');
cache.run('S.token="b";');await cache.run('routeData("/api/bootstrap")');assert.equal(cache.calls.at(-1).options.headers.Authorization,'Bearer b');assert.equal(cache.calls.length,4);
cache.run('resetSession()');assert.equal(cache.run('routeCache.size'),0);assert.equal(cache.run('localDrafts.size'),0);

const failed=setup();failed.run('S.user=null;request=async()=>{throw Error("加载超时，请重试");};');await failed.run('loadRoute()');
assert.ok(failed.app.innerHTML.includes('重新加载'));assert.ok(failed.app.innerHTML.includes('加载超时'));
console.log('PASS: profile works locally and survives redraw, parallel route fetches, short session cache, clean-draft skipping, nonblocking navigation with safe local drafts, write invalidation, account isolation and retry UI');
