import {seedTestAccounts} from './fixtures.mjs';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {randomBytes,createHash,scryptSync} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {buildW5,importW5} from '../src/w5-import.mjs';
import {gradeQuestions,publicQuestion} from '../src/questions.mjs';
import {expressionAnswer} from '../src/expression-answer.mjs';
import {validateTask} from '../src/task-config.mjs';
import {initJudge,judge} from '../src/judge.mjs';
import {knowledgeQuestions} from '../public/practice.js';
import {fixedMain,editableSoda,composeSoda} from '../public/soda-editor.js';

const root=resolve(import.meta.dirname,'..'),{papers}=await buildW5(root);
const answers=l=>Object.fromEntries(l.fillQuestions.map(q=>[q.id,q.accepts[0]]));
for(const {lesson:l} of papers){
 assert.equal(gradeQuestions(l.fillQuestions,answers(l)).points,60);
 assert.ok(l.fillQuestions.map(publicQuestion).every(q=>!('accepts'in q)&&!('matcher'in q)&&!('explanation'in q)));
 const html=knowledgeQuestions(l.fillQuestions,{},null,s=>s);
 assert.match(html,/判断题（5题，每题4分，共20分）/);assert.match(html,/单项选择题（2题，每题10分，共20分）/);assert.match(html,/填空题（2题，每题10分，共20分）/);
 assert.equal((html.match(/type="radio"/g)||[]).length,18);assert.equal((html.match(/placeholder="填写答案"/g)||[]).length,2);
 assert.equal(composeSoda(editableSoda(l.codeTask.referenceSource,l.codeTask),l.codeTask),l.codeTask.referenceSource);
 assert.throws(()=>validateTask({...l.codeTask,variant:'toString'}));
 assert.throws(()=>validateTask({...l.codeTask,tests:l.codeTask.tests.map((t,i)=>({...t,points:i===0?100:t.points}))}));
}
for(const [kind,yes,no] of [
 ['w5-cans','cans/perBox+(cans%perBox==0?0:1)','4'],
 ['w5-tickets','(tickets-1)/perSheet+1','tickets/perSheet+1'],
 ['w5-lights','need/capacity+(need%capacity!=0?1:0)','(need-1)/capacity+1'],
 ['w5-planner','(need+cap-1)/cap','need/cap+need%cap==0?0:1'],
 ['ratio','wins/(double)rounds','(double)(wins/rounds)'],
 ['ratio','1.0*wins/rounds','wins*1/rounds'],
 ['remainder','count%size>0','count>size'],
 ['exclusive','(a||b)&&!(a&&b)','a!=b'],
 ['active-call','this.opModeIsActive ( )','running'],
 ['break-statement','break ;','continue;'],
]){assert.equal(expressionAnswer(yes,kind),true,kind+' '+yes);assert.equal(expressionAnswer(no,kind),false,kind+' '+no);}
for(const s of ['process.exit()','globalThis.x=1','need.constructor','need++','true ? (need+cap-1)/cap : false','need/cap;'])assert.equal(expressionAnswer(s,'w5-planner'),false,s);
console.log('PASS W5 content, semantic expressions, safe syntax, editor composition and dynamic question counts');

await initJudge();
for(const p of papers){
 const task=p.lesson.codeTask,good=await judge(task.referenceSource,task);assert.equal(good.points,40,JSON.stringify(good));assert.equal(good.status,'AC');
 // One realistic defect in each distinct program must lose the corresponding points.
 const defects={bottle:['if (fizz > 12) fizz = 12;',''],photo:['poses--; paper--;','poses--;'],light:['count = 0; running = false;','int count = 0; running = false;'],counter:['(double) score / played','score / played'],echo:['System.out.println(shown++);','System.out.println(++shown);'],sound:['case 1: energy += 2;','case 1: energy += 2; break;'],planner:['need / perBox + (need % perBox == 0 ? 0 : 1)','need / perBox + 1'],station:['if (energy == 0 || tickets == 0) on = false;','']};
 const [before,after]=defects[p.key];assert.ok(task.referenceSource.includes(before));const bad=await judge(task.referenceSource.replace(before,after),task);assert.ok(bad.points<40,p.key+' defective source was accepted');
 const empty=await judge(task.starter,task);assert.ok(empty.points<40);assert.notEqual(empty.status,'AC');
 const modified=task.referenceSource.replace(fixedMain(task),'public class Main { public static void main(String[] args) {} }');
 await assert.rejects(judge(modified,task),e=>e.code===400);await assert.rejects(judge(modified,task,true),e=>e.code===400);
 console.log('PASS W5 rubric',p.key,'reference 40/40; defect',bad.points,'; template',empty.points);
}
const task=papers[0].lesson.codeTask;
const unsafe=task.referenceSource.replace('class SaltBottle {','class SaltBottle { static { System.setSecurityManager(null); }');
const denied=await judge(unsafe,task,true);assert.equal(denied.status,'RE');assert.match(denied.message,/access denied|AccessControlException/);
console.log('PASS W5 student execution remains sandboxed, including class initialization');

