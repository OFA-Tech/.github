# Development & Operations Guide

## Local requirements

- Node.js `>=20`
- npm

## Scripts (`package.json`)

- `npm run typecheck` — TypeScript static checks (`tsc --noEmit`)
- `npm test` — unit tests (`node --import tsx --test "test/**/*.test.ts"`)
- `npm run build` — bundles Node actions to `dist/`
- `npm run all` — typecheck + tests + build

## Typical contributor flow

1. Modify source under `src/`, `scripts/`, `actions/`, or workflows.
2. Run:
   - `npm ci`
   - `npm run all`
3. Commit source changes **and** any updated `dist/` artifacts.
4. Open PR.

## Dist parity enforcement

`check-dist.yml` verifies that rebuilding `dist/` introduces no uncommitted changes.

If it fails:

1. run `npm run build`
2. commit `dist/`
3. push again

## Shell helper responsibilities

### `scripts/common/action-common.sh`
Provides generic helpers:

- command evaluation
- output writing
- file-content loading
- placeholder interpolation functions

### `scripts/docker/common.sh`
Provides Docker-specific helpers:

- truthy parsing
- metadata resolution (registry/account/repo/tag)
- Docker Hub preflight checks
- automatic semantic-style tag generation with date suffix and collision checks
- registry login

## Operational caution points

- Several composite actions rely on `curl`, `jq`, and `docker` availability on runner.
- Some actions use `eval` for appended options/commands; inputs must be trusted/sanitized at caller side.
- `stage-rollback-portainer.yml` defaults to `self-hosted`; consumers should ensure runner availability.
