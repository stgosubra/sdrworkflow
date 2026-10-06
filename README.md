# sdrworkflow

> Daily pipeline that pulls stale MQL contacts from HubSpot, scores them, injects the data into a static tracker dashboard, and queues Post-Qual outreach drafts for review.

---

## Project Overview

Built for a CloudTalk Solutions Engineer to manage a large inbound MQL pipeline without a dedicated SDR tool. The system pulls contacts that have gone quiet (7+ days since last note), scores them by recency, seat size, engagement, and source, then surfaces the actionable ones in a filterable dashboard. Post-Qual leads (completed call + Modjo note confirmed) get outreach drafts queued for one-click Gmail compose - never auto-sent.

No backend, no database, no build step for the dashboard. The pipeline is Node.js ESM scripts; the dashboard is a self-contained HTML file with the snapshot baked in at build time.

---

## Version History

- **v1** - Basic HubSpot pull + static score table. Manual refresh, no copy injection.
- **v2** - score.mjs / copy.mjs split as single sources of truth; embed.mjs injects both into index.html at build. Engagement tiers (Working / Lukewarm / Approached) added.
- **v3** - drafts.mjs added: plan/record Post-Qual Gmail drafts with dedup via stale-lead-drafted.json. history.mjs tracks run-over-run diff (newlyHot / dropped).
- **v4 [FINAL]** - Scheduled daily run via Claude Code task. Guard layer added to refresh.mjs (staleDays boundary check, count range, missing fields). copy.test.mjs enforces copy contract (register, CTA format, no raw URLs). All outreach copy (POST_QUAL, WORKING_FOLLOWUP, LUKEWARM, REACTIVATION) finalized and signed off.

---

## Design Decisions

- **Single source of truth per concern.** Staleness tier logic lives only in `tools/score.mjs` and is injected into `index.html` at build by `embed.mjs`. Outreach copy lives only in `tools/copy.mjs` and is injected the same way. Never edit the injected regions in the HTML directly.
- **No calendar URL in copy.** Gmail's `&body=` param is plain text - hyperlinks render literally. Each email body ends on a bare localized CTA word (`Book here` / `Réservez ici` / `Reserva aquí`) which Santiago links and italicizes by hand in Gmail.
- **staleDays measured from pull instant, not midnight.** Measuring from midnight caused a boundary defect (staleDays=6 under a 7-day filter). The guard now hard-stops the run if any contact has staleDays < 7.
- **Post-Qual requires both qualCallDate AND hasModjoNote.** A completed call timestamp without a Modjo INTEGRATION note is not counted as qualified - it could be a no-show or a logging gap.
- **Drafts are never auto-created or auto-sent.** `drafts.mjs plan` prints the queue; a human reviews and runs `drafts.mjs record <ids>` after creating drafts manually or via a separate Gmail step.
- **Copy register is deliberate.** FR is always formal (vous), ES is always informal (tú). No space before `?` or `:` in FR/ES UI blocks - reads less templated than correct orthography. POST_QUAL block is protected and uses standard orthography (it predates the rule and feeds auto-drafts).

---

## Stack & Dependencies

**Runtime:** Node.js (ESM, `"type": "module"`)
**Language:** Vanilla JavaScript - no transpilation, no bundler
**Dashboard:** Static single-file HTML (no framework, no build for the UI itself)
**External data:** HubSpot CRM via MCP / REST API (pull done externally, result written to `stale-lead-raw-pull.json`)

```bash
# No npm install needed - zero runtime dependencies.
# Node.js 18+ required (uses native test runner for tests).
node --version  # must be 18+
```

---

## How to Run

### Daily refresh (full pipeline)

```bash
# 1. Write stale-lead-raw-pull.json (HubSpot pull - done by the scheduled agent or manually)

# 2. Run copy contract tests (must pass before build)
node --test tools/copy.test.mjs

# 3. Build: score, inject, embed snapshot, write history + diff
node tools/refresh.mjs

# 4. Review Post-Qual draft queue (prints JSON, does NOT create drafts)
node tools/drafts.mjs plan

# 5. After reviewing, record which drafts were created in Gmail:
node tools/drafts.mjs record <id1> <id2> ...

# 6. Open the dashboard
open stale-lead-tracker/index.html
```

