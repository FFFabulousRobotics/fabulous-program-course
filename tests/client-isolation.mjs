import {esc,markdown} from '../public/html.js';
import {resultView,runResultView} from '../public/result-views.js';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {knowledgeQuestions,programmingStatement,knowledgeFeedback,exerciseFeedback} from '../public/practice.js';
import {collectPublication} from '../public/course-views.js';
import {buildW2} from '../src/w2-import.mjs';
import {fileURLToPath} from 'node:url';

const source=(await readFile(new URL('../public/fabulous.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/loadRoute\(\);\s*$/, '');
function setup(){
  const listeners={},calls=[];let release;
  // Dispatch every listener synchronously, then wait for async handlers to finish.
  const dispatch=(name,event)=>Promise.all((listeners[name]||[]).map(handler=>handler(event)));
  const button={disabled:false,dataset:{},textContent:'提交'};
  const context=vm.createContext({esc,markdown,resultView,runResultView,
    knowledgeQuestions,programmingStatement,knowledgeFeedback,exerciseFeedback,assessmentClick:()=>false,assessmentChange:()=>{},collectPublication,publicationChange:()=>{},disposeSections:()=>{},sessionStorage:{getItem:()=>'',removeItem(){},setItem(){}},
    document:{querySelector:()=>({replaceChildren(){},append(){},remove(){},setAttribute(){}}),addEventListener:(name,handler)=>(listeners[name]??=[]).push(handler),createElement:()=>({remove(){}})},
    window:{addEventListener(){}},location:{hash:'#/lesson/w1-02'},setTimeout,clearTimeout,console,AbortController,
    FormData:class{*[Symbol.iterator](){yield ['main','main'];}},
    fetch:async(path,options)=>{calls.push({path,token:options.headers.Authorization});if(path.startsWith('/api/drafts/'))await new Promise(resolve=>release=resolve);return {ok:true,status:200,json:async()=>({})};}
  });
  vm.runInContext(source,context);
  vm.runInContext('S={...fresh(),token:"account-a",lessonId:"w1-02",page:"lesson",source:"A source",answers:{},user:{id:"a"}};',context);
  return {context,dispatch,calls,button,release:()=>release()};
}
for(const action of ['fill','run-code','submit-code']){
  const test=setup();test.button.dataset.action=action;
  const operation=action==='fill'
    ? test.dispatch('submit',{preventDefault(){},target:{matches:()=>true,id:'fill-form',getAttribute:()=> 'fill-form',querySelector:()=>test.button}})
    : test.dispatch('click',{target:{closest:selector=>selector==='button'?test.button:null}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(test.calls.length,1);
  vm.runInContext('ticket++; S={...fresh(),token:"account-b",lessonId:"w1-03",page:"lesson",source:"B source",user:{id:"b"}};',test.context);
  test.release();await operation;
  assert.equal(test.calls.length,1,'A pending action must not submit using account B');
  assert.equal(vm.runInContext('S.source',test.context),'B source');
  assert.equal(vm.runInContext('S.result',test.context),null);
  console.log('PASS: switch account during '+action);
}
const draft=setup();
vm.runInContext('S.draftStatus="保存中…";',draft.context);
const save=vm.runInContext('saveDraft()',draft.context);
await new Promise(resolve=>setImmediate(resolve));
vm.runInContext('draftRevision++;S.source="newer edit";',draft.context);
draft.release();await save;
assert.equal(vm.runInContext('S.draftStatus',draft.context),'保存中…','Old save acknowledgement must not mark a newer edit saved');
console.log('PASS: newer edits remain unsaved until their own acknowledgement');
const practice=setup();
vm.runInContext('S.lesson={fillQuestions:[{id:"score",prompt:"合计多少分？",hint:"DO_NOT_REVEAL_HINT",accepts:["DO_NOT_REVEAL_ANSWER"]}]};S.progress={};',practice.context);
const html=vm.runInContext('practiceView()',practice.context);
assert.ok(!html.includes('DO_NOT_REVEAL_HINT'));
assert.ok(!html.includes('DO_NOT_REVEAL_ANSWER'));
console.log('PASS: practice hides hints and answers, including for admin preview');
const w2=await buildW2(fileURLToPath(new URL('..',import.meta.url)));
for(const lesson of w2.lessons){
 practice.context.w2Lesson=lesson;
 vm.runInContext('S.lesson=w2Lesson;S.source=w2Lesson.codeTask?.starter||"";',practice.context);
 const rendered=vm.runInContext('practiceView()',practice.context);
 assert.equal((rendered.match(/type="radio"/g)||[]).length,lesson.fillQuestions.length*4);
 assert.ok(!rendered.includes('placeholder="填写答案"'));
 assert.ok(!rendered.includes('提交填空'));
 assert.ok(rendered.includes('提交整份练习'));
 if(lesson.id==='w2-04')assert.ok(rendered.includes('<code>for (int i = 1; i &lt;= 3; i++)</code>'));
 practice.context.lessonContent=lesson.content;
 const article=vm.runInContext('markdown(lessonContent)',practice.context);
 assert.equal((article.match(/<pre class="article-code">/g)||[]).length,(lesson.content.match(/^```java/gm)||[]).length);
 assert.ok(!article.includes('```'));
}
const renderMarkdown=vm.runInContext('markdown',practice.context);
assert.equal(renderMarkdown('```java\r\n    if (i < 3) {\r\n        go();\r\n    }\r\n```\r\n'),'<pre class="article-code"><code>    if (i &lt; 3) {\n        go();\n    }</code></pre>');
assert.equal(renderMarkdown('`**literal**` 和 **重点**'),'<p><code>**literal**</code> 和 <strong>重点</strong></p>');
assert.ok(!renderMarkdown('`<script>alert(1)</script>`').includes('<script>'));
const feedback=knowledgeFeedback({score:100,status:'AC',solutions:[{id:'q',prompt:'`if` 用于什么？',correctAnswers:['条件判断']}]},renderMarkdown);
assert.ok(feedback.includes('<code>if</code>'));
console.log('PASS: W2 actual practice view renders 22 choices, Markdown stems/solutions, fenced code and CRLF without fill inputs');
const runHtml=vm.runInContext('resultView({preview:true,status:"RUN",output:"",message:"程序正常退出",timeMs:20})',practice.context);
assert.ok(runHtml.includes('（无输出）'));assert.ok(runHtml.includes('标准输出'));assert.ok(!runHtml.includes(' 分 ·'));assert.ok(!runHtml.includes('通过'));
const stdoutHtml=vm.runInContext('resultView({preview:true,status:"RUN",output:"<output>\\n",stderr:"debug",message:"程序正常退出"})',practice.context);
assert.ok(stdoutHtml.includes('&lt;output&gt;'));assert.ok(stdoutHtml.includes('标准错误'));
console.log('PASS: run renders actual output, explicit empty output and stderr without grading');
const legacy=vm.runInContext('resultView({status:"RUN",score:100,passed:1,total:1,output:"Hello",message:"程序正常退出"})',practice.context);
assert.ok(legacy.includes('标准输出'));assert.ok(!legacy.includes('100 分'));assert.ok(!legacy.includes('通过'));
assert.ok(source.includes('S.result={...result,preview:isRun}'));
console.log('PASS: legacy RUN responses and run actions use only the output panel');
const reconnect=setup();let scheduled,reads=0,painted=0;
reconnect.context.setTimeout=fn=>{scheduled=fn;return 1;};
reconnect.context.clearTimeout=()=>{};
reconnect.context.fetch=async()=>({ok:++reads>1,status:reads===1?503:200,json:async()=>reads===1?{error:'temporary snapshot gap'}:{ended:true,phase:'STOP'}});
reconnect.context.paintSim=()=>painted++;
vm.runInContext('S.sim={id:"simulation",token:S.token};pollSim("simulation",S.token);',reconnect.context);
await scheduled();assert.equal(reads,1);await scheduled();assert.equal(reads,2);assert.equal(painted,1);
console.log('PASS: simulator reconnects after transient state failure');
const adminView=setup();
vm.runInContext('S.user={id:"admin",role:"admin",displayName:"管理员",username:"admin"};',adminView.context);
const adminHtml=vm.runInContext('shell("")',adminView.context);
assert.ok(adminHtml.includes('成员活跃'));assert.ok(adminHtml.includes('课程发布'));assert.ok(!adminHtml.includes('课后练习'));assert.ok(!adminHtml.includes('学习进度'));
assert.ok(!source.includes('本地初始账号'));assert.ok(!source.includes('每个标签页单独登录'));assert.ok(source.includes('register-form'));
console.log('PASS: admin navigation is separate; demo credentials removed; registration available');

const lessonSave=setup();
lessonSave.context.collectTask=()=>null;lessonSave.context.toast=()=>{};
lessonSave.context.FormData=class{*[Symbol.iterator](){yield ['id','edited-lesson'];yield ['weekId','week-1'];yield ['position','1'];yield ['title','已修改的教程'];yield ['questions','[]'];yield ['publicationMode','draft'];}};
lessonSave.context.fetch=async(path,options)=>{lessonSave.calls.push({path,body:JSON.parse(options.body)});return {ok:true,status:200,json:async()=>({lesson:{id:'edited-lesson'}})};};
await lessonSave.dispatch('submit',{preventDefault(){},target:{matches:()=>true,id:{value:'edited-lesson'},getAttribute:()=> 'lesson-form',elements:{published:{checked:false}},querySelector:()=>lessonSave.button}});
assert.equal(lessonSave.calls.length,1);assert.equal(lessonSave.calls[0].path,'/api/admin/lessons');assert.equal(lessonSave.calls[0].body.title,'已修改的教程');
console.log('PASS: hidden input named id does not prevent lesson form submission');

const stdinRun=setup();stdinRun.button.dataset.action='run-code';
vm.runInContext('S.lesson={codeTask:{kind:"java"}};S.runInput="3\\n样例输入\\n";saveDraft=async()=>{};refreshProgress=async()=>{};renderLesson=()=>{};',stdinRun.context);
stdinRun.context.fetch=async(path,options)=>{stdinRun.calls.push({path,body:JSON.parse(options.body)});return {ok:true,status:200,json:async()=>({status:'RUN'})};};
await stdinRun.dispatch('click',{target:{closest:selector=>selector==='button'?stdinRun.button:null}});
assert.equal(stdinRun.calls[0].path,'/api/run');assert.equal(stdinRun.calls[0].body.input,'3\n样例输入\n');
console.log('PASS: lesson run action sends the current sample/custom stdin');
const listHtml=vm.runInContext('markdown("1. 外层\\n   - 内层 <script>\\n   - 第二项\\n2. 下一项")',stdinRun.context);
assert.ok(listHtml.includes('<ol><li>外层<ul><li>内层 &lt;script&gt;</li><li>第二项</li></ul></li><li>下一项</li></ol>'));
console.log('PASS: problem Markdown preserves nested ordered lists and escapes HTML');
assert.equal(vm.runInContext('done({fillQuestions:[{}],codeTask:null},{read:false,fillPassed:true})',stdinRun.context),true);
assert.equal(vm.runInContext('done({fillQuestions:[{}],codeTask:{}},{read:false,fillPassed:true,codePassed:false})',stdinRun.context),false);
assert.equal(vm.runInContext('done({fillQuestions:[],codeTask:null},{read:false})',stdinRun.context),false);
console.log('PASS: lesson completion counts passed exercises independently of the reading flag');
const unified=setup();
vm.runInContext('S.lesson={fillQuestions:[{id:"q",type:"choice",prompt:"题目",options:[{value:"A",text:"选项"}]}],codeTask:{kind:"java",title:"编程",description:"",input:"",output:"",starter:""}};S.progress={};',unified.context);
const unifiedHtml=vm.runInContext('practiceView()',unified.context);
assert.equal((unifiedHtml.match(/type="submit"/g)||[]).length,1);
assert.ok(unifiedHtml.includes('提交整份练习'));assert.ok(unifiedHtml.includes('知识题 50 分 + 编程题 50 分'));
assert.ok(!unifiedHtml.includes('data-action="submit-code"'));assert.ok(!unifiedHtml.includes('id="fill-form"'));assert.ok(unifiedHtml.includes('form="exercise-form" required'));
unified.context.FormData=class{*[Symbol.iterator](){yield ['q','A'];yield ['source','A source'];}};
const pendingExercise=unified.dispatch('submit',{preventDefault(){},target:{matches:()=>true,getAttribute:()=> 'exercise-form',querySelector:()=>unified.button}});
await new Promise(resolve=>setImmediate(resolve));assert.equal(unified.calls.length,1);
vm.runInContext('ticket++;S={...fresh(),token:"account-b",lessonId:"other",page:"lesson",source:"B source",user:{id:"b"}};',unified.context);
unified.release();await pendingExercise;assert.equal(unified.calls.length,1);
console.log('PASS: exactly one shared submit button, 50/50 policy, code linked to form and account isolation during unified submission');
