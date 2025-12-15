// TrainerBOT — clean timer implementation
const $ = id => document.getElementById(id)

const repsEl = $('reps')
const setsEl = $('sets')
const restEl = $('rest')
const generateBtn = $('generate')
const startBtn = $('start')
const pauseBtn = $('pause')
const resetBtn = $('reset')
const saveBtn = $('save')
const loadBtn = $('load')
const notifyCheckbox = $('notify')

const routineList = $('routineList')
const countdownEl = $('countdown')
const timerTitle = $('timerTitle')
const progressFill = $('progressFill')

let routine = []
let currentIndex = -1
let intervalId = null
let remaining = 0
let isPaused = false

function formatTime(s){
  const m = Math.floor(s/60)
  const sec = s%60
  return String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0')
}

function getSelectedExercises(){
  return Array.from(document.querySelectorAll('input[name="exercise"]:checked')).map(i=>i.value)
}

function niceName(key){
  if(!key) return ''
  return key.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ')
}

function generateRoutine(){
  const selected = getSelectedExercises()
  const reps = Math.max(1, parseInt(repsEl.value)||1)
  const sets = Math.max(1, parseInt(setsEl.value)||1)

  const workSecondsPerRep = 4
  const restAfterExercise = 60
  const restAfterSet = restEl.value

  const exercises = selected.length ? selected : Array.from(document.querySelectorAll('input[name="exercise"]')).map(i=>i.value)

  // Build routine so that we complete all sets for one exercise before moving to the next
  routine = []
  for(let i=0;i<exercises.length;i++){
    const ex = exercises[i]
    for(let set=1; set<=sets; set++){
      routine.push({type:'work', exercise:ex, amount:reps * workSecondsPerRep, set:set, origReps:reps})
      const isLastSet = (set === sets)
      // If not last set for this exercise, rest between sets
      if(!isLastSet) routine.push({type:'rest-set', duration:restAfterSet, afterSet:set})
    }
    // After finishing all sets of this exercise, add a rest between exercises (unless this is the last exercise)
    const isLastExercise = (i === exercises.length-1)
    if(!isLastExercise) routine.push({type:'rest-ex', duration:restAfterExercise, afterExercise:ex})
  }

  renderRoutine()
  startBtn.disabled = false
  resetState()
}

function renderRoutine(){
  routineList.innerHTML = ''
  routine.forEach((item, idx)=>{
    const li = document.createElement('li')
    li.className = 'routine-item'
    if(item.type === 'work'){
      li.innerHTML = `<div><strong>Set ${item.set}</strong> — ${niceName(item.exercise)}: ${item.amount}s (${item.origReps} reps)</div><div>Work</div>`
    } else if(item.type === 'rest-ex'){
      li.innerHTML = `<div>Rest after ${niceName(item.afterExercise)}</div><div>${item.duration}s</div>`
    } else if(item.type === 'rest-set'){
      li.innerHTML = `<div>Rest after set ${item.afterSet}</div><div>${item.duration}s</div>`
    } else {
      li.innerHTML = `<div>Rest</div><div>${item.duration || ''}s</div>`
    }
    li.dataset.index = idx
    routineList.appendChild(li)
  })
}

function speakText(text){
  try{
    if(!notifyCheckbox.checked) return
    if('speechSynthesis' in window && text){
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'en-US'
      speechSynthesis.speak(u)
    }
  }catch(e){console.warn('speak failed', e)}
}

// Promise-based speak helper: resolves when speech finishes (or immediately if disabled)
function speakThen(text){
  return new Promise(resolve=>{
    try{
      if(!notifyCheckbox.checked || !('speechSynthesis' in window) || !text){
        resolve()
        return
      }
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'en-US'
      u.onend = ()=> resolve()
      // queue utterances rather than cancelling existing ones
      speechSynthesis.speak(u)
    }catch(e){ console.warn('speakThen failed', e); resolve() }
  })
}

// Centralized interval starter — uses current `remaining` and `currentIndex`
function startInterval(){
  clearInterval(intervalId)
  intervalId = setInterval(()=>{
    if(isPaused) return
    remaining--
    if(remaining < 0){
      clearInterval(intervalId)
      intervalId = null
      notify('transition')
      currentIndex++
      if(routine[currentIndex] && routine[currentIndex].type === 'work'){
        const next = routine[currentIndex]
        let prevIdx = currentIndex-1
        let prevSet = null
        while(prevIdx >=0){ if(routine[prevIdx].type === 'work'){ prevSet = routine[prevIdx].set; break } prevIdx-- }
        if(prevSet !== null && prevSet < next.set) speakText(`NEXT SET`)
        else if(prevSet === next.set ||  prevSet > next.set) speakText(`Next exercise`)
      }
      runCurrent()
    } else {
      updateDisplay()
    }
  }, 1000)
}

function playBeep(kind){
  try{
    if(!notifyCheckbox.checked) return
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'
    if(kind === 'rest' || kind === 'rest-ex' || kind === 'rest-set') o.frequency.value = 440
    else if(kind === 'start' || kind === 'transition') o.frequency.value = 880
    else o.frequency.value = 660
    g.gain.value = 0.0001; o.start();
    g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.01)
    setTimeout(()=>{ g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.02); o.stop(ctx.currentTime + 0.03) }, 160)
  }catch(e){console.warn('beep failed', e)}
}

