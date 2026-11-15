import {javaToolchain} from '../src/runtime-config.mjs';
import {seedTestAccounts} from './fixtures.mjs';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {buildW6,importW6} from '../src/w6-import.mjs';
import {gradeQuestions,correctAnswer} from '../src/questions.mjs';
import {validateTask} from '../src/task-config.mjs';
import {initJudge,judge,processRun} from '../src/judge.mjs';
import {knowledgeQuestions,programmingStatement} from '../public/practice.js';
import {assessmentEditor} from '../public/assessment.js';
const root=resolve(import.meta.dirname,'..'),{lesson,digest}=await buildW6(root),task=lesson.codeTask,answers=Object.fromEntries(lesson.fillQuestions.map(q=>[q.id,q.accepts[0]]));
assert.equal(gradeQuestions(lesson.fillQuestions,answers).points,60);assert.equal(lesson.unifiedExercise,true);
for(const a of ['pos < 0 || pos > 1','!(pos>=0&&pos<=1)','pos>=0&&pos<=1 ? false : true','pos < 0.0 || pos > 1.0'])assert.equal(correctAnswer(lesson.fillQuestions[8],a),true,a);
for(const a of ['pos <= 0 || pos >= 1','pos < 0 && pos > 1','true','pos < 0 || pos > 1;','Math.abs(pos) > 1','process.exit()'])assert.equal(correctAnswer(lesson.fillQuestions[8],a),false,a);
for(const a of ['super(who);','super ( (who) ) ;','super(/* parameter */who);'])assert.equal(correctAnswer(lesson.fillQuestions[9],a),true,a);
for(const a of ['super("who");','this(who);','super(who)','super(who); return;','super((who);'])assert.equal(correctAnswer(lesson.fillQuestions[9],a),false,a);
assert.throws(()=>validateTask({...task,fixedMain:true}));
assert.throws(()=>validateTask({...task,tests:task.tests.map((t,i)=>({...t,points:i===0?100:t.points}))}));
const draft={users:[],weeks:[],lessons:[],materials:[],imports:{}};assert.equal(await importW6(draft,root),true);assert.equal(draft.weeks[0].published,false);assert.equal(draft.materials[0].published,false);assert.equal(await importW6(draft,root),false);assert.equal(draft.imports.w6.digest,digest);
const h=knowledgeQuestions(lesson.fillQuestions,{},null,s=>s);assert.match(h,/判断题（5题，每题4分，共20分）/);assert.match(h,/单项选择题（3题，每题8分，共24分）/);assert.match(h,/填空题（2题，每题8分，共16分）/);
assert.match(programmingStatement(task,s=>s),/输入格式/);assert.match(assessmentEditor(task),/完整Main.java/);
console.log('PASS W6 content, 5/3/2 points, equivalent fill syntax, editable Main, explicit draft import and idempotence');

