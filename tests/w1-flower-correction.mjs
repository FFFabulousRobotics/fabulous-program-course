import assert from 'node:assert/strict';
import {correctW1Flower,oldFlowerPrompt,oldFlowerRule,flowerPrompt,flowerExplanation} from '../src/w1-flower-correction.mjs';
import {combineExercise,lessonAcScore,exerciseReview} from '../src/learning-results.mjs';
import {correctAnswer,validateQuestions} from '../src/questions.mjs';
import {lessons} from '../src/curriculum.mjs';
const questions=['auto','teleop','hive','score','phase'].map(id=>({id,prompt:id==='score'?oldFlowerPrompt:id,accepts:[id==='score'?'46':'yes']}));
const knowledge=wrong=>{const details=questions.map(q=>({id:q.id,correct:!wrong.includes(q.id)})),passed=details.filter(q=>q.correct).length;return {details,passed,total:5,score:passed*20,status:passed===5?'AC':'WA'};};
const make=(id,userId,kind,wrong,day)=>({id,userId,lessonId:'w1-01',createdAt:`2026-09-${day}T00:00:00Z`,kind,...(kind==='fill'?knowledge(wrong):combineExercise(knowledge(wrong),null)),answers:{score:'40'},questions:questions.map(q=>({...q,correctAnswers:q.accepts})),source:''});
const db={users:[{id:'u'},{id:'v'},{id:'other'}],lessons:[{id:'w1-01',content:oldFlowerRule,fillQuestions:questions,codeTask:null}],progress:[],
 submissions:[make('retry','u','exercise',[],'22'),make('first','u','exercise',['score'],'21'),make('legacy','v','fill',['score','phase'],'20'),make('ok','other','fill',[],'19')]};
delete db.submissions[2].answers;delete db.submissions[2].questions;
const original=structuredClone(db),changes=correctW1Flower(db,'2026-09-26T00:00:00Z');
assert.equal(changes.length,2);assert.equal(db.submissions.length,original.submissions.length);
assert.equal(db.submissions[1].score,100);assert.equal(db.submissions[1].knowledge.score,100);assert.equal(db.submissions[1].status,'AC');
assert.equal(db.submissions[0].firstScore,100);assert.equal(lessonAcScore(db.submissions.filter(s=>s.userId==='u'),db.lessons[0]).score,100);
assert.equal(exerciseReview(db,'u',db.lessons[0]).firstScore,100);
assert.equal(db.submissions[2].score,80);assert.equal(db.submissions[2].status,'WA');assert.equal(db.submissions[2].details.find(d=>d.id==='phase').correct,false);
assert.deepEqual(db.submissions[3],original.submissions[3]);
for(let i=0;i<db.submissions.length;i++){assert.deepEqual(db.submissions[i].answers,original.submissions[i].answers);assert.equal(db.submissions[i].createdAt,original.submissions[i].createdAt);}
assert.equal(db.progress.find(p=>p.userId==='u').exercisePassed,true);assert.equal(db.progress.find(p=>p.userId==='v').exercisePassed,false);
const question=db.lessons[0].fillQuestions.find(q=>q.id==='score');assert.equal(question.prompt,flowerPrompt);assert.equal(question.explanation,flowerExplanation);
assert.equal(correctAnswer(question,'46'),true);assert.equal(correctAnswer(question,'40'),false);validateQuestions(db.lessons[0].fillQuestions);
assert.equal(lessons[0].fillQuestions.find(q=>q.id==='score').prompt,flowerPrompt);
const done=structuredClone(db);assert.deepEqual(correctW1Flower(db),[]);assert.deepEqual(db,done);
const customized=structuredClone(original);customized.lessons[0].fillQuestions[3].prompt='管理员自定义题干';assert.throws(()=>correctW1Flower(customized),/已变化/);
console.log('PASS: explicit scoring conditions, original answers preserved, ambiguity-only credit, first-score/bonus/progress correction, legacy records, unrelated users and idempotence');
