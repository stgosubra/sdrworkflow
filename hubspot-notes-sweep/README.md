# hubspot-notes-sweep

Automation that reads the AE's recent Modjo calls and writes one polished HubSpot note per call, pinned to the right contact. Runs on a 30-minute cadence during working hours and self-audits daily.

All operational constants (userIds, portal id, owner id, Slack channel, MCP server IDs) are redacted and expressed as `${VARIABLE}` placeholders. See `.env.example` for the full list. Real call IDs, contact IDs, note IDs, prospect names and company names in the worked examples are replaced with `<CALL_ID_N>` / `<CONTACT_N>` / `<COMPANY_N>` / `<NOTE_ID_N>` tokens.

---

## What it does

For every new Modjo call the AE conducts, the sweep:

1. Pulls recent calls from Modjo filtered to the AE's `userId`.
2. Dedup-checks each call against the HubSpot note association graph (real-time), using a `callsync<callId>` substring marker inside `hs_body_preview`.
3. Classifies the call into one of four buckets based on transcript substance and `phoneProvider`:
   - **Bucket 1 - Qualif BRIEF** - qualified demo with discovery content, includes BANT + MEDDPICC scoring
   - **Bucket 2 - DISCOVERY RECORD** - cold or exploratory call with real conversation
   - **Bucket 3 - CALL LOG** - operational call (scheduling, follow-up, short exchange)
   - **Bucket 4 - NO SHOW** - scheduled meeting the counterpart didn't attend
4. Resolves the counterpart contact via a five-step anchor chain (crmLink -> attendee email -> attendee phone -> company domain -> calendar event / call-name token).
5. Writes a single formatted note into HubSpot, associates it to CONTACT + COMPANY (+ DEAL if present), and pins it.
6. Fires one Slack message per note written. Fires a second Slack message with the BANT+MEDDPICC scoring grid for Buckets 1 and 2. Fires a third-channel escalation only on first-encounter contact-identification failures.

The sweep never rewrites existing notes. Once a call has any note, it is skipped forever. Supersede was removed intentionally.

---

## Cadence

Driven by a Claude Code scheduled task running on a cron expression with a wall-clock skip gate.

- **Days:** Monday-Friday, Europe/Madrid.
- **Window:** 09:00-18:00.
- **Interval:** every 30 minutes.
- **Skipped slots:** 09:00, 13:00, 13:30, 14:00 (start-of-day calendar sync and midday break).
- **Heartbeat:** 17:52 Europe/Madrid - a single `HEARTBEAT | <n> sweeps today, <m> notes written, <k> parked` line to the notes channel.
- **Audit:** 17:30 Europe/Madrid - the `hubspot-notes-eod-audit` agent runs once (model: opus) and reconciles the day.

A single-writer file lock (`sweep.lock`) prevents overlapping sweeps. If the lock timestamp is under 15 minutes old, the current invocation aborts silently.

In practice: ~15 sweep fires per working day, plus one audit and one heartbeat.

---

## Tool connections

All tool addressing uses MCP server-id placeholders. The real IDs live in your Claude Code `.mcp.json`.

| Purpose | Server | Tools used |
|---|---|---|
| Call metadata, transcripts, calendar | `${MCP_MODJO}` | `get_calls`, `get_transcript`, `get_calendar_events` |
| Note write, contact/company/deal lookup, note dedup | `${MCP_HUBSPOT}` | `manage_crm_objects`, `search_crm_objects`, `query_crm_data` |
| Status pings and heartbeat | Slack incoming webhook (file at `${SLACK_WEBHOOK_PATH}`) | plain `curl` POST, one message per event |

No direct HubSpot API calls, no email, no deal modification, no `hs_lead_status` writes. The sweep is strictly a note-writer.

---

## Repo layout

```
hubspot-notes-sweep/
├── README.md                        this file
├── .env.example                     required variables
├── scheduled-task/
│   └── SKILL.md                     cron wrapper + wall-clock skip gate
├── agents/
│   ├── hubspot-notes-sweep.md       the subagent (model: sonnet) - runs the sweep
│   └── hubspot-notes-eod-audit.md   the auditor (model: opus) - 17:30 daily
├── skill/
│   ├── SKILL.md                     the brain - buckets, anchor chain, write path
│   └── references/
│       ├── edge-cases.md            worked exceptions, speaker-attribution traps
│       └── formatting.md            HTML spacing, bucket order, write-call shape
└── state/
    └── state.example.json           sweep state schema (lastSuccessfulRun, parked map)
```

---

## State

Two files persist between runs:

- **`sweep.lock`** - single ISO timestamp. Guards parallel writers. Written at the top of each sweep, cleared on normal exit by overwriting with an empty string (never `rm`, since org policy blocks destructive Bash and the sweep must not prompt).
- **`state.json`** - `{ lastSuccessfulRun, parked: { callId: retryCount } }`. The window pointer and the parked-call retry counter. See `state/state.example.json` for the schema.

Parked calls (`NEEDS_REVIEW` or `NEEDS_ANCHOR` terminal states) retry up to twice. On the third encounter they are abandoned, no Slack fired, no transcript fetched - the AE sees them in the audit roll-up.

---

## Guardrails

Hard rules baked into both the skill and the agent prompts:

- **AE's calls only.** `userId: ${MODJO_USER_ID}` on the Modjo pull, plus a presence-in-transcript check on the write. The owner filter alone lets colleague calls through - known cases documented in `skill/references/edge-cases.md`.
- **Notes only.** Never writes `hs_lead_status`, never sends or drafts email, never touches deals.
- **Never overwrites or archives sibling notes.** Three other automations also write a note per Modjo call. Read them, reconcile, leave them alone.
- **Dedup via associations, not search index.** The HubSpot search index lags writes by minutes and produced two live duplicate notes before dedup was moved to the association graph. See the inline note in `agents/hubspot-notes-sweep.md`.
- **No supersede.** Any existing note on the call = skip. The sweep is append-only against the association graph.
- **Refuse team-wide requests.** If asked to sweep another rep or everyone, decline and explain why.

---

## Setup (sketch)

1. Fill `.env.example` with your real values and source it, or wire the equivalents into your Claude Code environment.
2. Copy `scheduled-task/SKILL.md` into `~/.claude/scheduled-tasks/hubspot-notes-sweep/SKILL.md`.
3. Copy `agents/*.md` into `~/.claude/agents/`.
4. Copy `skill/` (its `SKILL.md` + `references/`) into `~/.claude/skills/hubspot-notes/`.
5. Copy `state/state.example.json` to `state.json` next to the skill (same directory as `sweep.lock`), seeded with your desired start timestamp.
6. Create a Slack incoming webhook, write its URL into the path at `${SLACK_WEBHOOK_PATH}`.
7. Register the scheduled task through Claude Code (`mcp__scheduled-tasks__create_scheduled_task` or the equivalent in your UI) with the cron expression documented in `scheduled-task/SKILL.md`.

---

## Non-goals

- Not multi-tenant. Hardcoded to a single AE via `${MODJO_USER_ID}` and `${HUBSPOT_OWNER_ID}`.
- Not a CRM-cleanup tool. Does not touch stale leads, status transitions, or deal lifecycle.
- Not an outreach tool. Writes zero emails.
- Not an archiver. Never deletes, never archives, never modifies prior notes.
