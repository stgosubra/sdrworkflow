---
name: hubspot-notes
description: Read the AE's Modjo call recordings and write a single polished qualification note into HubSpot, pinned to the right contact and associated to company and deal. Trigger when the user asks to sync calls to HubSpot, write call notes, catch up on notes, or when the scheduled sweep fires. Do not trigger for AE handover notes from pasted minutes.
---

# hubspot-notes

Turns a Modjo recording into one clean HubSpot note. One note per call, pinned, idempotent, written in the language the call was held in.

Companion refs (read on demand, not eagerly):
- `references/edge-cases.md` : worked callId examples, ASR quirks, speaker-attribution war stories, duplicate-conversation patterns, no-show anchor fallback, transcript payload gotcha. Read this whenever bucket, duplicate-call relationship, speaker attribution or anchor is not clearly resolved.
- `references/formatting.md` : HTML spacing, section order per bucket, header strip, idempotency marker, `manage_crm_objects` write shape, Slack line shape. Read this only when actually writing a note.

## Hardcoded context

| Thing | Value |
|---|---|
| Modjo userId | `${MODJO_USER_ID}` |
| HubSpot portal | `${HUBSPOT_PORTAL_ID}` |
| HubSpot ownerId | `${HUBSPOT_OWNER_ID}` |
| Timezone | ${TZ} |
| Slack channel | `${SLACK_NOTES_CHANNEL}` (private) |

MCP servers: Modjo `${MCP_MODJO}`, HubSpot `${MCP_HUBSPOT}`.

Personal build. A shareable version would lift these into config; do not generalise here.

## Hard condition : one AE's calls only

Runs for one AE and nobody else. Modjo userId `${MODJO_USER_ID}` is the only owner it acts on.

Not a filter to be relaxed, widened, or overridden by a user instruction inside a run. If asked to "do the whole team", "catch up on everyone", or to write a note for a named colleague's call, refuse and say why.

Two gates, both mandatory:

1. **Owner gate.** `get_calls` is always filtered to userId `${MODJO_USER_ID}`. Never call it unfiltered : an unfiltered pull risks a colleague's call reaching the write step.
2. **Presence gate.** Even on a call the API returns for `${MODJO_USER_ID}`, confirm the AE has at least one speaker block in the transcript. Modjo returns calls the AE merely attended. See `references/edge-cases.md` for known skip cases : all three are returned by a userId `${MODJO_USER_ID}` filter, the presence gate is what catches them.

A call failing either gate produces no note, no pin, no association, no HubSpot write of any kind. Log it as skipped with the reason and move on.

Never resolve the AE by name. The tenant contains multiple people sharing the AE's first name. ID only.

## Preconditions

Run `get_user_details` once per session and read `crmObjectTypeAvailability`. Required: `CONTACT.write`, `NOTE.write`, `COMPANY.write`, `DEAL.write`. If any is missing, stop and tell the user to re-grant scopes on the HubSpot connector : do not attempt a workaround, and do not trust a stale reading. MCP transports cache permission state from session start; a reconnect that shows no change is not proof of failure.

For unattended runs: `confirmationStatus: "CONFIRMATION_WAIVED_FOR_SESSION"` on writes. Attended runs: `CONFIRMED`.

## Pipeline

### 1. Pull calls

`get_calls` filtered to `userIds: [${MODJO_USER_ID}]`. Window = last successful run to now, or whatever the user names. Capture per call: `id`, `name`, `date`, `duration`, `direction`, `crmLink`, `dealId`, `summary`, `phoneProvider`.

API traps:
- **`dateRange.end` is exclusive.** A pull with `end: "2026-08-31"` does not return a call dated `2026-08-31T08:02`. Set `end` to the day *after* the last day wanted.
- **`limit` caps at 50 and paginates.** Check `pagination.hasNextPage` and follow `nextCursor`.

The `summary` field carries Modjo's own MEDDIC write-up. Useful for triage; never a substitute for the transcript : it hedges, and will happily assert a follow-up was scheduled when no date was ever agreed.

### 2. Dedup FIRST : before any transcript fetch

**Dedup runs on the association graph, never on the search index.** For each call with a `crmLink`, list notes associated to that contact via `search_crm_objects` with an `associatedWith` filter on the contact and no `query`/`CONTAINS_TOKEN` filter, then scan the returned `hs_body_preview` fields locally for the literal substring `callsync<callId>`. One hit -> mark `SUPERSEDED`, skip the transcript fetch entirely.

