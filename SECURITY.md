# Security Policy

## Secrets

**Do not put secrets in this repository.** No API keys, tokens, credentials, or `.env` files.

Embeddings use environment variables only (`ATLAS_EMBEDDINGS_API_KEY` or `OPENAI_API_KEY`). Copy `.env.example` to `.env` on your machine.

This project ships **synthetic fixtures only**. Do not contribute real host/boot/provisioning names, private IPs, credentials, inventories, teammate nicknames, or anything that fingerprints private infrastructure.

## Reporting a vulnerability

Report privately instead of opening a public issue:

- Email: **rentheria.dev@gmail.com**
- Or GitHub [private vulnerability reporting](https://github.com/Rentheria/agent-context-atlas/security/advisories/new)

Include what you found, how to reproduce it, and its potential impact.

## Development tooling advisories

`vitest` and `@vitest/coverage-v8` 3.2.x (**devDependencies**) still report [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) (`@vitest/mocker` redirect-mock path traversal). There is **no 3.x patch**; the fix is Vitest 4.1.11 / 5.0.x (a major bump). This repo stays on Vitest 3.x for Node 20 CI.

These are **devDependency** coverage/test-tooling vulns, accepted until an upstream 3.x backport or a planned major upgrade. We do **not** add `npm audit` ignore flags that hide all advisories.

CI runs `vitest run` (no Vitest UI / Browser Mode, no network-exposed API). Runtime `dependencies` currently audit clean.

---

# Política de seguridad

## Secretos

**No pongas secretos en este repositorio.** Ni API keys, tokens, credenciales ni archivos `.env`.

Los embeddings usan solo variables de entorno (`ATLAS_EMBEDDINGS_API_KEY` o `OPENAI_API_KEY`). Copia `.env.example` a `.env` en tu máquina.

Este proyecto solo incluye **fixtures sintéticos**. No contribuyas nombres reales de host/arranque/aprovisionamiento, IPs privadas, credenciales, inventarios, apodos de equipo ni nada que identifique infraestructura privada.

## Reportar una vulnerabilidad

Repórtala en privado, no en un issue público:

- Correo: **rentheria.dev@gmail.com**
- O el [reporte privado de GitHub](https://github.com/Rentheria/agent-context-atlas/security/advisories/new)

Incluye qué encontraste, cómo reproducirlo y el impacto potencial.

## Avisos de herramientas de desarrollo

`vitest` y `@vitest/coverage-v8` 3.2.x (**devDependencies**) siguen reportando [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) (path traversal en redirect mock de `@vitest/mocker`). **No hay parche 3.x**; el arreglo es Vitest 4.1.11 / 5.0.x (salto de major). Este repo se queda en Vitest 3.x por CI en Node 20.

Son vulnerabilidades de **devDependency** (cobertura/test), aceptadas hasta un backport 3.x o un upgrade de major planificado. **No** añadimos flags de `npm audit` que oculten todos los avisos.

CI ejecuta `vitest run` (sin UI / Browser Mode de Vitest, sin API expuesta a la red). Las `dependencies` de runtime auditan limpias ahora.
