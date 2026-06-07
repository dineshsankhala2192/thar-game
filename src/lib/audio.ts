let audioCtx: AudioContext | null = null;

export const initAudio = () => {
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

export const playClick = () => {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  } catch (e) { /* ignore */ }
};

export const playCrash = () => {
  if (!audioCtx) return;
  try {
    const bufferSize = audioCtx.sampleRate * 0.5;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start();
  } catch (e) {}
};

export const playBoostPickup = () => {
   if (!audioCtx) return;
   try {
     const osc = audioCtx.createOscillator();
     const gain = audioCtx.createGain();
     osc.connect(gain);
     gain.connect(audioCtx.destination);
     osc.type = 'triangle';
     osc.frequency.setValueAtTime(400, audioCtx.currentTime);
     osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.3);
     gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
     gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
     osc.start();
     osc.stop(audioCtx.currentTime + 0.3);
   } catch(e) {}
};

export const playStageUp = () => {
   if (!audioCtx) return;
   try {
     [440, 554, 659].forEach((freq, idx) => {
       const osc = audioCtx.createOscillator();
       const gain = audioCtx.createGain();
       osc.connect(gain);
       gain.connect(audioCtx.destination);
       osc.type = 'sine';
       osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx * 0.1);
       gain.gain.setValueAtTime(0, audioCtx.currentTime);
       gain.gain.setValueAtTime(0.2, audioCtx.currentTime + idx * 0.1);
       gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + idx * 0.1 + 0.5);
       osc.start(audioCtx.currentTime + idx * 0.1);
       osc.stop(audioCtx.currentTime + idx * 0.1 + 0.5);
     });
   } catch(e) {}
};

let engineOsc: OscillatorNode | null = null;
let engineGain: GainNode | null = null;
let sirenLfoOsc: OscillatorNode | null = null;
let sirenLfoGain: GainNode | null = null;

export const startEngine = (isMuted: boolean = false) => {
  if (!audioCtx) return;
  if (engineOsc) return;

  try {
    engineOsc = audioCtx.createOscillator();
    engineGain = audioCtx.createGain();
    
    sirenLfoOsc = audioCtx.createOscillator();
    sirenLfoGain = audioCtx.createGain();
    
    engineOsc.type = 'sawtooth';
    sirenLfoOsc.type = 'square';
    
    engineOsc.frequency.setValueAtTime(800, audioCtx.currentTime); // Base freq
    sirenLfoOsc.frequency.setValueAtTime(1.5, audioCtx.currentTime); // cycle rate
    sirenLfoGain.gain.setValueAtTime(200, audioCtx.currentTime); // Pitch shift depth: 800 +/- 200
    
    sirenLfoOsc.connect(sirenLfoGain);
    sirenLfoGain.connect(engineOsc.frequency);
    
    engineGain.gain.setValueAtTime(0, audioCtx.currentTime);
    if (!isMuted) {
       engineGain.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 1);
    }

    engineOsc.connect(engineGain);
    engineGain.connect(audioCtx.destination);

    engineOsc.start();
    sirenLfoOsc.start();
  } catch (e) {}
};

export const updateEngineSpeed = (speedMultiplier: number, isBoosting: boolean, isMuted: boolean = false) => {
  if (!audioCtx || !engineGain || !sirenLfoOsc) return;
  try {
    if (isMuted) {
      engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
    } else {
      const targetGain = isBoosting ? 0.1 : 0.05 + (speedMultiplier - 1) * 0.01;
      engineGain.gain.setTargetAtTime(Math.min(targetGain, 0.2), audioCtx.currentTime, 0.1);
    }
    
    const targetLfo = isBoosting ? 4 : 1.5 + (speedMultiplier - 1) * 0.5;
    sirenLfoOsc.frequency.setTargetAtTime(Math.min(targetLfo, 5), audioCtx.currentTime, 0.1);
  } catch (e) {}
};

export const stopEngine = () => {
  try {
    if (engineOsc) {
      engineOsc.stop();
      engineOsc.disconnect();
      engineOsc = null;
    }
    if (sirenLfoOsc) {
      sirenLfoOsc.stop();
      sirenLfoOsc.disconnect();
      sirenLfoOsc = null;
    }
    if (sirenLfoGain) {
      sirenLfoGain.disconnect();
      sirenLfoGain = null;
    }
    if (engineGain) {
      engineGain.disconnect();
      engineGain = null;
    }
  } catch(e) {}
};