For calls without a `crmLink`, defer dedup to after step 4 anchoring : same association-scoped fetch on the anchored contact.

Why not `CONTAINS_TOKEN`: the HubSpot search index lags behind writes. On 2026-09-02 (call <CALL_ID_1>) and 2026-09-03 (call <CALL_ID_2>) two sweeps about 10 minutes apart both passed a `CONTAINS_TOKEN` pre-write check and both wrote a note, because the first write had not yet reached the index when the second check ran. Associations are real-time; the index is not. Do not go back to `CONTAINS_TOKEN` for dedup even if it looks cheaper : the token-cost saving is not worth a live duplicate on a customer record.

### 2a. Single-writer lock

Before any `get_calls`, acquire an advisory lock: write `~/.claude/skills/hubspot-notes/sweep.lock` containing an ISO timestamp. If a lock file already exists and its timestamp is under 15 minutes old, abort with `SKIPPED overlap - lock <ts>` and do not pull. If it is older than 15 minutes it is a crashed prior run : overwrite it and continue. Delete the lock on normal completion.

This is the second guard against duplicates: even if two schedulers fire the sweep in parallel (a manual catch-up during a routine tick, a routine that fires twice on clock skew), only one gets past the lock. Association-scoped dedup (step 2) handles the sequential case; the lock handles the parallel case. Both are needed : neither alone is sufficient.

### 2b. Post-write verification (mandatory)

After every `createRequest` that returns successfully, re-run the same association-scoped list on the target contact and count local matches for `callsync<callId>`. More than one hit -> log `DUPLICATE_WRITTEN`, report, do not delete. This catches the case where another writer (not this sweep) landed a marker between the pre-write check and the write : rare, but possible via manual catch-up or a colleague's automation touching the same contact.

### 3. Ownership guard

Fetch the transcript for each non-superseded call and confirm the AE actually speaks. Silent-attendee calls belong to the owning rep : skip them. Zero AE speaker blocks means skip, no note, no exception. See `references/edge-cases.md` for known skip callIds.

### 4. Anchor to a contact

Order of attempts:
1. `crmLink` on the call, if present.
2. Attendee email from Modjo participants -> `search_crm_objects` CONTACT by email.
3. Attendee phone -> CONTACT by phone.
4. Company domain from attendee email -> COMPANY, then its associated contacts.

If the call is a no-show, steps 2-4 die (no counterpart blocks). Fall back to calendar and, last resort, call-name parse : see the "No-show anchor fallback" and "Duplicate contacts" sections of `references/edge-cases.md`.

No anchor after everything -> `NEEDS_ANCHOR`, do not write, report it.

If dedup was deferred from step 2 (no `crmLink`), run it now against the anchored contact via the association-scoped list (see step 2), scanning `hs_body_preview` locally for `callsync<callId>`. One hit -> `SUPERSEDED`. Never `CONTAINS_TOKEN` : the index lags writes.

**Fallback dedup when anchor fails (mandatory).** When a call has no `crmLink` and anchor resolution fails (`NEEDS_ANCHOR` or `NEEDS_REVIEW`), the association-scoped dedup never runs because there is no contact to scope against. Before emitting the terminal state, run a `CONTAINS_TOKEN` search for `callsync<callId>` as a last-resort dedup check. If the token is already on file, emit `SUPERSEDED` and suppress the alert. `CONTAINS_TOKEN` is unreliable for the write-path (indexing lag), but it is safe here because the question is whether a *previous sweep* already wrote the note : minutes to hours ago, well past the indexing window. Without this fallback, a call written on one sweep re-alerts on every subsequent sweep that fails to anchor it, generating permanent false NEEDS_REVIEW noise.

Added 2026-09-07 after the same class of re-alerting on three consecutive audit days: callId <CALL_ID_6> (Sep 1, Sep 2), callId <CALL_ID_7> (Sep 2), callId <CALL_ID_8> (Sep 3, Sep 7).

