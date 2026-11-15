import {readFile,writeFile,copyFile,rename} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {buildW4} from '../src/w4-import.mjs';
import {gradeQuestions} from '../src/questions.mjs';
import {combineExercise} from '../src/learning-results.mjs';
// This repair is intentionally scoped to disposable LOCAL preview data.
if(!process.argv.includes('--server-stopped'))throw Error('先停止5184本地预览，再传 --server-stopped');
const root=resolve(import.meta.dirname,'..'),file=join(root,'data/w4-preview/store.json');
const db=JSON.parse(await readFile(file,'utf8')),fresh=await buildW4(root);
const lesson=db.lessons.find(l=>l.id===fresh.id);if(!lesson)throw Error('本地预览缺少W4');
await copyFile(file,file+'.backup-before-review-'+Date.now());
Object.assign(lesson,{...fresh,published:lesson.published,publishAt:lesson.publishAt});
let corrected=0;
for(const record of db.submissions.filter(s=>s.lessonId===lesson.id&&s.kind==='exercise')){
 const knowledge=gradeQuestions(lesson.fillQuestions,record.answers);
 const old=record.score;
 Object.assign(record,combineExercise(knowledge,record.programming,lesson.scoring));
 record.firstScore=record.score;record.firstStatus=record.status;
 const snapshot=record.questions?.find(q=>q.id==='w4-q16');if(snapshot)snapshot.explanation=lesson.fillQuestions[15].explanation;
 const progress=db.progress.find(p=>p.userId===record.userId&&p.lessonId===lesson.id);
 if(progress)Object.assign(progress,{fillPassed:knowledge.status==='AC',codePassed:record.programming?.status==='AC',exercisePassed:record.status==='AC'});
 if(old!==record.score){corrected++;console.log('已修正一份首次成绩：'+old+' → '+record.score+'，保留原提交时间与次数');}
}
await writeFile(file+'.next',JSON.stringify(db,null,2));await rename(file+'.next',file);
console.log('W4本地题干与评分已更新；修正成绩 '+corrected+' 份。');
