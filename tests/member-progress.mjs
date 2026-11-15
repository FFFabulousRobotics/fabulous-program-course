import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {scryptSync} from 'node:crypto';
import {lessons,curriculumVersion} from '../src/curriculum.mjs';
import {memberProgress} from '../src/member-progress.mjs';
import {filterMembers,memberRows,memberLearningView,memberGroups} from '../public/member-views.js';
import {usersView,userSubmissionsView} from '../public/course-views.js';

const password='PreviewOnly123',hash='fixture:'+scryptSync(password,'fixture',64).toString('hex');
const users=[{id:'admin',username:'admin',displayName:'管理预览',role:'admin',owner:true,active:true},
 {id:'learner',username:'learner',displayName:'进度示例',role:'member',active:true},
 {id:'new',username:'new_member',displayName:'尚未开始',role:'member',active:true},
 {id:'disabled',username:'disabled',displayName:'停用成员',role:'member',active:false}].map(u=>({...u,passwordHash:hash}));
const db={version:2,curriculumVersion,courseStructureVersion:1,weekPublicationVersion:1,knowledgeChoicesVersion:1,materialOrderVersion:1,users,
 weeks:[{id:'week-1',number:1,code:'W1',title:'Java 与机器人程序',published:true},{id:'week-2',number:2,code:'W2',title:'阅读拓展',published:true},{id:'hidden',number:3,code:'W3',title:'草稿周',published:false}],
 courseSettings:{homeWeekId:'week-1'},materials:[],drafts:[],compilerDrafts:[],
 lessons:[...structuredClone(lessons).map((l,i)=>({...l,weekId:'week-1',position:i+1})),{id:'reading',weekId:'week-2',position:1,code:'W2.1',title:'阅读教程',content:'阅读内容',published:true,fillQuestions:[],codeTask:null},{id:'hidden',weekId:'hidden',position:1,code:'W3.1',title:'草稿',content:'草稿内容',published:false,fillQuestions:[{}],codeTask:null}],
 progress:[{userId:'learner',lessonId:'w1-01',exercisePassed:true,fillPassed:true,read:false},{userId:'learner',lessonId:'w1-02',read:true,fillPassed:true},{userId:'learner',lessonId:'reading',read:true}],
 submissions:[{id:'retry',userId:'learner',lessonId:'w1-01',lessonTitle:lessons[0].title,kind:'exercise',score:100,status:'AC',createdAt:'2026-09-25T12:00:00Z',knowledge:{score:100,status:'AC',total:5,passed:5}},
 {id:'partial',userId:'learner',lessonId:'w1-02',lessonTitle:lessons[1].title,kind:'fill',score:100,status:'AC',createdAt:'2026-09-25T11:00:00Z'},
 {id:'zero',userId:'learner',lessonId:'w1-01',lessonTitle:lessons[0].title,kind:'exercise',score:0,status:'WA',createdAt:'2026-09-25T10:00:00Z',knowledge:{score:0,status:'WA',total:5,passed:0}},
 {id:'secret',userId:'learner',lessonId:'hidden',kind:'exercise',score:100,status:'AC',createdAt:'2026-09-24T10:00:00Z'}]};