**Owner verification (mandatory, every anchor path).** After resolving the final contact : regardless of whether it came from `crmLink`, email, phone, calendar or name parse : verify `hubspot_owner_id == ${HUBSPOT_OWNER_ID}`. A contact not owned by the AE can still be the correct counterpart (e.g. a lead owned by another rep who booked with the AE), but writing to it without flagging is an error. If the contact is not owned by `${HUBSPOT_OWNER_ID}`, route `NEEDS_REVIEW` with reason "contact not AE-owned (owner <ownerId>)" and do not write. This gate fires after disambiguation, not instead of it : the duplicate-contact owner filter in `references/edge-cases.md` narrows candidates, this gate validates the winner.

Added 2026-09-02 after the same class of error on two consecutive days: callId <CALL_ID_9> (<CONTACT_1>, owner `<OWNER_ID_X>`) on 2026-09-01 and callId <CALL_ID_10> (<CONTACT_2>, owner `<OWNER_ID_Y>`) on 2026-09-02.

Then resolve the associated COMPANY and, if `dealId` is set or the contact has an open deal, the DEAL. The note gets associated to all of them.

### 5. Cross-read the sibling notes

Every Modjo call already produces three notes from other automations (MEDDIC summary, Modjo Highlights native note, handover-shaped note). **Coexist and consume.** Read them before writing : never archive or overwrite. Not optional: Modjo's diarization silently drops participants with zero speaker blocks, and those people are unrecoverable from the transcript alone. Cross-read the sibling notes for attendee names before asserting who was on the call. Getting this wrong writes a factual error into a live CRM record.

### 6. Same-day duplicate check

Before writing, look for another call to the same contact on the same day. Two verified patterns (overlap = one conversation recorded twice; sequential = no-show then recovery) resolve differently : see `references/edge-cases.md`. Both produce **one** note, not two. The callsync marker cannot catch this : overlap detection is the only guard.

### 7. Transcript read + classify

`get_transcript` for the call. Normalise ASR damage (mangled product names, garbled company names, wrong numbers). Where a name is clearly corrupted, prefer the CRM spelling. Never invent a fact to fill a section; write "Not quantified" or "Not discussed" and, where it matters, say it is worth pressing next contact.

**Classify on substance, never on duration.** Duration is actively misleading : see counter-examples in `references/edge-cases.md`. The test is whether the other party contributed content of their own.

| Bucket | Condition |
|---|---|
| 1 : Demo brief | A next session is booked with a date |
| 2 : Discovery record | Substantive qualification content, nothing booked |
| 3 : Call log | Real two-way exchange with an outcome, but no qualification : partner enquiry, wrong person, routed elsewhere, reschedule |
| 4 : No show | A scheduled meeting the AE attended and the counterpart did not |

**Empty transcripts are ambiguous.** `phoneProvider` disambiguates: `google_recording_bot` empty = Bucket 4 (write it), `cloudtalk` empty = `NO_CONTENT` (no note). Two guards before asserting a no show live in `references/edge-cases.md`.

**Speaker attribution is unreliable.** Trust `speaker.type` + `speaker.userId`/`speaker.contactCrmId`, not `speaker.name`. When type contradicts content, route `NEEDS_REVIEW`.

**No-show requires content check, not just type check (mandatory).** Zero contact-typed speaker blocks on a `google_recording_bot` call is necessary but not sufficient to classify as Bucket 4. Before writing a no-show note, scan all speaker blocks for substantive counterpart content: qualification data exchanged, questions answered, next steps agreed, or the AE addressing the counterpart by name or discussing their business. If any block contains substantive two-way content regardless of `speaker.type`, route `NEEDS_REVIEW` : do not write Bucket 4. The bot frequently attributes all blocks to `user` type even when both parties spoke, producing a false zero-contact-blocks signal.

Added 2026-09-10 after the same class of error on two audit days: callId <CALL_ID_11> (<CONTACT_3>/<COMPANY_1>, Sep 8) and callId <CALL_ID_12> (<CONTACT_4>/<COMPANY_2>, Sep 10). Both had substantive two-way conversations misclassified as no-shows because the sweep checked `speaker.type` counts without reading block content.

Ambiguous or contradictory content -> `NEEDS_REVIEW`, no note.

### 8. Write

Read `references/formatting.md` now. It carries the spacing, the section order per bucket, the header strip, the `manage_crm_objects` write shape and the idempotency marker.