### Run all tests

```bash
cd tools && node --test
```

---

## File Structure

```
sdrworkflow/
├── stale-lead-tracker/
│   └── index.html              # Dashboard - static, self-contained; snapshot baked in at build
├── tools/
│   ├── package.json            # { "type": "module" } - enables ESM; no dependencies
│   ├── score.mjs               # Scoring logic + stalenessTier (SHARED_TIER injected into HTML)
│   ├── score.test.mjs          # Unit tests for scoring
│   ├── copy.mjs                # Outreach copy (POST_QUAL / WORKING_FOLLOWUP / LUKEWARM / REACTIVATION)
│   ├── copy.test.mjs           # Copy contract tests (register, CTA format, no raw URLs)
│   ├── embed.mjs               # Injects score + copy into HTML; swaps SNAPSHOT data line
│   ├── embed.test.mjs          # Tests for embed region injection
│   ├── refresh.mjs             # Main build: score -> validate -> inject -> snapshot -> history -> diff
│   ├── refresh.test.mjs        # Integration tests for refresh
│   ├── history.mjs             # historyEntry + diffRuns (newlyHot / newlyStale / dropped)
│   ├── history.test.mjs        # Tests for diff logic
│   ├── drafts.mjs              # plan / record Post-Qual Gmail drafts with dedup
│   └── drafts.test.mjs         # Tests for draft planning and dedup
├── .gitignore                  # Excludes all PII data files
└── README.md
```

**Runtime data files (gitignored - never commit):**
```
stale-lead-raw-pull.json          # HubSpot pull output (PII)
stale-lead-tracker-snapshot.json  # Enriched snapshot (PII)
stale-lead-history.json           # Run history (PII)
stale-lead-diff.json              # Last run diff
stale-lead-drafted.json           # Draft dedup state
```

---

## Raw Pull Schema

`stale-lead-raw-pull.json` must contain:

```json
{
  "snapshotDate": "<ISO timestamp of pull instant>",
  "pullInstantMs": 1234567890000,
  "total": 45,
  "count": 45,
  "contacts": [
    {
      "id": "string",
      "firstname": "string",
      "name": "firstname lastname",
      "email": "string",
      "finalCountry": "string|null",
      "country": "string",
      "seatBand": "3-10",
      "source": "PAID_SEARCH",
      "mqlDate": "ISO",
      "createdate": "ISO",
      "lastActivity": "ISO",
      "status": "OPEN",
      "emailClick": null,
      "emailOpen": null,
      "convEvents": "3",
      "qualCallDate": "ISO|null",
      "qualCallMeetingSetDate": "ISO|null",
      "meetingBookedDefault": "Yes|No|null",
      "salesEmailLastReplied": "ISO|null",
      "hasModjoNote": false,
      "hasDeal": false,
      "staleDays": 9
    }
  ]
}
```

Guard requirements before refresh will proceed:
- `count` between 80-160 (soft warning outside range, hard stop at 0)
- No contact missing `email`, `seatBand`, `status`, `mqlDate`, `staleDays`
- No `staleDays < 7` (boundary defect check)

---

## Notes

- **HubSpot filter spec:** owner `87191703`, statuses `NEW / OPEN / IN_PROGRESS / Demo no show / Unable to Contact`, MQL within 180 days, `notes_last_updated < (now - 7 days)`. Date filters must be epoch-milliseconds - ISO strings are silently ignored by HubSpot search.
- **`Unable to Contact` returns 0 records** in portal 6195055 - kept for spec fidelity, harmless. Never add `ATTEMPTED_TO_CONTACT` (labeled "Qualified Out", ~1135 records).
- **Lukewarm is a floor** - `hs_sales_email_last_replied` only fires on HubSpot-tracked replies; genuine responders may land in Approached.
- **Never-active leads are invisible** - `notes_last_updated < X` excludes contacts with no activity date. Fixing requires an OR filterGroup with `NOT_HAS_PROPERTY`.
- The dashboard's three engagement sections (Working / Lukewarm / Approached) share a single `selAll` checkbox that lives on the first section's thead only.

---

*Generated by export-project skill - claude.ai*
