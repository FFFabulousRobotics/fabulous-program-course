import assert from 'node:assert/strict';
import {lessonAcScore,submissionStats,lessonCompleted} from '../src/learning-results.mjs';
import {exerciseFeedback} from '../public/practice.js';
const w4={id:'w4',acScoring:'first-score',exerciseOnly:true,submissionLimit:1,fillQuestions:[{}],codeTask:{}};
const attempt=(id,score,day=1)=>({userId:'u',lessonId:id,kind:'exercise',score,status:score===100?'AC':'WA',createdAt:'2026-10-'+String(day).padStart(2,'0')});
for(const score of [0,40,66,94,96,100]){
 const s=lessonAcScore([attempt('w4',score)],w4);
 assert.equal(s.score,score);assert.equal(s.bonus,0);assert.equal(s.mode,'first-score');
 assert.equal(submissionStats([attempt('w4',score)],[w4]).rate,score);
}
assert.equal(lessonAcScore([attempt('w4',100,2),attempt('w4',40)],w4).score,40,'A later record cannot replace the first raw score');
assert.equal(submissionStats([],[w4]).rate,null);
const old={id:'old',fillQuestions:[{}]};
assert.equal(lessonAcScore([attempt('old',80)],old).score,56);
assert.equal(submissionStats([attempt('old',80),attempt('w4',96)],[old,w4]).rate,76);
assert.equal(lessonCompleted(w4,{exerciseSubmitted:true,exercisePassed:false}),true);
const html=exerciseFeedback({submissionLimit:1,score:96,firstScore:96,scoring:{knowledgePoints:56,knowledgeWeight:60,programmingPoints:40,programmingWeight:40},acContribution:lessonAcScore([attempt('w4',96)],w4)},s=>s,()=>'',{inline:true});
assert.ok(html.includes('96 / 100'));assert.ok(html.includes('直接使用首次原始得分'));assert.ok(!html.includes('× 0.7'));
console.log('PASS: W4 raw first score, no weighting/bonus, zero/full/partial grades, immutable first score, mixed legacy averages and UI explanation');

const {buildW4}=await import('../src/w4-import.mjs');
const lesson=await buildW4(new URL('..',import.meta.url).pathname);
assert.equal(lesson.estimate,'建议20分钟');assert.equal(lesson.acScoring,'first-score');
