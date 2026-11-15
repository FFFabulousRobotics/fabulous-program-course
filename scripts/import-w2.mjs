import {readFile,writeFile,copyFile,rename} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {buildW2,installW2} from '../src/w2-import.mjs';
const root=resolve(import.meta.dirname,'..'),bundle=await buildW2(root);
if(!process.argv.includes('--apply')){
 console.log(JSON.stringify({week:bundle.week,lessons:bundle.lessons.map(l=>({id:l.id,title:l.title,questions:l.fillQuestions.length,tests:l.codeTask?.tests.length||0,publishAt:l.publishAt})),signature:bundle.signature},null,2));
}else{
 if(!process.argv.includes('--server-stopped'))throw Error('请先停止使用该数据目录的后台服务，再指定 --server-stopped');
 const file=join(resolve(process.env.FP_DATA_DIR||join(root,'data')),'store.json');
 const db=JSON.parse(await readFile(file,'utf8'));
 if(installW2(db,bundle)){
  const backup=join(dirname(file),'backup-before-w2-'+Date.now()+'.json');await copyFile(file,backup);
  await writeFile(file+'.w2-next',JSON.stringify(db,null,2));await rename(file+'.w2-next',file);
  console.log('已导入 W2 四篇教程、22 道单选题、10 个编程测试点；预约北京时间 2026-09-20 19:00。备份：'+backup);
 }else console.log('W2 已导入，本次未修改已有课程。');
}