await initJudge();const good=await judge(task.referenceSource,task);assert.equal(good.points,40,JSON.stringify(good));assert.equal(good.status,'AC');
const defects=[
 ['wrong height subject','if (other.getHeight() <= 160)','if (getHeight() <= 160)'],
 ['missing foreign guard','if (other.getHeight() <= 160) return false;',''],
 ['bad setter','if (charm >= 0 && charm <= 100) this.charm = charm;','this.charm = charm;'],
 ['missing overload output','System.out.println(prefix + " " + name + " " + gender + " " + property + " " + height + " " + charm);','showInfo();'],
 ['missing this initialization','this.gender = gender;','gender = gender;'],
 ['missing super match','return super.canMatch(other);','return true;'],
 ['missing bidirectional Main','t.canMatch(host) && host.canMatch(t)','t.canMatch(host)'],
 ['missing override annotation','@Override\n    public void showInfo()','public void showInfo()'],
];
for(const [name,before,after] of defects){assert(task.referenceSource.includes(before));const r=await judge(task.referenceSource.replace(before,after),task);assert(r.points<40,name);if(['missing foreign guard','bad setter','missing overload output','missing super match'].includes(name))assert.equal(r.points,34,name);console.log('PASS W6 rejects',name,r.points);}
const empty=await judge(task.starter,task);assert.equal(empty.points,4,'Only provided field/interface structure earns credit');
const mainChanged=task.referenceSource.replace('boolean found = false;','/* Main is editable */ boolean found = false;');assert.equal((await judge(mainChanged,task)).points,40);
const malicious=task.referenceSource.replace('Scanner sc = new Scanner(System.in);','System.setSecurityManager(null); Scanner sc = new Scanner(System.in);');
const denied=await judge(malicious,task);assert.equal(denied.points,36);assert.equal(denied.cases[6].status,'RE');assert.match(denied.cases[6].message,/access denied|AccessControlException/);
const temp=await mkdtemp(join(tmpdir(),'w6-parser-'));
try{
 const sentinel=join(temp,'must-not-exist'),source=join(temp,'Main.java'),report=join(temp,'report');
 const injected=task.referenceSource.replace('class Soda {','class Soda { static { try { java.nio.file.Files.writeString(java.nio.file.Path.of("'+sentinel+'"), "unsafe"); } catch(Exception e) { throw new RuntimeException(e); } }');
 await writeFile(source,injected);const sdk=await javaToolchain();
 const parsed=await processRun(sdk.java,['-cp',join(root,'sdk/harness'),'fabulous.W6Harness','syntax-part1',report,source],{cwd:temp,timeout:4000});
 assert.equal(parsed.code,0);assert.match(await readFile(report,'utf8'),/^AC\|/);assert.equal(await stat(sentinel).catch(()=>null),null);
}finally{await rm(temp,{recursive:true,force:true});}
console.log('PASS W6 fresh-loader Main sandbox and trusted parser never executes student initialization');

