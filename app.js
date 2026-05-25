// ADIORE — Pontaj Ore de Munca v1.0
// Supabase + Vanilla JS — Mobile First

const APP = {
  sb: null, currentWorker: null,
  currentMonth: new Date(), selectedDate: null,
  logs: {}, sites: [], workers: [],
  pin: '', pinTarget: null, afterLogin: null,
  isCheckedIn: false, checkInTime: null, checkInSite: null,
};

const RO_MONTHS = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie',
                   'Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
const RO_MONTHS_ABR = ['IAN','FEB','MAR','APR','MAI','IUN','IUL','AUG','SEP','OCT','NOV','DEC'];
const RO_DAYS = ['Du','Lu','Ma','Mi','Jo','Vi','Sa'];

function initSupabase() {
  try {
    if (!SUPABASE_URL || SUPABASE_URL.includes('PROIECT')) { console.warn('[ADIORE] Demo mode'); return false; }
    APP.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('[ADIORE] Supabase OK'); return true;
  } catch(e) { console.error(e); return false; }
}

function startClock() {
  function tick() {
    const n = new Date();
    const t = [n.getHours(),n.getMinutes(),n.getSeconds()].map(v=>String(v).padStart(2,'0')).join(':');
    const el = document.getElementById('clock'); if (el) el.textContent = t;
  }
  tick(); setInterval(tick, 1000);
}

async function init() {
  startClock(); initSupabase(); await loadWorkers();
  if (APP.workers.length > 0) {
    const w = APP.workers[0];
    document.getElementById('wc-avatar').textContent = w.avatar||'🔨';
    document.getElementById('wc-name').textContent = w.name;
    document.getElementById('wc-role').textContent = capitalize(w.role);
  }
  showScreen('home'); scheduleNotif();
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase()+s.slice(1) : ''; }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-'+id); if (el) el.classList.add('active');
  const L = { calendar:loadCalendar, coordinator:loadCoordinator, stats:loadStats, vacation:loadVacation, teams:loadTeams, sites:loadSitesList };
  if (L[id]) L[id]();
}

async function loadWorkers() {
  if (APP.sb) {
    try { const {data} = await APP.sb.from('workers').select('*').eq('active',true).order('name'); if (data&&data.length){APP.workers=data;return;} } catch(e){}
  }
  APP.workers = [
    {id:'demo-1',name:'BIBIKA',role:'salahor',pin:'1234',avatar:'🔨'},
    {id:'demo-2',name:'COORDONATOR',role:'coordonator',pin:'0000',avatar:'🔑'},
  ];
}

function updateHomeCard(w) {
  document.getElementById('wc-avatar').textContent = w.avatar||'🔨';
  document.getElementById('wc-name').textContent = w.name;
  document.getElementById('wc-role').textContent = capitalize(w.role);
}

function updateHomeStats() {
  const logs = Object.values(APP.logs);
  const hrs = logs.reduce((s,l)=>s+parseFloat(l.hours||0),0);
  const mn = RO_MONTHS[APP.currentMonth.getMonth()];
  document.getElementById('wc-stats').textContent = `${hrs}h · ${logs.length} zile lucrate in ${mn}`;
}

async function openWorkerCalendar() {
  if (APP.currentWorker) { showScreen('calendar'); return; }
  if (APP.workers.length===1) openPINModal(APP.workers[0]);
  else showWorkerSelector();
}

function showWorkerSelector() {
  const list = document.getElementById('worker-selector-list');
  list.innerHTML = APP.workers.filter(w=>w.role!=='coordonator').map(w=>`
    <div onclick="selectWorker('${w.id}')" style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,.05);border-radius:10px;margin-bottom:8px;cursor:pointer;border:1px solid var(--card-border)">
      <span style="font-size:24px">${w.avatar}</span>
      <div><div style="font-family:var(--font-t);font-size:14px">${w.name}</div><div style="font-size:11px;color:var(--cyan)">${capitalize(w.role)}</div></div>
    </div>`).join('');
  document.getElementById('modal-workers').style.display='flex';
}

function closeWorkerSelector() { document.getElementById('modal-workers').style.display='none'; }
function selectWorker(id) { const w=APP.workers.find(w=>w.id===id); if(w){closeWorkerSelector();openPINModal(w);} }

