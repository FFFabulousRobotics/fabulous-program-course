import {esc,markdown} from '../public/html.js';
import {resultView,runResultView} from '../public/result-views.js';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../public/fabulous.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/loadRoute\(\);\s*$/,'');
function setup(){
 const events={},calls=[],messages=[],note={textContent:''},fields={disabled:false},button={textContent:'确认重置',disabled:false};
 const values={userId:'member',password:'Replacement123',confirmPassword:'Replacement123'};
 const dialog={closed:false,close(){this.closed=true;}};
 const form={matches:s=>s==='form',getAttribute:()=> 'user-password-form',closest:()=>dialog,querySelector:s=>s==='fieldset'?fields:note,elements:{confirmPassword:{focus(){}}},reset(){values.password='';values.confirmPassword='';}};
 const context=vm.createContext({esc,markdown,resultView,runResultView,AbortController,console,setTimeout:()=>0,clearTimeout,
  FormData:class{constructor(){return Object.entries(values);}},
  sessionStorage:{getItem:()=>'',setItem(){},removeItem(){}},location:{hash:'#/users'},
  document:{querySelector:s=>s==='#app'?{innerHTML:''}:{append:el=>messages.push(el.textContent),replaceChildren(){}},addEventListener:(type,fn)=>(events[type]||=[]).push(fn),createElement:()=>({remove(){}})},
  window:{addEventListener(){},scrollTo(){}},disposeSections(){},
  fetch:async(path,options)=>{calls.push({path,options});return {ok:true,status:200,json:async()=>({})};}
 });
 vm.runInContext(source,context);vm.runInContext('S={...fresh(),token:"admin-token",user:{id:"admin",role:"admin"}};',context);
 return {calls,messages,note,fields,button,values,dialog,context,run:code=>vm.runInContext(code,context),submit:()=>Promise.all(events.submit.map(fn=>fn({target:form,submitter:button,preventDefault(){}})))};
}
const mismatch=setup();mismatch.values.confirmPassword='Different123';await mismatch.submit();assert.equal(mismatch.calls.length,0);assert.match(mismatch.note.textContent,/不一致/);assert.equal(mismatch.dialog.closed,false);assert.equal(mismatch.button.disabled,false);
const short=setup();short.values.password=short.values.confirmPassword='123';await short.submit();assert.equal(short.calls.length,0);assert.match(short.note.textContent,/6–200/);
const success=setup();await success.submit();assert.equal(success.calls.length,1);assert.equal(success.calls[0].path,'/api/admin/users/member');assert.equal(success.calls[0].options.method,'PATCH');assert.deepEqual(JSON.parse(success.calls[0].options.body),{password:'Replacement123'});assert.equal(success.dialog.closed,true);assert.equal(success.values.password,'');assert.equal(success.fields.disabled,false);assert.match(success.messages[0],/密码已重置/);
const failed=setup();failed.context.fetch=async()=>({ok:false,status:403,json:async()=>({error:'仅 Owner 可以管理其他管理员账号'})});await failed.submit();assert.equal(failed.dialog.closed,false);assert.match(failed.note.textContent,/Owner/);assert.equal(failed.fields.disabled,false);assert.equal(failed.button.disabled,false);
const pending=setup();let resolve;
pending.context.fetch=async(path,options)=>{pending.calls.push({path,options});return new Promise(r=>resolve=()=>r({ok:true,status:200,json:async()=>({})}));};
const first=pending.submit();assert.equal(pending.fields.disabled,true);await pending.submit();assert.equal(pending.calls.length,1);resolve();await first;assert.equal(pending.dialog.closed,true);
const stale=setup();let finish;stale.context.fetch=async()=>new Promise(r=>finish=()=>r({ok:true,status:200,json:async()=>({})}));const inflight=stale.submit();stale.run('S.token="different-session";ticket++;');finish();await inflight;assert.equal(stale.dialog.closed,false);assert.equal(stale.messages.length,0);assert.equal(stale.fields.disabled,false);
console.log('PASS: mismatch/length validation, reset request payload, success clears password, server errors recover, pending submits deduplicated, stale responses isolated');
