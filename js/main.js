/* Home screen, skin picker and start-up. */
(function () {
  'use strict';
  var art = SD.art, au = SD.audio, st = SD.store, pr = SD.progress;
  var $ = function (s) { return document.querySelector(s); };
  var PAGES = ['offline', 'arenas', 'powers', 'settings', 'wardrobe', 'online', 'party'];
  function pageOpen(id) {
    var el = $(id.indexOf('#') === 0 ? id : '#' + id); if (!el) return;
    $('#home').hidden = true; el.hidden = false;
  }
  function pageClose(id) {
    var el = $(id.indexOf('#') === 0 ? id : '#' + id); if (el) el.hidden = true;
    var arena = $('#arena'), cere = $('#ceremony');
    if ((arena && !arena.hidden) || (cere && !cere.hidden)) return;
    var open = PAGES.some(function (k) { var n = document.getElementById(k); return n && !n.hidden; });
    if (!open) { $('#home').hidden = false; refresh(); }
  }
  SD.page = { open: pageOpen, close: pageClose };

  var CG = SD.BUILD === 'cg';
  var TOGGLES = [['#btnMusic', 'music', 'music'], ['#btnSfx', 'sfx', 'speaker'], ['#btnVoice', 'voice', 'voice']];
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

  /* ---------- home card: just you. Player 2 is chosen in the offline popup ---------- */
  function buildDuel() {
    var info = pr.info(), pies = st.pies();
    var pct = Math.min(100, Math.round(info.xp / info.need * 100));
    $('#duel').innerHTML = '<div class="duel-one solo" style="--pc:' + PAD[0] + '">' +
      '<button class="duel-face" type="button" data-slot="0" aria-label="Change your look">' + art.face(0, 'idle') + '</button>' +
      '<button class="duel-name" type="button" data-slot="0" aria-label="Change name">' + esc(st.name(0)) + '</button>' +
      '<div class="lvl"><b>LV ' + info.level + '</b><div class="xpbar' + (info.gated ? ' gated' : '') + '"><i style="width:' + pct + '%"></i></div></div>' +
      '<span class="pies">' + art.icon('pie', 16) + '<b>' + pies[0] + '</b></span></div>';
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

  /* ---------- power-up shop ---------- */
  var shopTab = 'common';
  function renderShop() {
    var pw = SD.powers, lvl = st.get('level') | 0, coins = st.get('coins') | 0;
    $('#pwCoins').innerHTML = art.icon('bill', 24) + '<b>' + coins + '</b><small>LV ' + lvl + '</small>';
    $('#pwNote').textContent = 'Prices go up 10 coins every level. You can hold up to ' + pw.cap + ' of each.';
    var games = pw.list.filter(function (p) { return p.kind === 'game'; });
    var groups = [['WORK IN EVERY GAME', pw.list.filter(function (p) { return p.kind === 'common'; })], ['GAMES 1-5', games.slice(0, 5)], ['GAMES 6-10', games.slice(5, 10)], ['GAMES 11-15', games.slice(10)]];
    function card(p) {
      var why = pw.canBuy(p.id), locked = why === 'LEVEL', pr = pw.price(p.id);
      return '<div class="pw-card' + (locked ? ' locked' : '') + '"><div class="pw-ico">' + art.icon(p.icon, 44) + (locked ? art.icon('lock', 20, 'pw-lock') : '') + '</div>' +
        '<b class="pw-name">' + (locked ? '???' : p.name) + '</b><span class="pw-desc">' + (locked ? 'UNLOCKS AT LEVEL ' + p.lvl : p.desc) + '</span>' +
        '<div class="pw-foot"><span class="pw-own">HAVE ' + pw.own(p.id) + '</span>' +
        '<button type="button" class="pw-buy" data-id="' + p.id + '"' + (why ? ' disabled' : '') + '>' + (locked ? 'LV ' + p.lvl : why === 'COINS' ? 'NEED ' + pr : why === 'FULL' ? 'FULL' : art.icon('bill', 16) + pr) + '</button></div></div>';
    }
    var keep = $('#pwGrid').scrollTop;
    $('#pwGrid').innerHTML = groups.filter(function (g) { return g[1].length; }).map(function (g) { return '<h3 class="pw-sec">' + g[0] + '</h3><div class="pw-sgrid">' + g[1].map(card).join('') + '</div>'; }).join('');
    $('#pwGrid').scrollTop = keep;
    Array.prototype.forEach.call($('#pwGrid').querySelectorAll('.pw-buy'), function (b) {
      b.addEventListener('click', function () {
        if (pw.buy(b.dataset.id)) { au.sfx.coin(); au.sfx.perfect(); buildCoins(); renderShop(); } else au.sfx.bwoop();
      });
    });
  }
  function openArenas() {
    var A = SD.arenas, cur = A.current();
    $('#arNote').innerHTML = 'Rooms open at LEVEL 5, 10, 15, 20, 25, 30, 37, 44 and 48. Buy them with coins. ' + art.icon('bill', 14) + '<b>' + (st.get('coins') | 0) + '</b>';
    $('#arGrid').innerHTML = A.list.map(function (a) {
      var t = A.state(a);
      return '<button type="button" class="ar-card' + (t === 'shadow' ? ' locked' : '') + (t === 'own' && cur.id === a.id ? ' sel' : '') + '" data-id="' + a.id + '" style="background:' + a.bg + '">' +
        (t === 'shadow' ? '???' : a.name) + '<small>' + (t === 'own' ? (cur.id === a.id ? 'IN USE' : 'TAP TO USE') : t === 'buy' ? 'BUY ' + a.cost : 'LEVEL ' + a.lvl) + '</small>' +
        '<span class="ar-prev" data-id="' + a.id + '">PREVIEW</span></button>';
    }).join('');
    Array.prototype.forEach.call($('#arGrid').children, function (b) {
      b.addEventListener('click', function (e) {
        if (e.target.classList.contains('ar-prev')) { e.stopPropagation(); previewArena(b.dataset.id); return; }
        var a = A.byId(b.dataset.id), t = A.state(a);
        if (t === 'own') { A.pin(a.id); au.sfx.coin(); }
        else if (t === 'buy' && A.buy(a)) { au.sfx.coin(); au.sfx.perfect(); buildCoins(); }
        else { au.sfx.bwoop(); return; }
        openArenas();
      });
    });
    pageOpen('arenas');
  }
  function previewArena(id) {
    var A = SD.arenas, a = A.byId(id); if (!a) return;
    var arena = $('#arena'), tap = $('#tapStart'); if (tap) tap.hidden = true;
    $('#arenas').hidden = true; $('#home').hidden = true; $('#ceremony').hidden = true;
    $('#pads').innerHTML = ''; arena.hidden = false;
    if (A.state(a) === 'own') A.pin(a.id);
    A.enter(arena, a.id);
    var old = arena.querySelector('.ar-close'); if (old) old.remove();
    var b = document.createElement('button'); b.type = 'button'; b.className = 'gel ar-close'; b.innerHTML = '<span>CLOSE PREVIEW</span>';
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

  function buildModes() {
    var btn = function (id, cls, icon, label) { return '<button class="gel mode ' + cls + '" type="button" data-mode="' + id + '">' + art.icon(icon) + '<span>' + label + '</span></button>'; };
    $('#modes').innerHTML = '<div class="mode-grid' + (CG ? ' two' : '') + '">' +
      (CG ? btn('quick', 'online', 'playgo', 'PLAY') + btn('pay', 'pay offline', 'friend', 'PLAY WITH A FRIEND')
          : btn('pay', 'pay offline wide', 'offline', 'PLAY') + btn('quick', 'online', 'globe', 'MATCH')) +
      (CG ? '' : btn('room', 'invite', 'friend', 'ROOM')) + '</div>' +
      '<div class="mode-row2"><button class="gel mode-pw" type="button" id="btnPowers">' + art.icon('bolt', 28) + '<span>POWER-UPS</span></button>' +
      '<button class="gel mode-pw" type="button" id="btnArena">' + art.icon('star', 28) + '<span>ARENAS</span></button>' +
      '<button class="gel mode-board" type="button" id="btnBoard"' + (CG ? ' style="display:none"' : '') + '>' + art.icon('trophy', 28) + '<span>100</span></button></div>';
    $('#btnPowers').addEventListener('click', function () { au.sfx.select(); openShop(); });
    $('#btnArena').addEventListener('click', function () { au.sfx.select(); openArenas(); });
    if (CG && SD.cg) SD.cg.bindAccount($('#btnBoard'));
    else $('#btnBoard').addEventListener('click', function () { au.sfx.select(); SD.lobby.openBoard(); });
    Array.prototype.forEach.call($('#modes').querySelectorAll('button.mode'), function (b) {
      b.addEventListener('click', function () {
        au.sfx.select();
        var id = b.dataset.mode;
        if (id === 'quick') { if (CG) SD.sim.play(); else SD.party.quick(); }
        else if (id === 'room') SD.party.menu();
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
  function openSettings() { buildSettings(); pageOpen('settings'); }

  /* ---------- skin picker ---------- */
  var wdTimer = 0, wdSlot = 0, wdSel = 0;
  var MOODS = ['idle', 'cheer', 'laugh', 'worry', 'sad', 'dizzy', 'pied'];
  function openWardrobe(slot) {
    wdSlot = slot; wdSel = art.slotSkin(slot);
    pageOpen('wardrobe');
    $('#wdTitle').textContent = slot === 0 ? 'PLAYER 1 LOOK' : 'PLAYER 2 LOOK';
    var ni = $('#wdNameIn');
    ni.value = st.name(slot); ni.readOnly = false;
    $('#wdNameNote').textContent = slot === 0 ? 'Tap the name to change it. This is shown online and on the TOP 100.' : '';
    paintWardrobe();
    var k = 0;
    clearInterval(wdTimer);
    wdTimer = setInterval(function () { k = (k + 1) % MOODS.length; $('#wdPrev').innerHTML = art.face(wdSlot, MOODS[k], { skin: wdSel }).replace('class="face', 'class="' + (skinState(wdSel) === 'shadow' ? 'shade ' : '') + 'face'); }, 750);
  }
  function skinState(id) { var w = pr.canBuySkin(id); return w === 'OWNED' ? 'own' : w === 'LEVEL' ? 'shadow' : 'buy'; }
  function paintWardrobe() {
    var stt = skinState(wdSel), rq = art.skinReq(wdSel), coins = st.get('coins') | 0;
    $('#wdPrev').innerHTML = art.face(wdSlot, 'idle', { skin: wdSel }).replace('class="face', 'class="' + (stt === 'shadow' ? 'shade ' : '') + 'face');
    var rr = art.rarity(wdSel);
    $('#wdPrev').className = 'wd-preview aura-' + rr.rank; $('#wdPrev').style.setProperty('--rc', rr.color);
    $('#wdName').innerHTML = '<span class="rar-pill" style="background:' + rr.color + '">' + rr.name + '</span><br>' + (stt === 'shadow' ? '???' : art.skinName(wdSel)) + (stt === 'shadow' ? '<small>' + art.icon('lock', 16) + ' UNLOCKS AT LEVEL ' + rq.lvl + '</small>' : '');
    var bw = $('#wdBuy');
    bw.innerHTML = stt === 'buy' ? '<button type="button" class="gel wd-buy"' + (coins < rq.cost ? ' disabled' : '') + '>' + art.icon('bill', 22) + '<span>' + (coins < rq.cost ? 'NEED ' + rq.cost : 'BUY ' + rq.cost) + '</span></button>' : '';
    if (stt === 'buy') bw.firstChild.addEventListener('click', function () {
      if (pr.buySkin(wdSel)) { au.sfx.coin(); au.sfx.perfect(); SD.fx && SD.fx.burst && 0; paintWardrobe(); buildCoins(); } else au.sfx.bwoop();
    });
    $('#wdGrid').innerHTML = art.SKINS.map(function (s, id) {
      var t = skinState(id), eq = st.get('skins')[wdSlot] === id;
      return '<button type="button" class="wd-tile' + (t === 'shadow' ? ' locked' : t === 'buy' ? ' buyable' : '') + (eq ? ' on' : '') + (wdSel === id ? ' sel' : '') + '" style="--rc:' + art.rarity(id).color + '" data-id="' + id + '" aria-label="' + (t === 'shadow' ? 'locked skin' : s.name) + '">' +
        art.face(wdSlot, 'idle', { skin: id }) + (t === 'shadow' ? art.icon('lock', 22, 'lk') : t === 'buy' ? art.icon('bill', 22, 'lk') : '') + '</button>';
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

  function buildCoins() { $('#coinChip').innerHTML = art.icon('bill', 24) + '<b>' + (st.get('coins') | 0) + '</b><small>SD</small>'; }
  function refresh() { if (CG) st.set('opp', 'friend'); buildDuel(); buildBoss(); buildCoins(); }
  SD.main = { refresh: refresh };

  function init() {
    SD.fx.init();
    SD.engine.init();
    buildToggles(); buildModes(); refresh();
    $('#wdDone').addEventListener('click', closeWardrobe);
    /* sound can only start after a tap: ask for one up front if the browser has not allowed audio yet */
    setTimeout(function () {
      if (au.running() || !(au.isOn('music') || au.isOn('sfx'))) return;
      var ov = $('#tapStart'); ov.hidden = false;
      var go = function (e) {
        ov.hidden = true; au.unlock();
        au.music.start('menu'); au.sfx.select();
        ['pointerdown', 'keydown'].forEach(function (ev) { ov.removeEventListener(ev, go); window.removeEventListener('keydown', go); });
      };
      ov.addEventListener('pointerdown', go); window.addEventListener('keydown', go);
    }, 350);
    $('#btnSettings').innerHTML = art.icon('gear');
    $('#ofGo').addEventListener('click', function () { au.sfx.select(); $('#offline').hidden = true; SD.engine.start('pay'); });
    $('#ofBack').addEventListener('click', function () { au.sfx.tap(); pageClose('offline'); });
    $('#arDone').addEventListener('click', function () { au.sfx.tap(); pageClose('arenas'); });
    $('#pwDone').addEventListener('click', function () { au.sfx.tap(); pageClose('powers'); buildCoins(); });
    var acct = $('#stAccount');
    if (CG || !(SD.net && SD.net.configured())) acct.style.display = 'none';
    else acct.addEventListener('click', function () { au.sfx.select(); $('#settings').hidden = true; SD.lobby.open(); });
    $('#btnSettings').addEventListener('click', function () { au.sfx.select(); openSettings(); });
    $('#stDone').addEventListener('click', function () { au.sfx.tap(); pageClose('settings'); }); 
    SD.engine.home();
    if (!CG && SD.net) SD.net.boot().then(function (loaded) { if (loaded) { refresh(); au.music.refresh(); } });
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
    var m = /[?&]room=([A-Za-z]{4})/.exec(location.search);
    if (m && SD.lobby) SD.lobby.autoJoin(m[1].toUpperCase());
    var pm = /[?&]party=([A-Za-z]{4})/.exec(location.search);
    if (pm && SD.party) SD.party.join(pm[1].toUpperCase());
    else if (!m && SD.party && SD.party.resume) SD.party.resume();
    document.addEventListener('visibilitychange', function () { au.setPaused(document.hidden); });
  }
  init();
})();
