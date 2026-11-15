const pairs={'(':')','[':']','{':'}'};
const indentWidth=4;
const isQuote=key=>key==="'"||key==='"';
function escaped(text,pos){let count=0;while(pos>0&&text[--pos]==='\\')count++;return count%2===1;}

// Track Java strings/comments so pairing never changes their literal contents.
function contextAt(text,end){
 let mode='code';
 for(let i=0;i<end;i++){
  const c=text[i],next=text[i+1];
  if(mode==='line'){if(c==='\n')mode='code';continue;}
  if(mode==='block'){if(c==='*'&&next==='/'){mode='code';i++;}continue;}
  if(mode==='text'){if(c==='\\'){i++;continue;}if(text.slice(i,i+3)==='"""'){mode='code';i+=2;}continue;}
  if(mode==='"'||mode==="'"){if(c==='\\')i++;else if(c===mode||c==='\n')mode='code';continue;}
  if(c==='/'&&next==='/'){mode='line';i++;}
  else if(c==='/'&&next==='*'){mode='block';i++;}
  else if(text.slice(i,i+3)==='"""'){mode='text';i+=2;}
  else if(c==='"'||c==="'")mode=c;
 }
 return mode;
}

function replace(editor,start,end,text,caret,selectionEnd=caret){
 if(editor.maxLength>=0&&editor.value.length-(end-start)+text.length>editor.maxLength)return;
 editor.setSelectionRange(start,end);
 const doc=editor.ownerDocument;
 let inserted=false,notified=false;
 const onInput=()=>{notified=true;};
 editor.addEventListener('input',onInput);
 try{
  // Native insertion preserves the browser's undo stack where supported.
  if(doc?.activeElement===editor&&typeof doc.execCommand==='function'){
   try{inserted=doc.execCommand('insertText',false,text);}catch{}
  }
  if(!inserted)editor.setRangeText(text,start,end,'end');
 }finally{editor.removeEventListener('input',onInput);}
 editor.setSelectionRange(caret,selectionEnd);
 if(!notified)editor.dispatchEvent(new Event('input',{bubbles:true}));
}

export function handleCodeKey(event){
 const editor=event.target;
 if(event.defaultPrevented||event.isComposing||event.keyCode===229||event.ctrlKey||event.metaKey||event.altKey||editor.readOnly||editor.disabled)return false;
 const {value:text,selectionStart:start,selectionEnd:end}=editor,key=event.key;
 const context=contextAt(text,start),code=context==='code',empty=start===end;
 if(empty&&isQuote(key)&&context===key&&text[start]===key&&!escaped(text,start)){
  event.preventDefault();editor.setSelectionRange(start+1,start+1);return true;
 }
 if(code&&isQuote(key)){
  event.preventDefault();replace(editor,start,end,key+text.slice(start,end)+key,start+1,end+1);return true;
 }
 if(empty&&key==='Backspace'&&start>0&&isQuote(text[start-1])&&text[start]===text[start-1]&&context===text[start-1]&&contextAt(text,start-1)==='code'){
  event.preventDefault();replace(editor,start-1,start+1,'',start-1);return true;
 }
 if(code&&pairs[key]){
  event.preventDefault();
  replace(editor,start,end,key+text.slice(start,end)+pairs[key],start+1,end+1);
  return true;
 }
 if(code&&empty&&')]}'.includes(key)&&text[start]===key){
  event.preventDefault();editor.setSelectionRange(start+1,start+1);return true;
 }
 if(code&&empty&&key==='Backspace'&&start>0&&pairs[text[start-1]]&&pairs[text[start-1]]===text[start]){
  event.preventDefault();replace(editor,start-1,start+1,'',start-1);return true;
 }
 const lineStart=text.lastIndexOf('\n',start-1)+1,before=text.slice(lineStart,start),indent=before.match(/^[ \t]*/)[0];
 if(empty&&key==='Backspace'&&/^[ \t]+$/.test(before)){
  let count=1;
  if(before.endsWith(' ')){
   let column=0;for(const c of before)column+=c==='\t'?indentWidth-column%indentWidth:1;
   count=Math.min(before.match(/ +$/)[0].length,column%indentWidth||indentWidth);
  }
  event.preventDefault();replace(editor,start-count,start,'',start-count);return true;
 }
 if(code&&empty&&key==='}'&&before.length&&/^[ \t]+$/.test(before)){
  const trimmed=before.endsWith('    ')?before.slice(0,-4):before.endsWith('\t')?before.slice(0,-1):'';
  event.preventDefault();replace(editor,lineStart,start,trimmed+'}',lineStart+trimmed.length+1);return true;
 }
 if(key==='Tab'&&!event.shiftKey){event.preventDefault();replace(editor,start,end,'    ',start+4);return true;}
 if(key==='Enter'&&!event.shiftKey){
  event.preventDefault();
  const block=code&&text[start-1]==='{',inside=block&&text[end]==='}',padding=indent+(block?'    ':'');
  replace(editor,start,end,'\n'+padding+(inside?'\n'+indent:''),start+1+padding.length);return true;
 }
 return false;
}
