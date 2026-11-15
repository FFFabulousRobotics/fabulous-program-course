import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {validateQuestions} from './questions.mjs';
import {validateTask} from './task-config.mjs';
export async function buildW4(root){
 const data=JSON.parse(await readFile(join(root,'course/W4/exercise.json'),'utf8'));
 return {...data,id:'w4-national-practice',weekId:'week-4',position:1,order:1,code:'W4',published:false,publishAt:null,
  fillQuestions:validateQuestions(data.fillQuestions),codeTask:validateTask(data.codeTask)};
}
// Explicit import only: no startup migration can publish W4 on a running site.
export async function importW4(db,root,{published=false}={}){
 if(db.lessons.some(l=>l.id==='w4-national-practice'))return false;
 if(db.weeks.some(w=>w.number===4))throw Error('W4已存在，请先确认编号冲突');
 // W3 remains unused; never renumber earlier weeks or add a W3 lesson.
 const lesson=await buildW4(root);lesson.published=published;
 db.weeks.push({id:'week-4',number:4,code:'W4',title:'国庆练习',description:'20道客观题＋1道编程题，共100分。仅一次正式提交，提交后查看分数和答案解析。',published,publishAt:null});
 db.lessons.push(lesson);return true;
}
