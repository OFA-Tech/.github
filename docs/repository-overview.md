# Repository Overview

## Mission

`OFA-Tech/.github` is the central DevOps repository used to standardize CI/CD across OFA-Tech repositories.

It is designed around reusable contracts rather than per-repository logic.

## Top-level structure

- `.github/workflows/` — reusable workflow stages and orchestrator
- `actions/` — public action interfaces (`action.yml`) consumed by workflows
- `src/` — TypeScript source for Node-based actions
- `dist/` — built JS bundles for Node actions (committed)
- `scripts/` — shell helpers used by composite actions
- `test/` — unit tests for TypeScript libraries
- `workflow-templates/` — starter templates for downstream repos
- `profile/README.md` — organization profile content

## Architectural model

The repo follows a strict split:

- **TypeScript (`src/`)** for orchestration, API logic, validation, retries, structured errors
- **Shell (`scripts/` + composite actions)** for thin operational commands

This boundary is documented in `CONTRIBUTING.md` and reflected in current implementation.

## Key technologies

- Node.js 20+ runtime for Node actions
- TypeScript 5.x (`moduleResolution: Bundler`, target ES2022)
- `@actions/core`, `@actions/exec` for action runtime interactions
- `@vercel/ncc` for bundling distributable action artifacts

## Current Node actions implemented in TypeScript

1. `portainer-deploy`
2. `portainer-stack-exists`

These compile to:

- `dist/portainer-deploy/index.js`
- `dist/portainer-stack-exists/index.js`

## Notable consistency check

`README.md` describes legacy stage names like `stage-test.yml` and `stage-sonar.yml`, while current workflow composition is centered on:

- `stage-build.yml`
- `stage-deploy-portainer.yml`
- `stage-post-deploy.yml`
- `stage-rollback-portainer.yml`

This is a documentation drift worth aligning in a future cleanup.
