# WaveLink launch kit

Prepared 2026-10-04 from the Chrome Web Store analytics for 2026-07-05 to 2026-10-02.

## Baseline (record before launch)

| Metric | Value | Source |
|---|---:|---|
| Weekly users | 15 | Users, last 30 days |
| Store impressions | 87 / 30 days | Impressions |
| Listing page views | 16 / 30 days | Impressions |
| Installs | 130 / 90 days (~10 appear human; the rest are a steady US ChromeOS trickle with no language data that never shows up as users) | Installs & uninstalls |
| Uninstalls | 2 / 90 days | Installs & uninstalls |
| Campaign / medium traffic | none | Impressions |

Target: **50 weekly users by 2026-12-31.** Review the dashboard every Monday and log the four numbers above.

## Before posting anywhere

1. **Ship 0.7.0 first.** It contains every audit fix (import, schedules,
   security, export fidelity). Launch traffic should land on 0.7.0, not 0.6.0.
2. **Then promote freely.** With the v0.7.0 import fixes released, import can be
   promoted alongside export; export is still the strongest hook for search.

## Store listing v2

The name and summary live in `public/manifest.json`, so they change with the next
package upload. The description, screenshots, and localised listing are edited
in the dashboard.

### Name (52 / 75 characters)

> WaveLink — Salesforce SOQL Export & Data Import Tool

### Summary (≤132 characters)

> Export Salesforce data with SOQL to CSV, Excel, JSON or XML right in Chrome. No Java, no install, no server. Free and open source.

### Detailed description

> Get Salesforce data out in seconds — straight from the browser tab you're already logged into.
>
> WaveLink is a free, open-source data workspace for Salesforce admins, developers, and consultants. Write or build a SOQL query, preview the records, pick your columns, and download CSV, Excel, JSON, or XML. No Java runtime, no desktop Data Loader install, no third-party server holding your data.
>
> EXPORT
>
> • SOQL editor with autocomplete, plus a visual query builder for fields, filters, GROUP BY, and aggregates
> • REST for quick queries, Bulk API 2.0 for large objects — with progress and cancel
> • CSV, Excel (XLSX), JSON, or XML with only the columns you choose
> • Save queries as reusable jobs and re-run them in one click
>
> SNAPSHOTS AND COMPARE
>
> • Schedule recurring local snapshots of key objects
> • Compare two files, two snapshots, or two connected orgs field-by-field
>
> IMPORT
>
> • Guided CSV, JSON, and Excel import with field mapping, validation, and dry runs
> • Production warnings and typed confirmation before writes
>
> ADVANCED
>
> • Record Inspector, object and field browser, REST/Tooling API explorer, anonymous Apex, and API usage
>
> PRIVATE BY DESIGN
>
> WaveLink has no analytics, telemetry, advertising, or WaveLink backend. Your records stay in your browser and are exchanged only with the Salesforce orgs you select. Source code: https://github.com/Exotic209093/WaveLink
>
> Uses your existing Salesforce browser session. WaveLink is independent and is not affiliated with or endorsed by Salesforce, Inc.

### Screenshot order

Put export first; it is the safest and most searched-for job.

1. `screenshots/screenshot-02-export.png` — SOQL export and results
2. `screenshots/screenshot-01-home.png` — Home workspace
3. `screenshots/screenshot-04-compare.png` — Compare
4. `screenshots/screenshot-05-activity.png` — Jobs and activity
5. `screenshots/screenshot-03-import-review.png` — Import review

Add the promo video (`promo/output/wavelink-promo-full-polished.mp4`) as an
unlisted YouTube upload and paste the URL into the listing's video field.

### Spanish listing (Store listing → add language → Español)

**Resumen**

> Exporta datos de Salesforce con SOQL a CSV, Excel, JSON o XML desde Chrome. Sin Java ni instalaciones. Gratis y de código abierto.

**Descripción**

> Saca tus datos de Salesforce en segundos, desde la pestaña en la que ya iniciaste sesión.
>
> WaveLink es un espacio de trabajo de datos gratuito y de código abierto para administradores, desarrolladores y consultores de Salesforce. Escribe o arma una consulta SOQL, revisa los registros, elige las columnas y descarga en CSV, Excel, JSON o XML. Sin Java, sin instalar Data Loader y sin servidores de terceros con tus datos.
>
> EXPORTAR
>
> • Editor SOQL con autocompletado y constructor visual de consultas
> • REST para consultas rápidas y Bulk API 2.0 para objetos grandes
> • CSV, Excel (XLSX), JSON o XML solo con las columnas que elijas
> • Guarda consultas como trabajos reutilizables
>
> SNAPSHOTS Y COMPARACIÓN
>
> • Programa snapshots locales periódicos
> • Compara archivos, snapshots u orgs conectadas campo por campo
>
> IMPORTAR
>
> • Importación guiada de CSV, JSON y Excel con mapeo de campos, validación y simulación
>
> PRIVACIDAD
>
> Sin analítica, telemetría, publicidad ni servidores de WaveLink. Tus registros se quedan en tu navegador. Código fuente: https://github.com/Exotic209093/WaveLink
>
> WaveLink es independiente y no está afiliado ni respaldado por Salesforce, Inc.

The Spanish name and summary ship in `public/_locales/es/messages.json` (v0.7.1+); paste only the description in the dashboard. Have a native speaker skim it before publishing; it is written in neutral Latin American Spanish.

## Tracked links

