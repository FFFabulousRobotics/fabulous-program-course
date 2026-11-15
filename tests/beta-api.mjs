import {seedTestAccounts} from './fixtures.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..'),data=await mkdtemp(join(root,'data/test-beta-api-'));
await seedTestAccounts(data);
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:'5175',FP_DATA_DIR:data},windowsHide:true,stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function api(path,token,body,method=body?'POST':'GET',expected=200){const r=await fetch('http://127.0.0.1:5175'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const p=await r.json();assert.equal(r.status,expected,p.error);return p;}
try{
 for(let i=0;!logs.includes('FabulousProgram ·')&&i<100;i++){await pause(100);if(child.exitCode!==null)throw Error(logs);}
 const first=await api('/api/auth/login',null,{username:'member',password:'member123'}),second=await api('/api/auth/login',null,{username:'member',password:'member123'});
 const source='import com.qualcomm.robotcore.eventloop.opmode.*;public class SessionTest extends LinearOpMode{public void runOpMode(){telemetry.addLine("Ready");telemetry.update();waitForStart();while(opModeIsActive()){telemetry.addData("value",42);telemetry.update();}}}';
 const sim=await api('/api/sim',first.token,{lessonId:'w1-03',source},'POST',201);assert.ok(sim.image.startsWith('data:image/png'));assert.equal(sim.score,undefined);
 await api('/api/sim/'+sim.id,second.token,undefined,'GET',404);
 await api('/api/sim/'+sim.id,second.token,{command:'START'},'POST',404);
 await api('/api/sim/'+sim.id,first.token,{command:'INIT'});await pause(700);
 assert.equal((await api('/api/sim/'+sim.id,first.token)).phase,'INIT');
 await api('/api/sim/'+sim.id,first.token,{command:'START'});await pause(700);
 assert.ok((await api('/api/sim/'+sim.id,first.token)).telemetry.includes('42'));
 await api('/api/sim/'+sim.id,first.token,{command:'PAD',x:99},'POST',400);
 assert.equal((await api('/api/submissions',first.token)).submissions.length,0);
 await api('/api/auth/logout',first.token,{});
 await api('/api/sim/'+sim.id,first.token,undefined,'GET',401);
 await api('/api/sim/'+sim.id,second.token,undefined,'GET',404);
 console.log('PASS: real Beta image and telemetry, same-account tab isolation, no score/records, input validation, logout cleanup');
}finally{child.kill();}
