# Silly Duel: publish on CrazyGames

Use **this folder** (`crazy-game`) only. This is the CrazyGames build.

- PLAY = a match on this device (the other pad is a simulated player; the UI never says that).
- PLAY WITH A FRIEND = two people, one phone. Level and coins do not change in that mode.
- No MATCH, ROOM, sign-in, TOP 100, Firebase, or Node server.
- Progress uses the CrazyGames **Data** module (cloud for logged-in CrazyGames players, local for guests).

Do **not** upload the main web app (`f:\game\silly-duel` root) or `server/`.

Official portal: [developer.crazygames.com](https://developer.crazygames.com)  
Docs: [docs.crazygames.com](https://docs.crazygames.com)  
Covers and videos: [docs.crazygames.com/requirements/game-covers](https://docs.crazygames.com/requirements/game-covers/)  
Technical limits: [docs.crazygames.com/requirements/technical](https://docs.crazygames.com/requirements/technical/)

---

## 1. Test on your computer

With the Silly Duel server already running, open:

`http://localhost:3000/crazy-game/index.html`

Or from inside this folder, any static server is fine.

Walk through:

1. Intro
2. Home
3. PLAY (full match)
4. PLAY WITH A FRIEND
5. Skins / look
6. POWERS
7. ARENAS
8. MORE (About, Terms, Help, Feedback)
9. Boss at the gated level

Optional SDK test. Add to the address:

- Logged in: `?user_response=user1`
- Logged out: `?user_response=logged_out`

---

## 2. Zip so `index.html` is at the root

The zip must open onto `index.html`, not onto a nested `crazy-game` folder.

Limits (this build is well under them):

- Total size ≤ **250 MB**
- File count ≤ **1500**
- First load ≤ **50 MB** (≤ **20 MB** if you want the mobile homepage)

Use **relative paths only** (this build already does).

### Windows (PowerShell)

From the project root:

```powershell
cd f:\game\silly-duel\crazy-game
Compress-Archive -Path * -DestinationPath ..\silly-duel.zip -Force
```

That writes `f:\game\silly-duel\silly-duel.zip`.

Open the zip and confirm you see `index.html` immediately, next to `js`, `css`, `assets`, `screens`.

---

## 3. Developer account and upload

1. Go to [developer.crazygames.com](https://developer.crazygames.com) and sign up / log in.
2. Click **Submit a game** (or **New game**).
3. Upload `silly-duel.zip`.
4. Open the portal **preview / QA** and run the game as it will on CrazyGames.
5. Fix anything they flag, zip again the same way, then upload the new zip.

---

## 4. Listing text (copy this)

| Field | Text |
|---|---|
| **Title** | Silly Duel |
| **Short description** | Two players. Five silly games. The loser wears the pie. Unlock looks, power-ups and play rooms. |
| **How to play** | Tap PLAY for a match, or PLAY WITH A FRIEND to split one phone. Win the most of 5 mini-games. The loser gets a pie. Beat the boss every 10 levels to unlock new looks. |
| **Controls** | Tap your side of the screen. Keyboard: Q for player 1, P for player 2 (Escape goes back). |
| **Category** | Casual |
| **Tags** | 2 player, party, funny, tap, skill |
| **Platforms** | Desktop and mobile |
| **In-app purchases** | No |
| **Progress save** | **On** — CrazyGames Data module. Do not point them at Firebase or your own server. |
| **Ads** | SDK midgame video after a finished match, plus a 320×50 banner on menu screens (home, MORE, PLAY WITH A FRIEND). Already in this build. |

Credit on MORE → About:

Developed with silliness by [silly-developer](https://akironman.github.io/silly-duel/silly-developer/) [akironman](https://github.com/akironman)

---

## 5. Artwork (required)

### Covers

Three sizes. Same look on all three. Title only.

- Landscape 16:9 — **1920×1080**
- Portrait 2:3 — **800×1200**
- Square 1:1 — **800×800**

Do not:

- Put borders around the cover
- Write anything except the game title (no New, Updated, Play, Play now)
- Put store / social icons on the art
- Use art you do not own
- Use a blurry or pixelated image
- Use a plain in-game screenshot as the whole cover if you can make a stronger title card

Keep important bits out of the top-left corner (CrazyGames can overlay a label there).

### Preview videos

Two videos. Hover previews on the site.

- Landscape 1080p 16:9 (mandatory)
- Portrait 1080p 2:3 (mandatory)
- Length: **15–20 seconds** (longer clips get cut to 20)
- File size: **≤ 50 MB** each
- **No sound**
- Start on your static cover still so the hover feels smooth
- Real gameplay, not a misleading trailer

Avoid:

- Black screen / logo stinger
- Black bars
- Default mouse cursor
- “Play now” or other promo text
- App or social icons
- Fast-forward (they speed the video up themselves)

---

## 6. Submit

1. Fill the form, upload covers and videos, then **Submit**.
2. First step is **Basic Launch** (soft launch with real players). Ads may stay off until **Full Launch**.
3. If QA asks for changes, fix this folder, zip again, upload a new zip to **the same game**.

SDK is already in this build, so you do not need a second SDK pass unless QA asks.

---

## 7. After it is live

Later updates: zip this folder the same way and upload it to the **same** game listing.

**Basic Launch** vs **Full Launch** (CrazyGames process):

- Basic Launch: can go live; SDK ads may be disabled.
- Full Launch: monetization on; they expect SDK gameplay start/stop, Data saves, and no outside login. This build already does that.

---

## What is in this build

- Same skins, arenas, power-ups, mini-games and intro as the main game.
- CrazyGames SDK v3: Data save, silent username if they are logged into CrazyGames, `gameplayStart` / `gameplayStop`, happytime, midgame video after the pie, 320×50 banners on menu screens.
- Fonts: Silkscreen (Fredoka file unused). SIL Open Font License in `assets/fonts`.
