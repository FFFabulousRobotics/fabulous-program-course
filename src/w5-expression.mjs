// Restricted typed expressions, evaluated as data rather than JavaScript.
const boxes={'w5-cans':['cans','perBox',1,1000,100],'w5-tickets':['tickets','perSheet',1,80,10],'w5-lights':['need','capacity',0,1000,100],'w5-planner':['need','cap',0,1000,50]};
export const w5ExpressionMatchers=[...Object.keys(boxes),'ratio','remainder','active-call','break-statement','w6-position','w6-super'];
export function w5ExpressionAnswer(source,kind){
 try{
  source=String(source);
  if(kind==='active-call')return /^(?:this\s*\.\s*)?opModeIsActive\s*\(\s*\)$/.test(source.trim());
  if(kind==='break-statement')return /^break\s*;$/.test(source.trim());
  if(kind==='w6-super'){
   const text=source.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/\/\/[^\n\r]*/g,' ').trim(),match=text.match(/^super\s*\(([\s\S]*)\)\s*;$/);
   if(!match)return false;let argument=match[1].trim();
   while(argument.startsWith('(')&&argument.endsWith(')'))argument=argument.slice(1,-1).trim();
   return argument==='who';
  }
  if(!w5ExpressionMatchers.includes(kind))return false;
  const spec=boxes[kind],variables=spec?spec.slice(0,2):kind==='ratio'?['wins','rounds']:kind==='w6-position'?['pos']:['count','size'];
  const tokens=source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[A-Za-z_]\w*|&&|\|\||==|!=|<=|>=|\+\+|--|[()?:<>+\-*/%!]/g)||[];
  if(!tokens.length||tokens.join('')!==source.replace(/\s/g,'')||tokens.length>120)return false;
  let at=0;const types=new WeakMap(),prec={'||':1,'&&':2,'==':3,'!=':3,'<':4,'>':4,'<=':4,'>=':4,'+':5,'-':5,'*':6,'/':6,'%':6};
  function binary(min=0){
   const token=tokens[at++];let left;
   if(token==='('){
    if(['ratio','w6-position'].includes(kind)&&['double','int'].includes(tokens[at])&&tokens[at+1]===')'){const cast=tokens[at];at+=2;left={cast,value:binary(7)};}
    else{left=conditional();if(tokens[at++]!==')')throw Error();}
   }else if(['!','+','-'].includes(token))left={op:'u'+token,value:binary(7)};
   else if(/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token||'')){
    const decimal=token.includes('.');if(decimal&&!['ratio','w6-position'].includes(kind))throw Error();
    if(!decimal&&token.length>1&&token[0]==='0'&&!/^0[0-7]+$/.test(token))throw Error();
    const value=!decimal&&token.length>1&&token[0]==='0'?parseInt(token,8):Number(token);
    if(!Number.isFinite(value)||(!decimal&&(!Number.isSafeInteger(value)||value>2147483647)))throw Error();
    left={literal:value,type:decimal?'double':'int'};
   }else if(token==='true'||token==='false')left={literal:token==='true',type:'boolean'};
   else if(variables.includes(token))left={variable:token};else throw Error();
   while(at<tokens.length&&(prec[tokens[at]]??-1)>=min){const op=tokens[at++];left={op,left,right:binary(prec[op]+1)};}
   return left;
  }
  function conditional(){const c=binary();if(tokens[at]!=='?')return c;at++;const yes=conditional();if(tokens[at++]!==':')throw Error();return {op:'?:',condition:c,yes,no:conditional()};}
  const tree=conditional();if(at!==tokens.length)return false;
  const numeric=t=>t==='int'||t==='double';
  function type(n){
   if(types.has(n))return types.get(n);let t;
   if('literal'in n)t=n.type;else if(n.variable)t=kind==='w6-position'?'double':'int';
   else if(n.cast){if(!numeric(type(n.value)))throw Error();t=n.cast;}
   else if(n.op.startsWith('u')){const v=type(n.value);if(n.op==='u!'?v!=='boolean':!numeric(v))throw Error();t=v;}
   else if(n.op==='?:'){const y=type(n.yes),z=type(n.no);if(type(n.condition)!=='boolean'||(y!==z&&(!numeric(y)||!numeric(z))))throw Error();t=y===z?y:'double';}
   else{const a=type(n.left),b=type(n.right);
    if(['&&','||'].includes(n.op)){if(a!=='boolean'||b!=='boolean')throw Error();t='boolean';}
    else if(['==','!='].includes(n.op)){if(a!==b&&(!numeric(a)||!numeric(b)))throw Error();t='boolean';}
    else{if(!numeric(a)||!numeric(b))throw Error();t=['<','>','<=','>='].includes(n.op)?'boolean':a==='double'||b==='double'?'double':'int';}
   }types.set(n,t);return t;
  }
  if(type(tree)!==(spec?'int':kind==='ratio'?'double':'boolean'))return false;
  function evaluate(n,v){
   if('literal'in n)return n.literal;if(n.variable)return v[n.variable];
   if(n.cast){const x=evaluate(n.value,v);return n.cast==='double'?x:Math.max(-2147483648,Math.min(2147483647,Math.trunc(x)))|0;}
   if(n.op==='u!')return !evaluate(n.value,v);if(n.op==='u+')return evaluate(n.value,v);
   if(n.op==='u-'){const x=-evaluate(n.value,v);return types.get(n)==='int'?x|0:x;}
   if(n.op==='?:')return evaluate(n.condition,v)?evaluate(n.yes,v):evaluate(n.no,v);
   const a=evaluate(n.left,v);if(n.op==='&&')return a&&evaluate(n.right,v);if(n.op==='||')return a||evaluate(n.right,v);const b=evaluate(n.right,v);
   if(n.op==='==')return a===b;if(n.op==='!=')return a!==b;if(n.op==='<')return a<b;if(n.op==='>')return a>b;if(n.op==='<=')return a<=b;if(n.op==='>=')return a>=b;
   const int=types.get(n)==='int';if(!b&&['/','%'].includes(n.op)&&int)throw Error();
   const x=n.op==='+'?a+b:n.op==='-'?a-b:n.op==='*'?(int?Math.imul(a,b):a*b):n.op==='/'?a/b:a%b;
   return int?(n.op==='/'?Math.trunc(x)|0:x|0):x;
  }
  if(spec){for(let n=spec[2];n<=spec[3];n++)for(let c=1;c<=spec[4];c++)if(evaluate(tree,{[variables[0]]:n,[variables[1]]:c})!==Math.ceil(n/c))return false;}
  else if(kind==='remainder'){
   const check=(count,size)=>evaluate(tree,{count,size})===(count%size!==0);
   for(let count=0;count<=1000;count++)for(let size=1;size<=100;size++)if(!check(count,size))return false;
   for(const size of [101,1000,65536,1073741824,2147483647])for(const count of [0,1,size-1,size,Math.min(2147483647,size+1),2147483646,2147483647])if(!check(count,size))return false;
  }
  else if(kind==='w6-position'){
   const check=pos=>evaluate(tree,{pos})===(pos<0||pos>1);
   for(let i=-200;i<=200;i++)if(!check(i/100))return false;
   for(const pos of [-Number.MAX_VALUE,-Number.MIN_VALUE,-Number.EPSILON,-0,0,Number.MIN_VALUE,1-Number.EPSILON,1,1+Number.EPSILON,Number.MAX_VALUE])if(!check(pos))return false;
  }else{
   const check=(wins,rounds)=>{const actual=evaluate(tree,{wins,rounds});return Number.isFinite(actual)&&Math.abs(actual-wins/rounds)<=Number.EPSILON*4;};
   for(let rounds=1;rounds<=100;rounds++)for(let wins=0;wins<=rounds;wins++)if(!check(wins,rounds))return false;
   for(const rounds of [101,999,1000,99991,1000003,1073741824,2147483647])for(const wins of [0,1,Math.floor(rounds/3),Math.floor(rounds/2),rounds-1,rounds])if(!check(wins,rounds))return false;
  }
  return true;
 }catch{return false;}
}