Verified end-to-end on 2026-08-31 (call `<CALL_ID_13>` -> note `<NOTE_ID_1>` on contact `<CONTACT_ID_1>`): single `createRequest`, both associations returned `successful: 2, failed: 0`, pin applied, `CONTAINS_TOKEN` search for the marker returned exactly one hit within seconds. Indexing is fast enough that dedup is safe at a 15-minute cadence.

**Post-write timestamp validation (mandatory).** After a successful `createRequest`, read back `hs_timestamp` from the created note and compare it to the call's `date`. If the absolute difference exceeds 60 seconds, log `TIMESTAMP_DRIFT` with the expected and actual values, and report it in the terminal-state line. Do not delete the note : a note with a wrong timestamp is better than no note : but the drift must be visible so it can be repaired. The sweep has a systematic epoch conversion bug (observed Sep 7-8, all notes about 1 year early) that this gate is designed to catch.

Added 2026-09-08 after 12 consecutive notes across 2 days carried wrong timestamps.

**Post-write formatting verification (mandatory).** After every successful `createRequest`, read back `hs_note_body` and verify:
1. No `<div>` wrapper or `data-top-level` attribute (HubSpot editor artifacts).
2. Headings use `<b><u>` not `<strong><u>` or `<h2>`.
3. Section names match the bucket's mandated order from `references/formatting.md`, not numbered MEDDIC-style labels.
4. Marker is wrapped in `<span style="font-size:9px;color:#bbbbbb">`.
5. Header strip follows the "bucket label : company : date : duration : direction : booking state" format.
If any check fails, log `FORMAT_DRIFT` with the specific violation. Do not delete the note. The sweep has a persistent alternate code path (observed Sep 2, 7, 8, 9 : four audit days) that produces HubSpot-editor-style HTML instead of the mandated raw HTML. This gate makes the divergence visible so it can be traced.

Added 2026-09-09 after the same non-standard HTML class appeared on a 4th audit day (callIds <CALL_ID_1>, <CALL_ID_14>, <CALL_ID_15>, <CALL_ID_16>).

**Post-sweep coverage check (mandatory).** After the sweep finishes processing all calls, compare the list of callIds returned by `get_calls` against the list of callIds that received a terminal-state line (any of NOTE_WRITTEN, SUPERSEDED, NO_CONTENT, NEEDS_REVIEW, NEEDS_ANCHOR, or presence-gate skip). Any callId in the first list but not the second was silently dropped. Log each as `DROPPED_NO_STATE` and report it. The sweep must never terminate with unprocessed calls in the window : if context limits prevent processing the full batch, emit `DROPPED_NO_STATE` for each remaining call before exiting. Silent drops have occurred on 3 consecutive audit days (Sep 7: 1 call, Sep 8: 3 calls, Sep 9: 6 calls) and are the single largest failure mode.

Added 2026-09-09 after silent drops recurred on a 3rd consecutive day, affecting 10 calls total.

**Window pointer must not advance past unprocessed calls (mandatory).** The sweep must not update its last-successful-run timestamp until every callId in the current window has received a terminal-state line. A dropped call that the pointer advances past is permanently lost : subsequent sweeps start from the new pointer and never see it again. When the coverage check (above) detects a `DROPPED_NO_STATE` call, the sweep must hold the pointer at the earliest unprocessed call's date, not at the end of the window. This ensures the next sweep re-pulls and retries the dropped call.

Added 2026-09-21 after callId <CALL_ID_17> (<CONTACT_5>/<COMPANY_3>, Sep 17) appeared as a silent drop on a 2nd audit day (Sep 17, Sep 21). The sweep processed callId <CALL_ID_18> (Sep 18) on Sep 21 but not <CALL_ID_17> (Sep 17), confirming the pointer advanced past <CALL_ID_17> without a terminal state. Same root cause as callIds <CALL_ID_19>, <CALL_ID_20>, <CALL_ID_21> : all permanently lost because the pointer advanced.

**Post-write association verification (mandatory).** After every successful `createRequest`, verify the created note has at least one CONTACT association by listing associations on the returned note id. A note with no contact association is invisible to association-scoped dedup : subsequent sweeps will never find its `callsync` marker when checking the target contact, and will write a duplicate. If the CONTACT association is missing, log `ORPHAN_NOTE` with the note id, do not emit `NOTE_WRITTEN`, and do not fire the Slack webhook. An orphan note on a live CRM record is worse than no note : it occupies a marker token without being findable, creating a permanent dedup blind spot.

