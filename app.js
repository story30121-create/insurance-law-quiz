const Q = window.QUESTION_BANK || [];
const $ = (id) => document.getElementById(id);
let list = [], idx = 0, selected = new Set(), deferredPrompt = null;
let exam = {active:false, answers:{}, done:false, result:null};
const KEY='inslaw_v2';
const OLD_KEYS=['inslaw_v15','inslaw_v1'];
const state = loadState();

function loadState(){
  const base={wrong:{},book:{},stats:{},answered:{}};
  for(const k of OLD_KEYS){ try{ Object.assign(base, JSON.parse(localStorage.getItem(k)||'{}')); }catch(e){} }
  try{ Object.assign(base, JSON.parse(localStorage.getItem(KEY)||'{}')); }catch(e){}
  try{ JSON.parse(localStorage.getItem('wrong')||'[]').forEach(id=>base.wrong[id]=1); }catch(e){}
  try{ JSON.parse(localStorage.getItem('book')||'[]').forEach(id=>base.book[id]=1); }catch(e){}
  return base;
}
function save(){ localStorage.setItem(KEY, JSON.stringify(state)); }
function esc(s){ return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function uniq(arr){ return [...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'zh-Hant')); }
function normAns(a){ return String(a||'').split('').sort().join(''); }
function lawsOf(q){
  const s=String(q.source||'');
  const hits=s.match(/(保施\s*\d+(?:-\d+)?|保\s*\d+(?:-\d+)?|稽核\s*\d+(?:-\d+)?|研習\s*\d+(?:-\d+)?)/g)||[];
  return uniq(hits.map(x=>x.replace(/\s+/g,'')));
}
function init(){
  if(!Q.length){ $('stem').textContent='題庫未載入，請確認 data.js 與 index.html 在同一層。'; return; }
  uniq(Q.map(q=>q.year)).forEach(y=>$('year').insertAdjacentHTML('beforeend',`<option value="${y}">${y}</option>`));
  uniq(Q.map(q=>q.topic)).forEach(t=>$('topic').insertAdjacentHTML('beforeend',`<option value="${esc(t)}">${esc(t)}</option>`));
  const laws=uniq(Q.flatMap(lawsOf));
  laws.forEach(l=>$('law').insertAdjacentHTML('beforeend',`<option value="${esc(l)}">${esc(l)}</option>`));
  renderTopicChips(); applyFilters();
}
function getStats(){
  const totalAttempts=Object.values(state.stats).reduce((s,x)=>s+(x.a||0),0);
  const totalCorrect=Object.values(state.stats).reduce((s,x)=>s+(x.c||0),0);
  const high=Q.filter(q=>Number(q.group_count)>=3).length;
  return {wrong:Object.keys(state.wrong).length, book:Object.keys(state.book).length, answered:Object.keys(state.answered).length, high, attempts:totalAttempts, acc: totalAttempts?Math.round(totalCorrect/totalAttempts*100):0};
}
function renderStats(){
  const s=getStats();
  $('stats').innerHTML=`<div class="stat"><b>${Q.length}</b>總題數</div><div class="stat"><b>${s.high}</b>高頻題</div><div class="stat"><b>${s.answered}</b>已作答</div><div class="stat"><b>${s.acc}%</b>正確率</div><div class="stat"><b>${s.book}</b>收藏</div><div class="stat"><b>${s.wrong}</b>錯題</div>`;
  renderTopicStats(); renderLawStats();
}
function renderTopicChips(){
  const counts={}; Q.forEach(q=>counts[q.topic]=(counts[q.topic]||0)+1);
  $('topicChips').innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,16).map(([t,c])=>`<span class="chip" data-topic="${esc(t)}">${esc(t)}（${c}）</span>`).join('');
  document.querySelectorAll('.chip').forEach(el=>el.onclick=()=>{ $('topic').value=el.dataset.topic; applyFilters(); window.scrollTo({top:0,behavior:'smooth'}); });
}
function renderTopicStats(){
  const rows={};
  Q.forEach(q=>{ rows[q.topic] ||= {topic:q.topic,total:0,a:0,c:0,high:0}; rows[q.topic].total++; if(Number(q.group_count)>=3) rows[q.topic].high++; const st=state.stats[q.qid]; if(st){rows[q.topic].a+=st.a||0; rows[q.topic].c+=st.c||0;} });
  const html=Object.values(rows).filter(r=>r.a>0).sort((a,b)=>(a.c/a.a)-(b.c/b.a)).slice(0,12).map(r=>`<tr><td>${esc(r.topic)}</td><td>${r.a}</td><td>${Math.round(r.c/r.a*100)}%</td><td>${r.high}/${r.total}</td></tr>`).join('');
  $('topicStats').innerHTML=html?`<table><thead><tr><th>主題</th><th>作答</th><th>正確率</th><th>高頻/題數</th></tr></thead><tbody>${html}</tbody></table>`:'尚未累積作答統計。';
}
function renderLawStats(){
  const rows={};
  Q.forEach(q=>lawsOf(q).forEach(l=>{ rows[l] ||= {law:l,total:0,a:0,c:0}; rows[l].total++; const st=state.stats[q.qid]; if(st){rows[l].a+=st.a||0; rows[l].c+=st.c||0;} }));
  const html=Object.values(rows).filter(r=>r.a>0).sort((a,b)=>(a.c/a.a)-(b.c/b.a)).slice(0,12).map(r=>`<tr><td>${esc(r.law)}</td><td>${r.a}</td><td>${Math.round(r.c/r.a*100)}%</td><td>${r.total}</td></tr>`).join('');
  $('lawStats').innerHTML=html?`<table><thead><tr><th>法條/出處</th><th>作答</th><th>正確率</th><th>題數</th></tr></thead><tbody>${html}</tbody></table>`:'尚未累積法條表現。';
}
function scoreQuestion(q){
  const st=state.stats[q.qid]||{a:0,c:0};
  const acc=st.a?st.c/st.a:0.5;
  let score=0;
  score += Math.min(Number(q.group_count)||1,8)*12;
  if(state.wrong[q.qid]) score += 70;
  if(!state.answered[q.qid]) score += 35;
  if(st.a>0) score += (1-acc)*80;
  if(state.book[q.qid]) score += 10;
  return score;
}
function baseFiltered(){
  const year=$('year').value, season=$('season').value, type=$('type').value, topic=$('topic').value, law=$('law').value, term=$('search').value.trim().toLowerCase();
  return Q.filter(q=>{
    if(year!=='all' && String(q.year)!==year) return false;
    if(season!=='all' && q.season!==season) return false;
    if(type!=='all' && q.type!==type) return false;
    if(topic!=='all' && q.topic!==topic) return false;
    if(law!=='all' && !lawsOf(q).includes(law)) return false;
    if(term){ const hay=[q.qid,q.stem,q.A,q.B,q.C,q.D,q.answer,q.topic,q.group_exams,q.source].join(' ').toLowerCase(); if(!hay.includes(term)) return false; }
    return true;
  });
}
function applyFilters(){
  const mode=$('mode').value;
  list=baseFiltered().filter(q=>{
    if(mode==='high' && Number(q.group_count)<3) return false;
    if(mode==='wrong' && !state.wrong[q.qid]) return false;
    if(mode==='bookmarked' && !state.book[q.qid]) return false;
    if(mode==='unseen' && state.answered[q.qid]) return false;
    if(mode==='weak'){
      const st=state.stats[q.qid]; if(!st || st.a<1) return false; if((st.c/st.a)>=0.7) return false;
    }
    return true;
  });
  if(mode==='smart') list=list.sort((a,b)=>scoreQuestion(b)-scoreQuestion(a)).slice(0,50);
  exam={active:false,answers:{},done:false,result:null}; idx=0; showQuestion();
}
function shuffleList(arr){ for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }
function shuffle(){ shuffleList(list); idx=0; showQuestion(); }
function smartToday(){ list=baseFiltered().sort((a,b)=>scoreQuestion(b)-scoreQuestion(a)).slice(0,30); exam={active:false,answers:{},done:false,result:null}; idx=0; showQuestion(); window.scrollTo({top:0,behavior:'smooth'}); }
function makePlan(){
  const topics={};
  Q.forEach(q=>{ topics[q.topic] ||= {topic:q.topic,total:0,score:0}; topics[q.topic].total++; topics[q.topic].score+=scoreQuestion(q); });
  const top=Object.values(topics).sort((a,b)=>b.score-a.score).slice(0,7);
  $('planBox').classList.remove('hidden');
  $('planBox').innerHTML='<b>7日讀書計畫</b>'+top.map((t,i)=>`<div class="planItem"><b>Day ${i+1}</b>：${esc(t.topic)}｜建議刷 ${Math.min(50,Math.max(20,Math.round(t.total*1.5)))} 題｜題數 ${t.total}</div>`).join('');
}
function startExam(){
  const n=Number($('examSize').value); let pool=baseFiltered(); if(!pool.length) pool=Q.slice();
  list=shuffleList(pool.slice()).slice(0,Math.min(n,pool.length));
  exam={active:true,answers:{},done:false,result:null}; idx=0; showQuestion();
}
function submitExam(){
  let c=0; const wrong=[];
  list.forEach(q=>{ const ans=normAns(exam.answers[q.qid]||[]); const ok=ans===normAns(q.answer); if(ok)c++; else wrong.push(q.qid); record(q,ok); });
  exam.done=true; exam.result={correct:c,total:list.length,wrong}; renderStats(); showQuestion();
  alert(`交卷完成：${c}/${list.length}，正確率 ${Math.round(c/list.length*100)}%`);
}
function exitExam(){ exam={active:false,answers:{},done:false,result:null}; applyFilters(); }
function showQuestion(){
  renderStats(); selected=new Set();
  const total=list.length;
  $('countText').textContent=`${total} 題`; $('posText').textContent=total?`第 ${idx+1} / ${total} 題`:'第 0 / 0 題'; $('barFill').style.width=total?`${((idx+1)/total)*100}%`:'0%';
  $('submitExam').classList.toggle('hidden',!exam.active||exam.done); $('exitExam').classList.toggle('hidden',!exam.active); $('startExam').classList.toggle('hidden',exam.active&&!exam.done);
  $('examStatus').classList.toggle('hidden',!exam.active && !exam.done);
  if(exam.active&&!exam.done) $('examStatus').textContent=`模擬考進行中：已作答 ${Object.keys(exam.answers).length}/${list.length} 題`;
  if(exam.done&&exam.result) $('examStatus').textContent=`模擬考結果：${exam.result.correct}/${exam.result.total}，正確率 ${Math.round(exam.result.correct/exam.result.total*100)}%`;
  if(!total){ $('meta').innerHTML=''; $('stem').textContent='沒有符合條件的題目。'; $('options').innerHTML=''; $('answerBox').classList.add('hidden'); return; }
  const q=list[idx];
  (exam.answers[q.qid]||[]).forEach(k=>selected.add(k));
  $('meta').innerHTML=`<span class="tag">${esc(q.qid)}</span><span class="tag gray">${esc(q.type)}</span><span class="tag gray">${esc(q.topic)}</span>${Number(q.group_count)>=3?'<span class="tag hot">高頻</span>':''}${state.answered[q.qid]?'<span class="tag ok">已作答</span>':'<span class="tag warn">未作答</span>'}<span class="tag gray">同觀念 ${q.group_count} 次</span><span class="tag gray">AI分數 ${Math.round(scoreQuestion(q))}</span>`;
  $('stem').textContent=q.stem;
  $('options').innerHTML=['A','B','C','D'].map(k=>`<button class="opt ${selected.has(k)?'selected':''}" data-k="${k}">${k}. ${esc(q[k])}</button>`).join('');
  document.querySelectorAll('.opt').forEach(btn=>btn.onclick=()=>toggleOption(btn.dataset.k));
  $('answerBox').innerHTML=answerHtml(q); $('answerBox').classList.add('hidden');
  if(exam.done) reveal(false);
  $('bookmark').textContent=state.book[q.qid]?'★ 已收藏':'☆ 收藏';
  $('prev').disabled=idx<=0; $('next').disabled=idx>=total-1;
  $('show').disabled=exam.active&&!exam.done; $('check').disabled=exam.done;
}
function answerHtml(q){
  const st=state.stats[q.qid]; const acc=st&&st.a?`<br><b>你的紀錄：</b>${st.c}/${st.a}，正確率 ${Math.round(st.c/st.a*100)}%`:'';
  const related=Q.filter(x=>x.group_id===q.group_id && x.qid!==q.qid).slice(0,12);
  const relHtml=related.length?`<br><br><b>相關歷屆題：</b><div class="related">${related.map(r=>`<button data-qid="${esc(r.qid)}" class="relBtn">${esc(r.qid)}</button>`).join('')}</div>`:'';
  const lawBtns=lawsOf(q).map(l=>`<button class="relBtn lawBtn" data-law="${esc(l)}">${esc(l)}</button>`).join('');
  return `<b>正確答案：${esc(q.answer)}</b><br>${esc(q.answer_text)}<br><br><b>主題：</b>${esc(q.topic)}<br><b>法條/出處：</b>${esc(q.source||'（待補）')} ${lawBtns?`<div class="related">${lawBtns}</div>`:''}<br><b>同觀念出現：</b>${esc(q.group_exams)}<br><b>重複次數：</b>${esc(q.group_count)} 次${acc}${relHtml}`;
}
function bindAnswerBoxLinks(){
  document.querySelectorAll('.relBtn[data-qid]').forEach(b=>b.onclick=()=>jumpToQid(b.dataset.qid));
  document.querySelectorAll('.lawBtn[data-law]').forEach(b=>{ b.onclick=()=>{ $('law').value=b.dataset.law; applyFilters(); }; });
}
function toggleOption(k){
  const q=list[idx];
  if(q.type==='單選') selected=new Set([k]); else selected.has(k)?selected.delete(k):selected.add(k);
  if(exam.active&&!exam.done) exam.answers[q.qid]=[...selected];
  document.querySelectorAll('.opt').forEach(btn=>btn.classList.toggle('selected',selected.has(btn.dataset.k)));
}
function currentOk(){ const q=list[idx]; return normAns([...selected])===normAns(q.answer); }
function checkAnswer(){ if(!list[idx]||!selected.size){alert('請先選答案');return;} if(exam.active&&!exam.done){ exam.answers[list[idx].qid]=[...selected]; showQuestion(); return; } reveal(true); }
function reveal(recordNow){
  const q=list[idx]; const ok=currentOk();
  document.querySelectorAll('.opt').forEach(btn=>{ const k=btn.dataset.k; if(q.answer.includes(k)) btn.classList.add('correct'); if(selected.has(k)&&!q.answer.includes(k)) btn.classList.add('wrong'); });
  $('answerBox').classList.remove('hidden'); bindAnswerBoxLinks();
  if(recordNow){ record(q,ok); save(); renderStats(); }
}
function record(q,ok){ const st=state.stats[q.qid]||{a:0,c:0}; st.a++; if(ok)st.c++; state.stats[q.qid]=st; state.answered[q.qid]=1; if(ok) delete state.wrong[q.qid]; else state.wrong[q.qid]=1; save(); }
function toggleBook(){ const q=list[idx]; if(!q)return; state.book[q.qid]?delete state.book[q.qid]:state.book[q.qid]=1; save(); showQuestion(); }
function markWrong(){ const q=list[idx]; if(!q)return; state.wrong[q.qid]=1; save(); renderStats(); }
function clearWrong(){ const q=list[idx]; if(!q)return; delete state.wrong[q.qid]; save(); renderStats(); }
function groupDrill(){ const q=list[idx]; if(!q)return; list=Q.filter(x=>x.group_id===q.group_id); idx=list.findIndex(x=>x.qid===q.qid); if(idx<0)idx=0; exam={active:false,answers:{},done:false,result:null}; showQuestion(); }
function jumpToQid(qid){ const pos=list.findIndex(x=>x.qid===qid); if(pos>=0){idx=pos; showQuestion(); return;} const q=Q.find(x=>x.qid===qid); if(q){list=Q.filter(x=>x.group_id===q.group_id); idx=list.findIndex(x=>x.qid===qid); showQuestion();} }
function exportProgress(){ const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='insurance_law_progress_v2.json'; a.click(); URL.revokeObjectURL(a.href); }
function importProgress(file){ const r=new FileReader(); r.onload=()=>{ try{ const obj=JSON.parse(r.result); Object.assign(state,obj); save(); alert('進度已匯入'); showQuestion(); }catch(e){alert('匯入失敗，請確認檔案格式');} }; r.readAsText(file); }
function clearData(){ if(confirm('確定清除本機收藏、錯題與作答統計？')){ localStorage.removeItem(KEY); OLD_KEYS.forEach(k=>localStorage.removeItem(k)); localStorage.removeItem('wrong'); localStorage.removeItem('book'); location.reload(); } }
$('apply').onclick=applyFilters; $('shuffle').onclick=shuffle;
$('reset').onclick=()=>{ ['mode','year','season','type','topic','law'].forEach(id=>$(id).value='all'); $('search').value=''; applyFilters(); };
$('prev').onclick=()=>{ if(idx>0){idx--; showQuestion();} };
$('next').onclick=()=>{ if(idx<list.length-1){idx++; showQuestion();} };
$('check').onclick=checkAnswer; $('show').onclick=()=>reveal(false);
$('bookmark').onclick=toggleBook; $('markWrong').onclick=markWrong; $('clearWrong').onclick=clearWrong; $('groupDrill').onclick=groupDrill;
$('startExam').onclick=startExam; $('submitExam').onclick=submitExam; $('exitExam').onclick=exitExam;
$('smartBtn').onclick=smartToday; $('planBtn').onclick=makePlan;
$('exportData').onclick=exportProgress; $('importData').onchange=e=>e.target.files[0]&&importProgress(e.target.files[0]); $('clearData').onclick=clearData;
window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferredPrompt=e; $('installBtn').classList.remove('hidden'); });
$('installBtn').onclick=async()=>{ if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt=null; $('installBtn').classList.add('hidden'); } };
document.addEventListener('keydown', e=>{ if(e.target.tagName==='INPUT')return; const k=e.key.toUpperCase(); if(['A','B','C','D'].includes(k)) toggleOption(k); if(k==='ENTER') checkAnswer(); if(e.key==='ArrowRight') $('next').click(); if(e.key==='ArrowLeft') $('prev').click(); if(k==='S') $('show').click(); });
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{})); }
init();
