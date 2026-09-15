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
npm run test:coverage
npm run typecheck
npm run bench      # mock embeddings; no API key
```

Node ≥ 20. Embeddings HTTP is mocked in tests and in `npm run bench` (default `--mode mock`) — no API key required.

## Rules

- **Synthetic fixtures only.** No real host/boot/provisioning names, private IPs, credentials, inventories, teammate nicknames, or anything that fingerprints private infrastructure. Use obviously fake ids: `host-demo-01`, `bot-alpha`, `role-coordinator`, `org-example`.
- **Never invent measured numbers.** If a metric is not in the corpus, the answer is exactly `falta el dato`.
- No multi-tenant SaaS, auth product, or hosting features.
- Do not commit `.env`, `dist/`, `node_modules/`, local index artifacts (`.atlas/`, `data/`), or `bench-results.json`.
- Keep the MIT license.
- Add or update unit tests with every code change. Use `npm run bench` to show `content_hash` reuse; do not invent timings in the README.

## Edge types

Only: `comes_from` | `leads_to` | `related` | `owns`.