function openCoordinator() {
  if (APP.currentWorker?.role==='coordonator') { showScreen('coordinator'); return; }
  const coord = APP.workers.find(w=>w.role==='coordonator');
  if (coord) { APP.afterLogin='coordinator'; openPINModal(coord); }
  else alert('Nu exista coordonator configurat.');
}

function openPINModal(worker) {
  APP.pinTarget=worker; APP.pin='';
  document.getElementById('pin-avatar').textContent = worker.avatar||'🔨';
  document.getElementById('pin-name').textContent = worker.name;
  document.getElementById('pin-role').textContent = capitalize(worker.role);
  document.getElementById('pin-error').style.display='none';
  resetPINBoxes();
  document.getElementById('modal-pin').style.display='flex';
  showKeyboard();
}

function closePINModal() {
  document.getElementById('modal-pin').style.display='none';
  hideKeyboard(); APP.pin=''; APP.pinTarget=null;
}

function resetPINBoxes() {
  for(let i=0;i<4;i++){const b=document.getElementById('pb'+i);b.classList.remove('filled','active');}
  document.getElementById('pb0').classList.add('active');
}

function enterDigit(d) {
  if(APP.pin.length>=4)return;
  APP.pin+=String(d);
  const idx=APP.pin.length-1;
  const box=document.getElementById('pb'+idx);
  box.classList.remove('active');box.classList.add('filled');
  const next=document.getElementById('pb'+APP.pin.length);
  if(next)next.classList.add('active');
  if(APP.pin.length===4)setTimeout(verifyPIN,200);
}

function deleteDigit() {
  if(!APP.pin.length)return;
  const cur=document.getElementById('pb'+APP.pin.length);if(cur)cur.classList.remove('active');
  APP.pin=APP.pin.slice(0,-1);
  const box=document.getElementById('pb'+APP.pin.length);
  if(box){box.classList.remove('filled');box.classList.add('active');}
}

async function verifyPIN() {
  const w=APP.pinTarget;if(!w)return;
  let ok=false;
  try {
    if(APP.sb){const{data}=await APP.sb.from('workers').select('pin').eq('id',w.id).single();ok=data&&data.pin===APP.pin;}
    else ok=w.pin===APP.pin;
  } catch(e){ok=w.pin===APP.pin;}
  if(ok){
    APP.currentWorker=w;closePINModal();updateHomeCard(w);
    const dest=APP.afterLogin||'calendar';APP.afterLogin=null;
    showScreen(dest);if(dest==='calendar')await loadMonthStats();
  } else {
    document.getElementById('pin-error').style.display='block';
    APP.pin='';setTimeout(resetPINBoxes,150);
    setTimeout(()=>{document.getElementById('pin-error').style.display='none';},1800);
  }
}

function showKeyboard() {
  const kb=document.getElementById('keyboard-overlay');
  kb.innerHTML=`<div class="num-keyboard">
    <div class="num-row">${[1,2,3].map(n=>`<button class="num-btn" onclick="enterDigit(${n})">${n}</button>`).join('')}</div>
    <div class="num-row">${[4,5,6].map(n=>`<button class="num-btn" onclick="enterDigit(${n})">${n}</button>`).join('')}</div>
    <div class="num-row">${[7,8,9].map(n=>`<button class="num-btn" onclick="enterDigit(${n})">${n}</button>`).join('')}</div>
    <div class="num-row"><button class="num-btn del" onclick="deleteDigit()">⌫</button><button class="num-btn" onclick="enterDigit(0)">0</button><button class="num-btn ok" onclick="closePINModal()">✕</button></div>
  </div>`;
  kb.style.display='block';
}

function hideKeyboard(){document.getElementById('keyboard-overlay').style.display='none';}

async function loadCalendar() {
  if(!APP.currentWorker)return;
  await loadMonthLogs();renderCalendar();updateMonthLabel();updateStats();
  await loadSites();await renderHistory();
}

