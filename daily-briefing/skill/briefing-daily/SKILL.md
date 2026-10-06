---
name: briefing-daily
description: Refresh the daily-briefing dashboard - modules 01 (Today), 03 (Performance), 04 (Self-Served). Use for the weekday morning refresh, when the app shows a STALE banner, or when asked to re-run all modules. Pulls live HubSpot/Calendar/Gmail/Lusha data and writes each data.js through its generator.
---

# briefing-daily

Refresh runtime for the daily-briefing dashboard. The checkout location is
`projectPath` in `config.local.json` - never hardcode it. Runs unattended
each weekday morning as the `briefing-daily` scheduled task, and on demand.

Three modules, in this order: **01 Today -> 03 Performance -> 04 Self-Served**.

## The spec owns the data contracts, this file owns the procedure

`REFRESH_SPEC.md` in the repo is the source of truth for metric definitions,
funnel math, cohort rules, payload shapes, `/hs` discipline and the validation
gate. **Read it before pulling.** It versions atomically with the generators, so
it is right when this file might be stale. Do not restate its numbers here.

This file owns only: run order, guardrails, PII rules, failure behaviour.

## Config

`config.local.json` alongside this file. Never inline the ids into a query -
read them from there.

## Step 0 - preflight (always, before any pull)

One cheap read-only call per connector, in this order, to establish reachability
before committing to a long pull:

1. **Calendar** - list today's events.
2. **HubSpot** - one trivial aggregate, e.g.
   `SELECT COUNT(*) FROM CONTACT WHERE hubspot_owner_id = '<ownerId>'`,
   reading `<ownerId>` from `config.local.json`.
3. **Gmail** - one thread search.
4. **Lusha** - one company lookup on `cloudtalk.io`.

Then apply the reachability rules below: **Calendar or HubSpot unreachable means
stop before pulling anything.** Report which connectors answered.

Two reasons this is not redundant with the pull itself. It fails in seconds
rather than after a long HubSpot aggregation, and on a manual run it surfaces all
four permission prompts up front instead of stalling mid-refresh.

Sequential, not parallel. Parallel calls make a stall impossible to attribute to
a specific connector.

## How a refresh works

Option A: Claude is the runtime. The app is static - no runtime fetch, no stored
credentials. Per module:

1. Pull live data through approved connectors, per the spec's per-module section.
2. Assemble the module's exports as a JSON payload in a temp file.
3. Hand it to the generator, which validates and writes:

```
node scripts/gen-briefing.mjs   <payload.json>
node scripts/gen-performance.mjs <payload.json>
node scripts/gen-selfserved.mjs  <payload.json>
```

Run these from the project root.

**Never hand-edit a `data.js`.** The generators own those files. Writing one
directly bypasses the shape checks, the reconciliation gates and the atomic
backup - which is exactly how a plausible-looking wrong number ships. If a
generator rejects the payload, fix the payload.

## Module 01 ships first - hard gate

`gen-briefing.mjs` must have written `briefing/data.js` successfully **before a
single module 03 or 04 query is issued.** Not "01 first in the list" - 01 first,
finished, on disk, verified.

Why: module 01 is the only time-critical module. It briefs calls happening in the
next few hours, so a run that spends its first twenty minutes on YTD aggregations
and then dies has failed at the only thing that could not wait. 03 and 04 are
trend data and tolerate being a day old; 01 does not tolerate being an hour late.

So:

1. Do 01 completely - pull, payload, generator, confirm the write succeeded.
2. Only then start 03.
3. Then 04.

**If 01 fails, stop the run.** Do not fall through to 03/04. A failed 01 is the
headline, and burying it under two successful module reports is how it goes
unnoticed. Report the failure and stop. (Trade-off accepted deliberately: a thin
prose card costs you that morning's 03/04 refresh too. 03/04 keep yesterday's
data and the STALE banner says so.)

