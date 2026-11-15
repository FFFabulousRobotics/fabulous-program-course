import {seedTestAccounts} from './fixtures.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {publishDueCourses} from '../src/course-structure.mjs';
import {collectPublication,courseAdminView,publicationChange} from '../public/course-views.js';

const instant=Date.parse('2030-01-01T00:00:00Z');
const fixture={weeks:[{id:'w',published:false,publishAt:new Date(instant).toISOString()}],lessons:[{weekId:'w',published:false,publishAt:new Date(instant+1).toISOString()},{weekId:'other',published:false}]};
assert.equal(publishDueCourses(fixture,instant-1),false);
assert.equal(publishDueCourses(fixture,instant),true);
assert.equal(fixture.weeks[0].published,true);assert.equal(fixture.weeks[0].publishAt,null);
assert.equal(fixture.lessons[0].published,true);assert.equal(publishDueCourses(fixture,instant),false);
assert.equal(publishDueCourses(fixture,instant+1),false);assert.equal(fixture.lessons[1].published,false);
assert.deepEqual(collectPublication({publicationMode:'draft',publishAt:'invalid'}),{published:false,publishAt:null});
assert.deepEqual(collectPublication({publicationMode:'now'}),{published:true,publishAt:null});
assert.throws(()=>collectPublication({publicationMode:'scheduled',publishAt:''}),/请选择/);
assert.throws(()=>collectPublication({publicationMode:'scheduled',publishAt:'2000-01-01T00:00'}),/晚于/);
// Local wall-clock selection must round-trip through UTC in different browser time zones.
const previousTZ=process.env.TZ;
try{
 for(const zone of ['Asia/Shanghai','America/New_York','UTC']){
  process.env.TZ=zone;
  const selection='2099-06-15T12:30:00',result=collectPublication({publicationMode:'scheduled',publishAt:selection});
  const week={id:'week',number:2,code:'W2',title:'预约周',description:'',...result};
  const html=courseAdminView({weeks:[week],lessons:[],courseSettings:{}},null,{mode:'week',weekId:week.id});
  assert.ok(html.includes('value="'+selection+'"'));assert.ok(html.includes('待发布'));assert.ok(html.includes(zone));
 }
}finally{if(previousTZ===undefined)delete process.env.TZ;else process.env.TZ=previousTZ;}
const field={},input={},target={matches:()=>true,value:'scheduled',form:{querySelector:()=>field,elements:{publishAt:input}}};
publicationChange(target);assert.equal(field.hidden,false);assert.equal(input.required,true);assert.equal(input.disabled,false);
target.value='draft';publicationChange(target);assert.equal(field.hidden,true);assert.equal(input.required,false);assert.equal(input.disabled,true);