async function loadMonthLogs() {
  APP.logs={};if(!APP.sb||!APP.currentWorker)return;
  const y=APP.currentMonth.getFullYear(),m=APP.currentMonth.getMonth()+1;
  const start=`${y}-${pad(m)}-01`,end=`${y}-${pad(m)}-${new Date(y,m,0).getDate()}`;
  try{const{data}=await APP.sb.from('work_logs').select('*').eq('worker_id',APP.currentWorker.id).gte('log_date',start).lte('log_date',end);if(data)data.forEach(l=>{APP.logs[l.log_date]=l;});}catch(e){}
}

function renderCalendar() {
  const y=APP.currentMonth.getFullYear(),m=APP.currentMonth.getMonth();
  const today=fmtDate(new Date()),first=new Date(y,m,1),last=new Date(y,m+1,0);
  let dow=first.getDay()-1;if(dow<0)dow=6;
  let html='';
  for(let i=0;i<dow;i++)html+='<div class="cal-day empty"></div>';
  for(let d=1;d<=last.getDate();d++){
    const dt=new Date(y,m,d),ds=fmtDate(dt),wd=dt.getDay();
    const isWe=wd===0||wd===6,log=APP.logs[ds],isToday=ds===today,isSel=ds===APP.selectedDate;
    let cls='cal-day ';
    if(isWe)cls+='weekend';else if(log)cls+='worked';else cls+='regular';
    if(isToday)cls+=' today';if(isSel)cls+=' selected';
    html+=`<div class="${cls}" onclick="selectDay('${ds}')"><span class="day-num">${d}</span>${log?`<span class="day-hrs">${log.hours}h</span>`:''}</div>`;
  }
  document.getElementById('cal-grid').innerHTML=html;
}

function selectDay(ds){APP.selectedDate=ds;renderCalendar();openDayModal(ds);}

function updateStats() {
  const logs=Object.values(APP.logs);
  const hrs=logs.reduce((s,l)=>s+parseFloat(l.hours||0),0);
  const days=logs.length,avg=days?(hrs/days).toFixed(1):0;
  document.getElementById('stat-hours').textContent=hrs;
  document.getElementById('stat-days').textContent=days;
  document.getElementById('stat-avg').textContent=avg;
  updateHomeStats();
}

async function loadMonthStats(){await loadMonthLogs();updateStats();}

function updateMonthLabel(){document.getElementById('month-label').textContent=`${RO_MONTHS[APP.currentMonth.getMonth()]} ${APP.currentMonth.getFullYear()}`;}
function prevMonth(){APP.currentMonth=new Date(APP.currentMonth.getFullYear(),APP.currentMonth.getMonth()-1,1);loadCalendar();}
function nextMonth(){APP.currentMonth=new Date(APP.currentMonth.getFullYear(),APP.currentMonth.getMonth()+1,1);loadCalendar();}

async function renderHistory() {
  const el=document.getElementById('history-list');if(!el)return;
  const now=new Date();let html='';
  for(let i=1;i<=6;i++){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const y=d.getFullYear(),m=d.getMonth()+1;
    const label=`${RO_MONTHS[d.getMonth()]} ${y}`;
    let hrs=0,days=0;
    if(APP.sb&&APP.currentWorker){
      try{
        const start=`${y}-${pad(m)}-01`,end=`${y}-${pad(m)}-${new Date(y,m,0).getDate()}`;
        const{data}=await APP.sb.from('work_logs').select('hours').eq('worker_id',APP.currentWorker.id).gte('log_date',start).lte('log_date',end);
        if(data){days=data.length;hrs=data.reduce((s,l)=>s+parseFloat(l.hours||0),0);}
      }catch(e){}
    }
    const pct=Math.min((hrs/240)*100,100);
    html+=`<div class="history-item"><span class="history-month">${label}</span><div class="history-bar-wrap"><div class="history-bar" style="width:${pct}%"></div></div><span class="history-hours">${hrs?hrs+'h':'0h'}</span><span class="history-days">${days?days+'z':'0z'}</span></div>`;
  }
  el.innerHTML=html||'<div class="empty-msg">Fara date anterioare</div>';
}

async function loadSites() {
  if(APP.sb){try{const{data}=await APP.sb.from('sites').select('*').eq('active',true);if(data)APP.sites=data;}catch(e){}}
  if(!APP.sites.length)APP.sites=[{id:'s1',name:'Birou BCR',address:'Bucuresti, etaj 2'},{id:'s2',name:'Santier Nord',address:'Bucuresti Sector 1'}];
  const sel=document.getElementById('site-select');
  if(sel)sel.innerHTML='<option value="">-- Alege santierul --</option>'+APP.sites.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
}

