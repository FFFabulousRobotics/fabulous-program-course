import {seedTestAccounts} from './fixtures.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,stat,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const data=await mkdtemp(process.cwd()+'/data/test-preview-'),base='http://127.0.0.1:5188';let child;
await seedTestAccounts(data);
async function start(){let logs='';child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'5188',FP_DATA_DIR:data},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);for(let i=0;i<100;i++){if(logs.includes('FabulousProgram ·'))return;if(child.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,100));}throw Error(logs);}
async function stop(){if(child?.exitCode===null)await new Promise(r=>{child.once('exit',r);child.kill();});}
async function api(path,token,body,expected=200){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const p=await response.json();assert.equal(response.status,expected,JSON.stringify(p));return p;}
async function upload(bytes,token){const r=await fetch(base+'/api/admin/material-files?filename=W1.docx',{method:'POST',headers:{Authorization:'Bearer '+token},body:bytes});assert.equal(r.status,201);return r.json();}
async function material(token){return (await api('/api/materials',token)).materials.find(m=>m.id==='material-w1');}
async function waitStatus(token,status){for(let i=0;i<200;i++){const m=await material(token);if(m.previewStatus===status)return m;if(m.previewStatus==='failed'&&status!=='failed')throw Error(m.previewMessage);await new Promise(r=>setTimeout(r,150));}throw Error('Preview did not reach '+status);}
async function pdf(token){const r=await fetch(base+'/api/materials/material-w1/preview',{headers:{Authorization:'Bearer '+token}});assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');return bytes;}
try{
 await start();const admin=(await api('/api/auth/login',null,{username:'admin',password:'admin123'})).token,member=(await api('/api/auth/login',null,{username:'member',password:'member123'})).token;
 const first=await readFile('course/W1.docx'),second=await readFile('course/W0.docx'),original=await material(admin);
 const a=await upload(first,admin);
 assert.equal((await api('/api/admin/materials',admin,{...original,...a})).previewStatus,'processing');
 await api('/api/materials/material-w1/preview-access',member,{},409);
 await api('/api/admin/materials/material-w1/preview-retry',member,{},403);
 await Promise.all(Array.from({length:6},()=>api('/api/materials',member)));
 await waitStatus(admin,'ready');const firstPdf=await pdf(member);
 assert.equal((await readdir(data+'/material-previews')).filter(f=>f.endsWith('.pdf')).length,1,'Concurrent requests must share conversion');
 const b=await upload(second,admin);
 assert.equal((await api('/api/admin/materials',admin,{...original,...b})).previewStatus,'processing');
 const pending=await material(member);assert.equal(pending.previewAvailable,false);assert.equal(pending.previewStatus,'processing');
 await waitStatus(admin,'ready');const secondPdf=await pdf(member);assert.notDeepEqual(firstPdf,secondPdf);
 assert.deepEqual(secondPdf,await readFile(data+'/material-previews/'+createHash('sha256').update(second).digest('hex')+'.pdf'));
 const download=await fetch(base+'/api/materials/material-w1/file',{headers:{Authorization:'Bearer '+member}});assert.deepEqual(Buffer.from(await download.arrayBuffer()),second);
 // Replacing bytes at the same path must invalidate the cached digest as well.
 await writeFile(data+'/material-files/'+b.fileKey.slice(7),first);
 await waitStatus(admin,'ready');assert.deepEqual(await pdf(member),firstPdf);
 const invalid=await upload(Buffer.from([0x50,0x4b,3,4,0,0,0,0]),admin);
 await api('/api/admin/materials',admin,{...original,...invalid});const failed=await waitStatus(admin,'failed');assert.equal(failed.previewAvailable,false);assert.ok(failed.previewMessage);
 const memberFailed=await material(member);assert.equal(memberFailed.previewMessage,undefined);assert.equal(memberFailed.previewStatus,'failed');
 assert.equal((await api('/api/admin/materials/material-w1/preview-retry',admin,{})).previewStatus,'processing');await waitStatus(admin,'failed');
 assert.ok((await api('/api/materials',member)).materials.find(m=>m.id==='material-w0').previewAvailable);
 await api('/api/admin/materials',admin,{...original,...a});await waitStatus(admin,'ready');
 const cache=data+'/material-previews/'+createHash('sha256').update(first).digest('hex')+'.pdf',mtime=(await stat(cache)).mtimeMs;
 await stop();await start();assert.equal((await material(member)).previewStatus,'ready');assert.equal((await stat(cache)).mtimeMs,mtime);assert.deepEqual(await pdf(member),firstPdf);
 await api('/api/admin/materials',admin,{...original,...a,published:false});await api('/api/materials/material-w1/preview-access',member,{},404);
 console.log('PASS: uploaded/replaced DOCX auto-conversion, processing state, same-name and in-place replacements, original download, concurrent deduplication, failure and admin retry, persistent cache, publication permissions');console.log(data);
}finally{await stop();}
