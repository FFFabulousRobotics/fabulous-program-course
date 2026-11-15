import {w5ExpressionAnswer,w5ExpressionMatchers} from './w5-expression.mjs';
export const expressionMatchers=['boxes','exclusive',...w5ExpressionMatchers];
// A typed, side-effect-free Java expression interpreter. Never eval student input.
export function expressionAnswer(source, kind) {
 if(kind!=='boxes'&&kind!=='exclusive')return w5ExpressionAnswer(source,kind);
 try {
  const tokens=String(source).match(/\d+|[A-Za-z_]\w*|&&|\|\||==|!=|<=|>=|\+\+|--|[()?:<>+\-*/%!]/g)||[];
  if(tokens.join('')!==String(source).replace(/\s/g,'')||tokens.length>120)return false;
  if(kind==='exclusive'&&tokens.some(t=>!['a','b','!','&&','||','(',')'].includes(t)))return false;
  let at=0;
  const precedence={'||':1,'&&':2,'==':3,'!=':3,'<':4,'>':4,'<=':4,'>=':4,'+':5,'-':5,'*':6,'/':6,'%':6};
  function binary(min=0){
   const token=tokens[at++];let left;
   if(token==='('){left=conditional();if(tokens[at++]!==')')throw Error();}
   else if(['!','+','-'].includes(token))left={op:'u'+token,value:binary(7)};
   else if(/^\d+$/.test(token||'')){
    if(token.length>1&&token[0]==='0'&&!/^0[0-7]+$/.test(token))throw Error();
    const value=token.length>1&&token[0]==='0'?parseInt(token,8):Number(token);
    if(!Number.isSafeInteger(value)||value>2147483647)throw Error();
    left={literal:value};
   }else if(token==='true'||token==='false')left={literal:token==='true'};
   else if((kind==='boxes'?['need','perBox']:['a','b']).includes(token))left={variable:token};
   else throw Error();
   while(at<tokens.length&&(precedence[tokens[at]]??-1)>=min){const op=tokens[at++];left={op,left,right:binary(precedence[op]+1)};}
   return left;
  }
  function conditional(){
   const condition=binary();if(tokens[at]!=='?')return condition;
   at++;const yes=conditional();if(tokens[at++]!==':')throw Error();
   return {op:'?:',condition,yes,no:conditional()};
  }
  const tree=conditional();if(at!==tokens.length)return false;
  // Type-check every branch, including branches that evaluation never visits.
  function type(n){
   if('literal'in n)return typeof n.literal;
   if(n.variable)return kind==='boxes'?'number':'boolean';
   if(n.op.startsWith('u')){const expected=n.op==='u!'?'boolean':'number';if(type(n.value)!==expected)throw Error();return expected;}
   if(n.op==='?:'){const y=type(n.yes),no=type(n.no);if(type(n.condition)!=='boolean'||y!==no)throw Error();return y;}
   const a=type(n.left),b=type(n.right);
   if(['&&','||'].includes(n.op)){if(a!=='boolean'||b!=='boolean')throw Error();return 'boolean';}
   if(['==','!='].includes(n.op)){if(a!==b)throw Error();return 'boolean';}
   if(a!=='number'||b!=='number')throw Error();
   return ['<','>','<=','>='].includes(n.op)?'boolean':'number';
  }
  if(type(tree)!==(kind==='boxes'?'number':'boolean'))return false;
  function evaluate(n,v){
   if('literal'in n)return n.literal;
   if(n.variable)return v[n.variable];
   if(n.op==='u!')return !evaluate(n.value,v);
   if(n.op==='u+')return evaluate(n.value,v);
   if(n.op==='u-')return -evaluate(n.value,v)|0;
   if(n.op==='?:')return evaluate(n.condition,v)?evaluate(n.yes,v):evaluate(n.no,v);
   const a=evaluate(n.left,v);
   if(n.op==='&&')return a&&evaluate(n.right,v);
   if(n.op==='||')return a||evaluate(n.right,v);
   const b=evaluate(n.right,v);
   if(n.op==='==')return a===b;if(n.op==='!=')return a!==b;
   if(n.op==='<')return a<b;if(n.op==='>')return a>b;if(n.op==='<=')return a<=b;if(n.op==='>=')return a>=b;
   if(!b&&['/','%'].includes(n.op))throw Error();
   // Java int arithmetic, including truncation toward zero and 32-bit overflow.
   return n.op==='+'?(a+b)|0:n.op==='-'?(a-b)|0:n.op==='*'?Math.imul(a,b):n.op==='/'?Math.trunc(a/b)|0:a%b;
  }
  if(kind==='boxes'){
   for(let need=1;need<=1000;need++)for(let perBox=1;perBox<=100;perBox++)
    if(evaluate(tree,{need,perBox})!==Math.ceil(need/perBox))return false;
  }else for(const a of [false,true])for(const b of [false,true])if(evaluate(tree,{a,b})!==(a!==b))return false;
  return true;
 }catch{return false;}
}
