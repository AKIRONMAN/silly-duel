#!/usr/bin/env node
/* SILLY DUEL SERVER. No packages needed, just Node 16+:   node server/server.js
   - serves the game files (so friends can open  http://<your-ip>:3000  on the same wifi or hotspot, no internet needed)
   - runs instant matchmaking, party rooms (2-10 players) and the knockout bracket over WebSocket (path /ws)
   Host it online (Render, Railway, Fly, any VPS) with the same command to play over the internet.   PORT env var changes the port.
   MAX_PLAYERS caps live sockets (default 250, safe on a 512 MB Render Starter). */
'use strict';
var http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');
var ROOT = path.join(__dirname, '..'), PORT = +process.env.PORT || 3000;
var MAX_PLAYERS = Math.max(20, Math.min(2000, +process.env.MAX_PLAYERS || 250));
/* On Render, skip game files so the $7 box only does MATCH/ROOM/PARTY sockets. Local wifi still serves the game. Set SERVE_FILES=1 to force files on, =0 to force off. */
var SERVE_FILES = process.env.SERVE_FILES === '1' || (process.env.SERVE_FILES !== '0' && !process.env.RENDER);
var MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.txt': 'text/plain', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
var SKIP = { '/crazy-game': 1, '/server': 1, '/.git': 1, '/node_modules': 1 };
var screens = require('./screens');
var fileCache = {}, cacheBytes = 0, CACHE_MAX = 3 * 1024 * 1024;

function blocked(u) {
  if (SKIP[u]) return true;
  for (var k in SKIP) if (u.indexOf(k + '/') === 0) return true;
  return false;
}
function cachedRead(f, cb) {
  var hit = fileCache[f];
  if (hit) return cb(null, hit);
  fs.readFile(f, function (e, data) {
    if (e) return cb(e);
    if (data.length < 250000 && cacheBytes + data.length < CACHE_MAX) {
      fileCache[f] = data; cacheBytes += data.length;
    }
    cb(null, data);
  });
}

var server = http.createServer(function (req, res) {
  var u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (u === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    return res.end('ok ' + liveN() + '/' + MAX_PLAYERS);
  }
  if (!SERVE_FILES) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    return res.end('Silly Duel match server. Play the game at Firebase Hosting. This box is /ws only.');
  }
  if (u === '/screens/powers.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' }); return res.end(screens.powers()); }
  if (u === '/screens/arenas.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' }); return res.end(screens.arenas()); }
  if (u === '/screens/home.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' }); return res.end(screens.home()); }
  if (u === '/screens/home-foot.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' }); return res.end(screens.homeFoot()); }
  if (u === '/') u = '/index.html';
  if (blocked(u)) { res.writeHead(404); return res.end('not found'); }
  var f = path.normalize(path.join(ROOT, u));
  if (f.indexOf(ROOT) !== 0 || f.indexOf(path.join(ROOT, 'server')) === 0) { res.writeHead(403); return res.end('no'); }
  cachedRead(f, function (e, data) {
    if (e) { res.writeHead(404); return res.end('not found'); }
    var ext = path.extname(f).toLowerCase();
    var cache = (ext === '.html' || ext === '') ? 'no-cache' : 'public, max-age=86400';
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': cache });
    res.end(data);
  });
});

/* ---------- tiny WebSocket (RFC 6455) ---------- */
function Sock(socket) { this.s = socket; this.buf = Buffer.alloc(0); this.open = true; this.onmessage = null; this.onclose = null; var me = this;
  socket.on('data', function (d) {
    me.buf = me.buf.length ? Buffer.concat([me.buf, d]) : d;
    me.parse();
  });
  socket.on('close', function () { me.die(); }); socket.on('error', function () { me.die(); });
  socket.setNoDelay(true); socket.setKeepAlive(true, 20000); }
