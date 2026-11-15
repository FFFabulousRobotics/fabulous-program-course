import {publicQuestion} from './questions.mjs';

export const completesOnSubmission=lesson=>lesson.exerciseOnly===true&&lesson.submissionLimit===1;

export function lessonCompleted(lesson,progress={}){
 if(completesOnSubmission(lesson))return progress.exerciseSubmitted===true;
 const hasKnowledge=!!lesson.fillQuestions?.length,hasCode=!!lesson.codeTask;
 if((hasKnowledge||hasCode)&&typeof progress.exercisePassed==='boolean')return progress.exercisePassed;
 return hasKnowledge||hasCode?Boolean((!hasKnowledge||progress.fillPassed)&&(!hasCode||progress.codePassed)):Boolean(progress.read);
}

// Backfill completion from saved formal papers without changing grading or AC.
export function backfillSubmittedExercises(db){
 const ids=new Set(db.lessons.filter(completesOnSubmission).map(l=>l.id));let changed=0;
 for(const record of db.submissions){
  if(record.kind!=='exercise'||!Number.isFinite(record.score)||!ids.has(record.lessonId))continue;
  let progress=db.progress.find(p=>p.userId===record.userId&&p.lessonId===record.lessonId);
  if(!progress){progress={userId:record.userId,lessonId:record.lessonId,read:false,fillPassed:false,codePassed:false,exercisePassed:record.status==='AC'};db.progress.push(progress);}
  if(progress.exerciseSubmitted!==true){progress.exerciseSubmitted=true;changed++;}
 }
 return changed;
}

