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

Shell helpers are intentionally dumb; everything with branching, API access,
or data transformation lives in the TypeScript library.

### `scripts/common/action-common.sh`
Provides generic helpers shared by every shell action (the docker and
portainer scripts source this file):

- lowercase conversion
- output writing
- command evaluation
- failure reporting (`common_fail`) and required-command checks (`common_require_cmd`)
- truthy parsing (`common_is_true`) and true/false rendering (`common_bool`)

Stack-file loading and placeholder interpolation moved to TypeScript
(`Template`/`ScopedVariables` + `StackFileResolver`, used by the Portainer
deploy bundle).

### `scripts/docker/common.sh`
Provides Docker-specific helpers:

- username resolution and registry login
- Docker Hub push-permission preflight
- swarm-active guard (`docker_swarm_require_active`)
- newline-list-to-CLI-flag expansion (`docker_append_lines`)
- command execution with raw appended options (`docker_exec_with_extra`)

Metadata resolution and version-tag generation (branch-based bumping, date
suffix, collision checks) moved to TypeScript (`actions/docker/metadata` /
`dist/docker-metadata`).

### `scripts/portainer/common.sh`
Provides Portainer API helpers for the curl-based actions (scale, stack-file,
stack-inspect, status):

- base-URL normalization
- authenticated GET/PUT wrappers (`portainer_api_get` / `portainer_api_put`)
- stack-type resolution from a stack JSON payload

Deploy/update, rollback, and stack-exists logic lives in TypeScript
(`src/application/portainer` and the bundles under `dist/`).

## Operational caution points

- Several composite actions rely on `curl`, `jq`, and `docker` availability on runner.
- Some actions use `eval` for appended options/commands; inputs must be trusted/sanitized at caller side.
- `stage-rollback-portainer.yml` defaults to `self-hosted`; consumers should ensure runner availability.
