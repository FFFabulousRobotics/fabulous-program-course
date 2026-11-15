import {readFile,writeFile,copyFile,rename} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {correctW1Flower} from '../src/w1-flower-correction.mjs';
import {submissionStats,lessonAcScore} from '../src/learning-results.mjs';
import {lessonVisible} from '../src/course-structure.mjs';
const dataDir=resolve(process.env.FP_DATA_DIR||join(import.meta.dirname,'../data')),file=join(dataDir,'store.json');
const before=JSON.parse(await readFile(file,'utf8')),db=structuredClone(before),changes=correctW1Flower(db);
for(const userId of new Set(changes.map(c=>c.userId))){
 const user=db.users.find(u=>u.id===userId),lesson=db.lessons.find(l=>l.id==='w1-01');
 const stats=d=>({firstScore:lessonAcScore(d.submissions.filter(s=>s.userId===userId),lesson).firstScore,rate:submissionStats(d.submissions.filter(s=>s.userId===userId),d.lessons.filter(l=>lessonVisible(d,l,user))).rate});
 console.log(JSON.stringify({username:user.username,before:stats(before),after:stats(db)}));
}
if(process.argv.includes('--apply')){
 if(!process.argv.includes('--server-stopped'))throw Error('请先停止使用该数据目录的服务，再指定 --server-stopped');
 if(JSON.stringify(before)!==JSON.stringify(db)){
  const backup=join(dataDir,'backup-before-w1-flower-'+Date.now()+'.json');await copyFile(file,backup);
  await writeFile(file+'.flower-next',JSON.stringify(db,null,2));await rename(file+'.flower-next',file);
  console.log('已修订题干与教程、补偿 '+changes.length+' 条提交。备份：'+backup);
 }else console.log('修订已完成，无需重复补分。');
}else console.log('预览完成，未写入数据。补偿提交数：'+changes.length);