async function handleCheckIn() {
  const btn=document.getElementById('checkin-btn');
  if(!APP.isCheckedIn){
    const siteId=document.getElementById('site-select').value;
    if(!siteId){alert('Selecteaza santierul!');return;}
    const doCI=async(lat,lng)=>{
      if(APP.sb&&APP.currentWorker){try{await APP.sb.from('work_logs').upsert({worker_id:APP.currentWorker.id,log_date:fmtDate(new Date()),hours:0,site_id:siteId,check_in_at:new Date().toISOString(),check_in_lat:lat,check_in_lng:lng},{onConflict:'worker_id,log_date'});}catch(e){}}
      APP.isCheckedIn=true;APP.checkInTime=new Date();APP.checkInSite=siteId;
      btn.textContent='📍 CHECK-OUT';btn.classList.add('checkout');
    };
    if(navigator.geolocation)navigator.geolocation.getCurrentPosition(p=>doCI(p.coords.latitude,p.coords.longitude),()=>doCI(null,null),{timeout:8000});
    else doCI(null,null);
  } else {
    const hrs=APP.checkInTime?Math.max(0.5,((new Date()-APP.checkInTime)/3600000).toFixed(1)):8;
    if(APP.sb&&APP.currentWorker){try{await APP.sb.from('work_logs').upsert({worker_id:APP.currentWorker.id,log_date:fmtDate(new Date()),hours:parseFloat(hrs),site_id:APP.checkInSite,check_out_at:new Date().toISOString()},{onConflict:'worker_id,log_date'});}catch(e){}}
    APP.isCheckedIn=false;APP.checkInTime=null;
    btn.textContent='📍 CHECK-IN';btn.classList.remove('checkout');
    await loadCalendar();
  }
}

async function loadSitesList() {
  if(!APP.sites.length)await loadSites();
  const el=document.getElementById('sites-content');if(!el)return;
  el.innerHTML=APP.sites.map(s=>`<div style="background:var(--card-bg);border:1px solid var(--card-border);border-radius:12px;padding:16px;margin-bottom:8px"><div style="font-family:var(--font-t);font-size:14px;color:var(--cyan)">🏢 ${s.name}</div><div style="font-size:12px;color:var(--text2);margin-top:4px">${s.address||'—'}</div></div>`).join('')||'<div class="empty-msg">Fara santiere</div>';
}

function openDayModal(ds) {
  const dt=new Date(ds+'T12:00:00');
  document.getElementById('day-title').textContent=`${RO_DAYS[dt.getDay()]}, ${dt.getDate()} ${RO_MONTHS_ABR[dt.getMonth()]} ${dt.getFullYear()}`;
  const log=APP.logs[ds];
  document.getElementById('manual-hours').value=log?log.hours:10;
  document.getElementById('location-note').value=log?(log.location_note||''):'';
  if(log&&log.work_type){const sel=document.getElementById('work-type-select');for(let o of sel.options)if(o.value===log.work_type){sel.value=log.work_type;break;}}
  document.getElementById('modal-day').style.display='block';
}

function closeDayModal(){document.getElementById('modal-day').style.display='none';APP.selectedDate=null;renderCalendar();}

async function quickSave(hours) {
  if(!APP.selectedDate)return;
  const ex=APP.logs[APP.selectedDate];
  await saveLog({log_date:APP.selectedDate,hours,work_type:ex?.work_type||'Metal T24',location_note:ex?.location_note||''});
  closeDayModal();
}

async function saveManual() {
  if(!APP.selectedDate)return;
  const hours=parseFloat(document.getElementById('manual-hours').value);
  if(!hours||hours<=0){alert('Ore invalide!');return;}
  await saveLog({log_date:APP.selectedDate,hours,work_type:document.getElementById('work-type-select').value,location_note:document.getElementById('location-note').value});
  closeDayModal();
}

