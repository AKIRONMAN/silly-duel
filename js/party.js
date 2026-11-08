/* ONLINE MODES on the Silly Duel server (no login): instant match, friend rooms and party rooms (2 to 10 players, knockout bracket).
   Works on the internet or on a local wifi / hotspot with no internet (run server/server.js on any computer or phone). */
(function () {
  'use strict';
  var art = SD.art, au = SD.audio, st = SD.store;
  var $ = function (s) { return document.querySelector(s); };
  var root, card, ws = null, myId = 0, V = null, tok = 0, curConn = null, inMatch = false, pending = null, watchMid = 0, wantReady = {}, queued = false;
  var P = SD.party = {};
  SD.tour = P;                                   // the engine calls SD.tour.back() when a bracket match is left

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function show(h) { card.innerHTML = h; }
  function bind(sel, fn) { var e = card.querySelector(sel); if (e) e.addEventListener('click', function () { au.sfx.tap(); fn(e); }); }
  function face(p, mood) { return '<span class="tf">' + art.face(0, mood || 'idle', { skin: p.skin | 0 }) + '</span>'; }
  function back(label) { return '<button class="gel alt on-back" id="pBack" type="button">' + art.icon('close', 22) + '<span>' + (label || 'BACK') + '</span></button>'; }
  function wsUrl() { return SD.serverUrl || ((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); }
  function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
  function busy(title, msg) { show('<h2>' + title + '</h2><div class="on-face spin">' + art.face(0, 'worry') + '</div><p class="on-msg">' + msg + '</p>'); }
  /* one id per browser tab, so the server can give this player back their seat after a reconnect */
  var SID = (function () {
    var k = 'sd_sid', v = '';
    try { v = sessionStorage.getItem(k) || ''; } catch (e) {}
    if (!v) { v = Date.now().toString(36) + Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem(k, v); } catch (e) {} }
    return v;
  })();
  function profile() { return { t: 'hello', sid: SID, name: st.name(0), level: SD.progress.info().level, skin: (st.get('skins') || [0])[0] }; }

  /* ---------- connection ---------- */
  var lastMsg = 0, retry = null, resuming = false;
  function connect() {
    return new Promise(function (res, rej) {
      if (ws && ws.readyState === 1) return res();
      var s, done = false, tm;
      try { s = new WebSocket(wsUrl()); } catch (e) { return rej(e); }
      tm = setTimeout(function () { if (!done) { done = true; s.onclose = null; try { s.close(); } catch (e) {} rej(new Error('timeout')); } }, 8000);
      s.onopen = function () { if (done) return; done = true; clearTimeout(tm); ws = s; lastMsg = Date.now(); s.send(JSON.stringify(profile())); res(); };
      s.onerror = function () { if (!done) { done = true; clearTimeout(tm); rej(new Error('fail')); } };
      s.onmessage = function (ev) { lastMsg = Date.now(); var m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
      s.onclose = function () { if (ws === s) dropped(); };
    });
  }
  /* the socket died (phone switched apps, network blip): in a match that ends the match, otherwise reconnect quietly */
  function dropped() {
    var sock = ws; ws = null; if (sock) { sock.onclose = null; try { sock.close(); } catch (e) {} }
    if (inMatch || curConn) { V = null; if (curConn && curConn.peer.onclose) curConn.peer.onclose(); return; }
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
        if (wasQueued) { send({ t: 'quick' }); renderQuickWait(0); }
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
    if (document.hidden || !root || root.hidden || inMatch) return;
    if (retry) { clearTimeout(retry); retry = null; reconnect(Date.now()); return; }
    if (!ws) return;
    var sent = Date.now(); send({ t: 'ping' });
    setTimeout(function () { if (ws && lastMsg < sent && !document.hidden) dropped(); }, 3000);
  });
  setInterval(function () { if (ws && !document.hidden) send({ t: 'ping' }); }, 25000);
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
  function open() { root.hidden = false; $('#home').hidden = true; tok++; V = null; }
  function leave() { tok++; clearTimeout(retry); retry = null; resuming = false; remember(''); send({ t: 'quickCancel' }); send({ t: 'leave' }); V = null; queued = false; root.hidden = true; $('#home').hidden = false; if (SD.main && SD.main.refresh) SD.main.refresh(); }

  /* ---------- messages ---------- */
  function onMsg(m) {
    if (m.t === 'hi') { myId = m.id; if (resuming) { resuming = false; if (!m.resumed) { V = null; lost(); } } }
    else if (m.t === 'wait') { if (queued) renderQuickWait(m.n); }
    else if (m.t === 'err') { var e = $('#pErr'); if (e) e.textContent = m.e; else { show('<h2>PARTY</h2><p class="on-msg">' + esc(m.e) + '</p>' + back()); bind('#pBack', menu); } }
    else if (m.t === 'room') { V = m.v; remember(V.code); if (!inMatch) render(); }
    else if (m.t === 'left') { V = null; remember(''); }
    else if (m.t === 'match') { pending = m; queued = false; if (m.kind !== 'tour') remember(''); if (!inMatch) launch(); }
    else if (m.t === 'relay') { if (curConn && curConn.mid === m.mid) curConn.deliver(m.m); }
    else if (m.t === 'tap') { var el = card.querySelector('[data-mid="' + m.mid + '"] .tf[data-slot="' + m.slot + '"]'); if (el) { el.classList.remove('tap'); void el.offsetWidth; el.classList.add('tap'); } }
  }
  function launch() {
    var m = pending; pending = null; if (!m) return;
    var q = [], handler = null, peer = { send: function (o) { send({ t: 'relay', mid: m.mid, m: o }); }, close: function () {}, onclose: null };
    Object.defineProperty(peer, 'onmessage', { get: function () { return handler; }, set: function (f) { handler = f; if (f) q.splice(0).forEach(f); } });
    var conn = { peer: peer, role: m.role, id: m.room || 'SERVER', opp: m.opp, myName: st.name(0), seed: m.seed, kind: m.kind, mid: m.mid, arena: m.arena, againMe: false, againPeer: false,
      deliver: function (o) { if (handler) handler(o); else q.push(o); } };
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
    if (pending) return launch();
    if (V) render(); else lost();
  };
  P.matchOver = function () { if (curConn && curConn.kind !== 'tour') { curConn = null; inMatch = false; } };

  /* ---------- screens ---------- */
  function renderQuickWait(n) {
    show('<h2>FINDING A PLAYER</h2><div class="on-face spin">' + art.face(0, 'worry') + '</div><p class="on-msg">LOOKING FOR AN OPPONENT...<small>' + (n > 1 ? n + ' PLAYERS WAITING' : 'YOU ARE FIRST IN LINE') + '</small></p>' + back('CANCEL'));
    bind('#pBack', function () { send({ t: 'quickCancel' }); queued = false; leave(); });
  }
  P.quick = function () {
    root = $('#party'); card = $('#partyCard'); open(); busy('INSTANT MATCH', 'CONNECTING...'); var t = tok;
    connect().then(function () { if (t !== tok) return; queued = true; send({ t: 'quick' }); renderQuickWait(0); }, function () { if (t === tok) noServer(); });
  };
  function menu() {
    show('<h2>FRIENDS ROOM</h2><div class="on-face">' + art.face(0, 'cheer') + '</div><p class="on-note">Make a room for 2 to 10 players. Share the code or link. 2 players = a normal match. 4 or more = knockout bracket, first to 2 wins.</p>' +
      '<button class="gel" id="pMake" type="button">' + art.icon('friend', 30) + '<span>MAKE A ROOM</span></button>' +
      '<button class="gel alt" id="pJoin" type="button"><span>JOIN WITH A CODE</span></button>' + back());
    bind('#pMake', function () { send({ t: 'create' }); }); bind('#pJoin', function () { joinForm(''); }); bind('#pBack', leave);
  }
  P.menu = function () {
    root = $('#party'); card = $('#partyCard'); open(); busy('FRIENDS ROOM', 'CONNECTING...'); var t = tok;
    connect().then(function () { if (t === tok) menu(); }, function () { if (t === tok) noServer(); });
  };
  function joinForm(pre) {
    show('<h2>JOIN A ROOM</h2><input id="pCode" class="on-in code" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="CODE" value="' + esc(pre) + '"><p class="on-err" id="pErr"></p><button class="gel" id="pGo" type="button"><span>JOIN</span></button>' + back());
    var go = function () { var c = ($('#pCode').value || '').toUpperCase().replace(/[^A-Z]/g, ''); if (c.length !== 4) { $('#pErr').textContent = 'TYPE THE 4 LETTERS'; return; } send({ t: 'join', code: c }); };
    bind('#pGo', go); bind('#pBack', menu);
    if (pre && pre.length === 4) go();
  }
  P.join = function (code) {
    root = $('#party'); card = $('#partyCard'); open(); busy('FRIENDS ROOM', 'JOINING ' + esc(code) + '...'); var t = tok;
    connect().then(function () { if (t === tok) { joinForm(code); } }, function () { if (t === tok) noServer(); });
  };

  function render() {
    if (!V || !card) return;
    if (V.phase === 'lobby') return renderLobby();
    if (V.phase === 'done') return renderDone();
    renderTree();
  }
  function renderLobby() {
    var n = V.players.length, isHost = V.host === myId, okN = n >= 2 && n <= 10 && n % 2 === 0;
    var list = V.players.map(function (p) { return '<div class="tl-p' + (p.away ? ' away' : '') + '">' + face(p) + '<b>' + esc(p.name) + (p.id === V.host ? ' *' : '') + '</b>' + (p.away ? '<small>AWAY</small>' : '') + '</div>'; }).join('');
    show('<h2>ROOM</h2><div class="t-code">' + esc(V.code) + '</div><p class="on-note">Friends: tap ROOM, JOIN WITH A CODE, and type this. Or send the invite link.</p>' +
      '<div class="tl-list">' + list + '</div><p class="on-msg tl"><small>' + n + ' / 10 PLAYERS' + (okN ? '' : n < 2 ? ' · NEED ONE MORE' : ' · NEED AN EVEN NUMBER') + '</small></p><p class="on-err" id="pErr"></p>' +
      (isHost ? '<button class="gel" id="pStart" type="button"' + (okN ? '' : ' disabled') + '><span>START' + (n >= 2 ? ' (' + n + ')' : '') + '</span></button>' : '<p class="on-msg">WAITING FOR THE HOST TO START...</p>') +
      '<button class="gel alt" id="pInv" type="button"><span>SEND INVITE</span></button>' + back('LEAVE'));
    bind('#pStart', function () { send({ t: 'start' }); }); bind('#pInv', invite); bind('#pBack', leave);
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
        (!m.live && !done ? '<i class="rdy">' + (ready ? 'READY' : '...') + '</i>' : '') + '</div>';
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
    // watch panel for a live match
    var wm = V.matches.filter(function (m) { return m.mid === watchMid && m.live; })[0];
    if (!wm && me && me.out) wm = V.matches.filter(function (m) { return m.live; })[0];
    var watch = '';
    if (wm && wm.a !== myId && wm.b !== myId) {
      var A = by[wm.a], B = by[wm.b];
      watch = '<div class="watch" data-mid="' + wm.mid + '"><b class="wt">WATCHING LIVE' + (isFinal ? ' · FINAL' : '') + '</b><div class="wr"><div>' + face(A).replace('class="tf"', 'class="tf" data-slot="0"') + '<span>' + esc(A.name) + '</span></div><strong>' + wm.s[0] + ' - ' + wm.s[1] + '</strong><div>' + face(B).replace('class="tf"', 'class="tf" data-slot="1"') + '<span>' + esc(B.name) + '</span></div></div><small>' + esc(wm.g || 'STARTING') + '</small></div>';
    }
    show('<h2>' + label + '</h2><p class="on-msg tl">' + line + '<small>' + alive + ' PLAYERS LEFT · FIRST TO 2 WINS</small></p>' + watch + '<div class="tms">' + V.matches.map(function (m) { return node(m, by); }).join('') + '</div>' + ready + back('LEAVE'));
    bind('#pReady', function () { send({ t: 'ready', mid: mine.mid }); }); bind('#pBack', leave);
    Array.prototype.forEach.call(card.querySelectorAll('.tm.live'), function (el) { el.addEventListener('click', function () { watchMid = +el.dataset.mid; renderTree(); }); });
  }
  function renderDone() {
    var ch = null; V.players.forEach(function (p) { if (p.id === V.champ) ch = p; });
    var me = ch && ch.id === myId;
    show('<h2>WINNER WINNER!</h2><div class="trophy-glow"><div class="on-face big">' + art.face(0, 'win', { skin: ch ? ch.skin : 0, crown: true }) + '</div></div><p class="on-msg"><b>' + esc(ch ? ch.name : '') + '</b> WINS THE PARTY!<small>' + (me ? 'THAT IS YOU! SHARE YOUR TROPHY' : V.size + ' PLAYERS · ' + V.rounds + ' ROUNDS') + '</small></p>' +
      (me ? '<button class="gel" id="pShare" type="button"><span>SHARE TROPHY</span></button>' : '') + back('HOME'));
    bind('#pShare', function () { trophy(ch); }); bind('#pBack', leave);
    try { au.sfx.cheer(); SD.fx.confetti(window.innerWidth / 2, window.innerHeight / 3, 70, 1.3); } catch (e) {}
  }
  function trophy(ch) {
    var W = 720, H = 960, c = document.createElement('canvas'); c.width = W; c.height = H; var g = c.getContext('2d');
    var gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#ffe27a'); gr.addColorStop(1, '#ff9ecf'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#2a1650'; g.lineWidth = 14; g.strokeRect(24, 24, W - 48, H - 48);
    g.fillStyle = '#2a1650'; g.textAlign = 'center'; g.font = '900 64px system-ui, sans-serif'; g.fillText('WINNER WINNER!', W / 2, 140);
    g.font = '800 34px system-ui, sans-serif'; g.fillText('PARTY CHAMPION', W / 2, 196);
    var svg = art.face(0, 'win', { skin: ch.skin | 0, crown: true }).replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420"'), img = new Image();
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
  SD.partyDbg = function (v, id) { if (v) { V = v; myId = id; root = $('#party'); card = $('#partyCard'); root.hidden = false; render(); } return V; };
})();
