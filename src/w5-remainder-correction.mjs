import {correctAnswer} from './questions.mjs';
import {combineExercise,firstAttempts} from './learning-results.mjs';

export const remainderQuestionId='w5-planner-q09';
export const oldRemainderPrompt='count>=0、size>0。只填boolean表达式，表示装箱后最后一箱未装满且确实有余数。只用count、size、整数常量及已学算术和比较运算。';
export const remainderPrompt='count>=0、size>0。只填boolean表达式，表示装箱后最后一箱未装满且确实有余数。可用count、size、整数或boolean常量，以及已学算术、比较、逻辑和三元运算；不得调用方法。逻辑等价且符合这些限制的表达式均可得分。';
export const remainderExplanation='余数不为0表示有不满的一箱；count为0或整除时为false。count % size != 0、!(count % size == 0)和count % size == 0 ? false : true逻辑等价，均可得分。';
const reason='W5余数判断题放宽为接受已学的等价boolean表达式，补回原规则拦截的正确答案分数';

export function correctW5Remainder(db,{at=new Date().toISOString(),digest}={}){
 if(db.contentCorrections?.w5RemainderV1)return [];
 const lesson=db.lessons.find(l=>l.id==='w5-special-planner'),q=lesson?.fillQuestions.find(q=>q.id===remainderQuestionId);
 if(!q||q.matcher!=='remainder'||q.points!==10||![oldRemainderPrompt,remainderPrompt].includes(q.prompt))throw Error('W5余数题已变化，请先核对题目，拒绝覆盖');
 const changes=[],originalQuestion=structuredClone(q),previousDigest=db.imports?.w5?.digest;
 for(const record of db.submissions){
  if(record.lessonId!==lesson.id||record.kind!=='exercise')continue;
  const knowledge=record.knowledge,detail=knowledge?.details?.find(d=>d.id===q.id);
  if(!detail||detail.correct||!correctAnswer(q,record.answers?.[q.id]))continue;
  if(detail.maxPoints!==10||detail.points!==0||knowledge.total!==knowledge.details.length||knowledge.maxPoints!==60||knowledge.details.some(d=>!Number.isFinite(d.points)||!Number.isFinite(d.maxPoints)))throw Error('W5历史分项不一致：'+record.id);
  const details=knowledge.details.map(d=>d.id===q.id?{...d,correct:true,points:d.maxPoints}:d);
  const points=details.reduce((n,d)=>n+d.points,0),passed=details.filter(d=>d.correct).length;
  const corrected={...knowledge,details,points,passed,score:Math.round(points/knowledge.maxPoints*10000)/100,status:passed===knowledge.total?'AC':'WA'};
  const before=record.score;
  Object.assign(record,combineExercise(corrected,record.programming,record.scoring||lesson.scoring));
  record.scoreAdjustments||=[];record.scoreAdjustments.push({id:'w5RemainderV1',reason,questionId:q.id,previousScore:before,points:record.score-before,at});
  const snapshot=record.questions?.find(x=>x.id===q.id);
  if(snapshot){record.scoreAdjustments.at(-1).previousQuestion=structuredClone(snapshot);Object.assign(snapshot,{prompt:remainderPrompt,explanation:remainderExplanation});}
  changes.push({id:record.id,userId:record.userId,before,after:record.score});
 }
 Object.assign(q,{prompt:remainderPrompt,explanation:remainderExplanation});
 for(const userId of new Set(changes.map(c=>c.userId))){
  const records=db.submissions.filter(r=>r.userId===userId&&r.lessonId===lesson.id),first=firstAttempts(records,[lesson])[0];
  for(const r of records.filter(r=>r.kind==='exercise'))Object.assign(r,{firstScore:first.score,firstStatus:first.status});
  let p=db.progress.find(p=>p.userId===userId&&p.lessonId===lesson.id);
  if(!p){p={userId,lessonId:lesson.id,read:false,updatedAt:at};db.progress.push(p);}
  Object.assign(p,{exerciseSubmitted:true,fillPassed:!!p.fillPassed||records.some(r=>r.knowledge?.status==='AC'),codePassed:!!p.codePassed||records.some(r=>r.programming?.status==='AC'),exercisePassed:!!p.exercisePassed||records.some(r=>r.status==='AC')});
 }
 if(digest&&db.imports?.w5)db.imports.w5.digest=digest;
 db.contentCorrections||={};db.contentCorrections.w5RemainderV1={at,reason,questionId:q.id,originalQuestion,previousDigest,digest:digest||previousDigest,correctedSubmissions:changes.length};
 return changes;
}
