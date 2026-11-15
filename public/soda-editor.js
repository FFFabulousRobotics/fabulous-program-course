// The editor contains only the answer class. Main is displayed separately and
// appended from the trusted task template, never from editable text.
export function fixedMain(task){
 const start=task.starter.indexOf('public class Main {');
 if(start<0)throw Error('缺少固定主程序');
 return task.starter.slice(start).trimEnd();
}
export function editableSoda(source,task){
 const main=fixedMain(task),exact=String(source).lastIndexOf(main);
 if(exact>=0)return source.slice(0,exact).trimEnd();
 // Recover the answer class from older drafts that included an editable Main.
 const old=String(source).search(/^public\s+class\s+Main\b/m);
 return (old>=0?source.slice(0,old):source).trimEnd();
}
export function composeSoda(answer,task){return String(answer).trimEnd()+'\n\n'+fixedMain(task);}
