const socket = typeof io !== 'undefined' ? io(window.BACKEND_URL || undefined, { transports: ['websocket', 'polling'], timeout: 15000, reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 5000 }) : { connected: false, on: () => {}, emit: () => {} }; const $=id=>document.getElementById(id); let roomId='', locked=false;
const mine={html:$('mHtml'),css:$('mCss'),js:$('mJs')}; const watch={html:$('wHtml'),css:$('wCss'),js:$('wJs')};
const mineCode=()=>Object.fromEntries(Object.entries(mine).map(([key,el])=>[key,el.value]));
function setMine(code, render=true){Object.entries(mine).forEach(([key,el])=>el.value=code[key]||'');if(render)renderPreview($('mPreview'),code);}
function setTeacher(code){Object.entries(watch).forEach(([key,el])=>el.value=code[key]||'');renderPreview($('wPreview'),code);checkTeacherCodeEmpty(code);}
function checkTeacherCodeEmpty(code){
  const isEmpty = !code || (!code.html?.trim() && !code.css?.trim() && !code.js?.trim());
  const overlay = $('teacherOfflineOverlay');
  if (overlay) overlay.style.display = isEmpty ? 'flex' : 'none';
}
function persist(){safeStorage.setItem(`codelab:${roomId}`,JSON.stringify(mineCode()));}
function sendMine(){const code=mineCode();persist();if(socket.connected){socket.emit('student-code-update',{code});Object.entries(code).forEach(([language,value])=>socket.emit('student-code-change',{language,code:value}));socket.emit('student-activity',{language:activeLanguage('mine')});}if($('autoRun').checked)runStudentCode();}
const sendMineDebounced=debounce(sendMine,220); Object.values(mine).forEach(el=>el.addEventListener('input',sendMineDebounced));
function runStudentCode(){const fullCode=mineCode();const mode=activeLanguage('mine');const code=modeCode(fullCode,mode);const output=[];const runVersion=Date.now();let sent=false;const publishRun=()=>{if(sent)return;sent=true;if(socket.connected){socket.emit('student-run',{roomId,studentId:socket.id,...fullCode,mode,output,runVersion});}};if(mode==='js'){$('mPreview').addEventListener('load',()=>setTimeout(publishRun,160),{once:true});runCode($('mPreview'),$('mConsole'),code,payload=>output.push(payload));setTimeout(publishRun,900);}else{renderPreview($('mPreview'),code);publishRun();}}
$('runStudent').onclick=runStudentCode;
$('clearStudentConsole').onclick=()=>clearConsole($('mConsole'));
$('resetStudent').onclick=()=>{if(confirm('Reset your code? Your current changes will be removed.')){setMine(starter);sendMine();}};
$('roomInput').oninput=e=>e.target.value=e.target.value.toUpperCase();

function enterLocalPractice(name) {
  roomId = 'PRACTICE';
  $('roomCode').textContent = 'PRACTICE';
  $('teacherInfo').textContent = 'Personal practice — offline mode';
  $('teacherTitle').textContent = 'Personal Practice';
  const saved = JSON.parse(safeStorage.getItem(`codelab:${roomId}`) || 'null');
  const isEmptyDraft = !saved || (!saved.html?.trim() && !saved.css?.trim() && !saved.js?.trim());
  setMine(isEmptyDraft ? starter : saved);
  setTeacher(starter);
}

