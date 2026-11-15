import {esc} from './html.js';
export function knowledgeFeedback(result,markdown){
 if(!result)return '<p class="quiz-policy">完成全部题目后整份交卷，满分 100 分。提交后可查看答案与解析，可重复练习；AC 率由首次得分的 70% 和首次满分奖励组成；未满分奖励为 0。</p>';
 const answerText=(q,value)=>{const i=q.options?.findIndex(o=>o.value===value)??-1;return i>=0?String.fromCharCode(65+i)+' · '+q.options[i].text:value;};
 return `<section class="quiz-summary" tabindex="-1" aria-label="知识检查成绩" aria-live="polite"><div class="quiz-score"><strong>${esc(result.score)}<small> / 100 分</small></strong><span>${result.status==='AC'?'✓ 全部答对':`${esc(result.passed??0)} / ${esc(result.total??0)} 题正确`}</span></div><p>最近一次提交 · 第 ${esc(result.attemptCount||1)} 次；首次 ${esc(result.firstScore??result.score)} 分（${esc(result.firstStatus||result.status)}）。后续提交不覆盖首次得分；首次满分时确定奖励。</p><details class="quiz-solutions"><summary>查看答案与解析</summary>${(result.solutions||[]).map((q,i)=>`<section class="solution-item"><div class="markdown solution-prompt"><b>第 ${i+1} 题</b>${markdown(q.prompt)}</div><p>本次答案：${esc(answerText(q,result.answers?.[q.id]||'未记录'))}</p><p class="correct-answer">正确答案：${q.correctAnswers.map(a=>esc(answerText(q,a))).join(' / ')}</p>${q.explanation?`<div class="markdown solution-explanation">${markdown(q.explanation)}</div>`:''}</section>`).join('')}</details></section>`;
}
export function exerciseFeedback(result,markdown,resultView,{inline=false}={}){
 if(!result)return '';
 if(result.submissionLimit===1){
  const s=result.scoring,ac=result.acContribution;
  const summary=`<section class="quiz-summary" tabindex="-1" aria-label="整份练习总分" aria-live="polite"><h3>首次提交成绩 · 已封卷</h3><div class="quiz-score"><strong>${esc(result.firstScore??result.score)}<small> / 100 分</small></strong><span>仅允许提交一次</span></div><div class="exercise-breakdown"><span>客观题 <b>${esc(s?.knowledgePoints)} / ${s?.knowledgeWeight??60}</b></span><span>编程题 <b>${esc(s?.programmingPoints)} / ${s?.programmingWeight??40}</b></span></div><p>首次成绩已保存，本练习已计为完成，不能重交或修改答卷。客观题答对 ${result.knowledge?.passed??0} / ${result.knowledge?.total??20} 题。答案与解析直接显示在各题下方。</p>${ac?`<p>本练习 AC 计分：${esc(ac.score)} / 100。${ac.mode==='first-score'?'直接使用首次原始得分，不乘权重，不加满分奖励。':`首次得分折算 ${esc(ac.baseScore)}，满分奖励 ${esc(ac.bonus)}。`}</p>`:''}</section>`;
  return summary+(inline?'':`<section class="card exercise-questions">${knowledgeQuestions(result.solutions||result.questions||[],result.answers||{},result,markdown,true)}</section>`+programmingFeedback(result,markdown,resultView));
 }

 const score=result.scoring;
 const breakdown=score?`<div class="exercise-breakdown">${result.knowledge?`<span>知识题 <b>${esc(score.knowledgePoints)} / ${score.knowledgeWeight}</b></span>`:''}${result.programming?`<span>编程题 <b>${esc(score.programmingPoints)} / ${score.programmingWeight}</b></span>`:''}</div>`:'';
 const ac=result.acContribution,acNote=ac?`<p class="ac-contribution">本教程 AC 计分：<b>${esc(ac.score)} / 100</b>（首次得分折算 ${esc(ac.baseScore)} + 满分奖励 ${esc(ac.bonus)}）。${ac.firstPerfectAttempt===null?'尚未达到满分，奖励暂为 0。':`首次满分为第 ${esc(ac.firstPerfectAttempt)} 次计分尝试，之后重交不再改变奖励。${result.legacy?'旧版首轮知识题与编程题合并计一次。':''}`}</p>`:'';
 const summary=knowledgeFeedback({...result,solutions:result.solutions||result.questions||[]},markdown)
  .replace('aria-label="知识检查成绩"','aria-label="整份练习总分"')
  .replace('<div class="quiz-score">','<h3 class="total-score-title">整份练习总分</h3><div class="quiz-score">')
  .replace('</div><p>最近一次提交',`</div>${breakdown}${acNote}<p>最近一次提交`)
  .replace('第 '+(result.attemptCount||1)+' 次；',result.legacy?'历史分项成绩合计；':'第 '+(result.attemptCount||1)+' 次；');
 return summary+(result.programming?`<details class="card programming-details"><summary>查看编程评测详情（编程部分原始分 ${esc(result.programming.score)} / 100）</summary>${resultView(result.programming)}</details>`:'');
}
export function programmingFeedback(result,markdown,resultView){
 if(!result?.programming)return '';
 return `<section class="programming-inline-review" aria-label="编程题评分与解析"><h3>编程题评分与解析 · ${esc(result.scoring?.programmingPoints)} / ${result.scoring?.programmingWeight??40}分</h3>${resultView(result.programming)}${result.programmingSolution?`<h3>解析</h3><div class="markdown">${markdown(result.programmingSolution.explanation)}</div><h3>参考实现</h3><pre class="question-code"><code>${esc(result.programmingSolution.source)}</code></pre>`:''}</section>`;
}
function inlineAnswer(question,result,markdown){
 if(result?.submissionLimit!==1)return '';
 const solution=(result.solutions||result.questions||[]).find(q=>q.id===question.id);
 if(!solution?.correctAnswers)return '';
 const format=v=>{const i=solution.options?.findIndex(o=>o.value===v)??-1;return i<0?v:(question.type==='boolean'?'':String.fromCharCode(65+i)+' · ')+solution.options[i].text;};
 return `<section class="question-inline-review" aria-label="本题答案与解析"><p>你的答案：<code>${esc(format(result.answers?.[question.id]??'未记录'))}</code></p><p class="correct-answer">参考答案：<code>${solution.correctAnswers.map(v=>esc(format(v))).join(' / ')}</code></p><div class="markdown solution-explanation"><strong>解析：</strong>${markdown(solution.explanation||'')}</div></section>`;
}
export function knowledgeQuestions(questions,answers,result,markdown,locked=false){
 return questions.map((q,i)=>{
  const check=result?.details?.find(d=>d.id===q.id),label={boolean:'判断',choice:'知识选择',read:'读程序',completion:'补全程序',fill:'填空'}[q.type]||(q.options?'知识选择':'填空');
  const peers=questions.filter(x=>x.type===q.type),samePoints=peers.every(x=>x.points===q.points),total=peers.reduce((n,x)=>n+(x.points||0),0);
  const group=q.points&&(i===0||q.type!==questions[i-1]?.type)?`<h3 class="question-group">${{boolean:'一、判断题',choice:'二、单项选择题',fill:'三、填空题'}[q.type]||label}（${peers.length}题，${samePoints?'每题'+q.points+'分，':''}共${total}分）</h3>`:'';
  return `${group}<fieldset ${locked?'disabled':''} class="question-card ${check?(check.correct?'correct':'wrong'):''}"><legend><span class="question-number">${i+1}</span><span>${label}${q.options&&q.type!=='boolean'?' · 单选题':''}${q.points?' · '+q.points+'分':''}</span>${check?`<span class="question-verdict">${check.correct?'✓ 正确':locked?'× 错误':'× 请再试一次'}</span>`:''}</legend><div class="markdown question-prompt">${markdown(q.prompt)}</div>${q.code?`<pre class="question-code"><code>${esc(q.code)}</code></pre>`:''}${q.options?`<div class="choice-options">${q.options.map((o,j)=>`<label class="choice-option"><input type="radio" name="${esc(q.id)}" value="${esc(o.value)}" ${answers[q.id]===o.value?'checked':''} required><b>${q.type==='boolean'?(o.value==='true'?'√':'×'):String.fromCharCode(65+j)}</b><span>${esc(o.text)}</span></label>`).join('')}</div>`:`<label class="question-answer">你的答案${q.type==='read'||q.type==='completion'?`<textarea name="${esc(q.id)}" rows="4" maxlength="2000" required spellcheck="false">${esc(answers[q.id]||'')}</textarea>`:`<input name="${esc(q.id)}" value="${esc(answers[q.id]||'')}" autocomplete="off" maxlength="2000" placeholder="填写答案" required>`}</label>`}${inlineAnswer(q,result,markdown)}</fieldset>`;
 }).join('');
}
export function programmingStatement(task,markdown){
 const section=(title,content)=>content?`<section class="problem-section"><h3>${title}</h3><div class="markdown">${markdown(content)}</div></section>`:'';
 return `<div class="task-copy problem-statement"><header class="problem-heading"><span class="kicker">PROGRAMMING</span><h2>${esc(task.title)}</h2><div class="limit-row"><span>时间限制 <b>${task.kind==='java'?'4 s':'20 s'}</b></span><span>内存限制 <b>${task.kind==='java'?'64 MB':'384 MB'}</b></span><span>语言 <b>Java 21</b></span></div></header>${section('题目背景',task.background)}${section('题目描述',task.description)}${section(task.grader&&task.fixedMain!==false?'测试条件':task.kind==='java'?'输入格式':'输入 / 测试条件',task.input)}${section(task.kind==='java'?'输出格式':'输出要求',task.output)}${task.samples?.length?`<section class="problem-section"><h3>输入输出样例</h3>${task.samples.map((s,i)=>`<div class="problem-sample"><div><h4>输入 #${i+1}</h4><pre>${esc(s.input)}</pre></div><div><h4>输出 #${i+1}</h4><pre>${esc(s.output)}</pre></div></div>`).join('')}</section>`:task.sampleOutput?`<section class="problem-section"><h3>期望行为</h3><pre>${esc(task.sampleOutput)}</pre></section>`:''}${section('说明 / 提示',task.hint)}</div>`;
}