Base: `https://chromewebstore.google.com/detail/wavelink/ccknhhibbedolfnbgnenomdohlmojblo`

| Channel | Link suffix |
|---|---|
| Reddit | `?utm_source=reddit&utm_medium=social&utm_campaign=launch-2026-10` |
| LinkedIn (personal) | `?utm_source=linkedin&utm_medium=social&utm_campaign=launch-2026-10` |
| LinkedIn (company) | `?utm_source=linkedin-apex&utm_medium=social&utm_campaign=launch-2026-10` |
| Trailblazer Community | `?utm_source=trailblazer&utm_medium=community&utm_campaign=launch-2026-10` |
| SFXD Discord | `?utm_source=sfxd&utm_medium=community&utm_campaign=launch-2026-10` |
| Stack Exchange | `?utm_source=sfse&utm_medium=answer&utm_campaign=evergreen` |
| GitHub README | `?utm_source=github&utm_medium=readme&utm_campaign=evergreen` |
| Review request | `?utm_source=email&utm_medium=direct&utm_campaign=reviews` |

These populate the dashboard's "Page views by campaign / medium" charts.

## Posts

Space the posts over a week rather than one day, and reply to every comment
within a few hours — early engagement is most of the reach.

### Reddit — r/salesforce

Check the subreddit's current self-promotion rule first; post as a personal
project, not an ad.

**Title:** I built a free, open-source Chrome extension for exporting Salesforce data with SOQL — no Java or Data Loader install

**Body:**

> I'm a Salesforce consultant and got tired of firing up Data Loader (and its Java install) every time I needed a quick export, so I built WaveLink.
>
> It runs in the browser tab you're already logged into:
>
> - Write SOQL (with autocomplete) or use the visual builder
> - Preview records, pick columns, download CSV / Excel / JSON / XML
> - Bulk API 2.0 for big objects
> - Schedule local snapshots and diff two files, snapshots, or orgs
>
> There's no backend — no analytics, no telemetry, and records never touch a server of mine. It's MIT-licensed, so you can read every line: https://github.com/Exotic209093/WaveLink
>
> Chrome Web Store: <Reddit tracked link>
>
> It also has guided import, but I'd treat export as the mature part today. I'd genuinely like feedback — what's missing that would make you use it instead of Data Loader or Inspector?

### LinkedIn — personal

> Every Salesforce admin knows the routine: you need a quick export, so you open Data Loader, wait for Java, log in again, and click through five screens.
>
> I built WaveLink to skip all that. It's a free Chrome extension that uses the Salesforce session you already have:
>
> → Write or build a SOQL query
> → Preview the records and pick your columns
> → Download CSV, Excel, JSON, or XML
>
> It handles large objects through Bulk API 2.0, can schedule local snapshots, and compares two orgs field-by-field.
>
> Privacy was non-negotiable: no analytics, no backend, and your records never leave your browser. The code is open source on GitHub.
>
> Try it here: <LinkedIn personal tracked link>
>
> If you try it, I'd love to hear what you'd want next.
>
> #Salesforce #SalesforceAdmin #Trailblazer #SOQL

Attach the promo video natively (upload the MP4) rather than linking YouTube.

### LinkedIn — Apex Infinity Solutions page

> Our team built WaveLink, a free Chrome extension for exporting Salesforce data with SOQL — straight to CSV, Excel, JSON, or XML, with no Java or desktop install.
>
> It's open source, has no backend, and keeps your records in your browser. We use it on client projects every day.
>
> Add it to Chrome: <LinkedIn company tracked link>
>
> #Salesforce #SalesforceConsulting

### Trailblazer Community (Admin / Developer groups)

**Title:** Free browser tool for SOQL exports to CSV/Excel — feedback welcome

> Sharing a free, open-source Chrome extension I built for quick Salesforce exports: write SOQL (or use a visual builder), preview, choose columns, and download CSV, Excel, JSON, or XML. Bulk API 2.0 handles large objects, and it can schedule local snapshots.
>
> It needs no Java or desktop install, and there's no backend — data stays in your browser.
>
> <Trailblazer tracked link>
>
> I'm looking for feedback from admins on what would make it part of your daily toolkit.

### SFXD Discord (#show-and-tell or equivalent)

> Built a free, MIT-licensed Chrome extension for SOQL exports → CSV / Excel / JSON / XML, using your existing session. Bulk API 2.0, scheduled local snapshots, org-to-org compare. No backend or telemetry. Feedback very welcome: <SFXD tracked link>

### Salesforce Stack Exchange

Do not post the link as a standalone answer. Answer questions about exporting
query results, SOQL to CSV, or Data Loader alternatives properly first; mention
WaveLink as one option at the end with a disclosure:

> Disclosure: I wrote WaveLink, a free open-source Chrome extension that does this — <Stack Exchange tracked link>.

## Review request

Send individually (not BCC) to colleagues and friendly client admins who have
actually used WaveLink.

**Subject:** Quick favour — a review for WaveLink?

> Hi <name>,
>
> Thanks for trying WaveLink. It's still new on the Chrome Web Store and has no reviews yet, which makes it hard for other admins to find.
>
> If it's been useful, would you leave a short, honest review? It takes about a minute: <review tracked link> → "Add a review".
>
> If something didn't work, I'd rather hear it directly — just reply here.
>
> Thanks,
> James

Don't offer anything in return for reviews; the Chrome Web Store policies prohibit incentivised ratings.
