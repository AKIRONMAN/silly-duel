/* The ONLINE screen: login, quick match, private rooms and the leaderboard. */
(function () {
  'use strict';
  var art = SD.art, au = SD.audio, st = SD.store;
  var $ = function (s) { return document.querySelector(s); };
  var root, card, token = 0, entryBack = null;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function N() { return SD.net; }
  function show(html) { card.innerHTML = html; }
  function bind(sel, fn) { var e = card.querySelector(sel); if (e) e.addEventListener('click', function () { au.sfx.tap(); fn(e); }); }
  function back() { return '<button class="gel alt on-back" id="onBack" type="button">' + art.icon('close', 22) + '<span>BACK</span></button>'; }

  /* ---------- account: Google sign in, log out, delete ---------- */
  var GLOGO = '<svg class="g-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 2.9-2.2 5.4-4.7 7.1l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.5z"/><path fill="#FBBC05" d="M10.6 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.2 0-11.5-4.2-13.4-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>';
  var PRIVACY = '<p class="on-note">We save only your game name, level, coins and items. Your email is never shown. No ads tracking.</p>';
  function gBtn() { return '<button class="gel google" id="onGoogle" type="button">' + GLOGO + '<span>SIGN IN WITH GOOGLE</span></button>'; }
  function meRow(sub) {
    var i = SD.progress.info();
    return '<div class="on-me"><div class="on-face sm">' + art.face(0, 'idle') + '</div><div><b>' + esc(st.name(0)) + '</b><small>LV ' + i.level + ' · ' + (st.get('coins') | 0) + ' COINS · ' + (st.get('owins') | 0) + ' WINS</small><small>' + sub + '</small></div></div>';
  }
  /* Google sign in from any screen; then = what to show afterwards */
  function signIn(then) {
    var err = $('#onErr'); if (err) err.textContent = 'OPENING GOOGLE...';
    N().signIn().then(function (loaded) {
      au.sfx.tada(); SD.main.refresh(); if (au.music.refresh) au.music.refresh();
      then(loaded ? 'WELCOME BACK! YOUR SAVE IS LOADED.' : 'SIGNED IN. YOUR PROGRESS IS SAVED.');
    }, function (e) { var x = $('#onErr'); if (x) x.textContent = N().nice(e); au.sfx.bwoop(); });
  }
  function open() {
    root.hidden = false; token++; entryBack = null;
    if (!N().configured()) return localMenu();
    show('<h2>ACCOUNT</h2><p class="on-msg">LOADING...</p>');
    var t = token;
    N().backend.start().then(function () { if (t === token) account(''); }, function (e) {
      if (t !== token) return;
      show('<h2>ACCOUNT</h2><div class="on-face">' + art.face(0, 'sad') + '</div><p class="on-msg">' + N().nice(e) + '<small>Check your internet.</small></p><button class="gel" id="onRetry" type="button">TRY AGAIN</button>' + back());
      bind('#onRetry', open); bind('#onBack', close);
    });
  }
  function account(msg) {
    if (!N().signedIn()) {
      show('<h2>SAVE MY GAME</h2>' + meRow('GUEST · SAVED ON THIS PHONE ONLY') +
        '<p class="on-msg">SIGN IN TO KEEP YOUR PROGRESS<small>Play on any phone with the same level, coins, skins and power-ups, and join the TOP 100.</small></p>' +
        gBtn() + '<p class="on-err" id="onErr">' + esc(msg) + '</p>' + PRIVACY + back());
      bind('#onGoogle', function () { signIn(account); }); bind('#onBack', close);
      return;
    }
    var u = N().backend.user(), s = N().status();
    show('<h2>ACCOUNT</h2>' + meRow('SIGNED IN · ' + (s === 'error' ? 'NOT SAVED, CHECK INTERNET' : s === 'saving' ? 'SAVING...' : 'SAVED ✓')) +
      (u.email ? '<p class="on-note">Google: ' + esc(u.email) + '</p>' : '') +
      '<p class="on-err" id="onErr">' + esc(msg) + '</p>' +
      '<button class="gel alt" id="onOut" type="button"><span>LOG OUT</span></button>' +
      '<button class="gel alt on-danger" id="onDel" type="button"><span>DELETE ACCOUNT</span></button>' + back());
    bind('#onOut', function () {
      show('<h2>ACCOUNT</h2><p class="on-msg">SAVING AND LOGGING OUT...</p>');
      N().logout().then(function () { location.reload(); }, function (e) { account(N().nice(e)); });
    });
    bind('#onDel', confirmDelete); bind('#onBack', close);
  }
  function confirmDelete() {
    show('<h2>DELETE ACCOUNT?</h2><div class="on-face">' + art.face(0, 'worry') + '</div>' +
      '<p class="on-msg">THIS CANNOT BE UNDONE<small>Your saved level, coins, skins, power-ups and your TOP 100 entry are removed for good. This phone starts again as a new guest.</small></p>' +
      '<p class="on-err" id="onErr"></p>' +
      '<button class="gel on-danger" id="onYes" type="button"><span>YES, DELETE</span></button>' +
      '<button class="gel alt" id="onNo" type="button"><span>CANCEL</span></button>');
    bind('#onNo', function () { account(''); });
    bind('#onYes', function () {
      $('#onErr').textContent = 'DELETING...';
      N().deleteAccount().then(function () { location.reload(); }, function (e) { var x = $('#onErr'); if (x) x.textContent = N().nice(e); au.sfx.bwoop(); });
    });
  }
  /* no Firebase yet: friend rooms still work (free public broker). Quick match, login and leaderboard need Firebase. */
  function localMenu() {
    show('<h2>PLAY A FRIEND</h2><div class="on-me"><div class="on-face sm">' + art.face(0, 'idle') + '</div><div><b>' + esc(st.name(0)) + '</b><small>LV ' + SD.progress.info().level + '</small></div></div>' +
      '<button class="gel" id="onMake" type="button">' + art.icon('friend', 30) + '<span>MAKE A ROOM</span></button>' +
      '<button class="gel alt" id="onJoin" type="button"><span>JOIN WITH A CODE</span></button>' +
      '<button class="gel alt" id="onParty" type="button"><span>PARTY (3+ FRIENDS)</span></button>' +
      '<p class="on-note">Make a room, then send the code or invite link to your friend. Quick match, login and the leaderboard switch on when Firebase is added (see README).</p>' + back());
    bind('#onMake', makeRoom); bind('#onJoin', joinForm); bind('#onParty', function () { SD.party.menu(); }); bind('#onBack', close);
  }
  function menuBack() { if (entryBack) entryBack(); else if (N().configured() && N().backend.user()) menu(); else if (N().configured()) close(); else localMenu(); }
  function invite(code) {
    var url = location.href.split('#')[0].split('?')[0] + '?room=' + code, text = 'Join my Silly Duel room! Code: ' + code;
    if (navigator.share) { navigator.share({ title: 'Silly Duel', text: text, url: url }).catch(function () {}); return; }
    try { navigator.clipboard.writeText(text + ' ' + url); var b = $('#onInvite'); if (b) b.querySelector('span').textContent = 'LINK COPIED'; } catch (e) {}
  }
  function autoJoin(code) {
    root.hidden = false; token++;
    var t = token;
    show('<h2>JOINING ROOM</h2><div class="on-face spin">' + art.face(0, 'worry') + '</div><p class="on-msg">CODE ' + esc(code) + '...</p><button class="gel alt" id="onCancel" type="button"><span>CANCEL</span></button>');
    bind('#onCancel', function () { N().cancel(); close(); });
    var go = function () { N().joinRoom(code).then(function (c) { if (t === token) ready(c); }, function (e) { if (t === token) failed(e); }); };
    if (N().configured()) N().backend.init().then(go, function (e) { if (t === token) failed(e); }); else go();
  }
  /* home screen shortcut: straight to a fresh room code to send to a friend */
  function openRoom() {
    root.hidden = false; token++;
    if (!N().configured()) return makeRoom();
    var t = token;
    show('<h2>ONLINE</h2><div class="on-face">' + art.face(0, 'idle') + '</div><p class="on-msg">CONNECTING...</p>');
    N().backend.init().then(function () { if (t === token) makeRoom(); }, function (e) { if (t === token) failed(e); });
  }
  /* PLAY ONLINE: straight into a rated random match */
  function quickPlay() {
    root.hidden = false; token++; entryBack = close;
    if (!N().configured()) {
      show('<h2>PLAY ONLINE</h2><div class="on-face">' + art.face(0, 'worry') + '</div><p class="on-msg">ONLINE MATCHES ARE NOT SET UP YET<small>Add your Firebase config (see README).</small></p>' + back());
      bind('#onBack', close); return;
    }
    var t = token;
    show('<h2>PLAY ONLINE</h2><div class="on-face">' + art.face(0, 'idle') + '</div><p class="on-msg">CONNECTING...</p>');
    N().backend.init().then(function () { if (t === token) quick(); }, function (e) { if (t === token) failed(e); });
  }
  /* CREATE A ROOM: make one or join with a code (friends only, no level or coins) */
  function roomMenu() {
    root.hidden = false; token++; entryBack = roomChooser;
    if (!N().configured()) return localMenu();
    var t = token;
    show('<h2>CREATE A ROOM</h2><div class="on-face">' + art.face(0, 'idle') + '</div><p class="on-msg">CONNECTING...</p>');
    N().backend.init().then(function () { if (t === token) roomChooser(); }, function (e) { if (t === token) failed(e); });
  }
  function roomChooser() {
    show('<h2>CREATE A ROOM</h2><p class="on-note">Play with a friend. Room games do not change your level or coins.</p>' +
      '<button class="gel" id="onMake" type="button">' + art.icon('friend', 30) + '<span>MAKE A ROOM</span></button>' +
      '<button class="gel alt" id="onJoin" type="button"><span>JOIN WITH A CODE</span></button><button class="gel alt" id="onParty" type="button"><span>PARTY (3+ FRIENDS)</span></button>' + back());
    bind('#onMake', makeRoom); bind('#onJoin', joinForm); bind('#onParty', function () { SD.party.menu(); }); bind('#onBack', close);
  }
  function close() { boardHome = false; token++; N().cancel(); root.hidden = true; SD.main.refresh(); }

  function menu() {
    var u = N().backend.user(), i = SD.progress.info();
    show('<h2>ONLINE</h2>' +
      '<div class="on-me"><div class="on-face sm">' + art.face(0, 'idle') + '</div><div><b>' + esc(u.name) + '</b><small>' + (u.anon ? 'GUEST' : 'SIGNED IN') + ' · LV ' + i.level + ' · ' + (st.get('owins') | 0) + ' WINS</small></div></div>' +
      '<button class="gel" id="onQuick" type="button">' + art.icon('bolt', 30) + '<span>QUICK MATCH</span></button>' +
      '<div class="on-row"><button class="gel alt" id="onMake" type="button"><span>MAKE ROOM</span></button><button class="gel alt" id="onJoin" type="button"><span>JOIN ROOM</span></button></div><button class="gel alt" id="onParty" type="button"><span>PARTY (3+ FRIENDS)</span></button>' +
      '<div class="on-row"><button class="gel alt" id="onBoard" type="button">' + art.icon('trophy', 24) + '<span>TOP 100</span></button>' +
      (u.anon ? '<button class="gel alt" id="onAuth" type="button"><span>SIGN IN WITH GOOGLE</span></button>' : '<button class="gel alt" id="onOut" type="button"><span>LOG OUT</span></button>') + '</div>' + back());
    bind('#onQuick', quick); bind('#onMake', makeRoom); bind('#onJoin', joinForm); bind('#onParty', function () { SD.party.menu(); }); bind('#onBoard', function () { boardHome = false; board(); }); bind('#onBack', close);
    bind('#onAuth', open); bind('#onOut', open);
  }

  /* ---------- matchmaking ---------- */
  function ready(conn) {
    token++; root.hidden = true;
    SD.engine.startOnline(conn);
  }
  function failed(e) {
    if (e && e.code === 'CANCEL') return;
    var msg = e && e.code === 'NOBODY' ? 'NOBODY AROUND RIGHT NOW' : e && e.code === 'CONNECT' ? 'COULD NOT CONNECT DIRECTLY<small>Some networks block direct play. Try another Wi-Fi or mobile data.</small>' : e && e.message === 'NOROOM' ? 'NO ROOM WITH THAT CODE' : e && e.message === 'FULL' ? 'THAT ROOM IS FULL' : N().nice(e);
    show('<h2>ONLINE</h2><div class="on-face">' + art.face(0, 'sad') + '</div><p class="on-msg">' + msg + '</p>' +
      (e && e.code === 'NOBODY' ? '<button class="gel" id="onBot" type="button">' + art.icon('bot', 28) + '<span>PLAY THE BOT</span></button><button class="gel alt" id="onAgain" type="button"><span>TRY AGAIN</span></button>' : '') + back());
    bind('#onBot', function () { st.set('opp', 'bot'); close(); }); bind('#onAgain', quick); bind('#onBack', menuBack);
  }
  function quick() {
    var t = token;
    show('<h2>QUICK MATCH</h2><div class="on-face spin">' + art.face(0, 'worry') + '</div><p class="on-msg" id="onStat">LOOKING FOR A PLAYER...<small>Same level up to 3 levels higher</small></p><button class="gel alt" id="onCancel" type="button"><span>CANCEL</span></button>');
    bind('#onCancel', function () { N().cancel(); menuBack(); });
    N().quick(function (s) { var e = $('#onStat'); if (e && t === token) e.innerHTML = s === 'waiting' ? 'WAITING FOR SOMEONE...<small>Share the game, then try again</small>' : 'CONNECTING...'; })
      .then(function (c) { if (t === token) ready(c); }, function (e) { if (t === token) failed(e); });
  }
  function makeRoom() {
    var t = token;
    show('<h2>MAKE ROOM</h2><p class="on-msg">TELL YOUR FRIEND THIS CODE</p><div class="on-code" id="onCode">....</div><button class="gel" id="onInvite" type="button">' + art.icon('share', 26) + '<span>INVITE A FRIEND</span></button><p class="on-note">Waiting for a friend to join...</p><button class="gel alt" id="onCancel" type="button"><span>CANCEL</span></button>');
    bind('#onCancel', function () { N().cancel(); menuBack(); });
    bind('#onInvite', function () { invite($('#onCode').textContent); });
    N().makeRoom(function (code) { var e = $('#onCode'); if (e) e.textContent = code; })
      .then(function (c) { if (t === token) ready(c); }, function (e) { if (t === token) failed(e); });
  }
  function joinForm() {
    show('<h2>JOIN ROOM</h2><input id="onCodeIn" class="on-in code" maxlength="4" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="CODE"><p class="on-err" id="onErr"></p><button class="gel" id="onGo" type="button"><span>JOIN</span></button>' + back());
    var t = token, inp = $('#onCodeIn');
    inp.addEventListener('input', function () { inp.value = inp.value.toUpperCase().replace(/[^A-Z]/g, ''); });
    bind('#onBack', menuBack);
    bind('#onGo', function () {
      if (inp.value.length !== 4) { $('#onErr').textContent = 'CODE HAS 4 LETTERS'; return; }
      $('#onErr').textContent = 'JOINING...';
      N().joinRoom(inp.value, function () { }).then(function (c) { if (t === token) ready(c); }, function (e) { if (t === token) failed(e); });
    });
  }

  /* ---------- leaderboard ---------- */
  var boardHome = false;
  function openBoard() {
    root.hidden = false; token++; boardHome = true;
    if (!N().configured()) {
      show('<h2>TOP 100</h2><div class="on-face">' + art.face(0, 'worry') + '</div><p class="on-msg">LEADERBOARD NEEDS ONLINE MODE<small>Add your Firebase config to switch it on (see README).</small></p>' + back());
      bind('#onBack', close); return;
    }
    show('<h2>TOP 100</h2><p class="on-msg">LOADING...</p>' + back());
    var t = token;
    N().backend.start().then(function () { if (t === token) board(); }, function (e) {
      if (t !== token) return;
      show('<h2>TOP 100</h2><p class="on-msg">' + N().nice(e) + '</p>' + back()); bind('#onBack', close);
    });
  }
  function boardBack() { if (boardHome) { boardHome = false; close(); } else menuBack(); }
  function board() {
    show('<h2>TOP 100</h2><p class="on-msg">LOADING...</p>' + back());
    bind('#onBack', boardBack);
    var t = token;
    N().backend.leaderboard().then(function (rows) {
      if (t !== token) return;
      rows = rows.filter(function (r) { return (r.owins | 0) > 0; });
      var me = N().backend.user(), inn = N().signedIn();
      var list = rows.length ? rows.map(function (r, k) {
        return '<li class="' + (me && r.uid === me.uid ? 'me' : '') + '"><b>' + (k + 1) + '</b><span class="lb-face">' + art.face(0, 'idle', { skin: (r.skin | 0) }) + '</span><span class="lb-name">' + esc(r.name || '?') + '</span><span class="lb-lv">LV ' + (r.level | 0) + '</span><em>' + (r.owins | 0) + '</em></li>';
      }).join('') : '<li class="empty">NO WINS YET. BE THE FIRST!</li>';
      var join = inn ? '<p class="on-note">Win MATCH games to climb. Room games do not count.</p>'
        : '<p class="on-note">Sign in to save your progress and get on the TOP 100.</p>' + gBtn() + '<p class="on-err" id="onErr"></p>';
      show('<h2>TOP 100</h2><p class="on-note">Online wins</p><ol class="lb' + (inn ? '' : ' short') + '">' + list + '</ol>' + join + back());
      bind('#onGoogle', function () { signIn(function () { board(); }); });
      bind('#onBack', boardBack);
    }, function (e) { if (t === token) { show('<h2>TOP 100</h2><p class="on-msg">' + N().nice(e) + '</p>' + back()); bind('#onBack', boardBack); } });
  }

  SD.lobby = { quickPlay: quickPlay, roomMenu: roomMenu, open: open, close: close, autoJoin: autoJoin, openRoom: openRoom, openBoard: openBoard };
  root = $('#online'); card = $('#onCard');
})();
