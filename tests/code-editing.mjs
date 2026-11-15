import assert from 'node:assert/strict';
import {handleCodeKey} from '../public/code-editing.js';

class Editor extends EventTarget{
 constructor(value='',start=value.length,end=start){super();this.value=value;this.selectionStart=start;this.selectionEnd=end;this.maxLength=30000;this.inputs=0;this.addEventListener('input',()=>this.inputs++);}
 setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}
 setRangeText(text,start,end){this.value=this.value.slice(0,start)+text+this.value.slice(end);this.setSelectionRange(start+text.length,start+text.length);}
}
function key(editor,key,extra={}){let prevented=false;const handled=handleCodeKey({target:editor,key,preventDefault(){prevented=true;},...extra});assert.equal(prevented,handled);return handled;}
for(const [open,close] of [['(',')'],['[',']'],['{','}']]){
 const editor=new Editor();assert.ok(key(editor,open));assert.equal(editor.value,open+close);assert.equal(editor.selectionStart,1);assert.equal(editor.inputs,1);
 key(editor,close);assert.equal(editor.value,open+close);assert.equal(editor.selectionStart,2);assert.equal(editor.inputs,1,'Moving over a closer must not change the draft');
 editor.setSelectionRange(1,1);key(editor,'Backspace');assert.equal(editor.value,'');assert.equal(editor.inputs,2);
 const selection=new Editor('left selected right',5,13);key(selection,open);assert.equal(selection.value,'left '+open+'selected'+close+' right');assert.equal(selection.selectionStart,6);assert.equal(selection.selectionEnd,14);
}
const nested=new Editor();key(nested,'(');key(nested,'[');key(nested,'{');assert.equal(nested.value,'([{}])');
for(const close of ['}',']',')'])key(nested,close);assert.equal(nested.value,'([{}])');assert.equal(nested.selectionStart,6);
const block=new Editor('    if (true) ');key(block,'{');key(block,'Enter');assert.equal(block.value,'    if (true) {\n        \n    }');assert.equal(block.selectionStart,24);
const tab=new Editor('x');key(tab,'Tab');assert.equal(tab.value,'x    ');
const closeLine=new Editor('{\n    ');key(closeLine,'}');assert.equal(closeLine.value,'{\n}');
for(const value of ['text','(',')',''])assert.equal(key(new Editor(value),'Backspace'),false,'Ordinary deletion must stay native');
for(const value of ['// comment ','/* comment ','String s = "text ',"char c = '",'String s = """\ntext '])assert.equal(key(new Editor(value),'('),false);
for(const value of ['// comment\n','/* comment */','String s = "text";','String s = """\ntext\n""";'])assert.equal(key(new Editor(value),'('),true);
for(const extra of [{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true},{keyCode:229},{defaultPrevented:true}])assert.equal(key(new Editor(),'(',extra),false);
assert.equal(key(new Editor(),'Enter',{metaKey:true}),false);
assert.equal(key(new Editor(),'Tab',{shiftKey:true}),false);
const limited=new Editor('x');limited.maxLength=2;key(limited,'(');assert.equal(limited.value,'x');assert.equal(limited.inputs,0);
const readonly=new Editor();readonly.readOnly=true;assert.equal(key(readonly,'('),false);
const native=new Editor();native.ownerDocument={activeElement:native,execCommand(command,ui,text){assert.equal(command,'insertText');native.setRangeText(text,native.selectionStart,native.selectionEnd);native.dispatchEvent(new Event('input'));return true;}};
key(native,'(');assert.equal(native.value,'()');assert.equal(native.inputs,1,'Native input must not trigger duplicate saves');
console.log('PASS: all bracket pairs, nested input, selection wrapping, skip/delete, indentation, IME/modifiers, strings/comments, length limit and one draft update per edit');

for(const quote of ['"',"'"]){
 const editor=new Editor('String x = ');key(editor,quote);
 assert.equal(editor.value,'String x = '+quote+quote);assert.equal(editor.selectionStart,12);assert.equal(editor.inputs,1);
 key(editor,quote);assert.equal(editor.selectionStart,13);assert.equal(editor.inputs,1,'Skipping the quote must not edit or save');
 editor.setSelectionRange(12,12);key(editor,'Backspace');assert.equal(editor.value,'String x = ');assert.equal(editor.inputs,2);
 const selection=new Editor('hello',0,5);key(selection,quote);assert.equal(selection.value,quote+'hello'+quote);assert.equal(selection.selectionStart,1);assert.equal(selection.selectionEnd,6);
 for(const text of ['// comment ','/* comment ','String s = """\ntext '])assert.equal(key(new Editor(text),quote),false);
}
for(const [text,start] of [['"abc"',4],["'x'",2]]){const editor=new Editor(text,start);key(editor,text[0]);assert.equal(editor.value,text);assert.equal(editor.selectionStart,start+1);}
const escapeQuote=new Editor('"a\\"',3);assert.equal(key(escapeQuote,'"'),false,'An escaped quote must be inserted literally');
const escapeChar=new Editor("'\\'",2);assert.equal(key(escapeChar,"'"),false);
const evenSlashes=new Editor('"a\\\\"',4);assert.ok(key(evenSlashes,'"'),'An even number of backslashes leaves a closing delimiter');assert.equal(evenSlashes.selectionStart,5);
assert.equal(key(new Editor('"text'),"'"),false,'Apostrophes inside a string are literal');
assert.equal(key(new Editor("'"),'"'),false,'Double quotes inside a char literal are literal');
assert.equal(key(new Editor('"""',1),'Backspace'),false,'Do not remove the text-block opening delimiter as an empty pair');
for(const [value,start,expected,caret] of [
 ['    ',4,'',0],['        ',8,'    ',4],['      ',6,'    ',4],['  ',2,'',0],
 ['\t',1,'',0],['\t  ',3,'\t',1],['\t    ',5,'\t',1],['  \t',3,'  ',2],
 ['x\n    code',6,'x\ncode',2],['    code',4,'code',0],['        code',4,'    code',0]
]){const editor=new Editor(value,start);assert.ok(key(editor,'Backspace'));assert.equal(editor.value,expected);assert.equal(editor.selectionStart,caret);assert.equal(editor.inputs,1);}
const tabRoundTrip=new Editor('    ');key(tabRoundTrip,'Tab');key(tabRoundTrip,'Backspace');assert.equal(tabRoundTrip.value,'    ');
assert.equal(key(new Editor('x    '),'Backspace'),false,'Spaces after code delete normally');
assert.equal(key(new Editor('    ',0,4),'Backspace'),false,'Selection deletion stays native');
for(const extra of [{isComposing:true},{keyCode:229},{ctrlKey:true},{metaKey:true},{altKey:true}]){
 assert.equal(key(new Editor(),'"',extra),false);assert.equal(key(new Editor('    '),'Backspace',extra),false);
}
const frozen=new Editor('    ');frozen.readOnly=true;assert.equal(key(frozen,'Backspace'),false);assert.equal(key(frozen,'"'),false);
console.log('PASS: quote pairing/wrapping/skipping/deletion, escape parity, literal/comment protection, tab-stop backspace, tabs/spaces, native selections and read-only/IME handling');
