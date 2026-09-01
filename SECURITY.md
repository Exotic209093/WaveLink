# Security Policy

WaveLink handles live Salesforce sessions and customer data workflows, so
security reports are taken seriously and handled with priority.

## Supported versions

Only the latest release published on the Chrome Web Store and the current
`main` branch receive security fixes.

## Reporting a vulnerability

Please **do not** open a public issue for anything you believe is exploitable.

1. Preferred: open a **private security advisory** — [Report a vulnerability](https://github.com/Exotic209093/WaveLink/security/advisories/new).
2. If that is not possible, open a GitHub issue with the `security` label and
   *omit exploit details*; a maintainer will follow up privately.

Please include a description, reproduction steps, potential impact, and a
suggested fix if you have one. We aim to acknowledge reports within 48 hours
and to ship a fix for confirmed issues within 30 days.

## Scope notes

- WaveLink is local-first: it makes network requests only to the Salesforce
  orgs the user connects. Anything that causes data or credentials to leave
  the device otherwise is in scope and high priority.
- The full security architecture, data inventory, and threat model are
  documented in [`docs/SECURITY.md`](docs/SECURITY.md). Known, publicly
  tracked security work is labelled
  [`security`](https://github.com/Exotic209093/WaveLink/issues?q=label%3Asecurity)
  on the issue tracker.
