/* Splash screen: fades out after a few seconds or when tapped */
(function(){var s=document.getElementById('splash'),done=false;function go(){if(done)return;done=true;s.classList.add('out');setTimeout(function(){s.remove()},800)}s.onclick=go;setTimeout(go,3800)})();

// SCHOOL MANAGEMENT SYSTEM - main script
// Everything is saved in the browser (localStorage) under KEY, so no database or server is needed.
// Sections: helpers > data (S) > teachers > classes > students > principal > results > attendance > exams > library > parents > doubts/chat.
// $ = shortcut for document.querySelector, esc() = makes text safe to show in HTML.
const KEY='school-portal-v2';
try{localStorage.removeItem('school-portal-v1')}catch(e){}
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Today's date as YYYY-MM-DD in LOCAL time (toISOString() uses UTC and gives yesterday in India after midnight)
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const STATUS=[['P','Present'],['A','Absent'],['L','Leave'],['T','Late']];

// Empty starting data for a brand-new school
function seed(){return {ver:2,school:'My School',accent:'#0f766e',theme:'auto',cols:{sub:true,phone:true,mail:true},nextId:1,teachers:[],att:{},classes:[],nextCls:1,students:[],notices:[]}}

// S = the whole school's data. Loaded from the browser; save() writes it back after every change.
let S;
try{S=JSON.parse(localStorage.getItem(KEY))||seed()}catch(e){S=seed()}
// Makes sure every list exists (also upgrades data saved by older versions)
function fix(){S.tagline=S.tagline||'';S.tasks=S.tasks||[];S.tt=S.tt||'';S.ttIn=S.ttIn||{};
  S.ver=2;S.teachers=S.teachers||[];S.att=S.att||{};S.nextId=S.nextId||1;S.classes=S.classes||[];S.nextCls=S.nextCls||1;
  S.pPin='0022';S.pRec='';S.results=S.results||[];S.satt=S.satt||{};S.matt=S.matt||{};S.asg=S.asg||[];S.exams=S.exams||[];S.dues=S.dues||[];S.lib=S.lib||[];S.logo=S.logo||'';
  S.students=S.students||[];
  S.students.forEach(x=>{if(x.private==null){x.private=false;x.pin=''}if(x.dpin==null)x.dpin=''});S.classes.forEach(c=>{delete c.pin});
  S.notices=S.notices||[];
  S.ttCls=S.ttCls||{};S.doubts=S.doubts||[];S.pchat=S.pchat||[];S.reports=S.reports||[];
  S.tasks.forEach(x=>{if(x.cid==null){const c=S.classes.find(y=>y.name.toLowerCase()===(x.cls||'').toLowerCase());x.cid=c?c.id:0}})}
fix();
const unlocked=new Set(); // private rows revealed this session
let DB=null,lastJson='',pushT=null,dirty=false,API=false,ver=0;
// Save to the browser and update the home page summary
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}try{renderDash()}catch(e){}pushRemote()}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2200)}

// Applies school name, logo, colour and light/dark theme
function applyLook(){
  document.documentElement.style.setProperty('--accent',S.accent);
  const r=document.documentElement;
  if(S.theme==='auto')r.removeAttribute('data-theme');else r.setAttribute('data-theme',S.theme);
  $('#homeSchool').textContent=S.school;$('#homeTag').textContent=S.tagline;$('#homeTag').classList.toggle('hidden',!S.tagline);if(S.logo)$('#homeLogo').src=S.logo;else $('#homeLogo').removeAttribute('src');$('#homeLogo').classList.toggle('hidden',!S.logo);
  $('#schoolTitle').textContent=S.school+' · Teachers';$('#pTitle').textContent=S.school+', Principal';
  document.title=S.school+' · School Management System';
}

// Shows one main screen (home, teachers, students, parents or principal) and hides the rest
function show(id){['home','teachers','students','parents','principal'].forEach(x=>$('#'+x).classList.toggle('hidden',x!==id));window.scrollTo(0,0)}

// Teachers screen: counts + table of teachers with attendance for the chosen date
function render(){
  const d=$('#date').value||today();
  const day=S.att[d]||{};
  const q=$('#search').value.trim().toLowerCase();
  $('#totalNum').textContent=S.teachers.length;
  const c={P:0,A:0,L:0,T:0,N:0};
  S.teachers.forEach(t=>{const s=day[t.id];s?c[s]++:c.N++});
  const cls={P:'s-p',A:'s-a',L:'s-l',T:'s-t',N:''};
  $('#stats').innerHTML=[['P','Present'],['A','Absent'],['L','On leave'],['T','Late'],['N','Not marked']].map(([k,l])=>`<div class="stat ${cls[k]}"><b>${c[k]}</b><small>${l}</small></div>`).join('');

  const col=S.cols;
  $('#thead').innerHTML='<th>Name</th>'+(col.sub?'<th>Subject</th>':'')+(col.phone?'<th>Phone</th>':'')+(col.mail?'<th>Email</th>':'')+'<th>Attendance on '+esc(d)+'</th><th></th>';
  const list=S.teachers.filter(t=>!q||t.name.toLowerCase().includes(q)||t.subject.toLowerCase().includes(q));
  if(!list.length){$('#tbody').innerHTML=`<tr><td colspan="6" class="empty">${S.teachers.length?'No teacher matches your search.':'No teachers yet. Use Add teacher to start.'}</td></tr>`;return}
  $('#tbody').innerHTML=list.map(t=>{
    const hide=t.private&&!unlocked.has(t.id);
    const v=x=>hide?'<span class="priv">Private</span>':esc(x||'-');
    const nm={P:'Present',A:'Absent',L:'On leave',T:'Late'};const seg=day[t.id]?`<b class="st-${day[t.id]}">${nm[day[t.id]]}</b>`:'<span class="meta">Not marked</span>';
    return `<tr><td><b>${esc(t.name)}</b></td>`+(col.sub?`<td>${v(t.subject)}</td>`:'')+(col.phone?`<td>${v(t.phone)}</td>`:'')+(col.mail?`<td>${v(t.email)}</td>`:'')+
      `<td>${seg}</td>`+
      `<td style="white-space:nowrap"><button class="icon" data-act="priv" data-id="${t.id}" title="${t.private?'Data is private. Click to change':'Make my data private'}" aria-label="Toggle privacy for ${esc(t.name)}">${t.private?'🔒':'🔓'}</button>`+
      `</td></tr>`;
  }).join('');
}

/* PIN helper: returns a promise resolving to the PIN string or null */
$('#pinIn').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,4);$('#pinErr').textContent=''});
// Opens the PIN box and returns the 4 digits typed (or null if cancelled)
function askPin(title,help){
  return new Promise(res=>{
    $('#pinTitle').textContent=title;$('#pinHelp').textContent=help;$('#pinIn').value='';
    const dlg=$('#pinDlg');let val=null;
    $('#pinErr').textContent='';
    $('#pinForm').onsubmit=e=>{const v=$('#pinIn').value.trim();if(!/^\d{4}$/.test(v)){e.preventDefault();$('#pinErr').textContent='Type exactly 4 digits (numbers only), then press Continue.';return}val=v};
    dlg.onclose=()=>res(val);
    dlg.showModal();
  });
}
async function togglePrivacy(t){
  if(!t.private){
    const p=await askPin('Make '+t.name+' private','Set a 4-digit PIN. Phone, email and subject stay hidden until the PIN is entered.');
    if(p&&/^\d{4}$/.test(p)){t.private=true;t.pin=p;unlocked.delete(t.id);save();render();toast('Data is now private')}
  }else if(unlocked.has(t.id)){
    unlocked.delete(t.id);render();toast('Hidden again');
  }else{
    const p=await askPin('Unlock '+t.name,'Enter the PIN to view details. After viewing, press the lock again to hide them, or choose Remove privacy in Edit.');
    if(p===null)return;
    if(p===t.pin){unlocked.add(t.id);render();toast('Details unlocked for this session')}else toast('Wrong PIN');
  }
}

/* Teacher form */
let editing=null;
function openForm(t){
  editing=t||null;
  $('#tTitle').textContent=t?'Edit teacher':'Add teacher';
  $('#fName').value=t?t.name:'';$('#fSub').value=t?t.subject:'';$('#fPhone').value=t?t.phone:'';$('#fMail').value=t?t.email:'';$('#fLpin').value=t?(t.lpin||''):'';
  $('#delT').classList.toggle('hidden',!t);
  $('#tDlg').showModal();
}
$('#tForm').addEventListener('submit',()=>{
  const v={name:$('#fName').value.trim(),subject:$('#fSub').value.trim(),phone:$('#fPhone').value.trim(),email:$('#fMail').value.trim(),lpin:$('#fLpin').value.trim()};
  if(!v.name)return;
  if(editing)Object.assign(editing,v);else S.teachers.push({id:S.nextId++,...v,private:false,pin:''});
  save();render();renderPT();toast('Teacher saved');
});
$('#delT').onclick=async()=>{
  if(!editing)return;
  if(!confirm('Delete '+editing.name+'?'))return;
  S.teachers=S.teachers.filter(x=>x.id!==editing.id);S.doubts=S.doubts.filter(d=>d.tid!=editing.id);
  Object.values(S.att).forEach(d=>delete d[editing.id]);
  save();$('#tDlg').close();render();renderPT();toast('Teacher deleted');
};

/* Events */
$('#goTeacher').onclick=()=>{show('teachers');render()};
$('#goStudent').onclick=()=>{show('students');renderStudentPick()};
$('#back').onclick=()=>show('home');
$('#date').onchange=render;
$('#search').oninput=render;
$('#tbody').onclick=e=>{
  const b=e.target.closest('button[data-act]');if(!b)return;
  const t=S.teachers.find(x=>x.id==b.dataset.id);if(!t)return;
  const d=$('#date').value||today();
  if(b.dataset.act==='mark'){S.att[d]=S.att[d]||{};S.att[d][t.id]=(S.att[d][t.id]===b.dataset.s)?undefined:b.dataset.s;if(!S.att[d][t.id])delete S.att[d][t.id];save();render()}
  else if(b.dataset.act==='priv')togglePrivacy(t);
  else if(b.dataset.act==='edit'){
    if(t.private&&!unlocked.has(t.id)){askPin('Unlock '+t.name,'Enter the PIN to edit this private record.').then(p=>{if(p===t.pin){unlocked.add(t.id);render();openForm(t)}else if(p!==null)toast('Wrong PIN')})}
    else openForm(t);
  }
};
document.addEventListener('click',e=>{if(e.target.matches('[data-close]'))e.target.closest('dialog').close()});

/* Export */
$('#exportBtn').onclick=()=>{
  const d=$('#date').value||today(),day=S.att[d]||{},nm={P:'Present',A:'Absent',L:'Leave',T:'Late'};
  const rows=[['Name','Subject','Status on '+d]].concat(S.teachers.map(t=>[t.name,t.private?'Private':t.subject,nm[day[t.id]]||'Not marked']));
  const csv=rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='attendance-'+d+'.csv';
  document.body.appendChild(a);a.click();a.remove();
};

/* Settings */
$('#settingsBtn').onclick=()=>openSet(false);
$('#pSet').onclick=()=>openSet(true);
function openSet(admin){
  $('#sPrin').classList.toggle('hidden',!admin);pendingLogo=undefined;showPrev();$('#resetBtn').classList.toggle('hidden',!admin);
  $('#sName').value=S.school;$('#sTag').value=S.tagline;$('#sColor').value=S.accent;$('#sTheme').value=S.theme;
  $('#cSub').checked=S.cols.sub;$('#cPhone').checked=S.cols.phone;$('#cMail').checked=S.cols.mail;
  $('#sDlg').showModal();
}
$('#sForm').addEventListener('submit',()=>{
  S.school=$('#sName').value.trim()||'My School';S.tagline=$('#sTag').value.trim();if(pendingLogo!==undefined)S.logo=pendingLogo;S.accent=$('#sColor').value;S.theme=$('#sTheme').value;
  S.cols={sub:$('#cSub').checked,phone:$('#cPhone').checked,mail:$('#cMail').checked};
  save();applyLook();render();toast('Settings saved');
});
$('#resetBtn').onclick=()=>{if(confirm('Delete all teachers and attendance and start fresh?')){S=seed();fix();unlocked.clear();save();$('#sDlg').close();applyLook();render();renderNotices();renderPT();toast('Reset done')}};

/* Tabs */
// Switches between the teacher screen tabs
/* Tabs */
const TV={res:'res',satt:'cls',asg:'asg',exm:'exm',lib:'lib',dbt:'dbt',pch:'pch'};
function tab(n){const w=TV[n]?'res':n;['att','today','cls','res','tt'].forEach(x=>$('#tab-'+x).classList.toggle('hidden',x!==w));['att','today','cls','res','satt','asg','exm','lib','dbt','pch','tt'].forEach(x=>$('#t-'+x).setAttribute('aria-selected',x===n));if(n==='today')renderToday();if(n==='cls')renderClasses();if(TV[n]){setRV(TV[n]);renderRes()}if(n==='tt')initTT()}
document.querySelectorAll('#tTabs button').forEach(b=>b.onclick=()=>tab(b.dataset.tab));