If 01 succeeds and 03 later fails, continue to 04 - at that point the critical
work already shipped.

## Guardrails

- **Modules 03/04 pull via the `/hs` skill, not raw MCP calls.** Aggregate
  server-side with `GROUP BY` + `COUNT(*)`/`SUM(...)`. Pulling rows and counting
  client-side undercounts.
- **One query per metric, spanning the whole window.** Never loop a query per
  month - it returns identical output at 8x the round-trips and no gate catches
  it. See the spec's `/hs` discipline section.
- **Parallelize the module 03/04 aggregations**, 4-6 concurrent. They have no
  interdependencies, the run is latency-bound, and a tight pull window reduces
  count skew. The Step 0 preflight stays sequential.
- **Every module 01 card gets Lusha enrichment attempted** - carryover cards too,
  not just new ones. A miss is fine if declared in `dataGaps`; not trying is not.
- **A real qualification call is a Modjo note** in HubSpot (NOTE with
  `source=INTEGRATION`), not a booked meeting date.
- **Never pull lead status `ATTEMPTED_TO_CONTACT`** - it means "Qualified Out"
  (~1135 records) and is not part of any cohort here.
- **Points quota is 90/month.** If you see `80` anywhere in `gen-performance.mjs`
  or a `data.js`, that is stale - flag it, do not silently carry it.
- **Declare gaps, do not fill them.** An unreachable connector or a missing field
  goes in `dataGaps` for the user to judge. Never invent a value to satisfy a
  gate.
- **Do not widen the pull scope** to make a number look better. The cohort
  definitions in the spec are deliberate.

## Prose gates on module 01

`gen-briefing.mjs` hard-rejects any card with an empty `companyBrief`, an empty
`challengerInsight`, fewer than 5 `qualifierQuestions`, or a question missing
`key`/`label`/`hint`/`why`. This is why the refresh needs an LLM in the loop and
cannot be a plain script. Thin prose aborts the run rather than shipping a weak
brief - that is the intended behaviour, not a bug to work around.

## Connector degradation

- **Calendar unreachable: stop.** Module 01 produces nothing without it. Report
  and leave the existing data in place.
- **Gmail unreachable: continue.** `lastEmail` becomes null; the card render
  guards on it.
- **Lusha unreachable: continue.** Record the miss in `dataGaps`.
- **HubSpot unreachable: stop.** All three modules depend on it.

Module failure is asymmetric, per the hard gate above: a failed **01 stops the
run**; a failed 03 continues to 04. Report which succeeded.

## PII

`data.js` holds live customer names, emails and phone numbers. It is gitignored
and stays local.

- Never commit a `data.js`, never paste its contents into a report, a log, a
  commit message or a chat summary.
- Task reports are **counts only**: "01 refreshed, 7 cards, 2 dataGaps". No
  names, no emails, no note contents.
- The repo is public so it can be installed by teammates, and that is only safe
  because no `data.js` is ever tracked. Pushing source is fine; pushing a
  `data.js` is not. Before any push, confirm `git status` shows no module data
  file staged. `.gitignore` enforces this - do not weaken it.

## Failure behaviour

The generator backs up, writes atomically, re-imports to prove the file parses,
reconciles, and restores the backup on any failure. So a failed run leaves
yesterday's data fully intact and the app's STALE banner shows it.

On failure: report what broke and stop. Do not retry blindly, do not hand-patch
`data.js`, do not relax a gate to get a green run.

## Verify

After all three, start the preview (`preview_start`, using `previewName` from
`config.local.json`) and
confirm no console errors and no STALE banner. Use the serverId that
`preview_start` returns - it changes on every restart.

## Report

Counts only, plus:

- one line for the preflight, e.g. `preflight: calendar ok, hubspot ok, gmail ok, lusha ok`
- one line per module, e.g. `01 refreshed: 7 cards, 2 dataGaps`
- any module skipped and why
