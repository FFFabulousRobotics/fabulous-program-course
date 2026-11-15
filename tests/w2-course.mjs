import {seedTestAccounts} from './fixtures.mjs';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {buildW2,installW2,w2PublishAt,parseW2Knowledge} from '../src/w2-import.mjs';
import {publishDueCourses,lessonVisible} from '../src/course-structure.mjs';
import {validateQuestions,publicQuestion} from '../src/questions.mjs';
import {initJudge,judge} from '../src/judge.mjs';
import {knowledgeQuestions,programmingStatement} from '../public/practice.js';

const root=resolve(import.meta.dirname,'..'),bundle=await buildW2(root),task=bundle.lessons[3].codeTask;
assert.deepEqual(bundle.lessons.map(l=>[l.title,l.fillQuestions.length,l.codeTask?.tests.length||0]),[['类',6,0],['构造方法',6,0],['实例化',6,0],['流程控制',4,10]]);
assert.equal(w2PublishAt,new Date('2026-09-20T19:00:00+08:00').toISOString());
assert.throws(()=>parseW2Knowledge(''),/22/);
const model={weeks:[],lessons:[],progress:[],imports:{}};assert.equal(installW2(model,bundle),true);assert.equal(installW2(model,bundle),false);
assert.equal(model.lessons.length,4);assert.ok(model.lessons.every(l=>!lessonVisible(model,l,{role:'member'})));
assert.equal(publishDueCourses(model,Date.parse(w2PublishAt)-1),false);
assert.equal(publishDueCourses(model,Date.parse(w2PublishAt)),true);
assert.ok(model.lessons.every(l=>lessonVisible(model,l,{role:'member'})));
assert.equal(publishDueCourses(model,Date.parse(w2PublishAt)),false);
assert.throws(()=>validateQuestions([{id:'q1',type:'choice',prompt:'题',options:[{value:'A',text:'a'},{value:'A',text:'b'}],accepts:['A']}]),/不能重复/);
const q=bundle.lessons[0].fillQuestions[0],safe=publicQuestion(q);assert.equal(safe.accepts,undefined);assert.equal(safe.hint,undefined);assert.equal(safe.options.length,4);
const rendered=knowledgeQuestions(bundle.lessons[0].fillQuestions,{},null,s=>s);
assert.equal((rendered.match(/type="radio"/g)||[]).length,24);assert.ok(rendered.includes('读程序'));assert.ok(rendered.includes('补全程序'));assert.ok(!rendered.includes('答案：'));
const statement=programmingStatement(task,s=>s);for(const title of ['题目背景','题目描述','输入格式','输出格式','输入输出样例','说明 / 提示'])assert.ok(statement.includes(title));

await initJudge();
const reference=await readFile(join(root,'course/W2/test-data/reference.java'),'utf8');
assert.equal((await judge(reference,task)).status,'AC');
assert.ok(task.tests.every(t=>t.expected==='罪人舞步旋\n'||/^宣布无人罪\n\S+\n$/.test(t.expected)));
assert.equal(task.samples[0].output,'宣布无人罪\n纳塔火龙\n');
assert.equal(task.samples[1].output,'罪人舞步旋\n');
assert.ok([task.description,task.output,task.hint].every(text=>text.includes('宣布无人罪')));
for(const [before,after] of [['a.height < b.height','a.height <= b.height'],['a.charm > b.charm','a.charm >= b.charm'],["if(a.property == 'D') return true;",''],['a.sex == b.sex','a.sex != b.sex']]){
 const result=await judge(reference.replace(before,after),task);assert.equal(result.status,'WA',before);assert.ok(result.passed<10);
}
const original=await readFile(join(root,'course/W2/testW2.java'),'utf8');assert.equal(original,reference,'Both reference programs must use the same simplified output');
const nameOnly=reference.replace('System.out.println("宣布无人罪");','');
assert.equal((await judge(nameOnly,task)).status,'WA','Missing the success message must not pass two-line output');
const fullInfo=reference.replace('System.out.println(travellers[i].name);','System.out.println(travellers[i].name + " " + travellers[i].sex + " " + travellers[i].property + " " + travellers[i].height + " " + travellers[i].charm);');
assert.equal((await judge(fullInfo,task)).status,'WA','Extra attributes must not pass name-only output');
console.log('PASS: W2 content, duplicate removal, 22 questions, schedule boundary, 10 real Java cases and incorrect-solution rejection');

