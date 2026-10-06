# hubspot-notes edge cases

Read this only when the core skill routes you here: a `NEEDS_REVIEW` trigger, an ambiguous bucket, contradictory speaker attribution, a same-day duplicate call pattern, or an anchor that reduced to more than one contact.

## Ownership : known skip cases

All three are returned by a `userId: ${MODJO_USER_ID}` filter. The owner gate alone does not exclude them. The presence-in-transcript gate is what catches them.

- `<CALL_ID_30>` : <COLLEAGUE_1>
- `<CALL_ID_31>` : <COLLEAGUE_2>
- `<CALL_ID_32>` : <COLLEAGUE_3>

Zero AE speaker blocks -> skip, no note, no exception.

## Speaker attribution is unreliable

Do not trust `speaker.name`. Trust `speaker.type` together with `speaker.userId` / `speaker.contactCrmId`, and sanity-check against content:

- On `<CALL_ID_13>`, a block typed `contact` carries the AE's own name : it is hold music attributed to the wrong side.
- On `<CALL_ID_33>`, the prospect company's IVR greeting is attributed to the AE as a `user`, while the menu options are attributed to the contact. Both are the same recorded machine.

A block can be correctly typed and still be a machine. Recorded IVR, hold music and voicemail greetings all surface as ordinary speaker blocks. When type contradicts content, route `NEEDS_REVIEW`.

## Empty transcript : three different meanings

When nobody but the AE contributed, `phoneProvider` tells you which : hard signal, not a heuristic.

| `phoneProvider` | Empty transcript means | Outcome |
|---|---|---|
| `google_recording_bot` | Scheduled Meet, counterpart never joined | Bucket 4 : No show, write it |
| `cloudtalk` | Dialled call that never reached a person : IVR, voicemail, hangup | `NO_CONTENT`, no note |

Worked examples:

- `<CALL_ID_13>` <COMPANY_10> : `google_recording_bot`, 328s, the AE says "Yes, thank you" then hold music. **No show.**
- `<CALL_ID_34>` <CONTACT_11> : `google_recording_bot`, 180s, `get_transcript` returns **no entry at all** for the callId. Also a no show. Handle a missing transcript, not just an empty one; the API omits the callId from `transcripts[]` rather than returning an empty array.
- `<CALL_ID_33>` <COMPANY_11> : `cloudtalk`, 134s, five blocks of the prospect's own IVR menu tree. Nobody answered. `NO_CONTENT`.

## Two guards before asserting a no show

1. **Check for a recovery call.** Same contact, later the same day, `cloudtalk` provider. If the AE got them on the phone, do not write a no-show note : fold it into Context on the recovery note.
2. **Do not assert a no show if the AE addressed the counterpart as present.** `<CALL_ID_35>` is `google_recording_bot`, 196s, one block: "Hello, <CONTACT_12>. Let me know whenever you're ready." That phrasing means somebody was there. Route to `NEEDS_REVIEW`. Writing "did not attend" about someone who attended is the same class of error as inventing an attendee.

## One conversation can arrive as two calls

Before writing, check for another call to the **same contact on the same day**. Two distinct patterns, both verified, resolved differently.

**Overlapping windows : one conversation recorded twice.** <CONTACT_13>: `<CALL_ID_36>` (google_recording_bot, 10:02:07-10:08:15) and `<CALL_ID_37>` (cloudtalk, 10:04:26-10:07:15). The AE sat in an empty Meet and phoned the contact from it, so the bot captured room audio of the AE's half while CloudTalk captured the call properly. Two Modjo calls, one conversation.

Write **one** note. Prefer the `cloudtalk` leg : its diarization is clean. The `google_recording_bot` leg of an overlap is room-audio bleed: on `<CALL_ID_36>` most of the counterpart's side is missing and three of the AE's own sentences are attributed to the contact. Treating it as a second call produces a duplicate note built on a corrupted transcript.

The callId marker cannot catch this. `callsync<CALL_ID_36>` and `callsync<CALL_ID_37>` are different tokens. Overlap detection is the only guard.

**Sequential windows : a no-show then a recovery.** <CONTACT_11>: `<CALL_ID_34>` (bot, 10:37:27-10:40:27, no transcript) then `<CALL_ID_38>` (cloudtalk, 10:46:08-10:56:03, real conversation). Six minutes apart, no overlap. The contact missed the Meet and the AE rang them. Write **one** note against the recovery call. The no-show is a line in Context, not its own note.

## Substance test : classify on content, never on duration

Duration is actively misleading. Counter-examples:

- `<CALL_ID_13>` : 328s, two transcript blocks. The AE says "Yes, thank you", then hold music is transcribed as song lyrics. `NO_CONTENT` (or Bucket 4 depending on provider, see empty-transcript table above).
- `<CALL_ID_33>` : 134s, five blocks, every one the prospect's own IVR menu tree. Nobody ever spoke. `NO_CONTENT`.
- `<CALL_ID_35>` : 196s, one block: "Hello, <CONTACT_12>. Let me know whenever you're ready." `NO_CONTENT` or `NEEDS_REVIEW` per the no-show guards.
- `<CALL_ID_37>` : 169s, the shortest of the four, and a complete exchange with a clear outcome. Bucket 3.

