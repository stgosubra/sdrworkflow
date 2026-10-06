# hubspot-notes formatting

Read this before writing the note body. Not needed on skips, superseded calls, or `NEEDS_REVIEW`/`NEEDS_ANCHOR` outcomes.

## Non-negotiables

- No emojis anywhere.
- Short hyphens `-` only. Never em or en dashes.
- Never the word "incumbent".
- Headings bold and underlined: `<b><u>Heading</u></b>`.
- Next meeting date underlined.
- **All spacing inline.** HubSpot strips `<style>` blocks. `<p>` bottom margin and `<ul>` top margin stack instead of collapsing, so every element carries an explicit `style="margin:..."`.

## Spacing values that render correctly

```
title line       margin:0 0 2px
meta line        margin:0 0 16px  color:#666
section heading  margin:16px 0 3px
paragraph body   margin:0 0 4px
list             margin:0 0 0 18px  padding:0
list item        margin:0 0 3px
marker           margin:18px 0 0
```

## Language

Detect the language of the call from the transcript and write the **body** in that language, consistently, start to finish. **Headings stay English** : a fixed vocabulary keeps the note structure constant and searchable across the whole pipeline regardless of call language.

## Idempotency marker

Last line of every note:

```html
<p style="margin:18px 0 0"><span style="font-size:9px;color:#bbbbbb">callsync<CALL_ID_40></span></p>
```

HTML comments do not work : HubSpot strips them before indexing `hs_note_body`, so a comment marker is invisible to search. The token must be visible text and a single unbroken alphanumeric run, because `CONTAINS_TOKEN` splits on punctuation. `callsync<callId>`, nothing else. Verify by reading back `hs_body_preview`, which is the reliable proxy for what got indexed.

The prefix is `callsync`, not `hubspotnotes`, because live notes already carry it. Do not rename it.

## Header strip

Every bucket opens with two lines. This replaces a separate Account snapshot section : a snapshot section duplicated the header and bled into Deal summary, so it was removed.

Bucket labels on line one:
- Bucket 1: `Qualif BRIEF` (qualification brief for the booked demo, not "DEMO BRIEF")
- Bucket 2: `DISCOVERY RECORD`
- Bucket 3: `CALL LOG`
- Bucket 4: `NO SHOW`

Worked example (Bucket 2):

```html
<p style="margin:0 0 2px"><b>DISCOVERY RECORD - <COMPANY_12> - 31 Aug 2026 - 13 min - outbound - not booked</b></p>
<p style="margin:0 0 16px;color:#666"><CONTACT_16>, <CONTACT_17> (<COMPANY_12>) &nbsp;|&nbsp; <a href="https://app.modjo.ai/call-details/<CALL_ID_40>" target="_blank">Recording</a></p>
```

Worked example (Bucket 1, with contact role):

```html
<p style="margin:0 0 2px"><b>Qualif BRIEF - <COMPANY_13> - 01 Sep 2026 - 20 min - outbound - booked</b></p>
<p style="margin:0 0 16px;color:#666"><CONTACT_18> (<COMPANY_13>) - Operations Manager &nbsp;|&nbsp; <a href="https://app.modjo.ai/call-details/<CALL_ID_41>" target="_blank">Recording</a></p>
```

Line one: bucket label, company, date, duration, direction, booking state. Must stand alone as the scannable summary : it is what `hs_body_preview` surfaces in the timeline.

Line two: participants and the Modjo deep link `https://app.modjo.ai/call-details/<callId>`. On Bucket 1, append the contact's role after the company parenthesis with a short-hyphen separator: `Name (Company) - Role`. Role is transcript-sourced or LinkedIn/HubSpot-confirmed; drop it if unknown rather than guessing.

## Section order by bucket

**Bucket 1 : Demo brief**
Timeline / Next step / Context / Current stack / Demo agenda / Deal summary / Pain points / Cost of doing nothing / Risks flagged / To dos

Fixed order set 2026-09-01 off a qualified-demo brief; `Gaps` removed 2026-10-01 : qualification scoring moved out of the note body to Slack (see "Qualification report" below). Timeline is the first thing the reader sees because on qualified demos the deal-creation state (opened, on hold, blocked pending) drives every downstream action. Context precedes Demo agenda so the reader knows *who* they are before they read *what to prove*. Current stack sits between Context and Demo agenda because agenda items pivot off the stack (e.g. "prove CRM integration equivalent to <existing-system>").

Each Demo agenda line carries what must be proven on that point. There is no separate "Ordered to see" in this bucket : the two were the same content and were merged.

**Bucket 2 : Discovery record**
Next step / Context / Deal summary / Current stack / Pain points / Cost of doing nothing / Ordered to see / Risks flagged / To dos

**Bucket 3 : Call log**
Next step / Context / To dos / Gaps

