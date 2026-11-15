import {seedTestAccounts} from './fixtures.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {submissionStats,knowledgeReview,lessonCompleted} from '../src/learning-results.mjs';
import {buildW2,installW2} from '../src/w2-import.mjs';
import {migrateKnowledgeChoices} from '../src/knowledge-migration.mjs';
import {migrateWeekPublication,homeWeek} from '../src/course-structure.mjs';
import {lessons} from '../src/curriculum.mjs';
import {knowledgeFeedback,knowledgeQuestions} from '../public/practice.js';

const root=resolve(import.meta.dirname,'..'),data=await mkdtemp(join(tmpdir(),'learning-workflow-')),base='http://127.0.0.1:5195';let child;
await seedTestAccounts(data);
assert.equal(lessonCompleted({fillQuestions:[{}]}, {read:false,fillPassed:true}),true);
assert.equal(lessonCompleted({fillQuestions:[{}],codeTask:{}},{read:true,fillPassed:true,codePassed:false}),false);
assert.equal(lessonCompleted({fillQuestions:[{}],codeTask:{}},{read:false,fillPassed:true,codePassed:true}),true);
assert.equal(lessonCompleted({codeTask:{}},{codePassed:true}),true);
assert.equal(lessonCompleted({fillQuestions:[]},{read:false}),false);
assert.equal(lessonCompleted({fillQuestions:[]},{read:true}),true);
// Historical records are counted chronologically, once per user/lesson, combining first historical component attempts.
const records=[
 {userId:'u',lessonId:'l',kind:'fill',status:'AC',createdAt:'2026-01-02'},
 {userId:'u',lessonId:'l',kind:'code',status:'AC',createdAt:'2026-01-01'},
 {userId:'u',lessonId:'l',kind:'fill',status:'WA',createdAt:'2026-01-01'}
];
assert.deepEqual(submissionStats(records,[{id:'l',fillQuestions:[{}],codeTask:{}}]),{submissions:3,firstAttempts:1,firstAccepted:0,firstScoreTotal:50,acScoreTotal:62,scoredExercises:1,rate:62});
const fixture={lessons:structuredClone(lessons),submissions:[],progress:[],drafts:[]};migrateKnowledgeChoices(fixture);
assert.ok(fixture.lessons.flatMap(l=>l.fillQuestions).every(q=>q.options.length===4));
assert.equal(migrateKnowledgeChoices(fixture),false);
assert.equal((knowledgeQuestions(fixture.lessons[0].fillQuestions,{},null,s=>s).match(/type="radio"/g)||[]).length,20);
const legacy={...records[2],score:20,passed:1,total:5,details:[],id:'legacy'};
const legacyReview=knowledgeReview({submissions:[legacy]},'u',{id:'l',fillQuestions:fixture.lessons[0].fillQuestions});
assert.equal(legacyReview.score,20);assert.equal(legacyReview.solutions.length,5);
assert.ok(knowledgeFeedback(legacyReview,s=>s).includes('查看答案与解析'));
const broken={weeks:[{id:'w1',number:1,published:true},{id:'w2',number:2,published:true}],lessons:[{id:'a',weekId:'w1',published:true},{id:'b',weekId:'w2',published:false,publishAt:'2099-01-01T00:00:00Z'}],courseSettings:{homeWeekId:null}};
migrateWeekPublication(broken);assert.equal(homeWeek(broken).id,'w2');assert.equal(broken.lessons[1].published,true);assert.equal(broken.lessons[1].publishAt,null);

