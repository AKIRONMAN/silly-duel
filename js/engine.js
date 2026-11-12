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
  function afterAd(fn) {
    var done = false;
    function go() { if (done) return; done = true; try { fn(); } catch (e) {} }
    setTimeout(go, 14000);
    try {
      if (SD.ads && SD.ads.afterMatch) SD.ads.afterMatch(go);
      else go();
    } catch (e) { go(); }
  }
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
  function clearCenter() { var c = $('#centerInner'); c.className = ''; c.innerHTML = ''; if (centerEl) centerEl.classList.remove('peek-mode'); }
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
    d.innerHTML = '<div class="lv-card"><h2>' + (S.spec ? 'STOP WATCHING?' : 'LEAVE THE MATCH?') + '</h2><p>' + (S.spec ? 'The match keeps going without you.' : S.online ? 'Your rival will win.' : 'This match will end.') + '</p><div class="lv-row"><button type="button" class="pk-btn go" id="lvStay">STAY</button><button type="button" class="pk-btn leave" id="lvGo">LEAVE</button></div></div>';
    document.body.appendChild(d);
    d.querySelector('#lvStay').addEventListener('click', function () { au.sfx.tap(); d.remove(); });
    d.querySelector('#lvGo').addEventListener('click', function () { d.remove(); E.home(); });
  }

  /* my side is always BLUE, the rival (player two offline, the other person online) is always PINK */
  function colorOf(i) {
    if (S && S.spec) return i === 0 ? CH[1] : CH[0];
    if (S && S.n > 2) return CH[i];
    var mine = S && S.mode !== 'boss' && (S.bots.length || S.online) ? S.me : 0;
    return i === mine ? CH[1] : CH[0];
  }
  art.padColor = colorOf;
  function padLabel(i) {
    var n = slotName(i);
    if (S && !S.spec && (S.online || S.sim) && i === S.me) return esc(n) + '<i class="you-tag">YOU</i>';
    return esc(n);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function slotName(i) {
    if (S && S.names && S.names[i]) return S.names[i];
    if (S && (S.online || S.sim) && i === S.me) return (S.online && S.online.myName) || SD.store.name(0) || 'YOU';
    if (S && S.online && i !== S.me) return (S.online.opp && S.online.opp.name) || 'RIVAL';
    if (S && S.bots.indexOf(i) >= 0) return (S.sim || SD.BUILD === 'cg') ? 'RIVAL' : 'BOT';
    if (i === 0) return SD.store.name(0) || 'YOU';
    return SD.store.name(i) || 'FRIEND';
  }

  function setFace(i, mood, opts) {
    var p = pads[i]; if (!p) return;
    var key = mood + (opts && opts.crown ? 'c' : '');
    if (p.mood === key) return;
    p.mood = key; p.faceEl.innerHTML = art.face(i, mood, opts);
    if (!p.stage) return;
    var html = p.faceEl.innerHTML, nodes = p.stage.querySelectorAll('.dd-hero, .ng-hero, .ng-face'), n;
    for (n = 0; n < nodes.length; n++) nodes[n].innerHTML = html;
  }

  function updatePts() {
    if (S && S.online && S.online.onScore) { try { S.online.onScore(S.totals.slice(), S.game ? S.game.title : ''); } catch (er) {} }
    pads.forEach(function (p, i) {
      p.ptsEl.innerHTML = S && S.series ? art.icon('star', 16) + '<b>' + (S.totals[i] | 0) + '</b><small>PTS</small>' : '';
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
      el.innerHTML = '<div class="pad-top"><span class="pad-face"></span><span class="pad-name">' + padLabel(i) + '</span><span class="pad-pts"></span>' + (S && S.bots.indexOf(i) >= 0 ? ((S.sim || SD.BUILD === 'cg') ? '' : '<kbd class="bot">BOT</kbd>') : S && (S.mode === 'boss' || S.nolocal.indexOf(i) >= 0) ? '' : (padKey(i) ? '<kbd>' + (padKey(i) === 'SPACE' ? 'SPC' : padKey(i)) + '</kbd>' : '')) + (i === (mine >= 0 ? mine : 0) ? '<button type="button" class="pad-exit" aria-label="Exit">EXIT</button>' : '') + '</div><div class="pad-stage"></div><div class="pad-dock"></div><div class="pad-badge"></div>';
      padsEl.appendChild(el);
      var p = { el: el, faceEl: el.querySelector('.pad-face'), ptsEl: el.querySelector('.pad-pts'), stage: el.querySelector('.pad-stage'), badge: el.querySelector('.pad-badge'), dock: el.querySelector('.pad-dock'), mood: '', held: null };
      pads.push(p);
      var xb = el.querySelector('.pad-exit');
      if (xb) { xb.addEventListener('pointerdown', function (e) { e.stopPropagation(); e.preventDefault(); askLeave(); }); xb.addEventListener('click', function (e) { e.stopPropagation(); }); }
      setFace(i, 'idle');
      el.addEventListener('pointerdown', function (e) {
        if (e.target && e.target.closest && e.target.closest('.ng-hit')) return;
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
    var k = nk(e);
    for (var i = 0; i < pads.length; i++) if (padKey(i) === k) { e.preventDefault(); if (!keyHeld[i]) { keyHeld[i] = true; press(i); } return; }
  });
  window.addEventListener('keyup', function (e) {
    var k = nk(e);
    for (var i = 0; i < pads.length; i++) if (padKey(i) === k && keyHeld[i]) { keyHeld[i] = false; release(i); }
  });

  /* ---------- sessions ---------- */
  function seenMap() {
    if (S && S.online) return null;
    try { return JSON.parse(localStorage.getItem('sd_seen') || '{}'); } catch (e) { return {}; }
  }
  function pickGame(exclude) {
    var skip = [exclude || S.lastGame].concat(S.played || []);
    var g = SD.pools.one(S.level, skip, S.mrng, seenMap());
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
    if (art.setLiveTint) { art.setLiveTint(0, null); art.setLiveTint(1, null); }
    if (bots.length) {
      art.setLive(1, sim ? sim.skin : art.botSkin());          // the bot always wears the same look; a simulated player has its own
      if (art.setLiveTint) art.setLiveTint(1, sim && sim.tint != null ? (sim.tint | 0) : 0);
    }
    if (online) {
      var mySkin = (conn.you && conn.you.skin != null) ? (conn.you.skin | 0) : (SD.store.get('skins')[0] | 0);
      var oppSkin = (conn.opp && conn.opp.skin != null) ? (conn.opp.skin | 0) : 0;
      art.setLive(me, mySkin); art.setLive(1 - me, oppSkin);
      if (art.setLiveTint) {
        var myTint = (conn.you && conn.you.tint != null) ? (conn.you.tint | 0) : ((SD.store.get('tints') || [0, 0])[0] | 0);
        var oppTint = (conn.opp && conn.opp.tint != null) ? (conn.opp.tint | 0) : 0;
        art.setLiveTint(me, myTint); art.setLiveTint(1 - me, oppTint);
      }
      conn.againMe = conn.againPeer = false;
    }
    var tap = document.getElementById('tapStart'); if (tap) tap.hidden = true;
    try { if (SD.ads && SD.ads.hideBanners) SD.ads.hideBanners(); } catch (e) {}
    S = { mode: mode, n: n, bots: bots, nolocal: online ? [1 - me] : bots.slice(), me: me, online: online ? conn : null, roundNo: 0, peerRes: {}, remoteQ: [],
      armed: [[], []], act: [[], []], want: [[], []], peerUse: {}, useOpen: false, peerPw: {}, pwWait: null, sim: sim, rated: !!(online && conn.kind === 'random') || !!sim, oppLevel: online ? (conn.opp.level | 0) : sim ? sim.level : 0, coinDelta: 0, t0: 0,
      names: online ? (function () {
        var a = [];
        a[me] = (conn.you && conn.you.name) || conn.myName || SD.store.name(0) || 'YOU';
        a[1 - me] = (conn.opp && conn.opp.name) || 'RIVAL';
        return a;
      })() : sim ? [SD.store.name(0), sim.name] : null,
      seed: online ? conn.seed : (Math.random() * 4294967296) >>> 0, skill: skill, level: lvl, hard: hard, tier: boss ? SD.progress.tier() : 0, all: [], totals: [], timers: [], raf: 0, frameFn: null, last: 0, active: [], game: null, accepting: false, onDown: null, onUp: null, ended: false, lastGame: null, played: [], tie: 0, tiebreak: false, round: 0, queue: [], series: mode === 'pay' || mode === 'party' || online, total: 0, gameNo: 0 };
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
    var want = (opts && opts.total) || (conn && conn.total) || (SD.store && (SD.store.get('games') | 0)) || 5;
    S.total = (want === 3 || want === 5 || want === 8) ? want : 5;
    S.gamesNote = (conn && conn.fallback) ? ('This match will have ' + S.total + ' games.') : '';
    var cap = S.total <= 3 ? 1 : 3;
    S.pwLeft = [cap, cap]; S.pocket = null; S.botPocket = null; S.pwPicked = false;
    S.commonOn = [false, false]; S.roundPw = [[], []]; S.skipCommon = [false, false]; S.pwKey = 0;
    S.queue = SD.pools.deck(S.level, S.total, S.mrng, online ? null : seenMap());
    playRound(S.queue.shift(), S.all.slice());
  }

  function stopSpeech() { try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) {} }

  /* ---------- power-ups: 1 use in a 3-game match, 3 uses in a 5 or 8-game match.
     Commons are chosen once before the match. Game cards auto-apply (or you pick common vs game in 3s). ---------- */
  function pickOn() { return !!(S && !S.spec && S.mode !== 'boss' && S.mode !== 'roulette' && (S.bots.length || S.online) && SD.powers && !S.tiebreak); }
  function pickEnabled() { return pickOn(); }
  function pwCard(id) { return '<button type="button" class="pk-pw" data-id="' + id + '">' + art.icon(SD.powers.by[id].icon, 46) +
    '<span class="pk-tx"><b>' + SD.powers.by[id].name + '</b><em>' + SD.powers.by[id].short + '</em><small>' + SD.powers.by[id].desc + '</small></span>' +
    (SD.powers.own(id) ? '<span class="pk-n">x' + SD.powers.own(id) + '</span>' : '') + '</button>'; }
  function hidePick() {
    var el = $('#pick');
    if (S) { if (S.pickTick) { clearInterval(S.pickTick); S.pickTick = 0; } S.pickEnd = null; }
    if (el) { el.hidden = true; el.innerHTML = ''; }
  }
  function syncPw(n, ids, cb) {
    ids = ids || [];
    if (!S || !S.online) return cb([]);
    S.online.peer.send({ t: 'pw', n: n, p: ids });
    if (S.peerPw[n]) return cb(S.peerPw[n]);
    S.pwWait = { n: n, go: function () { if (!S || !S.pwWait || S.pwWait.n !== n) return; S.pwWait = null; cb(S.peerPw[n] || []); } };
    later(function () { if (S && S.pwWait && S.pwWait.n === n) S.pwWait.go(); }, 10000);
  }
  function applyHead(slot, id) {
    if (id !== 'head' || S.commonOn[slot]) return id === 'head';
    arm(slot, ['head']); S.commonOn[slot] = true;
    if ((S.pwLeft[slot] | 0) > 0) S.pwLeft[slot]--;
    if (slot === S.me) S.pocket = null;
    if (S.bots.indexOf(slot) >= 0) S.botPocket = null;
    return true;
  }
  function arm(slot, ids) {
    var pw = SD.powers, out = (S.armed[slot] || []).slice();
    (ids || []).forEach(function (id) {
      var p = pw.by[id]; if (!p || out.indexOf(id) >= 0) return;
      if (id === 'head') { S.totals[slot] += 1; if (slot === S.me) pw.setOwn(id, pw.own(id) - 1); }
      else out.push(id);
    });
    if (slot === S.me) out.forEach(function (id) {
      if ((S.armed[slot] || []).indexOf(id) < 0) pw.setOwn(id, pw.own(id) - 1);
    });
    S.armed[slot] = out; updatePts();
  }
  function spend(slot, id) {
    S.armed[slot] = (S.armed[slot] || []).filter(function (x) { return x !== id; });
    if (SD.powers.by[id] && SD.powers.by[id].kind === 'common') S.commonOn[slot] = false;
  }
  function actsNow(slot) {
    var a = [];
    if (!S.skipCommon[slot]) (S.armed[slot] || []).forEach(function (id) { a.push(id); });
    (S.roundPw[slot] || []).forEach(function (id) { if (a.indexOf(id) < 0) a.push(id); });
    return a;
  }
  function gameCardFor(gid) {
    var hit = SD.powers.list.filter(function (p) { return p.kind === 'game' && p.game === gid && SD.powers.own(p.id) > 0; })[0];
    return hit ? hit.id : null;
  }
  function playRound(game, active) {
    clearAll(); try { if (SD.cg) SD.cg.play(); } catch (e) {}
    if (!pickOn()) return launch(game, active);
    if (!S.pwPicked) return pickCommon(function () { offerPower(game, active); });
    offerPower(game, active);
  }
  function launch(game, active) { beginRound(game, active); }
  function waitPeerThen(ids, then) {
    S.pwKey = (S.pwKey | 0) + 1;
    var n = S.pwKey;
    function go(peer) {
      if (!S || S.leaving) return;
      hidePick();
      if (S.online) applyPeer(peer && peer[0]);
      then();
    }
    if (!S.online) return go([]);
    var el = $('#pick');
    el.innerHTML = '<div class="pk-card"><h2>POWER-UP</h2><p class="pk-wait">WAITING FOR OPPONENT...</p></div>'; el.hidden = false;
    S.pickEnd = hidePick;
    syncPw(n, ids, go);
  }
  function applyPeer(id) {
    var slot = 1 - S.me, q = id && SD.powers.by[id];
    S.roundPw[slot] = []; S.skipCommon[slot] = false;
    if (!q) return;
    if (q.kind === 'game') { S.roundPw[slot] = [id]; S.skipCommon[slot] = true; }
    else if (!S.commonOn[slot]) { arm(slot, [id]); S.commonOn[slot] = true; }
  }
  function commitMine(id) {
    var me = S.me, q = id && SD.powers.by[id];
    S.roundPw[me] = []; S.skipCommon[me] = false;
    if (!q || (S.pwLeft[me] | 0) <= 0) return [];
    if (q.kind === 'game') {
      if (SD.powers.own(id) <= 0) return [];
      S.roundPw[me] = [id]; S.skipCommon[me] = true;
      SD.powers.setOwn(id, SD.powers.own(id) - 1); S.pwLeft[me]--;
      return [id];
    }
    if (S.commonOn[me]) return [];
    if (id === S.pocket) S.pocket = null;
    arm(me, [id]); S.commonOn[me] = true; S.pwLeft[me]--;
    return [id];
  }
  function commitBots(game) {
    S.bots.forEach(function (b) {
      if ((S.pwLeft[b] | 0) <= 0) return;
      S.roundPw[b] = []; S.skipCommon[b] = false;
      var g = SD.powers.list.filter(function (p) { return p.kind === 'game' && p.game === game.id; })[0];
      var c = S.botPocket;
      if (g && (c || S.commonOn[b]) && Math.random() < 0.5) { S.roundPw[b] = [g.id]; S.skipCommon[b] = true; S.pwLeft[b]--; }
      else if (g && Math.random() < 0.8) { S.roundPw[b] = [g.id]; S.skipCommon[b] = true; S.pwLeft[b]--; }
      else if (c && !S.commonOn[b]) { arm(b, [c]); S.commonOn[b] = true; S.botPocket = null; S.pwLeft[b]--; }
    });
  }
  function pickCommon(done) {
    S.pwPicked = true;
    var pw = SD.powers, commons = pw.ownedOf('common'), el = $('#pick'), tick = 0, fin = false, SEC = 8;
    if (S.bots.length && Math.random() < 0.55) {
      var pool = pw.list.filter(function (p) { return p.kind === 'common'; });
      if (pool.length) S.botPocket = pool[Math.floor(Math.random() * pool.length)].id;
    }
    if (S.botPocket === 'head') applyHead(S.bots[0], 'head');
    function finish(id) {
      if (fin) return; fin = true; clearInterval(tick);
      if (id && pw.by[id] && pw.by[id].kind === 'common' && pw.own(id) > 0) S.pocket = id; else S.pocket = null;
      if (S.pocket === 'head') applyHead(S.me, 'head');
      S.pwKey = (S.pwKey | 0) + 1;
      if (!S.online) { hidePick(); return done(); }
      var elw = $('#pick');
      elw.innerHTML = '<div class="pk-card"><h2>POWER-UP</h2><p class="pk-wait">WAITING FOR OPPONENT...</p></div>'; elw.hidden = false;
      S.pickEnd = hidePick;
      syncPw(S.pwKey, S.pocket ? [S.pocket] : (id === 'head' ? ['head'] : []), function (peer) {
        hidePick();
        if (S && S.online) applyHead(1 - S.me, peer && peer[0]);
        if (S && !S.leaving) done();
      });
    }
    if (!commons.length || (S.pwLeft[S.me] | 0) <= 0) return finish(null);
    el.innerHTML = '<div class="pk-card"><div class="pk-head"><h2>PICK 1 COMMON</h2><div class="pk-timer"><b id="pkN">' + SEC + '</b></div></div>' +
      '<div class="pk-bar"><i id="pkBar"></i></div><p class="pk-hint">Works in every game. You can still swap it for a game card later. Skip if you want none.</p>' +
      '<div class="pk-list">' + commons.map(function (p) { return pwCard(p.id); }).join('') + '</div>' +
      '<button type="button" class="gel alt" id="pkSkip"><span>SKIP</span></button></div>';
    Array.prototype.forEach.call(el.querySelectorAll('.pk-pw'), function (b) {
      b.addEventListener('click', function () { au.sfx.select(); finish(b.dataset.id); });
    });
    var sk = el.querySelector('#pkSkip'); if (sk) sk.addEventListener('click', function () { au.sfx.tap(); finish(null); });
    el.hidden = false; au.music.start('game');
    var t0 = performance.now();
    S.pickEnd = hidePick; S.pickTick = tick = setInterval(function () {
      var f = Math.max(0, SEC - (performance.now() - t0) / 1000), n = Math.ceil(f);
      var nEl = el.querySelector('#pkN'), bar = el.querySelector('#pkBar');
      if (nEl && nEl.textContent !== String(n)) { nEl.textContent = n; if (n <= 2) au.sfx.tick(1.4); }
      if (bar) bar.style.width = (f / SEC * 100) + '%';
      if (f <= 0) finish(null);
    }, 100);
  }
  function askWhich(cId, gId, game, cb) {
    var el = $('#pick'), tick = 0, fin = false, SEC = 3, cq = SD.powers.by[cId], gq = SD.powers.by[gId];
    if (!cq || !gq) return cb(gId || cId);
    function finish(id) { if (fin) return; fin = true; clearInterval(tick); hidePick(); cb(id); }
    el.innerHTML = '<div class="pk-card"><div class="pk-head"><h2>' + game.title.toUpperCase() + '</h2><div class="pk-timer"><b id="pkN">' + SEC + '</b></div></div>' +
      '<div class="pk-bar"><i id="pkBar"></i></div><p class="pk-hint">Common or this game\'s card? ' + (S.pwLeft[S.me] | 0) + ' use' + ((S.pwLeft[S.me] | 0) === 1 ? '' : 's') + ' left. Picks itself in 3 seconds.</p>' +
      '<div class="pk-or">' +
      '<button type="button" class="pk-pw" data-pick="C"><small class="pk-tag">COMMON</small>' + art.icon(cq.icon, 46) + '<span class="pk-tx"><b>' + cq.name + '</b><small>' + cq.short + '</small></span></button>' +
      '<button type="button" class="pk-pw on" data-pick="G"><small class="pk-tag">THIS GAME</small>' + art.icon(gq.icon, 46) + '<span class="pk-tx"><b>' + gq.name + '</b><small>' + gq.short + '</small></span></button>' +
      '</div></div>';
    Array.prototype.forEach.call(el.querySelectorAll('.pk-pw'), function (b) {
      b.addEventListener('click', function () { au.sfx.select(); finish(b.dataset.pick === 'C' ? cId : gId); });
    });
    el.hidden = false;
    var t0 = performance.now();
    S.pickEnd = hidePick; S.pickTick = tick = setInterval(function () {
      var f = Math.max(0, SEC - (performance.now() - t0) / 1000), n = Math.ceil(f);
      var nEl = el.querySelector('#pkN'), bar = el.querySelector('#pkBar');
      if (nEl && nEl.textContent !== String(n)) { nEl.textContent = n; if (n <= 1) au.sfx.tick(1.4); }
      if (bar) bar.style.width = (f / SEC * 100) + '%';
      if (f <= 0) finish(gId);
    }, 80);
  }
  function offerPower(game, active) {
    S.roundPw = [[], []]; S.skipCommon = [false, false];
    var me = S.me, left = S.pwLeft[me] | 0;
    var gCard = left > 0 ? gameCardFor(game.id) : null;
    var cCard = (left > 0 && S.pocket && SD.powers.own(S.pocket) > 0) ? S.pocket : null;
    var hasCommon = !!(cCard || S.commonOn[me]);
    function after(id) {
      if (id === 'KEEP') id = null;
      else if (id && SD.powers.by[id] && SD.powers.by[id].kind === 'common' && S.commonOn[me]) id = null;
      var sent = commitMine(id);
      commitBots(game);
      waitPeerThen(sent, function () { launch(game, active); });
    }
    if (gCard && hasCommon) {
      var showC = cCard || (S.armed[me] || [])[0];
      if (showC && SD.powers.by[showC]) return askWhich(showC, gCard, game, after);
    }
    if (gCard) return after(gCard);
    if (cCard && !S.commonOn[me]) return after(cCard);
    after(null);
  }

  function usableNow(slot) { return actsNow(slot); }
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
  function paintPw() {}
  function pwBurst(slot, id) {
    var p = pads[slot], q = SD.powers.by[id]; if (!p || !q) return;
    Array.prototype.forEach.call(p.el.querySelectorAll('.pw-burst'), function (x) { x.remove(); });
    var d = document.createElement('div');
    d.className = 'pw-burst';
    d.innerHTML = '<span class="pw-burst-wash"></span><span class="pw-burst-ring"></span>' + art.icon(q.icon, 120) + '<b>' + q.name + '</b><small>' + q.short + '</small>';
    p.el.appendChild(d);
    p.el.classList.add('pw-on');
    setTimeout(function () { if (d.parentNode) d.remove(); if (p.el) p.el.classList.remove('pw-on'); }, 1500);
    var c = fx.center(p.stage || p.el); fx.burst(c.x, c.y, 28); if (fx.flash) fx.flash('#ffe566'); au.sfx.perfect(); if (fx.vibrate) fx.vibrate(30);
  }
  function paintUse() {
    var me = S.me, p = pads[me];
    pads.forEach(function (x) { if (x.dock) { x.dock.innerHTML = ''; x.dock.className = 'pad-dock'; } x.el.classList.remove('has-dock'); });
    if (!pickEnabled() || !p || !p.dock) return;
    var lists = pads.map(function (x, k) { return (S.act[k] || []).slice(); });
    if (!lists[0].length && !lists[1].length) return;
    var by = SD.powers.by;
    pads.forEach(function (pd, k) {
      var mine = k === me, h = '';
      if (S.active.indexOf(k) < 0 && !mine) return;
      lists[k].forEach(function (id) {
        var q = by[id]; if (!q) return;
        h += '<span class="dk-c on' + (mine ? '' : ' foe') + '" tabindex="0" title="' + q.name + ' — ' + q.short + '">' + art.icon(q.icon, 34) +
          '<b>' + q.name + '</b><i class="dk-tip"><em>' + q.name + '</em>' + q.desc + '</i></span>';
      });
      if (!h) return;
      pd.dock.className = 'pad-dock show'; pd.dock.innerHTML = h; pd.el.classList.add('has-dock');
    });
  }
  function lockAll() {
    if (S.locked) return;
    S.locked = true;
    S.useOpen = false;
    (S.act || [[], []]).forEach(function (ids, slot) {
      ids.forEach(function (id, k) {
        if (!SD.powers.by[id]) return;
        later(function () { pwBurst(slot, id); }, 60 + k * 220);
      });
    });
    paintUse();
  }

  /* ---------- one round ---------- */
  /* bar length must match how long each game really runs (seconds). hop / stack / freeze draw their own bar. */
  var DUR = { balance: 12, beat: 12, bomb: 14, dodge: 13, echo: 24, fillcard: 28, flap: 12, freeze: 19, hop: 16, knife: 22, lander: 22, memory: 32, oddone: 22, piedodge: 16, pinata: 12, quiettwin: 22, skip: 22, snack: 16, stack: 16, whack: 18, zig: 22 };
  function kb() { try { return window.matchMedia('(hover:hover) and (pointer:fine)').matches; } catch (e) { return false; } }
  function howTo(g) {
    var k = padKey(S.me), key = kb() ? 'PRESS ' + (k === 'SPACE' ? 'SPACE' : k) + ' OR TAP YOUR PAD. ' : 'TAP YOUR PAD. ';
    return key + g.tip;
  }
  function introMs(g) {
    var n = 0, m = {}; try { m = JSON.parse(localStorage.getItem('sd_seen') || '{}'); n = m[g.id] | 0; m[g.id] = n + 1; localStorage.setItem('sd_seen', JSON.stringify(m)); } catch (e) {}
    if (S && S.online) return 2200;
    return n < 3 ? 4500 : 2600;
  }
  function beginRound(game, active) {
    clearAll();
    S.t0 = performance.now(); S.roundNo++; S.settle = null; S.waitGo = false; S.locked = false; if (!S.tiebreak) S.gameNo++;
    if (S.peerGo && S.peerGo.n !== S.roundNo) S.peerGo = null;
    S.rngSeed = (S.mrng() * 4294967296) >>> 0; S.rng = mulberry32(S.rngSeed);
    S.active = active.slice(); S.game = game; S.accepting = false; S.onDown = S.onUp = S.onHit = null; S.ended = false;
    S.lastGame = game.id;
    S.played = S.played || [];
    if (S.played.indexOf(game.id) < 0) S.played.push(game.id);
    pads.forEach(function (p, i) {
      p.el.className = 'pad p' + i; p.stage.innerHTML = ''; p.badge.innerHTML = ''; p.mood = '';
      Array.prototype.forEach.call(p.el.querySelectorAll('.pfx, .pfx-ready'), function (t) { t.remove(); });
      if (active.indexOf(i) < 0) {
        p.el.classList.add('safe');
        p.stage.innerHTML = '<div class="safe-mark">' + art.icon('check', 64) + '</div>';
        setFace(i, 'cheer');
      } else setFace(i, 'idle');
    });
    S.act = [actsNow(0), actsNow(1)]; S.want = [[], []]; S.useOpen = false; S.liveFn = null;
    pads.forEach(function (p, i) { var n = p.el.querySelector('.pad-name'); if (n) n.innerHTML = padLabel(i); });
    var onNames = (S.act[S.me] || []).map(function (id) { return SD.powers.by[id] && SD.powers.by[id].name; }).filter(Boolean);
    paintPw(); paintUse();
    updatePts(); hideTimer(); showExit(true);
    au.music.start('game');
    setCenter('<div class="intro">' + (S.series && !S.tiebreak ? '<small class="rnd">GAME ' + S.gameNo + ' OF ' + S.total + '</small>' : S.tiebreak ? '<small class="rnd">TIE BREAKER</small>' : '') + (S.gamesNote && S.gameNo === 1 && !S.tiebreak ? '<span>' + S.gamesNote + '</span>' : '') + art.icon(game.icon, 84) + '<b>' + game.title + '</b><span>' + howTo(game) + '</span>' + (onNames.length ? '<em class="use-hint">' + onNames.join(' · ') + ' IS ON</em>' : '') + '</div>', 'pop');
    au.sfx.select();
    later(function () { countdown(3); }, introMs(game));
  }

  function countdown(n) {
    if (n === 3 && S.game && S.game.setup) { try { S.game.setup(makeCtx()); } catch (e) {} }
    if (n === 1 && S.useOpen) { S.useOpen = false; paintUse(); }        // last second: choices are closed
    if (centerEl) centerEl.classList.toggle('peek-mode', !!(S.game && S.game.peek) && n > 0);
    if (n > 0) {
      if (S.game && S.game.peek) setCenter('<div class="count-peek">MEMORIZE · ' + n + '</div>', 'pop');
      else setCenter('<div class="count-num n' + n + '">' + n + '</div>', 'pop');
      au.sfx.count(n);
      later(function () { countdown(n - 1); }, S.game && S.game.peek ? 1100 : 800);
    } else {
      if (centerEl) centerEl.classList.remove('peek-mode');
      clearCenter(); lockAll();
      showGo(S.game.goText || 'GO!');
      au.sfx.count(0);
      if (!S.game.goText) fx.flash('#fff');
      var G = S.game, SS = S;
      later(function () {
        if (S !== SS || S.game !== G || S.ended) return;
        kickOff();
      }, S.game && S.game.peek ? 80 : 450);
    }
  }

  function pingGo() {
    if (!S || !S.online || S.online.role !== 'host' || S.spec) return;
    try { S.online.peer.send({ t: 'go', n: S.roundNo, rng: S.rngSeed, gid: S.game && S.game.id }); } catch (e) {}
  }
  function runStart() {
    if (!S || S.ended || S.accepting || !S.game) return;
    S.waitGo = false;
    clearCenter();
    var G = S.game;
    S.accepting = true; paintUse();
    if (DUR[G.id] && typeof G.start === 'function') showTimer(DUR[G.id] * 1000);
    G.start(makeCtx());
    flushRemote();
    if (S.online && !S.spec) {
      var riv = pads[1 - S.me];
      if (riv) riv.el.classList.add('rival-live');
    }
    sendSnap({ t: 'go', gid: G.id, rng: S.rngSeed, totals: S.totals.slice(), gameNo: S.gameNo, title: G.title, ts: Date.now() });
    if (S.online && S.online.role === 'host') {
      pingGo();
      later(pingGo, 400);
      later(pingGo, 1000);
    }
  }
  function sameGo(m) {
    if (!m) return false;
    if (m.n == null && m.gid == null) return true;
    if (m.n != null && m.n === S.roundNo) return true;
    if (m.gid && S.game && m.gid === S.game.id) return true;
    return false;
  }
  function kickOff() {
    if (!S || S.ended || S.accepting) return;
    if (!S.online || S.spec) return runStart();
    if (S.online.role === 'host') return runStart();
    if (sameGo(S.peerGo)) {
      if (S.peerGo.rng != null) { S.rngSeed = S.peerGo.rng >>> 0; S.rng = mulberry32(S.rngSeed); }
      return runStart();
    }
    S.waitGo = true;
    later(function () {
      if (S && S.waitGo && !S.accepting && !S.ended) {
        setCenter('<div class="tie">RIVAL<small>GET READY...</small></div>', 'pop');
      }
    }, 350);
    later(function () { if (S && S.waitGo && !S.accepting && !S.ended) runStart(); }, 1200);
  }
  function onPeerGo(m) {
    if (!S || S.spec || !m) return;
    S.peerGo = m;
    if (!S.online || S.online.role === 'host') return;
    if (S.accepting || S.ended) { S.waitGo = false; clearCenter(); return; }
    if (!S.game) return;
    if (m.n != null && m.n < S.roundNo) return;
    if (!sameGo(m) && !S.waitGo) return;
    if (m.rng != null) { S.rngSeed = m.rng >>> 0; S.rng = mulberry32(S.rngSeed); }
    S.timers.forEach(clearTimeout); S.timers = [];
    S.waitGo = false;
    lockAll();
    showGo(S.game.goText || 'GO!');
    runStart();
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
      mine: function (i) { return !S || (S.nolocal || []).indexOf(i) < 0; },
      net: !!(S.online && !S.spec),
      hit: sendHit,
      onHit: function (fn) { S.onHit = fn; },
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
    try { if (SD.cg) SD.cg.stop(); } catch (e) {}
    S.ended = true; S.accepting = false; paintUse();
    S.timers.forEach(clearTimeout); S.timers = [];     // stop any leftover game timers
    hideTimer(); clearCenter(); dropTags();
    S.frameFn = null; cancelAnimationFrame(S.raf); S.raf = 0;
    if (S.game.cleanup) { try { S.game.cleanup(); } catch (e) {} }
    if (S.spec) {
      later(function () { if (S && S.spec && !S.specGotEnd) waitWatch('NEXT GAME SOON'); }, 7000);
      return;
    }
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

  /* How many match points this mini-game is worth. Harder games with more hurdles pay more than a single +1. */
  function earnPts(gid, r) {
    var p = r ? +r.p : 0, n = 0;
    if (gid === 'bomb') n = p >= 0 ? 1 : 0;
    else if (gid === 'dodge' || gid === 'hop' || gid === 'flap' || gid === 'stack' || gid === 'skip' || gid === 'knife') n = Math.max(0, Math.round(p));
    else if (gid === 'freeze') n = p >= 10 ? 4 : Math.max(0, Math.round(Math.min(1, p) * 3));
    else if (gid === 'balance') n = Math.max(0, Math.round(p / 3));
    else if (gid === 'beat') n = Math.max(0, Math.round(p / 2));
    else if (gid === 'echo' || gid === 'snack') n = Math.max(0, Math.round(p));
    else if (gid === 'zig') n = Math.max(0, Math.round(p / 12));
    else if (gid === 'lander') n = Math.max(0, Math.round(p / 100));
    else if (gid === 'pinata') n = Math.max(0, Math.round(p / 20));
    else if (gid === 'memory') n = Math.max(0, Math.round(p / 4));
    else if (gid === 'piedodge' || gid === 'whack') n = Math.max(0, Math.round(p / 30));
    else if (gid === 'fillcard' || gid === 'oddone' || gid === 'quiettwin') n = Math.max(0, Math.round(p / 80));
    else n = p > 0 ? 1 : 0;
    return Math.max(0, Math.min(12, n | 0));
  }

  function finishRound(results) {
    var act = S.active, res = {}, i, used = [];
    var has = function (slot, id) { return (S.act[slot] || []).indexOf(id) >= 0; };
    var count = !S.spec && S.series && !S.tiebreak && S.mode !== 'boss';
    var raw = results.map(function (r) { return { p: r.p, label: r.label }; });
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
    act.forEach(function (i, k) {
      var r = res[i], isBest = !allTie && r.p === best, isWorst = !allTie && r.p === worst;
      pads[i].el.classList.toggle('win', isBest); pads[i].el.classList.toggle('lose', isWorst);
      var lbl = r.label == null ? '' : r.label;
      var earn = count ? earnPts(S.game && S.game.id, raw[k]) : 0;
      var dbl = count && isBest && has(i, 'double'), pts = dbl ? earn * 2 : earn;
      if (dbl) { used.push([i, 'double']); lbl = 'DOUBLE POINT: x' + pts; }
      if (count) S.totals[i] += pts;
      if (S.rated && count && i === S.me && !allTie) {          // coins: quick wins pay more, a lost game costs 1
        if (isBest) S.coinDelta += 2 + Math.round(3 * Math.max(0, 1 - (performance.now() - S.t0) / 12000)); else if (isWorst) S.coinDelta -= 1;
      }
      if (count && isBest && has(i, 'steal')) {
        used.push([i, 'steal']); lbl = lbl || 'STEALER: RIVAL -1';
        act.forEach(function (j) { if (j !== i) S.totals[j] = Math.max(0, S.totals[j] - 1); });
      }
      var shown = count ? (pts > 0 ? '+' + pts : (isWorst ? 'LOST' : '0')) : (isBest ? 'WIN' : isWorst ? 'LOST' : 'DRAW');
      if (S.mode !== 'boss') {                              // big result in the pad: crown + point, or thumbs down
        pads[i].badge.innerHTML = '';
        pads[i].stage.innerHTML = '<div class="res ' + (isBest ? 'win' : isWorst ? 'lose' : 'draw') + '">' +
          (isBest ? art.icon('crown') : isWorst ? art.icon('thumbdown') : '<b class="res-eq">=</b>') +
          '<b class="res-txt">' + shown + '</b>' +
          (lbl ? '<span class="res-lbl">' + lbl + '</span>' : '') + '</div>';
      } else pads[i].badge.innerHTML = (lbl || isBest || isWorst) ?
        '<div class="pb ' + (isBest ? 'best' : isWorst ? 'worst' : '') + '">' + (isBest ? art.icon('crown', 22) : isWorst ? art.icon(S.series ? 'cross' : 'pie', 22) : '') + '<span>' + lbl + '</span></div>' : '';
      setFace(i, isBest ? 'cheer' : isWorst ? 'sad' : 'idle');
    });
    used.forEach(function (u, k) {
      spend(u[0], u[1]);
      var say = { second: ['SECOND CHANCE!', 'YOUR LOSS BECAME A DRAW'], lucky: ['LUCKY TIE!', 'THE DRAW IS YOUR WIN'], double: ['DOUBLE POINT!', 'x2 THIS GAME'], steal: ['STEALER!', 'RIVAL LOSES 1 POINT'] }[u[1]] || [SD.powers.by[u[1]].name, ''];
      later(function () { powerFx(u[0], u[1], say[0], say[1], true); }, 250 + k * 300);
    });
    updatePts();
    sendSnap({ t: 'end', totals: S.totals.slice(), title: S.game ? S.game.title : '', ts: Date.now() });
    var meI = S.spec ? -1 : (S.bots.length || S.online) ? S.me : -1;
    if (S.mode === 'boss') { if (results[0].p === 1) au.sfx.win(); else au.sfx.lose(); }
    else if (allTie) au.sfx.bwoop();
    else if (meI >= 0 && res[meI]) { if (res[meI].p === best) au.sfx.roundWin(); else au.sfx.roundLose(); }
    else { au.sfx.coin(); au.sfx.bonk && setTimeout(au.sfx.bonk, 180); }
    var score = {};
    act.forEach(function (i) { score[i] = res[i].p; });
    later(function () { afterRound(act, score, worst, allTie); }, 1800);
  }

  function afterRound(act, score, worst, allTie) {
    if (S.spec) {
      S.game = null; S.accepting = false;
      setCenter('<div class="tie">WATCHING<small>NEXT GAME SOON</small></div>', 'pop');
      return;
    }
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
      return '<span class="fan" data-i="' + i + '" data-crown="' + (crown ? 1 : 0) + '" style="animation-delay:' + (i * 0.08) + 's">' + art.face(i, 'idle', { crown: crown }) + '</span>';
    }).join('');
    $('#cereTitle').innerHTML = '&nbsp;'; $('#cereTitle').className = '';
    $('#cereLine').textContent = '';
    try { if (SD.ads && SD.ads.hideBanners) SD.ads.hideBanners(); } catch (e) {}
    $('#cereStage').innerHTML = (crowd ? '<div class="cs-crowd">' + crowd + '</div>' : '') +
      '<div class="cs-loser"><div class="cs-face">' + art.face(loser, 'worry') + '</div><div class="cs-pie">' + art.icon('pie', 120) + '</div></div>';
    var btns = $('#cereBtns'); btns.hidden = true;
    var rate = $('#cereRate'); if (rate) { rate.hidden = true; rate.innerHTML = ''; }
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
      if (!S.online) {
        SD.store.addPie(loser);
        if (loser !== 0) SD.store.set('wins', (SD.store.get('wins') | 0) + 1);
      }
    }, 1350);
    later(function () {
      var meC = (S.bots.length || S.online) ? S.me : -1;
      if (meC >= 0 && loser !== meC) { au.sfx.win(); au.sfx.cheer(); try { if (SD.cg && SD.cg.happy) SD.cg.happy(); } catch (e) {} }
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
    var CS = S; setTimeout(function () {
      if (S === CS && S.inCere) {
        btns.hidden = false;
        if (SD.feedback && SD.feedback.mount) SD.feedback.mount($('#cereRate'));
      }
    }, 2500);   // plain timer: nothing that clears match timers can hide the way out
    $('#bAgain').onclick = function () { au.sfx.select(); afterAd(function () {
      if (S.online) return rematch();
      var sim = S.sim && SD.sim ? SD.sim.pick() : null, mode = S.mode;
      function go(n) {
        if (sim) startSession('pay', null, { sim: sim, total: n });
        else startSession(mode, null, { total: n });
      }
      if (SD.main && SD.main.askGames) SD.main.askGames(go);
      else go((SD.main && SD.main.gamesN) ? SD.main.gamesN() : 5);
    }); };
    $('#bHome').onclick = function () { au.sfx.tap(); afterAd(function () { E.home(); }); };
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
    var me = (S.me != null) ? S.me : 0, oppI = 1 - me, oppName = slotName(oppI);
    function noteAll(won, coinsNet, pts, after) {
      if (!SD.ledger || S.logged) return;
      S.logged = true;
      try {
        SD.ledger.logMatch({ won: won, opp: oppName });
        SD.ledger.logCoins({ n: coinsNet | 0, bal: SD.store.get('coins') | 0, why: 'PLAY', opp: oppName });
        if (pts) SD.ledger.logPts({ n: pts, xp: after ? after.xp : 0, lvl: after ? after.level : 0, opp: oppName });
      } catch (e) {}
    }
    if (!S.rated) {
      el.innerHTML = '<div class="xp-msg hint">' + art.icon('offline', 22) + '<span>' + (SD.BUILD === 'cg' ? 'TWO ON ONE PHONE: LEVEL AND COINS STAY THE SAME' : 'LEVELS AND COINS: RANDOM ONLINE MATCHES ONLY') + '</span></div>';
      noteAll(loser !== me, 0, 0, null);
      return;
    }
    var P = SD.progress, won = loser !== me, r = P.rate(won, S.oppLevel);
    var net = P.addCoins(S.coinDelta + (won ? 10 : -5));
    noteAll(won, net, r.pts, r.after);
    if (S.online) {
      var key = won ? 'owins' : 'olosses'; SD.store.set(key, (SD.store.get(key) | 0) + 1);
      if (SD.net) SD.net.sync();
    }
    var a = r.after, pct = a.need ? Math.min(100, Math.round(a.xp / a.need * 100)) : 0;
    var pts = r.pts ? (r.pts > 0 ? '+' : '') + r.pts + ' PT' : (r.gated ? 'BOSS!' : '0 PT');
    var html = '<div class="xp-row"><span class="xp-lv">LV ' + a.level + '</span><div class="xpbar' + (a.gated ? ' gated' : '') + '"><i style="width:' + pct + '%"></i></div><b>' + pts + '</b></div>';
    if (r.ups.length && !a.gated) html += '<div class="xp-msg up">LEVEL UP!</div>';
    if (SD.arenas) r.ups.forEach(function (L) { var ar = SD.arenas.forLevel(L); if (ar) html += '<div class="xp-msg up">NEW PLAY ROOM: ' + ar.name + '!</div>'; });
    if (SD.art) r.ups.forEach(function (L) { art.SKINS.forEach(function (s, id) { if (art.skinReq(id).lvl === L && L > 1) html += '<div class="xp-msg up">NEW LOOK: ' + s.name + ' (SHOP)</div>'; }); });
    if (a.gated) html += '<div class="xp-msg boss">' + art.icon('skull', 22) + '<span>' + (r.ups.length ? 'LEVEL UP! ' : '') + 'BEAT THE BOSS TO UNLOCK ' + art.skinName(a.bossSkin) + '</span></div>';
    if (r.downs) {
      html += '<div class="xp-msg down">LEVEL DOWN</div>';
      var bits = [];
      if (r.lost) {
        if (r.lost.powers && r.lost.powers.length) bits.push('POWERS ' + r.lost.powers.join(', '));
        if (r.lost.arenas && r.lost.arenas.length) bits.push('ARENAS ' + r.lost.arenas.join(', '));
        if (r.lost.skins && r.lost.skins.length) bits.push('SKINS ' + r.lost.skins.join(', '));
      }
      html += '<div class="xp-lost">' + (bits.length ? 'YOU LOST ' + bits.join(' · ') : 'LOCKED POWERS, ARENAS AND LOOKS ARE GONE') + '</div>';
    }
    html += '<div class="xp-coins ' + (net >= 0 ? 'plus' : 'minus') + '">' + art.icon('bill', 22) + '<b>' + (net >= 0 ? '+' : '') + net + '</b><span>COINS</span></div>';
    el.innerHTML = html;
    if (r.ups.length) { au.sfx.tada(); fx.confetti(innerWidth / 2, innerHeight * 0.3, 18, 1); }
    else if (r.downs) { au.sfx.bwoop(); fx.shake(520); }
    else if (net > 0) au.sfx.coin();
  }

  /* One short tap on a card or lane. Same relay as pad down, no extra server work, no per-frame spam. */
  function sendHit(k) {
    if (!S || !S.online || S.spec || S.ended) return;
    k = k | 0;
    if (k < 0 || k > 31) return;
    var now = performance.now();
    if (S.hitAt && now - S.hitAt < 24 && S.hitK === k) return;
    S.hitAt = now; S.hitK = k;
    try { S.online.peer.send({ t: 'x', k: k }); } catch (e) {}
  }
  function applyHit(slot, k) {
    if (!S) return;
    k = k | 0;
    if (!S.accepting || !S.onHit) { S.remoteQ = S.remoteQ || []; S.remoteQ.push({ t: 'x', i: slot, k: k }); return; }
    S.onHit(slot, k);
  }
  function flushRemote() {
    if (!S || !S.remoteQ) return;
    var q = S.remoteQ; S.remoteQ = [];
    q.forEach(function (ev) {
      if (ev.t === 'x') applyHit(ev.i, ev.k);
      else if (ev.t === 'd') press(ev.i, true);
      else release(ev.i, true);
    });
  }
  function onRemote(kind, slot) {
    var ps = slot == null ? (S.spec ? 0 : 1 - S.me) : slot;
    if (pads[ps]) {
      if (kind === 'd') { pads[ps].el.classList.add('down'); if (!S.accepting) setFace(ps, 'worry'); }
      else pads[ps].el.classList.remove('down');
    }
    if (S.accepting) { if (kind === 'd') press(ps, true); else release(ps, true); }
    else S.remoteQ.push({ t: kind, i: ps });
  }
  function sendSnap(snap) {
    if (!S || S.spec || !S.online || S.online.role !== 'host' || !S.online.onSnap) return;
    try { S.online.onSnap(snap); } catch (e) {}
  }
  function onNet(m) {
    if (!S || !S.online || !m) return;
    if (m.t === 'd') onRemote('d');
    else if (m.t === 'u') onRemote('u');
    else if (m.t === 'x' && m.k != null) applyHit(S.spec ? 0 : 1 - S.me, m.k);
    else if (m.t === 'go') onPeerGo(m);
    else if (m.t === 'r') { S.peerRes[m.n] = m; if (S.settle && m.n === S.roundNo) S.settle(); }
    else if (m.t === 'pw') { S.peerPw[m.n] = Array.isArray(m.p) ? m.p.slice(0, 3) : []; if (S.pwWait && S.pwWait.n === m.n) S.pwWait.go(); }
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
    if (SD.feedback && SD.feedback.mount) SD.feedback.mount($('#cereRate'));
    if (win) { var c = fx.center($('#cereStage')); fx.confetti(c.x, c.y, 50, 1.2); fx.rain(50); au.sfx.cheer(); au.say(art.skinName(id) + ' unlocked!', { pitch: 1.8, rate: 1.05 }); try { if (SD.cg && SD.cg.happy) SD.cg.happy(); } catch (e) {} }
    var again = $('#bAgain'); if (again) again.onclick = function () { au.sfx.select(); afterAd(function () { startSession('boss'); }); };
    $('#bHome').onclick = function () { au.sfx.tap(); afterAd(function () { E.home(); }); };
  }

  function share(name) {
    var text = name + ' got hit by the pie in Silly Duel! Who pays the bill at your table?';
    var url = location.href.split('#')[0];
    if (navigator.share) { navigator.share({ title: 'Silly Duel', text: text, url: url }).catch(function () {}); return; }
    var done = function () { var c = fx.center($('#bShare')); fx.popText(c.x, c.y - 30, 'COPIED', 'ha'); };
    try { navigator.clipboard.writeText(text + ' ' + url).then(done, function () {}); } catch (e) {}
  }

  /* ---------- live spectate: full arena, both pads are remote, host snaps start each game ---------- */
  function byId(id) { for (var i = 0; i < SD.games.length; i++) if (SD.games[i].id === id) return SD.games[i]; return null; }
  function markWatch() {
    var old = arenaEl.querySelector('.watch-live'); if (old) old.remove();
    var b = document.createElement('div'); b.className = 'watch-live'; b.textContent = 'LIVE';
    arenaEl.appendChild(b);
  }
  function waitWatch(msg) {
    hideTimer();
    setCenter('<div class="tie">WATCHING<small>' + (msg || 'NEXT GAME SOON') + '</small></div>', 'pop');
  }
  function startWatchSession(spec) {
    stopSpeech();
    var tap = document.getElementById('tapStart'); if (tap) tap.hidden = true;
    art.setLive(0, spec.a && spec.a.skin | 0); art.setLive(1, spec.b && spec.b.skin | 0);
    if (art.setLiveTint) { art.setLiveTint(0, spec.a && spec.a.tint | 0); art.setLiveTint(1, spec.b && spec.b.tint | 0); }
    S = { mode: 'online', n: 2, bots: [], nolocal: [0, 1], me: 0, spec: true, specStop: spec.onStop, specGotEnd: false,
      online: { role: 'host', kind: 'spec', arena: spec.arena | 0, peer: { send: function () {}, onmessage: null, onclose: null } },
      roundNo: 0, peerRes: {}, remoteQ: [], armed: [[], []], act: [[], []], want: [[], []], peerUse: {}, useOpen: false, peerPw: {},
      rated: false, names: [spec.a && spec.a.name || 'P1', spec.b && spec.b.name || 'P2'],
      seed: spec.seed | 0, skill: 0.5, level: spec.level | 0 || 1, hard: 0, tier: 0, all: [0, 1],
      totals: (spec.totals && spec.totals.slice()) || [0, 0], timers: [], raf: 0, frameFn: null, last: 0,
      active: [0, 1], game: null, accepting: false, onDown: null, onUp: null, ended: false, lastGame: null,
      tie: 0, tiebreak: false, round: 0, queue: [], series: true, total: spec.total || 3, gameNo: 0 };
    S.mrng = mulberry32(S.seed);
    $('#home').hidden = true; ceremonyEl.hidden = true; arenaEl.hidden = false;
    if (SD.arenas) { if (SD.arenas.force) SD.arenas.force(spec.arena | 0); SD.arenas.enter(arenaEl); }
    buildPads(2); updatePts(); clearCenter(); hideTimer(); markWatch();
    waitWatch('WAITING FOR THE NEXT GAME');
    au.music.start('game');
    if (spec.snap) applySnap(spec.snap);
  }
  function applySnap(snap) {
    if (!S || !S.spec || !snap) return;
    if (snap.t === 'go') specGo(snap);
    else if (snap.t === 'end') specEnd(snap);
  }
  function specGo(snap) {
    if (snap.ts && Date.now() - snap.ts > 900) return waitWatch((snap.title || 'LIVE MATCH') + ' · NEXT GAME');
    var game = byId(snap.gid); if (!game) return waitWatch(snap.title || 'LIVE MATCH');
    if (Array.isArray(snap.totals)) { S.totals = snap.totals.slice(); updatePts(); }
    if (snap.gameNo) S.gameNo = snap.gameNo;
    clearAll(); if (S.game && S.game.cleanup) { try { S.game.cleanup(); } catch (e) {} }
    S.specGotEnd = false; S.ended = false; S.settle = null; S.remoteQ = [];
    S.rngSeed = snap.rng >>> 0; S.rng = mulberry32(S.rngSeed);
    S.active = [0, 1]; S.game = game; S.accepting = false; S.onDown = S.onUp = null; S.lastGame = game.id;
    pads.forEach(function (p, i) {
      p.el.className = 'pad p' + i; p.stage.innerHTML = ''; p.badge.innerHTML = ''; p.mood = '';
      Array.prototype.forEach.call(p.el.querySelectorAll('.pfx, .pfx-ready'), function (t) { t.remove(); });
      setFace(i, 'idle');
    });
    hideTimer(); clearCenter(); markWatch();
    showGo(game.goText || 'GO!');
    S.accepting = true;
    if (DUR[game.id]) showTimer(DUR[game.id] * 1000);
    game.start(makeCtx());
    flushRemote();
  }
  function specEnd(snap) {
    if (!S || !S.spec) return;
    S.specGotEnd = true;
    if (Array.isArray(snap.totals)) { S.totals = snap.totals.slice(); updatePts(); }
    if (!S.ended) {
      S.ended = true; S.accepting = false;
      if (S.game && S.game.cleanup) { try { S.game.cleanup(); } catch (e) {} }
      S.frameFn = null; cancelAnimationFrame(S.raf); S.raf = 0; hideTimer();
    }
    pads.forEach(function (p, i) {
      var mine = S.totals[i], best = Math.max(S.totals[0], S.totals[1]), worst = Math.min(S.totals[0], S.totals[1]);
      p.el.classList.toggle('win', mine === best && best !== worst);
      p.el.classList.toggle('lose', mine === worst && best !== worst);
    });
    later(function () { if (S && S.spec) waitWatch('NEXT GAME SOON'); }, 1600);
  }
  function specEvent(slot, m) {
    if (!S || !S.spec || !m) return;
    if (m.t === 'd') onRemote('d', slot);
    else if (m.t === 'u') onRemote('u', slot);
    else if (m.t === 'x' && m.k != null) applyHit(slot, m.k);
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
    var party = $('#party');
    var inGame = (arenaEl && !arenaEl.hidden) || (ceremonyEl && !ceremonyEl.hidden) || (party && !party.hidden);
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
    start: function (mode, opts) { startSession(mode, null, opts); },
    startOnline: function (conn) { startSession('online', conn); },
    startSim: function (sim) { startSession('pay', null, { sim: sim }); },
    watch: function (spec) { startWatchSession(spec || {}); },
    specSnap: function (snap) { applySnap(snap); },
    specEvent: function (slot, m) { specEvent(slot, m); },
    watching: function () { return !!(S && S.spec); },
    home: function () {
      var rb = document.getElementById('rescueBtn'); if (rb) rb.remove();
      try { if (SD.cg) SD.cg.stop(); } catch (e) {}
      var spec = !!(S && S.spec), specStop = spec ? S.specStop : null;
      if (spec) {
        if (S) { clearAll(); if (S.game && S.game.cleanup) { try { S.game.cleanup(); } catch (e) {} } }
        S = null; stopSpeech(); art.setLive(0, null); art.setLive(1, null);
        if (art.setLiveTint) { art.setLiveTint(0, null); art.setLiveTint(1, null); }
        var lb = document.getElementById('leaveBox'); if (lb) lb.remove();
        var ban = arenaEl.querySelector('.watch-live'); if (ban) ban.remove();
        if (fx && fx.stop) fx.stop();
        arenaEl.hidden = true; ceremonyEl.hidden = true;
        hideTimer(); clearCenter(); padsEl.innerHTML = ''; pads = [];
        $('#goText').classList.remove('on');
        if (SD.arenas) SD.arenas.leave();
        au.music.start('menu');
        if (specStop) specStop();
        return;
      }
      var tour = !!(S && S.online && S.online.kind === 'tour');
      if (tour && !S.tourEnded) { S.tourEnded = true; try { S.online.onEnd(1 - S.me); } catch (er) {} }
      if (SD.party && S && S.online && !tour) SD.party.matchOver();
      if (S && S.online && !tour) { try { S.online.peer.send({ t: 'bye' }); S.online.peer.onclose = null; S.online.peer.close(); } catch (e) {} }
      if (S) { clearAll(); if (S.game && S.game.cleanup) { try { S.game.cleanup(); } catch (e) {} } }
      S = null; stopSpeech(); art.setLive(0, null); art.setLive(1, null); if (art.setLiveTint) { art.setLiveTint(0, null); art.setLiveTint(1, null); }  var lb = document.getElementById('leaveBox'); if (lb) lb.remove();
      if (fx && fx.stop) fx.stop();
      arenaEl.hidden = true; ceremonyEl.hidden = true; $('#home').hidden = false;
      if (tour && SD.tour) { hideTimer(); clearCenter(); padsEl.innerHTML = ''; pads = []; $('#goText').classList.remove('on'); au.music.start('menu'); return SD.tour.back(); } if (SD.arenas) SD.arenas.leave();
      hideTimer(); clearCenter(); padsEl.innerHTML = ''; pads = [];
      $('#goText').classList.remove('on');
      SD.main && SD.main.refresh();
      au.music.start('menu');
      try { if (SD.ads && SD.ads.showHomeBanner) SD.ads.showHomeBanner(); } catch (e) {}
    }
  };
  SD.engine = E;
})();