async function saveLog(data) {
  if(!APP.currentWorker)return;
  const rec={worker_id:APP.currentWorker.id,updated_at:new Date().toISOString(),...data};
  if(APP.sb){try{const{data:saved}=await APP.sb.from('work_logs').upsert(rec,{onConflict:'worker_id,log_date'}).select().single();if(saved)APP.logs[data.log_date]=saved;}catch(e){APP.logs[data.log_date]={...rec,id:'local-'+Date.now()};}}
  else APP.logs[data.log_date]={...rec,id:'demo-'+Date.now()};
  updateStats();renderCalendar();
}

async function deleteLog() {
  if(!APP.selectedDate)return;
  const log=APP.logs[APP.selectedDate];if(!log){closeDayModal();return;}
  if(!confirm('Stergi pontajul pentru aceasta zi?'))return;
  if(APP.sb&&log.id&&!log.id.startsWith('demo')&&!log.id.startsWith('local')){try{await APP.sb.from('work_logs').delete().eq('id',log.id);}catch(e){}}
  delete APP.logs[APP.selectedDate];closeDayModal();updateStats();
}

async function loadCoordinator() {
  const el=document.getElementById('coordinator-content');if(!el)return;
  el.innerHTML='<div style="padding:20px;color:var(--text2)">Se incarca...</div>';
  const now=new Date(),y=now.getFullYear(),m=now.getMonth()+1;
  const start=`${y}-${pad(m)}-01`,end=`${y}-${pad(m)}-${new Date(y,m,0).getDate()}`;
  let workers=APP.workers,allLogs=[];
  if(APP.sb){try{const{data:lg}=await APP.sb.from('work_logs').select('worker_id,hours').gte('log_date',start).lte('log_date',end);if(lg)allLogs=lg;const{data:ws}=await APP.sb.from('workers').select('*').eq('active',true);if(ws){workers=ws;APP.workers=ws;}}catch(e){}}
  el.innerHTML=`<div class="section-title" style="padding:16px 16px 8px">${RO_MONTHS[now.getMonth()].toUpperCase()} ${y}</div>`+workers.map(w=>{const wl=allLogs.filter(l=>l.worker_id===w.id),hrs=wl.reduce((s,l)=>s+parseFloat(l.hours||0),0);return`<div class="worker-row" onclick="viewWorkerCalendar('${w.id}')"><span class="wr-avatar">${w.avatar||'🔨'}</span><div class="wr-info"><div class="wr-name">${w.name}</div><div class="wr-role">${capitalize(w.role)}</div><div class="wr-stats">⚡ ${hrs}h · ${wl.length} zile</div></div><span class="wr-chevron">›</span></div>`;}).join('');
}

async function viewWorkerCalendar(workerId) {
  const w=APP.workers.find(w=>w.id===workerId);if(w){APP.currentWorker=w;updateHomeCard(w);showScreen('calendar');}
}

async function loadStats() {
  const el=document.getElementById('stats-content');if(!el)return;
  const now=new Date(),y=now.getFullYear(),m=now.getMonth()+1;
  const start=`${y}-${pad(m)}-01`,end=`${y}-${pad(m)}-${new Date(y,m,0).getDate()}`;
  let workers=APP.workers,logs=[];
  if(APP.sb){try{const{data:lg}=await APP.sb.from('work_logs').select('worker_id,hours').gte('log_date',start).lte('log_date',end);if(lg)logs=lg;const{data:ws}=await APP.sb.from('workers').select('*').eq('active',true);if(ws)workers=ws;}catch(e){}}
  const ranked=workers.filter(w=>w.role!=='coordonator').map(w=>{const wl=logs.filter(l=>l.worker_id===w.id);return{...w,hrs:wl.reduce((s,l)=>s+parseFloat(l.hours||0),0),days:wl.length};}).sort((a,b)=>b.hrs-a.hrs);
  el.innerHTML=`<div class="section-title" style="padding:0 0 12px">TOP — ${RO_MONTHS[now.getMonth()].toUpperCase()} ${y}</div>`+ranked.map((w,i)=>`<div class="rank-item"><span class="rank-pos ${['p1','p2','p3'][i]||''}">${i+1}</span><span style="font-size:22px">${w.avatar||'🔨'}</span><div class="rank-info"><div class="rank-name">${w.name}</div><div class="rank-hrs">⚡ ${w.hrs}h · ${w.days} zile</div></div></div>`).join('')||'<div class="empty-msg">Fara date</div>';
}

