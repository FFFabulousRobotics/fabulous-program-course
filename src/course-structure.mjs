import {randomUUID} from 'node:crypto';
import {validateTask} from './task-config.mjs';
import {validateQuestions} from './questions.mjs';
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
const stamp=()=>new Date().toISOString();
function publication(input,original={published:false}){
 const result={published:original.published,publishAt:original.publishAt||null};
 if(input.published!==undefined){
  if(typeof input.published!=='boolean')fail(400,'发布状态无效');
  result.published=input.published;
  if(input.publishAt===undefined)result.publishAt=null;
 }
 if(input.publishAt!==undefined){
  if(input.publishAt===null)result.publishAt=null;
  else{
   const value=input.publishAt,time=typeof value==='string'?Date.parse(value):NaN;
   if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(time))fail(400,'定时发布时间格式无效，请选择日期和时间');
   if(time<=Date.now())fail(400,'定时发布时间必须晚于当前时间');
   if(input.published===true)fail(400,'立即发布与定时发布不能同时设置');
   result.publishAt=new Date(time).toISOString();result.published=false;
  }
 }
 return result;
}
export function publishDueCourses(db,now=Date.now()){
 let changed=false;
 for(const item of db.weeks){
  if(!item.published&&item.publishAt&&Date.parse(item.publishAt)<=now){
   Object.assign(item,{published:true,publishAt:null,updatedAt:new Date(now).toISOString()});syncWeekPublication(db,item);changed=true;
  }
 }
 return changed;
}
export function syncWeekPublication(db,week){
 for(const lesson of db.lessons.filter(l=>l.weekId===week.id))Object.assign(lesson,{published:week.published,publishAt:week.published?null:week.publishAt||null});
}
export function migrateWeekPublication(db){
 if(db.weekPublicationVersion===1)return false;
 for(const week of db.weeks)syncWeekPublication(db,week);
 db.weekPublicationVersion=1;return true;
}
export function orderedWeeks(db){return [...db.weeks].sort((a,b)=>a.number-b.number);}
export function orderedLessons(db){const weeks=new Map(db.weeks.map(w=>[w.id,w.number]));return [...db.lessons].sort((a,b)=>(weeks.get(a.weekId)??Infinity)-(weeks.get(b.weekId)??Infinity)||a.position-b.position||a.id.localeCompare(b.id));}
// Assignment is an authorization boundary, not a client-side display preference.
// Persist immutable user IDs so renaming an account never changes its paper.
export function lessonVisible(db,l,user){
 if(user.role==='admin')return true;
 if(Object.hasOwn(l,'assignedUserIds')&&(!Array.isArray(l.assignedUserIds)||!user.id||!l.assignedUserIds.includes(user.id)))return false;
 return db.weeks.some(w=>w.id===l.weekId&&w.published);
}
export function weekVisible(db,w,user){
 if(user.role==='admin')return true;
 const lessons=db.lessons.filter(l=>l.weekId===w.id);
 return w.published&&(!lessons.length||lessons.some(l=>lessonVisible(db,l,user)));
}
export function normalizeWeek(db,weekId,ids){
 const week=db.weeks.find(w=>w.id===weekId);if(!week)return;
 const lessons=ids?ids.map(id=>db.lessons.find(l=>l.id===id)):orderedLessons(db).filter(l=>l.weekId===weekId);
 lessons.forEach((l,i)=>Object.assign(l,{weekId,position:i+1,order:i+1,code:l.exerciseOnly?week.code:week.code+'.'+(i+1)}));
}
export function homeWeek(db,user){
 const weeks=orderedWeeks(db).filter(w=>w.published&&db.lessons.some(l=>l.weekId===w.id&&(!user||lessonVisible(db,l,user))));
 return weeks.find(w=>w.id===db.courseSettings.homeWeekId)||weeks.at(-1)||null;
}
export function migrateCourses(db){
 if(db.courseStructureVersion===1)return [];
 db.weeks||=[];db.courseSettings||={homeWeekId:null};
 const removed=[];
 db.lessons=db.lessons.filter(l=>{
  const placeholder=l.title==='新教程'&&!l.published&&!l.codeTask&&!l.fillQuestions?.length&&['# 新教程','# 新教程\n\n在这里编写课程内容。'].includes(l.content?.trim())&&!l.subtitle;
  const used=['progress','drafts','submissions'].some(key=>(db[key]||[]).some(r=>r.lessonId===l.id));
  if(placeholder&&!used){removed.push(l.id);return false;}return true;
 });
 for(const l of db.lessons){
  const match=l.code?.match(/^W(\d+)\.(\d+)$/),number=match?Number(match[1]):1;
  let week=db.weeks.find(w=>w.number===number);
  if(!week){week={id:'week-'+number,number,code:'W'+number,title:number===1?'BIOBUZZ 与第一个机器人程序':'第 '+number+' 周',description:number===1?'从比赛规则开始，学习 Java 与 FTC 程序结构。':'',published:db.lessons.some(x=>(x.code?.startsWith('W'+number+'.')||number===1)&&x.published)};db.weeks.push(week);}
  l.weekId=week.id;l.position=match?Number(match[2]):l.order||9999;
 }
 for(const week of db.weeks)normalizeWeek(db,week.id);
 db.courseStructureVersion=1;return removed;
}
export function courseService({db,save,body,send,auth,publicLesson}){
 const weekFor=id=>db.weeks.find(w=>w.id===id)||fail(404,'周课程不存在');
 const clearHome=()=>{if(db.courseSettings.homeWeekId&&!db.weeks.some(w=>w.id===db.courseSettings.homeWeekId&&w.published&&db.lessons.some(l=>l.weekId===w.id&&l.published)))db.courseSettings.homeWeekId=null;};
 const text=(value,label,max,empty=false)=>{if(typeof value!=='string'||value.length>max||(!empty&&!value.trim()))fail(400,label+'格式错误');return value.trim();};
 return async(req,res,url,user)=>{
  const path=url.pathname,method=req.method;
  if(!/^\/api\/admin\/(weeks|lessons|course-settings)(\/|$)/.test(path))return false;
  auth(req,'admin');
  if(path==='/api/admin/course-settings'&&method==='POST'){
   const input=await body(req);auth(req,'admin');
   if(input.homeWeekId!==null){const week=weekFor(input.homeWeekId);if(!week.published||!db.lessons.some(l=>l.weekId===week.id&&l.published))fail(400,'请选择已有发布教程的周，或自动展示最新周');}
   db.courseSettings.homeWeekId=input.homeWeekId;await save();send(res,200,{settings:db.courseSettings,homeWeekId:homeWeek(db)?.id||null});return true;
  }
  if(path==='/api/admin/weeks'&&method==='POST'){
   const input=await body(req);auth(req,'admin');const original=input.id?weekFor(input.id):null;
   if(!Number.isInteger(input.number)||input.number<0||input.number>9999)fail(400,'周编号应为 0–9999 的整数');
   if(db.weeks.some(w=>w.number===input.number&&w.id!==original?.id))fail(409,'该周编号已存在');
   if(typeof input.published!=='boolean')fail(400,'发布状态无效');
   const week={...original,id:original?.id||'week-'+randomUUID(),number:input.number,code:'W'+input.number,title:text(input.title,'周标题',160),description:text(input.description??'','周简介',2000,true),...publication(input,original||undefined),updatedAt:stamp()};
   if((week.published||week.publishAt)&&db.lessons.some(l=>l.weekId===week.id&&!l.exerciseOnly&&!l.content?.trim()))fail(400,'发布整周前，请填写所有子教程的正文');
   if(original)Object.assign(original,week);else db.weeks.push(week);
   syncWeekPublication(db,week);normalizeWeek(db,week.id);clearHome();await save();send(res,200,{week});return true;
  }
  const removeWeek=path.match(/^\/api\/admin\/weeks\/([^/]+)$/);
  if(removeWeek&&method==='DELETE'){
   const week=weekFor(removeWeek[1]);if(db.lessons.some(l=>l.weekId===week.id))fail(409,'请先删除或移动本周教程，再删除这一周');
   db.weeks=db.weeks.filter(w=>w.id!==week.id);clearHome();await save();send(res,200,{ok:true});return true;
  }
  const reorder=path.match(/^\/api\/admin\/weeks\/([^/]+)\/lesson-order$/);
  if(reorder&&method==='POST'){
   const input=await body(req);auth(req,'admin');const week=weekFor(reorder[1]),ids=db.lessons.filter(l=>l.weekId===week.id).map(l=>l.id);
   if(!Array.isArray(input.lessonIds)||input.lessonIds.length!==ids.length||new Set(input.lessonIds).size!==ids.length||input.lessonIds.some(id=>!ids.includes(id)))fail(400,'排序必须包含该周全部教程且不能重复');
   normalizeWeek(db,week.id,input.lessonIds);await save();send(res,200,{ok:true});return true;
  }
  const removeLesson=path.match(/^\/api\/admin\/lessons\/([^/]+)$/);
  if(removeLesson&&method==='DELETE'){
   const lesson=db.lessons.find(l=>l.id===removeLesson[1]);if(!lesson)fail(404,'教程不存在');
   db.archivedLessons||=[];db.archivedLessons.push({...lesson,deletedAt:stamp()});db.lessons=db.lessons.filter(l=>l.id!==lesson.id);
   normalizeWeek(db,lesson.weekId);clearHome();await save();send(res,200,{ok:true});return true;
  }
  if(path==='/api/admin/lessons'&&method==='POST'){
   const input=await body(req);auth(req,'admin');const original=input.id?db.lessons.find(l=>l.id===input.id):null;
   if(input.id&&!original)fail(404,'教程不存在');
   if(!input.weekId&&!original)fail(400,'请先选择归属周');
   const week=weekFor(input.weekId??original?.weekId);
   const target=original?structuredClone(original):{id:'lesson-'+randomUUID(),title:'',subtitle:'',estimate:'10 分钟',content:'',fillQuestions:[],codeTask:null,published:false};
   const siblings=orderedLessons(db).filter(l=>l.weekId===week.id&&l.id!==target.id);
   const position=input.position??(original?.weekId===week.id?original.position:siblings.length+1);
   if(!Number.isInteger(position)||position<1||position>siblings.length+1)fail(400,'周内顺序应为 1–'+(siblings.length+1));
   for(const key of ['title','subtitle','estimate','content'])if(input[key]!==undefined)target[key]=text(input[key],key==='title'?'教程标题':key,key==='content'?100000:160,key!=='title');
   if(!target.title.trim())fail(400,'请填写教程标题');
   if(input.exerciseOnly!==undefined){if(typeof input.exerciseOnly!=='boolean')fail(400,'页面类型无效');target.exerciseOnly=input.exerciseOnly;}
   if(input.submissionLimit!==undefined){if(input.submissionLimit!==null&&input.submissionLimit!==1)fail(400,'提交次数配置无效');target.submissionLimit=input.submissionLimit;}
   if(input.scoring!==undefined){const s=input.scoring;if(!s||![s.knowledgeWeight,s.programmingWeight].every(n=>Number.isInteger(n)&&n>=0&&n<=100)||s.knowledgeWeight+s.programmingWeight!==100)fail(400,'分项总分必须为100');target.scoring={knowledgeWeight:s.knowledgeWeight,programmingWeight:s.programmingWeight};}
   if(input.acScoring!==undefined){if(!['first-score','weighted'].includes(input.acScoring))fail(400,'AC计分方式无效');target.acScoring=input.acScoring;}
   let knowledgeChanged=false;
   if(input.questions!==undefined){
    target.fillQuestions=validateQuestions(input.questions);
    const signature=questions=>JSON.stringify(questions.map(({id,prompt,code,options,accepts,points,matcher})=>({id,prompt,code,options,accepts,points,matcher})));
    knowledgeChanged=signature(original?.fillQuestions||[])!==signature(target.fillQuestions);
   }
   if(typeof input.starter==='string'&&target.codeTask)target.codeTask.starter=input.starter.slice(0,30000);
   let assessmentChanged=false;
   if(input.codeTask!==undefined){
    target.codeTask=validateTask(input.codeTask);
    const signature=t=>{if(!t)return 'null';const v=validateTask(t);return JSON.stringify({kind:v.kind,tests:v.tests,rules:v.rules,compare:v.compare,grader:v.grader,starter:v.grader?v.starter:undefined});};
    assessmentChanged=signature(original?.codeTask)!==signature(target.codeTask);
   }
   Object.assign(target,{published:week.published,publishAt:week.published?null:week.publishAt||null});
   if((target.published||target.publishAt)&&!target.exerciseOnly&&!target.content.trim())fail(400,'发布前请填写教程正文');
   target.weekId=week.id;target.updatedAt=stamp();
   const oldWeek=original?.weekId;
   if(original)Object.assign(original,target);else db.lessons.push(target);
   const ids=siblings.map(l=>l.id);ids.splice(position-1,0,target.id);normalizeWeek(db,week.id,ids);
   if(oldWeek&&oldWeek!==week.id)normalizeWeek(db,oldWeek);
   for(const p of db.progress)if(p.lessonId===target.id){if(assessmentChanged){p.codePassed=false;p.exercisePassed=false;}if(knowledgeChanged){p.fillPassed=false;p.exercisePassed=false;}}
   clearHome();await save();send(res,200,{lesson:publicLesson(db.lessons.find(l=>l.id===target.id),user)});return true;
  }
  fail(404,'课程管理接口不存在');
 };
}
