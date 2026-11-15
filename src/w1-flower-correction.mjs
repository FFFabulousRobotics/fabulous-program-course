import {combineExercise,firstAttempts,lessonCompleted} from './learning-results.mjs';

export const oldFlowerPrompt='仅计算两次蜂巢翻转和三个花朵球，合计多少分？';
export const flowerPrompt='仅计算两次蜂巢翻转和三个有效花朵球，合计多少分？';
export const flowerExplanation='“有效花朵球”指已满足计分条件的花粉球（花朵底部已有花蜜球），每个 2 分。本题仅计算两次蜂巢翻转及三个有效花朵球，不计花蜜球分数，因此为 20 × 2 + 2 × 3 = 46 分。若花朵底部没有花蜜球，仅放三个花粉球不计分，此时只有两次蜂巢翻转的 40 分。';
export const oldFlowerRule='- 花朵任务：向花朵中放球并放置花粉，教案记为每球 2 分、底部花蜜 5 分。';
export const flowerRule='- 花朵任务：必须区分花粉球与花蜜球。按本课程教案，满足计分条件的花粉球每个 2 分，底部花蜜球计 5 分。**若花朵底部没有花蜜球，仅放三个花粉球不计分。**计算题会明确花蜜球是否存在、花粉球是否有效计分，以及是否把花蜜球的分数计入合计。';
const reason='W1.1 旧题未明确花蜜球及花粉球计分条件，该小题统一补分';

export function correctW1Flower(db,at=new Date().toISOString()){
 if(db.contentCorrections?.w1FlowerV1)return [];
 const lesson=db.lessons.find(l=>l.id==='w1-01'),question=lesson?.fillQuestions.find(q=>q.id==='score');
 if(!question||question.prompt!==oldFlowerPrompt)throw Error('W1.1 题干已变化，请核对后再修订');
 if(!lesson.content.includes(oldFlowerRule))throw Error('W1.1 教程已变化，请核对花朵规则段落');
 const changes=[];
 for(const record of db.submissions){
  if(record.lessonId!==lesson.id||!['fill','exercise'].includes(record.kind))continue;
  const snapshot=record.questions?.find(q=>q.id==='score');
  if(snapshot?.prompt&&snapshot.prompt!==oldFlowerPrompt)continue;
  const original=record.kind==='exercise'?record.knowledge:record;
  if(!original?.details?.some(d=>d.id==='score'&&!d.correct))continue;
  if(original.total!==original.details.length||original.total===0)throw Error('历史题目数量不一致：'+record.id);
  const details=original.details.map(d=>d.id==='score'?{...d,correct:true}:d),passed=details.filter(d=>d.correct).length,total=details.length;
  const knowledge={...original,details,passed,total,score:Math.round(passed/total*100),status:passed===total?'AC':'WA',message:`${passed}/${total} 题正确`};
  const before=record.score;
  if(record.kind==='exercise')Object.assign(record,combineExercise(knowledge,record.programming));
  else Object.assign(record,knowledge);
  record.scoreAdjustment={reason,questionId:'score',previousScore:before,points:Math.round((record.score-before)*100)/100,at};
  if(snapshot){snapshot.correctAnswers=['40','46'];snapshot.explanation='旧题未交代花蜜球及花粉球计分条件，本题已统一补回分数，原作答保留。没有花蜜球时三个花粉球不得分，合计 40 分；三个花粉球均有效且不计花蜜球时，合计 46 分。';}
  changes.push({id:record.id,userId:record.userId,before,after:record.score});
 }
 lesson.content=lesson.content.replace(oldFlowerRule,flowerRule);
 Object.assign(question,{prompt:flowerPrompt,accepts:['46'],hint:flowerExplanation,explanation:flowerExplanation});
 for(const userId of new Set(changes.map(c=>c.userId))){
  const records=db.submissions.filter(s=>s.userId===userId&&s.lessonId===lesson.id),first=firstAttempts(records,[lesson])[0];
  for(const record of records.filter(s=>s.kind==='exercise'))Object.assign(record,{firstScore:first.score,firstStatus:first.status});
  let progress=db.progress.find(p=>p.userId===userId&&p.lessonId===lesson.id);
  if(!progress){progress={userId,lessonId:lesson.id,read:false};db.progress.push(progress);}
  const alreadyComplete=lessonCompleted(lesson,progress);
  const fillPassed=progress.fillPassed||records.some(s=>(s.kind==='fill'?s.status:s.knowledge?.status)==='AC');
  Object.assign(progress,{fillPassed:!!fillPassed,exercisePassed:alreadyComplete||records.some(s=>s.kind==='exercise'&&s.status==='AC')||(!lesson.codeTask&&!!fillPassed),updatedAt:at});
 }
 db.contentCorrections??={};db.contentCorrections.w1FlowerV1={at,reason,correctedSubmissions:changes.length};
 return changes;
}