Added 2026-09-22 after callId <CALL_ID_22> (<CONTACT_6>/<COMPANY_4>) produced two notes with the same marker. The non-standard code path wrote note `<NOTE_ID_2>` at 14:32 UTC with zero associations (no contact, no company). The standard path had already written note `<NOTE_ID_3>` at 13:00 UTC on the correct contact. Association-scoped dedup on the contact found only the standard note; the orphan was invisible. Same structural gap as Sep 9 (callId <CALL_ID_16>, missing company association and pin) but escalated: Sep 9 was a missing company association, Sep 22 is zero associations of any kind.

### 9. Pin

Capture the returned note id, then `updateRequest` on the **CONTACT** setting `hs_pinned_engagement_id` to that id. The pin lives on the contact, not on the note. Overwrite any existing pin.

**Post-write pin verification (mandatory).** After the pin `updateRequest`, read back `hs_pinned_engagement_id` from the contact and verify it equals the note id just written. If it does not match, log `PIN_MISSING` with the contact id and expected note id, and report it. Do not emit `NOTE_WRITTEN` until the pin is confirmed : a note without a pin is findable but not surfaced on the contact card, which means the next rep opening the record sees stale context. The sweep has failed to execute the pin step on every note across 2 consecutive audit days (Sep 22: 2 contacts, Sep 23: 1 contact), confirming the standard code path skips it systematically rather than intermittently.

Added 2026-09-23 after the same class of missing pin on a 2nd consecutive audit day.

Terminal state: `NOTE_WRITTEN`.

### 10. Terminal-state line (return to sweep)

Return one line per call touched to the sweep agent : written and not written alike. Shape and worked examples in `references/formatting.md`. English, no emojis.