$('joinForm').onsubmit=e=>{
  e.preventDefault();
  const name = $('studentName').value.trim();
  if(!name) return;

  $('joinModal').style.display='none';
  const codeToJoin = $('roomInput').value.trim().toUpperCase();

  if(socket.connected){
    socket.emit('join-student',{roomId:codeToJoin,studentName:name},res=>{
      if(res?.ok){
        roomId=res.roomId;
        $('roomCode').textContent=res.practiceOnly?'PRACTICE':roomId;
        $('teacherInfo').textContent=res.practiceOnly?'Personal practice — no teacher connected':'Teacher: '+res.teacherName;
        $('teacherTitle').textContent=res.practiceOnly?'Personal Practice':res.teacherName+' — Live Code';
        const saved=JSON.parse(safeStorage.getItem(`codelab:${roomId}`)||'null');
        const isEmptyDraft=!saved||(!saved.html?.trim()&&!saved.css?.trim()&&!saved.js?.trim());
        setMine(isEmptyDraft?res.myCode:saved);
        setTeacher(res.teacherCode);
        if(res.teacherLastRun?.mode==='js')renderCapturedOutput($('wConsole'),res.teacherLastRun.output);
        toast(res.practiceOnly?'Practice workspace ready':'Joined classroom successfully');
      }else{
        enterLocalPractice(name);
        toast(res?.message||'Entered practice mode');
      }
    });
  }else{
    enterLocalPractice(name);
    toast('Practice workspace ready (Offline)');
  }
};

$('saveProject').onclick=()=>{persist();toast('Project saved locally');};
$('downloadProject').onclick=()=>downloadProject(mineCode(),'student-project');
$('leaveClass').onclick=()=>{if(confirm('Leave this classroom?'))location.href='/';};
socket.on('teacher-code-update',({teacherName,code})=>{$('teacherInfo').textContent='Teacher: '+teacherName;$('teacherTitle').textContent=teacherName+' — Live Code';setTeacher(code);});
socket.on('teacher-run',data=>{checkTeacherCodeEmpty(data);const previewCode=modeCode(data,data.mode||'html');if(data.mode==='js'){runCode($('wPreview'),$('wConsole'),previewCode);setTimeout(()=>renderCapturedOutput($('wConsole'),data.output),120);}else{clearConsole($('wConsole'));renderPreview($('wPreview'),previewCode);}});
socket.on('practice-lock',({locked:value})=>{locked=value;Object.values(mine).forEach(el=>el.readOnly=locked);toast(locked?'Teacher paused practice':'Practice resumed');});
socket.on('announcement',({message})=>toast('Teacher: '+message));
socket.on('teacher-focus',({focused})=>{if(focused){document.querySelector('[data-view="teacherView"]').click();toast('Teacher focus mode is on');}});
socket.on('room-closed',({message})=>{alert(message||'Live room ended.');location.href='/';});

socket.on('connect',()=>{
  $('connection').textContent='● Connected';
  $('connection').className='badge online';
  if($('modalConnectionState')){$('modalConnectionState').textContent='Connected';$('modalConnectionState').style.color='#86efac';}
  const name = $('studentName').value.trim();
  if(name){
    const codeToJoin = $('roomInput').value.trim().toUpperCase() || roomId;
    const targetRoom = (codeToJoin === 'PRACTICE') ? '' : codeToJoin;
    socket.emit('join-student',{roomId:targetRoom,studentName:name},res=>{
      if(res?.ok){
        roomId=res.roomId;
        $('roomCode').textContent=res.practiceOnly?'PRACTICE':roomId;
        $('teacherInfo').textContent=res.practiceOnly?'Personal practice — no teacher connected':'Teacher: '+res.teacherName;
        $('teacherTitle').textContent=res.practiceOnly?'Personal Practice':res.teacherName+' — Live Code';
        if(!res.practiceOnly){
          setTeacher(res.teacherCode);
          if(res.teacherLastRun?.mode==='js')renderCapturedOutput($('wConsole'),res.teacherLastRun.output);
          toast('Connected to live classroom!');
        }
      }
    });
  }
});

socket.on('disconnect',()=>{$('connection').textContent='Reconnecting';$('connection').className='badge offline';if($('modalConnectionState')){$('modalConnectionState').textContent='Disconnected';$('modalConnectionState').style.color='#fca5a5';}});
socket.on('connect_error',(err)=>{if($('modalConnectionState')){$('modalConnectionState').textContent='Error: '+err.message;$('modalConnectionState').style.color='#fca5a5';}});
attachConsole($('mPreview'),$('mConsole'));
