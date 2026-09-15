# Synthetic quickstart

Copy-paste only. Demo ids: `host-demo-01`, `bot-alpha`, `bot-beta`, `role-coordinator`, `role-operator`, `org-example`.

**No API key** is required for tests, `atlas ingest --mock` / `atlas query --mock`, or `npm run bench` (default `--mode mock`). Without `--mock`, the CLI talks to an OpenAI-compatible `POST /v1/embeddings` endpoint — set env locally, or you get a bilingual missing-key error (never a raw OpenAI 401).

## Install

```bash
npm install
```

## Ingest fixtures + query (library / after build)

Embeddings HTTP is **mocked in `npm test`**. For a live CLI demo without a server, use `--mock`. For real HTTP you need a reachable embeddings URL (see `.env.example`).

### Expected answers (fixtures)

| Question | Expected |
| --- | --- |
| `RAM_GB de host-demo-01` | A line that quotes **RAM_GB** and **4** (from `fixtures/fiches/host-demo-01.md`) |
| `max_context_tokens of bot-alpha` | Quotes **8192** |
| `latencia de bot-alpha` | exactly `falta el dato` |
| `cuántas GPU tiene host-demo-01` | exactly `falta el dato` |
| `RAM_GB de bot-alpha` | exactly `falta el dato` (that metric is on the host fiche, not the bot) |

```bash
npm test
npm run typecheck
```

Validate the fixture graph (no embeddings, no API key):

```bash
npx atlas doctor --fiches fixtures/fiches --graph fixtures/graph.json
npx atlas doctor --json --fiches fixtures/fiches --graph fixtures/graph.json
npx atlas graph --format mermaid
npx atlas graph --format mermaid --out examples/graph.mmd
npx atlas graph --format dot
```

`doctor` exits 0 on the shipped fixtures (every edge endpoint exists). Orphans would be listed as warnings.

After a successful ingest (CLI or library), the local index (gitignored) contains:

- `.atlas/index.json` — chunks + embeddings + graph
- `.atlas/NAV.md` — markdown nav **and** a Mermaid `flowchart LR` of typed edges
- `.atlas/GRAPH.mmd` — the same Mermaid graph as a standalone file

## Bench (mock, CI-safe)

```bash
npm run bench
# same as: npx tsx scripts/bench.ts --mode mock --fiches 80
npm run bench:ci
# same as: npx tsx scripts/bench.ts --ci   (mock, fewer fiches; CI smoke)
```

Prints a machine-local report: cold ingest vs unchanged re-ingest (embed count must drop to 0 when `content_hash` matches) and query p50/p95 on a **generated** synthetic corpus (`host-demo-*`, `bot-synth-*`, `role-synth-*`, `org-example` only). Optionally writes `bench-results.json` (gitignored).

Real HTTP (optional, local only):

```bash
npm run bench -- --mode http
```

Uses `ATLAS_EMBEDDINGS_BASE_URL`, `ATLAS_EMBEDDINGS_MODEL`, and `ATLAS_EMBEDDINGS_API_KEY` / `OPENAI_API_KEY`.

## CLI without an embeddings endpoint (`--mock`)

```bash
npm run build
npx atlas ingest --mock --fiches fixtures/fiches --graph fixtures/graph.json
npx atlas query --mock "RAM_GB de host-demo-01"
npx atlas query --mock "latencia de bot-alpha"
npx atlas query --mock --json "latencia de bot-alpha"
```

`--json` prints `{ "answer", "sources", "neighbors" }` with no extra `Fuentes:` lines.

Without building:

```bash
npm run atlas -- ingest --mock
npm run atlas -- query --mock "max_context_tokens of bot-alpha"
```

Live HTTP (optional): `cp .env.example .env` and omit `--mock`. Cloud URLs need `ATLAS_EMBEDDINGS_API_KEY`.
