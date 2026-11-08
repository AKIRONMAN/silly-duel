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

## Google login and the Top 100 board
- In Firebase: Authentication, Sign-in method, turn on **Anonymous** and **Google** (Email/Password is not used). Add your site under Authentication, Settings, Authorized domains.
- The home screen has a **TOP 100 PLAYERS** button. It shows the best online win counts and needs the Firebase config.

## Levels, coins and buttons (step 1 of the big update)
- Only RANDOM online matches (PLAY ONLINE) change level and coins. Bot, same-phone and friend-room games give nothing.
- 10 progress points = 1 level. Win +1 (+2 vs a higher level). Lose to an equal or lower level: -4 points, level drops only if the bar was empty. Lose to a higher level: -1 point, never a level.
- Matching: your level up to 3 levels above (level 2 meets level 2 to 5).
- Coins: +2 to +5 per game won (faster = more), -1 per game lost, +10 for winning the match, -5 for losing it. Never below 0.
- Home: OFFLINE PLAY, PLAY ONLINE, CREATE A ROOM, TOP 100 PLAYERS. Account / sign in moved into the gear (settings) screen.

## Step 2 and 3 - power-ups, 10 games, loadout
- Home shows only you. OFFLINE PLAY opens a popup to pick player one and player two. Keys: Settings > KEYS.
- A match is 5 random games out of 10 (FREEZE, DODGE, BEAT POP, PINATA, HOT BOMB, FLAPPY FACE, LILY HOP, STACK IT, TIGHTROPE, SWEET OR BOOM).
- POWER-UPS shop: buy with coins, a level unlocks each one. 5 common + 10 game powers (one per game). Max 9 of each.
- Loadout: before game 1 and again after game 3 you carry up to 2 power-ups (8 seconds to choose, up to 2 slots).
- Using them: at the start of every game cards appear on your side with what each does. Tap a card to switch it on (it says ON!). Cards say ONLY IN <GAME> when they do not fit this game.
  - COMMON: SECOND CHANCE (a lost game becomes a draw), LUCKY TIE (a drawn game is your win), DOUBLE POINT (+2), STEALER (rival -1), HEAD START (+1 point at once). Used up only when they kick in.
  - GAME power-ups are used up when you switch them on in their game.
  - When one kicks in, the result says what happened (for example SECOND CHANCE: LOSS = DRAW).
- The red EXIT button in the middle of the screen leaves the match (it asks first). The pick screen has LEAVE.
- Colours: you are always BLUE, your rival (player two offline, the other person online) is always PINK. Online your side says YOU.
- When a power-up kicks in you see it: a big icon and words pop on your side (the umbrella is drawn over your head in DODGE).

## Level difficulty and game packs (Step 4)
- The games get harder with level: narrower windows, faster pies and guards, shorter fuses, stronger wind, more bombs. Bots get better too, and from level 45 they are almost perfect. Online, both phones use the average of the two levels, so the games are identical.
- The game mix depends on the level (see js/pools.js). Level 1-19: the first 10 games. Level 20: 5 new games (KNIFE LOG, ZIGZAG, SKIP ROPE, ECHO BEAT, MOON LANDING) and the 4 simple games (PINATA, SWEET OR BOOM, BEAT POP, DODGE) show up about 1 time in 10. Level 30 pack, level 45 era and level 48 games come next; until they exist their share goes to the other games.
- Each new game has its own power-up (15 game power-ups now). The shop has a GAMES 11-15 tab.


## Skins, power-ups and play rooms by level
- Every skin has a level and a coin price (BUBBLES/NOODLE free, WAFFLE LV3 60 ... KING LV30 450, DRAGON LV40, GALAXY LV44, GOLDEN LV48 1200). Below its level a skin is a blurred shadow with '???'. At its level you can buy it with coins. The old boss gate is switched off (`BOSS_GATE` in js/progress.js).
- Power-ups below their level are shown as shadows too; once the level is reached they need coins.
- Play rooms (js/arenas.js, css/arenas.css): level 1, 5, 10, 15, 20, 25, 30, 37, 44, 48 (GOLDEN THRONE is the best). The newest unlocked room is used automatically; the ROOMS button on the home screen lets players pick another one they own.

## Skin rarity
Six tiers (COMMON, UNCOMMON, RARE, EPIC, LEGENDARY, MYTHIC) set in `TIER_OF` in js/art.js, with glow/aura styles in css/skins.css. 16 skins: new UNICORN (LV27), PHOENIX (LV36), PRISM (LV50).

## Music per skin
js/audio.js composes one original song per skin (16 themes: scale, tempo, chords, instruments, drums) with a seeded generator, so there are no audio files and nothing to license. The menu uses a calmer version, matches the full version. Tap a skin in the wardrobe to hear its song.


### Skins (creatures)
All 16 skins are creatures with soft square heads: KITTY, PUPPY, BUNNY, FROGGY, PANDA, FOXY, OWLY, ROBO, ALIEN, LION, DRAGON, ASTRO, TIGER, UNICORN, PHOENIX, ANGEL (same ids, levels, prices and rarity as before). Drawn in `body()` in js/art.js.

### Online (server, no login)
js/party.js talks to server/server.js (no dependencies, `npm start`). Instant match, friend rooms up to 10, knockout bracket with READY, live watching and a shareable trophy. Works on local wifi or a hotspot with no internet, or deployed online. See SERVER-GUIDE.txt. The CrazyGames build does not include it.
