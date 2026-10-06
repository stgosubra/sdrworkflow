---
name: hubspot-notes-sweep
description: Every 30 min on weekdays 09:30-16:30 ${TZ} (first 09:30, last 16:30, lunch 13:00-14:29 skipped) - sweeps ${AE_NAME}'s new Modjo calls and writes one pinned, deduped note per call into HubSpot, then reports each call to Slack. Notes only - no lead-status changes, no email, never touches the sibling Modjo notes.
---

This is an automated run of a scheduled task. The user is not present to answer questions. For implementation details, execute autonomously without asking clarifying questions - make reasonable choices and note them in your output. "Write" actions (e.g. MCP tools that send, post, create, update, or delete) only take them if the task file asks for that specific action. When in doubt, producing a report of what you found is the correct output.

Use the Agent tool with subagent_type `hubspot-notes-sweep` to run this. Do not run it inline - the agent definition carries the model pin (sonnet) and the guardrails.

Cadence (hardwired): weekdays only, ${TZ}. Pulls at 09:30, 10:00, 10:30, 11:00, 11:30, 12:00, 12:30, then LUNCH BREAK 13:00-14:29 (no pulls), then 14:30, 15:00, 15:30, 16:00, 16:30 (last pull). Cron fires at every :00 and :30 from 09:00-16:30; the 4 slots 09:00, 13:00, 13:30, 14:00 MUST be skipped.

WALL-CLOCK SKIP GATE (first thing the sweep does before any HubSpot/Modjo call):
- Read current ${TZ} wall-clock time.
- If HH:MM in {09:00, 13:00, 13:30, 14:00}: abort immediately with the single line `SKIPPED lunch/pre-start slot HH:MM`. Do NOT invoke the subagent, do NOT pull calls, do NOT post to Slack.
- Otherwise proceed to the sweep.

Do not change this cadence without an explicit user instruction.

Brief for the agent (only if not skipped):

Run the hubspot-notes sweep. Follow the agent definition; it carries the window rule, the gates, and the guardrails. If no prior successful run, seed at 2026-09-01T00:00 ${TZ} and never reach earlier. Close with one line per call.
