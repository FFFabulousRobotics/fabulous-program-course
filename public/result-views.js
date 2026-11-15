import { esc } from './html.js';

export function resultView(result) {
  if (!result) return '';
  if (result.preview || result.status === 'RUN') return runResultView(result);
  return `<section class="judge-result ${result.status === 'AC' ? 'accepted' : 'failed'}"><div><span class="verdict ${esc(result.status)}">${esc(result.status)}</span><div><b>${result.maxPoints !== undefined ? result.points + ' / ' + result.maxPoints : (result.score ?? 0)} 分 · ${result.passed ?? 0}/${result.total ?? 0} 通过</b><p>${esc(result.message)}</p></div></div>${result.engine ? `<small>${esc(result.engine)}</small>` : ''}${result.output ? `<pre>${esc(result.output)}</pre>` : ''}${(result.cases || []).map((c) => `<details class="case-result"><summary><span class="verdict ${esc(c.status)}">${esc(c.status)}</span> ${esc(c.name)}${c.maxPoints !== undefined ? ' · 得分 ' + c.points + '/' + c.maxPoints : ''} · ${c.timeMs} ms</summary><pre>${esc(c.message)}${c.expected ? '\n期望：\n' + esc(c.expected) + '\n实际：\n' + esc(c.output) : ''}</pre></details>`).join('')}</section>`;
}
export function runResultView(result) {
  const label =
    {
      RUN: '运行结束',
      CE: '编译失败',
      RE: '运行错误',
      TLE: '运行超时',
      OLE: '输出超限'
    }[result.status] || '运行信息';
  return `<section class="judge-result run-output"><div><div><b>${label} · ${result.timeMs ?? 0} ms</b><p>仅展示运行结果，不判断答案，不计入成绩。</p></div></div><small>${esc(result.engine || '')}</small><div><h3>标准输出（stdout）</h3><pre>${result.output ? esc(result.output) : '（无输出）'}</pre></div>${result.stderr ? `<div><h3>标准错误（stderr）</h3><pre>${esc(result.stderr)}</pre></div>` : ''}<div><h3>${result.status === 'CE' ? '编译信息' : '运行信息'}</h3><pre>${esc(result.message)}</pre></div></section>`;
}
