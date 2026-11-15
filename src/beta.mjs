import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {join,sep,delimiter} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {defaultRules} from './task-config.mjs';
import {root,dataDirectory} from './runtime-config.mjs';
const base=join(dataDirectory,'beta-work');
const childEnv=cwd=>process.platform==='win32'
 ?{SystemRoot:process.env.SystemRoot,PATH:process.env.SystemRoot+'\\System32',TEMP:cwd,TMP:cwd}
 :{PATH:'/usr/bin:/bin:/usr/sbin:/sbin',HOME:process.env.HOME,TMPDIR:cwd,TEMP:cwd,TMP:cwd};
let runtime,official;
export const betaEngine={available:false,label:'Beta8397 Virtual Robot',detail:'尚未初始化'};
const sessions=new Map();let preparing=0;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const fail=(code,message)=>Object.assign(new Error(message),{code});
export async function initBeta(sdkClasspath){official=sdkClasspath;try{runtime=JSON.parse(await readFile(join(root,'vendor/beta-build/runtime.json'),'utf8'));await mkdir(base,{recursive:true});betaEngine.available=true;betaEngine.detail='Beta8397 二维仿真 · FTC 兼容实现 · 本地独立进程';}catch(e){betaEngine.detail='请先执行 scripts/build-beta.mjs：'+e.message;}return betaEngine;}
function launch(command,args,cwd,interactive=false){
 const child=spawn(command,args,{cwd,windowsHide:true,stdio:['pipe','pipe','pipe'],env:childEnv(cwd)});
 const log={stdout:'',stderr:'',overflow:false};const append=(key,b)=>{log[key]+=b;if(log.stdout.length+log.stderr.length>131072){log[key]=log[key].slice(0,65536);log.overflow=true;child.kill();}};
 child.stdout.on('data',b=>append('stdout',b));child.stderr.on('data',b=>append('stderr',b));child.stdin.on('error',()=>{});
 const ended=new Promise(r=>{child.on('error',e=>{log.stderr+=e.message;r(-1);});child.on('close',r);});
 let timedOut=false;const timer=setTimeout(()=>{timedOut=true;child.kill();},interactive?600000:20000);timer.unref();ended.finally(()=>clearTimeout(timer));
 return {child,log,ended,get timedOut(){return timedOut;}};
}
async function compile(source){
 if(!betaEngine.available)throw fail(503,betaEngine.detail);
 if(typeof source!=='string'||!source.trim()||source.length>30000)throw fail(400,'代码不能为空且不能超过 30000 字符');
 const className=source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').match(/\bpublic\s+(?:(?:final|abstract)\s+)?class\s+([A-Za-z_$][\w$]*)/)?.[1];
 if(!className||/\bpackage\s/.test(source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'')))throw fail(400,'请使用默认包并声明 public class');
 const work=await mkdtemp(join(base,'sim-'));await mkdir(join(work,'classes'));await mkdir(join(work,'official'));
 try {
  const file=join(work,className+'.java');await writeFile(file,source);
  for(const [label,classpath,out] of [['官方 FTC SDK',official,'official'],['Beta8397 兼容层',runtime.classpath,'classes']]){
   const p=launch(runtime.javac,['-J-Xmx256m','-J-Duser.language=en','-J-Duser.country=US','-proc:none','-encoding','UTF-8','-cp',classpath,'-d',join(work,out),file],work);
   if(await p.ended!==0)throw fail(400,label+' 编译失败：\n'+p.log.stderr.split(work).join('提交目录'));
  }
  const trusted=runtime.classpath.split(delimiter),allow=trusted.map(p=>`grant codeBase "${pathToFileURL(p.endsWith('.jar')?p:p+sep).href}${p.endsWith('.jar')?'':'-'}" { permission java.security.AllPermission; };`).join('\n');
  const policy=allow+`\ngrant { permission java.util.PropertyPermission "*", "read"; permission java.io.FilePermission "${work.replaceAll('\\','/')}/classes/-", "read"; };`;
  await writeFile(join(work,'student.policy'),policy);
  return {work,className};
 }catch(e){await clean(work);throw e;}
}
async function clean(work){if(work.startsWith(base+sep))await rm(work,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
function startProcess(compiled,scenario){const {work,className}=compiled;return launch(runtime.java,['-Xmx384m','-Dfile.encoding=UTF-8','-Dprism.order=sw','-Djava.security.manager','-Djava.security.policy=='+pathToFileURL(join(work,'student.policy')).href,'-cp',runtime.classpath,'fabulous.BetaBridge',work,className,'mecanum',scenario],work,scenario==='interactive');}
async function readState(work){for(let attempt=0;;attempt++){try{return JSON.parse(await readFile(join(work,'state.json'),'utf8'));}catch(e){if(attempt>=3)throw e;await delay(25);}}}
const consoleText=p=>p.log.stdout;
export async function createSimulation(source,owner,userId){
 if(sessions.size+preparing>=3)throw fail(429,'最多同时运行 3 个仿真，请先关闭一个');
 preparing++;let compiled;
 try{compiled=await compile(source);const process=startProcess(compiled,'interactive');
  for(let i=0;i<120;i++){try{const state=await readState(compiled.work);const id=randomUUID();const s={id,owner,userId,compiled,process,created:Date.now()};sessions.set(id,s);process.ended.finally(()=>{setTimeout(()=>dispose(id).catch(()=>{}),30000).unref();});return {id,...state,engine:betaEngine.label,console:consoleText(process)};}catch{}
   if(process.child.exitCode!==null)throw fail(500,'Beta8397 启动失败：'+process.log.stderr.slice(-4000));await delay(100);
  }
  process.child.kill();await process.ended;throw fail(500,'Beta8397 启动超时：'+process.log.stderr.slice(-2000));
 }catch(e){if(compiled)await clean(compiled.work);throw e;}finally{preparing--;}
}
function session(id,owner){const s=sessions.get(id);if(!s||s.owner!==owner)throw fail(404,'仿真会话不存在');return s;}
export async function simulationState(id,owner){const s=session(id,owner);let state;try{state=await readState(s.compiled.work);}catch{throw fail(503,'仿真画面暂未就绪');}return {id,...state,engine:betaEngine.label,console:consoleText(s.process),ended:s.process.child.exitCode!==null};}
export async function simulationCommand(id,owner,input){const s=session(id,owner);let command=input.command;
 if(!['INIT','START','STOP','PAD'].includes(command))throw fail(400,'不支持的仿真操作');
 if(s.process.child.exitCode!==null)throw fail(409,'仿真进程已结束，请重新运行');
 if(command==='PAD'){const values=['x','y','turn'].map(k=>Number(input[k]??0));if(values.some(n=>!Number.isFinite(n)||n< -1||n>1))throw fail(400,'手柄值应为 -1 到 1');command='PAD '+values.join(' ')+' '+(input.a?1:0);}
 s.process.child.stdin.write(command+'\n');return {ok:true};
}
async function dispose(id){const s=sessions.get(id);if(!s)return;sessions.delete(id);if(s.process.child.exitCode===null){s.process.child.kill();await s.process.ended;}await clean(s.compiled.work);}
export async function closeSimulation(id,owner){session(id,owner);await dispose(id);return {ok:true};}
export async function closeOwnerSimulations(owner){await Promise.all([...sessions.values()].filter(s=>s.owner===owner).map(s=>dispose(s.id)));}
export async function closeUserSimulations(userId){await Promise.all([...sessions.values()].filter(s=>s.userId===userId).map(s=>dispose(s.id)));}
export async function betaJudge(source,task,runOnly){
 const result=runOnly?{preview:true,engine:betaEngine.label,status:'CE',output:'',stderr:'',timeMs:0,message:''}:{preview:false,engine:betaEngine.label,status:'CE',score:0,passed:0,total:task.tests.length,timeMs:0,output:'',cases:[],message:''};
 let compiled;try{compiled=await compile(source);}catch(e){result.message=e.message;return result;}
 try{
  for(const test of runOnly?[{}]:task.tests){
   const scenario=runOnly?'run':task.kind==='iterative'?'iterative-'+test.scenario:test.scenario;
   // Each case gets a new JVM and fresh simulator world; remove stale bridge result before launch.
   await rm(join(compiled.work,'result.json'),{force:true});
   const rules={...defaultRules(task.kind),...task.rules};
   const properties=Object.entries(rules).map(([k,v])=>k+'='+String(v).split('').map(c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join('')).join('\n');
   await writeFile(join(compiled.work,'rules.properties'),properties);
   const began=Date.now(),p=startProcess(compiled,scenario);await p.ended;let data;
   try{data=JSON.parse(await readFile(join(compiled.work,'result.json'),'utf8'));}catch{data={status:p.timedOut?'TLE':p.log.overflow?'OLE':'RE',message:p.log.stderr.slice(-4000)||'仿真未正常结束'};}
   if(p.timedOut)data={status:'TLE',message:'仿真超时'};
   const timeMs=Date.now()-began;result.timeMs+=timeMs;result.output=consoleText(p);
   if(runOnly){Object.assign(result,data);const state=await readState(compiled.work).catch(()=>null);if(state)result.output+=state.telemetryLog;return result;}
   result.cases.push({name:test.name,...data,timeMs,output:result.output});
  }
  result.passed=result.cases.filter(c=>c.status==='AC').length;result.score=Math.round(result.passed/result.total*100);result.status=result.cases.find(c=>c.status!=='AC')?.status||'AC';result.message=result.status==='AC'?'Beta8397 仿真行为检查通过':result.cases.find(c=>c.status!=='AC').message;return result;
 }finally{await clean(compiled.work);}
}
