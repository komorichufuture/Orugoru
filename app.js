// 3オクターブ（C3〜B5）
// 外部ライブラリなし / AudioContext 1個 / 低負荷

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

const whiteKeysEl = document.getElementById('whiteKeys');
const blackLayerEl = document.getElementById('blackLayer');

const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];       // C D E F G A B
const BLACK_OFFSETS = [1, 3, 6, 8, 10];             // C# D# F# G# A#
const BLACK_LEFT_WHITE_INDEX = [0, 1, 3, 4, 5];      // 黒鍵の左側にある白鍵の位置（1オクターブ内）

const START_MIDI_C3 = 48; // C3
const OCTAVES = 3;

const whiteCount = 7 * OCTAVES;   // 21
const whiteW = 100 / whiteCount;  // %
const blackW = whiteW * 0.65;     // 黒鍵幅（白鍵の65%）

function render() {
  // 白鍵：C3〜B5
  for (let o = 0; o < OCTAVES; o++) {
    const octaveNumber = 3 + o;
    for (let i = 0; i < 7; i++) {
      const midi = START_MIDI_C3 + o * 12 + WHITE_OFFSETS[i];
      const name = ['C','D','E','F','G','A','B'][i] + octaveNumber;

      const div = document.createElement('div');
      div.className = 'white';
      div.textContent = name;

      bindKey(div, midiToFreq(midi));
      whiteKeysEl.appendChild(div);
    }
  }

  // 黒鍵：各オクターブ5本
  for (let o = 0; o < OCTAVES; o++) {
    const octaveNumber = 3 + o;
    for (let k = 0; k < 5; k++) {
      const midi = START_MIDI_C3 + o * 12 + BLACK_OFFSETS[k];
      const name = ['C#','D#','F#','G#','A#'][k] + octaveNumber;

      // 黒鍵位置計算：境界の中心に置く
      const leftWhiteIndexGlobal = o * 7 + BLACK_LEFT_WHITE_INDEX[k]; // 0..20
      const leftPercent = (leftWhiteIndexGlobal + 1) * whiteW - blackW / 2;

      const div = document.createElement('div');
      div.className = 'black';
      div.textContent = name;

      div.style.width = `${blackW}%`;
      div.style.left = `${leftPercent}%`;

      bindKey(div, midiToFreq(midi));
      blackLayerEl.appendChild(div);
    }
  }
}

render();
