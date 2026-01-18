/* ===============================
   Music Box Keyboard – app.js
   =============================== */

let audioCtx = null;
let scheduled = [];
let loadedScore = null;

// ===== Recording =====
let isRecording = false;
let recStart = 0;
let recEvents = []; // {note,time,dur}

// 録音時の固定余韻（オルゴール向け）
const REC_DEFAULT_DUR = 0.45;

/* ---------- Audio ---------- */

function initAudio(){
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function midiToFreq(m){
  return 440 * Math.pow(2, (m - 69) / 12);
}

/* ----- Music Box Timbre ----- */

let _musicBoxWave = null;

function getMusicBoxWave(ctx){
  if (_musicBoxWave) return _musicBoxWave;

  const real = new Float32Array(16);
  const imag = new Float32Array(16);

  real[1] = 1.0;
  real[2] = 0.25;
  real[3] = 0.12;
  real[4] = 0.06;
  real[5] = 0.03;
  real[6] = 0.015;

  _musicBoxWave = ctx.createPeriodicWave(real, imag, { disableNormalization:false });
  return _musicBoxWave;
}

function musicBoxVoice(freq, startAt, dur=0.6, vel=1.0){
  const ctx = audioCtx;

  const osc = ctx.createOscillator();
  osc.setPeriodicWave(getMusicBoxWave(ctx));
  osc.frequency.setValueAtTime(freq, startAt);
  osc.detune.setValueAtTime((Math.random()*6-3), startAt);

  const gain = ctx.createGain();
  const peak = 0.20 * vel;

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + Math.max(0.08, dur));

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(180, startAt);

  const peakF = ctx.createBiquadFilter();
  peakF.type = 'peaking';
  peakF.frequency.setValueAtTime(2600, startAt);
  peakF.Q.setValueAtTime(2.2, startAt);
  peakF.gain.setValueAtTime(7.0, startAt);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(11000, startAt);

  osc.connect(hp);
  hp.connect(peakF);
  peakF.connect(lp);
  lp.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startAt);
  osc.stop(startAt + dur + 0.1);

  return osc;
}

function play(freq){
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  musicBoxVoice(freq, t, 0.6, 1.0);
}

/* ---------- Keyboard ---------- */

const WHITE_OFFSETS = [0,2,4,5,7,9,11];
const BLACK_OFFSETS = [1,3,6,8,10];
const BLACK_LEFT_WHITE_INDEX = [0,1,3,4,5];

function bindKey(el, freq, midi){
  let downAt = 0;

  el.addEventListener('pointerdown', e=>{
    e.preventDefault();
    initAudio();
    play(freq);

    if(isRecording){
      downAt = audioCtx.currentTime;
      const t = Math.max(0, downAt - recStart);
      // 録音は「固定余韻」：スマホのpointerup早着/取りこぼしでもブツ切れにならない
      recEvents.push({ note: midiToNoteName(midi), time: +t.toFixed(3), dur: REC_DEFAULT_DUR });
      el.dataset._recIndex = String(recEvents.length - 1);
    }
  }, {passive:false});

  el.addEventListener('pointerup', ()=>{
    if(!isRecording) return;
    const idx = Number(el.dataset._recIndex);
    if(Number.isFinite(idx) && recEvents[idx]){
      // dur計算はしない（固定余韻で確定）
      recEvents[idx].dur = REC_DEFAULT_DUR;
    }
  });

  // 指が外に逃げても止める
  el.addEventListener('pointercancel', ()=>{
    el.dispatchEvent(new Event('pointerup'));
  });
}

function renderRow({whiteEl, blackEl, startMidiC, startOct}){
  const whiteCount = 14;
  const whiteW = 100 / whiteCount;
  const blackW = whiteW * 0.65;

  for(let o=0;o<2;o++){
    const oct = startOct + o;
    for(let i=0;i<7;i++){
      const midi = startMidiC + o*12 + WHITE_OFFSETS[i];
      const div = document.createElement('div');
      div.className = 'white';
      div.textContent = ['C','D','E','F','G','A','B'][i] + oct;
      bindKey(div, midiToFreq(midi), midi);
      whiteEl.appendChild(div);
    }
  }

  for(let o=0;o<2;o++){
    const oct = startOct + o;
    for(let k=0;k<5;k++){
      const midi = startMidiC + o*12 + BLACK_OFFSETS[k];
      const leftIndex = o*7 + BLACK_LEFT_WHITE_INDEX[k];
      const left = (leftIndex+1)*whiteW - blackW/2;

      const div = document.createElement('div');
      div.className = 'black';
      div.textContent = ['C#','D#','F#','G#','A#'][k] + oct;
      div.style.width = blackW+'%';
      div.style.left = left+'%';
      bindKey(div, midiToFreq(midi), midi);
      blackEl.appendChild(div);
    }
  }
}

