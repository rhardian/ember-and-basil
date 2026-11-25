// Procedural Web Audio culinary foley synthesizer: knife chops, sizzles, brass service bell, and timer pulses.

export function createAudioEngine() {
  let ctx = null;
  let noiseBuffer = null;
  let muted = false;

  function ensureContext() {
    if (muted) return null;
    if (!ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (ctx && !noiseBuffer) {
      const sampleRate = ctx.sampleRate;
      const buf = ctx.createBuffer(1, sampleRate, sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      noiseBuffer = buf;
    }
    return ctx;
  }

  function playTone(freq, duration, type = 'triangle', gainPeak = 0.14, freqEnd = null, delay = 0) {
    const audio = ensureContext();
    if (!audio) return;
    const now = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playFilteredNoise(duration, filterFreq, gainPeak = 0.12, q = 1.6) {
    const audio = ensureContext();
    if (!audio || !noiseBuffer) return;
    const now = audio.currentTime;
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(q, now);

    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  return {
    unlock() {
      ensureContext();
    },
    isMuted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    playPickup() {
      playTone(340, 0.08, 'triangle', 0.1, 480);
    },
    playPlace() {
      playTone(260, 0.07, 'sine', 0.1, 180);
    },
    playPlateClink() {
      playTone(1240, 0.09, 'sine', 0.08, 1520);
      playTone(1860, 0.06, 'triangle', 0.05, 1740, 0.02);
    },
    playChop(step = 0) {
      const pitch = 190 + step * 28;
      playTone(pitch, 0.055, 'triangle', 0.14, 95);
      playFilteredNoise(0.045, 2200 + step * 250, 0.09, 2.2);
    },
    playCookStart(kind) {
      if (kind === 'skillet') {
        playFilteredNoise(0.32, 3400, 0.14, 1.1);
      } else if (kind === 'pot') {
        playTone(220, 0.12, 'sine', 0.1, 360);
        playFilteredNoise(0.18, 950, 0.07, 1.8);
      } else {
        playFilteredNoise(0.24, 640, 0.11, 1.4);
        playTone(140, 0.16, 'triangle', 0.08, 90);
      }
    },
    playReadyDing(kind) {
      const base = kind === 'oven' ? 880 : 1046;
      playTone(base, 0.28, 'sine', 0.12);
      playTone(base * 1.5, 0.22, 'triangle', 0.07, null, 0.05);
    },
    playServeBell(grand = false) {
      playTone(1318.5, 0.42, 'sine', 0.16);
      playTone(2637, 0.3, 'sine', 0.06);
      if (grand) {
        playTone(1568, 0.34, 'triangle', 0.11, null, 0.09);
        playTone(2093, 0.4, 'sine', 0.11, null, 0.18);
      }
    },
    playFeverFanfare() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((n, idx) => playTone(n, 0.24, 'triangle', 0.11, null, idx * 0.07));
    },
    playDash() {
      playFilteredNoise(0.11, 1200, 0.08, 0.9);
      playTone(240, 0.1, 'sine', 0.06, 420);
    },
    playTrash() {
      playTone(170, 0.11, 'sawtooth', 0.06, 90);
    },
    playWarnBeep() {
      playTone(720, 0.1, 'square', 0.05);
      playTone(620, 0.1, 'square', 0.05, null, 0.11);
    },
    playBurnSizzle() {
      playFilteredNoise(0.38, 1800, 0.12, 0.8);
      playTone(140, 0.26, 'sawtooth', 0.08, 70);
    },
    playErrorBuzz() {
      playTone(180, 0.12, 'sawtooth', 0.07, 130);
    },
    playTicketChime(vip = false) {
      playTone(vip ? 987.77 : 783.99, 0.14, 'triangle', 0.08);
      if (vip) playTone(1318.5, 0.2, 'sine', 0.09, null, 0.08);
    },
    playTickUrgent() {
      playTone(880, 0.045, 'sine', 0.06);
    },
  };
}
