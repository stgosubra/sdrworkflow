# CloudTalk Cockpit - daily briefing dashboard

A local dashboard for a CloudTalk SDR/SE. Four modules: today's calls, a
minutes/cost calculator, SQL/SQO performance, and a self-served re-engagement
cohort. It runs on your own machine, pulls from your own HubSpot, and refreshes
itself on weekday mornings.

## Installing it

Ask Claude Code, in a folder you are happy to install into:

> import https://github.com/stgosubra/cloudtalk-cockpit and install it

Claude reads `skill/install/SKILL.md` and does the rest. It will ask you four
short questions - your name, your initials, your job title, and your HubSpot
owner ID - and handle everything else.

You will have to do exactly three things yourself:

1. Have **Node.js** installed. If you do not, get the LTS build from nodejs.org
   first.
2. **Approve four connector prompts** - Google Calendar, HubSpot, Gmail and
   Lusha - once each. The dashboard pulls your pipeline with your own access;
   there are no shared credentials anywhere in this repo.
3. **Click "Run now" once** on the scheduled task after it is created. A brand
   new task has no approvals banked yet, and without one manual run its first
   automatic fire can quietly do nothing.

Everything else is automated.

## How it works

There is no server and no database. Each weekday morning a scheduled Claude task
pulls Calendar, HubSpot, Gmail and Lusha, and writes three data files through
validating generators in `scripts/`. The React app just renders those files. If
a morning is missed, the app says so with a STALE banner rather than quietly
showing yesterday's numbers as today's.

Module 01 runs first as a hard gate. It briefs calls happening in the next few
hours, so if it fails the run stops rather than burying the failure under two
successful reports.

## Your data stays yours

The generated files under `src/modules/*/data.js` contain live customer names,
emails and phone numbers. They are gitignored and never leave your machine.
Nothing in this repository contains customer data - the committed
`data.seed.js` files are structurally identical but completely empty, and exist
only so a fresh clone builds before the first refresh.

`src/config.js` is gitignored for the same reason at a smaller scale - it is the
only file holding your real name, work email and HubSpot owner ID. The tracked
template is `src/config.example.js`, and it is all placeholders.

Do not commit a `data.js` or a `config.js`, and do not copy either from a
colleague.

## Day to day

- `npm run dev` - open the dashboard
- ask Claude to run `briefing-daily` - refresh now instead of waiting
- `npm run seed` - restore empty data files if one is deleted
- `npm run make-seeds` - regenerate the seeds after changing a payload shape

`REFRESH_SPEC.md` is the source of truth for every metric definition, cohort
rule and validation gate. Read it before changing anything a generator writes.

## Per-person settings

`src/config.js` holds the one block that differs between installs - name,
initials, title, owner ID. Portal ID and points quota are shared and should stay
identical for everyone. It is created from `src/config.example.js` on
`npm install` and never tracked.

## Manual setup (without the install skill)

If you prefer to set things up by hand instead of using the install skill:

1. Clone the repo and `cd daily-briefing`.
2. Run `npm install`. The postinstall script copies seed data and
   `src/config.example.js` to `src/config.js` if those files are absent.
3. Edit `src/config.js` with your real name, email, HubSpot owner ID, and
   timezone.
4. Edit `src/pacing.config.js` with your team roster - replace every
   `"SDR Name N"` and `"100000001"`-style placeholder with real names and
   HubSpot owner IDs.
5. Edit `src/deals.config.js` - replace `__OWNER_ID__`, `__OWNER_NAME__`, and
   `__OFFICE__` with your values from config.js.
6. If using the `briefing-daily` skill for automated refreshes, copy
   `skill/briefing-daily/config.example.json` to
   `~/.claude/skills/briefing-daily/config.local.json` and fill in your IDs.
7. Run `npm run dev` to start the dashboard.
