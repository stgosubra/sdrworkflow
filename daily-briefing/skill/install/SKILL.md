---
name: daily-briefing-install
description: Use when a user asks to import, install or set up the CloudTalk daily-briefing dashboard from its GitHub repo. Handles dependencies, per-operator config, the refresh skill, the weekday scheduled task, the first data pull and verification.
---

# Installing the daily-briefing dashboard

The person running this is very likely **not technical**. They will have said
something close to "import this repo and install it" and nothing more. Do not
ask them to open a terminal, edit a file, or read JSON. Ask only the questions
in Step 2, in plain language, and do everything else yourself.

Never print a stack trace at them. If a step fails, say what broke in one
sentence, say what you need from them, and stop.

## What this installs

A local, static dashboard: four modules (Today, Calculator, Performance,
Self-Served) that read data files regenerated each weekday morning by a
scheduled Claude task. There is no server and no stored password. Claude itself
does the data pull at refresh time using the user's own connectors, which is why
they have to authorise those connectors once.

## Step 1 - prerequisites

Check Node.js is present:

```
node --version
```

If that fails, stop and tell them, in these words or close to them: *"You need
Node.js first. Download the LTS version from nodejs.org, run the installer, then
tell me to continue."* Do not try to install it for them.

Then clone the repo somewhere sensible (`~/Desktop/daily-briefing` is a fine
default) and `npm install` in it. `npm install` triggers a postinstall that
seeds empty data files so the app builds before any data exists - expect it to
say it seeded three modules. That is correct, not a warning.

## Step 2 - ask the four questions

Ask these together, conversationally. Everything else is derived.

1. Their full name, as it should appear in the sidebar.
2. Their initials for the avatar - offer the obvious one from their name.
3. Their job title for under the name, e.g. `SDR - EMEA` or `SE - EMEA`.
4. Their HubSpot owner ID, if they know it.

On the owner ID: if they do not know it, do not make them go and find it -
search HubSpot owners by their email and confirm the match back to them before
using it. Never guess this value. Every number on the dashboard is filtered by
it, so a wrong ID silently produces a complete, plausible dashboard belonging to
someone else.

Their timezone can be read from the system rather than asked.

## Step 3 - write the config

`npm install` already created `src/config.js` from `src/config.example.js`. Edit
the block between the `--- rewritten at install ---` markers in the copy with
their answers - every `__PLACEHOLDER__`, plus `ownerId`. Change nothing else in
that file: `PORTAL_ID` and `POINTS_QUOTA_PER_MONTH` are shared across the team.
Leave `OWNER_IDS` empty; it only powers optional leaderboard deep-links and
every caller guards on a miss.

`src/config.js` is gitignored on purpose - it is the one file holding a real
name, email and owner ID, and the repo is public. Do not edit
`src/config.example.js`.

Then install the refresh skill:

- Copy `skill/briefing-daily/SKILL.md` to
  `~/.claude/skills/briefing-daily/SKILL.md`.
- Copy `skill/briefing-daily/config.example.json` to
  `~/.claude/skills/briefing-daily/config.local.json`, replacing every
  `__PLACEHOLDER__` with the real value. `__PROJECT_PATH__` is the absolute path
  of the clone, and it appears twice.
- Set `previewName` to something unlikely to collide, e.g. their first name plus
  `-briefing`, and create `.claude/launch.json` in the clone with that same name
  if it is not already there.

The filled `config.local.json` lives outside the repo on purpose. It is
per-machine and must never be committed.

## Step 4 - connectors

The dashboard needs four connectors, and each throws a permission prompt the
first time. Tell them this is coming so the prompts are not a surprise, then run
one cheap read-only call against each, in this order, approving as you go:

1. **Google Calendar** - list today's events.
2. **HubSpot** - a single `COUNT(*)` on contacts for their owner ID.
3. **Gmail** - one thread search.
4. **Lusha** - one company lookup.

Calendar and HubSpot are mandatory. If either cannot be reached, stop - the
dashboard has nothing to show without them. Gmail and Lusha are optional
enrichment; note the gap and carry on.

## Step 5 - first refresh

Run the `briefing-daily` skill once, now, while they are watching. It does
module 01 first as a hard gate, then 03, then 04. This is also what banks the
tool approvals the unattended task will later need.

Report counts only. Never read a prospect name, email or phone number back to
them out of the data files - those hold live customer data.

## Step 6 - the scheduled task

Register the weekday task from `skill/briefing-daily/scheduled-task.json`.

Then have them click **Run now** once, manually. This is not optional and not
superstition: a freshly created task has no banked approvals, and its first
unattended fire can silently do nothing while still recording a clean
`lastRunAt`. One manual run fixes that permanently.

## Step 7 - verify, then hand over

Start the preview and confirm the app loads with no console errors, their name
in the sidebar, and no STALE banner. Then tell them, in plain language:

- how to open the dashboard again (`npm run dev` in the folder, or just ask
  Claude to start it),
- that it refreshes itself on weekday mornings,
- that a STALE banner means a morning refresh was missed and asking Claude to
  run `briefing-daily` fixes it,
- that the data stays on their machine and is never uploaded.

## Things that must not happen

- Do not commit or push anything. This is an install, not a contribution.
- Do not copy a `data.js` from anyone else's machine. It contains another
  person's customer data, and the numbers would be wrong anyway.
- Do not weaken `.gitignore`. It is the only thing keeping customer data out of
  a public repo.
- Do not edit a `data.js` by hand. The generators own those files and validate
  what goes into them.
