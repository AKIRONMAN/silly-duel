/* Home screen, skin picker and start-up. */
(function () {
  'use strict';
  var art = SD.art, au = SD.audio, st = SD.store, pr = SD.progress;
  var $ = function (s) { return document.querySelector(s); };
  var PAGES = ['offline', 'arenas', 'powers', 'wardrobe', 'online', 'party', 'info'];
  var pageStack = [];
  function pageId(id) { return String(id || '').replace(/^#/, ''); }
  function pageOpen(id) {
    id = pageId(id);
    var el = document.getElementById(id); if (!el) return;
    $('#home').hidden = true;
    PAGES.forEach(function (k) { var n = document.getElementById(k); if (n) n.hidden = k !== id; });
    if (pageStack[pageStack.length - 1] !== id) pageStack.push(id);
    if (SD.ads && SD.ads.onScreen) SD.ads.onScreen(id);
  }
  function pageClose(id) {
    id = pageId(id);
    var el = document.getElementById(id); if (el) el.hidden = true;
    var i = pageStack.lastIndexOf(id);
    if (i >= 0) pageStack.length = i;
    var arena = $('#arena'), cere = $('#ceremony');
    if ((arena && !arena.hidden) || (cere && !cere.hidden)) return;
    var prev = pageStack[pageStack.length - 1];
    if (prev) {
      var p = document.getElementById(prev);
      if (p) {
        p.hidden = false;
        if (prev === 'wardrobe') { paintSave(); if (wdSlot === 0) { var s = $('#wdStats'); if (s) s.innerHTML = playerStatsHtml(true, true); } }
        if (SD.ads && SD.ads.onScreen) SD.ads.onScreen(prev);
        return;
      }
    }
    pageStack = [];
    $('#home').hidden = false; refresh();
    if (SD.ads && SD.ads.onScreen) SD.ads.onScreen('home');
  }
  SD.page = { open: pageOpen, close: pageClose };
  SD.ask = function (opts, onYes) {
    opts = opts || {};
    var el = document.getElementById('ask');
    if (!el) { if (onYes && window.confirm(opts.title || 'LEAVE?')) onYes(); return; }
    document.getElementById('askTitle').textContent = opts.title || 'LEAVE?';
    document.getElementById('askMsg').textContent = opts.msg || 'Do you want to close this?';
    document.getElementById('askYes').querySelector('span').textContent = opts.yes || 'LEAVE';
    document.getElementById('askNo').querySelector('span').textContent = opts.no || 'KEEP WAITING';
    el.hidden = false;
    var yes = document.getElementById('askYes'), no = document.getElementById('askNo');
    var done = function (ok) {
      el.hidden = true; yes.onclick = no.onclick = null;
      if (ok && onYes) onYes();
    };
    yes.onclick = function () { au.sfx.select(); done(true); };
    no.onclick = function () { au.sfx.tap(); done(false); };
  };

  var CG = SD.BUILD === 'cg';
  var TOGGLES = [['#btnMusic', 'music', 'music'], ['#btnSfx', 'sfx', 'speaker']];
  var PAD = ['#d4f1ff', '#ffd6ea'];            // player one is always blue, player two always pink

  function buildToggles() {
    TOGGLES.forEach(function (t) {
      var b = $(t[0]);
      var paint = function () {
        var on = au.isOn(t[1]);
        b.innerHTML = art.icon(t[2]) + (on ? '' : art.icon('slash', null, 'sl'));
        b.classList.toggle('off', !on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      };
      paint();
      b.addEventListener('click', function () { au.setOn(t[1], !au.isOn(t[1])); paint(); au.sfx.select(); });
    });
  }

  function fmtCoin(n) {
    n = Math.max(0, n | 0);
    function compact(x, u) {
      var t = x >= 100 ? String(Math.round(x)) : String(Math.round(x * 10) / 10);
      if (t.slice(-2) === '.0') t = t.slice(0, -2);
      return t + u;
    }
    if (n >= 10000000) return compact(n / 10000000, 'cr');
    if (n >= 100000) return compact(n / 100000, 'L');
    if (n >= 1000) return compact(n / 1000, 'K');
    return String(n);
  }
  function fmtComma(n) {
    n = Math.max(0, n | 0);
    var s = String(n), last = s.slice(-3), rest = s.slice(0, -3);
    if (!rest) return last;
    return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last;
  }
  function playerStatsHtml(big, fullCoins) {
    var pies = st.pies();
    var wins = (st.get('wins') | 0) + (st.get('owins') | 0);
    var loss = (pies[0] | 0) + (st.get('olosses') | 0);
    var coins = st.get('coins') | 0;
    var sz = big ? 22 : 16;
    return '<span class="stat" title="Wins">' + art.icon('trophy', sz) + '<b>' + fmtComma(wins) + '</b></span>' +
      '<span class="stat" title="Losses">' + art.icon('pie', sz) + '<b>' + fmtComma(loss) + '</b></span>' +
      '<span class="stat" title="Coins">' + art.icon('bill', sz) + '<b>' + (fullCoins ? fmtComma(coins) : fmtCoin(coins)) + '</b></span>';
  }

  /* ---------- home card: just you. Player 2 is chosen in the offline popup ---------- */
  function buildDuel() {
    var info = pr.info();
    var pct = Math.min(100, Math.round(info.xp / info.need * 100));
    $('#duel').innerHTML = '<div class="duel-one solo" style="--pc:' + PAD[0] + '">' +
      '<button class="duel-face" type="button" data-slot="0" aria-label="Change your look">' + art.face(0, 'idle') + '</button>' +
      '<button class="duel-name" type="button" data-slot="0" aria-label="Change name">' + esc(st.name(0)) + '</button>' +
      '<div class="lvl"><b>LV ' + info.level + '</b><div class="xpbar' + (info.gated ? ' gated' : '') + '"><i style="width:' + pct + '%"></i></div></div>' +
      '<div class="duel-stats big">' + playerStatsHtml(true) + '</div></div>';
    Array.prototype.forEach.call($('#duel').querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () { au.sfx.select(); openWardrobe(0); });
    });
  }

  /* ---------- keys: player 1 key is also used online and against the bot ---------- */
  var RESERVED = { ESCAPE: 1, TAB: 1, SHIFT: 1, CONTROL: 1, ALT: 1, META: 1, CAPSLOCK: 1, DEAD: 1, UNIDENTIFIED: 1, BACKSPACE: 1, ENTER: 1 };
  function keyName(k) { return k === 'SPACE' ? 'SPACE' : k.replace('ARROW', ''); }
  function setKey(slot, k) {
    var keys = (st.get('keys') || ['Q', 'P']).slice(), other = 1 - slot;
    if (keys[other] === k) keys[other] = keys[slot];                  // same key wanted: swap them
    keys[slot] = k; st.set('keys', keys);
  }
  function keyBtn(slot, onDone) {
    var keys = st.get('keys') || ['Q', 'P'];
    return '<button type="button" class="key-btn" data-slot="' + slot + '"><small>KEY</small><b>' + keyName(keys[slot]) + '</b></button>';
  }
  function bindKeyBtns(root, onDone) {
    Array.prototype.forEach.call(root.querySelectorAll('.key-btn'), function (b) {
      b.addEventListener('click', function () {
        au.sfx.select(); b.classList.add('wait'); b.innerHTML = '<small>PRESS A KEY</small><b>...</b>';
        var off = function () { window.removeEventListener('keydown', onKey, true); b.removeEventListener('blur', cancel); };
        var cancel = function () { off(); onDone(); };
        var onKey = function (e) {
          e.preventDefault(); e.stopPropagation();
          var k = e.key === ' ' ? 'SPACE' : (e.key || '').toUpperCase();
          if (k === 'ESCAPE') return cancel();
          if (RESERVED[k] || /^F\d+$/.test(k)) return;
          setKey(+b.dataset.slot, k); au.sfx.coin(); off(); onDone();
        };
        window.addEventListener('keydown', onKey, true); b.addEventListener('blur', cancel);
      });
    });
  }

  /* ---------- offline popup: choose player 1 and player 2 ---------- */
  function renderOffline() {
    var bot = st.get('opp') === 'bot' && !CG, pies = st.pies();
    var tile = function (slot) {
      var isBot = slot === 1 && bot;
      return '<div class="of-tile" style="--pc:' + PAD[slot] + '"><small class="of-who">PLAYER ' + (slot + 1) + '</small>' +
        (isBot ? '<div class="duel-face bot">' + art.face(1, 'idle', { skin: art.botSkin() }) + '</div><span class="duel-name">BOT</span><span class="dim">COMPUTER</span>'
          : '<button class="duel-face" type="button" data-slot="' + slot + '" aria-label="Change look">' + art.face(slot, 'idle') + '</button>' +
            '<button class="duel-name" type="button" data-slot="' + slot + '" aria-label="Change name">' + esc(st.name(slot)) + '</button>' + keyBtn(slot)) + '</div>';
    };
    $('#ofRow').innerHTML = tile(0) + '<b class="vs">VS</b>' + tile(1);
    $('#ofOpp').style.display = CG ? 'none' : '';
    $('#ofOpp').innerHTML = [['friend', 'FRIEND', 'friend'], ['bot', 'BOT', 'bot']].map(function (o) {
      var on = (o[0] === 'bot') === bot;
      return '<button class="gel chip" type="button" role="radio" aria-checked="' + on + '" data-o="' + o[0] + '">' + art.icon(o[2], 26) + '<span>' + o[1] + '</span></button>';
    }).join('');
    Array.prototype.forEach.call($('#ofOpp').children, function (b) {
      b.addEventListener('click', function () { st.set('opp', b.dataset.o); au.sfx.tap(); renderOffline(); });
    });
    Array.prototype.forEach.call($('#ofRow').querySelectorAll('button.duel-face, button.duel-name'), function (b) {
      b.addEventListener('click', function () { au.sfx.select(); openWardrobe(+b.dataset.slot); });
    });
    bindKeyBtns($('#ofRow'), renderOffline);
  }
  function openOffline() { renderOffline(); pageOpen('offline'); }

  /* ---------- power-up shop (markup from /screens/powers.html) ---------- */
  function fillCoins(el, coins, lvl) {
    if (!el) return;
    el.innerHTML = art.icon('bill', 24) + '<b>' + fmtCoin(coins) + '</b><small>LV ' + lvl + '</small>';
  }
  function loadScreen(el, url) {
    if (!el || el.dataset.ready === '1') return Promise.resolve(el);
    return fetch(url, { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : Promise.reject(); })
      .then(function (html) { el.innerHTML = html; el.dataset.ready = '1'; return el; });
  }
  function hydrateShop() {
    var pw = SD.powers, lvl = st.get('level') | 0, coins = st.get('coins') | 0;
    fillCoins($('#pwCoins'), coins, lvl);
    $('#pwNote').textContent = 'Prices go up 10 coins every level. You can hold up to ' + pw.cap + ' of each.';
    Array.prototype.forEach.call($('#pwGrid').querySelectorAll('.pw-card'), function (card) {
      var id = card.dataset.id, p = pw.by[id]; if (!p) return;
      var why = pw.canBuy(id), locked = why === 'LEVEL', pr = pw.price(id);
      var ico = card.querySelector('.pw-ico');
      if (ico) ico.innerHTML = art.icon(p.icon, 44) + (locked ? art.icon('lock', 20, 'pw-lock') : '');
      card.classList.toggle('locked', locked);
      var nm = card.querySelector('.pw-name'); if (nm) nm.textContent = locked ? '???' : p.name;
      var ds = card.querySelector('.pw-desc'); if (ds) ds.textContent = locked ? 'UNLOCKS AT LEVEL ' + p.lvl : p.desc;
      var own = card.querySelector('.pw-own'); if (own) own.textContent = 'HAVE ' + pw.own(id);
      var buy = card.querySelector('.pw-buy');
      if (buy) {
        buy.disabled = !!why;
        buy.innerHTML = locked ? 'LV ' + p.lvl : why === 'COINS' ? 'NEED ' + pr : why === 'FULL' ? 'FULL' : art.icon('bill', 16) + pr;
      }
    });
    if ($('#pwGrid').dataset.bound === '1') return;
    $('#pwGrid').dataset.bound = '1';
    $('#pwGrid').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.pw-buy') : null; if (!b || !$('#pwGrid').contains(b)) return;
      if (pw.buy(b.dataset.id)) { au.sfx.coin(); au.sfx.perfect(); buildCoins(); hydrateShop(); } else au.sfx.bwoop();
    });
  }
  function renderShop() {
    loadScreen($('#pwGrid'), 'screens/powers.html').then(hydrateShop, hydrateShop);
  }
  function hydrateArenas() {
    var A = SD.arenas, cur = A.current(), lvl = st.get('level') | 0;
    fillCoins($('#arCoins'), st.get('coins') | 0, lvl);
    Array.prototype.forEach.call($('#arGrid').querySelectorAll('.ar-card'), function (b) {
      var a = A.byId(b.dataset.id); if (!a) return;
      var t = A.state(a), locked = t === 'shadow';
      b.classList.toggle('locked', locked);
      b.classList.toggle('sel', t === 'own' && cur.id === a.id);
      var th = b.querySelector('.ar-thumb');
      if (th && a.scene) th.innerHTML = String(a.scene).replace('viewBox="0 0 390 780"', 'viewBox="0 0 390 340"');
      var lock = b.querySelector('.ar-lock'); if (lock) lock.remove();
      if (locked) { var i = document.createElement('span'); i.innerHTML = art.icon('lock', 20, 'ar-lock'); b.insertBefore(i.firstChild, b.querySelector('.ar-name')); }
      var nm = b.querySelector('.ar-name'); if (nm) nm.textContent = locked ? '???' : a.name;
      var ds = b.querySelector('.ar-desc');
      if (ds) ds.textContent = locked ? 'UNLOCKS AT LEVEL ' + a.lvl : t === 'buy' ? 'BUY · ' + a.cost + ' COINS' : (cur.id === a.id ? 'IN USE' : 'TAP TO USE');
    });
    if ($('#arGrid').dataset.bound === '1') return;
    $('#arGrid').dataset.bound = '1';
    $('#arGrid').addEventListener('click', function (e) {
      var prev = e.target.closest ? e.target.closest('.ar-prev') : null;
      var card = e.target.closest ? e.target.closest('.ar-card') : null;
      if (prev && card) { e.stopPropagation(); previewArena(card.dataset.id); return; }
      if (!card || !$('#arGrid').contains(card)) return;
      var a = A.byId(card.dataset.id), t = A.state(a);
      if (t === 'own') { A.pin(a.id); au.sfx.coin(); }
      else if (t === 'buy' && A.buy(a)) { au.sfx.coin(); au.sfx.perfect(); buildCoins(); }
      else { au.sfx.bwoop(); return; }
      hydrateArenas();
    });
  }
  function openArenas() {
    loadScreen($('#arGrid'), 'screens/arenas.html').then(function () { hydrateArenas(); pageOpen('arenas'); }, function () { hydrateArenas(); pageOpen('arenas'); });
  }
  function previewArena(id) {
    var A = SD.arenas, a = A.byId(id); if (!a) return;
    var arena = $('#arena'), tap = $('#tapStart'); if (tap) tap.hidden = true;
    $('#arenas').hidden = true; $('#home').hidden = true; $('#ceremony').hidden = true;
    $('#pads').innerHTML = ''; arena.hidden = false;
    if (A.state(a) === 'own') A.pin(a.id);
    A.enter(arena, a.id);
    var old = arena.querySelector('.ar-close'); if (old) old.remove();
    var b = document.createElement('button'); b.type = 'button'; b.className = 'icon-btn pg-back ar-close'; b.setAttribute('aria-label', 'Close preview'); b.innerHTML = art.icon('back', 24);
    b.addEventListener('click', function () {
      b.remove(); A.leave(); arena.hidden = true; openArenas();
    });
    arena.appendChild(b);
    var ban = arena.querySelector('.arena-banner'); if (ban) ban.remove();
    var nb = document.createElement('div'); nb.className = 'arena-banner stay'; nb.innerHTML = '<small>PREVIEW</small>' + a.name;
    arena.appendChild(nb);
  }
  function openShop() { renderShop(); pageOpen('powers'); }

  function buildBoss() {
    var id = pr.info().gated ? pr.bossSkin() : -1, w = $('#bossWrap');
    if (id < 0) { w.innerHTML = ''; return; }
    w.innerHTML = '<button class="gel boss" type="button">' + art.icon('skull') + '<span>BOSS FIGHT!<small>WIN TO UNLOCK ' + art.skinName(id) + '</small></span>' + art.face(0, 'idle', { skin: id }).replace('class="face', 'class="ghost face') + '</button>';
    w.firstChild.addEventListener('click', function () { au.sfx.select(); SD.engine.start('boss'); });
  }

  function gamesN() { var n = st.get('games') | 0; return n === 3 || n === 8 ? n : 5; }
  function paintGamesPick(root, onPick) {
    if (!root) return;
    var cur = gamesN();
    root.innerHTML = [3, 5, 8].map(function (n) {
      return '<button type="button" class="games-n' + (cur === n ? ' on' : '') + '" data-n="' + n + '" role="radio" aria-checked="' + (cur === n) + '">' + n + '</button>';
    }).join('');
    Array.prototype.forEach.call(root.children, function (b) {
      b.addEventListener('click', function () { st.set('games', +b.dataset.n); au.sfx.tap(); if (onPick) onPick(); else paintGamesPick(root); });
    });
  }
  function paintModeIcons() {
    Array.prototype.forEach.call(document.querySelectorAll('.mode-ico[data-icon]'), function (el) {
      el.innerHTML = art.icon(el.dataset.icon, el.dataset.sz ? +el.dataset.sz : 24);
    });
  }
  function buildModes() {
    paintModeIcons();
    if ($('#modes').dataset.bound === '1') return;
    $('#modes').dataset.bound = '1';
    if (CG) {
      var grid = $('#modes').querySelector('.mode-grid'); if (grid) grid.classList.add('two');
      var room = $('#modes').querySelector('[data-mode="room"]'); if (room) room.hidden = true;
      var board = $('#btnBoard'); if (board) board.hidden = true;
      var row2 = $('#modeRow2') || document.querySelector('.mode-row2'); if (row2) row2.classList.add('pair');
    }
    var more = $('#btnMore');
    if (more) {
      more.innerHTML = art.icon('more', 32);
      more.addEventListener('click', function () { au.sfx.select(); openInfo(); });
    }
    $('#btnPowers').addEventListener('click', function () { au.sfx.select(); openShop(); });
    $('#btnArena').addEventListener('click', function () { au.sfx.select(); openArenas(); });
    var boardBtn = $('#btnBoard');
    if (boardBtn && !CG) boardBtn.addEventListener('click', function () { au.sfx.select(); if (SD.lobby) SD.lobby.openBoard(); });
    Array.prototype.forEach.call($('#modes').querySelectorAll('button.mode'), function (b) {
      b.addEventListener('click', function () {
        au.sfx.select();
        var id = b.dataset.mode;
        if (id === 'quick') { if (CG && SD.sim) SD.sim.play(); else if (SD.party) SD.party.quick(); }
        else if (id === 'room') { if (SD.party) SD.party.menu(); }
        else openOffline();
      });
    });
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- control position settings (with preview) ---------- */
  function mock(kind, val) {
    var row = kind === 'H';
    var me = '<span class="cm-pad me">' + art.face(0, 'idle') + '<i>YOU</i></span>';
    var op = '<span class="cm-pad op">' + art.face(1, 'idle', { skin: art.botSkin() }) + '<i>OPP</i></span>';
    var mineFirst = val === 'top' || val === 'left';
    return '<span class="cm ' + (row ? 'row' : 'col') + '">' + (mineFirst ? me + op : op + me) + '</span>';
  }
  function buildSettings() {
    $('#stK').innerHTML = keyBtn(0) + keyBtn(1); bindKeyBtns($('#stK'), buildSettings);
    var groups = [['#stV', 'ctrlV', [['top', 'TOP'], ['bottom', 'BOTTOM']]], ['#stH', 'ctrlH', [['left', 'LEFT'], ['right', 'RIGHT']]]];
    groups.forEach(function (g) {
      var cur = st.get(g[1]);
      $(g[0]).innerHTML = g[2].map(function (o) {
        return '<button type="button" class="st-tile' + (cur === o[0] ? ' on' : '') + '" data-v="' + o[0] + '" role="radio" aria-checked="' + (cur === o[0]) + '">' + mock(g[1] === 'ctrlH' ? 'H' : 'V', o[0]) + '<b>' + o[1] + '</b></button>';
      }).join('');
      Array.prototype.forEach.call($(g[0]).children, function (b) {
        b.addEventListener('click', function () { st.set(g[1], b.dataset.v); au.sfx.select(); buildSettings(); });
      });
    });
  }
  var wdTab = 'look';
  function showWdTab(id) {
    wdTab = id === 'ctrl' ? 'ctrl' : id === 'av' ? 'av' : 'look';
    var tl = $('#tabLook'), ta = $('#tabAv'), tc = $('#tabCtrl');
    if (tl) { tl.classList.toggle('on', wdTab === 'look'); tl.setAttribute('aria-selected', wdTab === 'look' ? 'true' : 'false'); }
    if (ta) { ta.classList.toggle('on', wdTab === 'av'); ta.setAttribute('aria-selected', wdTab === 'av' ? 'true' : 'false'); }
    if (tc) { tc.classList.toggle('on', wdTab === 'ctrl'); tc.setAttribute('aria-selected', wdTab === 'ctrl' ? 'true' : 'false'); }
    var lp = $('#wdLook'), ap = $('#wdAvatars'), cp = $('#wdControls');
    if (lp) lp.hidden = wdTab !== 'look';
    if (ap) ap.hidden = wdTab !== 'av';
    if (cp) cp.hidden = wdTab !== 'ctrl';
  }
  function paintSave() {
    var btn = $('#wdSignIn'), note = $('#wdSaveNote'), me = wdSlot === 0;
    if (btn) btn.hidden = !me;
    if (note) note.hidden = !me;
    var tabs = $('#wdTabs'); if (tabs) tabs.hidden = !me;
    var top = $('#wdTopRow'); if (top) top.hidden = !me;
    if (!me) showWdTab('av');
    parkWdExtras(!me);
    if (!me || !btn) return;
    var net = SD.net, ok = !CG && net && net.configured();
    if (!ok) {
      if (btn) btn.hidden = true;
      if (note) note.textContent = CG ? 'Your progress is saved with CrazyGames.' : 'Your progress stays on this phone.';
      return;
    }
    var inn = !!(net.signedIn && net.signedIn());
    btn.querySelector('span').textContent = inn ? 'ACCOUNT' : 'SIGN IN';
    if (note) note.textContent = inn
      ? 'Your details are saved. Tap ACCOUNT to manage them.'
      : 'Your details are not saved. Sign in to save them on every phone.';
  }

  /* ---------- skin picker / profile ---------- */
  var wdTimer = 0, wdSlot = 0, wdSel = 0;
  var MOODS = ['idle', 'cheer', 'laugh', 'worry', 'sad', 'dizzy', 'pied'];
  function wdTint() { return ((st.get('tints') || [0, 0])[wdSlot] | 0); }
  function wdFace(mood, id) { return art.face(wdSlot, mood, { skin: id, tint: wdTint() }); }
  function openWardrobe(slot) {
    wdSlot = slot; wdSel = art.slotSkin(slot);
    pageOpen('wardrobe');
    var p2 = !$('#offline').hidden && slot === 1;
    var title = $('#wdTitle');
    if (title) { title.hidden = !p2; title.textContent = p2 ? 'PLAYER 2 LOOK' : ''; }
    var ni = $('#wdNameIn');
    ni.value = st.name(slot); ni.readOnly = false;
    $('#wdNameNote').textContent = slot === 0 ? (CG ? 'Tap the name to change it.' : 'Tap the name to change it. This is shown online and on the TOP 100.') : '';
    if (slot === 0) { buildSettings(); showWdTab(wdTab); } else showWdTab('av');
    paintWardrobe();
    var k = 0;
    clearInterval(wdTimer);
    wdTimer = setInterval(function () {
      k = (k + 1) % MOODS.length;
      var html = wdFace(MOODS[k], wdSel).replace('class="face', 'class="' + (skinState(wdSel) === 'shadow' ? 'shade ' : '') + 'face');
      ['#wdPrev', '#wdPrevAv'].forEach(function (s) { var e = $(s); if (e) e.innerHTML = html; });
    }, 750);
  }
  function skinState(id) { var w = pr.canBuySkin(id); return w === 'OWNED' ? 'own' : w === 'LEVEL' ? 'shadow' : 'buy'; }
  function parkWdExtras(p2) {
    var look = $('#wdLook'), av = $('#wdAvatars');
    if (!look || !av) return;
    var host = p2 ? av : look;
    var before = p2 ? $('#wdScroll') : null;
    var lab = look.querySelector('label.wd-label') || av.querySelector('label.wd-label');
    var nodes = p2
      ? [ $('#wdColors'), lab, $('#wdNameIn'), $('#wdNameNote') ]
      : [ $('#wdColors'), lab, $('#wdNameIn'), $('#wdSignIn'), $('#wdSaveNote'), $('#wdNameNote') ];
    nodes.forEach(function (n) {
      if (!n) return;
      if (before && before.parentNode === host) host.insertBefore(n, before);
      else host.appendChild(n);
    });
  }
  function fillSkinHead(prevSel, nameSel, lockSel, stt, rr, rq) {
    var el = $(prevSel); if (!el) return;
    el.innerHTML = wdFace('idle', wdSel).replace('class="face', 'class="' + (stt === 'shadow' ? 'shade ' : '') + 'face');
    el.className = 'wd-preview' + (stt === 'shadow' ? ' locked' : ' aura-' + rr.rank);
    el.style.setProperty('--rc', rr.color);
    var nm = $(nameSel);
    if (nm) nm.innerHTML = '<span class="rar-pill" style="background:' + rr.color + '">' + rr.name + '</span><br>' + (stt === 'shadow' ? '???' : art.skinName(wdSel));
    var lk = $(lockSel);
    if (!lk) return;
    if (stt === 'shadow') { lk.hidden = false; lk.innerHTML = art.icon('lock', 16) + ' UNLOCKS AT LEVEL ' + rq.lvl; }
    else { lk.hidden = true; lk.innerHTML = ''; }
  }
  function paintWardrobe() {
    var stt = skinState(wdSel), rq = art.skinReq(wdSel), coins = st.get('coins') | 0, tint = wdTint();
    var rr = art.rarity(wdSel);
    fillSkinHead('#wdPrev', '#wdName', '#wdLock', stt, rr, rq);
    fillSkinHead('#wdPrevAv', '#wdNameAv', '#wdLockAv', stt, rr, rq);
    var stats = $('#wdStats');
    if (stats && wdSlot === 0) stats.innerHTML = playerStatsHtml(true, true);
    paintSave();
    var bw = $('#wdBuy');
    bw.innerHTML = stt === 'buy' ? '<button type="button" class="gel wd-buy"' + (coins < rq.cost ? ' disabled' : '') + '>' + art.icon('bill', 22) + '<span>' + (coins < rq.cost ? 'NEED ' + rq.cost : 'BUY ' + rq.cost) + '</span></button>' : '';
    if (stt === 'buy') bw.firstChild.addEventListener('click', function () {
      if (pr.buySkin(wdSel)) { au.sfx.coin(); au.sfx.perfect(); SD.fx && SD.fx.burst && 0; paintWardrobe(); buildCoins(); } else au.sfx.bwoop();
    });
    var ownFill = (art.SKINS[wdSel] || art.SKINS[0]).fill;
    $('#wdColors').innerHTML = art.PALETTES.map(function (p, i) {
      return '<button type="button" class="wd-swatch' + (tint === i ? ' on' : '') + '" data-t="' + i + '" style="background:' + (p.fill || ownFill) + '" aria-label="' + p.name + '" title="' + p.name + '"></button>';
    }).join('');
    Array.prototype.forEach.call($('#wdColors').children, function (b) {
      b.addEventListener('click', function () {
        var tints = (st.get('tints') || [0, 0]).slice();
        tints[wdSlot] = +b.dataset.t; st.set('tints', tints); au.sfx.tap(); paintWardrobe();
      });
    });
    $('#wdGrid').innerHTML = art.SKINS.map(function (s, id) {
      var t = skinState(id), eq = st.get('skins')[wdSlot] === id;
      return '<button type="button" class="wd-tile' + (t === 'shadow' ? ' locked' : t === 'buy' ? ' buyable' : '') + (eq ? ' on' : '') + (wdSel === id ? ' sel' : '') + '" style="--rc:' + art.rarity(id).color + '" data-id="' + id + '" aria-label="' + (t === 'shadow' ? 'locked skin' : s.name) + '">' +
        wdFace('idle', id) + (t === 'shadow' ? art.icon('lock', 22, 'lk') : t === 'buy' ? art.icon('bill', 22, 'lk') : '') + '</button>';
    }).join('');
    Array.prototype.forEach.call($('#wdGrid').children, function (b) {
      b.addEventListener('click', function () {
        var id = +b.dataset.id; wdSel = id; au.music.preview(id);
        if (pr.isUnlocked(id)) { pr.equip(wdSlot, id); au.sfx.coin(); } else au.sfx.bwoop();
        paintWardrobe();
      });
    });
  }
  function closeWardrobe() {
    clearInterval(wdTimer); au.sfx.tap(); au.music.refresh();
    var ni = $('#wdNameIn');
    if (!ni.readOnly) { if (st.setName(wdSlot, ni.value) && wdSlot === 0 && SD.net) SD.net.sync(); }
    pageClose('wardrobe');
    if (!$('#offline').hidden) renderOffline();
  }

  var INFO_PANES = { about: 'infoAbout', terms: 'infoTerms', help: 'infoHelp', feed: 'infoFeed' };
  var FB_MOOD = ['', 'MEH', 'OK', 'FINE', 'YAY', 'LOVE IT'];
  var fbStars = 0;
  function showInfoTab(id) {
    if (!INFO_PANES[id]) id = 'about';
    Array.prototype.forEach.call(document.querySelectorAll('#infoTabs .pw-tab'), function (b) {
      var on = b.dataset.tab === id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    Object.keys(INFO_PANES).forEach(function (k) {
      var n = document.getElementById(INFO_PANES[k]);
      if (n) n.hidden = k !== id;
    });
  }
  function starBtns(size) {
    return [1, 2, 3, 4, 5].map(function (n) {
      return '<button type="button" class="fb-star" data-n="' + n + '" role="radio" aria-label="' + n + ' star' + (n > 1 ? 's' : '') + '"></button>';
    }).join('');
  }
  function paintStarRow(row, n, size) {
    if (!row) return;
    n = n | 0;
    Array.prototype.forEach.call(row.querySelectorAll('.fb-star'), function (b) {
      var v = +b.dataset.n, on = v <= n;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', v === n ? 'true' : 'false');
      b.innerHTML = art.icon(on ? 'star' : 'starOff', size || 32);
    });
  }
  function paintFbStars() {
    var row = $('#fbStars'), mood = $('#fbMood');
    if (!row) return;
    if (!row.dataset.bound) {
      row.dataset.bound = '1';
      row.innerHTML = starBtns();
      Array.prototype.forEach.call(row.children, function (b) {
        b.addEventListener('click', function () {
          fbStars = +b.dataset.n;
          au.sfx.tap();
          paintFbStars();
        });
      });
    }
    paintStarRow(row, fbStars, 32);
    if (mood) mood.textContent = FB_MOOD[fbStars] || 'TAP A STAR';
  }
  function saveStars(n, done) {
    n = n | 0;
    if (n < 1 || n > 5) { if (done) done(false); return; }
    fbStars = n;
    if (CG) { st.set('fbLast', n); if (done) done(true); return; }
    if (!SD.net || !SD.net.sendFeedback) { if (done) done(false); return; }
    SD.net.sendFeedback('', n).then(function () { if (done) done(true); }, function () { if (done) done(false); });
  }
  function mountRate(root) {
    if (!root) return;
    var picked = 0, busy = false;
    root.hidden = false;
    root.innerHTML = '<p class="fb-rate-h">HOW HAPPY?</p><div class="fb-stars" role="radiogroup">' + starBtns() + '</div><p class="fb-mood">TAP A STAR</p><button type="button" class="gel alt fb-write"><span>WRITE MORE</span></button>';
    var row = root.querySelector('.fb-stars'), mood = root.querySelector('.fb-mood'), write = root.querySelector('.fb-write');
    paintStarRow(row, 0, 30);
    Array.prototype.forEach.call(row.children, function (b) {
      b.addEventListener('click', function () {
        if (busy || picked) return;
        var n = +b.dataset.n;
        picked = n; busy = true; fbStars = n;
        au.sfx.select();
        paintStarRow(row, n, 30);
        if (mood) mood.textContent = FB_MOOD[n] || '';
        saveStars(n, function (ok) {
          busy = false;
          if (ok) { if (mood) mood.textContent = 'THANKS — ' + (FB_MOOD[n] || ''); }
          else { picked = 0; if (mood) mood.textContent = 'TRY AGAIN'; }
        });
      });
    });
    if (write) write.addEventListener('click', function () { openFeedbackPage(); });
  }
  function openFeedbackPage() {
    au.sfx.select();
    var cere = $('#ceremony');
    if (cere && !cere.hidden && SD.engine) SD.engine.home();
    var err = $('#fbErr'); if (err) { err.textContent = ''; err.classList.remove('ok'); }
    paintFbStars();
    showInfoTab('feed');
    pageOpen('info');
  }
  function openInfo() {
    showInfoTab('about');
    var err = $('#fbErr'); if (err) { err.textContent = ''; err.classList.remove('ok'); }
    pageOpen('info');
    if (SD.ads && SD.ads.showMoreBanner) SD.ads.showMoreBanner();
  }
  SD.feedback = { mount: mountRate, openWrite: openFeedbackPage };
  function bindInfo() {
    var tabs = $('#infoTabs');
    if (tabs) Array.prototype.forEach.call(tabs.querySelectorAll('.pw-tab'), function (b) {
      b.addEventListener('click', function () { au.sfx.tap(); showInfoTab(b.dataset.tab); });
    });
    var back = $('#infoBack');
    if (back) back.addEventListener('click', function () { au.sfx.tap(); pageClose('info'); });
    paintFbStars();
    var send = $('#fbSend'), box = $('#fbMsg'), err = $('#fbErr');
    if (!send || !box) return;
    send.addEventListener('click', function () {
      if (send.disabled) return;
      var msg = box.value;
      err.textContent = '';
      err.classList.remove('ok');
      if (fbStars < 1) { err.textContent = 'TAP A STAR'; return; }
      if (String(msg || '').replace(/\s+/g, ' ').trim().length < 4) {
        err.textContent = 'WRITE A BIT MORE';
        return;
      }
      if (CG) {
        send.disabled = true;
        au.sfx.select();
        st.set('fbLast', fbStars);
        st.set('fbNote', String(msg || '').slice(0, 400));
        box.value = '';
        fbStars = 0;
        paintFbStars();
        err.textContent = 'THANKS — SAVED';
        err.classList.add('ok');
        send.disabled = false;
        return;
      }
      if (!SD.net || !SD.net.sendFeedback) {
        err.textContent = 'NEED INTERNET';
        return;
      }
      send.disabled = true;
      au.sfx.select();
      SD.net.sendFeedback(msg, fbStars).then(function () {
        box.value = '';
        fbStars = 0;
        paintFbStars();
        err.textContent = 'THANKS — SENT';
        err.classList.add('ok');
        send.disabled = false;
      }, function (e) {
        var c = (e && e.code) || '';
        err.textContent = c === 'stars' ? 'TAP A STAR' : c === 'offline' ? 'NEED INTERNET' : (SD.net.nice ? SD.net.nice(e) : 'TRY AGAIN');
        send.disabled = false;
      });
    });
  }

  function buildCoins() { buildDuel(); }
  function refresh() {
    if (CG) st.set('opp', 'friend');
    buildDuel(); buildBoss();
    var wd = $('#wardrobe');
    if (wd && !wd.hidden && wdSlot === 0) { paintSave(); var s = $('#wdStats'); if (s) s.innerHTML = playerStatsHtml(true, true); }
  }
  SD.main = { refresh: refresh, gamesN: gamesN };

  function init() {
    SD.fx.init();
    SD.engine.init();
    buildToggles(); buildModes(); refresh();
    ['#wdBack', '#pwBack', '#arBack', '#ofBack', '#infoBack'].forEach(function (s) {
      var b = $(s); if (b) b.innerHTML = art.icon('back', 24);
    });
    bindInfo();
    $('#wdBack').addEventListener('click', closeWardrobe);
    paintGamesPick($('#ofGames'));
    $('#tabLook').addEventListener('click', function () { au.sfx.tap(); showWdTab('look'); });
    $('#tabAv').addEventListener('click', function () { au.sfx.tap(); showWdTab('av'); });
    $('#tabCtrl').addEventListener('click', function () { au.sfx.tap(); showWdTab('ctrl'); if (wdSlot === 0) buildSettings(); });
    $('#ofGo').addEventListener('click', function () { au.sfx.select(); pageClose('offline'); SD.engine.start('pay', { total: gamesN() }); });
    $('#ofBack').addEventListener('click', function () { au.sfx.tap(); pageClose('offline'); });
    $('#arBack').addEventListener('click', function () { au.sfx.tap(); pageClose('arenas'); });
    $('#pwBack').addEventListener('click', function () { au.sfx.tap(); pageClose('powers'); buildCoins(); });
    var sign = $('#wdSignIn');
    if (sign) sign.addEventListener('click', function () {
      au.sfx.select();
      var ni = $('#wdNameIn');
      if (ni && !ni.readOnly) { if (st.setName(wdSlot, ni.value) && wdSlot === 0 && SD.net) SD.net.sync(); }
      if (SD.lobby && SD.lobby.open) SD.lobby.open();
    });
    function hideBoot(then) {
      var el = document.getElementById('boot');
      var t0 = Date.now();
      function go() {
        var wait = Math.max(0, 700 - (Date.now() - t0));
        setTimeout(function () {
          if (!el) { if (then) then(); return; }
          el.classList.add('out');
          setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); if (then) then(); }, 420);
        }, wait);
      }
      var fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
      var done = false;
      function once() { if (done) return; done = true; requestAnimationFrame(function () { requestAnimationFrame(go); }); }
      fonts.then(once, once);
      setTimeout(once, 2200);
    }
    function afterPaint() {
      function movie() { if (SD.intro) { au.music.start('menu'); SD.intro.play(function () { au.sfx.select(); }); } }
      if (au.running()) { movie(); return; }
      if (!(au.isOn('music') || au.isOn('sfx'))) return;
      var ov = $('#tapStart'); ov.hidden = false;
      var go = function () {
        ov.hidden = true; au.unlock();
        movie();
        ov.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go);
      };
      ov.addEventListener('pointerdown', go); window.addEventListener('keydown', go);
    }
    hideBoot(afterPaint);
    SD.engine.home();
    if (SD.ads && SD.ads.init) SD.ads.init();
    if (CG && SD.cg) SD.cg.init().then(function () { refresh(); if (SD.ads) SD.ads.ready(); if (SD.ads && SD.ads.showHomeBanner) SD.ads.showHomeBanner(); });
    else if (SD.ads && SD.ads.showHomeBanner) SD.ads.showHomeBanner();
    if (!CG && SD.net) SD.net.boot().then(function (loaded) { if (loaded) { refresh(); au.music.refresh(); } });
    if (!CG && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
    var m = /[?&]room=([A-Za-z]{4})/.exec(location.search);
    if (!CG && m && SD.lobby) SD.lobby.autoJoin(m[1].toUpperCase());
    var pm = /[?&]party=([A-Za-z]{4})/.exec(location.search);
    if (!CG && pm && SD.party) SD.party.join(pm[1].toUpperCase());
    else if (!CG && !m && SD.party && SD.party.resume) SD.party.resume();
    document.addEventListener('visibilitychange', function () { au.setPaused(document.hidden); });
  }
  init();
})();
