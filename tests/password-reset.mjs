import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scryptSync,randomBytes} from 'node:crypto';
import {usersView} from '../public/course-views.js';
const data=await mkdtemp(join(tmpdir(),'fp-password-reset-'));
let base;
const password='TestOriginal123',replacement='TestReplacement456';
const users=[['owner','admin',true],['admin','admin',false],['otheradmin','admin',false],['member','member',false]].map(([username,role,owner])=>{const salt=randomBytes(16).toString('hex');return {id:username,username,displayName:username,role,owner,active:true,passwordHash:salt+':'+scryptSync(password,salt,64).toString('hex')};});
await writeFile(join(data,'store.json'),JSON.stringify({users,lessons:[],progress:[],submissions:[]}));
let child;
async function start(){
 let logs='';
 const launch="import {server} from './src/server.mjs'; if(!server.listening)await new Promise(r=>server.once('listening',r)); console.log('PASSWORD_TEST_PORT='+server.address().port);";
 child=spawn(process.execPath,['--input-type=module','-e',launch],{env:{...process.env,PORT:'0',FP_DATA_DIR:data},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 for(let i=0;i<100;i++){const match=logs.match(/PASSWORD_TEST_PORT=(\d+)/);if(match){base='http://127.0.0.1:'+match[1];return;}if(child.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,100));}
 throw Error(logs);
}
async function stop(){if(child?.exitCode===null)await new Promise(r=>{child.once('exit',r);child.kill();});}
async function api(path,token,body,method=body?'POST':'GET',expected=200){const r=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const p=await r.json();assert.equal(r.status,expected,JSON.stringify(p));return p;}
const login=async(username,p=password)=>(await api('/api/auth/login',null,{username,password:p})).token;
const stored=async()=>JSON.parse(await readFile(join(data,'store.json'),'utf8'));
try{
 const adminHtml=usersView(users,users[1]),ownerHtml=usersView(users,users[0]);
 for(const [html,enabled] of [[adminHtml,['member']],[ownerHtml,['admin','otheradmin','member']]])for(const user of users){const tag=html.match(new RegExp('<button[^>]*data-user-reset="'+user.id+'"[^>]*>'))?.[0];assert.ok(tag);assert.equal(!tag.includes('disabled'),enabled.includes(user.id));}
 assert.ok(adminHtml.includes('autocomplete="new-password"'));
 await start();const owner=await login('owner'),admin=await login('admin'),otheradmin=await login('otheradmin'),member=await login('member'),member2=await login('member');
 await api('/api/drafts/w1-02',member,{source:'preserved draft',answers:{main:'main'}},'PUT');
 await api('/api/submit/fill',member,{lessonId:'w1-02',answers:{class:'class',main:'main',file:'Hello.java',return:'void'}});
 const before=await stored();
 await api('/api/admin/users/member',null,{password:replacement},'PATCH',401);
 await api('/api/admin/users/member',member,{password:replacement},'PATCH',403);
 await api('/api/admin/users/otheradmin',admin,{password:replacement},'PATCH',403);
 await api('/api/admin/users/owner',owner,{password:replacement},'PATCH',403);
 await api('/api/admin/users/member',admin,{password:'short'},'PATCH',400);
 await api('/api/admin/users/member',admin,{password:'x'.repeat(201)},'PATCH',400);
 assert.equal((await stored()).users.find(u=>u.id==='member').passwordHash,before.users.find(u=>u.id==='member').passwordHash);
 const reset=await api('/api/admin/users/member',admin,{password:replacement},'PATCH');assert.equal(reset.user.passwordHash,undefined);
 const after=await stored();
 for(const key of Object.keys(before).filter(k=>!['users','sessions'].includes(k)))assert.deepEqual(after[key],before[key],key+' must be preserved');
 assert.deepEqual(after.users.filter(u=>u.id!=='member'),before.users.filter(u=>u.id!=='member'));
 assert.deepEqual(after.sessions,before.sessions.filter(s=>s.userId!=='member'));
 await api('/api/bootstrap',member,undefined,'GET',401);await api('/api/bootstrap',member2,undefined,'GET',401);
 await api('/api/auth/login',null,{username:'member',password},'POST',401);await login('member',replacement);
 await api('/api/admin/users/otheradmin',owner,{password:replacement},'PATCH');await api('/api/bootstrap',otheradmin,undefined,'GET',401);await login('otheradmin',replacement);
 await stop();await start();await login('member',replacement);await api('/api/bootstrap',admin);
 console.log('PASS: reset UI permissions, member/admin/Owner API permissions, password limits, old password rejected, new password and restart login, all target sessions revoked, other accounts and learning data preserved');
}finally{await stop();await rm(data,{recursive:true,force:true});}
