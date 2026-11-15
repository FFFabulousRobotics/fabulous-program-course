import assert from 'node:assert/strict';
import {submissionStats,firstAttempts,lessonAcScore} from '../src/learning-results.mjs';

const lessons=Array.from({length:8},(_,i)=>({id:'l'+i,fillQuestions:[{}],codeTask:null}));
const attempt=(id,score,createdAt='2026-01-01')=>({userId:'u',lessonId:id,kind:'exercise',score,status:score===100?'AC':'WA',createdAt});
const scores=[80,50,50,87.5,100,100,100,100];
const records=scores.map((score,i)=>attempt('l'+i,score));
const stats=submissionStats(records,lessons);
assert.equal(stats.firstScoreTotal,667.5);assert.equal(stats.acScoreTotal,587.25);assert.equal(stats.rate,73.41);
assert.equal(submissionStats([attempt('l0',100)],lessons).rate,100,'One scored exercise is the whole denominator, regardless of unattempted lessons');
assert.equal(submissionStats([attempt('l0',100)],lessons).scoredExercises,1);
assert.equal(submissionStats([attempt('l0',100),attempt('l1',0)],lessons).rate,50,'A scored zero must count in the denominator');
assert.equal(submissionStats([attempt('l0',40)],lessons).rate,28,'Unfinished scored exercises earn 70% of their first score and no bonus');
const secondPerfect=[attempt('l0',100,'2026-01-02'),attempt('l0',40)];
assert.equal(submissionStats(secondPerfect,lessons).rate,55,'Retries belong to the same scored exercise');
assert.equal(submissionStats(secondPerfect,lessons).scoredExercises,1);
assert.deepEqual(lessonAcScore(secondPerfect,lessons[0]),{firstScore:40,submissions:2,firstPerfectAttempt:2,baseScore:28,bonus:27,score:55});
assert.equal(lessonAcScore([attempt('l0',100,'2026-01-03'),...secondPerfect],lessons[0]).score,55,'More perfect submissions must not reduce the frozen bonus');
assert.equal(lessonAcScore([attempt('l0',0,'2026-01-04'),...secondPerfect],lessons[0]).score,55,'Failures after the first perfect do not change n');
assert.equal(lessonAcScore([attempt('l0',100)],lessons[0]).score,100,'First-try perfection must remain 100');
for(const n of [10,11,12]){
 const many=Array.from({length:n},(_,i)=>attempt('l0',i===n-1?100:40,'2026-01-'+String(i+1).padStart(2,'0'))).reverse();
 const result=lessonAcScore(many,lessons[0]);assert.equal(result.firstPerfectAttempt,n);assert.equal(result.bonus,n===10?3:0);assert.equal(result.score,n===10?31:28);
}
assert.equal(submissionStats([],lessons).rate,null);assert.equal(submissionStats([],lessons).scoredExercises,0);assert.equal(submissionStats([],[]).rate,null);
assert.equal(submissionStats(records,[...lessons,{id:'unattempted',fillQuestions:[{}]}]).rate,stats.rate,'Publishing more unattempted exercises does not dilute AC rate');
assert.equal(submissionStats([...records,attempt('hidden',100)],lessons).rate,73.41,'Hidden/deleted lessons cannot add numerator points');
const mixed=[{id:'mixed',fillQuestions:[{}],codeTask:{}}];
const legacy=[{userId:'u',lessonId:'mixed',kind:'fill',score:83,status:'WA',passed:5,total:6,createdAt:'2026-01-01'}];
assert.equal(submissionStats(legacy,mixed).rate,29.05,'Historical partial scores are weighted by 70% without a perfect bonus');
legacy.unshift({userId:'u',lessonId:'mixed',kind:'code',score:100,status:'AC',createdAt:'2026-01-02'});
assert.equal(submissionStats(legacy,mixed).rate,64.05);
legacy.unshift({userId:'u',lessonId:'mixed',kind:'fill',score:100,status:'AC',createdAt:'2026-01-03'});
assert.equal(submissionStats(legacy,mixed).rate,91.05);assert.equal(lessonAcScore(legacy,mixed[0]).firstPerfectAttempt,2);
const split=(kind,score,day)=>({userId:'u',lessonId:'mixed',kind,score,status:score===100?'AC':'WA',createdAt:`2026-01-${String(day).padStart(2,'0')}`});
for(const kinds of [['fill','code'],['code','fill']]){
 const once=[split(kinds[1],100,2),split(kinds[0],100,1)];
 const score=lessonAcScore(once,mixed[0]);assert.equal(score.score,100);assert.equal(score.firstPerfectAttempt,1);assert.equal(score.submissions,2,'Keep both original submission records');
 assert.equal(lessonAcScore([split(kinds[0],0,3),...once],mixed[0]).score,100,'Later failures do not change the first perfect bonus');
 const retries=[split(kinds[1],100,4),split(kinds[0],100,3),split(kinds[1],40,2),split(kinds[0],40,1)];
 assert.equal(lessonAcScore(retries,mixed[0]).firstPerfectAttempt,3,'Every retry in either component must count');
 const samePart=[split(kinds[1],100,3),split(kinds[0],100,2),split(kinds[0],40,1)];
 assert.equal(lessonAcScore(samePart,mixed[0]).firstPerfectAttempt,2);
}
const unifiedPerfect={userId:'u',lessonId:'mixed',kind:'exercise',score:100,status:'AC',createdAt:'2026-01-03',knowledge:{score:100,status:'AC'},programming:{score:100,status:'AC'}};
assert.equal(lessonAcScore([unifiedPerfect,split('fill',40,1)],mixed[0]).firstPerfectAttempt,2,'A new unified submission does not merge with an old component');
const unifiedFail={...unifiedPerfect,status:'WA',score:40,createdAt:'2026-01-01',knowledge:{score:40},programming:{score:40}};
assert.equal(lessonAcScore([split('code',100,3),split('fill',100,2),unifiedFail],mixed[0]).firstPerfectAttempt,3,'Do not create another free component pair after unified submissions');
const saved={...attempt('l0',83),knowledge:{score:83,passed:5,total:6,status:'WA'},programming:null};
assert.equal(firstAttempts([saved],lessons)[0].score,83,'Do not recalculate an already-saved unified score');
assert.equal(submissionStats([saved],lessons).rate,58.1);
console.log('PASS: 70% first score + bonus using (n-1), first-try 100, no bonus before perfection, frozen first-perfect attempt, zero floor, legacy chronology, unsubmitted courses and precision');
