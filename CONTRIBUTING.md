# Contributing

PRs welcome. Keep the MVP small.

## Branching

- Default working branch: **`dev`**
- Open pull requests **against `dev`**, not `main`
- Do not merge to `main` from a contribution unless a maintainer asks

## Setup

```bash
npm install
npm test
npm run typecheck
```

Node ≥ 20. Embeddings HTTP is mocked in tests — no API key required.

## Rules

- **Synthetic fixtures only.** No real people/teammate nicknames, PXE/fleet/factory/lab host naming, IPs, private paths, scrapers, credentials, inventories, or ops notes. Use obviously fake ids: `host-demo-01`, `bot-alpha`, `role-coordinator`, `org-example`.
- **Never invent measured numbers.** If a metric is not in the corpus, the answer is exactly `falta el dato`.
- No multi-tenant SaaS, auth product, or hosting features.
- Do not commit `.env`, `dist/`, `node_modules/`, or local index artifacts (`.atlas/`, `data/`).
- Keep the MIT license.

## Edge types

Only: `comes_from` | `leads_to` | `related` | `owns`.
