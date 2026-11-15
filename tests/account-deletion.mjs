import {seedTestAccounts} from './fixtures.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,readdir,stat} from 'node:fs/promises';
import http from 'node:http';
const data=await mkdtemp(process.cwd()+'/data/test-deletion-'),base='http://127.0.0.1:5186';let child;
await seedTestAccounts(data);
async function start(){let logs='';child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'5186',FP_DATA_DIR:data},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);for(let i=0;i<150;i++){await new Promise(r=>setTimeout(r,100));if(logs.includes('FabulousProgram ·'))return;if(child.exitCode!==null)throw Error(logs);}throw Error(logs);}
async function stop(){if(child?.exitCode===null)await new Promise(r=>{child.once('exit',r);child.kill();});}
async function api(path,token,body,method=body?'POST':'GET',expected=200){const r=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const p=await r.json();assert.equal(r.status,expected,JSON.stringify(p));return p;}
const login=(username,password)=>api('/api/auth/login',null,{username,password});
const deletion=password=>({password,confirmation:'DELETE_ALL_DATA'});
const read=()=>readFile(data+'/store.json','utf8').then(JSON.parse);
function absent(db,id){assert.ok(!db.users.some(u=>u.id===id));for(const k of ['sessions','progress','drafts','submissions','compilerDrafts'])assert.ok(!(db[k]||[]).some(x=>x.userId===id),k);}
function related(db,id){return Object.fromEntries(['users','sessions','progress','drafts','submissions','compilerDrafts'].map(k=>[k,(db[k]||[]).filter(x=>k==='users'?x.id===id:x.userId===id)]));}
try{
 await start();const admin=await login('admin','admin123');
 const member=await login('member','member123'),otherTab=await login('member','member123');
 await api('/api/auth/register',null,{username:'kept_user',displayName:'Keep',password:'keepPassword123'},'POST',201);
 const kept=await login('kept_user','keepPassword123');
 for(const u of [member,kept]){
   await api('/api/drafts/w1-02',u.token,{source:u.user.username+' private source',answers:{class:'class'}},'PUT');
   await api('/api/compiler/draft',u.token,{source:u.user.username+' compiler source',input:'private input'},'PUT');
   await api('/api/progress/w1-02',u.token,{});
   await api('/api/submit/fill',u.token,{lessonId:'w1-02',answers:{class:'class',main:'main',file:'Hello.java',return:'void'}});
 }
 await api('/api/auth/delete',member.token,{password:'member123'},'POST',400);
 await api('/api/auth/delete',member.token,deletion('wrong'),'POST',400);
 await api('/api/auth/deactivate',member.token,{password:'member123'},'POST',409);
 assert.ok((await read()).users.some(u=>u.id===member.user.id&&u.active));
 await api('/api/auth/delete',admin.token,deletion('admin123'),'POST',400);
 const simSource='import com.qualcomm.robotcore.eventloop.opmode.*; public class DeleteSim extends LinearOpMode {public void runOpMode(){waitForStart();while(opModeIsActive()){idle();}}}';
 const sim1=await api('/api/sim',member.token,{lessonId:'w1-03',source:simSource},'POST',201);
 const sim2=await api('/api/sim',otherTab.token,{lessonId:'w1-03',source:simSource},'POST',201);
 const simDirectories=[];for(const name of await readdir(data+'/beta-work')){const folder=data+'/beta-work/'+name;if(await readFile(folder+'/DeleteSim.java','utf8').catch(()=>null)===simSource)simDirectories.push(folder);}assert.equal(simDirectories.length,2);
 const preview=(await api('/api/materials/material-w/preview-access',member.token,{})).url;
 const before=await read();await writeFile(data+'/backup-test.json',JSON.stringify(before));
 // An authenticated request whose body finishes after deletion must not recreate data.
 let finishLate;const late=new Promise((resolve,reject)=>{const req=http.request(base+'/api/drafts/w1-02',{method:'PUT',headers:{Authorization:'Bearer '+otherTab.token,'Content-Type':'application/json'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.write('{"source":"late write",');finishLate=()=>req.end('"answers":{}}');});
 const delayed=api('/api/submit/code',otherTab.token,{lessonId:'w1-02',source:'public class Late {public static void main(String[] args) throws Exception {Thread.sleep(1200);System.out.println("late private output");}}'},'POST',401);
 await new Promise(r=>setTimeout(r,150));
 const result=await api('/api/auth/delete',member.token,deletion('member123'));assert.equal(result.deleted,true);
 finishLate();assert.equal(await late,401);await delayed;for(const folder of simDirectories)assert.equal(await stat(folder).catch(()=>null),null,'Simulation source and work directory must be removed');
 const after=await read(),backup=JSON.parse(await readFile(data+'/backup-test.json','utf8'));absent(after,member.user.id);absent(backup,member.user.id);assert.deepEqual(related(after,kept.user.id),related(before,kept.user.id));
 for(const token of [member.token,otherTab.token])await api('/api/bootstrap',token,undefined,'GET',401);
 assert.equal((await fetch(base+preview)).status,401);
 await api('/api/sim/'+sim1.id,kept.token,undefined,'GET',404);await api('/api/sim/'+sim2.id,kept.token,undefined,'GET',404);
 assert.ok(!(await api('/api/admin/users',admin.token)).users.some(u=>u.id===member.user.id));
 assert.ok(!(await api('/api/admin/activity',admin.token)).members.some(m=>m.user.id===member.user.id));
 assert.ok(!(await api('/api/rankings',kept.token)).rankings.some(m=>m.user.id===member.user.id));
 // Disabling remains reversible and retains personal data.
 await api('/api/admin/users/'+kept.user.id,admin.token,{active:false},'PATCH');
 await api('/api/bootstrap',kept.token,undefined,'GET',401);
 assert.ok((await read()).drafts.some(d=>d.userId===kept.user.id));
 await api('/api/admin/users/'+kept.user.id,admin.token,{active:true},'PATCH');
 const restored=await login('kept_user','keepPassword123');assert.equal((await api('/api/compiler/draft',restored.token)).draft.input,'private input');
 await api('/api/auth/register',null,{username:'member',displayName:'New member',password:'brandNewPassword'},'POST',201);
 const recreated=await login('member','brandNewPassword');assert.notEqual(recreated.user.id,member.user.id);assert.equal((await api('/api/submissions',recreated.token)).submissions.length,0);assert.equal((await api('/api/compiler/draft',recreated.token)).draft,null);
 await stop();await start();absent(await read(),member.user.id);await api('/api/bootstrap',member.token,undefined,'GET',401);
 const ownerDb=await read();await stop();ownerDb.users.find(u=>u.id===admin.user.id).owner=true;await writeFile(data+'/store.json',JSON.stringify(ownerDb));await start();
 await api('/api/auth/delete',admin.token,deletion('admin123'),'POST',400);
 console.log('PASS: permanent account/data and backup deletion, multi-session revocation, two simulators closed, late draft/judge rejection, no effect on others, reversible admin disable, clean re-registration, restart persistence, Owner/last-admin guards');
 console.log('Isolated test data: '+data);
}finally{await stop();}