Sock.prototype.die = function () { if (!this.open) return; this.open = false; this.buf = Buffer.alloc(0); try { this.s.destroy(); } catch (e) {} if (this.onclose) this.onclose(); };
Sock.prototype.parse = function () {
  for (;;) {
    var b = this.buf; if (b.length < 2) return;
    var op = b[0] & 15, masked = !!(b[1] & 128), len = b[1] & 127, p = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); p = 4; } else if (len === 127) { if (b.length < 10) return; len = b.readUInt32BE(6); p = 10; }
    if (len > 4096) return this.die();
    var need = p + (masked ? 4 : 0) + len; if (b.length < need) return;
    var payload = Buffer.from(b.subarray(p + (masked ? 4 : 0), need));
    if (masked) { var k = b.subarray(p, p + 4); for (var i = 0; i < payload.length; i++) payload[i] ^= k[i & 3]; }
    this.buf = need >= b.length ? Buffer.alloc(0) : Buffer.from(b.subarray(need));
    if (op === 8) return this.die();
    if (op === 9) this.frame(10, payload);
    else if (op === 1 && this.onmessage) this.onmessage(payload.toString('utf8'));
  }
};
Sock.prototype.frame = function (op, payload) {
  if (!this.open) return; var n = payload.length, h;
  if (n < 126) h = Buffer.from([128 | op, n]); else if (n < 65536) { h = Buffer.alloc(4); h[0] = 128 | op; h[1] = 126; h.writeUInt16BE(n, 2); } else { h = Buffer.alloc(10); h[0] = 128 | op; h[1] = 127; h.writeUInt32BE(n, 6); }
  try { this.s.write(Buffer.concat([h, payload])); } catch (e) { this.die(); }
};
Sock.prototype.sendRaw = function (s) { this.frame(1, Buffer.from(s)); };
Sock.prototype.send = function (o) { this.sendRaw(JSON.stringify(o)); };
server.on('upgrade', function (req, socket) {
  if ((req.url || '').split('?')[0] !== '/ws' || !req.headers['sec-websocket-key']) { socket.destroy(); return; }
  if (liveN() >= MAX_PLAYERS) kickIdle();
  var acc = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  connect(new Sock(socket));
});

