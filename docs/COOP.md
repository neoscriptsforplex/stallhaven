# Co-op prototype (up to 4 players, invite codes)

**Status:** prototype on branch `net/coop-prototype`. Not merged, not deployed. No Cloudflare account is used:
everything runs locally with `wrangler dev`.

## Try it locally (two browsers)

```bash
npm install
npm --prefix party install          # room server deps (wrangler, partyserver)
npm run coop:server                 # terminal 1: room server on http://127.0.0.1:8787
npm run dev                         # terminal 2: game on http://localhost:5173/stallhaven/
```

1. Open `http://localhost:5173/stallhaven/` in a normal window. Click **Co-op** (next to ♪), then **Create invite code**.
2. Open the same URL in a **private window or another browser** (two tabs in one browser share
   `localStorage`, so the "guest's solo save" would be the host's own save). Co-op → **Join with code**, type the code, then **Join**.
3. Buy or craft something in either window: coins, chest and materials change in both. Travellers come from the room.
4. Host: **End party** asks for confirmation, then the guest sees "Party ended" and gets their own shop back.

To point the game at another room server, build with `VITE_ROOM_SERVER_URL=https://…`. The live Pages site serves
`src/` unbundled, so it can't read `import.meta.env`; add `<meta name="stallhaven-room-server" content="https://…">` to `index.html` instead.

## Tests

```bash
npm test             # all unit tests, including src/coop (room rules, net client against an in-process room)
npm run test:coop    # starts wrangler dev on 127.0.0.1:8797 and drives up to 5 WebSocket clients
npm run build
```

## Layout

| Path | What |
|---|---|
| `src/game/intents.js` | Every player action is an intent object; `applyIntent()` is the one function that changes the shop (solo, client and server). |
| `src/game/autosave.js` | localStorage autosave every 10 s and on tab hide; loaded on start. |
| `src/game/customerSim.js` | Customer rules without three.js (spawn plan, timeouts) and the room's customer simulation. |
| `src/game/rng.js`, `clock.js` | Injectable randomness and time. |
| `src/game/remoteKeepers.js` | Other players' shopkeepers (colour ring and name). |
| `src/coop/protocol.js` | Shared constants: code alphabet, limits, close codes, name rules. |
| `src/coop/sharedState.js` | Which state keys are shared, and diff/patch helpers. |
| `src/coop/roomCore.js` | The room rules (pure JS, unit-tested). |
| `src/coop/net.js` | The client. Loaded only when you host or join. |
| `src/coop/coopUi.js`, `coop.css` | UI per Youi's SPEC rev 3. |
| `party/` | Worker and Durable Objects (`CoopRoom`, `JoinGate`), `wrangler.jsonc`, end-to-end test. |

Env vars: `VITE_ROOM_SERVER_URL` (client), `ALLOWED_ORIGINS`, `ROOM_MAX_PLAYERS`, `ROOM_IDLE_TTL_SECONDS` (server, set in `party/wrangler.jsonc` `vars`).

## How sync works

* The **room is authoritative**. It holds the shop state (seeded from the host's save), runs crafting timers,
  material ticks and travellers, and validates every intent with the same `applyIntent()` the game uses (`coop: true`: cheats are off, prices
  come from the room's customer, and gathering has a per-player cooldown).
* Clients apply their own intent at once (optimistic) and send it. The room acks it. On a reject, the client gets a full `patch` back, which overwrites its guess.
* After each change, the room sends a `patch` with the whole top-level keys that changed (`gold`, `chest`, `displays`, `furniture`, …, `crafts`).
  Craft times are room seconds; the client converts them with a clock offset measured by ping.
* Movement sends only click destinations (`move`); each client walks the other keepers along its own nav mesh.
* Other players use the same model as your own keeper (the game's default path: bundled rigged player, then the bundled OBJ, then the procedural keeper),
  with the same Walk/Idle clips and the Mine/Chop/Pick clips from `act`. Their party colour is shown by a ring at their feet and their name tag colour.
  If the local model changes (e.g. the bundled player finishes loading), the remote keepers are rebuilt with it. Uploaded custom player models stay local to the uploader.
* The host's browser keeps autosaving the shop, so the host keeps their progress. A guest's autosave is paused while they're in a party, and their own save is loaded again when it ends.

### Client → server

| `t` | Fields | Notes |
|---|---|---|
| `hello` | `v, name, hostKey?, token?, save?` | First message. The host sends the `hostKey` from `POST /api/rooms` plus its autosave. A rejoin sends `token`. |
| `intent` | `n, intent` | `intent` is the same object as `applyIntent()` takes. |
| `move` | `x, z, scene` | Click destination. |
| `act` | `mode, yaw` | Gather animation cue: `mine`, `chop`, `pick` or `null`. A move clears it. |
| `ping` | `c, ms?` | `c`: client clock. `ms`: last measured RTT (shown to others). |
| `resync` | | Ask for a full patch. |
| `kick` | `id` | Host only. Bans that player's token (and IP when it differs) from the room. |
| `leave` | | Guest: leaves. Host: ends the room (`host_ended`). |
| `end` | | Host only: ends the room (`host_ended`). |

### Server → client

| `t` | Fields |
|---|---|
| `join_ok` | `code, you{id,name,color,host,token}, players[], snapshot{shared, crafts, customers, serverNow}` |
| `join_error` | `reason` (`not_found`, `room_full`, `kicked`, `bad_code`, `bad_name`, `rate_limited`), `retryAfter?` |
| `ack` | `n, ok, reason` |
| `patch` | `set{key: value}, serverNow, full?` |
| `cust` | `op: 'add', customer` or `op: 'leave', id, reason, by?` |
| `move` | `id, x, z, scene` |
| `act` | `id, mode, yaw` |
| `evt` | `kind, by, text` (log line, e.g. "Sam sold Bread.") |
| `player_joined`, `player_left`, `player_dropped`, `player_reconnected` | `player{id,name,color,host,connected,ms,pos,act}` |
| `pings` | `list[{id, ms}]` every 2 s |
| `pong` | `c, serverNow` |
| `host_waiting` | `secondsLeft` (120 when the host drops, then every 15 s) |
| `room_ended` | `reason` (`host_left`, `host_ended`, `kicked`, `room_closed`) |
| `error` | `reason` (`too_big`, `rate_limited`, `bad_json`, …) |

Close codes: 4000 ended, 4001 kicked, 4002 replaced (same player opened another tab), 4003 join error, 4008 abuse, 4400 bad message.

### Net → UI events (what `coopUi.js` listens to)

`room_created {code}`, `join_ok {code, you, players[]}`, `join_error {reason, retryAfter?}` (+ `offline` when the server can't be reached),
`player_joined | player_left | player_reconnected {id,name,color}`, `player_dropped {id,name,color}`, `players {players[]}`,
`ping_update {id, ms}`, `connection_lost`, `reconnect_attempt {n, max}`, `reconnected`, `host_waiting {secondsLeft}`,
`room_ended {reason, self?, host}` (`self: true` for your own Leave/End: no modal), `status {status}`, `rejected {reason}`.

States: `solo → connecting → hosting | in_game ⇄ reconnecting → ended → solo`.
Reconnect: 5 tries after 2, 5, 10, 18 and 25 s (about 60 s total). The room holds a dropped player's slot for 2 minutes.

### Limits

* Codes: 6 characters from `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`. Max 4 players; colours red, blue, green, purple in slot order.
* Names: 1–16 letters, numbers or spaces. Duplicates get ` (2)`.
* Messages: 4 KB (hello 512 KB, since it carries the save). Each connection gets a token bucket (burst 40, 20/s), and repeated flooding closes it with 4008.
* Joins: 5 bad codes per minute per IP lock joining for 60 s (`rate_limited` + `retryAfter`). Room creation: 10 per minute per IP.
* Idle: an unopened room closes after `ROOM_IDLE_TTL_SECONDS` (default 900). Dropped guests are removed after 2 min, and a dropped host ends the room after 2 min (`host_left`).
