# WaveLink launch kit

Prepared 2026-10-04 from the Chrome Web Store analytics for 2026-07-05 to 2026-10-02;
refreshed 2026-10-22 for the 1.0.0 launch. 0.7.x was never uploaded, so 1.0.0 is
the first store update since 0.6.0.

## Baseline (record before launch)

| Metric | Value | Source |
|---|---:|---|
| Weekly users | 15 | Users, last 30 days |
| Store impressions | 87 / 30 days | Impressions |
| Listing page views | 16 / 30 days | Impressions |
| Installs | 130 / 90 days (~10 appear human; the rest are a steady US ChromeOS trickle with no language data that never shows up as users) | Installs & uninstalls |
| Uninstalls | 2 / 90 days | Installs & uninstalls |
| Campaign / medium traffic | none | Impressions |

Target: **50 weekly users by 2026-12-31.** Review the dashboard every Monday and
log the numbers in [`metrics-log.md`](metrics-log.md).

## Before posting anywhere

1. **Ship 1.0.0 first.** The store still serves 0.6.0. 1.0.0 contains every
   audit fix (import, schedules, security, export fidelity) plus the Help →
   Feedback & Support links, so launch traffic has somewhere to report bugs.
   Follow the submission checklist in [`CHROME_WEB_STORE.md`](CHROME_WEB_STORE.md).
2. **Wait for the store to serve 1.0.0.** Review usually takes a few days.
   Install it from the store yourself before posting anything.
3. **Log the launch-day row** in [`metrics-log.md`](metrics-log.md).
4. **Then promote freely.** Lead with backups, the roadmap's wedge: free, local,
   scheduled backups with snapshot diff, which the dominant free tools lack.
   Export stays the strongest search hook, and import can be promoted too.

## Store listing for 1.0

The name and summary ship in `public/_locales/*/messages.json`, so they change
with the package upload. The description, screenshots, video, and localised
descriptions are edited in the dashboard. The English description and release
notes live in [`CHROME_WEB_STORE.md`](CHROME_WEB_STORE.md); edit them there, not
here.

### Name (52 / 75 characters)

> WaveLink — Salesforce SOQL Export & Data Import Tool

### Summary (≤132 characters)

> Export Salesforce data with SOQL to CSV, Excel, JSON or XML right in Chrome. No Java, no install, no server. Free and open source.

The summary is unchanged so the eight translated summaries stay valid. The
description carries the search terms the roadmap wants ("backup", "Data Loader").

### Screenshot order

Put export first; it is the safest and most searched-for job. All five are
captures of the 1.0.0 build.

1. `screenshots/screenshot-02-export.png` — SOQL export and results
2. `screenshots/screenshot-01-home.png` — Home workspace
3. `screenshots/screenshot-04-compare.png` — Compare
4. `screenshots/screenshot-05-activity.png` — Jobs and activity
5. `screenshots/screenshot-03-import-review.png` — Import review

### Videos

| Use | File | Length |
|---|---|---:|
| Store listing (unlisted YouTube link) | `promo/motion/output/cut-30/wavelink-30s.mp4` | 30 s |
| LinkedIn native upload | `promo/motion/output/cut-30/wavelink-30s.mp4` | 30 s |
| Short loops (Reddit, Discord, replies) | `promo/motion/output/wavelink-15s.mp4` | 15 s |
| Voiced walkthrough (optional) | `promo/brag/2026-10-04-launch-0.7/brag.mp4` | 25 s |

The 30-second cut is the roadmap's "30-second demo video". The voiced cut uses
an ElevenLabs free-tier voice; confirm its licence allows promotional use before
publishing it.

### Other languages

Spanish, Japanese, German, French, Portuguese (Brazil), Italian, Dutch, and
Korean descriptions are in [`store-listings/`](store-listings/README.md). They
predate the backup-first English description but are still accurate. Paste
them as they are, and retranslate later if a language starts bringing traffic.

## Tracked links

Base: `https://chromewebstore.google.com/detail/wavelink/ccknhhibbedolfnbgnenomdohlmojblo`

| Channel | Link suffix |
|---|---|
| Reddit | `?utm_source=reddit&utm_medium=social&utm_campaign=launch-1-0` |
| LinkedIn (personal) | `?utm_source=linkedin&utm_medium=social&utm_campaign=launch-1-0` |
| LinkedIn (company) | `?utm_source=linkedin-apex&utm_medium=social&utm_campaign=launch-1-0` |
| Trailblazer Community | `?utm_source=trailblazer&utm_medium=community&utm_campaign=launch-1-0` |
| SFXD Discord | `?utm_source=sfxd&utm_medium=community&utm_campaign=launch-1-0` |
| Stack Exchange | `?utm_source=sfse&utm_medium=answer&utm_campaign=evergreen` |
| GitHub README | `?utm_source=github&utm_medium=readme&utm_campaign=evergreen` |
| Review request | `?utm_source=email&utm_medium=direct&utm_campaign=reviews` |

These populate the dashboard's "Page views by campaign / medium" charts.

## Posts

Space the posts over a week rather than one day, and reply to every comment
within a few hours; early engagement drives most of the reach. Suggested order:
Reddit (day 1), LinkedIn personal (day 2), SFXD and Trailblazer (days 3–4),
company page (day 5), Stack Exchange answers on an ongoing basis.

