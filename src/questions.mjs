import {expressionAnswer,expressionMatchers} from './expression-answer.mjs';
const fail=message=>{throw Object.assign(new Error(message),{code:400});};
export function validateQuestions(input){
 if(!Array.isArray(input)||input.length>40)fail('知识检查需为最多 40 题的数组');
 const questions=input.map((q,i)=>{
  if(!q||typeof q.prompt!=='string'||!q.prompt.trim()||q.prompt.length>6000||!Array.isArray(q.accepts)||!q.accepts.length||q.accepts.some(a=>typeof a!=='string'||!a.trim()||a.length>2000))fail('每道题需要题干和可接受答案');
  const result={id:/^[a-zA-Z][\w-]{0,40}$/.test(q.id||'')?q.id:'q'+i,prompt:q.prompt,accepts:q.accepts,hint:String(q.hint||'')};
  if(q.points!==undefined){if(!Number.isInteger(q.points)||q.points<1||q.points>100)fail('题目分值应为1至100的整数');result.points=q.points;}
  if(q.matcher!==undefined){if(!expressionMatchers.includes(q.matcher)||q.type!=='fill')fail('表达式评分规则无效');result.matcher=q.matcher;}
  if(q.explanation!==undefined){if(typeof q.explanation!=='string'||q.explanation.length>6000)fail('解析最多 6000 字符');result.explanation=q.explanation;}
  if(q.type!==undefined){if(!['boolean','choice','read','completion','fill'].includes(q.type))fail('知识检查题型无效');result.type=q.type;}
  if(q.code!==undefined){if(typeof q.code!=='string'||q.code.length>12000)fail('题目代码过长或格式错误');result.code=q.code;}
  if(q.type==='choice'||q.type==='boolean'||q.options!==undefined){
   if(!Array.isArray(q.options)||q.options.length<2||q.options.length>8)fail('选择题需配置 2–8 个选项');
   result.options=q.options.map(o=>{if(!o||typeof o.value!=='string'||!o.value.trim()||o.value.length>80||typeof o.text!=='string'||!o.text.trim()||o.text.length>1000)fail('选择题选项格式错误');return {value:o.value,text:o.text};});
   if(new Set(result.options.map(o=>o.value)).size!==result.options.length||q.accepts.length!==1||!result.options.some(o=>o.value===q.accepts[0]))fail('单选题必须有一个有效答案且选项不能重复');
  }
  return result;
 });
 if(new Set(questions.map(q=>q.id)).size!==questions.length)fail('题目 ID 不能重复');
 return questions;
}
export function publicQuestion({accepts,hint,explanation,matcher,...question}){return question;}
export function correctAnswer(question,answer){
 if(question.matcher)return expressionAnswer(answer??'',question.matcher);
 const normalize=value=>question.type==='read'?String(value).replace(/\r\n/g,'\n').split('\n').map(line=>line.trimEnd()).join('\n').trim():String(value).trim();
 return question.accepts.some(value=>normalize(value)===normalize(answer??''));
}

export function gradeQuestions(questions,answers){
 const details=questions.map(q=>{const correct=correctAnswer(q,answers[q.id]);return {id:q.id,correct,points:correct?(q.points??1):0,maxPoints:q.points??1};});
 const passed=details.filter(q=>q.correct).length,total=details.length;
 const points=details.reduce((n,q)=>n+q.points,0),maxPoints=details.reduce((n,q)=>n+q.maxPoints,0);
 return {status:passed===total?'AC':'WA',score:maxPoints?Math.round(points/maxPoints*10000)/100:0,passed,total,details,points,maxPoints};
}
