# Rooms (multiplayer)

Rooms are live. From the home page, **Host a room** makes a 5-character code and **Join with a code** takes one. Both open
`world.html?room=CODE` (the host also gets `&host=1`).

## How it works
- `worker/src/index.mjs`: `World` Durable Object, one per code, route `/ws/world/<CODE>`. Needs a signed-in, approved account.
  `wrangler.toml` has the `WORLD` binding and migration `v2`.
- `worker/src/worldcore.mjs`: pure room logic (max 6 players, positions at ~15 Hz, shared market, plot owners, neighbours, news).
- `public/world/net.js`: the client. Sends `hello` (look) and `pos`, applies `welcome`, `joined`, `left`, `snap`, `look`, `market`, `news`.
- Shared by the room: market prices and supply, events, housing index, plot owners, neighbours (NPCs).
- Kept by each player (in their own browser save): money, bag, tools, building, stash.
- While connected `eco.net` is set, so the local market stops ticking and the server's state is used. Sales report supply to the room (`supply`), buying a plot claims it (`plotBuy`).
- No server? (GitHub Pages, or not signed in) the client tries a few times, then plays solo.

## Not done yet
- Chat and emotes.
- Server-side saves per room (everything personal is in localStorage).
- Seeing other players' held tool / fishing line.
