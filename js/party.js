/* ONLINE MODES on the Silly Duel server (no login): instant match, friend rooms and party rooms (2 to 10 players, knockout bracket).
   Works on the internet or on a local wifi / hotspot with no internet (run server/server.js on any computer or phone). */
(function () {
  'use strict';
  var art = SD.art, au = SD.audio, st = SD.store;
  var $ = function (s) { return document.querySelector(s); };
  var root, card, ws = null, myId = 0, V = null, tok = 0, curConn = null, inMatch = false, pending = null, watchMid = 0, watching = false, wantReady = {}, queued = false;
  var chatLog = [], chatOpen = false, chatDraft = '';
  var CHAT_PRE = [
    { id: 'hurry', label: 'HURRY!' },
    { id: 'away', label: 'REMOVE AWAY' },
    { id: 'start', label: 'START!' },
    { id: 'doing', label: 'WHAT DOING?' },
    { id: 'angry', label: 'ANGRY' },
    { id: 'wait', label: 'WAIT!' },
    { id: 'lol', label: '😂' },
    { id: 'wave', label: '👏' },
    { id: 'ok', label: '👍' },
    { id: 'cry', label: '😢' },
    { id: 'fire', label: '🔥' }
  ];
  var P = SD.party = {};
  SD.tour = P;                                   // the engine calls SD.tour.back() when a bracket match is left

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function show(h) { card.innerHTML = h; }
  function bind(sel, fn) { var e = card.querySelector(sel); if (e) e.addEventListener('click', function () { au.sfx.tap(); fn(e); }); }
  function confirmLeave(go, title, msg) {
    if (!SD.ask) return go();
    SD.ask({ title: title || 'CLOSE THIS?', msg: msg || 'You will leave and may need to start again.', yes: 'LEAVE', no: 'KEEP WAITING' }, go);
  }
  function face(p, mood) { return '<span class="tf">' + art.face(0, mood || 'idle', { skin: p.skin | 0, tint: p.tint | 0 }) + '</span>'; }
  function back(label) { return '<button class="icon-btn pg-back on-back" id="pBack" type="button" aria-label="' + (label || 'BACK') + '">' + art.icon('back', 24) + '</button>'; }
  function wsUrl() { return SD.serverUrl || ((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); }
  function busy(title, msg, onBack) {
    show('<h2>' + title + '</h2><div class="on-face spin">' + art.face(0, 'worry') + '</div><p class="on-msg">' + msg + '</p>' + back('CANCEL'));
    bind('#pBack', function () {
      confirmLeave(onBack || leave, 'STOP WAITING?', 'You will leave and may need to start again.');
    });
  }
  /* one id per browser tab, so the server can give this player back their seat after a reconnect */
  var SID = (function () {
    var k = 'sd_sid', v = '';
    try { v = sessionStorage.getItem(k) || ''; } catch (e) {}
    if (!v) { v = Date.now().toString(36) + Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem(k, v); } catch (e) {} }
    return v;
  })();
  function profile() { return { t: 'hello', sid: SID, name: st.name(0), level: SD.progress.info().level, skin: (st.get('skins') || [0])[0] | 0, tint: (st.get('tints') || [0])[0] | 0 }; }
  P.hello = function () { send(profile()); };

  /* ---------- connection ---------- */
  var lastMsg = 0, retry = null, resuming = false, connecting = null, outbox = [];
  var hanging = false;
  function hangUp() {
    hanging = true;
    var sock = ws; ws = null;
    if (sock) { sock.onclose = null; sock.onerror = null; try { sock.close(); } catch (e) {} }
  }
  function send(o) {
    if (ws && ws.readyState === 1) {
      try { ws.send(JSON.stringify(o)); return; } catch (e) {}
    }
    if (o && o.t !== 'ping' && o.t !== 'hello') outbox.push(o);
  }
  function flushOutbox() {
    if (!ws || ws.readyState !== 1 || !outbox.length) return;
    var q = outbox; outbox = [];
    q.forEach(function (o) { try { ws.send(JSON.stringify(o)); } catch (e) { outbox.push(o); } });
  }
  function trySocket(n) {
    return new Promise(function (res, rej) {
      var s, settled = false, wait = n ? 20000 : 16000, tm;
      function finish(err) {
        if (settled) return;
        settled = true;
        clearTimeout(tm);
        if (!err) {
          hanging = false;
          ws = s; lastMsg = Date.now();
          try { s.send(JSON.stringify(profile())); } catch (e) {}
          flushOutbox();
          res();
          return;
        }
        try { s.onclose = null; s.onerror = null; s.close(); } catch (e) {}
        if (n < 1) trySocket(n + 1).then(res, rej);
        else rej(err);
      }
      try { s = new WebSocket(wsUrl()); } catch (e) { settled = true; if (n < 1) return trySocket(n + 1).then(res, rej); return rej(e); }
      tm = setTimeout(function () { finish(new Error('timeout')); }, wait);
      s.onopen = function () { finish(null); };
      s.onerror = function () {};
      s.onmessage = function (ev) { lastMsg = Date.now(); var m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
      s.onclose = function () {
        if (ws === s) dropped();
        else finish(new Error('closed'));
      };
    });
  }
  function connect() {
    if (ws && ws.readyState === 1) return Promise.resolve();
    if (connecting) return connecting;
    connecting = trySocket(0).then(function () { connecting = null; }, function (e) { connecting = null; throw e; });
    return connecting;
  }
  function needWs(then) {
    if (ws && ws.readyState === 1) { then(); return; }
    var t = tok, n = card && card.querySelector('.on-msg');
    setTimeout(function () {
      if (t !== tok || !n || !n.parentNode) return;
      n.innerHTML = 'WAKING THE SERVER...<small>First open can take a few seconds</small>';
    }, 2500);
    connect().then(function () { if (t === tok) then(); }, function () { if (t === tok) noServer(); });
  }
  /* the socket died (phone switched apps, network blip): in a match that ends the match, otherwise reconnect quietly */
  function dropped() {
    if (hanging) { ws = null; return; }
    var sock = ws; ws = null; if (sock) { sock.onclose = null; try { sock.close(); } catch (e) {} }
    if (inMatch || curConn) { V = null; if (curConn && curConn.peer.onclose) curConn.peer.onclose(); return; }
    if (watching) { reconnect(Date.now()); return; }
    if (!root || root.hidden) { V = null; return; }
    reconnect(Date.now());
  }
  function reconnect(t0) {
    if (retry) return;
    var hadRoom = !!V, wasQueued = queued, t = tok;
    resuming = hadRoom;
    if (!hadRoom && !wasQueued) busy('RECONNECTING', 'CONNECTING AGAIN...');
    else if (hadRoom) { var n = card.querySelector('.on-note'); if (n) n.textContent = 'RECONNECTING...'; }
    var attempt = function () {
      retry = null;
      if (t !== tok) return;
      connect().then(function () {
        if (t !== tok) return;
        if (wasQueued) { send({ t: 'quick', games: gamesN() }); renderQuickWait(0); }
        else if (!hadRoom) menu();
      }, function () {
        if (t !== tok) return;
        if (Date.now() - t0 > 4 * 60 * 1000) { V = null; lost(); return; }
        retry = setTimeout(attempt, 2500);
      });
    };
    attempt();
  }
  /* back from another app: check the socket is really alive, and reconnect at once if not */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden || inMatch) return;
    if (!watching && (!root || root.hidden)) return;
    if (retry) { clearTimeout(retry); retry = null; reconnect(Date.now()); return; }
    if (!ws) return;
    var sent = Date.now(); send({ t: 'ping' });
    setTimeout(function () { if (ws && lastMsg < sent && !document.hidden) dropped(); }, 3000);
  });
  setInterval(function () {
    if (!ws || document.hidden) return;
    if (!queued && !inMatch && !watching && (!root || root.hidden) && !V) return;
    send({ t: 'ping' });
  }, 25000);
  /* the room this tab is in, so a page reload (phone dropped the tab in the background) can take the seat back */
  function remember(code) { try { if (code) sessionStorage.setItem('sd_room', code); else sessionStorage.removeItem('sd_room'); } catch (e) {} }
  P.resume = function () {
    var code = ''; try { code = sessionStorage.getItem('sd_room') || ''; } catch (e) {}
    if (!code) return false;
    root = $('#party'); card = $('#partyCard'); open(); busy('FRIENDS ROOM', 'BACK TO ROOM ' + esc(code) + '...'); var t = tok;
    resuming = true;
    connect().then(function () {}, function () { if (t === tok) { resuming = false; noServer(); } });
    return true;
  };
  function lost() { remember(''); show('<h2>DISCONNECTED</h2><div class="on-face">' + art.face(0, 'sad') + '</div><p class="on-msg">LOST THE SERVER</p><button class="gel" id="pOk" type="button"><span>OK</span></button>'); bind('#pOk', leave); }
  function noServer() {
    show('<h2>NO SERVER FOUND</h2><div class="on-face">' + art.face(0, 'sad') + '</div><p class="on-msg">COULD NOT REACH THE GAME SERVER<small>Online play needs the Silly Duel server. See SERVER-GUIDE.txt (local wifi or internet).</small></p>' + back('OK'));
    bind('#pBack', leave);
  }
  function open() { var tap = document.getElementById('tapStart'); if (tap) tap.hidden = true; root.hidden = false; $('#home').hidden = true; tok++; V = null; try { if (SD.ads && SD.ads.onScreen) SD.ads.onScreen('party'); } catch (e) {} }
  function leave() {
    tok++; clearTimeout(retry); retry = null; resuming = false; remember('');
    if (watching && SD.engine.watching && SD.engine.watching()) { watchMid = -1; watching = false; try { SD.engine.home(); } catch (e) {} }
    if (ws && ws.readyState === 1) { send({ t: 'quickCancel' }); send({ t: 'unwatch', mid: watchMid }); send({ t: 'leave' }); }
    hangUp();
    outbox = []; V = null; chatLog = []; chatOpen = false; chatDraft = ''; queued = false; watching = false;
    root.hidden = true; $('#home').hidden = false; if (SD.main && SD.main.refresh) SD.main.refresh();
    try { if (SD.fresh && SD.fresh.try) SD.fresh.try(); } catch (e) {}
    try { if (SD.ads && SD.ads.onScreen) SD.ads.onScreen('home'); } catch (e) {}
  }

  /* ---------- messages ---------- */
  function onMsg(m) {
    if (m.t === 'full') {
      hangUp(); queued = false;
      show('<h2>SERVER BUSY</h2><div class="on-face">' + art.face(0, 'worry') + '</div><p class="on-msg">TOO MANY PLAYERS RIGHT NOW<small>Try again in a minute.</small></p>' + back('OK'));
      bind('#pBack', leave);
    }
    else if (m.t === 'hi') { myId = m.id; if (resuming) { resuming = false; if (!m.resumed) { V = null; lost(); } } }
    else if (m.t === 'wait') { if (queued) renderQuickWait(m.n); }
    else if (m.t === 'list') showPublic(m.rooms);
    else if (m.t === 'err') { var e = $('#pErr'); if (e) e.textContent = m.e; else { show('<h2>PARTY</h2><p class="on-msg">' + esc(m.e) + '</p>' + back()); bind('#pBack', menu); } }
    else if (m.t === 'closed') {
      V = null; chatLog = []; chatOpen = false; remember('');
      show('<h2>ROOM CLOSED</h2><div class="on-face">' + art.face(0, 'sad') + '</div><p class="on-msg">' + esc(m.e || 'HOST CLOSED THE ROOM') + '<small>Back home in a moment...</small></p>');
      setTimeout(function () { leave(); }, 2200);
    }
    else if (m.t === 'kicked') {
      V = null; chatLog = []; chatOpen = false; remember('');
      show('<h2>REMOVED</h2><div class="on-face">' + art.face(0, 'sad') + '</div><p class="on-msg">' + esc(m.e || 'HOST REMOVED YOU') + '</p><button class="gel danger" id="pOk" type="button"><span>OHH NO</span></button>');
      bind('#pOk', leave);
    }
    else if (m.t === 'hostOffer') {
      SD.ask({
        title: 'BECOME HOST?',
        msg: (m.name || 'HOST') + ' wants you to become the host.',
        yes: 'OKAY',
        no: 'NO WAY'
      }, function () { send({ t: 'acceptHost' }); });
    }
    else if (m.t === 'hostNow') {
      SD.ask({ title: 'YOU ARE HOST', msg: 'You can pick the games and start the room.', yes: 'OKAY', no: 'OKAY' }, function () {});
    }
    else if (m.t === 'chat') {
      if (!V || (m.code && m.code !== V.code) || !m.v) return;
      pushChat(m.v);
    }
    else if (m.t === 'room') {
      var keepG = V && V.games;
      var same = V && V.code === m.v.code;
      V = m.v;
      if (V.games !== 3 && V.games !== 8 && V.games !== 5 && (keepG === 3 || keepG === 8 || keepG === 5)) V.games = keepG;
      if (!same) { chatLog = []; chatOpen = false; }
      if (Array.isArray(V.chats) && V.chats.length) chatLog = V.chats.slice();
      remember(V.code);
      if (watching && !inMatch) {
        var still = V.matches.filter(function (x) { return x.mid === watchMid && x.live; })[0];
        if (!still) { watchMid = 0; if (SD.engine.watching && SD.engine.watching()) SD.engine.home(); else { watching = false; render(); } }
        return;
      }
      if (!inMatch && !watching) render();
    }
    else if (m.t === 'left') { V = null; chatLog = []; chatOpen = false; remember(''); }
    else if (m.t === 'match') {
      pending = m; queued = false; if (m.kind !== 'tour') remember('');
      if (watching) { watching = false; watchMid = -1; }
      if (!inMatch) launch();
    }
    else if (m.t === 'relay') { if (curConn && curConn.mid === m.mid) curConn.deliver(m.m); }
    else if (m.t === 'snap') { if (watching && m.mid === watchMid && SD.engine.specSnap) SD.engine.specSnap(m.snap); }
    else if (m.t === 'spec') { if (watching && m.mid === watchMid && SD.engine.specEvent) SD.engine.specEvent(m.slot, m.m); }
    else if (m.t === 'watch') { if (watching && m.ok && m.snap && SD.engine.specSnap) SD.engine.specSnap(m.snap); }
  }
  function launch() {
    var m = pending; pending = null; if (!m) return;
    var q = [], handler = null, peer = { send: function (o) { send({ t: 'relay', mid: m.mid, m: o }); }, close: function () {}, onclose: null };
    Object.defineProperty(peer, 'onmessage', { get: function () { return handler; }, set: function (f) { handler = f; if (f) q.splice(0).forEach(f); } });
    var mine = m.you || partyMe() || { name: st.name(0), skin: (st.get('skins') || [0])[0], tint: (st.get('tints') || [0])[0] | 0, level: SD.progress.info().level };
    var conn = { peer: peer, role: m.role, id: m.room || 'SERVER', you: mine, opp: m.opp || {}, myName: mine.name || st.name(0), seed: m.seed, kind: m.kind, mid: m.mid, arena: m.arena, total: m.total | 0, fallback: !!m.fallback, againMe: false, againPeer: false,
      deliver: function (o) { if (handler) handler(o); else q.push(o); },
      onSnap: function (snap) { send({ t: 'snap', mid: m.mid, snap: snap }); } };
    if (m.kind === 'tour') {
      conn.total = 3;
      conn.onScore = function (totals, game) { send({ t: 'score', mid: m.mid, totals: totals, game: game }); };
      conn.onEnd = function (win) { send({ t: 'end', mid: m.mid, win: win }); };
    }
    curConn = conn; inMatch = true; root.hidden = true;
    SD.engine.startOnline(conn);
  }
  /* the engine calls this when a bracket match screen is left */
  P.back = function () {
    curConn = null; inMatch = false; $('#home').hidden = true; root.hidden = false; wantReady = {};
    try { if (SD.ads && SD.ads.onScreen) SD.ads.onScreen('party'); } catch (e) {}
    if (pending) return launch();
    if (V) render(); else lost();
  };
  P.matchOver = function () { if (curConn && curConn.kind !== 'tour') { curConn = null; inMatch = false; } };

  /* ---------- screens ---------- */
  function renderQuickWait(n) {
    show('<h2>FINDING A PLAYER</h2><div class="on-face spin">' + art.face(0, 'worry') + '</div><p class="on-msg">LOOKING FOR AN OPPONENT...<small>' + (n > 1 ? n + ' PLAYERS WAITING' : 'YOU ARE FIRST IN LINE') + '</small></p>' + back('CANCEL'));
    bind('#pBack', function () {
      confirmLeave(function () { send({ t: 'quickCancel' }); queued = false; leave(); }, 'LEAVE QUEUE?', 'You will lose your place in line.');
    });
  }
  function gamesN() { var n = st.get('games') | 0; return n === 3 || n === 8 ? n : 5; }
  function roomGames() { var n = V && V.games | 0; return n === 3 || n === 8 ? n : 5; }
  function gamesPickHtml(cur) {
    cur = cur === 3 || cur === 8 || cur === 5 ? cur : 5;
    return '<p class="on-note">HOW MANY GAMES?<small>Best of 3, 5 or 8 when two play. Four or more is a knockout.</small></p><div class="games-pick">' + [3, 5, 8].map(function (n) {
      return '<button type="button" class="games-n' + (cur === n ? ' on' : '') + '" data-n="' + n + '">' + n + '</button>';
    }).join('') + '</div>';
  }
  function paintQuickPick() {
    var cur = gamesN();
    show('<h2>MATCH</h2><p class="on-msg">HOW MANY GAMES?<small>Default is 5. If nobody is waiting for your pick, you may play 5 instead.</small></p>' +
      '<div class="games-pick">' + [3, 5, 8].map(function (n) {
        return '<button type="button" class="games-n' + (cur === n ? ' on' : '') + '" data-n="' + n + '">' + n + '</button>';
      }).join('') + '</div>' +
      '<button class="gel" id="pGo" type="button"><span>FIND A PLAYER</span></button>' + back());
    Array.prototype.forEach.call(card.querySelectorAll('.games-n'), function (b) {
      b.addEventListener('click', function () { st.set('games', +b.dataset.n); au.sfx.tap(); paintQuickPick(); });
    });
    bind('#pGo', function () { au.sfx.select(); startQuick(); });
    bind('#pBack', leave);
  }
  function startQuick() {
    busy('INSTANT MATCH', 'CONNECTING...');
    needWs(function () { send(profile()); queued = true; send({ t: 'quick', games: gamesN() }); renderQuickWait(0); });
  }
  P.quick = function () {
    root = $('#party'); card = $('#partyCard'); open(); paintQuickPick();
  };
  function menu() {
    show('<h2>FRIENDS ROOM</h2><div class="on-face">' + art.face(0, 'cheer') + '</div><p class="on-note">Private rooms need a code. Public rooms show up for anyone looking for a party. 2 players = a match. 4 or more = knockout, first to 2 wins.</p>' +
      '<button class="gel" id="pMake" type="button">' + art.icon('friend', 30) + '<span>PRIVATE ROOM</span></button>' +
      '<button class="gel" id="pPub" type="button"><span>PUBLIC ROOM</span></button>' +
      '<button class="gel alt" id="pJoin" type="button"><span>JOIN WITH A CODE</span></button>' +
      '<button class="gel alt" id="pFind" type="button"><span>JOIN A PUBLIC PARTY</span></button>' +
      '<p class="on-note" id="pNet"></p>' + back());
    bind('#pMake', function () { busy('FRIENDS ROOM', 'MAKING A ROOM...'); needWs(function () { send(profile()); send({ t: 'create', games: gamesN() }); }); });
    bind('#pPub', function () { busy('FRIENDS ROOM', 'MAKING A ROOM...'); needWs(function () { send(profile()); send({ t: 'create', pub: true, games: gamesN() }); }); });
    bind('#pJoin', function () { joinForm(''); });
    bind('#pFind', publicList);
    bind('#pBack', leave);
  }
  function publicList() {
    busy('PUBLIC PARTIES', 'LOOKING FOR OPEN ROOMS...', function () { tok++; menu(); });
    needWs(function () { send({ t: 'list' }); });
  }
  function showPublic(list) {
    var rows = (list || []).map(function (r) {
      return '<button class="gel alt p-open" type="button" data-code="' + esc(r.code) + '"><span>' + esc(r.host) + ' · LV ' + (r.level | 0) + ' · ' + (r.n | 0) + '/10 · ' + esc(r.code) + '</span></button>';
    }).join('');
    show('<h2>PUBLIC PARTIES</h2><p class="on-note">Anyone can join these while they are waiting to start.</p>' +
      (rows || '<p class="on-msg">NO PUBLIC PARTIES RIGHT NOW<small>Make one, or try again in a moment.</small></p>') +
      '<button class="gel" id="pAgain" type="button"><span>REFRESH</span></button>' + back());
    Array.prototype.forEach.call(card.querySelectorAll('.p-open'), function (b) {
      b.addEventListener('click', function () { au.sfx.tap(); send(profile()); send({ t: 'join', code: b.dataset.code }); });
    });
    bind('#pAgain', publicList); bind('#pBack', menu);
  }
  P.menu = function () {
    root = $('#party'); card = $('#partyCard'); open();
    menu();
    var n = card.querySelector('#pNet');
    if (n && !(ws && ws.readyState === 1)) n.textContent = 'CONNECTING...';
    connect().then(function () {
      var x = card && card.querySelector('#pNet'); if (x) x.textContent = '';
    }, function () {
      var x = card && card.querySelector('#pNet'); if (x) x.textContent = 'SERVER SLOW TO WAKE. TAP A BUTTON TO TRY AGAIN.';
    });
  };
  function joinForm(pre) {
    show('<h2>JOIN A ROOM</h2><input id="pCode" class="on-in code" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="CODE" value="' + esc(pre) + '"><p class="on-err" id="pErr"></p><button class="gel" id="pGo" type="button"><span>JOIN</span></button>' + back());
    var go = function () { var c = ($('#pCode').value || '').toUpperCase().replace(/[^A-Z]/g, ''); if (c.length !== 4) { $('#pErr').textContent = 'TYPE THE 4 LETTERS'; return; } busy('FRIENDS ROOM', 'JOINING ' + esc(c) + '...'); needWs(function () { send(profile()); send({ t: 'join', code: c }); }); };
    bind('#pGo', go); bind('#pBack', menu);
    if (pre && pre.length === 4) go();
  }
  P.join = function (code) {
    root = $('#party'); card = $('#partyCard'); open();
    joinForm(code);
    connect().catch(function () { noServer(); });
  };

  function render() {
    if (watching) return;
    if (!V || !card) return;
    if (V.phase === 'lobby') return renderLobby();
    if (V.phase === 'done') return renderDone();
    renderTree();
  }
  function chatRowsHtml() {
    if (!chatLog.length) return '<p class="on-note">Room chat shows here.</p>';
    return chatLog.slice(-20).map(function (c) {
      return '<div class="p-chat-row' + (c.id === myId ? ' me' : '') + '"><b>' + esc(c.name) + '</b><span>' + esc(c.msg) + '</span></div>';
    }).join('');
  }
  function pushChat(row) {
    if (!row || !row.msg) return;
    var last = chatLog[chatLog.length - 1];
    if (last && last.id === row.id && last.msg === row.msg && Math.abs((last.ts || 0) - (row.ts || 0)) < 800) return;
    chatLog.push(row); if (chatLog.length > 40) chatLog = chatLog.slice(-40);
    paintChat();
  }
  function sendChat(payload, shown) {
    if (shown) pushChat({ id: myId, name: st.name(0), msg: shown, ts: Date.now() });
    send(payload);
  }
  function chatPopupHtml() {
    var presets = CHAT_PRE.map(function (p) {
      return '<button type="button" class="p-chat-pre" data-pre="' + p.id + '" data-label="' + esc(p.label) + '">' + p.label + '</button>';
    }).join('');
    return '<div class="p-chat-pop" id="pChatPop"' + (chatOpen ? '' : ' hidden') + '>' +
      '<div class="p-chat-card">' +
      '<div class="p-chat-head"><b>CHAT</b><button type="button" class="icon-btn" id="pChatClose" aria-label="Close">' + art.icon('close', 22) + '</button></div>' +
      '<p class="on-note">Tap a quick line, or type up to 15 letters.</p>' +
      '<div class="p-chat-presets">' + presets + '</div>' +
      '<div class="p-chat-type"><input id="pChatIn" class="on-in" maxlength="15" autocomplete="off" spellcheck="false" placeholder="15 LETTERS" value="' + esc(chatDraft) + '"><button type="button" class="gel" id="pChatSend"><span>SEND</span></button></div>' +
      '</div></div>';
  }
  function paintChat() {
    if (!card) return;
    var feed = card.querySelector('#pChatFeed');
    if (feed) {
      feed.innerHTML = chatRowsHtml();
      feed.scrollTop = feed.scrollHeight;
    }
  }
  function bindChat() {
    bind('#pChatBtn', function () {
      chatOpen = true;
      var pop = card.querySelector('#pChatPop');
      if (pop) pop.hidden = false;
    });
    bind('#pChatClose', function () {
      chatOpen = false;
      var pop = card.querySelector('#pChatPop');
      if (pop) pop.hidden = true;
    });
    var pop = card.querySelector('#pChatPop');
    if (pop) {
      pop.addEventListener('click', function (ev) {
        if (ev.target === pop) { chatOpen = false; pop.hidden = true; }
      });
    }
    Array.prototype.forEach.call(card.querySelectorAll('.p-chat-pre'), function (b) {
      b.addEventListener('click', function () {
        au.sfx.tap();
        var pre = b.dataset.pre, label = b.dataset.label || b.textContent;
        sendChat({ t: 'chat', pre: pre }, label);
        chatOpen = false;
        if (pop) pop.hidden = true;
      });
    });
    var inp = card.querySelector('#pChatIn');
    if (inp) {
      inp.addEventListener('input', function () {
        chatDraft = String(inp.value || '').slice(0, 15);
        inp.value = chatDraft;
      });
    }
    bind('#pChatSend', function () {
      var raw = String((card.querySelector('#pChatIn') && card.querySelector('#pChatIn').value) || chatDraft || '').trim().slice(0, 15);
      if (!raw) return;
      sendChat({ t: 'chat', msg: raw }, raw);
      chatDraft = '';
      var el = card.querySelector('#pChatIn'); if (el) el.value = '';
      chatOpen = false;
      if (pop) pop.hidden = true;
    });
  }
  function renderLobby() {
    var n = V.players.length, isHost = V.host === myId, okN = n >= 2 && n <= 10 && n % 2 === 0;
    var g = roomGames();
    var list = V.players.map(function (p) {
      var acts = '';
      if (isHost && p.id !== myId) {
        acts = '<span class="tl-acts">' +
          '<button type="button" class="tl-act host" data-id="' + p.id + '">HOST</button>' +
          '<button type="button" class="tl-act kick" data-id="' + p.id + '">KICK</button></span>';
      }
      return '<div class="tl-p' + (p.away ? ' away' : '') + (p.id === V.host ? ' host' : '') + '">' + face(p) +
        '<b>' + esc(p.name) + (p.id === V.host ? ' *' : '') + '</b>' +
        (p.away ? '<small>AWAY</small>' : p.id === V.host ? '<small>HOST</small>' : '<small>LV ' + (p.level | 0) + '</small>') +
        acts + '</div>';
    }).join('');
    var toolsRow = '<div class="p-tools">' +
      '<button type="button" class="gel alt p-chat-ico" id="pChatBtn" aria-label="Chat">' + art.icon('chat', 28) + '</button>' +
      (isHost
        ? '<div class="games-pick slim">' + [3, 5, 8].map(function (n2) {
          return '<button type="button" class="games-n' + (g === n2 ? ' on' : '') + '" data-n="' + n2 + '">' + n2 + '</button>';
        }).join('') + '</div>'
        : '<p class="p-games-ro">BEST OF ' + g + '</p>') +
      '</div>';
    var foot = '<div class="p-foot">' +
      (isHost
        ? '<button class="gel" id="pStart" type="button"' + (okN ? '' : ' disabled') + '><span>START' + (n >= 2 ? ' (' + n + ')' : '') + '</span></button>'
        : '<p class="on-msg p-wait">WAITING FOR HOST...</p>') +
      '<button class="gel alt" id="pInv" type="button">' + art.icon('invite', 26) + '<span>INVITE</span></button>' +
      '</div>';
    show('<div class="p-lobby">' +
      '<div class="p-lobby-top">' +
      '<h2>ROOM' + (V.pub ? ' · PUBLIC' : '') + '</h2><div class="t-code">' + esc(V.code) + '</div>' +
      '<p class="on-note">' + (V.pub ? 'Public room. Anyone can find it.' : 'Share the code or invite link.') + '</p>' +
      '<div class="tl-list">' + list + '</div>' +
      '<p class="on-msg tl"><small>' + n + ' / 10' + (okN ? '' : n < 2 ? ' · NEED ONE MORE' : ' · NEED EVEN NUMBER') + ' · BEST OF ' + g + '</small></p>' +
      '<div class="p-chat-feed" id="pChatFeed">' + chatRowsHtml() + '</div>' +
      '<p class="on-err" id="pErr"></p>' +
      '</div>' +
      '<div class="p-lobby-bot">' + toolsRow + foot + '</div>' +
      '</div>' + chatPopupHtml() + back('LEAVE'));
    if (isHost) {
      Array.prototype.forEach.call(card.querySelectorAll('.games-n'), function (b) {
        b.addEventListener('click', function () {
          var n2 = +b.dataset.n; n2 = (n2 === 3 || n2 === 8) ? n2 : 5;
          V.games = n2; au.sfx.tap();
          Array.prototype.forEach.call(card.querySelectorAll('.games-n'), function (x) { x.classList.toggle('on', +x.dataset.n === n2); });
          send({ t: 'setGames', games: n2 });
        });
      });
      Array.prototype.forEach.call(card.querySelectorAll('.tl-act.host'), function (b) {
        b.addEventListener('click', function (ev) {
          ev.preventDefault(); ev.stopPropagation(); au.sfx.tap();
          var id = +b.dataset.id, who = '';
          V.players.forEach(function (p) { if (p.id === id) who = p.name; });
          SD.ask({
            title: 'MAKE HOST?',
            msg: 'Are you sure you want ' + (who || 'this player') + ' to be host?',
            yes: 'SURE',
            no: 'KEEP WAITING'
          }, function () { send({ t: 'offerHost', id: id }); });
        });
      });
      Array.prototype.forEach.call(card.querySelectorAll('.tl-act.kick'), function (b) {
        b.addEventListener('click', function (ev) {
          ev.preventDefault(); ev.stopPropagation(); au.sfx.tap();
          var id = +b.dataset.id, who = '';
          V.players.forEach(function (p) { if (p.id === id) who = p.name; });
          SD.ask({ title: 'REMOVE ' + (who || 'PLAYER') + '?', msg: 'They will leave this room.', yes: 'REMOVE', no: 'KEEP THEM' }, function () { send({ t: 'kick', id: id }); });
        });
      });
    }
    bindChat();
    bind('#pStart', function () { send(profile()); send({ t: 'start' }); });
    bind('#pInv', invite);
    bind('#pBack', function () {
      if (isHost) {
        SD.ask({
          title: 'LEAVE THE ROOM?',
          msg: 'Leave keeps the room open. Close the room sends everyone home.',
          yes: 'LEAVE',
          no: 'KEEP WAITING',
          danger: 'CLOSE THE ROOM',
          onDanger: function () { send({ t: 'closeRoom' }); leave(); }
        }, leave);
      } else {
        confirmLeave(leave, 'LEAVE THE ROOM?', 'Your friends will see you leave.');
      }
    });
  }
  function invite() {
    var url = location.href.split('#')[0].split('?')[0] + '?party=' + V.code, text = 'Join my Silly Duel room! Code: ' + V.code;
    if (navigator.share) { navigator.share({ title: 'Silly Duel', text: text, url: url }).catch(function () {}); return; }
    try { navigator.clipboard.writeText(text + ' ' + url); var b = $('#pInv'); if (b) b.querySelector('span').textContent = 'LINK COPIED'; } catch (e) {}
  }
  function node(m, by) {
    var A = by[m.a], B = m.bye ? null : by[m.b], mine = m.a === myId || m.b === myId, done = m.w != null && !m.bye;
    var cls = 'tm' + (mine ? ' me' : '') + (m.bye ? ' bye' : '') + (m.live ? ' live' : '') + (done ? ' done' : '') + (!m.live && !done && !m.bye ? ' wait' : '');
    function side(P2, ready, slot) {
      var lost = done && m.w !== P2.id;
      return '<div class="tp' + (done && m.w === P2.id ? ' win' : lost ? ' lose' : '') + (!m.live && !done && !ready ? ' idle' : '') + '">' + face(P2, lost ? 'sad' : ready ? 'cheer' : 'idle').replace('class="tf"', 'class="tf" data-slot="' + slot + '"') + '<b>' + esc(P2.name) + '</b><small>LV ' + P2.level + '</small>' +
        (!m.live && !done ? '<i class="rdy">' + (ready ? 'READY' : '...') + '</i>' : m.live && !mine ? '<i class="rdy">WATCH</i>' : '') + '</div>';
    }
    if (m.bye) return '<div class="' + cls + '" data-mid="' + m.mid + '"><div class="tp">' + face(A, 'cheer') + '<b>' + esc(A.name) + '</b></div><div class="tsc"><span>BYE</span><small>THROUGH</small></div><div class="tp"></div></div>';
    return '<div class="' + cls + '" data-mid="' + m.mid + '">' + side(A, m.ra, 0) + '<div class="tsc"><span>' + (m.live || done ? m.s[0] + ' - ' + m.s[1] : 'VS') + '</span><small>' + (done ? 'DONE' : m.live ? esc(m.g || 'LIVE') : 'MATCH ' + m.n) + '</small></div>' + side(B, m.rb, 1) + '</div>';
  }
  function renderTree() {
    var by = {}; V.players.forEach(function (p) { by[p.id] = p; });
    var me = by[myId], alive = V.players.filter(function (p) { return !p.out; }).length;
    var mine = V.matches.filter(function (m) { return m.a === myId || m.b === myId; })[0];
    var isFinal = alive === 2 && V.matches.length === 1, label = isFinal ? 'FINAL' : 'ROUND ' + V.round + ' / ' + V.rounds;
    var line, ready = '';
    if (me && me.out) line = isFinal ? 'THE FINAL! WATCH IT LIVE' : 'YOU ARE OUT. TAP A LIVE MATCH TO WATCH';
    else if (V.phase === 'between') line = 'NEXT ROUND IS COMING...';
    else if (mine && mine.bye) line = 'BYE! YOU ARE THROUGH';
    else if (mine && !mine.w) {
      var iReady = mine.a === myId ? mine.ra : mine.rb, oppReady = mine.a === myId ? mine.rb : mine.ra, opp = by[mine.a === myId ? mine.b : mine.a];
      line = iReady ? 'WAITING FOR ' + esc(opp.name) + '...' : oppReady ? esc(opp.name) + ' IS READY!' : 'GET READY TO FACE ' + esc(opp.name);
      ready = '<button class="gel" id="pReady" type="button"' + (iReady ? ' disabled' : '') + '><span>' + (iReady ? 'READY!' : 'I AM READY') + '</span></button>';
    } else line = 'YOU WON! WAITING FOR THE OTHERS...';
    var live = V.matches.filter(function (m) { return m.live; });
    var wm = V.matches.filter(function (m) { return m.mid === watchMid && m.live; })[0];
    if (!wm && watchMid !== -1 && me && me.out && live[0] && live[0].a !== myId && live[0].b !== myId) wm = live[0];
    if (wm && wm.a !== myId && wm.b !== myId && (watchMid === wm.mid || (watchMid !== -1 && me && me.out))) {
      startWatch(wm);
      return;
    }
    var watchHint = live.length ? '<p class="on-note">Tap a LIVE match to watch it in the full arena.</p>' : '';
    show('<h2>' + label + '</h2><p class="on-msg tl">' + line + '<small>' + alive + ' PLAYERS LEFT · FIRST TO 2 WINS</small></p>' + watchHint + '<div class="tms">' + V.matches.map(function (m) { return node(m, by); }).join('') + '</div>' +
      '<div class="p-chat-feed" id="pChatFeed">' + chatRowsHtml() + '</div>' +
      ready +
      '<div class="p-tools"><button type="button" class="gel alt p-chat-ico" id="pChatBtn" aria-label="Chat">' + art.icon('chat', 28) + '</button></div>' +
      chatPopupHtml() + back('LEAVE'));
    bindChat();
    bind('#pReady', function () { send(profile()); send({ t: 'ready', mid: mine.mid }); });
    bind('#pBack', function () { confirmLeave(leave, 'LEAVE THE PARTY?', 'You will drop out of this tournament.'); });
    Array.prototype.forEach.call(card.querySelectorAll('.tm.live'), function (el) {
      el.addEventListener('click', function () {
        var id = +el.dataset.mid, hit = V.matches.filter(function (x) { return x.mid === id && x.live; })[0];
        if (hit && hit.a !== myId && hit.b !== myId) startWatch(hit);
      });
    });
  }
  function partyMe() {
    if (!V || !V.players) return null;
    for (var i = 0; i < V.players.length; i++) if (V.players[i].id === myId) return V.players[i];
    return null;
  }
  function startWatch(wm) {
    if (inMatch || pending) return;
    if (!wm || !V || !SD.engine || !SD.engine.watch) return;
    if (watching && watchMid === wm.mid && SD.engine.watching && SD.engine.watching()) { send({ t: 'watch', mid: wm.mid }); return; }
    var by = {}; V.players.forEach(function (p) { by[p.id] = p; });
    var A = by[wm.a], B = by[wm.b]; if (!A || !B) return;
    watching = true; watchMid = wm.mid;
    root.hidden = true; $('#home').hidden = true;
    send({ t: 'watch', mid: wm.mid });
    SD.engine.watch({
      a: A, b: B, totals: (wm.s || [0, 0]).slice(), total: 3, arena: Math.max(A.level | 0, B.level | 0), seed: 0,
      onStop: function () {
        send({ t: 'unwatch', mid: wm.mid });
        watching = false;
        if (!root) return;
        root.hidden = false; $('#home').hidden = true;
        if (watchMid === wm.mid) watchMid = -1;
        if (V) render();
        try { if (SD.ads && SD.ads.onScreen) SD.ads.onScreen('party'); } catch (e) {}
      }
    });
  }
  function renderDone() {
    try {
      var ch = null; V.players.forEach(function (p) { if (p.id === V.champ) ch = p; });
      var me = ch && ch.id === myId;
      show('<h2>WINNER WINNER!</h2><div class="trophy-glow"><div class="on-face big">' + art.face(0, 'win', { skin: ch ? ch.skin : 0, tint: ch ? ch.tint : 0, crown: true }) + '</div></div><p class="on-msg"><b>' + esc(ch ? ch.name : '') + '</b> WINS THE PARTY!<small>' + (me ? 'THAT IS YOU! SHARE YOUR TROPHY' : V.size + ' PLAYERS · ' + V.rounds + ' ROUNDS') + '</small></p>' +
        '<div id="pRate" class="cere-rate"></div>' +
        (me ? '<button class="gel" id="pShare" type="button"><span>SHARE TROPHY</span></button>' : '') + back('HOME'));
      bind('#pShare', function () { try { trophy(ch); } catch (e) {} }); bind('#pBack', leave);
      if (SD.feedback && SD.feedback.mount) SD.feedback.mount(card.querySelector('#pRate'));
      try { au.sfx.cheer(); if (SD.fx) SD.fx.confetti(window.innerWidth / 2, window.innerHeight / 3, 40, 1); setTimeout(function () { if (SD.fx && SD.fx.stop) SD.fx.stop(); }, 2800); } catch (e) {}
    } catch (e) {
      show('<h2>WINNER WINNER!</h2><p class="on-msg">THE PARTY IS OVER</p><div id="pRate" class="cere-rate"></div>' + back('HOME'));
      bind('#pBack', leave);
      if (SD.feedback && SD.feedback.mount) SD.feedback.mount(card.querySelector('#pRate'));
    }
  }
  function trophy(ch) {
    var W = 720, H = 960, c = document.createElement('canvas'); c.width = W; c.height = H; var g = c.getContext('2d');
    var gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#ffe27a'); gr.addColorStop(1, '#ff9ecf'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#2a1650'; g.lineWidth = 14; g.strokeRect(24, 24, W - 48, H - 48);
    g.fillStyle = '#2a1650'; g.textAlign = 'center'; g.font = '900 64px system-ui, sans-serif'; g.fillText('WINNER WINNER!', W / 2, 140);
    g.font = '800 34px system-ui, sans-serif'; g.fillText('PARTY CHAMPION', W / 2, 196);
    var svg = art.face(0, 'win', { skin: ch.skin | 0, tint: ch.tint | 0, crown: true }).replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420"'), img = new Image();
    img.onload = function () {
      g.drawImage(img, W / 2 - 210, 250, 420, 420);
      g.font = '900 78px system-ui, sans-serif'; g.fillText(ch.name, W / 2, 770);
      g.font = '700 34px system-ui, sans-serif'; g.fillText('LEVEL ' + ch.level + '  ·  ' + V.size + ' PLAYERS', W / 2, 830);
      g.font = '700 30px system-ui, sans-serif'; g.fillText('SILLY DUEL', W / 2, 900);
      c.toBlob(function (b) {
        var f = new File([b], 'silly-duel-trophy.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: 'Silly Duel', text: 'I won the party in Silly Duel!' }).catch(function () {});
        else { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'silly-duel-trophy.png'; document.body.appendChild(a); a.click(); a.remove(); }
      });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  P.active = function () { return !!curConn; };
  P.busy = function () { return !!(inMatch || queued || watching || pending || V || (root && !root.hidden)); };
  SD.partyDbg = function (v, id) { if (v) { V = v; myId = id; root = $('#party'); card = $('#partyCard'); root.hidden = false; render(); } return V; };
})();
