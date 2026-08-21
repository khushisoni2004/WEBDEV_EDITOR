const socket = window.createClassroomSocket(); const $=id=>document.getElementById(id); let roomId='', locked=false, pendingStudentName='', joinedLiveClass=false, joinRetryTimer=null;
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

function scheduleLiveJoinRetry() {
  clearTimeout(joinRetryTimer);
  joinRetryTimer = setTimeout(() => {
    if (pendingStudentName && socket.connected && !joinedLiveClass) joinLiveClass(pendingStudentName);
  }, 8000);
}

function joinLiveClass(name) {
  socket.emit('join-student',{roomId:'',studentName:name},res=>{
    if(res?.ok){
      roomId=res.roomId;
      joinedLiveClass=!res.practiceOnly;
      $('roomCode').textContent=res.practiceOnly?'PRACTICE':roomId;
      $('teacherInfo').textContent=res.practiceOnly?'Looking for an active teacher class…':'Teacher: '+res.teacherName;
      $('teacherTitle').textContent=res.practiceOnly?'Personal Practice':res.teacherName+' — Live Code';
      const saved=JSON.parse(safeStorage.getItem(`codelab:${roomId}`)||'null');
      const isEmptyDraft=!saved||(!saved.html?.trim()&&!saved.css?.trim()&&!saved.js?.trim());
      setMine(isEmptyDraft?res.myCode:saved);
      setTeacher(res.teacherCode);
      if(res.teacherLastRun?.mode==='js')renderCapturedOutput($('wConsole'),res.teacherLastRun.output);
      if(res.practiceOnly){
        scheduleLiveJoinRetry();
      }else{
        clearTimeout(joinRetryTimer);
        toast('Joined classroom successfully');
      }
    }else{
      enterLocalPractice(name);
      scheduleLiveJoinRetry();
    }
  });
}

$('joinForm').onsubmit=e=>{
  e.preventDefault();
  const name = $('studentName').value.trim();
  if(!name) return;

  pendingStudentName=name;
  $('joinModal').style.display='none';
  if(socket.connected){
    joinLiveClass(name);
  }else{
    $('roomCode').textContent='JOINING';
    $('teacherInfo').textContent='Connecting to your live teacher…';
    toast('Connecting to live classroom…');
    setTimeout(()=>{
      if(!socket.connected && pendingStudentName===name){
        enterLocalPractice(name);
        scheduleLiveJoinRetry();
      }
    },20000);
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
  const name = pendingStudentName || $('studentName').value.trim();
  if(name && !joinedLiveClass) joinLiveClass(name);
});

socket.on('disconnect',()=>{joinedLiveClass=false;$('connection').textContent='Reconnecting';$('connection').className='badge offline';if($('modalConnectionState')){$('modalConnectionState').textContent='Disconnected';$('modalConnectionState').style.color='#fca5a5';}});
socket.on('connect_error',(err)=>{if($('modalConnectionState')){$('modalConnectionState').textContent='Error: '+err.message;$('modalConnectionState').style.color='#fca5a5';}});
attachConsole($('mPreview'),$('mConsole'));