/* ---------- JSON Play ---------- */

function midiToNoteName(m){
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const octave = Math.floor(m/12) - 1;
  return names[m % 12] + octave;
}

function noteNameToMidi(note){
  const m = note.match(/^([A-G])(#?)(\d)$/);
  if(!m) return null;
  const base = {C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]];
  return 12*(parseInt(m[3])+1) + base + (m[2]==='#'?1:0);
}

function clampMidi(m){
  while(m<60) m+=12;
  while(m>95) m-=12;
  return m;
}

function playJsonScore(score){
  initAudio();
  stopJsonScore();

  const t0 = audioCtx.currentTime;

  score.forEach(ev=>{
    const m0 = noteNameToMidi(ev.note);
    if(m0==null) return;
    const m = clampMidi(m0);
    const freq = midiToFreq(m);
    const t = t0 + ev.time;
    const d = Math.max(0.08, ev.dur ?? 0.6);
    const o = musicBoxVoice(freq, t, d, 1.0);
    scheduled.push(o);
  });
}

function stopJsonScore(){
  scheduled.forEach(o=>{
    try{ o.stop(); }catch(e){}
  });
  scheduled = [];
}

/* ---------- JSON Load ---------- */

const fileInput = document.getElementById('jsonFile');

document.getElementById('loadJson').onclick = ()=>{
  fileInput.value = '';
  fileInput.click();
};

fileInput.addEventListener('change', ()=>{
  const file = fileInput.files[0];
  if(!file) return;
  const r = new FileReader();
  r.onload = ()=>{
    try{
      loadedScore = JSON.parse(r.result);
      alert('JSON loaded');
    }catch(e){
      alert('Invalid JSON');
    }
  };
  r.readAsText(file);
});

document.getElementById('playJson').onclick = ()=>{
  if(!loadedScore){ alert('Load JSON first'); return; }
  playJsonScore(loadedScore);
};
document.getElementById('stopJson').onclick = ()=> stopJsonScore();

/* ---------- Recording Buttons ---------- */

document.getElementById('recToggle').onclick = ()=>{
  initAudio();

  if(!isRecording){
    // start
    isRecording = true;
    recEvents = [];
    recStart = audioCtx.currentTime;
    alert('REC start');
    return;
  }

  // stop
  isRecording = false;

  // 録音を "再生用スコア" に採用（dur未確定があれば固定余韻で補正）
  const normalized = recEvents
    .filter(e => e && typeof e.note === 'string' && typeof e.time === 'number')
    .map(e => ({
      note: e.note,
      time: +(+e.time).toFixed(3),
      dur: +Math.max(0.08, (e.dur ?? REC_DEFAULT_DUR)).toFixed(3),
    }))
    .sort((a,b)=>a.time-b.time);

  loadedScore = normalized;

  alert(`REC stop: ${loadedScore.length} notes\nLoaded as current score, playing...`);

  // 即再生
  playJsonScore(loadedScore);
};

document.getElementById('downloadRec').onclick = ()=>{
  const data = (Array.isArray(loadedScore) && loadedScore.length) ? loadedScore : recEvents;

  if(!data || data.length === 0){
    alert('No recording');
    return;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'recording.json';
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(()=>URL.revokeObjectURL(url), 2000);
};

/* ---------- Init ---------- */

renderRow({
  whiteEl: document.getElementById('kbdHigh'),
  blackEl: document.getElementById('blackHigh'),
  startMidiC: 72,
  startOct: 5
});

renderRow({
  whiteEl: document.getElementById('kbdLow'),
  blackEl: document.getElementById('blackLow'),
  startMidiC: 60,
  startOct: 4
});