/* ---------- game logic ---------- */
var nextId = 1, nextMid = 1, clients = {}, rooms = {}, queue = [], matches = {}, bySid = {}, watchers = {};
var GRACE = 5 * 60 * 1000;   // a player in a room who switches apps (e.g. to send the invite) keeps their place this long
function rnd() { return (Math.random() * 4294967296) >>> 0; }
function clean(s, n) { return String(s == null ? '' : s).replace(/[<>&"]/g, '').slice(0, n); }
function info(c) { return { name: c.name, level: c.level, skin: c.skin, tint: c.tint | 0 }; }
function code() { var L = 'ABCDEFGHJKLMNPQRSTUVWXYZ', s; do { s = ''; for (var i = 0; i < 4; i++) s += L[Math.floor(Math.random() * L.length)]; } while (rooms[s]); return s; }
function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function arenaLevel(a, b) { return Math.max(a.level, b.level); }
function liveN() { var n = 0; for (var id in clients) if (clients[id].ws) n++; return n; }
function kickIdle() {
  var oldest = null;
  for (var id in clients) {
    var c = clients[id];
    if (c.ws && !c.room && !c.match && !c.q && (!oldest || c.seen < oldest.seen)) oldest = c;
  }
  if (!oldest || !oldest.ws) return false;
  oldest.ws.die();
  return true;
}

function gamesOf(c) { var n = c && c.want | 0; return n === 3 || n === 8 ? n : 5; }
function pickTotal(kind, a, b) {
  if (kind === 'tour') return 3;
  if (kind !== 'random') return 5;
  return gamesOf(a) === gamesOf(b) ? gamesOf(a) : 5;
}
function startMatch(a, b, kind, extra) {
  var m = { mid: nextMid++, a: a.id, b: b.id, kind: kind, done: false, s: [0, 0], g: '', seed: 0, arena: 0, snap: null }, seed = rnd(), al = arenaLevel(a, b);
  for (var k in extra || {}) m[k] = extra[k];
  m.seed = seed; m.arena = al;
  var total = pickTotal(kind, a, b);
  matches[m.mid] = m; a.match = b.match = m.mid;
  a.send({ t: 'match', mid: m.mid, kind: kind, role: 'host', seed: seed, you: info(a), opp: info(b), arena: al, total: total, fallback: kind === 'random' && total !== gamesOf(a), room: m.room || '' });
  b.send({ t: 'match', mid: m.mid, kind: kind, role: 'guest', seed: seed, you: info(b), opp: info(a), arena: al, total: total, fallback: kind === 'random' && total !== gamesOf(b), room: m.room || '' });
  return m;
}
function dropMatch(m) { if (!m) return; delete matches[m.mid]; delete watchers[m.mid]; [m.a, m.b].forEach(function (id) { var c = clients[id]; if (c && c.match === m.mid) c.match = 0; }); }

/* party rooms */
function pubRoom(r) {
  return { code: r.code, phase: r.phase, round: r.round, rounds: r.rounds, host: r.host, champ: r.champ, size: r.size, pub: !!r.pub,
    players: r.players.map(function (id) { var c = clients[id]; return c ? { id: id, name: c.name, level: c.level, skin: c.skin, tint: c.tint | 0, out: !!r.out[id], away: !c.ws } : null; }).filter(Boolean),
    matches: r.matches.map(function (m) { return { mid: m.mid, a: m.a, b: m.b, w: m.w, s: m.s, g: m.g, bye: !!m.bye, ra: !!m.ra, rb: !!m.rb, live: !!m.live, n: m.n }; }) };
}
function bcast(r) {
  var raw = JSON.stringify({ t: 'room', v: pubRoom(r) });
  r.players.forEach(function (id) { var c = clients[id]; if (c && c.ws) c.ws.sendRaw(raw); });
}
function leaveRoom(c) {
  var r = c.room && rooms[c.room]; c.room = null; if (!r) return;
  if (r.phase === 'lobby') {
    r.players = r.players.filter(function (id) { return id !== c.id; });
    if (!r.players.length) { delete rooms[r.code]; return; }
    if (r.host === c.id) r.host = r.players[0];
    bcast(r);
  } else {
    r.out[c.id] = true; r.left[c.id] = true;
    var m = r.matches.filter(function (x) { return !x.done && !x.bye && (x.a === c.id || x.b === c.id); })[0];
    if (m) { var o = m.a === c.id ? m.b : m.a; var oc = clients[o]; if (oc && m.live) oc.send({ t: 'relay', mid: m.mid, m: { t: 'bye' } }); finish(r, m, o); }
    else if (r.phase === 'tree') { bcast(r); roundCheck(r); }
    var alive = r.players.filter(function (id) { return !r.left[id]; });
    if (!alive.length) { delete rooms[r.code]; }
  }
}
function buildRound(r) {
  var alive = shuffle(r.players.filter(function (id) { return !r.out[id]; }));
  if (alive.length <= 1) { r.phase = 'done'; r.champ = alive[0] || null; r.matches = []; bcast(r); return; }
  r.round++; r.phase = 'tree'; r.matches = []; r.rounds = Math.max(r.rounds, r.round + Math.ceil(Math.log2(alive.length)) - 1);
  if (alive.length % 2) { var bye = alive.pop(); r.matches.push({ mid: nextMid++, a: bye, b: null, bye: true, w: bye, done: true, s: [0, 0], g: '' }); }
  for (var i = 0; i < alive.length; i += 2) r.matches.push({ mid: nextMid++, a: alive[i], b: alive[i + 1], w: null, done: false, ra: false, rb: false, live: false, s: [0, 0], g: '' });
  r.matches.forEach(function (m, i2) { m.n = i2 + 1; });
  bcast(r);
}
function roundCheck(r) {
  if (r.phase !== 'tree' || r.matches.some(function (m) { return !m.done; })) return;
  var n = r.players.filter(function (id) { return !r.out[id]; }).length;
  if (n <= 1) { r.champ = r.players.filter(function (id) { return !r.out[id]; })[0] || null; r.phase = 'done'; bcast(r); return; }
  r.phase = 'between'; bcast(r);
  setTimeout(function () { if (rooms[r.code]) buildRound(r); }, 5000);
}
function finish(r, m, winId) {
  if (m.done) return; m.done = true; m.live = false; m.w = winId;
  var lose = winId === m.a ? m.b : m.a; r.out[lose] = true;
  var mm = matches[m.mid]; dropMatch(mm);
  bcast(r); roundCheck(r);
}
function tryStart(r, m) {
  if (!m.ra || !m.rb || m.live || m.done) return;
  var a = clients[m.a], b = clients[m.b]; if (!a || !b || !a.ws || !b.ws) return;
  m.live = true;
  var mt = startMatch(a, b, 'tour', { room: r.code });
  m.mid = mt.mid; mt.rm = true; mt.rcode = r.code; bcast(r);
}

function newClient() {
  var c = { id: nextId++, ws: null, sid: '', graceT: null, name: 'PLAYER', level: 1, skin: 0, tint: 0, want: 5, room: null, match: 0, q: false, t0: Date.now(), seen: Date.now() };
  c.send = function (o) { if (c.ws) c.ws.send(o); };
  clients[c.id] = c; return c;
}
function forget(c) {
  clearTimeout(c.graceT); dequeue(c); var mt = matches[c.match];
  if (mt) { var o = clients[mt.a === c.id ? mt.b : mt.a]; if (o) o.send({ t: 'relay', mid: mt.mid, m: { t: 'bye' } }); if (mt.rm) { var r0 = rooms[mt.rcode]; if (r0) { leaveRoom(c); } } dropMatch(mt); }
  unwatchAll(c.id); leaveRoom(c); delete clients[c.id]; if (c.sid && bySid[c.sid] === c) delete bySid[c.sid];
}
function unwatchAll(id) {
  for (var mid in watchers) { delete watchers[mid][id]; if (!Object.keys(watchers[mid]).length) delete watchers[mid]; }
}
function connect(ws) {
  if (liveN() >= MAX_PLAYERS) {
    ws.send({ t: 'full', n: MAX_PLAYERS });
    setTimeout(function () { ws.die(); }, 80);
    return;
  }
  var c = newClient(); c.ws = ws;
  ws.onclose = function () {
    if (c.ws !== ws) return;
    c.ws = null; dequeue(c);
    if (c.room && !c.match) { var r = rooms[c.room]; c.graceT = setTimeout(function () { forget(c); }, GRACE); if (r) bcast(r); }
    else forget(c);
  };
  var bucket = 60, lastRef = Date.now();
  ws.onmessage = function (txt) {
    var now = Date.now(); c.seen = now;
    bucket = Math.min(80, bucket + (now - lastRef) * 0.06); lastRef = now; if (bucket < 1) return; bucket -= 1;
    var m; try { m = JSON.parse(txt); } catch (e) { return; } if (!m || typeof m.t !== 'string') return;
    if (m.t === 'hello') {
      var sid = clean(m.sid, 40), old = sid && bySid[sid];
      if (old && old !== c && clients[old.id] && old.room && !old.match) {
        var prev = old.ws; old.ws = ws; clearTimeout(old.graceT); old.graceT = null; old.seen = now;
        if (prev) { prev.onclose = null; try { prev.s.destroy(); } catch (e) {} }
        delete clients[c.id]; c = old;
        handle(c, m); c.send({ t: 'hi', id: c.id, resumed: true });
        var r2 = rooms[c.room]; if (r2) { bcast(r2); if (r2.phase === 'tree') r2.matches.forEach(function (x) { tryStart(r2, x); }); }
        return;
      }
      if (old && old !== c) forget(old);
      if (sid) { c.sid = sid; bySid[sid] = c; }
      handle(c, m); c.send({ t: 'hi', id: c.id, resumed: false });
      return;
    }
    handle(c, m);
  };
}
function dequeue(c) { var i = queue.indexOf(c.id); if (i >= 0) queue.splice(i, 1); c.q = false; }
function specTo(mid, slot, msg) {
  var w = watchers[mid]; if (!w) return;
  var raw = JSON.stringify({ t: 'spec', mid: mid, slot: slot, m: msg });
  for (var id in w) {
    var c = clients[id];
    if (c && c.ws) c.ws.sendRaw(raw);
  }
}
function handle(c, m) {
  switch (m.t) {
    case 'hello': c.name = clean(m.name, 12) || 'PLAYER'; c.level = Math.max(1, Math.min(99, m.level | 0 || 1)); c.skin = Math.max(0, Math.min(40, m.skin | 0)); c.tint = Math.max(0, Math.min(9, m.tint | 0)); break;
    case 'quick': {
      if (c.match || c.room) return; dequeue(c);
      var g = m.games | 0; c.want = (g === 3 || g === 8) ? g : 5;
      function findOpp(same) {
        var best = -1, bd = 1e9;
        for (var i = 0; i < queue.length; i++) {
          var o = clients[queue[i]]; if (!o) continue;
          if (same && gamesOf(o) !== c.want) continue;
          var d = Math.abs(o.level - c.level); if (d < bd) { bd = d; best = i; }
        }
        return best;
      }
      var best = findOpp(true);
      if (best < 0 && c.want !== 5) best = findOpp(false);
      if (best >= 0) { var o = clients[queue.splice(best, 1)[0]]; o.q = false; startMatch(o, c, 'random'); }
      else { queue.push(c.id); c.q = true; c.send({ t: 'wait', n: queue.length }); }
      break; }
    case 'quickCancel': dequeue(c); break;
    case 'create': {
      if (c.room || c.match) return; var k = code(), r = { code: k, host: c.id, players: [c.id], phase: 'lobby', round: 0, rounds: 0, matches: [], out: {}, left: {}, champ: null, size: 0, pub: !!m.pub };
      rooms[k] = r; c.room = k; bcast(r); break; }
    case 'list': {
      var list = [];
      for (var k2 in rooms) {
        var rr = rooms[k2]; if (!rr.pub || rr.phase !== 'lobby') continue;
        var h = clients[rr.host];
        list.push({ code: rr.code, n: rr.players.length, host: h ? h.name : 'HOST', level: h ? h.level : 1 });
      }
      c.send({ t: 'list', rooms: list }); break; }
    case 'join': {
      if (c.room || c.match) return; var r2 = rooms[clean(m.code, 4).toUpperCase()];
      if (!r2) return c.send({ t: 'err', e: 'NO PARTY WITH THAT CODE' });
      if (r2.phase !== 'lobby') return c.send({ t: 'err', e: 'THAT PARTY ALREADY STARTED' });
      if (r2.players.length >= 10) return c.send({ t: 'err', e: 'THE PARTY IS FULL (10)' });
      r2.players.push(c.id); c.room = r2.code; bcast(r2); break; }
    case 'leave': leaveRoom(c); unwatchAll(c.id); c.send({ t: 'left' }); break;
    case 'start': {
      var r3 = rooms[c.room]; if (!r3 || r3.host !== c.id || r3.phase !== 'lobby') return;
      var n = r3.players.length; if (n < 2 || n > 10 || n % 2) return c.send({ t: 'err', e: 'NEEDS AN EVEN NUMBER OF PLAYERS (2, 4, 6, 8, 10)' });
      var away = r3.players.filter(function (id) { return clients[id] && !clients[id].ws; })[0];
      if (away) return c.send({ t: 'err', e: 'WAITING FOR ' + clients[away].name + ' TO COME BACK' });
      r3.size = n;
      if (n === 2) { var a = clients[r3.players[0]], b = clients[r3.players[1]]; delete rooms[r3.code]; a.room = b.room = null; startMatch(a, b, 'room'); return; }
      r3.phase = 'tree'; r3.out = {}; r3.round = 0; r3.rounds = Math.ceil(Math.log2(n)); buildRound(r3); break; }
    case 'ready': {
      var r4 = rooms[c.room]; if (!r4 || r4.phase !== 'tree') return;
      var mm = r4.matches.filter(function (x) { return x.mid === m.mid && !x.done && !x.bye; })[0]; if (!mm) return;
      if (mm.a === c.id) mm.ra = true; else if (mm.b === c.id) mm.rb = true; else return;
      bcast(r4); tryStart(r4, mm); break; }
    case 'relay': {
      var mt = matches[m.mid]; if (!mt || (mt.a !== c.id && mt.b !== c.id)) return; var oc = clients[mt.a === c.id ? mt.b : mt.a];
      if (oc) oc.send({ t: 'relay', mid: mt.mid, m: m.m });
      if (mt.rm) specTo(mt.mid, mt.a === c.id ? 0 : 1, m.m);
      if (m.m && m.m.t === 'bye' && !mt.rm) dropMatch(mt);
      break; }
    case 'snap': {
      var mtS = matches[m.mid]; if (!mtS || !mtS.rm || mtS.a !== c.id) return;
      var snap = m.snap && typeof m.snap === 'object' ? m.snap : null;
      mtS.snap = snap;
      if (snap && typeof snap.title === 'string') mtS.g = clean(snap.title, 20);
      var wS = watchers[mtS.mid];
      if (wS) {
        var rawS = JSON.stringify({ t: 'snap', mid: mtS.mid, snap: snap });
        for (var idS in wS) { var cs = clients[idS]; if (cs && cs.ws) cs.ws.sendRaw(rawS); }
      }
      break; }
    case 'watch': {
      var mtW = matches[m.mid], rW = mtW && mtW.rm && rooms[mtW.rcode];
      if (!mtW || !rW || rW.players.indexOf(c.id) < 0 || c.id === mtW.a || c.id === mtW.b) return c.send({ t: 'watch', mid: m.mid | 0, ok: false });
      if (!watchers[mtW.mid]) watchers[mtW.mid] = {};
      watchers[mtW.mid][c.id] = 1;
      var ca = clients[mtW.a], cb = clients[mtW.b];
      c.send({ t: 'watch', mid: mtW.mid, ok: true, seed: mtW.seed, arena: mtW.arena, snap: mtW.snap || null,
        a: ca ? info(ca) : null, b: cb ? info(cb) : null, s: mtW.s || [0, 0] });
      break; }
    case 'unwatch': {
      var uw = watchers[m.mid]; if (uw) { delete uw[c.id]; if (!Object.keys(uw).length) delete watchers[m.mid]; }
      break; }
    case 'score': {
      var mt2 = matches[m.mid]; if (!mt2 || !mt2.rm || (mt2.a !== c.id && mt2.b !== c.id)) return; var r6 = rooms[mt2.rcode]; if (!r6) return;
      var rm = r6.matches.filter(function (x) { return x.mid === mt2.mid; })[0]; if (!rm) return;
      if (Array.isArray(m.totals)) rm.s = [m.totals[0] | 0, m.totals[1] | 0]; if (typeof m.game === 'string') rm.g = clean(m.game, 20); bcast(r6); break; }
    case 'end': {
      var mt3 = matches[m.mid]; if (!mt3 || (mt3.a !== c.id && mt3.b !== c.id)) return;
      if (!mt3.rm) { dropMatch(mt3); return; }
      var r7 = rooms[mt3.rcode]; if (!r7) return; var rm2 = r7.matches.filter(function (x) { return x.mid === mt3.mid; })[0]; if (!rm2) return;
      finish(r7, rm2, m.win === 0 ? mt3.a : mt3.b); break; }
    case 'ping': c.send({ t: 'pong' }); break;
  }
}
setInterval(function () {
  var now = Date.now();
  for (var id in clients) {
    var c = clients[id];
    if (c.ws && !c.room && !c.match && !c.q && now - c.seen > 70000) c.ws.die();
  }
  Object.keys(rooms).forEach(function (k) { var r = rooms[k]; if (!r.players.some(function (id) { return clients[id]; })) delete rooms[k]; });
}, 15000);

server.listen(PORT, '0.0.0.0', function () {
  console.log('\nSILLY DUEL server is running.\n  On this device:  http://localhost:' + PORT);
  var nets = os.networkInterfaces(); Object.keys(nets).forEach(function (n) { nets[n].forEach(function (a) { if (a.family === 'IPv4' && !a.internal) console.log('  Friends on the same wifi/hotspot:  http://' + a.address + ':' + PORT); }); });
  console.log('  Live players cap: ' + MAX_PLAYERS + ' (MAX_PLAYERS)');
  console.log('  Game files: ' + (SERVE_FILES ? 'on (local wifi)' : 'off (Render /ws only)') + '\nKeep this window open while you play.\n');
});
