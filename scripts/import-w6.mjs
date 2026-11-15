import {productionPort} from '../src/service-config.mjs';
import {readFile,writeFile,rename,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import net from 'node:net';
import {importW6} from '../src/w6-import.mjs';
const root=resolve(import.meta.dirname,'..'),data=resolve(process.env.FP_DATA_DIR||join(root,'data')),file=join(data,'store.json');
const args=new Set(process.argv.slice(2)),published=args.has('--publish'),before=JSON.parse(await readFile(file,'utf8')),db=structuredClone(before);
const changed=await importW6(db,root,{published});
console.log(JSON.stringify({changed,published,lesson:'w6-oop',questions:10,knowledgePoints:60,programmingPoints:40},null,2));
if(args.has('--apply')&&changed){
 if(!args.has('--server-stopped'))throw Error('请先停止后台，再指定--server-stopped');
 const listening=await new Promise((done,reject)=>{const s=net.connect({host:'127.0.0.1',port:Number(process.env.PORT||productionPort)});s.once('connect',()=>{s.destroy();done(true);});s.once('error',e=>e.code==='ECONNREFUSED'?done(false):reject(e));s.setTimeout(3000,()=>{s.destroy();reject(Error('无法确认后台已停止'));});});
 if(listening)throw Error('后台仍在监听，拒绝修改正式数据');
 const backup=join(data,'backup-before-w6-'+Date.now()+'.json');await copyFile(file,backup);
 if(published){db.courseSettings||={};db.courseSettings.homeWeekId='week-6';}
 await writeFile(file+'.next',JSON.stringify(db,null,2));await rename(file+'.next',file);console.log('W6已导入，备份：'+backup);
}