const learning=memberProgress(db,users[1],{details:true});
assert.equal(learning.total,5);assert.equal(learning.accepted,2);assert.equal(learning.read,2);
assert.equal(learning.rate,31);assert.equal(learning.scoredExercises,2);assert.equal(learning.submissions,3);
assert.equal(learning.weeks.length,2);
const first=learning.weeks[0].lessons[0];assert.equal(first.firstScore,0);assert.equal(first.latestScore,100);assert.equal(first.acScore,27);
assert.equal(learning.weeks[0].lessons[1].latestScore,null);assert.equal(learning.weeks[0].lessons[1].firstScore,50);
assert.equal(memberProgress(db,users[2]).rate,null);
const listed=users.map(u=>({...u,learning:memberProgress(db,u)}));
assert.deepEqual(filterMembers(listed,{query:'LEARNER'}).map(u=>u.id),['learner']);
assert.deepEqual(filterMembers(listed,{role:'member',status:'inactive'}).map(u=>u.id),['disabled']);
assert.equal(filterMembers(listed,{role:'member',sort:'rate'})[0].id,'learner');
assert.equal(filterMembers(listed,{role:'member',sort:'progress'})[0].id,'learner');
assert.ok(memberLearningView(learning).includes('首次得分'));
assert.equal(filterMembers(listed)[0].id,'admin');
assert.equal(filterMembers(listed)[1].id,'learner');
const adminGroup=memberGroups(listed.filter(u=>u.role==='admin'),users[0]);
assert.ok(!adminGroup.includes('AC 率'));assert.ok(!adminGroup.includes('member-rate'));assert.ok(!adminGroup.includes('<progress'));
assert.ok(adminGroup.includes('查看提交'));
assert.ok(!userSubmissionsView({user:users[0],learning,submissions:[]},()=> '').includes('AC 率'));
const sorted=filterMembers([{...listed[1],id:'zero',learning:{rate:0}},{...listed[1],id:'none',learning:{rate:null}},{...listed[1],id:'high',learning:{rate:90}}]);
assert.deepEqual(sorted.map(u=>u.id),['high','zero','none']);

assert.ok(memberRows([{...listed[1],displayName:'<script>bad</script>'}],users[0]).includes('&lt;script&gt;'));
assert.ok(usersView(listed,users[0]).includes('id="user-search"'));
assert.ok(userSubmissionsView({user:users[1],learning,submissions:[]},()=> '').includes('首次得分'));

const data=await mkdtemp(join(tmpdir(),'fp-member-progress-'));await writeFile(join(data,'store.json'),JSON.stringify(db));
let child,base;
async function api(path,token){const r=await fetch(base+path,{headers:token?{Authorization:'Bearer '+token}:{}});return {status:r.status,body:await r.json()};}
try{
 let logs='';
 child=spawn(process.execPath,['--input-type=module','-e',"import {server} from './src/server.mjs';if(!server.listening)await new Promise(r=>server.once('listening',r));console.log('MEMBER_PORT='+server.address().port);"],{env:{...process.env,PORT:'0',FP_DATA_DIR:data},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 for(let i=0;i<100;i++){const port=logs.match(/MEMBER_PORT=(\d+)/)?.[1];if(port){base='http://127.0.0.1:'+port;break;}if(child.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,100));}assert.ok(base,logs);
 const login=async username=>{const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});assert.equal(r.status,200);return (await r.json()).token;};
 const admin=await login('admin'),member=await login('learner');
 assert.equal((await api('/api/admin/users',member)).status,403);
 assert.equal((await api('/api/admin/users/learner/submissions',member)).status,403);
 assert.equal((await api('/api/admin/users',null)).status,401);
 const overview=await api('/api/admin/users',admin);assert.equal(overview.status,200);assert.ok(overview.body.users.every(u=>!u.passwordHash));
 const stats=overview.body.users.find(u=>u.id==='learner').learning;
 const own=(await api('/api/bootstrap',member)).body.stats;
 for(const key of ['rate','accepted','total','submissions','scoredExercises'])assert.equal(stats[key],own[key],key);
 const detail=await api('/api/admin/users/learner/submissions',admin);assert.equal(detail.status,200);assert.equal(detail.body.learning.rate,31);assert.equal(detail.body.submissions.length,4);
 assert.equal(detail.body.learning.weeks.flatMap(w=>w.lessons).length,5);
 assert.equal((await api('/api/admin/users/missing/submissions',admin)).status,404);
 console.log('PASS: published-only progress, member/admin metric parity, zero vs unsubmitted, legacy partial grades, retries, search/sort/status filters, escaping and admin-only access');
 if(process.env.FP_MEMBER_PREVIEW==='1'){console.log(JSON.stringify({preview:base,pid:process.pid}));await new Promise(r=>process.once('SIGTERM',r));}
}finally{if(child?.exitCode===null)await new Promise(r=>{child.once('exit',r);child.kill();});await rm(data,{recursive:true,force:true});}