**Bucket 4 : No show**
Next step / Context / To dos

No Gaps section : nothing was learned, so there is nothing to score. Keep it to four or five lines total. The note exists to record that the slot was burned and to carry the re-book, not to pad the timeline.

**Next step** on a no show is fixed : two suggestions, always both, always phrased as recommendations rather than actions already taken:

> **Next step** - suggest setting lead status to **Demo no show** and sending the reactivation email.

`hs_lead_status` carries a literal `Demo no show` value (label "Demo no show") : use that string exactly, it is not `NO_SHOW` and not a lead *source*. The reactivation email is the existing REACTIVATION copy set from the stale-lead tracker, language-routed off the contact; do not draft new copy inside this skill.

Both stay suggestions. This skill writes notes. It does not mutate `hs_lead_status` and does not send or draft email. A status change is visible to the whole team and a send is irreversible : both belong to the AE.

Next step and the deal picture lead in every bucket : those carry the story a rep needs before dialling.

## What goes in each section

**Timeline** (bucket 1 only) : one line, arrow-form. Reader's-eye view of when the money moves and what state the deal record is in. Format: `<expected-timeline-phrase> -> <deal-record state>`. Deal-record state is one of `deal creation on hold`, `deal opened`, `deal blocked pending <what>`. Worked example: `unclear, deal creation on hold.` A qualified demo with no clear buying window still gets this line : the honest "unclear" is what tells the AE not to forecast off this call yet.

**Next step** : status (underlined if a date exists), shape and duration of the session, attendees, and their commitment quoted verbatim where they gave one.

**Demo agenda** (bucket 1 only) : each agenda item plus what it must prove.

One line is **mandatory on every bucket 1 note**, whether or not it was discussed:

> **Confirm seat count and country setup** - restate the total user count the prospect gave, and every country they named either as a place they will call into or a place they want a local prefix from.

Pull both from the transcript verbatim and label them as the prospect's own figures, not as agreed scope. Where a count was hedged ("around 10", "6 to 8, growing"), carry the hedge : it is the difference between a quote and a guess. Where no country or count was given, say so explicitly; a blank here is the single most common cause of provisioning the wrong thing.

Keep it compressed : one clause per fact, nothing the reader can infer. Worked example from `<CALL_ID_42>`: "Up to 10 users. Poland mobile numbers + matching prefix, domestic use."

That is the target density. "10 users stated, hedged as 'up to 10'. Poland only : Polish mobile numbers for outbound to Polish clients. No second country named." carries the same facts in four times the words; "domestic use" already implies destination equals prefix and that no second country came up.

Distinguish the two country types, because they cost and provision differently: a **destination** country drives per-minute rates and bundles, a **prefix** country drives number purchase, availability and porting. A prospect naming Poland for both is the simple case. A prospect calling into KSA on a UK number is not.

**Context** : prose. Who they are, why they are here, what they had already decided before the call. Include buying structure here if they are buying on behalf of someone else.

**Deal summary** : plan positioned, seats, pricing, porting, minutes, upsells surfaced, and price resistance observed.

**Current stack** : facts only. Systems and providers. No judgment, no problems : those belong in Pain points.

**Pain points** : what is broken and why it matters.

**Cost of doing nothing** : quantified if stated. If not, say so plainly and flag it as worth pressing.

**Ordered to see** (bucket 2 only) : what the prospect asked to be shown.

**Risks flagged** : each risk bolded up front, then the reasoning. Include risks the prospect did not raise but that are real.

**To dos** : the AE's actions, specific and checkable.

## Qualification report (Slack, not in the note)

Moved out of the note body on 2026-10-01. The HubSpot note carries narrative only; BANT + MEDDPICC scoring is extracted during the write step and posted to the Notes-notifier Slack webhook as a second message, chained immediately after the `NOTE_WRITTEN` fire so the two never desync. Payload shape and firing rules live in the `hubspot-notes-sweep` agent definition. Applies to Buckets 1 and 2 only : Buckets 3 and 4 do not score.

Three-state model per letter: `filled` / `partial` / `missing`. Hedged evidence (`"around 40k"`, `"early next year"`, `"6-8 users, growing"`) scores `partial` on first pass, never `filled`, and the hedge is quoted verbatim. Unfilled slots stay unfilled : never guess to inflate completion %.

**Optimistic re-grading pass (added 2026-10-02).** After the first pass, re-walk every `partial` letter and promote to `filled` where the evidence is a direct, non-speculative confirmation of the criterion (named buyer by role, named timeline, named pain, concrete competitor, quantified pricing acknowledged). Keep `partial` only where the evidence is conditional, deferred, or second-hand ("needs sign-off", "will come back to us", "mentioned in passing"). Never promote `missing -> partial` or `missing -> filled` in this pass : it only reclaims under-counted partials, it does not fabricate evidence. The post-regrade counts are what the Slack payload reports.

