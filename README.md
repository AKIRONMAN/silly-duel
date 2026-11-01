# Silly Duel

Quick silly games to decide who pays the bill. A 2 player duel with skins and levels.
Play on one phone, against a bot, or online with a friend. A plain static website: no build step, no server, no cost except a domain.

**Modes**
- **Who Pays?** Five microgames in a row, a point for each game you win. After game 5 the one with fewer points gets the pie and pays (ties go to a tie-breaker).
- **Roulette** Everyone touches in, the lights spin, one player pays. Pure luck.

**Microgames:** Freeze (hold to run, stop when the watcher turns), Dodge (hop away from falling pies), Beat Pop (tap on the beat), Greedy Pinata (grab the candy before it pops), Hot Bomb (pass the bomb).

Controls on a computer: Q (player 1) and P (player 2). Online, Q, P or Space all tap your own pad.
On a phone, each player taps their own colored pad.

---

## Put it online for free (GitHub Pages)

1. Create a new repository on GitHub, for example `silly-duel`.
2. Upload everything from this folder (keep the folders `css`, `js`, `assets` as they are). The file `index.html` must be at the top level.
3. In the repository go to **Settings > Pages**. Under "Build and deployment" choose **Deploy from a branch**, pick `main` and `/ (root)`, then Save.
4. After a minute your game is live at `https://YOUR-NAME.github.io/silly-duel/`.

### Your own domain (the only cost)
1. Buy a domain from any registrar.
2. In **Settings > Pages > Custom domain** type your domain and Save. GitHub creates a `CNAME` file for you.
3. At your registrar add the DNS records GitHub shows you (four `A` records for the bare domain, or one `CNAME` for `www`).
4. Tick **Enforce HTTPS** once it becomes available. Sound, install-to-home-screen and offline play all need HTTPS.

### Updating the game later
Upload the changed files, then open `sw.js` and change `VERSION` (for example `silly-duel-v2`). Players then get the new version instead of the cached one.

---

## Levels, skins and bosses

Player 1 earns XP from matches. At level 10, 20 ... 80 the XP bar locks and a very hard **boss game** must be beaten. Winning gives a new skin (10 skins in total, 2 are free). Skins are drawn in code in `js/art.js`.

## Online play (free Firebase plan)

Online is optional. Without a config the game works fully offline and ONLINE shows a setup hint.

How it works: Firebase only handles login, the leaderboard, quick-match lobby and the first hello between two phones. After that the two phones talk directly (WebRTC), so moves are live and nothing is relayed through a paid server.

**Setup (about 10 minutes, no credit card):**
1. Go to https://console.firebase.google.com and create a project (turn Google Analytics off).
2. **Build > Authentication > Get started > Sign-in method:** turn on **Anonymous** and **Email/Password**.
3. **Build > Firestore Database > Create database** (production mode, any region).
4. In Firestore open the **Rules** tab, paste the contents of `firestore.rules` from this folder, and Publish.
5. **Project settings > General > Your apps > Web (</>)**, register an app, copy the `firebaseConfig` values.
6. Paste them into `js/firebase-config.js` (replace `null`).
7. **Authentication > Settings > Authorized domains:** add `YOUR-NAME.github.io` (and your own domain if you have one).
8. Upload to GitHub Pages and bump `VERSION` in `sw.js`.

**What is stored:** players: `users/{id}` (name, level, xp, skin, online wins), temporary `lobby` and `rooms` entries that are deleted after the match. No email, no tracking. Login is a name and password (stored by Firebase as `name@silly-duel.app`); a forgotten password cannot be reset.

**Free plan limits:** a match uses a few dozen reads/writes, so thousands of matches a day stay free. The leaderboard reads 20 profiles when opened.

**Honest limits:** scores come from each phone, so a determined cheater could fake online wins (the rules cap how fast they can grow). A few strict networks block direct phone-to-phone links; add a TURN server in `js/firebase-config.js` if you see many "could not connect" reports.

## Fonts

The page loads two fonts (Fredoka and Silkscreen) from Google Fonts. If they cannot load, the game falls back to rounded system fonts and a monospace font and still works. To make it fully self-contained, download the two fonts and add `@font-face` rules to `css/style.css`.

## Add a new microgame

1. Copy `js/games/beat.js` to a new file, for example `js/games/yours.js`.
2. Change `id`, `title`, `tip` (max 3 words) and `icon`, and write the game inside `start(A)`.
3. When the round is over call `A.end([{ p: score, label: 'text' }, ...])`, one entry per player in `A.players` order. Use `A.rand()` instead of `Math.random()` so both phones get the same game online. Bots can use `A.bots`, `A.skill` and `A.tap(i)`. Higher `p` wins, lowest `p` pays.
4. Add the script tag to `index.html` before `js/main.js`, and the file name to `FILES` in `sw.js`.

## Files

```
index.html          page shell
css/style.css       theme (90s memphis pastels + 2000s glossy buttons)
js/storage.js       tiny local save
js/art.js           mascots and icons, all drawn in code
js/audio.js         music, sound effects, laugh track, announcer voice (all synthesized)
js/fx.js            confetti, cream splats, screen shake
js/engine.js        modes, rounds, ties, pie ceremony
js/progress.js      levels, XP, skin unlocks
js/games/*.js       the five microgames and js/games/boss.js (three boss games)
js/net.js           Firebase + direct phone-to-phone link
js/lobby.js         online screen: login, quick match, rooms, leaderboard
js/firebase-config.js  your Firebase config goes here
firestore.rules     paste into the Firebase console
js/main.js          home screen
sw.js, manifest     offline play and install to home screen
```
