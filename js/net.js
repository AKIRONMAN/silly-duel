/* Online layer: Firebase (free plan) for login, leaderboard, lobby and signaling,
   plus a direct WebRTC data channel so the two phones talk to each other without a server.
   Firebase is only used to find a partner and say hello. The game itself runs phone to phone. */
window.SD = window.SD || {};
(function () {
  'use strict';
  var st = SD.store;
  var V = '10.14.1', BASE = 'https://www.gstatic.com/firebasejs/' + V + '/';
  var FB = null, loadP = null;

  function configured() { var c = SD.firebaseConfig; return !!(c && c.apiKey && c.projectId); }
  function cleanName(n) { n = (n || '').trim(); return /^[A-Za-z0-9_]{3,12}$/.test(n) ? n : ''; }

  function nice(e) {
    var c = (e && (e.code || e.message)) || '';
    if (/email-already-in-use|credential-already-in-use/.test(c)) return 'NAME TAKEN';
    if (/weak-password/.test(c)) return 'PASSWORD: 6+ LETTERS';
    if (/wrong-password|invalid-credential|user-not-found|invalid-login/.test(c)) return 'WRONG NAME OR PASSWORD';
    if (/operation-not-allowed|admin-restricted/.test(c)) return 'TURN ON LOGIN IN FIREBASE';
    if (/network|NETWORK/.test(c)) return 'CANNOT REACH THE ROOM SERVER. CHECK INTERNET';
    if (/permission-denied/.test(c)) return 'FIREBASE RULES BLOCKED THIS';
    if (/too-many/.test(c)) return 'WAIT A MINUTE, TRY AGAIN';
    if (/popup-closed|cancelled-popup|user-cancelled/.test(c)) return 'GOOGLE LOGIN CANCELLED';
    if (/popup-blocked/.test(c)) return 'ALLOW POPUPS, THEN TRY AGAIN';
    if (/unauthorized-domain/.test(c)) return 'ADD THIS SITE IN FIREBASE: AUTH, SETTINGS, AUTHORIZED DOMAINS';
    if (/operation-not-supported|web-storage-unsupported/.test(c)) return 'OPEN THE GAME IN CHROME OR SAFARI FOR GOOGLE LOGIN';
    return 'SOMETHING WENT WRONG';
  }

  /* ---------- Firebase backend ---------- */
  function load() {
    if (loadP) return loadP;
    loadP = Promise.all([import(BASE + 'firebase-app.js'), import(BASE + 'firebase-auth.js'), import(BASE + 'firebase-firestore.js')]).then(function (m) {
      var app = m[0].initializeApp(SD.firebaseConfig);
      FB = { a: m[1], f: m[2], auth: m[1].getAuth(app), db: m[2].getFirestore(app) };
      return FB;
    });
    return loadP;
  }
  function me() {
    var u = FB && FB.auth.currentUser;
    if (!u) return null;
    return { uid: u.uid, name: st.name(0), anon: u.isAnonymous, email: u.email || '' };
  }
  function ref(path) { var p = path.split('/'); return FB.f.doc.apply(null, [FB.db].concat(p)); }
  function coll(path) { return FB.f.collection.apply(null, [FB.db].concat(path.split('/'))); }

  var fb = {
    name: 'firebase',
    init: function () {
      return load().then(function () { return FB.auth.authStateReady ? FB.auth.authStateReady() : null; })
        .then(function () { if (!FB.auth.currentUser) return FB.a.signInAnonymously(FB.auth); })
        .then(me);
    },
    user: me,
    /* load Firebase and restore a remembered login, without creating a guest account */
    start: function () {
      return load().then(function () { return FB.auth.authStateReady ? FB.auth.authStateReady() : null; }).then(me);
    },
    google: function () {
      var prov = new FB.a.GoogleAuthProvider();
      prov.setCustomParameters({ prompt: 'select_account' });
      var u = FB.auth.currentUser;
      if (u && u.isAnonymous && FB.a.linkWithPopup) {
        return FB.a.linkWithPopup(u, prov).then(me, function (e) {
          var c = (e && e.code) || '';
          if (/credential-already-in-use|email-already-in-use|provider-already-linked/.test(c)) {
            return FB.a.signInWithPopup(FB.auth, prov).then(me);
          }
          throw e;
        });
      }
      return FB.a.signInWithPopup(FB.auth, prov).then(me);
    },
    logout: function () { return FB.a.signOut(FB.auth); },
    /* private full save (only the owner can read it) */
    loadSave: function (uid) {
      var me = FB.auth.currentUser;
      if (!me) return Promise.reject({ code: 'no-auth' });
      var id = me.uid;
      if (uid && uid !== me.uid) id = me.uid;
      return FB.f.getDoc(ref('saves/' + id)).then(function (s) { return s.exists() ? s.data() : null; });
    },
    putSave: function (pack) { return FB.f.setDoc(ref('saves/' + FB.auth.currentUser.uid), pack); },
    /* removes the save, the Top 100 entry and the Google login itself */
    deleteAccount: function () {
      var u = FB.auth.currentUser, uid = u.uid;
      function wipe() {
        var who = ref('nameOf/' + uid);
        return FB.f.getDoc(who).then(function (s) {
          var jobs = [FB.f.deleteDoc(ref('saves/' + uid)), FB.f.deleteDoc(ref('users/' + uid)), FB.f.deleteDoc(who)];
          var held = s.exists() ? st.cleanName(s.data().name || '') : '';
          if (held) jobs.push(FB.f.deleteDoc(ref('names/' + held)));
          return Promise.all(jobs.map(function (p) { return p.catch(function () {}); }));
        }, function () {
          return Promise.all([FB.f.deleteDoc(ref('saves/' + uid)), FB.f.deleteDoc(ref('users/' + uid))]);
        });
      }
      function drop() {
        return u.delete().catch(function (e) {
          if (!/requires-recent-login/.test((e && e.code) || '')) throw e;
          return FB.a.reauthenticateWithPopup(u, new FB.a.GoogleAuthProvider()).then(function () { return u.delete(); });
        });
      }
      return wipe().then(drop);
    },
    saveProfile: function (p) { return FB.f.setDoc(ref('users/' + FB.auth.currentUser.uid), p, { merge: true }); },
    loadProfile: function () { return FB.f.getDoc(ref('users/' + FB.auth.currentUser.uid)).then(function (s) { return s.exists() ? s.data() : null; }); },
    leaderboard: function () {
      var q = FB.f.query(coll('users'), FB.f.orderBy('owins', 'desc'), FB.f.limit(100));
      return FB.f.getDocs(q).then(function (s) { return s.docs.map(function (d) { var x = d.data(); x.uid = d.id; return x; }); });
    },
    lobbyList: function (minLevel, maxLevel) {
      var q = FB.f.query(coll('lobby'), FB.f.where('level', '>=', minLevel), FB.f.where('level', '<=', maxLevel), FB.f.orderBy('level'), FB.f.limit(12));
      return FB.f.getDocs(q).then(function (s) { return s.docs.map(function (d) { return d.data(); }); });
    },
    lobbyPut: function (e) { return FB.f.setDoc(ref('lobby/' + e.uid), e); },
    lobbyRemove: function () { var u = FB.auth.currentUser; return u ? FB.f.deleteDoc(ref('lobby/' + u.uid)).catch(function () {}) : Promise.resolve(); },
    roomCreate: function (id, info) { return FB.f.setDoc(ref('rooms/' + id), { host: info, guest: null, ts: Date.now() }); },
    roomJoin: function (id, info) {
      var r = ref('rooms/' + id);
      return FB.f.runTransaction(FB.db, function (tx) {
        return tx.get(r).then(function (s) {
          if (!s.exists()) throw new Error('NOROOM');
          var d = s.data();
          if (d.guest) throw new Error('FULL');
          tx.update(r, { guest: info });
          return d.host;
        });
      });
    },
    roomWatch: function (id, cb) { return FB.f.onSnapshot(ref('rooms/' + id), function (s) { cb(s.exists() ? s.data() : null); }); },
    roomSet: function (id, patch) { return FB.f.updateDoc(ref('rooms/' + id), patch); },
    iceAdd: function (id, side, c) { return FB.f.addDoc(coll('rooms/' + id + '/ice'), { side: side, c: c }); },
    sendFeedback: function (msg, stars) {
      var u = FB.auth.currentUser;
      if (!u) return Promise.reject({ code: 'no-auth' });
      var name = String(st.name(0) || 'GUEST').slice(0, 14);
      if (!name) name = 'GUEST';
      return FB.f.addDoc(coll('feedback'), { uid: u.uid, name: name, msg: msg, stars: stars | 0, ts: Date.now() });
    },
    iceWatch: function (id, side, cb) {
      return FB.f.onSnapshot(coll('rooms/' + id + '/ice'), function (snap) {
        snap.docChanges().forEach(function (ch) { if (ch.type === 'added' && ch.doc.data().side === side) cb(ch.doc.data().c); });
      });
    },
    roomDelete: function (id) {
      return FB.f.getDocs(coll('rooms/' + id + '/ice')).then(function (s) {
        return Promise.all(s.docs.map(function (d) { return FB.f.deleteDoc(d.ref); }));
      }).then(function () { return FB.f.deleteDoc(ref('rooms/' + id)); }).catch(function () {});
    }
  };

  /* ---------- direct phone to phone link (WebRTC data channel) ---------- */
  function iceServers() {
    return SD.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  }
  function peerConnect(role, id, ms) {
    var B = N.backend;
    return new Promise(function (resolve, reject) {
      var pc = new RTCPeerConnection({ iceServers: iceServers() });
      var unsubs = [], queue = [], haveRemote = false, settled = false, peer = null, gotOffer = false, gotAnswer = false, tm;
      function cleanup() { clearTimeout(tm); unsubs.forEach(function (f) { try { f(); } catch (_) {} }); unsubs = []; }
      function fail(e) { if (settled) return; settled = true; cleanup(); try { pc.close(); } catch (_) {} reject(e || { code: 'CONNECT' }); }
      tm = setTimeout(function () { fail({ code: 'CONNECT' }); }, ms);
      function remoteSet() { haveRemote = true; queue.splice(0).forEach(function (c) { pc.addIceCandidate(c).catch(function () {}); }); }
      function addCand(c) { var cand; try { cand = JSON.parse(c); } catch (_) { return; } if (haveRemote) pc.addIceCandidate(cand).catch(function () {}); else queue.push(cand); }
      pc.onicecandidate = function (e) { if (e.candidate) B.iceAdd(id, role, JSON.stringify(e.candidate)); };
      pc.onconnectionstatechange = function () {
        var s = pc.connectionState;
        if (s === 'failed') { if (!settled) fail({ code: 'CONNECT' }); else if (peer && !peer._closed) { peer._closed = true; if (peer.onclose) peer.onclose(); } }
        else if ((s === 'disconnected' || s === 'closed') && peer && !peer._closed) { peer._closed = true; if (peer.onclose) peer.onclose(); }
      };
      function wire(dc) {
        var handler = null, q = [];
        peer = { send: function (o) { try { if (dc.readyState === 'open') dc.send(JSON.stringify(o)); } catch (_) {} }, close: function () { try { dc.close(); pc.close(); } catch (_) {} }, onclose: null };
        Object.defineProperty(peer, 'onmessage', { get: function () { return handler; }, set: function (f) { handler = f; if (f) q.splice(0).forEach(f); } });
        dc.onmessage = function (e) { var m; try { m = JSON.parse(e.data); } catch (_) { return; } if (handler) handler(m); else q.push(m); };
        dc.onclose = function () { if (peer && !peer._closed) { peer._closed = true; if (peer.onclose) peer.onclose(); } };
        var opened = function () { if (settled) return; settled = true; cleanup(); resolve(peer); };
        dc.onopen = opened;
        if (dc.readyState === 'open') opened();
      }
      unsubs.push(B.iceWatch(id, role === 'host' ? 'guest' : 'host', addCand));
      if (role === 'host') {
        wire(pc.createDataChannel('d'));
        pc.createOffer().then(function (o) { return pc.setLocalDescription(o); })
          .then(function () { return B.roomSet(id, { offer: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } }); }).catch(fail);
        unsubs.push(B.roomWatch(id, function (r) {
          if (r && r.answer && !gotAnswer) { gotAnswer = true; pc.setRemoteDescription(r.answer).then(remoteSet).catch(fail); }
        }));
      } else {
        pc.ondatachannel = function (e) { wire(e.channel); };
        unsubs.push(B.roomWatch(id, function (r) {
          if (r && r.offer && !gotOffer) {
            gotOffer = true;
            pc.setRemoteDescription(r.offer).then(function () { remoteSet(); return pc.createAnswer(); })
              .then(function (a) { return pc.setLocalDescription(a); })
              .then(function () { return B.roomSet(id, { answer: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } }); }).catch(fail);
          }
        }));
      }
    });
  }

  /* ---------- finding a partner ---------- */
  function myInfo() {
    var u = N.backend.user();
    return { uid: u.uid, name: u.name, level: st.get('level') | 0 || 1, skin: st.get('skins')[0] | 0, tint: (st.get('tints') || [0])[0] | 0 };
  }

  function hostWait(job, id, info, ms, lobby) {
    var B = N.backend;
    return B.roomCreate(id, info).then(function () {
      if (lobby) B.lobbyPut({ uid: info.uid, name: info.name, level: info.level, skin: info.skin, tint: info.tint | 0, room: id, ts: Date.now() });
      return new Promise(function (res, rej) {
        var un = null, ended = false, t;
        function end(delRoom) {
          if (ended) return; ended = true; clearTimeout(t);
          if (un) un();
          if (lobby) B.lobbyRemove();
          if (delRoom) B.roomDelete(id);
        }
        t = setTimeout(function () { end(true); rej({ code: 'NOBODY' }); }, ms);
        job.stop = function () { end(true); rej({ code: 'CANCEL' }); };
        un = B.roomWatch(id, function (r) {
          if (r && r.guest && !ended) { end(false); res({ role: 'host', id: id, opp: r.guest }); }
        });
        if (ended && un) un();
      });
    });
  }

  function link(job, found, myName) {
    var B = N.backend;
    if (job.cancelled) return Promise.reject({ code: 'CANCEL' });
    return peerConnect(found.role, found.id, 15000).then(function (peer) {
      if (found.role === 'host') B.roomDelete(found.id);
      var conn = { peer: peer, role: found.role, id: found.id, you: myInfo(), opp: found.opp, myName: myName, againMe: false, againPeer: false };
      if (found.role === 'host') {
        conn.seed = (Math.random() * 4294967296) >>> 0;
        peer.send({ t: 'start', seed: conn.seed });
        return conn;
      }
      return new Promise(function (res, rej) {
        var t = setTimeout(function () { rej({ code: 'CONNECT' }); }, 8000);
        peer.onmessage = function (m) { if (m && m.t === 'start') { clearTimeout(t); conn.seed = m.seed; res(conn); } };
      });
    });
  }

  /* ---------- rooms without any setup: free public PeerJS broker ---------- */
  var PEERJS_URL = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  function loadPeerJs() {
    if (window.Peer) return Promise.resolve();
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = PEERJS_URL; s.onload = res;
      s.onerror = function () { rej({ code: 'NETWORK' }); };
      document.head.appendChild(s);
    });
  }
  function localInfo() { return { uid: 'local', name: st.name(0), level: st.get('level') | 0 || 1, skin: st.get('skins')[0] | 0, tint: (st.get('tints') || [0])[0] | 0 }; }
  function wrapConn(conn, pr) {
    var handler = null, q = [], closed = false;
    var peer = {
      send: function (o) { try { if (conn.open) conn.send(o); } catch (_) {} },
      close: function () { try { conn.close(); } catch (_) {} try { pr.destroy(); } catch (_) {} },
      onclose: null
    };
    Object.defineProperty(peer, 'onmessage', { get: function () { return handler; }, set: function (f) { handler = f; if (f) q.splice(0).forEach(f); } });
    conn.on('data', function (m) { if (handler) handler(m); else q.push(m); });
    function gone() { if (!closed) { closed = true; if (peer.onclose) peer.onclose(); } }
    conn.on('close', gone); conn.on('error', gone);
    return peer;
  }
  function peerMake(job, onCode) {
    var info = localInfo(), letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ', tries = 0, pr = null;
    return loadPeerJs().then(function () {
      return new Promise(function (res, rej) {
        function attempt() {
          var code = ''; for (var k = 0; k < 4; k++) code += letters.charAt(Math.floor(Math.random() * letters.length));
          onCode(code);
          pr = new window.Peer('sd-' + code, SD.peerOpts || {});
          pr.on('error', function (e) {
            if (e.type === 'unavailable-id' && tries++ < 4) { try { pr.destroy(); } catch (_) {} attempt(); }
            else { try { pr.destroy(); } catch (_) {} rej({ code: 'NETWORK' }); }
          });
          pr.on('connection', function (c) {
            var me = pr;
            c.on('open', function () {
              var peer = wrapConn(c, me);
              peer.onmessage = function (m) {
                if (!m || m.t !== 'hi') return;
                var conn = { peer: peer, role: 'host', id: code, you: info, opp: m.info, myName: info.name, againMe: false, againPeer: false, seed: (Math.random() * 4294967296) >>> 0 };
                peer.send({ t: 'hi', info: info }); peer.send({ t: 'start', seed: conn.seed });
                res(conn);
              };
            });
          });
        }
        job.stop = function () { try { if (pr) pr.destroy(); } catch (_) {} rej({ code: 'CANCEL' }); };
        attempt();
      });
    });
  }
  function peerJoin(job, code) {
    var info = localInfo();
    return loadPeerJs().then(function () {
      return new Promise(function (res, rej) {
        var pr = new window.Peer(SD.peerOpts || {}), tm = setTimeout(function () { try { pr.destroy(); } catch (_) {} rej({ code: 'CONNECT' }); }, 15000);
        job.stop = function () { clearTimeout(tm); try { pr.destroy(); } catch (_) {} rej({ code: 'CANCEL' }); };
        pr.on('error', function (e) { clearTimeout(tm); try { pr.destroy(); } catch (_) {} rej(e.type === 'peer-unavailable' ? { message: 'NOROOM' } : { code: 'NETWORK' }); });
        pr.on('open', function () {
          var c = pr.connect('sd-' + code, { reliable: true, serialization: 'json' });
          c.on('open', function () {
            var peer = wrapConn(c, pr), opp = null;
            peer.send({ t: 'hi', info: info });
            peer.onmessage = function (m) {
              if (!m) return;
              if (m.t === 'hi') opp = m.info;
              else if (m.t === 'start') { clearTimeout(tm); res({ peer: peer, role: 'guest', id: code, you: info, opp: opp || { name: 'FRIEND', level: 1, skin: 1, tint: 0 }, myName: info.name, seed: m.seed, againMe: false, againPeer: false }); }
            };
          });
        });
      });
    });
  }

  function newJob() {
    if (N.job) N.job.cancel();
    var job = { cancelled: false, stop: null, cancel: function () { job.cancelled = true; if (job.stop) job.stop(); } };
    N.job = job;
    return job;
  }

  var N = SD.net = {
    backend: fb,
    configured: configured,
    cleanName: cleanName,
    nice: nice,
    peerConnect: peerConnect,
    loadPeerJs: loadPeerJs, wrapConn: wrapConn, localInfo: localInfo,
    cancel: function () { if (N.job) N.job.cancel(); N.job = null; },

    /* looks for someone waiting at my level up to 3 levels above, otherwise waits for 15 seconds. These matches are rated. */
    quick: function (onStatus) {
      var B = N.backend, job = newJob(), info = myInfo();
      return B.lobbyList(info.level, info.level + 3).then(function (list) {
        var now = Date.now();
        list = list.filter(function (e) { return e.uid !== info.uid && e.room && now - e.ts < 45000; }).sort(function (a, b) { return a.level - b.level; });
        function tryNext(i) {
          if (job.cancelled) return Promise.reject({ code: 'CANCEL' });
          if (i >= list.length) return Promise.resolve(null);
          return B.roomJoin(list[i].room, info).then(function (host) { return { role: 'guest', id: list[i].room, opp: host }; }, function () { return tryNext(i + 1); });
        }
        return tryNext(0);
      }).then(function (found) {
        if (found) return found;
        if (onStatus) onStatus('waiting');
        return hostWait(job, info.uid, info, 15000, true);
      }).then(function (found) { if (onStatus) onStatus('connecting'); return link(job, found, info.name); }).then(function (c) { c.kind = 'random'; return c; });
    },

    /* a private room with a 4 letter code */
    makeRoom: function (onCode) {
      if (!configured()) return peerMake(newJob(), onCode).then(function (c) { c.kind = 'room'; return c; });
      var job = newJob(), info = myInfo(), letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ', code = '';
      for (var k = 0; k < 4; k++) code += letters.charAt(Math.floor(Math.random() * letters.length));
      onCode(code);
      return hostWait(job, code, info, 180000, false).then(function (found) { return link(job, found, info.name); }).then(function (c) { c.kind = 'room'; return c; });
    },
    joinRoom: function (code, onStatus) {
      code = (code || '').toUpperCase().replace(/[^A-Z]/g, '');
      if (!configured()) return peerJoin(newJob(), code).then(function (c) { c.kind = 'room'; return c; });
      var job = newJob(), info = myInfo();
      return N.backend.roomJoin(code, info).then(function (host) {
        if (onStatus) onStatus('connecting');
        return link(job, { role: 'guest', id: code, opp: host }, info.name);
      }).then(function (c) { c.kind = 'room'; return c; });
    },

    /* ---------- Google account + guest cloud save ---------- */
    signedIn: signedIn,
    status: function () { return syncState; },
    /* on page load: guest or Google session, then the cloud save is the source of truth */
    boot: function () {
      if (!configured()) return Promise.resolve(false);
      return load().then(function () { return FB.auth.authStateReady ? FB.auth.authStateReady() : null; })
        .then(function () {
          var u = FB.auth.currentUser;
          if (u && !u.isAnonymous) { remember(u); return pull(false); }
          if (u && u.isAnonymous) { remember(u); return pull(false); }
          return FB.a.signInAnonymously(FB.auth).then(function () { remember(FB.auth.currentUser); return pull(true); });
        }).catch(function () { return false; });
    },
    signIn: function () {
      var popup = FB ? fb.google() : load().then(fb.google);
      return popup.then(function (u) {
        if (st.get('acct') !== u.uid) st.quiet('cloudTs', 0);
        remember(u);
        return pull(true);
      });
    },
    /* save now (private structured save; TOP 100 only for Google). Safe to call any time. */
    /* true when some other account already has this name */
    nameTaken: function (name) {
      var key = st.cleanName(name);
      if (!key || !configured()) return Promise.resolve(false);
      return load().then(function () { return FB.auth.authStateReady ? FB.auth.authStateReady() : null; }).then(function () {
        var uid = (FB.auth.currentUser && FB.auth.currentUser.uid) || '';
        function legacyTaken() {
          var q = FB.f.query(coll('users'), FB.f.where('name', '==', key), FB.f.limit(5));
          return FB.f.getDocs(q).then(function (snap) {
            return snap.docs.some(function (d) { return d.id !== uid; });
          });
        }
        return FB.f.getDoc(ref('names/' + key)).then(function (s) {
          if (s.exists()) return (s.data().uid || '') !== uid;
          return legacyTaken();
        }, legacyTaken);
      });
    },
    onNameRejected: null,
    sync: function () {
      clearTimeout(syncTimer); syncTimer = 0;
      if (!clouded()) return Promise.resolve();
      syncState = 'saving';
      function write(p) {
        var jobs = [fb.putSave(p)];
        if (signedIn()) {
          jobs.push(fb.saveProfile({
            name: p.name, level: p.level,
            skin: st.get('skins')[0] | 0, tint: (st.get('tints') || [0])[0] | 0,
            owins: p.owins, ts: p.ts
          }));
        }
        return Promise.all(jobs).then(function () {
          st.quiet('cloudTs', p.ts);
          if (st.markSynced) st.markSynced(p.ts);
          syncState = 'saved';
        }, function () { syncState = 'error'; });
      }
      /* Guests and Google accounts both reserve the name before any cloud write. */
      function claimAndWrite(tries) {
        var pack = st.packCloud();
        return ensureName(pack.name).then(function () { return write(pack); }, function (e) {
          var code = (e && e.code) || '';
          if (code !== 'name-taken') {
            syncState = 'error';
            return;
          }
          var uid = FB.auth.currentUser ? FB.auth.currentUser.uid : '';
          var owned = lockParts();
          if (owned.uid === uid && owned.name && owned.name !== st.cleanName(pack.name)) {
            st.setName(0, owned.name);
            return write(st.packCloud());
          }
          /* Fresh auto name: pick another until free. A typed name shows the error. */
          if (!(st.get('named') | 0) && (tries | 0) < 8) {
            st.setName(0, freshName(), { soft: true });
            return claimAndWrite((tries | 0) + 1);
          }
          if (N.onNameRejected) { try { N.onNameRejected(); } catch (err) {} }
          syncState = 'saved';
        });
      }
      return claimAndWrite(0);
    },
    logout: function () {
      /* Keep the Google name reserved. A fresh guest session picks its own name. */
      return N.sync().then(fb.logout).then(function () {
        st.quiet('acct', ''); st.quiet('cloudTs', 0); st.quiet('nameLock', ''); st.setUid(''); st.reset();
        return FB.a.signInAnonymously(FB.auth).then(function () { remember(FB.auth.currentUser); return N.sync(); });
      });
    },
    deleteAccount: function () {
      clearTimeout(syncTimer); syncTimer = 0;
      return fb.deleteAccount().then(function () {
        st.quiet('acct', ''); st.quiet('cloudTs', 0); st.quiet('nameLock', ''); st.setUid(''); st.reset();
        return FB.a.signInAnonymously(FB.auth).then(function () { remember(FB.auth.currentUser); });
      });
    },
    sendFeedback: function (msg, stars) {
      msg = String(msg || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
      stars = stars | 0;
      if (stars < 1 || stars > 5) return Promise.reject({ code: 'stars' });
      if (msg.length > 400) msg = msg.slice(0, 400);
      if (!configured()) return Promise.reject({ code: 'offline' });
      return load().then(function () {
        if (!FB.auth.currentUser) return FB.a.signInAnonymously(FB.auth).then(function () { remember(FB.auth.currentUser); });
      }).then(function () { return fb.sendFeedback(msg, stars); });
    }
  };

  var syncTimer = 0, syncState = 'saved';
  var FUNNY = ['BOBA', 'TOFU', 'MANGO', 'NACHO', 'MOCHI', 'PICKLE', 'WAFFLE', 'DONUT', 'TACO', 'JELLY', 'MUFFIN', 'PANCAKE'];
  function freshName() {
    return FUNNY[Math.floor(Math.random() * FUNNY.length)] + (10 + Math.floor(Math.random() * 90));
  }
  function lockParts() {
    var raw = String(st.get('nameLock') || ''), i = raw.indexOf('\n');
    if (i < 0) return { uid: '', name: '' };
    return { uid: raw.slice(0, i), name: raw.slice(i + 1) };
  }
  /* Reserve this name for the current guest or Google account. Document id = name. */
  function ensureName(name) {
    var key = st.cleanName(name), u = FB.auth.currentUser;
    if (!key || !u) return Promise.resolve(false);
    var held = lockParts();
    if (held.uid === u.uid && held.name === key) return Promise.resolve(true);
    var nextRef = ref('names/' + key), whoRef = ref('nameOf/' + u.uid);
    return FB.f.runTransaction(FB.db, function (tx) {
      return tx.get(whoRef).then(function (who) {
        var prev = who.exists() ? st.cleanName(who.data().name || '') : '';
        var prevRef = prev && prev !== key ? ref('names/' + prev) : null;
        return Promise.all([tx.get(nextRef), prevRef ? tx.get(prevRef) : Promise.resolve(null)]).then(function (snaps) {
          var s = snaps[0], old = snaps[1];
          if (s.exists() && s.data().uid !== u.uid) return 'taken';
          if (!s.exists()) tx.set(nextRef, { uid: u.uid });
          if (!who.exists() || prev !== key) tx.set(whoRef, { name: key });
          if (old && old.exists() && old.data().uid === u.uid) tx.delete(prevRef);
          return 'ok';
        });
      });
    }).then(function (result) {
      if (result === 'taken') { var err = new Error('name-taken'); err.code = 'name-taken'; throw err; }
      st.quiet('nameLock', u.uid + '\n' + key);
      return true;
    });
  }
  function signedIn() { var u = FB && FB.auth.currentUser; return !!(u && !u.isAnonymous && u.uid === st.get('acct')); }
  function clouded() { return !!(FB && FB.auth && FB.auth.currentUser); }
  function remember(u) {
    if (!u) return;
    st.setUid(u.uid);
    if (!u.isAnonymous) st.quiet('acct', u.uid);
  }
  function takeCloud(s) {
    if (!s) return false;
    if (typeof s.level === 'number' && st.applyCloud(s)) {
      st.quiet('cloudTs', +s.ts || 0);
      if (st.markSynced) st.markSynced(+s.ts || 0);
      syncState = 'saved';
      return true;
    }
    if (typeof s.d === 'string' && st.load(s.d)) { st.quiet('cloudTs', +s.ts || 0); return true; }
    return false;
  }
  /* Cloud wins while online. A localStorage edit is dropped on the next pull.
     First cloud create must be a starter save; a boosted local file is reset. */
  function pull(first) {
    return fb.loadSave(st.uid()).then(function (s) {
      var localNewer = (st.editedAt && st.editedAt() || 0) > (+(s && s.ts) || 0);
      if (s && !localNewer && (typeof s.level === 'number' || typeof s.d === 'string')) {
        takeCloud(s);
        if (s.d && typeof s.level !== 'number') return N.sync().then(function () { return true; });
        return true;
      }
      if (!s && first && st.boosted() && !(st.editedAt && st.editedAt())) st.reset();
      return N.sync().then(function () { return !!s; });
    });
  }
  st.onChange(function () {
    if (!clouded()) return;
    syncState = 'saving';
    clearTimeout(syncTimer); syncTimer = setTimeout(N.sync, 2500);
  });
  window.addEventListener('pagehide', function () { if (syncTimer) N.sync(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && syncTimer) N.sync(); });
})();
