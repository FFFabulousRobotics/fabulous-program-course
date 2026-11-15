import {esc,markdown} from './html.js';
import {resultView,runResultView} from './result-views.js';
import {fixedMain,editableSoda,composeSoda} from './soda-editor.js';
import {handleCodeKey} from './code-editing.js';
import {filterMembers,memberGroups} from './member-views.js';
import {knowledgeQuestions,programmingStatement,knowledgeFeedback,exerciseFeedback,programmingFeedback} from './practice.js';
import {assessmentEditor,collectTask,assessmentClick,assessmentChange} from './assessment.js';
import {renderSection,disposeSections} from './sections.js';
import {dashboardView,problemsView,lessonRail,courseAdminView,usersView,userSubmissionsView,collectPublication,publicationChange} from './course-views.js';
const app=document.querySelector('#app'),toasts=document.querySelector('#toast-region');
const fresh=()=>({token:sessionStorage.getItem('fp.session')||'',user:null,data:null,lesson:null,progress:null,source:'',answers:{},result:null,fillResult:null,exerciseResult:null,profileOpen:false,profileMode:'main',tab:'read',draftStatus:'已保存',page:'dashboard',lessonId:null,lockRead:sessionStorage.getItem('fp.lockRead')||''});
let S=fresh(),ticket=0,draftRevision=0,draftTimer,saveChain=Promise.resolve();
const routeCache=new Map(),localDrafts=new Map();let cacheGeneration=0;
function invalidateRoutes(){cacheGeneration++;routeCache.clear();}
function routeData(path,token=S.token){
 const key=token+' '+path,cached=routeCache.get(key);
 if(cached&&(cached.pending||cached.until>Date.now()))return cached.promise;
 const generation=cacheGeneration,entry={pending:true,until:0};
 entry.promise=request(path,{token}).then(data=>{entry.pending=false;entry.until=Date.now()+10000;if((token!==S.token||generation!==cacheGeneration)&&routeCache.get(key)===entry)routeCache.delete(key);return data;},e=>{if(routeCache.get(key)===entry)routeCache.delete(key);throw e;});
 routeCache.set(key,entry);return entry.promise;
}
const date=x=>new Date(x).toLocaleString('zh-CN',{hour12:false});
function toast(message,bad=false){const el=document.createElement('div');el.className='toast'+(bad?' bad':'');el.textContent=message;toasts.append(el);setTimeout(()=>el.remove(),4500);}
function resetSession(){disposeSections();disposeSim();clearTimeout(draftTimer);ticket++;draftRevision++;invalidateRoutes();localDrafts.clear();saveChain=Promise.resolve();sessionStorage.removeItem('fp.session');S=fresh();toasts.replaceChildren();}
async function request(path,{method='GET',body,token=S.token}={}){
  const controller=method==='GET'?new AbortController():null,timer=controller?setTimeout(()=>controller.abort(),12000):null;
  let response,payload;
  try{response=await fetch(path,{method,signal:controller?.signal,cache:'no-store',credentials:'omit',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});payload=await response.json();}
  catch(e){if(controller?.signal.aborted)throw Error('加载超时，请重试');throw e;}finally{if(timer)clearTimeout(timer);}
  if(token!==S.token&&path!=='/api/auth/login')throw Object.assign(Error('旧会话响应已丢弃'),{stale:true});
  if(!response.ok){if(response.status===401&&path!=='/api/auth/login'){resetSession();renderLogin();}throw Object.assign(Error(payload.error||'请求失败'),{status:response.status});}
  if(method!=='GET'&&!/^\/api\/(drafts|sim)(\/|$)/.test(path))invalidateRoutes();
  return payload;
}
const accountEvents=typeof BroadcastChannel==='function'?new BroadcastChannel('fp.accounts'):null;
if(accountEvents)accountEvents.onmessage=event=>{if(event.data?.type==='account-deleted'&&event.data.userId===S.user?.id){resetSession();sessionStorage.removeItem('fp.lockRead');renderLogin();toast('账户及全部个人数据已永久删除');}};
const post=(path,body,method='POST')=>request(path,{method,body});
const notifyError=e=>{if(!e.stale)toast(e.message,true);};
function hash(){return (location.hash.replace(/^#\/?/,'')||'dashboard').split('/');}
const done=(l,p={})=>l.exerciseOnly&&l.submissionLimit===1?p.exerciseSubmitted===true:l.fillQuestions?.length||l.codeTask?(typeof p.exercisePassed==='boolean'?p.exercisePassed:!!((!l.fillQuestions?.length||p.fillPassed)&&(!l.codeTask||p.codePassed))):!!p.read;
function heading(kicker,title,desc,action=''){return `<section class="page-heading"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p>${desc}</p></div>${action}</section>`;}
function shell(content,current=S.page){return `<header class="topbar"><a class="brand" href="#/dashboard"><img class="club-logo" src="/course-assets/fffabulous-19726.jpg" alt="FFFabulous 19726"><span class="brand-copy"><strong>FabulousProgram</strong><small>FFFabulous · FTC 19726</small></span></a><nav aria-label="主导航">${(S.user.role==='admin'?[['activity','成员活跃'],['admin','课程发布'],['materials-admin','课程资料管理'],['users','成员管理']]:[['dashboard','课程'],['materials','课程资料'],['compiler','在线编译'],['problems','课后练习'],['records','提交记录'],['rank','学习进度']]).map(([id,label])=>`<a href="#/${id}" class="${current===id?'active':''}">${label}</a>`).join('')}</nav><button type="button" class="user-menu" data-action="profile" title="个人中心" aria-controls="profile-panel" aria-expanded="${S.profileOpen?'true':'false'}"><span class="avatar">${esc(S.user.displayName[0])}</span><span><b>${esc(S.user.displayName)}</b><small>@${esc(S.user.username)} · ${S.user.role==='admin'?(S.user.owner?'Owner':'管理员'):'成员'}</small></span><span class="logout-icon">个人中心 ▾</span></button>${S.profileOpen?profilePanel(S.profileMode):''}</header><main class="page-shell">${content}</main><footer><span>FabulousProgram · FFFabulous · FTC 19726</span><span>从每一次练习，走向赛场。</span></footer>`;}
function renderLogin(register=false){document.title=(register?'注册':'登录')+' · FabulousProgram';app.innerHTML=`<main class="fp-login"><section class="card fp-login-card"><div class="login-identity"><img src="/course-assets/fffabulous-19726.jpg" alt="FFFabulous 19726 队徽"><span class="kicker">FFFabulous · FTC 19726</span><h1>FabulousProgram</h1><p>${register?'创建成员账号，开始学习。':'欢迎回来，继续你的编程课程。'}</p></div><form id="${register?'register-form':'login-form'}" class="login-form"><label>用户名<input name="username" autocomplete="username" required pattern="[A-Za-z0-9_]{3,20}" maxlength="20" placeholder="3–20 位字母、数字或下划线"></label>${register?'<label>姓名 / 昵称<input name="displayName" required maxlength="30" autocomplete="name"></label>':''}<label>密码<input name="password" type="password" autocomplete="${register?'new-password':'current-password'}" required ${register?'minlength="10"':''} maxlength="200" placeholder="${register?'至少 10 位，避免使用常见密码':'输入密码'}"></label>${register?'<label>确认密码<input name="confirmPassword" type="password" autocomplete="new-password" required minlength="10" maxlength="200"></label>':''}<button class="primary-btn large" type="submit">${register?'注册成员账号':'登录'}</button><button type="button" class="ghost-btn" data-auth-view="${register?'login':'register'}">${register?'已有账号？返回登录':'还没有账号？立即注册'}</button></form></section></main>`;}
function renderDashboard(){app.innerHTML=shell(dashboardView(S.data),'dashboard');}
function renderProblems(){app.innerHTML=shell(problemsView(S.data,hash()[1]),'problems');}
function lessonNavigation(){return lessonRail(S.data,S.lesson);}
function fixedEditor(task){return !!task?.grader&&task.fixedMain!==false;}
function practiceView(){
 const l=S.lesson,p=S.progress,hasKnowledge=!!l.fillQuestions.length,hasCode=!!l.codeTask,result=S.exerciseResult,locked=l.submissionLimit===1&&!!result,knowledgeWeight=l.scoring?.knowledgeWeight??(hasCode?50:100),programmingWeight=l.scoring?.programmingWeight??(hasKnowledge?50:100);
 const policy=hasKnowledge&&hasCode?`知识题 ${knowledgeWeight} 分 + 编程题 ${programmingWeight} 分，合计 100 分。`:hasCode?'编程题满分 100 分。':'知识题满分 100 分。';
 return `<div class="practice-stack">${exerciseFeedback(result,markdown,resultView,{inline:true})}${hasKnowledge||hasCode?`<p class="quiz-policy">${policy}${l.submissionLimit===1?'仅允许一次正式提交，提交后显示分数和答案解析，不能重交。运行代码不计入提交；':'完成全部题目后统一交卷，可重复提交；'}${l.acScoring==='first-score'?'本练习直接按首次原始得分计入 AC 率，不乘权重、不加奖励；':'AC 计分 = 首次得分 × 0.7 + 达到满分的奖励分；'}未提交的练习不计入 AC 率分母。</p>`:''}
 <form id="exercise-form">${hasKnowledge?`<section class="card exercise-card"><div class="exercise-head"><div><span class="kicker">KNOWLEDGE CHECK</span><h2>${l.exerciseOnly?'客观题':'知识检查'}</h2></div><span class="status ongoing">${l.fillQuestions.length} 题 · ${knowledgeWeight} 分</span></div><div class="exercise-questions">${knowledgeQuestions(l.fillQuestions,S.answers,result,markdown,locked)}</div></section>`:''}</form>
 ${hasCode?`<section class="card code-task">${programmingStatement(l.codeTask,markdown)}<div class="editor-wrap"><div class="editor-head"><span><i></i>${esc(l.codeTask.kind==='java'?(fixedEditor(l.codeTask)?(l.codeTask.answerClass||'Soda')+' 类（作答区）':'Main.java'):l.codeTask.kind==='linear'?'MyFirstOp.java':'IterativeDemo.java')}</span><span>${l.codeTask.kind==='java'?'JDK 21':'Beta8397 · 官方 SDK 编译检查'}</span></div><div class="code-area"><pre class="line-numbers" aria-hidden="true">${lineNumbers()}</pre><textarea ${locked?'readonly':''} id="code-editor" name="source" form="exercise-form" required maxlength="30000" spellcheck="false" aria-label="Java 代码编辑器" autocapitalize="off">${esc(fixedEditor(l.codeTask)?editableSoda(S.source,l.codeTask):S.source)}</textarea></div>${fixedEditor(l.codeTask)?`<section class="fixed-main"><h3>Main 主程序（只读，不可修改）</h3><p>运行和提交时自动拼接此主程序，只需在上方补全 ${esc(l.codeTask.answerClass||'Soda')} 类。</p><pre id="fixed-main"><code>${esc(fixedMain(l.codeTask))}</code></pre></section>`:''}${l.codeTask.kind==='java'&&!fixedEditor(l.codeTask)?`<label class="run-input">自测输入（stdin）<textarea id="run-input" rows="5" maxlength="10000" spellcheck="false" placeholder="粘贴样例输入或自行构造数据">${esc(S.runInput||'')}</textarea><small>运行代码仅用于自测，不交卷、不计分。</small></label>`:''}<div class="editor-actions"><span id="draft-state">${locked?'答卷已封存':esc(S.draftStatus)}</span><button type="button" class="ghost-btn" data-action="reset-code" ${locked?'disabled':''}>重置代码</button><button type="button" class="secondary-btn" data-action="run-code">运行代码</button></div></div>${S.result?.preview||S.result?.status==='RUN'?resultView(S.result):''}${S.sim?simView():''}${l.submissionLimit===1?programmingFeedback(result,markdown,resultView):''}</section>`:''}
 ${hasKnowledge||hasCode?`<section class="card exercise-submit"><div><b>${locked?'答卷已封存':'统一交卷'}</b><p>${policy}${locked?'已保存首次提交成绩，可在各题下方查看答案解析。':'答题和代码一起提交，评测完成后显示总分。'}</p></div>${l.submissionLimit===1&&!locked?'<label class="single-submit-confirm"><input type="checkbox" form="exercise-form" name="confirmOnce" required>我已检查答卷，确认提交后不能修改</label>':''}<button class="primary-btn" type="submit" form="exercise-form" ${locked?'disabled':''}>${locked?'已提交 · 不可重交':l.submissionLimit===1?'提交整份练习（仅一次）':'提交整份练习'}</button></section>`:'<section class="card notice"><h3>本教程无需提交练习</h3><p>完成阅读即可。</p></section>'}</div>`;
}
function lineNumbers(){return (fixedEditor(S.lesson?.codeTask)?editableSoda(S.source,S.lesson.codeTask):S.source).split('\n').map((_,i)=>i+1).join('\n');}
function profilePanel(mode='main'){
  const u=S.user;
  if(mode==='delete')return `<div id="profile-panel" class="profile-panel"><h3>注销账号</h3><p class="profile-note">注销将永久删除账户资料、所有学习进度、成绩与提交、课程草稿和在线编译草稿，并退出所有登录。此操作不可恢复。</p><form id="profile-delete-form" class="profile-form"><label>输入当前密码确认<input name="password" type="password" required autocomplete="current-password"></label><label class="check-line"><input name="confirmDeletion" type="checkbox" required>我确认永久删除账户及全部个人数据，且无法恢复</label><div class="profile-row"><button type="button" class="ghost-btn" data-action="profile-back">返回</button><button class="danger-btn" type="submit">永久删除账户</button></div></form></div>`;
  return `<div id="profile-panel" class="profile-panel"><div class="profile-head"><span class="avatar">${esc(u.displayName[0])}</span><div><b>${esc(u.displayName)}</b><small>@${esc(u.username)} · ${u.role==='admin'?(u.owner?'Owner':'管理员'):'成员'}</small></div></div><form id="profile-profile-form" class="profile-form"><label>姓名 / 昵称<input name="displayName" value="${esc(u.displayName)}" required maxlength="30" autocomplete="name"></label><label>用户名（登录用，3–20 位字母、数字或下划线）<input name="username" value="${esc(u.username)}" required pattern="[A-Za-z0-9_]{3,20}" maxlength="20" autocomplete="username" spellcheck="false"></label><button class="secondary-btn" type="submit">保存资料</button></form><form id="profile-password-form" class="profile-form"><label>当前密码<input name="oldPassword" type="password" required autocomplete="current-password"></label><label>新密码（至少 10 位）<input name="newPassword" type="password" required minlength="10" maxlength="200" autocomplete="new-password"></label><label>确认新密码<input name="confirmPassword" type="password" required autocomplete="new-password"></label><button class="secondary-btn" type="submit">修改密码</button></form><div class="profile-row"><button type="button" class="ghost-btn" data-action="logout">退出登录</button><button type="button" class="ghost-btn danger-text" data-action="profile-delete">注销账号…</button></div></div>`;
}
function toggleProfilePanel(force){
  const existing=document.querySelector('#profile-panel');
  S.profileOpen=force==='open'||!S.profileOpen;S.profileMode='main';
  document.querySelector('[data-action="profile"]')?.setAttribute('aria-expanded',String(S.profileOpen));
  if(!S.profileOpen){existing?.remove();return;}
  if(!existing)document.querySelector('.topbar')?.insertAdjacentHTML('beforeend',profilePanel());
}
function closeProfile(){S.profileOpen=false;document.querySelector('#profile-panel')?.remove();document.querySelector('[data-action="profile"]')?.setAttribute('aria-expanded','false');}
function setReadLock(lessonId){
  S.lockRead=lessonId;
  if(lessonId)sessionStorage.setItem('fp.lockRead',lessonId);else sessionStorage.removeItem('fp.lockRead');
}
function renderLesson(){
  const l=S.lesson;const next=S.data.lessons[S.data.lessons.findIndex(x=>x.id===l.id)+1],week=S.data.weeks.find(w=>w.id===l.weekId);
  if(l.exerciseOnly){S.tab='practice';app.innerHTML=shell(`<div class="breadcrumb"><a href="#/problems">全部练习</a><span>›</span><b>${esc(l.title)}</b></div><section class="lesson-hero"><div><span class="lesson-code big">${esc(l.code)}</span><div><h1>${esc(l.title)}</h1><p>${esc(l.subtitle)} · 满分100分</p></div></div></section><div class="lesson-layout exercise-only">${lessonNavigation()}<section>${practiceView()}</section></div>`,'problems');document.title=l.title+' · FabulousProgram';return;}
  const readLocked=S.tab==='practice'&&S.lockRead===l.id&&l.fillQuestions.length&&!S.progress.fillPassed;
  app.innerHTML=shell(`<div class="breadcrumb"><a href="#/problems/${l.weekId}">${esc(week?.code||'')} ${esc(week?.title||'课程')}</a><span>›</span><b>${esc(l.code)} ${esc(l.title)}</b></div><section class="lesson-hero"><div><span class="lesson-code big">${esc(l.code)}</span><div><h1>${esc(l.title)}</h1><p>${esc(l.subtitle)}</p></div></div><span class="status ongoing">${done(l,S.progress)?'✓ 已完成':l.estimate}</span></section><div class="lesson-layout">${lessonNavigation()}<section><div class="lesson-tabs"><button data-tab="read" class="${S.tab==='read'?'active':''}" ${readLocked?'disabled title="练习进行中，提交知识检查后可回看教程"':''}>教程 ${S.progress.read?'✓':''}${readLocked?' 🔒':''}</button><button data-tab="practice" class="${S.tab==='practice'?'active':''}">课后练习 ${done(l,S.progress)?'✓':''}</button></div>${S.tab==='read'?`<article class="card lesson-content"><div class="markdown">${markdown(l.content)}</div><div class="article-finish"><span>${S.progress.read?'✓ 已完成阅读':'读完后保存学习进度'}</span><button class="primary-btn" data-action="complete-read">${S.progress.read?'进入课后练习':'读完了，去练习'} →</button></div></article>`:practiceView()}${next?`<a class="next-lesson" href="#/lesson/${next.id}">下一篇：${esc(next.title)} →</a>`:''}</section></div>`,'problems');document.title=l.title+' · FabulousProgram';}
function renderRecords(data){app.innerHTML=shell(`${heading('SUBMISSIONS','提交记录','查看每一次真实测试、得分和源代码。',S.user.role==='admin'?'<label>记录范围<select id="record-scope"><option value="mine">我的提交</option><option value="all" '+(hash()[1]==='all'?'selected':'')+'>所有成员</option></select></label>':'')}<section class="card record-list">${data.submissions.length?data.submissions.map(s=>`<details class="submission"><summary><span class="verdict ${esc(s.status)}">${esc(s.status)}</span><span><b>${esc(s.lessonTitle)}</b><small>${esc(s.user)} · ${s.kind==='exercise'?'整份练习':s.kind==='code'?'编程（旧记录）':'知识检查（旧记录）'} · ${date(s.createdAt)}</small></span><strong>${s.score} 分</strong><span>详情⌄</span></summary>${s.kind==='exercise'?exerciseFeedback(s,markdown,resultView):resultView(s)}${s.source?`<pre class="submission-source">${esc(s.source)}</pre>`:''}</details>`).join(''):'<div class="empty">还没有提交记录。去完成第一份课后练习吧。</div>'}</section>`,'records');}
function renderRank(data){app.innerHTML=shell(`${heading('PROGRESS','成员学习进度','按完成数排序。AC 率为已提交练习计分的平均值，未提交不计入，0分计入。W4按首次原始得分直接计入，不加权、不加奖励；旧课程仍按首次得分×0.7加首次满分奖励计算。')}<section class="card">${data.rankings.map((r,i)=>`<div class="fp-rank-row"><b>${i+1}</b><span class="avatar">${esc(r.user.displayName[0])}</span><strong>${esc(r.user.displayName)}</strong><span>${r.accepted} / ${r.total} 教程</span><span>${r.submissions} 次提交</span><span title="按 ${r.scoredExercises??0} 份已评分练习计算">AC 率 ${r.rate===null?'—':r.rate+'%'}</span></div>`).join('')||'<div class="empty">暂无成员</div>'}</section>`,'rank');}
function renderActivity(data){app.innerHTML=shell(`${heading('ADMIN CONSOLE','成员活跃','近 7 天活跃率：有登录或学习操作的启用成员 ÷ 全部启用成员。管理员和停用账号不计入。','<a class="primary-btn" href="#/admin">发布新课程 →</a>')}<section class="card stats-card"><div><span>启用成员</span><strong>${data.enabled}</strong></div><div><span>近 7 天活跃</span><strong>${data.active7}</strong></div><div><span>活跃率</span><strong>${data.rate===null?'—':data.rate+'%'}</strong></div></section><section class="card admin-card activity-card"><div class="card-head"><h2>成员学习概况</h2><span>已发布 ${data.published} 篇 · 草稿 ${data.drafts} 篇</span></div><p class="muted">最近活跃包含登录、浏览课程和学习操作，不代表持续在线时长。旧数据仅能从已有学习记录推算。</p><div class="activity-scroll"><table class="activity-table"><thead><tr><th>成员</th><th>状态</th><th>最近活跃</th><th>教程完成</th><th>AC 率</th><th>近 7 天提交</th><th>详情</th></tr></thead><tbody>${data.members.map(m=>`<tr><td><b>${esc(m.user.displayName)}</b><small>@${esc(m.user.username)}</small></td><td>${m.user.active?'启用':'停用'}</td><td>${m.lastActiveAt?date(m.lastActiveAt):'暂无记录'}</td><td>${m.accepted} / ${m.total}</td><td>${m.rate===null?'—':m.rate+'%'}</td><td>${m.recentSubmissions}</td><td><a href="#/users/${esc(m.user.id)}">学习详情 →</a></td></tr>`).join('')||'<tr><td colspan="7">尚无成员，成员可在登录页自行注册。</td></tr>'}</tbody></table></div></section>`,'activity');document.title='成员活跃 · FabulousProgram';}
function renderAdmin(l,options={}){S.adminLessonId=l?.id||null;S.adminWeekId=options.weekId||l?.weekId||S.data.weeks[0]?.id;S.adminDirty=false;app.innerHTML=shell(courseAdminView(S.data,l,options),'admin');document.title='课程发布 · FabulousProgram';}
function renderUsers(users){S.users=users;S.userFilters||={};app.innerHTML=shell(usersView(users,S.user,S.userFilters),'users');document.title='成员管理 · FabulousProgram';}
function filterUserList(){const rows=document.querySelector('#member-groups');if(!rows||!S.users)return;S.userFilters={query:document.querySelector('#user-search').value,status:document.querySelector('#user-status').value,role:document.querySelector('#user-role-filter').value,sort:document.querySelector('#user-sort').value};const selected=filterMembers(S.users,S.userFilters);rows.innerHTML=memberGroups(selected,S.user);document.querySelector('#member-count').textContent=selected.length+' / '+S.users.length+' 人';}
document.addEventListener('input',event=>{if(event.target.id==='user-search')filterUserList();});
document.addEventListener('change',event=>{if(['user-status','user-role-filter','user-sort'].includes(event.target.id))filterUserList();});
function renderUserSubmissions(data){app.innerHTML=shell(userSubmissionsView(data,s=>s.kind==='exercise'?exerciseFeedback(s,markdown,resultView):resultView(s)),'users');document.title=data.user.displayName+(data.user.role==='admin'?'的提交记录':'的学习详情')+' · FabulousProgram';}

function routePath(page,id,tab){
 if(page==='materials'||page==='materials-admin')return '/api/materials';
 if(page==='compiler')return '/api/compiler/draft';
 if(page==='activity')return '/api/admin/activity';
 if(page==='lesson'&&id)return '/api/lessons/'+encodeURIComponent(id);
 if(page==='records')return '/api/submissions?scope='+(id==='all'?'all':'mine');
 if(page==='rank')return '/api/rankings';
 if(page==='users')return id?'/api/admin/users/'+encodeURIComponent(id)+'/submissions':'/api/admin/users';
 if(page==='admin'&&!['week','new-week','new'].includes(id)){
  const lessonId=id||S.data?.lessons.find(l=>l.weekId===S.data.homeWeekId)?.id||S.data?.lessons[0]?.id;
  if(lessonId)return '/api/lessons/'+encodeURIComponent(lessonId);
 }
 return null;
}
async function loadRoute(){
 disposeSections();disposeSim();
 const myTicket=++ticket,token=S.token,[page,id,tab]=hash();clearTimeout(draftTimer);
 if(!token){renderLogin();return;}
 S.page=page;if(page!=='lesson')S.lessonId=null;
 const loading='<section class="card route-loading" role="status">正在加载…</section>';app.innerHTML=S.user?shell(loading,page):'<main class="page-shell">'+loading+'</main>';
 const path=routePath(page,id,tab),pageRequest=path?routeData(path):null;
 pageRequest?.catch(()=>{});
 try{
  const data=await routeData('/api/bootstrap');if(myTicket!==ticket||token!==S.token)return;
  S.user=data.user;S.data=data;
  if(S.user.role==='admin'&&!['admin','activity','materials-admin','users'].includes(page)){location.hash=page==='lesson'?'#/admin/'+id:'#/activity';return;}
  if(['materials','materials-admin','compiler'].includes(page)){
   if(page==='materials-admin'&&S.user.role!=='admin'){location.hash='#/materials';return;}
   let initial=pageRequest;
   const sectionRequest=(path,options={})=>{if(initial&&path===routePath(page,id,tab)&&(!options.method||options.method==='GET')){const pending=initial;initial=null;return pending;}return request(path,{...options,token});};
   await renderSection(page,{app,shell,request:sectionRequest,token,current:()=>myTicket===ticket&&token===S.token,resultView,notifyError});return;
  }
  if(page==='activity'){if(S.user.role!=='admin'){location.hash='#/dashboard';return;}const result=await pageRequest;if(myTicket===ticket)renderActivity(result);return;}
  if(page==='lesson'){
   if(!id)throw Error('请选择教程');
   const payload=await pageRequest;if(myTicket!==ticket||token!==S.token)return;
   if(S.lessonId!==id)setReadLock('');
   let enterTab=payload.lesson.exerciseOnly||tab==='practice'?'practice':'read';
   if(enterTab==='read'&&S.lockRead===id&&payload.lesson.fillQuestions.length&&!payload.progress.fillPassed)enterTab='practice';
   const key=token+' '+id,local=localDrafts.get(key),draft=local?.body||{source:payload.draft.source??payload.lesson.codeTask?.starter??'',answers:payload.draft.answers||{}};
   if(payload.lesson.submissionLimit===1&&payload.exerciseResult){draft.source=payload.exerciseResult.source;draft.answers={...payload.exerciseResult.answers};}
   if(!local)localDrafts.set(key,{body:draft,signature:JSON.stringify(draft),status:'saved',pending:Promise.resolve()});
   Object.assign(S,{lesson:payload.lesson,lessonId:id,progress:payload.progress,source:draft.source,answers:{...draft.answers},result:null,fillResult:payload.knowledgeResult||null,exerciseResult:payload.exerciseResult||null,tab:enterTab,runInput:payload.lesson.codeTask?.samples?.[0]?.input||'',draftStatus:local?.status==='saving'?'保存中…':local?.status==='failed'?'保存失败，请重试':'已保存'});renderLesson();window.scrollTo(0,0);
  }else if(page==='records'){const result=await pageRequest;if(myTicket===ticket)renderRecords(result);}
  else if(page==='rank'){const result=await pageRequest;if(myTicket===ticket)renderRank(result);}
  else if(page==='users'){
   if(S.user.role!=='admin'){location.hash='#/dashboard';return;}
   const result=await pageRequest;if(myTicket===ticket){if(id)renderUserSubmissions(result);else renderUsers(result.users);}
  }else if(page==='admin'){
   if(S.user.role!=='admin'){location.hash='#/dashboard';return;}
   let lesson=null,mode=['week','new-week','new'].includes(id)?id:'lesson',weekId=tab;
   if(mode==='lesson'){const lessonId=id||data.lessons.find(l=>l.weekId===data.homeWeekId)?.id||data.lessons[0]?.id;if(lessonId)lesson=(await (path==='/api/lessons/'+encodeURIComponent(lessonId)?pageRequest:routeData('/api/lessons/'+encodeURIComponent(lessonId)))).lesson;else mode=data.weeks.length?'week':'new-week';}
   if(mode==='new'&&!data.weeks.length)mode='new-week';
   if(weekId&&!data.weeks.some(w=>w.id===weekId))throw Error('周课程不存在');
   if(myTicket===ticket)renderAdmin(lesson,{mode,weekId});
  }else if(page==='problems')renderProblems();else renderDashboard();
  if(!['lesson','users'].includes(page))document.title='FabulousProgram';
 }catch(e){
  if(myTicket!==ticket||e.stale||token!==S.token)return;notifyError(e);
  if(S.token){const content='<section class="card error-page"><h2>页面无法加载</h2><p>'+esc(e.message)+'</p><button type="button" class="primary-btn" data-action="retry-route">重新加载</button> <a href="#/dashboard">返回课程</a></section>';app.innerHTML=S.user?shell(content):'<main class="page-shell">'+content+'</main>';}
 }
}
function saveDraft(){
 clearTimeout(draftTimer);if(!S.token||!S.lessonId||(S.lesson?.submissionLimit===1&&S.exerciseResult))return Promise.resolve();
 const token=S.token,id=S.lessonId,revision=draftRevision,key=token+' '+id,body={source:S.source,answers:{...S.answers}},signature=JSON.stringify(body),previous=localDrafts.get(key);
 if(previous?.signature===signature&&previous.status!=='failed')return previous.pending;
 const entry={body,signature,status:'saving',pending:null};localDrafts.set(key,entry);
 const job=saveChain.catch(()=>{}).then(()=>{
  if(localDrafts.get(key)!==entry)return;
  return request('/api/drafts/'+id,{method:'PUT',body,token});
 }).then(()=>{
  entry.status='saved';routeCache.delete(token+' /api/lessons/'+encodeURIComponent(id));
  if(localDrafts.get(key)===entry&&S.token===token&&S.lessonId===id&&revision===draftRevision){S.draftStatus='已保存';const label=document.querySelector('#draft-state');if(label)label.textContent=S.draftStatus;}
 }).catch(e=>{entry.status='failed';if(!e.stale&&S.token===token&&S.lessonId===id&&localDrafts.get(key)===entry){S.draftStatus='保存失败，请重试';notifyError(e);}});
 entry.pending=job;saveChain=job;return job;
}
async function refreshProgress(){routeCache.delete(S.token+' /api/bootstrap');const token=S.token,data=await routeData('/api/bootstrap');if(token===S.token)S.data=data;}

async function guardedAction(button,operation){const token=S.token,currentTicket=ticket,label=button.textContent;button.disabled=true;try{await operation(()=>S.token===token&&ticket===currentTicket);}catch(e){notifyError(e);}finally{button.disabled=false;button.textContent=label;}}
document.addEventListener('submit',async event=>{
  if(!event.target.matches('form'))return;event.preventDefault();const form=event.target,button=event.submitter||form.querySelector('button[type="submit"]')||form.querySelector('button')||document.querySelector('button[form="'+form.getAttribute('id')+'"][type="submit"]');
  await guardedAction(button,async current=>{
    const values=Object.fromEntries(new FormData(form));
    if(form.getAttribute('id')==='register-form'){if(values.password!==values.confirmPassword)throw Error('两次密码不一致');await post('/api/auth/register',values);renderLogin();toast('注册成功，请使用新账号登录');return;}
    if(form.getAttribute('id')==='login-form'){
      resetSession();const response=await post('/api/auth/login',values);sessionStorage.setItem('fp.session',response.token);S=fresh();S.user=response.user;const destination=response.user.role==='admin'?'#/activity':'#/dashboard';if(location.hash===destination)await loadRoute();else location.hash=destination;toast('已登录 '+response.user.displayName);return;
    }
    if(form.getAttribute('id')==='profile-profile-form'){
      const response=await post('/api/auth/profile',{displayName:values.displayName,username:values.username});
      S.user=response.user;if(S.data)S.data.user=response.user;
      const menuB=document.querySelector('.user-menu b');if(menuB)menuB.textContent=response.user.displayName;
      const menuAvatar=document.querySelector('.user-menu .avatar');if(menuAvatar)menuAvatar.textContent=response.user.displayName[0];
      const menuSmall=document.querySelector('.user-menu small');if(menuSmall)menuSmall.textContent=`@${response.user.username} · ${response.user.role==='admin'?'管理员':'成员'}`;
      const panel=document.querySelector('#profile-panel');if(panel)panel.outerHTML=profilePanel();
      toast('资料已更新');return;
    }
    if(form.getAttribute('id')==='profile-password-form'){if(values.newPassword!==values.confirmPassword)throw Error('两次输入的新密码不一致');await post('/api/auth/password',{oldPassword:values.oldPassword,newPassword:values.newPassword});form.reset();toast('密码已修改');return;}
    if(form.getAttribute('id')==='profile-delete-form'){if(values.confirmDeletion!=='on')throw Error('请勾选永久删除确认');button.textContent='正在永久删除…';await post('/api/auth/delete',{password:values.password,confirmation:'DELETE_ALL_DATA'});accountEvents?.postMessage({type:'account-deleted',userId:S.user.id});resetSession();sessionStorage.removeItem('fp.lockRead');renderLogin();toast('账户及全部个人数据已永久删除');return;}
    if(form.getAttribute('id')==='exercise-form'){
      if(S.lesson.submissionLimit===1&&(S.exerciseResult||values.confirmOnce!=='on'))throw Error(S.exerciseResult?'答卷已封存，不可重交':'请确认仅一次提交机会');
      const id=S.lessonId,source=S.source,answers=Object.fromEntries(S.lesson.fillQuestions.map(q=>[q.id,values[q.id]||'']));
      S.answers=answers;await saveDraft();if(!current()||S.lessonId!==id)return;
      button.textContent='正在评测整份练习…';
      const result=await post('/api/submit/exercise',{lessonId:id,answers,source});if(!current()||S.lessonId!==id)return;
      S.exerciseResult=result;S.fillResult=result;S.progress=result.progress;S.result=null;if(S.lesson.submissionLimit===1){clearTimeout(draftTimer);S.answers={...result.answers};S.source=result.source;S.draftStatus='答卷已封存';localDrafts.delete(S.token+' '+id);}setReadLock('');
      await refreshProgress();if(current()){renderLesson();document.querySelector('.quiz-summary')?.scrollIntoView?.({block:'center',behavior:'smooth'});}
    }
    if(form.getAttribute('id')==='fill-form'){const id=S.lessonId;S.answers=values;await saveDraft();if(!current()||S.lessonId!==id)return;const result=await post('/api/submit/fill',{lessonId:id,answers:values});if(!current())return;S.fillResult=result;S.progress=result.progress;if(S.progress.fillPassed)setReadLock('');await refreshProgress();if(current()){renderLesson();document.querySelector('.quiz-summary')?.scrollIntoView?.({block:'center',behavior:'smooth'});}}
    if(form.getAttribute('id')==='user-password-form'){
      const dialog=form.closest('dialog'),fields=form.querySelector('fieldset'),note=form.querySelector('[role="alert"]');
      if(fields.disabled)return;
      note.textContent='';
      if(values.password.length<6||values.password.length>200){note.textContent='密码长度应为 6–200 位';return;}
      if(values.password!==values.confirmPassword){note.textContent='两次输入的新密码不一致';form.elements.confirmPassword.focus();return;}
      fields.disabled=true;button.textContent='正在重置…';
      try{
        await post('/api/admin/users/'+encodeURIComponent(values.userId),{password:values.password},'PATCH');
        form.reset();
        if(current()){dialog.close();toast('密码已重置，该用户需使用新密码重新登录');}
      }catch(e){if(!e.stale&&current())note.textContent=e.message;}
      finally{fields.disabled=false;}
      return;
    }
    if(form.getAttribute('id')==='user-form'){await post('/api/admin/users',values);if(current()){toast('账号已创建');await loadRoute();}}
    if(form.getAttribute('id')==='lesson-form'){try{values.position=Number(values.position);values.questions=JSON.parse(values.questions||'[]');values.codeTask=collectTask();const result=await post('/api/admin/lessons',values);if(current()){S.adminDirty=false;toast(result.lesson.publishAt?'教程已预约发布':'教程已保存');if(hash()[1]!==result.lesson.id)location.hash='#/admin/'+result.lesson.id;else await loadRoute();}}catch(e){if(current())document.querySelector('#course-save-note').textContent=e.message;throw e;}}
    if(form.getAttribute('id')==='week-form'){try{values.number=Number(values.number);Object.assign(values,collectPublication(values));delete values.publicationMode;const result=await post('/api/admin/weeks',values);if(current()){S.adminDirty=false;toast(result.week.publishAt?'周课程已预约发布':'周课程已保存');if(hash()[1]!=='week'||hash()[2]!==result.week.id)location.hash='#/admin/week/'+result.week.id;else await loadRoute();}}catch(e){if(current())document.querySelector('#course-save-note').textContent=e.message;throw e;}}
    if(form.getAttribute('id')==='home-week-form'){await post('/api/admin/course-settings',{homeWeekId:values.homeWeekId||null});if(current()){toast('首页展示已更新');await loadRoute();}}
  });
});
document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button||(button.type==='submit'&&button.form))return;
  if(button.dataset.userReset){
    if(button.disabled)return;
    const dialog=document.querySelector('#user-password-dialog'),form=dialog.querySelector('form');
    form.reset();form.elements.userId.value=button.dataset.userReset;
    dialog.querySelector('#user-password-target').textContent=button.dataset.displayName+'（@'+button.dataset.username+'）';
    dialog.querySelector('[role="alert"]').textContent='';
    dialog.oncancel=event=>{if(form.querySelector('fieldset').disabled)event.preventDefault();};
    dialog.onclose=()=>form.reset();
    dialog.showModal();return;
  }
  if(button.dataset.action==='cancel-user-password'){const dialog=button.closest('dialog');if(!dialog.querySelector('fieldset').disabled)dialog.close();return;}
  if(button.dataset.action==='profile'){toggleProfilePanel();return;}
  if(button.dataset.action==='retry-route'){invalidateRoutes();await loadRoute();return;}
  if(button.dataset.action==='profile-delete'){S.profileMode='delete';const panel=button.closest('#profile-panel');if(panel)panel.outerHTML=profilePanel('delete');return;}
  if(button.dataset.action==='profile-back'){S.profileMode='main';const panel=button.closest('#profile-panel');if(panel)panel.outerHTML=profilePanel();return;}
  try{if(assessmentClick(button)){document.querySelector('#trial-result').innerHTML='';document.querySelector('#trial-note').textContent='测试点已修改，请重新试评测。';return;}}catch(e){notifyError(e);return;}
  if(button.dataset.simCommand){const sim=S.sim;if(!sim)return;button.disabled=true;try{await post('/api/sim/'+sim.id,{command:button.dataset.simCommand});}catch(e){notifyError(e);}finally{button.disabled=false;}return;}
  if(button.dataset.action==='close-sim'){disposeSim();renderLesson();return;}
  if(button.dataset.authView){renderLogin(button.dataset.authView==='register');return;}
  if(button.dataset.tab){const id=S.lessonId;void saveDraft();if(S.page!=='lesson')return;S.tab=button.dataset.tab;if(S.tab==='practice'&&S.lesson.fillQuestions.length&&!S.progress.fillPassed)setReadLock(id);renderLesson();window.scrollTo(0,0);return;}
  await guardedAction(button,async current=>{
    switch(button.dataset.action){
      case 'logout': {await saveDraft();const token=S.token;resetSession();renderLogin();await request('/api/auth/logout',{method:'POST',body:{},token}).catch(()=>{});return;}
      case 'complete-read': {const result=await post('/api/progress/'+S.lessonId,{});if(!current())return;S.progress=result.progress;S.tab='practice';if(S.lesson.fillQuestions.length&&!S.progress.fillPassed)setReadLock(S.lessonId);await refreshProgress();if(current()){renderLesson();window.scrollTo(0,0);}break;}
      case 'reset-code': S.source=S.lesson.codeTask.starter;S.result=null;await saveDraft();if(current())renderLesson();break;
      case 'run-code':case 'submit-code': {const id=S.lessonId,source=S.source;await saveDraft();if(!current()||S.lessonId!==id)return;const isRun=button.dataset.action==='run-code';button.textContent=isRun?'运行中…':'评测中…';if(isRun&&S.lesson.codeTask.kind!=='java'){await startSim(source,current);break;}const result=await post(button.dataset.action==='run-code'?'/api/run':'/api/submit/code',{lessonId:id,source,...(isRun?{input:S.runInput||''}:{})});if(!current()||S.lessonId!==id)return;S.result={...result,preview:isRun};if(result.progress)S.progress=result.progress;await refreshProgress();if(current())renderLesson();break;}
      case 'trial-task': {const codeTask=collectTask(),source=document.querySelector('#trial-source').value,note=document.querySelector('#trial-note'),out=document.querySelector('#trial-result');if(!codeTask)throw Error('请先启用编程题');const snapshot=JSON.stringify(codeTask);note.textContent='正在编译并执行当前测试点…';out.innerHTML='';try{const result=await post('/api/admin/trial',{codeTask,source});if(current()&&source===document.querySelector('#trial-source').value&&snapshot===JSON.stringify(collectTask())){out.innerHTML=resultView(result);note.textContent='试评测完成；未保存、未发布，也未写入成员成绩。';}else if(current())note.textContent='配置已修改，请重新试评测。';}catch(e){if(current())note.textContent='试评测失败：'+e.message;throw e;}break;}
      case 'delete-lesson': {await post('/api/admin/lessons/'+button.dataset.id,undefined,'DELETE');if(current()){S.adminDirty=false;toast('教程已删除');location.hash='#/admin';}break;}
      case 'delete-week': {await post('/api/admin/weeks/'+button.dataset.id,undefined,'DELETE');if(current()){S.adminDirty=false;toast('周课程已删除');location.hash='#/admin';}break;}
      case 'move-lesson': {if(S.adminDirty)throw Error('请先保存当前编辑，再调整顺序');const lesson=S.data.lessons.find(l=>l.id===button.dataset.id),ids=S.data.lessons.filter(l=>l.weekId===lesson.weekId).map(l=>l.id),index=ids.indexOf(lesson.id),next=index+Number(button.dataset.direction);if(next<0||next>=ids.length)return;[ids[index],ids[next]]=[ids[next],ids[index]];await post('/api/admin/weeks/'+lesson.weekId+'/lesson-order',{lessonIds:ids});if(current()){if(S.adminLessonId&&hash()[1]!==S.adminLessonId)location.hash='#/admin/'+S.adminLessonId;else await loadRoute();}break;}
    }
    if(button.dataset.userToggle){await post('/api/admin/users/'+button.dataset.userToggle,{active:button.dataset.active!=='true'},'PATCH');if(current()){toast('账号状态已更新');await loadRoute();}}
  });
});
document.addEventListener('input',event=>{
  if(S.page==='admin'&&event.target.closest('#lesson-form, #week-form'))S.adminDirty=true;
  if(event.target.closest('.assessment-editor')){const out=document.querySelector('#trial-result');if(out)out.innerHTML='';const note=document.querySelector('#trial-note');if(note)note.textContent='配置或参考程序已修改，请重新试评测。';}
  if(event.target.closest('.beta-pad')){sendPad();return;}
  if(event.target.id==='run-input'){S.runInput=event.target.value;return;}
  if(event.target.id==='code-editor'){S.source=fixedEditor(S.lesson?.codeTask)?composeSoda(event.target.value,S.lesson.codeTask):event.target.value;document.querySelector('.line-numbers').textContent=lineNumbers();}
  else if(event.target.closest('#fill-form, #exercise-form'))S.answers[event.target.name]=event.target.value;else return;
  draftRevision++;S.draftStatus='保存中…';const label=document.querySelector('#draft-state');if(label)label.textContent=S.draftStatus;clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,450);
});
document.addEventListener('keydown',event=>{if(event.target.id!=='code-editor'||event.target.readOnly)return;
if(handleCodeKey(event))return;
if(!event.isComposing&&(event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();document.querySelector('[data-action="run-code"]').click();}});
document.addEventListener('scroll',event=>{if(event.target.id==='code-editor'){const numbers=document.querySelector('.line-numbers');if(numbers)numbers.scrollTop=event.target.scrollTop;}},true);
document.addEventListener('click',event=>{if(event.target.closest('#profile-panel')||event.target.closest('[data-action="profile"]'))return;closeProfile();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeProfile();});
document.addEventListener('change',async event=>{try{assessmentChange(event.target);publicationChange(event.target);if(S.page==='admin'&&event.target.closest('#lesson-form, #week-form'))S.adminDirty=true;if(event.target.id==='lesson-week'){const form=document.querySelector('#lesson-form'),id=form.elements.id.value,lessons=S.data.lessons.filter(l=>l.weekId===event.target.value&&l.id!==id);form.elements.position.max=lessons.length+1;form.elements.position.value=lessons.length+1;}if(event.target.id==='admin-lesson')location.hash='#/admin/'+event.target.value;if(event.target.id==='record-scope')location.hash='#/records/'+event.target.value;if(event.target.dataset.userRole){await post('/api/admin/users/'+event.target.dataset.userRole,{role:event.target.value},'PATCH');toast('角色已更新，旧会话已失效');await loadRoute();}}catch(e){notifyError(e);}});
window.addEventListener('hashchange',()=>{if(S.page==='lesson')void saveDraft();void loadRoute();window.scrollTo(0,0);});
window.addEventListener('beforeunload',event=>{if((S.page==='lesson'&&S.draftStatus==='保存中…')||[...localDrafts.values()].some(d=>d.status!=='saved')||(S.page==='admin'&&S.adminDirty)){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',()=>{if(S.sim)fetch('/api/sim/'+S.sim.id,{method:'DELETE',headers:{Authorization:'Bearer '+S.token},credentials:'omit',keepalive:true}).catch(()=>{});});
let simTimer,padTimer;
function disposeSim(){clearTimeout(simTimer);clearTimeout(padTimer);const sim=S.sim;S.sim=null;if(sim)request('/api/sim/'+sim.id,{method:'DELETE',token:sim.token}).catch(()=>{});}
function simView(){return `<section class="beta-panel" aria-label="Beta8397 仿真"><h3>Beta8397 Virtual Robot</h3><p class="beta-note">本地二维物理仿真 · SDK 兼容实现，不是实体 Control Hub。运行不评分；当前场地为上游 DECODE，课程规则仍按 W1 教案。最多运行 10 分钟。</p><div class="beta-controls"><button data-sim-command="INIT">INIT 初始化</button><button data-sim-command="START">START 开始</button><button data-sim-command="STOP">STOP 停止</button><button data-action="close-sim">关闭仿真</button></div><p class="beta-state" id="beta-state">准备就绪，点击 INIT。</p><div class="beta-layout"><div><img class="beta-frame" id="beta-frame" alt="Beta8397 实时场地画面"><p class="beta-pose" id="beta-pose"></p><p class="beta-note">默认虚拟底盘：Mecanum。电机名 back_left_motor / front_left_motor / front_right_motor / back_right_motor。</p></div><div><h3>实时 telemetry</h3><pre class="beta-telemetry" id="beta-telemetry">（尚无 telemetry）</pre><div class="beta-pad"><label>左右<input id="pad-x" type="range" min="-1" max="1" step=".1" value="0"></label><label>前后<input id="pad-y" type="range" min="-1" max="1" step=".1" value="0"></label><label>转向<input id="pad-turn" type="range" min="-1" max="1" step=".1" value="0"></label><label><input id="pad-a" type="checkbox">手柄 A（按住）</label></div><p class="beta-note">滑杆会保持当前值，回到中点松开摇杆。STOP 或关闭仿真可停止运行。</p><pre class="beta-motors" id="beta-motors"></pre></div></div><h3>控制台输出</h3><pre class="beta-console" id="beta-console">（无输出）</pre></section>`;}
function paintSim(state){const panel=document.querySelector('.beta-panel');if(!panel)return;panel.querySelector('#beta-frame').src=state.image;panel.querySelector('#beta-telemetry').textContent=state.telemetry||'（尚无 telemetry）';panel.querySelector('#beta-console').textContent=state.console||'（无输出）';panel.querySelector('#beta-state').textContent=(state.ended?'进程已结束 · ':state.phase+' · ')+(state.error||'仅运行，不评分');panel.querySelector('#beta-pose').textContent=`位置：${Number(state.x).toFixed(1)}, ${Number(state.y).toFixed(1)} 场地像素 · 朝向 ${(Number(state.heading)*180/Math.PI).toFixed(1)}°`;panel.querySelector('#beta-motors').textContent=(state.motors||[]).map(m=>`${m.name}: 功率 ${m.power.toFixed(2)} · 编码器 ${m.encoder}`).join('\n');for(const b of panel.querySelectorAll('[data-sim-command]'))b.disabled=state.ended||!(b.dataset.simCommand==='INIT'?state.phase==='READY':b.dataset.simCommand==='START'?state.phase==='INIT':['INIT','START'].includes(state.phase));}
async function startSim(source,current){disposeSim();const token=S.token,id=S.lessonId;S.result=null;let response;try{response=await post('/api/sim',{lessonId:id,source});}catch(e){if(current()&&S.lessonId===id){S.result={preview:true,status:e.status===400?'CE':'RE',engine:'Beta8397 Virtual Robot',message:e.message};renderLesson();}return;}if(!current()||S.lessonId!==id){request('/api/sim/'+response.id,{method:'DELETE',token}).catch(()=>{});return;}S.sim={id:response.id,token};renderLesson();paintSim(response);pollSim(response.id,token);}
function pollSim(id,token){clearTimeout(simTimer);simTimer=setTimeout(async()=>{if(S.sim?.id!==id||S.token!==token)return;try{const state=await request('/api/sim/'+id);if(S.sim?.id!==id||S.token!==token)return;paintSim(state);if(!state.ended)pollSim(id,token);}catch(e){if(S.sim?.id!==id||S.token!==token||e.stale)return;const label=document.querySelector('#beta-state');if(label)label.textContent=e.status===404?'仿真已关闭或过期，请重新运行。':'状态连接暂时中断，正在重连…';if(e.status!==404&&e.status!==401)pollSim(id,token);}},600);}
function sendPad(){clearTimeout(padTimer);const sim=S.sim;if(!sim)return;padTimer=setTimeout(()=>{if(S.sim?.id!==sim.id)return;post('/api/sim/'+sim.id,{command:'PAD',x:+document.querySelector('#pad-x').value,y:+document.querySelector('#pad-y').value,turn:+document.querySelector('#pad-turn').value,a:document.querySelector('#pad-a').checked}).catch(notifyError);},80);}
loadRoute();
