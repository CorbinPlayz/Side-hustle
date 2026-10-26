# Multiplayer: where we left off

Written so the work can be picked up cold. Read this first.

## Decisions already made (from the user)
- 2 to 6 players per room code, one shared island and one shared market.
- Everyone builds their **own** base on their own plot. Trading between players is allowed.
- The market is shared: what one player sells moves prices for everybody.
- NPC neighbours (max 8) buy plots as the island earns money. Each sale pushes land prices up harder than the last.
- Progress must **autosave**. Strong preference from the user. Right now it saves to `localStorage` (key `sidehustle.save.v2`) every 8 s, on tab hide and on close.
- Blood is fine (add a gore toggle later). A hidden cartoon fist "fight night" is planned for later, not openly advertised.
- The Cloudflare Worker (accounts, approved list, admin by `ADMIN_ID`) is the deployment target for multiplayer. GitHub Pages is single player only.

## What exists
- `public/world/*`: the single player game (economy, pickups, fishing, logging, plots, snap-grid building, NPC neighbours, landmarks, village market, character creator).
- `worker/src/worldcore.mjs`: **new, not wired in.** Pure room logic for one island: max 6 players, positions, server-priced sales (`sell`), plot claims (`plot` / `plotBuy`), shared market state, news, snapshots at ~15 Hz. Tested by `tests/world.test.mjs` (`node tests/run.mjs` runs everything).
- `worker/src/matchcore.mjs` + `index.mjs`: the old shooter room (`/ws/<CODE>`), a good template for the wiring.

## Next steps, in order
1. **Wire `WorldCore` into a Durable Object** (`World`, one per room code) in `worker/src/index.mjs`, route `/ws/world/<CODE>`, add `World` to `new_sqlite_classes` in `wrangler.toml` (new migration tag `v2`). Drive `tick(dt)` from an alarm or from incoming messages like `Match` does.
2. **Client `net.js` for the world**: join with the room code, send `pos` ~15 Hz, apply `welcome` / `market` / `snap` / `news`.
3. **Make the client use the server market** when online: replace local `eco.mult/supply/event/house` with `market` messages, and send `sell` instead of `eco.sellAll()`. Money, bag, tools and pieces stay on the player's own save.
4. **Remote players**: spawn a `makeCharacter(look)` per remote player (see `character.js`), interpolate `snap` positions, show names. Add `animateCharacter`.
5. **Plot purchase flow**: client sends `plot`, server answers `plotPrice`, client pays from its wallet and sends `plotBuy`. (Money is client-held for now; moving wallets server-side is a later hardening step.)
6. **Server-side saves**: store each account's save JSON in the `Hub` Durable Object so progress follows the login, not the browser. Keep `localStorage` as a fallback and write both.
7. **Room UI**: create/join by code on a small screen before the world loads (reuse the old lobby styling in `play.html` / `css/style.css`).
8. Nice to have: player-to-player trading window, chat, shared building visibility (send `pieces` for each plot so friends can see your base).

## Known gaps and caveats
- Nothing has run on a real GPU or real Cloudflare. Everything was tested in a headless browser and in Node.
- NPC neighbours currently run on each client (`town.js`). Online they must come from the server so everyone sees the same ones (the `house.npcs` list is already in `marketState()`).
- Plot positions are generated from a seeded search (`town.js findPlots`), so every client gets the same plots as long as the seed and terrain match.
- Pickups (shells etc.) are random per client. Fine for now; make them server-seeded if friends should compete for the same shell.
- The waterfall cave interior has not been looked at in person.
- Economy pacing was only simulated with a bot (`/tmp/sim.mjs` idea: first purchase ~7 min, plot + cabin about 70+ min). Needs real play feel.
