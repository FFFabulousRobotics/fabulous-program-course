import {readdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';

export function removeAccountData(store,userId){
  if(Array.isArray(store.users))store.users=store.users.filter(user=>user.id!==userId);
  for(const key of ['sessions','drafts','compilerDrafts','progress','submissions']){
    if(Array.isArray(store[key]))store[key]=store[key].filter(item=>item.userId!==userId);
  }
}

export async function purgeAccountBackups(dataDir,userId){
  for(const name of await readdir(dataDir)){
    if(!/^backup-.*\.json$/.test(name))continue;
    const path=join(dataDir,name),before=await readFile(path,'utf8'),snapshot=JSON.parse(before);
    removeAccountData(snapshot,userId);
    const after=JSON.stringify(snapshot,null,2);
    if(after!==before){await writeFile(path+'.next',after);await rename(path+'.next',path);}
  }
}
