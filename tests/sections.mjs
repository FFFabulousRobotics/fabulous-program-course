import {seedTestAccounts} from './fixtures.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {migrateW2Material} from '../src/materials.mjs';
const migration={imports:{w2:{}},weeks:[{id:'week-2',published:false}],materials:[]};
assert.equal(migrateW2Material(migration),false);
migration.weeks[0].published=true;
assert.equal(migrateW2Material(migration),true);
assert.equal(migration.materials[0].fileKey,'course/W2/W2.docx');
assert.equal(migrateW2Material(migration),false);
migration.materials=[];
assert.equal(migrateW2Material(migration),false,'An administrator deletion must survive restart');
const edited={imports:{w2:{}},weeks:[{id:'week-2',published:true}],materials:[{id:'custom-w2',code:'W2',title:'Edited W2',published:false}]};
assert.equal(migrateW2Material(edited),true);
assert.equal(edited.materials.length,1);assert.equal(edited.materials[0].published,false);
const root=resolve(import.meta.dirname,'..'),data=await mkdtemp(join(root,'data/test-sections-'));
await seedTestAccounts(data);
const base='http://127.0.0.1:5181';let child;
async function start(){let logs='';child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:'5181',FP_DATA_DIR:data},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);for(let i=0;i<150;i++){await new Promise(r=>setTimeout(r,100));if(child.exitCode!==null)throw Error(logs);if(logs.includes('FabulousProgram ·'))return;}throw Error('Server startup timed out: '+logs);}
async function stop(){if(child&&child.exitCode===null)await new Promise(r=>{child.once('exit',r);child.kill();});}
async function api(path,token,body,method=body?'POST':'GET',expected=200){const response=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return result;}
async function file(id,token,status){const response=await fetch(base+'/api/materials/'+id+'/file',{headers:token?{Authorization:'Bearer '+token}:{}});assert.equal(response.status,status);return response;}
try{
 await start();
 const admin=(await api('/api/auth/login',null,{username:'admin',password:'admin123'})).token;
 const member=(await api('/api/auth/login',null,{username:'member',password:'member123'})).token;
 await api('/api/auth/register',null,{username:'second',displayName:'Second',password:'secondpass123'},'POST',201);
 const second=(await api('/api/auth/login',null,{username:'second',password:'secondpass123'})).token;
 await api('/api/materials',null,undefined,'GET',401);
 const initial=(await api('/api/materials',member)).materials;assert.deepEqual(initial.map(m=>m.code),['W','W0','W1']);assert.ok(initial.every(m=>m.available));assert.equal(initial[0].author,'Alan G. Smith');assert.equal(initial[0].fileKey,undefined);
 await file('material-w0',null,401);
 assert.ok(initial.every(m=>m.previewAvailable));
 await api('/api/materials/material-w0/preview',null,undefined,'GET',401);
 for(const id of ['material-w0','material-w1','material-w']){
   const response=await fetch(base+'/api/materials/'+id+'/preview',{headers:{Authorization:'Bearer '+member}});
   assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
 }

 const original=await file('material-w0',member,200);assert.match(original.headers.get('content-type'),/wordprocessingml/);assert.deepEqual(Buffer.from(await original.arrayBuffer()),await readFile(join(root,'course/W0.docx')));
 await api('/api/admin/material-files',member,undefined,'GET',403);
 const available=(await api('/api/admin/material-files',admin)).files;
 assert.ok(available.some(f=>f.fileKey==='course/W2/W2.docx'));
 assert.ok(!available.some(f=>f.fileKey.startsWith('course/previews/')));
 const w2=(await api('/api/admin/materials',admin,{code:'W2',title:'W2 handout',description:'Nested course document',author:'Teacher',sourceUrl:'',order:3,published:true,fileKey:'course/W2/W2.docx'},'POST',201)).material;
 assert.deepEqual(Buffer.from(await (await file(w2.id,member,200)).arrayBuffer()),await readFile(join(root,'course/W2/W2.docx')));
 await api('/api/admin/materials/'+w2.id,admin,undefined,'DELETE');
 let material=(await api('/api/materials',admin)).materials.find(m=>m.id==='material-w0');material={...material,published:false,title:'Updated W0'};
 await api('/api/admin/materials',member,material,'POST',403);
 await api('/api/admin/materials',admin,material);
 assert.equal((await api('/api/materials',member)).materials.length,2);await file(material.id,member,404);
 await api('/api/materials/'+material.id+'/preview',member,undefined,'GET',404);
 await api('/api/admin/materials',admin,{...material,fileKey:'course/../data/store.json'},'POST',404);
 await api('/api/admin/materials',admin,{...material,sourceUrl:'javascript:alert(1)'},'POST',400);
 const pdf=Buffer.from('%PDF-1.4\n% test fixture\n');
 let upload=await fetch(base+'/api/admin/material-files?filename=notes.pdf',{method:'POST',headers:{Authorization:'Bearer '+member},body:pdf});assert.equal(upload.status,403);
 upload=await fetch(base+'/api/admin/material-files?filename=notes.pdf',{method:'POST',headers:{Authorization:'Bearer '+admin},body:pdf});assert.equal(upload.status,201);const uploaded=await upload.json();
 const created=(await api('/api/admin/materials',admin,{code:'W2',title:'Uploaded notes',description:'Test',author:'Teacher',sourceUrl:'',order:3,published:true,...uploaded},'POST',201)).material;
 assert.deepEqual(Buffer.from(await (await file(created.id,member,200)).arrayBuffer()),pdf);
 const invalid=await fetch(base+'/api/admin/material-files?filename=wrong.pdf',{method:'POST',headers:{Authorization:'Bearer '+admin},body:'not a PDF'});assert.equal(invalid.status,400);
 const tooLarge=await fetch(base+'/api/admin/material-files?filename=large.pdf',{method:'POST',headers:{Authorization:'Bearer '+admin},body:Buffer.alloc(25*1024*1024+1)});assert.equal(tooLarge.status,413);
 await api('/api/admin/materials/'+created.id,member,undefined,'DELETE',403);
 await api('/api/admin/materials/'+created.id,admin,undefined,'DELETE');await file(created.id,member,404);
 console.log('PASS: material imports, original download, author attribution, permissions, upload validation, publish/unpublish and removal');
 const source='import java.util.Scanner; public class Sum { public static void main(String[] args) {Scanner s=new Scanner(System.in);System.out.println(s.nextInt()+s.nextInt());System.err.println("debug");}}';
 const draft={source,input:'3 5\n'};
 await api('/api/compiler/draft',member,draft,'PUT');assert.equal((await api('/api/compiler/draft',second)).draft,null);assert.equal((await api('/api/compiler/draft',member)).draft.input,draft.input);
 const result=await api('/api/compiler/run',member,draft);assert.equal(result.status,'RUN');assert.equal(result.output,'8\n');assert.equal(result.stderr,'debug\n');assert.equal(result.preview,true);assert.equal(result.score,undefined);
 const ce=await api('/api/compiler/run',member,{source:'public class Bad { bad }',input:''});assert.equal(ce.status,'CE');
 const re=await api('/api/compiler/run',member,{source:'public class Fail { public static void main(String[] args) {throw new RuntimeException("test");}}',input:''});assert.equal(re.status,'RE');
 const tle=await api('/api/compiler/run',member,{source:'public class Loop { public static void main(String[] args) {while(true){}}}',input:''});assert.equal(tle.status,'TLE');
 const denied=await api('/api/compiler/run',member,{source:'public class Files { public static void main(String[] args) throws Exception {System.out.println(java.nio.file.Files.readString(java.nio.file.Path.of("'+join(root,'data/store.json')+'")));}}',input:''});assert.equal(denied.status,'RE');assert.match(denied.message,/AccessControlException|access denied/);
 await api('/api/compiler/run',member,{source:'',input:''},'POST',400);await api('/api/compiler/draft',member,{source:'x',input:'x'.repeat(20001)},'PUT',400);
 assert.equal((await api('/api/submissions',member)).submissions.length,0);assert.equal((await api('/api/bootstrap',member)).stats.accepted,0);
 await stop();await start();
 assert.equal((await api('/api/compiler/draft',member)).draft.source,source);assert.equal((await api('/api/materials',admin)).materials.find(m=>m.id===material.id).title,'Updated W0');await file(material.id,member,404);await file(created.id,member,404);
 console.log('PASS: independent compiler drafts, stdin/stdout/stderr, CE/RE/TLE, file access denied, no grades, restart persistence');
}finally{await stop();}
