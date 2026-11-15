const library='/pdfjs/6.3.289/';
export function createPdfReader(container,url,{isCurrent,onStatus}){
  let destroyed=false,loading,pdf,renderTask,revision=0,queue=Promise.resolve(),pageNumber=1,zoom=1;
  const live=()=>!destroyed&&isCurrent();
  container.innerHTML='<div class="pdf-toolbar"><button type="button" class="secondary-btn" data-pdf-prev>上一页</button><label>页码 <input data-pdf-page type="number" min="1" value="1" aria-label="PDF 页码"></label><span data-pdf-count></span><button type="button" class="secondary-btn" data-pdf-next>下一页</button><label>缩放 <select data-pdf-zoom><option value="0.75">75%</option><option value="1" selected>适合宽度</option><option value="1.25">125%</option><option value="1.5">150%</option></select></label><a data-pdf-native target="_blank" rel="noopener noreferrer">浏览器阅读器 ↗</a></div><div class="pdf-canvas-wrap"><div class="pdf-page-stage"><canvas aria-label="PDF 当前页"></canvas><div class="pdf-links"></div></div></div><details class="pdf-page-text"><summary>查看本页文字</summary><pre></pre></details>';
  const field=container.querySelector('[data-pdf-page]'),count=container.querySelector('[data-pdf-count]'),canvas=container.querySelector('canvas'),prev=container.querySelector('[data-pdf-prev]'),next=container.querySelector('[data-pdf-next]'),wrap=container.querySelector('.pdf-canvas-wrap'),text=container.querySelector('.pdf-page-text pre'),links=container.querySelector('.pdf-links');
  container.querySelector('[data-pdf-native]').href=url;
  async function paint(rev){
    if(!live()||rev!==revision)return;
    onStatus('正在加载第 '+pageNumber+' 页…');
    links.replaceChildren();const number=pageNumber,page=await pdf.getPage(number);if(!live()||rev!==revision)return;
    const base=page.getViewport({scale:1}),width=Math.max(240,Math.min(1100,wrap.clientWidth-32));
    const viewport=page.getViewport({scale:width/base.width*zoom}),ratio=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
    renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});await renderTask.promise;
    if(!live()||rev!==revision)return;canvas.dataset.page=String(number);container.dataset.ready='true';field.value=number;count.textContent='/ '+pdf.numPages;prev.disabled=number<=1;next.disabled=number>=pdf.numPages;onStatus('第 '+number+' / '+pdf.numPages+' 页');
    const [content,annotations]=await Promise.all([page.getTextContent(),page.getAnnotations()]);if(!live()||rev!==revision)return;
    text.textContent=content.items.map(item=>item.str+(item.hasEOL?'\n':' ')).join('');
    for(const annotation of annotations){
      if((annotation.annotationType!==2&&annotation.subtype!=='Link')||!annotation.rect)continue;
      let link;
      if(annotation.url&&/^https?:\/\//i.test(annotation.url)){link=document.createElement('a');link.href=annotation.url;link.target='_blank';link.rel='noopener noreferrer';link.ariaLabel=annotation.url;}
      else if(annotation.dest){link=document.createElement('button');link.type='button';link.ariaLabel='跳转到文档中的链接';link.onclick=async()=>{try{const dest=typeof annotation.dest==='string'?await pdf.getDestination(annotation.dest):annotation.dest;if(!dest||!live())return;const target=typeof dest[0]==='number'?dest[0]:await pdf.getPageIndex(dest[0]);if(live()){pageNumber=target+1;schedule();}}catch(e){if(live())onStatus('无法跳转：'+e.message);}};}
      else continue;
      const [a,b,c,d,e,f]=viewport.transform,[x0,y0,x1,y1]=annotation.rect,rect=[a*x0+c*y0+e,b*x0+d*y0+f,a*x1+c*y1+e,b*x1+d*y1+f];Object.assign(link.style,{left:Math.min(rect[0],rect[2])+'px',top:Math.min(rect[1],rect[3])+'px',width:Math.abs(rect[2]-rect[0])+'px',height:Math.abs(rect[3]-rect[1])+'px'});links.append(link);
    }
  }
  function schedule(){const rev=++revision;renderTask?.cancel();queue=queue.catch(()=>{}).then(()=>paint(rev)).catch(e=>{if(live()&&rev===revision&&e.name!=='RenderingCancelledException')onStatus('加载失败：'+e.message+'。请重新打开资料。');});}
  prev.onclick=()=>{if(pdf&&pageNumber>1){pageNumber--;schedule();}};
  next.onclick=()=>{if(pdf&&pageNumber<pdf.numPages){pageNumber++;schedule();}};
  field.onchange=()=>{if(!pdf)return;pageNumber=Math.max(1,Math.min(pdf.numPages,Math.trunc(Number(field.value))||1));schedule();};
  container.querySelector('[data-pdf-zoom]').onchange=event=>{zoom=Number(event.target.value);if(pdf)schedule();};
  const ready=(async()=>{
    const pdfjs=await import('/pdfjs/6.3.289/pdf.mjs');if(!live())return;
    pdfjs.GlobalWorkerOptions.workerSrc=library+'pdf.worker.mjs';
    loading=pdfjs.getDocument({url,disableStream:true,disableAutoFetch:true,rangeChunkSize:65536,isEvalSupported:false,useWasm:false,cMapUrl:library+'cmaps/',standardFontDataUrl:library+'standard_fonts/',wasmUrl:library+'wasm/'});
    pdf=await loading.promise;if(!live())return;field.max=pdf.numPages;schedule();await queue;
  })().catch(e=>{if(live())onStatus('加载失败：'+e.message+'。请重新打开资料。');});
  return {ready,destroy(){destroyed=true;revision++;renderTask?.cancel();loading?.destroy().catch(()=>{});}};
}
