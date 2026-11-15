import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir, mkdtemp, rm } from 'node:fs/promises';
import { join, delimiter, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import {initBeta,betaJudge,betaEngine} from './beta.mjs';
import {w5Rubrics} from './w5-config.mjs';
import {w6SyntaxParts} from './w6-config.mjs';
import {root,dataDirectory,javaToolchain,ftcVersion} from './runtime-config.mjs';

const sdk=join(root,'sdk');
let java, javac, sdkClasspath;
export let engine={mode:'unavailable',label:'评测环境准备中'};
const childEnv=cwd=>process.platform==='win32'
  ?{SystemRoot:process.env.SystemRoot,TEMP:cwd,TMP:cwd,PATH:process.env.SystemRoot+'\\System32'}
  :{PATH:'/usr/bin:/bin:/usr/sbin:/sbin',HOME:process.env.HOME,TMPDIR:cwd,TEMP:cwd,TMP:cwd};
export function processRun(command,args,{cwd,timeout=6000,input=''}={}) {
  return new Promise(resolveResult=>{
    let stdout='',stderr='',limit=false,timedOut=false,done=false;
    const started=performance.now();
    const child=spawn(command,args,{cwd,windowsHide:true,stdio:['pipe','pipe','pipe'],env:childEnv(cwd)});
    const finish=extra=>{ if(done)return;done=true;clearTimeout(timer);resolveResult({stdout,stderr,timeMs:Math.round(performance.now()-started),limit,timedOut,...extra}); };
    const timer=setTimeout(()=>{timedOut=true;child.kill();},timeout);
    for(const [stream,key] of [[child.stdout,'stdout'],[child.stderr,'stderr']]) stream.on('data',buf=>{ if(key==='stdout')stdout+=buf;else stderr+=buf;if(stdout.length+stderr.length>65536){limit=true;child.kill();} });
    child.on('error',e=>finish({error:e.message,code:-1}));child.on('close',code=>finish({code}));child.stdin.on('error',()=>{});child.stdin.end(input);
  });
}
export async function initJudge() {
  try {
    ({java,javac}=await javaToolchain());
    const probe=await processRun(javac,['-version'],{cwd:sdk});
    if(probe.code!==0)throw Error(probe.error||probe.stderr||'JDK unavailable');
    sdkClasspath=(await readdir(sdk)).filter(n=>n.endsWith('.jar')&&!n.includes('sources')).map(n=>join(sdk,n)).join(delimiter);
    await initBeta(sdkClasspath);
    await mkdir(join(sdk,'harness'),{recursive:true});
    const compile=await processRun(javac,['-encoding','UTF-8','-cp',sdkClasspath,'-d',join(sdk,'harness'),...['JudgeHarness','SodaHarness','W5Harness','W6Harness'].map(name=>join(root,'judge-src','fabulous',name+'.java'))],{cwd:sdk,timeout:15000});
    if(compile.code!==0)throw Error(compile.stderr);
    engine={mode:'local-jdk',label:'JDK 21 + FTC SDK '+ftcVersion,version:ftcVersion,simulator:betaEngine,detail:'Java 真实运行；机器人代码由官方 SDK 编译检查，再用 Beta8397 兼容层与二维物理世界运行，未连接实体机器人'};
  } catch(e) { engine={mode:'unavailable',label:'真实评测环境不可用',detail:e.message};console.error(e); }
  return engine;
}
let tail=Promise.resolve(); let pending=0;
export async function judge(source, task, runOnly=false) {
  if(engine.mode==='unavailable')throw Error('真实评测环境不可用：'+engine.detail);
  if(typeof source!=='string'||!source.trim()||source.length>30000)throw Error('代码不能为空且不能超过 30000 字符');
  if(pending>=8)throw Error('评测队列繁忙，请稍后重试');
  pending++;
  const job=tail.catch(()=>{}).then(()=>task.kind==='java'?execute(source,task,runOnly):betaJudge(source,task,runOnly));
  tail=job;try{return await job;}finally{pending--;}
}
async function execute(source,task,runOnly) {
  const base=join(dataDirectory,'judge-work');await mkdir(base,{recursive:true});
  const work=await mkdtemp(join(base,'run-'));
  const result=runOnly
    ? {engine:engine.label,preview:true,status:'CE',timeMs:0,output:'',stderr:'',message:''}
    : {engine:engine.label,preview:false,status:'CE',score:0,passed:0,total:task.tests.length,timeMs:0,cases:[],output:'',message:''};
  try {
    const clean=source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
    if(/\bpackage\s/.test(clean)){result.message='本周提交请使用默认包，移除 package 声明。';return result;}
    const className=task.grader?'Main':clean.match(/\bpublic\s+(?:(?:final|abstract)\s+)?class\s+([A-Za-z_$][\w$]*)/)?.[1];
    if(!className){result.message='请声明一个 public class，网站会以类名创建 Java 文件。';return result;}
    const classDir=join(work,'classes');await mkdir(classDir);
    await writeFile(join(work,className+'.java'),source,'utf8');
    const harness=join(sdk,'harness'),starterFile=join(work,'starter.txt');
    const w6=task.grader==='w6-oop-v1',dedicated=w6?'fabulous.W6Harness':task.grader==='w5-v1'?'fabulous.W5Harness':'fabulous.SodaHarness';
    if(task.grader&&!w6){
      await writeFile(starterFile,task.starter);
      const report=join(work,'main-contract.txt');
      // Only the trusted parser is on this classpath. It parses source as data;
      // no student class is compiled or loaded in this process.
      const contract=await processRun(java,['-Xmx64m','-Dfile.encoding=UTF-8','-cp',harness,dedicated,'main-contract',report,join(work,className+'.java'),starterFile],{cwd:work,timeout:4000});
      const verdict=await readFile(report,'utf8').catch(()=> '');
      if(contract.code!==0||!verdict)throw Object.assign(Error('主程序校验暂时失败，请稍后重试，本次不计入提交'),{code:503});
      if(!verdict.startsWith('AC|'))throw Object.assign(Error('Main 主程序不可修改；请只补全 '+(task.answerClass||'Soda')+' 类，本次不计入提交'),{code:400});
    }
    const compile=await processRun(javac,['-J-Xmx128m','-J-Duser.language=en','-J-Duser.country=US','-proc:none','-encoding','UTF-8','-cp',sdkClasspath,'-d',classDir,join(work,className+'.java')],{cwd:work,timeout:15000});
    if(compile.code!==0){result.status=compile.timedOut?'TLE':'CE';result.message=(compile.error||compile.stderr||'编译失败').split(work).join('提交目录');return result;}
    const rubric=!!task.grader&&!runOnly;
    if(rubric){result.points=0;result.maxPoints=40;}
    // Full privilege belongs exclusively to trusted harness and official SDK domains.
    // Student bytecode has only read access to its classes and SDK, never user files/network/exec.
    const filePerm=p=>p.replaceAll('\\','/');
    const policy=`grant codeBase "${pathToFileURL(harness+sep).href}-" { permission java.security.AllPermission; };\ngrant codeBase "${pathToFileURL(sdk+sep).href}*" { permission java.security.AllPermission; };\ngrant { permission java.util.PropertyPermission "*", "read"; permission java.io.FilePermission "${filePerm(classDir)}/-", "read"; permission java.io.FilePermission "${filePerm(sdk)}/-", "read"; };`;
    const policyFile=join(work,'judge.policy');await writeFile(policyFile,policy);
    // Run executes once and never reads a task's expected answers or test scenarios.
    for(const test of runOnly?[{}]:task.tests) {
      const report=join(work,'report.txt');await rm(report,{force:true});
      let syntaxFailure=null;
      if(rubric&&((task.grader==='w5-v1'&&w5Rubrics[task.variant]?.syntaxPart===test.scenario)||(w6&&w6SyntaxParts.has(test.scenario)))){
        const syntax=await processRun(java,['-Xmx64m','-Dfile.encoding=UTF-8','-cp',harness,dedicated,'syntax-'+test.scenario,report,join(work,className+'.java'),...(w6?[]:[starterFile,task.variant])],{cwd:work,timeout:4000});
        const verdict=await readFile(report,'utf8').catch(()=> '');
        if(syntax.code!==0||!verdict)throw Object.assign(Error('语法结构检查暂时失败，请重试，本次不计入提交'),{code:503});
        if(verdict.startsWith('AC|'))await rm(report,{force:true});else syntaxFailure=syntax;
      }
      const rubricArgs=w6?[dedicated,test.scenario,report,join(work,className+'.java'),classDir,join(root,'course/W6/io-tests.txt')]:[dedicated,test.scenario,report,join(work,className+'.java'),starterFile,...(task.grader==='w5-v1'?[task.variant]:[])];
      const run=syntaxFailure||await processRun(java,['-Xmx64m','-XX:MaxMetaspaceSize=96m','-Dfile.encoding=UTF-8',...(rubric&&task.grader==='soda-v1'&&test.scenario==='structure'?[]:['-Djava.security.manager',`-Djava.security.policy==${pathToFileURL(policyFile).href}`]),'-cp',[harness,classDir,sdkClasspath].join(delimiter),...(rubric?rubricArgs:['fabulous.JudgeHarness',className,task.kind,test.scenario||'default',report,runOnly?'run':'judge'])],{cwd:work,timeout:4000,input:runOnly?(task.runInput||''):test.input||''});
      let status='RE',message=run.error||run.stderr;
      let output=run.stdout.replace(/\r\n/g,'\n');
      if(run.timedOut){status='TLE';message='运行超过 4 秒';}
      else if(run.limit){status='OLE';message='输出超过 64 KB';}
      else if(run.code===0) {
        const reported=await readFile(report,'utf8').catch(()=> 'RE|程序提前退出，测试未完成');
        const split=reported.indexOf('|');status=reported.slice(0,split);message=reported.slice(split+1);
        if(!runOnly&&task.kind==='java'&&status==='RUN'){const normalize=x=>{x=String(x).replace(/\r\n/g,'\n');return task.compare==='exact'?x:task.compare==='tokens'?x.trim().split(/\s+/).join(' '):x.trimEnd();};status=normalize(output)===normalize(test.expected)?'AC':'WA';message=status==='WA'?'输出与期望不一致':'输出符合题目要求';}
      }
      result.timeMs+=run.timeMs;result.output=output;
      if(runOnly){result.status=status;result.message=message.slice(0,5000);result.stderr=run.stderr.replace(/^WARNING: (?:A command line option has enabled the Security Manager|The Security Manager is deprecated and will be removed in a future release)\r?\n/gm,'');return result;}
      if(rubric)result.points+=status==='AC'?test.points:0;
      result.cases.push({name:test.name,...(rubric?{points:status==='AC'?test.points:0,maxPoints:test.points}:{}),status,message:message.slice(0,5000),timeMs:run.timeMs,output,expected:status==='WA'?test.expected:undefined});
    }
    result.passed=result.cases.filter(c=>c.status==='AC').length;
    result.score=rubric?Math.round(result.points/40*10000)/100:Math.round(result.passed/result.total*100);
    result.status=result.cases.find(c=>c.status!=='AC')?.status||'AC';
    result.message=result.passed===result.total?`${result.passed}/${result.total} 个真实测试通过`:result.cases.find(c=>c.status!=='AC')?.message;
    return result;
  } finally { if(work.startsWith(base+sep))await rm(work,{recursive:true,force:true}); }
}
