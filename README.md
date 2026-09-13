> 🌐 **Español** (este archivo) · [**English**](README.en.md)

# agent-context-atlas

[![CI](https://github.com/Rentheria/agent-context-atlas/actions/workflows/ci.yml/badge.svg)](https://github.com/Rentheria/agent-context-atlas/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Wiki + grafo tipado + RAG híbrido para **contexto de agentes/máquinas**.  
No es un tracker de gasto.

**Owner:** Alejandro Rentheria ([Rentheria](https://github.com/Rentheria)). Producto de portafolio, MIT.

## TL;DR

Fichas Markdown (una por máquina/rol/bot) + grafo con aristas tipadas + embeddings incrementales + `atlas query`. Si una métrica no está en el corpus, la respuesta es exactamente **`falta el dato`**. Solo fixtures sintéticos.

## MVP

1. **Fichas Markdown** (un archivo por máquina/rol/bot) + **grafo de documentos tipado** con aristas `comes_from` | `leads_to` | `related` | `owns`. La navegación Markdown es una **vista** del grafo, no una segunda fuente de verdad.
2. **RAG híbrido:** trocea docs + embeddings incrementales (re-embebe solo si cambia `content_hash`) + expande vecinos del grafo al consultar. Ingiere embeddings vía `POST /v1/embeddings` compatible con OpenAI (local o nube). **Sin API keys en el repo**; solo variables de entorno.
3. **CLI de consulta** (y API de librería delgada) que **nunca inventa números medidos**. Si una métrica no está en el corpus, responde exactamente: `falta el dato`.

## Política: solo fixtures sintéticos

Este repositorio **no** incluye infraestructura privada de ningún despliegue real: nada de PXE, IPs, hostnames, rutas de fábrica, scrapers, credenciales, inventarios ni notas de ops.

Solo ids de demostración: `host-demo-01`, `bot-alpha`, `role-coordinator`, `bot-beta`, `role-operator`, `org-example`.

## Quickstart

Requisito: Node ≥ 20.

```bash
git clone https://github.com/Rentheria/agent-context-atlas.git
cd agent-context-atlas
npm install
cp .env.example .env   # rellena URL/modelo/clave en tu máquina
npm run build
npx atlas ingest --fiches fixtures/fiches --graph fixtures/graph.json
npx atlas query "RAM_GB de host-demo-01"
npx atlas query "latencia de bot-alpha"
```

La segunda consulta debe imprimir exactamente `falta el dato` (esa métrica no está en las fichas).

Sin compilar:

```bash
npm run atlas -- ingest
npm run atlas -- query "max_context_tokens of bot-alpha"
```

Índice local: `.atlas/` (gitignored). La ingestión escribe `.atlas/NAV.md` — navegación Markdown generada desde el grafo.

## Variables de entorno

| Variable | Qué es |
| --- | --- |
| `ATLAS_EMBEDDINGS_BASE_URL` | Base OpenAI-compatible. Default: `https://api.openai.com/v1`. Para un servidor local: `http://localhost:11434/v1`. |
| `ATLAS_EMBEDDINGS_MODEL` | Modelo de embeddings. Default: `text-embedding-3-small`. |
| `ATLAS_EMBEDDINGS_API_KEY` | Opcional (muchos servidores locales no la piden). También se lee `OPENAI_API_KEY`. |

Nunca commitees `.env`. El cliente hace `POST {baseUrl}/embeddings`.

## Librería

```ts
import { ingest, query, FALTA_EL_DATO } from "agent-context-atlas";
```

`query()` es extractivo: cita el corpus o devuelve `falta el dato`. No genera cifras.

## Desarrollo

```bash
npm test        # Vitest; HTTP de embeddings mockeado
npm run typecheck
```

## See also

Complementarios de portafolio — **gasto vs contexto**:

- [llm-agent-spend-manager](https://github.com/Rentheria/llm-agent-spend-manager) — visibilidad de gasto/actividad LLM (complementario: spend vs context)
- [cursor-native-agent](https://github.com/Rentheria/cursor-native-agent)
- [chatarmor](https://github.com/Rentheria/chatarmor)
- [llm-budget-cap](https://github.com/Rentheria/llm-budget-cap)

## Licencia

[MIT](LICENSE) © Alejandro Rentheria