### Reddit — r/salesforce

Check the subreddit's current self-promotion rule first; post as a personal
project, not an ad. Attach `screenshot-02-export.png` or the 15-second loop.

**Title:** I built a free, open-source Chrome extension for scheduled Salesforce backups and SOQL exports — v1.0 today

**Body:**

> I'm a Salesforce consultant. Two things kept annoying me: firing up Data Loader (and Java) for a quick export, and having no simple, free way to keep regular backups of key objects and see what changed. So I built WaveLink, and today it hits 1.0.
>
> It runs in the browser tab you're already logged into:
>
> - **Scheduled local backups** of the objects you pick, with a diff between any two snapshots
> - **SOQL export** with autocomplete or a visual builder → CSV / Excel / JSON / XML, with Bulk API 2.0 for big objects
> - **Compare** two files, two snapshots, or two orgs field-by-field
> - **Guided import** with mapping, dry runs, per-row results, and a typed confirmation before writing to production
>
> 1.0 is more of a trust release than a feature release. I ran a full adversarial audit of the write paths, scheduling, and token handling, found 46 issues, and fixed every one with a regression test before calling it 1.0. The audit and the fixes are public in the repo.
>
> There's no backend, no analytics, and no telemetry. Records never touch a server of mine, and session tokens aren't stored on disk. It's MIT-licensed: https://github.com/Exotic209093/WaveLink
>
> Chrome Web Store: <Reddit tracked link>
>
> I'd genuinely like feedback: what would make you use this instead of Data Loader, Inspector, or a paid backup tool? If something breaks, there's a "Report a bug" link under Help.

### LinkedIn — personal

Attach the 30-second video natively (upload the MP4) rather than linking YouTube.

> WaveLink 1.0 is out.
>
> Every Salesforce admin knows the routine: you need a quick export, so you open Data Loader, wait for Java, log in again, and click through five screens. And regular backups of your key objects usually mean a paid tool or a script nobody maintains.
>
> WaveLink is a free Chrome extension that uses the Salesforce session you already have:
>
> → Schedule local backups and see exactly what changed between snapshots
> → Write or build a SOQL query and export CSV, Excel, JSON, or XML
> → Compare two orgs field-by-field
> → Import with dry runs and a typed confirmation before production writes
>
> Getting to 1.0 meant auditing every write path and fixing 46 issues before adding a single new feature. Privacy was non-negotiable: no analytics, no backend, and your records never leave your browser. The code is open source on GitHub.
>
> Try it here: <LinkedIn personal tracked link>
>
> If you try it, I'd love to hear what you'd want next.
>
> #Salesforce #SalesforceAdmin #Trailblazer #SOQL

### LinkedIn — Apex Infinity Solutions page

> WaveLink 1.0 is here: a free Chrome extension for Salesforce backups and exports, built by our team.
>
> Schedule local backups of key objects and compare any two snapshots, or export SOQL results straight to CSV, Excel, JSON, or XML with no Java or desktop install. It's open source, has no backend, and keeps your records in your browser. We use it on client projects every day.
>
> Add it to Chrome: <LinkedIn company tracked link>
>
> #Salesforce #SalesforceConsulting

### Trailblazer Community (Admin / Developer groups)

**Title:** Free browser tool for scheduled backups and SOQL exports — 1.0, feedback welcome

> Sharing a free, open-source Chrome extension I built. It schedules local backups of the objects you choose and diffs any two snapshots. You can also write SOQL (or use a visual builder), preview the records, choose columns, and download CSV, Excel, JSON, or XML. Bulk API 2.0 handles large objects.
>
> It needs no Java or desktop install, and there's no backend, so data stays in your browser. Version 1.0 follows a full audit of the import, scheduling, and security paths.
>
> <Trailblazer tracked link>
>
> I'd like feedback from admins on what would make it part of your daily toolkit.

### SFXD Discord (#show-and-tell or equivalent)

Attach the 15-second loop.

> WaveLink 1.0 is out: a free, MIT-licensed Chrome extension for scheduled local Salesforce backups with snapshot diff, plus SOQL exports to CSV / Excel / JSON / XML using your existing session. Bulk API 2.0, org-to-org compare, guarded imports. No backend or telemetry. Feedback very welcome: <SFXD tracked link>

### Salesforce Stack Exchange

Do not post the link as a standalone answer. Answer questions about exporting
query results, SOQL to CSV, backing up records, or Data Loader alternatives
properly first; mention WaveLink as one option at the end with a disclosure:

> Disclosure: I wrote WaveLink, a free open-source Chrome extension that does this — <Stack Exchange tracked link>.

## Review request

Send these one at a time (not BCC) to colleagues and friendly client admins who
have actually used WaveLink. Wait about a week after launch so they've had a
chance to try 1.0.

**Subject:** Quick favour — a review for WaveLink?

> Hi <name>,
>
> Thanks for trying WaveLink. Version 1.0 just went live on the Chrome Web Store, and it has no reviews yet, which makes it hard for other admins to find.
>
> If it's been useful, would you leave a short, honest review? It takes about a minute: <review tracked link> → "Add a review".
>
> If something didn't work, I'd rather hear it directly. Just reply here, or use Help → Report a bug in the extension.
>
> Thanks,
> James

Don't offer anything in return for reviews; the Chrome Web Store policies prohibit incentivised ratings.
