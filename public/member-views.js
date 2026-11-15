import {esc} from './html.js';
const rate=value=>value==null?'—':esc(value)+'%';
const score=value=>value==null?'—':esc(value);
const date=value=>value?esc(new Date(value).toLocaleString('zh-CN',{hour12:false})):'暂无记录';
export function filterMembers(users,{query='',status='all',role='all',sort='rate'}={}){
 const needle=query.trim().toLocaleLowerCase();
 const selected=users.filter(u=>(!needle||(u.displayName+' '+u.username).toLocaleLowerCase().includes(needle))&&
  (status==='all'||(status==='active'?u.active:!u.active))&&(role==='all'||u.role===role));
 return selected.sort((a,b)=>{
  if(a.role!==b.role)return a.role==='admin'?-1:1;
  if(a.role==='admin')return Number(!!b.owner)-Number(!!a.owner)||a.username.localeCompare(b.username);
  const x=a.learning||{},y=b.learning||{};
  if(sort==='rate')return (y.rate??-1)-(x.rate??-1)||a.username.localeCompare(b.username);
  if(sort==='progress')return (y.total?y.accepted/y.total:0)-(x.total?x.accepted/x.total:0)||a.username.localeCompare(b.username);
  if(sort==='name')return a.displayName.localeCompare(b.displayName,'zh-CN');
  return (y.lastActiveAt||'').localeCompare(x.lastActiveAt||'')||a.username.localeCompare(b.username);
 });
}
export function memberOverview(users){
 const members=users.filter(u=>u.role==='member'&&u.active),started=members.filter(u=>u.learning?.scoredExercises>0).length;
 return `<section class="member-summary"><div class="card"><span>启用成员</span><strong>${members.length}</strong></div><div class="card"><span>已开始练习</span><strong>${started}</strong></div><div class="card"><span>尚未提交练习</span><strong>${members.length-started}</strong></div></section>`;
}
export function memberRows(users,current){
 return users.map(u=>{
  const owner=!!current.owner,self=u.id===current.id,admin=u.role==='admin',locked=self||u.owner||(!owner&&admin),s=u.learning||{};
  const percent=s.total?Math.round(s.accepted/s.total*100):0;
  return `<tr><td><a class="member-name" href="#/users/${esc(u.id)}"><b>${esc(u.displayName)}</b><small>@${esc(u.username)}</small></a><span class="member-status ${u.active?'':'inactive'}">${u.active?'启用':'停用'}</span></td>
   <td>${u.owner?'<span class="owner-tag">Owner</span>':`<select data-user-role="${esc(u.id)}" ${!owner||self?'disabled':''} aria-label="${esc(u.username)}的角色"><option value="member" ${!admin?'selected':''}>成员</option><option value="admin" ${admin?'selected':''}>管理员</option></select>`}</td>
   ${admin?'':`<td><b>${s.accepted??0} / ${s.total??0}</b><progress max="100" value="${percent}" aria-label="${esc(u.displayName)}教程完成 ${percent}%"></progress><small>已阅读 ${s.read??0} 篇</small></td>
   <td><strong class="member-rate">${rate(s.rate)}</strong><small>${s.scoredExercises?`${s.scoredExercises} 份已评分练习`:'尚未提交'}</small></td>
   <td>${s.submissions??0}</td>`}<td class="member-date">${date(s.lastActiveAt)}</td>
   <td><div class="member-actions"><a class="secondary-btn" href="#/users/${esc(u.id)}">${admin?'查看提交':'学习详情'}</a><button type="button" class="tiny-btn" data-user-reset="${esc(u.id)}" data-username="${esc(u.username)}" data-display-name="${esc(u.displayName)}" ${locked?'disabled':''}>重置密码</button><button type="button" class="tiny-btn" data-user-toggle="${esc(u.id)}" data-active="${u.active}" ${locked?'disabled':''}>${u.active?'停用':'启用'}</button></div></td></tr>`;
 }).join('')||'<tr><td colspan="7" class="empty">没有符合条件的账号，请调整搜索或筛选。</td></tr>';
}
export function memberGroups(users,current){
 return ['admin','member'].map(role=>{
  const group=users.filter(u=>u.role===role);if(!group.length)return '';
  const admin=role==='admin',title=admin?'管理员':'成员';
  const columns=admin?['账号','角色','最近活跃','操作']:['成员','角色','教程完成','AC 率','提交次数','最近活跃','操作'];
  return `<section class="member-group ${admin?'admin-group':''}"><div class="member-group-head"><h3>${title}</h3><span>${group.length} 人</span></div><div class="member-scroll" tabindex="0" role="region" aria-label="${title}列表"><table class="member-table"><thead><tr>${columns.map(c=>`<th scope="col">${c}</th>`).join('')}</tr></thead><tbody>${memberRows(group,current)}</tbody></table></div></section>`;
 }).join('')||'<div class="empty">没有符合条件的账号，请调整搜索或筛选。</div>';
}
export function memberTable(users,current,filters={}){
 const selected=filterMembers(users,filters);
 const options=(items,value)=>items.map(([id,label])=>`<option value="${id}" ${id===value?'selected':''}>${label}</option>`).join('');
 return `<section class="card users-list"><div class="card-head"><h2>成员与账号</h2><span id="member-count" role="status">${selected.length} / ${users.length} 人</span></div>
  <div class="member-tools"><label class="member-search">搜索账号<input id="user-search" type="search" placeholder="姓名或用户名" value="${esc(filters.query||'')}"></label><label>账号状态<select id="user-status">${options([['all','全部状态'],['active','启用'],['inactive','停用']],filters.status||'all')}</select></label><label>角色<select id="user-role-filter">${options([['all','全部角色'],['member','成员'],['admin','管理员']],filters.role||'all')}</select></label><label>成员排序<select id="user-sort">${options([['rate','AC 率从高到低'],['progress','完成进度从高到低'],['recent','最近活跃'],['name','姓名']],filters.sort||'rate')}</select></label></div>
  <p class="member-policy">进度与 AC 率只统计已发布课程，与成员端一致。W4直接使用首次原始得分，不加权；旧课程沿用首次得分折算与满分奖励；未提交显示「—」，已提交的 0 分计入。</p>
  <div id="member-groups">${memberGroups(selected,current)}</div></section>`;
}
export function memberLearningView(s){
 if(!s)return '';
 return `<section class="member-summary"><div class="card"><span>教程完成</span><strong>${s.accepted} <small>/ ${s.total}</small></strong><small>已阅读 ${s.read} 篇</small></div><div class="card"><span>AC 率</span><strong>${rate(s.rate)}</strong><small>统计 ${s.scoredExercises} 份已评分练习</small></div><div class="card"><span>已发布课程提交</span><strong>${s.submissions}</strong><small>最近活跃：${date(s.lastActiveAt)}</small></div></section>
  <p class="member-policy">以下进度与成员端一致，仅统计已发布课程。W4的AC计分等于首次原始得分，不加权、不加奖励；旧课程仍为首次得分×70%加首次满分奖励；未提交不计入 AC 率。最新得分显示整份练习总分，历史分项未交齐时显示「—」。</p>
  <section class="member-weeks">${s.weeks.map(w=>`<details class="card member-week" open><summary><span><b>${esc(w.code)}</b> ${esc(w.title)}</span><span>${w.accepted} / ${w.total} 完成</span></summary><div class="member-scroll" tabindex="0" role="region" aria-label="${esc(w.code)}学习明细"><table class="member-table learning-table"><thead><tr><th scope="col">教程</th><th scope="col">阅读</th><th scope="col">练习</th><th scope="col">首次得分</th><th scope="col">最新得分</th><th scope="col">AC 计分</th><th scope="col">提交次数</th></tr></thead><tbody>${w.lessons.map(l=>`<tr><td><b>${esc(l.code)}</b><small>${esc(l.title)}</small></td><td>${l.read?'已阅读':'未阅读'}</td><td><span class="member-status ${l.complete?'':'inactive'}">${!l.hasExercise?'无需练习':l.complete?'已通过':l.submissions?'未通过':'未提交'}</span></td><td>${score(l.firstScore)}</td><td>${score(l.latestScore)}</td><td>${score(l.acScore)}</td><td>${l.submissions}</td></tr>`).join('')}</tbody></table></div></details>`).join('')||'<section class="card empty">暂无已发布课程。</section>'}</section>`;
}