The Slack payload is minimal by default: header line, `BANT x/4 · MEDDPICC x/8` on a single line, HubSpot link. A short `Gaps:` block appears only when at least one letter across either framework remains `partial` or `missing` post-regrade, listing just those letters in B/A/N/T then M/E/D/D/P/C/I/C order. If both frameworks are 100% `filled`, the Gaps block is omitted. Payload shape lives in the `hubspot-notes-sweep` agent definition : keep both in sync.

Where the call was not a sales conversation at all : a partner enquiry, a supplier, a wrong number : do not force a score. Return `qualif_not_applicable` on the terminal-state line and suppress the qualification Slack post. A fabricated 0/4 reads as a failed call rather than a call that was never an opportunity.

### Slot extraction rules (relaxed 2026-10-01)

Three rule changes to lift recall without inflating confidence:

1. **Introduce `partial`.** Hedged numbers, named-but-unconfirmed roles, implied-but-not-stated authority all go to `partial` with the verbatim snippet : previously these dropped to `missing`.
2. **Short-call bucket park does not block slot extraction.** The under-10-speaker-block rule still parks the bucket decision as `NEEDS_REVIEW` where ambiguous, but on calls that *did* resolve to Bucket 1 or 2, slots get extracted from whatever content exists. Don't skip the qualification report just because the call was short.
3. **Content-attributed blocks override `speaker.type` for self-ID, when the AE acknowledges the self-ID in an adjacent turn.** Example: a block mis-typed as `user` says "I'm the one who signs off on tooling spend"; the AE's next block replies "OK so you're the budget holder" : the `partial` goes to Economic buyer with the quoted self-ID. Without the adjacent AE acknowledgment, drop and route to `missing`.

## Write call shape

`manage_crm_objects` `createRequest` with associations inline : one call, not two:

```
objects: [{
  objectType: "NOTE",
  properties: { hs_note_body, hs_timestamp: <exact call start>, hubspot_owner_id: "${HUBSPOT_OWNER_ID}" },
  associations: [
    { targetObjectId: <contactId>, targetObjectType: "CONTACT" },
    { targetObjectId: <companyId>, targetObjectType: "COMPANY" },
    { targetObjectId: <dealId>,    targetObjectType: "DEAL" }
  ]
}]
```

`hs_timestamp` must be the exact call start, matching the sibling notes so the timeline stays coherent. Pass it as **epoch milliseconds in a string** (`"1787839293604"`), not ISO : every property value in `createRequest.properties` is typed as a string.

`objectType` is lowercase plural (`"notes"`) on the object itself, but `targetObjectType` inside `associations` is uppercase singular (`"CONTACT"`, `"COMPANY"`, `"DEAL"`). Not the same convention. The call also needs `confirmationStatus: "CONFIRMED"` for attended runs, `"CONFIRMATION_WAIVED_FOR_SESSION"` for unattended sweeps.

## Pin

Capture the returned note id, then `updateRequest` on the **CONTACT** setting `hs_pinned_engagement_id` to that id. The pin lives on the contact record, not on the note. Overwrite any existing pin : the freshest call is what a rep needs on open.

## Terminal-state line (returned to the sweep agent)

Not a Slack post. This is the roll-up line the skill hands back to `hubspot-notes-sweep` for its per-call table. The sweep agent owns the only Slack channel (the `#notes-status` webhook, `NOTE_WRITTEN` only). The skill must not call `slack_send_message` or curl any webhook.

```
<STATE> | <bucket> | <contact>, <company> | HubSpot <note link> | Modjo <call link>
```

Link formats:
- HubSpot note: `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/contact/<contactId>?engagement=<noteId>`. Opens the contact record with the note expanded. Needs contact id AND note id, so capture both from the create response.
- Modjo call: `https://app.modjo.ai/call-details/<callId>`.

Worked examples:

```
WRITTEN   | 4 - No show | <CONTACT_15>, <COMPANY_10> | HubSpot https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/contact/<CONTACT_ID_1>?engagement=<NOTE_ID_1> | Modjo https://app.modjo.ai/call-details/<CALL_ID_13>
PARKED    | NEEDS_ANCHOR, name-parse gave 2 contacts | (unresolved), <COMPANY_14> | HubSpot - | Modjo https://app.modjo.ai/call-details/<CALL_ID_43>
SKIPPED   | owner gate - AE has no speaker blocks | - | HubSpot - | Modjo https://app.modjo.ai/call-details/<CALL_ID_30>
```

Rules:
- On a not-written line the HubSpot field is `-` and the state carries the **reason**, not just the code.
- The Modjo link is always present, even when nothing else resolved.
- Always English, whatever language the note was written in.
- No emojis.
