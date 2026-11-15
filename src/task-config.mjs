import {w5Rubrics} from './w5-config.mjs';
import {w6Points} from './w6-config.mjs';
const fail=message=>{throw Object.assign(new Error(message),{code:400});};
const str=(v,label,max=200,empty=false)=>{if(typeof v!=='string'||v.length>max||(!empty&&!v.trim()))fail(label+'格式错误');return v;};
const num=(v,label,min,max)=>{if(!Number.isInteger(v)||v<min||v>max)fail(`${label}应为 ${min}-${max} 的整数`);return v;};
export function defaultRules(kind){return {annotation:kind==='linear'?'MyFirstOp':'IterativeDemo',key:'Status',ready:'Ready',running:'Running',stopped:'Stopped',requireStopped:kind==='iterative',minRunning:2,initMs:450,runMs:450,stopMs:1150};}
export function validateTask(input){
 if(input===null)return null;
 if(!input||!['java','linear','iterative'].includes(input.kind))fail('请选择有效的评测类型');
 const t={kind:input.kind};
 if(input.grader!==undefined){if(!['soda-v1','w5-v1','w6-oop-v1'].includes(input.grader)||input.kind!=='java')fail('专用评分器无效');t.grader=input.grader;}
 if(t.grader==='w6-oop-v1'){
  if(input.fixedMain!==false)fail('W6须开放完整Main.java编辑');t.fixedMain=false;
 }else if(input.fixedMain===false)fail('本评分器的固定Main不可关闭');
 if(t.grader==='w5-v1'){
  if(!Object.hasOwn(w5Rubrics,input.variant))fail('专项题库无效');
  t.variant=input.variant;t.answerClass=w5Rubrics[t.variant].answerClass;
  if(input.answerClass!==t.answerClass)fail('专项作答类不一致');
 }
 for(const k of ['solution','referenceSource'])if(input[k]!==undefined)t[k]=str(input[k],k,30000,true);
 for(const k of ['title','description','input','output','sampleOutput','starter'])t[k]=str(input[k]??'',k,k==='starter'?30000:k==='title'?160:10000,k!=='title');
 for(const k of ['background','hint'])if(input[k]!==undefined)t[k]=str(input[k],k,20000,true);
 if(input.samples!==undefined){
  if(!Array.isArray(input.samples)||input.samples.length>8)fail('公开样例最多 8 组');
  t.samples=input.samples.map(s=>({input:str(s?.input,'样例输入',10000,true),output:str(s?.output,'样例输出',10000,true)}));
 }
 if(!Array.isArray(input.tests)||input.tests.length<1||input.tests.length>12)fail('请配置 1-12 个测试点');
 t.tests=input.tests.map((test,i)=>{
   if(!test||typeof test!=='object')fail('测试点格式错误');
   const name=str(test.name,`测试点 ${i+1} 名称`,100);
   if(t.grader==='w6-oop-v1'){
    if(test.scenario!=='part'+i||test.points!==w6Points[i])fail('W6评分项或分值不一致');
    return {name,scenario:test.scenario,points:test.points,input:'',expected:''};
   }
   if(t.grader==='w5-v1'){
    const points=w5Rubrics[t.variant].points;
    if(test.scenario!=='part'+i||test.points!==points[i])fail('W5评分项及分值无效');
    return {name,scenario:test.scenario,points:test.points,input:'',expected:''};
   }
   if(t.grader==='soda-v1'){const rubric={structure:6,constructor:4,hurt:8,eligibility:6,recovery:6,shared:6,output:4};if(rubric[test.scenario]!==test.points)fail('Soda评分项及分值无效');return {name,scenario:test.scenario,points:test.points,input:'',expected:''};}
   if(t.kind==='java')return {name,input:str(test.input??'','测试输入',10000,true),expected:str(test.expected,'期望输出',10000,true)};
   if(t.kind==='linear'){if(!['linear','cancel'].includes(test.scenario))fail('LinearOpMode 场景只能为正常启停或 INIT 取消');return {name,scenario:test.scenario};}
   return {name,scenario:String(num(Number(test.scenario),'loop 次数',1,100))};
 });
 if(t.grader==='soda-v1'&&(t.tests.length!==7||new Set(t.tests.map(t=>t.scenario)).size!==7))fail('Soda需包含全部7项评分标准');
 if(t.grader==='w5-v1'&&t.tests.length!==w5Rubrics[t.variant].points.length)fail('W5需包含该卷全部评分标准');
 if(t.grader==='w6-oop-v1'&&t.tests.length!==w6Points.length)fail('W6需包含全部7项评分标准');
 if(t.kind==='java'){t.compare=input.compare??'trimEnd';if(!['exact','trimEnd','tokens'].includes(t.compare))fail('输出比较方式无效');}
 else {
   const r={...defaultRules(t.kind),...input.rules};t.rules={};
   for(const k of ['annotation','key','ready','running','stopped']){t.rules[k]=str(r[k],k,100);if(/[\r\n\x00]/.test(r[k]))fail(k+'不能包含换行');}
   if(new Set([r.ready,r.running,r.stopped]).size!==3)fail('三个阶段的状态值不能相同');
   if(typeof r.requireStopped!=='boolean')fail('STOP 输出选项无效');t.rules.requireStopped=r.requireStopped;
   for(const [k,min,max] of [['minRunning',1,100],['initMs',100,3000],['runMs',100,3000],['stopMs',100,3000]])t.rules[k]=num(r[k],k,min,max);
 }
 return t;
}