async function loadVacation() {
  const el=document.getElementById('vacation-content');if(!el)return;
  let vacations=[];
  if(APP.sb&&APP.currentWorker){try{const{data}=await APP.sb.from('vacations').select('*').eq('worker_id',APP.currentWorker.id).order('start_date',{ascending:false});if(data)vacations=data;}catch(e){}}
  const today=fmtDate(new Date());
  el.innerHTML=`<div class="vac-form"><div style="font-family:var(--font-t);font-size:12px;color:var(--cyan);letter-spacing:2px;margin-bottom:4px">CERERE VACANTA</div><label>DATA INCEPUT</label><input type="date" id="vac-start" value="${today}"><label>DATA SFARSIT</label><input type="date" id="vac-end" value="${today}"><label>MOTIV</label><textarea id="vac-reason" rows="3" placeholder="Motiv concediu..."></textarea><button class="btn-primary" onclick="submitVacation()">🏖️ TRIMITE CERERE</button></div>${vacations.length?`<div class="section-title">CERERI ANTERIOARE</div>${vacations.map(v=>`<div style="background:var(--card-bg);border:1px solid var(--card-border);border-radius:10px;padding:12px;margin-bottom:8px"><div style="font-family:var(--font-t);font-size:12px">${v.start_date} → ${v.end_date}</div><div style="font-size:11px;color:var(--text2);margin-top:4px">${v.reason||'—'}</div><div style="font-size:10px;margin-top:4px;color:${v.approved?'var(--green)':'var(--yellow)'}">${v.approved?'✓ APROBAT':'⏳ IN ASTEPTARE'}</div></div>`).join('')}`:''}`;
}

async function submitVacation() {
  if(!APP.currentWorker){alert('Autentifica-te mai intai!');return;}
  const start=document.getElementById('vac-start').value,end=document.getElementById('vac-end').value,reason=document.getElementById('vac-reason').value;
  if(!start||!end||end<start){alert('Date invalide!');return;}
  if(APP.sb){try{await APP.sb.from('vacations').insert({worker_id:APP.currentWorker.id,start_date:start,end_date:end,reason});}catch(e){alert('Eroare: '+e.message);return;}}
  await loadVacation();
}

async function loadTeams() {
  const el=document.getElementById('teams-content');if(!el)return;
  let teams=[];
  if(APP.sb){try{const{data}=await APP.sb.from('teams').select('id,name,team_members(worker:workers(id,name,avatar,role))');if(data)teams=data;}catch(e){}}
  el.innerHTML=teams.length?teams.map(t=>`<div class="team-card"><div class="team-name">👥 ${t.name}</div>${(t.team_members||[]).map(m=>`<div class="team-member"><span style="font-size:18px">${m.worker?.avatar||'🔨'}</span><div><div style="font-size:13px">${m.worker?.name||'—'}</div><div style="font-size:10px;color:var(--cyan)">${capitalize(m.worker?.role||'')}</div></div></div>`).join('')}</div>`).join(''):'<div class="empty-msg">Nicio echipa configurata</div>';
}

function toggleNotif() {
  if(Notification.permission==='granted'){document.getElementById('notif-text').textContent='NOTIFICARI ACTIVE';document.getElementById('notif-btn').textContent='ACTIVE ✓';return;}
  Notification.requestPermission().then(p=>{if(p==='granted'){document.getElementById('notif-text').textContent='NOTIFICARI ACTIVE';document.getElementById('notif-btn').textContent='ACTIVE ✓';scheduleNotif();}});
}

function scheduleNotif() {
  if(Notification.permission!=='granted')return;
  const now=new Date(),target=new Date(now.getFullYear(),now.getMonth(),now.getDate(),17,35,0);
  if(target<=now)target.setDate(target.getDate()+1);
  setTimeout(()=>{new Notification('PLAFON STEEL',{body:'⚡ Nu uita sa pontezi orele de azi!',icon:'🏗️'});scheduleNotif();},target-now);
}

function fmtDate(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
function pad(n){return String(n).padStart(2,'0');}

document.addEventListener('DOMContentLoaded', init);
