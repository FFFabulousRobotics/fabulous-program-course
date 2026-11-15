import {seedTestAccounts} from './fixtures.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile} from 'node:fs/promises';
const data=await mkdtemp(process.cwd()+'/data/test-pdf-stream-'),base='http://127.0.0.1:5184';
await seedTestAccounts(data);
let logs='';const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'5184',FP_DATA_DIR:data},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
async function api(path,token,body){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});assert.equal(response.status,200,await response.clone().text());return response.json();}
try{
 for(let i=0;i<100&&!logs.includes('FabulousProgram ·');i++)await new Promise(r=>setTimeout(r,100));assert.ok(logs.includes('FabulousProgram ·'),logs);
 const {token}=await api('/api/auth/login',null,{username:'member',password:'member123'});
 const admin=(await api('/api/auth/login',null,{username:'admin',password:'admin123'})).token;
 const {url}=await api('/api/materials/material-w/preview-access',token,{});
 assert.ok(!url.includes(token));assert.equal((await api('/api/materials/material-w/preview-access',token,{})).url,url);
 const source=await readFile('course/previews/W-fast.pdf');
 const request=(headers={},method='GET')=>fetch(base+url,{method,headers});
 let response=await request({},'HEAD');assert.equal(response.status,200);assert.equal(response.headers.get('content-length'),String(source.length));assert.equal((await response.arrayBuffer()).byteLength,0);
 const etag=response.headers.get('etag');assert.ok(etag);assert.equal(response.headers.get('accept-ranges'),'bytes');assert.equal(response.headers.get('cache-control'),'private, no-cache');
 for(const [range,start,end] of [['bytes=0-65535',0,65535],['bytes=-1024',source.length-1024,source.length-1],['bytes=65536-',65536,source.length-1]]){
   response=await request({Range:range});assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),`bytes ${start}-${end}/${source.length}`);assert.deepEqual(Buffer.from(await response.arrayBuffer()),source.subarray(start,end+1));
 }
 response=await request({'If-None-Match':etag});assert.equal(response.status,304);assert.equal((await response.arrayBuffer()).byteLength,0);
 response=await request({Range:'bytes=0-15','If-Range':etag});assert.equal(response.status,206);await response.arrayBuffer();
 response=await request({Range:'bytes=0-15','If-Range':'"stale"'});assert.equal(response.status,200);await response.arrayBuffer();
 response=await request({Range:'bytes='+source.length+'-'});assert.equal(response.status,416);assert.equal(response.headers.get('content-range'),'bytes */'+source.length);
 response=await fetch(base+url.replace('material-w/','material-w0/'));assert.equal(response.status,401);
 response=await fetch(base+'/api/bootstrap?'+url.split('?')[1]);assert.equal(response.status,401);
 response=await fetch(base+url.replace('/preview?','/file?'));assert.equal(response.status,401);
 response=await fetch(base+url,{method:'POST'});assert.equal(response.status,401);
 const w0=(await api('/api/materials',admin)).materials.find(m=>m.id==='material-w0');
 const w0Access=(await api('/api/materials/material-w0/preview-access',token,{})).url;
 await api('/api/admin/materials',admin,{...w0,published:false});
 response=await fetch(base+w0Access,{headers:{Range:'bytes=0-99'}});assert.equal(response.status,404);
 await api('/api/auth/logout',token,{});
 response=await request({Range:'bytes=0-99'});assert.equal(response.status,401);
 response=await request({'If-None-Match':etag});assert.equal(response.status,401);
 console.log('PASS: byte ranges, suffix/open ranges, HEAD, ETag/304, If-Range, 416, stable PDF-only access, publication and logout revocation');
 console.log(`First range: 65536 bytes instead of ${source.length} bytes (${(100*65536/source.length).toFixed(2)}% of the book)`);
}finally{await new Promise(r=>{child.once('exit',r);child.kill();});}
