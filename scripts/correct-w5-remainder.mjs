import {productionPort} from '../src/service-config.mjs';
import {readFile,writeFile,rename,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import net from 'node:net';
import {correctW5Remainder} from '../src/w5-remainder-correction.mjs';
import {lessonAcScore} from '../src/learning-results.mjs';

const root=resolve(import.meta.dirname,'..'),data=resolve(process.env.FP_DATA_DIR||join(root,'data')),file=join(data,'store.json');
const source=await readFile(join(root,'course/W5/exercises.json'),'utf8'),digest=createHash('sha256').update(source).digest('hex');
const before=JSON.parse(await readFile(file,'utf8')),db=structuredClone(before),changes=correctW5Remainder(db,{digest});
for(const c of changes){const lesson=db.lessons.find(l=>l.id==='w5-special-planner');console.log(JSON.stringify({...c,username:db.users.find(u=>u.id===c.userId)?.username,firstScore:lessonAcScore(db.submissions.filter(r=>r.userId===c.userId),lesson).firstScore}));}
if(process.argv.includes('--apply')){
 if(!process.argv.includes('--server-stopped'))throw Error('请先停止后台，再使用--server-stopped');
 const listening=await new Promise((done,reject)=>{const s=net.connect({host:'127.0.0.1',port:Number(process.env.PORT||productionPort)});s.once('connect',()=>{s.destroy();done(true);});s.once('error',e=>e.code==='ECONNREFUSED'?done(false):reject(e));s.setTimeout(3000,()=>{s.destroy();reject(Error('无法确认后台已停止'));});});
 if(listening)throw Error('后台仍在监听，拒绝修改正式数据');
 if(JSON.stringify(before)!==JSON.stringify(db)){
  const backup=join(data,'backup-before-w5-remainder-'+Date.now()+'.json');await copyFile(file,backup);
  await writeFile(file+'.next',JSON.stringify(db,null,2));await rename(file+'.next',file);console.log('已更正'+changes.length+'份答卷；备份：'+backup);
 }else console.log('已修正，无需重复补分');
}else console.log('预览完成，未写入数据。需更正答卷：'+changes.length);