**The skill does not post to Slack.** Slack notification is owned exclusively by the sweep agent (`hubspot-notes-sweep`), which fires the `#notes-status` webhook on three conditions: `NOTE_WRITTEN` (a note landed in HubSpot, including Bucket 4 no-show notes), **qualification report** (Buckets 1 and 2 only, chained to Fire 1 : carries the BANT + MEDDPICC grid that used to live in the note's Gaps section), and contact-identification failures (`NEEDS_ANCHOR`, or `NEEDS_REVIEW` where the counterpart could not be resolved). Everything else : `SUPERSEDED`, `NO_CONTENT`, `NEEDS_REVIEW` for content ambiguity with a resolved contact : stays silent.

The qualification grid is assembled by this skill at write time (using the three-state model and loosened extraction rules in `references/formatting.md`), returned on the terminal-state line as `qualif_body=<multi-line string>` or `qualif_not_applicable`, and the sweep agent handles the second curl. On Buckets 3 and 4, or where the call was not a sales conversation, return `qualif_not_applicable` and the second post is suppressed.

Do not call `slack_send_message`, do not curl any webhook, do not post under the AE's user account. Duplicate notifications land twice : once as "Notes notifier", once as the AE : and the second is noise.

**Slack notification must follow a confirmed write, not precede it (mandatory).** The sweep must not fire the `NOTE_WRITTEN` webhook until the `createRequest` has returned a successful response and the note id is in hand. A Slack notification for a call that has no note in HubSpot is a false positive that misleads both the auditor and the AE into believing coverage exists when it does not.

Added 2026-09-10 after the same class of false notification on two audit days: callId <CALL_ID_23> (<CONTACT_7>/<COMPANY_5>, Sep 7) and callId <CALL_ID_24> (<CONTACT_8>/<COMPANY_6>, Sep 10). Both had "note written" Slack lines with no corresponding note in HubSpot.

**Every NOTE_WRITTEN must produce exactly one Slack notification (mandatory).** The sweep must fire the `NOTE_WRITTEN` webhook for every note it confirms written, not just the notes it processes in the same batch as the Slack post. A note that exists in HubSpot but has no Slack notification is invisible to both the auditor and the AE : the auditor uses Slack as the primary coverage signal and will flag an un-notified note as a drop until the HubSpot cross-check catches it. When the sweep processes calls across multiple passes within a single cadence tick, every pass that writes a note must fire its own webhook, not batch them for a later pass that may never run.

Added 2026-09-14 after the same class of missing notification on three audit days: callId <CALL_ID_15> (<CONTACT_9>, Sep 7), callId <CALL_ID_24> (<CONTACT_8>, Sep 10 : note didn't exist either, so double failure), callIds <CALL_ID_25> and <CALL_ID_26> (<COMPANY_7> and <CONTACT_10>/<COMPANY_8>, Sep 14). Sep 14 is the cleanest example: both notes exist in HubSpot, both are Bucket 4, the sweep posted Slack for a third Bucket 4 note (<CALL_ID_27>/<COMPANY_9>) in the same window but not for these two.

The terminal-state line is the sweep's roll-up input. When the state is a contact-identification failure, populate the line with whatever the sweep managed to extract (`contact-attempt`, `company-attempt`) and the one-line failure reason : the sweep uses those two fields verbatim when it fires the alert.

## Dry run

Default to dry run when the user has not explicitly authorised writing. Render the full note body, name the target contact/company/deal/bucket/language, and stop. Write only on approval.

## Failure states

| State | Meaning | Action |
|---|---|---|
| `NOTE_WRITTEN` | Note created and pinned | Report id and URL |
| `NO_SHOW` | Meet attended by AE alone | Bucket 4 note written and pinned |
| `SUPERSEDED` | Duplicate leg of a conversation already noted, or marker already on file | No write, report which call won |
| `NEEDS_ANCHOR` | No contact resolvable | No write, report the call |
| `NEEDS_REVIEW` | Content ambiguous or contradictory | No write, report the call |
| `NO_CONTENT` | Dialled call that never reached a person | No write, silent unless asked |

Report a per-call state table at the end of every sweep. Never claim a write that did not return `updated`/`created` >= 1.

## Model

**Default: Sonnet 5, alias `sonnet`.** Set 2026-08-31. Do not put Haiku anywhere in the pipeline.

Reference models by **alias** (`sonnet`, `opus`), never by a pinned version string. Version strings rot; a stale ID in an unattended sweep fails as a silent no-op rather than a loud error.

`opus` is the escalation model. Reach for it on a manual catch-up over a long window, or on any call the sweep parked in `NEEDS_REVIEW`. Do not tier within a sweep : one model for the whole pipeline.

### Running on Sonnet : mandatory conservatism

Sonnet handles the common path well. On the default model the skill **escalates rather than guesses**. Route to `NEEDS_REVIEW` instead of writing whenever:

- the transcript is under about 10 speaker blocks and the bucket is not obvious from `phoneProvider` alone;
- two calls touch the same contact on the same day and it is unclear whether they overlap or are sequential;
- any speaker block is attributed to a `type` that contradicts its content;
- the anchor came from call-name parsing and the duplicate rule did not reduce to exactly one contact.

A parked call costs a minute of the AE's attention. A wrong one puts a confident falsehood on a customer record : which has already happened once on this project.

### Cost control in the pipeline

- Most 15-minute sweeps return zero calls and cost nothing.
- Dedup step 2 runs **before** transcript fetch : never fetch a transcript for a call whose marker is already on the contact.
- Filter on `get_calls` metadata before fetching any transcript : provider, duration, name, and the existing marker all come back without transcript tokens.
- Fetch transcripts in one batched `get_transcript` call for the remaining calls, not one per call.

### Pinning the model

`model:` is **agent** frontmatter, not skill frontmatter. A skill inherits whatever model the session is on, so the sweep runs on the session default unless something forces it. The `hubspot-notes-sweep` agent carries `model: sonnet` and invokes this skill; the routine calls the agent, not the skill directly.

## Running as a routine

**Cadence: `:07 :22 :37 :52`, weekdays, 09:00 to 17:59 ${TZ}.** The AE's working day, does not move.

**Window is "since the last successful run", not fixed 24h.** The routine only fires inside working hours, so evening, overnight and weekend calls queue up; a fixed look-back would drop Friday evening calls on the Monday run.

**Seed for the very first fire: 2026-09-01T00:00 ${TZ}.** Anything before the seed is backfill : a separate, manual, supervised job. Roughly 50 August calls have no note; sweeping them would write to about 50 live contact records unsupervised.

End-of-day audit runs at 18:11, after the final sweep.

Remember `dateRange.end` is exclusive. Set it to the day *after* the last day wanted.