const data=await mkdtemp(join(tmpdir(),'w2-test-')),base='http://127.0.0.1:5193';let child;
await seedTestAccounts(data);
async function start(){let logs='';child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,FP_DATA_DIR:data,PORT:'5193'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(logs);if(logs.includes('FabulousProgram ·'))return;await delay(100);}throw Error(logs);}
async function stop(){if(child?.exitCode===null)await new Promise(r=>{child.once('exit',r);child.kill();});}
async function api(path,token,body,expected=200,method=body?'POST':'GET'){
 const r=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const result=await r.json();assert.equal(r.status,expected,JSON.stringify(result));return result;
}
try{
 await start();await stop();
 const file=join(data,'store.json'),db=JSON.parse(await readFile(file,'utf8'));installW2(db,bundle);
 // Keep the access fixture scheduled even when the real W2 release date has passed.
 const futurePublishAt=new Date(Date.now()+86400000).toISOString();
 db.weeks.find(w=>w.id==='week-2').publishAt=futurePublishAt;
 for(const lesson of db.lessons.filter(l=>l.weekId==='week-2'))lesson.publishAt=futurePublishAt;
 await writeFile(file,JSON.stringify(db));await start();
 const admin=(await api('/api/auth/login',null,{username:'admin',password:'admin123'})).token,member=(await api('/api/auth/login',null,{username:'member',password:'member123'})).token;
 assert.ok(!(await api('/api/bootstrap',member)).weeks.some(w=>w.id==='week-2'));
 for(const l of bundle.lessons)await api('/api/lessons/'+l.id,member,undefined,404);
 // Saving an imported assessment must preserve its question types and problem sections.
 const loaded=(await api('/api/lessons/w2-04',admin)).lesson;
 await api('/api/admin/lessons',admin,{id:loaded.id,codeTask:loaded.codeTask,questions:loaded.fillQuestions});
 assert.deepEqual((await api('/api/lessons/w2-04',admin)).lesson.codeTask.samples,task.samples);
 await api('/api/admin/weeks',admin,{...bundle.week,published:true,publishAt:null});
 for(const lesson of bundle.lessons)await api('/api/admin/lessons',admin,{id:lesson.id,published:true,publishAt:null});
 const handout=(await api('/api/materials',member)).materials.find(m=>m.code==='W2');
 assert.ok(handout?.available,'Publishing imported W2 must register its nested handout');
 const download=await fetch(base+'/api/materials/'+handout.id+'/file',{headers:{Authorization:'Bearer '+member}});
 assert.equal(download.status,200);
 assert.deepEqual(Buffer.from(await download.arrayBuffer()),await readFile(join(root,'course/W2/W2.docx')));
 for(const lesson of bundle.lessons){
  const payload=await api('/api/lessons/'+lesson.id,member);
  assert.ok(payload.lesson.fillQuestions.every(q=>!('accepts' in q)&&!('hint' in q)&&q.options.length===4));
  if(payload.lesson.codeTask){assert.deepEqual(payload.lesson.codeTask.tests,task.tests.map(t=>({name:t.name})));assert.equal(payload.lesson.codeTask.samples.length,3);}
  const answers=Object.fromEntries(lesson.fillQuestions.map(q=>[q.id,q.accepts[0]]));
  const first=lesson.fillQuestions[0],wrong={...answers,[first.id]:first.options.find(o=>!first.accepts.includes(o.value)).value};
  assert.equal((await api('/api/submit/fill',member,{lessonId:lesson.id,answers:wrong})).status,'WA');
  assert.equal((await api('/api/submit/fill',member,{lessonId:lesson.id,answers})).status,'AC');
 }
 const run=await api('/api/run',member,{lessonId:'w2-04',source:reference,input:task.samples[0].input});assert.equal(run.status,'RUN');assert.equal(run.output,task.samples[0].output);
 const submitted=await api('/api/submit/code',member,{lessonId:'w2-04',source:reference});assert.equal(submitted.score,100);assert.equal(submitted.total,10);assert.equal(submitted.progress.codePassed,true);
 await api('/api/run',member,{lessonId:'w2-04',source:reference,input:123},400);
 for(const path of ['/course/W2/knowledgeW2.md','/course/W2/test-data/04.in','/course/W2/test-data/reference.java'])assert.equal((await fetch(base+path)).status,404);
 await stop();await start();assert.equal((await api('/api/lessons/w2-04',member)).progress.codePassed,true);
 console.log('PASS: scheduled access, admin round-trip, private answers/tests, all question submissions, sample stdin, 100-point grading and persistence');
}finally{await stop();await rm(data,{recursive:true,force:true});}
