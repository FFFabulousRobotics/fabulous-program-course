import {readFile,writeFile,mkdir,mkdtemp,rename,rm,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';

const activeConverters=new Set();
function terminate(child){try{if(process.platform==='win32')child.kill();else process.kill(-child.pid,'SIGKILL');}catch{}}
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{for(const child of activeConverters)terminate(child);process.exit(0);});
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

export function createDocumentPreviews({root,dataDir}){
  const cache=join(dataDir,'material-previews'),jobs=new Map(),digests=new Map();
  let queue=Promise.resolve(),pending=0;
  async function digest(file){
    const info=await stat(file.path),version=[info.size,info.mtimeMs,info.ctimeMs].join(':');
    let entry=digests.get(file.path);
    if(entry?.version!==version){entry={version,hash:createHash('sha256').update(await readFile(file.path)).digest('hex')};digests.set(file.path,entry);}
    return entry.hash;
  }
  async function convert(file,hash,destination){
    let work;
    try{
      const config=JSON.parse(await readFile(join(root,'sdk/preview-runtime.json'),'utf8').catch(e=>{if(e.code!=='ENOENT')throw e;return '{}';}));
      const executable=process.env.FP_SOFFICE_PATH||config.soffice||'soffice';
      const fontDirectories=config.fontDirectories??(process.platform==='darwin'?['/System/Library/Fonts','/Library/Fonts']:[]);
      const cjkFont=config.cjkFont??(process.platform==='darwin'?'Heiti SC':'sans-serif');
      await mkdir(cache,{recursive:true});work=await mkdtemp(join(cache,'work-'));
      const bytes=await readFile(file.path);
      if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('Source changed during conversion');
      await writeFile(join(work,'document.docx'),bytes);
      const profile=join(work,'profile');await mkdir(join(profile,'user'),{recursive:true});
      await writeFile(join(profile,'user/registrymodifications.xcu'),'<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item></oor:items>');
      const env={...process.env};
      if(fontDirectories.length){
        const cjk=cjkFont;
        const aliases=['Microsoft YaHei','微软雅黑','SimHei','黑体'].map(font=>`<alias><family>${xml(font)}</family><prefer><family>${xml(cjk)}</family></prefer></alias>`).join('');
        const fonts=`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig>${fontDirectories.map(dir=>'<dir>'+xml(dir)+'</dir>').join('')}<cachedir>${xml(join(cache,'font-cache'))}</cachedir>${aliases}<alias><family>monospace</family><prefer><family>Menlo</family><family>${xml(cjk)}</family></prefer></alias></fontconfig>`;
        await writeFile(join(work,'fonts.conf'),fonts);env.FONTCONFIG_FILE=join(work,'fonts.conf');
      }
      await new Promise((resolve,reject)=>{
        const child=spawn(executable,['-env:UserInstallation='+pathToFileURL(profile).href,'--headless','--invisible','--norestore','--convert-to','pdf:writer_pdf_Export','--outdir',work,join(work,'document.docx')],{env,cwd:work,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});
        activeConverters.add(child);let output='',timedOut=false;
        for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>{output=(output+bytes).slice(-4000);});
        const timeout=setTimeout(()=>{timedOut=true;terminate(child);},90000);
        const finish=()=>{clearTimeout(timeout);activeConverters.delete(child);};
        child.once('error',e=>{finish();reject(e);});
        child.once('close',code=>{finish();if(code===0&&!timedOut)resolve();else reject(Error(timedOut?'Preview conversion timed out':'Preview converter failed: '+output));});
      });
      const output=join(work,'document.pdf'),pdf=await readFile(output);
      if(!pdf.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('Converter did not produce a PDF');
      // The content-addressed file is published only once conversion is complete.
      await rename(output,destination);
    }finally{if(work)await rm(work,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
  }
  async function ensure(file,{retry=false}={}){
    const hash=await digest(file),path=join(cache,hash+'.pdf');
    if((await stat(path).catch(()=>null))?.size>5)return {status:'ready',file:{path,type:'application/pdf'}};
    const existing=jobs.get(hash);if(existing&&!(retry&&existing.status==='failed'))return {...existing};
    if(pending>=16)return {status:'failed',message:'预览生成队列繁忙，请稍后重试。'};
    const job={status:'processing'};jobs.set(hash,job);pending++;
    queue=queue.catch(()=>{}).then(async()=>{
      try{await convert(file,hash,path);job.status='ready';job.file={path,type:'application/pdf'};}
      catch(e){job.status='failed';job.message='暂时无法生成阅读版，请重试或重新上传 Word 文件。';console.error('[document preview]',e.message);}
      finally{pending--;}
    });
    return {status:'processing'};
  }
  return {ensure,wait:()=>queue};
}
