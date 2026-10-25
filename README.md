# Side Hustle

A first-person 3D loot shooter for two players. Everything runs on one Cloudflare Worker, with no other services:

- **Accounts, levels, leaderboard, admin approval** live in a Durable Object (SQLite) on Cloudflare.
- **Every match runs on the server.** Your browser sends inputs and draws what the server says. It does the 3D drawing only.
- **Nobody sees any page, script or image without an approved account.** The Worker checks the login before it serves any file. Only the sign-in page is public.
- **Only one admin.** The account whose user ID you put in `ADMIN_ID`.

## Deploy (about 10 minutes)

1. Install Node 20 or newer. In this folder run `npm install`.
2. Optional: set `SIGNUP_CODE` in `wrangler.toml` so only people you give the code to can request an account.
3. `npx wrangler login`, then `npx wrangler deploy`. Wrangler prints your site address.
4. Open the site, choose Create account and register yourself. The "waiting for approval" screen shows **your user ID**.
5. Put that number in `wrangler.toml` as `ADMIN_ID = "<your id>"` and run `npx wrangler deploy` again. That account is now approved and is the only admin. Nobody else can ever become admin, because admin is decided by that ID in the config and not by anything a visitor can do.
6. Everyone else registers, waits on the approval screen, and shows up in `/admin.html` under Waiting. Approve or block from there.

Alternatively, push this folder to GitHub and use Workers > Create > Import a repository in the Cloudflare dashboard (build command: none, deploy command: `npx wrangler deploy`).

Run it locally: `npx wrangler dev`.

## How it works

| Piece | File |
|---|---|
| Router, login gate, security headers, Durable Object classes | `worker/src/index.mjs` |
| Accounts, sessions, throttling, XP, leaderboard, admin rules | `worker/src/hubcore.mjs` |
| One room: seats, settings, 60 Hz simulation, snapshots, XP report | `worker/src/matchcore.mjs` |
| Game rules and world (shared by server and browser) | `public/js/sim.js`, `public/js/data.js` |
| 3D drawing, sound, UI | `public/js/render.js`, `game.js`, pages |

Passwords are hashed with PBKDF2 (100,000 rounds, per-user salt). Sessions are random tokens in HttpOnly, Secure, SameSite cookies, stored hashed. Five wrong passwords lock a username for ten minutes. XP is credited only by the server, only for matches of 45 seconds or more.

## Tests

`npm test` runs account rules, the router with a fake Cloudflare environment (login gate, admin-only, CSRF) and a full server-side match. `tests/browser/` has Playwright scripts that drive the real pages against the real match logic.

## Honest limits

- Built and tested without access to the real Cloudflare runtime or a real GPU. Run through the deploy steps and play a match with a friend before you rely on it.
- Rendering is in the browser, so approved players do receive the game's code and assets. Unapproved visitors do not.
- Accounts need approval, but one person could still make several accounts to farm XP if you approve them all.
- Durable Objects (SQLite) need a Cloudflare account; check Cloudflare's current pricing and free-plan limits for your expected traffic.

## Publishing the `public/` folder on GitHub Pages

Pages serves static files only, so on Pages you get the pages and demo mode (no login gate, no accounts, no online rooms). The Worker above is what provides those.

1. On GitHub choose New repository. The name becomes the address: `https://<your-username>.github.io/<repo-name>/`. Name it `<your-username>.github.io` instead to get the plain `https://<your-username>.github.io/`.
2. Upload the **contents of the `public/` folder** (index.html, css, js and so on) to the repo root, not the whole project.
3. Settings > Pages > Build and deployment > Deploy from a branch > `main` and `/ (root)` > Save. It goes live in a minute or two.
4. All links in the site are relative, so the repository-name sub-path works without changes.

## The game so far (single player)

`public/world.html` loads `public/world/*.js` (three.js 0.186 from cdnjs): a low-poly forest island with a dock, fishing (cast, bite, reel minigame), logging with an axe timing minigame, mushroom and glowcap foraging, one market with drifting prices for everything you gather, gear upgrades and a bag limit. Progress saves in the browser. Multiplayer, the other biomes, jobs and fight night come next.

## Play it on GitHub Pages

This repo deploys the `public/` folder to GitHub Pages automatically on every push to `main`. One-time setup: Settings > Pages > Build and deployment > Source > **GitHub Actions**. Then open `https://<your-username>.github.io/Side-hustle/world.html`.
