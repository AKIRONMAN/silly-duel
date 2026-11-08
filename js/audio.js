/* Sound engine. Every sound is made live with the Web Audio API, so the game
   needs no audio files and stays tiny. Chiptune music, cartoon effects,
   a synthesized crowd laugh and an optional silly announcer voice. */
window.SD = window.SD || {};
(function () {
  'use strict';
  var ac = null, master = null, sfxBus = null, musBus = null, noiseBuf = null;
  var SFXG = 1.8, MUSIC_LEVEL = 0.38;      // loudness knobs: effects boost and music level
  var on = { sfx: SD.store.get('sfx') !== false, music: SD.store.get('music') !== false, voice: SD.store.get('voice') !== false };

  function ensure() {
    if (!ac) {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
        var comp = ac.createDynamicsCompressor();
        comp.threshold.value = -22; comp.knee.value = 12; comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.2;
        var clip = ac.createWaveShaper(), curve = new Float32Array(1024), drive = 2.2;
        for (var c = 0; c < 1024; c++) { var x = c / 512 - 1; curve[c] = Math.tanh(drive * x) / Math.tanh(drive); }
        clip.curve = curve; clip.oversample = '2x';
        master = ac.createGain(); master.gain.value = 2.0;
        master.connect(comp); comp.connect(clip); clip.connect(ac.destination);
        sfxBus = ac.createGain(); sfxBus.gain.value = 1.6; sfxBus.connect(master);
        musBus = ac.createGain(); musBus.gain.value = MUSIC_LEVEL; musBus.connect(master);
        var len = ac.sampleRate, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        noiseBuf = b;
      } catch (e) { ac = null; return null; }
    }
    if (ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
    return ac;
  }

  var silentEl = null;
  function keepAudible() {
    if (silentEl) return;
    try {
      var rate = 8000, hdr = new ArrayBuffer(46), v = new DataView(hdr);
      var w = function (o, str) { for (var i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
      w(0, 'RIFF'); v.setUint32(4, 38, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
      v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
      v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, 2, true);
      silentEl = new Audio(URL.createObjectURL(new Blob([hdr], { type: 'audio/wav' })));
      silentEl.loop = true; silentEl.volume = 0.01;
      var pr = silentEl.play(); if (pr && pr.catch) pr.catch(function () { silentEl = null; });
    } catch (e) { silentEl = null; }
  }
  function unlock() {
    keepAudible();
    var a = ensure();
    if (!a) return;
    try { var s = a.createBufferSource(); s.buffer = a.createBuffer(1, 1, 22050); s.connect(a.destination); s.start(0); } catch (e) {}
  }
  ['pointerdown', 'pointerup', 'keydown', 'touchstart', 'touchend', 'click'].forEach(function (ev) { window.addEventListener(ev, unlock, { passive: true }); });

  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  var NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function nm(s) { return s === '.' ? null : 12 * (+s.slice(-1) + 1) + NOTE[s[0]]; }

  /* one oscillator note. o.t = delay seconds, or o.at = absolute time */
  function tone(o) {
    var a = ensure(); if (!a) return;
    var t = o.at != null ? o.at : a.currentTime + (o.t || 0);
    var d = o.d || 0.15, v = (o.v == null ? 0.2 : o.v) * (o.dest ? 1 : SFXG), atk = o.a || 0.006;
    var osc = a.createOscillator(), g = a.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + d);
    if (o.detune) osc.detune.value = o.detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    if (o.lp) { var f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); f.connect(g); } else osc.connect(g);
    g.connect(o.dest || sfxBus);
    if (o.vib) {
      var l = a.createOscillator(), lg = a.createGain();
      l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1];
      l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + d + 0.05);
    }
    osc.start(t); osc.stop(t + d + 0.05);
  }

  /* filtered noise burst */
  function hiss(o) {
    var a = ensure(); if (!a) return;
    var t = o.at != null ? o.at : a.currentTime + (o.t || 0), d = o.d || 0.2;
    var src = a.createBufferSource(); src.buffer = noiseBuf;
    var f = a.createBiquadFilter(); f.type = o.type || 'lowpass';
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + d);
    f.Q.value = o.q || 1;
    var g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime((o.v || 0.3) * (o.dest ? 1 : SFXG), t + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxBus);
    src.start(t, Math.random() * 0.4); src.stop(t + d + 0.05);
  }

  /* wobbly raspberry, the base of burps and deflating balloons */
  function rasp(f0, f1, d, v, delay) {
    var a = ensure(); if (!a) return;
    var t = a.currentTime + (delay || 0);
    var o = a.createOscillator(), g = a.createGain(), lp = a.createBiquadFilter(), l = a.createOscillator(), lg = a.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
    lp.type = 'lowpass'; lp.frequency.value = 700;
    g.gain.setValueAtTime(v * 0.5, t); g.gain.setTargetAtTime(0.0001, t + d * 0.8, d * 0.1);
    l.type = 'square'; l.frequency.value = 30; lg.gain.value = v * 0.5;
    l.connect(lg); lg.connect(g.gain);
    o.connect(lp); lp.connect(g); g.connect(sfxBus);
    o.start(t); l.start(t); o.stop(t + d + 0.2); l.stop(t + d + 0.2);
  }

  /* one "ha" of a laugh: a buzzy tone through two vowel-like filters */
  function ha(at, pitch, vol) {
    var a = ensure(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain(), f1 = a.createBiquadFilter(), f2 = a.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(pitch * 1.18, at);
    o.frequency.exponentialRampToValueAtTime(pitch * 0.82, at + 0.13);
    f1.type = 'bandpass'; f1.frequency.value = 780; f1.Q.value = 3;
    f2.type = 'bandpass'; f2.frequency.value = 1350; f2.Q.value = 3;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(sfxBus);
    o.start(at); o.stop(at + 0.16);
  }

  function gate(fn) { return function () { if (!on.sfx) return; if (!ensure()) return; return fn.apply(null, arguments); }; }

  var sfx = {
    tap: gate(function () { tone({ type: 'square', f: 700, f2: 520, d: 0.05, v: 0.12 }); }),
    kick: gate(function () { tone({ type: 'sine', f: 230, f2: 70, d: 0.16, v: 0.5 }); tone({ type: 'triangle', f: 440, f2: 120, d: 0.06, v: 0.25 }); hiss({ d: 0.03, type: 'highpass', f: 3000, v: 0.12 }); }),
    fall: gate(function (d) { tone({ type: 'sine', f: 1500, f2: 420, d: d || 0.8, v: 0.1 }); }),
    gasp: gate(function () { tone({ type: 'sine', f: 500, f2: 1100, d: 0.18, v: 0.3 }); tone({ type: 'triangle', f: 900, f2: 1500, t: 0.12, d: 0.15, v: 0.2 }); }),
    perfect: gate(function () { tone({ type: 'square', f: 1175, d: 0.07, v: 0.1 }); tone({ type: 'square', f: 1568, t: 0.06, d: 0.14, v: 0.1 }); }),
    blip: gate(function (n) { tone({ type: 'square', f: 330 * Math.pow(2, (n || 0) / 12), d: 0.06, v: 0.1 }); }),
    select: gate(function () { tone({ type: 'square', f: 523, d: 0.07, v: 0.12 }); tone({ type: 'square', f: 784, t: 0.07, d: 0.1, v: 0.12 }); }),
    coin: gate(function () { tone({ type: 'square', f: 988, d: 0.07, v: 0.11 }); tone({ type: 'square', f: 1319, t: 0.07, d: 0.3, v: 0.11 }); }),
    count: gate(function (n) {
      if (n > 0) tone({ type: 'square', f: 440, d: 0.14, v: 0.16 });
      else [659, 880, 1319].forEach(function (f, i) { tone({ type: 'square', f: f, t: i * 0.06, d: 0.18, v: 0.15 }); });
    }),
    boing: gate(function () { tone({ type: 'sine', f: 170, f2: 560, d: 0.38, v: 0.4, vib: [18, 30] }); }),
    pop: gate(function () { hiss({ d: 0.08, type: 'highpass', f: 1500, v: 0.5 }); tone({ type: 'sine', f: 700, f2: 90, d: 0.14, v: 0.5 }); }),
    deflate: gate(function () { rasp(320, 70, 0.5, 0.3); }),
    burp: gate(function (size) { rasp(135, 68, 0.25 + (size || 0) * 0.5, 0.3); }),
    splat: gate(function () { hiss({ d: 0.35, type: 'lowpass', f: 2400, f2: 220, v: 0.8 }); tone({ type: 'sine', f: 320, f2: 90, d: 0.3, v: 0.6 }); tone({ type: 'sawtooth', f: 380, f2: 120, d: 0.2, v: 0.2, lp: 1200 }); }),
    whoosh: gate(function () { hiss({ d: 0.32, type: 'bandpass', f: 250, f2: 2600, q: 2, v: 0.35 }); }),
    toss: gate(function () { hiss({ d: 0.16, type: 'bandpass', f: 500, f2: 2200, q: 2, v: 0.3 }); tone({ type: 'square', f: 380, f2: 760, d: 0.1, v: 0.08 }); }),
    ding: gate(function () { tone({ type: 'sine', f: 1568, d: 0.6, v: 0.32 }); tone({ type: 'sine', f: 2349, t: 0.02, d: 0.5, v: 0.16 }); }),
    buzz: gate(function () { tone({ type: 'sawtooth', f: 110, d: 0.35, v: 0.25, lp: 800 }); tone({ type: 'square', f: 117, d: 0.35, v: 0.1 }); }),
    tick: gate(function (p) { tone({ type: 'square', f: 1000 * (p || 1), d: 0.03, v: 0.1 }); }),
    squeak: gate(function () { tone({ type: 'sine', f: 1200, f2: 2200, d: 0.08, v: 0.25 }); tone({ type: 'sine', f: 1800, f2: 2700, t: 0.09, d: 0.07, v: 0.22 }); }),
    bwoop: gate(function () { tone({ type: 'sine', f: 520, f2: 240, d: 0.22, v: 0.3 }); }),
    kazoo: gate(function () { tone({ type: 'sawtooth', f: 440, f2: 520, d: 0.28, v: 0.14, lp: 2200, vib: [30, 18] }); }),
    bonk: gate(function () { tone({ type: 'sine', f: 380, f2: 110, d: 0.14, v: 0.5 }); tone({ type: 'square', f: 560, f2: 170, d: 0.1, v: 0.18 }); hiss({ d: 0.04, type: 'highpass', f: 2000, v: 0.3 }); }),
    slip: gate(function () { tone({ type: 'sine', f: 1800, f2: 250, d: 0.5, v: 0.25, vib: [9, 40] }); }),
    airhorn: gate(function () { [466, 587, 698].forEach(function (f, i) { tone({ type: 'sawtooth', f: f, d: 0.6, v: 0.16, lp: 2600, detune: i * 6, vib: [6, 4] }); }); }),
    drum: gate(function (d) {
      var n = Math.floor((d || 1) / 0.055);
      for (var i = 0; i < n; i++) hiss({ t: i * 0.055, d: 0.05, type: 'bandpass', f: 800, q: 1.2, v: 0.12 + 0.25 * (i / n) });
    }),
    trombone: gate(function () {
      [[311, 0, 0.25], [294, 0.28, 0.25], [277, 0.56, 0.25]].forEach(function (n) { tone({ type: 'sawtooth', f: n[0], t: n[1], d: n[2], v: 0.2, lp: 1500 }); });
      tone({ type: 'sawtooth', f: 262, f2: 190, t: 0.84, d: 0.8, v: 0.2, lp: 1500, vib: [7, 5] });
    }),
    /* big win fanfare: rising arpeggio, sparkle, then a held major chord */
    win: gate(function () {
      [523, 659, 784, 1047].forEach(function (f, i) { tone({ type: 'square', f: f, t: i * 0.1, d: 0.16, v: 0.13 }); tone({ type: 'triangle', f: f / 2, t: i * 0.1, d: 0.2, v: 0.2 }); });
      [1047, 1319, 1568].forEach(function (f, i) { tone({ type: 'square', f: f, t: 0.44, d: 0.9, v: 0.1, detune: i * 5, vib: [6, 4] }); });
      tone({ type: 'triangle', f: 262, t: 0.44, d: 0.9, v: 0.25 });
      [2093, 2637, 3136, 2637, 3136, 4186].forEach(function (f, i) { tone({ type: 'sine', f: f, t: 0.5 + i * 0.07, d: 0.25, v: 0.07 }); });
      hiss({ t: 0.44, d: 0.5, type: 'highpass', f: 5000, v: 0.12 });
    }),
    /* sad trombone: wah wah wah waaah */
    lose: gate(function () {
      [[392, 0, 0.3], [370, 0.34, 0.3], [349, 0.68, 0.3]].forEach(function (n) {
        tone({ type: 'sawtooth', f: n[0], f2: n[0] * 0.97, t: n[1], d: n[2], v: 0.22, lp: 1100 });
        tone({ type: 'square', f: n[0] / 2, t: n[1], d: n[2], v: 0.08, lp: 700 });
      });
      tone({ type: 'sawtooth', f: 330, f2: 196, t: 1.04, d: 1.0, v: 0.24, lp: 1000, vib: [6, 7] });
      tone({ type: 'square', f: 165, f2: 98, t: 1.04, d: 1.0, v: 0.08, lp: 600, vib: [6, 3] });
    }),
    /* short point jingles for one round */
    roundWin: gate(function () {
      [659, 784, 1047, 1319].forEach(function (f, i) { tone({ type: 'square', f: f, t: i * 0.065, d: i === 3 ? 0.4 : 0.1, v: 0.12 }); });
      tone({ type: 'sine', f: 2637, t: 0.26, d: 0.5, v: 0.1 }); tone({ type: 'triangle', f: 330, t: 0.2, d: 0.35, v: 0.2 });
    }),
    roundLose: gate(function () {
      tone({ type: 'sawtooth', f: 311, f2: 294, d: 0.22, v: 0.2, lp: 1200 });
      tone({ type: 'sawtooth', f: 262, f2: 175, t: 0.24, d: 0.45, v: 0.22, lp: 1000, vib: [7, 5] });
    }),
    /* caught moving: uh-oh */
    busted: gate(function () {
      hiss({ d: 0.12, type: 'bandpass', f: 4000, f2: 600, q: 2, v: 0.35 });
      tone({ type: 'square', f: 880, f2: 660, t: 0.04, d: 0.14, v: 0.16 });
      tone({ type: 'square', f: 660, f2: 440, t: 0.2, d: 0.2, v: 0.16 });
      tone({ type: 'sawtooth', f: 330, f2: 120, t: 0.4, d: 0.4, v: 0.2, lp: 900, vib: [9, 14] });
      tone({ type: 'sine', f: 180, f2: 60, t: 0.4, d: 0.25, v: 0.4 });
    }),
    ooh: gate(function () { [0, 5, 9].forEach(function (c, i) { tone({ type: 'sawtooth', f: 330 * Math.pow(2, c / 12), f2: 270 * Math.pow(2, c / 12), d: 0.9, a: 0.15, v: 0.16, lp: 1100, detune: i * 7 }); }); }),
    cheer: gate(function () { hiss({ d: 1, a: 0.3, type: 'bandpass', f: 1800, q: 0.7, v: 0.35 }); hiss({ d: 0.8, a: 0.2, type: 'bandpass', f: 900, q: 0.8, v: 0.25 }); }),
    tada: gate(function () { [523, 659, 784, 1047].forEach(function (f, i) { tone({ type: 'square', f: f, t: i * 0.09, d: i === 3 ? 0.6 : 0.14, v: 0.12 }); tone({ type: 'triangle', f: f / 2, t: i * 0.09, d: i === 3 ? 0.6 : 0.14, v: 0.14 }); }); }),
    boom: gate(function () { hiss({ d: 0.8, type: 'lowpass', f: 3200, f2: 120, v: 1.0 }); tone({ type: 'sine', f: 200, f2: 50, d: 0.7, v: 0.8 }); tone({ type: 'sawtooth', f: 260, f2: 70, d: 0.6, v: 0.3, lp: 1000 }); }),
    laugh: gate(function (delay) {
      var a = ensure(), t0 = a.currentTime + (delay || 0);
      [[210, 0], [170, 0.06], [285, 0.12], [240, 0.03], [190, 0.09]].forEach(function (v) {
        for (var i = 0; i < 7; i++) ha(t0 + v[1] + i * 0.17, v[0] * (1 - i * 0.025), 0.9 - i * 0.07);
      });
    })
  };

  /* hold-to-inflate whistle that rises with the balloon */
  function inflate() {
    var a = on.sfx ? ensure() : null;
    if (!a) return { set: function () {}, stop: function () {} };
    var o = a.createOscillator(), g = a.createGain(), l = a.createOscillator(), lg = a.createGain(), t = a.currentTime;
    o.type = 'triangle'; o.frequency.value = 220;
    l.frequency.value = 9; lg.gain.value = 14; l.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.1, t + 0.05);
    o.connect(g); g.connect(sfxBus); o.start(); l.start();
    return {
      set: function (p) { var n = a.currentTime; o.frequency.setTargetAtTime(200 + p * 700, n, 0.03); l.frequency.setTargetAtTime(9 + p * 16, n, 0.05); },
      stop: function () { try { var n = a.currentTime; g.gain.setTargetAtTime(0.0001, n, 0.02); o.stop(n + 0.12); l.stop(n + 0.12); } catch (e) {} }
    };
  }

  /* ---------- music: every skin has its own original song (composed by a tiny seeded generator, so no audio files) ---------- */
  var SCALES = { maj: [0, 2, 4, 5, 7, 9, 11], min: [0, 2, 3, 5, 7, 8, 10], dor: [0, 2, 3, 5, 7, 9, 10], mix: [0, 2, 4, 5, 7, 9, 10], lyd: [0, 2, 4, 6, 7, 9, 11], phr: [0, 1, 3, 5, 7, 8, 10], hmin: [0, 2, 3, 5, 7, 8, 11], pent: [0, 2, 4, 7, 9, 12, 14] };
  /* one theme per skin id: root note, scale, tempo, chord loop (scale degrees), sounds */
  var THEMES = [
    { r: 60, sc: 'maj', bpm: 150, pr: [0, 5, 3, 4], lead: 'square', bass: 'oct', dr: 'four', arp: 0 },        // BUBBLES: bouncy pop
    { r: 55, sc: 'mix', bpm: 142, pr: [0, 6, 3, 0], lead: 'square', bass: 'oct', dr: 'rock', arp: 1 },        // NOODLE: slurpy groove
    { r: 53, sc: 'maj', bpm: 128, pr: [0, 3, 4, 3], lead: 'tri', bass: 'tri', dr: 'shuf', arp: 0 },           // WAFFLE: breakfast swing
    { r: 62, sc: 'dor', bpm: 136, pr: [0, 3, 0, 4], lead: 'saw', bass: 'walk', dr: 'break', arp: 0 },         // PICKLE: funky
    { r: 64, sc: 'pent', bpm: 120, pr: [0, 2, 3, 2], lead: 'bell', bass: 'tri', dr: 'half', arp: 1 },         // MOCHI: cute
    { r: 57, sc: 'lyd', bpm: 118, pr: [0, 1, 4, 0], lead: 'tri', bass: 'tri', dr: 'half', arp: 1 },           // PEACH: dreamy
    { r: 57, sc: 'phr', bpm: 110, pr: [0, 1, 0, 6], lead: 'sine', bass: 'saw', dr: 'half', arp: 0 },          // GHOSTY: spooky
    { r: 52, sc: 'min', bpm: 148, pr: [0, 5, 2, 6], lead: 'saw', bass: 'oct', dr: 'break', arp: 1 },          // ROBO: machine
    { r: 59, sc: 'hmin', bpm: 126, pr: [0, 3, 6, 4], lead: 'pulse', bass: 'walk', dr: 'half', arp: 1 },       // ALIEN: weird
    { r: 50, sc: 'min', bpm: 112, pr: [0, 5, 2, 4], lead: 'brass', bass: 'tri', dr: 'four', arp: 0 },         // KING: majestic
    { r: 49, sc: 'hmin', bpm: 138, pr: [0, 5, 3, 4], lead: 'saw', bass: 'walk', dr: 'half', arp: 1 },         // DRAGON: heavy
    { r: 59, sc: 'dor', bpm: 124, pr: [0, 3, 5, 4], lead: 'bell', bass: 'tri', dr: 'half', arp: 1 },          // GALAXY: floaty
    { r: 60, sc: 'maj', bpm: 132, pr: [0, 4, 5, 3], lead: 'brass', bass: 'oct', dr: 'four', arp: 1 },         // GOLDEN: triumph
    { r: 62, sc: 'pent', bpm: 140, pr: [0, 4, 3, 5], lead: 'bell', bass: 'oct', dr: 'four', arp: 1 },         // UNICORN: sparkle
    { r: 54, sc: 'min', bpm: 150, pr: [0, 5, 3, 6], lead: 'pulse', bass: 'oct', dr: 'rock', arp: 1 },         // PHOENIX: rising
    { r: 57, sc: 'lyd', bpm: 130, pr: [0, 4, 1, 5], lead: 'bell', bass: 'walk', dr: 'four', arp: 1 }          // PRISM: shimmering
  ];
  function rngOf(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var RHY = ['x.xx.x.x', 'x..xx.x.', 'xxx.x.x.', 'x.x.xxx.', 'x.xxx.x.', 'x..x.xx.', 'xx.xx.x.', 'x.x.x.xx'];
  /* build a 64-step melody (8 bars of 8 eighth-notes) over the chord loop: A phrase, B phrase */
  function compose(th, id, calm) {
    var rnd = rngOf(1000 + id * 977 + (calm ? 5 : 0)), sc = SCALES[th.sc], n = sc.length;
    function deg(d) { var o = Math.floor(d / n); return th.r + sc[((d % n) + n) % n] + (th.sc === 'pent' ? 0 : 0) + o * 12; }
    if (th.sc === 'pent') deg = function (d) { var o = Math.floor(d / 5), k = ((d % 5) + 5) % 5; return th.r + [0, 2, 4, 7, 9][k] + o * 12; };
    var nn = th.sc === 'pent' ? 5 : 7;
    function chordDeg(c) { return nn === 5 ? [c, c + 1, c + 2] : [c, c + 2, c + 4]; }
    var lead = [], last = 0 + nn, m1 = RHY[Math.floor(rnd() * RHY.length)], m2 = RHY[Math.floor(rnd() * RHY.length)], b1 = RHY[Math.floor(rnd() * RHY.length)];
    for (var ph = 0; ph < 2; ph++) {
      for (var bar = 0; bar < 4; bar++) {
        var chord = th.pr[bar], ct = chordDeg(chord), rh = ph === 0 ? (bar % 2 ? m2 : m1) : (bar % 2 ? b1 : m1);
        var first = true, lo = nn, hi = nn * 2 + 2, mid = nn + 3;
        var near = function (target) { var best = ct[0] + nn, bd = 99; ct.forEach(function (c) { [-nn, 0, nn].forEach(function (o) { var cand = c + nn + o; if (cand >= lo && cand <= hi && Math.abs(cand - target) < bd) { bd = Math.abs(cand - target); best = cand; } }); }); return best; };
        for (var s = 0; s < 8; s++) {
          if (rh[s] !== 'x') { lead.push(null); continue; }
          var d;
          if (first) { d = near(last + (rnd() < 0.5 ? 1 : -1) * Math.floor(rnd() * 3)); first = false; }
          else {
            var pull = last > mid + 2 ? -1 : last < mid - 2 ? 1 : 0, step = [-2, -1, -1, 1, 1, 2][Math.floor(rnd() * 6)];
            if (pull && rnd() < 0.6) step = pull * (1 + Math.floor(rnd() * 2));
            d = last + step; if (d === last) d += pull || 1;
          }
          d = Math.max(lo, Math.min(hi, d)); last = d; lead.push(deg(d));
        }
        if (bar === 3) { for (var q = 7; q >= 0; q--) if (lead[lead.length - 8 + q] != null) { var r = near(last); lead[lead.length - 8 + q] = deg(ph === 0 ? r : ct[0] + nn + (last > mid ? 0 : 0)); last = r; break; } }
      }
    }
    return { lead: lead, deg: deg, chordDeg: chordDeg };
  }
  var seq = { timer: null, mode: null, step: 0, next: 0, dur: 0.2, th: null, song: null, id: 0 };
  var want = null, musDelay = null;

  function leadVoice(th, f, t, d, v, calm) {
    var o = { f: f, at: t, d: d, v: v, dest: musBus };
    switch (th.lead) {
      case 'saw': o.type = 'sawtooth'; o.lp = 2400; o.vib = [5.5, 6]; break;
      case 'tri': o.type = 'triangle'; o.v = v * 1.7; break;
      case 'sine': o.type = 'sine'; o.v = v * 2; o.vib = [4.5, 7]; o.d = d * 1.6; break;
      case 'bell': o.type = 'sine'; o.v = v * 1.8; o.a = 0.003; o.d = d * 2.2; tone({ type: 'sine', f: f * 2.01, at: t, d: d * 1.1, v: v * 0.5, dest: musBus }); break;
      case 'brass': o.type = 'sawtooth'; o.lp = 1700; o.a = 0.03; o.d = d * 1.3; o.v = v * 1.1; o.vib = [5, 5]; break;
      case 'pulse': o.type = 'square'; o.detune = 8; o.lp = 3000; tone({ type: 'square', f: f, at: t, d: d, v: v * 0.6, dest: musBus, detune: -9, lp: 3000 }); break;
      default: o.type = 'square'; o.lp = 3400;
    }
    tone(o);
  }
  function playStep(step, t) {
    var th = seq.th, song = seq.song, calm = seq.mode === 'menu', i = step % 64, bar = Math.floor(i / 8) % 4, s = i % 8, chord = th.pr[bar];
    var root = song.deg(chord) - 24, cd = song.chordDeg(chord), dur = seq.dur;
    var n = song.lead[i];
    if (n != null) leadVoice(th, midi(n), t, dur * 0.9, calm ? 0.045 : 0.06, calm);
    // pad: the chord, held for the bar
    if (s === 0) cd.forEach(function (c) { tone({ type: calm ? 'triangle' : 'sine', f: midi(song.deg(c) - 12), at: t, d: dur * 8, v: calm ? 0.035 : 0.02, a: 0.15, dest: musBus, lp: 1400 }); });
    // bass
    var bv = 0.15;
    if (th.bass === 'tri') { if (s === 0 || s === 4 || (s === 6 && !calm)) tone({ type: 'triangle', f: midi(root), at: t, d: dur * 1.8, v: bv, dest: musBus }); }
    else if (th.bass === 'saw') { if (s % 2 === 0) tone({ type: 'sawtooth', f: midi(root), at: t, d: dur * 1.6, v: 0.09, dest: musBus, lp: 500 }); }
    else if (th.bass === 'oct') { tone({ type: 'triangle', f: midi(root + (s % 2 ? 12 : 0)), at: t, d: dur * 0.85, v: bv * 0.8, dest: musBus }); }
    else { var wk = [0, 0, 7, 12, 0, 7, 5, 7][s]; if (s % 2 === 0 || !calm) tone({ type: 'triangle', f: midi(root + wk), at: t, d: dur * 1.3, v: bv, dest: musBus }); }
    // arpeggio shimmer (game and some menus)
    if (th.arp && (!calm || s % 2 === 0)) tone({ type: 'square', f: midi(song.deg(cd[s % 3]) + 12), at: t, d: dur * 0.5, v: calm ? 0.012 : 0.02, dest: musBus, lp: 4200 });
    // drums
    var kick = function (v) { tone({ type: 'sine', f: 150, f2: 45, at: t, d: 0.13, v: v, dest: musBus }); };
    var snare = function (v) { hiss({ at: t, d: 0.11, type: 'bandpass', f: 1900, v: v, dest: musBus }); };
    var hat = function (v) { hiss({ at: t, d: 0.03, type: 'highpass', f: 7500, v: v, dest: musBus }); };
    var dr = th.dr, kv = calm ? 0.16 : 0.3;
    if (dr === 'four') { if (s % 2 === 0) kick(kv); if (!calm && (s === 2 || s === 6)) snare(0.08); hat(0.025); }
    else if (dr === 'rock') { if (s === 0 || s === 4 || (s === 6 && !calm)) kick(kv); if (s === 2 || s === 6) snare(calm ? 0.04 : 0.09); if (s % 2 === 1) hat(0.03); }
    else if (dr === 'break') { if (s === 0 || s === 3 || s === 5) kick(kv); if (s === 2 || s === 6) snare(calm ? 0.04 : 0.1); hat(0.02); }
    else if (dr === 'shuf') { if (s === 0 || s === 4) kick(kv); if (s === 2 || s === 6) snare(calm ? 0.035 : 0.08); if (s % 2 === 1) hat(0.035); }
    else { if (s === 0) kick(kv); if (s === 4) snare(calm ? 0.035 : 0.09); if (!calm || s % 2 === 0) hat(0.02); }
  }
  function musicTick() {
    if (!ac || !seq.mode) return;
    while (seq.next < ac.currentTime + 0.25) { playStep(seq.step, seq.next); seq.next += seq.dur; seq.step++; }
  }
  function curSkin() { try { var sk = SD.store.get('skins'); var id = sk && sk[0] | 0; return id >= 0 && id < THEMES.length ? id : 1; } catch (e) { return 1; } }
  function musicStart(mode, skin) {
    want = mode;
    if (!on.music) return;
    var a = ensure(); if (!a) return;
    var id = skin != null ? skin : curSkin();
    if (seq.timer && seq.mode === mode && seq.id === id) return;
    if (seq.timer) clearInterval(seq.timer);
    var th = THEMES[id], calm = mode === 'menu';
    seq.mode = mode; seq.id = id; seq.th = th; seq.song = compose(th, id, calm); seq.step = 0;
    seq.dur = 60 / (th.bpm * (calm ? 0.82 : 1)) / 2; seq.next = a.currentTime + 0.08;
    if (!musDelay) {                                           // a soft echo makes the little synths sound bigger
      var dl = a.createDelay(1), fb = a.createGain(), wet = a.createGain();
      dl.delayTime.value = seq.dur * 3; fb.gain.value = 0.3; wet.gain.value = 0.28;
      musBus.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(master);
      musDelay = dl;
    }
    try { musDelay.delayTime.setTargetAtTime(seq.dur * 3, a.currentTime, 0.05); } catch (e) {}
    musBus.gain.cancelScheduledValues(a.currentTime);
    musBus.gain.setTargetAtTime(MUSIC_LEVEL, a.currentTime, 0.05);
    seq.timer = setInterval(musicTick, 40);
  }
  function musicStop() {
    want = null;
    if (seq.timer) { clearInterval(seq.timer); seq.timer = null; }
    seq.mode = null;
    if (ac && musBus) musBus.gain.setTargetAtTime(0.0001, ac.currentTime, 0.08);
  }
  function musicRefresh() { var m = want; if (m && seq.timer) { seq.id = -1; musicStart(m); } }

  /* ---------- silly announcer (uses the phone's own text to speech) ---------- */
  var voice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    var vs = speechSynthesis.getVoices() || [];
    voice = vs.filter(function (v) { return /^en/i.test(v.lang); })[0] || null;
  }
  if ('speechSynthesis' in window) { pickVoice(); try { speechSynthesis.onvoiceschanged = pickVoice; } catch (e) {} }
  function say(text, o) {
    if (!on.voice || !('speechSynthesis' in window)) return;
    o = o || {};
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.pitch = o.pitch || 1.8; u.rate = o.rate || 1.08; u.volume = 1;
      if (voice) u.voice = voice;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  function setOn(kind, val) {
    on[kind] = !!val;
    SD.store.set(kind, !!val);
    if (kind === 'music') { if (val) { if (want) musicStart(want); } else if (seq.timer) { var w = want; musicStop(); want = w; } }
    if (kind === 'voice' && !val && 'speechSynthesis' in window) { try { speechSynthesis.cancel(); } catch (e) {} }
  }

  function setPaused(p) { if (!ac) return; try { if (p) ac.suspend(); else ac.resume(); } catch (e) {} }

  SD.audio = {
    sfx: sfx, inflate: inflate, say: say, setOn: setOn, setPaused: setPaused,
    unlock: unlock, running: function () { return !!ac && ac.state === 'running'; },
    isOn: function (k) { return on[k]; },
    music: { start: musicStart, stop: musicStop, refresh: musicRefresh, debug: { compose: compose, themes: THEMES }, preview: function (skin) { musicStart('menu', skin); } }
  };
})();
