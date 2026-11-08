/* Visual effects: confetti, sparkles, cream splats, screen shake, flashes, pop-up words. */
window.SD = window.SD || {};
(function () {
  'use strict';
  var cv, g, W = 0, H = 0, dpr = 1, parts = [], running = false, last = 0;
  var COLORS = ['#ff8cc3', '#6fcfff', '#ffd84d', '#76e6a8', '#ff4d6d', '#b48cff', '#ffffff'];
  var INK = '#2a1650';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init() {
    cv = document.getElementById('fx');
    g = cv.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  function add(p) {
    if (parts.length > 600) return;
    parts.push(p);
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
  }

  function star(x, y, r) {
    g.beginPath();
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
  }

  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    g.clearRect(0, 0, W, H);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life -= dt;
      if (p.life <= 0 || p.y > H + 60) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.vx *= p.drag; p.vy *= p.drag;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.r += p.vr * dt;
      var a = Math.min(1, p.life / 0.4);
      g.save();
      g.globalAlpha = a;
      g.translate(p.x, p.y);
      g.rotate(p.r);
      g.fillStyle = p.c;
      if (p.shape === 'rect') { g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
      else if (p.shape === 'star') { star(0, 0, p.s); g.fill(); }
      else if (p.shape === 'blob') { g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, p.s, 0, 7); g.fill(); g.stroke(); }
      else { g.beginPath(); g.arc(0, 0, p.s, 0, 7); g.fill(); }
      g.restore();
    }
    if (parts.length) requestAnimationFrame(loop); else { running = false; g.clearRect(0, 0, W, H); }
  }

  function confetti(x, y, n, power) {
    if (reduce) n = Math.ceil(n / 3);
    power = power || 1;
    for (var i = 0; i < n; i++) {
      var a = rnd(-Math.PI, 0), sp = rnd(180, 620) * power;
      add({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 900, drag: 0.992, life: rnd(1.4, 2.6), s: rnd(7, 13), c: pick(COLORS), r: rnd(0, 6), vr: rnd(-9, 9), shape: 'rect' });
    }
  }
  function rain(n) {
    if (reduce) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) {
      add({ x: rnd(0, W), y: rnd(-80, -10), vx: rnd(-40, 40), vy: rnd(60, 220), g: 120, drag: 0.999, life: rnd(2.2, 3.6), s: rnd(7, 12), c: pick(COLORS), r: rnd(0, 6), vr: rnd(-6, 6), shape: 'rect' });
    }
  }
  function burst(x, y, n, colors) {
    colors = colors || COLORS;
    for (var i = 0; i < n; i++) {
      var a = rnd(0, 6.28), sp = rnd(120, 420);
      add({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 300, drag: 0.96, life: rnd(0.5, 1), s: rnd(6, 12), c: pick(colors), r: 0, vr: rnd(-4, 4), shape: 'star' });
    }
  }
  function cream(x, y, n) {
    for (var i = 0; i < n; i++) {
      var a = rnd(-Math.PI, 0), sp = rnd(120, 520);
      add({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 1300, drag: 0.985, life: rnd(0.8, 1.5), s: rnd(5, 13), c: '#fffdf3', r: 0, vr: 0, shape: 'blob' });
    }
  }

  function center(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function popText(x, y, text, cls) {
    var d = document.createElement('div');
    d.className = 'poptext ' + (cls || '');
    d.textContent = text;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    document.getElementById('app').appendChild(d);
    d.addEventListener('animationend', function () { if (d.parentNode) d.parentNode.removeChild(d); });
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1800);
  }

  var shakeT = 0;
  function shake(ms) {
    if (reduce) return;
    var app = document.getElementById('app');
    app.classList.remove('shake'); void app.offsetWidth; app.classList.add('shake');
    clearTimeout(shakeT);
    shakeT = setTimeout(function () { app.classList.remove('shake'); }, ms || 420);
  }
  function flash(color) {
    if (reduce) return;
    var f = document.getElementById('flash');
    f.style.background = color || '#fff';
    f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  }
  function vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  SD.fx = { init: init, confetti: confetti, rain: rain, burst: burst, cream: cream, popText: popText, shake: shake, flash: flash, vibrate: vibrate, center: center };
})();
