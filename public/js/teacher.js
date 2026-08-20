const socket = io();
let roomId = "", selectedStudentId = "", allStudents = [], focused = false;
const $ = id => document.getElementById(id);
const teacherEditors = {html:$('tHtml'), css:$('tCss'), js:$('tJs')};
const studentEditors = {html:$('sHtml'), css:$('sCss'), js:$('sJs')};
const studentCache = new Map();
const teacherCode = () => Object.fromEntries(Object.entries(teacherEditors).map(([key, el]) => [key, el.value]));
const setTeacherCode = code => { Object.entries(teacherEditors).forEach(([key, el]) => el.value = code[key] || ''); renderPreview($('tPreview'), code); };
const setStudentCode = code => { Object.entries(studentEditors).forEach(([key, el]) => el.value = code[key] || ''); };
const sendTeacherCode = debounce(() => { const code = teacherCode(); socket.emit('teacher-code-update', {code}); if ($('autoRun').checked) runTeacherCode(); }, 220);
Object.values(teacherEditors).forEach(el => el.addEventListener('input', sendTeacherCode));
$('startForm').addEventListener('submit', event => { event.preventDefault(); socket.emit('create-room', {teacherName:$('teacherName').value, classTitle:$('classTitle').value}, res => { if (!res?.ok) return toast('Could not create room.'); roomId=res.roomId; $('roomCode').textContent=roomId; setTeacherCode(res.teacherCode); $('startModal').style.display='none'; toast(`${res.classTitle} created`); }); });
$('copyCode').addEventListener('click', async () => { try { await navigator.clipboard.writeText(roomId); toast('Room code copied'); } catch { toast(roomId); } });
function runTeacherCode(){
  const fullCode = teacherCode();
  const mode = activeLanguage('teacher');
  const code = modeCode(fullCode, mode);
  const output = [];
  if (mode === 'js') runCode($('tPreview'), $('tConsole'), code, payload => output.push(payload));
  else { clearConsole($('tConsole')); renderPreview($('tPreview'), code); }
  setTimeout(() => socket.emit('teacher-run', { ...fullCode, mode, output, runVersion: Date.now() }), 100);
}
$('runTeacher').addEventListener('click', runTeacherCode);
$('clearTeacherConsole').addEventListener('click', () => clearConsole($('tConsole')));
$('resetTeacher').addEventListener('click', () => { if (!confirm('Reset your teaching code?')) return; setTeacherCode(starter); socket.emit('teacher-code-update',{code:starter}); });
$('downloadTeacher').addEventListener('click', () => downloadProject(teacherCode(), 'teacher-project'));
$('focusMode').addEventListener('click', () => { focused=!focused; socket.emit('teacher-focus',{focused}); $('focusMode').textContent=focused?'Exit Focus':'Focus Mode'; toast(focused?'Focus mode sent to students':'Focus mode ended'); });
$('announce').addEventListener('click', () => { const message=prompt('Message for students'); if (message) { socket.emit('teacher-announcement',{message}); toast('Announcement sent'); } });
$('lockPractice').addEventListener('click', () => { const locked=$('lockPractice').dataset.locked!=='true'; $('lockPractice').dataset.locked=String(locked); $('lockPractice').textContent=locked?'Resume Practice':'Lock Practice'; socket.emit('set-lock',{locked}); toast(locked?'Student editors locked':'Student editors resumed'); });
$('endClass').addEventListener('click', () => { if (confirm('End this live classroom for everyone?')) { socket.emit('end-room'); location.href='/'; } });
$('studentSearch').addEventListener('input', renderStudents);
function renderStudents() { const query=$('studentSearch').value.toLowerCase(); const list=allStudents.filter(s=>s.name.toLowerCase().includes(query)); $('sideCount').textContent=allStudents.length; $('studentCount').textContent=`${allStudents.length} student${allStudents.length===1?'':'s'}`; $('students').innerHTML=list.length ? list.map(s=>`<button class="student-item ${s.socketId===selectedStudentId?'active':''}" data-id="${s.socketId}"><span class="avatar">${escapeHtml(s.name.slice(0,2).toUpperCase())}</span><span class="student-meta"><b>${escapeHtml(s.name)}</b><small>● ${s.language ? 'Editing '+s.language.toUpperCase() : 'Online'}</small></span></button>`).join('') : '<div class="empty">👥<p>Waiting for students…</p></div>'; document.querySelectorAll('.student-item').forEach(btn=>btn.onclick=()=>selectStudent(btn.dataset.id)); }
function selectStudent(id) { selectedStudentId=id; const cached=studentCache.get(id); if(cached) showSelected(id,cached.name,cached.code,cached.lastRun); socket.emit('request-student-code',{socketId:id},res=>{ if(!res?.ok) return toast('Student is no longer connected.'); studentCache.set(id,res); showSelected(id,res.name,res.code,res.lastRun); }); }
function showSelected(id,name,code,lastRun) { if(id!==selectedStudentId) return; $('monitorEmpty').classList.add('hidden'); $('monitorContent').classList.remove('hidden'); $('selectedName').textContent=`${name} Workspace`; setStudentCode(code); if(lastRun) { const previewCode=modeCode(lastRun,lastRun.mode || 'html'); if(lastRun.mode === 'js') runCode($('sPreview'),$('sConsole'),previewCode); else renderPreview($('sPreview'),previewCode); } renderStudents(); }
function escapeHtml(text){return String(text).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));}
socket.on('connect',()=>{ $('connection').textContent='● LIVE'; $('connection').className='badge online'; });
socket.on('disconnect',()=>{ $('connection').textContent='Reconnecting'; $('connection').className='badge offline'; });
socket.on('student-list',list=>{allStudents=list; renderStudents();});
socket.on('student-code-update',data=>{const previous=studentCache.get(data.socketId)||{};studentCache.set(data.socketId,{...previous,name:data.name,code:data.code,lastRun:data.lastRun||previous.lastRun}); if(data.socketId===selectedStudentId) showSelected(data.socketId,data.name,data.code,data.lastRun||previous.lastRun);});
socket.on('student-code-change',data=>{const previous=studentCache.get(data.socketId)||{name:data.name,code:{html:'',css:'',js:''}};const code={...previous.code,[data.language]:data.code};studentCache.set(data.socketId,{...previous,name:data.name,code});if(data.socketId===selectedStudentId){setStudentCode(code);$('selectedName').textContent=`${data.name} Workspace · ${data.language.toUpperCase()} typing`;}});
socket.on('student-run',data=>{const previous=studentCache.get(data.socketId)||{};studentCache.set(data.socketId,{...previous,name:data.name,code:{html:data.html,css:data.css,js:data.js},lastRun:data});if(data.socketId===selectedStudentId){setStudentCode({html:data.html,css:data.css,js:data.js});const previewCode=modeCode(data,data.mode || 'html');if(data.mode === 'js'){runCode($('sPreview'),$('sConsole'),previewCode);setTimeout(()=>renderCapturedOutput($('sConsole'),data.output),120);}else{clearConsole($('sConsole'));renderPreview($('sPreview'),previewCode);}toast(`${data.name} ran ${data.mode || 'HTML'}`);}});
socket.on('student-activity',data=>{const student=allStudents.find(s=>s.socketId===data.socketId); if(student){student.language=data.language;student.lastActivity=data.lastActivity;renderStudents();}});
socket.on('teacher-run',()=>{});
socket.on('student-left',({socketId})=>{studentCache.delete(socketId);allStudents=allStudents.filter(s=>s.socketId!==socketId);renderStudents();if(selectedStudentId===socketId){selectedStudentId='';$('monitorContent').classList.add('hidden');$('monitorEmpty').classList.remove('hidden');}toast('Student disconnected');});
attachConsole($('tPreview'),$('tConsole'));
