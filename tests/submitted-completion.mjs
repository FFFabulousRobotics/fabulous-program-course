import assert from 'node:assert/strict';
import {lessonCompleted,backfillSubmittedExercises,submissionStats} from '../src/learning-results.mjs';
import {memberProgress} from '../src/member-progress.mjs';
const w4={id:'w4',weekId:'week-4',position:1,code:'W4',exerciseOnly:true,submissionLimit:1,fillQuestions:[{id:"q",accepts:["A"]}],codeTask:{},published:true};
const old={...w4,id:'old',exerciseOnly:false,submissionLimit:undefined};
const data={weeks:[{id:'week-4',number:4,published:true}],lessons:[w4,old],progress:[],drafts:[],submissions:[]};
assert.equal(lessonCompleted(w4,{}),false);assert.equal(lessonCompleted(w4,{read:true}),false);
assert.equal(lessonCompleted(w4,{exerciseSubmitted:true,exercisePassed:false}),true);
assert.equal(lessonCompleted(old,{exerciseSubmitted:true,exercisePassed:false}),false);
assert.equal(lessonCompleted(old,{exercisePassed:true}),true);
for(const [i,score,status] of [[0,0,'CE'],[1,96,'WA'],[2,100,'AC']])data.submissions.push({id:'s'+i,userId:'u'+i,lessonId:'w4',kind:'exercise',score,status,createdAt:'2026-10-01'});
data.submissions.push({userId:'partial',lessonId:'w4',kind:'fill',score:100,status:'AC'});
data.submissions.push({userId:'legacy',lessonId:'old',kind:'exercise',score:90,status:'WA'});
data.progress.push({userId:'u1',lessonId:'w4',exercisePassed:false,fillPassed:false,codePassed:true,updatedAt:'unchanged'});
const scores=JSON.stringify(data.submissions),acBefore=data.submissions.slice(0,3).map(s=>submissionStats([s],[w4]));
assert.equal(backfillSubmittedExercises(data),3);assert.equal(backfillSubmittedExercises(data),0);
assert.equal(JSON.stringify(data.submissions),scores);
assert.equal(data.progress.find(p=>p.userId==='u1').exercisePassed,false);
assert.equal(data.progress.find(p=>p.userId==='u1').updatedAt,'unchanged');
for(let i=0;i<3;i++){
 assert.equal(memberProgress(data,{id:'u'+i},{details:true}).accepted,1);
 assert.equal(memberProgress(data,{id:'u'+i},{details:true}).weeks[0].lessons.find(l=>l.id==='w4').complete,true);
 assert.deepEqual(submissionStats([data.submissions[i]],[w4]),acBefore[i]);
}
assert.equal(memberProgress(data,{id:'partial'}).accepted,0);
assert.equal(memberProgress(data,{id:'legacy'}).accepted,0);
console.log('PASS: single-submit papers complete at any score; backfill is idempotent; old-course rules, grading and AC are unchanged; member/admin counts agree.');