The test is whether the other party contributed content of their own.

## Anchor chain : the no-show fallback

Steps 2 to 4 of the anchor chain (attendee email, phone, company domain) all read transcript speaker blocks. A no-show has none. On `<CALL_ID_13>` (<COMPANY_10>): `crmLink: null`, `dealId: null`, zero contact blocks : four steps, four failures.

Use the calendar instead. `get_calendar_events` with `userIds: [${MODJO_USER_ID}]` and a `dateRange` roughly an hour either side of the call `date`, match on event `title` against the call `name` (Modjo names the recording after the calendar event). Attendees carry `contactCrmId` already resolved by Modjo, plus `account.crmId` and `deal.crmId`.

Two bonuses worth writing into the note:
- `attendees[].status` is `accepted` | `pending` | `declined` | `cancelled`. A no-show against `accepted` is a broken commitment; a no-show against `pending` was never confirmed. Say which.
- Internal attendees carry `userId`, external ones carry `contactCrmId`. Separates counterpart from colleagues without guessing from the email domain.

**The calendar can be empty too.** Filtered to a `userId`, `get_calendar_events` excludes events that user declined or deleted, and cancelled events drop out tenant-wide. <COMPANY_10> is exactly this case : the meeting was pulled from the calendar after the fact. Last resort:

5. **Parse the call name.** Modjo titles follow `☎️ "CloudTalk & <token> : <Meeting Type>"`. The token is populated from the HubSpot contact's first name via the calendar template : so it is a **first-name candidate first**, even when it looks like a company abbreviation, an acronym, or gibberish. `search_crm_objects` CONTACT with the token against `firstname`, then against `lastname`, then against company `name` : in that order. Only fall through to the next lookup once the previous one returned zero. Do not pre-classify the token as "looks like a company" and skip the contact search : that is exactly what happened on call `<CALL_ID_6>` (token `<FIRSTNAME_TOKEN>`, contact `<CONTACT_14>` on file). Step 5 is fuzzy by construction : never let it write without passing the duplicate rule.

Worked example : call <CALL_ID_6> (2026-09-01):

- Title: `☎️ "CloudTalk & <FIRSTNAME_TOKEN> : Exploration Meeting"`
- Token: `<FIRSTNAME_TOKEN>`
- `search_crm_objects` CONTACT `firstname CONTAINS_TOKEN <FIRSTNAME_TOKEN>` -> hit: contact `<CONTACT_ID_14>` `<CONTACT_14>` (`<EMAIL_1>`, owner `${HUBSPOT_OWNER_ID}`, `hs_lead_status = Demo no show`)
- Zero counterpart transcript blocks + `google_recording_bot` + anchor resolved -> Bucket 4 (No show), write it.

The lookup order matters: token as `firstname` beats token as company, because the calendar template populates first name; the token here is a person's first name in HubSpot, not a company abbreviation. The company field on that contact is unrelated to the token.

## Duplicate contacts : pick by owner, then stop

A name search hits duplicates. "<COMPANY_10>" returns two records for the same person, <CONTACT_15>: `<CONTACT_ID_1>` (<EMAIL_2>, owner `${HUBSPOT_OWNER_ID}`, `ATTEMPTED_TO_CONTACT`, created 2026-08-19) and `<CONTACT_ID_15>` (<EMAIL_3>, no owner, `NEW`, created 2026-07-27).

Rule, in order, stopping at the first that leaves exactly one:

1. Keep only contacts where `hubspot_owner_id` is `${HUBSPOT_OWNER_ID}`.
2. Keep the one with an existing meeting or call engagement in the call's window.
3. Keep the most recently created.

Still more than one -> `NEEDS_ANCHOR`. Do not guess. A no-show note on the wrong record tells the next rep to stop chasing someone who never missed anything.

Flag `ATTEMPTED_TO_CONTACT` when you see it here : it labels as "Qualified Out", which cannot be true of a contact who had a live meeting booked, so the record is stale. Mention it in the report; do not silently fix it.

## Transcript payload gotcha

`callId` in `get_transcript` output is a **number**, not a string. Filtering with a string comparison returns empty silently. On large payloads that overflow to a file, build an index map of `transcripts[i].callId` first, then address the array position:

```bash
jq -r '.transcripts[14].blocks[] | "[\(.speaker.name)|\(.speaker.type)] \(.content)"' <file>
```

## Reference implementation

Note `<NOTE_ID_4>` on contact `<CONTACT_ID_16>` (<CONTACT_16>, <COMPANY_12>) is the live Bucket 2 exemplar. Read it before writing a new note if the shape is unclear.

Verified end-to-end write on 2026-08-31: call `<CALL_ID_13>` -> note `<NOTE_ID_1>` on contact `<CONTACT_ID_1>`. Single `createRequest` call, both associations returned `successful: 2, failed: 0`, pin applied, `CONTAINS_TOKEN` search for `callsync<CALL_ID_13>` returned exactly one hit within seconds of the write. Indexing is fast enough that dedup is safe at a 15-minute cadence.
