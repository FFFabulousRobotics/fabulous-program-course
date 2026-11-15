import {esc} from './html.js';
import {handleCodeKey} from './code-editing.js';
import {createPdfReader} from './pdf-reader.js';
const size=n=>n>=1048576?(n/1048576).toFixed(1)+' MB':Math.ceil(n/1024)+' KB';
const starter='public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, FTC 19726!");\n    }\n}\n';
const inputExample='import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        int a = scanner.nextInt();\n        int b = scanner.nextInt();\n        System.out.println(a + b);\n    }\n}\n';
let cleanup=()=>{};
export function disposeSections(){cleanup();cleanup=()=>{};}
export async function renderSection(page,ctx){
  const {app,shell,request,token,current,resultView,notifyError}=ctx;
  let alive=true,urls=[],reader,previewPoll;
  const live=()=>alive&&current();
  const api=(path,options={})=>request(path,{...options,token});
  cleanup=()=>{alive=false;clearTimeout(previewPoll);reader?.destroy();urls.forEach(url=>URL.revokeObjectURL(url));};
  const heading=(title,text)=>`<section class="page-heading"><div><p class="eyebrow">FFFABULOUS · LEARNING</p><h1>${title}</h1><p>${text}</p></div></section>`;
  async function binary(path,options={}){
    const response=await fetch(path,{...options,credentials:'omit',headers:{Authorization:'Bearer '+token,...options.headers}});
    if(!response.ok){const body=await response.json();throw Error(body.error||'文件操作失败');}
    return response;
  }
  if(page==='compiler'){
    const {draft}=await api('/api/compiler/draft');if(!live())return;
    let source=draft?.source??starter,input=draft?.input??'',revision=0,saved=0,timer,chain=Promise.resolve();
    app.innerHTML=shell(heading('在线编译','随手写一段 Java，输入数据并查看运行结果。草稿自动保存，运行不计入课程成绩。')+`<div class="compiler-layout"><section class="card compiler-editor"><div class="compiler-toolbar"><strong>Java · JDK 21</strong><label>载入示例<select id="compiler-example"><option value="">选择示例</option><option value="hello">Hello World</option><option value="input">读取输入并求和</option></select></label></div><div class="compiler-code"><pre id="compiler-lines" aria-hidden="true"></pre><textarea id="compiler-source" aria-label="Java 源代码" maxlength="30000" spellcheck="false" autocapitalize="off"></textarea></div><div class="compiler-footer"><span id="compiler-save" role="status">草稿已保存</span><button class="primary-btn" id="compiler-run">编译并运行</button></div></section><aside class="compiler-side"><section class="card compiler-input"><label for="compiler-input">标准输入（stdin）</label><p>使用 Scanner 读取；多组数据可换行输入。</p><textarea id="compiler-input" rows="9" maxlength="20000" placeholder="例如：3 5" spellcheck="false"></textarea></section><section class="card compiler-help"><h2>运行说明</h2><p>声明一个 public class，并使用 main 方法作为入口。无需声明 package。</p><p>运行时限 4 秒 · Java 堆 64 MB</p><p>括号自动配对 · Tab 缩进 · Ctrl / ⌘ + Enter 运行</p></section></aside></div><div id="compiler-output" aria-live="polite"><section class="card compiler-empty"><h2>运行结果</h2><p>点击「编译并运行」，在这里查看标准输出与错误信息。</p></section></div>`,page);
    document.title='在线编译 · FabulousProgram';
    const editor=document.querySelector('#compiler-source'),stdin=document.querySelector('#compiler-input'),lines=document.querySelector('#compiler-lines'),status=document.querySelector('#compiler-save'),run=document.querySelector('#compiler-run'),output=document.querySelector('#compiler-output');
    editor.value=source;stdin.value=input;
    const numberLines=()=>{lines.textContent=editor.value.split('\n').map((_,i)=>i+1).join('\n');};numberLines();
    function save(){
      clearTimeout(timer);if(saved===revision)return chain;
      const rev=revision,body={source,input};
      chain=chain.catch(()=>{}).then(()=>api('/api/compiler/draft',{method:'PUT',body})).then(()=>{saved=rev;if(live()&&rev===revision)status.textContent='草稿已保存';}).catch(e=>{if(live()){status.textContent='保存失败，继续编辑或运行可重试';notifyError(e);}});
      return chain;
    }
    function changed(){source=editor.value;input=stdin.value;revision++;status.textContent='正在保存…';numberLines();clearTimeout(timer);timer=setTimeout(save,500);}
    editor.addEventListener('input',changed);stdin.addEventListener('input',changed);
    editor.addEventListener('scroll',()=>{lines.scrollTop=editor.scrollTop;});
    editor.addEventListener('keydown',event=>{
      if(handleCodeKey(event))return;
      if(!event.isComposing&&(event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();run.click();}
    });
    document.querySelector('#compiler-example').addEventListener('change',event=>{if(!event.target.value)return;editor.value=event.target.value==='input'?inputExample:starter;stdin.value=event.target.value==='input'?'3 5\n':'';changed();event.target.value='';});
    run.addEventListener('click',async()=>{
      const body={source:editor.value,input:stdin.value},rev=revision;run.disabled=true;run.textContent='编译运行中…';output.innerHTML='<section class="card compiler-empty" role="status">正在编译并运行…</section>';
      try{await save();if(!live())return;const result=await api('/api/compiler/run',{method:'POST',body});if(live())output.innerHTML=(rev!==revision?'<p class="compiler-changed">代码或输入已修改，以下是上一次运行的结果。</p>':'')+resultView(result);}
      catch(e){if(live()){output.innerHTML=`<section class="card compiler-empty"><h2>运行未完成</h2><p>${esc(e.message)}</p></section>`;notifyError(e);}}
      finally{if(live()){run.disabled=false;run.textContent='编译并运行';}}
    });
    const unload=event=>{if(saved!==revision){event.preventDefault();event.returnValue='';}};
    const hide=()=>{if(saved!==revision)fetch('/api/compiler/draft',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({source,input}),credentials:'omit',keepalive:true}).catch(()=>{});};
    window.addEventListener('beforeunload',unload);window.addEventListener('pagehide',hide);
    cleanup=()=>{alive=false;clearTimeout(timer);save();window.removeEventListener('beforeunload',unload);window.removeEventListener('pagehide',hide);};
    return;
  }
  const admin=page==='materials-admin';
  let {materials}=await api('/api/materials');
  let files=admin?(await api('/api/admin/material-files')).files:[],savedPreviewKey=null;
  if(!live())return;
  app.innerHTML=shell(heading(admin?'课程资料管理':'课程资料',admin?'整理每周教案与参考书，选择文件、填写来源，并决定何时对成员发布。':'从课前准备到机器人编程，按需查阅教案与参考书。')+`<div class="materials-layout ${admin?'materials-admin':''}"><section id="material-list" class="material-list"></section>${admin?'<aside class="card material-editor" id="material-editor"></aside>':''}</div><section id="material-preview" class="card material-preview" hidden></section>`,page);
  document.title=(admin?'课程资料管理':'课程资料')+' · FabulousProgram';
  const list=document.querySelector('#material-list'),preview=document.querySelector('#material-preview');
  function cards(){clearTimeout(previewPoll);list.innerHTML=materials.map(m=>`<article class="card material-card"><div class="material-card-top"><span class="material-code">${esc(m.code)}</span><span class="material-format">${esc(m.format||m.filename.split('.').at(-1).toUpperCase())} · ${size(m.size||0)}${admin?' · '+(m.published?'已发布':'未发布'):''}</span></div><h2>${esc(m.title)}</h2><p>${esc(m.description)}</p><div class="material-author">${esc(m.author||'课程资料')}${m.sourceUrl?` · <a href="${esc(m.sourceUrl)}" target="_blank" rel="noopener noreferrer">原作者来源 ↗</a>`:''}</div><div class="material-actions">${m.available?`${m.previewAvailable?`<button class="primary-btn" data-preview="${m.id}">在线阅读</button>`:m.previewStatus==='processing'?'<button class="secondary-btn" disabled>正在生成阅读版…</button>':m.previewStatus==='failed'?`<span class="preview-failure">阅读版生成失败</span>${admin?`<button class="secondary-btn" data-preview-retry="${m.id}">重试生成</button>`:''}`:''}<button class="secondary-btn" data-download="${m.id}">下载原文件</button>`:'<span class="muted">文件暂不可用</span>'}${m.id==='material-w1'&&!admin?'<a class="ghost-btn" href="#/dashboard">配套教程与练习 →</a>':''}${admin?`<button class="ghost-btn" data-edit="${m.id}">编辑资料</button>`:''}</div></article>`).join('')||'<section class="card compiler-empty"><h2>暂无课程资料</h2><p>管理员发布后，资料会出现在这里。</p></section>';if(materials.some(m=>m.previewStatus==='processing'))previewPoll=setTimeout(refreshMaterialPreviews,1500);}
  async function refreshMaterialPreviews(){try{const data=await api('/api/materials');if(live()){materials=data.materials;cards();const saved=materials.find(m=>m.fileKey===savedPreviewKey),note=document.querySelector('#material-note');if(note?.textContent==='资料已保存，正在生成在线阅读版…'&&saved&&saved.previewStatus!=='processing')note.textContent=saved.previewStatus==='ready'?'资料已保存，在线阅读版已就绪。':'资料已保存，阅读版生成失败，请重试生成。';}}catch(e){if(live()&&!e.stale)previewPoll=setTimeout(refreshMaterialPreviews,3000);}}
  cards();
  let previewRequest=0;
  async function openFile(id,inline,button){
    const m=materials.find(m=>m.id===id);button.disabled=true;
    const requestId=inline?++previewRequest:0;
    if(inline){reader?.destroy();preview.hidden=false;preview.innerHTML=`<div class="preview-head"><h2>${esc(m.title)}</h2><button class="ghost-btn" id="preview-close">关闭阅读</button></div><p id="preview-status" role="status">正在打开阅读器…</p><div id="preview-content"></div>`;preview.querySelector('#preview-close').onclick=()=>{previewRequest++;reader?.destroy();preview.hidden=true;preview.replaceChildren();};preview.scrollIntoView({behavior:'smooth'});}
    try{
      if(inline){
        const access=await api('/api/materials/'+id+'/preview-access',{method:'POST',body:{}});
        if(!live()||requestId!==previewRequest)return;
        reader=createPdfReader(preview.querySelector('#preview-content'),access.url,{isCurrent:()=>live()&&requestId===previewRequest,onStatus:message=>{if(live()&&requestId===previewRequest)preview.querySelector('#preview-status').textContent=message;}});
      }else{
        const response=await binary('/api/materials/'+id+'/file'),blob=await response.blob();if(!live())return;
        const url=URL.createObjectURL(blob);urls.push(url);const link=document.createElement('a');link.href=url;link.download=m.filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
      }
    }catch(e){if(live()){if(inline&&requestId===previewRequest)preview.querySelector('#preview-status').textContent='打开失败：'+e.message+'。请重新点击在线阅读。';notifyError(e);}}finally{if(live())button.disabled=false;}
  }
  list.addEventListener('click',async event=>{const b=event.target.closest('button');if(!b)return;if(b.dataset.download)openFile(b.dataset.download,false,b);if(b.dataset.preview)openFile(b.dataset.preview,true,b);if(b.dataset.previewRetry){b.disabled=true;try{await api('/api/admin/materials/'+b.dataset.previewRetry+'/preview-retry',{method:'POST',body:{}});await refreshMaterialPreviews();}catch(e){if(live())notifyError(e);}finally{if(live())b.disabled=false;}}if(b.dataset.edit){edit(materials.find(m=>m.id===b.dataset.edit));document.querySelector('#material-editor').scrollIntoView({behavior:'smooth',block:'start'});}});
  function edit(m={code:'',title:'',description:'',author:'',sourceUrl:'',order:materials.length,published:false}){
    const panel=document.querySelector('#material-editor');let fileKey=m.fileKey||'',filename=m.filename||'';
    panel.innerHTML=`<div class="preview-head"><h2>${m.id?'编辑资料':'添加资料'}</h2>${m.id?'<button type="button" class="ghost-btn" id="material-new">新建</button>':''}</div><form id="material-form"><div class="form-grid"><label>编号<input name="code" value="${esc(m.code)}" placeholder="例如 W2" maxlength="20" required></label><label>排序<input name="order" type="number" min="0" max="9999" value="${m.order}" required></label></div><label>标题<input name="title" value="${esc(m.title)}" maxlength="120" required></label><label>简介<textarea name="description" rows="4" maxlength="2000">${esc(m.description)}</textarea></label><label>作者 / 来源署名<input name="author" value="${esc(m.author)}" maxlength="120"></label><label>来源链接<input name="sourceUrl" type="url" value="${esc(m.sourceUrl)}" placeholder="https://…" maxlength="500"></label><label>已有资料文件<select id="material-file"><option value="">请选择文件</option>${files.map(f=>`<option value="${esc(f.fileKey)}" ${f.fileKey===fileKey?'selected':''}>${esc(f.fileKey.startsWith('course/')?f.filename:(materials.find(m=>m.fileKey===f.fileKey)?.filename||f.filename))}</option>`).join('')}</select></label><label>或上传文件<input id="material-upload" type="file" accept=".pdf,.docx"></label><small>PDF / DOCX，最大 25 MB。保存 Word 文件后会自动生成在线阅读版。</small><p id="material-file-note">${esc(filename||'尚未选择文件')}</p><label class="check-line"><input name="published" type="checkbox" ${m.published?'checked':''}>对成员发布</label><button class="primary-btn" type="submit">保存资料</button><p id="material-note" role="status"></p>${m.id?'<button type="button" class="ghost-btn danger-text" id="material-remove">删除资料条目</button><div id="material-remove-confirm" hidden><p>删除后成员将无法访问此条目，原文件保留。</p><button type="button" class="danger-btn" id="material-remove-yes">确认删除条目</button></div>':''}</form>`;
    const form=panel.querySelector('form'),note=panel.querySelector('#material-note'),saveButton=form.querySelector('button[type="submit"]');
    panel.querySelector('#material-new')?.addEventListener('click',()=>edit());
    panel.querySelector('#material-file').addEventListener('change',event=>{fileKey=event.target.value;filename=files.find(f=>f.fileKey===fileKey)?.filename||'';panel.querySelector('#material-upload').value='';panel.querySelector('#material-file-note').textContent=filename;});
    panel.querySelector('#material-upload').addEventListener('change',event=>{panel.querySelector('#material-file-note').textContent=event.target.files[0]?.name||filename;});
    form.addEventListener('submit',async event=>{
      event.preventDefault();event.stopPropagation();saveButton.disabled=true;note.textContent='正在保存…';
      const input=Object.fromEntries(new FormData(form));Object.assign(input,{id:m.id,order:Number(input.order),published:form.elements.published.checked});
      const upload=panel.querySelector('#material-upload').files[0];
      try{
        if(upload){if(upload.size>25*1024*1024)throw Error('文件不能超过 25 MB');note.textContent='正在上传文件…';const response=await binary('/api/admin/material-files?filename='+encodeURIComponent(upload.name),{method:'POST',body:upload,headers:{'Content-Type':'application/octet-stream'}});const file=await response.json();fileKey=file.fileKey;filename=file.filename;files.push(file);}
        if(!live())return;if(!fileKey)throw Error('请选择或上传资料文件');
        await api('/api/admin/materials',{method:'POST',body:{...input,fileKey,filename}});
        if(live()){savedPreviewKey=fileKey;previewRequest++;reader?.destroy();preview.hidden=true;preview.replaceChildren();}
        const data=await api('/api/materials');if(!live())return;materials=data.materials;cards();edit(m.id?materials.find(item=>item.id===m.id):undefined);panel.querySelector('#material-note').textContent=materials.some(item=>item.fileKey===fileKey&&item.previewStatus==='processing')?'资料已保存，正在生成在线阅读版…':'资料已保存';
      }catch(e){if(live()){note.textContent=e.message;notifyError(e);}}finally{if(live())saveButton.disabled=false;}
    });
    panel.querySelector('#material-remove')?.addEventListener('click',()=>{panel.querySelector('#material-remove-confirm').hidden=false;});
    panel.querySelector('#material-remove-yes')?.addEventListener('click',async event=>{event.target.disabled=true;try{await api('/api/admin/materials/'+m.id,{method:'DELETE'});if(live()){materials=materials.filter(item=>item.id!==m.id);cards();edit();}}catch(e){if(live()){notifyError(e);event.target.disabled=false;}}});
  }
  if(admin)edit();
}
