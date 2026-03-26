const box   = document.getElementById('box');
const scare = document.getElementById('scare');
const flash = document.getElementById('flash');

// ── Screech sound via Web Audio API ──────────────────────────────────────────
function playScreech() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  function burst(freq, type, startTime, duration, gainPeak) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, startTime + duration);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  // Layered dissonant screech
  const now = ctx.currentTime;
  burst(880,  'sawtooth', now,        0.8, 0.6);
  burst(1320, 'square',   now,        0.7, 0.4);
  burst(660,  'sawtooth', now + 0.05, 0.6, 0.5);
  burst(1760, 'sine',     now + 0.02, 0.5, 0.3);

  // Noise burst for impact
  const bufferSize = ctx.sampleRate * 0.4;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data   = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
  const noise  = ctx.createBufferSource();
  const nGain  = ctx.createGain();
  noise.buffer = buffer;
  noise.connect(nGain);
  nGain.connect(ctx.destination);
  nGain.gain.setValueAtTime(0.5, now);
  nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  noise.start(now);
  noise.stop(now + 0.4);
}

// ── Trigger jumpscare ─────────────────────────────────────────────────────────
function triggerScare() {
  playScreech();

  // White flash
  flash.classList.remove('pop');
  void flash.offsetWidth; // reflow to restart animation
  flash.classList.add('pop');

  // Show scary face
  scare.classList.add('active');
  scare.classList.remove('shake');
  void scare.offsetWidth;
  scare.classList.add('shake');
}

// ── Dismiss ───────────────────────────────────────────────────────────────────
function dismiss() {
  scare.classList.remove('active', 'shake');
}

box.addEventListener('click', triggerScare);
scare.addEventListener('click', dismiss);