const data=await mkdtemp(join(tmpdir(),'w6-api-')),base='http://127.0.0.1:5207';let child;
await seedTestAccounts(data);
async function start(){let logs='';child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:'5207',FP_DATA_DIR:data},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);for(let i=0;i<200;i++){if(child.exitCode!==null)throw Error(logs);if(logs.includes('FabulousProgram ·'))return;await delay(100);}throw Error(logs);}
async function stop(){if(child?.exitCode===null)await new Promise(r=>{child.once('exit',r);child.kill();});}
async function api(path,token,body,status=200,method=body?'POST':'GET'){
 const r=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const v=await r.json();assert.equal(r.status,status,path+' '+JSON.stringify(v));return v;
}
try{
 await start();await stop();const file=join(data,'store.json'),db=JSON.parse(await readFile(file,'utf8')),before=structuredClone(db);
 await importW6(db,root,{published:true});db.courseSettings.homeWeekId='week-6';
 const secret='TEACHER_REFERENCE_MUST_NOT_LEAK';db.lessons.find(l=>l.id===lesson.id).codeTask.referenceSource+='\n// '+secret;
 assert.deepEqual(db.users,before.users);assert.deepEqual(db.submissions,before.submissions);assert.deepEqual(db.lessons.slice(0,before.lessons.length),before.lessons);
 await writeFile(file,JSON.stringify(db));await start();
 const admin=(await api('/api/auth/login',null,{username:'admin',password:'admin123'})).token;
 const a=(await api('/api/auth/login',null,{username:'member',password:'member123'})).token;
 const other=(await api('/api/admin/users',admin,{username:'w6_other',displayName:'W6测试成员',password:'TestMember2026!'},201)).user;
 const b=(await api('/api/auth/login',null,{username:'w6_other',password:'TestMember2026!'})).token;
 await api('/api/lessons/'+lesson.id,null,null,401);
 for(const token of [a,b]){
  const boot=await api('/api/bootstrap',token);assert.equal(boot.homeWeekId,'week-6');assert.equal(boot.lessons.filter(l=>l.weekId==='week-6').length,1);
  const p=await api('/api/lessons/'+lesson.id,token);assert.equal(p.lesson.exerciseOnly,false);assert.equal(p.lesson.codeTask.fixedMain,false);assert.equal(p.lesson.unifiedExercise,true);assert.ok(p.lesson.content.includes('class ServoArm'));assert.equal(p.lesson.fillQuestions.length,10);assert.ok(!('referenceSource'in p.lesson.codeTask));assert.ok(!JSON.stringify(p).includes(secret));
  assert.ok(p.lesson.codeTask.tests.every(t=>Object.keys(t).length===1));assert.ok(p.lesson.fillQuestions.every(q=>!('accepts'in q)&&!('matcher'in q)&&!('explanation'in q)));
 }
 const materials=(await api('/api/materials',a)).materials,w6=materials.find(m=>m.id==='material-w6');assert(w6.available&&w6.previewAvailable);
 const access=(await api('/api/materials/material-w6/preview-access',a,{})).url;const pdf=await fetch(base+access,{headers:{Authorization:'Bearer '+a}});assert.equal(pdf.status,200);assert.equal((await pdf.arrayBuffer()).slice(0,4).byteLength,4);
 await api('/api/drafts/'+lesson.id,a,{source:'// A\n'+task.starter,answers},200,'PUT');await api('/api/drafts/'+lesson.id,b,{source:'// B\n'+task.starter,answers:{...answers,'w6-q01':'true'},userId:'u_member'},200,'PUT');
 assert.match((await api('/api/lessons/'+lesson.id+'?userId='+other.id,a)).draft.source,/^\/\/ A/);assert.match((await api('/api/lessons/'+lesson.id,b)).draft.source,/^\/\/ B/);
 for(const part of ['fill','code'])await api('/api/submit/'+part,a,{lessonId:lesson.id,answers,source:task.referenceSource},409);
 await api('/api/submit/exercise',a,{lessonId:lesson.id,answers:{},source:task.referenceSource},400);
 const run=await api('/api/run',a,{lessonId:lesson.id,source:mainChanged,input:task.samples[2].input});assert.equal(run.status,'RUN');assert.equal(run.output,task.samples[2].output);assert.equal((await api('/api/submissions',a)).submissions.length,0);
 await api('/api/progress/'+lesson.id,a,{});
 const first=await api('/api/submit/exercise',a,{lessonId:lesson.id,answers:{...answers,'w6-q01':'true'},source:task.referenceSource});assert.equal(first.score,96);assert.equal(first.firstScore,96);assert.equal(first.progress.exercisePassed,false);assert.equal(first.programmingSolution,undefined);assert.ok(!JSON.stringify(first).includes(secret));
 const perfect=await api('/api/submit/exercise',a,{lessonId:lesson.id,answers,source:task.referenceSource});assert.equal(perfect.score,100);assert.equal(perfect.firstScore,96);assert.equal(perfect.attemptCount,2);assert.equal(perfect.scoring.knowledgePoints,60);assert.equal(perfect.scoring.programmingPoints,40);assert.equal(perfect.acContribution.score,94.2);assert.equal(perfect.progress.exercisePassed,true);
 const ce=await api('/api/submit/exercise',b,{lessonId:lesson.id,answers,source:'public class Main { syntax error; }',userId:'u_member'});assert.equal(ce.userId,other.id);assert.equal(ce.programming.status,'CE');assert.equal(ce.score,60);assert.equal(ce.firstScore,60);
 const own=(await api('/api/submissions?scope=all&userId='+other.id,a)).submissions;assert.equal(own.length,2);assert(own.every(s=>s.userId==='u_member'));
 assert.equal((await api('/api/lessons/'+lesson.id,a)).exerciseResult.firstScore,96);assert.equal((await api('/api/lessons/'+lesson.id,b)).exerciseResult.firstScore,60);assert.ok((await api('/api/lessons/'+lesson.id,admin)).lesson.codeTask.referenceSource.includes(secret));
 const trial=await api('/api/admin/trial',admin,{codeTask:task,source:task.referenceSource});assert.equal(trial.points,40);assert.equal((await api('/api/submissions',a)).submissions.length,2);
 await api('/api/admin/trial',a,{codeTask:task,source:task.referenceSource},403);
 await stop();await start();assert.equal((await api('/api/lessons/'+lesson.id,a)).exerciseResult.firstScore,96);assert.equal((await api('/api/lessons/'+lesson.id,b)).exerciseResult.score,60);
 console.log('PASS W6 API: published handout/PDF, private teacher code, editable stdin, unified weighted 60/40, retries with frozen first score, CE, admin trial, two-account isolation and restart');
}finally{await stop();await rm(data,{recursive:true,force:true});}
