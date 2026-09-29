// Procedural audio: adaptive music with a motif per family member, plus synthesized SFX.
(function () {
  const G = (window.G = window.G || {});
  const A = (G.audio = { ctx: null, muted: false, motif: 'frank', song: null, step: 0, nextTime: 0 });
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = (A.ctx = new Ctx());
    A.master = ctx.createGain(); A.master.gain.value = 0.8; A.master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(A.master);
    A.music = ctx.createGain(); A.music.gain.value = 0.33; A.music.connect(comp);
    A.sfx = ctx.createGain(); A.sfx.gain.value = 0.7; A.sfx.connect(comp);
    A.motifBus = {};
    ['frank', 'elba', 'luca', 'ludo', 'luigi'].forEach((k) => {
      const g = ctx.createGain(); g.gain.value = k === A.motif ? 1 : 0; g.connect(A.music); A.motifBus[k] = g;
    });
    // noise buffer
    const len = ctx.sampleRate * 1.5; const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.noiseBuf = buf;
    // simple echo for music
    const dl = ctx.createDelay(1); dl.delayTime.value = 0.27; const fb = ctx.createGain(); fb.gain.value = 0.22;
    const wet = ctx.createGain(); wet.gain.value = 0.25; dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(A.music);
    A.echo = dl;
    A.nextTime = ctx.currentTime + 0.1;
    setInterval(A.schedule, 50);
  };
  A.setMuted = function (m) { A.muted = m; if (A.master) A.master.gain.setTargetAtTime(m ? 0 : 0.8, A.ctx.currentTime, 0.05); };

  function env(g, t, a, peak, dec, sus = 0, rel = 0.05, hold = 0) {
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + dec);
    if (hold) { g.gain.setValueAtTime(Math.max(sus, 0.0001), t + a + dec + hold); }
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec + hold + rel);
  }
  function osc(type, f, t, dur, dest, gainPeak = 0.3, a = 0.005, dec = 0.2, detune = 0) {
    const ctx = A.ctx; const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    env(g, t, a, gainPeak, dec, 0.0001, 0.05);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + a + dec + 0.1 + (dur || 0));
    return { o, g };
  }
  function noise(t, dur, dest, peak, type = 'bandpass', f = 1000, q = 1) {
    const ctx = A.ctx; const s = ctx.createBufferSource(); s.buffer = A.noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); env(g, t, 0.003, peak, dur);
    s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.1);
    return { s, fl, g };
  }

  // ---------- Songs ----------
  // chords as midi roots + quality
  const SONGS = {
    hub: { bpm: 96, chords: [[53, 'M'], [60, 'M'], [62, 'm'], [58, 'M']], drums: 'soft' },
    world1: { bpm: 118, chords: [[62, 'm'], [58, 'M'], [53, 'M'], [60, 'M']], drums: 'adv' },
    boss: { bpm: 140, chords: [[62, 'm'], [60, 'M'], [58, 'M'], [57, 'M']], drums: 'boss' },
    title: { bpm: 84, chords: [[57, 'm'], [53, 'M'], [60, 'M'], [55, 'M']], drums: 'none' },
    victory: { bpm: 110, chords: [[60, 'M'], [65, 'M'], [67, 'M'], [60, 'M']], drums: 'soft' },
  };
  const triad = (root, q) => [root, root + (q === 'm' ? 3 : 4), root + 7];
  A.playSong = function (name) { A.song = SONGS[name] ? name : null; A.step = 0; if (A.ctx) A.nextTime = A.ctx.currentTime + 0.08; };
  A.setMotif = function (who) {
    A.motif = who; if (!A.ctx) return;
    const t = A.ctx.currentTime;
    for (const k in A.motifBus) A.motifBus[k].gain.setTargetAtTime(k === who ? 1 : 0, t, 0.25);
  };

  A.schedule = function () {
    if (!A.ctx || !A.song) return;
    const s = SONGS[A.song]; const spb = 60 / s.bpm / 4; // 16th note
    while (A.nextTime < A.ctx.currentTime + 0.2) { playStep(s, A.step, A.nextTime, spb); A.step++; A.nextTime += spb; }
  };
  function playStep(s, step, t, spb) {
    const bar = Math.floor(step / 16) % s.chords.length; const i16 = step % 16;
    const [root, q] = s.chords[bar]; const ch = triad(root, q); const M = A.music;
    // pad at bar start
    if (i16 === 0) ch.forEach((n, k) => {
      const ctx = A.ctx; const o = ctx.createOscillator(); const o2 = ctx.createOscillator(); const f = ctx.createBiquadFilter(); const g = ctx.createGain();
      o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = NOTE(n); o2.frequency.value = NOTE(n); o2.detune.value = 9;
      f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.5;
      const dur = spb * 16; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.028, t + 0.4); g.gain.setValueAtTime(0.028, t + dur - 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.2);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(M); o.start(t); o2.start(t); o.stop(t + dur + 0.3); o2.stop(t + dur + 0.3);
    });
    // bass
    const bassPat = s.drums === 'boss' ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 6, 8, 11, 14];
    if (s.drums !== 'none' && bassPat.includes(i16)) {
      const n = root - 24 + (i16 === 11 ? 7 : i16 === 14 ? 12 : 0);
      const { o } = osc('triangle', NOTE(n), t, 0, M, 0.22, 0.005, spb * 2.2);
    } else if (s.drums === 'none' && i16 === 0) osc('sine', NOTE(root - 24), t, 0, M, 0.2, 0.05, spb * 12);
    // drums
    if (s.drums === 'adv' || s.drums === 'boss' || s.drums === 'soft') {
      const kick = s.drums === 'soft' ? [0, 8] : s.drums === 'boss' ? [0, 4, 8, 10, 12] : [0, 7, 8];
      if (kick.includes(i16)) { const { o } = osc('sine', 120, t, 0, M, 0.5, 0.002, 0.18); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); }
      if (i16 === 4 || i16 === 12) noise(t, s.drums === 'soft' ? 0.08 : 0.14, M, s.drums === 'soft' ? 0.08 : 0.16, 'bandpass', 1800, 0.8);
      if (i16 % 2 === 0 && s.drums !== 'soft') noise(t, 0.03, M, 0.04, 'highpass', 7000, 0.7);
      if (s.drums === 'soft' && i16 % 4 === 2) noise(t, 0.03, M, 0.03, 'highpass', 8000, 0.7);
    }
    // character motifs
    motifStep('frank', ch, root, i16, t, spb, bar);
    motifStep('elba', ch, root, i16, t, spb, bar);
    motifStep('luca', ch, root, i16, t, spb, bar);
    motifStep('ludo', ch, root, i16, t, spb, bar);
    motifStep('luigi', ch, root, i16, t, spb, bar);
  }
  function pluck(n, t, dest, vol = 0.12, dec = 0.35) {
    const ctx = A.ctx; const o = ctx.createOscillator(); const f = ctx.createBiquadFilter(); const g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = NOTE(n); f.type = 'lowpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(3500, t); f.frequency.exponentialRampToValueAtTime(400, t + dec);
    env(g, t, 0.003, vol, dec); o.connect(f); f.connect(g); g.connect(dest); o.start(t); o.stop(t + dec + 0.2);
  }
  function motifStep(who, ch, root, i16, t, spb, bar) {
    const bus = A.motifBus[who]; if (!bus || (A.motif !== who && bus.gain.value < 0.01)) return;
    if (A.song === 'title') return;
    if (who === 'frank') { // rhythmic guitar strums
      const pat = [0, 3, 6, 8, 10, 12, 14];
      if (pat.includes(i16)) ch.forEach((n, k) => pluck(n + 12, t + k * 0.012, bus, 0.05, 0.3));
      if (i16 === 14 && bar % 2) pluck(ch[2] + 24, t, bus, 0.06, 0.5);
    } else if (who === 'elba') { // confident brass swells
      if (i16 === 0 || i16 === 10) ch.forEach((n) => {
        const ctx = A.ctx; const o = ctx.createOscillator(); const f = ctx.createBiquadFilter(); const g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = NOTE(n + 12); f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(2200, t + 0.12); f.frequency.linearRampToValueAtTime(900, t + 0.5);
        env(g, t, 0.06, 0.05, 0.3, 0.02, 0.2, spb * (i16 === 0 ? 5 : 3)); o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + 2);
      });
      if (i16 === 14) osc('square', NOTE(ch[1] + 12), t, 0, bus, 0.03, 0.01, 0.12);
    } else if (who === 'luca') { // precise marimba 16ths pattern
      const seq = [0, 1, 2, 1, 2, 0, 1, 2, 0, 2, 1, 2, 0, 1, 2, 1];
      if (i16 % 2 === 0 || i16 === 7 || i16 === 15) {
        const n = ch[seq[i16]] + 24; osc('sine', NOTE(n), t, 0, bus, 0.09, 0.002, 0.18); osc('sine', NOTE(n) * 4, t, 0, bus, 0.02, 0.001, 0.05);
      }
      if (i16 === 4 || i16 === 12) noise(t, 0.02, bus, 0.05, 'bandpass', 4000, 5);
    } else if (who === 'ludo') { // playful toy piano + blips
      const mel = [0, -1, 2, -1, 1, -1, 2, 1, -1, 0, -1, 2, -1, 1, -1, -1];
      const k = mel[i16]; if (k >= 0) {
        const n = ch[k] + 24 + (i16 > 8 ? 12 : 0);
        osc('triangle', NOTE(n), t, 0, bus, 0.07, 0.003, 0.3); osc('sine', NOTE(n) * 2, t, 0, bus, 0.03, 0.002, 0.15);
      }
      if (i16 === 15 && bar % 2) { const { o } = osc('square', NOTE(ch[2] + 36), t, 0, bus, 0.015, 0.001, 0.08); o.frequency.exponentialRampToValueAtTime(NOTE(ch[2] + 24), t + 0.08); }
    } else if (who === 'luigi') { // bouncy woodwind
      const mel = [0, -1, -1, 1, -1, -1, 2, -1, 1, -1, 0, -1, -1, -1, 2, 1];
      const k = mel[i16]; if (k >= 0) {
        const ctx = A.ctx; const o = ctx.createOscillator(); const g = ctx.createGain(); const lfo = ctx.createOscillator(); const lg = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = NOTE(ch[k] + 24); lfo.frequency.value = 6; lg.gain.value = 6; lfo.connect(lg); lg.connect(o.frequency);
        env(g, t, 0.03, 0.08, spb * 1.6, 0.0001, 0.05); o.connect(g); g.connect(bus); o.start(t); lfo.start(t); o.stop(t + spb * 2 + 0.2); lfo.stop(t + spb * 2 + 0.2);
      }
    }
  }

  // ---------- SFX ----------
  const VOICE = { frank: 150, elba: 260, luca: 220, ludo: 330, luigi: 0, glitch: 500, mower: 110 };
  A.play = function (name, opt = {}) {
    if (!A.ctx || A.muted) return;
    const t = A.ctx.currentTime; const D = A.sfx;
    switch (name) {
      case 'jump': { const { o } = osc('square', 300, t, 0, D, 0.06, 0.002, 0.12); o.frequency.exponentialRampToValueAtTime(620, t + 0.1); break; }
      case 'jump2': { const { o } = osc('square', 450, t, 0, D, 0.06, 0.002, 0.14); o.frequency.exponentialRampToValueAtTime(950, t + 0.12); noise(t, 0.12, D, 0.05, 'highpass', 3000); break; }
      case 'land': noise(t, 0.06, D, 0.08, 'lowpass', 400); break;
      case 'spark': { const p = opt.pitch || 0; osc('sine', NOTE(84 + p), t, 0, D, 0.08, 0.002, 0.12); osc('sine', NOTE(91 + p), t + 0.04, 0, D, 0.06, 0.002, 0.15); break; }
      case 'collect': [72, 76, 79, 84, 88].forEach((n, i) => osc('triangle', NOTE(n), t + i * 0.07, 0, D, 0.12, 0.004, 0.3)); break;
      case 'fanfare': [60, 64, 67, 72, 67, 72, 76, 79, 84].forEach((n, i) => { osc('sawtooth', NOTE(n), t + i * 0.11, 0, D, 0.07, 0.01, 0.35); osc('triangle', NOTE(n - 12), t + i * 0.11, 0, D, 0.08, 0.01, 0.4); }); break;
      case 'bark': {
        const base = opt.small ? 700 : 560;
        for (let i = 0; i < (opt.count || 2); i++) {
          const tt = t + i * 0.16; const ctx = A.ctx; const o = ctx.createOscillator(); const f = ctx.createBiquadFilter(); const g = ctx.createGain();
          o.type = 'sawtooth'; o.frequency.setValueAtTime(base * (1 + Math.random() * 0.1), tt); o.frequency.exponentialRampToValueAtTime(base * 0.45, tt + 0.11);
          f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 2; env(g, tt, 0.004, 0.35, 0.11);
          o.connect(f); f.connect(g); g.connect(D); o.start(tt); o.stop(tt + 0.2);
          noise(tt, 0.06, D, 0.12, 'bandpass', 2200, 1);
        }
        break;
      }
      case 'whine': { const { o } = osc('sine', 900, t, 0, D, 0.06, 0.02, 0.4); o.frequency.linearRampToValueAtTime(1300, t + 0.2); o.frequency.linearRampToValueAtTime(800, t + 0.4); break; }
      case 'dig': for (let i = 0; i < 5; i++) noise(t + i * 0.1, 0.07, D, 0.12, 'lowpass', 600 + Math.random() * 300); break;
      case 'break': noise(t, 0.25, D, 0.35, 'lowpass', 1500); { const { o } = osc('square', 160, t, 0, D, 0.15, 0.002, 0.15); o.frequency.exponentialRampToValueAtTime(50, t + 0.15); } break;
      case 'kiai': { const { o } = osc('sawtooth', 380, t, 0, D, 0.08, 0.01, 0.18); o.frequency.exponentialRampToValueAtTime(240, t + 0.18); noise(t, 0.1, D, 0.06, 'bandpass', 1200, 2); break; }
      case 'miss': { const { o } = osc('triangle', 300, t, 0, D, 0.1, 0.01, 0.3); o.frequency.exponentialRampToValueAtTime(150, t + 0.3); break; }
      case 'draw': for (let i = 0; i < 14; i++) noise(t + i * 0.07, 0.05, D, 0.05, 'bandpass', 2500 + Math.random() * 2500, 4); break;
      case 'poof': noise(t, 0.3, D, 0.18, 'lowpass', 1200); [79, 84].forEach((n, i) => osc('sine', NOTE(n), t + i * 0.06, 0, D, 0.07, 0.002, 0.2)); break;
      case 'whoosh': { const n = noise(t, 0.35, D, 0.14, 'bandpass', 400, 1.5); n.fl.frequency.exponentialRampToValueAtTime(3000, t + 0.3); break; }
      case 'boing': { const { o } = osc('sine', 180, t, 0, D, 0.25, 0.005, 0.4); o.frequency.exponentialRampToValueAtTime(700, t + 0.25); break; }
      case 'splash': noise(t, 0.5, D, 0.3, 'lowpass', 1800); noise(t + 0.05, 0.3, D, 0.1, 'highpass', 4000); break;
      case 'hurt': { const { o } = osc('square', 400, t, 0, D, 0.1, 0.005, 0.25); o.frequency.exponentialRampToValueAtTime(120, t + 0.25); break; }
      case 'chime': [84, 88, 91, 96, 91, 98].forEach((n, i) => { osc('sine', NOTE(n), t + i * 0.12, 0, D, 0.07, 0.002, 1.2); osc('sine', NOTE(n) * 2.76, t + i * 0.12, 0, D, 0.015, 0.001, 0.4); }); break;
      case 'crack': noise(t, 0.6, D, 0.5, 'lowpass', 3000); osc('square', 60, t, 0, D, 0.3, 0.002, 0.5); break;
      case 'glitch': for (let i = 0; i < 8; i++) { osc('square', 200 + Math.random() * 1600, t + i * 0.04, 0, D, 0.04, 0.001, 0.035); } break;
      case 'switch': { const n = { frank: 64, elba: 67, luca: 72, ludo: 76, luigi: 79 }[opt.who] || 72; osc('triangle', NOTE(n), t, 0, D, 0.08, 0.003, 0.15); osc('triangle', NOTE(n + 7), t + 0.06, 0, D, 0.08, 0.003, 0.2); break; }
      case 'ui': osc('sine', 880, t, 0, D, 0.05, 0.002, 0.06); break;
      case 'fire': noise(t, 0.8, D, 0.25, 'lowpass', 900); for (let i = 0; i < 10; i++) noise(t + Math.random() * 0.8, 0.02, D, 0.08, 'highpass', 5000); break;
      case 'melt': noise(t, 1.5, D, 0.1, 'bandpass', 3000, 3); break;
      case 'gate': { const { o } = osc('sawtooth', 90, t, 0, D, 0.12, 0.05, 0.6); o.frequency.linearRampToValueAtTime(60, t + 0.6); break; }
      case 'squeak': { const { o } = osc('sine', 1200, t, 0, D, 0.1, 0.005, 0.15); o.frequency.exponentialRampToValueAtTime(1800, t + 0.08); break; }
      case 'clank': noise(t, 0.2, D, 0.2, 'bandpass', 2500, 8); osc('square', 220, t, 0, D, 0.05, 0.002, 0.1); break;
      case 'plan': [60, 67, 72].forEach((n, i) => osc('sine', NOTE(n), t + i * 0.05, 0, D, 0.06, 0.01, 0.5)); break;
      case 'sniff': for (let i = 0; i < 3; i++) noise(t + i * 0.1, 0.06, D, 0.07, 'highpass', 2500); break;
      case 'voice': {
        const who = opt.who; if (who === 'luigi') { A.play('bark', { count: 1, small: true }); break; }
        const base = VOICE[who] || 220;
        const f = base * (0.9 + Math.random() * 0.35);
        const type = who === 'glitch' ? 'square' : who === 'mower' ? 'sawtooth' : 'triangle';
        osc(type, f, t, 0, D, who === 'glitch' ? 0.03 : 0.05, 0.004, 0.05);
        break;
      }
    }
  };
  // continuous mower engine
  A.engine = function (on, intensity = 1) {
    if (!A.ctx) return;
    if (on && !A.eng) {
      const ctx = A.ctx; const o = ctx.createOscillator(); const o2 = ctx.createOscillator(); const f = ctx.createBiquadFilter(); const g = ctx.createGain();
      const lfo = ctx.createOscillator(); const lg = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 55; o2.type = 'square'; o2.frequency.value = 27.5; lfo.frequency.value = 18; lg.gain.value = 8;
      lfo.connect(lg); lg.connect(o.frequency); f.type = 'lowpass'; f.frequency.value = 600; g.gain.value = 0;
      o.connect(f); o2.connect(f); f.connect(g); g.connect(A.sfx); o.start(); o2.start(); lfo.start();
      A.eng = { o, o2, g, f };
    }
    if (A.eng) {
      const t = A.ctx.currentTime;
      A.eng.g.gain.setTargetAtTime(on && !A.muted ? 0.07 * intensity : 0, t, 0.1);
      A.eng.o.frequency.setTargetAtTime(45 + 30 * intensity, t, 0.1);
    }
  };
})();
