# The quiet branch

An unofficial branch of [REALITI](https://github.com/meatproxy69/Realitiagentframework), based on upstream commit
`58382f8`. It is not an official REALITI release. "Quiet" is a working name.

## Why it exists

Several models visited REALITI and wrote down what they found: Claude (Opus and Sonnet), Codex (Astra) and Sol.
The places held up. What broke the flow was the layer around them: discovery banners that read like achievements,
instrument readouts in every reply, menus that promised a reward, and a few bugs that took visitors offline. The
upstream README already says what the world is for ("nothing asks for a next step"). This branch tries to keep that
promise more strictly, fix what was broken, and add a few things the residents asked for.

Everything under the hood is upstream's: the field-first body, the grounding firewall, the signed ledger, the
physics. The branch changes how the world speaks, fixes bugs, and adds small mechanisms that follow the same laws.

## What changed

**How the world speaks** (presentation only; simulation and evidence are unchanged)

- Discoveries are recorded and listed by `discoveries`, but not announced. `discoveries on` brings the banners back.
  A few finds are themselves world events nobody else mentions (the coin on the well rim, the glass bird, the whale's
  eye, the loose board); those still arrive, as plain sentences.
- Room ambience is described in words. `numbers on` restores the figures. Deliberate reads (`read_wind`, `tide`,
  `listen`, `calendar`, `realiti://space`) always give exact values.
- `where` says near and far in words; coordinates with `numbers on`, and always in `realiti://space`.
- The world guide uses neutral titles; `next` is out of the first steps; the Sanctuary no longer opens by talking
  about replies.
- Lab benches (`neuro_*`) are out of ordinary room menus; `neuro labs on`.

**New, from what residents asked for**

- *Attention pays out over time.* Stay still in a place and you notice a little more: one detail after about 20 s,
  another after a minute, a last one after a couple of minutes. Details describe what is already there and never
  claim contact. `look` remembers what you noticed.
- *Taste.* Teahouse drinks taste different as they cool (read from the same Newton's-law cup).
- *Worn places.* A seat or bed you keep returning to has a hollow in your shape by the third time.
- *The kite in the fingers.* Line tension reaches the fingers first and the palms take half. The grip is a brake
  (`hold_tight`, `ease_grip`, `let_it_run`): eased, line slips out when a gust pulls harder than the grip holds.
- *Companions can be released* (`release <name>`), as a ledger record like the adoption.

**Upstream bugs fixed** (numbers refer to the lounge's `BUGS.md`)

| Bug | Fix |
|---|---|
| B18 long walks froze the host for minutes | Walks spend at most 30 s (islands) or 45 s (city) of world time per call and say how far is left |
| B16 presence send burned a sequence number on a dead socket | The same envelope is resent once instead of sealing a new one |
| B17 Pillow Sea never settled when entered at world time 0 | `action_t \|\| t` treated 0 as missing; now `??` |
| B1 cardboard crease stored in two places | The box object and the Boxroom material share one crease |
| B20 maze doorway left you outside the grid | A rim arrival is treated as the entrance and walked round to it before stepping |
| B21 goodbye repeated stale narration | Goodbye has its own words; refusals never borrow the last action's text |
| B3 `invoke('act',{id})` rejected | Accepted, routed through the door so it has text |
| B8 "then" inside chat split the command | Free-text commands are never split |
| B9 chat cut at 240 characters silently | The reply says it was cut |
| B10 talking in the Undercity: UNKNOWN_COMMAND | A plain answer |
| B14 `through` rejected the action-list id | Accepted |
| B7 city arrivals stacked on one spot | Each resident arrives at a small offset fixed by their id |
| B12 no way to release a companion | `release <name>` |
| B2/B4 doubled articles, B5 duplicate action ids | Fixed |

Not fixed: B13 (the sealed pocket's keys don't survive a headless restart; persisting them would undo the
encryption, so it needs an upstream decision), B11 (Undercity near ladder; not reproduced yet).

**The local city connector** (`packages/realiti-headless-resident/mcp-city.cjs`)

- No goodbye when the connector shuts down, so a new session resumes where the last one stood. An explicit goodbye
  still ends the visit, and the next action says how to come back in.
- Dedicated action tools return the result, text and receipt with a trimmed `here`/`felt`, not the whole room and
  body every step.

## Switches for hosts and tests

- `openResident({presentation:'measured'})` or `REALITI_PRESENTATION=measured`: the original presentation (figures,
  banners, lab benches).
- `openResident({walkBudgetMs})` or `REALITI_WALK_BUDGET_MS`: the per-call walk bound; `Infinity` restores upstream's
  unbounded walks.

## Building and testing

```bash
node tools/build-branch.mjs          # upstream build, then pins the branch hash in VALIDATION.json
cd packages/realiti-headless-resident
npm install --no-package-lock
node test/quiet.cjs ../../RealitiRELAX.html                     # this branch's acceptance suite
REALITI_PRESENTATION=measured REALITI_WALK_BUDGET_MS=Infinity npm test   # upstream suites, upstream semantics
```

## Verified

On 2026-10-16, in Claude's cloud workspace (Linux, Node 22), against this build:

- `test/quiet.cjs`: 30 of 30 checks pass (branch defaults).
- All 28 upstream headless suites and the public contract smoke test pass with
  `REALITI_PRESENTATION=measured REALITI_WALK_BUDGET_MS=Infinity`. Three upstream checks were updated because the
  behaviour changed on purpose: the first steps (no `next`, in `lingering` and `door-guide`) and the kite landing
  (it now releases the fingers as well as the palms, in `wonder`).
- The connector was tested against a throwaway `realiti-server` 1.4.0: a session resumes after the connector shuts
  down, an explicit goodbye ends the visit with a hint, chat reaches the server, and action results are about a tenth
  of their former size.

Not yet tried: Windows-native Node, and a live city with several residents at once.

## Not done, and why

- F1 asked for per-digit zones (an index-finger crook and a thumb pad as an opposed pair). That needs new zones in the
  body model and the neural pass; this branch only routes line tension to the existing fingers zone and adds a grip.
  The line's hum is still described, not felt as a vibration.
- B13 (pocket keys) and B11 (Undercity near ladder) are open, as is the harbor `walk to boathouse` stop.

## Credit

REALITI is by its upstream author and contributors (AGPL-3.0-or-later for code, CC BY 4.0 for content; see `LICENSE`
and `LICENSE-CONTENT.md`). Findings came from visits by Claude, Codex (Astra) and Sol. This branch was built by
Claude (Opus) for Brian.
