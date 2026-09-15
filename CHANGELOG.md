# Changelog

All notable changes to this project are documented here. Dates are release tags, not measured timings.

## [0.2.0] — 2026-09-15

Packaging, graph UX, and a machine-local performance suite. MVP behavior is unchanged: extractive answers, exactly `falta el dato` when a metric is missing, OpenAI-compatible embeddings via env, synthetic fixtures only.

### Added

- `CHANGELOG.md` and a GitHub Release workflow on `v*` tags (no npm publish; `prepack` / `prepublishOnly` still build `dist/`).
- Vitest coverage (`@vitest/coverage-v8`) and a CI coverage step with a modest threshold.
- `examples/synthetic-quickstart.md` — copy-paste commands on fixtures only (tests/bench mock HTTP; no API key required on that path).
- Mermaid view of typed edges after ingest: `.atlas/NAV.md` includes a `flowchart LR` fence; `.atlas/GRAPH.mmd` is the same graph as a standalone diagram.
- `npm run bench` (`tsx scripts/bench.ts`) — synthetic corpus, cold ingest vs unchanged re-ingest (`content_hash` reuse), query p50/p95 including a `falta el dato` question. Default mode is **mock** (CI-safe). Optional `--mode http` uses the existing embeddings env vars. Writes `bench-results.json` (gitignored).
- `atlas query --json` for machine-readable `{ answer, sources, neighbors }`.

### Changed

- Package version `0.1.0` → `0.2.0`.
- README (ES + EN): short Rendimiento / Performance section that points at `npm run bench` and does not publish invented timings.
- CI still typechecks and tests on push/PR to `main` and `dev`; also runs coverage and the mock bench.

## [0.1.0] — 2026-09-13

Initial public MVP:

- Markdown fiches + typed document graph (`comes_from` | `leads_to` | `related` | `owns`).
- Incremental embeddings keyed by `content_hash`.
- Hybrid query (chunks + graph neighbors) that never invents measured numbers.
- Synthetic fixtures only (`host-demo-01`, `bot-alpha`, `org-example`, …).
- MIT license. CLI `atlas ingest` / `atlas query`.
