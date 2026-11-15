import {seedTestAccounts} from './fixtures.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {combineExercise,firstAttempts,lessonCompleted} from '../src/learning-results.mjs';

const root=resolve(import.meta.dirname,'..'),data=await mkdtemp(join(tmpdir(),'unified-exercise-')),base='http://127.0.0.1:5196';let child;
await seedTestAccounts(data);
const half={score:50,status:'WA',passed:1,total:2},full={score:100,status:'AC',passed:2,total:2};
assert.equal(combineExercise(full,half).score,75);
assert.equal(combineExercise(half,full).score,75);
assert.equal(combineExercise({status:'WA',score:75,passed:3,total:4},full).score,87.5);
assert.equal(combineExercise(full,null).score,100);
assert.equal(combineExercise(null,half).score,50);
assert.equal(lessonCompleted({fillQuestions:[{}],codeTask:{}},{fillPassed:true,codePassed:true,exercisePassed:false}),false);
const legacy=[{userId:'u',lessonId:'l',kind:'exercise',knowledge:full,programming:full,createdAt:'2026-02-01'},{userId:'u',lessonId:'l',kind:'fill',...half,createdAt:'2026-01-01'}];
assert.equal(firstAttempts(legacy)[0].score,75,'A retry must not erase a historical first component failure');

async function start(){let logs='';child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:'5196',FP_DATA_DIR:data},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(logs);if(logs.includes('FabulousProgram ·'))return;await delay(100);}throw Error(logs);}
async function stop(){if(child?.exitCode===null)await new Promise(r=>{child.once('exit',r);child.kill();});}
async function api(path,token,body,status=200){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const result=await r.json();assert.equal(r.status,status,JSON.stringify(result));return result;}
try{
 await start();
 const admin=(await api('/api/auth/login',null,{username:'admin',password:'admin123'})).token,member=(await api('/api/auth/login',null,{username:'member',password:'member123'})).token;
 const questions=['one','two'].map(id=>({id,type:'choice',prompt:id,options:[{value:'A',text:'正确'},{value:'B',text:'错误'}],accepts:['A'],explanation:'解析 '+id}));
 const task={kind:'java',title:'原样输出',description:'原样输出输入的整数。',tests:[{name:'1',input:'1\n',expected:'1\n'},{name:'2',input:'2\n',expected:'2\n'}]};
 const lesson=(await api('/api/admin/lessons',admin,{weekId:'week-1',title:'统一交卷',content:'教程',questions,codeTask:task})).lesson;
 const correct='import java.util.Scanner; public class Main {public static void main(String[] args){System.out.println(new Scanner(System.in).nextInt());}}';
 const answers={one:'A',two:'A'},submit=(payload,status=200)=>api('/api/submit/exercise',member,{lessonId:lesson.id,answers,source:correct,...payload},status);
 await submit({answers:{one:'A'}},400);await submit({source:''},400);await submit({answers:{one:'Z',two:'A'}},400);
 assert.equal((await api('/api/submissions',member)).submissions.length,0);
 const ce=await submit({source:'public class Main { invalid }'});assert.equal(ce.score,50);assert.equal(ce.status,'CE');assert.equal(ce.scoring.knowledgePoints,50);assert.equal(ce.scoring.programmingPoints,0);assert.equal(ce.attemptCount,1);
 const mixed=await submit({answers:{one:'A',two:'B'}});assert.equal(mixed.score,75);assert.equal(mixed.status,'WA');assert.equal(mixed.progress.exercisePassed,false);
 assert.equal(mixed.progress.fillPassed,true);assert.equal(mixed.progress.codePassed,true);
 assert.equal((await api('/api/bootstrap',member)).lessons.find(l=>l.id===lesson.id).complete,false,'Separate component successes must not be combined across new attempts');
 const partial=await submit({source:'public class Main {public static void main(String[] args){System.out.println(1);}}'});assert.equal(partial.score,75);assert.equal(partial.programming.passed,1);
 assert.ok(partial.programming.cases.every(c=>c.expected===undefined));
 const ac=await submit({});assert.equal(ac.score,100);assert.equal(ac.status,'AC');assert.equal(ac.firstScore,50);assert.equal(ac.firstStatus,'CE');assert.equal(ac.attemptCount,4);assert.equal(ac.progress.exercisePassed,true);
 assert.equal(ac.solutions.length,2);assert.equal(ac.solutions[0].explanation,'解析 one');
 const records=(await api('/api/submissions',member)).submissions;assert.equal(records.length,4);assert.ok(records.every(s=>s.kind==='exercise'));assert.equal(records[0].source,correct);assert.equal(records[0].attemptCount,4);assert.ok(records.every(s=>s.programming.cases.every(c=>!('expected' in c))));
 const stats=(await api('/api/bootstrap',member)).stats;assert.equal(stats.firstAttempts,1);assert.equal(stats.rate,56);assert.equal(stats.accepted,1);
 const loaded=(await api('/api/lessons/'+lesson.id,member)).exerciseResult;assert.equal(loaded.score,100);assert.equal(loaded.firstScore,50);
 assert.equal((await api('/api/lessons/'+lesson.id,admin)).exerciseResult,null);
 await api('/api/run',member,{lessonId:lesson.id,source:correct,input:'5'});assert.equal((await api('/api/submissions',member)).submissions.length,4);
 const onlyQuiz=(await api('/api/admin/lessons',admin,{weekId:'week-1',title:'只有知识题',content:'教程',questions})).lesson;
 assert.equal((await api('/api/submit/exercise',member,{lessonId:onlyQuiz.id,answers})).score,100);
 const onlyCode=(await api('/api/admin/lessons',admin,{weekId:'week-1',title:'只有代码题',content:'教程',codeTask:task})).lesson;
 const codeScore=await api('/api/submit/exercise',member,{lessonId:onlyCode.id,source:correct});assert.equal(codeScore.scoring.programmingWeight,100);assert.equal(codeScore.score,100);
 assert.equal((await api('/api/bootstrap',member)).stats.firstAttempts,3);
 // Changing grading conditions during compilation must not save a mismatched paper.
 const before=(await api('/api/submissions',member)).submissions.length;
 const pending=submit({source:correct.replace('main(String[] args){','main(String[] args) throws Exception {Thread.sleep(600);')},409);
 await delay(150);await api('/api/admin/lessons',admin,{id:lesson.id,questions:questions.map(q=>({...q,accepts:['B']}))});await pending;
 assert.equal((await api('/api/submissions',member)).submissions.length,before);
 assert.equal((await api('/api/lessons/'+lesson.id,member)).progress.exercisePassed,false);
 assert.deepEqual((await api('/api/lessons/'+lesson.id,member)).exerciseResult.solutions[0].correctAnswers,['A'],'Historical answer review must retain its submitted version');
 await stop();await start();assert.equal((await api('/api/lessons/'+lesson.id,member)).exerciseResult.score,100);
 const disk=JSON.parse(await readFile(join(data,'store.json'),'utf8'));assert.equal(disk.submissions.filter(s=>s.lessonId===lesson.id).length,4);
 console.log('PASS: one atomic exercise submission, 50/50 combined scores, partial credit/CE, strict completion, no cross-attempt completion, first-only rate, private test results, self-test exclusion, answer snapshots, edit race and persistence');
}finally{await stop();await rm(data,{recursive:true,force:true});}
