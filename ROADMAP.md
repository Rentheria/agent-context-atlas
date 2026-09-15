# Roadmap

Public **synthetic** context wiki + typed graph + hybrid RAG toolkit.  
Not a private operations inventory. Not a personal notes vault.

P0 is shipped or in 0.2.x. Later items stay optional and local — no multi-tenant SaaS, no vault sync, no SQLite plugin in this repo.

## P0 — MVP + portfolio signal

- Markdown fiches + typed edges (`comes_from` | `leads_to` | `related` | `owns`)
- Incremental embeddings via `content_hash`; extractive `query` / exactly `falta el dato`
- OpenAI-compatible embeddings through env only
- Ingest views: `.atlas/NAV.md` + `.atlas/GRAPH.mmd`
- `atlas query --json`, `atlas doctor`, `atlas graph --format mermaid|dot` (`--out` in 0.2.2)
- Clear missing-key / missing-local-URL errors (no raw OpenAI 401 as primary UX) — 0.2.2
- `atlas ingest --mock` / `atlas query --mock` offline demo path — 0.2.2
- Mock `npm run bench` and CI smoke `npm run bench -- --ci`
- Synthetic-only fixtures and generic guardrail tests

## P1 — small robustness

- Richer citations in `--json` (chunk heading + score already present; keep extractive)
- Documented chunker knobs without changing default MVP answers
- More **synthetic** fixture kinds (still demo ids only)

## P2 — optional local adapters

- Additional graph layouts / exports (still generated views, not a second source of truth)
- Optional local embedding adapters that stay env-driven (no new auth product)

## Out of scope

- Publishing to the npm registry (package remains publish-ready)
- HTTP chat API / chatarmor integration
- Private vault sync or any real inventory
- Portfolio website card
- Merging contributor work to `main` unless a maintainer asks
