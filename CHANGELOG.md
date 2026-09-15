# Changelog

All notable changes to this project are documented here. Dates are release tags, not measured timings.

## [0.2.2] — 2026-09-15

Demo-friendly CLI: clear embeddings errors and an offline `--mock` path. No npm publish; no git tag.

### Added

- `atlas ingest --mock` and `atlas query --mock "..."` — deterministic bag-of-words embeddings, no network. Extractive answers and exactly `falta el dato` still apply. Ingest and query must both use `--mock` (model id `atlas-mock`).
- Library helpers: `createMockEmbeddings`, `mockEmbeddingVector`, `assertEmbeddingsReady`, `isLocalEmbeddingsBaseUrl`, `MISSING_EMBEDDINGS_CREDENTIALS_MESSAGE`.
- `atlas graph --out <file>` writes mermaid or DOT while still printing to stdout.
- Documented `atlas doctor --json` object shape (`ok`, `ficheCount`, `ficheIds`, `edgeCount`, `danglingEdges`, `orphans`, `guardHits`) with a stable schema assertion in tests.

### Fixed

- Cloud embeddings (default OpenAI or any non-local `ATLAS_EMBEDDINGS_BASE_URL`) without `ATLAS_EMBEDDINGS_API_KEY` / `OPENAI_API_KEY` fail **before** HTTP with a bilingual, actionable message. HTTP **401** is rewritten to the same message — never a raw OpenAI 401 as the primary UX. Local servers (loopback / RFC1918) still work without a key.

### Changed

- Package version `0.2.1` → `0.2.2`.

## [0.2.1] — 2026-09-15

JR review leftovers (P1 + cheap P2). MVP answers are unchanged. No npm publish; 0.2.0 release/tag is created outside this change.

### Added

- Barrel smoke test: imports the public `src/index.ts` surface and asserts `ingest`, `query`, `FALTA_EL_DATO`, `doctorCorpus`, embeddings helpers, and other library exports exist.
- Bounded embeddings HTTP retry on **429** and **5xx**: 1 initial attempt + up to 2 retries (3 calls max), 50ms then 150ms backoff. Other 4xx are not retried.
- `atlas --version` / `-v` prints the `package.json` version and exits 0.

### Fixed

- Embeddings HTTP error text no longer inserts a double space when `statusText` is empty.

### Security

- `vitest` / `@vitest/coverage-v8` stay on the latest 3.2.x (`^3.2.7`). Remaining moderate [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) (`@vitest/mocker`) has **no 3.x patch** (fixed in 4.1.11 / 5.0.x). Documented as accepted **devDependency** coverage-tooling risk in `SECURITY.md`. No `npm audit` ignore-all.

### Changed

- Package version `0.2.0` → `0.2.1`.

## [0.2.0] — 2026-09-15

Packaging, graph UX, and a machine-local performance suite. MVP behavior is unchanged: extractive answers, exactly `falta el dato` when a metric is missing, OpenAI-compatible embeddings via env, synthetic fixtures only.

### Added

- `CHANGELOG.md` and a GitHub Release workflow on `v*` tags (no npm publish; `prepack` / `prepublishOnly` still build `dist/`).
- Vitest coverage (`@vitest/coverage-v8`) and a CI coverage step with a modest threshold.
- `examples/synthetic-quickstart.md` — copy-paste commands on fixtures only (tests/bench mock HTTP; no API key required on that path).
- Mermaid view of typed edges after ingest: `.atlas/NAV.md` includes a `flowchart LR` fence; `.atlas/GRAPH.mmd` is the same graph as a standalone diagram.
- `npm run bench` (`tsx scripts/bench.ts`) — synthetic corpus, cold ingest vs unchanged re-ingest (`content_hash` reuse), query p50/p95 including a `falta el dato` question. Default mode is **mock** (CI-safe). Optional `--mode http` uses the existing embeddings env vars. Writes `bench-results.json` (gitignored).
- `atlas query --json` for machine-readable `{ answer, sources, neighbors }`.
- `ROADMAP.md` (public P0/P1/P2; no private ops).
- `atlas doctor` — edges must reference existing fiches; reports orphan fiches; generic synthetic guardrails on fixture text.
- `atlas graph --format mermaid|dot` to stdout (in addition to ingest `NAV.md` / `GRAPH.mmd`).
- CI smoke: `npm run bench -- --ci` / `npm run bench:ci` (hard: embedding reuse + `falta el dato`; soft timing warnings only).
- Richer `examples/` (hit vs `falta el dato`, `graph.mmd`) and a Mermaid snippet in the README.
- Coverage badge (Vitest v8 in CI). Commented npm version badge until a registry publish.

### Guardrails

- Stronger generic scans (IPv4, private IPv6 prefixes, private-looking host suffixes, credential-like *values*). No teammate nicknames or private product names as string literals.

### Changed

- Package version `0.1.0` → `0.2.0`.
- README (ES + EN): naming note (public synthetic wiki/RAG toolkit — not a private ops inventory, not a personal notes vault); Rendimiento / Performance section that points at `npm run bench` and does not publish invented timings.
- CI still typechecks and tests on push/PR to `main` and `dev`; also runs coverage and `npm run bench:ci`.

## [0.1.0] — 2026-09-13

Initial public MVP. GitHub Release notes for tag `v0.1.0` should match these bullets
([releases](https://github.com/Rentheria/agent-context-atlas/releases/tag/v0.1.0)).

### Added

- **Markdown fiches** (one file per machine/role/bot) + **typed document graph** with edges `comes_from` | `leads_to` | `related` | `owns`. Readable markdown navigation is a **view** of the graph, not a second source of truth.
- **Hybrid RAG:** chunk docs + incremental embeddings (re-embed only when `content_hash` changes) + expand graph neighbors on query. Ingest embeddings via OpenAI-compatible `POST /v1/embeddings` (local or cloud). **No API keys in the repo**; environment variables only.
- **Query CLI** (`atlas ingest` / `atlas query`) and a thin library API that **never invents measured numbers**. If a metric is not in the corpus, the answer is exactly `falta el dato`.
- Synthetic fixtures only (`host-demo-01`, `bot-alpha`, `role-coordinator`, `bot-beta`, `role-operator`, `org-example`).
- MIT license.
