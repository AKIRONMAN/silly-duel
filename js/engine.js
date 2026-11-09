/* Game flow: modes, rounds, ranking, tie-breaks and the pie ceremony.
   A microgame is a small object in SD.games (see js/games/*.js). */
window.SD = window.SD || {};
SD.games = SD.games || [];
(function () {
  'use strict';
  var CH = SD.art.CHARS, art = SD.art, au = SD.audio, fx = SD.fx;
  var $ = function (s) { return document.querySelector(s); };
  var arenaEl, padsEl, centerEl, timerEl, exitEl, ceremonyEl;
  var pads = [];
  var S = null;           // current session, null while on the home screen
  var keyHeld = {};

  var ROASTS = ['Pie suits you.', 'Dessert is served.', 'Wallet out!', 'So tasty. So sad.', 'Nice try!', 'Splat life.', 'Cream of the crop.', 'Too slow, pie face.'];
  function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function mrnd(a) { return a[Math.floor(S.mrng() * a.length)]; }   // shared random: same on both phones online
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(S.mrng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }   // shared random: same order on both phones

  /* ---------- timers owned by the session ---------- */
  function later(fn, ms) {
    if (!S) return 0;
    var id = setTimeout(function () { S && fn(); }, ms);
    S.timers.push(id);
    return id;
  }
  /* key bindings: player 1 key is used for 'me' everywhere (offline, bot and online) */
  function nk(e) { var k = e.key || ''; return k === ' ' ? 'SPACE' : k.toUpperCase(); }
  function padKey(i) {
    var keys = SD.store.get('keys') || ['Q', 'P'];
    if (S && (S.online || S.bots.length)) return i === S.me ? keys[0] : null;
    return keys[i] || CH[i].key;
  }
  function clearAll() {
    if (!S) return;
    if (S.pickEnd) S.pickEnd();
    S.timers.forEach(clearTimeout); S.timers = [];
    S.frameFn = null; cancelAnimationFrame(S.raf); S.raf = 0;
  }
  function setFrame(fn) {
    S.frameFn = fn; S.last = performance.now();
    if (!S.raf) S.raf = requestAnimationFrame(tickFrame);
  }
  function tickFrame(now) {
    if (!S || !S.frameFn) { if (S) S.raf = 0; return; }
    var dt = Math.min(0.05, (now - S.last) / 1000); S.last = now;
    S.frameFn(dt, now);
    S.raf = (S && S.frameFn) ? requestAnimationFrame(tickFrame) : 0;
  }

  /* ---------- screen helpers ---------- */
  function setCenter(html, cls) {
    var c = $('#centerInner');
    c.className = cls || '';
    c.innerHTML = html;
    if (cls) { c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; }
  }
  function clearCenter() { var c = $('#centerInner'); c.className = ''; c.innerHTML = ''; }
  function showGo(text) {
    var g = $('#goText');
    g.textContent = text;
    g.classList.remove('on'); void g.offsetWidth; g.classList.add('on');
    later(function () { g.classList.remove('on'); }, 800);
  }
  function showTimer(ms, cb) {
    var i = timerEl.firstElementChild;
    timerEl.classList.add('on');
    i.style.transition = 'none'; i.style.width = '100%'; void i.offsetWidth;
    i.style.transition = 'width ' + ms + 'ms linear'; i.style.width = '0%';
    if (cb) later(cb, ms);
  }
  function hideTimer() { timerEl.classList.remove('on'); var i = timerEl.firstElementChild; i.style.transition = 'none'; i.style.width = '0%'; }
  function showExit(v) { exitEl.hidden = true; }
  function askLeave() {                                 // EXIT asks first, so a slip does not end the match
    if (!S || document.getElementById('leaveBox')) return;
    var d = document.createElement('div'); d.id = 'leaveBox';
    d.innerHTML = '<div class="lv-card"><h2>LEAVE THE MATCH?</h2><p>' + (S.online ? 'Your rival will win.' : 'This match will end.') + '</p><div class="lv-row"><button type="button" class="pk-btn go" id="lvStay">STAY</button><button type="button" class="pk-btn leave" id="lvGo">LEAVE</button></div></div>';
    document.body.appendChild(d);
    d.querySelector('#lvStay').addEventListener('click', function () { au.sfx.tap(); d.remove(); });
    d.querySelector('#lvGo').addEventListener('click', function () { d.remove(); E.home(); });
  }

  /* my side is always BLUE, the rival (player two offline, the other person online) is always PINK */
  function colorOf(i) {
    if (S && S.n > 2) return CH[i];
    var mine = S && S.mode !== 'boss' && (S.bots.length || S.online) ? S.me : 0;
    return i === mine ? CH[1] : CH[0];
  }
  art.padColor = colorOf;
  function padLabel(i) {
    if (S && (S.online || S.sim) && i === S.me) return esc(S.names && S.names[i] ? S.names[i] : SD.store.name(0)) + '<i class="you-tag">YOU</i>';
    return esc(slotName(i));
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function slotName(i) {
    if (S && (S.online || S.sim) && i === S.me) return 'YOU';
    if (S && S.names && S.names[i]) return S.names[i];
    if (S && S.bots.indexOf(i) >= 0) return 'BOT';
    return SD.store.name(i) || art.skinName(art.slotSkin(i));
  }

  function setFace(i, mood, opts) {
    var p = pads[i]; if (!p) return;
    var key = mood + (opts && opts.crown ? 'c' : '');
    if (p.mood === key) return;
    p.mood = key; p.faceEl.innerHTML = art.face(i, mood, opts);
  }

  function updatePts() {
    if (S && S.online && S.online.onScore) { try { S.online.onScore(S.totals.slice(), S.game ? S.game.title : ''); } catch (er) {} }
    pads.forEach(function (p, i) {
      p.ptsEl.innerHTML = S && S.series ? art.icon('trophy', 14) + '<b>' + S.totals[i] + '</b><small>/' + S.total + '</small>' : '';
    });
  }

  /* ---------- pads ---------- */
  function buildPads(n) {
    padsEl.innerHTML = ''; pads = []; keyHeld = {};
    arenaEl.dataset.count = n;
    for (var i = 0; i < n; i++) (function (i) {
      var c = colorOf(i), el = document.createElement('div');
      el.className = 'pad p' + i;
      var mine = S && S.mode !== 'boss' && (S.bots.length || S.online) ? S.me : -1;   // my pad goes down (portrait) / left (landscape)
      if (mine >= 0) {
        var cv = SD.store.get('ctrlV') === 'top' ? 'top' : 'bottom', ch = SD.store.get('ctrlH') === 'left' ? 'left' : 'right';
        el.style.setProperty('--op', (i === mine) === (cv === 'bottom') ? 1 : 0); el.style.setProperty('--ol', (i === mine) === (ch === 'right') ? 1 : 0);
      }
      el.style.setProperty('--pc', c.pad); el.style.setProperty('--pf', c.fill); el.style.setProperty('--pd', c.deep);
      el.innerHTML = '<div class="pad-top"><span class="pad-face"></span><span class="pad-name">' + padLabel(i) + '</span><span class="pad-pw"></span><span class="pad-pts"></span>' + (S && S.bots.indexOf(i) >= 0 ? (S.sim ? '' : '<kbd class="bot">BOT</kbd>') : S && (S.mode === 'boss' || S.nolocal.indexOf(i) >= 0) ? '' : (padKey(i) ? '<kbd>' + (padKey(i) === 'SPACE' ? 'SPC' : padKey(i)) + '</kbd>' : '')) + (i === (mine >= 0 ? mine : 0) ? '<button type="button" class="pad-exit" aria-label="Exit">EXIT</button>' : '') + '</div><div class="pad-stage"></div><div class="pad-dock"></div><div class="pad-badge"></div>';
      padsEl.appendChild(el);
      var p = { el: el, faceEl: el.querySelector('.pad-face'), ptsEl: el.querySelector('.pad-pts'), stage: el.querySelector('.pad-stage'), badge: el.querySelector('.pad-badge'), dock: el.querySelector('.pad-dock'), mood: '', held: null };
      pads.push(p);
      var xb = el.querySelector('.pad-exit');
      if (xb) { xb.addEventListener('pointerdown', function (e) { e.stopPropagation(); e.preventDefault(); askLeave(); }); xb.addEventListener('click', function (e) { e.stopPropagation(); }); }
      setFace(i, 'idle');
      el.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (p.held !== null) return;
        p.held = e.pointerId;
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
        press(i);
      });
      var up = function (e) { if (p.held !== e.pointerId) return; p.held = null; release(i); };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    })(i);
  }

  function press(i, bot) {
    if (!S || !pads[i]) return;
    if (!bot && S.nolocal.indexOf(i) >= 0) return;       // bot and remote pads ignore fingers
    pads[i].el.classList.add('down');
    if (!bot && S.online) S.online.peer.send({ t: 'd' });
    if (!S.accepting || S.active.indexOf(i) < 0 || !S.onDown) return;
    S.onDown(i);
  }
  function release(i, bot) {
    if (!pads[i]) return;
    if (!bot && S && S.nolocal.indexOf(i) >= 0) return;
    pads[i].el.classList.remove('down');
    if (!bot && S && S.online) S.online.peer.send({ t: 'u' });
    if (!S || !S.accepting || S.active.indexOf(i) < 0 || !S.onUp) return;
    S.onUp(i);
  }

  window.addEventListener('keydown', function (e) {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape' && S && !exitEl.hidden) { e.preventDefault(); askLeave(); return; }
    if (!S) return;
    if ((S.useOpen || S.accepting) && /^[1-3]$/.test(e.key)) { var dl = pads[S.me] && pads[S.me].dock.querySelectorAll('.dk-c')[+e.key - 1]; if (dl) { e.preventDefault(); toggleWant(dl.dataset.id); return; } }
    var k = nk(e);
    for (var i = 0; i < pads.length; i++) if (padKey(i) === k) { e.preventDefault(); if (!keyHeld[i]) { keyHeld[i] = true; press(i); } return; }
  });
  window.addEventListener('keyup', function (e) {
    var k = nk(e);
    for (var i = 0; i < pads.length; i++) if (padKey(i) === k && keyHeld[i]) { keyHeld[i] = false; release(i); }
  });

  /* ---------- sessions ---------- */
  function pickGame(exclude) {
    var g = SD.pools.one(S.level, exclude || S.lastGame, S.mrng);
    S.lastGame = g.id;
    return g;
  }

  function arenaBanner() {
    if (!SD.arenas) return;
    if (SD.arenas.force) SD.arenas.force(S && S.online && S.online.arena ? S.online.arena : null);
    var a = SD.arenas.enter(arenaEl), b = document.createElement('div');
    b.className = 'arena-banner'; b.innerHTML = '<small>PLAY ROOM</small>' + a.name;
    arenaEl.appendChild(b); setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 2100);
  }
  function startSession(mode, conn, opts) {
    stopSpeech();
    var sim = opts && opts.sim || null;                      // simulated online player (CrazyGames build)
    var boss = mode === 'boss', online = mode === 'online', n = boss ? 1 : 2, mine0 = SD.store.get('level') || 1;
    var other0 = online ? ((conn.opp.level | 0) || mine0) : sim ? sim.level : mine0;
    var lvl = (online || sim) ? Math.round((mine0 + other0) / 2) : mine0;       // the level that sets the difficulty and the game mix: the same number on both phones
    var bots = !boss && !online && (sim || SD.store.get('opp') === 'bot') ? [1] : [];
    var me = online ? (conn.role === 'host' ? 0 : 1) : 0;
    var hard = boss ? 0 : SD.pools.hardOf(lvl);
    var skill = 0.2 + 0.72 * Math.pow(hard, 0.85) + (Math.random() - 0.5) * 0.08;      // bots get better with level
    if (lvl >= 45) skill = 0.95 + 0.04 * Math.min(1, (lvl - 45) / 3) + (Math.random() - 0.5) * 0.01;   // new era: they know every game inside out
    skill = Math.max(0.15, Math.min(0.99, skill));
    art.setLive(0, null); art.setLive(1, null);
    if (bots.length) art.setLive(1, sim ? sim.skin : art.botSkin());          // the bot always wears the same look; a simulated player has its own
    if (online) {
      art.setLive(me, SD.store.get('skins')[0]); art.setLive(1 - me, conn.opp.skin | 0);
      conn.againMe = conn.againPeer = false;
    }
    var tap = document.getElementById('tapStart'); if (tap) tap.hidden = true;
    S = { mode: mode, n: n, bots: bots, nolocal: online ? [1 - me] : bots.slice(), me: me, online: online ? conn : null, roundNo: 0, peerRes: {}, remoteQ: [],
      armed: [[], []], act: [[], []], want: [[], []], peerUse: {}, useOpen: false, peerPw: {}, pwWait: null, sim: sim, rated: !!(online && conn.kind === 'random') || !!sim, oppLevel: online ? (conn.opp.level | 0) : sim ? sim.level : 0, coinDelta: 0, t0: 0,
      names: online ? (function () { var a = []; a[me] = conn.myName; a[1 - me] = conn.opp.name; return a; })() : sim ? [SD.store.name(0), sim.name] : null,
      seed: online ? conn.seed : (Math.random() * 4294967296) >>> 0, skill: skill, level: lvl, hard: hard, tier: boss ? SD.progress.tier() : 0, all: [], totals: [], timers: [], raf: 0, frameFn: null, last: 0, active: [], game: null, accepting: false, onDown: null, onUp: null, ended: false, lastGame: null, tie: 0, tiebreak: false, round: 0, queue: [], series: mode === 'pay' || mode === 'party' || online, total: 0, gameNo: 0 };
    for (var i = 0; i < n; i++) { S.all.push(i); S.totals.push(0); }
    S.mrng = mulberry32(S.seed);
    if (online) { conn.peer.onmessage = onNet; conn.peer.onclose = peerLeft; }
    if (!boss && !online) SD.store.addPlay();
    $('#home').hidden = true; ceremonyEl.hidden = true; arenaEl.hidden = false; arenaBanner();
    buildPads(n);
    updatePts();
    clearCenter(); hideTimer();
    if (mode === 'roulette') return startRoulette();
    if (boss) { S.queue = [SD.bosses[(S.tier - 1) % SD.bosses.length]]; return playRound(S.queue.shift(), [0]); }
    S.total = (conn && conn.total) || SD.SERIES || 5;                              // 5 games, then the loser gets the pie
    S.queue = SD.pools.deck(S.level, S.total, S.mrng);
    playRound(S.queue.shift(), S.all.slice());
  }

  function stopSpeech() { try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) {} }

  /* ---------- power-up loadout: picked before game 1 and again after game 3 (up to 2 power-ups) ---------- */
  function pickEnabled() { return S.mode !== 'boss' && S.mode !== 'roulette' && (S.bots.length || S.online) && SD.powers; }
  function needPick() { return pickEnabled() && !S.tiebreak && S.gameNo === 0; }
  /* arm a player's picks. HEAD START is paid at once, the rest wait until they kick in */
  function arm(slot, ids) {
    var pw = SD.powers, out = [];
    (ids || []).forEach(function (id) {
      var p = pw.by[id]; if (!p || out.indexOf(id) >= 0 || out.length >= 3) return;
      if (id === 'head') { S.totals[slot] += 1; if (slot === S.me) pw.setOwn(id, pw.own(id) - 1); } else out.push(id);
    });
    if (slot === S.me) out.forEach(function (id) { pw.setOwn(id, pw.own(id) - 1); });      // picked = used up, whether it kicks in or not
    S.armed[slot] = out; updatePts();
  }
  /* a power-up kicked in: it is used up (only my own stock changes) */
  function spend(slot, id) {
    S.armed[slot] = S.armed[slot].filter(function (x) { return x !== id; });
  }
  function playRound(game, active) {
    clearAll(); if (SD.cg) SD.cg.play();
    if (!needPick()) return launch(game, active);
    pickLoadout(function () { launch(game, active); });
  }
  function launch(game, active) { beginRound(game, active); }

  /* ---------- using power-ups in a game: cards on my pad during the intro, tap to use ---------- */
  function usableNow(slot) {                           // common ones work in every game (not in a tie-break), game ones only in their own game
    return (S.armed[slot] || []).filter(function (id) { var p = SD.powers.by[id]; return p.kind === 'game' ? p.game === S.game.id : !S.tiebreak; });
  }
  /* a big icon + ring + words pop on a pad: this is how a power-up shows what it does */
  function powerFx(slot, id, text, sub, big) {
    var p = pads[slot], q = SD.powers.by[id]; if (!p || !q) return;
    var d = document.createElement('div'); d.className = 'pfx' + (big ? ' big' : '');
    d.innerHTML = '<span class="pfx-ring"></span>' + art.icon(q.icon, big ? 110 : 76) + '<b>' + (text || q.name) + '</b>' + (sub ? '<small>' + sub + '</small>' : '');
    p.el.appendChild(d); setTimeout(function () { if (d.parentNode) d.remove(); }, big ? 1900 : 1500);
    var c = fx.center(p.stage); fx.burst(c.x, c.y, big ? 22 : 12); au.sfx.perfect();
  }
  function readyTag(slot, id) {                          // stays on the pad while the power-up is switched on and not used up yet
    var p = pads[slot], q = SD.powers.by[id]; if (!p) return;
    var t = document.createElement('div'); t.className = 'pfx-ready'; t.dataset.id = id; t.dataset.slot = slot;
    t.innerHTML = art.icon(q.icon, 30) + '<span><b>' + q.name + '</b><small>' + q.short + '</small></span>';
    p.el.appendChild(t);
  }
  function dropTags(slot, id) {
    pads.forEach(function (p, i) { if (slot != null && i !== slot) return; Array.prototype.forEach.call(p.el.querySelectorAll('.pfx-ready'), function (t) { if (!id || t.dataset.id === id) t.remove(); }); });
  }
  function gameTitle(id) { var g = SD.games.filter(function (x) { return x.id === id; })[0]; return g ? g.title : id.toUpperCase(); }
  function paintPw() {                                 // small tags in the name bar: what is switched on in this game
    pads.forEach(function (p, i) {
      var w = p.el.querySelector('.pad-pw'); if (!w) return;
      var on = S.act[i] || [], html = '';
      on.forEach(function (id) { var q = SD.powers.by[id]; html += '<span class="on">' + art.icon(q.icon, 24) + '<em>' + q.name.split(' ')[0] + '</em></span>'; });
      (S.armed[i] || []).forEach(function (id) { if (on.indexOf(id) < 0) html += '<span class="dim">' + art.icon(SD.powers.by[id].icon, 22) + '</span>'; });
      w.innerHTML = html;
    });
  }
  /* the power-up dock: cards under my game. Tap one, or press 1 / 2 / 3, to use it before the game starts */
  function toggleWant(id) {
    if (!S) return;
    var me = S.me, ok = usableNow(me);
    if (!S.useOpen) return liveUse(me, id);              // in the game: switch it on right now
    if (ok.indexOf(id) < 0) return;
    var at = S.want[me].indexOf(id);
    if (at >= 0) S.want[me].splice(at, 1); else { if (S.want[me].length >= 1) S.want[me].shift(); S.want[me].push(id); cardUse(me, id); }
    au.sfx.select(); if (S.online) S.online.peer.send({ t: 'pu', n: S.roundNo, p: S.want[me] });
    paintUse();
  }
  /* used while the game is running (a card is tapped after GO) */
  function liveUse(slot, id, fromPeer) {
    if (!S.accepting || S.ended || (S.act[slot] || []).length) { if (!fromPeer && slot === S.me && !S.ended) au.sfx.bwoop && au.sfx.bwoop(); return; }
    var q = SD.powers.by[id]; if (!q || usableNow(slot).indexOf(id) < 0) return;
    S.act[slot].push(id);
    if (q.kind === 'game') spend(slot, id);
    cardUse(slot, id); readyTag(slot, id);
    later(function () { powerFx(slot, id, q.name + ' ON!', q.short); }, 150);
    if (S.liveFn) { try { S.liveFn(slot, id); } catch (e) {} }
    if (!fromPeer && S.online) S.online.peer.send({ t: 'pl', n: S.roundNo, id: id });
    paintPw(); paintUse();
  }
  function cardUse(slot, id) {                           // the moment a card is switched on: pop + glow on the pad and the character
    var p = pads[slot], q = SD.powers.by[id]; if (!p || !q) return;
    p.el.classList.add('pw-on'); setTimeout(function () { if (p.el) p.el.classList.remove('pw-on'); }, 1200);
    var c = fx.center(p.stage); fx.burst(c.x, c.y, 14); au.sfx.perfect(); fx.vibrate && fx.vibrate(20);
    var d = document.createElement('div'); d.className = 'pfx-fly'; d.innerHTML = art.icon(q.icon, 64);
    p.el.appendChild(d); setTimeout(function () { if (d.parentNode) d.remove(); }, 900);
    var w = document.createElement('div'); w.className = 'pw-word'; w.textContent = q.name + ' ON!'; p.el.appendChild(w); setTimeout(function () { if (w.parentNode) w.remove(); }, 1400);
  }
  function paintUse() {
    var me = S.me, p = pads[me];
    pads.forEach(function (x) { if (x.dock) { x.dock.innerHTML = ''; x.dock.className = 'pad-dock'; } x.el.classList.remove('has-dock'); });
    if (!pickEnabled() || !p || !p.dock) return;
    var lists = pads.map(function (x, k) { var l = (S.armed[k] || []).slice(); (S.act[k] || []).forEach(function (id) { if (l.indexOf(id) < 0) l.push(id); }); return l; });
    if (!lists[me].length && !(S.act[1 - me] || []).length) return;
    var by = SD.powers.by, ok = usableNow(me), live = S.useOpen || S.accepting, wig = (SD.store.get('level') | 0) <= 10 && live;
    pads.forEach(function (pd, k) {
      var mine = k === me, h = '';
      if (S.active.indexOf(k) < 0 && !mine) return;
      lists[k].forEach(function (id, n) {
        if (k !== me && (S.act[k] || []).indexOf(id) < 0) return;
        var q = by[id], act = (S.act[k] || []).indexOf(id) >= 0, on = act || (mine && S.want[me].indexOf(id) >= 0);
        if (!mine) { h += '<span class="dk-c foe' + (on ? ' on' : '') + '">' + art.icon(q.icon, 34) + '<b>' + (on ? 'ON!' : q.name.split(' ')[0]) + '</b></span>'; return; }
        var used = (S.act[k] || []).length > 0, usable = !used && ok.indexOf(id) >= 0 || act;
        h += '<button type="button" class="dk-c' + (on ? ' on' : '') + (used && !act ? ' used' : '') + (usable ? '' : ' off') + (wig && usable && !on ? ' wig' : '') + '" data-id="' + q.id + '" aria-label="' + q.name + '">' + art.icon(q.icon, 34) +
          '<b>' + (act ? 'USED' : used ? 'MUTED' : on ? 'ON!' : usable ? q.name.split(' ')[0] : (q.kind === 'game' ? gameTitle(q.game).split(' ')[0] : 'NO')) + '</b>' + (usable && !act ? '<kbd>' + (n + 1) + '</kbd>' : '') + '</button>';
      });
      pd.dock.className = 'pad-dock show' + (mine && live ? ' live' : ''); pd.dock.innerHTML = h; pd.el.classList.add('has-dock');
    });
    Array.prototype.forEach.call(p.dock.querySelectorAll('.dk-c'), function (b) {
      b.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); ev.preventDefault(); toggleWant(b.dataset.id); });
    });
  }
  /* at GO the choices are locked for everybody. GAME power-ups are used up now, COMMON ones when they kick in */
  function lockAll() {
    S.useOpen = false;
    var peer = S.online ? S.peerUse[S.roundNo] || [] : null, picked = [[], []];
    [0, 1].forEach(function (slot) {
      var want = S.online && slot !== S.me ? peer : S.want[slot], ok = usableNow(slot);
      want.forEach(function (id) { if (ok.indexOf(id) >= 0 && picked[slot].indexOf(id) < 0 && picked[slot].length < 1) picked[slot].push(id); });
    });
    S.act = picked;
    [0, 1].forEach(function (slot) { picked[slot].forEach(function (id, k) { readyTag(slot, id); later(function () { powerFx(slot, id, SD.powers.by[id].name + ' ON!', SD.powers.by[id].short); }, 200 + k * 250); }); });
    [0, 1].forEach(function (slot) { picked[slot].forEach(function (id) { if (SD.powers.by[id].kind === 'game') spend(slot, id); }); });
    paintPw();
  }

  function pickLoadout(done) {
    var key = 1, el = $('#pick'), pw = SD.powers, fin = false, tick = 0, SEC = 8, sel = [];
    var owned = pw.list.filter(function (p) { return pw.own(p.id) > 0; });
    function hide() { clearInterval(tick); el.hidden = true; el.innerHTML = ''; S.pickEnd = null; }
    function go() { if (!S || S.leaving) return; hide(); S.pwWait = null; done(); }
    function finish() {
      if (fin) return; fin = true; clearInterval(tick);
      var mine = sel.filter(function (id) { return pw.own(id) > 0; }).slice(0, 3);
      S.bots.forEach(function (b) { arm(b, pw.botPick(S.oppLevel || SD.store.get('level'))); });
      arm(S.me, mine);
      if (!S.online) return go();
      S.online.peer.send({ t: 'pw', n: key, p: mine });
      if (S.peerPw[key]) { arm(1 - S.me, S.peerPw[key]); return go(); }
      el.innerHTML = '<div class="pk-card"><h2>PICK YOUR POWER-UPS</h2><p class="pk-wait">WAITING FOR OPPONENT...</p></div>'; el.hidden = false;
      S.pwWait = { n: key, go: function () { if (!S.pwWait) return; arm(1 - S.me, S.peerPw[key] || []); go(); } };
      later(function () { if (S.pwWait && S.pwWait.n === key) S.pwWait.go(); }, 7000);
    }
    if (!owned.length) { S.pickEnd = hide; return finish(); }
    function paintSel() {
      Array.prototype.forEach.call(el.querySelectorAll('.pk-pw'), function (x) { x.classList.toggle('on', sel.indexOf(x.dataset.id) >= 0); });
      var c = el.querySelector('#pkCount'); if (c) c.innerHTML = '<b>' + sel.length + '</b> / 3';
      var ps = el.querySelector('#pkSel'); if (ps) { ps.textContent = Math.min(sel.length, 3) + '/3'; ps.className = 'pk-sel s' + Math.min(sel.length, 3); }
    }
    var cards = owned.map(function (p) {
      return '<button type="button" class="pk-pw" data-id="' + p.id + '">' + art.icon(p.icon, 46) +
        '<span class="pk-tx"><b>' + p.name + '</b><em>' + (p.kind === 'game' ? 'ONLY IN ' + gameTitle(p.game) : 'WORKS IN EVERY GAME') + '</em><small>' + p.desc + '</small></span>' +
        '<span class="pk-n">x' + pw.own(p.id) + '</span><i class="pk-ck"></i></button>';
    }).join('');
    el.innerHTML = '<div class="pk-card"><div class="pk-head"><h2>PICK 3 POWER-UPS</h2><span class="pk-sel s0" id="pkSel">0/3</span><div class="pk-timer"><b id="pkN">' + SEC + '</b></div></div>' +
      '<div class="pk-bar"><i id="pkBar"></i></div><p class="pk-hint">Tap to choose. They stay with you for the whole match. Before each game, tap a card under your game (or press 1 2 3) to use it. <span id="pkCount" class="pk-count"></span></p>' +
      '<div class="pk-list">' + cards + '</div></div>';
    var auto = 0;
    Array.prototype.forEach.call(el.querySelectorAll('.pk-pw'), function (b) {
      b.addEventListener('click', function () {
        au.sfx.tap(); var id = b.dataset.id, at = sel.indexOf(id);
        if (at >= 0) sel.splice(at, 1); else if (sel.length < 3) sel.push(id); else return;
        clearTimeout(auto); paintSel();
        if (sel.length >= 3 || sel.length >= owned.length) auto = setTimeout(function () { au.sfx.select(); finish(); }, 550);
      });
    });
    paintSel(); el.hidden = false; au.music.start('game');
    var t0 = performance.now();
    S.pickEnd = hide;
    tick = setInterval(function () {
      var f = Math.max(0, SEC - (performance.now() - t0) / 1000), n = Math.ceil(f);
      var nEl = el.querySelector('#pkN'), bar = el.querySelector('#pkBar');
      if (nEl && nEl.textContent !== String(n)) { nEl.textContent = n; if (n <= 2) au.sfx.tick(1.4); }
      if (bar) bar.style.width = (f / SEC * 100) + '%';
      if (f <= 0) finish();
    }, 100);
  }

  /* ---------- one round ---------- */
  /* bar length must match how long each game really runs (seconds). hop / stack / freeze draw their own bar. */
  var DUR = { balance: 12, beat: 12, bomb: 14, dodge: 13, echo: 24, flap: 12, freeze: 19, hop: 16, knife: 22, lander: 22, pinata: 12, skip: 22, snack: 16, stack: 16, zig: 22 };
  function kb() { try { return window.matchMedia('(hover:hover) and (pointer:fine)').matches; } catch (e) { return false; } }
  function howTo(g) {
    var k = padKey(S.me), key = kb() ? 'PRESS ' + (k === 'SPACE' ? 'SPACE' : k) + ' OR TAP YOUR PAD. ' : 'TAP YOUR PAD. ';
    return key + g.tip;
  }
  function introMs(g) {
    var n = 0, m = {}; try { m = JSON.parse(localStorage.getItem('sd_seen') || '{}'); n = m[g.id] | 0; m[g.id] = n + 1; localStorage.setItem('sd_seen', JSON.stringify(m)); } catch (e) {}
    return n < 3 ? 4500 : 2600;
  }
  function beginRound(game, active) {
    clearAll();
    S.t0 = performance.now(); S.roundNo++; S.settle = null; if (!S.tiebreak) S.gameNo++; S.rng = mulberry32((S.mrng() * 4294967296) >>> 0);
    S.active = active.slice(); S.game = game; S.accepting = false; S.onDown = S.onUp = null; S.ended = false;
    S.lastGame = game.id;
    pads.forEach(function (p, i) {
      p.el.className = 'pad p' + i; p.stage.innerHTML = ''; p.badge.innerHTML = ''; p.mood = '';
      Array.prototype.forEach.call(p.el.querySelectorAll('.pfx, .pfx-ready'), function (t) { t.remove(); });
      if (active.indexOf(i) < 0) {
        p.el.classList.add('safe');
        p.stage.innerHTML = '<div class="safe-mark">' + art.icon('check', 64) + '</div>';
        setFace(i, 'cheer');
      } else setFace(i, 'idle');
    });
    S.act = [[], []]; S.want = [[], []]; S.useOpen = false; S.liveFn = null;
    var canUse = pickEnabled() && (usableNow(0).length || usableNow(1).length);
    if (canUse) {
      S.useOpen = true;
      S.bots.forEach(function (b) { later(function () { S.want[b] = usableNow(b).filter(function (id) { return SD.powers.by[id].kind === 'game' ? Math.random() < 0.85 : Math.random() < 0.4; }).slice(0, 1); }, 500 + Math.random() * 900); });
    }
    paintPw(); paintUse();
    updatePts(); hideTimer(); showExit(true);
    au.music.start('game');
    setCenter('<div class="intro">' + (S.series && !S.tiebreak ? '<small class="rnd">GAME ' + S.gameNo + ' OF ' + S.total + '</small>' : S.tiebreak ? '<small class="rnd">TIE BREAKER</small>' : '') + art.icon(game.icon, 84) + '<b>' + game.title + '</b><span>' + howTo(game) + '</span>' + (canUse ? '<em class="use-hint">' + (kb() ? 'PRESS 1 OR TAP A CARD' : 'TAP A CARD BELOW') + ' TO USE A POWER-UP. ONE PER GAME. IT WORKS ANY TIME!</em>' : '') + '</div>', 'pop');
    au.sfx.select();
    later(function () { countdown(3); }, introMs(game));
  }

  function countdown(n) {
    if (n === 1 && S.useOpen) { S.useOpen = false; paintUse(); }        // last second: choices are closed
    if (n > 0) {
      setCenter('<div class="count-num n' + n + '">' + n + '</div>', 'pop');
      au.sfx.count(n);
      later(function () { countdown(n - 1); }, 800);
    } else {
      clearCenter(); lockAll();
      showGo(S.game.goText || 'GO!');
      au.sfx.count(0);
      if (!S.game.goText) fx.flash('#fff');
      var G = S.game, SS = S;
      later(function () {                          // a short beat after GO so nobody is caught off guard
        if (S !== SS || S.game !== G || S.ended) return;
        S.accepting = true; paintUse();
        if (DUR[G.id] && typeof G.start === 'function') showTimer(DUR[G.id] * 1000);
        G.start(makeCtx());
        flushRemote();
      }, 450);
    }
  }

  function makeCtx() {
    var A = {
      players: S.active.slice(),
      stage: function (i) { return pads[i].stage; },
      padEl: function (i) { return pads[i].el; },
      center: $('#centerInner'),
      face: setFace,
      onDown: function (fn) { S.onDown = fn; },
      onUp: function (fn) { S.onUp = fn; },
      bots: S.bots.slice(), skill: S.skill, hard: S.hard, level: S.level, tier: S.tier, rand: S.rng,
      press: function (i) { press(i, true); },
      release: function (i) { release(i, true); },
      tap: function (i) { press(i, true); later(function () { release(i, true); }, 90); },
      power: function (slot, id) { return (S.act[slot] || []).indexOf(id) >= 0; },
      live: function (fn) { S.liveFn = fn; },
      later: later, frame: setFrame, timer: showTimer, end: endRound,
      now: function () { return performance.now(); },
      used: function (slot, id, text) { dropTags(slot, id); powerFx(slot, id, text, SD.powers.by[id].short, true); },
      fx: function (slot, id, text) { powerFx(slot, id, text, ''); },
      pop: function (i, text, cls) { var c = fx.center(pads[i].stage); fx.popText(c.x, c.y, text, cls); }
    };
    return A;
  }

  function endRound(results) {
    if (!S || S.ended) return;
    if (SD.cg) SD.cg.stop();
    S.ended = true; S.accepting = false; paintUse();
    S.timers.forEach(clearTimeout); S.timers = [];     // stop any leftover game timers
    hideTimer(); clearCenter(); dropTags();
    S.frameFn = null; cancelAnimationFrame(S.raf); S.raf = 0;
    if (S.game.cleanup) { try { S.game.cleanup(); } catch (e) {} }
    if (S.online) return onlineSettle(results);
    finishRound(results);
  }

  /* online: both phones swap their own result, so both end with the same ranking */
  function onlineSettle(results) {
    var o = S.online, act = S.active, k = S.roundNo, peerIdx = act.indexOf(1 - S.me), host = !!S.game.hostAuth, imHost = o.role === 'host';
    if (host && imHost) { o.peer.send({ t: 'r', n: k, all: results }); return finishRound(results); }
    if (!host) o.peer.send({ t: 'r', n: k, r: results[act.indexOf(S.me)] });
    var done = false;
    function go() {
      if (done || !S || S.roundNo !== k) return; done = true;
      var pr = S.peerRes[k], fin = results.slice();
      if (pr) { if (host && pr.all) fin = pr.all; else if (!host && pr.r) fin[peerIdx] = pr.r; }
      finishRound(fin);
    }
    S.settle = go;
    if (S.peerRes[k]) go(); else later(go, 6000);
  }

  function finishRound(results) {
    var act = S.active, res = {}, i, used = [];
    var has = function (slot, id) { return (S.act[slot] || []).indexOf(id) >= 0; };
    var count = S.series && !S.tiebreak && S.mode !== 'boss';
    var tag = function (r, p, label) { var o = {}; for (var k in r) o[k] = r[k]; o.p = p; o.label = label; return o; };
    if (count && act.length === 2) {
      var a0 = results[0].p, a1 = results[1].p;
      if (a0 === a1) {                                                // LUCKY TIE: a drawn game goes to the player who has it
        var l0 = has(act[0], 'lucky'), l1 = has(act[1], 'lucky');
        if (l0 !== l1) { var wk = l0 ? 0 : 1; results[wk] = tag(results[wk], a0 + 1, 'LUCKY TIE: YOU WIN IT'); used.push([act[wk], 'lucky']); }
      } else {                                                        // SECOND CHANCE: a lost game becomes a draw
        var lk = a0 < a1 ? 0 : 1;
        if (has(act[lk], 'second')) { results[lk] = tag(results[lk], Math.max(a0, a1), 'SECOND CHANCE: LOSS = DRAW'); used.push([act[lk], 'second']); }
      }
    }
    results.forEach(function (r, k) { res[act[k]] = r; });
    var ps = results.map(function (r) { return r.p; });
    var best = Math.max.apply(null, ps), worst = Math.min.apply(null, ps), allTie = best === worst;
    act.forEach(function (i) {
      var r = res[i], isBest = !allTie && r.p === best, isWorst = !allTie && r.p === worst;
      pads[i].el.classList.toggle('win', isBest); pads[i].el.classList.toggle('lose', isWorst);
      var lbl = r.label == null ? '' : r.label;
      var dbl = count && isBest && has(i, 'double'), pts = dbl ? 2 : 1;
      if (dbl) { used.push([i, 'double']); lbl = 'DOUBLE POINT: +2'; }
      if (count && isBest) S.totals[i] += pts;
      if (S.rated && count && i === S.me && !allTie) {          // coins: quick wins pay more, a lost game costs 1
        if (isBest) S.coinDelta += 2 + Math.round(3 * Math.max(0, 1 - (performance.now() - S.t0) / 12000)); else if (isWorst) S.coinDelta -= 1;
      }
      if (count && isBest && has(i, 'steal')) {
        used.push([i, 'steal']); lbl = lbl || 'STEALER: RIVAL -1';
        act.forEach(function (j) { if (j !== i) S.totals[j] = Math.max(0, S.totals[j] - 1); });
      }
      if (S.mode !== 'boss') {                              // big result in the pad: crown + point, or thumbs down
        pads[i].badge.innerHTML = '';
        pads[i].stage.innerHTML = '<div class="res ' + (isBest ? 'win' : isWorst ? 'lose' : 'draw') + '">' +
          (isBest ? art.icon('crown') : isWorst ? art.icon('thumbdown') : '<b class="res-eq">=</b>') +
          '<b class="res-txt">' + (isBest ? (count ? '+' + pts : 'WIN') : isWorst ? 'LOST' : 'DRAW') + '</b>' +
          (lbl ? '<span class="res-lbl">' + lbl + '</span>' : '') + '</div>';
      } else pads[i].badge.innerHTML = (lbl || isBest || isWorst) ?
        '<div class="pb ' + (isBest ? 'best' : isWorst ? 'worst' : '') + '">' + (isBest ? art.icon('crown', 22) : isWorst ? art.icon(S.series ? 'cross' : 'pie', 22) : '') + '<span>' + lbl + '</span></div>' : '';
      setFace(i, isBest ? 'cheer' : isWorst ? 'sad' : 'idle');
    });
    used.forEach(function (u, k) {
      spend(u[0], u[1]);
      var say = { second: ['SECOND CHANCE!', 'YOUR LOSS BECAME A DRAW'], lucky: ['LUCKY TIE!', 'THE DRAW IS YOUR WIN'], double: ['DOUBLE POINT!', 'x2  +2 POINTS'], steal: ['STEALER!', 'RIVAL LOSES 1 POINT'] }[u[1]] || [SD.powers.by[u[1]].name, ''];
      later(function () { powerFx(u[0], u[1], say[0], say[1], true); }, 250 + k * 300);
    });
    updatePts();
    var meI = (S.bots.length || S.online) ? S.me : -1;
    if (S.mode === 'boss') { if (results[0].p === 1) au.sfx.win(); else au.sfx.lose(); }
    else if (allTie) au.sfx.bwoop();
    else if (meI >= 0 && res[meI]) { if (res[meI].p === best) au.sfx.roundWin(); else au.sfx.roundLose(); }
    else { au.sfx.coin(); au.sfx.bonk && setTimeout(au.sfx.bonk, 180); }
    var score = {};
    act.forEach(function (i) { score[i] = res[i].p; });
    later(function () { afterRound(act, score, worst, allTie); }, 1800);
  }

  function afterRound(act, score, worst, allTie) {
    if (S.mode === 'boss') return bossCeremony(score[act[0]] === 1);
    if (S.series && !S.tiebreak) {
      if (S.queue.length) return playRound(S.queue.shift(), S.all.slice());
      var min = Math.min.apply(null, S.totals);
      var losers = S.all.filter(function (i) { return S.totals[i] === min; });
      if (losers.length === 1) return ceremony(losers[0]);
      S.tiebreak = true; S.tie = 0;
      return tieRound(losers);
    }
    var worstList = act.filter(function (i) { return score[i] === worst; });
    if (allTie || worstList.length > 1) return tieRound(worstList);
    ceremony(worstList[0]);
  }

  function tieRound(list) {
    S.tie++;
    if (S.tie > 3) {                       // too many ties: let fate decide
      setCenter('<div class="tie">COIN<br>FLIP</div>', 'pop');
      au.sfx.airhorn();
      var pickI = mrnd(list);
      return later(function () { clearCenter(); ceremony(pickI); }, 1400);
    }
    setCenter('<div class="tie">TIE!<small>AGAIN</small></div>', 'pop');
    au.sfx.airhorn(); fx.shake(300);
    later(function () { clearCenter(); playRound(pickGame(), list); }, 1300);
  }

  /* ---------- roulette: everyone touches in, lights spin, one pays ---------- */
  function startRoulette() {
    S.active = S.all.slice(); S.accepting = true; S.ended = false;
    var joined = {};
    au.music.start('menu');
    pads.forEach(function (p, i) {
      p.stage.innerHTML = '<div class="touch">' + art.icon('finger', 80) + '</div>';
      setFace(i, 'idle');
    });
    showExit(true);
    S.onDown = function (i) {
      if (joined[i] || S.ended) return;
      joined[i] = true;
      pads[i].el.classList.add('ready');
      pads[i].stage.innerHTML = '<div class="safe-mark">' + art.icon('check', 64) + '</div>';
      setFace(i, 'cheer');
      au.sfx.coin();
      if (Object.keys(joined).length === S.n) { S.ended = true; showExit(false); later(spin, 700); }
    };
    S.bots.forEach(function (b) { later(function () { if (S.accepting) press(b, true); }, 500 + Math.random() * 900); });
  }
  function spin() {
    S.accepting = false;
    var loser = Math.floor(Math.random() * S.n), steps = S.n * 5 + loser;
    au.sfx.whoosh();
    function step(k) {
      var cur = k % S.n;
      pads.forEach(function (p, i) { p.el.classList.toggle('spot', i === cur); });
      au.sfx.tick(1 + (k / steps) * 0.8);
      if (k < steps) later(function () { step(k + 1); }, 55 + Math.pow(k / steps, 2) * 320);
      else later(function () { pads[loser].el.classList.remove('spot'); ceremony(loser); }, 600);
    }
    step(0);
  }

  /* ---------- the loser ceremony ---------- */
  function ceremony(loser) {
    clearAll(); hideTimer(); clearCenter(); showExit(false);
    S.accepting = false;
    au.music.stop();
    var name = slotName(loser), party = false, series = !!S.series;
    if (S.online && S.online.kind === 'tour' && !S.tourEnded) { S.tourEnded = true; try { S.online.onScore(S.totals.slice(), 'DONE'); S.online.onEnd(1 - loser); } catch (er) {} }
    $('#cereXp').innerHTML = ''; S.inCere = true;
    S.inCere = true;
    var others = S.all.filter(function (i) { return i !== loser; });
    var top = series ? Math.max.apply(null, S.totals) : -1;
    var crowd = others.map(function (i) {
      var crown = series && S.totals[i] === top && top > S.totals[loser];
      return '<span class="fan" data-i="' + i + '" data-crown="' + (crown ? 1 : 0) + '" style="animation-delay:' + (i * 0.08) + 's">' + art.face(i, 'worry', { crown: crown }) + '</span>';
    }).join('');
    $('#cereTitle').innerHTML = '&nbsp;'; $('#cereTitle').className = '';
    $('#cereLine').textContent = '';
    $('#cereStage').innerHTML = '<div class="cs-loser"><div class="cs-face">' + art.face(loser, 'worry') + '</div><div class="cs-pie">' + art.icon('pie', 120) + '</div></div><div class="cs-crowd">' + crowd + '</div>';
    var btns = $('#cereBtns'); btns.hidden = true;
    btns.innerHTML = '<button class="gel" id="bAgain" type="button" aria-label="Play again">' + art.icon('again', 30) + '</button>' +
      '<button class="gel alt" id="bHome" type="button" aria-label="Home">' + art.icon('home', 30) + '</button>' +
      '<button class="gel alt" id="bShare" type="button" aria-label="Share">' + art.icon('share', 30) + '</button>';
    ceremonyEl.hidden = false;
    var stage = $('#cereStage'), faceBox = stage.querySelector('.cs-face'), pie = stage.querySelector('.cs-pie');
    au.sfx.drum(1.0);
    stage.classList.add('tense');
    later(function () { pie.classList.add('fly'); au.sfx.whoosh(); }, 950);
    later(function () {
      stage.classList.remove('tense');
      pie.style.visibility = 'hidden';
      faceBox.innerHTML = art.face(loser, 'pied');
      faceBox.classList.add('splat');
      var c = fx.center(faceBox);
      fx.cream(c.x, c.y, 34); fx.shake(480); fx.flash('#ffffff'); fx.vibrate([90, 40, 120]);
      au.sfx.splat();
      var t = $('#cereTitle');
      t.textContent = name + (party ? ' LOSES!' : ' PAYS!'); t.className = 'pop';
      if (!S.online) SD.store.addPie(loser);
    }, 1350);
    later(function () {
      var meC = (S.bots.length || S.online) ? S.me : -1;
      if (meC >= 0 && loser !== meC) { au.sfx.win(); au.sfx.cheer(); }
      else { au.sfx.lose(); au.sfx.laugh(0.5); au.sfx.ooh(); }
      stage.querySelectorAll('.fan').forEach(function (f, k) {
        var i = +f.dataset.i;
        f.innerHTML = art.face(i, 'laugh', { crown: f.dataset.crown === '1' });
        f.classList.add('laughing');
        var r = f.getBoundingClientRect();
        setTimeout(function () { fx.popText(r.left + r.width / 2, r.top, 'HA!', 'ha'); }, 120 * k);
      });
      fx.rain(40);
      $('#cereLine').textContent = rnd(ROASTS);
    }, 1750);
    later(function () { showXp(loser); }, 2300);
    var CS = S; setTimeout(function () { if (S === CS && S.inCere) btns.hidden = false; }, 2500);   // plain timer: nothing that clears match timers can hide the way out
    $('#bAgain').onclick = function () { au.sfx.select(); if (S.online) rematch(); else if (S.sim && SD.sim) startSession('pay', null, { sim: SD.sim.pick() }); else startSession(S.mode); };
    $('#bHome').onclick = function () { au.sfx.tap(); E.home(); };
    $('#bShare').onclick = function () { share(name); };
    if (S.online && S.online.kind === 'tour') {
      $('#bAgain').style.display = 'none'; $('#bShare').style.display = 'none';
      var SS = S; setTimeout(function () { if (S === SS && S.inCere) E.home(); }, 7500);
    }
  }

  /* level progress and coins for player 1 (the profile owner): only rated matches count */
  function showXp(loser) {
    if (S.mode === 'boss') return;
    var el = $('#cereXp');
    if (!S.rated) {
      el.innerHTML = '<div class="xp-msg hint">' + art.icon('offline', 22) + '<span>' + (SD.BUILD === 'cg' ? 'PLAY (NOT WITH A FRIEND) TO GROW YOUR LEVEL AND COINS' : 'LEVELS AND COINS: RANDOM ONLINE MATCHES ONLY') + '</span></div>';
      return;
    }
    var P = SD.progress, won = loser !== S.me, r = P.rate(won, S.oppLevel);
    var net = P.addCoins(S.coinDelta + (won ? 10 : -5));
    if (S.online) {
      var key = won ? 'owins' : 'olosses'; SD.store.set(key, (SD.store.get(key) | 0) + 1);
      if (SD.net) SD.net.sync();
    }
    var a = r.after, pct = Math.min(100, Math.round(a.xp / a.need * 100));
    var pts = r.pts ? (r.pts > 0 ? '+' : '') + r.pts + ' PT' : (r.gated ? 'BOSS!' : '0 PT');
    var html = '<div class="xp-row"><span class="xp-lv">LV ' + a.level + '</span><div class="xpbar' + (a.gated ? ' gated' : '') + '"><i style="width:' + pct + '%"></i></div><b>' + pts + '</b></div>';
    if (r.ups.length && !a.gated) html += '<div class="xp-msg up">LEVEL UP!</div>';
    if (SD.arenas) r.ups.forEach(function (L) { var ar = SD.arenas.forLevel(L); if (ar) html += '<div class="xp-msg up">NEW PLAY ROOM: ' + ar.name + '!</div>'; });
    if (SD.art) r.ups.forEach(function (L) { art.SKINS.forEach(function (s, id) { if (art.skinReq(id).lvl === L && L > 1) html += '<div class="xp-msg up">NEW LOOK: ' + s.name + ' (SHOP)</div>'; }); });
    if (a.gated) html += '<div class="xp-msg boss">' + art.icon('skull', 22) + '<span>' + (r.ups.length ? 'LEVEL UP! ' : '') + 'BEAT THE BOSS TO UNLOCK ' + art.skinName(a.bossSkin) + '</span></div>';
    if (r.downs) html += '<div class="xp-msg down">LEVEL DOWN</div>';
    html += '<div class="xp-coins ' + (net >= 0 ? 'plus' : 'minus') + '">' + art.icon('bill', 22) + '<b>' + (net >= 0 ? '+' : '') + net + '</b><span>COINS</span></div>';
    el.innerHTML = html;
    if (r.ups.length) { au.sfx.tada(); fx.confetti(innerWidth / 2, innerHeight * 0.3, 30, 1); }
    else if (net > 0) au.sfx.coin();
  }

  function flushRemote() {
    if (!S || !S.remoteQ) return;
    var q = S.remoteQ; S.remoteQ = [];
    q.forEach(function (ev) { if (ev.t === 'd') press(ev.i, true); else release(ev.i, true); });
  }
  function onRemote(kind) {
    var ps = 1 - S.me;
    if (S.accepting) { if (kind === 'd') press(ps, true); else release(ps, true); }
    else S.remoteQ.push({ t: kind, i: ps });
  }
  function onNet(m) {
    if (!S || !S.online || !m) return;
    var ps = 1 - S.me;
    if (m.t === 'd') onRemote('d');
    else if (m.t === 'u') onRemote('u');
    else if (m.t === 'r') { S.peerRes[m.n] = m; if (S.settle && m.n === S.roundNo) S.settle(); }
    else if (m.t === 'pw') { S.peerPw[m.n] = Array.isArray(m.p) ? m.p.slice(0, 3) : []; if (S.pwWait && S.pwWait.n === m.n) S.pwWait.go(); }
    else if (m.t === 'pl') { if (m.n === S.roundNo && typeof m.id === 'string' && SD.powers.by[m.id]) { var fp = 1 - S.me; if ((S.armed[fp] || []).indexOf(m.id) >= 0) liveUse(fp, m.id, true); } }
    else if (m.t === 'pu') { S.peerUse[m.n] = Array.isArray(m.p) ? m.p.slice(0, 3) : []; }
    else if (m.t === 'again') { S.online.againPeer = true; tryRematch(); }
    else if (m.t === 'start') { S.online.seed = m.seed; startSession('online', S.online); }
    else if (m.t === 'bye') peerLeft();
  }
  function peerLeft() {
    if (!S || !S.online || S.leaving) return;
    if (S.online.kind === 'tour' && !S.tourEnded) { S.tourEnded = true; try { S.online.onEnd(S.me); } catch (er) {} }
    if (S.inCere) {
      S.online.gone = true;
      $('#cereLine').textContent = 'OPPONENT LEFT';
      var b = $('#bAgain'); if (b) b.style.display = 'none';
      return;
    }
    S.leaving = true; clearAll(); au.music.stop();
    setCenter('<div class="tie">LEFT<small>OPPONENT LEFT</small></div>', 'pop');
    setTimeout(function () { if (S && S.leaving) E.home(); }, 1800);
  }
  function rematch() {
    var o = S.online; if (o.gone) return;
    o.againMe = true; try { o.peer.send({ t: 'again' }); } catch (e) {}
    $('#cereLine').textContent = 'WAITING FOR OPPONENT...';
    tryRematch();
  }
  function tryRematch() {
    var o = S && S.online;
    if (!o || !o.againMe || !o.againPeer || o.role !== 'host') return;
    o.seed = (Math.random() * 4294967296) >>> 0;
    o.peer.send({ t: 'start', seed: o.seed });
    startSession('online', o);
  }

  /* ---------- boss result ---------- */
  function bossCeremony(win) {
    clearAll(); hideTimer(); clearCenter(); showExit(false);
    S.accepting = false; au.music.stop();
    var id = win ? SD.progress.winBoss() : SD.progress.bossSkin();
    if (win && SD.net) SD.net.sync();
    var tt = $('#cereTitle'), btns = $('#cereBtns');
    $('#cereXp').innerHTML = '';
    tt.className = 'pop';
    tt.textContent = win ? 'SKIN UNLOCKED!' : 'BOSS WINS!';
    $('#cereStage').innerHTML = '<div class="cs-loser"><div class="cs-face' + (win ? ' splat' : '') + '">' + art.face(0, win ? 'cheer' : 'sad', { skin: id }) + '</div></div>';
    $('#cereLine').textContent = win ? art.skinName(id) + ' is yours! Level ' + SD.store.get('level') + '.' : 'Almost. Try again!';
    btns.innerHTML = (win ? '' : '<button class="gel" id="bAgain" type="button" aria-label="Try again">' + art.icon('again', 30) + '</button>') +
      '<button class="gel alt" id="bHome" type="button" aria-label="Home">' + art.icon('home', 30) + '</button>';
    btns.hidden = false; ceremonyEl.hidden = false;
    if (win) { var c = fx.center($('#cereStage')); fx.confetti(c.x, c.y, 50, 1.2); fx.rain(50); au.sfx.cheer(); au.say(art.skinName(id) + ' unlocked!', { pitch: 1.8, rate: 1.05 }); }
    var again = $('#bAgain'); if (again) again.onclick = function () { au.sfx.select(); startSession('boss'); };
    $('#bHome').onclick = function () { au.sfx.tap(); E.home(); };
  }

  function share(name) {
    var text = name + ' got hit by the pie in Silly Duel! Who pays the bill at your table?';
    var url = location.href.split('#')[0];
    if (navigator.share) { navigator.share({ title: 'Silly Duel', text: text, url: url }).catch(function () {}); return; }
    var done = function () { var c = fx.center($('#bShare')); fx.popText(c.x, c.y - 30, 'COPIED', 'ha'); };
    try { navigator.clipboard.writeText(text + ' ' + url).then(done, function () {}); } catch (e) {}
  }

  /* ---------- safety net: an error during a match or end screen must never leave the player stuck ---------- */
  function rescue() {
    if (document.getElementById('rescueBtn')) return;
    var b = document.createElement('button'); b.id = 'rescueBtn'; b.type = 'button'; b.className = 'gel';
    b.innerHTML = art.icon('home', 26) + '<span>HOME</span>';
    b.addEventListener('click', function () { b.remove(); try { E.home(); } catch (e) { location.reload(); } });
    document.body.appendChild(b);
  }
  function onCrash() {
    var inGame = (arenaEl && !arenaEl.hidden) || (ceremonyEl && !ceremonyEl.hidden) || !($('#party') || {}).hidden;
    if (inGame) setTimeout(rescue, 600);
  }
  window.addEventListener('error', onCrash);
  window.addEventListener('unhandledrejection', onCrash);

  /* ---------- public ---------- */
  var E = {
    init: function () {
      arenaEl = $('#arena'); padsEl = $('#pads'); centerEl = $('#center'); timerEl = $('#timer'); exitEl = $('#btnExit'); ceremonyEl = $('#ceremony');
      exitEl.innerHTML = '<span>EXIT</span>';
      exitEl.addEventListener('click', function () { au.sfx.tap(); askLeave(); });
    },
    start: function (mode) { startSession(mode); },
    startOnline: function (conn) { startSession('online', conn); },
    startSim: function (sim) { startSession('pay', null, { sim: sim }); },
    home: function () {
      var rb = document.getElementById('rescueBtn'); if (rb) rb.remove();
      if (SD.cg) SD.cg.stop();
      var tour = !!(S && S.online && S.online.kind === 'tour');
      if (tour && !S.tourEnded) { S.tourEnded = true; try { S.online.onEnd(1 - S.me); } catch (er) {} }
      if (SD.party && S && S.online && !tour) SD.party.matchOver();
      if (S && S.online && !tour) { try { S.online.peer.send({ t: 'bye' }); S.online.peer.onclose = null; S.online.peer.close(); } catch (e) {} }
      if (S) { clearAll(); if (S.game && S.game.cleanup) { try { S.game.cleanup(); } catch (e) {} } }
      S = null; stopSpeech(); art.setLive(0, null); art.setLive(1, null);  var lb = document.getElementById('leaveBox'); if (lb) lb.remove();
      if (fx && fx.stop) fx.stop();
      arenaEl.hidden = true; ceremonyEl.hidden = true; $('#home').hidden = false;
      if (tour && SD.tour) { hideTimer(); clearCenter(); padsEl.innerHTML = ''; pads = []; $('#goText').classList.remove('on'); au.music.start('menu'); return SD.tour.back(); } if (SD.arenas) SD.arenas.leave();
      hideTimer(); clearCenter(); padsEl.innerHTML = ''; pads = [];
      $('#goText').classList.remove('on');
      SD.main && SD.main.refresh();
      au.music.start('menu');
    }
  };
  SD.engine = E;
})();