async function start(){let logs='';child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:'5195',FP_DATA_DIR:data},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(logs);if(logs.includes('FabulousProgram ·'))return;await delay(100);}throw Error(logs);}
async function stop(){if(child?.exitCode===null)await new Promise(r=>{child.once('exit',r);child.kill();});}
async function api(path,token,body,status=200){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const result=await r.json();assert.equal(r.status,status,JSON.stringify(result));return result;}
try{
 await start();await stop();
 const file=join(data,'store.json'),db=JSON.parse(await readFile(file,'utf8'));installW2(db,await buildW2(root));
 // Reproduce the reported state: parent manually published while its children remain scheduled.
 db.weeks.find(w=>w.id==='week-2').published=true;db.weeks.find(w=>w.id==='week-2').publishAt=null;delete db.weekPublicationVersion;
 await writeFile(file,JSON.stringify(db));await start();
 const admin=(await api('/api/auth/login',null,{username:'admin',password:'admin123'})).token;
 const member=(await api('/api/auth/login',null,{username:'member',password:'member123'})).token;
 let bootstrap=await api('/api/bootstrap',member);assert.equal(bootstrap.homeWeekId,'week-2');assert.equal(bootstrap.lessons.filter(l=>l.weekId==='week-2').length,4);
 await api('/api/admin/course-settings',admin,{homeWeekId:'week-1'});assert.equal((await api('/api/bootstrap',member)).homeWeekId,'week-1');
 await api('/api/admin/course-settings',admin,{homeWeekId:'week-2'});assert.equal((await api('/api/bootstrap',member)).homeWeekId,'week-2');
 await api('/api/admin/course-settings',admin,{homeWeekId:null});
 const goodTask={kind:'java',title:'输出 1',starter:'',tests:[{name:'输出',input:'',expected:'1\n'}]};
 const futureLesson=(await api('/api/admin/lessons',admin,{weekId:'week-2',title:'未来课程',content:'新课程',questions:[{id:'q',type:'choice',prompt:'选择一',options:[{value:'A',text:'一'},{value:'B',text:'二'}],accepts:['A'],explanation:'因为题目要求选择一。'}],codeTask:goodTask})).lesson;
 for(const id of ['w1-01','w2-01',futureLesson.id]){
  const original=(await api('/api/lessons/'+id,admin)).lesson,questions=original.fillQuestions;
  const before=await api('/api/lessons/'+id,member);assert.equal(before.knowledgeResult,null);
  assert.ok(before.lesson.fillQuestions.every(q=>q.options&&!q.accepts&&!q.hint&&!q.explanation));
  const correct=Object.fromEntries(questions.map(q=>[q.id,q.accepts[0]]));
  await api('/api/submit/fill',member,{lessonId:id,answers:{}},400);
  const incomplete={...correct};delete incomplete[questions[0].id];await api('/api/submit/fill',member,{lessonId:id,answers:incomplete},400);
  await api('/api/submit/fill',member,{lessonId:id,answers:{...correct,[questions[0].id]:'invalid-choice'}},400);
  const wrong={...correct,[questions[0].id]:questions[0].options.find(o=>!questions[0].accepts.includes(o.value)).value};
  const first=await api('/api/submit/fill',member,{lessonId:id,answers:wrong});
  assert.equal(first.status,'WA');assert.equal(first.attemptCount,1);assert.equal(first.solutions.length,questions.length);assert.equal(first.firstScore,Math.round((questions.length-1)/questions.length*100));
  assert.ok(first.solutions.every(q=>q.correctAnswers.length));
  const again=await api('/api/submit/fill',member,{lessonId:id,answers:correct});assert.equal(again.score,100);assert.equal(again.attemptCount,2);assert.equal(again.firstScore,first.score);assert.equal(again.firstStatus,'WA');
  const reload=await api('/api/lessons/'+id,member);assert.equal(reload.knowledgeResult.score,100);assert.equal(reload.knowledgeResult.firstScore,first.score);assert.equal(reload.knowledgeResult.attemptCount,2);
  assert.equal((await api('/api/lessons/'+id,admin)).knowledgeResult,null,'Another user cannot unlock my answer review');
 }
 assert.equal((await api('/api/bootstrap',member)).stats.rate,56.03);
 const completedQuizzes=await api('/api/bootstrap',member);
 assert.equal(completedQuizzes.stats.accepted,2,'Passing knowledge-only lessons must count without clicking the reading button');
 for(const id of ['w1-01','w2-01']){const l=completedQuizzes.lessons.find(l=>l.id===id);assert.equal(l.complete,true);assert.equal(l.progress.read,false);}
 const wrongSource='public class Main {public static void main(String[] args){System.out.println(2);}}',correctSource=wrongSource.replace('println(2)','println(1)');
 await api('/api/submit/code',member,{lessonId:futureLesson.id,source:wrongSource});await api('/api/submit/code',member,{lessonId:futureLesson.id,source:correctSource});
 const stats=(await api('/api/bootstrap',member)).stats;assert.equal(stats.submissions,8);assert.equal(stats.firstAttempts,3);assert.equal(stats.rate,64.03);
 assert.equal(stats.accepted,3,'A mixed lesson counts only after both knowledge and code pass');
 const result=(await api('/api/lessons/'+futureLesson.id,member));assert.equal(result.codeResult.score,100);assert.equal(result.knowledgeResult.solutions[0].explanation,'因为题目要求选择一。');
 await stop();await start();assert.equal((await api('/api/bootstrap',member)).stats.rate,64.03);assert.equal((await api('/api/lessons/w1-01',member)).knowledgeResult.score,100);
 console.log('PASS: W1/W2/future click choices, complete-sheet validation, scored retries, answer/explanation review, persisted scores, historical/first-only AC rate, weekly publication recovery and admin homepage settings');
}finally{await stop();await rm(data,{recursive:true,force:true});}
