
const $ = (id)=>document.getElementById(id);
const LS_KEY='insuranceLawQuiz.v1';
const state={mode:'all',pool:[],idx:0,selected:new Set(),revealed:false,sessionAnswered:0,sessionCorrect:0,store:{wrong:{},fav:{},history:[]}};
function loadStore(){try{state.store=JSON.parse(localStorage.getItem(LS_KEY))||state.store}catch(e){}}
function saveStore(){localStorage.setItem(LS_KEY,JSON.stringify(state.store));}
function norm(s){return (s||'').toString().toLowerCase().replace(/\s+/g,'');}
function setup(){loadStore(); $('summaryPill').textContent=`共 ${APP_SUMMARY.total} 題｜高頻 ${APP_SUMMARY.highFreqCount}｜重複 ${APP_SUMMARY.duplicateCount}`; $('totalStat').textContent=APP_SUMMARY.total;
  APP_SUMMARY.years.forEach(y=>{let o=document.createElement('option'); o.value=y; o.textContent=y; $('yearFilter').appendChild(o);});
  APP_SUMMARY.topics.forEach(t=>{let o=document.createElement('option'); o.value=t; o.textContent=t; $('topicFilter').appendChild(o);});
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); b.classList.add('active'); state.mode=b.dataset.mode; buildPool();});
  ['yearFilter','typeFilter','topicFilter'].forEach(id=>$(id).onchange=buildPool); $('searchInput').oninput=()=>buildPool(false); $('startBtn').onclick=buildPool; $('shuffleBtn').onclick=()=>{shuffle(state.pool); state.idx=0; render();}; $('resetBtn').onclick=resetProgress; $('exportBtn').onclick=exportRecord; buildPool(false);
  if('serviceWorker' in navigator){navigator.serviceWorker.register('service-worker.js').catch(()=>{});}
}
function buildPool(reset=true){let year=$('yearFilter').value, type=$('typeFilter').value, topic=$('topicFilter').value, s=norm($('searchInput').value); let arr=QUESTION_BANK.filter(q=>{
  if(year && q.year_season!==year) return false; if(type && q.type!==type) return false; if(topic && q.topic!==topic) return false; if(s){let hay=norm([q.qid,q.topic,q.stem,q.A,q.B,q.C,q.D,q.answer,q.group_exams].join(' ')); if(!hay.includes(s)) return false;}
  if(state.mode==='high' && !q.is_high_freq) return false; if(state.mode==='dup' && !q.is_duplicate) return false; if(state.mode==='wrong' && !state.store.wrong[q.qid]) return false; if(state.mode==='fav' && !state.store.fav[q.qid]) return false; return true;});
  if(state.mode==='mock'){arr=[...arr]; shuffle(arr); arr=arr.slice(0,50);} state.pool=arr; if(reset){state.idx=0; state.selected.clear(); state.revealed=false; state.sessionAnswered=0; state.sessionCorrect=0;} render();}
function shuffle(a){for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];}return a;}
function render(){updateStats(); renderList(); const q=state.pool[state.idx]; if(!q){$('qArea').innerHTML='<div class="empty">沒有符合條件的題目。請調整篩選條件。</div>'; return;}
  state.selected.clear(); state.revealed=false; const fav=state.store.fav[q.qid];
  $('qArea').innerHTML=`<div class="qmeta"><span class="tag">${q.qid}</span><span class="tag">${q.type}</span><span class="tag">${q.topic||'其他'}</span>${q.is_high_freq?'<span class="tag hot">高頻</span>':''}<span class="tag">同群 ${q.group_count||1} 題</span></div><div class="stem">${esc(q.stem)}</div><div class="options" id="options"></div><div class="actions"><button class="btn2" id="prevBtn">上一題</button><button class="btn2" id="favBtn">${fav?'★ 已收藏':'☆ 收藏'}</button><button class="btn" id="showBtn">顯示答案</button><button class="btnDark" id="nextBtn">下一題</button></div><div id="answerBox" class="answerBox"></div>`;
  ['A','B','C','D'].forEach(k=>{if((q[k]||'').trim()){let b=document.createElement('button'); b.className='opt'; b.dataset.key=k; b.innerHTML=`<b>${k}.</b> ${esc(q[k])}`; b.onclick=()=>selectOpt(k,b); $('options').appendChild(b);}});
  $('prevBtn').onclick=prevQ; $('nextBtn').onclick=nextQ; $('showBtn').onclick=showAnswer; $('favBtn').onclick=toggleFav;}
