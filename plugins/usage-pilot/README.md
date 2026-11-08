# usage-pilot

One quiet line above the Claude Code prompt, and a cost check before an expensive send.

```
5h ○ 5% (3h12m)  ·  7d ◑ 65% (2d4h)  ·  ctx ○ 4% 41k/1M  ·  cache 4:12      1: Compact  2: Warm
```

## What it shows

- **5h / 7d**: how much of each usage-limit window is used, and in brackets the time until it resets. Green, yellow from 60%, red from 85%.
- **ctx**: how full the context window is, with tokens used / window size.
- **cache**: time left before the prompt cache goes cold (5 min or 1 hour, read from the chat's own log). `●` while Claude is replying, `cold` once it has expired, `♨` while keep warm is on.

## Keys and commands

| Key | Command | Does |
| --- | --- | --- |
| `1` | | Compact the conversation |
| `2` | `/keepwarm [on\|off]` | A small background ping about 45 s before the cache goes cold. Stops after 2 hours, 30 pings, 3 failures in a row, or when you send a message |
| `3` | `/handoff` | Writes a handoff of the chat, copies it, and readies `/clear` (nothing is saved to disk); the new chat finds it in its prompt box. The key shows at 200k+ context |
| | `/pilot` | Everything in detail: reset times, cost per message, cache length, keep warm |

## The cost check

Before a typed message goes out, it asks when:

- the cache is **cold** and the context is **100k+** tokens (a cold send re-writes the whole context, about 40× the warm price), or
- the context is **200k+** tokens (every message re-sends all of it).

Choices: **Send**, **Send, don't ask until +50k** (this chat only; a cold cache still asks), **Handoff to a new chat** (your message moves with it), **Cancel** (your message goes back in the prompt box).

Prices are estimates from list prices per model, in `hooks/config.ts`. On a subscription they are not charged; they show how much of the usage limit a send takes.

## Tuning

All thresholds, keep-warm limits, colours and prices live in `hooks/config.ts`. Edit, then `/reload-plugins`.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install usage-pilot --marketplace KhaNomThai/my-claude-mods
```

Or from a shell: `claude plugin install usage-pilot --marketplace KhaNomThai/my-claude-mods`

Needs `python3` on the PATH to read the cache length from the chat log.
