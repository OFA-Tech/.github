# Actions Reference

This section summarizes action contracts in `actions/**/action.yml`.

## Setup and utility actions

### `actions/setup/resolve`
Resolves language defaults:

- version
- distribution
- build command
- test command

Supported languages: `dotnet`, `node`, `java`, `python`, `go`, `php`, `cpp`.

### `actions/setup/runtime`
Installs runtime/toolchain using upstream setup actions:

- .NET, Node, Java, Python, Go, PHP
- C/C++ installs toolchain via apt on Ubuntu

### `actions/run-command`
Executes arbitrary command in optional working directory (`bash`, strict mode enabled).

### `actions/setup/ofa-actions` (composite, bootstrap)
Resolves which version of `OFA-Tech/.github` the current run references (via
`actions/github/resolve-actions-version`) and checks it out into
`.ofa-tech-actions/` at that exact commit, so local
`./.ofa-tech-actions/actions/...` references match the ref the reusable
workflows were called with. Must be referenced remotely
(`OFA-Tech/.github/actions/setup/ofa-actions@main`) since it runs before any
checkout exists. Requires `actions: read`. Outputs: `ref`, `matched`.

---

## GitHub actions

### `actions/github/resolve-actions-version` (Node 20)
Uses the TypeScript bundle (`dist/github-resolve-actions-version/index.js`)
to query the workflow-run API's `referenced_workflows` and output the commit
SHA (`ref` output) of the shared actions repository this run was called
with; `matched=false` with the `fallback-ref` (default `main`) when the run
references nothing from it. Exists because `github.job_workflow_sha` is
empty on nested reusable-workflow calls.

---

## Docker actions

### `actions/docker/metadata` (Node 20)
Uses the TypeScript bundle (`dist/docker-metadata/index.js`) to resolve image
metadata: registry/account/repository fallbacks (overrides → secrets → env →
GitHub context), branch-based version bumping (`feature/*` → major,
`fix/*`/`hotfix/*` → minor, otherwise point), the `dev-`/`stg-` environment
prefix, and Docker Hub / `docker manifest` collision checks.

### `actions/docker/build-image`
Composite action that:

1. resolves image metadata via the TypeScript `docker-metadata` bundle (same logic as `actions/docker/metadata`)
2. logs in to registry (shell)
3. builds image (shell)
4. tags `latest` optionally (shell)
5. pushes version and optional latest tags (shell)

It emits rich metadata outputs used by downstream workflows.

### `actions/docker/remove`
Safe container/image removal with optional force/volume cleanup and dangling prune.

### `actions/docker/swarm-deploy`
Create or update swarm service. Handles replicas, ports, mounts, env, constraints, networks.

### `actions/docker/swarm-scale`
Scales existing swarm service to desired replicas.

### `actions/docker/swarm-rollback`
Rolls a swarm service back to previous version.

### `actions/docker/standalone-deploy`
Despite the directory name, current manifest is a generalized `docker run` wrapper with configurable runtime options.

---

## Portainer actions

### `actions/portainer/deploy-update` (Node 20)
Uses TypeScript bundle (`dist/portainer-deploy/index.js`) for deploy/update
orchestration. Stack-file content is read from inline input or the workspace
file and placeholder interpolation (`${NAME}` / `${NAME:-default}`) happens in
TypeScript before the file is sent to the Portainer API.

### `actions/portainer/stack-exists` (Node 20)
Uses TypeScript bundle (`dist/portainer-stack-exists/index.js`) for stack lookup and type resolution.

### `actions/portainer/rollback` (Node 20)
Uses TypeScript bundle (`dist/portainer-rollback/index.js`): looks the stack up
by name, computes the fallback rollback version (current minus one) when
`rollback-to` is not provided, and calls the Portainer rollback API.

### `actions/portainer/status`
Checks Portainer health and optionally endpoint runtime mode.

### `actions/portainer/stack-inspect`
Fetches stack metadata and emits full stack JSON.

### `actions/portainer/stack-file`
Fetches stack compose file content (latest or versioned).

### `actions/portainer/scale`
Updates stack using provided stack file content to apply scaling changes.

---

## SSH actions

### `actions/ssh/command`
Thin wrapper over `appleboy/ssh-action@v1.2.0`.

### `actions/ssh/upload`
Thin SCP wrapper over `appleboy/scp-action@v0.1.7`.
