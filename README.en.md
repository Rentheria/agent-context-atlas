> 🌐 **English** (this file) · [**Español**](README.md)

# agent-context-atlas

[![CI](https://github.com/Rentheria/agent-context-atlas/actions/workflows/ci.yml/badge.svg)](https://github.com/Rentheria/agent-context-atlas/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Wiki + typed doc graph + hybrid RAG for **agent/machine context**.  
Not a spend tracker.

**Owner:** Alejandro Rentheria ([Rentheria](https://github.com/Rentheria)). Portfolio product, MIT.

## TL;DR

Markdown fiches (one per machine/role/bot) + typed edges + incremental embeddings + `atlas query`. If a metric is not in the corpus, the answer is exactly **`falta el dato`**. Synthetic fixtures only.

## MVP

1. **Markdown fiches** (one file per machine/role/bot) + **typed document graph** with edges `comes_from` | `leads_to` | `related` | `owns`. Readable markdown navigation is a **view** of the graph, not a second source of truth.
2. **Hybrid RAG:** chunk docs + incremental embeddings (re-embed only when `content_hash` changes) + expand graph neighbors on query. Ingest embeddings via OpenAI-compatible `POST /v1/embeddings` (local or cloud). **No API keys in the repo**; use environment variables.
3. **Query CLI** (and a thin library API) that **never invents measured numbers**. If a metric is not in the corpus, answer exactly: `falta el dato`.

## Policy: synthetic fixtures only

This repository includes **zero** private infra from any real deployment: no real host/boot/provisioning names, private IPs, credentials, inventories, teammate nicknames, or anything that fingerprints private infrastructure.

Demo ids only: `host-demo-01`, `bot-alpha`, `role-coordinator`, `bot-beta`, `role-operator`, `org-example`.

## Quickstart

Requires Node ≥ 20.

```bash
git clone https://github.com/Rentheria/agent-context-atlas.git
cd agent-context-atlas
npm install
cp .env.example .env   # fill URL/model/key on your machine
npm run build
npx atlas ingest --fiches fixtures/fiches --graph fixtures/graph.json
npx atlas query "RAM_GB de host-demo-01"
npx atlas query "latencia de bot-alpha"
```

The second query should print exactly `falta el dato` (that metric is not in the fiches).

Without building:

```bash
npm run atlas -- ingest
npm run atlas -- query "max_context_tokens of bot-alpha"
```

Local index: `.atlas/` (gitignored). Ingest writes `.atlas/NAV.md` — markdown nav generated from the graph.

## Environment variables

| Variable | Meaning |
| --- | --- |
| `ATLAS_EMBEDDINGS_BASE_URL` | OpenAI-compatible base. Default: `https://api.openai.com/v1`. Local example: `http://localhost:11434/v1`. |
| `ATLAS_EMBEDDINGS_MODEL` | Embedding model. Default: `text-embedding-3-small`. |
| `ATLAS_EMBEDDINGS_API_KEY` | Optional (many local servers skip it). `OPENAI_API_KEY` is also read. |

Never commit `.env`. The client `POST`s `{baseUrl}/embeddings`.

## Library

```ts
import { ingest, query, FALTA_EL_DATO } from "agent-context-atlas";
```

`query()` is extractive: it quotes the corpus or returns `falta el dato`. It does not generate figures.

## Development

```bash
npm test        # Vitest; embeddings HTTP is mocked
npm run typecheck
```

## See also

Portfolio siblings — **spend vs context**:

- [llm-agent-spend-manager](https://github.com/Rentheria/llm-agent-spend-manager) — LLM spend/activity visibility (complementary: spend vs context)
- [cursor-native-agent](https://github.com/Rentheria/cursor-native-agent)
- [chatarmor](https://github.com/Rentheria/chatarmor)
- [llm-budget-cap](https://github.com/Rentheria/llm-budget-cap)

## License

[MIT](LICENSE) © Alejandro Rentheria
