import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {validateQuestions} from './questions.mjs';
import {validateTask} from './task-config.mjs';

export async function buildW6(root){
 const source=await readFile(join(root,'course/W6/lesson.json'),'utf8'),data=JSON.parse(source);
 const questions=validateQuestions(data.fillQuestions),task=validateTask(data.codeTask);
 if(questions.length!==10||questions.filter(q=>q.type==='boolean').length!==5||questions.filter(q=>q.type==='choice').length!==3||questions.filter(q=>q.type==='fill').length!==2||questions.reduce((s,q)=>s+q.points,0)!==60)throw Error('W6题型或分值不一致');
 if(!data.content?.trim()||task.grader!=='w6-oop-v1'||task.fixedMain!==false||task.solution!==undefined)throw Error('W6学案或评测配置不一致');
 return {digest:createHash('sha256').update(source).digest('hex'),lesson:{...data,fillQuestions:questions,codeTask:task,id:'w6-oop',weekId:'week-6',position:1,order:1,code:'W6.1',published:false,publishAt:null,exerciseOnly:false,submissionLimit:null,unifiedExercise:true,acScoring:'weighted',scoring:{knowledgeWeight:60,programmingWeight:40}}};
}

export async function importW6(db,root,{published=false}={}){
 const {digest,lesson}=await buildW6(root);
 if(db.imports?.w6){
  if(db.imports.w6.digest!==digest||!db.weeks.some(w=>w.id==='week-6'&&w.number===6)||!db.lessons.some(l=>l.id==='w6-oop'&&l.weekId==='week-6'))throw Error('W6已存在且与当前版本不一致，拒绝覆盖');
  return false;
 }
 if(db.weeks.some(w=>w.number===6||w.id==='week-6')||db.lessons.some(l=>l.id==='w6-oop'||l.weekId==='week-6')||db.materials?.some(m=>m.id==='material-w6'))throw Error('W6编号或资料已存在，拒绝覆盖');
 db.weeks.push({id:'week-6',number:6,code:'W6',title:'封装、继承与重写',description:'统一学案与练习：5判断、3选择、2填空，程序题为FTC年度交友大会2.0。客观60分，程序40分。',published,publishAt:null});
 db.lessons.push({...lesson,published});
 db.materials||=[];db.materials.push({id:'material-w6',code:'W6',title:'封装、继承与重写',description:'W6整理学案与学生题面，不含教师答案或参考实现。',author:'FFFabulous · FTC 19726',sourceUrl:'',fileKey:'course/W6/W6学案.docx',filename:'W6学案.docx',order:Math.max(-1,...db.materials.map(m=>m.order||0))+1,published});
 db.imports||={};db.imports.w6={digest,createdAt:new Date().toISOString(),lessonId:lesson.id,materialRegistered:true};
 return true;
}