const data=await mkdtemp(join(tmpdir(),'w5-api-')),base='http://127.0.0.1:5205';let child;
await seedTestAccounts(data);
async function start(){let logs='';child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:'5205',FP_DATA_DIR:data},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);for(let i=0;i<200;i++){if(child.exitCode!==null)throw Error(logs);if(logs.includes('FabulousProgram ·'))return;await delay(100);}throw Error(logs);}
async function stop(){if(child?.exitCode===null)await new Promise(r=>{child.once('exit',r);child.kill();});}
async function api(path,token,body,status=200,method=body?'POST':'GET'){
 const r=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const json=await r.json();assert.equal(r.status,status,path+' '+JSON.stringify(json));return json;
}
try{
 await start();await stop();const file=join(data,'store.json'),db=JSON.parse(await readFile(file,'utf8'));
 const salt=randomBytes(16).toString('hex'),passwordHash=salt+':'+scryptSync('TestMember2026!',salt,64).toString('hex');
 const assignments=Object.fromEntries(papers.map(p=>[p.key,p.key==='bottle'?['test_bottle_1','test_bottle_2','test_bottle_3']:['test_'+p.key]]));
 const members=papers.flatMap(p=>assignments[p.key].map(username=>({id:'w5-test-'+username,username,displayName:username,role:'member',active:true,passwordHash,createdAt:new Date().toISOString()})));
 db.users.push(...members);const oldLessonIds=db.lessons.map(l=>l.id),oldUsers=structuredClone(db.users);
 assert.equal(await importW5(db,root,{assignments}),true);assert.equal(await importW5(db,root,{assignments}),false);assert.deepEqual(db.users,oldUsers);assert.deepEqual(db.lessons.slice(0,oldLessonIds.length).map(l=>l.id),oldLessonIds);
 const tokens=new Map();for(const u of db.users){const token=randomBytes(32).toString('hex');tokens.set(u.id,token);db.sessions.push({hash:createHash('sha256').update(token).digest('hex'),userId:u.id,expires:Date.now()+3600000});}
 await writeFile(file,JSON.stringify(db));await start();const admin=tokens.get('u_admin');
 const assignment=u=>db.lessons.find(l=>l.assignedUserIds?.includes(u.id));
 const w5=db.lessons.filter(l=>l.weekId==='week-5');
 for(const u of members){const boot=await api('/api/bootstrap',tokens.get(u.id));assert.ok(!boot.weeks.some(w=>w.id==='week-5'));await api('/api/lessons/'+assignment(u).id,tokens.get(u.id),null,404);}
 await api('/api/admin/weeks',admin,{id:'week-5',number:5,title:'专项训练',description:'按账号分配专项题',published:true});
 await api('/api/admin/course-settings',admin,{homeWeekId:'week-5'});
 let crossRequests=0;
 for(const u of members){
  const token=tokens.get(u.id),own=assignment(u),boot=await api('/api/bootstrap',token);
  assert.equal(boot.homeWeekId,'week-5');assert.deepEqual(boot.lessons.filter(l=>l.weekId==='week-5').map(l=>l.id),[own.id]);assert.equal(boot.stats.total,oldLessonIds.length+1);
  const read=await api('/api/lessons/'+own.id,token);assert.equal(read.lesson.fillQuestions.length,9);assert.equal(read.lesson.codeTask.answerClass,own.codeTask.answerClass);
  assert.ok(!('assignedUserIds'in read.lesson)&&!('referenceSource'in read.lesson.codeTask)&&!('solution'in read.lesson.codeTask)&&!('variant'in read.lesson.codeTask));assert.ok(read.lesson.codeTask.tests.every(t=>Object.keys(t).length===1));assert.ok(read.lesson.fillQuestions.every(q=>!('accepts'in q)&&!('explanation'in q)&&!('matcher'in q)));
  const source='// draft '+u.username+'\n'+own.codeTask.starter;
  await api('/api/drafts/'+own.id,token,{source,answers:answers(own),userId:'u_admin'},200,'PUT');
  assert.equal((await api('/api/lessons/'+own.id+'?userId=u_admin',token)).draft.source,source);
  for(const other of w5.filter(l=>l.id!==own.id)){
   await api('/api/lessons/'+other.id,token,null,404);
   await api('/api/drafts/'+other.id,token,{source:other.codeTask.starter,answers:answers(other)},404,'PUT');
   await api('/api/progress/'+other.id,token,{},404);
   for(const path of ['/api/run','/api/submit/exercise','/api/submit/fill','/api/submit/code','/api/sim'])await api(path,token,{lessonId:other.id,source:other.codeTask.referenceSource,answers:answers(other),userId:other.assignedUserIds[0]},404);
   crossRequests+=8;
  }
  await api('/api/admin/users',token,null,403);await api('/api/admin/trial',token,{source:own.codeTask.referenceSource,codeTask:own.codeTask},403);
 }
 console.log('PASS W5 all 10 accounts see exactly one assigned paper;',crossRequests,'cross-paper requests rejected');
 // Shared default content must still have completely separate drafts and attempts.
 const defaults=members.filter(u=>assignment(u).id==='w5-special-bottle');
 for(const u of defaults){const read=await api('/api/lessons/w5-special-bottle',tokens.get(u.id));assert.match(read.draft.source,new RegExp('draft '+u.username));}
 const renamed=members.find(u=>u.username==='test_photo'),renameToken=tokens.get(renamed.id);
 await api('/api/auth/profile',renameToken,{username:'renamed_pat',displayName:'改名后'});assert.equal((await api('/api/lessons/'+assignment(renamed).id,renameToken)).lesson.id,assignment(renamed).id);
 const outsider=(await api('/api/admin/users',admin,{username:'not_assigned',displayName:'未分配账号',password:'TestMember2026!'},201)).user;
 const outsiderToken=(await api('/api/auth/login',null,{username:outsider.username,password:'TestMember2026!'})).token;
 assert.equal((await api('/api/bootstrap',outsiderToken)).lessons.filter(l=>l.weekId==='week-5').length,0);await api('/api/lessons/w5-special-bottle',outsiderToken,null,404);
 for(const p of papers){
  const u=members.find(u=>assignment(u).id===p.lesson.id),token=tokens.get(u.id),l=assignment(u);
  await api('/api/submit/exercise',token,{lessonId:l.id,answers:{},source:l.codeTask.referenceSource},400);
  const source=l.codeTask.referenceSource;
  const run=await api('/api/run',token,{lessonId:l.id,source});assert.equal(run.status,'RUN');assert.equal(run.output.trimEnd(),l.codeTask.sampleOutput);assert.equal((await api('/api/submissions',token)).submissions.length,0);
  const pending=api('/api/submit/exercise',token,{lessonId:l.id,answers:answers(l),source});await delay(80);
  await api('/api/submit/exercise',token,{lessonId:l.id,answers:answers(l),source},409);
  const r=await pending;assert.equal(r.score,100,JSON.stringify(r));assert.equal(r.scoring.programmingPoints,40);assert.equal(r.solutions.length,9);assert.equal(r.programmingSolution.source,source);assert.equal(r.acContribution.score,100);assert.equal(r.progress.exerciseSubmitted,true);
  assert.equal((await api('/api/lessons/'+l.id,token)).exerciseResult.score,100);
  await api('/api/drafts/'+l.id,token,{source,answers:answers(l)},409,'PUT');for(const endpoint of ['exercise','fill','code'])await api('/api/submit/'+endpoint,token,{lessonId:l.id,source,answers:answers(l)},409);
  const submissions=(await api('/api/submissions?scope=all&userId=u_admin',token)).submissions;assert.equal(submissions.length,1);assert.equal(submissions[0].userId,u.id);
 }
 // A second default member can submit independently; a compile error is a real, zero-programming score.
 const ceUser=defaults[1],ceToken=tokens.get(ceUser.id),bottle=assignment(ceUser);
 assert.equal((await api('/api/lessons/'+bottle.id,ceToken)).exerciseResult,null);
 const ce=await api('/api/submit/exercise',ceToken,{lessonId:bottle.id,answers:answers(bottle),source:'class SaltBottle {}\n'+fixedMain(bottle.codeTask)});
 assert.equal(ce.programming.status,'CE');assert.equal(ce.score,60);assert.equal(ce.progress.exerciseSubmitted,true);
 assert.equal((await api('/api/lessons/'+assignment(defaults[2]).id,tokens.get(defaults[2].id))).exerciseResult,null);
 const adminMembers=(await api('/api/admin/users',admin)).users;
 for(const u of members)assert.equal(adminMembers.find(a=>a.id===u.id).learning.total,oldLessonIds.length+1);
 assert.equal((await api('/api/bootstrap',admin)).lessons.filter(l=>l.weekId==='week-5').length,8);
 await stop();await start();
 for(const u of members){const boot=await api('/api/bootstrap',tokens.get(u.id));assert.deepEqual(boot.lessons.filter(l=>l.weekId==='week-5').map(l=>l.id),[assignment(u).id]);}
 assert.equal((await api('/api/lessons/'+assignment(renamed).id,renameToken)).exerciseResult.score,100);
 console.log('PASS W5 8 full grading paths, once-only races, shared-bank draft/grade isolation, CE completion, ID-bound renames, unassigned denial, admin review and restart persistence');
}finally{await stop();await rm(data,{recursive:true,force:true});}