/* Today: homework, tests, notes */
const ICON={Homework:'📚',Test:'📝',Note:'🗒️'};
function renderToday(){
  const cur=$('#kTeacher').value;
  $('#kTeacher').innerHTML=S.teachers.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');
  if(cur)$('#kTeacher').value=cur;
  const cc=$('#kClass').value,cf0=$('#kClassF').value||'all';
  $('#kClass').innerHTML=S.classes.map(c=>`<option value="${c.id}">Class ${esc(c.name)}</option>`).join('');
  if(cc)$('#kClass').value=cc;
  $('#kClassF').innerHTML='<option value="all">All classes</option>'+S.classes.map(c=>`<option value="${c.id}">Class ${esc(c.name)}</option>`).join('');
  $('#kClassF').value=cf0;
  if(!$('#kDate').value)$('#kDate').value=today();
  if(!$('#kView').value)$('#kView').value=today();
  const d=$('#kView').value,f=$('#kFilter').value;
  const cf=$('#kClassF').value,l=S.tasks.filter(x=>x.date===d&&(f==='All'||x.type===f)&&(cf==='all'||x.cid==cf));
  $('#kList').innerHTML=l.length?l.map(x=>{const t=S.teachers.find(y=>y.id==x.tid);
    return `<article class="item"><div><b>${ICON[x.type]} ${esc(x.type)}: ${esc(x.title)}</b><div class="meta">Sent to ${esc(cname(x.cid))}, ${esc(t?t.name:'Teacher removed')}</div>${x.body?'<p>'+esc(x.body)+'</p>':''}</div><button class="icon" data-del="${x.id}" aria-label="Delete this post">🗑️</button></article>`}).join('')
    :'<div class="empty">Nothing posted for this date. Use the form above to add homework, a test or a note.</div>';
}
$('#kPost').onclick=()=>{
  const title=$('#kTitle').value.trim();
  if(!S.classes.length){toast('Add a class in Classes first');return}
  if(!title||!S.teachers.length){toast(S.teachers.length?'Add a title first':'Add a teacher first');return}
  S.tasks.push({id:Date.now(),type:$('#kType').value,cid:+$('#kClass').value,tid:$('#kTeacher').value,date:$('#kDate').value||today(),title,body:$('#kBody').value.trim()});
  $('#kTitle').value='';$('#kBody').value='';save();$('#kView').value=S.tasks[S.tasks.length-1].date;renderToday();toast('Posted');
};
$('#kList').onclick=e=>{const b=e.target.closest('[data-del]');if(b&&confirm('Delete this post?')){S.tasks=S.tasks.filter(x=>x.id!=b.dataset.del);save();renderToday()}};
$('#kClassF').onchange=renderToday;$('#kClass').onchange=()=>{const c=S.classes.find(x=>x.id==$('#kClass').value);if(c&&c.teacher)$('#kTeacher').value=c.teacher};
$('#kView').onchange=renderToday;$('#kFilter').onchange=renderToday;