// Reverse first so equal timestamps retain original submission order (storage is newest first).
export function chronological(records){return [...records].reverse().sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));}
export function combineExercise(knowledge,programming,weights){
 const knowledgeWeight=knowledge?(programming?(weights?.knowledgeWeight??50):100):0,programmingWeight=programming?(knowledge?(weights?.programmingWeight??50):100):0;
 const points=(part,weight)=>Math.round((part?.maxPoints>0?part.points/part.maxPoints:part?.total>0?part.passed/part.total:(part?.score??(part?.status==='AC'?100:0))/100)*weight*100)/100;
 const knowledgePoints=points(knowledge,knowledgeWeight),programmingPoints=points(programming,programmingWeight);
 const ok=(!knowledge||knowledge.status==='AC')&&(!programming||programming.status==='AC');
 return {kind:'exercise',status:ok?'AC':programming&&programming.status!=='AC'?programming.status:'WA',score:Math.round((knowledgePoints+programmingPoints)*100)/100,
  passed:(knowledge?.passed||0)+(programming?.status==='AC'?1:0),total:(knowledge?.total||0)+(programming?1:0),details:knowledge?.details||[],knowledge,programming,
  scoring:{knowledgeWeight,programmingWeight,knowledgePoints,programmingPoints},message:ok?'整份练习全部通过':'整份练习已评测，请查看分项得分与详情'};
}
const part=(record,kind)=>record.kind==='exercise'?record[kind]:record.kind===(kind==='knowledge'?'fill':'code')?record:null;
const recordedScore=record=>Number.isFinite(record?.score)?Math.max(0,Math.min(100,record.score)):record?.status==='AC'?100:0;
export function firstAttempts(records,lessons=[]){
 const groups=new Map();
 for(const record of chronological(records)){
  const key=JSON.stringify([record.userId,record.lessonId]);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(record);
 }
 return [...groups.values()].flatMap(group=>{
  const lesson=lessons.find(l=>l.id===group[0].lessonId);
  // A unified paper already has a final stored score. Never recompute it from later attempts.
  if(group[0].kind==='exercise'&&Number.isFinite(group[0].score))return [{...group[0],score:recordedScore(group[0])}];
  const knowledge=group.map(r=>part(r,'knowledge')).find(Boolean)||null,programming=group.map(r=>part(r,'programming')).find(Boolean)||null;
  if(!knowledge&&!programming)return [];
  const hasKnowledge=lesson?!!lesson.fillQuestions?.length:!!knowledge,hasCode=lesson?!!lesson.codeTask:!!programming;
  const missing={score:0,status:'UNSUBMITTED'};
  const first=combineExercise(hasKnowledge?{...(knowledge||missing),score:recordedScore(knowledge),total:0}:null,hasCode?{...(programming||missing),score:recordedScore(programming),total:0}:null);
  return [{...first,userId:group[0].userId,lessonId:group[0].lessonId}];
 });
}
export function lessonAcScore(records,lesson){
 const attempts=chronological(records.filter(s=>s.lessonId===lesson.id&&['exercise','fill','code'].includes(s.kind)));
 const first=firstAttempts(records.filter(s=>s.lessonId===lesson.id),[lesson])[0],firstScore=first?recordedScore(first):0;
 if(lesson.acScoring==='first-score')return {mode:'first-score',firstScore,submissions:attempts.length,firstPerfectAttempt:firstScore===100?1:null,baseScore:firstScore,bonus:0,score:firstScore};
 let knowledge=null,programming=null,n=null,countedAttempts=0,unifiedSeen=false;
 const initialParts=new Set();
 const hasKnowledge=!!lesson.fillQuestions?.length,hasCode=!!lesson.codeTask;
 for(let i=0;i<attempts.length;i++){
  const attempt=attempts[i];
  if(attempt.kind==='exercise'){
   countedAttempts++;unifiedSeen=true;
   if(recordedScore(attempt)===100){n=countedAttempts;break;}
   knowledge=attempt.knowledge||null;programming=attempt.programming||null;
  }else{
   // The old UI required two separate first submissions for one paper. Merge
   // those initial components only; every retry and unified paper still counts.
   const initialComponent=!unifiedSeen&&hasKnowledge&&hasCode&&!initialParts.has(attempt.kind);
   if(!initialComponent||initialParts.size===0)countedAttempts++;
   initialParts.add(attempt.kind);
   if(attempt.kind==='fill')knowledge=attempt;else programming=attempt;
   if((hasKnowledge||hasCode)&&(!hasKnowledge||recordedScore(knowledge)===100)&&(!hasCode||recordedScore(programming)===100)){n=countedAttempts;break;}
  }
 }
 const baseScore=Math.round(firstScore*0.7*100)/100,bonus=n===null?0:Math.max(0,30-3*(n-1));
 return {firstScore,submissions:attempts.length,firstPerfectAttempt:n,baseScore,bonus,score:Math.round((baseScore+bonus)*100)/100};
}
export function submissionStats(records,lessons){
 const ids=new Set(lessons.map(l=>l.id)),visible=records.filter(s=>ids.has(s.lessonId));
 const first=firstAttempts(visible,lessons),accepted=first.filter(s=>s.status==='AC').length;
 const firstScoreTotal=Math.round(first.reduce((sum,s)=>sum+recordedScore(s),0)*100)/100;
 const scoredIds=new Set(first.map(s=>s.lessonId)),scoredLessons=lessons.filter(l=>scoredIds.has(l.id));
 const rawAcTotal=scoredLessons.reduce((sum,lesson)=>{const contribution=lessonAcScore(visible,lesson);return sum+(contribution.mode==='first-score'?contribution.firstScore:contribution.firstScore*0.7+contribution.bonus);},0);
 const acScoreTotal=Math.round(rawAcTotal*100)/100;
 return {submissions:visible.length,firstAttempts:first.length,firstAccepted:accepted,firstScoreTotal,acScoreTotal,scoredExercises:scoredLessons.length,rate:scoredLessons.length?Math.round(rawAcTotal/scoredLessons.length*100)/100:null};
}
export function exerciseReview(db,userId,lesson){
 const records=chronological(db.submissions.filter(s=>s.userId===userId&&s.lessonId===lesson.id));
 const unified=records.filter(s=>s.kind==='exercise');
 let latest=lesson.submissionLimit===1?unified[0]:unified.at(-1);
 if(!latest){
  const knowledge=records.map(r=>part(r,'knowledge')).filter(Boolean).at(-1)||null,programming=records.map(r=>part(r,'programming')).filter(Boolean).at(-1)||null;
  if((lesson.fillQuestions.length&&!knowledge)||(lesson.codeTask&&!programming)||(!knowledge&&!programming))return null;
  latest={...combineExercise(knowledge,programming),answers:knowledge?.answers||{},questions:knowledge?.questions,createdAt:records.at(-1).createdAt,legacy:true};
 }
 const first=firstAttempts(db.submissions.filter(s=>s.userId===userId&&s.lessonId===lesson.id),[lesson])[0];
 return {...latest,submissionLimit:lesson.submissionLimit,programmingSolution:latest.programmingSolution,attemptCount:unified.length,firstScore:first?.score??latest.score,firstStatus:first?.status??latest.status,acContribution:lessonAcScore(db.submissions.filter(s=>s.userId===userId),lesson),
  solutions:latest.questions?.every(q=>q.correctAnswers)?latest.questions:lesson.fillQuestions.map(solutionQuestion)};
}
export function solutionQuestion(q){return {...publicQuestion(q),correctAnswers:[...q.accepts],explanation:q.explanation||q.hint||''};}
export function knowledgeReview(db,userId,lesson){
 const records=chronological(db.submissions.filter(s=>s.userId===userId&&s.lessonId===lesson.id&&s.kind==='fill'));
 if(!records.length)return null;
 const latest=records.at(-1);
 return {id:latest.id,status:latest.status,score:latest.score,passed:latest.passed,total:latest.total,details:latest.details||[],message:latest.message,createdAt:latest.createdAt,attemptCount:records.length,firstScore:records[0].score,firstStatus:records[0].status,
  answers:latest.answers||{},solutions:latest.questions?.every(q=>q.correctAnswers)?latest.questions:lesson.fillQuestions.map(solutionQuestion)};
}
export function requireCompleteAnswers(questions,answers){
 if(!answers||typeof answers!=='object'||Array.isArray(answers))throw Object.assign(Error('请完成整份知识检查后提交'),{code:400});
 for(const q of questions){
  const answer=answers[q.id];
  if(typeof answer!=='string'||!answer.trim()||answer.length>2000)throw Object.assign(Error('请完成整份知识检查后提交'),{code:400});
  if(q.options&&!q.options.some(o=>o.value===answer))throw Object.assign(Error('请选择题目提供的有效选项'),{code:400});
 }
}