function selectOpt(k,b){if(state.revealed)return; const q=state.pool[state.idx]; if(q.type==='複選'){state.selected.has(k)?state.selected.delete(k):state.selected.add(k);}else{state.selected.clear(); state.selected.add(k);} document.querySelectorAll('.opt').forEach(x=>x.classList.toggle('selected',state.selected.has(x.dataset.key)));}
function showAnswer(){const q=state.pool[state.idx]; if(!q||state.revealed)return; const sel=[...state.selected].sort().join(''); const ans=(q.answer||'').split('').sort().join(''); const ok=sel===ans; state.revealed=true; state.sessionAnswered++; if(ok){state.sessionCorrect++; delete state.store.wrong[q.qid];} else {state.store.wrong[q.qid]=true;} state.store.history.push({qid:q.qid, selected:sel, answer:ans, ok, time:new Date().toISOString()}); saveStore();
  document.querySelectorAll('.opt').forEach(x=>{const k=x.dataset.key; if(ans.includes(k)) x.classList.add('correct'); if(state.selected.has(k)&&!ans.includes(k)) x.classList.add('wrong');});
  $('answerBox').classList.add('show'); $('answerBox').innerHTML=`<h3>${ok?'<span class="correctText">✓ 答對</span>':'<span class="wrongText">✕ 答錯</span>'}</h3><p><b>你的答案：</b>${sel||'未作答'}　<b>正確答案：</b>${esc(q.answer)}</p><p><b>答案內容：</b>${esc(q.answer_text||'')}</p><p><b>同觀念出現：</b>${esc(q.group_exams||q.year_season)}</p><p><b>主題：</b>${esc(q.topic||'其他')}　<b>重複群組：</b>${esc(q.group_id||'')}</p><p class="muted">解析欄位目前以答案、主題與歷屆出現資訊為主；之後可再補法條詳解版。</p>`; updateStats(); renderList();}
function nextQ(){if(state.idx<state.pool.length-1){state.idx++; render();}}
function prevQ(){if(state.idx>0){state.idx--; render();}}
function toggleFav(){const q=state.pool[state.idx]; if(!q)return; if(state.store.fav[q.qid]) delete state.store.fav[q.qid]; else state.store.fav[q.qid]=true; saveStore(); render();}
function updateStats(){ $('sessionStat').textContent=state.pool.length; $('answeredStat').textContent=state.sessionAnswered; $('accStat').textContent=state.sessionAnswered?Math.round(state.sessionCorrect/state.sessionAnswered*100)+'%':'0%'; $('progressBar').style.width=state.pool.length?Math.round((state.idx+1)/state.pool.length*100)+'%':'0%';}
function renderList(){const box=$('sideList'); box.innerHTML=''; state.pool.slice(0,120).forEach((q,i)=>{let d=document.createElement('div'); d.className='mini'; d.onclick=()=>{state.idx=i; render();}; d.innerHTML=`<b>${i+1}. ${esc(q.qid)} ${state.store.wrong[q.qid]?'❌':''}${state.store.fav[q.qid]?' ⭐':''}</b><p>${esc(q.stem)}</p>`; box.appendChild(d);});}
function resetProgress(){if(confirm('確定清除錯題、收藏與作答紀錄？')){localStorage.removeItem(LS_KEY); state.store={wrong:{},fav:{},history:[]}; state.sessionAnswered=0; state.sessionCorrect=0; render();}}
function exportRecord(){const blob=new Blob([JSON.stringify(state.store,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='insurance-law-quiz-record.json'; a.click();}
function esc(s){return (s||'').toString().replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
setup();
