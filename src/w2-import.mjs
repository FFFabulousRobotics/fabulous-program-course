import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {validateQuestions} from './questions.mjs';
import {validateTask} from './task-config.mjs';
import {normalizeWeek} from './course-structure.mjs';

export const w2PublishAt='2026-09-20T11:00:00.000Z';
export function parseW2Knowledge(source){
 const groups=[[],[],[],[]],seen=new Map();
 const text=source.replace(/\r\n/g,'\n');
 for(const section of text.split(/^# /m).slice(1)){
  const type=section.startsWith('一、')?'choice':section.startsWith('二、')?'read':section.startsWith('三、')?'completion':null;
  if(!type)continue;
  const parts=[...section.matchAll(/^## 第([一二三四])部分[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
  for(const part of parts){
   const index='一二三四'.indexOf(part[1]),blocks=type==='choice'?[...part[2].matchAll(/^\d+\. ([\s\S]*?\*\*答案：[A-D]\*\*)/gm)].map(m=>m[1]):[part[2]];
   for(let n=0;n<blocks.length;n++){
    const block=blocks[n],answer=block.match(/\*\*答案：([A-D])\*\*/)?.[1];
    if(!answer)throw Error('缺少知识检查答案');
    const code=block.match(/```java\n([\s\S]*?)```/)?.[1].trimEnd();
    const prompt=type==='choice'?block.split(/^[ \t]*A\./m)[0].trim():block.match(/\*\*问题\*\*：([^\n]+)/)?.[1].trim();
    const options=[...block.matchAll(/^[ \t]*([A-D])\. ([\s\S]*?)(?=^[ \t]*[A-D]\. |^[ \t]*\*\*答案)/gm)].map(m=>({value:m[1],text:m[2].trim().split('\n').map(s=>s.trim()).join('\n').replace(/`([^`]+)`/g,'$1')}));
    const q={id:`w2-${index+1}-${type}-${n+1}`,type,prompt,...(code?{code}:{}),options,accepts:[answer]};
    if(seen.has(q.id)){if(JSON.stringify(seen.get(q.id))!==JSON.stringify(q))throw Error('重复题目内容不一致：'+q.id);continue;}
    seen.set(q.id,q);groups[index].push(q);
   }
  }
 }
 if(groups.some((g,i)=>g.length!==(i===3?4:6)))throw Error('W2 应有 22 题，按 6/6/6/4 分配');
 return groups.map(validateQuestions);
}
export async function buildW2(root){
 const directory=join(root,'course/W2');
 const knowledge=await readFile(join(directory,'knowledgeW2.md'),'utf8');
 const statement=(await readFile(join(directory,'testW2.md'),'utf8')).replace(/\r\n/g,'\n');
 const questions=parseW2Knowledge(knowledge);
 const section=title=>statement.match(new RegExp('^## '+title+'\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))','m'))?.[1].replace(/^---\s*$/gm,'').trim()||'';
 const cases=await Promise.all(Array.from({length:10},async(_,i)=>{
  const id=String(i+1).padStart(2,'0');
  return {name:'测试点 '+(i+1),input:await readFile(join(directory,'test-data',id+'.in'),'utf8'),expected:await readFile(join(directory,'test-data',id+'.out'),'utf8')};
 }));
 const samples=cases.slice(0,3).map(c=>({input:c.input,output:c.expected}));
 const task=validateTask({kind:'java',title:'FTC 年度交友大会',background:section('题目背景'),description:section('题目描述'),input:section('输入格式'),output:section('输出格式'),hint:section('说明/提示')+'\n\n## 新手提示：输入与数组\n\n'+section('新手提示：输入与数组'),samples,starter:'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // 读取旅行者信息，按题目规则寻找第一个符合条件的人。\n    }\n}\n',tests:cases,compare:'trimEnd'});
 const titles=['类','构造方法','实例化','流程控制'],subtitles=['类、对象与方法：用状态和行为描述机械臂','在创建对象时完成初始化','使用 this 与 new，理解对象和变量','条件判断、循环与 FTC 年度交友大会'];
 const lessons=await Promise.all(titles.map(async(title,i)=>({id:'w2-0'+(i+1),weekId:'week-2',position:i+1,order:i+1,code:'W2.'+(i+1),title,subtitle:subtitles[i],estimate:i===3?'25 分钟':'10 分钟',published:false,publishAt:w2PublishAt,content:await readFile(join(directory,'lessons/W2.'+(i+1)+'.md'),'utf8'),fillQuestions:questions[i],codeTask:i===3?task:null})));
 const week={id:'week-2',number:2,code:'W2',title:'类、构造方法与实例对象——面向对象入门',description:'阐明类、对象、方法的概念与定义；介绍构造方法；引入 this、new 关键字，同时介绍一小部分变量相关知识。',published:false,publishAt:w2PublishAt};
 const signature=createHash('sha256').update(JSON.stringify({week,lessons})).digest('hex');
 return {week,lessons,signature};
}
export function installW2(db,bundle){
 if(db.imports?.w2){
  if(db.imports.w2.signature!==bundle.signature)throw Error('W2 已导入且源文件有变化，请通过管理员编辑，避免覆盖已有课程');
  return false;
 }
 if(db.weeks.some(w=>w.number===2||w.id===bundle.week.id)||db.lessons.some(l=>bundle.lessons.some(x=>x.id===l.id)))throw Error('W2 编号或课程 ID 已存在，停止导入以保护已有数据');
 db.weeks.push(structuredClone(bundle.week));db.lessons.push(...structuredClone(bundle.lessons));normalizeWeek(db,bundle.week.id);
 db.imports||={};db.imports.w2={signature:bundle.signature,importedAt:new Date().toISOString(),source:'course/W2',publishAt:w2PublishAt};
 return true;
}
