import {readdir,readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {join,extname} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {sendFile} from './file-response.mjs';
import {issuePreviewAccess} from './preview-access.mjs';
import {createDocumentPreviews} from './document-preview.mjs';

const types={'.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
const fail=(code,message)=>Object.assign(new Error(message),{code});
const maxFileSize=25*1024*1024;
export function initialMaterials(){return [
  {id:'material-w0',code:'W0',title:'课前准备：搭建编程环境',description:'准备网络环境，安装 Android Studio，熟悉 GitHub 与 Git，完成入组前的自查清单。',author:'FFFabulous · FTC 19726',sourceUrl:'',fileKey:'course/W0.docx',filename:'W0.docx',order:1,published:true},
  {id:'material-w1',code:'W1',title:'BIOBUZZ 与第一个机器人程序',description:'W1 原始教案：比赛与场地、Hello World、LinearOpMode 和迭代式 OpMode。配套教程与课后练习已上线。',author:'FFFabulous · FTC 19726',sourceUrl:'',fileKey:'course/W1.docx',filename:'W1.docx',order:2,published:true},
  {id:'material-w',code:'W',title:'总纲 · Learn Java for FTC',description:'Java 与 FTC 编程参考书，247 页，2024 年 11 月 24 日版本。保留原书内容与署名，供课程学习参考。',author:'Alan G. Smith',sourceUrl:'https://github.com/alan412/LearnJavaForFTC',fileKey:'course/LearnJavaForFTC.pdf',filename:'LearnJavaForFTC.pdf',order:0,published:true}
];}

// Register the bundled handout once its imported week is published. After that,
// preserve administrator edits, unpublishing and deletion across restarts.
export function migrateW2Material(db){
  const imported=db.imports?.w2;
  if(!imported||imported.materialRegistered||!db.weeks?.some(w=>w.id==='week-2'&&w.published))return false;
  db.materials??=[];
  if(!db.materials.some(m=>m.id==='material-w2'||m.code==='W2'||m.fileKey==='course/W2/W2.docx')){
    db.materials.push({id:'material-w2',code:'W2',title:'类、构造方法与实例对象——面向对象入门',description:'W2 原始教案：类、对象与方法、构造方法、this 与 new，以及流程控制基础。配套教程与课后练习已上线。',author:'FFFabulous · FTC 19726',sourceUrl:'',fileKey:'course/W2/W2.docx',filename:'W2.docx',order:3,published:true});
  }
  imported.materialRegistered=true;
  return true;
}

export function materialService({root,courseDir=join(root,'course'),dataDir,db,save,body,send}){
  const folders={course:courseDir,upload:join(dataDir,'material-files')};
  const validatedPreviews=new Map(),documents=createDocumentPreviews({root,dataDir});
  async function previewFor(file,options={}){
    const fallback=()=>file.type==='application/pdf'?{status:'ready',file}:documents.ensure(file,options);
    const manifest=JSON.parse(await readFile(join(courseDir,'previews','manifest.json'),'utf8').catch(e=>{if(e.code==='ENOENT')return '{}';throw e;}));
    const entry=manifest[file.fileKey];if(!entry)return fallback();
    const info=await stat(file.path),version=[info.size,info.mtimeMs,info.ctimeMs,entry.sha256].join(':');
    let valid=validatedPreviews.get(file.path);
    if(valid?.version!==version){valid={version,matches:createHash('sha256').update(await readFile(file.path)).digest('hex')===entry.sha256};validatedPreviews.set(file.path,valid);}
    if(!valid.matches)return fallback();
    const path=join(courseDir,'previews',entry.file);
    if(!await stat(path).catch(()=>null))return fallback();
    return {status:'ready',file:{path,type:'application/pdf'}};
  }
  async function files(){
    const result=[];
    async function scan(prefix,folder,relative=''){
      const entries=await readdir(folder,{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
      for(const entry of entries){
        const name=relative+entry.name,path=join(folder,entry.name);
        // Do not expose generated previews or follow symlinks outside the library.
        if(prefix==='course'&&entry.isDirectory()&&entry.name!=='previews')await scan(prefix,path,name+'/');
        if(entry.isFile()&&types[extname(entry.name).toLowerCase()])result.push({fileKey:prefix+'/'+name,filename:entry.name,size:(await stat(path)).size});
      }
    }
    for(const [prefix,folder] of Object.entries(folders)){
      await scan(prefix,folder);
    }
    return result.sort((a,b)=>a.filename.localeCompare(b.filename));
  }
  async function fileFor(key){
    const file=(await files()).find(f=>f.fileKey===key);
    if(!file)throw fail(404,'资料文件不存在，请重新选择或上传');
    const [prefix,...parts]=file.fileKey.split('/');return {...file,path:join(folders[prefix],...parts),type:types[extname(file.filename).toLowerCase()]};
  }
  return async(req,res,url,user)=>{
    const path=url.pathname,method=req.method;
    if(!path.startsWith('/api/materials')&&!path.startsWith('/api/admin/material'))return false;
    if(path.startsWith('/api/admin/')&&user.role!=='admin')throw fail(403,'仅管理员可以执行此操作');
    const visible=m=>m.published||user.role==='admin';
    if(path==='/api/materials'&&method==='GET'){
      const available=await files();
      const materials=await Promise.all(db.materials.filter(visible).sort((a,b)=>a.order-b.order).map(async m=>{const f=available.find(f=>f.fileKey===m.fileKey);const {fileKey,...item}=m;const preview=f?await previewFor(await fileFor(fileKey)):{status:'missing'};return {...item,...(user.role==='admin'?{fileKey,previewMessage:preview.message}:{}),available:!!f,previewAvailable:preview.status==='ready',previewStatus:preview.status,size:f?.size||0,format:extname(m.filename).slice(1).toUpperCase()};}));
      send(res,200,{materials});return true;
    }
    const access=path.match(/^\/api\/materials\/([^/]+)\/preview-access$/);
    if(access&&method==='POST'){
      const material=db.materials.find(m=>m.id===access[1]&&visible(m));if(!material)throw fail(404,'资料不存在或未发布');
      const preview=await previewFor(await fileFor(material.fileKey));if(preview.status!=='ready')throw fail(409,preview.status==='processing'?'阅读版正在生成，请稍后打开。':'阅读版生成失败，请管理员重试。');
      const sessionHash=createHash('sha256').update(req.headers.authorization.replace(/^Bearer /,'')).digest('hex');
      const ticket=issuePreviewAccess(sessionHash,material.id,user.id);
      send(res,200,{url:'/api/materials/'+material.id+'/preview?access='+ticket});return true;
    }
    const match=path.match(/^\/api\/materials\/([^/]+)\/(file|preview)$/);
    if(match&&['GET','HEAD'].includes(method)){
      const material=db.materials.find(m=>m.id===match[1]&&visible(m));if(!material)throw fail(404,'资料不存在或未发布');
      const original=await fileFor(material.fileKey),isPreview=match[2]==='preview',preview=isPreview?await previewFor(original):{status:'ready',file:original};
      if(preview.status!=='ready')throw fail(409,preview.status==='processing'?'阅读版正在生成，请稍后打开。':'阅读版生成失败，请管理员重试。');
      const file=preview.file;
      const filename=isPreview?material.filename.replace(/\.[^.]+$/,'.pdf'):material.filename;
      await sendFile(req,res,file,filename,isPreview);return true;
    }
    const retry=path.match(/^\/api\/admin\/materials\/([^/]+)\/preview-retry$/);
    if(retry&&method==='POST'){const material=db.materials.find(m=>m.id===retry[1]);if(!material)throw fail(404,'资料不存在');const preview=await previewFor(await fileFor(material.fileKey),{retry:true});send(res,200,{previewStatus:preview.status});return true;}
    if(path==='/api/admin/material-files'&&method==='GET'){send(res,200,{files:await files()});return true;}
    if(path==='/api/admin/material-files'&&method==='POST'){
      const filename=url.searchParams.get('filename')||'',extension=extname(filename).toLowerCase();
      if(!types[extension]||filename.length>160||/[\/\\\x00-\x1f]/.test(filename))throw fail(400,'请选择 PDF 或 DOCX 文件');
      if(Number(req.headers['content-length'])>maxFileSize)throw fail(413,'文件不能超过 25 MB');
      let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>maxFileSize)throw fail(413,'文件不能超过 25 MB');chunks.push(chunk);}
      const content=Buffer.concat(chunks);
      if(extension==='.pdf'?!content.subarray(0,5).equals(Buffer.from('%PDF-')):!content.subarray(0,4).equals(Buffer.from([0x50,0x4b,3,4])))throw fail(400,'文件内容与扩展名不符');
      const name=randomUUID()+extension;await mkdir(folders.upload,{recursive:true});await writeFile(join(folders.upload,name),content);
      send(res,201,{fileKey:'upload/'+name,filename,size});return true;
    }
    if(path==='/api/admin/materials'&&method==='POST'){
      const input=await body(req);const original=input.id?db.materials.find(m=>m.id===input.id):null;
      if(input.id&&!original)throw fail(404,'资料不存在');
      const item={id:original?.id||'material-'+randomUUID()};
      for(const [key,limit] of Object.entries({code:20,title:120,description:2000,author:120,sourceUrl:500})){
        if(typeof input[key]!=='string'||input[key].length>limit)throw fail(400,'资料字段格式错误：'+key);
        item[key]=input[key].trim();
      }
      if(!item.title||!item.code)throw fail(400,'请填写编号和标题');
      if(item.sourceUrl){let url;try{url=new URL(item.sourceUrl);}catch{}if(!url||url.protocol!=='https:'||url.username||url.password)throw fail(400,'来源链接需为 HTTPS 地址');}
      if(!Number.isInteger(input.order)||input.order<0||input.order>9999||typeof input.published!=='boolean')throw fail(400,'排序或发布状态无效');
      const file=await fileFor(input.fileKey);
      item.fileKey=file.fileKey;item.filename=typeof input.filename==='string'&&input.filename.length<=160&&!/[\/\\\x00-\x1f]/.test(input.filename)&&extname(input.filename).toLowerCase()===extname(file.filename).toLowerCase()?input.filename:file.filename;
      Object.assign(item,{order:input.order,published:input.published,updatedAt:new Date().toISOString()});
      if(original)db.materials[db.materials.indexOf(original)]=item;else db.materials.push(item);
      await save();const preview=await previewFor(file);send(res,original?200:201,{material:item,previewStatus:preview.status});return true;
    }
    const remove=path.match(/^\/api\/admin\/materials\/([^/]+)$/);
    if(remove&&method==='DELETE'){
      const index=db.materials.findIndex(m=>m.id===remove[1]);if(index<0)throw fail(404,'资料不存在');
      db.materials.splice(index,1);await save();send(res,200,{ok:true});return true;
    }
    throw fail(404,'资料接口不存在');
  };
}
