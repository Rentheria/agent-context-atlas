# Hit vs `falta el dato`

Synthetic fixtures only (`host-demo-01`, `bot-alpha`, `org-example`).  
Embeddings HTTP is mocked in `npm test` and `npm run bench` (default mock). No key required on that path.

The library is **extractive**. A **hit** quotes a line that is already in a fiche. A **miss** is exactly `falta el dato` — never an invented number.

## Hits (metric is in the corpus)

| Question | Why it hits | Expected shape |
| --- | --- | --- |
| `RAM_GB de host-demo-01` | `fixtures/fiches/host-demo-01.md` has `RAM_GB` / `4` | quotes **RAM_GB** and **4** |
| `max_context_tokens of bot-alpha` | `bot-alpha` fiche lists `8192` | quotes **8192** |
| `vCPU` on `host-demo-01` | same host table | quotes **2** |

```bash
# after ingest --mock (no API key / no network)
npx atlas query --mock "RAM_GB de host-demo-01"
npx atlas query --mock --json "max_context_tokens of bot-alpha"
```

## Misses (exactly `falta el dato`)

| Question | Why it misses |
| --- | --- |
| `latencia de bot-alpha` | no latency figure in any fiche |
| `cuántas GPU tiene host-demo-01` | host table has no GPU |
| `RAM_GB de bot-alpha` | RAM is on the **host** fiche, not the bot |

```bash
npx atlas query --mock "latencia de bot-alpha"
# → falta el dato

npx atlas query --mock --json "RAM_GB de bot-alpha"
# { "answer": "falta el dato", "sources": [...], "neighbors": [...] }
```

Same assertions live in `npm test` (`test/ingest-query.test.ts`, `test/answer.test.ts`) with a mock embeddings client.

## Validate the corpus (no embeddings)

```bash
npx atlas doctor --fiches fixtures/fiches --graph fixtures/graph.json
npx atlas graph --format mermaid --out examples/graph.mmd --fiches fixtures/fiches --graph fixtures/graph.json
npx atlas graph --format dot --fiches fixtures/fiches --graph fixtures/graph.json
```

`doctor` fails if a typed edge points at a missing fiche. Orphan fiches (no edges) are reported as warnings.
