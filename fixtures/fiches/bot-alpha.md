---
id: bot-alpha
kind: bot
title: Bot Alpha
---

# bot-alpha

Bot sintético de coordinación. `role-coordinator` lo posee (`owns`). Corre en `host-demo-01` (`comes_from`).

## Comportamiento

Lee fichas de contexto y responde sin inventar métricas. Si un número no está en el corpus, responde exactamente: falta el dato.

## Métricas en corpus

- max_context_tokens: 8192