function notify(kind){
  if(!notifyCheckbox.checked) return
  try{
    if(navigator.vibrate){
      if(kind === 'complete') navigator.vibrate([200,100,200])
      else navigator.vibrate(200)
    }
    playBeep(kind)
  }catch(e){/* ignore */}
}

function startRoutineActual(){
  if(routine.length === 0) return
  if(currentIndex === -1) currentIndex = 0
  isPaused = false
  startBtn.disabled = true
  pauseBtn.disabled = false
  resetBtn.disabled = false
  generateBtn.disabled = true
  runCurrent()
}

async function speakWelcomeAndStart(){
  const text = "Welcome to your workout. Let's begin."
  try{
    await speakThen(text)
    startRoutineActual()
  }catch(e){ startRoutineActual() }
}

async function runCurrent(){
  clearInterval(intervalId)
  intervalId = null
  if(currentIndex < 0 || currentIndex >= routine.length){ finishRoutine(); return }

  const item = routine[currentIndex]
  if(item.type === 'work'){
    timerTitle.textContent = `Set ${item.set} — ${niceName(item.exercise)} (${item.origReps} reps)`
    // Announce set and exercise, then countdown, then start
    await speakThen(`Set ${item.set}. ${niceName(item.exercise)}. (${item.origReps} reps).`)
    await speakThen('Three')
    await speakThen('Two')
    await speakThen('One')
    await speakThen('Go')

    remaining = item.amount
    playBeep('start')
    highlightIndex(currentIndex)
    updateDisplay()
    startInterval()
    return
  }

  if(item.type === 'rest-ex'){
    timerTitle.textContent = `Rest after ${niceName(item.afterExercise)}`
    remaining = item.duration
    await speakThen('Rest')
    playBeep('rest')
    highlightIndex(currentIndex)
    updateDisplay()
    startInterval()
    return
  }

  if(item.type === 'rest-set'){
    timerTitle.textContent = `Rest after set ${item.afterSet}`
    remaining = item.duration
    await speakThen(`Set ${item.afterSet} complete`)
    await speakThen('Rest')
    playBeep('rest')
    highlightIndex(currentIndex)
    updateDisplay()
    startInterval()
    return
  }

  // generic rest
  timerTitle.textContent = `Rest`
  remaining = item.duration || 0
  await speakThen('Rest')
  playBeep('rest')
  highlightIndex(currentIndex)
  updateDisplay()
  startInterval()
}

function highlightIndex(idx){ Array.from(routineList.children).forEach(li=>li.classList.remove('active')); const child = routineList.children[idx]; if(child) child.classList.add('active') }

function updateDisplay(){
  countdownEl.textContent = formatTime(remaining)
  const item = routine[currentIndex] || {amount:1,duration:1}
  let total = 1
  if(item.type === 'work') total = item.amount
  else total = item.duration || 1
  const pct = Math.max(0, Math.min(100, Math.round((1 - remaining/total)*100)))
  progressFill.style.width = pct + '%'
}

function pauseRoutine(){ isPaused = !isPaused; pauseBtn.textContent = isPaused ? 'Resume' : 'Pause' }
function resetState(){ clearInterval(intervalId); intervalId=null; currentIndex=-1; remaining=0; isPaused=false; startBtn.disabled=false; pauseBtn.disabled=true; pauseBtn.textContent='Pause'; resetBtn.disabled=true; generateBtn.disabled=false; timerTitle.textContent='Timer'; countdownEl.textContent='00:00'; progressFill.style.width='0%'; Array.from(routineList.children).forEach(li=>li.classList.remove('active')) }
function finishRoutine(){ clearInterval(intervalId); intervalId=null; timerTitle.textContent='Routine complete 🎉'; countdownEl.textContent='00:00'; progressFill.style.width='100%'; startBtn.disabled=true; pauseBtn.disabled=true; resetBtn.disabled=false; generateBtn.disabled=false; notify('complete'); speakText('Well done. See you again tomorrow.') }
function resetRoutine(){ resetState() }

function saveRoutine(){ const selected = getSelectedExercises(); const reps = repsEl.value; const sets = setsEl.value; if(selected.length===0) return alert('No exercises selected to save'); localStorage.setItem('trainerbot.routine', JSON.stringify({exercises:selected,reps,sets})); alert('Routine saved locally') }
function loadRoutine(){ const data = localStorage.getItem('trainerbot.routine'); if(!data) return alert('No saved routine found'); try{ const obj = JSON.parse(data); document.querySelectorAll('input[name="exercise"]').forEach(inp=>{ inp.checked = obj.exercises && obj.exercises.includes(inp.value) }); repsEl.value = obj.reps || repsEl.value; setsEl.value = obj.sets || setsEl.value; generateRoutine(); alert('Routine loaded') }catch(e){alert('Could not load saved routine')} }

generateBtn.addEventListener('click', generateRoutine)
startBtn.addEventListener('click', ()=>{ speakWelcomeAndStart() })
pauseBtn.addEventListener('click', pauseRoutine)
resetBtn.addEventListener('click', resetRoutine)
saveBtn.addEventListener('click', saveRoutine)
loadBtn.addEventListener('click', loadRoutine)

document.addEventListener('keydown', e=>{ if(e.target.tagName==='INPUT' || e.target.tagName==='SELECT' || e.target.tagName==='TEXTAREA') return; if(e.key.toLowerCase()==='g') generateBtn.click(); if(e.key.toLowerCase()==='s') startBtn.click(); if(e.key.toLowerCase()==='p') pauseBtn.click(); if(e.key.toLowerCase()==='r') resetBtn.click() })
