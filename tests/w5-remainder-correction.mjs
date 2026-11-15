import assert from 'node:assert/strict';
import {buildW5} from '../src/w5-import.mjs';
import {correctW5Remainder,remainderQuestionId,oldRemainderPrompt,remainderPrompt,remainderExplanation} from '../src/w5-remainder-correction.mjs';
import {correctAnswer,gradeQuestions} from '../src/questions.mjs';
import {combineExercise,exerciseReview,lessonAcScore,submissionStats} from '../src/learning-results.mjs';
import {expressionAnswer} from '../src/expression-answer.mjs';

for(const expression of ['count % size != 0','count % size == 0 ? false : true','count % size != 0 ? true : false','!(count % size == 0)','count > 0 && count % size != 0','count % size > 0','count / size * size != count','count % size == 0 ? false : (count > 0 ? true : false)'])assert.equal(expressionAnswer(expression,'remainder'),true,expression);
for(const expression of ['count % size == 0 ? true : false','true','false','count % size','count % size == 0 ? false : 1','true ? count % size != 0 : 1','count < 1001 && count % size != 0','count % size != 0;','Math.floor(count / size) > 0','process.exit()','size > 0 || count % size != 0'])assert.equal(expressionAnswer(expression,'remainder'),false,expression);
assert.equal(expressionAnswer('a == true && b == false || a == false && b == true','exclusive'),false,'Other questions retain explicit symbol restrictions');

const {papers}=await buildW5(new URL('..',import.meta.url).pathname);
for(const {lesson:l} of papers)assert.equal(gradeQuestions(l.fillQuestions,Object.fromEntries(l.fillQuestions.map(q=>[q.id,q.accepts[0]]))).points,60);
const lesson=structuredClone(papers.find(p=>p.key==='planner').lesson),qid=remainderQuestionId;
lesson.fillQuestions.find(q=>q.id===qid).prompt=oldRemainderPrompt;
function record(user,answer,{otherWrong=false,alreadyCorrect=false}={}){
 const answers=Object.fromEntries(lesson.fillQuestions.map(q=>[q.id,q.accepts[0]]));answers[qid]=answer;
 const details=lesson.fillQuestions.map((q,i)=>({id:q.id,correct:(q.id===qid?alreadyCorrect:!(otherWrong&&i===0)),points:(q.id===qid?alreadyCorrect:!(otherWrong&&i===0))?q.points:0,maxPoints:q.points}));
 const passed=details.filter(d=>d.correct).length,points=details.reduce((s,d)=>s+d.points,0);
 const knowledge={details,passed,total:9,points,maxPoints:60,score:Math.round(points/60*10000)/100,status:passed===9?'AC':'WA'};
 const programming={status:'AC',score:100,points:40,maxPoints:40,passed:6,total:6,cases:[{name:'unchanged-programming'}]};
 const result=combineExercise(knowledge,programming,lesson.scoring);
 return {id:'record-'+user,userId:user,lessonId:lesson.id,...result,firstScore:result.score,firstStatus:result.status,attemptCount:1,answers,source:'original source '+user,createdAt:'2026-10-16T14:17:16.906Z',questions:lesson.fillQuestions.map(q=>({...q,correctAnswers:q.accepts}))};
}
const submissions=[record('affected','count % size == 0 ? false : true'),record('partial','!(count % size == 0)',{otherWrong:true}),record('incorrect','count % size == 0'),record('already','count % size != 0',{alreadyCorrect:true}),{id:'unrelated',userId:'other',lessonId:'w4-national-practice',score:90,source:'original'}];
const db={lessons:[lesson],submissions,progress:submissions.slice(0,4).map(s=>({userId:s.userId,lessonId:lesson.id,read:false,fillPassed:s.knowledge.status==='AC',codePassed:true,exercisePassed:s.status==='AC',exerciseSubmitted:true,updatedAt:s.createdAt})),users:[],imports:{w5:{digest:'old'}},contentCorrections:{existing:{keep:true}}};
const before=structuredClone(db),changes=correctW5Remainder(db,{at:'2026-10-16T14:30:00Z',digest:'new'});
assert.deepEqual(changes.map(c=>[c.userId,c.before,c.after]),[['affected',90,100],['partial',86,96]]);
for(let i=0;i<db.submissions.length;i++){
 assert.deepEqual(db.submissions[i].answers,before.submissions[i].answers);
 assert.equal(db.submissions[i].source,before.submissions[i].source);
 assert.equal(db.submissions[i].createdAt,before.submissions[i].createdAt);
 assert.deepEqual(db.submissions[i].programming,before.submissions[i].programming);
}
assert.deepEqual(db.submissions.slice(2),before.submissions.slice(2));
const fixed=db.submissions[0];assert.equal(fixed.score,100);assert.equal(fixed.firstScore,100);assert.equal(fixed.status,'AC');assert.equal(fixed.firstStatus,'AC');assert.equal(fixed.knowledge.points,60);assert.equal(fixed.knowledge.passed,9);assert.equal(fixed.scoring.programmingPoints,40);assert.equal(fixed.scoreAdjustments[0].points,10);
assert.equal(fixed.details.find(d=>d.id===qid).correct,true);assert.equal(fixed.knowledge.details.find(d=>d.id===qid).points,10);
assert.equal(db.submissions[1].details[0].correct,false);assert.equal(db.submissions[1].status,'WA');assert.equal(db.submissions[1].firstScore,96);
assert.equal(lessonAcScore(db.submissions.filter(s=>s.userId==='affected'),lesson).score,100);
assert.equal(submissionStats(db.submissions.filter(s=>s.userId==='affected'),[lesson]).rate,100);
assert.equal(exerciseReview(db,'affected',lesson).firstScore,100);
const progress=db.progress.find(p=>p.userId==='affected');assert.equal(progress.fillPassed,true);assert.equal(progress.exercisePassed,true);assert.equal(progress.exerciseSubmitted,true);assert.equal(progress.updatedAt,before.progress[0].updatedAt);
const q=lesson.fillQuestions.find(q=>q.id===qid);assert.equal(q.prompt,remainderPrompt);assert.equal(q.explanation,remainderExplanation);assert.equal(correctAnswer(q,'count % size == 0 ? false : true'),true);
assert.equal(db.imports.w5.digest,'new');assert.deepEqual(db.contentCorrections.existing,{keep:true});
const after=structuredClone(db);assert.deepEqual(correctW5Remainder(db),[]);assert.deepEqual(db,after);
const custom=structuredClone(before);custom.lessons[0].fillQuestions.find(q=>q.id===qid).prompt='管理员定制题目';assert.throws(()=>correctW5Remainder(custom),/题目已变化|题已变化/);
console.log('PASS W5 remainder: equivalent ternaries/logic, Java type and range checks, unsafe input rejection, targeted +10 correction, original answer/source/time/programming preserved, first score/AC/progress, other users unchanged and idempotence');
