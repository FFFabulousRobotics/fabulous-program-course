import {orderedLessons,orderedWeeks,lessonVisible} from './course-structure.mjs';
import {submissionStats,lessonCompleted,lessonAcScore,exerciseReview,chronological} from './learning-results.mjs';

export function memberProgress(db,user,{details=false}={}){
 const lessons=orderedLessons(db).filter(l=>lessonVisible(db,l,{...user,role:'member'}));
 const records=db.submissions.filter(s=>s.userId===user.id);
 const progresses=db.progress.filter(p=>p.userId===user.id);
 const progressFor=id=>progresses.find(p=>p.lessonId===id)||{};
 const timestamps=[user.lastActiveAt,...records.map(s=>s.createdAt),...progresses.map(p=>p.updatedAt),
  ...(db.drafts||[]).filter(d=>d.userId===user.id).map(d=>d.updatedAt),
  ...(db.compilerDrafts||[]).filter(d=>d.userId===user.id).map(d=>d.updatedAt)].filter(t=>Number.isFinite(Date.parse(t)));
 const result={...submissionStats(records,lessons),total:lessons.length,
  accepted:lessons.filter(l=>lessonCompleted(l,progressFor(l.id))).length,
  read:lessons.filter(l=>progressFor(l.id).read).length,
  lastActiveAt:timestamps.sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)||null};
 if(!details)return result;
 result.weeks=orderedWeeks(db).filter(w=>lessons.some(l=>l.weekId===w.id)).map(w=>{
  const items=lessons.filter(l=>l.weekId===w.id).map(l=>{
   const p=progressFor(l.id),attempts=chronological(records.filter(s=>s.lessonId===l.id)),ac=lessonAcScore(records,l);
   const review=exerciseReview(db,user.id,l),hasExercise=!!(l.fillQuestions.length||l.codeTask);
   return {id:l.id,code:l.code,title:l.title,read:!!p.read,complete:lessonCompleted(l,p),hasExercise,
    fillPassed:!!p.fillPassed,codePassed:!!p.codePassed,submissions:ac.submissions,
    firstScore:ac.submissions?ac.firstScore:null,latestScore:review?.score??null,
    acScore:ac.submissions?ac.score:null,lastSubmittedAt:attempts.at(-1)?.createdAt||null};
  });
  return {id:w.id,code:w.code,title:w.title,accepted:items.filter(l=>l.complete).length,total:items.length,lessons:items};
 });
 return result;
}