const data=await mkdtemp(join(tmpdir(),'course-scheduling-')),base='http://127.0.0.1:5191';let child;
await seedTestAccounts(data);
async function start(){
 let logs='';child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'5191',FP_DATA_DIR:data},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 for(let i=0;i<150;i++){if(child.exitCode!==null)throw Error(logs);if(logs.includes('FabulousProgram ·'))return;await delay(100);}throw Error(logs);
}
async function stop(){if(child?.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
async function api(path,token,body,method=body?'POST':'GET',expected=200){
 const response=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return result;
}
const future=()=>new Date(Date.now()+60000).toISOString();
const stored=async()=>JSON.parse(await readFile(join(data,'store.json'),'utf8'));
try{
 await start();
 const admin=(await api('/api/auth/login',null,{username:'admin',password:'admin123'})).token;
 const member=(await api('/api/auth/login',null,{username:'member',password:'member123'})).token;
 for(const publishAt of ['',false,123,'bad','2099-01-01T00:00:00','2000-01-01T00:00:00Z'])await api('/api/admin/weeks',admin,{number:2,title:'定时周',published:false,publishAt},'POST',400);
 await api('/api/admin/weeks',admin,{number:2,title:'定时周',published:true,publishAt:future()},'POST',400);
 await api('/api/admin/weeks',member,{number:2,title:'定时周',published:false,publishAt:future()},'POST',403);
 let week=(await api('/api/admin/weeks',admin,{number:2,title:'定时周',published:false,publishAt:future()})).week;
 const draft={weekId:week.id,title:'定时教程',content:'# 正文'};
 const one=(await api('/api/admin/lessons',admin,{...draft,published:true})).lesson;
 const two=(await api('/api/admin/lessons',admin,{...draft,publishAt:'ignored legacy field'})).lesson;
 for(const l of [one,two]){assert.equal(l.published,false);assert.equal(l.publishAt,week.publishAt);await api('/api/lessons/'+l.id,member,undefined,'GET',404);}
 await api('/api/admin/lessons',admin,{id:one.id,content:''},'POST',400);
 await stop();await start();assert.equal((await api('/api/lessons/'+one.id,admin)).lesson.publishAt,week.publishAt);
 const canceled=(await api('/api/admin/weeks',admin,{number:3,title:'取消预约',published:false,publishAt:future()})).week;
 const canceledLesson=(await api('/api/admin/lessons',admin,{...draft,weekId:canceled.id})).lesson;
 await api('/api/admin/weeks',admin,{...canceled,publishAt:null});
 const postponed=(await api('/api/admin/weeks',admin,{number:4,title:'改期',published:false,publishAt:new Date(Date.now()+2000).toISOString()})).week;
 const postponedLesson=(await api('/api/admin/lessons',admin,{...draft,weekId:postponed.id})).lesson;
 await api('/api/admin/weeks',admin,{...postponed,publishAt:future()});
 week=(await api('/api/admin/weeks',admin,{...week,publishAt:new Date(Date.now()+1500).toISOString()})).week;
 // Publication must happen without browser traffic, for all children together.
 await delay(2700);
 let disk=await stored();
 for(const l of [one,two]){assert.equal(disk.lessons.find(x=>x.id===l.id).published,true);assert.equal(disk.lessons.find(x=>x.id===l.id).publishAt,null);await api('/api/lessons/'+l.id,member);}
 assert.equal(disk.lessons.find(x=>x.id===canceledLesson.id).published,false);assert.equal(disk.lessons.find(x=>x.id===canceledLesson.id).publishAt,null);
 assert.equal(disk.lessons.find(x=>x.id===postponedLesson.id).published,false);
 assert.equal((await api('/api/bootstrap',member)).homeWeekId,week.id);
 await api('/api/admin/course-settings',admin,{homeWeekId:week.id});
 assert.equal((await api('/api/bootstrap',member)).homeWeekId,week.id);
 // New and moved children inherit the destination week, including immediate publication.
 const added=(await api('/api/admin/lessons',admin,draft)).lesson;assert.equal(added.published,true);
 await api('/api/admin/lessons',admin,{id:added.id,weekId:canceled.id});await api('/api/lessons/'+added.id,member,undefined,'GET',404);
 await api('/api/admin/weeks',admin,{...week,published:false,publishAt:null});
 for(const l of [one,two])await api('/api/lessons/'+l.id,member,undefined,'GET',404);
 await api('/api/admin/weeks',admin,{...week,published:true,publishAt:null});
 for(const l of [one,two])await api('/api/lessons/'+l.id,member);
 // Expiration during downtime publishes the entire week after restart.
 await api('/api/admin/weeks',admin,{...canceled,publishAt:new Date(Date.now()+1200).toISOString()});
 await stop();await delay(1400);await start();
 for(const l of [added,canceledLesson])await api('/api/lessons/'+l.id,member);
 disk=await stored();assert.equal(disk.weeks.find(x=>x.id===canceled.id).published,true);
 console.log('PASS: week-only scheduling, inherited publication, all children released/hidden together, homepage manual/auto, cancellation, rescheduling and restart recovery');
}finally{await stop();await rm(data,{recursive:true,force:true});}