/* Timetable maker */
const TTIDS=['ttMode','ttClasses','ttDays','ttPer','ttStart','ttLen','ttBrkAfter','ttBrkLen','ttSubs','ttExamName','ttSubjects','ttDate','ttETime','ttDur','ttSkip','ttGap'];
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat'];
const fmt=m=>{const h=Math.floor(m/60)%24;return (h%12||12)+':'+String(m%60).padStart(2,'0')+' '+(h<12?'AM':'PM')};
function ttMode(){const m=$('#ttMode').value;$('#ttSchool').classList.toggle('hidden',m!=='school');$('#ttExam').classList.toggle('hidden',m!=='exam')}
function initTT(){
  if(!initTT.done){initTT.done=1;TTIDS.forEach(id=>{if(S.ttIn[id]!=null)$('#'+id).value=S.ttIn[id]});if(!$('#ttDate').value)$('#ttDate').value=today();if(S.ttIn.ttClasses==null&&S.classes.length)$('#ttClasses').value=S.classes.map(c=>c.name).join(', ');$('#ttOut').innerHTML=S.tt}
  ttMode();
}
$('#ttMode').onchange=ttMode;
$('#ttFill').onclick=()=>{
  const l=S.teachers.filter(t=>t.subject&&(!t.private||unlocked.has(t.id))).map(t=>t.subject+', '+t.name+', 5');
  $('#ttSubs').value=l.join('\n');toast(l.length?'Filled. Change periods per week if needed':'No teachers with a visible subject');
};
// Timetable maker: places every lesson in a free slot, never the same teacher in two classes at once. Retries up to 400 times.
function genSchool(){
  const cls=$('#ttClasses').value.split(',').map(x=>x.trim()).filter(Boolean);
  const days=+$('#ttDays').value,per=Math.max(1,+$('#ttPer').value||7);
  const subs=$('#ttSubs').value.split('\n').map(l=>l.split(',').map(x=>x.trim())).filter(a=>a[0]).map(a=>({sub:a[0],teacher:a[1]||'-',n:Math.max(1,+a[2]||1)}));
  if(!cls.length||!subs.length)return {err:'Add at least one class and one subject line.'};
  const total=subs.reduce((a,x)=>a+x.n,0);
  if(total>days*per)return {err:`Subjects need ${total} periods a week, but each class has only ${days*per}. Lower the periods per week or add periods per day.`};
  for(let at=0;at<400;at++){
    const busy=new Set(),grids={};let ok=true;
    for(const c of cls){
      const g=Array.from({length:days},()=>Array(per).fill(null));
      const les=[];subs.forEach(x=>{for(let i=0;i<x.n;i++)les.push(x)});
      les.sort(()=>Math.random()-.5);
      for(const L of les){
        const opts=[];
        for(let d=0;d<days;d++){const same=g[d].filter(x=>x&&x.sub===L.sub).length;if(same>=2)continue;
          for(let p=0;p<per;p++)if(!g[d][p]&&(L.teacher==='-'||!busy.has(L.teacher+'|'+d+'|'+p)))opts.push([d,p,same])}
        if(!opts.length){ok=false;break}
        const mn=Math.min(...opts.map(o=>o[2])),pool=opts.filter(o=>o[2]===mn),[d,p]=pool[Math.floor(Math.random()*pool.length)];
        g[d][p]=L;if(L.teacher!=='-')busy.add(L.teacher+'|'+d+'|'+p);
      }
      if(!ok)break;grids[c]=g;
    }
    if(ok)return {cls,days,per,grids};
  }
  return {err:'Could not avoid teacher clashes. Try more periods per day or fewer periods per week.'};
}
function renderSchool(r){
  S.ttCls={};const len=+$('#ttLen').value||40,ba=+$('#ttBrkAfter').value||0,bl=+$('#ttBrkLen').value||0;
  const [h,m]=($('#ttStart').value||'08:00').split(':').map(Number);let t=h*60+m;const times=[],brk={};
  for(let p=0;p<r.per;p++){times.push(fmt(t)+' - '+fmt(t+len));t+=len;if(ba&&p+1===ba&&p+1<r.per){brk[p]=fmt(t)+' - '+fmt(t+bl);t+=bl}}
  return r.cls.map(c=>{
    let rows='';
    for(let p=0;p<r.per;p++){
      rows+=`<tr><th scope="row">P${p+1}<br><small>${times[p]}</small></th>`+Array.from({length:r.days},(_,d)=>{const x=r.grids[c][d][p];return x?`<td><b>${esc(x.sub)}</b><br><small>${esc(x.teacher==='-'?'':x.teacher)}</small></td>`:'<td class="meta">Free</td>'}).join('')+'</tr>';
      if(brk[p])rows+=`<tr class="brk"><td colspan="${r.days+1}">Break, ${brk[p]}</td></tr>`;
    }
    const h=`<div class="tt"><h3>${esc(S.school)}: Class ${esc(c)}</h3><div class="scroll"><table><thead><tr><th></th>${DAYS.slice(0,r.days).map(x=>'<th>'+x+'</th>').join('')}</tr></thead><tbody>${rows}</tbody></table></div></div>`;S.ttCls[c]=h;return h;
  }).join('');
}
function genExam(){
  const subs=$('#ttSubjects').value.split(',').map(x=>x.trim()).filter(Boolean),d0=$('#ttDate').value;
  if(!subs.length||!d0)return '<p class="err">Add subjects and a first exam date.</p>';
  const both=$('#ttSkip').value==='both',dur=+$('#ttDur').value||180;
  const [h,m]=($('#ttETime').value||'10:00').split(':').map(Number),st=h*60+m;
  const inv=S.teachers.map(t=>t.name),d=new Date(d0+'T00:00:00'),gap=Math.max(0,Math.min(10,Math.round(+$('#ttGap').value||0)));
  const fd=()=>d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short',year:'numeric'});
  const work=()=>{while(d.getDay()===0||(both&&d.getDay()===6))d.setDate(d.getDate()+1)};
  let rows='';
  subs.forEach((x,i)=>{
    work();rows+=`<tr><td>${fd()}</td><td><b>${esc(x)}</b></td><td>${fmt(st)} - ${fmt(st+dur)}</td><td>${esc(inv.length?inv[i%inv.length]:'-')}</td></tr>`;d.setDate(d.getDate()+1);
    if(i<subs.length-1)for(let g=0;g<gap;g++){work();rows+=`<tr style="opacity:.75"><td>${fd()}</td><td colspan="3"><i>Holiday (study leave)</i></td></tr>`;d.setDate(d.getDate()+1)}
  });
  return `<div class="tt"><h3>${esc(S.school)}: ${esc($('#ttExamName').value||'Exam')}</h3><div class="scroll"><table><thead><tr><th>Date</th><th>Subject</th><th>Time</th><th>Invigilator</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
$('#ttGo').onclick=()=>{
  let html;
  if($('#ttMode').value==='school'){const r=genSchool();html=r.err?`<p class="err">${esc(r.err)}</p>`:renderSchool(r)}
  else html=genExam();
  $('#ttOut').innerHTML=html;S.tt=html;S.ttIn={};TTIDS.forEach(id=>S.ttIn[id]=$('#'+id).value);save();
  $('#ttOut').scrollIntoView({behavior:'smooth',block:'start'});
};

/* Classes (teacher side) */
const cname=id=>{const c=S.classes.find(x=>x.id==id);return c?'Class '+c.name:'no class'};
const revealed=new Set();
const tOpts=sel=>S.teachers.map(t=>`<option value="${t.id}"${t.id==sel?' selected':''}>${esc(t.name)}</option>`).join('');
function renderClasses(){
  const cur=$('#cTeacher').value;$('#cTeacher').innerHTML=tOpts(cur);
  $('#cBody').innerHTML=S.classes.length?S.classes.map(c=>`<tr><td><b>${esc(c.name)}</b></td><td><select data-act="ct" data-id="${c.id}" aria-label="Class teacher of ${esc(c.name)}">${tOpts(c.teacher)}</select></td><td style="white-space:nowrap"><button class="icon" data-act="cdel" data-id="${c.id}" aria-label="Delete class ${esc(c.name)}">🗑️</button></td></tr>`).join('')
    :'<tr><td colspan="4" class="empty">No classes yet. Add one above.</td></tr>';
}
async function changePin(c){
  const t=S.teachers.find(x=>x.id==c.teacher);
  if(t&&t.private&&!unlocked.has(t.id)){const p=await askPin('Class teacher check','Only '+t.name+' can change this PIN. Enter their private PIN.');if(p!==t.pin){if(p!==null)toast('Wrong PIN');return}}
  const n=await askPin('New student PIN for '+c.name,'Students use this 4-digit PIN to open their class.');
  if(n&&/^\d{4}$/.test(n)){c.pin=n;revealed.add(c.id);save();renderClasses();toast('Student PIN updated')}
}
$('#cAdd').onclick=()=>{
  const n=$('#cName').value.trim();
  if(!n)return toast('Enter a class name');
  if(S.classes.some(c=>c.name.toLowerCase()===n.toLowerCase()))return toast('That class already exists');
  if(!S.teachers.length)return toast('Add a teacher first');
  S.classes.push({id:S.nextCls++,name:n,teacher:$('#cTeacher').value});
  $('#cName').value='';save();renderClasses();toast('Class added');
};
$('#cBody').onclick=e=>{
  const b=e.target.closest('button[data-act]');if(!b)return;
  const c=S.classes.find(x=>x.id==b.dataset.id);if(!c)return;
  if(b.dataset.act==='cdel'&&confirm('Delete class '+c.name+' and everything sent to it?')){S.classes=S.classes.filter(x=>x.id!==c.id);S.tasks=S.tasks.filter(x=>x.cid!=c.id);delete S.ttCls[c.name];Object.keys(S.matt).forEach(k=>{if(S.matt[k].cid===c.id)delete S.matt[k]});save();renderClasses();toast('Class deleted')}
};
$('#cBody').onchange=e=>{const s=e.target.closest('select[data-act="ct"]');if(!s)return;const c=S.classes.find(x=>x.id==s.dataset.id);if(c){c.teacher=s.value;save();toast('Class teacher changed')}};

/* Students */
let curClass=null;const tries={};
function renderStudentPick(){
  curClass=null;curStu=null;signedStu=null;$('#pfClass').innerHTML=S.classes.map(c=>`<option value="${c.id}">Class ${esc(c.name)}</option>`).join('');$('#sPick').classList.remove('hidden');$('#sClass').classList.add('hidden');$('#sTitle').textContent=S.school+', Students';
  $('#sClasses').innerHTML=S.classes.length?S.classes.map(c=>{const t=S.teachers.find(x=>x.id==c.teacher);return `<button class="door" data-cid="${c.id}"><h2>Class ${esc(c.name)}</h2><span>Class teacher: ${esc(t?t.name:'not assigned')}</span></button>`}).join('')
    :'<div class="empty">No classes yet. A teacher can add them in Classes.</div>';
}
$('#sClasses').onclick=e=>{const b=e.target.closest('[data-cid]');if(!b)return;curClass=+b.dataset.cid;curStu=null;$('#sDate').value=today();$('#sFilter').value='All';$('#sPick').classList.add('hidden');$('#sClass').classList.remove('hidden');renderClass()};
function renderClass(){
  const c=S.classes.find(x=>x.id===curClass);if(!c)return renderStudentPick();
  const t=S.teachers.find(x=>x.id==c.teacher);
  $('#sTitle').textContent='Class '+c.name;$('#sClsName').textContent=c.name;$('#sTeach').textContent='Class teacher: '+(t?t.name:'not assigned')+' · '+S.students.filter(x=>x.cid===c.id).length+' students';
  const mine=S.tasks.filter(x=>x.cid==c.id);
  const up=mine.filter(x=>x.type==='Test'&&x.date>=today()).sort((a,b)=>a.date<b.date?-1:1);
  $('#sUp').innerHTML=up.length?`<div class="panel"><h3>Upcoming tests</h3>${up.map(x=>`<div>${esc(x.date)}: <b>${esc(x.title)}</b>${x.body?' - '+esc(x.body):''}</div>`).join('')}</div>`:'';
  const d=$('#sDate').value||today(),f=$('#sFilter').value;
  const l=mine.filter(x=>x.date===d&&(f==='All'||x.type===f));
  $('#sList').innerHTML=l.length?l.map(x=>{const tt=S.teachers.find(y=>y.id==x.tid);return `<article class="item"><div><b>${ICON[x.type]} ${esc(x.type)}: ${esc(x.title)}</b><div class="meta">From ${esc(tt?tt.name:'a teacher')}</div>${x.body?'<p>'+esc(x.body)+'</p>':''}</div></article>`}).join('')
    :'<div class="empty">Nothing posted for this date.</div>';
  $('#sTT').innerHTML=S.ttCls[c.name]||'';renderMine();renderCA();renderSL();
}
$('#sDate').onchange=renderClass;$('#sFilter').onchange=renderClass;
$('#sBack').onclick=()=>{if(curClass!==null)renderStudentPick();else show('home')};

/* Notice board */
const sortN=()=>S.notices.slice().sort((a,b)=>((b.imp?1:0)-(a.imp?1:0))||(a.date<b.date?1:a.date>b.date?-1:b.id-a.id));
function noticeHtml(n,admin){
  return `<article class="item${n.imp?' imp':''}"><div><b>${n.imp?'📌 ':''}${esc(n.title)}</b><div class="meta">${esc(n.date)}</div>${n.body?'<p>'+esc(n.body)+'</p>':''}</div>`+
    (admin?`<div style="white-space:nowrap"><button class="icon" data-nedit="${n.id}" aria-label="Edit notice">✏️</button><button class="icon" data-ndel="${n.id}" aria-label="Delete notice">🗑️</button></div>`:'')+'</article>';
}
function renderNotices(){
  const l=sortN();
  $('#notices').innerHTML=l.length?l.slice(0,6).map(n=>noticeHtml(n,false)).join(''):'<div class="empty">No notices right now.</div>';
  $('#pNotices').innerHTML=l.length?l.map(n=>noticeHtml(n,true)).join(''):'<div class="empty">No notices yet.</div>';
}

/* Principal */
let isPrin=false,editN=null;const pTry={n:0,until:0};
function renderPT(){
  $('#pTotal').textContent=S.teachers.length;
  $('#pBody').innerHTML=S.teachers.length?S.teachers.map(t=>`<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.subject||'-')}</td><td>${esc(t.phone||'-')}</td><td>${esc(t.email||'-')}</td><td>${t.private?'🔒 Locked by teacher':'Open'}</td><td style="white-space:nowrap"><button class="btn" data-pedit="${t.id}">Edit</button>${t.private?` <button class="btn" data-punlock="${t.id}">Remove lock</button>`:''}</td></tr>`).join('')
    :'<tr><td colspan="6" class="empty">No teachers yet. Use Add teacher.</td></tr>';
}
function enterPrin(){isPrin=true;show('principal');for(const f of [renderPT,renderNotices,repBadge,()=>ptab('teachers')]){try{f()}catch(e){console.error(e)}}}
function ptab(n){['teachers','att','stu','fee','notice','rep'].forEach(x=>{$('#p-'+x).classList.toggle('hidden',x!==n);$('#pt-'+x).setAttribute('aria-selected',x===n)});if(n==='att')renderPA();if(n==='stu')renderPS();if(n==='fee')renderFees();if(n==='rep')renderRep()}
document.querySelectorAll('#pTabs button').forEach(b=>b.onclick=()=>ptab(b.dataset.ptab));
$('#goPrincipal').onclick=async()=>{
  if(Date.now()<pTry.until)return toast('Too many wrong tries. Wait a little and try again.');
  const p=await askPin('Principal PIN','Enter the principal PIN.');
  if(p===null)return;
  if(p===S.pPin){pTry.n=0;enterPrin()}
  else{pTry.n++;if(pTry.n>=3){pTry.n=0;pTry.until=Date.now()+30000;toast('Wrong PIN. Locked for 30 seconds.')}else toast('Wrong PIN')}
};
$('#pBack').onclick=()=>{isPrin=false;show('home')};
$('#pAdd').onclick=()=>{if(isPrin)openForm(null)};
$('#pBody').onclick=e=>{
  if(!isPrin)return;
  const b=e.target.closest('[data-pedit],[data-punlock]');if(!b)return;
  const t=S.teachers.find(x=>x.id==(b.dataset.pedit||b.dataset.punlock));if(!t)return;
  if(b.dataset.pedit)openForm(t);
  else if(confirm('Remove the privacy lock on '+t.name+'? Their details become visible to everyone again.')){t.private=false;t.pin='';unlocked.delete(t.id);save();renderPT();render();toast('Lock removed')}
};

/* principal marks attendance */
function renderPA(){
  const d=$('#pDate').value||today();$('#pDate').value=d;
  const day=S.att[d]||{},c={P:0,A:0,L:0,T:0,N:0},cl={P:'s-p',A:'s-a',L:'s-l',T:'s-t',N:''};
  S.teachers.forEach(t=>{const x=day[t.id];x?c[x]++:c.N++});
  $('#pStats').innerHTML=[['P','Present'],['A','Absent'],['L','On leave'],['T','Late'],['N','Not marked']].map(([k,l])=>`<div class="stat ${cl[k]}"><b>${c[k]}</b><small>${l}</small></div>`).join('');
  $('#pAttBody').innerHTML=S.teachers.length?S.teachers.map(t=>`<tr><td><b>${esc(t.name)}</b></td><td><div class="seg" role="group" aria-label="Attendance for ${esc(t.name)}">${STATUS.map(([k,l])=>`<button class="${k}${day[t.id]===k?' on':''}" data-pmark="1" data-id="${t.id}" data-s="${k}" aria-pressed="${day[t.id]===k}">${l}</button>`).join('')}</div></td></tr>`).join('')
    :'<tr><td colspan="2" class="empty">No teachers yet.</td></tr>';
}
$('#pDate').onchange=renderPA;
$('#pAttBody').onclick=e=>{
  if(!isPrin)return;const b=e.target.closest('[data-pmark]');if(!b)return;
  const d=$('#pDate').value||today();S.att[d]=S.att[d]||{};
  if(S.att[d][b.dataset.id]===b.dataset.s)delete S.att[d][b.dataset.id];else S.att[d][b.dataset.id]=b.dataset.s;
  save();renderPA();render();
};
$('#pMarkAll').onclick=()=>{if(!isPrin)return;const d=$('#pDate').value||today();S.att[d]=S.att[d]||{};S.teachers.forEach(t=>S.att[d][t.id]='P');save();renderPA();render();toast('Everyone marked present')};

/* notice form */
function resetN(){editN=null;$('#nTitle').value='';$('#nBody').value='';$('#nImp').checked=false;$('#nHead').textContent='Post a notice';$('#nPost').textContent='Post notice';$('#nCancel').classList.add('hidden')}
$('#nPost').onclick=()=>{
  if(!isPrin)return;
  const title=$('#nTitle').value.trim();if(!title)return toast('Add a title first');
  const v={title,body:$('#nBody').value.trim(),imp:$('#nImp').checked};
  if(editN)Object.assign(editN,v);else S.notices.push({id:Date.now(),date:today(),...v});
  save();resetN();renderNotices();toast('Notice saved');
};
$('#nCancel').onclick=resetN;
$('#pNotices').onclick=e=>{
  if(!isPrin)return;
  const ed=e.target.closest('[data-nedit]'),dl=e.target.closest('[data-ndel]');
  if(ed){const n=S.notices.find(x=>x.id==ed.dataset.nedit);if(!n)return;editN=n;$('#nTitle').value=n.title;$('#nBody').value=n.body;$('#nImp').checked=!!n.imp;$('#nHead').textContent='Edit notice';$('#nPost').textContent='Save changes';$('#nCancel').classList.remove('hidden');$('#nTitle').focus()}
  else if(dl&&confirm('Delete this notice?')){S.notices=S.notices.filter(x=>x.id!=dl.dataset.ndel);save();renderNotices()}
};
/* ===== Results system ===== */
// Grade from percentage; pct() works out percentage rounded to 1 decimal
const grade=p=>p>=90?'A+':p>=80?'A':p>=70?'B':p>=60?'C':p>=50?'D':p>=40?'E':'F';
const pct=(g,m)=>m>0?Math.round(g/m*1000)/10:0;

/* principal: students */
function renderPS(){
  const cur=$('#uClass').value;
  $('#uClass').innerHTML=S.classes.map(c=>`<option value="${c.id}">Class ${esc(c.name)}</option>`).join('');if(cur)$('#uClass').value=cur;
  $('#uBody').innerHTML=S.students.length?S.students.slice().sort((a,b)=>a.cid-b.cid||String(a.roll).localeCompare(String(b.roll),undefined,{numeric:true})).map(x=>`<tr><td>${esc(cname(x.cid))}</td><td>${esc(x.roll)}</td><td><b>${esc(x.name)}</b></td><td>${x.private?'🔒 Locked by student':'Open'}</td><td>${x.dpin?'Set':'<span class="meta">Not set</span>'}</td><td style="white-space:nowrap"><button class="btn" data-udpin="${x.id}">${x.dpin?'Change':'Set'} PIN</button> ${x.private?`<button class="btn" data-upin="${x.id}">Remove lock</button> `:''}<button class="icon" data-udel="${x.id}" aria-label="Delete ${esc(x.name)}">🗑️</button></td></tr>`).join('')
    :'<tr><td colspan="6" class="empty">No students yet. Add one above.</td></tr>';
}
$('#uAdd').onclick=()=>{
  if(!isPrin)return;
  const cid=+$('#uClass').value,roll=$('#uRoll').value.trim(),name=$('#uName').value.trim();
  if(!cid)return toast('Add a class first');
  if(!roll||!name)return toast('Enter roll number and name');
  if(S.students.some(x=>x.cid===cid&&x.roll===roll))return toast('That roll number is already used in this class');
  S.students.push({id:Date.now(),cid,roll,name,private:false,pin:''});
  $('#uRoll').value='';$('#uName').value='';save();renderPS();toast('Student added');
};
$('#uBody').onclick=async e=>{
  if(!isPrin)return;
  const pb=e.target.closest('[data-upin]'),db_=e.target.closest('[data-udel]'),dp=e.target.closest('[data-udpin]');
  if(dp){const x=S.students.find(y=>y.id==dp.dataset.udpin);if(!x)return;const n=await askPin('Sign-in PIN for '+x.name,'The student uses this 4-digit PIN to sign in and see fees and dues.');if(n){x.dpin=n;save();renderPS();toast('Sign-in PIN saved')}return}
  if(pb){const x=S.students.find(y=>y.id==pb.dataset.upin);if(x&&confirm('Remove the privacy lock on '+x.name+'? Their results become visible to everyone.')){x.private=false;x.pin='';unlockedStu.delete(x.id);save();renderPS();toast('Lock removed')}}
  else if(db_){const x=S.students.find(y=>y.id==db_.dataset.udel);if(x&&confirm('Delete '+x.name+' and all their results?')){S.students=S.students.filter(y=>y!==x);S.results=S.results.filter(r=>r.sid!==x.id);S.doubts=S.doubts.filter(d=>d.sid!==x.id);S.pchat=S.pchat.filter(m=>m.sid!==x.id);Object.values(S.satt).forEach(d=>delete d[x.id]);Object.values(S.matt).forEach(m=>delete m.days[x.id]);save();renderPS()}}
};

/* teacher: login + results */
let rT=null,editR=null;const rTry={n:0,until:0};
function renderRes(){
  $('#rTeacher').innerHTML=S.teachers.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');
  $('#rLogin').classList.toggle('hidden',rT!==null);$('#rMain').classList.toggle('hidden',rT===null);
  if(rT===null)return;
  const t=S.teachers.find(x=>x.id==rT);if(!t){rT=null;return renderRes()}
  $('#rWho').textContent=t.name+' (my classes)';
  const cs=S.classes.filter(c=>c.teacher==rT),cur=$('#rClass').value;
  $('#rClass').innerHTML=cs.length?cs.map(c=>`<option value="${c.id}">Class ${esc(c.name)}</option>`).join(''):'<option value="">No class assigned to you</option>';
  if(cur&&cs.some(c=>c.id==cur))$('#rClass').value=cur;
  const cid=+$('#rClass').value||-1,st=S.students.filter(x=>x.cid===cid);
  $('#rStu').innerHTML=st.map(x=>`<option value="${x.id}">${esc(x.roll)}. ${esc(x.name)}</option>`).join('');
  $('#rRoster').textContent=st.length?st.map(x=>x.roll+'. '+x.name).join(', '):'none yet (add students in the Student attendance tab)';
  const rs=S.results.filter(r=>r.cid===cid),exams=[...new Set(rs.map(r=>r.exam))];
  $('#rExams').innerHTML=exams.map(e=>`<option value="${esc(e)}">`).join('');
  const f0=$('#rFilter').value||'All';
  $('#rFilter').innerHTML='<option>All</option>'+exams.map(e=>`<option>${esc(e)}</option>`).join('');
  $('#rFilter').value=exams.includes(f0)?f0:'All';
  const f=$('#rFilter').value,list=rs.filter(r=>f==='All'||r.exam===f);
  $('#rBody').innerHTML=list.length?list.map(r=>{const s=S.students.find(x=>x.id===r.sid),p=pct(r.got,r.max);return `<tr><td>${esc(s?s.roll:'')}</td><td>${esc(s?s.name:'Removed')}</td><td>${esc(r.exam)}</td><td>${esc(r.subject)}</td><td>${r.max}</td><td>${r.got}</td><td>${p}%</td><td><b>${grade(p)}</b></td><td>${esc(r.remarks)}</td><td style="white-space:nowrap"><button class="icon" data-redit="${r.id}" aria-label="Edit result">✏️</button><button class="icon" data-rdel="${r.id}" aria-label="Delete result">🗑️</button></td></tr>`}).join('')
    :'<tr><td colspan="10" class="empty">No results yet for this class.</td></tr>';
}
function resetR(){editR=null;['rSub','rMax','rGot','rRem'].forEach(i=>$('#'+i).value='');$('#rFormH').textContent='Enter result';$('#rSave').textContent='Save result';$('#rCancel').classList.add('hidden')}
$('#rGo').onclick=()=>{
  if(Date.now()<rTry.until)return toast('Too many wrong tries. Wait 30 seconds.');
  const t=S.teachers.find(x=>x.id==$('#rTeacher').value);if(!t)return toast('No teachers yet');
  if(!t.lpin)return toast('No login PIN set. Ask the principal to set one.');
  if($('#rPin').value===t.lpin){rTry.n=0;rT=t.id;$('#rPin').value='';renderRes();renderCM()}
  else{if(++rTry.n>=3){rTry.n=0;rTry.until=Date.now()+30000;toast('Wrong PIN. Locked for 30 seconds.')}else toast('Wrong PIN')}
};
$('#rOut').onclick=()=>{rT=null;resetR();renderRes()};
$('#rSave').onclick=()=>{
  const cid=+$('#rClass').value,c=S.classes.find(x=>x.id===cid);
  if(rT===null||!c||c.teacher!=rT)return toast('You can only manage results for your own classes');
  const sid=+$('#rStu').value,stu=S.students.find(x=>x.id===sid&&x.cid===cid);
  const exam=$('#rExam').value.trim(),sub=$('#rSub').value.trim(),max=parseFloat($('#rMax').value),got=parseFloat($('#rGot').value);
  if(!stu||!exam||!sub)return toast('Choose a student and enter exam and subject');
  if(!(max>0)||!(got>=0)||got>max)return toast('Obtained marks must be from 0 up to the maximum');
  const v={cid,sid,exam,subject:sub,max,got,remarks:$('#rRem').value.trim(),tid:rT};
  const dup=editR||S.results.find(r=>r.sid===sid&&r.exam===exam&&r.subject.toLowerCase()===sub.toLowerCase());
  if(dup)Object.assign(dup,v);else S.results.push({id:Date.now(),...v});
  save();resetR();renderRes();toast('Result saved');
};
$('#rBody').onclick=e=>{
  const ed=e.target.closest('[data-redit]'),dl=e.target.closest('[data-rdel]'),b=ed||dl;if(!b)return;
  const r=S.results.find(x=>x.id==(ed?ed.dataset.redit:dl.dataset.rdel)),c=r&&S.classes.find(x=>x.id===r.cid);
  if(!r||rT===null||!c||c.teacher!=rT)return toast('Not allowed');
  if(ed){editR=r;$('#rStu').value=r.sid;$('#rExam').value=r.exam;$('#rSub').value=r.subject;$('#rMax').value=r.max;$('#rGot').value=r.got;$('#rRem').value=r.remarks;$('#rFormH').textContent='Edit result';$('#rSave').textContent='Update result';$('#rCancel').classList.remove('hidden')}
  else if(confirm('Delete this result?')){S.results=S.results.filter(x=>x!==r);save();renderRes()}
};
$('#rClass').onchange=()=>{resetR();renderRes();renderCM()};$('#rFilter').onchange=renderRes;$('#rCancel').onclick=resetR;

/* student results: open to all, a student may lock their own */
let curStu=null;const unlockedStu=new Set();
function renderMine(){try{renderMine0()}finally{renderDbtS()}}
function renderMine0(){
  const sts=S.students.filter(x=>x.cid===curClass),cur=$('#stName').value;
  $('#stName').innerHTML=sts.length?sts.map(x=>`<option value="${x.id}">${esc(x.roll)}. ${esc(x.name)}${x.private?' 🔒':''}</option>`).join(''):'<option value="">No students in this class</option>';
  if(cur&&sts.some(x=>x.id==cur))$('#stName').value=cur;
  const me=sts.find(x=>x.id==$('#stName').value);curStu=me?me.id:null;
  $('#stLock').classList.toggle('hidden',!me);
  if(!me){$('#stExam').classList.add('hidden');$('#stRemove').classList.add('hidden');$('#stTable').innerHTML='<div class="empty">No students have been added to this class yet.</div>';return}
  // Sign-in gate: results, attendance, exams and fees are only shown after the student enters their PIN
  if(signedStu!==me.id){
    $('#stLock').classList.add('hidden');$('#stExam').classList.add('hidden');$('#stRemove').classList.add('hidden');
    $('#stTable').innerHTML='<div class="empty">🔒 Results, attendance and fees are private. '+(me.dpin?`<br><button class="btn main" style="margin-top:8px" data-dsign="${me.id}">Sign in as ${esc(me.name)}</button>`:'The sign-in PIN has not been set yet. Ask the principal.')+'</div>';
    return;
  }
  const hid=false; // the old separate "make private" lock is replaced by the sign-in PIN
  $('#stLock').textContent=!me.private?'🔓 Make these results private':hid?'🔒 Unlock with my PIN':'Hide again';
  $('#stRemove').classList.add('hidden');$('#stLock').classList.add('hidden');
  $('#stExam').classList.toggle('hidden',hid);
  if(hid){$('#stTable').innerHTML=`<div class="empty">🔒 ${esc(me.name)} has made these results private.</div>`;return}
  const rs=S.results.filter(r=>r.sid===me.id),exams=[...new Set(rs.map(r=>r.exam))],f0=$('#stExam').value;
  $('#stExam').innerHTML='<option>All exams</option>'+exams.slice().reverse().map(e=>`<option>${esc(e)}</option>`).join('');
  $('#stExam').value=(f0&&(f0==='All exams'||exams.includes(f0)))?f0:(exams.length?exams[exams.length-1]:'All exams');
  const f=$('#stExam').value,show=exams.filter(e=>f==='All exams'||e===f);
  const resHtml=show.length?show.map(e=>{
    const l=rs.filter(r=>r.exam===e),tm=l.reduce((a,r)=>a+r.max,0),tg=l.reduce((a,r)=>a+r.got,0),tp=pct(tg,tm);
    return `<h3 style="margin:12px 0 6px">${esc(e)}</h3><div class="scroll"><table><thead><tr><th>Subject</th><th>Max marks</th><th>Obtained</th><th>%</th><th>Grade</th><th>Teacher remarks</th></tr></thead><tbody>${l.map(r=>{const p=pct(r.got,r.max);return `<tr><td>${esc(r.subject)}</td><td>${r.max}</td><td>${r.got}</td><td>${p}%</td><td><b>${grade(p)}</b></td><td>${esc(r.remarks||'-')}</td></tr>`}).join('')}<tr><td><b>Total</b></td><td><b>${tm}</b></td><td><b>${tg}</b></td><td><b>${tp}%</b></td><td><b>${grade(tp)}</b></td><td></td></tr></tbody></table></div>`}).join('')
    :'<div class="empty">No results have been published for this student yet.</div>';
  $('#stTable').innerHTML=resHtml+attHtml(me.id)+extraHtml(me.id)+duesBlock(me);
}
$('#stName').onchange=renderMine;$('#stExam').onchange=renderMine;
$('#stLock').onclick=async()=>{
  const me=S.students.find(x=>x.id===curStu);if(!me)return;
  if(!me.private){
    const p=await askPin('Make '+me.name+"'s results private",'Choose a 4-digit PIN that only you know. Everyone else will see "private" instead of your results.');
    if(p&&/^\d{4}$/.test(p)){me.private=true;me.pin=p;unlockedStu.delete(me.id);save();renderMine();toast('Your results are now private')}
  }else if(unlockedStu.has(me.id)){unlockedStu.delete(me.id);renderMine()}
  else{const p=await askPin('Unlock '+me.name,'Enter your own PIN to see your results.');if(p===null)return;if(p===me.pin){unlockedStu.add(me.id);renderMine()}else toast('Wrong PIN')}
};
$('#stRemove').onclick=()=>{const me=S.students.find(x=>x.id===curStu);if(me&&me.private&&unlockedStu.has(me.id)&&confirm('Make your results visible to everyone again?')){me.private=false;me.pin='';unlockedStu.delete(me.id);save();renderMine();toast('Your results are public again')}};


/* ===== Teacher class management: students + attendance ===== */
const SA={P:'Present',A:'Absent',L:'Leave',T:'Late'};
let rView='res';
function setRV(v){rView=v;$('#rClass').classList.toggle('hidden',v==='dbt');['res','cls','asg','exm','lib','dbt','pch'].forEach(x=>$('#rv-'+x).classList.toggle('hidden',x!==v));renderTV()}
const myCid=()=>{const c=S.classes.find(x=>x.id===+$('#rClass').value&&x.teacher==rT);return c?c.id:null};
// Attendance numbers for one student (late counts as attended)
function attStats(sid){let m=0,pr=0;const c={P:0,A:0,L:0,T:0};Object.values(S.satt).forEach(d=>{const x=d[sid];if(x){m++;c[x]++;if(x==='P'||x==='T')pr++}});return {m,pr,c,p:m?Math.round(pr/m*1000)/10:0}}
function renderCM(){
  if(rT===null)return;
  const cid=myCid(),d=$('#mDate').value||today();$('#mDate').value=d;
  const st=cid?S.students.filter(x=>x.cid===cid):[],day=S.satt[d]||{},c={P:0,A:0,L:0,T:0,N:0},cl=S.classes.find(x=>x.id===cid);
  $('#mTotal').textContent=st.length;$('#mTotalLbl').textContent=cl?(st.length===1?'student':'students')+' in Class '+cl.name:'No class assigned to you';
  st.forEach(x=>{const v=day[x.id];v?c[v]++:c.N++});
  $('#mStats').innerHTML=[['P','Present','s-p'],['A','Absent','s-a'],['L','On leave','s-l'],['T','Late','s-t'],['N','Not marked','']].map(([k,l,z])=>`<div class="stat ${z}"><b>${c[k]}</b><small>${l}</small></div>`).join('');
  $('#mBody').innerHTML=st.length?st.map(x=>{const a=attStats(x.id);return `<tr><td>${esc(x.roll)}</td><td><b>${esc(x.name)}</b></td><td><div class="seg" role="group" aria-label="Attendance for ${esc(x.name)}">${Object.keys(SA).map(k=>`<button class="${k}${day[x.id]===k?' on':''}" data-mark="${x.id}" data-s="${k}" aria-pressed="${day[x.id]===k}">${SA[k]}</button>`).join('')}</div></td><td>${a.m?a.p+'%'+(a.m>=3&&a.p<75?' <span class="err" title="Low attendance">⚠ Low</span>':''):'-'}</td><td><button class="icon" data-mdel="${x.id}" aria-label="Remove ${esc(x.name)}">🗑️</button></td></tr>`}).join('')
    :'<tr><td colspan="5" class="empty">'+(cid?'No students in this class yet. Add one above.':'No class is assigned to you.')+'</td></tr>';
  renderMR();
}
$('#mDate').onchange=renderCM;
$('#mAdd').onclick=()=>{
  const cid=myCid();if(rT===null||!cid)return toast('You can only add students to your own class');
  const roll=$('#mRoll').value.trim(),name=$('#mName').value.trim();
  if(!roll||!name)return toast('Enter roll number and name');
  if(S.students.some(x=>x.cid===cid&&x.roll===roll))return toast('That roll number is already used in this class');
  S.students.push({id:Date.now(),cid,roll,name,private:false,pin:''});
  $('#mRoll').value='';$('#mName').value='';save();renderCM();renderRes();toast('Student added');
};
$('#mAll').onclick=()=>{
  const cid=myCid();if(!cid)return;const d=$('#mDate').value||today();S.satt[d]=S.satt[d]||{};
  S.students.filter(x=>x.cid===cid).forEach(x=>S.satt[d][x.id]='P');save();renderCM();toast('Everyone marked present');
};
$('#mBody').onclick=e=>{
  const cid=myCid();if(rT===null||!cid)return;
  const mk=e.target.closest('[data-mark]'),dl=e.target.closest('[data-mdel]');
  if(mk){
    const x=S.students.find(y=>y.id==mk.dataset.mark&&y.cid===cid);if(!x)return;
    const d=$('#mDate').value||today();S.satt[d]=S.satt[d]||{};
    if(S.satt[d][x.id]===mk.dataset.s)delete S.satt[d][x.id];else S.satt[d][x.id]=mk.dataset.s;
    save();renderCM();
  }else if(dl){
    const x=S.students.find(y=>y.id==dl.dataset.mdel&&y.cid===cid);
    if(x&&confirm('Remove '+x.name+' from this class, with their results and attendance?')){
      S.students=S.students.filter(y=>y!==x);S.results=S.results.filter(r=>r.sid!==x.id);S.doubts=S.doubts.filter(d=>d.sid!==x.id);S.pchat=S.pchat.filter(m=>m.sid!==x.id);Object.values(S.satt).forEach(d=>delete d[x.id]);Object.values(S.matt).forEach(m=>delete m.days[x.id]);
      save();renderCM();renderRes();
    }
  }
};

/* student page: attendance summary */
function attHtml0(sid){
  const me=S.students.find(x=>x.id===sid),a=attStats(sid),H=t=>'<h3 style="margin:16px 0 6px">'+t+'</h3>';
  const ms=Object.values(S.matt).filter(m=>me&&m.cid===me.cid&&m.days[sid]!=null).sort((x,y)=>x.ym<y.ym?1:-1);
  const mo=H('Monthly attendance')+(ms.length?`<div class="scroll"><table><thead><tr><th>Month</th><th>Attended</th><th>Holidays</th><th>%</th></tr></thead><tbody>${ms.map(m=>`<tr><td>${esc(MN(m.ym))}</td><td><b>${m.days[sid]}</b> of ${m.work} days</td><td>${m.hol}</td><td>${pct(m.days[sid],m.work)}%</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">The class teacher has not published a monthly report yet.</div>');
  if(!a.m)return mo+H('Daily attendance')+'<div class="empty">No attendance has been marked yet.</div>';
  const dates=Object.keys(S.satt).filter(d=>S.satt[d][sid]).sort().reverse().slice(0,15);
  return mo+H('Daily attendance')+`<div class="stats"><div class="stat s-p"><b>${a.p}%</b><small>Attendance (${a.pr} of ${a.m} days)</small></div><div class="stat s-p"><b>${a.c.P}</b><small>Present</small></div><div class="stat s-a"><b>${a.c.A}</b><small>Absent</small></div><div class="stat s-l"><b>${a.c.L}</b><small>Leave</small></div><div class="stat s-t"><b>${a.c.T}</b><small>Late</small></div></div><div class="scroll"><table><thead><tr><th>Date</th><th>Status</th></tr></thead><tbody>${dates.map(d=>`<tr><td>${esc(d)}</td><td class="st-${S.satt[d][sid]}"><b>${SA[S.satt[d][sid]]}</b></td></tr>`).join('')}</tbody></table></div><p class="meta">Showing the latest ${dates.length} marked days. Late counts as attended. Only the class teacher can change attendance.</p>`;
}


/* ===== Monthly attendance report (teacher publishes, students read only) ===== */
const MN=ym=>{const [y,m]=ym.split('-');return new Date(+y,+m-1,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'})};
const dim=ym=>{const [y,m]=ym.split('-');return new Date(+y,+m,0).getDate()};
const lastDay=ym=>ym+'-'+String(dim(ym)).padStart(2,'0');
const mkey=(cid,ym)=>cid+'|'+ym;
const byRoll=(a,b)=>String(a.roll).localeCompare(String(b.roll),undefined,{numeric:true});
const pc=(v,w)=>(v===''||v==null||!(w>0))?'-':pct(+v,w)+'%';
let mrDraft={};
function renderMR(){
  if(rT===null)return;
  const cid=myCid(),mo=$('#mrMonth');if(!mo.value)mo.value=today().slice(0,7);
  const ym=mo.value;if(!ym)return;
  const k=mkey(cid,ym),pub=cid?S.matt[k]:null,st=cid?S.students.filter(x=>x.cid===cid).sort(byRoll):[];
  const dr=mrDraft[k]=mrDraft[k]||{hol:pub?pub.hol:'',days:Object.assign({},pub?pub.days:{})};
  const D=dim(ym),work=D-Math.max(0,+dr.hol||0),ok=cid&&today()>=lastDay(ym);
  $('#mrDays').value=D;$('#mrWork').value=work;if($('#mrHol').value!==String(dr.hol))$('#mrHol').value=dr.hol;
  $('#mrPub').disabled=!ok||!st.length;$('#mrPub').textContent=pub?'Update report':'Publish report';
  $('#mrNote').textContent=!cid?'No class is assigned to you.':pub?'Published on '+pub.at+'. Students can see it.':ok?'Not published yet.':'You can publish on the last day of the month ('+lastDay(ym)+').';
  $('#mrBody').innerHTML=st.length?st.map(x=>`<tr><td>${esc(x.roll)}</td><td><b>${esc(x.name)}</b></td><td><input class="num" type="number" min="0" max="${work}" data-mrd="${x.id}" value="${dr.days[x.id]==null?'':dr.days[x.id]}" aria-label="Days attended by ${esc(x.name)}"> of ${work}</td><td data-mrp>${pc(dr.days[x.id],work)}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">No students in this class yet.</td></tr>';
}
$('#mrMonth').onchange=renderMR;
$('#mrHol').oninput=e=>{const cid=myCid();if(!cid)return;const k=mkey(cid,$('#mrMonth').value);mrDraft[k]=mrDraft[k]||{hol:'',days:{}};mrDraft[k].hol=e.target.value;renderMR()};
$('#mrBody').oninput=e=>{
  const i=e.target.closest('[data-mrd]'),cid=myCid();if(!i||!cid)return;
  const k=mkey(cid,$('#mrMonth').value);mrDraft[k].days[i.dataset.mrd]=i.value;
  i.closest('tr').querySelector('[data-mrp]').textContent=pc(i.value,+$('#mrWork').value);
};
$('#mrFill').onclick=()=>{
  const cid=myCid();if(!cid)return;const ym=$('#mrMonth').value,k=mkey(cid,ym),st=S.students.filter(x=>x.cid===cid),days={};let n=0;
  st.forEach(x=>days[x.id]=0);
  Object.keys(S.satt).filter(d=>d.startsWith(ym)).forEach(d=>{if(st.some(x=>S.satt[d][x.id])){n++;st.forEach(x=>{const v=S.satt[d][x.id];if(v==='P'||v==='T')days[x.id]++})}});
  if(!n)return toast('No daily attendance has been marked in this month');
  const dr=mrDraft[k]=mrDraft[k]||{hol:'',days:{}};dr.days=days;if(dr.hol==='')dr.hol=Math.max(0,dim(ym)-n);
  renderMR();toast('Filled from daily attendance. Check the numbers, then publish');
};
$('#mrPub').onclick=()=>{
  const cid=myCid();if(rT===null||!cid)return toast('You can only publish for your own class');
  const ym=$('#mrMonth').value;if(!ym||today()<lastDay(ym))return toast('You can publish on the last day of the month');
  const k=mkey(cid,ym),dr=mrDraft[k]||{hol:'',days:{}},hol=Math.round(+dr.hol||0),work=dim(ym)-hol,days={};
  if(hol<0||work<1)return toast('Holidays must leave at least 1 working day');
  for(const x of S.students.filter(y=>y.cid===cid)){const v=dr.days[x.id];if(v===''||v==null||isNaN(+v)||+v<0||+v>work)return toast('Days attended for '+x.name+' must be from 0 to '+work);days[x.id]=Math.round(+v)}
  S.matt[k]={cid,ym,hol,work,days,at:today(),tid:rT};save();delete mrDraft[k];renderMR();toast('Monthly report published')
};

/* student page: whole class attendance */
function renderCA(){
  const c=curClass,st=S.students.filter(x=>x.cid===c).sort(byRoll),ms=Object.values(S.matt).filter(m=>m.cid===c).map(m=>m.ym).sort().reverse();
  const v=$('#caView').value,cm=$('#caMonth').value;
  $('#caMonth').innerHTML=ms.length?ms.map(y=>`<option value="${y}">${esc(MN(y))}</option>`).join(''):'<option value="">No report yet</option>';
  if(ms.includes(cm))$('#caMonth').value=cm;
  $('#caMonth').classList.toggle('hidden',v!=='m');$('#caDate').classList.toggle('hidden',v!=='d');if(!$('#caDate').value)$('#caDate').value=today();
  if(!st.length){$('#caOut').innerHTML='<div class="empty">No students in this class yet.</div>';return}
  if(v==='m'){
    const m=S.matt[mkey(c,$('#caMonth').value)];
    $('#caOut').innerHTML=m?`<div class="scroll"><table><thead><tr><th>Roll</th><th>Student</th><th>Attended</th><th>%</th></tr></thead><tbody>${st.map(x=>`<tr><td>${esc(x.roll)}</td><td><b>${esc(x.name)}</b></td><td>${m.days[x.id]==null?'-':'<b>'+m.days[x.id]+'</b> of '+m.work+' days'}</td><td>${m.days[x.id]==null?'-':pct(m.days[x.id],m.work)+'%'}</td></tr>`).join('')}</tbody></table></div><p class="meta">${m.hol} holiday(s), ${m.work} working days in ${esc(MN(m.ym))}.</p>`:'<div class="empty">The class teacher has not published a monthly report yet.</div>';
  }else{
    const day=S.satt[$('#caDate').value]||{};
    $('#caOut').innerHTML=`<div class="scroll"><table><thead><tr><th>Roll</th><th>Student</th><th>Status</th></tr></thead><tbody>${st.map(x=>`<tr><td>${esc(x.roll)}</td><td><b>${esc(x.name)}</b></td><td>${day[x.id]?`<b class="st-${day[x.id]}">${SA[day[x.id]]}</b>`:'<span class="meta">Not marked</span>'}</td></tr>`).join('')}</tbody></table></div>`;
  }
}
$('#caView').onchange=$('#caMonth').onchange=$('#caDate').onchange=renderCA;

/* ===== Dashboard, warnings, assignments, exams, dues, library, parents ===== */
// Home page summary numbers
function renderDash(){
  const t=today(),ds=S.satt[t]||{},ts=S.att[t]||{};let p=0,a=0,m=0,low=0;
  S.students.forEach(x=>{const v=ds[x.id];if(v){m++;if(v==='P'||v==='T')p++;else a++}const k=attStats(x.id);if(k.m>=3&&k.p<75)low++});
  const tp=S.teachers.filter(x=>ts[x.id]==='P'||ts[x.id]==='T').length;
  $('#dash').innerHTML=`<div class="total"><b>${S.students.length}</b><span>students in total</span></div><div class="stats">`+[[S.teachers.length,'Teachers',''],[S.classes.length,'Classes',''],[p,'Students present today','s-p'],[a,'Absent or on leave today','s-a'],[S.students.length-m,'Not marked today',''],[tp,'Teachers present today','s-p'],[low,'Low attendance (under 75%)','s-l']].map(([n,l,z])=>`<div class="stat ${z}"><b>${n}</b><small>${l}</small></div>`).join('')+'</div>'+(S.classes.length?`<div class="scroll"><table><thead><tr><th>Class</th><th>Students</th><th>Present today</th></tr></thead><tbody>${S.classes.map(c=>{const st=S.students.filter(x=>x.cid===c.id);return `<tr><td><b>${esc(c.name)}</b></td><td>${st.length}</td><td>${st.filter(x=>ds[x.id]==='P'||ds[x.id]==='T').length}</td></tr>`}).join('')}</tbody></table></div>`:'');
}
const attHtml=sid=>{
  const a=attStats(sid),me=S.students.find(x=>x.id===sid),ms=Object.values(S.matt).filter(m=>me&&m.cid===me.cid&&m.days[sid]!=null).sort((x,y)=>x.ym<y.ym?1:-1);
  let w='';if(a.m>=3&&a.p<75)w=`<div class="warn">⚠ Low attendance: ${a.p}% on daily records. At least 75% is needed. Please attend regularly.</div>`;
  else if(ms.length&&pct(ms[0].days[sid],ms[0].work)<75)w=`<div class="warn">⚠ Low attendance in ${esc(MN(ms[0].ym))}: ${pct(ms[0].days[sid],ms[0].work)}%. At least 75% is needed.</div>`;
  return w+attHtml0(sid);
};
const findStu=(cid,roll,name)=>S.students.find(x=>x.cid===cid&&String(x.roll)===String(roll).trim()&&x.name.trim().toLowerCase()===String(name).trim().toLowerCase());
const rup=renderRes;renderRes=function(){rup();renderTV()};
function renderTV(){if(rT===null)return;({cls:renderCM,asg:renderAsg,exm:renderExm,lib:renderLib,dbt:renderDbt,pch:renderPch})[rView]?.()}
const sorted=cid=>cid?S.students.filter(x=>x.cid===cid).sort(byRoll):[];

/* profile */
function openStu(cid,sid){curClass=cid;curStu=sid;$('#sDate').value=today();$('#sFilter').value='All';$('#sPick').classList.add('hidden');$('#sClass').classList.remove('hidden');renderClass();$('#stName').value=sid;renderMine();$('#myRes').scrollIntoView()}
// Student sign-in: class + roll + name are NOT enough, the student's own 4-digit PIN is also required.
async function studentLogin(me){
  if(!me.dpin){toast('No sign-in PIN is set for this student yet. Ask the principal to set it.');return false}
  if(signedStu===me.id)return true;
  const tr=dTry[me.id]||(dTry[me.id]={n:0,until:0});
  if(Date.now()<tr.until){toast('Too many wrong tries. Wait 30 seconds.');return false}
  const p=await askPin('Sign in, '+me.name,'Enter your 4-digit sign-in PIN.');
  if(p===null)return false;
  if(p===me.dpin){tr.n=0;signedStu=me.id;return true}
  if(++tr.n>=3){tr.n=0;tr.until=Date.now()+30000;toast('Wrong PIN. Locked for 30 seconds.')}else toast('Wrong PIN');
  return false;
}
$('#pfOpen').onclick=async()=>{
  const me=findStu(+$('#pfClass').value,$('#pfRoll').value,$('#pfName').value);
  if(!me)return toast('No profile matches. Check class, roll number and name, or create one.');
  if(await studentLogin(me))openStu(me.cid,me.id);
};
$('#pfNew').onclick=async()=>{
  const cid=+$('#pfClass').value,roll=$('#pfRoll').value.trim(),name=$('#pfName').value.trim();
  if(!cid||!roll||!name)return toast('Choose a class and enter roll number and name');
  if(S.students.some(x=>x.cid===cid&&String(x.roll)===roll))return toast('That roll number already has a profile in this class');
  const p=await askPin('Choose your sign-in PIN','Pick a 4-digit PIN. You will need it every time you open your profile, so remember it.');
  if(!p)return;
  const st={id:Date.now(),cid,roll,name,private:false,pin:'',dpin:p};S.students.push(st);save();signedStu=st.id;toast('Profile created');openStu(cid,st.id)
};

/* assignments */
function renderAsg(){
  const cid=myCid(),st=sorted(cid),l=cid?S.asg.filter(a=>a.cid===cid):[];
  $('#aList').innerHTML=l.length?l.slice().reverse().map(a=>`<article class="item" style="display:block"><div class="row" style="justify-content:space-between"><b>📋 ${esc(a.title)}</b><span class="meta">Due ${esc(a.due||'-')} · ${st.filter(x=>a.sub[x.id]).length} of ${st.length} submitted <button class="icon" data-adel="${a.id}" aria-label="Delete assignment">🗑️</button></span></div>${st.map(x=>`<label class="chk"><input type="checkbox" style="width:auto" data-asub="${a.id}|${x.id}"${a.sub[x.id]?' checked':''}> ${esc(x.roll)}. ${esc(x.name)}</label>`).join('')||'<div class="meta">No students yet.</div>'}</article>`).join(''):'<div class="empty">No assignments for this class yet.</div>';
}
$('#aAdd').onclick=()=>{const cid=myCid(),t=$('#aTitle').value.trim();if(rT===null||!cid)return toast('No class is assigned to you');if(!t)return toast('Add a title first');S.asg.push({id:Date.now(),cid,title:t,due:$('#aDue').value,sub:{},tid:rT});$('#aTitle').value='';save();renderAsg();toast('Assignment added')};
$('#aList').onchange=e=>{const c=e.target.closest('[data-asub]');if(!c||rT===null)return;const [aid,sid]=c.dataset.asub.split('|'),a=S.asg.find(x=>x.id==aid);if(!a||a.cid!==myCid())return;if(c.checked)a.sub[sid]=true;else delete a.sub[sid];save();renderAsg()};
$('#aList').onclick=e=>{const d=e.target.closest('[data-adel]');if(!d||!confirm('Delete this assignment?'))return;const a=S.asg.find(x=>x.id==d.dataset.adel);if(a&&a.cid===myCid()){S.asg=S.asg.filter(x=>x!==a);save();renderAsg()}};

/* exams */
const resBadge=(got,max,pass)=>{const p=pct(got,max),ok=p>=pass;return `<b>${got}/${max}</b> · ${p}% · Grade <b>${grade(p)}</b> · <b class="${ok?'st-P':'st-A'}">${ok?'PASS':'FAIL'}</b>`};
function renderExm(){
  const cid=myCid(),st=sorted(cid),l=cid?S.exams.filter(e=>e.cid===cid):[];
  $('#eList').innerHTML=l.length?l.slice().reverse().map(e=>`<article class="item" style="display:block"><div class="row" style="justify-content:space-between"><b>📝 ${esc(e.title)}${e.subject?' · '+esc(e.subject):''}</b><span class="meta">${e.qs.length} questions · ${e.qs.length*e.per} marks · pass ${e.pass}% <button class="icon" data-edel="${e.id}" aria-label="Delete exam">🗑️</button></span></div><div class="scroll" style="margin-top:8px"><table><thead><tr><th>Roll</th><th>Student</th><th>Result</th></tr></thead><tbody>${st.map(x=>{const r=e.subs[x.id];return `<tr><td>${esc(x.roll)}</td><td>${esc(x.name)}</td><td>${r?resBadge(r.got,r.max,e.pass):'<span class="meta">Not taken yet</span>'}</td></tr>`}).join('')}</tbody></table></div></article>`).join(''):'<div class="empty">No exams given to this class yet.</div>';
}
$('#eAdd').onclick=()=>{
  const cid=myCid(),title=$('#eTitle').value.trim(),per=+$('#ePer').value,pass=+$('#ePass').value;
  if(rT===null||!cid)return toast('No class is assigned to you');
  if(!title||!(per>0)||!(pass>0&&pass<=100))return toast('Enter a title, marks per question and pass percentage');
  const qs=[];
  for(const [i,ln] of $('#eQs').value.split('\n').filter(x=>x.trim()).entries()){
    const p=ln.split('|').map(x=>x.trim()),ans=p.pop(),o=p.slice(1),k='ABCD'.indexOf((ans||'').toUpperCase());
    if(!p[0]||o.length<2||o.length>4||ans.length!==1||k<0||k>=o.length)return toast('Check line '+(i+1)+': question | options | correct letter');
    qs.push({q:p[0],o,a:k});
  }
  if(!qs.length)return toast('Add at least one question');
  S.exams.push({id:Date.now(),cid,title,subject:$('#eSub').value.trim(),per,pass,qs,subs:{},tid:rT});
  ['eTitle','eSub','eQs'].forEach(i=>$('#'+i).value='');save();renderExm();toast('Exam given to the class');
};
$('#eList').onclick=e=>{const d=e.target.closest('[data-edel]');if(!d||!confirm('Delete this exam and its results?'))return;const x=S.exams.find(y=>y.id==d.dataset.edel);if(x&&x.cid===myCid()){S.exams=S.exams.filter(y=>y!==x);save();renderExm()}};
let exCur=null;
// Online exam: shows the questions for the signed-in student (one attempt only)
function startExam(id){
  const e=S.exams.find(x=>x.id===id);if(!e||!curStu||e.subs[curStu])return;exCur=e;
  $('#exT').textContent=e.title+(e.subject?' · '+e.subject:'');$('#exSend').classList.remove('hidden');
  $('#exQ').innerHTML=`<p class="meta">${e.qs.length} questions, ${e.per} mark each. One attempt only.</p>`+e.qs.map((q,i)=>`<div style="margin:14px 0"><b>${i+1}. ${esc(q.q)}</b>${q.o.map((o,j)=>`<label class="chk"><input type="radio" name="q${i}" value="${j}" style="width:auto"> ${'ABCD'[j]}. ${esc(o)}</label>`).join('')}</div>`).join('');
  $('#exDlg').showModal();
}
$('#exSend').onclick=()=>{
  const e=exCur;if(!e||!curStu||e.subs[curStu])return;
  const un=e.qs.filter((q,i)=>!document.querySelector(`input[name="q${i}"]:checked`)).length;
  if(un&&!confirm(un+' question(s) unanswered. Submit anyway?'))return;
  let ok=0;const ans=e.qs.map((q,i)=>{const c=document.querySelector(`input[name="q${i}"]:checked`),v=c?+c.value:-1;if(v===q.a)ok++;return v});
  const r={got:ok*e.per,max:e.qs.length*e.per,at:today(),ans};e.subs[curStu]=r;save();
  $('#exSend').classList.add('hidden');
  $('#exQ').innerHTML=`<div class="total" style="display:block"><b>${pct(r.got,r.max)}%</b><div>${ok} of ${e.qs.length} correct · Grade ${grade(pct(r.got,r.max))} · ${pct(r.got,r.max)>=e.pass?'PASS':'FAIL'}</div></div>`+e.qs.map((q,i)=>`<p><b>${i+1}. ${esc(q.q)}</b><br>${ans[i]===q.a?'<span class="st-P">✔ Correct</span>':`<span class="st-A">✘ ${ans[i]<0?'Not answered':'Your answer: '+esc(q.o[ans[i]])}</span> · Correct: ${esc(q.o[q.a])}`}</p>`).join('');
  renderMine();
};
let signedStu=null;const dTry={};
function duesBlock(me){
  if(signedStu===me.id)return duesHtml(me.id)+'<p><button class="btn" data-dout>Sign out</button></p>';
  return '<h3 style="margin:18px 0 6px">Fees and dues</h3><div class="empty">Fees and dues are private. '+(me.dpin?`<br><button class="btn main" style="margin-top:8px" data-dsign="${me.id}">Sign in as ${esc(me.name)}</button>`:'Your sign-in PIN has not been set yet. Ask the principal.')+'</div>';
}
$('#stTable').onclick=async e=>{
  const b=e.target.closest('[data-exstart]');if(b)return startExam(+b.dataset.exstart);
  if(e.target.closest('[data-dout]')){signedStu=null;renderMine();return}
  const g=e.target.closest('[data-dsign]');if(!g)return;
  const me=S.students.find(x=>x.id==g.dataset.dsign);if(!me||!me.dpin)return;
  const tr=dTry[me.id]||(dTry[me.id]={n:0,until:0});
  if(Date.now()<tr.until)return toast('Too many wrong tries. Wait 30 seconds.');
  const p=await askPin('Sign in, '+me.name,'Enter your 4-digit sign-in PIN from the principal.');
  if(p===null)return;
  if(p===me.dpin){tr.n=0;signedStu=me.id;renderMine()}
  else if(++tr.n>=3){tr.n=0;tr.until=Date.now()+30000;toast('Wrong PIN. Locked for 30 seconds.')}
  else toast('Wrong PIN');
};

/* extras shown to student and parent */
function extraHtml(sid,ro){
  const me=S.students.find(x=>x.id===sid);if(!me)return '';const H=t=>`<h3 style="margin:18px 0 6px">${t}</h3>`;
  const as=S.asg.filter(a=>a.cid===me.cid),ex=S.exams.filter(e=>e.cid===me.cid),du=S.dues.filter(d=>d.sid===sid);
  const pend=du.filter(d=>!d.paid).reduce((a,d)=>a+d.amt,0);
  return H('Assignments')+(as.length?`<div class="scroll"><table><thead><tr><th>Assignment</th><th>Due</th><th>Status</th></tr></thead><tbody>${as.slice().reverse().map(a=>`<tr><td>${esc(a.title)}</td><td>${esc(a.due||'-')}</td><td>${a.sub[sid]?'<b class="st-P">Submitted</b>':'<b class="st-A">Not submitted</b>'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No assignments yet.</div>')
  +H('Exams')+(ex.length?`<div class="scroll"><table><thead><tr><th>Exam</th><th>Result</th></tr></thead><tbody>${ex.slice().reverse().map(e=>{const r=e.subs[sid];return `<tr><td><b>${esc(e.title)}</b>${e.subject?'<br><small>'+esc(e.subject)+'</small>':''}</td><td>${r?resBadge(r.got,r.max,e.pass):ro?'<span class="meta">Not taken yet</span>':`<button class="btn main" data-exstart="${e.id}">Start exam</button>`}</td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">No exams given yet.</div>')
  ;
}

function duesHtml(sid){
  const du=S.dues.filter(d=>d.sid===sid),pend=du.filter(d=>!d.paid).reduce((a,d)=>a+d.amt,0),H=t=>`<h3 style="margin:18px 0 6px">${t}</h3>`;
  return ''+H('Fees and dues')+(du.length?`<div class="stats"><div class="stat s-a"><b>₹${pend}</b><small>Pending</small></div><div class="stat s-p"><b>₹${du.filter(d=>d.paid).reduce((a,d)=>a+d.amt,0)}</b><small>Submitted</small></div></div><div class="scroll"><table><thead><tr><th>Fee</th><th>Amount</th><th>Status</th></tr></thead><tbody>${du.map(d=>`<tr><td>${esc(d.title)}</td><td>₹${d.amt}</td><td>${d.paid?'<b class="st-P">Submitted'+(d.on?' · '+esc(d.on):'')+'</b>':'<b class="st-A">Pending</b>'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No dues for you.</div>');
}
/* principal fees */
function renderFees(){
  const c0=$('#fClass').value;$('#fClass').innerHTML=S.classes.map(c=>`<option value="${c.id}">Class ${esc(c.name)}</option>`).join('');if(c0)$('#fClass').value=c0;
  const s0=$('#fStu').value;$('#fStu').innerHTML=sorted(+$('#fClass').value).map(x=>`<option value="${x.id}">${esc(x.roll)}. ${esc(x.name)}</option>`).join('');if(s0)$('#fStu').value=s0;
  const l=S.dues.filter(d=>S.students.some(x=>x.id===d.sid));
  $('#fStats').innerHTML=`<div class="stat s-a"><b>₹${l.filter(d=>!d.paid).reduce((a,d)=>a+d.amt,0)}</b><small>Total pending</small></div><div class="stat s-p"><b>₹${l.filter(d=>d.paid).reduce((a,d)=>a+d.amt,0)}</b><small>Total submitted</small></div>`;
  $('#fBody').innerHTML=l.length?l.map(d=>{const x=S.students.find(y=>y.id===d.sid);return `<tr><td>${esc(cname(x.cid))}</td><td><b>${esc(x.roll)}. ${esc(x.name)}</b></td><td>${esc(d.title)}</td><td>₹${d.amt}</td><td>${d.paid?'<b class="st-P">Submitted</b>':'<b class="st-A">Pending</b>'}</td><td style="white-space:nowrap"><button class="btn" data-ftog="${d.id}">${d.paid?'Mark pending':'Mark submitted'}</button> <button class="icon" data-fdel="${d.id}" aria-label="Delete due">🗑️</button></td></tr>`}).join(''):'<tr><td colspan="6" class="empty">No dues yet. Add one above.</td></tr>';
}
$('#fClass').onchange=renderFees;
$('#fAdd').onclick=()=>{if(!isPrin)return;const sid=+$('#fStu').value,t=$('#fTitle').value.trim(),amt=Math.round(+$('#fAmt').value);if(!sid||!t||!(amt>0))return toast('Choose a student and enter fee name and amount');S.dues.push({id:Date.now(),sid,title:t,amt,paid:false,on:''});$('#fTitle').value='';$('#fAmt').value='';save();renderFees();toast('Due added')};
$('#fBody').onclick=e=>{if(!isPrin)return;const t=e.target.closest('[data-ftog]'),d=e.target.closest('[data-fdel]');
  if(t){const x=S.dues.find(y=>y.id==t.dataset.ftog);if(x){x.paid=!x.paid;x.on=x.paid?today():'';save();renderFees()}}
  else if(d&&confirm('Delete this due?')){S.dues=S.dues.filter(y=>y.id!=d.dataset.fdel);save();renderFees()}};

/* library */
function dataBlob(u){const [h,b]=u.split(','),mt=h.match(/:(.*?);/)[1],bin=atob(b),a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return URL.createObjectURL(new Blob([a],{type:mt}))}
const bookRow=(b,del)=>`<article class="item"><div><b>${b.type==='pdf'?'📕':'🖼️'} ${esc(b.title)}</b><div class="meta">${esc(b.cid?cname(b.cid):'All classes')} · ${esc(b.date)}</div></div><div style="white-space:nowrap"><button class="btn" data-lread="${b.id}">Read</button>${del?` <button class="icon" data-ldel="${b.id}" aria-label="Delete book">🗑️</button>`:''}</div></article>`;
function renderLib(){const cid=myCid(),l=S.lib.filter(b=>b.cid===0||b.cid===cid);$('#lList').innerHTML=l.length?l.slice().reverse().map(b=>bookRow(b,b.tid==rT)).join(''):'<div class="empty">No books published yet.</div>'}
function renderSL(){const l=S.lib.filter(b=>b.cid===0||b.cid===curClass);$('#slOut').innerHTML=l.length?l.slice().reverse().map(b=>bookRow(b,false)).join(''):'<div class="empty">No books have been published for this class yet.</div>'}
$('#lAdd').onclick=()=>{
  const cid=myCid(),t=$('#lTitle').value.trim(),f=$('#lFile').files[0],to=$('#lTo').value==='0'?0:cid;
  if(rT===null||(to&&!cid))return toast('No class is assigned to you');
  if(!t||!f)return toast('Add a title and choose a file');
  const pdf=f.type==='application/pdf';if(!pdf&&!f.type.startsWith('image/'))return toast('Choose a PDF or a picture');
  const lim=API?10:1.5;if(f.size>lim*1024*1024)return toast('File is too big. Keep it under '+lim+' MB');
  const done=x=>{S.lib.push(Object.assign({id:Date.now(),cid:to,title:t,type:pdf?'pdf':'img',tid:rT,date:today()},x));$('#lTitle').value='';$('#lFile').value='';save();renderLib();toast('Book published')};
  if(API){fetch('/api/files',{method:'POST',headers:{'x-filename':encodeURIComponent(f.name),'content-type':f.type},body:f}).then(r=>r.ok?r.json():Promise.reject()).then(j=>done({fid:j.id,url:j.url})).catch(()=>toast('Upload failed. Check the file type and size'));return}
  const fr=new FileReader();fr.onload=()=>done({data:fr.result});fr.readAsDataURL(f);
};
let bkUrl='';
document.addEventListener('click',e=>{
  const r=e.target.closest('[data-lread]'),d=e.target.closest('[data-ldel]');
  if(r){const b=S.lib.find(x=>x.id==r.dataset.lread);if(!b)return;if(bkUrl.startsWith('blob:'))URL.revokeObjectURL(bkUrl);bkUrl=b.url||dataBlob(b.data);$('#bkT').textContent=b.title;$('#bkA').href=bkUrl;
    $('#bkV').innerHTML=b.type==='pdf'?`<iframe src="${bkUrl}" title="${esc(b.title)}" style="width:100%;height:70vh;border:1px solid var(--line);border-radius:8px"></iframe>`:`<img src="${b.url||b.data}" alt="${esc(b.title)}" style="max-width:100%;border-radius:8px">`;$('#bkDlg').showModal()}
  else if(d&&confirm('Delete this book?')){const b=S.lib.find(x=>x.id==d.dataset.ldel);if(b&&b.tid==rT){if(b.fid&&API)fetch('/api/files/'+b.fid,{method:'DELETE'});S.lib=S.lib.filter(x=>x!==b);save();renderLib()}}
});
$('#bkDlg').onclose=()=>{$('#bkV').innerHTML=''};

// Parent sign-in: class + roll + name are not enough, the child's sign-in PIN (set by the principal) is also required.
async function parentLogin(me){
  if(!me.dpin){toast("The sign-in PIN has not been set for this student. Ask the principal.");return false}
  if(paOk.has(me.id))return true;
  const tr=dTry[me.id]||(dTry[me.id]={n:0,until:0});
  if(Date.now()<tr.until){toast('Too many wrong tries. Wait 30 seconds.');return false}
  const p=await askPin('Parent sign-in',"Enter your child's 4-digit sign-in PIN.");
  if(p===null)return false;
  if(p===me.dpin){tr.n=0;paOk.add(me.id);return true}
  if(++tr.n>=3){tr.n=0;tr.until=Date.now()+30000;toast('Wrong PIN. Locked for 30 seconds.')}else toast('Wrong PIN');
  return false;
}
async function parentDues(me){return duesHtml(me.id)} // already signed in by parentLogin
/* parents */
$('#goParent').onclick=()=>{paStu=null;paMode='';$('#paBox').innerHTML='';show('parents');$('#paClass').innerHTML=S.classes.map(c=>`<option value="${c.id}">Class ${esc(c.name)}</option>`).join('');$('#paOut').innerHTML=''};
$('#paBack').onclick=()=>show('home');
$('#paGo').onclick=async()=>{
  const me=findStu(+$('#paClass').value,$('#paRoll').value,$('#paName').value);if(!me)return toast('No student matches that class, roll number and name');
  if(!(await parentLogin(me)))return;
  paStu=me.id;const rs=S.results.filter(r=>r.sid===me.id);
  $('#paOut').innerHTML=`<div class="total"><b style="font-size:2.4rem">${esc(me.name)}</b><span>${esc(cname(me.cid))} · Roll ${esc(me.roll)}</span></div><h3 style="margin:6px 0">Marks</h3>`+(rs.length?`<div class="scroll"><table><thead><tr><th>Exam</th><th>Subject</th><th>Marks</th><th>%</th><th>Grade</th></tr></thead><tbody>${rs.map(r=>{const p=pct(r.got,r.max);return `<tr><td>${esc(r.exam)}</td><td>${esc(r.subject)}</td><td>${r.got}/${r.max}</td><td>${p}%</td><td><b>${grade(p)}</b></td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">No marks published yet.</div>')+attHtml(me.id)+extraHtml(me.id,true)+await parentDues(me);
};

/* school logo upload (principal, in Customize) */
let pendingLogo;
function showPrev(){const v=pendingLogo!==undefined?pendingLogo:S.logo;const im=$('#sLogoPrev');if(v)im.src=v;else im.removeAttribute('src');im.classList.toggle('hidden',!v);$('#sLogoDel').classList.toggle('hidden',!v);$('#sLogo').value=''}
$('#sLogo').onchange=e=>{
  const f=e.target.files[0];if(!f)return;
  if(!f.type.startsWith('image/')||f.size>5*1024*1024)return toast('Choose an image under 5 MB');
  const fr=new FileReader();
  fr.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,256/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*k));c.height=Math.max(1,Math.round(im.height*k));c.getContext('2d').drawImage(im,0,0,c.width,c.height);pendingLogo=c.toDataURL('image/png');showPrev()};im.onerror=()=>toast('Could not read that image');im.src=fr.result};
  fr.readAsDataURL(f);
};
$('#sLogoDel').onclick=()=>{pendingLogo='';showPrev()};

/* ===== Doubts, parent chat and reports ===== */
const fdt=ts=>new Date(ts).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
const ATT={n:0},DR={},ACC='application/pdf,image/*';
document.addEventListener('input',e=>{const k=e.target&&e.target.dataset&&e.target.dataset.dr;if(k)DR[k]=e.target.value});
function attBtn(a){if(!a)return '';const k=++ATT.n;ATT[k]=a;return `<button class="btn" data-att="${k}">📎 ${esc(a.name)}</button>`}
function openAtt(a){
  if(bkUrl.startsWith('blob:'))URL.revokeObjectURL(bkUrl);
  bkUrl=a.url||dataBlob(a.data);$('#bkT').textContent=a.name;$('#bkA').href=bkUrl;
  $('#bkV').innerHTML=a.type==='application/pdf'?`<iframe src="${bkUrl}" title="${esc(a.name)}" style="width:100%;height:70vh;border:1px solid var(--line);border-radius:8px"></iframe>`:`<img src="${bkUrl}" alt="${esc(a.name)}" style="max-width:100%;border-radius:8px">`;
  $('#bkDlg').showModal();
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-att]');if(b&&ATT[b.dataset.att])openAtt(ATT[b.dataset.att])});
function readAtt(inp){
  return new Promise((res,rej)=>{
    const f=inp&&inp.files&&inp.files[0];if(!f)return res(null);
    const lim=API?10:1;
    if(f.type!=='application/pdf'&&!f.type.startsWith('image/'))return rej(new Error('Attach a PDF or a picture only'));
    if(f.size>lim*1024*1024)return rej(new Error('File is too big. Keep it under '+lim+' MB'));
    if(API){fetch('/api/files',{method:'POST',headers:{'x-filename':encodeURIComponent(f.name),'content-type':f.type},body:f}).then(r=>r.ok?r.json():Promise.reject()).then(j=>res({name:f.name,type:f.type,fid:j.id,url:j.url})).catch(()=>rej(new Error('Upload failed. Check the file type and size')));return}
    const fr=new FileReader();fr.onload=()=>res({name:f.name,type:f.type,data:fr.result});fr.onerror=()=>rej(new Error('Could not read the file'));fr.readAsDataURL(f);
  });
}
const dropAtt=a=>{if(a&&a.fid&&API)fetch('/api/files/'+a.fid,{method:'DELETE'}).catch(()=>{})};
const bub=(who,text,att,at,mine)=>`<div class="msg${mine?' me':''}"><small>${esc(who)} · ${fdt(at)}</small>${text?'<p>'+esc(text)+'</p>':''}${attBtn(att)}</div>`;

/* ---- doubts ---- */
const dLast=d=>d.msgs.length?d.msgs[d.msgs.length-1].at:d.at;
const dState=d=>d.done?['Resolved','st-P']:((d.msgs.length?d.msgs[d.msgs.length-1].by:'s')==='t'?['Answered','st-P']:['Waiting for reply','st-A']);
function dThread(d,v){
  const s=S.students.find(x=>x.id===d.sid),t=S.teachers.find(x=>x.id==d.tid),sn=s?s.name:'Student',tn=t?t.name:'Teacher';
  return [{by:'s',text:d.text,att:d.att,at:d.at}].concat(d.msgs).map(m=>bub(m.by==='s'?(v==='s'?'You':sn):(v==='t'?'You':tn),m.text,m.att,m.at,m.by===v)).join('');
}
/* student side */
function renderDbtS(){
  const gate=$('#dbGate'),form=$('#dbForm');if(!gate)return;
  const me=S.students.find(x=>x.id===curStu);
  if(!me){gate.innerHTML='<div class="empty">Choose your name in the results section above to ask a doubt.</div>';form.classList.add('hidden');return}
  if(signedStu!==me.id){gate.innerHTML=`<div class="empty">Your doubts are private. <br>${me.dpin?`<button class="btn main" style="margin-top:8px" data-dsign="${me.id}">Sign in as ${esc(me.name)}</button>`:'Ask the principal to set your sign-in PIN.'}</div>`;form.classList.add('hidden');return}
  gate.innerHTML='';form.classList.remove('hidden');
  $('#dbAs').textContent='Asking as '+me.roll+'. '+me.name+(me.dpin?'':'. Ask the principal to set your sign-in PIN to keep your doubts private.');
  const cur=$('#dbT').value;
  $('#dbT').innerHTML=S.teachers.map(t=>`<option value="${t.id}">${esc(t.name)}${t.subject&&!t.private?' ('+esc(t.subject)+')':''}</option>`).join('')||'<option value="">No teachers yet</option>';
  if(cur)$('#dbT').value=cur;
  const l=S.doubts.filter(d=>d.sid===me.id).sort((a,b)=>dLast(b)-dLast(a));
  $('#dbList').innerHTML='<h3 style="margin:16px 0 6px">My doubts</h3>'+(l.length?l.map(d=>{const t=S.teachers.find(x=>x.id==d.tid),st=dState(d);
    return `<article class="item" style="display:block"><div class="row" style="justify-content:space-between"><b>❓ ${esc(d.subj||'Doubt')} <span class="meta">to ${esc(t?t.name:'a teacher')}</span></b><b class="${st[1]}">${st[0]}</b></div>${dThread(d,'s')}<textarea rows="2" data-dr="ds${d.id}" placeholder="Add a follow-up message" aria-label="Follow-up message">${esc(DR['ds'+d.id]||'')}</textarea><input type="file" accept="${ACC}" aria-label="Attach a file"><div class="actions"><button class="btn" data-dfu="${d.id}">Send follow-up</button></div></article>`}).join(''):'<div class="empty">You have not asked any doubts yet.</div>');
}
$('#myDbt').addEventListener('click',e=>{const g=e.target.closest('[data-dsign]');if(g)$('#stTable').onclick({target:g})});
$('#dbGo').onclick=async()=>{
  const me=S.students.find(x=>x.id===curStu);if(!me||(signedStu!==me.id))return;
  const tid=+$('#dbT').value,text=$('#dbM').value.trim(),subj=$('#dbS').value.trim();
  if(!S.teachers.some(t=>t.id===tid))return toast('Choose a teacher');
  let att=null;try{att=await readAtt($('#dbF'))}catch(err){return toast(err.message)}
  if(!text&&!att)return toast('Write your doubt or attach a file');
  S.doubts.push({id:Date.now(),sid:me.id,cid:me.cid,tid,subj,text,att,at:Date.now(),msgs:[],done:false});
  $('#dbM').value='';$('#dbS').value='';$('#dbF').value='';save();renderDbtS();toast('Doubt sent to the teacher');
};
$('#dbList').onclick=async e=>{
  const b=e.target.closest('[data-dfu]');if(!b)return;
  const me=S.students.find(x=>x.id===curStu);if(!me||(signedStu!==me.id))return;
  const d=S.doubts.find(x=>x.id==b.dataset.dfu&&x.sid===me.id);if(!d)return;
  const card=b.closest('article'),text=card.querySelector('textarea').value.trim();
  let att=null;try{att=await readAtt(card.querySelector('input[type=file]'))}catch(err){return toast(err.message)}
  if(!text&&!att)return toast('Write a message or attach a file');
  d.msgs.push({by:'s',text,att,at:Date.now()});d.done=false;delete DR['ds'+d.id];save();renderDbtS();toast('Follow-up sent');
};
/* teacher side */
function renderDbt(){
  if(rT===null)return;
  const f=$('#dFilter').value,l=S.doubts.filter(d=>d.tid==rT&&(f==='all'||!d.done)).sort((a,b)=>dLast(b)-dLast(a));
  $('#dList').innerHTML=l.length?l.map(d=>{const s=S.students.find(x=>x.id===d.sid),st=dState(d);
    return `<article class="item" style="display:block"><div class="row" style="justify-content:space-between"><b>❓ ${esc(d.subj||'Doubt')}</b><b class="${st[1]}">${st[0]}</b></div><div class="meta">${esc(s?s.roll+'. '+s.name+' · '+cname(s.cid):'Student removed')}</div>${dThread(d,'t')}<textarea rows="2" data-dr="dt${d.id}" placeholder="Write your answer" aria-label="Your answer">${esc(DR['dt'+d.id]||'')}</textarea><input type="file" accept="${ACC}" aria-label="Attach a file"><div class="actions"><button class="btn" data-dres="${d.id}">${d.done?'Reopen':'Mark resolved'}</button><button class="btn main" data-dsend="${d.id}">Send answer</button></div></article>`}).join(''):'<div class="empty">'+(f==='all'?'No doubts have been sent to you yet.':'No open doubts. You are all caught up.')+'</div>';
}
$('#dFilter').onchange=renderDbt;
$('#dList').onclick=async e=>{
  if(rT===null)return;
  const sd=e.target.closest('[data-dsend]'),rs=e.target.closest('[data-dres]');
  if(rs){const d=S.doubts.find(x=>x.id==rs.dataset.dres&&x.tid==rT);if(d){d.done=!d.done;save();renderDbt()}return}
  if(!sd)return;
  const d=S.doubts.find(x=>x.id==sd.dataset.dsend&&x.tid==rT);if(!d)return;
  const card=sd.closest('article'),text=card.querySelector('textarea').value.trim();
  let att=null;try{att=await readAtt(card.querySelector('input[type=file]'))}catch(err){return toast(err.message)}
  if(!text&&!att)return toast('Write an answer or attach a file');
  d.msgs.push({by:'t',text,att,at:Date.now()});delete DR['dt'+d.id];save();renderDbt();toast('Answer sent');
};

/* ---- parent chat with the class teacher (teacher side) ---- */
function renderPch(){
  if(rT===null)return;
  const cid=myCid();
  if(!cid){$('#pcList').innerHTML='<div class="empty">Parent chat is for class teachers. No class is assigned to you.</div>';return}
  const th=sorted(cid).map(x=>({x,l:S.pchat.filter(m=>m.sid===x.id).sort((a,b)=>a.at-b.at)})).filter(o=>o.l.length).sort((a,b)=>b.l[b.l.length-1].at-a.l[a.l.length-1].at);
  $('#pcList').innerHTML=th.length?th.map(o=>{const wait=o.l[o.l.length-1].by==='p';
    return `<article class="item" style="display:block"><div class="row" style="justify-content:space-between"><b>👪 Parent of ${esc(o.x.roll)}. ${esc(o.x.name)}</b>${wait?'<b class="st-A">Waiting for your reply</b>':'<span class="meta">Replied</span>'}</div>${o.l.map(m=>bub(m.by==='p'?'Parent':'You',m.text,m.att,m.at,m.by==='t')).join('')}<textarea rows="2" data-dr="tc${o.x.id}" placeholder="Reply to the parent" aria-label="Reply to the parent">${esc(DR['tc'+o.x.id]||'')}</textarea><input type="file" accept="${ACC}" aria-label="Attach a file"><div class="actions"><button class="btn main" data-csend="${o.x.id}">Send reply</button></div></article>`}).join(''):'<div class="empty">No parent messages yet for Class '+esc((S.classes.find(c=>c.id===cid)||{}).name||'')+'.</div>';
}
$('#pcList').onclick=async e=>{
  const b=e.target.closest('[data-csend]');if(!b||rT===null)return;
  const x=S.students.find(y=>y.id==b.dataset.csend&&y.cid===myCid());if(!x)return;
  const card=b.closest('article'),text=card.querySelector('textarea').value.trim();
  let att=null;try{att=await readAtt(card.querySelector('input[type=file]'))}catch(err){return toast(err.message)}
  if(!text&&!att)return toast('Write a reply or attach a file');
  S.pchat.push({id:Date.now(),sid:x.id,by:'t',text,att,at:Date.now()});delete DR['tc'+x.id];save();renderPch();toast('Reply sent');
};

/* ---- parent side: chat and report ---- */
let paStu=null,paMode='';const paOk=new Set();
const RCATS=['Complaint about a teacher','Complaint about a student','Facility problem','Fees or office','Safety or bullying','Other'];
['paClass','paRoll','paName'].forEach(i=>$('#'+i).addEventListener('input',()=>{paStu=null;if(paMode==='chat'){paMode='';$('#paBox').innerHTML=''}}));
function renderPaChat(full){
  const me=S.students.find(x=>x.id===paStu);if(!me||paMode!=='chat')return;
  const c=S.classes.find(x=>x.id===me.cid),t=c&&S.teachers.find(x=>x.id==c.teacher);
  if(full||!$('#pcMsgs')){
    $('#paBox').innerHTML=`<div class="panel"><h3>💬 Chat with the class teacher</h3><p class="meta">${t?'Class teacher of '+esc(cname(me.cid))+': <b>'+esc(t.name)+'</b>':'No class teacher is assigned to this class yet.'} · About ${esc(me.name)}. Your messages go to the class teacher.</p><div id="pcMsgs"></div><label for="pcTxt">Your message</label><textarea id="pcTxt" rows="3" maxlength="1500" data-dr="pc${me.id}"></textarea><label for="pcFile">Attach a PDF or picture (optional)</label><input type="file" id="pcFile" accept="${ACC}"><div class="actions"><button class="btn main" id="pcSend">Send message</button></div></div>`;
    $('#pcTxt').value=DR['pc'+me.id]||'';
  }
  const l=S.pchat.filter(m=>m.sid===me.id).sort((a,b)=>a.at-b.at);
  $('#pcMsgs').innerHTML=l.length?l.map(m=>bub(m.by==='p'?'You (parent)':(t?t.name:'Class teacher'),m.text,m.att,m.at,m.by==='p')).join(''):'<div class="empty">No messages yet. Write to the class teacher below.</div>';
}
function renderPaRep(){
  const me=S.students.find(x=>x.id===paStu);
  $('#paBox').innerHTML=`<div class="panel"><h3>🚩 Report a problem</h3><p class="meta">Your report goes to the principal.</p><div class="grid"><div><label for="rpCat">What is it about?</label><select id="rpCat">${RCATS.map(c=>`<option>${esc(c)}</option>`).join('')}</select></div><div><label for="rpName">Your name</label><input id="rpName" maxlength="80"></div></div><label for="rpAbout">Teacher, student or place concerned (optional)</label><input id="rpAbout" maxlength="100"><label for="rpChild">Your child's name and class (optional)</label><input id="rpChild" maxlength="100" value="${me?esc(me.name+', '+cname(me.cid)):''}"><label for="rpSub">Subject</label><input id="rpSub" maxlength="100" placeholder="e.g. Broken fan in classroom"><label for="rpTxt">Details</label><textarea id="rpTxt" rows="4" maxlength="2000"></textarea><label for="rpFile">Attach a photo or PDF (optional)</label><input type="file" id="rpFile" accept="${ACC}"><div class="actions"><button class="btn main" id="rpSend">Submit report</button></div></div>`;
}
$('#paChatBtn').onclick=async()=>{
  const me=S.students.find(x=>x.id===paStu);
  if(!me)return toast("First enter your child's details and press Open dashboard, then start the chat");
  if(me.dpin&&!paOk.has(me.id)){
    const tr=dTry[me.id]||(dTry[me.id]={n:0,until:0});
    if(Date.now()<tr.until)return toast('Too many wrong tries. Wait 30 seconds.');
    const p=await askPin('Chat with the class teacher',"Enter the student's sign-in PIN to open the chat.");
    if(p===null)return;
    if(p!==me.dpin){if(++tr.n>=3){tr.n=0;tr.until=Date.now()+30000;toast('Wrong PIN. Locked for 30 seconds.')}else toast('Wrong PIN');return}
    tr.n=0;paOk.add(me.id);
  }
  paMode='chat';renderPaChat(true);$('#paBox').scrollIntoView({behavior:'smooth',block:'start'});
};
$('#paRepBtn').onclick=()=>{paMode='rep';renderPaRep();$('#paBox').scrollIntoView({behavior:'smooth',block:'start'})};
$('#paBox').addEventListener('click',async e=>{
  const id=e.target.id;
  if(id==='rpAgain'){renderPaRep();return}
  if(id==='pcSend'){
    const me=S.students.find(x=>x.id===paStu);if(!me)return;
    const c=S.classes.find(x=>x.id===me.cid);if(!c||!S.teachers.some(t=>t.id==c.teacher))return toast('No class teacher is assigned to this class yet');
    const text=$('#pcTxt').value.trim();let att=null;
    try{att=await readAtt($('#pcFile'))}catch(err){return toast(err.message)}
    if(!text&&!att)return toast('Write a message or attach a file');
    S.pchat.push({id:Date.now(),sid:me.id,by:'p',text,att,at:Date.now()});delete DR['pc'+me.id];save();renderPaChat(true);toast('Message sent to the class teacher');
  }
  if(id==='rpSend'){
    const b=e.target,name=$('#rpName').value.trim(),subj=$('#rpSub').value.trim(),text=$('#rpTxt').value.trim();
    if(!name||!subj||!text)return toast('Enter your name, a subject and the details');
    b.disabled=true;let att=null;
    try{att=await readAtt($('#rpFile'))}catch(err){b.disabled=false;return toast(err.message)}
    S.reports.push({id:Date.now(),cat:$('#rpCat').value,name,child:$('#rpChild').value.trim(),about:$('#rpAbout').value.trim(),subj,text,att,at:Date.now(),status:'New',note:''});
    save();paMode='';$('#paBox').innerHTML='<div class="panel"><h3>Report sent</h3><p>Thank you. Your report has been sent to the principal.</p><div class="actions"><button class="btn" id="rpAgain">Send another report</button></div></div>';toast('Report sent to the principal');
  }
});

/* ---- principal: reports ---- */
const RST=['New','In progress','Resolved'],RSC={'New':'st-A','In progress':'st-L','Resolved':'st-P'};
function repBadge(){const n=S.reports.filter(r=>r.status==='New').length;$('#pt-rep').textContent='Reports'+(n?' ('+n+' new)':'')}
function renderRep(){
  repBadge();
  if(!$('#rpFC').options.length)$('#rpFC').innerHTML='<option value="">All types</option>'+RCATS.map(c=>`<option>${esc(c)}</option>`).join('');
  const fs=$('#rpFS').value,fc=$('#rpFC').value;
  $('#rpStats').innerHTML=RST.map(s=>`<div class="stat ${RSC[s].replace('st-','s-').toLowerCase()}"><b>${S.reports.filter(r=>r.status===s).length}</b><small>${s}</small></div>`).join('');
  const l=S.reports.filter(r=>(!fs||r.status===fs)&&(!fc||r.cat===fc)).sort((a,b)=>b.at-a.at);
  $('#rpList').innerHTML=l.length?l.map(r=>`<article class="item" style="display:block"><div class="row" style="justify-content:space-between"><b>🚩 ${esc(r.cat)}: ${esc(r.subj)}</b><b class="${RSC[r.status]||''}">${esc(r.status)}</b></div><div class="meta">${fdt(r.at)} · From ${esc(r.name)}${r.child?' · Child: '+esc(r.child):''}${r.about?' · Concerning: '+esc(r.about):''}</div><p>${esc(r.text)}</p>${attBtn(r.att)}<div class="grid" style="margin-top:8px"><select data-rst="${r.id}" aria-label="Status">${RST.map(s=>`<option${s===r.status?' selected':''}>${s}</option>`).join('')}</select><input data-rnote="${r.id}" value="${esc(r.note||'')}" maxlength="300" placeholder="Your note or action taken (private)" aria-label="Your private note"></div><div class="actions"><button class="icon" data-rdel2="${r.id}" aria-label="Delete report">🗑️</button></div></article>`).join(''):'<div class="empty">No reports to show.</div>';
}
$('#rpFS').onchange=renderRep;$('#rpFC').onchange=renderRep;
$('#rpList').onchange=e=>{
  if(!isPrin)return;
  const s=e.target.closest('[data-rst]'),n=e.target.closest('[data-rnote]');
  if(s){const r=S.reports.find(x=>x.id==s.dataset.rst);if(r&&RST.includes(s.value)){r.status=s.value;save();renderRep()}}
  else if(n){const r=S.reports.find(x=>x.id==n.dataset.rnote);if(r){r.note=n.value.trim();save();toast('Note saved')}}
};
$('#rpList').onclick=e=>{
  if(!isPrin)return;const d=e.target.closest('[data-rdel2]');if(!d||!confirm('Delete this report?'))return;
  const r=S.reports.find(x=>x.id==d.dataset.rdel2);if(r){dropAtt(r.att);S.reports=S.reports.filter(x=>x!==r);save();renderRep()}
};

/* shared database sync (whole portal state in one document) */
function setSync(t){$('#syncNote').textContent=t}
// Optional: saves to a server if one exists. With no server it is skipped and data stays on this device.
function pushRemote(){
  if(!DB&&!API)return;dirty=true;clearTimeout(pushT);
  pushT=setTimeout(async()=>{try{lastJson=JSON.stringify(S);
    if(API){const r=await fetch('/api/state',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({json:lastJson})});if(!r.ok)throw 0;ver=(await r.json()).version;setSync('Saved to the server database')}
    else{await DB.doc('portal/state').set({json:lastJson});setSync('Saved to the shared database')}
    dirty=false}catch(e){setSync('Save failed. Changes are kept on this device only.')}},500);
}
function refreshAll(){render();renderNotices();renderPT();renderClasses();if(curClass!==null)renderClass();renderRes();renderCM();renderPS();renderPA();renderDash();renderTV();try{if(paMode==='chat')renderPaChat();if(isPrin)renderRep()}catch(e){}if(curClass!==null){renderCA();renderSL()}}
async function legacySync(){
  try{
    if(typeof claude==='undefined'){setSync('Saved on this device only');return}
    const db=await claude.use('db');
    if(!db){setSync('Saved on this device only (shared database not available for this viewer)');return}
    DB=db;setSync('Connected to the shared database');
    db.doc('portal/state').onSnapshot(snap=>{
      const d=snap.exists?snap.data():null;
      if(d&&d.json){if(d.json===lastJson||dirty)return;try{const kp=S.pPin,kr=S.pRec;const r=JSON.parse(d.json);if(r.ver!==2){pushRemote();return}S=r;lastJson=d.json;fix();if(!S.pPin&&kp){S.pPin=kp;S.pRec=kr;pushRemote()}applyLook();refreshAll()}catch(e){}}
      else pushRemote();
    },()=>setSync('Shared database unavailable. Saved on this device only.'));
  }catch(e){setSync('Saved on this device only')}
}
function adopt(json){try{const kp=S.pPin,kr=S.pRec,r=JSON.parse(json);if(r.ver!==2)return;S=r;lastJson=json;fix();if(!S.pPin&&kp){S.pPin=kp;S.pRec=kr;pushRemote()}applyLook();refreshAll()}catch(e){}}
async function poll(){if(dirty)return;try{const r=await fetch('/api/state?since='+ver,{cache:'no-store'});if(!r.ok)return;const d=await r.json();if(d.unchanged||d.json==null)return;ver=d.version;if(d.json!==lastJson)adopt(d.json)}catch(e){}}
(async()=>{
  if(location.protocol==='http:'||location.protocol==='https:'){
    try{const r=await fetch('/api/state?since=-1',{cache:'no-store'});if(r.ok){const d=await r.json();API=true;ver=d.version;setSync('Connected to the server database');if(d.json)adopt(d.json);else pushRemote();setInterval(poll,4000);return}}catch(e){}
  }
  legacySync();
})();

window.addEventListener('error',e=>toast('Something went wrong: '+(e.message||'error')));window.addEventListener('unhandledrejection',e=>toast('Something went wrong: '+((e.reason&&e.reason.message)||'error')));
/* Dialog buttons without form submission.
   Hosted pages are often sandboxed so that forms cannot submit; native submit would then do nothing at all. */
document.querySelectorAll('dialog form').forEach(f=>{
  const go=ev=>{
    ev.preventDefault();
    if(!f.reportValidity())return;
    const se=new Event('submit',{cancelable:true,bubbles:true});
    f.dispatchEvent(se);
    if(!se.defaultPrevented)f.closest('dialog').close();
  };
  f.querySelectorAll('button[type=submit]').forEach(b=>b.addEventListener('click',go));
  f.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT')go(e)});
});

$('#date').value=today();
applyLook();render();renderNotices();renderDash();
