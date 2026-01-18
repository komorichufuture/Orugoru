// 2段鍵盤：
// 上段 C5〜B6（2オクターブ）
// 下段 C4〜B5（2オクターブ）
// ※重複部分(C5〜B5)は上下に両方置く設計（弾きやすさ優先）

let audioCtx = null;

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function play(freq) {
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.value = freq;

  const t = audioCtx.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);

  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.6);
}

function bindKey(el, freq) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    initAudio();
    play(freq);
  }, { passive: false });
}

const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];       // C D E F G A B
const BLACK_OFFSETS = [1, 3, 6, 8, 10];             // C# D# F# G# A#
const BLACK_LEFT_WHITE_INDEX = [0, 1, 3, 4, 5];      // 黒鍵の左白鍵位置（オクターブ内）

function renderRow({ whiteEl, blackEl, startMidiC, startOctaveLabel }) {
  // 2オクターブ = 白鍵14本
  const whiteCount = 14;
  const whiteW = 100 / whiteCount;   // %
  const blackW = whiteW * 0.65;

  // 白鍵生成（2オクターブ）
  for (let o = 0; o < 2; o++) {
    const octaveNumber = startOctaveLabel + o; // 表示用
    for (let i = 0; i < 7; i++) {
      const midi = startMidiC + o * 12 + WHITE_OFFSETS[i];
      const name = ['C','D','E','F','G','A','B'][i] + octaveNumber;

      const div = document.createElement('div');
      div.className = 'white';
      div.textContent = name;
      bindKey(div, midiToFreq(midi));
      whiteEl.appendChild(div);
    }
  }

  // 黒鍵生成（2オクターブ=10本）
  for (let o = 0; o < 2; o++) {
    const octaveNumber = startOctaveLabel + o;
    for (let k = 0; k < 5; k++) {
      const midi = startMidiC + o * 12 + BLACK_OFFSETS[k];
      const name = ['C#','D#','F#','G#','A#'][k] + octaveNumber;

      // 左白鍵index（0..13）
      const leftWhiteIndex = o * 7 + BLACK_LEFT_WHITE_INDEX[k];
      const leftPercent = (leftWhiteIndex + 1) * whiteW - blackW / 2;

      const div = document.createElement('div');
      div.className = 'black';
      div.textContent = name;
      div.style.width = `${blackW}%`;
      div.style.left = `${leftPercent}%`;

      bindKey(div, midiToFreq(midi));
      blackEl.appendChild(div);
    }
  }
}

const kbdHigh = document.getElementById('kbdHigh');
const blackHigh = document.getElementById('blackHigh');
const kbdLow = document.getElementById('kbdLow');
const blackLow = document.getElementById('blackLow');

// 上段：C5(72)〜
renderRow({
  whiteEl: kbdHigh,
  blackEl: blackHigh,
  startMidiC: 72,          // C5
  startOctaveLabel: 5
});

// 下段：C4(60)〜
renderRow({
  whiteEl: kbdLow,
  blackEl: blackLow,
  startMidiC: 60,          // C4
  startOctaveLabel: 4
});
